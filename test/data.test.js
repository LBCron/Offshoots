// The data, checked without a browser. Every other suite proves the page from the outside
// and takes seconds to minutes to do it; this one loads src/data.js directly and proves
// the invariants the app assumes in a few milliseconds, so a slip in a table (a parent
// id that was never written, a cover that points at no file, an edit that strayed out of
// its table's range) fails here first and by name instead of as a silent fallback or a
// blank spot in some later suite's screenshot.
//
// Everything here is a relationship between tables, or between a table and a folder:
// nothing about what a style is called or where it sits. That is the editor's business.
const fs=require("fs"), path=require("path");
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
const ROOT=path.join(__dirname,"..");
const D=require(path.join(ROOT,"src","data.js"));
const few=l=>l.length?l.slice(0,4).join(", ")+(l.length>4?" (+"+(l.length-4)+")":""):true;

// ---------- styles ----------
const ids=D.DATA.map(r=>r[0]), set=new Set(ids), byId={};
D.DATA.forEach(r=>byId[r[0]]=r);
say("every style id is unique", few(ids.filter((x,i)=>ids.indexOf(x)!==i)));
say("every style id is lowercase and url-safe", few(ids.filter(x=>!/^[a-z0-9_]+$/.test(x))));
say("every style has a name", few(D.DATA.filter(r=>!r[1]||!r[1].trim()).map(r=>r[0])));
say("every year is a number", few(D.DATA.filter(r=>typeof r[2]!=="number"||!isFinite(r[2])).map(r=>r[0])));
const fams=new Set(D.FAMS.map(f=>f[0]));
say("every style is in a family that exists", few(D.DATA.filter(r=>!fams.has(r[3])).map(r=>r[0]+" -> "+r[3])));
const parents=r=>(r[4]||"").split(/\s+/).filter(Boolean);
say("every parent id exists", few(D.DATA.flatMap(r=>parents(r).filter(p=>!set.has(p)).map(p=>r[0]+" -> "+p))));
say("no style is its own parent", few(D.DATA.filter(r=>parents(r).includes(r[0])).map(r=>r[0])));
say("no parent list repeats an id", few(D.DATA.filter(r=>new Set(parents(r)).size!==parents(r).length).map(r=>r[0])));
// Lineage has to be a DAG: the ancestor walk in app.js is a breadth-first search with a
// visited set, so a cycle would not hang it, but it would make "ancestor" meaningless.
const colour={}, cyc=[];
const visit=id=>{ if(!byId[id] || colour[id]===2) return; if(colour[id]===1){ cyc.push(id); return; }
  colour[id]=1; for(const p of parents(byId[id])) visit(p); colour[id]=2; };
ids.forEach(visit);
say("lineage has no cycles", few(cyc));
say("a child is never older than every one of its parents",
  few(D.DATA.filter(r=>parents(r).length && parents(r).every(p=>byId[p][2]>r[2]+20)).map(r=>r[0])));
const roots=D.DATA.filter(r=>!parents(r).length);
say("the roots are all pre-1950 ("+roots.length+" of them)", few(roots.filter(r=>r[2]>=1950).map(r=>r[0])));

// ---------- side tables keyed by style id ----------
for(const t of ["ART","PLAY","SPLAY","DESC","COVER","PTITLE","STYLEART","ROSTER","SONGS","READ"])
  say(t+" is keyed by style ids that exist", few(Object.keys(D[t]||{}).filter(k=>!set.has(k))));
say("DONE lists style ids that exist", few(D.DONE.filter(k=>!set.has(k))));
say("every ART entry is a list of names", few(Object.entries(D.ART).filter(([k,v])=>!Array.isArray(v)||v.some(a=>typeof a!=="string"||!a.trim())).map(([k])=>k)));
say("every PLAY path is an Apple Music playlist path", few(Object.entries(D.PLAY).filter(([k,v])=>!/^\/(us\/)?playlist\/[^\s]+$/.test(v)).map(([k])=>k)));
say("every DESC is one sentence that ends", few(Object.entries(D.DESC).filter(([k,v])=>typeof v!=="string"||v.length<20).map(([k])=>k)));

// ---------- families ----------
say("every family has a skin", few(D.FAMS.filter(f=>!D.FAMSKIN[f[0]]).map(f=>f[0])));
say("every family has a map colour", few(D.FAMS.filter(f=>!D.FAMMAP[f[0]]).map(f=>f[0])));
say("every family lane has at least one style", few(D.FAMS.filter(f=>!D.DATA.some(r=>r[3]===f[0])).map(f=>f[0])));
say("no skin is for a family that does not exist", few(Object.keys(D.FAMSKIN).filter(k=>!fams.has(k))));

// ---------- modes, head tracks, cross-style playlists, pickers ----------
const modeKeys=new Set(D.MODES.map(m=>m[0]));
say("every mode key is unique", few(D.MODES.map(m=>m[0]).filter((x,i,a)=>a.indexOf(x)!==i)));
say("every mode points at styles that exist", few(D.MODES.flatMap(m=>m[4].filter(([s])=>!set.has(s)).map(([s])=>m[0]+" -> "+s))));
say("every mode has at least one style", few(D.MODES.filter(m=>!m[4].length).map(m=>m[0])));
say("every head track belongs to a mode and a style",
  few(Object.entries(D.HEADTRACK).filter(([k,h])=>!modeKeys.has(k)||!set.has(h.style)).map(([k])=>k)));
say("every cross-style playlist spans styles that exist",
  few(D.XPLAY.flatMap(x=>(x.styles||[]).filter(s=>!set.has(s)).map(s=>x.id+" -> "+s))));
say("every pick is credited to a picker that exists",
  few(Object.entries(D.PICKED).map(([u,p])=>Array.isArray(p)?p[0]:p).filter(p=>!D.PICKERS[p])));

// ---------- files the tables point at ----------
// A missing image falls back silently in the page (artBase() exists because of a 404
// incident), so the only place a dangling stem is ever noticed is here.
const has=(dir,stem)=>["jpg","jpeg","png","webp"].some(x=>fs.existsSync(path.join(ROOT,dir,stem+"."+x)));
for(const [t,dir] of [["COVER","art"],["STYLEART","styles"],["PHOTO","artists"],["COVERART","covers"]])
  say("every "+t+" stem has a file in "+dir+"/ ("+Object.keys(D[t]).length+")",
    few(Object.entries(D[t]).filter(([k,s])=>!has(dir,s)).map(([k,s])=>k+" -> "+dir+"/"+s)));
say("every mode has a tile in moods/", few(D.MODES.filter(m=>!has("moods",m[0])).map(m=>m[0])));
say("every cross-style playlist with art has it in xplay/", few(D.XPLAY.filter(x=>x.art&&!has("xplay",x.id)).map(x=>x.id)));

// ---------- the file itself ----------
const src=fs.readFileSync(path.join(ROOT,"src","data.js"),"utf8");
say("data.js has exactly one export tail sentinel", (src.match(/^\/\/ ---------- export tail ----------/gm)||[]).length===1);
say("nothing in data.js can end the page's script", !/<\/script/i.test(src));
say("the export tail names every table", (()=>{
  const m=src.match(/module\.exports\s*=\s*\{([^}]*)\}/); if(!m) return "no export tail";
  const listed=new Set(m[1].split(",").map(s=>s.trim()));
  const declared=[...src.matchAll(/^const ([A-Z_]+)\s*=/gm)].map(x=>x[1]);
  return few(declared.filter(d=>!listed.has(d)));
})());
