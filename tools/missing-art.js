#!/usr/bin/env node
// Who in the app has no picture.
//
// A name draws a picture if PHOTO has a portrait for it, or COVERART has a record sleeve.
// Everything else falls back to the role glyph, which is a real design state and not a
// bug, but it is also the list you want when you go looking for more images.
//
// The key-artist list is parsed out of each style's note at runtime, so this file lifts
// that parser verbatim rather than approximating it: if the two ever drift, the list is
// wrong in the direction that wastes your afternoon. verify-missing-art.js checks this
// output against what the running app actually draws.
const fs=require("fs"), path=require("path");
const D=require(path.join(__dirname,"..","src","data.js"));

const JOIN=new Set(["in","the","of","and","a","an","on","at","for","to","de","la","le","du","des","el","y"]);
const titleish = s=>{ const w=s.split(/\s+/); return w.length<=6 && w.every(x=> x==="&" || x==="+" || /^[("‘“]*[A-Z0-9]/.test(x) || JOIN.has(x.toLowerCase().replace(/[^a-z]/g,""))); };
const PLACE=/^(UK|US|USA|US\/UK|Japan|Ghana|Trinidad|Jamaica|Dominican|Rotterdam|Durban|Johannesburg|Lagos|Medellín|Berlin\/Milan|Goa|India|South Africa|1080p)$|-led$/i;

function whoOf(note){
  const fromNote=note.replace(/^[^:]{0,40}:\s*/,"").split(/;|\s·\s/)[0]
    .replace(/\s*\([^)]*\)/g,"").replace(/'[^']*'/g,"").replace(/\s+,/g,",")
    .replace(/,\s*,/g,",").replace(/\s{2,}/g," ").trim().replace(/^,|,$/g,"");
  const items = fromNote ? fromNote.split(",").map(s=>s.trim()).filter(Boolean) : [];
  const prose = /(?:^|\s)[a-z]+ed\b.*\bin\b/.test(fromNote||"")
    || /\bvia\b|\bfrom\b|\bscene\b|\bera\b|\bstyle\b|\bmusic\b/i.test(fromNote||"");
  const looksLikeArtists = items.length>=1 && !prose && items.every(titleish);
  return looksLikeArtists ? fromNote.split(",").map(s=>s.trim()).filter(x=>x&&!PLACE.test(x)) : [];
}

const PHOTO=D.PHOTO||{}, COVERART=D.COVERART||{};
const rows=new Map();   // name -> {name, kind, styles:Set, key:bool}
for(const r of D.DATA){
  const id=r[0], name=r[1], note=r[5]||"";
  const key=[...new Set([...whoOf(note), ...((D.ART||{})[id]||[])])];
  const roster=((D.ROSTER||{})[id]||[]);
  const add=(n,isKey)=>{
    if(!n) return;
    let e=rows.get(n);
    if(!e){ e={name:n, styles:new Set(), key:false}; rows.set(n,e); }
    e.styles.add(name); e.key = e.key || isKey;
  };
  key.forEach(n=>add(n,true));
  roster.forEach(n=>add(n,false));
}
for(const e of rows.values())
  e.kind = PHOTO[e.name] ? "portrait" : COVERART[e.name] ? "cover" : "none";

const all=[...rows.values()];
const missing=all.filter(e=>e.kind==="none");
const keyMissing=missing.filter(e=>e.key);

const n=(a)=>a.length;
console.log("named in the app:      "+n(all));
console.log("  with a portrait:     "+n(all.filter(e=>e.kind==="portrait")));
console.log("  with an album cover:  "+n(all.filter(e=>e.kind==="cover")));
console.log("  with neither:        "+n(missing));
console.log("");
console.log("key artists (the circles and the Key artists page):");
const key=all.filter(e=>e.key);
console.log("  "+n(key)+" named, "+n(keyMissing)+" with no picture");

// Most-wanted first: a name on eight styles is worth more than one on a single style.
const byReach=(a,b)=> b.styles.size-a.styles.size || a.name.localeCompare(b.name);
const esc=s=>/[",]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
const out=path.join(__dirname,"..","missing-art.csv");
fs.writeFileSync(out, "artist,key_artist,styles,appears_in\n"
  + missing.sort(byReach).map(e=>
      [esc(e.name), e.key?"yes":"no", e.styles.size, esc([...e.styles].sort().join("; "))].join(",")
    ).join("\n") + "\n");
console.log("\nwrote "+path.relative(process.cwd(),out)+" — "+n(missing)+" rows, most-used first");
console.log("\nthe ten that would buy the most:");
keyMissing.sort(byReach).slice(0,10).forEach(e=>
  console.log("  "+String(e.styles.size).padStart(2)+"  "+e.name+"  ("+[...e.styles].slice(0,3).join(", ")+")"));
