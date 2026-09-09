#!/usr/bin/env python3
"""Stamp the shared chrome into every static page type (SW2 T3).

Marker-scoped, per R-T3.1: a marker pair wraps ONE fragment the chrome owns,
never a whole <header> or <footer>. The first version of this tool replaced
whole elements and took the estate's preservation gate from 0 findings to 11,
because the chrome and the authored copy share those elements and three separate
contracts pin parts of what is inside them. docs/SW2_T3_NOTE.md keeps that run.

WHAT IS STAMPED, and why it is only this much
---------------------------------------------
`menu`   the Menu button. Measured byte-identical on all twelve pages before
         this tool was written, so stamping converges nothing; the region exists
         so it has a template to be gated against, and so a page added later
         inherits it instead of copying it.

WHAT IS NOT STAMPED, with the measurement that says so
------------------------------------------------------
the brand mark   Six of twelve pages would change, and every change reds
                 verify_professional_site.js: brandVisual() pins the markup
                 between <a class="brand"> and its first <span>, and normalises
                 only src="assets/, not ../assets/. Listed for Matt in
                 docs/SW2_T3_LEDGER.md with a swap line.
the nav row      Converging it onto one template per variant would change the
                 href multiset on 10 of 12 pages: losing /teach/,
                 /education-hub/, /account/, /mailing-list/, /main/#contact and
                 /main/#collections, and adding /Lessons/?view=saved,
                 /main/#about, /stats/ and /members/. R-T3.4 forbids that, and
                 says why: those are retirements, and retirements belong to
                 Parts H and U with their own two-tap assertion.
the footer links Same reason. The one page with no footer at all,
                 privacy/index.html, takes the `minimal` variant -- brand and
                 tagline, no link group -- so no route is added.

So T3 lands chrome PARITY, not chrome uniformity. Uniformity of the nav needs a
link-set decision this part is not allowed to make.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = ROOT / "tools" / "chrome"
RECORD = ROOT / "data" / "adult-surfaces.json"

# The site commit the templates were reviewed at. Moving the templates means
# moving this in the same commit, so a stamped page always names its source.
TEMPLATE_PIN = "0ad6b82"

# data/adult-surfaces.json is the record of which surfaces a pupil can reach,
# not a list of every page carrying chrome: it omits the chooser and /stats/,
# which tools/verify_professional_site.js treats as key pages.
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

# Generated trees change through their generator, never their output. This tuple
# is what this tool refuses to WRITE; it is not the whole list of generator-owned
# pages, and mistaking it for one is how index.html, teach/ and education-hub/
# came to be hand-stamped and went red on their own --check:
#
#   tools/render_audience_homepages.py   index.html, start/, for/*/
#   tools/render_discovery_hubs.py       teach/, education-hub/
#   (both also splice into main/index.html and hud.js, which is why main/
#    survived being stamped and the other three did not)
#
# Those five pages are stamped by their GENERATOR now, reading the same
# tools/chrome/header.html fragments this tool reads. One source, three
# consumers. The regions still appear here in --check, and must, because that is
# what proves the three agree; what changed is who writes them.
GENERATED = ("for/", "asdan/", "uas/")

# name -> (open marker, close marker, regex that finds the unmarked fragment)
FRAGMENTS = {
    "tokens": (
        "<!-- mbm-chrome:tokens -->",
        "<!-- /mbm-chrome:tokens -->",
        # Absent everywhere today, so this one is INSERTED rather than marked in
        # place. It is the only region allowed to appear from nothing, and it
        # adds no anchor, so the navigation census is untouched.
        None,
    ),
    "menu": (
        "<!-- mbm-chrome:menu -->",
        "<!-- /mbm-chrome:menu -->",
        re.compile(r"""<button\b[^>]*class=["'][^"']*\bmenu\b[^"']*["'][^>]*>.*?</button>""", re.S),
    ),
}

# Where an inserted region goes, and the marker it must sit before.
INSERT_BEFORE = {"tokens": "</head>"}


def fragment(name: str) -> str:
    text = (CHROME / "header.html").read_text()
    match = re.search(
        r"<!-- MBM-CHROME-FRAGMENT: " + name + r" -->\n(?:<!--.*?-->\n)?(.*?)\n<!-- /MBM-CHROME-FRAGMENT: " + name + r" -->",
        text,
        re.S,
    )
    if not match:
        raise ValueError(f"no {name} fragment in the template")
    return match.group(1)


def stamp_set() -> list[str]:
    record = json.loads(RECORD.read_text())
    named = {str(e["page"]) for e in record["adultSurfaces"]}
    named |= {str(e["page"]) for e in record["pupilReachableSurfaces"]}
    named |= set(VERIFIER_PAGES)
    return [p for p in sorted(named) if not p.startswith(GENERATED) and (ROOT / p).is_file()]


def apply(page: Path, check: bool) -> list[str]:
    problems: list[str] = []
    text = original = page.read_text()
    rel = page.relative_to(ROOT)

    for name, (open_marker, close_marker, finder) in FRAGMENTS.items():
        want_body = fragment(name)
        want = f"{open_marker}{want_body}{close_marker}"

        start = text.find(open_marker)
        if start >= 0:
            end = text.find(close_marker, start)
            if end < 0:
                problems.append(f"{rel}: unclosed {name} marker")
                continue
            have = text[start : end + len(close_marker)]
            if have != want:
                if check:
                    problems.append(f"{rel}: {name} region differs from the template at {TEMPLATE_PIN}")
                else:
                    text = text[:start] + want + text[end + len(close_marker) :]
            continue

        if finder is None:
            anchor = INSERT_BEFORE[name]
            if anchor not in text:
                problems.append(f"{rel}: no {anchor} to insert {name} before")
                continue
            if check:
                problems.append(f"{rel}: {name} is not marked yet")
                continue
            text = text.replace(anchor, want + "\n" + anchor, 1)
            continue

        match = finder.search(text)
        if not match:
            problems.append(f"{rel}: no {name} fragment to stamp")
            continue
        if check:
            problems.append(f"{rel}: {name} is not marked yet")
            continue
        if match.group(0) != want_body:
            problems.append(
                f"{rel}: {name} differs from the template, so marking it would change bytes; "
                "converge it in its own commit first"
            )
            continue
        text = text[: match.start()] + want + text[match.end() :]

    if not check and text != original:
        page.write_text(text)
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="write nothing; assert every marked region matches")
    args = parser.parse_args()

    pages = stamp_set()
    problems: list[str] = []
    for rel in pages:
        problems += apply(ROOT / rel, args.check)

    digest = hashlib.sha256(
        b"".join((CHROME / f).read_bytes() for f in sorted(p.name for p in CHROME.glob("*.html")))
    ).hexdigest()[:12]
    print(f"templates pinned at {TEMPLATE_PIN}; chrome sha256 {digest}")
    print(f"{'checked' if args.check else 'stamped'}: {len(pages)} pages, regions {sorted(FRAGMENTS)}")
    for rel in pages:
        print("  ", rel)

    if problems:
        print(f"PROBLEMS: {len(problems)}", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
