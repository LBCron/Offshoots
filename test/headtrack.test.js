// A collection lists styles, and sometimes one recording is the whole point of it. Money
// for Nothing is not a way into Rock and Roll; it is the record a shop put on to sell a
// stereo in 1985, and burying it at number 43 of a list was the wrong shape. It sits above
// the list on its own and opens the song rather than a playlist or a style.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm} =require("./_wait");
const D=require(path.join(__dirname,"..","src","data.js"));
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

(async()=>{
  const H=D.HEADTRACK||{};
  const keys=Object.keys(H);
  note("collections with a headline track", keys.length ? keys.join(", ") : "(none)");
  say("every one names a collection that exists",
    keys.every(k=>D.MODES.some(m=>m[0]===k)) ? true
      : keys.filter(k=>!D.MODES.some(m=>m[0]===k)).join(", "));
  // a track addresses differently from a playlist, so these are whole URLs and have to
  // look like one: a bare id here is a link to nowhere
  const bad=[];
  for(const [k,h] of Object.entries(H)){
    if(!h.title||!h.artist||!h.year) bad.push(k+": missing title, artist or year");
    if(!/^https:\/\/music\.apple\.com\//.test(h.ap||"")) bad.push(k+": apple "+h.ap);
    if(!/^https:\/\/open\.spotify\.com\/track\//.test(h.sp||"")) bad.push(k+": spotify "+h.sp);
    // the si= on a shared Spotify link tags whoever shared it and follows everyone who
    // opens it, so it does not belong in a file the whole map ships
    if(/[?&]si=/.test(h.sp||"")) bad.push(k+": spotify link still carries its share tag");
    if(h.style && !D.DATA.some(r=>r[0]===h.style)) bad.push(k+": no such style "+h.style);
    if((h.why||"").length<20) bad.push(k+": the reason is too short to be one");
  }
  say("each carries a real link to the song in both services",
    bad.length===0 ? true : bad.join(" | "));
  // the point of lifting it out is that it is not one of the list
  for(const [k,h] of Object.entries(H)){
    const m=D.MODES.find(x=>x[0]===k);
    say("  and is not also a row in "+k+" ("+m[4].length+" styles)",
      !m[4].some(p=>p[0]===h.style));
  }

  const b=await chromium.launch(); await skipWelcome(b);
  for(const [svc,host] of [["apple","music.apple.com"],["spotify","open.spotify.com"]]){
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.addInitScript(v=>{ try{ localStorage.setItem("svc",v); }catch(e){} }, svc);
    const p=await c.newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await p.click('[data-mode="system"]');
    await until(p,()=>!!document.querySelector('.ppage[data-p="mode:system"]'));
    await settle(p); await new Promise(r=>setTimeout(r,300));
    const v=await p.evaluate(()=>{
      const pg=document.querySelector('.ppage[data-p="mode:system"]');
      const card=pg.querySelector(".trkcard"), a=pg.querySelector(".trkbtn");
      const lede=pg.querySelector(".pglede"), sur=pg.querySelector("[data-pickany]");
      const list=pg.querySelector(".picks");
      const r=x=>x?x.getBoundingClientRect():null;
      return {title:(card.querySelector(".trkttl")||{}).textContent,
        by:(card.querySelector(".trkby")||{}).textContent,
        label:(a.querySelector(".plsvc")||{}).textContent,
        href:a.getAttribute("href"), target:a.getAttribute("target"),
        rel:a.getAttribute("rel"), tap:Math.round(r(a).height),
        why:(card.querySelector(".trkwhy")||{}).textContent.trim().length,
        toStyle:(card.querySelector(".trkgo")||{}).dataset,
        underLede: r(card).top>=r(lede).bottom-1,
        aboveTheRest: r(card).bottom<=r(sur).top+1 && r(card).bottom<=r(list).top,
        cards:pg.querySelectorAll(".trkcard").length};
    });
    note(svc, JSON.stringify({label:v.label, href:v.href}));
    say(svc+": the track is named, with who and when ("+v.by+")",
      v.title===D.HEADTRACK.system.title && /Dire Straits/.test(v.by) && /1985/.test(v.by));
    say("  linked to the song in the service you picked",
      new RegExp("^https://"+host.replace(/\./g,"\\.")+"/").test(v.href||"")
      && new RegExp(svc==="apple"?"Apple Music":"Spotify").test(v.label||""));
    say("  opening out of the app, safely ("+v.target+", "+v.rel+")",
      v.target==="_blank" && /noopener/.test(v.rel||""));
    say("  clearing the tap floor ("+v.tap+"px)", v.tap>=44);
    say("  on its own above the list and everything that sorts it",
      v.underLede && v.aboveTheRest && v.cards===1);
    say("  with a way back to where it sits on the map ("
      +(v.toStyle&&v.toStyle.go)+")", v.toStyle && v.toStyle.go===D.HEADTRACK.system.style);
    say("  and a reason for it being here ("+v.why+" characters)", v.why>=40);
    await c.close();
  }

  // a collection with no headline track is unchanged, which is all but one of them
  {
    const c=await b.newContext({viewport:{width:390,height:844}});
    const p=await c.newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await p.click('[data-mode="dinner"]');
    await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]'));
    await settle(p);
    say("a collection without one carries nothing extra",
      (await p.evaluate(()=>document.querySelectorAll('.ppage[data-p="mode:dinner"] .trkcard').length))===0);
    await c.close();
  }
  await b.close();
})();
