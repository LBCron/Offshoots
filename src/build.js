// Music Atlas is served as one self-contained page, but it is not written as one.
// This joins the three sources into that page:
//
//   head.html   CSS and markup
//   data.js     FAMS, DATA, ART, PLAY, SPLAY, DESC, COVER, PTITLE, FAMSKIN, FAMMAP, MODES, ...
//   app.js      layout, rendering, interaction
//
//   node src/build.js      ->  writes index.html at the repo root
//
// data.js ends with a module.exports tail so it can be required by scripts and tests;
// that tail is stripped on the way in, since the page has no module system. The cut is
// at an explicit sentinel line, and the build refuses to run without exactly one: an
// earlier version cut at the first "if (typeof module", so any table that happened to
// contain that text would have silently truncated the page.
//
// The six artist-keyed tables (ROSTER, SONGS, ACTIVE, ROLE, COVERART, PHOTO) are most of
// data.js by bytes and nothing reads them until a search or a panel opens. They go into
// the page as inert <script type="application/json"> blocks, which the HTML parser skips
// over, and a getter on globalThis parses each one the first time its name is read. The
// page is still one file; the engine just stops paying to compile 470 KB of names
// before it can draw the map. They are still ordinary consts in data.js.
const fs=require("fs"), path=require("path");
const SRC=__dirname, ROOT=path.join(__dirname,"..");
const TAIL="// ---------- export tail ----------";
const LAZY=["ROSTER","SONGS","ACTIVE","ROLE","COVERART","PHOTO"];

const head=fs.readFileSync(path.join(SRC,"head.html"),"utf8");
const raw=fs.readFileSync(path.join(SRC,"data.js"),"utf8");
const cut=raw.indexOf(TAIL);
if(cut<0 || raw.indexOf(TAIL,cut+1)>=0){
  console.error("build: data.js needs exactly one '"+TAIL+"' line before module.exports");
  process.exit(1);
}
let data=raw.slice(0,cut);

// lift the lazy tables out of the script and into JSON blocks
const D=require(path.join(SRC,"data.js"));
let json="";
for(const t of LAZY){
  const re=new RegExp("^const "+t+" = \\{\\n[\\s\\S]*?^\\};\\n","m");
  if(!re.test(data)){ console.error("build: could not find table "+t+" in data.js (one entry per line, const "+t+" = { ... };)"); process.exit(1); }
  data=data.replace(re,"");
  // "<" as \u003c so no value can close the block early; JSON reads it back as "<"
  json+='<script type="application/json" id="t-'+t+'">'+JSON.stringify(D[t]).replace(/</g,"\\u003c")+"</script>\n";
}
const getters='for(const k of '+JSON.stringify(LAZY)+'){ let v; Object.defineProperty(globalThis,k,{configurable:true,'
  +'get(){ return v || (v=JSON.parse(document.getElementById("t-"+k).textContent)); }}); }\n';

const app=fs.readFileSync(path.join(SRC,"app.js"),"utf8");
const out=head+json+"<script>\n"+data.trim()+"\n"+getters+app+"\n</script>\n";
fs.writeFileSync(path.join(ROOT,"index.html"),out);
console.log("built index.html — "+out.length+" bytes");
// The same contents as one JSON file, for a reader that cannot look at a picture. Built
// here so it can never drift from the page: one command, both artefacts.
require("child_process").execFileSync(process.execPath,
  [path.join(SRC,"..","tools","catalog.js")],{stdio:"inherit"});
