# Apex Kick: World Stage V10

A single-file, browser-based football game: swipe to strike, bow the swipe to bend the
ball around the wall and past the keeper.

**Play:** https://madebymatt-play.uk/apexkick/

## Nine modes

- **World Tour**: ten progressive stages, from the academy to gale-force stadium finals.
- **Pro Free Kicks**: bend dead balls round jumping walls of three to six players.
- **60s Time Attack**: instant respawns, Fever multipliers up to 5×, gold rings worth +4.0s.
- **Corner Kick Whip**: whip it in direct from the flag, or drop it on the ring for a header.
- **Keeper Glove Mode**: you are the goalkeeper; read the run-up and dive.
- **Top Bins Blitz**: hit the moving corner targets.
- **Cross & Volley**: curl crosses onto a sprinting striker's boot.
- **Woodwork Challenge**: only the crossbar, posts and top joint count.
- **2P Pass & Play**: a head-to-head shootout on one device, with hidden keeper dives
  and sudden death.

## Controls

- Swipe up from the ball to strike, with a finger or the mouse. Bow the swipe to bend it.
- Keeper Glove Mode: tap or swipe across the goal mouth, or press A/S/D, to dive.
- 2P shootout: the defending player secretly picks a dive (L/C/R or A/S/D).
- Opening the Locker or Trophies pauses a match; it carries on when you close them.

## Saves

Progress saves in this browser only, under the game's own key `mbm_apexkick_v10_save`.
If that save cannot be read, the raw text is kept once under
`mbm_apexkick_v10_save_corrupt_backup` and the game starts fresh. The game does not read,
change or remove any earlier Apex Kick save, and it does not use the Sports Passport.

## Network

None. The page loads one script besides itself, the 3D library three.js r128, from this
folder (`vendor/three.min.js`, MIT licence header intact). It makes no other request.

Lane decision (AK10-S R-0): the previous Apex Kick build did not load the 3D library from a
public address either. It embedded r128 inline. V10 as delivered pointed at a public CDN, so
the library is served from the estate's own path instead. No regression.

## Reduced motion

With `prefers-reduced-motion`, motion is split by function. Decorative motion stops:
camera shake, confetti, crowd sway and pulses. Functional motion stays: the ball, keeper,
kicker and swipe trail, because the game cannot be played without them. This is the
accepted pattern for the estate (AK10-S R-7).

## How it is checked

`tools/verify_apexkick_v10.mjs` (workflow `apexkick-v10-verify`) plays all nine modes to
their result screen in headless Chromium and checks storage, network, pausing and the way
out. Four planted defects must each turn it red before it judges the real file.
