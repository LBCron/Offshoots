// Go deeper: the curated reading on a style panel.
//
// This is the first content in the app that can be wrong in a way a reader notices. A
// playlist either plays or it does not; a link can resolve to nothing, or to a summary
// of what the panel already said. So the suite checks the shape of the table as much as
// the rendering: every row complete, every link https and unique, no encyclopedias, and
// a note on every one, since the note is what makes it worth a tap.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const M={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
// boot runs on document.fonts.ready, so a loaded document is not a booted one. The first
// drawn node is what says boot got as far as choosing what to show.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// a deep link selects on boot, and the panel this suite reads is built by that selection
const selected=async q=>{ await ready(q);
  await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing is
// mutating. Row heights are measured here, so the sheet has to have come to rest.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q); };

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  let p=await b.newPage({viewport:M}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL); await ready(p);

  const t=await p.evaluate(()=>{
    const ids=new Set(DATA.map(r=>r[0]));
    const rows=[]; for(const k in READ) for(const r of READ[k]) rows.push([k,r]);
    const urls=rows.map(([,r])=>r[0]);
    return {styles:Object.keys(READ).length, n:rows.length,
      known:Object.keys(READ).every(k=>ids.has(k)),
      // eight fields, and a ninth on a 33 1/3 naming the record it is about
      wide:rows.every(([,r])=>r.length===8 || (r.length===9 && r[4]==="33 1/3")),
      byd:rows.filter(([,r])=>r.length===9).length,
      https:urls.every(u=>u.indexOf("https://")===0),
      // one piece can legitimately cover two styles, so the rule is per style
      uniq:Object.keys(READ).every(k=>{const u=READ[k].map(r=>r[0]);
        return new Set(u).size===u.length;}),
      shared:urls.length-new Set(urls).size,
      enc:urls.filter(u=>/wikipedia|britannica|fandom|discogs|allmusic|rateyourmusic/i.test(u)).length,
      aids:urls.filter(u=>/findingaids|archival_objects|\/repositories\/\d|archivesspace/i.test(u)).length,
      // every row has to earn its tap. A 33 1/3 earns it by naming the record, since
       // the series and the title say the rest; everything else needs a note saying why.
      noted:rows.every(([,r])=>{
        const note = typeof r[6]==="string" && r[6].length>20;
        return r[4]==="33 1/3" ? (note || (r[8]||"").length>0) : note;}),
      dashes:rows.filter(([,r])=>/—/.test(r[6])).length,
      // 0 means undated on purpose: plenty of what is worth watching carries no date
      // anywhere on it, and the row drops the year rather than inventing one. Everything
      // else still has to be a real year, so a typo stays a failure.
      years:rows.every(([,r])=>r[3]===0 || (r[3]>=1900 && r[3]<=2026)),
      access:[...new Set(rows.map(([,r])=>r[5]))].sort().join("|"),
      kinds:[...new Set(rows.map(([,r])=>r[4]))].length,
      media:[...new Set(rows.map(([,r])=>r[7]))].sort().join("|")};});

  say(t.n+" reads across "+t.styles+" styles", t.n>0 && t.styles>0);
  say("every style key is a style on the map", t.known);
  say("every row carries its fields, "+t.byd+" of them naming a record", t.wide);
  say("every link is https", t.https);
  say("no link appears twice on one style", t.uniq);
  say("and "+t.shared+" placements of a piece on more than one style", t.shared>=0);
  say("no encyclopedias or databases ("+t.enc+")", t.enc===0);
  say("no catalogue records or finding aids ("+t.aids+")", t.aids===0);
  say("every one says why it is worth opening", t.noted);
  say("and says it without an em dash", t.dashes===0);
  say("years are plausible", t.years);
  say("access is blank or named ("+t.access+")",
    t.access.split("|").every(a=>["","paywall","partial","registration"].indexOf(a)>=0));
  say(t.kinds+" kinds of thing, not just articles", t.kinds>=5);
  // the icon promises what you will do with it, so every row has to declare that
  say("every row says what you do with it ("+t.media+")",
    t.media.split("|").every(m=>["read","listen","watch","look","book"].indexOf(m)>=0));
  await p.close();

  // a style with reads shows them, under a heading, above the share button
  p=await b.newPage({viewport:M}); p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+"#shoegaze"); await selected(p);
  say("hidden in the peek",
    await p.$eval(".sect-read",e=>getComputedStyle(e).display==="none"));
  await p.click("#grab").catch(()=>{}); await opened(p);
  const r=await p.evaluate(()=>{
    const s=document.querySelector(".sect-read"), a=[...s.querySelectorAll("a.rd")];
    return {shown:getComputedStyle(s).display!=="none",
      head:s.querySelector(".secttl").textContent,
      aside:s.querySelector(".sectaside").textContent,
      n:a.length,
      // a note is optional now: a 33 1/3 whose kicker names the record says enough
      full:a.every(x=>x.querySelector(".rdt")&&x.querySelector(".rdm")
        && (x.querySelector(".rdn")||x.querySelector(".rdby"))),
      blank:a.every(x=>x.target==="_blank"&&/noopener/.test(x.rel)),
      tap:Math.min(...a.map(x=>Math.round(x.getBoundingClientRect().height))),
      beforeShare:!!(s.compareDocumentPosition(document.querySelector("[data-share]"))&4),
      // "What it is" became the About this style fold directly under the name, so the
      // thing Go deeper has to come after is the heading block, not a section
      afterAbout:!!(document.querySelector(".sthead").compareDocumentPosition(s)&4)};});
  say("shown when the panel opens, as \""+r.head+"\"", r.shown && r.head==="Go deeper");
  say("counted in the aside ("+r.aside+")", r.aside===r.n+" sources");
  say("each row carries title, source and note", r.full);
  // the kind is drawn as well as said, which is what makes a long list scannable
  // each medium has a colour, so a long list sorts itself at a glance
  say("each medium has a colour of its own", await p.evaluate(()=>{
    const seen={}; let ok=true;
    for(const x of document.querySelectorAll("a.rd")){
      const m=(x.className.match(/rd-(\w+)/)||[])[1];
      const c=getComputedStyle(x.querySelector(".rdi")).color;
      if(seen[m] && seen[m]!==c) ok=false; seen[m]=c;
    }
    const cols=Object.values(seen);
    return ok && cols.length>1 && new Set(cols).size===cols.length;}));
  say("every row carries a mark, and it fits its tile", await p.evaluate(()=>
    [...document.querySelectorAll("a.rd")].every(x=>{
      const t=x.querySelector(".rdi"); if(!t) return false;
      const m=t.querySelector(".rdmo,.rdser"), svg=t.querySelector("svg");
      if(!m && !svg) return false;
      return !m || (m.textContent.trim().length>0 && m.getBoundingClientRect().width<=t.getBoundingClientRect().width);
    })));

  say("and the kicker stays on one line", await p.evaluate(()=>
    [...document.querySelectorAll("a.rd .rdm")].every(x=>x.getBoundingClientRect().height<=22)));
  // app.js keeps its own scope, so the icon table is checked against the built file
  { const built=require("fs").readFileSync(__dirname+"/../index.html","utf8");
    const tbl=built.slice(built.indexOf("const MEDICON={"));
    const media=await p.evaluate(()=>{const k=new Set();
      for(const s in READ) for(const r of READ[s]) k.add(r[7]); return [...k];});
    const missing=media.filter(m=>tbl.indexOf(JSON.stringify(m)+":")<0);
    say("all "+media.length+" media have a shape of their own"
      +(missing.length?" (missing "+missing.join(", ")+")":""), missing.length===0); }
  // and no row repeats itself: an audio piece must not read "Audio Listen"
  // a 33 1/3 is one book about one record and gets the series badge
  // the badge is drawn once, on the tile. It used to be drawn again as the first word of
  // the kicker, which spent the most valuable line in the row saying what the tile said.
  say("the 33 1/3 entries are badged, once", await p.evaluate(()=>{
    const ser=[...document.querySelectorAll("a.rd.rd-series")];
    return ser.length>=2 && ser.length<=4
      && ser.every(x=>/33\u2153/.test(x.querySelector(".rdi .rdser").textContent))
      && ser.every(x=>!/33\u2153/.test(x.querySelector(".rdm").textContent));}));
  // and spends that line on the record instead, which the title alone withholds
  say("and name the record they are about", await p.evaluate(()=>
    [...document.querySelectorAll("a.rd.rd-series")].every(x=>{
      const by=x.querySelector(".rdby");
      return !by || by.textContent.trim().length>1;})));
  say("no row says the same thing twice", await p.evaluate(()=>
    [...document.querySelectorAll("a.rd")].every(x=>{
      const k=x.querySelector(".rdm").textContent, t=x.querySelector(".rdt").textContent.trim();
      return k.indexOf(t)<0;})));
  say("the medium is never said twice", await p.evaluate(()=>
    [...document.querySelectorAll("a.rd .rdm")].every(x=>
      !/Audio\s+Listen|Documentary\s+Watch/.test(x.textContent))));
  say("each opens in its own tab, safely", r.blank);
  say("smallest row is "+r.tap+"px", r.tap>=44);
  say("it sits under What it is", r.afterAbout);
  say("and above the share button", r.beforeShare);
  await p.close();

  // and a style with nothing says nothing, rather than showing an empty heading
  p=await b.newPage({viewport:M}); p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+"#spirituals"); await selected(p);
  await p.click("#grab").catch(()=>{}); await opened(p);
  say("a style with no reads shows no section", (await p.$$(".sect-read")).length===0);
  say("but still describes the style", (await p.$$(".aboutfold")).length===1);
  await p.close();

  say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await b.close();
})();
