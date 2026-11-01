const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,arm}=require("./_wait");
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
// the map is drawn, not merely loaded: a deep link's selection lands on a node, and the
// trail this file follows starts from whatever the map chose
const drawn=q=>until(q,()=>!!document.querySelector("#chart .n"));
const ready=async q=>{ await arm(q); await drawn(q); await settle(q); };
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
// a move along the trail is over when the hash says where it landed and the map has lit
// the node to match: the hash changes first and the selection follows
const at=async(q,h)=>{ await until(q,h=>location.hash===h
    && (h==="" || !!document.querySelector("#chart .n.cur")),h); await settle(q); };
// where the destination is not known in advance, the move is over when the hash is no
// longer the one it started from
const moved=async(q,from)=>{ await until(q,f=>location.hash!==f,from); await settle(q); };
// the lineage menu is a dropdown over the card, so it is open when it is on screen
const menu=async q=>{ await until(q,()=>{const m=document.querySelector(".navmenu");
    return !!m && !m.hidden && !!m.getClientRects().length;}); await settle(q); };
async function fresh(b,vp,hash){ const p=await b.newPage({viewport:vp}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+(hash||"")); await ready(p); p._errs=errs; return p; }
const shown=p=>p.evaluate(()=>{const e=document.getElementById("panelBack");
  return !!e && !e.hidden && getComputedStyle(e).visibility!=="hidden";});
const label=p=>p.evaluate(()=>{const e=document.getElementById("panelBack"); return e?e.getAttribute("title"):"";});
const hash=p=>p.evaluate(()=>location.hash);
// From and Led to moved out of the header and into the card, so reaching them on a phone
// means opening the sheet first. The peek is the playlist; the lineage is below it.
const open=async p=>{ if(await p.evaluate(()=>!document.body.classList.contains("open")))
  { await p.click("#grab").catch(()=>{}); await opened(p); } };

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  let p=await fresh(b,M);

  say("hidden with nothing behind you", (await shown(p))===false);

  // overview with a mode open -> a style -> back
  await p.click("#grab").catch(()=>{}); await opened(p);
  await p.click('[data-mode="winddown"]'); await onPage(p,"mode:winddown");
  // a mode is a pushed page now, and a pushed page owns the back button: it points at
  // the list you came from rather than at a style you visited
  say("a mode page takes the button over", await shown(p));
  say("naming the list under it", (await label(p))==="Back to Explore");
  const first=await p.$eval(".picks .pick",e=>e.dataset.go);
  await p.click(".picks .pick"); await at(p,"#"+first);
  say("appears after picking "+first, await shown(p));
  note("label", await label(p));
  await p.click("#panelBack"); await at(p,"");
  say("back lands on the overview", (await hash(p))==="");
  // Back used to stop here, on a clean overview, because the crumb recorded only what was
  // selected and opening a style wipes the page stack. That meant leaving a mood to look
  // at one of its styles cost you the mood and your place in it, and the way out of a
  // style was the front of the app rather than the list you were reading. The crumb
  // carries the open page now, so the mood comes back first and the root is one more
  // press beyond it.
  say("the mood you came from is back, not the overview root",
    (await p.$$(".ppage[data-p='mode:winddown']")).length===1);
  say("so the button still has somewhere to go", await shown(p));
  await p.click("#panelBack"); await at(p,"");
  say("  and that press leaves it for the root",
    (await p.$$(".ppage:not([data-p='root'])")).length===0);
  say("with the ways in on the overview again", (await p.$$(".mcirc")).length>0);
  say("hidden again at the start of the trail", (await shown(p))===false);

  // a four-deep lineage walk, then back out of it one at a time
  p=await fresh(b,M,"#punk");
  // a chain where every stop still leads somewhere, so the Led to button is never disabled
  const walk=["hardcore","thrash","deathmetal","blackmetal"];
  // The lineage used to be a menu on the title, which opened straight from the peek. It
  // is a section in the card now, so the sheet has to be open to walk it: that is the
  // trade the restructure made, the peek being for playing rather than for navigating.
  const ensureOpen=async q=>{ if(!(await q.evaluate(()=>document.body.classList.contains("open"))))
    await q.click("#grab").catch(()=>{}); await opened(q); };
  await ensureOpen(p);
  for(const id of walk){
    await p.$eval(`.sect-connections .cxled[data-go="${id}"]`,e=>e.scrollIntoView({block:"center"}));
    await settle(p);
    await p.click(`.sect-connections .cxled[data-go="${id}"]`); await at(p,"#"+id);
    await ensureOpen(p);
  }
  note("walked", "punk -> "+walk.join(" -> "));
  note("button shows the previous stop", await label(p));
  const seen=[];
  // each step back is read off the hash, so wait for the hash to leave the stop it was on
  // rather than for a named destination: naming it here would be asserting the answer
  for(let i=0;i<4;i++){ const was=await hash(p);
    await p.click("#panelBack"); await moved(p,was); seen.push(await hash(p)); }
  note("retraced", seen.join(" "));
  const want=["#"+walk[2],"#"+walk[1],"#"+walk[0],"#punk"];
  say("retraced in reverse order", seen.join()===want.join() ? true : "wanted "+want.join(" "));
  say("a deep link still offers one step out to the map", await shown(p));
  note("that last step says", await label(p));
  // back lives in the panel now, so it is a plain arrow with the destination in its title
  say("it still says where it goes", (await label(p))==="Back to the map");
  // the map pill now shows wherever a style is selected, so a deep link offers both
  say("home is offered here too, beside the step back", (await p.$eval("#mapHome",e=>!e.hidden))===true);
  await p.click("#panelBack"); await at(p,"");
  say("and lands on the unselected map", (await hash(p))==="" && (await p.$eval(".ovcard .mn",e=>e.textContent))==="Explore");
  say("hidden once the trail runs out", (await shown(p))===false);
  say("no stale highlight left on the map", (await p.$$eval("#chart .n.cur",e=>e.length))===0);
  await p.screenshot({path:__dirname+"/screens/m-back.png"});

  // the trail survives a browse-menu jump too, and empty-space taps
  p=await fresh(b,M,"#disco");
  await ensureOpen(p);
  await p.$eval(".sect-connections .cxfrom[data-go]",e=>e.scrollIntoView({block:"center"}));
  await settle(p);
  await p.click(".sect-connections .cxfrom[data-go]"); await moved(p,"#disco");
  const mid=await hash(p);
  // an empty-map tap. Not an offset inside #chart: that element is 3000px wide and
  // scrolled, so an offset into it lands off-screen and Playwright scrolls the map to
  // reach it, which moves whatever was under the point. And not a hard-coded viewport
  // point either, since what sits there changes with the layout. Find bare lane ground.
  // closing the sheet reflows the map, so the point is found again before each tap
  const bare=async()=>p.evaluate(()=>{
    for(let y=36;y<240;y+=6) for(let x=110;x<350;x+=8){
      const e=document.elementFromPoint(x,y);
      if(e && e.tagName==="rect" && /band/.test(e.getAttribute("class")||"")) return [x,y];
    } return null; });
  const tapBare=async()=>{ const pt=await bare(); if(!pt) return false;
    await p.mouse.click(pt[0],pt[1]); await at(p,""); return true; };
  // The lineage menu used to open from the peek, so the sheet was never opened here and a
  // tap on bare map cleared straight away. The lineage is a section in the card now, so
  // the sheet is open by the time the jump is made, and a first tap closes it: that is
  // the behaviour being walked, so the test closes it rather than pretending otherwise.
  say("the sheet is open, since the lineage lives in the card",
    (await p.evaluate(()=>document.body.classList.contains("open")))===true);
  await p.click("#grab").catch(()=>{});
  await until(p,()=>!document.body.classList.contains("open")); await settle(p);
  say("tapped bare map", await tapBare());
  say("which clears to the map", (await hash(p))==="");
  say("clearing to the map is a step too", await shown(p));
  note("its label", await label(p));
  await p.click("#panelBack"); await at(p,mid);
  say("back returns to "+mid, (await hash(p))===mid);

  // The row read back | title | minimise. The title left it for the body below, so the
  // row is the two controls and the space between them, and the name is a heading under
  // it rather than a thing they have to clear.
  const boxes=await p.evaluate(()=>{const r=document.querySelector(".navrow").getBoundingClientRect();
    const g=sel=>{const e=document.querySelector(sel); if(!e) return null;
      const b=e.getBoundingClientRect();
      return [Math.round(b.left-r.left),Math.round(b.right-r.left),Math.round(b.top-r.top)];};
    const nm=document.querySelector(".pttl").getBoundingClientRect();
    return {back:g("#panelBack"), x:g(".pmin"),
      nameBelow:Math.round(nm.top-r.bottom),
      titles:document.querySelectorAll(".navrow .navttl").length,
      backPos:getComputedStyle(document.querySelector("#panelBack")).position,
      xPos:getComputedStyle(document.querySelector(".pmin")).position,
      pad:Math.round(parseFloat(getComputedStyle(document.querySelector(".pcard .navrow")).paddingRight)),
      width:Math.round(r.width)};});
  say("back is left of the close control", boxes.back[1]<=boxes.x[0]);
  say("  with no title left between them", boxes.titles===0);
  // the band bleeds to the card's edges, so the row's own box is wider than the content
  // column: the X sits at the content edge, which is the row's edge less its padding
  say("the X sits at the content edge",
    Math.abs(boxes.width-boxes.pad-boxes.x[1])<=1);
  say("and the name sits below the row, not in it ("+boxes.nameBelow+"px)",
    boxes.nameBelow>=0);
  say("and both are pinned to the corners, not laid out in it",
    boxes.backPos==="absolute" && boxes.xPos==="absolute" && boxes.back[2]===0 && boxes.x[2]===0);
  say("back tap target "+(await p.$eval("#panelBack",e=>Math.round(e.getBoundingClientRect().height)))+"px",
    (await p.$eval("#panelBack",e=>e.getBoundingClientRect().height))>=34);
  // Two different rules, and the difference is the point. Back to a STYLE restores where
  // you were reading it. Back to EXPLORE always lands at the top: it is the front of the
  // app, and a front page that opens halfway down, heading gone and the list starting
  // mid-sentence, reads as broken rather than as considerate. The style half is covered
  // by the sub-page pops above; this checks the exception.
  const q=await fresh(b,M);
  await q.click("#grab").catch(()=>{}); await opened(q);
  const deep=await q.evaluate(()=>{const b=document.getElementById("panelBody");
    b.scrollTop=b.scrollHeight; return b.scrollTop;});
  await settle(q);
  say("  Explore has somewhere to scroll to ("+deep+"px)", deep>40);
  await q.click('[data-page="modes"]'); await onPage(q,"modes");
  say("  the pushed page starts at the top",
    (await q.evaluate(()=>document.getElementById("panelBody").scrollTop))===0);
  const mk=await q.$eval(".ppage:not([hidden]) [data-mode]",e=>e.dataset.mode);
  await q.click(".ppage:not([hidden]) [data-mode]"); await onPage(q,"mode:"+mk);
  const pick3=await q.$eval(".picks .pick",e=>e.dataset.go);
  await q.click(".picks .pick"); await at(q,"#"+pick3);
  await q.click("#panelBack"); await settle(q);
  const land=await q.evaluate(()=>document.getElementById("panelBody").scrollTop);
  say("  and back opens Explore at the top ("+land+", left at "+deep+")", land===0);
  say("no page errors", p._errs.length===0 ? true : p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  // the home pill: shown whenever you are not on the unselected root
  // it no longer disappears at the root: it stays in place and goes disabled, so "home"
  // here means live, not merely present
  const home=q=>q.$eval("#mapHome",e=>!e.hidden&&getComputedStyle(e).display!=="none"&&!e.disabled);
  const parked=q=>q.evaluate(()=>{ const e=document.getElementById("mapHome");
    const s=document.getElementById("mapSearch");
    const a=e.getBoundingClientRect(), b=s.getBoundingClientRect();
    return {shown:!e.hidden&&getComputedStyle(e).display!=="none", off:e.disabled,
      dim:parseFloat(getComputedStyle(e).opacity)<.6, says:e.title,
      size:Math.round(a.width)===Math.round(b.width)&&Math.round(a.height)===Math.round(b.height),
      top:Math.round(a.top)===Math.round(b.top),
      mirrored:Math.abs(Math.round(a.left)-Math.round((s.offsetParent?s.offsetParent.clientWidth:innerWidth)-b.right))<=1}; });
  p=await fresh(b,M);
  say("home is not live on the map itself", (await home(p))===false);
  // it was parked there, disabled and dimmed, which left a dead control sitting over the
  // lane strip in the one corner the map has. It goes instead.
  { const k=await parked(p);
    say("  and not there at all", k.shown===false);
    say("  so nothing covers the strip when there is nowhere to go", k.shown===false); }
  await p.click("#grab").catch(()=>{}); await opened(p);
  await p.click('[data-mode="winddown"]'); await onPage(p,"mode:winddown");
  const pick1=await p.$eval(".picks .pick",e=>e.dataset.go);
  await p.click(".picks .pick"); await at(p,"#"+pick1);
  say("home shown one step out", await home(p));
  const hwalk=["hardcore","thrash"];
  p=await fresh(b,M,"#punk");
  await ensureOpen(p);
  await p.$eval(`.sect-connections [data-go="${hwalk[0]}"]`,e=>e.scrollIntoView({block:"center"}));
  await settle(p);
  await p.click(`.sect-connections [data-go="${hwalk[0]}"]`); await at(p,"#"+hwalk[0]);
  say("home still there two styles deep", await home(p));
  say("and back names the style it returns to", /^Back to /.test(await label(p)));
  note("it says", await p.$eval("#mapHome",e=>e.getAttribute("title")));
  const hb=await p.evaluate(()=>{const h=document.getElementById("mapHome").getBoundingClientRect(),
    s=document.getElementById("mapSearch").getBoundingClientRect();
    return [Math.round(h.width),Math.round(h.height),Math.round(h.right),Math.round(s.left)];});
  say("tap target "+hb[0]+"x"+hb[1], hb[0]>=40&&hb[1]>=40);
  { const k=await parked(p);
    say("  the same size as the search button, on the same line", k.size && k.top);
    say("  and inset from its edge by the same amount", k.mirrored); }
  say("clear of the search button ("+hb[2]+" vs "+hb[3]+")", hb[2]<hb[3]);

  // ---------- what it does, not only where it sits ----------
  // It clears the selection and brings the panel up with it. Clearing alone rebuilt the
  // card as Explore and then left it behind a handle, so the button read as though it had
  // only emptied the map. Checked from a pushed page too, since that is the deepest place
  // the button is offered from and the one with the most to unwind.
  // fresh() takes the viewport flat and nests it itself, which is the spelling this file
  // uses; newContext wants it nested and silently hands back a desktop if it is not
  { const q=await fresh(b,M,"#dub"); await settle(q);
    say("on a style the sheet is down and home is offered",
      (await q.evaluate(()=>document.body.classList.contains("open")))===false && await home(q));
    await q.click("#mapHome");
    await until(q,()=>document.body.classList.contains("open") && location.hash==="");
    await settle(q);
    const back=await q.evaluate(()=>({
      open:document.body.classList.contains("open"), hash:location.hash,
      title:(document.querySelector(".ovcard .bigttl .mn")||{}).textContent,
      pages:[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).map(x=>x.dataset.p),
      cur:!!document.querySelector("#chart .n.cur"), home:!document.getElementById("mapHome").hidden}));
    say("the map button opens Explore and clears the style",
      back.open && back.hash==="" && back.title==="Explore"
      && back.pages.join()==="root" && back.cur===false);
    say("  and takes its own button away, there being nowhere left to go", back.home===false);

    await q.close(); }

  // again from two levels in: a style with a page pushed on top of it, which is the
  // deepest the button is offered from and the most there is to unwind
  { const q=await fresh(b,M,"#gospel"); await settle(q);
    await q.click("#grab").catch(()=>{});
    await until(q,()=>document.body.classList.contains("open"));
    await settle(q);
    const pushed=await q.$('[data-page="artists"]');
    if(pushed){ await pushed.click();
      await until(q,()=>[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)
        .some(x=>x.dataset.p!=="root"));
      await settle(q); }
    const deep=await q.evaluate(()=>[...document.querySelectorAll(".ppage")]
      .filter(x=>!x.hidden).map(x=>x.dataset.p).join(","));
    await q.click("#mapHome");
    await until(q,()=>location.hash==="");
    await settle(q);
    say("  and unwinds a pushed page on the way (was "+deep+")",
      await q.evaluate(()=>{
        const up=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden);
        return up.length===1 && up[0].dataset.p==="root"
          && document.body.classList.contains("open")
          && !document.querySelector("#chart .n.cur");}));
    await q.close(); }
  // it used to sit right of the lane strip to keep off the family labels. Mirroring the
  // search button put it back over the strip, which is the price of that symmetry: at the
  // top of the map it covers only the blank filler, but scrolled down it crosses whichever
  // family label is passing under it. Pinned here so the trade is deliberate, not forgotten.
  const strip=await p.evaluate(()=>{
    const pill=document.getElementById("mapHome").getBoundingClientRect(),
      lane=document.querySelector(".lane.fill")||document.querySelector(".lane[data-fam]");
    const r=lane.getBoundingClientRect();
    return {over:Math.round(Math.min(pill.right,r.right)-Math.max(pill.left,r.left)),
      stripw:Math.round(r.width)};});
  say("it overlaps the "+strip.stripw+"px lane strip by "+strip.over+"px, which mirroring cost",
    strip.over>0 && strip.over<=strip.stripw);
  await p.click("#mapHome"); await at(p,"");
  say("one tap lands on the map", (await hash(p))==="" && (await p.$eval(".ovcard .mn",e=>e.textContent))==="Explore");
  say("and goes again rather than sitting there dead", (await home(p))===false);
  { const k=await parked(p); say("  gone from the corner", k.shown===false); }
  // home is a reset: the walk that led here is gone, so back goes too
  say("back is cleared away with it", (await shown(p))===false);
  // and the trail really is empty, not merely hidden: the next move starts from the map
  await p.click("#grab").catch(()=>{}); await opened(p);
  await p.click('[data-mode="winddown"]'); await onPage(p,"mode:winddown");
  const pick2=await p.$eval(".picks .pick",e=>e.dataset.go);
  await p.click(".picks .pick"); await at(p,"#"+pick2);
  note("the next step starts a fresh trail", await label(p));
  // one step, and that step is the mood just left rather than anything from the walk that
  // home cleared. It used to read "Back to the map", which said the trail was empty but
  // also that the mood had been forgotten on the way into one of its styles.
  say("not the walk from before", (await label(p))==="Back to Winding down");
  say("no page errors", p._errs.length===0 ? true : p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  // the three pieces of map chrome sit on one line, and the search surfaces are light
  const D={width:1440,height:900};
  for(const [name,vp] of [["phone",M],["desktop",D]]){
    p=await fresh(b,vp);
    // the sheet covers the zoom control on a phone, so press it directly
    await p.$eval("#zin",e=>e.click()); await settle(p);
    const btnTop=await p.$eval("#mapSearch",e=>Math.round(e.getBoundingClientRect().top));
    // the field is measured, so wait for it to be on screen rather than merely in the DOM
    await p.$eval("#mapSearch",e=>e.click());
    await until(p,()=>{const e=document.querySelector("#bottomSearch input");
      return !!e && !!e.getClientRects().length;});
    await settle(p);
    await p.fill("#bottomSearch input","blues");
    // the results are what the contrast is read off, so wait for one to arrive
    await until(p,()=>document.querySelectorAll("#bottomSearch .results li").length>0);
    await settle(p);
    const m=await p.evaluate(()=>{
      const box=s=>{const e=document.querySelector(s); if(!e) return null;
        const r=e.getBoundingClientRect(); return {t:Math.round(r.top),h:Math.round(r.height),cx:Math.round(r.left+r.width/2)};};
      const lum=s=>{const e=document.querySelector(s); if(!e) return {};
        const c=getComputedStyle(e), f=v=>{const n=(v.match(/[\d.]+/g)||[0,0,0]).slice(0,3).map(Number);
          return (0.2126*n[0]+0.7152*n[1]+0.0722*n[2])/255;};
        return {bg:f(c.backgroundColor), fg:f(c.color)};};
      const sw=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidew"))||0;
      return {zoom:box("#zreset2"), search:box("#bottomSearch input"),
        z:lum("#zreset2"), s:lum("#bottomSearch input"), r:lum("#bottomSearch .results"),
        hits:document.querySelectorAll("#bottomSearch .results li").length,
        vw:innerWidth, sidew:sw};
    });
    const tops=[m.zoom.t,m.search.t,btnTop];
    say(name+" zoom pill, search field and search button share a top "+tops.join("/"),
      Math.max(...tops)-Math.min(...tops)<=2);
    say(name+" zoom pill is dark on light "+m.z.bg.toFixed(2)+"/"+m.z.fg.toFixed(2),
      m.z.bg>.85 && m.z.fg<.2);
    say(name+" search field is dark on light "+m.s.bg.toFixed(2)+"/"+m.s.fg.toFixed(2),
      m.s.bg>.85 && m.s.fg<.2);
    say(name+" results are dark on light "+m.r.bg.toFixed(2)+"/"+m.r.fg.toFixed(2)+" ("+m.hits+" hits)",
      m.hits>0 && m.r.bg>.85 && m.r.fg<.2);
    // centred on the map, which on a desktop is the viewport minus the sidebar
    const centre=Math.round((m.vw-m.sidew)/2);
    say(name+" zoom pill is centred on the map ("+m.zoom.cx+" vs "+centre+")",
      Math.abs(m.zoom.cx-centre)<=3);
    say(name+" no page errors", p._errs.length===0 ? true : p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  }

  await b.close();
})();
