// The welcome.
//
// A map of 461 dots joined by lines does not explain itself, and the playlists, which are
// the reason to stay, are two taps down. So a new visitor gets one card: what the thing
// is, that it can be heard, and one way in.
//
// The rules it has to keep: once per browser and never again; never over a shared link,
// because somebody following one came for a style rather than an explanation; the numbers
// read off the map rather than typed into the copy; and every way out works, since a
// modal that traps you is worse than no modal.
//
// This suite is the one that does NOT mark it seen first.
const {chromium}=require("playwright");
const {settle,until,gone,shown,arm,raise,lower}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const M={viewport:{width:393,height:852,isMobile:true,hasTouch:true},deviceScaleFactor:2};
const D={viewport:{width:1280,height:900}};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
const up=p=>p.evaluate(()=>!document.getElementById("hello").hidden);
// boot runs once the fonts are ready and opens the card 260ms after that, so the card is
// either up by the time this returns or it was never coming. The checks here are as often
// about the card NOT appearing as about it appearing, and both need the same window to
// have passed.
const booted=q=>until(q,()=>{
  if(document.fonts.status!=="loaded") return false;
  if(!window.__fontsAt) window.__fontsAt=performance.now();
  const w=document.getElementById("hello");
  return !!w && (!w.hidden || performance.now()-window.__fontsAt>400);});
// one name for "the page has loaded, boot has had its say, and nothing is moving"
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await booted(q); await settle(q); };
// the picker writes the app's own setting, and marks the button it wrote
const picked=(q,svc)=>until(q,s=>{const b=document.querySelector('#hello [data-svc="'+s+'"]');
  return !!b && b.getAttribute("aria-checked")==="true";},svc);
// the card is two steps, so most checks start by walking to the one they are about.
// Clicking the Continue that belongs to the step showing, not a global id, because the
// buttons are per step and a stale id would silently click nothing.
const atStep=(q,n)=>until(q,k=>{const t=document.querySelector('.hstep[data-step="'+k+'"]');
  return !!t && !t.hidden;},String(n));
const nowStep=q=>q.evaluate(()=>{
  const t=[...document.querySelectorAll(".hstep")].find(x=>!x.hidden);
  return t ? +t.dataset.step : 0;});
// walks from wherever the card actually is, forwards or back. Walking from step one
// regardless meant clicking a button on a hidden section and waiting out the timeout.
const toStep=async(q,n)=>{
  let at=await nowStep(q), guard=0;
  while(at!==n && guard++<8){
    const to = at<n ? at+1 : at-1;
    await q.click('.hstep[data-step="'+at+'"] [data-to="'+to+'"]');
    await atStep(q,to); at=to;
  }
  await settle(q); };

(async()=>{
  const b=await chromium.launch();

  // ---------- a new visitor ----------
  let ctx=await b.newContext(M); let p=await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL); await ready(p);
  say("a new visitor gets the card", await up(p));

  const card=await p.evaluate(()=>{
    const c=document.getElementById("hellocard");
    const r=c.getBoundingClientRect(), body=document.body.getBoundingClientRect();
    return {title:(document.getElementById("hellottl")||{}).textContent,
      styles:(document.getElementById("hellon")||{}).textContent,
      lists:(document.getElementById("hellop")||{}).textContent,
      points:document.querySelectorAll(".hellolist li").length,
      icons:document.querySelectorAll(".hellolist .helloi svg").length,
      appicon:!!(document.getElementById("helloicon")||{}).getAttribute("src"),
      modal:c.getAttribute("role")==="dialog" && c.getAttribute("aria-modal")==="true"
        && !!c.getAttribute("aria-labelledby"),
      fits:r.height<=body.height && r.top>=-1,
      scrolls:document.documentElement.scrollWidth<=innerWidth+1};});
  say("  titled "+JSON.stringify(card.title), (card.title||"").length>6);
  say("  with "+card.points+" points, each with a mark", card.points>=2 && card.icons===card.points);
  say("  and the app's own icon on it", card.appicon);
  say("  announced as a dialog", card.modal);
  say("  fitting the screen without pushing it sideways", card.fits && card.scrolls);

  // the numbers are the map's, not a sentence somebody has to remember to update
  const real=await p.evaluate(()=>({n:String(DATA.length),
    play:String(DATA.filter(r=>PLAY[r[0]]||SPLAY[r[0]]).length)}));
  say("  "+card.styles+" styles, read off the map", card.styles===real.n);
  say("  "+card.lists+" playlists, counted not claimed", card.lists===real.play);

  // ---------- where you listen ----------
  // Asked once, here, because the answer changes every playlist link in the app and the
  // alternative is finding the menu on a style panel after the first wrong link opens.
  // It sets the app's own `svc`, not a second setting of its own, and it does not dismiss
  // the card: choosing where you listen is not choosing to start.
  await toStep(p,2);
  const svc=await p.evaluate(()=>({
    opts:[...document.querySelectorAll("#hello [data-svc]")].map(b=>b.dataset.svc),
    labels:[...document.querySelectorAll("#hello [data-svc]")].map(b=>b.textContent.trim()),
    on:[...document.querySelectorAll("#hello [data-svc]")]
        .filter(b=>b.getAttribute("aria-checked")==="true").map(b=>b.dataset.svc),
    group:!!document.querySelector("#hello [role=radiogroup][aria-labelledby]"),
    tall:[...document.querySelectorAll("#hello [data-svc]")]
        .every(b=>b.getBoundingClientRect().height>=44)}));
  say("the card asks where you listen ("+svc.labels.join(", ")+")", svc.opts.length===3);
  say("  with the one already stored marked, not a blank set of three",
    svc.on.length===1 && svc.on[0]==="apple");
  say("  as a labelled group of real tap targets", svc.group && svc.tall);
  // a title tooltip does nothing on a phone, so the one place a touch visitor is told the
  // choice sticks is here, in the step that asks for it
  say("  and saying plainly that the choice is kept", await p.evaluate(()=>
    /kept on this device/i.test((document.querySelector(".hnote")||{}).textContent||"")));

  await p.click('#hello [data-svc="spotify"]'); await picked(p,"spotify"); await settle(p);
  const after=await p.evaluate(()=>({
    on:[...document.querySelectorAll("#hello [data-svc]")]
        .filter(b=>b.getAttribute("aria-checked")==="true").map(b=>b.dataset.svc),
    stored:(()=>{try{return localStorage.getItem("svc")}catch(e){return null}})(),
    up:!document.getElementById("hello").hidden}));
  say("picking one marks it and stores it as the app's own setting",
    after.on.join()==="spotify" && after.stored==="spotify");
  say("  and leaves the card open", after.up);
  // put it back, so the rest of this suite sees the state it was written against
  await p.click('#hello [data-svc="apple"]'); await picked(p,"apple"); await settle(p);

  // ---------- it goes away, and stays away ----------
  await toStep(p,2);
  await p.click("[data-hstart]"); await gone(p,"#hello"); await settle(p);
  say("Start exploring dismisses it", (await up(p))===false);
  say("  and the map is usable underneath",
    (await p.$$eval("#chart .n",e=>e.length))>400);
  await p.reload(); await ready(p);
  say("  and it does not come back", (await up(p))===false);
  say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await ctx.close();

  // ---------- the other ways out ----------
  for(const [name,act] of [
      ["Escape", async q=>q.keyboard.press("Escape")],
      ["a tap outside", async q=>q.click("#hellobd",{position:{x:10,y:10}})]]){
    const c2=await b.newContext(M); const q=await c2.newPage();
    await q.goto(URL); await ready(q);
    await act(q); await gone(q,"#hello"); await settle(q);
    say(name+" dismisses it too", (await up(q))===false);
    say("  and that counts as seen", await q.evaluate(()=>{
      try{ return localStorage.getItem("musicatlas.seen")==="1"; }catch(e){ return true; }}));
    await c2.close();
  }

  // ---------- the two steps ----------
  // The card asks two things, and they are two steps because they are two questions. What
  // matters: Continue moves on without losing an earlier answer, and Back steps back one
  // rather than all the way out.
  // There used to be a third, asking where you wanted to start. It confused people, and
  // the two destinations it offered are one tap apart in the live app, so the question was
  // not real. It was also the only way out of the card, which made the card a gate.
  { const c3=await b.newContext(M); const q=await c3.newPage();
    await q.goto(URL); await ready(q);
    const stepNow=()=>q.evaluate(()=>({
      on:[...document.querySelectorAll(".hstep")].filter(x=>!x.hidden).map(x=>x.dataset.step),
      all:[...document.querySelectorAll(".hstep")].map(x=>x.dataset.step),
      dots:[...document.querySelectorAll(".hdots i")].map(d=>d.classList.contains("on")?1:0),
      starts:[...document.querySelectorAll("[data-start]")].length,
      tall:(()=>{const g=document.querySelector("[data-hstart]");
        return !!g && g.getBoundingClientRect().height>=44;})()}));

    const one=await stepNow();
    say("the card opens on the first of two steps",
      one.on.join()==="1" && one.all.join()==="1,2" && one.dots.join()==="1,0");
    say("  and the step that asked where to start is gone", one.starts===0);

    // the choice made on step two has to survive a step back, or the step cost something
    await toStep(q,2);
    await q.click('#hello [data-svc="spotify"]');
    await until(q,()=>localStorage.getItem("svc")==="spotify");
    const two=await stepNow();
    say("Continue moves through to the second and last",
      two.on.join()==="2" && two.dots.join()==="0,1");
    say("  ending on one button that closes the card, at a real tap size", two.tall);

    await q.click('.hstep[data-step="2"] [data-to="1"]');
    await atStep(q,1); await settle(q);
    const back=await stepNow();
    say("Back steps back one", back.on.join()==="1" && back.dots.join()==="1,0");
    say("  with the service still chosen", await q.evaluate(()=>
      document.querySelector('#hello [data-svc="spotify"]').getAttribute("aria-checked")==="true"));

    // Escape on a later step is a step back, not a way out: the card is questions deep
    await q.click('.hstep[data-step="1"] [data-to="2"]'); await atStep(q,2);
    await q.keyboard.press("Escape"); await settle(q);
    const esc=await stepNow();
    say("Escape on a later step goes back rather than out",
      esc.on.join()==="1" && (await up(q))===true);
    await c3.close(); }

  // Start exploring leaves you where the app boots anyway: Explore up, nothing pushed on
  // top of it, nothing selected, the whole map behind it. That is what makes the old
  // third step unnecessary rather than merely confusing. Both of its destinations are
  // reachable from here without a question being asked first.
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await toStep(q,2);
    await q.click("[data-hstart]");
    await gone(q,"#hello"); await settle(q);
    const left=await q.evaluate(()=>({
      pages:[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).map(x=>x.dataset.p),
      open:document.body.classList.contains("open"),
      hash:location.hash, cur:!!document.querySelector("#chart .n.cur"),
      modes:!!document.querySelector(".sect-modes"),
      nodes:document.querySelectorAll("#chart .n").length}));
    say("Start exploring lands on Explore with nothing chosen for you ("+left.nodes+" styles)",
      left.pages.join()==="root" && left.open===true
      && left.hash==="" && left.cur===false && left.nodes>400);
    say("  with the collections a tap away on it, which is where the old step led",
      left.modes);
    await c.close(); }

  // ---------- after the card: keeping it ----------
  // Offered once the app itself is on screen, never before it, never twice, and never to
  // a browser that already has the thing installed.
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    const tipUp=()=>q.evaluate(()=>!document.getElementById("tip").hidden);
    say("no install offer while the card is still up", (await tipUp())===false);
    await toStep(q,2);
    await q.click("[data-hstart]");
    await gone(q,"#hello");
    say("  nor the moment the card closes", (await tipUp())===false);
    await until(q,()=>!document.getElementById("tip").hidden, null, 6000);
    await settle(q);
    say("the install offer arrives once the app itself is up", await tipUp());
    const shape=await q.evaluate(()=>{
      const c=document.getElementById("tipcard"), r=c.getBoundingClientRect();
      return {h:Math.round(r.height), frac:+(r.height/innerHeight).toFixed(2),
        onScreen:r.bottom<=innerHeight+1 && r.top>=0,
        icon:!!document.getElementById("tipicon").getAttribute("src"),
        labelled:!!c.getAttribute("aria-labelledby")};});
    say("  a half sheet, not another modal ("+shape.h+"px, "+Math.round(shape.frac*100)+"% of the screen)",
      shape.frac<0.35 && shape.onScreen && shape.icon && shape.labelled);
    // it sits over the app rather than replacing it: Explore is still there behind it
    say("  with Explore still behind it", await q.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="root" && !!u.querySelector(".listrow");}));

    await q.click("#tipno");
    await gone(q,"#tip"); await settle(q);
    say("Not now puts it away", (await tipUp())===false);
    say("  and remembers that", await q.evaluate(()=>{
      try{ return localStorage.getItem("musicatlas.tip")==="1"; }catch(e){ return true; }}));
    await c.close(); }

  // Show me how goes where it says
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await toStep(q,2);
    await q.click("[data-hstart]");
    await until(q,()=>!document.getElementById("tip").hidden, null, 8000);
    await q.click("#tiphow");
    await until(q,()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="install";}, null, 6000);
    await settle(q);
    say("Show me how opens the install page", await q.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="install" && document.getElementById("tip").hidden;}));
    await c.close(); }

  // a browser that already has it installed is not asked to install it
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.addInitScript(()=>{
      const real=window.matchMedia.bind(window);
      window.matchMedia=s=>/display-mode: standalone/.test(s)
        ? {matches:true, media:s, addListener(){}, removeListener(){},
           addEventListener(){}, removeEventListener(){}, onchange:null, dispatchEvent(){return false}}
        : real(s);
    });
    await q.goto(URL); await ready(q);
    await toStep(q,2);
    await q.click("[data-hstart]");
    await until(q,()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="modes";});
    // wait past when it would have come up, then check it did not
    await q.waitForTimeout(2600);
    say("already installed, it is never offered",
      await q.evaluate(()=>document.getElementById("tip").hidden));
    await c.close(); }

  // ---------- somebody arriving on a shared link ----------
  { const c4=await b.newContext(M); const q=await c4.newPage();
    await q.goto(URL+"#dub"); await ready(q);
    say("a shared style link skips it", (await up(q))===false);
    say("  and lands on the style", (await q.evaluate(()=>location.hash))==="#dub");
    // skipping is not the same as seeing: the explanation is still owed
    await q.goto(URL); await ready(q);
    say("  so the map itself still explains itself later", await up(q));
    await c4.close(); }

  // the point of asking is that every link in the app changes, so check one that is two
  // taps away rather than only the button that was pressed
  { const c6=await b.newContext(M); const q=await c6.newPage();
    await q.goto(URL); await ready(q);
    await toStep(q,2);
    await q.click('#hello [data-svc="spotify"]'); await picked(q,"spotify");
    await toStep(q,2);
    await q.click("[data-hstart]"); await gone(q,"#hello"); await settle(q);
    // tap a style on the map rather than reloading on a hash: it keeps the check on the
    // running page, where the choice was just made, instead of on whether file:// held
    // onto localStorage across a navigation — which it does not reliably do
    await q.evaluate(()=>{ const n=[...document.querySelectorAll("#chart .n")]
      .find(x=>x.dataset.id==="dub") || document.querySelector("#chart .n");
      n.dispatchEvent(new MouseEvent("click",{bubbles:true})); });
    // the panel is built from the selection, so the style has to be current
    await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q);
    await raise(q);
    await until(q,()=>document.body.classList.contains("open"));
    // the glide leaves an inline height on the panel while the sheet is still moving
    await until(q,()=>!document.getElementById("panel").style.height); await settle(q);
    const reach=await q.evaluate(()=>{
      const sv=document.querySelector(".svctx");
      const links=[...document.querySelectorAll("#panel a[href]")].map(a=>a.href)
        .filter(h=>/spotify|music\.apple|qobuz/.test(h));
      return {picker:sv?sv.textContent.trim():"none", n:links.length,
        allSpotify:links.length>0 && links.every(h=>/open\.spotify\.com/.test(h))};});
    say("the choice reaches a style panel: it reads "+reach.picker
      +" and all "+reach.n+" of its links are Spotify",
      reach.picker==="Spotify" && reach.allSpotify);
    await c6.close(); }

  // ---------- desktop ----------
  { const c5=await b.newContext(D); const q=await c5.newPage();
    await q.goto(URL); await ready(q);
    say("the card is there on a desktop too", await up(q));
    const fit=await q.evaluate(()=>{const r=document.getElementById("hellocard").getBoundingClientRect();
      return {w:Math.round(r.width), centred:Math.abs((r.left+r.right)/2-innerWidth/2)<=2,
        inside:r.top>=-1 && r.bottom<=innerHeight+1};});
    say("  centred at "+fit.w+"px and fully on screen", fit.centred && fit.inside && fit.w<=420);
    await c5.close(); }

  await b.close();
})();
