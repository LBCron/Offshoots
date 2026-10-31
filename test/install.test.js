// The "open in" row in the install fold. It is the one thing on the page that behaves
// differently per browser, and it is offered over http(s) only, so this suite serves the
// built page rather than reading it off disk like the others.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const http=require("http"), fs=require("fs"), path=require("path");
const FILE=path.join(__dirname,"..","index.html");
const PORT=8741, URL="http://127.0.0.1:"+PORT+"/";
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));
// boot runs on document.fonts.ready and draws the map before it reads the hash, so the
// first drawn node is what says boot has started choosing what to show.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// A fold hash pushes its page about 420ms into boot, and the page it came from stays
// visible for another 240ms, so the arrival is "the first page still showing is this one".
// The row under test is built by that page, which is why every load here waits for it.
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };

const UA={
  safari:   "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad:     "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1",
  ioschrome:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1",
  iosfx:    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15",
  instagram:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0",
  facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]",
  andchrome:"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  andfx:    "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
  samsung:  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  macsafari:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macchrome:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  winedge:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0"
};

(async()=>{
  const srv=http.createServer((q,r)=>{ r.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});
    r.end(fs.readFileSync(FILE)); }).listen(PORT);
  const b=await chromium.launch(); skipWelcome(b);
  const row=async(ua,hash)=>{
    const ctx=await b.newContext({userAgent:UA[ua],viewport:{width:390,height:844}});
    const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(String(e)));
    await p.goto(URL+(hash||"#install")); await ready(p);
    await onPage(p,((hash||"#install")).slice(1));
    const r=await p.evaluate(()=>{ const a=document.querySelector(".openin a");
      return a?{href:a.getAttribute("href"),label:a.textContent.trim(),
                note:(document.querySelector(".opennote")||{}).textContent||"",
                tap:Math.round(a.getBoundingClientRect().height)}:null; });
    await ctx.close(); return {r,errs};
  };

  // offered to the people the steps do not work for
  for(const ua of ["ioschrome","iosfx","ipad","instagram","facebook"]){
    const {r,errs}=await row(ua);
    say(ua+" is offered Safari", !!r && /Safari$/.test(r.label));
    say("  with an x-safari- link", !!r && r.href.indexOf("x-safari-http")===0);
    say("  and the share-sheet fallback", !!r && /Share/.test(r.note) && /Open in Safari/.test(r.note));
    say("  tap target "+(r?r.tap:0)+"px", !!r && r.tap>=44);
    say("  no errors", errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  }
  // and withheld from everyone it would only confuse
  for(const ua of ["safari","andchrome","macsafari","macchrome","winedge"]){
    const {r}=await row(ua);
    say(ua+" is offered nothing", r===null);
  }
  // Android gets Chrome, with the intent fallback that makes it safe when Chrome is absent
  for(const ua of ["andfx","samsung"]){
    const {r}=await row(ua);
    say(ua+" is offered Chrome", !!r && /Chrome$/.test(r.label));
    say("  through an intent url", !!r && r.href.indexOf("intent://")===0);
    say("  naming the package", !!r && /package=com\.android\.chrome/.test(r.href));
    say("  with a fallback url", !!r && /S\.browser_fallback_url=http/.test(r.href));
    // on Android the browser you are in can do this itself, so the note must not claim otherwise
    say("  and a note that does not claim Chrome is required", !!r && !/nowhere else/.test(r.note));
  }
  // an installed copy has nothing to install
  { const ctx=await b.newContext({userAgent:UA.ioschrome,viewport:{width:390,height:844}});
    const p=await ctx.newPage();
    await p.addInitScript(()=>{ Object.defineProperty(navigator,"standalone",{get:()=>true}); });
    await p.goto(URL+"#install"); await ready(p); await onPage(p,"install");
    say("an already installed copy is offered nothing", (await p.$$(".openin a")).length===0);
    await ctx.close(); }
  // the row only exists inside the install fold
  { const ctx=await b.newContext({userAgent:UA.ioschrome,viewport:{width:390,height:844}});
    const p=await ctx.newPage(); await p.goto(URL+"#about"); await ready(p); await onPage(p,"about");
    const inside=await p.evaluate(()=>{ const a=document.querySelector(".openin");
      return a?(a.closest('.ppage[data-p="install"]')?"on install":"loose"):"absent"; });
    // the row is built by the install page, so on any other page it does not exist at all
    say("it exists only on the install page (on About: "+inside+")", inside==="absent");
    await ctx.close(); }

  // the step that says to tap Share can open the sheet itself, which is where
  // Add to Home Screen actually lives
  const sheet=async(ua,share)=>{
    const ctx=await b.newContext({userAgent:UA[ua],viewport:{width:390,height:844}});
    const p=await ctx.newPage();
    await p.addInitScript(on=>{ if(on) navigator.share=()=>{ window.__shared=true; return Promise.resolve(); };
      else { try{ delete Navigator.prototype.share; }catch(e){} } }, share);
    await p.goto(URL+"#install"); await ready(p); await onPage(p,"install");
    const r=await p.evaluate(()=>{ const btn=document.querySelector("[data-sharesheet]");
      return {btn:!!btn, tap:btn?Math.round(btn.getBoundingClientRect().height):0,
        glyphs:document.querySelectorAll('.ppage[data-p="install"] .steps svg.shg').length,
        inStep:btn?/Share/.test(btn.closest("li").textContent):false}; });
    let fired=false;
    // the stub resolves on the spot, so there is nothing to wait out but the page itself
    if(r.btn){ await p.$eval("[data-sharesheet]",e=>e.click()); await settle(p);
      fired=await p.evaluate(()=>!!window.__shared); }
    await ctx.close(); return Object.assign(r,{fired});
  };
  { const r=await sheet("safari",true);
    say("iOS Safari gets a Share-sheet button", r.btn);
    say("  inside the step that names Share", r.inStep);
    say("  tap target "+r.tap+"px", r.tap>=44);
    say("  and tapping it opens the sheet", r.fired); }
  { const r=await sheet("safari",false);
    say("without navigator.share there is no button", r.btn===false);
    say("  but the glyph still illustrates the step ("+r.glyphs+")", r.glyphs>=1); }
  { const r=await sheet("macchrome",true);
    say("a desktop with navigator.share gets no button", r.btn===false); }
  { const r=await sheet("andchrome",true);
    say("Android gets no Share-sheet button either", r.btn===false); }

  // ---------- one section per platform someone might arrive on ----------
  // Linux was missing entirely, which on Ubuntu and Mint is worse than it sounds: both
  // ship Firefox, Firefox on the desktop cannot install a web app at all, and a reader
  // following the Windows steps in it would find no install icon and conclude the page
  // was broken rather than that they needed a different browser.
  { const ctx=await b.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();
    await p.goto(URL+"#install"); await ready(p); await onPage(p,"install");
    const r=await p.evaluate(()=>{
      const u=document.querySelector('.ppage[data-p="install"]');
      const heads=[...u.querySelectorAll(".subh")].map(h=>h.textContent.trim());
      const i=heads.findIndex(h=>/linux/i.test(h));
      const sec=i<0 ? "" : (()=>{ // the text from the Linux heading to the next one
        const all=[...u.querySelectorAll(".subh")]; let t="", n=all[i].nextElementSibling;
        while(n && !n.classList.contains("subh")){ t+=" "+n.textContent; n=n.nextElementSibling; }
        return t; })();
      const codes=[...u.querySelectorAll("code")];
      return {heads, sec, codes:codes.map(c=>c.textContent),
        codeStyled: codes.length>0 && codes.every(c=>{
          const s=getComputedStyle(c);
          return /mono/i.test(s.fontFamily) && s.backgroundColor!=="rgba(0, 0, 0, 0)";}),
        spill: codes.some(c=>c.getBoundingClientRect().right > u.getBoundingClientRect().right)};});
    const want=["iPhone","Android","Mac","Windows","Linux"];
    const missing=want.filter(w=>!r.heads.some(h=>h.indexOf(w)===0||h.indexOf(w)>=0));
    say("a section for every platform ("+r.heads.length+")"
      +(missing.length?", missing "+missing.join(", "):""), missing.length===0);
    say("  Linux names both distributions",
      /ubuntu/i.test(r.heads.join(" ")) && /mint/i.test(r.heads.join(" ")));
    // the single most useful sentence in it: the default browser cannot do this
    say("  and says plainly that Firefox cannot do it",
      /firefox/i.test(r.sec) && /(cannot|can't|no install)/i.test(r.sec));
    say("  with the command for each ("+r.codes.length+")",
      r.codes.some(c=>/snap install chromium/.test(c))
      && r.codes.some(c=>/apt install chromium/.test(c)));
    say("  set as commands rather than prose", r.codeStyled);
    say("  and none of them running off the edge at 390px", r.spill===false);

    // Linux is the longest of the five and the one fewest readers need, so it is folded
    // away. A closed <details> is collapsed by content-visibility rather than display,
    // so its children still report their intrinsic size: the height that means anything
    // is the fold's own, and the summary has to stay a full tap target while shut.
    const f=await p.evaluate(()=>{
      const d=document.querySelector('.ppage[data-p="install"] details.xfold');
      if(!d) return null;
      const s=d.querySelector("summary");
      return {open:d.open, h:Math.round(d.getBoundingClientRect().height),
        tap:Math.round(s.getBoundingClientRect().height),
        heading:/Linux/.test(s.textContent),
        caret:!!s.querySelector("svg"),
        turned:getComputedStyle(s.querySelector("svg")).transform};});
    say("  folded away, not laid out flat", !!f && f.open===false);
    say("  its summary the heading itself, still a full tap ("+(f&&f.tap)+"px)",
      !!f && f.heading && f.tap>=44);
    say("  collapsed to the heading alone ("+(f&&f.h)+"px)", !!f && f.h<=56);
    say("  with a caret lying on its side", !!f && f.caret && f.turned==="none");
    await p.click('.ppage[data-p="install"] details.xfold summary');
    await settle(p);
    const o=await p.evaluate(()=>{
      const d=document.querySelector('.ppage[data-p="install"] details.xfold');
      return {open:d.open, h:Math.round(d.getBoundingClientRect().height),
        turned:getComputedStyle(d.querySelector("summary svg")).transform};});
    say("  opening it shows the steps ("+o.h+"px)", o.open===true && o.h>300);
    say("  and turns the caret down", o.turned!=="none");
    await ctx.close(); }

  await b.close(); srv.close();
})();
