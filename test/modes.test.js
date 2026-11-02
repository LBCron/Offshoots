// Browse by mood, place or task.
//
// Twenty-five ways in used to be twenty-five chips, tapped to unroll a list underneath
// them, which meant a tap always moved the thing you had just tapped off the top of the
// screen. They are a two-column list now, and a tap pushes a page: same picks, but they
// arrive where your eye already is, with a back button instead of a scroll.
//
// What this holds onto: one row per mode, loudest first, each rated and coloured by how
// loud it is, two abreast without clipping a label, and a tap that pushes a page of
// twelve picks you can select from.
const {chromium}=require("playwright");
const DATA=require(require("path").join(__dirname,"..","src","data.js"));
const MODESIZE=k=>{ const m=DATA.MODES.find(x=>x[0]===k); return m?m[4].length:-1; };
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
// one name for "the page is loaded, the map is drawn and nothing is moving". The circles
// are laid out against the map, so a loaded document is not enough.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing
// is mutating. Open means the class is on, the glide has cleaned up, and the page is quiet.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q); };
// A push leaves the page it came from visible until it is hidden 240ms later, so the
// arrival is "the first page still showing is this one" rather than "this one exists".
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };
// a deep link opens the sheet and pushes its page 420ms into boot, so the page being
// there is not enough: the sheet has to be up under it
const landed=async(q,k)=>{ await until(q,k=>{
    const d=document.querySelector('.ppage[data-p="'+k+'"]');
    return !!d && !d.hidden && document.body.classList.contains("open");},k); await settle(q); };
const fresh=async(b,vp)=>{ const p=await b.newPage({viewport:vp}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e))); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
  await p.goto(URL); await ready(p);
  if(vp===M){ await p.click("#grab").catch(()=>{}); await opened(p); }
  p._errs=errs; return p; };
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

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);

  // ---------- the Places row ----------
  // The overview opens on a row of circles you swipe sideways, the way Apple Maps opens
  // on its Places. The full set is a tap away behind the heading, so what matters here
  // is that the row is scrollable, that the first few are reachable without it, and that
  // the heading really does open the rest.
  let p=await fresh(b,M);
  const nModes=await p.evaluate(()=>typeof MODES!=="undefined"?MODES.length:-1);
  const rows=await p.$$(".mcirc");
  say("one circle per mode ("+nModes+")", nModes>0 && rows.length===nModes);
  say("and no chips or rows left over", (await p.$$(".modechip")).length===0
    && (await p.$$(".sect-modes .listrow")).length===0);
  say("no picks before a tap", (await p.$$(".picks .pick")).length===0);
  say("every circle carries an icon and a label", await p.$$eval(".mcirc",
    e=>e.every(x=>x.querySelector(".mco svg") && x.querySelector(".mclbl").textContent.trim().length>0)));

  const lay=await p.evaluate(()=>{
    const r=[...document.querySelectorAll(".mcirc")], row=document.querySelector(".mrow");
    const rb=row.getBoundingClientRect();
    const vis=r.filter(x=>{const b=x.getBoundingClientRect(); return b.left>=rb.left-1 && b.right<=rb.right+1;});
    const c=r[0].querySelector(".mco").getBoundingClientRect();
    return {scrolls:row.scrollWidth>row.clientWidth+1, vis:vis.length,
      round:Math.abs(c.width-c.height)<=1 && c.width>=52,
      // a circle again, so round and unleant
      round:Math.abs(c.width-c.height)<=2 && c.height>=52
        && getComputedStyle(r[0].querySelector(".mco")).borderRadius==="50%",
      tilts:r.filter(x=>x.style.getPropertyValue("--tilt")).length,
      dims:Math.round(c.width)+"x"+Math.round(c.height),
      clipped:r.filter(x=>{const l=x.querySelector(".mclbl"); return l.scrollHeight>l.clientHeight+1;})
               .map(x=>x.querySelector(".mclbl").textContent),
      tap:Math.min(...r.map(x=>Math.round(x.getBoundingClientRect().height)))};});
  say("the row scrolls sideways", lay.scrolls);
  // on a filled circle an outline reads as a wire drawing, so every glyph is a solid
  // shape: filled, no stroke, and big enough in the circle to carry at a glance
  const gl=await p.evaluate(()=>{
    const g=[...document.querySelectorAll(".mcirc .mco svg")];
    return {n:g.length,
      filled:g.every(x=>{const cs=getComputedStyle(x);
        return cs.fill!=="none" && (cs.stroke==="none"||parseFloat(cs.strokeWidth||0)===0);}),
      paths:g.every(x=>x.querySelectorAll("path,rect,circle").length>0),
      share:Math.round(100*g[0].getBoundingClientRect().width
        /g[0].closest(".mco").getBoundingClientRect().width)};});
  say("  every glyph is solid, not stroked", gl.n>0 && gl.filled && gl.paths);
  // Phosphor is MIT, which wants its notice carried with the work. The map is one file
  // that anyone can save, so the notice lives on the About page inside it.
  say("  and the set it came from is credited", await (async()=>{
    await p.$eval(".ovfold summary",e=>{ if(!e.parentElement.open) e.click(); });
    await settle(p);
    await p.click('.ovfold [data-page="about"]'); await onPage(p,"about");
    const t=await p.evaluate(()=>(document.querySelector(".ppage:not([hidden])")||{}).textContent||"");
    const ok=/Phosphor/.test(t) && /MIT/.test(t);
    await p.click("#panelBack"); await onPage(p,"root");
    return ok;})());
  // no glyph may be worn by two modes: a shared icon makes two rows look like one
  say("  no two modes wear the same glyph", await p.evaluate(()=>{
    const seen=new Set();
    for(const x of document.querySelectorAll(".mcirc .mco svg")){
      const k=x.innerHTML.replace(/\s+/g," ").trim();
      if(seen.has(k)) return false; seen.add(k);
    } return seen.size===MODES.length;}));
  say("  filling "+gl.share+"% of its circle", gl.share>=45 && gl.share<=60);
  // a mouse has no momentum of its own, so the row carries a flick after the button is up
  const fling=await p.evaluate(async()=>{
    const row=document.querySelector(".mrow"); row.scrollLeft=0;
    const at=()=>Math.round(row.scrollLeft);
    const ev=(t,x)=>row.dispatchEvent(new PointerEvent(t,{pointerId:7,pointerType:"mouse",
      button:0,buttons:t==="pointerup"?0:1,clientX:x,clientY:
      Math.round(row.getBoundingClientRect().top+20),bubbles:true,cancelable:true}));
    ev("pointerdown",300);
    // the 16ms between moves is the gesture, not a wait on the page: the velocity the row
    // carries past the release is read off how fast the pointer was travelling
    for(let i=1;i<=8;i++){ ev("pointermove",300-i*22); await new Promise(r=>setTimeout(r,16)); }
    const held=at(); ev("pointerup",300-8*22);
    // the coast is over when the row stops moving, which is what the check measures
    let last=at(), still=0;
    while(still<120){ await new Promise(r=>requestAnimationFrame(r));
      const now=at(); if(now===last) still+=16; else { still=0; last=now; } }
    return {held, after:at()};});
  say("  and carries "+(fling.after-fling.held)+"px past the release", fling.after-fling.held>=30);
  await p.evaluate(()=>{document.querySelector(".mrow").scrollLeft=0;});
  await settle(p);
  say("  with "+lay.vis+" in reach before it does", lay.vis>=3);
  // A circle again, and now with a picture in it. The case and the sleeve were both
  // standing in for art that did not exist; there is one per collection now, and a
  // picture wants the plainest frame there is.
  say("  each a circle of "+lay.dims+", in a "+Math.round(lay.tap)+"px target",
    lay.round && lay.tap>=44);
  // the lean went with the sleeve: a circle has no up, so there is nothing to lean
  say("  and none of them leaning", lay.tilts===0);

  // every collection carries its own picture, with the glyph still underneath it
  const moodart=await p.evaluate(()=>[...document.querySelectorAll(".mcirc")].map(x=>{
    const i=x.querySelector(".mco img"), g=x.querySelector(".mco .facefb svg");
    return {mode:x.dataset.mode, src:i?i.getAttribute("src"):"",
      torn:!!i && i.complete && i.naturalWidth===0,
      drawn:!!i && i.complete && i.naturalWidth>0, glyph:!!g};}));
  const noArt=moodart.filter(a=>!a.src).map(a=>a.mode);
  say("every collection has a picture of its own ("+moodart.length+")",
    noArt.length===0 ? true : noArt.join(", "));
  say("  named for the collection it belongs to",
    moodart.every(a=>a.src==="moods/"+a.mode+".jpg"));
  const torn=moodart.filter(a=>a.torn).map(a=>a.mode);
  say("  none of them torn", torn.length===0 ? true : torn.join(", "));
  say("  with the glyph still under it, for one that will not load",
    moodart.every(a=>a.glyph));
  { const fs=require("fs"), path=require("path");
    const dir=path.join(__dirname,"..","moods");
    const missing=moodart.filter(a=>!fs.existsSync(path.join(dir,a.mode+".jpg"))).map(a=>a.mode);
    say("  and every file is on disk",
      missing.length===0 ? true : missing.join(", "));
    const extra=fs.readdirSync(dir).filter(f=>/\.jpg$/.test(f))
      .filter(f=>!moodart.some(a=>a.mode+".jpg"===f));
    say("  with none left over", extra.length===0 ? true : extra.join(", ")); }

  say("  and no label cut off"+(lay.clipped.length?": "+lay.clipped.join(", "):""), lay.clipped.length===0);

  // the heading is the control that opens the rest, chevron and all, and it has to be
  // big enough to hit: as a plain <h3> turned button it came out 25px tall
  const sh=await p.evaluate(()=>{const h=document.querySelector(".sect-modes .secthead");
    return {go:h.tagName==="BUTTON" && h.dataset.page==="modes",
      cv:!!h.querySelector(".sectcv svg"), h:Math.round(h.getBoundingClientRect().height)};});
  say("the heading opens the full set", sh.go && sh.cv);
  say("  and is "+sh.h+"px tall", sh.h>=44);
  await p.click(".sect-modes .secthead"); await onPage(p,"modes");
  const all=await p.evaluate(()=>{
    const r=[...document.querySelectorAll(".ppage:not([hidden]) .modelist .listrow")];
    const grp=document.querySelector(".ppage:not([hidden]) .modelist");
    return {n:r.length, cols:new Set(r.map(x=>Math.round(x.getBoundingClientRect().left))).size,
      clipped:r.filter(x=>{const l=x.querySelector(".lrlbl"); return l.scrollWidth>l.clientWidth+1;})
               .map(x=>x.querySelector(".lrlbl").textContent),
      over:grp?r.some(x=>x.getBoundingClientRect().right>grp.getBoundingClientRect().right+1):true,
      h:r.length?Math.round(r[0].getBoundingClientRect().height):0};});
  say("listing all "+all.n+" two abreast", all.n===nModes && all.cols===2);
  say("  nothing clipped at 390"+(all.clipped.length?": "+all.clipped.join(", "):""), all.clipped.length===0);
  say("  nor spilling out of the group", all.over===false);
  say("  each row "+all.h+"px, still a tap target", all.h>=44);
  // the gutter rule was drawn by each odd row, inset top and bottom, which left a gap at
  // every row boundary and read as a dashed line. One line down the whole grid now.
  const rule=await p.evaluate(()=>{
    const g=document.querySelector(".ppage:not([hidden]) .modelist.two");
    const af=getComputedStyle(g,"::after"), gb=g.getBoundingClientRect();
    const gaps=[...g.querySelectorAll(".listrow:nth-child(odd)")]
      .filter(r=>getComputedStyle(r,"::after").content!=="none").length;
    return {on:af.content!=="none", h:Math.round(parseFloat(af.height)||0),
      grid:Math.round(gb.height), perRow:gaps,
      // every row's own rule spans its whole column rather than stopping short
      short:[...g.querySelectorAll(".listrow")].filter(r=>{
        const bf=getComputedStyle(r,"::before");
        return bf.content!=="none" && parseFloat(bf.left)>1;}).length};});
  say("  one unbroken gutter rule, "+rule.h+"px of "+rule.grid,
    rule.on && rule.h===rule.grid && rule.perRow===0);
  say("  and each row's rule spans its column", rule.short===0);
  // the left column once started flush at the card edge, from when this list sat unboxed
  // on the Explore panel. In a card both columns take the same inset from their own edge
  const inset=await p.evaluate(()=>{
    const g=document.querySelector(".ppage:not([hidden]) .modelist.two");
    const r=[...g.querySelectorAll(".listrow")], gb=g.getBoundingClientRect();
    const mid=gb.left+gb.width/2;
    return {l:Math.round(r[0].querySelector(".lrico").getBoundingClientRect().left-gb.left),
      r:Math.round(r[1].querySelector(".lrico").getBoundingClientRect().left-mid)};});
  say("  both columns inset the same ("+inset.l+" / "+inset.r+")",
    inset.l===inset.r && inset.l>=10);
  // the page has a link of its own, the way About and How to install do
  const share=await p.evaluate(()=>{const c=document.querySelector(".ppage:not([hidden]) .pagecopy");
    return c?{hash:c.dataset.aboutcopy, lbl:(c.querySelector(".lbl")||{}).textContent}:null;});
  say("  with a link to copy ("+(share&&share.lbl)+")",
    !!share && share.hash==="modes" && /copy a link/i.test(share.lbl));
  await p.click("#panelBack"); await onPage(p,"root");

  // ---------- how loud it is ----------
  // every mode carries a level, and the circle is filled with it. The ramp has to read
  // in order, so the five levels are five distinct fills running cool to hot, and the
  // white glyph has to hold up on every one of them.
  const lv=await p.evaluate(()=>[...document.querySelectorAll(".mcirc")].map(c=>{
    const m=(c.className.match(/\blv([1-5])\b/)||[])[1];
    const cs=getComputedStyle(c);
    return {name:c.querySelector(".mclbl").textContent, lv:m,
      fill:cs.getPropertyValue("--lvc").trim(),
      glyph:getComputedStyle(c.querySelector(".mco")).color,
      lbl:getComputedStyle(c.querySelector(".mclbl")).color};}));
  say("every circle is rated 1 to 5", lv.length>0 && lv.every(c=>/^[1-5]$/.test(c.lv)));
  // quietest first, which is where most listening starts. A browser with a tally in it
  // puts the modes you open at the front instead, so this is the order a fresh one gets.
  const order=lv.map(c=>+c.lv);
  say("they run quietest first ["+order.join("")+"]", order.every((v,i)=>i===0||v>=order[i-1]));
  say("the first is a 1 and the last a 5", order[0]===1 && order[order.length-1]===5);
  // and then it learns. Opening a mode is tallied in this browser alone, and the ones
  // you open float to the front of the row the next time the overview is built, so what
  // you actually use is in reach without a swipe. The full list behind the heading does
  // not move, which is what keeps one stable place to find anything.
  const before=await p.$$eval(".mcirc .mclbl",e=>e.map(x=>x.textContent));
  // The tally is seeded into a fresh page rather than written and reloaded. Chromium's
  // localStorage under file:// does not reliably survive a reload, so write-then-reload
  // turned a real behaviour into a coin toss; an init script runs before the page's own
  // scripts on every navigation, so the row always sees the tally it is being tested on.
  const seeded=async use=>{
    const q=await b.newPage({viewport:M});
    await q.addInitScript(u=>{ try{ u ? localStorage.setItem("offshoots.modeuse",JSON.stringify(u))
      : localStorage.removeItem("offshoots.modeuse"); }catch(e){} }, use);
    await q.goto(URL); await ready(q);
    await q.click("#grab").catch(()=>{});
    await q.waitForSelector(".mcirc",{state:"attached",timeout:8000}).catch(()=>{});
    await opened(q);
    return q; };

  { const q=await seeded({road:5,party:2});
    const after=await q.$$eval(".mcirc .mclbl",e=>e.map(x=>x.textContent));
    say("a tally puts the most-opened first ("+after.slice(0,2).join(", ")+")",
      after[0]==="Road trip" && after[1]==="Party");
    say("  without losing any of the "+after.length,
      after.length===nModes && new Set(after).size===nModes);
    say("  and the rest keep their order",
      after.slice(2).join("/")===before.filter(x=>x!=="Road trip"&&x!=="Party").join("/"));
    // the list behind the heading is the stable reference, so it must not reorder
    await q.click(".sect-modes .secthead"); await onPage(q,"modes");
    const page=await q.$$eval(".ppage:not([hidden]) .modelist .lrlbl",e=>e.map(x=>x.textContent));
    say("  while the full list stays put ("+page.slice(0,2).join(", ")+")",
      page.join("/")===before.join("/"));
    await q.close(); }

  { const q=await seeded(null);
    say("  and clearing the tally puts it back",
      (await q.$$eval(".mcirc .mclbl",e=>e.map(x=>x.textContent))).join("/")===before.join("/"));
    await q.close(); }

  // ---------- a tap pushes a page ----------
  await p.click('[data-mode="focus"]'); await onPage(p,"mode:focus");
  const pg=await p.evaluate(()=>{
    const up=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden);
    const bk=document.getElementById("panelBack");
    return {pages:document.querySelectorAll(".ppage").length, shown:up.length,
      key:up.length?up[0].dataset.p:null,
      title:up.length?up[0].querySelector(".bigttl .mn").textContent:null,
      icon:up.length?!!up[0].querySelector(".bigttl .pgi svg"):false,
      lede:up.length?(up[0].querySelector(".pglede")||{}).textContent:null,
      lvc:up.length?(up[0].className.match(/\blv([1-5])\b/)||[])[1]:null,
      picks:document.querySelectorAll(".ppage:not([hidden]) .picks [data-go]").length,
      back:!bk.hidden, backLbl:(bk.querySelector(".bklbl")||{}).textContent,
      top:document.getElementById("panelBody").scrollTop};});
  say("Focus pushes a page ("+pg.title+")", pg.key==="mode:focus" && pg.title && pg.title.length>0);
  say("  one page shown of "+pg.pages, pg.shown===1);
  say("  with its own icon and its why-text", pg.icon && pg.lede && pg.lede.length>20);
  // the mark on the page is the circle you tapped, arrived at: a filled circle in the
  // same colour, the size of the cover art in the list underneath it
  const mark=await p.evaluate(()=>{
    const i=document.querySelector(".ppage:not([hidden]) .pgi");
    const art=document.querySelector(".ppage:not([hidden]) .pick img.pcov,.ppage:not([hidden]) .pick .pcovph");
    if(!i) return null;
    const q=i.getBoundingClientRect(), cs=getComputedStyle(i);
    return {w:Math.round(q.width), round:/50%|9999px/.test(cs.borderRadius)
        && Math.abs(q.width-q.height)<=1,
      filled:!/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor) || /gradient/.test(cs.backgroundImage),
      art:art?Math.round(art.getBoundingClientRect().width):0};});
  say("  a circle of "+(mark&&mark.w)+"px, filled", !!mark && mark.round && mark.filled);
  say("  the size of the cover art below it ("+(mark&&mark.art)+")",
    !!mark && mark.art>0 && Math.abs(mark.w-mark.art)<=2);
  say("  coloured by how loud it is (lv"+pg.lvc+")", /^[1-5]$/.test(pg.lvc||""));
  // the whole collection, whatever size it is: these ran to twelve when twelve was all
  // there was, and a count written into the test is a count that stops being true
  say("  listing "+pg.picks+" picks", pg.picks===MODESIZE(String(pg.key||"").replace("mode:","")));
  say("  starting at the top", pg.top===0);
  say("  and a way back ("+pg.backLbl+")", pg.back && pg.backLbl==="Offshoots");
  // every pick carries its playlist's cover, or, where there is no file, the same square
  // filled with the family colour and the style's initials. Never a gap: the three lines
  // of text are laid out against that column.
  // the covers are files, and the squares they go in are measured, so wait for every pick
  // to have either a loaded cover or the tile that stands in for one
  await until(p,()=>{const r=[...document.querySelectorAll(".ppage:not([hidden]) .pick")];
    return r.length>0 && r.every(x=>{const c=x.querySelector("img.pcov,.pcovph");
      return !!c && (c.tagName!=="IMG" || c.complete);});});
  await settle(p);
  const art=await p.evaluate(()=>{const r=[...document.querySelectorAll(".ppage:not([hidden]) .pick")];
    return {n:r.length, img:r.filter(x=>x.querySelector("img.pcov")).length,
      ph:r.filter(x=>x.querySelector(".pcovph")).length,
      sq:r.every(x=>{const c=x.querySelector("img.pcov,.pcovph"); if(!c) return false;
        const b=c.getBoundingClientRect();
        return b.width>=40 && Math.abs(b.width-b.height)<=1;}),
      inked:r.filter(x=>x.querySelector(".pcovph")).every(x=>{
        const t=x.querySelector(".pcovph b");
        return t && /^[A-Z0-9]{1,2}$/.test(t.textContent.trim());})};});
  say("  all "+art.n+" carry a square ("+art.img+" covers, "+art.ph+" tiles)", art.n>0 && art.sq);
  say("  and a tile says which style it stands for", art.inked);
  // A row prints the style's name an inch to the right of its picture, so the picture
  // uses the copy of the artwork with the lettering taken off. The titled version is
  // the playlist's own cover and stays on the playlist row, where it is the playlist.
  // Not every style has art at all, and one with none falls through art/ to the family
  // tile, which is the design. What must not happen is a row showing the TITLED artwork
  // when the untitled copy of that same picture exists: that is the one printing the
  // name twice, an inch apart.
  const from=await p.evaluate(()=>{
    const r=[...document.querySelectorAll(".ppage:not([hidden]) .pick")];
    // a top-level const is in script scope, not on window
    const S=(typeof STYLEART!=="undefined") ? STYLEART : null;
    if(!S) return {n:-1};
    const out={n:0, bare:0, wrong:[], noart:0};
    for(const x of r){
      const i=x.querySelector("img.pcov"); if(!i) continue;
      const s=i.getAttribute("src")||"", id=x.dataset.go||"";
      out.n++;
      if(s.indexOf("styles/")===0){ out.bare++; continue; }
      if(S[id]) out.wrong.push(id+" -> "+s); else out.noart++;
    }
    return out;});
  say("  drawn from the untitled art ("+from.bare+" of "+from.n
      +(from.noart?", "+from.noart+" with no art either way":"")+")",
    from.n===-1 ? "STYLEART is not reachable from the page"
      : from.wrong.length===0 ? true : from.wrong.slice(0,3).join(", "));
  // no play mark on these. The rows go to a style on the map, not to a playlist, and a
  // triangle on a row that does not play anything is a promise the row cannot keep.
  const marks=await p.evaluate(()=>{
    const r=[...document.querySelectorAll(".ppage:not([hidden]) .pick")];
    return {rows:r.length,
      glyphs:r.reduce((n,x)=>n+x.querySelectorAll(".pknm svg, .pkgo").length,0),
      labels:r.filter(x=>/playlist/i.test(x.getAttribute("aria-label")||"")
        || !!x.querySelector('[aria-label*="playlist" i]')).length};});
  say("  and no play triangle on any of the "+marks.rows,
    marks.rows>0 && marks.glyphs===0 && marks.labels===0);
  // the rows came out of their card: each one now spans the panel, and what lines up is
  // the art, with the heading above it, rather than the row's own edges
  const box=await p.evaluate(()=>{
    const r=document.querySelector(".ppage:not([hidden]) .picks [data-go]").getBoundingClientRect();
    const body=document.getElementById("panelBody").getBoundingClientRect();
    const art=document.querySelector(".ppage:not([hidden]) .pick img.pcov,.ppage:not([hidden]) .pick .pcovph").getBoundingClientRect();
    const ttl=document.querySelector(".ppage:not([hidden]) .bigttl").getBoundingClientRect();
    return {h:Math.round(r.height), bleed:Math.round(r.width)-Math.round(body.width),
      off:Math.round(art.left-ttl.left)};});
  say("a pick row is "+box.h+"px and spans the panel", box.h>=44 && Math.abs(box.bleed)<=1);
  say("  its art lining up with the title ("+box.off+"px off)", Math.abs(box.off)<=1);
  say("no row overflows itself", await p.$$eval(".ppage:not([hidden]) .picks [data-go]",
    e=>e.every(x=>x.scrollWidth<=x.clientWidth+1)));

  await p.click("#panelBack"); await onPage(p,"root");
  say("back returns to the overview",
    (await p.$$(".mcirc")).length===nModes
    && (await p.evaluate(()=>document.getElementById("panelBack").hidden))===true);

  // switching modes replaces rather than stacks
  await p.click('[data-mode="workout"]'); await onPage(p,"mode:workout");
  await p.evaluate(()=>{const r=document.querySelector('[data-mode="workout"]'); if(r) r.click();});
  // a push animates, so settling covers the one this click must not make
  await settle(p);
  say("a mode cannot be pushed onto itself",
    (await p.evaluate(()=>[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).length))===1
    && (await p.$$(".ppage")).length===2);

  // picking a style leaves the stack behind
  const target=await p.$eval(".ppage:not([hidden]) .picks [data-go]:nth-child(2)",e=>e.dataset.go);
  await p.click(".ppage:not([hidden]) .picks [data-go]:nth-child(2)");
  // the pick is through when the hash names it and the map has lit the node
  await until(p,t=>location.hash==="#"+t && !!document.querySelector("#chart .n.cur"),target);
  await settle(p);
  say("a pick selects "+target, (await p.evaluate(()=>location.hash))==="#"+target);
  say("  and the panel shows it", (await p.$eval(".pcard .pttl .ptnm",e=>e.textContent)).length>0);
  say("  with the map node lit", (await p.$$eval("#chart .n.cur",e=>e.length))===1);
  say("  from a clean stack", (await p.$$('.ppage[data-p^="mode:"]')).length===0);

  // Escape unwinds a mode page rather than closing the panel
  await p.evaluate(()=>{history.replaceState(null,"","#"); location.hash="";});
  await settle(p);
  p=await fresh(b,M);
  await p.click('[data-mode="party"]'); await onPage(p,"mode:party");
  await p.keyboard.press("Escape");
  await until(p,()=>!document.querySelector('.ppage[data-p^="mode:"]:not([hidden])'));
  await settle(p);
  say("Escape pops the page, leaving the panel open",
    (await p.$$('.ppage[data-p^="mode:"]:not([hidden])')).length===0
    && (await p.$eval("body",e=>e.classList.contains("open")))===true);
  say("no mobile page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.screenshot({path:__dirname+"/screens/m-modes.png"});
  await p.close();

  // ---------- desktop ----------
  const d=await fresh(b,Dk);
  say("the sidebar opens on circles too", (await d.$$(".mcirc")).length===nModes);
  await d.click(".sect-modes .secthead"); await onPage(d,"modes");
  const dl=await d.evaluate(()=>{
    const r=[...document.querySelectorAll(".ppage:not([hidden]) .modelist .listrow")];
    return {cols:new Set(r.map(x=>Math.round(x.getBoundingClientRect().left))).size,
      clipped:r.filter(x=>{const l=x.querySelector(".lrlbl"); return l.scrollWidth>l.clientWidth+1;})
               .map(x=>x.querySelector(".lrlbl").textContent)};});
  say("and its full set runs two abreast", dl.cols===2);
  await d.click("#panelBack"); await onPage(d,"root");
  say("and clips nothing"+(dl.clipped.length?": "+dl.clipped.join(", "):""), dl.clipped.length===0);
  await d.click('[data-mode="sit"]'); await onPage(d,"mode:sit");
  say("tapping one pushes a page of picks ("+MODESIZE("sit")+")",
    (await d.$$eval(".ppage:not([hidden]) .picks [data-go]",e=>e.length))===MODESIZE("sit"));
  say("  which stays inside the panel", await d.evaluate(()=>{
    const pg=document.querySelector(".ppage:not([hidden])"), b=document.getElementById("panelBody");
    return Math.round(pg.getBoundingClientRect().width)<=Math.round(b.getBoundingClientRect().width);}));
  await d.screenshot({path:__dirname+"/screens/d-modes.png"});
  say("no desktop page errors", d._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  // ---------- the sort on the Ways in page ----------
  // The circle row learns on its own; this list does what it is told instead. Four orders,
  // quietest the default, and the choice is remembered. What matters: all twenty-six
  // survive every sort (a sort that drops a mode is worse than no sort), the orders are
  // really different from each other, the control says which one is on, and the stored
  // choice is honoured the next time the page is built.
  //
  // Persistence is checked by seeding storage before load rather than by reloading:
  // Chromium's localStorage under file:// is unreliable across a reload, and that is the
  // harness, not the page. The click path and the load path are both covered either way.
  { const s=await b.newPage({viewport:M}); const serrs=[];
    s.on("pageerror",e=>serrs.push(String(e)));
    await s.goto(URL+"#modes"); await ready(s); await landed(s,"modes");

    const read=()=>s.evaluate(()=>{
      const ps=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden), u=ps[ps.length-1];
      return {on:[...u.querySelectorAll("[data-msort]")].filter(x=>x.getAttribute("aria-selected")==="true").map(x=>(x.getAttribute("aria-label")||"").split(".")[0]),
        labels:[...u.querySelectorAll(".moderow .lrlbl")].map(x=>x.textContent),
        stored:(()=>{try{return localStorage.getItem("offshoots.modesort")}catch(e){return null}})()};});

    const start=await read();
    say("the ways in page has a sort, defaulting to quietest",
      start.on.length===1 && start.on[0]==="Quietest");

    const seen={quiet:start.labels.join("|")};
    const total=start.labels.length;
    // the real count, not a number typed here: a mode added later must not read as a bug
    const want=await s.evaluate(()=>MODES.length);
    let kept=total===want, named=true;
    for(const [k,lbl] of [["loud","Loudest"],["used","Most used"],["az","A–Z"]]){
      // wait on the control actually flipping rather than on a stopwatch: under a loaded
      // machine a fixed pause is a coin toss, and a half-rendered list reads as a bug
      await s.click(`[data-msort="${k}"]`);
      await s.waitForFunction(key=>{
        const b=document.querySelector(`[data-msort="${key}"]`);
        return b && b.getAttribute("aria-selected")==="true";
      },k,{timeout:5000});
      const r=await read();
      seen[k]=r.labels.join("|");
      if(r.labels.length!==total) kept=false;
      if(r.on.length!==1 || r.on[0]!==lbl || r.stored!==k) named=false;
    }
    say("  all "+total+" modes survive every sort", kept && total===want);
    say("  and the control marks and stores the one that is on", named);
    say("  quietest and loudest are mirror images",
      seen.quiet===seen.loud.split("|").reverse().join("|"));
    say("  A–Z really is alphabetical", seen.az===seen.az.split("|").slice()
      .sort((x,y)=>x.localeCompare(y)).join("|"));
    // nothing has been opened in this browser, so "most used" has no tally to go on and
    // must fall back to the quiet order rather than to however MODES is declared
    say("  most used falls back to quietest when nothing has been opened", seen.used===seen.quiet);
    say("  no page errors from sorting", serrs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
    await s.close(); }

  // the stored choice is honoured when the page is built, not just when it is clicked
  { const s2=await b.newPage({viewport:M});
    await s2.addInitScript(()=>{ try{ localStorage.setItem("offshoots.modesort","az"); }catch(e){} });
    await s2.goto(URL+"#modes"); await ready(s2); await landed(s2,"modes");
    const r=await s2.evaluate(()=>{
      const ps=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden), u=ps[ps.length-1];
      return {on:[...u.querySelectorAll("[data-msort]")].filter(x=>x.getAttribute("aria-selected")==="true").map(x=>(x.getAttribute("aria-label")||"").split(".")[0])[0],
        first:(u.querySelector(".moderow .lrlbl")||{}).textContent};});
    say("a remembered sort is honoured next time the page opens",
      r.on==="A–Z" && r.first==="Burn it off");
    await s2.close(); }

  // a stored value that is not one of the four must not strand the page on an empty list
  { const s3=await b.newPage({viewport:M});
    await s3.addInitScript(()=>{ try{ localStorage.setItem("offshoots.modesort","nonsense"); }catch(e){} });
    await s3.goto(URL+"#modes"); await ready(s3); await landed(s3,"modes");
    const r=await s3.evaluate(()=>{
      const ps=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden), u=ps[ps.length-1];
      return {on:[...u.querySelectorAll("[data-msort]")].filter(x=>x.getAttribute("aria-selected")==="true").map(x=>(x.getAttribute("aria-label")||"").split(".")[0])[0],
        rows:u.querySelectorAll(".moderow").length};});
    say("a nonsense stored sort falls back to quietest, with every mode still there",
      r.on==="Quietest" && r.rows===(await s3.evaluate(()=>MODES.length)));
    await s3.close(); }

  // the control has to survive the narrowest phone without clipping a label
  { const s4=await b.newPage({viewport:{width:320,height:700,isMobile:true,hasTouch:true}});
    await s4.goto(URL+"#modes"); await ready(s4); await landed(s4,"modes");
    // It used to be four words in a track that filled the panel and then scrolled, so the
    // last option sat off the edge. Icons fit outright at 320, beside the heading, which
    // is the whole reason for the change: reachable now means on screen, not scrollable to.
    const fit=await s4.evaluate(()=>{
      const seg=document.querySelector(".segctl.segicon");
      const head=document.querySelector(".secthead.picksort .secttl");
      const page=seg&&seg.closest(".ppage");
      const btns=seg?[...seg.querySelectorAll("[data-msort]")]:[];
      const r=x=>x.getBoundingClientRect();
      return {n:btns.length,
        tall:btns.every(b=>r(b).height>=28),
        onScreen:!!seg && r(seg).right<=r(page).right+1 && r(seg).left>=r(page).left-1,
        noScroll:!!seg && seg.scrollWidth<=seg.clientWidth+1,
        besideHead:!!head && !!seg && Math.abs(r(head).top-r(seg).top)<r(head).height,
        headOneLine:!!head && r(head).height<parseFloat(getComputedStyle(head).lineHeight)*1.5,
        nopush:document.documentElement.scrollWidth<=320+1};});
    say("at 320px all "+fit.n+" sit on screen beside the heading, no scrolling",
      fit.n===4 && fit.onScreen && fit.noScroll && fit.nopush);
    say("  with the heading still on one line and the taps big enough",
      fit.besideHead && fit.headOneLine && fit.tall);
    await s4.screenshot({path:__dirname+"/screens/m-modesort.png"});
    await s4.close(); }

// ---- leaving a mood and coming back to it ----
// Opening a style from a mood calls resetPages(), which wipes the page stack, and the
// crumb only ever recorded what was SELECTED. So back rebuilt Explore and dropped you at
// its top: the mood you were reading, and your place in it, were gone. The crumb carries
// the open page now, and back reopens it at the offset you left.
{ const p=await fresh(b,M);
  await p.click('[data-mode="miles"]'); await onPage(p,"mode:miles");
  await settle(p); await p.waitForTimeout(400);
  const where=await p.evaluate(()=>{ const b=document.getElementById("panelBody");
    b.scrollTop=320; return b.scrollTop; });
  const opened=await p.evaluate(()=>{
    const x=[...document.querySelectorAll(".ppage:not([hidden]) .pick")][1];
    x.click(); return x.querySelector(".pknm").textContent; });
  await p.waitForTimeout(700);
  const onStyle=await p.evaluate(()=>({
    lbl:(document.querySelector("#panelBack .bklbl")||{}).textContent||"",
    aria:document.getElementById("panelBack").getAttribute("aria-label")||""}));
  say("back out of "+opened+" is offered as the mood, not the map"
      +(onStyle.lbl?" ("+onStyle.lbl+")":": \""+onStyle.aria+"\""),
    /running or riding/i.test(onStyle.lbl) && /running or riding/i.test(onStyle.aria));
  await p.click("#panelBack"); await p.waitForTimeout(900);
  const back=await p.evaluate(()=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
    return {page:u?u.dataset.p:"(root)", scroll:document.getElementById("panelBody").scrollTop};});
  say("  and lands back on the mood, not on Explore ("+back.page+")", back.page==="mode:miles");
  // the offset is exact, which it was not while the push animated: hiding the outgoing
  // page 240ms later took its height out of the scroller and slid this by 40px
  say("  at the offset it was left at ("+back.scroll+" of "+where+")", back.scroll===where);
  // one more press leaves the mood, so back is still a stack and not a loop
  await p.click("#panelBack"); await p.waitForTimeout(900);
  const out=await p.evaluate(()=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
    return u?u.dataset.p:"(root)";});
  say("  and a second press leaves it ("+out+")", out!=="mode:miles");
  await p.close(); }

  await b.close();
})();
