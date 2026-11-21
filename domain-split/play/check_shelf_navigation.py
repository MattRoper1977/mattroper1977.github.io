#!/usr/bin/env python3
"""The static half of the Play front page's acceptance (PLAY-D2, 21 Nov 2026).

Reads the BUILT page (output/games/index.html), its inline data and the manifest
and discovery-moods.json it was built from, never the template, and proves:

  1. every Play href on a grid card or in the Teacher corner resolves to a file
     in the built tree, and so does every Pick-a-game pack and Today's pick route;
  2. every manifest game has exactly one grid card holding exactly one Play link,
     to its own route; every classroom activity appears exactly once, in the
     Teacher corner; the staff calibration item is on neither (nor in the data);
  3. the Pick-a-game packs and Today's pool served in the page are the committed
     ones: three distinct touch-ready, non-whole-class catalogue games per pack;
     and the manifest still flags at most one spotlight row (AK10-AB);
  4. every card's mood is the committed primary mood, no mood is invented, and
     every mood button's count is derived from the committed moods.

This replaces the TX shelf limbs one for one: (1) hrefs on disk, (2) every
manifest game once, (3) spotlight == featured flags -> packs/pool == committed
data, (4) no invented category -> no invented mood.

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
MOODS = Path(__file__).resolve().with_name('discovery-moods.json')


def key(route: str) -> str:
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'


class Page(HTMLParser):
    """Collects grid cards (with their Play hrefs and mood), Teacher-corner rows and mood buttons."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, attrs)
        self.cards = []          # {'id','games','mood','hrefs'}
        self.activities = []     # {'id','hrefs'}
        self.moods = []          # {'id','aria','count'}
        self.hrefs = []          # every a[href] outside noscript
        self.in_grid = self.in_class = 0
        self.noscript = 0
        self.mood_count = None
        self.data = None
        self.in_data = False

    def inside(self, attr, value=None):
        return any(attr in at and (value is None or at.get(attr) == value) for _, at in self.stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'noscript':
            self.noscript += 1
        if tag not in self.VOID:
            self.stack.append((tag, a))
        if self.noscript:
            return
        if tag == 'script' and a.get('id') == 'play-data':
            self.in_data = True
            self.data = ''
        if a.get('id') == 'game-grid':
            self.in_grid = len(self.stack)
        if a.get('id') == 'classroom':
            self.in_class = len(self.stack)
        if 'data-card' in a and self.in_grid:
            self.cards.append({'id': a['data-card'], 'games': a.get('data-games', ''), 'mood': a.get('data-mood', ''), 'hrefs': []})
        if 'data-activity' in a:
            self.activities.append({'id': a['data-activity'], 'inClassroom': bool(self.in_class), 'hrefs': []})
        if tag == 'button' and 'mood-btn' in a.get('class', '').split():
            self.moods.append({'id': a.get('data-mood', ''), 'aria': a.get('aria-label'), 'count': None})
        if tag == 'span' and a.get('class') == 'mood-count':
            self.mood_count = ''
        if tag == 'a' and 'href' in a:
            self.hrefs.append(a['href'])
            if 'data-play' in a:
                if self.in_grid and self.cards and self.inside('data-card'):
                    self.cards[-1]['hrefs'].append(a['href'])
                elif self.activities and self.inside('data-activity'):
                    self.activities[-1]['hrefs'].append(a['href'])

    def handle_data(self, text):
        if self.in_data:
            self.data += text
        if self.mood_count is not None:
            self.mood_count += text

    def handle_endtag(self, tag):
        if tag == 'noscript':
            self.noscript -= 1
        if tag == 'script' and self.in_data:
            self.in_data = False
        if tag == 'span' and self.mood_count is not None:
            if self.moods:
                self.moods[-1]['count'] = self.mood_count.strip()
            self.mood_count = None
        if tag in self.VOID:
            return
        while self.stack:
            t, _ = self.stack.pop()
            if self.in_grid and len(self.stack) < self.in_grid:
                self.in_grid = 0
            if self.in_class and len(self.stack) < self.in_class:
                self.in_class = 0
            if t == tag:
                break


def parse(html: str) -> dict:
    p = Page()
    p.feed(html)
    return {'cards': p.cards, 'activities': p.activities, 'moods': p.moods, 'hrefs': p.hrefs,
            'data': json.loads(p.data) if p.data else {}, 'html': html}


def on_disk(out: Path, href: str) -> bool:
    p = out / unquote(urlparse(href).path).lstrip('/')
    if href.endswith('/'):
        p = p / 'index.html'
    return p.is_file()


def limbs(page: dict, out: Path, manifest: list, discovery: dict, moods: dict) -> dict:
    games = discovery['games']
    catalogue = [g for g in games if g['group'] == 'games']
    activities = [g for g in games if g['group'] == 'activities']
    staff = [g for g in games if g['group'] == 'staff']
    by_route = {key(g['route']): g for g in catalogue}
    errors = []

    # 1. every card, activity, pack and pool href resolves on disk
    data = page['data'] or {}
    packs, pool = data.get('packs') or [], data.get('todayPool') or []
    route_of = {g['id']: g['route'] for g in games}
    hrefs = [h for c in page['cards'] for h in c['hrefs']] + [h for a in page['activities'] for h in a['hrefs']]
    hrefs += [route_of.get(i, '/no-such-id/' + i) for p in packs for i in p.get('games', [])] + [route_of.get(i, '/no-such-id/' + i) for i in pool]
    missing = [h for h in hrefs if not on_disk(out, h)]
    if not hrefs:
        errors.append('no grid or Teacher-corner Play hrefs on the page')
    if missing:
        errors.append('card hrefs that do not resolve on disk: ' + json.dumps(missing[:8]))

    # 2. every manifest game exactly once, one link to itself; activities once, in the Teacher corner; no staff
    game_hrefs = [key(h) for c in page['cards'] for h in c['hrefs']]
    want = [key(g['href']) for g in manifest]
    seen = {}
    for h in game_hrefs:
        seen[h] = seen.get(h, 0) + 1
    twice = sorted(h for h, n in seen.items() if n > 1)
    absent = sorted(set(want) - set(seen))
    extra = sorted(set(seen) - set(want))
    if twice or absent or extra:
        errors.append('manifest coverage: twice=%s missing=%s extra=%s' % (twice[:5], absent[:5], extra[:5]))
    for c in page['cards']:
        g = by_route.get(key(c['hrefs'][0])) if len(c['hrefs']) == 1 else None
        if len(c['hrefs']) != 1 or not g or g['id'] != c['id'] or c['games'] != c['id']:
            errors.append('a card does not hold exactly one Play link to its own game: ' + c['id'])
    ids = [c['id'] for c in page['cards']]
    if len(ids) != len(set(ids)):
        errors.append('a card id appears twice in the grid')
    act_keys = [key(h) for a in page['activities'] for h in a['hrefs']]
    if sorted(act_keys) != sorted(key(a['route']) for a in activities) or any(len(a['hrefs']) != 1 for a in page['activities']):
        errors.append('activities are not each in the Teacher corner exactly once')
    if any(not a['inClassroom'] for a in page['activities']):
        errors.append('an activity sits outside the Teacher corner')
    for s in staff:
        if any(key(h) == key(s['route']) for h in page['hrefs']) or s['id'] in page['html'] or s['title'] in page['html']:
            errors.append('the staff item reached the pupil page: ' + s['id'])
        if any(r.get('id') == s['id'] for r in data.get('games', [])):
            errors.append('the staff item is in the page data: ' + s['id'])

    # 3. packs and Today's pool == committed data; touch-ready, not whole-class; one spotlight flag at most
    lead = [key(g['href']) for g in manifest if g.get('spotlight') is True]
    if len(lead) > 1:
        errors.append('the manifest flags more than one spotlight game: %s' % lead)
    spec = {key(r): v for r, v in moods['games'].items()}

    def ready(gid):
        g = next((x for x in catalogue if x['id'] == gid), None)
        return bool(g) and 'touch' in g['controls'] and not spec.get(key(g['route']), {}).get('whole_class')

    want_packs = [{'slug': p['slug'], 'name': p['name'], 'games': [by_route[key(r)]['id'] if key(r) in by_route else r for r in p['routes']]} for p in moods['packs']]
    if [{'slug': p.get('slug'), 'name': p.get('name'), 'games': p.get('games')} for p in packs] != want_packs:
        errors.append('served packs differ from the committed packs')
    for p in packs:
        g = p.get('games') or []
        if len(g) != 3 or len(set(g)) != 3 or not all(ready(i) for i in g):
            errors.append('a pack is not three distinct touch-ready catalogue games: ' + str(p.get('slug')))
    want_pool = [by_route[key(r)]['id'] if key(r) in by_route else r for r in moods['today_pool']]
    if pool != want_pool:
        errors.append("served Today's pool differs from the committed pool")
    if len(pool) < 10 or len(set(pool)) != len(pool) or not all(ready(i) for i in pool):
        errors.append("Today's pool is not ten or more distinct touch-ready catalogue games")

    # 4. moods: committed primary per card, nothing invented, counts derived
    mood_ids = [m['id'] for m in moods['moods']]
    for c in page['cards']:
        g = by_route.get(key(c['hrefs'][0])) if c['hrefs'] else None
        s = spec.get(key(g['route'])) if g else None
        if c['mood'] not in mood_ids:
            errors.append('invented mood on a card: ' + c['mood'])
        elif not s or s['primary'] != c['mood']:
            errors.append('card mood differs from the committed primary: ' + c['id'])
    if [m['id'] for m in page['moods']] != ['all'] + mood_ids:
        errors.append('mood buttons differ from the committed moods: ' + json.dumps([m['id'] for m in page['moods']]))
    counts = {}
    for m in moods['moods']:
        n = sum(1 for g in catalogue if spec.get(key(g['route']), {}).get('primary') == m['id'] or spec.get(key(g['route']), {}).get('secondary') == m['id'])
        b = next((x for x in page['moods'] if x['id'] == m['id']), None)
        counts[m['id']] = n
        if not n:
            errors.append('a mood holds no games: ' + m['id'])
        if not b or b['count'] != str(n) or b['aria'] != m['label'] + ', ' + str(n) + ' games':
            errors.append('mood count is not derived: ' + m['id'])
    return {'errors': errors, 'cards': len(page['cards']), 'activities': len(page['activities']), 'moods': counts,
            'packs': len(packs), 'todayPool': len(pool), 'hrefsChecked': len(hrefs)}


def self_test(page, out, manifest, discovery, moods):
    base = limbs(page, out, manifest, discovery, moods)
    assert not base['errors'], 'self-test needs a green page first: ' + json.dumps(base['errors'])
    plants = {}

    def bites(name, mutate, needle):
        p = copy.deepcopy(page)
        m = copy.deepcopy(manifest)
        mutate(p, m)
        r = limbs(p, out, m, discovery, moods)
        plants[name] = any(needle in e for e in r['errors'])
        assert plants[name], 'planted defect not refused: ' + name + ' ' + json.dumps(r['errors'])

    staff = next(g for g in discovery['games'] if g['group'] == 'staff')
    bites('broken-href', lambda p, m: p['cards'][0]['hrefs'].__setitem__(0, '/no-such-game/'), 'do not resolve')
    bites('dropped-card', lambda p, m: p['cards'].pop(), 'coverage')
    bites('duplicate-card', lambda p, m: p['cards'].append(copy.deepcopy(p['cards'][0])), 'twice')
    bites('second-link-on-card', lambda p, m: p['cards'][0]['hrefs'].append(p['cards'][1]['hrefs'][0]), 'exactly one Play link')
    bites('dropped-activity', lambda p, m: p['activities'].pop(), 'Teacher corner exactly once')
    bites('staff-on-page', lambda p, m: p['hrefs'].append(staff['route']), 'staff item reached')
    bites('staff-in-data', lambda p, m: p['data']['games'].append({'id': staff['id']}), 'staff item is in the page data')
    bites('pack-drift', lambda p, m: p['data']['packs'][0]['games'].__setitem__(0, p['data']['packs'][1]['games'][0]), 'packs differ')
    bites('pool-drift', lambda p, m: p['data']['todayPool'].pop(), 'pool differs')
    def second_spot(p, m):
        j = next(i for i, g in enumerate(m) if g.get('spotlight') is not True)
        m[j] = {**m[j], 'spotlight': True}
        if not any(g.get('spotlight') is True for i, g in enumerate(m) if i != j):
            k = next(i for i, g in enumerate(m) if i != j)
            m[k] = {**m[k], 'spotlight': True}
    bites('second-spotlight', second_spot, 'more than one spotlight')
    bites('invented-mood', lambda p, m: p['cards'][-1].__setitem__('mood', 'top-picks'), 'invented')
    bites('mood-drift', lambda p, m: p['cards'][0].__setitem__('mood', next(x['id'] for x in p['data']['moods'] if x['id'] != p['cards'][0]['mood'])), 'committed primary')
    bites('count-drift', lambda p, m: p['moods'][1].__setitem__('count', str(int(p['moods'][1]['count']) + 1)), 'not derived')
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
    moods = json.loads(MOODS.read_text(encoding='utf-8'))
    result = limbs(page, out, manifest, discovery, moods)
    if a.self_test and not result['errors']:
        result['selfTest'] = self_test(page, out, manifest, discovery, moods)
    print(json.dumps(result, indent=2))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
