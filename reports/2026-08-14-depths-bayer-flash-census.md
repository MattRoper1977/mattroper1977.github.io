# 2.1 — Depths flash census, Bayer roof cutaway

Measurement only. `emberwild/index.html` was **not modified**. Part 2 stops here
under its own §2.1 rule: the traverse breaches the estate's flash criterion as it
currently ships, and that outranks the rest of the part.

One measuring agent, then **three adversarial refuters on separate lenses**
(reachability, arithmetic, instrument). **0 of 3 refuted.** Each wrote its own
BFS, its own probe and its own clock rather than reusing the first harness.

---

## The route was derived, never replayed

Trap 13 is why this census exists at all — the pass before it claimed an
overworld route that lands somewhere else entirely.

Every leg here was derived by BFS over the game's own `tryMove`
(`index.html:4527-4532`), then **walked with real arrow-key presses with every
landing asserted against the BFS prediction**. Zero mismatches across all runs.

- Overworld from spawn (10,17): **296 tiles reachable**, **0 of 12** lodge
  interior tiles, door tile (4,18) unreachable. Independently reproduced by two
  refuters, both getting 296.
- Depths mouth (6,6) has exactly one reachable neighbour, (5,6), at **16 steps**.
  Walked, faced the seam, pressed Z, entered through the game's own
  `checkInteraction → enterDepths`. No agent called `enterDepths()` directly in a
  measurement run and none teleported.
- Inside the Depths, across **five dungeon seeds**, the tiles the cutaway keys
  off are reachable in every one (7, 20, 22, 22, 23 of 24). Tours walked at
  57/57, 52/52, 53/53, 55/55 and 46/46.

Refuter 1 found and corrected a real hazard while doing this: the **chassis**
`Surface` enum at `:1169` and the **engine** enum at `:2702` disagree. Using the
wrong one would silently produce a different reachability map.

## It is not inert in the Depths

`drawBuilding` (`:4142`) is called **unconditionally** at `:4245`, so the
Research Lodge — walls, windows, door, sign and dithered roof — is drawn hanging
over the cave floor.

`applyBayerDither` fired **361–411 times per traverse, 43.5–47.8% of all rendered
frames**. Call counts were cross-checked by independently diffing pixels
before/after each call; the changed-pixel count equalled the `fillRect` count
exactly in ~2,300 calls, and in refuter 2's runs in **1,599 calls with zero
deviations**.

Trap 14 is discharged: the state a fix would create has now been measured.

## The defect

`applyBayerDither` strides `px += 2, py += 2` across a 4×4 matrix, so only a 2×2
sub-block is ever sampled, and which sub-block is chosen by the **parity of the
rect origin**, which comes from `camSnapX`/`camSnapY`. Sub-blocks:
`{0,2,3,1} {8,10,11,9} {12,14,15,13} {4,6,7,5}`.

Predicted from the matrix alone, then measured — exact match, zero deviations:

| opacity | parity (0,0) | (0,1) | (1,0) | (1,1) |
|---|---|---|---|---|
| 0.32 (behind) | **0%** | 100% | 100% | 50% |
| 0.08 (inside) | 50% | 100% | 100% | 100% |

A **one-pixel camera pan** flips a parity bit, so the roof's dot screen switches
between fully painted and completely blank between consecutive frames. Worst
single pan measured: camX −135 → −136, origin x 199 → 200, `fillRect` **1305 → 0**,
region relative luminance 0.13988 → 0.17138.

98–199 natural one-pixel pans per traverse; **19–24% were a full 0↔100% flip**;
mean |Δcoverage| 40.9–49.5 points. Camera pans 63–127 snapped px/s while walking.
Median coverage-state run length: **one frame**.

## Rate and amplitude

Measured with the estate's own `tools/flicker_analyse.mjs` (self-test passing).

| | measuring agent | refuter 2 |
|---|---|---|
| region, active | **9.97–13.92 Hz** | **11.43–14.91 Hz** |
| whole viewport | 0.000 Hz | 0.000 Hz |

The whole-viewport reading of **zero** is important: the localised flash is
completely flattened by the whole-canvas mean. That is the exact limitation
`measure_olympics_flash.mjs` names in its own header as an unclosed next step.
This census is that locus pass.

Refuter 2 checked the denominator specifically, since a caller leaving the
default `fps=60` while capturing at 47–53 fps would overstate the rate by up to
28%. The harness passes measured fps. **The Hz is honest.**

Amplitude: worst single-frame relative-luminance swing **0.0289–0.0362**,
region peak-to-peak **0.0336–0.0473** (12.25–16.43 of 255). Above the estate's
2.0-unit MEANINGFUL floor — so the rate is a real signal, not 8-bit quantisation
noise — and below its 25.5-unit HAZARDOUS floor.

Refuter 2's one divergence, and it pushes the finding **harder**: amplitude was
computed over the whole 88×57 rect while the flashing footprint is smaller, so
the localised amplitude is understated by that denominator.

## Verdict, both ways — they disagree, and both are reported

**Estate criterion (>2.4 Hz, and reduced-motion awareness): BREACHED.**
9.97–14.91 Hz is 4–6× the 2.4 Hz line and 3–5× the 3 Hz `CEILING_HZ` in the
estate's own census tool. Reduced-motion unawareness is confirmed both
structurally — neither `drawBuilding` nor `applyBayerDither` consults any
`EWMotion` family or game setting — and empirically: the coverage table is
identical to the digit under `prefers-reduced-motion: reduce`, and the rate
measured *higher* under RM (13.07 vs 11.21 desktop; 13.92 vs 12.53 phone), though
the non-RM spread alone is 9.97–12.53, so the rise is not attributable to RM.
Only this: **RM does not reduce it.**

**WCAG 2.3.1 general flash threshold: NOT breached.** Three conjunctive prongs:

| prong | verdict |
|---|---|
| rate > 3 Hz | **met** (3.2–5.6 flashes/s at ≥0.02; 9.9–14.1 at ≥0.01) |
| relative-luminance delta ≥ 0.10 | **not met** — max 0.0362 single-frame, 0.0473 peak-to-peak; zero qualifying opposing changes in any run |
| area ≥ 25% of a 10° field | met at desktop (28,892 CSS px², 1.32×); **not met** at phone (8,477 px², 0.39×) |

It fails the conjunction on amplitude at every configuration.

In the estate's own census vocabulary this is **"over the rate ceiling but under
the 10% hazard floor — reported, not hidden."** The boolean is set true against
the estate's house rule, which is breached decisively. **No photosensitivity
hazard is being asserted**: WCAG 2.3.1 is not met and the estate's own hazard
floor is not reached. Those two facts are for a human to weigh, not for an agent
to collapse into one answer.

## Instrument, checked rather than asserted

Refuter 3 measured the probe's own cost instead of claiming it had none: 43.28 vs
43.87 fps, 9.157 vs 9.435 Hz, max dL 0.03426 vs 0.03452 — about one percent of
frame rate. It then removed the confound entirely by pinning the clock to a
deterministic 60 fps (the estate's own device from `measure_olympics_flash.mjs`),
under which no probe cost can change camera pan per frame, and **the effect got
larger, not smaller**.

Trap 45 was audited line by line and the probe is compliant: `getContext` only on
canvases it created, game layers used only as `drawImage` sources,
`game.softwareRenderer.ctx` being the renderer's own. A positive control was
built from the witness: deliberately taking a 2D context on `#fx-canvas` flips
`EWFx` from `gpu`/`WebGL2 instanced` to `fallback`/`Canvas 2D fallback`, so
`state: gpu` genuinely discriminates — and every non-RM run reports it.

## Secondary, found in passing and not acted on

The dither rect is an axis-aligned **88×57** and is **not clipped to the roof
polygon**, so the stipple visibly spills past the roof onto the lodge walls and
the floor tiles beside it. Visible in both screenshots. Reported, not repaired.

---

## Why Part 2 stops here

§2.1: *"If the traverse breaches the flash threshold as it currently ships, that
is a live defect on a child-facing game and it outranks everything else in
Part 2 — report it and stop the whole part."*

It does breach, on the estate's own criterion, confirmed by three independent
refuters. **2.2 and 2.3 are not started.** 2.4 was completed before this reported
and is independent of the Bayer sequence.
