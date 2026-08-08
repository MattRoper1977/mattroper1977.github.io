# Made by Matt Games + audience faces release

Sentinel: `mbm-games-audience-faces-2026-08-08`

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

Chooser: `/start/`.

Faces:

- `/for/pupils/`
- `/for/teachers/`
- `/for/parents-carers/`
- `/for/schools-semh/`
- `/for/trusts/`
- `/for/councils-organisations/`
- `/for/partners/`

The homepage's existing audience section is preserved and gains one additive link to the full chooser.

### No gating

An audience view is not an account role and does not hide public content. The selection is saved only as the local browser preference `mbm_audience_view`; it never auto-redirects a visitor and never signs anyone up for an account or mailing list.

### Adult account/mailing boundary

The pupil face suppresses account-registration, Members and mailing-list promotion from the shared platform shell. Public Games, Lessons, Apps, Tools and Resources remain reachable.

Adult-facing views can surface the existing account, Members, mailing-list and Privacy routes where useful. Account creation and mailing subscription remain separate actions and separate consent flows.

## Audience copy boundary

Existing authored wording on `/games/` is preservation-tested. New explanatory copy exists only on the new `/start/` and `/for/.../` pages. The professional/institutional pages explicitly avoid implying a school, trust, council or business relationship that does not exist.

## Verification

`tools/verify_games_audience_faces.py` protects existing Games copy anchors, canonical logo use, exactly seven audience choices, the pupil/adult feature boundary, platform routes, local-only audience preference, sitemap entries and a positive control that deliberately corrupts the chooser sentinel and must fail.

`tools/verify_games_audience_faces.mjs` checks the rendered release at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS pixels, including menu/focus behaviour, Games manifest rendering and artwork, chooser/face structure, pupil adult-feature suppression, local face preference, first-party requests and horizontal overflow.

The permanent workflow repeats the browser checks against the served production deployment after merge.
