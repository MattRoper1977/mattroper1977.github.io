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
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")


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
    if chooser.count('data-mbm-face-choice=') != 7:
        errors.append("root chooser does not expose exactly seven audience choices")
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

    main = read(root, "main/index.html", overrides)
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
    if "mbm_audience_view" not in audience_js or "localStorage" not in audience_js:
        errors.append("local audience preference implementation missing")
    if re.search(r'location\s*\.(?:href|replace|assign)|window\.location\s*=', audience_js):
        errors.append("root audience preference script must not auto-redirect visitors")
    if re.search(r'\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(', audience_js):
        errors.append("local audience preference script attempts a network request")

    platform_js = read(root, "assets/mbm-platform.js", overrides)
    if "adultFeaturesAllowed" not in platform_js or "data-mbm-adult-features" not in platform_js:
        errors.append("platform JavaScript does not enforce the pupil adult-feature boundary")
    if "data-mbm-mailing-footer" not in platform_js:
        errors.append("platform JavaScript cannot keep mailing promotion restrained on the chooser")

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

    return errors


def mutate(source: str, old: str, new: str, label: str) -> str:
    changed = source.replace(old, new, 1)
    if changed == source:
        raise SystemExit(f"positive-control fixture could not be created: {label}")
    return changed


def expect_failure(label: str, overrides: Mapping[str, str], expected: str) -> None:
    failures = check_tree(ROOT, overrides)
    if not any(expected.lower() in item.lower() for item in failures):
        print(f"[FAIL] positive control not detected: {label}")
        for item in failures:
            print(" -", item)
        raise SystemExit(1)
    print(f"[PASS] positive control: {label}")


def self_test() -> None:
    chooser = read(ROOT, "index.html")
    pupils = read(ROOT, FACES["pupils"])
    teachers = read(ROOT, FACES["teachers"])
    js = read(ROOT, "assets/mbm-audience.js")
    expect_failure("removed /main/ chooser link", {"index.html": mutate(chooser, '<a class="mf-btn primary" href="/main/">', '<a class="mf-btn primary" href="/main-missing/">', "main link")}, "does not expose the separate Main")
    expect_failure("changed chooser heading", {"index.html": mutate(chooser, '>Choose your own homepage type</h2>', '>Choose a homepage</h2>', "chooser heading")}, "missing the mandated 'Choose your own homepage type' heading")
    expect_failure("wrong audience canonical", {FACES["teachers"]: mutate(teachers, '<link rel="canonical" href="https://madebymatt.uk/for/teachers/">', '<link rel="canonical" href="https://madebymatt.uk/for/teacher-broken/">', "canonical")}, "canonical is wrong")
    expect_failure("broken promoted image", {FACES["teachers"]: mutate(teachers, "/images/lesson-hub-card.webp", "/images/not-real.webp", "image")}, "promoted image path is broken")
    pupil_nav = mutate(pupils, '<div class="mbm-nav-panel">', '<div class="mbm-nav-panel"><a href="/account/">Account</a>', "pupil adult link")
    expect_failure("adult link inserted into pupil navigation", {FACES["pupils"]: pupil_nav}, "pupil primary navigation exposes adult")
    network_js = mutate(js, "function init(){", "function init(){fetch('/preference-leak');", "network request")
    expect_failure("local preference network request", {"assets/mbm-audience.js": network_js}, "attempts a network request")
    old_label = mutate(chooser, "Academy trusts &amp; education groups", "Academy trusts &amp; trusts", "old label")
    expect_failure("reverted obsolete audience label", {"index.html": old_label}, "obsolete public audience label remains")
    restored = check_tree(ROOT)
    if restored:
        print("[FAIL] restored implementation failed after positive controls")
        for item in restored:
            print(" -", item)
        raise SystemExit(1)
    print("[PASS] restored implementation after seven positive controls")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    errors = check_tree()
    if errors:
        print(f"[FAIL] {len(errors)} static error(s)")
        for error in errors:
            print(" -", error)
        return 1
    print("[PASS] root chooser, preserved /main/, seven visual audience homepages, local preference, labels, routes and integration boundaries")
    if args.self_test:
        self_test()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
