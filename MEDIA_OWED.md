# Media — OWED, not delivered

**5 August 2026.** The watch-grid clips and YouTube cuts for Neon Sync and
Neon Breach are **owed**. Nothing was captured, nothing was committed, and
nothing below is claimed as verified. This file exists so the debt is on the
record rather than discovered later.

## Why they are owed

The rule is *a clip is never faked*, and the standard for these is high: a
photosensitivity gate with no swap, an OCR sweep of every capture window
before chaining and again across the finished cut, an `ffprobe` of every
segment before chaining, and verification of the finished file by frame
extraction plus stddev plus OCR — because rendered video never displays back
into a session and so can never be eyeballed.

Meeting that standard end to end, for two games, in both portrait and
landscape, was beyond what this session could complete **and verify**.
Starting it and stopping midway would have produced exactly the artefact the
rule forbids: media that looks delivered but whose gates never actually ran.
So it was not started.

This is a capacity statement, not a capability one. The pieces are present:

| Requirement | State |
|---|---|
| Full `ffmpeg` / `ffprobe` | Available (7.0.2 static). Playwright's bundled build is `--disable-everything` — VP8/PNG/WebM only, no H.264, no mp4 muxer, no ffprobe — so it cannot produce the committed format. |
| Chromium capture route | Available on a runner. |
| Live paths | **Runner only.** The agent container's proxy answers 403 on CONNECT to `madebymatt.uk`, so it cannot fetch the deployed build. |
| Served bytes verified | Yes — `/neonsync/` `6f10b298…` and `/neonbreach/` `d6f6ffbe…` are byte-identical to the tree (live-verify run 31030258359, step 6). |

## Convention, derived by measurement

`ffprobe` on the five committed clips, so the target is measured rather than
assumed:

| file | size | dimensions | duration | fps | audio |
|---|---|---|---|---|---|
| `clip-apexkick.mp4` | 263 KB | 480×930 | 18.1 s | 20 | silent |
| `clip-glitchclash.mp4` | 302 KB | 480×930 | 17.7 s | 30 | silent |
| `clip-offbrand.mp4` | 299 KB | 480×930 | 17.5 s | 30 | silent |
| `clip-voxelfrontier.mp4` | 358 KB | 480×930 | 18.1 s | 20 | silent |
| `clip-voxelfrontier-play.mp4` | 387 KB | 854×480 | 13.2 s | 25 | silent |

**Target: 480×930 portrait, ~18 s, silent, 270–370 KB, poster `.webp`.**
`clip-voxelfrontier-play.mp4` is a landscape outlier and is not the pattern
to copy.

Slug dialects, both real, each followed where it lives:

- video and poster slugs are **unhyphenated** — `clip-neonsync.mp4`, `poster-neonbreach.webp`
- card-art slugs **hyphenate** — `neon-breach.svg`

The watch grid is hardcoded `<figure>` markup in `games/index.html`; it is not
manifest-driven.

## What is owed

1. `clip-neonsync.mp4` + `poster-neonsync.webp` — can now show **Volt and Escort Rush**, live since v1.1 landed.
2. `clip-neonbreach.mp4` + `poster-neonbreach.webp`.
3. Two `<figure>` entries in `games/index.html` with honest authored `<figcaption>`s.
4. Two YouTube cuts, 1920×1080, ≤60 s, silent, ≤5 MB each — **returned as downloads, never committed**. Matt adds trending audio in-app.

## How to produce them

`tools/build_media.sh` carries the full pipeline in order, with the gates
inline and the convention in its header. Run it on a CI runner, which can
both reach the live paths and install a full ffmpeg:

```
BASE=https://madebymatt.uk OUT=artifacts/media bash tools/build_media.sh
```

It references three helpers that are **not yet written** — `tools/capture_clip.js`,
`tools/flash_rate.js`, `tools/ocr_sweep.js` and `tools/verify_clip.js`. They are
named rather than stubbed, deliberately: an empty stub that exits 0 is a gate
that cannot fail, and this estate spent 5 August retiring exactly that defect
class. Writing them is part of the owed work.

## The one gate that must not bend

**Photosensitivity, WCAG 2.3.1, no more than three general flashes per
second. There is no swap.** If either game cannot pass at any capture point,
that is a **GAME finding** — stop and report it. Never retune the seed, move
the capture window, or adjust the encode to get under the bar.

Neon Breach is the likeliest customer: it is a fast neon FPS, so capture
calmer waves rather than muzzle-flash spam. If calmer waves still fail, that
is the finding, and the finding is about the game.
