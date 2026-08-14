# EW-GFX2 §4.0 — carry-forward census, measured

Run against `emberwild/index.html` at the ordered pin, verified exact before
anything else: **304,378 B**, SHA-256
`4a31c182738171b7d90a0f0648f41e3ad5551a10efd5dc200f000fbf2719bdb4`, identical in
the working tree and at `b196afb`. Ceiling 409,600 B, headroom 105,222 B.

Nothing in `emberwild/index.html` was changed by this pass. P3–P5 were **not
started**, because two of the premises they rest on are measurably false at this
tip, and the standing rule is to report a deviation rather than build on it.

---

## 1. The time-of-day grade is not dormant

The order states: *"A time-of-day grade exists and never paints — `timeOfDay`
pinned at 0.56 with nothing advancing it"*, and warns that waking it is the
phase's real risk because *"every colour was authored at 0.56 and no other value
has ever been seen"*.

Measured in a browser, six seconds apart, in the Vale after the intro:

| | `playTime` | `timeOfDay` |
|---|---|---|
| t0 | 4.177 s | 0.58321 |
| t1 | 10.177 s | 0.61654 |

Advance over 6.000 s: **+0.03333**, which is exactly 6/180. The clock at
`index.html:4629` runs it — `this.timeOfDay=(0.56+(this.playTime/180))%1` — on
every update outside battle. A full cycle is 180 seconds. 0.56 is the *starting*
value, not a pin, and every value in [0,1) is reached within three minutes of
play.

So the risk model in §4.2 does not describe this build. There is no dormant path
to wake, and the colours have not only ever been seen at 0.56 — they have been
sweeping the whole range in normal play since the grade shipped. The open
question is the opposite one, and it is not answered here: whether the tint pass
at `:4222` visibly paints across that range, and if it does, whether readability
has ever been checked at the values a player actually sees. Driving the grade
from zone state instead of the clock, as §4.2 asks, would *narrow* what is
currently rendered rather than wake anything, and that is a product decision.

**Not acted on.** §4.2 needs re-specifying against this measurement.

## 2. CORRECTED — the WebGL path runs. The earlier finding was my instrument.

**This section replaces what was first committed here, which was wrong.**

The first version of this report concluded that `GPUParticleSuite` was ~20 KB
carried and never executed, because the Depths particle layer measured
`renderer: "Canvas 2D fallback"` in a browser where WebGL2 was available. That
reading was produced by the probe, not by the game.

The probe — `fxprobe.js` — counted painted pixels by calling
`getElementById('fx-canvas').getContext('2d')` during its Vale stage, while
`EWFx` was still idle and the canvas unsized. A canvas holds exactly one context
type for life. That call bound a 2D context to `#fx-canvas`, so the later
`getContext('webgl2')` returned null, and the explicit capability gate at
`index.html:667` did what it is there for: threw `WEBGL2_UNAVAILABLE`, and
`createParticleSuite` fell back.

Demonstrated causally, same drive, same file, one line different:

| run | `EWFx.state` | `stats().renderer` | fps | drawCalls |
|---|---|---|---|---|
| without the 2D touch | `gpu` | **WebGL2 instanced** | 58 | 1 |
| with the 2D touch | `fallback` | Canvas 2D fallback | 0 | 110 |

So the shipped build runs the GPU path in normal play. The constructor completes,
both shaders compile, the program links, and it renders: 175 real
`drawArraysInstanced(TRIANGLES, first=0, count=6, instances=110)` calls and 528
non-zero-alpha pixels on a `readPixels` sweep.

Category: **(a) a deliberate capability gate working as designed.** It is
definitively not a constructor bug. The capability was absent because the
measuring harness had removed it.

Consequences that stand:

- There is **no** recoverable headroom here. The 19,995 bytes are live code.
- The only in-game 2D touch of that canvas is at `index.html:2633`, inside
  `EWFx.set`'s zone-off branch, and it sits behind `if (!suite) return;` at
  `:2630` — so normal play always reaches webgl2 first.
- Any future suite that probes `#fx-canvas` with `getContext('2d')` before
  entering the Depths will manufacture this same false reading.

Registered as failure mode #45: an instrument that consumes the resource it is
measuring.

## 3. The Vale's 300×150 fx-canvas is not the Glitch Clash defect

Worth stating because it looks exactly like it. `Games/Glitch_Clash.html` has a
documented history of an FX canvas left at the browser default 300×150 because
its `init()` never ran, and the repo's own notes warn that `width > 0` passes on
such a canvas.

Here the Vale genuinely shows 300×150 with zero painted pixels — but by design:
`EWFx.set(this.depths ? 'depths' : (seam ? 'seam' : null))` at `:4791` sets the
zone to `null` in the Vale, so the layer is idle and the canvas is never sized.
Entering the Depths sizes it to 390×844 and paints. Both halves measured above.

The lesson is only that the two states are indistinguishable by canvas
dimensions alone, so any gate on this layer has to assert the zone it is
measuring in.

## 4. Confirmed as carried

- **Water** — present, tagged `water`.
- **Tall grass** — present as a distinct surface, `Surface.TALL_GRASS`, 17
  references.
- **P2's upscale fix** — confirmed live: `world-canvas` measures 300×649 at a
  390×844 viewport, matching the letterbox arithmetic P2 landed (a 300-wide
  buffer needs 649.23 tall for square texels; 649 with the remainder taken as a
  0.31 px letterbox on the presentation side).
- **Bayer roof cutaway** — present and unordered, at `:4144`–`:4161`.
  `applyBayerDither` fires only when `opacity < 0.8`, and opacity takes exactly
  three values: 1 outside, 0.32 when the player is behind the lodge, 0.08 when
  inside. Whether that transition steps or dithers over time — the §4.1
  question, and the one that decides if it is an undeclared luminance source —
  needs the animated measurement, which was not run. **Reported, not repaired.**

---

## What this means for P3–P5

§4.1's Bayer audit is well-founded and unblocked. §4.2 as written is not: it
asks to wake something that is already awake, and its stated risk is the
opposite of the real one. §4.3–§4.5 were not reached.

§4.2's readability question has since been answered and is recorded in the close
readback: the grade does paint, five distinct states landing exactly on the
source thresholds, and across 37 sample points spanning 0→1 the weakest text in
the game holds 8.01:1 — so the 180-second cycle spends **0%** of its time below
4.5:1 on text. The player sprite is a separate matter and never reaches 4.5:1 at
any value.

Section 2 above was rewritten on the same day it was written, because it was
wrong. The pass stops on a disproved premise; it also corrects its own.
