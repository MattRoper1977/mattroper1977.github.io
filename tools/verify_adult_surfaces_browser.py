#!/usr/bin/env python3
"""PA5: the adult-affordance boundary as a BROWSER sees it.

Why a browser leg exists, when verify_adult_surfaces.py already checks the
record, the marker and the mechanism.

The four adult affordances are in no page's source. assets/mbm-platform.js
creates them after load and appends them to the nav. A gate that reads HTML
therefore cannot see them - and this is not a hypothetical. data/audience-
homepages.json records Matt's ruling that the chooser carries "no /account/ or
/members/ route at all", and verify_games_audience_faces.py asserts it by
searching index.html for the href. index.html contains zero of them. The gate
passed. The rendered chooser carried an "Account" anchor stamped with
data-mbm-account-nav, injected by accountTargets(), for as long as that ruling
had existed. That defect is the reason for this file.

What it asserts, on the DOM after the platform script has run:

  * every page declared in data/adult-surfaces.json receives the affordances,
    so the declaration is not quietly inert
  * every page that is NOT declared receives none of them
  * the chooser carries no account or members route at all, which is the ruling
    the static gate cannot check

Both feature flags are forced ON by intercepting /site.json. Without that, a
stand-down of features.accounts.enabled would make this suite green for the
wrong reason: every page would show nothing and every assertion about the
declared pages would be vacuously true. This measures the BOUNDARY, not the
current state of the flags.

Usage:
  python3 tools/verify_adult_surfaces_browser.py                # self-served
  python3 tools/verify_adult_surfaces_browser.py --self-test
  MBM_BASE_URL=https://madebymatt.uk/ python3 tools/verify_adult_surfaces_browser.py
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import os
import socketserver
import threading
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RECORD = "data/adult-surfaces.json"
PLATFORM = "assets/mbm-platform.js"
SKIP_DIRS = {".git", "node_modules", "_staging", "audit-output", "next"}

# Read from the DOM after the platform script has run. Every affordance is
# identified by the attribute mbm-platform.js stamps on the element it creates,
# so a link a page carries in its OWN markup is not counted as an injected one.
# Conflating the two would make /privacy/, which holds a static Account link,
# look adult under any default at all.
#
# The value matters, not just the name. data-mbm-mailing-cta is TWO things in
# this estate: the stamp mbm-platform.js puts on the anchor it creates (="1"),
# and a suppression marker a page puts on its own <footer> (="off"), which
# reflectMailingFooter reads to refuse the injection. / and /for/pupils/ both
# carry the second one. Selecting on the attribute name alone counted a page's
# refusal to have the CTA as if it had received one, and this file reported two
# findings about pages that were behaving perfectly. Match the value.
PROBE = """(() => {
  const q = s => Array.prototype.slice.call(document.querySelectorAll(s));
  return {
    marker: document.body ? document.body.getAttribute('data-mbm-adult-features') : null,
    injectedAccount: q('[data-mbm-account-nav="1"]').length,
    injectedRegister: q('[data-mbm-register-nav="1"]').length,
    injectedMailingNav: q('[data-mbm-mailing-nav="1"]').length,
    injectedFooterCta: q('[data-mbm-mailing-cta="1"]').length,
    anyAccountHref: q('a[href="/account/"], a[href$="/account/"]').length,
    anyMembersHref: q('a[href="/members/"], a[href$="/members/"]').length
  };
})()"""


class Overriding(http.server.SimpleHTTPRequestHandler):
    """Static server that can serve one file from memory, for the controls."""

    overrides: dict[str, bytes] = {}

    def translate_path(self, path: str) -> str:  # noqa: D102
        return super().translate_path(path)

    def do_GET(self) -> None:  # noqa: N802
        rel = self.path.split("?")[0].lstrip("/")
        if rel in self.overrides:
            body = self.overrides[rel]
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript" if rel.endswith(".js") else "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args: Any) -> None:  # noqa: D102
        return


def platform_pages() -> list[str]:
    """Every index.html that loads the platform script.

    Derived rather than typed, so a page added tomorrow is covered without
    anybody remembering to extend a list here.
    """
    pages: list[str] = []
    for path in sorted(ROOT.rglob("index.html")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if "mbm-platform.js" in path.read_text(encoding="utf-8", errors="ignore"):
            pages.append(str(path.relative_to(ROOT)))
    return pages


def route_of(rel: str) -> str:
    return "/" + rel[: -len("index.html")]


def measure(overrides: dict[str, bytes] | None = None) -> tuple[list[str], int]:
    from playwright.sync_api import sync_playwright

    declared = {
        str(entry["page"])
        for entry in json.loads((ROOT / RECORD).read_text(encoding="utf-8"))["adultSurfaces"]
    }
    pages = platform_pages()
    failures: list[str] = []
    checks = 0

    def ok(cond: bool, label: str) -> None:
        nonlocal checks
        checks += 1
        if not cond:
            failures.append(label)

    external = os.environ.get("MBM_BASE_URL", "").strip()
    server = None
    if external:
        base = external.rstrip("/") + "/"
    else:
        handler = functools.partial(Overriding, directory=str(ROOT))
        Overriding.overrides = overrides or {}
        socketserver.TCPServer.allow_reuse_address = True
        server = socketserver.TCPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_address[1]}/"

    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    site["features"]["accounts"]["enabled"] = True
    site["features"]["mailing"]["enabled"] = True
    forced = json.dumps(site)

    try:
        with sync_playwright() as pw:
            # CI runs `playwright install chromium` and needs no override. A
            # sandbox with a prebuilt browser at a different revision can point
            # at it instead of downloading a second copy.
            binary = os.environ.get("MBM_CHROMIUM", "").strip()
            browser = pw.chromium.launch(executable_path=binary) if binary else pw.chromium.launch()
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            context.route(
                "**/site.json",
                lambda route: route.fulfill(status=200, content_type="application/json", body=forced),
            )
            page = context.new_page()
            for rel in pages:
                try:
                    page.goto(base.rstrip("/") + route_of(rel), wait_until="networkidle", timeout=25000)
                    page.wait_for_timeout(900)
                    dom = page.evaluate(PROBE)
                except Exception as err:  # noqa: BLE001 - a page that cannot be measured is a finding
                    ok(False, f"{rel}: could not be measured ({str(err)[:90]})")
                    continue
                injected = (dom["injectedAccount"] + dom["injectedRegister"]
                            + dom["injectedMailingNav"] + dom["injectedFooterCta"])
                if rel in declared:
                    ok(dom["marker"] == "on",
                       f"{rel}: declared adult but the body marker reads {dom['marker']!r}")
                    ok(dom["injectedAccount"] >= 1,
                       f"{rel}: declared adult but the platform injected no account link")
                    ok(dom["injectedMailingNav"] >= 1,
                       f"{rel}: declared adult but the platform injected no mailing link")
                else:
                    ok(dom["marker"] != "on",
                       f'{rel}: is not declared adult yet carries the "on" marker')
                    ok(injected == 0,
                       f"{rel}: is not declared adult but the platform injected {injected} "
                       f"affordance(s) (account {dom['injectedAccount']}, register "
                       f"{dom['injectedRegister']}, mailing {dom['injectedMailingNav']}, "
                       f"footer {dom['injectedFooterCta']})")

            page.goto(base, wait_until="networkidle", timeout=25000)
            page.wait_for_timeout(900)
            chooser = page.evaluate(PROBE)
            ok(chooser["anyAccountHref"] == 0,
               f"the chooser carries {chooser['anyAccountHref']} /account/ route(s) in the rendered "
               "DOM; data/audience-homepages.json rules that it carries none at all")
            ok(chooser["anyMembersHref"] == 0,
               f"the chooser carries {chooser['anyMembersHref']} /members/ route(s) in the rendered "
               "DOM; the same ruling covers members")

            # No-JS. Today this is true because the affordances are injected and
            # nothing injects without JavaScript - so it looks like an assertion
            # that cannot fail. It is worth making anyway: the cheapest way to
            # "fix" a missing link on an adult page is to inline it into the
            # markup, and that would put it on every page that shares the
            # template, silently, with the fail-closed default powerless to stop
            # it because there would be nothing left to gate. This is the check
            # that would notice.
            nojs = context.browser.new_context(
                viewport={"width": 1280, "height": 900}, java_script_enabled=False)
            nojs_page = nojs.new_page()
            for rel in pages:
                if rel in declared:
                    continue
                try:
                    nojs_page.goto(base.rstrip("/") + route_of(rel), wait_until="load", timeout=25000)
                    html = nojs_page.content()
                except Exception as err:  # noqa: BLE001
                    ok(False, f"{rel}: could not be measured with JavaScript disabled ({str(err)[:70]})")
                    continue
                stamped = html.count('data-mbm-account-nav="1"') + html.count('data-mbm-mailing-nav="1"')
                ok(stamped == 0,
                   f"{rel}: serves {stamped} pre-baked adult affordance(s) in its markup. With "
                   "JavaScript disabled nothing can be injected, so anything present here was "
                   "inlined, and the fail-closed default cannot reach it.")
            nojs.close()
            browser.close()
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()
    return failures, checks


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    failures, checks = measure()
    for item in failures:
        print("  -", item)
    print(f"{checks - len(failures)} passed · {len(failures)} failed")

    problems = 0
    if args.self_test:
        if os.environ.get("MBM_BASE_URL", "").strip():
            print("[SKIP] controls need the local server; they cannot patch a deployed origin")
        else:
            # The one control that matters: revert the default and prove this
            # suite goes red on pages every static check still calls clean.
            source = (ROOT / PLATFORM).read_text(encoding="utf-8")
            reverted = source.replace("==='on'", "!=='off'", 1)
            if reverted == source:
                print("[FAIL] control fixture could not be created")
                problems += 1
            else:
                broke, _ = measure({PLATFORM: reverted.encode("utf-8")})
                if any("is not declared adult but the platform injected" in f for f in broke):
                    print("[PASS] positive control: the fail-open default is caught on an undeclared page")
                else:
                    print("[FAIL] positive control not detected: fail-open default")
                    problems += 1
                if any("/account/ route(s) in the rendered" in f for f in broke):
                    print("[PASS] positive control: the chooser regains an injected account route")
                else:
                    print("[FAIL] positive control not detected: chooser account route")
                    problems += 1
            after, _ = measure()
            if after != failures:
                print("[FAIL] the tree does not measure the same way after the controls")
                problems += 1

    if failures or problems:
        print(f"[RED] {len(failures)} finding(s), {problems} control problem(s)")
        return 1
    print("[PASS] PA5: no undeclared page receives an injected adult affordance")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
