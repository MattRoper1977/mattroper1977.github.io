# Estate finish, sitting 2 — Stage A closed, V-P2 B1 landed, remainder parked
**7 August 2026, resume order.** Figures derived at the SHAs named.

---

## §A — close-out and corrections

### A1 · L was NOT closed. It is now.

The resume order was right to doubt the previous readback. Derived at open:

```
origin/main                     79fb490
branch head                     82178a8   NOT MERGED
main's agx1 workflow            RULED_OCCUPANTS present — the pin was still live
```

The previous sitting reported "site branch 82178a8" without saying merged, and
it was not. The AGX-1 conversion was sitting on a branch, so **the fix was not
live and L was not closed**, exactly as A1 suspected.

Closed properly this sitting:

| step | evidence |
|---|---|
| PR #86 opened, all checks green | AGX-1 green in its real `pull_request` trigger, plus both Olympics jobs |
| merged on green | **`a1f0325`** |
| AGX-1 re-run **at the merge tip** | run **31183756795**, `main a1f0325` → **success** |
| pin gone from main | one `RULED_OCCUPANTS` mention remains, on line 196, inside a `#` comment; **zero live uses** |

L is closed on main and green there.

### A2 · RETRACTION — the park report exists, and my absence claim was false

`reports/2026-08-07-stage-O-complete-and-PARK.md` **exists on site main**: 208
lines, 10,725 B, added by `44ec6cb`, merged in PR #85 at `79fb490` — the exact
path the master prompt named.

Last sitting reported it "does not exist in any of the three repositories."
That was wrong, and the resume order's A2 was written to reconstruct an
artefact that was never missing.

**How.** The existence check ran in the **Lessons** repository at a point when
the site repository had not yet been cloned. It returned nothing — correctly,
because the file is not in Lessons — and that single-repository null was then
generalised in the writing-up to "any of the three repositories" and never
re-checked once the other clones existed. The file was in the working tree from
12:48 onward and was never looked at again.

This is the estate's own binding, broken by the run that was quoting it: **a
null result is evidence only about what was actually searched.** It is a worse
form than the usual one, because the search was not merely narrow — it was run
against the wrong subject, and its scope was widened afterwards in prose.

The order proposed a different failure class ("a readback can name a merged SHA
for content that is not in it"). That class is not what happened: PR #85 and
`79fb490` contain exactly what the prior readback said they contain. **The
readback was accurate; my absence claim was not.** Recording the wrong class
would have left the real one uncaught.

Nothing is reconstructed. The retraction is written into the sitting-1 report
in place, so the false claim cannot be read without its correction.

### A3 · The two findings that did not hold — accepted, with the register entry

Both confirmed by Matt's own re-measurement. Reported rather than "fixed" last
sitting, which was the right call.

- **`flashAlpha` has exactly one assignment.** The white boss burst is
  `spawnExplosion(…, '#ffffff', 48, true)`, already thinned ×0.35 under
  `reducedFX`.
- **DPR-aware rendering is already real.** V-P2 B1's headline item is **struck**
  and was not done.

**Register entry, Matt's:** *a devicePixelRatio measurement was carried from
Ouroboros, where the absence was genuine, across to a sibling file never
measured. A measurement is evidence only about the file it was taken from.*
The same suspicion was applied to every brief item this sitting — which is how
B1's real defect was found by measuring rather than by trusting.

### A4 · Splash — reverted to the donor

Matt measured what the previous sitting only asserted: `.mbm-skip` renders
**107×48 at 390×844, 844×390 and 1280×720, with and without** the added
`min-height:44px`. The padding already clears 44. The declaration changed no
rendered pixel, so there was no rule conflict — only a lost byte-identity, and
a ruling made on an unmeasured claim.

Reverted. The inlined splash is now **byte-identical to the live donor**,
`6a39c9ba1751…` on both sides, and a new gate limb `splash is the donor`
asserts it so it cannot drift again unnoticed. Nova Siege is the estate's first
canonical-v2 arrival and byte-identity is the whole point of that.

The donor raise is filed separately, on the narrower and honest ground that it
protects the reduced-root-font case. Not a V-P3 blocker.

**Register entry, mine:** *measure the cost before ruling a conflict real.* The
"accessibility versus byte-identity" conflict cost zero pixels and was never
measured; the ruling defended a number nobody had taken.

---

## §B — Stage U: PARKED AGAIN, on evidence

The order states "Attachments — all three, this time" and names Ouroboros as
the one that was missing. **It was missing again.**

Searched, rather than assumed absent — the A2 lesson applied immediately:

```
uploads dir                  1 file only: 34e74c46-Vector_Overdrive_Nova_Siege.html
find / -iname "*uroboros*"   no matches
find / -type f -size 189516c no matches, anywhere on the filesystem
uploads dir mtime            12:47 — unchanged since sitting 1
```

Per the attachment rule Stage U parks in full, a second time. Resumes on a file
matching `e412d8d5…0add` / 189,516 B. The two binding corrections still stand:
`window.OuroborosDebug` at line 1733 is **extended, not duplicated**;
`grantAll()` is console-only and stays unreachable from shipped UI.

---

## §C — Stage V

### V-P3 precondition: is `_staging/` served? **No — derived, not assumed.**

Jekyll excludes underscore-prefixed directories and this repo carries no
`.nojekyll`, so 404 was the expectation. An expectation is not evidence, so a
gate step now asks production directly. Run **31184255011**:

```
https://madebymatt.uk/_staging/                      404
https://madebymatt.uk/_staging/novasiege/            404
https://madebymatt.uk/_staging/novasiege/index.html  404
```

R1 is not breached from the other side; staged games are genuinely invisible.
The step fails on **anything** other than 404/403 — including a transport
error, because unreachable-for-unknown-reasons is treated as reachable until
proven otherwise rather than waved through.

The same run re-confirmed the live leg at merged main: **9/9 limbs**, shelf 46,
sole `NEW ·` holder `/olympics/`, arcade rendering 46 cards that occupy real
space.

### V-P2 B1 — silhouettes, measured

B1's DPR item struck. What remained — *a distinct silhouette per enemy class at
a glance* — is a measurable claim, so it was measured. Precedent: the
colourblind palette, chosen on worst pairwise CIELAB distance under dichromat
simulation, not on taste.

**New instrument, `tools/measure_novasiege_silhouettes.mjs`.** Each class drawn
through the game's **own** path function, filled white on black at a common
radius, area-normalised about its centroid so classes are compared on *form*
rather than size, scored by pairwise IoU. The reported figure is the **worst
pair** — a set is only as readable as its two most confusable members.

To make that possible the shapes were lifted out of `drawEnemies()` into one
named `enemyPath()`, which `drawEnemies` now renders through and the harness
exposes. One source of truth: the measurement is taken on the path the player
is actually shown, not a copy that can drift from it.

**What it found:**

| pair | before |
|---|---|
| drone vs phantom | **0.138** — two hexagons 30° apart; phantom's spike is a hairline adding almost no filled area |
| drone vs strider | 0.166 — hexagon against diamond, both isotropic |
| drone vs mortar | 0.177 — hexagon against square |

The drone was a hexagon, which is as close as a convex polygon gets to *any
shape at all*, and it sat at the bottom of the table against everything.

**What changed:** drone → triangle (the most primitive convex form, and the
shape on screen most often); phantom → concave five-point star (a concave form
cannot be confused with a convex polygon at any rotation, which is the property
being bought); strider → elongated blade (aspect ratio is the one property that
survives area normalisation, and speed is what the strider is — it is the fast
class at 142 against the drone's 94). Kept clear of the vanguard, already an
arrow with a rear notch.

| | before | after |
|---|---|---|
| worst regular pair | 0.138 | **0.329** |
| worst overall | 0.140 | **0.211** |

**The boss is scored but deliberately not gated**, and the tool says why in
place: area-normalisation exists to compare form instead of size, which is
right for six classes of radius 14–25 and **wrong for the boss**, whose main
at-a-glance cue *is* its size — one at a time, twice the radius, with a
dedicated health bar. Redesigning it to lift that number would be optimising
the instrument, not the game.

Floor pinned at **0.30**: under the measured 0.329 so a nudge does not fail on
rounding, not so far under that it stops meaning anything.

**The refactor bit once, with this repo's signature trap.** Renaming
`e.radius` → `r` inside the boss branch turned `const r=e.radius` into
`const r=r` — a temporal dead zone error, the fourth instance in this estate.
Caught immediately because the measurement refused to run.

**R7 limb added**, as the band rule requires: the game writes a save, the page
reloads, every key must return byte-identical **and** the state actually
restored. A hand-written fixture would only have proved localStorage works.

`tools/run_novasiege.sh` runs both gates. **42/42 limbs, two negative controls,
115,704 B** against the 200 KB budget.

---

## §Parks — derived conditions

**U — blocked.** Attachment absent, second sitting running. Not a budget park.

**V-P2 B2 and B3 — not started.** B2: arena events between waves, boss intro
presentation, layered music intensity on the existing Web Audio engine,
announcement polish. B3: draft options with real trade-offs, weapon-evolution
branches, wave modifiers — extending the threat-budget engine, never replacing
it; anything rule-changing parks as a proposal per R8. Each band playable at
its boundary, R7 re-run after each.

**V-P3 — not started. Numbers are DERIVED at the moment of edit, not carried.**
The order is explicit that restating them is the thing not to do. As of this
sitting's close the shelf is **46** and the sole `NEW ·` holder is
`/olympics/`; whoever runs V-P3 derives from the shelf as it stands then, and
the marker chain follows whichever games actually land, in landing order.
Staging is confirmed unserved, so the game can wait there safely.

**V-P4 — not started.** The head deliberately carries **no `og:image`** and
`twitter:card` is `summary`: the real-asset rule says a tag joins when its file
does. Both change in the banner's commit.

**O-fin, T, H — not started.** O-fin unblocked (L1 was its only dependency).
T sizes itself to the shelf it finds. PR #25 baseline **1 file / 1 hunk**,
measured before and after; untouched.

---

## §Register additions

| entry | binding | wrong-first reason |
|---|---|---|
| existence checks | a null result is evidence only about what was searched | checked one repo, wrote "any of the three", never re-checked |
| failure classes | record the class that actually occurred | the proposed class was not what happened; the readback was accurate |
| cross-file findings *(Matt's)* | a measurement is evidence only about the file it came from | a DPR result from Ouroboros carried to a sibling never measured |
| rule conflicts | measure the cost before ruling a conflict real | the splash "conflict" cost 0 pixels and was never measured |
| merged ≠ pushed | a fix on a branch is not live | L was reported closed while the pin was still live on main |
| `enemyPath()` | one source of truth for a measured property | a measurement of a copy proves nothing about what renders |
| silhouette floor | exclude what the metric cannot see, and say so | area-normalisation strips the boss's main cue; chasing it optimises the instrument |
| `verify_novasiege` donor path | resolve relative to the subject, not the instrument | "donor unreadable" was a fact about where the script had been copied |
| `live OS listener` | poll, never single-sample | one fixed 150 ms wait went red on a slow tick — inside the gate meant to enforce polling |
| staged-not-served | prove the negative, and fail closed | expectation was 404; anything else, including a transport error, fails |

No clean-estate declaration is made.
