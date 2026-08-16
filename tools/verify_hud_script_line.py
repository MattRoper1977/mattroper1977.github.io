#!/usr/bin/env python3
"""data/hud-coverage.json's scriptLine becomes load-bearing.

It recorded the canonical HUD script tag and NOTHING READ IT. Twelve root game
routes carry that literal, each inserted by hand in one commit in August and
maintained by hand since. A canonical string with no consumer is a declaration
nothing exercises — R0.1 inverted — and twelve hand-maintained copies of one
literal will drift. They have not yet; that is luck, not a guarantee, and this
is the difference between the two.

The route set is DERIVED from data/mbm-search-index.json, the same record
verify_hud_on_games.py iterates, so a route added there is covered here without
anyone remembering to add it.

  python3 tools/verify_hud_script_line.py            assert
  python3 tools/verify_hud_script_line.py --self-test   prove it can go red
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COVERAGE = ROOT / "data" / "hud-coverage.json"
INDEX = ROOT / "data" / "mbm-search-index.json"
ROOT_GAME_ROUTE = re.compile(r"^/[A-Za-z0-9_-]+/$")
# Any hud.js script tag, however written. Matching loosely is the point: a route
# whose tag differs from the canonical one must be FOUND, not missed.
ANY_HUD_TAG = re.compile(r'<script\b[^>]*\bsrc="/hud\.js"[^>]*>(?:</script>)?')


def root_game_routes() -> list[str]:
    entries = json.loads(INDEX.read_text(encoding="utf-8"))["entries"]
    routes = {e["route"] for e in entries
              if e.get("category") == "game" and ROOT_GAME_ROUTE.match(e.get("route", ""))}
    if not routes:
        raise SystemExit("no root-level game routes derived — an empty set would assert nothing")
    return sorted(routes)


def canonical() -> str:
    line = json.loads(COVERAGE.read_text(encoding="utf-8")).get("scriptLine")
    if not line:
        raise SystemExit("data/hud-coverage.json has no scriptLine — nothing to assert against")
    return line


def check(root: Path = ROOT) -> tuple[list[str], list[str], int]:
    line = canonical()
    passes, failures, carrying = [], [], 0
    for route in root_game_routes():
        page = root / route.strip("/") / "index.html"
        if not page.is_file():
            continue
        found = ANY_HUD_TAG.findall(page.read_text(encoding="utf-8", errors="replace"))
        if not found:
            continue
        carrying += 1
        if len(found) != 1:
            failures.append(f"{route} carries {len(found)} hud script tags; one is the contract")
        elif found[0] != line:
            failures.append(f"{route} has {found[0]!r}, canonical is {line!r}")
        else:
            passes.append(route)
    return passes, failures, carrying


def self_test() -> int:
    """The control. Mutate a copy and the check must go red on it."""
    import shutil, tempfile
    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp) / "site"
        scratch.mkdir()
        (scratch / "data").mkdir()
        shutil.copy(COVERAGE, scratch / "data" / "hud-coverage.json")
        shutil.copy(INDEX, scratch / "data" / "mbm-search-index.json")
        victim = None
        for route in root_game_routes():
            page = ROOT / route.strip("/") / "index.html"
            if page.is_file() and ANY_HUD_TAG.search(page.read_text(encoding="utf-8", errors="replace")):
                dest = scratch / route.strip("/")
                dest.mkdir(parents=True)
                shutil.copy(page, dest / "index.html")
                if victim is None:
                    victim = dest / "index.html"
        if victim is None:
            print("[SELF-TEST] INCONCLUSIVE: no route carries a hud tag, so nothing to mutate")
            return 2
        clean_pass, clean_fail, _ = check(scratch)
        if clean_fail:
            print(f"[SELF-TEST] FAIL: the unmutated copy is already red — {clean_fail}")
            return 1
        text = victim.read_text(encoding="utf-8")
        victim.write_text(ANY_HUD_TAG.sub('<script src="/hud.js"></script>', text, count=1), encoding="utf-8")
        _, dirty_fail, _ = check(scratch)
        if not dirty_fail:
            print("[SELF-TEST] FAIL: dropping `defer` from one route did not go red — the check proves nothing")
            return 1
        print(f"[SELF-TEST] PASS: clean copy green over {len(clean_pass)} route(s); "
              f"one altered tag goes red — {dirty_fail[0]}")
        return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--self-test", action="store_true", help="prove the check can go red, then exit")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    passes, failures, carrying = check()
    for f in failures:
        print(f"[FAIL] {f}")
    print(f"hud scriptLine: {len(passes)} route(s) byte-identical to the canonical string, "
          f"{len(failures)} divergent, out of {carrying} carrying a tag "
          f"({len(root_game_routes())} root game routes derived from data/mbm-search-index.json)")
    if carrying == 0:
        print("[INCONCLUSIVE] no route carries a hud script tag — this asserted nothing")
        return 2
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
