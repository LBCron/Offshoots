// A collection used to be twelve picks and is now forty-odd, which changes what it is. At
// twelve you read the whole thing; at forty you need the order stated, and you need a way
// out of reading it at all. So: the written order is the default and is called what it is,
// and a control picks for you.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const D=require(path.join(__dirname,"..","src","data.js"));
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

(async()=>{
  // ---- the data, before anything is drawn ----
  const play=new Set([...Object.keys(D.PLAY||{}),...Object.keys(D.SPLAY||{})]);
  const ids=new Set(D.DATA.map(r=>r[0]));
  const sizes=D.MODES.map(m=>m[4].length);
  const total=sizes.reduce((a,b)=>a+b,0);
  note("collections", D.MODES.length+", "+total+" entries, "
    +Math.min(...sizes)+" to "+Math.max(...sizes)+" each");
  say("every collection names a style that exists",
    D.MODES.every(m=>m[4].every(([id])=>ids.has(id))) ? true
      : D.MODES.flatMap(m=>m[4].filter(([id])=>!ids.has(id)).map(([id])=>m[0]+":"+id)).slice(0,4).join(" "));
  // the point of a collection is to play something, and the surprise control picks blind
  // from it, so a member with no playlist is a dead end it can land you on
  const noplay=D.MODES.flatMap(m=>m[4].filter(([id])=>!play.has(id)).map(([id])=>m[0]+":"+id));
  say("  and every one of them has a playlist to play",
    noplay.length===0 ? true : noplay.slice(0,5).join(" "));
  const dup=D.MODES.filter(m=>new Set(m[4].map(x=>x[0])).size!==m[4].length).map(m=>m[0]);
  say("  with no style listed twice in one collection",
    dup.length===0 ? true : dup.join(" "));
  const used=new Set(D.MODES.flatMap(m=>m[4].map(x=>x[0])));
  const orphan=[...play].filter(x=>!used.has(x));
  say("every playlist on the map is in at least one collection ("+used.size+" of "+play.size+")",
    orphan.length===0 ? true : orphan.length+" left out: "+orphan.slice(0,6).join(" "));
  // one collection that is thirty kinds of the same thing is one idea repeated
  const fam={}; D.DATA.forEach(r=>fam[r[0]]=r[3]);
  const thin=D.MODES.filter(m=>m[4].length>=20
    && new Set(m[4].map(x=>fam[x[0]])).size<5).map(m=>m[0]);
  say("  and no big collection is a single family in disguise",
    thin.length===0 ? true : thin.join(" "));
  // a line that appears twice was written for neither place
  const line={}; D.MODES.forEach(m=>m[4].forEach(([id,why])=>(line[why]=line[why]||[]).push(m[0]+":"+id)));
  const reused=Object.entries(line).filter(([,w])=>w.length>1);
  say("  and every reason is written for the collection it is in",
    reused.length===0 ? true : reused.slice(0,3).map(([w,x])=>x.join("/")+": "+w).join(" | "));

  // ---- the page ----
  const b=await chromium.launch(); await skipWelcome(b);
  for(const [tag,vp] of [["phone  ",{width:390,height:844}],["desktop",{width:1280,height:900}]]){
    const p=await (await b.newContext({viewport:vp})).newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    if(await p.evaluate(()=>!document.body.classList.contains("open"))){
      await p.click("#grab").catch(()=>{});
      await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    // a collection opens by tapping it: the hash does not deep-link one
    await p.click('[data-mode="dinner"]');
    await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]'));
    await settle(p); await new Promise(r=>setTimeout(r,250));

    const look=()=>p.evaluate(()=>{
      const pg=document.querySelector('.ppage[data-p="mode:dinner"]');
      const btn=pg.querySelector(".pickany"), seg=pg.querySelector(".psortwrap");
      const lede=pg.querySelector(".pglede"), list=pg.querySelector(".picks");
      const r=x=>x?x.getBoundingClientRect():null;
      return {names:[...pg.querySelectorAll(".pknm")].map(x=>x.textContent),
        label:btn?(btn.querySelector(".palbl")||{}).textContent:"(none)",
        count:btn?(btn.querySelector(".pact")||{}).textContent:"",
        tap:btn?Math.round(r(btn).height):0,
        aboveList: btn&&list ? r(btn).bottom<=r(list).top : null,
        belowLede: btn&&lede ? r(btn).top>=r(lede).top : null,
        spill: seg ? Math.round(r(seg).right-r(pg).right) : null,
        sorts:[...pg.querySelectorAll("[data-psort]")].map(x=>
          x.textContent+(x.getAttribute("aria-selected")==="true"?"*":""))};
    });
    const v=await look();
    const dinner=D.MODES.find(m=>m[0]==="dinner");
    note(tag, v.names.length+" picks, button \""+v.label+" "+v.count+"\"");
    say(tag+": the whole collection is on the page", v.names.length===dinner[4].length);
    say("  with a control that picks one for you (\""+v.label+"\")",
      v.label==="Surprise me" && v.count===String(dinner[4].length));
    say("  clearing the tap floor ("+v.tap+"px)", v.tap>=36);
    say("  sitting under the lede and above the list", v.belowLede && v.aboveList);
    note("  sort", v.sorts.join(" "));
    say("  and the three orders, relevance first and selected",
      JSON.stringify(v.sorts)===JSON.stringify(["Relevance*","A–Z","Most used"]));
    say("  with the sort inside the page ("+v.spill+"px)", v.spill<=0);

    // relevance is the written order, which is the collection's own argument
    say("  relevance is the order the collection was written in",
      JSON.stringify(v.names)===JSON.stringify(dinner[4].map(([id])=>
        D.DATA.find(r=>r[0]===id)[1])));
    await p.click('[data-psort="az"]'); await settle(p);
    const az=(await look()).names;
    say("  A–Z sorts by name ("+az.slice(0,2).join(", ")+" … "+az.slice(-1)+")",
      az.length===v.names.length
      && az.every((n,i)=>i===0||az[i-1].localeCompare(n)<=0));
    // nothing has been opened in this browser, so there is nothing to go on and the order
    // must fall back rather than scramble
    await p.click('[data-psort="used"]'); await settle(p);
    const un=(await look()).names;
    say("  Most used falls back to relevance on a browser with no history",
      JSON.stringify(un)===JSON.stringify(v.names));
    // and once something has been opened it leads
    await p.evaluate(()=>localStorage.setItem("offshoots.styleuse",
      JSON.stringify({tropicalia:9})));
    await p.click('[data-psort="fit"]'); await settle(p);
    await p.click('[data-psort="used"]'); await settle(p);
    const un2=(await look()).names;
    say("    and puts what this browser opens most at the top (\""+un2[0]+"\")",
      un2[0]==="Tropicália" && un2.length===v.names.length);
    await p.click('[data-psort="fit"]'); await settle(p);

    // the control's one promise: it lands you on something from this collection
    const inHere=new Set(dinner[4].map(([id])=>id));
    // Landing on a style replaces the page stack, so the collection has to be opened
    // again for each try rather than tapped repeatedly: the first draft of this loop
    // clicked a control that was no longer on the page and timed out.
    const backToCollection=async()=>{
      await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
      if(await p.evaluate(()=>!document.body.classList.contains("open"))){
        await p.click("#grab").catch(()=>{});
        await until(p,()=>document.body.classList.contains("open")); await settle(p); }
      await p.click('[data-mode="dinner"]');
      await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]'));
      await settle(p);
    };
    let landed=[];
    for(let i=0;i<6;i++){
      await backToCollection();
      await p.click(".pickany"); await settle(p);
      await new Promise(r=>setTimeout(r,250));
      landed.push(await p.evaluate(()=>location.hash.slice(1)));
    }
    say("  surprise lands inside this collection every time ("+landed.length+" tries)",
      landed.every(h=>inHere.has(h)) ? true : landed.filter(h=>!inHere.has(h)).join(" "));
    say("    and not always on the same one", new Set(landed).size>1);
    await p.close();
  }
  await b.close();
})();
