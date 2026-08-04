apexgolf-build-2026-08-04

# Next pass after AGX-1 — the four scoped items

Scoped by Matt on acceptance of Pass AGX-1. **Nothing merges.** Everything here
sits on `claude/apexgolf-build-2026-08-04-b1hbwj` as a proposal.

| # | Item | Outcome |
|---|---|---|
| 1 | A-6 — derive the arcade manifest count | **DONE, proven on three fixtures** |
| 2 | Fix the ε limb | **DONE — but the stated success criterion was not met, and the reason matters. Read below.** |
| 3 | C1 door removal | **DONE** — see [`AMENDMENT-8.4.md`](AMENDMENT-8.4.md) |
| 4 | C8 with Games scope | **BLOCKED — scope was not added. Still unproven.** |

---

## 1 · A-6 — the pinned snapshot and every literal count, removed

Done first and before Games#12, as ruled.

**A correction to my own AGX-1 census before anything else.** A-6 named five
hardcoded `34`s. A full re-census finds **six**, and the one I missed is the
worst of them:

```text
arcade-sports-verify.yml:38    step name "Fetch merged 34-entry manifest"   (cosmetic)
arcade-sports-verify.yml:43    if(d.games.length!==34) process.exit(1)
verify_arcade_sports_browser.js:11   games.length===34
verify_arcade_sports_browser.js:19   waitForFunction(... .length===34)      <-- MISSED IN AGX-1
verify_arcade_sports_browser.js:27   s.shelf.length===34
verify_arcade_sports_browser.js:32   /13 curated favourites of 34 games/
```

Line 19 is a `waitForFunction` with a 10 s timeout. At 35 entries it would not
have failed cleanly — it would have **hung for ten seconds and then failed
somewhere else**, which is the most expensive way for a gate to be wrong. My
census under-counted; recorded rather than quietly fixed.

### What changed

- the manifest is fetched at **`main`**, never at the `900fae5e` pin;
- the workflow **derives** entries, art coverage, duplicate hrefs, Sports
  membership and the Physics count, and fails on *shape*, not on a literal;
- the browser harness derives `N = games.length` once and uses it everywhere,
  including the `waitForFunction` and the countline regex;
- the Sports rail is compared to **the manifest's own** Sports membership
  rather than to a hardcoded list of four titles.

Residual literal counts in the chain: **none** (the only remaining `34` is in
the comment explaining why it went).

### Proven on three fixtures, including the Games#12 scenario

```text
manifest            result
m34 (live, real)    ALL PASS — derived N=34, no regression
m35 (Games#12:      ALL PASS — derived N=35; shelf 35/35; countline reads
  Biopunk added)      "13 curated favourites of 35 games"
m35 missing art     FAIL manifest-art-complete 34/35   <- non-vacuity proven
```

**The middle row is the point.** The old chain would have broken in four places
at 35 entries — or, worse, never seen 35 at all, because it fetched the pin.
The new chain follows the manifest and still rejects a real defect.

---

## 2 · The ε limb — fixed, but NOT in the way the instruction predicted

The instruction was: *"drive(world, seconds, renderHz) must derive its step
schedule from renderHz — frames = seconds × renderHz with the accumulator per
frame. Re-run both tampers; ε must go non-zero."*

**The first half is done. The second half did not happen, and it should not
have.** Reporting that rather than reporting success.

### `drive()` now derives its schedule from renderHz

```js
var acc=0, frame=1/renderHz, frames=Math.round(seconds*renderHz);
for(var f=0; f<frames && b.moving; f++){
  acc+=Math.min(MAX_FRAME_DELTA,frame);
  var n=0; while(acc>=DT && n<MAX_SUBSTEPS){ stepBall(b,hole,DT); acc-=DT; n++; }
}
```

This mirrors the shipped `loop()` exactly, instead of running a fixed
`seconds/DT` step count and merely re-chunking it.

### ε measured across durations and four tampers

```text
duration      shipped   A: DT×3   B: dt stripped   C: per-frame stepping
0.25s         7.08e-1   1.06e+0   7.08e-1          7.07e-1
0.5s          0         0         0                1.72e-1
2s            0         0         0                1.16e+0
20s           0         0         0                2.95e+0
```

### Why ε stays 0 for tampers A and B — and why that is correct

At 2 s every rate accumulates **the same simulated span**:

```text
 30Hz   60 frames  2.000000s  480 DT-steps
 60Hz  120 frames  2.000000s  480 DT-steps
120Hz  240 frames  2.000000s  480 DT-steps
144Hz  288 frames  2.000000s  480 DT-steps
```

A fixed-step integrator given identical simulated time **must** land
identically. ε = 0 there is the correct answer, not a blind one.

And neither A nor B is a frame-rate-dependence defect. `DT × 3` changes
*accuracy*; stripping `dt` for a hardcoded `/240` is *still exactly
fixed-step*. Neither makes the ball behave differently at 30 Hz than at 144 Hz,
so no honest ε test can flag them — and both are correctly caught by G2's
static limbs.

The non-zero at 0.25 s is worse than useless: 0.25 × 30 = 7.5 frames, so
`Math.round` makes the rates simulate **different spans**. That ε measures
frame-count rounding, not physics.

### So the real fix is a positive control, not a bigger number

I added **tamper C** — physics advanced once per frame at `dt = 1/hz`, which is
the actual B6 shape — and it is what ε should catch. It does:

```text
FAIL G2 — refresh-rate delta 1.1625222659784065
```

G2 now carries that control **inside the gate**: it drives the same shot with
per-frame stepping and requires ε_control > 0.1. If the rig ever goes blind
again, the control collapses toward 0 and **the gate fails on that alone**,
whatever the shipped game is doing.

### Four tampers, four rejections

```text
shipped     PASS — ε=0; positive control ε=1.163 (rig proven sighted)
A DT×3      FAIL — DT is 0.0125                        (static limb)
B dt gone   FAIL — bare position integration found     (static limb)
C per-frame FAIL — refresh-rate delta 1.1625           (ε ITSELF)
D rig blinded (drive ignores renderHz)
            FAIL — drive() does not derive its schedule from renderHz
```

Tamper D is new: it blinds the measurement rather than the physics. The old gate
would have passed it with a clean ε = 0. **The ε limb no longer reports a number
it cannot stand behind**, and it never reports "unverified" because it is now
verified — by its own control, on every run.

### Cost: the shipped game file changed

```text
            before                              after
bytes       64,513                              65,195
sha256      c0701ee1152d57c1…4ddab041           7c66a2a2cf61109b…b0db84a8
blob        132034b789ccef09…9292cb02           d7384bc4959c6bb5…535fd2f4
```

`drive()` is a **test-only export** — the game never calls it, so gameplay is
untouched. All **18/18 gates still pass** in a real browser, and G17's size
budget is unaffected (65,195 of 256,000).

**Consequence to be explicit about: the live file no longer matches this
branch.** Nothing merges, so `https://madebymatt.uk/apexgolf/` still serves
64,513 bytes / `c0701ee1…`. That remains correct and verified live. If this
branch is ever merged, the live check must be re-run against the new hash.

---

## 3 · C1 door removal — implemented

See **[`AMENDMENT-8.4.md`](AMENDMENT-8.4.md)** for both halves, the ruling, the
amended §8.4, and the measurements. In short: `site.json` doors **14 → 13**,
Golf's door gone, siblings intact, no overflow at 360/768/1200, the ratified
four-game Sports block still renders **with JavaScript off**, and Apex Pool is
still New Release.

The transform and its verifier were moved with the data, because a ruling that
only edits `site.json` reverts the next time `apply_apextennis_home.js` runs.

**Two orphans left in place and flagged, not deleted:** the now-unreferenced
`assets/cards/apex-golf-door.svg`, and a `features.downloads.catalog` entry for
`apex-golf` that nothing increments any more (catalogue 14 against 13 doors).

---

## 4 · C8 — BLOCKED, and it is still unproven

```text
mcp__github__get_file_contents  MattRoper1977/Games  ->
mcp__github__list_branches      MattRoper1977/Games  ->
  Access denied: repository "mattroper1977/games" is not configured for this
  session. Allowed repositories: mattroper1977/mattroper1977.github.io
```

**Games repo scope was not added.** The session allowlist is fixed at session
start; there is no `add_repo` tool in this session, so I cannot add it from
here. Retried on two different endpoints to be sure it was not a per-tool quirk.

**C8 therefore remains exactly as unproven as it was after AGX-1.** What I can
still say, and its channel, is in the carry-forward below. What I cannot say:
whether Games#12's branch exists, is intact, or has been touched.

---

## Carry-forward, answered

### Provenance of the manifest figures

Games was out of scope, so naming the channel matters.

| Figure | Channel |
|---|---|
| 34 entries · art 34/34 · 0 duplicate ids · Physics 8 · Sports = 4 · hues distinct · no Sport chip | **Two independent channels, agreeing.** (1) `raw.githubusercontent.com/MattRoper1977/Games/main/games.json` — HTTP 200, 15,465 B, parsed locally. (2) **The live custom domain** `https://madebymatt.uk/Games/games.json`, fetched from a GitHub runner in CI runs `30919019077` and `30919678785`. |
| 49 rendered placements from 34 | Chromium against the real manifest, decomposed by section: 34 shelf + 7 themed + 4 classroom + 4 Sports |
| Games#9's commit, diff, merge SHA; Games#12's branch | **No channel. UNVERIFIED.** Repo out of scope. |

**The distinction that matters: I measured the manifest's *content* twice, from
two channels. I never measured the Games *repository's* state at all.**

### `/apextennis/` live status

C2 asked for it and my AGX-1 readback named only Golf and Biopunk. Answering
directly — it was in both runs and passed:

```text
https://madebymatt.uk/apextennis/   HTTP 200
live bytes 59,852  ==  repo bytes 59,852
live sha256 8e109ab55a0fb2a284f2e2e0bb5baa8bf468eaea8e2e89593fd71a20cdfb9b1f
match: IDENTICAL
```

Apex Tennis is live, served, and byte-identical to the committed file. Its
skipped live check — skipped on a container DNS failure — **is closed.**

### The other three AMBERs, named

A-5 closed in AGX-1; A-6 and A-1 closed by items 1 and 3 above. Remaining:

- **A-2 — the vacuous ε limb.** **Now CLOSED** by item 2, with a positive
  control that proves the rig is sighted on every run.
- **A-3 — the read-view panel occludes 88.6% of the hole at 360 px** (43.5% at
  768, 34.0% at 1280). G5 asserts the hole *was painted with real geometry*,
  never that it is *visible* at the moment of the call. **Still open** — it
  changes both a gate and the UI, and neither was in this pass's scope.
- **A-4 — hardcoded counts.** **Now CLOSED** by item 1; A-4 and A-6 were two
  ends of the same defect and were fixed together, as A-6 said they must be.

So: **A-1, A-2, A-4, A-5, A-6 closed. A-3 open, and it is the only one left.**

### Apex Kick's one failing donor check — NAMED

Named in AGX-1 FINDINGS G-1 and repeated here so it cannot evaporate a third
time. Measured by running `node tools/verify_apexkick.js`: **25 checks, 24
pass, 1 fail.**

```text
FAIL  no-remote-resources        family: "Offline contract"
      found: https://madebymatt.uk/apexkick/
             https://madebymatt.uk/apexkick/
             https://madebymatt.uk/images/apexkick-hub.jpg
```

**The name is `no-remote-resources`.** It asserts the shipped file contains no
absolute remote URLs. **All three hits classified:** two are the canonical link
and `og:url`; the third is the `og:image` social preview. **None is a runtime
resource** — the companion check `no-network-calls` passes, so Apex Kick is
genuinely offline-capable.

**The donor's check is the buggy one, and Apex Golf already ships the fix.**
Golf carries the same single absolute URL (its canonical) but G17 tests for
`<script src=`, `<link rel=stylesheet`, `fetch(` and `XMLHttpRequest(` — it
measures dependency, not string shape. Nothing on Apex Kick was touched.

---

## Five-line derived readback

1. **Tips.** Site `main` unmoved at `4afd34854e92ec029be3d381433a855aaa82de6a`;
   branch head carries this pass. **Games main still UNVERIFIED** — scope not
   added, C8 unproven.
2. **A-6.** Manifest pin `900fae5e` removed, six hardcoded counts (one more
   than AGX-1 found) replaced by derivation. Proven on **34 → PASS, 35 → PASS,
   35-missing-art → FAIL**.
3. **ε.** `drive()` now derives frames from `renderHz`. ε = **0** at equal
   simulated time — correct — with an in-gate **positive control at ε = 1.163**
   proving the rig is sighted. **Four tampers, four rejections**, one of them
   (per-frame stepping) caught by ε itself and one (blinding the rig) new.
4. **C1.** `site.json` doors **14 → 13**; Golf door removed; transform and
   verifier moved with it so the ruling cannot silently revert; **33/33** Tennis
   homepage gates pass against the ruled state; four-game Sports block intact
   with JS off.
5. **Cost.** Apex Golf is now **65,195 B**, sha256 `7c66a2a2…`, blob
   `d7384bc4…` — **18/18 gates still pass**. Nothing merged, so live still
   serves the verified 64,513 B / `c0701ee1…`.

---

## MATT'S ACTIONS

### 1. The phone eyeball — still first, still the only real proof

Open **https://madebymatt.uk/apexgolf/** on your phone. Unchanged from AGX-1 and
still outstanding: CI proves the file is *served* byte-identically; only a thumb
proves B11 is closed. The live file is the **64,513 B** original — nothing in
this pass has been deployed.

### 2. Decide the two orphans left by the door removal

`assets/cards/apex-golf-door.svg` (1,268 B, now referenced by nothing) and the
`apex-golf` entry in `features.downloads.catalog` (nothing increments it any
more — catalogue 14 against 13 doors). Both **left in place**; deleting content
is RED. Recommendation in AMENDMENT-8.4.

### 3. A-3 is the last open AMBER

The read-view panel hides **88.6%** of the hole at 360 px, and G5 never asks
whether the hole is visible. Tightening it changes a gate *and* the UI, so it
needs your call on which way — dismissable panel, or accept the numeric read
and amend §4.1.

### 4. Add Games repo scope if C8 is to be closed

It could not be added from inside this session. Until then, Biopunk stays **live
but invisible** at `/biopunkhive/` — served, in the sitemap, no shelf card — and
Games#12's branch state is unproven.

### 5. If this branch is ever merged, re-run the live check

Apex Golf's hash changed. The AGX-1 live evidence covers `c0701ee1…`; a merge
would need a fresh run against `7c66a2a2…`.

---

## Limits

- **C8 unproven** — Games out of scope, no `add_repo`, retried on two endpoints.
- **Manifest content measured twice; the Games repository never measured.**
- **A false zero of my own, corrected:** AGX-1's A-6 census said five hardcoded
  counts. It was six. The missed one was the `waitForFunction`, which fails
  slowest and least clearly.
- **The instruction's ε prediction was wrong and I did not make it come true.**
  ε does not go non-zero for tampers A and B, because neither is a
  frame-rate-dependence defect. Forcing a non-zero number there would have meant
  choosing a duration whose ε measures `Math.round` — a number that looks like
  evidence and is not.

apexgolf-build-2026-08-04
