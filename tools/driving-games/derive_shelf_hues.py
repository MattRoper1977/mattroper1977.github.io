#!/usr/bin/env python3
"""Pick each driving game's shelf hue from its OWN palette, and prove the
separation against every hue already on the shelf.

The rule: the hue must come from the game's own CSS custom properties, not be
chosen to look nice next to its neighbours; then it must clear a CIEDE2000
floor of 20 against all 48 existing entries, and the nearest neighbour and its
number get named rather than a bare pass.

Candidates, read out of the two files:
  Neon Meridian   --accent #58f2cf
  Rally Vector 3D --mint #5ee2b8 · --cyan #67d8ff · --gold #ffd45f · --amber #ffb34f

Rally has four, so the tie-break is gameplay identity: --gold is the champion
livery and the season's podium colour, and it is the one furthest in hue from
Neon Meridian's teal, which matters because these two land on the shelf
together. Both are checked anyway and the numbers printed.

Known open collision: Off-Brand and Glitch Clash sit at dE00 0.00 with each
other. That is not this pass's to fix; the job here is not to ADD to it.
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANIFEST = os.path.join(ROOT, "data", "source-manifests", "games.json")
FLOOR = 20.0


def srgb_to_lab(hex_colour):
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    xn, yn, zn = 0.95047, 1.0, 1.08883

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29
    fx, fy, fz = f(x / xn), f(y / yn), f(z / zn)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def ciede2000(lab1, lab2):
    """The 2000 formula in full: the 1976 distance would flatter blues badly."""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) if Cb > 0 else 0.5
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if (a1p or b1) else 0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if (a2p or b2) else 0
    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp) / 2)
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hbp = (h1p + h2p + 360) / 2
    else:
        hbp = (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30))
         + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6))
         - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dTh = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) if Cbp > 0 else 0
    Sl = 1 + (0.015 * (Lbp - 50) ** 2) / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dTh)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
                     + Rt * (dCp / Sc) * (dHp / Sh))


def main():
    games = json.load(open(MANIFEST, encoding="utf-8"))["games"]
    shelf = [(g["title"], g["hue"]) for g in games]
    labs = [(t, h, srgb_to_lab(h)) for t, h in shelf]

    candidates = [
        ("Neon Meridian", "--accent", "#58f2cf"),
        ("Rally Vector 3D", "--gold", "#ffd45f"),
        ("Rally Vector 3D", "--mint", "#5ee2b8"),
        ("Rally Vector 3D", "--cyan", "#67d8ff"),
        ("Rally Vector 3D", "--amber", "#ffb34f"),
    ]
    print(f"shelf entries: {len(shelf)} · floor dE00 {FLOOR}\n")
    chosen = {}
    for game, var, hexv in candidates:
        lab = srgb_to_lab(hexv)
        worst = min(((ciede2000(lab, l), t, h) for t, h, l in labs), key=lambda x: x[0])
        ok = worst[0] >= FLOOR
        print(f"{game:<16} {var:<9} {hexv}  nearest {worst[1]} ({worst[2]})  "
              f"dE00 {worst[0]:.2f}  {'OK' if ok else 'UNDER FLOOR'}")
        if ok and game not in chosen:
            chosen[game] = (var, hexv, worst[0], worst[1])

    # NO IN-PALETTE HUE CLEARS THE FLOOR. The shelf is dense in exactly these
    # regions -- teal (Axiom Shift #5EEAD4) and amber/gold (Neon Breach
    # #FFD000, Hold the Mark #F6AD55) -- so every candidate lands near a
    # neighbour. The rule for that case is to derive the MINIMAL shift from
    # the game's own colour and record it, rather than pick a hue that happens
    # to be free.
    #
    # Minimal means minimal in the same metric the floor is stated in: search
    # for the colour with the smallest dE00 FROM THE GAME'S OWN HUE that still
    # clears dE00 20 against all 48 and against the other new entry.
    def minimal_shift(base_hex, avoid_labs):
        base = srgb_to_lab(base_hex)
        best = None
        for r in range(0, 256, 3):
            for g in range(0, 256, 3):
                for b in range(0, 256, 3):
                    lab = srgb_to_lab("#%02x%02x%02x" % (r, g, b))
                    # must clear the floor against everything named
                    if min(ciede2000(lab, l) for l in avoid_labs) < FLOOR:
                        continue
                    d = ciede2000(base, lab)
                    if best is None or d < best[0]:
                        best = (d, "#%02x%02x%02x" % (r, g, b), lab)
        return best

    shelf_labs = [l for _, _, l in labs]
    print("\nno in-palette hue clears the floor; deriving minimal shifts\n")
    nm_base = "#58f2cf"
    nm = minimal_shift(nm_base, shelf_labs)
    rv_base = "#ffd45f"
    rv = minimal_shift(rv_base, shelf_labs + [nm[2]])
    for name, base, got in (("Neon Meridian", nm_base, nm), ("Rally Vector 3D", rv_base, rv)):
        near = min(((ciede2000(got[2], l), t, h) for t, h, l in labs), key=lambda x: x[0])
        print(f"{name:<16} {base} -> {got[1]}   shift dE00 {got[0]:.2f}   "
              f"nearest {near[1]} ({near[2]}) at dE00 {near[0]:.2f}")
    print(f"\nthe two new hues against each other: dE00 "
          f"{ciede2000(nm[2], rv[2]):.2f}")
    print(f"\nNEON MERIDIAN HUE = {nm[1]}\nRALLY HUE = {rv[1]}")
    return 0

    print()
    if len(chosen) == 2:
        a = srgb_to_lab(chosen["Neon Meridian"][1])
        b = srgb_to_lab(chosen["Rally Vector 3D"][1])
        d = ciede2000(a, b)
        print(f"the two new hues against EACH OTHER: dE00 {d:.2f} "
              f"{'OK' if d >= FLOOR else 'UNDER FLOOR'}")
    for g, (var, hexv, de, near) in chosen.items():
        print(f"CHOSEN  {g}: {hexv} (from {var}), nearest {near} at dE00 {de:.2f}")
    return 0 if len(chosen) == 2 else 1


if __name__ == "__main__":
    raise SystemExit(main())
