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
    "collaborate": '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.8 20v-2.1A4.9 4.9 0 0 1 7.7 13h.6a4.9 4.9 0 0 1 3.7 1.7M12 20v-2.1a4.9 4.9 0 0 1 4.9-4.9h.6a4.9 4.9 0 0 1 4.9 4.9V20"/>'
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
<link rel="canonical" href="{canonical(route)}"><link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
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


def footer(label: str, *, quiet: bool = False) -> str:
    quiet_attr = ' data-mbm-mailing-cta="off"' if quiet else ""
    return f'''<footer class="footer mf-footer"{quiet_attr}><div class="bar">{brand()}<span class="muted">{esc(label)} · <a href="/main/">Main homepage</a> · <a href="/">Choose homepage</a> · <a href="/privacy/">Privacy</a></span></div></footer>'''


def scripts() -> str:
    return '<script defer src="/theme.js"></script><script defer src="/assets/mbm-audience.js"></script><script defer src="/assets/mbm-search.js"></script><script defer src="/assets/mbm-recent.js"></script><script defer src="/assets/mbm-platform.js"></script>'


def hero_copy(audience: dict[str, Any]) -> str:
    ctas = "".join(
        f'<a class="mf-btn {esc(item["style"])}" href="{esc(item["href"])}">{esc(item["label"])}</a>'
        for item in audience["primaryCtas"]
    )
    return f'''<div class="mf-hero-copy"><p class="mf-kicker">A Made by Matt homepage</p><h1 id="page-title">{esc(audience['title'])}</h1><p class="mf-lead">{esc(audience['lead'])}</p><div class="mf-actions">{ctas}</div><div class="mf-home-links"><a href="/main/">Main homepage</a><a href="/">Choose another homepage</a></div></div>'''


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
        f'''<a class="mf-task-card" style="--task-accent:{accent}" href="/teach/?task={slug}"><span>{index + 1:02d}</span><strong>{title}</strong><small>{blurb}</small><b>Open this teacher route <i aria-hidden="true">→</i></b></a>'''
        for index, (slug, accent, title, blurb) in enumerate(TEACHER_TASKS)
    )
    return f'{section_head(section)}<div class="mf-task-grid">{cards}</div>'


def video_body(section: dict[str, Any]) -> str:
    return f'''{section_head(section)}<div class="mf-video-shell" data-mbm-video-shell><button type="button" class="mf-video-poster" data-mbm-video="{esc(section['videoId'])}" aria-label="Play {esc(section['titleText'])}"><img src="{esc(section['poster'])}" alt="{esc(section['titleText'])} poster" width="1280" height="720" loading="lazy"><span aria-hidden="true">▶</span><b>Play demonstration</b></button><p>No YouTube request is made until the play control is activated.</p></div>'''


def surprise_body(audience: dict[str, Any], section: dict[str, Any]) -> str:
    return f'''<div class="mf-surprise-card"><div><p>{esc(section['kicker'])}</p><h2>{esc(section['title'])}</h2><span>{esc(section['lead'])}</span></div><button class="mf-btn primary" type="button" data-mbm-surprise>Choose a game</button><p class="mf-surprise-result" data-mbm-surprise-result aria-live="polite"></p></div>'''


def recent_body(section: dict[str, Any]) -> str:
    return f'''<div class="mf-recent-head"><div><p>Local-only shortcut</p><h2>{esc(section['title'])}</h2><span>{esc(section['lead'])}</span></div><button type="button" data-mbm-recent-clear>Clear</button></div><p data-mbm-recent-empty>Nothing has been opened from a Made by Matt discovery card on this device yet.</p><div class="mbm-recent-grid" data-mbm-recent-items></div>'''


def surprise_set(audience: dict[str, Any]) -> str:
    """The pupil-safe shuffle set, derived from the page's own game cards.

    Deriving it here means the button can never offer something the page does
    not itself promote.
    """
    entries = []
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
    return f'''<section class="mf-switch" aria-labelledby="switch-title"><div class="mf-wrap"><div class="mf-switch-head"><p>One platform · several front doors</p><h2 id="switch-title">Choose another homepage</h2></div><div class="mf-switch-grid">{"".join(links)}</div><div class="mf-switch-actions"><a class="mf-btn primary" href="/main/">Main Made by Matt homepage</a><a class="mf-btn quiet" href="/">Choose homepage</a></div></div></section>'''


def audience_page(data: dict[str, Any], aid: str, audience: dict[str, Any]) -> str:
    body_attrs = f'data-mbm-audience-face="{esc(aid)}"'
    if not audience.get("adultFeatures"):
        body_attrs += ' data-mbm-adult-features="off" data-mbm-mailing-footer="off"'
    sections = "".join(content_section(audience, section, i) for i, section in enumerate(audience["sections"]))
    description = audience["lead"]
    return f'''<!doctype html>
<!-- {SENTINEL} -->
<html lang="en-GB">{head(f"{audience['label']} · Made by Matt", description, audience['route'])}<body class="mbm-face-page" {body_attrs} style="--face-accent:{esc(audience['accent'])};--face-accent-visual:{esc(audience.get('accentVisual') or audience['accent'])};--face-soft:{esc(audience['soft'])}">
<a class="skip" href="#main">Skip to content</a>{general_header(current=audience['route'], audience=audience)}<main id="main">{hero(audience)}{sections}{utility_section(audience)}{note_section(audience)}{switcher(data, aid)}</main>{footer(audience['label'], quiet=not audience.get('adultFeatures'))}{scripts()}</body></html>
'''


def chooser_card(aid: str, audience: dict[str, Any]) -> str:
    return f'''<a class="mf-choice" data-mbm-face-choice="{esc(aid)}" data-mbm-face-label="{esc(audience['label'])}" href="{esc(audience['route'])}" style="--choice-accent:{esc(audience['accent'])};--choice-soft:{esc(audience['soft'])}"><span class="mf-last">Last used on this device</span><span class="mf-choice-icon">{icon(audience['icon'])}</span><span class="mf-choice-copy"><strong>{esc(audience['label'])}</strong><small>{esc(audience['chooserDescription'])}</small></span><span class="mf-arrow" aria-hidden="true">→</span></a>'''


def root_search() -> str:
    return f'''<div class="mf-root-search"><form class="mbm-search-form" action="/resources/" method="get" role="search" data-mbm-search="suggest" data-mbm-limit="6"><label class="mbm-search-label" for="root-search">Search Made by Matt</label><div class="mbm-search-field">{SEARCH_ICON}<input id="root-search" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Try a subject, game, pathway or tool" aria-describedby="root-search-status"><div class="mbm-suggestions" id="root-search-suggestions" data-mbm-suggestions hidden></div></div><button class="mbm-search-submit" type="submit">Search</button><span class="mbm-search-status" id="root-search-status" data-mbm-search-status aria-live="polite"></span></form></div>'''


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
<a class="skip" href="#main">Skip to content</a>{general_header(current="/", chooser=True)}<main id="main"><section class="mf-hero mf-discovery-hero" aria-labelledby="page-title"><div class="mf-hero-texture" aria-hidden="true"></div><div class="mf-wrap mf-hero-grid"><div class="mf-mark-stage"><span class="mf-halo mf-halo-one" aria-hidden="true"></span><span class="mf-halo mf-halo-two" aria-hidden="true"></span><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640" fetchpriority="high"><span class="mf-audience-badge mf-platform-badge">{icon('network', 'mf-badge-icon')}<span>One live platform</span></span></div><div class="mf-hero-copy"><p class="mf-kicker">Made by Matt · discover what you need</p><h1 id="page-title">{esc(root['title'])}</h1><p class="mf-lead">{esc(root['lead'])}</p><div class="mf-actions"><a class="mf-btn primary" href="{esc(cta['href'])}">{esc(cta['label'])}</a></div>{root_search()}</div></div></section>{root_highlights()}<section class="mf-choices" id="homepage-choices" aria-labelledby="audience-title"><div class="mf-wrap"><div class="mf-choice-intro"><p>Choose a relevant front door</p><h2 id="audience-title">{esc(root['audienceHeading'])}</h2><span>All seven homepages lead into the same public Made by Matt platform. Choose by person or organisation. Choosing one does not create an account, change permissions or hide public content.</span><nav aria-label="Audience groups">{"".join(nav_links)}</nav></div>{"".join(groups)}<div class="mf-continue" data-mbm-face-continue aria-live="polite"><span><b>Last used on this device</b><small>This preference stays in this browser. It is not an account, profile, consent choice or tracking identifier, and it is not sent to Supabase, Buttondown or analytics.</small></span><span class="mf-continue-actions"><a href="/">Continue</a><button class="mf-clear" type="button" data-mbm-face-clear>Forget this preference</button></span></div></div></section><section class="mf-section mf-note-section"><div class="mf-wrap"><div class="mf-note"><span class="mf-note-mark" aria-hidden="true">{icon('spark')}</span><div><p class="mf-note-kicker">Nothing is locked by this choice</p><h2>Different homepages, the same public platform</h2><p>Audience selection changes presentation and navigation only. It does not authenticate anyone, create a child profile, grant permissions or prevent a visitor from opening another public part of the site.</p></div></div></div></section>{studio_band(data)}</main>{footer("Discovery homepage", quiet=True)}{scripts()}</body></html>
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
    return result


SECTION_REQUIRED = {
    "features": ["features"],
    "routes": ["items"],
    "tips": ["items"],
    "faq": ["items"],
    "video": ["poster", "videoId", "titleText"],
    "tasks": [],
    "surprise": [],
    "recent": []
}


def validate(data: dict[str, Any]) -> None:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if committed HTML differs from rendered output")
    args = parser.parse_args()
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
