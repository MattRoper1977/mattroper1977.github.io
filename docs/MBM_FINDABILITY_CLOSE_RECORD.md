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
