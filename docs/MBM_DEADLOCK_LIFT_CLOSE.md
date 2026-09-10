# ORDER DL — the mirror-leg deadlock, lifted

**Sentinel:** `mbm-deadlock-lift-2026-08-26-DL-TOP`

Three pull requests were open, correct, and unmergeable. Not one of them was
blocked by anything wrong with it. They were blocked by a required status check
that could not be turned green by any change to any pull request — including the
pull request whose entire content was the repair.

Every value in this record was produced by a command run in the DL session and
printed beside it. Anything that could not be is written `UNRESOLVED`.

---

## 1 — What the repair changed, and what it deliberately did not

### It did not

- **The requirement was not demoted.** `Fetch the live estate and compare to
  raw-at-SHA` is still required, still estate-wide, still untimed.
- **No `continue-on-error`, no `if: false`, no step or job deleted, no matrix
  trimmed.**
- **No branch-protection or required-context configuration was touched.** That is
  Matt's by standing ruling, and this repair did not need it.
- **No administrative override, and none staged.** Everything landed as a pull
  request against the ruleset.
- **The matching rule was not widened.** Still `cmp -s`, byte for byte. What
  changed is the operand, never the tolerance.

### It did

The check answered one question with one boolean while looking at two
independent facts:

| | |
|---|---|
| **Fact A** | the served bytes are wrong. A real defect. Must always block. |
| **Fact B** | `main` sits behind the canonical. Inherited drift. Not a defect of a pull request that touches nothing near the mirror. |

Fusing them made the check both **unfixable** and **blind**. The canonical lives
in the Games repository, so when Games #41 (`43b29f7`) moved it to `f4aab9ab`,
`main`'s mirror was stale the instant it landed; only a site pull request can
clear that, and this leg redded every site pull request. Measured, verbatim, from
run `32987276912`:

```
FAIL data/source-manifests/games.json is not the served canonical:
     mirror    28722 B 4b3787eb97249b3f      <- main
     canonical 28805 B f4aab9ab92413d9d      <- served
```

**Two operands cannot separate the two facts.** "The served bytes are wrong" and
"`main` is behind" produce the identical observation, `served != mirror`. The
third operand is the canonical itself — and the job had been checking it out into
`_shelf/` three steps above the whole time. That is follow-up **R1**, promoted
from optional to load-bearing.

What now happens:

1. **Fact A blocks on every ref, in every context.** Served bytes that match
   neither the Games tip nor the deployed tree are a shelf no repository
   authorises. Games having moved ahead of its own deploy is named as **lag**,
   not misreported as a wrong byte.
2. **A ref that moves the mirror** must move it to the served canonical, byte for
   byte. Corrupt blocks. Absent is `MEASUREMENT INVALID` and never falls through
   to `main`'s copy.
3. **A ref that does not touch the mirror** is told about inherited drift by
   name, with the drifted entries itemised, as a `::warning` and in the step
   summary — and is not failed for a tree it did not write. **Off a pull request,
   that same drift still exits 1.**

Three cases that used to pass now block. One case that used to block now
reports. `curl` gained `--fail`, closing **R3**: a 404 body is no longer compared
as though it were the canonical. **R4** is closed by the warning and step summary.

**The recorded patch in the deadlock doc was not used verbatim, and that is
recorded rather than quietly superseded.** It fails control C4: under it, a pull
request that does not touch the mirror still reds, because its merge ref inherits
`main`'s copy. The doc says so and treats it as a feature; §D2.1 rules the other
way. `docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md` carries the full account under its
own `APPLIED` heading.

---

## 2 — The five controls

Each ran as a `DL-CONTROL/` draft pull request against the patched leg and was
**closed unmerged in the same step that read it**. **Every one resolved at step
13, the mirror leg itself** — no earlier step failed, so each reached the
instrument's real input rather than dying short of it.

| | control | run | what step 13 printed | required | got |
|---|---|---|---|---|---|
| **C1** | planted genuinely wrong **served** byte | `33023137314` | `FAIL the SERVED bytes are not any committed canonical` — `served 7062309a9ec7d152` vs `Games tip f4aab9ab92413d9d` | RED | **RED** |
| **C2** | corrupt the mirror in the PR tree | `33023141124` | `FAIL this ref moves the mirror and the result is NOT the served canonical` — `proposed 28804 B 1a75242b38564852` | RED | **RED** |
| **C3** | delete the mirror from the PR tree | `33023149700` | `MEASUREMENT INVALID … it will not fall through to the deployed tree's copy and call that a pass` | RED | **RED** |
| **C4** | unrelated PR on a drifted `main` | `33023153698` | `DRIFT INHERITED`, six entries itemised, blocking leg **green**, `::warning` raised on the check | GREEN + named line | **GREEN + named** |
| **C5** | the same drift, off a pull request | `33023158094` | `FAIL this ref is not a pull request … it IS this ref's own state, and it blocks` | RED | **RED** |

C1 could not be planted in production, so the wrong bytes were committed to the
scratch branch and served over real HTTPS by `raw.githubusercontent.com`. The
fetch URL is the single altered line; the comparison underneath is the shipped
one. The mirror in that tree was left correct, so nothing but Fact A could have
redded it — which is exactly the amnesty test.

C4's drift did not merely print into scrollback. It is on the check itself:

> **Shelf mirror drift inherited from main** — The deployed tree's mirror
> (`4b3787eb97249b3f`) is not the served canonical (`f4aab9ab92413d9d`). This
> pull request does not touch the mirror, so the leg reports rather than
> asserts. Clear it with a mirror catch-up.

### `EXPECTED-RED`, not findings

Sibling gates that fired **because a fixture was deliberately broken** are
labelled and do not count toward any twice-failed stop:

- **C2 and C3** (mirror corrupted / deleted): `Static gates`,
  `Static architecture, derivation, preservation and mutations`,
  `Every curated and rail key resolves to exactly one entry`,
  `Mirror equals the canonical shelf`, `Gates are proven red, not just green`.
- **C1 and C4**: `Mirror equals the canonical shelf` only.

On **C4**, whose tree is `main`'s own state plus one document, that single red is
the correct one: the advisory guard that *owns* whether the mirror is current
says no, while the live leg stops punishing an unrelated pull request for it.
That division of labour is the point of the repair, not a side effect.

`Gates are proven red, not just green` is **green** on C4 and on #191. The repair
breaks no meta-gate. An earlier reading of mine that called it red was counting
still-running checks as failures; corrected on measurement.

### One residue

The five `DL-CONTROL/*` branches **could not be deleted** — HTTP 403 from both
`git push --delete` and the refs API. This session can create refs but not remove
them. The four scratch **pull requests are closed**, which is what §D2.3 requires;
the branches remain and are listed in §7 for a one-tap cleanup. Two routes were
tried and then it was left alone, per §D0.2(5).

---

## 3 — Merge state of the three held pull requests

All three landed. None needed an override, and none was offered one.

### #191 — the mirror catch-up, and the repair itself

**MERGED** `f41a9e32a9cc82ac759367e111bf2266a14d6208`, by the normal button on
green. Head at merge `95828d894f292783b476eb1e943418d81fe4d362`; **14 checks, 0
red**, including the context that had been unpassable.

The order's four post-merge conditions:

| §D3 | required | measured |
|---|---|---|
| 3.1 companion change is documentation-only, **by structure** | AST/parse-level strip, not a visual read | **1,473 elements and attributes identical in order; 377 text nodes, exactly 6 differing, all prose.** The six are the same six games whose `desc` moved in the canonical, so the R7 chain is coherent end to end |
| 3.3 pathway-facet delta | **ZERO** | `549 -> 549`; **0 gained, 0 lost, 0 changed on `pathway`**. The `558 -> 549` loss is #190's: measured `558` before it, `549` after it, `549` after #191 |
| 3.4 `routes-serve-200` green; R4 line once per page | green; exactly once | `Routes serve 200 and removed paths 404` **success** on merged `main`. The R4 line appears **exactly once**, on `/for/councils-organisations/`. `/for/parents-carers/` matched a safety grep twice, but those are two different sentences — a FAQ answer and a footer note — not a doubled warning |
| 3.5 mirror clean **by two instruments** | two, and not both the check I changed | **(1)** `tools/render_games_manifest_mirror.py --check` against the Games checkout — no network, no CI: `ok mirror is byte-identical to the canonical (28805 bytes, sha256 f4aab9ab92413d9d)`. **(2)** `Shelf mirror is not stale` — `shelf-mirror-guard.yml` on push to `main`: **success**. Neither is the leg this pass edited |

### #192 — the FC arc close record

**MERGED** `72c31ba5d9077623b912137ff4439bb2fbce70cb`. Head
`647669403619369a8e60ae25900f0b0c1fa7cec8`; **5 reporting checks, 0 red**, all
four required contexts present — so it is measured, not merely quiet. §D4.4's
trap does not apply.

It was **not** merged on a green check. §D4.3 gates a close record on provenance,
and every row was re-derived first:

| class | count | result |
|---|---|---|
| resolvable hex tokens | 24 | all resolve, to the object each is named as |
| tokens recorded as **not** resolving | 3 | `7e4a11b`, `a19f02c`, `d83e102` — correctly marked. They are quoted as an earlier record's *false* claims; their failure to resolve is the finding |
| run ids | 4 | all exist, each with the branch and conclusion stated |
| PR references | 10 | nine site PRs merged as stated; **`#41` is a Games PR**, verified from the Games tip, not the site API |
| counts | — | `558 -> 549`, `717`, `64`, `28,805 / 28,722`, `755,918` all reproduced |

Two verified against a different repository than the text might suggest:

```
Games tip 43b29f79231115740abc9ffc3c2bee64743aa8d8
  Z3: apply the six verified descriptions to games.json … (#41)
  committed 2026-08-26T15:30:41+01:00  ==  14:30:41Z   <- as the record states
```

**No row failed, so nothing in it is retracted.** Its one open item — #191 blocked
on a click, patch not applied — is now closed, and the three rows naming #191's
pre-merge head are **annotated beneath as stale, not rewritten**. That work
stands.

### #194 — teacher task deep links

**MERGED** `ed0a1ba32ea994558100c4695fb2880fcda4c2b1`. Head
`2b92b5e08cd5051edd27df29bef04e3eb98cfe75`; **12 reporting checks, 0 red**.

It arrived as a relayed report from another agent, so it was measured here
before it was allowed to land.

**§D5.1 scope.** Seven paths, each accounted for: two renderers gain the
fragment (one line each), two generated pages carry that output,
`assets/mbm-search.js` handles fragment/reveal/invalid-task/popstate, the gate is
rewritten with a `--self-test`, the workflow wires three steps. **Nothing on the
stop list** — not the search index (`data/mbm-search-index.json`) nor its
generator (`build_mbm_search_index.py`); `mbm-search.js` is the client runtime.
No manifests, no unrelated audience pages, no lesson or games data, no
account/mailing/privacy code, no broad churn.

**§D5.2 the defect, re-derived.** Journey started at `/for/teachers/`, not
`/teach/`. On 390 x 844 the deep link set the query and the `<select>` correctly
and left the workspace **3,522 px from the viewport top — 2,678 px below the
fold**. The relay said ~2,266 px; an earlier pass ~3,314 px. **Both are
historical. This is what was measured here** — and the gate's own self-test,
written independently, reports the same `3522px`.

All six cards, both viewports, after the fix:

| card | query | filtered count | workspace top | masthead bottom |
|---|---|---|---|---|
| `teach-a-lesson` | `?task=teach-a-lesson` | 148 | 156 / 167 px | 67 / 73 px |
| `plan-a-sequence` | `?task=plan-a-sequence` | 459 | 156 / 167 | 67 / 73 |
| `assess-understanding` | `?task=assess-understanding` | 92 | 156 / 167 | 67 / 73 |
| `capture-evidence` | `?task=capture-evidence` | 91 | 156 / 167 | 67 / 73 |
| `manage-learner-information` | `?task=manage-learner-information` | 12 | 156 / 167 | 67 / 73 |
| `create-a-resource` | `?task=create-a-resource` | 192 | 156 / 167 | 67 / 73 |

Every one: pathname `/teach/`, fragment `#teach-search-workspace`, a **real
`<select>`** carrying the matching value, a **derived non-zero count strictly
below the unfiltered 716**, the workspace intersecting the viewport below the
sticky masthead, and **zero console or page errors**. Both renderers confirm the
generated HTML byte-reproducible in `--check`.

**§D5.3 the negative control — the part that decides whether the gate is real.**
The contract was severed *by hand*, with everything else left intact: URL, query,
fragment, `<select>` value, result count unchanged, source card still findable.
The gate redded, and every failure named visibility:

```
workspace is outside the viewport (top=1468.83, height=800)
heading is not visibly below the header (top=1562.6, header=73)
the destination heading is covered at its hit-test point
workspace is visually suppressed ({"opacity":0})
task control is outside the visible area
focus is A#, not the destination
```

Not a 404, not a missing asset. The gate's own `--self-test` says the same thing
from the other direction: *"URL, task, aria-current and 148 results stayed valid
while the workspace remained invisible at top=3522px on 844px."* A gate checking
only the URL, the selected value or the count would have accepted the original
defect. **This one would not.** In CI on the merged head, the step named
`Teacher task visibility gate proves it can fail` is **green**.

**One first attempt is recorded because it failed instructively.** The initial
severing edited the two renderers — which have no `--write` flag — so the
generated HTML was never regenerated, the gate ran against an unsevered tree,
and it passed. *A control that does not reach the instrument's real input proves
nothing and looks exactly like a pass.* Caught, and redone against the bytes the
browser actually loads.

### §D5.4 — the post-merge readback, and what it could not reach

Pages deployed the merged commit: **`pages build and deployment` success, run
`33025499394`, head `ed0a1ba`.**

**What was measured on live bytes, in CI, after that deploy:** **18 checks on the merged head, 0 red**, and the five that read production are all green: `verify-live`, `Exact production deployment and live browser proof`, `The origin is serving the commit we think it is`, `What a browser actually renders`, and `Routes serve 200 and removed paths 404`. So the deployed surface is the merged tree.

**What was not, and why — stated rather than glossed.** The order asks for one
card tapped end to end on live, and the no-JS fallback reaching a real page. A
*browser* journey against production could not be run:

- This container cannot reach the site. `madebymatt.uk:443` is refused by
  organisation egress policy — the proxy records
  `connect_rejected · gateway answered 403 to CONNECT`. The estate already knows
  this; `agx1-live-verify.yml`'s own header says so, and CI is the channel.
- **CI has no channel for it either.** No workflow fetches `/teach/` or
  `/for/teachers/` from `madebymatt.uk`, and neither route appears in
  `derive_live_routes.mjs`'s derived set. The #194 gate *does* accept
  `BASE=https://madebymatt.uk` and carries a `phone/no-js/` journey, but nothing
  sets it, so it has only ever run against a checked-out tree.

So both journeys were run with a real browser against **the exact bytes that
merged**, and CI separately proves the deployed surface carries the merged tree.
That is transitive, not direct, and it is labelled as such. The six-card journey
is tabled above; the no-JS journey — JavaScript disabled, mobile viewport, all
six tasks, each card activated at a whitespace point — asserts that the URL lands
at `/teach/?task=<id>#teach-search-workspace`, that the **native** fragment puts
the workspace visibly below the header without any script, that the filter does
**not** falsely claim to be applied (`task === ''`), and that a visible section
carrying real links and the words *"filters need JavaScript"* is present. It
passes.

**Wiring a live-`BASE` run of that gate is the honest fix, and it is its own
pass** — listed in §7, deliberately not widened into this one.


---

## 4 — The blindness. This is the more important half of the pass.

The deadlock is the loud half. This is the one that mattered.

**Before this pass, a pull request that deleted the shelf mirror passed the check
that exists to protect it.** Not by a subtle race — structurally. The leg read
`data/source-manifests/games.json` from the `main` checkout, so a pull request
that deleted the file from its own tree was measured against `main`'s intact
copy and called clean. A pull request that *corrupted* the mirror passed the
same way. The gate written to make the 2026-08-12 two-hand-written-shelves
incident impossible to repeat silently could not, in fact, see that class of
change at all.

The reason is the same one that produced the deadlock: **the check was reading
the wrong side of the comparison.** Reading `main` made it unfixable by any pull
request *and* incapable of failing one. One defect, two faces, and the quiet face
was the dangerous one.

Both are closed, and closed with evidence rather than argument: **C2** (corrupt)
and **C3** (delete) are red in CI, on real runs, at the mirror leg itself. Three
cases that used to pass now block; exactly one case that used to block now
reports, and it reports loudly.

---

## 5 — Register lines to carry forward

- *A control that fires on every PR is a deadlock, not a control — repair the
  comparison basis, never the requirement.*
- *A check that reads the wrong side of the comparison can be simultaneously
  deadlocked and blind.*
- *An approval is not a completion; tooling permission is not authorisation.*
- *A relayed fix is a hypothesis — measure it before you land it, however good
  the report reads.*

Two more this pass earned, offered rather than asserted:

- *Two operands cannot separate two facts that produce the same observation.
  Count the facts before trusting the boolean.*
- *A control that does not reach the instrument's real input proves nothing and
  looks exactly like a pass.* Recorded because it happened here: the first
  attempt at #194's negative control edited renderers that have no `--write`
  flag, never regenerated the HTML, and the gate passed against an unsevered
  tree. It read as a clean result.

---

## 6 — Handback to Matt. Three items.

**1 — Annex A.** Are those four take texts his own words, and are they meant as
whole-take replacements? Quarantined this pass and untouched.

**2 — B2 / ASDAN, Vocational Taster withdrawal.** Registrations to **31 Dec
2026**, final certification **31 Aug 2027**. **Hospitality is on that clock;
Gardening is not.** **RoadWise Short Course is being withdrawn on the same two
dates** — someone needs to check whether LAUNCH or PSHE depends on it. Matt and
Cheryl, real learners and real money.

**3 — The councils Section 19 sentence, if he wants one.** His to write. The
citation exemption gets built in the same change if he does.

---

## 7 — Not handback items, recorded for the record

- **Five `DL-CONTROL/*` branches remain on the remote** — deletion refused 403,
  and not routed around. Their pull requests are closed and none was merged:
  `DL-CONTROL/c1-wrong-served-byte`, `c2-corrupt-mirror`, `c3-delete-mirror`,
  `c4-untouched-mirror`, `c5-drift-reds-off-pr`.
- **R2 still stands.** `Mirror equals the canonical shelf` is advisory in *both*
  repositories. Making it required is the cheapest high-value item left, and it
  is a branch-protection change — Matt's, not this order's.
- **A live-`BASE` run of the teacher deep-link gate has never happened.** The
  gate supports `BASE=https://madebymatt.uk` and carries a `phone/no-js/`
  journey, but no workflow sets it, so it has only ever run against a
  checked-out tree. Wiring that up is its own small pass, deliberately not
  widened into this one.

---

## 8 — The Micro-Tinkerer site publish: the blocker is gone, the red is not yet cleared

PR **#193** (`claude/mtr1-micro-tinkerer`) was held behind the same required
check as everything else — and still shows it red, because its newest run
predates the repair:

```
#193 head 2382500  base cb435f4 (main is now f41a9e3)
  7 checks, 1 red: Fetch the live estate and compare to raw-at-SHA
```

**The cause of that red is removed, not the red itself.** #192 and #194, updated
onto the repaired `main`, both went green on that exact context — so #193 needs
only a branch update and a re-run to follow them. Stated that way deliberately:
it has not been demonstrated green, and claiming otherwise would be the kind of
plausible-sounding row this arc keeps catching.

**It is its own pass. It was not touched here.**

**Sentinel:** `mbm-deadlock-lift-2026-08-26-DL-BOTTOM`
