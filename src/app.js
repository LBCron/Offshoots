(function(){
const FAM = {}; FAMS.forEach((f,i)=>FAM[f[0]]={key:f[0],name:f[1],h:f[2],short:f[3]||f[1],i,
  c:(typeof FAMMAP!=="undefined"&&FAMMAP[f[0]])||`hsl(${f[2]} 72% 64%)`});
const nodes = DATA.map(d=>({id:d[0],name:d[1],year:d[2],fam:d[3],parents:d[4]?d[4].split(" "):[],note:d[5]||"",disp:d[6]||String(d[2]),children:[],artists:(typeof ART!=="undefined"&&ART[d[0]])||[],sources:d[7]||[],roster:(typeof ROSTER!=="undefined"&&ROSTER[d[0]])||[],songs:(typeof SONGS!=="undefined"&&SONGS[d[0]])||[],done:(typeof PLAY!=="undefined"&&!!PLAY[d[0]])}));
nodes.forEach(n=>{ n.search=(n.note+" "+n.artists.join(" ")+" "+n.roster.join(" ")).toLowerCase();
  n.songsearch=n.songs.join(" | ").toLowerCase(); });
// Apple Music artist links: start as a search URL, upgrade to the artist page once the iTunes Search API resolves an ID (cached).
let AMID={}; try{ AMID=JSON.parse(localStorage.getItem("amid")||"{}") }catch(e){}
// On Apple devices use the music:// scheme so the Music app opens directly (no browser tab / in-app browser pane).
const APPLE=/Mac|iPhone|iPad|iPod/.test(navigator.platform||"")||/Mac|iPhone|iPad/.test(navigator.userAgent||"");
const amScheme = "https://"; // music:// is swallowed by in-app web views; https universal links hand off to the Music app
const amHref = name=> AMID[name] ? `${amScheme}music.apple.com/us/artist/${AMID[name]}` : `${amScheme}music.apple.com/us/search?term=${encodeURIComponent(name)}`;
function wikiTitle(n,u){ const m=u.match(/\/wiki\/([^?#]+)$/); if(m && !/^Special:/.test(m[1])){ try{ return decodeURIComponent(m[1]).replace(/_/g," ") }catch(e){} } return n.name; }
// Wikipedia: the article recorded as a source when there is one, otherwise a "go to article" search on the style name
function wikiTxt(n){ return wiki(n).replace("class=\"wk\"","class=\"wk txt\"").replace(/<svg[\s\S]*?<\/svg>/,"").replace(/<\/?span>/g,""); }
function wiki(n){
  const u=(n.sources||[]).find(s=>/wikipedia\.org\/wiki\//.test(s))
    || "https://en.wikipedia.org/wiki/Special:Search?go=Go&search="+encodeURIComponent(n.name.split("/")[0].replace(/\([^)]*\)/g,"").trim());
  return `<a class="wk" href="${esc(u)}" target="_blank" rel="noopener" title="Read about ${esc(n.name)} on Wikipedia"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.2A6.3 6.3 0 0 1 8 4.4a6.3 6.3 0 0 1 5.5-1.2v8.6A6.3 6.3 0 0 0 8 13a6.3 6.3 0 0 0-5.5-1.2z"/><path d="M8 4.4V13"/></svg><span>Learn more on Wikipedia</span></a>`;
}
// Emily's own Apple Music class playlists, keyed by style id (paths are relative to music.apple.com)
// cover art, if art/<id>.jpg is sitting next to the page; missing files remove themselves
const ART_DIR="art/", STYLE_DIR="styles/", XPLAY_DIR="xplay/", ART_EXT=".jpg";
// the machine-readable copy of all this, written beside the page by the build
// One file: the structure of the map and what each style is. It carried every artist and
// every song title once, which made it half a megabyte, and the thing that fails when you
// hand a model a URL is almost never the server but the reader, which caps or times out
// long before that. The artists and songs live in the app, behind the playlists.
const CATALOG=[
  {file:"musicatlas.json", name:"musicatlas.json", kb:"190 KB",
   label:"Copy the data link", sub:"Every style, its lineage and its page"}
];
// two letters for a style with no art file, so the row keeps its shape
function initials(name){
  const w=String(name||"").split(/[^A-Za-z0-9]+/).filter(Boolean);
  if(!w.length) return "?";
  return (w.length>1 ? w[0][0]+w[1][0] : w[0].slice(0,2)).toUpperCase();
}
// bare:true asks for the version of the artwork with no lettering on it, for the places
// where the row already prints the name an inch away. Falls back to the titled art, and
// that falls back to the family-colour tile, so a style with neither still has a square.
const cover = (id,n,bare) => {
  const f = (typeof COVER!=="undefined" && COVER[id]) || id;   // COVER maps a style to its file name; otherwise the id is the file name
  const s = bare && typeof STYLEART!=="undefined" && STYLEART[id];
  const node = n || byId[id];
  const c = node ? FAM[node.fam].c : "";
  const ini = initials(node?node.name:id);
  const src = s ? `${STYLE_DIR}${encodeURIComponent(s)}${ART_EXT}`
                : `${ART_DIR}${encodeURIComponent(f)}${ART_EXT}`;
  return `<img class="pcov" src="${src}" alt="" loading="lazy" decoding="async" data-c="${esc(c)}" data-ini="${esc(ini)}">`;
};
// cover plus a playlist title say what the section is; a heading on top of that is noise
function playLabel(n){
  const t=(typeof PTITLE!=="undefined"&&PTITLE[n.id])||"";
  const c=(typeof COVER!=="undefined"&&COVER[n.id])||"";
  if(t&&c) return "";
  return t ? "Start by listening to" : "Start with this playlist";
}
const OPENGO="<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z\"/></svg>";
// one row: art left, labels middle, play button right. paintPlay() repoints it at the
// selected service, or marks it unavailable while keeping the row in place.
function plist(n){
  const ap=(typeof PLAY!=="undefined"&&PLAY[n.id])||"";
  const sp=(typeof SPLAY!=="undefined"&&SPLAY[n.id])||"";
  if(!ap && !sp) return "";
  const t=(typeof PTITLE!=="undefined"&&PTITLE[n.id])||n.name;
  return `<a class="plrow pl" target="_blank" rel="noopener"`
    + ` data-ap="${ap?esc("https://music.apple.com"+ap):""}" data-spid="${esc(sp)}" data-style="${esc(n.name)}">`
    + cover(n.id,n)
    // the arrow used to be a disc at the right-hand end, taking width the long playlist
    // titles needed. It sits at the end of the service line instead, where it still says
    // the row leaves the page.
    + `<span class="pltx"><b class="plttl">${esc(t)}</b>`
    + `<span class="plline"><span class="plsvc"></span><span class="plgo">${OPENGO}</span></span></span></a>`;
}
// ---------- playlists that span styles ----------
// Same row as a style's own playlist, so the two read as one list, with a line saying
// where else it goes: a run that crosses the map is worth following precisely because it
// does not belong to the style you found it on, and the row has to say so or it reads as
// a second, oddly-named playlist for this style.
const xplayFor = id => (typeof XPLAY!=="undefined" ? XPLAY : [])
  .filter(x=>x.styles && x.styles.indexOf(id)>=0);
function xrow(x,id){
  // every other style it draws from, named, longest list trimmed to keep the row a row
  const others=x.styles.filter(s=>s!==id && byId[s]).map(s=>byId[s].name);
  // one line, so two names and a count: three names ran past the end on a phone and the
  // ellipsis ate the count, which is the part that says how far the run reaches
  const span = others.length
    ? (others.length>2 ? others.slice(0,2).join(", ")+" and "+(others.length-2)+" more"
                       : others.join(" and "))
    : "";
  const ini=initials(x.title);
  // art only when there is a file to ask for. The <img> fallback exists for a file that
  // goes missing, and it shows a torn icon and spends two requests getting there; a
  // playlist with no art yet should just open on the tile.
  const art = x.art
    ? `<img class="pcov" src="${XPLAY_DIR}${encodeURIComponent(x.id)}${ART_EXT}" alt=""`
      + ` loading="lazy" decoding="async" data-c="${esc(x.c||"")}" data-ini="${esc(ini)}">`
    : `<span class="pcov pcovph" aria-hidden="true"${x.c?` style="--c:${esc(x.c)}"`:""}>`
      + `<b>${esc(ini)}</b></span>`;
  return `<a class="plrow pl xplay" target="_blank" rel="noopener"`
    + ` data-ap="${x.ap?esc("https://music.apple.com"+x.ap):""}" data-spid="${esc(x.sp||"")}"`
    + ` data-style="${esc(x.title)}">`
    + art
    + `<span class="pltx"><b class="plttl">${esc(x.title)}</b>`
    + (x.note?`<span class="plnote">${esc(x.note)}</span>`:"")
    + (span?`<span class="plspan">Also on ${esc(span)}</span>`:"")
    + `<span class="plline"><span class="plsvc"></span><span class="plgo">${OPENGO}</span></span></span></a>`;
}
function paintPlay(){
  document.querySelectorAll("#panelBody a.plrow, #panelBody a.plbtn, #panelBody a.xopen, #panelBody a.trkbtn").forEach(a=>{
    const ap=a.dataset.ap||"", sp=a.dataset.spid||"", nm=a.dataset.style||"";
    const lbl=a.querySelector(".plsvc"); if(!lbl) return;
    const track=a.classList.contains("trkbtn");
    const url = SVC==="spotify" ? (sp?(track?sp:"https://open.spotify.com/playlist/"+sp):"")
      : SVC==="apple" ? ap : "";
    if(url){
      a.classList.remove("off"); a.removeAttribute("aria-disabled");
      // rebuilt rather than toggled, so anything else the row is has to be carried over:
      // a cross-style row lost its own class here and went back to looking like the
      // style's own playlist
      const base=a.classList.contains("trkbtn")?"trkbtn"
        : a.classList.contains("plbtn")?"plbtn"
        : a.classList.contains("xopen")?"xopen"
        : "plrow"+(a.classList.contains("xplay")?" xplay":"");
      a.className=base+" "+(SVC==="spotify"?"sp":"pl");
      a.href=url; if(SVC==="spotify") a.dataset.sp=sp; else delete a.dataset.sp;
      // the button says where it is going; a row says what it is
      lbl.textContent=(a.dataset.lbl||"Playlist on")+" "+svcName();
      a.title=track ? "Open "+nm+" in "+svcName()
        : "Open the "+nm+" playlist in "+svcName();
    } else {
      // the row stays so the section keeps its shape; it just can't be played here yet
      const base2=a.classList.contains("trkbtn")?"trkbtn"
        : a.classList.contains("plbtn")?"plbtn"
        : a.classList.contains("xopen")?"xopen"
        : "plrow"+(a.classList.contains("xplay")?" xplay":"");
      a.className=base2+" off";
      a.removeAttribute("href"); delete a.dataset.sp;
      a.setAttribute("aria-disabled","true");
      lbl.textContent="Not on "+svcName()+" yet";
      a.title=track ? nm+" is not on "+svcName()+" yet"
        : "No "+svcName()+" playlist for "+nm+" yet";
    }
  });
}
// one plain sentence about the style: its own note when that is prose, otherwise built from the lineage
function about(n){
  const written=(typeof DESC!=="undefined"&&DESC[n.id])||"";
  if(written) return written;
  if(n.prose) return n.prose;
  const names = ids => ids.slice(0,3).map(i=>byId[i].name);
  const list = xs => xs.length<2 ? xs[0] : xs.slice(0,-1).join(", ")+" and "+xs[xs.length-1];
  const bits=[];
  if(n.parents.length) bits.push(`Grew out of ${list(names(n.parents))}${n.parents.length>3?" and others":""}.`);
  if(n.children.length) bits.push(`Led to ${n.children.length} ${n.children.length===1?"style":"styles"}.`);
  return bits.join(" ");
}
const SPK=`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.2H2.2v3.6H4L7.2 12V4z"/><path d="M9.8 6a2.6 2.6 0 0 1 0 4"/><path d="M11.8 4.2a5 5 0 0 1 0 7.6"/></svg>`;
const BRAND={apple:"#fa233b",spotify:"#1db954",qobuz:"#0070ef"};
let SVC="apple"; try{ SVC=localStorage.getItem("svc")||"apple" }catch(e){}
const spHref = name=>`https://open.spotify.com/search/${encodeURIComponent(name)}`;
const qbHref = name=>`https://www.qobuz.com/us-en/search?q=${encodeURIComponent(name)}`;
const svcHref = name=> SVC==="spotify" ? spHref(name) : SVC==="qobuz" ? qbHref(name) : amHref(name);
const svcName = ()=> SVC==="spotify" ? "Spotify" : SVC==="qobuz" ? "Qobuz" : "Apple Music";
// Phosphor, the Duotone weight, MIT, like every other icon here. One symbol per kind of act, so a row of artists reads at a glance:
// who sings, who plays, who is a whole band, who makes it in a room on their own.
const ROLEICON={"band":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z\"/></svg>","voice":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M168,16A72.07,72.07,0,0,0,96,88a73.29,73.29,0,0,0,.63,9.42L27.12,192.22A15.93,15.93,0,0,0,28.71,213L43,227.29a15.93,15.93,0,0,0,20.78,1.59l94.81-69.53A73.29,73.29,0,0,0,168,160a72,72,0,1,0,0-144Zm56,72a55.72,55.72,0,0,1-11.16,33.52L134.49,43.16A56,56,0,0,1,224,88ZM54.32,216,40,201.68,102.14,117A72.37,72.37,0,0,0,139,153.86ZM112,88a55.67,55.67,0,0,1,11.16-33.51l78.34,78.34A56,56,0,0,1,112,88Zm-2.35,58.34a8,8,0,0,1,0,11.31l-8,8a8,8,0,1,1-11.31-11.31l8-8A8,8,0,0,1,109.67,146.33Z\"/></svg>","mc":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z\"/></svg>","guitar":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M249.66,46.34l-40-40a8,8,0,0,0-11.31,11.32L200.69,20,140.52,80.16C117.73,68.3,92.21,69.29,76.75,84.74a42.27,42.27,0,0,0-9.39,14.37A8.24,8.24,0,0,1,59.81,104c-14.59.49-27.26,5.72-36.65,15.11C11.08,131.22,6,148.6,8.74,168.07,11.4,186.7,21.07,205.15,36,220s33.34,24.56,52,27.22A71.13,71.13,0,0,0,98.1,248c15.32,0,28.83-5.23,38.76-15.16,9.39-9.39,14.62-22.06,15.11-36.65a8.24,8.24,0,0,1,4.92-7.55,42.12,42.12,0,0,0,14.37-9.39c15.45-15.46,16.44-41,4.58-63.77L236,55.31l2.34,2.34a8,8,0,1,0,11.32-11.31ZM160,167.93a26.12,26.12,0,0,1-8.95,5.83,24.24,24.24,0,0,0-15,21.89c-.36,10.46-4,19.41-10.43,25.88-8.44,8.43-21,11.95-35.36,9.89C75,229.25,59.73,221.19,47.27,208.73S26.75,181,24.58,165.81c-2-14.37,1.46-26.92,9.89-35.36C40.94,124,49.89,120.37,60.35,120h0a24.22,24.22,0,0,0,21.89-15,26.12,26.12,0,0,1,5.83-9c5.49-5.49,13-8.13,21.38-8.13a49.38,49.38,0,0,1,19.13,4.19L108.5,112.19a32,32,0,1,0,35.31,35.31l20.08-20.08C170.41,142.71,169.47,158.41,160,167.93Zm-10.4-61.48a72.9,72.9,0,0,1,5.93,6.75l-15.42,15.42a32.22,32.22,0,0,0-12.68-12.68l15.42-15.43A73,73,0,0,1,149.55,106.45ZM112,128a16,16,0,0,1,16,16h0a16,16,0,1,1-16-16Zm48.85-32.85a86.94,86.94,0,0,0-6.68-6L176,67.31,188.69,80l-21.83,21.82A86.94,86.94,0,0,0,160.86,95.14ZM200,68.68,187.32,56,212,31.31,224.69,44ZM93.66,194.33a8,8,0,0,1-11.31,11.32l-32-32a8,8,0,0,1,11.32-11.31Z\"/></svg>","keys":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM80,48h24v88H80Zm32,104a8,8,0,0,0,8-8V48h16v96a8,8,0,0,0,8,8h8v56H104V152Zm40-16V48h24v88ZM48,48H64v96a8,8,0,0,0,8,8H88v56H48ZM208,208H168V152h16a8,8,0,0,0,8-8V48h16V208Z\"/></svg>","player":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V110.25l112-28v51.83A36,36,0,1,0,216,164V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216ZM88,93.75V62.25l112-28v31.5ZM180,184a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z\"/></svg>","dj":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm0-144a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0,72.08,72.08,0,0,1,72-72,8,8,0,0,1,0,16Zm72,56a72.08,72.08,0,0,1-72,72,8,8,0,0,1,0-16,56.06,56.06,0,0,0,56-56,8,8,0,0,1,16,0Zm-40,0a32,32,0,1,0-32,32A32,32,0,0,0,160,128Zm-48,0a16,16,0,1,1,16,16A16,16,0,0,1,112,128Z\"/></svg>","studio":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M136,120v96a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm64,72a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V200A8,8,0,0,0,200,192Zm24-32H208V40a8,8,0,0,0-16,0V160H176a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16ZM56,160a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V168A8,8,0,0,0,56,160Zm24-32H64V40a8,8,0,0,0-16,0v88H32a8,8,0,0,0,0,16H80a8,8,0,0,0,0-16Zm72-48H136V40a8,8,0,0,0-16,0V80H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16Z\"/></svg>","none":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34ZM88,216a32,32,0,1,1,32-32A32,32,0,0,1,88,216ZM200,101.25l-64-19.2V50.75L200,70Z\"/></svg>"};
const PHOTO_DIR="artists/", COVER_DIR="covers/", FB_DIR="artists/fallbacks/",
      MOOD_DIR="moods/";
// Every collection has a picture of its own, named for the mode it belongs to. The glyph
// stays underneath, so one that fails to load uncovers the symbol it replaced instead of
// a torn icon, the way the portraits and the sleeves already behave.
// The comment above said this and the code did not do it: a glyph behind a broken <img>
// is a glyph behind the browser's torn-page icon, which is what a collection with no
// painting yet actually looked like. Taking the image out of the DOM on error is what
// uncovers the symbol.
const moodArt = key => `<img src="${MOOD_DIR}${encodeURIComponent(key)}.jpg"`
  + ` alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
// ---------- a stand-in where there is no portrait and no record ----------
// 3,353 of the 4,850 acts the map names have neither a photo nor a sleeve, and the role
// glyph has been carrying all of them: eight symbols across three and a half thousand
// names, so a panel could show four circles wearing the same microphone. These are 144
// anonymous silhouettes, cream on transparent, drawn for exactly this.
//
// What picks one is the role table the app already keeps, not the artist's name or the
// style's genre. Where the table says nothing, the pool is the plain portraits: an
// unknown act is not a band until something says it is. A band's lineup is unknown here,
// so every band gets a four-person shape, which is an illustration of a group and not a
// headcount. None of these is a likeness and none of them claims to be.
const FBSEQ=(p,n)=>Array.from({length:n},(_,i)=>p+"-"+String(i+1).padStart(2,"0")+".png");
const FBPOOL={
  portrait:FBSEQ("solo",24), singer:FBSEQ("singer",24), keyboard:FBSEQ("keyboard",8),
  dj:FBSEQ("dj",8), quartet:FBSEQ("group-04",12),
  // the table says "guitar" and not which kind, so both pools are one pool
  guitar:FBSEQ("acoustic",12).concat(FBSEQ("electric",16))
};
// band is a group whose size nobody here knows; player and studio are people whose
// instrument nobody here knows; the rest map to what the table actually states
const FBROLE={band:"quartet", voice:"singer", mc:"singer", guitar:"guitar",
  keys:"keyboard", dj:"dj", player:"portrait", studio:"portrait", none:"portrait"};
// FNV-1a over the artist's name, which is this app's key for an artist everywhere else.
// Same name, same silhouette, in the circle row and in the list and across reloads.
function fbHash(s){ let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0; }
// An override for any one artist, by name. Appending to a pool above would re-deal every
// assignment inside it, so anything that has to stay put is pinned here instead.
const FBFIX={};
function fbFile(name,role){
  if(FBFIX[name]) return FBFIX[name];
  const pool=FBPOOL[FBROLE[role]||"portrait"]||FBPOOL.portrait;
  return pool[fbHash(name)%pool.length];
}
const artRole = n => (typeof ROLE!=="undefined" && ROLE[n]) || "none";
// A portrait where there is one, the role glyph where there is not.
//
// 520 of the 2,218 key artists have a photo and the rest never will: a lot of them are
// too new or too underground for Wikimedia, and some are credits naming two acts. So the
// glyph is not a placeholder waiting to be replaced, it is the other half of the design,
// and a row has to read as deliberate whichever it draws.
//
// The image is lazy and decodes off the main thread, because a style panel can open
// fifteen of these at once. On a miss the <img> is left to its own error handling, the
// same way the playlist covers are: a broken portrait falls back to the glyph beneath it
// rather than a torn icon.
const photoOf = name => (typeof PHOTO!=="undefined" && PHOTO[name]) || "";
const coverOf = name => (typeof COVERART!=="undefined" && COVERART[name]) || "";
function artFace(name, cls){
  const f=photoOf(name), r=artRole(name);
  const fb=`<b class="facefb">${ROLEICON[r]||ROLEICON.none}</b>`;
  if(f) return `<i class="${cls} hasimg"><img src="${PHOTO_DIR}${encodeURIComponent(f)}.jpg"`
    + ` alt="" loading="lazy" decoding="async">${fb}</i>`;
  // no portrait: a record of theirs, drawn square so it does not pass for a face
  const c=coverOf(name);
  if(c) return `<i class="${cls} hasimg hascov"><img src="${COVER_DIR}${encodeURIComponent(c)}.jpg"`
    + ` alt="" loading="lazy" decoding="async">${fb}</i>`;
  // neither: a silhouette, cream on the family's own deep ground, which is the same
  // relationship the cover art has. It is drawn as an image rather than masked into the
  // panel's colour: a CSS mask from a file:// URL is refused by the browser while the
  // same file loads perfectly as an image, and this map is meant to work from a folder
  // on a disk as much as from a server. A broken one uncovers the glyph beneath it, the
  // same as a portrait, and there is nothing after it to fail in turn.
  // and no glyph under this one. The silhouette is cut out of its square, so a symbol
  // behind it shows through the gaps between a figure's arm and its body, and the row
  // ends up wearing both. A fallback that fails to load leaves the family's own ground,
  // which is quiet; it is the one image here that ships inside the app rather than being
  // fetched from anywhere, so it failing means the whole folder is missing.
  const g=fbFile(name,r);
  if(g) return `<i class="${cls} hasimg hasfb"><img src="${FB_DIR}${g}"`
    + ` alt="" loading="lazy" decoding="async"></i>`;
  return `<i class="${cls}">${ROLEICON[r]||ROLEICON.none}</i>`;
}
// a circle each, the way the ways in work on the overview: the symbol says what the act
// is and the colour goes with it, so eight kinds are eight colours down the row
const amCirc = name=>{
  const r=artRole(name);
  return `<a class="acirc r-${r}" href="${svcHref(name)}" data-name="${esc(name)}"`
    + ` target="_blank" rel="noopener" title="Open ${esc(name)} in ${svcName()}"`
    + ` aria-label="${esc(name)}, open in ${svcName()}">`
    + artFace(name,"aco")
    + `<span class="aclbl">${esc(name)}</span></a>`;
};
const am = name=>`<a class="am" href="${svcHref(name)}" data-name="${esc(name)}" target="_blank" rel="noopener" title="Open ${esc(name)} in ${svcName()}" aria-label="${esc(name)}, open in ${svcName()}"><span>${esc(name)}</span><i class="amgo" aria-hidden="true">${OPENGO}</i></a>`;
function setSvc(s){
  SVC=s; try{ localStorage.setItem("svc",s) }catch(e){}
  // every link that names an artist, not only the chip-shaped ones: the circles in the
  // row and the rows on the Key artists page carry data-name too, and a.am missed both,
  // so switching service left them pointing at the service you had just left
  document.querySelectorAll("a[data-name]").forEach(x=>{
    x.href=svcHref(x.dataset.name);
    x.title="Open "+x.dataset.name+" in "+svcName();
    if(x.hasAttribute("aria-label")) x.setAttribute("aria-label",x.dataset.name+", open in "+svcName());
  });
  document.querySelectorAll("[data-svc]").forEach(bt=>bt.setAttribute("aria-pressed",String(bt.dataset.svc===s)));
  document.querySelectorAll(".svc").forEach(el=>el.style.setProperty("--brand", BRAND[s]||"#0071e3"));
  paintPlay();
  if(s==="apple") amUpgrade();
  document.querySelectorAll(".svc .svctx").forEach(x=>{ x.textContent=svcName(); });
  // the label says which one is on, so it goes stale unless it is rewritten with the rest
  document.querySelectorAll("select.svcsel").forEach(x=>x.setAttribute("aria-label",
    SVCTIP+" Currently "+svcName()+"."));
}
// ---------- lazy Apple Music artist lookups ----------
// A queue, so a long list does not open 130 connections at once and earn a 403.
const amQ=[]; let amInFlight=0; const AMMAX=4;
function amPump(){
  while(amInFlight<AMMAX && amQ.length){
    const job=amQ.shift(); amInFlight++;
    job().catch(()=>{}).then(()=>{ amInFlight--; setTimeout(amPump,120); });
  }
}
function amPaint(a){
  const id=AMID[a.dataset.name];
  if(id && SVC==="apple") a.href=`${amScheme}music.apple.com/us/artist/${id}`;
}
const amSeen=new WeakSet();
const amObs = typeof IntersectionObserver==="function" ? new IntersectionObserver(es=>{
  for(const e of es){ if(!e.isIntersecting) continue; const a=e.target; amObs.unobserve(a); amQueue(a); }
},{rootMargin:"200px"}) : null;
function amQueue(a){
  const nm=a.dataset.name; if(!nm) return;
  if(AMID[nm]!==undefined){ amPaint(a); return; }
  amQ.push(()=>amResolve(nm).then(()=>amPaint(a))); amPump();
}
function amWatch(a){
  if(SVC!=="apple" || !a.dataset.name) return;
  if(AMID[a.dataset.name]!==undefined){ amPaint(a); return; }   // cached, nothing to wait for
  if(!amObs){ amQueue(a); return; }
  if(amSeen.has(a)) return;
  amSeen.add(a); amObs.observe(a);
}
const amPending=new Map();
function amResolve(name){
  if(AMID[name]!==undefined) return Promise.resolve(AMID[name]);
  if(amPending.has(name)) return amPending.get(name);
  const p=fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5&country=US`).then(r=>r.json()).then(j=>{
    const rs=j.results||[]; const lc=name.toLowerCase();
    const hit=rs.find(r=>(r.artistName||"").toLowerCase()===lc)||rs.find(r=>(r.artistName||"").toLowerCase().replace(/^the /,"")===lc.replace(/^the /,""))||rs[0];
    AMID[name]=hit?hit.artistId:0; try{ localStorage.setItem("amid",JSON.stringify(AMID)) }catch(e){}
    return AMID[name];
  }).catch(()=>null).finally(()=>amPending.delete(name));
  amPending.set(name,p); return p;
}
// Both services open their web player when given an https link in a browser. Try the app's URL scheme first and
// fall back to the web link when nothing picks it up (e.g. inside the Claude desktop app's web view).
const MACOS=/Mac/.test(navigator.platform||"")&&!/iPhone|iPad|iPod/.test(navigator.userAgent||"")&&navigator.maxTouchPoints<2;
const APPLEOS=/Mac|iPhone|iPad|iPod/.test(navigator.platform||"")||/Mac|iPhone|iPad/.test(navigator.userAgent||"");
function deepFor(a){
  if(SVC==="qobuz") return a.href;                 // Qobuz has no documented URL scheme; stay on the web
  if(SVC==="spotify") return "spotify:search:"+encodeURIComponent(a.dataset.name||"");
  return a.href.replace(/^https:/,"music:");
}
function openArtist(name){
  const url=svcHref(name);
  const deep = SVC==="spotify" ? "spotify:search:"+encodeURIComponent(name) : url.replace(/^https:/,"music:");
  if(SVC==="qobuz" || !(MACOS||COARSE) || (SVC==="apple" && !APPLEOS)){ window.open(url,"_blank","noopener"); return; }
  let taken=false; const mark=()=>{taken=true};
  window.addEventListener("blur",mark); document.addEventListener("visibilitychange",mark);
  const f=document.createElement("iframe"); f.style.display="none"; f.src=deep; document.body.appendChild(f);
  setTimeout(()=>{ window.removeEventListener("blur",mark); document.removeEventListener("visibilitychange",mark); f.remove(); if(!taken) window.open(url,"_blank","noopener"); },1200);
}
const COARSE=matchMedia("(hover:none) and (pointer:coarse)").matches;
if(MACOS) document.addEventListener("click",e=>{
  const a=e.target.closest("a.am, a.pl, a.sp"); if(!a||e.metaKey||e.ctrlKey||e.shiftKey) return;
  const isPl=a.classList.contains("pl"), isSp=a.classList.contains("sp");
  if(!isPl && !isSp && SVC==="qobuz") return;               // no app scheme for Qobuz, let the link open normally
  if(!isPl && !isSp && SVC==="apple" && !APPLEOS) return;   // only Apple platforms have the Music app
  e.preventDefault();
  const url=a.href, deep=isPl ? a.href.replace(/^https:/,"music:") : isSp ? "spotify:playlist:"+a.dataset.sp : deepFor(a);
  let taken=false; const mark=()=>{taken=true};
  window.addEventListener("blur",mark); document.addEventListener("visibilitychange",mark);
  const f=document.createElement("iframe"); f.style.display="none"; f.src=deep; document.body.appendChild(f);
  setTimeout(()=>{ window.removeEventListener("blur",mark); document.removeEventListener("visibilitychange",mark); f.remove(); if(!taken) window.open(url,"_blank","noopener"); },1200);
});
function amUpgrade(){
  if(SVC!=="apple") return;
  // Every artist link, not just the inline ones: the circles are a.acirc and the rows a.amrow.
  // Watched rather than resolved on the spot — a Key artists page carries 130 of them and Apple
  // rate-limits, so each one waits until it is actually on screen.
  document.querySelectorAll("a[data-name]").forEach(a=>amWatch(a));
}
const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
nodes.forEach(n=>n.parents.forEach(p=>byId[p].children.push(n.id)));
const nEdges = nodes.reduce((a,n)=>a+n.parents.length,0);
const TOUCH = matchMedia("(hover:none) and (pointer:coarse)").matches;
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $ = id=>document.getElementById(id);
const statsEl=document.createElement("span"); statsEl.id="stats"; statsEl.hidden=true; document.body.appendChild(statsEl);
$("stats").textContent = `${nodes.length} styles · ${nodes.filter(n=>n.year<1950).length} of them pre-1950 roots · ${nEdges} lineage links · ${FAMS.length} families`;

const AXH=30, END=2026;
const BAR=()=>$("spacer").offsetHeight;
let Z=1; const BASE=.576, ZMIN=.7, ZMAX=3.3; let LOD=false; // Z is shown as %, 100% = BASE scale
let NARROW, OVERLAY, LABELW, ROOTW, PX, RH, FS, R, PAD, X0, FSMIN, FSMAX, TK;
function dims(){
  NARROW = innerWidth<700; OVERLAY = innerWidth<900;
  LABELW = NARROW?36:40; ROOTW = NARROW?280:340; PX = NARROW?38:34;
  RH = NARROW?25:21; FS = NARROW?13:12; R = NARROW?5:4.5; PAD = NARROW?7:9; X0 = LABELW+18;
  const k=Z*BASE; RH*=k; FS*=k; R*=k; PAD*=k; X0=LABELW+18*k;
  // Labels scale with the zoom, with a floor under them. Pinning them to a fixed size
  // kept every label legible but made zooming feel broken: the dots and the spacing grew
  // and the names stayed put, so the map looked like it was sliding under the type rather
  // than being magnified. The floor is what the pinning was really for — 11px is the
  // smallest size Apple sets text at, and an unfloored scale put 139 of the 460 labels
  // under 9px at the far end. So: FS moves with Z, and stops at the floor rather than
  // going under it. Past that point density is the LOD's job, which drops leaf labels on
  // zoom out the way Maps does.
  FSMIN = NARROW?11:11.5; FSMAX = NARROW?14:14.5;
  TK = Z;
  // The year scale was a fixed number of pixels per year, so on a wide window it ran
  // out before the canvas did and left dead space to the right of the last year.
  // Work out what 100% has to mean for this viewport so the span reaches the edge.
  // Width only: type and row height keep their own scale, so a wide screen spreads the
  // timeline rather than magnifying it.
  const room = scroller.clientWidth - (LABELW+18*BASE) - 40;
  const span = (ROOTW + (END-1950)*PX) * BASE;        // the axis at 100%, before filling
  // never below 1: on an ordinary screen the scale is untouched and the map scrolls,
  // and zooming out still shrinks, because the factor is fixed at 100% rather than
  // recomputed against the current zoom
  const FILL = room>0 ? Math.max(1, room/span) : 1;
  // Zooming out shrank the year scale as hard as everything else, so the thing you zoom
  // out to do — take in the whole atlas — was the thing it was worst at: names landed on
  // top of each other long before the rows ran out of room, and the LOD had to drop them.
  // The horizontal scale is damped instead, so every step out leaves the years wider apart
  // than a straight scale would and the labels keep their lane. Zooming in is untouched:
  // past 100% the two scales are the same again, which is what makes a zoom feel like a
  // magnifier rather than a stretch. The damping is on Z and not on k: k is Z*BASE and
  // BASE is .576, so a test on k would have damped 100% as well and widened the map
  // everybody sees by default.  At the 70% floor the years sit 22% further apart than a
  // straight scale puts them, which is most of a decade of extra room on a 1400px window.
  const KX = (Z<1 ? Math.pow(Z,0.45) : Z) * BASE;
  PX*=KX*FILL; ROOTW*=KX*FILL;
}
const xOf = y=> y<1950 ? X0+(Math.max(y,1895)-1895)/55*ROOTW : X0+ROOTW+(y-1950)*PX;
const mctx = document.createElement("canvas").getContext("2d");
const scroller=$("scroller");

let W=0,H=0,lanes=[];
const CMAX = Math.max(...nodes.map(n=>n.children.length));
// How much came out of a style is the one thing size says on this map, and a smooth
// square-root ramp said it too quietly: a leaf was 11.5px and the biggest trunk 14.5px,
// a quarter larger after twenty-five descendants. Five discrete tiers instead, because
// the eye groups steps and reads a continuous ramp as noise. Weight climbs with them.
const TIERS=[[12,4],[6,3],[3,2],[1,1],[0,0]];
const TIERFS=[[11.5,400],[12.5,400],[14,500],[16.5,600],[19,700]];
const TIERFS_N=[[11,400],[12,400],[13.5,500],[15.5,600],[18,700]];
nodes.forEach(n=>{ const c=n.children.length;
  n.tier = TIERS.find(t=>c>=t[0])[1];
  n.sc = 1.15+0.95*Math.sqrt(c/CMAX);
  n.fw = TIERFS[n.tier][1];
  n.bold = n.fw>=600; });
function layout(avail){
  lanes=[]; W=xOf(END)+40; nodes.forEach(n=>n.row=null);
  FAMS.forEach(([k])=>{
    const list = nodes.filter(n=>n.fam===k).sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name));
    const ends=[], rowH=[];
    list.forEach(n=>{
      // the tier picks the size, the zoom moves it, and the floor catches it; the dot
      // follows the tier so a big label never wears a small mark
      n.fs = Math.max(FSMIN, (NARROW?TIERFS_N:TIERFS)[n.tier][0]*TK);
      n.r = R*(0.88+0.17*n.tier);
      mctx.font = `${n.fw} ${n.fs}px 'IBM Plex Sans', system-ui, sans-serif`;
      n.x = xOf(n.year);
      n.lod = LOD && n.children.length===0;           // leaf drawn as a dot only at overview zoom
      n.w = n.lod ? 0 : mctx.measureText(n.name).width;
      const need = n.lod ? n.x-n.r-2 : n.x-n.r-3;
      const free = r => r>=0 && r<ends.length && ends[r] <= need;
      // prefer the row of a same-family parent (latest first), then a same-family child-of-parent sibling row, then first free
      let r = -1;
      const pr = n.parents.map(p=>byId[p]).filter(p=>p.fam===k && p.row!=null).sort((a,b)=>b.year-a.year);
      // a style never sits above a parent in its own family, so lineage reads downward
      const minRow = pr.length ? Math.max(...pr.map(p=>p.row)) : 0;
      for(const p of pr){ if(free(p.row)){ r=p.row; break; } }
      if(r<0) r = ends.findIndex((e,i)=> i>=minRow && e <= need);
      // for the influential styles, keeping lineage downward is worth a new row; elsewhere take any free row
      const strict = pr.length && (n.bold || pr.some(p=>p.bold));
      if(r<0 && !strict) r = ends.findIndex(e=> e <= need);
      if(r<0){r=ends.length;ends.push(0);rowH.push(RH)}
      ends[r] = n.lod ? n.x+n.r+4 : n.x+n.r+6+n.w+12; n.row=r;
      rowH[r] = Math.max(rowH[r], n.lod ? RH*.8 : n.fs*1.5);
      W = Math.max(W, n.x+n.r+6+n.w+24);
    });
    while(rowH.length<2) rowH.push(RH);
    const off=[]; let acc=0; rowH.forEach((h,i)=>{off[i]=acc;acc+=h;});
    const need = (54 + 7.4*FAM[k].short.length) - PAD*2;   // room for the vertical pill label
    if(acc<need){ rowH[rowH.length-1]+=need-acc; acc=need; }
    lanes.push({k,list,rowH,off,inner:acc,count:list.length});
  });
  // stretch lanes so the chart fills the visible height
  const base = lanes.reduce((a,l)=>a+l.inner+PAD*2,0);
  const extra = avail>base ? (avail-base)/lanes.length : 0;
  let y=HEADH;                      // the title row sits in the chart, above the first lane
  lanes.forEach(l=>{
    l.h = l.inner+PAD*2+extra; l.y0=y;
    const top = y+PAD+extra/2;
    l.list.forEach(n=>{ n.rh=l.rowH[n.row]; n.y = top+l.off[n.row]+n.rh/2; });
    y+=l.h;
  });
  H=y;
}

function draw(){
  let ax=`<svg width="${W}" height="${AXH}"><text class="rt" x="${X0}" y="19">Roots, before 1950</text>`;
  ax += `<text x="${xOf(END)}" y="19" text-anchor="middle" class="now">${END}</text>`;
  for(let yr=1950; yr<=2025; yr+=5){ const x=xOf(yr); if(yr===2025) continue; ax += yr%10===0 ? `<text x="${x}" y="19" text-anchor="middle">${yr}</text>` : `<text x="${x}" y="19" text-anchor="middle" opacity=".55">’${String(yr).slice(2)}</text>`; }
  document.documentElement.style.setProperty("--stripw",(LABELW-8)+"px");
  $("axis").innerHTML = ax+`</svg><div id="corner" style="width:${LABELW-8}px;transform:translateX(${scroller.scrollLeft}px)"></div>`;
  let s="";
  // The lanes alternate in one neutral ink, not in eighteen family colours.
  //
  // The family wash was an answer to a real problem: the neutral it replaced was five
  // levels of luminance off the map and invisible, so the lanes did not read as lanes.
  // But colouring them by family paints a fifth of the screen in a hue that means
  // something, and what it means is already said twice over by the rail on the left and
  // by the dot on every style. Eighteen washes competing with those is the map telling
  // you the same thing three times in three strengths, which is what made it hard to
  // find anything in. So: neutral again, but at a strength that can actually be seen,
  // which is what the first neutral got wrong.
  //
  // One ink at two opacities, so the alternation cannot invert. test/root.test.js holds
  // that every low row stays darker than every high one.
  lanes.forEach((l,i)=>{
    s+=`<rect class="band${i%2?"":" b2"}" x="0" y="${l.y0}" width="${W}" height="${l.h}"/>`;
    if(i) s+=`<line class="lanedge" x1="0" x2="${W}" y1="${l.y0}" y2="${l.y0}"/>`;
  });
  s+=`<line class="nowline" x1="${xOf(END)}" x2="${xOf(END)}" y1="0" y2="${H}"/>`;
  for(let yr=1950; yr<=2025; yr+=5){ const x=xOf(yr); s+=`<line class="${yr%10?'g5':'g10'}" x1="${x}" x2="${x}" y1="0" y2="${H}"/>`; }
  s+=`<g id="edges">`;
  nodes.forEach(c=>c.parents.forEach(pid=>{
    const p=byId[pid], x1=p.x, y1=p.y, x2=c.x, y2=c.y, dx=Math.max(28,(x2-x1)*.5);
    s+=`<path class="e" data-p="${p.id}" data-c="${c.id}" style="--c:${FAM[p.fam].c}" d="M${x1},${y1} C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}"/>`;
  }));
  s+=`</g><g id="nodes">`;
  nodes.forEach(n=>{
    s+=`<g class="n${n.year<1950?' root':''}${n.lod?' leaf':''}${n.done?' has':''}" data-id="${n.id}" style="--c:${FAM[n.fam].c}" transform="translate(${n.x},${n.y})"><title>${esc(n.name)} (${esc(n.disp)})</title><rect class="hit" x="${-n.r-4}" y="${-n.rh/2}" width="${n.w+n.r*2+14}" height="${n.rh}"/><circle r="${(n.done?n.r*1.95:n.r).toFixed(2)}"/>${n.done
      ? `<path class="ply" d="M${(-n.r*.85).toFixed(2)} ${(-n.r*1.1).toFixed(2)}L${(n.r*1.15).toFixed(2)} 0L${(-n.r*.85).toFixed(2)} ${(n.r*1.1).toFixed(2)}Z"/>`:""}<text class="halo" aria-hidden="true" x="${n.r+5}" y="${n.fs*.36}" style="font-size:${n.fs.toFixed(1)}px;font-weight:${n.fw}">${esc(n.name)}</text><text x="${n.r+5}" y="${n.fs*.36}" style="font-size:${n.fs.toFixed(1)}px;font-weight:${n.fw}">${esc(n.name)}</text></g>`;
  });
  s+=`</g>`;
  const svg=$("chart"); svg.setAttribute("width",W); svg.setAttribute("height",H); svg.setAttribute("viewBox",`0 0 ${W} ${H}`); svg.style.setProperty("--fs",FS+"px"); svg.innerHTML=s;
  $("inner").style.width=W+"px";
  const L=$("lanes"); L.style.top=(BAR()+AXH)+"px"; L.style.setProperty("--lz",1);
  L.innerHTML = `<div class="lane fill" style="top:0;height:${HEADH}px;left:0;width:${LABELW-8}px"></div>` + lanes.map((l,i)=>`<div class="lane c" data-fam="${l.k}" style="--c:${FAM[l.k].c};top:${l.y0}px;height:${l.h}px;left:0;width:${LABELW-8}px" title="${esc(FAM[l.k].name)} · ${l.count} styles"><span class="vt">${esc(FAM[l.k].short)}</span><span class="cnt">${l.count}</span></div>`).join("");
  L.style.transform=`translateX(${scroller.scrollLeft}px)`;
}
scroller.addEventListener("scroll",()=>{ const t=`translateX(${scroller.scrollLeft}px)`; $("lanes").style.transform=t;
  const c=$("corner"); if(c) c.style.transform=t; },{passive:true});

// size the tree to the rest of the viewport
function fit(){}

// ---------- the map's title row ----------
// The title, the line about what the map is for and the two counts used to be the first
// card in the panel. They describe the map, not the panel, so they sit on the map, in a
// band above the first lane that layout() leaves empty for them.
let HEADH = 0;
function mapHeadHTML(){
  // a label on the map rather than a masthead: no blurb, nothing to click, and set quietly
  // enough that it does not compete with the style names a few pixels below it.
  return '<h1 class="mh">Music Atlas</h1>'
    + '<p class="mmeta">'+nodes.length+' styles · '+playable().length+' playlists</p>';
}
function measureHead(){
  const h=$("maphead"); if(!h){ HEADH=0; return; }
  if(!h.firstChild) h.innerHTML=mapHeadHTML();
  h.style.top=(BAR()+AXH)+"px";
  h.style.width=Math.max(300,scroller.clientWidth)+"px";   // measured against the window, not the chart
  HEADH=Math.ceil(h.getBoundingClientRect().height);
}

// ---------- lineage ----------
function walk(id,key){ const m=new Map(), q=[[id,0]]; while(q.length){ const [c,d]=q.shift(); for(const x of byId[c][key]){ if(!m.has(x)){ m.set(x,d+1); q.push([x,d+1]); } } } return m; }
let state={sel:null,mode:"both"};
let PHEAD="";
// what kind of thing it is, as a shape: the word is there too, but the icon is what
// carries down a scrolled list
// What you will be doing with it, drawn as a shape. This is the medium, not the kind:
// an oral history can be a tape you play or a transcript you read, and a microphone on
// both promised audio that most of them do not have.
const MEDICON={"read":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM184,96a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,96Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,128Zm0,32a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h96A8,8,0,0,1,184,160Z\"/></svg>","book":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M208,24H72A32,32,0,0,0,40,56V224a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16H56a16,16,0,0,1,16-16H208a8,8,0,0,0,8-8V32A8,8,0,0,0,208,24Zm-8,160H72a31.82,31.82,0,0,0-16,4.29V56A16,16,0,0,1,72,40H200Z\"/></svg>","listen":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z\"/></svg>","look":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z\"/></svg>","watch":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,104H102.09L210,75.51a8,8,0,0,0,5.68-9.84l-8.16-30a15.93,15.93,0,0,0-19.42-11.13L35.81,64.74a15.75,15.75,0,0,0-9.7,7.4,15.51,15.51,0,0,0-1.55,12L32,111.56c0,.14,0,.29,0,.44v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V112A8,8,0,0,0,216,104ZM192.16,40l6,22.07-22.62,6L147.42,51.83Zm-66.69,17.6,28.12,16.24-36.94,9.75L88.53,67.37Zm-79.4,44.62-6-22.08,26.5-7L94.69,89.4ZM208,200H48V120H208v80Z\"/></svg>"};





// Laid out like a news list rather than a stack of cards: what it is and who ran it on
// top, the headline next, and the reason to read it underneath. One block, hairlines
// between, so the eye runs down the titles instead of stopping at every box.
//
// A mark per row, so the eye has something to land on. Real favicons would be better
// and are not available: nothing in this session can reach those hosts, and hotlinking
// them would break the installed copy offline and tell every publisher who is reading.
// So the mark is drawn from the data: the source's own initials, in the medium's colour.
const RD_SKIP=/^(the|of|and|a|an|for|on|in|at|de|la)$/i;
const rdCap = t => t.charAt(0).toUpperCase() + t.slice(1);
const rdMono = p => {
  const t = p.replace(/^the\s+/i,"").trim();
  if(/^[A-Z0-9][A-Z0-9&.']{1,3}$/.test(t)) return t;            // NPR, PBS, KQED, SPIN
  const w = t.split(/[\s/.-]+/).filter(x=>x && !RD_SKIP.test(x));
  if(w.length>=2) return w.slice(0,3).map(x=>x[0]).join("").toUpperCase();
  return (w[0]||t).slice(0,2).replace(/^./,c=>c.toUpperCase());
};
// one source, as a row. Lifted out of readSect so the guest-picks page can draw the very
// same row rather than a second rendering of the same facts that drifts from this one.
function readRow(r){
  const kind = esc(r[4]);
  // the icon carries the medium; the word is added only where it is a promise the kind
  // does not already make, so no row ever reads "Audio Listen"
  const SAY={listen:"Listen",watch:"Watch"};
  const say = SAY[r[7]] && !/^(audio|documentary)$/.test(r[4]) ? SAY[r[7]] : "";
  // a 33 1/3 is one short book about one record, which makes it the narrowest door into
  // a style there is, so it gets the series badge and a record instead of a shelf
  const ser = r[4]==="33 1/3";
  // every one of these carried the same sentence, which told you nothing a glance at
  // the badge did not. The artist is the fact a title alone withholds (Psychocandy is
  // not much use without The Jesus and Mary Chain), so it takes the kicker, the badge
  // is left to the tile that already draws it, and the note goes.
  // a series row spends its kicker on the record, which the title alone withholds, and
  // drops the year: the badge and the author are enough to know what you are opening,
  // and three facts ran the line onto a second one.
  const who = typeof pickerOf==="function" ? pickerOf(r[0]) : "";
  const p = who && pickers()[who];
  const kicker = (ser
      ? (r[8] ? `<i class="rdk rdby">${esc(r[8])}</i> \u00b7 ${esc(r[2])}`
              : `${esc(r[2])}` + (r[3] ? ` \u00b7 ${r[3]}` : ""))
      : `<i class="rdk">${esc(rdCap(r[4]))}</i>`
        + (say ? ` <i class="rdv">${say}</i>` : "")
        // a year only when there is one: plenty of what is worth reading or watching
        // carries no date, and a dangling separator is worse than a missing fact
        + ` \u00b7 ${esc(r[2])}` + (r[3] ? ` \u00b7 ${r[3]}` : ""))
    + (r[5] ? ` <i class="rdw">${esc(rdCap(r[5]))}</i>` : "");
  return `<a class="rd rd-${ser?"series":esc(r[7])}${p?" rdpick":""}" href="${esc(r[0])}" target="_blank" rel="noopener noreferrer" title="${kind}, ${esc(r[7])}">`
    + `<i class="rdi">${ser ? `<b class="rdser">33\u2153</b>`
        : r[7]==="book" ? MEDICON.book
        : (m=>`<b class="rdmo${m.length>3?" wide":""}">${esc(m)}</b>`)(rdMono(r[2]))}</i>`
    + `<span class="rdx"><span class="rdm">${kicker}</span>`
    + `<span class="rdt">${esc(r[1])}</span>`
    + (r[6] ? `<span class="rdn">${esc(r[6])}</span>` : "")
    // whose pick it is, said on the row itself. A guest section nobody has visited is a
    // section nobody knows about; the credit is what sends them there.
    + (p ? `<span class="rdpb">${pickerAvatar(p,"")}`
         + `<span>${esc(p.name)}\u2019s pick</span></span>` : "")
    + `</span></a>`;
}
function readSect(n){
  const rows = (typeof READ!=="undefined" && READ[n.id]) || [];
  if(!rows.length) return "";
  return sect("read","Go deeper",`<div class="reads">${rows.map(readRow).join("")}</div>`,
    `<span class="sectaside">${rows.length} ${rows.length===1?"source":"sources"}</span>`);
}

function sect(key,label,html,aside,page,lede,seeall,fold){
  // a heading that opens a fuller version of what is under it becomes the control that
  // opens it, chevron and all, rather than sitting beside a separate row that does
  const inner = `<h3 class="secttl">${esc(label)}</h3>${aside||""}`
    + (page?`<span class="sectcv">${seeall?`<b class="seeall">See all</b>`:""}${GOCHEV}</span>`:"");
  const head = label
    ? (page ? `<button type="button" class="secthead sectgo" data-page="${esc(page)}"
         aria-label="${esc(label)}, see all">${inner}</button>`
             : `<div class="secthead">${inner}</div>`)
    : "";
  // One line under the heading saying what the section is for. It reads as part of the
  // heading rather than as content, so the heading tightens up to meet it.
  const sub = lede ? `<p class="sectlede">${esc(lede)}</p>` : "";
  // A section that folds. The heading becomes the control, as it does when a heading
  // opens a page, except that what it opens is itself. "shut" or "open" says where it
  // starts; everything else about it is a section like any other.
  if(fold) return `<details class="sect sect-${key} sectfold${lede?" haslede":""}"`
    + `${fold==="open"?" open":""}><summary class="secthead sectsum">`
    + `<h3 class="secttl">${esc(label)}</h3>${aside||""}`
    + `<span class="sectcv">${FOLDTRI}</span></summary>`
    + sub + `<div class="secbody">${html}</div></details>`;
  return `<div class="sect sect-${key}${label?"":" nohead"}${lede?" haslede":""}">`
    + head + sub + `<div class="secbody">${html}</div></div>`;
}
const HOPS=2; // generations of lineage drawn on the map
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// center a node in the part of the map that is actually visible:
// the lane strip is pinned at the left, the toolbar and axis sit over the top
// How much of the map the floating sheet covers. Zero on desktop, where the panel is a
// docked column beside the map rather than over it.
function sheetCover(){
  if(!OVERLAY) return 0;
  const el=$("panel");
  if(!el || document.body.classList.contains("sheetgone")) return 0;
  const r=el.getBoundingClientRect(), s=scroller.getBoundingClientRect();
  return Math.max(0, Math.round(s.bottom - r.top));
}
function centerOn(n,smooth,onlyIfNeeded){
  const padL = LABELW, padT = BAR()+AXH;
  const availW = Math.max(40, scroller.clientWidth - padL);
  // centre in the band still showing, not in the scroller, or the style lands behind the sheet
  const availH = Math.max(40, scroller.clientHeight - padT - sheetCover());
  if(onlyIfNeeded){
    // a tap on the map shouldn't slide the map out from under the next tap:
    // leave it alone while the style sits in the middle of what's visible
    const vx = n.x - scroller.scrollLeft - padL, vy = n.y - scroller.scrollTop;
    const mx = availW*.22, my = availH*.22;
    if(vx>mx && vx<availW-mx && vy>my && vy<availH-my) return;
  }
  scroller.scrollTo({
    left: Math.max(0, n.x - padL - availW/2),
    top:  Math.max(0, n.y - availH/2),
    behavior:(smooth&&!reduce)?"smooth":"auto"
  });
}

// repaint:false keeps the panel's DOM as it is and only redraws the map highlighting.
// resizing and zooming use it, so the cover <img> isn't torn down and reloaded (which flickers).
// A view is where the user was: a style, or the overview with whatever listening mode
// they had open. Four taps into a lineage it is easy to lose the way out, so every real
// change of view drops a crumb and the floating button walks back down the trail.
const TRAIL=[], TRAILMAX=30;
// The crumb carries where you were reading, not only what you were reading. Back used to
// rebuild Explore and drop you at the top of it, so a style opened from halfway down a
// list cost you your place in that list on the way out. pushTrail() runs before the view
// changes, so the panel is still showing the outgoing page when this measures it.
function hereNow(){
  const b=$("panelBody");
  // Not simply where the body is scrolled to. If a page is pushed, the body is showing
  // that page and sits near its top, while the place the user will come back to is the
  // root underneath it. PSTACK's first entry recorded exactly that offset on the way in,
  // which is why Explore scrolled halfway down, then Ways in, then a style, then back
  // used to land at the top of a list the user had already walked.
  const root = PSTACK.length ? (PSTACK[0].scroll||0) : (b?b.scrollTop:0);
  // Which page was open, not only what was selected. Opening a style calls resetPages(),
  // so by the time back runs the stack is gone; without this the crumb could only ever
  // point at the root, and leaving a mood to look at one of its styles cost you the mood.
  const top = PSTACK.length ? PSTACK[PSTACK.length-1] : null;
  return {sel:state.sel||null, mode:(typeof MODE!=="undefined"&&MODE)||null, scroll:root,
    page: top ? top.key : null, pageScroll: top && b ? b.scrollTop : 0}; }
function pushTrail(){
  const v=hereNow(), last=TRAIL[TRAIL.length-1];
  if(last && last.sel===v.sel && last.mode===v.mode) return;   // nothing actually changed
  TRAIL.push(v); if(TRAIL.length>TRAILMAX) TRAIL.shift();
  syncBack();
}
let GOINGBACK=false;
function goBack(){
  closeNav();
  const v=TRAIL.pop(); if(!v) return;
  GOINGBACK=true;
  try{
    if(typeof MODE!=="undefined") MODE=v.mode;
    if(v.sel && byId[v.sel]) select(v.sel,{scroll:true,smooth:!reduce});
    else clearSel();
  } finally { GOINGBACK=false; }
  // after the rebuild, not before: both branches replace the panel's contents, and a
  // scrollTop set on the old DOM is thrown away with it. The height has to exist before
  // the browser will accept the offset, so clamp rather than trust it.
  //
  // Explore is the exception, and always opens at the top. Coming back to a style you
  // were reading, mid-page is where you were and landing there is the point. Coming back
  // to Explore you are arriving at the front of the app, and a front page that starts
  // halfway down looks broken rather than considerate: the heading is gone, the list
  // begins mid-sentence, and there is nothing above to explain it.
  //
  // A page you had open is reopened before any of that, because it is the thing you were
  // actually looking at and the root underneath it is not where you were.
  let onPage=false;
  if(v.page){ GOINGBACK=true; try{ onPage=pushPage(v.page); } finally { GOINGBACK=false; } }
  const b=$("panelBody");
  const keep = onPage ? (v.pageScroll||0)
    : v.sel && byId[v.sel] ? (v.scroll||0) : 0;
  if(b){
    let applied=-1;
    const put=()=>{ applied = keep?Math.min(keep,Math.max(0,b.scrollHeight-b.clientHeight)):0;
      b.scrollTop=applied; b.dispatchEvent(new Event("scroll")); };
    put(); requestAnimationFrame(put);
  }
  syncBack();
}
function backLabel(){
  const v=TRAIL[TRAIL.length-1]; if(!v) return "";
  // a page is what you were looking at, so it is what the button should promise
  if(v.page){
    const t=pageTitleOf(v.page);
    if(t) return "Back to "+t;
  }
  if(!v.sel) return "Back to the map";
  const n=byId[v.sel];
  return n ? "Back to "+n.name : "Back";
}
// the title without building the page: modePage() and mediaPage() render their whole body
function pageTitleOf(key){
  if(key.indexOf("mode:")===0){
    const m=typeof MODES!=="undefined" && MODES.find(x=>x[0]===key.slice(5));
    return m ? m[2] : "";
  }
  const d=PAGES_DEF[key];
  if(!d) return "";
  try{ const p=d(); return p ? p.title : ""; }catch(e){ return ""; }
}
// back presses needed to reach the overview. The map may not be in the trail at all,
// which happens on a shared link, and that is exactly when the shortcut earns its place.
function goHome(){
  if(!state.sel) return;
  TRAIL.length=0;                    // home is a reset, not another step: back goes with it
  if(typeof MODE!=="undefined") MODE=null;
  GOINGBACK=true;
  try{ clearSel(); } finally { GOINGBACK=false; }
  syncBack();
  // and the panel comes up with it. Clearing the selection already rebuilt the panel as
  // Explore; leaving it minimised meant the button looked like it had only emptied the
  // map, with the thing it had just built hidden behind a handle. On a wide screen the
  // panel is always open and this does nothing.
  setOpen(true);
}
function syncBack(){
  // the root pill stays over the map whenever you are not looking at the unselected
  // root, so there is always one tap back to the whole picture
  // a disabled pill sitting over the lane strip is a control that does nothing taking up
  // the one corner the map has: it goes when there is nowhere to go back to
  const hm=$("mapHome");
  if(hm){ hm.hidden = !state.sel; hm.disabled = false; }
  // back itself lives in the panel now, where it is not sitting beside a From button
  const b=$("panelBack"); if(!b) return;
  // a pushed page owns the back button while it is up: it is the nearer thing to leave
  if(PSTACK.length){
    const under = PSTACK.length>1 ? PSTACK[PSTACK.length-2].title : (state.sel ? byId[state.sel].name : "Music Atlas");
    b.hidden=false; b.setAttribute("aria-label","Back to "+under); b.setAttribute("title","Back to "+under);
    const t0=b.querySelector(".bklbl"); if(t0) t0.textContent=under;
    b.classList.remove("tomap"); b.classList.add("topage");
    return;
  }
  const l=backLabel();
  b.hidden=!l; if(!l) return;
  b.setAttribute("aria-label",l); b.setAttribute("title",l);
  b.classList.remove("topage");
  const v=TRAIL[TRAIL.length-1];
  // a page in the crumb is a named place, so the button names it rather than going bare:
  // leaving a mood for one of its styles, back belongs to the mood, not to the map
  const pt=v&&v.page ? pageTitleOf(v.page) : "";
  const toMap=!pt && !(v&&v.sel&&byId[v.sel]);
  const t=b.querySelector(".bklbl");
  if(t) t.textContent = pt || (toMap ? "" : byId[v.sel].name);
  b.classList.toggle("tomap",toMap);
}
function select(id,{scroll=true,smooth=true,keepPlace=false,repaint=true}={}){
  if(!byId[id]) return;
  const switched = state.sel!==id;
  if(switched && !GOINGBACK){ pushTrail(); bumpStyle(id); }
  state.sel=id; closeNav();
  // only a real change of style brings a dismissed sheet back; re-selects from
  // resize, zoom and setOpen must leave it where the user put it
  if(switched) restoreSheet();
  syncPull();
  const n=byId[id];
  const anc=walk(id,"parents"), desc=walk(id,"children");
  // the map highlights two generations each way; the panel still lists the full ancestry
  const near=m=>new Map([...m].filter(([,d])=>d<=HOPS));
  const ancV=near(anc), descV=near(desc);
  const showA = state.mode!=="desc", showD = state.mode!=="anc";
  const on=new Set([id]); if(showA) ancV.forEach((_,k)=>on.add(k)); if(showD) descV.forEach((_,k)=>on.add(k));
  const svg=$("chart"); svg.classList.add("sel");
  const depth=k=>Math.min(showA&&ancV.has(k)?ancV.get(k):99, showD&&descV.has(k)?descV.get(k):99);
  svg.querySelectorAll(".n").forEach(g=>{ const k=g.dataset.id, dp=k===id?0:depth(k); g.classList.toggle("on",on.has(k)); g.classList.toggle("cur",k===id); g.classList.toggle("d2",dp===2); g.classList.toggle("d3",dp>=3&&dp<99); });
  svg.querySelectorAll(".e").forEach(e=>{
    const p=e.dataset.p, c=e.dataset.c;
    const a = showA && ancV.has(p) && (c===id||ancV.has(c));
    const d = showD && descV.has(c) && (p===id||descV.has(p));
    e.classList.toggle("on",a||d);
    e.classList.toggle("dir",(a&&c===id)||(d&&p===id));
    const ed = a ? ancV.get(p) : d ? descV.get(c) : 0;
    e.classList.toggle("d2",ed===2); e.classList.toggle("d3",ed>=3);
  });
  const cur=svg.querySelector(`.n[data-id="${id}"]`); if(cur) cur.parentNode.appendChild(cur);
  const fams=new Set([...on].map(k=>byId[k].fam));
  // [data-fam], so the filler above the first family is never dimmed along with them
  $("lanes").querySelectorAll(".lane[data-fam]").forEach(l=>l.classList.toggle("dim",!fams.has(l.dataset.fam)));
  const fromNote=n.note.replace(/^[^:]{0,40}:\s*/,"").split(/;|\s·\s/)[0].replace(/\s*\([^)]*\)/g,"").replace(/'[^']*'/g,"").replace(/\s+,/g,",").replace(/,\s*,/g,",").replace(/\s{2,}/g," ").trim().replace(/^,|,$/g,"");
  // a note that is just a list of names becomes the artist list; prose stays a note
  const JOIN=new Set(["in","the","of","and","a","an","on","at","for","to","de","la","le","du","des","el","y"]);
  const titleish = s=>{ const w=s.split(/\s+/); return w.length<=6 && w.every(x=> x==="&" || x==="+" || /^[("\u2018\u201c]*[A-Z0-9]/.test(x) || JOIN.has(x.toLowerCase().replace(/[^a-z]/g,""))); };
  const items = fromNote ? fromNote.split(",").map(s=>s.trim()).filter(Boolean) : [];
  const prose = /(?:^|\s)[a-z]+ed\b.*\bin\b/.test(fromNote||"")            // lowercase verb: prose, not a name
    || /\bvia\b|\bfrom\b|\bscene\b|\bera\b|\bstyle\b|\bmusic\b/i.test(fromNote||"");
  const looksLikeArtists = items.length>=1 && !prose && items.every(titleish);
  // Notes often open with where a style came from: "UK; named by Whistla 2009" or
  // "Johannesburg; three kicks per bar". The head before the semicolon is usually the
  // artist list, so that is what this reads, and a place at the front was being drawn as
  // a key artist. A single-word rule would have been wrong: Nirvana, Prince, Chic, Burial
  // and 240 others are one word. So the places are named instead.
  const PLACE=/^(UK|US|USA|US\/UK|Japan|Ghana|Trinidad|Jamaica|Dominican|Rotterdam|Durban|Johannesburg|Lagos|Medellín|Berlin\/Milan|Goa|India|South Africa|1080p)$|-led$/i;
  n.noteNames = looksLikeArtists ? fromNote.split(",").map(s=>s.trim()).filter(x=>x&&!PLACE.test(x)) : [];
  n.prose = looksLikeArtists ? "" : (n.note||"");
  const whoList = [...new Set([...n.noteNames,...n.artists])];
  n.whoList = whoList;
  // back on the left, the two lineage menus paired on the right. Back used to float over
  // the map beside the root pill, where it sat next to a From button that also pointed
  // left and meant something else entirely.
  PHEAD = `<div class="pcard"><div class="navrow">`
    + `<button id="panelBack" class="navback" type="button" hidden aria-label="Back" title="Back">`
    + `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10H4.6"/><path d="M9.4 4.6L4 10l5.4 5.4"/></svg>`
    + `<span class="bklbl"></span>`
    + `<svg class="bkmap" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 5.6 7.4 3.6v10.8l-4.6 2z"/><path d="M7.4 3.6 12.6 5.6v10.8L7.4 14.4z"/><path d="M12.6 5.6 17.2 3.6v10.8l-4.6 2z"/></svg></button>`
    + `<div class="navttl navgap ovttl"><span class="mn"></span></div>`
    + CLOSEBTN
    + `</div>`;                       // .pcard stays open: .more goes inside it, so the
                                      // sticky header has the whole card to stick within
  setExpandLabel("", `${n.parents.length} from · ${n.children.length} led to`, `${n.parents.length} from · ${n.children.length} led to`);
  if(repaint){
    panel(n,anc,desc); amUpgrade();
    setPbar(n.name, n.year<1950?n.disp:"c. "+n.year);
  }
  sizeCard();
  setTint(n.fam);
  setHash(id); syncShare(); syncBack();
  if(scroll) centerOn(n,smooth,keepPlace);
}

// ---------- panel open / close ----------
let OPEN=false;
function ICONSRC(){const l=document.querySelector('link[rel="apple-touch-icon"]')||document.querySelector('link[rel="icon"]');return l?l.href:"";}
function setExpandLabel(name,tail,shortTail){ const b=$("expand"); b.dataset.name=name; b.dataset.tail=tail||""; b.dataset.stail=shortTail===undefined?(tail||""):shortTail; b.title=(name+(tail?" · "+tail:"")); if(!OPEN) paintExpand(); }
function paintExpand(){ const b=$("expand"), l=b.querySelector(".lbl"); if(!l) return;
  if(OPEN){ l.innerHTML="Close"; return; }
  const n0=b.dataset.name||"", nm=n0?`<b>${esc(n0)}</b>`:"", sep=n0?" · ":"", t=b.dataset.tail, s=b.dataset.stail;
  l.innerHTML = `<span class="long">${nm}${t?`<span class="ct">${sep}${esc(t)}</span>`:""}</span>`
              + `<span class="short">${nm}${s?`<span class="ct">${sep}${esc(s)}</span>`:""}</span>`; }
// The sheet's two states are height:auto and height:70vh, and no browser interpolates
// to or from auto, so the CSS transition never ran and the change read as a jump. Measure
// both ends in pixels, animate between them, then hand the height back to the stylesheet
// so later content changes still size it.
let GLIDING=false;
function glideSheet(from){
  const el=$("panel"); if(!el) return;
  el.style.transition="none";
  el.style.maxHeight=""; el.style.height="";   // let the stylesheet state its target
  const to=el.offsetHeight;
  if(Math.abs(to-from)<2){ el.style.transition=""; GLIDING=false; return; }
  GLIDING=true;
  // the minimised state caps the sheet at 46vh, which would clamp the open height away
  // before the first frame and leave nothing to animate. The cap is off for the duration.
  el.style.maxHeight="none";
  el.style.height=from+"px";
  el.getBoundingClientRect();               // flush, so the next value is a change to animate
  el.style.transition="";
  requestAnimationFrame(()=>{
    el.style.height=to+"px";
    const done=e=>{ if(e.target!==el||e.propertyName!=="height") return;
      el.removeEventListener("transitionend",done); GLIDING=false; el.style.height=""; el.style.maxHeight=""; };
    el.addEventListener("transitionend",done);
    setTimeout(()=>{ el.removeEventListener("transitionend",done); GLIDING=false; el.style.height=""; el.style.maxHeight=""; },600);
  });
}
function setOpen(v){
  const glide = OVERLAY && !reduce;
  const from = glide ? Math.round($("panel").getBoundingClientRect().height) : 0;
  // The peek height can only be read while the sheet is in it, and the two moments that
  // used to catch it, load and 300ms, both arrive with the sheet already up now that the
  // app opens on Explore. So MINH stayed 0 and sheetMin() fell back to its 170 guess,
  // which moves the halfway point a drag has to cross from 489px to 380px: pushing the
  // sheet down stopped working until you had dragged it most of the way to the floor.
  // Here is the one moment it is still there to measure, on the way past.
  if(v && !OPEN && OVERLAY){
    const h = Math.round($("panel").getBoundingClientRect().height);
    if(h) MINH = h;
  }
  setOpenNow(v);
  if(glide) glideSheet(from);
}
function setOpenNow(v){ closeNav(); OPEN=v; setTimeout(sizeCard,0); setTimeout(syncMapPad,0); setTimeout(syncMapPad,380); if(OVERLAY && state.sel) setTimeout(()=>{ if(state.sel) select(state.sel,{scroll:true,smooth:!reduce,repaint:false}) },260); $("panel").classList.toggle("open",v); document.body.classList.toggle("open",v); $("expand").setAttribute("aria-expanded",v); $("expand").setAttribute("aria-label",v?"Hide details":"Show details"); $("pclose").setAttribute("aria-label",v?"Collapse details":"Expand details"); { const g=$("grab"); if(g){ g.setAttribute("aria-expanded",String(v)); g.setAttribute("aria-label",v?"Collapse details":"Expand details"); } } paintExpand(); if(v) $("panel").scrollTop=0; }
function openPanel(){ setOpen(true); }
function closePanel(){ setOpen(false); }
function syncPeek(){}
$("expand").onclick=()=>setOpen(!OPEN);
// on phones the sheet reacts to scrolling: swipe up to open it, pull down past the top to put it away
(function(){
  const el=$("panel"), body=$("panelBody"); if(!el||!body) return;
  let y0=0, x0=0;
  const atTop=()=> body.scrollTop<=0;
  el.addEventListener("touchstart",e=>{ y0=e.touches[0].clientY; x0=e.touches[0].clientX; },{passive:true});
  el.addEventListener("touchmove",e=>{
    if(!OVERLAY || DRAGGING || e.target.closest("#grab")) return;
    const t=e.touches[0], dy=t.clientY-y0;            // positive = finger moving down
    if(!OPEN){ if(dy<-20){ setOpen(true); y0=t.clientY; } return; }
    // a sideways swipe over a row of chips is not a pull
    if(Math.abs(t.clientX-x0) > Math.abs(dy)) return;
    // while there is still content above, the pull scrolls instead: keep the reference under
    // the finger so the distance is measured from the moment the top is actually reached,
    // and one continuous pull from halfway down the sheet still closes it
    if(!atTop()){ y0=t.clientY; return; }
    if(dy>44){ setOpen(false); y0=t.clientY; }
  },{passive:true});
  // trackpads and mice get the same behaviour in a narrow window
  let acc=0, t=0;
  el.addEventListener("wheel",e=>{
    if(!OVERLAY || DRAGGING) return;
    const now=Date.now(); if(now-t>400) acc=0; t=now; acc+=e.deltaY;
    if(!OPEN && acc>24){ setOpen(true); acc=0; }
    else if(OPEN && atTop() && acc<-80){ setOpen(false); acc=0; }
  },{passive:true});
})();
// once the panel scrolls, swap the search field for an icon and keep the style's name in view
let PBAR={t:"",s:""};
function setPbar(t,s){ PBAR={t:t||"",s:s||""}; const a1=$("pbarTitle"), a2=$("pbarSub"); if(a1) a1.textContent=PBAR.t; if(a2) a2.textContent=PBAR.s; }
(function(){
  const body=$("panelBody"), bar=$("pbar"), btn=$("mapSearch"); if(!body||!bar) return;
  // the big title scrolling under the bar is what brings the compact one in, the way a
  // phone app hands a screen's name to its header. Measured rather than guessed at a
  // pixel count, since the title is one line on some pages and three on others.
  // Read the whole frame before writing any of it. This used to set a class on <body> and
  // then immediately ask two elements where they were, which is a write followed by a read
  // and forces the layout it just invalidated — on every scroll event, against a document
  // that holds a 461-node map. The frame where the handover lands cost 56ms, which is the
  // hitch near the top: the one place where the class actually changes.
  let pending=0, lastTop=-1;
  const measure=()=>{
    const pages=[...body.querySelectorAll(".ppage")].filter(x=>!x.hidden);
    const big=(pages[0]||body).querySelector(".bigttl, .pttl");
    const nav=body.querySelector(".pcard .navrow");
    const cls=$("panel").classList;
    return {big, nav, top:body.scrollTop,
      // Hand over as the big title starts going under the bar, not after it has gone.
      // Keyed on its bottom, there was a 30px band of scroll where the title was behind
      // the bar and the compact one had not come in yet: a blank white header with nothing
      // but a close button. Keyed on its top, the compact one arrives as the big one
      // starts to disappear. The 6px is hysteresis, so a title resting exactly on the
      // line cannot flicker.
      ttl: big&&nav ? (()=>{ const t=big.getBoundingClientRect().top,
          b=nav.getBoundingClientRect().bottom;
        return cls.contains("barttl") ? t < b+6 : t <= b; })() : cls.contains("barttl")};
  };
  const apply=m=>{
    const cls=$("panel").classList;
    // Only touch a class that is actually changing. Setting one that is already there is
    // cheap, but it is not free, and neither is the style recalc it can schedule.
    const scrolled=m.top>2;
    if(cls.contains("pscrolled")!==scrolled) cls.toggle("pscrolled",scrolled);
    if(cls.contains("barttl")!==m.ttl) cls.toggle("barttl",m.ttl);
    const slot=m.nav&&m.nav.querySelector(".navttl.ovttl .mn");
    if(slot&&m.big){ const t=(m.big.querySelector(".mn, .ptnm")||m.big).textContent.trim();
      if(slot.textContent!==t) slot.textContent=t; }
  };
  const sync=()=>{ apply(measure()); };
  // One pass per frame. A scroll fires faster than the screen repaints, and every extra
  // pass was another forced layout for a state that had not changed yet.
  const onScroll=()=>{
    if(pending) return;
    pending=requestAnimationFrame(()=>{ pending=0;
      const t=body.scrollTop;
      if(t===lastTop) return;
      lastTop=t; sync();
    });
  };
  body.addEventListener("scroll",onScroll,{passive:true});
  addEventListener("resize",sync);
  if(btn){
    btn.addEventListener("click",openSearch);
    // iOS needs focus inside the gesture, but only treat it as a tap: a touch that
    // moves (the start of a scroll) must not open search
    let tp=null;
    btn.addEventListener("touchstart",e=>{ const t=e.touches[0]; tp=t?{x:t.clientX,y:t.clientY}:null; },{passive:true});
    btn.addEventListener("touchmove",e=>{ const t=e.touches[0]; if(tp&&t&&(Math.abs(t.clientX-tp.x)>8||Math.abs(t.clientY-tp.y)>8)) tp=null; },{passive:true});
    btn.addEventListener("touchcancel",()=>{ tp=null; },{passive:true});
    btn.addEventListener("touchend",e=>{ if(!tp) return; tp=null; e.preventDefault(); openSearch(); },{passive:false});
  }
  setTimeout(sync,200);
})();
// the sheet's grab handle: tap toggles, a vertical drag resizes and snaps to the nearer state
let MINH=0, DRAGGING=false;
const dismissable = ()=> OVERLAY && !OPEN;
// closing remembers whether the sheet was open or peeking, so reopening gives back the
// state it was put away in rather than always the smallest one
let WASOPEN=false;
function dismissSheet(){ WASOPEN=OPEN; syncPull(); document.body.classList.add("sheetgone"); setOpen(false); }
function restoreSheet(){ document.body.classList.remove("sheetgone"); if(WASOPEN) setOpen(true); }
function syncPull(){ const el=$("sheetpull"); if(!el) return; const l=el.querySelector(".plbl"); if(!l) return;
  const n=state.sel&&byId[state.sel];
  l.textContent = n ? n.name : "Music Atlas";
  el.setAttribute("aria-label", n ? "Show details for "+n.name : "Show the map details");
  el.setAttribute("title", l.textContent);
  // wear the family ground the panel is painted with; its inline vars survive display:none
  const pan=$("panel");
  const tint=pan?pan.style.getPropertyValue("--tint").trim():"";
  const ink=pan?pan.style.getPropertyValue("--ink").trim():"";
  if(tint&&ink){ el.style.setProperty("--pullbg",tint); el.style.setProperty("--pullfg",ink); }
  else { el.style.removeProperty("--pullbg"); el.style.removeProperty("--pullfg"); } }
function sheetMin(){ return MINH || 170; }
// the ceiling has to be the height the open state actually uses, or dragging up from an
// open sheet pulls it down to the ceiling instead
function sheetMax(){ return Math.round(innerHeight*0.7); }
(function(){
  const g=$("grab"), el=$("panel"); if(!el) return;
  let y0=0, h0=0, t0=0, active=false, tapToggles=false;
  const measureMin=()=>{ if(!OPEN && OVERLAY) MINH=el.offsetHeight; };
  addEventListener("load",measureMin); setTimeout(measureMin,300);

  // one gesture, two places to start it: the handle, and the card's header, which is the
  // part of an open sheet a thumb lands on. A drag from the header must not also fire the
  // share button underneath it, so the click after a real drag is swallowed.
  function begin(e,toggles){
    if(!OVERLAY || active) return;
    active=true; DRAGGING=false; tapToggles=toggles;
    y0=e.clientY; h0=el.offsetHeight; t0=Date.now();
    addEventListener("pointermove",move,{passive:false});
    addEventListener("pointerup",end); addEventListener("pointercancel",end);
  }
  function move(e){
    if(!active) return;
    const dy=y0-e.clientY;
    if(!DRAGGING && Math.abs(dy)<4) return;
    if(!DRAGGING){ DRAGGING=true; document.body.classList.add("dragging"); }
    if(e.cancelable) e.preventDefault();
    const floor = dismissable() ? 0 : sheetMin();
    el.style.height=Math.max(floor, Math.min(sheetMax(), h0+dy))+"px";
    syncMapPad();
  }
  function end(e){
    if(!active) return; active=false;
    removeEventListener("pointermove",move); removeEventListener("pointerup",end); removeEventListener("pointercancel",end);
    const dt=Date.now()-t0, dy=y0-e.clientY;
    const hNow=el.offsetHeight;
    document.body.classList.remove("dragging");
    if(!DRAGGING){                                   // a tap, not a drag
      el.style.height="";
      if(tapToggles) setOpen(!OPEN);                 // the header lets its own click through
      DRAGGING=false; return;
    }
    DRAGGING=false;
    swallowClick();
    const flick = dt<260 && Math.abs(dy)>24;                   // quick flick wins over position
    // the inline height stays on until setOpen has read it, so the snap continues
    // from where the finger let go instead of starting over from the CSS value
    if(dismissable() && (flick ? dy<0 : hNow < sheetMin()*0.62)){ el.style.height=""; dismissSheet(); return; }
    const open = flick ? dy>0 : hNow > (sheetMin()+sheetMax())/2;
    setOpen(open);
  }
  function swallowClick(){
    const eat=ev=>{ ev.preventDefault(); ev.stopPropagation(); };
    addEventListener("click",eat,true);
    setTimeout(()=>removeEventListener("click",eat,true),0);
  }
  if(g){
    g.addEventListener("pointerdown",e=>{ begin(e,true); });
    g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setOpen(!OPEN); } });
  }
  // delegated, because the card is rebuilt on every selection
  el.addEventListener("pointerdown",e=>{
    if(!OPEN || e.target.closest("#grab")) return;
    // the overview used to be the only card with a .phead, so this gesture lived there
    // alone. Both cards carry the same .navrow now, so it works on either. The root's row
    // holds no controls any more and is 13px tall, so its large title is part of the grip.
    if(!e.target.closest(".pcard .navrow") && !e.target.closest(".ovcard .bigttl")) return;
    begin(e,false);
  });
})();
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ if(!$("wikiwrap").hidden){ closeWiki(); return; } if(popPage()) return; if(OPEN) closePanel(); else if(state.sel&&document.activeElement!==$("q")) clearSel(); } });

const chip = (id,extra)=>{ const n=byId[id]; const yr=n.year<1950?n.disp:n.year;
  const tip=esc(n.name+" · "+yr+(extra?" · "+extra:"")+(n.done?" · playlist":""));
  return `<button class="chip c" style="--c:${FAM[n.fam].c}" data-go="${n.id}" title="${tip}" aria-label="${tip}"><i class="nm">${esc(n.name)}</i><span title="Styles it led to">${n.children.length}</span></button>`; };
// a small mark on the year line: enough to read as tappable without pulling the
// style name off centre, which the grid works hard to keep it on
const SHAREGLYPH="<svg class=\"shg\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,112v96a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V112A16,16,0,0,1,56,96H80a8,8,0,0,1,0,16H56v96H200V112H176a8,8,0,0,1,0-16h24A16,16,0,0,1,216,112ZM93.66,69.66,120,43.31V136a8,8,0,0,0,16,0V43.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,69.66Z\"/></svg>";
const CHEV={from:"<svg class=\"cv\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z\"/></svg>",led:"<svg class=\"cv\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z\"/></svg>"};
function navBtn(kind,ids){
  const label = kind==="from" ? "From" : kind==="roots" ? "Roots" : "Led to";
  const n=ids.length;
  const title = kind==="roots" ? `Roots: ${n} styles with nothing before them here`
    : n ? `${label}: ${n} ${n===1?"style":"styles"}` : (kind==="from"?"A root style: nothing before it here":"Nothing grew out of this one here");
  const items = ids.map(id=>{ const x=byId[id];
    return `<button type="button" role="menuitem" data-go="${x.id}"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.year<1950?esc(x.disp):x.year}</small></button>`;
  }).join("");
  return `<div class="navwrap nav-${kind}">`
    + `<button type="button" class="navbtn" data-menu="${kind}" aria-haspopup="menu" aria-expanded="false"`
    + ` title="${esc(title)}" aria-label="${esc(title)}"${n?"":" disabled"}>`
    + (kind==="from"?CHEV.from:"")
    + `<em class="ct">${n}</em>`
    + (kind==="led"||kind==="roots"?CHEV.led:"")
    + `</button>`
    + (n?`<div class="navmenu" role="menu" hidden><div class="navhd">${label}</div>${items}</div>`:"")
    + `</div>`;
}
const chips = ids=> ids.length ? `<div class="chips">${ids.map(id=>chip(id)).join("")}</div>` : `<p class="empty">None in this map.</p>`;
const byYear = (a,b)=>byId[a].year-byId[b].year||byId[a].name.localeCompare(byId[b].name);

function noteHtml(n){
  const names=[...new Set([...(n.noteNames||[]),...n.artists])].filter(x=>x.length>2).sort((a,b)=>b.length-a.length);
  if(!names.length) return esc(n.note);
  const re=new RegExp("(?<!\\w)("+names.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")(?!\\w)","g");
  return n.note.split(re).map((s,i)=>i%2?am(s):esc(s)).join("");
}
// playlist and key artists are two subdivisions of one Listen section, with the
// service switch in its header governing both
const SVCCHEV="<svg class=\"svcchev\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z\"/></svg>";
// Both the tooltip and the label say the choice sticks. A setting that looks like a
// filter is one people re-set on every panel, and this one is neither per style nor per
// visit: it is the whole app's, kept on this device until it is changed again.
const SVCTIP="Where playlists and artists open. Kept on this device until you change it.";
function svcPicker(kind){ return `<span class="svc${kind==="inline"?" svcinline":""}"`
  + ` title="${esc(SVCTIP)}">`
  + `<span class="svctx">${esc(svcName())}</span>${SVCCHEV}`
  + `<select class="svcsel" aria-label="Where playlists and artists open. `
  + `Kept on this device until you change it. Currently ${esc(svcName())}.">`
  + `<option value="apple"${SVC==="apple"?" selected":""}>Apple Music</option>`
  + `<option value="spotify"${SVC==="spotify"?" selected":""}>Spotify</option>`
  + `<option value="qobuz"${SVC==="qobuz"?" selected":""}>Qobuz</option>`
  + `</select></span>`; }
// one control at the top right of every panel: it puts the card away and leaves the map
// whole. The pull tab at the bottom of the screen brings it back.
const CLOSEBTN=`<button type="button" class="pmin" data-dismiss aria-label="Close this panel" title="Close this panel"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9"/><path d="M14.5 5.5l-9 9"/></svg></button>`;

// From and Led to were a segmented pill in the header, which gave the two directions of
// the whole map less room than the playlist row. They are the same grouped list the
// panel uses for its other collections, in the body, under the thing you can listen to.
function lineageRow(kind,ids){
  const n=ids.length, label = kind==="from" ? "Came from" : "Led to";
  const title = n ? `${label}: ${n} ${n===1?"style":"styles"}`
    : (kind==="from" ? "A root style: nothing before it here" : "Nothing grew out of this one here");
  const items=ids.map(id=>{ const x=byId[id];
    return `<button type="button" role="menuitem" data-go="${x.id}"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.year<1950?esc(x.disp):x.year}</small></button>`; }).join("");
  return `<div class="navwrap nav-${kind}">`
    + `<button type="button" class="listrow" data-menu="${kind}" aria-haspopup="menu" aria-expanded="false"`
    + ` title="${esc(title)}" aria-label="${esc(title)}"${n?"":" disabled"}>`
    + `<i class="lrico mi">${LINICON[kind]||""}</i>`
    + `<span class="lrlbl">${label}</span><em class="lrct">${n}</em>${n?LRCHEV:""}</button>`
    + (n?`<div class="navmenu" role="menu" hidden>${items}</div>`:"")
    + `</div>`;
}
const LINICON={"from":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M197.66,69.66,83.31,184H168a8,8,0,0,1,0,16H64a8,8,0,0,1-8-8V88a8,8,0,0,1,16,0v84.69L186.34,58.34a8,8,0,0,1,11.32,11.32Z\"/></svg>","led":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z\"/></svg>"};
function lineageSect(n){
  // one row, two halves: the directions are a pair and read as one control that way
  return sect("lineage","",`<div class="listgrp two">`
    + lineageRow("from",[...n.parents].sort(byYear))
    + lineageRow("led",[...n.children].sort(byYear))
    + `</div>`);
}
// The name is the lineage control. From and Led to were a segmented pill, then a pair of
// rows in the card; both spent a line of the panel on something the title can carry,
// since what a style came from and led to is what its name means here. One tap opens
// both lists at once, parents on the left and children on the right, which is also how
// they sit on the map.
function lineageCol(kind,ids){
  const label = kind==="from" ? "Came from" : "Led to";
  const items = ids.length
    ? ids.map(id=>{ const x=byId[id];
        return `<button type="button" role="menuitem" data-go="${x.id}"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.year<1950?esc(x.disp):x.year}</small></button>`; }).join("")
    : `<p class="lnone">${kind==="from"?"Nothing before it here":"Nothing out of it here"}</p>`;
  return `<div class="lcol lcol-${kind}"><div class="navhd">${label} <em>${ids.length}</em></div>${items}</div>`;
}
function lineageTitle(n){
  const from=[...n.parents].sort(byYear), led=[...n.children].sort(byYear);
  const t=`${from.length} came from \u00b7 ${led.length} led to`;
  return `<div class="navwrap nav-lineage">`
    + `<button type="button" class="navttl" data-menu="lineage" aria-haspopup="menu" aria-expanded="false" title="${esc(t)}" aria-label="${esc(n.name)}. ${esc(t)}">`
    + `<span class="mn">${esc(n.name)}</span>`
    + `<span class="my"><span class="yr">${n.year<1950?esc(n.disp):"c. "+n.year}</span>${LRCHEV}</span>`
    + `</button>`
    + `<div class="navmenu lineagemenu" role="menu" hidden><div class="twocol">`
    + lineageCol("from",from) + lineageCol("led",led)
    + `</div></div></div>`;
}
// every artist the map knows for a style: the three or four named on the panel, then the
// roster behind them, which 135 styles carry and nothing has ever shown until now
// the years an artist was making music: first release to last, or an open end for anyone
// still going. ACTIVE is partial by design, so a row with no entry simply shows no span
// rather than a guess, and fills in as the table does.
function activeYears(name){
  const a=(typeof ACTIVE!=="undefined" && ACTIVE[name]) || null;
  if(!a || !a[0]) return "";
  if(!a[1]) return a[0]+"\u2013";
  if(a[1]===a[0]) return String(a[0]);
  // the two-digit tail only reads right inside one century: 1959\u201321 is a wrong number
  const short = Math.floor(a[0]/100)===Math.floor(a[1]/100);
  return a[0]+"\u2013"+(short?String(a[1]).slice(-2):a[1]);
}
// An act spelled two ways is two rows on this page. The roster is lifted from playlist
// credits and the key artists are written by hand, so they disagree constantly: "The
// Kingston Trio" against "Kingston Trio", "Peter, Paul & Mary" against "Peter, Paul and
// Mary". Matching on the exact string let both through and the page listed the same
// group twice, a few rows apart. So sameness ignores a leading "The", the ampersand and
// all punctuation, and the spelling that survives is the one already on the panel.
const sameAct = s => String(s).toLowerCase()
  .replace(/[\u2018\u2019\u02bc]/g,"'")
  .replace(/\s*&\s*/g," and ")
  .replace(/^the\s+/,"")
  .replace(/[^a-z0-9]+/g," ")
  .trim();
function artistAll(n){
  const key=n.whoList||[];
  const seen=new Set(key.map(sameAct));
  const more=[];
  for(const x of (n.roster||[])){
    const k=sameAct(x); if(!k || seen.has(k)) continue;
    seen.add(k); more.push(x);
  }
  return key.concat(more);
}
function listenSect(n,who,artistsHtml){
  const pb=plist(n);
  const xs=xplayFor(n.id).map(x=>xrow(x,n.id)).join("");
  if(!pb && !xs && !who.length) return "";
  // the chips used to wrap across three ragged lines, which gave the longest name the
  // widest row and left a hole beside the shortest. One line that scrolls, with the rest
  // behind the heading, the same way the ways in work on the overview.
  // every style with artists opens a page, whether or not there is a roster behind the
  // chips: the row scrolls, so the page is also the only place the whole set sits still
  const all=artistAll(n);
  const whoHead = `<button type="button" class="subh subgo${(pb||xs)?" gap":""}" data-page="artists"`
      + ` aria-label="Key artists, see all ${all.length}">Key artists`
      + `<span class="subct">${all.length}</span><span class="sectcv">${GOCHEV}</span></button>`;
  const body = (pb||"") + xs + (who.length?whoHead+artistsHtml:"");
  const head = `<div class="secthead"><h3 class="secttl">Listen on ${svcPicker("inline")}</h3></div>`;
  return `<div class="sect sect-listen">${head}<div class="secbody">${body}</div></div>`;
}
// the share control at the foot of a style panel: in the flow under the text, not pinned
// over it, so it scrolls away with everything else rather than sitting on the content
function shareBtn(n){
  return `<button type="button" class="shbtn wide" data-share aria-label="Share ${esc(n.name)}" title="Share ${esc(n.name)}">`
    + SHAREGLYPH + `<svg class="tick" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.6 3.6L15.5 6.6"/></svg><span class="shlbl">Share this style</span></button>`;
}
// ---------- the style panel ----------
// The panel used to open on "Listen on <service>" with the description below the fold and
// the lineage hidden inside the title. It opens on the style now: name, date, and the
// description one tap away, then one unmistakable way into the music, then who made it,
// then the playlists that cross out of it, then where it sits on the map.

// The name carries the date beside it rather than under it, so the two read as one line
// and the About fold sits directly beneath where a subtitle would have been.
function styleHead(n){
  return `<div class="sthead">`
    + `<h1 class="pttl"><span class="ptnm">${esc(n.name)}</span>`
    + `<span class="ptyr">${n.year<1950?esc(n.disp):"c. "+n.year}</span></h1>`
    + aboutFold(n) + `</div>`;
}
// Collapsed, because the description is what you read once and the playlist is what you
// came for. Open, it is the description and the one link that goes deeper on the style
// itself rather than on anything in it.
function aboutFold(n){
  const txt=about(n);
  if(!txt) return "";
  return `<details class="xfold aboutfold"><summary><span>About this style</span>${FOLDTRI}</summary>`
    + `<div class="xfoldb"><p class="note">${esc(txt)}</p>`
    + wiki(n).replace(">Learn more on Wikipedia<",">Read more on Wikipedia<")
    + `</div></details>`;
}
// One button, saying where it goes, instead of a service name in a heading and another in
// a row. The selector sits under it, because you choose a service once and open playlists
// many times.
function startSect(n){
  const ap=(typeof PLAY!=="undefined"&&PLAY[n.id])||"";
  const sp=(typeof SPLAY!=="undefined"&&SPLAY[n.id])||"";
  if(!ap && !sp) return "";
  const open=`<a class="plbtn pl" target="_blank" rel="noopener" data-lbl="Open playlist in"`
    + ` data-ap="${ap?esc("https://music.apple.com"+ap):""}" data-spid="${esc(sp)}"`
    + ` data-style="${esc(n.name)}">`
    + `<i class="plbgo" aria-hidden="true">${OPENGO}</i><span class="plsvc"></span></a>`;
  return sect("listen","",
    `<div class="startrow">${cover(n.id,n)}`
    + `<span class="starttx"><span class="overline">Start listening</span>`
    + `<b class="startttl">The essential ${esc(n.name)} playlist</b>`
    + `<span class="startsub">Meet the style through its defining songs.</span></span></div>`
    + open
    + `<div class="svcline"><span class="svclbl">Your music service</span>${svcPicker("inline")}</div>`);
}
// Key artists, with the style in the heading so the row says whose list this is when you
// have scrolled past the name.
function artistsSect(n,who,artistsHtml){
  if(!who.length) return "";
  const all=artistAll(n);
  return sect("artists","Key "+n.name+" artists", artistsHtml,
    `<span class="sectaside">${all.length}</span>`, "artists");
}
// ---------- Across styles ----------
// A crossing is a listening path, not a second playlist for this style, so it says what
// it is and then names the other panels it sits on. Those names are the point: they are
// where the path goes next.
function acrossSect(n){
  const xs=xplayFor(n.id);
  if(!xs.length) return "";
  const rows=xs.map(x=>{
    const others=x.styles.filter(s=>s!==n.id && byId[s]);
    const links=others.map(s=>`<button type="button" class="xgo" data-go="${esc(s)}">`
      + `${esc(byId[s].name)}<i aria-hidden="true">\u2192</i></button>`).join("");
    const ini=initials(x.title);
    const art = x.art
      ? `<img class="xcov" src="${XPLAY_DIR}${encodeURIComponent(x.id)}${ART_EXT}" alt=""`
        + ` loading="lazy" decoding="async" data-c="${esc(x.c||"")}" data-ini="${esc(ini)}">`
      : `<span class="xcov pcovph" aria-hidden="true"${x.c?` style="--c:${esc(x.c)}"`:""}>`
        + `<b>${esc(ini)}</b></span>`;
    return `<div class="xrow">${art}<div class="xtx">`
      + `<b class="xttl">${esc(x.title)}</b>`
      + (x.note?`<span class="xnote">${esc(x.note)}</span>`:"")
      + (links?`<span class="xalso">Also featured in</span><span class="xlinks">${links}</span>`:"")
      + `<a class="xopen pl" target="_blank" rel="noopener" data-lbl="Open in"`
      + ` data-ap="${x.ap?esc("https://music.apple.com"+x.ap):""}" data-spid="${esc(x.sp||"")}"`
      + ` data-style="${esc(x.title)}"><span class="plsvc"></span>`
      + `<i class="xgoi" aria-hidden="true">${OPENGO}</i></a>`
      + `</div></div>`;
  }).join("");
  return sect("across","Across styles",
    `<p class="note secintro">Playlists that connect ${esc(n.name)} with other sounds.</p>${rows}`);
}
// ---------- Explore the connections ----------
// The lineage was inside the title, which made the map's own relationships a menu you had
// to know was there, and put them in the same control as Back. They are a section now,
// and Back is left to mean only where you have been.
function linksSect(n,anc,desc){
  const from=[...n.parents].sort(byYear), led=[...n.children].sort(byYear);
  if(!from.length && !led.length) return "";
  // the reach of the style, which used to sit under the description: it belongs with the
  // links it counts rather than with the prose
  const dfams=new Set([...desc.keys()].map(k=>byId[k].fam));
  const tally=`<p class="tally">${anc.size} ancestor styles \u00b7 ${desc.size} descendant styles`
    + `${desc.size?` across ${dfams.size} ${dfams.size===1?"family":"families"}`:""}</p>`;
  // Which way each column points. On the map a parent is to the left of its child because
  // it came earlier, so the arrows are that same axis rather than a generic up and down,
  // and they take currentColor so they tint with the heading. The heading text is still
  // the label: the arrows are decoration over it, not the thing being read out.
  const col=(cls,label,arrow,ids)=>`<div class="cxcol"><h4 class="cxh">`
    + (arrow==="from"?CXARL:"") + `<span>${esc(label)}</span>` + (arrow==="led"?CXARR:"")
    + `</h4>`
    + (ids.length
      // Rows that go somewhere now look like it. They were a dot, a name and a year with
      // nothing to say they were buttons, which on a phone is indistinguishable from a
      // list. Same chevron as every other go-to row, so the idiom holds across the panel.
      ? `<div class="cxlist">${ids.map(i=>`<button type="button" class="cxgo ${cls}" data-go="${esc(i)}">`
          + `<i class="dot" style="background:${FAM[byId[i].fam].c}"></i>`
          + `<span class="nm">${esc(byId[i].name)}</span>`
          + `<small>${byId[i].year<1950?esc(byId[i].disp):byId[i].year}</small>`
          + GOCHEV + `</button>`).join("")}</div>`
      : `<p class="cxnone">Nothing on the map yet.</p>`)
    + `</div>`;
  // Shut. It is the longest thing on a style panel, two columns of up to twenty-five
  // names each, and it is a place to go next rather than something to read on the way
  // through. The count beside the heading says how much is behind it.
  const n2=from.length+led.length;
  return sect("connections","Explore the connections",
    `<div class="cxwrap">${col("cxfrom","Before this style","from",from)}`
    + `${col("cxled","After this style","led",led)}</div>${tally}`,
    `<span class="sectaside">${n2} ${n2===1?"style":"styles"}</span>`,
    "", "", false, "shut");
}
// ---------- Go deeper, grouped by what it is ----------
// One list of mixed media made you read every row to find the podcast. Grouped and
// folded, the format is the first thing you choose and the shelf stays short.
const DEEPGRP=[
  ["read","Read","Articles and books",["read","book"]],
  ["watch","Watch","Videos",["watch","look"]],
  ["listen","Listen","Podcasts",["listen"]]
];
function deepSect(n){
  const rows=(typeof READ!=="undefined" && READ[n.id]) || [];
  if(!rows.length) return "";
  const folds=DEEPGRP.map(([k,label,sub,types])=>{
    const mine=rows.filter(r=>types.indexOf(r[7])>=0);
    if(!mine.length) return "";
    // open, where the connections above are shut: nine sources at most, and a title you
    // can read is the thing itself rather than a way to somewhere else
    return `<details class="xfold deepfold" open><summary><span class="dgl">${esc(label)}</span>`
      + `<span class="dgs">${esc(sub)}</span><span class="dgn">${mine.length}</span>${FOLDTRI}</summary>`
      + `<div class="xfoldb"><div class="reads">${mine.map(readRow).join("")}</div></div></details>`;
  }).join("");
  if(!folds) return "";
  // the way more of these arrive: a link out to the suggestion form, with this style
  // already filled in. It opens on its own so the map keeps its place underneath.
  const sug = `<a class="deepsug" href="suggest.html?s=${encodeURIComponent(n.id)}" target="_blank" rel="noopener">`
    + `<i class="dsi"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11"/></svg></i>`
    + `<span>Suggest something</span></a>`;
  return sect("read","Go deeper", folds + sug,
    `<span class="sectaside">${rows.length} ${rows.length===1?"source":"sources"}</span>`);
}
function panel(n,anc,desc){
  const who=n.whoList||[];
  const artistsHtml = `<div class="whorow acrow">${who.map(amCirc).join("")}</div>`;
  resetPages();
  $("panelBody").innerHTML = PHEAD + `<div class="more">
    ${styleHead(n)}
    ${startSect(n)}
    ${artistsSect(n,who,artistsHtml)}
    ${acrossSect(n)}
    ${linksSect(n,anc,desc)}
    ${deepSect(n)}
    ${shareBtn(n)}</div></div>`;
  wrapStack(panelCard());
  paintPlay();
}
$("panel").addEventListener("change",e=>{
  const t=e.target; if(!t) return;
  if(t.classList.contains("svcsel")){ setSvc(t.value); return; }
  // both sorts swap what is on screen rather than rebuilding the page, which would throw
  // the scroll away: re-sorting is for looking at the same set again. The heading is
  // rebuilt too, because the picker's own label is the thing that says where you are.
  if(t.classList.contains("msortsel")){
    setModeSort(t.value);
    const page=t.closest(".ppage");
    const list=page&&page.querySelector(".modelist");
    const head=page&&page.querySelector(".secthead.picksort");
    if(list) list.outerHTML=modeListHtml();
    if(head) head.outerHTML=modeSortHtml();
    return; }
  if(t.classList.contains("tsortsel")){
    setTopSort(t.value);
    const page=t.closest(".ppage");
    const list=page&&page.querySelector(".toplist");
    const head=page&&page.querySelector(".secthead.picksort");
    if(list) list.outerHTML=topGridHtml();
    if(head) head.outerHTML=topSortHtml();
    return; }
  if(t.classList.contains("psortsel")){
    setPickSort(t.value);
    const page=t.closest(".ppage");
    const list=page&&page.querySelector(".picks");
    const head=page&&page.querySelector(".secthead.picksort");
    const m=page && typeof MODES!=="undefined"
      && MODES.find(x=>"mode:"+x[0]===page.dataset.p);
    if(list&&m){ list.innerHTML=modePicks(m); amUpgrade(); }
    if(head) head.outerHTML=pickSortHead();
    return; }
});
function clearNav(m){
  if(m._home){ m._home.appendChild(m); m._home=null; }
  m.style.cssText="";
}
function placeNav(btn,m){
  if(!m._home){ m._home=m.parentNode; document.body.appendChild(m); }
  // outside the panel it would lose the family tint, so carry those values across
  const pan=$("panel");
  if(pan){ const cs=getComputedStyle(pan);
    ["--panel","--fg","--muted","--line","--ink","--tint","--acc"].forEach(v=>{
      const val=cs.getPropertyValue(v); if(val) m.style.setProperty(v,val.trim()); }); }
  const b=btn.getBoundingClientRect();
  const led=!!(m._home&&m._home.classList.contains("nav-led"));
  const gap=6, edge=10;
  const below=innerHeight-b.bottom-gap-edge, above=b.top-gap-edge;
  // a bottom sheet leaves no room beneath it, so flip the menu over the map
  const up = below<220 && above>below;
  m.style.position="fixed";
  if(up){ m.style.bottom=Math.round(innerHeight-b.top+gap)+"px"; m.style.top="auto";
          m.style.maxHeight=Math.max(150,Math.round(above))+"px"; }
  else  { m.style.top=Math.round(b.bottom+gap)+"px"; m.style.bottom="auto";
          m.style.maxHeight=Math.max(150,Math.round(below))+"px"; }
  m.style.right="auto";
  m.style.left="0px";                       // measure at a known origin before placing
  // a menu hanging off a full-width list row looked detached at its own natural width:
  // it takes the row's instead, so it reads as that row opening rather than as a popup
  // .navmenu caps itself at 300px for a pill-sized button; a list row is wider than that,
  // so the cap has to come off with the width
  // a row's menu takes the row's width; the title's takes the card's, since two columns
  // need more than the name is wide
  const card=btn.closest(".pcard");
  const w0 = btn.classList.contains("listrow") ? Math.round(b.width)
    : btn.classList.contains("navttl") && card ? Math.round(card.getBoundingClientRect().width)
    : 0;
  m.style.width = w0 ? w0+"px" : "";
  m.style.maxWidth = w0 ? "none" : "";
  const w=m.offsetWidth;
  const cb = btn.classList.contains("navttl") && card ? card.getBoundingClientRect() : null;
  const want = cb ? cb.left : led ? b.right-w : b.left;
  const max = innerWidth-edge-w, min = edge;
  m.style.left=Math.round(max<min ? min : Math.min(Math.max(want,min),max))+"px";
}
function closeNav(except){
  document.querySelectorAll(".navmenu").forEach(m=>{
    const w=m._home||m.parentNode;
    if(w===except) return;
    if(m.parentNode===document.body && w && !w.isConnected){ m.remove(); return; }
    const b=w&&w.querySelector("[data-menu]");   // .navbtn, .listrow or the title
    m.hidden=true; if(b) b.setAttribute("aria-expanded","false");
    clearNav(m);
  });
}
document.addEventListener("click",e=>{ if(!e.target.closest(".navwrap") && !e.target.closest(".navmenu")) closeNav(); });
// menu items no longer sit inside #panel, so they need their own handler
document.addEventListener("click",e=>{
  const pb=e.target.closest(".navmenu [data-plbr]");
  if(pb){ const m=pb.closest(".navmenu"); m.innerHTML=plStylesHtml(pb.dataset.plbr); m.scrollTop=0; return; }
  const pk=e.target.closest(".navmenu [data-plback]");
  if(pk){ const m=pk.closest(".navmenu"); m.innerHTML=plMenuHtml(); m.scrollTop=0; return; }
  const fb=e.target.closest(".navmenu [data-fambr]");
  if(fb){ const m=fb.closest(".navmenu"); m.innerHTML=famStylesHtml(fb.dataset.fambr); m.scrollTop=0; return; }
  const bk=e.target.closest(".navmenu [data-brback]");
  if(bk){ const m=bk.closest(".navmenu"); m.innerHTML=famMenuHtml(); m.scrollTop=0; return; }
});
document.addEventListener("click",e=>{
  const g=e.target.closest(".navmenu [data-go]"); if(!g) return;
  e.preventDefault(); closeNav(); select(g.dataset.go); panelTop();
});
addEventListener("keydown",e=>{ if(e.key==="Escape") closeNav(); });
addEventListener("resize",()=>closeNav());
$("panel").addEventListener("click",e=>{
  const mb=e.target.closest("[data-menu]");
  if(mb){ const w=mb.closest(".navwrap");
    // while open the menu lives on <body>, so it is not under its wrapper any more
    const m=w&&(w.querySelector(".navmenu")
      || [...document.querySelectorAll("body > .navmenu")].find(x=>x._home===w));
    if(!m) return;
    const open=m.hidden;
    if(open && m.dataset.br==="fams") m.innerHTML=famMenuHtml();   // never reopen mid-drill
    if(open && m.dataset.br==="pl") m.innerHTML=plMenuHtml();
    closeNav(open?w:null);
    m.hidden=!open; mb.setAttribute("aria-expanded",String(open));
    if(open) placeNav(mb,m); else clearNav(m);
    return; }
  if(e.target.closest("#ptoggle")||e.target.closest("#grab")) return;   // the handle runs its own tap/drag logic
  const sv=e.target.closest("[data-svc]"); if(sv){ setSvc(sv.dataset.svc); return; }
  { const pg=e.target.closest("[data-page]");
    if(pg){ e.preventDefault(); pushPage(pg.dataset.page); return; } }
  // one of this collection, rather than one of the map: the point of standing in a
  // collection is that everything in it already fits
  { const pa=e.target.closest("[data-pickany]");
    if(pa){ e.preventDefault();
      const m=typeof MODES!=="undefined" && MODES.find(x=>x[0]===pa.dataset.pickany);
      const pool=m ? m[4].map(([id])=>id).filter(id=>byId[id] && id!==state.sel) : [];
      const pick=pool[Math.floor(Math.random()*pool.length)];
      if(pick){ closeNav(); select(pick); panelTop(); } return; } }
  { const rr=e.target.closest("[data-random]");
    if(rr){ const pool=nodes.filter(n=>n.id!==state.sel);
      const pick=pool[Math.floor(Math.random()*pool.length)];
      if(pick){ closeNav(); select(pick.id); panelTop(); } return; } }
  // the sort swaps the rows where they stand rather than rebuilding the page: a rebuild
  // would throw away the scroll position, and the whole point of re-sorting is to look
  // at the same set from somewhere else
  { const md=e.target.closest("[data-mode]");
    if(md){ e.preventDefault(); pushPage("mode:"+md.dataset.mode); return; } }
  const fm=e.target.closest("[data-fam]");
  if(fm){ // jump to the family by selecting its most influential style, so the map centres and its lineage draws
    const k=fm.dataset.fam;
    const pick=nodes.filter(x=>x.fam===k).sort((x,y)=>y.children.length-x.children.length||x.year-y.year)[0];
    if(pick){ select(pick.id,{scroll:true,smooth:!reduce}); panelTop(); }
    return; }
  // a row that names a style navigates to it even on a minimised sheet, which is
  // otherwise tap-anywhere-to-open: the mode picks sit there, and expanding the panel
  // is not what tapping a named style asks for
  const g0=e.target.closest("[data-go]");
  if(g0){ closeNav(); select(g0.dataset.go); panelTop(); return; }
  // before tap-anywhere-to-open, or closing a minimised sheet opens it instead
  if(e.target.closest("[data-dismiss]")){ dismissSheet(); return; }
  if(!OPEN && OVERLAY){ if(!e.target.closest("a")) setOpen(true); return; }   // only the minimised sheet is tap-to-open
  { const ac=e.target.closest("[data-aboutcopy]");
    if(ac){ copyAbout(ac); return; } }
  { const dc=e.target.closest("[data-datacopy]");
    if(dc){ copyData(dc); return; } }
  { const ss=e.target.closest("[data-sharesheet]");
    if(ss){ openShareSheet(ss); return; } }
  { const sb=e.target.closest("[data-share]");
    if(sb){ shareSel(sb); return; } }
  if(e.target.closest("[data-close]")){ closePanel(); return; }
  const m=e.target.closest("[data-mode]"); if(m){ state.mode=m.dataset.mode; select(state.sel,{scroll:false}); }
});
$("lanes").addEventListener("click",e=>{ const l=e.target.closest(".lane"); if(!l) return; const lane=lanes.find(x=>x.k===l.dataset.fam); if(lane) scroller.scrollTo({top:Math.max(0,lane.y0-8),behavior:reduce?"auto":"smooth"}); });
// picking another style keeps the card as it is; empty space collapses it, then clears the selection
$("chart").addEventListener("click",e=>{
  const g=e.target.closest(".n");
  if(g){ select(g.dataset.id,{scroll:true,smooth:!reduce,keepPlace:true}); if(OPEN) $("panel").scrollTop=0; return; }
  if(OPEN){ closePanel(); return; }
  if(state.sel) clearSel();
});
function clearSel(){
  closeNav();
  if(state.sel && !GOINGBACK) pushTrail();
  state.sel=null;
  const svg=$("chart"); svg.classList.remove("sel");
  svg.querySelectorAll(".n.on,.n.cur").forEach(g=>g.classList.remove("on","cur"));
  svg.querySelectorAll(".e.on,.e.dir").forEach(e=>e.classList.remove("on","dir"));
  $("lanes").querySelectorAll(".lane.dim").forEach(l=>l.classList.remove("dim"));
  setHash(""); syncShare();
  emptyPanel(); syncBack();
}
// ---------- "open in Safari" ----------
// Add to Home Screen exists in Safari and nowhere else on iOS, so someone reading the
// install steps from Chrome, or from the browser inside Instagram or Slack, cannot follow
// them. A web page cannot choose a browser on a desktop, but both phone platforms have a
// scheme that can, so offer it to the people the steps do not work for.
function hereURL(){ return location.origin + location.pathname + location.search; }
const UA = navigator.userAgent;
function isiOS(){ return /iPad|iPhone|iPod/.test(UA) ||
  (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1); }   // iPadOS claims to be a Mac
function isAndroid(){ return /Android/.test(UA); }
// every iOS browser is WebKit, so Safari is told apart by what it is not: the other
// browsers' own tokens, and the in-app views, which carry no Version/ at all
function isSafari(){ return /Version\/[\d.]+/.test(UA) && /Safari/.test(UA) &&
  !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Instagram|FBAN|FBAV|FBIOS|Line\/|MicroMessenger|Snapchat/.test(UA); }
function isChrome(){ return /Chrome\//.test(UA) && !/EdgA?\/|OPR\/|SamsungBrowser|YaBrowser|DuckDuckGo/.test(UA); }
function installed(){ try{ return navigator.standalone===true ||
  matchMedia("(display-mode: standalone)").matches; }catch(e){ return false; } }
// the HTML for the row, or "" when the reader is already where they need to be
function openInRow(){
  const u=hereURL();
  // the schemes take the page's own protocol, but a file:// copy has no browser to open
  if(!/^https?:/.test(u) || installed()) return "";          // nothing to offer, or already added
  let href="", app="", note="";
  if(isiOS() && !isSafari()){
    href="x-safari-"+u; app="Safari";
    // on iOS this is not a preference: no other browser has the item at all
    note="You are not in Safari, and Add to Home Screen exists nowhere else on iOS. "
       + "If the button does nothing, tap <b>Share</b> and choose <b>Open in Safari</b>, which always works.";
  } else if(isAndroid() && !isChrome()){
    href="intent://"+u.replace(/^https?:\/\//,"")+"#Intent;scheme="+location.protocol.replace(":","")+";package=com.android.chrome;"
       + "S.browser_fallback_url="+encodeURIComponent(u)+";end";
    app="Chrome";
    // unlike iOS, the browser you are in can almost certainly do this itself
    note="Your own browser can install this too, under its own menu. The steps below describe Chrome, "
       + "which is the one most people have.";
  } else return "";
  return '<p class="openin"><a href="'+href+'" rel="nofollow"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3h6v6"/><path d="M17 3l-8 8"/><path d="M15 12v4.2A1.8 1.8 0 0 1 13.2 18H4.8A1.8 1.8 0 0 1 3 16.2V7.8A1.8 1.8 0 0 1 4.8 6H9"/></svg><span>Open this page in '+app+'</span></a></p>'
   + '<p class="opennote">'+note+'</p>';
}

// the Share sheet is where Add to Home Screen lives, so on a browser that can open it
// from script there is no reason to send anyone off to find the button themselves
function canShareSheet(){ return !!(navigator.share && isiOS()); }
function shareStep(){ return canShareSheet()
  ? '<button type="button" class="sheetbtn" data-sharesheet>'+SHAREGLYPH+'<span>Open the Share sheet</span></button>'
  : ""; }
function openShareSheet(btn){
  const lbl=btn.querySelector("span");
  navigator.share({title:"Music Atlas", url:hereURL()}).catch(()=>{
    // a dismissed sheet rejects exactly like a refused one, so only say something
    // if it is still here to be said to
    if(lbl) lbl.textContent="Use the Share button at the bottom of the screen";
  });
}

// ---------- sharing ----------
// every style has a URL: the page plus #id, which boot() already reads back
function styleURL(id){ return location.origin + location.pathname + location.search + "#" + hashOf(id); }
// "about" is the one hash that is not a style id
const ABOUT_HASH="about", INSTALL_HASH="install", MODES_HASH="modes", PICKS_HASH="picks";
// The hashes that open a page rather than select a style. Roots and Most influential are
// in it because the Explore panel no longer carries a row to either: the map took that
// job back, and a page nothing links to is a page nobody can reach. The values are the
// selectors these were back when they were folds, and nothing reads them any more.
const FOLDS={[ABOUT_HASH]:".aboutwrap", [INSTALL_HASH]:".installwrap", [MODES_HASH]:".modelist",
  [PICKS_HASH]:".picklist", roots:".plist", top:".plist"};
function foldURL(hash){ return location.origin + location.pathname + location.search + "#" + hash; }
function openAbout(scroll,hash){
  // these two used to be folds on the root panel; they are pages now, so the hash that
  // deep-links them pushes one
  return pushPage(hash||ABOUT_HASH);
}
function hashOf(key){ return encodeURIComponent(key).replace(/%3A/g,":"); }
function setHash(id){
  const want = id ? "#"+hashOf(id) : "";
  if((location.hash||"") === want) return;
  // replace, not push: selecting styles shouldn't fill the back button
  try{ history.replaceState(null,"",want || location.pathname+location.search); }catch(e){ if(id) location.hash=want; }
}
// The row that hands the file over.
//
// It used to be a link that opened the JSON. Installed to a home screen there is no
// browser chrome and no back: opening half a megabyte of JSON in the app's own window
// trapped you in it. And it was the wrong thing to offer anyway. Nobody wants to read
// 496 KB of JSON; they want its address, to give to a model. So the row copies the URL,
// which is the same useful act in both cases, and the address is printed under it: a
// link when there is somewhere to come back from, plain selectable text when there is not.
// the same link glyph the About copy control wears, so the two read as one action
const COPYGLYPH="<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8.4 11.6a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-1 1\"/><path d=\"M11.6 8.4a3.2 3.2 0 0 0-4.6 0L4.4 11a3.2 3.2 0 0 0 4.6 4.6l1-1\"/></svg>";
const DATAICON="<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M43.18,128a29.78,29.78,0,0,1,8,10.26c4.8,9.9,4.8,22,4.8,33.74,0,24.31,1,36,24,36a8,8,0,0,1,0,16c-17.48,0-29.32-6.14-35.2-18.26-4.8-9.9-4.8-22-4.8-33.74,0-24.31-1-36-24-36a8,8,0,0,1,0-16c23,0,24-11.69,24-36,0-11.72,0-23.84,4.8-33.74C50.68,38.14,62.52,32,80,32a8,8,0,0,1,0,16C57,48,56,59.69,56,84c0,11.72,0,23.84-4.8,33.74A29.78,29.78,0,0,1,43.18,128ZM240,120c-23,0-24-11.69-24-36,0-11.72,0-23.84-4.8-33.74C205.32,38.14,193.48,32,176,32a8,8,0,0,0,0,16c23,0,24,11.69,24,36,0,11.72,0,23.84,4.8,33.74a29.78,29.78,0,0,0,8,10.26,29.78,29.78,0,0,0-8,10.26c-4.8,9.9-4.8,22-4.8,33.74,0,24.31-1,36-24,36a8,8,0,0,0,0,16c17.48,0,29.32-6.14,35.2-18.26,4.8-9.9,4.8-22,4.8-33.74,0-24.31,1-36,24-36a8,8,0,0,0,0-16Z\"/></svg>";
function catalogURL(file){
  try{ return new URL(file, location.href).href; }
  catch(e){ return file; }
}
function dataRow(){
  return CATALOG.map(c=>{
    const u=catalogURL(c.file), shown=u.replace(/^https?:\/\//,"");
    // file:// has no address worth handing to anyone, so the row only copies
    const openable=/^https?:/.test(u) && !installed();
    return `<button type="button" class="dataline" data-datacopy="${esc(c.file)}"`
      + ` aria-label="Copy the link to ${esc(c.name)}">`
      + DATAICON
      + `<span class="dltx"><b class="lbl">${esc(c.label)}</b>`
      + `<small>${esc(c.sub)} \u00b7 ${esc(c.kb)}</small></span>`
      + `<i class="dlgo">${COPYGLYPH}</i></button>`
      + `<p class="dataurl">`
      + (openable
          ? `<a href="${esc(c.file)}" target="_blank" rel="noopener">${esc(shown)}</a>`
          : `<span>${esc(shown)}</span>`)
      + `</p>`;
  }).join("");
}
function copyData(btn){
  const url=catalogURL(btn.dataset.datacopy||CATALOG[0].file), lbl=btn.querySelector(".lbl");
  const flash=t=>{ if(!lbl) return; if(btn._was==null) btn._was=lbl.textContent;
    btn.classList.add("done"); lbl.textContent=t;
    clearTimeout(btn._t); btn._t=setTimeout(()=>{ btn.classList.remove("done");
      if(btn._was!=null){ lbl.textContent=btn._was; btn._was=null; } },1600); };
  const fallback=()=>{ const ta=document.createElement("textarea"); ta.value=url;
    ta.setAttribute("readonly",""); ta.style.cssText="position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); flash("Link copied"); }catch(e){ flash("Copy failed"); }
    ta.remove(); };
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(url).then(()=>flash("Link copied"),fallback);
  else fallback();
}
function copyAbout(btn){
  const url=foldURL(btn.dataset.aboutcopy||ABOUT_HASH), lbl=btn.querySelector(".lbl");
  const flash=t=>{ if(!lbl) return; if(btn._was==null) btn._was=lbl.textContent;
    btn.classList.add("done"); lbl.textContent=t;
    clearTimeout(btn._t); btn._t=setTimeout(()=>{ btn.classList.remove("done");
      if(btn._was!=null){ lbl.textContent=btn._was; btn._was=null; } },1600); };
  const fallback=()=>{ const ta=document.createElement("textarea"); ta.value=url; ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); flash("Link copied"); }catch(e){ flash("Copy failed"); } ta.remove(); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(()=>flash("Link copied"),fallback);
  else fallback();
}
function shareSel(btn0){
  const page = btn0 && btn0.dataset && btn0.dataset.sharekey;
  const id=state.sel, n=(!page && id)?byId[id]:null;
  // a page says what it is; otherwise the selected style, and failing that the map itself
  const url = page ? foldURL(hashOf(page))
    : n ? styleURL(id)
    : location.origin+location.pathname+location.search;
  const nm = page ? (btn0.dataset.sharename||"") : n ? n.name : "";
  const title = nm ? "Music Atlas · "+nm : "Music Atlas";
  const text  = nm ? nm+" on Music Atlas" : "Music Atlas — what grew out of what in popular music";
  const btn=btn0 || document.querySelector("#panel [data-share]");
  // the wide button says what happened in words; the round one has no room for words, so
  // .done swaps its glyph for a tick and that is the whole message
  const flash=t=>{ if(!btn) return; const nm=btn.querySelector(".shlbl");
    if(nm && btn._was==null) btn._was=nm.textContent;
    btn.classList.add("done"); if(nm) nm.textContent=t;
    clearTimeout(btn._t); btn._t=setTimeout(()=>{ btn.classList.remove("done");
      if(nm && btn._was!=null){ nm.textContent=btn._was; btn._was=null; } },1600); };
  const copy=()=>{ const done=()=>flash("Link copied");
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,()=>fallback());
    else fallback();
    function fallback(){ const ta=document.createElement("textarea"); ta.value=url; ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;top:0;left:0;opacity:0"; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); done(); }catch(e){ flash("Copy failed"); } ta.remove(); } };
  // the share sheet hands it to Messages, Mail and the rest; clipboard is the fallback
  if(navigator.share){
    navigator.share({title, text, url}).catch(err=>{
      if(err && (err.name==="AbortError"||err.name==="NotAllowedError")) return; copy(); });
  } else copy();
}
{ const sp=$("sheetpull"); if(sp) sp.addEventListener("click",()=>{ restoreSheet(); }); }
{ const pn=$("panel"); if(pn) pn.addEventListener("click",e=>{ if(e.target.closest("#panelBack")){ e.preventDefault(); e.stopPropagation(); if(!popPage()) goBack(); } },true); }
{ const hb=$("mapHome"); if(hb) hb.addEventListener("click",e=>{ e.preventDefault(); goHome(); }); }
// the hardware/browser back gesture should feel the same as the button
addEventListener("keydown",e=>{
  if(e.key==="Backspace" && !/^(INPUT|TEXTAREA)$/.test((e.target.tagName||""))){ e.preventDefault(); goBack(); }
});
// the title carries the label now; it is rebuilt on every select, so this only has
// to catch the case where the panel is left standing
function syncShare(){
  const b=document.querySelector("#panel [data-share]:not([data-sharekey])"); if(!b) return;
  const l=state.sel?"Share this style":"Share this app";
  if(!b.classList.contains("done")){ b.setAttribute("aria-label",l); b.setAttribute("title",l);
    const t=b.querySelector(".shlbl"); if(t) t.textContent=l; }
}

// the panel takes a wash of the family's cover-art ground; strength lives in CSS
// A skin is two trios: the family's cover-art ground for dark mode, and a pale wash of
// the same hue for light. Both are put on the panel and the stylesheet picks, the way
// every other pair of palettes in this file is picked, so following the system theme
// needs no listener and changing it mid-session cannot leave a panel on the wrong one.
function setTint(fam){
  const s=(typeof FAMSKIN!=="undefined"&&FAMSKIN[fam])||null;
  const el=$("panel"); if(!el) return;
  const names=["--tint-d","--ink-d","--acc-d","--tint-l","--ink-l","--acc-l"];
  if(s) names.forEach((n,i)=>el.style.setProperty(n, s[i] || s[i-3] || s[0]));
  else names.forEach(n=>el.style.removeProperty(n));
  el.classList.toggle("tinted",!!s);
}
// ---------- listening modes ----------
// a way in for people who know what they want the music to DO but not what to call it
let MODE=null;
function modePicks(m){
  return pickOrder(m,pickSort()).map(([id,why])=>{
    const n=byId[id]; if(!n) return "";
    // the playlist's own cover, which is the thing you would recognise before you
    // recognised the name. Where there is no file the shared handler swaps in the tile
    // it uses on the playlist row: family colour, initials, same square.
    return `<button type="button" class="pick c withart" style="--c:${FAM[n.fam].c}" data-go="${esc(id)}" title="Show ${esc(n.name)} on the map">`
      + cover(id,n,true)
      + `<span class="pknm">${esc(n.name)}</span>`
      + `<span class="pkwhy">${esc(why)}</span>`
      + `<span class="pkfam">${esc(FAM[n.fam].short)} · ${n.year}</span></button>`;
  }).join("");
}
// twelve chips fill a phone screen, so the picks can open out of sight below them
// Bring the chosen mode's list to the top of the sheet. #panel is overflow:hidden and
// never scrolled, which is why the earlier version of this moved nothing at all: the
// scroller is #panelBody.
function showMode(){
  const body=$("panelBody"), o=body&&body.querySelector(".modeout");
  if(!o) return;
  const br=body.getBoundingClientRect(), or=o.getBoundingClientRect();
  body.scrollTo({top: body.scrollTop + (or.top-br.top) - 8, behavior: reduce?"auto":"smooth"});
}
// the way back: the chips' own section heading, not the chip row, so "What do you need
// it to do?" is on screen and the list reads as one thing you stepped into
function showChips(){
  const body=$("panelBody"), s=body&&body.querySelector(".modechips");
  if(!s) return;
  const head=s.closest(".sect")||s;
  const br=body.getBoundingClientRect(), hr=head.getBoundingClientRect();
  body.scrollTo({top: Math.max(0, body.scrollTop + (hr.top-br.top) - 8), behavior: reduce?"auto":"smooth"});
}
// About is the last thing in the panel, so opening it laid the text out below the fold
// and the tap looked like it had done nothing. Bring the row up to the top of the panel
// so the text you just asked for is the text you are looking at.
// toggle does not bubble, so this has to listen on the capture phase.
document.addEventListener("toggle",e=>{
  const d=e.target;
  if(!d.classList || !d.classList.contains("fold") || !d.open) return;
  const body=$("panelBody"); if(!body) return;
  requestAnimationFrame(()=>{
    const br=body.getBoundingClientRect(), dr=d.getBoundingClientRect();
    body.scrollTo({top: Math.max(0, body.scrollTop + (dr.top-br.top) - 8), behavior: reduce?"auto":"smooth"});
  });
},true);

// Families and influence as menus rather than two walls of chips. Same navwrap/navmenu
// machinery as the From and Led to buttons, so they portal, flip and close identically.
const TOPN=24;
// One list, so the number on the row is the number of rows on the page it opens. It was
// the constant before, which is the same number right up until the selection changes
// under it and the row keeps saying 24.
function topIds(){
  return [...nodes].sort((a,b)=>b.children.length-a.children.length||a.year-b.year)
    .slice(0,TOPN).map(x=>x.id);
}
function famCount(k){ return nodes.filter(n=>n.fam===k).length; }
function famMenuHtml(){
  const rows=[...FAMS].sort((x,y)=>famCount(y[0])-famCount(x[0])).map(([k,name])=>
    `<button type="button" role="menuitem" data-fambr="${k}" title="${esc(name)}: ${famCount(k)} styles"><i class="dot" style="background:${FAM[k].c}"></i><span class="nm">${esc(name)}</span><small>${famCount(k)}</small></button>`).join("");
  return `<div class="navhd">Families by size</div>${rows}`;
}
function famStylesHtml(k){
  const rows=nodes.filter(n=>n.fam===k).sort((x,y)=>x.year-y.year||x.name.localeCompare(y.name)).map(x=>
    `<button type="button" role="menuitem" data-go="${x.id}"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.year<1950?esc(x.disp):x.year}</small></button>`).join("");
  return `<button type="button" class="brback" data-brback="1"><i class="bk">${CHEV.from}</i><span class="nm">${esc(FAM[k].name)}</span><small>${famCount(k)}</small></button>${rows}`;
}
function topMenuHtml(){
  const rows=[...nodes].sort((x,y)=>y.children.length-x.children.length||x.year-y.year).slice(0,TOPN).map(x=>
    `<button type="button" role="menuitem" data-go="${x.id}" title="${esc(x.name)} led to ${x.children.length} styles"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.children.length}</small></button>`).join("");
  return `<div class="navhd">Most led to</div>${rows}`;
}
const hasPlay=id=>!!((typeof PLAY!=="undefined"&&PLAY[id])||(typeof SPLAY!=="undefined"&&SPLAY[id]));
const playable=()=>nodes.filter(n=>hasPlay(n.id));
// the first level: the styles nothing in this map leads to. The panel's forward button at
// the root points at these, so the map can be walked from its beginning as well as searched.
const firstLevel=()=>nodes.filter(n=>!n.parents.length).map(n=>n.id).sort(byYear);
function plCount(k){ return nodes.filter(n=>n.fam===k&&hasPlay(n.id)).length; }
// the catalog is 233 deep, so it drills by family rather than scrolling as one list
function plMenuHtml(){
  const rows=[...FAMS].filter(([k])=>plCount(k)).sort((x,y)=>plCount(y[0])-plCount(x[0])).map(([k,name])=>
    `<button type="button" role="menuitem" data-plbr="${k}" title="${esc(name)}: ${plCount(k)} playlists"><i class="dot" style="background:${FAM[k].c}"></i><span class="nm">${esc(name)}</span><small>${plCount(k)}</small></button>`).join("");
  return `<div class="navhd">Playlists by family</div>${rows}`;
}
function plStylesHtml(k){
  const rows=nodes.filter(n=>n.fam===k&&hasPlay(n.id)).sort((x,y)=>x.year-y.year).map(x=>
    `<button type="button" role="menuitem" data-go="${x.id}"><i class="dot" style="background:${FAM[x.fam].c}"></i><span class="nm">${esc(x.name)}</span><small>${x.year<1950?esc(x.disp):x.year}</small></button>`).join("");
  return `<button type="button" class="brback" data-plback="${k}"><i class="bk">${CHEV.from}</i><span class="nm">${esc(FAM[k].name)}</span><small>${plCount(k)}</small></button>${rows}`;
}

const FOLDTRI="<svg class=\"lrcv lrgov\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M181.66,133.66l-80,80A8,8,0,0,1,88,208V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,181.66,133.66Z\"/></svg>";
// a row that takes you somewhere points that way; the triangle unfolds what is already here
const GOCHEV="<svg class=\"lrcv lrgov\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z\"/></svg>";
const CXARL="<svg class=\"cxar\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z\"/></svg>";
const CXARR="<svg class=\"cxar\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z\"/></svg>";
const LRCHEV="<svg class=\"lrcv\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z\"/></svg>";
// every way of browsing the map is a collection you open, so they are one grouped list:
// icon, name, how many, chevron, hairlines starting at the name. They used to be three
// chips in a row, and the roots were a pill up in the header.
// The list rows, from the same Phosphor Duotone set as everything else.
const ROWICON={"roots":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M198.1,62.59a76,76,0,0,0-140.2,0A71.71,71.71,0,0,0,16,127.8C15.9,166,48,199,86.14,200A72.09,72.09,0,0,0,120,192.47V232a8,8,0,0,0,16,0V192.47A72.17,72.17,0,0,0,168,200l1.82,0C208,199,240.11,166,240,127.8A71.71,71.71,0,0,0,198.1,62.59ZM169.45,184a56.08,56.08,0,0,1-33.45-10v-41l43.58-21.78a8,8,0,1,0-7.16-14.32L136,115.06V88a8,8,0,0,0-16,0v51.06L83.58,120.84a8,8,0,1,0-7.16,14.32L120,156.94v17a56,56,0,0,1-33.45,10C56.9,183.23,31.92,157.52,32,127.84A55.77,55.77,0,0,1,67.11,76a8,8,0,0,0,4.53-4.67,60,60,0,0,1,112.72,0A8,8,0,0,0,188.89,76,55.79,55.79,0,0,1,224,127.84C224.08,157.52,199.1,183.23,169.45,184Z\"/></svg>","fams":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z\"/></svg>","pl":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M32,64a8,8,0,0,1,8-8H216a8,8,0,0,1,0,16H40A8,8,0,0,1,32,64Zm8,72H160a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm72,48H40a8,8,0,0,0,0,16h72a8,8,0,0,0,0-16Zm135.66-57.7a8,8,0,0,1-10,5.36L208,122.75V192a32.05,32.05,0,1,1-16-27.69V112a8,8,0,0,1,10.3-7.66l40,12A8,8,0,0,1,247.66,126.3ZM192,192a16,16,0,1,0-16,16A16,16,0,0,0,192,192Z\"/></svg>","top":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z\"/></svg>","random":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H200.94a72.12,72.12,0,0,1-58.59-30.15l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.1,56.1,0,0,0,200.94,176h11.75l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.1,56.1,0,0,1,200.94,80h11.75L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H200.94a72.12,72.12,0,0,0-58.59,30.15l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z\"/></svg>","about":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z\"/></svg>","install":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z\"/></svg>"};
const ROWICON_PICKS="<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z\"/></svg>";
ROWICON.picks=ROWICON_PICKS;
const rowIcon = k => {
  // the medium rows carry the medium's own glyph and colour, which the Go deeper rows on
  // every style already use, so the two read as the same thing seen from two directions
  const med = k.indexOf("med:")===0 ? k.slice(4) : "";
  return `<i class="lrico mi lr-${esc(med?"med-"+med:k)}">`
    + (med ? (MEDPAGEICON[med]||"") : (ROWICON[k]||"")) + `</i>`;
};
// The roots menu, the roots row and the random row all lived here. Roots came off the
// Explore panel when the map took that job back, and Surprise me is now one of the two
// rows in On the map, written there rather than built by a helper of its own.
// Share is the one thing on either panel that acts rather than opens, so it is the one
// thing shaped like a button and the only thing in blue, under the list on the overview
// and under the text on a style.
const TICKGLYPH="<svg class=\"tick\" viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z\"/></svg>";
function appShareBtn(){
  return `<button type="button" class="shbtn wide" data-share aria-label="Share this app" title="Share this app">`
    + SHAREGLYPH + TICKGLYPH + `<span class="shlbl">Share this app</span></button>`;
}
// Two shortcuts into the atlas, not a second way to browse it: the map itself is the
// browser, and a list of 461 names repeated under it would be a worse one. Each row says
// where it goes and, underneath, what you get for going there, which the bare count never
// did. Roots is not among them any more. It was a third list of styles competing with the
// map directly above it; the roots are all still on the map, still marked, and the page
// itself is still at #roots for anyone who had it.
function onMapSect(){
  const top=topIds();
  return sect("onmap","Exploring the Atlas",
    `<div class="listgrp sep">`
    + goRow("top","Most influential","Explore musical crossroads",top.length,
        ` data-page="top"`,`The ${top.length} styles that led to the most`)
    + goRow("random","Surprise me","Jump somewhere unexpected",null,
        ` data-random`,"Open any style, chosen at random")
    + `</div>`,
    // no lede: the two rows under it say what they do, and a line telling you to choose a
    // style sat above a list of two things that are not styles
    "", "", "");
}
function goRow(key,label,sub,count,attr,title){
  return `<button type="button" class="listrow lrtwo"${attr||""}`
    + ` title="${esc(title||label)}" aria-label="${esc(title||label)}">`
    + rowIcon(key)
    + `<span class="lrtx"><b class="lrlbl">${esc(label)}</b>`
    + `<small class="lrsub">${esc(sub)}</small></span>`
    + (count!=null?`<em class="lrct">${count}</em>`:"")
    + GOCHEV + `</button>`;
}
// Phosphor Icons, the Duotone weight, MIT. Inlined as paths so the map stays one
// offline file. Chosen per mode for what the mode means rather than the nearest word:
// Sleep is a zzz and not a hotel bed, Getting it done is a double check, and the three
// drinks are three different glasses so no two modes wear the same one.
const MODEICON={"system":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M192,24H64A16,16,0,0,0,48,40V216a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V40A16,16,0,0,0,192,24Zm0,192H64V40H192ZM116,76a12,12,0,1,1,12,12A12,12,0,0,1,116,76Zm12,116a40,40,0,1,0-40-40A40,40,0,0,0,128,192Zm0-64a24,24,0,1,1-24,24A24,24,0,0,1,128,128Z\"/></svg>","winddown":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z\"/></svg>","sleep":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,72H32V48a8,8,0,0,0-16,0V208a8,8,0,0,0,16,0V176H240v32a8,8,0,0,0,16,0V112A40,40,0,0,0,216,72ZM32,88h72v72H32Zm88,72V88h96a24,24,0,0,1,24,24v48Z\"/></svg>","nightcap":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M224,88h0a95.63,95.63,0,0,0-15.53-52.37,8,8,0,0,0-6.7-3.63H54.23a8,8,0,0,0-6.7,3.63A95.63,95.63,0,0,0,32,88h0a96.12,96.12,0,0,0,88,95.66V216H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H136V183.66A96.12,96.12,0,0,0,224,88ZM58.7,48H197.3a79.52,79.52,0,0,1,10.3,32H48.4A79.52,79.52,0,0,1,58.7,48ZM128,168A80.11,80.11,0,0,1,48.4,96H207.6A80.11,80.11,0,0,1,128,168Z\"/></svg>","sit":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M158.66,196.44l-32,48a8,8,0,1,1-13.32-8.88l32-48a8,8,0,0,1,13.32,8.88ZM232,92a76.08,76.08,0,0,1-76,76H132.28l-29.62,44.44a8,8,0,1,1-13.32-8.88L113.05,168H76A52,52,0,0,1,76,64a53.26,53.26,0,0,1,8.92.76A76.08,76.08,0,0,1,232,92Zm-16,0A60.06,60.06,0,0,0,96,88.46a8,8,0,0,1-16-.92q.21-3.66.77-7.23A38.11,38.11,0,0,0,76,80a36,36,0,0,0,0,72h80A60.07,60.07,0,0,0,216,92Z\"/></svg>","deep":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M201.89,54.66A103.43,103.43,0,0,0,128.79,24H128A104,104,0,0,0,24,128v56a24,24,0,0,0,24,24H64a24,24,0,0,0,24-24V144a24,24,0,0,0-24-24H40.36A88,88,0,0,1,128,40h.67a87.71,87.71,0,0,1,87,80H192a24,24,0,0,0-24,24v40a24,24,0,0,0,24,24h16a24,24,0,0,0,24-24V128A103.41,103.41,0,0,0,201.89,54.66ZM64,136a8,8,0,0,1,8,8v40a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V136Zm152,48a8,8,0,0,1-8,8H192a8,8,0,0,1-8-8V144a8,8,0,0,1,8-8h24Z\"/></svg>","focus":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32l-96,96a8,8,0,0,1-11.32-11.32l27.72-27.72a40,40,0,1,0,17.87,31.09,8,8,0,1,1,16-.9,56,56,0,1,1-22.38-41.65L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z\"/></svg>","dinner":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0ZM216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40ZM200,53.9c-32.17,24.57-38.47,84.42-39.7,106.1H200ZM119.89,38.69a8,8,0,1,0-15.78,2.63L112,88.63a32,32,0,0,1-64,0l7.88-47.31a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z\"/></svg>","cocktails":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M237.66,45.66A8,8,0,0,0,232,32H24a8,8,0,0,0-5.66,13.66L120,147.31V208H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H136V147.31ZM43.31,48H212.69l-16,16H59.31ZM128,132.69,75.31,80H180.69Z\"/></svg>","coffee":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z\"/></svg>","onmind":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z\"/></svg>","together":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z\"/></svg>","morning":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M240,152H199.55a73.54,73.54,0,0,0,.45-8,72,72,0,0,0-144,0,73.54,73.54,0,0,0,.45,8H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM72,144a56,56,0,1,1,111.41,8H72.59A56.13,56.13,0,0,1,72,144Zm144,56a8,8,0,0,1-8,8H48a8,8,0,0,1,0-16H208A8,8,0,0,1,216,200ZM72.84,43.58a8,8,0,0,1,14.32-7.16l8,16a8,8,0,0,1-14.32,7.16Zm-56,48.84a8,8,0,0,1,10.74-3.57l16,8a8,8,0,0,1-7.16,14.31l-16-8A8,8,0,0,1,16.84,92.42Zm192,15.16a8,8,0,0,1,3.58-10.73l16-8a8,8,0,1,1,7.16,14.31l-16,8a8,8,0,0,1-10.74-3.58Zm-48-55.16,8-16a8,8,0,0,1,14.32,7.16l-8,16a8,8,0,1,1-14.32-7.16Z\"/></svg>","coding":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z\"/></svg>","restless":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z\"/></svg>","road":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M235.92,199A8,8,0,0,1,225,195.92L155.32,72H136v8a8,8,0,0,1-16,0V72H100.68L31,195.92A8,8,0,0,1,17,188.08L82.32,72H24a8,8,0,0,1,0-16H232a8,8,0,0,1,0,16H173.68L239,188.08A8,8,0,0,1,235.92,199ZM128,112a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V120A8,8,0,0,0,128,112Zm0,56a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V176A8,8,0,0,0,128,168Z\"/></svg>","gaming":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M176,112H152a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16ZM104,96H96V88a8,8,0,0,0-16,0v8H72a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16ZM241.48,200.65a36,36,0,0,1-54.94,4.81c-.12-.12-.24-.24-.35-.37L146.48,160h-37L69.81,205.09l-.35.37A36.08,36.08,0,0,1,44,216,36,36,0,0,1,8.56,173.75a.68.68,0,0,1,0-.14L24.93,89.52A59.88,59.88,0,0,1,83.89,40H172a60.08,60.08,0,0,1,59,49.25c0,.06,0,.12,0,.18l16.37,84.17a.68.68,0,0,1,0,.14A35.74,35.74,0,0,1,241.48,200.65ZM172,144a44,44,0,0,0,0-88H83.89A43.9,43.9,0,0,0,40.68,92.37l0,.13L24.3,176.59A20,20,0,0,0,58,194.3l41.92-47.59a8,8,0,0,1,6-2.71Zm59.7,32.59-8.74-45A60,60,0,0,1,172,160h-4.2L198,194.31a20.09,20.09,0,0,0,17.46,5.39,20,20,0,0,0,16.23-23.11Z\"/></svg>","chores":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM224,48V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM208,208V48H48V208H208Z\"/></svg>","lift":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.4,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z\"/></svg>","showkid":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M92,140a12,12,0,1,1,12-12A12,12,0,0,1,92,140Zm72-24a12,12,0,1,0,12,12A12,12,0,0,0,164,116Zm-12.27,45.23a45,45,0,0,1-47.46,0,8,8,0,0,0-8.54,13.54,61,61,0,0,0,64.54,0,8,8,0,0,0-8.54-13.54ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.11,88.11,0,0,0-84.09-87.91C120.32,56.38,120,71.88,120,72a8,8,0,0,0,16,0,8,8,0,0,1,16,0,24,24,0,0,1-48,0c0-.73.13-14.3,8.46-30.63A88,88,0,1,0,216,128Z\"/></svg>","family":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M240,208H224V136l2.34,2.34A8,8,0,0,0,237.66,127L139.31,28.68a16,16,0,0,0-22.62,0L18.34,127a8,8,0,0,0,11.32,11.31L32,136v72H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM48,120l80-80,80,80v88H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48Zm96,88H112V160h32Z\"/></svg>","miles":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M152,88a32,32,0,1,0-32-32A32,32,0,0,0,152,88Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,40Zm67.31,100.68c-.61.28-7.49,3.28-19.67,3.28-13.85,0-34.55-3.88-60.69-20a169.31,169.31,0,0,1-15.41,32.34,104.29,104.29,0,0,1,31.31,15.81C173.92,186.65,184,207.35,184,232a8,8,0,0,1-16,0c0-41.7-34.69-56.71-54.14-61.85-.55.7-1.12,1.41-1.69,2.1-19.64,23.8-44.25,36.18-71.63,36.18A92.29,92.29,0,0,1,31.2,208,8,8,0,0,1,32.8,192c25.92,2.58,48.47-7.49,67-30,12.49-15.14,21-33.61,25.25-47C86.13,92.35,61.27,111.63,61,111.84A8,8,0,1,1,51,99.36c1.5-1.2,37.22-29,89.51,6.57,45.47,30.91,71.93,20.31,72.18,20.19a8,8,0,1,1,6.63,14.56Z\"/></svg>","workout":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M248,120h-8V88a16,16,0,0,0-16-16H208V64a16,16,0,0,0-16-16H168a16,16,0,0,0-16,16v56H104V64A16,16,0,0,0,88,48H64A16,16,0,0,0,48,64v8H32A16,16,0,0,0,16,88v32H8a8,8,0,0,0,0,16h8v32a16,16,0,0,0,16,16H48v8a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V136h48v56a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16v-8h16a16,16,0,0,0,16-16V136h8a8,8,0,0,0,0-16ZM32,168V88H48v80Zm56,24H64V64H88V192Zm104,0H168V64h24V175.82c0,.06,0,.12,0,.18s0,.12,0,.18V192Zm32-24H208V88h16Z\"/></svg>","party":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M111.49,52.63a15.8,15.8,0,0,0-26,5.77L33,202.78A15.83,15.83,0,0,0,47.76,224a16,16,0,0,0,5.46-1l144.37-52.5a15.8,15.8,0,0,0,5.78-26Zm-8.33,135.21-35-35,13.16-36.21,58.05,58.05Zm-55,20,14-38.41,24.45,24.45ZM156,168.64,87.36,100l13-35.87,91.43,91.43ZM160,72a37.8,37.8,0,0,1,3.84-15.58C169.14,45.83,179.14,40,192,40c6.7,0,11-2.29,13.65-7.21A22,22,0,0,0,208,23.94,8,8,0,0,1,224,24c0,12.86-8.52,32-32,32-6.7,0-11,2.29-13.65,7.21A22,22,0,0,0,176,72.06,8,8,0,0,1,160,72ZM136,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm101.66,82.34a8,8,0,1,1-11.32,11.31l-16-16a8,8,0,0,1,11.32-11.32Zm4.87-42.75-24,8a8,8,0,0,1-5.06-15.18l24-8a8,8,0,0,1,5.06,15.18Z\"/></svg>","houseparty":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M120,64.37V16a8,8,0,0,0-16,0V64.37a88,88,0,1,0,16,0ZM183.54,144H151.77c-1.51-28.36-10.79-48.36-19.44-61.06A72.16,72.16,0,0,1,183.54,144Zm-95.3,16h47.52c-2,33.52-16.13,52.95-23.76,61.08C104.36,212.93,90.23,193.51,88.24,160Zm0-16c2-33.52,16.13-52.95,23.76-61.08,7.64,8.15,21.77,27.57,23.76,61.08Zm3.43-61.06C83,95.64,73.74,115.64,72.23,144H40.46A72.16,72.16,0,0,1,91.67,82.94ZM40.46,160H72.23c1.51,28.36,10.79,48.36,19.44,61.06A72.16,72.16,0,0,1,40.46,160Zm91.87,61.06c8.65-12.7,17.93-32.7,19.44-61.06h31.77A72.16,72.16,0,0,1,132.33,221.06ZM256,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,256,88ZM152,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H192V64a8,8,0,0,1-16,0V48H160A8,8,0,0,1,152,40Z\"/></svg>","burn":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z\"/></svg>","hype":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M248,80a28,28,0,1,0-51.12,15.77l-26.79,33L146,73.4a28,28,0,1,0-36.06,0L85.91,128.74l-26.79-33a28,28,0,1,0-26.6,12L47,194.63A16,16,0,0,0,62.78,208H193.22A16,16,0,0,0,209,194.63l14.47-86.85A28,28,0,0,0,248,80ZM128,40a12,12,0,1,1-12,12A12,12,0,0,1,128,40ZM24,80A12,12,0,1,1,36,92,12,12,0,0,1,24,80ZM193.22,192H62.78L48.86,108.52,81.79,149A8,8,0,0,0,88,152a7.83,7.83,0,0,0,1.08-.07,8,8,0,0,0,6.26-4.74l29.3-67.4a27,27,0,0,0,6.72,0l29.3,67.4a8,8,0,0,0,6.26,4.74A7.83,7.83,0,0,0,168,152a8,8,0,0,0,6.21-3l32.93-40.52ZM220,92a12,12,0,1,1,12-12A12,12,0,0,1,220,92Z\"/></svg>","commute":"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V184h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM69.2,48H186.8l24.89,56H44.31ZM64,200H40V184H64Zm128,0V184h24v16Zm24-32H40V120H216ZM56,144a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H64A8,8,0,0,1,56,144Zm112,0a8,8,0,0,1,8-8h16a8,8,0,0,1,0,16H176A8,8,0,0,1,168,144Z\"/></svg>"};
// ---------- what order the ways in come in ----------
// The row runs quietest first, which is where most listening starts, and then learns:
// the modes you open float to the front, most-opened leftmost, so the ones you actually
// use are in reach without a swipe. The tally is this browser's alone, it never leaves
// the page, and the row falls back to the plain order when it cannot be read. The full
// list behind the heading keeps that plain order, so there is one place where the
// they sit still and the colour runs quiet to loud down the page.
// The same tally, for styles rather than collections. A collection now runs to forty-odd
// entries, which is too many to read down every time, so the sort offers what this browser
// keeps coming back to. Local, never sent anywhere, and the sort falls back to the
// relevance order where there is nothing to go on, which is every first visit.
const STYLEUSE_KEY="musicatlas.styleuse";
function styleUse(){
  try{ const r=localStorage.getItem(STYLEUSE_KEY);
    const o=r?JSON.parse(r):null;
    return (o && typeof o==="object" && !Array.isArray(o)) ? o : {};
  }catch(e){ return {}; }
}
function bumpStyle(k){
  try{ const o=styleUse(); o[k]=(+o[k]||0)+1;
    // halved at 40, like the collection tally: a count that only grows freezes the order
    // around the first week's listening
    if(o[k]>=40) for(const i in o){ const v=Math.floor((+o[i]||0)/2); if(v) o[i]=v; else delete o[i]; }
    localStorage.setItem(STYLEUSE_KEY,JSON.stringify(o));
  }catch(e){}
}
const MODEUSE_KEY="musicatlas.modeuse";
function modeUse(){
  try{ const r=localStorage.getItem(MODEUSE_KEY);
    const o=r?JSON.parse(r):null;
    return (o && typeof o==="object" && !Array.isArray(o)) ? o : {};
  }catch(e){ return {}; }
}
function bumpMode(k){
  try{ const o=modeUse(); o[k]=(+o[k]||0)+1;
    // one mode must not run away with it: a tally that only ever grows would freeze the
    // order around whatever you liked in the first week, so everything halves at 40
    if(o[k]>=40) for(const i in o){ const v=Math.floor((+o[i]||0)/2); if(v) o[i]=v; else delete o[i]; }
    localStorage.setItem(MODEUSE_KEY,JSON.stringify(o));
  }catch(e){}
}
function modeOrder(adaptive){
  const base=MODES.slice().sort((a,b)=>(a[5]||3)-(b[5]||3));
  if(!adaptive) return base;
  const use=modeUse();
  return base.map((m,i)=>[m,i]).sort((a,b)=>{
    const ua=+use[a[0][0]]||0, ub=+use[b[0][0]]||0;
    return ub-ua || a[1]-b[1];
  }).map(x=>x[0]);
}

// ---------- the sort on the list ----------
// The row learns on its own and the list did not, which is the right split for the row but
// leaves the list with one order whether you are reading down it to pick a feeling or
// hunting a name you already know. So the list gets the choice stated out loud: quiet to
// loud, what this browser opens most, or plain A to Z. Quietest stays the default, so
// nothing moves until it is asked to.
// Loudest-first went: it is the same axis as Quietest read backwards, and as an icon it
// was the same speaker with one more wave on it, which is not a difference you can see at
// 18px. One intensity order is enough, and a stored "loud" falls back to it below.
const MODESORT_KEY="musicatlas.modesort";
const MODESORTS=[
  ["quiet","Quietest","Quietest first"],
  ["used","Most used","What this browser opens most"],
  ["az","A–Z","By name, A to Z"]];
function modeSort(){
  try{ const v=localStorage.getItem(MODESORT_KEY);
    return MODESORTS.some(s=>s[0]===v) ? v : "quiet";
  }catch(e){ return "quiet"; }
}
function setModeSort(v){ try{ localStorage.setItem(MODESORT_KEY,v); }catch(e){} }
function modeOrderBy(how){
  const lv=m=>m[5]||3, quiet=MODES.slice().sort((a,b)=>lv(a)-lv(b));
  if(how==="az")   return MODES.slice().sort((a,b)=>a[1].localeCompare(b[1]));
  if(how==="used"){
    // ties fall back to the quiet order, so an untouched browser still reads quiet to loud
    // rather than scrambling into whatever order MODES happens to be declared in
    const use=modeUse();
    return quiet.map((m,i)=>[m,i]).sort((a,b)=>
      ((+use[b[0][0]]||0)-(+use[a[0][0]]||0)) || a[1]-b[1]).map(x=>x[0]);
  }
  return quiet;
}
// ---------- an inline picker ----------
// The sorts were a segmented track of unlabelled glyphs. Four little drawings, one of
// them a speaker with one more wave on it than its neighbour, standing for ideas no
// drawing really carries: "most used" is not a shape. This is the control the Listen on
// row already uses, a word and a chevron with a native select over the top of them. One
// element instead of four, the order said in words rather than inferred from which glyph
// is lit, and the open list is the platform's own, which reads correctly to a screen
// reader and lands where a thumb expects it on a phone.
// Its own text class, not .svctx: paintPlay rewrites every .svctx on the panel to the
// service name, and a sort that renamed itself "Apple Music" is a funny bug to find.
function inlinePick(attr,label,opts,now){
  const cur=(opts.find(o=>o[0]===now)||opts[0])[1];
  return `<span class="svc svcinline sortpick" title="${esc(label)}">`
    + `<span class="sortx">${esc(cur)}</span>${SVCCHEV}`
    + `<select ${attr} aria-label="${esc(label)} Currently ${esc(cur)}.">`
    + opts.map(([k,l])=>`<option value="${esc(k)}"${k===now?" selected":""}>`
        + `${esc(l)}</option>`).join("")
    + `</select></span>`;
}
function modeSortHtml(){
  return `<div class="secthead picksort"><h3 class="secttl">Sorted by `
    + inlinePick('class="msortsel"',"Sort the collections.",MODESORTS,modeSort())
    + `</h3></div>`;
}
// How far a case leans, derived from its own name rather than drawn fresh.
//
// Math.random() would be wrong twice over. The row rebuilds on a resize, on a back, on
// every return to Explore, so a fresh roll each time means the whole shelf twitches
// while you are looking at it. And the row REORDERS as you use it, most-opened first, so
// anything keyed to position would re-lean a case that had not moved. Keyed to the mode
// id, Wind down leans the same way for as long as it is called Wind down.
//
// The circles used to lean. That was for the jewel cases, which wanted to read as things
// on a shelf; a circle has no up, so there is nothing to lean.
function modeSect(){
  if(typeof MODES==="undefined") return "";
  // Apple Maps puts its Places on a row of filled circles you swipe through, with the
  // whole set one tap away behind the heading. Twenty-six modes suit that exactly: a
  // few are in reach, the heading opens the lot, and nothing is buried under a scroll
  // of its own.
  const circles=modeOrder(true).map(m=>
    `<button type="button" class="mcirc lv${m[5]||3}" data-mode="${esc(m[0])}"`
    + ` title="${esc(m[2])}" aria-label="${esc(m[1])}. ${esc(m[2])}">`
    + `<i class="mco mi hasimg">${moodArt(m[0])}`
    + `<b class="facefb">${MODEICON[m[0]]||""}</b></i>`
    + `<span class="mclbl">${esc(m[1])}</span></button>`).join("");
  // "Collections" and nothing under it: the page this opens is called Collections, the
  // pictures say what they are, and "By mood, place or task" was a caption for a row that
  // had already shown you a cat asleep, a nightcap and a coffee shop.
  return sect("modes","Collections",
    `<div class="mrow" role="list">${circles}</div>`,
    "", "modes", "", true);
}
// the same set as a page, which is what the row's heading opens. The same tiles too:
// this was a two-column list of 28px thumbnails in a shaded card, so the one picture per
// collection — the thing that tells you what a collection is before the label does — was
// printed at a third of the size the row upstairs prints it at, and the card around it
// made the page read as a different component from the row it came from. Same circle,
// same label, laid out as a grid instead of a scroller, on the panel rather than in a box.
function modeListHtml(){
  if(typeof MODES==="undefined") return "";
  const tiles=modeOrderBy(modeSort()).map(m=>
    `<button type="button" class="mcirc lv${m[5]||3}" data-mode="${esc(m[0])}"`
    + ` title="${esc(m[2])}" aria-label="${esc(m[1])}. ${esc(m[2])}">`
    + `<i class="mco mi hasimg">${moodArt(m[0])}`
    + `<b class="facefb">${MODEICON[m[0]]||""}</b></i>`
    + `<span class="mclbl">${esc(m[1])}</span></button>`).join("");
  return `<div class="modelist modegrid" role="list">${tiles}</div>`;
}

// ---------- the panel as a stack of pages ----------
// Pushing slides the new page in from the right and the old one a little to the left,
// and the panel's own back button pops it. The alternative was a menu thrown over the
// top of the panel, which told you nothing about where you had been.
let PSTACK=[];
function panelCard(){ return $("panelBody").querySelector(".pcard"); }
function wrapStack(card){
  if(!card || card.querySelector(":scope > .pstack")) return null;
  const nav=card.querySelector(":scope > .navrow");
  const stack=document.createElement("div"); stack.className="pstack";
  const page=document.createElement("div"); page.className="ppage"; page.dataset.p="root";
  [...card.children].forEach(k=>{ if(k!==nav) page.appendChild(k); });
  stack.appendChild(page); card.appendChild(stack);
  return stack;
}
function resetPages(){ PSTACK=[]; }
// Twelve picks fitted on a screen and needed no order but the one they were written in.
// Forty do not, so the order is stated and chosen. Relevance is that written order, which
// is the collection's own argument about what fits it best, and stays the default.
const PICKSORT_KEY="musicatlas.picksort";
const PICKSORTS=[
  ["fit","Relevance","Best fit for this collection first"],
  ["az","A\u2013Z","By name, A to Z"],
  ["used","Most used","What this browser opens most"]];
function pickSort(){
  try{ const v=localStorage.getItem(PICKSORT_KEY);
    return PICKSORTS.some(p=>p[0]===v) ? v : "fit";
  }catch(e){ return "fit"; }
}
function setPickSort(v){ try{ localStorage.setItem(PICKSORT_KEY,v); }catch(e){} }
function pickOrder(m,how){
  const list=m[4].filter(([id])=>byId[id]);
  if(how==="az") return list.slice().sort((a,b)=>
    byId[a[0]].name.localeCompare(byId[b[0]].name));
  if(how==="used"){
    // ties keep the relevance order, so an untouched browser reads top to bottom as
    // written rather than scrambling into whatever order the ids happen to sit in
    const use=styleUse();
    return list.map((p,i)=>[p,i]).sort((a,b)=>
      ((+use[b[0][0]]||0)-(+use[a[0][0]]||0)) || a[1]-b[1]).map(x=>x[0]);
  }
  return list;
}
function pickSortHtml(){
  return inlinePick('class="psortsel"',"Sort this collection.",PICKSORTS,pickSort());
}
function pickSortHead(){
  return pickSortHead();
}
// A collection is a shelf of forty now, and picking off a shelf is work. This does the
// picking: one of these, opened, which is the whole transaction most of the time. It takes
// from the collection rather than from the map, so what it lands on is something that
// belongs here, and every one of them has a playlist to play.
function modeTop(m){
  const n=m[4].filter(([id])=>byId[id]).length;
  // The same row as Surprise me on the Explore panel, because it is the same act: the
  // scope is the only difference, and the second line is where that gets said. Drawn as a
  // button in accent fill first, which made it the loudest thing on the page and read as
  // the thing to do rather than the shortcut past the list.
  return `<div class="listgrp modetop">`
    + goRow("random","Surprise me",`One of these ${n}, at random`,null,
        ` data-pickany="${esc(m[0])}"`,
        `Open one of these ${n} styles, chosen at random`)
    + `</div>`
    + `<div class="secthead picksort"><h3 class="secttl">Styles that fit</h3>`
    + pickSortHtml() + `</div>`;
}
// A collection lists styles. Sometimes one recording is the whole point of it, and
// burying that in a list of forty-three is the wrong shape: this sits above the list on
// its own and opens the song rather than a playlist or a style.
//
// Its link is a whole URL per service, not the id fragment PLAY and SPLAY keep, because a
// track is addressed differently from a playlist. paintPlay repoints it with the rest,
// off .trkbtn, so the service picker moves this too.
function headTrack(k){
  const h = (typeof HEADTRACK!=="undefined") && HEADTRACK[k];
  if(!h) return "";
  const n = h.style && byId[h.style];
  return `<div class="trkcard">`
    + `<a class="trkbtn" target="_blank" rel="noopener"`
    + ` data-ap="${esc(h.ap||"")}" data-spid="${esc(h.sp||"")}"`
    + ` data-style="${esc(h.title)}" data-lbl="Play it on">`
    + `<span class="trktx"><b class="trkttl">${esc(h.title)}</b>`
    + `<span class="trkby">${esc(h.artist)} · ${h.year}</span>`
    + `<span class="plline"><span class="plsvc"></span><span class="plgo">${OPENGO}</span></span></span></a>`
    + (h.why?`<p class="trkwhy">${esc(h.why)}</p>`:"")
    + (n?`<button type="button" class="listrow trkgo" data-go="${esc(h.style)}"`
        + ` title="Show ${esc(n.name)} on the map">`
        + `<span class="lrlbl">Where it sits on the atlas</span>`
        + `<em class="lrct">${esc(n.name)}</em>${GOCHEV}</button>`:"")
    + `</div>`;
}
// The foot of a collection, where the style panel keeps its own: in the flow under
// everything, so it scrolls away rather than sitting over the list.
function pageShareBtn(key,name){
  return `<button type="button" class="shbtn wide" data-share`
    + ` data-sharekey="${esc(key)}" data-sharename="${esc(name)}"`
    + ` aria-label="Share ${esc(name)}" title="Share ${esc(name)}">`
    + SHAREGLYPH + TICKGLYPH + `<span class="shlbl">Share this collection</span></button>`;
}
function modePage(k){
  const m=typeof MODES!=="undefined" && MODES.find(x=>x[0]===k);
  if(!m) return null;
  return {title:m[2], icon:moodArt(m[0])+`<b class="facefb">${MODEICON[m[0]]||""}</b>`,
    iconCls:"hasimg", lv:m[5]||3, lede:m[3], top:headTrack(k)+modeTop(m),
    html:`<div class="picks">${modePicks(m)}</div>`
      + pageShareBtn("mode:"+m[0], m[1])};
}
function pageExists(key){
  if(key.indexOf("mode:")===0) return typeof MODES!=="undefined"
    && MODES.some(m=>m[0]===key.slice(5));
  if(key.indexOf("med:")===0) return !!mediaPage(key.slice(4));
  return !!PAGES_DEF[key];
}
function pushPage(key){
  if(key.indexOf("mode:")===0) bumpMode(key.slice(5));
  const def = key.indexOf("mode:")===0 ? (()=>modePage(key.slice(5)))
    : key.indexOf("med:")===0 ? (()=>mediaPage(key.slice(4)))
    : PAGES_DEF[key];
  if(!def) return false;
  const card=panelCard(); if(!card) return false;
  const stack=card.querySelector(":scope > .pstack") || wrapStack(card);
  if(!stack) return false;
  if(PSTACK.length && PSTACK[PSTACK.length-1].key===key) return true;
  const d=def(); if(!d) return false;
  const body=$("panelBody"), cur=stack.lastElementChild;
  const page=document.createElement("div");
  page.className="ppage pgin"; page.dataset.p=key;
  if(d.lv) page.classList.add("lv"+d.lv);
  page.innerHTML=`<h1 class="bigttl${d.icon?" withi":""}">${d.icon?`<i class="pgi mi${d.iconCls?" "+d.iconCls:""}">${d.icon}</i>`:""}<span class="mn">${esc(d.title)}</span></h1>`
    + (d.lede?`<p class="note pglede">${esc(d.lede)}</p>`:"")
    // a slot between the lede and the body, for a control that acts on the whole page
    + (d.top||"")
    + `<div class="more pgbody">${d.html}</div>`;
  PSTACK.push({key,title:d.title,scroll:body.scrollTop});
  setHash(key);
  stack.appendChild(page);
  // Going back is also an instant swap. Animating it hides the outgoing page 240ms later,
  // which takes its height out of the scroller and slides the offset we just restored.
  if(reduce || GOINGBACK){ cur.hidden=true; page.classList.remove("pgin"); }
  else {
    cur.classList.add("pgout");
    requestAnimationFrame(()=>page.classList.remove("pgin"));
    setTimeout(()=>{ cur.hidden=true; cur.classList.remove("pgout"); },240);
  }
  body.scrollTop=0; setOpen(true); syncBack(); closeNav();
  body.dispatchEvent(new Event("scroll"));
  amUpgrade();   // a pushed page brings its own artist links, which start life as search URLs
  paintPlay();   // and its own play links, which have no href until the service is read
  return true;
}
function popPage(){
  if(!PSTACK.length) return false;
  const card=panelCard(), stack=card&&card.querySelector(":scope > .pstack");
  if(!stack){ PSTACK=[]; syncBack(); return false; }
  const body=$("panelBody"), cur=stack.lastElementChild, prev=cur.previousElementSibling;
  const was=PSTACK.pop();
  setHash(PSTACK.length ? PSTACK[PSTACK.length-1].key : (state.sel||""));
  if(prev){ prev.hidden=false; if(!reduce){ prev.classList.add("pgout");
    requestAnimationFrame(()=>prev.classList.remove("pgout")); } }
  if(reduce) cur.remove();
  else { cur.classList.add("pgin");
    setTimeout(()=>{ cur.remove(); if(prev) body.scrollTop=was.scroll||0;
      body.dispatchEvent(new Event("scroll")); },240); }
  if(reduce && prev) body.scrollTop=was.scroll||0;
  syncBack();
  body.dispatchEvent(new Event("scroll"));
  return true;
}

// ---------- pages inside the panel ----------
// A panel is a stack. Tapping a row pushes a page in from the right and the back button
// pops it, rather than unfolding a block under your thumb or throwing a menu over the
// top: a list of seventeen styles is a place you go, not a thing that drops down.
// ---------- the order the most influential come in ----------
// The page is an argument about influence, so influence is the default and stays first.
// The other two are the same pair the collections page offers, for the same reasons: a
// name you already know, or the ones this browser keeps opening.
const TOPSORT_KEY="musicatlas.topsort";
const TOPSORTS=[
  ["infl","Influence","Most came out of it first"],
  ["az","A\u2013Z","By name, A to Z"],
  ["used","Most used","What this browser opens most"]];
function topSort(){
  try{ const v=localStorage.getItem(TOPSORT_KEY);
    return TOPSORTS.some(t=>t[0]===v) ? v : "infl";
  }catch(e){ return "infl"; }
}
function setTopSort(v){ try{ localStorage.setItem(TOPSORT_KEY,v); }catch(e){} }
function topOrderBy(how){
  const ids=topIds();
  if(how==="az") return ids.slice().sort((a,b)=>byId[a].name.localeCompare(byId[b].name));
  if(how==="used"){
    // ties keep the influence order, so an untouched browser reads as the page's own
    // argument rather than scrambling into whatever order the ids happen to sit in
    const use=styleUse();
    return ids.map((id,i)=>[id,i]).sort((a,b)=>
      ((+use[b[0]]||0)-(+use[a[0]]||0)) || a[1]-b[1]).map(x=>x[0]);
  }
  return ids;
}
function topSortHtml(){
  return `<div class="secthead picksort"><h3 class="secttl">Sorted by `
    + inlinePick('class="tsortsel"',"Sort the most influential.",TOPSORTS,topSort())
    + `</h3></div>`;
}
// The same shape the collections page is: a grid of art with the name under it, on the
// panel rather than in a card. It was a boxed list of coloured dots, which told you the
// family and nothing else, on a page whose whole subject is styles you might not know
// yet. The art is what says what a style sounds like before the name does.
function topGridHtml(){
  return `<div class="toplist topgrid" role="list">` + topOrderBy(topSort()).map(id=>{
    const x=byId[id];
    return `<button type="button" class="mcirc tcirc" data-go="${esc(id)}"`
      + ` title="Show ${esc(x.name)} on the map"`
      + ` aria-label="${esc(x.name)}. ${x.children.length} styles came out of it.">`
      // the badge sits outside the art's own clip, so the disc can crop its picture
      // while the count still overlaps the edge of it
      + `<span class="tart"><i class="mco tco">${cover(id,x,true)}</i>`
      + `<b class="tcct">${x.children.length}</b></span>`
      + `<span class="mclbl">${esc(x.name)}</span></button>`;
  }).join("") + `</div>`;
}
function styleRows(ids,detail){
  return `<div class="listgrp plist">` + ids.map(id=>{ const x=byId[id];
    return `<button type="button" class="listrow" data-go="${x.id}">`
      + `<i class="dot" style="background:${FAM[x.fam].c}"></i>`
      + `<span class="lrlbl">${esc(x.name)}</span>`
      + `<em class="lrct">${detail(x)}</em>${GOCHEV}</button>`; }).join("") + `</div>`;
}
const PAGES_DEF={
  artists:()=>{
    const n=state.sel?byId[state.sel]:null; if(!n) return null;
    const all=artistAll(n), key=n.whoList||[];
    // the same symbol and the same colour the circle upstairs wears, so a name you saw in
    // the row is the same thing here. Tinted rather than filled, which is what the ways in
    // do between their circles and their list: a column of saturated discs is a lot of
    // paint for a list you are reading down, and the hue carries the identity on its own.
    const row=(x,i)=>{ const r=artRole(x);
      return `<a class="listrow amrow r-${r}" href="${svcHref(x)}" data-name="${esc(x)}"`
      + ` target="_blank" rel="noopener" title="Open ${esc(x)} in ${svcName()}">`
      + artFace(x,"lrico mi")
      + `<span class="lrlbl">${esc(x)}</span>`
      + (activeYears(x)?`<em class="lrct amyr">${esc(activeYears(x))}</em>`:"")
      + `<i class="lrcv lrgov">${OPENGO}</i></a>`; };
    return {title:"Key artists",
      lede:`Everyone the map names for ${n.name}, the three or four on the panel first.`,
      // the same control the style panel carries, because this is where the links it
      // governs actually are. Saying "each one opens in Apple Music" in the lede was a
      // fact with no handle on it, and it went stale the moment you changed the service
      top:`<div class="sect sect-listen pagelisten"><div class="secthead">`
        + `<h3 class="secttl">Listen on ${svcPicker("inline")}</h3></div></div>`,
      html:`<div class="listgrp sep amlist">${all.map(row).join("")}</div>`};
  },
  modes:()=>({title:"Collections",
    lede:"Twenty-eight moods, places and tasks, each opening the styles that suit it.",
    top:modeSortHtml(),
    html:modeListHtml()+copyRow("modes")}),
  picks:()=>picksPage("pete"),
  roots:()=>({title:"Roots",
    lede:"Styles with nothing before them here. Everything else on the map descends from these.",
    html:styleRows(firstLevel(),x=>x.year<1950?x.disp:x.year)}),
  top:()=>({title:"Most influential",
    lede:"The styles that led to the most, counted by what came directly out of them.",
    top:topSortHtml(),
    html:topGridHtml()+copyRow("top")}),
  about:()=>{ const np=playable().length,
      withSrc=DATA.filter(r=>Array.isArray(r[7])&&r[7].length).length;
    return {title:"About this map of what grew out of what", html:`
    <div class="about"><div class="abouthd"><img class="appicon" alt="" src="${ICONSRC()}"><p class="stats">${$("stats").textContent} · ${np} with a playlist</p></div>
    <h4 class="subh">What it is for</h4>
    <p>Every style here is placed at the year it cohered into a named, recorded scene, and joined to the styles it grew out of. Time runs left to right, so following a line backwards shows you what a sound is made of.</p>
    <p>It is not trying to settle anything. It is trying to make the inheritance visible, so you can get from a record you already love to the thing it came out of, and hear why they are related.</p>
    <h4 class="subh">Where it comes from</h4>
    <p>This was compiled by hand, not pulled from a database. Styles, years and parentage come from the general music-historical record: scene histories, discographies, reference works and critical writing, cross-checked where accounts disagree. ${withSrc} entries carry a Sources list naming the pages they were checked against. The others stand on that general reading and are not individually cited.</p>
    <p>A link means one style is a direct stylistic parent of another, not every influence on it and not merely something it shared a decade with. Years mark when a scene cohered, not its earliest precursor. Styles from elsewhere appear when they charted here or seeded scenes here.</p>
    <p>Boundaries, dates and parentage are all contested, and a lineage is a reading rather than a fact. Take each link as the consensus view and the map as an argument you are free to disagree with.</p>
    <h4 class="subh">What it is built on</h4>
    <p>The map is one HTML file with nothing fetched at runtime, so it keeps working with no connection. Every icon is <b>Phosphor</b>, the Duotone weight, under the MIT licence, inlined as paths rather than loaded from anywhere. Playlists open in Apple Music or Spotify, which do need a connection. Everything else here was drawn or written for this map.</p>
    <h4 class="subh">The map as data</h4>
    <p>The shape of the map is published as JSON, to be handed to a language model: ask it where to go next from something you already like, and the lineage lets it say <i>why</i> two things are related rather than only that they are. Every style in it carries the address of its own panel here, so an answer can link to the thing it names.</p>
    <p>It is the structure and the descriptions, not a catalogue of recordings. There are no artist lists and no song titles: those are most of the bytes, they are already in the app behind each playlist, and a file too big to fetch is no use to anyone.</p>
    <p>It carries a note to its reader explaining what the lineage does and does not claim, and that coverage is uneven: ${np} of ${DATA.length} styles have a playlist. Absence in the file is not evidence that something does not exist.</p>
    ${dataRow()}
    <h4 class="subh">The playlists</h4>
    <p>Each playlist runs in chronological order, and the first few tracks are deliberately not the style proper. They are the records that pushed it into being, or the earliest examples of it, cut before anyone had a name for it.</p>
    <p>So a playlist starts just outside its own style and arrives at it, which is the same move the map makes. If the opening tracks sound like something else, that is the point: that is what it grew out of.</p>
    <h4 class="subh">Reading the map</h4>
    <p>A play triangle inside a dot marks a style with a playlist, linked in its panel. The bigger the name, the more styles grew out of it. Everything before 1950 sits left of the divider, on its own compressed scale, and is set in italic. Zoomed out, the styles that led nowhere show as plain dots.</p>
    <button type="button" class="aboutcopy" data-aboutcopy="about"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 11.6a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-1 1"/><path d="M11.6 8.4a3.2 3.2 0 0 0-4.6 0L4.4 11a3.2 3.2 0 0 0 4.6 4.6l1-1"/></svg><span class="lbl">Copy a link to this</span></button></div>`}; },
  install:()=>({title:"How to install it", html:`<div class="about">${openInRow()}<p>Music Atlas is a web page, so there is nothing to download and no app store. Every platform below can pin it to a home screen or dock, where it opens full screen with no browser chrome around it.</p><h4 class="subh">iPhone and iPad</h4><ol class="steps"><li>Open this page in <b>Safari</b>. Chrome and Firefox on iOS cannot do this.</li><li>Tap the <b>Share</b> button, the square with an arrow coming out of it: ${SHAREGLYPH}${shareStep()}</li><li>Scroll down the list and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><h4 class="subh">Android</h4><ol class="steps"><li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>three dots</b> at the top right.</li><li>Tap <b>Add to Home screen</b>, then <b>Install</b> or <b>Add</b>. Samsung Internet and Firefox have the same item in their own menus.</li></ol><h4 class="subh">Mac</h4><ol class="steps"><li>In <b>Safari</b>, choose <b>File &rsaquo; Add to Dock</b>, then <b>Add</b>. It lands in the Dock and opens in its own window.</li><li>In <b>Chrome</b>, the same thing is under the three dots at <b>Cast, Save and Share &rsaquo; Install page as app</b>.</li></ol><h4 class="subh">Windows</h4><ol class="steps"><li>In <b>Edge</b> or <b>Chrome</b>, look for the <b>install icon</b> at the right-hand end of the address bar, a monitor with an arrow in it, and click it.</li><li>No icon there? Open the <b>three dots</b> menu and choose <b>Apps &rsaquo; Install this site as an app</b> in Edge, or <b>Cast, Save and Share &rsaquo; Install page as app</b> in Chrome.</li><li>Tick <b>Pin to taskbar</b> when it offers, and it behaves like any other app.</li></ol><details class="xfold"><summary class="subh"><span>Linux: Ubuntu and Linux Mint</span>${FOLDTRI}</summary><div class="xfoldb"><p class="note">Both ship <b>Firefox</b> as the default browser, and Firefox on the desktop cannot do this at all: it dropped the feature years ago and has no Install or Add to Home Screen item in any menu. You need a Chromium-based browser for this part. On Ubuntu, <code>sudo snap install chromium</code>; on Mint, <code>sudo apt install chromium</code>. Google Chrome and Edge work the same way.</p><ol class="steps"><li>Open this page in <b>Chromium</b>, <b>Chrome</b> or <b>Edge</b>.</li><li>Look for the <b>install icon</b> at the right-hand end of the address bar, a monitor with an arrow in it, and click it. Otherwise open the <b>three dots</b> menu and choose <b>Cast, Save and Share &rsaquo; Install page as app</b>.</li><li>Click <b>Install</b>. It is added to your applications menu like anything installed from a package.</li><li>To keep it to hand: on <b>Ubuntu</b>, open <b>Show Applications</b>, right-click it and choose <b>Pin to Dash</b>. On <b>Mint</b>, find it in the menu, right-click and choose <b>Add to panel</b> or <b>Add to desktop</b>.</li></ol><p class="note">Ubuntu's Chromium is a snap, which is confined and keeps its own storage. That changes nothing here, but it does mean the installed copy is sandboxed separately from Firefox and will not see anything saved in it.</p></div></details><h4 class="subh">What you get</h4><p>The whole map is a single file, so once it has loaded it keeps working without a connection. The playlist links still need one, since those open Apple Music or Spotify.</p><button type="button" class="aboutcopy" data-aboutcopy="install"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 11.6a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-1 1"/><path d="M11.6 8.4a3.2 3.2 0 0 0-4.6 0L4.4 11a3.2 3.2 0 0 0 4.6 4.6l1-1"/></svg><span class="lbl">Copy a link to this</span></button></div>`})
};
// the link that puts a page's own URL on the clipboard, which About and How to install
// already ended with. Any page in FOLDS can be opened straight from that link.
function copyRow(hash){
  return `<button type="button" class="aboutcopy pagecopy" data-aboutcopy="${esc(hash)}">`
    + `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.4 11.6a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-1 1"/><path d="M11.6 8.4a3.2 3.2 0 0 0-4.6 0L4.4 11a3.2 3.2 0 0 0 4.6 4.6l1-1"/></svg>`
    + `<span class="lbl">Copy a link to this</span></button>`;
}

// ---------- guest picks ----------
// A section that belongs to a person instead of to a style. Everything in it is an
// ordinary Go deeper row living on whatever styles it belongs to; PICKED only says whose
// it is. So this page is a view over the existing data rather than a second copy of it,
// and a pick cannot drift out of sync with the row it is.
const PICKER_GLYPH="<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z\"/></svg>";
function pickEntry(url){ return (typeof PICKED!=="undefined" && PICKED[url]) || null; }
function pickerOf(url){ const e=pickEntry(url); return e ? (Array.isArray(e)?e[0]:e) : ""; }
function pickNote(url){ const e=pickEntry(url); return (Array.isArray(e) && e[1]) || ""; }
function pickers(){ return (typeof PICKERS!=="undefined" && PICKERS) || {}; }
// every picked source, once, with the styles it sits on. A work picked for seven styles
// is one pick that names seven places, not seven picks.
function pickList(who){
  const seen=new Map();
  for(const [sid,rows] of Object.entries((typeof READ!=="undefined"&&READ)||{})){
    for(const r of rows){
      if(pickerOf(r[0])!==who) continue;
      if(!seen.has(r[0])) seen.set(r[0],{row:r,styles:[]});
      if(byId[sid]) seen.get(r[0]).styles.push(sid);
    }
  }
  return [...seen.values()];
}
function pickCount(who){ return pickList(who).length; }
// the placeholder. There is no photograph yet, so the mark is drawn rather than loaded,
// and the day there is one only PICKERS[].avatar changes.
function pickerAvatar(p,size){
  const cls="pava"+(size?" "+size:"");
  return p.avatar
    ? `<span class="${cls}" style="background-image:url(${esc(p.avatar)})"></span>`
    : `<span class="${cls} pavanone">${PICKER_GLYPH}</span>`;
}
function picksPage(who){
  const p=pickers()[who]; if(!p) return null;
  const items=pickList(who);
  if(!items.length) return null;
  // the pick's own note where it has one, so the book is described as a book here and as
  // a chapter of itself over on the style
  const html=items.map(x=>sourceItem(x,pickNote(x.row[0]))).join("");
  return {title:p.name+"\u2019s Picks",
    lede:p.blurb,
    top:`<div class="pickhead">${pickerAvatar(p,"big")}`
      + `<div class="pickwho2"><b>${esc(p.name)}</b><em>${esc(p.role)}</em></div></div>`,
    html:`<div class="picklist">${html}</div>`+copyRow(PICKS_HASH)};
}

// ---------- everything to read, watch and hear, by medium ----------
// The same view trick as the picks page: these pages hold no sources of their own, they
// only gather the Go deeper rows that already live on the styles. A source on four
// styles is one entry here that names four places.
//
// Podcasts and audio are one row and not two. The data knows a source is something you
// listen to; it does not know whether that is a podcast episode or an archive recording,
// and splitting them on a guess would put things in the wrong half.
const MEDIA=[
  ["read","Articles","Reporting, reviews, obituaries and longform"],
  ["book","Books","Histories, memoirs, oral histories and 33 1/3s"],
  ["listen","Audio","Podcasts, interviews and recordings"],
  ["watch","Videos","Documentaries, explainers and demonstrations"],
  ["look","Pictures","Photo essays and scene reports"]
];
const MEDPAGEICON={
  read:"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M88,112a8,8,0,0,1,8-8h80a8,8,0,0,1,0,16H96A8,8,0,0,1,88,112Zm8,40h80a8,8,0,0,0,0-16H96a8,8,0,0,0,0,16ZM232,64V184a24,24,0,0,1-24,24H32A24,24,0,0,1,8,184.11V88a8,8,0,0,1,16,0v96a8,8,0,0,0,16,0V64A16,16,0,0,1,56,48H216A16,16,0,0,1,232,64Zm-16,0H56V184a23.84,23.84,0,0,1-1.37,8H208a8,8,0,0,0,8-8Z\"/></svg>",
  book:"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M231.65,194.55,198.46,36.75a16,16,0,0,0-19-12.39L132.65,34.42a16.08,16.08,0,0,0-12.3,19l33.19,157.8A16,16,0,0,0,169.16,224a16.25,16.25,0,0,0,3.38-.36l46.81-10.06A16.09,16.09,0,0,0,231.65,194.55ZM136,50.15c0-.06,0-.09,0-.09l46.8-10,3.33,15.87L139.33,66Zm6.62,31.47,46.82-10.05,3.34,15.9L146,97.53Zm6.64,31.57,46.82-10.06,13.3,63.24-46.82,10.06ZM216,197.94l-46.8,10-3.33-15.87L212.67,182,216,197.85C216,197.91,216,197.94,216,197.94ZM104,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32ZM56,48h48V64H56Zm0,32h48v96H56Zm48,128H56V192h48v16Z\"/></svg>",
  listen:"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M168,16A72.07,72.07,0,0,0,96,88a73.29,73.29,0,0,0,.63,9.42L27.12,192.22A15.93,15.93,0,0,0,28.71,213L43,227.29a15.93,15.93,0,0,0,20.78,1.59l94.81-69.53A73.29,73.29,0,0,0,168,160a72,72,0,1,0,0-144Zm56,72a55.72,55.72,0,0,1-11.16,33.52L134.49,43.16A56,56,0,0,1,224,88ZM54.32,216,40,201.68,102.14,117A72.37,72.37,0,0,0,139,153.86ZM112,88a55.67,55.67,0,0,1,11.16-33.51l78.34,78.34A56,56,0,0,1,112,88Zm-2.35,58.34a8,8,0,0,1,0,11.31l-8,8a8,8,0,1,1-11.31-11.31l8-8A8,8,0,0,1,109.67,146.33Z\"/></svg>",
  watch:"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M216,104H102.09L210,75.51a8,8,0,0,0,5.68-9.84l-8.16-30a15.93,15.93,0,0,0-19.42-11.13L35.81,64.74a15.75,15.75,0,0,0-9.7,7.4,15.51,15.51,0,0,0-1.55,12L32,111.56c0,.14,0,.29,0,.44v88a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V112A8,8,0,0,0,216,104ZM192.16,40l6,22.07-22.62,6L147.42,51.83Zm-66.69,17.6,28.12,16.24-36.94,9.75L88.53,67.37Zm-79.4,44.62-6-22.08,26.5-7L94.69,89.4ZM208,200H48V120H208v80Z\"/></svg>",
  look:"<svg viewBox=\"0 0 256 256\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M208,32H80A16,16,0,0,0,64,48V64H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V192h16a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM80,48H208v69.38l-16.7-16.7a16,16,0,0,0-22.62,0L93.37,176H80Zm96,160H48V80H64v96a16,16,0,0,0,16,16h96Zm32-32H116l64-64,28,28v36Zm-88-64A24,24,0,1,0,96,88,24,24,0,0,0,120,112Zm0-32a8,8,0,1,1-8,8A8,8,0,0,1,120,80Z\"/></svg>"
};
// unique by URL, with the styles each one sits on, sorted by title so a long list can be
// scanned. The same shape pickList returns, so one renderer draws both.
function sourceList(pred){
  const seen=new Map();
  for(const [sid,rows] of Object.entries((typeof READ!=="undefined"&&READ)||{})){
    for(const r of rows){
      if(!pred(r)) continue;
      if(!seen.has(r[0])) seen.set(r[0],{row:r,styles:[]});
      if(byId[sid]) seen.get(r[0]).styles.push(sid);
    }
  }
  const key=x=>x.row[1].replace(/^(the|a|an)\s+/i,"").toLowerCase();
  return [...seen.values()].sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
}
function medCount(t){ return sourceList(r=>r[7]===t).length; }
// one entry: the row as it appears on a style, and where it appears
function sourceItem({row,styles},note){
  const r = note ? row.slice(0,6).concat([note],row.slice(7)) : row;
  const where=styles.map(id=>`<button type="button" class="pickwho" data-go="${esc(id)}">`
    + `<i class="dot" style="background:${FAM[byId[id].fam].c}"></i>`
    + `<span>${esc(byId[id].name)}</span></button>`).join("");
  return `<div class="pickit">${readRow(r)}`
    + (where?`<div class="pickon"><span class="pickonl">On</span>${where}</div>`:"")
    + `</div>`;
}
function mediaPage(t){
  const m=MEDIA.find(x=>x[0]===t); if(!m) return null;
  const items=sourceList(r=>r[7]===t);
  if(!items.length) return null;
  return {title:m[1], lede:m[2]+". "+items.length+" of them, across the whole map.",
    html:`<div class="picklist">${items.map(x=>sourceItem(x)).join("")}</div>`};
}
// the section under the browse list: a person's shelf first, then the whole library by
// medium. Separate from Explore above it, which is about styles rather than sources.
function deeperSect(){
  // Pete's Picks is a person's shelf and the rest is the library by medium, so they are
  // two groups rather than one list of six. The counts came off: five numbers stacked
  // down the edge of a panel read as a scoreboard, and the number only matters once you
  // are inside the thing counting. Each page still says how many it holds.
  const pete=pickCount("pete")
    ? `<div class="listgrp sep">`
      + pageRow("picks","Pete\u2019s Picks",null,"Pete\u2019s Picks: sources chosen by a guest")
      + `</div>` : "";
  const med=MEDIA.map(([t,label,blurb])=>medCount(t)
      ? pageRow("med:"+t,label,null,label+": "+blurb)
      : "").join("");
  return sect("deeper","Go deeper",
    pete + `<div class="listgrp two medgrp">${med}</div>`,
    "", "", "Stories and context behind the music.");
}
function pageRow(key,label,count,title){
  return `<button type="button" class="listrow" data-page="${key}"${title?` title="${esc(title)}" aria-label="${esc(title)}"`:""}>`
    + rowIcon(key)
    + `<span class="lrlbl">${esc(label)}</span>${count!=null?`<em class="lrct">${count}</em>`:""}${GOCHEV}</button>`;
}
// What the map is, folded shut under its own title, the way a style's description sits
// under its name. It was a row at the foot of the panel before, which is the last place
// anyone looks for the thing that explains the first screen they saw. Short on purpose:
// the full page is one tap further on, and it still holds the sources, the colophon and
// the data link.
// It was a fold directly under the title, which put the one paragraph explaining the
// whole thing in the one place nobody opens, and spent the top of the panel on a closed
// row. It is an ordinary section now, in the body with the others, open: a short
// paragraph is cheaper to read than a disclosure triangle is to decide about.
function aboutMapSect(){
  const np=playable().length;
  return sect("about","About this map",
    `<p class="note">`
    + esc(DATA.length+" music styles, each placed at the year it cohered "
      + "into a named, recorded scene and joined to the styles it grew out of, so following "
      + "a line backwards shows you what a sound is made of. "
      + np+" of them carry an essential playlist, and each one starts just outside its own "
      + "style, with the records that pushed it into being, and arrives at it.")
    + `</p>`
    // the same row Pete's Picks is: a grouped card with the glyph on the left and the
    // chevron on the right, rather than a line of text pretending to be a link
    + `<div class="listgrp abmore">`
    + pageRow("about","Read more about this atlas",null,
        "The sources, the colophon and the map as data")
    + `</div>`);
}
// The two settings that belong to the whole app rather than to any style: where playlists
// open, and how to keep the map to hand. Compact and at the foot, because you set the
// service once and install once.
function ovFooter(){
  return `<div class="sect sect-appset nohead"><div class="secbody">`
    + `<div class="svcline"><span class="svclbl">Music service</span>${svcPicker("inline")}</div>`
    + `<button type="button" class="instlink" data-page="install"`
    + ` aria-label="How to install Music Atlas">Install Music Atlas${GOCHEV}</button>`
    + `</div></div>`;
}
function emptyPanel(){
  setTint("");
  syncBack();                      // so the map pill is in its home state from the first paint
  setExpandLabel("", "What grew out of what", "Explore");
  setPbar("Music Atlas", FAMS.length+" families · "+nodes.length+" styles");
  syncPull();
  const top=[...nodes].sort((a,b)=>b.children.length-a.children.length||a.year-b.year).slice(0,12);
  const np=playable().length;
  const withSrc=DATA.filter(r=>Array.isArray(r[7])&&r[7].length).length;
  resetPages();
  $("panelBody").innerHTML=`<div class="pcard ovcard"><div class="navrow"><div class="navleft"><button id="panelBack" class="navback" type="button" hidden aria-label="Back" title="Back"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10H4.6"/><path d="M9.4 4.6L4 10l5.4 5.4"/></svg><span class="bklbl"></span><svg class="bkmap" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 5.4L7.4 3.4v11.2L2.8 16.6z"/><path d="M7.4 3.4l5.2 2v11.2l-5.2-2z"/><path d="M12.6 5.4l4.6-2v11.2l-4.6 2z"/></svg></button></div><div class="navttl navgap ovttl"><span class="mn">Music Atlas</span></div>${CLOSEBTN}</div><h1 class="bigttl"><span class="mn">Music Atlas</span></h1><div class="more">
    ${modeSect()}
    ${onMapSect()}
    ${aboutMapSect()}
    ${deeperSect()}
    ${ovFooter()}
    ${appShareBtn()}</div></div>`;
  wrapStack(panelCard());
}



// ---------- floating Wikipedia reader ----------
const wrap=$("wikiwrap"), wframe=$("wikiframe"), wfail=$("wikifail");
let wtimer=0;
function mobileWiki(u){ return u.replace("://en.wikipedia.org","://en.m.wikipedia.org"); }
function openWiki(url,title){
  $("wikittl").textContent=title; $("wikiout").href=url; wfail.querySelector(".go").href=url; $("wikihintlink").href=url;
  wfail.hidden=true; wframe.hidden=false; wframe.src=mobileWiki(url);
  wrap.hidden=false; document.body.style.overflow="hidden";
  clearTimeout(wtimer); wtimer=setTimeout(()=>{ if(!wframe.dataset.ok) wikiFail(); },3500);
}
function wikiBlocked(){ // a refused frame sits on about:blank (readable); a real article is cross-origin and throws
  try{ const h=wframe.contentWindow && wframe.contentWindow.location.href; return !h || h==="about:blank"; }catch(e){ return false; }
}
function wikiFail(){ clearTimeout(wtimer); wfail.hidden=false; wframe.hidden=true; }
wframe.addEventListener("load",()=>{ if(wikiBlocked()){ wikiFail(); return; } wframe.dataset.ok="1"; clearTimeout(wtimer); wfail.hidden=true; });
wframe.addEventListener("error",wikiFail);
function closeWiki(){ wrap.hidden=true; wframe.removeAttribute("src"); delete wframe.dataset.ok; clearTimeout(wtimer); document.body.style.overflow=""; }
wrap.addEventListener("click",e=>{ if(e.target.closest("[data-wclose]")) closeWiki(); });
document.addEventListener("click",e=>{ const a=e.target.closest("a.wk:not(.pl):not(.sp)"); if(!a) return; e.preventDefault(); openWiki(a.href, a.dataset.name||"Wikipedia"); });

// ---------- search ----------
// Three kinds of thing can come back, because three kinds of thing are worth finding.
// A STYLE is the map's own content and wins on any decent match. A SOURCE is one of the
// Go deeper rows: the map holds several hundred books, articles and films, and until now
// the only way to a named one was to already know which style it sat on. A PAGE is a
// place rather than a thing, so that typing "Pete" or "podcasts" goes where you meant.
//
// Scores are a single ladder rather than a bucket per kind, so a precise title can beat
// a loose style match while a style name still beats everything.
const q=$("q"), res=$("res"); let hits=[], act=0;
// built once: a flat list of every source with the styles it sits on, and one blob of
// lowercase text to match against, so typing is a scan over an array rather than a walk
// of READ on every keystroke.
let SRC=null;
function srcIndex(){
  if(SRC) return SRC;
  SRC=sourceList(()=>true).map(x=>{
    const r=x.row;
    return {row:r, styles:x.styles, url:r[0],
      title:(r[1]||"").toLowerCase(), by:(r[2]||"").toLowerCase(),
      kind:(r[4]||"").toLowerCase(), note:(r[6]||"").toLowerCase(),
      subj:(r[8]||"").toLowerCase(), who:pickerOf(r[0])};
  });
  return SRC;
}
// Every crossing, with its tracklist flattened into one blob to match against. The acts
// on these are not in ROSTER and the titles are not in SONGS, because they belong to no
// single style: without this index a crossing is invisible to a search for the one act
// that made you want it.
let XIDX=null;
function xIndex(){
  if(XIDX) return XIDX;
  const X=(typeof XPLAY!=="undefined")?XPLAY:[];
  XIDX=X.map(x=>{
    const tr=x.tracks||[];
    // a credit naming two acts is two names to type, so it is split rather than kept whole
    const acts=[]; const seen=new Set();
    for(const [a] of tr) for(const one of String(a).split(/,\s*/)){
      const k=one.toLowerCase(); if(!k||seen.has(k)) continue; seen.add(k); acts.push(one); }
    const songs=tr.map(t=>t[1]);
    return {x, acts, songs,
      title:(x.title||"").toLowerCase(), note:(x.note||"").toLowerCase(),
      who:acts.join(" | ").toLowerCase(), what:songs.join(" | ").toLowerCase()};
  });
  return XIDX;
}
// the pages this search can land on, with the words someone would actually type for them
function pageIndex(){
  const out=MEDIA.filter(([t])=>medCount(t)).map(([t,label,blurb])=>({
    key:"med:"+t, label, sub:medCount(t)+" across the map",
    terms:(label+" "+blurb).toLowerCase()}));
  for(const [who,p] of Object.entries(pickers())){
    if(!pickCount(who)) continue;
    out.unshift({key:"picks", label:p.name+"\u2019s Picks",
      sub:pickCount(who)+" chosen by a guest",
      terms:(p.name+" picks "+p.role+" "+p.blurb).toLowerCase()});
  }
  return out;
}
// Does the query land at the START of a word in this blob, or inside one?
//
// Everything here is matched with a bare indexOf, which has no idea where words begin, so
// typing "andy" hits Mandy Patinkin, Randy Stonehill, Brandy, Sandy Nelson, Randy Travis
// and Randy Newman. Six accidents scored exactly as high as a real one and filled the
// eight rows, which is how a playlist whose subject is Andy Shauf fell off a search for
// "andy" and only came back at "andy s".
//
// A hit inside a longer word is not nothing, so it still scores; it just ranks under
// every hit that starts a word.
const WORDC=/[a-z0-9]/;
function wordHit(blob,t){
  let i=blob.indexOf(t);
  while(i>=0){ if(i===0 || !WORDC.test(blob[i-1])) return true; i=blob.indexOf(t,i+1); }
  return false;
}
// the same match, ranked by whether it began a word: MID is what a hit inside one costs
const MID=0.9;
const rank=(blob,t,sc)=>wordHit(blob,t) ? sc : sc+MID;
function find(t){
  t=t.trim().toLowerCase(); if(!t) return [];
  const out=[];
  // a title match is worth less than a name, a note or an artist, and is not tried at all
  // on a short query, where a word like "you" would match most of the playlists at once
  const score=n=>{ const nm=n.name.toLowerCase(); if(nm.startsWith(t)) return 0;
    if(nm.includes(t)) return rank(nm,t,1);
    if(n.search.includes(t)) return rank(n.search,t,2);
    if(t.length>=4 && n.songsearch.includes(t)) return rank(n.songsearch,t,3); return 9; };
  for(const n of nodes){ const sc=score(n); if(sc<9) out.push({k:"style",sc,n,ord:n.year}); }
  for(const p of pageIndex()){
    const lb=p.label.toLowerCase();
    const sc = lb.startsWith(t) ? 1.2 : lb.includes(t) ? 2.5
      : (t.length>=3 && p.terms.includes(t)) ? 4.5 : 9;
    if(sc<9) out.push({k:"page",sc,p,ord:0});
  }
  for(const x of xIndex()){
    // same ladder as a style: the name first, then what is in it. A track title needs
    // four letters before it counts, the way a style's songs do, or "you" lands here too.
    // An act on a crossing is the reason to open it, so it is worth about what a style's
    // own artist list is worth, not a rung below everything.
    const sc = x.title.startsWith(t) ? 1.1 : x.title.includes(t) ? rank(x.title,t,2.2)
      : x.who.includes(t) ? rank(x.who,t,2.4)
      : (t.length>=4 && x.what.includes(t)) ? rank(x.what,t,4.2)
      : (t.length>=4 && x.note.includes(t)) ? 6.5 : 9;
    if(sc<9) out.push({k:"cross",sc,x,ord:0});
  }
  for(const x of srcIndex()){
    const sc = x.title.startsWith(t) ? 1.5 : x.title.includes(t) ? rank(x.title,t,4)
      : x.by.includes(t) ? rank(x.by,t,5)
      : (t.length>=3 && x.subj.includes(t)) ? rank(x.subj,t,5.5)
      : (t.length>=4 && (x.note.includes(t)||x.kind.includes(t))) ? 6 : 9;
    if(sc<9) out.push({k:"src",sc,x,ord:x.row[3]||9999});
  }
  return out.sort((a,b)=>a.sc-b.sc||a.ord-b.ord).slice(0,8);
}
function hitLine(n){ const t=q.value.trim().toLowerCase(), has=x=>x.toLowerCase().includes(t);
  // name the artist that matched, whether it is one of the three on the panel or
  // one of the deeper playlist names, so the row says why it is in the list
  const m=n.artists.find(has)||n.roster.find(has);
  if(m && !n.note.toLowerCase().includes(t)) return m+" \u00b7 "+n.note;
  // nothing else matched, so it was a track title: quote it, since a bare title reads as a note
  const sg = t.length>=4 && !n.note.toLowerCase().includes(t) && n.songs.find(has);
  return sg ? "\u201c"+sg+"\u201d \u00b7 "+n.note : n.note; }
// A crossing's second line names the act or the track that matched, the way a style's
// does, then how far the run reaches. Without the first part the row is a playlist name
// with no visible connection to what was typed.
function xLine(xi){
  const t=q.value.trim().toLowerCase(), has=v=>v.toLowerCase().includes(t);
  const bits=[];
  const who=xi.acts.find(has);
  const what=!who && t.length>=4 ? xi.songs.find(has) : "";
  if(who) bits.push(who);
  else if(what) bits.push("\u201c"+what+"\u201d");
  bits.push(xi.x.tracks.length+" tracks across "+xi.x.styles.length+" styles");
  return bits.join(" \u00b7 ");
}
// a source's second line says what it is, who made it, and where on the map it lives, in
// that order: the first two tell you whether you want it and the third tells you where
// tapping it would otherwise have taken you.
function srcLine(x){
  const r=x.row, bits=[];
  bits.push(r[4] ? r[4].charAt(0).toUpperCase()+r[4].slice(1) : r[7]);
  if(r[2]) bits.push(r[2]);
  if(r[3]) bits.push(String(r[3]));
  const on=x.styles.map(id=>byId[id] && byId[id].name).filter(Boolean);
  if(on.length) bits.push(on.length>2 ? on[0]+" and "+(on.length-1)+" more" : on.join(" and "));
  return bits.join(" \u00b7 ");
}
// what a result is, said in a mark rather than in a word. A style wears its family's
// colour, which is the map's own language for "this is a style". A page and a source
// wear the glyph their own rows already wear elsewhere, so a thing found by search looks
// like the same thing when you get there.
function hitMark(h){
  if(h.k==="style") return `<i class="rico rdot" style="background:${FAM[h.n.fam].c}"></i>`;
  // a crossing wears the playlist glyph the listen rows already wear
  if(h.k==="cross") return `<i class="rico rm-listen">${ROWICON.pl||""}</i>`;
  if(h.k==="page"){ const med=h.p.key.indexOf("med:")===0 ? h.p.key.slice(4) : "";
    return `<i class="rico ${med?"rm-"+med:"rm-picks"}">`
      + (med ? (MEDPAGEICON[med]||"") : (ROWICON.picks||"")) + `</i>`; }
  const t=h.x.row[7];
  return `<i class="rico rm-${esc(t)}">${MEDICON[t]||MEDICON.read}</i>`;
}
const hostOf = u => { try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; } };
function renderHits(){
  if(!hits.length){ res.hidden=true; return; }
  res.innerHTML = hits.map((h,i)=>{
    const on=i===act?" act":"";
    const wrap=(cls,attr,name,line,tail,lbl)=>`<li><button class="${cls}${on}" ${attr} role="option"`
      + (lbl?` title="${esc(lbl)}" aria-label="${esc(lbl)}"`:"") + `>`
      + hitMark(h)
      + `<span class="rtx"><span class="rnm">${esc(name)}</span><small>${esc(line)}</small></span>`
      + (tail||"") + `</button></li>`;
    if(h.k==="style") return wrap("res-style",`data-go="${esc(h.n.id)}"`,
      h.n.name, (h.n.year<1950?h.n.disp:String(h.n.year))+" \u00b7 "+hitLine(h.n), "", "");
    if(h.k==="page") return wrap("res-page",`data-page-go="${esc(h.p.key)}"`,
      h.p.label, h.p.sub, "", "");
    if(h.k==="cross") return wrap("res-src rs-listen",`data-cross="${esc(h.x.x.id)}"`,
      h.x.x.title, xLine(h.x), `<i class="rext">${OPENGO}</i>`,
      h.x.x.title+", opens in "+svcName());
    // a source is somebody else's page and opens in a new tab. An arrow is the one mark
    // people already read as "this leaves", and the label names the host, because an
    // arrow alone does not say where it is about to send you.
    const host=hostOf(h.x.url);
    return wrap("res-src rs-"+esc(h.x.row[7]),`data-src="${esc(h.x.url)}"`,
      h.x.row[1], srcLine(h.x), `<i class="rext">${OPENGO}</i>`,
      h.x.row[1]+(host?", opens "+host:"")+" in a new tab");
  }).join("");
  res.hidden=false;
}
(function(){ const f=q.closest("form"); if(f) f.addEventListener("submit",e=>e.preventDefault()); })();
q.addEventListener("input",()=>{ hits=find(q.value); act=0; renderHits(); qsync(); });
q.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){ act=Math.min(act+1,hits.length-1); renderHits(); e.preventDefault(); }
  else if(e.key==="ArrowUp"){ act=Math.max(act-1,0); renderHits(); e.preventDefault(); }
  else if(e.key==="Enter"&&hits[act]){ open_(hits[act]); q.blur(); }
  else if(e.key==="Escape"){ res.hidden=true; }
});
res.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  const h=hits[[...res.querySelectorAll("button")].indexOf(b)];
  if(h){ open_(h); q.blur(); }
});
document.addEventListener("click",e=>{ if(!e.target.closest(".search")) res.hidden=true; });
// one exit for all three kinds, so the keyboard and the mouse cannot drift apart
function open_(h){
  if(h.k==="style") return go(h.n.id);
  clearQ();
  if(h.k==="page"){ setOpen(true); setTimeout(()=>pushPage(h.p.key),120); return; }
  // a crossing opens on the chosen service, like the row it came from
  if(h.k==="cross"){ const x=h.x.x;
    const url = SVC==="spotify" ? (x.sp?"https://open.spotify.com/playlist/"+x.sp:"")
      : SVC==="apple" ? (x.ap?"https://music.apple.com"+x.ap:"") : "";
    if(url) window.open(url,"_blank","noopener,noreferrer");
    return; }
  // a source is somebody else's page: new tab, and the map stays where it was
  window.open(h.x.url,"_blank","noopener,noreferrer");
}
function clearQ(){ res.hidden=true; q.value=""; qsync(); document.body.classList.remove("searching"); }
function go(id){ clearQ(); select(id);
  panelTop(); }
// a cover that isn't there just disappears; error doesn't bubble, so listen on the capture phase
// a cover that fails once is usually a hiccup; only a second failure means there is no file,
// and then a tile keeps the row the same shape instead of collapsing it
$("panelBody").addEventListener("error",e=>{
  const t=e.target; if(!t||t.tagName!=="IMG"||!t.classList.contains("pcov")) return;
  if(!t.dataset.retried){
    t.dataset.retried="1";
    const src=(t.getAttribute("src")||"").split("?")[0];
    setTimeout(()=>{ if(t.isConnected) t.src=src+"?r=1"; },500);
    return;
  }
  const ph=document.createElement("span");
  ph.className="pcov pcovph"; ph.setAttribute("aria-hidden","true");
  if(t.dataset.c) ph.style.setProperty("--c",t.dataset.c);
  ph.innerHTML="<b></b>"; ph.firstChild.textContent=t.dataset.ini||"";
  t.replaceWith(ph);
},true);

// ---------- a swipe that carries ----------
// A trackpad flings a scroller on its own and a touch screen has native momentum. A mouse
// has neither: press and drag moves the row exactly as far as the hand did and stops dead
// the moment you let go, which makes a row of circles a lot of small drags. So the row
// remembers how fast it was moving over the last few frames and keeps going on release,
// decaying the way a scroller does, until it is slower than a pixel a frame.
(function(){
  const body=$("panelBody"); if(!body) return;
  const SLOP=4, FRICTION=0.94, STOP=0.25, SAMPLE=90;
  let drag=null, glide=0;
  const stopGlide=()=>{ if(glide) cancelAnimationFrame(glide); glide=0; };
  body.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="mouse"||e.button!==0) return;
    const row=e.target.closest&&e.target.closest(".mrow,.whorow"); if(!row) return;
    stopGlide();
    drag={row,id:e.pointerId,x:e.clientX,from:row.scrollLeft,on:false,
          marks:[[performance.now(),e.clientX]]};
  });
  body.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id) return;
    const dx=e.clientX-drag.x;
    if(!drag.on){ if(Math.abs(dx)<SLOP) return;
      drag.on=true; drag.row.classList.add("dragging");
      try{ drag.row.setPointerCapture(drag.id); }catch(_){} }
    drag.row.scrollLeft=drag.from-dx;
    const now=performance.now();
    drag.marks.push([now,e.clientX]);
    while(drag.marks.length>2 && now-drag.marks[0][0]>SAMPLE) drag.marks.shift();
    e.preventDefault();
  });
  const release=e=>{
    if(!drag||(e&&e.pointerId!==drag.id)) return;
    const d=drag; drag=null;
    if(!d.on) return;
    try{ d.row.releasePointerCapture(d.id); }catch(_){}
    // a click fires on the circle the drag ended over, so swallow that one
    const eat=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
    d.row.addEventListener("click",eat,{capture:true,once:true});
    setTimeout(()=>d.row.removeEventListener("click",eat,true),0);
    d.row.classList.remove("dragging");
    const a=d.marks[0], b=d.marks[d.marks.length-1];
    const dt=b[0]-a[0];
    let v = dt>0 ? -(b[1]-a[1])/dt*16 : 0;          // pixels per frame, the way it moved
    if(reduce||Math.abs(v)<STOP) return;
    const row=d.row;
    const step=()=>{
      row.scrollLeft+=v; v*=FRICTION;
      const end = row.scrollLeft<=0 || row.scrollLeft>=row.scrollWidth-row.clientWidth-0.5;
      glide = (Math.abs(v)>STOP && !end) ? requestAnimationFrame(step) : 0;
    };
    glide=requestAnimationFrame(step);
  };
  body.addEventListener("pointerup",release);
  body.addEventListener("pointercancel",release);
  // a new scroll of the panel, or a tap anywhere, should not fight a glide still running
  body.addEventListener("pointerdown",e=>{ if(!e.target.closest||!e.target.closest(".mrow,.whorow")) stopGlide(); });
})();

function panelTop(){ const pb=$("panelBody"); if(!pb) return; const cls=$("panel").classList;
  pb.scrollTop=0; cls.remove("pscrolled"); cls.remove("barttl");
  setTimeout(()=>{ pb.scrollTop=0; cls.remove("pscrolled"); cls.remove("barttl"); },60); }
function qsync(){ const b=$("qclear"); if(b) b.hidden = !q.value; }
function openSearch(){
  // iOS only raises the keyboard if focus happens inside the tap itself, so do it first and synchronously
  document.body.classList.add("searching");
  q.focus({preventScroll:true});

  qsync();
}
function closeSearch(){
  document.body.classList.remove("searching");
  q.value=""; hits=[]; act=0; res.hidden=true; qsync();
}
q.addEventListener("blur",()=>setTimeout(()=>{ if(!q.value && !res.matches(":hover")) closeSearch(); },180));
q.addEventListener("keydown",e=>{ if(e.key==="Escape"){ e.stopPropagation(); closeSearch(); } });
(function(){
  const b=$("qclear"); if(!b) return;
  b.addEventListener("click",()=>{ q.value=""; hits=[]; act=0; res.hidden=true; qsync(); q.focus(); });
})();

// ---------- zoom ----------
function updZoom(){ const pct=Math.round(Z*100)+"%"; $("zreset").textContent=pct; $("zin").disabled=Z>=ZMAX; $("zout").disabled=Z<=ZMIN; $("zreset2").hidden = Math.abs(Z-1)<.001; $("zpct").textContent=pct; }
function setZoom(z){
  z=Math.min(ZMAX,Math.max(ZMIN,Math.round(z*10)/10)); if(z===Z) return;
  const fx=(scroller.scrollLeft+scroller.clientWidth/2)/W, fy=(scroller.scrollTop+scroller.clientHeight/2)/(H+AXH+BAR());
  Z=z; render(); if(state.sel) select(state.sel,{scroll:false,repaint:false});
  scroller.scrollLeft=fx*W-scroller.clientWidth/2; scroller.scrollTop=fy*(H+AXH+BAR())-scroller.clientHeight/2;
  updZoom();
}
$("zin").onclick=()=>setZoom(Z+.1);
$("zout").onclick=()=>setZoom(Z-.1);
$("zreset").onclick=()=>setZoom(1);
$("zreset2").onclick=()=>setZoom(1);
scroller.addEventListener("keydown",e=>{ if(e.key==="+"||e.key==="="){setZoom(Z+.1);e.preventDefault();} else if(e.key==="-"){setZoom(Z-.1);e.preventDefault();} else if(e.key==="0"){setZoom(1);e.preventDefault();} });
scroller.addEventListener("wheel",e=>{ if(e.ctrlKey){ e.preventDefault(); setZoom(Z+(e.deltaY<0?.1:-.1)); } },{passive:false});
// pinch-to-zoom (touch): scale about the midpoint, snapping to 5% steps
let pinch=null;
const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
// Drag the map with a mouse. A trackpad pans on its own and a phone has fingers;
// a mouse has a wheel and nothing else, so the map is grabbed from empty space and
// pushed. Anything that already answers a click is left alone, and the pan only
// starts after a few pixels, so clicking the background still clears the selection.
let pan=null;
const PANSLOP=3, PANSKIP=".n,a,button,input,select,textarea,[data-go],[data-menu]";
function endPan(){
  if(!pan) return;
  const moved=pan.on;
  try{ scroller.releasePointerCapture(pan.id); }catch(_){}
  pan=null; document.body.classList.remove("panning");
  // the drag ends over whatever it ends over, and that would read as a click on it
  if(moved){ const eat=ev=>{ ev.preventDefault(); ev.stopPropagation(); };
    addEventListener("click",eat,true); setTimeout(()=>removeEventListener("click",eat,true),0); }
}
scroller.addEventListener("pointerdown",e=>{
  if(e.pointerType!=="mouse"||e.button!==0) return;
  if(e.target.closest&&e.target.closest(PANSKIP)) return;
  pan={id:e.pointerId,x:e.clientX,y:e.clientY,l:scroller.scrollLeft,t:scroller.scrollTop,on:false};
});
scroller.addEventListener("pointermove",e=>{
  if(!pan||e.pointerId!==pan.id) return;
  const dx=e.clientX-pan.x, dy=e.clientY-pan.y;
  if(!pan.on){
    if(Math.abs(dx)<PANSLOP&&Math.abs(dy)<PANSLOP) return;
    pan.on=true; document.body.classList.add("panning");
    try{ scroller.setPointerCapture(pan.id); }catch(_){}
  }
  scroller.scrollLeft=pan.l-dx; scroller.scrollTop=pan.t-dy;
  e.preventDefault();
});
scroller.addEventListener("pointerup",endPan);
scroller.addEventListener("pointercancel",endPan);
addEventListener("blur",endPan);

scroller.addEventListener("touchstart",e=>{ if(e.touches.length===2){ const r=scroller.getBoundingClientRect(); const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left, my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top; pinch={d0:dist(e.touches),z0:Z,fx:(scroller.scrollLeft+mx)/W,fy:(scroller.scrollTop+my)/(H+AXH+BAR()),mx,my}; e.preventDefault(); } },{passive:false});
scroller.addEventListener("touchmove",e=>{ if(!pinch||e.touches.length!==2) return; e.preventDefault(); const z=Math.min(ZMAX,Math.max(ZMIN,Math.round(pinch.z0*dist(e.touches)/pinch.d0*10)/10)); if(z!==Z){ Z=z; render(); if(state.sel) select(state.sel,{scroll:false,repaint:false}); scroller.scrollLeft=pinch.fx*W-pinch.mx; scroller.scrollTop=pinch.fy*(H+AXH+BAR())-pinch.my; updZoom(); } },{passive:false});
scroller.addEventListener("touchend",e=>{ if(e.touches.length<2) pinch=null; });
scroller.addEventListener("touchcancel",()=>{ pinch=null; });
// iOS Safari fires gesture events for pinch; stop the page itself from zooming
["gesturestart","gesturechange","gestureend"].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));


// ---------- boot & resize ----------
let RENDERED=false;
// space the floating search bar covers at the bottom, so the last lanes can always be scrolled clear of it
// GLIDING guards the inline max-height the sheet animation needs: this runs on a zero
// timeout from setOpen and would otherwise restore the 46vh cap before the first frame,
// clamping the closing animation to its end state instantly.
function sizeCard(){ const el=$("panel"); if(el && !GLIDING) el.style.maxHeight=""; }
// Breathing room under the map, plus whatever the floating sheet covers, so the lowest
// styles can still be scrolled up into the open band. The room has to clear the sheet's
// shadow as well as the sheet: that shadow reaches 30px up, so 24px of clearance left the
// last lane sitting in it and reading as stuck underneath.
function SRES(){ return (OVERLAY?56:24) + sheetCover(); }
// the map used to be resized by the sheet, so its ResizeObserver kept this honest. Now
// that the sheet floats, nothing observes the change and the padding has to be told.
function syncMapPad(){ const i=$("inner"); if(i) i.style.paddingBottom=SRES()+"px"; }
// The map used to be resized by the sheet, so one ResizeObserver on the scroller kept
// everything in step. The sheet floats now and the scroller never changes, so watch the
// sheet itself: this covers the first paint, a drag to a height of its own, a rotation
// and a mobile toolbar sliding away.
if(window.ResizeObserver){
  const pel=$("panel");
  if(pel) new ResizeObserver(()=>{ syncMapPad(); }).observe(pel);
}
// A leaf drawn as a dot takes no width in the layout, so the rows pack tighter and the map
// gets shorter. That is the whole job: the labels never collide at any zoom, because a row
// is chosen from the measured width of what is going in it. Height is the thing zooming out
// is for.
//
// The threshold was 0.9, set when every label was pinned to one size whatever the zoom. The
// labels scale now, so at 80% they are smaller than they were and there is room that was not
// there before: keeping all 461 makes the map 3323px against 3408 at 90%, so zooming out
// still shrinks it. At 70% it does not. All 461 there comes out at 3438px, which is TALLER
// than 90%, and a zoom-out that grows the map is not a zoom-out. So the drop happens one
// step lower than it did, and 139 labels stop disappearing at 80%.
//
// 0.75 rather than 0.8 because 0.9 minus 0.1 is 0.8 exactly but 0.8 minus 0.1 is
// 0.7000000000000001, and a threshold should not depend on which way the float fell.
function render(){ RENDERED=true; dims(); LOD = Z<0.75; $("chart").classList.toggle("lod",LOD); fit();
  const res=SRES(); $("inner").style.paddingBottom=res+"px"; measureHead();
  layout(scroller.clientHeight-AXH-BAR()-res-HEADH); draw(); }
let lastW=0,lastH=0,rt;
// the panel is docked, so opening or closing it changes the map viewport: re-lay out when that happens
let ro;
if(window.ResizeObserver){ let rot; ro=new ResizeObserver(()=>{ clearTimeout(rot); rot=setTimeout(()=>{ if(!RENDERED||DRAGGING) return; render(); if(state.sel) select(state.sel,{scroll:false,repaint:false}); },120); }); ro.observe(scroller); }
addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>{
  if(innerWidth===lastW && Math.abs(innerHeight-lastH)<120) return; // ignore mobile toolbar jitter
  lastW=innerWidth; lastH=innerHeight;
  const wasOverlay=OVERLAY; render(); if(state.sel) select(state.sel,{scroll:false});

},150); });
// ---------- the welcome ----------
// Three steps, because they are three different questions and stacking them on one card
// made the card a form. First what the thing is and where you listen. Then where to
// start, which is the question a map of 461 dots actually leaves you with. Then, once
// you are looking at something you chose, the offer to keep it.
//
// Shown once per browser, and never to somebody arriving on a shared link: they came for
// a particular style, not for an explanation of the map. A browser that refuses storage
// gets it once this session rather than on every reload.
const HELLO_KEY="musicatlas.seen", TIP_KEY="musicatlas.tip";
let helloShown=false, tipShown=false;
function helloSeen(){
  if(helloShown) return true;
  try{ return localStorage.getItem(HELLO_KEY)==="1"; }catch(e){ return false; }
}
function markHello(){
  helloShown=true;
  try{ localStorage.setItem(HELLO_KEY,"1"); }catch(e){}
}
let helloAt=1;
function helloStep(n){
  const w=$("hello"); if(!w) return;
  helloAt=n;
  w.querySelectorAll(".hstep").forEach(sec=>{ sec.hidden = +sec.dataset.step !== n; });
  w.querySelectorAll(".hdots i").forEach((d,i)=>d.classList.toggle("on", i === n-1));
  const c=$("hellocard");
  if(c){ c.scrollTop=0; setTimeout(()=>c.focus({preventScroll:true}),40); }
}
function closeHello(then){
  const w=$("hello"); if(!w||w.hidden) return;
  w.hidden=true; markHello();
  document.body.classList.remove("hello-open");
  if(typeof then==="function") then();
}
function openHello(){
  const w=$("hello"); if(!w) return;
  const ic=$("helloicon"); if(ic) ic.src=ICONSRC();
  const n=$("hellon"); if(n) n.textContent=nodes.length;
  const p=$("hellop"); if(p) p.textContent=playable().length;
  // the service picker shows what is already stored rather than a blank set of three:
  // a default nobody chose is still the answer until somebody changes it, and saying so
  // is honest about what will happen if they just carry on
  w.querySelectorAll("[data-svc]").forEach(bt=>
    bt.setAttribute("aria-checked",String(bt.dataset.svc===SVC)));
  helloStep(1);
  w.hidden=false; document.body.classList.add("hello-open");
  // the card takes focus, not the button: a ring on a primary button reads as pressed,
  // and the dialog still announces itself and still hands Tab to the button
  const c=$("hellocard"); if(c) setTimeout(()=>c.focus({preventScroll:true}),60);
}

// ---------- how the card ends ----------
// It used to end on a third step asking where you wanted to start, offering a view of
// playlists or the bare map. That question confused people, and it deserved to: the two
// destinations are one tap apart in the live app, so the fork was never real, and the
// step's own subtitle ("the whole map is one tap behind it") was the screen apologising
// for itself. Worse, the two choices were the only way out of the card. Someone who
// wanted neither had Back, the backdrop and Escape, none of which look like a way in.
// The card ends on the service picker now, with one button that closes it.

// ---------- after the card: keeping it ----------
// Offered after the view you asked for is on screen, not before: an install prompt makes
// no sense until there is something worth installing, and one that interrupts the first
// thing you chose to look at is an advert. Never to a browser that already has it, and
// never twice.
function tipSeen(){
  if(tipShown) return true;
  try{ return localStorage.getItem(TIP_KEY)==="1"; }catch(e){ return false; }
}
function markTip(){
  tipShown=true;
  try{ localStorage.setItem(TIP_KEY,"1"); }catch(e){}
}
function closeTip(then){
  const t=$("tip"); if(!t||t.hidden) return;
  t.hidden=true; markTip();
  if(typeof then==="function") then();
}
function openTip(){
  if(installed() || tipSeen()) return;
  const t=$("tip"); if(!t) return;
  const ic=$("tipicon"); if(ic) ic.src=ICONSRC();
  t.hidden=false;
}

{ const w=$("hello");
  if(w){
    w.addEventListener("click",e=>{
      if(e.target.closest("[data-hclose]")) { closeHello(); return; }
      // the picker sets the app's own preference, the same one the panel's menu sets, and
      // leaves the card open: choosing where you listen is not choosing to start
      { const sv=e.target.closest("[data-svc]");
        if(sv){ setSvc(sv.dataset.svc);
          w.querySelectorAll("[data-svc]").forEach(bt=>
            bt.setAttribute("aria-checked",String(bt.dataset.svc===sv.dataset.svc)));
          return; } }
      // every Continue and every Back says which step it goes to, so the order lives in
      // the markup rather than in a chain of handlers that have to agree with it
      { const to=e.target.closest("[data-to]");
        if(to){ helloStep(+to.dataset.to); return; } }
      // the one way out. Nothing to navigate to: the app already boots onto Explore, with
      // the map behind it, which is where both of the old destinations led anyway.
      { if(e.target.closest("[data-hstart]")){
          closeHello(()=>setTimeout(openTip,1200));
          return; } }
    });
    document.addEventListener("keydown",e=>{
      if(e.key!=="Escape" || w.hidden) return;
      e.stopPropagation();
      // Escape on step two goes back a step rather than out: the card is two questions
      // deep and leaving from the second one would throw away the first answer
      if(helloAt>1) helloStep(helloAt-1); else closeHello();
    },true);
  } }

{ const t=$("tip");
  if(t){
    t.addEventListener("click",e=>{
      if(e.target.closest("#tiphow")){
        closeTip(()=>{ setOpen(true); setTimeout(()=>pushPage("install"),120); });
        return; }
      if(e.target.closest("#tipno")) { closeTip(); return; }
    });
    // it takes no backdrop, so Escape is the keyboard way out and the only one needed
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape" && !t.hidden){ e.stopPropagation(); closeTip(); }
    },true);
  } }

function boot(){
  lastW=innerWidth; lastH=innerHeight; render(); updZoom();
  const h=decodeURIComponent((location.hash||"").slice(1));
  // a collection or a media page: the key is the hash, so it opens the page it names
  if(/^(mode|med):/.test(h) && pageExists(h)){
    emptyPanel(); scroller.scrollLeft=0; scroller.scrollTop=0; syncPeek();
    setOpen(true);
    setTimeout(()=>pushPage(h),420);
  }
  else if(FOLDS[h]){
    emptyPanel(); scroller.scrollLeft=0; scroller.scrollTop=0; syncPeek();
    setOpen(true);                         // the sheet is closed on a phone by default
    setTimeout(()=>openAbout(true,h),420); // after the sheet has finished opening
  }
  else if(byId[h]) select(h,{smooth:false});
  else {
    emptyPanel(); scroller.scrollLeft = 0; scroller.scrollTop = 0; syncPeek();
    // Opening the app lands on Explore rather than on a peek of it. The peek was right
    // when the panel was a blurb and two rows: it said the map is the thing and this is
    // a drawer. It is a shelf now, and a drawer you have to pull every time you open the
    // app is a tap charged for the same thing every session. The map still has a third of
    // the screen, and one pull down puts it back.
    // Only here: arriving on a link somebody sent is somebody else's arrival, and that
    // one still opens on the map, which is what the link was about.
    setOpen(true);
  }
  // a hash of any kind means somebody was sent here, so the map speaks for itself
  if(!h && !helloSeen()) setTimeout(openHello,260);
}
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(boot,boot);
function kb(){
  sizeCard();
  const vv = window.visualViewport;
  const vh = vv ? vv.height : innerHeight;
  res.style.maxHeight = Math.max(120, Math.round(vh - 150)) + "px";
}
if(window.visualViewport){ visualViewport.addEventListener("resize",()=>{ kb(); clearTimeout(rt); rt=setTimeout(()=>{ fit(); },150); }); visualViewport.addEventListener("scroll",kb); }
q.addEventListener("focus",()=>{ setTimeout(kb,50); setTimeout(kb,350); });
q.addEventListener("blur",()=>{ setTimeout(kb,100); });
})();
