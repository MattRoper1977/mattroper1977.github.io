# Made by Matt professional site upgrade

Sentinel: `mbm-site-professional-design-upgrade-2026-08-07`

This document records the shared presentation layer introduced for the Made by Matt platform. It is implementation and maintenance documentation, not replacement website copy.

## Scope

The upgrade applies shared design, navigation and accessibility behaviour to the homepage and the Games, Tools, Resources, Stats, Privacy and Members entry points. It keeps existing authored page wording in its original order and retains the existing brand artwork byte-for-byte.

## Shared assets

- `assets/mbm-platform.css` contains the evolved design tokens, responsive navigation, audience-pathway, focus, reduced-motion and page-chrome rules.
- `assets/mbm-platform.js` progressively enhances navigation, current-location feedback, breadcrumbs, reading progress, reveals and back-to-top behaviour. Core page content remains available without JavaScript.

## Verification

Run the static preservation and defect gate:

```bash
python tools/verify_professional_site.py --self-test
python tools/verify_professional_site.py
```

Run the browser matrix after installing Playwright Chromium:

```bash
npm install --no-save playwright@1.52.0
npx playwright install --with-deps chromium
node tools/verify_professional_site.mjs
```

The browser matrix covers representative widths from 320px to 1440px, keyboard/mobile navigation, touch-target sizing, horizontal overflow, reduced motion, first-party assets and console errors.

## Maintenance rules

- Do not redraw or replace the Made by Matt logo assets.
- Keep existing authored wording unchanged unless Matt separately authorises content editing.
- Keep authentication claims accurate: the current Members area is browser-local and is not a secure server-side login.
- Prefer the shared platform assets over adding page-specific duplicate navigation or design-system rules.
