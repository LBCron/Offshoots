// The panel as a stack of pages.
//
// Roots and Most influential used to drop a menu over the panel, portaled to <body> so
// the panel's own overflow could not clip it, and About and How to install were folds
// that unrolled under your thumb at the bottom of a long scroll. All four are pages now:
// tapping pushes one in from the right, the panel's back button pops it.
//
// What this suite holds onto: only one page is ever shown, the back button says where it
// goes, picking a style from a list still selects it, Escape unwinds, and a fresh panel
// starts from a clean stack rather than remembering where you were.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const M={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2};
const Dk={width:1280,height:900};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
// boot runs on document.fonts.ready, so a loaded document is not a booted one. The first
// drawn node says boot got as far as choosing what to show.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing is
// mutating. True of a sheet closing as much as one opening.
const glided=q=>until(q,()=>!document.getElementById("panel").style.height);
// A push leaves the page it came from visible until it is hidden 240ms later, so the
// arrival is "the first page still showing is this one" rather than "this one exists".
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };
// a deep link pushes its page about 420ms into boot, so the stack is settled only once
// something other than the root is the page showing. Which page it is, is the check's own
// business rather than the wait's.
const pushed=async q=>{ await until(q,()=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p!=="root";}); await settle(q); };
// picking a style rebuilds the panel off the selection, which is over when the hash has
// left where it started. Naming the destination here would be asserting the answer.
const moved=async(q,from)=>{ await until(q,f=>location.hash!==f,from); await settle(q); };

async function fresh(b,vp,hash){ const p=await b.newPage({viewport:vp}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+(hash||"")); await ready(p);
  if(hash) await pushed(p);
  if(vp===M){ await p.click("#grab").catch(()=>{}); await glided(p); await settle(p); }
  p._errs=errs; return p; }
const state=p=>p.evaluate(()=>{
  const pages=[...document.querySelectorAll(".ppage")];
  const up=pages.filter(x=>!x.hidden);
  const b=document.getElementById("panelBack");
  return {pages:pages.length, shown:up.length, key:up.length?up[0].dataset.p:null,
    title:up.length?(up[0].querySelector(".bigttl .mn")||{}).textContent:null,
    back:!b.hidden, backLbl:(b.querySelector(".bklbl")||{}).textContent,
    scroll:document.getElementById("panelBody").scrollTop};});

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);

  // ---------- mobile ----------
  let p=await fresh(b,M);
  const rows=await p.$$eval(".sect-browse .listgrp .listrow .lrlbl",e=>e.map(x=>x.textContent));
  say("three ways in: "+rows.join(" / "),
    rows.join("/")==="Roots/Most influential/Surprise me");
  const col=await p.$$eval(".sect-learn [data-page] .lrlbl",e=>e.map(x=>x.textContent));
  say("and a colophon of two: "+col.join(" / "), col.join("/")==="About this map/How to install it");
  say("nothing is pushed at rest", (await state(p)).pages===1);
  say("and no menu is left over from the old build", (await p.$$(".navmenu .brmenu, [data-menu='roots']")).length===0);

  await p.click('[data-page="roots"]'); await onPage(p,"roots");
  let st=await state(p);
  say("Roots pushes a page ("+st.title+")", st.key==="roots" && st.title==="Roots");
  say("  two pages exist but only one is shown", st.pages===2 && st.shown===1);
  say("  back appears, naming where it goes ("+st.backLbl+")", st.back && st.backLbl==="Explore");
  say("  and the name is actually painted",
    await p.evaluate(()=>{const l=document.querySelector("#panelBack .bklbl");
      return getComputedStyle(l).display!=="none" && l.getBoundingClientRect().width>20;}));
  say("  it starts at the top", st.scroll===0);
  const n=await p.$$eval('.ppage[data-p="roots"] .listrow',e=>e.length);
  say("  listing "+n+" styles", n===17);
  say("  each row points the way it goes",
    await p.$$eval('.ppage[data-p="roots"] .listrow .lrcv',e=>e.length>0 && e.every(x=>x.classList.contains("lrgov"))));

  // pushing the same page twice would stack it on itself
  await p.evaluate(()=>{const r=document.querySelector('[data-page="roots"]'); if(r) r.click();});
  // nothing should come of that tap, so the wait is for the page to stop changing rather
  // than for an arrival that must not happen
  await settle(p);
  say("  and the row under it cannot be tapped again", (await state(p)).pages===2);

  await p.click("#panelBack"); await onPage(p,"root");
  st=await state(p);
  say("back pops it", st.pages===1 && st.key==="root" && st.title==="Explore");
  say("  and takes the back button with it", st.back===false);

  // Escape unwinds before it closes the panel
  await p.click('[data-page="top"]'); await onPage(p,"top");
  const top=await p.$$eval('.ppage[data-p="top"] .listrow',e=>e.length);
  say("Most influential pushes "+top+" styles", top===24);
  say("  with a count on every row",
    await p.$$eval('.ppage[data-p="top"] .lrct',e=>e.length===24 && e.every(x=>/^\d+$/.test(x.textContent))));
  await p.keyboard.press("Escape"); await onPage(p,"root");
  st=await state(p);
  say("Escape pops the page rather than closing the panel",
    st.pages===1 && (await p.$eval("body",e=>e.classList.contains("open")))===true);

  // picking a style leaves the stack behind
  await p.click('[data-page="roots"]'); await onPage(p,"roots");
  await p.click('.ppage[data-p="roots"] [data-go]'); await moved(p,"");
  const hash=await p.evaluate(()=>location.hash);
  say("picking from a page selects it ("+hash+")", hash.length>1);
  say("  and the style panel starts from a clean stack",
    (await p.$$(".ppage")).length<=1 && (await p.$$('.ppage[data-p="roots"]')).length===0);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.close();

  // ---------- the colophon ----------
  p=await fresh(b,M);
  await p.click('[data-page="install"]'); await onPage(p,"install");
  st=await state(p);
  say("How to install pushes its own page ("+st.title+")", st.key==="install");
  say("  with the platform sections on it",
    (await p.$$eval('.ppage[data-p="install"] .subh',e=>e.length))>=4);
  say("  and About is not pushed with it", (await p.$$('.ppage[data-p="about"]')).length===0);
  await p.click("#panelBack"); await onPage(p,"root");
  await p.click('[data-page="about"]'); await onPage(p,"about");
  say("About pushes its own", (await state(p)).key==="about");
  say("  carrying the app icon and the stats line",
    (await p.$$('.ppage[data-p="about"] .abouthd .appicon')).length===1
    && (await p.$$('.ppage[data-p="about"] .stats')).length===1);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.close();

  // ---------- desktop ----------
  p=await fresh(b,Dk);
  await p.click('[data-page="roots"]'); await onPage(p,"roots");
  st=await state(p);
  say("the sidebar pushes pages the same way", st.key==="roots" && st.shown===1);
  say("  and the back button is there too", st.back && st.backLbl==="Explore");
  const fits=await p.evaluate(()=>{
    const pg=document.querySelector('.ppage[data-p="roots"]'), b=document.getElementById("panelBody");
    return Math.round(pg.getBoundingClientRect().width)<=Math.round(b.getBoundingClientRect().width);});
  say("  the page stays inside the panel", fits);
  await p.click("#panelBack"); await onPage(p,"root");
  say("  and back works there", (await state(p)).key==="root");
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  // ---------- a deep link lands on the page itself ----------
  // the mode count comes off the data, so adding a way in is not a test failure
  const MODECOUNT=await p.evaluate(()=>MODES.length);
  for(const [hash,key,rows] of [["#install","install",0],["#about","about",0],["#modes","modes",MODECOUNT]]){
    const dl=await fresh(b,M,hash);
    const d=await state(dl);
    say(hash+" lands on its own page", d.key===key);
    say("  with a way back to Explore ("+d.backLbl+")", d.back && d.backLbl==="Explore");
    if(rows) say("  carrying all "+rows,
      (await dl.$$eval('.ppage:not([hidden]) .listrow',e=>e.length))===rows);
    await dl.close();
  }

  await b.close();
})();
