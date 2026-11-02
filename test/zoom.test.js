// Zoom has to look like zoom. The labels used to be pinned to a fixed size while the dots,
// the spacing and the lanes all grew, so magnifying the map slid it under the type instead
// of enlarging it, and the control read as broken. The pinning was really there for a
// floor: unfloored, 139 of the 460 labels fell under 9px at the far end. So the sizes move
// with Z and stop at the floor. This checks both halves, and that the change stayed on the
// map: panel and chrome type are not part of the zoom.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,shown,arm}=require("./_wait");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  const p=await (await b.newContext({viewport:{width:1280,height:860}})).newPage();
  await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);

  // through the control, because that is the only way in: setZoom is not on the page
  const at=async z=>{
    await p.click("#zreset");
    const steps=Math.round((z-1)*10);
    for(let i=0;i<Math.abs(steps);i++) await p.click(steps>0?"#zin":"#zout");
    await settle(p);
    return p.evaluate(()=>{
      const t=[...document.querySelectorAll("#chart text:not(.halo)")]
        .map(x=>parseFloat(getComputedStyle(x).fontSize)).filter(Boolean).sort((a,b)=>a-b);
      const ui=[...document.querySelectorAll("#panel .secttl, #panel .lrlbl, #zpct")]
        .map(x=>parseFloat(getComputedStyle(x).fontSize));
      return {n:t.length, min:t[0], max:t[t.length-1],
        med:t[Math.floor(t.length/2)],
        w:+document.querySelector("#chart").getAttribute("width"), ui};
    });
  };

  const out=await at(0.7), one=await at(1), mid=await at(1.6), far=await at(3.3);
  note("labels at 70% / 100% / 160% / 330%",
    [out,one,mid,far].map(m=>m.min.toFixed(1)+"-"+m.max.toFixed(1)+"px").join("  "));
  note("canvas width", [out,one,mid,far].map(m=>Math.round(m.w)).join(" → "));

  // the thing she could see: the map grew and the names did not
  say("zooming in makes the names bigger ("
    + one.max.toFixed(1)+" → "+mid.max.toFixed(1)+" → "+far.max.toFixed(1)+"px)",
    mid.max>one.max*1.3 && far.max>mid.max*1.3);
  say("  in step with the canvas, so the map is magnified rather than respaced ("
    + (far.max/one.max).toFixed(2)+"× type, "+(far.w/one.w).toFixed(2)+"× wide)",
    Math.abs((far.max/one.max)-(far.w/one.w))<0.25);
  say("zooming out makes them smaller ("+one.max.toFixed(1)+" → "+out.max.toFixed(1)+"px)",
    out.max<one.max*0.85);

  // and the reason the sizes were pinned in the first place
  say("  but none of them goes under the floor ("+out.min.toFixed(1)+"px at 70%)",
    out.min>=11 && far.min>=11);
  say("  so nothing on the map is ever set under 11px",
    [out,one,mid,far].every(m=>m.min>=11)
      ? true : "smallest seen: "+Math.min(...[out,one,mid,far].map(m=>m.min)).toFixed(1));

  // the tiers are the one thing the size says, and they have to survive the scaling
  say("the ranking holds at every zoom, so hubs still read as hubs",
    [out,one,mid,far].every(m=>m.max>m.med && m.med>=m.min));

  // scope: this is a map control, not a text-size control
  say("the panel and the chrome do not resize with it",
    JSON.stringify(one.ui)===JSON.stringify(far.ui)
      && JSON.stringify(one.ui)===JSON.stringify(out.ui)
      ? true : [out,one,far].map(m=>JSON.stringify(m.ui)).join(" vs "));
  say("  and every style is still labelled ("+far.n+")",
    out.n===one.n && one.n===far.n);

  await b.close();
})();
