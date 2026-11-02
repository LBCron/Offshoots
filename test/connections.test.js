// Explore the connections: rows that go somewhere, and columns that say which way.
//
// The rows were a dot, a name and a year with nothing to say they were buttons, which on a
// phone is indistinguishable from a list you cannot tap. And the two headings were plain
// text, so neither said which direction it pointed along the timeline.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

const open=async p=>{
  // On a phone the panel is a peek until the sheet is raised, and the section is folded
  // shut besides. Shut, content-visibility lets the rows report a size they never had laid
  // out, so measuring without doing both reads geometry that does not exist.
  if(await p.evaluate(()=>!document.body.classList.contains("open"))){
    await p.click("#grab").catch(()=>{});
    await until(p,()=>document.body.classList.contains("open")); await settle(p); }
  await p.evaluate(()=>{ const d=document.querySelector(".sect-connections");
    d.open=true; d.scrollIntoView({block:"start"}); });
  await settle(p); await new Promise(r=>setTimeout(r,250));
};
const look=p=>p.evaluate(()=>{
  const rows=[...document.querySelectorAll(".cxgo")];
  const r=x=>x.getBoundingClientRect();
  const gaps=rows.map(x=>{ const y=x.querySelector("small"), c=x.querySelector(".lrcv");
    return y&&c ? Math.round(r(c).left-r(y).right) : -999; });
  const heads=[...document.querySelectorAll(".cxh")].map(h=>({
    text:(h.querySelector("span")||h).textContent.trim(),
    arrow:!!h.querySelector(".cxar"),
    hidden:[...h.querySelectorAll(".cxar")].every(a=>a.getAttribute("aria-hidden")==="true"),
    // currentColor, so the arrow is whatever the heading is on this family's skin
    sameInk:h.querySelector(".cxar")
      ? getComputedStyle(h.querySelector(".cxar")).color===getComputedStyle(h).color : false,
    // ← before the words on the earlier column, → after them on the later one
    before: h.firstElementChild && h.firstElementChild.classList.contains("cxar")}));
  return {n:rows.length,
    chev:rows.filter(x=>x.querySelector(".lrcv")).length,
    minGap:Math.min(...gaps),
    spill:rows.filter(x=>{ const c=x.querySelector(".lrcv");
      return !c || r(c).right > r(x).right-1; }).length,
    names:rows.filter(x=>{ const n=x.querySelector(".nm");
      return r(n).width<40; }).length,
    heads};
});

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  // folkrock has the most connections and the longest names on the map: 15 rows, 32 chars
  for(const [tag,vp] of [["390px phone",{width:390,height:844}],
                         ["desktop    ",{width:1280,height:860}]]){
    const p=await (await b.newContext({viewport:vp})).newPage();
    await p.goto(URL+"#folkrock"); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await until(p,()=>!!document.querySelector(".sect-connections"));
    await open(p);
    const v=await look(p);
    note(tag, v.n+" rows, "+v.chev+" marked");
    say(tag+": every row carries the go-to mark", v.n>0 && v.chev===v.n);
    say("  the same chevron the other go-to rows use", await p.evaluate(()=>{
      const a=document.querySelector(".cxgo .lrcv");
      const bq=document.querySelector(".listrow .lrcv, .secthead.sectgo .sectcv svg");
      return !!a && !!bq && a.innerHTML===bq.innerHTML; }));
    say("  clear of the year rather than against it ("+v.minGap+"px)", v.minGap>=4);
    say("  and inside the row, not spilling past it ("+v.spill+")", v.spill===0);
    say("  with the name still the thing with the room", v.names===0);
    note("  headings", v.heads.map(h=>h.text).join(" / "));
    say("  both columns say which way they point",
      v.heads.length===2 && v.heads.every(h=>h.arrow));
    say("    earlier to the left, later to the right, as on the map",
      v.heads[0].before===true && v.heads[1].before===false);
    say("    drawn in the heading's own ink, so they take the family tint",
      v.heads.every(h=>h.sameInk));
    say("    and left out of the reading, the words being the label",
      v.heads.every(h=>h.hidden)
      && v.heads[0].text==="Before this style" && v.heads[1].text==="After this style");
    // the mark is a claim that the row goes somewhere; it has to be true
    const went=await p.evaluate(async()=>{
      const was=location.hash; document.querySelector(".cxgo").click();
      await new Promise(r=>setTimeout(r,400));
      return {was, now:location.hash}; });
    say("  and a row so marked does go there ("+went.was+" → "+went.now+")",
      went.now!==went.was && went.now.length>1);
    await p.close();
  }
  await b.close();
})();
