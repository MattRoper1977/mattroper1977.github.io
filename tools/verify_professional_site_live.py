#!/usr/bin/env python3
"""Verify the published Made by Matt platform against the checked-out source.

Sentinel: mbm-site-professional-design-upgrade-2026-08-07
Uses only the Python standard library so it can run in GitHub Actions without
adding a project dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen, HTTPRedirectHandler, build_opener

DEFAULT_BASE = "https://madebymatt.uk/"
# Anchored to this file, not to the working directory. The ASSETS comparison
# below reads relative paths and so depends on being run from the repo root;
# anything added here should not inherit that.
ROOT = Path(__file__).resolve().parents[1]

# Structural markers, which are literals on purpose and each say why.
#
#   mbm-platform.css / mbm-platform.js  filenames, owned by the shared platform
#                                       and not derivable from any data file
#   mbm-site-header                     the class the shared header carries;
#                                       structure, not content
SHARED_SHELL = ("mbm-platform.css", "mbm-platform.js", "mbm-site-header")


def chooser_markers() -> tuple[str, ...]:
    """What `/` must serve, derived from the file that owns it.

    This list used to be typed out, and it went stale the moment #110 moved the
    professional homepage from `/` to `/main/` and D1 relabelled the audiences.
    It then failed on main for every run from #110 onward - the estate's only
    live gate, dark for the whole recovery sequence, because nobody re-reads a
    list that looks settled.

    Re-typing a corrected list would only reset the clock on the same trap, so
    the labels come from the same data file the renderer reads. Change a label
    in one place and this follows.
    """
    data = json.loads((ROOT / "data" / "audience-homepages.json").read_text(encoding="utf-8"))
    labels = tuple(html.escape(a["label"], quote=False) for a in data["audiences"].values())
    return SHARED_SHELL + (
        # The two group containers the chooser is built around: structure the
        # renderer emits, and the thing a visitor needs in order to choose.
        'id="audience-people"',
        'id="audience-organisations"',
    ) + labels


# The five non-cream reading themes, as they appear in a page's own CSS. Cream
# is the default and REMOVES the attribute rather than setting it, so it has no
# rule and must not be looked for — see docs/THEME_ENGINE.md.
#
# This is the served-side half of the theme contract. tools/verify_theme_parity.py
# proves the sources agree with one another; these prove the agreement survived
# being deployed. They are here because the failure they guard against — a page
# offering six swatches and styling five — shipped on 2026-08-12 and was
# invisible from every direction except a rendered page.
THEME_RULES: tuple[str, ...] = tuple(
    f'[data-theme="{t}"]' for t in ("pink", "blue", "light", "dark", "highlumen"))

PAGE_MARKERS: dict[str, tuple[str, ...]] = {
    "/": chooser_markers(),
    # /main/ is the professional homepage since #110. It was not checked live at
    # all - the old entry asserted its markers against `/`, which is now the
    # chooser, so the real homepage went unverified while a passing-looking
    # check pointed at the wrong page.
    "/main/": SHARED_SHELL + ('id="audiences"',) + THEME_RULES,
    "/games/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Games') + THEME_RULES,
    "/tools/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Tools') + THEME_RULES,
    "/resources/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header", 'aria-current="page">Resources') + THEME_RULES,
    # The two companion estates, mounted under this domain. They are the only
    # themed surfaces this gate can reach that live in another repository, and
    # they are the ones that shipped with five swatches, so they are checked
    # from the serving side rather than trusted to their own CI.
    "/Lessons/": SHARED_SHELL + THEME_RULES,
    "/Matt-s-Apps-/": SHARED_SHELL + THEME_RULES,
    # Consumers, not ported surfaces: they read the stored theme and style Dark
    # only. No swatches, so no theme-rule assertion — see docs/THEME_ENGINE.md.
    "/members/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
    "/privacy/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
    "/stats/": ("mbm-platform.css", "mbm-platform.js", "mbm-site-header"),
}

# The education publication replaces these front doors after source generation.
# Historical/manual callers retain the legacy contract unless they opt in.
# Shared statistics use the publication's own shell and runtime. These are
# structural hooks owned by usage_discovery.py, not claims of recorded totals.
# The original device-local page remains reachable at its explicit legacy route.
EDUCATION_NAVIGATION_MARKERS = (
    'class="mbm-unified-header"', 'data-mbm-navigation="education"',
    'class="mbm-unified-menu"', 'id="mbm-navigation-panel"',
    '<link rel="stylesheet" href="/assets/shared-navigation.css">',
    '<script defer src="/assets/shared-navigation.js"></script>',
)
EDUCATION_STATS_MARKERS = (
    '<title>Shared usage statistics · Made by Matt</title>',
    'class="usage-shell"',
    '<link rel="stylesheet" href="/assets/usage.css">',
    '<script defer src="/assets/usage-client.js"></script>',
    'data-usage-popularity="education"',
    'data-usage-list="lessons"', 'data-usage-list="packs"',
    'data-usage-period', 'value="last30days"', 'value="alltime"',
    'data-usage-measured-since', 'data-usage-choice="deny"',
    'data-usage-choice-status', 'href="/privacy/#shared-usage"',
    'href="/stats/on-this-device/"',
) + EDUCATION_NAVIGATION_MARKERS

# J93 (rulings uz-6 (h), vb-3 (e); lane decisions LD5, LD9). The education homepage at / and /main/ is
# the bound J93 page: domain-split/home/home.html, bound by domain-split/home_slots.py. The legacy
# markers it retired, each REPLACED by the J93 element that took its place, never just dropped:
#
#   legacy <title>, legacy <h1>        -> the draft's own <title> and its one h1#home-title, read from
#                                         the draft of record (never typed here), and exactly 1 h1
#   data-home-search role="search"     -> the header search control: exactly one, at /resources/#rxSearch
#   src="/assets/domain-site.js"       -> the page's own stylesheet and runtime, /assets/home.css + home.js
#
# and, in place of the retired hero, Try-a-lesson and mailing link: the four door cards at the record's
# routes (data/audience-homepages.json by key), the three flagship cards BUILD, GROW, LAUNCH in order,
# #about with its one /commission/ link, 0 [data-mailing-link], 0 #whats-new, exactly one SEO-1 JSON-LD
# block (ruling vd-1 (b); it replaces uz-6 (g)'s "0 JSON-LD"; see J93_SEO1 below), exactly one
# theme slot, the token stylesheet /assets/mbm-tokens.css, and 0 links to any game route (promotions
# rule below). data-site-kind="education" data-page="home" still holds and is kept.
#
# TRANSITION FORM (ruling rd-6 (b') "pending-set transition form (A)", LD9). This gate reads
# PRODUCTION, which serves the legacy page until the J93 Site squash is published. So it first detects
# which page is served and then applies THAT page's assertions strictly: the J93 assertions to the J93
# page, the unchanged legacy markers to the legacy page. A page that is neither, or that claims to be
# both, never passes. --home-form j93 refuses the legacy page; the legacy branch and that option's
# default go in the collapse change once J93 is live.
HOME_DRAFT = ROOT / "domain-split" / "home" / "home.html"
J93_HOME_ROUTES = ("/", "/main/")
J93_DOOR_KEYS = ("pupils", "teachers", "parents", "schools")
J93_PATHWAYS = ("BUILD", "GROW", "LAUNCH")
J93_SEARCH_TARGET = "/resources/#rxSearch"
J93_TOKEN_SHEET = "/assets/mbm-tokens.css"
# SEO-1 (ruling vd-1 (b)): the binder stamps ONE JSON-LD block, a WebSite and a Person, both named with the
# owner's brand line (the draft <title>'s text after its last " · "), WebSite url = origin + "/", publisher =
# the Person, and the Person carries exactly @type, @id (origin + "/#about") and name: no contact detail of
# any kind. The name, origin and language are read from the draft and domain-split/config.json, never typed.
J93_PERSON_KEYS = frozenset({"@type", "@id", "name"})
J93_CONTACT_KEYS = frozenset({"email", "telephone", "faxNumber", "address", "contactPoint", "sameAs", "contactType",
                              "areaServed", "location", "homeLocation", "workLocation", "image", "url"})


def _j93_door_routes() -> tuple[str, ...]:
    record = json.loads((ROOT / "data" / "audience-homepages.json").read_text(encoding="utf-8"))["audiences"]
    missing = [key for key in J93_DOOR_KEYS if not (record.get(key) or {}).get("route")]
    if missing:
        raise SystemExit(f"MEASUREMENT INVALID: the audience record has no route for door key(s) {missing}")
    return tuple(record[key]["route"] for key in J93_DOOR_KEYS)


J93_DOOR_ROUTES = _j93_door_routes()


def _j93_seo1() -> tuple[dict[str, Any], str]:
    """The SEO-1 block the binder must stamp: (expected JSON value, its stamped script line)."""
    draft = HOME_DRAFT.read_text(encoding="utf-8")
    titles = re.findall(r"<title\b[^>]*>([^<]*)</title>", draft)
    langs = re.findall(r'<html lang="([^"]+)">', draft)
    if len(titles) != 1 or " · " not in html.unescape(titles[0]) or len(langs) != 1:
        raise SystemExit("MEASUREMENT INVALID: the J93 draft has no single <title> brand line or html lang")
    brand = html.unescape(titles[0]).rsplit(" · ", 1)[1].strip()
    origin = json.loads((ROOT / "domain-split" / "config.json").read_text(encoding="utf-8"))["education_origin"]
    if not brand or not origin.startswith("https://") or origin.endswith("/"):
        raise SystemExit("MEASUREMENT INVALID: no brand line or no education origin of record")
    person = {"@type": "Person", "@id": origin + "/#about", "name": brand}
    value = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebSite", "@id": origin + "/#website", "url": origin + "/", "name": brand,
         "inLanguage": langs[0], "publisher": {"@id": person["@id"]}},
        person]}
    line = ('<script type="application/ld+json">'
            + json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>")
    return value, line


J93_SEO1, J93_SEO1_LINE = _j93_seo1()


def seo1_defects(blocks: list[str]) -> list[str]:
    """SEO-1 shape, exactly: one block; a WebSite and a Person named with the brand line; WebSite url and
    publisher; Person keys exactly @type/@id/name; no contact key anywhere (url only on the WebSite)."""
    if len(blocks) != 1:
        return [f"exactly one SEO-1 JSON-LD block (found {len(blocks)})"]
    try:
        value = json.loads(blocks[0])
    except ValueError as error:
        return [f"the SEO-1 JSON-LD block is not JSON ({error})"]
    want = J93_SEO1
    site_want, person_want = want["@graph"]
    graph = value.get("@graph") if isinstance(value, dict) else None
    if not isinstance(graph, list) or sorted(str(n.get("@type")) for n in graph if isinstance(n, dict)) != [
            "Person", "WebSite"] or len(graph) != 2:
        return [f"the SEO-1 block is one WebSite and one Person (found {value!r})"]
    site = next(n for n in graph if n["@type"] == "WebSite")
    person = next(n for n in graph if n["@type"] == "Person")
    defects = []
    def expect(ok: bool, label: str, found: Any) -> None:
        if not ok:
            defects.append(f"SEO-1: {label} (found {found!r})")
    expect(value.get("@context") == want["@context"], "@context", value.get("@context"))
    expect(site.get("name") == person.get("name") == site_want["name"],
           "WebSite and Person named with the title's brand line", (site.get("name"), person.get("name")))
    expect(site.get("url") == site_want["url"], "WebSite url is the education origin + '/'", site.get("url"))
    expect(site.get("publisher") == {"@id": person_want["@id"]} and person.get("@id") == person_want["@id"],
           "WebSite publisher is the Person at origin + '/#about'", (site.get("publisher"), person.get("@id")))
    expect(set(person) == J93_PERSON_KEYS, "the Person carries exactly @type, @id and name", sorted(person))
    def keys(node: Any) -> set[str]:
        if isinstance(node, dict):
            return set(node) | {k for v in node.values() for k in keys(v)}
        if isinstance(node, list):
            return {k for v in node for k in keys(v)}
        return set()
    contact = (keys(person) | keys({k: v for k, v in site.items() if k != "url"})) & J93_CONTACT_KEYS
    expect(not contact, "no contact detail of any kind", sorted(contact))
    expect(value == want, "the block is exactly the SEO-1 value of record", value)
    return defects


def j93_home_markers() -> tuple[str, ...]:
    """The J93 homepage markers. Title and h1 are the draft's own elements, read from the draft of
    record; the rest are structural hooks the binder emits, with the door routes from the record."""
    draft = HOME_DRAFT.read_text(encoding="utf-8")
    own = []
    for pattern in (r"<title\b[^>]*>.*?</title>", r"<h1\b[^>]*>.*?</h1>"):
        hits = re.findall(pattern, draft, re.S)
        if len(hits) != 1:
            raise SystemExit(f"MEASUREMENT INVALID: the J93 draft has {len(hits)} match(es) of {pattern}")
        own.append(hits[0])
    return tuple(own) + (
        'data-site-kind="education" data-page="home"',
        f'<link rel="stylesheet" href="{J93_TOKEN_SHEET}">',
        '<link rel="stylesheet" href="/assets/home.css">',
        '<script defer src="/assets/home.js"></script>',
        '<div data-mbm-theme-slot>',
        f'<a class="mbm-unified-search" href="{J93_SEARCH_TARGET}" aria-label="Search">',
    ) + tuple(
        f'<a class="home-door-card" data-slot-attr="href:audiences.doors.{i}.route" href="{route}">'
        for i, route in enumerate(J93_DOOR_ROUTES)
    ) + tuple(
        f'<article class="home-pathway-card" data-pathway-card="{key}">' for key in J93_PATHWAYS
    ) + (
        '<section class="home-section home-maker" id="about" aria-labelledby="maker-heading">',
        '<a href="/commission/">',
        J93_SEO1_LINE,
    )


J93_HOME_MARKERS = j93_home_markers()


def education_game_routes() -> frozenset[str]:
    """Every game route the publication serves, from the census the builder itself reads
    (build_publications.CENSUS, located through its source so this stays standard-library only)."""
    import ast
    builder = ROOT / "domain-split" / "build_publications.py"
    census = None
    for node in ast.parse(builder.read_text(encoding="utf-8")).body:
        if (isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "CENSUS" for t in node.targets)
                and isinstance(node.value, ast.BinOp) and isinstance(node.value.right, ast.Constant)):
            census = ROOT / node.value.right.value
    if census is None:
        raise SystemExit("MEASUREMENT INVALID: build_publications.CENSUS could not be located")
    rows = json.loads(census.read_text(encoding="utf-8"))["rows"]
    routes = frozenset(_normal(row["normalizedDecodedRoute"]) for row in rows)
    if not rows or len(routes) != len(rows):
        raise SystemExit(f"MEASUREMENT INVALID: {len(rows)} census rows gave {len(routes)} distinct game routes")
    return routes


def _normal(route: str) -> str:
    # build_publications.normal(), the builder's own route normalisation.
    path = unquote(urlparse(route).path)
    return path.removesuffix("index.html").rstrip("/") or "/"


class _HomeStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.theme_slots = 0
        self.search = []
        self.doors = []
        self.pathways = []
        self.h1 = []
        self.about = 0
        self.about_commission = 0
        self.mailing = 0
        self.whats_new = 0
        self.ldjson = 0
        self.ldjson_blocks: list[str] = []
        self._ld = False
        self.token_sheets = []
        self.home_css = 0
        self.legacy_frontdoor = 0
        self._about_tag = None
        self._about_depth = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        classes = set((attrs.get("class") or "").split())
        if self._about_tag == tag:
            self._about_depth += 1
        if "data-mbm-theme-slot" in attrs:
            self.theme_slots += 1
        if tag == "a" and "mbm-unified-search" in classes:
            self.search.append(attrs.get("href"))
        if tag == "a" and "home-door-card" in classes:
            self.doors.append(attrs.get("href"))
        if tag == "article" and "home-pathway-card" in classes and "data-pathway-card" in attrs:
            self.pathways.append(attrs.get("data-pathway-card"))
        if tag == "h1":
            self.h1.append(attrs.get("id"))
        if attrs.get("id") == "about":
            self.about += 1
            if self._about_tag is None:
                self._about_tag, self._about_depth = tag, 1
        if tag == "a" and self._about_tag and attrs.get("href") == "/commission/":
            self.about_commission += 1
        if "data-mailing-link" in attrs:
            self.mailing += 1
        if attrs.get("id") == "whats-new":
            self.whats_new += 1
        if tag == "script" and (attrs.get("type") or "").strip().lower() == "application/ld+json":
            self.ldjson += 1
            self._ld = True
            self.ldjson_blocks.append("")
        if tag == "link" and "stylesheet" in (attrs.get("rel") or "").split():
            href = attrs.get("href") or ""
            if "mbm-tokens" in href:
                self.token_sheets.append(href)
            if href == "/assets/home.css":
                self.home_css += 1
        if tag == "body" and "data-sw2-frontdoor" in attrs:
            self.legacy_frontdoor += 1

    def handle_data(self, data):
        if self._ld:
            self.ldjson_blocks[-1] += data

    def handle_endtag(self, tag):
        if tag == "script":
            self._ld = False
        if self._about_tag == tag:
            self._about_depth -= 1
            if self._about_depth == 0:
                self._about_tag = None


def _home_structure(text: str) -> _HomeStructure:
    parsed = _HomeStructure()
    parsed.feed(text)
    return parsed


def education_home_form(text: str) -> str | None:
    """Which homepage is served: 'j93', 'legacy', or None for a page that is neither (or both)."""
    parsed = _home_structure(text)
    j93 = parsed.h1.count("home-title") == 1 and parsed.home_css == 1
    legacy = parsed.legacy_frontdoor == 1
    if j93 == legacy:
        return None
    return "j93" if j93 else "legacy"


def j93_home_defects(text: str) -> list[str]:
    """The J93 page's structure, exactly: counts, order and the record's routes."""
    s = _home_structure(text)
    defects = []
    def expect(ok: bool, label: str, found: Any) -> None:
        if not ok:
            defects.append(f"{label} (found {found!r})")
    expect(s.theme_slots == 1, "exactly one [data-mbm-theme-slot]", s.theme_slots)
    expect(s.search == [J93_SEARCH_TARGET], f"one header search control at {J93_SEARCH_TARGET}", s.search)
    expect(s.doors == list(J93_DOOR_ROUTES), "four door cards at the record routes, in key order", s.doors)
    expect(s.pathways == list(J93_PATHWAYS), "three flagship cards BUILD, GROW, LAUNCH in order", s.pathways)
    expect(s.h1 == ["home-title"], "exactly one h1, h1#home-title", s.h1)
    expect(s.about == 1 and s.about_commission == 1, "one #about with its one /commission/ link",
           (s.about, s.about_commission))
    expect(s.mailing == 0, "no [data-mailing-link]", s.mailing)
    expect(s.whats_new == 0, "no #whats-new", s.whats_new)
    defects += seo1_defects(s.ldjson_blocks)
    expect(s.token_sheets == [J93_TOKEN_SHEET], f"the token stylesheet is {J93_TOKEN_SHEET}", s.token_sheets)
    return defects

EDUCATION_PAGE_MARKERS = {
    **PAGE_MARKERS,
    "/stats/": EDUCATION_STATS_MARKERS,
    "/stats/on-this-device/": PAGE_MARKERS["/stats/"],
    "/": J93_HOME_MARKERS,
    "/main/": J93_HOME_MARKERS,
    "/for/teachers/": ('<title>Teachers · Made by Matt</title>',
                      '<h1>Ready for your next lesson?</h1>',
                      'data-site-kind="education" data-page="teachers"',
                      'src="/assets/domain-site.js"', 'data-search="teachers" role="search"', 'id="teachers-q"'),
    "/for/pupils/": ('<title>Pupils · Made by Matt</title>',
                    '<h1>What are you learning today?</h1>',
                    'data-site-kind="education" data-page="pupils"',
                    'src="/assets/domain-site.js"', 'id="pupil-search"'),
    "/games/": ('<title>This page has moved to Made by Matt Play · Made by Matt</title>',
               'data-game-moved', '<h1>This page has moved to Made by Matt Play</h1>',
               '<a id="play-game" href="https://www.madebymatt-play.uk/">'),
}
# The legacy education homepage's markers, unchanged, for the transition form above only: applied
# strictly, and only when the served page is detected as the legacy page. Retire with the collapse.
LEGACY_EDUCATION_HOME_MARKERS = {
    "/": ('<title>Big on ideas. Light on prep. · Made by Matt</title>',
          '<h1>Big on ideas. Light on prep.</h1>', 'data-home-search role="search"',
          'data-site-kind="education" data-page="home"',
          'src="/assets/domain-site.js"'),
    "/main/": ('<title>Big on ideas. Light on prep. · Made by Matt</title>',
              '<h1>Big on ideas. Light on prep.</h1>', 'data-home-search role="search"',
              'data-site-kind="education" data-page="home"',
              'src="/assets/domain-site.js"'),
}
# These publication headers supersede the legacy source header. Keep every
# other page/runtime/theme assertion, and require the actual shared menu.
for _route in ("/", "/main/", "/for/teachers/", "/for/pupils/", "/tools/",
               "/resources/", "/members/", "/privacy/", "/Lessons/", "/Matt-s-Apps-/", "/stats/on-this-device/"):
    EDUCATION_PAGE_MARKERS[_route] = tuple(
        marker for marker in EDUCATION_PAGE_MARKERS[_route]
        if marker not in {'mbm-site-header', 'aria-current="page">Tools'}
    ) + EDUCATION_NAVIGATION_MARKERS
for _route in J93_HOME_ROUTES:
    LEGACY_EDUCATION_HOME_MARKERS[_route] = tuple(
        marker for marker in LEGACY_EDUCATION_HOME_MARKERS[_route]
        if marker not in {'mbm-site-header', 'aria-current="page">Tools'}
    ) + EDUCATION_NAVIGATION_MARKERS
EDUCATION_PAGE_MARKERS["/tools/"] += ('aria-current="page">Tools',)

ASSETS: dict[str, Path] = {
    "/assets/mbm-platform.css": Path("assets/mbm-platform.css"),
    "/assets/mbm-platform.js": Path("assets/mbm-platform.js"),
    # The canonical reading-theme engine, served from the domain root and loaded
    # by twelve pages across two repositories — including Lessons/primary/,
    # which reaches for this file rather than the copy in its own repo. Compared
    # byte-for-byte with source, exactly as the platform assets are.
    "/theme.js": Path("theme.js"),
}

# These two generated-publication assets are copied byte-for-byte from the
# builder sources. A correct script tag alone does not prove a working runtime.
EDUCATION_ASSETS = {
    **ASSETS,
    "/assets/usage.css": Path("domain-split/usage.css"),
    "/assets/usage-client.js": Path("domain-split/usage-client.js"),
    "/assets/shared-navigation.css": Path("domain-split/shared-navigation.css"),
    "/assets/shared-navigation.js": Path("domain-split/shared-navigation.js"),
}

JSON_SURFACES = (
    "/Games/games.json",
    "/Lessons/resources.json",
    "/data/resources.json",
)
EDUCATION_JSON_SURFACES = (
    "https://www.madebymatt-play.uk/games.json",
    "/Lessons/resources.json",
    "/data/resources.json",
)

HOME_FORBIDDEN = (
    'id="mbmAuth"',
    'id="mbmAccountBtn"',
    'type="password"',
)


def education_promotions(text: str, *, migration: bool = False,
                         game_routes: frozenset[str] = frozenset(),
                         own_hosts: frozenset[str] = frozenset()) -> list[str]:
    """Reject real promotional markup without matching explanatory copy/CSS.

    With game_routes (the J93 homepage, LD5): also reject any link on this origin to a game route,
    i.e. a census route or anything under /Games/ or /Lessons/Games/. The Play root itself stays
    allowed; a Play-host game path is already an individual Play promotion above.
    """
    class Promotions(HTMLParser):
        def __init__(self):
            super().__init__()
            self.found: list[str] = []

        def handle_starttag(self, tag, attributes):
            attrs = dict(attributes)
            for name, value in [('data-usage-list', 'games'),
                                ('data-usage-popularity', 'play')]:
                if attrs.get(name) == value:
                    self.found.append(f'{name}="{value}"')
            if 'data-play-resource' in attrs:
                self.found.append('data-play-resource')
            self.found.extend(sorted(set(attrs.get('class', '').split()) &
                                     {'mbm-play-showcase', 'mbm-play-card'}))
            if tag == 'a' and not migration:
                url = urlparse(attrs.get('href', ''))
                if (url.hostname in {'madebymatt-play.uk', 'www.madebymatt-play.uk'}
                        and url.path.rstrip('/') not in {'', '/game-saves'}):
                    self.found.append('individual Play promotion: ' + attrs['href'])
            if tag == 'a' and game_routes:
                url = urlparse(attrs.get('href') or '')
                if url.scheme in ('', 'http', 'https') and (not url.hostname or url.hostname in own_hosts):
                    path = unquote(url.path)
                    if (path.startswith('/') and (_normal(path) in game_routes or path.startswith('/Games/')
                                                  or path.startswith('/Lessons/Games/'))):
                        self.found.append('game route link: ' + attrs['href'])

    parser = Promotions()
    parser.feed(text)
    return list(dict.fromkeys(parser.found))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise URLError(f"Production proof redirected: {request.full_url} -> {newurl}")


def fetch(base: str, path: str, nonce: str, timeout: float) -> tuple[int, dict[str, str], bytes, str]:
    clean_base = base.rstrip("/") + "/"
    url = urljoin(clean_base, path.lstrip("/"))
    separator = "&" if "?" in url else "?"
    url = f"{url}{separator}{urlencode({'mbm_live_verify': nonce})}"
    request = Request(
        url,
        headers={
            "User-Agent": "Made-by-Matt-production-verifier/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Accept": "*/*",
        },
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read(), response.geturl()
    except HTTPError as exc:
        return exc.code, dict(exc.headers.items()) if exc.headers else {}, exc.read(), exc.geturl()


def verify_once(
    base: str,
    timeout: float,
    attempt: int,
    extra_home_marker: str | None,
    publication: str = "legacy",
    home_form: str = "transition",
) -> dict[str, Any]:
    nonce = f"{int(time.time())}-{attempt}"
    errors: list[str] = []
    pages: dict[str, Any] = {}
    assets: dict[str, Any] = {}
    json_surfaces: dict[str, Any] = {}
    page_markers = EDUCATION_PAGE_MARKERS if publication == "education" else PAGE_MARKERS
    json_paths = EDUCATION_JSON_SURFACES if publication == "education" else JSON_SURFACES
    game_routes = education_game_routes() if publication == "education" else frozenset()
    own_hosts = frozenset({urlparse(base).hostname} - {None})

    for path, required in page_markers.items():
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            text = body.decode("utf-8", errors="replace")
            markers = list(required)
            # The transition form: detect the served homepage, then hold it to its own assertions.
            served_home = None
            home_defects: list[str] = []
            if publication == "education" and path in J93_HOME_ROUTES:
                served_home = education_home_form(text)
                if served_home is None:
                    home_defects.append("the served homepage is neither the J93 page nor the legacy page")
                elif served_home == "legacy" and home_form == "transition":
                    markers = list(LEGACY_EDUCATION_HOME_MARKERS[path])
                elif served_home == "legacy":
                    home_defects.append("the legacy homepage is served where the J93 page is required")
                else:
                    home_defects += j93_home_defects(text)
            if path == "/" and extra_home_marker:
                markers.append(extra_home_marker)
            missing = [marker for marker in markers if marker not in text]
            forbidden = [marker for marker in HOME_FORBIDDEN if path == "/" and marker in text]
            if publication == "education":
                forbidden += education_promotions(
                    text, migration=path == "/games/",
                    game_routes=game_routes if served_home == "j93" else frozenset(), own_hosts=own_hosts)
            content_type = headers.get("Content-Type", headers.get("content-type", ""))
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if "text/html" not in content_type.lower():
                errors.append(f"{path}: expected text/html, received {content_type or 'no Content-Type'}")
            if missing:
                errors.append(f"{path}: missing markers {missing}")
            if forbidden:
                errors.append(f"{path}: forbidden page markers {forbidden}")
            if home_defects:
                errors.append(f"{path}: homepage defects {home_defects}")
            pages[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": sha256(body),
                "content_type": content_type,
                "final_url": final_url,
                "missing_markers": missing,
                "forbidden_markers": forbidden,
                "served_home": served_home,
                "home_defects": home_defects,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            pages[path] = {"error": str(exc)}

    # The transition form accepts the J93 page or the legacy page, but ONE of them: / and /main/
    # are the same homepage, so a publication serving legacy on one and J93 on the other is a
    # half-landed state, not a transition (as check_completion.cjs:86 asserts on the built tree).
    # A route that is neither, or that failed, has already been reported above.
    if publication == "education":
        forms = {route: pages.get(route, {}).get("served_home") for route in J93_HOME_ROUTES}
        if None not in forms.values() and len(set(forms.values())) > 1:
            errors.append("/ and /main/ serve different homepages ("
                          + ", ".join(f"{route} = {form}" for route, form in forms.items())
                          + "); both must be the same form")

    asset_paths = EDUCATION_ASSETS if publication == "education" else ASSETS
    for path, local_path in asset_paths.items():
        expected = local_path.read_bytes()
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            expected_sha = sha256(expected)
            served_sha = sha256(body)
            content_type = headers.get("Content-Type", headers.get("content-type", ""))
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if served_sha != expected_sha:
                errors.append(
                    f"{path}: served SHA-256 {served_sha} does not match main source {expected_sha}"
                )
            assets[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": served_sha,
                "expected_sha256": expected_sha,
                "content_type": content_type,
                "final_url": final_url,
                "identical": served_sha == expected_sha,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            assets[path] = {"error": str(exc)}

    for path in json_paths:
        try:
            status, headers, body, final_url = fetch(base, path, nonce, timeout)
            parsed: Any = None
            parse_error = ""
            try:
                parsed = json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                parse_error = str(exc)
            count = len(parsed) if isinstance(parsed, (list, dict)) else 0
            if status != 200:
                errors.append(f"{path}: expected HTTP 200, received {status}")
            if parse_error:
                errors.append(f"{path}: invalid JSON: {parse_error}")
            elif count == 0:
                errors.append(f"{path}: JSON source is empty or has an unsupported root")
            json_surfaces[path] = {
                "status": status,
                "bytes": len(body),
                "sha256": sha256(body),
                "content_type": headers.get("Content-Type", headers.get("content-type", "")),
                "final_url": final_url,
                "root_type": type(parsed).__name__ if parsed is not None else None,
                "root_count": count,
                "parse_error": parse_error,
            }
        except (URLError, TimeoutError, OSError) as exc:
            errors.append(f"{path}: request failed: {exc}")
            json_surfaces[path] = {"error": str(exc)}

    # Network positive control: a unique first-party path must not resolve as content.
    missing_path = "/__mbm_professional_live_verify_deliberate_404__"
    try:
        status, headers, body, final_url = fetch(base, missing_path, nonce, timeout)
        if status != 404:
            errors.append(f"{missing_path}: positive control expected HTTP 404, received {status}")
        positive_control = {
            "path": missing_path,
            "status": status,
            "bytes": len(body),
            "content_type": headers.get("Content-Type", headers.get("content-type", "")),
            "final_url": final_url,
            "passed": status == 404,
        }
    except (URLError, TimeoutError, OSError) as exc:
        errors.append(f"{missing_path}: positive-control request failed: {exc}")
        positive_control = {"path": missing_path, "error": str(exc), "passed": False}

    return {
        "sentinel": "mbm-site-professional-design-upgrade-2026-08-07",
        "base": base,
        "publication": publication,
        "attempt": attempt,
        "checked_at_unix": int(time.time()),
        "pages": pages,
        "assets": assets,
        "json_surfaces": json_surfaces,
        "network_positive_control": positive_control,
        "errors": errors,
        "passed": not errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--publication", choices=("legacy", "education"), default="legacy",
                        help="Verify legacy source pages or the separated education publication")
    parser.add_argument("--attempts", type=int, default=36)
    parser.add_argument("--delay", type=float, default=10.0)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--expect-home-marker")
    parser.add_argument("--home-form", choices=("transition", "j93"), default="transition",
                        help="education homepage: 'transition' accepts the J93 page or the legacy page, each "
                             "held to its own assertions (production, until J93 is published); 'j93' refuses legacy")
    args = parser.parse_args()

    if args.attempts < 1:
        parser.error("--attempts must be at least 1")

    result: dict[str, Any] = {}
    for attempt in range(1, args.attempts + 1):
        result = verify_once(args.base, args.timeout, attempt, args.expect_home_marker, args.publication,
                             args.home_form)
        if result["passed"]:
            print(
                f"Made by Matt live verification: PASS on attempt {attempt}; "
                f"{len(result['pages'])} pages, {len(result['assets'])} exact assets, "
                f"{len(result['json_surfaces'])} JSON surfaces, positive control detected."
            )
            break
        print(
            f"Made by Matt live verification: attempt {attempt}/{args.attempts} not ready; "
            f"{len(result['errors'])} defect(s).",
            file=sys.stderr,
        )
        for error in result["errors"]:
            print(f"  - {error}", file=sys.stderr)
        if attempt < args.attempts:
            time.sleep(args.delay)

    if args.publication == "education":
        served = {route: result.get("pages", {}).get(route, {}).get("served_home") for route in J93_HOME_ROUTES}
        print("Education homepage served (" + args.home_form + "): "
              + ", ".join(f"{route} = {form or 'neither'}" for route, form in served.items()))

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    return 0 if result.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
