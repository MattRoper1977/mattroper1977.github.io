#!/usr/bin/env python3
"""The one-line description each featured game shows on a Top Picks rail when it has no take.

Ruling ug-4 (ug add.2): both Top Picks rails (/games/ and /for/pupils/) render from the shelf
manifest's `featured` flag. Where the owner has written a take, the card shows it; where none
exists, the card shows the game's own one-line description -- THE SAME LINE THE PLAY SHELF USES,
not a second derivation of it. That line is computed by domain-split/play/build.py (the game's own
meta description cut at its first sentence, or the category word when there is none or when the
names gate withholds it) and published in the play build's data/play-discovery.json.

This tool copies those lines, for the featured games only, into data/featured-lines.json so the
two static pages can read them. It never writes a take and never edits a line.

    python3 tools/render_featured_lines.py --discovery <play output>/data/play-discovery.json [--check]
    python3 tools/render_featured_lines.py --self-test

--check regenerates in memory and compares with the committed record; it writes nothing and exits
non-zero on any difference, so a line that moves on the shelf cannot go stale on the rails.
"""
import argparse, copy, json, sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'data' / 'source-manifests' / 'games.json'
RECORD = ROOT / 'data' / 'featured-lines.json'


def key(href):
    return unquote(str(href or '')).rstrip('/')


def derive(manifest, discovery):
    """{href: {line, lineSource}} for every featured manifest game, in manifest order."""
    rows = {key(r['route']): r for r in discovery['games']}
    out, problems = {}, []
    for g in manifest['games']:
        if g.get('featured') is not True:
            continue
        r = rows.get(key(g['href']))
        if r is None:
            problems.append('featured game is not on the play shelf: ' + g['href'])
            continue
        if not isinstance(r.get('line'), str) or not r['line'].strip():
            problems.append('the play shelf has no line for: ' + g['href'])
            continue
        out[g['href']] = {'line': r['line'], 'lineSource': r['lineSource']}
    return {'source': 'domain-split/play/build.py line (data/play-discovery.json), featured games only',
            'games': out}, problems


def dump(record):
    return json.dumps(record, ensure_ascii=False, indent=2) + '\n'


def compare(record, committed):
    if committed is None:
        return ['data/featured-lines.json is missing']
    if record == committed:
        return []
    a, b = record['games'], committed.get('games', {})
    diffs = ['not in the record: ' + h for h in a if h not in b]
    diffs += ['in the record but not featured: ' + h for h in b if h not in a]
    diffs += ['line differs from the shelf: ' + h for h in a if h in b and a[h] != b[h]]
    if list(a) != list(b) and not diffs:
        diffs.append('order differs from the manifest')
    return diffs or ['record differs (source note)']


def self_test():
    manifest = {'games': [{'href': '/a/', 'featured': True}, {'href': '/b/', 'featured': False},
                          {'href': '/Lessons/Games/C%20D.html', 'featured': True}]}
    disc = {'games': [{'route': '/a/', 'line': 'Line A.', 'lineSource': 'meta'},
                      {'route': '/b/', 'line': 'Line B.', 'lineSource': 'meta'},
                      {'route': '/Lessons/Games/C D.html', 'line': 'Puzzle', 'lineSource': 'category'}]}
    good, probs = derive(manifest, disc)
    ok = not probs and list(good['games']) == ['/a/', '/Lessons/Games/C%20D.html'] and not compare(good, good)
    print('  [%s] green control: 2 featured of 3, encoded and decoded routes join' % ('ok' if ok else 'FAIL'))
    plants = []
    m = copy.deepcopy(manifest); m['games'][1]['featured'] = True
    plants.append(('a game newly featured in the manifest', compare(derive(m, disc)[0], good)))
    d = copy.deepcopy(disc); d['games'][0]['line'] = 'Line A changed.'
    plants.append(('a shelf line that moved', compare(derive(manifest, d)[0], good)))
    m = copy.deepcopy(manifest); m['games'][0]['featured'] = False
    plants.append(('a game no longer featured', compare(derive(m, disc)[0], good)))
    d = copy.deepcopy(disc); del d['games'][0]
    plants.append(('a featured game missing from the shelf', derive(manifest, d)[1]))
    plants.append(('a missing record', compare(good, None)))
    for label, found in plants:
        print('  [%s] plant red: %s' % ('ok' if found else 'FAIL', label))
        ok = ok and bool(found)
    print('self-test ' + ('PASS' if ok else 'FAIL'))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--discovery', type=Path)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.discovery:
        ap.error('--discovery is required')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    record, problems = derive(manifest, json.loads(a.discovery.read_text(encoding='utf-8')))
    if problems:
        print('[FAIL] ' + '; '.join(problems)); return 1
    if a.check:
        committed = json.loads(RECORD.read_text(encoding='utf-8')) if RECORD.is_file() else None
        diffs = compare(record, committed)
        print(('[FAIL] featured lines are stale: ' + '; '.join(diffs)) if diffs else
              '[PASS] featured lines equal the play shelf: %d featured games' % len(record['games']))
        return 1 if diffs else 0
    RECORD.write_text(dump(record), encoding='utf-8')
    print('wrote %s: %d featured games' % (RECORD.relative_to(ROOT), len(record['games'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
