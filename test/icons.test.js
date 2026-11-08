// Two glyphs, two meanings: a chevron for a row that opens a panel over this one, a solid
// triangle for a fold whose contents are already here. They used to be the same glyph, so
// every fold read as a way out of the panel. Nothing in the markup distinguishes them but
// the path, which is why this looks at the path rather than at a class name.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise}=require("./_wait");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

// the solid triangle: one closed path with no inner counter
const TRI=/M181\.66,133\.66l-80,80A8,8,0,0,1,88,208V48/;
// the chevron: a stroke that doubles back on itself
const CHV=/M181\.66,133\.66l-80,80a8,8,0,0,1-11\.32-11\.32L164\.69,128/;

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:430,height:930}});
  const p=await ctx.newPage();
  await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);

  const look=(pg=p)=>pg.evaluate(()=>{
    const d=e=>[...e.querySelectorAll("path")].map(x=>x.getAttribute("d")).join("");
    const out={folds:[],rows:[],duo:0};
    for(const s of document.querySelectorAll("details > summary")){
      const g=s.querySelector("svg"); if(!g) continue;
      out.folds.push({
        label:(s.textContent||"").replace(/\s+/g," ").trim().slice(0,46),
        d:d(g), open:s.parentElement.open,
        rot:getComputedStyle(g).transform});
    }
    for(const r of document.querySelectorAll(".listrow .lrcv, .secthead.sectgo .sectcv svg")){
      const g=r.tagName==="svg"?r:r.querySelector("svg")||r;
      const row=g.closest(".listrow,.secthead");
      out.rows.push({label:(row.textContent||"").replace(/\s+/g," ").trim().slice(0,40), d:d(g)});
    }
    out.duo=document.querySelectorAll('svg path[opacity="0.2"]').length;
    return out;
  });

  let v=await look();
  note("folds on the root panel", v.folds.length);
  for(const f of v.folds) note("  "+f.label, (TRI.test(f.d)?"triangle":CHV.test(f.d)?"chevron":"other")
    +(f.open?", open":", shut"));
  // The root has no folds at all now: About was the last one, and it is a plain section.
  // So this says what it can here, that nothing on it is a fold wearing a chevron, and
  // the triangle itself is checked on the style panel below, which still has five.
  say("no fold on the root wears anything but the triangle",
    v.folds.every(f=>TRI.test(f.d))
      ? true : v.folds.filter(f=>!TRI.test(f.d)).map(f=>f.label).join(" | "));
  note("row carets on the root panel", v.rows.length);
  say("every row that opens a panel is the chevron",
    v.rows.length>=4 && v.rows.every(r=>CHV.test(r.d))
      ? true : v.rows.filter(r=>!CHV.test(r.d)).map(r=>r.label).join(" | "));
  say("no duotone glyph is left on it ("+v.duo+")", v.duo===0);
  // nor does the app still tell anyone they are. About said "Phosphor, the Duotone
  // weight" for weeks after the icons stopped being duotone: the drawings changed and
  // the sentence describing them did not, and nothing here was looking at the prose.
  say("and nothing in the app still says they are",
    !/duotone/i.test(require("fs").readFileSync(
      path.join(__dirname,"..","index.html"),"utf8"))
      ? true : "the word is still in the built page");

  // the style panel has its own folds and its own rows
  // a fresh page, because goto to another hash on the same document does not reload and
  // the panel stays where it was: the first run of this check read the root panel twice
  // and passed, which is how a check that never reaches the thing it names looks.
  const q=await ctx.newPage();
  await q.goto(URL+"#gospel"); await arm(q); await shown(q,"#chart .n"); await settle(q);
  await until(q,()=>!!document.querySelector("h1.pttl"));
  await settle(q);
  v=await look(q);
  note("folds on a style panel", v.folds.length);
  for(const f of v.folds) note("  "+f.label, (TRI.test(f.d)?"triangle":CHV.test(f.d)?"chevron":"other")
    +(f.open?", open":", shut"));
  // a triangle that does not turn when the fold opens is a triangle pointing the wrong
  // way. Checked here rather than on the root, which has no folds left to turn.
  // About this style was the fold this used to turn, near the top of the panel and so
  // inside the half-open sheet. It is gone, so this takes Go deeper's first group, which
  // sits below the peek: the sheet comes up first, since what the peek hides reports no
  // transform at all.
  if(!(await q.evaluate(()=>document.body.classList.contains("open")))){ await raise(q);
    await until(q,()=>document.body.classList.contains("open")); }
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q);
  const turned=await q.evaluate(async()=>{
    const d=document.querySelector("details.xfold");
    if(!d) return "no triangle fold on the panel";
    const g=d.querySelector("summary svg");
    d.scrollIntoView({block:"center"});
    const rest=()=>new Promise(z=>setTimeout(z,320));
    d.open=false; await rest(); const was=getComputedStyle(g).transform;
    d.open=true;  await rest(); return {was, now:getComputedStyle(g).transform};
  });
  say("it turns to face down when the fold opens",
    typeof turned==="object" && turned.was!==turned.now ? true : JSON.stringify(turned));
  say("a style panel folds use the triangle too",
    v.folds.length>=1 && v.folds.every(f=>TRI.test(f.d))
      ? true : v.folds.map(f=>f.label+": "+(CHV.test(f.d)?"chevron":"other")).join(" | "));
  say("  and its rows the chevron ("+v.rows.length+")",
    v.rows.every(r=>CHV.test(r.d)) ? true
      : v.rows.filter(r=>!CHV.test(r.d)).map(r=>r.label).join(" | "));
  say("  with no duotone left ("+v.duo+")", v.duo===0);

  await b.close();
})();
