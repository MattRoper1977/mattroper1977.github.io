# Made by Matt Games + audience faces release

Sentinel: `mbm-games-audience-faces-2026-08-08`

> **Current status:** this remains the historical record for the Games hub upgrade. The homepage-routing and audience-homepage architecture was superseded by `mbm-homepage-audience-routing-2026-08-09`. See `docs/MBM_HOMEPAGE_AUDIENCE_ARCHITECTURE.md` for the current canonical routes, labels and regression contract.

## Purpose

This release closes the remaining visual gap between `/games/` and the professional Made by Matt platform, then adds a new audience-entry layer without rewriting existing authored Games copy or turning one audience choice into a permission system.

The public platform stays one estate. Audience faces simply put different existing destinations first.

## Games boundary

`/games/` keeps its existing authored headings, descriptions, Matt's picks, category structure and manifest-driven catalogue. The upgrade is presentation and interaction around that content:

- canonical Made by Matt logo asset in the shared header/footer;
- the professional platform header/navigation already used by the main estate;
- a new Games-specific polish layer at `assets/mbm-games-hub.css`;
- manifest artwork used in Matt's top-pick cards when available rather than emoji-only placeholders;
- stronger responsive hero, cards, shelves, filters, focus/touch states and visual section rhythm;
- reduced-motion and dark/background-theme support.

The Games catalogue remains sourced from `/Games/games.json`. No game runtime is changed.

## Audience entry architecture

Canonical chooser: `/`. The former `/start/` URL is a noindex compatibility route to `/`. The preserved full general homepage is `/main/`.

Faces:

- `/for/pupils/`
- `/for/teachers/`
- `/for/parents-carers/`
- `/for/schools-semh/`
- `/for/trusts/`
- `/for/councils-organisations/`
- `/for/partners/`

The preserved full homepage at `/main/` retains its audience section and links to the canonical chooser at `/`.

### No gating

An audience view is not an account role and does not hide public content. The selection is saved only as the local browser preference `mbm_audience_view`; it never auto-redirects a visitor and never signs anyone up for an account or mailing list.

### Adult account/mailing boundary

The pupil face suppresses account-registration, Members and mailing-list promotion from the shared platform shell. Public Games, Lessons, Apps, Tools and Resources remain reachable.

Adult-facing views can surface the existing account, Members, mailing-list and Privacy routes where useful. Account creation and mailing subscription remain separate actions and separate consent flows.

## Audience copy boundary

Existing authored wording on `/games/` is preservation-tested. The current explanatory architecture lives on `/`, `/main/` and the `/for/.../` homepages. The professional/institutional pages explicitly avoid implying a school, trust, council or business relationship that does not exist.

## Verification

`tools/verify_games_audience_faces.py` protects the root chooser, preserved `/main/` homepage, exact seven-route taxonomy, real visual-content floors, pupil/adult feature boundary, local-only preference, metadata and navigation. Its mutation controls deliberately remove or corrupt seven separate release requirements and must fail.

> **`tools/verify_games_audience_faces.mjs` is not executed, and is not coverage.**
> `verify-games-audience-faces.yml` names it three times: twice in `paths:` trigger filters, and
> once as `node --check`, which only parses it. Nothing runs it. Its assertions have therefore
> never been evaluated, and at least three are provably stale against the committed tree — it
> expects the chooser's `<h1>` to read *"Choose your own homepage type"* (that text is an `<h2>`;
> the `<h1>` is *"Learning and creation, made simple."*), and it reads `.mf-main-card`, a selector
> that matches nothing anywhere in the estate. Tracked as BACKLOG item 0d.
>
> This paragraph used to describe those 550 lines as though they ran.

**The browser proof that does run is `tools/verify_audience_discovery_browser.py`**: 49 assertions
at 390px and 1440px, a 320px reflow pass over 11 routes, an estate-wide no-third-party-at-load
check over 12 surfaces plus a `/start/` redirect assertion, a no-JavaScript pass, and controls
proving each of them can fail.

For the record, what the unrun `.mjs` *would* check if it were repaired and run: the rendered release at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS pixels, including menu/focus behaviour, `/main/` preservation, real imagery, all seven audience homepages, pupil adult-feature suppression, local preference, representative journeys, first-party requests and horizontal overflow.

The permanent workflow repeats the *static* checks against the served production deployment after merge. Deployment provenance — that the served bytes are the commit under test — is `tools/verify_deployment_provenance.py`.
