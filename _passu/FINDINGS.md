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

### Deliverables (files, for the reviewer to apply — no cross-repo push, live sitemap untouched)
- `_passu/coverage_block.xml` — the 68-loc additive block (portable; orthogonal to Pass Q's site-section).
- `_passu/sitemap.proposed.xml` — full proposed file on the POST-Pass-Q base (464 locs; has /medevac/; passes the guard).
- `_passu/sitemap.main.proposed.xml` — same block on the LIVE main base (463 locs). NOTE: main still lacks
  /medevac/ (Q1 unmerged), so the site-guard flags it — apply Pass Q (or at least Q1) first, then this block.
- `_passu/gen_coverage.py` — the generator.
Verify: XML valid; diff vs live main = ONE appended hunk, +68 <url>, −0 removed; planted-positive (remove a
known loc → guard exit 1) fires on the proposed file. "dead locs removed" is NOT claimed — the count is 0.

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
