#!/usr/bin/env python3
"""Ensure complete <head> metadata and schema.org LearningResource JSON-LD
across all indexable Made by Matt Education pages.

- Preserves existing authored <title>, <meta name="description">, valid
  https://madebymatt.uk/... canonical URLs, Open Graph tags, and homepage
  WebSite/Person JSON-LD (J93 SEO-1).
- Derives missing descriptions strictly from existing catalogue records and
  visible page text (zero invented marketing copy, zero banned names or
  blocked filter words).
- Supports both explicit </head> documents and HTML5 implicit-head documents
  (inserting immediately after </title> when </head> is omitted).
- Skips non-document HTML snippets, moved-page stubs (data-game-moved,
  data-lesson-moved), noindex pages, and meta-refresh redirect pages.
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
from urllib.parse import quote, unquote, urljoin, urlsplit

ORIGIN = 'https://madebymatt.uk'
DEFAULT_OG_IMAGE = f'{ORIGIN}/assets/brand/approved-mark.jpg'
CC_LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
TREES = (
    ('education-site', ''),
    ('education-lessons', '/Lessons'),
    ('education-apps', '/Matt-s-Apps-'),
)

# Hub/catalogue shells in education-lessons that are collection navigators rather than single lessons.
LESSON_COLLECTION_SHELLS = {
    'index.html',
    'subject.html',
    'pack.html',
    'primary/index.html',
    'YearPlan/index.html',
    'Launch/index.html',
    'build-engine/index.html',
    '5_6 Local Choice/index.html',
    'Science/index.html',
    'Science/Teaching_Packs/index.html',
}

CHROME_BOILERPLATE_PREFIXES = (
    'skip to content',
    'made by matt',
    'privacy and statistics',
    'choose your door',
    'loading',
    'enable javascript',
    'menu',
    'close menu',
)

# Scrub blocked filter words and restricted proper-noun tokens (matched by
# 16-hex SHA-256 prefix so no restricted names appear in repository source)
# from any newly derived metadata or JSON-LD strings.
SCRUB_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r'\bgames\b', re.I), 'activities'),
    (re.compile(r'\bgame\b', re.I), 'activity'),
    (re.compile(r'\bunblocked\b', re.I), ''),
    (re.compile(r'\barcade\b', re.I), 'interactive'),
    (re.compile(r'\bproxies\b', re.I), 'indicators'),
    (re.compile(r'\bproxy\b', re.I), 'indicator'),
)

RESTRICTED_TOKEN_HASHES = frozenset({
    '07d046d5fac12b3f', '086c1a7256ebf7d6', '11f24dda22dfcd57', '1541eb3e8db587c7',
    '15acf55556d07c65', '24e6654bfd1ab85b', '33ec7d99154526da', '3db1f560db626918',
    '3ea125d0bff386e6', '439488342cf9a919', '4ce2bf6eb8a5f5fd', '5a37cb361e7b4751',
    '5d72436256ada538', '5e1ecee06a7fc06f', '60965168ce762e94', '67c251e81c3e3873',
    '6a39cec2fa52f182', '7132d541ba31027e', '750fda7b74e35f21', '77e6f78af45f649c',
    '7d3194f79e645c42', '7f3efdf0cb5ecd86', '7fc049aa766613e0', '89da51afcef57d7e',
    '96a5c9dad3206174', '989c4e13f27b0693', '99628a6e64c72247', '9ecf306856f94293',
    '9fbf261b62c1d7c0', 'ac7c0620259bc590', 'b10b288a62770971', 'b78df455e7e2088f',
    'b9bfd32099465cb6', 'bbdefa2950f49882', 'c3aa9a8cc69dc3bf', 'c857d09db23e6822',
    'd9a3cc18b68824ed', 'e718af0f4400cf38', 'ebff9a8a50f597ff', 'f78abe8bf5f349ce',
    'fde3842212c2a7e4', 'fe331eb59eba2b37',
    # Synthetic self-test sentinel hash ('restrictedboardtoken'):
    hashlib.sha256(b'restrictedboardtoken').hexdigest()[:16],
})

WORD_TOKEN_RE = re.compile(r'[A-Za-z][A-Za-z0-9]*')


def _strip_restricted_tokens(text: str) -> str:
    def _repl(m: re.Match[str]) -> str:
        tok = m.group(0)
        digest = hashlib.sha256(tok.lower().encode('utf-8')).hexdigest()[:16]
        return '' if digest in RESTRICTED_TOKEN_HASHES else tok
    return WORD_TOKEN_RE.sub(_repl, text)


def scrub_derived_text(raw: str, max_len: int = 160) -> str:
    text = ' '.join((raw or '').split())
    text = _strip_restricted_tokens(text)
    for pat, repl in SCRUB_PATTERNS:
        text = pat.sub(repl, text)
    # Clean stray punctuation / double spaces left after token removal
    text = re.sub(r'\s+([,.;:!?])', r'\1', text)
    text = re.sub(r'\(\s*\)', '', text)
    text = re.sub(r'(?:\s*[·•—–-]\s*){2,}', ' · ', text)
    text = ' '.join(text.split()).strip(' ·•—–-,;:')
    if max_len and len(text) > max_len:
        cut = text[: max_len - 1].rsplit(' ', 1)[0].rstrip(' ·•—–-,;:')
        text = (cut if len(cut) >= 44 else text[: max_len - 1].rstrip()) + '…'
    return text


def canonical_url_for(tree_prefix: str, rel_posix: str) -> str:
    if rel_posix == 'index.html':
        route = (tree_prefix + '/') if tree_prefix else '/'
    elif rel_posix.endswith('/index.html'):
        sub = rel_posix[: -len('index.html')]
        route = f'{tree_prefix}/{sub}' if tree_prefix else f'/{sub}'
    else:
        route = f'{tree_prefix}/{rel_posix}' if tree_prefix else f'/{rel_posix}'
    # Decode first in case source already had partial encoding, then strictly RFC-3986 encode
    decoded = unquote(route)
    encoded_path = quote(decoded, safe='/-._~')
    return ORIGIN + encoded_path


def _is_clean_canonical(href: str) -> bool:
    if not href.startswith(ORIGIN + '/') and href != ORIGIN:
        return False
    # Must contain no whitespace or unencoded parentheses
    if any(ch.isspace() or ch in ('(', ')', '<', '>', '"', "'") for ch in href):
        return False
    return True


class _PageInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.has_html_root = False
        self.is_moved_stub = False
        self.is_noindex = False
        self.has_meta_refresh = False
        self.title = ''
        self.meta_description = ''
        self.canonical_href = ''
        self.og: dict[str, str] = {}
        self.has_learning_resource_ld = False
        self.h1 = ''
        self.headings: list[str] = []
        self.paragraphs: list[str] = []
        self.full_text_sample: list[str] = []

        self._in_title = False
        self._title_buf: list[str] = []
        self._in_script = False
        self._script_type = ''
        self._script_buf: list[str] = []
        self._in_style = False
        self._in_nav_or_footer = 0
        self._active_block = ''
        self._block_buf: list[str] = []

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
        elif t in ('nav', 'footer', 'header'):
            self._in_nav_or_footer += 1
        elif t == 'meta':
            name = (amap.get('name') or '').strip().lower()
            prop = (amap.get('property') or '').strip().lower()
            content = (amap.get('content') or '').strip()
            heq = (amap.get('http-equiv') or '').strip().lower()
            if heq == 'refresh' and content:
                self.has_meta_refresh = True
            if name in ('robots', 'googlebot'):
                toks = {x.strip().lower() for x in content.split(',')}
                if 'noindex' in toks:
                    self.is_noindex = True
            if name == 'description' and content and not self.meta_description:
                self.meta_description = content
            if prop.startswith('og:') and content and prop not in self.og:
                self.og[prop] = content
        elif t == 'link':
            rels = {x.strip().lower() for x in (amap.get('rel') or '').split()}
            href = (amap.get('href') or '').strip()
            if 'canonical' in rels and href and not self.canonical_href:
                self.canonical_href = href
        elif t == 'title':
            self._in_title = True
            self._title_buf = []
        elif t == 'script':
            self._in_script = True
            self._script_type = (amap.get('type') or '').strip().lower()
            self._script_buf = []
        elif t == 'style':
            self._in_style = True
        elif t in ('h1', 'h2', 'h3', 'p', 'li') and not self._active_block:
            self._active_block = t
            self._block_buf = []

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in ('nav', 'footer', 'header') and self._in_nav_or_footer > 0:
            self._in_nav_or_footer -= 1
        elif t == 'title' and self._in_title:
            val = ' '.join(''.join(self._title_buf).split())
            if val and not self.title:
                self.title = val
            self._in_title = False
        elif t == 'script' and self._in_script:
            raw = ''.join(self._script_buf)
            if self._script_type == 'application/ld+json' and 'LearningResource' in raw:
                self.has_learning_resource_ld = True
            self._in_script = False
            self._script_type = ''
        elif t == 'style':
            self._in_style = False
        elif t == self._active_block:
            txt = ' '.join(''.join(self._block_buf).split())
            if txt:
                if t == 'h1' and not self.h1:
                    self.h1 = txt
                elif t in ('h2', 'h3') and len(self.headings) < 8:
                    self.headings.append(txt)
                elif t in ('p', 'li') and self._in_nav_or_footer == 0 and len(self.paragraphs) < 12:
                    low = txt.lower()
                    if not any(low.startswith(pref) for pref in CHROME_BOILERPLATE_PREFIXES):
                        self.paragraphs.append(txt)
            self._active_block = ''
            self._block_buf = []

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_buf.append(data)
            return
        if self._in_style:
            return
        if self._in_title:
            self._title_buf.append(data)
            return
        if self._active_block:
            self._block_buf.append(data)
        if len(self.full_text_sample) < 44 and data.strip():
            self.full_text_sample.append(data.strip())


def _route_key(raw_route: str) -> str:
    u = urlsplit(urljoin(ORIGIN + '/', raw_route))
    p = unquote(u.path or '/')
    if p.endswith('/index.html'):
        p = p[: -len('index.html')]
    elif p == '/index.html':
        p = '/'
    return p


def load_catalogue_lookup(output_dir: Path) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}

    def register(route: str, rec: dict[str, str]) -> None:
        if not route:
            return
        key = _route_key(route)
        existing = lookup.setdefault(key, {})
        for k, v in rec.items():
            if v and not existing.get(k):
                existing[k] = str(v).strip()

    # 1. Lessons resources.json
    for cand in (
        output_dir / 'education-lessons' / 'resources.json',
        output_dir / 'education-lessons' / 'data' / 'resources.json',
        output_dir / 'education-site' / 'data' / 'resources.json',
    ):
        if cand.is_file():
            try:
                rows = json.loads(cand.read_text(encoding='utf-8'))
            except Exception:
                continue
            if isinstance(rows, dict):
                rows = rows.get('resources') or rows.get('entries') or []
            if isinstance(rows, list):
                for r in rows:
                    if not isinstance(r, dict):
                        continue
                    f = r.get('file') or r.get('path') or r.get('route') or ''
                    if not f:
                        continue
                    route = f if f.startswith('/') else f'/Lessons/{f.lstrip("/")}'
                    register(route, {
                        'title': str(r.get('title') or ''),
                        'description': str(r.get('desc') or r.get('description') or r.get('outcome') or ''),
                        'pathway': str(r.get('pathway') or r.get('tier') or ''),
                        'subject': str(r.get('subject') or ''),
                        'year': str(r.get('year') or r.get('stage') or ''),
                        'type': str(r.get('type') or ''),
                        'duration': str(r.get('duration') or r.get('minutes') or ''),
                    })

    # 2. Folder manifest.json files in education-lessons
    lessons_dir = output_dir / 'education-lessons'
    if lessons_dir.is_dir():
        for mf in sorted(lessons_dir.rglob('manifest.json')):
            try:
                mdata = json.loads(mf.read_text(encoding='utf-8'))
            except Exception:
                continue
            if not isinstance(mdata, dict):
                continue
            folder_rel = mf.parent.relative_to(lessons_dir).as_posix()
            base_prefix = '/Lessons/' + ('' if folder_rel == '.' else folder_rel + '/')
            pack_pathway = str(mdata.get('pathway') or '')
            for item in mdata.get('lessons') or []:
                if not isinstance(item, dict) or not item.get('file'):
                    continue
                register(base_prefix + str(item['file']).lstrip('/'), {
                    'title': str(item.get('title') or ''),
                    'description': str(item.get('summary') or item.get('outcome') or item.get('description') or ''),
                    'pathway': str(item.get('pathway') or pack_pathway),
                    'duration': str(item.get('duration') or ''),
                })

    # 3. Apps apps.json
    apps_json = output_dir / 'education-apps' / 'apps.json'
    if apps_json.is_file():
        try:
            adata = json.loads(apps_json.read_text(encoding='utf-8'))
            for space in adata.get('spaces') or []:
                for it in space.get('items') or []:
                    if it.get('f'):
                        register('/Matt-s-Apps-/' + str(it['f']).lstrip('/'), {
                            'title': str(it.get('n') or ''),
                            'description': str(it.get('d') or ''),
                            'type': str(space.get('cat') or 'Tool'),
                        })
        except Exception:
            pass

    # 4. Site search index & resource-collections
    for sjson in (
        output_dir / 'education-site' / 'data' / 'resource-collections.json',
        output_dir / 'education-site' / 'data' / 'mbm-search-index.json',
    ):
        if sjson.is_file():
            try:
                sdata = json.loads(sjson.read_text(encoding='utf-8'))
                entries = sdata.get('entries') if isinstance(sdata, dict) else sdata
                for e in entries or []:
                    if isinstance(e, dict):
                        rt = e.get('route') or e.get('path') or ''
                        if rt:
                            register(str(rt), {
                                'title': str(e.get('title') or ''),
                                'description': str(e.get('description') or ''),
                                'subject': str(e.get('subject') or ''),
                            })
            except Exception:
                pass

    return lookup


def _derive_description(insp: _PageInspector, cat: dict[str, str], rel_posix: str) -> str:
    # Priority 1: existing og:description on the page
    if insp.og.get('og:description'):
        cleaned = scrub_derived_text(insp.og['og:description'])
        if len(cleaned) >= 15:
            return cleaned

    # Priority 2: existing catalogue description/outcome
    if cat.get('description'):
        cleaned = scrub_derived_text(cat['description'])
        if len(cleaned) >= 15:
            return cleaned

    # Priority 3: first substantive visible paragraph/bullet on the page
    for p in insp.paragraphs:
        if len(p) >= 25:
            cleaned = scrub_derived_text(p)
            if len(cleaned) >= 20:
                return cleaned

    # Priority 4: combine existing h1 / title and headings on the page (strictly existing text)
    parts: list[str] = []
    for candidate in [insp.h1, insp.title, *insp.headings[:3], *insp.paragraphs[:2]]:
        c = scrub_derived_text(candidate, max_len=0)
        if c and c.lower() not in {x.lower() for x in parts}:
            parts.append(c)
    combined = ' · '.join(parts)
    cleaned = scrub_derived_text(combined)
    if cleaned:
        return cleaned
    fallback_name = Path(rel_posix).stem.replace('_', ' ').replace('-', ' ')
    return scrub_derived_text(f'{fallback_name} · Made by Matt') or 'Made by Matt learning resource'


def _derive_educational_level(cat: dict[str, str], rel_posix: str, title: str) -> str:
    hay = f"{cat.get('pathway', '')} {cat.get('year', '')} {rel_posix} {title}"
    for pw in ('BUILD', 'GROW', 'LAUNCH'):
        if re.search(rf'(?:^|[/_\s-]){pw}(?:$|[/_\s-])', hay, re.I):
            return f'{pw} pathway'
    m_ks = re.search(r'\bKS\s*([1-5])\b|\bKey\s+Stage\s+([1-5])\b', hay, re.I)
    if m_ks:
        num = m_ks.group(1) or m_ks.group(2)
        return f'Key Stage {num}'
    m_yr = re.search(r'\bYear\s+([1-9]|1[0-3])\b', hay, re.I)
    if m_yr:
        return f'Year {m_yr.group(1)}'
    if 'primary' in hay.lower():
        return 'Primary'
    return 'School curriculum'


def _derive_resource_type(cat: dict[str, str], rel_posix: str, title: str) -> str:
    hay = f"{cat.get('type', '')} {rel_posix} {title}".lower()
    if 'knowledge_organiser' in hay or 'knowledge organiser' in hay:
        return 'Knowledge organiser'
    if 'worksheet' in hay:
        return 'Worksheet'
    if 'scheme_of_work' in hay or 'scheme of work' in hay or 'start_here' in hay:
        return 'Teaching pack'
    if 'evidence_binder' in hay or 'binder' in hay:
        return 'Assessment resource'
    return 'Lesson'


DURATION_RE = re.compile(r'\b(10|15|20|25|30|35|40|45|50|55|60|75|90|120)\s*(?:minutes|mins|min)\b', re.I)


def _derive_time_required(cat: dict[str, str], insp: _PageInspector) -> str | None:
    dur = cat.get('duration', '').strip()
    if dur:
        if re.fullmatch(r'PT\d+[HM]', dur, re.I):
            return dur.upper()
        if dur.isdigit() and 5 <= int(dur) <= 180:
            return f'PT{int(dur)}M'
        m = DURATION_RE.search(dur)
        if m:
            return f'PT{m.group(1)}M'
    sample = ' '.join(insp.full_text_sample[:25])
    m = DURATION_RE.search(sample)
    if m:
        return f'PT{m.group(1)}M'
    return None


CANONICAL_TAG_RE = re.compile(
    r'<link\b[^>]*\brel\s*=\s*[\'"]canonical[\'"][^>]*>',
    re.IGNORECASE,
)
OG_URL_TAG_RE = re.compile(
    r'<meta\b[^>]*\bproperty\s*=\s*[\'"]og:url[\'"][^>]*>',
    re.IGNORECASE,
)
OG_IMAGE_TAG_RE = re.compile(
    r'<meta\b[^>]*\bproperty\s*=\s*[\'"]og:image[\'"][^>]*>',
    re.IGNORECASE,
)
HEAD_CLOSE_RE = re.compile(r'</head\s*>', re.IGNORECASE)
TITLE_CLOSE_RE = re.compile(r'</title\s*>', re.IGNORECASE)
BODY_OPEN_RE = re.compile(r'<body\b', re.IGNORECASE)


def _normalize_og_image(raw_img: str) -> str:
    val = raw_img.strip()
    if not val:
        return DEFAULT_OG_IMAGE
    if val.startswith(ORIGIN + '/') and not any(c.isspace() for c in val):
        return val
    if val.startswith('/'):
        return ORIGIN + quote(unquote(val), safe='/-._~')
    u = urlsplit(val)
    if (u.hostname or '').lower() in {'mattroper1977.github.io', 'www.madebymatt.uk', 'madebymatt.uk'}:
        return ORIGIN + quote(unquote(u.path or '/assets/brand/approved-mark.jpg'), safe='/-._~')
    return DEFAULT_OG_IMAGE


def enrich_html_document(html_text: str, tree_name: str, tree_prefix: str, rel_posix: str,
                         cat: dict[str, str]) -> tuple[str, dict[str, bool]]:
    insp = _PageInspector()
    insp.feed(html_text)
    insp.close()

    flags = {
        'indexable': False,
        'added_title': False,
        'added_description': False,
        'updated_canonical': False,
        'added_og': False,
        'added_learning_resource_ld': False,
    }

    if not insp.has_html_root or insp.is_moved_stub or insp.is_noindex or insp.has_meta_refresh:
        return html_text, flags

    flags['indexable'] = True
    updated = html_text
    insertions: list[str] = []

    # 1. Title
    effective_title = insp.title
    if not effective_title:
        derived_t = scrub_derived_text(insp.h1 or cat.get('title') or Path(rel_posix).stem.replace('_', ' '), max_len=90)
        effective_title = f'{derived_t} · Made by Matt' if derived_t else 'Made by Matt'
        insertions.append(f'<title>{escape(effective_title, quote=False)}</title>')
        flags['added_title'] = True

    # 2. Canonical URL (preserve existing valid https://madebymatt.uk/... canonicals such as /main/ -> /)
    computed_canonical = canonical_url_for(tree_prefix, rel_posix)
    if insp.canonical_href and _is_clean_canonical(insp.canonical_href):
        effective_canonical = insp.canonical_href
    else:
        effective_canonical = computed_canonical
        new_canon_tag = f'<link rel="canonical" href="{escape(effective_canonical, quote=True)}">'
        if CANONICAL_TAG_RE.search(updated):
            updated = CANONICAL_TAG_RE.sub(new_canon_tag, updated, count=1)
        else:
            insertions.append(new_canon_tag)
        flags['updated_canonical'] = True

    # 3. Meta description
    effective_desc = insp.meta_description
    if not effective_desc:
        effective_desc = _derive_description(insp, cat, rel_posix)
        insertions.append(f'<meta name="description" content="{escape(effective_desc, quote=True)}">')
        flags['added_description'] = True

    # 4. Open Graph completeness: og:type, og:title, og:description, og:url, og:image
    if 'og:type' not in insp.og:
        insertions.append('<meta property="og:type" content="website">')
        flags['added_og'] = True
    if 'og:title' not in insp.og:
        insertions.append(f'<meta property="og:title" content="{escape(effective_title, quote=True)}">')
        flags['added_og'] = True
    if 'og:description' not in insp.og:
        insertions.append(f'<meta property="og:description" content="{escape(effective_desc, quote=True)}">')
        flags['added_og'] = True

    if 'og:url' not in insp.og:
        insertions.append(f'<meta property="og:url" content="{escape(effective_canonical, quote=True)}">')
        flags['added_og'] = True
    elif not _is_clean_canonical(insp.og['og:url']):
        new_og_url = f'<meta property="og:url" content="{escape(effective_canonical, quote=True)}">'
        if OG_URL_TAG_RE.search(updated):
            updated = OG_URL_TAG_RE.sub(new_og_url, updated, count=1)
            flags['added_og'] = True

    if 'og:image' not in insp.og:
        insertions.append(f'<meta property="og:image" content="{escape(DEFAULT_OG_IMAGE, quote=True)}">')
        flags['added_og'] = True
    else:
        norm_img = _normalize_og_image(insp.og['og:image'])
        if norm_img != insp.og['og:image'] and OG_IMAGE_TAG_RE.search(updated):
            updated = OG_IMAGE_TAG_RE.sub(
                f'<meta property="og:image" content="{escape(norm_img, quote=True)}">',
                updated,
                count=1,
            )
            flags['added_og'] = True

    # 4.5 Also treat any sub-folder index.html with 'teaching packs' or 'cover' or 'hub' as collection navigator
    is_lesson_page = (
        tree_name == 'education-lessons'
        and rel_posix not in LESSON_COLLECTION_SHELLS
        and not rel_posix.endswith('/index.html')
    )
    if is_lesson_page and not insp.has_learning_resource_ld:
        clean_name = scrub_derived_text(cat.get('title') or insp.h1 or effective_title, max_len=110) or 'Lesson'
        clean_ld_desc = scrub_derived_text(effective_desc, max_len=160) or 'Structured classroom learning resource.'
        ld_obj: dict[str, object] = {
            '@context': 'https://schema.org',
            '@type': 'LearningResource',
            'name': clean_name,
            'description': clean_ld_desc,
            'url': effective_canonical,
            'educationalLevel': _derive_educational_level(cat, rel_posix, effective_title),
            'learningResourceType': _derive_resource_type(cat, rel_posix, effective_title),
            'license': CC_LICENSE,
            'isAccessibleForFree': True,
            'inLanguage': 'en-GB',
        }
        time_req = _derive_time_required(cat, insp)
        if time_req:
            ld_obj['timeRequired'] = time_req
        ld_json = json.dumps(ld_obj, ensure_ascii=False).replace('</', '<\\/')
        insertions.append(f'<script type="application/ld+json">{ld_json}</script>')
        flags['added_learning_resource_ld'] = True

    if insertions:
        block = '\n'.join(insertions)
        m_head = HEAD_CLOSE_RE.search(updated)
        if m_head:
            pos = m_head.start()
            sep = '' if (pos > 0 and updated[pos - 1] == '\n') else '\n'
            updated = updated[:pos] + sep + block + '\n' + updated[pos:]
        else:
            m_title = TITLE_CLOSE_RE.search(updated)
            if m_title:
                pos = m_title.end()
                updated = updated[:pos] + '\n' + block + updated[pos:]
            else:
                m_body = BODY_OPEN_RE.search(updated)
                if m_body:
                    pos = m_body.start()
                    updated = updated[:pos] + block + '\n' + updated[pos:]
                else:
                    updated = updated + '\n' + block + '\n'

    return updated, flags


def refresh(output_dir: Path, site_root: Path | None = None) -> dict[str, int]:
    lookup = load_catalogue_lookup(output_dir)
    stats = {
        'scanned_html': 0,
        'indexable_html': 0,
        'modified_files': 0,
        'added_title': 0,
        'added_description': 0,
        'updated_canonical': 0,
        'added_og': 0,
        'added_learning_resource_ld': 0,
    }
    for tree_name, tree_prefix in TREES:
        root = output_dir / tree_name
        if not root.is_dir():
            continue
        for path in sorted(root.rglob('*.html')):
            stats['scanned_html'] += 1
            rel_posix = path.relative_to(root).as_posix()
            route_key = _route_key(f'{tree_prefix}/{rel_posix}' if tree_prefix else f'/{rel_posix}')
            cat = lookup.get(route_key, {})
            orig = path.read_text(encoding='utf-8')
            new_text, flags = enrich_html_document(orig, tree_name, tree_prefix, rel_posix, cat)
            if flags['indexable']:
                stats['indexable_html'] += 1
            for k in ('added_title', 'added_description', 'updated_canonical', 'added_og', 'added_learning_resource_ld'):
                if flags[k]:
                    stats[k] += 1
            if new_text != orig:
                path.write_text(new_text, encoding='utf-8')
                stats['modified_files'] += 1
    return stats


def self_test() -> bool:
    # 1. Red-first: bare lesson page with spaces/parentheses in filename and implicit <head>
    bare_lesson = (
        '<!doctype html><html lang="en-GB"><meta charset="utf-8">'
        '<title>Plant Transport Lab</title><style>body{margin:0}</style>'
        '<body><h1>Plant Transport Lab</h1>'
        '<p>40 minutes practical investigation following water and sugar movement in stems.</p>'
        '</body></html>'
    )
    insp_before = _PageInspector()
    insp_before.feed(bare_lesson)
    assert not insp_before.meta_description and not insp_before.canonical_href and not insp_before.has_learning_resource_ld
    print('  [ok] red-first: bare implicit-head lesson lacks description, canonical, Open Graph and LearningResource JSON-LD')

    enriched, flags = enrich_html_document(
        bare_lesson,
        'education-lessons',
        '/Lessons',
        '6 Art/Plant Transport (1).html',
        {'pathway': 'GROW'},
    )
    insp_after = _PageInspector()
    insp_after.feed(enriched)
    assert flags['indexable'] and flags['added_description'] and flags['updated_canonical'] and flags['added_og'] and flags['added_learning_resource_ld']
    assert insp_after.canonical_href == 'https://madebymatt.uk/Lessons/6%20Art/Plant%20Transport%20%281%29.html', insp_after.canonical_href
    assert insp_after.meta_description.startswith('40 minutes practical investigation'), insp_after.meta_description
    assert set(insp_after.og) >= {'og:type', 'og:title', 'og:description', 'og:url', 'og:image'}
    assert insp_after.has_learning_resource_ld
    m_ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', enriched)
    assert m_ld is not None
    ld = json.loads(m_ld.group(1))
    assert ld['@type'] == 'LearningResource'
    assert ld['educationalLevel'] == 'GROW pathway'
    assert ld['learningResourceType'] == 'Lesson'
    assert ld['timeRequired'] == 'PT40M'
    assert ld['license'] == CC_LICENSE
    assert ld['isAccessibleForFree'] is True
    assert ld['inLanguage'] == 'en-GB'
    print('  [ok] green: implicit-head lesson receives encoded canonical, derived description, Open Graph and LearningResource JSON-LD')

    # 2. Idempotence & preservation of complete homepage-like document
    enriched_twice, _ = enrich_html_document(
        enriched,
        'education-lessons',
        '/Lessons',
        '6 Art/Plant Transport (1).html',
        {'pathway': 'GROW'},
    )
    assert enriched_twice == enriched, 'enrich_html_document must be idempotent'
    print('  [ok] green: enrichment is strictly idempotent on a second pass')

    # 3. Restricted-token and blocked-word scrubbing on derived metadata
    scrubbed = scrub_derived_text('Today you begin a RestrictedBoardToken Level 1 game and unblocked arcade challenge.')
    assert 'restrictedboardtoken' not in scrubbed.lower()
    assert 'game' not in scrubbed.lower() and 'unblocked' not in scrubbed.lower() and 'arcade' not in scrubbed.lower()
    print('  [ok] green: derived metadata scrubber removes restricted tokens and blocked filter words')

    # 4. Moved stubs, noindex pages, and HTML fragments stay untouched
    stub = '<!doctype html><html lang="en-GB"><head><meta name="robots" content="noindex"><title>Moved</title></head><body data-game-moved="true"></body></html>'
    out_stub, f_stub = enrich_html_document(stub, 'education-site', '', 'orbit/index.html', {})
    assert out_stub == stub and not f_stub['indexable']
    snippet = '<div class="card"><p>Highlight snippet</p></div>'
    out_snip, f_snip = enrich_html_document(snippet, 'education-site', '', 'hub-highlight-card.html', {})
    assert out_snip == snippet and not f_snip['indexable']
    print('  [ok] green: moved stubs, noindex pages and HTML snippets stay byte-identical')

    print('education_seo_metadata self-test PASS')
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Built output directory')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(0 if self_test() else 1)
    if not args.output:
        parser.error('Provide --output <dir> or --self-test')
    print(json.dumps(refresh(args.output.resolve()), indent=2))
