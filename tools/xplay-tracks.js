#!/usr/bin/env node
/*
  Adding a playlist that crosses the map.

  A style's playlist gets its artists and songs indexed through ROSTER and SONGS, which
  are keyed by style. A crossing belongs to no single style, so nothing indexes it: its
  tracklist has to travel with the entry, or search cannot see inside it and a hunt for
  the one act that made you want the playlist comes back empty.

  xplay.test.js refuses an entry with no tracks, so this cannot be forgotten quietly.
  What it cannot do is fetch them: music.apple.com is outside the sandbox's allowlist.
  So the tracklist is read in a browser and pasted back here.

  1. Open the playlist on music.apple.com, scroll to the bottom so every row has rendered
     (the list is virtualised and only draws what is near the viewport).
  2. Paste READ into the console. It copies a JSON array of [artist, title] pairs.
  3. node tools/xplay-tracks.js <<< '<paste>'
     which prints the tracks: block to drop into the XPLAY entry in src/data.js.

  Titles keep their punctuation and lose the editorial parentheses Apple adds, because
  "(Remastered)" and "(1959)" are not part of what anyone would type.
*/
const READ = `
copy(JSON.stringify([...document.querySelectorAll(
  '[data-testid="track-list-item"], .songs-list-row')].map(r => {
  const t = r.querySelector('[data-testid="track-title"], .songs-list-row__song-name');
  const a = r.querySelector('[data-testid="track-subtitle"], .songs-list-row__by-line');
  return [a ? a.textContent.trim().replace(/\\s+/g," ") : "",
          t ? t.textContent.trim() : ""];
})))
`.trim();

if (process.argv.includes("--snippet") || process.stdin.isTTY) {
  console.log("Paste this into the console on the playlist page, then pipe the result back in:\n");
  console.log(READ + "\n");
  if (process.stdin.isTTY) process.exit(0);
}

let raw = "";
process.stdin.on("data", d => raw += d);
process.stdin.on("end", () => {
  let rows;
  try { rows = JSON.parse(raw); }
  catch (e) { console.error("not JSON: " + e.message); process.exit(1); }
  if (!Array.isArray(rows) || !rows.length) { console.error("no rows"); process.exit(1); }

  // Apple appends things that belong to the release rather than the song, and a title
  // nobody would type is a title search will not match on.
  const DROP = /\s*\((?:\d{4}|remaster(?:ed)?[^)]*|mono|stereo|single version|album version|remastered \d{4})\)\s*$/i;
  const clean = s => String(s).replace(DROP, "").trim();

  const seen = new Set(), out = [];
  for (const r of rows) {
    const a = clean(r[0]), t = clean(r[1]);
    if (!a || !t) continue;
    const k = (a + "|" + t).toLowerCase();
    if (seen.has(k)) continue;            // the same track twice is one row to search
    seen.add(k); out.push([a, t]);
  }

  const acts = new Set();
  out.forEach(([a]) => String(a).split(/,\s*/).forEach(x => acts.add(x)));
  console.error(out.length + " tracks, " + acts.size + " acts"
    + (out.length < rows.length ? " (" + (rows.length - out.length) + " dropped)" : ""));

  console.log("   tracks:[");
  console.log(out.map(([a, t]) =>
    "     [" + JSON.stringify(a) + "," + JSON.stringify(t) + "]").join(",\n"));
  console.log("   ]");
});
