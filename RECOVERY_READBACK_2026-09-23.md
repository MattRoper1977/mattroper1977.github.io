# RECOVERY READBACK — 2026-09-23

Cold start on a new account. The overnight
session (`01Grmg9b`) ran out of credits.
Everything below was re-read from the
repos, PRs and CI runs. Nothing is from
memory. Times are UTC.

Read at ~08:45Z. Mains via `git ls-remote`.

---

## HEADLINE

- Items 1, 2 and 3: DONE.
- Item 4, batch 1: DONE, fully folded
  and published. Its STOP-SIGN table
  met the pre-signature (0 exceptions).
- The dead session got no further than
  that. Nothing is half-merged.
- What it did NOT write: the S06 ledger
  entry and the HANDOFF update for
  batch 1. This readback covers them.
- Next: D3 (row 48), then W9L1, then
  batch 2. All three are ruled.
- Item 5 (HUM-T P1 re-cut): not started.

---

## THE MAINS

Lessons
`e763a398702dc2eb2c2f14f6a89e8765f59c6bdd`
(#664, pure carrier). GREEN.
- Publication 35834505142: success
- Teaching packs 35835618422: success
- Watch main 35836262074: success
  (its 4 earlier reds at 08:10–08:15
  fired while runs were still going;
  the last verdict is PASS)

Site
`5251edc87e823275c42cea687ab29aa24f5430c1`
(#438, EQUAL window). GREEN except the
KNOWN red:
- Published Education completion
  35834455992: FAIL. Same cause as
  before: its Lessons pin `b54c9006`
  predates the 17 Build Spring/Summer
  decks. Re-read in this run's log.
  Needs your ruling to move (unchanged).
- Education publication 35833504734,
  Domain split 35833504729, live
  verification 35834455930: success.

Apps
`afbd0add358fb6385133c56c470c6450413cf04f`
(#178). GREEN.
- Publication 35834500947: success
- Verify OS 35835143691: success

Games `909c29c2` (17 Sep). Untouched
overnight. See FINDING F5.

Games- `803e3bca` (16 Jul). Untouched.

Gate copies byte-identical on both
mains: gate `6f86786c7459`.
Lessons carrier: `uses:` and
`builder_ref` = Site `5251edc8`.

---

## OVERNIGHT LIST — STATUS

### 1. #434 → carrier pair → publication
DONE.
- Site #434 → `dd9831f3` (22 Sep 23:43)
- Apps #173 → `1c3238dc`
- Lessons #656 → `dda76aa4`
- Publication 35802172279: success
- Ledger: S03

### 2. Limbs PR
DONE.
- Lessons #658 → `e6f7fcc6` (02:31)
- Apps #174 → `d9b9966f`
- Publication 35810675683: success
- W9L1 out of HELD, fence re-pinned,
  three records pinned.
- Ledger: S04

### 3. S3 tool
DONE.
- Lessons #660 → `d8acf3ac` (03:25)
- Apps #175 → `b694ffad`
- Publication 35814262000: success
- One live-origin 503, re-run once as
  pre-granted: 35815033808 (1 and 2)
- Ledger: S05

### 4. PASS C Autumn 2
Batch 1 (11 decks): DONE.
- Site #435 → `7be9a2b4` (window)
- Site #436 → `c85c12c3` (re-cut after
  the adversarial review)
- Apps #176 → `96d1ef19`
- Lessons #662 → `be82fe86` (05:46)
- Publication 35823783961: success

Hub follow-on (route C): DONE.
- Site #437 → `0fa71565` (EQUAL + the
  hub's 3 pairs)
- Apps #177 → `3b90f1a8`
- Lessons #663 → `3560dc0e` (07:01)
- Publication 35829540162: success

Fold closed: DONE.
- Site #438 → `5251edc8` (EQUAL)
- Apps #178 → `afbd0add`
- Lessons #664 → `e763a398` (07:58),
  pure carrier (2 files, carrier +
  its caller digest)
- Publication 35834505142: success

Batch 2: NOT STARTED.
- No branch, no PR, no draft on origin.
- Gated by your earlier ruling: D3
  (row 48) lands first, then W9L1.

### 5. HUM-T P1 re-cut (24 decks)
NOT STARTED.

---

## STOP-SIGN TABLES OVERNIGHT

One table: batch 1, in the PR #662 body.
- 11 rows
- TERM+WEEK UNCHANGED: 11/11 YES
- evidence sha == bytes: 11/11
- row 45 == derived: 11/11 (64 panels)
- shell-by-DOM: 11/11 PASS
- exceptions: EMPTY
- identity-only rows: none (limb was
  token on 5, explicit cell on 6)

It MET the pre-signature. It was merged
under it, correctly.

---

## FINDINGS (handoff vs reality)

F1. HANDOFF_CURRENT is stale by 3 PRs
per repo. It stops at item 3 (S05,
~03:50). It says Site #435 is open. It
is merged, and so are #436–#438,
Lessons #662–#664 and Apps #176–#178.
Fixed now: HANDOFF rewritten.

F2. No S06 ledger entry for batch 1.
The evidence lives in PR #662's body
and in the run ids above. The owed
ledger entry is listed, not invented.

F3. The dead session's scratchpad is
gone. Its drafts are lost:
- `wt/d3` (D3, row 48)
- `wt/w9l1` (W9L1 channel fix)
- `wt/site-sw` (serve-witness line 31)
None of them reached origin. Each gets
rebuilt from its ruling. Nothing to
tidy.

F4. PR #662 says "the ledger cites a
non-existent flag; that is corrected
in the docs PR". That docs PR never
happened. The citation is still there:
`_sx3/SX3_PASSES_LEDGER.md:1703`
(`build_science_hub.py --check`).
OWED.

F5. Games: a red NOT in the handoff.
- The scheduled "Pin release" workflow
  has FAILED on every run since at
  least 21 Sep (runs 71–78, latest
  35819348489).
- Cause: the PRs it opens (#100
  lessons, #102 site) get
  `action_required` on their checks,
  so they are never "full green" and
  it fails on purpose.
- It predates the overnight run, and
  the order never touches Games.
- I have NOT stopped on it and have
  NOT touched it. Your call.

F6. No drift left behind:
- worktrees clean, no stashes, no
  unpushed branches in any repo
- working branches tree-equal to main
- pins `--check` PASS (gate 6f86786c)
- PIN1 PASS (1060 asserted)
- evidence re-stamp `--check` PASS
  (893 entries)
- lesson-order `--check` PASS
- chassis census PASS (25 conforming)
- resource sizes PASS
- SHA256SUMS: overnight moved stale
  rows from 170 to 145 (it fixed 25,
  added 0). The 145 are the old D-1
  stale rows, not new drift.

F7. No run is in progress or queued
in any repo. Nothing to wait for.

---

## HELD (unchanged, still held)

- Held A/B, parked C, 5 GROW `_Do`
  → `_sx3/HELD.md`
- 15 LAUNCH print
  → `_sx3/HELD.md`
- SCI_G_W16B (title-stage claim)
  → `_sci/WEEK_TOKEN_DISAGREEMENTS.md`
- 2 case-study decks → `_sci/HELD.md`
- 51 unscoped Science decks
  → `_sx3/handoff_2026-09-22/`
    `artefacts/SCI_51.md`
- SCI_B_W12 (R-GAPS)
  → `_sx3/RELEASE_LEDGER.md`
- GPT work: 0 items found so far.

---

## OWED TO YOU (unchanged, plus new)

1. NOAA 2025 value (never estimated).
2. 390 px served proof, Summer 1 x3.
3. Site completion-verify pin: a ruling
   to declare it EQUAL.
4. Limbs questions (HELD.md feeding the
   re-stamp; CI self-tests; identity-
   only rows; style restoration).
5. From batch 1 (#662), recorded:
   - Space on a loop summary moves the
     slide (92 Science decks).
   - 4 of 64 quotes are not the task.
   - 13 Humanities SU1 decks, header-led
     VOICE; 80 carry " ¹3". Do they join
     the P1 re-cut?
6. LW-1 inputs: held in the old
   container, now GONE. Please re-send
   JOB_1 and JOB_2; the hashes in the
   HANDOFF verify the copies.
7. NEW: F5 (Games Pin release red).

---

## NEXT

D3: the row-48 "unbounded modelling"
check in `verify_loop`, own small PR,
rebuilt from your ruling. Then W9L1.
Then batch 2.

---

## PHONE CHECKS

Science hub:
https://madebymatt.uk/Lessons/Science_Teesside/index.html

A batch-1 deck (Launch W14 L1):
https://madebymatt.uk/Lessons/Science_Teesside/Launch/W14-W15_2026-27/SCI_L_W14L1_Genetic_Condition_Research_Introduce.html

A batch-1 Classic (Grow W9):
https://madebymatt.uk/Lessons/Science_Teesside/Grow/W8-W13_2026-27/SCI_G_W9_Turn_Earth_explain_the_sky_Classic.html

The batch-1 PR and its table:
https://github.com/MattRoper1977/Lessons/pull/662

The last publication:
https://github.com/MattRoper1977/Lessons/actions/runs/35834505142

The known Site red:
https://github.com/MattRoper1977/mattroper1977.github.io/actions/runs/35834455992

The Games red (F5):
https://github.com/MattRoper1977/Games/actions/runs/35819348489

(This container cannot reach the live
host: a LIMIT, not a pass. The served
bytes were proved source-side by the
publication runs.)
