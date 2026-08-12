# Neon Meridian: Open Drive

A single self-contained HTML file. No build step, no external script, no remote
subresource — it plays from `file://` and it plays offline.

Copy on the shelf and the folder page is derived from the game's own strings:
its boot card ("a dense original coastal city built for free driving,
landmarks, traffic and discovery") and its own menu vocabulary — FREE DRIVE,
DELIVERY, CHECKPOINT RUN, CIRCUIT, GARAGE, MERIDIAN BAY.

## Media

| file | size | source |
|---|---|---|
| `/assets/cards/neon-meridian.webp` | 640×360 | live frame, Meridian Bay at night |
| `banner.webp` | 1200×400 | live frame, city canyon at night |
| `thumb-1.webp` | 480×270 | sunset free drive |
| `thumb-2.webp` | 480×270 | night, heavy rain |
| `thumb-3.webp` | 480×270 | pursuit at full road heat |

Every image is a real frame captured out of the running game through its test
seam, not an illustration, and each is measured for non-blankness by pixel
statistics before it is kept (`tools/driving-games/render_media.mjs`).

## Accessibility

Reduced motion is OS-as-floor: a stored preference can only ever take more
away, never re-enable animation the OS asked to suppress. Families are gated by
name — shake, rain, pursuitStrobe, speedFov, cameraLag — and each has a call
site.

Photosensitivity: measured, not asserted. Worst case is night driving in rain,
at 4.6–4.8 Hz with a locus swing of 23.8–24.0 luminance units against a 25.5
hazard floor, so no scene clears both the floor and the 3 Hz rate ceiling.
The lit-window grid was softened to get there; see the commit history and
`tools/driving-games/flash-census-FINAL.txt`.

## Saves

`mbm_neonmeridian_settings_v1`, `mbm_neonmeridian_progress_v1`. A copy played
before launch under the pre-house `meridian_*` names is carried over once,
losslessly, and the old keys removed.
