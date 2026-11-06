// POST /api/suggest: one suggested Go deeper link, filed as an issue for review.
//
// Nothing here touches the map. A suggestion becomes an issue in the private
// bryanbell/Offshoots-submissions repo, labelled pending; it reaches READ only after it
// has been read, edited and relabelled approved, and tools/ingest.js has been run.
//
// The GitHub token lives in Netlify's environment, never in the page, because the page
// is public and so is this repo. It can open issues in that one repo and nothing else.
//
// CONTRIBUTORS is a JSON object of secret key -> picker id, e.g. {"<key>":"pete"}. A
// submission carrying a known key is filed under that picker; anything else is anonymous.
// The key arrives from a personal bookmarklet, so it is a convenience, not a login: the
// worst a leaked key does is file suggestions that still have to be approved.

const REPO = "bryanbell/Offshoots-submissions";
// the five media READ already draws, so an approved row needs no translation
const MEDIA = { read: "Read", book: "Book", watch: "Watch", listen: "Listen", look: "Look" };
const MAX_BODY = 8000;
// the production domain, the Netlify site it is served from, any deploy preview or
// branch deploy of that, and netlify dev. The custom domain has to be listed in its own
// right: the form posts from whatever host the page was served on, so a request from
// musicatlas.us is rejected by an allowlist that only knows the netlify.app name.
const ORIGIN = /^https:\/\/(www\.)?musicatlas\.us$|^https:\/\/([a-z0-9-]+--)?musicatlas\.netlify\.app$|^https:\/\/([a-z0-9-]+--)?offshoots\.netlify\.app$|^http:\/\/localhost:\d+$/;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
// control characters out, whitespace trimmed, length capped
const clean = (v, n) => typeof v === "string"
  ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "";
// An issue title notifies whoever it @-mentions, and these words come from strangers.
const quiet = s => s.replace(/@/g, "@​");

function contributors() {
  const raw = (process.env.CONTRIBUTORS || "{}")
    // a value typed or pasted through an editor can come back with curly quotes
    .replace(/[\u201c\u201d]/g, '"').trim();
  try {
    const c = JSON.parse(raw);
    return c && typeof c === "object" && !Array.isArray(c) ? c : {};
  } catch {
    console.error(`CONTRIBUTORS is not valid JSON (${raw.length} chars, starts ${JSON.stringify(raw.slice(0, 2))})`);
    return {};
  }
}

// Pure so the tests can run it without a network: takes the parsed body and the
// environment, returns either {error} or the issue to file.
export function shape(b, env = {}) {
  if (!b || typeof b !== "object") return { error: "Nothing came through." };

  let url;
  try { url = new URL(clean(b.url, 2000)); } catch { return { error: "That link doesn't look right." }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "Links need to start with https://" };

  const medium = Object.hasOwn(MEDIA, b.medium) ? b.medium : "";
  if (!medium) return { error: "Say what kind of thing it is." };

  const styles = Array.isArray(b.styles)
    ? [...new Set(b.styles.filter(s => typeof s === "string" && /^[a-z0-9_]{1,40}$/.test(s)))].slice(0, 5)
    : [];

  const keys = env.contributors || {};
  const k = typeof b.k === "string" ? b.k : "";
  const by = k && Object.hasOwn(keys, k) && /^[a-z0-9_-]{1,30}$/.test(keys[k]) ? keys[k] : "";

  // Styles are a suggestion, from anyone. Where a piece goes is decided at review, often
  // on more styles than anyone suggested, so an empty list is fine.

  const y = parseInt(String(b.year || "").slice(0, 4), 10);
  const year = y >= 1800 && y <= new Date().getFullYear() + 1 ? y : 0;

  const title = clean(b.title, 300);
  // Field names and order are READ's, plus where it goes and who sent it. Editing this
  // block at review is the whole vetting step; ingest reads it back as written.
  const rec = {
    url: url.href, title,
    publication: clean(b.publication, 200), year,
    kind: "", access: "",
    note: clean(b.note, 1000),
    medium, styles,
    record: "",
    by, at: new Date().toISOString()
  };

  // JSON escapes everything except backticks, which would close the fence early
  const block = JSON.stringify(rec, null, 2).replace(/`/g, "\\u0060");
  const body = [
    `<${url.href}>`,
    "",
    "| | |", "|---|---|",
    `| What | ${MEDIA[medium]} |`,
    `| Suggested styles | ${styles.length ? styles.map(s => "`" + s + "`").join(", ") : "none"} |`,
    `| From | ${by || "anonymous"} |`,
    "",
    "To approve, swap `pending` for `approved`. Where it goes, and anything else the row is missing, is researched when approved suggestions are pulled in, and shown before anything is added.",
    "",
    "To overrule any of it, edit the JSON:",
    "",
    "- `styles`: where it goes. The suggested ones are only what the sender thought",
    "- `title`, `publication`, and `year` (0 if undated)",
    "- `kind`: longform, oral history, history, review, scene report, obituary, memoir, audio, documentary, photo essay, 33 1/3",
    "- `access`: \"\" if open, or paywall, partial, registration",
    "- `note`: one line on why it's worth opening, over 20 characters, no em dashes",
    "- `record`: only for a 33 1/3, the artist the book is about",
    "",
    "```json", block, "```"
  ].join("\n");

  const labels = ["pending"];
  if (by) labels.push(by + "s-picks");

  return {
    by,
    issue: {
      title: quiet(`${MEDIA[medium]}: ${title || url.hostname}`).slice(0, 200),
      body, labels
    }
  };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "POST only." });

  const origin = req.headers.get("origin");
  if (origin && !ORIGIN.test(origin)) return json(403, { ok: false, error: "Not from here." });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { ok: false, error: "That's more than a suggestion." });

  let b;
  try { b = JSON.parse(raw); } catch { return json(400, { ok: false, error: "Nothing came through." }); }

  // the hidden field only a bot fills in: tell it yes and file nothing
  if (b && b.website) return json(200, { ok: true });

  const keys = contributors();
  const out = shape(b, { contributors: keys });
  if (out.error) return json(400, { ok: false, error: out.error });
  // A key that arrived and matched nobody. Only the first four characters of each side
  // are logged: enough to see which key is which, nowhere near enough to use one.
  if (b.k && !out.by) {
    const head = k => String(k).slice(0, 4) + "\u2026(" + String(k).length + ")";
    console.warn(`key not recognised: sent ${head(b.k)}; CONTRIBUTORS has ${Object.keys(keys).length}: `
      + (Object.keys(keys).map(head).join(", ") || "none"));
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN is not set");
    return json(500, { ok: false, error: "Suggestions aren't switched on yet." });
  }

  const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "musicatlas-suggest",
      "content-type": "application/json"
    },
    body: JSON.stringify(out.issue)
  });
  if (!r.ok) {
    console.error("GitHub said", r.status, (await r.text()).slice(0, 500));
    return json(502, { ok: false, error: "Couldn't file it just now. Try again in a minute." });
  }
  return json(201, { ok: true, by: out.by });
};

export const config = { path: "/api/suggest" };
