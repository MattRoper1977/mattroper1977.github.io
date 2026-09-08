# Neon Turf: Overdrive

Rocket-car football with a turf war underneath it. Lives at
**https://madebymatt.uk/neonturf/**.

| | |
|---|---|
| Source identity | 112,251 B, SHA-256 `0aeb044673a06009917d19539f549f9d16504a4e5795c8f50a1b55fd89969e90` |
| Build | single HTML file, one inline script, no bundler |
| Rendering | 2D canvas, plus an optional WebGL floor shader that degrades to a 2D floor |

## Controls

Keyboard, touch and gamepad are all supported and switch automatically.
**Player One** WASD / arrows to steer and throttle, Shift boost, Space pulse.
**Player Two** (Local Duel, same screen) the opposite cluster.
**Touch** on-screen joystick plus boost and pulse. Every rendered control
clears the 44px floor at 390×844.

## Modes

**Arcade Cup** — three arenas in sequence at rising difficulty (Rookie, Pro,
Apex). **Quick Match** against the AI. **Local Duel** — two players, one
screen. **Training Lab** — no clock. **Online Lab** — see the caveat below.

Arenas: **Neon Foundry**, **Singularity Court**, **Warp Circuit**, each with
bumpers, gravity wells and portals.

## Save keys

Renamed in the pre-publication window, before anyone had a save to lose:

```
mbm_neonturf_settings_v1     settings
mbm_neonturf_stats_v1        career stats and achievements
mbm_neonturf_skin_v1         selected garage finish
mbm_neonturf_tutorial_v1     tutorial seen flag
```

All four are distinct from every live key in the estate. Saves are local to
the browser on the device — nothing is uploaded, there is no account, no
server.

## The one external service, named

`stun:stun.l.google.com:19302`.

It is a **STUN server**, used only by the **Online Lab** for WebRTC ICE
gathering, and it is the only external reference of any kind in the file.
It is kept deliberately, and here is exactly what it does and does not mean:

- **Every offline mode is completely unaffected by it.** Proven, not assumed:
  with the network entirely blocked, Arcade Cup, Quick Match, Local Duel and
  Training Lab all remain fully reachable and playable — 70/70 harness gates
  green in that state.
- **The Online Lab does not hang without it either.** With STUN unreachable,
  offer generation still completes on host candidates alone in about 9
  seconds, produces a valid offer, and says *"Offer ready — send it to the
  joining player"*. Zero page errors, game still usable. On a normal network
  it is faster.
- **No data goes to it.** A STUN server is asked "what does my address look
  like from outside"; it carries no game traffic.

### The WebRTC caveat, stated plainly

**Peer-to-peer play needs two real devices over HTTPS**, with the offer and
answer codes copied and pasted between them by hand. It cannot be verified
from one machine in a container, and it has **not** been tested end to end.
The shelf copy therefore does not promise online play at all.

## Reduced motion and photosensitivity

Reduced motion follows the house **OS-as-floor** pattern: the in-game switch
can force it **on**, and can never turn it **off** while the operating system
asks for reduced motion. A live `change` listener applies it mid-match, and
the settings control shows its Off button **disabled with a reason** when the
OS holds the floor, rather than offering something it cannot deliver.

What it gates, by name:

| family | under reduced motion |
|---|---|
| `goalFlash` — full-screen luminance flash on a goal | **off** |
| `cameraShake` — goal, tiebreak and pulse shake | off |
| `goalReplay` — the four-second replay | off |
| `particleBurst` — goal, pulse, portal, pickup | density ×0.4 |
| `shockwave` — expanding rings | **kept** — they say *where* a thing happened, so removing them removes game information rather than motion |

The harness measures peak full-screen flash under reduced motion: **0**.

## WebGL context loss

The floor shader carries a single truth, `ok`, and a 2D fallback floor is
drawn whenever it is false. Context loss simply clears that flag and
`webglcontextrestored` re-initialises — there is deliberately no second
"webgl is broken" variable to drift out of step. Verified by forcing loss
with `WEBGL_lose_context`: the flag flips, the match keeps running, the 2D
floor carries it.

## Tools

```
tools/harness_turf.mjs   playthrough + gate harness
                         --self-test  negative controls (run this first)
                         --blocked    network fully blocked
tools/make_banner.mjs    renders banner.png from the game's own palette
```

72/72 gates green online, 70/70 network-blocked, 4/4 controls proven able to
bite. Run `--self-test` before trusting any green.

## What is not verified here

- **Online play.** Needs two real devices over HTTPS. Matt's test, nobody
  else's.
- **Frame rate.** The build container renders through software; no fps claim
  is made from it. That is a phone check.
- **How it feels to play.** No gate answers that one.
