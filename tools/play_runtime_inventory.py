#!/usr/bin/env python3
"""PLAY-Q1 §7.2: the per-route controls / zoom / save / findings inventory, derived from the
existing ledgers, never a new sweep.

    python tools/play_runtime_inventory.py --catalogue <built domain-catalogue.json> --write docs/play-q1/runtime-inventory.json

Sources, all already in the repository:
  controls and modes ........ domain-split/play/evidence.json (source-inspected, per route)
  zoom declaration .......... docs/HC4_ZOOM_DECLARATION_2026-09-07.json (26-route population; others UNMEASURED)
  saves ..................... docs/HC3_SAVE_INVENTORY_RELEASED_SUMMARY_2026-09-07.json (static binding inventory)
  pause / timing ............ no ledger measures these per route: UNMEASURED, written as such
  findings and the pilot .... domain-split/play/runtime-findings.json (typed from the ledgers, with provenance)
Counts are derived from the built catalogue; nothing here is hand-counted."""
import argparse, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def key(route):
    return route.rstrip('/') or '/'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--catalogue', type=Path, required=True); ap.add_argument('--write', type=Path); a = ap.parse_args()
    cat = json.loads(a.catalogue.read_text())
    routes = [(r['route'], kind) for kind in ('games', 'activities', 'staff') for r in cat.get(kind, [])]
    evidence = json.loads((ROOT / 'domain-split/play/evidence.json').read_text())['games']
    zoom = json.loads((ROOT / 'docs/HC4_ZOOM_DECLARATION_2026-09-07.json').read_text())['declaration']['after']['routes']
    zoom = {key(r['route']): r for r in (zoom.values() if isinstance(zoom, dict) else zoom)}
    saves = json.loads((ROOT / 'docs/HC3_SAVE_INVENTORY_RELEASED_SUMMARY_2026-09-07.json').read_text())['routes']
    saves = {key(k): v for k, v in saves.items()}
    findings = json.loads((ROOT / 'domain-split/play/runtime-findings.json').read_text())
    by_route = {}
    for f in findings['findings']: by_route.setdefault(key(f['route']), []).append(f)
    rows = []
    for route, kind in routes:
        k = key(route); ev = evidence.get(k, {}); z = zoom.get(k); s = saves.get(k)
        rows.append({
            'route': route, 'kind': kind,
            'controls': ev.get('controls', []), 'modes': ev.get('modes', []), 'controlsEvidence': 'source-inspected' if ev.get('evidence') else 'none recorded',
            'zoomDeclaration': ('PASS' if z['pass'] else 'FAIL') if z else 'UNMEASURED (not in the HC4 population)',
            'saves': ({'migrationCandidate': s['migrationCandidate'], 'resolved': s['resolvedCandidates'], 'unresolved': s['unresolved']} if s else 'UNMEASURED (not in the HC3 inventory)'),
            'pauseTiming': 'UNMEASURED (no ledger measures pause or timing per route)',
            'findings': [{'class': f['class'], 'finding': f['finding'], 'ledger': f['ledger'], 'state': f['state']} for f in by_route.get(k, [])],
        })
    summary = {
        'routes': len(rows),
        'controlsSourceInspected': sum(1 for r in rows if r['controlsEvidence'] == 'source-inspected'),
        'zoom': {v: sum(1 for r in rows if r['zoomDeclaration'] == v) for v in sorted({r['zoomDeclaration'] for r in rows})},
        'savesInventoried': sum(1 for r in rows if isinstance(r['saves'], dict)),
        'routesWithFindings': sum(1 for r in rows if r['findings']),
        'openFindingsByClass': {},
        'pilot': findings['pilot'],
    }
    for r in rows:
        for f in r['findings']:
            if f['state'].startswith('open') or f['state'].startswith('HOLD'):
                summary['openFindingsByClass'][f['class']] = summary['openFindingsByClass'].get(f['class'], 0) + 1
    unmatched = [f['route'] for f in findings['findings'] if key(f['route']) not in {key(r) for r, _ in routes}]
    if unmatched: sys.exit('findings name routes that are not in the catalogue: ' + ', '.join(unmatched))
    out = {'schema': 1, 'sources': findings['ledgers'] | {'evidence': 'domain-split/play/evidence.json'}, 'summary': summary, 'rows': rows}
    if a.write: a.write.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print(json.dumps(summary, indent=1, ensure_ascii=False))

if __name__ == '__main__': main()
