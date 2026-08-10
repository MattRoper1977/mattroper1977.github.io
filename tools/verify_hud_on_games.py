#!/usr/bin/env python3
"""Every site root-level game carries the HUD, and the HUD works where it landed.

The site's own games are 50-340 KB single-file documents with their own canvas,
their own pointer handling and their own full-screen splash overlays. Eighteen
of the nineteen carried no HUD at all, and the nineteenth carried the script
without the HUD ever rendering: /neonbreach/ has loaded /hud.js for months and
matched none of the four path patterns that resolve a back target, so mount()
had nothing to append. A missing back control is not an error anywhere, which
is why nothing said so.

So this asserts both halves, per game and from the inventory rather than a list
typed here:

  * the page carries the HUD script - exactly once, so a second insertion is a
    finding rather than a duplicate
  * the back control renders, and with a homepage chosen the home control does
    too
  * both are hit-testable ON TOP at the point a finger would land. This is the
    assertion that matters on these pages: nearly every one of them paints a
    full-screen splash or menu overlay over the corner the controls sit in, and
    a control underneath one is not a control
  * the two never overlap each other
  * clicking the home control leaves the game for the chosen homepage
  * the game reports no page errors with the HUD present

Off-origin requests are REPORTED, not asserted. The estate-wide boot check owns
that promise for the audience surfaces; claiming it here for pages this pass
only added a script to would be asserting coverage this tool did not earn.

Usage:
  MBM_BASE_URL=http://127.0.0.1:4173/ python3 tools/verify_hud_on_games.py
  python3 tools/verify_hud_on_games.py --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_audience_homepages import root_game_routes  # noqa: E402
from verify_hud_homepage import (  # noqa: E402
    MIN_CONTROL, launch, overlap, preference_key, homepage_choices, Findings,
)

VIEWPORTS = ((320, 640, "320"), (768, 1024, "768"), (1440, 900, "1440"))
HUD_TAG = re.compile(r'<script\b[^>]*\bsrc="/hud\.js"[^>]*>')
# The choice the click test uses. Deliberately not a route the back control
# would reach anyway, so a click that fell through to the game's own navigation
# cannot be mistaken for a pass.
CLICK_CHOICE = "teachers"

# Is the element at the middle of a control that control? Anything else means
# something is painted over it - the exact failure a splash overlay would cause
# - and a control that cannot be hit is not a control.
ON_TOP_JS = """(id) => {
  const e = document.getElementById(id);
  if (!e) return "MISSING";
  const b = e.getBoundingClientRect();
  const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
  if (!t) return "NOTHING AT THAT POINT";
  if (t === e || e.contains(t)) return "ON TOP";
  return "COVERED by " + t.tagName.toLowerCase() + (t.id ? "#" + t.id : "");
}"""

BOXES_JS = """() => {
  const r = id => { const e = document.getElementById(id); if (!e) return null;
    const b = e.getBoundingClientRect();
    return {x: b.x, y: b.y, width: b.width, height: b.height}; };
  return {home: r("mbmhud-home"), back: r("mbmhud-back")};
}"""


COVERAGE = ROOT / "data" / "hud-coverage.json"


def excluded_routes() -> dict[str, dict]:
    """Games declared unable to carry the HUD, and why.

    A declared input, not a silent gap. Eight of the nineteen ship under a
    contract their own verifier enforces - a single self-contained file with no
    external script - and admitting the HUD to one of those is a considered
    amendment to that game's promise, not a mechanical edit. The alternative to
    declaring them is a coverage figure that quietly means "the ones it worked
    on", which is the shape of a check that reports success while doing less
    than it claims.
    """
    data = json.loads(COVERAGE.read_text(encoding="utf-8"))
    return {entry["route"]: entry for entry in data["excluded"]}


def classify(route: str, has_tag: bool, excluded: dict[str, dict]) -> str | None:
    """The one rule, in one place so a control can run the same code the gate does.

    Every inventory game is wired or declared, and nothing in between. Written
    as a pure function because the interesting case - a game that is neither -
    cannot be produced by editing the tree without stranding a real game.
    """
    if route in excluded:
        if has_tag:
            return f"{route} is declared unable to carry the HUD but carries the script"
        return None
    if not has_tag:
        return f"{route} carries no HUD script and is not declared in data/hud-coverage.json"
    return None


def wired_games() -> tuple[list[str], list[str]]:
    """Inventory routes that carry the HUD script, and those that do not."""
    wired, bare = [], []
    for route in root_game_routes():
        page = ROOT / route.strip("/") / "index.html"
        if not page.is_file():
            bare.append(route)
            continue
        (wired if HUD_TAG.search(page.read_text(encoding="utf-8", errors="replace")) else bare).append(route)
    return wired, bare


def run(base: str, findings: Findings, notes: list[str]) -> None:
    from playwright.sync_api import Error as PWError
    from playwright.sync_api import sync_playwright

    origin = base.rstrip("/")
    key = preference_key()
    route_of = {aid: entry["route"] for aid, entry in homepage_choices().items()}
    excluded = excluded_routes()
    routes = [route for route in root_game_routes() if route not in excluded]

    # Static half first: it needs no browser, and a game that does not carry
    # the script cannot be measured for what the script does.
    #
    # Every inventory game is one of two things and nothing else: wired, or
    # declared with the verifier and the gates that stopped it. A game that is
    # neither is a finding - that is what stops the coverage figure quietly
    # becoming "the ones it worked on".
    for route in root_game_routes():
        page_file = ROOT / route.strip("/") / "index.html"
        if not page_file.is_file():
            findings.check(False, f"{route}: the inventory names a page that does not exist")
            continue
        tags = HUD_TAG.findall(page_file.read_text(encoding="utf-8", errors="replace"))
        problem = classify(route, bool(tags), excluded)
        findings.check(problem is None, f"{route}: is wired or declared, not neither", problem or "")
        if route in excluded:
            entry = excluded[route]
            findings.check((ROOT / entry["verifier"]).is_file(),
                           f"{route}: the verifier its exclusion cites still exists",
                           entry["verifier"])
            findings.check(bool(entry.get("gates")),
                           f"{route}: the exclusion names the gates that stopped it")
        else:
            findings.check(len(tags) == 1, f"{route}: carries the HUD script exactly once",
                           f"found {len(tags)}")

    with sync_playwright() as pw:
        browser = launch(pw)
        for width, height, vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)[:120]))
            off_origin: list[str] = []
            page.on("request", lambda r: off_origin.append(r.url)
                    if not r.url.startswith(origin) and not r.url.startswith("data:") else None)

            for route in routes:
                errors.clear()
                try:
                    page.goto(origin + route, wait_until="domcontentloaded", timeout=30000)
                    page.evaluate(f"() => localStorage.setItem({key!r}, {CLICK_CHOICE!r})")
                    page.reload(wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(900)
                except PWError as exc:
                    findings.check(False, f"{vp}{route}: the game loads with the HUD present",
                                   str(exc)[:110])
                    continue

                for control in ("back", "home"):
                    element = f"mbmhud-{control}"
                    findings.check(page.locator("#" + element).count() == 1,
                                   f"{vp}{route}: the {control} control renders")
                    state = page.evaluate(ON_TOP_JS, element)
                    findings.check(state == "ON TOP",
                                   f"{vp}{route}: the {control} control is hit-testable", state)

                boxes = page.evaluate(BOXES_JS)
                area = overlap(boxes["home"], boxes["back"])
                findings.check(area == 0, f"{vp}{route}: the two controls do not overlap",
                               f"{area:.0f}px^2")
                if boxes["home"]:
                    findings.check(
                        boxes["home"]["width"] >= MIN_CONTROL and boxes["home"]["height"] >= MIN_CONTROL,
                        f"{vp}{route}: the home control has a real hit area",
                        f"{boxes['home']['width']:.0f}x{boxes['home']['height']:.0f}"
                    )
                findings.check(not errors, f"{vp}{route}: the game reports no page errors",
                               " | ".join(errors[:2]))

                # The click test runs at one viewport. Three navigations per
                # game would triple the wall clock to re-answer a question the
                # first one settles.
                if vp == "1440":
                    try:
                        page.click("#mbmhud-home", timeout=5000)
                        page.wait_for_load_state("domcontentloaded", timeout=15000)
                        landed = page.url[len(origin):].split("?", 1)[0]
                        findings.check(landed == route_of[CLICK_CHOICE],
                                       f"{route}: clicking home leaves the game for the chosen homepage",
                                       f"landed on {landed!r}")
                    except PWError as exc:
                        findings.check(False, f"{route}: the home control can be clicked", str(exc)[:110])

            if off_origin:
                notes.append(f"{vp}: {len(off_origin)} off-origin request(s) across the games, "
                             f"e.g. {sorted(set(off_origin))[:2]}")
            context.close()
        browser.close()


def self_test() -> int:
    """Prove the two assertions this tool exists for can fail.

    Both are about the page, not the checker: a control buried under an overlay,
    and a game with no HUD script. The first is the defect a splash screen would
    cause and the reason the check is elementFromPoint rather than "is it in the
    DOM"; the second is the state eighteen of these games were in.
    """
    from playwright.sync_api import sync_playwright

    failures = 0
    with sync_playwright() as pw:
        browser = launch(pw)
        context = browser.new_context(viewport={"width": 390, "height": 640})
        page = context.new_page()
        page.set_content(
            "<a id='mbmhud-back' style='position:fixed;left:8px;top:8px;width:34px;height:34px'>x</a>"
            "<div style='position:fixed;inset:0;z-index:2147483647;background:#000'>splash</div>"
        )
        state = page.evaluate(ON_TOP_JS, "mbmhud-back")
        if state.startswith("COVERED"):
            print(f"  [PASS] control detected: a splash overlay buries the control ({state})")
        else:
            print(f"  [FAIL] buried-control control did not fire: {state}", file=sys.stderr)
            failures += 1

        # And the same measurement must be able to say ON TOP, or the control
        # above would pass on a check that always reports COVERED.
        page.set_content(
            "<div style='position:fixed;inset:0;background:#000'>splash</div>"
            "<a id='mbmhud-back' style='position:fixed;left:8px;top:8px;width:34px;height:34px;"
            "z-index:2147483000'>x</a>"
        )
        state = page.evaluate(ON_TOP_JS, "mbmhud-back")
        if state == "ON TOP":
            print("  [PASS] negative control: a control above the overlay measures ON TOP")
        else:
            print(f"  [FAIL] the hit test cannot report ON TOP: {state}", file=sys.stderr)
            failures += 1
        context.close()
        browser.close()

    # Every inventory game is wired or declared. An undeclared bare game is the
    # failure this pairing exists to prevent, so it is proven rather than
    # asserted: take a wired game, pretend it is bare, and require a finding.
    excluded = excluded_routes()
    inventory = root_game_routes()
    undeclared = [route for route in inventory
                  if route not in excluded
                  and not HUD_TAG.search((ROOT / route.strip("/") / "index.html").read_text(
                      encoding="utf-8", errors="replace"))]
    if undeclared:
        print(f"  [FAIL] {len(undeclared)} inventory game(s) neither carry the script nor are "
              f"declared: {undeclared[:4]}", file=sys.stderr)
        failures += 1
    else:
        print(f"  [PASS] all {len(inventory)} inventory games are wired ({len(inventory) - len(excluded)}) "
              f"or declared ({len(excluded)}), with nothing in between")

    # The classification itself, run against a game that is bare and undeclared.
    # The first draft of this control compared a wired route against the
    # exclusion list and announced that it was not in it - which is true of
    # every wired route, before and after any change, and proves nothing about
    # whether a gap would be caught.
    verdict = classify("/a-bare-undeclared-game/", has_tag=False, excluded=excluded)
    if verdict is None:
        print("  [FAIL] a bare, undeclared game is classified as fine", file=sys.stderr)
        failures += 1
    else:
        print(f"  [PASS] control: a bare, undeclared game is reported ({verdict})")
    declared = next(iter(excluded))
    if classify(declared, has_tag=False, excluded=excluded) is not None:
        print(f"  [FAIL] a declared exclusion without the script is reported as a problem", file=sys.stderr)
        failures += 1
    else:
        print(f"  [PASS] negative control: a declared exclusion without the script is not a problem")
    if classify(declared, has_tag=True, excluded=excluded) is None:
        print("  [FAIL] a declared exclusion that gained the script is not reported", file=sys.stderr)
        failures += 1
    else:
        print("  [PASS] control: a declared exclusion that gained the script is reported")

    # And the exclusions have to be real files, or the declaration is a note
    # rather than a claim anything checks.
    missing = [entry["verifier"] for entry in excluded.values()
               if not (ROOT / entry["verifier"]).is_file()]
    if missing:
        print(f"  [FAIL] exclusions cite verifiers that do not exist: {missing}", file=sys.stderr)
        failures += 1
    else:
        print(f"  [PASS] all {len(excluded)} exclusions cite a verifier that exists")
    return failures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="prove the checks can fail")
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()

    if args.self_test:
        print("HUD-on-games controls:")
        raise SystemExit(1 if self_test() else 0)

    base = os.environ.get("MBM_BASE_URL")
    if not base:
        raise SystemExit("MBM_BASE_URL is required, e.g. http://127.0.0.1:4173/")

    findings = Findings()
    notes: list[str] = []
    run(base, findings, notes)

    routes = root_game_routes()
    print(f"HUD on games against {base}: {len(findings.passes)} passed · {len(findings.failures)} failed")
    print(f"  {len(routes)} root-level game(s) x {len(VIEWPORTS)} viewport(s), from the search index")
    for note in notes:
        print(f"  note: {note}")

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(
            {"baseUrl": base, "games": routes, "notes": notes,
             "passed": findings.passes, "failed": findings.failures}, indent=2), encoding="utf-8")

    if findings.failures:
        print("\nFailures:", file=sys.stderr)
        for failure in findings.failures:
            print(f"  - {failure}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
