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

  // ---- what the overview drops, and when ----
  // A leaf drawn as a dot takes no width, so the rows pack tighter and the map gets
  // shorter, which is what zooming out is for. The threshold was set when labels were
  // pinned to one size; now that they scale there is room at 80% that was not there
  // before, and 139 labels were vanishing a step too early.
  const seen=async z=>{
    await p.click("#zreset");
    const n=Math.round((z-1)*10);
    for(let i=0;i<Math.abs(n);i++) await p.click(n>0?"#zin":"#zout");
    await settle(p);
    return p.evaluate(()=>{ const sv=document.querySelector("#chart");
      const lab=[...sv.querySelectorAll(".n")].filter(g=>{
        const t=g.querySelector("text:not(.halo)");
        return t && getComputedStyle(t).display!=="none"; }).length;
      return {h:Math.round(+sv.getAttribute("height")), lab,
        total:sv.querySelectorAll(".n").length}; });
  };
  const z90=await seen(0.9), z80=await seen(0.8), z70=await seen(0.7);
  note("labelled at 90 / 80 / 70", [z90,z80,z70].map(x=>x.lab+" of "+x.total).join("  "));
  note("map height", [z90,z80,z70].map(x=>x.h+"px").join(" → "));
  say("every style is still named at 80% ("+z80.lab+" of "+z80.total+")",
    z80.lab===z80.total && z90.lab===z90.total);
  say("  and the map still gets shorter for it ("+z90.h+" → "+z80.h+"px)", z80.h<z90.h);
  // the floor on the other side: at the last step keeping them all makes the map taller
  // than it was a step up, and a zoom-out that grows the map is not a zoom-out
  say("at 70% the leaves go, which is what buys the height",
    z70.lab<z70.total && z70.h<z80.h);
  say("  and a named style is the one you can still read ("+z70.lab+" left)",
    z70.lab>z70.total*0.6);

  await b.close();
})();
