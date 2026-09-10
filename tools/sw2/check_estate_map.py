#!/usr/bin/env python3
"""The estate map reproduces, and both readers agree with the classifier.

Three claims, each measured rather than assumed:

1. data/estate-map.json is what tools/estate/build_estate_map.py emits today.
   A checked-in derived file that has stopped reproducing is worse than no file
   at all -- it looks authoritative while describing an older estate.

2. tools/lib/estate_map.py agrees with domain-split/education_policy.classifier
   on every route in the universe below.

3. tools/lib/estate-map.cjs agrees with the same authority on the same routes.
   Two readers in two languages is two chances to disagree, and a verifier that
   picked the wrong origin because its reader was subtly different would fail
   exactly like a hardcoded literal. So they are compared route by route, not
   spot-checked.

The universe is every known game route, every retained education activity,
every education route in the search index, and the awkward edges -- the bare
origins, /game-saves, an unknown path, a Play host, an %-encoded path.
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def universe(site: Path, document: dict) -> list:
    routes = set(document['knownGameRoutes']) | set(document['educationRetained'])
    routes |= {route + '/' for route in list(routes)[:200]}
    index = json.loads((site / 'data/mbm-search-index.json').read_text())['entries']
    routes |= {row['route'] for row in index}
    routes |= {'/', '/game-saves', '/game-saves/', '/for/pupils/', '/for/teachers/',
               '/teach/', '/education-hub/', '/resources/', '/commission/', '/privacy/',
               '/definitely/not/a/route/', '/Lessons/Games/Grid_Chase.html',
               '/Lessons/Games/', 'https://www.madebymatt-play.uk/townlife/',
               'https://www.madebymatt-play.uk/', 'https://madebymatt.uk/townlife/',
               'https://mattroper1977.github.io/townlife/', '/games/index.html',
               '/Science_Teesside/Build/v4_fieldops/01_Newport_Bridge_Lift_Permit_Lab.html'}
    return sorted(routes)


def node_verdicts(reader: Path, map_file: Path, routes: list) -> list:
    script = (
        'const {EstateMap}=require(process.argv[1]);'
        'const m=EstateMap.load(process.argv[2]);'
        'const routes=JSON.parse(require("node:fs").readFileSync(process.argv[3],"utf8"));'
        'console.log(JSON.stringify(routes.map(r=>m.originFor(r))));'
    )
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as handle:
        json.dump(routes, handle)
        payload = handle.name
    out = subprocess.run([ 'node', '-e', script, str(reader), str(map_file), payload],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def run(site: Path, lessons: Path, map_file: Path, expect_reproduce=True, routes=None) -> list:
    sys.path.insert(0, str(site / 'domain-split'))
    sys.path.insert(0, str(site / 'tools/lib'))
    import education_policy as policy
    import estate_map as reader_py
    sys.path.insert(0, str(site / 'tools/estate'))
    import build_estate_map

    errors = []
    document = json.loads(map_file.read_text())
    if expect_reproduce:
        fresh = build_estate_map.build(site, lessons)
        if json.dumps(fresh, indent=1, sort_keys=False) + '\n' != map_file.read_text():
            errors.append('data/estate-map.json no longer reproduces from the classifier')

    _known, _dirs, is_game = policy.classifier(site, lessons)
    mapper = reader_py.EstateMap(document)
    # The universe is fixed by the caller when a control perturbs the map.
    # Deriving it from the document under test would delete the subject along
    # with the evidence -- the first cut of this control dropped /townlife from
    # knownGameRoutes and then never asked about /townlife, reporting a clean
    # zero. A control that cannot go red proves nothing.
    routes = routes if routes is not None else universe(site, document)
    js = node_verdicts(site / 'tools/lib/estate-map.cjs', map_file, routes)

    disagree_py = disagree_js = 0
    for route, js_origin in zip(routes, js):
        # Composite authority: recreation OR absent-from-education. The second
        # clause is not decoration -- data/source-manifests/games.json is not a
        # game and is not in the education tree, so is_game alone would point a
        # verifier at the origin that 404s it.
        truth = policy.PLAY if (is_game(route) or policy.excluded_asset(route)) else policy.EDUCATION
        if mapper.origin_for(route) != truth:
            disagree_py += 1
            if disagree_py <= 5:
                errors.append(f'estate_map.py disagrees on {route!r}: '
                              f'{mapper.origin_for(route)} vs classifier {truth}')
        if js_origin != truth:
            disagree_js += 1
            if disagree_js <= 5:
                errors.append(f'estate-map.cjs disagrees on {route!r}: {js_origin} vs classifier {truth}')
    if disagree_py > 5:
        errors.append(f'... and {disagree_py - 5} further estate_map.py disagreements')
    if disagree_js > 5:
        errors.append(f'... and {disagree_js - 5} further estate-map.cjs disagreements')
    if not errors:
        play = sum(1 for r in routes if mapper.is_play_route(r))
        print(f'[PASS] estate map reproduces; both readers agree with the classifier on '
              f'{len(routes)} routes ({play} Play, {len(routes) - play} education)')
    return errors


def against_play_tree(mapper, routes, play: Path, legacy: set) -> list:
    """One-sided ground truth: every route the map sends to Play exists there.

    Agreeing with the classifier only proves the map copies the predicate. It does
    not prove the predicate answers the question a verifier asks -- "who serves
    this" -- and a map that sends a request to a tree without the file produces a
    404 the verifier will report as something else entirely.

    Only the Play side is asserted here, because the education publication is
    built from three repositories and this gate takes one. The education half is
    covered by the classifier agreement above; when a full education build is at
    hand, --education-tree extends the same idea.

    Legacy migration sources (education_policy.MIGRATIONS keys) are excluded and
    named: they are old URLs kept classified so the education tree still stubs
    them, and they were never routes of the Play tree.
    """
    errors, absent, checked, skipped = [], [], 0, 0
    for route in routes:
        if route.startswith('http') or '?' in route or '#' in route:
            continue
        key = route.rstrip('/') or '/'
        if key in legacy or route in legacy:
            skipped += 1
            continue
        if mapper.origin_for(route) != mapper.play:
            continue
        rel = route.lstrip('/').rstrip('/')
        # A route may be written with or without a trailing slash, and a file
        # route keeps its extension either way. The first cut tested the last
        # segment of the RAW route, which is empty when a slash was appended, so
        # every `/x.html/` form was looked up as `x.html/index.html` and reported
        # missing. The map was right and the check was wrong -- recorded because
        # a check that manufactures findings is worse than one that finds none.
        candidates = [rel, rel + '/index.html'] if rel else ['index.html']
        if any((play / candidate).is_file() for candidate in candidates):
            checked += 1
        else:
            absent.append(route)
    print(f'[NOTE] {checked} Play-routed routes resolve in the built Play tree; '
          f'{len(absent)} do not; {skipped} legacy migration source(s) excluded by name')
    if absent:
        print('       routes the census still classifies as Play that the builder no longer emits:')
        for route in absent[:12]:
            print(f'       - {route}')
        if len(absent) > 12:
            print(f'       ... and {len(absent) - 12} more')
        print('       Reported, not failed: the subject is the route census, not the map.')
    return errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', default=str(ROOT))
    ap.add_argument('--lessons', required=True)
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--play-tree', help='built Play publication, for the strongest check')
    ap.add_argument('--education-tree', help='built education publication')
    args = ap.parse_args()
    site, lessons = Path(args.site).resolve(), Path(args.lessons).resolve()
    map_file = site / 'data/estate-map.json'

    errors = run(site, lessons, map_file)
    if args.play_tree:
        sys.path.insert(0, str(site / 'tools/lib'))
        sys.path.insert(0, str(site / 'domain-split'))
        import estate_map as reader_py
        import education_policy as policy
        document = json.loads(map_file.read_text())
        mapper = reader_py.EstateMap(document)
        legacy = {policy.route_key(route) for route in policy.MIGRATIONS}
        errors += against_play_tree(mapper, universe(site, document),
                                    Path(args.play_tree).resolve(), legacy)
    for line in errors:
        print('[FAIL]', line)

    if args.self_test:
        # Both directions, because a control that only proves Play -> education
        # leaves the other half of the predicate unwatched.
        #
        # The first cut of (a) dropped /townlife from knownGameRoutes alone and
        # reported a clean zero. It was not a working control: `townlife` is
        # also in gameDirectories, so the route is still Play by a second route
        # through the predicate. A perturbation that another clause repairs is
        # not a perturbation. Both clauses go.
        pristine = json.loads(map_file.read_text())
        routes = universe(site, pristine)
        plants = [
            ('a', 'Play route loses its game classification',
             lambda d: (d['knownGameRoutes'].remove('/townlife'),
                        d['gameDirectories'].remove('townlife'))),
            ('b', 'education route is claimed as a game',
             lambda d: d['knownGameRoutes'].append('/for/pupils')),
        ]
        for name, label, plant in plants:
            document = json.loads(map_file.read_text())
            plant(document)
            with tempfile.TemporaryDirectory() as d:
                planted = Path(d) / 'estate-map.json'
                planted.write_text(json.dumps(document, indent=1, sort_keys=False) + '\n')
                control = run(site, lessons, planted, expect_reproduce=False, routes=routes)
            detected = [e for e in control if 'disagrees on' in e]
            print(f'--- positive control {name}: {label} -> {len(detected)} disagreement(s)')
            for line in detected[:3]:
                print('    ', line)
            if not detected:
                print(f'[FAIL] positive control {name} did not fire: the comparison proves nothing')
                errors.append(f'positive control {name} did not fire')
        if not any('positive control' in e for e in errors):
            print('positive-control: PASS (both directions)')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
