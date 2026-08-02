# Close: the launch film — 2 August 2026

For a reader with no context. Matt asked for a YouTube video covering three
things: the new members section, Apex Kick, and the new Year 10–11 SEMH biology
resources. One of those three turned out not to exist in the form the brief
assumed, and finding that out before writing a word of copy was the most
valuable thing this pass did.

| # | item | end state |
|---|---|---|
| 0 | PR #20 | **DONE** — merged `ecf8b8c`, verified on merged main |
| 1 | Source census + claim ledger | **DONE** — and it caught a wrong exam board one step before it went on screen |
| 2 | Capture under Gate Z | **DONE** — 9/9 shots, 0 pupil-shaped keys |
| 3 | The film | **DONE** — 76.23 s, 1920×1080, h264 High, silent, 9.8 MB |
| 4 | Publish kit | **MATT'S** — he uploads; the music is added at upload |
| 5 | Rules, backlog, checklist | **DONE** — R22–R24 written with provenance |

---

## The contradiction the brief told me to catch, and what it actually was

The brief warned that a video saying "sign up" would advertise a thing deleted
an hour earlier, and told me to read `/members/` before writing copy. I did.

```
H1   "There is nothing to sign in to"
H2   "Accounts were switched off, then removed, on 2 August 2026"
interactive elements in <main>: 0
```

**What can a visitor do there? Nothing.** Read an explanation and follow three
outbound links. There is no feature to promote.

But the brief's two options — support the beat, or drop it — missed a third. The
page does not support *"come and see the members area"*. It very strongly
supports *"there is no members area, no account, and nothing collected, and here
is the page that proves it"*. For a teacher deciding whether to put a site in
front of a class, that is not an apology; it is the strongest claim on the
estate. **That fork was Matt's to settle, not mine, so I asked**, and he chose
the reframe. Beat one is now "No sign-up. Nothing collected." — the same
surface, filmed honestly, advertising nothing that does not exist.

---

## 1. Source census

### Apex Kick — the interesting claim is true

The ledger said card stats drive the physics. Verified at source rather than
carried:

```js
var precision  = (fka * 0.70 + cmp * 0.30) / 99;      // free-kick accuracy + composure
var chemBonus  = 0.82 + 0.18 * (clamp(chem, 0, 3) / 3);
var cone       = 6.2 * (1 - precision * chemBonus);   // the error cone, in degrees
```

`spinMagnitude(stats.curve)` feeds the Magnus term and `launchSpeed(…, stats.power)`
feeds velocity. Derived from `AK.Data`: **48 cards, 7 leagues, 16 nations, 31
clubs, 6 duo chemistry links, 7 goalkeepers.**

Better still, the game says it on screen without help. The captured HUD reads
**`Cass Merrowby · PWR 60 CRV 92 FKA 79 · cone 1.6°`** and the shot readout
**`30/100 · 54 mph · cone 1.6° · drift 0.8°`**. The beat did not need a claim
written over it; it needed a frame where the game makes the claim itself.

### The biology resources — identified at source, and the ambiguity dissolved

The brief deliberately did not name them and told me to stop and ask if more
than one set could be meant. Three could, until they were measured:

| set | files | declares | first landed |
|---|---|---|---|
| `Science_Teesside/Build` | 5 | **Year 3** | 29 Jul |
| `Science_Teesside/Grow` | 5 | **Year 5** | 29 Jul |
| `Science_Teesside/Launch` | **15** | **KS4 / GCSE** | **29 Jul, updated to 1 Aug** |
| `biology/` (older set) | 14 | GCSE-level | 12 Jun, last content change before a repo-wide motion sweep |

Only one set is Year 10–11 **and** new. No question needed — the ambiguity was
resolved by measurement, which is the better outcome than asking.

Derived: **15 lessons, 5 weeks (W3–W7), 3 per week, exactly Discover ×5 / Use ×5
/ Master ×5.**

### The claim ledger

Every sentence that appears on screen or in the description, beside the thing
that makes it true. **Any row without a source was cut, not softened.** Every
number was computed from the files being described (R24), not typed.

| on screen / in the description | source |
|---|---|
| "There is no account to make, and no password box anywhere on the site." | `/members/` H1 + `/privacy/` lead panel; 0 password inputs measured across 27 pages |
| "0 of 27 pages set a cookie · no analytics of any kind" | storage census, 27 pages, 0 cookies; origin census, 1 external origin |
| "Nothing was ever behind a login — so the login went" | `/members/` §"Accounts were switched off, then removed" |
| "Card stats set the physics, never the dice." | `site.json` door description, **verbatim** — and verified in `errorConeDeg()` |
| "The card's stats decide how tight the error cone is" | `precision = (fka*0.70 + cmp*0.30)/99` → `cone` |
| "48 cards, 7 leagues, 16 nations" | derived from `AK.Data` at build time |
| "Chemistry between players changes the ballistics" | `duos[].mod` — `magnusCmMultiplier`, `errorConeSigmaMultiplier`, `launchVelocityBonusMetresPerSecond` |
| "Fifteen new lessons across five weeks" | 15 files in `Science_Teesside/Launch`, weeks W3–W7 |
| "Discover · Use · Master — five per stage" | title roles counted: Discover 5, Use 5, Master 5 |
| "Edexcel GCSE Biology 1BI0 Foundation · Paper 1, Topic 1" | the rendered badge, 15/15 files |
| "Print packs at three levels in every lesson" | Supported / Standard / Stretch buttons, present in the captured frames |
| "Built in a real SEMH classroom." | `next/index.html`, Matt's own public wording |
| channel `@matthewroper9166` | 3 occurrences in the tree, not memory |

**Two rows were cut for want of a source.** A line about how many teachers use
the site — the visit counter measures visits, not people, and `/privacy/` says
so. And "AQA", which was wrong; see below.

### The correction that would have been most embarrassing

I read the exam board from a grep. `AQA` appears in **all 15** files, so I wrote
"AQA GCSE Biology Paper 1 Topic B1" into the census.

Then I looked at a screenshot. The rendered badge says:

> **Edexcel GCSE Biology 1BI0 Foundation · Paper 1 · Topic 1**

Re-derived across all fifteen: **Edexcel 15/15, Pearson 15/15, 1BI0 15/15.** And
`AQA` appears in exactly one context — *"AQA UAS science units"*, the Unit Award
Scheme assessment link, which is not the exam board at all.

Wrong board, wrong topic code, in a video aimed at teachers who would have
spotted it instantly. Caught one step before the screen, by reading the rendered
page instead of the source. That is now **R24**.

---

## 2. Gate Z

**The gate earned its place before a single frame was written.** The lesson decks
carry a random pupil-picker: **166 files** in the `Lessons` repo persist a class
list to `localStorage` under `mbm_cc_v1`, and the LAUNCH decks I needed to film
are 15 of them. Filming one of those pages in a browser a teacher had used would
have put real children's names in a public video.

Default is `[]` and the modal is hidden on load, so a clean profile is safe —
**but only a clean profile.**

**The first version of the gate failed, and the failure was the gate's, not the
profile's:**

```
GATE Z FAIL home-hero  ls=["mbm_c_visits_total"] idb=[] cc=null
GATE Z FAIL home-doors ls=["mbm_c_visits_total"] idb=[] cc=null
```

That is the visit counter writing its own cache during load. The assertion was
measuring after navigation. It was **split rather than loosened** — part 1
asserts the profile is empty *before* navigating, part 2 checks what the page
wrote itself against a pupil-shaped key list:

```
POPULATION: 9 shots attempted
  shots passing both parts ....................... 9/9
  localStorage keys in the profile BEFORE nav .... 0
  keys the pages wrote themselves during load .... 1  (mbm_c_visits_total, on 2 shots)
  IndexedDB databases created .................... 0
  PUPIL-SHAPED keys or databases, any shot ....... 0
  mbm_cc_v1 (the class-list key) ................. 0 shots
  GATE Z FAILURES ................................ 0
```

`/uas/app.html` and the ASDAN register were **never opened**. No faces. Nothing
AI-generated, nothing stock: every pixel is a real screenshot, a real play frame,
or a card drawn from the estate palette and the `M` path copied verbatim from
`assets/brand/micro_mark.svg`.

### The text inventory — and a check I built badly before I built it well

The brief said to OCR every finished frame. I did that first, literally: 2,287
images at 30 fps. **It ran for over 40 minutes and was the wrong instrument.**
No shot in this film is shorter than 3.6 s and the only motion is a 4 % zoom, so
the overwhelming majority of those frames were near-identical — and OCR of
rendered text is *less* accurate than simply asking the browser what it laid
out. Brute force is not the same as coverage.

What replaced it reads the same risk from two sources chosen for what each is
actually good at:

```
SOURCE A  DOM text, authoritative, 9 page shots ........  921 distinct strings
SOURCE B  OCR (--psm 12), Apex Kick canvas,
          15 frames at 2 fps across the 7.53 s shot ....  155 distinct strings
          TOTAL POPULATION EXAMINED .................... 1,075 distinct strings
```

Source B is not optional: the Apex Kick HUD, the player name and the ballistics
readout are painted into a WebGL canvas and have **no DOM text at all**. Pixels
are the only source there, and OCR duly recovered `Cass Merrowby`, `1/99`,
`SAVED` and `30/100 · 54 mph · cone 1.6° · drift 0.8°` from them.

**The results:**

- **9 person-name-shaped strings.** Eight are product names — Apex Kick, Voxel
  Frontier, Medevac Frontier, Lesson Hub, Glitch Clash, Exit Ticket, Primary
  Science, Lundy Loop. The ninth is **`Cass Merrowby`**, a fictional Apex Kick
  card defined in `AK.Data`. **No real person appears anywhere in the film.**
- **17 strings using pupil-data vocabulary** — every one of them teacher-facing
  prose or a product name: *"Photograph the pupil's completed results table"*,
  *"ASDAN Register"*, *"Nothing on this site asks you to register"*. No value,
  no name, no mark.
- One deserved chasing rather than waving through: **`Pupil name:`** appeared in
  the DOM manifest. That manifest is deliberately **over-inclusive** — it reads
  every slide in a deck, not only the visible one — so it flags things that
  never reach the screen. Verified against the pixels by OCR'ing all eight
  finished page frames: **0 occurrences of "pupil"**, and 0 person names. It
  lives on a hidden slide's print pack and is a blank field label, not a value.

```
8 finished page frames OCR'd from the pixels
  occurrences of "pupil" ......... 0
  person names ................... 0
```

Also visible in that pass, and reassuring: **`Pearson Edexcel`** — the corrected
exam board is on screen, in the pixels, not just in my notes.

**Why the OCR was slow, which turned out not to be the reason I assumed.** I
blamed the page-segmentation mode and switched from `--psm 11` to `--psm 12`,
which is genuinely 90× faster on a frame with a confetti crowd texture *and*
reads the HUD better. But the real cause was cruder: the box has **4 cores**, and
each killed OCR job left its `tesseract` children alive. Load average reached
**16**. Once the machine was actually idle, 15 frames took **5.7 seconds**. Both
findings are real; only one was the bottleneck.

---

## 3. The film

```
1920x1080 · 30 fps · h264 High (avc1) · yuv420p · faststart · NO audio track
76.23 s · 9,795,186 bytes (9.8 MB, ceiling 60 MB)
```

**Shot list, measured from the built files rather than from the plan:**

| # | start | dur | shot |
|---|---|---|---|
| 01 | 0:00.00 | 5.00 s | title card |
| 02 | 0:05.00 | 3.60 s | beat 1 card |
| 03 | 0:08.60 | 6.00 s | privacy: lead panel |
| 04 | 0:14.60 | 5.60 s | privacy: what leaves |
| 05 | 0:20.20 | 5.00 s | members page |
| 06 | 0:25.20 | 3.60 s | beat 2 card |
| 07 | 0:28.80 | 7.53 s | **Apex Kick — real motion** |
| 08 | 0:36.33 | 4.60 s | Apex Kick — flight still |
| 09 | 0:40.93 | 5.00 s | homepage doors |
| 10 | 0:45.93 | 3.60 s | beat 3 card |
| 11 | 0:49.53 | 5.60 s | biology: osmosis core practical |
| 12 | 0:55.13 | 5.00 s | biology: active transport |
| 13 | 1:00.13 | 5.00 s | biology: command words |
| 14 | 1:05.13 | 4.60 s | homepage hero |
| 15 | 1:09.73 | 6.50 s | end card |

**Calm-motion gate: minimum shot length 3.60 s against a floor of 1.20 s.** Hard
cuts throughout — no flashes, no strobing, no full-frame luminance flips. Stills
carry a 1.00 → 1.04 zoom across the whole shot, about 0.008 % per frame.

**Real motion, not a pan.** The brief allowed a slow pan over a still as a
fallback and asked me to say which I used: shot 07 is **genuine gameplay**,
driven through the game's own input paths — mouse down, a 22-step drag across
the ball to impart spin, mouse up — and recorded by Playwright at 25 fps, then
resampled to 30. Not a canvas readback: this game's WebGL context is
`preserveDrawingBuffer:false` and `drawImage()` returns pure black, a trap
already on this estate's record.

**Silent by design.** Built with `-an`, verified: the file has **no audio
stream**. A music licence cannot be verified from a build container, so nothing
was baked in. That makes the burned-in captions the accessibility layer rather
than decoration, and the full transcript is in the description.

**The video is not committed.** A Pages repo serves every file it contains to
anyone who guesses the path. `tools/film/` is committed instead — five scripts
and a README — so it can be rebuilt. The **thumbnail** and the **facade poster**
are committed, because those the site actually needs.

### Two build faults, both silent, both mine

```
FAULT 1   68.53 s instead of 80.8 s.
          -loop 1 -t 6.0 feeds a still at ffmpeg's DEFAULT 25 fps, so 150
          frames at 30 fps out is 5.0 s. Every still shot came out exactly
          25/30 of its intended length. Nothing errored.
FIX       -framerate 30 on every looped input.  ->  76.23 s

FAULT 2   All fifteen shots wrote to 01.mp4.
          The shot counter was incremented inside a function called as S=$(n).
          A command substitution runs in a SUBSHELL, so the parent's counter
          never moved. The concat list pointed fifteen times at one file.
FIX       Explicit shot numbers, plus an assertion:
          "shots built: 15   listed in concat: 15"
```

Both produced a plausible file rather than an error. That is the shape worth
remembering.

---

## 4. What is Matt's

`reports/film/2026-08-02-launch-film-publish-kit.md` has the title (49
characters, in the cadence of his existing two videos), the full description with
derived chapter timestamps and the complete transcript, the pinned comment, and
the upload steps.

**The step that matters: add the music at upload.** The file is silent on
purpose. YouTube Studio → Editor → Audio → Audio Library, the same route as the
Apex Kick reel.

Once it is live, one eleven-character video ID turns it into a click-to-load
facade on the homepage. The poster is already committed, so that is a two-minute
job.

---

## Deliberately left red, with reasons

- **A Shorts cut was not built.** Optional, and only if the landscape cut passed
  every gate with time to spare. It did pass; the time did not. The raw material
  (`clip-apexkick.mp4`, already portrait, silent and vetted) is noted in the kit.
- **`/resources/medevac-frontier/` still overflows 1 px.** Reproduces on
  pristine `69c0457`; filed in `BACKLOG.md` with its reproduction line.
- **The OCR language-pack host is still unread.** cdnjs is blocked from this
  container. It is the first item on the backlog and the reason vendoring beats
  SRI.
- **R22–R24 are on a branch in the Lessons repo, not merged.**
  `claude/instruments-r22-r24` at `f9af742`. The brief said to write them; it did
  not ask for a PR there.

## A number that will look like a contradiction in September, and isn't

This session reported **37 localStorage keys, all cached counter numbers**. The
estate's earlier storage census reported **120 keys across 83 files, nine of them
holding class lists**. Both are right. Mine is *27 site pages*; the estate's
spans three repos including lesson files. **Different populations, not a
disagreement** — written down here so nobody "discovers" a conflict later.

## My honest limit

Nothing I can run tells anyone whether this film is any good, or whether the
title earns a click. I can prove it is 76 seconds, silent, calm, accurate to the
files it describes and free of any child's name. Whether it persuades a teacher
to open the site is a judgement, and it is Matt's.

## If I had another hour

**`/uas/app.html`, and vendoring those four cdnjs scripts.** It is the top item
on the backlog and the ruling is already recorded so it cannot be re-debated:
vendor, not SRI, because SRI buys integrity but still needs the network, while
vendoring buys integrity **and** offline — and offline is that tool's whole
promise. It is the one page on the estate where the blast radius is a teacher's
class list rather than a visit counter. It was not done today because a rushed
change to that page, at the end of a long session, is exactly the change you
don't make.
