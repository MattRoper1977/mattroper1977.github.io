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

## CI repair after head 1b4634c

The three publication failures had one cause: screenshot bindings for the review build were incorrectly required on other approved source revisions. Optional screens and mood/details metadata now apply only to their exact approved revision and are otherwise omitted with an explicit build-report record. Unreviewed bindings, changed image bytes and unreviewed game payloads remain errors. Independent publisher source pins are retained.

Both the review Lessons pin ae2d534 and publication test pin 2c33266 build successfully with all 69 payloads source-validated. Six new discovery controls pass on each build: mismatched approved screen/selection omitted, invented screen/selection bindings refused, altered image hash refused and restored evidence accepted. They now run alongside the existing source-revision controls.

The Play browser report on 1b4634c passed 32/36 checks. Four identical failures expected the retired generic save claim in the details sheet; the assertion now requires the honest unverified-save wording. All mood/Surprise/card-list checks passed at the four widths. The paired checker fixture pin was updated.

All eight previous generic-splash gaps now have inspected, unchanged four-second game-screen captures from run34907070023. The review build has 63 exact-bound stills plus six accepted gameplay previews, covering all 69 entries. Other approved revisions can omit unmatched captures: the 2c33266 publication test omits 21 stills and three selections. Capture coverage must therefore be verified against the actual governed release source before publication; do not describe review-pin imagery as universal coverage.

Fresh current-head CI and final visual acceptance remain required. No game payload, original logo, save key, AS1 runtime control or publisher pin was changed.
