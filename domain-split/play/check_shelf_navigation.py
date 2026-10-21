#!/usr/bin/env python3
"""TX play shelf navigation v1: the static half of the shelf's acceptance.

Reads the BUILT shelf (output/games/index.html) and the manifest it was built
from, never the template, and proves four things:

  1. every Play href on a shelf card or in the spotlight resolves to a file in
     the built tree;
  2. every manifest game appears on the shelves exactly once (a series edition
     counts where its Play anchor sits, on its lead's card), and every
     classroom activity appears exactly once, in the Classroom shelf;
  3. the spotlight is exactly the manifest's featured rows, in manifest order;
  4. every shelf is a manifest category that exists on the page's own data
     (no invented category), and the Classroom shelf is the only home of the
     activities.

--self-test plants one defect per limb into a scratch copy of the parsed page
and requires each limb to go red, so a green run is a proof rather than a
vacancy.

Usage: check_shelf_navigation.py --output DIR [--manifest PATH] [--self-test]
"""
from __future__ import annotations
import argparse
import copy
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]


def key(route: str) -> str:
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'


class Shelf(HTMLParser):
    """Collects shelves, cards (with their Play hrefs) and the spotlight."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, attrs)
        self.shelves = []        # {'name','id','cards':[...]}
        self.spot = []           # [{'id','hrefs'}]
        self.in_grid = 0
        self.noscript = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'noscript':
            self.noscript += 1
        if tag not in self.VOID:
            self.stack.append((tag, a))
        if self.noscript:
            return
        if a.get('id') == 'game-grid':
            self.in_grid = len(self.stack)
        if 'data-shelf' in a and self.in_grid:
            self.shelves.append({'name': a['data-shelf'], 'id': a.get('id', ''), 'cards': []})
        if ('data-card' in a or 'data-activity' in a) and self.in_grid:
            if not self.shelves:  # a card outside any shelf is reported as a shelf of no category
                self.shelves.append({'name': '(no shelf)', 'id': '', 'cards': []})
            self.shelves[-1]['cards'].append({'id': a.get('data-card') or a.get('data-activity'),
                                              'kind': 'game' if 'data-card' in a else 'activity', 'hrefs': []})
        if 'data-spot' in a:
            self.spot.append({'id': a['data-spot'], 'hrefs': []})
        if tag == 'a' and 'data-play' in a and 'href' in a:
            inside = [t for t in self.stack]
            if any('data-spot' in at for _, at in inside):
                self.spot[-1]['hrefs'].append(a['href'])
            elif self.in_grid and any(('data-card' in at or 'data-activity' in at) for _, at in inside):
                self.shelves[-1]['cards'][-1]['hrefs'].append(a['href'])

    def handle_endtag(self, tag):
        if tag == 'noscript':
            self.noscript -= 1
        if tag in self.VOID:
            return
        while self.stack:
            t, _ = self.stack.pop()
            if self.in_grid and len(self.stack) < self.in_grid:
                self.in_grid = 0
            if t == tag:
                break


def parse(html: str) -> dict:
    p = Shelf()
    p.feed(html)
    return {'shelves': p.shelves, 'spot': p.spot}


def limbs(page: dict, out: Path, manifest: list, discovery: dict) -> dict:
    games = discovery['games']
    catalogue = [g for g in games if g['group'] == 'games']
    activities = [g for g in games if g['group'] != 'games']
    errors = []

    # 1. every card and spotlight href resolves on disk
    hrefs = [h for s in page['shelves'] for c in s['cards'] for h in c['hrefs']] + [h for s in page['spot'] for h in s['hrefs']]
    missing = []
    for h in hrefs:
        p = out / unquote(urlparse(h).path).lstrip('/')
        if h.endswith('/'):
            p = p / 'index.html'
        if not p.is_file():
            missing.append(h)
    if not hrefs:
        errors.append('no shelf or spotlight Play hrefs on the page')
    if missing:
        errors.append('card hrefs that do not resolve on disk: ' + json.dumps(missing[:8]))

    # 2. every manifest game exactly once; every activity exactly once, in Classroom
    game_hrefs = [key(h) for s in page['shelves'] for c in s['cards'] if c['kind'] == 'game' for h in c['hrefs']]
    want = [key(g['href']) for g in manifest]
    seen = {}
    for h in game_hrefs:
        seen[h] = seen.get(h, 0) + 1
    twice = sorted(h for h, n in seen.items() if n > 1)
    absent = sorted(set(want) - set(seen))
    extra = sorted(set(seen) - set(want))
    if twice or absent or extra:
        errors.append('manifest coverage: twice=%s missing=%s extra=%s' % (twice[:5], absent[:5], extra[:5]))
    act_cards = [(s['name'], c) for s in page['shelves'] for c in s['cards'] if c['kind'] == 'activity']
    act_keys = [key(h) for _, c in act_cards for h in c['hrefs']]
    if sorted(act_keys) != sorted(key(a['route']) for a in activities):
        errors.append('activities are not each on the shelves exactly once')
    if any(name != 'Classroom' for name, _ in act_cards):
        errors.append('an activity sits outside the Classroom shelf')
    card_ids = [c['id'] for s in page['shelves'] for c in s['cards']]
    if len(card_ids) != len(set(card_ids)):
        errors.append('a card id appears twice on the shelves')

    # 3. spotlight == featured rows, manifest order
    featured = [key(g['href']) for g in manifest if g.get('featured') is True]
    spot = [key(h) for s in page['spot'] for h in s['hrefs'][:1]]
    if not featured:
        errors.append('the manifest flags no featured game')
    if spot != featured:
        errors.append('spotlight %s != featured flag %s' % (spot, featured))

    # 4. shelves are existing categories; Classroom first and unique
    names = [s['name'] for s in page['shelves']]
    allowed = {g['genre'] for g in catalogue} | {'Classroom'}
    invented = [n for n in names if n not in allowed]
    if invented:
        errors.append('invented shelf categories: ' + json.dumps(invented))
    if len(names) != len(set(names)):
        errors.append('a category has two shelves')
    if names[:1] != ['Classroom']:
        errors.append('the Classroom shelf is not first: ' + json.dumps(names[:3]))
    if any(not s['cards'] for s in page['shelves']):
        errors.append('an empty shelf was rendered')
    counts = {s['name']: {'cards': len(s['cards']), 'gameHrefs': sum(len(c['hrefs']) for c in s['cards'] if c['kind'] == 'game'),
                          'activities': sum(1 for c in s['cards'] if c['kind'] == 'activity')} for s in page['shelves']}
    return {'errors': errors, 'shelves': counts, 'spotlight': len(spot), 'hrefsChecked': len(hrefs)}


def self_test(page, out, manifest, discovery):
    base = limbs(page, out, manifest, discovery)
    assert not base['errors'], 'self-test needs a green page first: ' + json.dumps(base['errors'])
    plants = {}

    def bites(name, mutate, needle):
        p = copy.deepcopy(page)
        m = copy.deepcopy(manifest)
        mutate(p, m)
        r = limbs(p, out, m, discovery)
        plants[name] = any(needle in e for e in r['errors'])
        assert plants[name], 'planted defect not refused: ' + name + ' ' + json.dumps(r['errors'])

    game_card = next(c for s in page['shelves'] for c in s['cards'] if c['kind'] == 'game')
    bites('broken-href', lambda p, m: next(c for s in p['shelves'] for c in s['cards'] if c['kind'] == 'game')['hrefs'].__setitem__(0, '/no-such-game/'), 'do not resolve')
    bites('dropped-card', lambda p, m: p['shelves'][-1]['cards'].pop(), 'coverage')
    bites('duplicate-card', lambda p, m: p['shelves'][-1]['cards'].append(copy.deepcopy(game_card)), 'twice')
    bites('spotlight-drift', lambda p, m: p['spot'].pop(), 'spotlight')
    bites('flag-drift', lambda p, m: m.__setitem__(0, {**m[0], 'featured': not m[0].get('featured')}), 'spotlight')
    bites('invented-category', lambda p, m: p['shelves'][-1].__setitem__('name', 'Top Picks'), 'invented')
    return plants


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', required=True, type=Path, help='the built publication root (contains games/)')
    ap.add_argument('--manifest', type=Path, default=ROOT / 'data/source-manifests/games.json')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    out = a.output / 'games'
    page = parse((out / 'index.html').read_text(encoding='utf-8'))
    manifest = json.loads(a.manifest.read_text(encoding='utf-8'))['games']
    discovery = json.loads((out / 'data/play-discovery.json').read_text(encoding='utf-8'))
    result = limbs(page, out, manifest, discovery)
    if a.self_test and not result['errors']:
        result['selfTest'] = self_test(page, out, manifest, discovery)
    print(json.dumps(result, indent=2))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
