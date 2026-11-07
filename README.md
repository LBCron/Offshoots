# Music Atlas

Interactive map of popular music styles: trace what any style grew out of
and what grew out of it. The spine is American, but the lines cross oceans —
Jamaica, the UK, Brazil, West Africa, Cuba and more are all in here, because
the music does not stay put. Built for the School of Listening class.

Live: https://musicatlas.us/

461 styles across 18 families, 1,133 parent-to-child connections, 309 written
descriptions, and 368 styles with a playlist on Apple Music and Spotify.

## What's in here

| Path | What it is |
|---|---|
| `src/` | The app: CSS and markup, data, code. `node src/build.js` joins them into `index.html` |
| `index.html` | The whole app as one page. Generated, not in git: Netlify builds it on deploy, `npm test` builds it locally |
| `test/` | Browser checks that drive the built page |
| `art/` | Playlist cover art, one square JPEG per style |
| `suggest.html` | The form for suggesting a Go deeper link |
| `contribute.html` | The page that hands out the bookmarklet |
| `netlify/functions/` | `suggest.mjs`, which files each suggestion as an issue |
| `tools/ingest.js` | Brings approved suggestions into `src/data.js` |

Netlify runs `node src/build.js` and serves this directory. `netlify.toml` pins that,
plus the function, a week of browser caching for the image folders, and an ignore rule
that skips the deploy when a push touches nothing that is served (`test/`, docs, the
tools that are not the build). GitHub Actions builds the page and runs every suite on
each pull request and each push to `main` (`.github/workflows/test.yml`).

## Suggestions

Go deeper grows from suggestions. Anyone can send one from `/contribute` (a bookmarklet)
or `/suggest` (the form, also linked at the bottom of every Go deeper list). Each one
becomes an issue in the private `bryanbell/Offshoots-submissions` repo, labelled
`pending`. Nothing reaches the map from there on its own.

To publish one, edit the JSON block in the issue until it is a finished READ row
(publication, kind, year, access, a note that says why), then swap `pending` for
`approved`. To reject one, close it. Then:

```
node tools/ingest.js            # what would be added, and what still needs edits
node tools/ingest.js --write    # add approved rows to src/data.js and rebuild
npm test                        # commit and push, then:
node tools/ingest.js --close    # close the issues that landed
```

Ingest holds anything that would fail `test/read.test.js`, and says why.

Guests are credited by a key rather than a login. `CONTRIBUTORS` in Netlify's
environment maps each key to a picker in `PICKERS`; a guest's link is
`/contribute#k=<key>`, and what they send is labelled `<picker>s-picks` and lands in
`PICKED` as theirs. `GITHUB_TOKEN` there can open issues in the submissions repo and
nothing else. Ingest needs its own token that can read that repo: `gh auth login`, or
`GH_TOKEN`.

## How the connections work

Each style stores only its parents, as a space-separated list of style ids:

```
["rocknroll","Rock and Roll",1954,"rock","rnb jump boogie nola_rnb honkytonk gospel", ...]
                                       |- parents: 6 ids
```

Children are derived at load time by inverting that list, so every edge is written
once, in one direction. A style with no parents is a root; roots are drawn with a
ring instead of a filled dot.

The map draws two generations in each direction from the selected style, not the
whole ancestry. The ancestor and descendant counts in the panel come from a full
breadth-first walk, so they run deeper than the lines you see.

Ids are lowercase, stable and arbitrary (`nola_rnb`, `twotone`, `scrap`). Renaming a
style is safe. Changing an id means updating every parent list that references it.

## Color

Families take their color from the School of Listening cover palette. Each shelf's
cover field supplies the hue, lifted to a lightness that reads on the dark map; for
the shelves whose covers are near-black, the cover accent supplies it instead. The
same palette tints the detail panel, so a style's panel, its lane, its dot and its
lines are all the same family color.

## Building

`index.html` is generated. Edit the files in `src/` and rebuild:

```
node src/build.js      # writes index.html at the repo root
```

```
src/head.html   CSS and markup
src/data.js     families, styles, parents, artists, playlists, descriptions, covers, modes
src/app.js      layout, rendering, interaction
src/build.js    joins the three into index.html
```

The six artist-keyed tables (`ROSTER`, `SONGS`, `ACTIVE`, `ROLE`, `COVERART`, `PHOTO`) are
most of `data.js` by bytes and nothing reads them until a search or a panel opens, so the
build puts them in the page as inert `<script type="application/json">` blocks and a
getter parses each one the first time its name is read. In `data.js` they are ordinary
consts; in the page `ROSTER[id]` reads the same as it always did. The page is still one
file; it just does not compile 470 KB of names before it can draw the map.

On the live site the playlist covers are requested through Netlify's image CDN
(`/.netlify/images?url=/art/…&w=480`), which resizes and re-encodes them; from a
`file://` copy or any other host the JPEGs are used as they are, and a cover the CDN
will not serve falls back to its file.

`data.js` ends with a `module.exports` tail so scripts and tests can `require()` it;
the build strips that tail, since the page has no module system. That makes checks
like this possible without a browser:

```
node -e 'const {DATA,COVER}=require("./src/data.js"); /* ... */'
```

Commit the `src/` change; Netlify builds `index.html` from it on deploy, so there is no
built file to commit and no way to push a source edit that is not what the site shows.
`index.html` and `musicatlas.json` are gitignored; a fresh clone makes them with
`node src/build.js`.

### Why it is still one file

Splitting the served page into separate js and css would buy better caching on a
repeat visit and not much else. Against that, a self-contained page can be mailed,
opened from a disk or dropped into any host, and every extra fetched file is another
relative URL that can resolve wrong where the page is served from a path with no
trailing slash. That has already bitten once: see `artBase()` in `app.js`, which
exists because `art/x.jpg` resolved against the parent directory and every cover
404'd. The maintenance argument for splitting is already answered by `src/`.

## Tests

```
npm run setup          # playwright, once (installs into test/, not the root)
npm test               # rebuilds, then runs every test/*.test.js
```

About 1,200 checks across thirty suites. All but a few drive a real Chromium against
the built page at mobile and desktop widths; each prints one line per check and the
runner exits non-zero if any fails. `test/data.test.js` runs first and alone, with no
browser: it loads `src/data.js` and checks every relationship the app assumes (parent
ids exist, lineage has no cycles, every cover stem has a file, every table is keyed by
real style ids), in milliseconds. If it fails, the browser suites do not run, since
they would only report the same slip as blank spots.

The runner takes suites longest-first, from the timings it kept in `test/.timings.json`
on the last run, so the two eight-minute suites start at once instead of at the end.

They load `index.html` over `file://`, so `art/` resolves from this folder and covers
render exactly as they do when served.

One trap worth knowing before adding a test: setting `location.hash` on a page that
is already loaded is a same-document navigation, so the app does not re-select and
the panel keeps showing the previous style. Open each style on a fresh page. Several
false failures in this project came from reusing one.
