#!/usr/bin/env node
// missing-art.js reimplements the note parser, so it can drift from the app. This opens
// a sample of styles in the real page, reads what each Key artists page actually draws,
// and compares. A disagreement here means the list is lying, which is worse than no list.
const {chromium}=require("playwright");
const path=require("path");
const skipWelcome=require(path.join(__dirname,"..","test","_hello"));
const {settle,until,shown,arm}=require(path.join(__dirname,"..","test","_wait"));
const D=require(path.join(__dirname,"..","src","data.js"));
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));

const SAMPLE=(process.argv[2]||"").split(",").filter(Boolean);
const ids = SAMPLE.length ? SAMPLE
  : D.DATA.map(r=>r[0]).filter((_,i)=>i%17===0);   // ~27 styles, spread through the file

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  let bad=0, seen=0;
  for(const id of ids){
    const p=await ctx.newPage();
    await p.goto(URL+"#"+id); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await until(p,()=>document.body.classList.contains("open"));
    const head=await p.$(".subh.subgo");
    if(!head){ await p.close(); continue; }
    await head.click();
    await until(p,()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
      return !!u && u.dataset.p==="artists";});
    await settle(p);
    const drawn=await p.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
      return [...u.querySelectorAll(".amrow")].map(a=>({
        name:a.dataset.name,
        pic:!!a.querySelector(".lrico.hasimg")}));});
    await p.close();
    for(const d of drawn){
      seen++;
      const mine = !!(D.PHOTO[d.name] || D.COVERART[d.name]);
      if(mine!==d.pic){ bad++; if(bad<=5) console.log("  mismatch: "+id+" / "+d.name
        +" — app draws "+(d.pic?"a picture":"a glyph")+", list says "+(mine?"picture":"none")); }
    }
  }
  say("the list agrees with the app on "+seen+" rows across "+ids.length+" styles",
    bad===0 ? true : bad+" disagree");
  await b.close();
  process.exitCode = bad ? 1 : 0;
})();
