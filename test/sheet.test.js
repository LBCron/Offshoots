// The mobile sheet's pull-to-minimise gesture.
//
// Two things to know before changing this file.
//
// Synthetic touch events do not drive native scrolling: dispatching touchmove over a
// scrollable element moves no scrollbar. The scrolled-sheet check below therefore moves
// panelBody.scrollTop by hand, in step with the finger, exactly as the browser would.
// Without that the sheet never reaches its top and the check fails against correct code.
//
// #grab ignores a synthetic .click(): it runs its own pointerdown/pointerup logic. Open
// the sheet with a real p.click("#grab"). An evaluate-click leaves the sheet shut, which
// makes every "it closed" assertion pass without testing anything.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
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
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  // one name for "the sheet has stopped moving", used throughout
  const rest=pg=>settle(pg);

  // the map is drawn, not merely loaded: the sheet is measured against it
  await p.goto(URL); await shown(p,"#chart .n"); await rest(p);

  const open=()=>p.evaluate(()=>document.body.classList.contains("open"));
  const setTop=v=>p.evaluate(v=>{document.getElementById("panelBody").scrollTop=v;},v);
  const top=()=>p.evaluate(()=>document.getElementById("panelBody").scrollTop);
  // The glide drives the sheet with an inline height and clears it on transitionend, so
  // an inline height still on the panel means the sheet is still moving. The test asserts
  // further down that nothing is left behind; here it is the signal that the move is over.
  const glided=()=>until(p,()=>!document.getElementById("panel").style.height);
  // The inline height coming off says one transition finished, not that the sheet has
  // come to rest: a swipe can clear it and then settle again onto a detent. Anything that
  // measures the sheet's travel needs the height itself to hold still, so wait for that.
  // The room under the map is reset on a timer 380ms after the sheet moves, well after the
  // transition has ended, and it changes the scroller's range. Anything that measures the
  // map against the sheet has to let it land first, or it measures the old layout.
  const padded=()=>{ return p.evaluate(()=>{window.__pad=null;}).then(()=>
    until(p,()=>{const i=document.getElementById("inner"), pad=i.style.paddingBottom;
      if(window.__pad!==pad){ window.__pad=pad; window.__padAt=performance.now(); return false; }
      return performance.now()-window.__padAt>200;})); };
  const still=()=>until(p,()=>{
    const el=document.getElementById("panel"), st=window.__h||(window.__h={});
    const h=Math.round(el.getBoundingClientRect().height), now=performance.now();
    if(h!==st.h){ st.h=h; st.at=now; return false; }
    return now-(st.at||0)>130;
  });
  // open means the body says so, the glide has cleaned up after itself, and then the page
  // has gone quiet. Waiting for the class alone would measure the sheet mid-flight.
  const ensure=async()=>{ if(!await open()){ await p.click("#grab");
      await until(p,()=>document.body.classList.contains("open")); }
    await glided(); await still(); await rest(p); };
  // a gesture that is meant to shut the sheet is over when the class has gone and the
  // sheet has stopped moving. If the class never goes the cap expires and the check
  // below says so, which is the failure we want to read.
  const shut=async()=>{ await until(p,()=>!document.body.classList.contains("open"));
    await glided(); await still(); await rest(p); };
  const opened=async()=>{ await until(p,()=>document.body.classList.contains("open"));
    await glided(); await still(); await rest(p); };
  // trackScroll mimics what the browser does with the first part of a downward pull
  const swipe=(x,y,dx,dy,steps,trackScroll)=>p.evaluate(async ([x,y,dx,dy,steps,track])=>{
      const el=document.elementFromPoint(x,y)||document.getElementById("panel");
      const pb=document.getElementById("panelBody");
      const mk=(t,cx,cy)=>new TouchEvent(t,{bubbles:true,cancelable:true,
        touches:t==="touchend"?[]:[new Touch({identifier:1,target:el,clientX:cx,clientY:cy})],
        changedTouches:[new Touch({identifier:1,target:el,clientX:cx,clientY:cy})]});
      el.dispatchEvent(mk("touchstart",x,y));
      let prev=y;
      for(let i=1;i<=steps;i++){
        const cx=x+dx*i/steps, cy=y+dy*i/steps;
        if(track && pb.scrollTop>0) pb.scrollTop=Math.max(0,pb.scrollTop-(cy-prev));
        prev=cy;
        el.dispatchEvent(mk("touchmove",cx,cy));
        await new Promise(r=>setTimeout(r,16));
      }
      el.dispatchEvent(mk("touchend",x+dx,y+dy));
    },[x,y,dx,dy,steps||14,!!trackScroll]);

  await ensure();
  say("the sheet is genuinely open to start", await open());
  const R=await p.evaluate(()=>{const r=document.getElementById("panel").getBoundingClientRect(); return [Math.round(r.top),Math.round(r.bottom)];});
  say("open height "+(R[1]-R[0])+"px", R[1]-R[0]>500);
  const mid=Math.round((R[0]+R[1])/2);

  // the ask: anywhere in the card, not just the handle
  for(const [name,y] of [["near the top of the sheet",R[0]+70],["in the middle",mid],["near the bottom",R[1]-60]]){
    await ensure(); await setTop(0); await rest(p);
    await swipe(195,y,0,120); await shut();
    say("a pull down "+name+" closes it", (await open())===false);
  }

  // the case the old handler could not do: it latched "am I at the top" at touchstart,
  // so a pull that began while the body was scrolled could never close the sheet
  await ensure(); await setTop(200); await rest(p);
  say("the body scrolls to "+(await top()), (await top())>0);
  await swipe(195,mid,0,320,26,true); await shut();
  say("one continuous pull from a scrolled sheet closes it", (await open())===false);

  // and the things that must still not close it
  await ensure(); await setTop(0); await rest(p);
  const chip=await p.evaluate(()=>{const c=document.querySelector(".mcirc"); const r=c.getBoundingClientRect(); return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)];});
  // these two must leave the sheet alone, so there is no new state to wait for and
  // settling is the whole condition
  await swipe(chip[0],chip[1],-160,30); await rest(p);
  say("a sideways swipe over a mode circle leaves it open", await open());
  await setTop(0); await rest(p);
  await swipe(195,mid,0,30); await rest(p);
  say("a small downward nudge is not a pull", await open());

  // the band that comes in on scroll draws exactly one hairline. It used to be two: the
  // band was a fixed 44px to cover the buttons that overhang a short row, and a style
  // panel's row is 53px, so each drew its own line nine pixels apart.
  for(const [name,id] of [["the overview",""],["a style","#mathrock"]]){
    const q=await ctx.newPage();
    await q.goto(URL+id); await shown(q,"#chart .n"); await rest(q);
    await q.click("#grab").catch(()=>{});
    await until(q,()=>document.body.classList.contains("open")); await rest(q);
    // each wheel has landed when the card has scrolled further than it had, or when it
    // has nothing further to give: four of them is more than a short card can take, and
    // waiting for movement that cannot happen is waiting for the cap.
    for(let i=0;i<4;i++){ await q.mouse.move(195,600);
      const was=await q.evaluate(()=>document.getElementById("panelBody").scrollTop);
      await q.mouse.wheel(0,110);
      await until(q,v=>{const b=document.getElementById("panelBody");
        return b.scrollTop>v || b.scrollTop+b.clientHeight>=b.scrollHeight-1;},was); }
    // the band is the band the scrolled state draws, so wait for the state
    await until(q,()=>document.getElementById("panel").classList.contains("pscrolled")); await rest(q);
    const hd=await q.evaluate(()=>{
      const n=document.querySelector(".pcard .navrow");
      const cs=getComputedStyle(n), bf=getComputedStyle(n,"::before");
      const row=Math.round(n.getBoundingClientRect().height);
      const lines=[cs.boxShadow,bf.boxShadow].filter(x=>x&&x!=="none").length;
      return {row, lines, band:Math.round(parseFloat(bf.height)||0),
        scrolled:document.getElementById("panel").classList.contains("pscrolled")};});
    say(name+" draws one rule under a "+hd.band+"px band", hd.scrolled && hd.lines===1);
    say("  which covers a row of "+hd.row+"px", hd.band>=hd.row && hd.band>=44);
    await q.close();
  }

  await p.click("#grab"); await shut();
  say("it is minimised again", (await open())===false);
  await swipe(195,R[1]-40,0,-60); await opened();
  say("a swipe up still opens it", await open());

  // The sheet travels between its two heights rather than snapping between them.
  //
  // This used to count distinct heights across requestAnimationFrame samples and want at
  // least five. That measures the machine as much as the sheet: a CSS transition is driven
  // by time, but rAF is driven by whether the browser has a spare frame, so under load the
  // same 340ms animation yields three coalesced samples and a real animation reads as a
  // jump. It passed for months because this box was quiet, then failed once thirteen suites
  // ran before it. A test that reports the load average is not reporting anything.
  //
  // So ask the animation instead of the frame clock. A transition is a real thing the page
  // will tell you about: how long it runs, and where the height is partway through. Reading
  // the height once at the midpoint is exact whether or not a frame was painted, and it is
  // a stronger claim than counting samples — it says the sheet was actually in between,
  // not merely that several numbers were observed.
  const travel=(act)=>p.evaluate(async (act)=>{
    const el=document.getElementById("panel");
    const h=()=>Math.round(el.getBoundingClientRect().height);
    const from=h();
    if(act==="grab"){ const g=document.getElementById("grab");
      g.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientY:0,pointerId:1}));
      g.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,clientY:0,pointerId:1})); }
    // A transition does not exist until the style change has been recalculated, which
    // happens on the next frame, so asking straight after the gesture finds nothing.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const started=performance.now();
    // The panel's own height, by name. Picking the longest running animation on the page
    // meant that whenever something else was animating for longer, the test paused and
    // seeked that instead: the sheet's transition ran on undisturbed, finished inside the
    // two frames below, and the midpoint read came back exactly at the destination. A real
    // animation then failed the check for not animating.
    const anim=document.getAnimations().filter(a=>a.playState==="running"
      && a.effect && a.effect.target===el && a.effect.getKeyframes
      && (a.transitionProperty==="height"
        || a.effect.getKeyframes().some(k=>k.height!==undefined)))[0];
    const dur=anim ? (anim.effect.getTiming().duration||0) : 0;
    if(!dur) return {dur:0, from, mid:from, to:h()};
    // Seek it, do not sample it. Every wall-clock approach here measures the machine:
    // a setTimeout for a quarter of 340ms lands wherever the scheduler feels like, and on
    // a loaded box it lands past the end, reporting a sheet that never moved. A CSS
    // transition is a real animation object, so pause it and move it where we want it.
    // That reads the same on an idle box and a hammered one, which is the whole point.
    anim.pause();
    // A quarter of the way, not half: the sheet eases out hard (cubic-bezier(.32,.72,0,1)),
    // so by the halfway mark it has covered 96% of the distance and sits a pixel off its
    // destination. A quarter in, any easing still leaves it plainly in between.
    anim.currentTime = dur/4;
    // Two frames, not one. A seek is committed on the next frame, but the height read back
    // on that same frame can still be the one already applied: once in a long run this read
    // came back exactly at the destination and the check called a real animation a snap.
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
    const mid=h();
    // then let it finish, so the sheet is at rest for whatever the suite checks next
    anim.play();
    await Promise.race([
      anim.finished.catch(()=>{}),
      new Promise(r=>setTimeout(r, dur+600))
    ]);
    await new Promise(r=>requestAnimationFrame(()=>r()));
    return {dur:Math.round(dur), from, mid, to:h()};
  },act);
  // partway means strictly inside, with room to spare: a value one pixel off an endpoint
  // would pass a naive between-test while still being a snap.
  const between=t=>{ const lo=Math.min(t.from,t.to), hi=Math.max(t.from,t.to);
    return t.dur>0 && t.mid>lo+8 && t.mid<hi-8; };
  await ensure();
  const closing=await travel("grab");
  say("closing is partway down a quarter of the way through ("+closing.mid+" between "
    +closing.from+" and "+closing.to+", over "+closing.dur+"ms)", between(closing));
  say("it is minimised at the end", (await open())===false);
  const opening=await travel("grab");
  say("opening is partway up a quarter of the way through ("+opening.mid+" between "
    +opening.from+" and "+opening.to+", over "+opening.dur+"ms)", between(opening));
  say("it is open at the end", await open());
  const left=await p.evaluate(()=>{const s=document.getElementById("panel").style; return s.height+"|"+s.maxHeight;});
  say("no inline height or cap left behind ("+left+")", left==="|");
  // reversing part way must not strand it at an in-between height
  // part way through means a measured part of the way, not a stopwatch reading 110ms. The
  // close above already told us where the sheet ends up, so reverse once it has covered a
  // third of the distance between the two heights.
  const third=(R[1]-R[0])-((R[1]-R[0])-closing.to)/3;
  await p.click("#grab");
  await until(p,h=>document.getElementById("panel").getBoundingClientRect().height<h,third);
  await p.click("#grab"); await opened();
  const back=await p.evaluate(()=>Math.round(document.getElementById("panel").getBoundingClientRect().height));
  say("reversed mid-animation, it settles at "+back+"px", Math.abs(back-(R[1]-R[0]))<=2);

  // dragging the card's header, which is where a thumb lands on an open sheet.
  // pause matters: a quick flick down closes whatever the distance, so a short drag meant
  // to spring back has to be slow enough not to read as one. The pause between steps is
  // therefore part of the gesture and not a wait for anything: it is the one sleep in this
  // file that has to stay a sleep.
  const hgt=()=>p.evaluate(()=>Math.round(document.getElementById("panel").getBoundingClientRect().height));
  const drag=async(x,y,dy,steps,release=true,pause=0)=>{
    await p.mouse.move(x,y); await p.mouse.down();
    const seen=[];
    for(let i=1;i<=steps;i++){ await p.mouse.move(x,y+dy*i/steps); seen.push(await hgt()); if(pause) await p.waitForTimeout(pause); }
    if(release) await p.mouse.up();
    return seen; };
  // A flick is a claim about speed, and Playwright's mouse cannot make one: every move is
  // a round-trip, so under load four moves take half a second and the app is right to read
  // that as a slow drag. The gesture goes inside the page instead, where the moves land
  // 8ms apart whatever else the machine is doing. Same events the real thing sends.
  const flick=(x,y,dy,steps)=>p.evaluate(async ([x,y,dy,steps])=>{
    const el=document.elementFromPoint(x,y)||document.querySelector(".pcard .navrow");
    const ev=(t,cy)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
      pointerId:1,pointerType:"touch",isPrimary:true,clientX:x,clientY:cy,buttons:t==="pointerup"?0:1}));
    ev("pointerdown",y);
    for(let i=1;i<=steps;i++){
      await new Promise(r=>setTimeout(r,8));
      ev("pointermove",y+dy*i/steps);
    }
    ev("pointerup",y+dy);
  },[x,y,dy,steps]);
  await ensure();
  const hd=await p.evaluate(()=>{const r=document.querySelector(".pcard .navrow").getBoundingClientRect();
    return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)];});
  const follow=await drag(hd[0],hd[1],170,8,false);
  say("the sheet follows the finger from the header", new Set(follow).size>=5);
  await p.mouse.up(); await shut();
  say("released past halfway it minimises", (await open())===false);
  await ensure();
  // the spring back never leaves the open class, so there is no state change to wait
  // for — only the snap finishing
  await drag(hd[0],hd[1],40,5,true,90); await rest(p);
  say("a short slow drag springs back open", await open());
  await flick(hd[0],hd[1],45,4); await shut();
  say("a quick flick down closes it even at 45px", (await open())===false);
  // the header carries no control at all now, so the whole row is drag and nothing else.
  // Share is a button at the foot of the card, out of the handle's way entirely.
  await ensure();
  await p.evaluate(()=>{window.__copied=[];navigator.clipboard.writeText=async t=>{window.__copied.push(t)};});
  // the X sits in the drag handle, so the same tap-versus-drag rule applies to it
  say("the handle carries the minimise control",
    (await p.$$eval(".ovcard .navrow button",e=>e.filter(b=>!b.hidden).length))===1);
  await p.click(".ovcard .pmin");
  await until(p,()=>document.body.classList.contains("sheetgone")); await rest(p);
  // it closes rather than minimises: the sheet goes, the map is whole, and the pull tab
  // at the bottom of the screen is what brings it back
  const away=await p.evaluate(()=>({gone:document.body.classList.contains("sheetgone"),
    panel:getComputedStyle(document.getElementById("panel")).display,
    pull:(()=>{const t=document.getElementById("sheetpull");
      return t?getComputedStyle(t).display:"missing";})(),
    kept:location.hash}));
  say("  tapping it puts the sheet away", away.gone && away.panel==="none");
  // and from the peek too: tap-anywhere-to-open was reading the tap first, so closing a
  // minimised sheet opened it instead
  await p.click("#sheetpull");
  await until(p,()=>!document.body.classList.contains("sheetgone")); await rest(p);
  if(await open()){ await p.click("#grab"); await shut(); }
  say("  from the peek, the same", (await open())===false);
  await p.click(".ovcard .pmin");
  await until(p,()=>document.body.classList.contains("sheetgone")); await rest(p);
  say("  it closes rather than opening", await p.evaluate(()=>
    document.body.classList.contains("sheetgone") && !document.body.classList.contains("open")));
  say("  leaving a pull tab to bring it back ("+away.pull+")", away.pull!=="none" && away.pull!=="missing");
  await p.click("#sheetpull");
  await until(p,()=>!document.body.classList.contains("sheetgone")); await rest(p);
  say("  which does", await p.evaluate(()=>!document.body.classList.contains("sheetgone")));
  await ensure();
  await p.$eval("#panelBody .shbtn",e=>e.scrollIntoView({block:"center"})); await rest(p);
  // the copy is a promise, so wait for the write rather than for long enough
  await p.click("#panelBody .shbtn");
  await until(p,()=>window.__copied.length===1); await rest(p);
  say("the row at the foot shares", await p.evaluate(()=>window.__copied.length===1));
  say("and the sheet stayed open", await open());
  // the button says "Link copied" for 1600ms and then puts its own label back, which
  // relays out the card under it. Measure the title after that, not during.
  await until(p,()=>{const b=document.querySelector("#panel [data-share]");
    return !b || !b.classList.contains("done");});
  await rest(p);
  // the title is inert: it drags and nothing else
  await p.evaluate(()=>{window.__copied=[];});
  // the share button above left the card scrolled, which puts the title off screen: click
  // where it is NOW and the tap lands on the map behind, which selects a style and takes
  // the overview card away. Back to the top first, then measure.
  await p.evaluate(()=>{document.getElementById("panelBody").scrollTop=0;}); await rest(p);
  const ttl=await p.evaluate(()=>{const r=document.querySelector(".ovcard .bigttl").getBoundingClientRect(); return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)];});
  // a tap that is meant to do nothing has nothing to wait for but the page going quiet
  await p.mouse.click(ttl[0],ttl[1]); await rest(p);
  say("tapping the title shares nothing", await p.evaluate(()=>window.__copied.length===0));
  // the row is 13px tall with nothing in it, so the title under it is the grip
  await ensure();
  // the card is still scrolled to the share button from the step above
  await p.evaluate(()=>{document.getElementById("panelBody").scrollTop=0;}); await rest(p);
  const hd2=await p.evaluate(()=>{const r=document.querySelector(".ovcard .bigttl").getBoundingClientRect();
    return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2),Math.round(r.height)];});
  say("the title is a "+hd2[2]+"px grip, which the empty row is not", hd2[2]>=34);
  await drag(hd2[0],hd2[1],170,8); await shut();
  say("dragging it shuts the sheet", (await open())===false);
  // the drag ceiling has to match the open height, or dragging up pulls the sheet down
  await ensure();
  const up=await drag(hd[0],hd[1],-60,5,false);
  say("dragging up does not shrink it", Math.min(...up)>=(R[1]-R[0])-2);
  await p.mouse.up(); await rest(p);

  // nothing in the card may sit at a different offset in one state than the other, or the
  // contents slide under the finger as the sheet moves
  const offsets=()=>p.evaluate(()=>{const pa=document.getElementById("panel").getBoundingClientRect();
    const o={}; [".pcard",".ovcard .navttl",".sect-browse",".sect"].forEach(s=>{const e=document.querySelector(s);
      if(e) o[s]=+(e.getBoundingClientRect().top-pa.top).toFixed(2);}); return o;});
  await p.goto(URL); await shown(p,"#chart .n"); await rest(p);
  const shut0=await offsets();
  await p.click("#grab"); await opened();
  const wide=await offsets();
  const moved=Object.keys(shut0).filter(k=>Math.abs(shut0[k]-wide[k])>0.5);
  say("the card holds its position in both states"+(moved.length?" ("+moved.map(k=>k+" "+shut0[k]+" -> "+wide[k]).join(", ")+")":""), moved.length===0);

  // the sheet floats over the map rather than docking under it, which is what gives the
  // frosted ground something to blur. The map therefore keeps its height, and two things
  // that used to come free from that resize now have to be maintained by hand.
  await p.goto(URL); await shown(p,"#chart .n"); await rest(p);
  const geo=()=>p.evaluate(()=>{const pan=document.getElementById("panel").getBoundingClientRect();
    const s=document.getElementById("scroller").getBoundingClientRect();
    return {overlap:Math.round(Math.min(s.bottom,pan.bottom)-Math.max(s.top,pan.top)), mapH:Math.round(s.height)};});
  const g1=await geo();
  say("the map runs behind the sheet ("+g1.overlap+"px)", g1.overlap>100);
  const frost=await p.evaluate(()=>{const cs=getComputedStyle(document.getElementById("panel"));
    return [cs.backdropFilter||cs.webkitBackdropFilter||"none", cs.backgroundColor];});
  say("its ground is frosted: "+frost[0], /blur/.test(frost[0]));
  say("and translucent: "+frost[1], /rgba|\/ 0\./.test(frost[1]));
  await p.click("#grab"); await opened();
  const g2=await geo();
  say("opening no longer resizes the map ("+g1.mapH+" -> "+g2.mapH+")", g1.mapH===g2.mapH);
  // a tinted style panel frosts over its own family ground, not the root's.
  // On a fresh page: a hash change on a page already loaded is a same-document
  // navigation, so the app does not re-select and the panel never tints.
  const tp=await ctx.newPage();
  await tp.goto(URL+"#disco");   // the tint is set from the selection, so the page is ready when a style is current
  await shown(tp,"#chart .n");
  await until(tp,()=>!!document.querySelector("#chart .n.cur")); await rest(tp);
  const tint=await tp.evaluate(()=>{const el=document.getElementById("panel"), cs=getComputedStyle(el);
    return {tinted:el.classList.contains("tinted"), bg:cs.backgroundColor,
      bf:cs.backdropFilter||cs.webkitBackdropFilter||"none",
      ground:el.style.getPropertyValue("--tint").trim()};});   // set inline, per selection
  say("the style panel is tinted ("+tint.ground+")", tint.tinted && !!tint.ground);
  say("and frosted over it", /blur/.test(tint.bf) && /rgba|\/ 0\./.test(tint.bg));
  await tp.close();
  // 1. a style chosen with the sheet open must land in the band still showing
  await p.click('[data-mode="winddown"]'); await rest(p);
  // choosing a pick selects a style and scrolls the map to it
  await p.click(".picks .pick");
  await until(p,()=>!!document.querySelector("#chart .n.cur")); await rest(p); await padded();
  const cur=await p.evaluate(()=>{const n=document.querySelector("#chart .n.cur");
    if(!n) return null; const r=n.getBoundingClientRect(), pan=document.getElementById("panel").getBoundingClientRect();
    return {gap:Math.round(pan.top-r.bottom), top:Math.round(r.top)};});
  say("the chosen style sits "+(cur?cur.gap:"?")+"px clear of the sheet", !!cur && cur.gap>0 && cur.top>0);
  // 2. the end of the map must come out from under it, in every state the sheet can be
  // in. The clearance has to beat the sheet's 30px shadow too, or the last lane sits in
  // the shadow and reads as stuck underneath however far you scroll.
  const SHADOW=30;
  const bottomGap=async()=>{
    // the room under the map is reset on a timer after the sheet moves, and shrinking it
    // shrinks the scroll range: scroll to the end before that lands and the browser clamps
    // the scroll back down, pushing the last lane under the sheet again. So wait for the
    // padding to hold still, and only then scroll to the end.
    await padded();
    await p.evaluate(()=>{const s=document.getElementById("scroller"); s.scrollTop=s.scrollHeight;});
    await rest(p);
    return p.evaluate(()=>{const pan=document.getElementById("panel").getBoundingClientRect();
      const band=[...document.querySelectorAll("#chart .band")].map(x=>x.getBoundingClientRect()).sort((a,b)=>b.bottom-a.bottom)[0];
      const node=[...document.querySelectorAll("#chart .n")].map(x=>x.getBoundingClientRect()).sort((a,b)=>b.bottom-a.bottom)[0];
      return {lane:Math.round(pan.top-band.bottom), style:Math.round(pan.top-node.bottom)};});
  };
  const open1=await bottomGap();
  say("with the sheet open, the last lane clears it by "+open1.lane+"px", open1.lane>SHADOW);
  await p.click("#grab"); await shut();
  const shut1=await bottomGap();
  say("minimised, the same ("+shut1.lane+"px lane, "+shut1.style+"px style)", shut1.lane>SHADOW && shut1.style>SHADOW);
  // and at a height the user dragged it to, which no setOpen reports
  await p.mouse.move(195,R[1]-160); await p.mouse.down();
  // the 40ms between steps is the gesture, not a wait: dragged this slowly it reads as
  // a drag rather than a flick, and the sheet stays where it is put
  for(let i=1;i<=8;i++){ await p.mouse.move(195,R[1]-160-i*9); await p.waitForTimeout(40); }
  await p.mouse.up(); await rest(p);
  const drag1=await bottomGap();
  say("and at a dragged height ("+drag1.lane+"px)", drag1.lane>SHADOW);

  // the peek used to hide the lineage row, so everything under it sat higher than it did
  // once the sheet opened: the playlist jumped down under whatever was reaching for it
  { const q=await ctx.newPage();
    await q.goto(URL+"#punk"); await shown(q,"#chart .n");
    await until(q,()=>!!document.querySelector("#chart .n.cur")); await rest(q);
    const where=()=>q.evaluate(()=>{ const pa=document.getElementById("panel").getBoundingClientRect();
      const o={}; [".sthead",".sect-listen",".startrow",".plbtn"].forEach(s=>{ const e=document.querySelector(s);
        if(e) o[s]=Math.round(e.getBoundingClientRect().top-pa.top); }); return o; });
    const peek=await where();
    await q.click("#grab").catch(()=>{});
    await until(q,()=>document.body.classList.contains("open")); await rest(q);
    const open=await where();
    const moved=Object.keys(peek).filter(k=>Math.abs(peek[k]-open[k])>1);
    say("the play button is at "+peek[".plbtn"]+"px in the peek and "+open[".plbtn"]+"px open",
      peek[".plbtn"]===open[".plbtn"]);
    say("  and nothing else shifts either"+(moved.length?" ("+moved.join(", ")+")":""), moved.length===0);
    say("  because the peek clips the card rather than hiding parts of it",
      await q.evaluate(()=>[...document.querySelectorAll(".more > *")]
        .filter(e=>getComputedStyle(e).display==="none")
        .every(e=>/tally|shbtn|note|fold|sect-(artists|across|connections|read|about)/.test(e.className))));
    await q.close(); }

  say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  // ---------- a finger may start anywhere ----------
  // touch-action:pan-x on the circle rows did not mean "this row pans sideways". It means
  // "nothing else may pan from here", so a thumb landing on a circle could not scroll the
  // panel at all, and the circles are deliberately the biggest targets on the card. It was
  // reported as the panel being extremely hard to scroll, worst over a tap target.
  //
  // Nothing in the suite could see it: every other check drives the scroller directly or
  // uses synthetic touch events, and neither goes near the compositor, which is where this
  // is decided. This one goes through CDP, which is the real input path.
  { const tc=await b.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const q=await tc.newPage();
    await q.addInitScript(()=>{ try{ localStorage.setItem("offshoots.seen","1");
      localStorage.setItem("offshoots.tip","1"); }catch(e){} });
    const cdp=await tc.newCDPSession(q);
    const dragUp=async(x,y)=>{
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
      for(let i=1;i<=14;i++){
        await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y-170*i/14}]});
        await new Promise(r=>setTimeout(r,10)); }
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await new Promise(r=>setTimeout(r,600)); };

    for(const [sel,what] of [[".mcirc","a mood circle"],[".listrow","a list row"]]){
      await q.goto(URL); await shown(q,"#chart .n");
      await q.click("#grab").catch(()=>{});
      await q.waitForSelector(sel,{state:"attached",timeout:8000}).catch(()=>{});
      await settle(q);
      // the first one that is actually in the sheet, not the first in the document. The
      // panel was restructured under this check and the first list row moved below the
      // fold, so the drag started on the map and the panel rightly did not move.
      const at=await q.evaluate(s=>{ const pb=document.getElementById("panelBody");
        const box=pb.getBoundingClientRect();
        for(const e of document.querySelectorAll(s)){
          const r=e.getBoundingClientRect();
          if(r.height>0 && r.top>=box.top+8 && r.bottom<=box.bottom-8)
            return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};
        }
        return null;},sel);
      const room=await q.evaluate(()=>{ const pb=document.getElementById("panelBody");
        return pb.scrollHeight-pb.clientHeight;});
      if(!at || room<40){ say("a drag up from "+what+" scrolls the panel", "no room to test"); continue; }
      const was=await q.evaluate(()=>document.getElementById("panelBody").scrollTop);
      await dragUp(at.x,at.y);
      const now=await q.evaluate(()=>document.getElementById("panelBody").scrollTop);
      say("a drag up from "+what+" scrolls the panel ("+(now-was)+" of "+room+"px)", now-was>20);
    }

    // ---- and it scrolls smoothly, with no frame standing out near the top ----
    // The header hands the title over about twenty pixels down. That handover set a class
    // on <body>, and a class on the root of a document holding a 4,300-node map repainted
    // the map: one 56ms frame, in the one place every scroll passes through, which is why
    // it read as a hitch rather than as slowness. The classes live on the panel now.
    { await q.goto(URL); await shown(q,"#chart .n");
      await q.click("#grab").catch(()=>{});
      await until(q,()=>document.body.classList.contains("open")); await settle(q);
      const fr=await q.evaluate(async ()=>{
        const pb=document.getElementById("panelBody");
        const pass=async()=>{ pb.scrollTop=0;
          await new Promise(r=>setTimeout(r,300));
          const f=[]; let last=performance.now();
          for(let t=0;t<=240;t+=4){ pb.scrollTop=t;
            await new Promise(r=>requestAnimationFrame(r));
            const n=performance.now(); f.push(n-last); last=n; }
          f.sort((a,b)=>a-b);
          return {worst:f[f.length-1], mid:f[f.length>>1]}; };
        const runs=[]; for(let i=0;i<5;i++) runs.push(await pass());
        runs.sort((a,b)=>a.worst-b.worst);
        const m=runs[2];                       // the median run, so one stutter is not the verdict
        return {worst:+m.worst.toFixed(1), mid:+m.mid.toFixed(1)};
      });
      say("no frame in the first 240px costs more than twice a median one ("
        + fr.worst+"ms worst, "+fr.mid+"ms median)", fr.worst < fr.mid*2);
      // the old spike was 3.3x the median; anything near that is the map being repainted
      say("  and the handover itself is not the expensive frame",
        fr.worst < fr.mid+20); }

    // and sideways from the same circle still moves the row, which is what pan-x was for
    await q.goto(URL); await shown(q,"#chart .n");
    await q.click("#grab").catch(()=>{});
    await q.waitForSelector(".mcirc",{state:"attached",timeout:8000}).catch(()=>{});
    await settle(q);
    const cb=await q.evaluate(()=>{ const r=document.querySelector(".mcirc").getBoundingClientRect();
      return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)};});
    const l0=await q.evaluate(()=>document.querySelector(".mrow").scrollLeft);
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:cb.x,y:cb.y}]});
    for(let i=1;i<=14;i++){
      await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:cb.x-180*i/14,y:cb.y}]});
      await new Promise(r=>setTimeout(r,10)); }
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await new Promise(r=>setTimeout(r,600));
    const l1=await q.evaluate(()=>document.querySelector(".mrow").scrollLeft);
    say("  and a drag sideways still moves the row ("+(l1-l0)+"px)", l1-l0>60);
    await tc.close(); }

  // ---------- the panel scrolls one way ----------
  // A few pixels of horizontal overflow turns the panel into a scroller on both axes. On
  // a phone that means a visible scrollbar and a vertical drag that keeps getting claimed
  // sideways, which is how it was reported: "extremely hard to scroll". It was seven
  // pixels of chevron at 320px. Checked at every width the map is likely to meet, since
  // the one that broke was the narrowest and nothing else was looking there.
  for(const w of [320,360,375,390,414,430]){
    const nc=await b.newContext({viewport:{width:w,height:844},isMobile:true,hasTouch:true});
    const q=await nc.newPage();
    await q.addInitScript(()=>{ try{ localStorage.setItem("offshoots.seen","1");
      localStorage.setItem("offshoots.tip","1"); }catch(e){} });
    await q.goto(URL); await shown(q,"#chart .n");
    await q.click("#grab").catch(()=>{});
    await q.waitForSelector(".sect-modes",{state:"attached",timeout:8000}).catch(()=>{});
    await settle(q);
    const r=await q.evaluate(()=>{
      const pb=document.getElementById("panelBody"), mrow=document.querySelector(".mrow");
      return {over:pb.scrollWidth-pb.clientWidth, canY:pb.scrollHeight>pb.clientHeight,
        row:mrow ? mrow.scrollWidth>mrow.clientWidth : false};});
    say("at "+w+"px the panel scrolls down and not sideways ("+r.over+"px over)",
      r.over===0 && r.canY);
    say("  while the ways in still swipe", r.row);
    // The same question on a style, which is the longer and denser of the two and the one
    // that actually broke: centring the body with an auto margin made it a shrink-to-fit
    // flex item, so it sized to its widest line and hung off the left of the screen. The
    // overview was narrow enough to hide that.
    await q.goto(URL+"#disco"); await shown(q,"#chart .n");
    await q.click("#grab").catch(()=>{});
    await settle(q); await q.waitForTimeout(300);
    const s=await q.evaluate(()=>{
      const pb=document.getElementById("panelBody"), c=document.querySelector(".pcard");
      const pr=pb.getBoundingClientRect(), cr=c?c.getBoundingClientRect():null;
      return {over:pb.scrollWidth-pb.clientWidth, w:Math.round(pr.width),
        left:Math.round(pr.left), card:cr?Math.round(cr.left):null,
        vw:innerWidth};});
    say("  and a style panel stays inside the screen ("+s.w+"px at x"+s.left+")",
      s.over===0 && s.left>=0 && s.w<=s.vw && (s.card===null || s.card>=0));
    await nc.close();
  }

  // ---------- the content column sits in the middle of the sheet ----------
  // #panelBody is capped at 720px so a line of prose never runs the width of a laptop.
  // Below 720 the sheet is narrower than the cap and at 900 it becomes a 402px sidebar,
  // so the cap only bites in the band between — and there it was left-aligned, leaving up
  // to 195px of empty sheet down the right while the handle and the background spanned
  // the whole window. Reported as the panel and its contents having different widths.
  for(const w of [700,760,820,880,899,900,1100]){
    const nc=await b.newContext({viewport:{width:w,height:900}});
    const q=await nc.newPage();
    await q.addInitScript(()=>{ try{ localStorage.setItem("offshoots.seen","1");
      localStorage.setItem("offshoots.tip","1"); }catch(e){} });
    await q.goto(URL+"#install"); await shown(q,"#chart .n"); await settle(q);
    await q.waitForTimeout(500);
    const r=await q.evaluate(()=>{
      const box=s=>{const e=document.querySelector(s); if(!e) return null;
        const t=e.getBoundingClientRect();
        return {l:Math.round(t.left), r:Math.round(t.right), w:Math.round(t.width)};};
      return {panel:box("#panel"), body:box("#panelBody")};});
    if(!r.panel || !r.body){ say("at "+w+"px the content is centred in the sheet","no panel"); }
    else {
      const left=r.body.l-r.panel.l, right=r.panel.r-r.body.r;
      // a pixel either way is rounding on an odd width, not a layout that is off
      say("at "+w+"px the content is centred in the sheet ("+left+" / "+right+")",
        Math.abs(left-right)<=1);
      say("  and never wider than the measure cap ("+r.body.w+"px)", r.body.w<=720);
    }
    await nc.close();
  }

  // ---- the title handover ----
  // Explore's name is a big heading in the sheet until it scrolls under the bar, at which
  // point the bar takes it over. Keyed on the heading's bottom, there was a band of about
  // thirty pixels of scroll where the heading was behind the bar and the bar had not taken
  // it yet: a blank white header with a close button and no name, most visible scrolling
  // back up. A name is either in the heading or in the bar at every scroll position, and
  // there is no height at which it is in neither.
  { const hc=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const h=await hc.newPage();
    await h.goto(URL); await shown(h,"#chart .n"); await settle(h);
    await until(h,()=>document.body.classList.contains("open")); await settle(h);
    const look=async t=>{ await h.evaluate(v=>{document.getElementById("panelBody").scrollTop=v;},t);
      // past the crossfade, so this reads where it lands and not where it set off from
      await h.waitForTimeout(260);
      return h.evaluate(()=>{
        const body=document.getElementById("panelBody");
        const nav=body.querySelector(".pcard .navrow").getBoundingClientRect();
        const big=body.querySelector(".ppage:not([hidden]) .bigttl, .ovcard > .bigttl");
        const B=big?big.getBoundingClientRect():null;
        const slot=document.querySelector(".navttl.ovttl");
        // readable in the bar, and readable below it: not merely present in the DOM
        return {bar:+getComputedStyle(slot).opacity>0.5,
          head: !!B && B.bottom>nav.bottom+10,
          at:Math.round(body.scrollTop)};});};
    const blank=[];
    for(let t=0;t<=160;t+=8){ const r=await look(t); if(!r.bar && !r.head) blank.push(r.at); }
    say("the name is never in neither the heading nor the bar (0 to 160px)",
      blank.length===0 ? true : "blank at "+blank.join(", "));
    // and going back up it comes back, rather than sticking in the bar
    const bottomUp=await look(160), backTop=await look(0);
    say("  the bar holds it when scrolled down, the heading when back at the top",
      bottomUp.bar===true && backTop.head===true && backTop.bar===false);
    await hc.close(); }

  await b.close();
})();
