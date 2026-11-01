// Text contrast on the root panel, which is the one surface with no family tint to
// carry it. Every string is measured against the colour actually painted behind it,
// walking up for the first non-transparent background: the muted grey clears 4.5 on the
// panel but used to fail it on the raised cards, which is exactly where the longest
// passages of text sit.
//
// Tinted style panels are not covered here. They derive --muted and --fill from the
// family's own ink and ground with color-mix, so the root tokens do not reach them.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
// boot runs on document.fonts.ready and draws the map, so the first node is the sign that
// boot has chosen what to show. The lane dim transitions follow it, which settle waits out.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing is
// mutating. Every colour here is read off a painted ground, so the sheet has to be at rest.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q); };

const lum=c=>{const [r,g,b]=c.map(v=>{v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
  return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>+(((Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05))).toFixed(2);
// Two spellings come back from getComputedStyle and they are not on the same scale.
// rgb()/rgba() give 0-255; a color-mix resolves to color(srgb r g b / a) with 0-1
// floats. Reading the second as the first makes white look black, which is how a panel
// at 16:1 was reported as 1.2:1 the first time this suite ran in light mode.
const parse=s=>{
  const n=(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  return /color\(/.test(s) ? n.map(v=>v*255) : n;
};

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  // Both palettes, because only one of them used to exist. While the app forced dark,
  // this file ran in Playwright's default light and measured dark values, so the day
  // light came back every string on the panel read as 1.2:1 at once.
  for(const [name,vp,mob,scheme] of [
      ["light mobile",{width:390,height:844},true,"light"],
      ["light desktop",{width:1440,height:900},false,"light"],
      ["dark mobile",{width:390,height:844},true,"dark"],
      ["dark desktop",{width:1440,height:900},false,"dark"]]){
    const ctx=await b.newContext({viewport:vp,isMobile:mob,hasTouch:mob,deviceScaleFactor:2,
      colorScheme:scheme});
    const p=await ctx.newPage();
    await p.goto(URL); await ready(p);
    if(mob){ await p.click("#grab"); await opened(p); }
    const rows=await p.evaluate(()=>{
      // The ground a string actually sits on, not the first painted ancestor. A
      // translucent background has to be composited over what is under it or the reading
      // is of a colour nobody can see: Share this app is #007aff text on 26% #007aff,
      // which read as blue on blue, 1:1, when the alpha was dropped.
      const num=c=>{ const n=(c.match(/[\d.]+/g)||[]).map(Number);
        const rgb=/color\(/.test(c) ? n.slice(0,3).map(v=>v*255) : n.slice(0,3);
        const a=/color\(/.test(c) ? (n.length>3?n[3]:1) : (n.length>3?n[3]:1);
        return {rgb, a:isNaN(a)?1:a}; };
      const bgOf=e=>{
        const stack=[];
        for(let n=e; n; n=n.parentElement){
          const c=getComputedStyle(n).backgroundColor;
          if(!c || /transparent/.test(c)) continue;
          const {rgb,a}=num(c);
          if(a<=0) continue;
          stack.push({rgb,a});
          if(a>=1) break;                       // opaque: nothing below it shows through
        }
        if(!stack.length) return "rgb(255, 255, 255)";
        // bottom upward, each layer painted over the one below
        let out=stack[stack.length-1].rgb;
        for(let i=stack.length-2;i>=0;i--){ const L=stack[i];
          out=out.map((v,k)=>L.rgb[k]*L.a + v*(1-L.a)); }
        return "rgb("+out.map(v=>Math.round(v)).join(", ")+")";
      };
      const out=[];
      // every leaf string in the root panel, rather than a list that can fall out of date
      document.querySelectorAll("#panelBody *").forEach(e=>{
        if(e.children.length || !e.textContent.trim()) return;
        const cs=getComputedStyle(e);
        if(cs.display==="none" || cs.visibility==="hidden" || !e.getClientRects().length) return;
        out.push([(e.className||e.tagName).toString().split(" ")[0], cs.color, bgOf(e),
                  parseFloat(cs.fontSize), +cs.fontWeight, e.textContent.trim().slice(0,24)]);
      });
      return out;
    });
    const bad=[];
    rows.forEach(([cls,col,bg,fs,fw,txt])=>{
      const big = fs>=24 || (fs>=18.66 && fw>=700);
      const r=ratio(parse(col),parse(bg));
      if(r < (big?3:4.5)) bad.push(cls+" "+r+" ("+txt+")");
    });
    say(name+": "+rows.length+" strings on the root panel, all at AA contrast"+(bad.length?" — "+bad.join(", "):""), bad.length===0);
    const worst=rows.map(([c,col,bg])=>ratio(parse(col),parse(bg))).sort((a,b)=>a-b)[0];
    say(name+": the faintest of them is "+worst+":1", worst>=4.5);
    await p.close();
  }
  await b.close();
})();
