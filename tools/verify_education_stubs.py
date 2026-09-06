#!/usr/bin/env python3
"""verify_education_stubs — the former game routes on madebymatt.uk are stubs.

Order HC3 §1.1 / §2.4. After the split a game route on the education origin
must serve a STUB and nothing else:

  * HTTP 200 on the education origin (no redirect off it)
  * at most 2 048 bytes of HTML
  * `data-game-moved` marker, `<meta name="robots" content="noindex">`
  * `<link rel="canonical" href="https://www.madebymatt-play.uk/…">`
  * exactly one "Open the game" link, pointing at the play origin
  * no game code: no <canvas>, no external script other than /stub-handoff.js

The route set is derived by tools/route_origins.py, never typed here.

Usage
  verify_education_stubs.py --origin https://madebymatt.uk --routes /apexkick/ /Lessons/Games/Prism.html
  verify_education_stubs.py --origin https://madebymatt.uk --all
  verify_education_stubs.py --self-test
Exit 0 every stub to spec · 1 a route named below is not · 2 INCONCLUSIVE
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIMIT = 2048
PLAY_HOSTS = ('madebymatt-play.uk', 'www.madebymatt-play.uk')
ALLOWED_SCRIPT = '/stub-handoff.js'


def judge(body: bytes, status: int, final_host: str | None, origin_host: str):
    problems = []
    if status != 200:
        problems.append(f'HTTP {status}')
    if final_host and final_host != origin_host:
        problems.append(f'redirected off the education origin to {final_host}')
    if len(body) > LIMIT:
        problems.append(f'{len(body)} bytes > {LIMIT}')
    text = body.decode('utf-8', 'replace')
    if 'data-game-moved' not in text:
        problems.append('no data-game-moved marker')
    if not re.search(r'<meta\s+name="robots"\s+content="noindex"', text):
        problems.append('no noindex')
    canon = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', text)
    if not canon or urllib.parse.urlsplit(canon.group(1)).hostname not in PLAY_HOSTS:
        problems.append('no canonical to the play origin')
    links = re.findall(r'<a\s+id="play-game"\s+href="([^"]+)"', text)
    if len(links) != 1 or urllib.parse.urlsplit(links[0]).hostname not in PLAY_HOSTS:
        problems.append('not exactly one Open-the-game link to play')
    if re.search(r'<canvas\b', text, re.I):
        problems.append('carries a <canvas>')
    for src in re.findall(r'<script[^>]+src="([^"]+)"', text):
        if src != ALLOWED_SCRIPT:
            problems.append(f'external script {src}')
    return problems


def fetch(url: str):
    class NoOffOrigin(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return super().redirect_request(req, fp, code, msg, headers, newurl)
    opener = urllib.request.build_opener(NoOffOrigin())
    try:
        with opener.open(urllib.request.Request(url, headers={'User-Agent': 'hc3-stub-check'}), timeout=30) as r:
            return r.status, r.read(), urllib.parse.urlsplit(r.geturl()).hostname
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b'', urllib.parse.urlsplit(e.geturl()).hostname
    except (urllib.error.URLError, TimeoutError) as e:
        raise RuntimeError(str(e))


def run(origin: str, routes: list[str]):
    host = urllib.parse.urlsplit(origin).hostname
    red = 0
    for route in routes:
        url = origin + urllib.parse.quote(route if route != '/' else '/', safe='/()')
        try:
            status, body, final = fetch(url)
        except RuntimeError as exc:
            print(f'  INCONCLUSIVE {route}: {exc}')
            return 2
        problems = judge(body, status, final, host)
        if problems:
            red += 1
            print(f'  RED  {route}: ' + '; '.join(problems))
        else:
            print(f'  ok   {route}  ({len(body)} B)')
    print(f'{len(routes)} route(s) checked, {red} not to spec')
    return 1 if red else 0


GOOD = ('<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
        '<link rel="canonical" href="https://www.madebymatt-play.uk/apexkick/"><title>moved</title></head>'
        '<body data-game-moved><p><a id="play-game" href="https://www.madebymatt-play.uk/apexkick/">Open the game</a></p>'
        '<script src="/stub-handoff.js"></script></body></html>').encode()


def self_test():
    ok = True

    def control(name, passed, detail=''):
        nonlocal ok
        ok = ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] {name}{'  — ' + detail if detail else ''}")

    control('run 1: a to-spec stub is green', judge(GOOD, 200, 'madebymatt.uk', 'madebymatt.uk') == [])
    canvas = GOOD.replace(b'<p>', b'<canvas></canvas><p>')
    control('run 2: a planted <canvas> reds', 'carries a <canvas>' in judge(canvas, 200, 'madebymatt.uk', 'madebymatt.uk'))
    big = GOOD + b'<!--' + b'x' * LIMIT + b'-->'
    control('run 2: a planted 2 KB overrun reds', any('bytes >' in p for p in judge(big, 200, 'madebymatt.uk', 'madebymatt.uk')))
    nocanon = re.sub(rb'<link rel="canonical"[^>]*>', b'', GOOD)
    control('run 2: a missing canonical reds', 'no canonical to the play origin' in judge(nocanon, 200, 'madebymatt.uk', 'madebymatt.uk'))
    foreign = GOOD.replace(b'/stub-handoff.js', b'https://cdn.example/x.js')
    control('run 2: a foreign script reds', any('external script' in p for p in judge(foreign, 200, 'madebymatt.uk', 'madebymatt.uk')))
    control('run 2: a redirect off the education origin reds',
            any('redirected' in p for p in judge(GOOD, 200, 'www.madebymatt-play.uk', 'madebymatt.uk')))
    control('run 3: the defect removed is green again', judge(GOOD, 200, 'madebymatt.uk', 'madebymatt.uk') == [])
    print('self-test', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--origin')
    ap.add_argument('--routes', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.origin:
        ap.error('--origin is required')
    routes = list(a.routes or [])
    if a.all:
        out = subprocess.run([sys.executable, str(HERE / 'route_origins.py'), '--stubs'], capture_output=True, text=True)
        if out.returncode:
            print('INCONCLUSIVE: the route table could not be derived'); return 2
        routes += [r for r in out.stdout.split('\n') if r]
    if not routes:
        print('INCONCLUSIVE: no routes to check'); return 2
    routes = [r if r == '/' or '.' in r.rsplit('/', 1)[-1] else r.rstrip('/') + '/' for r in routes]
    return run(a.origin.rstrip('/'), routes)


if __name__ == '__main__':
    sys.exit(main())
