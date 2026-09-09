# SW2 ledger

State written as each part closes, so the next session resumes from it rather
than from a transcript. Part-by-part; the close token for a part appears only
when its landing is done.

---

## Part T — tokens, chrome templates, stamping, gates, landing

**Branch:** `claude/sw2-t1-tokens` · **PR:** site #337

### T1 tokens — `assets/mbm-tokens.css`

32 names. Every value read from a file in this estate, with the source file and
selector named beside it in the file; one value is new (`--mbm-format-pptx`,
because no red exists here to read) and its contrast is measured like the rest.

Contrast, measured not asserted: **34 ink/surface pairs across cream and dark,
all ≥4.5:1.** Tightest are the pathway chips at 5.12 (build), 5.13 (grow),
5.44 (launch), and subject art at 5.15. `tools/sw2/check_token_contrast.py`
derives the pairs from the file's own naming and holds it; `--min 7` reds it.

**The file is INERT, and that is measured.** It declares custom properties and
no selectors, and `tools/sw2/check_tokens_inert.cjs` proves the claim by
diffing the computed style of every element on every page with and without it:
19 page types, 6,507 elements, 17 longhand properties each, zero differences.

That gate exists because the claim was false when first made. Five names —
`--mbm-ink`, `--mbm-line`, `--mbm-muted`, `--mbm-focus`, `--mbm-font` — were
already owned by `assets/mbm-platform.css` and `assets/brand/brand-tokens.css`,
with six live consumers, and the stamped `<link>` is last in `<head>`, so each
won the cascade. `/main/`'s `.mbm-audience` ink moved `#1B2140` → `#161D3D` and
its warm `#E3DAC5` divider became a faint navy hairline; the same on
`.mbm-audience-card` and `/games/ section.hero`. 13 differences in all.

**AUTO-DECISION (Q3):** the five are deferred, not renamed. The estate's
existing definitions stand as the single definition of each (§0.6, one name per
thing). `--mbm-primary` already carries the ink role without colliding. A focus
token is deliberately absent: `--mbm-focus` has two conflicting meanings in the
estate today, and settling that belongs with Part A's focus work.

### T2 chrome templates

`assets/chrome/{header,nav-row,footer,menu-sheet}.html`, three variants each
(adult / pupil / play) plus a `minimal` footer for `/privacy/`.
`menu-sheet.html` delegates to `domain-split/shared_navigation.py` rather than
duplicating it. 18 composition checks.

### T3 stamping — parity, not uniformity

| ask | result |
|---|---|
| pages stamped | **12/12** hand-written, two regions each; plus `footer` on `/privacy/` |
| href census | **0 added, 0 lost**; one declared (`privacy/index.html` +1 `/main/`, its new footer brand link) |
| verifier findings | **0** (11 controls passed) |
| brand references converged | **0 of 6 — BLOCKED**, see `SW2_T3_LEDGER.md` |
| `/privacy/` body byte-identical | **yes** — 12,931 bytes, sha256 `c4ff8c19…` both sides |

Two things stayed outside every marker, each for a measured reason: the brand
mark (`brandVisual()` pins it and normalises only `src="assets/`, not
`../assets/`; six pages would change) and the nav row (converging it would move
the href multiset on 10 of 12 pages, which R-T3.4 forbids and explains —
retirements belong to Parts H and U).

**Generated pages are stamped by their generators.** Five pages in the stamp set
are generator-owned and were hand-stamped, which CI caught and the local suite
could not:

    tools/render_audience_homepages.py   index.html, start/, for/*/
    tools/render_discovery_hubs.py       teach/, education-hub/

`main/index.html` masked it — the audience generator *splices* that one rather
than rendering it, so the hand stamp survived there and only the fully-rendered
pages went stale. Both generators now read the same `assets/chrome/header.html`
fragments `tools/stamp_chrome.py` reads: one source, three consumers.

§0.6 came with it. `brand()` served both header and footer, so removing the
header tagline by hand held only until the next render — the regeneration put it
straight back. It takes a `tagline` argument now. Every generated page carries
exactly one "Learn • Build • Explore", in its footer.

### T4 gates — thirteen, every new one red-proved

| gate | covers | red proof |
|---|---|---|
| professional site | chooser + 7 key pages, preservation, route contracts | 0 findings / 11 controls |
| navigation census | anchors as a multiset vs `origin/main`, per page | drop an anchor |
| theme parity | 6 themes in every engine in scope | — |
| chrome templates | 18 composition checks | — |
| stamped regions | region == template at the pinned SHA | edit one stamped button |
| published-site | 20 tests | — |
| token collisions | no name defined twice; reports the estate's own three | `--self-test` |
| token census | one value estate-wide; empty is a failure; requests not tags | `--unlink` |
| token inertness | 19 page types, 6,507 elements | `--break` |
| Play tree tokens | carried, byte-identical, resolving | `--expect-missing` |
| tap targets | 445 controls at 390px, both chrome states | `--min 48` → 213 findings, all at exactly 44.0px |
| authored body | outside the markers, 12/12 byte-identical to main | `--self-test` |
| token contrast | 34 pairs, cream and dark | `--min 7` |

**A4 and B5 re-run; C4 shown unreachable.** A4 was run as it ships — Lessons
`main` (2c33266) with this branch as the site tree: `hub_gates.mjs` **298/298**
with all three red proofs, `verify_lessons_chips.mjs` **99/99** over HTTP with
its red proof, and the linkedom catalogue DOM check. C4 is not re-run because
this branch touches **no file under `domain-split/`**; the only new files
reaching the composed tree are the token CSS and four chrome templates, no play
route links any of them, and no play gate enumerates `assets/`.

**Gates that measured the wrong thing before they measured the right one.**
Recorded because each was a silent pass, which is worse than a red one:

- the third-party check counted `<link>` tags and reported twelve failures, all
  `rel="canonical"` at the estate's own origin — which issues no request at all.
  It counts requests now: 154 observed, 0 third-party.
- the census kept a hand-written token list, which would have censused the five
  deferred names to the empty string on twelve pages and called it a pass.
- the census passed `--mbm-card-raised`, declared only in the dark block and
  resolving empty everywhere; twelve empty strings are consistent. Emptiness is
  checked first now, and the token gained a light value.
- the tap-target exemption keyed on a parent tag whitelist and failed one
  `<div class="contact">` sentence while exempting the identical construction in
  a `<p>` one element above it.
- the authored-body gate excised whole marked regions, comparing unlike things.
- the contrast gate derived pairs as `X`/`X-ink` and skipped all three pathway
  chips, which spell it `-bg`/`-ink`. An unpaired ink is an error now.

### T5 landing

**Admission registry re-cut.** Stamping changes published bytes, all
digest-pinned. Measured: education-site **14 CHANGED, 5 ADDED**;
education-lessons **0/0**; education-apps **0/0**. The 14 became transition
pairs `[what main builds, what this branch builds]`; the 5 added — the token
file and the four chrome templates — are `ARRIVING`. Both halves proved: this
branch's build **and** main's build pass the new registry. That second proof is
the whole reason a pair exists rather than a fresh census.

The 30 `Humanities_Teesside/Teaching_Packs` zips absent from the build are not a
regression: exactly 30 of the 42 pinned there carry `ARRIVING`, and they are the
same 30. Counted, not assumed.

**CI reds established as not this PR's**, each by evidence:

- `echovault-surfaces-verify` ×2 — failing on `main` at `47b7d895` today.
- `apexpool-home-verify` — asserts PR **#25** is still open and unmerged at
  `7c202790`. #25 was **closed 2026-09-07**, unmerged, head SHA unchanged, so
  only the `state=='open'` assertion fails. It now fails for every PR touching
  `main/index.html`. No fix can be ported without editing a workflow assertion,
  which §0 and Appendix B forbid outright. **Matt's call:** reopen #25, or move
  the workflow's held-PR record deliberately.
- `agx1-live-verify` — this one *was* this PR's. It succeeded on other pull
  requests hours earlier, so "red on main too" was not available as an answer.
  The registry re-cut is the fix.

### T5 landing — where each repository stands

| repo | branch | PR | state |
|---|---|---|---|
| Site | `claude/sw2-t1-tokens` | #337 | complete; green but for three checks proved not its own |
| Apps | `claude/sw2-t5-apps` | #73 | complete; `[PASS] apps cross-estate static contract` |
| Lessons | `claude/sw2-t5-lessons` | — | **prepared, BLOCKED** (below) |
| Games pin-bump | — | — | not started; follows the Site merge |

**Lessons is blocked, and the blocker is not this work's.** Changing the hub and
subject page moves their reviewed `CATALOGUE_PINS`, so the cross-estate gate
reds. The sanctioned fix is `tools/catalogue/pin_catalogue_contract.py`, which
refuses while the two `verify_cross_estate_unification.py` copies differ.

They differ **structurally, not by staleness**, and a single file text cannot
satisfy both consumers today:

| | |
|---|---|
| Lessons copy | `PUBLICATION_CALLER_SHA256 = b6d0358f` (its own caller) **plus** `_BY_KIND {apps: c4205191}` |
| Apps copy | `PUBLICATION_CALLER_SHA256 = 732591dd`, **no** `_BY_KIND` at all |
| `apps@924ab986` caller | `c4205191` — the Site's `domain-split-verify.yml` pin |
| `apps@3ad0a7df` caller | `da9809f0` — the Site's `education-publication.yml` pin |
| `apps@main` caller | `732591dd` — what Apps CI validates |

Apps CI checks Apps main's caller; the Site's control checks Apps at `924ab986`;
those are different files. Reconciling either direction reds one repository —
measured both ways, not argued. Apps passes with its own copy; it fails with the
Lessons copy.

A re-pin *was* obtained by making the copies identical for one command and then
undoing it. That satisfies the guard rather than the condition, so it was backed
out rather than shipped.

**Two ways out, both Matt's.** Move the Site's Apps pin so one caller serves both
consumers — §0 permits a documented pin move. Or give the caller pin a
transition pair, the way the admission registry already does for files — which
relaxes a gate assertion, so not from here.

Note the Apps PR is *not* blocked by this: its gate copy skips the Lessons
catalogue pins for `kind == "apps"`, so it passes with the hub changed.

---

## Open, for Matt — nothing blocking except where marked, all measured

1. **Brand convergence** (`SW2_T3_LEDGER.md`), with the `MARK=converge` swap
   line and two corrections to the ruling's premises that did not survive
   measurement.
2. **The estate disagrees with itself** on `--mbm-focus`, `--mbm-line` and
   `--mbm-mint-deep` across files. `brand-tokens.css`'s focus rule is dead CSS:
   `.mbm-btn` and `a.mbm-link` appear in no markup anywhere in the estate.
3. **The two `verify_cross_estate_unification.py` gate copies have diverged** —
   169 diff lines, the file's own docstring still claims byte-identity. This is
   the T5 Lessons blocker above, and it is worth restating why it is not simply
   staleness: the divergence encodes a contradiction the estate cannot express
   in one file, because the Site pins **two different Apps revisions** in two
   workflows (`924ab986` in `domain-split-verify.yml`, `3ad0a7df` in
   `education-publication.yml`) and Apps main is a third. Whichever way the
   copies are reconciled, one repository's CI reds. **This blocks
   `pin_catalogue_contract.py` for anyone**, not just this work.
4. **`games/index.html`** references its icon absolutely at
   `https://madebymatt.uk/favicon.svg` where every other page is root-relative.
5. **The chrome templates are publicly fetchable** at `/assets/chrome/*.html` on
   the site and, through the wholesale asset copy, on the Play tree — and they
   are now admitted into the published education tree. Inert fragments nothing
   links, but crawlable. Excluding them means changing the publication build,
   which is wider than T3 may be. A route decision, so Part U's.
