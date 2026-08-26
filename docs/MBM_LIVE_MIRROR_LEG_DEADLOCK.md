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
