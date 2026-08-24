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
