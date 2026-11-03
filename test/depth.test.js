// The panel read as one flat sheet: the card, the rows and the ground were all within a
// few points of each other and nothing had an edge. Four things fix that, and all four are
// shadows and background layers rather than borders, so no card changed size and no row
// inside one moved. This checks they are all still on, in both themes, and that the grain
// stays underneath the content where it belongs.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

// WCAG relative luminance, so "a step" is a number rather than an opinion
const lum=rgb=>{ const c=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(Number)
    .map(v=>{ const x=(v>1?v/255:v); return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4); });
  return .2126*c[0]+.7152*c[1]+.0722*c[2]; };

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  for(const scheme of ["light","dark"]){
    const c=await b.newContext({viewport:{width:390,height:844},colorScheme:scheme});
    const p=await c.newPage();
    await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
    if(await p.evaluate(()=>!document.body.classList.contains("open"))){
      await p.click("#grab").catch(()=>{});
      await until(p,()=>document.body.classList.contains("open")); await settle(p); }
    await settle(p); await new Promise(r=>setTimeout(r,250));

    const v=await p.evaluate(()=>{
      const pan=document.getElementById("panel");
      const cards=[...document.querySelectorAll("#panel .listgrp, #panel .picks, #panel .reads")];
      const cs=cards.map(x=>{ const s=getComputedStyle(x); return {
        bg:s.backgroundColor, img:s.backgroundImage, sh:s.boxShadow,
        border:parseFloat(s.borderTopWidth)||0,
        w:Math.round(x.getBoundingClientRect().width),
        inner:Math.round(x.clientWidth)}; });
      const a=getComputedStyle(pan,"::after");
      return {n:cards.length, cards:cs, panel:getComputedStyle(pan).backgroundColor,
        grain:{z:a.zIndex, pe:a.pointerEvents, op:parseFloat(a.opacity)||0,
          img:a.backgroundImage, pos:a.position, blend:a.mixBlendMode}};
    });

    const d=Math.abs(lum(v.cards[0].bg)-lum(v.panel));
    note(scheme, v.n+" cards, panel "+v.panel+", card "+v.cards[0].bg);
    say(scheme+": a card is a measurable step off the panel ("+d.toFixed(4)+")", d>=0.004);
    // the ring has to be an OUTER shadow: a row paints its own background on hover and
    // would cover an inset ring along its own edge
    say("  every card carries a hairline ring",
      v.cards.every(x=>/0px 0px 0px 1px/.test(x.sh)) ? true
        : v.cards.filter(x=>!/0px 0px 0px 1px/.test(x.sh)).length+" without");
    say("  and a shadow under it, so it lies on something",
      v.cards.every(x=>x.sh.split(/,(?![^(]*\))/).length>=3) ? true
        : v.cards.map(x=>x.sh.split(/,(?![^(]*\))/).length).join(" "));
    say("  with a lit top edge",
      v.cards.every(x=>/linear-gradient/.test(x.img)) ? true
        : v.cards.filter(x=>!/linear-gradient/.test(x.img)).length+" without");
    // the whole point of doing it with shadows: a border would have eaten 2px of every
    // card's content box and shifted every row inside it
    say("  none of it drawn as a border, so nothing inside moved",
      v.cards.every(x=>x.border===0 && x.w===x.inner));

    note("  grain", "z "+v.grain.z+", opacity "+v.grain.op+", "+v.grain.blend);
    say("  the grain is there and faint", /svg|url/.test(v.grain.img)
      && v.grain.op>0 && v.grain.op<=0.05);
    // above the panel's own ground and below everything in it
    say("    behind the content, not over it", (+v.grain.z)<0 && v.grain.pos==="absolute");
    say("    and never in the way of a tap", v.grain.pe==="none");
    await c.close();
  }

  // a tinted style panel derives its card fill from the family ground, so the step has to
  // survive all eighteen of them rather than just the two neutral grounds
  {
    const c=await b.newContext({viewport:{width:390,height:844},colorScheme:"dark"});
    const p=await c.newPage();
    const D=require(path.join(__dirname,"..","src","data.js"));
    const fams=D.FAMS.map(f=>f[0]);
    const pick=fams.map(k=>(D.DATA.find(r=>r[3]===k)||[])[0]).filter(Boolean);
    const thin=[];
    for(const id of pick){
      await p.goto(URL+"#"+id); await arm(p); await shown(p,"#chart .n"); await settle(p);
      if(await p.evaluate(()=>!document.body.classList.contains("open"))){
        await p.click("#grab").catch(()=>{});
        await until(p,()=>document.body.classList.contains("open")); await settle(p); }
      await settle(p);
      const r=await p.evaluate(()=>{
        const g=document.querySelector("#panel .listgrp, #panel .picks, #panel .reads");
        if(!g) return null;
        return {card:getComputedStyle(g).backgroundColor,
          panel:getComputedStyle(document.getElementById("panel")).backgroundColor}; });
      if(!r) continue;
      const gap=Math.abs(lum(r.card)-lum(r.panel));
      if(gap<0.004) thin.push(id+" "+gap.toFixed(4));
    }
    say("the step holds on every family's tinted panel ("+pick.length+" checked)",
      thin.length===0 ? true : thin.join(", "));
    await c.close();
  }
  await b.close();
})();
