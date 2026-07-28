# PASS Q — madebymatt.uk SITE repo (mattroper1977.github.io)

Branch: **claude/pass-q-audit-c5tg3s** (NOT `pass-q-audit`)  ·  Base: **a80ae1a**
Scope: this repo only for WRITES. Sibling deployments (Lessons/, Games/, Matt-s-Apps-/) are separate repos;
read-only reads via raw.githubusercontent.com were used to close cross-surface questions.

**RENAME / LETTER:** template targets `MattRoper1977/Lessons`; this session opened at the *site* repo.
No prior "Pass Q" ledger existed here → kept the letter Q. **Q is now SPENT on the site repo. The Lessons
sweep takes a fresh letter.**

## COMMIT CHAIN
- Q1  7c45479  sitemap coverage (/medevac/) — 1 file — rollback a80ae1a
- Q1b <pending> sitemap lastmod correction — 1 file — rollback 7c45479   (fixes reviewer correction #2)
- report commit (this file + PLAN.md) — own commit

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

## TIER 2 — MEASURED / DESIGNED, NEEDS MATT (not committed; nothing deleted or redirected this pass)

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
