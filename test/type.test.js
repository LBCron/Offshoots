// Type and tap targets on the panels.
//
// The panel used to carry twenty different font sizes, most of them under 13px, plus
// three all-caps labels with letter-spacing, and controls as short as 28px. None of
// that is how iOS sets text. This suite pins the result so it cannot drift back:
//
//   - nothing readable is under 13px (SF's Footnote, the smallest step Apple ships)
//   - no all-caps tracked micro-labels
//   - anything you tap clears 44pt
//
// It measures what is painted rather than reading the stylesheet, so a rule that loses
// the cascade still fails here. That matters: a higher-specificity `all:unset` silently
// cancelled the panel title's height once.
//
// It walks three surfaces, not one. An earlier version only walked the root panel, and
// the all-caps check passed against the very CSS it was written to catch, because every
// all-caps label lived in the style panel and the menus.
const {chromium}=require("playwright");
const skipWelcome=require("./_hello");
const {settle,until,shown,arm}=require("./_wait");
const URL="file://"+__dirname+"/../index.html";
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));
// Every size here is read off what is painted, so nothing may be measured mid-transition.
// boot runs on document.fonts.ready and draws the map, so the first node is what says boot
// has chosen what to show; the lane dim transitions that follow are what settle waits out.
const ready=async q=>{ await arm(q); await shown(q,"#chart .n"); await settle(q); };
// a deep link selects on boot, and the style panel measured below is built by the selection
const selected=async q=>{ await ready(q);
  await until(q,()=>!!document.querySelector("#chart .n.cur")); await settle(q); };
// The glide drives #panel with an inline height and clears it on transitionend, so an
// inline height still on the panel means the sheet is still moving even though nothing is
// mutating: type measured then would be type measured in flight.
const opened=async q=>{ await until(q,()=>document.body.classList.contains("open"));
  await until(q,()=>!document.getElementById("panel").style.height); await settle(q); };
// A push leaves the page it came from visible until it is hidden 240ms later, so the
// arrival is "the first page still showing is this one" rather than "this one exists".
const onPage=async(q,k)=>{ await until(q,k=>{
    const u=[...document.querySelectorAll(".ppage")].filter(x=>!x.hidden)[0];
    return !!u && u.dataset.p===k;},k); await settle(q); };

// Touch and pointer are different tiers, so the floors differ. A phone and an iPad
// hold iOS's 17pt Body and 44pt targets; a desktop sidebar steps down one notch the
// way macOS does. Both are asserted, so neither tier can quietly drift.
const TIERS={touch:{minType:13,tap:44}, pointer:{minType:12,tap:36}};

// The map is its own typographic problem: 460 labels competing for one canvas. Label
// size used to be derived from the zoom scale, which put 139 of them under 9px and the
// smallest at 7.9px. They sit in a legible band now and do not move with zoom, so the
// floor is the thing worth pinning. Measured on what is painted, across the whole map
// rather than one sample, because the sizes vary per node.
const MAP_FLOOR={touch:11, pointer:11.5};
const readMap=(p)=>p.evaluate(()=>{
  const px=e=>parseFloat(getComputedStyle(e).fontSize);
  const labels=[...document.querySelectorAll("#chart .n text:not(.halo)")].map(px).sort((a,b)=>a-b);
  const one=s=>{const e=document.querySelector(s); return e?+px(e).toFixed(1):null;};
  return {n:labels.length, min:+labels[0].toFixed(1), max:+labels[labels.length-1].toFixed(1),
    axis:one("#axis text"), lane:one(".lane .vt"), count:one(".lane .cnt")};
});
// decorative glyphs and counters are not reading copy, so they are exempt by name
const EXEMPT="\\b(cnt|vt|ck|dot|sw|mi|cv|shg|upchev|svcchev|pkgo|plgo)\\b";
// The mode chips are set 4px under the tap floor on purpose: they sit in a dense grid of
// 24 where the gaps between them are part of the target, and the height was asked for.
// Named rather than waived silently, so the exception stays visible.
const SHORT=/^(chip|lrlbl)$/;

const readType=(p,scope)=>p.evaluate(([ex,sc])=>{
  const re=new RegExp(ex), out=[];
  document.querySelectorAll(sc+" *").forEach(e=>{
    if(e.children.length || !e.textContent.trim()) return;
    const cs=getComputedStyle(e);
    if(cs.display==="none"||cs.visibility==="hidden"||!e.getClientRects().length) return;
    const cls=(e.className||e.tagName).toString();
    if(re.test(cls)) return;
    out.push({cls:cls.split(" ")[0]||e.tagName, size:parseFloat(cs.fontSize),
      tt:cs.textTransform, txt:e.textContent.trim().slice(0,18)});
  });
  return out;
},[EXEMPT,scope]);

const readTaps=(p,scope,tap)=>p.evaluate(([sc,t,sh])=>{
  const out=[];
  document.querySelectorAll(sc+" button, "+sc+" a, "+sc+" summary").forEach(e=>{
    const r=e.getBoundingClientRect(), d=getComputedStyle(e).display;
    if(!r.height || d==="none") return;
    // a link set inline in running prose flows with the text; the 44pt floor is for
    // discrete controls, not for a phrase inside a paragraph
    if(e.tagName==="A" && d==="inline") return;
    const after=getComputedStyle(e,"::after");       // a control may expand its own hit area
    let h=r.height;
    if(after.content!=="none" && after.position==="absolute"){
      const inset=parseFloat(after.top);
      if(!isNaN(inset) && inset<0) h += -inset*2;
    }
    const cls=(e.className||e.tagName).toString().split(" ")[0]||e.tagName;
    if(h+0.5 < t && !new RegExp(sh).test(cls)) out.push({cls, h:Math.round(h)});
  });
  const seen=new Map(); out.forEach(o=>{ if(!seen.has(o.cls)) seen.set(o.cls,o); });
  return [...seen.values()];
}, [scope, tap, SHORT.source]);


// A full-bleed rule across the panel is the thing being replaced: grouping is done with
// a shaded block and, inside a list, a hairline inset to where the text starts.
const readRules=(p)=>p.evaluate(()=>{
  const body=document.getElementById("panelBody");
  const w=body.getBoundingClientRect().width, out=[];
  body.querySelectorAll("*").forEach(e=>{
    if(e.closest(".navrow")) return;              // the sticky header's hairline is a scroll cue
    const cs=getComputedStyle(e), r=e.getBoundingClientRect();
    if(!r.width) return;
    const t=parseFloat(cs.borderTopWidth)||0, b=parseFloat(cs.borderBottomWidth)||0;
    if((t>0||b>0) && r.width >= w*0.9)
      out.push({cls:(e.className||e.tagName).toString().split(" ")[0]||e.tagName,
                px:Math.max(t,b), width:Math.round(r.width)});
  });
  return out;
});

(async()=>{
  const b=await chromium.launch(); skipWelcome(b);
  let bad=0;
  let TIER=TIERS.touch;
  const check=(label,type,taps)=>{
    const small=type.filter(t=>t.size<TIER.minType);
    say(label+": "+type.length+" strings, none under "+TIER.minType+"px"
      +(small.length?" — "+[...new Set(small.map(t=>t.cls+" "+t.size+"px"))].join(", "):""), small.length===0);
    if(small.length) bad++;
    const caps=type.filter(t=>t.tt==="uppercase");
    say(label+": no all-caps labels"
      +(caps.length?" — "+[...new Set(caps.map(t=>t.cls+' "'+t.txt+'"'))].join(", "):""), caps.length===0);
    if(caps.length) bad++;
    if(taps){
      say(label+": every control clears "+TIER.tap+"pt"
        +(taps.length?" — "+taps.map(t=>t.cls+" "+t.h+"px").join(", "):""), taps.length===0);
      if(taps.length) bad++;
    }
  };

  for(const [name,vp,mob,open,tierName] of [["phone",{width:390,height:844},true,true,"touch"],
                                   ["tablet",{width:834,height:1112},true,true,"touch"],
                                   ["desktop",{width:1440,height:900},false,false,"pointer"]]){
    TIER=TIERS[tierName];
    const ctx=await b.newContext({viewport:vp,isMobile:mob,hasTouch:mob,deviceScaleFactor:2});

    // 1. the overview
    let p=await ctx.newPage();
    await p.goto(URL); await ready(p);
    if(open){ await p.click("#grab").catch(()=>{}); await opened(p); }
    check(name+" overview", await readType(p,"#panelBody"), await readTaps(p,"#panelBody",TIER.tap));

    const rules=await readRules(p);
    say(name+": no full-bleed rules across the panel"
      +(rules.length?" — "+rules.map(r=>r.cls+" "+r.px+"px").join(", "):""), rules.length===0);
    if(rules.length) bad++;

    // open a list and confirm it is one grouped block with inset separators
    await p.click('[data-mode="coffee"]').catch(()=>{});
    await onPage(p,"mode:coffee");
    const grp=await p.evaluate(()=>{
      const ps=document.querySelector(".picks"); if(!ps) return null;
      const rows=[...ps.children];
      const sep=rows.length>1?getComputedStyle(rows[1],"::after"):null;
      return {rows:rows.length, groupBg:getComputedStyle(ps).backgroundColor,
        radius:parseFloat(getComputedStyle(ps).borderTopLeftRadius),
        firstHasSep:rows.length?getComputedStyle(rows[0],"::after").content!=="none"
          && parseFloat(getComputedStyle(rows[0],"::after").height)>0:false,
        sepLeft:sep?parseFloat(sep.left):-1, sepH:sep?parseFloat(sep.height):-1};
    });
    if(!grp){ say(name+": the pick list opened", false); bad++; }
    else {
      // unboxed: no ground, no radius, and the hairline carries the whole division
      const ok = grp.rows===12 && grp.radius<1
        && /rgba\(0, 0, 0, 0\)/.test(grp.groupBg)
        && grp.sepLeft>=24 && grp.sepH>0 && grp.sepH<=1 && !grp.firstHasSep;
      say(name+": "+grp.rows+" rows, no ground, radius "+grp.radius
        +", hairline "+grp.sepH+"px inset "+grp.sepLeft+"px, none above the first row", ok);
      if(!ok) bad++;
    }

    // the map itself
    const mp=await readMap(p);
    const floor=MAP_FLOOR[tierName];
    say(name+" map: all "+mp.n+" labels at or above "+floor+"px ("+mp.min+" to "+mp.max+")",
        mp.n>400 && mp.min>=floor-0.01);
    say(name+" map: the labels still have a range ("+mp.min+" to "+mp.max+")", mp.max-mp.min>=2);
    say(name+" map: and the biggest is at least half again the smallest", mp.max>=mp.min*1.5);
    const chrome=[["axis",mp.axis],["lane name",mp.lane],["lane count",mp.count]].filter(([,v])=>v!==null);
    const smallChrome=chrome.filter(([,v])=>v<11);
    say(name+" map: axis, lane and count all at or above 11px ("
        +chrome.map(([k,v])=>k+" "+v).join(", ")+")", smallChrome.length===0);
    if(!(mp.n>400 && mp.min>=floor-0.01) || mp.max-mp.min<2 || smallChrome.length) bad++;

    // 2. a pushed page, which is where the long lists live. The pick list above is a
    // pushed page too, so it has to be popped before the row under it can be reached.
    await p.click("#panelBack").catch(()=>{});
    await onPage(p,"root");
    await p.click('[data-page="roots"]').catch(()=>{});
    await onPage(p,"roots");
    const pg=await p.$('.ppage[data-p="roots"]');
    if(pg){
      check(name+" roots page", await readType(p,'.ppage[data-p="roots"]'),
                                await readTaps(p,'.ppage[data-p="roots"]',TIER.tap));
    } else say(name+" roots page: opened", false), bad++;
    await p.close();
    // 3. a style panel, on a fresh page: hash navigation on a loaded page does not select
    p=await ctx.newPage();
    await p.goto(URL+"#shoegaze"); await selected(p);
    if(open){ await p.click("#grab").catch(()=>{}); await opened(p); }
    const got=await p.$eval(".pcard .pttl .ptnm",e=>e.textContent).catch(()=>null);
    say(name+" style panel opened on Shoegaze", got==="Shoegaze");
    if(got!=="Shoegaze") bad++;
    check(name+" style", await readType(p,"#panelBody"), await readTaps(p,"#panelBody",TIER.tap));
    await p.close();
  }
  // the cover is the one thing that gets bigger on a pointer screen rather than smaller
  { const sizes={};
    for(const [name,vp] of [["phone",{width:390,height:844,isMobile:true,hasTouch:true}],
        ["tablet",{width:834,height:1112,isMobile:true,hasTouch:true}],
        ["desktop",{width:1440,height:900}]]){
      const p=await b.newPage({viewport:vp});
      await p.goto(URL+"#jamband"); await selected(p);
      sizes[name]=await p.evaluate(()=>{ const e=document.querySelector(".startrow img.pcov, .startrow .pcovph");
        return e?Math.round(e.getBoundingClientRect().width):0; });
      await p.close();
    }
    // The cover used to grow with the pointer tier, because the row was the cover and a
    // title. It came down and stopped scaling when Start listening gave the title and its
    // introduction the width instead: what the art has to do now is say which record this
    // is, at a glance, beside words that carry the rest. Same size on every tier, so the
    // block reads the same everywhere.
    say("playlist cover: phone "+sizes.phone+", tablet "+sizes.tablet+", desktop "+sizes.desktop,
      sizes.phone>=88 && sizes.phone<=120
      && sizes.tablet===sizes.phone && sizes.desktop===sizes.phone);
    const dp=await b.newPage({viewport:{width:1440,height:900}});
    await dp.goto(URL+"#jamband"); await selected(dp);
    const box=await dp.evaluate(()=>{ const b=document.querySelector(".startrow img.pcov, .startrow .pcovph").getBoundingClientRect();
      return [Math.round(b.width),Math.round(b.height)]; });
    await dp.close();
    say("  and still square at "+box.join("x"), box[0]===box[1]);
  }

  // ---- a control is something you press, not something you read ----
  // A browser's own stylesheet sets user-select:none on a button. all:unset throws that
  // away with the padding it was reaching for, and every control in this app is built on
  // all:unset, so all 97 of them had selectable type. On iOS a tap held a fraction too
  // long then put selection handles around the words instead of pressing: the back
  // button stopped answering until the selection was dismissed.
  // Headless Chromium has no touch-selection UI, so the symptom cannot be reproduced
  // here. The computed style is the defect, and that is what this measures.
  {
    const q=await b.newPage({viewport:{width:430,height:900}});
    await q.goto(URL); await ready(q);
    await q.click("#grab").catch(()=>{}); await settle(q);
    await q.click('[data-page="modes"]').catch(()=>{}); await settle(q);
    const r=await q.evaluate(()=>{
      const loose=[], press=[...document.querySelectorAll("button,[role='button']")];
      for(const e of press){
        if(!e.getClientRects().length) continue;
        if(getComputedStyle(e).userSelect!=="none")
          loose.push((e.id||e.className||e.tagName).toString().split(" ")[0]);
      }
      // prose is the other half of the claim: a blurb you cannot copy is its own bug
      const prose=document.querySelector(".pglede,.note,.rdn");
      return {n:press.length, loose:[...new Set(loose)],
        prose:prose?getComputedStyle(prose).userSelect:"(none found)"};
    });
    say("none of the "+r.n+" controls carry selectable type"
      +(r.loose.length?" — "+r.loose.join(", "):""), r.loose.length===0);
    if(r.loose.length) bad++;
    say("  while the prose stays selectable ("+r.prose+")", r.prose!=="none");
    if(r.prose==="none") bad++;
    await q.close();
  }

  await b.close();
  process.exit(bad?1:0);
})();
