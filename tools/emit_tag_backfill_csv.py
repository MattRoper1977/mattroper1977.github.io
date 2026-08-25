#!/usr/bin/env python3
"""U5.2 — emit data/tag-backfill.csv: the three-tag worklist, as a file Matt can
actually fill in.

WHY THE FOUR TAG COLUMNS ARE EMPTY. The interactionModel derivation reached 71%
coverage and scored 12/20 against a threshold of 18 set before the number was
known, so it was discarded whole. Seeding these cells with it would be worse
than leaving them blank: a wrong value in a spreadsheet cell is harder to spot
than an empty one, and it will be trusted. Empty means "nobody has said yet".

WHY THE ORDER IS WHAT IT IS. 641 rows is a project. The rows Matt teaches from
this year are an afternoon, so they come first.

  tier 1  year 2026-27 AND a pathway a 2026-27 SoW workbook plans
          (BUILD / GROW / LAUNCH — the three workbooks that exist)
  tier 2  the rest of year 2026-27
  tier 3  year 2025-26

NO row is in a tier because a SoW row NAMED it. The 2026-27 workbooks exist -
`_passsg/inputs/GROW SOW 2026-27.xlsx`, `_passsb/inputs/Build SOW 2026-2027.xlsx`
and `_passsl/inputs/LAUNCH KS4 - 2026-27.xlsx`, all in the Lessons repo - but
they plan terms, themes, weeks and pathway targets, and not one of them names a
resource file or id. So the tiering is derived from the PATHWAY those workbooks
cover, which the resource record does carry, and never from a mapping that does
not exist. That distinction is the whole of why `curriculumRef` is empty: a spec
code is a professional judgement, and inferring one from a title is the invented
claim the threshold exists to prevent.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REC = os.path.join(ROOT, 'data/source-manifests/lessons-resources.json')
OUT = os.path.join(ROOT, 'data/tag-backfill.csv')

# The pathways a 2026-27 SoW workbook plans. Named, not inferred: these are the
# three workbooks that exist.
SOW_PATHWAYS = ('BUILD', 'GROW', 'LAUNCH')
CURRENT_YEAR = '2026-27'

FILLED = ['id', 'title', 'subject', 'type', 'family', 'year']
EMPTY = ['classroomRole', 'interactionModel', 'curriculumTopic', 'curriculumRef']

def tier(r):
    y = (r.get('year') or '').strip()
    subj = (r.get('subject') or '')
    if y == CURRENT_YEAR and any(subj.upper().startswith(p) for p in SOW_PATHWAYS):
        return 1
    if y == CURRENT_YEAR:
        return 2
    return 3

def main():
    doc = json.load(open(REC, encoding='utf-8'))
    rows = doc if isinstance(doc, list) else (doc.get('resources') or list(doc.values())[0])
    for r in rows:
        for f in FILLED:
            if f not in r:
                raise SystemExit(f'MEASUREMENT INVALID: record {r.get("id","?")} has no {f}')
    rows = sorted(rows, key=lambda r: (tier(r), r.get('subject') or '',
                                       r.get('family') or '', r.get('title') or ''))
    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(FILLED + EMPTY)
        for r in rows:
            w.writerow([r.get(k, '') for k in FILLED] + [''] * len(EMPTY))

    counts = {1: 0, 2: 0, 3: 0}
    for r in rows:
        counts[tier(r)] += 1
    print(f'wrote {OUT}')
    print(f'  rows                                  {len(rows)}')
    print(f'  tier 1  2026-27 on a SoW pathway      {counts[1]}   <- the afternoon')
    print(f'  tier 2  2026-27, other subjects       {counts[2]}')
    print(f'  tier 3  2025-26                       {counts[3]}')
    print(f'  named by a SoW ROW                    0   (no SoW row names a resource)')
    print(f'  tag cells pre-filled                  0   (deliberately: see the header)')
    return 0

if __name__ == '__main__':
    sys.exit(main())
