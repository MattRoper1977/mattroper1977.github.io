#!/usr/bin/env python3
"""Refuse a CR byte in the splash-stamped routes or in the canonical splash source.

Measured, not assumed. tools/play_splash_coverage.py and tools/render_maker_splash.py both
read these files with Path.read_text(encoding='utf-8') and no newline= argument, which is
Python text mode with universal newlines: CRLF on disk becomes LF before anything is
hashed. On a CRLF copy of one route the writer's digest was byte-identical to the LF copy
(fc02d25e…) while the raw on-disk region bytes hashed a43835e1…, so those two tools cannot
see the difference.

They are not the only gates, and the earlier claim that CRLF would pass everything
silently was wrong. On the same CRLF copy, tools/cyberpulse/verify.mjs went red on CP6s
(20614 bytes against the 20559 pin), CP5s and C02, and the publication build refused with
'Review stale control/content evidence'. This check exists so the record gates fail too,
loudly and by name, instead of quietly agreeing.

Reads in binary on purpose: a text-mode read is exactly what hides the CR.

    python3 tools/check_splash_routes_lf.py [--root .] [--self-test]
"""
import argparse
import json
import pathlib
import sys

LEDGER = 'data/hud-coverage.json'
COVERAGE = 'docs/play-q1/coverage.json'
CANONICAL = 'tools/render_maker_splash.py'


def routes(root):
    ledger = json.loads((root / LEDGER).read_text(encoding='utf-8'))['makerSplash']
    out = []
    for item in ledger.get('applied', []):
        route = item if isinstance(item, str) else item['route']
        rel = route.strip('/')
        out.append(root / rel / 'index.html' if route.endswith('/') else root / rel)
    return out


def agrees_with_coverage(root, derived):
    """The scope comes from the ledger's declaration, not from the record being checked.

    Deriving it from coverage.json instead would be circular: a route whose region drifts
    no longer matches generatorRegionSha256, so it would drop out of the 'current' set and
    quietly leave this check's scope -- the one moment the check is needed. The ledger's
    `applied` list says which routes are meant to carry the region and does not move when a
    file drifts. The two are cross-checked here so they cannot diverge unnoticed.
    """
    record = json.loads((root / COVERAGE).read_text(encoding='utf-8'))
    current = record['summary']['generatorRegionSha256']
    rows = {r['route'] for r in record['rows'] if r.get('regionSha256') == current}
    ledger = {'/' + str(p.parent.relative_to(root)) + '/' for p in derived}
    return rows, ledger


def offenders(paths):
    found = []
    for path in paths:
        if not path.is_file():
            found.append((path, None))
            continue
        count = path.read_bytes().count(b'\r')
        if count:
            found.append((path, count))
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path('.'))
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()

    if args.self_test:
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            scratch = pathlib.Path(directory)
            clean = scratch / 'clean.html'
            clean.write_bytes(b'<html>\n<!-- MBM-MAKER-SPLASH:BEGIN -->\n<!-- MBM-MAKER-SPLASH:END -->\n</html>\n')
            assert not offenders([clean]), 'an LF file was rejected'
            dirty = scratch / 'dirty.html'
            dirty.write_bytes(clean.read_bytes().replace(b'\n', b'\r\n'))
            got = offenders([dirty])
            assert got and got[0][1] == 4, 'a CRLF file was accepted: %r' % (got,)
            inside = scratch / 'inside.html'
            inside.write_bytes(b'<html>\n<!-- MBM-MAKER-SPLASH:BEGIN -->\r\n<!-- MBM-MAKER-SPLASH:END -->\n')
            assert offenders([inside]), 'a single CR inside the region was accepted'
            missing = offenders([scratch / 'nope.html'])
            assert missing and missing[0][1] is None, 'a missing file was accepted'
        print('self-test: LF accepted; whole-file CRLF, one CR inside the region, '
              'and a missing file all rejected')
        rows, ledger = agrees_with_coverage(args.root, routes(args.root))
        assert rows == ledger, 'ledger and coverage disagree: %r' % ((rows ^ ledger),)
        print('self-test: the ledger scope and the coverage record agree on %d route(s)' % len(rows))
        return 0

    derived = routes(args.root)
    rows, ledger = agrees_with_coverage(args.root, derived)
    if rows != ledger:
        print('the ledger and the coverage record disagree about which routes carry the region')
        print('  in the ledger only :', sorted(ledger - rows) or 'none')
        print('  in coverage only   :', sorted(rows - ledger) or 'none')
        return 1
    paths = derived + [args.root / CANONICAL]
    found = offenders(paths)
    if found:
        print('CR bytes in splash-stamped files -- %d path(s)' % len(found))
        print('the coverage and generator tools read these in text mode, so a CR is invisible')
        print('to their digests; it is not invisible to CyberPulse CP6s or the publication build.')
        for path, count in found:
            print('  %-52s %s' % (path, 'MISSING' if count is None else '%d CR byte(s)' % count))
        return 1
    print('%d splash-stamped file(s) and the canonical source contain no CR' % len(paths))
    return 0


if __name__ == '__main__':
    sys.exit(main())
