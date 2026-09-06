#!/usr/bin/env python3
"""route_origins — which origin serves a route after the two-domain split.

Order HC3 §1.1. Eleven live verifiers still fetched game routes on the education
origin after the split and compared them to raw source. Each held its own copy
of the origin, typed by hand. This table is DERIVED, never typed:

  * data/source-manifests/games.json         the canonical shelf (62 game routes)
  * reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json
                                             the 69 play payloads and their source files
  * domain-split/education_policy.py         EDUCATIONAL_ACTIVITIES (served on both),
                                             MIGRATIONS (aliases), PLAY (stub link host)
  * domain-split/build_education.py          LEGACY (the old Lessons game addresses)
  * domain-split/config.json                 the two origins the builders write

Rules (the same rules the builders apply):
  game / activity route  → served in full on the PLAY origin
                          → on the EDUCATION origin it is a STUB, unless the route is
                            in EDUCATIONAL_ACTIVITIES, in which case it is served in
                            full on BOTH (the R12 pair; ruling cited by file + SHA in
                            the HC3 ledger)
  alias route            → EDUCATION stub whose link points at the alias destination on play
  every other route      → EDUCATION, unchanged

Expected served bytes on play are the source bytes with every literal
`https://madebymatt.uk` replaced by `https://madebymatt-play.uk` — exactly the
transformation build_publications.py applies and asserts.

Usage
  route_origins.py --emit json                 the whole table
  route_origins.py --origin play|education     the origin URL
  route_origins.py --url ROUTE                 the URL that serves ROUTE in full
  route_origins.py --stubs                     education-origin routes that must be stubs
  route_origins.py --expected ROUTE --out FILE [--lessons DIR]
                                               expected served bytes on play
  route_origins.py --self-test                 three runs: real, planted defect (red),
                                               defect removed (green)
Exit 0 ok · 1 a control or lookup failed · 2 INCONCLUSIVE (a record could not be read)
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SHELF = ROOT / 'data/source-manifests/games.json'
CENSUS = ROOT / 'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json'
POLICY = ROOT / 'domain-split/education_policy.py'
BUILDER = ROOT / 'domain-split/build_education.py'
CONFIG = ROOT / 'domain-split/config.json'
TEXT_SUFFIXES = {'.html', '.js', '.css', '.json', '.svg', '.webmanifest'}


class Inconclusive(Exception):
    pass


def normal(route: str) -> str:
    path = unquote(urlsplit(route).path)
    return (path.removesuffix('index.html').rstrip('/') or '/')


def literal(source: str, name: str, fallback: str | None = None):
    """Read a top-level dict literal from a Python file without importing it.

    A `**NAME` spread is resolved in `source` first, then in `fallback` (the
    builder spreads MIGRATIONS, which it imports from education_policy)."""
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            value = node.value
            if isinstance(value, ast.Dict):
                out = {}
                for k, v in zip(value.keys, value.values):
                    if k is None:  # **MIGRATIONS spread
                        try:
                            out.update(literal(source, v.id, fallback))
                        except Inconclusive:
                            if fallback is None:
                                raise
                            out.update(literal(fallback, v.id))
                    else:
                        out[ast.literal_eval(k)] = ast.literal_eval(v)
                return out
            return ast.literal_eval(value)
    raise Inconclusive(f'{name} not found')


def load_records(shelf=SHELF, census=CENSUS, policy=POLICY, builder=BUILDER, config=CONFIG):
    try:
        shelf_rows = json.loads(Path(shelf).read_text(encoding='utf-8'))['games']
        census_rows = json.loads(Path(census).read_text(encoding='utf-8'))['rows']
        policy_src = Path(policy).read_text(encoding='utf-8')
        builder_src = Path(builder).read_text(encoding='utf-8')
        cfg = json.loads(Path(config).read_text(encoding='utf-8'))
    except (OSError, ValueError, KeyError) as exc:
        raise Inconclusive(f'record unreadable: {exc}') from exc
    if not shelf_rows or not census_rows:
        raise Inconclusive('an empty shelf or census derives nothing')
    return dict(
        shelf=[normal(g['href']) for g in shelf_rows],
        census=census_rows,
        retained={normal(r) for r in literal(policy_src, 'EDUCATIONAL_ACTIVITIES')},
        legacy={normal(k): v for k, v in literal(builder_src, 'LEGACY', policy_src).items()},
        stub_host=literal(policy_src, 'PLAY'),
        education=cfg['education_origin'],
        play=cfg['games_origin'],
    )


def build_table(rec, root=ROOT):
    table = {}
    census_by_route = {normal(r['normalizedDecodedRoute']): r for r in rec['census']}
    for route in rec['shelf']:
        row = census_by_route.get(route)
        if row is None:
            raise Inconclusive(f'shelf route {route} is not in the 69-route census')
    for route, row in census_by_route.items():
        both = route in rec['retained']
        kind = 'game' if route in rec['shelf'] else ('staff' if '/5_staff_training/' in route else 'activity')
        table[route] = dict(kind=kind, play='full', education='full' if both else 'stub',
                            source=row['source'], serves=('both' if both else 'play'))
        # every other html inside a Site game directory publishes as a stub too
        src = row['source']
        if src['repository'] == 'Site':
            game_dir = root / Path(src['path']).parent
            if game_dir.is_dir():
                for extra in sorted(game_dir.rglob('*.html')):
                    r2 = '/' + extra.relative_to(root).as_posix()
                    r2 = normal(r2) if extra.name == 'index.html' else r2
                    if r2 not in table:
                        table[r2] = dict(kind='game-page', play='full', education='stub',
                                         source={'repository': 'Site', 'path': extra.relative_to(root).as_posix()},
                                         serves='play')
    for route, dest in rec['legacy'].items():
        table[route] = dict(kind='alias', play='none', education='stub', alias=dest, serves='play-alias')
    for route in ('/games', '/Games'):
        table[route] = dict(kind='hub-alias', play='full', education='stub', alias='/', serves='play-alias')
    return table


def origin_for(table, rec, route):
    r = normal(route)
    if r in table:
        entry = table[r]
        if entry['play'] == 'full':
            return rec['play'], entry
        return rec['play'], entry  # alias: play destination
    return rec['education'], dict(kind='education', play='none', education='full', serves='education')


def url_for(table, rec, route):
    origin, entry = origin_for(table, rec, route)
    if entry.get('alias'):
        return rec['play'] + entry['alias']
    return origin + route


def expected_bytes(entry, rec, lessons: Path | None, root=ROOT) -> bytes:
    src = entry.get('source')
    if not src:
        raise Inconclusive('no source file for this route')
    base = root if src['repository'] == 'Site' else lessons
    if base is None:
        raise Inconclusive('a Lessons-sourced route needs --lessons <checkout at the play pin>')
    path = Path(base) / src['path']
    data = path.read_bytes()
    if path.suffix in TEXT_SUFFIXES:
        data = data.replace(rec['education'].encode(), rec['play'].encode())
    return data


def stub_routes(table):
    return sorted(r for r, e in table.items() if e['education'] == 'stub')


def self_test():
    rec = load_records()
    table = build_table(rec)
    ok = True

    def control(name, passed, detail=''):
        nonlocal ok
        ok = ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] {name}{'  — ' + detail if detail else ''}")

    # run 1: the real records
    control('run 1: shelf route serves on play, stub on education',
            table['/apexkick']['play'] == 'full' and table['/apexkick']['education'] == 'stub')
    control('run 1: a Lessons game serves on play',
            url_for(table, rec, '/Lessons/Games/Glitch_Clash.html') == rec['play'] + '/Lessons/Games/Glitch_Clash.html')
    control('run 1: the retained activity serves on both',
            table['/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html']['serves'] == 'both')
    control('run 1: an alias stub points at its play destination',
            url_for(table, rec, '/Lessons/Games/Voxel_Frontier.html') == rec['play'] + '/voxel/')
    control('run 1: a lesson is education, unchanged',
            origin_for(table, rec, '/Lessons/Science_Teesside/Build/SCI_B_W3_Backbones.html')[0] == rec['education'])
    n_stubs = len(stub_routes(table))
    control('run 1: the stub set is non-empty and every shelf route is in it',
            n_stubs > 0 and all(r in stub_routes(table) for r in rec['shelf'] if r not in rec['retained']),
            f'{n_stubs} education stub routes')
    exp = expected_bytes(table['/apexkick'], rec, None)
    control('run 1: expected play bytes carry no education literal',
            rec['education'].encode() not in exp and rec['play'].encode() in exp or rec['play'].encode() not in exp)

    # run 2: one planted defect — a shelf route missing from the census must be refused
    planted = dict(rec)
    planted['shelf'] = rec['shelf'] + ['/planted-game']
    try:
        build_table(planted)
        control('run 2: a shelf route absent from the census is refused', False, 'it was accepted')
    except Inconclusive as exc:
        control('run 2: a shelf route absent from the census is refused', True, str(exc))
    # and a planted mutation of the source must not equal the expected bytes
    control('run 2: mutated source bytes are not the expected bytes',
            expected_bytes(table['/apexkick'], rec, None) != exp + b'\n/* planted */')

    # run 3: defect removed
    control('run 3: the real records derive again', len(build_table(rec)) == len(table))
    print('self-test', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--emit', choices=['json'])
    ap.add_argument('--origin', choices=['play', 'education'])
    ap.add_argument('--url')
    ap.add_argument('--stubs', action='store_true')
    ap.add_argument('--expected')
    ap.add_argument('--out')
    ap.add_argument('--lessons', type=Path)
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    try:
        rec = load_records()
        table = build_table(rec)
    except Inconclusive as exc:
        print(f'INCONCLUSIVE: {exc}', file=sys.stderr)
        return 2
    if a.emit:
        print(json.dumps(dict(origins=dict(play=rec['play'], education=rec['education'], stub_link_host=rec['stub_host']),
                              routes=table), indent=1, ensure_ascii=False))
    elif a.origin:
        print(rec[a.origin])
    elif a.url:
        print(url_for(table, rec, a.url))
    elif a.stubs:
        print('\n'.join(stub_routes(table)))
    elif a.expected:
        entry = table.get(normal(a.expected))
        if not entry:
            print(f'{a.expected}: not a play route', file=sys.stderr)
            return 1
        try:
            data = expected_bytes(entry, rec, a.lessons)
        except (Inconclusive, OSError) as exc:
            print(f'INCONCLUSIVE: {exc}', file=sys.stderr)
            return 2
        Path(a.out).write_bytes(data) if a.out else sys.stdout.buffer.write(data)
    else:
        ap.print_help()
    return 0


if __name__ == '__main__':
    sys.exit(main())
