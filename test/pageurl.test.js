// Every page in the panel already had a name that is its address, and none of them wrote
// it: opening a collection left the URL on whatever was behind it, so the address bar was
// wrong and there was nothing to copy. The hash follows the stack now, and a collection
// carries a button that shares the thing you are standing in rather than the map.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm,raise}=require("./_wait");
const D=require(path.join(__dirname,"..","src","data.js"));
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  const ctx=await b.newContext({viewport:{width:390,height:844},
    permissions:["clipboard-read","clipboard-write"]});
  const p=await ctx.newPage();
  const hash=()=>p.evaluate(()=>location.hash);
  await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
  say("the map itself has no hash", (await hash())==="");

  // ---- the address follows the stack ----
  await p.click('[data-mode="system"]');
  await until(p,()=>!!document.querySelector('.ppage[data-p="mode:system"]')); await settle(p);
  const inside=await hash();
  // a colon is legal in a fragment and %3A is not what anyone would recognise in a link
  say("a collection puts its own address in the bar ("+inside+")", inside==="#mode:system");
  await p.click("#panelBack"); await settle(p); await new Promise(r=>setTimeout(r,350));
  say("  and going back takes it off again ("+JSON.stringify(await hash())+")",
    (await hash())==="");
  await p.click(".sect-modes .secthead");
  await until(p,()=>!!document.querySelector(".modelist")); await settle(p);
  say("  the list of them has one too ("+(await hash())+")", (await hash())==="#modes");
  await p.click("#panelBack"); await settle(p); await new Promise(r=>setTimeout(r,350));

  // opening a style from inside a collection is a different place, and the bar has to say so
  await p.click('[data-mode="dinner"]');
  await until(p,()=>!!document.querySelector('.ppage[data-p="mode:dinner"]')); await settle(p);
  await p.click('.ppage[data-p="mode:dinner"] .pick'); await settle(p);
  await new Promise(r=>setTimeout(r,400));
  const onStyle=await hash();
  say("a style opened from a collection leaves the collection's address behind ("+onStyle+")",
    onStyle!=="#mode:dinner" && /^#[a-z0-9_]+$/i.test(onStyle));

  // ---- reachable cold, which is the whole point of having one ----
  for(const key of ["system","nightcap","dinner"]){
    const q=await ctx.newPage();
    await q.goto(URL+"#mode:"+key);
    await arm(q); await shown(q,"#chart .n"); await settle(q);
    await until(q,()=>!!document.querySelector(".ppage[data-p^='mode:']")).catch(()=>{});
    await settle(q); await new Promise(r=>setTimeout(r,350));
    const got=await q.evaluate(()=>{
      const pg=document.querySelector(".ppage:not([hidden])");
      return {p:pg?pg.dataset.p:null, open:document.body.classList.contains("open"),
        title:(document.querySelector(".ppage:not([hidden]) .bigttl .mn")||{}).textContent};});
    const m=D.MODES.find(x=>x[0]===key);
    say("#mode:"+key+" opens it from cold (\""+got.title+"\")",
      got.p==="mode:"+key && got.open===true && got.title===m[1]);
    await q.close();
  }
  // a hash naming nothing must land on the map rather than on a blank page
  {
    const q=await ctx.newPage();
    const errs=[]; q.on("pageerror",e=>errs.push(String(e)));
    await q.goto(URL+"#mode:nothinghere");
    await arm(q); await shown(q,"#chart .n"); await settle(q);
    await new Promise(r=>setTimeout(r,500));
    const got=await q.evaluate(()=>({pages:document.querySelectorAll(".ppage").length,
      nodes:document.querySelectorAll("#chart .n").length}));
    say("a collection hash naming nothing lands on the map, quietly",
      got.pages<=1 && got.nodes>400 && errs.length===0);
    await q.close();
  }

  // ---- the share button ----
  const q=await ctx.newPage();
  await q.goto(URL+"#mode:system");
  await arm(q); await shown(q,"#chart .n"); await settle(q);
  await until(q,()=>!!document.querySelector('.ppage[data-p="mode:system"]'));
  await settle(q); await new Promise(r=>setTimeout(r,300));
  const v=await q.evaluate(()=>{
    const pg=document.querySelector('.ppage[data-p="mode:system"]');
    const sb=pg.querySelector("[data-share]");
    const list=pg.querySelector(".picks");
    const r=x=>x?x.getBoundingClientRect():null;
    return {n:pg.querySelectorAll("[data-share]").length,
      label:(sb.querySelector(".shlbl")||{}).textContent,
      key:sb.dataset.sharekey, name:sb.dataset.sharename,
      tap:Math.round(r(sb).height), underList:r(sb).top>=r(list).bottom-1};});
  note("the button", JSON.stringify({label:v.label, key:v.key, name:v.name}));
  say("a collection carries one share button", v.n===1);
  say("  naming the collection, not the app (\""+v.name+"\")",
    v.name==="Test the speakers" && v.key==="mode:system" && v.label==="Share this collection");
  say("  at the foot, under the list", v.underList);
  say("  clearing the tap floor ("+v.tap+"px)", v.tap>=44);
  // what it shares is the thing you are standing in
  await q.evaluate(()=>{ navigator.share=undefined; });
  await q.locator('.ppage[data-p="mode:system"] [data-share]').scrollIntoViewIfNeeded();
  await settle(q);
  await q.click('.ppage[data-p="mode:system"] [data-share]');
  await until(q,()=>/copied/i.test(document.querySelector(".ppage:not([hidden]) [data-share] .shlbl").textContent));
  const clip=await q.evaluate(()=>navigator.clipboard.readText()).catch(()=>"");
  say("  and shares the collection's own address (\""+clip.split("#")[1]+"\")",
    /#mode:system$/.test(clip));
  say("  saying so in words", /copied/i.test(await q.evaluate(()=>
    document.querySelector(".ppage:not([hidden]) [data-share] .shlbl").textContent)));
  await q.close();

  // every collection, not just the one: the button is built per page and the URL has to
  // resolve for all twenty-eight
  {
    const r=await ctx.newPage();
    await r.goto(URL); await arm(r); await shown(r,"#chart .n"); await settle(r);
    const bad=[];
    for(const m of D.MODES){
      // goto with only the hash changed is a same-document navigation: boot does not run
      // again, so the page never opens and the one from the iteration before is still in
      // the DOM to be found instead. Reload makes each pass a real cold arrival.
      await r.goto(URL+"#mode:"+m[0]); await r.reload();
      await arm(r); await shown(r,"#chart .n"); await settle(r);
      await new Promise(x=>setTimeout(x,260));
      const ok=await r.evaluate(k=>{
        const pg=document.querySelector('.ppage[data-p="mode:'+k+'"]');
        if(!pg) return "did not open";
        const sb=pg.querySelector("[data-share][data-sharekey]");
        if(!sb) return "no share button";
        if(sb.dataset.sharekey!=="mode:"+k) return "shares "+sb.dataset.sharekey;
        return true; }, m[0]);
      if(ok!==true) bad.push(m[0]+": "+ok);
    }
    say("all "+D.MODES.length+" collections open from their own address, with a button",
      bad.length===0 ? true : bad.slice(0,4).join(" | "));
    await r.close();
  }

  // the panel's own share is unchanged: it still shares the style, or the map
  {
    const r=await ctx.newPage();
    await r.goto(URL+"#gospel"); await arm(r); await shown(r,"#chart .n"); await settle(r);
    await until(r,()=>!!document.querySelector("#panel h1.pttl")); await settle(r);
    await r.evaluate(()=>{ navigator.share=undefined; });
    // a shared style link opens on the map, and the share button is deliberately not in
    // the peek: it is a place to act from, which a peek is not
    await raise(r); await settle(r); await new Promise(x=>setTimeout(x,250));
    const sb=await r.$("#panel [data-share]:not([data-sharekey])");
    say("the style panel's own button is still its own", !!sb);
    if(sb){ await sb.scrollIntoViewIfNeeded(); await settle(r); await sb.click();
      await new Promise(x=>setTimeout(x,400));
      const c=await r.evaluate(()=>navigator.clipboard.readText()).catch(()=>"");
      say("  and still shares the style (\""+c.split("#")[1]+"\")", /#gospel$/.test(c)); }
    await r.close();
  }
  await b.close();
})();
