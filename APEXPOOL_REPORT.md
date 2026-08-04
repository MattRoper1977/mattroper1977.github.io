apexpool-build-2026-08-04

# Apex Pool build, gate and landing report

## Scope

- Site repository only for the game: `MattRoper1977/mattroper1977.github.io`.
- Canonical path: `apexpool/index.html`.
- Live target: `https://madebymatt.uk/apexpool/`.
- One implementation; no Lessons copy and no Lessons resource entry.
- Canvas 2D, one HTML file, no external runtime dependency.
- Persistent writes route through `mbm_apexpool_`.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| P0 environment | Complete | `DONOR_MEASUREMENTS.md`; local Chromium unusable, GitHub Actions browser branch selected at P0. |
| P0 donor | Complete | `DONOR_MEASUREMENTS.md`; current heads, packaging, storage, screens, manifests and collision zone recorded. |
| P1 physics | Complete locally | Fixed 1/240 s step, accumulator, interpolation, substeps, equal-mass impulses, cushion openings, jaw vertices, pocket capture, squirt, throw, sliding→rolling, follow/stun/draw, jump/bounce, massé. |
| P2 prediction | Complete locally | Ghost ball, object path, same-engine spin-aware cue path, actual departure arc, blocker-aware AI raycasting, pointer and keyboard micro-aim. |
| P3 Leave Rating | Complete locally | Optional marker by pointer or keyboard, pure scoring, four disjoint bands, per-shot/session/best persistence and exact polite live announcement. |
| P4 8-ball rules | Complete locally | Open table, suit assignment, first-contact/rail/scratch/early-eight fouls, break/full-table ball-in-hand, called-pocket 8 win/loss. |
| P5 AI | Complete locally | Six-pocket target scan, probability scoring, safety fallback and seven personalities; 5,000-match fixture produces a measured 6.3%–68.6% spread. |
| P6 modes | Complete locally | Persistent eight-player bracket, ten three-star tricks, 60 s Speed Pool with +10 s pots, visible Tilt/Rough/Vortex forces. |
| P7 presentation | Complete locally | Lit table/balls, approach-to-overhead camera, decisive 8-ball ring replay, chalk dust/trails, measured splash discipline and full title screen. |
| P8 shell | Complete locally | Coins, cosmetic shop, settings, isolated storage, reduced motion, keyboard access and no-canvas guard. |
| P9 harness | Contract green; browser pending CI | `node tools/verify_apexpool.js`: all 96 checks pass. Workflow and Playwright verifier are included. |
| P10 publish | Pending repository write | Site PR, Games shelf PR, CI and deployment verification remain to be performed. |

## Gate evidence

### G1 — report sentinel

The report starts and ends with the sentinel. Verification command: `grep -c '^apexpool-build-2026-08-04$' APEXPOOL_REPORT.md`; required result `2`.

### G2 — frame-rate independence

`tools/verify_apexpool.js` drives the same shot at simulated 30, 60, 120 and 144 Hz through the 1/240 s accumulator. Maximum state delta is measured as `0` for all three comparisons against 30 Hz.

### G3 — draw / stun / follow

Recorded final cue-ball coordinates for otherwise identical fixtures:

| Spin | Final x | Final y |
|---|---:|---:|
| Full draw | 151.197435 | 260.000000 |
| Stun | 187.301325 | 260.000000 |
| Full follow | 219.091145 | 260.000000 |

The ordering and material separation are asserted, together with sliding→rolling transition, throw, jump/bounce and massé integration.

### G4 — honest prediction

The harness checks 30 combinations spanning full draw through full follow, three side-spin settings and two shot angles. The predictor and independently sampled simulation use the same integration cadence and are required to agree to `1e-8`. Browser rendering consumes that predicted cue path, and the departure arc is derived from post-contact points rather than a fixed 90° constant.

### G5 — no hidden dice

Seven mode declarations identify Leave Rating status and visible forces. Tilt renders arrows and a label; rough zones are hatched and labelled; the vortex renders rings and flow arrows. Hazard acceleration contains no random source.

### G6 — Leave Rating mathematics

The local harness includes 16 hand-checked distance fixtures, monotonic sweep, mutation check, repeatability check, invalid-input check, complete band coverage and 20,000 deterministic fuzz cases. The exact assistive string is asserted.

### G7 — storage isolation

Static checks prove the only write/removal sites route through `Store.key()` and the sole prefix literal is `mbm_apexpool_`. The Playwright gate loads Apex Kick, Apex Golf and Voxel values, completes an Apex Pool match lifecycle, and compares sibling values byte-for-byte before/after.

## Measured local result

Command: `node tools/verify_apexpool.js`

Result: `ALL 96 APEX POOL CHECKS PASSED`.

Current game file command: `wc -c apexpool/index.html`.

Current result: `88751` bytes, below the 250 KiB target.

## Browser evidence policy

No local render is claimed. Local Chromium hung on `about:blank`, `file://` and `localhost`. The included workflow installs Playwright Chromium, tests five viewports, takes screenshots, checks console/page errors, exercises keyboard leave placement, runs storage isolation, verifies reduced motion and uploads the evidence bundle.

## Merge hold

The supplied message ends at the start of G8 and does not include §10’s two merge exceptions. Building, testing and opening non-destructive PRs can proceed; automatic merge is withheld until those omitted exceptions are available or can be read from the complete source.

apexpool-build-2026-08-04
