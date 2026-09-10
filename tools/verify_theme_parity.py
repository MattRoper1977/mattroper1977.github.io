#!/usr/bin/env python3
"""The six reading themes must be the same six everywhere they are named.

WHY THIS EXISTS
---------------
tools/sync_theme.py makes the two copied engines byte-identical to theme.js, and
the cross-estate contract test enforces it. That closes the copies. It does not
close the estate, because the value list is written down in places a file copy
cannot reach:

  * the homepage has its OWN implementation. It is not theme.js and cannot be:
    theme.js injects swatch buttons into a nav, and the homepage lays its
    swatches out by hand as part of the page design. Same storage key, same six
    values, different code. A copy gate is blind to it.
  * every themed page carries its own [data-theme="X"] CSS. An engine can offer
    a seventh theme and a page can simply have no rules for it — the swatch
    appears, is pressed, and nothing changes.

That second failure is exactly what shipped on 2026-08-12: High Lumen went into
one engine, and the Lessons and Creator hubs kept five swatches. A byte gate
would not have caught it, because at that moment the bytes were not yet the
question — the value list was.

So this gate asserts the SET, from every place the set is written:

  engines      theme.js and both generated copies: ORDER, NAME keys, DOT keys
  homepage     the inline implementation, extracted between its sentinels,
               plus the data-t on the hand-written swatch buttons
  pages        every ported page's [data-theme="X"] CSS

CREAM IS NOT IN THE CSS, AND THAT IS CORRECT
--------------------------------------------
Cream is the default: the engines REMOVE the attribute for it rather than
setting data-theme="cream", so the page's base styles are the cream styles. A
[data-theme="cream"] rule would be dead code. The page assertion is therefore
the six minus cream, and a cream rule appearing is itself a failure.

SCOPE, AND WHY IT IS NOT ALWAYS EVERYTHING
------------------------------------------
Run with no scope it checks the whole estate, which is what a person with all
three repositories checked out should do, and what this pass's evidence run did.

CI cannot always do that. The three repositories merge in dependency order —
site first, because it owns the canonical engine — so between those merges the
estate is legitimately mid-rollout, and a gate demanding whole-estate agreement
would redden the site's own pull request for the crime of going first. So each
repository's CI runs the scope it OWNS, measured against the canonical:

    --scope site      the canonical engine, the homepage's inline
                      implementation and swatch markup, and the four site pages
    --scope lessons   the canonical engine, the Lessons copy, and the two
                      Lessons pages
    --scope apps      the canonical engine, the Apps copy, and the Creator hub

Every scope includes the canonical engine, so no scope can drift away from it,
and between them the scopes cover every source with none left to nobody.

    python3 tools/verify_theme_parity.py
    python3 tools/verify_theme_parity.py --self-test
    python3 tools/verify_theme_parity.py --scope lessons --lessons .
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


def _first_existing(*cands: Path) -> Path | None:
    for c in cands:
        if c.exists():
            return c
    return None


LESSONS = _first_existing(SITE.parent / "Lessons", Path("/home/user/Lessons"))
APPS = _first_existing(SITE.parent / "matt-s-apps-", Path("/workspace/matt-s-apps-"))

# Order is part of the contract, not just membership. Warm, Pink and Blue are a
# visual-stress accommodation and lead the row; cream is the default and must
# stay first. Reordering changes what a person reaches for by muscle memory, so
# it is asserted as a list, not a set.
EXPECTED = ["cream", "pink", "blue", "light", "dark", "highlumen"]
DEFAULT = "cream"

BEGIN, END = "mbm-theme-engine:begin", "mbm-theme-engine:end"
SCOPES = ("all", "site", "lessons", "apps")

# Six of the seven ported pages keep their theme rules in one named block, and
# the page CSS is read from it rather than from every <style> on the page: a
# stray [data-theme] rule elsewhere must not be able to stand in for the real
# ones. The homepage is the exception — its theme rules are woven through its
# main stylesheet — so it is named here rather than silently tolerated.
THEME_STYLE = '<style id="mbmTheme">'
UNANCHORED = {"homepage"}

# The pre-paint snippet: it sets data-theme from storage before anything is
# painted, so the page does not flash cream and then repaint. It is the one
# other place the DEFAULT value's name is written down, on every page that has
# one. The homepage has none — it applies inside its inline engine instead, so
# it can flash. That is pre-existing and is recorded, not silently accepted.
NOFLASH = re.compile(r"localStorage\.getItem\('mbm_reading_theme'\)")
NO_PREPAINT = {"homepage"}


def homepage_path() -> Path:
    return SITE / "main" / "index.html"


def engines() -> list[tuple[str, str, Path | None]]:
    return [
        ("site", "canonical  theme.js", SITE / "theme.js"),
        ("lessons", "Lessons    assets/mbm-theme.js",
         (LESSONS / "assets/mbm-theme.js") if LESSONS else None),
        ("apps", "Apps       assets/mbm-theme.js",
         (APPS / "assets/mbm-theme.js") if APPS else None),
    ]


def pages() -> list[tuple[str, str, Path | None]]:
    return [
        ("site", "homepage", homepage_path()),
        ("site", "tools", SITE / "tools" / "index.html"),
        ("site", "resources", SITE / "resources" / "index.html"),
        ("site", "games", SITE / "games" / "index.html"),
        ("lessons", "lessons-hub", (LESSONS / "index.html") if LESSONS else None),
        ("lessons", "primary-hub", (LESSONS / "primary" / "index.html") if LESSONS else None),
        ("apps", "creator-hub", (APPS / "index.html") if APPS else None),
    ]


def selected(rows, scope: str):
    """Rows this scope is answerable for. Non-site scopes keep the canonical
    engine, because it is the thing they are being compared against."""
    if scope == "all":
        return rows
    if scope == "site":
        return [r for r in rows if r[0] == "site"]
    return [r for r in rows if r[0] == scope or r[2] == SITE / "theme.js"]


def homepage_in_scope(scope: str) -> bool:
    """The homepage's inline engine lives in the site repository and is checked
    by the site scope. Lessons and Apps CI have the site tree available but do
    not own that file, so they do not gate on it."""
    return scope in ("all", "site")


# ---------------------------------------------------------------- extraction

def map_keys(text: str, name: str) -> list[str] | None:
    m = re.search(r"var\s+%s\s*=\s*\{([^}]*)\}" % name, text)
    return re.findall(r"(\w+)\s*:", m.group(1)) if m else None


def order_list(text: str) -> list[str] | None:
    m = re.search(r"var\s+ORDER\s*=\s*\[([^\]]*)\]", text)
    return [x.strip().strip("'\"") for x in m.group(1).split(",") if x.strip()] if m else None


def page_css(html: str, label: str = "") -> str:
    """The page's theme rules, from its named block where it has one."""
    if label not in UNANCHORED and THEME_STYLE in html:
        return html.split(THEME_STYLE, 1)[1].split("</style>", 1)[0]
    return "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S))


def css_themes(html: str, label: str = "") -> set[str]:
    return set(re.findall(r'\[data-theme="([a-z-]+)"\]', page_css(html, label)))


def homepage_block(html: str) -> str | None:
    """The inline implementation, anchored on its sentinels.

    Anchored rather than pattern-matched on purpose: a regex for "the bit that
    looks like a theme engine" silently stops matching the day someone renames a
    variable, and a gate that has stopped looking is indistinguishable from one
    that found nothing wrong.
    """
    if html.count(BEGIN) != 1 or html.count(END) != 1:
        return None
    body = html.split(BEGIN, 1)[1].split(END, 1)[0]
    body = body.split("*/", 1)[1] if "*/" in body else body
    return body.rsplit("/*", 1)[0] if body.rstrip().endswith("/*") else body


def swatch_values(html: str) -> list[str]:
    """data-t on the hand-written swatch buttons, in document order."""
    return re.findall(r'<button[^>]*\bclass="dx-sw"[^>]*\bdata-t="([a-z-]+)"', html)


# ------------------------------------------------------------------- checking

def check(scope: str = "all", override: dict[Path, str] | None = None) -> list[str]:
    over = override or {}
    read = lambda p: over.get(p, p.read_text(encoding="utf-8"))
    problems: list[str] = []
    expected_set = set(EXPECTED)
    css_expected = expected_set - {DEFAULT}

    for _owner, label, path in selected(engines(), scope):
        if path is None or not path.exists():
            problems.append(f"{label}: not available — this scope cannot be verified without it")
            continue
        text = read(path)
        order, name, dot = order_list(text), map_keys(text, "NAME"), map_keys(text, "DOT")
        if order is None or name is None or dot is None:
            problems.append(f"{label}: could not find ORDER/NAME/DOT — the engine's shape changed")
            continue
        if order != EXPECTED:
            problems.append(f"{label}: ORDER is {order}, expected {EXPECTED}")
        if set(name) != expected_set:
            problems.append(f"{label}: NAME keys {sorted(name)} != {sorted(expected_set)}")
        if set(dot) != expected_set:
            problems.append(f"{label}: DOT keys {sorted(dot)} != {sorted(expected_set)}")
        # A value with a label but no dot colour renders as an invisible swatch.
        if set(name) != set(dot):
            problems.append(f"{label}: NAME and DOT disagree — "
                            f"{sorted(set(name) ^ set(dot))} is in one and not the other")

    if homepage_in_scope(scope):
        home = homepage_path()
        if not home.exists():
            problems.append("homepage: missing")
        else:
            html = read(home)
            block = homepage_block(html)
            if block is None:
                problems.append(f"homepage: the {BEGIN}/{END} sentinels are missing, or not "
                                f"exactly one each — the inline engine cannot be extracted")
            else:
                names = map_keys(block, "names")
                if names is None:
                    problems.append("homepage inline: no names map between the sentinels — either "
                                    "the implementation moved out of them, or its shape changed")
                elif set(names) != expected_set:
                    problems.append(f"homepage inline: names keys {sorted(names)} "
                                    f"!= {sorted(expected_set)}")
            vals = swatch_values(html)
            if not vals:
                problems.append("homepage: no .dx-sw swatch buttons found at all")
            else:
                unexpected = sorted(set(vals) - expected_set)
                missing = sorted(expected_set - set(vals))
                if unexpected:
                    problems.append(f"homepage swatches: offers {unexpected}, which is not a theme")
                if missing:
                    problems.append(f"homepage swatches: never offers {missing}")
                # The swatch row appears more than once (nav and panel). Every
                # occurrence must carry the full set, so the counts must be level.
                counts = {v: vals.count(v) for v in sorted(set(vals))}
                if len(set(counts.values())) > 1:
                    problems.append(f"homepage swatches: uneven counts {counts} — at least one "
                                    f"swatch row is missing a theme the others offer")
                if vals[:len(EXPECTED)] != EXPECTED:
                    problems.append(f"homepage swatches: first row is {vals[:len(EXPECTED)]}, "
                                    f"expected {EXPECTED}")

    for _owner, label, path in selected(pages(), scope):
        if path is None:
            problems.append(f"page {label}: not available — this scope cannot be verified without it")
            continue
        if path == SITE / "theme.js":       # the canonical engine rides along; not a page
            continue
        if not path.exists():
            problems.append(f"page {label}: missing {path}")
            continue
        html = read(path)
        if label not in UNANCHORED and THEME_STYLE not in html:
            problems.append(f"page {label}: lost its {THEME_STYLE} block, so its theme rules can "
                            f"no longer be told apart from the rest of its CSS")
        # The pre-paint snippet names the default value. If the default were
        # ever renamed, these would keep testing for a value nothing sets and
        # every page would flash — silently, because nothing errors.
        if label not in NO_PREPAINT:
            n = len(NOFLASH.findall(html))
            if n != 1:
                problems.append(f"page {label}: has {n} pre-paint theme snippets, expected 1 — "
                                f"without it the page paints {DEFAULT} and then repaints")
            elif not re.search(r"!==?'%s'" % DEFAULT, html):
                problems.append(f"page {label}: its pre-paint snippet does not treat '{DEFAULT}' "
                                f"as the default, so the default would paint as a theme")
        vals = css_themes(html, label)
        missing = sorted(css_expected - vals)
        extra = sorted(vals - css_expected)
        if missing:
            problems.append(f"page {label}: no [data-theme] rules for {missing} — those swatches "
                            f"would be pressable and do nothing on this page")
        if DEFAULT in extra:
            problems.append(f'page {label}: has a [data-theme="{DEFAULT}"] rule, which is dead — '
                            f"{DEFAULT} removes the attribute rather than setting it")
            extra.remove(DEFAULT)
        if extra:
            problems.append(f"page {label}: styles {extra}, which no engine offers")
    return problems


# ------------------------------------------------------------------ self-test

def self_test(scope: str) -> int:
    """A seventh theme, grafted on one side at a time, must be caught from both.

    Grafts are in memory, and each is checked to have actually changed the text
    before its result is believed. A sabotage that silently no-ops measures a
    clean tree and reports it green — the TG-78 lesson.
    """
    problems: list[str] = []

    def graft(path: Path, *subs: tuple[str, str]) -> str | None:
        text = path.read_text(encoding="utf-8")
        out = text
        for old, new in subs:
            out = out.replace(old, new, 1)
        return None if out == text else out

    canonical = SITE / "theme.js"
    eng = graft(canonical,
                ("var ORDER=['cream','pink','blue','light','dark','highlumen']",
                 "var ORDER=['cream','pink','blue','light','dark','highlumen','terracotta']"),
                ("highlumen:'High lumen'}", "highlumen:'High lumen',terracotta:'Terracotta'}"),
                ("highlumen:'#FFFFFF'}", "highlumen:'#FFFFFF',terracotta:'#C96F4A'}"))
    if eng is None:
        problems.append("direction 1: THE GRAFT DID NOT LAND — theme.js unchanged")
    else:
        hits = [p for p in check(scope, {canonical: eng}) if "terracotta" in p]
        print(f"   direction 1 — terracotta added to the canonical engine: {len(hits)} finding(s)")
        for h in hits[:3]:
            print(f"      {h}")
        if not hits:
            problems.append("direction 1: an engine offering a seventh theme was not caught")

    if homepage_in_scope(scope):
        home = homepage_path()
        h2 = graft(home,
                   ("highlumen:'High lumen'}", "highlumen:'High lumen',terracotta:'Terracotta'}"),
                   ('<button class="dx-sw" type="button" data-t="cream"',
                    '<button class="dx-sw" type="button" data-t="terracotta"'))
        if h2 is None:
            problems.append("direction 2: THE GRAFT DID NOT LAND — main/index.html unchanged")
        else:
            hits = [p for p in check(scope, {home: h2}) if "homepage" in p]
            print(f"   direction 2 — terracotta added to the homepage only: {len(hits)} finding(s)")
            for h in hits[:3]:
                print(f"      {h}")
            if not hits:
                problems.append("direction 2: a homepage offering a seventh theme was not caught")

        stripped = home.read_text(encoding="utf-8").replace(BEGIN, "x", 1)
        hits = [p for p in check(scope, {home: stripped}) if "sentinel" in p]
        print(f"   sentinels removed: {len(hits)} finding(s)")
        if not hits:
            problems.append("removing the sentinels did not fail the extraction")

    # direction 3 — a page that styles fewer themes than the engine offers.
    # This is the failure that actually shipped, so it is asserted, not assumed.
    page = next((p for o, _l, p in selected(pages(), scope)
                 if p is not None and p.exists() and p != SITE / "theme.js"), None)
    if page is not None:
        dropped = re.sub(r'(html|body)?\[data-theme="highlumen"\][^{]*\{[^}]*\}', "",
                         page.read_text(encoding="utf-8"))
        if dropped == page.read_text(encoding="utf-8"):
            problems.append(f"direction 3: THE GRAFT DID NOT LAND — {page.name} unchanged")
        else:
            hits = [p for p in check(scope, {page: dropped}) if "highlumen" in p]
            print(f"   direction 3 — a page's highlumen rules deleted: {len(hits)} finding(s)")
            for h in hits[:2]:
                print(f"      {h}")
            if not hits:
                problems.append("direction 3: a page missing a theme's rules was not caught")

    # direction 4 — a page loses the named block its theme rules live in, and
    # direction 5 — a page loses its pre-paint snippet. Both are silent in a
    # browser: the first leaves the rules unfindable, the second makes the page
    # flash. Neither errors, so neither is noticed without being asserted.
    anchored = next((p for _o, l, p in selected(pages(), scope)
                     if p is not None and p.exists() and l not in UNANCHORED
                     and p != SITE / "theme.js"), None)
    if anchored is not None:
        text = anchored.read_text(encoding="utf-8")
        for n, (desc, mutated, want) in enumerate((
            ("its named theme block", text.replace(THEME_STYLE, "<style>", 1), "mbmTheme"),
            ("its pre-paint snippet",
             NOFLASH.sub("localStorage.getItem('x')", text, count=1), "pre-paint"),
        ), start=4):
            if mutated == text:
                problems.append(f"direction {n}: THE GRAFT DID NOT LAND — {anchored.name} unchanged")
                continue
            hits = [p for p in check(scope, {anchored: mutated}) if want in p]
            print(f"   direction {n} — a page loses {desc}: {len(hits)} finding(s)")
            for h in hits[:1]:
                print(f"      {h}")
            if not hits:
                problems.append(f"direction {n}: losing {desc} was not caught")

    for p in problems:
        print("   FAIL " + p)
    if problems:
        print(f"[FAIL] parity self-test: {len(problems)} problem(s)")
        return 1
    print("[PASS] parity self-test: a seventh theme is caught whether it appears in the engine "
          "or on the homepage, a page that stops styling one is caught, a page that loses its "
          "named theme block or its pre-paint snippet is caught, and losing the sentinels "
          "fails rather than passes")
    return 0


def main() -> int:
    global LESSONS, APPS
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=SCOPES, default="all")
    ap.add_argument("--lessons", help="path to the Lessons checkout, when it is not beside the site repo")
    ap.add_argument("--apps", help="path to the Apps checkout, when it is not beside the site repo")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.lessons:
        LESSONS = Path(a.lessons).resolve()
    if a.apps:
        APPS = Path(a.apps).resolve()

    if a.self_test:
        rc = self_test(a.scope)
        if rc:
            return rc
        print()

    print(f"scope {a.scope}; expected, in order: {EXPECTED}")
    print(f"pages carry the same minus '{DEFAULT}', which removes the attribute\n")
    print("%-34s %s" % ("source", "declares"))
    for _o, label, path in selected(engines(), a.scope):
        print("%-34s %s" % (label, order_list(path.read_text(encoding="utf-8"))
                            if path and path.exists() else "MISSING"))
    if homepage_in_scope(a.scope) and homepage_path().exists():
        html = homepage_path().read_text(encoding="utf-8")
        block = homepage_block(html)
        print("%-34s names  %s" % ("homepage   inline (sentinels)",
                                   sorted(map_keys(block, "names") or []) if block else "UNANCHORED"))
        print("%-34s data-t %s" % ("homepage   swatch buttons", sorted(set(swatch_values(html)))))
    for _o, label, path in selected(pages(), a.scope):
        if path == SITE / "theme.js":
            continue
        print("%-34s CSS    %s" % ("page       " + label,
                                   sorted(css_themes(path.read_text(encoding="utf-8"), label))
                                   if path and path.exists() else "MISSING"))

    problems = check(a.scope)
    print()
    if problems:
        print(f"[FAIL] theme parity ({a.scope}): {len(problems)} problem(s)")
        for p in problems:
            print("   - " + p)
        print(f"\n   EXPECTED in this file is the declared contract, not a description of "
              f"whatever theme.js happens to say.\n"
              f"   Adding or removing a theme is a deliberate act: change EXPECTED here, then "
              f"change every source listed above, in one pass.\n"
              f"   If a COPY has fallen behind the canonical rather than the list changing, "
              f"that is tools/sync_theme.py's job, and it will say so.")
        return 1
    print(f"[PASS] theme parity ({a.scope}): {len(EXPECTED)} themes, identical in every engine "
          f"in scope, in the homepage's own implementation and its swatch markup where that is "
          f"in scope, and styled on every ported page in scope")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
