# Neon Meridian and Rally Vector 3D — launch record

Two register-worthy findings, and the hue ruling.

---

## 1. The parked-car harness trap

**Every flash measurement taken of Rally Vector 3D, across three separate
instruments and more than thirty runs, measured a car standing still.**

Clicking `#startBtn` begins a 3.8-second countdown; the car sits on the line
through it. Snow kept falling, so the frame kept moving, so the vacuity guard —
which asks "did the frame move" — passed every time. The world was simply not
going past the camera.

This is the fourth distinct vacuity in one commission, and the most dangerous,
because the first three announced themselves as identical numbers or as zeroes.
This one produced a *plausible spread* (1.6–3.4 Hz) that survived a ten-run
repeatability study and a two-harness comparison. It was only caught by probing
the game's own HUD and finding `speed: 0`.

**The lesson is not "add a vacuity guard".** It is that a vacuity guard checks a
proxy. "Did it move" is not "is this the scene I meant to measure", and the gap
between those two questions held for three passes.

What the instruments now do, and what any future census should:

- assert the SCENE STATE, not just motion — `mode === 'running'`, `speed >= 15`,
  `progress >= 0.05`, read out of the game through a named seam;
- print that state beside every row, so a number can be read against the
  conditions that produced it;
- keep a control that is EXPECTED to be still, so the guard itself is proved.

Holding the throttle straight did not fix it either — measured speed 15.76 at
60 frames, then 0.89 and pinned: the car was in a snowbank. Sustained driving
needed an autopilot steering the racing line off the game's own track sampling.

Related, same family: a canvas read from OUTSIDE a frame returns a cleared
buffer when the context is taken with `preserveDrawingBuffer:false`. That
artifact alone produced seven false "hostile save killed the game" findings
before it was caught.

---

## 2. The shelf gamut is full at 48 entries

Measured, not asserted. Neither game's own colour clears the ΔE00 20 floor:

| candidate | source | nearest shelf neighbour | ΔE00 |
|---|---|---|---|
| `#58f2cf` | Neon Meridian `--accent` | Axiom Shift `#5EEAD4` | **3.92** |
| `#ffd45f` | Rally `--gold` | Neon Breach `#FFD000` | **5.67** |
| `#5ee2b8` | Rally `--mint` | Axiom Shift `#5EEAD4` | 6.36 |
| `#67d8ff` | Rally `--cyan` | Voxel Frontier `#87CEEB` | 4.44 |
| `#ffb34f` | Rally `--amber` | Hold the Mark `#F6AD55` | 2.41 |

A search over the whole sRGB gamut says this is structural, not bad luck:

- the minimal shift clearing the floor lands on **near-white** (`#edffde`,
  `#f9e1cf`);
- holding chroma ≥ 45 forces a shift of ΔE00 **30.6** (to olive `#829e36`) —
  no longer the game's colour in any sense;
- the freest regions in the whole gamut are very pale and very dark navy
  (`#000030`, max separation 36.5).

**At 48 entries there is no room left for a vivid new hue at floor 20.**

### The ruling, and why it is right

The games wear their own colours. `#58f2cf` and `#ffd45f` ship, with the
breaches above on the record.

The number that settles it: the two shipped hues are **ΔE00 36.65 from each
other**, where the "compliant" pale pair were only 20.13. The floor exists to
make cards distinguishable, and obeying it here would have produced two
off-whites that are *less* distinguishable from one another than the identity
colours are — while also being distinguishable from nothing else in particular.
A metric that can only be satisfied by abandoning what it is a proxy for has
stopped measuring the thing.

**No committed validator enforces a shelf-wide ΔE00 floor.** `check_audience_accents.py`
governs audience-homepage accents against a contrast bar, not the games shelf;
`verify_apextennis.js` pins that one game's hue against three named colours in
RGB distance. So there was no exceptions path to add to, and nothing was
weakened — this record IS the recorded exception.

Known open collision, untouched and not added to: Off-Brand / Glitch Clash at
ΔE00 0.00 with each other.

### What this means next time

The shelf cannot keep absorbing games at this floor. The next launch faces the
same wall, and the choice is a product one: relax the floor and record
breaches as here, retire or recolour older entries, or accept that hue stops
being the shelf's distinguishing device and let the card art carry it.
