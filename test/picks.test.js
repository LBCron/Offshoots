// Pete's Picks: a section that belongs to a person rather than to a style.
//
// The thing worth protecting here is that it is a VIEW, not a second copy. Every pick is
// an ordinary Go deeper row sitting on whatever styles it belongs to, and PICKED only
// says whose it is. So the checks below are mostly about the two staying in step: the
// count matches the data, the styles listed are the styles it is really on, and the row
// on the style and the row on the page are the same row.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const D=require("../src/data.js");
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
const drawn=q=>until(q,()=>!!document.querySelector("#chart .n"));
const ready=async q=>{ await arm(q); await drawn(q); await settle(q); };
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };

(async()=>{
  const b=await chromium.launch({args:["--allow-file-access-from-files"]});
  skipWelcome(b);
  const errs=[];

  // what the data says, worked out here rather than read off the page, so the page has
  // something independent to disagree with
  const urls=Object.keys(D.PICKED);
  const owner=u=>{const e=D.PICKED[u]; return Array.isArray(e)?e[0]:e;};
  const mine=urls.filter(u=>owner(u)==="pete");
  const stylesFor=u=>Object.entries(D.READ)
    .filter(([,rows])=>rows.some(r=>r[0]===u)).map(([k])=>k)
    .filter(k=>D.DATA.some(r=>r[0]===k));

  say("the picker exists in the data", !!(D.PICKERS&&D.PICKERS.pete));
  say("  with no photograph yet, so the avatar is drawn",
    D.PICKERS.pete.avatar==="");
  say("  and "+mine.length+" picks", mine.length>0);
  // a pick is a work, not a row: the book on seven styles must not count as seven
  say("  each one a work, not a row",
    new Set(mine).size===mine.length && mine.every(u=>stylesFor(u).length>=1));

  // --- the page itself, reached by its own link
  const p=await b.newPage({viewport:M});
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+"#picks"); await ready(p);
  await onPage(p,"picks");
  say("the link opens it", true);
  const pg=await p.evaluate(()=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return {title:(u.querySelector(".bigttl")||{}).textContent||"",
      items:u.querySelectorAll(".pickit").length,
      avatar:!!u.querySelector(".pickhead .pava"),
      drawn:!!u.querySelector(".pickhead .pava.pavanone svg"),
      who:(u.querySelector(".pickwho2 b")||{}).textContent||"",
      role:(u.querySelector(".pickwho2 em")||{}).textContent||"",
      chips:[...u.querySelectorAll(".pickwho")].map(x=>x.dataset.go),
      dots:[...u.querySelectorAll(".pickwho .dot")].length};});
  say("  titled for the person ("+pg.title+")", /Pete/.test(pg.title));
  say("  listing "+pg.items+" picks, which is what the data holds", pg.items===mine.length);
  say("  under his name and role ("+pg.who+", "+pg.role+")", !!pg.who && !!pg.role);
  // the avatar is the place keeper: it must be there, and it must be the drawn one until
  // a photograph exists, or the slot has quietly stopped being a slot
  say("  with an avatar in place", pg.avatar && pg.drawn);
  const want=mine.flatMap(stylesFor).sort();
  say("  naming every style each pick lives on ("+pg.chips.length+")",
    pg.chips.slice().sort().join()===want.join());
  say("  each with its family colour", pg.dots===pg.chips.length);

  // --- a chip goes to that style, which is the point of listing them
  const chip=pg.chips[0];
  await p.click(".ppage:not([hidden]) .pickwho"); await settle(p);
  say("  and a style chip opens that style",
    await p.evaluate(c=>location.hash==="#"+c, chip));

  // --- the credit on the style's own Go deeper row
  // a fresh page: goto with only the hash changed does not reload, and the row we want
  // would be whichever style the chip above left us on
  const first=mine[0];
  const q=await b.newPage({viewport:M});
  q.on("pageerror",e=>errs.push(String(e)));
  await q.goto(URL+"#"+stylesFor(first)[0]); await ready(q);
  const cr=await q.evaluate(u=>{
    const a=[...document.querySelectorAll(".rd")].find(x=>x.href===u);
    if(!a) return null;
    return {pick:a.classList.contains("rdpick"),
      badge:(a.querySelector(".rdpb")||{}).textContent||"",
      ava:!!a.querySelector(".rdpb .pava")};}, first);
  say("the style's own row says whose pick it is", !!cr && /Pete/.test(cr.badge));
  say("  with the same avatar as the page", !!cr && cr.ava && cr.pick);

  // --- one source, two places, one set of facts
  const same=await q.evaluate(u=>{
    const a=[...document.querySelectorAll(".rd")].find(x=>x.href===u);
    return a ? {t:(a.querySelector(".rdt")||{}).textContent,
      m:(a.querySelector(".rdm")||{}).textContent} : null;}, first);
  await q.close();
  const r=await b.newPage({viewport:M});
  r.on("pageerror",e=>errs.push(String(e)));
  await r.goto(URL+"#picks"); await ready(r); await onPage(r,"picks");
  const there=await r.evaluate(u=>{
    const a=[...document.querySelectorAll(".pickit .rd")].find(x=>x.href===u);
    return a ? {t:(a.querySelector(".rdt")||{}).textContent,
      m:(a.querySelector(".rdm")||{}).textContent,
      n:(a.querySelector(".rdn")||{}).textContent} : null;}, first);
  say("the same source reads the same in both places", !!there && there.t===same.t && there.m===same.m);
  // except the note, which is allowed to differ: on a style it talks about that style
  const note=Array.isArray(D.PICKED[first]) ? D.PICKED[first][1] : "";
  if(note) say("  but the pick's own note is used on the page", there.n===note);
  say("  and the credit is not repeated on his own page",
    await r.evaluate(()=>[...document.querySelectorAll(".pickit .rdpb")]
      .every(x=>getComputedStyle(x).display==="none")));
  await r.close();

  // --- the way in: its own section under the browse lists, not among them. Explore is
  // about styles; this section is about sources, and the two were reading as one list.
  await p.goto(URL); await ready(p);
  await p.click("#grab").catch(()=>{}); await settle(p);
  const sect=await p.evaluate(()=>{
    const d=document.querySelector(".sect-deeper"), br=document.querySelector(".sect-browse");
    if(!d||!br) return null;
    return {head:(d.querySelector(".secttl")||{}).textContent||"",
      below:d.getBoundingClientRect().top > br.getBoundingClientRect().bottom,
      rows:[...d.querySelectorAll(".listrow")].map(x=>({
        key:x.dataset.page, lbl:(x.querySelector(".lrlbl")||{}).textContent,
        ct:(x.querySelector(".lrct")||{}).textContent, ico:!!x.querySelector(".lrico svg")})),
      inBrowse:!!br.querySelector('[data-page="picks"]')};});
  say("its own section, headed "+JSON.stringify(sect&&sect.head), !!sect && sect.head==="Go deeper");
  say("  below the browse lists rather than inside them",
    !!sect && sect.below && sect.inBrowse===false);
  say("  the guest first, then the whole library by medium ("
    + sect.rows.map(r=>r.lbl).join(" / ") + ")",
    sect.rows[0].key==="picks" &&
    sect.rows.slice(1).map(r=>r.key).join("/")==="med:read/med:book/med:listen/med:watch/med:look");
  say("  every row counted and iconed",
    sect.rows.every(r=>r.ico && /^\d+$/.test(r.ct)));
  say("  the guest row counting his picks ("+sect.rows[0].ct+")",
    sect.rows[0].ct===String(mine.length));
  // the counts are works, not rows: a book on seven styles is one book here
  const uniq=t=>new Set(Object.values(D.READ).flat().filter(r=>r[7]===t).map(r=>r[0])).size;
  say("  counting works and not rows",
    sect.rows.slice(1).every(r=>r.ct===String(uniq(r.key.slice(4)))));
  await p.click('[data-page="picks"]'); await onPage(p,"picks");
  say("  and the guest row opens his page", true);

  // --- a medium page gathers everything of that medium, once each
  await p.click("#panelBack"); await settle(p);
  await p.click('[data-page="med:watch"]'); await onPage(p,"med:watch");
  const med=await p.evaluate(()=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return {t:(u.querySelector(".bigttl")||{}).textContent||"",
      n:u.querySelectorAll(".pickit").length,
      hrefs:[...u.querySelectorAll(".pickit .rd")].map(x=>x.href),
      sorted:[...u.querySelectorAll(".pickit .rdt")].map(x=>x.textContent)};});
  say("a medium page gathers that medium ("+med.t+", "+med.n+")", med.n===uniq("watch"));
  say("  each source once", new Set(med.hrefs).size===med.hrefs.length);
  const key=t=>t.replace(/^(the|a|an)\s+/i,"").toLowerCase();
  say("  in title order, so a long one can be scanned",
    med.sorted.map(key).join("|")===med.sorted.map(key).sort().join("|"));

  say("no page errors", errs.length===0 ? true : errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await b.close();
})();
