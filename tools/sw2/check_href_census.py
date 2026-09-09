#!/usr/bin/env python3
"""Per-page navigation census: stamping adds nothing and loses nothing (R-T3.4).

Chrome parity is not a licence to change where a page can go. This compares the
working tree against a git baseline and fails on any change, so a link cannot be
retired as a side effect of stamping. Retirements belong to Parts H and U, each
with its own two-tap assertion.

Two things this gets right on purpose:

MULTISET, not set. Every one of the twelve pages repeats at least one route --
the chooser links /main/ six times -- so a set would let one copy disappear in
silence.

ANCHORS, not every href attribute. R-T3.4 is about where a page can go, and a
<link rel="stylesheet" href="..."> is not somewhere a reader can go. Counting it
would make linking the T1 token file look like twelve new routes. Non-anchor
hrefs are still reported, as a separate line, so the addition is visible rather
than invisible -- it just is not a navigation failure.

The baseline comes from git rather than a snapshot file, so the gate cannot be
fooled by a stale snapshot and needs no setup step.

  python3 tools/sw2/check_href_census.py --base origin/main
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RECORD = ROOT / "data" / "adult-surfaces.json"

# data/adult-surfaces.json records which surfaces a pupil can reach; it is not a
# list of every page carrying chrome. It omits the chooser and /stats/, which
# tools/verify_professional_site.js treats as key pages, so the set is the union.
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

GENERATED = ("for/", "asdan/", "uas/")

ANCHOR = re.compile(r"""<a\b[^>]*?href\s*=\s*["']([^"']*)["']""", re.I | re.S)
ANY_HREF = re.compile(r"""href\s*=\s*["']([^"']*)["']""", re.I)


def pages() -> list[str]:
    record = json.loads(RECORD.read_text())
    named = {str(e["page"]) for e in record["adultSurfaces"]}
    named |= {str(e["page"]) for e in record["pupilReachableSurfaces"]}
    named |= set(VERIFIER_PAGES)
    return [p for p in sorted(named) if not p.startswith(GENERATED) and (ROOT / p).is_file()]


def at_base(base: str, rel: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(ROOT), "show", f"{base}:{rel}"], capture_output=True, text=True
    )
    return result.stdout if result.returncode == 0 else None


def declared() -> dict:
    path = Path(__file__).resolve().parent / "href_census_declared.json"
    return json.loads(path.read_text())["declared"] if path.is_file() else {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="origin/main", help="git ref to compare against")
    args = parser.parse_args()

    allow_all = declared()
    problems: list[str] = []
    noted: list[str] = []
    rows: list[tuple[str, int, int, int, int]] = []

    for rel in pages():
        before_text = at_base(args.base, rel)
        after_text = (ROOT / rel).read_text()
        if before_text is None:
            noted.append(f"{rel}: new page, not present at {args.base}")
            continue

        was = Counter(ANCHOR.findall(before_text))
        has = Counter(ANCHOR.findall(after_text))
        other_was = sum(Counter(ANY_HREF.findall(before_text)).values()) - sum(was.values())
        other_has = sum(Counter(ANY_HREF.findall(after_text)).values()) - sum(has.values())
        rows.append((rel, sum(was.values()), sum(has.values()), other_was, other_has))

        allow = allow_all.get(rel, {})
        allow_added = Counter(allow.get("added", {}))
        allow_lost = Counter(allow.get("lost", {}))
        lost, added = was - has, has - was

        for href, n in sorted((lost - allow_lost).items()):
            problems.append(f"{rel}: LOST {n} x {href!r}")
        for href, n in sorted((added - allow_added).items()):
            problems.append(f"{rel}: ADDED {n} x {href!r}")
        for href, n in sorted((lost & allow_lost).items()):
            noted.append(f"{rel}: declared LOST {n} x {href!r}")
        for href, n in sorted((added & allow_added).items()):
            noted.append(f"{rel}: declared ADDED {n} x {href!r}")

    print(f"navigation census against {args.base}: {len(rows)} pages")
    print(f"  {'page':32}{'anchors':>16}   {'other href':>14}")
    for rel, was, has, ow, oh in rows:
        flag = "ok" if was == has else "CHANGED"
        other = f"{ow} -> {oh}" + ("" if ow == oh else "  (not navigation)")
        print(f"  {rel:32}{was:>6} -> {has:<6} {flag:<8}{other}")

    if noted:
        print(f"\ndeclared / noted: {len(noted)}")
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
