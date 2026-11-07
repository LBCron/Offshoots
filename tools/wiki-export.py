"""Refresh the public wiki catalog from an XLSX export. Run from any directory."""
import collections
import json
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

wiki = Path(__file__).resolve().parent.parent / "wiki"
atlas = json.loads(subprocess.check_output(
    ["node", "-e", """const d=require(process.argv[1]); const {FAMS,DATA,PLAY,SPLAY,COVER,PTITLE,FAMSKIN,FAMMAP,DESC}=d;
    console.log(JSON.stringify({FAMS,DATA,PLAY,SPLAY,COVER,PTITLE,FAMSKIN,FAMMAP,DESC}));""",
     str(wiki.parent / "src/data.js")]))
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def sheets(path):
    with zipfile.ZipFile(path) as book:
        def xml(name):
            return ET.fromstring(book.read(name))
        strings = (["".join(s.itertext()) for s in xml("xl/sharedStrings.xml")]
                   if "xl/sharedStrings.xml" in book.namelist() else [])
        rels = {r.get("Id"): r.get("Target") for r in xml("xl/_rels/workbook.xml.rels")}
        for sheet in xml("xl/workbook.xml").findall("s:sheets/s:sheet", ns):
            name = sheet.get("name")
            if name not in {"Classes", "Tracks", "Published Tracks", "Publication Coverage"}:
                continue
            target = rels[sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")]
            target = target.lstrip("/") if target.startswith("/") else "xl/" + target
            rows = []
            for row in xml(target).findall("s:sheetData/s:row", ns):
                if int(row.get("r")) <= 5:
                    continue
                values = {}
                for cell in row:
                    key = re.match(r"[A-Z]+", cell.get("r")).group()
                    value = cell.findtext("s:v", default="", namespaces=ns)
                    kind = cell.get("t")
                    if kind == "s":
                        value = strings[int(value)]
                    elif kind == "inlineStr":
                        value = "".join(cell.find("s:is", ns).itertext())
                    values[key] = value
                rows.append(values)
            yield name, rows


def playlist(url):
    parsed = urlsplit(url)
    if parsed.scheme != "https":
        return ""
    if parsed.hostname in {"music.apple.com", "geo.music.apple.com"}:
        match = re.search(r"/playlist/(?:[^/]+/)?(pl\.[\w.-]+)$", parsed.path.rstrip("/"))
        if match:
            return "https://music.apple.com/us/playlist/" + match[1]
    if parsed.hostname == "open.spotify.com" and re.fullmatch(r"/playlist/[A-Za-z0-9]+", parsed.path):
        return "https://open.spotify.com" + parsed.path
    return ""


def normalized(value):
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFKC", value).casefold()))


workbook = dict(sheets(sys.argv[1]))
by_title = {normalized(t): i for i, t in atlas["PTITLE"].items()}
by_url = {playlist("https://music.apple.com/us" + u): i for i, u in atlas["PLAY"].items()}
by_url.update({playlist("https://open.spotify.com/playlist/" + u): i for i, u in atlas["SPLAY"].items()})
by_url.pop("", None)
styles = {r[0]: r for r in atlas["DATA"]}
children = collections.defaultdict(list)
for node in styles.values():
    for parent in node[4].split():
        children[parent].append(node[1])
covers = set(subprocess.check_output(
    ["git", "-C", str(wiki.parent), "ls-tree", "-r", "--name-only", "HEAD", "art"], text=True).splitlines())
coverage = collections.defaultdict(dict)
for r in workbook["Publication Coverage"]:
    url = playlist(r.get("F", ""))
    if r.get("D") == "Public" and url and r.get("C") in {"Apple Music", "Spotify"}:
        coverage[(r.get("A"), r.get("B"))][r["C"]] = url

tracks_by_link = collections.defaultdict(dict)
for r in workbook["Published Tracks"]:
    url = playlist(r.get("O", ""))
    if url and r.get("C", "").isdigit() and r.get("D") and r.get("E"):
        tracks_by_link[url][int(r["C"])] = [r["D"], r["E"], r.get("F", "")]

class_tracks = collections.defaultdict(dict)
for r in workbook["Tracks"]:
    if r.get("E") and r.get("B", "").isdigit() and r.get("C") and r.get("D"):
        class_tracks[r["E"]][int(r["B"])] = [r["C"], r["D"]]


catalog = []
seen = set()
def add(number, title, links, description="", library="", lineage=""):
    links = {service: url for service, url in links.items() if url}
    if not links or set(links.values()) & seen:
        return
    seen.update(links.values())
    style = next((by_url[u] for u in links.values() if u in by_url), by_title.get(normalized(title)))
    node = styles.get(style)
    sequences = {service: [pair + [position] for position, pair in sorted(tracks_by_link[url].items())]
                 for service, url in links.items() if tracks_by_link[url]}
    canonical = [pair for _, pair in sorted(class_tracks[library].items())]
    if canonical and not sequences:
        sequences["Curriculum order"] = canonical
    art = "art/" + atlas["COVER"].get(style, style or "") + ".jpg"
    key = re.sub(r"[^a-z0-9]+", "-", normalized(title)).strip("-") or "class"
    catalog.append(dict(
        id=key, number=number, title=title, links=links, description=description or atlas["DESC"].get(style, ""),
        style=style, family=node[3] if node else None, art="/" + art if art in covers else None,
        parents=[styles[p][1] for p in node[4].split() if p in styles] if node else [],
        children=children[style] if node else [], lineage=lineage if not node else "",
        sequences=sequences))


for row in workbook["Classes"]:
    number, title = row.get("A", ""), row.get("B", "")
    if not title:
        continue
    if number and not title.startswith(number + " "):
        title = number + " " + title
    apple, spotify = playlist(row.get("E", "")), playlist(row.get("I", ""))
    links = {**coverage.get((number, title), {}), "Apple Music": apple, "Spotify": spotify}
    for key, value in coverage.get((number, title), {}).items():
        links[key] = links.get(key) or value
    add(number, title, links, row.get("H", ""), row.get("G", ""), row.get("C", ""))

for (number, title), links in coverage.items():
    add(number, title, links)

palette = {k: {"name": label, "map": atlas["FAMMAP"].get(k),
               "panel": atlas["FAMSKIN"].get(k)} for k, label, *_ in atlas["FAMS"]}
assert len({row["id"] for row in catalog}) == len(catalog), "Duplicate class URL"
(wiki / "catalog.json").write_text(json.dumps({"classes": catalog, "families": palette},
                                             ensure_ascii=False, separators=(",", ":")) + "\n")
print(f"{len(catalog)} classes, {sum(bool(c['sequences']) for c in catalog)} with ordered tracks")
