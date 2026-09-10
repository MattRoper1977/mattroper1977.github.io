#!/usr/bin/env python3
"""Census: checks whose `paths:` filter does not cover the surface they judge.

5m's exact shape. driving-games-live-verify.yml watched two game files, the
manifest and itself, and asserted about the ARCADE, the HOMEPAGE and the PUPIL
PAGE. So the commit that redesigned the pupil page could not fire the workflow
that asserted on it, and the red sat unseen for eleven days.

THE TEST IS NOT "HAS A FILTER". Plenty of filtered checks are fine, and the two
that were not had filters that looked perfectly sensible. The test is:

    every surface the run ASSERTS ON must be in the set the filter WATCHES

- not the file the check opens: `games.json` is read by half this estate
- not the tool it runs: a tool is watched, its subject often is not

Surfaces are collected from the workflow body AND from every repo tool the
workflow invokes, because the assertions usually live in the tool. A route is
mapped to the file that renders it (`/for/pupils/` -> `for/pupils/index.html`),
because that is the file a commit touches.

Output is a WORKLIST, not a verdict: every hit is printed with the surface, the
filter and the tool it came from, so a human can disagree with it. Reading the
sites is the standing practice; this only finds them.

Usage: python3 tools/census_filter_blindness.py [--gate] [repo-root ...]
"""
import os, re, sys, fnmatch

# A route is an ASSERTED SURFACE only when the check NAVIGATES TO IT. Merely
# naming a route is not judging it: verify_curation_keys.mjs names every game
# href in the curation record and asserts about games/index.html, and
# render_inline_exit.py carries a route map for eleven games it does not test.
# The first draft flagged 13 workflows on the naming test, almost all of them
# correct code - narrowed by reading the sites, never by raising a threshold.
NAVIGATE = re.compile(
    r"""(?:goto|fetch|curl[^\n]{0,80}?|open|request|visit)\s*\(?\s*"""
    r"""(?:[A-Za-z_$][\w$.]*\s*\+\s*)?['"](/[a-zA-Z0-9][a-zA-Z0-9._/-]*/)['"]""")
# and the bash form: curl … "$base/route/" or "$BASE/route/"
NAVIGATE_SH = re.compile(r"""\$\{?(?:base|BASE|B|origin|ORIGIN|url|URL)\}?(/[a-zA-Z0-9][a-zA-Z0-9._/-]*/)""")
ROUTE = re.compile(r"""['"](/[a-zA-Z0-9][a-zA-Z0-9._/-]*/)['"]""")
# Routes that are not a page of this estate, or that no single file renders.
IGNORE_ROUTES = {'/', '/tmp/', '/usr/', '/opt/', '/dev/', '/home/', '/api/', '/assets/',
                 '/images/', '/data/', '/tools/', '/Games/', '/Lessons/'}

def render_file(route):
    """The file a commit would touch to change this route."""
    r = route.strip('/')
    if not r:
        return None
    return f'{r}/index.html'

def covered(path, globs):
    return any(fnmatch.fnmatch(path, g) or fnmatch.fnmatch(path, g.rstrip('/') + '/**')
               or path.startswith(g.replace('**', '').rstrip('/') + '/')
               for g in globs)

def workflow_facts(full):
    body = open(full, encoding='utf-8', errors='replace').read()
    head = body.split('\njobs:')[0]
    if not re.search(r'^\s+paths:', head, re.M):
        return None                      # no filter: cannot be blind
    globs = [a or b for a, b in re.findall(r"^\s+-\s+'([^']+)'|^\s+-\s+\"([^\"]+)\"", head, re.M)]
    tools = set(re.findall(r'(?:node|python3|bash|sh)\s+((?:tools|\.github)/[\w./-]+)', body))
    return {'body': body, 'globs': globs, 'tools': tools}

def scan(root):
    hits = []
    wdir = os.path.join(root, '.github', 'workflows')
    if not os.path.isdir(wdir):
        return hits
    for fn in sorted(os.listdir(wdir)):
        if not fn.endswith(('.yml', '.yaml')):
            continue
        f = workflow_facts(os.path.join(wdir, fn))
        if not f:
            continue
        # surfaces named in the workflow, and in every tool it runs
        sources = {'(the workflow)': f['body']}
        for t in f['tools']:
            p = os.path.join(root, t)
            if os.path.exists(p):
                try:
                    sources[t] = open(p, encoding='utf-8', errors='replace').read()
                except Exception:
                    pass
        blind = {}
        for src, text in sources.items():
            navigated = set(NAVIGATE.findall(text)) | set(NAVIGATE_SH.findall(text))
            for route in navigated:
                if route in IGNORE_ROUTES or route.count('/') > 4:
                    continue
                rf = render_file(route)
                if not rf or not os.path.exists(os.path.join(root, rf)):
                    continue                      # not a page this repo renders
                if covered(rf, f['globs']):
                    continue
                blind.setdefault(route, set()).add(src)
        if blind:
            hits.append({'repo': os.path.basename(root), 'file': fn,
                         'globs': f['globs'], 'blind': blind})
    return hits

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       'fixtures', 'filter-blindness')

def self_test():
    """RECALL, MEASURED. Failure mode 48: a census that does not check its own
    recall is a sample. Zero blind checks across five repos is either a clean
    estate or a blind instrument, and the number alone does not say which.

    The fixture is a VERBATIM copy of driving-games-live-verify.yml at 93168a1^
    - the real 5m defect, filter and all - not a hand-written imitation of its
    shape. If this census cannot name that one, its zero means nothing and the
    gate says so instead of passing."""
    print('  RECALL CONTROL: the real 5m workflow, at the commit before it was fixed')
    if not os.path.isdir(FIXTURE):
        print(f'    MEASUREMENT INVALID: {FIXTURE} is missing, so recall was never measured')
        return False
    hits = scan(FIXTURE)
    named = [r for h in hits for r in h['blind']]
    ok = any('/for/pupils/' in r for r in named)
    print(f'    {"[ ok ]" if ok else "[FAIL]"} the census names it: '
          f'{len(hits)} workflow(s), unwatched {", ".join(sorted(named)) or "(nothing)"}')
    if not ok:
        print('    a census that cannot find the defect it was written for is a sample,')
        print('    and its zero on the live estate is not evidence of anything.')
    return ok

def main():
    gate = '--gate' in sys.argv
    roots = [a for a in sys.argv[1:] if not a.startswith('--')] or ['.']
    allhits = []
    for r in roots:
        allhits += scan(r)
    print('CENSUS: a filter that does not watch the surface its check judges')
    print(f'  roots: {", ".join(roots)}')
    print(f'  filtered workflows with at least one unwatched asserted surface: {len(allhits)}\n')
    for h in allhits:
        print(f'  {h["repo"]}:{h["file"]}')
        print(f'      watches {len(h["globs"])}: ' + ', '.join(h['globs'][:6])
              + ('…' if len(h['globs']) > 6 else ''))
        for route, srcs in sorted(h['blind'].items()):
            print(f'      UNWATCHED  {route:<34} named in {", ".join(sorted(srcs))}')
        print()
    if gate:
        recall = self_test()
        print()
        if allhits:
            raise SystemExit(1)
        if not recall:
            raise SystemExit(1)
        print('  every filtered check watches every surface it judges,')
        print('  and the census still finds the defect it was written for')
    return 0

if __name__ == '__main__':
    sys.exit(main())
