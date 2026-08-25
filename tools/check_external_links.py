#!/usr/bin/env python3
"""External-link liveness instrument (Order TS §1.2, decision D3).

MEASURES, never judges alone: dead = non-200/NXDOMAIN on two runs >= 1 hour
apart, so this tool only records one run's verdicts. Removal decisions are
made by a human-readable diff of two runs' artifacts, never by one.

The URL census is DERIVED at run time from the served trees (this repo plus
shallow clones of the public Lessons, Games and Matt-s-Apps- repos), the same
universe the Order TS static census measured: every http(s) href/src in a
served .html file whose host is not this estate. A derivation that yields
zero URLs is MEASUREMENT INVALID (exit 2), not a clean bill.

YouTube is measured through its oEmbed endpoint: a removed video serves a
200 tombstone page, so a raw status code is not a measurement there.
oEmbed answers 200 for a live video and 4xx for a dead one.

Output: external-links-verdicts.json — {url: {"verdict": "OK"|"CANDIDATE-DEAD",
"detail": str, "files": [...]}} plus a printed table. Exit 0 unless the
census itself could not be measured.
"""
import html.parser
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ESTATE_HOSTS = {"madebymatt.uk", "www.madebymatt.uk", "mattroper1977.github.io"}
SIBLINGS = {
    "Lessons": "https://github.com/MattRoper1977/Lessons",
    "Games": "https://github.com/MattRoper1977/Games",
    "Matt-s-Apps-": "https://github.com/MattRoper1977/Matt-s-Apps-",
}
UA = "Mozilla/5.0 (X11; Linux x86_64) MadeByMatt-link-instrument/1.0"


def ensure_siblings(base):
    roots = {"site": "."}
    for name, url in SIBLINGS.items():
        p = os.path.join(base, name)
        if not os.path.isdir(os.path.join(p, ".git")):
            subprocess.run(["git", "clone", "--depth", "1", "--quiet", url, p], check=True)
        roots[name] = p
    return roots


LINK = re.compile(r'''(?:href|src)\s*=\s*["'](https?://[^"'#\s]+)''', re.I)


def census(roots):
    urls = {}
    for label, root in roots.items():
        for dp, dns, fns in os.walk(root):
            dns[:] = [d for d in dns if d not in (".git", "node_modules", "_attic")]
            for fn in fns:
                if not fn.endswith(".html"):
                    continue
                p = os.path.join(dp, fn)
                try:
                    raw = open(p, encoding="utf-8", errors="replace").read()
                except OSError:
                    continue
                for m in LINK.finditer(raw):
                    u = m.group(1)
                    host = urllib.parse.urlparse(u).netloc.lower()
                    if host and host not in ESTATE_HOSTS:
                        urls.setdefault(u, []).append(label + ":" + os.path.relpath(p, root))
    return urls


def probe_url(u):
    """One measurement. Returns (verdict, detail)."""
    host = urllib.parse.urlparse(u).netloc.lower()
    target = u
    if "youtube" in host or "youtu.be" in host:
        vid = None
        m = re.search(r"(?:embed/|watch\?v=|youtu\.be/)([A-Za-z0-9_-]{6,})", u)
        if m:
            vid = m.group(1)
        if vid:
            target = ("https://www.youtube.com/oembed?format=json&url="
                      + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}", safe=""))
        else:
            return ("OK", "youtube non-video URL, status not meaningful; not measured")
    req = urllib.request.Request(target, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return ("OK", f"HTTP {r.status}")
    except urllib.error.HTTPError as e:
        if e.code in (405, 403, 429):
            return ("OK", f"HTTP {e.code} (reachable; bot-gated, not dead)")
        return ("CANDIDATE-DEAD", f"HTTP {e.code} via {target[:80]}")
    except urllib.error.URLError as e:
        reason = str(getattr(e, "reason", e))
        if "Name or service not known" in reason or "NXDOMAIN" in reason or "nodename" in reason:
            return ("CANDIDATE-DEAD", f"NXDOMAIN: {reason[:100]}")
        return ("CANDIDATE-DEAD", f"unreachable: {reason[:100]}")
    except Exception as e:  # noqa: BLE001 — every failure is a measurement, not a crash
        return ("CANDIDATE-DEAD", f"error: {str(e)[:100]}")


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "/tmp/topshape-siblings"
    os.makedirs(base, exist_ok=True)
    roots = ensure_siblings(base)
    urls = census(roots)
    if not urls:
        print("MEASUREMENT INVALID: derived external-link census is empty "
              "(unit: URL; universe: http(s) href/src in served .html, 4 repos)")
        sys.exit(2)
    print(f"census: {len(urls)} distinct external URLs "
          f"(unit: URL; universe: http(s) href/src in served .html across 4 repos)")
    out = {}
    dead = 0
    for u in sorted(urls):
        verdict, detail = probe_url(u)
        out[u] = {"verdict": verdict, "detail": detail, "files": sorted(set(urls[u]))[:12]}
        if verdict != "OK":
            dead += 1
            print(f"  CANDIDATE-DEAD {u}  [{detail}]")
    print(f"verdicts: {len(out) - dead} OK, {dead} CANDIDATE-DEAD (one run; dead needs two runs >= 1h apart)")
    json.dump(out, open("external-links-verdicts.json", "w"), indent=1)


if __name__ == "__main__":
    main()
