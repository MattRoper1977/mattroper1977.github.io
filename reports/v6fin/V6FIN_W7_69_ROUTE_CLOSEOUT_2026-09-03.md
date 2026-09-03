# V6FIN W7 — 69-route closeout

**W7 result: PARTIAL.** The governed population is **62 + 7 = 69**, with **69 unique normalized routes**. Source, served and provenance controls pass; the seven fixed W7 additions remain `HOLD` because their live/pinned bytes contain no MadeByMatt splash or rolling 24-hour suppression contract and have no measured route exemption. R2 and R7 also block user zoom.

The machine-readable source of truth is [`V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json`](./V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json). All totals below are derived from that JSON object.

## Pins and continuity

| Repository | Final evidence pin | Tree |
| --- | --- | --- |
| Site | `ca5e911c2e482b4abad526578fa1b185afb9ba32` | `3534ab06ca79e276ae625b9fef6baf9126c0f0bd` |
| Games | `fb15334283ea40475094ba0546527535fff5f622` | `6b24e6135ab7cab5b5da46aa5908cf64ee9864c3` |
| Lessons | `165867e71eaa610e9de13a1c900276bd45d15648` | `014cbd42fb3d3a826673496a21e2780388b1cc47` |

P0–P5 were preserved and not restarted. Site PR #249 is already merged at the Site pin. Touchline 59/59 and the unchanged Town Life 184-second/statistical/positive-control evidence were not rerun for ceremony. No product payload changed during W7; Lessons stayed read-only; Site PR #216 and the unrelated SKY1 `uas/vendor/tesseract/tessdata/eng.traineddata.gz` modification were untouched.

## Population and verdicts

| Class | Rows | SHIP | HOLD | BLOCKED |
| --- | ---: | ---: | ---: | ---: |
| canonical-shelf | 62 | 62 | 0 | 0 |
| w7-additional | 7 | 0 | 7 | 0 |
| **Total** | **69** | **62** | **7** | **0** |

Every route returned HTTP 200, same-origin genuine HTML and exact source/served SHA equality. A live green is never borrowed across rows; every JSON row keys verifier evidence to its own normalized route and governing selector.

## R1–R7

| Rule | Route | Live/bytes | Exit and Tab | Splash / zoom | Verdict |
| --- | --- | --- | --- | --- | --- |
| R1 | `/Lessons/5 Intervention 10/InterventionA_Battle_Arena (1).html` | 200; `130924` B; SHA equal | `#mbmhud-back` 97×44; 13 Tab(s) | splash/key absent; zoom allowed | **HOLD** |
| R2 | `/Lessons/2 Physics 10/current_rush.html` | 200; `30322` B; SHA equal | `#mbmhud-back` 97×44; 1 Tab(s) | splash/key absent; zoom blocked | **HOLD** |
| R3 | `/Lessons/5 Intervention 10/InterventionB_Escape_Room.html` | 200; `77869` B; SHA equal | `#mbmhud-back` 97×44; 6 Tab(s) | splash/key absent; zoom allowed | **HOLD** |
| R4 | `/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html` | 200; `15825` B; SHA equal | `#mbmhud-back` 97×44; 5 Tab(s) | splash/key absent; zoom allowed | **HOLD** |
| R5 | `/Lessons/Summer Term Fun/Kids_vs_Staff_Studio_Game_Show_v8_Autopilot.html` | 200; `132141` B; SHA equal | `#mbmhud-back` 97×44; 23 Tab(s) | splash/key absent; zoom allowed | **HOLD** |
| R6 | `/Lessons/5 Intervention 10/L8a_Powerhouse_Arena_TeamQuiz.html` | 200; `24621` B; SHA equal | `#mbmhud-back` 97×44; 9 Tab(s) | splash/key absent; zoom allowed | **HOLD** |
| R7 | `/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html` | 200; `125684` B; SHA equal | `#mbmhud-back` 97×44; 7 Tab(s) | splash/key absent; zoom blocked | **HOLD** |

All seven also contain at least one `prefers-reduced-motion` declaration, have no horizontal overflow in the direct live Chrome probe, and expose a named first Tab target. R7's visible controls were checked from Chrome's accessibility snapshot: title-only colour controls and the placeholder-named pupil input are named even though a text-only heuristic would mislabel them.

## X1–X3 exclusions

| Exclusion | Proof |
| --- | --- |
| X1 `/Lessons/5 Intervention 10/Lesson_VIR_Intervention.html` | teacher/intervention companion to R7 pupil app. different paths, titles, byte counts and SHA-256; companion exclusion is semantic, not byte equality. Counted: **0**. |
| X2 `/Lessons/Games/Voxel_Frontier.html` | duplicate legacy Lessons publication of canonical /voxel/ identity. identity markers agree; payloads currently differ, as CX2 requires recording without reclassifying. Counted: **0**. |
| X3 `/Lessons/5_6 Local Choice/Trekkers_Trail_Runner (2).html` | legacy numbered Trekkers copy. same title/identity, different current payload bytes; canonical unnumbered Games path carries the canonical link. Counted: **0**. |

## Canonical and generated surfaces

Games `games.json` is 33722 bytes, gzip `-9 -n` 10546 bytes, SHA-256 `88c67c67e5493c9b2aa689c8ae736fb1f5694a3f48956dbdd3346381d8dd103e`, with 62 entries and 62 unique href selectors. No entry has an `id` field, so the exact canonical href is the stable governing selector.

The Site mirror is byte-identical. The live canonical and live Site mirror are byte-identical to pinned Games. The generated search index contains 72 game records: every canonical route exactly once and each of the original ten search-only candidates exactly once. The pupil catalogue declares 62; Site route derivation proves 35 Site + 27 Lessons; sitemap coverage is 35/35 Site-owned routes.

## Firing controls

| # | Mutation | Expected gate | Result |
| ---: | --- | --- | --- |
| 1 | remove one canonical entry | `population/coverage` | PASS (fired) |
| 2 | duplicate one normalized route | `uniqueness` | PASS (fired) |
| 3 | count excluded X1 as an eighth addition | `selector/population` | PASS (fired) |
| 4 | replace a served body with known 404 fixture | `genuine-html/non-vacuity` | PASS (fired) |
| 5 | alter a source SHA and raw byte count | `checksum/provenance` | PASS (fired) |
| 6 | mark a route green with another route's verifier result | `per-route-evidence` | PASS (fired) |
| 7 | change a repository pin after evidence generation | `stale-pin/reproducibility` | PASS (fired) |

All fixtures were temporary copies outside the repositories and were withdrawn. The unmodified candidate passes the complete validator. Re-running the report writer is deterministic; a second run must produce zero diff before commit.

## Current remainder

The accurate census is safe to land, but W7 cannot be terminal-success while R1–R7 lack the MadeByMatt splash and rolling 24-hour suppression state. This evidence-only order does not authorise a Lessons repair. The next safe action is a separately authorised, route-owned Lessons change for R1–R7 that adds the existing splash/suppression contract without weakening their current input, exit, reduced-motion or accessibility behaviour; R2 and R7 also need zoom-enabled viewport declarations.

`V6FIN_PARTIAL`
