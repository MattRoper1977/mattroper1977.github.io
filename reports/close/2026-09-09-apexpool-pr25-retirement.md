# Retiring the held-PR-25 assertion in apexpool-home-verify.yml

**Decision record.** SW2-F §W1, under §R1.1 and §R1.3(a). One assertion retired;
nothing else in the workflow changed.

---

## What was there

`.github/workflows/apexpool-home-verify.yml` carried a step,
*"Verify held PR 25 remains untouched"*, which fetched PR #25 from the API and
asserted three things:

```
assert p['state'] == 'open'
assert p['merged_at'] is None
assert p['head']['sha'] == '7c202790115ca5de5f71babb570b806e5e57a4aa'
```

Its own comment explained the intent: #25 was **held** — *"AJAX safety net, do
not merge until activation is settled"* — and the step asserted it had not moved
while the homepage changed underneath it.

## Why it is retired rather than derived

**Measured, not assumed.** PR #25 is `state: closed`, `merged: false`,
`closed_at: 2026-09-07T14:45:37Z`, `head.sha: 7c202790…` — unchanged. So two of
the three assertions still hold and only `state == 'open'` fails. It fails on
every pull request that touches `main/index.html`, which is this workflow's own
trigger path, and the failure says nothing about the homepage the workflow
exists to guard.

**§R1.1 rules that #25 is closed and stays closed.** The homepage it was written
against was rebuilt by UX2 B2 — `UX2_LEDGER.md`, *"Part B2 — the homepage and
`/commission/` (`domain-split/preview-template.html` §view-home …)"*. A check
asserting anything about #25 asserts a dead fixture.

**Derivation is not available here.** §R1.3(b) says a pin on homepage state gets
derived from the served composed tree rather than re-pinned. That does not apply:
the subject is the lifecycle of a closed pull request, not a property of the
tree. There is no served fact to derive it from. §R1.3(a) — *"if the check
asserts #25 open/unmerged/held → delete the clause"* — is the applicable shape.

## The shape this belongs to

The **fifth** instance of the A-6 pinned-assertion shape in this one file. The
third and fourth are recorded in its own comments and were both converted to
derived form:

* the hardcoded `12` door count, *"RED ON MAIN'S OWN BASELINE since 6e8ab12
  (site#44) took doors to 14"*;
* the baseline captured from `origin/main:index.html`, which stopped being the
  homepage when #110 gave `/` to the chooser — and which *"turned all four
  mutation families vacuously green"* because the crash counted as a rejection.

Register line, `reports/close/2026-08-05-apexrally-landing.md`:

> Four further instances of the A-6 pinned-assertion shape were found blocking a
> correct fifth game and converted to derived form … **Each replacement was
> checked to be no weaker than the pin it replaced.**

That standard is met the only way it can be for a retirement: what the step
protected — that a held PR was not quietly advanced — cannot be weakened by
removing it, because the PR it watched is closed and its head SHA is unchanged.
Nothing that was true when the step was written has stopped being true; the
thing it watched simply ended.

## What still guards this workflow

Unchanged, and re-proved in both directions rather than assumed:

| | |
|---|---|
| served tree | `ALL 56 APEX TENNIS HOMEPAGE STATIC GATES PASSED`, exit 0 |
| Apex Pool route dropped in a scratch copy | `FAIL  Apex Pool card keeps exact href and hue`, exit 1 |

Also standing, untouched: the pinned release identities for `apextennis/index.html`
and `apexgolf/index.html` (deliberate release pins that must go red when a game
moves, not homepage state from #25's era, so §R1.3(b) does not reach them), the
derived door baseline, the idempotency check, the four planted static failure
families, and the JavaScript-on/off render gates.

## Not done

No other assertion was touched. No count or hash was re-pinned. No workflow
trigger, permission or condition changed. This is the one workflow edit SW2-F
permits, on the terms §R1.3 sets.
