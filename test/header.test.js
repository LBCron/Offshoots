// The style name in the header bar, once you have scrolled past it.
//
// The root card already did this and style panels did not, so scrolling a style on a phone
// left the name cut off behind the back button and the bar's middle empty. measure() looked
// for .bigttl, which is the overview pages' heading; a style's name is .pttl, so it found
// nothing and the handover never fired.
const path=require("path");
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+path.join(__dirname,"..","index.html");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));

const read=p=>p.evaluate(()=>{
  const row=document.querySelector(".pcard .navrow");
  const slot=row&&row.querySelector(".navttl.ovttl");
  const mn=slot&&slot.querySelector(".mn");
  const bk=row&&row.querySelector("#panelBack");
  const lbl=bk&&bk.querySelector(".bklbl");
  const name=document.querySelector(".pttl .ptnm");
  const r=x=>x?x.getBoundingClientRect():null;
  const sr=r(slot), br=r(bk);
  return {on:document.getElementById("panel").classList.contains("barttl"),
    has:!!slot, text:mn?mn.textContent.trim():"",
    vis:slot?+getComputedStyle(slot).opacity:null,
    rowH:row?Math.round(r(row).height):null,
    name:name?name.textContent.trim():"",
    nameTop:name?Math.round(r(name).top):null,
    navBottom:row?Math.round(r(row).bottom):null,
    lbl:lbl?getComputedStyle(lbl).display:"(none)",
    gap: sr&&br ? Math.round(sr.left - br.right) : null};
});

(async()=>{
  const b=await chromium.launch(); await skipWelcome(b);
  // a phone and a desktop sidebar short enough that the panel actually scrolls
  for(const [tag,vp] of [["phone",{width:390,height:844}],["sidebar",{width:1280,height:600}]]){
    const p=await (await b.newContext({viewport:vp})).newPage();
    await p.goto(URL+"#bigbeat"); await arm(p); await shown(p,"#chart .n"); await settle(p);
    await until(p,()=>!!document.querySelector(".pcard .navrow")); await settle(p);

    const top=await read(p);
    say(tag+": the bar has a slot for the name", top.has);
    say("  carrying the style's own name (\""+top.text+"\")", top.text==="Big Beat");
    say("  hidden while the name is still on the page", top.vis===0 && top.on===false);

    await p.evaluate(()=>{ document.getElementById("panelBody").scrollTop=420; });
    await settle(p); await new Promise(r=>setTimeout(r,250));
    const down=await read(p);
    say("  and in once the name goes under the bar", down.on===true && down.vis===1);
    note("  name at", down.nameTop+"px, bar bottom "+down.navBottom+"px");
    say("  which is what it waits for", down.nameTop<=down.navBottom);
    // the bar is a fixed piece of furniture; a title appearing in it must not resize it
    say("  without the bar changing height ("+top.rowH+" → "+down.rowH+"px)",
      top.rowH===down.rowH);
    // back label and centred title are both the one thing you read, so one gives way
    say("  and the back label out of its way ("+down.lbl+")", down.lbl==="none");

    // going to another style has to start over, or the last name sits in the bar
    await p.evaluate(()=>{ const g=document.querySelector('.cxgo'); if(g) g.click(); });
    await settle(p); await new Promise(r=>setTimeout(r,250));
    const next=await read(p);
    say("  moving to another style clears it (now \""+next.name+"\")",
      next.on===false && next.vis===0);
    await p.close();
  }

  // the root card is where this came from and must still work
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  await p.goto(URL); await arm(p); await shown(p,"#chart .n"); await settle(p);
  await until(p,()=>!!document.querySelector(".ovcard .bigttl")); await settle(p);
  const r0=await read(p);
  await p.evaluate(()=>{ document.getElementById("panelBody").scrollTop=420; });
  await settle(p); await new Promise(r=>setTimeout(r,250));
  const r1=await read(p);
  say("the root card still hands its title over (\""+r1.text+"\")",
    r0.vis===0 && r1.vis===1 && r1.text==="Offshoots");
  await b.close();
})();
