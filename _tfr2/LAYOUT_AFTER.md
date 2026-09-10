# TFR2 P2 — layout and speed, phone proof AFTER

Working copy: `_tfr2/titanforge.html` built by `tools/build.py` (input + 11 asserted single-match
patches + V5 layer `src/v5-layout.css`, `src/v5-core.js`). Captures in `_tfr2/shots/p2/`.

| size | lift-button fully inside viewport at scroll 0 | console height | lift box (y) | phase-track visible | head not clipped | popup overlapping lift | failed requests | page errors |
|---|---|---|---|---|---|---|---|---|
| 360x740 | **YES** | 504 px | 596–668 (fixed, 72 px) | YES | YES | NO | 0 | 0 |
| 390x844 | **YES** | 504 px | 700–772 | YES | YES | NO | 0 | 0 |
| 412x915 | **YES** | 504 px | 771–843 | YES | YES | NO | 0 | 0 |
| 1366x768 | YES (unchanged desktop) | 518 px | 645–703 | YES | YES | YES (full-arena inset:0 flashes, as before) | 0 | 0 |

Red run for this gate: the untouched input printed NO on all three phone sizes (LAYOUT_BEFORE.md).

## What changed (≤780 px only unless noted)
- L1 `.lift-button` is `position:fixed`, left/right 8 px, bottom `calc(66px + safe-area + 6px)`, z-index 39
  (above the console at 7, below the dock at 40), min-height 72 px, same gradient. Console gets 84 px bottom
  padding and drops its backdrop-filter (a filter ancestor would re-anchor a fixed child).
- L2 arena padding-top 470→400, stage scale .94→.84, coach bar top 53→48; ≤359 px scale .78 (padding 380).
  Popups that keyed off the old stage height moved with it (reward 442→372, cycle result 310→268,
  burst 470→400). Full-arena flashes are clipped to the 400 px stage band so nothing paints over the fixed LIFT.
- L3 the three `.mbm-v4-vital` meters + `.mbm-v4-goal` are wrapped in `.mbm-v4-vitalstrip`: one 24 px strip,
  three 7 px bars, goal text on a 15 px line beneath. Meter labels become visually hidden; `role=meter`,
  `aria-label` and `aria-valuenow` are untouched.
- L4 fifth dock button DNA (44×44, `aria-label`, calls `__MBM_TITAN_V4__.openDNA()`); dock is `repeat(5,1fr)`,
  72 px per button at 360 px, no wrap (also in the landscape rule).
- L5 in `mbm-titan-aaa-runtime`: base period 1180→2200 ms; session warm-up 2800 ms for the first 15
  tri-phase reps, linear ramp to 2200 over reps 15–30 (counter lives in `finish()`, per page load);
  fatigue factor `min(1.05, 1+fat*.0022)`; eccentric divisor 950→1150. Seams on
  `__MBM_TITAN_AAA_TEST__` (`speed`, `drivePeriod`, `driveSpeed`, `perfectDwellMs`, `sessionTriReps`).
- L6 goal line gains `HEAT: DRIVE NEEDLE FASTER` while FOCUS ≥ 60; first crossing per session fires the
  V3 toast "FOCUS HEAT / NEEDLE SPEEDS UP · REST 2S TO COOL" (V3 now exports `toast`).
- L7 `graphics.enabled` is `false` on every fresh AAA save on every device; "3D RIG" stays the opt-in.
- The V3 one-time hint is returned to the console flow on phones (it was a fixed box that now landed on
  the phase track); A6 replaces it entirely.

## L5 PERFECT-window dwell (from the constants; band |pos−.72| ≤ .07 on a .48-amplitude sine)
| state | period | speed | dwell |
|---|---|---|---|
| warm-up | 2800 ms | 1.00 | **147.5 ms** |
| base | 2200 ms | 1.00 | **115.9 ms** |
| max fatigue (fat = CNS = 100) | 2200 ms | 1.05 (cap) | **110.3 ms** |

Deviation, printed not decided: the order's cap `min(1.25, …)` yields 95.0 ms at max fatigue, which
fails the order's own ≥110 ms floor. The cap is 1.05 so all three clear the floor. **MATT DECIDES**
whether to keep 1.05 or take 1.25 with a wider PERFECT band.

## 6-rep harness (`tools/rep_harness.mjs`, 412x915, coarse pointer, network locked)
```
rep 1..6: PERFECT/PERFECT/PERFECT 6/6, GAINS ×1.9 on every rep, combo x1..x6
rep 5 brace 1402 ms (BOSS, 1400 ms kept); other braces 751–766 ms
V3 flawlessSets 1, nextMult 2 after rep 5; rep 6 strength +12 vs rep 5 +6 (×2.00)
failed requests 0, page errors 0 — RESULT PASS
```
Red run: `broken/boss-brace.html` (1400→1000 ms) prints `rep 5 … brace 1010ms BOSS (FAIL) … RESULT FAIL`.
