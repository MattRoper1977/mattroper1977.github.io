# RallyVector scheduling repair

Base and rollback: `bc9b73c882807742baf05795a1a10a4a524467d1`.
Matt approved taking over this repair on 12 September 2026, recorded in Site
PR #355. Fresh open-PR inventory contains only held #291, whose four files do
not overlap this change. Lessons #456 and LP1 remain untouched.

The AS1 render guard skipped drawing a clean menu but the outer frame function
still requested every animation frame. The Games pin-release gate counts
invoked callbacks, so this blocked promotion even though the menu drew nothing.
One owned pending request now sleeps when the menu or held stage is clean.
Input, settings, resize, world rebuild, delayed previews and visibility return
invalidate and wake it. Running stages and cinematics retain the existing loop.
Fixed-step physics, batteries' render limit, game data, storage keys and save
formats are unchanged. The opted-in Rally generator reproduces the inline hooks.

Exact runtime source commit: `15f522a714479a6fec458cd95cb8a73d36df07d6`.
Source SHA-256: `5e33397cdf688029a5f4912d88e8460cf71317b4efe112b79592357739165cd7`.
Published-transform SHA-256: `1c6db5657c8ce74886f19da45ff6839eed7a83c3b501d5e887ff8de054cc86a8`.
The source-revision registry adds these exact bytes and retains every earlier
revision and the existing published baseline. Wrong-owner and missing-revision
controls still reject. No Education admission digest or publication pin changes.

## Local evidence

- Current-main control: 36 callbacks, zero draws in 600 ms; the new idle
  assertion rejects it. Candidate menu and paused states: zero callbacks,
  draws and physics steps. A planted continuous loop is rejected and removing
  it restores green.
- All 16 scheduling assertions pass, including real Start, Pause, Resume,
  More/Done, a delayed preview, 50 invalidations sharing one repaint and
  synthetic visibility events. The visibility test does not claim an OS
  background measurement.
- The unchanged Games performance gate passes the focused Rally comparison
  against its original `85e3e020` source: idle callbacks 29 to 0, post-input
  callbacks 18 to 1, errors zero on both. This is one-route local evidence;
  the owner-managed composed 69-route release comparison remains required.
- The existing AS1 browser harness reports 127 PASS, one UNMEASURED chat-client
  transport, zero failures and zero browser errors. Battery physics, save
  round trips, six stage APIs, actual Alpine completion and ghost playback pass.
- All four regression/rendered-placeholder runs pass, including their planted
  faults. Browser evidence uses locally installed Chromium 139 with software
  WebGL; CI retains its existing Playwright installation and launch settings.
- The unchanged pin-dependency check passes with 25 pinned artefacts. Canonical
  regeneration changes only the diagnostic unmatched-literal count, 43 to 46;
  its enforced artefact map is identical. The admitted public snapshot stays
  byte-identical, avoiding an unrelated admission change.

## Legacy stage checker

The old checker called a legacy splash-close hook and clicked behind the newer
maker introduction's input guard. Its Alpine control remained in menu and
failed four driving/ghost assertions. Dismissing the real introduction by
keyboard, then clicking the actual Start button, passes those same assertions.
The checker now follows that setup and proves a deliberately blocked click is
rejected before restoring it. Its synthetic frame clock honours cancellation
and propagates callback errors. All stage identities, progress/speed floors,
pace-note requirements and ghost storage assertions are retained.

This is a repair to the verification setup needed for this runtime release.
No AS1-H exception is extended, no failure is waived, and no workflow is changed.
Current and original-baseline six-stage results and exact-head CI must settle
before landing. This document is a review record, not a deployment claim or
`SW2_T_OK`.
