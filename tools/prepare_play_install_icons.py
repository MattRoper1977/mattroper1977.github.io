#!/usr/bin/env python3
"""Derive Play's install icons from the accepted Play mark; never redraw it.

    python tools/prepare_play_install_icons.py --write   # regenerate the PNGs and the record
    python tools/prepare_play_install_icons.py --check   # prove the committed PNGs and record

PLAY-I1 (CX2 §9.2). The Play manifest and the root apple-touch-icon used to point at the
education "M" square; an install from madebymatt-play.uk therefore carried Education
branding on the home screen. The accepted Play mark (domain-split/play/approved-mark.jpg,
source sha in brand.json, "use the supplied image unchanged") is 1536x1012 with the ring
off-centre on a gradient field. An app icon must be square, so this takes one square
crop of full height centred on the ring (the ring is located by its own mint colour, not
by a typed box), and resizes it with LANCZOS. Crop and resize only: no repaint, no
recolour, no new artwork. The ring occupies about 58% of the crop, inside the 80% safe
zone Android's maskable icons require, so the same crop serves purpose "any" and
"maskable". The record binds source sha, crop box, ring box and every output sha; --check
re-derives all of it and refuses drift.
"""
import argparse, hashlib, io, json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'domain-split/play/approved-mark.jpg'
BRAND = ROOT / 'domain-split/play/brand.json'
RECORD = ROOT / 'domain-split/play/install-icons.json'
OUTPUTS = {  # destination: (side, purpose)
    'assets/icons/play-icon-192.png': 192,
    'assets/icons/play-icon-512.png': 512,
    'assets/icons/play-apple-touch-icon.png': 180,
}

def sha(data): return hashlib.sha256(data).hexdigest()

def ring_box(im):
    """Bounding box of the mint ring: pixels where green leads red and blue by a clear margin."""
    px = im.load(); w, h = im.size; xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if g > 150 and g - r > 35 and g - b > 20: xs.append(x); ys.append(y)
    if not xs: raise SystemExit('ring not found')
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

def derive():
    raw = SOURCE.read_bytes()
    brand = json.loads(BRAND.read_text())
    if sha(raw) != brand['sha256']: raise SystemExit('approved mark differs from brand.json')
    im = Image.open(io.BytesIO(raw)).convert('RGB'); w, h = im.size
    rb = ring_box(im); cx = (rb[0] + rb[2]) // 2
    side = h; left = min(max(cx - side // 2, 0), w - side)
    box = (left, 0, left + side, side)
    square = im.crop(box)
    outputs = {}
    for dest, size in OUTPUTS.items():
        buf = io.BytesIO(); square.resize((size, size), Image.LANCZOS).save(buf, format='PNG', optimize=True)
        outputs[dest] = {'size': f'{size}x{size}', 'bytes': len(buf.getvalue()), 'sha256': sha(buf.getvalue()), 'png': buf.getvalue()}
    ring_share = round((rb[2] - rb[0]) / side, 3)
    record = {'source': {'file': 'domain-split/play/approved-mark.jpg', 'sha256': sha(raw), 'size': f'{w}x{h}'},
              'ring_box': list(rb), 'crop_box': list(box), 'ring_share_of_icon': ring_share,
              'method': 'one full-height square crop centred on the mint ring, LANCZOS resize, PNG; no repaint',
              'maskable_safe_zone': 'ring within the central 80%' if ring_share <= 0.8 else 'RING EXCEEDS SAFE ZONE',
              'outputs': {k: {kk: vv for kk, vv in v.items() if kk != 'png'} for k, v in outputs.items()}}
    return record, outputs

def main():
    ap = argparse.ArgumentParser(); g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--write', action='store_true'); g.add_argument('--check', action='store_true'); a = ap.parse_args()
    record, outputs = derive()
    if record['maskable_safe_zone'].startswith('RING'): raise SystemExit('ring exceeds the maskable safe zone')
    if a.write:
        for dest, v in outputs.items(): (ROOT / dest).write_bytes(v['png'])
        RECORD.write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps({k: v for k, v in record.items() if k != 'outputs'}, indent=1)); print('written', list(outputs))
        return
    committed = json.loads(RECORD.read_text())
    if committed != record: raise SystemExit('FAIL install-icons.json differs from a fresh derivation')
    for dest, v in outputs.items():
        if sha((ROOT / dest).read_bytes()) != v['sha256']: raise SystemExit(f'FAIL {dest} differs from its record')
    print(f'PASS {len(outputs)} Play install icons match their record (ring {record["ring_share_of_icon"]:.0%} of the icon)')

if __name__ == '__main__': main()
