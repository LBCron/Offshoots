// Playlists that cross the map.
//
// A style's own playlist is the one thing on its panel that is only about it. A
// cross-style playlist is the opposite: it belongs on every style it draws from and on
// none of them alone, so the row has to appear on all of those, on none of the others,
// and say where else it goes. Otherwise it reads as a second, oddly-named playlist for
// whichever style you happened to be looking at.
const {chromium}=require("playwright");
const path=require("path");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const D=require(path.join(__dirname,"..","src","data.js"));
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));
const opened=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q);
  await until(q,()=>document.body.classList.contains("open")); await settle(q); };

(async()=>{
  const X=D.XPLAY||[];
  const ids=new Set(D.DATA.map(r=>r[0]));
  say("there are cross-style playlists to check ("+X.length+")", X.length>0);

  // ---- the data, before the page ----
  const bad=[], thin=[], dupe=[], untracked=[];
  const seen=new Set();
  for(const x of X){
    if(seen.has(x.id)) dupe.push(x.id); else seen.add(x.id);
    (x.styles||[]).forEach(s=>{ if(!ids.has(s)) bad.push(x.id+" -> "+s); });
    if((x.styles||[]).length<2) thin.push(x.id);
    if(!x.ap && !x.sp) bad.push(x.id+" has no playlist on either service");
    if(!(x.tracks||[]).length) untracked.push(x.id);
  }
  say("  every style named exists", bad.length===0 ? true : bad.slice(0,4).join(", "));
  say("  none of them listed twice", dupe.length===0 ? true : dupe.join(", "));
  // one style is not a span: that is just a playlist, and belongs in PLAY
  say("  and each spans at least two", thin.length===0 ? true : thin.join(", "));
  // The acts on a crossing are in neither ROSTER nor SONGS, because they belong to no
  // single style, so nothing else in the app will index them. A crossing added without
  // its tracklist is invisible to a search for the one act that made you want it, and
  // nothing would ever complain. This is the complaint.
  say("  and each carries its tracklist, so search can see inside it",
    untracked.length===0 ? true : untracked.join(", ")+" (see tools/xplay-tracks.js)");

  const b=await chromium.launch(); await skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:430,height:930}});
  const x=X[0];
  const read=async id=>{ const p=await ctx.newPage();
    await p.goto(URL+"#"+id); await opened(p);
    const r=await p.evaluate(()=>[...document.querySelectorAll(".plrow")].map(a=>({
      x:a.classList.contains("xplay"),
      t:(a.querySelector(".plttl")||{}).textContent||"",
      span:(a.querySelector(".plspan")||{}).textContent||"",
      note:(a.querySelector(".plnote")||{}).textContent||"",
      href:a.getAttribute("href")||"",
      svc:(a.querySelector(".plsvc")||{}).textContent||"",
      art:!!a.querySelector(".pcov"),
      torn:[...a.querySelectorAll("img")].some(i=>i.complete&&i.naturalWidth===0)})));
    await p.close(); return r; };

  // ---- on every style it names ----
  const miss=[], noSpan=[], torn=[];
  for(const id of x.styles){
    const rows=await read(id);
    const row=rows.find(r=>r.x);
    if(!row){ miss.push(id); continue; }
    if(!/Also on/.test(row.span)) noSpan.push(id);
    if(row.torn) torn.push(id);
    // the style you are on is not worth telling you about
    if(new RegExp(D.DATA.find(r=>r[0]===id)[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).test(row.span))
      noSpan.push(id+" names itself");
  }
  say('"'+x.title+'" is on all '+x.styles.length+" styles it names",
    miss.length===0 ? true : "missing from "+miss.join(", "));
  say("  each saying where else it goes, never naming the style you are on",
    noSpan.length===0 ? true : noSpan.slice(0,4).join(", "));
  say("  with art that is not a torn icon", torn.length===0 ? true : torn.join(", "));

  // ---- and nowhere else ----
  const others=D.DATA.map(r=>r[0]).filter(id=>x.styles.indexOf(id)<0)
    .filter((_,i)=>i%37===0).slice(0,8);
  const stray=[];
  for(const id of others){ const rows=await read(id); if(rows.some(r=>r.x)) stray.push(id); }
  say("  and on none of "+others.length+" styles it does not",
    stray.length===0 ? true : stray.join(", "));

  // ---- it is a real link on both services ----
  { const p=await ctx.newPage();
    await p.goto(URL+"#"+x.styles[0]); await opened(p);
    const ap=await p.evaluate(()=>{const a=document.querySelector(".plrow.xplay");
      return {href:a.getAttribute("href")||"", cls:a.className};});
    await p.selectOption("select.svcsel","spotify").catch(()=>{});
    await settle(p);
    const sp=await p.evaluate(()=>{const a=document.querySelector(".plrow.xplay");
      return {href:a.getAttribute("href")||"", cls:a.className};});
    say("  opening on Apple Music ("+ap.href.slice(8,34)+"…)",
      /music\.apple\.com\/playlist\//.test(ap.href));
    say("  and on Spotify ("+sp.href.slice(8,32)+"…)",
      /open\.spotify\.com\/playlist\//.test(sp.href));
    // paintPlay rebuilds className from scratch, which quietly dropped this class and
    // sent the row back to looking like the style's own playlist
    say("  and still marked as a crossing after the switch", /\bxplay\b/.test(sp.cls));
    await p.close(); }

  // ---- and search can find it by what is in it ----
  { const p=await ctx.newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await p.$eval("#mapSearch",e=>e.click()).catch(()=>{});
    await settle(p);
    const type=async t=>{ await p.$eval("#q",(e,v)=>{ e.value=v;
      e.dispatchEvent(new Event("input",{bubbles:true})); },t); await settle(p); };
    const rows=()=>p.evaluate(()=>[...document.querySelectorAll("#res button")].map(x=>({
      cross:/\brs-listen\b/.test(x.className),
      nm:(x.querySelector(".rnm")||{}).textContent||"",
      sub:(x.querySelector("small")||{}).textContent||"",
      ext:!!x.querySelector(".rext")})));

    await type(x.title.split(" ")[0]);
    const byName=await rows();
    say("searching its name finds it", byName.some(r=>r.cross && r.nm===x.title));

    // a spread of the tracklist rather than the first few, since the first few are the
    // ones a careless index would happen to catch
    const acts=[...new Set(x.tracks.map(t=>String(t[0]).split(/,\s*/)[0]))];
    const pick=[0,1,2,3,4].map(i=>acts[Math.floor(i*(acts.length-1)/4)]);
    const missA=[];
    for(const a of pick){ await type(a);
      const r=await rows();
      if(!r.some(z=>z.cross && z.nm===x.title)) missA.push(a); }
    say("  and so does each of "+pick.length+" acts from across it",
      missA.length===0 ? true : missA.join(", "));
    say("  with the act named in the line, not just the playlist",
      (await rows()).some(z=>z.cross && z.sub.indexOf(pick[pick.length-1])===0));

    const songs=x.tracks.map(t=>t[1]).filter(t=>t.length>=5);
    const picks=[0,1,2].map(i=>songs[Math.floor(i*(songs.length-1)/2)]);
    const missS=[];
    for(const sg of picks){ await type(sg);
      const r=await rows();
      if(!r.some(z=>z.cross && z.nm===x.title)) missS.push(sg); }
    say("  and "+picks.length+" track titles from across it",
      missS.length===0 ? true : missS.join(", "));
    // it leaves for a service, so it carries the mark that says so
    say("  marked as leaving the app", (await rows()).some(z=>z.cross && z.ext));
    await p.close(); }

  await b.close();
})();
