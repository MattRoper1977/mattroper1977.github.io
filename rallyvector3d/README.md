# Rally Vector 3D — Championship Edition

A single self-contained HTML file. The only off-origin string in it is
`<link rel="canonical">`, which is metadata and never fetched.

Copy is derived from the game's own description and menus: a six-stage season,
service-park repairs, mixed-surface physics, water fords, breakable props,
holographic pace notes, local ghost racing and touch controls.

## The season

Six stages. The shipped three — Alpine Pass, Sahara Run, Nordic Night — are
untouched, with the same ids, points, pars and ghost keys. Three were added:
Cliffline Dash (wet coast tarmac), Timberline Loop (forest gravel, blind
crests) and Copper Canyon (hardpack shale, storm).

Ghosts are stored per stage (`mbm_rallyvector_ghosts_v2_<id>`), so new stages
mint new keys and cannot disturb an existing blob. Every stage — new and
shipped — is proved to build, be drivable, derive pace notes from its own
curvature, record a ghost through the game's own `saveRun()`, and load that
ghost back (`tools/driving-games/verify_new_stages.mjs`).

## Media

| file | size | source |
|---|---|---|
| `/assets/cards/rally-vector-3d.webp` | 640×360 | live frame, Alpine Pass |
| `banner.webp` | 1200×400 | live frame, Copper Canyon |
| `thumb-1.webp` | 480×270 | Cliffline Dash |
| `thumb-2.webp` | 480×270 | Nordic Night |
| `thumb-3.webp` | 480×270 | Timberline Loop |

## Accessibility

Reduced motion was already OS-as-floor and stayed that way; the families —
shake, cameraFov, weather, wiper, splatter — were wired to it, having
previously reached only the camera.

Photosensitivity: worst case is Nordic Night in rain. Measured across 30+ runs
on two independent harnesses, the worst reading is 2.4 Hz against a 3 Hz
ceiling, 0 of 20 runs at or over the ceiling.

## Saves

`mbm_rallyvector_3d_v1` and `mbm_rallyvector_ghosts_v2_*`, both unchanged from
v1.2 and never renamed.
