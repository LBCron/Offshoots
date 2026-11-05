const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,gone,shown,arm,raise}=require("./_wait");
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
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing
// is mutating. Everything that measures a resting sheet waits for it to be gone.
const glided=q=>until(q,()=>!document.getElementById("panel").style.height);
// open means the body says so, the glide has cleaned up after itself, and the page has
// gone quiet. Waiting for the class alone would measure the sheet mid-flight.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await glided(q); await settle(q); };
// the copy is a promise, and the button only says "Link copied" once the write has
// landed, so one condition covers both the clipboard and the label.
const wrote=(q,n)=>until(q,n=>window.__copied.length>n
  && !!document.querySelector("#panel [data-share].done, #panel [data-aboutcopy].done"),n);
// the share button says "Link copied" for 1600ms and then puts its own label back
const relabelled=q=>until(q,()=>{const b=document.querySelector("#panel [data-share]");
  return !b || !b.classList.contains("done");});
// a page that lands on a fold opens the sheet and pushes the page 420ms after boot
const landed=(q,p)=>until(q,p=>{const d=document.querySelector('.ppage[data-p="'+p+'"]');
  return !!d && !d.hidden && document.body.classList.contains("open");},p);
async function fresh(b,vp,hash){ const p=await b.newPage({viewport:vp});
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  // no real share sheet in headless, and clipboard needs a stub to resolve
  await p.addInitScript(()=>{ window.__copied=[];
    Object.defineProperty(navigator,"share",{value:undefined,configurable:true});
    Object.defineProperty(navigator,"clipboard",{configurable:true,
      value:{writeText:t=>{window.__copied.push(t);return Promise.resolve();}}});
  });
  await p.goto(URL+(hash||"")); await arm(p);
  // the panel is measured against the map, so the map has to be drawn, not merely loaded
  await shown(p,"#chart .n"); await settle(p);
  p._errs=errs; return p; }

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);

  // ---------- the old footer is gone ----------
  let d=await fresh(b,Dk,"#disco");
  say("footer button removed", (await d.$$("#pshare, #pfoot")).length===0);
  // The title used to be the lineage control, which hid the map's own relationships in a
  // menu and put them in the same bar as Back. The name is a heading in the body now and
  // the lineage is a section of its own; Share stays its own button at the foot.
  say("the name is a heading, not a control",
    await d.$eval(".pttl", e=>e.tagName==="H1" && !e.querySelector("button")));
  say("  with the date beside it", await d.$eval(".pttl .ptyr",e=>/\d{4}/.test(e.textContent)));
  say("no control left in the nav row but Back and Close",
    (await d.$$(".navrow button")).length===2);
  // a menu, specifically: the bar does carry the style's name once you scroll past it,
  // but that is a label, not somewhere to go
  say("the lineage is a section, not a menu on the title",
    (await d.$$(".sect-connections")).length===1
    && (await d.$$("button.navttl, .navttl[aria-haspopup]")).length===0);
  const sb=await d.evaluate(()=>{ const w=document.querySelector(".shbtn.wide");
    if(!w) return null;
    const r=w.getBoundingClientRect(), body=document.getElementById("panelBody");
    const tally=document.querySelector(".tally").getBoundingClientRect();
    return {label:w.querySelector(".shlbl").textContent, pos:getComputedStyle(w).position,
      width:Math.round(r.width), room:Math.round(body.clientWidth),
      tall:Math.round(r.height), beforeTally:Math.round(tally.top-r.bottom),
      only:document.querySelectorAll("#panel [data-share]").length}; });
  say("share is a labelled button at the foot ("+(sb&&sb.label)+")", !!sb && /Share/.test(sb.label));
  say("  running the full width, "+sb.width+" of "+sb.room, sb.width>=sb.room-48);
  say("  in the flow, not pinned over the text ("+sb.pos+")", sb.pos==="static");
  say("  below the tally by "+(-sb.beforeTally)+"px", sb.beforeTally<=0);
  say("  tap target "+sb.tall+"px", sb.tall>=34);
  // the button used to be the one blue thing on a panel painted the family's own
  // colours, which read as app chrome dropped into the style. It now borrows --acc from
  // the family skin, and still has to out-weigh the playlist card beside it or the two
  // read as the same kind of block.
  // The weight order changed with the restructure, and this check changed with it. Share
  // used to have to out-weigh the playlist card beside it. The panel now opens on a solid
  // Open playlist button that is meant to be the heaviest thing on it, so what has to
  // hold is the other way round: play is opaque, share is a tint of the family colour.
  const sc=await d.evaluate(()=>{
    const w=document.querySelector(".shbtn.wide"), p=document.getElementById("panel");
    const play=document.querySelector(".plbtn");
    // a bare rgb() is opaque; only rgba()/color() carry a fourth value
    const alpha=c=>{const m=/^(?:rgba|color)\(/.test(c) ? c.match(/[\d.]+\s*\)\s*$/) : null;
      return m?parseFloat(m[0]):1;};
    return {acc:getComputedStyle(p).getPropertyValue("--acc").trim(),
      col:getComputedStyle(w).color,
      shareA:alpha(getComputedStyle(w).backgroundColor),
      playA:play?alpha(getComputedStyle(play).backgroundColor):0};});
  say("  wearing the family accent, not the system blue",
    !!sc.acc && !/10,\s*132,\s*255/.test(sc.col));
  say("  and sitting under the play button ("+sc.shareA+" vs "+sc.playA+")",
    sc.playA===1 && sc.shareA<sc.playA);
  say("  and it is the only share control on the panel", sb.only===1);

  // the name is left-aligned under the nav row now, so what matters is that it starts at
  // the card's own edge rather than being centred in a bar it no longer lives in
  const c=await d.evaluate(()=>{
    const nm=document.querySelector(".pttl .ptnm").getBoundingClientRect();
    const card=document.querySelector(".pcard").getBoundingClientRect();
    return Math.round(nm.left-card.left); });
  say("the name starts at the card edge ("+c+"px in)", c>=0 && c<=24);

  // ---------- sharing ----------
  await d.click(".shbtn.wide"); await wrote(d,0); await settle(d);
  note("copied the style link", await d.evaluate(()=>window.__copied[0]||""));
  note("the button confirms", await d.$eval(".shbtn .shlbl",e=>e.textContent));
  say("  and the title is left alone", await d.$eval(".pttl .ptnm",e=>e.textContent)==="Disco");
  await relabelled(d); await settle(d);
  note("label comes back", await d.$eval(".shbtn .shlbl",e=>e.textContent));

  // overview shares the map
  d=await fresh(b,Dk);
  // the root has no body text to hang a wide button under, so its share is a round one
  // in the left track, where back sits on every other panel
  say("overview title is a heading below the row", await d.$eval(".ovcard .bigttl",e=>e.tagName==="H1"));
  const rb=await d.evaluate(()=>{ const card=document.querySelector(".ovcard"),
    sh=document.querySelector("#panelBody .shbtn"), row=card.querySelector(".navrow");
    if(!sh) return null;
    const sr=sh.getBoundingClientRect(), body=document.getElementById("panelBody");
    return {label:sh.querySelector(".shlbl").textContent, width:Math.round(sr.width),
      room:body.clientWidth, pos:getComputedStyle(sh).position,
      round:document.querySelectorAll("#panelBody .shbtn.round").length,
      inHeader:row.querySelectorAll("[data-share]").length,
      last:sh.parentNode.lastElementChild===sh,
      only:document.querySelectorAll("#panelBody [data-share]").length}; });
  say("the root shares the same way a style does ("+rb.label+")", rb.label==="Share this app");
  // on the overview it is a row in the list that ends the panel, not a button of its own
  say("  full width, "+rb.width+" of "+rb.room, rb.width>=rb.room-48);
  say("  the last row of the colophon list", rb.last && rb.pos!=="absolute" && rb.pos!=="fixed");
  say("  nothing round left in the header", rb.round===0 && rb.inHeader===0);
  say("  and it is the only share control here", rb.only===1);
  await d.$eval("#panelBody .shbtn",e=>e.scrollIntoView({block:"center"})); await settle(d);
  await d.click("#panelBody .shbtn"); await wrote(d,0); await settle(d);
  const u=await d.evaluate(()=>window.__copied[0]||"");
  say("copied the map link (no #)", !u.includes("#") ? true : u);
  say("  and says so in its label",
    await d.$eval("#panelBody .shbtn .shlbl",e=>e.textContent)==="Link copied");
  await relabelled(d); await settle(d);
  say("  then goes back to the label",
    await d.$eval("#panelBody .shbtn .shlbl",e=>e.textContent)==="Share this app");
  // the title on the map is a heading, not a second way to do the same thing
  const mh=await d.evaluate(()=>{ const h=document.querySelector("#maphead .mh");
    return {tag:h.tagName, share:document.querySelectorAll("#maphead [data-share]").length,
      buttons:document.querySelectorAll("#maphead button, #maphead a").length}; });
  say("the map title is a heading ("+mh.tag+")", mh.tag==="H1");
  say("  with nothing to click on the band", mh.share===0 && mh.buttons===0);
  say("  so the panel is the only place to share from", (await d.$$("[data-share]")).length===1);

  // ---------- mobile: the minimised sheet still expands on a title tap ----------
  // the title no longer shares, so tapping it has one job: open the sheet. The share
  // button is at the foot of the card, which is only reachable once it is open.
  let p=await fresh(b,M,"#disco");
  say("sheet starts minimised", (await p.$eval("body",e=>e.classList.contains("open")))===false);
  // the peek is a look at the playlist, not a place to act from. The button was showing
  // in it, under the cover art and behind the expand chevron.
  say("  and the share button is not in the peek",
    (await p.$eval(".shbtn.wide",e=>getComputedStyle(e).display))==="none");
  // The peek is the shortest way to press play, so it carries the name and the whole
  // Start listening block and nothing else. The lineage used to be reachable here through
  // the title's menu; it is a section in the card now, which is a deliberate trade: the
  // peek is for playing, and the map's relationships are something you open the panel for.
  const peek=await p.evaluate(()=>{
    const vis=s=>{const e=document.querySelector(s);
      return !!e && getComputedStyle(e).display!=="none" && e.getBoundingClientRect().height>0;};
    return {name:vis(".pttl"), play:vis(".plbtn"), art:vis(".startrow .pcov,.startrow .pcovph"),
      artists:vis(".sect-artists"), links:vis(".sect-connections"), deeper:vis(".sect-read")};});
  say("the peek carries the name and the way to play it",
    peek.name && peek.play && peek.art);
  say("  and nothing below it", !peek.artists && !peek.links && !peek.deeper);
  say("and shares nothing by itself", (await p.evaluate(()=>window.__copied.length))===0);
  await raise(p); await opened(p);
  await p.$eval("#panelBody .shbtn",e=>e.scrollIntoView({block:"center"})); await settle(p);
  await p.click("#panelBody .shbtn"); await wrote(p,0); await settle(p);
  say("the control at the foot does the sharing", (await p.evaluate(()=>window.__copied.length))===1);
  const tb=await p.$eval("#panelBody .shbtn",e=>[Math.round(e.getBoundingClientRect().height)]);
  say("tap target "+tb[0]+"px tall", tb[0]>=44);
  // a long name must not let the tap area reach back on one side or the pair on the other
  await p.goto(URL+"#skapunk"); await arm(p); await shown(p,"#chart .n");
  await p.reload(); await arm(p); await shown(p,"#chart .n");
  // the header is measured against the selection, so the style has to be current
  await until(p,()=>!!document.querySelector("#chart .n.cur")); await settle(p);
  await raise(p); await opened(p);
  // The name is a heading in the body now, so nothing has to thread between the two
  // controls pinned to the nav row's corners. What matters instead is that a long one
  // wraps rather than running under them or off the card.
  const gap=await p.evaluate(()=>{
    const nm=document.querySelector(".pttl").getBoundingClientRect();
    const card=document.querySelector(".pcard").getBoundingClientRect();
    const bk=document.querySelector("#panelBack").getBoundingClientRect();
    return {below:Math.round(nm.top-bk.bottom), over:Math.round(nm.right-card.right),
      name:document.querySelector(".pttl .ptnm").textContent};});
  say("the longest name sits clear below the controls ("+gap.below+"px, "+gap.name+")",
    gap.below>=0);
  say("  and inside the card ("+gap.over+"px over)", gap.over<=0);

  // ---------- the lineage is a section ----------
  // It was a segmented pill, then rows in the card, then a menu hanging off the title.
  // The menu made the map's own relationships something you had to know was there, and
  // put them in the same bar as Back, which means something else entirely.
  const seg=await p.evaluate(()=>{
    const s=document.querySelector(".sect-connections");
    if(!s) return null;
    const cols=[...s.querySelectorAll(".cxcol")];
    const cb=cols.map(c=>c.getBoundingClientRect());
    return {heads:cols.map(c=>c.querySelector(".cxh").textContent.trim()),
      counts:cols.map(c=>c.querySelectorAll("[data-go]").length),
      title:(s.querySelector(".secttl")||{}).textContent||"",
      inFlow:getComputedStyle(s).position==="static",
      menus:document.querySelectorAll("button.navttl, .navttl[aria-haspopup]").length};});
  say("both directions are on the panel (\""+seg.title+"\": "+seg.heads.join(" | ")+")",
    !!seg && /^Before this style/.test(seg.heads[0]) && /^After this style/.test(seg.heads[1]));
  say("  listing "+seg.counts.join(" and ")+" styles by name",
    seg.counts[0]+seg.counts[1] > 0);
  say("  in the flow, with no menu left on a title", seg.inFlow && seg.menus===0);

  // ---------- which sections start open ----------
  // Explore the connections is the longest thing on a style panel, two columns of up to
  // twenty-five names, and it is a place to go next rather than something to read on the
  // way through. It starts shut, with its count beside the heading. Go deeper is the
  // opposite: at most nine sources, and a title you can read is the thing itself, so its
  // groups start open.
  const starts=await p.evaluate(()=>{
    const cx=document.querySelector(".sect-connections");
    const rd=document.querySelector(".sect-read");
    return {cxFold:!!cx && cx.tagName==="DETAILS", cxOpen:!!cx && cx.open,
      cxAside:cx?(cx.querySelector(".sectaside")||{}).textContent||"":"",
      cxTap:cx?Math.round(cx.querySelector("summary").getBoundingClientRect().height):0,
      deep:rd?[...rd.querySelectorAll(".deepfold")].map(d=>d.open):[]};});
  // open is the only honest reading of a shut <details>: it collapses with
  // content-visibility, so its children still report a size
  say("the connections start folded, with the count on the heading (\""
    + starts.cxAside+"\")", starts.cxFold && starts.cxOpen===false
    && /^\d+ styles?$/.test(starts.cxAside));
  say("  its control clearing the tap floor ("+starts.cxTap+"px)", starts.cxTap>=44);
  // on a style that actually has sources: this one may have none, and a panel with no
  // Go deeper section is not a panel with a shut one
  { const dq=await b.newPage({viewport:{width:1440,height:900}});
    await dq.goto(URL+"#punk"); await arm(dq); await shown(dq,"#chart .n");
    await until(dq,()=>!!document.querySelector("#chart .n.cur")); await settle(dq);
    const deep=await dq.evaluate(()=>{
      const rd=document.querySelector(".sect-read");
      return {groups:rd?[...rd.querySelectorAll(".deepfold")].map(d=>d.open):[],
        aside:rd?(rd.querySelector(".sectaside")||{}).textContent||"":""};});
    say("  while Go deeper starts open ("+deep.groups.length+" groups, "+deep.aside+")",
      deep.groups.length>0 && deep.groups.every(Boolean));
    await dq.close(); }

  // ---------- and it fits the panel it is in ----------
  // Two columns were switched on at a 560px WINDOW, and on a desktop the panel is a
  // 402px column in a 1440px window: it got two columns of a phone's width and the
  // second ran thirty pixels past the panel's own edge. 1fr was the other half of it,
  // since its minimum is min-content and a long name will not shrink past its longest
  // word, so the ellipsis never got a chance.
  for(const [w,h,mob] of [[1440,900,false],[700,950,true],[390,844,true]]){
    const fc=await b.newContext({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob});
    const q=await fc.newPage();
    await q.goto(URL+"#punk"); await arm(q); await shown(q,"#chart .n");
    await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q);
    if(mob) await raise(q);
    await settle(q);
    await q.$eval(".sect-connections",e=>{ e.open=true; });
    await settle(q);
    const fit=await q.evaluate(()=>{
      const pb=document.getElementById("panelBody"), wrap=document.querySelector(".cxwrap");
      const pr=pb.getBoundingClientRect();
      const cs=getComputedStyle(wrap);
      const tracks=cs.gridTemplateColumns.split(" ").map(parseFloat);
      const sum=tracks.reduce((a,b)=>a+b,0)+(tracks.length-1)*(parseFloat(cs.columnGap)||0);
      // The rows are what runs off the edge. The wrapper's own box stays inside the
      // panel and clips them, so measuring the wrapper said everything was fine while a
      // name ended seventy pixels past the panel's edge.
      const rows=[...document.querySelectorAll(".cxgo")];
      return {panel:Math.round(pr.width), cols:tracks.length,
        trackSum:Math.round(sum), wrapW:Math.round(wrap.getBoundingClientRect().width),
        past:rows.filter(e=>e.getBoundingClientRect().right>pr.right+1).length,
        worst:Math.round(Math.max(...rows.map(e=>e.getBoundingClientRect().right))-pr.right)};});
    say("at "+w+"px the connections fit the "+fit.panel+"px panel in "
      + fit.cols+(fit.cols===1?" column":" columns")
      + (fit.past?": "+fit.past+" rows run "+fit.worst+"px past its edge":""),
      fit.past===0);
    say("  with columns that add up to no more than the space for them ("
      + fit.trackSum+" in "+fit.wrapW+"px)", fit.trackSum<=fit.wrapW+1);
    await fc.close();
  }

  // the description sits in a fold under the name rather than in a section further down,
  // and it is shut until asked for: the playlist is what the panel opens on
  const fold=await p.evaluate(()=>{ const d=document.querySelector(".aboutfold");
    if(!d) return null;
    const sm=d.querySelector("summary");
    return {open:d.open, label:sm.textContent.replace(/\s+/g," ").trim(),
      tap:Math.round(sm.getBoundingClientRect().height),
      underName:document.querySelector(".pttl").compareDocumentPosition(d)&4?true:false};});
  say("the description is folded under the name (\""+(fold&&fold.label)+"\")",
    !!fold && fold.open===false && /About this style/.test(fold.label) && fold.underName);
  say("  and its control clears the tap floor ("+(fold&&fold.tap)+"px)", !!fold && fold.tap>=44);
  // the header stays put while the card scrolls under it, so the name, back and the X are
  // reachable at any scroll position. .pcard used to close right after the header, which
  // left the sticky box no room to travel.
  const stuck=await p.evaluate(async()=>{ const pb=document.getElementById("panelBody");
    const row=document.querySelector(".navrow");
    const at=()=>Math.round(row.getBoundingClientRect().top-pb.getBoundingClientRect().top);
    const before=at(); pb.scrollTop=2000; await new Promise(z=>setTimeout(z,250));
    const hit=sel=>{ const e=document.querySelector(sel); if(!e) return false;
      const r=e.getBoundingClientRect();
      const t=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
      return !!(t && (t===e || e.contains(t) || t.closest(sel))); };
    return {before, after:at(), scrolled:pb.scrollTop, inCard:!!row.closest(".pcard"),
      back:hit("#panelBack"), x:hit(".pmin")}; });
  say("the header holds at the top through a "+stuck.scrolled+"px scroll",
    stuck.scrolled>0 && stuck.before===0 && stuck.after===0);
  // This asked for stuck.title too, which the evaluate above has never returned: undefined
  // is not true, and the check printed with no verdict rather than failing. The navrow lost
  // its title in the restructure, so there is none to reach for. Back and the X are what
  // has to stay hittable.
  say("  with back and the X still hittable", stuck.back===true && stuck.x===true);
  say("  because the card wraps the content it sticks within", stuck.inCard);
  // and it is opaque while stuck: the panel is already translucent over the map, so a
  // translucent header on top of it let the card's own content read through the title
  // pscrolled is set by a scroll handler, not by the assignment that caused it, and the
  // background it switches on is a transition, not a swap. Waiting for the class alone
  // caught the colour in flight and read alpha 0.996 about one run in ten: opaque to look
  // at, not opaque to assert on. Wait for the class, then for the paint to stop moving.
  await until(p,()=>document.getElementById("panel").classList.contains("pscrolled"));
  await settle(p);
  const band=await p.evaluate(()=>{ const r=document.querySelector(".navrow");
    const cs=getComputedStyle(r);
    const n=(cs.backgroundColor.match(/[\d.]+/g)||[]);
    return {bg:cs.backgroundColor, alpha:n.length>3?+n[3]:1,
      scrolled:document.getElementById("panel").classList.contains("pscrolled")}; });
  say("  and opaque under the controls while it is ("+band.bg+")", band.scrolled && band.alpha===1);
  // The fold under the name is the one disclosure left on the panel's own head, and its
  // chevron has to turn back when it shuts: closeNav used to reset only .navbtn, which
  // left the old title's chevron upside down after closing.
  const fold2=await p.evaluate(async()=>{
    const d=document.querySelector(".aboutfold"); if(!d) return null;
    const sm=d.querySelector("summary"), cv=sm.querySelector("svg");
    // Wait for the turn to finish rather than for 260ms. The transition is .18s, so on a
    // loaded machine the stopwatch read the chevron mid-rotation and the check failed on
    // a transform 1.5 degrees off the one it wanted.
    const rested=async el=>{ let last=null, same=0;
      for(let i=0;i<60 && same<3;i++){
        await new Promise(z=>requestAnimationFrame(()=>z()));
        const now=getComputedStyle(el).transform;
        same = now===last ? same+1 : 0; last=now; }
      return last; };
    sm.click(); const open=await rested(cv);
    sm.click(); const shut=await rested(cv);
    return {open, shut, isOpen:d.open};});
  say("opening the fold turns its chevron ("+(fold2&&fold2.open)+")",
    !!fold2 && fold2.open!=="none");
  say("  and closing turns it back ("+(fold2&&fold2.shut)+")",
    !!fold2 && fold2.shut==="none" && fold2.isOpen===false);
  // back carries its destination, and gives it up rather than crowding the title
  const bk=await p.$eval("#panelBack",e=>{const l=e.querySelector(".bklbl");
    return {text:l.textContent, ellipsis:getComputedStyle(l).textOverflow};});
  const toMap=await p.$eval("#panelBack",e=>({cls:e.classList.contains("tomap"),
    icon:getComputedStyle(e.querySelector(".bkmap")).display!=="none",
    lbl:getComputedStyle(e.querySelector(".bklbl")).display!=="none", text:e.querySelector(".bklbl").textContent}));
  say("going back to the map shows the glyph, never the words",
    toMap.cls && toMap.icon && !toMap.lbl && toMap.text==="");
  say("and still says where it goes", (await p.$eval("#panelBack",e=>e.getAttribute("title")))==="Back to the map");
  say("the label overflows with an ellipsis when it is a style", bk.ellipsis==="ellipsis");
  // the sticky row must not paint a ground denser than the sheet it sits on: at full
  // opacity over a 74-78% sheet it drew a lighter box across the whole header
  const hdr=await p.evaluate(()=>{const n=getComputedStyle(document.querySelector(".navrow")).backgroundColor;
    return {row:n, scrolled:document.getElementById("panel").classList.contains("pscrolled")};});
  say("the header has no ground of its own at rest ("+hdr.row+")",
    /rgba\(0, 0, 0, 0\)|transparent/.test(hdr.row) || hdr.scrolled);
  await p.screenshot({path:__dirname+"/screens/m-sharettl.png"});

  // the panel regains the space the footer took
  const gained=await p.$eval("#panel",e=>Math.round(e.getBoundingClientRect().height));
  note("open panel height", gained);
  // ---------- About has a URL of its own ----------
  // #about is the one hash that is not a style id, so it has to survive boot and land
  // on the open section rather than on an empty overview.
  const ab=await fresh(b,M);
  await raise(ab);
  await opened(ab);
  await ab.$eval(".ovfold summary",e=>{ if(!e.parentElement.open) e.click(); });
  await settle(ab);
  await ab.click('.ovfold [data-page="about"]');
  await shown(ab,'.ppage[data-p="about"]'); await settle(ab);
  say("About carries a copy control", (await ab.$$('.ppage[data-p="about"] [data-aboutcopy]')).length===1);
  await ab.click('.ppage[data-p="about"] [data-aboutcopy]'); await wrote(ab,0); await settle(ab);
  const copied=await ab.evaluate(()=>window.__copied.slice(-1)[0]||"");
  say("it copies a #about link ("+copied.split("/").pop()+")", /#about$/.test(copied));
  say("and says so", (await ab.$eval('.ppage[data-p="about"] .aboutcopy .lbl',e=>e.textContent))==="Link copied");
  // the install fold sits below it and carries a link of its own, not About's
  // back out of About and into install, which is the row under it
  // back leaves About, so the row under it is reachable again
  await ab.click("#panelBack"); await gone(ab,'.ppage[data-p="about"]'); await settle(ab);
  say("install sits below About", await ab.$eval('[data-page="about"]',e=>
    e.compareDocumentPosition(document.querySelector('[data-page="install"]'))===Node.DOCUMENT_POSITION_FOLLOWING));
  await ab.click('[data-page="install"]'); await shown(ab,'.ppage[data-p="install"]'); await settle(ab);
  note("its heading", await ab.$eval('.ppage[data-p="install"] .bigttl .mn',e=>e.textContent));
  note("a section per platform", (await ab.$$eval('.ppage[data-p="install"] .subh',e=>e.map(x=>x.textContent))).join(" / "));
  say("each one with numbered steps", (await ab.$$('.ppage[data-p="install"] .steps')).length>=4);
  await ab.click('.ppage[data-p="install"] [data-aboutcopy]'); await wrote(ab,1); await settle(ab);
  const icop=await ab.evaluate(()=>window.__copied.slice(-1)[0]||"");
  say("it copies a #install link ("+icop.split("/").pop()+")", /#install$/.test(icop));
  await ab.close();

  // follow that link cold, the way someone receiving it would
  const al=await fresh(b,M,"#about");
  await landed(al,"about"); await settle(al);
  const land=await al.evaluate(()=>{
    const d=document.querySelector('.ppage[data-p="about"]'), body=document.getElementById("panelBody");
    return {page:!!d&&!d.hidden, sheet:document.body.classList.contains("open"),
      scroll:body.scrollTop,
      back:!document.getElementById("panelBack").hidden, hash:location.hash};});
  say("the link opens the sheet", land.sheet);
  say("on the About page", land.page);
  say("scrolled to the top of it", land.scroll===0);
  say("with a way back", land.back);
  say("and keeps the hash", land.hash==="#about");
  say("no errors following it", al._errs.length===0 ? true : al._errs.join(" | "));
  await al.close();

  // and that link lands the same way About's does
  const il=await fresh(b,M,"#install");
  await landed(il,"install"); await settle(il);
  const iland=await il.evaluate(()=>{
    const d=document.querySelector('.ppage[data-p="install"]'), body=document.getElementById("panelBody");
    return {page:!!d&&!d.hidden, about:!!document.querySelector('.ppage[data-p="about"]'),
      sheet:document.body.classList.contains("open"),
      scroll:body.scrollTop,
      hash:location.hash};});
  say("#install opens the sheet", iland.sheet);
  say("on the install page", iland.page);
  say("and About was not pushed with it", iland.about===false);
  say("scrolled to the top of it", iland.scroll===0);
  say("and keeps the hash", iland.hash==="#install");
  say("no errors following it", il._errs.length===0 ? true : il._errs.join(" | "));
  await il.close();

  // the opaque band has to reach the card's edges: inset, it left a channel down each
  // side that the content scrolling underneath showed through
  { const w=await b.newPage({viewport:M});
    await w.goto(URL+"#neoswing"); await arm(w); await shown(w,"#chart .n");
    await until(w,()=>!!document.querySelector("#chart .n.cur")); await settle(w);
    await raise(w); await opened(w);
    await w.evaluate(()=>{document.getElementById("panelBody").scrollTop=260;});
    // the band is the one the scrolled state draws, so wait for the state
    await until(w,()=>document.getElementById("panel").classList.contains("pscrolled")); await settle(w);
    const r=await w.evaluate(()=>{
      const row=document.querySelector(".pcard .navrow"), body=document.getElementById("panelBody");
      const rb=row.getBoundingClientRect(), bb=body.getBoundingClientRect();
      const btn=document.querySelector(".pcard .navleft")||document.querySelector(".pcard #panelBack");
      const x=document.querySelector(".pcard .pmin");
      return {on:document.getElementById("panel").classList.contains("pscrolled"),
        dl:Math.round(rb.left-bb.left), dr:Math.round(bb.right-rb.right),
        btnL:btn?Math.round(btn.getBoundingClientRect().left-bb.left):-1,
        xR:x?Math.round(bb.right-x.getBoundingClientRect().right):-1}; });
    say("the header is stuck after scrolling", r.on);
    say("and its band runs to both edges ("+r.dl+"/"+r.dr+")", r.dl===0 && r.dr===0);
    // the bleed is cancelled on the two absolutely placed controls, which must not move
    say("with the back cluster still inset "+r.btnL+"px", r.btnL===16);
    say("and the close still inset "+r.xR+"px", r.xR===16);
    await w.close(); }

  // The prose was a "What it is" section below the playlist. It is a fold under the name
  // now, so it is the first thing after the title and the last thing in the way: shut by
  // default, and out of the peek entirely, which is for playing.
  { const w=await b.newPage({viewport:M});
    await w.goto(URL+"#blackmetal"); await arm(w); await shown(w,"#chart .n");
    await until(w,()=>!!document.querySelector("#chart .n.cur")); await settle(w);
    // The fold itself stays in the peek, shut: hiding it moved everything under it, and
    // what the peek must never do is shift the button you are reaching for. What has to
    // be true is that the prose is not showing, which being shut already gives.
    // A closed <details> is collapsed by content-visibility rather than display, so its
    // children still report their intrinsic size: the height that means anything is the
    // fold's own, which is its summary and nothing else while it is shut.
    say("the prose is not shown in the peek", await w.evaluate(()=>{
      const d=document.querySelector(".aboutfold");
      const sm=d.querySelector("summary");
      return !d.open
        && Math.abs(d.getBoundingClientRect().height - sm.getBoundingClientRect().height) <= 1;}));
    await raise(w); await opened(w);
    const r=await w.evaluate(()=>{ const s=document.querySelector(".aboutfold");
      s.open=true;
      const tl=document.querySelector(".sect-connections .tally");
      return {shown:getComputedStyle(s).display!=="none",
        head:(s.querySelector("summary span")||{}).textContent||"",
        prose:!!s.querySelector(".note") && !!s.querySelector("a.wk"),
        tally:!!tl,
        beforeShare:!!(s.compareDocumentPosition(document.querySelector("[data-share]"))&4)}; });
    say("and shown when the panel is open", r.shown);
    say("under the control \""+r.head+"\"", r.head==="About this style");
    say("carrying the description and the Wikipedia link", r.prose);
    say("with the tally moved in with the links it counts", r.tally);
    say("and still above the share button", r.beforeShare);
    await w.close(); }

  say("no page errors", p._errs.length===0 ? true : p._errs.join(" | "));
  say("no desktop errors", d._errs.length===0 ? true : d._errs.join(" | "));

  await b.close();
})();
