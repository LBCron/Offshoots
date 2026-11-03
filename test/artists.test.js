// Key artists are read from the head of a style's note, which is usually the artist list
// but sometimes opens with where the style came from: "UK; named by Whistla 2009".
// Those places were being drawn as artists. A single-word rule would have been the wrong
// fix, since Nirvana, Prince, Chic and Burial are all one word, so the places are named
// instead; this checks both halves of that, the ones that should go and the ones that
// must stay. Each style opens on a fresh page: a hash change on a loaded page is a
// same-document navigation and does not re-select.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
// boot runs on document.fonts.ready and draws the map before it reads the hash, so the
// first drawn node is what says boot has got as far as choosing what to show.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// the chips this suite reads are built by the selection, so a deep link has arrived when
// the map has lit the node it chose
const cur=q=>until(q,()=>!!document.querySelector("#chart .n.cur"));
const selected=async q=>{ await ready(q); await cur(q); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing is
// mutating. The two rows are compared by geometry, so both have to be at rest.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q); };
// A push leaves the page it came from visible until it is hidden 240ms later, so the
// arrival is "the first page still showing is this one" rather than "this one exists".
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  const who=async id=>{ const p=await ctx.newPage(); await p.goto(URL+"#"+id); await selected(p);
    const w=await p.$$eval(".acrow .acirc .aclbl", e=>e.map(x=>x.textContent.trim()).filter(Boolean));
    await p.close(); return w; };

  // a place at the head of the note is not a key artist
  for(const [id,place,keep] of [["futuregarage","UK","Burial"],["amapiano","South Africa","Kabza De Small"],
      ["psytrance","Goa","Astral Projection"],["conjunto","Accordion-led","Flaco Jiménez"]]){
    const w=await who(id);
    say(id+" does not list "+place+" as an artist", !w.includes(place));
    say("  and still lists "+keep, w.includes(keep));
  }
  // one-word artist names must survive, which is what makes the place list necessary
  for(const [id,name] of [["grunge","Nirvana"],["minneapolis","Prince"],["disco","Chic"],["krautrock","Can"]]){
    const w=await who(id);
    say(id+" still lists "+name, w.includes(name));
  }
  // Fred again.. belongs to this lineage and was nowhere on the map
  const fg=await who("futuregarage");
  say("Future Garage lists Fred again..", fg.includes("Fred again.."));
  say("  alongside "+fg.join(", "), fg.length>=3);

  // the playlist roster: search reaches every artist on a style's playlist, while the
  // panel still shows only the handful ART names
  { const p=await ctx.newPage();
    await p.goto(URL); await ready(p);
    // the field is typed into, so wait for it to be on screen rather than merely in the DOM
    await p.$eval("#mapSearch",e=>e.click());
    await until(p,()=>{const e=document.querySelector("#bottomSearch input");
      return !!e && !!e.getClientRects().length;});
    await settle(p);
    // the input handler ranks and redraws the hits on the spot, so there is nothing to wait
    // out but the list redrawing itself
    const find=async t=>{ await p.fill("#bottomSearch input",t); await settle(p);
      return p.$$eval("#bottomSearch .results li",e=>e.map(x=>x.innerText.split("\n")[0])); };
    // none of these four is in ART, so each one fails before the roster exists
    for(const [name,style] of [["Marshall Jefferson","Chicago House"],["Patti Page","Traditional Pop"],
        ["Doug Carn","Spiritual Jazz"],["Bush Tetras","No Wave"]]){
      const r=await find(name);
      say(name+" finds "+style+" ("+(r.join(", ")||"nothing")+")", r.includes(style));
    }
    // and a name on several playlists returns each of those styles
    const th=await find("Talking Heads");
    say("Talking Heads returns "+th.length+" styles ("+th.join(", ")+")", th.length>=3);
    // the row says which artist matched, so the hit does not look arbitrary
    const line=await p.$eval("#bottomSearch .results li button small",e=>e.textContent);
    say("the row names the artist ("+line+")", /Talking Heads/.test(line));
    // the panel is unchanged: still the short curated list, not the whole playlist
    const sizes=await p.evaluate(()=>{
      const A=ROSTER, keys=Object.keys(A);
      return {styles:keys.length, names:keys.reduce((n,k)=>n+A[k].length,0),
        panel:Math.max(...keys.map(k=>(ART[k]||[]).length))};});
    say("roster covers "+sizes.styles+" styles and "+sizes.names+" artists", sizes.names>1500);
    // The same act, spelled two ways, is two rows a few apart on a page that claims to
    // list everyone once. The roster is lifted from playlist credits and the key artists
    // are written by hand, so they disagree on "The", on "&", on commas in "Jr.", and on
    // which accent. 41 styles had at least one such pair; these are four of them.
    {
      const pairs=[["oldtime","The Carter Family"],["motown","The Temptations"],
        ["blueeyed","The Righteous Brothers"],["swing_revival","The Brian Setzer Orchestra"]];
      const same=s=>String(s).toLowerCase().replace(/[\u2018\u2019\u02bc]/g,"'")
        .replace(/\s*&\s*/g," and ").replace(/^the\s+/,"").replace(/[^a-z0-9]+/g," ").trim();
      let dupe="";
      for(const [id] of pairs){
        const q=await ctx.newPage();
        await q.goto(URL+"#"+id); await selected(q);
        await q.click('[data-page="artists"]').catch(()=>{});
        await q.waitForSelector(".amrow",{timeout:8000}).catch(()=>{});
        const names=await q.$$eval(".amrow .lrlbl",e=>e.map(x=>x.textContent.trim()));
        const seen=new Set();
        for(const n of names){ const k=same(n);
          if(seen.has(k)){ dupe=id+": "+n; break; } seen.add(k); }
        await q.close();
        if(dupe) break;
      }
      say("  nobody listed twice under two spellings", dupe || true);
    }
    say("and the panel still lists at most "+sizes.panel+" per style", sizes.panel<=5);

    // track titles, ranked below everything else
    const quiet=async t=>{ await p.fill("#bottomSearch input",t); await settle(p);
      return p.evaluate(()=>{ const r=document.querySelector("#bottomSearch .results");
        return r.hidden?[]:[...r.querySelectorAll("li")].map(x=>x.querySelector(".rnm").textContent); }); };
    for(const [song,style] of [["Blue Monday","Synth-Pop"],["Good Vibrations","California Sound"],
        ["Planet Rock","Detroit Techno"]]){
      const r=await quiet(song);
      say('"'+song+'" finds '+style+" ("+(r.join(", ")||"nothing")+")", r.includes(style));
    }
    // Electro's note already names 'Planet Rock', so that row reads as a note; the rows
    // that matched only on a title are the ones that quote it
    const sline=await p.evaluate(()=>{ const li=[...document.querySelectorAll("#bottomSearch .results li")]
      .find(x=>x.querySelector(".rnm").textContent==="Detroit Techno");
      return li?li.querySelector("small").textContent:""; });
    say("and quotes the title that matched ("+sline+")", /\u201c.*\u201d/.test(sline));
    // a word in a title on most playlists must not outrank a name or a note
    const you=await quiet("you");
    say('"you" leads with the name match ('+you.slice(0,2).join(", ")+")", you[0]==="Youth Crew");
    const songy=await p.evaluate(()=>Object.values(SONGS).filter(v=>v.some(t=>/you/i.test(t))).length);
    say("  though "+songy+" styles have it in a title", songy>50);
    // and a three-letter query does not reach titles at all
    const three=await p.evaluate(()=>Object.values(SONGS).filter(v=>v.some(t=>/the/i.test(t))).length);
    await quiet("the");
    const quoted=await p.evaluate(()=>[...document.querySelectorAll("#bottomSearch .results li button small")]
      .filter(e=>/\u201c/.test(e.textContent)).length);
    say('the '+three+' styles matching "the" only in a title are not offered ('+quoted+' quoted rows)',
      three>0 && quoted===0);
    await p.close(); }

  // ---------- the row, and the roster behind it ----------
  // The chips wrapped across three ragged rows, which gave the longest name the widest
  // row and a hole beside the shortest. One line that scrolls now, with every artist the
  // map knows behind the heading: 135 styles carry a roster that nothing had ever shown.
  { const p=await ctx.newPage(); const errs=[];
    p.on("pageerror",e=>errs.push(String(e)));
    await p.goto(URL); await ready(p);
    await p.evaluate(()=>{const n=document.querySelector("#chart .n[data-id=dub]");
      n.dispatchEvent(new MouseEvent("click",{bubbles:true}));});
    // the click selects, which rebuilds the panel the row is measured off: the map lighting
    // the node is what says the selection landed
    await until(p,()=>{const n=document.querySelector("#chart .n.cur");
      return !!n && n.dataset.id==="dub";});
    await settle(p);
    const chipNames=await p.$$eval(".acrow .aclbl",e=>e.map(x=>x.textContent));
    const row=await p.evaluate(()=>{
      const r=document.querySelector(".acrow"), h=document.querySelector('[data-page="artists"]');
      if(!r) return null;
      const c=[...r.querySelectorAll(".acirc")];
      return {chips:c.length, nowrap:getComputedStyle(r).flexWrap==="nowrap",
        scrolls:r.scrollWidth>r.clientWidth+1,
        oneLine:[...new Set(c.map(x=>Math.round(x.getBoundingClientRect().top)))].length===1,
        // Something in every disc, and the role on every circle. It used to be a symbol
        // per kind of act in all of them; most now carry a photo, one of the act's
        // sleeves, or a silhouette, and the symbol is what is left when there is none of
        // those. The role class stays either way: it is what colours the row.
        symbols:c.every(x=>{const a=x.querySelector(".aco");
          return !!a && (!!a.querySelector("svg") || !!a.querySelector("img"))
            && /\br-\w+/.test(x.className);}),
        round:c.every(x=>{const q=x.querySelector(".aco").getBoundingClientRect();
          return Math.abs(q.width-q.height)<=1 && q.width>=56;}),
        isBtn:!!h && h.tagName==="BUTTON" && h.dataset.page==="artists",
        count:h?+(h.querySelector(".subct,.sectaside")||{}).textContent:0,
        // the tap floor steps down on a pointer tier, so ask the page rather than assume
        floor:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tap"))||44,
        tap:h?Math.round(h.getBoundingClientRect().height):0};});
    say("the key artists are one scrolling line of "+(row&&row.chips),
      !!row && row.nowrap && row.oneLine && row.scrolls);
    say("  each a circle carrying a face, a sleeve or a figure",
      !!row && row.symbols && row.round);
    // four circles landing exactly on the screen edge read as the end of the row, so the
    // tile is sized from the row and the fourth is always cut about in half
    const peek=await p.evaluate(()=>{
      const row=document.querySelector(".acrow"), rb=row.getBoundingClientRect();
      const c=[...row.querySelectorAll(".acirc")];
      const part=c.filter(x=>{const q=x.getBoundingClientRect();
        return q.left<rb.right-6 && q.right>rb.right+6;});
      if(!part.length) return {frac:0};
      const q=part[0].getBoundingClientRect();
      return {frac:Math.round(100*(rb.right-q.left)/q.width),
        full:c.filter(x=>x.getBoundingClientRect().right<=rb.right+0.5).length};});
    say("  with one cut "+peek.frac+"% at the edge, after "+peek.full,
      peek.frac>=25 && peek.frac<=75);
    say("  with a heading that opens the rest ("+(row&&row.count)+")",
      !!row && row.isBtn && row.count>row.chips);
    say("  and that heading is "+(row&&row.tap)+"px to tap", !!row && row.tap>=row.floor);
    await p.click('[data-page="artists"]'); await onPage(p,"artists");
    const pg=await p.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
      const rows=[...u.querySelectorAll(".amrow")];
      return {title:(u.querySelector(".bigttl .mn")||{}).textContent,
        n:rows.length, years:u.querySelectorAll(".amyr").length,
        spans:[...u.querySelectorAll(".amyr")].map(x=>x.textContent),
        names:rows.map(x=>x.querySelector(".lrlbl").textContent),
        blank:rows.every(x=>x.target==="_blank" && /noopener/.test(x.rel)),
        hrefs:rows.every(x=>/^https?:/.test(x.href)),
        tap:Math.min(...rows.map(x=>Math.round(x.getBoundingClientRect().height)))};});
    say("tapping it lists all "+pg.n+" on a page called "+pg.title,
      pg.title==="Key artists" && pg.n===(row&&row.count));
    // the panel's three or four lead the page, and each row carries the years that
    // artist was making music, which is the one fact a bare name withholds
    say("  the panel's own first", pg.names.slice(0,row.chips).join("/")
      ===chipNames.join("/"));
    say("  "+pg.years+" of "+pg.n+" carrying their years", pg.years>=Math.ceil(pg.n*0.6));
    say("  every span a plausible shape",
      pg.spans.every(t=>/^(1[89]|20)\d\d(\u2013((1[89]|20)?\d\d)?)?$/.test(t)));
    say("  nobody listed twice", new Set(pg.names).size===pg.n);
    say("  each opening safely in its own tab", pg.blank && pg.hrefs);
    say("  rows at least "+pg.tap+"px", pg.tap>=(row?row.floor:44));
    // the eight kinds are eight colours, each one readable with a white symbol on it
    const pal=await p.evaluate(()=>{
      const want=["band","voice","mc","guitar","keys","player","dj","studio","none"];
      const probe=document.createElement("i"); probe.style.display="none";
      document.body.appendChild(probe);
      const out={};
      for(const r of want){ probe.className="acirc r-"+r;
        out[r]=getComputedStyle(probe).getPropertyValue("--rc").trim(); }
      probe.remove(); return out;});
    const hex=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
    const lum=h=>{const [r,g,b]=hex(h).map(v=>{v/=255;
      return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}); return .2126*r+.7152*g+.0722*b;};
    const vals=Object.values(pal);
    say("eight kinds, "+new Set(vals).size+" colours, plus a fallback",
      vals.every(v=>/^#[0-9a-f]{6}$/i.test(v)) && new Set(vals).size===vals.length);
    const worst=Math.min(...vals.map(v=>1.05/(lum(v)+.05)));
    say("  the faintest reads at "+worst.toFixed(2)+":1 under a white symbol", worst>=3);
    say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
    await p.close(); }

  // the roles themselves: what the map claims about each act, checked for shape
  { const p=await ctx.newPage();
    await p.goto(URL); await ready(p);
    const t=await p.evaluate(()=>{
      const OK=["band","voice","mc","guitar","keys","player","dj","studio"];
      const vals=Object.values(ROLE);
      const key=new Set(); for(const d of DATA) (ART[d[0]]||[]).forEach(x=>key.add(x));
      const spread={}; vals.forEach(v=>spread[v]=(spread[v]||0)+1);
      return {n:vals.length, odd:vals.filter(v=>OK.indexOf(v)<0).length,
        kinds:Object.keys(spread).length,
        covered:[...key].filter(x=>ROLE[x]).length, key:key.size,
        spread};});
    say(t.n+" acts classified, all into one of the eight", t.odd===0 && t.kinds===8);
    say("  covering "+t.covered+" of the "+t.key+" key artists",
      t.covered>=Math.floor(t.key*0.9));
    // one bucket swallowing everything would mean the symbols say nothing
    say("  no kind holding more than half ("
      +Object.entries(t.spread).sort((a,b)=>b[1]-a[1])[0].join(" ")+")",
      Math.max(...Object.values(t.spread))<t.n*0.5);
    await p.close(); }

  // a style with no roster opens a page too: the row scrolls, so the page is the only
  // place the whole set sits still, however short it is
  { const p=await ctx.newPage();
    await p.goto(URL); await ready(p);
    const plain=await p.evaluate(()=>{
      // no ROSTER entry at all means there is nothing behind the chips to open
      const bare=DATA.map(r=>r[0]).find(id=>
        (ART[id]||[]).length && !(typeof ROSTER!=="undefined" && ROSTER[id]));
      if(!bare) return null;
      const node=document.querySelector(`#chart .n[data-id="${bare}"]`);
      if(!node) return {skip:true};
      node.dispatchEvent(new MouseEvent("click",{bubbles:true}));
      return {id:bare};});
    // the heading is drawn by the panel the click rebuilds, so the wait belongs outside the
    // page: the map lighting the chosen node is what says that rebuild has happened
    if(plain && plain.id){
      // the artists heading is a section heading now, not a sub-heading inside Listen
      await until(p,id=>{const n=document.querySelector("#chart .n.cur");
        return !!n && n.dataset.id===id
          && !!document.querySelector(".sect-artists .secthead");},plain.id);
      await settle(p);
      Object.assign(plain, await p.evaluate(()=>{
        const h=document.querySelector(".sect-artists .secthead");
        return {tag:h?h.tagName:"", go:!!document.querySelector('[data-page="artists"]')};}));
    }
    if(!plain) say("every style with artists has a roster behind it", true);
    else if(plain.skip) say("the no-roster style is off the rendered map", true);
    else say("a style with no roster still opens a page ("+plain.id+")",
      plain.tag==="BUTTON" && plain.go===true);
    await p.close(); }

  // ---------- the service control travels with the links ----------
  // The page used to state the service in its lede, which is a fact with no handle on it
  // and goes stale the moment you change it elsewhere. The control itself is on the page
  // now, where the links it governs are.
  { const q=await ctx.newPage();
    await q.goto(URL+"#darkwave"); await q.waitForTimeout(700);
    const head=await q.$('[data-page="artists"]');
    if(!head) say("the key artists page carries the service control", "no sub-page here");
    else {
      await head.click(); await q.waitForTimeout(900);
      const now=()=>q.evaluate(()=>{
        const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
        const rows=[...u.querySelectorAll(".amrow")];
        return {picker:(u.querySelector(".svctx")||{}).textContent,
          select:!!u.querySelector("select.svcsel"),
          hrefs:rows.map(a=>a.href), n:rows.length,
          lede:(u.querySelector(".pglede")||{}).textContent||""};});

      const before=await now();
      say("the key artists page carries the service control ("+before.picker+")",
        !!before.picker && before.select);

      // a word and a chevron with nothing round them read as part of the heading. The
      // outline is what says it is a control, so it is checked on both surfaces it
      // appears on, and checked as drawn rather than as written: a .5px border on a
      // 2x screen is reported as 1px used, and 0 would mean no edge at all.
      // scoped to whatever is actually showing: while a page is pushed, the card beneath
      // still holds its own copy of this control at zero height, and querySelector finds
      // that one first
      const edge=async()=>q.evaluate(()=>{
        const up=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
        const e=(up||document).querySelector(".svcinline"); if(!e) return null;
        const cs=getComputedStyle(e), r=e.getBoundingClientRect();
        return {w:parseFloat(cs.borderTopWidth), style:cs.borderTopStyle,
          colour:cs.borderTopColor, h:Math.round(r.height),
          round:parseFloat(cs.borderTopLeftRadius)>8};});
      // it says what it is and that it sticks, in both the hover tooltip and the label a
      // screen reader reads, and the label names the one that is on so it cannot go stale
      const told=await q.evaluate(()=>{
        const up=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
        const e=(up||document).querySelector(".svcinline");
        return {tip:e.getAttribute("title")||"",
          label:e.querySelector("select").getAttribute("aria-label")||""};});
      say("  saying what it does and that the choice is kept",
        /playlists and artists open/i.test(told.tip) && /kept on this device/i.test(told.tip)
        && /kept on this device/i.test(told.label));
      say("  and naming the one that is on ("+(told.label.match(/Currently [^.]+/)||[""])[0]+")",
        /Currently (Apple Music|Spotify|Qobuz)\./.test(told.label));

      const onPage=await edge();
      say("  with a hairline round it ("+onPage.w+"px, "+onPage.h+"px tall)",
        onPage.w>0 && onPage.w<=1 && onPage.style==="solid" && onPage.round
        && !/rgba\(0, 0, 0, 0\)|transparent/.test(onPage.colour) && onPage.h>=28);
      say("  and no longer names the service in prose instead",
        !/Apple Music|Spotify|Qobuz/.test(before.lede));
      say("  with every row pointing at it ("+before.n+" rows)",
        before.n>2 && before.hrefs.every(h=>/music\.apple\.com/.test(h)));

      await q.selectOption(".ppage:not([hidden]) select.svcsel","spotify");
      await q.waitForTimeout(500);
      const after=await now();
      say("changing it on the page moves every row with it",
        after.picker==="Spotify" && after.hrefs.length===before.n
        && after.hrefs.every(h=>/open\.spotify\.com/.test(h)));
      say("  and the label it reads out with them", await q.evaluate(()=>{
        const up=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
        const l=(up||document).querySelector("select.svcsel").getAttribute("aria-label")||"";
        return /Currently Spotify\./.test(l);}));

      // the same switch has to reach the circles in the row behind this page, which is
      // what the old a.am selector missed: it matched the chips and neither of these
      await q.click("#panelBack"); await q.waitForTimeout(800);
      const circles=await q.evaluate(()=>[...document.querySelectorAll(".acirc")].map(a=>a.href));
      say("  and the circles behind it too ("+circles.length+")",
        circles.length>0 && circles.every(h=>/open\.spotify\.com/.test(h)));
      await q.selectOption("select.svcsel","apple"); await q.waitForTimeout(400);
      // the circles check above already came back, so this is the style panel
      const onPanel=await edge();
      say("  and the same outline on the style panel behind it ("+onPanel.w+"px)",
        onPanel.w>0 && onPanel.w<=1 && onPanel.style==="solid"
        && !/rgba\(0, 0, 0, 0\)|transparent/.test(onPanel.colour));
    }
    await q.close(); }

  // ---------- the page agrees with the row ----------
  // A name you saw as a circle upstairs is the same act on the page behind the heading, so
  // it wears the same symbol and the same colour there. Checked by name rather than by
  // position: the page holds everyone and the row holds the first few, so the orders do
  // not match and a positional check would pass on a coincidence.
  { const q=await ctx.newPage();
    await q.goto(URL+"#british_blues"); await q.waitForTimeout(700);
    const head=await q.$('[data-page="artists"]');
    if(!head) say("the key artists page carries the role circles", "no sub-page to open");
    else {
      await head.click(); await q.waitForTimeout(900);
      const pair=await q.evaluate(()=>{
        const role=e=>((e.className||"")+"").match(/r-[a-z]+/);
        const rows=[...document.querySelectorAll(".amrow")].map(a=>({
          name:a.querySelector(".lrlbl").textContent,
          role:(role(a)||[""])[0],
          glyph:!!a.querySelector(".lrico svg"),
          photo:!!a.querySelector(".lrico img"),
          tinted:getComputedStyle(a.querySelector(".lrico")).backgroundColor,
          fill:getComputedStyle(a.querySelector(".lrico")).backgroundImage,
          ink:getComputedStyle(a.querySelector(".lrico")).color}));
        return {rows, roles:[...new Set(rows.map(r=>r.role))]};});
      say("every artist on the page has a disc of their own ("
        +pair.rows.length+" of them)",
        pair.rows.length>3 && pair.rows.every(r=>(r.glyph||r.photo)
          && /^r-[a-z]+$/.test(r.role)));
      // the colour is in the glyph, so that is where to look for it
      say("  coloured by what the act is, not all alike ("+pair.roles.length+" kinds here)",
        pair.roles.length>1 && new Set(pair.rows.map(r=>r.ink)).size>1);
      // Three cases now, and the differences are the design. A portrait where there is
      // one; one of their records where there is not; and a silhouette where there is
      // neither, which is most of them. The glyph is what is left when even that is
      // missing, which means the whole folder is gone.
      const faced=pair.rows.filter(r=>r.photo);
      const bare=pair.rows.filter(r=>!r.photo);
      say("  "+bare.length+" with no image of any kind left, each the glyph alone",
        bare.every(r=>!/gradient/.test(r.fill)
          && !/rgb/.test(r.tinted.replace(/rgba\(0, 0, 0, 0\)/,""))));
      say("  and not white, which needs a disc to sit on",
        bare.every(r=>r.ink!=="rgb(255, 255, 255)"));
      // With one: the portrait fills the disc the glyph was drawn in, same box, so a row
      // that mixes the two keeps one rhythm rather than reading as photos among icons.
      if(faced.length) say("  "+faced.length+" with one, filling the same disc",
        faced.every(r=>/rgb/.test(r.tinted)));

      // Every portrait the map promises has to be on disk. PHOTO is keyed by the artist
      // name the map already uses, so a renamed artist silently loses a face that is
      // still sitting in the folder, and a typo points at a file nobody wrote.
      const files=await q.evaluate(()=>Object.values(PHOTO));
      say("  "+files.length+" portraits, every filename distinct",
        new Set(files).size===files.length);

      // and the role the page gives an act is the role the row gave it
      await q.click("#panelBack"); await q.waitForTimeout(800);
      const same=await q.evaluate(()=>{
        const role=e=>(((e.className||"")+"").match(/r-[a-z]+/)||[""])[0];
        const circles={};
        document.querySelectorAll(".acirc").forEach(a=>{
          const n=a.querySelector(".aclbl"); if(n) circles[n.textContent.trim()]=role(a);});
        return circles;});
      await (await q.$('[data-page="artists"]')).click(); await q.waitForTimeout(900);
      const page=await q.evaluate(()=>{
        const role=e=>(((e.className||"")+"").match(/r-[a-z]+/)||[""])[0];
        const out={};
        document.querySelectorAll(".amrow").forEach(a=>{
          out[a.querySelector(".lrlbl").textContent.trim()]=role(a);});
        return out;});
      const shared=Object.keys(same).filter(n=>page[n]);
      const agree=shared.filter(n=>same[n]===page[n]);
      say("  and the ones on both agree on what they are ("+agree.length+" of "+shared.length+")",
        shared.length>0 && agree.length===shared.length);
    }
    await q.close(); }

  // ---------- the two circle rows are one component ----------
  // Key artists on a style panel and the ways in on the overview are the same shape: a
  // heading that opens the full set, then filled circles you swipe. They were written
  // twice and drifted — a 76px circle against 80, a 36px glyph against 41, two label
  // sizes, two heading weights — which reads as a near-miss rather than a hierarchy.
  // This measures them against each other instead of against numbers typed here, so the
  // next change to one has to be made to both.
  // newContext wants the viewport nested; passed flat, Playwright ignores the unknown keys
  // and quietly hands back a 1280x720 desktop. This block spent two months of its short life
  // comparing the two rows at desktop width while saying phone, and waiting out two 30s
  // action timeouts for a #grab that is not on a desktop at all.
  { const M={viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:2};
    const c2=await b.newContext(M);
    const geom=async (hash,tile,circ,lbl,row,head)=>{
      const q=await c2.newPage();
      await q.goto(URL+hash); await ready(q);
      if(hash) await cur(q);
      // #grab is the phone sheet's handle. Ask whether it is on screen before clicking it:
      // where the layout has no peek there is nothing to expand, and a click on a control
      // that will never appear is a thirty-second sleep wearing a click's clothes.
      const handle=await q.$eval("#grab",e=>!!e.getClientRects().length).catch(()=>false);
      if(handle){ await raise(q); await opened(q); }
      // wait for the row itself rather than a stopwatch: under a loaded machine the sheet
      // can still be opening, and a missing row would read as the two rows disagreeing
      await q.waitForSelector(tile,{state:"attached",timeout:8000}).catch(()=>{});
      await settle(q);
      const g=await q.evaluate(([tile,circ,lbl,row,head])=>{
        const t=document.querySelector(tile); if(!t) return null;
        const co=t.querySelector(circ), l=t.querySelector(lbl),
              r=document.querySelector(row), h=document.querySelector(head),
              cv=h&&h.querySelector(".sectcv svg");
        // whichever circle in this row still shows a symbol: most of the artists now
        // carry a photo, a sleeve or a silhouette instead, and the first one in the row
        // used to be assumed to be a glyph and crashed the check when it was not
        const sv=[...document.querySelectorAll(circ)]
          .map(x=>x.querySelector(":scope > svg")).find(Boolean)
          || co.querySelector("svg");
        // the chevron is a sibling of the title, not inside it: measure type off whichever
        // element carries the words, and the chevron off the heading as a whole
        const ht=(h&&h.querySelector(".secttl"))||h;
        const cs=getComputedStyle, px=e=>+e.getBoundingClientRect().width.toFixed(1);
        // A bounding rect is the PAINTED box, so anything inside a rotated parent
        // measures bigger than it is: the ways in lean now, and their 41px glyph came
        // back as 43.4. The laid-out width is what the two rows have to agree on.
        const lay=e=>+parseFloat(cs(e).width).toFixed(1);
        return {tile:px(t), circle:px(co), glyph:sv?lay(sv):0, gap:cs(r).gap,
          label:cs(l).fontSize+"/"+cs(l).fontWeight,
          stack:cs(t).gap, radius:cs(co).borderRadius,
          head:ht?cs(ht).fontSize+"/"+cs(ht).fontWeight:"none",
          chev:cv?px(cv):0};
      },[tile,circ,lbl,row,head]);
      await q.close(); return g; };

    const ways = await geom("", ".mcirc", ".mco", ".mclbl", ".mrow", ".secthead.sectgo");
    const arts = await geom("#gospel", ".acirc", ".aco", ".aclbl", ".acrow", '[data-page="artists"]');
    if(!ways || !arts) say("both circle rows are on screen to compare", false);
    else {
      const same=k=>String(ways[k])===String(arts[k]);
      const show=k=>k+" "+ways[k]+" vs "+arts[k];
      // They were one component until the ways in became jewel cases. What still has to
      // match is everything that makes two rows read as a pair: the tile they sit in,
      // the glyph, the gaps and the label. What is now deliberately different is the
      // sleeve itself, and that difference is the point, so it gets its own check rather
      // than being quietly dropped from the list.
      // glyph only where both rows still have one to measure: the artists row shows a
      // symbol now only when an act has no photo, no sleeve and no silhouette either
      const keys=["tile","gap","label","stack"].concat(
        ways.glyph&&arts.glyph ? ["glyph"] : []);
      const off=keys.filter(k=>!same(k));
      say("the ways in and key artists rows are laid out the same"
        +(off.length?" — "+off.map(show).join(", "):" ("+ways.glyph+"px glyph, "
          +ways.gap+" apart, "+ways.label.split("/")[0]+" label)"),
        off.length===0);
      // They are one component again. The collections were a jewel case and then a
      // record sleeve, both standing in for art that did not exist; it does now, and a
      // picture wants the same round frame the artists wear. So the shape that used to
      // be the one deliberate difference is the last thing that had to come back.
      say("  including the shape, which is round on both ("+ways.radius
        +" vs "+arts.radius+")", ways.radius==="50%" && arts.radius==="50%");
      // the heading above each row carries the same weight: a lighter one on either side
      // would say the rows rank differently when they do not
      say("  and their headings match"+(ways.head===arts.head?" ("+ways.head+")":": "
        +ways.head+" vs "+arts.head), ways.head===arts.head);
      say("  down to the chevron that opens them", ways.chev===arts.chev && ways.chev>0);
      // the measured tile is what forces a half circle at the right edge; if it ever goes
      // back to a fixed width the peek is a coincidence again
      say("  sized so one is cut off at the edge, not by a fixed guess",
        ways.tile>ways.circle && ways.tile<ways.circle*1.6);
    }
    await c2.close(); }

  // An Apple artist link is born as a search URL and is upgraded to the artist page once
  // the id is known. The upgrade used to select a.am only, which is the inline link in the
  // note; the circles (a.acirc) and the Key artists rows (a.amrow) carry the same job and
  // were never touched, so they stayed on /search for good. Seeding the cache makes this
  // a check of the wiring rather than of Apple's API, which the test box cannot reach.
  { const ID=39960597;
    // read a real key artist off the panel first, so the seed matches whatever is there
    const scout=await ctx.newPage();
    await scout.goto(URL+"#garage"); await selected(scout); await opened(scout);
    const who=await scout.evaluate(()=>{
      const a=document.querySelector("a.acirc[data-name]");
      return a?a.dataset.name:""; });
    await scout.close();
    if(!who) say("a key artist circle links to the artist, not a search","no circles here");
    else {
      const q=await ctx.newPage();
      await q.addInitScript(n=>{ try{ localStorage.setItem("amid",
        JSON.stringify({[n]:39960597})) }catch(e){} }, who);
      await q.goto(URL+"#garage"); await selected(q); await opened(q);
      const circ=await q.evaluate(n=>{
        const a=[...document.querySelectorAll("a.acirc[data-name]")]
          .find(x=>x.dataset.name===n);
        return a?a.getAttribute("href"):"gone"; }, who);
      say("a key artist circle links to the artist, not a search ("+who+")",
        circ==="https://music.apple.com/us/artist/"+ID);

      const head=await q.$('[data-page="artists"]');
      if(!head) say("  and so does the row on the Key artists page","no sub-page here");
      else {
        await head.click(); await onPage(q,"artists");
        const row=await q.evaluate(n=>{
          const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
          const a=[...u.querySelectorAll("a.amrow[data-name]")]
            .find(x=>x.dataset.name===n);
          return a?a.getAttribute("href"):"gone"; }, who);
        // a pushed page builds its links after setSvc has run, so the push has to ask again
        say("  and so does the row on the Key artists page"
          +(row==="https://music.apple.com/us/artist/"+ID?"":": "+row),
          row==="https://music.apple.com/us/artist/"+ID);
      }
      await q.close(); } }

  // ---- the stand-in, where there is no portrait and no record ----
  // 3,353 of the 4,850 acts the map names have neither, and eight role glyphs were
  // carrying all of them: a panel could show four circles wearing the same microphone.
  // These are 144 anonymous silhouettes, and the claims worth holding are that nobody who
  // has a real image loses it, that a name always draws the same one, and that the file
  // named is a file that exists.
  const fs=require("fs"), path=require("path");
  const FBDIR=path.join(__dirname,"..","artists","fallbacks");
  const cat=JSON.parse(fs.readFileSync(path.join(FBDIR,"catalog.json"),"utf8"));
  const known=new Set(cat.entries.map(e=>e.file));
  say("the library is on disk and matches its catalog ("+cat.entries.length+")",
    cat.entries.every(e=>fs.existsSync(path.join(FBDIR,e.file))));
  { const hash=require("crypto").createHash;
    const wrong=cat.entries.filter(e=>hash("sha256")
      .update(fs.readFileSync(path.join(FBDIR,e.file))).digest("hex")!==e.sha256);
    say("  every file byte for byte what was handed over",
      wrong.length===0 ? true : wrong.slice(0,3).map(e=>e.file).join(", ")); }

  const PHONE={width:393,height:852,isMobile:true,hasTouch:true,deviceScaleFactor:2};
  { const q=await b.newPage({viewport:PHONE});
    await q.goto(URL+"#acidhouse"); await selected(q);
    await raise(q); await opened(q);
    const head=await q.$('[data-page="artists"]');
    if(head){ await head.click(); await onPage(q,"artists"); }
    const rows=await q.evaluate(()=>{
      const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden).pop();
      return [...u.querySelectorAll("a.amrow[data-name]")].map(a=>{
        const i=a.querySelector(".lrico"), img=i&&i.querySelector("img");
        return {name:a.dataset.name, fb:!!i&&i.classList.contains("hasfb"),
          cov:!!i&&i.classList.contains("hascov"),
          src:img?img.getAttribute("src"):"",
          glyph:!!i&&!!i.querySelector(".facefb svg,:scope > svg"),
          torn:!!img && img.complete && img.naturalWidth===0,
          w:img?img.naturalWidth:0}; }); });
    const fbs=rows.filter(r=>r.fb);
    say("the page draws "+fbs.length+" stand-ins among "+rows.length+" artists", fbs.length>0);
    say("  every one of them a file in the catalog",
      fbs.every(r=>known.has(r.src.split("/").pop())));
    say("  none of them torn", fbs.every(r=>!r.torn && r.w===256));
    // the silhouette is cut out of its square, so a symbol behind it shows through the
    // gaps between an arm and a body and the row wears both at once
    say("  and no glyph showing through the gaps", fbs.every(r=>!r.glyph));
    // nobody who has a real image may lose it to one
    const D=require("../src/data.js");
    const stolen=fbs.filter(r=>(D.PHOTO||{})[r.name] || (D.COVERART||{})[r.name]);
    say("  and nobody with a photo or a sleeve was given one",
      stolen.length===0 ? true : stolen.map(r=>r.name).join(", "));
    await q.close(); }

  // the same name, the same figure: in the circle row, in the list, and on a fresh load
  { const want=["Phuture","Mr. Fingers","DJ Pierre"];
    const seen=[];
    for(let pass=0;pass<2;pass++){
      const q=await b.newPage({viewport:PHONE});
      await q.goto(URL+"#acidhouse"); await selected(q);
      await raise(q); await opened(q);
      const circles=await q.evaluate(n=>Object.fromEntries(
        [...document.querySelectorAll("a.acirc[data-name]")]
          .filter(a=>n.indexOf(a.dataset.name)>=0)
          .map(a=>[a.dataset.name,(a.querySelector(".hasfb img")||{}).getAttribute
            ? a.querySelector(".hasfb img").getAttribute("src") : ""])), want);
      const head=await q.$('[data-page="artists"]');
      if(head){ await head.click(); await onPage(q,"artists"); }
      const list=await q.evaluate(n=>Object.fromEntries(
        [...document.querySelectorAll("a.amrow[data-name]")]
          .filter(a=>n.indexOf(a.dataset.name)>=0)
          .map(a=>{const i=a.querySelector(".hasfb img");
            return [a.dataset.name, i?i.getAttribute("src"):""];})), want);
      seen.push({circles,list});
      await q.close();
    }
    const [a,c]=seen;
    const same=Object.keys(a.list).filter(n=>a.list[n] && a.circles[n])
      .every(n=>a.circles[n]===a.list[n]);
    note("drawn for "+Object.keys(a.list).join(", "),
      Object.values(a.list).map(v=>v.split("/").pop()).join(", "));
    say("the row and the list draw the same figure for a name", same);
    say("  and so does a second load", JSON.stringify(a.list)===JSON.stringify(c.list)); }

  // the pool comes from the role table the app already keeps, not from the name or the
  // style: a band gets a group, a DJ gets a DJ, and anything unstated gets a plain figure
  { const D=require("../src/data.js");
    const pick=n=>{ let h=2166136261;
      for(let i=0;i<n.length;i++){ h^=n.charCodeAt(i); h=Math.imul(h,16777619); }
      return h>>>0; };
    const seq=(p,k)=>Array.from({length:k},(_,i)=>p+"-"+String(i+1).padStart(2,"0")+".png");
    const pools={portrait:seq("solo",24), singer:seq("singer",24), keyboard:seq("keyboard",8),
      dj:seq("dj",8), quartet:seq("group-04",12),
      guitar:seq("acoustic",12).concat(seq("electric",16))};
    const role={band:"quartet",voice:"singer",mc:"singer",guitar:"guitar",
      keys:"keyboard",dj:"dj",player:"portrait",studio:"portrait",none:"portrait"};
    const names=new Set();
    for(const l of Object.values(D.ROSTER||{})) for(const n of l) names.add(n);
    const need=[...names].filter(n=>!(D.PHOTO||{})[n] && !(D.COVERART||{})[n]);
    const tally={};
    for(const n of need){ const r=(D.ROLE||{})[n]||"none";
      const p=pools[role[r]||"portrait"];
      const f=p[pick(n)%p.length];
      if(!known.has(f)){ tally.MISSING=(tally.MISSING||0)+1; continue; }
      tally[r]=(tally[r]||0)+1; }
    note(need.length+" acts need one, by what the role table says", JSON.stringify(tally));
    say("every one of them names a file that exists", !tally.MISSING);
    // and the pools are used evenly enough that a panel is not four of the same figure
    const spread={};
    for(const n of need.filter(n=>((D.ROLE||{})[n]||"none")==="none")){
      const p=pools.portrait, f=p[pick(n)%p.length];
      spread[f]=(spread[f]||0)+1; }
    const counts=Object.values(spread).sort((a,b)=>a-b);
    say("  and the plain figures come up evenly ("+counts[0]+" to "
      + counts[counts.length-1]+" across "+counts.length+" of 24)",
      counts.length===24 && counts[counts.length-1] < counts[0]*1.6); }

  await b.close();
})();
