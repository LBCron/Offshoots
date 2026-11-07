// Music Atlas is served as one self-contained page, but it is not written as one.
// This joins the three sources into that page:
//
//   head.html   CSS and markup
//   data.js     FAMS, DATA, ART, PLAY, SPLAY, DESC, COVER, PTITLE, FAMSKIN, FAMMAP, MODES
//   app.js      layout, rendering, interaction
//
//   node src/build.js      ->  writes index.html at the repo root
//
// data.js ends with a module.exports tail so it can be required by scripts and tests;
// that tail is stripped on the way in, since the page has no module system. The cut is
// at an explicit sentinel line, and the build refuses to run without exactly one: an
// earlier version cut at the first "if (typeof module", so any table that happened to
// contain that text would have silently truncated the page.
const fs=require("fs"), path=require("path");
const SRC=__dirname, ROOT=path.join(__dirname,"..");
const TAIL="// ---------- export tail ----------";
const head=fs.readFileSync(path.join(SRC,"head.html"),"utf8");
const raw=fs.readFileSync(path.join(SRC,"data.js"),"utf8");
const cut=raw.indexOf(TAIL);
if(cut<0 || raw.indexOf(TAIL,cut+1)>=0){
  console.error("build: data.js needs exactly one '"+TAIL+"' line before module.exports");
  process.exit(1);
}
const data=raw.slice(0,cut);
const app=fs.readFileSync(path.join(SRC,"app.js"),"utf8");
const out=head+"<script>\n"+data.trim()+"\n"+app+"\n</script>\n";
fs.writeFileSync(path.join(ROOT,"index.html"),out);
console.log("built index.html — "+out.length+" bytes");
// The same contents as one JSON file, for a reader that cannot look at a picture. Built
// here so it can never drift from the page: one command, both artefacts.
require("child_process").execFileSync(process.execPath,
  [path.join(SRC,"..","tools","catalog.js")],{stdio:"inherit"});
