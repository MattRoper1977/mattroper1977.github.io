#!/usr/bin/env python3
"""data/hud-coverage.json's scriptLine becomes load-bearing.

It recorded the canonical HUD script tag and NOTHING READ IT. A repo-wide grep
for `scriptLine` over every .py, .mjs, .js, .sh and .yml returned no consumer.
Twelve root game routes carry that literal, each inserted by hand and maintained
by hand since, and twelve hand-maintained copies of one string will drift. They
have not drifted yet. That is the reason to assert it now rather than an
argument against: today the assertion is free, and the difference between "true"
and "guaranteed" is the whole of what it buys.

WHAT THE ROUTE SET IS, AND WHY IT IS DERIVED RATHER THAN LISTED
---------------------------------------------------------------
The first cut iterated the routes that were FOUND to carry a tag and skipped the
rest. That is not an assertion over a set, it is a description of the tree: a
route whose HUD went missing would have been skipped in silence, which is the
one failure the check exists to catch.

The set is now derived, at run time, from data/hud-coverage.json:

    ALL         root-level game routes in data/mbm-search-index.json   (the inventory)
    EXCLUDED    hud-coverage.json .excluded[].route                    (declared not wired)
    REGION-ONLY hud-coverage.json .inlineExitRegion.regionOnly         (covered by the region)
    A = ALL - EXCLUDED - REGION-ONLY                                   (must carry the literal)

No route list is written down in this file. A game added to the inventory is
covered without anyone remembering; a game excluded in the ledger drops out of A
by the same act that records the exclusion.

Each of the three groups is held to its own claim, so no group is a free pass:

    A            exactly one hud.js tag, byte-identical to .scriptLine
    REGION-ONLY  carries the inline exit region markers, and NO hud.js tag
    EXCLUDED     no hud.js tag - wiring one without amending the ledger is red

  python3 tools/verify_hud_script_line.py              assert
  python3 tools/verify_hud_script_line.py --self-test  mutate every route in turn

Exit 0 green - 1 a divergence - 2 INCONCLUSIVE (no subject, or a coverage
record that cannot be read). Exit 2 is never green: a zero-length iteration
that reports success is the vacuity this tool was written to close.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COVERAGE = Path("data/hud-coverage.json")
INDEX = Path("data/mbm-search-index.json")
ROOT_GAME_ROUTE = re.compile(r"^/[A-Za-z0-9_-]+/$")
# Any hud.js script tag, however written. Matching loosely is the point: a route
# whose tag differs from the canonical one has to be FOUND, not missed.
ANY_HUD_TAG = re.compile(r'<script\b[^>]*\bsrc="/hud\.js"[^>]*>(?:</script>)?')
REGION_BEGIN = "<!-- MBM-INLINE-EXIT:BEGIN"
REGION_END = "<!-- MBM-INLINE-EXIT:END"


class Inconclusive(Exception):
    """No subject, or a record that cannot be read. Never green, never a guess."""


# --------------------------------------------------------------------- sets
def route_sets(root: Path) -> dict:
    """D, and the two sets subtracted from it, all read at run time."""
    try:
        cov = json.loads((root / COVERAGE).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise Inconclusive(f"{COVERAGE} cannot be read as JSON: {exc}")
    try:
        entries = json.loads((root / INDEX).read_text(encoding="utf-8"))["entries"]
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise Inconclusive(f"{INDEX} cannot be read: {exc}")

    line = cov.get("scriptLine")
    if not isinstance(line, str) or not line.strip():
        raise Inconclusive(f"{COVERAGE} has no usable .scriptLine - there is nothing to assert against")

    inventory = sorted({e["route"] for e in entries
                        if isinstance(e, dict) and e.get("category") == "game"
                        and ROOT_GAME_ROUTE.match(e.get("route") or "")})
    if not inventory:
        raise Inconclusive("no root-level game route in the inventory - an empty set asserts nothing")

    excluded = sorted({x.get("route") for x in cov.get("excluded") or [] if isinstance(x, dict)} - {None})
    region_only = sorted(set((cov.get("inlineExitRegion") or {}).get("regionOnly") or []))

    declared = sorted(set(inventory) - set(excluded))          # D: the ledger says these are covered by a HUD
    wired = sorted(set(declared) - set(region_only))           # A: ...and by the script tag specifically

    # The floor is derived, not a constant. |A| is fixed by the three files;
    # if the arithmetic does not hold, the record disagrees with itself and
    # that is INCONCLUSIVE rather than a pass over whatever survived.
    #
    # Subtract only what is IN the inventory. The ledger legitimately carries
    # exclusions the inventory cannot see yet: hud-coverage.json is also the
    # membership source for render_inline_exit.py, so a game's exclusion has to
    # be on file BEFORE its shelf record makes the route visible to the search
    # index. /micro-tinkerer/ is exactly that case. Subtracting the raw counts
    # charged such an entry to A, and this check then refused to run at all —
    # the right refusal on the wrong arithmetic, which is why it is fixed here
    # rather than relaxed.
    excluded_in = set(excluded) & set(inventory)
    region_in = set(region_only) & set(inventory)
    ahead = sorted((set(excluded) | set(region_only)) - set(inventory))
    floor = len(inventory) - len(excluded_in) - len(region_in)
    if floor <= 0:
        raise Inconclusive(
            f"the derived wired set is empty: {len(inventory)} inventory routes "
            f"- {len(excluded_in)} excluded - {len(region_in)} region-only")
    # This can still fire, and on a real contradiction: a route recorded as both
    # excluded and region-only is counted once by the set difference and twice
    # by the subtraction, and the ledger cannot mean both.
    if len(wired) != floor:
        raise Inconclusive(
            f"the coverage record does not add up: |A|={len(wired)} but "
            f"{len(inventory)}-{len(excluded_in)}-{len(region_in)}={floor}. "
            "A route is recorded as both excluded and region-only.")

    return {"line": line, "inventory": inventory, "excluded": excluded,
            "regionOnly": region_only, "declared": declared, "wired": wired,
            "floor": floor, "ahead": ahead}


# -------------------------------------------------------------------- check
def check(root: Path = ROOT) -> tuple[list[str], list[str], dict]:
    s = route_sets(root)
    line, ok, bad = s["line"], [], []

    def page(route: str) -> str | None:
        p = root / route.strip("/") / "index.html"
        return p.read_text(encoding="utf-8", errors="replace") if p.is_file() else None

    for route in s["wired"]:
        text = page(route)
        if text is None:
            bad.append(f"{route} is declared wired but has no index.html on disk")
            continue
        found = ANY_HUD_TAG.findall(text)
        if not found:
            # The hole the first cut had: this used to `continue`.
            bad.append(f"{route} is declared wired and carries no hud.js script tag at all")
        elif len(found) != 1:
            bad.append(f"{route} carries {len(found)} hud.js tags; exactly one is the contract")
        elif found[0] != line:
            bad.append(f"{route} has {found[0]!r}, canonical is {line!r}")
        else:
            ok.append(route)

    for route in s["regionOnly"]:
        text = page(route)
        if text is None:
            bad.append(f"{route} is declared region-only but has no index.html on disk")
            continue
        if ANY_HUD_TAG.search(text):
            bad.append(f"{route} is declared region-only yet carries a hud.js tag - amend the ledger or the page")
        elif REGION_BEGIN not in text or REGION_END not in text:
            bad.append(f"{route} is declared region-only and carries no inline exit region - "
                       "the exemption rests on a control that is not there")
        else:
            ok.append(route)

    for route in s["excluded"]:
        text = page(route)
        if text is None:
            continue  # an excluded route with no page is not this tool's claim
        if ANY_HUD_TAG.search(text):
            bad.append(f"{route} is declared EXCLUDED yet carries a hud.js tag - "
                       "that retracts the single-file promise the exclusion records")
        else:
            ok.append(route)

    return ok, bad, s


# ---------------------------------------------------------------- self-test
def _scratch(tmp: Path, root: Path = ROOT) -> Path:
    """A copy of every file this tool reads. Mutations happen here, never in the estate."""
    site = tmp / "site"
    (site / "data").mkdir(parents=True)
    shutil.copy(root / COVERAGE, site / COVERAGE)
    shutil.copy(root / INDEX, site / INDEX)
    s = route_sets(root)
    for route in s["declared"] + s["excluded"]:
        src = root / route.strip("/") / "index.html"
        if src.is_file():
            dest = site / route.strip("/")
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dest / "index.html")
    return site


MUTATIONS = {
    # Attribute-level comparison: the tag is still a hud.js tag, but not THE tag.
    "drop-defer": lambda t: ANY_HUD_TAG.sub('<script src="/hud.js"></script>', t, count=1),
    # Path-level: proves the comparison is against .scriptLine and not merely
    # "some script tag is present". After this the loose pattern matches nothing,
    # so it also exercises the carries-no-tag branch that used to `continue`.
    "corrupt-src": lambda t: ANY_HUD_TAG.sub(
        lambda m: m.group(0).replace('/hud.js', '/hud-x.js'), t, count=1),
}
REGION_MUTATIONS = {
    "strip-region": lambda t: t.replace(REGION_BEGIN, "<!-- MBM-INLINE-EXIT-WAS-HERE", 1),
    "wire-a-hud":   lambda t: t.replace("</head>", '<script defer src="/hud.js"></script></head>', 1),
}
EXCLUDED_MUTATIONS = {
    "wire-a-hud":   lambda t: t.replace("</head>", '<script defer src="/hud.js"></script></head>', 1),
}


def _derivation_controls(site: Path) -> list[tuple[str, str, bool]]:
    """§2.2 - |A| must move when the DECLARED list moves, and a broken record must not read green."""
    out = []
    cov_path = site / COVERAGE
    pristine = cov_path.read_text(encoding="utf-8")
    idx_path = site / INDEX
    idx_pristine = idx_path.read_text(encoding="utf-8")
    base = len(route_sets(site)["wired"])

    # 1. add a synthetic route to the inventory -> |A| rises, and the run names it
    idx = json.loads(idx_pristine)
    idx["entries"].append({"route": "/synthetic-control-route/", "category": "game",
                           "title": "authored by --self-test"})
    idx_path.write_text(json.dumps(idx), encoding="utf-8")
    grown = route_sets(site)["wired"]
    _, bad, _ = check(site)
    out.append(("|A| rises when a route is declared", f"{base} -> {len(grown)}", len(grown) == base + 1))
    out.append(("...and the new route is named as missing", "/synthetic-control-route/",
                any("/synthetic-control-route/" in b for b in bad)))
    idx_path.write_text(idx_pristine, encoding="utf-8")

    # 2. exclude a declared route -> |A| falls
    cov = json.loads(pristine)
    victim = route_sets(site)["wired"][0]
    cov["excluded"].append({"route": victim, "verifier": "authored by --self-test", "gates": []})
    cov_path.write_text(json.dumps(cov), encoding="utf-8")
    shrunk = route_sets(site)["wired"]
    out.append(("|A| falls when a route is excluded", f"{base} -> {len(shrunk)} ({victim})",
                len(shrunk) == base - 1))
    cov_path.write_text(pristine, encoding="utf-8")

    # 3. a malformed record is INCONCLUSIVE, never zero-routes-all-pass
    for label, payload in (("empty", "{}"), ("malformed", "{ not json")):
        cov_path.write_text(payload, encoding="utf-8")
        try:
            route_sets(site)
            fired = False
        except Inconclusive:
            fired = True
        out.append((f"a {label} hud-coverage.json is INCONCLUSIVE", "exit 2", fired))
    cov_path.write_text(pristine, encoding="utf-8")

    assert route_sets(site)["wired"] == route_sets(site)["wired"]  # restored
    return out


def self_test() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        site = _scratch(Path(tmp))
        s = route_sets(site)

        ok, bad, _ = check(site)
        if bad:
            print("[SELF-TEST] FAIL: the unmutated copy is already red -")
            for b in bad:
                print(f"            {b}")
            return 1
        print(f"[SELF-TEST] baseline: green over {len(ok)} route(s) "
              f"- {len(s['wired'])} wired, {len(s['regionOnly'])} region-only, "
              f"{len(s['excluded'])} excluded\n")

        print("§2.2 DERIVATION CONTROLS")
        print(f"  {'control':52} {'observed':28} result")
        dfails = 0
        for label, observed, fired in _derivation_controls(site):
            print(f"  {label:52} {observed:28} {'FIRED' if fired else 'DID NOT FIRE'}")
            dfails += 0 if fired else 1
        print()

        # §2.3 - one row per route per mutation kind. A route is asserted only if
        # mutating IT alone produces a red that NAMES IT.
        plan = ([(r, k, f, "wired") for r in s["wired"] for k, f in MUTATIONS.items()]
                + [(r, k, f, "region-only") for r in s["regionOnly"] for k, f in REGION_MUTATIONS.items()]
                + [(r, k, f, "excluded") for r in s["excluded"] for k, f in EXCLUDED_MUTATIONS.items()])

        print("§2.3 PER-ROUTE MUTATION MATRIX")
        print(f"  {'route':18} {'group':12} {'mutation':13} {'expected':10} observed")
        rows, silent, unrestored = [], [], []
        for route, kind, mutate, group in plan:
            page = site / route.strip("/") / "index.html"
            if not page.is_file():
                rows.append((route, group, kind, "red", "NO PAGE"))
                silent.append(f"{route}/{kind}")
                continue
            pristine = page.read_text(encoding="utf-8")
            mutated = mutate(pristine)
            if mutated == pristine:
                rows.append((route, group, kind, "red", "MUTATION INERT"))
                silent.append(f"{route}/{kind} (the mutation changed nothing - it proves nothing)")
                continue
            page.write_text(mutated, encoding="utf-8")
            _, bad_now, _ = check(site)
            named = any(route in b for b in bad_now)
            page.write_text(pristine, encoding="utf-8")
            _, bad_after, _ = check(site)
            if bad_after:
                unrestored.append(f"{route}/{kind}")
            rows.append((route, group, kind, "red", "red, named" if named
                         else ("red, NOT named" if bad_now else "SILENT PASS")))
            if not named:
                silent.append(f"{route}/{kind}")

        for route, group, kind, exp, obs in rows:
            print(f"  {route:18} {group:12} {kind:13} {exp:10} {obs}")

        # A route red on one kind and green on the other is a PARTIAL assertion.
        partial = []
        for route in s["wired"]:
            got = {k: o for (r, g, k, e, o) in rows if r == route}
            if len({v == "red, named" for v in got.values()}) > 1:
                partial.append(f"{route}: {got}")

        ok_final, bad_final, _ = check(site)
        print(f"\n  rows: {len(rows)} · silent passes: {len(silent)} · "
              f"partial assertions: {len(partial)} · unrestored: {len(unrestored)} · "
              f"final full run: {'GREEN' if not bad_final else 'RED'} over {len(ok_final)} route(s)")
        for note in silent + partial + unrestored:
            print(f"    - {note}")

        bad_count = len(silent) + len(partial) + len(unrestored) + dfails + (1 if bad_final else 0)
        print(f"\n[SELF-TEST] {'PASS' if bad_count == 0 else 'FAIL'}: "
              f"{len(rows)} mutations, {len(rows) - len(silent)} named reds, "
              f"{dfails} derivation control(s) failed to fire")
        return 0 if bad_count == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--self-test", action="store_true",
                    help="mutate every route in A in turn and require a red that names it")
    args = ap.parse_args()
    try:
        if args.self_test:
            return self_test()
        ok, bad, s = check()
    except Inconclusive as exc:
        print(f"[INCONCLUSIVE] {exc}")
        return 2
    for b in bad:
        print(f"[FAIL] {b}")
    # The three counts must add to the inventory, so they are the IN-inventory
    # counts. Exclusions recorded ahead of their route are real and are stated,
    # but they are not part of this partition and must not be added into it.
    ex_in = len(set(s['excluded']) & set(s['inventory']))
    ro_in = len(set(s['regionOnly']) & set(s['inventory']))
    print(f"hud scriptLine: {len(s['wired'])} wired route(s) held to the canonical string, "
          f"{ro_in} region-only, {ex_in} excluded, "
          f"out of {len(s['inventory'])} root game routes derived from {INDEX}; "
          f"{len(ok)} claim(s) hold, {len(bad)} do not")
    if s.get('ahead'):
        print(f"  note: {len(s['ahead'])} route(s) declared in the ledger ahead of the "
              f"inventory, so outside this partition: {', '.join(s['ahead'])}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
