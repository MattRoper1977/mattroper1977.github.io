# PLAY-D1 checkpoint 2 — discovery review

Draft implementation, 14 September 2026. Browser acceptance and release remain pending.

- Visible All, Calm, Fast, Thinky and Together choices use 22 individually reviewed, payload-bound selections. Genre, input method, player arrangement and local-list filters intersect with them. Unmapped games remain under All.
- Surprise me samples actual eligible catalogue games, including individual editions, and opens details before Play. Empty results give a clear reset route.
- Cards expose a separate favourite control. Recently opened has per-game removal and clearing in both shelf and filtered-list views. Focus recovers after removal. Only the existing discovery keys are used; recent launches are not game progress.
- Details show reviewed controls, player arrangements, comfort features and saves, with honest unknowns. Together distinguishes shared-device, shared-screen teacher-led teams and manually paired same-network devices; it does not certify physical network pairing.
- 55 real game screens are copied unchanged from accepted browser run 34903180999, bound to exact image and game hashes. Six accepted gameplay previews retain priority. Eight generic splash captures were rejected and have neutral placeholders pending useful new captures. No generated artwork substitutes for a game screen.
- All 69 payloads match the accepted checkpoint-1 bytes. Counts stay 62 games, six classroom activities and one staff activity. The approved original logo is unchanged.

Local validation: isolated publication build; 69-payload comparison; game-save regression suite; JS/Python syntax; DOM IDs and nested-interaction check; paired fixture-pin checks; rejection of a deliberately stale discovery hash and a tampered screenshot hash. Browser checks are expanded for filtered Surprise, direct favourites, recent clearing/removal, focus and real-screen bindings. Route captures now wait four seconds to avoid short loading splashes where possible.

Next: monitor all current-head CI, then review new browser screenshots and recover useful captures for the eight missing screens. Do not mark checkpoint 2 accepted, merge or publish before those results and the remaining governed release pass.
