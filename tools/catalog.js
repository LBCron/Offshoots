#!/usr/bin/env node
// Offshoots as data, for a reader that is not a person.
//
// The map is a picture, and a picture is the one thing a language model cannot read. This
// writes the same contents as one JSON file someone can point a model at and ask for
// somewhere to go next: every style with its year, family, lineage, description, artists,
// songs and playlists, plus the playlists that cross between styles.
//
// It is generated from src/data.js, so it cannot drift from what the app shows, and it is
// written at build time rather than fetched at runtime: the page stays one file that
// works with no connection, and this sits beside it like the art folders do.
//
//   node tools/catalog.js      ->  writes offshoots.json at the repo root
const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const D=require(path.join(ROOT,"src","data.js"));

const FAM={}; D.FAMS.forEach(f=>FAM[f[0]]=f[1]);
const byId={}; D.DATA.forEach(r=>byId[r[0]]=r);
const name=id=>byId[id]?byId[id][1]:id;

// the same reading the panel does: a note that is a list of names is the artist list,
// and anything else is prose about the style
const JOIN=new Set(["in","the","of","and","a","an","on","at","for","to","de","la","le","du","des","el","y"]);
const titleish=s=>{const w=s.split(/\s+/);
  return w.length<=6 && w.every(x=>x==="&"||x==="+"||/^[("‘“]*[A-Z0-9]/.test(x)
    || JOIN.has(x.toLowerCase().replace(/[^a-z]/g,"")));};
const PLACE=/^(UK|US|USA|US\/UK|Japan|Ghana|Trinidad|Jamaica|Dominican|Rotterdam|Durban|Johannesburg|Lagos|Medellín|Berlin\/Milan|Goa|India|South Africa|1080p)$|-led$/i;
function noteNames(note){
  const head=note.replace(/^[^:]{0,40}:\s*/,"").split(/;|\s·\s/)[0]
    .replace(/\s*\([^)]*\)/g,"").replace(/'[^']*'/g,"").replace(/\s+,/g,",")
    .replace(/,\s*,/g,",").replace(/\s{2,}/g," ").trim().replace(/^,|,$/g,"");
  const items=head?head.split(",").map(s=>s.trim()).filter(Boolean):[];
  const prose=/(?:^|\s)[a-z]+ed\b.*\bin\b/.test(head)
    || /\bvia\b|\bfrom\b|\bscene\b|\bera\b|\bstyle\b|\bmusic\b/i.test(head);
  return (items.length>=1 && !prose && items.every(titleish))
    ? items.filter(x=>!PLACE.test(x)) : [];
}

const apple=p=>p?"https://music.apple.com"+p:undefined;
const spotify=i=>i?"https://open.spotify.com/playlist/"+i:undefined;
const wiki=r=>(r[7]||[]).find(s=>/wikipedia\.org\/wiki\//.test(s));

const styles=D.DATA.map(r=>{
  const id=r[0], note=r[5]||"";
  const key=[...new Set([...noteNames(note), ...((D.ART||{})[id]||[])])];
  const roster=((D.ROSTER||{})[id]||[]).filter(a=>key.indexOf(a)<0);
  const o={
    id, name:r[1],
    year:r[2], yearLabel:r[6]||String(r[2]),
    family:FAM[r[3]]||r[3],
    description:(D.DESC||{})[id] || (noteNames(note).length?undefined:note) || undefined,
    grewOutOf:(r[4]?r[4].split(" "):[]).map(p=>({id:p,name:name(p)})),
    ledTo:(byId[id]&&D.DATA.filter(x=>(x[4]||"").split(" ").indexOf(id)>=0)
      .map(x=>({id:x[0],name:x[1]})))||[],
    keyArtists:key.length?key:undefined,
    otherArtists:roster.length?roster:undefined,
    songs:((D.SONGS||{})[id]||[]).length?D.SONGS[id]:undefined,
    playlist:(D.PLAY&&D.PLAY[id])||(D.SPLAY&&D.SPLAY[id])
      ? {appleMusic:apple((D.PLAY||{})[id]), spotify:spotify((D.SPLAY||{})[id])} : undefined,
    wikipedia:wiki(r)
  };
  for(const k of Object.keys(o)) if(o[k]===undefined) delete o[k];
  return o;
});

const crossings=(D.XPLAY||[]).map(x=>({
  id:x.id, title:x.title, about:x.note,
  spansStyles:x.styles.map(s=>({id:s,name:name(s)})),
  playlist:{appleMusic:apple(x.ap), spotify:spotify(x.sp)},
  tracks:(x.tracks||[]).map(([artist,title])=>({artist,title}))
}));

const out={
  name:"Offshoots",
  description:"A hand-compiled map of popular music styles, each placed at the year it "
    + "cohered into a named, recorded scene and joined to the styles it grew out of.",
  url:"https://offshoots.netlify.app",
  generated:new Date().toISOString().slice(0,10),
  // what someone pointing a model at this file is actually trying to do
  readMe:{
    purpose:"Written for language models. Ask it for somewhere to go next from a style, "
      + "an artist or a song you already like, and use grewOutOf and ledTo to explain why "
      + "two things are related rather than only that they are.",
    lineage:"grewOutOf and ledTo are direct stylistic parentage, not every influence. "
      + "A year marks when a scene cohered, not its earliest precursor. Both are a "
      + "reading of the record rather than a fact, and are contested.",
    artists:"keyArtists are the few a style is usually explained through. otherArtists "
      + "and songs come from that style's own playlist, so they are a sample of what it "
      + "sounds like rather than a complete discography.",
    crossings:"crossStylePlaylists are runs that deliberately cross the map. Each one "
      + "belongs to every style it names and to none of them alone.",
    caution:"Coverage is uneven by design: " + styles.filter(s=>s.playlist).length
      + " of " + styles.length + " styles have a playlist, and the rest have fewer "
      + "artists and no songs. Absence here is not evidence that something does not exist."
  },
  counts:{
    styles:styles.length,
    families:D.FAMS.length,
    withPlaylists:styles.filter(s=>s.playlist).length,
    artists:new Set(styles.flatMap(s=>[...(s.keyArtists||[]),...(s.otherArtists||[])])).size,
    songs:styles.reduce((n,s)=>n+((s.songs||[]).length),0),
    crossStylePlaylists:crossings.length
  },
  families:D.FAMS.map(f=>({key:f[0], name:f[1]})),
  styles,
  crossStylePlaylists:crossings
};

const file=path.join(ROOT,"offshoots.json");
// Compact, not pretty-printed. The reader is a model with a context window, and the
// indentation was 160 KB of spaces it would have to pay for.
fs.writeFileSync(file, JSON.stringify(out));
const kb=Math.round(fs.statSync(file).size/1024);
console.log("wrote offshoots.json — "+kb+" KB, "+out.counts.styles+" styles, "
  + out.counts.artists+" artists, "+out.counts.songs+" songs");
