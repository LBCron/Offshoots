# Working on Music Atlas

README.md says how the data and the build work. This file is the short list of rules
that keep one session from undoing another's work.

## Start from the latest main

Main moves between sessions: other chats push to it, and approved suggestions land in
`src/data.js` through `tools/ingest.js`. Before changing anything, fetch and rebase onto
`origin/main` (or clone fresh). Edit the clone itself. Never copy `src/` files in from an
older copy or a scratchpad: that silently reverts whatever landed since.

## Making a change

- Edit `src/` (`head.html`, `data.js`, `app.js`), then `node src/build.js`. Commit `src/`
  and the rebuilt `index.html` together; Netlify serves the committed `index.html`.
- Edit a `data.js` table inside its own range (`const READ = {` to its `};`), never with a
  global replace: ids repeat across tables, and a global replace has corrupted data twice.
  Every table is one entry per line, `"key":value,` with a trailing comma, so a diff shows
  the entry that changed and `tools/manifest.js` can find it. Keep it that way.
- `node test/run.js data` after any edit to `data.js`: no browser, under a second, and it
  names the id or file that is wrong. The full run starts with it and stops if it fails.
- Run the suites that cover what changed (`node test/run.js read search`), or all of them
  for a change to `app.js` or `head.html`. Playwright installs with `npm run setup` (into
  `test/`, so the root has no dependencies and Netlify installs nothing on deploy).
- A push to `main` is live in about a minute. A branch or PR gets a deploy preview first.
  A push that changes nothing served (only `src/`, `test/`, `tools/`, docs) is skipped by
  the ignore rule in `netlify.toml`; `index.html` must be in the push for the site to move.

## Files that are not the map

| Path | What it is |
|---|---|
| `suggest.html`, `contribute.html` | The suggestion form and the bookmarklet page. Standalone pages, not built from `src/` |
| `netlify/functions/suggest.mjs` | Files each suggestion as an issue in the private `bryanbell/Offshoots-submissions` repo |
| `netlify.toml` | Publish `.`, functions in `netlify/functions`, the `/suggest` and `/contribute` addresses, image cache headers, and the deploy ignore rule |
| `tools/ingest.js` | Approved suggestion issues into `READ` and `PICKED` |

The function needs `GITHUB_TOKEN` and `CONTRIBUTORS`. Both live only in Netlify's
environment variables, marked secret and scoped to Functions, and a change to either
takes effect on the next deploy. Never write a token or a contributor key into a file,
a commit or a chat.

## Go deeper and guest picks

New Go deeper rows mostly arrive as suggestions. They are vetted on GitHub (edit the
issue's JSON into a finished row, swap `pending` for `approved`), then:

```
node tools/ingest.js            # dry run: what is ready, what still needs edits
node tools/ingest.js --write    # into src/data.js, and rebuild
npm test                        # then commit and push
node tools/ingest.js --close    # close the issues that landed
```

Adding a row by hand is still fine. Keep it to `test/read.test.js`'s rules: https, no
encyclopedias, a note over 20 characters with no em dash, a known access value and medium,
and a real year or 0.

A guest's pick is an ordinary `READ` row with its URL in `PICKED`. `CONTRIBUTORS` maps each
guest's secret key to a `PICKERS` id, and their personal link is `/contribute#k=<key>`.
