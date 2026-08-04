# AGX-1 · FINDINGS

Every finding carries a severity, a file and the measurement that produced it.
Where a census returned a non-zero count, **every hit is classified** — a count
is not an inventory.

Bands per §11.8: **GREEN** fix and log · **AMBER** do it, flag prominently ·
**RED** stop and ask. Where a landed change contradicts the design record, that
is a **finding for Matt**, not an auto-revert.

---

# ⚠️ AMBER — read these first (A-1 and A-2 above all)

## A-1 · Apex Golf now has TWO homepage surfaces, against its own ruling
### The C1 contradiction. This one needs Matt, and I have not resolved it.

**Severity:** AMBER — the change set contradicts the design record
**Files:** `index.html`, `site.json`
**Landed by:** `6e8ab129` — site#44, "Join Apex Golf and Tennis to homepage Sports"

### The record says

§8.4, and Apex Pool's own measured landing report:

> *"Apex Golf is intentionally absent from the homepage, preserving its later
> merged no-homepage ruling."*
> *"Apex Golf — no homepage surface by its own later ruling."*

D3 in the decision box: *"Homepage placement — Not in this PR."*

### The landed state says otherwise — measured by render, JavaScript disabled

Chromium, `javaScriptEnabled: false`, `file://index.html`:

```text
homepage Sports links, JS OFF:
   ⚽ Apex Kick    -> /apexkick/
   🎱 Apex Pool    -> /apexpool/
   ⛳ Apex Golf    -> /apexgolf/     <-- hardcoded, renders with JS off
   🎾 Apex Tennis  -> /apextennis/
```

**A Golf card exists on the homepage and it is hardcoded** — it survives with
JavaScript disabled, so it is not a renderer artefact.

### And there is a second surface nobody has reported

`site.json` doors, measured:

```text
doors  12  ->  14        (NOT 12 -> 13)
   #5  Apex Kick     href=apexkick/
   #6  Apex Golf     href=apexgolf/     <-- new, with art
   #7  Apex Tennis   href=apextennis/   <-- new, with art
   #14 Off-Brand     href=Lessons/Games/Off_Brand.html  (was #12)
```

Both Golf **and** Tennis gained a Games & Sims door. The Pool record measured
12 doors with Off-Brand as #12; it is now 14 with Off-Brand at #14.

**Verified not lost:** all 12 original doors survive, hrefs still **relative**
(0 absolute), rendered `data-doors=14` / `data-doors-art=14` at 360, 768 and
1200, zero empty cells, and `document.documentElement.scrollWidth === clientWidth`
at every width — **no overflow regression**.

### Why this is a finding rather than a fix

§8.4 states *"One homepage surface per game (the deliberate spotlight+Sports
pairing Pool carries is the ruled exception, not a precedent)."* Apex Golf now
carries **two** — a Sports card and a door — having been ruled to carry none.

**Both halves, as required:**

| The ruling | The landed state |
|---|---|
| Golf has no homepage surface (§8.4, D3, Pool's report) | Golf has a hardcoded Sports card **and** door #6 |
| One surface per game; Pool's pairing is the exception | Golf and Tennis both carry two |

**Recommendation.** The four-game homepage Sports block is coherent, renders
with JS off, costs nothing and reads better than a three-game block with one
sibling conspicuously missing. **I recommend Matt ratifies the landed state and
§8.4 is amended** — with the door being the part actually worth a second look,
since that is what pushes Golf to two surfaces and quietly makes Pool's "ruled
exception" the norm. If Matt prefers the original ruling, the smaller correction
is to drop door #6 and keep the Sports card, not to remove Golf entirely.

**Not resolved here. Not reverted here.** §12.3 C1 says do not resolve it, and
§11.8 says a contradiction with the design record is Matt's call.

---

## A-2 · G2's ε measurement is vacuous — ε = 0 is a structural identity
### Proven by deliberate tamper, exactly as §11.4 demands

**Severity:** AMBER — a gate limb that cannot fail
**Files:** `tools/verify_apexgolf.js` (G2), `apexgolf/index.html` (`drive()`)

The ε = 0 across 30/60/120/144 Hz is the correct signature of a real
accumulator **and** exactly what a rig returns if it cannot detect the
difference. §11.4 requires breaking the timestep and confirming ε moves. It
does not move.

### The experiment

| Copy | `AG.DT` | ε via `drive()` (what G2 measures) | ε via an independent wall-clock rig |
|---|---|---|---|
| shipped, untampered | 1/240 | **0** | **0** |
| **tamper A** — `DT × 3` (1/80) | 1/80 | **0** | **0** |
| **tamper B** — `ball.x += ball.vx/240`, dt removed (defect B6) | 1/240 | **0** | **0** |

### Why it can never move

```js
function drive(hole,seconds,renderHz,input){
  var acc=0, frame=1/renderHz, target=Math.round(seconds/DT), steps=0;
  while(steps<target && b.moving){ acc+=frame;
    while(acc+1e-12>=DT && sub<MAX_SUBSTEPS && steps<target && b.moving){
      stepBall(b,hole,DT); acc-=DT; sub++; steps++; } }
```

The loop runs until `steps === target`. `renderHz` changes only how the same
fixed number of `DT` steps is *chunked*. **Identical step counts produce
identical states for any integrator, correct or broken.** ε = 0 is an identity
of the rig, not a property of the physics.

A second, smaller point: `drive()` is a **re-implementation** of the shipped
render loop rather than an exercise of it, so even a correct ε would be
measuring the harness's copy of the loop, not the game's — the same
one-copy-of-one-truth problem G14 exists to prevent.

### The gate as a whole is NOT vacuous — this is the honest scope

Both tampers **are** rejected, by G2's *static* limbs:

```text
tamper A -> FAIL G2 — DT is 0.0125
tamper B -> FAIL G2 — bare position integration found: ball.x+=ball.vx, …
```

So G2 still catches the defect it exists to catch. **What is worthless is the
ε number in its output string**, which reads as a measurement and is not one.

### The game itself is genuinely frame-rate independent

Measured, so the AMBER is about the gate and not the physics: the shipped loop
accumulates real elapsed time and steps at fixed `DT`; `stepBall` multiplies
every integration by `dt`; and

```text
MAX_FRAME_DELTA   0.12 s
MAX_SUBSTEPS·DT   0.1333 s      0.12 < 0.1333  -> no accumulator spiral possible
```

**Recommendation (not applied — it edits a gate).** Either delete the ε claim
from G2's output, or make `drive()` advance a fixed number of *wall-clock
seconds* at each `renderHz` and let `MAX_SUBSTEPS` truncation bite. The static
limbs should stay either way; they are what is doing the work.

---

## A-3 · The read-view panel hides 88.6% of the hole on a phone
### G5 passes because it never asks whether the hole is *visible*

**Severity:** AMBER — a gate that passes on an under-specified check
**File:** `apexgolf/index.html`

§4.1 and G5 require the whole hole **visible** before the call. Measured
occlusion of the course canvas by the opaque read panel
(`background rgba(17,22,41,0.96)`, `opacity 1`):

| Viewport | Canvas | Panel | **Canvas hidden** |
|---|---|---|---|
| **360 (phone)** | 360×681 | 338×642 | **88.6%** |
| 768 (tablet) | 768×965 | 620×520 | 43.5% |
| 1280 (desktop) | 1280×741 | 620×520 | 34.0% |

G5's contract rows assert `state.phase==='read-call'`, `ev.geometry.fairway>=6`
and `pix>10000` — that the hole *was painted with real geometry*. None asks
whether the painted hole is **unoccluded at the moment of the call**. The gate
is substantive but under-specified, and a phone visitor calls their stroke
count with the hole almost entirely behind the panel.

**In fairness:** the panel is not empty. It states par, length, wind, slope,
water and bumper count numerically, plus the sandbag-cap rule in plain English —
so the *information* needed to read the hole is present. Whether numbers
satisfy "the whole hole visible" is a design call, and the school-phone case is
the one that matters here.

**Recommendation.** Tighten G5 to assert an unoccluded fraction, then either
make the phone panel dismissable ("study the hole" toggle) or accept the
numeric read and amend §4.1. Not applied — it changes both a gate and the UI.

---

## A-4 · Three hardcoded `34`s will break the moment Games#12 lands
### C3, corrected: the baseline is not stale at 33, it is frozen at 34

**Severity:** AMBER — a count that is not derived
**Files named, as C3 requires:**

```text
.github/workflows/arcade-sports-verify.yml:38   name: "Fetch merged 34-entry manifest"
.github/workflows/arcade-sports-verify.yml:43   if(d.games.length!==34) process.exit(1)
tools/verify_arcade_sports_browser.js:11        ok('manifest-count-34', games.length===34, …)
tools/verify_arcade_sports_browser.js:27        s.shelf.length===34 && [Kick,Pool,Golf,Tennis]…
tools/verify_arcade_sports_browser.js:32        /13 curated favourites of 34 games/
```

C3 predicted a stale **33**. Measured: it was already moved to **34**, by
hardcoding — the "never restore 49" defect committed again one number later.
Biopunk's Games#12 takes the manifest to 35 and **all five of these fail**.

**Full classification of the census — every hit accounted for.** A sixth match
exists and is **NOT** a defect:

```text
tools/verify_arcade_sports.js:13
  ['count','total-count-derived-from-manifest',
     s=>s.replace('var n=state.games.length;','var n=33;')]
```

That is a **mutation fixture**: it *plants* a hardcoded 33 to prove the check
rejects one. Correct usage. A naive census would have flagged it.

The renderer itself is clean — `games/index.html` derives its total from
`state.games.length`, and `total-count-derived-from-manifest` guards it.

**Fix = derive.** Assert `rendered === manifest.length`, never `=== 34`. Not
applied: it edits another game's gates during a Golf pass, and Games#12's timing
is Matt's call (C8). **See A-6 — the hardcoded count is only half of it.**

---

## A-5 · Live verification — RESOLVED by CI. C2 is CLOSED.

**Severity:** downgraded from AMBER to **GREEN — closed in this pass**
**Evidence:** run `30919019077`, conclusion **success**, every step green

The container cannot reach the domain:

```text
https://madebymatt.uk/apexgolf/           000   (proxy: 403 on CONNECT)
https://mattroper1977.github.io/apexgolf/ 000   (same)
GitHub Pages API                          blocked at the proxy
```

So the check was routed to Actions, per §11.6. `.github/workflows/agx1-live-verify.yml`
ran from a GitHub-hosted runner and returned:

```text
https://madebymatt.uk/apexgolf/                200      <-- FIRST EVER FETCH
https://madebymatt.uk/apextennis/              200
https://madebymatt.uk/biopunkhive/             200
https://madebymatt.uk/apexpool/                200
https://madebymatt.uk/apexkick/                200
https://madebymatt.uk/                         200
https://madebymatt.uk/games/                   200
https://madebymatt.uk/site.json                200
https://madebymatt.uk/Games/games.json         200
```

**Live bytes against the committed tree — the step exits non-zero on any
mismatch, and it passed:**

```text
game            live_bytes  repo_bytes  live_sha256                        match
apexgolf             64513       64513  c0701ee1152d57c1…4ddab041      IDENTICAL
apextennis           59852       59852  8e109ab55a0fb2a2…cdfb9b1f      IDENTICAL
apexpool             88751       88751  4de1383f8ee029db…97af87ad      IDENTICAL
apexkick            162122      162122  541697f7a621d15c…5d5f916f      IDENTICAL
biopunkhive          76841       76841  f129e84bf8718d4b…3790080e      IDENTICAL
```

**Apex Golf is live, served, and byte-identical to the committed file** —
64,513 bytes, SHA-256 `c0701ee1…`, matching blob `132034b7…`.

**Live manifest census, from the domain rather than from raw:**

```text
entries 34 · art 34/34 · duplicate ids 0
Sports  Apex Kick · Apex Pool · Apex Golf · Apex Tennis
Physics (derived) 8 · Sport chip minted False · hues all distinct True
Biopunk in manifest False
```

### All three limbs of C2, discharged

1. **`/apexgolf/`** — fetched, 200, byte-identical. The URL that had never been
   fetched by anyone now has been.
2. **`/apextennis/`** — fetched, 200, byte-identical. Tennis skipped this on a
   container DNS failure; the container was never the channel, and this closes it.
3. **Biopunk's "exact live identity verified" claim — reclassified, then
   resolved.** The evidence *in the tree* is a hash-and-reconstruct check
   against the **committed** file (`tools/biopunkhive.sha256`,
   `biopunkhive_index.html.gz.b64`), i.e. raw identity, **not** live identity —
   so as originally stated the claim overreached. This run supplies the missing
   half: `/biopunkhive/` fetched live, 76,841 bytes, SHA-256 `f129e84b…`,
   **IDENTICAL**. The claim is now true for the right reason.

### C1, confirmed a third time — from the live domain

```text
served homepage HTML:  Apex Golf  2 mentions,  apexgolf/ href  1 occurrence
C6: New Release heading present; Apex Pool 5 mentions
```

Golf is on the live homepage. A-1 stands, now measured locally with JS off,
from git history, and from the served bytes.

---

# GREEN — measured, no action needed

## G-1 · The Apex Kick donor's one failing check, NAMED

§11.7 asks for the name. Measured, `node tools/verify_apexkick.js`:

```text
25 checks — 24 passed, 1 FAILED
FAIL  no-remote-resources   (family: "Offline contract")
      found: https://madebymatt.uk/apexkick/,
             https://madebymatt.uk/apexkick/,
             https://madebymatt.uk/images/apexkick-hub.jpg
```

**What it measures:** that the shipped file contains no absolute remote URLs.

**Classification of all three hits — none is a runtime resource.** Two are the
canonical link and `og:url`; the third is the `og:image` social preview. The
companion check `no-network-calls` **PASSES**. Apex Kick is genuinely
offline-capable; the check's regex simply does not exempt metadata.

**The donor's check is the buggy one, and Golf already fixed it.** Apex Golf
carries the same single absolute URL (`https://madebymatt.uk/apexgolf/`, its
canonical) but G17 tests for `<script src=`, `<link rel=stylesheet`, `fetch(`
and `XMLHttpRequest(` instead — so it measures dependency, not string shape.

Reported only. Nothing on Apex Kick was touched, per §11.7. The 25-check figure
is measured here, not inherited.

## G-2 · Independent correctness re-measurement of the shipped game

Not by re-running the author's harness and agreeing — by separate rigs.

**My own 1,000-shot fuzz, on live holes** (wind, slope, trees, bumpers, water
all ON — the author's G10 rig neutralises wind and slope):

```text
settled            1000/1000
still moving       0
non-finite state   0
max shot seconds   15.796   (MAX_SHOT_SECONDS 24)
```

**Call Rating §4.3, re-derived exhaustively** — all 1,800 legal triples, not a
20k sample:

```text
8/8 exact fixtures            (3,3,3)=100 (4,4,3)=90 (6,6,3)=85 (7,7,3)=60
                              (3,4,3)=70 (3,2,3)=70 (3,5,3)=40 (3,7,3)=10
1800 triples                  0 out of contract; integer; range [0..100]; no NaN
symmetry violations           0
monotonicity violations       0
sandbag cap                   0 exact calls above par+3 exceed 60, at par 3, 4 and 5
```

**Band disjointness — and a correction to my own first reading.** A global
band test initially reported OVERLAP (`exact_min=60 < near_max=70`). That was
**my test being under-specified**, not a defect: the 60 is the mandated
sandbag ceiling. Excluding capped calls, as §4.3's two clauses require:

```text
par 3/4/5:  exact_min 85  >  near_max 70  >  near_min 55  >  miss_max 40   DISJOINT
```

Bands are cleanly, globally disjoint. The cap deliberately places a sandbagged
exact call (7 on a par 3 → 60) **below** an honest one-stroke miss (→ 70),
which is the intended meaning of the mechanic.

Worth recording for the design file: §4.3 cites the Kick precedent *"worst goal
62 > best miss 48"*, which implies global separation across **all** calls. Golf
cannot have that while the cap exists. The author's G8 tests bands *per called
value*, which is the correct reading. Not a defect — a resolved ambiguity.

**G9 force census, independently enumerated:** 9 forces, 9 renderers, every
renderer function present in the file, zero forces without a renderer, zero
orphan renderers.

```text
gravity->drawLoftLegend  wind->drawWind  slope->drawSlope
terrainDrag->drawTerrainPatterns  cup->drawCup  boundaries->drawBoundary
trees->drawTrees  bumpers->drawBumpers  water->drawWater
```

## G-3 · Storage isolation, proven live in a browser (G6, G7, C7)

Seeded six **real** estate save keys, then loaded and played Apex Golf:

```text
UNCHANGED  apexkick.v1               UNCHANGED  mbm_apextennis_progress
UNCHANGED  apexkick.muted            UNCHANGED  mbm_biopunkhive_save
UNCHANGED  mbm_apexpool_progress     UNCHANGED  voxelfrontier.world.v2

sibling bytes moved              0
keys Golf wrote outside mbm_apexgolf_   NONE
G7: shared link #g=1:42 wrote a save?   NO
```

**C7 answered — the Tennis storage census the readback never gave:**

```text
apexkick      apexkick.muted, apexkick.v1        (legacy, unnamespaced)
apexpool      mbm_apexpool_*
apexgolf      mbm_apexgolf_settings, mbm_apexgolf_progress
apextennis    mbm_apextennis_*                   <-- C7
biopunkhive   mbm_biopunkhive_*
voxel         voxelfrontier.*                    (legacy, self-consistent)
```

**Classifying a census hit that looks alarming and is not:** `biopunkhive/index.html`
contains the literal `'apex_evolution'` — the `apex_*` family §5 B15 forbids.
Checked in context: it is an **upgrade id**
(`if(id==='apex_evolution')return state.prestigeCount>=3`), not a storage key.
Biopunk's storage helper namespaces every key through `mbm_biopunkhive_`.
§12.2's "`mbm_biopunkhive_save` ONLY" claim stands.

## G-4 · Static and rendered re-measurement of the shipped file

```text
inline <script> blocks     4, all node --check OK, 0 skipped, 0 failed
external src/href          1 — the canonical link. No runtime dependency.
fetch/XHR/WebSocket        NONE
storage keys outside family NONE
pointer mapping            (clientX-rect.left)*(canvasWidth/rect.width)   B11 CLOSED
unscaled clientX-rect.left 0 occurrences
noscript                   present      touch-action:none   present
prefers-reduced-motion     3 rules      :focus-visible      4 rules
min-height values          44, 54, 48, 50 — none below 44
```

**Rendered in a real browser over BOTH schemes** — `file://` is not optional:

```text
                     http://      file://
HTTP status           200          200
contract rows       13/13 pass   13/13 pass
console errors         0            0
page errors            0            0
unhandled rejections   0            0
external requests      0            0
```

**Plain-visitor render** (no `?contract=1`) at 360 / 768 / 1280 over `file://`:
title correct, zero errors, **zero controls under 44 px**, no horizontal
overflow at any width. Driven into gameplay on a phone viewport: the read view
paints **242 distinct colours / 134 distinct greyscale levels** — real geometry,
and separable without colour, corroborating G11.

**G13 measured, not asserted:** on a 360 px phone the canvas is 720 device px
in a 360 px box — **scale factor exactly 2.0**. An unscaled implementation
(defect B11) would misland every touch by 2×. The shipped mapping is correct.

## G-5 · Placement and presentation (§11.5)

```text
manifest entries      34        art  34/34        duplicate ids  0
Sports                Apex Kick · Apex Pool · Apex Golf · Apex Tennis
tag vocabulary        12 tags, unchanged; NO "Sport" chip minted
Physics (derived)     8         <-- not the 7 the Pool record states; Tennis made it 8
```

**Sports was JOINED, not rebuilt** — one mechanism (`collection === "Sports"`),
`tag` still `Physics` on all four, no second grouping minted, `tag` not
repurposed.

**Hue distinctness, measured in CIE Lab rather than asserted by string
inequality:**

```text
Kick #2F8F6B  vs Pool   #F2A24A   ΔE  76.7
Kick #2F8F6B  vs Golf   #7C5CFC   ΔE 124.2
Kick #2F8F6B  vs Tennis #3B6FD4   ΔE  87.0
Pool #F2A24A  vs Golf   #7C5CFC   ΔE 137.1
Pool #F2A24A  vs Tennis #3B6FD4   ΔE 116.1
Golf #7C5CFC  vs Tennis #3B6FD4   ΔE  39.7   <- closest pair
```

All four pairwise distinct; the closest pair is ~4× the ΔE≈10 threshold at
which two colours are clearly different to the eye.

### THE CHIP GATE — replicated in jsdom-equivalent Chromium against the real manifest

```text
Sports rail             4
Themed favourites       7
Classroom favourites    4
The whole shelf        34
                    -----
TOTAL placements       49   from a 34-entry manifest
```

The known discrepancy is **49-from-34** (was 42-from-31). **It remains CLOSED**:
every extra placement is a named placement rule in `games/index.html`, and there
is still exactly one manifest. Count line reads *"13 curated favourites of 34
games"* — the 34 derived from the manifest.

**Apex Golf's own card: 2 placements — Sports rail + whole shelf, both sourced
from the manifest.** Exactly the documented convention. Per §11.5 the
discrepancy was measured and reported, **not "fixed"**.

## G-6 · C6 — Pool's hardcoded no-JS New Release survived site#44

Verified with JavaScript **disabled**, by render, not by diff:

```text
"New releases  August 2026 · Games Arcade
 Apex Pool — call the leave, then prove it"
```

Still hardcoded, still Pool, still renders with JS off after Tennis rewrote the
homepage. **C6 PASS.**

## G-7 · Superseded and protected work

```text
site#25   OPEN, unmerged, head 7c202790115ca5de5f71babb570b806e5e57a4aa  UNTOUCHED
```

**C5 re-derived** — the brief asked against `6e8ab129`; main is now `4afd3485`,
so it was derived against the real head. PR#25 changes 5 files. Main has moved
**all five** since PR#25's base `85d858d`:

```text
CONFLICT-RISK  MATT_UI_CHECKLIST.md
CONFLICT-RISK  index.html                                (+118/−11 on main)
CONFLICT-RISK  privacy/index.html
CONFLICT-RISK  reports/close/2026-08-02-formsubmit-activation.md  <- ADD/ADD
CONFLICT-RISK  thanks/index.html
```

The report file PR#25 *adds* **already exists on main** — an add/add conflict,
which is new since Pool's measurement. Overlap is worse than previously
recorded. **Reported only; PR#25 was not touched, rebased, merged or closed.**

Verification PR site#42 is closed unmerged **by design** — closed-unmerged is
its correct terminal state, not a failure.

---

# ⚠️ AMBER — A-6, found by the check that nearly returned a false zero

## A-6 · The arcade verification chain is pinned to a frozen manifest snapshot
### It cannot detect manifest drift, and will go green on a stale world

**Severity:** AMBER — a false green; §11.9's most expensive class
**File:** `.github/workflows/arcade-sports-verify.yml:41`

§11.7 asks: *"Check nothing consumes `games.json` at a pinned old SHA."* **My
first pass answered "nothing does." That was a false zero.** Something does:

```yaml
- name: Fetch merged 34-entry manifest
  run: |
    curl --fail --silent --show-error --location \
      https://raw.githubusercontent.com/MattRoper1977/Games/900fae5e861332d61b9e3f506e3ace35ac28d92b/games.json \
      -o artifacts/arcade-sports/games.json
    node -e "…if(d.games.length!==34)process.exit(1)"
```

`900fae5e…` is Games#11 — the Tennis manifest landing. Measured today:

```text
pinned 900fae5  34 entries, 15,465 bytes
live    main    34 entries, 15,465 bytes
identical content: TRUE
```

**So the gate passes today, and it passes for the right reason — by
coincidence.** The structure is the problem:

1. the workflow fetches the manifest **at a frozen SHA**;
2. it asserts that frozen file has **34** entries;
3. it then hands that same frozen file to the browser harness as
   `ARCADE_MANIFEST`, which intercepts the page's `**/Games/games.json`
   request and serves the snapshot;
4. the harness asserts the rendered arcade matches — **34** again.

Every link in the chain is frozen to the same snapshot. The live arcade,
meanwhile, fetches `/Games/games.json` at **main**.

**Consequence, stated plainly:** when Games#12 lands and the live manifest
becomes 35, the live arcade will render 35 cards while this workflow keeps
fetching the 34-entry snapshot, keeps asserting 34, and **keeps reporting
green**. It is structurally incapable of noticing that the thing it guards has
changed. A false green does not merely miss a defect — it closes one.

This is the same defect as A-4 seen from the other end: A-4 is the hardcoded
count, A-6 is the pinned input that keeps the hardcoded count true forever.
They must be fixed together or not at all.

**Fix = derive, both ends.** Fetch the manifest at `main` (or from the live
domain, as this pass's own workflow does), then assert
`rendered === manifest.length` — never a literal. Not applied here: it edits
another game's gates during a Golf pass, and the timing depends on Matt's
Games#12 ruling (C8).

---

# Limits — what I could not reach

## L-1 · The Games repository is outside this session's scope

```text
Access denied: repository "mattroper1977/games" is not configured for this
session. Allowed repositories: mattroper1977/mattroper1977.github.io
```

No `list_repos` / `add_repo` tool exists in this session. Consequences, stated
rather than papered over:

- **Games#9's commit, diff and merge SHA are unverified.** The manifest
  *content* is measured (via raw); the 32→33 transition is not.
- **C8 — Games#12's branch state is UNVERIFIED.** I cannot confirm the branch
  is intact or that nothing was deleted. What corroborates the withhold:
  **Biopunk is absent from the 34-entry manifest**, which is exactly what
  "prepared and withheld" predicts.

**C8's plain statement, as required: Biopunk Hive is LIVE at `/biopunkhive/`
but INVISIBLE — it has no shelf card, and is reachable only by someone typing
the URL.** It appears in `sitemap.xml`, so search engines can find it; a visitor
browsing the Arcade cannot.

## L-2 · Live domain and Pages status — see A-5

## L-3 · What remains a human read

A 200 with matching bytes proves serving, not playability. **Only a thumb on a
real phone proves B11 is closed in the world** rather than in a headless
viewport. That is Matt's action and no agent can manufacture it.
