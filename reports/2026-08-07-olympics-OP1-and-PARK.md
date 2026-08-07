# Global Games Olympics — O-P1 shipped, O-P2 onward parked

**O-P1 (audit + repair) is COMPLETE and green.** O-P2, O-P3, O-P4, Stage T and
Stage H are **parked at the O-P1/O-P2 boundary** with derived conditions below.

This is a park, not a stall: AM9's *"one clean park beats two thin efforts"*.
The remaining work is a graphics band programme, a publish, a video render, a
46-row taxonomy and a homepage reorganisation. Starting any of them on the tail
of this budget and abandoning it mid-phase is exactly what that rule forbids.
Everything derived along the way is written down here so the next sitting starts
from evidence rather than from a description.

## Status

| phase | state |
|---|---|
| Attachment verification | **PASS** — SHA-256 `c554ded6…a090`, 132,502 B, exact match |
| **O-P1 audit + repair** | **SHIPPED** — all gates green, controls proven |
| O-P2 graphics bands B1–B3 | **NOT STARTED — this is the park boundary** |
| O-P3 publish `/olympics/` | not started (groundwork derived below) |
| O-P4 trailer + thumbnails | partially delivered: 3 thumbnail candidates + banner rendered; **video not started** |
| Stage T genre rails | not started (mechanism fully derived below) |
| Stage H homepage | not started (PR #25 count measured below) |

Baselines confirmed by `ls-remote`, all met exactly: site `7266aa9` · Games
`7090b6b` · Lessons `03f90cd`.

---

## The brief's premise (1) is wrong, and the correction matters

> *"storage goes through a wrapper — a literal setItem/getItem grep returns
> EMPTY despite claimed persistent career records"*

**There is no wrapper.** The literal grep finds both calls immediately:

```
207: const base=defaultSave();let raw=null;try{raw=localStorage.getItem(SAVE_KEY)}catch{}…
210: function persist(save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}}
```

`localStorage` appears exactly twice in the file, in single quotes, unwrapped.
This is the register's null-grep rule pointing the other way: that entry warns
against reading a null grep as an absence, and here an absence was *asserted*
that one grep disproves. The rule generalises — **an inherited finding is a
claim like any other and needs re-deriving before it is acted on.** Acting on
this one would have meant hunting a wrapper that does not exist.

## The save key: the rename window was open, and the rename does not fire

One key, not a family: `SAVE_KEY = 'mbm_global_games_v1'` (line 102), holding
`{version, soundOn, records, gamesPlayed, eventWins, profile}`.

The order made the rename **conditional** — *"apply the pre-publication rename
window → `mbm_olympics_*_v1` family **if off-convention**"* — so the convention
had to be derived before the condition could be evaluated. Censused across all
three repos:

| pattern | examples |
|---|---|
| `mbm_<game>_v<n>` | `mbm_echovault_v1`, `mbm_apexpool_v1`, `mbm_apexrally_v1`, `mbm_lumina_haven_v2` |
| `mbm_<game>_<aspect>_v<n>` | `mbm_neonturf_settings_v1`, `mbm_neonturf_stats_v1`, `mbm_relicforge_fracture_settings_v1` |

**The convention keys on the GAME'S NAME, not its directory**, and one case
proves it outright: Fracture Engine is published at `/fracture/` and saves to
`mbm_relicforge_fracture_v1`. Lumina Haven is at `/luminahaven/` and saves to
`mbm_lumina_haven_v2`.

`mbm_global_games_v1` is therefore **already on-convention** — `mbm_` + the
game's own name (it calls itself Global Games in its `<title>` and its meta
description) + `_v1` — and the collision census found no `mbm_global_games*`
anywhere in site, Games or Lessons. **The condition evaluates false and the
rename does not fire.** Renaming it to match a directory name would make the key
disagree with the game's own name, which is the R4 family of error, and would be
a change with no defect behind it.

Recorded deliberately, so a later audit does not "fix" a key that is correct.
The window genuinely was open — there is no `/olympics/` on the live site and no
save can exist — which is why this is a ruling rather than an R6 refusal.

## Reduced motion: the finding is sharper than "CSS-only"

The brief said RM is CSS-only with 0 `matchMedia`. Both true. The measurement
that matters is worse: **the CSS block is very nearly vacuous in this game.**

| | count |
|---|---|
| `@keyframes` in the file | **0** |
| `transition:` declarations | **2** |
| canvas effect families | **4**, all ungated |

Every piece of real movement — the crowd shimmer, the particle bursts, the
ceremony confetti, the ambient runners and rotating rings — is drawn on the
canvas, where `@media(prefers-reduced-motion)` cannot reach it. Reduced motion
was honoured almost nowhere it mattered.

**Repaired with OS-as-floor in JS, gated by NAME.** `Motion.allows(family)`
throws on a name outside the list, so the list cannot rot into decoration, and
`window.__olympics.motion` reports per-family state so a gate can assert about
it. A live `change` listener applies a mid-session preference change without a
reload (proven: `osReduced false -> true`). There is deliberately no in-game
control that switches it back off.

What each family does when refused is not uniform, and should not be:

| family | refused behaviour |
|---|---|
| `crowdShimmer` | time term dropped — a still photograph of a crowd, not an empty stand |
| `ambientDrift` | runners and rings hold a pose **staggered by index**; freezing all six at phase 0 reads as a glitch |
| `particleBurst` | emits nothing; the audio cue, HUD status and announce all still fire |
| `ceremonyConfetti` | emits nothing; the ceremony keeps its fanfare, podium and announcement |

## Flash census — and the first run was a vacuous RED

`tools/measure_olympics_flash.mjs`, all nine engines plus the ceremony, both
motion states, deterministic 60fps virtual clock, whole-canvas luminance.

The analyser is **the estate's shared one**. It was `measure_hearth_flicker.mjs`'s
private signal maths until this sitting; a second game needing a census meant
either copying it or sharing it, and copying is how two standards start. It now
lives in `tools/flicker_analyse.mjs`, imported by both. Nothing about the method
changed in the move, and the hearth instrument's self-test still recovers the
same known rates afterwards — 2.75 / 1.25 / 2.75 / 2.75 / 0 — which is how the
extraction was verified rather than assumed.

**The first run failed five scenes at up to 17.4 Hz, and every one was noise.**
The prominence threshold is proportional to the signal's own range — right for
measuring a waveform, wrong for judging one that has none: at a peak-to-peak of
0.086 units out of 255 the threshold falls to 0.004 and 8-bit jitter counts as
peaks. The tool's own non-vacuity check flagged those same scenes as "did not
move" *in the same breath as failing them*, which is the tell — a row cannot
prove nothing and prove a hazard at once.

Repaired with **two floors, because there are two questions**, rather than one
number nudged until things pass:

| floor | value | derived from | answers |
|---|---|---|---|
| meaningful | 2.0 units (0.8%) | the observed gap — scenes cluster at 0–0.305 and at 3.41–38.4, an order of magnitude apart | is this a measurement at all? |
| hazardous | 25.5 units (10%) | the flash guidance the estate's 3 Hz rule comes from | could this modulation be the hazard? |

**Measured (full motion):**

| scene | peaks/s | peak-to-peak | verdict |
|---|---|---|---|
| sprint | 0 | 23.13 | under ceiling |
| hurdles | 0 | 16.33 | under ceiling |
| swimming | 0 | 38.44 | under ceiling |
| longJump · javelin · archery · curling · weightlifting · skiJump | 0–17.4 | 0–0.305 | below the noise floor, no verdict possible |
| **ceremony** | **9.8** | **3.41 (1.34% of range)** | over the rate ceiling, **7.5× under the hazard floor** |

Every scene reads **not busier** under reduced motion, and the ceremony reads
**0 / 0 / 0** — a photosensitive player with the OS preference set gets a
completely static medal ceremony.

**The ceremony reading is reported, not buried.** It modulates faster than the
3 Hz ceiling at an amplitude far below what flash guidance concerns itself with.
Two honest caveats travel with it: whole-canvas mean **dilutes a flash confined
to part of the frame**, and only 4 particles were still live at the end of the
sample window. A locus pass — the hearth instrument's automatic
highest-variance-region method, not yet ported here — is the named condition
before anyone calls the ceremony settled.

**The control is what makes any of this count.** An injected full-screen 10 Hz
strobe is caught at **9.8 Hz / 128.36 units**. The floors did not switch the
gate off; the gate is shown biting at 5× the hazard floor in the same run.

## aria: the channel existed, the coverage did not

The brief called aria "thin at 15". Measured: **18 aria attributes**, and an
`announce()` channel that already existed at line 989. The real gap was
coverage. Before this sitting it announced event start, pause/resume, and
completion with place and score. It did **not** announce medals, personal bests,
benchmark badges, championship points, the standings screen at all, or the
ceremony at all — the standings screen existed only for people who could see it,
and the ceremony is the payoff for nine events.

All now announced, and gated (O13) with a control proving the matcher can miss.

## Splash: classified, then built to the canon contract

Derived, not assumed:

- Global Games carried **0** occurrences of the `mbm-splash-inline` marker.
- The ten marker-carrying games all live in `Lessons/Games`.
- **No site-published game carries the marker at all** — fracture, neonturf,
  luminahaven and auroralinks each ship a bespoke start screen certified by
  nothing.

So neither existing pattern was what the order asked for. The synthesis: the
**visuals are the game's own** (its palette tokens, and the three concentric
arcs its `renderAmbient()` already draws — deliberately *not* five interlocking
rings, which are an IOC mark), while the **contract is the canonical one**,
class names and hardening included, so the canon verifier judges it as a real
target rather than a parallel checker judging it alone.

`tools/verify_games_splash.mjs` only ever read one directory, so a site-repo
game could not be a target. It now takes `SPLASH_SCOPES` — **the scope became
configurable and the standard did not.** Marker-based derivation is untouched;
the default scope reproduces the historical behaviour exactly.

**Result: 396/396 splash gates over 11 targets** — the ten pre-existing games
(proving the scope change broke nothing) plus `site/olympics/index.html`. The
gate's self-test was run against Olympics specifically (`SELF_TEST_TARGET`), and
with the hardening stripped the skip key leaks (`keydown 0->1`) — so its green
on this game means something.

## Stills — and two of them were wrong until they were opened

`tools/render_olympics_stills.mjs` writes four files, all deterministic (virtual
clock, same command, same pixels) and all inside the 500 KB poster-still rule:

| file | size | what it is |
|---|---|---|
| `banner.png` | 311 KB | og:image — composed title card |
| `thumb-ceremony.png` | 443 KB | candidate 1 — the medal podium, confetti falling |
| `thumb-sprint.png` | 457 KB | candidate 2 — the 100m at 83.8 m, 12.9 m/s |
| `thumb-skijump.png` | 450 KB | candidate 3 — the ski jump in flight |

**The banner was unusable twice before it was usable.** The first version
pointed a 1200×630 viewport at the game's own title screen and wrote the result:
the HTML menu laid out for a taller window, with the heading sliced off the top,
the stat column running off the right edge and the buttons cut through the
middle. It was 413 KB and named `banner.png` and there was nothing in the tool's
output to suggest anything was wrong. Only opening the file showed it — which is
the death-screen lesson exactly, and the reason the inspection step is not
optional. Checking what the estate actually ships settled the shape: fracture's
banner is a purpose-built card, not a frame of play. The rebuilt card then came
out at **528 KB and the tool refused to write it**, which is what the rule is
for; three stacked gradients were the cost, and removing two brought it to
311 KB rather than raising the limit.

**The sprint thumbnail said FALSE START.** The render script began tapping at
frame 0, inside the 3.2s starter countdown, so a perfectly good race carried a
`+0.40 s` penalty across it. It now waits for the gun, polled, like the harness
does.

## Five defects found in this sitting's own instruments

Recorded because the harness is an instrument and an instrument that has only
ever been green is an opinion. Every one of these produced a confident,
plausible, wrong reading first.

1. **Eight corrupted-save cases reported "never booted"** — which looked exactly
   like eight defects in the game. `page.addInitScript` takes `(fn, arg)`; the
   harness passed `[fn, arg]` as one argument and Playwright threw on every
   case. One defect in the harness wearing eight game-shaped costumes.
2. **"The game ignores keyboard input"** — sprint opens on a 3.2s starter
   countdown (freestyle 2.6s) during which `update()` returns early and input
   only earns a false-start penalty. Forty keystrokes fired inside it measured
   `speed 0 -> 0`. The harness now waits for the gun, polled, like a player.
3. **"The game is frame-rate dependent"**, twice, for two different reasons.
   First: the loop compared `__virtualNow()` — absolute, already seconds in from
   pumping the boot — against a 3000ms *duration*, so at 30fps it ran zero
   iterations and at 144fps it ran fully. Then: `while (now - mark < 100)` looks
   rate-neutral and is not — at 144fps a frame is 6.944ms so the chunk overshoots
   to 104.2ms, while at 30fps three frames land on 100.0ms exactly. Thirty chunks
   of that put 67ms between the runs. Fixed by deriving frame COUNTS from the
   step. Final drift: **0.0083s, exactly one `FIXED_DT`**, against a
   variable-timestep control that drifts **9.47s**.
4. **"The ceremony never announces the podium"** — `announce()` clears the region
   and writes on the next animation frame, and the harness read the channel the
   moment `FINAL` appeared. It was not unspoken, it was unspoken *yet*. Fixed by
   polling for quiet rather than polling for the string the assertion is about,
   which would have guaranteed its own green.
5. **A control that would have failed for the wrong reason** — the "input moves
   the world" gate's control originally ran an idle wait *after* the tapping.
   Sprint speed decays every frame, so it would have gone red on decay rather
   than on anything to do with input. It runs before, from a standing start.

---

# THE PARK — derived conditions for the next sitting

Everything below is measured, not remembered.

## O-P3 groundwork (publish)

- **Manifest**: `Games/games.json`, `{title, strap, games}`, **45 entries**.
  Fields: `icon, title, desc, href, tag, hue, featured, hero, art, collection`.
  **There is no `dateAdded` field** — Stage H's backfill is genuinely needed.
- **Sole `NEW · ` holder**: `NEW · Relicforge: Fracture Engine`. The transfer to
  Olympics is atomic per the recency convention.
- **Sports rail**: 6 members — Apex Kick, Apex Pool, Apex Golf, Apex Tennis,
  Apex Rally, Aurora Links 3D. Olympics joining derives **SEVEN**.
- **Head furniture**: canonical + og block added, matching the pattern derived
  from fracture/neonturf. `og:image` points at `olympics/banner.png`, rendered
  deterministically in the same commit — the real-asset rule is satisfied rather
  than promised. Neighbour banners are 220–439 KB, all inside the 500 KB rule.
- **Copy source for the shelf blurb (R4)**: the game's own `EVENT_META`
  descriptions and its `<title>`/meta description. Nine events across the
  categories it names itself: Track, Field, Aquatics, Precision, Ice, Strength,
  Snow.

## Stage T groundwork — and the mechanism is NOT what the brief implies

The brief says *"existing Sports (7 incl. Olympics) and RPG (2) memberships"*, as
though both are rails of the same kind. **They are two different mechanisms**,
and `games/index.html` is explicit about it:

| rail | membership derived from | renders when |
|---|---|---|
| Sports | `g.collection === "Sports"` | ≥1 member |
| Action RPG | `/\bRPG\b/.test(g.tag)` | **≥2 members** |

`collection` exists on 6 of 45 entries and nowhere else. "RPG rail 2" is a **tag
match**, not a collection. The RPG rail already implements the ≥2-member rule the
order asks for, and its own comment records why it is derived: *"a hand-kept
membership array is the exact defect the sports gate was repaired for."*

**The binding constraint**: `tools/verify_sports_rail.js` gate S1 is *"one rail
mechanism, not two — membership is the `collection` field"*, and it carries an
anti-rival assertion that fails if any entry grows a `section`, `rail`,
`category`, `categories`, `group` or `collections` key. So Stage T must extend
`collection` and must not introduce a third field. Whether the eight-rail
taxonomy also folds the tag-derived RPG rail onto `collection` is a real design
decision with a live gate attached to it, and it is the first thing the next
sitting has to settle.

## Stage H groundwork — PR #25, measured

Protocol requires the conflict count before and after. Measured locally with
`git merge-tree --write-tree` against `origin/main`:

| | conflicted files | conflict hunks |
|---|---|---|
| **before** | 1 (`index.html`) | **1** |
| **after this sitting's branch** | 1 (`index.html`) | **1** |

**Unchanged.** This branch adds `olympics/` and `tools/` and touches no root
`index.html`, so it cannot move the count — and the reading confirms it rather
than assuming it.

One correction worth carrying: **the PR #25 body says "2 pre-existing
conflicts"; the measurement says 1 hunk in 1 file.** PR #25 itself was not
touched, rebased, resolved or closed.

## What is NOT claimed

- O-P2 graphics bands: **not started.** No before/after fps figures exist, so
  none are quoted.
- The trailer video: **not started.** Three thumbnail candidates and the og
  banner ARE rendered, deterministically, and are real files on disk.
- Stage T: **not started.** No game has been classified; the 46-row table does
  not exist.
- Stage H: **not started.** No `dateAdded` field has been added or backfilled.
- The nine engines have been driven, resolved and measured, but **no human has
  played this on a phone.** That remains a human item and nothing here
  substitutes for it.

**The estate is not clean.**
