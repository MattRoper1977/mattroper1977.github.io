# TFR2 P1 — phone proof BEFORE any edit

Input: Titan_Forge_AAA_Release_V4.html (sha256 fc9699b5…418f8f), untouched.
Harness: `_tfr2/tools/phone_proof.mjs` — headless Chromium (Playwright 1.56), coarse pointer
via CDP `Emulation.setEmulatedMedia`, touch + mobile emulation on the three phone sizes, all
off-page network aborted and counted. Captures in `_tfr2/shots/before/`.

| size | pointer:coarse | lift-button fully inside viewport at scroll 0 | console height | lift box (y) | phase-track visible | head not clipped | popup box overlapping lift button | failed requests |
|---|---|---|---|---|---|---|---|---|
| 360x740 | true | **NO** | 462 px | 936–1012 | YES | YES | YES (.mbm-v4-impact, .mbm-forge-flash — full-arena inset:0 overlays) | 0 |
| 390x844 | true | **NO** | 462 px | 936–1012 | YES | YES | YES (same two) | 0 |
| 412x915 | true | **NO** | 462 px | 936–1012 | YES | YES | YES (same two) | 0 |
| 1366x768 | false | YES | 518 px | 645–703 | YES | YES | YES (.mbm-v4-impact, .mbm-v2-burst, .mbm-forge-flash) | 0 |

Expected on the input: lift-button NO at ~412x915 (Matt's screenshot 2026-09-01 21:46). The
harness prints NO on all three phone sizes, so the harness agrees with the screenshot.

Why NO: on phones the arena carries `padding-top:470px` for the stage, the console is 462 px
tall, and the lift button is the last child of the console, so it lands at y=936 — a full
viewport below the fold on a 915 px screen. The dock (66 px) is fixed at the bottom.

"Popup overlapping" is geometric: the two flagged boxes are `inset:0` arena overlays
(pointer-events:none, aria-hidden). Every discrete popup (.mbm-reward-pop, .mbm-cycle-result,
.mbm-v2-reward, .mbm-v3-toast) sits clear of the lift button on the input.

Box JSON per size: `_tfr2/shots/before/before.json`.
