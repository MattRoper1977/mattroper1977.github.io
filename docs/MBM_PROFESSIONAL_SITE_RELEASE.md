# Made by Matt professional site release record

Sentinel: `mbm-site-professional-design-upgrade-2026-08-07`

## Release status

**CLOSED — merged, deployed and live-verified.**

The professional presentation upgrade was merged through PR #92 on **7 August 2026 at 23:23 UTC**.

- Implementation merge commit: `4291cc7ba706fd66f3b76f6d4eeb87eac88d8f0b`
- Final implementation head: `43086183556d4b7dbbd227c6e011259763a6289e`
- PR audit run: `31229651053` — **SUCCESS**, first attempt
- Permanent live-verification PR: #93
- Live-verification merge commit: `a1ca8093c64e519f2e17dce643401a04d31b8b07`
- Production proof run: `31229845015` — **SUCCESS**, first attempt
- Retained proof artifact: `professional-site-live-31229845015`

## What was proved

The production verifier checked the served website after deployment rather than treating a Git commit as proof.

- Seven entry pages returned HTTP 200 and contained the professional platform marker: `/`, `/games/`, `/tools/`, `/resources/`, `/members/`, `/privacy/` and `/stats/`.
- `assets/mbm-platform.css` and `assets/mbm-platform.js` were byte-identical to the committed files.
- `/Games/games.json`, `/Lessons/resources.json` and `/Matt-s-Apps-/tools.json` returned HTTP 200 and valid JSON.
- A deliberate impossible-marker fixture failed with one detected error, proving the live verifier is non-vacuous.

## Preservation boundary

The release did not rename established public routes, rewrite Matt's authored body wording, redraw the Made by Matt logo, introduce credentials or fake authentication, or alter game/lesson runtime code. Related repositories were read for discovery and were not changed.

The presentation upgrade remains concentrated in `assets/mbm-platform.css`, `assets/mbm-platform.js` and the explicit page integrations recorded in PR #92. Existing data manifests, Lessons, Games and application source remain their own sources of truth.

## Permanent regression protection

PR #93 added:

- `.github/workflows/professional-site-live-verify.yml`
- `tools/verify_professional_site_live.py`

The live proof runs on relevant changes and can also be dispatched manually. The complete closeout is recorded in `reports/2026-08-08-professional-site-closeout.md`.
