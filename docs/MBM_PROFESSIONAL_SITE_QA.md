# Made by Matt professional site QA

Sentinel: `mbm-site-professional-design-upgrade-2026-08-07`

## Required preservation checks

- Existing authored visible text remains in its original order on the seven audited entry pages.
- `assets/brand/micro_mark.svg`, `assets/brand/hero_mark.svg` and the existing social preview artwork retain their recorded hashes.
- No credential, password or client-side security claim is introduced.

## Static checks

```bash
python tools/verify_professional_site.py --self-test
python tools/verify_professional_site.py
node --check app.js
node --check assets/mbm-platform.js
node --check tools/verify_professional_site.mjs
```

The self-test includes positive controls: intentionally changed copy, a changed logo, a missing shared asset and an unsafe credential pattern must each make the validator fail.

## Browser matrix

The Playwright audit covers the homepage plus Games, Tools, Resources, Stats, Privacy and Members at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS-pixel widths. It checks navigation, keyboard operation, focus/current-location feedback, touch targets, horizontal overflow, reduced motion, first-party asset failures, console errors and representative screenshots.

## Live proof

After merge and GitHub Pages deployment, rerun the audit with `MBM_BASE_URL=https://madebymatt.uk` and compare the served first-party files with the committed versions. A successful commit alone is not treated as deployment proof.
