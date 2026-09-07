#!/usr/bin/env python3
"""www_exposure.py -- measure how many routes were ever linked on the old
www.madebymatt.uk host across four local clones. READ-ONLY: never writes
into any repo. Prints a JSON summary to stdout.

Usage: python3 www_exposure.py [--extended]
  --extended  additionally scan .ts/.cjs/.mjs/.yml/.yaml (outside the
              requested extension list); reported separately, never merged
              into the headline count.
"""
import json, os, re, subprocess, sys

REPOS = {
    "Site":    "/home/user/mattroper1977.github.io",
    "Lessons": "/home/user/Lessons",
    "Apps":    "/home/user/matt-s-apps-",
    "Games":   "/home/user/games",
}
EXCLUDE_DIRS = {".git", "node_modules", "docs", "reports", "_sownb"}
TEXT_EXT = {".html", ".md", ".json", ".js", ".py", ".svg", ".csv", ".txt"}
EXTRA_EXT = {".ts", ".cjs", ".mjs", ".yml", ".yaml"}
PDF_EXT = {".pdf"}

# Exact patterns (Python `re`, applied per line of text).
HOST_RE      = re.compile(r"www\.madebymatt\.uk")                       # literal host, any form
URL_RE       = re.compile(r"(?:https?:)?//www\.madebymatt\.uk(?P<path>[^\s\"'<>)\\\],;]*)")  # scheme/protocol-relative URL + path
PLAY_RE      = re.compile(r"www\.madebymatt-play\.uk")                  # positive control (current canonical play host)
ENCODED_RE   = re.compile(r"www%2[Ee]madebymatt|www%2[Ff]madebymatt")   # percent-encoded forms
CONCAT_RE    = re.compile(r"['\"]www\.?['\"]\s*\+")                     # 'www.' + host string concatenation

PRINT_WORDS = re.compile(r"print|worksheet|printpack|handout|poster|card", re.I)
QR_WORDS    = re.compile(r"\bqr\b|qrcode|api\.qrserver", re.I)
HUB_NAMES   = re.compile(r"(^|/)(index\.html|START_HERE[^/]*|resources\.json|catalogue[^/]*|hub[^/]*)$", re.I)

def walk(root):
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in EXCLUDE_DIRS]
        for fn in fns:
            yield os.path.join(dp, fn)

def read_text(path, ext):
    if ext in PDF_EXT:
        # pdftotext if present, else `strings`
        for cmd in (["pdftotext", path, "-"], ["strings", path]):
            try:
                return subprocess.run(cmd, capture_output=True, text=True, errors="replace").stdout
            except FileNotFoundError:
                continue
        return ""
    try:
        with open(path, "r", errors="replace") as f:
            return f.read()
    except OSError:
        return ""

def classify(relpath, text):
    name = relpath.lower()
    if QR_WORDS.search(name) or QR_WORDS.search(text):
        return "qr"
    if HUB_NAMES.search(relpath):
        return "hub"
    if PRINT_WORDS.search(name):
        return "printed/worksheet"
    if PRINT_WORDS.search(text) and relpath.endswith((".html", ".md", ".svg", ".pdf")):
        return "printed/worksheet"
    return "other"

def git(repo, *args):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    return r.stdout.strip()

def main():
    extended = "--extended" in sys.argv
    out = {"repos": {}, "hits": [], "extended_hits": [], "play_control": {}, "pdf_scanned": 0,
           "encoded_or_concat": [], "patterns": {
               "host": HOST_RE.pattern, "url": URL_RE.pattern, "play": PLAY_RE.pattern,
               "encoded": ENCODED_RE.pattern, "concat": CONCAT_RE.pattern}}
    for label, root in REPOS.items():
        head = git(root, "rev-parse", "HEAD")
        depth = git(root, "rev-list", "--count", "HEAD")
        shallow = os.path.exists(os.path.join(root, ".git", "shallow"))
        out["repos"][label] = {"path": root, "head": head, "commits": int(depth or 0), "shallow": shallow}
        play_files, play_occ = 0, 0
        for path in walk(root):
            ext = os.path.splitext(path)[1].lower()
            in_main = ext in TEXT_EXT or ext in PDF_EXT
            in_extra = extended and ext in EXTRA_EXT
            if not (in_main or in_extra):
                continue
            text = read_text(path, ext)
            if ext in PDF_EXT:
                out["pdf_scanned"] += 1
            if not text:
                continue
            rel = os.path.relpath(path, root)
            if in_main:
                n = len(PLAY_RE.findall(text))
                if n:
                    play_files += 1; play_occ += n
                for m in ENCODED_RE.finditer(text):
                    out["encoded_or_concat"].append({"repo": label, "file": rel, "form": "encoded", "match": m.group(0)})
                for m in CONCAT_RE.finditer(text):
                    out["encoded_or_concat"].append({"repo": label, "file": rel, "form": "concat", "match": m.group(0)})
            if not HOST_RE.search(text):
                continue
            kind = classify(rel, text)
            for ln, line in enumerate(text.splitlines(), 1):
                if not HOST_RE.search(line):
                    continue
                urls = [m.group(0) for m in URL_RE.finditer(line)]
                paths = [m.group("path") or "/" for m in URL_RE.finditer(line)]
                rec = {"repo": label, "file": rel, "line": ln, "kind": kind,
                       "urls": urls, "paths": paths, "bare_host_only": not urls,
                       "text": line.strip()[:200]}
                (out["hits"] if in_main else out["extended_hits"]).append(rec)
        out["play_control"][label] = {"files": play_files, "occurrences": play_occ}

    # Dates per file (first-added and last touch of the host string).
    seen = {}
    for rec in out["hits"] + out["extended_hits"]:
        key = (rec["repo"], rec["file"])
        if key in seen:
            rec["dates"] = seen[key]; continue
        root = REPOS[rec["repo"]]
        d = {"first_added": git(root, "log", "--diff-filter=A", "--format=%cI", "-1", "--", rec["file"]),
             "last_S":      git(root, "log", "-1", "--format=%cI", "-S", "www.madebymatt.uk", "--", rec["file"]),
             "history":     "shallow: clone-commit date only" if out["repos"][rec["repo"]]["shallow"] else "full"}
        seen[key] = d; rec["dates"] = d

    # Route de-dup by path (headline = main scan only).
    def routes(hits):
        r = {}
        for h in hits:
            for p in h["paths"]:
                r.setdefault(p, {"kind": set(), "files": set()})
                r[p]["kind"].add(h["kind"]); r[p]["files"].add(f'{h["repo"]}:{h["file"]}')
        return {p: {"kinds": sorted(v["kind"]), "files": sorted(v["files"])} for p, v in r.items()}
    out["routes"] = routes(out["hits"])
    out["routes_extended"] = routes(out["extended_hits"])
    out["summary"] = {
        "files_with_host_main": len({(h["repo"], h["file"]) for h in out["hits"]}),
        "lines_with_host_main": len(out["hits"]),
        "routes_with_path_main": len(out["routes"]),
        "routes_by_kind_main": {k: sum(1 for v in out["routes"].values() if k in v["kinds"])
                                for k in ("printed/worksheet", "qr", "hub", "other")},
        "files_by_kind_main": {k: len({(h["repo"], h["file"]) for h in out["hits"] if h["kind"] == k})
                               for k in ("printed/worksheet", "qr", "hub", "other")},
        "files_with_host_extended": len({(h["repo"], h["file"]) for h in out["extended_hits"]}),
        "routes_with_path_extended": len(out["routes_extended"]),
        "play_control_total": {"files": sum(v["files"] for v in out["play_control"].values()),
                               "occurrences": sum(v["occurrences"] for v in out["play_control"].values())},
    }
    json.dump(out, sys.stdout, indent=1, default=sorted)
    print()

if __name__ == "__main__":
    main()
