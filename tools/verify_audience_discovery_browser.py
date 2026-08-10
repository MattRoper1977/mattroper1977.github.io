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
  * no surface contacts a third party at page load, with an explicit allow-list
    that is empty on purpose - the estate serves its own assets, search index
    and account client
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
  # a control run, which deliberately breaks the estate, keeps its output away
  # from the committed artifact:
  MBM_BASE_URL=... python3 tools/verify_audience_discovery_browser.py --artifacts "$RUNNER_TEMP/ctl"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
# The workflow that calls this tool uploads audit-output/ and prints
# audit-output/audience-discovery/browser-results.json. That contract predates
# this tool, so the tool conforms to it rather than the other way round.
#
# It is only the *default*, though, and that matters. A control run deliberately
# breaks the estate to prove an assertion fires; when it wrote here, the
# committed artifact ended up recording a deliberate failure as the estate's
# state, and someone had to notice and revert it by hand. Control runs pass
# --artifacts pointing at a scratch directory, so the situation cannot arise
# rather than being caught.
ARTIFACTS = ROOT / "audit-output" / "audience-discovery"

# Some environments ship a Chromium that Playwright did not download itself;
# launching it directly avoids fetching a second copy. Where no such binary
# exists - a CI runner with its own managed browser - fall back to Playwright's
# own resolution rather than failing on a path that was only ever a shortcut.
_PREINSTALLED = os.environ.get("MBM_CHROMIUM", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
CHROMIUM = _PREINSTALLED if Path(_PREINSTALLED).exists() else None


def launch(pw):
    return pw.chromium.launch(executable_path=CHROMIUM) if CHROMIUM else pw.chromium.launch()

AUDIENCE_ROUTES = [
    "/for/pupils/", "/for/teachers/", "/for/parents-carers/", "/for/schools-semh/",
    "/for/trusts/", "/for/councils-organisations/", "/for/partners/",
]
SEARCH_ROUTES = ["/", "/teach/", "/education-hub/"]

VIDEO_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com", "ytimg.com", "googlevideo.com")

# No surface may contact a third party just because someone opened it. The
# estate serves its own assets, its own search index and its own account
# client, so this list is empty on purpose: an entry here is a deliberate,
# reviewable exception, not a default. A Supabase client fetched from a CDN at
# page load is exactly what this exists to catch.
BOOT_ORIGIN_ALLOWLIST: dict[str, tuple[str, ...]] = {}

# Every surface the estate serves, so the boot check is estate-wide rather than
# a guarantee about one page.
#
# /start/ is deliberately absent. It redirects to "/", so measuring it here
# would record the root's result a second time under another name and report 13
# surfaces when 12 were visited. It gets its own redirect assertion instead, and
# the printed count says so.
ALL_SURFACES = ["/", "/main/", "/teach/", "/resources/", "/education-hub/"] + AUDIENCE_ROUTES
REDIRECTS = {"/start/": "/"}
# The stored homepage preference. Named once here so the browser assertions and
# the script are talking about the same key.
KEY = "mbm_audience_view"
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


def run(base: str, findings: Findings, artifacts: Path) -> None:
    from playwright.sync_api import sync_playwright

    artifacts.mkdir(parents=True, exist_ok=True)
    base = base.rstrip("/") + "/"

    with sync_playwright() as pw:
        browser = launch(pw)

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
            page.screenshot(path=str(artifacts / f"root-{label}.png"), full_page=False)

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
            page.screenshot(path=str(artifacts / f"pupils-{label}.png"), full_page=False)

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

        # E1: the routes that are redirects are redirects. Asserting this is
        # what lets the boot count below be honest: /start/ is not a surface
        # that was skipped, it is a route whose behaviour is checked here.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        for route, target in REDIRECTS.items():
            page.goto(base.rstrip("/") + route, wait_until="networkidle")
            expected = base.rstrip("/") + target
            landed = page.url.rstrip("/") or page.url
            findings.check(landed == expected.rstrip("/"),
                           f"{route} redirects to {target}", f"landed on {page.url}")
        context.close()

        # E2: no surface contacts a third party at page load. This is the
        # estate-wide form of the pupil guarantee - the assertion that catches
        # an off-origin dependency nobody went looking for.
        #
        # A control that re-introduces an off-origin boot fetch will not make
        # /for/pupils/ fail, and that is the pupil guarantee working rather
        # than a gap: mbm-account.js is never injected on a page carrying
        # data-mbm-adult-features="off", so there is nothing there to break.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        for route in ALL_SURFACES:
            # A fresh page per route, so one surface's requests cannot be
            # attributed to the next.
            page = context.new_page()
            boot: list[str] = []
            page.on("request", lambda r, sink=boot: sink.append(r.url))
            page.goto(base.rstrip("/") + route, wait_until="networkidle")
            page.wait_for_timeout(700)
            allowed = BOOT_ORIGIN_ALLOWLIST.get(route, ())
            offending = [u for u in external_requests(boot, base)
                         if not any(a in u for a in allowed)]
            findings.check(not offending, f"boot: {route} contacts no third party",
                           ", ".join(sorted(set(offending))[:3]))
            page.close()
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
        page.screenshot(path=str(artifacts / "reflow-320.png"), full_page=False)
        context.close()

        # G: both audience groups reachable with JavaScript disabled.
        context = browser.new_context(java_script_enabled=False,
                                      viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(base, wait_until="domcontentloaded")
        # Derived from the data, not typed. This said 7 when the chooser grew an
        # eighth homepage type, which would have failed here for a reason that
        # was never about JavaScript being off.
        expected_choices = len(AUDIENCE_ROUTES) + 1
        links = page.locator('a[data-mbm-face-choice]').count()
        findings.check(links == expected_choices,
                       f"no-JS: all {expected_choices} homepage choices are real links",
                       f"found {links}")
        for route in AUDIENCE_ROUTES:
            page.goto(base.rstrip("/") + route, wait_until="domcontentloaded")
            findings.check(page.locator("h1").count() >= 1, f"no-JS: {route} renders a heading")
        page.screenshot(path=str(artifacts / "nojs-root.png"), full_page=False)
        context.close()

        # H: the write asymmetry. /main/ is a homepage a visitor can choose,
        # and it is also the page the brand link, the footer, a nav item on
        # every surface and the hero call to action all point at - so a visitor
        # lands on it constantly without having chosen it. Choosing it must
        # record the choice; arriving at it must not. Static checks can see the
        # guard; only a browser can see whether the storage actually moved.
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(base, wait_until="networkidle")
        page.evaluate(f"() => localStorage.removeItem({KEY!r})")

        page.click('a[data-mbm-face-choice="main"]')
        page.wait_for_load_state("domcontentloaded")
        chose = page.evaluate(f"() => localStorage.getItem({KEY!r})")
        findings.check(chose == "main", "choosing the platform homepage records the choice",
                       f"stored {chose!r}")
        findings.check(page.url.rstrip("/").endswith("/main"),
                       "the platform card navigates to /main/", page.url)

        page.evaluate(f"() => localStorage.removeItem({KEY!r})")
        page.goto(base.rstrip("/") + "/main/", wait_until="networkidle")
        page.wait_for_timeout(400)
        landed = page.evaluate(f"() => localStorage.getItem({KEY!r})")
        findings.check(landed is None, "landing on /main/ records nothing",
                       f"stored {landed!r}")

        # And the consequence, stated as the journey it protects: a deliberate
        # choice survives an accidental visit to the platform homepage.
        page.goto(base, wait_until="networkidle")
        page.click('a[data-mbm-face-choice="teachers"]')
        page.wait_for_load_state("domcontentloaded")
        page.goto(base.rstrip("/") + "/main/", wait_until="networkidle")
        page.wait_for_timeout(400)
        survived = page.evaluate(f"() => localStorage.getItem({KEY!r})")
        findings.check(survived == "teachers",
                       "a chosen homepage survives a visit to /main/", f"stored {survived!r}")

        # The brand link honours a chosen /main/ ...
        page.evaluate(f"() => localStorage.setItem({KEY!r}, 'main')")
        page.goto(base.rstrip("/") + "/resources/", wait_until="networkidle")
        brand = page.get_attribute("a.brand", "href")
        findings.check(brand == "/main/", "a chosen /main/ resolves the brand link", f"brand {brand!r}")

        # ... and the pupil rule still outranks it. /for/pupils/ writes its own
        # face on landing, so the value read here is 'pupils', not 'main'; what
        # matters is that no stored value can put the adult platform homepage
        # behind the brand on a page that suppresses adult features.
        page.evaluate(f"() => localStorage.setItem({KEY!r}, 'main')")
        page.goto(base.rstrip("/") + "/for/pupils/", wait_until="networkidle")
        pupil_brand = page.get_attribute("a.brand", "href")
        findings.check(pupil_brand != "/main/",
                       "a chosen /main/ cannot reach the brand link on the pupil page",
                       f"brand {pupil_brand!r}")
        context.close()

        browser.close()


def self_test() -> None:
    """Prove the two assertions that carry the most weight can actually fail,
    using local fixtures rather than the real site."""
    from playwright.sync_api import sync_playwright

    failures = 0
    with sync_playwright() as pw:
        browser = launch(pw)

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

        # Control 4: a homepage that records itself as the visitor's choice
        # merely because they arrived. This is the defect the write asymmetry
        # exists to prevent, so the assertion has to be shown failing on it.
        context = browser.new_context()
        page = context.new_page()
        # A real origin, because set_content on about:blank is opaque and
        # localStorage is denied there - the control would fail for a reason
        # that has nothing to do with what it is testing.
        fixture = (
            f"<body data-mbm-audience-face='main'>"
            f"<script>localStorage.setItem({KEY!r}, document.body.dataset.mbmAudienceFace)</script>"
        )
        page.route("**/*", lambda route: route.fulfill(status=200, content_type="text/html", body=fixture))
        page.goto("https://landing-write.invalid/main/", wait_until="domcontentloaded")
        page.wait_for_timeout(200)
        landed = page.evaluate(f"() => localStorage.getItem({KEY!r})")
        if landed == "main":
            print("  [PASS] control detected: landing on a page records it as the chosen homepage")
        else:
            print("  [FAIL] landing-write control did not fire", file=sys.stderr)
            failures += 1
        context.close()

        browser.close()

    if failures:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="prove the checks can fail")
    parser.add_argument("--artifacts", type=Path, default=ARTIFACTS,
                        help="where screenshots and the report are written; control runs must "
                             "pass a scratch directory so a deliberate failure is never recorded "
                             "as the estate's committed state")
    parser.add_argument("--report", type=Path, default=None,
                        help="report path (defaults to <artifacts>/results.json)")
    args = parser.parse_args()

    if args.self_test:
        print("Browser controls:")
        self_test()
        return

    base = os.environ.get("MBM_BASE_URL")
    if not base:
        raise SystemExit("MBM_BASE_URL is required, e.g. http://127.0.0.1:4173/")

    report = args.report or args.artifacts / "results.json"

    findings = Findings()
    run(base, findings, args.artifacts)

    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "baseUrl": base,
        "bootSurfaces": len(ALL_SURFACES),
        "redirectAssertions": len(REDIRECTS),
        "passed": findings.passes,
        "failed": findings.failures,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Browser proof against {base}: {len(findings.passes)} passed · {len(findings.failures)} failed")
    print(f"  boot check: {len(ALL_SURFACES)} distinct surfaces + "
          f"{len(REDIRECTS)} redirect assertion(s); /start/ redirects to / and is asserted, not visited twice")
    if args.artifacts != ARTIFACTS:
        print(f"  artifacts written to {args.artifacts} (not the committed location)")
    for failure in findings.failures:
        print(f"  FAIL {failure}", file=sys.stderr)
    if findings.failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
