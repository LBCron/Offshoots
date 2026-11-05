#!/usr/bin/env python3
"""
Fetch artist photos from Wikimedia Commons, via Wikidata, for Music Atlas' key artists.

Why Commons and not Spotify or Apple: Music Atlas is one file plus a folder you drag to
Netlify, and it works offline. Spotify's and Apple's images may be displayed from their
servers but not downloaded and redistributed, so using them would mean hotlinking, which
breaks the installed copy and tells every one of those services who is reading. Commons
images are freely licensed, so they can be resized, shipped and cached. They need a
credit line, which is what credits.json is for.

Accuracy over coverage. Searching Wikidata by name alone finds the wrong Odetta sooner
or later, and a wrong face is worse than no face, because the glyph fallback already
looks deliberate. So a candidate is only accepted if Wikidata says it is a music act, by
carrying a MusicBrainz or Spotify artist ID. Anything else is recorded as a miss and
keeps its glyph.

Run it on your own machine, not in a Claude session: both sandboxes sit behind a network
allowlist that blocks Wikidata and Commons.

    pip3 install pillow
    python3 artist-photos.py keyartists.json ./artists

Resumable: a name whose file is already there is skipped, so you can stop it and run it
again. Writes artists/credits.json and artists/report.txt when it finishes.
"""

import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error

# Wikimedia's policy asks for a contact in the User-Agent and blocks agents that do not
# carry one. Put a real address here before a long run.
UA = "MusicAtlas/1.1 (https://musicatlas.us; artist portraits; contact: me@bryanbell.com)"
WD = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"

SIZE = 240          # the circle is 80px at 1x, so 240 covers a 3x screen
HEAD_BIAS = 0.14    # crop this far down from the top, not the middle: a standing shot
                    # centred on the frame cuts the head off, and most of these are
                    # standing shots rather than headshots
PAUSE = 0.25        # four a second. 0.1 was aggressive enough to start drawing 429s


# A lookup that fails is not a lookup that found nothing, and the first version of this
# script could not tell the difference: every error path returned None, pick() passed the
# None along, and the caller wrote "no music act with a photo on Wikidata" in the report.
# 1,561 names were recorded that way and most of them have a photo. Joan Baez has a
# photo. So FAILED is its own answer now, and the report counts it separately.
FAILED = object()


def get(url, params, tries=5):
    """One API call. Returns the parsed body, None for a real 404, or FAILED."""
    q = url + "?" + urllib.parse.urlencode(params)
    for n in range(tries):
        try:
            req = urllib.request.Request(q, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                # they tell you how long to wait; guessing is how you get blocked
                wait = e.headers.get("Retry-After")
                try: wait = float(wait)
                except (TypeError, ValueError): wait = 2 ** n
                if n < tries - 1:
                    time.sleep(min(wait, 60)); continue
                return FAILED
            if e.code in (403, 401):
                # almost always the User-Agent. Worth stopping for rather than writing
                # two thousand false negatives and calling it a result.
                print("\n  BLOCKED by Wikimedia (HTTP %d). Put a real contact in UA at the\n"
                      "  top of this file and run it again." % e.code)
                return FAILED
            if e.code == 404:
                return None
            if n < tries - 1:
                time.sleep(1 + n); continue
            return FAILED
        except Exception:
            if n < tries - 1:
                time.sleep(1 + n); continue
            return FAILED
    return FAILED


def slug(name):
    """
    Stable filename. The app computes the same thing, so the two must not drift.

    A name made only of punctuation leaves nothing behind: "!!!" is a real band and so is
    "$uicideboy$". Falling back to a constant would hand every such name the same file
    and the second one would overwrite the first, so the fallback is a hash of the name,
    which is ugly and unique. Collisions between two names that DO reduce to the same
    slug are caught by the caller, not papered over here.
    """
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if s:
        return s
    import hashlib
    return "n" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:10]


def candidates(name):
    """Wikidata entities whose label or alias matches, best first. FAILED if the ask did."""
    d = get(WD, {"action": "wbsearchentities", "search": name, "language": "en",
                 "uselang": "en", "type": "item", "limit": 10, "format": "json"})
    if d is FAILED:
        return FAILED
    return [h["id"] for h in (d or {}).get("search", [])]


# Occupations that say "this is a recording artist", the ones that say "this person is
# mainly something else", and the classes that say "this is a band". Scored rather than
# required, because the evidence is uneven: a 1950s singer may have none of it and a
# painter may carry a MusicBrainz ID for one spoken-word record.
MUSIC_OCC = {"Q177220", "Q639669", "Q2252262", "Q130857", "Q36834", "Q183945",
             "Q753110", "Q488205", "Q855091", "Q158852", "Q486748", "Q12800682"}
OTHER_OCC = {"Q1028181", "Q245068", "Q2526255", "Q36180", "Q82955", "Q1622272",
             "Q1650915", "Q3455803", "Q33999", "Q10800557", "Q2259451"}
BAND = {"Q215380", "Q2088357", "Q5741069", "Q9212979", "Q105756498"}


def claim_ids(claims):
    out = []
    for c in claims or []:
        try:
            out.append(c["mainsnak"]["datavalue"]["value"]["id"])
        except Exception:
            pass
    return out


def pick(ids, name):
    """
    The best candidate that is demonstrably a music act AND has a photo.

    Taking the first that carries a MusicBrainz ID is not enough: a Dutch painter and a
    Scottish comedian both have one, and searching "Armando" returned the painter. So
    candidates are scored and the best one wins, which also fixes the one-word band names
    that Wikidata ranks badly on their own: Boston, Kansas, Europe, Berlin, Can, Low.

    Nothing fixes a name that is genuinely ambiguous. The Chicago house producer Armando
    is not in Wikidata's results at all, and MusicBrainz offers 394 of them with an
    Italian film composer on top. A match like that is flagged low confidence and lands
    in review.txt rather than being quietly trusted.
    """
    if ids is FAILED:
        return FAILED
    if not ids:
        return None
    d = get(WD, {"action": "wbgetentities", "ids": "|".join(ids[:10]),
                 "props": "claims|labels|descriptions", "languages": "en",
                 "format": "json"})
    if d is FAILED:
        return FAILED
    if not d:
        return None
    best = None
    for qid in ids[:10]:
        ent = (d.get("entities") or {}).get(qid)
        if not ent:
            continue
        cl = ent.get("claims") or {}
        if "P18" not in cl:
            continue                                    # nothing to show
        if not ("P434" in cl or "P1902" in cl):
            continue                                    # no music identifier at all
        occ = set(claim_ids(cl.get("P106")))
        inst = set(claim_ids(cl.get("P31")))
        score = 0
        if "P1902" in cl:
            score += 3                                  # a Spotify id means a recording artist
        if inst & BAND:
            score += 3
        if occ & MUSIC_OCC:
            score += 2
        if occ & OTHER_OCC:
            score -= 2
        if cl.get("P136"):
            score += 2                                  # has a genre
        if best is None or score > best["score"]:
            try:
                fname = cl["P18"][0]["mainsnak"]["datavalue"]["value"]
            except Exception:
                continue
            best = {
                "qid": qid, "file": fname, "score": score,
                "label": ((ent.get("labels") or {}).get("en") or {}).get("value", ""),
                "desc": ((ent.get("descriptions") or {}).get("en") or {}).get("value", ""),
                "band": bool(inst & BAND),
            }
    if not best:
        return None
    # A bare first name or an ordinary word is where this goes wrong, and it goes wrong
    # silently. One token and not a band, or thin evidence either way, means look at it.
    one_word = len(re.findall(r"\w+", name)) == 1
    best["sure"] = best["score"] >= 5 and not (one_word and not best["band"])
    if best["score"] < 1:
        return None
    return best


def commons(fname):
    """The file at a workable width, plus who took it and under what licence."""
    d = get(COMMONS, {"action": "query", "titles": "File:" + fname, "prop": "imageinfo",
                      "iiprop": "url|extmetadata", "iiurlwidth": SIZE * 2, "format": "json"})
    if d is FAILED:
        return FAILED
    try:
        page = next(iter(d["query"]["pages"].values()))
        info = page["imageinfo"][0]
    except Exception:
        return None
    meta = info.get("extmetadata") or {}
    pull = lambda k: re.sub(r"<[^>]+>", "", (meta.get(k) or {}).get("value", "")).strip()
    return {
        "url": info.get("thumburl") or info.get("url"),
        "page": info.get("descriptionurl", ""),
        "author": pull("Artist") or "Unknown",
        "licence": pull("LicenseShortName") or pull("License") or "see source",
        "licence_url": (meta.get("LicenseUrl") or {}).get("value", ""),
    }


def square(src, dest):
    """Crop to a square biased toward the top, then down to SIZE."""
    from PIL import Image
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w > h:
        x = (w - h) // 2
        im = im.crop((x, 0, x + h, h))
    elif h > w:
        y = int((h - w) * HEAD_BIAS)
        im = im.crop((0, y, w, y + w))
    im = im.resize((SIZE, SIZE), Image.LANCZOS)
    im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    names_path, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)

    rows = json.load(open(names_path))
    names = [r["name"] if isinstance(r, dict) else r for r in rows]
    multi = {r["name"] for r in rows if isinstance(r, dict) and r.get("multi")}

    # Two names that reduce to one filename share a face. That is almost always right,
    # because slug() already ignores case and punctuation, so a collision means one act
    # spelled two ways: "Us3" and "US3". Sharing the file is the correct outcome and the
    # second lookup is skipped. It is still worth printing, because a collision is also
    # how you find a spelling to tidy up in the data.
    seen = {}
    dupes = []
    for n in list(names):
        s = slug(n)
        if s in seen and seen[s] != n:
            dupes.append((seen[s], n))
            names.remove(n)
        else:
            seen[s] = n
    for a, b in dupes:
        print(f"note: {a!r} and {b!r} are one filename, so one lookup covers both")

    cpath = os.path.join(outdir, "credits.json")
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    misses = []
    failed = []

    for i, name in enumerate(names, 1):
        s = slug(name)
        dest = os.path.join(outdir, s + ".jpg")
        if os.path.exists(dest) and name in credits:
            continue
        if name in multi:
            # "Fats Navarro & Tadd Dameron" is a credit, not a person: there is no one
            # portrait of it, and any match would be a photo of half the name
            misses.append((name, "a credit naming more than one act"))
            continue

        hit = pick(candidates(name), name)
        time.sleep(PAUSE)
        if hit is FAILED:
            failed.append(name)
            misses.append((name, "the lookup failed; run again to retry it"))
            print(f"[{i}/{len(names)}] !! {name} (lookup failed)")
            continue
        if not hit:
            misses.append((name, "no music act with a photo on Wikidata"))
            print(f"[{i}/{len(names)}] -- {name}")
            continue

        info = commons(hit["file"])
        time.sleep(PAUSE)
        if info is FAILED:
            failed.append(name)
            misses.append((name, "the lookup failed; run again to retry it"))
            print(f"[{i}/{len(names)}] !! {name} (Commons lookup failed)")
            continue
        if not info or not info["url"]:
            misses.append((name, "Wikidata names a file Commons did not serve"))
            print(f"[{i}/{len(names)}] -- {name} (no file)")
            continue

        tmp = dest + ".tmp"
        try:
            req = urllib.request.Request(info["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
                f.write(r.read())
            square(tmp, dest)
        except Exception as e:
            misses.append((name, f"download or crop failed: {e}"))
            print(f"[{i}/{len(names)}] -- {name} ({e})")
            continue
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

        credits[name] = {
            "file": s + ".jpg", "wikidata": hit["qid"], "matched": hit["label"],
            "description": hit["desc"], "sure": hit["sure"],
            "author": info["author"], "licence": info["licence"],
            "licence_url": info["licence_url"], "source": info["page"],
        }
        mark = "ok" if hit["sure"] else "??"
        print(f"[{i}/{len(names)}] {mark} {name}  <- {hit['label']}"
              f"{' (' + hit['desc'] + ')' if hit['desc'] else ''}")

        if i % 25 == 0:
            json.dump(credits, open(cpath, "w"), indent=1, ensure_ascii=False)

    json.dump(credits, open(cpath, "w"), indent=1, ensure_ascii=False)
    with open(os.path.join(outdir, "report.txt"), "w") as f:
        f.write(f"{len(credits)} of {len(names)} key artists have a photo\n")
        f.write(f"{len(misses)} did not, of which {len(failed)} were lookups that failed\n"
                f"rather than artists without a picture. Run the script again and it\n"
                f"will retry exactly those.\n\n")
        for n, why in misses:
            f.write(f"  {n}\n      {why}\n")

    # The ones worth a human glance, gathered so you read a hundred lines rather than
    # two thousand. Delete the file and the line in credits.json for any that is wrong.
    unsure = {n: c for n, c in credits.items() if not c.get("sure")}
    with open(os.path.join(outdir, "review.txt"), "w") as f:
        f.write(f"{len(unsure)} matches worth checking. The name is one word and not a\n"
                f"band, or the evidence was thin. Open the source link; if it is the\n"
                f"wrong person, delete the .jpg and its entry in credits.json.\n\n")
        for n, c in sorted(unsure.items()):
            f.write(f"  {n}\n      matched: {c['matched']} - {c.get('description','')}\n"
                    f"      {c['source']}\n")

    print(f"\n{len(credits)} photos, {len(misses)} without one.")
    if failed:
        print(f"{len(failed)} of those were failed lookups, not artists without a photo."
              f"\nRun it again to retry them.")
    print(f"{len(unsure)} of them are worth a glance: see review.txt")
    print(f"credits.json, report.txt and review.txt are in {outdir}")


if __name__ == "__main__":
    main()
