#!/usr/bin/env python3
"""Per-page href census: stamping must add nothing and lose nothing (SW2 R-T3.4).

Chrome parity is not a licence to change where a page can go. This takes a
census before stamping and compares it after; anything added or lost is a
failure, and a retirement is not this part's to make -- retirements belong to
Parts H and U, each with its own two-tap assertion.

The census is a MULTISET, not a set. Several of these pages link the same route
twice, once in the nav row and once in the body, and a set would let one of
those disappear silently.

  python3 tools/sw2/check_href_census.py --snapshot before.json
  ... stamp ...
  python3 tools/sw2/check_href_census.py --compare before.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RECORD = ROOT / "data" / "adult-surfaces.json"

# The verifier's own page set. data/adult-surfaces.json is the record of which
# surfaces a pupil can reach, and it is NOT a list of every page type that
# carries chrome: it omits the chooser and /stats/, both of which
# tools/verify_professional_site.js treats as key pages. The stamp set is the
# union, or those two would drift away from every other page.
VERIFIER_PAGES = (
    "index.html",
    "main/index.html",
    "games/index.html",
    "tools/index.html",
    "resources/index.html",
    "members/index.html",
    "privacy/index.html",
    "stats/index.html",
)

# Generated page types change through their generator, never their output.
GENERATED = ("for/", "asdan/", "uas/")

HREF = re.compile(r"""href\s*=\s*["']([^"']*)["']""", re.I)


def pages() -> list[str]:
    record = json.loads(RECORD.read_text())
    named = {str(e["page"]) for e in record["adultSurfaces"]}
    named |= {str(e["page"]) for e in record["pupilReachableSurfaces"]}
    named |= set(VERIFIER_PAGES)
    out = [p for p in sorted(named) if not p.startswith(GENERATED) and (ROOT / p).is_file()]
    return out


def census() -> dict[str, dict[str, int]]:
    return {p: dict(Counter(HREF.findall((ROOT / p).read_text()))) for p in pages()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", help="write the census to this file")
    parser.add_argument("--compare", help="compare the current census against this file")
    args = parser.parse_args()

    now = census()

    if args.snapshot:
        Path(args.snapshot).write_text(json.dumps(now, indent=1, sort_keys=True) + "\n")
        total = sum(sum(c.values()) for c in now.values())
        print(f"census written: {len(now)} pages, {total} hrefs")
        return 0

    if not args.compare:
        parser.error("one of --snapshot or --compare is required")

    before = json.loads(Path(args.compare).read_text())
    problems: list[str] = []
    declared_path = Path(__file__).resolve().parent / "href_census_declared.json"
    declared = json.loads(declared_path.read_text())["declared"] if declared_path.is_file() else {}
    noted: list[str] = []

    for page in sorted(set(before) | set(now)):
        was = Counter(before.get(page, {}))
        has = Counter(now.get(page, {}))
        if page not in before:
            problems.append(f"{page}: page appeared after stamping")
            continue
        if page not in now:
            problems.append(f"{page}: page disappeared after stamping")
            continue
        lost = was - has
        added = has - was
        allow = declared.get(page, {})
        allow_added = Counter(allow.get("added", {}))
        allow_lost = Counter(allow.get("lost", {}))
        for href, n in sorted((lost - allow_lost).items()):
            problems.append(f"{page}: LOST {n} x {href!r}")
        for href, n in sorted((added - allow_added).items()):
            problems.append(f"{page}: ADDED {n} x {href!r}")
        for href, n in sorted((lost & allow_lost).items()):
            noted.append(f"{page}: declared LOST {n} x {href!r} -- {allow.get('reason','')[:80]}")
        for href, n in sorted((added & allow_added).items()):
            noted.append(f"{page}: declared ADDED {n} x {href!r} -- {allow.get('reason','')[:80]}")

    total = sum(sum(c.values()) for c in now.values())
    print(f"compared {len(now)} pages, {total} hrefs")
    for page in sorted(now):
        was = sum(Counter(before.get(page, {})).values())
        has = sum(Counter(now[page]).values())
        print(f"  {page:32} {was:>4} -> {has:<4} {'ok' if was == has else 'CHANGED'}")

    if noted:
        print(f"\ndeclared changes: {len(noted)}")
        for line in noted:
            print("  " + line)

    if problems:
        print(f"\nPROBLEMS: {len(problems)}", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        return 1

    print("\n0 added, 0 lost")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
