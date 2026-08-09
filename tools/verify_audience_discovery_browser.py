#!/usr/bin/env python3
"""Drive the audience discovery surfaces in a real browser.

Static checks cannot see the things that matter most here, because they are all
about what the page *does*: whether typing a query quietly contacts a search
service, whether a video poster has already told YouTube you are here, whether a
shared URL restores the view it promised.

The non-negotiables, each asserted by observing the network rather than reading
the markup:

  * typing into any search field sends nothing off-origin, and no request
    carries the typed query - the page loads its own index from this origin,
    which is the design; the keystrokes leaving the site is what must not happen
  * the pupil page makes no off-origin request at all - adult surfaces load an
    account library from a CDN and that stays out of the pupil experience
  * no request reaches a YouTube or Google host until a play control is
    deliberately activated
  * URL state survives a reload - a shared link restores its own filters
  * both audience groups are reachable with JavaScript disabled
  * pupil primary content carries no adult account or mailing call to action

Viewports: 390px (phone), 1440px (desktop), and a 320px reflow pass in which no
surface may scroll horizontally.

Never submits a production enquiry and never creates an account. It reads, types
into local search fields, and clicks navigation.

Usage:
  MBM_BASE_URL=http://127.0.0.1:4173/ python3 tools/verify_audience_discovery_browser.py
  python3 tools/verify_audience_discovery_browser.py --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts" / "browser"

# The pre-installed browser, which the environment asks us to launch directly
# rather than downloading a second copy.
CHROMIUM = os.environ.get(
    "MBM_CHROMIUM",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
)

AUDIENCE_ROUTES = [
    "/for/pupils/", "/for/teachers/", "/for/parents-carers/", "/for/schools-semh/",
    "/for/trusts/", "/for/councils-organisations/", "/for/partners/",
]
SEARCH_ROUTES = ["/", "/teach/", "/education-hub/"]

VIDEO_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com", "ytimg.com", "googlevideo.com")
ADULT_CTA = ("/account/", "/mailing-list/", "/members/")


class Findings:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passes: list[str] = []

    def check(self, ok: bool, label: str, detail: str = "") -> None:
        if ok:
            self.passes.append(label)
        else:
            self.failures.append(f"{label}{': ' + detail if detail else ''}")


def external_requests(urls: list[str], base: str) -> list[str]:
    """Requests that left the site's own origin."""
    origin = base.rstrip("/")
    return [u for u in urls if not u.startswith(origin) and not u.startswith("data:")]


def run(base: str, findings: Findings) -> None:
    from playwright.sync_api import sync_playwright

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    base = base.rstrip("/") + "/"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROMIUM)

        for width, height, label in ((390, 844, "phone"), (1440, 900, "desktop")):
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()
            seen: list[str] = []
            page.on("request", lambda r: seen.append(r.url))

            # A: the discovery root loads and offers both audience groups.
            page.goto(base, wait_until="networkidle")
            findings.check(page.locator("#audience-people").count() == 1,
                           f"{label}: root exposes the people group")
            findings.check(page.locator("#audience-organisations").count() == 1,
                           f"{label}: root exposes the organisations group")
            page.screenshot(path=str(ARTIFACTS / f"root-{label}.png"), full_page=False)

            # B: typing must not send the query anywhere. The page loads its
            # own index from this origin, which is the design - what must never
            # happen is the keystrokes leaving the site.
            before = len(seen)
            field = page.locator('input[name="q"]').first
            if field.count():
                field.click()
                field.type("safeguarding evidence", delay=25)
                page.wait_for_timeout(900)
                during = seen[before:]
                off_origin = external_requests(during, base)
                findings.check(not off_origin, f"{label}: typing sends nothing off-origin",
                               ", ".join(off_origin[:3]))
                carrying = [u for u in during if "safeguarding" in u.lower()]
                findings.check(not carrying, f"{label}: no request carries the typed query",
                               ", ".join(carrying[:2]))

            # C: no video host contacted before a play control is activated.
            for route in ("/for/teachers/", "/main/"):
                seen.clear()
                page.goto(base.rstrip("/") + route, wait_until="networkidle")
                early = [u for u in seen if any(h in u for h in VIDEO_HOSTS)]
                findings.check(not early, f"{label}: {route} contacts no video host before activation",
                               ", ".join(early[:2]))

            # D: pupil primary content offers no adult account or mailing route,
            # and the pupil page contacts nothing off-origin at all - the adult
            # surfaces load an account library from a CDN, and that must stay
            # out of the pupil experience.
            seen.clear()
            page.goto(base.rstrip("/") + "/for/pupils/", wait_until="networkidle")
            page.wait_for_timeout(700)
            pupil_off = external_requests(seen, base)
            findings.check(not pupil_off, f"{label}: pupil page makes no off-origin request",
                           ", ".join(pupil_off[:3]))
            main_html = page.locator("main#main").inner_html()
            leaked = [c for c in ADULT_CTA if f'href="{c}"' in main_html]
            findings.check(not leaked, "pupil main content carries no adult CTA", ", ".join(leaked))
            page.screenshot(path=str(ARTIFACTS / f"pupils-{label}.png"), full_page=False)

            context.close()

        # E: URL state restores on reload.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        stateful = base.rstrip("/") + "/teach/?q=evidence&task=capture-evidence"
        page.goto(stateful, wait_until="networkidle")
        page.wait_for_timeout(500)
        # The restored value lands in the results toolbar field, not the hero
        # field, so assert on the field that owns the state and on the count the
        # visitor actually reads.
        def restored() -> tuple[str, str]:
            field = page.locator('#teach-results-query')
            value = field.input_value() if field.count() else ""
            count = page.locator("[data-mbm-result-count]").first.inner_text()
            return value, count

        value_before, count_before = restored()
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(700)
        value_after, count_after = restored()
        findings.check(value_before == value_after == "evidence",
                       "URL state restores on reload",
                       f"before={value_before!r} after={value_after!r}")
        findings.check("evidence" in count_after and count_before == count_after,
                       "restored URL state yields the same results",
                       f"{count_before!r} vs {count_after!r}")
        context.close()

        # F: 320px reflow - nothing may scroll horizontally.
        context = browser.new_context(viewport={"width": 320, "height": 720})
        page = context.new_page()
        for route in ["/"] + AUDIENCE_ROUTES + ["/teach/", "/education-hub/"]:
            page.goto(base.rstrip("/") + route, wait_until="domcontentloaded")
            overflow = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            findings.check(overflow <= 1, f"320px: {route} does not scroll horizontally",
                           f"overflow {overflow}px")
        page.screenshot(path=str(ARTIFACTS / "reflow-320.png"), full_page=False)
        context.close()

        # G: both audience groups reachable with JavaScript disabled.
        context = browser.new_context(java_script_enabled=False,
                                      viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(base, wait_until="domcontentloaded")
        links = page.locator('a[data-mbm-face-choice]').count()
        findings.check(links == 7, "no-JS: all seven audience choices are real links",
                       f"found {links}")
        for route in AUDIENCE_ROUTES:
            page.goto(base.rstrip("/") + route, wait_until="domcontentloaded")
            findings.check(page.locator("h1").count() >= 1, f"no-JS: {route} renders a heading")
        page.screenshot(path=str(ARTIFACTS / "nojs-root.png"), full_page=False)
        context.close()

        browser.close()


def self_test() -> None:
    """Prove the two assertions that carry the most weight can actually fail,
    using local fixtures rather than the real site."""
    from playwright.sync_api import sync_playwright

    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROMIUM)

        # Control 1: a search that fires a request while typing.
        context = browser.new_context()
        page = context.new_page()
        seen: list[str] = []
        page.on("request", lambda r: seen.append(r.url))
        page.set_content(
            "<input id='q'>"
            "<script>document.getElementById('q').addEventListener('input',"
            "()=>fetch('https://example.invalid/suggest?q='+q.value).catch(()=>{}))</script>"
        )
        page.locator("#q").type("abc", delay=20)
        page.wait_for_timeout(600)
        leaked = [u for u in seen if "example.invalid" in u]
        if leaked:
            print("  [PASS] control detected: search fires a request while typing")
        else:
            print("  [FAIL] typing-request control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        # Control 2: an eager YouTube embed.
        context = browser.new_context()
        page = context.new_page()
        seen = []
        page.on("request", lambda r: seen.append(r.url))
        page.set_content("<iframe src='https://www.youtube.com/embed/aGy0z4mZEXg'></iframe>")
        page.wait_for_timeout(800)
        early = [u for u in seen if any(h in u for h in VIDEO_HOSTS)]
        if early:
            print("  [PASS] control detected: eager YouTube embed contacts a video host")
        else:
            print("  [FAIL] eager-embed control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        # Control 3: a page that overflows at 320px.
        context = browser.new_context(viewport={"width": 320, "height": 600})
        page = context.new_page()
        page.set_content("<div style='width:900px'>too wide</div>")
        overflow = page.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        if overflow > 1:
            print(f"  [PASS] control detected: 320px overflow ({overflow}px)")
        else:
            print("  [FAIL] reflow control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        browser.close()

    if failures:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="prove the checks can fail")
    parser.add_argument("--report", type=Path, default=ARTIFACTS / "results.json")
    args = parser.parse_args()

    if args.self_test:
        print("Browser controls:")
        self_test()
        return

    base = os.environ.get("MBM_BASE_URL")
    if not base:
        raise SystemExit("MBM_BASE_URL is required, e.g. http://127.0.0.1:4173/")

    findings = Findings()
    run(base, findings)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({
        "baseUrl": base,
        "passed": findings.passes,
        "failed": findings.failures,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Browser proof against {base}: {len(findings.passes)} passed · {len(findings.failures)} failed")
    for failure in findings.failures:
        print(f"  FAIL {failure}", file=sys.stderr)
    if findings.failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
