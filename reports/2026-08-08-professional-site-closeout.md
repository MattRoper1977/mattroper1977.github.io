# Made by Matt professional site upgrade — final closeout

**Sentinel:** `mbm-site-professional-design-upgrade-2026-08-07`
**Status:** CLOSED — merged, deployed and live-verified
**Repository:** `MattRoper1977/mattroper1977.github.io`

This document closes the publication items that were intentionally left pending in `reports/2026-08-07-professional-site-upgrade.md`.

## A. Estate delivered

The work began from measured `main` commit `44e2ca04cd39e26a91de0c61f925c690d12ceaf0`. The exact starting snapshot contained 328 files: 46 HTML, 4 CSS and 85 JavaScript/MJS/CJS files.

The implementation retained the existing source-of-truth architecture:

- homepage doors: `site.json` and `assets/mbm-doors.js`;
- Games catalogue: the Games manifest;
- Resources catalogue: local resource data plus the Lessons manifest;
- applications: the existing Matt-s-Apps- deployment.

## B. Problems resolved

- Crowded, inconsistent navigation across principal entry pages.
- No clear homepage route for teachers, pupils/learners, schools/organisations and partners.
- Header wrapping and weak mobile navigation behaviour.
- Inconsistent focus, touch, disclosure and active-location feedback.
- Theme controls competing with primary navigation.
- A misleading client-side password/account surface without real server-side authentication.
- Optional-element assumptions in existing JavaScript.

## C. Implementation

PR #92 changed 18 files and introduced the shared professional platform layer.

- `assets/mbm-platform.css`
- `assets/mbm-platform.js`
- `index.html`
- `games/index.html`
- `tools/index.html`
- `resources/index.html`
- `members/index.html`
- `privacy/index.html`
- `stats/index.html`
- `app.js`
- `theme.js`
- static verification, audit documentation and CI evidence files

The Made by Matt logo and brand assets were unchanged. Existing body wording was baseline-compared. No game runtime, lesson content or related-repository source was modified.

## D. Audience architecture

The homepage now exposes four real, evidence-backed routes:

- Teachers: Teacher Tools, Lesson Hub and Full catalogue.
- Pupils & learners: Games, Lessons and Full catalogue.
- Schools & organisations: Tools, Stats and Privacy.
- Partners: About, Say hello and Follow the work.

The shared header prioritises Games, Lessons, Apps, Tools and Resources. Stats, Members, About and Privacy sit under `More`; reading-background controls sit under `Display`.

No school, trust, council, partner, user, impact or compliance claim was invented.

## E. Interaction and accessibility

- Responsive mobile navigation with scroll lock.
- Escape dismissal, outside-pointer dismissal and focus return.
- Mutually exclusive `More` and `Display` disclosures.
- Active-location feedback.
- Keyboard scrolling for horizontal shelves.
- Progressive reveals that remain available without JavaScript and under reduced motion.
- Shared hover, focus and touch feedback.
- 46-pixel visible navigation targets and 44 × 44-pixel theme swatches.
- No measured horizontal overflow across the tested width matrix.

## F. Cross-repository work

Read-only discovery was performed against:

- `MattRoper1977/Lessons`
- `MattRoper1977/Games`
- `MattRoper1977/Matt-s-Apps-`
- `MattRoper1977/Games-`

No related repository was changed.

## G. Pre-publication evidence

The implementation audit covered:

- static preservation and positive controls;
- JavaScript syntax and CSS parsing;
- duplicate IDs and landmark structure;
- brand-asset preservation;
- fake-authentication and credential scans;
- browser checks at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS pixels;
- keyboard, touch, reduced-motion and runtime review;
- 14 retained final visual captures.

The permanent audit record is `docs/MBM_PROFESSIONAL_SITE_AUDIT_PASS.json`.

## H. Merge and deployment evidence

### Implementation

- PR: #92 — `Professional UX, interaction and audience architecture upgrade`
- Final head: `43086183556d4b7dbbd227c6e011259763a6289e`
- PR audit run: `31229651053` — SUCCESS, attempt 1
- Merged: 7 August 2026 at 23:23 UTC
- Merge commit: `4291cc7ba706fd66f3b76f6d4eeb87eac88d8f0b`

### Production proof

- PR: #93 — `Add permanent professional site live verification`
- Verification head: `e1393c3d73f7e3178cafb0298a540185566ced3b`
- Live run: `31229845015` — SUCCESS, attempt 1
- Live job: `93031630140`
- Verification merge commit: `a1ca8093c64e519f2e17dce643401a04d31b8b07`
- Retained artifact: `professional-site-live-31229845015`

The production run proved:

1. Seven live pages returned HTTP 200 and the professional platform marker.
2. Two shared platform assets were byte-identical to committed source.
3. Three mounted cross-repository JSON feeds returned HTTP 200 and valid JSON.
4. The deliberate impossible-marker positive control failed with one detected error.

## I. Outstanding infrastructure decisions

The design/UX release itself has no open publication item.

Real Teacher, Pupil, Organisation or Administrator accounts remain a separate product and security decision. They require a genuine identity provider or server-side authentication/session system, role and permission design, recovery behaviour, data-controller decisions and security review. No fake client-side security was introduced.

A later, separately scoped project may extend the shared shell into selected Lessons and Apps entry pages, but that is not required to close this main-site upgrade.
