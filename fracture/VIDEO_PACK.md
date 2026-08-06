# Fracture Engine — video pack

**Status: the films are NOT here.** The copy, the thumbnail candidates and the
capture tooling are. Why, with numbers, is at the bottom — read that first if
you are deciding what to do next.

All copy below derives from strings the game itself contains (R4). Nothing is
invented.

---

## YouTube — 16:9

**Title**

```
Relicforge: Fracture Engine — three realms, breaking apart | Made by Matt
```

**Description**

```
Three realms are breaking apart, and their relic logic is the only way through.

Play it free in your browser — no account, no install, nothing uploaded:
https://madebymatt.uk/fracture/

Pick a Forgeguard, a Riftcaller or a Shadowsmith — an armoured vanguard, an
arcane controller or a relic assassin — then work three realms in turn:

  Realm I    Ironwood Verge      Recover the Forge Shards
  Realm II   The Glitchworks     Stabilise the Fracture Pylons
  Realm III  Celestial Foundry   Defeat the Nullsmith

Between fights you temper what you recover at the forge, and read the ground
telegraphs before they land. At the end you can export a Chronicle of the whole
run — a standalone evidence record of realms, relics and achievements,
generated on your own device.

Choose your difficulty as a pathway: Build is forgiving and gives you a revive,
Grow is the standard run, Launch hits harder and drops better.

Built as a single HTML file. It runs offline once loaded, keeps its saves on
your own device, and uses no account and no server.

More games: https://madebymatt.uk/games/
```

**Tags**

```
indie game, browser game, action rpg, webgl, three.js, single file, html5 game,
free browser game, no install, made by matt, relicforge, fracture engine,
arpg, dungeon crawler, accessible games, reduced motion
```

**Thumbnail** — three candidates in `thumbs/`, all real captured frames at
1280×720:

| file | beat | why it might win |
|---|---|---|
| `thumb-realm1.png` | Ironwood Verge, first boot | greens and cyan; the calmest, clearest read of the character and HUD |
| `thumb-realm2.png` | The Glitchworks | deep reds against the cyan HUD — **strongest contrast of the three at small sizes**, and the most obviously "a different place" |
| `thumb-realm3.png` | Celestial Foundry | violet and gold; the most atmospheric, the least legible when small |

Recommendation: **`thumb-realm2.png`**, on contrast alone. A thumbnail is judged
at about 200px wide and the Glitchworks palette survives that best.

---

## Reel / Shorts — 9:16

**Caption**

```
Three realms. One forge. No install.

Recover the Forge Shards, stabilise the Fracture Pylons, then face the
Nullsmith. Temper your relics between fights and export a Chronicle of the
whole run.

Free in your browser: madebymatt.uk/fracture/
```

**Suggested beat order** (each already reachable through the harness):
class select → Ironwood Verge traversal → a combat exchange with hit-stop →
the forge → realm transition into the Glitchworks → Celestial Foundry reveal.

---

## Why the films are not in this pack

The blocking condition was measured, not assumed —
`tools/probe_capture.mjs` at 1920×1080:

| route | result |
|---|---|
| **A — real-time screencast** (what Playwright video / CDP records) | **1.14 fps.** A trailer recorded this way is a slideshow. Shipping it would be claiming a capture quality that does not exist. |
| **B — deterministic offline render** (drive rAF by hand at a fixed 1/60 step, screenshot every frame, encode at 60fps) | **989 ms/frame, and the frames are clean — 0/30 blank.** Every frame is a true 60fps frame. |

The important distinction, and the reason this is a park rather than a defect:
**headless WebGL renders this game correctly — it is only slow.** Frame quality
and frame rate are different questions and only one of them is broken here. The
poster and all three thumbnails are proof: they are real frames and they look
right.

Route B therefore works. It is only expensive:

```
60s at 60fps = 3600 frames ≈ 59 minutes of capture
30s at 30fps =  900 frames ≈ 15 minutes of capture
```

That is a sitting of its own, not a tail-end pass, so it is parked rather than
half-run. `tools/probe_capture.mjs` already contains the working Route B loop —
capturing is a matter of running it for longer against a scripted route and
encoding the frames.

**Encoding**: ffmpeg is available in this environment at
`/opt/pw-browsers/ffmpeg-1011` (Playwright's bundled build). Frames → mp4:

```sh
ffmpeg -framerate 60 -i frames/f%04d.jpg -c:v libx264 -pix_fmt yuv420p \
       -crf 20 Fracture_Engine_Trailer_16x9.mp4
```

## What IS shipped, not parked

- `poster.webp` — a real in-game frame, live on the homepage box now
- `thumbs/thumb-realm{1,2,3}.png` — three thumbnail candidates
- the trailer slot in `index.html`, shipped empty, with the exact line to paste
  the video ID into (see README)
- all the copy above

## Matt's actions

1. Record or commission the trailer and the reel (or run Route B for an hour).
2. Upload to YouTube.
3. Paste the video ID into `const TRAILER_VIDEO_ID = ''` in
   `fracture/index.html` — that is the only edit needed to light the link up.

**Nothing here is on YouTube.** Uploading is yours; no part of this pass claims
otherwise.
