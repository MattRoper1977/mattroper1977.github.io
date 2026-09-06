#!/usr/bin/env python3
"""The High-Lumen (projector) reading theme: the two standing checks.

Check 1 — every custom property the theme overrides exists in that page's
          :root. Setting a var the page never reads is a rule that looks like
          it works and does nothing.
Check 2 — every selector the theme targets exists in that page's own CSS.
          Same failure mode, one level up.

Both must return 0 problems on every ported page. Run --self-test to see the
checks go red against a deliberately wrong rule.

Contrast is NOT checked here: a static hex cannot tell you what a rule actually
paints. tools/verify_highlumen_contrast.mjs measures the rendered pages.

  python3 tools/verify_highlumen.py
  python3 tools/verify_highlumen.py --self-test
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


def _first_existing(*cands: Path) -> Path | None:
    for c in cands:
        if c.exists():
            return c
    return None


LESSONS = _first_existing(SITE.parent / "Lessons", Path("/home/user/Lessons"))
APPS = _first_existing(SITE.parent / "matt-s-apps-", Path("/workspace/matt-s-apps-"))

PAGES = [
    ("homepage",    SITE / "main" / "index.html"),
    ("tools",       SITE / "tools" / "index.html"),
    ("resources",   SITE / "resources" / "index.html"),
    ("games",       SITE / "games" / "index.html"),
]
if LESSONS:
    PAGES += [("lessons-hub", LESSONS / "index.html"),
              ("primary-hub", LESSONS / "primary" / "index.html")]
if APPS:
    PAGES += [("creator-hub", APPS / "index.html")]

THEME = "highlumen"
RULE = re.compile(r'((?:html|body)?\[data-theme="%s"\][^{]*)\{([^}]*)\}' % THEME)
STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S)


def page_css(html: str) -> str:
    return "\n".join(STYLE.findall(html))


def root_vars(css: str) -> set[str]:
    out: set[str] = set()
    for block in re.findall(r":root\s*\{([^}]*)\}", css):
        out |= set(re.findall(r"(--[\w-]+)\s*:", block))
    return out


def declared_selectors(css: str) -> set[str]:
    """Every class and id the page's own CSS mentions, minus the theme's own."""
    without_theme = RULE.sub("", css)
    return (set(re.findall(r"\.([A-Za-z][\w-]*)", without_theme))
            | set(re.findall(r"#([A-Za-z][\w-]*)", without_theme)))


def check(path: Path, label: str, mutate=None) -> list[str]:
    html = path.read_text(encoding="utf-8")
    if mutate:
        html = mutate(html)
    css = page_css(html)
    problems: list[str] = []

    rules = RULE.findall(css)
    if not rules:
        return ["%s: no [data-theme=%s] rules at all" % (label, THEME)]

    known_vars = root_vars(css)
    known_sel = declared_selectors(css)

    for selector, body in rules:
        sel = selector.strip()
        # --- check 1: variables ---
        # Only the var-declaration rule sets custom properties.
        for var in re.findall(r"(--[\w-]+)\s*:", body):
            if var not in known_vars:
                problems.append("%s: sets %s, which no :root in this page declares" % (label, var))
        # --- check 2: selectors ---
        for part in sel.split(","):
            part = part.strip()
            trailing = re.sub(r'^(?:html|body)?\[data-theme="%s"\]' % THEME, "", part).strip()
            if not trailing:
                continue
            for cls in re.findall(r"\.([A-Za-z][\w-]*)", trailing):
                if cls not in known_sel:
                    problems.append("%s: targets .%s, which this page's CSS never defines" % (label, cls))
            for idn in re.findall(r"#([A-Za-z][\w-]*)", trailing):
                if idn not in known_sel and ('id="%s"' % idn) not in html:
                    problems.append("%s: targets #%s, which this page never defines" % (label, idn))

    # every page must paint its own body ground explicitly
    if not re.search(r'\[data-theme="%s"\][^{]*\bbody\b[^{]*\{[^}]*background' % THEME, css) \
       and not re.search(r'body\[data-theme="%s"\][^{]*\{[^}]*background' % THEME, css):
        problems.append("%s: no explicit body background rule for the theme" % label)
    return problems


def main() -> int:
    selftest = "--self-test" in sys.argv
    if selftest:
        # Prove both checks can fail: a var no :root declares, and a class the
        # page's CSS never defines.
        def sabotage(html: str) -> str:
            return html.replace('[data-theme="highlumen"]{',
                                '[data-theme="highlumen"] .mbm-not-a-real-class{color:#000}\n'
                                '[data-theme="highlumen"]{--mbm-not-a-real-var:#000;', 1)
        label, path = PAGES[1]
        found = check(path, label, mutate=sabotage)
        got_var = any("not-a-real-var" in p for p in found)
        got_sel = any("not-a-real-class" in p for p in found)
        if not (got_var and got_sel):
            print("[FAIL] self-test: check 1 red=%s, check 2 red=%s" % (got_var, got_sel))
            return 1
        print("[PASS] self-test: both standing checks go red on a wrong var and a wrong selector")

    total = 0
    print("%-13s %-6s %-6s %s" % ("page", "vars", "sels", "problems"))
    for label, path in PAGES:
        if not path.exists():
            print("%-13s %s" % (label, "MISSING " + str(path)))
            total += 1
            continue
        html = path.read_text(encoding="utf-8")
        css = page_css(html)
        n_vars = len(re.findall(r"(--[\w-]+)\s*:", " ".join(b for _, b in RULE.findall(css))))
        n_sels = len(RULE.findall(css))
        problems = check(path, label)
        total += len(problems)
        print("%-13s %-6d %-6d %s" % (label, n_vars, n_sels,
                                      "0 problems" if not problems else "%d PROBLEM(S)" % len(problems)))
        for p in problems:
            print("    - " + p)
    print()
    if total:
        print("[FAIL] High-Lumen standing checks: %d problem(s)" % total)
        return 1
    print("[PASS] High-Lumen standing checks: 0 undeclared vars, 0 phantom selectors, "
          "explicit body ground on every page")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
