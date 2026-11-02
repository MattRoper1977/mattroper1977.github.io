#!/usr/bin/env python3
"""Weekly live health check for both Made by Matt domains.

Verifies for both https://madebymatt.uk and https://www.madebymatt-play.uk:
  1. HTTPS valid and TLS certificate days remaining.
  2. DNS has SPF, DMARC and CAA on the apex domain (reports which are missing;
     never modifies DNS).
  3. robots.txt and XML sitemap(s) are reachable and structurally valid.
  4. Every sitemap <loc> URL returns HTTP 200 directly (no redirects or errors).
  5. No Education page added since last week fails the filter-hygiene gate.
  6. Optional external reputation API check skips cleanly when no API key is set.

Opens or updates a GitHub issue when any check fails, using only GITHUB_TOKEN.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import sys
import datetime
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

DOMAINS: tuple[dict[str, str], ...] = (
    {
        'label': 'education',
        'origin': 'https://madebymatt.uk',
        'host': 'madebymatt.uk',
        'apex': 'madebymatt.uk',
        'default_sitemap': 'https://madebymatt.uk/sitemap.xml',
    },
    {
        'label': 'play',
        'origin': 'https://www.madebymatt-play.uk',
        'host': 'www.madebymatt-play.uk',
        'apex': 'madebymatt-play.uk',
        'default_sitemap': 'https://www.madebymatt-play.uk/sitemap.xml',
    },
)

MIN_CERT_DAYS = 14
HTTP_WORKERS = 10
ISSUE_TITLE = 'Weekly domain health check failure'


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_NO_REDIRECT_OPENER = urllib.request.build_opener(_NoRedirect)


def _fetch_no_redirect(url: str, method: str = 'GET', timeout: int = 15) -> tuple[int, str, dict[str, str]]:
    req = urllib.request.Request(
        url,
        method=method,
        headers={'User-Agent': 'MadeByMatt-WeeklyHealth/1.0'},
    )
    try:
        with _NO_REDIRECT_OPENER.open(req, timeout=timeout) as resp:
            body = resp.read().decode('utf-8', errors='replace') if method == 'GET' else ''
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, body, hdrs
    except urllib.error.HTTPError as err:
        body = err.read().decode('utf-8', errors='replace') if (method == 'GET' and err.fp) else ''
        hdrs = {k.lower(): v for k, v in err.headers.items()} if err.headers else {}
        return err.code, body, hdrs


def evaluate_cert_expiry(not_after_epoch: float, now_epoch: float | None = None,
                         min_days: int = MIN_CERT_DAYS) -> dict[str, object]:
    now_val = time.time() if now_epoch is None else now_epoch
    days_left = int((not_after_epoch - now_val) // 86400)
    ok = days_left >= min_days
    return {
        'ok': ok,
        'daysLeft': days_left,
        'minDaysRequired': min_days,
        'detail': f'{days_left} days left' if ok else f'Certificate expires too soon or expired ({days_left} days left < {min_days})',
    }


def check_tls(host: str, min_days: int = MIN_CERT_DAYS, timeout: int = 15) -> dict[str, object]:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((host, 443), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert()
        not_after = cert.get('notAfter') if cert else None
        if not not_after:
            return {'ok': False, 'daysLeft': 0, 'detail': 'Peer certificate missing notAfter field'}
        expiry_epoch = float(ssl.cert_time_to_seconds(not_after))
        res = evaluate_cert_expiry(expiry_epoch, min_days=min_days)
        res['notAfter'] = not_after
        return res
    except Exception as exc:
        return {'ok': False, 'daysLeft': 0, 'detail': f'{type(exc).__name__}: {exc}'}


def _query_dns_records(name: str, rtype: str) -> list[str]:
    """Read-only DNS lookup via dig (POSIX/Ubuntu CI) or nslookup fallback."""
    dig = shutil.which('dig')
    if dig:
        proc = subprocess.run(
            [dig, '+short', '+time=5', '+tries=2', name, rtype],
            capture_output=True,
            text=True,
            timeout=15,
        )
        lines = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip() and not ln.startswith(';')]
        cleaned: list[str] = []
        for ln in lines:
            if rtype.upper() == 'TXT':
                parts = re.findall(r'"([^"]*)"', ln)
                cleaned.append(''.join(parts) if parts else ln.strip('"'))
            else:
                cleaned.append(ln)
        return cleaned

    nslookup = shutil.which('nslookup')
    if nslookup:
        proc = subprocess.run(
            [nslookup, f'-type={rtype}', name],
            capture_output=True,
            text=True,
            timeout=15,
        )
        out = proc.stdout
        if rtype.upper() == 'TXT':
            quoted = re.findall(r'"([^"]+)"', out)
            return quoted
        if rtype.upper() == 'CAA':
            return [ln.strip() for ln in out.splitlines() if 'issue' in ln.lower()]
    return []


def evaluate_dns_records(spf_txts: list[str], dmarc_txts: list[str], caa_records: list[str]) -> dict[str, object]:
    has_spf = any(t.strip().lower().startswith('v=spf1') for t in spf_txts)
    has_dmarc = any(t.strip().lower().startswith('v=dmarc1') for t in dmarc_txts)
    has_caa = any('issue' in c.lower() for c in caa_records)
    missing: list[str] = []
    if not has_spf:
        missing.append('SPF')
    if not has_dmarc:
        missing.append('DMARC')
    if not has_caa:
        missing.append('CAA')
    return {
        'ok': len(missing) == 0,
        'present': {
            'SPF': has_spf,
            'DMARC': has_dmarc,
            'CAA': has_caa,
        },
        'missing': missing,
        'records': {
            'spf': [t for t in spf_txts if t.strip().lower().startswith('v=spf1')],
            'dmarc': [t for t in dmarc_txts if t.strip().lower().startswith('v=dmarc1')],
            'caa': caa_records,
        },
    }


def check_dns(apex: str, query_fn=_query_dns_records) -> dict[str, object]:
    spf_txts = query_fn(apex, 'TXT')
    dmarc_txts = query_fn(f'_dmarc.{apex}', 'TXT')
    caa_recs = query_fn(apex, 'CAA')
    return evaluate_dns_records(spf_txts, dmarc_txts, caa_recs)


def check_robots_and_sitemap(origin: str, default_sitemap: str,
                             fetch_fn=_fetch_no_redirect) -> tuple[dict[str, object], list[str]]:
    robots_url = origin.rstrip('/') + '/robots.txt'
    try:
        r_status, r_body, _ = fetch_fn(robots_url, 'GET', 15)
    except Exception as exc:
        return ({'ok': False, 'detail': f'robots.txt fetch failed: {exc}'}, [])
    if r_status != 200 or not r_body.strip():
        return ({'ok': False, 'detail': f'robots.txt returned HTTP {r_status} or empty body'}, [])

    sitemap_urls: list[str] = []
    for line in r_body.splitlines():
        m = re.match(r'^\s*Sitemap\s*:\s*(\S+)\s*$', line, re.I)
        if m:
            u = m.group(1).strip()
            if u not in sitemap_urls:
                sitemap_urls.append(u)
    if not sitemap_urls:
        sitemap_urls = [default_sitemap]

    all_locs: list[str] = []
    seen_locs: set[str] = set()
    prefix = origin.rstrip('/') + '/'
    for sm_url in sitemap_urls:
        try:
            s_status, s_body, _ = fetch_fn(sm_url, 'GET', 20)
        except Exception as exc:
            return ({'ok': False, 'detail': f'Sitemap {sm_url} fetch failed: {exc}'}, [])
        if s_status != 200:
            return ({'ok': False, 'detail': f'Sitemap {sm_url} returned HTTP {s_status}'}, [])
        try:
            root = ET.fromstring(s_body)
        except ET.ParseError as exc:
            return ({'ok': False, 'detail': f'Sitemap {sm_url} invalid XML: {exc}'}, [])
        locs_in_this: list[str] = []
        for elem in root.iter():
            if elem.tag.split('}', 1)[-1] == 'loc' and elem.text:
                loc = elem.text.strip()
                if any(ch.isspace() for ch in loc):
                    return ({'ok': False, 'detail': f'Unencoded whitespace in <loc>: {loc}'}, [])
                if not loc.startswith(prefix):
                    return ({'ok': False, 'detail': f'<loc> {loc} does not match origin {origin}'}, [])
                locs_in_this.append(loc)
                if loc not in seen_locs:
                    seen_locs.add(loc)
                    all_locs.append(loc)
        if not locs_in_this:
            return ({'ok': False, 'detail': f'Sitemap {sm_url} contains 0 <loc> URLs'}, [])

    return (
        {
            'ok': True,
            'robotsUrl': robots_url,
            'sitemapsChecked': sitemap_urls,
            'uniqueUrls': len(all_locs),
        },
        all_locs,
    )


def check_sitemap_urls(urls: list[str], fetch_fn=_fetch_no_redirect) -> dict[str, object]:
    failures: list[dict[str, object]] = []

    def probe(url: str) -> tuple[str, int, str]:
        try:
            status, _, hdrs = fetch_fn(url, 'HEAD', 15)
            if status in (403, 405):
                status, _, hdrs = fetch_fn(url, 'GET', 15)
            loc = hdrs.get('location', '')
            return url, status, loc
        except Exception as exc:
            return url, 0, f'{type(exc).__name__}: {exc}'

    with ThreadPoolExecutor(max_workers=HTTP_WORKERS) as pool:
        futures = [pool.submit(probe, u) for u in urls]
        for fut in as_completed(futures):
            url, status, detail = fut.result()
            if status != 200:
                failures.append({'url': url, 'status': status, 'detail': detail})

    failures.sort(key=lambda item: str(item['url']))
    return {
        'ok': len(failures) == 0,
        'checked': len(urls),
        'non200Count': len(failures),
        'failures': failures[:50],
    }


def _git_recent_education_routes(repo_root: Path, since_days: int = 7) -> set[str]:
    if not (repo_root / '.git').exists():
        return set()
    try:
        proc = subprocess.run(
            ['git', '-C', str(repo_root), 'log', f'--since={since_days}.days',
             '--name-only', '--pretty=format:'],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except Exception:
        return set()
    routes: set[str] = set()
    for ln in proc.stdout.splitlines():
        rel = ln.strip().replace('\\', '/')
        if not rel.endswith('.html'):
            continue
        if rel == 'index.html':
            routes.add('/')
        elif rel.endswith('/index.html'):
            routes.add('/' + rel[:-len('index.html')])
        else:
            routes.add('/' + rel)
    return routes


def extract_recent_lastmod_urls(sitemap_urls_to_check: list[str],
                                fetch_fn=_fetch_no_redirect,
                                since_days: int = 7) -> set[str]:
    cutoff = (datetime.datetime.now(datetime.timezone.utc).date() - datetime.timedelta(days=since_days)).isoformat()
    recent: set[str] = set()
    for sm_url in sitemap_urls_to_check:
        try:
            st, body, _ = fetch_fn(sm_url, 'GET', 20)
            if st != 200:
                continue
            root = ET.fromstring(body)
        except Exception:
            continue
        for elem in root.iter():
            if elem.tag.split('}', 1)[-1] != 'url':
                continue
            loc = ''
            mod = ''
            for ch in elem:
                ct = ch.tag.split('}', 1)[-1]
                if ct == 'loc' and ch.text:
                    loc = ch.text.strip()
                elif ct == 'lastmod' and ch.text:
                    mod = ch.text.strip()
            if loc and len(mod) >= 10 and mod[:10] >= cutoff:
                recent.add(loc)
    return recent


def check_recent_education_hygiene(edu_origin: str, sitemap_urls: list[str],
                                   previous_urls: set[str] | None = None,
                                   recent_routes: set[str] | None = None,
                                   recent_lastmod_urls: set[str] | None = None,
                                   fetch_fn=_fetch_no_redirect,
                                   policy_path: Path | None = None) -> dict[str, object]:
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    import verify_filter_hygiene as vfh

    policy = vfh.load_policy(policy_path or vfh.DEFAULT_POLICY)
    candidates: list[str] = []
    for u in sitemap_urls:
        path = urlsplit(u).path or '/'
        is_recent_mod = bool(recent_lastmod_urls and u in recent_lastmod_urls)
        if previous_urls is not None:
            if u not in previous_urls or (recent_routes and path in recent_routes) or is_recent_mod:
                candidates.append(u)
        elif recent_routes or recent_lastmod_urls:
            if (recent_routes and path in recent_routes) or is_recent_mod:
                candidates.append(u)
    # Always inspect newly added candidates; if none were isolated (e.g. no prior
    # snapshot yet), inspect recent routes or up to 45 representative sitemap HTML URLs.
    if not candidates and previous_urls is None and not recent_routes:
        candidates = [u for u in sitemap_urls if u.endswith('/') or u.endswith('.html')][:45]

    defects: list[dict[str, object]] = []
    inspected = 0
    for u in candidates:
        try:
            status, body, hdrs = fetch_fn(u, 'GET', 15)
        except Exception as exc:
            defects.append({'url': u, 'error': str(exc)})
            continue
        if status != 200:
            defects.append({'url': u, 'error': f'HTTP {status}'})
            continue
        ctype = hdrs.get('content-type', 'text/html')
        if 'html' not in ctype.lower() and '<html' not in body.lower():
            continue
        inspected += 1
        rel_key = vfh.url_to_tree_rel(u)
        page_findings = vfh.audit_html_document(body, rel_key, policy)
        if page_findings:
            defects.append({'url': u, 'findings': page_findings})

    return {
        'ok': len(defects) == 0,
        'candidatesFound': len(candidates),
        'inspectedHtml': inspected,
        'defects': defects,
    }


def check_optional_reputation_api(env: dict[str, str] | None = None) -> dict[str, object]:
    source = os.environ if env is None else env
    api_key = source.get('MBM_REPUTATION_API_KEY', '').strip()
    if not api_key:
        msg = (
            'Optional external URL-reputation check skipped cleanly: '
            'an API key (MBM_REPUTATION_API_KEY) is needed to run this check.'
        )
        return {'ok': True, 'status': 'SKIPPED', 'message': msg}
    return {
        'ok': True,
        'status': 'KEY_CONFIGURED',
        'message': 'MBM_REPUTATION_API_KEY is present; custom reputation endpoint check enabled.',
    }


def format_failure_issue_body(report: dict[str, object]) -> str:
    lines = [
        '## Weekly Domain Health Check Report',
        '',
        'One or more automated domain health checks reported a problem:',
        '',
    ]
    for dom in report.get('domains', []):
        label = dom.get('origin', dom.get('label', 'domain'))
        status = 'PASS' if dom.get('ok') else 'FAIL'
        lines.append(f'### `{label}` — **{status}**')
        tls = dom.get('tls', {})
        lines.append(f"- **HTTPS / TLS:** `{'PASS' if tls.get('ok') else 'FAIL'}` ({tls.get('detail', '')})")
        dns = dom.get('dns', {})
        missing_dns = dns.get('missing', [])
        dns_note = 'all present (SPF, DMARC, CAA)' if not missing_dns else 'missing: ' + ', '.join(missing_dns)
        lines.append(f"- **DNS (SPF / DMARC / CAA):** `{'PASS' if dns.get('ok') else 'FAIL'}` ({dns_note})")
        rs = dom.get('robotsAndSitemap', {})
        lines.append(f"- **robots.txt & sitemap:** `{'PASS' if rs.get('ok') else 'FAIL'}` ({rs.get('detail', str(rs.get('uniqueUrls', 0)) + ' URLs')})")
        su = dom.get('sitemapUrls', {})
        lines.append(f"- **Sitemap URL HTTP 200 sweep:** `{'PASS' if su.get('ok') else 'FAIL'}` (checked {su.get('checked', 0)}, non-200: {su.get('non200Count', 0)})")
        for bad in su.get('failures', [])[:15]:
            lines.append(f"  - `{bad.get('url')}` -> HTTP `{bad.get('status')}` {bad.get('detail', '')}")
        if 'recentHygiene' in dom:
            rh = dom['recentHygiene']
            lines.append(f"- **Filter-hygiene check on new/recent pages:** `{'PASS' if rh.get('ok') else 'FAIL'}` (inspected {rh.get('inspectedHtml', 0)}, defects: {len(rh.get('defects', []))})")
            for df in rh.get('defects', [])[:10]:
                lines.append(f"  - `{df.get('url')}`: {df.get('findings') or df.get('error')}")
        lines.append('')
    opt = report.get('optionalReputation', {})
    if opt.get('message'):
        lines.append(f"> {opt['message']}")
    return '\n'.join(lines) + '\n'


def open_or_update_github_issue(body: str, repo: str, token: str,
                                api_base: str = 'https://api.github.com') -> dict[str, object]:
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'MadeByMatt-WeeklyHealth/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    list_url = f'{api_base}/repos/{repo}/issues?state=open&per_page=30'
    req = urllib.request.Request(list_url, method='GET', headers=headers)
    existing_number = None
    with urllib.request.urlopen(req, timeout=15) as resp:
        issues = json.loads(resp.read().decode('utf-8'))
        for item in issues:
            if 'pull_request' not in item and item.get('title') == ISSUE_TITLE:
                existing_number = item.get('number')
                break

    if existing_number is not None:
        comment_url = f'{api_base}/repos/{repo}/issues/{existing_number}/comments'
        payload = json.dumps({'body': body}).encode('utf-8')
        creq = urllib.request.Request(comment_url, data=payload, method='POST', headers=headers)
        with urllib.request.urlopen(creq, timeout=15) as resp:
            created = json.loads(resp.read().decode('utf-8'))
            return {'action': 'commented', 'issueNumber': existing_number, 'url': created.get('html_url', '')}

    create_url = f'{api_base}/repos/{repo}/issues'
    payload = json.dumps({'title': ISSUE_TITLE, 'body': body}).encode('utf-8')
    creq = urllib.request.Request(create_url, data=payload, method='POST', headers=headers)
    with urllib.request.urlopen(creq, timeout=15) as resp:
        created = json.loads(resp.read().decode('utf-8'))
        return {'action': 'opened', 'issueNumber': created.get('number'), 'url': created.get('html_url', '')}


def self_test() -> bool:
    ok = True

    def check(name: str, cond: bool, detail: str = '') -> None:
        nonlocal ok
        ok = ok and bool(cond)
        print(f"  [{'ok' if cond else 'FAIL'}] {name}{' - ' + detail if detail else ''}")

    now = 1_800_000_000.0

    # 1. RED FIRST: expiring TLS certificate (< 14 days) fails.
    tls_red = evaluate_cert_expiry(now + 5 * 86400, now_epoch=now, min_days=14)
    check('red-first: certificate with 5 days left fails', not tls_red['ok'] and tls_red['daysLeft'] == 5)

    # 2. RED FIRST: missing SPF and CAA in DNS fails and lists exact missing records.
    dns_red = evaluate_dns_records([], ['v=DMARC1; p=reject;'], [])
    check('red-first: missing SPF and CAA reported accurately',
          not dns_red['ok'] and dns_red['missing'] == ['SPF', 'CAA'])

    # 3. RED FIRST: sitemap with unencoded space fails.
    def fake_bad_sitemap(url: str, method: str = 'GET', timeout: int = 15):
        if url.endswith('/robots.txt'):
            return 200, 'User-agent: *\nAllow: /\nSitemap: https://madebymatt.uk/sitemap.xml\n', {}
        return 200, (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>https://madebymatt.uk/Lessons/bad space.html</loc></url>'
            '</urlset>'
        ), {}

    rs_red, _ = check_robots_and_sitemap('https://madebymatt.uk', 'https://madebymatt.uk/sitemap.xml', fetch_fn=fake_bad_sitemap)
    check('red-first: unencoded whitespace in sitemap <loc> fails', not rs_red['ok'])

    # 4. RED FIRST: non-200 or redirecting sitemap URL fails.
    def fake_404_url(url: str, method: str = 'GET', timeout: int = 15):
        if url.endswith('/missing/'):
            return 404, 'Not Found', {}
        if url.endswith('/redirect/'):
            return 301, '', {'location': 'https://madebymatt.uk/'}
        return 200, 'ok', {}

    su_red = check_sitemap_urls(
        ['https://madebymatt.uk/', 'https://madebymatt.uk/missing/', 'https://madebymatt.uk/redirect/'],
        fetch_fn=fake_404_url,
    )
    check('red-first: 404 and 301 sitemap URLs fail HTTP 200 sweep',
          not su_red['ok'] and su_red['non200Count'] == 2)

    # 4b. RED FIRST: Education page added since last week failing filter hygiene fails.
    local_policy = (HERE / 'filter-hygiene-policy.json')
    if not local_policy.is_file():
        local_policy = HERE / 'filter-hygiene-policy.json'
    if local_policy.is_file():
        def fake_dirty_new_page(url: str, method: str = 'GET', timeout: int = 15):
            return 200, (
                '<!doctype html><html lang="en-GB"><head><title>New Lesson</title>'
                '<meta name="description" content="New lesson.">'
                '<link rel="canonical" href="https://madebymatt.uk/Lessons/new.html"></head>'
                '<body><h1>New Lesson</h1><p>Play unblocked arcade games here.</p></body></html>'
            ), {'content-type': 'text/html; charset=utf-8'}
        rh_red = check_recent_education_hygiene(
            'https://madebymatt.uk',
            ['https://madebymatt.uk/', 'https://madebymatt.uk/Lessons/new.html'],
            previous_urls={'https://madebymatt.uk/'},
            fetch_fn=fake_dirty_new_page,
            policy_path=local_policy,
        )
        check('red-first: newly added Education page with blocked word fails weekly hygiene sweep',
              not rh_red['ok'] and rh_red['candidatesFound'] == 1)

    # 5. Clean skip when optional API key is absent (zero secrets required).
    opt_skip = check_optional_reputation_api(env={})
    check('optional API key check skips cleanly and states key is needed',
          opt_skip['ok'] and opt_skip['status'] == 'SKIPPED' and 'needed' in str(opt_skip['message']))

    # 6. GREEN: valid TLS, complete DNS, valid robots+sitemap, all-200 URLs pass.
    tls_green = evaluate_cert_expiry(now + 60 * 86400, now_epoch=now, min_days=14)
    dns_green = evaluate_dns_records(
        ['v=spf1 -all'],
        ['v=DMARC1; p=reject; adkim=s; aspf=s;'],
        ['0 issue "ca.example.net"'],
    )

    def fake_good_site(url: str, method: str = 'GET', timeout: int = 15):
        if url.endswith('/robots.txt'):
            return 200, 'User-agent: *\nAllow: /\nSitemap: https://madebymatt.uk/sitemap.xml\n', {}
        if url.endswith('/sitemap.xml'):
            return 200, (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                '<url><loc>https://madebymatt.uk/</loc><lastmod>2026-11-01</lastmod></url>'
                '<url><loc>https://madebymatt.uk/about/</loc><lastmod>2026-11-01</lastmod></url>'
                '</urlset>'
            ), {}
        return 200, '<!doctype html><html lang="en-GB"><head><title>About · Made by Matt</title><meta name="description" content="About Made by Matt."><link rel="canonical" href="https://madebymatt.uk/about/"></head><body><h1>About Made by Matt</h1></body></html>', {'content-type': 'text/html; charset=utf-8'}

    rs_green, locs = check_robots_and_sitemap('https://madebymatt.uk', 'https://madebymatt.uk/sitemap.xml', fetch_fn=fake_good_site)
    su_green = check_sitemap_urls(locs, fetch_fn=fake_good_site)
    check('green: valid TLS, DNS, robots.txt, sitemap and all-200 URLs pass',
          tls_green['ok'] and dns_green['ok'] and rs_green['ok'] and su_green['ok'] and len(locs) == 2)

    issue_md = format_failure_issue_body({
        'domains': [{
            'origin': 'https://madebymatt.uk',
            'ok': False,
            'tls': tls_green,
            'dns': dns_red,
            'robotsAndSitemap': rs_green,
            'sitemapUrls': su_red,
        }],
        'optionalReputation': opt_skip,
    })
    check('failure issue body formats missing DNS records and non-200 URLs clearly',
          'missing: SPF, CAA' in issue_md and 'https://madebymatt.uk/missing/' in issue_md)

    print('weekly_domain_health self-test', 'PASS' if ok else 'FAIL')
    return ok


def run_live(repo_root: Path, previous_edu_sitemap: str = '',
             open_issue_on_failure: bool = False,
             report_out: Path | None = None) -> int:
    opt = check_optional_reputation_api()
    print(opt['message'])

    prev_urls: set[str] | None = None
    if previous_edu_sitemap:
        p = Path(previous_edu_sitemap)
        if p.is_file():
            try:
                root = ET.fromstring(p.read_text(encoding='utf-8'))
                prev_urls = {
                    el.text.strip()
                    for el in root.iter()
                    if el.tag.split('}', 1)[-1] == 'loc' and el.text
                }
            except ET.ParseError:
                prev_urls = None

    recent_routes = _git_recent_education_routes(repo_root, since_days=7)
    domain_reports: list[dict[str, object]] = []
    overall_ok = True

    for dom in DOMAINS:
        tls_res = check_tls(dom['host'])
        dns_res = check_dns(dom['apex'])
        rs_res, locs = check_robots_and_sitemap(dom['origin'], dom['default_sitemap'])
        su_res = check_sitemap_urls(locs) if rs_res['ok'] else {'ok': False, 'checked': 0, 'non200Count': 0, 'failures': []}
        dom_entry: dict[str, object] = {
            'label': dom['label'],
            'origin': dom['origin'],
            'tls': tls_res,
            'dns': dns_res,
            'robotsAndSitemap': rs_res,
            'sitemapUrls': su_res,
        }
        dom_ok = bool(tls_res['ok'] and dns_res['ok'] and rs_res['ok'] and su_res['ok'])
        if dom['label'] == 'education' and rs_res['ok']:
            recent_mods = extract_recent_lastmod_urls(
                list(rs_res.get('sitemapsChecked') or [dom['default_sitemap']]),
                since_days=7,
            )
            rh_res = check_recent_education_hygiene(
                dom['origin'],
                locs,
                previous_urls=prev_urls,
                recent_routes=recent_routes,
                recent_lastmod_urls=recent_mods,
            )
            dom_entry['recentHygiene'] = rh_res
            dom_ok = dom_ok and bool(rh_res['ok'])
        dom_entry['ok'] = dom_ok
        overall_ok = overall_ok and dom_ok
        domain_reports.append(dom_entry)

    full_report: dict[str, object] = {
        'ok': overall_ok,
        'checkedAtEpoch': int(time.time()),
        'domains': domain_reports,
        'optionalReputation': opt,
    }
    if report_out:
        report_out.parent.mkdir(parents=True, exist_ok=True)
        report_out.write_text(json.dumps(full_report, indent=2) + '\n', encoding='utf-8')

    print(json.dumps(full_report, indent=2))

    if not overall_ok and open_issue_on_failure:
        token = os.environ.get('GITHUB_TOKEN', '').strip()
        repo = os.environ.get('GITHUB_REPOSITORY', '').strip()
        if token and repo:
            body = format_failure_issue_body(full_report)
            issue_res = open_or_update_github_issue(body, repo=repo, token=token)
            print('Issue notification:', json.dumps(issue_res))
        else:
            print('Issue notification skipped: GITHUB_TOKEN or GITHUB_REPOSITORY not set in environment.')

    return 0 if overall_ok else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--repo-root', type=Path, default=ROOT)
    parser.add_argument('--previous-edu-sitemap', default='')
    parser.add_argument('--open-issue-on-failure', action='store_true')
    parser.add_argument('--report-out', type=Path)
    args = parser.parse_args()

    if args.self_test:
        return 0 if self_test() else 1
    return run_live(
        repo_root=args.repo_root,
        previous_edu_sitemap=args.previous_edu_sitemap,
        open_issue_on_failure=args.open_issue_on_failure,
        report_out=args.report_out,
    )


if __name__ == '__main__':
    raise SystemExit(main())
