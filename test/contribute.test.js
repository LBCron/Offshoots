// The way a suggestion travels: bookmarklet -> /suggest -> POST /api/suggest.
//
// The other suites load index.html over file://, but /suggest fetches musicatlas.json and
// a fetch from file:// is refused, so this one serves the repo over a local port the way
// Netlify does, rewrites included. GitHub is never involved: /api/suggest is answered by
// the test, which also keeps what the page sent so the body can be checked field by field.
const {chromium}=require("playwright");
const http=require("http"), fs=require("fs"), path=require("path");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise}=require("./_wait");
const ROOT=path.join(__dirname,"..");
const M={width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2};
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const KEY="0123456789abcdef0123456789abcdef";

// a page worth suggesting, saying about itself what real ones do
const FIXTURE=`<!doctype html><html><head><title>Raw title | Site</title>
<link rel="canonical" href="/fixture/clean">
<meta property="og:title" content="The Night Fats Domino Played Cosimo's">
<meta property="og:site_name" content="Gambit">
<meta property="article:published_time" content="2014-06-02T10:00:00Z">
</head><body>hello</body></html>`;
const TYPES={".html":"text/html",".json":"application/json",".js":"text/javascript",".css":"text/css",".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml"};

(async()=>{
  const srv=http.createServer((q,r)=>{
    let u=decodeURIComponent(q.url.split("?")[0]);
    if(u.startsWith("/fixture")){ r.writeHead(200,{"content-type":"text/html"}); return r.end(FIXTURE); }
    if(u==="/suggest"||u==="/contribute") u+=".html";
    if(u.endsWith("/")) u+="index.html";
    const f=path.join(ROOT,path.normalize(u));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
    r.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"});
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(res=>srv.listen(0,"127.0.0.1",res));
  const B="http://127.0.0.1:"+srv.address().port+"/";

  const b=await chromium.launch(); skipWelcome(b);
  const errs=[];
  const page=async(opts={})=>{ const p=await b.newPage({viewport:M,...opts}); p.on("pageerror",e=>errs.push(String(e))); return p; };

  // ---------- the contribute page ----------
  let p=await page();
  await p.goto(B+"contribute");
  const plain=await p.$eval("#bm",a=>a.href);
  say("the contribute page hands out a bookmarklet", plain.indexOf("javascript:")===0);
  say("an ordinary one carries no key", decodeURIComponent(plain).indexOf('p.set("k"')<0);
  say("and the personal notice stays hidden", await p.$eval("#mine",e=>e.hidden));
  await p.click("#bm");
  say("clicking it here says to drag it instead", /Drag it/.test(await p.textContent("#nudge")));
  await p.close();

  p=await page();
  await p.goto(B+"contribute#k="+KEY);
  const mine=await p.$eval("#bm",a=>a.href);
  say("a personal one carries its key", decodeURIComponent(mine).indexOf('p.set("k","'+KEY+'")')>0);
  say("and says it is personal", !(await p.$eval("#mine",e=>e.hidden)));
  say("its form link carries the key too", (await p.$eval("#form",a=>a.getAttribute("href")))==="suggest#k="+KEY);
  await p.close();
  // the key typed onto the end of a contribute page that is already open
  p=await page();
  await p.goto(B+"contribute");
  await p.evaluate(k=>{ location.hash="k="+k; },KEY);
  await p.waitForLoadState("load");
  await until(p,()=>!document.getElementById("mine").hidden);
  say("a key added to an open page is picked up", !(await p.$eval("#mine",e=>e.hidden)));
  await p.close();

  // ---------- running it on a page ----------
  p=await page();
  await p.goto(B+"fixture/raw?utm_source=x");
  const opened=await p.evaluate(code=>{ let got=null; window.open=(u,n,f)=>{ got={u,n,f}; return null; };
    const r=(0,eval)(code); return {got, returned:r===undefined}; }, decodeURIComponent(mine.slice("javascript:".length)));
  const h=new URL(opened.got.u), q=new URLSearchParams(h.hash.slice(1));
  say("it opens this site's form", h.origin+h.pathname===B+"suggest");
  say("with everything in the hash, so none of it is sent by opening the page", h.search==="" && q.get("u")!==null);
  say("the canonical link, not the one with tracking on it", q.get("u")===B+"fixture/clean");
  say("the page's own title, publication and date", q.get("t")==="The Night Fats Domino Played Cosimo's"
    && q.get("p")==="Gambit" && q.get("d")==="2014-06-02T10:00:00Z");
  say("the key", q.get("k")===KEY);
  say("and it returns nothing, so the page underneath is left alone", opened.returned);
  await p.close();

  // ---------- filling in and sending ----------
  // one context for the guest, so what the form remembers carries to their next visit
  const gc=await b.newContext({viewport:M});
  p=await gc.newPage(); p.on("pageerror",e=>errs.push(String(e))); const posts=[];
  await p.route("**/api/suggest",async r=>{ posts.push(JSON.parse(r.request().postData()));
    await r.fulfill({status:201,contentType:"application/json",body:JSON.stringify({ok:true,by:"pete"})}); });
  await p.goto(opened.got.u);
  await until(p,()=>document.getElementById("url").value!=="");
  say("the form arrives filled in", (await p.inputValue("#url"))===B+"fixture/clean"
    && (await p.inputValue("#title"))==="The Night Fats Domino Played Cosimo's");
  say("and knows it is a guest", !(await p.$eval("#who",e=>e.hidden)));
  await p.fill("#sq","new orleans");
  await until(p,()=>document.querySelectorAll("#res li").length>0);
  await p.dispatchEvent("#res li:first-child","pointerdown");
  say("a style is picked from the list", (await p.$$eval(".chip",c=>c.map(x=>x.textContent.trim()))).length===1);
  say("and the cursor stays in the search for the next one", await p.evaluate(()=>document.activeElement.id==="sq"));
  await p.fill("#sq","swamp");
  await until(p,()=>document.querySelectorAll("#res li").length>0);
  await p.dispatchEvent("#res li:first-child","pointerdown");
  say("so a second style is one more pick", (await p.$$(".chip")).length===2);
  await p.fill("#note","The night the building shook.");
  await p.click("#go");
  await until(p,()=>!document.getElementById("done").hidden);
  const sent=posts[0]||{};
  say("one request went out", posts.length===1);
  say("carrying the link, both styles and the key", sent.url===B+"fixture/clean" && sent.styles.length===2 && sent.k===KEY);
  say("and what the page said about itself", sent.publication==="Gambit" && sent.year==="2014");
  say("with the honeypot empty", sent.website==="");
  say("and thanks the guest by name", (await p.textContent("#donet"))==="Sent as Pete’s pick");
  await p.close();

  // the key is remembered, so the map's own link credits the guest too
  p=await gc.newPage(); p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(B+"suggest?s=shoegaze");
  await until(p,()=>document.querySelectorAll(".chip").length>0);
  say("the map's link fills in its style", (await p.textContent(".chip")).trim()==="Shoegaze");
  say("and still knows the guest, with no key in the link", !(await p.$eval("#who",e=>e.hidden)));
  await p.click("#forget");
  say("until they say it isn't them", await p.$eval("#who",e=>e.hidden));
  await gc.close();

  // a stranger can send with no style at all: where it goes is decided at review
  const ctx=await b.newContext({viewport:M}); p=await ctx.newPage(); p.on("pageerror",e=>errs.push(String(e)));
  const none=[]; await p.route("**/api/suggest",r=>{ none.push(JSON.parse(r.request().postData()));
    r.fulfill({status:201,contentType:"application/json",body:JSON.stringify({ok:true,by:""})}); });
  await p.goto(B+"suggest#u="+encodeURIComponent("https://www.youtube.com/watch?v=x"));
  await p.waitForLoadState("networkidle");
  say("a YouTube link is guessed to be a video", await p.$eval("input[name=medium][value=watch]",e=>e.checked));
  await p.click("#go");
  await until(p,()=>!document.getElementById("done").hidden);
  say("a stranger can send without picking a style", none.length===1 && none[0].styles.length===0);
  say("and is thanked plainly", (await p.textContent("#donet"))==="Sent");
  // the bookmarklet clicked again with its window still open changes only the hash
  await p.evaluate(()=>{ location.hash="u="+encodeURIComponent("https://example.org/second"); });
  await p.waitForLoadState("load");
  await until(p,()=>document.getElementById("url").value==="https://example.org/second");
  say("a second page sent to the open window replaces the first", (await p.inputValue("#url"))==="https://example.org/second");
  await ctx.close();

  // ---------- the link in Go deeper ----------
  p=await page();
  await p.goto(B+"index.html#shoegaze"); await arm(p); await shown(p,"#chart .n");
  await until(p,()=>!!document.querySelector("#chart .n.cur")); await settle(p);
  await raise(p); await until(p,()=>document.body.classList.contains("open")); await settle(p);
  const a=await p.$eval(".sect-read .deepsug",x=>({href:x.getAttribute("href"),t:x.target,rel:x.rel,
    last:!x.nextElementSibling, h:Math.round(x.getBoundingClientRect().height)}));
  say("Go deeper ends with a link to suggest, for this style", a.href==="suggest.html?s=shoegaze" && a.last);
  say("which opens on its own, safely", a.t==="_blank" && /noopener/.test(a.rel));
  say("and is big enough to tap ("+a.h+"px)", a.h>=44);
  await p.close();

  say("no page errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await b.close(); srv.close();
})().catch(e=>{ say("suite ran", e.stack||String(e)); process.exit(1); });
