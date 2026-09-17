#!/usr/bin/env python3
"""PLAY-Q1 §7.1: the per-route splash coverage table, derived — never hand-counted.

    python3 tools/play_splash_coverage.py --catalogue <built games/data/domain-catalogue.json> \
        --site . --lessons <Lessons checkout> [--write docs/play-q1/coverage.json]

Every playable route comes from the built Play domain catalogue (games + activities),
so the count is derived from the release owner's own output. For each route the tool
records the source owner, the splash family found in the served bytes, whether the
canonical generated region is present and current, and the CSP image posture. A route
whose file cannot be found is listed as MISSING FILE, never dropped.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path
import importlib.util

MAKER = '<!-- MBM-MAKER-SPLASH:BEGIN'
LEGACY = '<!-- MBM-SPLASH:BEGIN'
OWN = re.compile(r'id="splash"|class="splash')
CSP = re.compile(r'<meta[^>]+Content-Security-Policy[^>]*content="([^"]*)"', re.I)


def region_sha(text: str) -> str | None:
    m = re.search(r'<!-- MBM-MAKER-SPLASH:BEGIN.*?<!-- MBM-MAKER-SPLASH:END -->\n?', text, re.S)
    return hashlib.sha256(m.group(0).encode()).hexdigest() if m else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--catalogue', type=Path, required=True); ap.add_argument('--site', type=Path, required=True)
    ap.add_argument('--lessons', type=Path, required=True); ap.add_argument('--write', type=Path)
    ap.add_argument('--check', action='store_true',
                    help='regenerate in memory and compare with the committed record; write nothing')
    a = ap.parse_args()
    cat = json.loads(a.catalogue.read_text())
    routes = [(g['route'], 'game', g.get('title', '')) for g in cat['games']] + [(x['route'], 'activity', x.get('title', '')) for x in cat.get('activities', [])]
    spec = importlib.util.spec_from_file_location('render_maker_splash', a.site / 'tools/render_maker_splash.py'); gen = importlib.util.module_from_spec(spec); sys.modules['render_maker_splash'] = gen; spec.loader.exec_module(gen)
    current = hashlib.sha256(gen.build_region().encode()).hexdigest()
    declared = {}
    for owner_root, label in ((a.site, 'Site'), (a.lessons, 'Lessons')):
        ledger_path = owner_root / 'data/hud-coverage.json'
        if not ledger_path.is_file(): continue
        ledger = json.loads(ledger_path.read_text()).get('makerSplash', {})
        for k in ('applied', 'declined-with-reason', 'variant-retained-with-reason', 'held-at-previous-region-with-reason'):
            for i in ledger.get(k, []): declared[i['route'] if isinstance(i, dict) else i] = f'{label}:{k}'
    rows = []
    for route, kind, title in routes:
        lessons = route.startswith('/Lessons/')
        root = a.lessons if lessons else a.site
        rel = route[len('/Lessons/'):] if lessons else route.lstrip('/')
        path = root / rel / 'index.html' if route.endswith('/') else root / rel
        row = {'route': route, 'kind': kind, 'title': title, 'owner': 'Lessons' if lessons else 'Site', 'file': str(path.relative_to(root)) if path.exists() else None}
        if not path.is_file():
            row.update(family='MISSING FILE', canonical=False, current=False, csp=None); rows.append(row); continue
        text = path.read_text(encoding='utf-8', errors='replace')
        if MAKER in text: fam = 'canon'
        elif LEGACY in text: fam = 'legacy-region'
        elif OWN.search(text): fam = 'own-splash'
        else: fam = 'none'
        sha = region_sha(text)
        csp = CSP.search(text)
        ledger_state = declared.get(route)
        if ledger_state is None and route.startswith('/Lessons/Games/'):
            # The 27 Lessons shelf games carry no splash key by the SC1 §5 ruling (reports/2026-09-02-games-census.md,
            # 'Splash key: 0 of 27 Lessons games ... ruled declined by construction'); a Lessons-owned decision, recorded not overturned.
            ledger_state = 'Lessons:declined-by-construction (SC1 §5)'
        row.update(family=fam, canonical=sha is not None, current=(sha == current), regionSha256=sha, ledger=ledger_state or 'undeclared',
                   csp=(csp.group(1) if csp else None), cspBlocksExternalImages=bool(csp and re.search(r"img-src(?![^;]*'self')", csp.group(1))))
        rows.append(row)
    summary = {'routes': len(rows), 'byFamily': {}, 'byOwner': {}, 'currentRegion': sum(1 for r in rows if r.get('current')), 'generatorRegionSha256': current}
    for r in rows:
        summary['byFamily'][r['family']] = summary['byFamily'].get(r['family'], 0) + 1
        summary['byOwner'][r['owner']] = summary['byOwner'].get(r['owner'], 0) + 1
    out = {'schema': 1, 'summary': summary, 'rows': rows}
    if a.check:
        # Compare against the committed record. Writes nothing. The derivation is stated
        # in the failure so nobody re-implements it: a hand-computed digest is not
        # evidence about this file, and comparing it with render_maker_splash.py's byte
        # count or CyberPulse's SPLASH_BYTES is comparing two different measurements.
        record = a.site / 'docs/play-q1/coverage.json'
        if not record.is_file():
            print('MISSING ' + str(record)); return 1
        have = json.loads(record.read_text())
        problems = []
        hs, ws = have.get('summary', {}), out['summary']
        for key in sorted(set(hs) | set(ws)):
            if hs.get(key) != ws.get(key):
                problems.append(('summary.' + key, hs.get(key), ws.get(key)))
        hr = {r.get('route'): r for r in have.get('rows', [])}
        wr = {r.get('route'): r for r in out['rows']}
        for route in sorted(set(hr) | set(wr)):
            if route not in hr: problems.append(('rows[' + route + ']', '(absent)', 'present')); continue
            if route not in wr: problems.append(('rows[' + route + ']', 'present', '(absent)')); continue
            for key in sorted(set(hr[route]) | set(wr[route])):
                if hr[route].get(key) != wr[route].get(key):
                    problems.append(('rows[' + route + '].' + key, hr[route].get(key), wr[route].get(key)))
        if problems:
            print('STALE docs/play-q1/coverage.json -- %d field(s) differ from this writer' % len(problems))
            print('derivation: SHA-256 of the region between the MBM-MAKER-SPLASH BEGIN and END')
            print('            markers, INCLUDING its trailing newline, bytes exactly as committed.')
            print('            render_maker_splash.py and CyberPulse SPLASH_BYTES EXCLUDE that')
            print('            newline and are byte counts, so their values never match this one.')
            for field, committed, derived in problems[:40]:
                print('  %-34s committed=%s  writer=%s' % (field, committed, derived))
            if len(problems) > 40: print('  ... and %d more' % (len(problems) - 40))
            print('regenerate with the same command, replacing --check with')
            print('  --write docs/play-q1/coverage.json')
            return 1
        print('docs/play-q1/coverage.json is current -- %d rows, region %s'
              % (len(out['rows']), ws['generatorRegionSha256']))
        return 0
    if a.write:
        a.write.parent.mkdir(parents=True, exist_ok=True); a.write.write_text(json.dumps(out, indent=1) + '\n')
    print(json.dumps(summary, indent=1))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
