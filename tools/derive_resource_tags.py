#!/usr/bin/env python3
"""T2.2 — three derivation passes, separate outputs, so a weak pass can be
discarded without losing the strong ones.

Nothing here guesses. A resource that fires two rules, or none, is UNCLASSIFIED
with the reason recorded — T1.3 forbids a coverage target precisely because
pressure to reach a percentage is pressure to guess, and a wrong tag is worse
than a missing one because a teacher acts on it.
"""
import json, os, re, sys, collections

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS = '/home/user/Lessons'
REC = os.path.join(SITE, 'data/source-manifests/lessons-resources.json')

# ---- pass 1: interactionModel, by inspecting the artefact -----------------
RULES = [
    ('simulation',      lambda t: '<canvas' in t and re.search(r'pointerdown|mousedown|touchstart|requestAnimationFrame', t)),
    ('sorting',         lambda t: re.search(r'draggable\s*=|dragstart|sortable', t, re.I)),
    ('multiple-choice', lambda t: re.search(r'type\s*=\s*["\'](radio|checkbox)["\']', t, re.I)),
    ('calculation',     lambda t: bool(re.search(r'type\s*=\s*["\']number["\']', t, re.I))
                                   and bool(re.search(r'parseFloat|parseInt|Number\(|toFixed', t))),
    ('free-response',   lambda t: '<textarea' in t.lower()),
    ('printed-offline', lambda t: '@media print' in t and not re.search(r'<input|<textarea|<button|<select', t, re.I)),
    ('reading',         lambda t: not re.search(r'<input|<textarea|<select|<canvas', t, re.I)),
]

def derive_interaction(items):
    out, unclass = {}, collections.Counter()
    for it in items:
        f = it.get('file')
        p = os.path.join(LESSONS, f) if f else None
        if not p or not os.path.exists(p):
            unclass['artefact file not found'] += 1; continue
        try:
            t = open(p, encoding='utf-8', errors='replace').read()
        except Exception:
            unclass['artefact unreadable'] += 1; continue
        fired = [name for name, fn in RULES if fn(t)]
        # 'reading' is the residual: it only counts when nothing else fired
        strong = [f_ for f_ in fired if f_ != 'reading']
        if len(strong) == 1:
            out[it['id']] = (strong[0], f'rule fired: {strong[0]}')
        elif len(strong) == 0 and 'reading' in fired:
            out[it['id']] = ('reading', 'rule fired: reading (no interactive control)')
        elif len(strong) == 0:
            unclass['no rule fired'] += 1
        else:
            unclass[f'rule collision: {"+".join(sorted(strong))}'] += 1
    return out, unclass

# ---- pass 2: classroomRole, from the record ------------------------------
# type/family describe WHAT a resource is, not WHERE it sits in a lesson arc.
# Only mappings that are true by definition are taken.
ROLE_MAP = {'revision': 'retrieval-drill'}

def derive_role(items):
    out, unclass = {}, collections.Counter()
    for it in items:
        ty = str(it.get('type', '')).strip().lower()
        if ty in ROLE_MAP:
            out[it['id']] = (ROLE_MAP[ty], f"type='{it.get('type')}' maps by definition")
        else:
            unclass[f"type='{it.get('type')}' describes the artefact, not its place in a lesson arc"] += 1
    return out, unclass

# ---- pass 3: curriculum, only where a document states it -----------------
def derive_curriculum(items):
    out, unclass = {}, collections.Counter()
    for it in items:
        unclass['no scheme-of-work document names this resource'] += 1
    return out, unclass

def report(name, out, unclass, total):
    print(f"\n=== pass: {name} ===")
    print(f"  classified    {len(out)}/{total}")
    print(f"  unclassified  {sum(unclass.values())}")
    coll = {k: v for k, v in unclass.items() if k.startswith('rule collision')}
    print(f"  collisions    {sum(coll.values())}")
    if out:
        c = collections.Counter(v[0] for v in out.values())
        print("  values:")
        for v, n in c.most_common(): print(f"     {n:>4}  {v}")
    print("  unclassified reasons:")
    for r, n in unclass.most_common(10): print(f"     {n:>4}  {r[:88]}")

items = json.load(open(REC))
T = len(items)
i_out, i_un = derive_interaction(items)
r_out, r_un = derive_role(items)
c_out, c_un = derive_curriculum(items)
report('interactionModel', i_out, i_un, T)
report('classroomRole',    r_out, r_un, T)
report('curriculum',       c_out, c_un, T)

json.dump({'interactionModel': {k: v[0] for k, v in i_out.items()},
           'classroomRole':    {k: v[0] for k, v in r_out.items()},
           'curriculum':       {k: v[0] for k, v in c_out.items()}},
          open(os.path.join(SITE, 'data/derived-resource-tags.json'), 'w'), indent=2, sort_keys=True)
print(f"\n  coverage: interactionModel {len(i_out)*100//T}% · classroomRole {len(r_out)*100//T}% · curriculum {len(c_out)*100//T}%")
