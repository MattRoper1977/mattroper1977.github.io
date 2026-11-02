#!/usr/bin/env python3
"""Generate deterministic Education sitemaps, robots.txt, well-known discovery
files (.well-known/security.txt, humans.txt, llms.txt), and public IndexNow key
file inside output/education-site/ without modifying legacy Site root files.

Emits both output/education-site/edu-sitemap.xml and
output/education-site/sitemap.xml from the built Education trees, including all
self-canonical indexable HTML pages across education-site, education-lessons,
and education-apps with RFC-3986 percent-encoded <loc> URLs and deterministic
<lastmod> dates from domain-split/education-lastmod.json.
"""
from __future__ import annotations

import argparse
import hashlib
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import quote, unquote
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ORIGIN = 'https://madebymatt.uk'
DEFAULT_LASTMOD = '2026-10-31'
INDEXNOW_HEX_RE = re.compile(r'^[0-9a-f]{32}$')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

TREES = (
    ('education-site', ''),
    ('education-lessons', '/Lessons'),
    ('education-apps', '/Matt-s-Apps-'),
)


class _SitemapPageCheck(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.has_html_root = False
        self.is_moved_stub = False
        self.is_noindex = False
        self.has_meta_refresh = False
        self.canonical_href = ''

    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith('doctype html'):
            self.has_html_root = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        amap: dict[str, str] = {}
        for k, v in attrs:
            kl = k.lower()
            if kl in ('data-game-moved', 'data-lesson-moved'):
                self.is_moved_stub = True
            if v is not None and kl not in amap:
                amap[kl] = v
        if t == 'html':
            self.has_html_root = True
        elif t == 'meta':
            name = (amap.get('name') or '').strip().lower()
            content = (amap.get('content') or '').strip()
            heq = (amap.get('http-equiv') or '').strip().lower()
            if heq == 'refresh' and content:
                self.has_meta_refresh = True
            if name in ('robots', 'googlebot'):
                toks = {x.strip().lower() for x in content.split(',')}
                if 'noindex' in toks:
                    self.is_noindex = True
        elif t == 'link':
            rels = {x.strip().lower() for x in (amap.get('rel') or '').split()}
            href = (amap.get('href') or '').strip()
            if 'canonical' in rels and href and not self.canonical_href:
                self.canonical_href = href


def route_url_for(tree_prefix: str, rel_posix: str) -> str:
    if rel_posix == 'index.html':
        route = (tree_prefix + '/') if tree_prefix else '/'
    elif rel_posix.endswith('/index.html'):
        sub = rel_posix[: -len('index.html')]
        route = f'{tree_prefix}/{sub}' if tree_prefix else f'/{sub}'
    else:
        route = f'{tree_prefix}/{rel_posix}' if tree_prefix else f'/{rel_posix}'
    decoded = unquote(route)
    return ORIGIN + quote(decoded, safe='/-._~')


def load_lastmod_map(lastmod_path: Path | None) -> tuple[str, dict[str, str]]:
    if lastmod_path is None or not lastmod_path.is_file():
        return DEFAULT_LASTMOD, {}
    data = json.loads(lastmod_path.read_text(encoding='utf-8'))
    default_date = str(data.get('default') or DEFAULT_LASTMOD)
    if not DATE_RE.match(default_date):
        raise ValueError(f'Invalid default lastmod date: {default_date}')
    routes = data.get('routes') or {}
    clean_routes: dict[str, str] = {}
    for k, v in routes.items():
        sv = str(v)
        if not DATE_RE.match(sv):
            raise ValueError(f'Invalid lastmod date for {k}: {sv}')
        clean_routes[str(k)] = sv
    return default_date, clean_routes


def load_indexnow_key(site_root: Path) -> str:
    cfg_path = site_root / 'data' / 'indexnow-key.json'
    if not cfg_path.is_file():
        raise ValueError(f'Missing IndexNow key record: {cfg_path}')
    data = json.loads(cfg_path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or set(data.keys()) - {'key', 'schemaVersion'}:
        raise ValueError('data/indexnow-key.json must hold only the public IndexNow key (no extra credentials)')
    key = str(data.get('key') or '').strip()
    if not INDEXNOW_HEX_RE.match(key):
        raise ValueError(f'IndexNow key must be 32 lowercase hexadecimal characters: {key!r}')
    return key


def collect_sitemap_entries(output_dir: Path, lastmod_path: Path | None = None) -> list[tuple[str, str]]:
    default_date, route_dates = load_lastmod_map(lastmod_path)
    entries_by_url: dict[str, str] = {}

    for tree_name, tree_prefix in TREES:
        root = output_dir / tree_name
        if not root.is_dir():
            continue
        for path in sorted(root.rglob('*.html')):
            rel_posix = path.relative_to(root).as_posix()
            text = path.read_text(encoding='utf-8')
            chk = _SitemapPageCheck()
            chk.feed(text)
            chk.close()
            if not chk.has_html_root or chk.is_moved_stub or chk.is_noindex or chk.has_meta_refresh:
                continue
            loc_url = route_url_for(tree_prefix, rel_posix)
            # Exclude duplicate alias routes whose canonical points elsewhere (e.g. /main/ -> /)
            if chk.canonical_href and chk.canonical_href.startswith(ORIGIN) and chk.canonical_href != loc_url:
                continue
            tree_key = f'{tree_name}/{rel_posix}'
            digest_key = hashlib.sha256(tree_key.encode('utf-8')).hexdigest()[:16]
            lastmod = (
                route_dates.get(tree_key)
                or route_dates.get(digest_key)
                or route_dates.get(loc_url)
                or default_date
            )
            entries_by_url[loc_url] = lastmod

    # Sort deterministically: root '/' first, then lexicographically by URL
    sorted_urls = sorted(entries_by_url.keys(), key=lambda u: (0 if u == ORIGIN + '/' else 1, u))
    return [(u, entries_by_url[u]) for u in sorted_urls]


def render_sitemap_xml(entries: list[tuple[str, str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod in entries:
        if any(ch.isspace() or ch in ('(', ')') for ch in loc):
            raise ValueError(f'Unsafe unencoded character in sitemap <loc>: {loc}')
        lines.append(
            f'  <url><loc>{escape(loc, quote=False)}</loc><lastmod>{escape(lastmod, quote=False)}</lastmod></url>'
        )
    lines.append('</urlset>')
    return '\n'.join(lines) + '\n'


def render_robots_txt() -> str:
    return (
        '# Made by Matt — madebymatt.uk\n'
        '# Free classroom lessons, teaching packs and teacher tools.\n'
        '\n'
        'User-agent: *\n'
        'Allow: /\n'
        'Disallow: /next/\n'
        '\n'
        f'Sitemap: {ORIGIN}/edu-sitemap.xml\n'
        f'Sitemap: {ORIGIN}/sitemap.xml\n'
        f'Sitemap: {ORIGIN}/audience-sitemap.xml\n'
    )


def render_security_txt() -> str:
    return (
        f'Contact: {ORIGIN}/commission/\n'
        'Expires: 2027-10-31T23:59:59.000Z\n'
        'Preferred-Languages: en-GB, en\n'
        f'Canonical: {ORIGIN}/.well-known/security.txt\n'
        f'Policy: {ORIGIN}/privacy/\n'
    )


def render_humans_txt() -> str:
    return (
        '/* TEAM */\n'
        'Site: Made by Matt\n'
        f'URL: {ORIGIN}/\n'
        f'Contact: {ORIGIN}/commission/\n'
        '\n'
        '/* SITE */\n'
        'Purpose: Free classroom lessons, teaching packs and teacher tools across BUILD, GROW and LAUNCH pathways.\n'
        'Access: Free, no login required, offline-capable classroom resources.\n'
        'Language: English (en-GB)\n'
        'Licence: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)\n'
    )


def render_llms_txt(site_root: Path | None = None) -> str:
    audience_lines: list[str] = []
    aud_path = (site_root / 'data' / 'audience-homepages.json') if site_root else None
    if aud_path and aud_path.is_file():
        aud_data = json.loads(aud_path.read_text(encoding='utf-8')).get('audiences') or {}
        for key in ('pupils', 'teachers', 'parents', 'schools'):
            row = aud_data.get(key) or {}
            route = str(row.get('route') or '').strip()
            label = str(row.get('navLabel') or row.get('title') or key.title()).strip()
            summary = str(row.get('doorDescription') or row.get('subtitle') or 'Audience guide.').strip()
            if route:
                audience_lines.append(f'- [{label}]({ORIGIN}{route}): {summary}')
    audience_block = ('\n'.join(audience_lines) + '\n') if audience_lines else f'- [Audience Doors]({ORIGIN}/#doors): Guidance for pupils, teachers, parents and schools.\n'
    return (
        '# Made by Matt\n'
        '\n'
        '> Real lessons, real packs — by a teacher, for every pathway · Free • No login • Works offline\n'
        '\n'
        'Made by Matt publishes free classroom lessons, downloadable teaching packs, and teacher tools across three structured learning pathways (BUILD, GROW, and LAUNCH). Resources require no pupil login and collect no personal pupil data.\n'
        '\n'
        '## Key Entry Points\n'
        '\n'
        f'- [Home]({ORIGIN}/): Main education front door, pathway overview, and subject hubs.\n'
        f'- [Lessons Catalogue]({ORIGIN}/Lessons/): Searchable curriculum lessons across BUILD, GROW, and LAUNCH pathways.\n'
        f'- [Teaching Resources & Packs]({ORIGIN}/resources/): Unit packs, printable worksheets, and whole-school documents.\n'
        f'- [Apps & Teacher Tools]({ORIGIN}/Matt-s-Apps-/): Classroom studios and specialist teacher utilities.\n'
        f'- [Primary Lessons]({ORIGIN}/Lessons/primary/): Primary curriculum lessons and activities.\n'
        '\n'
        '## Audience Guides\n'
        '\n'
        f'{audience_block}'
        '\n'
        '## Trust, Privacy & Licensing\n'
        '\n'
        f'- [Privacy & Statistics]({ORIGIN}/privacy/): Local-first storage policy and optional anonymous statistics notice.\n'
        f'- [Sitemap]({ORIGIN}/edu-sitemap.xml): Complete XML sitemap of indexable education pages and lessons.\n'
        '- Licence: Educational resources are shared under CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/).\n'
    )


def refresh(output_dir: Path, site_root: Path | None = None,
            lastmod_path: Path | None = None) -> dict[str, object]:
    resolved_site = (site_root or HERE.parent).resolve()
    resolved_lastmod = lastmod_path or (HERE / 'education-lastmod.json')
    edu_site = output_dir / 'education-site'
    if not edu_site.is_dir():
        raise ValueError(f'Missing built education-site tree: {edu_site}')

    entries = collect_sitemap_entries(output_dir, resolved_lastmod)
    if not entries:
        raise ValueError('Refusing to emit an empty Education sitemap')

    xml_text = render_sitemap_xml(entries)
    # Parse back with ElementTree to fail closed on any XML structural error
    ET.fromstring(xml_text.encode('utf-8'))

    (edu_site / 'edu-sitemap.xml').write_text(xml_text, encoding='utf-8')
    (edu_site / 'sitemap.xml').write_text(xml_text, encoding='utf-8')
    (edu_site / 'robots.txt').write_text(render_robots_txt(), encoding='utf-8')

    well_known = edu_site / '.well-known'
    well_known.mkdir(parents=True, exist_ok=True)
    (well_known / 'security.txt').write_text(render_security_txt(), encoding='utf-8')
    (edu_site / 'humans.txt').write_text(render_humans_txt(), encoding='utf-8')
    (edu_site / 'llms.txt').write_text(render_llms_txt(resolved_site), encoding='utf-8')

    key = load_indexnow_key(resolved_site)
    (edu_site / f'{key}.txt').write_text(f'{key}\n', encoding='utf-8')

    return {
        'sitemap_urls': len(entries),
        'emitted': [
            'edu-sitemap.xml',
            'sitemap.xml',
            'robots.txt',
            '.well-known/security.txt',
            'humans.txt',
            'llms.txt',
            f'{key}.txt',
        ],
    }


def self_test() -> bool:
    # 1. Red-first: unencoded whitespace or parenthesis in render_sitemap_xml is refused
    try:
        render_sitemap_xml([('https://madebymatt.uk/Lessons/6 Art/Lesson (1).html', '2026-10-31')])
    except ValueError:
        print('  [ok] red-first: unencoded space or parenthesis in sitemap <loc> is refused')
    else:
        raise AssertionError('Expected render_sitemap_xml to refuse unencoded space/parenthesis')

    # 2. Red-first: extra credential key in indexnow-key.json is refused
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / 'data').mkdir()
        (t / 'data' / 'indexnow-key.json').write_text(
            json.dumps({'key': 'a' * 32, 'apiSecret': 'forbidden'}), encoding='utf-8'
        )
        try:
            load_indexnow_key(t)
        except ValueError:
            print('  [ok] red-first: extra credential field in indexnow-key.json is refused')
        else:
            raise AssertionError('Expected load_indexnow_key to refuse extra credential fields')

        # 3. Green end-to-end emission in temp tree
        valid_key = '0123456789abcdef0123456789abcdef'
        (t / 'data' / 'indexnow-key.json').write_text(
            json.dumps({'schemaVersion': 1, 'key': valid_key}), encoding='utf-8'
        )
        out = t / 'out'
        for name in ('education-site', 'education-lessons', 'education-apps'):
            (out / name).mkdir(parents=True)
        (out / 'education-site' / 'index.html').write_text(
            '<!doctype html><html><head><link rel="canonical" href="https://madebymatt.uk/"></head><body><h1>Home</h1></body></html>',
            encoding='utf-8',
        )
        (out / 'education-site' / 'main').mkdir()
        (out / 'education-site' / 'main' / 'index.html').write_text(
            '<!doctype html><html><head><link rel="canonical" href="https://madebymatt.uk/"></head><body><h1>Alias</h1></body></html>',
            encoding='utf-8',
        )
        (out / 'education-site' / 'orbit').mkdir()
        (out / 'education-site' / 'orbit' / 'index.html').write_text(
            '<!doctype html><html><head><meta name="robots" content="noindex"></head><body data-game-moved="true"></body></html>',
            encoding='utf-8',
        )
        (out / 'education-lessons' / '6 Art').mkdir()
        (out / 'education-lessons' / '6 Art' / 'Collage (1).html').write_text(
            '<!doctype html><html><head><title>Collage</title></head><body><h1>Collage</h1></body></html>',
            encoding='utf-8',
        )
        lastmod_file = t / 'lastmod.json'
        lastmod_file.write_text(json.dumps({
            'default': '2026-10-31',
            'routes': {'education-lessons/6 Art/Collage (1).html': '2026-10-25'},
        }), encoding='utf-8')

        res = refresh(out, site_root=t, lastmod_path=lastmod_file)
        assert res['sitemap_urls'] == 2, res
        edu_xml = (out / 'education-site' / 'edu-sitemap.xml').read_text(encoding='utf-8')
        std_xml = (out / 'education-site' / 'sitemap.xml').read_text(encoding='utf-8')
        assert edu_xml == std_xml
        assert 'https://madebymatt.uk/Lessons/6%20Art/Collage%20%281%29.html' in edu_xml
        assert '<lastmod>2026-10-25</lastmod>' in edu_xml
        assert '/main/' not in edu_xml and '/orbit/' not in edu_xml
        assert (out / 'education-site' / '.well-known' / 'security.txt').is_file()
        assert (out / 'education-site' / 'humans.txt').is_file()
        assert (out / 'education-site' / 'llms.txt').is_file()
        assert (out / 'education-site' / f'{valid_key}.txt').read_text(encoding='utf-8').strip() == valid_key
        print('  [ok] green: deterministic encoded sitemaps, robots.txt, well-known files and IndexNow key emitted cleanly')

    print('education_sitemap self-test PASS')
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Built output directory')
    parser.add_argument('--site-root', type=Path, help='Site repository root')
    parser.add_argument('--lastmod', type=Path, help='Path to education-lastmod.json')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(0 if self_test() else 1)
    if not args.output:
        parser.error('Provide --output <dir> or --self-test')
    print(json.dumps(refresh(args.output.resolve(), args.site_root, args.lastmod), indent=2))
