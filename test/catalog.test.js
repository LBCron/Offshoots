// The map, published as data for a reader that cannot look at a picture.
//
// Two things have to hold. The file has to say the same thing the app says, which is why
// it is generated from src/data.js at build time rather than maintained beside it: a
// hand-kept copy drifts, and a drifted copy is worse than none, because nothing tells the
// person asking. And it has to be reachable from the app, or nobody finds it.
const fs=require("fs"), path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const D=require(path.join(__dirname,"..","src","data.js"));
const FILE=path.join(__dirname,"..","offshoots.json");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));

(async()=>{
  if(!fs.existsSync(FILE)){
    say("offshoots.json is written by the build", false);
    process.exitCode=1; return;
  }
  const raw=fs.readFileSync(FILE,"utf8");
  let J=null, err="";
  try{ J=JSON.parse(raw); }catch(e){ err=e.message; }
  say("it parses as JSON ("+Math.round(raw.length/1024)+" KB)", J?true:err);
  if(!J) { process.exitCode=1; return; }

  // ---- it says what the app says ----
  say("every style is in it ("+J.styles.length+")", J.styles.length===D.DATA.length);
  const byId=Object.fromEntries(J.styles.map(s=>[s.id,s]));
  const missing=D.DATA.filter(r=>!byId[r[0]]).map(r=>r[0]);
  say("  by the same ids", missing.length===0 ? true : missing.slice(0,5).join(", "));
  const wrongName=D.DATA.filter(r=>byId[r[0]] && byId[r[0]].name!==r[1]).map(r=>r[0]);
  say("  under the same names", wrongName.length===0 ? true : wrongName.slice(0,5).join(", "));
  const wrongYear=D.DATA.filter(r=>byId[r[0]] && byId[r[0]].year!==r[2]).map(r=>r[0]);
  say("  at the same years", wrongYear.length===0 ? true : wrongYear.slice(0,5).join(", "));

  // lineage both ways: a parent that does not list the child back is a map you cannot walk
  const badFrom=[];
  for(const r of D.DATA){
    const want=(r[4]?r[4].split(" "):[]).sort().join(",");
    const got=(byId[r[0]].grewOutOf||[]).map(x=>x.id).sort().join(",");
    if(want!==got) badFrom.push(r[0]+": "+got+" vs "+want);
  }
  say("  with the same parentage", badFrom.length===0 ? true : badFrom.slice(0,3).join(" | "));
  const oneWay=[];
  for(const s of J.styles) for(const c of (s.ledTo||[]))
    if(!(byId[c.id].grewOutOf||[]).some(p=>p.id===s.id)) oneWay.push(s.id+" -> "+c.id);
  say("  and ledTo agreeing with grewOutOf both ways",
    oneWay.length===0 ? true : oneWay.slice(0,3).join(", "));

  // playlists are the reason to point a model at this at all
  const want=D.DATA.filter(r=>D.PLAY[r[0]]||D.SPLAY[r[0]]).length;
  const got=J.styles.filter(s=>s.playlist).length;
  say("every playlist is carried ("+got+" of "+D.DATA.length+")", got===want);
  const badUrl=J.styles.filter(s=>s.playlist
    && !/^https:\/\/(music\.apple\.com|open\.spotify\.com)\//.test(
        s.playlist.appleMusic||s.playlist.spotify||"")).map(s=>s.id);
  say("  as absolute links someone else can follow",
    badUrl.length===0 ? true : badUrl.slice(0,4).join(", "));
  const songs=J.styles.reduce((n,s)=>n+((s.songs||[]).length),0);
  say("  with "+songs+" songs and "+J.counts.artists+" artists behind them",
    songs>0 && J.counts.artists>0);
  say("crossings are in it ("+J.crossStylePlaylists.length+")",
    J.crossStylePlaylists.length===(D.XPLAY||[]).length);
  const badX=(J.crossStylePlaylists||[]).filter(x=>!x.tracks || !x.tracks.length).map(x=>x.id);
  say("  each with its tracklist", badX.length===0 ? true : badX.join(", "));

  // ---- it tells its reader what it is and what it is not ----
  // a model handed a file of lineage will state it as fact unless the file says otherwise
  const r=J.readMe||{};
  say("it carries a note to the reader",
    !!r.purpose && !!r.lineage && !!r.artists && !!r.caution);
  say("  saying the lineage is a reading, not a fact",
    /reading|contested/i.test(r.lineage||""));
  say("  and that absence is not evidence", /absence/i.test(r.caution||""));

  // ---- and the app points at it ----
  const b=await chromium.launch(); await skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:430,height:930}});
  const p=await ctx.newPage();
  await p.goto(URL+"#about"); await arm(p); await shown(p,"#chart .n"); await settle(p);
  await until(p,()=>!!document.querySelector('.ppage[data-p="about"]'));
  await settle(p);
  const link=await p.evaluate(()=>{
    const a=document.querySelector('.ppage[data-p="about"] .dataline');
    if(!a) return null;
    return {href:a.getAttribute("href"), tap:Math.round(a.getBoundingClientRect().height),
      blank:a.target==="_blank" && /noopener/.test(a.rel),
      label:a.textContent.replace(/\s+/g," ").trim()};});
  say("About links to it (\""+(link&&link.label)+"\")",
    !!link && link.href==="offshoots.json");
  say("  opening in its own tab, clearing the tap floor ("+(link&&link.tap)+"px)",
    !!link && link.blank && link.tap>=44);
  // the page says how big it is, because the size is the thing that decides whether you
  // can hand it to a model in one go
  const kb=Math.round(raw.length/1024);
  const said=(link&&link.label.match(/about (\d+) KB/)||[])[1];
  say("  and says its size honestly ("+said+" KB said, "+kb+" KB on disk)",
    !!said && Math.abs(+said-kb)<=kb*0.2);

  await b.close();
})();
