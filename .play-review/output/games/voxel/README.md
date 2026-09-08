# VOXEL FRONTIER

**Mine. Build. Explore.** A single-file, browser-based Minecraft-style voxel sandbox.

**Play:** https://madebymatt.uk/voxel/

- Endless procedurally generated block world — hills, caves, water, sand beaches and snow peaks
- Textured blocks, baked ambient occlusion and a live day/night lighting cycle
- First-person controls: WASD / arrows to move, mouse to look, Space to jump, Shift to sprint
- Swim in water, and press `F` for creative fly mode
- Break blocks (left click) and place them (right click) with a 9-slot hotbar (keys `1`–`9` / scroll)
- Break particles and synthesised sound effects (`M` to mute)
- Your world saves itself to the browser and reloads where you left off
- Share a world with `Copy world link` — the seed travels in the URL
- Works offline — Three.js r128 is vendored in `vendor/`, no CDN and no installs
- Touch controls on mobile (drag to look, on-screen pad + mine/place/jump/fly buttons)

## How it works

- **Terrain** — 4-octave Simplex noise drives surface height; a ridged 3D value-noise field
  carves caves underground. Trees are placed deterministically so canopies stitch across chunk borders.
- **Streaming** — the world is stored in 16×16×64 chunks generated on demand around the player and
  freed once out of range, giving an infinite feel without unbounded memory.
- **Rendering** — each chunk is meshed with hidden-face culling and baked per-vertex ambient
  occlusion, typically emitting only ~5% of the triangles a naïve cube-per-block build would.
- **Physics** — the player is an AABB resolved independently on each axis (no wall-sticking),
  with gravity, jumping and step-safe collision against the voxel grid.
- **Editing** — a DDA voxel raycast finds the targeted block and face normal for breaking and
  placing; edits persist across chunk unload/reload.
- **Textures** — every block texture is painted at runtime onto a single `<canvas>` atlas, so the
  game stays one file with no image assets. Vertex colours carry the ambient occlusion.
- **Saving** — each seed gets its own `localStorage` slot, so opening someone else's world link
  never overwrites your own build. Autosaves every 10 seconds and on pause.

A Matt's Apps game · madebymatt.uk
