#!/usr/bin/env python3
"""Render the two data-driven discovery hubs.

`/teach/`          teacher-first composition over the shared search index
`/education-hub/`  Made by Matt material beside curated external publishers

Both pages are generated. This module is their only writer. Every product
name, route and count emitted here is resolved against real entries in
`data/mbm-search-index.json` / `data/education-hub.json`; an editorial id that
no longer resolves is a hard failure rather than a silently dropped card.

  python3 tools/render_discovery_hubs.py           # write both pages
  python3 tools/render_discovery_hubs.py --check   # fail if either is stale
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# The sentinel is owned by render_audience_homepages.py. Importing it keeps
# one definition; a second copy here would drift the moment that one moved.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_audience_homepages import SENTINEL  # noqa: E402
ORIGIN = "https://madebymatt.uk"

INDEX_PATH = ROOT / "data" / "mbm-search-index.json"
EDUCATION_PATH = ROOT / "data" / "education-hub.json"

TEACH_PAGE = ROOT / "teach" / "index.html"
EDUCATION_PAGE = ROOT / "education-hub" / "index.html"


def J(*parts: str) -> str:
    return "".join(parts)


# --------------------------------------------------------------------------
# shared chrome
# --------------------------------------------------------------------------

PRIMARY_LINKS = [
    ("/", "Discover"),
    ("/main/", "Main homepage"),
    ("/teach/", "Teach"),
    ("/resources/", "Resources"),
    ("/education-hub/", "Education Hub"),
]

MORE_LINKS = [
    ("/games/", "Games"),
    ("/Lessons/", "Lessons"),
    ("/Matt-s-Apps-/", "Apps"),
    ("/tools/", "Tools"),
    ("/stats/", "Stats"),
    ("/main/#about", "About"),
    ("/account/", "Account"),
    ("/members/", "Members"),
    ("/mailing-list/", "Teacher updates"),
    ("/privacy/", "Privacy"),
]


def head_lines(*, title: str, description: str, path: str) -> list[str]:
    """The five head segments, in the order the shipped pages serialise them."""
    return [
        J(
            '<html lang="en-GB"><head><meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
        ),
        J(
            f'<meta name="mbm-platform-version" content="{SENTINEL}">',
            f"<title>{title}</title>",
            f'<meta name="description" content="{description}">',
            '<meta name="theme-color" content="#161D3D">',
        ),
        J(
            f'<link rel="canonical" href="{ORIGIN}{path}">',
            f'<meta property="og:title" content="{title}">',
            f'<meta property="og:description" content="{description}">',
            f'<meta property="og:url" content="{ORIGIN}{path}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:site_name" content="Made by Matt">',
            f'<meta property="og:image" content="{ORIGIN}/assets/og-cover.png">',
            '<meta name="twitter:card" content="summary_large_image">',
        ),
        J(
            '<link rel="icon" href="/favicon.svg">',
            '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
            '<link rel="manifest" href="/site.webmanifest">',
            '<link rel="stylesheet" href="/styles.css">',
            '<link rel="stylesheet" href="/assets/mbm-platform.css">',
            '<link rel="stylesheet" href="/assets/mbm-search.css">',
        ),
        J(
            '<script type="application/ld+json">',
            json.dumps(
                {
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "name": title,
                    "description": description,
                    "url": f"{ORIGIN}{path}",
                    "isPartOf": {
                        "@type": "WebSite",
                        "name": "Made by Matt",
                        "url": f"{ORIGIN}/",
                    },
                },
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            "</script></head>",
            '<body class="mbm-hub-page" data-mbm-mailing-footer="off">',
            '<a class="skip" href="#main">Skip to content</a>',
        ),
    ]


def header_lines() -> list[str]:
    primary = J(*[f'<a href="{href}">{label}</a>' for href, label in PRIMARY_LINKS])
    more = J(*[f'<a href="{href}">{label}</a>' for href, label in MORE_LINKS])
    return [
        '<header class="header mbm-site-header"><div class="bar">',
        J(
            '<a class="brand" href="/main/">',
            '<img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100">',
            "<span><strong>MADE BY MATT</strong>",
            "<small>Learn • Build • Explore</small></span></a>",
        ),
        '<button class="menu" id="menu" type="button" aria-expanded="false" aria-controls="nav">Menu</button>',
        J(
            '<nav class="nav mbm-site-nav" id="nav" aria-label="Site navigation">',
            f'<div class="mbm-primary-links">{primary}</div>',
            '<details class="mbm-nav-more"><summary>More</summary>',
            f'<div class="mbm-nav-panel">{more}</div></details>',
            '<details class="mbm-theme-menu"><summary>Display</summary>',
            '<div class="mbm-theme-panel"><div class="mbm-theme-slot" data-mbm-theme-slot></div></div>',
            "</details></nav>",
        ),
    ]


def footer() -> str:
    return J(
        '<footer class="footer"><div class="bar">',
        '<a class="brand" href="/main/">',
        '<img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100">',
        "<span><strong>MADE BY MATT</strong>",
        "<small>Learn • Build • Explore</small></span></a>",
        '<span class="muted">Public learning, games, tools and resources · ',
        '<a href="/privacy/" style="color:inherit;font-weight:700">Data and privacy</a></span></div>',
        '<p class="mbm-contact" style="text-align:center;font-size:.85rem;opacity:.85;'
        'margin:16px auto 10px;max-width:90%">Questions, ideas or bug reports — ',
        '<a href="mailto:contactmadebymatt@gmail.com" style="color:inherit;font-weight:700">'
        "contactmadebymatt@gmail.com</a></p></footer>",
        '<script defer src="/assets/mbm-search.js"></script>',
        '<script defer src="/assets/mbm-recent.js"></script>',
        '<script defer src="/assets/mbm-platform.js"></script>',
        "</body></html>",
    )


SEARCH_SVG = (
    '<svg viewBox="0 0 24 24" aria-hidden="true">'
    '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/></svg>'
)


def search_form(*, action: str, field_id: str, label: str, placeholder: str,
                describedby: str = "") -> str:
    described = f' aria-describedby="{describedby}"' if describedby else ""
    return J(
        f'<form class="mbm-search-form" action="{action}" method="get" role="search" data-mbm-search-form>',
        f'<label class="mbm-search-label" for="{field_id}">{label}</label>',
        '<div class="mbm-search-field">',
        SEARCH_SVG,
        f'<input id="{field_id}" name="q" type="search" autocomplete="off" '
        f'enterkeyhint="search" placeholder="{placeholder}"{described}>',
        "</div>",
        '<button class="mbm-search-submit" type="submit">Search</button></form>',
    )


def select_filter(*, key: str, field_id: str, label: str,
                  options: list[tuple[str, str]] | None = None,
                  wrap_details: bool = False) -> str:
    opts = J('<option value="">All</option>',
             *[f'<option value="{v}">{t}</option>' for v, t in (options or [])])
    control = J(
        f'<label for="{field_id}">{label}</label>',
        f'<select id="{field_id}" name="{key}" data-mbm-filter="{key}">{opts}</select>',
    )
    if wrap_details:
        return f'<div class="mbm-filter"><details><summary>{label}</summary>{control}</details></div>'
    return f'<div class="mbm-filter">{control}</div>'


def sort_control(options: list[tuple[str, str]]) -> str:
    opts = J(*[f'<option value="{v}">{t}</option>' for v, t in options])
    return J(
        '<label class="mbm-sort-wrap">Sort ',
        f'<select data-mbm-sort name="sort">{opts}</select></label>',
    )


def section_heading(kicker: str, heading_id: str, heading: str, note: str) -> str:
    return J(
        '<div class="mbm-section-heading">',
        f"<p>{kicker}</p>",
        f'<h2 id="{heading_id}">{heading}</h2>',
        f"<span>{note}</span></div>",
    )


def start_card(href: str, small: str, strong: str, span: str) -> str:
    """A route card. An external href is marked and made safe HERE, because the
    JavaScript-free fallback grid on the Education Hub mixes internal routes
    with four gov.uk / EEF links, and those were rendering as plain in-site
    cards: no target, no rel, and nothing to say the link leaves Made by Matt.
    Deciding that at the single point every card passes through means no future
    caller can reintroduce it by adding one more row to a list."""
    external = href.startswith("http://") or href.startswith("https://")
    attrs = ' target="_blank" rel="noopener noreferrer external"' if external else ""
    mark = ' <span class="mbm-outbound-mark" aria-hidden="true">\u2197</span>' if external else ""
    leaves = "<small>Leaves Made by Matt</small>" if external else ""
    return J(
        f'<a class="mbm-start-card" href="{href}"{attrs}>',
        f"<small>{small}</small><strong>{strong}{mark}</strong><span>{span}</span>{leaves}</a>",
    )


# --------------------------------------------------------------------------
# data helpers
# --------------------------------------------------------------------------


def load_index() -> dict:
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def load_education() -> dict:
    return json.loads(EDUCATION_PATH.read_text(encoding="utf-8"))


def entry_map(index: dict) -> dict:
    return {e["id"]: e for e in index["entries"]}


def resolve(entries: dict, entry_id: str) -> dict:
    """Editorial ids must resolve. A stale id fails the render, never ships."""
    if entry_id not in entries:
        raise SystemExit(
            f"render_discovery_hubs: editorial id '{entry_id}' is not in the search index"
        )
    return entries[entry_id]


# --------------------------------------------------------------------------
# /teach/
# --------------------------------------------------------------------------

TEACH_TITLE = "Teach Hub · Made by Matt"
TEACH_DESCRIPTION = (
    "Search lessons, pathways, registers, evidence tools, classroom utilities "
    "and creative apps from one teacher-first workspace."
)

# Top shortcuts — real teacher destinations only.
TEACH_SHORTCUTS = [
    ("page-lesson-hub", "Lessons"),
    ("app-uas-register", "Registers"),
    ("app-asdan-register", "Registers"),
    ("app-evidence-binder", "Evidence"),
    ("app-data-manager-studio", "Learner data"),
    ("page-tools-hub", "All teacher tools"),
]

# Curated groupings. Every id is resolved against the index at render time.
TEACH_SECTIONS = [
    (
        "current-lessons",
        "Current lessons and pathways",
        "Classroom-ready teaching material and the long pathway hubs.",
        ["page-lesson-hub", "resource-asdan-master-hub", "page-resources"],
    ),
    (
        "assessment-evidence",
        "Assessment and evidence",
        "Quick checks, feedback and the evidence workflow.",
        ["app-exit-ticket-and-quick-marks", "app-rubric-and-feedback-studio", "app-evidence-binder"],
    ),
    (
        "data-organisation",
        "Data and organisation",
        "Registers and cohort information, kept on your own device.",
        ["app-uas-register", "app-asdan-register", "app-data-manager-studio"],
    ),
    (
        "classroom-utilities",
        "Classroom utilities",
        "Everyday classroom tools that work offline.",
        ["app-classroom-toolkit", "app-whiteboard", "app-seating-plan-studio"],
    ),
    (
        "creative-tools",
        "Creative classroom tools",
        "Studios for making documents, visuals and activities.",
        ["app-choreostudio", "page-apps-hub"],
    ),
    (
        "interactive-learning",
        "Interactive learning",
        "Games and interactive activities you can put in front of a class.",
        ["page-games-hub", "page-education-hub"],
    ),
]


def outbound_card(href: str, name: str, note: str, cta: str) -> str:
    """One external link. target/rel and the visible marker are set here and
    nowhere else, so no caller can emit an unsafe or unmarked outbound link."""
    return J(
        f'<a class="mbm-outbound-link" href="{href}" target="_blank" '
        'rel="noopener noreferrer external">',
        f'<strong>{name} <span class="mbm-outbound-mark" aria-hidden="true">\u2197</span></strong>',
        f"<span>{note}</span><small>{cta}</small></a>",
    )


def explorations_section(*, sid: str, kicker: str, heading: str, note: str,
                         entries, tagged: bool = False) -> str:
    if tagged:
        cards = J(*[
            J(
                f'<a class="mbm-outbound-link" href="{href}" target="_blank" '
                'rel="noopener noreferrer external">',
                f'<strong>{name} <span class="mbm-outbound-mark" aria-hidden="true">\u2197</span></strong>',
                f"<span>{note_}</span>",
                '<small class="mbm-outbound-tags">External \u2197 \u00b7 '
                'not checked by Made by Matt</small></a>',
            )
            for href, name, note_ in entries
        ])
    else:
        cards = J(*[outbound_card(h, n, d, c) for h, n, d, c in entries])
    return J(
        f'<section class="mbm-outbound-panel" id="{sid}" aria-labelledby="{sid}-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(kicker, f"{sid}-title", heading, note),
        f'<div class="mbm-outbound-grid">{cards}</div></div></section>',
    )


def teach_body(index: dict) -> str:
    entries = entry_map(index)
    tasks = index["teacherTasks"]

    shortcuts = J(*[
        start_card(
            resolve(entries, eid)["route"],
            kind,
            resolve(entries, eid)["title"],
            resolve(entries, eid).get("description", ""),
        )
        for eid, kind in TEACH_SHORTCUTS
    ])

    # Real anchors, so a task deep-links, survives reload and still works with
    # JavaScript off. The search app upgrades them in place. The reset is the
    # same control carrying no task, which is also the unfiltered page.
    task_links = J(
        *[
            J(
                f'<a class="mbm-task-card" href="/teach/?task={t["id"]}" data-mbm-task-query="{t["id"]}">',
                f'<strong>{t["label"]}</strong><span>{t["description"]}</span></a>',
            )
            for t in tasks
        ],
        J(
            '<a class="mbm-task-card mbm-task-card-reset" href="/teach/" data-mbm-task-reset>',
            "<strong>Show everything</strong>",
            "<span>Clear the task filter and list all teacher material again.</span></a>",
        ),
    )

    section_blocks = []
    for sid, heading, note, ids in TEACH_SECTIONS:
        cards = J(*[
            start_card(
                resolve(entries, eid)["route"],
                resolve(entries, eid).get("contentType", ""),
                resolve(entries, eid)["title"],
                resolve(entries, eid).get("description", ""),
            )
            for eid in ids
        ])
        section_blocks.append(
            J(
                f'<section class="mbm-start-here" aria-labelledby="{sid}-title">',
                '<div class="mbm-hub-wrap">',
                section_heading("Teacher shortcuts", f"{sid}-title", heading, note),
                f'<div class="mbm-start-grid">{cards}</div></div></section>',
            )
        )

    filters = J(
        select_filter(
            key="task", field_id="filter-task", label="Teaching task",
            options=[(t["id"], t["label"]) for t in tasks],
        ),
        select_filter(
            key="contentType", field_id="filter-content-type", label="Content type",
        ),
        select_filter(key="subject", field_id="filter-subject", label="Subject or collection"),
        select_filter(key="pathway", field_id="filter-pathway", label="Pathway or programme"),
        select_filter(key="format", field_id="filter-format", label="Format", wrap_details=True),
    )

    nojs_cards = J(*[
        start_card(
            resolve(entries, eid)["route"],
            "Direct route",
            resolve(entries, eid)["title"],
            resolve(entries, eid).get("description", ""),
        )
        for eid, _ in TEACH_SHORTCUTS
    ])

    return J(
        '</div></header><main id="main">',
        # hero
        '<section class="mbm-hub-hero" aria-labelledby="page-title">',
        '<div class="mbm-hub-wrap mbm-hub-hero-grid"><div>',
        '<p class="mbm-hub-kicker">The Teach Hub</p>',
        '<h1 id="page-title">Your offline-first toolkit and resource library.</h1>',
        f'<p class="mbm-hub-lead">{TEACH_DESCRIPTION}</p>',
        '<div class="mbm-hub-search">',
        search_form(
            action="/teach/", field_id="teach-search", label="Search the Teach Hub",
            placeholder="Search lessons, schemes, registers, tools or resources…",
        ),
        "</div>",
        '<div class="mbm-hub-navlinks">',
        '<a href="#teach-search-workspace">Search and filter</a>',
        '<a href="#teach-tasks-title">Start from a task</a>',
        '<a href="/privacy/">Search privacy</a></div>',
        "</div>",
        '<div class="mbm-hub-mark">',
        '<img src="/assets/brand/hero_mark.svg" alt="" width="640" height="640"></div>',
        "</div></section>",
        # task strip
        '<section class="mbm-start-here" aria-labelledby="teach-tasks-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "Start with the teaching task",
            "teach-tasks-title",
            "What do you need to do right now?",
            "Choosing a task filters the workspace below and takes you straight to it. "
            "Every route stays inside Made by Matt.",
        ),
        f'<div class="mbm-task-grid">{task_links}</div></div></section>',
        # shortcuts
        '<section class="mbm-start-here" aria-labelledby="teach-start-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "Start here",
            "teach-start-title",
            "The six destinations teachers open most.",
            "Direct routes to the lesson library, registers, evidence and the tools hub.",
        ),
        f'<div class="mbm-start-grid">{shortcuts}</div></div></section>',
        # search workspace
        '<section class="mbm-search-workspace" id="teach-search-workspace" data-mbm-search-app '
        'data-mbm-mode="teach" data-mbm-page-size="24" aria-labelledby="teach-filter-title">',
        '<div class="mbm-hub-wrap"><div class="mbm-search-layout">',
        '<aside class="mbm-filter-panel">',
        '<h2 id="teach-filter-title">Refine teacher discovery</h2>',
        "<p>Typing searches only local Made by Matt data. Nothing is sent to another service.</p>",
        filters,
        '<button class="mbm-clear" type="button" data-mbm-clear>Clear search and filters</button>',
        "</aside>",
        '<div class="mbm-search-main"><div class="mbm-search-toolbar">',
        search_form(
            action="", field_id="teach-results-query", label="Search results",
            placeholder="Search by title, subject, pathway or task",
        ),
        '<div class="mbm-search-meta">',
        '<p class="mbm-result-count" data-mbm-result-count aria-live="polite">'
        "Loading the same-origin Made by Matt index…</p>",
        sort_control([
            ("relevance", "Most relevant"),
            ("title", "Title A–Z"),
            ("type", "Content type"),
            ("source", "Source"),
        ]),
        "</div>",
        '<div class="mbm-active-filters" data-mbm-active-filters hidden aria-label="Active filters"></div>',
        "</div>",
        '<div class="mbm-results" data-mbm-results></div>',
        '<p class="mbm-empty" data-mbm-empty hidden>No teaching material matches this combination.</p>',
        '<button class="mbm-load-more" type="button" data-mbm-load-more hidden>Show more results</button>',
        "</div></div></div></section>",
        # curated sections
        J(*section_blocks),
        # no-JS baseline
        explorations_section(
            sid="teach-explorations",
            kicker="Approved explorations",
            heading="Further resources, outside Made by Matt.",
            note="Everything below leaves this site, and every one of them is marked \u2197. "
                 "Each line says when to reach for it, not what it is.",
            entries=TEACH_EXPLORATIONS,
        ),
        "<noscript>",
        '<section class="mbm-start-here" aria-labelledby="teach-nojs-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "JavaScript-free starting points",
            "teach-nojs-title",
            "Teaching routes that always work.",
            "The live filters need JavaScript, but these major routes remain available.",
        ),
        f'<div class="mbm-start-grid">{nojs_cards}</div></div></section></noscript>',
        "</main>",
        footer(),
    )


# --------------------------------------------------------------------------
# /education-hub/
# --------------------------------------------------------------------------

EDUCATION_TITLE = "Professional Education Hub — Made by Matt"
EDUCATION_DESCRIPTION = (
    "Search Made by Matt material alongside a clearly separated, locally curated "
    "set of authoritative external education resources."
)

EDUCATION_PUBLISHERS = [
    ("https://www.gov.uk/education", "Department for Education",
     "Government education guidance and services.", "Open GOV.UK · leaves Made by Matt"),
    ("https://www.gov.uk/government/organisations/ofsted", "Ofsted",
     "Inspection publications and provider information.", "Open Ofsted · leaves Made by Matt"),
    ("https://educationendowmentfoundation.org.uk/education-evidence",
     "Education Endowment Foundation",
     "Research summaries, guidance reports and evidence tools.",
     "Open EEF · leaves Made by Matt"),
    ("https://www.thenational.academy/curriculum", "Oak National Academy",
     "Curriculum plans, units and teaching resources.", "Open Oak · leaves Made by Matt"),
    ("https://www.nspcc.org.uk/keeping-children-safe/online-safety/", "NSPCC",
     "Online-safety and safeguarding information for adults.",
     "Open NSPCC · leaves Made by Matt"),
    ("https://www.ceop.police.uk/safety-centre", "CEOP Safety Centre",
     "Official information and reporting routes for online sexual abuse.",
     "Open CEOP · leaves Made by Matt"),
]

# Teacher-facing further reading for /teach/. One annotation sentence each,
# saying WHEN to use it rather than what it is.
#
# The TES shop URL was a visible placeholder until Matt supplied the real
# address on 2026-08-12. It was never guessed: three repositories were searched
# and no TES address existed anywhere in the estate, so the card rendered
# [MATT: TES SHOP URL] where it could not ship unnoticed.
TEACH_EXPLORATIONS = [
    ("https://www.tes.com/teaching-resources/shop/Online_Teaching_Resources",
     "Matt's TES shop",
     "When you want the packaged, print-ready versions of this material to hand to a colleague.",
     "Opens TES \u00b7 leaves Made by Matt"),
    ("https://www.stem.org.uk/resources", "STEM Learning",
     "When a science or D&T sequence needs a second, externally quality-assured activity to sit beside your own.",
     "Opens STEM Learning \u00b7 leaves Made by Matt"),
    ("https://www.ase.org.uk/resources", "Association for Science Education",
     "When you want subject-association guidance on practical work, safety or progression before you plan it.",
     "Opens the ASE \u00b7 leaves Made by Matt"),
]

# Parent- and learner-facing, for the Education Hub.
FAMILY_EXPLORATIONS = [
    ("https://www.thenational.academy", "Oak National Academy",
     "When a family asks what their child should be covering, and you want to point at a curriculum rather than a worksheet.",
     "Opens Oak \u00b7 leaves Made by Matt"),
    ("https://www.bbc.co.uk/bitesize", "BBC Bitesize",
     "When a pupil needs revision material at home that does not depend on anything you have set up.",
     "Opens BBC Bitesize \u00b7 leaves Made by Matt"),
]

# Pupil-adjacent, kept in its own bounded grid because the audience is
# different. The tags are NOT asserted here: see the note rendered above the
# grid and reports/2026-08-12-external-links-STOP.md.
PUPIL_ADJACENT = [
    ("https://phet.colorado.edu/en/simulations/browse", "PhET Simulations",
     "When a class needs to vary one thing at a time in a simulation you cannot safely run in the room."),
    ("https://scratch.mit.edu/explore/projects/all", "Scratch",
     "When a pupil is ready to build the thing rather than answer questions about it."),
    ("https://code.org/students", "Code.org",
     "When you want a structured computing sequence that a pupil can carry on with at home."),
]

EDUCATION_NOJS = [
    ("/teach/", "Direct route", "Teach Hub",
     "Search Made by Matt teaching material by task."),
    ("/resources/", "Direct route", "Resource Catalogue",
     "Search the full internal catalogue."),
    ("https://www.gov.uk/government/publications/keeping-children-safe-in-education--2",
     "Direct route", "KCSIE publication page",
     "Compare the current and future official safeguarding editions."),
    ("https://www.gov.uk/government/publications/academy-trust-handbook",
     "Direct route", "Academy Trust Handbook",
     "Open the official handbook publication page."),
    ("https://www.gov.uk/government/publications/school-inspection-toolkit-operating-guide-and-information",
     "Direct route", "Ofsted inspection publications",
     "Open current and future inspection materials."),
    ("https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/",
     "Direct route", "EEF Teaching and Learning Toolkit",
     "Browse an official evidence summary tool."),
]


def education_body(education: dict) -> str:
    external_count = len(education["resources"])

    filters = J(
        J(
            '<div class="mbm-filter"><span>Origin</span>',
            '<div class="mbm-origin-filter" role="group" aria-label="Filter by origin">',
            '<button type="button" value="internal" data-mbm-filter="origin" aria-pressed="false">'
            "Made by Matt</button>",
            '<button type="button" value="external" data-mbm-filter="origin" aria-pressed="false">'
            "Official external</button></div></div>",
        ),
        select_filter(key="source", field_id="filter-source", label="Publisher / source"),
        select_filter(key="audience", field_id="filter-audience", label="Audience"),
        select_filter(key="jurisdiction", field_id="filter-jurisdiction", label="Jurisdiction"),
        select_filter(key="topic", field_id="filter-topic", label="Topic"),
        select_filter(
            key="status", field_id="filter-status", label="Guidance status", wrap_details=True,
            options=[("current", "Current"), ("upcoming", "Upcoming"),
                     ("evergreen", "Evergreen / undated"), ("superseded", "Superseded")],
        ),
        select_filter(
            key="category", field_id="filter-category", label="Made by Matt content type",
            wrap_details=True,
            options=[("lesson", "Lessons"), ("resource", "Resources"), ("tool", "Tools"),
                     ("app", "Apps"), ("page", "Hubs and pages")],
        ),
    )

    publishers = J(*[outbound_card(h, n, d, c) for h, n, d, c in EDUCATION_PUBLISHERS])

    nojs = J(*[start_card(h, s, t, d) for h, s, t, d in EDUCATION_NOJS])

    return J(
        '</div></header><main id="main">',
        '<section class="mbm-hub-hero" aria-labelledby="page-title">',
        '<div class="mbm-hub-wrap mbm-hub-hero-grid"><div>',
        '<p class="mbm-hub-kicker">Made by Matt · Professional Education Hub</p>',
        '<h1 id="page-title">Professional education resources, clearly sourced.</h1>',
        f'<p class="mbm-hub-lead">Search Made by Matt material and {external_count} curated '
        "external resources without blurring the two. External guidance is labelled by "
        "publisher, jurisdiction, review date and date-derived status.</p>",
        '<div class="mbm-hub-search">',
        search_form(
            action="/education-hub/", field_id="hub-search", label="Search this hub",
            placeholder="Try ‘safeguarding’, ‘attendance’, ‘SEND’ or ‘curriculum’",
        ),
        "</div>",
        '<div class="mbm-origin-key" aria-label="Result origin key">',
        "<span><i></i>Made by Matt internal material</span>",
        "<span><i></i>Authoritative external publisher</span></div>",
        '<div class="mbm-hub-navlinks">',
        '<a href="#professional-search">Search both collections</a>',
        '<a href="#publishers-title">Official publishers</a>',
        '<a href="/privacy/">Search privacy</a></div>',
        "</div>",
        '<div class="mbm-hub-mark">',
        '<img src="/assets/brand/hero_mark.svg" alt="" width="640" height="640"></div>',
        "</div></section>",
        '<section class="mbm-start-here" aria-labelledby="education-start-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "Two clearly labelled collections",
            "education-start-title",
            "Made by Matt material is not official guidance.",
            "Internal products stay in their own group. External entries are short Made by "
            "Matt summaries linking directly to the named publisher.",
        ),
        '<div class="mbm-start-grid">',
        start_card("/teach/", "Made by Matt", "Teacher discovery",
                   "Search lessons, pathways, tools and applications by teaching task."),
        start_card("/resources/", "Made by Matt", "Resource Catalogue",
                   "Search every canonical Made by Matt destination."),
        start_card("#professional-search", "Official publishers",
                   f"{external_count} curated external resources",
                   "Filter local metadata before deliberately opening an official source."),
        "</div></div></section>",
        '<section class="mbm-search-workspace" id="professional-search" data-mbm-search-app '
        'data-mbm-mode="education" data-mbm-page-size="24" '
        'aria-labelledby="professional-filter-title">',
        '<div class="mbm-hub-wrap"><div class="mbm-search-layout">',
        '<aside class="mbm-filter-panel">',
        '<h2 id="professional-filter-title">Refine professional discovery</h2>',
        "<p>Typing searches only local Made by Matt data. No publisher receives your query.</p>",
        filters,
        '<button class="mbm-clear" type="button" data-mbm-clear>Clear search and filters</button>',
        "</aside>",
        '<div class="mbm-search-main"><div class="mbm-search-toolbar">',
        search_form(
            action="", field_id="results-query", label="Search results",
            placeholder="Search by title, subject, pathway or task",
        ),
        '<div class="mbm-search-meta">',
        '<p class="mbm-result-count" data-mbm-result-count aria-live="polite">'
        "Loading the same-origin Made by Matt index…</p>",
        sort_control([
            ("relevance", "Most relevant"),
            ("title", "Title A–Z"),
            ("source", "Publisher / source"),
            ("type", "Content type"),
        ]),
        "</div>",
        '<div class="mbm-active-filters" data-mbm-active-filters hidden aria-label="Active filters"></div>',
        "</div>",
        '<div class="mbm-education-results">',
        '<section class="mbm-result-group" aria-labelledby="internal-results-title">',
        '<div class="mbm-result-group-head">',
        '<h2 id="internal-results-title">Made by Matt material</h2>',
        "<p data-mbm-internal-count>Loading internal results…</p></div>",
        '<div class="mbm-results" data-mbm-internal-results></div></section>',
        '<section class="mbm-result-group external" aria-labelledby="external-results-title">',
        '<div class="mbm-result-group-head">',
        '<h2 id="external-results-title">Authoritative external resources</h2>',
        "<p data-mbm-external-count>Loading curated external resources…</p></div>",
        '<div class="mbm-results" data-mbm-external-results></div></section></div>',
        '<p class="mbm-empty" data-mbm-empty hidden>No internal or external results match '
        "this combination.</p>",
        '<button class="mbm-load-more" type="button" data-mbm-load-more hidden>Show more results</button>',
        "</div></div></div></section>",
        '<section class="mbm-outbound-panel" aria-labelledby="publishers-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "Deliberate outbound navigation",
            "publishers-title",
            "Go directly to an official publisher.",
            "These links leave Made by Matt only when activated. Ordinary typing above "
            "does not contact them.",
        ),
        f'<div class="mbm-outbound-grid">{publishers}</div></div></section>',
        explorations_section(
            sid="family-explorations",
            kicker="For families and learners",
            heading="What to point a parent or carer at.",
            note="Two routes a family can use at home without anything being set up for them. "
                 "Both leave this site.",
            entries=FAMILY_EXPLORATIONS,
        ),
        explorations_section(
            sid="pupil-adjacent",
            kicker="Pupil-facing \u00b7 a different audience",
            heading="Places a pupil can work directly.",
            note="Kept separate on purpose: these are for pupils, not for planning. "
                 "They are third-party sites and Made by Matt does not check what they "
                 "show, whether they ask for a login, or what they carry alongside "
                 "their content \u2014 look before you send a class.",
            entries=PUPIL_ADJACENT,
            tagged=True,
        ),
        "<noscript>",
        '<section class="mbm-start-here" aria-labelledby="nojs-title">',
        '<div class="mbm-hub-wrap">',
        section_heading(
            "JavaScript-free starting points",
            "nojs-title",
            "Professional starting points",
            "The live filters need JavaScript, but these major routes remain available.",
        ),
        f'<div class="mbm-start-grid">{nojs}</div></div></section></noscript>',
        "</main>",
        footer(),
    )


# --------------------------------------------------------------------------
# render + check
# --------------------------------------------------------------------------


def render_page(*, title: str, description: str, path: str, body: str) -> str:
    lines = ["<!doctype html>", f"<!-- {SENTINEL} -->"]
    lines += head_lines(title=title, description=description, path=path)
    lines += header_lines()
    lines.append(body)
    return "\n".join(lines) + "\n"


def build() -> dict[Path, str]:
    index = load_index()
    education = load_education()
    return {
        TEACH_PAGE: render_page(
            title=TEACH_TITLE, description=TEACH_DESCRIPTION, path="/teach/",
            body=teach_body(index),
        ),
        EDUCATION_PAGE: render_page(
            title=EDUCATION_TITLE, description=EDUCATION_DESCRIPTION, path="/education-hub/",
            body=education_body(education),
        ),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit non-zero if any generated page is stale")
    args = parser.parse_args(argv)

    pages = build()
    stale = []
    for path, content in pages.items():
        rel = path.relative_to(ROOT)
        if args.check:
            current = path.read_text(encoding="utf-8") if path.exists() else None
            if current != content:
                stale.append(rel)
                print(f"STALE  {rel}", file=sys.stderr)
            else:
                print(f"ok     {rel} ({len(content.encode('utf-8'))} bytes)")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"wrote  {rel} ({len(content.encode('utf-8'))} bytes)")

    if stale:
        print(
            f"\n{len(stale)} generated page(s) stale — run: python3 tools/render_discovery_hubs.py",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
