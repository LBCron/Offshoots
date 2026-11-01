// Search returns three kinds of thing, and the point of the file is that they stay in
// one ranked list rather than three stacked buckets.
//
// A STYLE is the map's own content and wins on any decent match. A SOURCE is a Go deeper
// row: several hundred books, articles and films that, until they were indexed here,
// could only be reached by already knowing which style they sat on. A PAGE is a place,
// so that "podcasts" goes to Audio and "Pete" goes to his picks.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,arm}=require("./_wait");
const D=require("../src/data.js");
const URL="file://"+__dirname+"/../index.html";
const M={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
const drawn=q=>until(q,()=>!!document.querySelector("#chart .n"));
const ready=async q=>{ await arm(q); await drawn(q); await settle(q); };
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };

// type, then wait for the list to say something about this query rather than for a clock
async function ask(p,t){
  await p.$eval("#q",(e,v)=>{ e.value=v; e.dispatchEvent(new Event("input",{bubbles:true})); },t);
  await until(p,()=>{const r=document.getElementById("res");
    return !!r && (r.hidden || r.querySelectorAll("button").length>0);});
  await settle(p);
  return p.evaluate(()=>[...document.querySelectorAll("#res button")].map(x=>{
    const ico=x.querySelector(".rico");
    return {kind:x.className.split(" ").find(c=>/^res-/.test(c)),
      name:(x.querySelector(".rnm")||{}).textContent||"",
      line:(x.querySelector("small")||{}).textContent||"",
      mark:!!ico, dot:!!(ico&&ico.classList.contains("rdot")),
      glyph:!!(ico&&ico.querySelector("svg")),
      ext:!!x.querySelector(".rext svg"),
      lbl:x.getAttribute("aria-label")||"",
      go:x.dataset.go||x.dataset.pageGo||x.dataset.src||""};}));
}

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  const errs=[];
  const p=await b.newPage({viewport:M});
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL); await ready(p);
  await p.$eval("#mapSearch",e=>e.click()); await settle(p);

  say("the field says what it searches",
    /sources/i.test(await p.$eval("#q",e=>e.placeholder)));

  // --- a style still wins its own name
  const bb=await ask(p,"bebop");
  say("a style still comes first for its own name ("+(bb[0]||{}).name+")",
    bb[0] && bb[0].kind==="res-style" && /Bebop/i.test(bb[0].name));
  say("  with its sources under it",
    bb.slice(1).some(h=>h.kind==="res-src"));

  // --- a source by title, which was unreachable before
  const ob=await ask(p,"our band could");
  say("a source is findable by title ("+(ob[0]||{}).name+")",
    ob[0] && ob[0].kind==="res-src" && /Our Band/.test(ob[0].name));
  // the line has to say where it lives, or the result is a dead end: tapping it leaves
  // the app, so this is the only chance to say which style it belongs to
  say("  its line naming what it is, who made it and where it lives ("+(ob[0]||{}).line+")",
    /History/.test(ob[0].line) && /Azerrad/.test(ob[0].line) && /more|Pop|Rock|Punk/.test(ob[0].line));
  say("  and pointing at the source itself, not a style",
    ob[0].go.startsWith("http"));

  // --- a source by author
  const au=await ask(p,"heat-moon");
  say("findable by author too ("+(au[0]||{}).name+")",
    au[0] && au[0].kind==="res-src" && /Blue Highways/.test(au[0].name));

  // --- the pages
  const pod=await ask(p,"podcast");
  // nothing in the data is labelled "podcast"; the word has to reach the Audio page by
  // its description, or someone looking for one finds nothing at all
  say("a word nobody tagged still finds its page ("+(pod[0]||{}).name+")",
    pod[0] && pod[0].kind==="res-page" && pod[0].name==="Audio");
  const pt=await ask(p,"pete");
  say("the guest is findable by name ("+(pt[0]||{}).name+")",
    pt[0] && pt[0].kind==="res-page" && /Pete/.test(pt[0].name));
  say("  above the styles with a Pete in them, of which there are several",
    pt.filter(h=>h.kind==="res-style").length>0 &&
    pt.findIndex(h=>h.kind==="res-page")<pt.findIndex(h=>h.kind==="res-style"));

  // --- every medium page is reachable by its own name
  const names=["Articles","Books","Audio","Videos","Pictures"];
  const found=[];
  for(const n of names){ const r=await ask(p,n.toLowerCase());
    if(r[0] && r[0].kind==="res-page" && r[0].name===n) found.push(n); }
  say("every medium page answers to its own name ("+found.length+" of "+names.length+")",
    found.length===names.length);

  // --- opening a page result
  await ask(p,"pete");
  await p.click("#res button"); await onPage(p,"picks");
  say("a page result opens that page", true);
  say("  and the field is cleared behind it",
    (await p.$eval("#q",e=>e.value))==="");

  // --- a source result opens the source, and leaves the map alone
  await p.$eval("#mapSearch",e=>e.click()).catch(()=>{});
  await settle(p);
  const before=await p.evaluate(()=>location.hash);
  const bh=await ask(p,"blue highways");
  // the request, not the result: these hosts are unreachable from a test browser, and
  // waiting for the load would check Chrome's error page instead of where we sent it
  let asked="";
  p.context().once("request",r=>{ if(!asked && r.url()===bh[0].go) asked=r.url(); });
  const [pop]=await Promise.all([
    p.context().waitForEvent("page"),
    p.click("#res button")]);
  if(!asked) asked=pop.url();
  say("a source result opens the source in a new tab", asked===bh[0].go);
  await pop.close();
  say("  leaving the map where it was", (await p.evaluate(()=>location.hash))===before);

  // --- the list stays a list: eight at most, whatever matches
  const many=await ask(p,"the");
  say("never more than eight results ("+many.length+")", many.length<=8);

  // --- nothing matches, nothing shows
  await ask(p,"zzzzqqqq");
  say("no match, no list", await p.$eval("#res",e=>e.hidden));

  // --- the playlists' own artists, lifted from the published track list. Before they
  // were indexed, a name could be sitting in a playlist the map links to and still find
  // nothing: the map knew the style, the playlist knew the artist, and the two did not
  // meet. So the test is that a name NOT written into any note or key-artist list still
  // reaches the style whose playlist contains it.
  const deep=[["Elizabeth Cotten","Folk Revival"],["Dave Van Ronk","Folk Revival"],
    ["Gillian Welch","Bluegrass"]];
  for(const [who,style] of deep){
    const r=await ask(p,who.toLowerCase());
    const hit=r.find(h=>h.kind==="res-style" && h.name===style);
    say("\""+who+"\" reaches "+style, !!hit);
    // and the row says WHY it is there, or a search result is a riddle
    if(hit) say("  naming the artist that matched", new RegExp(who.split(" ")[0]).test(hit.line));
  }
  // a roster this big must not drown the name match: a style called X still wins "X"
  const bg=await ask(p,"bluegrass");
  say("a style name still beats its own roster", bg[0].kind==="res-style" && /Bluegrass/.test(bg[0].name));

  // --- the marks. Every result carries one, and which one says what kind it is without
  // a word: a style wears its family colour, a page and a source wear the glyph they
  // already wear where they live.
  const mix=await ask(p,"bebop");
  say("every result carries a mark", mix.every(h=>h.mark));
  say("  a style's is its family colour, not a glyph",
    mix.filter(h=>h.kind==="res-style").every(h=>h.dot && !h.glyph));
  say("  a source's is its medium's glyph",
    mix.filter(h=>h.kind==="res-src").every(h=>h.glyph && !h.dot));
  const pp=await ask(p,"videos");
  say("  a page's too", pp[0].kind==="res-page" && pp[0].glyph && !pp[0].dot);

  // --- leaving the app is said twice: an arrow, and a label naming the host, because an
  // arrow on its own does not say where it is about to send you
  const ex=await ask(p,"blue highways");
  say("a source is marked as leaving the app", ex[0].ext===true);
  say("  and says where to ("+ex[0].lbl+")", /harvard\.com/.test(ex[0].lbl) && /new tab/.test(ex[0].lbl));
  say("  while what stays in the app is not",
    mix.filter(h=>h.kind!=="res-src").every(h=>h.ext===false) &&
    pp.filter(h=>h.kind==="res-page").every(h=>h.ext===false));

  // --- the name is what you typed, so it must not be the thing that gets cut
  const wide=await ask(p,"pete");
  say("the name is never truncated before the line",
    await p.evaluate(()=>[...document.querySelectorAll("#res .rnm")]
      .every(x=>x.scrollWidth<=x.clientWidth+1)));

  // ---------- a word start beats a hit inside a word ----------
  // Everything is matched with a bare indexOf, which has no idea where words begin, so
  // "andy" hits Mandy Patinkin, Randy Stonehill, Brandy, Sandy Nelson, Randy Travis and
  // Randy Newman. Six accidents scored exactly as high as a real one and filled all eight
  // rows, which is how the Andy Shauf playlist fell off a search for "andy" and only came
  // back once you had typed "andy s".
  { const r=await ask(p,"andy");
    const names=r.map(x=>x.name);
    const mid=["Broadway Show Tunes","Instrumental Rock","Neotraditional Country"];
    const real=names.filter(n=>mid.indexOf(n)<0);
    say('"andy" leads with real Andys, not Mandy and Randy ('+real.slice(0,3).join(", ")+")",
      real.length>0 && mid.every(m=>{
        const i=names.indexOf(m); return i<0 || i>names.indexOf(real[0]); }));
    say("  and the playlist whose subject is one of them is in the list",
      names.some(n=>/Someone Else/.test(n)));
    // the accidents still rank, they just rank under: dropping them would be worse, since
    // a half-typed name is exactly how you find someone whose spelling you are unsure of
    const r2=await ask(p,"randy");
    say("  while searching the longer word still finds it ("+(r2[0]||{}).name+")",
      r2.length>0); }

  say("no page errors", errs.length===0 ? true : errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await b.close();
})();
