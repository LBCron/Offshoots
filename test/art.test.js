// The cover art, checked against the disk rather than against itself.
//
// A COVER entry is a promise that a file exists. Nothing enforced it, so a pointer at a
// file that had never been written sat in the data unnoticed: the panel asked for it,
// got a 404, and fell back to the initials tile, which is exactly what a style with no
// art does. The failure was invisible because its symptom was the normal state.
const fs=require("fs"), path=require("path");
const D=require("../src/data.js");
const ART=path.join(__dirname,"..","art"), EXT=".jpg";
const say=(k,v)=>console.log((v===true?"PASS ":v===false?"FAIL ":"     ")+k+(typeof v!=="boolean"?": "+v:""));

const files=new Set(fs.readdirSync(ART).filter(f=>f.endsWith(EXT)).map(f=>f.slice(0,-EXT.length)));
const styles=new Set(D.DATA.map(r=>r[0]));
// what the app does: a style's file is COVER[id], or the id itself
const fileFor=id=>D.COVER[id]||id;
const covered=D.DATA.map(r=>r[0]).filter(id=>files.has(fileFor(id)));

say("art on disk: "+files.size+" files", files.size>0);
say("  covering "+covered.length+" of "+styles.size+" styles", covered.length>0);

// the check that was missing
const dead=Object.entries(D.COVER).filter(([,f])=>!files.has(f));
say("every COVER entry points at a file that is there",
  dead.length===0 ? true : dead.map(([k,v])=>k+" -> "+v+EXT).join(", "));

// a COVER entry for a style that does not exist is dead weight that reads as coverage
const ghost=Object.keys(D.COVER).filter(id=>!styles.has(id));
say("  and belongs to a style that exists",
  ghost.length===0 ? true : ghost.join(", "));

// two styles sharing one picture is a real choice sometimes, but never silently: the
// panel would show the same art twice in one lineage and look like a bug
const by={}; for(const id of covered) (by[fileFor(id)]=by[fileFor(id)]||[]).push(id);
const shared=Object.entries(by).filter(([,ids])=>ids.length>1);
say("  no two styles share one picture",
  shared.length===0 ? true : shared.map(([f,ids])=>f+": "+ids.join("+")).join(" | "));

// the extension is fixed in app.js, so a .jpeg or .png in art/ is a file that will never
// be asked for, however correct its name looks
const other=fs.readdirSync(ART).filter(f=>!f.endsWith(EXT)&&!f.startsWith("."));
say("  nothing in art/ that the app cannot ask for ("+EXT+" only)",
  other.length===0 ? true : other.join(", "));

// square, because the panel draws them in a square and a stray aspect ratio crops badly
let odd=[], small=[];
for(const id of covered){
  const f=path.join(ART,fileFor(id)+EXT);
  const b=fs.readFileSync(f);
  // JPEG SOF marker: walk the segments rather than pulling in a dependency
  let i=2, w=0, h=0;
  while(i<b.length-9){
    if(b[i]!==0xFF){ i++; continue; }
    const m=b[i+1];
    if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){ h=b.readUInt16BE(i+5); w=b.readUInt16BE(i+7); break; }
    i+=2+b.readUInt16BE(i+2);
  }
  if(!w||!h) continue;
  if(Math.abs(w-h)>1) odd.push(fileFor(id)+" "+w+"x"+h);
  if(Math.min(w,h)<300) small.push(fileFor(id)+" "+w+"x"+h);
}
say("  every cover square", odd.length===0 ? true : odd.slice(0,6).join(", "));
say("  and at least 300px", small.length===0 ? true : small.slice(0,6).join(", "));


// ---- the artist portraits, same promise ----
// PHOTO maps an artist name to a file under artists/. Both directions matter: an entry
// with no file draws a broken image where a glyph would have been fine, and a file
// nothing points at is weight in the folder and in every deploy that carries it.
const PDIR=path.join(__dirname,"..","artists");
if(fs.existsSync(PDIR)){
  const have=new Set(fs.readdirSync(PDIR).filter(f=>f.endsWith(EXT)).map(f=>f.slice(0,-EXT.length)));
  const want=Object.entries(D.PHOTO||{});
  const dead=want.filter(([,f])=>!have.has(f));
  const idle=[...have].filter(f=>!want.some(([,g])=>g===f));
  say("artist portraits: "+want.length+" named, "+have.size+" on disk", want.length>0);
  say("  every name pointing at a file that is there",
    dead.length===0 ? true : dead.slice(0,5).map(([n,f])=>n+" -> "+f+EXT).join(", "));
  say("  and nothing in the folder going unused",
    idle.length===0 ? true : idle.slice(0,5).join(", "));
  // A name the map no longer uses keeps its face in the folder and never draws it.
  // Key artists come from two places, ART and the style's own note, and the note is
  // parsed at runtime by a reader this file has no business reimplementing: a second
  // copy of that parser would drift and start failing on notes that are perfectly fine.
  // So the note is searched as text, which is looser than the parser and cannot be
  // wrong in the direction that matters here.
  const known=new Set();
  const notes=[];
  D.DATA.forEach(r=>{ (D.ART[r[0]]||[]).forEach(a=>known.add(a));
    (D.ROSTER[r[0]]||[]).forEach(a=>known.add(a));
    if(r[5]) notes.push(r[5]); });
  const blob=notes.join(" | ");
  const orphan=want.filter(([n])=>!known.has(n) && blob.indexOf(n)<0).map(([n])=>n);
  say("  and every portrait belonging to an artist the map names"
    + (orphan.length?" ("+orphan.length+" do not: "+orphan.slice(0,4).join(", ")+")":""),
    orphan.length===0);
  if(dead.length||idle.length||orphan.length) process.exitCode=1;
}

// ---- art for the playlists that cross the map ----
// A crossing asks for its file only when it says art:true, so the two have to agree:
// art:true with no file is a torn icon, and a file nothing claims is weight in the deploy.
{
  const XD=path.join(__dirname,"..","xplay");
  const X=D.XPLAY||[];
  const have=fs.existsSync(XD)
    ? new Set(fs.readdirSync(XD).filter(f=>f.endsWith(EXT)).map(f=>f.slice(0,-EXT.length)))
    : new Set();
  const want=X.filter(x=>x.art).map(x=>x.id);
  const dead=want.filter(id=>!have.has(id));
  const idle=[...have].filter(f=>want.indexOf(f)<0);
  say("crossing art: "+want.length+" claimed, "+have.size+" on disk", true);
  say("  every one claimed is there", dead.length===0 ? true : dead.join(", "));
  say("  and nothing on disk is unclaimed"
    + (idle.length?" (set art:true on "+idle.join(", ")+")":""),
    idle.length===0);
  if(dead.length||idle.length) process.exitCode=1;
}

// ---- the untitled style art ----
// Same pictures as art/, lettering removed. STYLEART only ever draws where a row prints
// the name itself, and it falls back to art/, so a gap here is cosmetic rather than
// broken; a name pointing at a file that is not there is not.
const SDIR=path.join(__dirname,"..","styles");
if(fs.existsSync(SDIR)){
  const have=new Set(fs.readdirSync(SDIR).filter(f=>f.endsWith(EXT)).map(f=>f.slice(0,-EXT.length)));
  const want=Object.entries(D.STYLEART||{});
  const ids=new Set(D.DATA.map(r=>r[0]));
  const dead=want.filter(([,f])=>!have.has(f));
  const idle=[...have].filter(f=>!want.some(([,g])=>g===f));
  const ghost=want.filter(([id])=>!ids.has(id)).map(([id])=>id);
  say("untitled style art: "+want.length+" styles, "+have.size+" files", want.length>0);
  say("  every one pointing at a file that is there",
    dead.length===0 ? true : dead.slice(0,5).map(([i,f])=>i+" -> "+f+EXT).join(", "));
  say("  and nothing in the folder going unused",
    idle.length===0 ? true : idle.slice(0,5).join(", "));
  say("  and belonging to a style that exists",
    ghost.length===0 ? true : ghost.slice(0,5).join(", "));
  if(dead.length||idle.length||ghost.length) process.exitCode=1;
}

// ---- album covers, the stand-in where there is no portrait ----
// COVERART only ever draws for a name PHOTO does not cover, so an entry in both is dead
// weight at best and, if the two ever disagree about which is newer, a silent swap.
const CDIR=path.join(__dirname,"..","covers");
if(fs.existsSync(CDIR)){
  const have=new Set(fs.readdirSync(CDIR).filter(f=>f.endsWith(EXT)).map(f=>f.slice(0,-EXT.length)));
  const want=Object.entries(D.COVERART||{});
  const dead=want.filter(([,f])=>!have.has(f));
  const idle=[...have].filter(f=>!want.some(([,g])=>g===f));
  const both=want.filter(([n])=>(D.PHOTO||{})[n]);
  say("album covers: "+want.length+" named, "+have.size+" on disk", want.length>0);
  say("  every name pointing at a file that is there",
    dead.length===0 ? true : dead.slice(0,5).map(([n,f])=>n+" -> "+f+EXT).join(", "));
  say("  and nothing in the folder going unused",
    idle.length===0 ? true : idle.slice(0,5).join(", "));
  say("  and none of them standing in for an artist who has a portrait"
    + (both.length?" ("+both.length+": "+both.slice(0,4).map(([n])=>n).join(", ")+")":""),
    both.length===0);
  // a sleeve is square like a cover, not 4:3 like a press photo
  const jpeg=p=>{ const b=fs.readFileSync(p); let i=2;
    while(i<b.length-9){ if(b[i]!==0xFF){ i++; continue; } const m=b[i+1];
      if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)
        return {h:b.readUInt16BE(i+5), w:b.readUInt16BE(i+7)};
      i+=2+b.readUInt16BE(i+2); }
    return null; };
  const odd=[];
  for(const f of have){
    const d=jpeg(path.join(CDIR,f+EXT));
    if(d && Math.abs(d.w-d.h)>1) odd.push(f+" "+d.w+"x"+d.h);
  }
  say("  every one of them square", odd.length===0 ? true : odd.slice(0,6).join(", "));
  const known=new Set();
  const notes=[];
  D.DATA.forEach(r=>{ (D.ART[r[0]]||[]).forEach(a=>known.add(a));
    (D.ROSTER[r[0]]||[]).forEach(a=>known.add(a));
    if(r[5]) notes.push(r[5]); });
  const blob=notes.join(" | ");
  const orphan=want.filter(([n])=>!known.has(n) && blob.indexOf(n)<0).map(([n])=>n);
  say("  and every cover belonging to an artist the map names"
    + (orphan.length?" ("+orphan.length+" do not: "+orphan.slice(0,4).join(", ")+")":""),
    orphan.length===0);
  if(dead.length||idle.length||both.length||odd.length||orphan.length) process.exitCode=1;
}

const fails=[dead.length,ghost.length,shared.length,other.length,odd.length,small.length]
  .reduce((a,b)=>a+b,0);
process.exitCode = fails ? 1 : 0;
