# Working on Music Atlas

README.md says how the data and the build work. This file is the short list of rules
that keep one session from undoing another's work.

## Start from the latest main

Main moves between sessions: other chats push to it, and approved suggestions land in
`src/data.js` through `tools/ingest.js`. Before changing anything, fetch and rebase onto
`origin/main` (or clone fresh). Edit the clone itself. Never copy `src/` files in from an
older copy or a scratchpad: that silently reverts whatever landed since.

## Making a change

- Edit `src/` (`head.html`, `data.js`, `app.js`), then `node src/build.js` to see it.
  Commit `src/` only: `index.html` and `musicatlas.json` are generated and gitignored, and
  Netlify builds them from `src/` on every deploy.
- Edit a `data.js` table inside its own range (`const READ = {` to its `};`), never with a
  global replace: ids repeat across tables, and a global replace has corrupted data twice.
  Every table is one entry per line, `"key":value,` with a trailing comma, so a diff shows
  the entry that changed and `tools/manifest.js` can find it. Keep it that way.
- `node test/run.js data` after any edit to `data.js`: no browser, under a second, and it
  names the id or file that is wrong. The full run starts with it and stops if it fails.
- Run the suites that cover what changed (`node test/run.js read search`), or all of them
  for a change to `app.js` or `head.html`. Playwright installs with `npm run setup` (into
  `test/`, so the root has no dependencies and Netlify installs nothing on deploy).
- A push to `main` is live in about a minute. A branch or PR gets a deploy preview first,
  and GitHub Actions runs the whole suite on it (`.github/workflows/test.yml`). A push
  that changes nothing served (only `test/`, docs, tools other than `catalog.js`) is
  skipped by the ignore rule in `netlify.toml`.

## Files that are not the map

| Path | What it is |
|---|---|
| `suggest.html`, `contribute.html` | The suggestion form and the bookmarklet page. Standalone pages, not built from `src/` |
| `netlify/functions/suggest.mjs` | Files each suggestion as an issue in the private `bryanbell/Offshoots-submissions` repo |
| `netlify.toml` | Builds with `node src/build.js`, publishes `.`, functions in `netlify/functions`, the `/suggest` and `/contribute` addresses, image cache headers, and the deploy ignore rule |
| `tools/ingest.js` | Approved suggestion issues into `READ` and `PICKED` |

The function needs `GITHUB_TOKEN` and `CONTRIBUTORS`. Both live only in Netlify's
environment variables, marked secret and scoped to Functions, and a change to either
takes effect on the next deploy. Never write a token or a contributor key into a file,
a commit or a chat.

## Go deeper and guest picks

New Go deeper rows mostly arrive as suggestions, and are pulled in as below. Adding a row
by hand is still fine. Keep it to `test/read.test.js`'s rules: https, no
encyclopedias, a note over 20 characters with no em dash, a known access value and medium,
and a real year or 0.

A guest's pick is an ordinary `READ` row with its URL in `PICKED`. `CONTRIBUTORS` maps each
guest's secret key to a `PICKERS` id, and their personal link is `/contribute#k=<key>`.

## Pulling suggestions in

The owner decides whether a suggestion is worth having, by swapping `pending` for
`approved` on its issue. Where it goes is decided here, by research, and shown to the
owner before anything is written. The styles a sender picked are a hint, not the answer.

This needs a token that can read and write issues in `bryanbell/Offshoots-submissions`.
In a Claude session, attach that repo with push access; on the Mac, `gh auth login`.

1. `git pull`. Then `node tools/ingest.js --brief` lists the approved issues and what each
   still lacks, and `node tools/ingest.js --styles` lists every style on the map.
2. Open each link and find out what it is actually about: the artists, the scene, the
   place and the years. A YouTube title or a headline is not enough; read the description
   or the piece. If the link will not open, say so and leave that one out of the plan.
3. Place it on every style where someone exploring that style would want it, and no
   others. Prefer the specific style over its parent (Shoegaze, not Alternative Rock)
   unless the piece is about the broad one. A piece about one artist goes on the styles
   that artist shaped. Overlap is fine; best fit is the goal.
4. Fill in what the row lacks from the source itself: `title` as published, `publication`
   (the channel, outlet or publisher), `year` (0 if the source does not say), `kind` (the
   issue lists the usual ones), and `access`. `note` is one plain line on what it gives
   you: over 20 characters, no em dash, nothing the source does not support.
5. Before writing anything, show the owner a table: issue, title, styles by name, and one
   line on why. Change whatever the owner changes.
6. Write the plan to a scratch file, never into the repo, keyed by issue number:
   `{"12": {"styles": ["shoegaze", "dreampop"], "kind": "documentary", "year": 1991, "why": "..."}}`.
   `node tools/ingest.js --apply plan.json` checks every entry first, then rewrites each
   issue's JSON and comments where it went and why. The dry run follows.
7. When everything is READY: `node tools/ingest.js --write`, `node test/run.js read`,
   commit and push, then `node tools/ingest.js --close`. Anything HELD says which field
   to fix; fix it in the plan and apply again.
