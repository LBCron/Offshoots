// The light-mode half of every family skin, derived rather than hand-picked.
//
// A skin is [ground, type, accent]. In dark mode it is the family's cover-art ground: a
// deep field with cream type on it. The same field under a near-white map reads as a
// black slab, and the five near-black families read as the heaviest slab of all, which
// is what issue #6 is about.
//
// So each family gets a second trio for light mode, built from the identity it already
// has rather than invented: a pale wash of the family's own hue, deep type in that hue,
// and an accent in the same hue dark enough to read on the wash.
//
// Where the hue comes from matters. Ten families carry it in the ground. Four — Punk,
// Alt & Indie, Hip Hop and Metal — are near-black on purpose and are told apart only by
// their accent, so the wash comes from the accent instead: that is the thing that says
// which of them you are looking at. Rock and Western art are neutral in both, warm and
// cool respectively, and stay that way.
//
//   node tools/lightskins.js           print the table and the contrast
//   node tools/lightskins.js --write   write them into src/data.js
const fs=require("fs"), path=require("path");
const SRC=path.join(__dirname,"..","src","data.js");

// ---- colour ----
const srgb=h=>{h=h.replace("#","");
  if(h.length===3) h=h.split("").map(c=>c+c).join("");
  return [0,2,4].map(i=>parseInt(h.substr(i,2),16)/255);};
const hex=v=>"#"+v.map(x=>Math.round(Math.max(0,Math.min(1,x))*255)
  .toString(16).padStart(2,"0")).join("");
const lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
const gam=c=>c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055;
function toOklab([r,g,b]){
  const R=lin(r),G=lin(g),B=lin(b);
  const l=Math.cbrt(.4122214708*R+.5363325363*G+.0514459929*B);
  const m=Math.cbrt(.2119034982*R+.6806995451*G+.1073969566*B);
  const s=Math.cbrt(.0883024619*R+.2817188376*G+.6299787005*B);
  return [.2104542553*l+.7936177850*m-.0040720468*s,
          1.9779984951*l-2.4285922050*m+.4505937099*s,
          .0259040371*l+.7827717662*m-.8086757660*s];
}
function fromOklab([L,a,b]){
  const l=(L+.3963377774*a+.2158037573*b)**3;
  const m=(L-.1055613458*a-.0638541728*b)**3;
  const s=(L-.0894841775*a-1.2914855480*b)**3;
  return [gam( 4.0767416621*l-3.3077115913*m+.2309699292*s),
          gam(-1.2684380046*l+2.6097574011*m-.3413193965*s),
          gam(-.0041960863*l-.7034186147*m+1.7076147010*s)];
}
const toLch=h=>{const [L,a,b]=toOklab(srgb(h));
  return {L, C:Math.hypot(a,b), h:Math.atan2(b,a)};};
const fromLch=({L,C,h})=>hex(fromOklab([L,C*Math.cos(h),C*Math.sin(h)]));
const lum=h=>{const [r,g,b]=srgb(h).map(lin); return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);
  return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05))).toFixed(2);};

// ---- the derivation ----
// One set of targets for all eighteen, so no family can come out heavier than the rest.
const WASH={L:.962, C:.020};   // the ground: a tint of the hue, close to the map's own white
const INK ={L:.300, C:.055};   // the type on it
const ACC ={L:.520, C:.120};   // links and the one button, on that ground
// Neutral families keep a trace of their warmth or coolness rather than going grey.
const FLOOR=.006;

function light([tint,ink,acc]){
  const t=toLch(tint), a=toLch(acc);
  // the accent carries the identity wherever the ground is deliberately near-black
  const src = (acc.toLowerCase()!==ink.toLowerCase() && t.C<.03) ? a : t;
  const hue = src.h;
  const chroma = Math.max(src.C, FLOOR)/Math.max(src.C, FLOOR);   // 1, kept for clarity
  const w=fromLch({L:WASH.L, C:Math.min(WASH.C, Math.max(src.C,FLOOR)*0.9), h:hue});
  const k=fromLch({L:INK.L,  C:Math.min(INK.C,  Math.max(src.C,FLOOR)*1.6), h:hue});
  // an accent only where there is one to keep; otherwise the type doubles as it, as it
  // does in dark mode
  const c = acc.toLowerCase()===ink.toLowerCase() ? k
    : fromLch({L:ACC.L, C:Math.min(ACC.C, Math.max(a.C,FLOOR)*1.1), h:a.h});
  return [w,k,c];
}

const D=require(SRC);
const rows=[];
for(const [fam,s] of Object.entries(D.FAMSKIN)){
  const l=light(s);
  rows.push({fam, dark:s, light:l,
    inkOn:ratio(l[1],l[0]), accOn:ratio(l[2],l[0]),
    vsWhite:ratio(l[0],"#ffffff"), vsMap:ratio(l[0],"#fbfbfd"),
    darkInkOn:ratio(s[1],s[0]), darkVsWhite:ratio(s[0],"#ffffff")});
}
if(!process.argv.includes("--write")){
  console.log("fam".padEnd(8)+"ground   type     accent   type/ground  acc/ground  ground/white"
    +"   (was ground/white)");
  for(const r of rows)
    console.log(r.fam.padEnd(8)+r.light[0]+"  "+r.light[1]+"  "+r.light[2]
      +"  "+String(r.inkOn).padStart(10)+String(r.accOn).padStart(12)
      +String(r.vsWhite).padStart(14)+String(r.darkVsWhite).padStart(20));
  const w=rows.map(r=>r.vsWhite);
  console.log("\nground against white: "+Math.min(...w)+" to "+Math.max(...w)
    +"  (was "+Math.min(...rows.map(r=>r.darkVsWhite))+" to "
    +Math.max(...rows.map(r=>r.darkVsWhite))+")");
  const bad=rows.filter(r=>r.inkOn<7 || r.accOn<4.5);
  console.log(bad.length ? "UNDER TARGET: "+bad.map(r=>r.fam).join(", ")
    : "every family: type at least 7:1, accent at least 4.5:1");
  process.exit(0);
}
let s=fs.readFileSync(SRC,"utf8");
const next=Object.fromEntries(rows.map(r=>[r.fam, r.dark.concat(r.light)]));
const line="const FAMSKIN = "+JSON.stringify(next)+";";
s=s.replace(/const FAMSKIN = \{[\s\S]*?\};/, line);
fs.writeFileSync(SRC,s);
console.log("wrote "+rows.length+" skins into src/data.js");
