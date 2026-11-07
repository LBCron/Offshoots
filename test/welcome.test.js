// The welcome.
//
// A map of 461 dots joined by lines does not explain itself, and the playlists, which are
// the reason to stay, are two taps down. So a new visitor gets one card: what the thing
// is for, and two ways in. Collections first, because "music for what you are doing" needs
// no explanation; the Atlas beside it, because the map is the product.
//
// The rules it has to keep: once per browser and never again; never over a shared link,
// because somebody following one came for a style rather than an explanation; nothing is
// asked of the visitor before they have seen anything (no listening service, no install
// offer); and every way out works, since a modal that traps you is worse than no modal.
//
// This suite is the one that does NOT mark it seen first.
const {chromium}=require("playwright");
const {settle,until,gone,shown,arm,raise,lower}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const M={viewport:{width:393,height:852,isMobile:true,hasTouch:true},deviceScaleFactor:2};
const S={viewport:{width:375,height:667,isMobile:true,hasTouch:true},deviceScaleFactor:2}; // iPhone SE
const D={viewport:{width:1280,height:900}};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
const up=p=>p.evaluate(()=>!document.getElementById("hello").hidden);
const tipUp=p=>p.evaluate(()=>!document.getElementById("tip").hidden);
const page=p=>p.evaluate(()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
  return u?u.dataset.p:null;});
// boot opens the card 260ms after the fonts are ready, so the card is either up by the
// time this returns or it was never coming.
const booted=q=>until(q,()=>{
  if(document.fonts.status!=="loaded") return false;
  if(!window.__fontsAt) window.__fontsAt=performance.now();
  const w=document.getElementById("hello");
  return !!w && (!w.hidden || performance.now()-window.__fontsAt>400);});
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await booted(q); await settle(q); };
const seen=q=>q.evaluate(()=>{ try{ return localStorage.getItem("musicatlas.seen")==="1"; }catch(e){ return true; }});
const svcStored=q=>q.evaluate(()=>{ try{ return localStorage.getItem("svc"); }catch(e){ return "n/a"; }});

(async()=>{
  const b=await chromium.launch();
  const errs=[];

  // ---------- the card ----------
  { const c=await b.newContext(M); const p=await c.newPage();
    p.on("pageerror",e=>errs.push(String(e)));
    await p.goto(URL); await ready(p);
    say("a new visitor gets the card", await up(p));
    const card=await p.evaluate(()=>{
      const c=document.getElementById("hellocard"), r=c.getBoundingClientRect();
      const paths=[...c.querySelectorAll(".hpath")].map(b=>{
        const br=b.getBoundingClientRect();
        const d=document.getElementById(b.getAttribute("aria-describedby")||"");
        return {go:b.dataset.hgo, name:(b.querySelector("b")||{}).textContent||"", desc:d?d.textContent.trim():"",
          h:Math.round(br.height), primary:b.classList.contains("hprimary"),
          bg:getComputedStyle(b).backgroundColor, inside:br.bottom<=innerHeight+1 && br.top>=0};});
      return {title:document.getElementById("hellottl").textContent.trim(),
        sub:document.getElementById("hellosub").textContent.trim(),
        modal:c.getAttribute("role")==="dialog" && c.getAttribute("aria-modal")==="true"
          && c.getAttribute("aria-labelledby")==="hellottl",
        fits:r.top>=0 && r.bottom<=innerHeight+1, scrolls:document.documentElement.scrollWidth<=innerWidth,
        focused:document.activeElement===c || c.contains(document.activeElement),
        svcPicker:!!c.querySelector("[data-svc]"), steps:c.querySelectorAll(".hstep,.hdots").length,
        paths};});
    say("  titled "+JSON.stringify(card.title), card.title==="Find your way to something worth hearing.");
    say("  with one line under it about what you are doing and feeling", /doing/.test(card.sub) && /feeling/.test(card.sub));
    say("  and two ways in: "+card.paths.map(x=>x.name).join(" / "),
      card.paths.length===2 && card.paths[0].go==="modes" && card.paths[1].go==="atlas");
    say("  Collections first, as the filled one", card.paths[0].primary && !card.paths[1].primary
      && card.paths[0].bg!==card.paths[1].bg);
    say("  each saying what it is for", card.paths.every(x=>x.desc.length>12));
    say("  both at a real tap size ("+card.paths.map(x=>x.h+"px").join(", ")+") and on screen",
      card.paths.every(x=>x.h>=44 && x.inside));
    say("  announced as a dialog", card.modal);
    say("  fitting the screen without pushing it sideways", card.fits && card.scrolls);
    say("  focus goes to the card", card.focused);
    say("  no steps, dots or service picker in it", card.steps===0 && !card.svcPicker);
    say("  and no install offer while it is up", (await tipUp(p))===false);
    note("nothing stored before a choice", "svc="+(await svcStored(p))+" seen="+(await seen(p)));
    say("  nothing is asked of the visitor first: no service stored", (await svcStored(p))===null);

    // Tab lands on the primary path, not on the backdrop or the card shell
    await p.keyboard.press("Tab");
    say("Tab lands on Explore Collections", await p.evaluate(()=>
      document.activeElement && document.activeElement.dataset.hgo==="modes"));

    // ---------- Explore Collections ----------
    await p.click('[data-hgo="modes"]');
    await gone(p,"#hello");
    await until(p,()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="modes";}, null, 6000);
    await settle(p);
    say("Explore Collections closes the card and opens the collections page", (await page(p))==="modes");
    const modes=await p.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      const tiles=[...u.querySelectorAll("img")].filter(i=>/moods\//.test(i.getAttribute("src")||""));
      const r=u.getBoundingClientRect();
      return {tiles:tiles.length, open:document.body.classList.contains("open"),
        visible:tiles.filter(i=>{const b=i.getBoundingClientRect(); return b.top<innerHeight && b.bottom>0;}).length};});
    say("  with "+modes.tiles+" collections on it, "+modes.visible+" already in view, no modal between",
      modes.open && modes.tiles>=8 && modes.visible>=2 && (await up(p))===false);
    say("  and that counts as seen", await seen(p));
    say("  without choosing a service for you", (await svcStored(p))===null);
    say("  and no install offer in the way", (await tipUp(p))===false);
    await p.goto(URL); await ready(p);
    say("  and it does not come back", (await up(p))===false);
    say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
    await c.close(); }

  // ---------- Explore the Atlas ----------
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await q.click('[data-hgo="atlas"]');
    await gone(q,"#hello"); await settle(q);
    const left=await q.evaluate(()=>({open:document.body.classList.contains("open"),
      cur:document.querySelectorAll("#chart .n.cur").length, nodes:document.querySelectorAll("#chart .n").length,
      hash:location.hash}));
    say("Explore the Atlas drops the sheet and shows the map with nothing chosen for you ("+left.nodes+" styles)",
      !left.open && left.cur===0 && left.nodes>400 && left.hash==="");
    say("  and that counts as seen", await seen(q));
    say("  with no tutorial over it", await q.evaluate(()=>!document.querySelector("#hello:not([hidden]), #tip:not([hidden])")));
    // the map still works: a tap selects
    await q.evaluate(()=>{ const n=[...document.querySelectorAll("#chart .n")]
      .find(x=>x.dataset.id==="dub") || document.querySelector("#chart .n");
      n.dispatchEvent(new MouseEvent("click",{bubbles:true})); });
    await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q);
    say("  and a tap on the map selects a style", await q.evaluate(()=>!!document.querySelector("#chart .n.cur")));
    await c.close(); }

  // ---------- the other ways out ----------
  for(const [name,how] of [
      ["Escape", async q=>q.keyboard.press("Escape")],
      ["a tap outside", async q=>q.click("#hellobd",{position:{x:10,y:10}})]]){
    const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await how(q); await gone(q,"#hello"); await settle(q);
    say(name+" dismisses it too", (await up(q))===false);
    say("  and that counts as seen", await seen(q));
    say("  leaving the ordinary app (map, sheet down)", await q.evaluate(()=>
      !document.body.classList.contains("open") || !!document.querySelector(".ppage:not([hidden])")));
    await c.close(); }

  // ---------- the service is asked for where it is used, not up front ----------
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await q.click('[data-hgo="atlas"]'); await gone(q,"#hello"); await settle(q);
    await q.evaluate(()=>{ const n=[...document.querySelectorAll("#chart .n")]
      .find(x=>x.dataset.id==="dub") || document.querySelector("#chart .n");
      n.dispatchEvent(new MouseEvent("click",{bubbles:true})); });
    await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q);
    await raise(q);
    await until(q,()=>document.body.classList.contains("open"));
    await until(q,()=>!document.getElementById("panel").style.height); await settle(q);
    const panel=await q.evaluate(()=>{
      const sv=document.querySelector(".svctx"), note=document.querySelector(".svcnote");
      const links=[...document.querySelectorAll("#panel a[href]")].map(a=>a.href)
        .filter(h=>/spotify|music\.apple|qobuz/.test(h));
      return {picker:sv?sv.textContent.trim():"none", n:links.length,
        apple:links.length>0 && links.every(h=>/music\.apple/.test(h)),
        note:note?note.textContent.trim():"", noteSize:note?parseFloat(getComputedStyle(note).fontSize):0,
        opts:document.querySelectorAll('#panel .svcsel option').length};});
    say("a style panel still works with no service chosen: "+panel.n+" Apple Music links by default",
      panel.n>0 && panel.apple);
    say("  with the picker right there ("+panel.opts+" services)", panel.opts===3);
    say("  and a line saying why, at a readable size ("+panel.noteSize+"px)",
      /Apple Music/.test(panel.note) && /device/.test(panel.note) && panel.noteSize>=13);
    await q.selectOption('#panel .svcsel','spotify');
    await until(q,()=>{ try{ return localStorage.getItem("svc")==="spotify"; }catch(e){ return true; } });
    await settle(q);
    const after=await q.evaluate(()=>{
      const links=[...document.querySelectorAll("#panel a[href]")].map(a=>a.href)
        .filter(h=>/spotify|music\.apple|qobuz/.test(h));
      return {cur:!!document.querySelector("#chart .n.cur"), open:document.body.classList.contains("open"),
        allSpotify:links.length>0 && links.every(h=>/open\.spotify\.com/.test(h)),
        note:!!document.querySelector(".svcnote")};});
    say("picking Spotify there keeps the style and the panel and rewrites the links",
      after.cur && after.open && after.allSpotify);
    say("  and the why-line goes away once a choice is made", !after.note);
    await c.close(); }

  // ---------- installing is offered from About, not from the welcome ----------
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    await q.click('[data-hgo="modes"]'); await gone(q,"#hello");
    await until(q,()=>{const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      return !!u && u.dataset.p==="modes";}, null, 6000);
    await q.waitForTimeout(2600); await settle(q);
    say("no install offer appears on its own after the welcome", (await tipUp(q))===false);
    say("  but the install page is still reachable from About", await q.evaluate(()=>{
      const a=document.querySelector('.instlink[data-page="install"]'); return !!a;}));
    await c.close(); }

  // ---------- somebody arriving on a shared link ----------
  { const c4=await b.newContext(M); const q=await c4.newPage();
    await q.goto(URL+"#dub"); await ready(q);
    say("a shared style link skips it", (await up(q))===false);
    say("  and lands on the style", (await q.evaluate(()=>location.hash))==="#dub");
    // skipping is not the same as seeing: the explanation is still owed
    await q.goto(URL); await ready(q);
    say("  so the welcome still comes later", await up(q));
    await c4.close(); }

  // ---------- a returning visitor who already chose a service keeps it ----------
  { const c=await b.newContext(M); const q=await c.newPage();
    await q.addInitScript(()=>{ try{ localStorage.setItem("svc","qobuz"); }catch(e){} });
    await q.goto(URL); await ready(q);
    say("a stored service survives the welcome", await up(q) && (await svcStored(q))==="qobuz");
    await q.click('[data-hgo="atlas"]'); await gone(q,"#hello"); await settle(q);
    say("  and is still there after it", (await svcStored(q))==="qobuz");
    await c.close(); }

  // ---------- a small phone ----------
  { const c=await b.newContext(S); const q=await c.newPage();
    await q.goto(URL); await ready(q);
    const fit=await q.evaluate(()=>{const r=document.getElementById("hellocard").getBoundingClientRect();
      const ps=[...document.querySelectorAll(".hpath")].map(b=>b.getBoundingClientRect());
      return {inside:r.top>=-1 && r.bottom<=innerHeight+1, h:Math.round(r.height),
        paths:ps.every(p=>p.top>=0 && p.bottom<=innerHeight+1)};});
    say("on a 375x667 phone the card and both paths fit without scrolling ("+fit.h+"px tall)", fit.inside && fit.paths);
    await c.close(); }

  // ---------- desktop ----------
  { const c5=await b.newContext(D); const q=await c5.newPage();
    await q.goto(URL); await ready(q);
    say("the card is there on a desktop too", await up(q));
    const fit=await q.evaluate(()=>{const r=document.getElementById("hellocard").getBoundingClientRect();
      return {w:Math.round(r.width), centred:Math.abs((r.left+r.right)/2-innerWidth/2)<=2,
        inside:r.top>=-1 && r.bottom<=innerHeight+1};});
    say("  centred at "+fit.w+"px and fully on screen", fit.centred && fit.inside && fit.w<=480);
    await c5.close(); }

  await b.close();
})();
