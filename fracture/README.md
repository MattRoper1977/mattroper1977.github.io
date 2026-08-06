# Relicforge: Fracture Engine

Single-file 3D action RPG. Lives at **https://madebymatt.uk/fracture/**.

This is a **different game** from *Relicforge — Strip the Machine* at
`/relicforge/`. They share a franchise name and nothing else — different code,
different saves, different design. Nothing here touches `/relicforge/` or its
save key.

| | |
|---|---|
| Version | Save format v3 (`SAVE_VERSION = 3`) |
| Source identity | 226,175 B, SHA-256 `d2a3bfe89c6e154a58ef56e8aac969be1dc62b891bec20e072eb1ad05ef46eb6` |
| Engine | three.js r128, **vendored** — see provenance below |
| Network | zero remote requests, proven with the network fully blocked |

## Controls

Read from the game's own help panel, so this cannot drift from the game:

**Desktop** — `WASD` move · `LMB` attack · `RMB` heavy · `Q` ability ·
`Shift` dodge · `Space` jump · `E` interact · `R` potion · `I` inventory ·
`Tab` lock target · `Esc` pause / release the mouse.
Click the world to capture the mouse.

**Touch** — on-screen joystick plus attack, heavy, ability, dodge, jump,
interact and potion buttons. Every rendered control clears the 44px floor at
390×844.

## Save keys

Renamed in the pre-publication window, before anyone had a save to lose:

```
mbm_relicforge_fracture_v1            the adventure save
mbm_relicforge_fracture_settings_v1   settings (quality, volume, RM, contrast)
```

Both are **distinct from every live key in the estate**. The live Relicforge
uses `mbm_relicforge_v1` and is untouched. Verified by an estate-wide census
whose search instrument was itself proven live first.

Saves are local to the browser on the device. Nothing is uploaded, there is no
account, and there is no server.

## Vendoring provenance

`vendor/three.min.js` is **three@0.128.0**, pulled from the npm registry with
`npm pack three@0.128.0` and extracted from `package/build/three.min.js`.

```
603,445 bytes
SHA-256 9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2
```

`vendor/LICENSE` is three.js's own MIT licence text, committed alongside.

**Stated honestly:** this file came from npm at the pinned version. A byte
comparison against what cdnjs serves for r128 is **not available** from the
build container and is not claimed. What *is* proven is that the game completes
a full scripted playthrough with the network entirely blocked, and that the
pre-vendor copy fails that same gate — so the check can actually detect a CDN
reference rather than merely passing.

## Reduced motion and photosensitivity

Reduced motion follows the house **OS-as-floor** pattern: the in-game switch can
force it **on**, and can never turn it **off** while the operating system is
asking for reduced motion. A live `change` listener applies it mid-session with
no reload, and the settings checkbox shows disabled, with a reason, when the OS
holds the floor.

Under reduced motion: hit-stop is disabled entirely, the splash skips its fade,
menu pulse and camera float are damped, and camera shake is off.

## The Chronicle

"Export Chronicle" writes a standalone HTML evidence record — realm progress,
equipped relics, forge and diagnostic record, achievements — generated locally
and downloaded. **It is a deliberate feature, not a duplicate-title bug.** It is
verified to parse as a well-formed standalone document with no unresolved
interpolation.

## Tools

```
tools/harness_fracture.mjs   playthrough + gate harness
                             --self-test  negative controls (must pass first)
                             --blocked    offline run
tools/audit_fracture.mjs     warnings, listener hygiene, pause, save fuzz, soak
tools/gate_pass2.mjs         hit-stop bounds, one-source-of-truth, size budget
tools/make_banner.mjs        renders banner.png from the game's own palette
tools/make_poster.mjs        captures poster.png from a real in-game frame
```

Run `--self-test` before trusting any green. Every gate in this folder has been
shown to go red on an injected fault; a green that was never proven able to fail
carries no information.

## Art

`banner.png` (1200×630) is **typographic**, drawn from the game's own palette
tokens and its own realm names, both derived from the game file rather than
retyped. It is honest but it is not rendered game art — **flagged for Matt's
replacement** whenever he wants a proper key image.

`poster.webp` is a real captured in-game frame (Ironwood Verge, first-boot
state).

## Trailer slot — where Matt pastes the video ID

After uploading the trailer to YouTube, paste the video ID into this line in
`index.html`:

```js
const TRAILER_VIDEO_ID = '';   // <- paste the YouTube video ID here
```

While it is empty **nothing renders**. Once set, a "Watch the trailer" link
appears on the main menu. It is deliberately a **link, not an embedded iframe**:
an embed would add a remote origin to a game whose own description says zero
dependencies.

## What is not verified here

- **Frame rate.** The build container renders this scene through software
  rasterisation at roughly 3 fps. That is a fact about SwiftShader, not about
  the game, and no fps claim is made from it. The perf floors are a phone check.
- **WebKit / Safari.** Not launchable in this container this session; the
  CI-runner route carries it.
- **How it feels to play.** No gate answers that one.
