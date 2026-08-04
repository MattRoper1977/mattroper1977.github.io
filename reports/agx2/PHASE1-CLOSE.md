estate-visuals-2026-08-04 · closes apexgolf-build-2026-08-04

# Phase 1 — Apex carry-forward, closed

Records artefact for P1.1–P1.5. Every figure derived by a command run this
session; universes stated. Nothing here is copied forward from an earlier
report without re-derivation.

---

## §0.1 / §0.3 — PREMISE FAILURES, reported before anything is built on them

**Source of the false premises: P1.5 of this master prompt** ("Still outstanding
elsewhere"). Two of its three items are measurably false at HEAD of
`claude/apexgolf-build-2026-08-04-b1hbwj`, because both were fixed and pushed in
the previous turn as commit `9507edf`. P1.5 appears to have been written against
the state before that commit.

**Premise failure 1 — "A-6: `arcade-sports-verify.yml:41` pins `games.json` at
`900fae5e…` and five places assert `=== 34`."** FALSE at HEAD: the pin is gone
(the workflow fetches `…/Games/main/games.json`), and functional `=== 34`
assertions number **0**.

**Premise failure 2 — "The ε limb: `drive()` runs the same step count regardless
of `renderHz`, so ε = 0 measures nothing."** FALSE at HEAD: `drive()` reads
`var acc=0,frame=1/renderHz,frames=Math.round(seconds*renderHz);` — exactly the
`frames = seconds × renderHz + accumulator` shape P1.5 prescribes — and G2 now
reports `ε=0; positive control ε=1.163 (rig proven sighted)`.

**Premise holding — "C8 needs a Games-scoped session."** TRUE, re-confirmed this
session (§P1.1 below).

### Full inventory of `34` in the arcade chain — a count is not an inventory

Universe: `.github/workflows/arcade-sports-verify.yml`,
`tools/verify_arcade_sports_browser.js`, `tools/verify_arcade_sports.js` at HEAD.

```text
arcade-sports-verify.yml:39   "# 900fae5e (Games#11) and assert `length !== 34`. Both ends were frozen,"
```

**One hit, and it is inside the comment recording what was removed.** Zero
functional assertions against a literal; zero pinned SHAs. The three fixtures
that proved it (34 → PASS, 35 → PASS, 35-missing-art → FAIL) are recorded in
[`README.md`](README.md).

---

## P1.1 — Four closures recorded

### Provenance — accepted as a limit, and the label is binding

| Class | Status |
|---|---|
| Manifest **content**: 34 entries · art 34/34 · 0 duplicate ids · Physics 8 · Sports = Kick·Pool·Golf·Tennis · arcade 34+7+4+4 = **49** placements | **STANDS.** Measured twice, on two agreeing channels: `raw.githubusercontent.com/MattRoper1977/Games/main/games.json`, and the live custom domain fetched from a GitHub runner (runs `30919019077`, `30919678785`). |
| Games **repository state**: branch existence, PR state, **Games#12** | **UNVERIFIED.** No channel. Re-tested this session — see below. |

**A content measurement does not stand in for a repository measurement, and
this file does not let it.** Every sentence about Games repo state in this
estate's records must carry the UNVERIFIED label until a Games-scoped session
runs.

### C8 — stays undischarged, re-tested this session

```text
mcp__github__get_file_contents  MattRoper1977/Games   -> Access denied, repo not in session allowlist
mcp__github__list_branches      MattRoper1977/Games   -> Access denied, same
```

**C8 is NOT closed.** Games#12's branch state remains unproven. Biopunk Hive
stays **live at `/biopunkhive/` and in `sitemap.xml`, with no shelf card** —
live but invisible, reachable only by typing the URL.

### `/apextennis/` — closed, and the miss classified correctly

```text
https://madebymatt.uk/apextennis/   HTTP 200
live 59,852 B  ==  repo 59,852 B
sha256 8e109ab55a0fb2a284f2e2e0bb5baa8bf468eaea8e2e89593fd71a20cdfb9b1f   IDENTICAL
```

Matches the Tennis readback figure independently. **C2 is discharged for Golf,
Tennis and Biopunk.** The check ran in both live runs; AGX-1's readback simply
failed to name it. **Recorded as a reporting gap, not a missing check** — the
evidence existed, the summary under-reported it.

### AMBER ledger

| Finding | State |
|---|---|
| A-1 Golf's two homepage surfaces | **CLOSED** by Matt's C1 ruling, implemented — see [`AMENDMENT-8.4.md`](AMENDMENT-8.4.md) |
| A-2 vacuous ε limb | **CLOSED** — positive control, ε=1.163, four tampers rejected |
| A-3 read-panel occlusion | **CLOSED THIS PASS** under P1.3's default ruling — see below |
| A-4 hardcoded counts | **CLOSED** — derived, proven on three fixtures |
| A-5 live verification | **CLOSED** in AGX-1 via verification-only PR site#46 |
| A-6 pinned manifest snapshot | **CLOSED** — pin removed, count derived |

**All six AMBERs are now closed.** None was auto-reverted; A-1 and A-3 were
adjudicated by Matt and then implemented.

### Apex Kick — recorded as a DONOR-HARNESS DEFECT, not a live game fault

Measured this session: `node tools/verify_apexkick.js` → **25 checks, 24 pass,
1 fail.**

```text
FAIL  no-remote-resources          family: "Offline contract"
      https://madebymatt.uk/apexkick/        <- canonical link
      https://madebymatt.uk/apexkick/        <- og:url
      https://madebymatt.uk/images/apexkick-hub.jpg   <- og:image
```

**None of the three is a runtime resource; `no-network-calls` passes.** The
defect is in the donor's *check*, which does not exempt document metadata — not
in Apex Kick, which is genuinely offline-capable. **Apex Golf's G17 already
ships the corrected form**, testing for `<script src=`, `<link rel=stylesheet`,
`fetch(` and `XMLHttpRequest(` — dependency, not string shape.

**Filed so nobody re-raises it as a live game fault.** Apex Kick was not
touched. Unnamed across three passes; closed here.

---

## P1.2 — The two orphans: owed, and not mine to discharge

Both left in place. Deleting content is RED and neither was inside the ruling.

### Orphan 1 — `assets/cards/apex-golf-door.svg`

1,268 B, referenced by nothing after the door removal. The Sports card uses
`/assets/cards/apex-golf.svg`, a different asset still in use.

### Orphan 2 — the `apex-golf` count-catalogue entry, and what shape of defect it is

`site.json` → `features.downloads.catalog` still carries
`{"key":"apex-golf","title":"Apex Golf"}`. Measured after the ruling:
**catalogue 14 entries against 13 doors, and no door now carries
`countKey: "apex-golf"`, so nothing increments it.**

**This is an instance of the estate's own recurring defect shape: two copies of
one truth, either able to change without the other.** It is the same shape as
the 42-vs-31 card mystery, the pinned-manifest-plus-hardcoded-34 pair (A-4/A-6),
and the four disagreeing copies of `CLUBS`/`TERRAIN` in the original Golf dump.
**The control is derivation, not vigilance** — vigilance is what has already
failed here repeatedly.

**So the question is whether the catalogue can be DERIVED from `doors[]` rather
than maintained beside it.** Measured, read-only:

```text
doors[] total                                13
doors[] entries carrying a countKey          13 / 13
catalog entries                              14
catalog keys with no matching door           1   ("apex-golf")  <- the orphan
door countKeys missing from catalog          0
matched pairs with identical title           13 / 13   (title drift: NONE)
catalog entry fields                         key, title  (nothing else)
```

Every catalogue entry except the orphan corresponds 1:1 to a door's `countKey`;
its `title` duplicates that door's `title` with **zero drift across all 13**;
and a catalogue entry carries **no field that `doors[]` does not already hold**.

**So the catalogue's CONTENT is fully derivable** as
`doors.filter(d => d.countKey).map(d => ({key: d.countKey, title: d.title}))`.

**One qualification, measured rather than glossed.** That expression is not
byte-identical to the current catalogue: the two arrays are the **same multiset
with a different order**.

```text
derived order  … apex-kick > apex-tennis > lesson-hub > asdan-suite … > off-brand > …
catalog order  … lesson-hub > asdan-suite … > apex-kick > apex-tennis > off-brand > …
same multiset: true
```

I checked this because my first draft claimed "derivable in full" and the
equality test returned false. **The difference is ordering only.** So the
proposal is sound but carries one open question for whoever implements it:
whether anything renders the catalogue in its own order, in which case the
derivation must preserve a declared order rather than inherit `doors[]`'s.
Derivation still removes the drift; it must not silently reorder a rendered
list.

**PROPOSED, NOT IMPLEMENTED.** Both orphans go to Matt. The derivation change
touches `site.json` consumers and is outside the C1 ruling.

---

## P1.3 — A-3: the default ruling, APPLIED

Matt's swap line `A-3 stays open — leave G5 and the panel alone.` was not
supplied, so the default ruling stands: **treated as a defect, not a
preference.**

The finding as measured, unchanged: at 360px the read panel occludes **88.6%**
of the course canvas, and **G5 never asks whether the hole is visible** — its
rows assert `state.phase==='read-call'`, `ev.geometry.fairway>=6` and
`pix>10000`, i.e. that the hole *was painted*, never that it can be *seen*.

Implementation and gate change are recorded in
**[`A3-FIX.md`](A3-FIX.md)**, including the deliberately-occluding fixture that
proves the new limb can fail. **The gate change is stated as a gate change** —
G5 gained a limb; it was neither widened nor narrowed silently.

---

## P1.4 — The branch, the changed hash, and what it costs

**Binding, and stated the way the estate needs it stated.**

```text
Apex Golf, AGX-1 evidence (LIVE, served today):
    64,513 B   sha256 c0701ee1152d57c1…4ddab041   blob 132034b789ccef09…9292cb02

Apex Golf, this branch (PREPARED, not deployed):
    see A3-FIX.md for the post-fix figure — the ε fix and the A-3 fix both moved it
```

1. **Until this branch merges, the live site serves the OLD Golf and the door
   count the ruling removed.** `site.json` live still has **14** doors including
   Apex Golf's. **The ruled state is prepared, not deployed**, and nothing in
   this estate's records may describe it as live.
2. **If it merges**, the live check for `/apexgolf/` must be re-run on the
   proven pattern — verification-only PR → Actions run → closed unmerged — and
   the readback must name **both** hashes and say which is served.
3. **Not merged in this session.** Matt did not say to merge it here.

---

## P1.5 — Still outstanding elsewhere, corrected against HEAD

| Item | State at HEAD |
|---|---|
| **A-6** pinned manifest / hardcoded counts | **CLOSED** — premise failure 1 above. Fixed before Games#12, as required. |
| **The ε limb** | **CLOSED** — premise failure 2 above. |
| **C8** Games repository state | **OPEN.** Needs a Games-scoped session. Re-tested and still denied. |
| **Matt's phone eyeball** on `/apexgolf/` and `/apexpool/` | **OPEN — his action, not mine.** Still the only real B11 proof. |
| **Biopunk live but invisible** | **OPEN.** Live at `/biopunkhive/`, in the sitemap, no shelf card. Gated on Games#12, which is gated on C8. |

Nothing here was silently absorbed: the two closed items are closed *with the
premise failure named*, and the three open items stay open with their owner.

---

## Debts recorded, not performed

- The AGX-1 live evidence covers the pre-fix Golf hash; a merge obliges a re-run.
- Both orphans (P1.2) await Matt.
- C8 awaits a Games-scoped session.
- Games#12 and Biopunk's shelf card await C8.

estate-visuals-2026-08-04
