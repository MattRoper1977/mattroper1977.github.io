# PLAY-Q1 splash checkpoint — coverage table and batch plan (CX2 §7.1)

Derived by `tools/play_splash_coverage.py` from the built Play domain catalogue; never hand-counted. Re-run and recommit after every batch.

Routes, families and owners, and which routes carry the current generated region, are recorded in `docs/play-q1/coverage.json`. That file is the record of truth; this README states no digests and no byte counts, because a hand-copied value here cannot be checked and has already gone stale once.

## Design (decided under "decide and continue", recorded for Matt)

- **D6 — one region, host-conditional visual.** The single generated `MBM-MAKER-SPLASH` region stays byte-identical on every route. On the Play host (`madebymatt-play.uk`, or `?brand=play` for local proof) it paints the Play lockup; anywhere else (the education domain, where the seven Lessons routes are also served) it paints the Made by Matt mark, so Education branding stays separate.
- **D7 — timing unchanged.** Tap/key skip, the 1.9 s brand animation, the 2.1 s cap, reduced motion at .35 s, the 24-hour suppression, focus hand-off and legacy neutralisation are the accepted canon and its verifier's contract; PLAY-Q1 changes the visual and adds a loading status that shows only while `document.readyState` is not `complete` (indeterminate; no percentages). Whether the 1.9 s brand moment counts as a "forced delay" under §7.1 is Matt's call.
- **D8 — palette from the Play tokens.** Charcoal `#0b1020`/`#081422`, mint `#84e0c0` on the wordmark's *Play*, cyan `#5fd3ff` supporting line **YOUR NEXT GAME STARTS HERE.**, restrained violet `#7a6cf0` loading bar.
- **D9 — the mark travels inside the region.** CyberPulse forbids external images (`img-src data: blob:`) and the Lessons games are single files by rule, so the lockup carries a 240×158 resize of the accepted mark as a data URI (`tools/prepare_play_splash_mark.py`, record `domain-split/play/splash-mark.json`, source sha `bfef5b1e…792a` bound). Resize only: no crop, no recolour, no redraw. If it fails to decode the lockup drops the picture and keeps the wordmark.
- **D10 — House Olympiad's own ceremony stood above the canon.** `#v6Fly` (the game's V6 intro dialog) was stacked at `z-index:2147482100`, above the generated region (`2147482000`) and below the inline exit (`2147483000`), so on that route the maker splash, Play lockup included, painted underneath the game's own intro and a tap never reached it. This existed since the canon was applied in August; the Play proof's new top-hit sample found it. The ceremony now sits at `2147481900`, below the splash; the estate ladder (splash below exit; games' own sheets between) is unchanged. The Play proof asserts on every stamped route that, while the overlay is interactive, the element under the viewport centre belongs to it. The generator announces no dismissal event a game could wait for, so a game-owned intro still runs under the splash for its 2.1 s; batch 4 (game-owned title splashes) is where that is looked at per route.
- **Measured, not assumed: on the heavier games the mark appears late.** The single-file games run large inline scripts between parse and `load`; on trailrunner, auroralinks and olympics the main thread is busy for 1.5–2.5 s after the region attaches, so the inline JPEG decodes only when it frees (trailrunner at 1280: attached 52 ms, decoded 1971 ms, load 2346 ms, cap dismissal 2350 ms on the proof machine). The lockup's charcoal field, wordmark and line are painted immediately (styled text); only the mark waits. The loading status shows throughout on those routes and is hidden once the document is complete. The proof records these timelines per route and viewport (`play-splash-batch1.json`); the verifier reads facts from an in-page observer at attach time because a harness read can itself land after the cap on those routes.

## Batches

1. **Canon routes, Site-declared (18)** — this pull request stamps 14: generator change, re-stamp, verifier controls, Play-visual proof (`tools/verify_play_splash.mjs`), and the Play evidence chain rebound to the new bytes (`evidence.json`, `preservation.json`, the Rally source revision, `discovery-review.json`, 14 screens recaptured with `tools/capture_play_screens.cjs`). **1b — the four clip-bearing routes** (`/apexkick/`, `/voxel/`, `/offbrand/`, `/novasiege/`) stay at the previous accepted region, declared as `held-at-previous-region-with-reason` in `data/hud-coverage.json`: each carries an accepted gameplay clip bound to its published bytes, and the builder refuses a clip bound to different bytes, so they follow once the Play capture job has recaptured the clips against the new bytes and Matt has accepted them.
2. **Canon routes, Lessons-declared (6 on the shelf + R_Gate_Calibration_Game)** — done: Lessons #557 moved its generator pin to the merged Site commit `acd9f0cc` and re-stamped the seven (its R1–R7 verifier PASS, 4/4 controls); this Site pull request moves the Lessons pin, re-mints the education admission registry for the two education-published members (V=IR Pupil App, R_Gate Calibration Game) and rebinds the Play evidence and the six shelf screens to the new bytes.
3. **Legacy `MBM-SPLASH` region (6)** — every one is `declined-with-reason` in the Site ledger against a named per-game gate assertion (`tools/apex_rc_gate.mjs` for apexcurl and apexvelodrome, `tools/titan-crown/verify_launch.mjs` for crownbadge and titanforge, the byte-pinned provenance of biopunkhive, the way-out walk on fracture). Each is a contract change for that game's owner, taken one route at a time with its gate re-proved; none is taken silently under this checkpoint.
4. **Game-owned title splash (14)** — the Site-owned members are all declared (`declined-with-reason` against a named gate, or held for 1b); the 8 Lessons-owned members fall under batch 5's ruling.
5. **No splash (24)** — the 27 Lessons shelf games (19 here plus the 8 own-splash ones) carry no splash key by the SC1 §5 ruling in `reports/2026-09-02-games-census.md` ("declined by construction"), a Lessons-owned decision this checkpoint records and does not overturn; the table shows them as `Lessons:declined-by-construction (SC1 §5)`. The Site-owned no-splash routes are declared against their gates (see 3).

Every batch: pilot one route per delivery mechanism first, then the batch; publication through the Games pin release (held by BLOCKER B3 at the time of writing).

### Re-stamp, 2026-09-16 (generator fix)

The browser controls found two defects in the generated region itself and a third in its
dismissal, so the generator was fixed and **all 14 applied Site routes were re-stamped**
(`tools/render_maker_splash.py --root . --write`; `--check` then reads 0 divergent, and a
second `--write` changes nothing). The four held routes and every declined route are
untouched by construction.

- **The insert point comes from `html.parser`, not a substring match.** A `'<body>'` inside
  a CSS comment could take the insertion, putting the region outside the document body.
- **`armWayOut()` refuses to arm when the start control *is* the way out**, and `primary()`
  never resolves to `#mbmexit-back` / `#mbmhud-back` / `#mbmexit-home` / `#mbmhud-home`. The
  hand-off landing on the exit is the property the new **WO1** control asserts, not a
  precondition it assumes.
- **An automatic dismissal releases the window event guard at once**, so a click in the gap
  between the overlay going inert and `finish()` is no longer swallowed (**GD1**).

Both new controls are red on the old bytes by design and green after the re-stamp
(81/81). The region moved, so CyberPulse's `SPLASH_BYTES` was re-cut from the
verifier's own measurement and its revision comment extended. The value itself lives
in `tools/cyberpulse/verify.mjs`; it is not restated here.
The Play evidence chain was rebound to bytes the publisher measured, not computed:
`evidence.json` (14), `preservation.json` (14), `discovery-review.json` (7), the 14 game
screens recaptured with `tools/capture_play_screens.cjs` from a local Play build (8 moved,
6 came back byte-identical), and a new current Rally source revision. The 6 Lessons shelf
routes read `current=false` in the coverage table until Lessons batch 3 re-stamps them with
the same generator; that is expected, and recorded here rather than hidden.


## Routes

| route | owner | kind | family | region current | ledger | CSP blocks external images |
|---|---|---|---|---|---|---|
| `/cyberpulse/` | Site | game | canon | yes | Site:applied | yes |
| `/crownbadge/` | Site | game | legacy-region | no | Site:declined-with-reason | yes |
| `/houseolympiad/` | Site | game | canon | yes | Site:applied |  |
| `/titanforge/` | Site | game | legacy-region | no | Site:declined-with-reason |  |
| `/emberwild/` | Site | game | none | no | Site:declined-with-reason |  |
| `/novasiege/` | Site | game | canon | no | Site:held-at-previous-region-with-reason |  |
| `/ouroboros/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/olympics/` | Site | game | canon | yes | Site:applied |  |
| `/fracture/` | Site | game | legacy-region | no | Site:declined-with-reason |  |
| `/neonturf/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/echovault/` | Site | game | canon | yes | Site:applied |  |
| `/relicforge/` | Site | game | canon | yes | Site:applied |  |
| `/offbrand/` | Site | game | canon | no | Site:held-at-previous-region-with-reason |  |
| `/Lessons/Games/Axiom_Shift.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Charcoal.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Hold_the_Mark.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Glitch_Clash.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/trailrunner/` | Site | game | canon | yes | Site:applied |  |
| `/Lessons/Games/voxelcraft.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Vortex.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Globe_Snake (1).html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Neon_Snake_Overdrive.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Neon_Siege.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Neon_Garden.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Orbital.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Grid_Chase.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Prism.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Grapple.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Marble.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Slipstream.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Slipstream_GP.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Wrecking_Crew.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Lumins.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Static.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/OneGuy.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/The_Last_Lighthouse_v1_1_The_Archipelago_Update_FINAL.html` | Lessons | game | own-splash | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/KidsVsStaff_Showdown (3).html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/WorldCup_ThreeLions_Final.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/WorldCup_v3_MatchDirector.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/WorldCup_v5_Showdown.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html` | Lessons | game | none | no | Lessons:declined-by-construction (SC1 §5) |  |
| `/voxel/` | Site | game | canon | no | Site:held-at-previous-region-with-reason |  |
| `/apexkick/` | Site | game | canon | no | Site:held-at-previous-region-with-reason |  |
| `/apexpool/` | Site | game | none | no | Site:declined-with-reason |  |
| `/apexgolf/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/apextennis/` | Site | game | none | no | Site:declined-with-reason |  |
| `/neonsync/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/biopunkhive/` | Site | game | legacy-region | no | Site:declined-with-reason |  |
| `/neonbreach/` | Site | game | none | no | Site:declined-with-reason |  |
| `/apexrally/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/medevac/` | Site | game | canon | yes | Site:applied |  |
| `/luminahaven/` | Site | game | own-splash | no | Site:declined-with-reason |  |
| `/auroralinks/` | Site | game | canon | yes | Site:applied |  |
| `/neonmeridian/` | Site | game | canon | yes | Site:applied |  |
| `/rallyvector3d/` | Site | game | canon | yes | Site:applied |  |
| `/hyperdraft/` | Site | game | canon | yes | Site:applied |  |
| `/apexcurl/` | Site | game | legacy-region | no | Site:declined-with-reason |  |
| `/apexvelodrome/` | Site | game | legacy-region | no | Site:declined-with-reason |  |
| `/micro-tinkerer/` | Site | game | none | no | Site:declined-with-reason |  |
| `/townlife/` | Site | game | canon | yes | Site:applied |  |
| `/touchline/` | Site | game | canon | yes | Site:applied |  |
| `/skybreak/` | Site | game | canon | yes | Site:applied |  |
| `/Lessons/5 Intervention 10/InterventionA_Battle_Arena (1).html` | Lessons | activity | canon | no | Lessons:applied |  |
| `/Lessons/2 Physics 10/current_rush.html` | Lessons | activity | canon | no | Lessons:applied |  |
| `/Lessons/5 Intervention 10/InterventionB_Escape_Room.html` | Lessons | activity | canon | no | Lessons:applied |  |
| `/Lessons/Summer Term Fun/Kids_vs_Staff_Studio_Game_Show_v8_Autopilot.html` | Lessons | activity | canon | no | Lessons:applied |  |
| `/Lessons/5 Intervention 10/L8a_Powerhouse_Arena_TeamQuiz.html` | Lessons | activity | canon | no | Lessons:applied |  |
| `/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html` | Lessons | activity | canon | no | Lessons:applied |  |

## §7.2 Runtime inventory (derived, `docs/play-q1/runtime-inventory.json`)

Built by `tools/play_runtime_inventory.py` from the existing ledgers only, never a new sweep: controls and modes from `domain-split/play/evidence.json`; the zoom declaration from `docs/HC4_ZOOM_DECLARATION_2026-09-07.json` (26-route population, the rest UNMEASURED); saves from `docs/HC3_SAVE_INVENTORY_RELEASED_SUMMARY_2026-09-07.json`; pause and timing have no per-route ledger and are written as UNMEASURED; the demonstrated defects are typed from the GS1 census (`reports/2026-09-02-games-census.md`) and the HC4/HC5 zoom records into `domain-split/play/runtime-findings.json` with the ledger line each came from.

Routes 69; controls source-inspected on 53; zoom declaration PASS 5, FAIL 1 (`/neonmeridian/`, HC5 follow-up), UNMEASURED 63; saves inventoried 69; routes with findings 18; open findings by class: control 8, presentation 4, performance 4.

**Pilot (one demonstrated defect, control class):** `/apexcurl/`, the V4 HQ launch button measured 38×44 at 390×844 in the GS1 Site census and again on 2026-09-16. Fix: `min-width:44px;min-height:44px` on `.v4-hq-launch`; nothing else in the game moves. After the fix the same probe finds no first-screen target under 44 px on the route. Bounded follow-up batch: the two 12 px footer links (`/apextennis/` "back to Games", `/voxel/` "← Made by Matt · Arcade"; voxel with batch 1b), then the HC5 zoom follow-up on `/neonmeridian/`. The Lessons-owned rows (World Cup trio HOLD, Static, Kids vs Staff) stay with Lessons. PLAYQ1 stays OPEN until every splash batch is verified and this table is complete; no estate-wide claim is made.

## Three derivations of the splash region

The same region is measured three ways, and the numbers disagree **by design**:

| tool | measures | trailing newline |
|---|---|---|
| `tools/play_splash_coverage.py` | SHA-256 of the region between the `MBM-MAKER-SPLASH` BEGIN and END markers | **included** |
| `tools/render_maker_splash.py` | byte length of the same region | **excluded** |
| `tools/cyberpulse/verify.mjs` (`SPLASH_BYTES`) | byte length of the same region | **excluded** |

Bytes as committed, no line-ending normalisation.

Compare a value only against its own tool's `--check`. Never compare a digest from one
tool with a digest from another, and never recompute one by hand: a value computed any
other way is not evidence about any of these records. Checking the coverage record:

    python3 tools/play_splash_coverage.py \
      --catalogue <play build>/games/data/domain-catalogue.json \
      --site . --lessons <lessons checkout> --check
