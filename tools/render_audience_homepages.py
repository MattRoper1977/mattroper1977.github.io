#!/usr/bin/env python3
"""Render the Made by Matt chooser and audience homepages.

Sentinel: mbm-homepage-audience-routing-2026-08-09
The committed HTML remains a complete no-JavaScript navigation baseline. This
small renderer keeps the seven public labels, stable routes and curated visual
feature selections in one reviewable data file.
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "audience-homepages.json"
SENTINEL = "mbm-homepage-audience-routing-2026-08-09"

ICONS = {
    "spark": '<path d="M12 2.75l1.55 5.7L19.25 10l-5.7 1.55L12 17.25l-1.55-5.7L4.75 10l5.7-1.55L12 2.75Z"/><path d="M18.5 16.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z"/>',
    "book": '<path d="M4 4.5h5.2A2.8 2.8 0 0 1 12 7.3v12.2a3.4 3.4 0 0 0-3.2-2.1H4V4.5Z"/><path d="M20 4.5h-5.2A2.8 2.8 0 0 0 12 7.3v12.2a3.4 3.4 0 0 1 3.2-2.1H20V4.5Z"/>',
    "home": '<path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.5 9.7v10h13v-10M9.4 19.7v-6h5.2v6"/>',
    "school": '<path d="M3.5 20.5h17M5.5 20.5V8.2L12 4l6.5 4.2v12.3M8.3 11.2h.1M12 11.2h.1M15.7 11.2h.1M8.3 14.6h.1M15.7 14.6h.1M10.3 20.5v-4.1h3.4v4.1"/>',
    "network": '<circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18.5" r="2.4"/><circle cx="19" cy="18.5" r="2.4"/><path d="m10.8 7.1-4.5 8.9M13.2 7.1l4.5 8.9M7.4 18.5h9.2"/>',
    "civic": '<path d="M3 9.5h18M5 9.5v9.2M9.5 9.5v9.2M14.5 9.5v9.2M19 9.5v9.2M3 19h18M12 3l8 4H4l8-4Z"/>',
    "collaborate": '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2.8 20v-2.1A4.9 4.9 0 0 1 7.7 13h.6a4.9 4.9 0 0 1 3.7 1.7M12 20v-2.1a4.9 4.9 0 0 1 4.9-4.9h.6a4.9 4.9 0 0 1 4.9 4.9V20"/>'
}


def esc(value: Any, quote: bool = True) -> str:
    return html.escape(str(value), quote=quote)


def icon(name: str, cls: str = "mf-line-icon") -> str:
    body = ICONS.get(name, ICONS["spark"])
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{body}</svg>'


def canonical(route: str) -> str:
    return f"https://madebymatt.uk{route}"


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


def head(title: str, description: str, route: str, robots: str | None = None) -> str:
    robots_meta = f'<meta name="robots" content="{esc(robots)}">' if robots else ""
    return f'''<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="mbm-platform-version" content="{SENTINEL}"><title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">{robots_meta}
<meta name="theme-color" content="#161D3D"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical(route)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Made by Matt"><meta property="og:image" content="https://madebymatt.uk/assets/og-cover.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://madebymatt.uk/assets/og-cover.png">
<link rel="canonical" href="{canonical(route)}"><link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/mbm-platform.css"><link rel="stylesheet" href="/assets/mbm-audience.css">
<script type="application/ld+json">{json_ld(title, description, route)}</script></head>'''


def display_menu() -> str:
    return '<details class="mbm-theme-menu"><summary>Display</summary><div class="mbm-theme-panel"><div class="mbm-theme-slot" data-mbm-theme-slot></div></div></details>'


def general_header(*, current: str, audience: dict[str, Any] | None = None, chooser: bool = False) -> str:
    if chooser:
        primary = [
            ("Choose homepage", "/"),
            ("Main homepage", "/main/"),
            ("Games", "/games/"),
            ("Lessons", "/Lessons/"),
            ("Resources", "/resources/")
        ]
        more = [("Apps", "/Matt-s-Apps-/"), ("Tools", "/tools/"), ("Privacy", "/privacy/")]
    else:
        assert audience is not None
        primary = [(item["label"], item["href"]) for item in audience["quickLinks"]]
        more = [("Main homepage", "/main/"), ("Choose homepage", "/"), ("Privacy", "/privacy/")]
        if audience.get("adultFeatures"):
            more.insert(2, ("Members", "/members/"))

    def link(label: str, href: str) -> str:
        cur = ' aria-current="page"' if href == current else ""
        return f'<a href="{esc(href)}"{cur}>{esc(label)}</a>'

    primary_html = "".join(link(label, href) for label, href in primary)
    more_html = "".join(link(label, href) for label, href in more)
    return f'''<header class="header mbm-site-header"><div class="bar"><a class="brand" href="/main/"><img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100"><span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></a><button class="menu" id="menu" type="button" aria-expanded="false" aria-controls="nav">Menu</button><nav class="nav mbm-site-nav" id="nav" aria-label="Site navigation"><div class="mbm-primary-links">{primary_html}</div><details class="mbm-nav-more"><summary>More</summary><div class="mbm-nav-panel">{more_html}</div></details>{display_menu()}</nav></div></header>'''


def footer(label: str, *, quiet: bool = False) -> str:
    quiet_attr = ' data-mbm-mailing-cta="off"' if quiet else ""
    return f'''<footer class="footer mf-footer"{quiet_attr}><div class="bar"><a class="brand" href="/main/"><img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100"><span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></a><span class="muted">{esc(label)} · <a href="/main/">Main homepage</a> · <a href="/">Choose homepage</a> · <a href="/privacy/">Privacy</a></span></div></footer>'''


def scripts() -> str:
    return '<script defer src="/theme.js"></script><script defer src="/assets/mbm-audience.js"></script><script defer src="/assets/mbm-platform.js"></script>'


def hero(audience: dict[str, Any]) -> str:
    ctas = "".join(
        f'<a class="mf-btn {esc(item["style"])}" href="{esc(item["href"])}">{esc(item["label"])}</a>'
        for item in audience["primaryCtas"]
    )
    return f'''<section class="mf-hero" aria-labelledby="page-title"><div class="mf-hero-texture" aria-hidden="true"></div><div class="mf-wrap mf-hero-grid"><div class="mf-mark-stage"><span class="mf-halo mf-halo-one" aria-hidden="true"></span><span class="mf-halo mf-halo-two" aria-hidden="true"></span><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640" fetchpriority="high"><span class="mf-audience-badge" style="--badge-accent:{esc(audience['accent'])}">{icon(audience['icon'], 'mf-badge-icon')}<span>{esc(audience['label'])}</span></span></div><div class="mf-hero-copy"><p class="mf-kicker">A Made by Matt homepage</p><h1 id="page-title">{esc(audience['title'])}</h1><p class="mf-lead">{esc(audience['lead'])}</p><div class="mf-actions">{ctas}</div><div class="mf-home-links"><a href="/main/">Main homepage</a><a href="/">Choose another homepage</a></div></div></div></section>'''


def feature_card(item: dict[str, Any], index: int) -> str:
    return f'''<article class="mf-feature" data-feature-id="{esc(item['id'])}"><a class="mf-media" href="{esc(item['href'])}" aria-label="{esc(item['action'])}"><img data-mbm-real-visual src="{esc(item['image'])}" alt="{esc(item['alt'])}" width="{int(item['width'])}" height="{int(item['height'])}" loading="lazy" decoding="async" sizes="(max-width: 720px) 92vw, (max-width: 1100px) 44vw, 360px"></a><div class="mf-feature-copy"><span class="mf-pill">{esc(item['kind'])}</span><h3>{esc(item['title'])}</h3><p>{esc(item['description'])}</p><a class="mf-text-link" href="{esc(item['href'])}">{esc(item['action'])}<span aria-hidden="true">→</span></a></div></article>'''


def content_section(section: dict[str, Any], index: int) -> str:
    features = "".join(feature_card(item, i) for i, item in enumerate(section["features"]))
    alt = " mf-section-tint" if index % 2 else ""
    return f'''<section class="mf-section{alt}" id="{esc(section['id'])}"><div class="mf-wrap"><div class="mf-section-head"><p>{esc(section['kicker'])}</p><h2>{esc(section['title'])}</h2><span>{esc(section['lead'])}</span></div><div class="mf-feature-grid mf-feature-count-{len(section['features'])}">{features}</div></div></section>'''


def utility_section(audience: dict[str, Any]) -> str:
    cards = "".join(
        f'''<a class="mf-utility" href="{esc(item['href'])}"><span class="mf-utility-icon">{icon(audience['icon'])}</span><span><strong>{esc(item['title'])}</strong><small>{esc(item['description'])}</small></span><span class="mf-arrow" aria-hidden="true">→</span></a>'''
        for item in audience["utilities"]
    )
    return f'''<section class="mf-section mf-utility-section"><div class="mf-wrap"><div class="mf-section-head"><p>More to explore</p><h2>Useful routes from this homepage</h2><span>Every destination remains public unless the destination itself clearly explains an optional adult account feature.</span></div><div class="mf-utility-grid">{cards}</div></div></section>'''


def note_section(audience: dict[str, Any]) -> str:
    adult = ""
    if audience.get("adultFeatures"):
        adult = '<div class="mf-note-links"><a href="/account/">Account</a><a href="/members/">Members</a><a href="/mailing-list/">Teacher updates</a><a href="/privacy/">Privacy</a></div>'
    return f'''<section class="mf-section mf-note-section"><div class="mf-wrap"><div class="mf-note"><span class="mf-note-mark" aria-hidden="true">{icon(audience['icon'])}</span><div><p class="mf-note-kicker">Clear information</p><h2>{esc(audience['noteTitle'])}</h2><p>{esc(audience['note'])}</p>{adult}</div></div></div></section>'''


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
    sections = "".join(content_section(section, i) for i, section in enumerate(audience["sections"]))
    description = audience["lead"]
    return f'''<!doctype html>
<!-- {SENTINEL} -->
<html lang="en-GB">{head(f"{audience['label']} · Made by Matt", description, audience['route'])}<body class="mbm-face-page" {body_attrs} style="--face-accent:{esc(audience['accent'])};--face-soft:{esc(audience['soft'])}">
<a class="skip" href="#main">Skip to content</a>{general_header(current=audience['route'], audience=audience)}<main id="main">{hero(audience)}{sections}{utility_section(audience)}{note_section(audience)}{switcher(data, aid)}</main>{footer(audience['label'], quiet=not audience.get('adultFeatures'))}{scripts()}</body></html>
'''


def chooser_card(aid: str, audience: dict[str, Any]) -> str:
    return f'''<a class="mf-choice" data-mbm-face-choice="{esc(aid)}" data-mbm-face-label="{esc(audience['label'])}" href="{esc(audience['route'])}" style="--choice-accent:{esc(audience['accent'])};--choice-soft:{esc(audience['soft'])}"><span class="mf-last">Last used on this device</span><span class="mf-choice-icon">{icon(audience['icon'])}</span><span class="mf-choice-copy"><strong>{esc(audience['label'])}</strong><small>{esc(audience['chooserDescription'])}</small></span><span class="mf-arrow" aria-hidden="true">→</span></a>'''


def chooser_page(data: dict[str, Any]) -> str:
    groups = []
    for group in data["groups"]:
        cards = "".join(chooser_card(aid, data["audiences"][aid]) for aid in group["audiences"])
        groups.append(f'''<section class="mf-choice-group" aria-labelledby="group-{esc(group['id'])}"><div class="mf-group-head"><p>Choose a starting point</p><h2 id="group-{esc(group['id'])}">{esc(group['title'])}</h2></div><div class="mf-choice-grid">{cards}</div></section>''')
    title = "Choose your own homepage type · Made by Matt"
    description = "Choose the Made by Matt homepage that best suits pupils, teachers, families, schools and education organisations."
    return f'''<!doctype html>
<!-- {SENTINEL} -->
<html lang="en-GB">{head(title, description, "/")}<body class="mbm-face-page mbm-face-chooser" data-mbm-audience-face="chooser" data-mbm-mailing-footer="off">
<a class="skip" href="#main">Skip to content</a>{general_header(current="/", chooser=True)}<main id="main"><section class="mf-hero mf-chooser-hero" aria-labelledby="page-title"><div class="mf-hero-texture" aria-hidden="true"></div><div class="mf-wrap mf-hero-grid"><div class="mf-mark-stage"><span class="mf-halo mf-halo-one" aria-hidden="true"></span><span class="mf-halo mf-halo-two" aria-hidden="true"></span><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640" fetchpriority="high"><span class="mf-audience-badge mf-platform-badge">{icon('network', 'mf-badge-icon')}<span>One platform</span></span></div><div class="mf-hero-copy"><p class="mf-kicker">Made by Matt · choose your starting point</p><h1 id="page-title">Choose your own homepage type</h1><p class="mf-lead">Made by Matt is one platform with different homepages for learners, families, education staff and organisations. Choose the starting point that puts the most useful content first. You can change it at any time. This does not create an account, change permissions or hide public content.</p><div class="mf-actions"><a class="mf-btn primary" href="/main/">Main Made by Matt homepage</a><a class="mf-btn secondary" href="#homepage-choices">See the homepage choices</a></div></div></div></section><section class="mf-main-option" aria-labelledby="main-option-title"><div class="mf-wrap"><a class="mf-main-card" href="/main/"><span class="mf-main-card-mark"><img src="/assets/brand/micro_mark.svg" alt="" width="100" height="100"></span><span><small>The complete platform</small><strong id="main-option-title">Main Made by Matt homepage</strong><em>Explore the complete Made by Matt platform with the broad general navigation.</em></span><span class="mf-arrow" aria-hidden="true">→</span></a></div></section><section class="mf-choices" id="homepage-choices"><div class="mf-wrap">{"".join(groups)}<div class="mf-continue" data-mbm-face-continue aria-live="polite"><span><b>Last used on this device</b><small>This preference stays in this browser. It is not an account, profile, consent choice or tracking identifier, and it is not sent to Supabase, Buttondown or analytics.</small></span><span class="mf-continue-actions"><a href="/">Continue</a><button class="mf-clear" type="button" data-mbm-face-clear>Forget this preference</button></span></div></div></section><section class="mf-section mf-note-section"><div class="mf-wrap"><div class="mf-note"><span class="mf-note-mark" aria-hidden="true">{icon('spark')}</span><div><p class="mf-note-kicker">Nothing is locked by this choice</p><h2>Different homepages, the same public Made by Matt platform</h2><p>Audience selection changes presentation and navigation only. It does not authenticate anyone, create a child profile, grant permissions or prevent a visitor from opening another public part of the site.</p></div></div></div></section></main>{footer("Choose your homepage", quiet=True)}{scripts()}</body></html>
'''


def start_redirect() -> str:
    return f'''<!doctype html>
<!-- {SENTINEL} · legacy compatibility route -->
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Choose your homepage · Made by Matt</title><meta name="description" content="The Made by Matt homepage chooser now lives at the site root."><meta name="robots" content="noindex,follow"><meta name="theme-color" content="#161D3D"><link rel="canonical" href="https://madebymatt.uk/"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/mbm-audience.css"><meta http-equiv="refresh" content="0; url=/"><script>location.replace('/'+location.search+location.hash);</script></head><body class="mbm-face-page mbm-legacy-start"><main id="main"><section class="mf-hero mf-legacy-hero"><div class="mf-wrap"><img class="mf-hero-mark" src="/assets/brand/hero_mark.svg" alt="" width="640" height="640"><h1>The homepage chooser has moved</h1><p class="mf-lead">Continue to the Made by Matt homepage chooser.</p><p><a class="mf-btn primary" href="/">Choose your homepage</a> <a class="mf-btn secondary" href="/main/">Main homepage</a></p></div></section></main></body></html>
'''


def outputs(data: dict[str, Any]) -> dict[Path, str]:
    result = {ROOT / "index.html": chooser_page(data), ROOT / "start" / "index.html": start_redirect()}
    for aid, audience in data["audiences"].items():
        result[ROOT / audience["route"].strip("/") / "index.html"] = audience_page(data, aid, audience)
    return result


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
    for aid, audience in data["audiences"].items():
        if not audience["route"].startswith("/for/") or not audience["route"].endswith("/"):
            raise SystemExit(f"{aid}: invalid stable route")
        for section in audience["sections"]:
            for feature in section["features"]:
                source = feature["image"].split("?", 1)[0].lstrip("/")
                if not (ROOT / source).is_file():
                    raise SystemExit(f"{aid}: promoted image does not exist: {feature['image']}")
                if not feature.get("alt"):
                    raise SystemExit(f"{aid}: promoted image has no alt text: {feature['id']}")


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
