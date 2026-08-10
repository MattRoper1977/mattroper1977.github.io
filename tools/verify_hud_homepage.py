#!/usr/bin/env python3
"""Drive the HUD's chosen-homepage control in a real browser.

`hud.js` is the one script the estate serves onto pages it does not otherwise
control: games, apps, registers and lessons, several of them 60-340 KB
single-file documents with their own canvas, their own pointer handling and
their own corner furniture. So every claim about the new control is about
behaviour on a page like that, and none of it can be read out of the markup.

What is asserted, each of it by observing the page rather than the source:

  * with a homepage chosen, the control renders and points at that homepage
  * with nothing chosen, it does not render at all - the back control is the
    exit, and a home button aimed at the adult platform homepage one tap from a
    child's game is not a default worth having
  * its accessible name is the label from data/audience-homepages.json, for the
    audience that is actually stored - not a wording typed into the script
  * a stored 'pupils' resolves to /for/pupils/ and never to /main/
  * it never overlaps the back control, at 320, 768 and 1440 px, in both of the
    HUD's layouts - measured as intersecting rectangles, not judged by eye
  * loading it sends nothing off-origin

The fixtures are minimal pages served at the paths that decide hud.js's layout,
because the layout branch is the thing under test and the real pages that will
carry each branch arrive in a later stage. `/hud.js` itself is never faked: the
fixture loads the committed file from the local origin.

Usage:
  MBM_BASE_URL=http://127.0.0.1:4173/ python3 tools/verify_hud_homepage.py
  python3 tools/verify_hud_homepage.py --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "audience-homepages.json"
HUD = ROOT / "hud.js"

_PREINSTALLED = os.environ.get("MBM_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
CHROMIUM = _PREINSTALLED if Path(_PREINSTALLED).exists() else None

VIEWPORTS = ((320, 640, "320"), (768, 1024, "768"), (1440, 900, "1440"))
# A control smaller than this is not a control. It also stops the overlap
# assertion passing for the wrong reason: a box with no area cannot intersect
# anything, so "they do not overlap" would be true of a control that vanished.
MIN_CONTROL = 24

# One fixture per hud.js layout branch. The path is the whole point: hud.js
# decides everything from location.pathname, so a fixture at /Games/ is the
# game layout and a fixture at /Lessons/ is the lesson layout.
LAYOUTS = [
    ("game", "/Games/fixture-hud.html"),
    ("app", "/Matt-s-Apps-/fixture-hud.html"),
    ("register", "/uas/app.html"),
    ("lesson", "/Lessons/fixture-hud.html"),
]

FIXTURE = (
    "<!doctype html><html lang='en-GB'><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>HUD fixture</title></head><body><h1>HUD fixture</h1>"
    "<script defer src='/hud.js'></script></body></html>"
)


def launch(pw):
    return pw.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else pw.chromium.launch()


def homepage_choices() -> dict[str, dict[str, str]]:
    """The eight homepage types, from the file that owns them.

    Read here rather than parsed out of hud.js. The point of the assertion is
    that the script agrees with the data; reading the script would only prove
    the script agrees with itself.
    """
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    choices = {aid: {"route": a["route"], "label": a["label"]} for aid, a in data["audiences"].items()}
    main = data["mainOption"]
    choices[main["id"]] = {"route": main["route"], "label": main["label"]}
    return choices


def preference_key() -> str:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))["preferenceKey"]


class Findings:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passes: list[str] = []

    def check(self, ok: bool, label: str, detail: str = "") -> None:
        if ok:
            self.passes.append(label)
        else:
            self.failures.append(f"{label}{': ' + detail if detail else ''}")


def overlap(a: dict, b: dict) -> float:
    """Intersecting area of two DOMRects, in square pixels."""
    if not a or not b:
        return 0.0
    wide = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
    high = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
    return max(0.0, wide) * max(0.0, high)


def serve_fixtures(page, base: str) -> None:
    """Answer fixture paths with the fixture; let everything else through.

    /hud.js is deliberately NOT intercepted - the committed file is what is
    under test.
    """
    fixture_paths = {path for _, path in LAYOUTS}

    def handler(route):
        url = route.request.url
        path = url[len(base.rstrip("/")):].split("?", 1)[0] if url.startswith(base.rstrip("/")) else ""
        if path in fixture_paths:
            route.fulfill(status=200, content_type="text/html; charset=utf-8", body=FIXTURE)
        else:
            route.continue_()

    page.route("**/*", handler)


def run(base: str, findings: Findings) -> None:
    from playwright.sync_api import sync_playwright

    base = base.rstrip("/") + "/"
    origin = base.rstrip("/")
    key = preference_key()
    choices = homepage_choices()

    with sync_playwright() as pw:
        browser = launch(pw)

        for width, height, vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            serve_fixtures(page, base)
            seen: list[str] = []
            page.on("request", lambda r: seen.append(r.url))

            for layout, path in LAYOUTS:
                url = origin + path

                # A: nothing chosen -> nothing rendered.
                page.goto(url, wait_until="domcontentloaded")
                page.evaluate(f"() => localStorage.removeItem({key!r})")
                page.reload(wait_until="domcontentloaded")
                page.wait_for_timeout(120)
                findings.check(page.locator("#mbmhud-home").count() == 0,
                               f"{vp}/{layout}: no homepage chosen, no home control")
                findings.check(page.locator("#mbmhud-back").count() == 1,
                               f"{vp}/{layout}: the back control is untouched by any of this")

                # B: each choice renders, points at its own route, and is named
                # with its own label.
                for aid, entry in choices.items():
                    page.evaluate(f"() => localStorage.setItem({key!r}, {aid!r})")
                    page.reload(wait_until="domcontentloaded")
                    page.wait_for_timeout(80)
                    control = page.locator("#mbmhud-home")
                    if control.count() != 1:
                        findings.check(False, f"{vp}/{layout}/{aid}: home control did not render",
                                       f"count {control.count()}")
                        continue
                    href = control.get_attribute("href")
                    name = control.get_attribute("aria-label") or ""
                    findings.check(href == entry["route"],
                                   f"{vp}/{layout}/{aid}: home control points at the chosen homepage",
                                   f"href {href!r}, expected {entry['route']!r}")
                    findings.check(entry["label"] in name,
                                   f"{vp}/{layout}/{aid}: accessible name carries the declared label",
                                   f"name {name!r} does not contain {entry['label']!r}")
                    if aid == "pupils":
                        findings.check(href != "/main/",
                                       f"{vp}/{layout}: a stored pupil choice never resolves to /main/",
                                       f"href {href!r}")

                    # C: the two controls never overlap. Measured as area, so a
                    # one-pixel clip is a failure and not a rounding opinion.
                    boxes = page.evaluate(
                        "() => { const r = id => { const e = document.getElementById(id);"
                        " if (!e) return null; const b = e.getBoundingClientRect();"
                        " return {x:b.x,y:b.y,width:b.width,height:b.height}; };"
                        " return {home:r('mbmhud-home'), back:r('mbmhud-back'), pill:r('mbmhud-pill')}; }"
                    )
                    area = overlap(boxes["home"], boxes["back"])
                    findings.check(area == 0, f"{vp}/{layout}/{aid}: home and back controls do not overlap",
                                   f"{area:.0f}px^2 (home {boxes['home']}, back {boxes['back']})")
                    if boxes.get("pill"):
                        pill_area = overlap(boxes["home"], boxes["pill"])
                        findings.check(pill_area == 0,
                                       f"{vp}/{layout}/{aid}: home control does not overlap the TEACH pill",
                                       f"{pill_area:.0f}px^2")
                    # And it has to be on screen, and big enough to be a
                    # control at all. Without the size floor the overlap
                    # assertion above would pass on a control collapsed to
                    # nothing, which is the shape of a vacuous check: two
                    # rectangles cannot intersect if one of them has no area.
                    box = boxes["home"]
                    findings.check(
                        box["x"] >= 0 and box["y"] >= 0
                        and box["x"] + box["width"] <= width + 1
                        and box["y"] + box["height"] <= height + 1,
                        f"{vp}/{layout}/{aid}: home control is inside the viewport", json.dumps(box)
                    )
                    findings.check(box["width"] >= MIN_CONTROL and box["height"] >= MIN_CONTROL,
                                   f"{vp}/{layout}/{aid}: home control has a real hit area",
                                   f"{box['width']:.0f}x{box['height']:.0f}, floor {MIN_CONTROL}")

            # D: an href is a claim about where a control goes; a navigation is
            # evidence. Run once per layout at each viewport, on a choice whose
            # route is not the one the back control would reach anyway, so a
            # click landing on /games/ cannot be mistaken for a pass.
            for layout, path in LAYOUTS:
                page.goto(origin + path, wait_until="domcontentloaded")
                page.evaluate(f"() => localStorage.setItem({key!r}, 'teachers')")
                page.reload(wait_until="domcontentloaded")
                page.wait_for_timeout(80)
                if page.locator("#mbmhud-home").count() != 1:
                    findings.check(False, f"{vp}/{layout}: home control present to click")
                    continue
                page.click("#mbmhud-home")
                page.wait_for_load_state("domcontentloaded")
                landed = page.url[len(origin):].split("?", 1)[0]
                findings.check(landed == choices["teachers"]["route"],
                               f"{vp}/{layout}: clicking the home control opens the chosen homepage",
                               f"landed on {landed!r}")

            off_origin = [u for u in seen if not u.startswith(origin) and not u.startswith("data:")]
            findings.check(not off_origin, f"{vp}: the HUD loads nothing off-origin",
                           ", ".join(sorted(set(off_origin))[:3]))
            context.close()

        browser.close()


def self_test() -> int:
    """Prove the two assertions that carry the weight can actually fail.

    Both controls break the page rather than the measurement: a home control
    placed on top of the back control, and a home control that renders with no
    preference stored. A control that mutated the checker instead would prove
    only that the checker can be told to fail.
    """
    from playwright.sync_api import sync_playwright

    failures = 0
    with sync_playwright() as pw:
        browser = launch(pw)

        context = browser.new_context(viewport={"width": 320, "height": 640})
        page = context.new_page()
        page.set_content(
            "<a id='mbmhud-back' style='position:fixed;left:10px;bottom:10px;padding:6px 13px'>back</a>"
            "<a id='mbmhud-home' style='position:fixed;left:10px;bottom:10px;padding:6px 13px'>home</a>"
        )
        boxes = page.evaluate(
            "() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect();"
            " return {x:b.x,y:b.y,width:b.width,height:b.height}; };"
            " return {home:r('mbmhud-home'), back:r('mbmhud-back')}; }"
        )
        area = overlap(boxes["home"], boxes["back"])
        if area > 0:
            print(f"  [PASS] control detected: stacked controls overlap ({area:.0f}px^2)")
        else:
            print("  [FAIL] overlap control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        # The overlap measurement must also be capable of returning zero, or the
        # control above would pass on a check that always reports overlap.
        context = browser.new_context(viewport={"width": 320, "height": 640})
        page = context.new_page()
        page.set_content(
            "<a id='mbmhud-back' style='position:fixed;left:10px;bottom:10px;padding:6px 13px'>back</a>"
            "<a id='mbmhud-home' style='position:fixed;left:10px;bottom:60px;padding:6px 13px'>home</a>"
        )
        boxes = page.evaluate(
            "() => { const r = id => { const b = document.getElementById(id).getBoundingClientRect();"
            " return {x:b.x,y:b.y,width:b.width,height:b.height}; };"
            " return {home:r('mbmhud-home'), back:r('mbmhud-back')}; }"
        )
        if overlap(boxes["home"], boxes["back"]) == 0:
            print("  [PASS] negative control: separated controls measure zero overlap")
        else:
            print("  [FAIL] the overlap measurement reports overlap for separated boxes", file=sys.stderr)
            failures += 1
        context.close()

        # A HUD that renders the home control with nothing stored.
        context = browser.new_context()
        page = context.new_page()
        page.route("**/*", lambda route: route.fulfill(
            status=200, content_type="text/html; charset=utf-8",
            body="<body><script>var a=document.createElement('a');a.id='mbmhud-home';"
                 "a.href='/main/';document.body.appendChild(a);</script></body>"))
        page.goto("https://hud-control.invalid/Games/x.html", wait_until="domcontentloaded")
        page.wait_for_timeout(120)
        if page.locator("#mbmhud-home").count() == 1:
            print("  [PASS] control detected: a home control rendered with no preference stored")
        else:
            print("  [FAIL] unconditional-render control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        browser.close()

    return failures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="prove the checks can fail")
    parser.add_argument("--report", type=Path, default=None, help="write a JSON report here")
    args = parser.parse_args()

    if args.self_test:
        print("HUD homepage-control controls:")
        raise SystemExit(1 if self_test() else 0)

    base = os.environ.get("MBM_BASE_URL")
    if not base:
        raise SystemExit("MBM_BASE_URL is required, e.g. http://127.0.0.1:4173/")

    findings = Findings()
    run(base, findings)

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(
            {"baseUrl": base, "passed": findings.passes, "failed": findings.failures}, indent=2
        ), encoding="utf-8")

    print(f"HUD homepage control against {base}: {len(findings.passes)} passed · {len(findings.failures)} failed")
    print(f"  {len(LAYOUTS)} hud.js layout(s) x {len(VIEWPORTS)} viewport(s) x "
          f"{len(homepage_choices())} homepage type(s)")
    if findings.failures:
        print("\nFailures:", file=sys.stderr)
        for failure in findings.failures:
            print(f"  - {failure}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
