#!/usr/bin/env python3
"""UX2 B4 — A3's per-key check: every (subject, pathway, halfTerm, unit) key that holds at least one
non-lesson resource on /resources/, derived from a Lessons catalogue with the hub's own rules
(cardOf / tierOf ported from assets/catalogue/hub.js). A row with a half-term but no unit keys by
(subject, pathway, halfTerm) — unit is null. The Lessons subject page shows "Planning and evidence →"
on exactly these rows (the small Lessons PR reads this file). Nothing typed.

  ux2_planning_keys.py --lessons <Lessons checkout> [--out <file>]
"""
import argparse, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_publications import card_of, tier_of  # noqa: E402

def keys_for(rows):
    out = {}
    for r in rows:
        t = str(r.get('type', '')).lower()
        if t in ('lesson', 'game') or not r.get('halfTerm'): continue
        k = (card_of(r), tier_of(r), r['halfTerm'], r.get('unit') or None)
        out[k] = out.get(k, 0) + 1
    order = {'BUILD': 0, 'GROW': 1, 'LAUNCH': 2}
    return [{'subject': s, 'pathway': p, 'halfTerm': h, 'unit': u,
             'href': '/resources/?' + '&'.join(x for x in ['subject=' + s, 'pathway=' + p if p else ''] if x), 'count': n}
            for (s, p, h, u), n in sorted(out.items(), key=lambda kv: (kv[0][2], kv[0][0], order.get(kv[0][1], 9), str(kv[0][3] or '')))]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--lessons', required=True, type=Path); ap.add_argument('--out', type=Path)
    a = ap.parse_args()
    rows = json.loads((a.lessons / 'resources.json').read_text())
    doc = {'schema': 'mbm-planning-keys-v1', 'keys': keys_for(rows)}
    text = json.dumps(doc, indent=1, ensure_ascii=False) + '\n'
    if a.out: a.out.write_text(text)
    print(json.dumps({'keys': len(doc['keys']), 'resources': sum(k['count'] for k in doc['keys']), 'unitless': sum(1 for k in doc['keys'] if k['unit'] is None), 'out': str(a.out) if a.out else None}))

if __name__ == '__main__':
    main()
