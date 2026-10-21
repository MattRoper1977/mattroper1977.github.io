#!/usr/bin/env python3
"""The adult-affordance boundary is fail-closed, and the tree agrees with the record.

Why this file exists
--------------------
assets/mbm-platform.js injects four things into a page it considers adult: the
account nav link, the create-account link, the mailing nav link and the footer
mailing CTA. It used to consider EVERY page adult and suppress them only where a
page said data-mbm-adult-features="off". Exactly one page in the estate ever
said it. A page that forgot the marker - or a renderer that dropped it, or a
typo in the attribute name - showed a sign-in link to whoever was reading, and
nothing anywhere failed.

The default is inverted now: only "on" allows them. This file is what stops that
inversion from rotting. It checks the mechanism, and it checks that the set of
pages carrying "on" is exactly the set declared in data/adult-surfaces.json - in
both directions, because a record that is a superset of the tree and a tree that
is a superset of the record are different bugs and both are silent.

PA1  the mechanism in mbm-platform.js is fail-closed, matched on structure
PA2  every declared adult surface exists and carries the marker
PA3  no page outside the declaration carries it - the reverse direction
PA4  the commerce ruling and this one cannot contradict each other
PA5  lives in verify_adult_surfaces_browser.mjs, because the defect that
     motivated it is invisible to every static check in this file: the chooser's
     source carries zero /account/ hrefs and passes its gate, while the browser
     shows one, injected after load. A static gate cannot see an injected link.
PA6  the menu drawer follows the record (ruling tm). The drawer's "Your account"
     group is written by the publisher (domain-split/shared_navigation.py), not
     by mbm-platform.js, so PA1-PA5 never saw it: its account and mailing
     entries were on undeclared pages, the homepage and the Learning index among
     them, while every check here stayed green. PA6 runs the publisher's own
     refresh() over a throwaway stub tree and reads the drawer it renders on
     every surface: the account and mailing entries appear only on declared
     pages, every declared page it renders gets them, and every drawer keeps the
     Privacy entry. Undeclared = privacy-only.

A record entry may say "generated": "publication" for a page the publisher
builds that does not exist in this tree (the governors face, the owner's
statistics page, the commissioning page). PA2 cannot read a marker on a file
that is not here, so for those it asserts the opposite instead - the page is
NOT in the tree - and PA6 asserts the publisher renders it.

Run with --self-test to run the mutation controls, which prove each check can
actually go red. A gate nobody has seen fail is a gate nobody should trust.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import types
from collections.abc import Mapping
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORD = "data/adult-surfaces.json"
NAV = "domain-split/shared_navigation.py"
GENERATED_AT = "publication"
DRAWER_GROUP = re.compile(r'<section class="mbm-menu-group"><h2>Your account</h2>(.*?)</section>', re.S)
PLATFORM = "assets/mbm-platform.js"
MARKER = "data-mbm-adult-features"

# The same exclusions the sibling suites use: build staging, held previews and
# generated audit output are not the shipped tree.
SKIP_PARTS = {".git", "_staging", "audit-output", "next", "node_modules"}


def read(root: Path, rel: str, overrides: Mapping[str, str] | None = None) -> str:
    if overrides and rel in overrides:
        return overrides[rel]
    return (root / rel).read_text(encoding="utf-8")


def body_marker(html: str) -> str | None:
    """The marker as the BROWSER would read it: on the body element only.

    Deliberately not a substring search for the attribute anywhere in the file.
    mbm-platform.js reads doc.body.getAttribute(...), so a marker sitting in a
    comment, in a <script> string or on <html> is not the marker that governs
    this page, and a check that accepted those would pass a page the browser
    treats as adult.
    """
    tag = re.search(r"<body\b[^>]*>", html, re.I)
    if not tag:
        return None
    found = re.search(MARKER + r'=["\']([a-z-]*)["\']', tag.group(0), re.I)
    return found.group(1).lower() if found else None


def declared_surfaces(root: Path, overrides: Mapping[str, str] | None = None) -> list[str]:
    record = json.loads(read(root, RECORD, overrides))
    return [str(entry["page"]) for entry in record["adultSurfaces"]]


def generated_surfaces(root: Path, overrides: Mapping[str, str] | None = None) -> set[str]:
    record = json.loads(read(root, RECORD, overrides))
    return {str(e["page"]) for e in record["adultSurfaces"] if e.get("generated") == GENERATED_AT}


def builder_drawers(root: Path, overrides: Mapping[str, str] | None = None,
                    keep: Path | None = None) -> dict[str, dict[str, object]]:
    """The drawer the publisher actually renders, per surface.

    Not a re-implementation of the publisher's rule: its own refresh() is run
    against a throwaway output tree of stub pages, so what is measured is what
    it would write. The stub tree is discovered, not listed - every surface the
    publisher asks for and finds missing is added and the run repeated - so a
    surface added to the publisher tomorrow is measured without anyone
    extending a list here. Under a fixture, the data files and the publisher's
    source are taken from the overrides.
    """
    overrides = overrides or {}
    work = keep or Path(tempfile.mkdtemp(prefix="pa6-"))
    try:
        source, output = work / "source", work / "output"
        source.mkdir(parents=True, exist_ok=True)
        for child in root.iterdir():
            if child.name not in {".git", "data"}:
                (source / child.name).symlink_to(child)
        shutil.copytree(root / "data", source / "data")
        for rel, text in overrides.items():
            if rel.startswith("data/"):
                (source / rel).write_text(text, encoding="utf-8")
        builder = read(root, NAV, overrides)
        here = str(root / "domain-split")
        if here not in sys.path:
            sys.path.insert(0, here)
        module = types.ModuleType("pa6_shared_navigation")
        module.__file__ = str(root / NAV)
        exec(compile(builder, str(root / NAV), "exec"), module.__dict__)  # noqa: S102 - our own publisher
        # The legacy stats page must carry the one handler the publisher strips.
        legacy = re.search(r'''old="(document\.getElementById\('menu'\)[^"]*)"''', builder)
        stub = ('<!doctype html><html lang="en-GB"><head><title>PA6 stub</title></head><body>'
                '<header></header><main></main><script>' + (legacy.group(1) if legacy else "")
                + '</script></body></html>')
        (output / "education-site" / "assets").mkdir(parents=True, exist_ok=True)
        # Surfaces the publisher renders only when their file exists are named in
        # its source as output/'...' literals; offer every one of them.
        stubs = {output / rel for rel in re.findall(r"output\s*/\s*'([^']+\.html)'", builder)}
        for _ in range(200):
            for page in stubs:
                page.parent.mkdir(parents=True, exist_ok=True)
                page.write_text(stub, encoding="utf-8")
            try:
                module.refresh(output, source)
                break
            except ValueError as err:
                missing = re.match(r"Missing navigation surface: (.+)$", str(err))
                if not missing:
                    raise
                stubs.add(Path(missing.group(1)))
        else:
            raise RuntimeError("the publisher kept asking for surfaces")
        apps = re.search(r"education-apps/index\.html',\s*'([^']+)'", builder)
        prefix = {"education-site": "/", "education-lessons": "/Lessons/",
                  "education-apps": apps.group(1) if apps else "/apps/"}
        rendered: dict[str, dict[str, object]] = {}
        for page in sorted(stubs):
            part, _, tail = page.relative_to(output).as_posix().partition("/")
            route = prefix[part] + tail
            route = route[: -len("index.html")] if route.endswith("index.html") else route
            group = DRAWER_GROUP.search(page.read_text(encoding="utf-8"))
            items = group.group(1) if group else ""
            rendered[route] = {
                "page": tail if part == "education-site" else None,
                "file": page.relative_to(output).as_posix(),
                "account": items.count('href="/account/"'),
                "mailing": items.count('href="/mailing-list/"'),
                "privacy": items.count('href="/privacy/"'),
            }
        return rendered
    finally:
        if keep is None:
            shutil.rmtree(work, ignore_errors=True)


def check_drawer(root: Path = ROOT, overrides: Mapping[str, str] | None = None) -> list[str]:
    """PA6: the drawer's account and mailing entries appear only on declared pages."""
    errors: list[str] = []
    declared = set(declared_surfaces(root, overrides))
    try:
        rendered = builder_drawers(root, overrides)
    except Exception as err:  # noqa: BLE001 - a publisher that cannot be measured is red, not skipped
        return [f"{NAV}: PA6 could not run the publisher's refresh() ({type(err).__name__}: {str(err)[:120]})"]
    if not rendered:
        return [f"{NAV}: PA6 found no navigation surface at all; the measurement is blind"]
    seen = set()
    for route, d in sorted(rendered.items()):
        page = d["page"]
        full = bool(d["account"] or d["mailing"])
        if page in declared:
            seen.add(page)
            if not (d["account"] and d["mailing"]):
                errors.append(f"{route}: declared adult in {RECORD} but its drawer withholds the account "
                              f"or mailing entry (account {d['account']}, mailing {d['mailing']})")
        elif full:
            errors.append(f"{route}: the drawer renders the account and mailing entries (account "
                          f"{d['account']}, mailing {d['mailing']}) but the page is not declared in "
                          f"{RECORD}. Undeclared = privacy-only.")
        if d["privacy"] != 1:
            errors.append(f"{route}: the drawer carries {d['privacy']} Privacy entries; every drawer keeps exactly one")
    for page in sorted(generated_surfaces(root, overrides) - seen):
        errors.append(f"{page}: declared as generated at {GENERATED_AT}, but the publisher renders no such surface")
    return errors


def check_tree(root: Path = ROOT, overrides: Mapping[str, str] | None = None) -> list[str]:
    errors: list[str] = []

    # ---- PA1: the mechanism is fail-closed -------------------------------
    #
    # Matched on structure, not on a substring. "==='on'" appearing somewhere in
    # a 300-line file proves nothing; what matters is what adultFeaturesAllowed
    # itself returns. The control that reverts the function to !=='off' is what
    # keeps this honest.
    platform = read(root, PLATFORM, overrides)
    fn = re.search(r"function\s+adultFeaturesAllowed\s*\(\s*\)\s*\{([\s\S]{0,400}?)\}", platform)
    if not fn:
        errors.append(f"{PLATFORM}: adultFeaturesAllowed() is gone; the whole boundary hangs off it")
    else:
        body = fn.group(1)
        if MARKER not in body:
            errors.append(f"{PLATFORM}: adultFeaturesAllowed() no longer reads {MARKER}")
        if not re.search(r"===\s*['\"]on['\"]", body):
            errors.append(
                f"{PLATFORM}: adultFeaturesAllowed() does not require the marker to equal 'on'. "
                "The default must be closed: absent, misspelt or forgotten has to mean no."
            )
        if re.search(r"!==\s*['\"]off['\"]", body):
            errors.append(
                f"{PLATFORM}: adultFeaturesAllowed() is back to the fail-OPEN test (!== 'off'), "
                "which grants adult affordances to every page that has not opted out"
            )

    # ---- PA2: every declared surface exists and is marked -----------------
    declared = declared_surfaces(root, overrides)
    if len(declared) != len(set(declared)):
        errors.append(f"{RECORD}: lists the same page twice")
    generated = generated_surfaces(root, overrides)
    for rel in declared:
        if rel in generated:
            # Built by the publisher, so there is no file here to carry a marker.
            # A page that IS here must be marked like any other; PA6 proves the
            # publisher renders the generated ones.
            if (root / rel).is_file() or (overrides and rel in overrides):
                errors.append(f"{RECORD}: marks {rel} as generated at {GENERATED_AT}, but it exists in "
                              "this tree; drop the flag so PA2 reads its marker")
            continue
        try:
            page = read(root, rel, overrides)
        except FileNotFoundError:
            errors.append(f"{RECORD}: declares {rel}, which does not exist")
            continue
        marker = body_marker(page)
        if marker != "on":
            errors.append(
                f"{rel}: declared an adult surface but its body marker is "
                f"{marker!r}; the fail-closed default means it gets no adult affordances at all"
            )

    # ---- PA3: nothing outside the declaration is marked -------------------
    #
    # The direction that matters most. PA2 alone would pass a tree where some
    # other page had quietly grown the marker.
    declared_set = set(declared)
    if overrides is None:
        candidates = [
            p for p in root.rglob("*.html")
            if not any(part in SKIP_PARTS for part in p.parts)
        ]
    else:
        # Under a fixture, scan the pages the fixture touches plus the declared
        # ones, so a control that grafts the marker onto an undeclared page is
        # still seen without walking the whole tree twice.
        candidates = [root / rel for rel in set(overrides) | declared_set if rel.endswith(".html")]
    for path in candidates:
        rel = str(path.relative_to(root))
        try:
            page = read(root, rel, overrides)
        except (FileNotFoundError, UnicodeDecodeError):
            continue
        if body_marker(page) == "on" and rel not in declared_set:
            errors.append(
                f"{rel}: carries {MARKER}=\"on\" but is not declared in {RECORD}. "
                "Adding the marker is not the decision; declaring the page is."
            )

    # ---- PA4: the two rulings cannot contradict each other ----------------
    #
    # A surface that may ask a visitor for money is adult by definition, and a
    # surface closed to commerce because children reach it must not be adult.
    # Both lists are editorial and are maintained by hand in different files, so
    # the containment is asserted rather than assumed.
    try:
        from verify_games_audience_faces import PILL_FORBIDDEN, PILL_PAGES
    except ImportError:  # pragma: no cover - only if the sibling suite moves
        errors.append("cannot import PILL_PAGES/PILL_FORBIDDEN; the commerce ruling cannot be cross-checked")
    else:
        for rel in PILL_PAGES:
            if rel not in declared_set:
                errors.append(
                    f"{rel}: carries the Ko-fi support pill but is not a declared adult surface. "
                    "A page that may ask for money is adult by definition."
                )
        for rel in PILL_FORBIDDEN:
            if rel in declared_set:
                errors.append(
                    f"{rel}: is closed to commerce because children reach it, yet is declared an "
                    "adult surface. Those two rulings cannot both be right."
                )

    # ---- PA6: the drawer follows the record --------------------------------
    errors.extend(check_drawer(root, overrides))
    return errors


def mutate(source: str, old: str, new: str, label: str) -> str:
    changed = source.replace(old, new, 1)
    if changed == source:
        raise SystemExit(f"positive-control fixture could not be created: {label}")
    return changed


def expect_failure(label: str, overrides: Mapping[str, str], expected: str,
                   baseline: set[str]) -> int:
    """One control, reported as a DELTA against the unmutated run.

    Against a red tree, "the mutated run reports X" proves nothing if the clean
    run already reported X. Where the two cannot be told apart the control says
    INCONCLUSIVE rather than claiming a pass it has not earned - the same shape
    the sibling suites settled on.
    """
    if any(expected.lower() in item.lower() for item in baseline):
        print(f"[INCONCLUSIVE] {label}: the tree already fails on {expected!r}")
        return 0
    added = [item for item in check_tree(ROOT, overrides) if item not in baseline]
    if not any(expected.lower() in item.lower() for item in added):
        print(f"[FAIL] positive control not detected: {label}")
        for item in added:
            print(" -", item)
        return 1
    print(f"[PASS] positive control: {label}")
    return 0


def self_test(baseline: set[str]) -> int:
    problems = 0
    ran = 0

    def control(label: str, overrides: Mapping[str, str], expected: str) -> None:
        nonlocal problems, ran
        ran += 1
        problems += expect_failure(label, overrides, expected, baseline)

    platform = read(ROOT, PLATFORM)
    record = read(ROOT, RECORD)
    privacy = read(ROOT, "privacy/index.html")
    arcade = read(ROOT, "games/index.html")

    # The two reds that matter: the mechanism reverting, and the tree and the
    # record drifting apart in either direction.
    control(
        "adultFeaturesAllowed reverted to the fail-open test",
        {PLATFORM: mutate(platform, "==='on'", "!=='off'", "fail-open revert")},
        "back to the fail-OPEN test",
    )
    control(
        "marker dropped from a declared adult surface",
        {"privacy/index.html": mutate(privacy, f' {MARKER}="on"', "", "marker removal")},
        "declared an adult surface but its body marker is None",
    )
    control(
        "marker grafted onto the arcade, which is not declared",
        {"games/index.html": mutate(arcade, f'{MARKER}="off"', f'{MARKER}="on"', "arcade graft")},
        'games/index.html: carries data-mbm-adult-features="on" but is not declared',
    )
    control(
        "page declared adult but never marked",
        {RECORD: mutate(record, '"adultSurfaces": [',
                        '"adultSurfaces": [\n    { "page": "stats/index.html", "reason": "control" },',
                        "undeclared-marker graft")},
        "stats/index.html: declared an adult surface but its body marker is None",
    )
    control(
        "a commerce surface dropped from the adult declaration",
        {RECORD: mutate(record, '"page": "tools/index.html"', '"page": "tools-was-here/index.html"',
                        "pill containment")},
        "tools/index.html: carries the Ko-fi support pill but is not a declared adult surface",
    )
    control(
        "a pupil-reachable surface declared adult",
        {RECORD: mutate(record, '"adultSurfaces": [',
                        '"adultSurfaces": [\n    { "page": "for/pupils/index.html", "reason": "control" },',
                        "forbidden containment")},
        "closed to commerce because children reach it, yet is declared an adult surface",
    )
    control(
        "adultFeaturesAllowed stops reading the marker at all",
        {PLATFORM: mutate(platform, f"doc.body.getAttribute('{MARKER}')==='on'", "true",
                          "mechanism removal")},
        f"adultFeaturesAllowed() no longer reads {MARKER}",
    )

    # PA6: the publisher's drawer against the record, in both directions, plus
    # the Privacy entry and the generated-page flag. Each mutation is to text the
    # publisher carries whether or not the drawer already follows the record.
    navigation = read(ROOT, NAV)
    control(
        "the publisher grants the full account list to a privacy-only surface",
        {NAV: mutate(navigation, "'/Lessons/subject.html', False)", "'/Lessons/subject.html', True)",
                     "subject.html adult graft")},
        "/Lessons/subject.html: the drawer renders the account and mailing entries",
    )
    control(
        "the publisher withholds the account list everywhere",
        {NAV: mutate(navigation, "account = ACCOUNT if adult else ACCOUNT_SHARED", "account = ACCOUNT_SHARED",
                     "account list withheld")},
        "declared adult in data/adult-surfaces.json but its drawer withholds",
    )
    control(
        "the Privacy entry dropped from the shared drawer",
        {NAV: mutate(navigation, "ACCOUNT_SHARED = [('/privacy/', 'Privacy and statistics')]", "ACCOUNT_SHARED = []",
                     "privacy entry removal")},
        "Privacy entries; every drawer keeps exactly one",
    )
    control(
        "a generated page declared that the publisher never renders",
        {RECORD: mutate(record, '"adultSurfaces": [',
                        '"adultSurfaces": [\n    { "page": "for/nobody/index.html", "reason": "control", "generated": "publication" },',
                        "generated graft")},
        "for/nobody/index.html: declared as generated at publication, but the publisher renders no such surface",
    )
    control(
        "the generated flag put on a page that is in the tree",
        {RECORD: mutate(record, '"page": "privacy/index.html"', '"page": "privacy/index.html", "generated": "publication"',
                        "generated flag on a source page")},
        "marks privacy/index.html as generated at publication, but it exists in this tree",
    )

    restored = set(check_tree(ROOT))
    if restored != baseline:
        print("[FAIL] the tree does not verify the same way after the controls")
        problems += 1
    else:
        print(f"[PASS] tree verifies identically after {ran} positive controls "
              f"({len(baseline)} baseline finding(s))")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    sys.path.insert(0, str(ROOT / "tools"))
    errors = check_tree(ROOT)
    for error in errors:
        print("  -", error)
    problems = self_test(set(errors)) if args.self_test else 0
    if errors or problems:
        print(f"[RED] {len(errors)} finding(s), {problems} control problem(s)")
        return 1
    print("[PASS] adult-affordance boundary is fail-closed and the tree matches the declaration")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
