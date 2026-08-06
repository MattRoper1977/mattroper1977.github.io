"""Pick Fracture Engine's shelf hue by CIEDE2000, not by eye.

Constraint (Pass 4a):
  * dE00 >= 12 from the live Relicforge #d05cff (the franchise sibling)
  * dE00 >= 10 from EVERY other hue already on the shelf

Candidates are drawn from the game's OWN palette tokens plus deliberate
variations of them, so whatever wins still belongs to this game.
"""
import json, math, re, itertools

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

def rgb2lab(rgb):
    def f(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (f(c) for c in rgb)
    x = (0.4124564*r + 0.3575761*g + 0.1804375*b) / 0.95047
    y = (0.2126729*r + 0.7151522*g + 0.0721750*b) / 1.00000
    z = (0.0193339*r + 0.1191920*g + 0.9503041*b) / 1.08883
    def g_(t):
        return t ** (1/3) if t > 216/24389 else (841/108) * t + 4/29
    fx, fy, fz = g_(x), g_(y), g_(z)
    return (116*fy - 16, 500*(fx - fy), 200*(fy - fz))

def ciede2000(lab1, lab2):
    L1, a1, b1 = lab1; L2, a2, b2 = lab2
    kL = kC = kH = 1.0
    C1 = math.hypot(a1, b1); C2 = math.hypot(a2, b2)
    Cbar = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cbar**7 / (Cbar**7 + 25**7))) if Cbar > 0 else 0
    a1p = (1 + G) * a1; a2p = (1 + G) * a2
    C1p = math.hypot(a1p, b1); C2p = math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    else:
        dh = h2p - h1p
        dhp = dh - 360 if dh > 180 else (dh + 360 if dh < -180 else dh)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp) / 2)
    Lbar = (L1 + L2) / 2
    Cbarp = (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbarp = h1p + h2p
    else:
        d = abs(h1p - h2p)
        s = h1p + h2p
        hbarp = (s + 360) / 2 if d > 180 and s < 360 else ((s - 360) / 2 if d > 180 else s / 2)
    T = (1 - 0.17*math.cos(math.radians(hbarp - 30)) + 0.24*math.cos(math.radians(2*hbarp))
         + 0.32*math.cos(math.radians(3*hbarp + 6)) - 0.20*math.cos(math.radians(4*hbarp - 63)))
    dTheta = 30 * math.exp(-(((hbarp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbarp**7 / (Cbarp**7 + 25**7)) if Cbarp > 0 else 0
    Sl = 1 + (0.015 * (Lbar - 50)**2) / math.sqrt(20 + (Lbar - 50)**2)
    Sc = 1 + 0.045 * Cbarp
    Sh = 1 + 0.015 * Cbarp * T
    Rt = -Rc * math.sin(2 * math.radians(dTheta))
    return math.sqrt((dLp/(kL*Sl))**2 + (dCp/(kC*Sc))**2 + (dHp/(kH*Sh))**2
                     + Rt * (dCp/(kC*Sc)) * (dHp/(kH*Sh)))

def dE(h1, h2):
    return ciede2000(rgb2lab(hex2rgb(h1)), rgb2lab(hex2rgb(h2)))

games = json.load(open('/home/user/Games/games.json'))['games']
shelf = [(g['title'], g['hue']) for g in games]
RELICFORGE = '#d05cff'

# Candidates: the game's own palette tokens, read out of the game file, plus
# lightness/saturation variants of each so the search has room to move.
src = open('/workspace/fx/index.html', encoding='utf-8').read()
tokens = dict(re.findall(r'--(bg|cyan|blue|violet|gold|red|green|orange):\s*(#[0-9a-fA-F]{6})', src))
print('palette tokens derived from the game:', tokens)

def variants(hexv):
    r, g, b = hex2rgb(hexv)
    out = []
    for scale in (0.55, 0.7, 0.85, 1.0):
        for lift in (0.0, 0.06, 0.12):
            rr, gg, bb = (min(1, c*scale + lift) for c in (r, g, b))
            out.append('#%02X%02X%02X' % (round(rr*255), round(gg*255), round(bb*255)))
    return out

cands = []
for name, hexv in tokens.items():
    if name == 'bg':
        continue
    for v in [hexv] + variants(hexv):
        cands.append((name, v.upper()))

best = []
for name, c in cands:
    d_rf = dE(c, RELICFORGE)
    others = sorted(((dE(c, h), t, h) for t, h in shelf), key=lambda x: x[0])
    nearest = others[0]
    if d_rf >= 12 and nearest[0] >= 10:
        best.append((nearest[0], d_rf, name, c, nearest))

best.sort(key=lambda x: -x[0])
print(f'\n{len(best)} candidates clear both thresholds. Top 8 by nearest-neighbour distance:\n')
for nearest_d, d_rf, name, c, nearest in best[:8]:
    print(f'  {c}  (from --{name})  nearest shelf hue {nearest_d:5.2f} -> {nearest[1][:38]} {nearest[2]}   dE00 vs Relicforge {d_rf:5.2f}')

if best:
    nearest_d, d_rf, name, c, nearest = best[0]
    second = sorted(((dE(c, h), t, h) for t, h in shelf), key=lambda x: x[0])[1]
    print(f'\nWINNER {c} (derived from the game\'s --{name})')
    print(f'  dE00 vs live Relicforge {RELICFORGE}: {d_rf:.2f}  (floor 12)')
    print(f'  nearest shelf neighbour: {nearest_d:.2f} -> {nearest[1]} {nearest[2]}  (floor 10)')
    print(f'  second nearest:          {second[0]:.2f} -> {second[1]} {second[2]}')
else:
    print('\nNO CANDIDATE CLEARS BOTH THRESHOLDS — widen the search rather than lowering a floor.')
