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
const {settle,until,shown,arm,raise}=require("./_wait");
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
  if(vp===M){ await raise(p); await glided(p); await settle(p); }
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
  const rows=await p.$$eval(".sect-onmap .listgrp .listrow .lrlbl",e=>e.map(x=>x.textContent));
  say("two ways in: "+rows.join(" / "),
    rows.join("/")==="Most influential/Surprise me");
  // About moved into a fold under the title and Install into the footer, so the two that
  // were a colophon at the foot are now in two different places and neither is a row
  const col=await p.evaluate(()=>({
    about:!!document.querySelector('.sect-about [data-page="about"]'),
    install:!!document.querySelector('.sect-appset [data-page="install"]'),
    old:document.querySelectorAll(".sect-learn").length}));
  say("About is in the fold and Install in the footer",
    col.about && col.install && col.old===0);
  say("nothing is pushed at rest", (await state(p)).pages===1);
  say("and no menu is left over from the old build", (await p.$$(".navmenu .brmenu, [data-menu='roots']")).length===0);

  await p.click('.sect-onmap [data-page="top"]'); await onPage(p,"top");
  let st=await state(p);
  say("Most influential pushes a page ("+st.title+")",
    st.key==="top" && st.title==="Most Influential");
  say("  two pages exist but only one is shown", st.pages===2 && st.shown===1);
  say("  back appears, naming where it goes ("+st.backLbl+")", st.back && st.backLbl==="Music Atlas");
  say("  and the name is actually painted",
    await p.evaluate(()=>{const l=document.querySelector("#panelBack .bklbl");
      return getComputedStyle(l).display!=="none" && l.getBoundingClientRect().width>20;}));
  say("  it starts at the top", st.scroll===0);
  // the page wears the collections grid now: art tiles with the name under them, not a
  // boxed list of coloured dots. The dot said which family and nothing else, on a page
  // whose whole subject is styles you may not know yet.
  const n=await p.$$eval('.ppage[data-p="top"] .topgrid .tcirc',e=>e.length);
  say("  listing "+n+" styles", n===24);
  say("  each one carrying its art",
    await p.$$eval('.ppage[data-p="top"] .tcirc .tco',
      e=>e.length===24 && e.every(x=>!!x.querySelector("img, .pcovph"))));

  // pushing the same page twice would stack it on itself
  await p.evaluate(()=>{const r=document.querySelector('.sect-onmap [data-page="top"]'); if(r) r.click();});
  // nothing should come of that tap, so the wait is for the page to stop changing rather
  // than for an arrival that must not happen
  await settle(p);
  say("  and the row under it cannot be tapped again", (await state(p)).pages===2);

  await p.click("#panelBack"); await onPage(p,"root");
  st=await state(p);
  say("back pops it", st.pages===1 && st.key==="root" && st.title==="Music Atlas");
  say("  and takes the back button with it", st.back===false);

  // Escape unwinds before it closes the panel
  await p.click('.sect-onmap [data-page="top"]'); await onPage(p,"top");
  // the count is a badge on the disc now, the way an unread count sits on an app icon.
  // It has to clear the art's own clip, or it is a number with its top sliced off.
  const badge=await p.evaluate(()=>{
    const t=[...document.querySelectorAll('.ppage[data-p="top"] .tcirc')];
    const r=x=>x.getBoundingClientRect();
    return {n:t.length,
      numbers:t.every(x=>/^\d+$/.test((x.querySelector(".tcct")||{}).textContent||"")),
      round:t.every(x=>getComputedStyle(x.querySelector(".tco")).borderRadius==="50%"),
      // top right of the art, overlapping it rather than sitting inside or beside it
      placed:t.every(x=>{const a=r(x.querySelector(".tco")), b=r(x.querySelector(".tcct"));
        return b.top<a.top && b.right>a.right && b.left>a.left+a.width/2;}),
      // nothing clipping it: the disc crops its picture, the wrapper must not crop this
      unclipped:t.every(x=>getComputedStyle(x.querySelector(".tart")).overflow==="visible"),
      legible:t.every(x=>{const b=r(x.querySelector(".tcct"));
        return b.width>=20 && b.height>=20;})};});
  say("  with a count badge on every one", badge.n===24 && badge.numbers);
  say("    on a round tile, at its top right", badge.round && badge.placed);
  say("    clear of the art's own clip, at a size you can read",
    badge.unclipped && badge.legible);
  // the sleeves carry a worn paper edge, lighter than the art inside them, which a round
  // crop turns into a bright rim. The art is scaled past it rather than cropped at it.
  // wait for the tiles' images to exist: on a loaded runner this read the page before
  // they had been placed and failed once in a few dozen runs, with nothing wrong
  await until(p,()=>document.querySelectorAll('.ppage[data-p="top"] .tco img').length>=12);
  say("    with the art scaled past the sleeve's own edge",
    await p.$$eval('.ppage[data-p="top"] .tco img', e=>e.length>0 && e.every(x=>{
      const m=getComputedStyle(x).transform.match(/matrix\(([-\d.]+)/);
      return !!m && parseFloat(m[1])>=1.08;})));

  // Most influential and Collections are the same kind of page and are built the same
  // way: a lede, a Sorted by picker, a grid of art, and a link to the page itself. This
  // reads the skeleton off both rather than asserting a shape twice, so the two cannot
  // drift apart without saying so.
  const skel=async(hash)=>{
    const q=await fresh(b,M,hash);
    const v=await q.evaluate(()=>{
      const u=document.querySelector(".ppage:not([hidden])");
      // the two pages share their skeleton; the list itself differs (Collections is a list
      // of rows with a line under each name, Most influential a grid of circles), so the
      // body's shape is not part of the comparison
      return {lede:!!u.querySelector(".pglede"),
        sortedBy:((u.querySelector(".secthead.picksort .secttl")||{}).textContent||"").trim().slice(0,9),
        picker:!!u.querySelector(".sortpick select"),
        list:!!u.querySelector(".moderows, .topgrid"),
        copy:!!u.querySelector(".shbtn.wide[data-share]")};});
    await q.close(); return v; };
  const a=await skel("#top"), c=await skel("#modes");
  note("top", JSON.stringify(a)); note("modes", JSON.stringify(c));
  say("Most influential is built like Collections", JSON.stringify(a)===JSON.stringify(c)
    ? true : JSON.stringify(a)+" vs "+JSON.stringify(c));
  say("  both: a lede, a Sorted by picker, the list and a link to the page",
    a.lede && a.sortedBy==="Sorted by" && a.picker && a.list && a.copy);

  // and the sort on it actually sorts
  { const q=await fresh(b,M,"#top");
    const names=()=>q.$$eval(".topgrid .mclbl",e=>e.map(x=>x.textContent));
    const byInfl=await names();
    await q.selectOption(".tsortsel","az");
    await q.waitForFunction(()=>document.querySelector(".tsortsel").value==="az");
    await settle(q);
    const az=await names();
    say("  and its sort reorders without dropping anything ("+az[0]+" first)",
      az.length===byInfl.length
      && az.every((n,i)=>i===0||az[i-1].localeCompare(n)<=0)
      && JSON.stringify([...az].sort())===JSON.stringify([...byInfl].sort()));
    await q.close(); }
  await p.keyboard.press("Escape"); await onPage(p,"root");
  st=await state(p);
  say("Escape pops the page rather than closing the panel",
    st.pages===1 && (await p.$eval("body",e=>e.classList.contains("open")))===true);

  // picking a style leaves the stack behind
  await p.click('.sect-onmap [data-page="top"]'); await onPage(p,"top");
  await p.click('.ppage[data-p="top"] [data-go]'); await moved(p,"");
  const hash=await p.evaluate(()=>location.hash);
  say("picking from a page selects it ("+hash+")", hash.length>1);
  say("  and the style panel starts from a clean stack",
    (await p.$$(".ppage")).length<=1 && (await p.$$('.ppage[data-p="top"]')).length===0);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.close();

  // ---------- the colophon ----------
  p=await fresh(b,M);
  await p.click('.sect-appset [data-page="install"]'); await onPage(p,"install");
  st=await state(p);
  say("How to install pushes its own page ("+st.title+")", st.key==="install");
  say("  with the platform sections on it",
    (await p.$$eval('.ppage[data-p="install"] .subh',e=>e.length))>=4);
  say("  and About is not pushed with it", (await p.$$('.ppage[data-p="about"]')).length===0);
  await p.click("#panelBack"); await onPage(p,"root");
  await p.click('.sect-about [data-page="about"]'); await onPage(p,"about");
  say("About pushes its own", (await state(p)).key==="about");
  say("  carrying the app icon and the stats line",
    (await p.$$('.ppage[data-p="about"] .abouthd .appicon')).length===1
    && (await p.$$('.ppage[data-p="about"] .stats')).length===1);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.close();

  // ---------- desktop ----------
  p=await fresh(b,Dk);
  await p.click('.sect-onmap [data-page="top"]'); await onPage(p,"top");
  st=await state(p);
  say("the sidebar pushes pages the same way", st.key==="top" && st.shown===1);
  say("  and the back button is there too", st.back && st.backLbl==="Music Atlas");
  const fits=await p.evaluate(()=>{
    const pg=document.querySelector('.ppage[data-p="top"]'), b=document.getElementById("panelBody");
    return Math.round(pg.getBoundingClientRect().width)<=Math.round(b.getBoundingClientRect().width);});
  say("  the page stays inside the panel", fits);
  await p.click("#panelBack"); await onPage(p,"root");
  say("  and back works there", (await state(p)).key==="root");
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  // ---------- a deep link lands on the page itself ----------
  // the mode count comes off the data, so adding a way in is not a test failure
  const MODECOUNT=await p.evaluate(()=>MODES.length);
  // #roots and #top are in this list because the panel no longer carries a row to either:
  // the map took that job back, and the address is the only way left in.
  for(const [hash,key,rows] of [["#install","install",0],["#about","about",0],
      ["#modes","modes",MODECOUNT],["#roots","roots",17],["#top","top",24]]){
    const dl=await fresh(b,M,hash);
    const d=await state(dl);
    say(hash+" lands on its own page", d.key===key);
    say("  with a way back to the map ("+d.backLbl+")", d.back && d.backLbl==="Music Atlas");
    // the collections page is a grid of circles rather than a list of rows, so count
    // whichever of the two that page is made of
    if(rows) say("  carrying all "+rows,
      (await dl.$$eval('.ppage:not([hidden]) .listrow, .ppage:not([hidden]) .moderows .moderow,'
        +' .ppage:not([hidden]) .topgrid .tcirc', e=>e.length))===rows);
    await dl.close();
  }

  await b.close();
})();
