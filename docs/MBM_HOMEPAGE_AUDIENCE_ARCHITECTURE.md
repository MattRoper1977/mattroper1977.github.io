# Made by Matt homepage and audience-homepage architecture

**Sentinel:** `mbm-homepage-audience-routing-2026-08-09`
**Baseline authority:** `6ae47285e92c90907a8299fe6c22428bbd7995de`

This document records the maintainable public architecture introduced by the homepage and audience-homepage upgrade. It does not replace the automated verifiers; it explains the contract those verifiers protect.

## Canonical public map

| Route | Purpose |
| --- | --- |
| `/` | Homepage chooser. It never forces a saved choice. |
| `/main/` | Full general Made by Matt homepage preserved from the baseline root. |
| `/start/` | Legacy compatibility route that resolves to `/` and is not canonical. |
| `/for/pupils/` | Pupils & learners homepage. |
| `/for/teachers/` | Teachers & education staff homepage. |
| `/for/parents-carers/` | Parents & carers homepage. |
| `/for/schools-semh/` | Schools & specialist settings homepage. |
| `/for/trusts/` | Academy trusts homepage. |
| `/for/councils-organisations/` | Local authorities & education services homepage. |
| `/for/partners/` | Education organisations & service providers homepage. |

The official brand mark normally links to `/main/`. Every audience homepage also exposes explicit **Main homepage** and **Choose homepage** links, so the logo is never the only route.

## Shared implementation

Audience content is maintained in `data/audience-homepages.json` and rendered by `tools/render_audience_homepages.py`. The generated pages remain ordinary HTML with usable anchor links when JavaScript is unavailable. Shared presentation and progressive enhancement live in:

- `assets/mbm-audience.css`
- `assets/mbm-audience.js`
- `assets/mbm-platform.css`
- `assets/mbm-platform.js`

The local preference key remains `mbm_audience_view`. It is a browser-only navigation convenience. It is not authentication, authorisation, an account type, analytics identity, mailing-list consent or remote profiling. The preference script makes no network request and never redirects a visitor away from `/` automatically.

## Full-home preservation

`main/index.html` was derived directly from the baseline `index.html`. The professional-site preservation verifier compares the full-home surface at `/main/` against that baseline while allowing only the explicitly authorised architecture, metadata, navigation and account/mailing truth changes. `assets/mbm-doors.js` resolves catalogue paths from the domain root so the same `site.json` data remains valid below `/main/` without changing canonical data conventions.

## First-party visual provenance

The audience homepages use only owner-controlled assets already in the production estate:

- game card artwork in `assets/cards/`, including Apex Kick, Voxel Frontier and Fracture;
- Lesson Hub artwork at `images/lesson-hub-card.webp`;
- Made by Matt ASDAN and studio preview posters in `assets/video/`;
- the existing platform cover at `assets/og-cover.png`;
- the official hero mark at `assets/brand/hero_mark.svg`.

No stock classroom photography, invented partner/customer logos, testimonials or popularity claims are introduced. Feature links and labels are explicit editorial selections backed by real live destinations.

## Regression gates

`tools/verify_games_audience_faces.py` protects the static architecture and includes mutation-based positive controls. `tools/verify_games_audience_faces.mjs` covers responsive browser flows, keyboard menus, themes, local preference behaviour, imagery and representative destinations. The GitHub Actions workflow `verify-games-audience-faces.yml` runs the static checks, assembles the related read-only estates for browser proof and performs live production readback after merge.
