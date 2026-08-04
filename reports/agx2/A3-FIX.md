estate-visuals-2026-08-04 · P1.3

# A-3 — the read panel occluded the hole. Fixed, and G5 gained a limb.

**Matt's default ruling applied**: treated as a defect, not a preference. The
swap line `A-3 stays open — leave G5 and the panel alone.` was not supplied.

Both limbs land in the same commit, as required.

---

## The finding, restated by a stronger measurement

AGX-1 reported "88.6% of the canvas occluded at 360px". That was a **rectangle
overlap**, which is a proxy. This pass asked the pupil's actual question — is
the hole visible? — by projecting real world points through the renderer's own
`AG.Render.W()` and hit-testing each with `document.elementFromPoint`.

**Before the fix:**

```text
viewport      hole points visible      what was on top
360x640            0 / 10              the read panel
390x844            0 / 10              the read panel
400x700            0 / 10              the read panel
768x1024           3 / 10              panel, callInput, readGrid, fact
1280x800           7 / 10              panel
```

**Not one point.** Not the tee, not the cup, not a single fairway vertex. The
pupil was asked to call their stroke count with none of the hole visible. That
is a stronger and more damning statement than the percentage, and it is the
statement the gate now makes.

---

## Limb (a) — the fix

**Approach: reposition (bottom dock) + a renderer safe-area inset.** An
independent design panel run for this pass scored three candidates and returned
*view-inset + CSS dock* as RECOMMENDED and *CSS dock alone* as merely VIABLE,
for the reason measured below.

**Why the CSS dock alone is not enough.** The course is fit to the whole canvas
and centred, so simply pushing the panel down reveals whatever happens to be
under it — which, on a portrait phone, is empty rough. Measured: the world is a
fixed `240x140` for **every** hole and seed (derived across 4 seeds x 9 holes),
so the portrait fit is width-bound and the hole occupies only the middle band.
Revealing the top of the canvas is not the same as revealing the hole.

**What shipped**, three small changes:

1. **CSS**, one rule, scoped to the variant so G15 still holds:
   ```css
   @media (max-width:400px){.screen--read{margin-top:auto;max-height:min(52vh,var(--readCap,52vh))}}
   ```
   `margin-top:auto` beats the flex container's `align-items:center`, so the
   panel docks to the bottom with no `:has()` and no JS dependency.

2. **Renderer**: `setView()` honours `view.bottomInsetCss`, fitting the course
   into the band *above* the panel. Zero in every other phase and at every
   width above the breakpoint, so nothing else changes.

3. **UI**: `syncReadInset()` measures what the docked panel actually occupies
   and sets the inset — measured, not assumed, so it survives any change to the
   panel's content. Cleared the moment aiming begins; re-measured on resize.

**After the fix:**

```text
viewport      hole points visible      hole size on canvas
360x640           10 / 10              90% x 33%
390x844           10 / 10              95% x 28%
400x700           10 / 10              usable
768x1024           3 / 10              unchanged - outside the ruling's scope
1280x800           7 / 10              unchanged - outside the ruling's scope
```

Verified at device pixel ratios 1, 2 and 3.

---

## Limb (b) — THE GATE CHANGE, stated as a gate change

**G5 gained a limb. It was not widened or narrowed; a limb was added.**

| | before | after |
|---|---|---|
| name | *whole-hole read view before every stroke* | *whole-hole read view before every stroke, **and the hole is visible*** |
| asserted | `read-view-real-geometry`, `read-before-subsequent-stroke`, `real-canvas-pixels` | the same three, **plus `read-view-hole-unoccluded`** |
| question asked | was the hole **painted** with real geometry | **can the pupil see it** |

The new row asserts at **≤400px**, the width the ruling scoped, and **reports
its measurement at every width** so the tablet and desktop numbers stay visible
in evidence rather than being hidden by the scope.

Live output:

```text
PASS G5 ... phone:9/9 hole points visible at 360px, hole 90%x28% of canvas
           | phone-reduced:9/9 ... ; occluding fixture rejected
```

---

## The non-vacuity fixture — and three ways it was wrong first

The ruling: *proven non-vacuous by a deliberately-occluding fixture before it is
believed.* The fixture injects CSS from the test that stretches the read panel
back over the whole canvas — the pre-fix condition. No test-only code ships in
the game.

```text
fixture: occluding panel at 360x740 -> limb pass=false
         (0/9 hole points visible, hole 0%x0% of canvas [DEGENERATE SIZE];
          occluded tee>screen screen--read, cup>screen screen--read, ...)
fixture self-check: style applied=true position=absolute
                    panel 360,681 covers whole canvas 360,681 = true
```

**It took four attempts, and each failure is worth recording because each one
would have shipped a gate that proved nothing.**

1. **The splash was the occluder.** The contract runs 60 ms after boot, while
   the Made-by-Matt splash is still on top. Every hit test returned
   `mbmSplash`. The limb "failed" everywhere and the fixture "passed" — both
   for the wrong reason. Fixed by waiting for the state a pupil is actually in;
   the row now fails outright if the splash never clears, rather than passing by
   luck.
2. **The fixture injected nothing.** `addInitScript` appended the style to
   `document.documentElement` before `<head>` existed, so the node was lost.
   The limb reported 9/9 and the fixture would have certified non-vacuity while
   testing nothing. Fixed by injecting on `DOMContentLoaded`.
3. **The self-check was scoped to the wrong page.** `page.addInitScript` does
   not apply to the second page opened for the self-check, so it reported
   `applied=false` while the fixture was in fact working. Fixed by registering
   on the **context**.
4. **The self-check's discriminator was not a discriminator.** "Panel covers the
   canvas centre" is true in the *fixed* state too, because the hole sits in the
   upper band. Replaced with "panel covers the whole canvas".

**The fixture now checks that it actually bit**, and says
`FIXTURE DID NOT BITE — it occluded nothing, so it proves nothing` if it did
not. A fixture that silently fails to bite is worse than no fixture, because it
manufactures confidence.

---

## A defect I introduced, caught by looking rather than by the gate

Worth recording plainly. My first `setBottomInset()` converted CSS px to device
px by reading `canvas.getBoundingClientRect()` at call time. `showRead()`
toggles `#playControls` immediately before that runs, so the rect was read
mid-reflow and the ratio came out **3.33 instead of 1** — a 1178 px inset on a
581 px canvas, `avail` clamped to 1, and **the entire hole rendered as a 2x1
pixel speck**.

**The limb passed it 9/9.** `elementFromPoint` at a speck still returns the
canvas, so "unoccluded" was satisfied by a hole too small to see. The gate was
green and the screen was empty. It was the **screenshot** that caught it.

Two fixes, both in this commit:

- the conversion now happens at render time using the same dpr `resize()` uses,
  with no layout read at all;
- **the limb now also requires the hole to be drawn at a usable size**
  (`>=50%` of canvas width and `>=15%` of height), so the degenerate case can
  never satisfy it again. The fixture output shows the limb catching exactly
  that: `hole 0%x0% of canvas [DEGENERATE SIZE]`.

---

## Costs and residuals, reported not buried

**The panel scrolls.** At 360x640 the docked sheet is 333 px tall against
640 px of content, so the call input and the buttons sit below the sheet's
fold and the pupil scrolls within it. All controls remain **>=44px** and
reachable, the flow completes, and there are zero console or page errors.
Tightening the internal margins would recover ~60 px of a ~309 px overflow, so
it would not remove the scroll; it was not done, to keep the diff minimal and
the wording untouched.

**Tablet and desktop are unchanged and still occlude.** 768x1024 shows 3/10
points and 1280x800 shows 7/10 — the cup itself is behind the panel at 768.
**The ruling scoped the fix to <=400px and I did not widen it.** This is a
residual finding for Matt, not a silent omission.

**Content preservation held.** Not one character of visible wording changed:
no teaching text, no labels, no button text, no hint copy. The changes are one
CSS rule, one renderer inset, one measurement helper, and one contract row.

---

## Verification

```text
ALL 18 APEX GOLF GATES PASSED          (18 passed, 0 failed, 0 skipped)
inline script blocks                    4, node --check clean, 0 syntax errors
epsilon tamper battery                  4 tampers, 4 rejections, no regression
  DT x3                 -> FAIL (static limb)
  dt stripped           -> FAIL (static limb)
  per-frame stepping    -> FAIL (epsilon itself, delta 1.1625)
  rig blinded           -> FAIL (drive() schedule assertion)
independent occlusion probe (my rig, not the harness)
  360 / 390 / 400 px    -> 10/10 hole points visible
```

**File identity — the branch now carries a third hash for Apex Golf:**

```text
AGX-1 evidence / LIVE TODAY   64,513 B   sha256 c0701ee1…   blob 132034b7…
after the epsilon fix         65,195 B   sha256 7c66a2a2…   blob d7384bc4…
after this A-3 fix            69,327 B   sha256 18b28e49…   blob 4167f07c…
```

**Nothing is deployed.** Per P1.4, the live site still serves the 64,513 B file
and the 14-door `site.json`. The ruled state is prepared, not live.

estate-visuals-2026-08-04
