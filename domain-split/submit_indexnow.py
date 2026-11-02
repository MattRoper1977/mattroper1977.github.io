#!/usr/bin/env python3
"""Submit changed published URLs via the open IndexNow protocol after deploy.

Uses only the public hosted IndexNow key file recorded in data/indexnow-key.json
and stores or reads no other credential.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEFAULT_KEY_FILE = ROOT / 'data' / 'indexnow-key.json'
INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
KEY_RE = re.compile(r'^[0-9a-f]{32}$')
BATCH_LIMIT = 10000


def load_public_key(path: Path = DEFAULT_KEY_FILE) -> str:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or set(data.keys()) - {'key', 'schemaVersion', 'note'}:
        raise ValueError('IndexNow key record must hold only the public key')
    key = str(data.get('key') or '').strip()
    if not KEY_RE.match(key):
        raise ValueError('IndexNow key must be a 32-character lowercase hex string')
    return key


def parse_sitemap_xml(xml_text: str, expected_origin: str | None = None) -> dict[str, str]:
    """Return {loc_url: lastmod_or_empty} from a standard XML urlset."""
    root = ET.fromstring(xml_text)
    entries: dict[str, str] = {}
    for elem in root.iter():
        tag = elem.tag.split('}', 1)[-1]
        if tag != 'url':
            continue
        loc = ''
        lastmod = ''
        for child in elem:
            ctag = child.tag.split('}', 1)[-1]
            if ctag == 'loc' and child.text:
                loc = child.text.strip()
            elif ctag == 'lastmod' and child.text:
                lastmod = child.text.strip()
        if not loc:
            raise ValueError('Sitemap <url> entry is missing <loc>')
        if any(ch.isspace() for ch in loc):
            raise ValueError(f'Sitemap <loc> contains unencoded whitespace: {loc}')
        if expected_origin and not loc.startswith(expected_origin.rstrip('/') + '/'):
            raise ValueError(f'Sitemap <loc> outside expected origin {expected_origin}: {loc}')
        entries[loc] = lastmod
    return entries


def compute_changed_urls(previous: dict[str, str], current: dict[str, str]) -> list[str]:
    """Return sorted URLs that are new or have an updated <lastmod> value."""
    changed: list[str] = []
    for url, cur_mod in sorted(current.items()):
        if url not in previous:
            changed.append(url)
        else:
            prev_mod = previous[url]
            if cur_mod and prev_mod and cur_mod != prev_mod:
                changed.append(url)
            elif cur_mod and not prev_mod:
                changed.append(url)
    return changed


def build_payload(origin: str, key: str, urls: list[str]) -> dict[str, object]:
    if not KEY_RE.match(key):
        raise ValueError('Invalid IndexNow key')
    parsed = urlsplit(origin)
    if parsed.scheme != 'https' or not parsed.netloc:
        raise ValueError(f'Origin must use https: {origin}')
    host = parsed.netloc
    prefix = f'https://{host}/'
    for u in urls:
        if not u.startswith(prefix) or any(ch.isspace() for ch in u):
            raise ValueError(f'URL does not belong to host {host}: {u}')
    return {
        'host': host,
        'key': key,
        'keyLocation': f'https://{host}/{key}.txt',
        'urlList': list(urls),
    }


def _default_http(url: str, method: str = 'GET', body: bytes | None = None,
                  headers: dict[str, str] | None = None, timeout: int = 15) -> tuple[int, str]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as err:
        text = err.read().decode('utf-8', errors='replace') if err.fp else ''
        return err.code, text


def verify_hosted_key(origin: str, key: str, http_fn=_default_http,
                      retries: int = 3, delay_seconds: float = 2.0) -> tuple[bool, str]:
    parsed = urlsplit(origin)
    key_url = f'https://{parsed.netloc}/{key}.txt'
    last_detail = ''
    for attempt in range(max(1, retries)):
        try:
            status, body = http_fn(key_url, 'GET', None, {'User-Agent': 'MadeByMatt-IndexNow/1.0'}, 15)
            if status == 200 and body.strip() == key:
                return True, key_url
            last_detail = f'HTTP {status} from {key_url}'
        except Exception as exc:
            last_detail = f'{type(exc).__name__}: {exc}'
        if attempt + 1 < retries and delay_seconds > 0:
            time.sleep(delay_seconds)
    return False, last_detail


def submit_urls(origin: str, key: str, urls: list[str],
                endpoint: str = INDEXNOW_ENDPOINT,
                http_fn=_default_http,
                retries: int = 1,
                delay_seconds: float = 0.0) -> dict[str, object]:
    if not urls:
        return {'status': 'NO_CHANGES', 'submitted': 0, 'origin': origin}
    key_ok, detail = verify_hosted_key(origin, key, http_fn=http_fn,
                                       retries=retries, delay_seconds=delay_seconds)
    if not key_ok:
        return {
            'status': 'KEY_NOT_LIVE_YET',
            'submitted': 0,
            'origin': origin,
            'detail': detail,
        }
    submitted = 0
    for start in range(0, len(urls), BATCH_LIMIT):
        batch = urls[start:start + BATCH_LIMIT]
        payload = build_payload(origin, key, batch)
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        status, resp_text = http_fn(
            endpoint,
            'POST',
            raw,
            {
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': 'MadeByMatt-IndexNow/1.0',
            },
            20,
        )
        if status not in (200, 202):
            return {
                'status': 'SUBMIT_FAILED',
                'httpStatus': status,
                'submitted': submitted,
                'origin': origin,
                'detail': resp_text[:300],
            }
        submitted += len(batch)
    return {'status': 'SUBMITTED', 'submitted': submitted, 'origin': origin}


def self_test() -> bool:
    ok = True

    def check(name: str, cond: bool, detail: str = '') -> None:
        nonlocal ok
        ok = ok and bool(cond)
        print(f"  [{'ok' if cond else 'FAIL'}] {name}{' - ' + detail if detail else ''}")

    valid_key = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
    origin = 'https://madebymatt.uk'

    # 1. RED FIRST: invalid / non-32-hex key is rejected.
    rejected_bad_key = False
    try:
        build_payload(origin, 'short-key', ['https://madebymatt.uk/'])
    except ValueError:
        rejected_bad_key = True
    check('red-first: invalid IndexNow key rejected', rejected_bad_key)

    # 2. RED FIRST: off-host URL in payload is rejected.
    rejected_off_host = False
    try:
        build_payload(origin, valid_key, ['https://example.org/other/'])
    except ValueError:
        rejected_off_host = True
    check('red-first: off-host URL rejected', rejected_off_host)

    # 3. RED FIRST: unencoded whitespace in sitemap <loc> is rejected.
    rejected_ws_loc = False
    try:
        parse_sitemap_xml(
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>https://madebymatt.uk/Lessons/bad space.html</loc></url>'
            '</urlset>',
            expected_origin=origin,
        )
    except ValueError:
        rejected_ws_loc = True
    check('red-first: unencoded whitespace in sitemap <loc> rejected', rejected_ws_loc)

    # 4. RED FIRST: API HTTP 403 error surfaces SUBMIT_FAILED.
    def fake_http_403(url, method='GET', body=None, headers=None, timeout=15):
        if method == 'GET':
            return 200, valid_key + '\n'
        return 403, 'Invalid key'

    res_fail = submit_urls(origin, valid_key, ['https://madebymatt.uk/Lessons/'], http_fn=fake_http_403)
    check('red-first: endpoint 403 surfaces SUBMIT_FAILED', res_fail['status'] == 'SUBMIT_FAILED')

    # 5. RED FIRST: unhosted/mismatched key file prevents submission cleanly.
    def fake_http_missing_key(url, method='GET', body=None, headers=None, timeout=15):
        return 404, 'Not Found'

    res_no_key = submit_urls(origin, valid_key, ['https://madebymatt.uk/Lessons/'], http_fn=fake_http_missing_key)
    check('red-first: missing live key file skips submission with KEY_NOT_LIVE_YET',
          res_no_key['status'] == 'KEY_NOT_LIVE_YET' and res_no_key['submitted'] == 0)

    # 6. GREEN: changed URL calculation + clean 200/202 submission.
    prev_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        '<url><loc>https://madebymatt.uk/</loc><lastmod>2026-10-20</lastmod></url>'
        '<url><loc>https://madebymatt.uk/Lessons/</loc><lastmod>2026-10-20</lastmod></url>'
        '</urlset>'
    )
    curr_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        '<url><loc>https://madebymatt.uk/</loc><lastmod>2026-10-20</lastmod></url>'
        '<url><loc>https://madebymatt.uk/Lessons/</loc><lastmod>2026-11-01</lastmod></url>'
        '<url><loc>https://madebymatt.uk/about/</loc><lastmod>2026-11-01</lastmod></url>'
        '</urlset>'
    )
    prev_map = parse_sitemap_xml(prev_xml, expected_origin=origin)
    curr_map = parse_sitemap_xml(curr_xml, expected_origin=origin)
    changed = compute_changed_urls(prev_map, curr_map)
    check('green: changed URL diff detects updated lastmod and newly added URL',
          changed == ['https://madebymatt.uk/Lessons/', 'https://madebymatt.uk/about/'])

    posted_bodies: list[dict[str, object]] = []

    def fake_http_202(url, method='GET', body=None, headers=None, timeout=15):
        if method == 'GET':
            return 200, valid_key + '\n'
        posted_bodies.append(json.loads(body.decode('utf-8')))
        return 202, ''

    res_ok = submit_urls(origin, valid_key, changed, http_fn=fake_http_202)
    check('green: valid changed URLs submitted with hosted public key',
          res_ok['status'] == 'SUBMITTED'
          and res_ok['submitted'] == 2
          and len(posted_bodies) == 1
          and posted_bodies[0]['keyLocation'] == f'https://madebymatt.uk/{valid_key}.txt'
          and posted_bodies[0]['urlList'] == changed)

    res_none = submit_urls(origin, valid_key, [], http_fn=fake_http_202)
    check('green: zero changed URLs exits cleanly with NO_CHANGES',
          res_none['status'] == 'NO_CHANGES' and res_none['submitted'] == 0)

    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        bad_key_path = Path(tmp) / 'bad.json'
        bad_key_path.write_text(json.dumps({'schemaVersion': 1, 'key': valid_key, 'apiToken': 'forbidden'}), encoding='utf-8')
        rejected_extra = False
        try:
            load_public_key(bad_key_path)
        except ValueError:
            rejected_extra = True
        check('red-first: extra non-public credential field in key JSON fails closed', rejected_extra)

    if DEFAULT_KEY_FILE.is_file():
        loaded_key = load_public_key(DEFAULT_KEY_FILE)
        check('green: committed data/indexnow-key.json loads cleanly', bool(KEY_RE.match(loaded_key)))

    print('submit_indexnow self-test', 'PASS' if ok else 'FAIL')
    return ok


def _read_sitemap_source(spec: str, expected_origin: str) -> dict[str, str]:
    if not spec:
        return {}
    if spec.startswith('https://') or spec.startswith('http://'):
        status, text = _default_http(spec, 'GET', None, {'User-Agent': 'MadeByMatt-IndexNow/1.0'}, 20)
        if status != 200:
            return {}
        return parse_sitemap_xml(text, expected_origin=expected_origin)
    path = Path(spec)
    if not path.is_file():
        return {}
    return parse_sitemap_xml(path.read_text(encoding='utf-8'), expected_origin=expected_origin)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--origin', help='Published origin, e.g. https://madebymatt.uk')
    parser.add_argument('--current-sitemap', help='Path or URL to the newly built sitemap.xml')
    parser.add_argument('--previous-sitemap', default='', help='Optional path or URL to pre-deploy sitemap.xml')
    parser.add_argument('--key-file', type=Path, default=DEFAULT_KEY_FILE)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--strict', action='store_true', help='Fail exit code if submission HTTP call fails')
    args = parser.parse_args()

    if args.self_test:
        return 0 if self_test() else 1

    if not args.origin or not args.current_sitemap:
        parser.error('--origin and --current-sitemap are required unless --self-test is set')

    key = load_public_key(args.key_file)
    current = _read_sitemap_source(args.current_sitemap, args.origin)
    if not current:
        print(json.dumps({'status': 'NO_CURRENT_SITEMAP', 'origin': args.origin}))
        return 1 if args.strict else 0
    try:
        previous = _read_sitemap_source(args.previous_sitemap, args.origin) if args.previous_sitemap else {}
    except Exception:
        previous = {}
    changed = compute_changed_urls(previous, current) if previous else sorted(current.keys())

    if args.dry_run:
        payload = build_payload(args.origin, key, changed[:BATCH_LIMIT])
        print(json.dumps({
            'status': 'DRY_RUN',
            'origin': args.origin,
            'changedCount': len(changed),
            'keyLocation': payload['keyLocation'],
            'sampleUrls': changed[:10],
        }, indent=2))
        return 0

    result = submit_urls(args.origin, key, changed, retries=2, delay_seconds=1.5)
    print(json.dumps(result, indent=2))
    if args.strict and result['status'] == 'SUBMIT_FAILED':
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
