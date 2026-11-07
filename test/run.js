// Runs every *.test.js against the built index.html and exits non-zero if any check fails.
//
//   node src/build.js && node test/run.js            all suites, four at a time
//   node test/run.js root sheet                      just those
//   node test/run.js -1                              one at a time, output in order
//
// Each suite drives a real Chromium through Playwright and prints one line per check,
// prefixed PASS or FAIL. They load index.html over file://, so art/ resolves from the
// repo's own folder and covers render exactly as they do when served.
//
// Why it runs them in parallel: most of a suite's time is a page loading or a wait for
// the page to settle, not CPU, so four at a time on two cores cuts the wall clock to
// roughly the longest suite plus sheet.test.js. A full run is about five minutes. Output
// is captured per suite and printed whole, so interleaving never garbles a line.
//
// The summary's "N dead waits" column counts waits that ran to their cap (see _wait.js).
// Each one is ten seconds of nothing, and two suites were once nearly all of that: xplay
// and contrast spent 363s and 495s waiting for a sheet to open on pages that open with
// it shut by design, and passed. Run the suite alone to see which lines.
//
// One trap worth knowing: changing location.hash on a page that is already loaded is a
// same-document navigation, so the app does not re-select. Every suite opens a style on
// a fresh page instead. Several false failures in this project came from reusing one.
const {execFile}=require("child_process");
const fs=require("fs"), path=require("path");

const args=process.argv.slice(2);
const lim=Math.max(1,+(args.find(a=>/^-\d+$/.test(a))||"-4").slice(1));
const only=args.filter(a=>!/^-\d+$/.test(a));
const all=fs.readdirSync(__dirname).filter(f=>f.endsWith(".test.js")).sort();
const files=only.length ? all.filter(f=>only.some(o=>f===o||f===o+".test.js")) : all;
if(!files.length){ console.error("no suites matched "+only.join(" ")); process.exit(2); }

// sheet.test.js runs on its own. Its frame-counting is gone, but it still proves the drag
// and the flick by moving a real mouse in real time: the app tells a drag from a flick by
// how far the pointer went in how long, so the gesture cannot be seeked or faked without
// testing something other than the thing. Four Chromiums on two cores stretch those steps,
// a slow drag arrives as a flick and a flick as a drag, and the suite reports the machine.
// Twice in one sitting it failed in the pool on a gesture and passed alone, with different
// checks each time. The serial tail is about eighty seconds and buys a run you can believe.
const SOLO=["sheet.test.js"];

// Longest first. Alphabetical order put the two longest suites (contrast, xplay: eight
// and six minutes on a loaded machine) seventh and second-to-last in the queue, so the
// whole run waited on whichever of them started last. The pool now takes suites in order
// of how long they took last time, which is the classic way to pack a queue onto a fixed
// number of workers: the long ones start at once and the short ones fill in behind them.
// Timings are remembered in test/.timings.json (gitignored); a suite with no record runs
// first, since it may be a new long one.
const TIMES=path.join(__dirname,".timings.json");
let past={}; try{ past=JSON.parse(fs.readFileSync(TIMES,"utf8")); }catch(e){}
const rank=f=>past[f]==null ? 1e9 : past[f];
const order=l=>l.slice().sort((a,b)=>rank(b)-rank(a) || a.localeCompare(b));

// data.test.js runs before the pool, alone, and a failure there ends the run. It needs no
// browser and takes milliseconds, and what it checks is what every other suite assumes:
// a parent id that exists, a cover that points at a file, a table edited inside its own
// range. When it fails, ten minutes of Chromium would only report the same slip as blank
// spots and missing rows, so the run stops here and says which table and which row.
const FIRST="data.test.js";

const run=f=>new Promise(res=>{
  const t0=Date.now();
  execFile(process.execPath,[path.join(__dirname,f)],{encoding:"utf8",maxBuffer:1<<24},
    (err,stdout,stderr)=>res({f,ms:Date.now()-t0,out:(stdout||"")+(stderr||""),crashed:!!err}));
});

(async()=>{
  const done=[];
  if(files.includes(FIRST)){
    const r=await run(FIRST); done.push(r);
    if(r.crashed || /^FAIL/m.test(r.out)){
      process.stdout.write(r.out.split("\n").filter(l=>!l.startsWith("PASS")).join("\n")
        +"\n\n"+FIRST+" failed, so the browser suites did not run.\n");
      process.exit(1);
    }
  }
  const queue=order(files.filter(f=>!SOLO.includes(f) && f!==FIRST)), solo=files.filter(f=>SOLO.includes(f));
  await Promise.all(Array.from({length:Math.min(lim,queue.length)},async()=>{
    while(queue.length) done.push(await run(queue.shift()));
  }));
  for(const f of solo) done.push(await run(f));
  done.sort((a,b)=>files.indexOf(a.f)-files.indexOf(b.f));

  let failed=0, checks=0, crashed=0;
  const rows=[];
  for(const r of done){
    const lines=r.out.split("\n").filter(Boolean);
    const bad=lines.filter(l=>l.startsWith("FAIL"));
    const n=lines.filter(l=>/^(PASS|FAIL)/.test(l)).length;
    const dead=lines.filter(l=>/^     wait: .* ran to its /.test(l)).length;
    checks+=n; failed+=bad.length; if(r.crashed) crashed++;
    rows.push([r.f, n, bad.length, r.crashed, (r.ms/1000).toFixed(1), dead]);
    // a crashed suite stops early and reports no failures, which reads as a pass: print
    // everything so the exception is visible, not just the checks that got as far as running
    if(r.crashed || bad.length){
      process.stdout.write("\n"+r.f+"\n"+lines.map(l=>"  "+l).join("\n")+"\n");
      if(r.crashed) process.stdout.write("  !! suite crashed\n");
    }
  }
  // remember how long each suite took, for the next run's ordering
  try{ done.forEach(r=>past[r.f]=r.ms); fs.writeFileSync(TIMES,JSON.stringify(past,null,1)+"\n"); }catch(e){}
  process.stdout.write("\n");
  // "N dead waits": waits that ran to their cap. Each is ten seconds of nothing, and a
  // suite that is long and green can be mostly that. The lines naming them are in the
  // suite's own output (node test/run.js <suite>).
  for(const [f,n,bad,crash,secs,dead] of rows)
    process.stdout.write(f.replace(".test.js","").padEnd(10)+String(n).padStart(4)+" checks"
      + (crash?"  CRASHED":bad?"  "+bad+" FAILED":"         ")+secs.padStart(7)+"s"
      + (dead?"   "+dead+" dead wait"+(dead>1?"s":""):"")+"\n");
  // A flake you cannot name is a flake you cannot fix, and twice now one has gone past
  // between two clean runs with nothing kept. Every failing run writes itself down.
  if(failed||crashed){
    const stamp=new Date().toISOString().replace(/[:.]/g,"-");
    const file=path.join(__dirname,"failures",stamp+".txt");
    try{
      fs.mkdirSync(path.join(__dirname,"failures"),{recursive:true});
      fs.writeFileSync(file, done.map(r=>"=== "+r.f+(r.crashed?" (CRASHED)":"")+"\n"+r.out).join("\n"));
      process.stdout.write("\nwrote "+path.relative(process.cwd(),file)+"\n");
    }catch(e){ process.stdout.write("\ncould not write the failure log: "+e.message+"\n"); }
  }
  process.stdout.write("\n"+checks+" checks, "+failed+" failed"
    +(crashed?", "+crashed+" crashed":"")+"\n");
  process.exit(failed||crashed?1:0);
})();
