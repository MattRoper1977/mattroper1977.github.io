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
