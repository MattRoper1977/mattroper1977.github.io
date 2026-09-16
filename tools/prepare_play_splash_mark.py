#!/usr/bin/env python3
"""Derive the small inline copy of the accepted Play mark that the generated splash carries.

    python3 tools/prepare_play_splash_mark.py --write   # derive from the accepted source
    python3 tools/prepare_play_splash_mark.py --check   # the committed copy matches its record

PLAY-Q1 (CX2 §7.1): the splash region is one byte-identical block on every route and
must stay self-contained — a route may forbid external images (CyberPulse's CSP is
img-src data: blob:) and the Lessons games are single files by rule — so the mark is
inlined as a data URI. The copy is a PIL LANCZOS resize of Matt's accepted mark and
nothing else: no crop, no recolour, no redraw. Its record binds it to the accepted
source by SHA-256; --check refuses a copy whose bytes, size or source differ.
"""
from __future__ import annotations
import argparse, re, base64, hashlib, io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'domain-split/play/approved-mark.jpg'
BRAND = ROOT / 'domain-split/play/brand.json'
TARGET = ROOT / 'domain-split/play/splash-mark.jpg'
RECORD = ROOT / 'domain-split/play/splash-mark.json'
GENERATOR = ROOT / 'tools/render_maker_splash.py'
BLOCK = re.compile(r'# BEGIN PLAY SPLASH MARK.*?# END PLAY SPLASH MARK\n', re.S)
WIDTH, QUALITY = 240, 85


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def derive() -> tuple[bytes, dict]:
    from PIL import Image
    source = SOURCE.read_bytes()
    accepted = json.loads(BRAND.read_text())['sha256']
    if sha(source) != accepted:
        raise SystemExit(f'accepted mark digest differs from brand.json: {sha(source)}')
    image = Image.open(io.BytesIO(source))
    height = round(image.size[1] * WIDTH / image.size[0])
    small = image.resize((WIDTH, height), Image.LANCZOS)
    out = io.BytesIO(); small.save(out, 'JPEG', quality=QUALITY, optimize=True)
    data = out.getvalue()
    record = {'purpose': 'Inline copy of the accepted Play mark carried by the generated launch splash (tools/render_maker_splash.py)',
              'source': SOURCE.relative_to(ROOT).as_posix(), 'sourceSha256': accepted, 'sourceSize': list(image.size),
              'method': f'PIL Image.resize to {WIDTH}px wide, LANCZOS; JPEG quality {QUALITY}, optimize; no crop, no recolour, no redraw',
              'width': WIDTH, 'height': height, 'bytes': len(data), 'sha256': sha(data), 'published': 'data URI inside the MBM-MAKER-SPLASH region'}
    return data, record


def generator_block(data: bytes) -> str:
    uri = 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii')
    return ('# BEGIN PLAY SPLASH MARK (written by tools/prepare_play_splash_mark.py, do not edit by hand)\n'
            '# The inline copy of the accepted Play mark, bound to its source by domain-split/play/splash-mark.json.\n'
            'PLAY_MARK_URI = "' + uri + '"\n'
            '# END PLAY SPLASH MARK\n')


JS_MARK = re.compile(r'(<img src=")data:image/jpeg;base64,[A-Za-z0-9+/=]+(" alt="" width=)')


def write_generator(data: bytes) -> None:
    text = GENERATOR.read_text()
    if not BLOCK.search(text): raise SystemExit('generator has no PLAY SPLASH MARK block')
    if len(JS_MARK.findall(text)) != 1: raise SystemExit('generator JS block must carry exactly one inline mark')
    uri = 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii')
    text = BLOCK.sub(lambda _: generator_block(data), text, count=1)
    text = JS_MARK.sub(lambda m: m.group(1) + uri + m.group(2), text, count=1)
    GENERATOR.write_text(text)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true'); mode.add_argument('--check', action='store_true')
    a = ap.parse_args()
    if a.write:
        data, record = derive()
        TARGET.write_bytes(data); RECORD.write_text(json.dumps(record, indent=2) + '\n')
        write_generator(data)
        print(json.dumps(record, indent=2)); return 0
    record = json.loads(RECORD.read_text())
    problems = []
    if not TARGET.is_file(): problems.append('splash-mark.jpg missing')
    else:
        data = TARGET.read_bytes()
        if sha(data) != record['sha256']: problems.append(f'splash-mark.jpg sha256 {sha(data)} != record {record["sha256"]}')
        if len(data) != record['bytes']: problems.append(f'splash-mark.jpg is {len(data)} B, record says {record["bytes"]}')
        from PIL import Image
        size = Image.open(io.BytesIO(data)).size
        if list(size) != [record['width'], record['height']]: problems.append(f'splash-mark.jpg is {size}, record says {record["width"]}x{record["height"]}')
    if sha(SOURCE.read_bytes()) != record['sourceSha256']: problems.append('accepted source digest differs from the record')
    m = BLOCK.search(GENERATOR.read_text())
    if not m: problems.append('generator has no PLAY SPLASH MARK block')
    elif TARGET.is_file() and m.group(0) != generator_block(TARGET.read_bytes()): problems.append('generator PLAY_MARK_URI differs from splash-mark.jpg')
    if TARGET.is_file():
        hits = JS_MARK.findall(GENERATOR.read_text()); literal = re.search(r'<img src="(data:image/jpeg;base64,[A-Za-z0-9+/=]+)" alt="" width=', GENERATOR.read_text())
        if len(hits) != 1 or not literal or literal.group(1) != 'data:image/jpeg;base64,' + base64.b64encode(TARGET.read_bytes()).decode('ascii'): problems.append('generator JS block does not carry the recorded mark literally')
    if json.loads(BRAND.read_text())['sha256'] != record['sourceSha256']: problems.append('record source is not the brand.json accepted mark')
    for p in problems: print('FAIL ' + p)
    print('PASS splash mark matches its record' if not problems else f'{len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
