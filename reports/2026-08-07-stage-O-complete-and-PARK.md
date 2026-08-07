# Stage O complete through O-P3 · Stages U, T, H parked

**Run of 2026-08-07, `ouroboros-olympics-complete` order.** Stage O reached
O-P3 and the half-publish is closed. O-P2, O-P4 and the whole of Stages U, T and
H are parked at the O-P3 boundary with derived conditions.

## §0 gate — passed on all four checks

| check | result |
|---|---|
| Ouroboros attachment | SHA-256 `e412d8d5…0add`, **189,516 B — exact** |
| repo floors (`ls-remote`) | lessons `aad7b50` ≥ `03f90cd` · games `7090b6b` = floor · site `7266aa9` = floor |
| resume state derived | shelf 45 · sole marker Fracture · Sports 6 · RPG 2 (tag-regex) · no `dateAdded` — every expectation matched |
| PR #25 baseline | **1 conflicted file, 1 conflict hunk** — matches the corrected baseline |

## O-0 — PR #83 merged, gate set re-run at the merge tip

Merged at **`e78a90e`**. Re-verified there, not assumed:

```
ALL 396 SPLASH GATES PASSED     11 games x 2 RM states
FLASH CENSUS PASSED             injected 10 Hz strobe still caught at 9.8 Hz /
                                128 units; ceremony reported at 8 Hz / 1.19% of
                                range, under the hazard floor, printed not buried
O10 drift 0.0083s               exactly one FIXED_DT, against a variable-timestep
                                control drifting 9.4667s
GLOBAL GAMES AUDIT VERIFIED
151 KB                          73% of the 200 KB ceiling
```

## O-P3 — the landing, and the resequencing

**O-P3 was run before O-P2, deliberately.** Merging PR #83 put a playable game
at `/olympics/` that the catalogue knew nothing about — the exact condition R1
forbids, created by O-0 itself. O-P2 is polish; O-P3 closes a red line. The
order's own R10 puts publishes before reorganisation, and this is the same
reasoning one level down.

| | before | after |
|---|---|---|
| shelf | 45 | **46** |
| Sports rail | 6 | **7** |
| `NEW ·` holder | Relicforge: Fracture Engine | **Global Games** |
| sitemap | 453 | **454** |

Landed by one writer, `tools/apply_olympics_landing.py`, because the three edits
are one landing and splitting them would reopen the R1 gap three times.

### The hue took three tries, and the reason is the finding

**Two floors, not one.** The order asked for ΔE00 ≥ 10 against nearest shelf
neighbours. `verify_sports_rail.js` **S3 already required ΔE00 ≥ 25** against
every other rail member and against manifest-adjacent entries. R9 makes the
repaired validator canon, so the stricter floor governs — and working to only
the stated floor would have shipped a hue the rail's own gate rejects.

| candidate | source | rail min | shelf min | verdict |
|---|---|---|---|---|
| the five CSS palette accents | the game's own tokens | — | 3.06–7.53 | all five fail **even the weaker floor** |
| `#128cc0` | the pool water | 14.70 (Apex Tennis) | 11.77 | fails the rail — two blues on one rail |
| `#47e7ff` | the game's primary cyan | 33.25 | **4.83** (Neon Sync) | clears the rail, **rejected anyway** |
| **`#9c3b36`** | **the running track** | **27.37** | **19.92** | both floors, with margin |

`#47e7ff` is the one to remember. S3 only checks manifest-*adjacent* entries, and
Neon Sync is not adjacent — so cyan would have passed the gate that runs and
still been wrong. **Passing the gate that runs is not the same as being right.**

### Two stale pins converted, not weakened

`verify_fracture_shelf.js` and `verify_neonturf_shelf.js` both asserted the
marker was **Fracture's**. True when written; a stale pin the moment the estate
did the very thing its own recency convention says it should. Both now assert
*exactly one holder* and **name it in the message every run**, so an unexpected
transfer is loud rather than silent. Same repair as the Aurora conversion, and
now in agreement with `verify_sports_rail.js` S4, which already derived it right.

### A retired gate I should not have run

My first sweep reported `verify_apexpool_sports_manifest` and
`verify_apextennis_manifest` failing. Two things were true and I only checked
one of them at first: they were **already failing on `origin/main`**, and they
are **formally retired** — named in `tools/RETIRED_apex_sports_manifest_gate.md`
with their workflow reduced to `workflow_dispatch`. Running them was reapplying
a spent gate, which R9 forbids. The manifest was never wrong; the sweep was.

### Gates

```
LIVE CI SET (Games)                     ARCADE RENDER (site)
verify_sports_rail    7/7 PASSED        46 distinct games across 66 cards
verify_fracture_shelf   21/21           Sports rail 7, 7 distinct titles + art
verify_neonturf_shelf   14/14           sole marker holder /olympics/
verify_2c_shelf         15/15           zero overflow desktop + phone
verify_relicforge_shelf 20/20           no page errors
verify_echovault_shelf  20/20           control: rail drops to 6 when tampered
games.json valid, 46 entries
```

Two of my own arcade assertions were wrong first, both the same way: the page
deliberately surfaces one game in several places, so 46 entries render as 66
cards and the single marker holder renders twice. Comparing DOM node counts
against manifest length reported the page working correctly as two defects.
Identity on that page is the href.

### The live leg — parked on evidence

The container is **proxy-blocked from `madebymatt.uk`** (`000` on every request),
so served-hash comparison could not run here. This is *not* the 2026-08-06
outage pattern: `pages build and deployment` shows **success at 11:46** and
another run in progress at 12:03, with no `runner_id: 0` and no 15-minute
timeouts. Committed blob for the record: `olympics/index.html` sha256 begins
`8f50555451ab4694`.

**Also pre-existing and not caused by this run:** the `AGX-1 live verification`
workflow has failed on every branch back to 2026-08-06, including
`claude/l4b-band` and `claude/game-estate-complete-*`, all of which predate this
work. Named here so it is not mistaken for fallout.

**Resume condition:** one verifier dispatch from a runner that can reach the live
host, comparing served bytes to the committed blobs above.

---

# THE PARK

## O-P2 graphics bands — not started

Nothing was attempted. No before/after fps figures exist, so none are quoted.
**Resume conditions, derived:** the file is at 151 KB against a 200 KB ceiling,
so ~49 KB of headroom for B1–B3. The flash census must re-run after B3 because
the confetti ceremony is the named hotspot, and it currently sits at 8 Hz /
1.19% of range — under the hazard floor but the only scene above the noise floor
at all, so it is the one a band could push over. The census's whole-canvas mean
dilutes localised flashes; **porting the hearth instrument's automatic
highest-variance locus pass is the named prerequisite** before the ceremony is
called settled.

## O-P4 trailer — not started

The banner and three thumbnail candidates were delivered in the previous run and
are on main, opened and inspected. The ~30 s trailer is not started.

## Stage U (Ouroboros) — audit derived, nothing built

The attachment verified exactly, so Stage U did not park for want of evidence —
it parked for want of budget, after the audit derivation below.

**Two corrections to §3's brief, both measured:**

1. **`window.__ouroboros` is not absent.** `window.OuroborosDebug` exists at line
   1733 with `build`, `state()`, `skipSplash()`, `newGame()`, `enterMap(id)`,
   `startBattle(id)` and `grantAll()`. The spine is **thin, not missing** — no
   save/settings exposure, no Forge or Spire routing. U-P1.1 is an extension,
   not a build.
2. **The dev cheat is `grantAll()` and it is console-only.** Namespaced under the
   Debug object, not referenced anywhere in `bindUI()`. Same posture as
   `MBMGlobalGames.debugFinish`. Record it, keep it.

**U-1 confirmed exactly as described.** `screenFlash()` sets an inline
`opacity = strength`, then plays `#screenFlash.flash`. The keyframe is
`0%{opacity:1} 100%{opacity:0}` with **no `fill-mode`**, so when the 0.24 s
animation ends the element reverts to the inline opacity and stays there. Five
call sites: cinematic transition `.45`, sub-node break `.7`, Matrix Collapse
`.85`, Paradox Collapse `1.0`, Resonance `.75`. **`screenFlash` is not RM-gated
— only `shake` is** (line 401 checks `Game.settings.reducedMotion`; line 397
does not). Under reduced motion the blanket
`body.reduced-motion *{animation-duration:.001ms}` completes the animation
instantly, making every flash permanent at full strength immediately.

**Root-cause fix, derived and ready to write:** carry peak strength in a CSS
custom property the keyframe reads (`0%{opacity:var(--flash-strength,1)}`),
never set inline opacity at all, clear the class on `animationend`, and refuse
the flash outright when reduced motion is on (R5 requires RM peak flash 0). The
gate must sample computed opacity ≥ 1.5 s after **each** of the five call sites,
in both RM states, and must first be proven to fail on the pre-fix file.

**U-2 confirmed.** `reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches`
is seeded once inside `defaultSave()` (line 620) and then persisted, with no
change listener — the Fracture/Turf read-once defect, third occurrence.

**Other derived facts:** `SAVE_KEY = "mbm_ouroboros_chronos_unbound_v1"` (line
358, on-convention per R4, no rename). Storage goes through a real `Store`
wrapper with an in-memory fallback (line 362) — the null-grep rule applies to
anyone auditing this file. `loadGame` shallow-merges per section inside
try/catch (line 656). The loop is **variable dt clamped at 0.05** (line 1718),
no accumulator. Head furniture: **no canonical, no og, no noscript** (0
occurrences). aria: **10 attributes** — 7 label, 1 live, 1 atomic, 1 hidden.
Splash is **bespoke and self-closing** at ~2.55 s (1850 ms + 700 ms), so it is
classified bespoke and left alone per §0.4. Zero external references (R6 holds).

## Stage T (taxonomy) — not started

**T-0's ruling is recorded and unchallenged:** fold onto `collection`. The
groundwork stands from the previous run — the arcade runs two derived-membership
mechanisms (Sports via `collection`, Action-RPG via `/\bRPG\b/` on `tag`, which
already implements the ≥2-member render rule), and `verify_sports_rail.js` S1
forbids a third field. **New fact from this run:** `collection` now has exactly
one value in use, `Sports`, across 7 of 46 entries.

## Stage H (homepage) — not started

No `dateAdded` field exists on any of the 46 entries; the backfill is genuinely
needed. **PR #25 measured again after all manifest work: 1 conflicted file, 1
conflict hunk — unchanged.** Untouched, unrebased, unresolved.

---

**The estate is not clean.**
