#!/usr/bin/env python3
"""Emit data/estate-map.json: which origin serves a route.

WHY THIS EXISTS. The estate publishes two trees from one source -- education on
madebymatt.uk and Play on www.madebymatt-play.uk -- and the education tree
answers every Play route with a two-kilobyte "This game has moved" stub
(build_education.moved_page, HC3 2.4 / HC4 7.4). A verifier that fetches a Play
route from the education origin therefore measures the stub, and every
assertion it makes afterwards is about the wrong page. It reports "missing
marker", which names the assertion and hides the cause; that misreading has
cost two diagnosis cycles.

WHY IT IS GENERATED. The answer already exists: education_policy.classifier is
the predicate both publications are built with. Writing a second list by hand
would let the verifiers and the build disagree, which is the whole failure mode.
So this file is derived from that predicate, and check_estate_map.py fails if
the checked-in copy no longer reproduces.

The emitted document is the classifier's decision surface, not a route dump:
`known` game routes, the retained education exceptions that outrank them, the
game directories, and the prefix rule. A reader in any language can evaluate
is_game() from it exactly, which is what tools/lib/estate-map.cjs and
tools/lib/estate_map.py do.
"""
import argparse, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]


def build(site: Path, lessons: Path) -> dict:
    sys.path.insert(0, str(site / 'domain-split'))
    import education_policy as policy
    known, directories, _is_game = policy.classifier(site, lessons)
    return {
        '_generatedBy': 'tools/estate/build_estate_map.py from domain-split/education_policy.classifier',
        '_contract': ('A route is served by Play when is_game() says so, and by education otherwise. '
                      'Retained education activities outrank the game census; the Play hosts serve '
                      'everything except the paths in playNonGamePaths.'),
        'origins': {'education': policy.EDUCATION, 'play': policy.PLAY},
        'hosts': {'education': sorted(policy.EDUCATION_HOSTS), 'play': sorted(policy.PLAY_HOSTS)},
        'playNonGamePaths': ['/', '/game-saves'],
        'gamePathPrefixes': ['/Lessons/Games/'],
        'knownGameRoutes': sorted(known),
        'gameDirectories': sorted(directories),
        'educationRetained': sorted(policy.route_key(route) for route in policy.EDUCATIONAL_ACTIVITIES),
        # A second axis, and the reason the first is not enough. `is_game` answers
        # "is this recreational", which is not the same question as "which tree
        # serves this file". education_policy.excluded_asset names paths the
        # education publication does not carry at all -- source-only records,
        # card art, marketing, the release videos. They are published to Play and
        # 404 on education, so a verifier that asked is_game() alone would send a
        # request for data/source-manifests/games.json to the origin that does not
        # have it. Measured, not assumed: that file is byte-identical in the built
        # Play tree and listed in SOURCE_ONLY.
        'educationExcluded': {
            'prefixes': ['assets/cards/', 'marketing/', 'assets/brand/medevac_frontier_patch.'],
            'exact': sorted(set(policy.SOURCE_ONLY) | {'images/apexkick-hub.jpg'}),
            'videoPrefix': 'assets/video/',
            'videoStems': sorted(policy.VIDEO_STEMS),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--site', default=str(HERE))
    ap.add_argument('--lessons', required=True)
    ap.add_argument('--out', default=str(HERE / 'data/estate-map.json'))
    args = ap.parse_args()
    document = build(Path(args.site).resolve(), Path(args.lessons).resolve())
    Path(args.out).write_text(json.dumps(document, indent=1, sort_keys=False) + '\n')
    print(f'wrote {args.out}: {len(document["knownGameRoutes"])} known game routes, '
          f'{len(document["gameDirectories"])} game directories, '
          f'{len(document["educationRetained"])} retained education activities')


if __name__ == '__main__':
    main()
