#!/usr/bin/env python3
"""Generate Made by Matt Education trust pages (/about/, /accessibility/,
/licence/) strictly from existing site facts, and link all four trust surfaces
(/about/, /privacy/, /accessibility/, /licence/) from every Education footer.

- generate_pages(output_dir): writes about/index.html, accessibility/index.html,
  and licence/index.html into output/education-site/ prior to shared_navigation
  refresh so they receive canonical shared navigation, tokens, and theme chrome.
- stamp_footer_links(output_dir): ensures every indexable Education HTML page
  with a <footer> across education-site, education-lessons, and education-apps
  links /about/, /privacy/, /accessibility/, and /licence/ with >=44x44px tap
  targets, deduplicating any route already present in that footer.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urljoin, urlsplit

ORIGIN = 'https://madebymatt.uk'
TREES = ('education-site', 'education-lessons', 'education-apps')

TRUST_LINKS: tuple[tuple[str, str], ...] = (
    ('/about/', 'About'),
    ('/privacy/', 'Privacy'),
    ('/accessibility/', 'Accessibility'),
    ('/licence/', 'Licence'),
)

PAGE_STYLES = (
    ':root{--pv-navy:#161D3D;--pv-amber:#F2A24A;--pv-cream:#F6F1E4;--pv-card:#FFFDF6;'
    '--pv-ink:#1B2140;--pv-mut:#4A5170;--pv-line:#E3DAC5}'
    'body{background:var(--pv-cream)}'
    '.pv-hero{background:radial-gradient(ellipse 120% 70% at 50% -20%,#232C55,#0F1530 70%);'
    'color:#E8E2D4;text-align:center;padding:2.8rem 1rem 2.4rem}'
    '.pv-hero h1{font-size:clamp(1.7rem,5.5vw,2.6rem);margin:.4rem auto .5rem;max-width:24ch}'
    '.pv-hero p{color:#C9D1E2;max-width:42rem;margin:0 auto;line-height:1.6}'
    '.pv-eyebrow{color:var(--pv-amber)!important;font-size:.74rem;font-weight:800;'
    'letter-spacing:.24em;text-transform:uppercase}'
    '.pv-wrap{max-width:800px;margin:auto;padding:0 1rem}'
    '.pv-sec{padding:2.4rem 0 3rem;color:var(--pv-ink)}'
    '.pv-sec h2{color:var(--pv-ink);font-size:1.3rem;margin:2.2rem 0 .6rem}'
    '.pv-sec h2:first-of-type{margin-top:0}'
    '.pv-sec p,.pv-sec li{color:var(--pv-mut);line-height:1.65;font-size:.95rem}'
    '.pv-sec a{display:inline-flex;align-items:center;min-height:44px;'
    'color:#8A5620;font-weight:750;text-underline-offset:.2em}'
    '.pv-lead,.pv-note{background:var(--pv-card);border:1.5px solid var(--pv-line);'
    'border-radius:16px;padding:1.2rem 1.3rem}'
    '.pv-lead p{margin:.35rem 0}'
    '.pv-note{border-left:4px solid var(--pv-amber);margin:1rem 0}'
    'code{overflow-wrap:anywhere;word-break:break-word}'
    'body[data-theme="dark"]{--pv-cream:#121834;--pv-card:#1B234A;'
    '--pv-ink:#E8E2D4;--pv-mut:#A9B2CC;--pv-line:#2E3860}'
    'body[data-theme="dark"] .pv-sec a{color:#F2A24A}'
)


def _trust_shell(slug: str, title: str, description: str, eyebrow: str, h1: str, lead_p: str, body_html: str) -> str:
    canonical = f'{ORIGIN}/{slug}/'
    return (
        '<!doctype html>\n'
        '<html lang="en-GB"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        f'<title>{title}</title>\n'
        f'<meta name="description" content="{description}">\n'
        f'<meta name="theme-color" content="#161D3D"><link rel="canonical" href="{canonical}">\n'
        f'<meta property="og:type" content="website">\n'
        f'<meta property="og:title" content="{title}">\n'
        f'<meta property="og:description" content="{description}">\n'
        f'<meta property="og:url" content="{canonical}">\n'
        f'<meta property="og:image" content="{ORIGIN}/assets/brand/approved-mark.jpg">\n'
        '<link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
        '<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="/assets/mbm-platform.css">\n'
        f'<style>{PAGE_STYLES}</style>'
        '<!-- mbm-chrome:tokens --><link rel="stylesheet" href="/assets/mbm-tokens.css"><!-- /mbm-chrome:tokens -->\n'
        '</head><body>\n'
        '<a class="skip" href="#main">Skip to content</a>\n'
        '<header class="header mbm-site-header"><div class="bar"><a class="brand" href="/"><span><strong>MADE BY MATT</strong></span></a></div></header>\n'
        f'<main id="main"><section class="pv-hero"><p class="pv-eyebrow">{eyebrow}</p><h1>{h1}</h1><p>{lead_p}</p></section>\n'
        f'<section class="pv-sec"><div class="pv-wrap">\n{body_html}\n</div></section></main>\n'
        '<footer class="footer mbm-site-footer"><div class="bar"><span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></div></footer>\n'
        '<script defer src="/theme.js"></script>\n'
        '</body></html>\n'
    )


def render_about_page() -> str:
    body = (
        '<div class="pv-lead">'
        '<p><b>Real lessons, real packs — by a teacher, for every pathway.</b></p>'
        '<p><b>Free, no login, works offline.</b> Pupils and teachers can open lessons, downloadable packs and classroom tools directly in the browser without creating a pupil account.</p>'
        '</div>'
        '<h2>Who makes this</h2>'
        '<p>Made by Matt is built and maintained by a practising classroom science teacher. Lessons, worksheets, knowledge organisers and teacher tools are created for real classroom delivery first — structured so lessons start quickly, stay clear and support every learner.</p>'
        '<h2>Three pathways</h2>'
        '<ul>'
        '<li><b>BUILD:</b> Small steps, big support: short tasks, a clear start, success you can see.</li>'
        '<li><b>GROW:</b> The same learning with the scaffolds still on the page — independence, built step by step.</li>'
        '<li><b>LAUNCH:</b> Full depth and real sources, to the standard the qualification asks for.</li>'
        '</ul>'
        '<h2>For schools, teachers, pupils and families</h2>'
        '<p>Public learning content requires no pupil sign-in and takes no pupil personal data through the website. Classroom registers and evidence tools that operate on a teacher device keep their records local to that browser and include a device-data deletion control.</p>'
        '<p>For full details on local browser storage and optional adult features, read <a href="/privacy/">Privacy and statistics</a>. To report an issue or request a resource, visit <a href="/commission/">Contact</a>.</p>'
    )
    return _trust_shell(
        slug='about',
        title='About and who makes this — Made by Matt',
        description='Who makes Made by Matt: free classroom lessons, teaching packs and teacher tools across BUILD, GROW and LAUNCH pathways, with no pupil login.',
        eyebrow='Who makes this',
        h1='About Made by Matt',
        lead_p='Real lessons, real packs — by a teacher, for every pathway · Free • No login • Works offline',
        body_html=body,
    )


def render_accessibility_page() -> str:
    body = (
        '<div class="pv-lead">'
        '<p><b>Designed for calm, readable classroom delivery.</b> Made by Matt provides keyboard-accessible navigation, reading-background themes, clear structure and offline-capable HTML lessons without sign-in barriers.</p>'
        '</div>'
        '<h2>Reading and display controls</h2>'
        '<ul>'
        '<li><b>Six reading themes:</b> Display options in the navigation menu provide Cream, Pink, Blue, Light, Dark and High Lumen (high-contrast dark text on a white background) palettes stored locally in this browser.</li>'
        '<li><b>Enlarged text and zoom:</b> Pages reflow across mobile, tablet and whiteboard widths (from 320px upwards) and support browser zoom without horizontal scrolling on navigation surfaces.</li>'
        '<li><b>Reduced motion:</b> Animations and transitions respect operating-system reduced-motion preferences.</li>'
        '</ul>'
        '<h2>Keyboard and assistive navigation</h2>'
        '<ul>'
        '<li><b>Skip link:</b> Published front doors include a keyboard skip-to-content link as the first focusable control.</li>'
        '<li><b>Native menu disclosure:</b> Shared menus use native HTML disclosure elements so navigation works with keyboard focus, Escape-key dismissal and JavaScript disabled.</li>'
        '<li><b>Touch target sizing:</b> Shared navigation and front-door controls are sized to at least 44 by 44 CSS pixels.</li>'
        '</ul>'
        '<h2>Reporting an accessibility barrier</h2>'
        '<p>Some older standalone teaching files and downloadable documents vary in layout. If a lesson, pack or tool presents an accessibility barrier in your classroom, please report the page address through <a href="/commission/">Contact</a> so it can be improved.</p>'
    )
    return _trust_shell(
        slug='accessibility',
        title='Accessibility statement — Made by Matt',
        description='Accessibility features across Made by Matt: reading-background themes, High Lumen contrast, keyboard navigation, 44px controls and how to report barriers.',
        eyebrow='Accessibility',
        h1='Accessibility statement',
        lead_p='How Made by Matt supports readable, keyboard-reachable and adaptable use in the classroom and at home.',
        body_html=body,
    )


def render_licence_page() -> str:
    body = (
        '<div class="pv-lead">'
        '<p><b>Free for classroom, school and home learning use.</b> Educational lessons, worksheets and teaching packs published on Made by Matt are shared under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International licence (CC BY-NC-SA 4.0).</p>'
        '</div>'
        '<h2>What you may do</h2>'
        '<ul>'
        '<li><b>Teach and share:</b> Open, project, print, download and share lessons and teaching packs with pupils, colleagues and families for non-commercial educational use.</li>'
        '<li><b>Adapt for your learners:</b> Edit downloadable worksheets and slides to suit your classes, provided adapted versions keep attribution to Made by Matt and are shared non-commercially under the same licence terms.</li>'
        '</ul>'
        '<h2>Conditions</h2>'
        '<ul>'
        '<li><b>Attribution:</b> Keep visible credit to <b>Made by Matt</b> (<code>https://madebymatt.uk</code>) on shared or adapted copies.</li>'
        '<li><b>NonCommercial:</b> Resources may not be sold, placed behind a commercial paywall or repackaged for commercial resale.</li>'
        '<li><b>ShareAlike:</b> If you distribute adapted material, distribute your contributions under CC BY-NC-SA 4.0 (<code>https://creativecommons.org/licenses/by-nc-sa/4.0/</code>).</li>'
        '</ul>'
        '<h2>Questions and custom requests</h2>'
        '<p>For permissions outside this licence or to request a classroom resource, use <a href="/commission/">Contact</a>.</p>'
    )
    return _trust_shell(
        slug='licence',
        title='Licence — Made by Matt',
        description='Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) terms for Made by Matt lessons and teaching packs.',
        eyebrow='Licence',
        h1='Educational resource licence',
        lead_p='How teachers, schools and families may use, print, adapt and share Made by Matt resources.',
        body_html=body,
    )


def generate_pages(output_dir: Path, site_root: Path | None = None) -> list[str]:
    edu_site = output_dir / 'education-site'
    pages = {
        'about/index.html': render_about_page(),
        'accessibility/index.html': render_accessibility_page(),
        'licence/index.html': render_licence_page(),
    }
    written: list[str] = []
    for rel, content in pages.items():
        target = edu_site / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
        written.append('/' + rel.removesuffix('index.html'))
    return written


class _FooterScanner(HTMLParser):
    def __init__(self, raw_html: str) -> None:
        super().__init__(convert_charrefs=True)
        self.offsets = [0]
        for line in raw_html.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.has_html_root = False
        self.is_moved_stub = False
        self.is_noindex = False
        self.has_meta_refresh = False
        self.template_depth = 0
        self.footers: list[dict[str, object]] = []
        self._active: dict[str, object] | None = None
        self._depth = 0

    def _pos_offset(self) -> int:
        line, col = self.getpos()
        return self.offsets[line - 1] + col

    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith('doctype html'):
            self.has_html_root = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        amap: dict[str, str] = {}
        has_support_attr = False
        for k, v in attrs:
            kl = k.lower()
            if kl in ('data-game-moved', 'data-lesson-moved'):
                self.is_moved_stub = True
            if kl == 'data-mbm-support-footer':
                has_support_attr = True
            if v is not None and kl not in amap:
                amap[kl] = v
        if t == 'template':
            self.template_depth += 1
            return
        if self.template_depth > 0:
            return
        if t == 'html':
            self.has_html_root = True
        elif t == 'meta':
            name = (amap.get('name') or '').strip().lower()
            content = (amap.get('content') or '').strip()
            heq = (amap.get('http-equiv') or '').strip().lower()
            if heq == 'refresh' and content:
                self.has_meta_refresh = True
            if name in ('robots', 'googlebot') and 'noindex' in {x.strip().lower() for x in content.split(',')}:
                self.is_noindex = True
        elif t == 'footer':
            if self._active is None and not has_support_attr:
                cls = (amap.get('class') or '').lower()
                self._active = {
                    'is_chrome': ('mbm-site-footer' in cls or 'home-footer' in cls),
                    'hrefs': [],
                    'close_offset': -1,
                }
                self._depth = 1
            elif self._active is not None:
                self._depth += 1
        elif t == 'a' and self._active is not None:
            href = (amap.get('href') or '').strip()
            if href:
                self._active['hrefs'].append(href)  # type: ignore[union-attr]

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == 'template' and self.template_depth > 0:
            self.template_depth -= 1
            return
        if self.template_depth > 0:
            return
        if t == 'footer' and self._active is not None:
            self._depth -= 1
            if self._depth <= 0:
                self._active['close_offset'] = self._pos_offset()
                self.footers.append(self._active)
                self._active = None

    def target_footer(self) -> dict[str, object] | None:
        valid = [f for f in self.footers if int(f['close_offset']) >= 0]
        if not valid:
            return None
        chrome = [f for f in valid if f['is_chrome']]
        return chrome[-1] if chrome else valid[-1]


def _norm_footer_route(raw_href: str, page_route: str) -> str:
    if raw_href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
        return raw_href
    resolved = urlsplit(urljoin(ORIGIN + page_route, raw_href))
    host = (resolved.hostname or '').lower()
    if host and host not in {'madebymatt.uk', 'www.madebymatt.uk'}:
        return raw_href
    path = resolved.path or '/'
    if path.endswith('/index.html'):
        path = path[: -len('index.html')]
    if resolved.fragment:
        return f'{path}#{resolved.fragment}'
    return path


FIRST_FOOTER_CLOSE_RE = re.compile(r'</footer\s*>', re.IGNORECASE)
NAV_STYLE = (
    'box-sizing:border-box;display:flex;align-items:center;justify-content:center;'
    'flex-wrap:wrap;gap:.35rem .9rem;width:min(1160px,100%);margin:0 auto;padding:.4rem 1rem'
)
LINK_STYLE = (
    'display:inline-flex;align-items:center;justify-content:center;'
    'min-height:44px;min-width:44px;padding:.3rem .45rem;color:inherit;text-underline-offset:.2em'
)


def stamp_footer_on_html(html_text: str, page_route: str) -> tuple[str, bool]:
    scan = _FooterScanner(html_text)
    scan.feed(html_text)
    scan.close()
    target = scan.target_footer()
    if not scan.has_html_root or scan.is_moved_stub or scan.is_noindex or scan.has_meta_refresh or target is None:
        return html_text, False

    present = {_norm_footer_route(h, page_route) for h in target['hrefs']}  # type: ignore[index]
    missing = [(href, label) for href, label in TRUST_LINKS if href not in present]
    if not missing:
        return html_text, False

    close_pos = int(target['close_offset'])
    anchors = ''.join(
        f'<a href="{href}" style="{LINK_STYLE}">{label}</a>'
        for href, label in missing
    )
    nav_html = f'<nav class="mbm-chrome-footer-links mbm-trust-footer-links" aria-label="Trust and policies" style="{NAV_STYLE}">{anchors}</nav>'
    updated = html_text[:close_pos] + nav_html + html_text[close_pos:]
    return updated, True


def stamp_footer_links(output_dir: Path) -> dict[str, int]:
    prefixes = {
        'education-site': '',
        'education-lessons': '/Lessons',
        'education-apps': '/Matt-s-Apps-',
    }
    scanned = 0
    stamped = 0
    for tree in TREES:
        root = output_dir / tree
        if not root.is_dir():
            continue
        pref = prefixes[tree]
        for path in sorted(root.rglob('*.html')):
            scanned += 1
            rel = path.relative_to(root).as_posix()
            route = f'{pref}/{rel}' if pref else f'/{rel}'
            orig = path.read_text(encoding='utf-8')
            updated, changed = stamp_footer_on_html(orig, route)
            if changed:
                path.write_text(updated, encoding='utf-8')
                stamped += 1
    return {'scanned_html': scanned, 'footers_updated': stamped}


def self_test() -> bool:
    # 1. Red-first: footer missing trust links is detected as incomplete before stamping,
    #    and an inner <article><footer> or <footer data-mbm-support-footer> is never mis-targeted.
    sample = (
        '<!doctype html><html lang="en-GB"><head><title>Sample</title></head>'
        '<body><main><h1>Sample</h1><article><footer>Card note</footer></article></main>'
        '<footer class="footer mbm-site-footer"><a href="/privacy/">Privacy and statistics</a></footer>'
        '<footer data-mbm-support-footer><a href="https://ko-fi.com/example">Support</a></footer></body></html>'
    )
    scan_before = _FooterScanner(sample)
    scan_before.feed(sample)
    tgt_before = scan_before.target_footer()
    assert tgt_before is not None
    present_before = {_norm_footer_route(h, '/sample/') for h in tgt_before['hrefs']}  # type: ignore[index]
    assert not ({href for href, _ in TRUST_LINKS} <= present_before)
    print('  [ok] red-first: chrome footer lacking /about/, /accessibility/ and /licence/ is detected')

    stamped, changed = stamp_footer_on_html(sample, '/sample/')
    assert changed is True
    assert '<article><footer>Card note</footer></article>' in stamped, 'Article card footer must stay untouched'
    assert '<footer data-mbm-support-footer><a href="https://ko-fi.com/example">Support</a></footer>' in stamped, 'Support footer must stay untouched'
    assert stamped.count('href="/privacy/"') == 1, 'Existing /privacy/ link must not be duplicated'
    for href, _ in TRUST_LINKS:
        assert f'href="{href}"' in stamped
    stamped_twice, changed_twice = stamp_footer_on_html(stamped, '/sample/')
    assert not changed_twice and stamped_twice == stamped
    print('  [ok] green: footer receives missing trust links without duplicating /privacy/ and is idempotent')

    # 2. Generated trust pages carry complete head tags, h1, and zero banned words
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        (out / 'education-site').mkdir()
        routes = generate_pages(out)
        assert routes == ['/about/', '/accessibility/', '/licence/']
        for slug in ('about', 'accessibility', 'licence'):
            html = (out / 'education-site' / slug / 'index.html').read_text(encoding='utf-8')
            assert '<title>' in html and '<meta name="description"' in html and '<link rel="canonical"' in html and '<h1>' in html
            assert not re.search(r'\bgames?\b', html, re.I)
    print('  [ok] green: /about/, /accessibility/ and /licence/ render cleanly with complete head metadata and zero game wording')
    print('education_trust_pages self-test PASS')
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(0 if self_test() else 1)
    if not args.output:
        parser.error('Provide --output <dir> or --self-test')
    gen = generate_pages(args.output.resolve())
    st = stamp_footer_links(args.output.resolve())
    print(json.dumps({'generated': gen, **st}, indent=2))
