# Findability, Top Picks, two Apex sports — close record

Four passes, one branch, two pull requests. Written so nobody has to re-derive
the two rulings or re-discover the declared exceptions.

*Recorded 23 August 2026. Branch `claude/mbm-findability-copy-picks-apex-m1wv23`
on `mattroper1977.github.io` (#172) and `Games` (#39). Nothing merged by the
author of this record.*

---

## What shipped

**P1 · findability.** Search was loaded on every audience page and shown on none.
The control now sits in the hero, in normal flow so it can neither occlude nor be
occluded, and the pupil page has one of its own — a local DOM filter over the
cards already on the page, with no fetch, no storage and no navigation. One fence
amendment, recorded in full at the time.

**P2 · five audience pages.** Four of the five opening blocks were the same three
lines, served verbatim to a trust director, a headteacher, a commissioning officer
and a provider. Both ends rewritten; a closing block added above the boundaries
note. The closing is editorial and carries no guard — every bounded claim, account,
privacy and relationship statement stays in `note_section()`, stated once, and a
gate asserts that per page.

**P3 · one name.** Seven spellings of the curation rail became one: *Made by
Matt's Top Picks*. The apostrophe is U+0027, measured from two censuses rather
than chosen.

**P4 · two games.** Apex Curl and Apex Velodrome published, uncurated by design —
no take, no rail slot, no badge — with the splash donor's skip-leak fixed first
and all six stamped games restamped.

**Closeout.** A drifting "511" deleted rather than updated; `safeForPupils` made
load-bearing; the wordmark cleared of the exit chip; `/olympics/` declared; and a
post-merge job that proves the merge against real production.

---

## The two rulings

### 1. The takes are not edited, and the gate does not adopt the edit

P3 was authorised to rename the rail heading. It also rewrote the line underneath
— Matt's own first-person sentence about his own curation — **and** edited
`tools/verify_games_audience_faces.py` so that gate expected the new sentence. It
went green.

**The revert stands.** The replacement is not restored, the original is not
improved, no other take is touched.

**The edit was the symptom; the gate adopting it was the defect.** A gate updated
to agree with the diff has stopped being evidence. `tools/verify_takes_pin.mjs`
now hashes the two regions carrying that voice — `var CURATION=[…]` and the
`#picks` section — resolves them from `git show HEAD:<path>` rather than the
working tree, and compares against `data/takes-pin.json`. It fails closed if the
blob cannot be read rather than falling back to the file.

Changing a take on purpose is still possible; it is now a deliberate two-part act
— change the words, update the pin — where the pin is a line in the diff a
reviewer has to accept.

### 2. The corrected card hues stay, and the games move to them

Two card hues would have read as one swatch on the shelf: Apex Velodrome against
Apex Tennis at ΔE00 22.90, and behind it Apex Curl against Hyperdraft at **9.43**.
Both corrected, measured with the rail gate's own CIEDE2000.

**Apex Curl aligned straight through** — `#00F0B4`, one `const ACCENT` and one
`--accent` CSS token. Every pairing improves; nothing regresses.

**Apex Velodrome is split, and that is not a shortcut.** Its card hue lands ΔE00
12.1 from `#ba8cff` and 16.0 from `#f48fb1`, two rivals the player must tell
themselves apart from. Across the full RGB cube **no accent-grade hue clears ΔE00
25 against both the nine-member Sports rail and that seven-colour rider set** —
the two constraint sets together consume the usable space. So the accent takes the
centripetal/overlay role and the riders keep their categorical palette. That also
unpicks a collision already present: `#5fb6ff` was doing double duty as both the
player's colour and the centripetal force colour.

**One thing the ruling assumed that the numbers do not support.** On the shelf card
the corrected hues are marginally *worse*, not better — and both fail the 3:1
non-text bar before and after, as do 42 of the 54 games. The card's left border is
a decorative identity band estate-wide. The correction was a distinctness fix; where
it genuinely improves contrast is in-game, on the dark surfaces, which is where the
accent carries its only text. Recorded as BACKLOG 5i rather than fixed.

---

## Declared exceptions

| what | why | where declared |
|---|---|---|
| `/olympics/` keeps its own splash | bespoke Olympic rings and torch on a different palette — design, not decay. Still leaks `keyup` and the pointer pair. | `tools/render_splash.py` `DECLARED_EXCEPTIONS`; BACKLOG 5b |
| `assets/brand/mbm-splash.js` may change | the immutable brand register is right to exist; this one path is the authorised donor | `tools/verify_professional_site.js` `DECLARED_BRAND_CHANGES` |
| Storage keys left unmigrated | no key holding a child's progress was renamed. Both new games' keys were minted with this pass, so there is nothing to migrate; existing keys were not touched. | `verify_apexcurl.mjs` / `verify_apexvelodrome.mjs` assert the declared key set |
| Velodrome's riders keep `#5fb6ff` | measured: no single hue serves both the shelf rail and the rider palette | `tools/verify_accent_parity.mjs`, and beside the token in the game |
| `next/*` is not a served surface | staging; carries counts and a retired spelling that never reaches a reader | established during the count sweep |

---

## Backlog, with a reason against each

| # | item | why not now |
|---|---|---|
| 5a | four gates query selectors for removed features | each needs a decision about what the assertion becomes; inventing a selector is how the drift started |
| 5b | `/olympics/` keyup + pointer leak | stamping it would replace bespoke artwork — a design decision |
| 5c | scoreboard behind the HUD panels | the fix is presentational but proving it did not reach the sim is its own work |
| 5d | three typed counts on `/main/`, `/tools/`, `/asdan/` | three separate editorial decisions; the count that was actually wrong is fixed |
| 5e | the parents closing has no anchor | needs one more authorised line; copy is not invented here |
| 5f | sitemap coverage gates games, not pages | needs a ruling on what "public page" means |
| 5g | ten more gates could adopt their own change | three are backstopped by the takes pin; pinning seven more regions is its own pass |
| 5h | `verify_stats_claim.mjs` is wired to nothing | wiring it means owning whatever it then reports |
| 5i | 42 of 54 shelf hues miss 3:1 on the card | systemic, and arguably out of scope for 1.4.11 — a shelf-wide design ruling |

---

## Definition of done

| clause | met | evidence |
|---|---|---|
| P2 copy live on all five pages | **yes** | five closings and five rewritten section heads served; pupils and teachers byte-identical |
| Top Picks name canonical everywhere | **yes** | canonical on both surfaces that carry it; zero retired spellings in served HTML |
| both games serve splash, exit, reduced motion | **yes** | one stamped splash and one stamped exit region each; `prefers-reduced-motion` honoured |
| both findable in site search and pupil search | **yes** | one index entry each, `safeForPupils: true`, one pupil card each |
| no gate reporting a vacuous green | **yes** | every gate added or repaired here refuses a zero match. The clause was held at *partly* because `verify_stats_claim.mjs` ran in no workflow; it is wired now, red-proved on the assertion it names, and 5h is closed. The census that closed it found three more gates that never run — **BACKLOG 5j**, recorded not started, and one of them is red today. |
| nothing left in `/tmp` | **yes** | `/tmp/p2` removed after proving byte-identity with `.rescue/p2/` on the pushed rescue branch |

---

## The G pass — 24 August 2026

Neither PR was merged when this pass ran, so the post-merge reds were not read
off. Predicting them is not a result, and they stay unclaimed.

### The gate that never ran was a privacy gate, not a count gate

The hypothesis on record was that `verify_stats_claim.mjs` should have caught the
stale "511 canonical internal destinations" and could not, because nothing
invoked it. **That hypothesis is false.** It has nothing to do with counts. It
binds `/stats/`'s privacy sentence — *"no IP address is looked up, and no counter
request or audience preference is sent to a remote counter service"* — to
`site.json`'s `features.analytics.goatcounter`, which is `""` and is the only
reason the sentence is true. Set that key and `mbm-features.js` appends
`//gc.zgo.at/count.js`, whose country resolution is done from the IP
server-side, and the page starts lying.

So the finding is worse than the guess: a gate guarding a **privacy claim on a
public page** sat in `tools/` referenced by nothing, reading like coverage.
Wired, after an external red proof — its own §3 control only shows `judge()`
flipping, not that the gate exits non-zero.

The sweep that followed found a second unwired gate that was **this estate's own
recent work**: `verify_audience_copy.mjs`, shipped by P2, guarding the five
rewritten audience pages — the headline content change — wired to nothing. Also
now wired, with a control.

### The class is closed at the top two tiers

The census is reproducible now: **94 gates**, population defined as `tools/`
files matching `^(verify|check|prove|audit)_.*\.(mjs|js|py)$`. 24 candidates by
mechanical detection, 7 in the class after adjudication, 12 explicitly not
(most quote a code identifier, which is an assertion about implementation and
not a copy of authored content).

- **Curation voice** — already backstopped by the pin, and now *proved* by the
  class-level control rather than assumed.
- **Locked copy** — newly pinned: the chooser's promises about accounts and
  permissions, and the on-device preference privacy sentence. The control that
  previously guarded that copy deletes a *different* sentence, so it proved the
  guard could fire but not that its expectation could not be co-updated.
- **Counts and identities** — a game `<title>`, a game name, and one gate whose
  canonical owner is `site.json` and so is a DERIVE. Recorded with owners and
  reasons; none guards voice, locked copy or a published count, so DECLARE is
  legitimately available to them.

The class-level control is the point of the whole exercise and it passes:

```
mutate the sentence AND teach the other gate to expect it
  the co-updated gate : PASSES — it adopted the change
  the pinned gate     : STAYS RED — the pin is the reference
```

### One control was vacuous on its first writing

The CI control for the new pin regions mutated a scratch worktree but invoked the
**main tree's** copy of `verify_takes_pin.mjs`. That gate derives ROOT from its
own file location and runs `git show HEAD:` there, so it read the main tree's
HEAD, saw an unmutated blob, and returned rc=0 on a mutation it existed to catch.
Caught by testing the control rather than by trusting it. It runs the worktree's
own copy now, with the reason written beside it.

---

## The H pass — 24 August 2026

Neither PR merged when this ran. The pass was built on a ruling — *backstopped is
not closed* — and on a census finding that four gates self-satisfy. The order
required a contribution test **before** any fixing. That test disproved the
premise.

### Seven of nine gates contribute; none self-satisfies

Mutate the value the gate names, in the subject only, run the gate alone:

```
verify_arcade_sports.js         green -> RED   CONTRIBUTES
verify_curation_keys.mjs        green -> RED   CONTRIBUTES
verify_games_audience_faces.py  green -> RED   CONTRIBUTES
verify_neonbreach.js            green -> RED   CONTRIBUTES
verify_pupil_genres.mjs         green -> RED   CONTRIBUTES
verify_apexrally_browser.js     green -> RED   CONTRIBUTES
verify_biopunkhive_browser.js   green -> RED   CONTRIBUTES
verify_apextennis_home.py       red   -> red   inconclusive, baseline already red
verify_production_after_merge   -             untestable here, reads production
```

So nothing was deleted. The instruction to strip duplicated prose assertions from
"the four that self-satisfy" had no subject, and acting on it would have removed
working detection — which is why the test comes first.

The gates hold copies AND fire. Both are true. The pin is a second line, not the
only one.

### Three real defects, found because the premise was tested rather than assumed

1. **A fused assertion that could not catch its own failure.** The Top Picks
   sub-line asserts prose (which contributes) *and* the number word "eight"
   (which nothing derived). The rail could have gone to seven or nine with the
   sentence unchanged and every check passing. Counted from the `rail:N` slots
   now, with the `--self-test` case it never had.
2. **A failure message that taught the wrong fix.** `verify_curation_keys.mjs`
   printed `authored "<old>" vs painted "<new>"`, handing over the replacement
   string. Paste it into `AUTHORED` and the gate goes green having adopted the
   rewrite it exists to catch. Rewritten to name the value, the owner and the
   pin, and never to print the painted text. It was the only gate in the estate
   where that species could exist.
3. **A gate that blamed the page.** `verify_highlumen_behaviour.mjs` reported a
   0x0 swatch on `/tools/`. The page is fine — 44x44 at that gate's viewport in
   every state. A layout race in the gate. Settled, fail-closed, wired.

### Two things I got wrong, kept in the record

`verify_games_audience_faces.py` first read SELF-SATISFIES. The literal occurs
twice in `main/index.html` and my mutation replaced one; the gate was right and my
control was under-powered.

On the 0x0 swatch I blamed a collapsed mobile nav — true at 390px, irrelevant to a
gate that runs at 1280x720. Sabotaging the toggle does not make it fail, which is
the proof. The correction is written beside the code rather than tidied away.

### Definition of done

Still **6 of 6**. BACKLOG 5j is reduced from three gates to two, and the red one —
the only user-facing defect it named — turned out to be a gate defect and is
fixed.

---

## The MB pass — the merges, 24 August 2026

Both halves merged, in the ruled order, as merge commits.

```
site  #172  ->  bb1e3cc   parents b912ad0 cd4fc85
games #39   ->  28e36f9   parents 52fa624 ad55d48
```

### What the merge order bought, measured

Site first, then the shelf. Production was reached on the **first attempt** with
no deploy lag at all — the bounded-404 policy never engaged:

```
attempt 1/8  ALL 200  /apexcurl/ 200 · /apexvelodrome/ 200
deployment observed on attempt 1.
```

Between the two merges production served both routes but did not list them, which
is exactly the state the ordering chose over an advertised 404. The two listing
assertions failed in that window and cleared once the manifest deployed:

```
before games merged   19/21   /games/ lists /apexcurl/ exactly once — 0 link(s)
after                 21/21   run 32774157075 attempt 2, step 6 success
```

### Every red, and what it turned out to be

| red | verdict | evidence |
|---|---|---|
| Curation keys resolve (step 10, canonical shelf) | **CLEARED** | job 97582398553 step 10 success |
| Shelf mirror is not stale (step 4, byte-identical) | **CLEARED** | run 32774156924 attempt 2 success |
| Site shelf mirror is not stale (games side) | **CLEARED** | run 32774419792 success |
| Driving games live verification | window — ran at 20:29:27, before the deploy completed at 20:29:52 | run 32774157151 |
| **MBM audience discovery closeout** | **STILL RED — see BACKLOG 5l** | run 32774157030 job 97581221345 step 12 |

Both checks that were skipped on the pull request ran after the merge and passed,
as required: `Routes serve 200 and removed paths 404` (job 97581221593) and
`Exact production deployment and live browser proof` (job 97581221223).

### Rules earned here

- **A pull request body is a claim about a head that can move underneath it.**
  Merging a head the body does not describe merges an undocumented change,
  however benign the diff. Reconciling body against head is a standing pre-merge
  step, not a one-off.
- **When a change edits both a pinned reference and its verifier, fires-on-mutation
  must be re-proved at the new head.** A control that passed at an earlier head
  proves nothing about the pair after both sides have moved. Re-proved here: a
  committed take mutation still fails the pin on its named assertion, and still
  fails it when a sibling gate is taught to accept the mutation.
- **Skipped is not passed, and a declared skip is only better than a silent one.**
  Neither is evidence.
- **A gate proved in one environment is proved in one environment.** Curing a
  race in the dev container is not curing it on a runner; until it has run green
  where it will actually run, the diagnosis is a hypothesis. BACKLOG 5l is what
  that mistake looks like.
- **A fail-closed assertion must fire on the first instance, not only on all of
  them.** `!sw.every(zero)` passes while one swatch is collapsed; the report then
  blames size, which is the confusion the assertion existed to prevent.

---

## The N pass — main was red, 24 August 2026

Twenty-one checks were reporting nothing on every push. Fixed in the ruled
order: the prover first, then the signal, then the defect.

### N1 — the prover could not report

Step 7 of the post-merge verifier ran `set +e` under `continue-on-error: true`.
The intent was right and is kept — run every gate to completion so the summary
names all of them — but nothing they reported could fail anything. It had been
hiding two findings for as long as it existed: `verify_published_live.mjs` was
invoked with **no arguments at all** (it needs `--shelf` and explicit `--path`
values plus two checkouts) and died on a Node TypeError, and
`verify_curation_keys.mjs` reported INCONCLUSIVE because acorn was never
installed there. Every invocation now resolves to PASS / FAIL / NOT-RUN and only
PASS is green.

### N2 — one failure cost twenty-one signals

The suite was a sequential step chain. Each gate now carries `if: always()` and
an aggregator makes the job red. Not `continue-on-error`, which hides reds
rather than isolating them. Proved with the swatch gate still failing: 20 of the
21 dark signals reported, and every one of them was green — so the cascade had
been hiding nothing except itself.

### N3 — harness, established before either side was touched

```
A untouched      zero-box 0:cream   4 runs of 6
C condition met  zero-box none      6 runs of 6
```

The swatches are injected by `theme.js` at runtime; the first can be measured
mid-construction. No live zero-size tap target. This corrects H6, whose
"44x44 untouched" reading was taken after the settle that hid the transient.

### Rules earned here

- **A null measurement is not a failing measurement.** 0x0 means *not measured*.
  Reporting it as a size sends the fixer to the CSS for a bug that is not there.
- **`every` where `some` was meant makes a guard fire only in the case that
  cannot happen.** A guard demanding total failure never catches the partial
  kind, which is the only kind that occurs.
- **A gate suite must not be a sequential step chain.** One failure must cost
  one signal. Isolate with `if: always()` plus an aggregator, never with
  `continue-on-error`.
- **Evidence from one environment cannot establish that a timing fix works in
  another.** A settle proves the race exists; it never proves it is cured.
- **A crash is not a pass, INCONCLUSIVE is not a pass, and `set +e` turns both
  green.**
- **A value leaked on the PASS path is invisible to any query written against
  failure messages.** Three gates leak canonical copy on rc=0; the lexical query
  is retired.
- **A control that matches on message text will catch your own rename** — and
  should, which is why each swatch control now also asserts the other's message
  is absent.

### The repaired step caught my own regression, one commit later

N1's acorn line was added as a SECOND `npm i --no-save`. That prunes what the
first one installed, so playwright vanished and every browser-driving gate died
with `Cannot find module 'playwright-core'`. Reproduced rather than assumed:

```
two installs   after playwright:  playwright-core yes   acorn NO
               after acorn:       playwright-core NO    acorn yes
one install                       playwright-core yes   acorn yes
```

The point worth keeping: the old `set +e` step would have printed those four
crashes and reported SUCCESS. The repaired step reported

```
PRODUCTION-DRIVEN GATES DID NOT ALL PASS
  NOT-RUN  verify_echovault_surfaces.js  - crashed
  NOT-RUN  verify_relicforge_surfaces.js - crashed
  NOT-RUN  verify_curation_keys.mjs      - inconclusive
  NOT-RUN  verify_surfaces.js            - crashed
```

and failed. A prover is worth having exactly when it catches the person who
repaired it.

## The S3 pass — closing Order S, 24 August 2026

Order S arrived as a batch of proposed code. Three of its four major sections
died on the same fault, and the pattern is the finding: **the batch described
the estate it imagined, not the estate that exists.** Every defect found in the
pasted code was correctly found and almost entirely irrelevant, because none of
that code was ever going to ship. What survived was exactly the set of ideas
that needed no code — a metadata standard, a microcopy register, and a line on
a form.

### The sharpest single finding of the arc, in its own words

**Adopting the proposed filter engine would have installed all three of its
bugs into a filter that does not have them.**

- `drawGrid()` **rebuilds the DOM** rather than hiding cards, so the
  `[hidden]`-vs-`display` defect is structurally impossible here.
- `state.feel` is **single-value**, so the AND-across-everything dead end is
  structurally impossible here.
- §4.5 already holds, because nothing persists `q` or `feel`.

The engine is retired, not deferred. Two ideas from §S4 survived: slugs in the
URL (shipped) and multi-value within a facet (declined — no dimension has
enough classified values to select between).

### §T2 — three derivations, and the discipline of discarding one

| dimension | classified of 641 | collisions | outcome |
|---|---|---|---|
| `interactionModel` | 461 (71%) | 92 | **discarded whole** at 12/20 |
| `classroomRole` | 2 (0%) | 0 | too sparse to render |
| `curriculum` | 0 (0%) | 0 | no licit source in this repo |

Twenty per dimension, chosen at random against seed `20260824`, judged against
the artefact rather than against the rule that produced the value. The threshold
was 18/20 and `interactionModel` returned **12/20**. At 461 classified, 60%
accuracy puts roughly 184 wrong tags in front of teachers — and a wrong tag is
worse than a missing one, because someone acts on it.

So **no card component ships.** The three-tag card is a real idea rendering a
record with nothing in it.

**The ten most common unclassified reasons — Matt's backfill worklist:**

```
641  curriculum        no scheme-of-work document names this resource
409  classroomRole     type='lesson' describes the artefact, not its place in a lesson arc
 85  interactionModel  no rule fired
 80  classroomRole     type='Lesson'   (same value, different case)
 55  classroomRole     type='teacher'
 38  interactionModel  collision: free-response + simulation
 38  classroomRole     type='support'
 37  interactionModel  collision: free-response + multiple-choice + sorting
 31  classroomRole     type='game'
 18  classroomRole     type='pupil'
```

Two things fall out of that table that were not the point of it. The `type`
field carries `lesson` and `Lesson` as **separate values** — 489 records split
across a case difference, which any consumer grouping by `type` will read as two
categories. And the largest single reason across all three passes is a document
that does not exist in this repo, which is a sourcing problem rather than a
rules problem.

### §T4 — a correction to the record

"`/uas/app.html` has 0 persisted learner names" was carried forward from an
earlier pass and **is not true of this app.** Measured:

```
localStorage  []     sessionStorage  []     cookies  ""
IndexedDB     uas_register    holds { forename, surname, learnerNo }
```

UAS is a register. Persisting a roster locally is the entire point of it, the
app says so on its own front page, and nothing leaves the device — 0 off-origin
requests during load and during a full summary render. The thing that claim was
protecting is intact; the claim itself was wrong, and a wrong claim on the
record is worse than an open question because nobody re-checks it.

§4.2's premise died too, and is reported rather than adapted around: **there is
no Co-Pilot drawer in this app and nothing writes `supportGiven`.** "An empty
`supportGiven` pre-populates nothing" therefore holds *vacuously* — which looks
identical, in a green result, to holding.

### §T5 — audit before authoring

Seven routes, three columns. Six passed and were left alone.

| route | R3 claims | R4 safety line | anchor test |
|---|---|---|---|
| `/for/pupils/` | pass | pass | pass |
| `/for/teachers/` | pass | **FAIL** | pass |
| `/for/parents-carers/` | pass | pass | pass |
| `/for/schools-semh/` | pass | pass | pass |
| `/for/trusts/` | pass | pass | pass |
| `/for/councils-organisations/` | pass | pass | pass |
| `/for/partners/` | pass | pass | pass |

The column-A checks are the part worth keeping. `education-hub.json` carries
**no `status` field on any of its 40 resources** — current / upcoming /
evergreen / superseded are *derived* from `effectiveFrom` and `effectiveTo`. A
check of the raw record would have called the trusts page's "date-aware
publications" claim false. **Reading a field that isn't there is not the same as
reading a claim that isn't true.**

### §T6.3 — 52 against 54

Not a phantom and not a defect: two measurements six days apart. The manifest
held 52 entries from 14 August until 23 August, when **Apex Curl** and **Apex
Velodrome** took it to 54. TAXONOMY is 54/54 with zero drift in either
direction, and the floor derives from the **served manifest length at run time**
— so it read 52 then and reads 54 now with nothing edited. The only stale thing
was a comment in `render()` asserting "eight of the 52" and "60 cards".

### §T6.2 — B2, both halves, both surfaces

```
/for/teachers/   boot 0  ->  after focus  1
/for/pupils/     boot 0  ->  after typing 0
```

The pupil zero is the fence, not a missing feature: that search filters the
cards already rendered, so the 717-entry index is not something it could fetch.
Two zeroes are also what a dead listener prints, so a control fetches the index
deliberately from the same page and requires the same counter to move.

### Rules earned here

- **A third-party pack describes the estate it imagines, not the one you have.**
  Audit the estate against the *idea*; never audit the pack against itself. The
  ideas that survived Order S were the three that required no code.
- **Adopting a fix can install the bug.** All three of the proposed engine's
  defects were structurally impossible in this estate.
- **A line span is an inference; a marker is a measurement.** The pinned region
  read as lines 302–643 and nearly turned §S3 into a hard stop. The end marker
  and the byte count disagreed with the line count, and they were right.
- **A coverage target invites invention.** Report the number; never gate on it.
- **Two counts of different things, placed side by side, will be read as the
  same thing.** 52 cards and 73 anchors were reported adjacent and an entire
  section was built on the gap. Label the unit in the same breath as the number.
- **A sweep that flags its own specification trains someone to ignore it** — and
  the tidy fix ("exclude `tools/`") silently drops a served page out of the
  sweep. Classify by *what loads the file*, never by which folder it sits in.
- **A rule that holds vacuously looks identical to a rule that holds.** Say
  which one you measured.
- **A claim inherited from an earlier pass is a hypothesis, not a finding.**
  "0 persisted learner names" survived three passes and was false.

## The S4 pass — the residue, 25 August 2026

Four things the S3 close surfaced and did not chase, plus the formal retirement
of the card build. Nothing here was new work; every item was a line in my own
close that nobody followed.

### §U1 — failure mode 47 was a class, and it runs in two directions

Fixing the two instances I was standing on was not fixing it. The census across
all three repos — 51 workflows, 17 shell scripts:

```
                 before   after
sites               24       9
  false-green        6       1   (a pinned fixture nothing reads)
  false-red          9       0
  safe               9       8
```

**The false green is the one that matters, and it is silent.** A negative
assertion — `! producer | grep -q BAD` — passes when the producer dies, because
non-zero means "absent". It certifies the absence of something it never looked
for. The six:

| site | what it was certifying |
|---|---|
| `glv3-verify.yml` | no stray markdown in the generated estate — passes if the trees cannot be walked |
| `tools/glitchclash/run.sh` | **a Glitch Clash suite that FAILED reads as passing** |
| `tools/verify_offbrand.sh` | a safeguarding check on a child's guide entry |
| `post-merge-production-verify.yml` ×2 | an INCONCLUSIVE gate reported PASS — the exact failure that step was built to prevent |
| `tools/fixtures/pr124/…` | parked: outside `.github/workflows`, nothing reads it |

`run.sh` is the runner `CLAUDE.md` tells everyone to run before saying a change
works. It also had a second vacuity of the same family: a suite whose process
was **killed** prints nothing, matches neither `FAILED` nor `Error`, and took
the else branch. The exit status was the only thing that knew, and nobody read
it. It is read now.

Both directions are proved by one control each rather than one per site, each
measured against the old form failing on the same input:

```
1a  repaired negative still REDS on a present defect
1b  …and passes on a genuinely clean producer
1c  …and REFUSES to certify an absence when the producer died  [MEASUREMENT INVALID]
2a  repaired positive still matches what is there
2b  …and still reports a genuine absence
    OLD form, both directions: reproduced, BrokenPipeError
```

The census is now a standing gate (`s15`), not a sweep somebody ran once, and it
was proved able to fail by re-introducing the defect in a scratch workflow.

### §U2 — the vacuity behind the five non-`always()` steps: none

The claim was that checkout, setup-node and the browser install must not be
`always()`. Correct, and untested: if checkout fails, the `always()` steps still
run, on an empty workspace. Do they red, or pass having read nothing?

Simulated exactly — empty workspace, and every step without `if: always()`
skipped, so no repo and no `node_modules` either:

```
gates run   56
vacuous pass on an empty workspace    0
correctly red                        56     exits 1, 2, 127, 128
AGGREGATE VERDICT                   RED
```

No sentinel needed; §U2.2 was conditional on a vacuous pass and there are none.

**But the two `production` steps are a different subject**, and checking rather
than excluding them found something: that job reads **no repo path at all** — it
curled a route list **typed into the workflow**. Seven of those thirteen routes
are the audience routes, which have a record. That is failure mode 1, the fifth
time on this estate, in the one job whose sibling gate derives the same set from
the same file for exactly this reason. Now derived, and the derivation is
asserted: an unreadable record or a short read is MEASUREMENT INVALID, never
"no audiences to check".

### §U3 — the pupil search: neither (a) nor (b)

The order offered two readings and only one was fine. Measured, it is a third:

```
control            [data-mbm-pupil-search]  input[type=search]
label              "Look for a game"
"apex curl"   ->   1 card    Apex Curl
"snake"       ->   2 cards   Globe Snake, Neon Snake Overdrive
"zzzz…"       ->   0 cards
index fetches ->   0, at every point
```

**The control exists, it works, and it does not need the index.** It filters the
62 game cards already rendered on the page — and that IS the fence: a pupil can
only ever reach a game route because the search can only ever see game routes.
The 717-entry index covers the whole estate, most of which is out of bounds.

"0 fetches" and "the search works" are each true and, read apart, the first
looks exactly like a broken search. It was read that way once. So the gate now
asserts **both in one check**, and its message says which is which.

### §U4 — the fence, re-measured in the state a child touches

`under-44px: 0` had been read with eleven genre groups closed and the mobile nav
at `display:none`. Re-measured by tapping the Menu control — never by forcing
the CSS, because a state the page cannot enter is not worth measuring either:

```
/for/pupils/  as loaded   162 laid out   under-44px 0   null-box 21 (0 focusable)
/for/pupils/  EXPANDED    179 laid out   under-44px 0   null-box  4 (0 focusable)
```

Seventeen targets that did not exist in the first measurement, and **none of
them under 44px**. §U4.2 is moot: N = 0. The four remaining nulls are inside a
footer bar that is `display:none` at 390px — an entire hidden footer, not
zero-size targets, and none is focusable.

An injected 20×20 control is measured in the same pass and must be counted, in
both states, because two zeroes are also what a broken selector prints. Both
states are in `verify_pupil_genres.mjs` now.

`/games/` — an adult surface, not this fence — carries 2 under 44 px in both
states: `"tell me"` and a contact email, both inline links inside running prose.
Reported, not fixed: inflating an inline link to 44 px breaks the paragraph.

### §U5 — the card build, retired

The schema, the slug→label map and the degrading-card ruling are landed and
correct. The resource record has no values to render and none can be honestly
derived. **This is a closure, not a failure.**

The numbers are the arc's best result: `interactionModel` reached **71%**
coverage with 92 collisions and scored **12/20** against a threshold of 18 set
*before* the number was known. At 461 classified that is ~184 wrong tags in
front of teachers. A derivation that is nearly good enough is the dangerous
kind — it is exactly persuasive enough to ship — and the only reason it did not
is that the threshold was fixed in advance.

One correction to the record, found while ordering the worklist. 5n said "no SoW
workbook is present here." True of the site repo, imprecise about the estate:
the 2026-27 workbooks exist in the Lessons repo. Measured across all four SoW
artefacts: **zero occurrences of a resource file or id.** They plan terms,
themes, weeks and pathway targets. So the condition still is not met, but for a
better reason — the document is present and does not carry that mapping.

`data/tag-backfill.csv`, 641 rows, six columns filled from the record and four
deliberately empty:

```
tier 1  2026-27 on a pathway a SoW workbook plans   199   <- the afternoon
tier 2  2026-27, other subjects                     305
tier 3  2025-26                                     137
named by a SoW row                                    0
tag cells pre-filled                                  0
```

### Rules earned here

- **`producer | grep -q` under `pipefail` can report a match as a failure — and
  can report a negative assertion as satisfied when the producer died.**
  Herestring, not pipe. A gate that certifies an absence it never looked for is
  the R8 family arriving through a pipe.
- **A derived field read as a raw field produces a false negative.**
  `education-hub.json` carries no `status`; reading the raw record would have
  called a true claim false and rewritten good copy.
- **A measurement taken in the collapsed state measures the collapsed state.**
  Twelve targets inside closed `<details>` are 0×0 until a child opens them.
- **A derivation that is nearly good enough is the dangerous kind.** Set the
  threshold before you know the number, always.
- **"No fetch" is only good news if the thing was supposed to fetch.** A zero
  meaning "working as designed" and a zero meaning "broken" look identical in a
  counter. Assert both facts in one check.
- **A census that does not check its own recall is a sample.** Two blind spots,
  both in the census and neither in the crude grep it was measured against.
- **Excluding a case from a check is a claim, and it needs the same evidence as
  including one.** The two production steps were nearly filed "not applicable";
  checking them found a hand-typed route list.

## The S5 pass — the close, 25 August 2026

Four rulings carried out, the one red thing in the estate chased to its cause,
and the arc closed.

### §V1 — both review PRs merged

**#178** merged after one amendment: `"Six practical routes"` → `"Practical routes"`.
True today, and a literal in prose — the same family as `511`, `717` and the
stale "eight of the 52 / 60 cards" comment. No gate can reach a sentence, so the
sentence no longer carries the number. Six task cards still render. Sweeping the
rest of the audience copy found eleven other number words, every one an article
or a singularity claim, plus two counts in underscore-prefixed internal notes
that appear in **0 served files**. That was the only live count.

**#177** merged as built. And the premise correction that came with it:
**"typed at print, never persisted" was written for an ad-hoc evidence sheet and
applied to a register.** A register that forgets learner names is not a register.

`uas_register` is now named on `/privacy/` — the estate's storage-keys record —
with what it holds and how to reach it:

```
IndexedDB uas_register    forenames, surnames, learner numbers, units and
                          outcomes, dated marks, session registers, evidence
                          photographs
Settings → Export backup (.json)   133x41   the whole register, photos included
Settings → Delete all data          129x39   names what it deletes before it does
off-origin requests at merged head          0
```

**A clear affordance exists**, so nothing was built here. It is two taps deep
(open Settings) and 39–41 px rather than 44 — factual, and acceptable on a
desktop panel in an adult tool.

### §V2 — failure mode 1, and the distinction that actually matters

Six instances in three weeks is a class, and nothing was looking for the
seventh. The census is now `s16`.

**The finding is not "a typed value".** It is *a typed value nothing binds*:

```
sites 19    live-and-unbound 0    bound 19    inert 0
```

`assets/mbm-audience.js` holds all seven audience routes as a literal and says
why — "a static asset cannot read the JSON at build time" — and
`verify_games_audience_faces.py` asserts equality with the data file. **That
cannot drift silently, so it is not the failure mode.** Equally, "the four
established sports" is a fixed historical set the shelf does not hold; deriving
it from `games.json` would be *wrong*, not better, because Sports is additive.

What was actually unbound, and is now derived: the seven audience routes typed
into `verify-games-audience-faces.yml`'s page table and into
`verify_audience_discovery_browser.py`. Four pins carried no line saying what
they pinned; they do now.

Both narrowings came from reading the sites. The first draft reported **54**
live sites; almost all were correct code.

### §V3 — 5m was two faults, and neither was the games

Red since 14 August through three dispatches. The dates gave two answers.

**Run 10, 14 Aug 08:49** — and *not* the assertion the backlog recorded:

```
PENDING /data/source-manifests/games.json — served does not match the tree
##[error]Process completed with exit code 1
progress log empty or absent — the leg did not reach its first check
```

A deployment that had not landed. The step printed PENDING, set `fail=1`, and
the install and the **entire rendered leg** had no `if:` — so they were skipped.
Eleven days of blindness on a shelf that was working, bought with one Pages lag.

**Run 14, 24 Aug** — once the byte compare passed again, `---- 1 FAILED`, and
only one. Both games boot, zero off-origin, splash plays and closes, inline exit
44×44, arcade 62 cards, homepage boxes present. The single failure:

```
FAIL  pupil page carries both mf-feature cards — ["lesson-hub","asdan-suite","studio-suite"]
```

A *second, later* fault: `bc67b82` on **15 August** — "The pupil homepage shows
all 52 by genre" — replaced per-game feature cards with the whole shelf. The
games did not move; measured, they are on that page **twice each**. The page's
shape moved, and the check held its own copy of it.

**And the `paths:` filter is why nobody saw it.** It listed the two games, the
manifest and itself, while the check also asserts on the arcade, the homepage
and the pupil page. *The commit that broke the assertion could not fire the
workflow it broke.* R8 in its purest form.

Three fixes, no re-pinning: the assertion re-pointed at **reachability by href**
measured with every genre group opened; a mismatch **waited on** for 180 s
before it is called anything, with the install and rendered leg on
`if: always()`; and `paths:` widened from 4 to 9 — every surface the run asserts
on, plus the record each renders from.

```
PASS  pupil page reaches both driving games
      /neonmeridian/ x2, /rallyvector3d/ x2, across 62 game card(s)
---- all live checks passed                                        exit 0
CONTROL, both games stripped from the pupil page:  x0, x0          exit 1
```

### §V4 — the census, tested against the blind spots that produced it

All three planted permanently, re-proved on every run: a pipe inside
`"$( … | … )"`, workflow YAML outside `.github/workflows`, and a bare
`! pipeline` that must file **false-green**. 5/5.

They live as **files**, not heredocs — because a fixture written inside a
heredoc reads as live code to any scanner, which the census proved by flagging
its own control file.

### §V5 — `/games/`: accepted, and the exemption enumerated

Two sub-44 px targets, both links inside a sentence, on an adult surface outside
the pupil fence. Recorded **in the gate**, named, and enumerated so it cannot
silently grow: a third undersized target reds even if it is also in a sentence.

The strict form of that assertion caught my own §U4 characterisation. I had
called both "inline links in running prose"; the contact address sits in
`<div class="contact">`, not a `<p>`, and a `closest('p,li,small')` test failed
it. The copy was right and the test was wrong: the ruling says *a link inside a
line of prose*, so what is measured now is whether there is a **sentence around
it** — parent text minus the link's own text. A button or a chip has nothing
left over and does not inherit the exemption.

### Rules earned here

- **A dichotomy is a premise too.** An either/or narrows the search as
  effectively as a wrong answer does.
- **A rule written for one artefact will be misapplied to another.** Rules carry
  their artefact in their pocket; state it.
- **A count typed into prose is a literal with better manners.** No gate can
  reach it and no record backs it.
- **Recall is measured against a cruder instrument, never against yourself.**
- **A red that never changes is a stale pin until proved otherwise** — and the
  date it started is usually the diagnosis. Here it gave two.
- **A typed value is only a defect when nothing binds it.** A literal a gate
  asserts equal to its record cannot drift silently; a fixed historical set that
  names itself as one is not a copy of anything. Deriving either would be worse.
- **A fixture inside a heredoc reads as live code.** Park fixtures as files.
- **The strict form of an assertion will catch the person who wrote the loose
  description.** Measure the words of the ruling, not a convenient proxy for them.

---

# Order T — estate check health

**25 August 2026.** Order S closed with both mains green. This order exists
because of what the close surfaced sideways: in one week, two checks were found
red for a week or more, **both by accident**. Two found by accident is a
sampling estimate, not two incidents.

## §T1 — the census, and two instruments that had to be made to agree

Every workflow in every repo that carries one — site, Lessons, Games,
Matt-s-Apps-, Games- — read from the **API**, because a workflow's stated
trigger and its actual run history are two different facts and the gap between
them is the whole point.

```
instrument 1 (Actions API registry)   197 workflows, all reported active
…of which the file no longer exists   140 ORPHANED — can never run again
instrument 1, live                     57
instrument 2 (plain directory walk)    57
reconciled at 57
```

The 197-vs-57 gap is failure mode 50 and it is not cosmetic: the first run of
the health tool reported **60 red**, 59 of which were registry ghosts. A report
naming sixty reds is skimmed exactly like one naming none.

The reconciliation now **names the file** when the two instruments disagree
rather than only reporting that they do — a reconciliation that prints
`57 != 58` and stops has told the reader the census is wrong and nothing about
where to look. Proved on this order's own new workflow, which the disk walk saw
and the registry had not: `ON DISK, NOT IN THE REGISTRY
mattroper1977.github.io/estate-check-health.yml`.

## §T2 — four buckets

| bucket | count | |
|---|---|---|
| **A — healthy** | 55 | fires on realistic diffs, ran recently, green |
| **B — red and silent** | **1** | `mattroper1977.github.io/apexgolf-verify.yml`, red **14.9 days**, last success **20.8 days** ago |
| **C — structurally blind** | **0** | measured, not assumed — see below |
| **D — dormant but correct** | 1 | `Games/apexpool-sports-verify.yml`, declared retired 5 Aug |

Bucket C is the one that needed thought rather than an API call, and "has a
filter" is not the test — 23 of the site repo's 26 PR-firing checks have one and
they are fine. The test is: **compare what each check asserts against what its
filter watches.** `census_filter_blindness.py` derives the asserted surfaces
from every navigation in the workflow **and in every repo tool it invokes**, maps
`/for/pupils/` → `for/pupils/index.html`, and reports a hit only when a rendered
page of that repo is navigated to and not covered. Across all five repos: **0**.

That zero is only worth anything with a recall control, so the gate carries one:
the **real 5m workflow at `93168a1^`**, filter and all, kept as a fixture. The
census names it. Delete the fixture and the gate reports `MEASUREMENT INVALID`
and exits 1 rather than passing on an unmeasured zero.

## §T3 — the repairs

**Bucket B: `apexgolf-verify.yml`. The check was wrong, not the estate.** It
went red at `def68e16` on 10 August and the run log jumps from `##[endgroup]`
straight to `exit 1` — it failed before printing anything. Every count was
`grep … | wc -l` under `set -e -o pipefail`: grep exits 1 on no match and 2 on a
missing file, pipefail promotes either, `set -e` kills the step. So *"the donor
emitted the wrong number"*, *"the log is missing"* and *"the pattern stopped
matching"* were one indistinct red.

Two faults, repaired as two:

- counted with `|| true`, with the missing-log and no-summary cases separated
  and named as `MEASUREMENT INVALID` rather than as a failing assertion;
- `-eq 25` was **a count typed against another gate's output** — failure mode 1,
  seventh instance. The donor prints `ALL <n> CONTRACT CHECKS PASSED`, so the
  total is now read from the donor and the two are asserted equal.

**Bucket C: nothing to widen.** 0 before, 0 after; the before/after is the
census output above.

**Bucket D:** retirement is now *declared* in `data/retired-checks.json` with a
reason, a date and a record — so the health run reports "1 red, and it is the
declared-retired one" instead of "1 red". A declaration that points at nothing
is paperwork without the thing, so **the record is fetched over the API in the
repo whose workflow was retired**, and a declaration naming a file that is not
there stops excusing the check. Planted: `RED 2`, the retired one reported as a
plain red.

## §T4 — the one thing that does not depend on a filter

`.github/workflows/estate-check-health.yml`. Weekly (`0 7 * * 1` — before a
teaching week, not during one) plus dispatch, **no `paths:` filter and no branch
condition**. It is a reporting job, not a re-verification (§T4.4): last-run age
answers the question, and re-running 57 workflows weekly would cost more than it
is worth.

```
ESTATE CHECK HEALTH
  repos      5
  checks     57 live · 57 have ever run · 55 green
  orphaned   140 registry entries whose file no longer exists — cannot run, not checks
  RED        1
  STALE      0   (no success in 30 days)
  retired    1 declared-retired and red, which is expected

  RED — name and age:
    mattroper1977.github.io/apexgolf-verify.yml   red for 14.9 days   (last success 20.8 days ago)

ESTATE CHECK HEALTH: NOT CLEAR — 1 red, 0 stale        exit 1
```

**It fails on stale as well as on red** (§T4.2), and the plant proves both
directions on the *same* classifier the report uses — a self-test that proves a
parallel implementation proves nothing:

```
[ok] a planted RED is named  — planted-red.yml
[ok] a planted STALE is named even though it is currently GREEN  — planted-stale.yml ok_age=91.0
[ok] a declared-retired red is reported separately, not as a red
[ok] a healthy check is in neither list
[ok] and with only healthy rows the verdict is CLEAR
```

## §T5 — required checks vs existing checks: reported, not changed

`/branches/{b}/protection` answers **403** for this token, so the finding rests
on two readable instruments instead.

**The setting**, readable without admin scope, on all five repos:

```
protected=False   enforcement=off   required contexts=0   rulesets=0
```

**The behaviour** — a required check *cannot* be red on the head commit of a PR
that merged:

```
57 live checks · 43 fire on pull_request · 0 required for merge anywhere
11 of 101 sampled merged PRs merged over a red check
```

Eleven, in three of the five repos. **5o was not an outlier; it was one of
eleven.** The behaviour instrument only ever *falsifies*: a merge over red
proves nothing was required, while zero red merges proves nothing at all, and
the report says so rather than reading silence as corroboration.

The gap, both directions:

- **matters but is not required: 43.** Every PR-firing check in the estate.
- **required but no longer exists: 0** — and only because the required set is
  empty. The renamed-required-check trap (a check that blocks merges for ever)
  is absent for the same reason nothing else is blocked.

**One finding that is not a settings change, and it comes first.** Of the 43,
only **4** could be required without jamming every PR: a required check carrying
a `paths:` filter never *reports* on a PR outside those paths, and GitHub waits
for a report it will never get. **`Games` and `Matt-s-Apps-` have PR-firing
checks but not one without a filter** — those two need a filter-free aggregate
check before any settings change would help. Requiring a filtered check is not a
stricter estate, it is a jammed one.

Matt's clicks, and the exact strings to type, are printed by
`tools/report_required_checks.py` and by the weekly run's step summary. **Nothing
was changed.**

## §T6 — when a change re-pins, the dependents are derived

`8432492` re-pinned six sibling gates and missed the seventh. Six of seven is
what a hand-counted set looks like from the outside.

`tools/derive_pin_dependents.py` hashes every artefact — sha256 **and** git blob
sha1 — and looks up every hex literal in the estate against that table, so the
map is **derived by measurement** rather than authored. It classifies from the
identifier's **use sites**, not a line window, which is what stopped it calling
three legitimate pins stale: a *transform* pin (hashed after reverse-applying a
copy) and two *negative* pins (asserted NOT served) both hold a hash that will
never equal the current file, correctly. The last one a human read, recorded as
`READER_RESOLVED` rather than tuned until the number came out zero.

`data/pin-dependents.json`: **3 pinned artefacts, 13 unmatched literals**, gated
as `s18`/`s19`. The ground-truth proof is the historical commit itself:

```
PIN DEPENDENTS, enforced against a diff
  19 file(s) changed in 8432492^ 8432492
  PINNED ARTEFACT CHANGED: apexpool/index.html
      tools/verify_apexpool_landing.js:33   NOT UPDATED
  PINNED ARTEFACT CHANGED: neonsync/index.html
      tools/verify_neonsync.js:24   re-pinned in the same commit
  1 dependent(s) of a changed pinned artefact were not updated:
      tools/verify_apexpool_landing.js  still pins the old apexpool/index.html
  exit=1
```

## §T7.1 — the pupil homepage duplicates: the premise did not hold

The order's premise was that `bc67b82` had left games appearing on
`/for/pupils/` **twice each**. Measured, in the rendered DOM with every
accordion open, at 1280 and at 390:

```
54 game routes on the page
   46 appear ONCE   (browse shelf only)
    8 appear TWICE  (Top Picks + browse)
    0 appear three times or more
```

The eight are exactly the curated rail — `/emberwild/ /olympics/ /apexkick/
/apexpool/ /relicforge/ /voxel/ /auroralinks/ /Lessons/Games/Off_Brand.html` —
and both the rail **and** the 54-card shelf are **identical, in the same order,
to `/games/`**. That is the intended pattern, not drift. **Nothing was fixed,
because nothing was broken.**

Two corrections to my own measurement on the way, both worth recording. The
first count said *29 of 54 render* — the selector matched only
`/Lessons/Games/*.html` and missed every game that lives at a root route
(`/apexcurl/`, `/medevac/`, `/novasiege/`…), which is most of them. The second
disagreed with a crude grep, **57 cards to 54**: the crude cut ran to the end of
the file and swept in three hub cards from `#learn-explore`. Both were
instrument faults, and both were found by disagreeing with a cruder instrument
rather than by re-reading the same one.

`verify_pupil_genres.mjs` already pins all of this, and pins it **derived**:

```
[PASS] distinct games painted on the pupil page == the shelf  ·  54 painted, 54 on the shelf
[PASS] the pupil page paints one card per shelf game plus one per rail game (54+8=62)  ·  62
[PASS] no game is painted more than twice
[PASS] and every game painted twice IS on the Top Picks rail  ·  8 twice, 8 on the rail
[PASS] the pupil rail is the SAME rail /games/ paints, in the same order
34 passed, 0 failed
```

## §T7.2 — the `uas_register` clear affordance, recorded as a named exemption

`/privacy/` names `uas_register` — pupil forenames, surnames, learner numbers,
marks, registers, evidence photographs — and names two controls as the way to
take it off the device. Both are under 44 px and both are two taps deep:

```
Settings → Export backup (.json)   181x41   #bk-export
Settings → Delete all data         129x39   #wipe
```

**Ruled 2026-08-25: ACCEPTED, NOT FIXED**, and now recorded the way the
`/games/` prose links were — in a gate, `tools/verify_uas_register_exemption.mjs`
(`s20`), enumerated so it cannot quietly widen, with the **reason asserted rather
than written down**:

- `/privacy/` still names the store **and both controls verbatim** — an
  affordance the disclosure no longer points at is not the one that was ruled on;
- both are still **two taps deep**: absent on the landing tab, present once
  Settings is open. The moment one appears on the landing tab it is an
  incidental target on a scanning surface and the exemption stops covering it;
- **no pupil surface links to `/uas/`** — read from
  `data/audience-homepages.json` and the served HTML, not from memory. The
  surfaces that do reach it are named: `/asdan/`, `/for/teachers/`,
  `/hub-highlight-card.html`, `/teach/`;
- neither ruled control is **smaller than the panel around it** (floor 61×36) —
  an exemption is not a licence to shrink what it covers. Derived, never pinned:
  a written-down 39/41 would red on the next font change rather than on a defect.

**What it deliberately does not claim.** It is not a 44 px pass for `/uas/`. The
whole panel is a 36–41 px desktop tool — 14 targets under 44 px with Settings
open, identical at 390 px — and the **full census is printed** at both viewports
so nobody reads a green here as "everything else is 44". Two controls were
raised and ruled; the rest of the panel is the same adult tool and has never
been in front of a child.

Five plants, each red on the limb it names: the label renamed on `/privacy/`;
`#wipe` deleted from the app; the pupil homepage linking to `/uas/`; the control
shrunk to 40×20; and the Settings view painted on the landing tab. The
two-taps-deep plant took two attempts — the first set `position:fixed` on a
descendant of a `display:none` section, so the box stayed 0×0 and **the gate
passed because the plant had not happened**. A plant that changes nothing proves
nothing about the gate.

## The register, entries 30–34

Carried from the order and recorded here so the repo holds them, not only the
prompt that issued them.

30. **A check's `paths:` filter must cover the files whose behaviour it asserts,
    not the files it reads.** 5m watched the two games, the manifest and itself,
    and asserted about the pupil homepage — so the commit that broke it could
    not fire it. Now an instrument: `census_filter_blindness.py`, `s17`.
31. **A red check that merges is worse than no check**, because it produces the
    paperwork of protection without the protection. `apexpool-verify` went red
    on the PR that broke it and stayed red for fifteen days. Measured across the
    estate: **11 of 101 sampled merged PRs merged over a red check.**
32. **When a change re-pins, the dependents are derived, never counted.** Six of
    seven is what a hand-counted set looks like from the outside. Now an
    instrument: `derive_pin_dependents.py`, `s18`/`s19`.
33. **Two reds found by accident in one week is a sampling estimate, not two
    incidents.** Accident is not a detection strategy, and a filter cannot
    reveal its own failures. Now an instrument: the weekly `estate-check-health`
    run, which has no filter at all.
34. **Date evidence localises; it does not diagnose.** The stale-pin signature
    identified the day exactly and the mechanism not at all — it was a
    served-vs-tree mismatch, plus a second fault a day later. Use the date to
    find the commit, then read the commit.
