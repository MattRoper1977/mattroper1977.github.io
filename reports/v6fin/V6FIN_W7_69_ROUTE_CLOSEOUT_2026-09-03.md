# V6FIN W7 — 69-route final closeout

**W7 result: COMPLETE — 69 SHIP, zero HOLD, zero BLOCKED.** The governed population remains **62 + 7 = 69**, with **69 unique normalized routes**. All 69 public URLs returned same-origin genuine HTML and were byte-identical to their final evidence-pin sources.

The machine-readable source of truth is [`V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json`](./V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json).

## Pins and continuity

| Repository | Final evidence pin | Tree |
| --- | --- | --- |
| Site | `4b37e60061c10d93e367ff56141443701282eafa` | `ce229f433418f522d0db189ab1c41813873dff42` |
| Games | `fb15334283ea40475094ba0546527535fff5f622` | `6b24e6135ab7cab5b5da46aa5908cf64ee9864c3` |
| Lessons | `7548699bb6a79f3fd63edfd9179a428fc0e821cf` | `63281a1e3a322791e0b5e0bb6192a4416bc301ba` |

P0–P5 were preserved and not restarted. Lessons PR #275 landed the seven route-owned repairs; PR #276 corrected only the post-merge base selection in that verifier. Site PR #216 and the unrelated SKY1 `uas/vendor/tesseract/tessdata/eng.traineddata.gz` item remained untouched.

Site evidence is pinned to the pre-report head above. This closeout changes only the two report files after that measurement.

## Population and verdicts

| Class | Rows | SHIP | HOLD | BLOCKED |
| --- | ---: | ---: | ---: | ---: |
| canonical-shelf | 62 | 62 | 0 | 0 |
| w7-additional | 7 | 7 | 0 | 0 |
| **Total** | **69** | **69** | **0** | **0** |

## R1–R7 final proof

| Rule | Route | Live bytes / SHA-256 | Splash and suppression | Zoom | Exit | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | `/Lessons/5 Intervention 10/InterventionA_Battle_Arena (1).html` | 142706 B / `02e8037e6cb2…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R2 | `/Lessons/2 Physics 10/current_rush.html` | 42004 B / `944ee81e7b98…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R3 | `/Lessons/5 Intervention 10/InterventionB_Escape_Room.html` | 89651 B / `ce4b21d6e5e2…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R4 | `/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html` | 27607 B / `2635dc7c83ed…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R5 | `/Lessons/Summer Term Fun/Kids_vs_Staff_Studio_Game_Show_v8_Autopilot.html` | 143923 B / `8caa4b3513b7…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R6 | `/Lessons/5 Intervention 10/L8a_Powerhouse_Arena_TeamQuiz.html` | 36403 B / `71e95ad58a4a…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |
| R7 | `/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html` | 137455 B / `27c6ccec7de7…` | OK; rolling 24-hour key observed | allowed | `#mbmhud-back` after 1 Tab | **SHIP** |

The exact Lessons head passed the canonical generated-region check, 14 inline-script syntax checks, 73/73 browser controls, and the complete seven-route matrix at 390×844 and 1280×800. Every route painted for at least the required duration, became inert and detached, preserved first-paint geometry, focused its primary control, suppressed on the rolling key, and reached and activated the platform exit.

R2 also restores zoom and removes its external font requests in favour of a local system fallback. R7 restores zoom and defers its optional classroom endpoint discovery by two seconds so the standalone start/exit path is interactive before that graceful probe.

## Canonical and generated surfaces

Games `games.json` remains 33,722 bytes, deterministic gzip `-9 -n` 10,546 bytes, SHA-256 `88c67c67e5493c9b2aa689c8ae736fb1f5694a3f48956dbdd3346381d8dd103e`, with 62 entries and 62 unique href selectors. The pinned Site mirror, live canonical file and live Site mirror are byte-identical. Generated search, audience, route-derivation and sitemap contracts remain green.

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

All fixtures were in-memory copies. The unmodified candidate passed the complete validator, and the report writer produced zero diff on its second run.

## CI, deployment and artefacts

- Lessons repair PR: #275; merge `ed1ac3e7dd5a68cefb05a8e1878937fe5f200e56`.
- Lessons verifier follow-up PR: #276; final merge `7548699bb6a79f3fd63edfd9179a428fc0e821cf`.
- Exact final-head W7 workflow: run 33772273003; static and browser jobs successful.
- Final-head FieldOps run: 33772273264; successful.
- Final-head Pages deployment run: 33772271576; successful.
- Browser routes artifact SHA-256: `82c101e8d757bb2e43d719ac94c396f98d36d7d183a7893ec92c11815125127a`.
- Static report artifact SHA-256: `01d09ceff1f376c21644ed61685790cc43bb09dceb6ccb0ceb61260d15c267aa`.
- This JSON: 415,082 bytes; SHA-256 `c4f46c185168ad05e6e463c9e0943cee35f1fee3b6f8a10592ad89a10a1da59f`.

`V6FIN_COMPLETE`

`V6FIN_CX2_COMPLETE`
