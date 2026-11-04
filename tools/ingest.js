// Approved suggestions -> Go deeper rows.
//
//   node tools/ingest.js            dry run: what would be added, and what is not ready
//   node tools/ingest.js --write    add them to src/data.js and rebuild index.html
//   node tools/ingest.js --close    after committing and pushing, close what landed
//
// Placing them, which a session does by research before the dry run (CLAUDE.md has how):
//   node tools/ingest.js --brief          approved issues as JSON, with what each still lacks
//   node tools/ingest.js --styles         every style on the map, one line each, to choose from
//   node tools/ingest.js --apply plan.json   write the chosen styles and fields into each issue
//
// Suggestions arrive through /suggest as issues in bryanbell/Offshoots-submissions, each
// with a JSON block shaped like a READ row. Vetting is editing that block on GitHub until
// it is ready to publish, then swapping the pending label for approved. This script only
// ever reads approved, open issues, and only ever adds: it never edits or removes a row
// that is already in data.js.
//
// A row has to pass the same rules test/read.test.js holds every row to, so nothing this
// writes can turn the suite red: https, no encyclopedias or finding aids, a note that
// says why (over 20 characters, no em dash), a known access value and medium, a
// plausible year, and styles that are on the map.
//
// Needs a GitHub token that can read that repo: GH_TOKEN or GITHUB_TOKEN if set,
// otherwise whatever `gh auth token` prints.
const fs=require("fs"), path=require("path"), {execFileSync}=require("child_process");
const ROOT=path.join(__dirname,".."), DATA=path.join(ROOT,"src","data.js");
const REPO="bryanbell/Offshoots-submissions";
const MEDIA=["read","listen","watch","look","book"];
const ACCESS=["","paywall","partial","registration"];
const ENC=/wikipedia|britannica|fandom|discogs|allmusic|rateyourmusic/i;
const AIDS=/findingaids|archival_objects|\/repositories\/\d|archivesspace/i;
// parameters that only say how someone arrived, never what the page is
const TRACK=/^(utm_.*|fbclid|gclid|dclid|mc_cid|mc_eid|igshid|ref_src|_hsenc|_hsmi)$/;

// ---------- reading an issue ----------
function parseRecord(body){
  const m=/```json\s*\n([\s\S]*?)\n```/.exec(body||"");
  if(!m) throw new Error("no ```json block in the issue body");
  return JSON.parse(m[1]);
}
function normalizeUrl(u){
  const x=new URL(String(u).trim());
  if(x.hostname==="youtu.be"){
    const id=x.pathname.slice(1), t=x.searchParams.get("t");
    return "https://www.youtube.com/watch?v="+id+(t?"&t="+t:"");
  }
  if(x.hostname==="m.youtube.com") x.hostname="www.youtube.com";
  const yt=/(^|\.)youtube\.com$/.test(x.hostname), sp=x.hostname==="open.spotify.com";
  // a watch link picked up mid-playlist carries list, index and pp; the video is v
  if(yt && x.pathname==="/watch" && x.searchParams.get("v")){
    const t=x.searchParams.get("t");
    return "https://www.youtube.com/watch?v="+x.searchParams.get("v")+(t?"&t="+t:"");
  }
  for(const k of [...x.searchParams.keys()])
    if(TRACK.test(k) || ((yt||sp) && (k==="si"||k==="feature"))) x.searchParams.delete(k);
  return x.href;
}

// ---------- checking one ----------
// ctx: {ids:Set of style ids, read:READ, pickers:PICKERS, kinds:Set of kinds in use}
function check(rec, ctx){
  const errors=[], warnings=[];
  const need=(ok,msg)=>{ if(!ok) errors.push(msg); };
  let url="";
  try{ url=normalizeUrl(rec.url); }catch(e){ errors.push("url is not a link"); }
  if(url){
    need(url.indexOf("https://")===0, "url has to be https");
    need(!ENC.test(url), "encyclopedias and databases are out");
    need(!AIDS.test(url), "catalogue records and finding aids are out");
    if(url!==String(rec.url).trim()) warnings.push("url tidied to "+url);
  }
  const s=v=>typeof v==="string"?v.trim():"";
  const title=s(rec.title), publication=s(rec.publication), kind=s(rec.kind),
    access=s(rec.access), note=s(rec.note), medium=s(rec.medium), record=s(rec.record);
  need(title, "title is empty");
  need(publication, "publication is empty");
  need(kind, "kind is empty");
  if(kind && !ctx.kinds.has(kind)) warnings.push("kind \""+kind+"\" is new to the map");
  need(ACCESS.indexOf(access)>=0, "access has to be \"\", paywall, partial or registration");
  need(MEDIA.indexOf(medium)>=0, "medium has to be one of "+MEDIA.join(", "));
  const year=Number(rec.year)||0, now=new Date().getFullYear();
  need(Number.isInteger(year) && (year===0 || (year>=1900 && year<=now)), "year has to be 0 or 1900 to "+now);
  // a 33 1/3 can stand on the record it is about; everything else has to say why
  const series=kind==="33 1/3";
  need(series ? (note.length>20 || record.length>0) : note.length>20,
    series ? "a 33 1/3 needs a note or a record" : "note has to say why it's worth opening (over 20 characters)");
  need(!/—/.test(note), "note has an em dash");
  if(/—/.test(title)) warnings.push("title has an em dash");
  if(record && !series) warnings.push("record is only used on a 33 1/3, so it is dropped");
  const styles=Array.isArray(rec.styles)?rec.styles.map(String):[];
  need(styles.length>0, "styles is empty");
  const unknown=styles.filter(id=>!ctx.ids.has(id));
  need(!unknown.length, "not styles on the map: "+unknown.join(", "));
  const by=s(rec.by);
  if(by && !(ctx.pickers && Object.prototype.hasOwnProperty.call(ctx.pickers,by)))
    warnings.push("by \""+by+"\" is not in PICKERS, so it goes on without a credit");

  const row=[url,title,publication,year,kind,access,note,medium];
  if(series && record) row.push(record);
  // one piece can sit on several styles, but only once on each
  const fresh=styles.filter(id=>!((ctx.read[id]||[]).some(r=>r[0]===url)));
  const already=styles.filter(id=>fresh.indexOf(id)<0);
  if(already.length) warnings.push("already on "+already.join(", "));
  const pick = by && ctx.pickers && Object.prototype.hasOwnProperty.call(ctx.pickers,by) ? by : "";
  return {errors, warnings, url, row, styles:fresh, all:styles, by:pick};
}

// ---------- writing data.js ----------
// Text in, text out, so everything around the two tables (comments, spacing, the order
// of the other rows) is left exactly as it was. Every READ row sits on one line; a style
// is `"id": [`, its rows, then `],` (or `]` on the last one before `};`).
// < is escaped because data.js is inlined into a <script>, and a note that said
// </script> would end the page there.
const ser=v=>JSON.stringify(v).replace(/</g,"\\u003c");
function block(lines,start){
  const s=lines.indexOf(start); if(s<0) throw new Error("no "+start+" in data.js");
  let e=s+1; while(e<lines.length && lines[e]!=="};") e++;
  if(e>=lines.length) throw new Error("no end to "+start);
  return [s,e];
}
function insert(text, adds, picks){
  let lines=text.split("\n");
  // each insertion can add several lines as one element, so split again before the next
  // one looks for its place
  const resplit=()=>{ lines=lines.join("\n").split("\n"); };
  const byStyle=new Map();
  for(const [id,row] of adds){ if(!byStyle.has(id)) byStyle.set(id,[]); byStyle.get(id).push(row); }
  for(const [id,rows] of byStyle){
    resplit();
    const [s,e]=block(lines,"const READ = {");
    const open=lines.indexOf(JSON.stringify(id)+": [", s);
    const add=rows.map(r=>"  "+ser(r));
    if(open>s && open<e){
      let c=open+1; while(c<e && !/^\],?$/.test(lines[c])) c++;
      if(c>=e) throw new Error("no end to "+id+" in READ");
      if(!/,\s*$/.test(lines[c-1])) lines[c-1]+=",";
      lines.splice(c,0,add.join(",\n"));
    }else{
      if(/^\]$/.test(lines[e-1])) lines[e-1]="],";
      lines.splice(e,0,JSON.stringify(id)+": [\n"+add.join(",\n")+"\n]");
    }
  }
  for(const [url,by] of picks){
    resplit();
    const [s,e]=block(lines,"const PICKED = {");
    if(lines.slice(s,e).some(l=>l.indexOf(ser(url))>=0)) continue;
    let last=e-1; while(last>s && !lines[last].trim()) last--;
    if(last>s && !/,\s*$/.test(lines[last])) lines[last]+=",";
    lines.splice(e,0,"  "+ser(url)+":"+ser(by));
  }
  resplit();
  return lines.join("\n");
}
function load(){ delete require.cache[require.resolve(DATA)]; return require(DATA); }
function context(d){
  const kinds=new Set(); for(const k in d.READ) for(const r of d.READ[k]) kinds.add(r[4]);
  return {ids:new Set(d.DATA.map(r=>r[0])), read:d.READ, pickers:d.PICKERS||{}, kinds};
}

// ---------- placing ----------
// Placement is researched, not guessed from the form: whoever sent a link knows what it is,
// not where it sits on the map. A plan is {"<issue number>": {styles, ...fields, why}}, and
// applying one rewrites that issue's JSON block, so the issue stays the record of what was
// decided and ingest reads it back the same way as an edit made by hand. url, medium, by
// and at are what was sent, and a plan cannot change them.
const PLACE=["styles","title","publication","year","kind","access","note","record"];
function applyPlan(body, entry, ids){
  if(!entry || typeof entry!=="object") throw new Error("a plan entry has to be an object");
  for(const k of Object.keys(entry))
    if(k!=="why" && PLACE.indexOf(k)<0) throw new Error("a plan cannot set "+k);
  if("styles" in entry){
    if(!Array.isArray(entry.styles) || !entry.styles.length) throw new Error("styles has to list at least one");
    const bad=entry.styles.filter(id=>!ids.has(id));
    if(bad.length) throw new Error("not styles on the map: "+bad.join(", "));
  }
  const rec=parseRecord(body);
  for(const k of PLACE) if(Object.prototype.hasOwnProperty.call(entry,k)) rec[k]=entry[k];
  const block=JSON.stringify(rec,null,2).replace(/`/g,"\\u0060");
  // a function, so a note with $& or $1 in it is written as it is
  return body.replace(/```json\s*\n[\s\S]*?\n```/, ()=>"```json\n"+block+"\n```");
}
function printStyles(){
  const j=JSON.parse(fs.readFileSync(path.join(ROOT,"musicatlas.json"),"utf8"));
  for(const s of j.styles)
    console.log([s.id, s.name, s.yearLabel||s.year, s.family, s.description||""].join(" | "));
}

// ---------- GitHub ----------
function token(){
  if(process.env.GH_TOKEN||process.env.GITHUB_TOKEN) return process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
  try{ return execFileSync("gh",["auth","token"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim(); }
  catch(e){ return ""; }
}
async function gh(T, method, url, body){
  const r=await fetch("https://api.github.com"+url,{method, headers:{
    authorization:"Bearer "+T, accept:"application/vnd.github+json",
    "x-github-api-version":"2022-11-28", "user-agent":"musicatlas-ingest",
    ...(body?{"content-type":"application/json"}:{})}, body:body?JSON.stringify(body):undefined});
  if(!r.ok) throw new Error(method+" "+url+" -> "+r.status+" "+(await r.text()).slice(0,300));
  return r.status===204 ? null : r.json();
}
async function approved(T){
  const out=[];
  for(let page=1;;page++){
    const a=await gh(T,"GET","/repos/"+REPO+"/issues?state=open&labels=approved&per_page=100&page="+page);
    out.push(...a.filter(i=>!i.pull_request));
    if(a.length<100) return out;
  }
}
const git=(...a)=>execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim();

async function main(){
  const args=process.argv.slice(2), write=args.includes("--write"), close=args.includes("--close");
  if(args.includes("--styles")){ printStyles(); return; }
  const T=token();
  if(!T){ console.error("No GitHub token. Run `gh auth login`, or set GH_TOKEN."); process.exit(2); }
  const d=load(), ctx=context(d);
  const NAME=new Map(d.DATA.map(r=>[r[0],r[1]]));
  const names=ids=>ids.map(id=>NAME.get(id)||id).join(", ");

  const ap=args.indexOf("--apply");
  if(ap>=0){
    const file=args[ap+1];
    if(!file){ console.error("--apply needs the plan file after it."); process.exit(2); }
    const plan=JSON.parse(fs.readFileSync(file,"utf8"));
    const open=new Map((await approved(T)).map(i=>[String(i.number),i]));
    // every entry is checked before any issue is touched, so a bad plan changes nothing
    const todo=Object.entries(plan).map(([n,entry])=>{
      const i=open.get(String(n).replace(/^#/,""));
      if(!i) throw new Error("#"+n+" is not an open, approved issue");
      return [i,entry,applyPlan(i.body,entry,ctx.ids)];
    });
    for(const [i,entry,body] of todo){
      await gh(T,"PATCH","/repos/"+REPO+"/issues/"+i.number,{body});
      const where=entry.styles ? "Placed on "+names(entry.styles)+"." : "Filled in.";
      await gh(T,"POST","/repos/"+REPO+"/issues/"+i.number+"/comments",
        {body:where+(entry.why?"\n\n"+String(entry.why):"")});
      console.log("  #"+i.number+" "+where);
    }
    console.log("Applied "+todo.length+" placement(s). The dry run follows.\n");
  }

  const issues=await approved(T);
  if(!issues.length){ console.log("Nothing approved and open in "+REPO+"."); return; }

  if(args.includes("--brief")){
    const out=issues.map(i=>{
      let rec=null, missing=[];
      try{ rec=parseRecord(i.body); missing=check(rec,ctx).errors; }catch(e){ missing=[e.message]; }
      return {number:i.number, title:i.title, record:rec, missing};
    });
    console.log(JSON.stringify(out,null,2));
    return;
  }

  const ready=[], held=[];
  for(const i of issues){
    let c;
    try{ c=check(parseRecord(i.body), ctx); }catch(e){ c={errors:[e.message], warnings:[]}; }
    (c.errors.length?held:ready).push([i,c]);
  }

  if(close){
    if(git("status","--porcelain","--","src/data.js")){ console.error("src/data.js has uncommitted changes. Commit and push first."); process.exit(1); }
    let ahead="";
    try{ ahead=git("rev-list","--count","@{u}..HEAD"); }catch(e){ console.error("This branch has no upstream. Push first."); process.exit(1); }
    if(ahead!=="0"){ console.error("Push first: HEAD is "+ahead+" commit(s) ahead of the remote."); process.exit(1); }
    const sha=git("rev-parse","--short","HEAD");
    let n=0;
    for(const [i,c] of ready){
      // landed means on every style it names, which is also true of one that was already there
      if(!c.all.every(id=>(ctx.read[id]||[]).some(r=>r[0]===c.url))){ console.log("  #"+i.number+" not in data.js yet, left open"); continue; }
      await gh(T,"POST","/repos/"+REPO+"/issues/"+i.number+"/comments",{body:"Added to Music Atlas in "+sha+", on "+names(c.all)+"."});
      await gh(T,"PATCH","/repos/"+REPO+"/issues/"+i.number,{state:"closed",state_reason:"completed"});
      console.log("  #"+i.number+" closed"); n++;
    }
    console.log("Closed "+n+" of "+issues.length+" approved.");
    return;
  }

  const adds=[], picks=[];
  for(const [i,c] of ready){
    console.log("READY  #"+i.number+"  "+c.row[1]+"  ->  "+(c.styles.join(", ")||"(already on every style)"));
    for(const w of c.warnings) console.log("         note: "+w);
    for(const id of c.styles) adds.push([id,c.row]);
    if(c.by && !(d.PICKED||{})[c.url]) picks.push([c.url,c.by]);
  }
  for(const [i,c] of held){
    console.log("HELD   #"+i.number+"  "+i.title);
    for(const e of c.errors) console.log("         fix: "+e);
    for(const w of c.warnings) console.log("         note: "+w);
  }
  console.log("\n"+adds.length+" row(s) on "+new Set(adds.map(a=>a[0])).size+" style(s), "
    +picks.length+" credited pick(s); "+held.length+" issue(s) need edits first.");
  if(!write){ if(adds.length) console.log("Run with --write to add them."); return; }
  if(!adds.length && !picks.length) return;

  fs.writeFileSync(DATA, insert(fs.readFileSync(DATA,"utf8"), adds, picks));
  // read it back the way the tests will, so a bad write fails here and not in the browser
  const after=load();
  for(const [id,row] of adds)
    if(!(after.READ[id]||[]).some(r=>r[0]===row[0])) throw new Error("wrote "+row[0]+" but it is not on "+id);
  execFileSync(process.execPath,[path.join(ROOT,"src","build.js")],{stdio:"inherit"});
  console.log("\nNext: git diff src/data.js, npm test, commit and push, then node tools/ingest.js --close");
}

module.exports={parseRecord, normalizeUrl, check, insert, context, applyPlan};
if(require.main===module) main().catch(e=>{ console.error(e.message); process.exit(1); });
