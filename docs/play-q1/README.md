# PLAY-Q1 splash checkpoint — coverage table and batch plan (CX2 §7.1)

Derived by `tools/play_splash_coverage.py` from the built Play domain catalogue; never hand-counted. Re-run and recommit after every batch.

Routes: **68** (canon 24, legacy-region 6, none 24, own-splash 14; owners Site 35, Lessons 33). Generated region now on 14 routes (sha256 `5500acead5b7…`); 4 Site routes held at the previous accepted region (see batch 1b).

## Design (decided under "decide and continue", recorded for Matt)

- **D6 — one region, host-conditional visual.** The single generated `MBM-MAKER-SPLASH` region stays byte-identical on every route. On the Play host (`madebymatt-play.uk`, or `?brand=play` for local proof) it paints the Play lockup; anywhere else (the education domain, where the seven Lessons routes are also served) it paints the Made by Matt mark, so Education branding stays separate.
- **D7 — timing unchanged.** Tap/key skip, the 1.9 s brand animation, the 2.1 s cap, reduced motion at .35 s, the 24-hour suppression, focus hand-off and legacy neutralisation are the accepted canon and its verifier's contract; PLAY-Q1 changes the visual and adds a loading status that shows only while `document.readyState` is not `complete` (indeterminate; no percentages). Whether the 1.9 s brand moment counts as a "forced delay" under §7.1 is Matt's call.
- **D8 — palette from the Play tokens.** Charcoal `#0b1020`/`#081422`, mint `#84e0c0` on the wordmark's *Play*, cyan `#5fd3ff` supporting line **YOUR NEXT GAME STARTS HERE.**, restrained violet `#7a6cf0` loading bar.
- **D9 — the mark travels inside the region.** CyberPulse forbids external images (`img-src data: blob:`) and the Lessons games are single files by rule, so the lockup carries a 240×158 resize of the accepted mark as a data URI (`tools/prepare_play_splash_mark.py`, record `domain-split/play/splash-mark.json`, source sha `bfef5b1e…792a` bound). Resize only: no crop, no recolour, no redraw. If it fails to decode the lockup drops the picture and keeps the wordmark.
- **D10 — House Olympiad's own ceremony stood above the canon.** `#v6Fly` (the game's V6 intro dialog) was stacked at `z-index:2147482100`, above the generated region (`2147482000`) and below the inline exit (`2147483000`), so on that route the maker splash, Play lockup included, painted underneath the game's own intro and a tap never reached it. This existed since the canon was applied in August; the Play proof's new top-hit sample found it. The ceremony now sits at `2147481900`, below the splash; the estate ladder (splash below exit; games' own sheets between) is unchanged. The Play proof asserts on every stamped route that, while the overlay is interactive, the element under the viewport centre belongs to it. The generator announces no dismissal event a game could wait for, so a game-owned intro still runs under the splash for its 2.1 s; batch 4 (game-owned title splashes) is where that is looked at per route.
- **Measured, not assumed: on the heavier games the mark appears late.** The single-file games run large inline scripts between parse and `load`; on trailrunner, auroralinks and olympics the main thread is busy for 1.5–2.5 s after the region attaches, so the inline JPEG decodes only when it frees (trailrunner at 1280: attached 52 ms, decoded 1971 ms, load 2346 ms, cap dismissal 2350 ms on the proof machine). The lockup's charcoal field, wordmark and line are painted immediately (styled text); only the mark waits. The loading status shows throughout on those routes and is hidden once the document is complete. The proof records these timelines per route and viewport (`play-splash-batch1.json`); the verifier reads facts from an in-page observer at attach time because a harness read can itself land after the cap on those routes.

## Batches

1. **Canon routes, Site-declared (18)** — this pull request stamps 14: generator change, re-stamp, verifier controls, Play-visual proof (`tools/verify_play_splash.mjs`), and the Play evidence chain rebound to the new bytes (`evidence.json`, `preservation.json`, the Rally source revision, `discovery-review.json`, 14 screens recaptured with `tools/capture_play_screens.cjs`). **1b — the four clip-bearing routes** (`/apexkick/`, `/voxel/`, `/offbrand/`, `/novasiege/`) stay at the previous accepted region, declared as `held-at-previous-region-with-reason` in `data/hud-coverage.json`: each carries an accepted gameplay clip bound to its published bytes, and the builder refuses a clip bound to different bytes, so they follow once the Play capture job has recaptured the clips against the new bytes and Matt has accepted them.
2. **Canon routes, Lessons-declared (6 on the shelf + R_Gate_Calibration_Game)** — a Lessons pull request moving its generator pin to the merged Site commit and re-stamping.
3. **Legacy `MBM-SPLASH` region (6)** — declare in the ledger; the generator strips the legacy region and stamps the canon.
4. **Game-owned title splash (14)** — declare; the canon plays before the game's own title screen; per-route check for duplicate overlay, blocked start, save/reload.
5. **No splash (24)** — declare; same non-blocking entry; the twenty Lessons games are Lessons-owned.

Every batch: pilot one route per delivery mechanism first, then the batch; publication through the Games pin release (held by BLOCKER B3 at the time of writing).

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
| `/Lessons/Games/Axiom_Shift.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/Charcoal.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Hold_the_Mark.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Glitch_Clash.html` | Lessons | game | none | no | undeclared |  |
| `/trailrunner/` | Site | game | canon | yes | Site:applied |  |
| `/Lessons/Games/voxelcraft.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/Vortex.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/Globe_Snake (1).html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Neon_Snake_Overdrive.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Neon_Siege.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Neon_Garden.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Orbital.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Grid_Chase.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Prism.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Grapple.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/Marble.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/Slipstream.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Slipstream_GP.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Wrecking_Crew.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Lumins.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Static.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/OneGuy.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/The_Last_Lighthouse_v1_1_The_Archipelago_Update_FINAL.html` | Lessons | game | own-splash | no | undeclared |  |
| `/Lessons/Games/KidsVsStaff_Showdown (3).html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/WorldCup_ThreeLions_Final.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/WorldCup_v3_MatchDirector.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/WorldCup_v5_Showdown.html` | Lessons | game | none | no | undeclared |  |
| `/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html` | Lessons | game | none | no | undeclared |  |
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
