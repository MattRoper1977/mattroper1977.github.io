# Slide announcer — coverage census, and the plan that stops here

Stage A shipped: `hud.js` announces slide changes on every deck that loads it,
with no lesson file edited. This is the census of the decks it **cannot** reach,
and the plan for them. **Stage B does not start without Matt's word.**

Measured 2026-08-12 against `MattRoper1977/Lessons` at `e0ca832`.

## The shape of it

| | count |
|---|---|
| HTML files carrying a `.slide` deck | 502 |
| …that load `/hud.js` — **covered by Stage A** | 225 |
| …that do **not** load `/hud.js` | **277** |
| of those 277, driven by ArrowRight | 275 |

## The uncovered populations

| population | count | slide mechanism | ArrowRight |
|---|---:|---|---:|
| `BUILD_Estate_v3` | 53 | `.active` + `.show` | 53 |
| `LAUNCH_Estate_v3` | 46 | `.active` + `.show` | 46 |
| `Science_Teesside/*/v3_40min` | 35 | `.active` + `.show` (15), `.active` (10) | 35 |
| `GROW_Estate_v3` | 34 | `.active` + `.show` | 34 |
| `6 Art` | 18 | `.active` + `.show` + `style.display` | 18 |
| `2 Physics 10` | 16 | `.active` + `style.display` | 16 |
| `Build` | 16 | `.active` + `.show` | 16 |
| `5_6 Local Choice` | 12 | `.active` + `style.display` | 12 |
| `biology` | 11 | `.active` + `.show` + `style.display` | 11 |
| `Grow` | 8 | `.active` + `.show` | 8 |
| `chemistry` | 8 | `.active` + `.show` + `style.display` | 8 |
| `Launch` | 8 | `.active` + `.show` | 8 |
| `ASDAN` | 3 | mixed | 3 |
| `Assembly` | 3 | mixed | 3 |
| `Tutor_Time` | 2 | `.active` + `.show` + `style.display` | 2 |
| `5 Intervention 10` | 2 | mixed | 2 |
| `build-anim`, `grow-anim` | 2 | no deck driver found | 0 |

The 40-minute science suites are exactly the `v3_40min` directories — 10 Build,
10 Grow, 15 Launch. Their siblings one level up (5 + 5 + 15 = 25 files) **do**
load `hud.js` and are already covered.

## What an announcer would need there

Nothing new in the mechanism. Every uncovered deck toggles a class on `.slide`
elements, which is what the Stage A observer already watches, and every one
sampled carries either a heading element or a `data-title` attribute, which is
what it already reads. The announcer is not the hard part.

The hard part is **delivery**, and there are only two honest options:

**Option 1 — add `<script defer src="/hud.js">` to the 277 files.**
One line per file. It brings the whole dock with it: timer, name picker, noise
meter, calm reset. That is a product decision, not an accessibility one — these
decks may have been left off the HUD deliberately.

**Option 2 — a separate `announce.js`, added to the 277 files.**
Same one line per file, but it carries only the live region and the observer.
No dock, no mic, no change to what the page offers a teacher. It duplicates
~40 lines of `hud.js`, which is the cost.

Either way it is **277 per-file edits** across the Lessons repo, which is the
mass-edit class the LSG and NAV passes just finished asserting protections
around — closure, witness, tiers, print fidelity, sentinels. That is why this
stops here rather than proceeding.

## Recommendation

Option 2, and not all at once: the `v3_40min` science suites first (35 files,
one coherent population, freshly built and freshly verified, so a regression
there is easy to see). Then reassess before touching the 190 estate-v3 files.

**This needs one word from Matt before any lesson file is edited.**
