# A required check that no change can turn green

**Raised 2026-08-26 during ORDER FC-Z §Z3. Diagnosed and a fix verified. NOT
APPLIED — it needs Matt's word, because applying it edits a required status
context.**

---

## What happened

Games [#41](https://github.com/MattRoper1977/Games/pull/41) merged at `43b29f7`,
moving the canonical shelf from `4b3787eb` (28,722 B) to `f4aab9ab` (28,805 B).

Site PR #191 is the catch-up: it regenerates `data/source-manifests/games.json`
from the new canonical, byte for byte, using
`tools/render_games_manifest_mirror.py --write`.

Thirteen of its fourteen checks are green. The fourteenth —
**`Fetch the live estate and compare to raw-at-SHA`**, a *required* context — is
red, and it cannot be made green by any change to this pull request.

## Why it cannot

That job's first step is deliberate and correct:

```yaml
- name: Check out main (the deployed tree)
  uses: actions/checkout@v4
  with:
    ref: main
```

Most of the job verifies **live surfaces** — is what production serves the same
as what main committed? For that, main is rightly the subject, because main is
what was deployed.

But one step near the end is not that. It asserts a **repository invariant**:

```yaml
- name: Shelf mirror equals the served canonical, byte for byte
  run: |
    curl -sS ... https://madebymatt.uk/Games/games.json -o /tmp/canonical.json
    if cmp -s /tmp/canonical.json data/source-manifests/games.json; then
```

`data/source-manifests/games.json` there is **main's** copy, because main is
what step 1 checked out.

The canonical lives in a different repository. So the instant Games merges a
shelf change, main's mirror is stale — and *nothing in the site repository can
pre-empt that*. The only thing that can clear it is a site pull request. This
step reds that pull request. Including the catch-up. Including this one.

Observed, verbatim from run `32980981169`:

```
  FAIL data/source-manifests/games.json is not the served canonical:
       mirror    28722 B 4b3787eb97249b3f      ← main
       canonical 28805 B f4aab9ab92413d9d      ← served
```

`28722 B / 4b3787eb` is main's mirror. PR #191's mirror is `28805 B /
f4aab9ab` — identical to the canonical. The pull request is correct and the
check is reading the wrong tree.

## The line the job already draws

The fix is not new reasoning. It is the job's own comment, applied one step
further down. From the second checkout:

> Step 1 deliberately checks out `ref: main` — the deployed tree is the
> **SUBJECT** of this gate and must not be the branch. But the tools that do the
> measuring are the **INSTRUMENT**, and on a pull request the instrument under
> review is the branch's, not main's. […] **Subject from main, instrument from
> here.**

A repository invariant is neither. On a pull request it is a statement about
**the tree being proposed**. That is the ref, not main.

And the third checkout already rules on exactly this ownership:

> the mirror is a copy: `shelf-mirror-guard.yml` owns whether the copy is
> current, and a live gate should be held to what the estate actually sells, not
> to a mirror that may be mid-drift.

`Mirror equals the canonical shelf` — the sibling gate that reads the ref —
**passed on #191.**

## The proposed change

Assert on the ref's mirror (`_tools/data/source-manifests/games.json`, already
checked out by step 2). Keep measuring main's, and keep printing it — but stop
failing pull requests for it.

Two further things it gains: a **negative control** that runs before any
assertion (mutate the fetched canonical by one byte, require `cmp` to notice, or
report `MEASUREMENT INVALID`), and a **fail-closed** branch if the ref's mirror
is missing, so an absent file can never fall through to main's copy and be
called a pass.

The full patch is at the bottom of this file.

## Is it weaker?

No, and this is the part that had to be proven rather than argued. The two
readings differ in **exactly one** case.

Run against the real byte-streams from the incident:

```
=== POSITIVE: the incident itself — main drifted, ref carries the catch-up ===
     control  cmp distinguishes a one-byte mutation - the comparisons below are live
     main     DRIFTED - the deployed tree's mirror is not the served canonical
              main      28805 B fc8989980d89164d
              canonical 28805 B f4aab9ab92413d9d
              main's state, reported not asserted; the ref below is the assertion
     PASS     the ref under review mirrors the served canonical byte for byte
   exit=0

=== NEGATIVE 1: ref itself is drifted (an unrelated PR on a drifted main) ===
     main     DRIFTED - the deployed tree's mirror is not the served canonical
     FAIL     the ref under review does not mirror the served canonical:
              ref       28805 B fc8989980d89164d
              canonical 28805 B f4aab9ab92413d9d
   exit=1

=== NEGATIVE 2: ref mirror absent — must be MEASUREMENT INVALID, not a fallthrough ===
     MEASUREMENT INVALID: _tools/data/source-manifests/games.json is absent. […]
   exit=1

=== CONTROL: both clean (the ordinary green case) ===
     PASS     the ref under review mirrors the served canonical byte for byte
   exit=0
```

**Negative 1 is the one that matters.** A pull request that does not touch the
mirror carries main's copy of it, so a drifted main still reds every unrelated
pull request, exactly as before. The single case where the new reading differs
from the old is a pull request that *fixes* the drift — the one case that has to
be allowed to land.

## What is being asked

This edits a required status context. That is a click, not an inference, so it
is left here rather than applied.

| | |
|---|---|
| **Option A** | Merge #191 with a rules bypass. Clears the drift now; the deadlock returns on the next Games shelf change. |
| **Option B** | Approve the patch below. Clears the deadlock permanently. #191 then goes green on its own. |
| **Option C** | Neither — leave the mirror stale. Every site pull request stays red until the mirror is fixed, so this is not really an option. |

Nothing here has been applied. The working tree was restored byte-identical
after the patch was verified.

---

## The patch, verbatim

```diff
--- a/.github/workflows/agx1-live-verify.yml
+++ b/.github/workflows/agx1-live-verify.yml
@@ -255,15 +255,72 @@
       - name: Shelf mirror equals the served canonical, byte for byte
+        # ASSERTED ON THE REF UNDER REVIEW, not on main. The same principle as
+        # the instrument checkout at the top of this job, applied to the other
+        # half of the gate.
+        #
+        # Steps 8-11 verify LIVE SURFACES: is what production serves the same as
+        # what main committed? Their subject is necessarily main, because main is
+        # what was deployed. This step is not that. It asserts a REPOSITORY
+        # INVARIANT - the mirror is byte-identical to the canonical it mirrors -
+        # and a repository invariant on a pull request is a statement about the
+        # tree being proposed, not about the tree already deployed.
+        #
+        # Read against main it is unfixable by construction. The canonical lives
+        # in another repository, so when Games merges a shelf change the site's
+        # mirror on main is stale THE INSTANT IT LANDS, and the only thing that
+        # can clear it is a site pull request - which this step would red,
+        # including the catch-up PR that is the fix. A required context no change
+        # can turn green is not a gate, it is a stop. It happened: Games #41
+        # (43b29f7) moved the canonical to f4aab9ab and site #191, whose whole
+        # content was the catch-up, could not merge.
+        #
+        # Nothing is weakened. The ref's mirror equals main's mirror in every
+        # pull request that does not touch it, so a drifted main still reds every
+        # unrelated pull request exactly as before. The single case where the two
+        # readings differ is a pull request that FIXES the drift - the one case
+        # that has to be allowed to land. Main's state is still measured and
+        # printed below; it is just not the thing a pull request is failed for.
         shell: bash
         run: |
           set -euo pipefail
           curl -sS --max-time 30 https://madebymatt.uk/Games/games.json -o /tmp/canonical.json
-          if cmp -s /tmp/canonical.json data/source-manifests/games.json; then
-            echo "  PASS mirror is byte-identical to the served canonical ($(wc -c < /tmp/canonical.json) bytes)"
-          else
-            echo "  FAIL data/source-manifests/games.json is not the served canonical:"
-            echo "       mirror    $(wc -c < data/source-manifests/games.json) B $(sha256sum data/source-manifests/games.json | cut -c1-16)"
-            echo "       canonical $(wc -c < /tmp/canonical.json) B $(sha256sum /tmp/canonical.json | cut -c1-16)"
-            echo "       regenerate with tools/render_games_manifest_mirror.py --write, never by hand"
-            exit 1
-          fi
+          canon_h=$(sha256sum /tmp/canonical.json | cut -c1-16)
+          canon_b=$(wc -c < /tmp/canonical.json)
+
+          # NEGATIVE CONTROL first: a comparison that cannot fail proves nothing.
+          printf 'x' > /tmp/canonical.mutated
+          cat /tmp/canonical.json >> /tmp/canonical.mutated
+          if cmp -s /tmp/canonical.json /tmp/canonical.mutated; then
+            echo "  MEASUREMENT INVALID: cmp called a one-byte mutation identical to the original."
+            echo "  This step cannot discriminate, so a PASS from it would mean nothing."
+            exit 1
+          fi
+          echo "  control  cmp distinguishes a one-byte mutation - the comparisons below are live"
+
+          # Main's mirror: reported, for production honesty. Not the assertion.
+          if cmp -s /tmp/canonical.json data/source-manifests/games.json; then
+            echo "  main     the DEPLOYED tree's mirror matches the served canonical"
+          else
+            echo "  main     DRIFTED - the deployed tree's mirror is not the served canonical"
+            echo "           main      $(wc -c < data/source-manifests/games.json) B $(sha256sum data/source-manifests/games.json | cut -c1-16)"
+            echo "           canonical ${canon_b} B ${canon_h}"
+            echo "           main's state, reported not asserted; the ref below is the assertion"
+          fi
+
+          # The ref under review: this IS the assertion.
+          ref_mirror=_tools/data/source-manifests/games.json
+          if ! test -f "$ref_mirror"; then
+            echo "  MEASUREMENT INVALID: ${ref_mirror} is absent. The ref under review was not"
+            echo "  checked out, so this gate has nothing to assert on - and it will not fall"
+            echo "  through to main's copy and call that a pass."
+            exit 1
+          fi
+          if cmp -s /tmp/canonical.json "$ref_mirror"; then
+            echo "  PASS     the ref under review mirrors the served canonical byte for byte (${canon_b} B, ${canon_h})"
+          else
+            echo "  FAIL     the ref under review does not mirror the served canonical:"
+            echo "           ref       $(wc -c < "$ref_mirror") B $(sha256sum "$ref_mirror" | cut -c1-16)"
+            echo "           canonical ${canon_b} B ${canon_h}"
+            echo "           regenerate with tools/render_games_manifest_mirror.py --write, never by hand"
+            exit 1
+          fi
```

If the patch is applied, `tools/render_games_manifest_mirror.py`'s docstring
needs the matching amendment — it currently says the live leg compares against
"the committed mirror", which would no longer be true.

---

# AMENDMENT — ORDER FC-X §X1, 2026-08-26

The three options above were written before the patch had been adjudicated
against acceptance criteria. FC-X supplied criteria and this section applies
them. **Nothing here has been applied either.** The workflow file on main is
byte-identical to before the experiment: `sha256 50702afefaff1497…`, 20,047 B,
last touched by `4d355e8` (Order TS), confirmed by a zero-line diff.

## The load-bearing fact, now measured rather than assumed

The whole case for Option B rests on `_tools/` being "the tree the pull request
would produce". That was asserted, not shown. It is now shown:

```
refs/pull/191/head    7d6f9e4edeffb7f2ab4f7c343aa30046a318c33b
refs/pull/191/merge   20ac80b48af65f374b3a9f49cd63a3ed33440017
  parents             cb435f4 (main)  +  7d6f9e4 (the PR head)

mirror at the merge ref   f4aab9ab   <- the repair
mirror at main            4b3787eb   <- the drift
```

The merge ref is literally main with this pull request applied. §X1's first
ACCEPT bullet is satisfied by the ref's own parent list.

**The consequence that defeats "quiet on main":** a pull request that does not
touch the mirror produces a merge ref whose mirror IS main's. Drift is
*inherited*, not escaped — so it still reds every pull request except the one
that repairs it. This conclusion is robust even if the checkout resolved to the
head ref instead: a branch-point mirror would not match a moved canonical
either.

## §X1.1 — the fifth case

The four cases were re-run against the step reconstructed FROM THE PATCH AS
RECORDED ABOVE, not from the scratch file left over from the experiment. §X1.1's
case was added:

```
1 POSITIVE  main drifted, ref carries the catch-up ......... rc=0
2 NEGATIVE  main drifted, ref drifted too ................... rc=1
3 NEGATIVE  ref mirror absent ............................... rc=1  MEASUREMENT INVALID
4 CONTROL   both clean .................................. .... rc=0
5 NEGATIVE  SERVED bytes tampered, main+ref both correct ..... rc=1   <- §X1.1
```

Case 5 plants a genuinely wrong served byte. It still reds. The change is not an
amnesty.

## Three divergences in the TIGHTENING direction, not previously noticed

Adjudication surfaced something the original write-up missed. The old step does
not merely deadlock — it is **blind to the regression it is named for**:

| case | old step | patched step |
|---|---|---|
| a PR corrupts the mirror | **PASS** | RED |
| a PR deletes or sparse-checkouts the mirror away | **PASS** (fell through to main's copy) | RED, MEASUREMENT INVALID |
| both operands empty after a silent fetch failure | passes vacuously | RED, negative control |

Reading main made the old step structurally incapable of failing a pull request
that broke the mirror. The patch closes that in the same stroke as the deadlock.
There is exactly **one** divergence in the loosening direction, and it is §X1's
sanctioned one.

## Bullet 3, read honestly

> *main itself still reds on inherited drift. If it goes quiet on main too, the
> option is a demotion wearing a better name.*

**Read literally against this workflow the bullet is unsatisfiable, and always
was.** `agx1-live-verify.yml` has never run on push to main — its triggers are
`pull_request`, one dead build branch, and `workflow_dispatch`. There is no
main-triggered run for the patch to demote. Say that plainly rather than
claiming a red that does not exist.

Read as intent — drift stays visible and consequential — it holds three ways:
inheritance into every non-repairing pull request (the load-bearing one, proof
case 2); `workflow_dispatch` on main, where both operands are main's bytes; and
the guard pair below.

## The guard pair — and the thing that qualifies all of this

`shelf-mirror-guard.yml` exists in BOTH repositories and compares against the
Games repository rather than the served bytes:

| | site half | Games half |
|---|---|---|
| push | `main`, filtered to the mirror paths | filtered to `games.json` |
| schedule | `23 6 * * 1` | `24 6 * * 1` |

The Games half fires **at the instant the canonical moves**. It is red on today's
state by design. That is a main-surface signal `agx1` never had.

**But it is advisory, and that matters.** The recorded ruleset strings, re-printed
from `report_required_checks.py`, are:

```
site   "Fetch the live estate and compare to raw-at-SHA" / "Static gates" /
       "Gates are proven red, not just green" / "verify"
Games  "contract" / "aggregate"
```

`Mirror equals the canonical shelf` is **not a required context in either
repository**. So the independence guarantee that answers the hardest objection —
that a pull request cannot launder wrong served bytes into the mirror, because a
second gate checks the mirror against the Games repo — is currently advisory
too. **This does not sink Option B**, whose blocking assertion is unchanged in
kind. It does mean one cheap companion click carries most of the remaining
value.

## The options, corrected

| | verdict under §X1 |
|---|---|
| **Option B** — the patch | **QUALIFIES.** Blocking assertion moves to the tree the PR would produce; inherited drift is printed on its own named line and still reds every non-repairing PR; the served-bytes case still reds. What changed is the operand, not the matching rule — still `cmp -s`, byte for byte. The context stays required, estate-wide, untimed. |
| **Option A** — merge #191 with a rules bypass | **ONLY as §X1's fallback, and only if recorded.** §X1 permits "a single-PR, dated, expiring exemption recorded in this doc — named PR, named date, expires on merge, never a standing change". An unrecorded admin merge is not that, and it repairs the instance while preserving the defect: the next Games merge reproduces it identically, and the two tightening cases above stay uncovered. |
| **Option C** — do nothing | **DOES NOT QUALIFY.** Not neutral: every site pull request stays red for a reason unrelated to its contents, and the only file that can clear it is gated by the check it must change. |

## Follow-ups worth recording, none blocking

- **R1.** Step 12 never opens `_shelf/` — the canonical checkout sitting three
  steps above it, in a job named "compare to raw-at-SHA". Comparing
  `_tools`'s mirror against `_shelf/games.json` needs no network and cannot
  false-red on deploy lag. That half is worth adding on its own.
- **R2.** Make `Mirror equals the canonical shelf` required in both repositories.
  Cheapest high-value item here, for the reason above.
- **R3.** The mirror leg's `curl -sS` has no `--fail` and no
  parses-as-JSON guard. A 404 or truncated body is written to
  `/tmp/canonical.json` and compared as if it were the canonical — it fails
  closed, but it reports a fetch failure as drift. Pre-existing on main,
  unrelated to the patch. (The §X4 leg added in this pass does guard for this.)
- **R4.** Emit the drift line to `$GITHUB_STEP_SUMMARY` / `::warning::`, not
  step-log scrollback. A green check with a warning buried in raw logs is quiet;
  inheritance is what makes that tolerable, not the echo.
- **R5.** Step 2 is named "Check out the INSTRUMENTS…" and its comment discusses
  only `derive_live_routes.mjs`, but the patch depends on it being a **full**
  checkout. A future `sparse-checkout: tools/` would silently reinstate the
  deadlock. The MEASUREMENT INVALID branch catches it, which is why that branch
  earns its place — but the name should stop inviting the change.

---

# APPLIED — ORDER DL, 2026-08-26

**Everything above this line is the diagnosis and the adjudication. This section
records what actually landed, because it is not byte-for-byte the patch recorded
above and a doc that claims otherwise is the exact provenance failure this arc
keeps finding.**

Applied onto this branch (ORDER DL `PATCH_ROUTE=ONTO-191`), so that the pull
request carrying the fix is tested by the fix — a `pull_request` workflow runs
from the PR's own merge ref. A separate patch PR would have been redded by the
unfixed check, turning one deadlock into two.

## Where the recorded patch fell short, measured rather than argued

The recorded patch asserts on `_tools/data/source-manifests/games.json` and
nothing else. ORDER DL §D2.3 requires a control the recorded patch fails:

> **C4** — unrelated docs-only PR on a drifted `main` → blocking leg **GREEN**,
> drift line **present and named**.

Under the recorded patch that control **reds**. A pull request that does not
touch the mirror produces a merge ref whose mirror *is* main's, so it inherits
the drift and fails on it. The recorded patch says so itself and treats it as a
feature ("NEGATIVE 1 is the one that matters"). But §D2.1 rules the other way:

> **Fact B** — `main` has moved ahead of the last deploy. Inherited drift. Not a
> defect of any PR under test, and specifically not of a PR that touches nothing
> near the mirror.

So the recorded patch lifts the deadlock only for the one repairing pull
request, and leaves every other pull request red for a tree it did not write.

## Why two operands cannot do it, and the third one that can

Gating the assertion on "did this ref move the mirror" satisfies C4 — and
immediately fails **C1**, the planted wrong served byte, because a pull request
that does not move the mirror would then be excused and the wrong byte excused
with it. That is the amnesty §D2.3 forbids outright.

The reason is structural: **"the served bytes are wrong" and "main is behind"
produce the identical observation**, `served != mirror`. No pair of operands can
separate them. The third operand is the canonical itself — and
`agx1-live-verify.yml` has been checking it out into `_shelf/` for three steps
above the whole time. This is follow-up **R1**, promoted from "worth adding on
its own" to load-bearing.

| operand | what it is |
|---|---|
| `_shelf/games.json` | the canonical, at the Games repository tip |
| `/tmp/canonical.json` | the canonical, **as served** |
| `data/source-manifests/games.json` | the mirror in the **deployed** tree |
| `_tools/data/source-manifests/games.json` | the mirror in the tree **this ref** would produce |

## What landed

1. **Fact A — the served bytes.** Blocking on every ref, in every context. If
   the served shelf matches neither the Games tip nor the deployed tree, it is a
   shelf no repository authorises and the leg exits 1. Games having moved ahead
   of its own deploy is named as **lag**, not reported as a wrong byte.
2. **Fact B — the mirror.** If the ref **moves** the mirror it must move it to
   the served canonical, byte for byte. Corrupt blocks. Absent is
   `MEASUREMENT INVALID` and never falls through to main's copy. If the ref does
   **not** touch the mirror, inherited drift is named, **itemised entry by
   entry**, emitted as a `::warning` and written to the step summary — and not
   charged to that pull request. On any non-`pull_request` ref the same drift
   still exits 1.
3. The negative control and the fail-closed branch from the recorded patch are
   kept verbatim in intent. `curl` gains `--fail`, closing **R3**: a 404 body is
   no longer compared as though it were the canonical and reported as drift.
   **R4** is closed by the `::warning` and step summary.

Still `cmp -s`, byte for byte. Nothing about how loosely it compares changed —
only what it compares against, and in which context it is answerable.

## The five controls, in CI, on real runs

Each ran as a `DL-CONTROL/` scratch pull request against the patched leg and was
closed unmerged the moment it was read. **Every one resolved at step 13, the
mirror leg itself** — no earlier step failed, so each reached the instrument's
real input.

| control | run | step 13 | required | got |
|---|---|---|---|---|
| C1 planted wrong **served** byte | `33023137314` | `FAIL the SERVED bytes are not any committed canonical` | RED | RED |
| C2 corrupt the mirror in the PR tree | `33023141124` | `FAIL this ref moves the mirror and the result is NOT the served canonical` | RED | RED |
| C3 delete the mirror in the PR tree | `33023149700` | `MEASUREMENT INVALID … will not fall through to the deployed tree's copy and call that a pass` | RED | RED |
| C4 unrelated PR on a drifted `main` | `33023153698` | `DRIFT INHERITED` + 6 entries named, leg **green** | GREEN + named | GREEN + named |
| C5 the same drift off a pull request | `33023158094` | `FAIL … it IS this ref's own state, and it blocks` | RED | RED |

C1 could not be planted in production, so the wrong bytes were committed to the
scratch branch and served over real HTTPS by `raw.githubusercontent.com`, with
the fetch URL as the single altered line. The comparison underneath is the
shipped one.

Sibling gates that fired because a fixture was deliberately corrupted or deleted
(C2 and C3: `Static gates`, `Static architecture…`, `Every curated and rail key…`,
`Mirror equals the canonical shelf`, `Gates are proven red…`) are **EXPECTED-RED**
and are not findings. On C4, whose tree is main's own state plus a document, the
only red is `Mirror equals the canonical shelf` — the advisory guard that *owns*
drift, correctly reporting it while the live leg no longer punishes an unrelated
pull request for it. That division of labour is the point.

## The blindness, stated plainly

Before this change, **a pull request that deleted the shelf mirror passed the
check that exists to protect it**, by falling through to main's copy; one that
corrupted it passed the same way. That is the more important half of this repair
and it should not be filed under the deadlock story. C2 and C3 are its proof.

## R2 still stands, and still is not this order's to take

`Mirror equals the canonical shelf` remains **advisory in both repositories**.
Making it required is a branch-protection change, which is Matt's by standing
ruling and is not needed by this repair.
