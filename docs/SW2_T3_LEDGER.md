# SW2 T3 ledger — for Matt

R-T3.1 says that if the approved design would change a string a contract pins,
it is not changed; it is listed here. One item qualifies, and it is the first
step R-T3.2 asks for.

---

## BLOCKED, needs a ruling: brand convergence (R-T3.2 step 1)

**The ask.** Every stamped page references the mark root-absolute.

**Why it is blocked.** The logo is pinned by a preservation baseline, and
convergence changes it. `tools/verify_professional_site.js` compares the markup
between `<a class="brand">` and the first `<span>` against `origin/main`
(`brandVisual()`), and normalises only `src="assets/` to `src="/assets/`. It does
not normalise `../assets/`. Measured, not argued: changing that one attribute on
`members/index.html` and running the verifier gives

```
[FAIL] professional site verifier (1 issue)
  - members/index.html: Made by Matt logo visual changed
```

and restoring the file returns it to `[PASS] … 11 passed · 0 failed`.

**Scope.** Six of the twelve stamped pages would change; six already reference
it root-absolute.

| already `/assets/brand/micro_mark.svg` | would change |
|---|---|
| `index.html` | `tools/index.html` (`../assets/…`) |
| `main/index.html` | `resources/index.html` (`../assets/…`) |
| `account/index.html` | `members/index.html` (`../assets/…`) |
| `mailing-list/index.html` | `privacy/index.html` (`../assets/…`) |
| `teach/index.html` | `stats/index.html` (`../assets/…`) |
| `education-hub/index.html` | `games/index.html` (inline `<svg>`) |

**Two corrections to the ruling's premises, both measured.**

1. The asset is at `assets/brand/micro_mark.svg`, not `assets/micro_mark.svg`.
   There is no file at the latter. Moving it would be a URL change, which
   R-T3.6 forbids, so the root-absolute form is `/assets/brand/micro_mark.svg`.

2. **The Play shelf has no inline SVG.** `domain-split/play/index.html:13`
   carries a `@@LOGO@@` placeholder that `domain-split/play/build.py:260`
   substitutes with `<img src="/assets/play/approved-mark.jpg" alt="" width="48"
   height="48">` — already root-absolute, and a *different asset*. The inline
   `<svg>` in that masthead is the search and menu glyphs, not the mark. The
   page that does carry an inline `<svg>` brand is the site's own
   `games/index.html`.

   That Play mark cannot be swapped in Part T in any case: `build.py:253-254`
   holds the entire Play release unless `brand.json` says `verified-original` or
   `user-approved`, and `:258` asserts the file's sha256. Changing it means
   editing an approval record, which is a brand decision, not chrome parity.

**What is resolvable, and the two ways out.**

- *Do nothing.* Leave all six as they are. Costs nothing; the mark renders
  identically either way, because both forms resolve to the same 263-byte file.
  The only loss is that the brand fragment cannot itself be stamped uniformly.
- *Complete the verifier's normalisation.* `brandVisual()` already normalises
  one relative form; teaching it `../` and `../../` would make it compare the
  visual rather than the spelling, which is what its own failure message claims
  to be about. That is arguably a correction rather than a relaxation, and it
  can be red-proved by showing a genuinely different mark still fails. It is
  still a change to a gate, so it is not made here.

**Taken for now:** do nothing, and exclude the brand mark from every stamped
region. The markers wrap the fragments that can be uniform without touching a
pinned byte — the nav row, the Menu button, the footer tagline and the footer
link group — and the brand stays outside them until this is ruled on.

**Swap line, for Matt only.** `MARK=converge` → the six pages above move to
`/assets/brand/micro_mark.svg`, `games/index.html` swaps its inline SVG for the
same `<img>`, and `brandVisual()` gains the relative-path normalisation with its
own red proof, in one commit. `MARK=silver` (R-T3.3) stays separate and
untouched.

---

## Not blocked, recorded for completeness

- **`/privacy/` has no `<footer>`.** It gains its first one as an addition
  (R-T3.2 step 4), body byte-identical either side.
- **The stamp set is 12 pages, not the record's 17.** `data/adult-surfaces.json`
  is the record of pupil-reachable surfaces, not of every page carrying chrome:
  it omits `index.html` and `stats/index.html`, which the verifier treats as key
  pages, and it names six generated `for/` pages that change through their
  generator. The set used is the record ∪ the verifier's key pages ∪ the
  chooser, minus generated.

---

## AUTO-DECISION: the token file may not redefine an estate name

Logged under Q3 (rule the order does not settle, decide and continue).

**What was found.** `assets/mbm-tokens.css` is stamped as the last stylesheet in
`<head>`, so any custom property it names wins the cascade estate-wide. Five of
its names were already owned elsewhere:

| name | estate owner | estate value | mine | live consumers |
|---|---|---|---|---|
| `--mbm-ink` | `assets/mbm-platform.css` | `#1B2140` | `#161d3d` | 1 |
| `--mbm-line` | `assets/mbm-platform.css` | `#E3DAC5` | `#161D3D22` | 4 |
| `--mbm-muted` | `assets/mbm-platform.css` | `#4A5170` | `#454C6B` | 0 |
| `--mbm-focus` | `mbm-platform.css` *and* `brand/brand-tokens.css`, disagreeing | box-shadow / outline | outline | 1 (dead CSS) |
| `--mbm-font` | `assets/brand/brand-tokens.css` | identical | identical | 1 |

**It was not theoretical.** Diffing every element's computed style with and
without the file, across all twelve stamped pages: `/main/`'s `.mbm-audience`
ink moved `#1B2140` → `#161D3D`, and its warm `#E3DAC5` divider became a faint
navy hairline — as did `.mbm-audience-card`'s top and right borders and
`/games/` `section.hero`'s bottom border. Thirteen differences in all. T3 is
chrome parity only (R-T3.6), so shipping them would have been a design change
made in the wrong part, and an invisible one: no gate then in place looked at
rendering.

**Decided.** The five are DEFERRED, not renamed. The estate's existing
definitions stand as the single definition of each (§0.6, one name per thing);
`--mbm-primary` already carries the ink role without colliding. If the redesign
wants different values they change at the definition, in the part that owns the
repaint and can show it. A focus token is deliberately absent: `--mbm-focus`
has two conflicting meanings in the estate today, and settling that belongs
with Part A's focus work.

**Held by two new gates**, both red-proved:
`tools/sw2/check_token_collisions.py` (no name defined twice; `--self-test`
puts `--mbm-line` back and it fails) and `tools/sw2/check_tokens_inert.cjs`
(3,658 elements across 12 pages, 17 properties each, zero computed-style
differences; `--break` reintroduces the collision at runtime and it reports
exactly the four consumers).

**Two things for Matt, neither blocking.**

1. The estate disagrees with itself on three names, and this predates SW2:
   `--mbm-focus` (`brand-tokens.css` outline vs `mbm-platform.css` box-shadow —
   putting the platform's value into `outline:` is invalid, so that rule would
   silently do nothing), `--mbm-line`, and `--mbm-mint-deep` (`#3E7D5C` vs
   `#2F6B4D`). The collision gate reports these every run without failing on
   them. `brand-tokens.css` is loaded by none of the twelve pages and
   `.mbm-btn`/`a.mbm-link` appear in no markup anywhere in the estate, so the
   focus rule is currently dead CSS — worth deleting or wiring up in Part A,
   not before.
2. `games/index.html` references its icon as `https://madebymatt.uk/favicon.svg`
   — absolute, where every other page uses a root-relative path. It is the
   estate's own host so it is not a third-party request, and headless Chromium
   never fetches a favicon so the request census cannot see it; it is reported
   separately by `check_token_census.cjs` so it stays visible.

---

## T4: UX2 A4/B5/C4 still green

**B5 (site)** — run directly against this branch: professional-site verifier
0 findings / 11 controls, navigation census 0 added 0 lost, theme parity 6
themes across every engine in scope, published-site 20/20.

**A4 (Lessons)** — run against Lessons `main` (2c33266) with THIS branch
supplied as the site tree, which is the combination that actually ships:
`tools/ux2/hub_gates.mjs` **298/298 limbs**, including its three red proofs
(hidden family drops reachability 40→13; removed chip caught 4→3; a key at a
half-term no lesson holds renders no planning link).
`tools/verify_lessons_chips.mjs` over HTTP **99/99 limbs** plus its red proof,
and the linkedom catalogue DOM check.

**C4 (Play)** — AUTO-DECISION, logged under Q3: not re-run in full, because
this branch cannot reach it, and that is measured rather than assumed.

- `git diff origin/main --name-only` touches **no file under `domain-split/`**.
  Every play-build input — `play/build.py`, `play.css`, `play.js`, the shelf
  template, `brand.json`, `source-revisions.json` — is byte-identical to main.
- The branch's only new files that reach the composed tree are
  `assets/mbm-tokens.css` and the four `assets/chrome/*.html` templates, all
  carried by the existing unfiltered `copytree`.
- **No play route links any of them.** The one HTML file in the composed tree
  mentioning the token file is `assets/chrome/header.html`, which is the
  template itself, not a route.
- No play gate enumerates `assets/`, asserts a manifest, or measures a directory
  size, so an unreferenced file cannot move any C4 number. Shelf transfer size
  is unchanged for the same reason: nothing loads it.

Running C4 in full needs a complete play build with preservation baselines and
source-revision re-derivation across three checkouts. It is the right gate at
the Games pin-bump, where the tree is real; here it would re-prove main.

## Two smaller notes, neither blocking

- **The chrome templates are now publicly fetchable** at `/assets/chrome/*.html`
  on the site and, via the wholesale asset copy, on the Play tree. They are
  fragments with no content and nothing links them, so this is untidiness
  rather than a defect — but they are crawlable. A `robots.txt` line or moving
  them out of `assets/` would settle it; both are route decisions, so they
  belong to Part U rather than here.
- **`--mbm-card-raised` had no light value.** It was declared only inside
  `[data-theme="dark"]`, so it resolved empty on every light page, and the
  census passed it because twelve empty strings are consistent. Found by the
  Play-tree gate, which counts tokens that resolve rather than tokens that
  exist. The census now checks emptiness first and separately.
