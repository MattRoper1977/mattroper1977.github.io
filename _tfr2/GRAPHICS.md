# TFR2 P3 — graphics pass (2D-first)

Build: `tools/build.py` → `_tfr2/titanforge.html`. New layer sources `src/v5-graphics.css`, `src/v5-graphics.js`;
G3 lives inside `mbm-titan-mobile-v2-script` via 11 anchored single-match patches. Screenshots at 412x915 in
`_tfr2/shots/p3/`: `p3-idle`, `p3-perfect`, `p3-formchange`, `p3-trial-last3s`, `reduced`.

## What shipped
- **G1 parallax** — sky = the painted arena background, offset via registered `--mbm-px/--mbm-py` on lift impact
  (90 ms kick, 520 ms settle); mid = SVG ridge band; foreground = zone-coloured glow band. Both bands drift
  slowly on idle (class after 2.6 s without a lift). Zone colour drives the glow. Reduced motion: static.
  *Deviation:* the first cut copied the 400 KB painted webp onto two transformed layers; each extra full-screen
  composited layer cost ~10 fps under the 4x-throttled budget, so the sky is not a copy and does not idle-drift.
- **G2 zone lighting** — `data-mbm-zone` (beach warm #ffb95a / foundry magenta #ff5ce6 / citadel cyan #62e4ff)
  on `.arena` and `.fighter-stage`; key light = one zone-tinted drop-shadow on the athlete; rim = a div masked
  by the athlete's own image ∩ a radial falloff, screen-blended. Colour and opacity crossfade in 600 ms.
- **G3 2D FX** (TitanFallbackFX) — pool 96 normal / 48 low. Chalk dust on the DRIVE tap, sweat glints while
  bracing, ember + spark burst in zone colours on lockout, ground shockwave ring scaled by grade, additive glow
  pass on PERFECT. Idle fix: `setEnabled` no longer re-arms drawing on every class mutation (the input drew
  6–8 frames per second while idle). Muscle overlay is baked to an offscreen canvas and only re-baked when its
  inputs change; canvas shadowBlur replaced by double strokes. Zero draws when idle is now measured, not assumed.
- **G4** — squash 1.00 → 0.97x/1.03y → 1.00 over 220 ms on every lift; PERFECT adds a 4 % push-in for 180 ms
  driven by `--mbm-cam` on the stage and the bands. `.mbm-v3-punch` is neutralised (a transform on `.arena`
  would re-anchor the fixed LIFT button).
- **G5** — form unlock: flash, old portrait diagonal-wipes out, new portrait wipes in, name plate slams, one
  strong haptic (900 ms). Reduced motion: instant swap + static plate.
- **G6** — `.trial-hud` present → crowd-light band pulses at the arena edges; timer ≤ 3 s → red band, red tint,
  key light turns red.
- **G7** — rank change (ROOKIE→CONTENDER→FORGEBORN→COLOSSUS→TITAN, thresholds from the core's `t2`) shows a
  full-width card for 1.4 s. Ascension resets the tracker so the drop back to ROOKIE shows nothing.
- **G8 Three.js** — block kept, "3D RIG" stays opt-in. Bytes: **2,150,997 with** the block, **1,547,512 without**
  (block = 603,485 B). **MATT DECIDES**; no `THREE=drop` flag was given, so nothing removed.

## Performance budget (412x915, coarse pointer, 4x CPU throttle, 30 s scripted tri-phase play, fixed 3.2 s cadence)
| build | median fps | min | lifts | FX draws in the idle window (3 s→4 s after last lift) |
|---|---|---|---|---|
| before (P2 build = input FX) | **53** | 37 | 9 | **6** (input already violates the idle rule) |
| after (P3) | **53** | 27 | 9 | **0** |

Earlier non-deterministic runs (energy-gated retries, 7–10 lifts) spread 49–57 before and 46–57 after; the
deterministic cadence removes that variance. Harness: `tools/perf_budget.mjs`.

## Reduced-motion run (OS + in-game toggle, one PERFECT rep that also unlocks a form and a rank)
`parallaxKicks 0, camPushes 0, squashes 0, idleDrifts 0; particles spawned 0; glow passes 0; running V5
animations/transitions: none; --mbm-cam 1; form = instant swap + plate; rank card static` — PASS.

## Other gates
- Phone proof on the P3 build: LIFT YES at 360/390/412, phase track visible, head not clipped, no popup box
  (including the new rank card, cinematic and crowd bands) overlaps the fixed LIFT; 0 failed requests.
- 6-rep harness: combo x1..x6, 6/6 with GAINS ×1.9 on every rep, boss brace 1402 ms — PASS.
- Every script block passes `node --check` (12 blocks).
