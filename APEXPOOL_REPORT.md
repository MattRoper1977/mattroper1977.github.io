apexpool-build-2026-08-04

# Apex Pool build, gate and landing report

## Scope

- Site repository only for the game: `MattRoper1977/mattroper1977.github.io`.
- Canonical path: `apexpool/index.html`.
- Live target after landing: `https://madebymatt.uk/apexpool/`.
- One implementation; no Lessons copy and no Lessons resource entry.
- Canvas 2D, one HTML file, no external runtime dependency.
- Persistent writes route through `mbm_apexpool_`.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| P0 environment | Complete | `DONOR_MEASUREMENTS.md`; local Chromium was unusable, so the GitHub Actions browser branch was selected at P0. |
| P0 donor | Complete | `DONOR_MEASUREMENTS.md`; current heads, packaging, storage, screens, manifests, donor drift and collision zone recorded. |
| P1 physics | Complete and gated | Fixed 1/240 s step, accumulator, interpolation, substeps, equal-mass impulses, cushion openings, jaw vertices, pocket capture, squirt, throw, sliding→rolling, follow/stun/draw, jump/bounce and massé. |
| P2 prediction | Complete and gated | Ghost ball, object path, same-engine spin-aware cue path, actual departure arc, blocker-aware AI raycasting, pointer and keyboard micro-aim. |
| P3 Leave Rating | Complete and gated | Optional marker by pointer or keyboard, pure scoring, four disjoint bands, per-shot/session/best persistence and exact polite live announcement. |
| P4 8-ball rules | Complete and gated | Open table, suit assignment, first-contact/rail/scratch/early-eight fouls, break/full-table ball-in-hand and called-pocket 8 win/loss. |
| P5 AI | Complete and gated | Six-pocket target scan, probability scoring, safety fallback and seven personalities; 5,000-match fixture produces a measured 6.3%–68.6% spread. |
| P6 modes | Complete and gated | Persistent eight-player bracket, ten three-star tricks, 60 s Speed Pool with +10 s pots, visible Tilt/Rough/Vortex forces. |
| P7 presentation | Complete and browser-verified | Lit table/balls, approach-to-overhead camera, decisive 8-ball ring replay, chalk dust/trails, splash discipline and full title screen. |
| P8 shell | Complete and browser-verified | Coins, cosmetic shop, settings, isolated storage, reduced motion, keyboard access, portrait continuation and no-canvas guard. |
| P9 harness | Green | `tools/verify_apexpool.js`: 96/96. Playwright Chromium: 47/47. Evidence run `30871184804`. |
| P10 publish | PRs published; landing held | `MattRoper1977/mattroper1977.github.io#33` and `MattRoper1977/Games#7` are open, draft and mergeable. The site and Games validation workflows are green. Merge and live deployment remain withheld because §10 was omitted from the supplied brief. |

## Gate evidence

### G1 — report sentinel

The report starts and ends with the sentinel. CI runs:

```sh
sentinel_count=$(grep -c '^apexpool-build-2026-08-04$' APEXPOOL_REPORT.md)
test "$sentinel_count" -eq 2
```

### G2 — frame-rate independence

`tools/verify_apexpool.js` drives the same shot at simulated 30, 60, 120 and 144 Hz through the 1/240 s accumulator. Maximum measured state delta is `0` for all three comparisons against 30 Hz.

### G3 — draw / stun / follow

Recorded final cue-ball coordinates for otherwise identical fixtures:

| Spin | Final x | Final y |
|---|---:|---:|
| Full draw | 151.197435 | 260.000000 |
| Stun | 187.301325 | 260.000000 |
| Full follow | 219.091145 | 260.000000 |

The ordering and material separation are asserted, together with sliding→rolling transition, throw, jump/bounce and massé integration.

### G4 — honest prediction

The harness checks 30 combinations spanning full draw through full follow, three side-spin settings and two shot angles. The predictor and independently sampled simulation compare 5,940 path points and agree with a measured worst error of `0`. Browser rendering consumes that predicted cue path, spin changes produce distinct predicted leaves, and the departure arc is derived from post-contact points rather than a fixed 90° constant.

### G5 — no hidden dice

Seven mode declarations identify Leave Rating status and visible forces. Tilt renders arrows and a label; rough zones are hatched and labelled; the vortex renders rings and flow arrows. Hazard acceleration contains no random source. Chromium reads every live declaration and verifies each enabled mode exposes its force list.

### G6 — Leave Rating mathematics

The contract harness includes 16 hand-checked distance fixtures, monotonic sweep, mutation check, repeatability check, invalid-input check, complete disjoint band coverage and 20,000 deterministic fuzz cases. The exact assistive string is asserted in Node and Chromium.

### G7 — storage isolation

Static checks prove the only write/removal sites route through `Store.key()` and the sole prefix literal is `mbm_apexpool_`. Chromium loads Apex Kick, Apex Golf and Voxel values, completes an Apex Pool match lifecycle, and proves all sibling values byte-identical before and after. The only newly observed game key is `mbm_apexpool_progress`.

## Measured verification results

### Deterministic contract

Command:

```sh
node tools/verify_apexpool.js
```

Result: `ALL 96 APEX POOL CHECKS PASSED`.

### Browser verification

GitHub Actions run: `30871184804` on head `f9852f90b283786350e6ecf0548bcdf71ca5e973`.

Result: `ALL 47 BROWSER CHECKS PASSED`.

The browser suite verified:

- five viewports: 390×844, 768×1024, 1024×768, 1366×768 and 1536×864;
- one live canvas with no page overflow at every viewport;
- accessible portrait continuation and successful game start in portrait;
- 16-ball 8-ball startup, live spin-aware prediction and keyboard leave movement;
- exact polite Leave Rating announcement;
- sibling storage byte identity and prefix-only Apex Pool writes;
- reduced-motion playability and patterned/labelled rough zones;
- all seven mode force declarations;
- zero remote resource requests, zero console errors and zero page errors.

The uploaded evidence contains 19 files, including title/game screenshot pairs for all five viewports, interaction result and reduced-motion rough screenshots. Artifact `8877945995` is 3,568,009 bytes with SHA-256 `9900b0be0016d2b60c6ccbc4e3a8743df581ca2a1ef789b99803725800b3ba6e`.

The screenshots were visually inspected: the title and table remain readable without clipping, the phone portrait choice is explicit rather than forced, the game is usable after continuing, and rough forces are conveyed by pattern and text rather than colour alone.

### Packaging

```sh
wc -c apexpool/index.html
```

Result: `88751` bytes, below the 250 KiB target. CI also proves zero external scripts, zero external styles and zero game network calls.

## Publication state

- Site PR: `MattRoper1977/mattroper1977.github.io#33` — draft, open and mergeable; nine-file additive scope with no homepage `index.html` and no Lessons change.
- Shelf PR: `MattRoper1977/Games#7` — draft, open, mergeable and green; one-file manifest diff, 11 additions, no deletions.
- Games manifest after the shelf change: 32 entries, 32 `art` fields, Physics tag count 6.
- The shelf PR is dependency-held behind the site PR so it cannot advertise an absent route or artwork.
- Branch-protection settings remain **UNVERIFIED** because the available connector does not expose them.
- No live deployment is claimed before merge.

## Donor drift found during CI

Apex Kick’s current file is 162,122 bytes. Its 25-check donor harness currently reports 24 passed and one failed because absolute canonical/Open Graph URLs are classified by that harness as remote resources. This was recorded in `DONOR_MEASUREMENTS.md`; it is unrelated to Apex Pool and does not gate this build.

## Merge hold

The supplied message ends at the start of G8 and does not include §10’s two merge exceptions. Building, testing and opening non-destructive PRs can proceed; automatic merge is withheld until those omitted exceptions are available or can be read from the complete source.

apexpool-build-2026-08-04
