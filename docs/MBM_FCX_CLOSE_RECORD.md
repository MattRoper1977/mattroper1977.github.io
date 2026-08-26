# ORDER FC-X — the clearance. The FC arc closes here.

**2026-08-26.** FC-Z left one thing an agent cannot do. This order did everything
either side of it, and one thing FC-Z had recorded as unverifiable turned out to
be verifiable after all.

| repo | tip |
|---|---|
| `mattroper1977.github.io` | `cb435f4` (pin held) |
| `MattRoper1977/Games` | `43b29f7` (pin held) |
| `MattRoper1977/Lessons` | `288f845` (pin held) |

---

## §X6.1 — Per section

### §X0 — Readback · **COMPLETE**

All three pins matched. #191 open, not draft, head `7d6f9e4`,
`mergeable_state: blocked`, red on exactly one context.

The workflow file on main is byte-identical to before FC-Z's reverted
experiment: `sha256 50702afefaff1497…`, 20,047 B, last touched by `4d355e8`
(Order TS), and the working tree diffs against it by zero lines. The experiment
left no trace.

**Measured:** every number above. **Inferred:** nothing.

### §X1 — The mirror leg · **STOPPED at §X1.2, as the order requires**

The required context has **not** changed. §X1.2 and stop condition 2 say the
section prints the click path and stops, and does not attempt the workflow
commit. It stopped.

What it produced first, so the click is an informed one:

**The load-bearing fact, measured rather than assumed.** Option B's whole case
rests on `_tools/` being "the tree the pull request would produce". That was
asserted in FC-Z. It is now shown:

```
refs/pull/191/head    7d6f9e4…
refs/pull/191/merge   20ac80b…
  parents             cb435f4 (main)  +  7d6f9e4 (the PR head)
mirror at merge ref   f4aab9ab   <- the repair
mirror at main        4b3787eb   <- the drift
```

The merge ref *is* main with this pull request applied — §X1's first ACCEPT
bullet, satisfied by the ref's own parent list. And the consequence that
defeats the "quiet on main" charge: a pull request that does not touch the
mirror produces a merge ref whose mirror is main's, so drift is **inherited**
and still reds every pull request except the one that repairs it.

**§X1.1's fifth case, run.** The four cases were re-derived from the patch **as
recorded in the doc**, not from the scratch file left over from the experiment —
if the two disagreed, the record is what Matt would be approving. All five as
required, including a planted genuinely-wrong served byte (`rc=1`). Not an
amnesty.

**Three divergences in the TIGHTENING direction, which FC-Z had missed.** The old
step does not merely deadlock — reading main makes it blind to the regression it
is named for. A pull request that **corrupts** the mirror passes it. A pull
request that **deletes** the mirror passes it, by falling through to main's copy.
Both red under the patch. There is exactly one loosening divergence and it is the
sanctioned one.

**Measured:** the merge ref and its parents; the five cases; the divergence
table. **Inferred:** nothing — the checkout semantics were verified from the ref,
not from documentation.

### §X2 — #191 pickup · **NOT STARTED — its gate has not opened**

§X2 begins "the moment the check clears". It has not cleared. The before-image
§X2.1 will compare against is captured and printed below, so the delta cap can be
run the instant it does.

### §X3 — Section 19 · **CLOSED PERMANENTLY**

`X-D3`. Not "unbuilt pending work" — closed. `data/statutory-citations.json` was
**not** created; there is no token to license. The count gate was **not**
modified; it was never wrong. The item does not return to any appendix as open,
and it is struck from §X6.4 below.

It moves to the Matt-only list in one form only: *if he writes a councils
sentence naming Section 19, the exemption is built in the same change and its
three-way proof becomes possible for the first time.* Until then nothing is
outstanding.

### §X4 — The production-verification hole · **CLOSED, and it changed an answer**

A report-only leg was added to the live job, fetching
`https://madebymatt.uk/data/mbm-search-index.json`. Non-blocking by `X-D4`, and
placed **before** the mirror leg deliberately, so it still reports while that leg
is red.

Proven in four cases before it was proposed — including §X4's required one, a
planted regression, which the report names (`game-apexcurl ('BUILD',)`) while
still exiting 0. All four exit 0: report-only means report-only.

Then it ran against production. Run `32986126849`, step 12, **success**:

```
== live search index, as served ==
   https://madebymatt.uk/data/mbm-search-index.json
   control  cmp distinguishes a one-byte mutation — the comparisons below are live
   served   755918 B a62664db604073f3
   main     755918 B a62664db604073f3
   MATCH    the served index is byte-identical to the deployed tree
   ref      756001 B fe3b43543150fcf8   (this pull request changes the index)
   census   717 records served · 64 in the game class
   census   game records carrying a teaching pathway (BUILD/GROW/LAUNCH): 0
   census   none — the class exclusion holds AS SERVED
```

**This supersedes a claim in the FC-Z close record**, which is annotated rather
than rewritten. FC-Z said §Z2's change was verified against the committed tree
and a local reproduction, and labelled the "deploy probably completed" step as
the inference it was. That was the honest thing to write with the coverage then
available. FC-X treated the gap as a coverage hole rather than a reporting limit,
and the fetch settles it: **§Z2's change is live-verified.** The guess happened to
be right; it is the fetch, not the guess, that establishes it.

### §X5 — Takes · **REPORT-ONLY, unchanged**

`games/index.html` byte-unmodified — zero-line diff against `origin/main`. The
pin is **17/17** at head and was proven able to fire.

**The fires-on-mutation proof failed on its first attempt, and the failure is
worth more than the pass.** Mutating one byte of a take in the working tree left
the pin **green**. The reason is in the verifier's own output — `16109 B at HEAD`
— and its docstring: it resolves content from the **committed blob**
(`git show HEAD:<path>`), by design, because in CI HEAD is the thing under test.
A working-tree edit never reaches its input. Re-run with the mutation committed
inside the scratch worktree:

```
curation: the per-game takes and rail slots is unchanged from the pin
  FAIL — HEAD 275af49ad2e81264… vs pin 1f1f6b111c40e17a…
takes pin: 16/17 passed          rc=1
(mutation dropped)               17/17 passed   rc=0
```

A control that does not reach the instrument's input proves nothing — and it
looks exactly like a pass.

**Annex A remains quarantined:** not copied into any file, commit message, pull
request body or this record; not compared against the existing takes; not treated
as answers to FC's four punctuation questions.

---

## §X6.1b — The §X2.1 before-image, captured at `cb435f4`

Per-record, not just totals: a count can hold steady while two records swap.

```
records                 717
carrying a pathway      549
no pathway              168
excluded categories     ['game']
records in that class   64
of those, with pathway  0        <- must stay 0
```

And what #191 would do to it, computed on the merge ref:

```
records                        717   (delta +0)
records whose pathway changes  0     <- the delta cap
GAINED a facet                 0     <- the assertion
LOST a facet                   0
```

#191 moves **zero** pathway facets. When the gate opens, §X2.1 re-runs this
post-merge; anything other than these numbers reverts and stops.

---

## §X6.2 — Four for the estate register

**1. An instrument can be contaminated by what it is measuring.** `git show
<commit> -- <file>` prints the commit message **above** the diff, so a grep for
the token you are hunting finds your own search's metadata. FC-Z's first
per-file pass reported `Section 19` on the councils page and it was false.
Partition the output before reading it (`--format=` emptied, or diff-only). This
applies to `git log --grep`, `git show`, pull-request-body greps and CI log
scrapes alike. Positive control first; only then does an absence mean something.

**2. A control that fires on every pull request is a deadlock, not a control** —
and the repair is the comparison basis, never the requirement. Same shape the
estate has already paid for twice.

**2b (added by this pass).** The same misaiming that deadlocks a check can also
make it **blind**. The mirror leg read main, so it could not fail a pull request
that corrupted or deleted the mirror — green on the exact regression it is named
for. When a check fires on everything, also ask what it has stopped being able to
see.

**3. A production check that never fetches the artefact that changed is not
production verification.** Writing "verified against the committed tree and a
local reproduction" is honest reporting of a coverage hole — but the hole is
then a thing to close, not a formula to reuse.

**4. A halt can become a ruling.** §Z4 stopped on measurement and that
measurement closed the question permanently. Not every stop is a debt to be
repaid next pass.

**5 (added by this pass). A control has to reach the instrument's input.**
Mutating the working tree to test a gate that reads the committed blob proves
nothing, and the null result is indistinguishable from a pass. Before trusting a
red-proof, check that the thing you perturbed is the thing the instrument
actually reads.

---

## §X6.3 — Matt-only, in one list

**1 — The click.** Option B in `docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md` (see its
FC-X amendment) qualifies under §X1's acceptance criteria. Option A qualifies
only as §X1's recorded, dated, single-PR expiring exemption; an unrecorded admin
merge repairs the instance and preserves the defect. Option C does not qualify.

**1b — One cheap companion click, and it is not optional if Option A is chosen.**
`Mirror equals the canonical shelf` is **not a required context in either
repository**. The recorded ruleset strings are site → `Fetch the live estate…` /
`Static gates` / `Gates are proven red…` / `verify`; Games → `contract` /
`aggregate`. That guard is what independently checks the mirror against the Games
repo rather than against the served bytes — the answer to the hardest objection
to Option B — and it is currently advisory. Making it required in both repos
carries most of the remaining value for one click.

**2 — Annex A.** Are those four texts your own words, and are they intended as
whole-take replacements? No take moves until you answer.

**3 — B2, with Cheryl.** ASDAN is withdrawing **all** Vocational Taster titles:
registrations and student books to **31 December 2026**, final certification
**31 August 2027**. LAUNCH **Hospitality** is a Vocational Taster and on that
clock. **Gardening is a Short Course and is not.** Also on the same two dates and
not previously on the list: **the RoadWise Short Course** — check whether
anything in LAUNCH or PSHE depends on it.

**4 — Section 19.** Only if you want to write the councils sentence. Nothing is
pending otherwise.

---

## §X6.4 — The FC appendix, inherited

Verbatim from ORDER FC, **minus C4** (closed at FC-Z §Z1), **minus B2** (handed
back above), **minus the Section 19 item** (closed at §X3), with **A1 amended**
and one item added.

> **A1 — The tag backfill.** `data/tag-backfill.csv`, 641 rows, four fields
> pre-filled and four tag fields deliberately empty (never seeded with the
> discarded derivation — the spot-check was 12/20 against an 18 threshold, so the
> whole derivation was binned). Parked at S5 with the ruling: **tag the ~30
> resources Matt teaches from in the first fortnight, then decide.** This is the
> single highest-leverage queued item — it is the blocker under A2 *and* under
> the faceted filter's multi-select.
>
> **AMENDED: A1 blocks TWO things.** A2's pupil card badges, and the pathway
> classifier's whole-field flip. §Z2 excluded the arcade **as a class** because
> that is the honest fix available today — the classifier still derives `pathway`
> by word-matching prose, so an ordinary verb in an ordinary sentence still files
> a record under a teaching pathway. The real repair is a declared tag field per
> record, which is A1. Until it lands, the class exclusion is a fence around the
> arcade rather than a repair of the mechanism, and every new description is one
> verb away from the same defect.

> **A2 — Pupil card badges** (device · controls · quick-play · silent-friendly).
> The audit pack proposed them; Order S already settled the *design* —
> non-interactive on pupil surfaces, interactive and ≥44px on teacher surfaces,
> one component, two call sites. **Blocked on A1**: the record carries `subject,
> type, family, year` and nothing that yields a device or control tag. Do not
> derive these; that path was already measured and discarded.

> **A3 — `data/declared-fiction.json`** as a standalone deliverable if §FC6.7
> ledgers rather than builds it. Cheap, useful beyond the gate, and it converts
> "everything is invented" from a claim into a checkable record.

> **A4 (NEW, from §X4).** Promote the search-index live fetch from reporting to
> blocking. Deliberately not done in the pass that unwedged the job it lives on —
> a new blocking leg on a just-unwedged job is how the deadlock happens again.
> Promote once it has been green across several merges. Two things to build in
> when promoting: `curl -f` plus a parses-as-JSON guard, and a deploy-lag
> tolerance, or it reds at every merge during Pages propagation.

> **B1 — The two public ASDAN PDFs.** Each carries one stale "BUILD — an Award"
> sentence, mirroring what PH-3's C1 fixed in `asdan/app.html`. PH-3 C5 stopped
> correctly: **no PDF generator exists in the site repo.** This is a
> regeneration-day item, not a patch — it needs the generator question answered
> first.

> **B3 — The 10-hour rule workbook fix.**
> `Planning/LAUNCH/LAUNCH_Autumn_Year_Plan_ASDAN.xlsx` repeatedly asserts a
> 10-hour rule on ComSk1 ("THE 10-HOUR RULE IS THE DESIGN CONSTRAINT"). It is
> false — the gate is on the other five skills. Proposed cell fixes sit in
> `_passph3/JOB_A_REPORT.md`, values-only, listed cells only. **Verify whether
> they were applied; do not assume either way.**

> **C1 — The `/for/` cross-link graph is asymmetric.** Each audience page offers a
> "switch to…" link, but the graph is not closed: several audiences are linked
> *from* nowhere. Audit all seven, build the full matrix, and close the loop — a
> reader who lands on the wrong page should be one link from the right one, in
> every direction. Cheap, and it compounds with the findability work.

> **C2 — The teachers-page video claim.** The page describes an owner-controlled
> demonstration. Verify whether it is a genuine click-to-load facade or an
> embedded player that loads on page view — the claim is only true in the first
> case. **Verify before rewording; do not reword into a stronger claim.**

> **C3 — The trusts page.** FC only reconciles it (`TRUSTS=reconcile-only`)
> because the audit pack supplied no markup for it. It is consequently the
> least-worked of the seven and probably the weakest. Worth its own small pass
> once FC lands.

> **C4 — PH-3 PRs #133 (Lessons) / #168 (site).** Order TS set `PH3_MERGE=yes`, so
> these are *probably* merged. **Verify, do not assume** — and if merged, confirm
> the guidance-hidden-by-default toggle behaves on a real deck at 390px.
>
> *(Appendix C4 is a different item from the safeguarding C4 that FC-Z §Z1
> closed. Two registers, one label. Noted so a later pass does not conflate them:
> only the safeguarding one was ruled on.)*

> **D1** — UAS centre name and number (`#set-centre`, `#set-cno`): on-device
> storage, values only Matt holds.
> **D2** — The eyeball tap-list from the TSR close.
> **D3** — Deferred Lessons and Apps rulesets: SAT-F §2 gated them. Re-run
> `report_required_checks.py` and create them when the deferral reason has
> genuinely expired.

Plus the mirror-leg follow-ups R1–R5, recorded in
`docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md` rather than here, since they only become
actionable once the click in §X6.3 is made.

---

## A note on CI during this pass

Six workflow runs on `7d6f9e4` behaved anomalously: two `startup_failure` with
**zero jobs** — including `Professional site design audit`, a workflow this pass
never touched — one job cancelled after fifteen minutes without executing a
single step, and four workflows that had run on the previous head producing no
run at all.

That is Actions capacity, not this branch. It was established rather than
assumed: a `workflow_dispatch` of the same workflow file on the same branch
**completed normally**, which is also what proves the §X4 YAML is valid. The
failure is recorded here rather than smoothed over, because "startup_failure
right after I edited a workflow" is exactly the shape that invites a wrong
conclusion in either direction.
