// Dragging the map with a mouse.
//
// A trackpad pans on its own and a phone has fingers. A mouse has a wheel and nothing
// else, so the map is grabbed from empty space and pushed. The two things that can go
// wrong are both about the click that a drag ends with: letting it through would clear
// the selection, or select whatever the cursor happened to stop over. The pan also has
// to stay out of the way of everything that already answers a click.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const Dk={width:1280,height:900};
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

async function fresh(b,hash){ const p=await b.newPage({viewport:Dk}); const errs=[];
  p.on("pageerror",e=>errs.push(String(e)));
  await p.goto(URL+(hash||"")); await arm(p);
  // the map is drawn, not merely loaded: every check here measures against node positions
  await shown(p,"#chart .n"); await settle(p);
  p._errs=errs; return p; }
const at=async p=>p.evaluate(()=>[scroller.scrollLeft,scroller.scrollTop]);
// An empty patch to grab the map by. This used to be a fixed fraction of the viewport,
// which is a guess about where the labels are not: it held until a browser with different
// font metrics moved a label under it, and then the drag started on a style and the suite
// blamed the app. So ask the page instead, and sweep a band low and right of centre until
// a point answers with nothing — clear of the lane rail on the left and the sidebar.
async function empty(p){
  const pt=await p.evaluate(()=>{
    const r=document.getElementById("scroller").getBoundingClientRect();
    const free=(x,y)=>{ const t=document.elementFromPoint(x,y);
      return t && !t.closest(".n") && !t.closest("#lanes") && !t.closest(".pcard")
        && !t.closest("#sidebar") && !t.closest("button") && !t.closest("a"); };
    for(let fy=.72; fy<=.94; fy+=.03)
      for(let fx=.55; fx<=.92; fx+=.03){
        const x=r.x+r.width*fx, y=r.y+r.height*fy;
        if(free(x,y)) return [x,y];
      }
    return null;
  });
  if(!pt) throw new Error("no empty ground found to grab the map by");
  return pt;
}
async function drag(p,x,y,dx,dy,steps){ steps=steps||8;
  await p.mouse.move(x,y); await p.mouse.down();
  for(let i=1;i<=steps;i++) await p.mouse.move(x+dx*i/steps, y+dy*i/steps);
  const mid=await p.evaluate(()=>[scroller.scrollLeft,scroller.scrollTop,
    document.body.classList.contains("panning")]);
  await p.mouse.up();
  // the pan is over when the body stops saying it is panning, and the scroller has come
  // to rest: momentum keeps moving it after the button is up
  await until(p,()=>!document.body.classList.contains("panning"));
  await settle(p);
  return mid; }

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);

  let p=await fresh(b);
  say("the background offers a grab cursor",
    (await p.$eval("#scroller",e=>getComputedStyle(e).cursor))==="grab");
  await p.evaluate(()=>{scroller.scrollLeft=400;scroller.scrollTop=200;});
  const [ex,ey]=await empty(p);
  const from=await at(p);
  const mid=await drag(p,ex,ey,-160,-80);
  say("dragging left and up scrolls right and down ("
    +(mid[0]-from[0])+", "+(mid[1]-from[1])+")", mid[0]-from[0]===160 && mid[1]-from[1]===80);
  say("and the body says it is panning while it happens", mid[2]===true);
  say("which it stops saying after", (await p.evaluate(()=>document.body.classList.contains("panning")))===false);

  // under the slop a drag is a click, so the background still answers one
  const was=await at(p);
  await p.mouse.move(ex,ey); await p.mouse.down();
  await p.mouse.move(ex-2,ey-1); await p.mouse.up(); await settle(p);
  const now=await at(p);
  say("two pixels is a click, not a pan", now[0]===was[0] && now[1]===was[1]);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);
  await p.close();

  // the click a drag ends on must not reach the map
  p=await fresh(b,"#bebop");
  const [bx,by]=await empty(p);
  await drag(p,bx,by,-150,0); await settle(p);
  say("a drag leaves the selection alone ("+(await p.evaluate(()=>location.hash))+")",
    (await p.evaluate(()=>location.hash))==="#bebop");
  // and one that ends over a style must not select it: the grab has to start on free
  // ground, so look for a pair of points where the far one is a style and the near one
  // is not, rather than assuming a fixed offset lands clear of the labels
  await p.evaluate(()=>{scroller.scrollLeft=0;scroller.scrollTop=0;});
  await settle(p);
  const pair=await p.evaluate(()=>{
    const free=(x,y)=>{const t=document.elementFromPoint(x,y); return t && !t.closest(".n");};
    for(const n of document.querySelectorAll("#chart .n")){
      const r=n.getBoundingClientRect();
      if(r.top<80||r.bottom>innerHeight-40) continue;
      const tx=Math.round(r.x+r.width/2), ty=Math.round(r.y+r.height/2);
      for(const d of [150,190,230,270]) if(tx+d<innerWidth-420 && free(tx+d,ty))
        return {sx:tx+d, sy:ty, dx:-d, id:n.dataset.id};
    } return null;});
  say("found a drag that ends on a style"+(pair?" ("+pair.id+")":""), !!pair);
  if(pair){ await drag(p,pair.sx,pair.sy,pair.dx,0);
    say("nor select whatever it stops over ("+(await p.evaluate(()=>location.hash))+")",
      (await p.evaluate(()=>location.hash))==="#bebop"); }
  await p.close();

  // and the things that already answer a click keep answering it
  p=await fresh(b);
  const box=await p.$eval("#chart .n text:not(.halo)",e=>{const r=e.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height};});
  // a style is not a handle: pressing on one must not start a pan
  const at0=await at(p);
  await p.mouse.move(box.x+box.width/2, box.y+box.height/2); await p.mouse.down();
  await p.mouse.move(box.x+box.width/2-120, box.y+box.height/2); await p.mouse.up();
  await settle(p);
  const at1=await at(p);
  say("dragging from a style does not pan", at1[0]===at0[0] && at1[1]===at0[1]);
  await p.mouse.click(box.x+box.width/2, box.y+box.height/2); await settle(p);
  const hash=await p.evaluate(()=>location.hash);
  say("and clicking one still selects it ("+hash+")", hash.length>1);
  say("no page errors", p._errs.filter(x=>!/Failed to load/.test(x)).join(" | ")||true);

  await b.close();
})();
