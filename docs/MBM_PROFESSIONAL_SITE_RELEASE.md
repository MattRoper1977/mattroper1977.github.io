# Made by Matt professional site release record

Sentinel: `mbm-site-professional-design-upgrade-2026-08-07`

The professional presentation upgrade is delivered through a focused pull request. It does not rename established public routes, replace existing authored wording, redraw brand artwork, create authentication or alter game/lesson runtime code.

## Release sequence

1. Run static preservation, syntax and positive-control checks.
2. Run the Playwright responsive/accessibility matrix and retain its report and representative screenshots.
3. Review the homepage, Games, Tools, Resources, Stats, Privacy and Members entry points in the pull request.
4. Merge only after required checks pass.
5. Verify the served GitHub Pages deployment and first-party assets after publication.

## Rollback boundary

The presentation upgrade is concentrated in the shared `assets/mbm-platform.css` and `assets/mbm-platform.js` files plus explicit page integrations. Existing data manifests, lessons, games and application source remain their own sources of truth.

## Release recovery

The completed `ready-v4` payload is retriggered through the permanent release gate after the obsolete `ready-v3` bootstrap path was found incomplete. The release gate must validate the recorded archive hash, run both static and browser checks, remove every staging fragment and then commit the implementation to this branch.
