# PASS U — FINDINGS (living ledger)

Branch: **`pass-u-audit`** (site repo, off origin/main 04a40b4). §5 Lessons sweep → separate `pass-u-audit`
branch in MattRoper1977/Lessons (needs push access; groundwork = /workspace/lessons @ 32ca685e unshallowed).
Nothing merged. Sitemap deliverable handed back as files; live sitemap.xml NOT modified.

## PASS Q STATE (established before trusting carry-forwards)
- Pass Q tip 6845f44 on `claude/pass-q-audit-c5tg3s` is **NOT merged**; origin/main = 04a40b4.
- ⇒ the deployment still serves type **"Teacher tool"**; the union-table rename is proposed, not live. Every
  finding here that leans on the rename says so. The three post-merge browser checks remain the reviewer's.

## §2 · SCRIPTED-PAGE COUNT RECONCILED (the loose number from Pass Q, closed)
At 6845f44 the true census of HTML files with an executable inline script is **9**:
index · resources/index · tools/index · games/index · uas/app · asdan/app · medevac/index · medevac/studio ·
experiences/medevac-frontier (redirect stub). Pass Q's "9" (early) and "7" (close) were both **boot-SETS I
selected**, not a census: the "7" silently dropped next/apps.html + next/lessons.html, and both sets omitted
the apps/game builds/stub (verified by targeted tests). Same integer, different members — the 9→7 was a
narrowed boot-set definition, now stated. Scope rule honoured: every count above carries its definition.

## §4 · WHOLE-DOMAIN SITEMAP — COVERAGE (policy-gated; generated; HANDED BACK, not applied)
Dead-loc count re-verified **0** (decoded + ground-truthed). This pass is COVERAGE only — purely additive.

### Policy gate (reviewer's per-folder calls)
- Lessons: **add individual decks** · Matt-s-Apps-: **add the studio pages** · LundyLoop: **include**
  (README: deployed at .../Lessons/LundyLoop/ with poster QR codes) · YearPlan + primary hubs: **include**.

### Candidate model → 68 additions (Lessons +41, Matt-s-Apps- +27, Games +0), 0 removals
Derived from pinned trees (Lessons@32ca685e, Games@43bf1f8a, Matt-s-Apps-@27d4e0ac), decoded + ground-truthed,
**true per-file last-commit lastmods** (clones unshallowed: dates span 2026-07-18…07-28, not a uniform stamp).
Excluded by rule/evidence (8), each surfaced not silently dropped:
- Lessons/404.html, Matt-s-Apps-/404.html — error pages
- Lessons/hub-health.html, Matt-s-Apps-/suite-health.html — internal 🩺 diagnostics dashboards
- Lessons/build-engine/roster-setup.html — internal lesson GENERATOR (README: "Build Lesson Engine")
- Lessons/Build/_Archive_.../… — archived version · …_autosave.html — editor artifact · Games/Orbital_source.html
  — dev source (Orbital.html is the real game). Section-root index.html files map to the already-listed /X/ root.
NOTE: `-1.html`/`_1.html` are NORMAL filenames in this estate (the sitemap already lists Lesson1_Indicators-1.html),
so NOT treated as dup markers; any genuine stale duplicate is a §5 content-dedup finding, not a sitemap exclusion.

### Folder provenance — which folders entered per an EXPLICIT reviewer call (§B)
```
FOLDER                          n   AUTHORISED BY
Matt-s-Apps-/ (studios)        27   EXPLICIT "add the studio pages"   (delivered 27, not 29: excluded
                                    suite-health.html 🩺 + 404.html — veto those exclusions if you meant all 29)
Lessons/Build                   9   EXPLICIT "add individual decks"
Lessons/2 Physics 10            2   EXPLICIT "add individual decks"
Lessons/Art_Teesside            2   EXPLICIT "add individual decks"
Lessons/Tutor_Time              2   EXPLICIT "add individual decks"
Lessons/GROW_ASDAN              1   EXPLICIT "add individual decks"
Lessons/Launch/Art_L1,Art_L2    2   EXPLICIT "add individual decks" (deck files)
Lessons/LundyLoop              18   EXPLICIT "include LundyLoop"
Lessons/YearPlan, primary       2   EXPLICIT "include both hubs"
------------------------------ 65   APPLIED-READY
Lessons/Games/ (Glitch_Clash,   2   *** INFERRED — games, not decks; no explicit call *** -> PROPOSED-HOLD
  Hold_the_Mark)
Lessons/Launch/  (index hub)     1   *** INFERRED — hub not in the named hubs *** -> PROPOSED-HOLD
------------------------------  3   PROPOSED — HOLD (do NOT apply until you rule)
```
The 3 PROPOSED-HOLD locs are quarantined inside coverage_block.xml under a DO-NOT-APPLY comment.

### ASSUMED BASE + APPLY ORDER (§B — the base question)
- The coverage block assumes base = **sitemap.xml at Pass Q tip `6845f44`** (post-Q5). It is purely additive
  cross-repo locs; the cross-repo section is byte-identical between pre-Q main (04a40b4) and post-Q, so the
  block is the same either way — but it MUST be appended to the POST-MERGE main so Q1's /medevac/ and Q5's
  regenerated site-section survive. Applying a full-file proposed built on pre-Q main would silently revert
  Q1/Q5 — do NOT apply the full `_passu/sitemap.*proposed.xml` files wholesale; they are pre-Q-base
  illustrations only. **Deliverable = append `_passu/coverage_block.xml` (its 65 applied-ready locs) to the
  post-merge main sitemap.**
- APPLY ORDER (numbered, stop on any failure):
  1. Merge the Pass Q chain (Q1→Q6) to main.
  2. Pages rebuilds → run the three browser checks (Teacher chip surfaces UAS/ASDAN/Evidence Binder · old
     catalogue route redirects with a v1 save intact · /medevac/ plays). ANY failure STOPS the sequence here.
  3. Only then apply §4: append coverage_block.xml's applied-ready block to the post-merge main sitemap
     (result 396+65 = 461 locs; +3 more if you clear the PROPOSED-HOLD). Verify XML + the drift guard.
  4. Only then open the Lessons session for §5.
- `_passu/gen_coverage.py` regenerates the block; verify: XML valid; append = one hunk, +65 <url>, −0 removed;
  planted-positive (remove a known loc → guard exit 1) fires. "dead locs removed" is NOT claimed — count is 0.

## §5 · LESSONS ESTATE SWEEP — PHASE 0 (ongoing; needs its own Lessons branch + push)
- Estate @ 32ca685e: 384 resources.json entries · 431 html · 19 subjects · 2 ★ ASSESSED LESSON files.
- CARRY-FORWARD CHECK — taxonomy union table: Lessons type values = lesson 263 · teacher 39 · game 30 ·
  support 38 · pupil 12 · revision 2 — **exactly the union table, no new synonym pair**. The "Teacher tool"
  split-facet class has NOT recurred in Lessons. (Green.)
- Chassis note: build-engine drives 9 shim lessons (one donor family) — specimen-per-chassis target.
- Observation (cross-repo, for later): Lessons resources.json has no `added`/`new`/`featured` keys, yet the
  site homepage's "Latest drops" reads r.added — so that pool is currently empty from Lessons data. Not a
  Lessons defect per se; logged for the site-side owner.
- The sweep proper (link/script/co-present/dead-code/a11y/print across the estate, four-surface week checks,
  content rules) is the next workstream; it commits to a Lessons `pass-u-audit` branch, not this one.

## SCHEDULED / DO-NOT-FIX (re-read; rediscovery = "known, scheduled", not a commit)
Heavy-tier RM chassis (chemistry/primary/biology/Assembly), the 500ms nudge-gap content pass, the reading-theme
port of lesson decks — all out of scope. Site-repo do-not-fix ledger stands.

## §C · HANDOFF — to the Lessons-rooted session that runs U §5
Start from: the original Pass Q brief + the Pass U addendum + the two committed branches below (read via
raw.githubusercontent.com at pinned SHAs — both public, no access grant needed). Take nothing from the
chat; if something you need lives only there, it is a defect in this record — but it shouldn't.
- **`claude/pass-q-audit-c5tg3s`** (site repo mattroper1977.github.io) — Pass Q record + carry-forwards +
  the chip guard: `_passq/FINDINGS.md`, `_passq/CARRYFORWARD_U.md`, `_passq/CARRYFORWARD_drift.txt`,
  `_passq/chips_check.py`. Pinned SHA: derive with `git log -1 --format=%h` on that branch (Pass Q's own
  handoff pins it; do not trust a literal).
- **`pass-u-audit`** (site repo) — THIS session: §2 reconciliation + the §4 sitemap sub-pass
  (`_passu/FINDINGS.md`, `_passu/PLAN.md`, `_passu/coverage_block.xml`, `_passu/gen_coverage.py`).
  Pinned SHA: derive with `git log -1 --format=%h` on this branch.
Standing obligations that bind §5: the chip-guard rule (any type change → `_passq/chips_check.py` green
before it ships); decode-then-ground-truth before any sitemap/tree count; specimen-per-chassis; assessed
lessons committed alone with one hunk. The sitemap sub-pass is DONE (hand-back) — §5 does not touch it.

## §D · LINEAGE — letter U, one programme across two repos
- **U §2+§4** (site-side preliminaries) live on THIS branch `pass-u-audit` in mattroper1977.github.io.
- **U §5** (the estate body) runs on its OWN `pass-u-audit` branch in MattRoper1977/Lessons, from a fresh
  Lessons-rooted session with write access to Lessons only.
- Each half's FINDINGS names the other at a pinned SHA (derived, never literal), so neither half can be read
  as the whole. One repo with write access per session is the recoverability boundary — not crossed.
