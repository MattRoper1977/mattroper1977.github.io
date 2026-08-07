# Estate finish — Stage L complete, Stage V-P1 complete, remainder parked
**7 August 2026 (afternoon sitting).** Every figure below was derived at the
SHAs named. Nothing is quoted from the order as fact.

---

## §0 · Gate

**Floors, via `ls-remote`, all three exactly at the stated minimum:**

| repo | floor | observed | |
|---|---|---|---|
| Lessons | `aad7b50` | `aad7b50` | at floor |
| Games | `4a1445c` | `4a1445c` | at floor |
| site | `79fb490` | `79fb490` | at floor |

**A correction to the order, found before any work.** §0 names
`reports/2026-08-07-stage-O-complete-and-PARK.md` as in-repo and says to read
it first. **That file does not exist in any of the three repositories.** The
newest report on Lessons is `reports/close/2026-08-07-G1-fracture-league-PARK.md`
and Lessons' HEAD commit is the splash-gate-scopes merge, not Olympics work.

This looked at first like the Olympics stage had not run. It had — the publish
landed in the **site** repository, not Lessons, which is why Lessons' log shows
no trace of it. `/olympics/` is present on site main and the shelf entry is
live. The park report is simply missing; the state it described is real. Work
proceeded against the derived state rather than against the absent document.

**§0.2 expected state — derived, and every value matches:**

| claim | derived | source |
|---|---|---|
| shelf 46 entries | **46** | `Games/games.json` |
| sole NEW· holder `/olympics/` | **1 holder, `/olympics/`** | title prefix `NEW · ` |
| Sports rail 7 | **7** | `collection === 'Sports'` |
| RPG rail 2 | **2** | tag `Action RPG`, still regex-derived |
| sitemap 454 | **454** | `<loc>` count |
| `collection` one value in use | **Sports only, 7/46** | 39 entries carry no collection |
| no `dateAdded` anywhere | **0 occurrences** | |

The marker is a **title prefix**, `NEW · ` with spaces around a U+00B7, not a
separate field. Worth stating because the arcade's card renderer strips
`/^NEW\s*·\s*/` from `desc` and not from `title`, so the marker is deliberately
visible on the card.

**§0.3 · PR #25, measured by local merge-tree before any manifest work:**

```
CONFLICT (content): Merge conflict in index.html
files: 1    hunks: 1
```

Baseline **1 file / 1 hunk**, as stated. #25 was not touched. **No manifest
work was performed this sitting** — `Games/games.json` is byte-identical to
where it started — so there was no second measurement to take; the baseline is
also the closing figure.

**Attachment gate.**

| attachment | expected | observed | outcome |
|---|---|---|---|
| `Vector_Overdrive_Nova_Siege.html` | `fdea1b06…`, 103,536 B | **`fdea1b06fb3c00fd1527ce81c0d0c38297f0ea6018547853e97a1830ddb98f92`, 103,536 B** | exact — **Stage V runs** |
| `Ouroboros_Chronos_Unbound.html` | `e412d8d5…`, 189,516 B | **absent** | **Stage U parks** |

Only one file was attached. Per the attachment rule, Stage U parks in full and
everything else runs. This cascades into Stage V's derived numbers and they are
restated in the park section rather than carried from the order.

---

## §L1 · Olympics live leg — **CLOSED**

Run **31181140054**, both jobs green.

The container cannot reach the custom domain (the proxy answers 403 on
CONNECT), so CI is the only channel that can see what the world is served.
Two new instruments:

- `tools/verify_olympics_live.mjs` — nine limbs
- `tools/verify_olympics_live_selftest.sh` — its negative control
- `.github/workflows/olympics-live-verify.yml` — control job first, live job
  gated behind it

**The count is derived from main's blob, never pinned to 46.** The day a game
ships, this instrument needs no edit. That is the same rule the sports rail was
repaired for and the same one AGX-1 is repaired for below.

**It measures rendered reality, not DOM nodes.** `appendChild` of 46 cards
proves nothing about what a person is shown, and node counting is what produced
two false defects last run. The limb counts cards that occupy real space and
cross-checks the human-visible countline.

Its negative control is the sharpest thing in this sitting. It serves a page
where all 46 cards **are** in the DOM and CSS collapses them:

```
ok    46 cards appended, none rendered -> red on arcade-renders-shelf
      (measured 0 rendered against a DOM holding 46 — node counting would have passed)
```

All nine limbs proven able to exit non-zero from a green baseline before any
green was accepted.

**Two instrument traps hit and fixed, both worth the register:**

1. **ESM ignores `NODE_PATH`.** Playwright is now located by asking node where
   it actually resolves to, because CI installs it into the repo and this
   container carries it globally — a hard-coded path works in exactly one of
   those and fails silently in the other.
2. **`( … ) &` hands back the subshell's PID.** The `kill` landed on the
   subshell, python kept the port, and a stale server from an earlier run
   served a since-deleted fixture to the next run — as a false red, which is
   exactly the failure mode this instrument exists to avoid. Servers are now
   started directly on a free port with their own PID tracked.

**The first dispatch failed and it was not the estate.** The live job checked
out main over the working tree, so `tools/` — which only exists on the branch —
was absent and node died on `MODULE_NOT_FOUND` in under a second. A broken
instrument reporting as a failed live leg. Two trees now: the instrument from
this ref, the bytes it compares against from main. The re-dispatch closed
clean, so the order's expectation ("should close on the first dispatch") held
for the estate; the one wasted run was mine.

---

## §L2 · AGX-1 — **stale pin, converted to derived** (outcome b)

**What AGX-1 is.** `.github/workflows/agx1-live-verify.yml` on the site repo: a
read-only live-verification workflow that fetches production, hashes it and
compares it to the committed tree. It triggers on `pull_request` to main, which
is why it runs — and failed — on every branch.

**The failing assertion, quoted from run 31176825563:**

```
  served occupant(s): ['Relicforge: Fracture Engine', 'Neon Sync', 'Neon Breach']
  repo   occupant(s): ['Relicforge: Fracture Engine', 'Neon Sync', 'Neon Breach']
  FAIL committed tree carries an unruled New Release occupant: ['Relicforge: Fracture Engine']
```

**Served and repo are byte-identical to each other.** The live homepage and the
tree agree perfectly. Nothing was ever wrong with the estate.

**Root cause.** The limb carried `RULED_OCCUPANTS=['Neon Sync','Neon Breach']`,
a membership list frozen 5 Aug, sitting next to the ruling it was pretending to
be. Relicforge's homepage box landed legitimately on **6 Aug** in `0b6caa9`
("Fracture Engine Pass 4: card art, the RPG rail, and the homepage box"). The
run history breaks exactly there — `31105504022` green, `31118184732` red, and
every run since red. Tenth pin instance in this estate, **second in this exact
limb**: it had already been repaired once, from a `len(r)!=1` single-tenant
assertion, and was repaired into another pin.

**Repair.** An allowlist that must be hand-edited every time a game ships is
not an invariant, it is a scheduled outage. An occupant is now legitimate iff
it **names a game actually on the served shelf**, with the NEW· prefix stripped
because the marker rides on the shelf title and not on the homepage box. A
typo, a phantom, or a box for a game that never shipped still fails; a game
that legitimately launches passes with no edit.

The durable half of the ruling — *each game holds at most ONE box* — is kept
and still asserted. **Two vacuous-pass holes** found while rewriting are now
closed: an empty shelf and an empty occupant stack both used to sail through,
the same trap the `site.json` step already guards against.

**Five negative controls, each proven to exit non-zero before the green was
accepted:** off-shelf occupant (`AGX1_SELFTEST=occupant`, built in), empty
shelf, empty stack, duplicate box, unreadable manifest. Green path exits 0
against the very tree that was failing, deriving 46 shelf titles.

---

## §V-P1 · Vector Overdrive: Nova Siege — audit and repair, **complete**

Gate: `tools/verify_novasiege.mjs`, **38/38 limbs**, two negative controls.
Runs against the shipped file, not an extracted copy. `115,708 B` against the
200 KB budget.

### What the commissioned audit got right

| finding | verdict | repair |
|---|---|---|
| gamepad claim is FALSE | **confirmed — 0 `getGamepads`** | real support implemented |
| flash ungated | **confirmed** | routed through one RM-gated `screenFlash()` |
| RM read-once, no listener | **confirmed** (line 333) | live listener + floor on every apply |
| FX toggle flips below the OS floor | **confirmed** | toggle may strengthen, never weaken |
| `<title>` lacks the suffix | **confirmed** | added |
| no canonical/og | **confirmed** | added |
| `merge()` takes any object; `submit()` floors unchecked | **confirmed** | one sanitising door for both |
| splash is canonical v2 | **confirmed — first arrival in the estate** | see drift below |
| fixed timestep already real | **confirmed** | agreement check run anyway |

### Two commissioned findings that did NOT hold

Reported rather than "fixed", because inventing a defect is the same error as
missing one, and this estate has already paid for two false defects.

1. **There is no white boss-phase `flashAlpha` burst.** The file contains
   exactly **one** `flashAlpha` assignment — `.7`, red, in `damagePlayer`. The
   white boss-phase effect is `spawnExplosion(…,'#ffffff',48,true)`, a particle
   burst which **was already** `reducedFX`-thinned. One ungated full-screen
   flash existed, not two.
2. **DPR-aware rendering is already real.** V-P2 B1's headline item is done:
   `resize()` sets `DPR=Math.min(2,Math.max(1,devicePixelRatio||1))`, sizes the
   backing store by it and applies `setTransform`. No work was needed and none
   was invented.

### Splash — first canonical-v2 arrival, with one drift

Donor `assets/brand/mbm-splash.js` verified **unmoved** at
`e375642c631358c6753a93c5e410742af2ad49c26634d0428352ec75ed87bc4c`.

The inlined copy is the donor reformatted (line-joining, harmless) plus **one
substantive difference**: `min-height:44px` on the skip button.

The rule is *live donor wins on any drift*. The drift is an **accessibility
hardening**, and this stage's own sweep requires a 44 px census. Reverting it
would knowingly degrade a touch target to satisfy a byte rule. **Kept, and
raised as a donor defect instead**: the donor is behind, and raising it would
give every splash user the same 44 px target. That change touches all splash
users and the splash gate's target set, so it is **parked as a proposal**
rather than made here. The 44 px census passes in all four states with the
drift in place.

### Repairs, and the reasoning that shaped them

**Flash.** Every full-screen flash now goes through `screenFlash(alpha,color)`,
which returns early under `reducedFX`. A single gated entry point means a later
call site cannot reintroduce an ungated flash by assigning `flashAlpha`
directly — and the gate asserts exactly that, by reading the source for
surviving direct writes. A gate everyone bypasses is not a gate.

The census measures **what reached the canvas**, not what was requested: a
`flashPeak` tracker updates in the paint path. Under reduced motion the probe
paints `0` and the peak stays `0`; with no preference the same probe paints
`0.7`, which is what stops "suppressed everywhere" passing as a false green.

**Reduced motion.** The OS signal is a floor re-applied on *every* apply, so no
path — toggle, restored save, or live OS change — leaves the game above the
OS's wishes. The listener is attached **immediately after** `applySettings`,
never above it: that is the temporal-dead-zone trap this estate has paid for
three times. Flipping the OS mid-session is proven to comply with no reload,
and turning it back off restores the player's own stored preference rather than
forcing full effects on them.

**Gamepad.** Implemented rather than corrected away, because a twin-stick arena
shooter is the exact shape a gamepad is for. It writes the **same**
`leftActive/moveX/moveY` and `rightActive/aimX/aimY` fields the on-screen
sticks already set, so movement, aiming, firing and dashing go down one code
path — a second parallel input path is how aiming and dashing drift apart three
commits later. Radial-scaled deadzone (0.22) so a gently-pushed stick stays
usable and full deflection still maps to 1.0; d-pad as an equal alternative;
dash latched so holding it does not re-dash the frame the cooldown expires. It
does not yank a stick a finger is still on — the two methods coexist on a
tablet with a pad clipped to it.

**Leaderboard.** Anything off `BroadcastChannel` is another context's word. One
sanitising door now serves both `merge()` and `submit()`: non-finite scores are
**dropped, not repaired**, because a score that cannot be read as a number is
not a score. Probed with NaN, Infinity, `'9e999'`, an SQL-ish string, an object
whose `valueOf` returns NaN, a 200-character name containing a
right-to-left-override, `-Infinity` waves, NaN times, and five non-objects. The
board keeps no non-finite row, holds the top-10 invariant, keeps names ≤12
printable characters, and stays sorted — **and still accepts a legitimate
entry**, which is what stops "rejects everything" passing every assertion above
for the wrong reason.

The author's same-origin honesty note is correct and is preserved verbatim.
Nothing here promises cross-device play.

**Viewport.** `maximum-scale=1,user-scalable=no` removed. It blocked pinch zoom
outright — a hard accessibility failure — to solve a problem the play surface's
`touch-action` had already solved.

**Harness.** `window.VectorOverdrive` already existed and is real, so it is
**extended, not replaced**; `window.__vector` re-exports the *same* `selfTest`
rather than growing a second one that can drift from it. The built-in
`selfTest()` passes 29/29.

### Three instrument bugs caught by running the gate

All three were mine, all three would have been reported as defects in the game:

1. `pinch zoom not blocked` grepped the whole file and matched **its own
   comment** explaining that `user-scalable=no` had been removed. Now reads the
   viewport tag's content.
2. `offline` matched the `rel="canonical"` link **this stage had just added**. A
   canonical URL is a declaration, not a fetch.
3. The leaderboard probe passed a `valueOf` function across the Playwright
   bridge, which cannot serialise it. Hostile values are now built inside the
   page — passing only bridge-safe values would have quietly narrowed the probe
   to the easy cases.

---

## §Parks — with derived conditions

Ordered as the sitting ranked them: publishes outrank reorganisation, and an
honest park beats a thin completion.

**U — Ouroboros, all four passes. Blocked, not deferred.**
`Ouroboros_Chronos_Unbound.html` was not attached. Resumes when a file matching
`e412d8d5…` / 189,516 B is supplied. The two binding corrections still stand
for whoever picks it up: `window.OuroborosDebug` exists at line 1733 and must
be **extended, not duplicated**; the dev cheat is `grantAll()`, console-only.

**V-P2 — the three enhancement bands.** Not started. B1's headline item (DPR)
is already real, as derived above; the remaining work is bloom/trail/parallax
polish and per-class silhouettes (B1), arena events, boss intros and layered
music (B2), and draft/evolution/modifier depth on the existing threat-budget
engine (B3). Each band must be playable at its boundary and R7 re-run after it.

**V-P3 — publish `/novasiege/`. Numbers restated, because Stage U parked.**
The order's figures assumed Ouroboros publishing first. Derived for the actual
state:

| | order assumed | **derived now** |
|---|---|---|
| shelf | 47 → 48 | **46 → 47** |
| sitemap | 456 | **455** |
| NEW· transfers | Ouroboros → Vector | **Global Games → Vector Overdrive** |

Collection `Shooter` seeded; the rail renders only once Stage T establishes it
and ≥2 members exist. Hue must be derived at publish time (ΔE00 ≥ 10 against
the shelf *including* the Olympics red `#9c3b36`), and card copy leads
twin-stick / arena / wave-siege from the game's own strings — never
"Overdrive"- or "Siege"-led, this being the shelf's third "Overdrive" and
second "Siege".

The game sits in `_staging/novasiege/`, complete and gated, **not** at
`/novasiege/`. Red line R1: directory, shelf entry, sitemap line and marker
state land together or not at all. Jekyll excludes underscore-prefixed
directories, so nothing is served.

**V-P4 — media.** Not started. Note the head deliberately carries **no
`og:image`** and `twitter:card` is `summary`, not `summary_large_image`: the
real-asset rule says a tag joins when its file does. Both change in the same
commit as the banner.

**O-P2 / O-P4 — Olympics graphics bands and trailer.** Not started. The live
leg (L1) is closed, so O-fin's remaining work is unblocked and independent.

**T — taxonomy over the full shelf.** Not started. Note the shelf is **46**, not
48, while U and V are unpublished; T's table sizes itself to whatever the shelf
holds when it runs.

**H — homepage New Releases.** Not started. PR #25's baseline is re-measured
below and is unchanged, so H inherits a clean 1/1.

**Donor raise (new).** `assets/brand/mbm-splash.js` lacks the `min-height:44px`
its inlined copies carry. Raising it touches every splash user and the splash
gate's target set. Parked as a proposal.

---

## §Instrument register — additions

| instrument | binding it encodes | wrong-first reason kept |
|---|---|---|
| `verify_olympics_live.mjs` `arcade-renders-shelf` | measure rendered reality | its control serves 46 cards in the DOM with no box; node counting passes, this measures 0 |
| same, `shelf-count` | derive, never pin | expected count read from main's blob |
| same, script vs resource errors | one limb, one nameable cause | sharing them made the gate fail for reasons it could not name |
| `verify_olympics_live_selftest.sh` `serve()` | own your processes | `( … ) &` returns the subshell PID; a stale server served a deleted fixture as a false red |
| same, playwright resolution | resolve, don't guess | ESM ignores `NODE_PATH`; a hard path works in one environment and fails silently in the other |
| `agx1-live-verify.yml` New Release limb | membership is derived, not listed | tenth pin instance, second in this limb; an allowlist is a scheduled outage |
| same, empty shelf / empty stack | vacuous passes are not passes | both sailed through before |
| `verify_novasiege.mjs` flash limbs | assert on what was painted | a requested-but-suppressed flash must not count; and the no-preference limb stops "suppressed everywhere" reading as green |
| same, `no ungated flash writes` | a gate everyone bypasses is not a gate | source is read for surviving direct assignments |
| same, `legitimate entry accepted` | rejection is not sanitisation | a board that drops everything passes every hostility assertion |
| same, `pinch zoom` / `offline` | an instrument must not read its own prose | both matched text this stage had just written |

---

## §Close

PR #25 re-measured after all work: **1 file / 1 hunk**, unchanged. No manifest
work was performed, so `Games/games.json` is byte-identical to the sitting's
start and the shelf remains at 46.

No clean-estate declaration is made.
