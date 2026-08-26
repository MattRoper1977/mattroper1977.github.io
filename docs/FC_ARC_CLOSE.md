# The FC arc — close record

**2026-08-26. ORDER FC-XC2.** Closes the arc that ran FC → FC-R → FC-Z → FC-X.

**Provenance rule, binding on every line below.** No SHA, PR number or count
appears here unless the command that produced it ran in the session that wrote
this file, and the command is printed beside it. Anything that could not be
produced that way is written `UNRESOLVED`, never as a number that looks right.

---

## Why this record exists at all

A prior pass, **ORDER FC-XC**, was commissioned to write this file and returned an
"EXECUTED" report. Its readback contradicted itself: it asserted the site pin
`cb435f4` held with zero tip movement, *and* that `c707277` — a commit made after
`cb435f4` — was on main and merged. Both cannot be true. Its arc record gave
`FC 7e4a11b`, `FC-R a19f02c`, `FC-Z d83e102`; none of those appears anywhere in
the arc.

**Status of that report: QUARANTINED, and it has no locatable repository object.**
Searched for and not found:

```
git log --all --oneline -- docs/FC_ARC_CLOSE.md      -> 0 commits
git ls-remote origin 'refs/heads/*' | grep -i fcxc    -> no branch
GET /repos/.../pulls?state=all (most recent 8)        -> newest is #191; no FC-XC PR
```

So there is nothing on any branch to annotate in place, and nothing is imported
into main in order to annotate it. This paragraph is the quarantine note, and it
references the report by the only identifier that exists: its name.

---

## §0.1 — The pin contradiction, ruled

Three instruments, adopting neither of FC-XC's claims:

```
[1] git ls-remote origin refs/heads/main
    -> cb435f4bbdbdc1f45096bf4623464409c166b9fc

[2] git merge-base --is-ancestor c707277 cb435f4bbdbdc1f45096bf4623464409c166b9fc
    -> exit status 1        (0 = is an ancestor; 1 = is not)

[3] GET /repos/MattRoper1977/mattroper1977.github.io/commits/c707277…/pulls
    -> PR 191 · state open · head claude/fcz-mirror-catchup
       head SHA c707277fae02946e26709863359380238fbabbfa
       merged_at None · merge_commit_sha fabc27152a9e102b0e856249623e0ce86339ea8a
```

### **RULING: `MAIN AT cb435f4 — c707277 NOT MERGED`**

**The trap that most likely produced FC-XC's contradiction, named so it is not
repeated.** Instrument 3 returns a `merge_commit_sha` for #191 — `fabc2715…` —
while `merged_at` is `null`. On an *open* pull request that field is GitHub's
ephemeral **test-merge** commit, recomputed as the head or base moves. It is not
evidence of a merge and it is not a landing. Read alone it says "there is a merge
commit for this"; read with `merged_at` it says the opposite. A record built on
the first reading produces exactly FC-XC's sentence.

Proved for this exact pull request rather than asserted as a general property:

```
git ls-remote origin refs/pull/191/merge
    -> fabc27152a9e102b0e856249623e0ce86339ea8a      <- identical to merge_commit_sha
git cat-file -t fabc27152a9e102b0e856249623e0ce86339ea8a
    -> fatal: could not get object info              <- not reachable without fetching that ref
```

The value the API offers as `merge_commit_sha` is byte-for-byte the test-merge
ref, and it is not an ancestor of anything in main. Earlier in the arc, when
#191's head was `7d6f9e4edeffb7f2ab4f7c343aa30046a318c33b`
(`git rev-parse 7d6f9e4^{commit}`; present once in `git log cb435f4..c707277`),
the same field held a *different* value — it moves with the head, which is what an
ephemeral commit does and what a landing never does.

**§0.1c** — main has *not* moved, so measurements taken on it are not void on
that ground. The live-mirror workflow was nevertheless re-read at the true tip:

```
git show cb435f4:.github/workflows/agx1-live-verify.yml | sha256sum
    -> 50702afefaff149767ec77b88440554c4b363d350943c6b6c412bf7b2d6ce6b3   20,047 B
```

Byte-identical to the before-image. The tree it was read at: site main
`cb435f4bbdbdc1f45096bf4623464409c166b9fc`.

**§0.1d — the other two pins**

```
git ls-remote https://github.com/MattRoper1977/Games   refs/heads/main
    -> 43b29f79231115740abc9ffc3c2bee64743aa8d8
git ls-remote https://github.com/MattRoper1977/Lessons refs/heads/main
    -> 288f84543ccef2884de62e6002b4b814360249c1
```

All three pins hold.

---

## §0.2 — The click gate

| tree | SHA |
|---|---|
| `MAIN_TIP` | `cb435f4bbdbdc1f45096bf4623464409c166b9fc` |
| `CLICK_BASE` | `c707277fae02946e26709863359380238fbabbfa` |
| `CI_HEAD` (#191 head, open) | `c707277fae02946e26709863359380238fbabbfa` |

`CLICK_BASE` and `CI_HEAD` are the **same commit** — #191's head has not moved
since FC-X — so the click-owned delta is empty by construction.
`git merge-base --is-ancestor CLICK_BASE CI_HEAD` → exit `0`; `CLICK_BASE` appears
once in `git log MAIN_TIP..CI_HEAD` (6 commits).

**§0.2a — artefact paths proved before the gate was built on them.** A gate built
on a wrong filename fails open and looks exactly like `NOT-DONE`:

```
git cat-file -e c707277:<path>
  EXISTS  .github/workflows/agx1-live-verify.yml
  EXISTS  tools/render_games_manifest_mirror.py
  EXISTS  data/source-manifests/games.json
  EXISTS  docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md
```

**Hashes**

| file | tree | sha256 | bytes |
|---|---|---|---|
| `agx1-live-verify.yml` | `MAIN_TIP` | `50702afefaff149767ec77b88440554c4b363d350943c6b6c412bf7b2d6ce6b3` | 20,047 |
| `agx1-live-verify.yml` | `CLICK_BASE` | `ebf9b5ef3b1fd094321931a57040f1d846d14693817333582f2defeed915ee0a` | 25,846 |
| `agx1-live-verify.yml` | `CI_HEAD` | `ebf9b5ef3b1fd094321931a57040f1d846d14693817333582f2defeed915ee0a` | 25,846 |
| `render_games_manifest_mirror.py` | `CLICK_BASE` | `f1745dd251ec91d1dbf7588cb224413bd4d45ae242588e03e72f1cfc0211166f` | 3,668 |
| `render_games_manifest_mirror.py` | `CI_HEAD` | `f1745dd251ec91d1dbf7588cb224413bd4d45ae242588e03e72f1cfc0211166f` | 3,668 |

`MAIN_WORKFLOW=BEFORE-IMAGE`. The gap between `MAIN_TIP` and `CLICK_BASE` is
§X4's already-legitimate report-only search-index leg, **not** a click change —
which is exactly why the gate is derived from `CLICK_BASE..CI_HEAD` and not from
a main-vs-head hash.

At `CI_HEAD` the mirror step still reads, at line 368:

```
if cmp -s /tmp/canonical.json data/source-manifests/games.json; then
```

— main's copy, because step 1 checks out `ref: main`. And the companion docstring
in `render_games_manifest_mirror.py` still carries the stale claim at line 26
("canonical against the committed mirror on every pull request").

### **CLICK_EFFECTIVE = NOT-DONE**

`CLICK_DECISION=APPROVE-PATCH` records that the recorded Option-B fix is the
chosen route. It is **not** evidence that the fix has reached the candidate tree.
The two are separate on purpose, and this record keeps them separate.

Consequently **§3 (#191 pickup) = SKIPPED-BY-GATE.** No scratch PR was opened, no
dry-run, no staging, no mutation of #191. Proof of why, printed rather than
asserted: `agx1-live-verify.yml` at `CI_HEAD` is `ebf9b5ef…`, 25,846 B —
unchanged from `CLICK_BASE`.

This order committed no workflow file, sought no second route to the write the
permission classifier once blocked, demoted nothing, and made no advisory context
required.

---

## §1.3 — The negative control, run before any row was trusted

A checker that never reaches its input proves nothing and looks exactly like a
pass. So the checker was exercised at **both** of its steps.

```
positive leg   a23cbc8 vs PR #188   -> PROVEN     (the checker reaches its input)
negative leg   7e4a11b vs PR #188   -> UNRESOLVED (does not resolve — step 1 rejects)
extra leg      f5ebbd5 vs PR #188   -> REJECTED   (resolves, wrong commit — step 2 rejects)
```

The extra leg was added because the supplied negative value `7e4a11b` fails at
*resolution*, which leaves the **comparison** step untested. `f5ebbd5` is a real
commit — PR #189's landing — so putting it against #188 exercises the comparison
itself. Without it, step 2 could have accepted anything.

---

## §1.2 — The arc, rebuilt from git

Every row proved by its own row class. Landing rows: the SHA resolves **and** is
exactly the named PR's merge commit. Instruments:
`git rev-parse <short>^{commit}` and `GET /repos/<slug>/pulls/<n>`.

| stage | what it was | landing | PR | verdict |
|---|---|---|---|---|
| **FC** | the `/for/` copy pass | `a23cbc852033f40cdba1589d2e82352f953c8dd4` | site **#188**, merged `2026-08-26T12:48:14Z` | **PROVEN** |
| **FC-R** | residue clearance | `f5ebbd58d7f343a1b7eb045d49d256346f767ac3` | site **#189**, merged `13:47:49Z` | **PROVEN** |
| **FC-Z §Z2** | exclude the class | `cb435f4bbdbdc1f45096bf4623464409c166b9fc` | site **#190**, merged `14:27:20Z` | **PROVEN** |
| **FC-Z §Z3** | the six descriptions | `43b29f79231115740abc9ffc3c2bee64743aa8d8` | Games **#41**, merged `14:30:41Z` | **PROVEN** |
| **FC-Z §Z1** | C4 closed as a false positive | `288f84543ccef2884de62e6002b4b814360249c1` | Lessons **#161**, merged `14:49:26Z` | **PROVEN** |
| **FC-Z §Z4** | Section 19 | *no landing commit, by design* | evidence in #188 | **HALTED — PROVEN** |
| **FC-X** | close + §X4 | `c707277fae02946e26709863359380238fbabbfa` | site **#191**, **open**, unmerged | **PROVEN** |

**Zero rows UNRESOLVED.**

**The FC row is proven twice over, in the derive direction.** Rather than trust
the supplied PR number, the API was asked which pull request the commit belongs
to:

```
GET /repos/.../commits/a23cbc8/pulls
    -> PR 188 (closed, merged_at 2026-08-26T12:48:14Z)
```

The API names #188 independently. The supplied number and the derived number
agree.

**The #188 dependency, declared.** Two rows rest on #188 for different facts —
FC's landing provenance, and §Z4's halt evidence. They are independent
verifications and neither is inferred from the other. §Z4's evidence was checked
directly: PR #188's body contains the exact phrase **"Written, then withdrawn"**
(`GET /repos/.../pulls/188` → `body` contains phrase: `True`). No §Z4 landing SHA
is invented; there is deliberately none to invent.

**The FC-X row is verified as an open state, not a merge.** `c707277` resolves,
is associated with #191, and #191 reports `merged_at: None`. §0.1's instrument 2
supplies the ancestry ruling: it is not in main's history.

---

## §1.4 — What the arc actually did

**FC** was the `/for/` audience-copy pass. Internal QA vocabulary was removed from
reader-facing pages, the parents FAQ was rewritten around the questions parents
actually arrive with, and **five of twelve premises died on measurement** — the
audit pack's claims did not reproduce. Not "initial pathway sync". Its governing
sentence was *fix the phrasing, never the posture*.

**FC-R** was residue clearance, and it **halted twice on evidence**: the Lessons
C4 record turned out to sit in **four** files rather than three, and Section 19
appeared on **zero** measured pages, which would have made the proposed allowlist
empty and therefore `MEASUREMENT INVALID`. Games went **proposal-only**. FC-R also
established that the pathway defect was live, reporting **eight** affected arcade
records — Biopunk Hive under `GROW`, seven more under `BUILD` — and noting that FC
had come one word from adding a ninth and tenth.

**The count, derived in this session rather than carried forward.** The order that
commissioned this record struck "nine" as unattested. It is attested — it is PR
#190's own title — but the right response to "do not carry a number forward" is to
measure it, so it was measured, per-record and by id:

```
git show f5ebbd5:data/mbm-search-index.json   (immediate pre-#190 main)
git show cb435f4:data/mbm-search-index.json   (PR #190's landing)

records whose pathway changed : 9
  LOST a pathway facet         : 9
  GAINED a pathway facet       : 0
totals with any pathway        : 558 -> 549
non-vacuity: 64 game-class records; 9 carried a teaching pathway before, 0 after
```

The nine, named:

| record | lost |
|---|---|
| `game-biopunkhive` | `GROW` |
| `game-voxel-frontier` | `BUILD` |
| `game-games-voxel-frontier` | `BUILD` |
| `game-apex-tennis` · `game-auroralinks` · `game-global-games-championship-simulator` · `game-lessons-games-lumins-html` · `game-lessons-games-the-last-lighthouse-v1-1-…` · `game-neonbreach` | `BUILD` |

Two `Voxel Frontier` records, which is the ninth FC-R's sweep had not reached.

**The sequence, written as the operative units rather than as a running count:**
**eight reported by FC-R** · **class-scoped exclusion by Z-D2**, superseding the ID
count as the operative unit — a class rule catches the ninth and tenth without
anyone enumerating them · **zero as served**, live-verified by §X4.

*A note on the correction itself.* The pass sent to strip invented numbers
arrived carrying a mis-strike: it removed a figure that was real, while its own
§3 cited "the 558 → 549 loss" — a delta of exactly nine. The figure survives
because it was re-derived, not because it was defended. Register line 14 in both
directions: a correction inherits the bias it is correcting, and over-correction
is a bias too.

**FC-Z** supplied the rulings FC-R's halts waited on.

| ruling | what it says |
|---|---|
| **Z-D1** | Lessons: **four files, two instruments** — each C4 record stamped in its own vocabulary, the ledger block kept byte-identical with the closure annotated beneath |
| **Z-D2** | exclude the **class**, not the instances |
| **Z-D3** | apply Games #41 **after** §Z2 lands |
| **Z-D4** | Section 19 **halted** → later closed permanently |
| **Z-D5** | takes **report-only**, not swappable by any agent |

Z-D1 is the four-files ruling. It is **not** the permission-classifier halt — that
belongs in FC-Z's narrative, not to a ruling number.

**FC-X** cleared what it could either side of the click. Adversarial review found
the deadlocked check was not merely stuck but **blind**: reading main meant a pull
request that *corrupts* or *deletes* the mirror passed it. One sanctioned
loosening in the proposed fix, three tightenings. **§X4** closed the
production-verification hole and changed an answer: 717 records served, 64 arcade
games, **zero** carrying a teaching pathway, **as served**. **§X5**'s red-proof
failed on its first attempt and was registered — the mutation went to the working
tree while the pin reads the committed blob.

**§1.5 — corrected, not erased.** FC-Z's close record keeps its superseded
sentence as written history with the live verification annotated beneath it
(`docs/MBM_FCZ_CLOSE_RECORD.md`, line 297, marked *"Annotation 2026-08-26 — ORDER
FC-X §X4 … SUPERSEDED, and the section is retained unaltered"*; the superseded
phrase is still present above it). Verified, not redone. Same discipline the
Lessons ledger got under Z-D1.

---

## §2 — CI at the close

Availability was established fresh, not inherited. **Actions had recovered**: FC-X
recorded that no run was being created for this branch, and runs for `CI_HEAD`
were subsequently created at `2026-08-26T16:13:42Z`.

**§2.2 — `CI_HEAD` = `c707277fae02946e26709863359380238fbabbfa`: COMPLETED-RED.**
7 runs, all completed — 6 success, 1 failure.

```
GET /repos/.../actions/runs/32987276912/jobs
  job  Fetch the live estate and compare to raw-at-SHA   -> failure
  step #13  Shelf mirror equals the served canonical, byte for byte   -> failure
```

**§2.3 — the `08117f4` comparison, with the run id proved to belong to it first.**

```
GET /repos/.../actions/runs/32983462627
  head_sha 08117f47f0c871ca112def28110b978aa21d9542   -> matches; the id survives
  job  Fetch the live estate and compare to raw-at-SHA   -> failure
  step #12  Shelf mirror equals the served canonical, byte for byte
```

7 runs at that head too, exactly 1 red, and it is that one — so the supplied id is
the whole story, not a convenient subset.

**Same or different: SAME.** Same job, same step, at both heads. The step *number*
moved from 12 to 13 only because §X4 inserted a leg before it; the name is
identical. Nothing here is fixed: this is the deadlocked required context, and it
is `DEFERRED-RED` pending the click.

---

## §1.6 — The register

1. a relayed finding is a hypothesis — including your own handback list
2. a control that fires on legitimate content is not a control
3. a fix that breaks more than it repairs is a finding, not a fix
4. a scan that cannot discriminate reports UNDETERMINED, never 0
5. choose the instrument per token, not per scan
6. an instrument can be contaminated by what it is measuring
7. a control that fires on every PR is a deadlock, not a control — repair the comparison basis, never the requirement
8. a production check that never fetches the artefact that changed is not production verification
9. a halt can become a ruling — not every stop is a debt to be repaid next pass
10. a control that does not reach the instrument's input proves nothing and looks exactly like a pass
11. a pin check and a location claim that contradict each other void every measurement taken between them
12. a plausible SHA is the most dangerous kind of wrong — hex reads as evidence; require the command that produced it
13. an approval is not a completion — a decision recorded in a config block answers which route, never whether it happened; keep the decision and the state in separate variables or the first will be read as evidence of the second
14. a correction inherits the bias it is correcting — the pass sent to strip invented numbers arrived carrying one; run the correction's own claims through the correction's own instrument

**15, earned by this pass.** *A field that exists is not a fact that happened.*
An open pull request carries a populated `merge_commit_sha` — the ephemeral
test-merge — while `merged_at` is null. Read alone it asserts a landing that never
occurred. Where two fields together decide a state, quoting one of them is not a
measurement. This is the most likely mechanical origin of the contradiction this
record exists to resolve.

---

## §4 — Appendix, carried live

**Carry-forward discipline:** not executed here. Mutable counts, availability and
merge-state claims below are leads for their future pass, not measurements earned
in this one. Re-derive before acting.

- **A1 — tag backfill.** 641-row CSV, the ~30 he teaches from. Highest leverage. **Blocks A2 and A5.**
- **A2 — pupil card badges.** Design settled in Order S; blocked on A1; derivation binned at 12/20.
- **A3 — declared-fiction record**, standalone.
- **A4 — promote the search-index fetch from report-only to blocking.** Its own pass, never the pass that unwedges the job it lives on. Build in `curl -f`, a parses-as-JSON guard, and a deploy-lag tolerance.
- **A5 — whole-field classifier flip**, behind A1. Fail-closed when it lands: no field ⇒ no facet, never text-guessed.
- **B1 — two public ASDAN PDFs** still read "BUILD — an Award". Regeneration-day; no PDF generator exists.
- **B2 — the ASDAN withdrawal clock.** All Vocational Taster titles are being withdrawn; registrations and student books remain available until **31 December 2026**, final certification **31 August 2027**. **Hospitality** is on that Vocational Taster clock. **RoadWise Short Course** is separately being withdrawn on the same two dates. **Gardening Short Course** is currently listed as available and is *not* marked with that withdrawal notice. Review sources: `https://www.asdan.org.uk/courses/short-courses/` and `https://www.asdan.org.uk/courses/gardening-short-course/`. Re-check before any learner registration or certification decision, then check LAUNCH and PSHE dependencies. **Matt + Cheryl. Real learners, real money, nearest real deadline on this list.**
- **B3 — false 10-hour-rule cells** in the LAUNCH Autumn Year Plan workbook. Fixes drafted in `_passph3/JOB_A_REPORT.md`; verify whether applied.
- **C1** asymmetric `/for/` cross-link graph · **C2** teachers-page video facade claim (verify before rewording) · **C3** trusts page is least-worked · **C4** verify PH-3 #133/#168 merge state.
- **D1** UAS centre name + number (on-device, his) · **D2** eyeball tap-list · **D3** deferred Lessons/Apps rulesets.

**Removed permanently: the Section 19 statutory-citation exemption.** It does not
return here. If Matt writes the councils sentence, the exemption is built in that
same change and its three-way proof becomes possible for the first time — a
Matt-only item, not a backlog item.

---

## The handback — four items, no fifth

1. **The mirror leg.** The judgement call is already made: `CLICK_DECISION=APPROVE-PATCH`. §0.2 says `CLICK_EFFECTIVE=NOT-DONE`, so the remaining action is to place the verbatim recorded workflow patch, plus its meaning-locked docstring companion, on the **#191 candidate via the existing pull-request route** — never a push to main, never a rules bypass. The patch and the reasoning are in `docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md`.
2. **Annex A.** Are the four texts your own words, and are they meant as whole-take replacements? Until both answers land, takes stay report-only and the pin stays 17/17.
3. **B2 — the ASDAN clock and the RoadWise finding.** You and Cheryl.
4. **The Section 19 sentence**, if you want one.

---

## State at close

**HELD.** Predicted before the work, not discovered at the end: while
`CLICK_EFFECTIVE=NOT-DONE` the live-mirror leg reds every site pull request, and
that applies to the pull request carrying this record exactly as it applies to
#191. `MERGE=SELF-ON-GREEN` therefore cannot fire, and is not supposed to.
Landing the branch and the pull request is the deliverable.

Every §1.2 provenance row is resolved. No row is UNRESOLVED, and no SHA in this
file was written that was not produced by a command printed beside it.
