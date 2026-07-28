# PASS Q — madebymatt.uk SITE repo (mattroper1977.github.io)

Branch: **claude/pass-q-audit-c5tg3s** (NOT `pass-q-audit`)  ·  Base: **a80ae1a**
Scope: this repo only for WRITES. Sibling deployments (Lessons/, Games/, Matt-s-Apps-/) are separate repos;
read-only reads via raw.githubusercontent.com were used to close cross-surface questions.

**RENAME / LETTER:** template targets `MattRoper1977/Lessons`; this session opened at the *site* repo.
No prior "Pass Q" ledger existed here → kept the letter Q. **Q is now SPENT on the site repo. The Lessons
sweep takes a fresh letter.**

## COMMIT CHAIN
- Q1  7c45479  sitemap coverage (/medevac/) — 1 file — rollback a80ae1a
- Q1b 6116d0e  sitemap lastmod correction — 1 file — rollback 7c45479
- report c73f91f  findings + plan — 2 files — rollback 7c45479
- Q2  8d6b8e9  taxonomy canonicalise (Teacher) — 1 file — rollback 6116d0e
- Q3  e91ac61  Medevac unify (launcher + redirect stub) — 2 files — rollback 8d6b8e9
- Q4  74c5288  delete MedevacFrontier_v1.html — 1 file — rollback e91ac61
- Q5  48353e7  sitemap regenerate (site section only) — 1 file — rollback 74c5288
- Q6  <pending> #dxChips drift guard (script only; index.html untouched) — rollback 48353e7

## VERIFICATION HARNESSES (two independent signals per class; every zero replayed vs a planted-positive)
- Syntax: `node --check`, 17 inline blocks + 5 standalone JS. Planted-positive proven (bad.js → exit 1).
- Runtime: jsdom@22.1.0, window.onerror + error-event + uncaught + unhandledRejection capture, fetch
  stubbed to reject. TWO planted-positives proven (top-level throw + throw-in-listener → 2 errors each).
- XML: xml.dom.minidom parse. Cross-repo data: raw.githubusercontent.com (Lessons resources.json,
  pinned etag b228fbe8acb763471b709686c14f81a041e0f7c7edff341d22903062366c9bc2, 384 entries).

---

## TIER 1 — FIXED ON BRANCH

### Q1 · link-integrity / co-present-contradiction · sitemap.xml
- Evidence: `/medevac/` (medevac/index.html, 343KB, the v2 build) is featured in the homepage hero
  (site.json door #3) and medevac/README.md points play traffic to madebymatt.uk/medevac/, but the
  sitemap had ZERO medevac entries. Consequence: the flagship sim was invisible to crawlers/index.
- Fix: added one <url> block after asdan/, priority 0.8 / changefreq weekly (matching sibling sections).
- Signals: xml parses clean (395→396 locs); one /medevac/ loc AND target exists on disk. One 6-line hunk.

### Q1b · CORRECTION to Q1 (reviewer #2) · sitemap.xml lastmod was inherited
- Rabbit-check of Q1 against itself: the added block copied `<lastmod>2026-07-25</lastmod>` from the
  /games/ + /uas/ siblings — but medevac/index.html's ACTUAL last-commit date is **2026-07-19**. The
  entry therefore asserted a date about /medevac/ that isn't /medevac/'s — a true-looking half that can't
  hold, i.e. the estate's signature co-present-contradiction, introduced by the fix for it.
- Fix (Q1b commit): set /medevac/ lastmod to the real last-commit date 2026-07-19.
- Note (NOT fixed — out of scope, pre-existing at base): the sibling entries (/uas/ etc.) also carry the
  2026-07-25 authoring-date rather than their own git dates. That is the hand-maintained-sitemap drift
  problem itself — see SNAKE NOTE. Only my own introduced entry was corrected.

---

## Q2 — TAXONOMY CANONICALISED (FIXED, committed to branch)

**Reframe (reviewer round 3):** the taxonomy mismatch is the quieter, WORSE sibling of the Lessons-hub
chip-count bug. That one announced itself ("No matches"); this one returns 39 and 30 real results that
LOOK complete while silently excluding this repo's own flagships. An empty state gets reported by the first
user who hits it; a silently-incomplete state gets reported by nobody. Same rule violated (a control must
be computed through the chain it applies), but undetectable from outside — which is why it survived until
the two catalogues were cross-referenced.

### TAXONOMY-UNION TABLE (both catalogues, after the code's own norm; captured BEFORE editing)
```
TYPE                  Lessons  Site  MERGED     after rename
Activity                    0     1       1        1
Game                       30     0      30       30   (Simulation stays separate — deliberate)
Interactive lesson          0     2       2        2
Lesson                    263     0     263      263
Pupil                      12     0      12       12
Revision                    2     0       2        2
Simulation                  0     1       1        1
Support                    38     0      38       38
Teacher                    39     0      39       42   <- +3, the split facet collapsed
Teacher tool                0     3       3        0   <- removed
```
No stowaway synonyms elsewhere. Every merged type is non-empty → derived chip row is honest by construction.

### FIX 1 (data) — "Teacher tool" → "Teacher" in data/resources.json (co-present contradiction: one concept
spelled twice). Lessons is the catalogue of record (39 on "Teacher"), so the site's 3 entries (uas-register,
asdan-register, evidence-binder) rename INTO it. Surgical replace of `"type": "Teacher tool"` ×3; the
lowercase `"teacher tool"` TAGS (×2) were left untouched. JSON still valid, formatting byte-preserved.

### CONSUMERS OF THE `type` FIELD IN THIS REPO (enumerated before editing)
- LIVE: resources/index.html inline rx- code only. The rename ALIGNS the site entries into hooks that
  already key on "Teacher":
  · actLabel (line 171): site tools now get "OPEN TOOL →" (were falling through to default "OPEN →").
  · fmtIcons (line 169): site tools now get the interactive tab icon (had none).
  · card "kind" line (line 173, shown only when a filter/search is active): visible text
    "Teacher tool · Cross-curricular" → **"Teacher · Cross-curricular"** — the ONLY visible-text change.
    (Homepage tiles are hardcoded SVGs, not data-driven — no homepage text changes.)
- DORMANT: app.js is a second catalogue renderer that runs only `if($('#cards'))`; neither page that loads
  it (homepage, resources) has #cards (homepage=0; resources uses #rxOut). So its type-consuming code never
  executes → rename has no effect there. [Tier-3 dead-code note: app.js catalogue block is unmounted.]

### FIX 2 (control) — derivation, NOT a hardcoded chip list
resources/index.html ALREADY derives the type chip row + counts from the merged catalogue (chips(), lines
181-185) and applies them through the exact render() filter chain. FIX 1 makes that derivation honest: one
`Teacher (42)` chip instead of a split `Teacher (39)` + `Teacher tool (3)`. Simulation stays its own chip
(Medevac remains discoverable via the homepage `?q=simulation` quick-search — the deliberate sim/game
positioning). No hardcoded type enum was introduced or kept in the fixed path.
- Homepage #dxChips is a CURATED quick-filter nav (mixes subject/type/q), not a type-enum mirror. Post-rename
  its `?type=Teacher` link resolves to 42 (now incl. site tools) and `?type=Game` to 30. Residual, flagged:
  its two hardcoded type-VALUES ("Teacher","Game") mirror Lessons enum strings and would drift silently if
  Lessons renamed those types; deriving the curated row would sacrifice the curation → left as a noted
  design call for Matt, not changed here.

### INVARIANTS ASSERTED IN JSDOM (real render() chain, fetch stubbed to the two live catalogues)
- A: exactly one "Teacher" chip, count 42; NO "Teacher tool" chip.                                     PASS
- B: every derived type chip (Activity1/Game30/Interactive2/Lesson263/Pupil12/Revision2/Sim1/Support38/
     Teacher42) is non-empty.                                                                          PASS
- C: for every chip, chip-count == rendered .rx-cardx count == #rxCount text (counts match the chain).  PASS
- D: stacked-filter zero state (TYPE=Teacher + impossible query) → "Showing 0 of 391", clear-filters
     hatch present AND functional (click resets to 391).                                               PASS
- Runtime errors during the whole exercise: 0 (harness proven to catch throws in earlier passes).
Two signals: in-repo render()-chain assertion + the cross-repo pinned catalogue counts agree (42/30).

---

## Q3 — MEDEVAC UNIFIED ON /medevac/ (FIXED, committed; reviewer GO)

Two pupil-facing entry points to the same game served different builds; the catalogue path served the
older engine WITHOUT perfLite (worse on weak school devices). Unified on the v2 build /medevac/.

- FIX 1 · resources/medevac-frontier/index.html launcher: "Launch experience" anchor
  href `../../experiences/medevac-frontier/index.html` → `/medevac/` (the canonical URL; no query string
  is passed by this static launcher, so none to preserve).
- FIX 2 · experiences/medevac-frontier/index.html: the 317KB old build REPLACED by a redirect stub (NEVER
  a deletion — the URL still resolves 200, so every inbound bookmark/print-pack/zip link still lands).
  House style, single-file, offline-first, no CDN:
  · JS: `location.replace('/medevac/'+location.search+location.hash)` (query+hash preserved) with
    `location.href` catch fallback;
  · no-JS: `<meta http-equiv="refresh" content="0; url=/medevac/">` + `<link rel=canonical>`;
  · JS-stripped-by-school-filter: a VISIBLE, tappable "Medevac Frontier has moved →" link to /medevac/;
  · machine-readable marker `<!-- mbm:redirect-stub target="/medevac/" ... -->` for Q5's drift script.

### ACCEPTANCE TEST — a pupil's saved run survives the unify (proven LIVE, not just cited)
Booted the real medevac/index.html in jsdom (canvas 2D context stubbed, rAF no-op, AudioContext left
undefined so the game's `if(!AC) return` guard fires):
- POSITIVE: seeded mbm_medevac_v1 = {best:1234,bestMedal:gold,sound:true,streak:5} → after boot,
  mbm_medevac_v2 = {best:1234,bestMedal:"gold",sound:true,callsign:"ROOK",records:[],trainingDone:false,
  streak:5,v:2}. The v1→v2 migration (medevac/index.html:478-482) fired and carried progress forward.  PASS
- PLANTED-NEGATIVE: no v1 key → clean default v2 start, no write until a run, ZERO runtime errors.        PASS
- STUB: node --check clean; redirect expression evaluated → "/medevac/?class=7B#top" (query+hash kept);
  meta-refresh + canonical + visible link all present; marker present.                                    PASS
Two signals: live migration write (positive+negative) + static structural verification of the stub.

- sitemap: experiences/medevac-frontier/ is NOT in sitemap.xml (0 hits) — nothing to change here; Q5 owns
  sitemap policy regardless.

---

## Q4 — DELETED stale duplicate medevac/MedevacFrontier_v1.html (FIXED, committed; reviewer GO)

A 343KB second copy of medevac/index.html (2-line diff: MISSING the contact <footer>), unreferenced, with
its filename ("v1") contradicting its own <title> ("v2") — the co-present-contradiction defect class as a
standing exhibit. Deleted (git history is the undo).

### ZERO-REFERENCE PROOF — five scopes, each replayed against a KNOWN-PRESENT control (pinned by SHA, not etag)
```
corpus                              MedevacFrontier_v1   control (known-present)   any 'medevac'
site (mattroper1977.github.io)              0            index.html = 14                 —
Lessons        @ 32ca685e                   0            index.html = 16                 0
Games          @ 43bf1f8a (2 files)         0            html       =  2                 0
Matt-s-Apps-   @ 27d4e0ac (34 files)        0            html       = 32                 0
sitemap.xml                                 0                  —                         —
```
Each control is >0, proving the search is capable of returning non-zero IN THAT corpus. Repos cloned
read-only via add_repo (codeload/api are proxy-gated; raw single-file reads and add_repo are not a scope
breach for reads). Q2's cross-repo taxonomy signal re-pinned by SHA 32ca685e and reproduced exactly
(384 entries, Teacher 39, Game 30 — was etag b228fbe8 on raw main).

### DISTRIBUTION ZIPS / START_HERE HUBS — cleared by reviewer confirmation (recorded verbatim, 2026-07-28)
> "Both packs were built exclusively from Lessons-repo trees (the Art suite and Primary Science autumn),
>  and their generated indexes link only files inside each zip — no site-repo file was ever packed."
(So no dist-zip or START_HERE hub can reference a medevac/ site-repo file. Next audit closes this by reading.)

Two independent signals: (1) five-scope boundary-safe search = 0 with per-corpus replayed controls;
(2) the reviewer's provenance confirmation on the zips. medevac/index.html (the real v2 build) untouched.

---

## Q5 — SITEMAP: SITE-REPO SECTION REGENERATED FROM DISK (FIXED, committed)

The hand-maintained sitemap and the file tree are two copies of one truth; derivation replaces vigilance.
_passq/sitemap_regen.py regenerates ONLY the site-repo section from disk (root + top-level dirs with
index.html), lastmods from true last-commit dates, robots.txt Disallow honoured, redirect stubs excluded
via the `mbm:redirect-stub` marker. Existing order + changefreq/priority preserved.

- Diff shape (exactly as predicted, nothing outside it): +1 provenance comment, +6 lastmod corrections
  ( / resources tools games → 2026-07-27; uas → 2026-07-19; asdan → 2026-07-22 ); /medevac/ already
  2026-07-19 from Q1b. This IS the sibling drift I parked in Q1b, now fixed by derivation.
- Cross-repo section (from /Lessons/ onward, 83,841 bytes) is BYTE-IDENTICAL to base — proven by suffix
  comparison against `git show HEAD:sitemap.xml`.
- Provenance comment added at top of the generated section ("generated by _passq/sitemap_regen.py … do not
  hand-edit; cross-repo sections that follow are hand-maintained") — provenance, not a delivery-state claim.
  (_passq/ is Jekyll-ignored — no .nojekyll — so the committed tooling is not served.)
- Verify: XML valid (396 locs); drift guard exit 0; planted-positive (remove /medevac/) still exits 1.

### FULL-DOMAIN DRIFT — REPORTED ONLY (policy is the Lessons-pass letter's; cross-repo section NOT changed)
**CORRECTED in Q6 — the "70 dead" below was MY FALSE POSITIVE.** Checking all 389 cross-repo locs against
the pinned clones by comparing URL-ENCODED locs to decoded filesystem paths reported 70 dead + 118 missing.
Once the locs are URL-decoded (`urllib.parse.unquote`), every one resolves to a real file — verified by
ground-truth `ls` on samples like `…CO2 (1).html`. Real figures (decoded, mapped to serving tree):
- DEAD locs: **Lessons 0 · Games 0 · Matt-s-Apps- 0** (no integrity drift).
- Reverse coverage (html in tree, not individually sitemapped): Lessons 48 · Games 1 · Matt-s-Apps- 30 —
  largely the section-root convention for siblings; expanding it is Lessons-pass POLICY, not drift.
This over-report never reached the deployment (the cross-repo section was correctly left byte-untouched);
only the ledger claim was wrong, now retracted. Full mapped lists: _passq/CARRYFORWARD_drift.txt.
Root-cause lesson carried into U: decode before diffing a sitemap against a tree.

---

## Q6 — #dxChips DRIFT GUARD (FIXED — script only; index.html deliberately UNTOUCHED)

Principle: **derive the artefact when it's mechanical; derive the guard when it's curated.** Which two or
three doors sit at the front of the house is an editorial choice, so the chip VALUES stay hand-picked and
the DRIFT DETECTION is derived. `_passq/chips_check.py` (check-only, same pattern as the sitemap guard):
parses the hardcoded #dxChips values from index.html and resolves each through the EXACT merged-catalogue
render() chain (incl. the ALL.some() guard), red on any chip that returns empty OR silently no-ops (guard
not engaging = the silent-exclusion class this whole pass has been about).
- Real run (Lessons @32ca685e + site data): all 9 chips green — Primary Science 52, Humanities 32, Art 52,
  Games(type=Game) 30, Teacher tools(type=Teacher) 42, Physics(q) 19, Trekkers(q) 8, Simulation(q) 2.
- PLANTED-POSITIVE: scratch Lessons with type `game`→`arcade` → the Games chip goes RED ("guard did NOT
  engage → silently shows all 391"), exit 1. A guard that cannot fail is an unasked question; this one fails.

**STANDING OBLIGATION (write it where it will be re-read): any type rename in EITHER catalogue — this
repo's data/resources.json OR Lessons' resources.json — re-runs this guard before it ships.** The cross-repo
form of the four-surface agreement rule; how the silent-exclusion class stays dead after we stop looking.

---

## CLOSE-OUT — HANDOVER

### CLOSE STATE
Site-repo Pass Q complete. Six defect classes committed (Q1, Q1b, Q2, Q3, Q4, Q5, Q6 + one report commit),
one rollback SHA per commit. Nothing merged; branch claude/pass-q-audit-c5tg3s is Matt's to review/merge.
Tip SHA: derive with `git log -1 --format=%h` on the branch (this file does not assert its own delivery state).

### DEPLOY-VISIBLE CHANGE SET (everything a classroom could see)
- data/resources.json — 3 `type` values "Teacher tool" → "Teacher" (Q2)
- sitemap.xml — /medevac/ added (Q1) + lastmod correction (Q1b) + site-section regenerated from disk (Q5)
- resources/medevac-frontier/index.html — launcher "Launch experience" → /medevac/ (Q3)
- experiences/medevac-frontier/index.html — 317KB old build → redirect stub to /medevac/ (Q3)
- medevac/MedevacFrontier_v1.html — DELETED (Q4)
(Audit-only, Jekyll-ignored, not served: _passq/*.)

### POST-MERGE HUMAN CHECKLIST (Matt, after Pages rebuilds — these need a real browser)
(a) resources page → click the **Teacher** type chip → **UAS Register, ASDAN Register and Evidence Binder
    all appear** in the results (they were excluded before Q2).
(b) On a machine that holds Medevac **v1 progress** (localStorage `mbm_medevac_v1`), open Medevac by the
    **old catalogue route** (resources → Medevac Frontier → Launch experience) → the redirect lands on
    /medevac/ AND the **best score survives** (v1→v2 migration; proven in jsdom, confirm live).
(c) **/medevac/ plays** (the v2 build loads and runs).

### CARRY-FORWARD PACK for the Lessons letter → _passq/CARRYFORWARD_U.md
Taxonomy-union table · the decoded cross-repo coverage set mapped to serving tree (0 dead; reverse-coverage
48/1/30, policy) in _passq/CARRYFORWARD_drift.txt · the chip-guard standing obligation · the dormant app.js
catalogue renderer (a second copy of the render truth — prove-zero-refs then delete-or-derive under U, not
touched now). Letter **U** is reserved for the Lessons estate; do NOT start it from this session.

---

## SUPERSEDED — original T2-CHIP writeup (kept for the trail; resolved by Q2 above)

### T2-CHIP · homepage catalogue type-chips exclude this repo's own flagships (reviewer #3 — CLOSED on 2 signals)
- Signal 1 (in-repo): resources/index.html DOES read `type` off the query string (line 208 `pt=P.get('type')`,
  line 211 `if(pt&&ALL.some(r=>r.type===pt))TYPE=pt`). Chips are NOT dead-on-arrival; filter is EXACT
  match, guarded by ALL.some.
- Signal 2 (cross-repo read, Lessons catalogue @ pinned etag b228fbe8, 384 entries): after the code's own
  normLessons cap(), Lessons type facet = Game:30, Lesson:263, Pupil:12, Revision:2, Support:38, Teacher:39.
  Site facet (normSite, raw) = Teacher tool:3, Interactive lesson:2, Activity:1, Simulation:1.
  → `?type=Teacher` guard TRUE → shows 39 Lessons tools; the 3 SITE teacher tools (UAS, ASDAN, Evidence
    Binder = type "Teacher tool") are EXCLUDED.
  → `?type=Game` guard TRUE → shows 30 Lessons games; Medevac Frontier (type "Simulation") is EXCLUDED.
- So NOT the "empty chip / No matches" precedent — both chips return results. The defect is a TAXONOMY
  MISMATCH between the two merged catalogues: Lessons uses Teacher/Game/Lesson/Support/Pupil/Revision;
  the site uses Teacher tool/Simulation/Interactive lesson/Activity. On the resources page's own
  data-derived type chips this even surfaces "Teacher (39)" AND "Teacher tool (3)" as two separate facets.
- Pupil/teacher consequence: the homepage prominently features UAS, ASDAN and Medevac as flagships, yet
  its own "Teacher tools" and "Games" catalogue filters omit exactly those items.
- Tier: NOT a clean value correction (Medevac is legitimately a Simulation, not a Game — relabelling would
  be wrong; and changing "Teacher tool"→"Teacher" alters the visible card type label). A match-family
  filter changes what a chip does. → **Tier 2, Matt's call.**
- QUESTION FOR MATT: which taxonomy is canonical for the merged catalogue, and how should Simulation map
  to the "Games" chip (add a Simulation/Sims chip, or fold Sims into Games)? Recommended, lowest-risk:
  add a data-side `type` alignment for the 3 site teacher tools + a "Games & Sims" chip that matches
  {Game, Simulation}. Exact edits deferred pending your choice.

### T2-MEDEVAC-UNIFY · two builds of Medevac reach pupils; unify on /medevac/ (reviewer decision a)
- Two entry points: catalogue (data/resources.json → resources/medevac-frontier/index.html landing →
  "Launch experience" → experiences/medevac-frontier/index.html, 317KB, OLDER, **no perfLite**) vs
  homepage hero → /medevac/ (343KB, v2, HAS perfLite). diff = 636 chunks.
- Consequence: a pupil arriving via the catalogue gets an engine WITHOUT the performance-lite path — worse
  on a weak school device. Classroom outcome → act.
- GUARD #1 (storage keys) — MEASURED, redirect is SAFE: experiences/ SAVE_KEY='mbm_medevac_v1';
  /medevac/ SAVE_KEY='mbm_medevac_v2' AND medevac/index.html:478-482 explicitly reads mbm_medevac_v1 and
  carries best/bestMedal/sound/streak forward, then writes v2 ("carry v1 progress forward"). Shared
  settings keys mbm_cinematic + mbm_detail are identical in both builds. So a redirect orphans NO saved
  state. experiences/ holds nothing /medevac/ lacks (older feature set, subset).
- GUARD #2 (repo boundary) — CORRECTION to the review premise: the Lessons catalogue (pinned) references
  medevac NOWHERE (0 "medevac" strings). The Medevac catalogue entry + the launcher are BOTH in THIS repo
  (data/resources.json + resources/medevac-frontier/index.html). The unify is therefore an IN-REPO edit,
  not a Lessons-repo edit. No cross-boundary change required.
- STAGED EXACT EDITS (NOT executed this pass — awaiting your go-ahead per "nothing deleted/merged"):
  1. resources/medevac-frontier/index.html: the "Launch experience" anchor
     href="../../experiences/medevac-frontier/index.html"  →  href="/medevac/"
  2. experiences/medevac-frontier/index.html: replace with a redirect stub to /medevac/
     (meta refresh + canonical + JS location.replace), so existing inbound links to the old URL still land.
  (Result: one engine, one source of truth, zero dead inbound links.)

### T2-MEDEVAC-V1 · delete stale duplicate medevac/MedevacFrontier_v1.html (reviewer decision b)
- 343KB, differs from medevac/index.html by exactly 2 lines (MISSING the contact <footer>). Filename says
  "v1"; its own <title> says "MEDEVAC FRONTIER v2" — halves already drifted = the defect class as exhibit.
- Zero-reference proof (boundary-safe, replayed against a KNOWN-PRESENT control 'index.html'=14 refs so the
  search is proven capable of non-zero):
  · this repo: 0 refs  · sitemap.xml: 0  · Lessons catalogue (pinned): 0 (and no medevac refs at all).
- REMAINING for the deletion pass (access not available here): Games repo, Matt-s-Apps- repo, built
  distribution zips, START_HERE hubs — must each be proven 0 with the same replayed control before delete.
- Decision recorded: YES delete, own commit, rollback SHA named. **NOT executed this pass** (order of work
  ends at "report back; nothing deleted"). Queued for the deletion pass once the remaining scopes are proven.

---

## TIER 3 — REPORT ONLY
- resources.json is not in json.dumps(indent=1) form (round-trip not byte-stable). Only matters if edited;
  not edited. Informational.
- "28 studios" hardcoded ×3 (index.html, tools/index.html, next/apps.html) + "fifteen stages"/"ten Tutor
  Time decks" marketing counts — derive-don't-duplicate smell, but the truth lives in sibling repos and
  can't be derived here. Unverifiable from this repo → left as-is, not invented.
- Silent catch(e){} in uas/asdan app.html — defensive localStorage/JSON guards; legitimate offline-first
  pattern, not swallowing real failures.

---

## REFUSED / DELIBERATE (verified byte-identical to base — next audit closes these by reading)
- Cross-deployment refs resolve on the live domain, NOT in a repo crawl: /hud.js, /theme.js, /styles.css,
  /data/resources.json, and every Lessons/ , /Games/ , Matt-s-Apps-/ href (18 root-absolute + 25 cross-repo
  hits). site.json's doors confirm Lessons/ & Matt-s-Apps- are live subpaths. Do-not-"fix" ledger.
- JS-template href concatenations ('+encodeURI(r.url)+', 'Lessons/'+...) — filtered from crawl per ledger.
- /next/ absent from sitemap — CORRECT: robots.txt `Disallow: /next/` (concept previews). Enforced by the
  new drift guard as a rule, not by memory.
- theme.js reading-swatch label logic (recently changed) — do-not-fix ledger; boots clean.

## REDUCED MOTION — REPO-SCOPED (reviewer correction #1)
**In THIS repo only**, reduced motion is sound: every animated file is covered; no invisibility traps
(next/.stars i keeps base opacity:.7 under animation:none; asdan .stamp gates its opacity:0 keyframe behind
prefers-reduced-motion:no-preference). Medevac RM = game motion, out of scope. **This is NOT a statement
about the Lessons estate** — that corpus has its own measured RM census (≈69 files / 9 chassis with genuine
residue) and a scheduled remediation programme. A clean result in 21 site files is not coverage of a corpus
I did not read. A bucket label is not a measurement.

## SNAKE NOTE — sitemap drift guard (built; check-only; NOT run against the live file wholesale)
The hand-maintained 396-entry sitemap and the file tree are two copies of one truth; Q1 proves it already
drifted. Built `_passq/sitemap_check.py`: derives this-repo public section URLs from disk, honours
robots.txt Disallow (so /next/ excludes itself by rule), compares to sitemap.xml, exits non-zero on drift.
- check-only result on current tip: derived 7 = sitemap 7, **OK, exit 0**.
- planted-positive (remove /medevac/): **DRIFT detected, exit 1** — it would have caught Q1.
- Scope limit: it can only validate this repo's ~7 section URLs, not the 387 Lessons entries (different
  repo's disk). A full regenerator needs all repos' disks. Left as check-only; live file NOT regenerated
  (one class per commit; unreviewed).

## CLASSES MEASURED CLEAN (each zero replayed vs a planted-positive)
- JS syntax: 0/22.  Runtime (jsdom): 0/9 scripted pages.  Relative internal links: 0 dead.
- resources.json paths on disk: 3/3.  Schema: ids unique+slug-valid, no dup tags, enums consistent.
- RM invisibility traps (this repo): 0.  Dead CSS on churned homepage: 0 (.t-build/grow/launch via JS).
- localStorage keys: mbm_reading_theme / mbm_detail / mbm_cinematic / mbm_medevac_v1 / mbm_medevac_v2 /
  SAVE_KEY — no collisions; v1→v2 migration verified.
