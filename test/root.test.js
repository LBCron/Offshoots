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
  await p.click("#grab").catch(()=>{}); await opened(p);

  // ---- order on the page ----
  const order=await p.$eval("#panelBody",e=>[...e.querySelectorAll(".ovcard,.sect-feat,.sect-modes,.browse,.ovhint,.aboutwrap")]
    .map(x=>x.className.split(" ").find(c=>/ovcard|sect-feat|sect-modes|browse|ovhint|aboutwrap/.test(c))));
  note("reading order", order.join(" → "));
  // the panel is titled, so its sections mostly are not: the list under the title needs no
  // label, and the two folds say what they are without a heading over them saying it again.
  // Two headings are left. The chips carry one because what they sort by is not obvious
  // from them. The sources carry one because they are not styles: without it, a list of
  // media reads as a continuation of the ways into the map above it.
  const groups=await p.$$eval("#panelBody .sect .secttl",e=>e.map(x=>x.textContent));
  say("two section headings: "+groups.join(" / "),
    groups.length===2 && /^Browse by /.test(groups[0]) && groups[1]==="Go deeper");
  say("  not Find: these are for when you do not know what you want", !/find/i.test(groups[0]));
  say("  the colophon is still its own section", (await p.$$(".sect-learn [data-page]")).length===2);
  say("  with no heading on it", (await p.$$(".sect-learn .secthead")).length===0);
  say("  and the list under the title has none either", (await p.$$(".sect-browse .secthead")).length===0);
  say("  and none are left loose", (await p.$$eval("#panelBody > .more > [data-page]",e=>e.length))===0);
  // they are about the map rather than part of it, so they read as a colophon: no filled
  // cards, an icon each, and an inset hairline above the group instead of a box around it
  // About, How to install and Share are one grouped list at the foot of the panel: the
  // share action is a row like the other two, and says a link was copied by turning its
  // own tile green rather than by being a different shape.
  // About and How to install open something, so they are rows in a box. Share acts, so
  // it is a button under the box, and the one blue thing on the page: a family skin
  // repaints --accent on a style panel, which is why this blue is its own token.
  const col=await p.evaluate(()=>{ const sec=document.querySelector(".sect-learn");
    const grp=sec.querySelector(".listgrp"), rows=[...sec.querySelectorAll(".listrow")];
    const sh=sec.querySelector(".shbtn"), body=document.getElementById("panelBody").getBoundingClientRect();
    // --blue fills, --bluetx reads: a tint of the fill behind type of the fill colour
    // chases its own contrast, so the label takes the text blue and the ground keeps the
    // fill blue. The claim here is still that Share is the one thing on the panel in it.
    const blue=getComputedStyle(document.documentElement).getPropertyValue("--bluetx").trim();
    const hex=h=>{h=h.replace("#","");return [0,2,4].map(i=>parseInt(h.substr(i,2),16)).join(", ");};
    return {n:rows.length,
      labels:rows.map(f=>(f.querySelector(".lrlbl")||{}).textContent||""),
      boxed:!/rgba\(0, 0, 0, 0\)/.test(getComputedStyle(grp).backgroundColor)
        && parseFloat(getComputedStyle(grp).borderRadius)>=10,
      icons:rows.every(f=>!!f.querySelector(".lrico svg")),
      tap:Math.min(...rows.concat(sh?[sh]:[]).map(f=>Math.round(f.getBoundingClientRect().height))),
      shLbl:sh?(sh.querySelector(".shlbl")||{}).textContent:"",
      shBlue:!!sh && getComputedStyle(sh).color.indexOf(hex(blue))>=0,
      shOut:!!sh && !grp.contains(sh) && !!(grp.compareDocumentPosition(sh)&4),
      onlyBlue:[...document.querySelectorAll("#panelBody *")].filter(e=>{
        const c=getComputedStyle(e).color; return c.indexOf(hex(blue))>=0;})
        .filter(e=>!(sh&&sh.contains(e))).length,
      bleeds:rows.concat([sec]).some(e=>{ const cs=getComputedStyle(e);
        return (parseFloat(cs.borderTopWidth)||0)>0
          && e.getBoundingClientRect().width>=body.width*0.9; })}; });
  say("two rows in one box: "+col.labels.join(" / "),
    col.n===2 && col.labels.join("/")==="About this map/How to install it");
  say("  on a grouped ground with a radius", col.boxed);
  say("  an icon on each, nothing under "+col.tap+"px", col.icons && col.tap>=44);
  say("  with Share as a button under it ("+col.shLbl+")",
    col.shLbl==="Share this app" && col.shOut);
  say("  in blue, and the only blue on the panel", col.shBlue && col.onlyBlue===0);
  say("  and nothing bleeding across the panel", col.bleeds===false);

  // "Start here" is the style you are handed; the 17 are where the music starts. Both
  // were called start. The list row took the word the axis already prints over that region.
  const starts=await p.evaluate(()=>({
    heads:[...document.querySelectorAll("#panelBody .secttl")].map(x=>x.textContent),
    row:(document.querySelector(".sect-browse .listrow .lrlbl")||{}).textContent||"",
    axis:[...document.querySelectorAll("#axis text")].map(x=>x.textContent).join(" ")}));
  say("nothing on the panel says start ("+starts.heads.join(" / ")+")",
    starts.heads.every(h=>!/start/i.test(h)));
  say("  nor does the big title or the rows", await p.evaluate(()=>{
    const t=[document.querySelector(".bigttl").textContent,
      ...[...document.querySelectorAll(".listgrp .lrlbl")].map(x=>x.textContent)].join(" ");
    return !/start/i.test(t); }));
  say("  the 17 are "+JSON.stringify(starts.row), starts.row==="Roots");
  say("  which is the axis's own word for that region", /Roots/.test(starts.axis));

  say("browse leads, then the modes", order.indexOf("browse")<order.indexOf("sect-modes"));
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
  { await p.click('[data-page="about"]'); await onPage(p,"about");
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
  say("the root is titled "+(hdr&&hdr.name), !!hdr && hdr.name==="Explore");
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

  // the rows go somewhere now rather than unfolding, so the chevron points that way
  const cv=await p.evaluate(()=>{
    const r=document.querySelector('[data-page="roots"]');
    return {points:r.querySelector(".lrcv").innerHTML,
      forward:r.querySelector(".lrcv").classList.contains("lrgov")}; });
  say("  the chevron points the way the row goes", /M181\.66,122\.34/.test(cv.points) && cv.forward);

  // the ways in are one grouped list, the way a phone app lists collections
  const grp=await p.evaluate(()=>{ const g=document.querySelector(".sect-browse .listgrp");
    if(!g) return null;
    const rows=[...g.querySelectorAll(".listrow")];
    const gb=g.getBoundingClientRect();
    return {labels:rows.map(r=>r.querySelector(".lrlbl").textContent),
      counts:rows.map(r=>(r.querySelector(".lrct")||{}).textContent||""),
      chevrons:rows.map(r=>!!r.querySelector(".lrcv")),
      icons:rows.every(r=>!!r.querySelector(".lrico svg")),
      oneCard:rows.every(r=>Math.round(r.getBoundingClientRect().width)===Math.round(gb.width)),
      radius:parseFloat(getComputedStyle(g).borderRadius),
      tap:Math.min(...rows.map(r=>Math.round(r.getBoundingClientRect().height))),
      inset:getComputedStyle(g).getPropertyValue("--lrlead").trim()}; });
  // Families, Playlists and Most influential came out: they were reference lists, and
  // what is left is the two rows that are ways in rather than ways to look something up
  say("one list: "+(grp&&grp.labels.join(" / ")),
    !!grp && grp.labels.join("/")==="Roots/Most influential/Surprise me");
  say("  with a count on each ("+(grp&&grp.counts.join(", "))+")", !!grp && grp.counts.every(c=>c.length>0));
  // the shaded card went: a panel is already a card, and a second one inside it pushed
  // every row in by two gutters. The rows span it and a hairline does the dividing.
  // the ways in went back into their grouped card: the picks are the one list that
  // stays out of one, since a row of album covers is already a run of squares
  say("  an icon on each, in one card of radius "+(grp&&grp.radius),
    !!grp && grp.icons && grp.oneCard && grp.radius>=10);
  say("  separators inset to the name ("+(grp&&grp.inset)+")", !!grp && parseFloat(grp.inset)>=40);
  say("  rows at least "+(grp&&grp.tap)+"px", !!grp && grp.tap>=44);
  // the first two open a list; Surprise me is a destination, so it has no chevron
  say("  the first two open a list, the last does not", !!grp &&
    grp.chevrons[0]===true && grp.chevrons[1]===true && grp.chevrons[2]===false);

  // Roots pushes a page rather than dropping a menu, so the test follows it in and back
  await p.click('[data-page="roots"]'); await onPage(p,"roots");
  const pg=await p.evaluate(()=>{ const page=document.querySelector('.ppage[data-p="roots"]');
    if(!page || page.hidden) return null;
    const items=[...page.querySelectorAll("[data-go]")].map(x=>x.dataset.go);
    return {title:(page.querySelector(".bigttl .mn")||{}).textContent, n:items.length,
      lede:!!page.querySelector(".pglede"),
      back:!document.getElementById("panelBack").hidden,
      backLbl:(document.querySelector("#panelBack .bklbl")||{}).textContent,
      rootHidden:document.querySelector('.ppage[data-p="root"]').hidden,
      allRoots:items.every(id=>{ const row=DATA.find(d=>d[0]===id); return !!row && !(row[4]||"").trim(); })}; });
  say("  the roots row pushes a page titled "+(pg&&pg.title), !!pg && pg.title==="Roots");
  say("  listing "+(pg&&pg.n)+" styles, every one of them a root", !!pg && pg.allRoots && pg.n===17);
  say("  with a line saying what they are", !!pg && pg.lede);
  say("  the page it came from is put away", !!pg && pg.rootHidden===true);
  say("  and back says where it goes ("+(pg&&pg.backLbl)+")", !!pg && pg.back && pg.backLbl==="Explore");
  await p.click('.ppage[data-p="roots"] [data-go]');
  // a pick is through when the hash names it and the map has lit the node
  await until(p,()=>location.hash.length>1 && !!document.querySelector("#chart .n.cur"));
  await settle(p);
  say("  and picking one selects it ("+(await p.evaluate(()=>location.hash))+")",
    await p.evaluate(()=>location.hash.length>1));
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
    say("sheet starts minimised", (await mini.$eval("body",e=>e.classList.contains("open")))===false);
    say("  and nothing is left of Start here",
      (await mini.$$(".sect-feat, .featpick, .shuf, [data-shuffle]")).length===0);
    await mini.close(); }

  // ---- 5: About as a pushed page ----
  // it used to be a fold at the bottom of the panel, where opening it laid the text out
  // below the fold and the tap looked like it had done nothing
  const abRow=await p.evaluate(()=>{
    const r=document.querySelector('[data-page="about"]'), b=document.getElementById("panelBody");
    return {exists:!!r, label:r?r.querySelector(".lrlbl").textContent:"",
      tap:r?Math.round(r.getBoundingClientRect().height):0,
      anyOpenText:!!document.querySelector(".ppage .abouthd")}; });
  say("About is a row, not a fold", abRow.exists && abRow.label==="About this map");
  say("  tap target "+abRow.tap+"px", abRow.tap>=44);
  say("  and its text is not in the panel until you ask", abRow.anyOpenText===false);
  await p.click('[data-page="about"]'); await onPage(p,"about");
  const ab=await p.evaluate(()=>{
    const pg=document.querySelector('.ppage[data-p="about"]'), b=document.getElementById("panelBody");
    return {up:!!pg&&!pg.hidden, title:(pg.querySelector(".bigttl .mn")||{}).textContent,
      top:Math.round(pg.getBoundingClientRect().top-b.getBoundingClientRect().top),
      scroll:b.scrollTop, stats:(pg.querySelector(".stats")||{}).textContent||""}; });
  say("tapping it pushes the page", ab.up && ab.title==="About this map");
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
    (await p.$eval('.ppage[data-p="root"] .bigttl .mn',e=>e.textContent))==="Explore");
  note("families stated once", (await p.$eval("#panelBody",e=>e.textContent)).split("families").length-1);

  // ---- 6: the heading is the way to the full set ----
  // the count that used to sit beside it went when the heading became a control: the
  // title, a count and a chevron do not fit a phone, and the page itself says how many
  say("mode heading opens the set", await p.$eval(".sect-modes .secthead",
    e=>e.tagName==="BUTTON" && e.dataset.page==="modes" && !e.querySelector(".sectaside")));

  // ---- space saved ----
  const hgt=await p.$eval("#panelBody",e=>{const a=e.querySelector(".ovcard").getBoundingClientRect(),
    z=e.querySelector(".sect-learn").getBoundingClientRect(); return Math.round(z.bottom-a.top);});
  note("root panel height, colophon included (was 765 with About collapsed)", hgt);
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
    return {n:r.length, hiMin:Math.min(...hi), loMax:Math.max(...lo)};
  });
  say("every lane is banded ("+bands.n+")", bands.n===nFams);
  say("low rows all darker than high rows", bands.loMax < bands.hiMin);
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
