// A stylesheet with an unbalanced comment does not fail loudly: the browser swallows
// everything up to the next */ and the rules in between simply never apply. I shipped
// exactly that twice in one session, by writing a new sentence after an existing */ and
// leaving the old closer in the middle of the prose. Both times the symptom was a rule
// that was plainly there in the file and plainly absent in the page.
//
// So the comments are counted rather than trusted: every /* needs a */, nothing may open
// inside a comment, and no declaration may sit between a closer and the next opener.
const fs=require("fs"), path=require("path");
// Anything that is not true is a failure. A check that answered with its detail instead
// of false used to print with no prefix at all, so the runner counted it as no check and
// the run came back clean: a failing assertion that reported what went wrong was the one
// kind that could not fail. Caught by a deliberately broken build printing a blank line.
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));
// A line that only records what happened, with no verdict in it. Keeping these out of
// say() is what lets say() treat anything that is not true as a failure.
const note=(k,v)=>console.log("     "+k+(v===undefined?"":": "+v));
const src=fs.readFileSync(path.join(__dirname,"..","src","head.html"),"utf8");
const css=(src.match(/<style[^>]*>([\s\S]*?)<\/style>/i)||[,src])[1];
const lineAt=i=>css.slice(0,i).split("\n").length;

let i=0, depth=0, opened=0, closed=0, bad=[];
while(i<css.length){
  const o=css.indexOf("/*",i), c=css.indexOf("*/",i);
  if(o<0 && c<0) break;
  if(o>=0 && (c<0 || o<c)){
    if(depth>0) bad.push("/* inside a comment at line "+lineAt(o));
    depth++; opened++; i=o+2;
  } else {
    if(depth===0) bad.push("stray */ at line "+lineAt(c));
    else depth--;
    closed++; i=c+2;
  }
}
say("every comment in head.html is closed ("+opened+" opened, "+closed+" closed)",
  depth===0 && bad.length===0 ? true : (bad[0]||("depth "+depth+" at end")));

// The failure that actually bites: prose left outside a comment reads as a selector and
// eats the block after it. A line of English between a */ and the next rule is the tell.
const orphans=[];
let after=null;
css.split("\n").forEach((ln,n)=>{
  const t=ln.trim();
  if(!t) return;
  if(/\*\/\s*$/.test(t) && !/^\/\*/.test(t) || t==="*/"){ after=n+1; return; }
  if(after===null) return;
  if(/^\/\*/.test(t) || /[{}@]/.test(t) || /^[.#:\[a-zA-Z*>]/.test(t) && /[,{]/.test(t)){ after=null; return; }
  // a bare sentence: words and punctuation, no CSS syntax at all
  if(/^[A-Za-z][A-Za-z0-9 ,'’"()\-.:;]*$/.test(t) && / /.test(t) && !t.endsWith(";")){
    orphans.push("line "+(n+1)+": "+t.slice(0,60));
  }
  after=null;
});
say("  and no prose left stranded outside one",
  orphans.length===0 ? true : orphans.slice(0,4).join(" | "));

process.exitCode = (depth!==0 || bad.length || orphans.length) ? 1 : 0;
