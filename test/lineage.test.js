// What the map lights up when a style is selected: two generations forward, one back,
// and the lane names legible in both schemes. The depth rule is in select() in app.js
// (HOPS, HOPS_BACK); the label ink is .lane .vt in head.html. Both were right once and
// drifted: the ancestors grew to two generations, which turned a selection into a fan of
// half-strength lines up the page, and the lane names went to a pastel of the family hue
// that read at 2:1 on a light map.
const path=require("path");
const {chromium}=require(require.resolve("playwright",{paths:[__dirname]}));
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const D=require("../src/data.js");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  // a style with parents that have parents, and children that have children
  const byId={}; D.DATA.forEach(r=>byId[r[0]]=r);
  const parents=id=>(byId[id][4]||"").split(/\s+/).filter(Boolean);
  const kids={}; D.DATA.forEach(r=>parents(r[0]).forEach(p=>(kids[p]=kids[p]||[]).push(r[0])));
  // one whose grandparents are not also its parents, so the one-back rule has something to exclude
const pick=D.DATA.find(r=>{ const ps=parents(r[0]); const gps=ps.flatMap(parents).filter(g=>!ps.includes(g)&&g!==r[0]);
  return gps.length && (kids[r[0]]||[]).some(k=>(kids[k]||[]).length); });
  const id=pick[0];
  const gen=(start,step,n)=>{ let front=new Set([start]), seen=new Set(); for(let i=0;i<n;i++){ const next=new Set(); front.forEach(s=>step(s).forEach(x=>{ if(!seen.has(x)&&x!==start){ seen.add(x); next.add(x); } })); front=next; } return seen; };
  const anc1=gen(id,parents,1), anc2=gen(id,parents,2), desc2=gen(id,s=>kids[s]||[],2), desc3=gen(id,s=>kids[s]||[],3);
  for(const scheme of ["light","dark"]){
    const ctx=await b.newContext({viewport:{width:1280,height:800},colorScheme:scheme});
    const p=await ctx.newPage(); await p.goto(URL+"#"+id); await arm(p); await shown(p,"#chart .n");
    await until(p,()=>!!document.querySelector("#chart .n.cur")); await settle(p);
    const lit=new Set(await p.$$eval("#chart .n.on",l=>l.map(g=>g.dataset.id)));
    const litAnc=[...anc2].filter(k=>lit.has(k)), litDesc=[...desc3].filter(k=>lit.has(k));
    say(scheme+": selecting "+pick[1]+" lights every parent ("+anc1.size+")", [...anc1].every(k=>lit.has(k)));
    say("  and no grandparent ("+(anc2.size-anc1.size)+" exist)", [...anc2].filter(k=>!anc1.has(k)).every(k=>!lit.has(k)));
    say("  every child and grandchild ("+desc2.size+")", [...desc2].every(k=>lit.has(k)));
    say("  and no great-grandchild ("+(desc3.size-desc2.size)+" exist)", [...desc3].filter(k=>!desc2.has(k)).every(k=>!lit.has(k)));
    // a lit edge is solid enough to see: the direct ones at full strength
    const e=await p.evaluate(()=>{ const g=s=>{const x=document.querySelector(s); return x?+getComputedStyle(x).opacity:null;}; return {dir:g("#chart .e.dir"), on:g("#chart .e.on:not(.dir):not(.d2)"), d2:g("#chart .e.on.d2")}; });
    say("  direct links at full strength, the next generation at least .5 ("+JSON.stringify(e)+")", e.dir===1 && (e.on==null||e.on>=.7) && (e.d2==null||e.d2>=.5));
    // lane names read on the map in this scheme, selected or not
    const lanes=await p.evaluate(()=>{ const lum=c=>{const m=c.match(/[\d.]+/g).map(Number); const [r,g,b]=(/color\(/.test(c)?m.slice(0,3).map(v=>v*255):m.slice(0,3)).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*r+.7152*g+.0722*b;};
      const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
      return [...document.querySelectorAll("#lanes .lane.c")].map(l=>{const t=l.querySelector(".vt"); const r=ratio(getComputedStyle(t).color,getComputedStyle(l).backgroundColor); const op=+getComputedStyle(l).opacity*+getComputedStyle(t).opacity; return [l.dataset.fam,+r.toFixed(2),+op.toFixed(2)];}); });
    const weak=lanes.filter(([,r])=>r<4.5);
    say("  every lane name at AA on its lane ("+Math.min(...lanes.map(x=>x[1]))+":1 at worst)", weak.length? weak.map(x=>x[0]+" "+x[1]).join(", ") : true);
    const faded=lanes.filter(([,,op])=>op<.5);
    say("  and none faded below half even outside the selection", faded.length? faded.map(x=>x[0]+" "+x[2]).join(", ") : true);
    await ctx.close();
  }
  await b.close();
})().catch(e=>{ say("suite ran", e.stack||String(e)); });
