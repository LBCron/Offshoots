// Two glyphs, two meanings: a chevron for a row that opens a panel over this one, a solid
// triangle for a fold whose contents are already here. They used to be the same glyph, so
// every fold read as a way out of the panel. Nothing in the markup distinguishes them but
// the path, which is why this looks at the path rather than at a class name.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
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
  say("every fold control is the solid triangle",
    v.folds.length>=1 && v.folds.every(f=>TRI.test(f.d))
      ? true : v.folds.filter(f=>!TRI.test(f.d)).map(f=>f.label).join(" | "));
  note("row carets on the root panel", v.rows.length);
  say("every row that opens a panel is the chevron",
    v.rows.length>=4 && v.rows.every(r=>CHV.test(r.d))
      ? true : v.rows.filter(r=>!CHV.test(r.d)).map(r=>r.label).join(" | "));
  say("no duotone glyph is left on it ("+v.duo+")", v.duo===0);

  // a triangle that does not turn when the fold opens is a triangle pointing the wrong way
  const turned=await p.evaluate(()=>{
    const d=[...document.querySelectorAll("details")].find(x=>!x.open);
    if(!d) return "every fold was already open";
    const g=d.querySelector("summary svg");
    const was=getComputedStyle(g).transform;
    d.open=true;
    return {was, now:getComputedStyle(g).transform};
  });
  say("and it turns to face down when the fold opens",
    typeof turned==="object" && turned.was!==turned.now ? true : JSON.stringify(turned));

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
  say("a style panel folds use the triangle too",
    v.folds.length>=1 && v.folds.every(f=>TRI.test(f.d))
      ? true : v.folds.map(f=>f.label+": "+(CHV.test(f.d)?"chevron":"other")).join(" | "));
  say("  and its rows the chevron ("+v.rows.length+")",
    v.rows.every(r=>CHV.test(r.d)) ? true
      : v.rows.filter(r=>!CHV.test(r.d)).map(r=>r.label).join(" | "));
  say("  with no duotone left ("+v.duo+")", v.duo===0);

  await b.close();
})();
