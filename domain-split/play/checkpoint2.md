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

## Release-source alignment after a02288ac

Run 34908147264 passed all 36 browser checks across 69 initial game surfaces, with zero reported runtime errors; the save-transfer fixture also passed. All 16 home, browse, 200% text and details screenshots were inspected at 320, 390, 768 and 1280 pixels and accepted for that review source. UI artifact 10373632011 SHA256: 7615e8f2fe18454803eea5fcfa7b27c329e5ad684be1b23097c8a987104a74a4.

Games/play-publication.json currently selects Lessons 9ec701681ff6efcc5bb99f9120555c7c76585e45. The review workflow now uses that same source. All 69 output payloads validate against the approved source registry, but 21 still images need new captures. The three affected selections (Neon Garden, Prism and Lumins) were re-inspected against their current source and bound to its approved payload hash; all 22 reviewed selections now apply. Lumins already has a matching accepted preview.

The browser binding check verifies exact metadata and image bytes where matched, verifies and reports every omission where another approved revision is selected, and explicitly reports whether discovery coverage is complete. This capture run is not release acceptance: require all 63 matching stills plus six accepted previews and a fresh visual review before checkpoint 2 closes. Local release-source build, six discovery rejection/restoration controls, the binding assertion with local file responses, syntax and paired fixture-pin checks pass. No game payload or publisher configuration is changed.

## Current-source screen review after 1b254882

Run 34909744930 passed 36/36 checks across 69 initial game surfaces with zero runtime errors. Its UI artifact 10373843167 was downloaded and verified against SHA256 3822bb0005071d0371b202720ee8b50718dde653c5c466dc1c3c56b86863d529. All 21 replacement candidates were inspected. Twenty identifiable opening screens were accepted and copied unchanged with individual image/payload hashes and capture provenance. These are opening screens, not completed gameplay evidence.

The Lighthouse image was rejected because first-visit focus scrolled its instructions past the identifying title. The browser capture now uses the ordinary Take the watch control to dismiss the primer and captures the title at 1280x1000. This affects only the review driver; the game source is unchanged. The paired checker fixture pin was updated.

The actual-publisher-source local build now has 62 matching stills, six accepted previews, all 22 selections and exactly one explicitly reported missing image (Lighthouse). All 69 payloads validate unchanged. Syntax, diff and paired-pin checks pass. Require the fresh Lighthouse capture, its visual review and binding, then final current-head browser/visual acceptance before checkpoint 2 closes. The source pin documentation correction also passed in CI at 1b254882.
