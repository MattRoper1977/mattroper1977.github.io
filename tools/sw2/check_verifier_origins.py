#!/usr/bin/env python3
"""Census: verifiers that aim a request at a hardcoded estate origin.

The estate is split across two domains -- education on madebymatt.uk, Play on
www.madebymatt-play.uk -- and the education tree serves a two-kilobyte
"This game has moved" stub for every Play route
(`domain-split/build_education.py::moved_page`, HC3 2.4 / HC4 7.4). A verifier
that fetches a Play route from the education origin therefore measures the stub
and can never pass, whatever it goes on to assert. The failure it reports names
the assertion, not the origin, which is why this class has been misread twice.

The route -> domain question is NOT answered by a list kept here. It is answered
by `domain-split/education_policy.classifier`, the same predicate the two
publications are built with, so this census cannot drift from the split it
polices.

Two shapes are caught, because the defect has two shapes:

  DIRECT   a request target literal carries an education host AND a Play path
           -- e.g. `const SHELF = 'https://madebymatt.uk/games/'`
  JOINED   a file targets a bare education origin AND separately names Play
           routes it requests -- e.g. `ORIGIN='https://madebymatt.uk'` with
           `fetchRoute('/townlife/')`. The literal alone looks innocent; the
           join is where the domain is chosen.

JOINED is the one a literal-only scan misses, and it is the shape that took
townlife-verify down.

Roles are separated because they are not equally wrong:
  TARGET      the literal is, or feeds, a request target        -- can fail
  EXPECTATION the literal is compared against or searched for   -- reported
  PROSE       the literal sits in a comment or docstring        -- counted
Only TARGET can fail this census.
"""
import argparse, json, os, re, sys
from pathlib import Path

EDUCATION_HOSTS = {'madebymatt.uk', 'www.madebymatt.uk'}
PLAY_HOSTS = {'madebymatt-play.uk', 'www.madebymatt-play.uk'}
PRE_SPLIT_HOSTS = {'mattroper1977.github.io'}
ESTATE_HOSTS = EDUCATION_HOSTS | PLAY_HOSTS | PRE_SPLIT_HOSTS

# Deliberately served from Play but not a game page, so `is_game` says False
# about them and must not be read as "this belongs on education".
PLAY_NON_GAME = {'/', '/game-saves', '/game-saves/', '/games.json', '/sitemap.xml',
                 '/robots.txt', '/privacy', '/privacy/'}

FETCHERS = re.compile(
    r'\bfetch\s*\(|\.goto\s*\(|\bcurl\b|\brequests\.(?:get|head|post)\b|\burlopen\b'
    r'|\bhttp\.client\b|\baxios\b|\bwget\b|\bpage\.request\b|new\s+URL\s*\(')
URL = re.compile(r'https?://([A-Za-z0-9.-]+)((?:/[^\s\'"`)\\<>]*)?)')
ROUTE_LITERAL = re.compile(r'''['"`](/[A-Za-z0-9._~%\-/]*)['"`]''')

TARGET_NAME = re.compile(
    r'\b(?:const|let|var|[A-Z_]{2,})\s*[A-Za-z_]*'
    r'(?:ORIGIN|BASE|SHELF|URL|HOST|ENDPOINT|SITE|TARGET)\b[A-Za-z_]*\s*=', re.I)
TARGET_CALL = re.compile(
    r'(?:\bfetch\b|\.goto\b|\burljoin\b|new\s+URL\b|\bcurl\b|\bwget\b'
    r'|\brequests\.\w+|\burlopen\b)\s*\(?', re.I)

SKIP_DIRS = {'.git', 'node_modules', '_staging', 'artifacts', 'audit-output',
             'venv', '__pycache__', '_reference'}
TEXT_SUFFIX = {'.py', '.js', '.mjs', '.cjs', '.sh', '.yml', '.yaml', '.bash'}


def load_is_game(site: Path, _lessons=None):
    # One predicate for the estate: the same data/estate-map.json the verifiers
    # themselves read. A census that answered from a second source could pass
    # while every verifier it polices was wrong.
    sys.path.insert(0, str(site / 'tools/lib'))
    import estate_map
    mapper = estate_map.EstateMap.load(site / 'data/estate-map.json')
    return lambda url: mapper.origin_for(url) == mapper.play


def comment_spans(text: str, suffix: str):
    spans = []
    if suffix == '.py':
        for m in re.finditer(r'"""(?:.|\n)*?"""|\'\'\'(?:.|\n)*?\'\'\'', text):
            spans.append(m.span())
    start = 0
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith(('#', '//', '*')):
            spans.append((start + len(line) - len(stripped), start + len(line)))
        start += len(line)
    return spans


def classify_role(line: str, inside_comment: bool) -> str:
    if inside_comment:
        return 'PROSE'
    if TARGET_NAME.search(line) or TARGET_CALL.search(line):
        return 'TARGET'
    return 'EXPECTATION'


SELF = Path(__file__).resolve()


def walk(repo: Path):
    for base, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(base) / name
            # This file's own red-proof fixtures are literal wrong origins by
            # design; scanning them reports the controls as defects. Skipping the
            # scanner itself is the narrowest exclusion that fixes that, and it is
            # by resolved path rather than by name so a copy elsewhere is still
            # scanned. Everything else, including every other gate, is in scope.
            if path.resolve() == SELF:
                continue
            if path.suffix.lower() in TEXT_SUFFIX:
                yield path


# SW2-F W2, added on the 2026-09-09 ruling: red-prove the gate against a planted
# VACUOUS case, not only against a wrong origin.
#
# The first cut of this gate did not catch one, and that was measured rather than
# assumed. A planted `for route in / /games/ ...; do curl -fsS "https://madebymatt.uk$route"`
# scored the origin TARGET/ok and produced no finding at all: the Play route was
# an unquoted shell word and the join was an interpolation, neither of which the
# literal-and-join scan could see.
#
# It matters more than a wrong origin that goes red. The education origin answers
# a Play route with the moved_page stub at HTTP 200, so `curl -fsS` SUCCEEDS on
# it. The check then passes for ever while proving nothing about the tree a
# reader believes it tests. A red gets attributed; a pass that cannot fail gets
# believed.
# An education host glued directly to a variable -- "https://madebymatt.uk$route",
# "${edu}${route}". The glue is what makes it a join rather than a bare base, so it
# is required: a base that is never interpolated is a different shape.
INTERP_JOIN = re.compile(r'https?://(madebymatt\.uk|www\.madebymatt\.uk)(?:/)?(\$\{?(\w+)\}?)')
ROUTE_IN_LIST = re.compile(r"""['"](/[^'"]*)['"]""")


def route_domain(text, var, _depth=0):
    """Literal route candidates bound to `var` in this file.

    Resolved only for variables an INTERP_JOIN actually interpolates, and each
    pattern is anchored on the escaped variable name. The first cut scanned the
    whole file for every `NAME = [...]` with a bounded negated class, which
    backtracks catastrophically -- it did not finish a single large file in two
    minutes. Anchoring on the name lets the engine literal-search, and the work
    becomes proportional to the number of joins rather than to file size.
    """
    if _depth > 1:
        return []
    v = re.escape(var)
    out = []
    # shell:  for VAR in / /games/ /Lessons/; do
    for m in re.finditer(r'^[ \t]*for[ \t]+' + v + r'[ \t]+in[ \t]+([^;\n]{0,300})', text, re.M):
        for w in m.group(1).split():
            w = w.strip().strip(chr(34)).strip(chr(39))
            if w.startswith('/'):
                out.append(w)
    # array literal:  const VAR = ['/a/', '/b/']
    for m in re.finditer(v + r'\s*=\s*[\[(]([^\]\)]{0,400})', text):
        out.extend(ROUTE_IN_LIST.findall(m.group(1)))
    # one hop:  for (const VAR of ROUTES)   -- VAR inherits ROUTES' domain
    for m in re.finditer(r'for\s*\(\s*(?:const|let|var)\s+' + v + r'\s+of\s+(\w+)\s*\)', text):
        out.extend(route_domain(text, m.group(1), _depth + 1))
    return out


def scan_file(repo_name, repo, path, text, is_game):
    spans = comment_spans(text, path.suffix.lower())
    lines = text.splitlines()
    starts, offset = [], 0
    for line in lines:
        starts.append(offset)
        offset += len(line) + 1

    def line_of(pos):
        lo, hi = 0, len(starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if starts[mid] <= pos:
                lo = mid
            else:
                hi = mid - 1
        return lo

    literals, edu_bases = [], []
    for m in URL.finditer(text):
        host, route = m.group(1), m.group(2) or '/'
        if host not in ESTATE_HOSTS:
            continue
        i = line_of(m.start())
        role = classify_role(lines[i], any(a <= m.start() < b for a, b in spans))
        try:
            play_route = bool(is_game(f'https://{host}{route}'))
        except Exception:
            play_route = None
        verdict = 'ok'
        if role == 'TARGET':
            if host in EDUCATION_HOSTS and play_route:
                verdict = 'DIRECT_EDU_ON_PLAY'
            elif host in PLAY_HOSTS and play_route is False and route.rstrip('/') + '/' not in PLAY_NON_GAME and route not in PLAY_NON_GAME:
                verdict = 'REVIEW_PLAY_ON_NON_GAME'
            elif host in PRE_SPLIT_HOSTS:
                verdict = 'PRE_SPLIT_ORIGIN'
            if host in EDUCATION_HOSTS and route in ('/', ''):
                edu_bases.append((i + 1, lines[i].strip()[:150]))
        literals.append({'repo': repo_name, 'file': str(path.relative_to(repo)),
                         'line': i + 1, 'host': host, 'route': route, 'role': role,
                         'is_play_route': play_route, 'verdict': verdict,
                         'source': lines[i].strip()[:150]})

    # Vacuous: an education origin interpolated with a variable whose own literal
    # domain contains a Play route. Keyed per (line, route) so the message names
    # the route that makes it vacuous, not just the variable.
    vacuous = []
    for m in INTERP_JOIN.finditer(text):
        i = line_of(m.start())
        if any(a <= m.start() < b for a, b in spans):
            continue
        var = m.group(3)
        for route in dict.fromkeys(route_domain(text, var)):
            try:
                if not is_game('https://madebymatt.uk' + route):
                    continue
            except Exception:
                continue
            vacuous.append({'repo': repo_name, 'file': str(path.relative_to(repo)),
                            'line': i + 1, 'host': m.group(1), 'route': route,
                            'role': 'TARGET', 'is_play_route': True,
                            'verdict': 'VACUOUS_EDU_LOOP',
                            'detail': var + ' iterates ' + route + ', which education answers with the moved stub at 200',
                            'source': lines[i].strip()[:150]})

    joined = []
    if edu_bases:
        seen = set()
        for m in ROUTE_LITERAL.finditer(text):
            route = m.group(1)
            if route in seen:
                continue
            i = line_of(m.start())
            if any(a <= m.start() < b for a, b in spans):
                continue
            try:
                if not is_game('https://madebymatt.uk' + route):
                    continue
            except Exception:
                continue
            seen.add(route)
            joined.append({'repo': repo_name, 'file': str(path.relative_to(repo)),
                           'line': i + 1, 'host': 'madebymatt.uk', 'route': route,
                           'role': 'TARGET', 'is_play_route': True,
                           'verdict': 'JOINED_EDU_BASE_PLAY_ROUTE',
                           'base_at': edu_bases[0][0], 'base_source': edu_bases[0][1],
                           'source': lines[i].strip()[:150]})
    return literals + joined + vacuous


def census(repos, is_game):
    findings = []
    roles = {'TARGET': 0, 'EXPECTATION': 0, 'PROSE': 0}
    scanned = fetching = 0
    for repo_name, repo in repos.items():
        for path in walk(repo):
            try:
                text = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            scanned += 1
            if not FETCHERS.search(text):
                continue
            fetching += 1
            for row in scan_file(repo_name, repo, path, text, is_game):
                if row['verdict'] != 'JOINED_EDU_BASE_PLAY_ROUTE':
                    roles[row['role']] += 1
                findings.append(row)
    return findings, roles, scanned, fetching


FAILING = ('DIRECT_EDU_ON_PLAY', 'JOINED_EDU_BASE_PLAY_ROUTE', 'VACUOUS_EDU_LOOP')


def self_test(is_game):
    ok = True
    for url, want in [('https://madebymatt.uk/townlife/', True),
                      ('https://madebymatt.uk/games/', True),
                      ('https://madebymatt.uk/for/pupils/', False),
                      ('https://madebymatt.uk/', False),
                      ('https://www.madebymatt-play.uk/townlife/', True)]:
        got = bool(is_game(url))
        print(f'  ORACLE  {url:44} play_route={got}  expected={want}')
        ok &= got == want
    cases = [
        ("const SHELF = 'https://madebymatt.uk/games/';\nfetch(SHELF)\n",
         'DIRECT_EDU_ON_PLAY', 'direct: education host, Play path'),
        ("const ORIGIN = 'https://madebymatt.uk';\nawait fetch(new URL('/townlife/', ORIGIN))\n",
         'JOINED_EDU_BASE_PLAY_ROUTE', 'joined: bare education base + Play route'),
        ("const ORIGIN = 'https://www.madebymatt-play.uk';\nawait fetch(new URL('/townlife/', ORIGIN))\n",
         None, 'control: Play base + Play route is correct'),
        ("const ORIGIN = 'https://madebymatt.uk';\nawait fetch(new URL('/for/pupils/', ORIGIN))\n",
         None, 'control: education base + education route is correct'),
        ("assert(text.includes('https://madebymatt.uk/townlife/'))\n",
         None, 'control: an expectation is not a target'),
        ("// https://madebymatt.uk/townlife/ moved to Play\nfetch(x)\n",
         None, 'control: prose is not a target'),

        # --- the vacuous class (2026-09-09 ruling) --------------------------
        # These exist because the first cut of this gate did NOT catch a planted
        # vacuous case: it scored the origin TARGET/ok and returned no finding.
        # An education origin answers a Play route with the moved stub at 200, so
        # `curl -fsS` succeeds and the check passes for ever. The RED cases below
        # are the shapes that must fail; the GREEN ones are what must not, and
        # they are the half that matters -- a gate that reddens correct usage
        # would be worse than no gate.
        ('for route in / /games/ /Lessons/ /tools/; do\n  curl -fsS --retry 3 "https://madebymatt.uk$route" >/dev/null\ndone\n',
         'VACUOUS_EDU_LOOP', 'vacuous: education origin interpolated over a Play route', 'probe.sh'),
        ('for r in / /townlife/ /resources/; do\n  curl -fsS "https://madebymatt.uk${r}" >/dev/null\ndone\n',
         'VACUOUS_EDU_LOOP', 'vacuous: same shape, braced interpolation', 'probe.sh'),
        ("const ROUTES = ['/for/pupils/', '/games/'];\nfor (const r of ROUTES) await fetch(`https://madebymatt.uk${r}`)\n",
         'VACUOUS_EDU_LOOP', 'vacuous: array-literal domain, two hops from the join', 'probe.mjs'),
        ('for route in / /Lessons/ /resources/ /tools/; do\n  curl -fsS "https://madebymatt.uk$route" >/dev/null\ndone\n',
         None, 'control: same loop, education routes only', 'probe.sh'),
        ('for route in / /games/ /townlife/; do\n  curl -fsS "https://www.madebymatt-play.uk$route" >/dev/null\ndone\n',
         None, 'control: Play routes fetched from the Play origin', 'probe.sh'),
        ('BASE="https://madebymatt.uk"\ncurl -fsS "$BASE/for/pupils/"\n',
         None, 'control: an education base that is never interpolated', 'probe.sh'),
        ('# for route in / /games/; do curl "https://madebymatt.uk$route"; done\ncurl -fsS https://madebymatt.uk/for/pupils/\n',
         None, 'control: the vacuous shape inside a comment', 'probe.sh'),
    ]
    import tempfile
    for case in cases:
        source, want, label = case[0], case[1], case[2]
        name = case[3] if len(case) > 3 else 'probe.mjs'
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / name
            f.write_text(source)
            rows = scan_file('probe', Path(d), f, source, is_game)
            got = sorted({r['verdict'] for r in rows if r['verdict'] in FAILING})
            # Membership, not first-of-sorted. One fixture can legitimately trip two
            # classes -- the array-literal vacuous case is also a genuine JOINED --
            # and picking got[0] alphabetically reported VACUOUS as a failure when
            # it had in fact fired. A control still has to come back completely
            # empty, so this is stricter on the half that matters.
            hit = ', '.join(got) if got else None
            good = (not got) if want is None else (want in got)
            print(f'  {"RED " if want else "GREEN"}   {label:52} -> {hit}  expected={want}')
            ok &= good
    print('SELF-TEST', 'PASS' if ok else 'FAIL')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', action='append', default=[], metavar='NAME=PATH')
    ap.add_argument('--site', required=True)
    ap.add_argument('--lessons', default=None)
    ap.add_argument('--json')
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--report-only', action='store_true')
    args = ap.parse_args()

    site = Path(args.site).resolve()
    is_game = load_is_game(site)
    if args.self_test:
        return 0 if self_test(is_game) else 1

    repos = {}
    for item in args.repo:
        name, _, path = item.partition('=')
        repos[name] = Path(path).resolve()
    if not repos:
        # Site-only by default: this is the repository CI checks out. The
        # cross-estate run is the same script with --repo arguments.
        repos = {'Site': site}
    findings, roles, scanned, fetching = census(repos, is_game)
    bad = [f for f in findings if f['verdict'] in FAILING]
    other = [f for f in findings if f['verdict'] not in FAILING and f['verdict'] != 'ok']

    print(f'files scanned {scanned} · files that can make a request {fetching}')
    print(f'estate-origin literals {len(findings) - sum(1 for f in findings if f["verdict"] == FAILING[1])}'
          f' · TARGET {roles["TARGET"]} · EXPECTATION {roles["EXPECTATION"]} · PROSE {roles["PROSE"]}')
    print()
    files = sorted({(f['repo'], f['file']) for f in bad})
    for repo, rel in files:
        rows = [f for f in bad if f['repo'] == repo and f['file'] == rel]
        print(f'{repo}/{rel}')
        for f in rows:
            if f['verdict'] == FAILING[1]:
                print(f'  JOINED  base line {f["base_at"]}  ->  Play route "{f["route"]}" at line {f["line"]}')
            elif f['verdict'] == FAILING[2]:
                print(f'  VACUOUS line {f["line"]}  {f["host"]}{f["route"]}  -- {f["detail"]}')
                print(f'          {f["source"]}')
            else:
                print(f'  DIRECT  line {f["line"]}  {f["host"]}{f["route"]}')
                print(f'          {f["source"]}')
        print()
    for f in other:
        print(f'[{f["verdict"]}] {f["repo"]}/{f["file"]}:{f["line"]}  {f["host"]}{f["route"]}')
    print()
    print(f'MIS-TARGETED verifiers {len(files)} · findings {len(bad)} '
          f'(DIRECT {sum(1 for f in bad if f["verdict"] == FAILING[0])}, '
          f'VACUOUS {sum(1 for f in bad if f["verdict"] == FAILING[2])}, '
          f'JOINED {sum(1 for f in bad if f["verdict"] == FAILING[1])}) '
          f'· other reported {len(other)}')
    if args.json:
        Path(args.json).write_text(json.dumps(findings, indent=1))
    direct = [f for f in bad if f['verdict'] in (FAILING[0], FAILING[2])]
    joined = [f for f in bad if f['verdict'] == FAILING[1]]
    # DIRECT fails; JOINED reports. A DIRECT finding is a defect by
    # construction -- one literal carrying an education host and a Play path,
    # with nothing to interpret. JOINED is a screen, not a verdict: it pairs a
    # bare origin with a Play route in the same file, and tracing whether they
    # actually meet in a request needs the call graph. Of eight files this
    # screen flagged, one was a real defect; failing on the screen would have
    # reddened seven correct verifiers.
    if joined and not direct:
        print('JOINED findings are reported, not failed -- trace each before acting.')
    return 0 if (args.report_only or not direct) else 1


if __name__ == '__main__':
    sys.exit(main())
