# APEX KICK

**Bend it round the wall.** A single-file, browser-based free-kick game where your card's
stats set the *physics* — not a dice roll.

**Play:** https://madebymatt.uk/apexkick/

- Drag the marker onto the goal, then flick to strike. Bow the drag and the ball bends in flight.
- Real aerodynamics: gravity, speed-dependent drag, and a proper Magnus lift force
- A goalkeeper who has to **commit** to a dive and can be wrong-footed by late swerve
- 48 collectable cards, five-a-side squad chemistry, duo links, packs with published odds
- An eight-division ladder — each division puts a better keeper in the net
- Works offline. No installs, no accounts, no network requests, no ads.
- Touch and mouse. Portrait or landscape.

## Controls

Three channels, one gesture, deliberately orthogonal:

| Channel | From | What it decides |
|---|---|---|
| **Aim** | where the floating marker sits | which part of the goal you are attacking |
| **Power** | the speed of your final flick | wall clearance vs. the keeper's reaction time |
| **Curve** | how much you bow the drag | going *around* the wall, and wrong-footing the keeper |

You never choose launch angles. One degree of elevation moves the ball 29–50 cm at the
goal and the whole on-target band is 4.4–7.7° wide — narrower than a thumb repeats. So the
gesture picks a *point* and the game solves the angles by inverse ballistics. Curve therefore
does not relocate your shot; it changes the path the ball takes to get there.

## The design pillar

Card stats never roll dice. They set physics ceilings and tolerance margins:

| Stat | What it actually changes |
|---|---|
| Shot power | The launch-speed band around the distance-anchored nominal |
| Curve | Spin rate, and therefore how far the Magnus force bends the flight |
| FK accuracy + composure | The radius of the Gaussian error cone applied at launch |
| Chemistry | Shrinks that cone and lifts the dead-ball stats |
| Keeper reflexes | Reaction latency, and how well the keeper reads your spin |
| Keeper diving | Dive speed, push-off time and reach envelope |

A perfectly struck shot from a bronze card beats an elite keeper. Stats buy **forgiveness for
sloppy input**, never a guaranteed goal. The roster is built around this: a card's rating is a
weighted mean of its six core attributes and **excludes set-piece stats entirely**, so a 63-rated
bronze can carry 84 curve and be a genuinely better free-kick taker than an 84-rated gold.

## How it works

- **Ball flight** — velocity-Verlet integration at 60 Hz with 8 substeps, plus swept collision
  against the wall, posts, bar and goal plane. At the top of the speed band the ball covers
  63 cm per unsubstepped frame against a 12 cm goal frame, so substepping is not optional.
- **Magnus** — `F = ½·ρ·A·C_L·|v|·(ω̂ × v)` with `C_L = min(0.33, 1.20·S)` and spin ratio
  `S = r·|ω|/|v|`. Spin comes from the card's curve stat and decays over the flight.
- **Goalkeeper** — a four-phase perception machine. It integrates the *full remaining flight
  including Magnus* rather than casting a straight ray, then commits to a dive. Its one
  blind spot is the **spin rate**, which it misreads by an amount that shrinks with reflexes —
  so a heavy curler genuinely wrong-foots a weak keeper.
- **Determinism** — the entire flight is simulated the instant the ball is struck and then
  played back. The keeper resolves against the *recorded* states, so it can never peek at a
  future it should not know, and replays cannot drift.
- **Rendering** — Three.js r128, vendored locally. Procedural canvas textures for the grass,
  ball and net; the crowd is a single instanced mesh; the net ripples on impact.
- **Audio** — entirely synthesised with the Web Audio API. No sample files.

## Corrections to the source design document

The game was built from a detailed design document whose physics did not survive
numerical checking. Three findings, all verified before writing gameplay code:

1. **The published Magnus formula is dimensionally invalid.** `F = ½·ρ·A·C_m·(ω × v)`
   evaluates to newtons *per metre*. Even after restoring the missing length, the given
   coefficients bend the ball **14 cm** over a full flight — invisible. The lift form above
   was substituted and produces the expected 1.5–4 m banana.
2. **A fixed 15–38 m/s speed range is unplayable.** The band of launch angles that clears the
   wall and stays under the bar collapses from 11.5° at 24 m/s to **1.2° at 38 m/s** — far
   under what a thumb can hit. Launch speed is therefore anchored to the kick distance, and
   power trims around it.
3. **The published keeper reach envelope makes reflexes a dead stat.** Its 2.88 m disc always
   binds before travel time does: measured goal coverage was identical at 0.95 s, 1.15 s and
   1.45 s of flight. Replaced with a per-axis dive plus a push-off phase, after which coverage
   moves properly with flight time (46% → 71% → 93%).

## Fiction

Every player, club, league and nation in this game is invented. Any resemblance to a real
club, competition or footballer is coincidental.

A Matt's Apps game · madebymatt.uk
