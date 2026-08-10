#!/usr/bin/env python3
"""Guard the shared Made by Matt visual identity across audience surfaces.

Audience adaptation changes content priority, not brand quality. An adult
audience page is allowed to carry more explanation than the pupil page, but it
is not allowed to decay into a plain directory of text links, and no audience
surface may drift away from the shared brand treatment. Moving from the
discovery root to an audience page to a destination should read as one
platform.

The estate runs three presentation vocabularies - `mf-*` on the discovery root
and the seven audience homepages, `dx-*` on the main homepage, and `mbm-hub-*`
on the Education Hub. So the shared DNA is asserted on every surface, and the
`mf-*` specifics only on the pages that use that system.

The check that matters most is the duplicate-mark rule. The pupil homepage
once replaced the large hero M with game artwork plus a small brand mark, which
broke the visual relationship with the rest of the estate. That is easy to
reintroduce and hard to notice, so it is asserted directly.

Usage:
  python3 tools/verify_design_inheritance.py           # gate: exit 1 on failure
  python3 tools/verify_design_inheritance.py --report  # findings without failing
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIENCE_DATA = ROOT / "data" / "audience-homepages.json"
PROVENANCE = ROOT / "data" / "visual-provenance.json"

MICRO_MARK = "/assets/brand/micro_mark.svg"
HERO_MARK = "/assets/brand/hero_mark.svg"
CANONICAL_MARKS = {MICRO_MARK, HERO_MARK}

# The per-audience floors live in the audience-faces verifier, which already
# owns them. Importing rather than restating avoids the second-literal problem
# that made that verifier go stale in the first place.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_games_audience_faces import MIN_PROMOTED_VISUALS  # noqa: E402

IMG_SRC = re.compile(r'<img[^>]*\bsrc="([^"]+)"', re.I)
BRAND_LIKE = re.compile(r"(mark|logo|brand)", re.I)


class Findings:
    """Design drift and missing surfaces are both failures, but they are not
    the same problem: drift is fixed by editing a page, a missing surface is
    fixed by building it or by removing the links that point at it."""

    def __init__(self) -> None:
        self.failures: list[str] = []
        self.missing: list[str] = []
        self.notes: list[str] = []

    def fail(self, page: str, message: str) -> None:
        self.failures.append(f"{page}: {message}")

    def absent(self, route: str, referenced_by: int) -> None:
        self.missing.append(f"{route}: surface does not exist, but {referenced_by} link(s) in the estate point at it")

    def note(self, message: str) -> None:
        self.notes.append(message)


def body_of(markup: str) -> str:
    start = markup.find("<main")
    end = markup.find("</main>")
    return markup[start:end] if start != -1 and end != -1 else markup


def check_shared_dna(page: str, markup: str, findings: Findings) -> None:
    if "mbm-site-header" not in markup:
        findings.fail(page, "the shared site header is missing")

    header = markup[markup.find("<header"):markup.find("</header>") + 9]
    header_marks = IMG_SRC.findall(header)
    if MICRO_MARK not in header_marks:
        findings.fail(page, f"the header does not use the canonical mark {MICRO_MARK}")

    if HERO_MARK not in markup:
        findings.fail(page, f"the canonical hero mark {HERO_MARK} is not present")

    # A redrawn or re-exported mark is the quiet way brand consistency rots.
    for src in IMG_SRC.findall(markup):
        clean = src.split("?", 1)[0]
        if BRAND_LIKE.search(clean) and clean not in CANONICAL_MARKS:
            findings.fail(page, f"non-canonical brand mark: {src}")

    for src in IMG_SRC.findall(markup):
        clean = src.split("?", 1)[0]
        if clean.startswith("/") and not (ROOT / clean.lstrip("/")).is_file():
            findings.fail(page, f"image does not resolve to a real file: {src}")


def check_no_duplicate_mark_above_heading(page: str, markup: str, findings: Findings) -> None:
    """The named defect: a small brand mark standing in for the large hero M."""
    body = body_of(markup)
    heading = body.find("<h1")
    if heading == -1:
        findings.fail(page, "no <h1> found in <main>")
        return
    above = body[:heading]
    for src in IMG_SRC.findall(above):
        clean = src.split("?", 1)[0]
        if clean == MICRO_MARK:
            findings.fail(page, "a small duplicate brand mark sits above the page heading; the large hero mark belongs there")
        elif clean not in CANONICAL_MARKS and BRAND_LIKE.search(clean):
            findings.fail(page, f"a non-canonical mark sits above the page heading: {src}")


def check_audience_system(page: str, markup: str, findings: Findings) -> None:
    for token in ("mf-hero", "mf-hero-texture", "mf-mark-stage"):
        if token not in markup:
            findings.fail(page, f"shared hero component missing: .{token}")

    if 'class="mf-hero-mark"' not in markup:
        findings.fail(page, "the hero mark is not rendered with the shared .mf-hero-mark treatment")
    else:
        hero_img = re.search(r'<img class="mf-hero-mark"[^>]*>', markup)
        if hero_img and (HERO_MARK not in hero_img.group(0) or 'width="640"' not in hero_img.group(0)):
            findings.fail(page, "the hero mark is not the canonical 640x640 hero_mark.svg")

    # The cream content surface has to follow the navy hero, or the page is a
    # hero with nothing beneath it.
    hero_at = markup.find("mf-hero")
    surface = min(
        (markup.find(token) for token in ("mf-section", "mf-choices") if markup.find(token) > hero_at),
        default=-1
    )
    if surface == -1:
        findings.fail(page, "no cream content surface follows the navy hero")

    if 'class="mf-btn' not in markup:
        findings.fail(page, "the shared .mf-btn button language is not used")

    for match in re.finditer(r'<a[^>]*class="([^"]*\bbtn\b[^"]*)"', markup):
        classes = match.group(1)
        if "mf-btn" not in classes:
            findings.fail(page, f"page-local button reimplementation instead of .mf-btn: class=\"{classes}\"")


def genuine_previews(markup: str) -> list[str]:
    return [
        src for src in IMG_SRC.findall(markup)
        if src.split("?", 1)[0] not in CANONICAL_MARKS
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="print findings without failing")
    args = parser.parse_args()

    data = json.loads(AUDIENCE_DATA.read_text(encoding="utf-8"))
    provenance = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    recorded = {asset["path"] for asset in provenance["assets"]}

    findings = Findings()

    # Open items, printed on every run so a later reader sees the gaps rather
    # than inferring completeness from a green result. Each says which kind it
    # is, because "waiting on a ruling" and "waiting on someone to do it" decay
    # differently and a list that blurs them turns the second into the first.
    findings.note("BACKLOG 0 (content · ruling-pending): /resources/ is still the pre-closeout "
                  "catalogue; the closeout rewrite is unrecoverable")
    findings.note(
        "BACKLOG 0a: CLOSED 2026-08-09. 0a-A removed the baseline remap; 0a-B declared copy "
        "authorisation in data/copy-authorisation.json. verify_professional_site.js reports zero "
        "findings with all five controls passing - green for the first time since #110"
    )
    findings.note(
        "BACKLOG 0b (instrument · work-pending): deployment provenance is built but its live legs "
        "cannot run until the workflow is on main - a workflow_dispatch needs the default branch"
    )
    findings.note(
        "BACKLOG 0c (instrument · work-pending): the live gate's markers are derived and proven red "
        "locally; its readiness signal now comes from the provenance tool rather than a third "
        "signal of its own. Unproven against the real origin until merged"
    )
    findings.note(
        "BACKLOG 0e (content · ruling-pending): /main/ calls the estate offline-first and says "
        "nothing is uploaded, while the same page lists the optional services that do use the "
        "internet. Authored copy - recorded, not edited"
    )
    findings.note(
        "BACKLOG 0d (instrument · ruling-pending): verify_games_audience_faces.mjs is node --check'd "
        "and never executed - 550 lines of browser assertions that have never run, described as "
        "coverage in two docs. Confirmed stale on 2026-08-10 beyond the parts this pass touched: it "
        "asserts .mf-main-card carries the /main/ link, and that class has not been on the chooser "
        "since the discovery root replaced the card with a hero action. The homepage-choice count "
        "and route/label expectations were re-derived when /main/ became selectable, so the file "
        "does not encode a claim this pass made false - but that is repair of one assertion, not "
        "the ruling"
    )

    surfaces: list[tuple[str, Path, str]] = [
        ("/", ROOT / "index.html", "audience"),
        ("/main/", ROOT / "main" / "index.html", "shared"),
        ("/education-hub/", ROOT / "education-hub" / "index.html", "shared"),
        ("/teach/", ROOT / "teach" / "index.html", "shared"),
    ]
    for aid, audience in data["audiences"].items():
        surfaces.append((audience["route"], ROOT / audience["route"].strip("/") / "index.html", "audience"))

    def link_count(route: str) -> int:
        needle = f'href="{route}'
        return sum(
            page.read_text(encoding="utf-8", errors="replace").count(needle)
            for page in ROOT.glob("**/*.html")
            if ".git" not in page.parts
        )

    for route, path, system in surfaces:
        if not path.is_file():
            findings.absent(route, link_count(route))
            continue
        markup = path.read_text(encoding="utf-8")

        check_shared_dna(route, markup, findings)
        check_no_duplicate_mark_above_heading(route, markup, findings)
        if system == "audience":
            check_audience_system(route, markup, findings)

        for src in genuine_previews(markup):
            clean = src.split("?", 1)[0]
            if clean not in recorded:
                findings.fail(route, f"promoted image is not recorded in visual-provenance.json: {src}")

    # Per-audience accent and preview floor.
    for aid, audience in data["audiences"].items():
        route = audience["route"]
        path = ROOT / route.strip("/") / "index.html"
        if not path.is_file():
            continue
        markup = path.read_text(encoding="utf-8")

        if f'data-mbm-audience-face="{aid}"' not in markup:
            findings.fail(route, f'data-mbm-audience-face="{aid}" is missing')
        if f"--face-accent:{audience['accent']}" not in markup:
            findings.fail(route, f"--face-accent does not resolve to the ruled value {audience['accent']}")

        floor = MIN_PROMOTED_VISUALS[aid]
        previews = genuine_previews(markup)
        if len(previews) < floor:
            findings.fail(
                route,
                f"only {len(previews)} genuine visual preview(s); this audience needs at least "
                f"{floor} so the page cannot decay into a plain directory"
            )

    # The chooser's own purpose is the homepage-type options. They sat third,
    # below the hero and below a full "Explore the live platform" block, which
    # put them past the fold on a phone. Asserted by index rather than by
    # presence: presence was already true when the order was wrong.
    root_markup = (ROOT / "index.html").read_text(encoding="utf-8")
    order = [
        ("the hero", root_markup.find("mf-discovery-hero")),
        ("the homepage-type choices", root_markup.find('id="homepage-choices"')),
        ("the explore-the-platform block", root_markup.find("mf-main-option")),
    ]
    for (earlier, at), (later, then) in zip(order, order[1:]):
        if at == -1 or then == -1:
            findings.fail("/", f"cannot locate {earlier if at == -1 else later} on the chooser")
        elif at > then:
            findings.fail("/", f"{later} renders before {earlier}; the homepage-type options "
                               f"belong directly under the hero")

    checked = sum(1 for _, path, _ in surfaces if path.is_file())
    print(f"Design inheritance checked across {checked} surface(s).")
    for note in findings.notes:
        print(f"  note: {note}")

    if findings.failures:
        print("\nDesign inheritance failures:", file=sys.stderr)
        for failure in findings.failures:
            print(f"  - {failure}", file=sys.stderr)
    else:
        print("Design inheritance: every existing surface carries the shared header, the")
        print("canonical marks, the hero treatment and its own content surface.")

    if findings.missing:
        print("\nMissing surfaces:", file=sys.stderr)
        for absent in findings.missing:
            print(f"  - {absent}", file=sys.stderr)

    if (findings.failures or findings.missing) and not args.report:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
