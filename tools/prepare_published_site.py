#!/usr/bin/env python3
"""Select the exact successful Pages artifact, without rebuilding expected bytes.

The retrieval implementation is the accepted Lessons publication selector,
copied without semantic changes into lib/publication_artifacts.py. It binds
source SHA, run, successful deployment attempt, upload window and ZIP digest.
"""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import urllib.request

from lib.publication_artifacts import GitHub, Inconclusive, prepare_one, require


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise Inconclusive(f'Publication byte comparison redirected: {request.full_url} -> {newurl}')


def prepare(expected, output, wait_seconds=240):
    require(re.fullmatch('[0-9a-f]{40}', expected), 'An immutable expected Site SHA is required')
    require(1 <= wait_seconds <= 300, 'Publication retrieval must be bounded')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    record = prepare_one('site', expected, output, GitHub(time.monotonic() + wait_seconds))
    (output / 'site-publication.json').write_text(json.dumps(record, indent=2) + '\n')
    return record


def verify_routes(record, routes, origin='https://madebymatt.uk'):
    require(origin == 'https://madebymatt.uk', 'Only the canonical HTTPS education origin is supported')
    root = Path(record['root']).resolve()
    require(routes and len(routes) == len(set(routes)), 'Publication route coverage is empty or duplicated')
    def verify(route):
        require(route.startswith('/') and '?' not in route and '#' not in route and '..' not in Path(route).parts,
                f'Unsafe publication route: {route}')
        relative = route.lstrip('/') + ('index.html' if route.endswith('/') else '')
        local = (root / relative).resolve()
        require(local.is_relative_to(root) and local.is_file(), f'Missing published route: {route}')
        expected = local.read_bytes()
        request = urllib.request.Request(origin + route, headers={'Cache-Control': 'no-cache',
                                                                  'User-Agent': 'mbm-published-site-proof'})
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
            actual = response.read()
            require(response.status == 200, f'{route}: HTTP {response.status}')
            require(actual == expected, f'{route}: served bytes differ from the successful publication artifact')
        return {'route': route, 'bytes': len(actual), 'sha256': hashlib.sha256(actual).hexdigest()}
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(verify, routes))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--audience-record', type=Path)
    args = parser.parse_args()
    record = prepare(args.expected_sha, args.output)
    if args.audience_record:
        audiences = json.loads(args.audience_record.read_text())['audiences']
        routes = [row['route'] for row in audiences.values()]
        require(len(routes) >= 7 and len(routes) == len(set(routes)), 'Audience coverage is empty, short or duplicated')
        # Governors is the explicit new audience in this publication. Older
        # source records still describe the seven recovered audience pages.
        routes = list(dict.fromkeys(routes + ['/for/governors-trustees/']))
        # /start/ is a separately tested redirect, so verify its actual file
        # bytes without following the navigation performed by that document.
        routes += ['/', '/main/', '/start/index.html', '/teach/', '/resources/', '/education-hub/']
        rows = verify_routes(record, routes)
        (args.output / 'audience-publication-proof.json').write_text(json.dumps(
            {'publication': record, 'routes': rows}, indent=2) + '\n')
        print(f'PUBLISHED ROUTES: {len(rows)}/{len(routes)} exact deployed-artifact byte matches')
    print('BOUND SITE PUBLICATION ' + str(args.output / 'site-publication.json'))


if __name__ == '__main__':
    try:
        main()
    except Inconclusive as error:
        print('[INCONCLUSIVE] ' + str(error), file=sys.stderr)
        raise SystemExit(2)
