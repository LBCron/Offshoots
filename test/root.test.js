const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise,lower}=require("./_wait");
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
// one name for "the page is loaded, the map is drawn and nothing is moving". Every
// measurement here is taken against the map, so a loaded document is not enough.
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
async function fresh(b,vp,hash){ const p=await b.newPage({viewport:vp}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+(hash||"")); await ready(p); p._errs=errs; return p; }

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  let p=await fresh(b,M);
  await raise(p); await opened(p);

  // ---- order on the page ----
  // Collections lead. They are the thing most people want and the only section whose
  // contents are pictures, so they are also what the minimised sheet peeks at. Then what
  // the map itself will do for you, then what the map is, then the reading, then the
  // app's own settings. About used to be a fold under the title, which spent the top of
  // the panel on a closed row and hid the one paragraph explaining the whole thing.
  const order=await p.$eval("#panelBody",e=>[...e.querySelectorAll(
    ".ovcard,.sect-modes,.sect-onmap,.sect-about,.sect-deeper,.sect-appset,.more > .shbtn,.ovhint")]
    .map(x=>x.className.split(" ").find(c=>/ovcard|sect-onmap|sect-modes|sect-about|sect-deeper|sect-appset|shbtn|ovhint/.test(c))));
  note("reading order", order.join(" \u2192 "));
  say("Collections first, then the map shortcuts, then About, then the reading",
    order.indexOf("sect-modes")<order.indexOf("sect-onmap")
    && order.indexOf("sect-onmap")<order.indexOf("sect-about")
    && order.indexOf("sect-about")<order.indexOf("sect-deeper"));
  say("  the app's own settings last, with Share under them",
    order.indexOf("sect-appset")>order.indexOf("sect-deeper")
    && order.indexOf("shbtn")===order.length-1);
  // Every section says what it is now. The panel used to leave the first list unlabelled
  // on the grounds that the title covered it, which worked while there was one list.
  const groups=await p.$$eval("#panelBody .sect .secttl",e=>e.map(x=>x.textContent));
  say("four section headings: "+groups.join(" / "),
    groups.join("/")==="Collections/Exploring the Atlas/About this map/Go deeper");
  say("  not Find: these are for when you do not know what you want", !/find/i.test(groups.join(" ")));
  say("  and Collections is called that here too, the way its own page is",
    groups[0]==="Collections");
  // Only Go deeper keeps a line under it. The other two had captions for things that
  // already say what they are: two labelled rows, and a row of pictures of a cat asleep,
  // a nightcap and a coffee shop.
  const ledes=await p.$$eval("#panelBody .sect .sectlede",e=>e.map(x=>x.textContent));
  say("  one line, under the one section whose contents are not self-evident",
    ledes.length===1 && ledes[0]==="Stories and context behind the music.");
  say("  and none are left loose", (await p.$$eval("#panelBody > .more > [data-page]",e=>e.length))===0);

  // ---- About, a section in the body ----
  // It was a fold directly under the title: a closed row at the top of the panel, with
  // the one paragraph explaining the whole thing behind a triangle nobody turns. It is
  // an ordinary open section now, between Exploring the Atlas and Go deeper.
  const fold=await p.evaluate(()=>{ const d=document.querySelector(".sect-about");
    if(!d) return null;
    const h=d.querySelector(".secttl"), ttl=document.querySelector(".ovcard .bigttl");
    return {isFold:d.tagName==="DETAILS"||!!d.querySelector("summary"),
      label:h?h.textContent.trim():"",
      shown:d.getBoundingClientRect().height>0,
      underTitle:!!ttl && !!(ttl.compareDocumentPosition(d)&4),
      body:(d.querySelector(".note")||{}).textContent||"",
      more:(d.querySelector("[data-page=\"about\"] .lrlbl")||{}).textContent||""}; });
  say("About the map is a section, not a fold", !!fold && fold.isFold===false
    && fold.label==="About this map");
  say("  with its text on the page rather than behind a triangle",
    !!fold && fold.shown && fold.body.length>80);
  // the three things it has to cover, in the brief's own order
  say("  saying what the map is, how styles connect, and what a playlist is",
    !!fold && /\bstyles\b/.test(fold.body) && /grew out of/.test(fold.body)
    && /playlist/.test(fold.body));
  // and not fencing it off to one continent. Reggae, Dub, Ska, Jungle, Grime, Krautrock,
  // Bossa Nova, Highlife, Afrobeat, Gqom, Cumbia, Soca, Son Cubano and Italo Disco were
  // all on the map when this claim was first written, and the lines crossing water is
  // the point of the thing. It came off once and came back with the restructure.
  say("  without narrowing it to one continent",
    !!fold && !/North America/i.test(fold.body));
  say("  with the full page one tap on ("+(fold&&fold.more)+")",
    !!fold && fold.more==="Read more about this atlas");
  // and it is a row, like every other way out of this panel: a card, a glyph, a chevron.
  // It was a line of text with a chevron after it, which is not a shape this panel uses
  // anywhere else.
  {    await settle(p);
    const row=await p.evaluate(()=>{
      const r=document.querySelector('.sect-about [data-page="about"]');
      if(!r) return null;
      const g=r.closest(".listgrp"), pete=document.querySelector('[data-page="picks"]');
      const same=(a,b,k)=>getComputedStyle(a)[k]===getComputedStyle(b)[k];
      return {boxed:!!g && parseFloat(getComputedStyle(g).borderRadius)>=10
          && !/rgba\(0, 0, 0, 0\)/.test(getComputedStyle(g).backgroundColor),
        icon:!!r.querySelector(".lrico svg"), chev:!!r.querySelector(".lrcv"),
        tap:Math.round(r.getBoundingClientRect().height),
        likePete:!pete || (same(r,pete,"fontSize") && same(r,pete,"minHeight"))};});
    say("  drawn as a row in a card, the way Pete's Picks is",
      !!row && row.boxed && row.icon && row.chev && row.likePete);
    say("  clearing the tap floor ("+(row&&row.tap)+"px)", !!row && row.tap>=44); }

  // ---- the footer: the app's own two settings ----
  const foot=await p.evaluate(()=>{ const sec=document.querySelector(".sect-appset");
    if(!sec) return null;
    const sh=document.querySelector(".more > .shbtn");
    const inst=sec.querySelector("[data-page=\"install\"]");
    const blue=getComputedStyle(document.documentElement).getPropertyValue("--bluetx").trim();
    const hex=h=>{h=h.replace("#","");return [0,2,4].map(i=>parseInt(h.substr(i,2),16)).join(", ");};
    return {svc:!!sec.querySelector("select.svcsel"),
      svcLbl:(sec.querySelector(".svclbl")||{}).textContent||"",
      inst:inst?inst.textContent.replace(/\s+/g," ").trim():"",
      instTap:inst?Math.round(inst.getBoundingClientRect().height):0,
      shLbl:sh?(sh.querySelector(".shlbl")||{}).textContent:"",
      shTap:sh?Math.round(sh.getBoundingClientRect().height):0,
      shWide:(()=>{ if(!sh) return false;
        const b=document.getElementById("panelBody"), cs=getComputedStyle(b);
        const inner=b.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
        return sh.getBoundingClientRect().width>=inner-1; })(),
      shBlue:!!sh && getComputedStyle(sh).color.indexOf(hex(blue))>=0,
      shOut:!!sh && !sec.contains(sh) && !!(sec.compareDocumentPosition(sh)&4),
      onlyBlue:[...document.querySelectorAll("#panelBody *")].filter(e=>{
        const c=getComputedStyle(e).color; return c.indexOf(hex(blue))>=0;})
        .filter(e=>!(sh&&sh.contains(e))).length}; });
  say("the service picker is at the foot ("+(foot&&foot.svcLbl)+")",
    !!foot && foot.svc && foot.svcLbl==="Music service");
  say("  with how to install beside it ("+(foot&&foot.inst)+")",
    !!foot && /^Install Music Atlas/.test(foot.inst) && foot.instTap>=44);
  say("  and Share full width under both ("+(foot&&foot.shLbl)+")",
    !!foot && foot.shLbl==="Share this app" && foot.shOut && foot.shWide && foot.shTap>=44);
  say("  in blue, and the only blue on the panel", !!foot && foot.shBlue && foot.onlyBlue===0);

  // ---- Roots came off the panel ----
  // The map is the browser. A third list of style names under it, competing with the map
  // directly above, was the thing the restructure was for. The page itself still exists.
  const noRoots=await p.evaluate(()=>{
    const txt=[...document.querySelectorAll("#panelBody .listgrp .lrlbl")]
      .map(x=>x.textContent);
    return {labels:txt, roots:txt.some(t=>/^Roots$/.test(t)),
      rows:[...document.querySelectorAll(".sect-onmap .listrow")].map(r=>({
        lbl:(r.querySelector(".lrlbl")||{}).textContent||"",
        sub:(r.querySelector(".lrsub")||{}).textContent||"",
        ct:(r.querySelector(".lrct")||{}).textContent||""}))}; });
  say("Roots is not a row on the panel any more", noRoots.roots===false);
  say("  the two that are left go to the map, and say what for: "
    + noRoots.rows.map(r=>r.lbl+" ("+r.sub+")").join(", "),
    noRoots.rows.length===2
    && noRoots.rows[0].lbl==="Most influential" && noRoots.rows[0].sub==="Explore musical crossroads"
    && noRoots.rows[1].lbl==="Surprise me" && noRoots.rows[1].sub==="Jump somewhere unexpected");
  // the number on the row is the number of rows on the page it opens, not a constant
  // written beside it that goes on saying 24 after the selection changes
  // counted here the way the app counts it, rather than read back off the app, so the
  // check would still catch the row and the page drifting apart
  await p.click('.sect-onmap [data-page="top"]'); await onPage(p,"top");
  const topN=await p.$$eval('.ppage[data-p="top"] .topgrid .tcirc',e=>e.length);
  await p.click("#panelBack"); await settle(p);
  say("  and the count is the number of styles on the page it opens ("
    + noRoots.rows[0].ct+" said, "+topN+" there)",
    topN>0 && noRoots.rows[0].ct===String(topN));
  say("  while Surprise me carries none, being a place rather than a list",
    noRoots.rows[1].ct==="");

  // nothing on the panel says start: "Start here" was the style you are handed and the
  // roots are where the music starts, and both were called start
  const starts=await p.evaluate(()=>({
    heads:[...document.querySelectorAll("#panelBody .secttl")].map(x=>x.textContent),
    axis:[...document.querySelectorAll("#axis text")].map(x=>x.textContent).join(" ")}));
  say("nothing on the panel says start ("+starts.heads.join(" / ")+")",
    starts.heads.every(h=>!/start/i.test(h)));
  say("  nor does the big title or the rows", await p.evaluate(()=>{
    const t=[document.querySelector(".bigttl").textContent,
      ...[...document.querySelectorAll(".listgrp .lrlbl")].map(x=>x.textContent)].join(" ");
    return !/start/i.test(t); }));
  say("  and the axis still has the word for that region", /Roots/.test(starts.axis));

  // the line telling you to tap the map went: the map is the whole screen behind the
  // sheet, and a sentence pointing at it was the panel explaining itself
  say("no sentence pointing at the map", order.indexOf("ovhint")<0);

  const nFams=await p.evaluate(()=>typeof FAMS!=="undefined"?FAMS.length:-1);
  // ---- 2: the title block describes the map, so it sits on the map ----
  note("meta", await p.$eval("#maphead .mmeta",e=>e.textContent));
  say("playlist count is on the map", (await p.$eval("#maphead .mmeta",e=>e.textContent)).includes("playlists"));
  say("and not repeated in the panel", (await p.$$("#panelBody .mmeta, .ovcard .tag")).length===0);
  // the band is a quiet label now: no blurb, a smaller name, and both set below full strength
  const quiet=await p.evaluate(()=>{ const t=document.querySelector("#maphead .mh"),
    m=document.querySelector("#maphead .mmeta"), body=getComputedStyle(document.body);
    const dim=c=>{ const n=(c.match(/[\d.]+/g)||[]).map(Number);
      return n.length>3 ? n[3] : /\/\s*([\d.]+)/.test(c) ? +RegExp.$1 : 1; };
    return {size:parseFloat(getComputedStyle(t).fontSize), blurb:!!document.querySelector("#maphead .mtag"),
      ttlDim:dim(getComputedStyle(t).color), metaDim:dim(getComputedStyle(m).color),
      heading:parseFloat(body.getPropertyValue("--t-title1"))||0}; });
  say("the blurb is gone", quiet.blurb===false);
  say("  the name is "+quiet.size+"px, smaller than the old title size", quiet.size<=20);
  say("  and both lines are dimmed ("+quiet.ttlDim+", "+quiet.metaDim+")",
    quiet.ttlDim<1 && quiet.metaDim<1);
  // it sits above the first lane rather than over it
  const band=await p.evaluate(()=>{ const h=document.getElementById("maphead").getBoundingClientRect(),
    l=document.querySelector(".lane[data-fam]").getBoundingClientRect();
    return {gap:Math.round(l.top-h.bottom), h:Math.round(h.height)}; });
  say("the band is "+band.h+"px and the first lane starts "+band.gap+"px below it", band.h>40 && band.gap>=0);
  // the blurb and the counts sit beside the name, not under it, wherever there is room
  { const q=await b.newPage({viewport:{width:1440,height:900}});
    await q.goto(URL); await ready(q);
    const lay=await q.evaluate(()=>{ const t=document.querySelector("#maphead .mh").getBoundingClientRect(),
      g=document.querySelector("#maphead .mmeta").getBoundingClientRect(),
      f=document.querySelector(".lane.fill"), h=document.getElementById("maphead").getBoundingClientRect();
      const fb=f?f.getBoundingClientRect():null;
      return {beside:Math.round(g.left-t.right), sameLine:Math.abs(Math.round(g.top-t.top))<30,
        band:Math.round(h.height), fillTop:fb?Math.round(fb.top):null,
        fillH:fb?Math.round(fb.height):null, bandTop:Math.round(h.top)}; });
    say("the counts sit "+lay.beside+"px right of the name, on its line", lay.beside>0 && lay.sameLine);
    say("  which keeps the band to "+lay.band+"px", lay.band<=56);
    say("  and the lane strip is filled beside it ("+lay.fillH+"px from "+lay.fillTop+")",
      lay.fillH!==null && Math.abs(lay.fillH-lay.band)<=2 && Math.abs(lay.fillTop-lay.bandTop)<=2);
    // it belongs to the map, so panning the timeline carries it along
    const before=await q.evaluate(()=>Math.round(document.querySelector("#maphead .mh").getBoundingClientRect().left));
    await q.evaluate(()=>{ document.getElementById("scroller").scrollLeft=200; }); await settle(q);
    const after=await q.evaluate(()=>({ttl:Math.round(document.querySelector("#maphead .mh").getBoundingClientRect().left),
      strip:Math.round(document.querySelector(".lane.fill").getBoundingClientRect().left)}));
    say("  panning 200px moves the title with the map ("+before+" to "+after.ttl+")", before-after.ttl>=190);
    say("  while the lane strip stays pinned at "+after.strip, after.strip<=1);
    await q.close(); }
  // the back and map pills float over the top left of the map, where the title now is
  { const q=await b.newPage({viewport:{width:1440,height:900}});
    await q.goto(URL+"#delta"); await ready(q);
    // the pills are what this block measures, and they only appear once boot has chosen
    // the deep-linked style
    await until(q,()=>{const e=document.getElementById("navpills");
      return !!e && e.getBoundingClientRect().width>0;});
    await q.evaluate(()=>{ document.getElementById("scroller").scrollTop=0; }); await settle(q);
    const hit=await q.evaluate(()=>{ const a=document.getElementById("navpills").getBoundingClientRect();
      const over=s=>{ const e=document.querySelector(s); if(!e) return false;
        const r=e.getBoundingClientRect();
        return !(a.right<r.left||a.left>r.right||a.bottom<r.top||a.top>r.bottom); };
      return {vis:a.width>0, title:over("#maphead .mh"), tag:false, meta:over("#maphead .mmeta")}; });
    say("with a style selected the pills are showing", hit.vis);
    say("  and clear of the title, tagline and counts", !hit.title && !hit.tag && !hit.meta);
    await q.close(); }
  // the app icon left the header and moved into About, so check both ends of that:
  // a bare .appicon count would now find the one inside the collapsed details
  say("no app icon in the header", (await p.$$(".ovcard .navrow .appicon")).length===0);
  {    await settle(p);
    await p.click('.sect-about [data-page="about"]'); await onPage(p,"about");
    say("it moved onto the About page", (await p.$$('.ppage[data-p="about"] .abouthd .appicon')).length===1);
    await p.click("#panelBack"); await onPage(p,"root");
    await p.evaluate(()=>{document.getElementById("panelBody").scrollTop=0;}); await settle(p); }

  // ---- the root panel's header and its list of ways in ----
  // the header carries nothing now: the title is a large one under it, the roots moved
  // into the Browse list, and share is a button at the foot like a style panel's
  const hdr=await p.evaluate(()=>{ const card=document.querySelector(".ovcard"),
      row=card&&card.querySelector(".navrow");
    if(!row) return null;
    const t=card.querySelector(".bigttl"), sect=card.parentNode.querySelector(".secttl"),
      tb=t.getBoundingClientRect(), rb=row.getBoundingClientRect();
    return {name:t.textContent, align:getComputedStyle(t).textAlign,
      size:parseFloat(getComputedStyle(t.querySelector(".mn")||t).fontSize),
      sectSize:sect?parseFloat(getComputedStyle(sect).fontSize):0,
      flush:sect?Math.round(tb.left-sect.getBoundingClientRect().left):99,
      belowRow:Math.round(tb.top-rb.bottom), inRow:!!row.querySelector(".bigttl"),
      controls:[...row.querySelectorAll("button")].filter(b=>!b.hidden).length,
      rowH:Math.round(rb.height)}; });
  say("the root is titled "+(hdr&&hdr.name), !!hdr && hdr.name==="Music Atlas");
  say("  left-aligned under the row, "+(hdr&&hdr.belowRow)+"px below it",
    !!hdr && hdr.align==="left" && hdr.belowRow>=0 && hdr.inRow===false);
  say("  flush with the section headings ("+(hdr&&hdr.flush)+"px)", !!hdr && Math.abs(hdr.flush)<=1);
  say("  and bigger than them, "+(hdr&&hdr.size)+" against "+(hdr&&hdr.sectSize),
    !!hdr && hdr.size>=28 && hdr.size>hdr.sectSize);
  say("  the row above it holds one control, the X", !!hdr && hdr.controls===1);
  // the row bleeds past the card's content edge so the stuck band has no gap down its
  // sides; the X stays at the content edge, one padding in from the row's own
  say("  and it is at the right of the content", await p.evaluate(()=>{
    const r=document.querySelector(".ovcard .navrow"), x=r.querySelector(".pmin");
    const pad=parseFloat(getComputedStyle(r).paddingRight);
    return !!x && Math.abs(r.getBoundingClientRect().right-pad-x.getBoundingClientRect().right)<=1; }));
  note("  and it says what it does", await p.$eval(".ovcard .pmin",e=>e.getAttribute("title")));
  say("  which is close, not minimise",
    await p.$eval(".ovcard .pmin",e=>e.hasAttribute("data-dismiss")&&/close/i.test(e.getAttribute("title"))));
  // it floats over the corner rather than setting the row's height: a 44px control in the
  // flow pushed the large title down by its own height
  const xo=await p.evaluate(()=>{ const card=document.querySelector(".ovcard"),
    row=card.querySelector(".navrow"), x=card.querySelector(".pmin"),
    t=card.querySelector(".bigttl");
    const cb=card.getBoundingClientRect();
    return {rowH:Math.round(row.getBoundingClientRect().height),
      pos:getComputedStyle(x).position,
      titleTop:Math.round(t.getBoundingClientRect().top-cb.top),
      // the h1 is a block and spans the card, so measure the painted text, not the box
      clearsTitle:(()=>{ const rg=document.createRange();
        rg.selectNodeContents(t.querySelector(".mn")||t);
        return Math.round(x.getBoundingClientRect().left - rg.getBoundingClientRect().right); })()}; });
  say("  floating, so the row stays "+xo.rowH+"px", xo.pos==="absolute" && xo.rowH<=24);
  // it sits lower than it did: level with the close button, the two read as a collision
  // rather than as alignment. Still bounded, so it cannot drift down the card.
  say("  and the title starts "+xo.titleTop+"px into the card", xo.titleTop<=40);
  say("  with the title clear of it by "+xo.clearsTitle+"px", xo.clearsTitle>0);

  // The rows go somewhere rather than unfolding, so they carry the chevron and not the
  // solid triangle, which is the disclosure control. Both point right, so the class says
  // nothing: the path is the only thing that tells them apart.
  const cv=await p.evaluate(()=>{
    const r=document.querySelector('.sect-onmap [data-page="top"]');
    return {points:r.querySelector(".lrcv").innerHTML,
      forward:r.querySelector(".lrcv").classList.contains("lrgov")}; });
  const CHV=/M181\.66,133\.66l-80,80a8,8,0,0,1-11\.32-11\.32L164\.69,128/;
  const TRI=/M181\.66,133\.66l-80,80A8,8,0,0,1,88,208V48/;
  say("  the chevron points the way the row goes",
    CHV.test(cv.points) && cv.forward ? true
      : TRI.test(cv.points) ? "it is the fold triangle" : "unrecognised glyph");

  // the two map shortcuts are one grouped list, the way a phone app lists collections
  const grp=await p.evaluate(()=>{ const g=document.querySelector(".sect-onmap .listgrp");
    if(!g) return null;
    const rows=[...g.querySelectorAll(".listrow")];
    const gb=g.getBoundingClientRect();
    return {labels:rows.map(r=>r.querySelector(".lrlbl").textContent),
      subs:rows.map(r=>(r.querySelector(".lrsub")||{}).textContent||""),
      chevrons:rows.map(r=>!!r.querySelector(".lrcv")),
      icons:rows.every(r=>!!r.querySelector(".lrico svg")),
      oneCard:rows.every(r=>Math.round(r.getBoundingClientRect().width)===Math.round(gb.width)),
      radius:parseFloat(getComputedStyle(g).borderRadius),
      tap:Math.min(...rows.map(r=>Math.round(r.getBoundingClientRect().height))),
      inset:getComputedStyle(g).getPropertyValue("--lrlead").trim()}; });
  // Roots came out with the restructure, and Families, Playlists and the rest before it:
  // they were reference lists, and the map is the reference. What is left is the two
  // rows that take you somewhere the map cannot take you by being looked at.
  say("one list: "+(grp&&grp.labels.join(" / ")),
    !!grp && grp.labels.join("/")==="Most influential/Surprise me");
  say("  with a second line on each ("+(grp&&grp.subs.join(", "))+")",
    !!grp && grp.subs.every(c=>c.length>0));
  say("  with an icon on each, the same as the library rows below", !!grp && grp.icons===true);
  say("  in one card of radius "+(grp&&grp.radius), !!grp && grp.oneCard && grp.radius>=10);
  say("  rows at least "+(grp&&grp.tap)+"px", !!grp && grp.tap>=44);
  // Most influential opens a list; Surprise me is a destination, so it has no chevron
  // both carry one: the old Surprise me row dropped its chevron on the grounds that it
  // opened nothing, but it does go somewhere, and a row that goes somewhere says so
  say("  both say they go somewhere", !!grp &&
    grp.chevrons[0]===true && grp.chevrons[1]===true);

  // ---- Roots is still a page, just not a row on the panel ----
  // Anyone who had the address keeps it, and the styles, the root classifications and
  // the lineage behind them are all untouched. It is reached by its hash now.
  { const rp=await fresh(b,M,"#roots");
    await raise(rp); await opened(rp);
    await onPage(rp,"roots");
    const r=await rp.evaluate(()=>{ const page=document.querySelector('.ppage[data-p="roots"]');
      if(!page || page.hidden) return null;
      const items=[...page.querySelectorAll("[data-go]")].map(x=>x.dataset.go);
      return {title:(page.querySelector(".bigttl .mn")||{}).textContent, n:items.length,
        lede:!!page.querySelector(".pglede"),
        allRoots:items.every(id=>{ const row=DATA.find(d=>d[0]===id); return !!row && !(row[4]||"").trim(); })}; });
    say("#roots still opens a page titled "+(r&&r.title), !!r && r.title==="Roots");
    say("  listing "+(r&&r.n)+" styles, every one of them a root", !!r && r.allRoots && r.n===17);
    say("  with a line saying what they are", !!r && r.lede);
    await rp.close(); }

  await p.goto(URL); await ready(p);
  // the last row goes somewhere rather than opening anything
  await p.click("[data-random]");
  await until(p,()=>location.hash.length>1 && !!document.querySelector("#chart .n.cur"));
  await settle(p);
  const r1=await p.evaluate(()=>location.hash);
  say("  the last row lands on a style ("+r1+")", r1.length>1);
  await p.goto(URL); await ready(p);

  // Start here was a second random pick beside Surprise me, so it went. What it proved
  // still matters for the rows that replaced it: a named row on a minimised sheet has to
  // navigate rather than just expand the panel, which is what tap-anywhere-to-open does.
  { const mini=await fresh(b,M);
    // Opening the app lands on Explore now rather than on a peek of it, so the minimised
    // state has to be asked for before the thing it proves can be checked at all.
    say("opening the app lands on Explore",
      (await mini.$eval("body",e=>e.classList.contains("open")))===true);
    const vis=await mini.evaluate(()=>{
      const r=document.getElementById("panel").getBoundingClientRect();
      return {sheet:Math.round(r.height), map:Math.round(r.top), vh:innerHeight}; });
    say("  with the map still showing above it ("+vis.map+"px of "+vis.vh+")",
      vis.map>=vis.vh*0.2 && vis.sheet>=vis.vh*0.55);
    await lower(mini); await settle(mini);
    say("  and one pull puts it back to a peek",
      (await mini.$eval("body",e=>e.classList.contains("open")))===false);
    say("  and nothing is left of Start here",
      (await mini.$$(".sect-feat, .featpick, .shuf, [data-shuffle]")).length===0);
    await mini.close(); }

  // ---- 5: the full About, still a pushed page ----
  // The section carries the short version. The full one, with the sources, the colophon
  // and the data link, is still a pushed page rather than unrolled in place, where
  // opening it laid text out below the fold and the tap looked like it had done nothing.
  const abRow=await p.evaluate(()=>({
    inside:!!document.querySelector('.sect-about [data-page="about"]'),
    anyOpenText:!!document.querySelector(".ppage .abouthd")}));
  say("the full About is a page behind the section, not laid out on the panel",
    abRow.inside);
  say("  and its text is not in the panel until you ask", abRow.anyOpenText===false);
  const abMore=await p.evaluate(()=>{
    const r=document.querySelector('.sect-about [data-page="about"]');
    return {exists:!!r, label:r?r.querySelector(".lrlbl").textContent:"",
      tap:r?Math.round(r.getBoundingClientRect().height):0}; });
  say("opening it offers the rest ("+abMore.label+")",
    abMore.exists && abMore.label==="Read more about this atlas");
  say("  tap target "+abMore.tap+"px", abMore.tap>=44);
  await p.click('.sect-about [data-page="about"]'); await onPage(p,"about");
  const ab=await p.evaluate(()=>{
    const pg=document.querySelector('.ppage[data-p="about"]'), b=document.getElementById("panelBody");
    return {up:!!pg&&!pg.hidden, title:(pg.querySelector(".bigttl .mn")||{}).textContent,
      top:Math.round(pg.getBoundingClientRect().top-b.getBoundingClientRect().top),
      scroll:b.scrollTop, stats:(pg.querySelector(".stats")||{}).textContent||""}; });
  say("tapping it pushes the page", ab.up && ab.title==="About this map of what grew out of what");
  say("  landing at the top rather than past the fold ("+ab.top+"px, scroll "+ab.scroll+")",
    ab.scroll===0 && ab.top<=80);
  note("  stats line inside", ab.stats);

  // the last block used to sit flush against the panel's bottom edge
  const tail=await p.evaluate(()=>{
    const b=document.getElementById("panelBody");
    b.scrollTop=b.scrollHeight;
    const last=b.lastElementChild.lastElementChild||b.lastElementChild;
    return Math.round(b.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom);
  });
  say("air below the last block ("+tail+"px)", tail>=12);
  await p.click("#panelBack"); await onPage(p,"root");
  await p.evaluate(()=>{document.getElementById("panelBody").scrollTop=0;});
  say("back returns to Explore",
    (await p.$eval('.ppage[data-p="root"] .bigttl .mn',e=>e.textContent))==="Music Atlas");
  note("families stated once", (await p.$eval("#panelBody",e=>e.textContent)).split("families").length-1);

  // ---- 6: the heading is the way to the full set ----
  // the count that used to sit beside it went when the heading became a control: the
  // title, a count and a chevron do not fit a phone, and the page itself says how many.
  // "See all" came back in its place, because a chevron alone never said what it opened.
  say("the collections heading opens the set", await p.$eval(".sect-modes .secthead",
    e=>e.tagName==="BUTTON" && e.dataset.page==="modes" && !e.querySelector(".sectaside")));
  say("  saying so in words", await p.$eval(".sect-modes .secthead .seeall",
    e=>e.textContent==="See all"));
  // on one line, words then chevron. The box was a grid from when it held the chevron
  // alone, and a grid gives every child a row of its own: "See all" came out stacked on
  // top of its own chevron at every phone width.
  say("  on one line with its chevron", await p.$eval(".sect-modes .secthead",h=>{
    const sa=h.querySelector(".seeall").getBoundingClientRect();
    const cv=h.querySelector(".sectcv svg").getBoundingClientRect();
    return Math.abs(sa.top-cv.top)<10 && cv.left>=sa.right-1;}));
  // and only there: the other two headings open nothing, so neither offers to
  say("  and nowhere else on the panel",
    (await p.$$("#panelBody .sect .seeall")).length===1);

  // ---- how early the collections come ----
  // The panel is four sections rather than a list, a row of covers and a colophon, and
  // the point of the order is that the covers are in reach without a hunt.
  // on a page that has not had the fold opened: this one has, from the About check above
  const rp2=await fresh(b,M);
  await raise(rp2); await opened(rp2);
  const reach=await rp2.$eval("#panelBody",e=>{
    const a=e.querySelector(".ovcard").getBoundingClientRect();
    const m=e.querySelector(".sect-modes").getBoundingClientRect();
    return {top:Math.round(m.top-a.top+e.scrollTop), view:e.clientHeight,
      total:e.scrollHeight};});
  note("collections start at", reach.top+"px of "+reach.total);
  say("the collections are within a screen of the top ("+reach.top+"px, "
    + reach.view+"px of panel)", reach.top<=reach.view);
  await rp2.close();
  await p.screenshot({path:__dirname+"/screens/r-m-root.png"});
  // the lane bands are family-coloured at two opacities; the rhythm only survives while
  // every low row stays darker than every high row, whichever families sit next to each other
  const bands=await p.evaluate(()=>{
    const lum=c=>{const s=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
      return .2126*s[0]+.7152*s[1]+.0722*s[2];};
    const px=el=>{const cs=getComputedStyle(el); const m=cs.fill.match(/[\d.]+/g).map(Number);
      const a=parseFloat(cs.fillOpacity), bg=[15,15,17];
      return lum(m.slice(0,3).map((v,i)=>bg[i]+(v-bg[i])*a));};
    const r=[...document.querySelectorAll("#chart .band")];
    const hi=r.filter(x=>!x.classList.contains("b2")).map(px);
    const lo=r.filter(x=>x.classList.contains("b2")).map(px);
    return {n:r.length, hiMin:Math.min(...hi), loMax:Math.max(...lo),
      inks:[...new Set(r.map(x=>getComputedStyle(x).fill))],
      inline:r.filter(x=>/fill/.test(x.getAttribute("style")||"")).length,
      // the family colour belongs where it says something: the rail on the left and the
      // dot on every style. On the lanes it was a third telling of the same thing, across
      // a fifth of the screen, and it is what made the map hard to read.
      railHues:new Set([...document.querySelectorAll(".lane.c")]
        .map(x=>getComputedStyle(x).getPropertyValue("--c").trim())).size,
      dotHues:new Set([...document.querySelectorAll("#chart .n")]
        .map(x=>getComputedStyle(x).getPropertyValue("--c").trim())).size};
  });
  say("every lane is banded ("+bands.n+")", bands.n===nFams);
  say("low rows all darker than high rows", bands.loMax < bands.hiMin);
  say("  in one neutral ink, not eighteen family ones ("+bands.inks.length+")",
    bands.inks.length===1 && bands.inline===0 ? true : bands.inks.join(", "));
  say("  while the rail and the dots keep the colour that means something ("
    +bands.railHues+" rails, "+bands.dotHues+" dots)",
    bands.railHues===nFams && bands.dotHues===nFams);
  say("no mobile errors", p._errs.filter(x=>!/Failed to load/.test(x)).length===0);

  const d=await fresh(b,Dk);
  await d.screenshot({path:__dirname+"/screens/r-d-root.png"});
  say("no desktop errors", d._errs.filter(x=>!/Failed to load/.test(x)).length===0);

  // ---- one mark, one meaning ----
  // Fill used to say "before 1950" left of the divider and "has a playlist" right of
  // it, so the same visual property meant two different things depending on where you
  // were on the x-axis. Era is already carried by position and by the italic label.
  const marks=await d.evaluate(()=>{
    const of=g=>{ if(!g) return null; const c=g.querySelector("circle"), cs=getComputedStyle(c);
      return {fill:cs.fill, stroke:cs.stroke, tri:!!g.querySelector(".ply")}; };
    const same=(a,b)=>a&&b&&a.fill===b.fill&&a.stroke===b.stroke&&a.tri===b.tri;
    return {
      rings:[...document.querySelectorAll("#chart .n circle")]
              .filter(c=>parseFloat(getComputedStyle(c).strokeWidth)>=2).length,
      playMatches: same(of(document.querySelector(".n.root.has")),
                        of(document.querySelector(".n:not(.root).has"))),
      plainMatches: same(of(document.querySelector(".n.root:not(.has)")),
                         of(document.querySelector(".n:not(.root):not(.has)"))),
      rootsItalic: getComputedStyle(document.querySelector(".n.root text:not(.halo)")).fontStyle==="italic"
    };});
  say("no hollow rings left on the map ("+marks.rings+")", marks.rings===0);
  say("a pre-1950 style with a playlist is marked like any other", marks.playMatches);
  say("and one without is marked like any other", marks.plainMatches);
  say("era is still carried by the italic label", marks.rootsItalic);

  // ---- the map fills a wide window ----
  // The year scale is a fixed number of pixels per year, so past a certain width it ran
  // out before the canvas did and left dead space to the right of the last year. Both
  // ends are checked: it must fill when there is room, and must still overflow and
  // scroll when there is not, or the fix would be shrinking the map on normal screens.
  const span=async q=>q.evaluate(()=>{
    const sc=document.getElementById("scroller"), ch=document.getElementById("chart");
    return {sc:sc.clientWidth, chart:Math.round(ch.getBoundingClientRect().width)};});
  for(const w of [2560,3440]){
    const wide=await fresh(b,{width:w,height:1000});
    const m=await span(wide);
    const gap=m.sc-m.chart;
    say("at "+w+"px the map reaches the edge (chart "+m.chart+" vs "+m.sc+")", gap<=8);
    say("  and no errors there", wide._errs.filter(x=>!/Failed to load/.test(x)).length===0);
    await wide.close();
  }
  const narrow=await fresh(b,{width:1440,height:1000});
  const nm=await span(narrow);
  say("at 1440px it still overflows and scrolls ("+nm.chart+" vs "+nm.sc+")", nm.chart>nm.sc);
  await narrow.close();

  await b.close();
})();
