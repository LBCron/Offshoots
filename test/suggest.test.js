// Suggestions: the function that files them and the script that brings approved ones in.
//
// No browser in this one. The function is checked by calling it with real Request objects
// and a fetch that records what would have gone to GitHub instead of sending it; ingest is
// checked by writing into a copy of data.js and requiring the copy, so the real file is
// never touched. What matters most is on the edges: a stranger's text cannot ping anyone,
// break out of the JSON block or end the page's <script>, and an approved row passes the
// same rules read.test.js holds every row to.
const path=require("path"), fs=require("fs"), os=require("os");
const {pathToFileURL}=require("url");
const say=(k,v)=>console.log((v===true?"PASS ":"FAIL ")+k+(typeof v!=="boolean"?": "+v:""));

(async()=>{
  const fn=await import(pathToFileURL(path.join(__dirname,"..","netlify","functions","suggest.mjs")).href);
  const ing=require("../tools/ingest.js");
  const {shape}=fn, handler=fn.default;
  const KEY="0123456789abcdef0123456789abcdef";
  const base={url:"https://www.npr.org/2019/01/01/x/the-piece", title:"The piece", medium:"listen",
    styles:["nola_rnb"], note:"Worth it for the tape of the band rehearsing."};

  // ---------- shaping an issue ----------
  let o=shape(base,{contributors:{}});
  say("a plain suggestion is filed as pending", !o.error && o.issue.labels.join()==="pending");
  say("and as nobody's", o.by==="" && /\| From \| anonymous \|/.test(o.issue.body));
  const rec=ing.parseRecord(o.issue.body);
  say("its JSON block reads back with READ's fields in READ's order",
    Object.keys(rec).join()==="url,title,publication,year,kind,access,note,medium,styles,record,by,at");
  say("kind and access are left for review", rec.kind==="" && rec.access==="");
  o=shape({...base,styles:[]},{});
  say("styles are a suggestion: a stranger can send none", !o.error && /\| Suggested styles \| none \|/.test(o.issue.body));
  o=shape({...base,styles:[],k:KEY},{contributors:{[KEY]:"pete"}});
  say("and so can a guest", !o.error && o.by==="pete");
  say("and is labelled as theirs", o.issue.labels.join()==="pending,petes-picks");
  say("a wrong key is simply anonymous", shape({...base,k:"nope"},{contributors:{[KEY]:"pete"}}).by==="");
  say("javascript: links are refused", !!shape({...base,url:"javascript:alert(1)"},{}).error);
  say("so is an unknown medium", !!shape({...base,medium:"tweet"},{}).error);
  o=shape({...base,medium:"site"},{});
  say("a website is a medium of its own", !o.error && /^Website: /.test(o.issue.title));
  o=shape({...base,styles:["nola_rnb","<script>","../x","nola_rnb"]},{});
  say("five at most are kept as suggestions",
    ing.parseRecord(shape({...base,styles:["a","b","c","d","e","f","g"]},{}).issue.body).styles.length===5);
  say("anything that is not a style id is dropped, and duplicates with it",
    JSON.stringify(ing.parseRecord(o.issue.body).styles)==='["nola_rnb"]');
  o=shape({...base,title:"Hi @octocat"},{});
  say("an @mention in a title cannot notify anyone", !/@octocat/.test(o.issue.title));
  o=shape({...base,note:"```\n@octocat <script>x</script>"},{});
  say("backticks cannot close the JSON fence early", o.issue.body.split("```").length===3);
  say("and the note still reads back exactly", ing.parseRecord(o.issue.body).note==="``` @octocat <script>x</script>");
  say("the human part of the issue carries none of the stranger's text",
    !/octocat/.test(o.issue.body.split("```json")[0]));
  say("a year comes from a date", shape({...base,year:"1957-03-02T00:00:00Z"},{}).issue.body.indexOf('"year": 1957')>0);
  say("and a nonsense one is 0", shape({...base,year:"3021"},{}).issue.body.indexOf('"year": 0')>0);

  // ---------- the handler ----------
  const sent=[]; const realFetch=global.fetch;
  let reply=()=>new Response("{}",{status:201});
  global.fetch=async(u,init)=>{ sent.push([String(u),init]); return reply(); };
  process.env.GITHUB_TOKEN="tok"; process.env.CONTRIBUTORS=JSON.stringify({[KEY]:"pete"});
  const call=(body,{origin="https://offshoots.netlify.app",method="POST"}={})=>handler(new Request(
    "https://offshoots.netlify.app/api/suggest",
    {method, headers:{"content-type":"application/json",...(origin?{origin}:{})},
     body:method==="POST"?(typeof body==="string"?body:JSON.stringify(body)):undefined}));

  let r=await call(base);
  say("a good suggestion comes back 201", r.status===201 && (await r.json()).ok===true);
  say("after one call to GitHub, to the submissions repo",
    sent.length===1 && sent[0][0]==="https://api.github.com/repos/bryanbell/Offshoots-submissions/issues");
  say("with the token from the environment", sent[0][1].headers.authorization==="Bearer tok");
  r=await call({...base,styles:[],k:KEY});
  say("a guest's key is honoured from CONTRIBUTORS", r.status===201 && (await r.json()).by==="pete");
  say("a deploy preview may send", (await call(base,{origin:"https://deploy-preview-7--offshoots.netlify.app"})).status===201);
  // The custom domain has to be allowed in its own right. The form posts from whatever
  // host served the page, so on musicatlas.us every suggestion would have come back 403
  // from an allowlist that only knew the netlify.app name, and nothing would have said so
  // except the form failing for everyone.
  say("the custom domain may send", (await call(base,{origin:"https://musicatlas.us"})).status===201);
  say("  and its www", (await call(base,{origin:"https://www.musicatlas.us"})).status===201);
  sent.length=0;
  say("another site may not", (await call(base,{origin:"https://evil.example"})).status===403 && sent.length===0);
  say("only POST", (await call(null,{method:"GET"})).status===405);
  say("the honeypot files nothing", (await call({...base,website:"x"})).status===200 && sent.length===0);
  say("a huge body is refused", (await call({...base,note:"x".repeat(9000)})).status===413 && sent.length===0);
  say("so is a body that is not JSON", (await call("{nope")).status===400);
  reply=()=>new Response("rate limited",{status:403});
  const quietErr=console.error; console.error=()=>{};
  say("when GitHub says no, the page hears 502", (await call(base)).status===502);
  delete process.env.GITHUB_TOKEN;
  say("with no token, 500 and nothing sent", (await call(base)).status===500);
  console.error=quietErr; global.fetch=realFetch;

  // ---------- ingest: checking ----------
  const d=require("../src/data.js"), ctx=ing.context(d);
  const good={url:"https://www.npr.org/2019/01/01/x/the-piece?utm_source=tw", title:"The piece",
    publication:"NPR", year:2019, kind:"audio", access:"", note:"Worth it for the tape of the band rehearsing.",
    medium:"listen", styles:["nola_rnb"], record:"", by:""};
  let c=ing.check(good,ctx);
  say("a finished record passes", c.errors.length===0 || c.errors.join("; "));
  say("with its tracking stripped", c.url==="https://www.npr.org/2019/01/01/x/the-piece");
  say("a watch link picked up mid-playlist keeps only the video",
    ing.normalizeUrl("https://www.youtube.com/watch?v=Ht62CQnT1PQ&list=RD1&index=2&pp=x")==="https://www.youtube.com/watch?v=Ht62CQnT1PQ");
  say("youtu.be becomes the watch page", ing.normalizeUrl("https://youtu.be/abc123?si=zzz")==="https://www.youtube.com/watch?v=abc123");
  const bad=(k,v)=>ing.check({...good,[k]:v},ctx).errors.length>0;
  say("http is held", bad("url","http://www.npr.org/x"));
  say("an encyclopedia is held", bad("url","https://en.wikipedia.org/wiki/Shoegaze"));
  say("a short note is held", bad("note","Good."));
  say("an em dash is held", bad("note","A long enough note — with a dash in it"));
  say("an unknown style is held", bad("styles",["nola_rnb","not_a_style"]));
  say("an unknown access is held", bad("access","free"));
  say("a missing publication is held", bad("publication",""));
  say("an impossible year is held", bad("year",1850));
  say("a website passes ingest as a website", ing.check({...good,medium:"site",kind:"archive"},ctx).errors.length===0);
  say("a 33 1/3 can stand on its record", ing.check({...good,kind:"33 1/3",medium:"book",note:"",record:"Fats Domino"},ctx).errors.length===0);

  // ---------- ingest: placing ----------
  { const body=shape({...base,styles:["nola_rnb"],note:""},{}).issue.body;
    const placed=ing.applyPlan(body,{styles:["shoegaze","nola_rnb"],kind:"documentary",publication:"NPR",
      note:"Costs $& nothing and repays $1 hour of it.",why:"Covers both scenes"},ctx.ids);
    const r=ing.parseRecord(placed);
    say("a plan sets where it goes", JSON.stringify(r.styles)==='["shoegaze","nola_rnb"]');
    say("and fills what was missing", r.kind==="documentary" && r.publication==="NPR");
    say("a note with $ in it is written as it is", r.note==="Costs $& nothing and repays $1 hour of it.");
    say("what was sent stays", r.url===base.url && r.medium==="listen" && r.by==="" && !!r.at);
    say("the reasoning stays out of the row", !("why" in r));
    say("the rest of the issue is untouched", placed.split("```json")[0]===body.split("```json")[0]);
    const no=e=>{ try{ ing.applyPlan(body,e,ctx.ids); return false; }catch(x){ return true; } };
    say("a style not on the map is refused", no({styles:["nola_rnb","not_a_style"]}));
    say("so is an empty list of styles", no({styles:[]}));
    say("and a plan cannot change what was sent", no({url:"https://elsewhere.example"}) && no({by:"pete"}));
    say("a placed suggestion passes ingest", ing.check({...r,year:2019,note:"A long enough note to pass the rule."},ctx).errors.length===0);
  }

  // ---------- ingest: writing ----------
  const src=fs.readFileSync(path.join(__dirname,"..","src","data.js"),"utf8");
  const bare=d.DATA.map(r=>r[0]).filter(id=>!d.READ[id]).slice(0,2);
  const has=Object.keys(d.READ)[0];
  const row=(u,note)=>[u,"T","P",2020,"longform","",note,"read"];
  const adds=[[has,row("https://a.example/1","A note long enough to pass.")],
    [has,row("https://a.example/2","Another note long enough to pass.")],
    [bare[0],row("https://a.example/3","A note that ends a script </script> on purpose.")],
    [bare[1],row("https://a.example/4","A note long enough to pass, again.")]];
  const out=ing.insert(src,adds,[["https://a.example/3","pete"]]);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ingest-")), f=path.join(dir,"data.js");
  fs.writeFileSync(f,out);
  let d2; try{ d2=require(f); }catch(e){ d2=null; say("the written file still loads", e.message); }
  if(d2){
    say("the written file still loads", true);
    say("rows land on a style that already had some",
      d2.READ[has].length===d.READ[has].length+2 && d2.READ[has].slice(-2).map(r=>r[0]).join()==="https://a.example/1,https://a.example/2");
    say("and on styles that had none", d2.READ[bare[0]].length===1 && d2.READ[bare[1]].length===1);
    say("nothing else moves", Object.keys(d.READ).every(k=>JSON.stringify(d2.READ[k].slice(0,d.READ[k].length))===JSON.stringify(d.READ[k])));
    say("the pick is credited", d2.PICKED["https://a.example/3"]==="pete" && Object.keys(d2.PICKED).length===Object.keys(d.PICKED).length+1);
    say("and nothing written can end the page's script", !/<\/script>/i.test(out.slice(src.length-200)) && out.split("</script>").length===src.split("</script>").length);
    say("the page build still compiles it", (()=>{ try{ new Function(out.replace(/if \(typeof module[\s\S]*$/,"")); return true; }catch(e){ return e.message; } })());
    say("and a second pass with the same pick adds nothing", ing.insert(out,[],[["https://a.example/3","pete"]])===out);
  }
  fs.rmSync(dir,{recursive:true,force:true});
})().catch(e=>{ say("suite ran", e.stack||String(e)); });
