# Session close — `neonsync-land-2026-08-04`

Sentinels in scope: `neonsync-land-2026-08-04`, `apexgolf-build-2026-08-04` (rev 5).

Everything below was **derived by a command run this session**. Where a figure
could not be measured, it says so rather than being estimated.

---

## L.6 readback — five lines, each derived

```text
1  Neon Sync ships at /neonsync/       56,658 B  c645e6f3f56a5884c23656dc82be49bc20e333ebc379ea098341886327832602
                                       byte-identical to delivery, zero edits, and IDENTICAL as served live
2  Apex Golf ships at /apexgolf/       71,334 B  4da199bcea20fc43781680b6d67ff84f3ac7c010ee9dcac479b2132cf70f86ef
                                       the fourth rung of the ladder, and IDENTICAL as served live
3  C1 as served                        13 doors, 7 in the games zone, Apex Golf holds NO door
4  New Release occupant as served      "Neon Sync", found in the hardcoded no-JS markup
5  Held work untouched                 PR #25 open, unmerged, head still 7c202790
```

### The hash ladder, all four rungs

| Rung | Bytes | sha256 | What it added |
|---|---|---|---|
| 1 | 64,513 | `c0701ee1…` | the previously deployed build |
| 2 | 65,195 | `7c66a2a2…` | ε given real discriminating power |
| 3 | 69,327 | `18b28e49…` | A-3 panel fix at ≤400px |
| 4 | **71,334** | **`4da199bc…`** | **D5 — A-3 extended to tablet and desktop** |

Rung 4 is what is live.

---

## The decisions, and what happened to each

| | Decision | Outcome |
|---|---|---|
| **D1** | Part B carries `tag=Strategy`; the Team mint withdrawn | recorded in `reports/neonsync/PART-B-games-manifest.md`; card artefact ready at 4,833 B |
| **D2** | Locate the delivered harness, else the pre-authorised fallback | **fallback taken** — see below |
| **D3** | `apexpool-home-verify.yml`: derive, do not re-pin | landed in **#49** |
| **D4** | Merge order | followed: #47 → #48 → #50, with three gate fixes interleaved where they blocked |
| **D5** | Extend A-3 to tablet and desktop | landed in **#50**, fourth hash recorded above |
| **D6** | Merge the Golf branch at a green tip | landed in **#50** at 5/5 green |

---

## D2 — REPLACEMENT, NOT DELIVERY

The build's own `tools/verify_neonsync.js` was **never supplied**. Both hashes are
named wherever this is recorded:

| | bytes | sha256 |
|---|---|---|
| DELIVERED — **never measured by anyone** | 13,637 | `6b5cbb9da0f41a4f72e6abdeaf5deeb8ae870c0fcc380b31f0f45c9225cb2369` |
| REPLACEMENT — what is on `main` | 17,765 | `a3cb9f0cfb4c901017a7e0ce7d372646caad3138c3716c919d587b1c7ddfad59` |

Its reported 149/149 is the build's claim about a file nobody has held. It is
recorded as a claim and is **not** reproduced.

**SUPERSEDE CLAUSE.** If the original surfaces and hashes exactly `6b5cbb9d…`, it
replaces the replacement in its own commit, both hashes named. The
evidence-bearing artefact always wins. The workflow already implements this: G-A2
**derives** which artefact it holds and labels the run DELIVERED or REPLACEMENT.

Measured: **83/83** source checks, **6/6** tampered copies rejected. The tamper
self-test runs **before** the contract, so a green contract is only ever reported
by a harness that has just proved it can fail.

---

## Nine instances of one defect shape

The recurring estate defect is **two copies of one truth, either able to change
without the other**. Nine were found and fixed this session. They are listed
together because nine is a pattern, not nine coincidences.

| # | Artefact | Frozen copy | Fixed in |
|---|---|---|---|
| 1–3 | `arcade-sports-verify.yml`, home doors baseline, `verify_apextennis_home.py` before/after side | pinned SHA, `doors.length!==12`, "main is the before state" | earlier + **#49** |
| 4 | `apexpool-home-verify.yml` mutation family 3 | `missing-golf-sibling` | the Golf branch |
| 5 | `verify_apextennis_home_browser.js` | 14 doors, 8 cards, a required Golf door, `data-release="Apex Pool"` | **#51** |
| 6 | `verify_home_doors_baseline.js` call site | the 12-door baseline | **#49** |
| 7 | `verify_apextennis_home.py` | occupant pinned to Apex Pool; whole section byte-frozen | **#52** |
| 8 | `apexpool-home-verify.yml` fixture `new-release-takeover` | searched for a tenant that had moved — **went inert** | **#53** |
| 9 | `agx1-live-verify.yml` caption | printed the pre-D5 Golf figure | proved in **#54**, landed here |

**#8 is the instructive one.** It was a *guard against* this shape that had
acquired the shape itself: a mutation fixture written against a literal. When the
tenant moved, the fixture edited nothing, the validator correctly accepted an
unmodified file, and the run failed **blaming the validator**. A green
non-vacuity step and a red one can both be produced by a fixture that never
fired. `reject()` now refuses to score any family that changed nothing.

---

## Things found by measuring that reading would have missed

**Four of my own harness assertions were wrong**, and were corrected against the
game rather than the game being doubted:

- `canvas-2d-present` — the game calls `getContext('2d',{alpha:false})`; the
  regex demanded an immediate close paren.
- `no-external-stylesheet` — matched the legitimate `rel=canonical` href.
- `pointer-360-maps-to-centre` — the real signature is `pointerMap(x,y,rect,canvas)`;
  `C.W`/`C.H` were passed as two extra args so both axes read `undefined`.
- `zero-elimination-not-required` — `>= 80` was an **invented threshold**,
  replaced with what is actually derivable: eliminations are **not a term in
  `synergyRating` at all**, and a zero-damage zero-elimination line reaches the
  top band (95, Neon Sync).

**The tamper self-test had a vacuity hole of its own.** With four failing checks
in the baseline, every tampered copy was "rejected" for free — the 6/6 proved
nothing. It now runs a positive control first: the untampered copy must pass with
zero failures or the self-test **aborts**. That abort path was proved to fire.

**The door-agreement limbs are partly tautological, and this is stated.** The
door DOM is generated *from* `site.json`, so asserting the rendered href matches
`site.json` is circular. Measured: mutating a door's href to a non-existent path
left every agreement limb green. A non-circular limb was added — targets must
resolve — and its first cut was *also* blind, because a typo is equally absent
from the repo and merely landed in the "served from elsewhere" bucket. The
discriminator is the base branch.

**A racy gate was stabilised.** `js-off-no-horizontal-overflow` measured layout
at `domcontentloaded` and read 419/390 once in ~4 runs.

---

## Live verification — measured in CI, PR #54, closed unmerged

The container cannot reach `madebymatt.uk` — the proxy answers `403` on
`CONNECT` — so CI is the only channel that can see production. PR **#54** was
opened to carry the run and **closed unmerged**, its correct terminal state.

```text
game                 live_bytes  repo_bytes  live_sha256                                                       match
neonsync                  56658       56658  c645e6f3f56a5884c23656dc82be49bc20e333ebc379ea098341886327832602  IDENTICAL
apexgolf                  71334       71334  4da199bcea20fc43781680b6d67ff84f3ac7c010ee9dcac479b2132cf70f86ef  IDENTICAL
apextennis                59852       59852  8e109ab5…  IDENTICAL
apexpool                  88751       88751  4de1383f…  IDENTICAL
apexkick                 162122      162122  541697f7…  IDENTICAL
biopunkhive               76841       76841  f129e84b…  IDENTICAL

served site.json : 13 doors, 7 in games, 0 Apex Golf door(s)
repo   site.json : 13 doors, 7 in games, 0 Apex Golf door(s)
PASS C1 holds as served

served occupant(s): ['Neon Sync']    repo occupant(s): ['Neon Sync']
PASS live JS-off homepage serves "Neon Sync", matching the tree
```

`/neonsync/` had **never been fetched by anyone** before that run.

**The door census had to be added mid-run rather than inferred.** The first pass
proved the bytes and the occupant, but it only proved `site.json` returns **200**
— and a 200 is not a census. The served homepage could not stand in either:
doors are rendered by JavaScript, so `apexgolf/` occurrences read **1 both before
and after** the ruling, a figure that cannot distinguish the two worlds.
Reporting "doors 14 → 13 confirmed live" on that evidence would have been a
claim, not a measurement.

## What was NOT verified, stated plainly
- **`codex/neonsync-build` could not be "closed as superseded" — there is
  nothing to close.** The branch points at exactly `4afd3485`: zero commits
  ahead of the pre-session `main`, zero tree diff, and **no pull request from it
  in any state**. No PR was invented to close. The branch was not deleted.
- **Part B has not landed.** It needs a `Games`-scoped session; only the card
  artefact and the manifest patch live here.
- **The phone eyeball is not substitutable** by anything in this report.

### One latent instance left, named not fixed

`apexpool-home-verify.yml` line 45 pins Apex Tennis's hash
(`8e109ab5…`) as an entry condition. It is correct today and blocks nothing, so
it was left alone rather than widening the change — but it is the same shape and
will bite the day Tennis changes.

---

## Standing constraints, each checked

```text
never force-push                       no force-push occurred
never rewrite or commit to main        every change went through a PR
never touch #25                        open, unmerged, head 7c202790, updated_at unchanged from 2 Aug
never merge/close a PR I did not open  every PR merged this session was opened this session
never delete a branch I did not create no branch deleted, including codex/neonsync-build
site.json vs Phase L                   Part C touched neither index.html's doors nor site.json;
                                       the Golf/site.json collision was impossible by construction
```

## Audience brief — census with controls

Across the five Neon Sync surface files (**97,724 B**), all sixteen forbidden
terms return **0**: "for girls", "girl gamer", "girly", girl/boy, she/her/he/his/him,
woman/women/man/men, ladies, guys.

A zero from a grep that cannot match is worthless, so the census carries
controls: `teammate` → 5, `sync` → 25, `endorse` → 14, and a nonsense token → 0.
The zeros discriminate.

---

## Merged this session

```text
9c4aea5  #49  Derive the homepage doors baseline instead of pinning it
2d40cdc  #47  Part A — land Neon Sync at /neonsync/
c91a0b5  #51  Derive-fix the homepage browser gate — the fifth pre-C1 artefact
70f6414  #52  Stop freezing the New Release tenant — the seventh pre-Part-C artefact
c8f64fc  #53  Mutation fixtures must bite — derive the tenant, detect inert fixtures
9868245  #48  Part C — Neon Sync takes New Release; Apex Pool keeps its Sports card
013d40d  #50  D6 — land Apex Golf with the C1 door ruling and the A-3 panel fix
```

`#54` is **verification-only** and landed **closed unmerged** by design, per the
pattern established by site#42. Closed-unmerged is its correct terminal state.

Its three **durable** improvements to `agx1-live-verify.yml` would have died with
the branch, so they land here instead: `/neonsync/` added to the surface list and
the byte comparison, the live `site.json` door census, and the derived captions
that replace the frozen pre-D5 figure. The *run* was throwaway; the *gate* is not.

---

## Still Matt's

1. **Phone-check `/neonsync/` — joystick first.** No gate replaces this.
2. **Phone-check `/apexgolf/`**, now that D5 is live.
3. **Part B**, in a `Games`-scoped session, with the `tag=Strategy` patch.
4. **Estate visuals Phase 2**, in a `Lessons`-allowlisted session.
