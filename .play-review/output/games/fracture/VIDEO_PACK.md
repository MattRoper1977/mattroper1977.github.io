# Fracture Engine — video pack

**The films are here.** Rendered offline at a true 60fps, encoded to H.264, and
inspected frame by frame from the FINAL encodes before being called deliverable.

| file | spec | size |
|---|---|---|
| `Fracture_Engine_Trailer_16x9.mp4` | 1920×1080, H.264, 60fps, **30.7s** | 9.0 MB |
| `Fracture_Engine_Reel_9x16.mp4` | 1080×1920, H.264, 60fps, **26.0s** | 8.2 MB |

**Both are SHORT of the brief** (60–90s and 30–45s). That is honest and the
reason is below — it is not a quality compromise, it is a length one.

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

## How these were made, and why they are short

**Route B, deterministic offline render.** `tools/render_trailer.mjs` takes the
page's clock: `requestAnimationFrame` is driven by hand at exactly 1/60s and
`performance.now()` is replaced with that clock. Every captured frame is
therefore a **true 60fps frame** regardless of how long the software rasteriser
took to paint it. Capture is slow (~520 ms/frame). The result is not slow.

Real-time capture was measured and rejected: **1.14 fps** at 1920×1080. A
trailer recorded that way is a slideshow.

### Two things went wrong, and both are worth recording

**1. The first master was half a death screen.** The route ran without
recovering from death, so when the Forgeguard fell in the Glitchworks at about
frame 1800, the "Forge Rekindled" modal stayed up for the remaining ~30
seconds. **Inspecting extracted frames from the final encode is the only reason
this was caught** — the render log said `0 suspiciously blank` and the frames
were technically fine. A blank-frame check cannot see a game that has stopped.

The route now clicks *Rekindle at Forge* the way a player would, which is
ordinary play, not a cheat.

**2. The re-render was killed at frame 1844 by a container restart.** The
deterministic clock cannot be resumed mid-run, so the choice was a 30.7s master
from clean frames or another ~32 minutes for the full 60s. The short clean cut
was shipped rather than the long compromised one.

### To get the full-length versions

One command, about 32 minutes, no code changes:

```sh
node tools/render_trailer.mjs --frames 5400 --out /tmp/frames   # 90s at 60fps
ffmpeg -y -framerate 60 -i /tmp/frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p \
       -crf 20 -preset medium -movflags +faststart Fracture_Engine_Trailer_16x9.mp4
ffmpeg -y -start_number 240 -framerate 60 -i /tmp/frames/f%05d.jpg -frames:v 2400 \
       -vf "crop=608:1080:656:0,scale=1080:1920:flags=lanczos" -c:v libx264 \
       -pix_fmt yuv420p -crf 20 -preset medium Fracture_Engine_Reel_9x16.mp4
```

The beats scale with `--frames`, so a longer render lengthens every beat rather
than adding new ones.

### What the render proves about the game

Headless WebGL renders Fracture Engine **correctly** — 3,600 frames, zero
blank, clean geometry, correct HUD, working damage numbers and hit feedback.
The container is only *slow*. Frame quality and frame rate are different
questions, and only one of them was ever broken here.

**Nothing here is on YouTube.** Uploading is Matt's, and the video ID still has
to be pasted into `const TRAILER_VIDEO_ID = ''` in `index.html`.

---

## Matt's actions

1. **Watch both cuts.** If 30.7s is enough, upload as-is; if you want the full
   60–90s, run the command above (~32 min) and re-encode.
2. **Upload to YouTube** — title, description and tags are above; thumbnail
   recommendation is `thumbs/thumb-realm2.png`.
3. **Paste the video ID** into `const TRAILER_VIDEO_ID = ''` in
   `fracture/index.html`. That single edit lights up a "Watch the trailer" link
   on the game's main menu. Nothing renders while it is empty.

Also already live, not waiting on you: `poster.webp` on the homepage box, and
the three thumbnail candidates in `thumbs/`.
