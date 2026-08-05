# Apex Rally landing — 5 August 2026

## Status

**Closed.** The delivered game is live at `https://madebymatt.uk/apexrally/`, on the
Sports rail and on the homepage Sports cards. Both open decisions were ruled and
are recorded verbatim below. One human item remains, and no gate substitutes for
it.

## Rulings — verbatim, on the record

**1 · ΔE00 14.01 Golf↔Tennis: ACCEPTED, no hue moves.**

> Rationale on record: ΔE00 ≥10 is plainly distinguishable; colour is never the
> sole differentiator on the cards (title/art/icon carry identity per the house
> rule); both hues are landed and re-opening merged surfaces for an aesthetic
> delta fails cost/benefit.

**2 · ⚔️ on the Rally card: KEPT.**

> It performs the brief's own differentiation requirement (the card must not read
> as a second Apex Tennis). No swap.

Both were raised by this session's gates and delegated back as rulings. Neither
is reopened here; the finding that produced the first is left reported by
`Games/tools/verify_sports_rail.js` on every run, which is now its accepted
steady state rather than a defect awaiting a fix.

## Instrument correction — ΔE00 is the standard

The estate held **two ΔE figures for the same pair under two formulas**: an
earlier **39.7** for Golf↔Tennis, and this run's **ΔE00 14.01**. Two truths for
one measurement, and the disagreement is the formula, not the colours — CIE76
measures straight-line distance in Lab and overstates separation in exactly the
blue–violet region where this pair sits, which is the defect CIEDE2000 exists to
correct.

**Standing rule from this close:**

> Hue-distinctness gates use **ΔE00 (CIEDE2000)**. Every report **names the
> formula** alongside the figure. Any stored ΔE figure **without a named formula
> is legacy** and is **re-derived before it gates anything**.

**Register note.** The canonical instruments register is
`LundyLoop/tools/INSTRUMENTS.md`, which is outside this session's repository
scope, so the rule is recorded here in full and **still needs transcribing into
that register by whoever next has it open**. Recording it in the only file this
close is authorised to write is not the same as filing it, and saying so is the
point.

Implementation already in place: `Games/tools/verify_sports_rail.js` computes
CIEDE2000 and prints the formula with every pair, so no unnamed figure can enter
the estate from the Sports rail again.

## Merge ladder

| Repo | PR | What | Outcome |
|---|---|---|---|
| site | [#67](https://github.com/MattRoper1977/mattroper1977.github.io/pull/67) | the game at `/apexrally/`, contract harness, card art, sitemap | **merged** `3a6a5994` |
| Games | [#15](https://github.com/MattRoper1977/Games/pull/15) | manifest 37 → 38, Sports rail 4 → 5, rail gates | **merged** `bb2aa4b8` |
| site | [#68](https://github.com/MattRoper1977/mattroper1977.github.io/pull/68) | arcade rail and homepage cards 4 → 5 | **merged** `9ba0b0da` |
| site | [#69](https://github.com/MattRoper1977/mattroper1977.github.io/pull/69) | live verification | **closed unmerged by design**, carrying the live evidence |

Order was forced, not chosen: the card art ships with the game, so #67 had to
land before #68's art-load gate could pass, and #68's rail count derives from the
manifest, so #15 had to land in between. #69 was never for merging — it exists
because the agent container cannot reach `madebymatt.uk` (the proxy answers 403
on CONNECT), so a CI runner is the only channel that can fetch a live path and
name a served hash.

## Live evidence — measured, not asserted

SHA under test `9ba0b0da18c9c00107f3b32c528954de359c86de`.

| | sha256 | bytes |
|---|---|---|
| delivered | `c34226418ff016f1fae62ffadf14e15053935550d65e311e493d48c7b84cef04` | 50,832 |
| committed | `b1ce0a0a3e4ec777ba2273ad3162e3a6fbbcf2c11eb873eb6cc0d7113b665c3a` | 51,038 |
| raw @ SHA | `b1ce0a0a3e4ec777ba2273ad3162e3a6fbbcf2c11eb873eb6cc0d7113b665c3a` | — |
| **served** `/apexrally/` | `b1ce0a0a3e4ec777ba2273ad3162e3a6fbbcf2c11eb873eb6cc0d7113b665c3a` | **51,038** |
| served, E1+E2 reversed | `c34226418ff016f1fae62ffadf14e15053935550d65e311e493d48c7b84cef04` | 50,832 |

Reversing the two permitted edits **on the served bytes** reproduces the
delivered artifact exactly, so the +206 is fully accounted for and the
provenance holds all the way to the served page rather than only to the commit.

- Served manifest **38 entries**, `art` **38/38**, Sports rail **5**, `NEW ·`
  holder **Apex Rally** (was two: Kick and Pool, against the never-two convention).
- Served arcade rail **5 cards**, 373×91, **all art loaded**.
- Served homepage **5 cards**, **0px overflow** at 360 / 768 / 1200, JavaScript
  disabled.
- Served sitemap: exactly **1** `/apexrally/` entry.
- New Release occupants unchanged: **Neon Sync + Neon Breach**. `doors[]` **13**,
  no Rally entry — one surface per game holds.

## Findings left standing for someone else

- **Golf↔Tennis ΔE00 14.01** — ruled accepted above; reported every run, not fixed.
- **The donor harness's no-remote-resources limb returns `false` on the clean
  `apextennis` file.** Its own `<link rel="canonical">` trips it, and it only ever
  asserted the mutated direction, so the defect is invisible from inside. Apex
  Rally's harness asserts both directions; the donor is untouched and still
  carries it.
- **Four further instances of the A-6 pinned-assertion shape** were found blocking
  a correct fifth game and converted to derived form: the arcade's `"Four Apex
  games"` literal, two literals in the homepage static gate, six limbs in the
  homepage browser gate, and the homepage transform's already-applied detector,
  which threw `homepage Sports membership drift` on a homepage it had itself
  produced. Each replacement was checked to be no weaker than the pin it replaced.

## Remaining human item — the only one

**Matt's phone tap on <https://madebymatt.uk/apexrally/>** — joystick, aim-drag,
HIT charge-and-release, one full point on a real thumb. No gate substitutes for
it. Two minutes, any time, sofa-grade.

Everything measurable here has been measured. This is the part that cannot be.
