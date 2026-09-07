# HC4 §3 — zoom: declaration fix and pinch measurement (2026-09-07)

**Claim wording for every passing route: "zoom not blocked by declaration".** Nothing
here says "pinch proved". Headless measurements are informational.

## §3.3 declaration gate (static viewport meta + computed touch-action chain)

Gate: `tools/hc4/zoom_declaration.cjs` (three-run control real → planted → restored on
every run; exits non-zero if the control misbehaves). Population: 26 routes in
`tools/hc4/zoom_population.json`, derived from the Apps #37–#40, Site #278 and
Lessons #350 file lists (19 education + 7 Play).

| | pass | fail | control |
|---|---|---|---|
| before (mains Site 0113130e / Apps 162e65b3 / Lessons e5129ad8) | 13/26 | 13 | real PASS → planted FAIL → restored PASS |
| after (branches `claude/hc4-zoom-declaration`) | 25/26 | 1 | real PASS → planted FAIL → restored PASS |

Static: 26/26 already passed (no `user-scalable=no`, no `maximum-scale<5`). Every failure
was a computed `touch-action:none` on the primary canvas/stage or its html/body chain.
The fix is one CSS token per declaration, `none → pinch-zoom`, on twelve routes:
Site apexrally, fracture, medevac (MedevacFrontier_v1), neonbreach, neonsync; Apps
Art_Studio, Design_Studio, Photo_Studio, Mindmap_Studio, Seating_Studio, Whiteboard;
Lessons Orbital. No handler, markup or other byte changes.

**Remaining FAIL (1): `/neonmeridian/`** — owned by Site #216 (R2), untouched.

## §3.2 pinch (headless, informational)

Instrument: `tools/hc4/pinch_instrument.cjs`, variant `shell-dispatch-force`
(two-finger `Input.dispatchTouchEvent` sequence under mobile emulation). Its positive
control zooms (1 → 5), its negative control (`user-scalable=no` + `touch-action:none`)
stays at 1, and a discriminating control showed it honours `touch-action`,
`user-scalable` and non-passive touch `preventDefault` individually. The
`synthesizePinchGesture` default variant also passed its own paired controls but zoomed
through `touch-action:none` alone in the discriminating control — it behaves like a
trackpad pinch, so it is recorded in the JSON and used for no claim.

| | zoomed | blocked |
|---|---|---|
| before | 19/26 | 7: /Matt-s-Apps-/Art_Studio.html, /Matt-s-Apps-/Design_Studio.html, /Matt-s-Apps-/Mindmap_Studio.html, /Matt-s-Apps-/Photo_Studio.html, /Matt-s-Apps-/Seating_Studio.html, /Matt-s-Apps-/Whiteboard.html, /neonbreach/ |
| after | 26/26 | 0 |

These are headless numbers on locally served copies of the trees, not a phone. The human
phone check is `docs/HC4_PINCH_PHONECHECK.md`.

## What this does not say

- A route that passes the gate is "not blocked by declaration"; a real-device pinch is
  still a human check.
- neonmeridian is not fixed here because its file is owned by an open PR.
- Site #291's instrument remains HELD; its route verdicts stay MEASUREMENT INVALID. The
  instrument above is the replacement candidate and lives beside this record.
