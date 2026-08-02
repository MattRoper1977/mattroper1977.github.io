# `tools/film` — the launch film builder

Rebuilds the promotional video from source. **The video is not committed.** A
GitHub Pages repo serves every file it contains to anyone who guesses the path,
and a 10–60 MB binary bloats every clone for ever. The scripts are the artefact;
the film is their output.

```sh
# two local servers first — this repo, and a checkout of MattRoper1977/Lessons
node tools/film/serve.mjs .            8491 &
node tools/film/serve.mjs ../Lessons   8492 &

bash tools/film/build_film.sh /path/to/output
```

| file | does |
|---|---|
| `capture.mjs` | page screenshots at 1920×1080, **under Gate Z** |
| `ak_capture.mjs` | drives Apex Kick through its own inputs, records real motion |
| `cards.mjs` | title cards, beat cards and caption strips, from the estate palette |
| `thumbnail.mjs` | 1280×720 YouTube thumbnail + site facade poster |
| `ocr_inventory.py` | reads every finished frame back and prints the text inventory |
| `build_film.sh` | orchestrates all of the above, then assembles with ffmpeg |

---

## GATE Z — the one that outranks everything else here

**No frame may contain a real pupil name, mark, photograph or class list.**

This is not theoretical. The lesson decks carry a random pupil-picker: **166
files** in the `Lessons` repo persist a class list to `localStorage` under
`mbm_cc_v1`. Filming one of those pages in a browser a teacher had used would
put real children's names in a public video.

`capture.mjs` enforces it in two parts, and the split matters:

1. **Before navigation** — the profile itself must be empty. Measured on the
   origin before the page has run a line of its own code.
2. **After load** — whatever the page wrote itself is checked against a
   pupil-shaped key list (`mbm_cc_v1`, `hud_names`, `uas_register`,
   `asdan_register`, `pupil`, `register`, `marks`). Any hit and **no frame is
   written**.

The first version of this checked only *after* navigation and failed both
homepage shots, because the visit counter writes `mbm_c_visits_total` during
load. That was the assertion measuring the wrong moment, not a dirty profile —
so the gate was split rather than loosened.

Standing rules for this directory:

- **Never film `/uas/app.html` or the ASDAN register with data in it. At all.**
  If a populated state is ever needed, seed obviously fictional names and label
  it a demo on screen.
- **No faces. No child's likeness in any form.**
- **Nothing AI-generated. No stock.** Every pixel is a real screenshot, a real
  play frame, or a card drawn from the estate's own palette and the `M` geometry
  in `assets/brand/micro_mark.svg`. The crest is not redrawn.
- **OCR the finished film** (`ocr_inventory.py`) and read the inventory. This is
  the only check that covers the Apex Kick shots: that HUD is painted into a
  WebGL canvas and has no DOM text at all, so it cannot be read any other way.

## Calm motion — also not cosmetic

The audience is SEMH pupils and their teachers.

- No strobing, no full-frame luminance flips, **cuts not flashes**.
- Minimum shot length 1.2 s. Every shot in the current cut is ≥ 3.6 s.
- Stills carry a 1.00 → 1.04 zoom across the whole shot — about 0.008 % per
  frame. Enough that the frame is not dead, far below anything that reads as
  movement.

## Silent by design

The film is built with `-an` and has **no audio track**. A music licence cannot
be verified from a build container, so nothing is baked in; Matt adds a track
from YouTube's own Audio Library at upload. **Burned-in captions are therefore
the accessibility layer, not decoration** — every beat carries readable
on-screen text and the full transcript goes in the description.

## Traps already paid for

- **WebGL canvas readback returns pure black.** Apex Kick's context is
  `preserveDrawingBuffer:false`. Capture through Playwright screenshots or
  `recordVideo`, never `drawImage(canvas)`.
- **A looped still defaults to 25 fps in.** `-loop 1 -t 6.0` without
  `-framerate 30` yields 150 frames, which at 30 fps out is 5.0 s. The first cut
  came out 68.53 s instead of 80.8 s — every still shot was exactly 25/30 of its
  intended length, and nothing errored.
- **`S=$(fn)` runs in a subshell.** A shot counter incremented inside a function
  called that way never moves in the parent, so all fifteen shots wrote to
  `01.mp4` and the concat list pointed fifteen times at one file. Silent. Shot
  numbers are now explicit and the count is asserted.
- **`pkill -f serve.mjs` kills the shell that runs it.** Use a fresh port.
- **A `fetch` that throws cannot tell CORS refusal from a blocked request.**
  Both surface as the same `TypeError`. `verify_cors_probe.mjs` exists because
  collapsing them into "refused" would close a question that was never examined.
  A second `mode:'no-cors'` probe separates them: it resolves opaquely if the
  request left the browser at all.

## Verifiers that live here but are not about the film

| script | asserts |
|---|---|
| `verify_uas_offline.mjs` | `/uas/app.html` completes pdf.js, OCR and jsPDF with every non-local request aborted |
| `verify_uas_dnd.mjs` | drag-and-drop accepts, rejects and cleans up as intended |
| `verify_cors_probe.mjs` | `/cors-test.html` reasons correctly in all 3 worlds — permitted, refused, and nothing-left-the-browser. Responses stubbed; it tests the probe, not the vendor |
