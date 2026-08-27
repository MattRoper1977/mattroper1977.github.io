# Titan Forge + Crown & Badge launch ledger

Sentinel: `titan-crown-launch-2026-08-27`

This ledger records measurements from the current repositories. Values in the master prompt are treated as historical expectations, never as current facts.

## P0 — identity and provenance gate — PASS

Measured at the start of this run on 2026-08-27 UTC.

### Attachment identity

| Attachment | Bytes | SHA-256 | Result |
|---|---:|---|---|
| `TITAN_FORGE_Strength_Ascension_Prototype.html` | 6,424,460 | `7f87ee50b266981d81d436001f10a585c8fe320687f19b695e86d0dfb282e736` | exact match |
| `Crown_and_Badge_Frontier_Watch_v1_0_Standalone(1).html` | 157,928 | `0f29e26cdfc8f8577d24117145853c02e5ee00012292c6fd5d1fc052acc7d260` | exact content match; `(1)` is filename-only |

### Repository heads and starting worktrees

| Repository | `main` head at baseline | Starting state |
|---|---|---|
| Site — `mattroper1977/mattroper1977.github.io` | `2732bf627960f2e00668bed7afef036e2546115d` | clean; tracking `origin/main` |
| Games — `MattRoper1977/Games` | `9e8254a749f83d0384e709c06482c76c957b0b17` | clean; tracking `origin/main` |
| Lessons — `MattRoper1977/Lessons` | `288f84543ccef2884de62e6002b4b814360249c1` | clean; tracking `origin/main` |

Working branches were created only in Site and Games: `codex/titan-crown-launch-2026-08-27`. Lessons has no planned write because both routes are site-served.

### Shelf, routes and marker

- Canonical shelf: Games `games.json`.
- Current entries: **55** — **26 site-served + 29 Lessons-served**.
- Historical prompt value was 52; the measured drift is Apex Curl, Apex Velodrome and Micro-Tinkerer.
- Derived target after both launches: **57** — **28 site-served + 29 Lessons-served**.
- `/titanforge/`: absent from the canonical shelf and absent on disk — free.
- `/crownbadge/`: absent from the canonical shelf and absent on disk — free.
- Exactly one current `NEW ·` holder: `/emberwild/`, title `NEW · Emberwild`.

Full canonical href list at baseline:

1. `/emberwild/`
2. `/novasiege/`
3. `/ouroboros/`
4. `/olympics/`
5. `/fracture/`
6. `/neonturf/`
7. `/echovault/`
8. `/relicforge/`
9. `/Lessons/Games/Off_Brand.html`
10. `/Lessons/Games/Axiom_Shift.html`
11. `/Lessons/Games/Charcoal.html`
12. `/Lessons/Games/Hold_the_Mark.html`
13. `/Lessons/Games/Glitch_Clash.html`
14. `/Lessons/Games/Trail_Runner.html`
15. `/Lessons/Games/voxelcraft.html`
16. `/Lessons/Games/Vortex.html`
17. `/Lessons/Games/Globe_Snake (1).html`
18. `/Lessons/Games/Neon_Snake_Overdrive.html`
19. `/Lessons/Games/Neon_Siege.html`
20. `/Lessons/Games/Neon_Garden.html`
21. `/Lessons/Games/Orbital.html`
22. `/Lessons/Games/Grid_Chase.html`
23. `/Lessons/Games/Prism.html`
24. `/Lessons/Games/Grapple.html`
25. `/Lessons/Games/Marble.html`
26. `/Lessons/Games/Slipstream.html`
27. `/Lessons/Games/Slipstream_GP.html`
28. `/Lessons/Games/Wrecking_Crew.html`
29. `/Lessons/Games/Lumins.html`
30. `/Lessons/Games/Static.html`
31. `/Lessons/Games/OneGuy.html`
32. `/Lessons/Games/The_Last_Lighthouse_v1_1_The_Archipelago_Update_FINAL.html`
33. `/Lessons/Games/KidsVsStaff_Showdown (3).html`
34. `/Lessons/Games/WorldCup_ThreeLions_Final.html`
35. `/Lessons/Games/WorldCup_v3_MatchDirector.html`
36. `/Lessons/Games/WorldCup_v5_Showdown.html`
37. `/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html`
38. `/voxel/`
39. `/apexkick/`
40. `/apexpool/`
41. `/apexgolf/`
42. `/apextennis/`
43. `/neonsync/`
44. `/biopunkhive/`
45. `/neonbreach/`
46. `/apexrally/`
47. `/medevac/`
48. `/luminahaven/`
49. `/auroralinks/`
50. `/neonmeridian/`
51. `/rallyvector3d/`
52. `/hyperdraft/`
53. `/apexcurl/`
54. `/apexvelodrome/`
55. `/micro-tinkerer/`

### Taxonomy baseline

The authoritative record remains `TAXONOMY` in Site `games/index.html`.

Genres, in declared order, and measured membership counts:

| Genre | Games |
|---|---:|
| Arcade & Reflex | 10 |
| Sports | 10 |
| Strategy & Puzzle | 8 |
| Party & Whole-Class | 7 |
| Physics & Simulation | 5 |
| Adventure & RPG | 5 |
| Racing & Driving | 4 |
| Sandbox & Creative | 4 |
| Action & Survival | 2 |

Declared feel slugs: `calm`, `fast`, `thinky`, `gravity`, `quick-go`, `long-haul`, `together`.

There are 55 taxonomy rows for 55 shelf entries at baseline.

### Splash and exit instruments

- `tools/verify_games_splash.mjs`: **absent**. No workflow invokes it.
- Current canonical replacement: `tools/render_splash.py`, backed by live donor `assets/brand/mbm-splash.js`; it is invoked by `.github/workflows/apex-rc-verify.yml`.
- `tools/verify_inline_exit.mjs`: **present** and now wired to `.github/workflows/inline-exit-verify.yml` and `.github/workflows/mbm-audience-discovery-closeout.yml`.
- Historical prompt claim that the exit verifier had no workflow is therefore corrected by current measurement; P5 must extend the existing declared set and preserve the already-live workflow rather than wire a duplicate.

### Planned write surface

Site: `titanforge/index.html`, `crownbadge/index.html`, their generated chassis declarations, `games/index.html`, `data/source-manifests/games.json`, `data/new-release-occupants.json`, `sitemap.xml`, task-specific model/test tooling, workflow path coverage where required, and this ledger. Games: canonical `games.json`. Lessons: none unless a later derived gate proves otherwise.

## P1 — Titan payload surgery — candidate complete; rendered proof pending CI

- Native quality-82/method-6 reproduction: background **239,360 B**; athlete **176,486 B** with alpha preserved.
- The native q82 outputs did not clear the SSIM floor, so quality and dimensions were changed under the prompt's permitted measured fallback rather than accepting softness.
- Shipped background: **1200 × 675**, WebP q90/method 6, **223,392 B**, SSIM **0.9876375198**.
- Shipped athlete: **700 × 1050**, WebP q86/method 6, **123,880 B**, alpha preserved, SSIM **0.9869825840**.
- Shipped `titanforge/index.html` after both generated chassis regions: **866,163 B**; two WebP data URLs; zero PNG data URLs.
- The deliberately corrupt-athlete control and the 390 × 844 / 1280 × 800 paint screenshots are implemented in `tools/titan-crown/browser.mjs`; they remain unclaimed until the CI Chromium run completes.

## P2 — Titan correctness and fairness — model/static green; rendered proof pending CI

- `touch-action: manipulation` is applied to every button and the lift control. The browser gate removes it in a served scratch variant and requires the computed-style predicate to turn red.
- The timing meter now derives its position from `requestAnimationFrame` timestamps. Modelled 3× frame stretch changes sweep duration by **0.000%**; the fixed-increment control changes it by **67.200%** and is red against the ±3% band.
- Ascension preserves `bestCombo`, lifetime `reps`, lifetime `perfects`, `lastDaily` and `claimedQuests`; only run state resets. The legacy control reclaims the daily three times across three ascensions.
- The bounded sanitiser type-checks/clamps every save field and caps the raw load at 1 MiB. Seven hostile browser inputs are wired; their rendered result remains pending CI.
- Final storage key: `mbm_titanforge_save_v1`; old key occurrences: zero.

## P3 — Titan balance — PASS

`tools/titanforge/model.mjs` is DOM-free and its controls reproduce the legacy build before judging the replacement:

| Measurement | Result |
|---|---:|
| Legacy 100% taps / 25% taps | 56 / 78.182 |
| Legacy final gear / lifetime coins | id 2 / 776 |
| First ascension mean taps, 25% | 379.586 |
| First ascension mean taps, 50% | 334.645 |
| First ascension mean taps, 100% | 270.000 |
| Titan Core owned by ascension | 1 |
| Every gear tier owned by ascension | 1 |
| Every zone entered by ascension | 1 |
| Minimum gems spent over three ascensions | 270 |
| Trial / best non-trial coins-per-minute ratio | 0.045935× |

Trial cost choice: **one attempt per rival per ascension**. It is legible, deterministic and closes repeat farming without adding another timer. Legacy trial control: **3.174603×**, red against the ≤3× gate. The permanent gem sinks are Heirloom Gear, Combo Anvil and Focus Window; the no-sink control spends zero and reds.

## P4 — Crown & Badge balance and surfaces — model/static green; rendered proof pending CI

- Final Hard multipliers: threat **1.06**, penalty **1.05**, spawn **1.11**.
- Chronicle cap: **200** with `logGenerated` validated and migrated; observed maximum **113**. The 40-entry control truncates **119/120** campaigns.
- `mobileGoalProgress` and `endDayLedger` are in the canonical phone topbar/End Day surfaces; Valor is retained at ≤430 px.
- The trailing map media patches were folded into the canonical 760/430 breakpoints. The four-width pixel-identity gate and its 97%/96% width control are implemented in the CI browser gate and remain unclaimed pending that run.
- Determinism: **20/20** seed pairs byte-identical. `Math.random`: **1 occurrence**, confined to audio noise.

Greedy and idle harness results, 120 seeds each:

| Difficulty | Greedy wins | Median end day | Idle wins | Idle median death |
|---|---:|---:|---:|---:|
| Calm | 97/120 (**80.8%**) | 30 | 0/120 | 9 |
| Standard | 61/120 (**50.8%**) | 30 | 0/120 | 7 |
| Hard | 34/120 (**28.3%**) | 26 | 0/120 | 7 |

Legacy Hard control: 4/120 (**3.3%**), median day 14 — red against the launch band.

## P5 — house chassis — generated/static green; rendered proof pending CI

- Live donor and repository donor matched exactly before stamping: **6,573 B**, SHA-256 `0bb61e5606c1bf7bc223e38afdbfd56e6adb6bdba3e993f27ec7607f3c49d837`.
- Generated splash region: **7,555 B**, SHA-256 `6ad6aea6dd76056e5ba1688c6ffff8002352ed658d4aab82cbb226b8371f4c6a`; both games joined the eight-target generator set.
- Generated inline exit: **3,222 B**, SHA-256 `c87aaf664f86b83c871a898f0e56cd6540cbedd45a44fad0f223ec28013608d9`; both games joined the fifteen-target declared set and the existing workflow path coverage.
- Crown keys are final: `mbm_crownbadge_campaign_v1`, `mbm_crownbadge_meta_v1`, `mbm_crownbadge_scores_v1`, `mbm_crownbadge_settings_v1`; old key occurrences: zero.
- Static request surface is zero for Crown and zero request-capable subresources for Titan. Reduced-motion scope is decorative/chrome only; gameplay timing/map motion remains.
- `tools/verify_games_splash.mjs` polls all generated targets in both motion states and includes a removed-region control. Offline, lossless-save, 44 px, exit, and flash-rate measurements are wired into CI and remain unclaimed pending Chromium.

## P6 — shelf landing — static/generator green; rendered invariant pending CI

- Canonical result: **57 games = 28 site-served + 29 Lessons-served**. Site mirror is byte-identical to Games `games.json` at **30,765 B**, SHA-256 prefix `cc5b0fff2aed9f44`.
- Exactly one `NEW ·` holder: `/crownbadge/`; Emberwild's marker was removed atomically. Titan has no marker.
- Crown: Strategy & Puzzle; `thinky`, `long-haul`. Titan: Arcade & Reflex; `quick-go`, `fast`.
- Resulting counts: Arcade & Reflex **11**; Sports **10**; Strategy & Puzzle **9**; Party & Whole-Class **7**; Physics & Simulation **5**; Adventure & RPG **5**; Racing & Driving **4**; Sandbox & Creative **4**; Action & Survival **2**.
- Crown hue `#194C47`; nearest Medevac Frontier `#1A8193`, ΔE00 **20.61**. Titan hue `#4630A8`; nearest Lumina Haven `#A83FBF`, ΔE00 **18.37**. New hues against each other: **32.04**.
- Sitemap now carries **466** unique URLs and covers all **28** site-served shelf routes.
- Curation remains untouched: both `featured: false`, `hero: false`, neither in the eight-game rail nor the eighteen takes.
- Derived card invariant target is **57 shelf + 8 rail = 65 painted cards** on each surface. `tools/verify_pupil_genres.mjs` carries the shared-record mutation control; rendered proof remains pending CI.

## P7 — merge and live verify — pending

No merge, deployment or live-byte claim is recorded before the CI browser evidence is green. The live workflow is ordered behind an exercised comparator control and anchors its wait loop on the previously-unpublished `/crownbadge/` route.
