#!/usr/bin/env python3
"""Static contract for the Games Hub and homepage/audience architecture.

Sentinel: mbm-homepage-audience-routing-2026-08-09
Zero third-party dependencies. The positive controls deliberately mutate each
load-bearing architecture/privacy contract and prove the verifier fails.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Mapping
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]

# The architecture sentinel is whatever the renderer stamps onto the pages it
# generates. Holding a second copy of it here is what made this verifier go
# stale: it kept asserting the pre-closeout sentinel long after the renderer
# had moved on, so all seven audience pages failed for a reason that was never
# about the pages.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_audience_homepages import SENTINEL  # noqa: E402

GAMES_SENTINEL = "mbm-games-audience-faces-2026-08-08"
FACES = {
    "pupils": "for/pupils/index.html",
    "teachers": "for/teachers/index.html",
    "parents": "for/parents-carers/index.html",
    "schools": "for/schools-semh/index.html",
    "trusts": "for/trusts/index.html",
    "councils": "for/councils-organisations/index.html",
    "partners": "for/partners/index.html",
}
# Public labels come from the same data file the renderer reads, so there is
# one place to change a label and no second copy to drift.
#
# HISTORICAL_LABELS are wordings that have appeared publicly at some point and
# should not come back by accident. A wording is only obsolete if it is not the
# current label, so relabelling can never make this list fire on itself.
HISTORICAL_LABELS = [
    "Teachers &amp; support staff",
    "Schools &amp; SEMH settings",
    "Academy trusts &amp; trusts",
    "Trusts &amp; multi-academy trusts",
    "Councils &amp; education organisations",
    "Partners &amp; businesses",
    "Partners &amp; collaborators",
]


def public_labels(config: Mapping[str, object]) -> dict[str, str]:
    audiences = config["audiences"]  # type: ignore[index]
    return {key: html.escape(value["label"], quote=False) for key, value in audiences.items()}  # type: ignore[index]


ROUTES = {key: "/" + path.removesuffix("index.html") for key, path in FACES.items()}
MAJOR_MAIN_ANCHORS = [
    'Learning that feels worth exploring.', 'id="audiences"', 'id="resources"',
    'id="newrelease"', 'id="homeSports"', 'id="collections"', 'id="seeit"',
    'id="improved"', 'id="mbmStats"', 'id="standard"', 'id="contact"', 'id="about"'
]
GAMES_COPY = [
    "A Made by Matt collection", "MATT'S <span>CURATED FAVS</span> HUB",
    "A personally selected showcase of the challenges that are truly infinite fun — skill, strategy and pure enjoyment, direct to you. Every game plays free in the browser: no installs, no accounts, no ads.",
    "Matt's personal top picks", "The eight I'd put in front of anyone first — and one line each on why.",
    "Watch them played", "Real gameplay — no scripted demo reel — captured on a phone or straight from the browser and hosted right here. Nothing loads until you press play, and nothing plays sound.",
    "Themed favourites", "Classroom favourites", "Built for my own classes and road-tested in front of them — the whole-class games my pupils actually ask for.",
    "The whole shelf", "Every game, A to Z — search and filters above work on this grid.",
    "I teach science and art in an alternative provision in the North East, and every file on this shelf started life in front of a real class."
]
# Per-audience floor on genuinely promoted visuals. These are deliberate
# editorial levels, not one blanket number: the pupil page leads with games, so
# it carries more, while a page whose job is orientation carries fewer. The
# design-inheritance verifier imports these rather than keeping its own copy.
MIN_PROMOTED_VISUALS = {"pupils": 5, "teachers": 4, "parents": 3, "schools": 3, "trusts": 3, "councils": 3, "partners": 4}
# Locked copy on the discovery root. These state what the audience preference
# is and is not, and they are the reason a visitor can trust the choice is
# local. They are asserted verbatim, not by keyword.
LOCKED_CHOOSER_COPY = [
    "This preference stays in this browser. It is not an account, profile, "
    "consent choice or tracking identifier, and it is not sent to Supabase, "
    "Buttondown or analytics.",
    "Choosing one does not create an account, change permissions or hide public content.",
]

EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")

# The discovery root's page-weight budget, in BYTES.
#
# It is a declared editorial budget, not a measured limit: the root is the first
# thing a visitor on a phone downloads, and 17 KiB is the ceiling that was ruled
# for it. It was quoted in prose for several passes while nothing enforced it,
# which is the shape this estate has already ruled against - a claim nothing
# tests is a doc asserting coverage that does not exist. So it is a gate, and
# every run prints the measured figure and the headroom whether it passes or not.
#
# Bytes, and read as bytes. The figure was twice reported from
# len(path.read_text()), which counts CHARACTERS: the root carries `\u00B7`, `\u2014` and
# other multi-byte UTF-8, so that undercounted by 43 B and read as more headroom
# than existed. Species 23.
ROOT_WEIGHT_CAP = 17408


def read(root: Path, rel: str, overrides: Mapping[str, str] | None = None) -> str:
    if overrides and rel in overrides:
        return overrides[rel]
    return (root / rel).read_text(encoding="utf-8")


def contains_href(source: str, href: str) -> bool:
    return bool(re.search(rf'href=["\']{re.escape(href)}["\']', source, re.I))


def canonical_of(source: str) -> str:
    match = re.search(r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*\bhref=["\']([^"\']+)', source, re.I)
    return match.group(1) if match else ""


def og_url_of(source: str) -> str:
    match = re.search(r'<meta\b(?=[^>]*\bproperty=["\']og:url["\'])[^>]*\bcontent=["\']([^"\']+)', source, re.I)
    return match.group(1) if match else ""


def extract_hero(source: str) -> str:
    match = re.search(r'<section\b[^>]*\bclass=["\'][^"\']*\bmf-hero\b[^"\']*["\'][^>]*>([\s\S]*?)</section>', source, re.I)
    return match.group(1) if match else ""


def local_path(href: str) -> Path | None:
    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
        return None
    clean = parsed.path.lstrip("/")
    if not clean:
        return ROOT / "index.html"
    direct = ROOT / clean
    if parsed.path.endswith("/"):
        return direct / "index.html"
    if direct.suffix:
        return direct
    return direct if direct.exists() else direct / "index.html"


def promoted_images(source: str) -> list[tuple[str, str, str]]:
    return [
        (attrs, src, alt)
        for attrs, src, alt in re.findall(
            r'<img\b([^>]*\bdata-mbm-real-visual\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*\balt=["\']([^"\']*)["\'][^>]*)>',
            source, re.I
        )
    ]


def check_main_audience_cards(main_html: str, config: Mapping[str, object]) -> list[str]:
    """/main/'s chooser cards are generated; assert nothing else looks like one.

    On 2026-08-09 /main/ served THIRTEEN cards in one role="list": the seven
    generated ones plus six legacy duplicates beginning one byte past the
    :END marker. They carried no description and no icon, and they were
    announced as list items alongside the real seven.

    Nothing caught it, and the reason is the species worth recording.
    spliced_main_page() replaces its marker region and passes everything
    outside it through verbatim, so --check compared the file against itself
    outside the region and was byte-exact green over six duplicates. A
    byte-exact check scoped to a delimited region cannot see a defect
    immediately outside the delimiter.

    So the region is not enough: the absence of the generated element kind
    OUTSIDE the region has to be asserted too. Values come from the data file
    that owns them - counting seven here would just be the second-literal trap
    in a new place.
    """
    from render_audience_homepages import CARDS_BEGIN, CARDS_END

    errors: list[str] = []
    audiences = config["audiences"]  # type: ignore[index]
    begin, end = main_html.find(CARDS_BEGIN), main_html.find(CARDS_END)
    if begin == -1 or end == -1 or end < begin:
        return ["main/index.html: the generated audience-card region is missing or inverted"]

    positions = [m.start() for m in re.finditer(r'<article class="mbm-audience-card"', main_html)]
    outside = [pos for pos in positions if not (begin < pos < end)]
    if outside:
        errors.append(
            f"main/index.html: {len(outside)} audience card(s) sit OUTSIDE the generated region "
            f"(first at byte {outside[0]}, region is {begin}-{end}); the grid must contain only "
            f"generated cards"
        )
    if len(positions) != len(audiences):
        errors.append(
            f"main/index.html: {len(positions)} audience card(s) for {len(audiences)} audiences"
        )

    region = main_html[begin:end]
    for index, (aid, audience) in enumerate(audiences.items(), start=1):  # type: ignore[union-attr]
        card = re.search(
            rf'<article class="mbm-audience-card" data-index="{index:02d}"[\s\S]*?</article>', region
        )
        if not card:
            errors.append(f"main/index.html: no generated card at data-index {index:02d} for {aid}")
            continue
        markup = card.group(0)
        if f'href="{audience["route"]}"' not in markup:  # type: ignore[index]
            errors.append(f"main/index.html: card {index:02d} does not link to {audience['route']}")
        if f'>{html.escape(audience["chooserLinkText"], quote=False)}</a>' not in markup:  # type: ignore[index]
            errors.append(
                f"main/index.html: card {index:02d} link text is not the declared "
                f"chooserLinkText {audience['chooserLinkText']!r}"
            )
    return errors


def check_tree(root: Path = ROOT, overrides: Mapping[str, str] | None = None) -> list[str]:
    errors: list[str] = []
    required = [
        "games/index.html", "index.html", "main/index.html", "start/index.html",
        "audience-sitemap.xml", "sitemap.xml", "robots.txt", "site.webmanifest",
        "site.json", "data/audience-homepages.json", "assets/mbm-games-hub.css",
        "assets/mbm-audience.css", "assets/mbm-audience.js", "assets/mbm-platform.js",
        "assets/mbm-doors.js",
        "tools/render_audience_homepages.py", *FACES.values()
    ]
    for rel in required:
        if overrides and rel in overrides:
            continue
        if not (root / rel).is_file():
            errors.append(f"missing required file: {rel}")
    if errors:
        return errors

    games = read(root, "games/index.html", overrides)
    if GAMES_SENTINEL not in games:
        errors.append("Games hub missing its existing release sentinel")
    if 'class="mbm-games-hub"' not in games:
        errors.append("Games hub missing professional body class")
    if '/assets/mbm-games-hub.css' not in games:
        errors.append("Games hub missing polish stylesheet")
    if 'g.art?' not in games or 'a moment from play' not in games:
        errors.append("top-picks renderer is not using manifest art")
    for phrase in GAMES_COPY:
        if phrase not in games:
            errors.append(f"existing Games wording changed or missing: {phrase[:72]}")
    if games.count('<svg class="mono" viewBox="0 0 100 100" aria-hidden="true">') != 2:
        errors.append("Games immutable logo markup is not present twice")

    config = json.loads(read(root, "data/audience-homepages.json", overrides))
    labels = public_labels(config)
    if config.get("sentinel") != SENTINEL:
        errors.append("audience content configuration sentinel missing")
    if config.get("preferenceKey") != "mbm_audience_view":
        errors.append("stable local audience preference key changed")
    if set(config.get("audiences", {})) != set(FACES):
        errors.append("audience content configuration does not contain exactly the seven stable IDs")

    chooser = read(root, "index.html", overrides)
    # Measured in bytes, from the same source the rest of this function reads,
    # so a control that mutates the chooser is weighed as the mutated chooser.
    root_bytes = len(chooser.encode("utf-8"))
    if root_bytes > ROOT_WEIGHT_CAP:
        errors.append(
            f"the discovery root is {root_bytes:,} B, over the {ROOT_WEIGHT_CAP:,} B page-weight "
            f"budget by {root_bytes - ROOT_WEIGHT_CAP:,} B"
        )
    if SENTINEL not in chooser:
        errors.append("root chooser missing architecture sentinel")
    if not re.search(r'<h([12])\b[^>]*>Choose your own homepage type</h\1>', chooser):
        errors.append("root chooser is missing the mandated 'Choose your own homepage type' heading")
    chooser_hero = extract_hero(chooser)
    if '/assets/brand/hero_mark.svg' not in chooser_hero:
        errors.append("root chooser hero does not use the official Made by Matt mark")
    if not re.search(r'<img\b[^>]*\bmf-hero-mark\b[^>]*\balt=["\']["\']', chooser_hero, re.I):
        errors.append("root chooser hero mark is not decorative beside the named Made by Matt content")
    if canonical_of(chooser) != "https://madebymatt.uk/":
        errors.append("root chooser canonical is not https://madebymatt.uk/")
    if og_url_of(chooser) != "https://madebymatt.uk/":
        errors.append("root chooser OpenGraph URL is not https://madebymatt.uk/")
    # The chooser offers the seven audiences AND the platform option, so the
    # expected count is derived from the data rather than typed. It was typed
    # once - as 7 - and adding the eighth homepage type would have failed here
    # for a reason that was never about the page.
    main_option = config.get("mainOption") or {}
    expected_choices = len(config.get("audiences", {})) + (1 if main_option else 0)
    if chooser.count('data-mbm-face-choice=') != expected_choices:
        errors.append(
            f"root chooser exposes {chooser.count('data-mbm-face-choice=')} homepage choice(s); "
            f"the data declares {len(config.get('audiences', {}))} audience(s) plus the platform option"
        )
    # The platform option is a homepage type, so it is a card like the others -
    # same shape, same stored value, its own accent and glyph. Asserted from
    # the record, never from a second copy of its wording.
    if not main_option:
        errors.append("data/audience-homepages.json declares no mainOption; /main/ cannot be chosen")
    else:
        card = re.search(
            rf'<a class="mf-choice" data-mbm-face-choice="{re.escape(main_option["id"])}"[\s\S]*?</a>',
            chooser
        )
        if not card:
            errors.append("root chooser offers no platform-option card; /main/ is not selectable")
        else:
            markup = card.group(0)
            for label, needle in (
                ("route", f'href="{main_option["route"]}"'),
                ("label", f'data-mbm-face-label="{html.escape(main_option["label"], quote=True)}"'),
                ("accent", f'--choice-accent:{main_option["accent"]}'),
                ("soft", f'--choice-soft:{main_option["soft"]}'),
                ("description", f'<small>{html.escape(main_option["chooserDescription"], quote=False)}</small>'),
            ):
                if needle not in markup:
                    errors.append(f"root chooser platform card does not carry the declared {label}: {needle}")
            # Position, derived rather than asserted by eye: the platform option
            # is the foot of the chooser. Above the audience groups it would
            # read as the recommended answer on a page whose purpose is to
            # offer audience front doors; below the continue box it would sit
            # outside the choices altogether.
            last_group = config["groups"][-1]["id"]  # type: ignore[index]
            after = chooser.find(f'data-mbm-audience-group="{last_group}"')
            at = chooser.find('data-mbm-face-choice="%s"' % main_option["id"])
            before = chooser.find("mf-continue")
            if not (after < at < before) or -1 in (after, at, before):
                errors.append(
                    f"root chooser platform card is out of position (last group at {after}, card at {at}, "
                    f"continue box at {before}); it belongs at the foot of the choices"
                )
            # Whether that accent, soft and glyph are distinct from the seven is
            # settled by validate() in the renderer, which rejects a collision
            # by name and has a control for each. Restating it here would be a
            # second implementation of the same rule, which is how the two go
            # out of step.
    # The main homepage has to stay a distinct, prominent route from the root,
    # so a visitor is never funnelled into an audience view. The discovery root
    # carries it as the primary hero action; the earlier chooser carried it as
    # a dedicated card. Either satisfies the requirement - what matters is that
    # it is a first-class call to action, not a nav afterthought.
    main_card = re.search(r'<a\b[^>]*\bclass=["\'][^"\']*\bmf-main-card\b[^"\']*["\'][^>]*\bhref=["\']/main/["\']', chooser, re.I)
    main_cta = re.search(r'<a\b[^>]*\bclass=["\'][^"\']*\bmf-btn primary\b[^"\']*["\'][^>]*\bhref=["\']/main/["\']', chooser, re.I)
    if not (main_card or main_cta):
        errors.append("root chooser does not expose the separate Main Made by Matt homepage")
    if 'id="group-people"' not in chooser or 'id="group-organisations"' not in chooser:
        errors.append("root chooser does not clearly group people and organisations")
    for key, route in ROUTES.items():
        if chooser.count(f'href="{route}"') != 1:
            errors.append(f"root chooser must link exactly once to {route}")
        if labels[key] not in chooser:
            errors.append(f"root chooser missing final public label: {labels[key]}")
    for phrase in ["localStorage", "Supabase", "Buttondown", "analytics", "does not create an account", "not an account"]:
        if phrase not in chooser and phrase not in read(root, "assets/mbm-audience.js", overrides):
            errors.append(f"chooser local-preference explanation missing: {phrase}")

    # Locked copy. The closeout dropped both of these once already, and the
    # loop above could not catch it: it passes if the word appears anywhere in
    # the chooser OR in the audience script, so "Supabase" surviving in a code
    # comment would have masked the sentence disappearing from the page. These
    # assert the sentences themselves, on the page, verbatim.
    for sentence in LOCKED_CHOOSER_COPY:
        if sentence not in chooser:
            errors.append(f"locked chooser copy missing or altered: {sentence[:60]}…")

    main = read(root, "main/index.html", overrides)
    errors.extend(check_main_audience_cards(main, config))
    # THE WRITE ASYMMETRY, half one. Choosing /main/ stores the preference;
    # arriving at /main/ must not. /main/ is the brand link's default, a nav
    # item on every surface, the footer link and the hero call to action, so a
    # visitor lands there constantly without having chosen it - and the script
    # writes the preference for whatever data-mbm-audience-face the body
    # declares. If this page ever declared one, the first accidental visit
    # would overwrite a deliberate choice, and the chooser would report it back
    # as "last used on this device". The other half - the guard in the script -
    # is asserted below, because an invariant that rests on a hand-maintained
    # page continuing not to have an attribute is not an invariant.
    if re.search(r'\bdata-mbm-audience-face=', main):
        errors.append("/main/ declares data-mbm-audience-face; landing on the platform homepage would "
                      "overwrite the visitor's chosen homepage")
    if canonical_of(main) != "https://madebymatt.uk/main/":
        errors.append("/main/ canonical is wrong")
    if og_url_of(main) != "https://madebymatt.uk/main/":
        errors.append("/main/ OpenGraph URL is wrong")
    for anchor in MAJOR_MAIN_ANCHORS:
        if anchor not in main:
            errors.append(f"/main/ lost preserved full-homepage anchor: {anchor}")
    for match in re.finditer(r'\b(?:href|src|action|poster)=["\']([^"\']+)["\']', main, re.I):
        value = match.group(1)
        if value and not value.startswith(("/", "#", "http:", "https:", "mailto:", "tel:", "data:")):
            errors.append(f"/main/ retains a page-relative URL that would resolve under /main/: {value}")
    if not contains_href(main, "/") or "Choose homepage" not in main:
        errors.append("/main/ does not expose Choose homepage")
    if not re.search(r'<a\b[^>]*\bclass=["\'][^"\']*\bbrand\b[^"\']*["\'][^>]*\bhref=["\']/main/["\']', main, re.I):
        errors.append("/main/ header brand does not lead to /main/")
    for key, route in ROUTES.items():
        if not contains_href(main, route):
            errors.append(f"/main/ audience section missing {route}")
        if labels[key] not in main:
            errors.append(f"/main/ audience section missing final label: {labels[key]}")

    start = read(root, "start/index.html", overrides)
    if canonical_of(start) != "https://madebymatt.uk/":
        errors.append("legacy /start/ does not canonicalise to root")
    if not re.search(r'<meta\b[^>]*name=["\']robots["\'][^>]*content=["\']noindex,follow["\']', start, re.I):
        errors.append("legacy /start/ is not noindex,follow")
    if not re.search(r'http-equiv=["\']refresh["\'][^>]*content=["\']0;\s*url=/', start, re.I):
        errors.append("legacy /start/ lacks a non-JavaScript compatibility redirect")
    if not contains_href(start, "/") or not contains_href(start, "/main/"):
        errors.append("legacy /start/ lacks usable fallback links")

    for key, rel in FACES.items():
        page = read(root, rel, overrides)
        expected_canonical = "https://madebymatt.uk" + ROUTES[key]
        if SENTINEL not in page:
            errors.append(f"{key}: architecture sentinel missing")
        if f'data-mbm-audience-face="{key}"' not in page:
            errors.append(f"{key}: stable audience identifier missing")
        if canonical_of(page) != expected_canonical:
            errors.append(f"{key}: audience canonical is wrong")
        if og_url_of(page) != expected_canonical:
            errors.append(f"{key}: audience OpenGraph URL is wrong")
        hero = extract_hero(page)
        if '/assets/brand/hero_mark.svg' not in hero or 'mf-hero-mark' not in hero:
            errors.append(f"{key}: official mark is not the primary hero identity")
        if not re.search(r'<img\b[^>]*\bmf-hero-mark\b[^>]*\balt=["\']["\']', hero, re.I):
            errors.append(f"{key}: repeated hero mark is not decorative beside the named audience heading")
        hero_without_svg = re.sub(r'<svg\b[\s\S]*?</svg>', '', hero, flags=re.I)
        if EMOJI_RE.search(hero_without_svg):
            errors.append(f"{key}: hero relies on emoji decoration")
        if not contains_href(page, "/main/"):
            errors.append(f"{key}: Main homepage link missing")
        if not contains_href(page, "/"):
            errors.append(f"{key}: Choose homepage link missing")
        if labels[key] not in page:
            errors.append(f"{key}: final public label missing")
        images = promoted_images(page)
        if len(images) < MIN_PROMOTED_VISUALS[key]:
            errors.append(f"{key}: real visual floor not met ({len(images)} < {MIN_PROMOTED_VISUALS[key]})")
        for attrs, src, alt in images:
            if not alt.strip():
                errors.append(f"{key}: informative promoted image has empty alt text: {src}")
            if 'loading="lazy"' not in attrs and "loading='lazy'" not in attrs:
                errors.append(f"{key}: below-fold promoted image is not lazy loaded: {src}")
            path = local_path(src)
            if path is None or not path.is_file():
                errors.append(f"{key}: promoted image path is broken: {src}")
        if '<h1' not in page or page.count('<h1') != 1:
            errors.append(f"{key}: page must have exactly one H1")

    pupil = read(root, FACES["pupils"], overrides)
    if 'data-mbm-adult-features="off"' not in pupil:
        errors.append("pupil page does not disable adult feature injection")
    pupil_nav = re.search(r'<nav\b[\s\S]*?</nav>', pupil, re.I)
    nav_source = pupil_nav.group(0) if pupil_nav else ""
    for forbidden in ["/account/", "/members/", "/mailing-list/", "mailto:"]:
        if forbidden in nav_source:
            errors.append(f"pupil primary navigation exposes adult destination: {forbidden}")
    if "/account/" in pupil or "/members/" in pupil or "/mailing-list/" in pupil or "mailto:" in pupil:
        errors.append("pupil homepage contains a prominent adult account, Members, mailing or email route")
    if pupil.count('data-feature-id="apex-kick"') < 1 or pupil.count('data-feature-id="voxel-frontier"') < 1 or pupil.count('data-feature-id="lesson-hub"') < 1:
        errors.append("pupil page lacks the required real game and learning features")

    for key in ["teachers", "parents", "schools", "trusts", "councils", "partners"]:
        page = read(root, FACES[key], overrides)
        for route in ["/account/", "/members/", "/mailing-list/", "/privacy/"]:
            if not contains_href(page, route):
                errors.append(f"{key}: appropriate optional adult route missing: {route}")

    audience_css = read(root, "assets/mbm-audience.css", overrides)
    for token in ["--mf-navy", "--mf-cream", "--mf-amber", "--mf-mint", "mf-hero-texture", "data-mbm-adult-features", "prefers-reduced-motion", "max-width:350px", "focus-visible"]:
        if token not in audience_css:
            errors.append(f"shared audience visual/accessibility contract missing: {token}")
    if audience_css.count("data:image/svg+xml") < 1:
        errors.append("shared hero lacks the detailed local line-art texture")

    audience_js = read(root, "assets/mbm-audience.js", overrides)
    # The brand resolver holds the routes as a literal because a static asset
    # cannot read the JSON at build time. That is a known liability, so
    # equality with the data file is asserted rather than assumed - a second
    # copy is only tolerable when it cannot drift silently.
    #
    # Extracted from the named object, not by pattern. The previous form matched
    # `(\w+):'(/for/[a-z-]+/)'` anywhere in the file, which meant it could only
    # ever see routes under /for/: adding main:'/main/' would have been invisible
    # to it, and the drift check would have gone on comparing seven against seven
    # and reporting agreement about a list it was not reading. A signal that
    # cannot see the change it is meant to police is not a check.
    routes_literal = re.search(r"var ROUTES=\{([^}]*)\};", audience_js)
    js_routes = dict(re.findall(r"(\w+):'([^']+)'", routes_literal.group(1))) if routes_literal else {}
    if not routes_literal:
        errors.append("assets/mbm-audience.js no longer declares a ROUTES table to compare against the data")
    data_routes = {aid: a["route"] for aid, a in config["audiences"].items()}  # type: ignore[union-attr]
    if main_option:
        data_routes[main_option["id"]] = main_option["route"]
    # One list, not two. read() and write() used to gate on a separate `allowed`
    # object holding the same key set, so a homepage type could become routable
    # without becoming storable, or the reverse. They gate on ROUTES now, and
    # that is asserted at the definition sites rather than assumed.
    for name in ("read", "write"):
        if not re.search(rf"function {name}\(\w*\)\{{[^}}]*ROUTES\[", audience_js):
            errors.append(f"assets/mbm-audience.js {name}() no longer gates the stored preference on ROUTES; "
                          f"the allow-list and the route table must stay one list")
    if js_routes != data_routes:
        only_js = {k: v for k, v in js_routes.items() if data_routes.get(k) != v}
        only_data = {k: v for k, v in data_routes.items() if js_routes.get(k) != v}
        errors.append(
            f"assets/mbm-audience.js ROUTES have drifted from data/audience-homepages.json: "
            f"js={only_js} data={only_data}"
        )
    # Anchored to the call sites. A substring test accepts a.brandX and
    # data-mbm-adult-featuresX - species 19, which this check reproduced on its
    # first draft minutes after the species was written down.
    if not re.search(r"querySelectorAll\('a\.brand'\)", audience_js):
        errors.append("assets/mbm-audience.js no longer selects the brand link to resolve it")
    if not re.search(r"getAttribute\('data-mbm-adult-features'\)", audience_js):
        errors.append("assets/mbm-audience.js no longer consults the pupil adult-feature flag "
                      "when resolving the brand link")

    # THE WRITE ASYMMETRY, half two: the guard in the script itself.
    if main_option:
        exception = re.search(r"var LANDING_EXCEPTION='([^']*)';", audience_js)
        if not exception or exception.group(1) != main_option["id"]:
            errors.append(
                f"assets/mbm-audience.js does not name {main_option['id']!r} as the homepage type that "
                f"landing may not assert; got {exception.group(1) if exception else 'no declaration'!r}"
            )
        if not re.search(r"if\(face&&face!==LANDING_EXCEPTION\)write\(face\);", audience_js):
            errors.append("assets/mbm-audience.js writes the preference on landing without excluding the "
                          "platform homepage; an accidental visit would overwrite a deliberate choice")
    # And the other side of it: choosing a card records the choice. Anchored to
    # the definition site and to the wiring, because a name that appears only in
    # a comment or only at a call site proves nothing about either.
    if not re.search(r"function recordChoice\(\w*\)\{", audience_js):
        errors.append("assets/mbm-audience.js no longer records a homepage choice when a card is chosen")
    if not re.search(r"addEventListener\('click',function\(\)\{recordChoice\(", audience_js):
        errors.append("assets/mbm-audience.js defines recordChoice but never wires it to a choice card")

    if "mbm_audience_view" not in audience_js or "localStorage" not in audience_js:
        errors.append("local audience preference implementation missing")
    if re.search(r'location\s*\.(?:href|replace|assign)|window\.location\s*=', audience_js):
        errors.append("root audience preference script must not auto-redirect visitors")
    if re.search(r'\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(', audience_js):
        errors.append("local audience preference script attempts a network request")

    platform_js = read(root, "assets/mbm-platform.js", overrides)
    # Anchored to the definition site. A bare substring is defeated two ways:
    # renaming the function to adultFeaturesAllowedGone still contains the name,
    # and so does every call site - which is how the sibling check on
    # reflectMailingFooter passed twice while broken.
    if not re.search(r"function\s+adultFeaturesAllowed\s*\(", platform_js) \
            or "data-mbm-adult-features" not in platform_js:
        errors.append("platform JavaScript does not enforce the pupil adult-feature boundary")
    # 2026-08-09: the chooser may carry mailing and support as quiet text links
    # in the studio band. That is a product decision, so the vague "restrained"
    # assertion is replaced by five precise ones rather than relaxed. The
    # mechanism itself must survive - the pupil boundary depends on the same
    # adultFeaturesAllowed() condition.
    # A substring test would accept reflectMailingFooterGone(); the control that
    # renamed the function caught exactly that. Match the token, not the text.
    if not re.search(r"function\s+reflectMailingFooter\s*\(", platform_js) or "data-mbm-mailing-footer" not in platform_js:
        errors.append("platform JavaScript no longer carries the reflectMailingFooter mechanism")
    mechanism = re.search(r"function reflectMailingFooter\([\s\S]{0,400}", platform_js)
    if not mechanism or "adultFeaturesAllowed()" not in mechanism.group(0):
        errors.append("reflectMailingFooter no longer gates on adultFeaturesAllowed(); the pupil boundary depends on it")

    band = re.search(r'<section class="mf-section mf-studio-band"[\s\S]*?</section>', chooser)
    if not band:
        errors.append("root chooser is missing the studio band")
    else:
        band_html = band.group(0)
        # 1. mailing and support appear only as text links, never as buttons.
        if re.search(r'class="[^"]*\bmf-btn\b', band_html):
            errors.append("studio band uses a button treatment; mailing and support are text links")
        # 2. no account or member route on the chooser at all.
        for route in ("/account/", "/members/"):
            if contains_href(chooser, route):
                errors.append(f"root chooser exposes {route}; the chooser carries no account route at all")
        # 3. no price, tier or donate card.
        if re.search(r"[£$€]\s?\d|\bdonate\b|\btier\b|\bper month\b", band_html, re.I):
            errors.append("studio band names a price, tier or donation amount")
        # 4. a Ko-fi widget or script would put a third-party request on the front door.
        if re.search(r"<script|<iframe|ko-fi\.com/[^\"']*widget", band_html, re.I):
            errors.append("studio band embeds a widget or script; the support link must be a plain anchor")
        # 5. the band sits after the audience section, never above it.
        if chooser.find('id="homepage-choices"') > chooser.find('mf-studio-band'):
            errors.append("studio band sits above the audience section; it belongs after it")

    site = json.loads(read(root, "site.json", overrides))
    for door in site.get("doors", []):
        href = str(door.get("href", ""))
        if href.startswith("/") or re.match(r"^(?:https?:)?//", href, re.I):
            errors.append(f"site.json door no longer preserves the measured repository-relative convention: {href}")
    doors_js = read(root, "assets/mbm-doors.js", overrides)
    if 'a.setAttribute("href", rootPath(door.href))' not in doors_js or 'im.setAttribute("src", rootPath(door.image))' not in doors_js:
        errors.append("door renderer does not root-normalise repository-relative links and images for /main/")

    sitemap = read(root, "audience-sitemap.xml", overrides)
    for route in ["/", "/main/", *ROUTES.values()]:
        url = "https://madebymatt.uk" + route
        if url not in sitemap:
            errors.append(f"audience sitemap missing {url}")
    if "https://madebymatt.uk/start/" in sitemap:
        errors.append("legacy /start/ competes in the audience sitemap")
    if "Sitemap: https://madebymatt.uk/audience-sitemap.xml" not in read(root, "robots.txt", overrides):
        errors.append("robots.txt does not expose audience sitemap")
    if "https://madebymatt.uk/main/" not in read(root, "sitemap.xml", overrides):
        errors.append("main sitemap missing /main/")

    manifest = json.loads(read(root, "site.webmanifest", overrides))
    if manifest.get("start_url") != "/":
        errors.append("PWA start_url must remain the chooser at root")
    shortcut_urls = {item.get("url") for item in manifest.get("shortcuts", [])}
    if not {"/", "/main/"}.issubset(shortcut_urls):
        errors.append("PWA shortcuts do not distinguish Choose and Main homepage")

    joined = "\n".join(read(root, rel, overrides) for rel in ["index.html", *FACES.values()])
    current = set(labels.values())
    for old in [item for item in HISTORICAL_LABELS if item not in current]:
        if old in joined:
            errors.append(f"obsolete public audience label remains: {old}")
    lowered = joined.lower()
    for phrase in ["our council partner", "our trust partner", "trusted by schools", "accredited by", "used by thousands", "award-winning", "transforming education at scale"]:
        if phrase in lowered:
            errors.append(f"unsupported professional claim detected: {phrase}")

    # Old-root fragments are now wrong everywhere outside the intentionally held /next/ previews.
    if root == ROOT and not overrides:
        for path in root.rglob("*.html"):
            if any(part in {".git", "_staging", "audit-output", "next"} for part in path.parts):
                continue
            source = path.read_text(encoding="utf-8", errors="ignore")
            if re.search(r'href=["\']/#', source):
                errors.append(f"old full-home fragment remains outside /main/: {path.relative_to(root)}")

    for rel in ["games/index.html", "tools/index.html", "resources/index.html", "account/index.html", "members/index.html", "mailing-list/index.html", "privacy/index.html", "stats/index.html"]:
        page = read(root, rel, overrides)
        if not re.search(r'<a\b[^>]*\bclass=["\'][^"\']*\bbrand\b[^"\']*["\'][^>]*\bhref=["\']/main/["\']', page, re.I):
            errors.append(f"{rel}: header brand does not lead to /main/")
        if not contains_href(page, "/") or "Choose homepage" not in page:
            errors.append(f"{rel}: general navigation lacks Choose homepage")

    errors.extend(check_support_pill(root, overrides))

    return errors


# The pages that carry the Ko-fi support pill, and the pages that must never.
#
# PILL_PAGES is stated rather than derived, because "which surfaces may carry
# commerce" is an editorial ruling and not a property of the tree. Deriving it
# from "every adult page" would silently enrol the next adult page somebody
# adds, which is exactly the decision that should require a human.
#
# /resources/ is in neither list on purpose. It carries a pill that predates
# this pass, and it is reachable by pupils through the pupil homepage's no-JS
# search fallback (action="/resources/"). Listing it as required would ratify a
# placement nobody ruled on; listing it as forbidden would fail the tree for a
# state this pass did not create. It is recorded in the report instead.
PILL_PAGES = [
    "main/index.html",
    "teach/index.html",
    "tools/index.html",
    "education-hub/index.html",
    "for/teachers/index.html",
    "for/parents-carers/index.html",
    "for/schools-semh/index.html",
    "for/trusts/index.html",
    "for/councils-organisations/index.html",
    "for/partners/index.html",
]
# Zero Ko-fi, zero commerce. The pupil homepage carries
# data-mbm-adult-features="off"; the chooser is mixed-audience and carries only
# the studio band's quiet text link, which is ruled by studioBand and asserted
# above, not here.
PILL_FORBIDDEN = ["for/pupils/index.html"]


def check_support_pill(root: Path = ROOT, overrides: Mapping[str, str] | None = None) -> list[str]:
    """The support pill is present where it was ruled, and absent where it was not.

    Every literal is read from data/support-pill.json, the same record the two
    renderers build from. Re-typing the href here would let the record and the
    gate drift apart and still both look green - which is the failure mode this
    file has already been repaired for once.
    """
    errors: list[str] = []
    pill = json.loads(read(root, "data/support-pill.json", overrides))
    href, label = str(pill["href"]), str(pill["label"])
    anchor = re.compile(
        r'<a\b[^>]*\bhref=["\']' + re.escape(href) + r'["\'][^>]*>' + re.escape(label) + r"</a>"
    )

    for rel in PILL_PAGES:
        page = read(root, rel, overrides)
        containers = page.count(f'<div class="{pill["containerClass"]}"')
        if containers != 1:
            errors.append(f"{rel}: carries {containers} support pill(s); every adult page carries exactly one")
            continue
        found = anchor.search(page)
        if not found:
            errors.append(f"{rel}: support pill does not carry the declared Ko-fi href and label verbatim")
            continue
        tag = found.group(0)
        # A new tab the visitor was not told about, or one opened without
        # noopener, is the defect - not a style preference.
        for attr, why in [
            ('rel="noopener noreferrer"', "rel=\"noopener noreferrer\""),
            ('target="_blank"', 'target="_blank"'),
            (f'aria-label="{pill["ariaLabel"]}"', "the declared aria-label"),
            ("min-height:44px", "a 44px minimum touch target"),
        ]:
            if attr not in tag:
                errors.append(f"{rel}: support pill is missing {why}")
        # B7: no off-origin request may fire at page load. A plain anchor
        # fires nothing until it is clicked; a widget, script or iframe does.
        if re.search(r"<script[^>]*ko-?fi|<iframe[^>]*ko-?fi|ko-fi\.com/[^\"']*widget", page, re.I):
            errors.append(f"{rel}: embeds a Ko-fi widget, script or iframe; the pill must be a plain anchor")
        # The print rule the estate already owns keys off the container class
        # and off .footer, and both only reach it inside the footer.
        footer_at = page.find("<footer")
        if footer_at < 0 or page.find(f'<div class="{pill["containerClass"]}"') < footer_at:
            errors.append(f"{rel}: support pill sits outside the footer, where the print rule does not reach it")

    for rel in PILL_FORBIDDEN:
        page = read(root, rel, overrides)
        hits = len(re.findall(r"ko-?fi\.com", page, re.I))
        if hits:
            errors.append(f"{rel}: carries {hits} Ko-fi reference(s); this surface must carry none")

    return errors


def card_markup(chooser: str, main_option: Mapping[str, object]) -> str:
    """The platform card as it stands in the page, for controls that move it."""
    found = re.search(
        rf'<a class="mf-choice" data-mbm-face-choice="{re.escape(str(main_option["id"]))}"[\s\S]*?</a>', chooser
    )
    if not found:
        raise SystemExit("positive-control fixture could not be created: platform card")
    return found.group(0)


def mutate(source: str, old: str, new: str, label: str) -> str:
    changed = source.replace(old, new, 1)
    if changed == source:
        raise SystemExit(f"positive-control fixture could not be created: {label}")
    return changed


def expect_failure(label: str, overrides: Mapping[str, str], expected: str,
                   baseline: set[str] | None = None) -> int:
    """Run one control and report it. Returns 1 if the control is a problem.

    Two things this deliberately does not do any more. It does not stop the
    suite on a failure - a control that stops its siblings hides how much of
    the instrument still works. And it does not compare against zero: with a
    red tree, "the mutated run reports X" proves nothing if the unmutated run
    already reported X, so the comparison is a delta, and a signal already
    present in the baseline is reported INCONCLUSIVE rather than passed.
    """
    baseline = set() if baseline is None else baseline
    if any(expected.lower() in item.lower() for item in baseline):
        print(f"[INCONCLUSIVE] {label}: the tree already fails on {expected!r}, so this "
              f"mutation cannot be told apart from that pre-existing failure")
        return 0
    added = [item for item in check_tree(ROOT, overrides) if item not in baseline]
    if not any(expected.lower() in item.lower() for item in added):
        print(f"[FAIL] positive control not detected: {label}")
        for item in added:
            print(" -", item)
        return 1
    print(f"[PASS] positive control: {label}")
    return 0


def self_test(baseline: set[str] | None = None) -> int:
    baseline = set() if baseline is None else baseline
    problems = 0
    controls_run = 0

    def control(label, overrides, expected):
        nonlocal problems, controls_run
        controls_run += 1
        problems += expect_failure(label, overrides, expected, baseline)

    chooser = read(ROOT, "index.html")
    pupils = read(ROOT, FACES["pupils"])
    teachers = read(ROOT, FACES["teachers"])
    js = read(ROOT, "assets/mbm-audience.js")
    control("removed /main/ chooser link", {"index.html": mutate(chooser, '<a class="mf-btn primary" href="/main/">', '<a class="mf-btn primary" href="/main-missing/">', "main link")}, "does not expose the separate Main")
    control("changed chooser heading", {"index.html": mutate(chooser, '>Choose your own homepage type</h2>', '>Choose a homepage</h2>', "chooser heading")}, "missing the mandated 'Choose your own homepage type' heading")
    control("wrong audience canonical", {FACES["teachers"]: mutate(teachers, '<link rel="canonical" href="https://madebymatt.uk/for/teachers/">', '<link rel="canonical" href="https://madebymatt.uk/for/teacher-broken/">', "canonical")}, "canonical is wrong")
    control("broken promoted image", {FACES["teachers"]: mutate(teachers, "/images/lesson-hub-card.webp", "/images/not-real.webp", "image")}, "promoted image path is broken")
    pupil_nav = mutate(pupils, '<div class="mbm-nav-panel">', '<div class="mbm-nav-panel"><a href="/account/">Account</a>', "pupil adult link")
    control("adult link inserted into pupil navigation", {FACES["pupils"]: pupil_nav}, "pupil primary navigation exposes adult")
    network_js = mutate(js, "function init(){", "function init(){fetch('/preference-leak');", "network request")
    control("local preference network request", {"assets/mbm-audience.js": network_js}, "attempts a network request")
    # Derive the label to replace. Re-typing it here is the trap this file
    # was already fixed for once.
    current_trust_label = public_labels(json.loads(read(ROOT, "data/audience-homepages.json")))["trusts"]
    old_label = mutate(chooser, current_trust_label, "Academy trusts &amp; trusts", "old label")
    control("reverted obsolete audience label", {"index.html": old_label}, "obsolete public audience label remains")

    # /main/ as a selectable homepage type. Each of these breaks one claim the
    # feature rests on, and each is here because the claim is otherwise only
    # asserted by a green run - which says nothing about whether the assertion
    # can fail.
    config = json.loads(read(ROOT, "data/audience-homepages.json"))
    main_option = config["mainOption"]
    main_page = read(ROOT, "main/index.html")
    control("platform option removed from the chooser",
            {"index.html": chooser.replace(card_markup(chooser, main_option), "", 1)},
            "offers no platform-option card")
    # The page-weight budget. Padded with a comment rather than real content so
    # the control tests the weighing and nothing else: any other assertion in
    # check_tree sees a chooser identical to the committed one apart from bytes
    # it ignores.
    over_budget = chooser.replace(
        "</body>", "<!--" + "w" * (ROOT_WEIGHT_CAP - len(chooser.encode("utf-8")) + 1) + "--></body>", 1
    )
    control("discovery root pushed one byte over the page-weight budget",
            {"index.html": over_budget}, "over the")

    hoisted = chooser.replace(card_markup(chooser, main_option), "", 1)
    hoisted = hoisted.replace('<section class="mf-choice-group"', card_markup(chooser, main_option) + '<section class="mf-choice-group"', 1)
    control("platform option hoisted above the audience groups", {"index.html": hoisted},
            "platform card is out of position")
    control("platform route dropped from the script's route table",
            {"assets/mbm-audience.js": mutate(js, ",main:'/main/'}", "}", "js route table")},
            "have drifted from data/audience-homepages.json")
    control("landing on /main/ made to assert a homepage face",
            {"main/index.html": mutate(main_page, '<body data-mbm-general-home="main">',
                                       '<body data-mbm-general-home="main" data-mbm-audience-face="main">',
                                       "main landing face")},
            "landing on the platform homepage would overwrite")
    control("landing guard removed from the script",
            {"assets/mbm-audience.js": mutate(js, "if(face&&face!==LANDING_EXCEPTION)write(face);",
                                              "if(face)write(face);", "landing guard")},
            "writes the preference on landing without excluding")
    control("choice recorder left unwired",
            {"assets/mbm-audience.js": mutate(js, "card.addEventListener('click',function(){recordChoice(card);});",
                                              "card.setAttribute('data-wired','');", "recorder wiring")},
            "never wires it to a choice card")
    control("storable and routable split back into two lists",
            {"assets/mbm-audience.js": mutate(js, "return ROUTES[value]?value:'';",
                                              "return {pupils:1}[value]?value:'';", "split allow-list")},
            "must stay one list")

    # The support pill, in both directions. Each control breaks exactly one
    # clause of the ruling and proves check_support_pill names the page that
    # broke it. Every fixture goes through mutate(), which raises when a
    # replacement does not land - a graft that silently no-ops would leave the
    # control measuring a clean tree and reporting a pass for it.
    pill = json.loads(read(ROOT, "data/support-pill.json"))
    teach = read(ROOT, "teach/index.html")
    partners = read(ROOT, FACES["partners"])
    block = re.search(r'<div class="' + re.escape(pill["containerClass"]) + r'"[\s\S]*?</div>', teach)
    if not block:
        raise SystemExit("positive-control fixture could not be created: support pill block")
    block = block.group(0)

    control("support pill removed from /teach/",
            {"teach/index.html": mutate(teach, block, "", "pill removal")},
            "teach/index.html: carries 0 support pill")
    control("support pill grafted onto the pupil homepage",
            {FACES["pupils"]: mutate(read(ROOT, FACES["pupils"]), "</footer>", block + "</footer>",
                                     "pupil pill graft")},
            "for/pupils/index.html: carries 1 Ko-fi reference(s); this surface must carry none")
    control("support pill href altered on one page",
            {FACES["partners"]: mutate(partners, pill["href"], "https://ko-fi.com/madebymatt-uk", "href")},
            "does not carry the declared Ko-fi href and label verbatim")
    control("support pill opened in a new tab without noopener",
            {FACES["partners"]: mutate(partners, ' rel="noopener noreferrer"', "", "rel")},
            'support pill is missing rel="noopener noreferrer"')
    control("support pill stripped of its aria-label",
            {FACES["partners"]: mutate(partners, f' aria-label="{pill["ariaLabel"]}"', "", "aria-label")},
            "support pill is missing the declared aria-label")
    control("support pill dropped below the 44px touch target",
            {FACES["partners"]: mutate(partners, "min-height:44px;", "", "touch target")},
            "support pill is missing a 44px minimum touch target")
    control("support pill lifted out of the footer, where print cannot hide it",
            {"teach/index.html": mutate(mutate(teach, block, "", "pill lift"), "<footer", block + "<footer",
                                        "pill reinsertion")},
            "sits outside the footer")
    control("Ko-fi widget script embedded beside the pill",
            {"teach/index.html": mutate(teach, block, block + '<script src="https://ko-fi.com/widget.js"></script>',
                                        "widget")},
            "embeds a Ko-fi widget, script or iframe")

    restored = set(check_tree(ROOT))
    if restored != baseline:
        print("[FAIL] the tree does not verify the same way after the positive controls")
        for item in sorted(restored ^ baseline):
            print(" -", item)
        problems += 1
    else:
        # Derived. This line said "seven" while thirteen controls ran above it.
        print(f"[PASS] tree verifies identically after {controls_run} positive controls "
              f"({len(baseline)} baseline finding(s))")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    errors = check_tree()

    # Printed on every run, green or red. A budget only anyone remembers when it
    # is breached is a budget nobody is steering by; this is the number and the
    # room left in it, in the units it was taken in.
    root_bytes = len((ROOT / "index.html").read_bytes())
    print(f"[INFO] discovery root: {root_bytes:,} B of the {ROOT_WEIGHT_CAP:,} B budget, "
          f"{ROOT_WEIGHT_CAP - root_bytes:,} B headroom")

    if errors:
        print(f"[FAIL] {len(errors)} static error(s)")
        for error in errors:
            print(" -", error)
    else:
        print("[PASS] root chooser, preserved /main/, seven visual audience homepages, local preference, labels, routes and integration boundaries")

    # The controls run whether or not the tree verified. Returning first would
    # switch off the suite that proves these checks can fail at exactly the
    # moment the tool is reporting a problem - which is when it matters most.
    problems = self_test(set(errors)) if args.self_test else 0
    return 1 if (errors or problems) else 0


if __name__ == "__main__":
    raise SystemExit(main())
