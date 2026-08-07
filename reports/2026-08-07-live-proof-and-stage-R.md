# Live proof and Stage R — parked at the R/G boundary
**7 August 2026.** Every figure derived on the tree in front of me, with the
repository named alongside each result.

---

## §0 · Gates

**0.1 Subjects named.** Every check below prints the repository it stood in.
Last sitting a `cd` left in the wrong clone produced a false "document stale"
that would have stopped the whole run; naming the subject is now part of the
measurement, not a habit.

**0.2 Floors, by ancestry:**

| repo | subject | main | floor | |
|---|---|---|---|---|
| site | `/workspace/site` | `1d4eca3` | `1d4eca3` | ancestor |
| Games | `/workspace/games` | `2591276` | `2591276` | ancestor |
| Lessons | `/home/user/Lessons` | `aad7b50` | `aad7b50` | ancestor |

**0.3 Glowbound attachment** — searched by name *and* by size, not from one
path: `807ea812…bace`, **110,144 B — exact.** Stage G is unblocked and is
parked for budget, which is a different thing and is recorded as such.

**0.4 Live queue, derived:** shelf **48** · sitemap **456** · sole `NEW·`
holder `/novasiege/` · `collection` takes three values (Sports 7, RPG 1,
Shooter 1; 39 entries hold none) · **no `dateAdded` anywhere** · **no open PR
touches `games.json`**, so the single-writer rule holds.

**The §6 divergence is confirmed and is worse than a tidiness problem:** the
RPG rail renders **3** members via its tag regex while `collection` holds RPG
for **1**. Anything deriving from `collection` alone currently gets RPG wrong.

**0.5 PR #25**, measured locally with the exit status captured on the
command's own line:

| | files | hunks | merge-tree exit |
|---|---|---|---|
| before first write | **1** | **1** | 1 |
| after last write | **1** | **1** | 1 |

Untouched.

---

## §L-fin · Both published games are PROVEN SERVED

This ran first because it was the only thing that could already be broken for a
visitor. It was not — and the evidence, not the conclusion, is the point.

Run **31198357910**, **18/18 limbs**:

| surface | served | committed at main | |
|---|---|---|---|
| `/Games/games.json` | 24,791 B `c8617cf8b1c4` | 24,791 B `c8617cf8b1c4` | identical |
| `/ouroboros/` | 205,164 B `e5c9b154a386` | 205,164 B `e5c9b154a386` | identical |
| `/novasiege/` | 115,704 B `7a6f2d6e0129` | 115,704 B `7a6f2d6e0129` | identical |

Also asserted: served shelf **non-empty at 48** (an empty shelf would satisfy
"every entry resolves" vacuously) · sole `NEW·` marker served `["/novasiege/"]`
matching repo `["/novasiege/"]` · a shelf entry exists for each path · **zero
off-origin requests** at runtime on both pages · no script errors on either ·
the arcade **renders 48 cards that occupy real space** and shows a rendered
card linking to each new path · `_staging/` still 404.

**The control went red as required:** `HTTP 404` for
`/this-path-does-not-exist-control/`. Without that, the byte comparisons above
would be measuring nothing.

A 200 proves a response, not the right response, so the HTTP-status step is
printed and deliberately **not** gated. The byte comparison is the claim.

The GitHub Pages API returns nothing to this token — the documented case — so
deployment state could not be read directly. It did not need to be: the served
bytes settle it.

---

## §R · Triage of the five carried findings

Read by id from the source records, not from memory of what the ids meant. The
question was re-asked against the fact that the game is now live and served.

### SAVE-05 — **ship-blocking. Fixed.**

The finding's premise is the interesting part and it is correct: **JSON has no
`Infinity` token, but `1e999` parses to `Infinity`.** The "JSON cannot express
it" assumption is false.

Measured on the served file, with a positive control:

```
benign  {"materials":{"brass":42}}    -> loadGame true, brass 42
hostile {"materials":{"brass":1e999}} -> loadGame true, brass null, isFinite false
```

A destroyed numeric field reaching live state on a published game. Not a
theoretical round-trip — the value is already `null` at load.

Fixed by falling every numeric leaf back to the default it shadows. The benign
control is kept as a permanent limb beside it, because without one "reject
everything" scores identically to "sanitise correctly":

```
after fix: benign -> brass 42 · hostile -> brass 8 (default), finite, save still loads
```

**My first probe said this did NOT reproduce.** It drove `continueGame()`,
which re-derives `hp` and `level`, so it was measuring the normaliser rather
than the defect — and it only probed those two fields. Widening to `materials`
and `playTime`, and calling the real `loadGame()` directly, exposed it. This is
the fifth instance in three sittings of a clean probe result that was a fact
about the probe. §2.3 is now enforced in the gate itself.

### OD-2, OD-3, OD-4 — **not ship-blocking. Parked to Stage M.**

All three are test-seam gaps, and they cost the harness rather than the player:

- **OD-2** — no clock seam; every battle assertion pays real wall-clock time.
- **OD-3** — the debug object exposes no way to take an action (no
  `executeSkill`, no guard, no item, no target selection); harness reach works
  only by accident of top-level scoping, and `const` state is not on `window`.
- **OD-4** — `state()` reports no HP, no turn owner, no save, no modal state.

None of them can affect a visitor. They will bite the next suite that tries to
assert on a turn, which is a Stage M cost, not a live one.

### A11Y-12 — **not ship-blocking. Parked to Stage M.**

`#gameCanvas` carries `role="img"` with a label that never changes
(`setAttribute` appears zero times in the file), and `#portraitCanvas` has no
accessible name. A real gap.

It is not blocking because the primary combat channel is the `aria-live`
region widened in U-P1, which announces the battle log at its single DOM choke
point — all 19 write sites, not the 2 that were covered before. A
screen-reader user is not left without state; they are left without the
canvas's contribution to it, which is a lesser thing and the right size for M.

**Stage R closes: 1 of 5 was ship-blocking, and it was fixed.**

Gate after the fix: **73/73 limbs**, 206,429 B against the 300 KB ceiling.

---

## §Probes that returned clean, and what licensed accepting them

Recorded because §2.3 exists: a clean result is worth nothing on its own.

| probe | clean result | positive control that licensed it |
|---|---|---|
| SAVE-05 after fix | non-finite rejected | benign save loads with `brass 42` through the same call |
| L-fin byte comparison | all three identical | a nonexistent path returned 404 through the identical comparison |
| L-fin off-origin | zero off-origin requests | the page was driven for 4 s after `load`, not sampled at `domcontentloaded` |
| arcade render | 48 cards | counted only cards with a non-zero box; the shelf count is derived from the served manifest |

---

## §Register — errors this sitting made about its own work

| error | class | how it surfaced |
|---|---|---|
| SAVE-05 probe drove `continueGame()` and read only `hp`/`level` | measured the normaliser, not the defect | reported a real, reproducing data-loss defect as "not reproducing" |
| same probe's first pass reported "defaults everywhere" as a pass | absence of corruption confused with absence of the path | widening the fields and calling `loadGame()` directly settled it |

Both are the same family the last three sittings kept paying for, and both were
caught by insisting on a control before accepting a null.

---

## §Parks — with derived conditions

**Stage G — Glowbound. Parked for BUDGET at the R/G boundary.** The attachment
is in hand and byte-exact (`807ea812…bace`, 110,144 B), so nothing external
blocks it. G-P1 alone is a diagnostic spine plus eight mandatory findings, each
needing a gate proven red against a control, plus the SAVE-06-style sink audit
this document additionally owes — and Glowbound's share codes make that audit
strictly more urgent than Ouroboros's, because a share code is **designed** to
travel between people. That is foreign input by design, not by future sync.
Starting it here would half-finish the stage this document says to stop before.

**Stage T — taxonomy.** Not started; it must size itself once, to the final
shelf, so it should follow G. The RPG divergence recorded in §0.4 is its
first job and is now measured: rail 3, collection 1.

**Stage H — homepage.** Not started. `dateAdded` is absent from all 48 entries,
so the backfill is still owed in full. PR #25 measured 1/1 before and after.

**Stage M — polish and media.** Not started. Now also carries OD-2, OD-3, OD-4
and A11Y-12 with the classifications above.

**Re-proof owed.** This sitting changed `/ouroboros/index.html`, so the served
bytes will not match the committed blob until Pages redeploys. The L-fin proof
must be re-run after the merge; until it is green at the new tip, `/ouroboros/`
is **merged, not proven served** at its current content.

No clean-estate declaration is made.
