#!/usr/bin/env python3
"""Render the Made by Matt discovery root and the seven audience homepages.

Sentinel: mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09

The committed HTML stays a complete no-JavaScript navigation baseline. This
renderer keeps the seven public labels, stable routes, accents and curated
visual selections in one reviewable data file, so a change to an audience is a
data review rather than an HTML edit.

Generated output is never hand-edited. `--check` fails if the committed HTML
differs by a single byte from what this renderer produces.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "audience-homepages.json"
SUPPORT_PILL_PATH = ROOT / "data" / "support-pill.json"
SENTINEL = "mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09"

# /start/ is a frozen legacy redirect that the closeout deliberately left
# alone. It keeps the sentinel it shipped with so this renderer stays
# byte-faithful to the committed tree.
LEGACY_START_SENTINEL = "mbm-homepage-audience-routing-2026-08-09"

ICONS = {
    "spark": '<path d="M12 2.75l1.55 5.7L19.25 10l-5.7 1.55L12 17.25l-1.55-5.7L4.75 10l5.7-1.55L12 2.75Z"/><path d="M18.5 16.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
    "book": '<path d="M4 4.5h5.2A2.8 2.8 0 0 1 12 7.3v12.2a3.4 3.4 0 0 0-3.2-2.1H4V4.5Z"/><path d="M20 4.5h-5.2A2.8 2.8 0 0 0 12 7.3v12.2a3.4 3.4 0 0 1 3.2-2.1H20V4.5Z"/>',
    "home": '<path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.5 9.7v10h13v-10M9.4 19.7v-6h5.2v6"/>',
    "school": '<path d="M3.5 20.5h17M5.5 20.5V8.2L12 4l6.5 4.2v12.3M8.3 11.2h.1M12 11.2h.1M15.7 11.2h.1M8.3 14.6h.1M15.7 14.6h.1M10.3 20.5v-4.1h3.4v4.1"/>',
    "network": '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18.5" r="2.4"/><circle cx="19" cy="18.5" r="2.4"/><path d="m10.8 7.1-4.5 8.9M13.2 7.1l4.5 8.9M7.4 18.5h9.2"/>',
    "civic": '<path d="M3 9.5h18M5 9.5v9.2M9.5 9.5v9.2M14.5 9.5v9.2M19 9.5v9.2M3 19h18M12 3l8 4H4l8-4Z"/>',
    "collaborate": '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.8 20v-2.1A4.9 4.9 0 0 1 7.7 13h.6a4.9 4.9 0 0 1 3.7 1.7M12 20v-2.1a4.9 4.9 0 0 1 4.9-4.9h.6a4.9 4.9 0 0 1 4.9 4.9V20"/>',
    # The platform option needs its own glyph: all seven audience glyphs are
    # taken, and reusing one would make the icon a duplicate cue on a card whose
    # whole job is to read as a different kind of thing. Four panes, one frame.
    "platform": '<rect x="3.6" y="3.6" width="7" height="7" rx="1.8"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.8"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.8"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.8"/>'
}

SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/></svg>'

# The six teacher task routes. Presentation scaffolding for the Teach Hub, not
# per-audience content, so it lives with the renderer rather than in the
# audience data file.
TEACHER_TASKS = [
    ("teach-a-lesson", "#2F6B4D", "Teach a lesson", "Go straight to classroom-ready lessons and teaching sequences."),
    ("plan-a-sequence", "#405FA8", "Plan a sequence", "Find BUILD, GROW, LAUNCH and other pathway or scheme material."),
    ("assess-understanding", "#9A6332", "Assess understanding", "Open quick checks, exit tickets and feedback tools."),
    ("capture-evidence", "#6E58B8", "Capture evidence", "Use evidence-aware resources and the Evidence Binder."),
    ("manage-learner-information", "#0E7490", "Manage learner information", "Reach registers, cohort tools and local data workflows."),
    ("create-a-resource", "#A64B69", "Create a resource", "Choose a Made by Matt studio for documents, visuals and activities.")
]


def esc(value: Any, quote: bool = True) -> str:
    return html.escape(str(value), quote=quote)


def icon(name: str, cls: str = "mf-line-icon") -> str:
    body = ICONS.get(name, ICONS["spark"])
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{body}</svg>'


def canonical(route: str) -> str:
    return f"https://madebymatt.uk{route}"


def recent_attrs(search_id: str | None, route: str | None) -> str:
    if not search_id or not route:
        return ""
    return f' data-mbm-track-recent="{esc(search_id)}" data-mbm-recent-route="{esc(route)}"'


def json_ld(name: str, description: str, route: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": name,
        "description": description,
        "url": canonical(route),
        "isPartOf": {
            "@type": "WebSite",
            "name": "Made by Matt",
            "url": "https://madebymatt.uk/"
        }
    }
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def head(title: str, description: str, route: str) -> str:
    return f'''<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="mbm-platform-version" content="{SENTINEL}"><title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<meta name="theme-color" content="#161D3D"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical(route)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Made by Matt"><meta property="og:image" content="https://madebymatt.uk/assets/og-cover.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://madebymatt.uk/assets/og-cover.png">
<link rel="canonical" href="{canonical(route)}"><link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/mbm-platform.css"><link rel="stylesheet" href="/assets/mbm-audience.css"><link rel="stylesheet" href="/assets/mbm-search.css">
<script type="application/ld+json">{json_ld(title, description, route)}</script></head>'''


def display_menu() -> str:
    return '<details class="mbm-theme-menu"><summary>Display</summary><div class="mbm-theme-panel"><div class="mbm-theme-slot" data-mbm-theme-slot></div></div></details>'


def brand() -> str:
    return '<a class="brand" href="/main/"><img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100"><span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></a>'


def general_header(*, current: str, audience: dict[str, Any] | None = None, chooser: bool = False) -> str:
    if chooser:
        primary = [
            ("Discover", "/"),
            ("Main homepage", "/main/"),
            ("Teach", "/teach/"),
            ("Resources", "/resources/"),
            ("Education Hub", "/education-hub/")
        ]
        more = [
            ("Games", "/games/"),
            ("Lessons", "/Lessons/"),
            ("Apps", "/Matt-s-Apps-/"),
            ("Tools", "/tools/"),
            ("Privacy", "/privacy/")
        ]
    else:
        assert audience is not None
        primary = [(item["label"], item["href"]) for item in audience["quickLinks"]]
        more = [("Main homepage", "/main/"), ("Choose homepage", "/"), ("Resources", "/resources/"), ("Privacy", "/privacy/")]
        if audience.get("adultFeatures"):
            more.insert(2, ("Members", "/members/"))

    def link(label: str, href: str) -> str:
        cur = ' aria-current="page"' if href == current else ""
        return f'<a href="{esc(href)}"{cur}>{esc(label)}</a>'

    primary_html = "".join(link(label, href) for label, href in primary)
    more_html = "".join(link(label, href) for label, href in more)
    return f'''<header class="header mbm-site-header"><div class="bar">{brand()}<button class="menu" id="menu" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav class="nav mbm-site-nav" id="nav" aria-label="Site navigation"><div class="mbm-primary-links">{primary_html}</div><details class="mbm-nav-more"><summary>More</summary><div class="mbm-nav-panel">{more_html}</div></details>{display_menu()}</nav></div></header>'''


def support_pill() -> str:
    """The Ko-fi support pill, built from data/support-pill.json and nowhere else.

    Shared with render_discovery_hubs.py by import, the same way SENTINEL is:
    /teach/ and /education-hub/ carry the identical block, so a second copy of
    this markup would drift the moment one of them moved.

    A plain anchor by construction. No widget, no script, no iframe - nothing
    off-origin is requested until a visitor clicks it. target="_blank" is paired
    with rel="noopener noreferrer" and an aria-label that says the tab opens,
    because a new tab a screen-reader user was not told about is the defect.
    """
    pill = json.loads(SUPPORT_PILL_PATH.read_text(encoding="utf-8"))
    return (
        f'<div class="{esc(pill["containerClass"])}" style="{esc(pill["containerStyle"])}">'
        f'<p style="{esc(pill["leadStyle"])}">'
        f'<strong style="color:#E8E2D4">{esc(pill["leadStrong"])}</strong> {esc(pill["lead"])}</p>'
        f'<a href="{esc(pill["href"])}" rel="noopener noreferrer" target="_blank"'
        f' aria-label="{esc(pill["ariaLabel"])}"'
        f' style="{esc(pill["linkStyle"])}">{esc(pill["label"])}</a></div>'
    )


def footer(label: str, *, quiet: bool = False, support: bool = False) -> str:
    """The shared audience footer.

    `support` is passed explicitly rather than derived from `quiet`. The two
    happen to coincide today - the pupil page and the root chooser are both
    quiet, and neither carries the pill - but they are different questions, and
    a page that became quiet for a mailing reason would otherwise silently lose
    or gain a Ko-fi link. The caller states which it wants.
    """
    quiet_attr = ' data-mbm-mailing-cta="off"' if quiet else ""
    pill = support_pill() if support else ""
    return f'''<footer class="footer mf-footer"{quiet_attr}><div class="bar">{brand()}<span class="muted">{esc(label)} · <a href="/main/">Main homepage</a> · <a href="/">Choose homepage</a> · <a href="/privacy/">Privacy</a></span></div>{pill}</footer>'''


def scripts(audience: dict[str, Any] | None = None) -> str:
    """The shared script set, plus the pupil page's own local game filter.

    The pupil filter is NOT added to the adult pages: they carry the shared
    suggest form, which is the estate's one search engine. And the shared
    engine is not removed from the pupil page even though nothing on it now
    binds — the page also uses that file's exports elsewhere, and taking a
    script away is a separate decision from adding a control."""
    base = ('<script defer src="/theme.js"></script>'
            '<script defer src="/assets/mbm-audience.js"></script>'
            '<script defer src="/assets/mbm-search.js"></script>'
            '<script defer src="/assets/mbm-recent.js"></script>'
            '<script defer src="/assets/mbm-platform.js"></script>')
    if audience is not None and not audience.get("adultFeatures"):
        base += '<script defer src="/assets/mbm-pupil-search.js"></script>'
    return base


def pupil_search() -> str:
    """The pupil page's own search. It never leaves the page, and never asks
    the network for anything.

    THE SEARCH BOUNDARY IS A SAFETY BOUNDARY, so this is not the shared engine
    with a filter bolted on:

      · SOURCE. It reads the game cards ALREADY RENDERED on this page — the
        safe set, painted from the same record /games/ uses. No index fetch, no
        second catalogue, no endpoint. Typing fires zero requests.
      · RESULTS. It can only ever show or hide an <article> that is already in
        the DOM, so a result cannot resolve anywhere the page does not already
        link. There is no code path that can inject a destination.
      · NO FORM. There is no <form>, so there is no action, no submit and no
        query string. Enter does nothing but keep the results where they are.
      · NO PERSISTENCE. Nothing typed is written to localStorage,
        sessionStorage, IndexedDB, a cookie or a URL. On a shared device the
        query dies with the page.
      · ONE INPUT. This is the only <input> on the page, and the fence gate
        asserts exactly that.

    The empty state names the genre GROUPS, which this page has, rather than
    "filters", which it does not — a calm message that points at something real.
    """
    return (
        '<div class="mf-pupil-search">'
        '<label class="mf-pupil-search-label" for="pupil-game-search">Look for a game</label>'
        '<div class="mf-pupil-search-field">'
        '<input id="pupil-game-search" type="search" autocomplete="off" enterkeyhint="search" '
        'placeholder="Type a name, or how you want it to feel" '
        'aria-describedby="pupil-game-search-status" data-mbm-pupil-search>'
        '</div>'
        '<p class="mf-pupil-search-status" id="pupil-game-search-status" '
        'data-mbm-pupil-search-status role="status" aria-live="polite"></p>'
        '</div>'
    )


def hero_search(audience: dict[str, Any]) -> str:
    """A visible way to search, in the hero, on every audience homepage.

    All seven of these pages already LOADED assets/mbm-search.js and none of
    them showed a search box — the script bound nothing, because nothing on the
    page carried the attribute it looks for. Search existed and was invisible.

    The pupil page gets a DIFFERENT control, deliberately. The shared suggest
    form reads the whole 715-entry index, which includes 69 entries marked
    safeForPupils:false and routes to /teach/, /account/ and the resources
    catalogue; and it submits to /resources/. Neither belongs behind the pupil
    fence, so that page filters the games already rendered on it instead and
    never leaves the page. See pupil_search().
    """
    if audience.get("adultFeatures"):
        sid = "hero-search-" + audience["route"].strip("/").replace("/", "-")
        return suggest_search(sid, "Search Made by Matt",
                              "Try a subject, game, pathway or tool", "mf-hero-search")
    return pupil_search()


def hero_copy(audience: dict[str, Any]) -> str:
    ctas = "".join(
        f'<a class="mf-btn {esc(item["style"])}" href="{esc(item["href"])}">{esc(item["label"])}</a>'
        for item in audience["primaryCtas"]
    )
    return f'''<div class="mf-hero-copy"><p class="mf-kicker">A Made by Matt homepage</p><h1 id="page-title">{esc(audience['title'])}</h1><p class="mf-lead">{esc(audience['lead'])}</p>{hero_search(audience)}<div class="mf-actions">{ctas}</div><div class="mf-home-links"><a href="/main/">Main homepage</a><a href="/">Choose another homepage</a></div></div>'''


# ---------------------------------------------------------------------------
# The games record. THE SAME ONE /games/ READS — not a copy of it.
#
# games/index.html holds one declared curation-and-taxonomy record, keyed on
# href: CURATION (take, rail slot) and TAXONOMY (genre, feels), with
# GENRE_ORDER naming the sections. The pupil homepage is generated, so it
# cannot fetch that record at runtime the way /games/ does — it reads it here,
# at render time, from the same file.
#
# That is the whole point. This estate has already produced `featured`, TAKES,
# TOP, `tag` and `collection` as competing sources of one truth; the pupil page
# hand-listing ten games was a sixth. Nothing below hand-lists a game, a genre
# or a count: change a genre in games/index.html and this page moves with
# /games/, which tools/verify_pupil_genres.mjs proves by doing exactly that.
GAMES_PAGE = ROOT / "games" / "index.html"
GAMES_MANIFEST = ROOT / "data" / "source-manifests" / "games.json"


def _js_array(src: str, name: str) -> str:
    start = src.index("var " + name + "=[")
    depth = 0
    i = src.index("[", start)
    for j in range(i, len(src)):
        if src[j] == "[":
            depth += 1
        elif src[j] == "]":
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
    raise SystemExit("unterminated " + name + " in " + str(GAMES_PAGE))


def games_record() -> dict[str, Any]:
    """CURATION + TAXONOMY + GENRE_ORDER, joined to the shelf manifest."""
    src = GAMES_PAGE.read_text(encoding="utf-8")
    order = re.findall(r'"((?:[^"\\]|\\.)*)"', _js_array(src, "GENRE_ORDER"))
    tax = {}
    for m in re.finditer(r'\{href:"([^"]+)",\s*genre:"([^"]+)",\s*feels:\[([^\]]*)\]\}',
                         _js_array(src, "TAXONOMY")):
        tax[m.group(1)] = {"genre": m.group(2), "feels": re.findall(r'"([^"]+)"', m.group(3))}
    rail = {}
    for m in re.finditer(r'\{href:"([^"]+)",\s*(?:rail:(\d+),\s*)?take:"((?:[^"\\]|\\.)*)"\}',
                         _js_array(src, "CURATION")):
        rail[m.group(1)] = {"rail": int(m.group(2)) if m.group(2) else None,
                            "take": re.sub(r"\\u([0-9a-fA-F]{4})",
                                           lambda x: chr(int(x.group(1), 16)), m.group(3))}
    shelf = json.loads(GAMES_MANIFEST.read_text(encoding="utf-8"))["games"]
    by_href = {g["href"]: g for g in shelf}

    if not order:
        raise SystemExit("GENRE_ORDER is empty — refusing to render a pupil page with no genres")
    missing = [h for h in tax if h not in by_href]
    if missing:
        raise SystemExit("taxonomy names hrefs that are not on the shelf: %s" % missing)
    ungenred = [g["href"] for g in shelf if g["href"] not in tax]
    if ungenred:
        raise SystemExit("shelf games with no genre: %s" % ungenred)
    return {"order": order, "tax": tax, "rail": rail, "shelf": shelf, "by_href": by_href}


def _game_card(game: dict[str, Any], take: str = "") -> str:
    href = game["href"]
    art = game.get("art") or ""
    desc = (game.get("desc") or "").replace("NEW · ", "")
    title = (game.get("title") or "").replace("NEW · ", "")
    track = recent_attrs(None, href)
    if art:
        media = ('<img data-mbm-real-visual src="%s" alt="%s — a moment from play" '
                 'width="640" height="360" loading="lazy" decoding="async">'
                 % (esc(art), esc(title)))
    else:
        media = ('<span class="mf-pupil-emoji" aria-hidden="true">%s</span>'
                 % esc(game.get("icon") or "\U0001F3AE"))
    quote = ('<p class="mf-pupil-take"><b>Matt’s take:</b> %s</p>' % esc(take)) if take else ""
    return ('<article class="mf-pupil-game"><a class="mf-media" href="%s" aria-label="Play %s"%s>%s</a>'
            '<div class="mf-feature-copy"><h3>%s</h3><p>%s</p>%s'
            '<a class="mf-text-link" href="%s"%s>Play %s<span aria-hidden="true">→</span></a>'
            '</div></article>'
            % (esc(href), esc(title), track, media, esc(title), esc(desc), quote,
               esc(href), track, esc(title)))


def toppicks_body(section: dict[str, Any]) -> str:
    """The Top Picks rail, from the SAME rail slots /games/ paints."""
    rec = games_record()
    picks = sorted([(v["rail"], h, v["take"]) for h, v in rec["rail"].items() if v["rail"]])
    cards = "".join(_game_card(rec["by_href"][h], take) for _, h, take in picks)
    return ('%s<div class="mf-pupil-rail" data-mbm-pupil-rail>%s</div>'
            % (section_head(section), cards))


def genres_body(section: dict[str, Any]) -> str:
    """Every game on the shelf, grouped by its one declared genre.

    Accordions, first open, matching /games/. The counts are computed here from
    the record and never written into the JSON — a number in the data is a
    number that goes stale without telling anyone.
    """
    rec = games_record()
    blocks = []
    for i, gname in enumerate(rec["order"]):
        members = [g for g in rec["shelf"] if rec["tax"][g["href"]]["genre"] == gname]
        if not members:
            continue
        members.sort(key=lambda g: (g.get("title") or "").lower())
        cards = "".join(_game_card(g) for g in members)
        n = len(members)
        blocks.append('<details class="mf-pupil-genre"%s>'
                      '<summary><span class="mf-pupil-gname">%s</span>'
                      '<span class="mf-pupil-gnum">%d game%s</span></summary>'
                      '<div class="mf-pupil-grid">%s</div></details>'
                      % (" open" if i == 0 else "", esc(gname), n, "" if n == 1 else "s", cards))
    head = dict(section)
    head["lead"] = ("All %d games, grouped by what they are. Open a group and pick one."
                    % len(rec["shelf"]))
    return '%s<div class="mf-pupil-genres">%s</div>' % (section_head(head), "".join(blocks))


def find_feature_route(audience: dict[str, Any], search_id: str) -> str | None:
    for section in audience.get("sections", []):
        for item in section.get("features", []):
            if item.get("searchId") == search_id:
                return item.get("href")
    return None


def mark_stage(audience: dict[str, Any]) -> str:
    """The shared hero mark: the large Made by Matt M plus the audience badge.

    Every audience homepage uses the same treatment so that moving between the
    root, an audience page and a destination reads as one platform.
    """
    return f'''<div class="mf-mark-stage"><span class="mf-halo mf-halo-one" aria-hidden="true"></span><span class="mf-halo mf-halo-two" aria-hidden="true"></span><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640" fetchpriority="high"><span class="mf-audience-badge" style="--badge-accent:{esc(audience['accent'])}">{icon(audience['icon'], 'mf-badge-icon')}<span>{esc(audience['label'])}</span></span></div>'''


def hero(audience: dict[str, Any]) -> str:
    return f'''<section class="mf-hero" aria-labelledby="page-title"><div class="mf-hero-texture" aria-hidden="true"></div><div class="mf-wrap mf-hero-grid">{mark_stage(audience)}{hero_copy(audience)}</div></section>'''


def section_head(section: dict[str, Any]) -> str:
    lead = f"<span>{esc(section['lead'])}</span>" if section.get("lead") else ""
    return f'''<div class="mf-section-head"><p>{esc(section['kicker'])}</p><h2>{esc(section['title'])}</h2>{lead}</div>'''


def feature_card(item: dict[str, Any]) -> str:
    track = recent_attrs(item.get("searchId"), item.get("href"))
    return f'''<article class="mf-feature" data-feature-id="{esc(item['id'])}"><a class="mf-media" href="{esc(item['href'])}" aria-label="{esc(item['action'])}"{track}><img data-mbm-real-visual src="{esc(item['image'])}" alt="{esc(item['alt'])}" width="{int(item['width'])}" height="{int(item['height'])}" loading="lazy" decoding="async" sizes="(max-width: 720px) 92vw, (max-width: 1100px) 44vw, 360px"></a><div class="mf-feature-copy"><span class="mf-pill">{esc(item['kind'])}</span><h3>{esc(item['title'])}</h3><p>{esc(item['description'])}</p><a class="mf-text-link" href="{esc(item['href'])}"{track}>{esc(item['action'])}<span aria-hidden="true">→</span></a></div></article>'''


def features_body(section: dict[str, Any]) -> str:
    cards = "".join(feature_card(item) for item in section["features"])
    return f'''{section_head(section)}<div class="mf-feature-grid mf-feature-count-{len(section['features'])}">{cards}</div>'''


def routes_body(section: dict[str, Any]) -> str:
    cards = "".join(
        f'''<a class="mf-route-card" href="{esc(item['href'])}"{recent_attrs(item.get('searchId'), item.get('href'))}><span class="mf-route-copy"><strong>{esc(item['title'])}</strong><small>{esc(item['description'])}</small></span><span class="mf-route-action">{esc(item['action'])}<b aria-hidden="true">→</b></span></a>'''
        for item in section["items"]
    )
    return f'{section_head(section)}<div class="mf-route-grid">{cards}</div>'


def tips_body(section: dict[str, Any]) -> str:
    cards = "".join(
        f'''<article class="mf-tip"><span aria-hidden="true">{index + 1:02d}</span><h3>{esc(item['title'])}</h3><p>{esc(item['description'])}</p></article>'''
        for index, item in enumerate(section["items"])
    )
    return f'{section_head(section)}<div class="mf-tip-grid">{cards}</div>'


def faq_body(section: dict[str, Any]) -> str:
    items = "".join(
        f'''<details class="mf-faq"><summary>{esc(item['question'])}</summary><div><p>{esc(item['answer'])}</p></div></details>'''
        for item in section["items"]
    )
    return f'{section_head(section)}<div class="mf-faq-list">{items}</div>'


def tasks_body(section: dict[str, Any]) -> str:
    cards = "".join(
        f'''<a class="mf-task-card" style="--task-accent:{accent}" href="/teach/?task={slug}#teach-search-workspace"><span>{index + 1:02d}</span><strong>{title}</strong><small>{blurb}</small><b>Open this teacher route <i aria-hidden="true">→</i></b></a>'''
        for index, (slug, accent, title, blurb) in enumerate(TEACHER_TASKS)
    )
    return f'{section_head(section)}<div class="mf-task-grid">{cards}</div>'


def video_body(section: dict[str, Any]) -> str:
    return f'''{section_head(section)}<div class="mf-video-shell" data-mbm-video-shell><button type="button" class="mf-video-poster" data-mbm-video="{esc(section['videoId'])}" aria-label="Play {esc(section['titleText'])}"><img src="{esc(section['poster'])}" alt="{esc(section['titleText'])} poster" width="1280" height="720" loading="lazy"><span aria-hidden="true">▶</span><b>Play demonstration</b></button><p>No YouTube request is made until the play control is activated.</p></div>'''


def surprise_body(audience: dict[str, Any], section: dict[str, Any]) -> str:
    return f'''<div class="mf-surprise-card"><div><p>{esc(section['kicker'])}</p><h2>{esc(section['title'])}</h2><span>{esc(section['lead'])}</span></div><button class="mf-btn primary" type="button" data-mbm-surprise>Choose a game</button><p class="mf-surprise-result" data-mbm-surprise-result aria-live="polite"></p></div>'''


def recent_body(section: dict[str, Any]) -> str:
    return f'''<div class="mf-recent-head"><div><p>Local-only shortcut</p><h2>{esc(section['title'])}</h2><span>{esc(section['lead'])}</span></div><button type="button" data-mbm-recent-clear>Clear</button></div><p data-mbm-recent-empty>You haven&rsquo;t opened anything on this device yet.</p><div class="mbm-recent-grid" data-mbm-recent-items></div>'''


def surprise_set(audience: dict[str, Any]) -> str:
    """The shuffle set: every game the page itself promotes.

    It used to walk the page's `features` cards, which was right when the page
    hand-listed ten games — and it quietly meant "ten" while the copy claimed a
    pupil-safe set. The page now shows the whole shelf, so the set is the whole
    shelf, read from the same record the sections are built from. Deriving it
    here still means the button can never offer something the page does not
    show; it just no longer means something far smaller than the page claims.
    """
    entries = []
    if any(sec.get("type") in ("genres", "toppicks") for sec in audience.get("sections", [])):
        rec = games_record()
        for game in rec["shelf"]:
            entries.append({"id": game["href"], "route": game["href"],
                            "title": (game.get("title") or "").replace("NEW \u00b7 ", "")})
        return json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    for section in audience.get("sections", []):
        if section.get("type") != "features":
            continue
        for item in section["features"]:
            if str(item.get("searchId", "")).startswith("game-"):
                entries.append({"id": item["searchId"], "route": item["href"], "title": item["title"]})
    return json.dumps(entries, ensure_ascii=False, separators=(",", ":"))


EXTRA_SECTION_CLASS = {
    "tasks": "mf-task-section",
    "video": "mf-video-section",
    "surprise": "mf-surprise",
    "recent": "mf-audience-recent"
}


def content_section(audience: dict[str, Any], section: dict[str, Any], index: int) -> str:
    kind = section["type"]
    classes = ["mf-section"]
    if kind in EXTRA_SECTION_CLASS:
        classes.append(EXTRA_SECTION_CLASS[kind])
    if index % 2:
        classes.append("mf-section-tint")

    attrs = ""
    if kind == "features":
        body = features_body(section)
    elif kind == "routes":
        body = routes_body(section)
    elif kind == "tips":
        body = tips_body(section)
    elif kind == "faq":
        body = faq_body(section)
    elif kind == "tasks":
        body = tasks_body(section)
    elif kind == "video":
        body = video_body(section)
    elif kind == "toppicks":
        body = toppicks_body(section)
    elif kind == "genres":
        body = genres_body(section)
    elif kind == "surprise":
        body = surprise_body(audience, section)
        attrs = f' data-mbm-surprise-set="{esc(surprise_set(audience))}"'
    elif kind == "recent":
        body = recent_body(section)
        attrs = " data-mbm-recent hidden"
    else:
        raise SystemExit(f"unknown section type: {kind}")

    return f'''<section class="{' '.join(classes)}" id="{esc(section['id'])}"{attrs}><div class="mf-wrap">{body}</div></section>'''


def utility_section(audience: dict[str, Any]) -> str:
    cards = "".join(
        f'''<a class="mf-utility" href="{esc(item['href'])}"><span class="mf-utility-icon">{icon(audience['icon'])}</span><span><strong>{esc(item['title'])}</strong><small>{esc(item['description'])}</small></span><span class="mf-arrow" aria-hidden="true">→</span></a>'''
        for item in audience["utilities"]
    )
    return f'''<section class="mf-section mf-utility-section"><div class="mf-wrap"><div class="mf-section-head"><p>More to explore</p><h2>Useful routes from this homepage</h2><span>Every destination remains public unless the destination itself clearly explains an optional adult account feature.</span></div><div class="mf-utility-grid">{cards}</div></div></section>'''


def closing_section(audience: dict[str, Any]) -> str:
    """The line that hands the reader somewhere, above the boundaries note.

    These pages ended on a guard. A page that states its limits and then stops
    has told the reader what it is not, and nothing about what to do next — so
    the closing region ran boundaries -> homepage switcher, with no editorial
    step between the last card and the disclaimer.

    This block is EDITORIAL and it is deliberately NOT the note. It carries no
    bounded claim, no account or privacy statement and no relationship
    disclaimer; those stay in note_section() where they already are, stated
    once. It is optional: an audience without a `closing` renders exactly as
    before, which is how the pupil page keeps its own shape.
    """
    text = audience.get("closing")
    if not text:
        return ""
    return (f'<section class="mf-section mf-closing-section"><div class="mf-wrap">'
            f'<p class="mf-closing">{esc(text)}</p></div></section>')


def note_section(audience: dict[str, Any]) -> str:
    # An adult page offers the optional adult routes; a pupil page states in
    # words that they are excluded, so the boundary is declared rather than
    # left to be inferred from absence.
    if audience.get("adultFeatures"):
        extra = '<div class="mf-note-links"><a href="/account/">Account</a><a href="/members/">Members</a><a href="/mailing-list/">Teacher updates</a><a href="/privacy/">Privacy</a></div>'
    else:
        extra = '<p class="mf-note-boundary"><strong>Adult-feature boundary:</strong> account and mailing-list actions are deliberately excluded from this pupil experience.</p>'
    return f'''<section class="mf-section mf-note-section"><div class="mf-wrap"><div class="mf-note"><span class="mf-note-mark" aria-hidden="true">{icon(audience['icon'])}</span><div><p class="mf-note-kicker">Made by Matt boundaries</p><h2>{esc(audience['noteTitle'])}</h2><p>{esc(audience['note'])}</p>{extra}</div></div></div></section>'''


def switcher(data: dict[str, Any], current: str) -> str:
    links = []
    for aid, item in data["audiences"].items():
        cur = ' aria-current="page"' if aid == current else ""
        links.append(f'<a href="{esc(item["route"])}"{cur}>{esc(item["label"])}</a>')
    # The /main/ action used to be a hand-written route and a hand-written
    # label, in a function that already had the data file open. It is the same
    # link the chooser card is, seen from the other side, so it reads the same
    # record. The wording was adopted from the literal it replaced, so retiring
    # the literal moved no bytes.
    main = data["mainOption"]
    return f'''<section class="mf-switch" aria-labelledby="switch-title"><div class="mf-wrap"><div class="mf-switch-head"><p>One platform · several front doors</p><h2 id="switch-title">Choose another homepage</h2></div><div class="mf-switch-grid">{"".join(links)}</div><div class="mf-switch-actions"><a class="mf-btn primary" href="{esc(main["route"])}">{esc(main["chooserLinkText"])}</a><a class="mf-btn quiet" href="/">Choose homepage</a></div></div></section>'''


def audience_page(data: dict[str, Any], aid: str, audience: dict[str, Any]) -> str:
    body_attrs = f'data-mbm-audience-face="{esc(aid)}"'
    # Both branches now state the verdict. adultFeaturesAllowed() is fail-closed,
    # so "off" and absent mean the same thing to the browser - but a generated
    # page that says nothing is indistinguishable from one the renderer forgot,
    # and data/adult-surfaces.json is asserted against the marker actually
    # present in the tree. The explicit "off" is also what /for/pupils/ is
    # checked for, by verify_games_audience_faces.py and by the browser suite.
    if audience.get("adultFeatures"):
        body_attrs += ' data-mbm-adult-features="on"'
    else:
        body_attrs += ' data-mbm-adult-features="off" data-mbm-mailing-footer="off"'
    sections = "".join(content_section(audience, section, i) for i, section in enumerate(audience["sections"]))
    description = audience["lead"]
    return f'''<!doctype html>
<!-- {SENTINEL} -->
<html lang="en-GB">{head(f"{audience['label']} · Made by Matt", description, audience['route'])}<body class="mbm-face-page" {body_attrs} style="--face-accent:{esc(audience['accent'])};--face-accent-visual:{esc(audience.get('accentVisual') or audience['accent'])};--face-soft:{esc(audience['soft'])}">
<a class="skip" href="#main">Skip to content</a>{general_header(current=audience['route'], audience=audience)}<main id="main">{hero(audience)}{sections}{utility_section(audience)}{closing_section(audience)}{note_section(audience)}{switcher(data, aid)}</main>{footer(audience['label'], quiet=not audience.get('adultFeatures'), support=bool(audience.get('adultFeatures')))}{scripts(audience)}</body></html>
'''


def chooser_card(aid: str, audience: dict[str, Any]) -> str:
    """One selectable homepage type.

    Serves two kinds of record: the seven entries in `audiences`, and the
    `mainOption`. It reads only the six keys both kinds carry - label, route,
    chooserDescription, accent, soft, icon - which is why the platform option
    needed no card shape of its own and cannot drift away from the seven.
    """
    return f'''<a class="mf-choice" data-mbm-face-choice="{esc(aid)}" data-mbm-face-label="{esc(audience['label'])}" href="{esc(audience['route'])}" style="--choice-accent:{esc(audience['accent'])};--choice-soft:{esc(audience['soft'])}"><span class="mf-last">Last used on this device</span><span class="mf-choice-icon">{icon(audience['icon'])}</span><span class="mf-choice-copy"><strong>{esc(audience['label'])}</strong><small>{esc(audience['chooserDescription'])}</small></span><span class="mf-arrow" aria-hidden="true">→</span></a>'''


def suggest_search(sid: str, label: str, placeholder: str, wrapper: str) -> str:
    """The ONE shared search entry point, from the ONE shared engine.

    assets/mbm-search.js binds `form[data-mbm-search="suggest"]` and fetches the
    index on FIRST FOCUS, not at boot — so putting this on a page costs nothing
    until somebody deliberately reaches for it. That is the whole reason the
    suggest form is what gets copied outward and the search APP is not: the app
    calls loadIndex() during init, which would put a 754 KB request on the
    critical path of every discovery page.

    Only the id and the two labels vary. Nothing about the engine, the markup or
    the submit target is re-implemented per page.
    """
    return f'''<div class="{wrapper}"><form class="mbm-search-form" action="/resources/" method="get" role="search" data-mbm-search="suggest" data-mbm-limit="6"><label class="mbm-search-label" for="{sid}">{esc(label)}</label><div class="mbm-search-field">{SEARCH_ICON}<input id="{sid}" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="{esc(placeholder)}" aria-describedby="{sid}-status"><div class="mbm-suggestions" id="{sid}-suggestions" data-mbm-suggestions hidden></div></div><button class="mbm-search-submit" type="submit">Search</button><span class="mbm-search-status" id="{sid}-status" data-mbm-search-status aria-live="polite"></span></form></div>'''


def root_search() -> str:
    return suggest_search("root-search", "Search Made by Matt",
                          "Try a subject, game, pathway or tool", "mf-root-search")


def root_highlights() -> str:
    items = [
        ("/games/", "/assets/cards/apex-kick.webp", "Apex Kick game artwork", "Games", "Play genuine browser games directly."),
        ("/Lessons/", "/images/lesson-hub-card.webp", "Lesson Hub preview", "Lesson Hub", "Browse lessons, schemes and pathway material."),
        ("/teach/", "/assets/video/poster-asdan.webp", "Made by Matt teaching pathway preview", "Teach Hub", "Start with a teacher workflow, not a blank search.")
    ]
    cards = "".join(
        f'''<a class="mf-root-highlight" href="{href}"><img src="{image}" alt="{alt}" width="450" height="253" loading="lazy"><span><strong>{title}</strong><small>{blurb}</small><b>Explore <i aria-hidden="true">→</i></b></span></a>'''
        for href, image, alt, title, blurb in items
    )
    return f'''<section class="mf-main-option" aria-labelledby="platform-highlights-title"><div class="mf-wrap"><div class="mf-root-section-head"><p>Go straight into the work</p><h2 id="platform-highlights-title">Explore the live platform</h2></div><div class="mf-root-highlights">{cards}</div></div></section>'''


def chooser_page(data: dict[str, Any]) -> str:
    root = data["root"]
    groups = []
    nav_links = []
    for group in data["groups"]:
        cards = "".join(chooser_card(aid, data["audiences"][aid]) for aid in group["audiences"])
        nav_links.append(f'<a href="#audience-{esc(group["id"])}">{esc(group["title"])}</a>')
        groups.append(f'''<section class="mf-choice-group" id="audience-{esc(group['id'])}" data-mbm-audience-group="{esc(group['id'])}" aria-labelledby="group-{esc(group['id'])}"><div class="mf-group-head"><p>{esc(group['description'])}</p><h3 id="group-{esc(group['id'])}">{esc(group['title'])}</h3></div><div class="mf-choice-grid">{cards}</div></section>''')

    title = f"{root['title']} · Made by Matt"
    description = root["lead"]
    cta = root["primaryCta"]
    return f'''<!doctype html>
<!-- {SENTINEL} -->
<html lang="en-GB">{head(title, description, "/")}<body class="mbm-face-page mbm-face-chooser" data-mbm-audience-face="chooser">
<a class="skip" href="#main">Skip to content</a>{general_header(current="/", chooser=True)}<main id="main"><section class="mf-hero mf-discovery-hero" aria-labelledby="page-title"><div class="mf-hero-texture" aria-hidden="true"></div><div class="mf-wrap mf-hero-grid"><div class="mf-mark-stage"><span class="mf-halo mf-halo-one" aria-hidden="true"></span><span class="mf-halo mf-halo-two" aria-hidden="true"></span><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640" fetchpriority="high"><span class="mf-audience-badge mf-platform-badge">{icon('network', 'mf-badge-icon')}<span>One live platform</span></span></div><div class="mf-hero-copy"><p class="mf-kicker">Made by Matt · discover what you need</p><h1 id="page-title">{esc(root['title'])}</h1><p class="mf-lead">{esc(root['lead'])}</p><div class="mf-actions"><a class="mf-btn primary" href="{esc(cta['href'])}">{esc(cta['label'])}</a></div>{root_search()}</div></div></section><section class="mf-choices" id="homepage-choices" aria-labelledby="audience-title"><div class="mf-wrap"><div class="mf-choice-intro"><p>Choose a relevant front door</p><h2 id="audience-title">{esc(root['audienceHeading'])}</h2><span>Every homepage here leads into the same public Made by Matt platform. Choose by person or organisation, or choose the main homepage. Choosing one does not create an account, change permissions or hide public content.</span><nav aria-label="Audience groups">{"".join(nav_links)}</nav></div>{"".join(groups)}<div class="mf-choice-grid mf-choice-platform">{chooser_card(data["mainOption"]["id"], data["mainOption"])}</div><div class="mf-continue" data-mbm-face-continue aria-live="polite"><span><b>Last used on this device</b><small>This preference stays in this browser. It is not an account, profile, consent choice or tracking identifier, and it is not sent to Supabase, Buttondown or analytics.</small></span><span class="mf-continue-actions"><a href="/">Continue</a><button class="mf-clear" type="button" data-mbm-face-clear>Forget this preference</button></span></div></div></section>{root_highlights()}<section class="mf-section mf-note-section"><div class="mf-wrap"><div class="mf-note"><span class="mf-note-mark" aria-hidden="true">{icon('spark')}</span><div><p class="mf-note-kicker">Nothing is locked by this choice</p><h2>Different homepages, the same public platform</h2><p>Audience selection changes presentation and navigation only. It does not authenticate anyone, create a child profile, grant permissions or prevent a visitor from opening another public part of the site.</p></div></div></div></section>{studio_band(data)}</main>{footer("Discovery homepage", quiet=True)}{scripts()}</body></html>
'''


def start_redirect() -> str:
    return f'''<!doctype html>
<!-- {LEGACY_START_SENTINEL} · legacy compatibility route -->
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Choose your homepage · Made by Matt</title><meta name="description" content="The Made by Matt homepage chooser now lives at the site root."><meta name="robots" content="noindex,follow"><meta name="theme-color" content="#161D3D"><link rel="canonical" href="https://madebymatt.uk/"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/mbm-audience.css"><meta http-equiv="refresh" content="0; url=/"><script>location.replace('/'+location.search+location.hash);</script></head><body class="mbm-face-page mbm-legacy-start"><main id="main"><section class="mf-hero mf-legacy-hero"><div class="mf-wrap"><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640"><h1>The homepage chooser has moved</h1><p class="mf-lead">Continue to the Made by Matt homepage chooser.</p><p><a class="mf-btn primary" href="/">Choose your homepage</a> <a class="mf-btn secondary" href="/main/">Main homepage</a></p></div></section></main></body></html>
'''


# /main/ is not generated by this renderer - it is a hand-maintained page - but
# its seven chooser cards were seven hand-written literals of data this file
# already owns. They carried a title and a link and discarded chooserDescription,
# accent, soft and icon, so the same seven audiences read as a plain directory on
# /main/ and as designed cards on /. Species 14: the cards are now generated from
# the data, spliced between markers the same way tools/stamp-data.py splices its
# stamp, and --check covers the result.
MAIN_PAGE = ROOT / "main" / "index.html"
CARDS_BEGIN = "<!-- MBM-AUDIENCE-CARDS:BEGIN generated by tools/render_audience_homepages.py, do not edit by hand -->"
CARDS_END = "<!-- MBM-AUDIENCE-CARDS:END -->"


def main_audience_cards(data: dict[str, Any]) -> str:
    cards = []
    for index, (aid, audience) in enumerate(data["audiences"].items(), start=1):
        cards.append(
            f'<article class="mbm-audience-card" data-index="{index:02d}" role="listitem"'
            f' style="--card-accent:{esc(audience["accent"])};--card-soft:{esc(audience["soft"])}">'
            f'<span class="mbm-audience-icon" aria-hidden="true">{icon(audience["icon"], "mbm-audience-glyph")}</span>'
            f'<h3>{esc(audience["label"])}</h3>'
            f'<p class="mbm-audience-desc">{esc(audience["chooserDescription"])}</p>'
            f'<div class="mbm-audience-links">'
            f'<a href="{esc(audience["route"])}">{esc(audience["chooserLinkText"])}</a>'
            f'</div></article>'
        )
    return "".join(cards)


# hud.js is the estate-wide floating control layer. It is served to games,
# apps, registers and lessons from the site origin, and it now offers a second
# control that opens the homepage the visitor chose.
#
# It cannot read data/audience-homepages.json at run time. A fetch on a game's
# load path would put a request in front of a child mid-session, break the
# offline promise, and trip the estate-wide "no third party at page load"
# assertion PR #114 spent its whole length earning. So the routes and labels
# are GENERATED into the file between markers, the same way stamp-data.py
# splices its stamp and the same way /main/'s cards are spliced - and --check
# fails if the region drifts from the data.
#
# Unlike the /main/ cards, this splice REQUIRES its markers. The first-run
# branch below them is what produced species 20: a regex that matched one card
# of seven and left six duplicates outside the region, where a byte-exact check
# could not see them. There is no first-run branch here.
HUD_JS = ROOT / "hud.js"
HUD_BEGIN = "  /* MBM-HOMEPAGE-CHOICES:BEGIN generated by tools/render_audience_homepages.py, do not edit by hand */"
HUD_END = "  /* MBM-HOMEPAGE-CHOICES:END */"

# The second generated region in hud.js, from a different source: the canonical
# game inventory. hud.js decided what kind of page it was on from four path
# patterns, and the site's own root-level games - /echovault/, /relicforge/,
# /fracture/, /olympics/ and the rest - matched none of them. A script tag
# alone gave them nothing, because BACK resolved null and mount() had nothing
# to append. That is the whole reason they were stranded.
#
# The fix is a derived set, not a fifth pattern. A fifth pattern would be a
# hand-written second copy of an inventory this estate already keeps, and it
# would go stale the first time a game shipped.
SEARCH_INDEX = ROOT / "data" / "mbm-search-index.json"
ROOT_GAMES_BEGIN = "  /* MBM-ROOT-GAMES:BEGIN generated by tools/render_audience_homepages.py, do not edit by hand */"
ROOT_GAMES_END = "  /* MBM-ROOT-GAMES:END */"
# A site root-level game is a search-index entry of category "game" whose route
# is a single path segment. Everything else with that category lives under
# /Lessons/ or /Games/, which hud.js already recognises by path.
ROOT_GAME_ROUTE = re.compile(r"^/[A-Za-z0-9_-]+/$")


def root_game_routes() -> list[str]:
    index = json.loads(SEARCH_INDEX.read_text(encoding="utf-8"))
    routes = {
        entry["route"] for entry in index["entries"]
        if entry.get("category") == "game" and ROOT_GAME_ROUTE.match(entry.get("route", ""))
    }
    if not routes:
        raise SystemExit(
            "data/mbm-search-index.json yielded no root-level game routes. Generating an empty set "
            "would silently strand every root game again, so this is a failure, not an empty region."
        )
    return sorted(routes)


def hud_root_games(routes: list[str] | None = None) -> str:
    routes = root_game_routes() if routes is None else routes
    body = ",".join(f"{json.dumps(route)}:1" for route in routes)
    return (
        f"{ROOT_GAMES_BEGIN}\n"
        f"  var ROOT_GAMES = {{{body}}};\n"
        f"{ROOT_GAMES_END}"
    )


def hud_homepage_choices(data: dict[str, Any]) -> str:
    """The eight homepage types as hud.js needs them: stored value -> route, label.

    Keys are quoted rather than bare. Every current ID is a valid JavaScript
    identifier, so quoting changes nothing today - and it means an ID that is
    not one can never turn generated data into a syntax error on every game in
    the estate.
    """
    choices = [(aid, a["route"], a["label"]) for aid, a in data["audiences"].items()]
    main = data["mainOption"]
    choices.append((main["id"], main["route"], main["label"]))
    body = ",".join(
        f'{json.dumps(aid)}:{{r:{json.dumps(route)},l:{json.dumps(label)}}}'
        for aid, route, label in choices
    )
    return (
        f"{HUD_BEGIN}\n"
        f"  var HOME_KEY = {json.dumps(data['preferenceKey'])};\n"
        f"  var HOMES = {{{body}}};\n"
        f"{HUD_END}"
    )


def _splice_region(source: str, begin: str, end_marker: str, generated: str, name: str) -> str:
    start = source.find(begin)
    if start < 0:
        raise SystemExit(
            f"hud.js: the {name} region is missing. It is not generated into place - the markers "
            f"belong to hud.js and this tool only fills between them."
        )
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"hud.js: unterminated {name} region")
    return source[:start] + generated + source[end + len(end_marker):]


def spliced_hud_js(data: dict[str, Any], source: str | None = None) -> str:
    source = HUD_JS.read_text(encoding="utf-8") if source is None else source
    source = _splice_region(source, HUD_BEGIN, HUD_END, hud_homepage_choices(data), "MBM-HOMEPAGE-CHOICES")
    return _splice_region(source, ROOT_GAMES_BEGIN, ROOT_GAMES_END, hud_root_games(), "MBM-ROOT-GAMES")


def spliced_main_page(data: dict[str, Any]) -> str:
    html = MAIN_PAGE.read_text(encoding="utf-8")
    generated = CARDS_BEGIN + main_audience_cards(data) + CARDS_END
    start = html.find(CARDS_BEGIN)
    if start >= 0:
        end = html.find(CARDS_END, start)
        if end < 0:
            raise SystemExit("main/index.html: unterminated MBM-AUDIENCE-CARDS region")
        return html[:start] + generated + html[end + len(CARDS_END):]
    # First run only: replace the contiguous run of hand-written cards. Anchored
    # on the run itself rather than on the grid's closing tag, because the cards
    # contain nested divs and a naive </div> match would cut in the wrong place.
    run = re.search(r'(?:<article class="mbm-audience-card"[\s\S]*?</article>)+', html)
    if not run:
        raise SystemExit("main/index.html: no audience cards found to generate over")
    return html[:run.start()] + generated + html[run.end():]


def studio_band(data: dict[str, Any]) -> str:
    """The compact studio band at the foot of the chooser.

    Rendered from data, never hand-written, so the About line and the support
    destination live in the file that owns them. Deliberately small: an About
    line, quiet text links and the adult signpost. No tiers, no amounts, no
    primary button, no /account/ or /members/ route, no widget or script - a
    Ko-fi embed would put a third-party request on the front door, which PR #114
    spent its whole length removing.

    Mailing is NOT duplicated here. The estate already has a mechanism -
    reflectMailingFooter() injects a plain text link into the footer bar unless
    data-mbm-mailing-footer is "off" or adultFeaturesAllowed() is false - so the
    chooser enables that rather than growing a second one. The pupil page keeps
    its protection through the second condition, which is untouched.
    """
    band = data["studioBand"]
    links = "".join(
        f'<a class="mf-band-link" href="{esc(link["href"])}"'
        + (' rel="noopener external" target="_blank"' if link.get("external") else "")
        + f'>{esc(link["label"])}</a>'
        for link in band["links"]
    )
    return (
        '<section class="mf-section mf-studio-band" aria-labelledby="studio-band-title">'
        '<div class="mf-wrap"><div class="mf-band">'
        f'<p class="mf-band-signpost" id="studio-band-title">{esc(band["signpost"])}</p>'
        f'<p class="mf-band-about">{esc(band["about"])}</p>'
        f'<p class="mf-band-links">{links}</p>'
        '</div></div></section>'
    )


def outputs(data: dict[str, Any]) -> dict[Path, str]:
    result = {ROOT / "index.html": chooser_page(data), ROOT / "start" / "index.html": start_redirect()}
    for aid, audience in data["audiences"].items():
        result[ROOT / audience["route"].strip("/") / "index.html"] = audience_page(data, aid, audience)
    result[MAIN_PAGE] = spliced_main_page(data)
    result[HUD_JS] = spliced_hud_js(data)
    return result


SECTION_REQUIRED = {
    "features": ["features"],
    "routes": ["items"],
    "tips": ["items"],
    "faq": ["items"],
    "video": ["poster", "videoId", "titleText"],
    "tasks": [],
    "surprise": [],
    # Both derive their content from the games record rather than carrying it,
    # so neither requires a key naming games — requiring one would be requiring
    # the hand-list this pass removed.
    "toppicks": [],
    "genres": [],
    "recent": []
}


MAIN_OPTION_KEYS = ("id", "route", "label", "chooserDescription", "chooserLinkText", "accent", "soft", "icon")


def validate_main_option(data: dict[str, Any]) -> dict[str, Any]:
    """The platform option, and the one shape mistake that would destroy a page.

    `mainOption` is a homepage type a visitor can choose, held outside
    `audiences` on purpose. The reason is mechanical and unforgiving: outputs()
    writes ROOT/<route>/index.html for every member of `audiences`, so a `main`
    entry there would render an audience_page() over the hand-maintained
    /main/ - 72 KB of preserved homepage replaced by a generated face, in one
    render, with --check going green afterwards because the committed file
    would then match what the renderer produces. So it is rejected by name and
    with the consequence spelled out, not left to the ID-set mismatch below,
    whose message says nothing about what would have happened.
    """
    if "main" in data.get("audiences", {}):
        raise SystemExit(
            "audiences must not contain 'main': /main/ is hand-maintained, and outputs() renders "
            "an audience page over ROOT/<route>/index.html for every member of audiences, so this "
            "would overwrite main/index.html. The platform option belongs in the mainOption key."
        )
    main = data.get("mainOption")
    if not isinstance(main, dict):
        raise SystemExit("mainOption is missing; the chooser cannot offer /main/ as a homepage type without it")
    for key in MAIN_OPTION_KEYS:
        if not str(main.get(key, "")).strip():
            raise SystemExit(f"mainOption: {key!r} is required")
    if main["id"] != "main":
        raise SystemExit(f"mainOption: id must be 'main', got {main['id']!r}; it is the stored preference value")
    if main["route"] != "/main/":
        raise SystemExit(f"mainOption: route must be '/main/', got {main['route']!r}")
    if main["icon"] not in ICONS:
        raise SystemExit(f"mainOption: unknown icon {main['icon']!r}")
    if main["id"] in data.get("audiences", {}):
        raise SystemExit("mainOption id collides with an audience ID")
    taken_routes = {a["route"] for a in data.get("audiences", {}).values()}
    if main["route"] in taken_routes:
        raise SystemExit("mainOption route collides with an audience route")
    # Colour is never the only cue here, but a duplicate accent or a duplicate
    # glyph would make the platform card read as one of the seven. Contrast and
    # separation are measured by tools/check_audience_accents.py, which reads
    # this record; what belongs here is only that it is its own.
    for field in ("accent", "soft", "icon"):
        clash = [aid for aid, a in data.get("audiences", {}).items() if a.get(field) == main[field]]
        if clash:
            raise SystemExit(f"mainOption: {field} {main[field]!r} is already used by {clash[0]}")
    return main


def validate(data: dict[str, Any]) -> None:
    validate_main_option(data)
    expected = {"pupils", "teachers", "parents", "schools", "trusts", "councils", "partners"}
    actual = set(data.get("audiences", {}))
    if actual != expected:
        raise SystemExit(f"audience IDs differ: expected {sorted(expected)}, got {sorted(actual)}")
    routes = [a["route"] for a in data["audiences"].values()]
    if len(routes) != len(set(routes)):
        raise SystemExit("audience routes are not unique")
    if data.get("preferenceKey") != "mbm_audience_view":
        raise SystemExit("stable audience preference key changed")

    grouped = [aid for group in data["groups"] for aid in group["audiences"]]
    if sorted(grouped) != sorted(expected):
        raise SystemExit("every audience must appear in exactly one chooser group")

    for aid, audience in data["audiences"].items():
        if not audience["route"].startswith("/for/") or not audience["route"].endswith("/"):
            raise SystemExit(f"{aid}: invalid stable route")
        for section in audience["sections"]:
            kind = section.get("type")
            if kind not in SECTION_REQUIRED:
                raise SystemExit(f"{aid}: unknown section type {kind!r}")
            for key in SECTION_REQUIRED[kind]:
                if key not in section:
                    raise SystemExit(f"{aid}/{section['id']}: {kind} section needs {key!r}")
            for feature in section.get("features", []):
                source = feature["image"].split("?", 1)[0].lstrip("/")
                if not (ROOT / source).is_file():
                    raise SystemExit(f"{aid}: promoted image does not exist: {feature['image']}")
                if not feature.get("alt"):
                    raise SystemExit(f"{aid}: promoted image has no alt text: {feature['id']}")
        # Every audience homepage uses the shared hero mark. A per-audience
        # hero image would reintroduce the small-duplicate-logo treatment the
        # pupil page was corrected for, so the field is rejected outright.
        if not audience.get("chooserLinkText", "").strip():
            raise SystemExit(f"{aid}: chooserLinkText is required; it is the visible link text on /main/")
        for key in ("heroImage", "heroImageAlt", "heroSearchId"):
            if key in audience:
                raise SystemExit(f"{aid}: {key} is no longer supported; the shared hero mark is used on every audience homepage")


def self_test() -> int:
    """Prove the mainOption guards fire, by breaking the record seven ways.

    Every control mutates a copy of the shipped data and expects validate() to
    reject it for the stated reason. Two things this does deliberately. It
    validates the real data first and stops if that fails - a control run
    against already-invalid data would "pass" on the pre-existing rejection and
    prove nothing. And it matches the reason, not merely the rejection: a guard
    that fires for the wrong reason is a guard that is not testing what its
    label claims.
    """
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    try:
        validate(data)
    except SystemExit as exc:
        print(f"[FAIL] precondition: the shipped data does not validate, so no control below can be "
              f"told apart from that failure: {exc}")
        return 1

    problems = 0

    def control(label: str, break_it, expected: str) -> None:
        nonlocal problems
        broken = json.loads(json.dumps(data))
        break_it(broken)
        try:
            validate(broken)
        except SystemExit as exc:
            if expected.lower() in str(exc).lower():
                print(f"[PASS] positive control: {label}")
                return
            print(f"[FAIL] {label}: rejected, but for another reason: {exc}")
        else:
            print(f"[FAIL] positive control not detected: {label}")
        problems += 1

    def set_main(key: str, value: Any):
        return lambda d: d["mainOption"].__setitem__(key, value)

    audience_accent = next(iter(data["audiences"].values()))["accent"]
    audience_icon = next(iter(data["audiences"].values()))["icon"]

    control("main added to audiences",
            lambda d: d["audiences"].__setitem__("main", dict(d["mainOption"])),
            "audiences must not contain 'main'")
    control("mainOption removed", lambda d: d.pop("mainOption"), "mainOption is missing")
    control("mainOption route repointed", set_main("route", "/main-platform/"), "route must be '/main/'")
    control("mainOption id renamed", set_main("id", "platform"), "id must be 'main'")
    control("mainOption accent duplicates an audience", set_main("accent", audience_accent), "is already used by")
    control("mainOption icon duplicates an audience", set_main("icon", audience_icon), "is already used by")
    control("mainOption chooserLinkText emptied", set_main("chooserLinkText", "  "), "'chooserLinkText' is required")

    # hud.js carries a generated region because it cannot read the data file at
    # run time. That makes --check the only thing standing between the estate's
    # games and a stale route table, so it gets its own controls: one proving a
    # data change alone makes the committed file stale, one proving the splice
    # refuses a file whose markers have gone.
    committed_hud = HUD_JS.read_text(encoding="utf-8")
    if spliced_hud_js(data) != committed_hud:
        print("[FAIL] precondition: hud.js is already stale against the data, so the control below "
              "cannot be told apart from that")
        problems += 1
    else:
        moved = json.loads(json.dumps(data))
        moved["audiences"]["teachers"]["label"] = "Teachers, moved by a control"
        if spliced_hud_js(moved) == committed_hud:
            print("[FAIL] positive control not detected: a label change alone leaves hud.js unchanged, "
                  "so --check could never see the data move")
            problems += 1
        else:
            print("[PASS] positive control: a data change alone makes the committed hud.js stale")

    # The root-game map has the same shape of risk from a different source, and
    # a worse failure mode: a stale or empty set does not break a page, it
    # silently strands every game in it - which is the state this repair found.
    routes = root_game_routes()
    print(f"[INFO] root-game inventory: {len(routes)} single-segment game route(s) from "
          f"{SEARCH_INDEX.relative_to(ROOT)}")
    # Two directions, because they fail differently and the first draft of this
    # control tested neither. A control that regenerates the region and compares
    # it to the correct file is asking whether the generator repairs its own
    # output; it always does, and it proves nothing about --check.
    #
    # 1. The inventory moves and the committed file does not: a new game ships.
    shipped = _splice_region(committed_hud, ROOT_GAMES_BEGIN, ROOT_GAMES_END,
                             hud_root_games(routes + ["/a-new-game/"]), "MBM-ROOT-GAMES")
    if shipped == committed_hud:
        print("[FAIL] positive control not detected: a game added to the inventory changes nothing in hud.js")
        problems += 1
    else:
        print("[PASS] positive control: a game entering the inventory makes the committed hud.js stale")
    # 2. The committed region is edited by hand and the inventory does not move:
    #    entries are dropped, and every game in them is stranded again in
    #    silence, because a missing back control is not an error anywhere.
    thinned = _splice_region(committed_hud, ROOT_GAMES_BEGIN, ROOT_GAMES_END,
                             hud_root_games(routes[:1]), "MBM-ROOT-GAMES")
    if spliced_hud_js(data, thinned) != thinned:
        print(f"[PASS] positive control: a hand-thinned root-game map ({len(routes)} routes down to 1) "
              f"is caught by --check")
    else:
        print("[FAIL] positive control not detected: --check cannot see a hand-thinned root-game map")
        problems += 1

    without_markers = committed_hud.replace(HUD_BEGIN, "  /* gone */", 1)
    try:
        spliced_hud_js(data, without_markers)
    except SystemExit as exc:
        if "region is missing" in str(exc):
            print("[PASS] positive control: the splice refuses a hud.js whose markers have gone")
        else:
            print(f"[FAIL] marker control: refused for another reason: {exc}")
            problems += 1
    else:
        print("[FAIL] positive control not detected: the splice accepted a hud.js with no markers")
        problems += 1

    # The first control's premise, shown rather than asserted: the path
    # outputs() would compute for an audience routed at /main/ is the
    # hand-maintained page itself. Read-only - it compares paths, it does not
    # render.
    collision = ROOT / "/main/".strip("/") / "index.html"
    if collision != MAIN_PAGE:
        print(f"[FAIL] the overwrite hazard the first control guards is no longer real: "
              f"outputs() would write {collision}, not {MAIN_PAGE}")
        problems += 1
    else:
        print(f"[PASS] hazard is real: an audience routed at /main/ would render over {MAIN_PAGE.relative_to(ROOT)}")

    print(f"\n{'[FAIL]' if problems else '[PASS]'} mainOption self-test: {problems} problem(s)")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if committed HTML differs from rendered output")
    parser.add_argument("--self-test", action="store_true", help="prove the mainOption guards fire")
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(1 if self_test() else 0)
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    validate(data)
    changed: list[str] = []
    for path, content in outputs(data).items():
        content = content.replace("\r\n", "\n")
        current = path.read_text(encoding="utf-8") if path.exists() else ""
        if current != content:
            changed.append(str(path.relative_to(ROOT)))
            if not args.check:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
    if args.check and changed:
        print("Generated audience HTML is stale:", file=sys.stderr)
        for path in changed:
            print(f"  - {path}", file=sys.stderr)
        raise SystemExit(1)
    if changed and not args.check:
        print(f"Rendered {len(changed)} page(s): {', '.join(changed)}")
    else:
        print("Audience homepage HTML is current")


if __name__ == "__main__":
    main()
