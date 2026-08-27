#!/usr/bin/env python3
"""Census: values TYPED into a gate that a record could have supplied.

Failure mode 1 - a check holding its own copy of the value it checks - has now
been found six times on this estate in three weeks:

  1  verify_games_audience_faces.py froze the public audience labels
  2  verify_surfaces.js froze the New Release occupants
  3  the pupil-genres count that read `=== 60`
  4  the "eight of the 52 / 60 cards" comment in games/index.html
  5  the production job's typed route list (S4 §U2)
  6  the driving-games check's typed mf-feature ids (S5 §V3)

Six is a class, and nothing was looking for the seventh. This does.

WHAT IT LOOKS FOR, and deliberately nothing else. An inflated census gets
skimmed exactly like an unscoped sweep does (#46), so it flags only values that
a NAMED record currently supplies:

  count     an integer equal to a record's current cardinality - 54 games,
            717 index entries, 641 resources, 7 audiences. These are the
            landmines: correct today, silently wrong the day the record moves.
  list      THREE OR MORE members of a record's set in one file - audience
            routes, game titles, game hrefs. One route navigated to is not a
            copy of the audience list; a table of all seven is.
  pin       a 40/64-hex content hash. A delivery pin is a literal BY DESIGN -
            deriving it from the file it checks would make the check assert
            that the file equals itself. So a pin is never a finding for being
            a literal; it is a finding for being UNEXPLAINED. Every pin must
            carry a line saying what it pins and when it was taken, or the
            next reader cannot tell a deliberate pin from a stale one.

The first draft flagged every single route mention and every hash, 54 "live"
sites, most of them correct code. An inflated census gets skimmed exactly like
an unscoped sweep does (#46), so both classes were narrowed by reading the
sites rather than trusting the count.

LIVE vs INERT vs BOUND, and the third one is the point. A literal inside a
comment, a fixture, or a file nothing runs is named and left alone - the pr124
precedent. But the sharper distinction is BOUND: a typed copy that some gate
already asserts equal to its record CANNOT DRIFT SILENTLY, and silent drift is
the entire failure mode. assets/mbm-audience.js holds all seven routes as a
literal and says why - "a static asset cannot read the JSON at build time" - and
verify_games_audience_faces.py asserts equality with the data file. That is not
a finding. An UNBOUND copy is.

So the gate fires on live + unbound only, and the other two print, so the
exclusion is visible rather than silent.

Usage:  python3 tools/census_typed_literals.py [--gate] [root]
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# --- the records, and what each one's cardinality means --------------------
RECORDS = [
    ('data/source-manifests/games.json',            'games',     'games on the shelf'),
    ('data/audience-homepages.json',                'audiences', 'audience homepages'),
    ('data/mbm-search-index.json',                  'entries',   'search-index entries'),
    ('data/source-manifests/lessons-resources.json', None,       'lesson resources'),
    ('data/education-hub.json',                     'resources', 'education-hub resources'),
    ('data/new-release-occupants.json',             'occupants', 'New Release occupants'),
]

def cardinalities(root):
    out = {}
    for rel, key, what in RECORDS:
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            continue
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception:
            continue
        v = d.get(key) if key and isinstance(d, dict) else d
        if isinstance(v, (list, dict)):
            out.setdefault(len(v), []).append((rel, what))
    return out

def vocabulary(root):
    routes, titles, hrefs = set(), set(), set()
    p = os.path.join(root, 'data/audience-homepages.json')
    if os.path.exists(p):
        d = json.load(open(p, encoding='utf-8'))
        routes = {a['route'] for a in d.get('audiences', {}).values() if a.get('route')}
    p = os.path.join(root, 'data/source-manifests/games.json')
    if os.path.exists(p):
        d = json.load(open(p, encoding='utf-8'))
        titles = {g['title'] for g in d.get('games', []) if g.get('title')}
        hrefs = {g['href'] for g in d.get('games', []) if g.get('href')}
    return routes, titles, hrefs

SCAN_EXT = ('.yml', '.yaml', '.mjs', '.js', '.py', '.sh')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '_shelf', 'vendor'}
# 'vendor' holds third-party code this estate does not author. The census asks
# "is this a live value typed where a record could supply it", and nobody is
# going to derive a number inside a minified upstream bundle from games.json.
# It was added the day the shelf reached 55 entries and the digits 55 turned up
# inside Math.floor(255*Math.random()) in uas/vendor/pdfjs/pdf.worker.min.js —
# a 1 MB single-line file, matched twice. A finding that appears because an
# unrelated count changed to a number that happens to occur in vendored bytes
# is noise, and noise in a gate is how a real finding gets waved through.
# A file whose JOB is to hold the value is not holding a copy of it.
OWNS_ITS_VALUES = re.compile(r'(^|/)(data|schema)/|takes-pin|visual-provenance|tag-backfill'
                             r'|census_typed_literals\.py')

def is_comment(line, ext):
    t = line.strip()
    if ext in ('.py', '.sh', '.yml', '.yaml'):
        return t.startswith('#')
    return t.startswith('//') or t.startswith('*') or t.startswith('/*')

def live_or_inert(rel, line, ext):
    if 'fixtures/' in rel or 'NOT LIVE' in line:
        return 'inert', 'fixture / parked snapshot'
    if is_comment(line, ext):
        return 'inert', 'comment'
    return 'live', 'feeds an assertion or renders'

RECORD_PATHS = {
    'audience routes': 'audience-homepages.json',
    'game titles': 'games.json',
    'game hrefs': 'games.json',
}

def binders(root):
    """Every gate that reads BOTH a file and a record. Such a file's copy is
    asserted equal to the record and cannot drift without going red."""
    index = {}
    for dirpath, dirnames, filenames in os.walk(os.path.join(root, 'tools')):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if not fn.endswith(('.py', '.mjs', '.js')):
                continue
            full = os.path.join(dirpath, fn)
            try:
                body = open(full, encoding='utf-8', errors='replace').read()
            except Exception:
                continue
            index[os.path.relpath(full, root)] = body
    return index

def bound_by(index, rel, record_hint):
    base = os.path.basename(rel)
    for gate, body in index.items():
        if gate == rel:
            continue
        if (base in body or rel in body) and record_hint in body:
            return gate
    return None

def scan(root):
    cards = cardinalities(root)
    routes, titles, hrefs = vocabulary(root)
    index = binders(root)
    hits = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1]
            if ext not in SCAN_EXT:
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, root)
            if OWNS_ITS_VALUES.search(rel):
                continue
            try:
                lines = open(full, encoding='utf-8', errors='replace').read().split('\n')
            except Exception:
                continue
            for n, line in enumerate(lines, 1):
                kind = live_or_inert(rel, line, ext)
                # -- counts: an integer equal to a record's cardinality --
                for m in re.finditer(r'(?<![\w.])(\d{2,4})(?![\w.])', line):
                    v = int(m.group(1))
                    if v not in cards:
                        continue
                    # only where the integer is COMPARED or ASSIGNED, not a
                    # viewport, a timeout, an HTTP code or a pixel size
                    ctx = line[max(0, m.start() - 24):m.start()]
                    if not re.search(r'(===|==|>=|<=|!=|-eq|-ge|-le|\bexpect\w*\b|\blength\b|\bcount\b|\btotal\b)\s*$', ctx):
                        continue
                    hits.append(dict(rel=rel, line=n, cls='count', value=str(v),
                                     record=', '.join(f'{w} ({r})' for r, w in cards[v]),
                                     bucket=kind[0], why=kind[1], text=line.strip()[:130]))
                # -- an UNEXPLAINED pin. The literal is fine; the silence is not.
                for m in re.finditer(r'(?<![0-9a-f])([0-9a-f]{40}|[0-9a-f]{64})(?![0-9a-f])', line):
                    # WIDENED after reading the sites. The first test demanded a
                    # pinning word AND a year or a because-clause on the same
                    # line, and called three thoroughly-explained pins
                    # unexplained - including a four-line comment naming the
                    # date, the reason and the previous hash. A gate with that
                    # much false positive gets skimmed, which is the fault it
                    # was written to prevent. The question is only whether a
                    # reader can see why the literal is there.
                    # 12 lines back, not 8: in a workflow the naming line sits
                    # at STEP level and the literal can be a heredoc and several
                    # statements below it. Measured against the apexpool PR-25
                    # pin, whose step comment is ten lines above the assert.
                    near = '\n'.join(lines[max(0, n - 12):n + 3])
                    explained = re.search(
                        r'\b(pinned|pin\b|delivered|expected|frozen|canonical|immutable|'
                        r'historical|previous|as at|taken on|ledger|contract)\b', near, re.I)
                    if explained:
                        continue
                    hits.append(dict(rel=rel, line=n, cls='pin', value=m.group(1)[:12] + '…',
                                     record='an UNEXPLAINED pin: no line says what it pins or when',
                                     bucket=kind[0], why=kind[1], text=line.strip()[:130]))
            # -- a LIST: three or more members of a record's set in one file --
            body = '\n'.join(lines)
            for name, vocab, where in (('audience routes', routes, 'data/audience-homepages.json'),
                                       ('game titles', titles, 'data/source-manifests/games.json'),
                                       ('game hrefs', hrefs, 'data/source-manifests/games.json')):
                found = sorted({v for v in vocab if f"'{v}'" in body or f'"{v}"' in body
                                or f'[{v}]' in body or f'={v}"' in body})
                if len(found) < 3:
                    continue
                ln = next((i for i, l in enumerate(lines, 1) if any(f in l for f in found)), 1)
                kind = live_or_inert(rel, lines[ln - 1], ext)
                gate = bound_by(index, rel, RECORD_PATHS[name])
                if gate:
                    kind = ('bound', f'asserted equal to the record by {gate}')
                else:
                    # A LIST can also be legitimate: a fixed historical set the
                    # record does not hold - "the four established sports" is
                    # not the shelf's current membership and deriving it from
                    # games.json would be WRONG, not better. The test is the
                    # same one applied to pins: can a reader see why?
                    near = '\n'.join(lines[max(0, ln - 6):ln + 2])
                    if re.search(r'\b(established|historical|additive|old instrument|previous|'
                                 r'frozen|contract|as at|the (four|three|two|eight)\b)', near, re.I):
                        kind = ('bound', 'a fixed historical set, named as one in the lines above it')
                hits.append(dict(rel=rel, line=ln, cls='list', value=f'{len(found)} {name}',
                                 record=f'{name} ({where}): ' + ', '.join(found[:4])
                                        + ('…' if len(found) > 4 else ''),
                                 bucket=kind[0], why=kind[1], text=lines[ln - 1].strip()[:130]))
    return hits, cards

def main():
    gate = '--gate' in sys.argv
    roots = [a for a in sys.argv[1:] if not a.startswith('--')] or [os.path.dirname(HERE)]
    root = roots[0]
    hits, cards = scan(root)
    order = {'live': 0, 'bound': 1, 'inert': 2}
    hits.sort(key=lambda h: (order[h['bucket']], h['cls'], h['rel'], h['line']))
    live = [h for h in hits if h['bucket'] == 'live']
    bound = [h for h in hits if h['bucket'] == 'bound']
    inert = [h for h in hits if h['bucket'] == 'inert']
    print('CENSUS: values typed where a record could supply them')
    print(f'  root: {root}')
    print('  record cardinalities in play: ' +
          ', '.join(f'{v}={c[0][1]}' for v, c in sorted(cards.items())))
    print(f'  sites: {len(hits)}   live {len(live)}   bound {len(bound)}   inert {len(inert)}')
    for label, group in (('LIVE AND UNBOUND — these can drift silently', live),
                         ('BOUND — a gate asserts equality, or the literal names itself a fixed set', bound),
                         ('INERT — named and left alone', inert)):
        print(f'\n=== {label} ===')
        if not group:
            print('  (none)')
        for h in group:
            print(f'  [{h["cls"]}] {h["rel"]}:{h["line"]}  {h["value"]}  <- {h["record"]}')
            print(f'        {h["why"]}')
    if gate:
        if live:
            print(f'\n{len(live)} live literal(s) a record could supply. Derive them, or name why not.')
            raise SystemExit(1)
        print('\nno live value is typed where a record could supply it')
    return 0

if __name__ == '__main__':
    sys.exit(main())
