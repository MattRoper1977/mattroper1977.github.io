# CARRY-FORWARD PACK → Pass letter U (Lessons estate)

Rides along with the original Pass Q prompt + Matt's addendum. Assembled by the Pass Q site-repo audit
(branch claude/pass-q-audit-c5tg3s). Self-collision clause: if any Lessons ledger already spends **U**,
take the next free letter and record the rename.

## 1 · TAXONOMY-UNION TABLE (both catalogues, after the code's own norm; Lessons pinned @ 32ca685e)
```
TYPE                  Lessons  Site  MERGED(after Q2 rename)
Activity                    0     1       1
Game                       30     0      30    (Simulation kept separate — deliberate positioning)
Interactive lesson          0     2       2
Lesson                    263     0     263
Pupil                      12     0      12
Revision                    2     0       2
Simulation                  0     1       1
Support                    38     0      38
Teacher                    39     3      42    (site's 3 renamed from "Teacher tool" in Q2)
```
Merged subject facet also carries the chip targets: Primary Science 52, Humanities 32,
"Art · Teesside Studio Suite" 52. No stowaway type synonyms outside these.

## 2 · SITEMAP CROSS-REPO COVERAGE (decoded, mapped to serving tree — full lists in CARRYFORWARD_drift.txt)
- DEAD locs (loc in sitemap, no decoded file in tree): **Lessons 0 · Games 0 · Matt-s-Apps- 0.**
  (An earlier site-pass note said "70 dead" — that was a FALSE POSITIVE from comparing URL-ENCODED locs
  to decoded filesystem paths; once `urllib.parse.unquote` is applied every loc resolves. Lesson for U:
  decode before you diff a sitemap against a tree.)
- REVERSE coverage (html in tree, not individually in sitemap): Lessons 48 · Games 1 · Matt-s-Apps- 30.
  Largely the section-root convention for siblings (e.g. Matt-s-Apps- lists only its root). Whether to
  expand cross-repo coverage is a POLICY decision for U — the real fix is one whole-of-domain
  regenerate across all repos' disks (extend _passq/sitemap_regen.py to walk every tree).

## 3 · CHIP-GUARD STANDING OBLIGATION (from Q6)
`_passq/chips_check.py` resolves every curated homepage #dxChips value through the exact merged-catalogue
render() filter chain and goes red on any empty or silently-no-op chip.
**Any type rename in EITHER catalogue — this repo's data/resources.json OR Lessons' resources.json —
re-runs this guard before it ships.** This is the cross-repo form of the four-surface agreement rule; it
is how the silent-exclusion class stays dead after we stop looking.

## 4 · DORMANT app.js CATALOGUE RENDERER (recorded for U; NOT touched this pass)
app.js carries a full second catalogue renderer (normLessons/normSite/card/render, same exact-match
`r.type===t` logic as resources/index.html) that runs only `if($('#cards'))`. Neither page that loads it
(index.html, resources/index.html) has #cards, so the block never executes — a second copy of the render
truth, able to drift from the live one. For U: prove zero references (replayed control per corpus), then
delete-or-derive. Do not touch without that proof.
