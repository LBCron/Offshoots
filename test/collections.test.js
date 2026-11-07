// A collection used to be twelve picks and is now forty-odd, which changes what it is. At
// twelve you read the whole thing; at forty you need the order stated, and you need a way
// out of reading it at all. So: the written order is the default and is called what it is,
// and a control picks for you.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise}=require("./_wait");
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
      await raise(p);
      await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    // a collection opens by tapping it: the hash does not deep-link one
    await p.click('[data-mode="dinner"]');
    await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]'));
    await settle(p); await new Promise(r=>setTimeout(r,250));

    const look=()=>p.evaluate(()=>{
      const pg=document.querySelector('.ppage[data-p="mode:dinner"]');
      const btn=pg.querySelector("[data-pickany]"), seg=pg.querySelector(".sortpick");
      // the deck, which is the one line under the name. The how-it-sounds paragraph
      // that used to sit here as well is not shown any more: three stacked texts
      // above the first playlist made a page you read before you got to use it.
      const lede=pg.querySelector(".pgdeck"), list=pg.querySelector(".picks");
      const r=x=>x?x.getBoundingClientRect():null;
      return {names:[...pg.querySelectorAll(".pknm")].map(x=>x.textContent),
        label:btn?(btn.querySelector(".lrlbl")||{}).textContent:"(none)",
        sub:btn?(btn.querySelector(".lrsub")||{}).textContent:"",
        chev:btn?!!btn.querySelector(".lrcv"):false,
        carded:btn?!!btn.closest(".listgrp"):false,
        tap:btn?Math.round(r(btn).height):0,
        aboveList: btn&&list ? r(btn).bottom<=r(list).top : null,
        belowLede: btn&&lede ? r(btn).top>=r(lede).top : null,
        spill: seg ? Math.round(r(seg).right-r(pg).right) : null,
        head: pg.querySelector(".secthead.picksort .secttl"),
        headTx: (pg.querySelector(".secthead.picksort .secttl")||{}).textContent||"",
        headLines: (()=>{ const h=pg.querySelector(".secthead.picksort .secttl");
          return h ? Math.round(r(h).height/parseFloat(getComputedStyle(h).lineHeight)) : 0; })(),
        onOneLine: (()=>{ const h=pg.querySelector(".secthead.picksort .secttl");
          return h&&seg ? Math.abs(r(h).top-r(seg).top)<r(h).height : null; })(),
        segW: seg?Math.round(r(seg).width):null,
        aboveFirst: seg&&list ? r(seg).bottom<=r(list).top+1 : null,
        tabTap: seg?Math.round(r(seg).height):0,
        cur: seg?(seg.querySelector(".sortx")||{}).textContent:"",
        sorts:(()=>{const sel=seg&&seg.querySelector("select");
          return sel?[...sel.options].map(o=>o.text+(o.selected?"*":"")):[];})()};
    });
    const v=await look();
    const dinner=D.MODES.find(m=>m[0]==="dinner");
    note(tag, v.names.length+" picks, row \""+v.label+" / "+v.sub+"\"");
    say(tag+": the whole collection is on the page", v.names.length===dinner[4].length);
    say("  with a control that picks one for you (\""+v.label+"\")",
      v.label==="Surprise me");
    // the same row as Surprise me on the Explore panel: icon, label, second line, chevron,
    // in a card. It said the same thing as an accent-filled button, and shouted it.
    say("    drawn as a go row in a card, saying what it picks from (\""+v.sub+"\")",
      v.carded && v.chev && v.sub==="One of these "+dinner[4].length+", at random");
    say("  clearing the tap floor ("+v.tap+"px)", v.tap>=44);
    say("  sitting under the description and above the list", v.belowLede && v.aboveList);
    note("  sort", v.sorts.join(" "));
    say("  and the three orders, relevance first and selected",
      JSON.stringify(v.sorts)===JSON.stringify(["Relevance*","A–Z","Most used"]));
    say("  with the sort inside the page ("+v.spill+"px)", v.spill<=0);
    // Three words were wider than the panel, so the control scrolled and the third order
    // sat off the edge. Then it was three glyphs you had to press to identify. It is one
    // inline picker now, the same control the Listen on row uses: the order it is on said
    // in a word, and the other two in the platform's own list behind it.
    say("  as one picker naming the order it is on (\""+v.cur+"\", "+v.segW+"px wide)",
      v.cur==="Relevance" && v.segW<=180);
    say("    still a tap target ("+v.tabTap+"px)", v.tabTap>=36);
    // the sort is the order of the list, so it belongs on the list's heading, not adrift
    // under the lede where it read as another fact about the collection
    say("  on one line with a heading for the list (\""+v.headTx+"\")",
      v.headTx.length>0 && v.onOneLine===true && v.headLines===1 && v.aboveFirst===true);

    // relevance is the written order, which is the collection's own argument
    say("  relevance is the order the collection was written in",
      JSON.stringify(v.names)===JSON.stringify(dinner[4].map(([id])=>
        D.DATA.find(r=>r[0]===id)[1])));
    await p.selectOption('.psortsel','az'); await settle(p);
    const az=(await look()).names;
    say("  A–Z sorts by name ("+az.slice(0,2).join(", ")+" … "+az.slice(-1)+")",
      az.length===v.names.length
      && az.every((n,i)=>i===0||az[i-1].localeCompare(n)<=0));
    // nothing has been opened in this browser, so there is nothing to go on and the order
    // must fall back rather than scramble
    await p.selectOption('.psortsel','used'); await settle(p);
    const un=(await look()).names;
    say("  Most used falls back to relevance on a browser with no history",
      JSON.stringify(un)===JSON.stringify(v.names));
    // and once something has been opened it leads
    await p.evaluate(()=>localStorage.setItem("musicatlas.styleuse",
      JSON.stringify({tropicalia:9})));
    await p.selectOption('.psortsel','fit'); await settle(p);
    await p.selectOption('.psortsel','used'); await settle(p);
    const un2=(await look()).names;
    say("    and puts what this browser opens most at the top (\""+un2[0]+"\")",
      un2[0]==="Tropicália" && un2.length===v.names.length);
    await p.selectOption('.psortsel','fit'); await settle(p);

    // the control's one promise: it lands you on something from this collection
    const inHere=new Set(dinner[4].map(([id])=>id));
    // Landing on a style replaces the page stack, so the collection has to be opened
    // again for each try rather than tapped repeatedly: the first draft of this loop
    // clicked a control that was no longer on the page and timed out.
    const backToCollection=async()=>{
      await p.goto(URL); await p.reload();
      await arm(p); await shown(p,"#chart .n"); await settle(p);
      if(await p.evaluate(()=>!document.body.classList.contains("open"))){
        await raise(p);
        await until(p,()=>document.body.classList.contains("open")); await settle(p); }
      await p.click('[data-mode="dinner"]');
      await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]'));
      await settle(p);
    };
    let landed=[];
    for(let i=0;i<4;i++){
      await backToCollection();
      await p.click("[data-pickany]"); await settle(p);
      await new Promise(r=>setTimeout(r,250));
      landed.push(await p.evaluate(()=>location.hash.slice(1)));
    }
    say("  surprise lands inside this collection every time ("+landed.length+" tries)",
      landed.every(h=>inHere.has(h)) ? true : landed.filter(h=>!inHere.has(h)).join(" "));
    say("    and not always on the same one", new Set(landed).size>1);
    await p.close();
  }
  // ---- the same painting wherever you meet a collection ----
  // The page wore the Phosphor glyph while the circle you tapped to get there and the row
  // in the list both wore the painting, so arriving looked like arriving somewhere else.
  {
    const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    if(await p.evaluate(()=>!document.body.classList.contains("open"))){
      await raise(p);
      await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    const miss=[], unloaded=[];
    // three of them, opened for real, rather than reading the markup: a src that never
    // resolves to a file looks identical in the HTML and blank on the page
    for(const k of ["focus","dinner","showkid"]){
      const want=await p.evaluate(key=>{
        const c=document.querySelector('.mcirc[data-mode="'+key+'"] img')
          || document.querySelector('.moderow[data-mode="'+key+'"] img');
        return c?c.getAttribute("src"):null; },k);
      await p.click('[data-mode="'+k+'"]');
      await until(p,()=>!!document.querySelector(".ppage:not([hidden]) .pghead .pgi"));
      await settle(p); await new Promise(r=>setTimeout(r,350));
      const got=await p.evaluate(()=>{
        const i=document.querySelector(".ppage:not([hidden]) .pghead .pgi");
        const im=i&&i.querySelector("img");
        return {src:im?im.getAttribute("src"):null,
          loaded:im?(im.complete&&im.naturalWidth>0):false,
          glyph:!!(i&&i.querySelector(".facefb svg"))}; });
      if(!want || got.src!==want) miss.push(k+": "+got.src+" vs "+want);
      if(!got.loaded) unloaded.push(k);
      if(!got.glyph) miss.push(k+": no glyph behind it");
      // back out of a collection rather than reloading: a mode page pops to the root
      // panel, where the circles are. Only a style panel resets the stack.
      await p.click("#panelBack");
      await until(p,()=>!!document.querySelector('[data-mode="focus"]'));
      await settle(p);
    }
    say("a collection's page wears the same art as the circle you tapped",
      miss.length===0 ? true : miss.join(" | "));
    say("  and the file is really there (3 opened)",
      unloaded.length===0 ? true : "blank: "+unloaded.join(" "));
    // ---- the other direction: a style says which collections it is in ----
    // the pair has to agree both ways. A style panel that names a collection the
    // collection does not name back is a link into a page the style is not on.
    {
      const inmodes=id=>D.MODES.filter(m=>m[4].some(p=>p[0]===id)).map(m=>m[0]);
      // one style in many, one in a couple, one in none
      const many=D.DATA.map(r=>r[0]).sort((a,b)=>inmodes(b).length-inmodes(a).length)[0];
      const none=D.DATA.map(r=>r[0]).find(id=>inmodes(id).length===0);
      // a hash change on a page that is already loaded is a same-document navigation, so
      // the style never opens: goto puts the hash on, reload makes it a real one
      const read=async id=>{
        await p.goto(URL+"#"+id); await p.reload();
        await arm(p); await shown(p,"#chart .n"); await settle(p);
        await p.evaluate(()=>document.body.classList.add("open"));
        await settle(p);
        return p.evaluate(()=>{
          // "no section" only counts as an answer if the panel was built at all
          if(!document.querySelector("#panelBody .sect")) return "panel never built";
          const s=document.querySelector(".sect-inmodes");
          if(!s) return null;
          return {keys:[...s.querySelectorAll(".mcirc")].map(b=>b.dataset.mode),
            aside:(s.querySelector(".sectaside")||{}).textContent,
            labels:[...s.querySelectorAll(".mclbl")].map(e=>e.textContent)}; });
      };
      const got=await read(many);
      const want=inmodes(many);
      note("styles in no collection", D.DATA.filter(r=>!inmodes(r[0]).length).length+" of "+D.DATA.length);
      say("a style's panel names every collection that names it ("+many+", "+want.length+")",
        got && String(got.keys)===String(want) ? true
          : "panel: "+(got?got.keys.join(" "):"no section")+" | data: "+want.join(" "));
      say("  with the count beside the heading",
        got && got.aside===String(want.length) ? true : got&&got.aside);
      // the row scrolls sideways like the artists above it, and from the same edge: a
      // grid here made the section read as a different component from its neighbour
      const row=await p.evaluate(()=>{
        const f=e=>e&&{scrolls:e.scrollWidth>e.clientWidth+2,
          tile:Math.round(e.firstElementChild.getBoundingClientRect().width),
          left:Math.round(e.getBoundingClientRect().left)};
        return {mine:f(document.querySelector(".sect-inmodes .mrow")),
          artists:f(document.querySelector(".whorow.acrow"))}; });
      say("  laid out as the artists row is, and scrolling sideways with it",
        row.mine && row.artists && row.mine.scrolls
          && row.mine.tile===row.artists.tile && row.mine.left===row.artists.left
          ? true : JSON.stringify(row));
      say("  and each circle labelled with the collection's name",
        got && String(got.labels)===String(want.map(k=>D.MODES.find(m=>m[0]===k)[1]))
          ? true : got&&got.labels.join(" | "));
      const empty=await read(none);
      say("a style in no collection gets no section rather than an empty one ("+none+")",
        empty===null ? true : "section present");
      // and the link works from inside a style panel, which is a different stack from
      // the root panel the circles are usually tapped in
      await p.goto(URL+"#"+many); await p.reload();
      await arm(p); await shown(p,"#chart .n"); await settle(p);
      await p.evaluate(()=>document.body.classList.add("open")); await settle(p);
      await p.click(".sect-inmodes .mcirc");
      await until(p,()=>!!document.querySelector(".ppage:not([hidden]) .pghead .pgi"));
      await settle(p);
      const open=await p.evaluate(()=>{
        const u=document.querySelector(".ppage:not([hidden])");
        return u?u.querySelector(".bigttl").textContent.trim():null; });
      say("  and tapping one opens that collection",
        open===D.MODES.find(m=>m[0]===want[0])[1] ? true : open);
      await p.goto(URL); await p.reload();
      await arm(p); await shown(p,"#chart .n"); await settle(p);
      if(await p.evaluate(()=>!document.body.classList.contains("open"))){
        await raise(p);
        await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    }
    await p.close();
  }

  // ---- explore and listen, said apart ----
  // A pick row used to be one button titled "Show on the map". It is two acts now: the
  // row opens the style, and a pill beside it opens the style's playlist in your service,
  // so the shortest path from a mood to hearing something is one tap.
  { const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    if(await p.evaluate(()=>!document.body.classList.contains("open"))){
      await raise(p); await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    await p.click('[data-mode="focus"]');
    await until(p,()=>!!document.querySelector('.ppage[data-p="mode:focus"]')); await settle(p);
    const rows=await p.evaluate(()=>{
      const pks=[...document.querySelectorAll('.ppage:not([hidden]) .picks .pk')];
      return {n:pks.length,
        twoActs:pks.every(k=>k.querySelector("button.pick[data-go]") && k.querySelector("a.pklis")),
        labelled:pks.every(k=>/^Explore /.test(k.querySelector(".pick").getAttribute("aria-label")||"")
          && /^Open the .* playlist in /.test(k.querySelector(".pklis").getAttribute("aria-label")||"")),
        says:[...new Set(pks.map(k=>k.querySelector(".pklis .plsvc").textContent.trim()))],
        apple:pks.every(k=>/music\.apple\.com/.test(k.querySelector(".pklis").href)),
        newTab:pks.every(k=>k.querySelector(".pklis").target==="_blank"),
        tall:pks.every(k=>k.querySelector(".pklis").getBoundingClientRect().height>=36
          && k.getBoundingClientRect().height>=44),
        noPlay:!pks.some(k=>/\bPlay\b/.test(k.textContent))};});
    say("every pick row is a style to explore and a playlist to listen to ("+rows.n+" rows)", rows.twoActs);
    say("  each named for what it does", rows.labelled);
    say("  the pill saying "+JSON.stringify(rows.says.join("/"))+", not Play", rows.says.join("")==="Listen" && rows.noPlay);
    say("  opening the playlist in the stored service, in a new tab", rows.apple && rows.newTab);
    say("  at a tap size", rows.tall);
    // a stored service reaches the collection's pills too
    { const q=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
      await q.addInitScript(()=>{ try{ localStorage.setItem("svc","spotify"); }catch(e){} });
      await q.goto(URL); await arm(q); await shown(q,"#chart .n"); await settle(q);
      if(await q.evaluate(()=>!document.body.classList.contains("open"))){
        await raise(q); await until(q,()=>document.body.classList.contains("open")); await settle(q); }
      await q.click('[data-mode="focus"]');
      await until(q,()=>!!document.querySelector('.ppage[data-p="mode:focus"]')); await settle(q);
      const sp=await q.evaluate(()=>{
        const a=[...document.querySelectorAll('.ppage:not([hidden]) .picks .pklis:not([hidden])')];
        return {n:a.length, all:a.every(x=>/open\.spotify\.com/.test(x.href)
          && /in Spotify$/.test(x.getAttribute("aria-label")||""))};});
      say("  and follow the stored service ("+sp.n+" Spotify pills)", sp.n>0 && sp.all);
      await q.close(); }
    // the row opens the style, and the style says why it was in the collection
    const first=await p.$eval('.ppage:not([hidden]) .picks .pk .pick',e=>e.dataset.go);
    const why=D.MODES.find(m=>m[0]==="focus")[4].find(x=>x[0]===first)[1];
    await p.click('.ppage:not([hidden]) .picks .pk .pick');
    await until(p,t=>location.hash==="#"+t && !!document.querySelector("#chart .n.cur"),first); await settle(p);
    const st=await p.evaluate(()=>({name:(document.querySelector(".pcard .pttl .ptnm")||{}).textContent,
      from:(document.querySelector(".frommode .frommodein")||{}).textContent,
      why:(document.querySelector(".frommode .frommodewhy")||{}).textContent,
      back:(document.querySelector("#panelBack .bklbl")||{}).textContent,
      about:(document.querySelector(".aboutfold .note")||{}).textContent||""}));
    say("the row opens the style ("+st.name+") with the collection it came from named under the title",
      st.from==="In Focus" && st.back==="Focus");
    say("  and the line that put it there: "+JSON.stringify(st.why), st.why===why);
    say("  distinct from what the style is", st.about.indexOf(why)<0);
    // a style reached any other way carries no such line
    await p.goto(URL+"#"+first); await p.reload(); await arm(p); await shown(p,"#chart .n"); await settle(p);
    say("a style reached by link carries no collection line", await p.evaluate(()=>!document.querySelector(".frommode")));
    await p.close(); }

  // ---- the page says what each collection is for ----
  { const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
    await p.goto(URL+"#modes"); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await until(p,()=>!!document.querySelector('.ppage:not([hidden]) .modegrid'));
    const g=await p.evaluate(()=>{
      const t=[...document.querySelectorAll(".ppage:not([hidden]) .modegrid .mcirc")];
      return {n:t.length,
        decks:t.filter(x=>(x.querySelector(".mcdeck")||{}).textContent).length,
        clipped:t.filter(x=>{const d=x.querySelector(".mcdeck"); return d && d.scrollHeight>d.clientHeight+1;})
          .map(x=>x.querySelector(".mclbl").textContent),
        opens:t.every(x=>/Opens the collection/.test(x.getAttribute("aria-label")||"")),
        rowPlain:[...document.querySelectorAll(".sect-modes .mrow .mcirc .mcdeck")].length};});
    say("the Collections page prints each one's line under its name ("+g.decks+" of "+g.n+")", g.decks===g.n);
    say("  none cut off"+(g.clipped.length?": "+g.clipped.join(", "):""), g.clipped.length===0);
    say("  and each tile says it opens the collection", g.opens);
    await p.close(); }
  await b.close();
})();
