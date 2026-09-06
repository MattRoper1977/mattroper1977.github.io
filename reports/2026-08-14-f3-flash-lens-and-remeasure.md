# F3 — the flash instrument: the lens is fixed, and everything it cleared is re-read

**R12: report only, repair nothing.** Nothing in any game was changed by this pass.
Emberwild is excluded — it is in hand under F2.

---

## 1. What was wrong, and where

`tools/flicker_analyse.mjs`'s signal maths was never wrong. The defect sat one step
**upstream**, in every caller: each reduced a frame to a single scalar by taking the
mean luminance of the **whole canvas** before handing it to `analyse()`.

Both instruments declared the limitation themselves rather than having it discovered:

- `measure_olympics_flash.mjs:91` — a strobe over a third of the screen moves the
  whole-frame mean by about a third of its own amplitude.
- `measure_driving_flash.mjs:85` — the same, at about a twentieth.

The Depths census then proved what it costs in the wild: a real flash measured
**9.97–14.91 Hz over the changing region, 0.000 Hz over the whole viewport**.

A clean result from that instrument is not a clean result.

## 2. The fix, and why it is additive

`flicker_analyse.mjs` gains `reduceFrameToTiles()`, `analyseTiled()` and
`selfTestLens()`. **`analyse()` and `selfTest()` are untouched, byte for byte** —
R11 requires the Emberwild before/after to keep 2.1's lens, and silently moving
every previously-quoted number would destroy the comparability this file was
extracted to protect. `analyseTiled()` reports **both** lenses; where they
disagree, the disagreement is the finding.

### The mechanism is not what it first appears

The lens self-test initially failed its own control, and the reason is worth
recording because it changes what the defect actually is.

`analyse()` sets its prominence threshold **proportional to the signal's own
range** (`tol = ptp * 0.05`). So on a *perfectly static* background, diluting a
strobe shrinks the threshold along with it and **the rate still comes back** —
only the amplitude collapses, measured here at **62.5×** for a patch covering a
sixty-fourth of the frame.

The Depths read 0.000 Hz because a real frame is **not** static. Camera pan,
parallax and the time-of-day grade give the whole-frame series a large range of
its own, and the diluted strobe then falls *under* that proportional threshold
and is rejected as noise.

So the failure mode is precisely: **a localised flash competing with large-area
motion becomes invisible.** The self-test now reproduces both halves:

```
PASS  a 3 Hz strobe over a 64th of a STATIC frame -> tiled lens 3 Hz
PASS  CONTROL: the old lens dilutes its amplitude 62.5x (whole p-p 0.016 vs tiled 1)
PASS  the Depths' 14.91 Hz over a 64th of a STATIC frame -> tiled lens 14.875 Hz
PASS  CONTROL: the old lens dilutes its amplitude 62.5x
PASS  a 10 Hz strobe under competing large-area drift -> tiled lens 10 Hz
PASS  CONTROL: whole-frame mean reads 0 Hz — the real flash is invisible to the old lens
PASS  the Depths' 14.91 Hz under competing large-area drift -> tiled lens 14.875 Hz
PASS  CONTROL: whole-frame mean reads 0 Hz — the real flash is invisible to the old lens
PASS  static frame invents no rate -> 0 Hz, 0 tile(s) above the amplitude floor
```

`14.91 Hz → 0 Hz` is reproduced synthetically, on demand.

## 3. The re-measure

`tools/remeasure_flash_census.mjs`, 6 s per surface, default scene, 8×8 tiles,
estate ceiling 2.4 Hz. The instrument runs both self-tests and **refuses to quote
a number** if either fails.

| route | fps | tiled Hz | whole Hz | tiled p-p | dilution | verdict |
|---|---|---|---|---|---|---|
| `/neonmeridian/` | 59.5 | — | — | — | — | **UNREADABLE** — 100% blank frames |
| `/rallyvector3d/` | 12.7 | 2.314 | 1.322 | 0.045 | 7.5× | under the line on this scene |
| `/olympics/` | 30.8 | **5.47** | 5.801 | 0.022 | 22× | **OVER the 2.4 Hz line** |
| `/luminahaven/` | 15.6 | 0.665 | 0.831 | 0.018 | 18× | under the line on this scene |
| `/novasiege/` | 30.1 | 7.147 | 7.147 | 0 | 1× | no tile above the amplitude floor |
| `/relicforge/` | 20.1 | 0.831 | 0.831 | 0 | 1× | no tile above the amplitude floor |

### Two guards, and why they exist

**A rate on an empty signal is not a finding.** Because the prominence threshold
is proportional, `analyse()` will return a confident rate for a series that is
nothing but rounding noise. On a first pass this instrument reported
`/novasiege/` at 8.43 Hz and called it a breach — with a peak-to-peak of **zero**.
That is this session's own failure mode wearing a different hat: a figure that
reads as real while its basis is empty. Where no tile clears the amplitude floor,
the reading is now named as such and **not** counted.

**Nyquist.** This container does not reliably hit 60 fps, and the old olympics
instrument recorded the same hazard at 6–12 fps. Nothing above a quarter of the
achieved frame rate is quoted. `/rallyvector3d/` at 12.7 fps is trustworthy only
to about 3.2 Hz, and its 2.314 Hz sits just under both that and the estate line —
it is the least settled row in the table.

**Run-to-run variance is real.** Two consecutive runs gave `/olympics/`
5.984 → 5.47 Hz and `/rallyvector3d/` 2.81 → 2.314 Hz. Treat these as ranges, not
points. `/rallyvector3d/` crossed the 2.4 Hz line between runs, which is another
reason it needs a posed re-measure rather than a verdict.

## 4. What the new lens surfaces

- **`/olympics/` — 5.47–5.98 Hz on tile 41**, p-p 0.022, about **2.3× the estate
  ceiling**. The old lens read the same rate at **22× less amplitude**. Cleared by
  `measure_olympics_flash.mjs`. **This is the finding.**

No hazard is asserted. Per the Depths precedent, both prongs are needed for a
photosensitivity finding and the amplitude prong (0.10 required) fails here as it
did there.

## 5. What this is NOT

**This walked in and watched. It posed no worst case.** The old driving
instrument had test seams and posed seven scenes; this samples the default
surface. A quiet reading here is an absence of evidence on one scene, not a
clearance. These still need their scenes re-posed through the tiled lens:

- `/neonmeridian/` — the old tool posed 7 driving scenes via `window.__NM`
- `/rallyvector3d/` — the old tool posed driving scenes
- `/luminahaven/` — the hearth scene is posed by the old tool

And `/neonmeridian/` could not be read at all: **100% blank frames**. Its canvas is
WebGL without `preserveDrawingBuffer`, so a cross-frame `drawImage` returns an
empty buffer. It needs same-frame `readPixels` or a context flag, and until then
**it has no measurement under the new lens in either direction.**

The sampler never calls `getContext('2d')` on a game's canvas — it draws into a
scratch canvas of its own. That is failure mode #45, the instrument that consumes
the resource it is measuring, and it is how a WebGL game was once reported as
running a Canvas 2D fallback it had never used.

---

**Report only. Nothing repaired, per R12.**
