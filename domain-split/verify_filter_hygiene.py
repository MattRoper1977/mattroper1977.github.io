#!/usr/bin/env python3
"""CI and live-audit filter-hygiene gate for Made by Matt Education pages.

Fails if any served Education page introduces:
  (i)   a blocked-category word (from domain-split/filter-hygiene-policy.json),
  (ii)  an off-domain script or tracker,
  (iii) an auto-redirect off-domain,
  (iv)  an executable download link, or
  (v)   an indexable page missing <title>, <meta name="description">,
        <link rel="canonical">, or <h1>.

Includes --self-test proving red-first failure for all five defect classes
before confirming green acceptance.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_POLICY = HERE / 'filter-hygiene-policy.json'
TREES = ('education-site', 'education-lessons', 'education-apps')

META_ATTR_NAMES = {'description', 'keywords', 'og:title', 'og:description', 'twitter:title', 'twitter:description'}
TEXT_CARRYING_ATTRS = {'alt', 'aria-label', 'placeholder', 'title'}


def load_policy(policy_path: Path | None = None) -> dict:
    target = Path(policy_path) if policy_path is not None else DEFAULT_POLICY
    data = json.loads(target.read_text(encoding='utf-8'))
    required = (
        'schemaVersion',
        'allowedHostnames',
        'blockedWords',
        'blockedTrackerSignatures',
        'blockedExecutableExtensions',
        'preExistingExceptions',
    )
    for key in required:
        if key not in data:
            raise ValueError(f'Filter hygiene policy missing required key: {key}')
    if not data['blockedWords'] or 'game' not in data['blockedWords'] or 'games' not in data['blockedWords']:
        raise ValueError('Filter hygiene policy must block game and games')
    return data


def url_to_tree_rel(url: str) -> str:
    path = unquote(urlsplit(url).path or '/')
    if not path.startswith('/'):
        path = '/' + path
    if path.startswith('/Lessons/'):
        sub = path[len('/Lessons/'):]
        if not sub or sub.endswith('/'):
            sub += 'index.html'
        return f'education-lessons/{sub}'
    if path.startswith('/Matt-s-Apps-/'):
        sub = path[len('/Matt-s-Apps-/'):]
        if not sub or sub.endswith('/'):
            sub += 'index.html'
        return f'education-apps/{sub}'
    sub = path.lstrip('/')
    if not sub or sub.endswith('/'):
        sub += 'index.html'
    return f'education-site/{sub}'


class _HygieneHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.has_html_root = False
        self.is_moved_stub = False
        self.is_noindex = False
        self.meta_refreshes: list[str] = []
        self.script_srcs: list[str] = []
        self.script_blocks: list[tuple[str, str]] = []
        self.links: list[str] = []
        self.canonical_hrefs: list[str] = []
        self.meta_descriptions: list[str] = []
        self.titles: list[str] = []
        self.h1_texts: list[str] = []
        self.text_chunks: list[str] = []

        self._in_script = False
        self._script_type = ''
        self._script_buf: list[str] = []
        self._in_style = False
        self._in_title = False
        self._title_buf: list[str] = []
        self._h1_depth = 0
        self._h1_buf: list[str] = []

    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith('doctype html'):
            self.has_html_root = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        attr_map: dict[str, str] = {}
        for k, v in attrs:
            kl = k.lower()
            if kl in ('data-game-moved', 'data-lesson-moved'):
                self.is_moved_stub = True
            if v is not None and kl not in attr_map:
                attr_map[kl] = v

        if t == 'html':
            self.has_html_root = True

        for ak in TEXT_CARRYING_ATTRS:
            val = attr_map.get(ak, '').strip()
            if val:
                self.text_chunks.append(val)
                if self._h1_depth > 0 and ak in ('alt', 'aria-label'):
                    self._h1_buf.append(val)

        if t == 'meta':
            name_key = (attr_map.get('name') or attr_map.get('property') or '').strip().lower()
            content = attr_map.get('content', '').strip()
            http_equiv = (attr_map.get('http-equiv') or '').strip().lower()
            if name_key in ('robots', 'googlebot'):
                tokens = {tok.strip().lower() for tok in content.split(',')}
                if 'noindex' in tokens:
                    self.is_noindex = True
            if name_key == 'description' and content:
                self.meta_descriptions.append(content)
            if name_key in META_ATTR_NAMES and content:
                self.text_chunks.append(content)
            if http_equiv == 'refresh' and content:
                self.meta_refreshes.append(content)

        elif t == 'link':
            rels = {tok.strip().lower() for tok in (attr_map.get('rel') or '').split()}
            href = (attr_map.get('href') or '').strip()
            if 'canonical' in rels and href:
                self.canonical_hrefs.append(href)

        elif t in ('a', 'area'):
            href = (attr_map.get('href') or '').strip()
            if href:
                self.links.append(href)

        elif t == 'script':
            src = (attr_map.get('src') or '').strip()
            if src:
                self.script_srcs.append(src)
            self._in_script = True
            self._script_type = (attr_map.get('type') or '').strip().lower()
            self._script_buf = []

        elif t == 'style':
            self._in_style = True

        elif t == 'title':
            self._in_title = True
            self._title_buf = []

        elif t == 'h1':
            if self._h1_depth == 0:
                self._h1_buf = []
            self._h1_depth += 1

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == 'script' and self._in_script:
            raw = ''.join(self._script_buf)
            self.script_blocks.append((self._script_type, raw))
            if self._script_type == 'application/ld+json' and raw.strip():
                self.text_chunks.append(raw)
            self._in_script = False
            self._script_type = ''
            self._script_buf = []
        elif t == 'style':
            self._in_style = False
        elif t == 'title' and self._in_title:
            title_val = ' '.join(''.join(self._title_buf).split())
            if title_val:
                self.titles.append(title_val)
                self.text_chunks.append(title_val)
            self._in_title = False
            self._title_buf = []
        elif t == 'h1' and self._h1_depth > 0:
            self._h1_depth -= 1
            if self._h1_depth == 0:
                h1_val = ' '.join(''.join(self._h1_buf).split())
                if h1_val:
                    self.h1_texts.append(h1_val)
                self._h1_buf = []

    def handle_data(self, data: str) -> None:
        if self._in_script:
            self._script_buf.append(data)
            return
        if self._in_style:
            return
        if self._in_title:
            self._title_buf.append(data)
            return
        if self._h1_depth > 0:
            self._h1_buf.append(data)
        if data.strip():
            self.text_chunks.append(data)


def _extract_host(raw_url: str) -> str | None:
    u = raw_url.strip()
    if not u:
        return None
    if u.startswith('//'):
        parsed = urlsplit('https:' + u)
        return (parsed.hostname or '').lower() or None
    parsed = urlsplit(u)
    if parsed.scheme.lower() in ('http', 'https'):
        return (parsed.hostname or '').lower() or None
    return None


JS_AUTO_REDIRECT_RE = re.compile(
    r'(?:window\s*\.\s*location(?:\s*\.\s*href)?|document\s*\.\s*location(?:\s*\.\s*href)?|(?<!\.)\blocation\s*\.\s*(?:href|replace|assign))\s*(?:=|\()\s*[\'"](https?:)?//([^\'"/\s:]+)',
    re.IGNORECASE,
)


def _has_unconditional_js_redirect(js_code: str, allowed_hosts: set[str]) -> str | None:
    """Detect top-level/load-triggered off-domain JS auto-redirects while
    ignoring click/event handlers or functions called on user interaction."""
    # Strip JS comments first (preserve :// inside URL literals)
    cleaned = re.sub(r'(?<!:)//[^\n]*', '', js_code)
    cleaned = re.sub(r'/\*.*?\*/', '', cleaned, flags=re.DOTALL)
    for m in JS_AUTO_REDIRECT_RE.finditer(cleaned):
        host = (m.group(2) or '').lower()
        if not host or host in allowed_hosts:
            continue
        # Check brace nesting depth at match position: top-level (depth 0) or
        # DOMContentLoaded / window.onload immediate wrapper.
        prefix = cleaned[:m.start()]
        depth = prefix.count('{') - prefix.count('}')
        if depth <= 0:
            return host
        # Also catch immediate IIFE or load listener auto-redirects
        recent = prefix[max(0, len(prefix) - 240):]
        if re.search(r'(?:DOMContentLoaded|window\.onload|addEventListener\(\s*[\'"]load[\'"])', recent):
            if not re.search(r'(?:click|submit|keydown|change)', recent, re.IGNORECASE):
                return host
    return None


def _digest16(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()[:16]


def audit_html_document(html_text: str, tree_rel: str, policy: dict) -> list[dict[str, str]]:
    parser = _HygieneHTMLParser()
    parser.feed(html_text)
    parser.close()

    # Non-document HTML fragment (e.g. embeddable snippet without <!doctype or <html)
    if not parser.has_html_root:
        return []

    findings: list[dict[str, str]] = []
    allowed_hosts = {h.lower() for h in policy['allowedHostnames']}
    tracker_sigs = [d.lower() for d in policy['blockedTrackerSignatures']]
    exec_exts = tuple(e.lower() for e in policy['blockedExecutableExtensions'])
    exceptions = policy.get('preExistingExceptions', {})

    rel_key = _digest16(tree_rel)
    ext_scripts_cfg = exceptions.get('externalScripts', {})
    if isinstance(ext_scripts_cfg, list):
        allowed_ext_script_digests = set(ext_scripts_cfg)
        allowed_ext_scripts: set[str] = set()
    else:
        allowed_ext_script_digests = set()
        allowed_ext_scripts = set(ext_scripts_cfg.get(tree_rel, []))

    bw_cfg = exceptions.get('blockedWords', {})
    allowed_words = {
        w.lower()
        for w in (bw_cfg.get(tree_rel, []) or bw_cfg.get(rel_key, []))
        if w.lower() not in ('game', 'games')
    }
    missing_h1_exempt = set(exceptions.get('missingH1', []))

    # (ii) Off-domain scripts and trackers
    for src in parser.script_srcs:
        src_low = src.lower()
        for sig in tracker_sigs:
            if sig in src_low:
                findings.append({'class': 'off-domain-tracker', 'detail': src})
                break
        host = _extract_host(src)
        pair_key = _digest16(f'{tree_rel}|{src}')
        if (
            host is not None
            and host not in allowed_hosts
            and src not in allowed_ext_scripts
            and pair_key not in allowed_ext_script_digests
        ):
            findings.append({'class': 'off-domain-script', 'detail': src})

    for stype, raw_script in parser.script_blocks:
        raw_low = raw_script.lower()
        for sig in tracker_sigs:
            if sig in raw_low:
                findings.append({'class': 'off-domain-tracker', 'detail': sig})
        if stype in ('', 'text/javascript', 'application/javascript', 'module'):
            redir_host = _has_unconditional_js_redirect(raw_script, allowed_hosts)
            if redir_host:
                findings.append({'class': 'off-domain-auto-redirect', 'detail': f'JS auto-redirect to {redir_host}'})

    # (iii) Off-domain meta refresh auto-redirect
    for refresh in parser.meta_refreshes:
        m = re.search(r'url\s*=\s*[\'"]?([^\'";\s>]+)', refresh, re.IGNORECASE)
        if m:
            target = m.group(1).strip()
            host = _extract_host(target)
            if host is not None and host not in allowed_hosts:
                findings.append({'class': 'off-domain-auto-redirect', 'detail': refresh})

    # (iv) Executable download links
    for href in parser.links:
        low = href.strip().lower()
        if not low or low.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:', 'blob:')):
            continue
        parsed_path = unquote(urlsplit(href).path or '').lower()
        if parsed_path.endswith(exec_exts):
            findings.append({'class': 'executable-download', 'detail': href})

    # (i) Blocked-category words in human-visible / metadata / JSON-LD text
    escaped_words = [re.escape(w) for w in sorted(policy['blockedWords'], key=len, reverse=True)]
    word_re = re.compile(r'\b(?:' + '|'.join(escaped_words) + r')\b', re.IGNORECASE)
    combined_text = '\n'.join(parser.text_chunks)
    found_words = sorted({m.group(0).lower() for m in word_re.finditer(combined_text)})
    for w in found_words:
        if w not in allowed_words:
            findings.append({'class': 'blocked-word', 'detail': w})

    # (v) Indexable page completeness: <title>, <meta name="description">, <link rel="canonical">, <h1>
    is_indexable = (
        not parser.is_moved_stub
        and not parser.is_noindex
        and len(parser.meta_refreshes) == 0
    )
    if is_indexable:
        if not parser.titles:
            findings.append({'class': 'missing-head-or-h1', 'detail': 'missing <title>'})
        if not parser.meta_descriptions:
            findings.append({'class': 'missing-head-or-h1', 'detail': 'missing <meta name="description">'})
        valid_canon = any(
            (_extract_host(c) in allowed_hosts and c.startswith('https://madebymatt.uk'))
            for c in parser.canonical_hrefs
        )
        if not valid_canon:
            findings.append({'class': 'missing-head-or-h1', 'detail': 'missing valid <link rel="canonical">'})
        if not parser.h1_texts and tree_rel not in missing_h1_exempt and rel_key not in missing_h1_exempt:
            findings.append({'class': 'missing-head-or-h1', 'detail': 'missing <h1>'})

    return findings


def audit_output_directory(output_dir: Path, policy: dict) -> dict[str, object]:
    scanned = 0
    failures: list[dict[str, object]] = []
    for tree in TREES:
        root = output_dir / tree
        if not root.is_dir():
            raise ValueError(f'Missing built Education tree: {root}')
        for path in sorted(root.rglob('*.html')):
            rel = f'{tree}/{path.relative_to(root).as_posix()}'
            scanned += 1
            text = path.read_text(encoding='utf-8', errors='replace')
            page_findings = audit_html_document(text, rel, policy)
            if page_findings:
                failures.append({'page': rel, 'findings': page_findings})
    return {
        'ok': len(failures) == 0,
        'scannedHtml': scanned,
        'failureCount': len(failures),
        'failures': failures,
    }


def self_test(policy_path: Path | None = None) -> int:
    policy = load_policy(policy_path)
    clean_page = (
        '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
        '<title>Photosynthesis Investigation · Made by Matt</title>'
        '<meta name="description" content="Practical photosynthesis investigation for science learners.">'
        '<link rel="canonical" href="https://madebymatt.uk/Lessons/Science/sample.html">'
        '</head><body><h1>Photosynthesis Investigation</h1>'
        '<p>Measure oxygen bubbles at three lamp distances.</p>'
        '<a href="/Lessons/Science/pack.pdf">Download worksheet PDF</a>'
        '</body></html>'
    )

    # Confirm baseline clean page passes later, AFTER proving all 5 planted defects fail RED first!
    red_cases = [
        (
            '(i) blocked-category word fails red',
            clean_page.replace('Measure oxygen bubbles', 'Play unblocked arcade games in class'),
            'blocked-word',
        ),
        (
            '(ii) off-domain script/tracker fails red',
            clean_page.replace('</head>', '<script src="https://analytics.example.org/tracker.js"></script><script>gtag("config","X")</script></head>'),
            'off-domain-script',
        ),
        (
            '(iii-a) off-domain meta refresh auto-redirect fails red',
            clean_page.replace('</head>', '<meta http-equiv="refresh" content="0; url=https://example.org/out"></head>'),
            'off-domain-auto-redirect',
        ),
        (
            '(iii-b) off-domain JS auto-redirect fails red',
            clean_page.replace('</body>', '<script>window.location.href = "https://example.org/out";</script></body>'),
            'off-domain-auto-redirect',
        ),
        (
            '(iv) executable download fails red',
            clean_page.replace('pack.pdf', 'installer.exe'),
            'executable-download',
        ),
        (
            '(v-a) missing meta description fails red',
            clean_page.replace('<meta name="description" content="Practical photosynthesis investigation for science learners.">', ''),
            'missing-head-or-h1',
        ),
        (
            '(v-b) missing canonical fails red',
            clean_page.replace('<link rel="canonical" href="https://madebymatt.uk/Lessons/Science/sample.html">', ''),
            'missing-head-or-h1',
        ),
        (
            '(v-c) missing h1 fails red',
            clean_page.replace('<h1>Photosynthesis Investigation</h1>', '<h2>Photosynthesis Investigation</h2>'),
            'missing-head-or-h1',
        ),
    ]

    for label, planted_html, expected_class in red_cases:
        res = audit_html_document(planted_html, 'education-lessons/Science/planted.html', policy)
        classes = {item['class'] for item in res}
        assert expected_class in classes, f'RED-FIRST PROOF FAILED for {label}: got {res}'
        print(f'  [ok] red-first: {label}')

    green_res = audit_html_document(clean_page, 'education-lessons/Science/sample.html', policy)
    assert green_res == [], f'Expected clean page to pass green, got: {green_res}'
    print('  [ok] green: clean indexable Education lesson page passes')

    stub_page = (
        '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
        '<meta name="robots" content="noindex">'
        '<title>Moved to Made by Matt Play</title></head>'
        '<body data-game-moved="true"><main><h1>This page has moved to Made by Matt Play</h1>'
        '<p><a href="https://www.madebymatt-play.uk/orbit/">Made by Matt Play</a></p></main></body></html>'
    )
    stub_res = audit_html_document(stub_page, 'education-site/orbit/index.html', policy)
    assert stub_res == [], f'Expected neutral moved stub to pass green, got: {stub_res}'
    print('  [ok] green: neutral noindex moved-page stub passes without auto-redirect or blocked words')

    print('verify_filter_hygiene self-test PASS')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Built output directory containing education-site, education-lessons, education-apps')
    parser.add_argument('--policy', type=Path, default=DEFAULT_POLICY, help='Path to filter-hygiene-policy.json')
    parser.add_argument('--self-test', action='store_true', help='Run red-first then green self-tests')
    args = parser.parse_args()

    if args.self_test:
        rc = self_test(args.policy)
        if rc != 0 or not args.output:
            return rc

    if not args.output:
        parser.error('Provide --output <dir> or --self-test')

    policy = load_policy(args.policy)
    report = audit_output_directory(args.output.resolve(), policy)
    print(json.dumps({
        'ok': report['ok'],
        'scannedHtml': report['scannedHtml'],
        'failureCount': report['failureCount'],
        'sampleFailures': report['failures'][:20],
    }, indent=2))
    return 0 if report['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
