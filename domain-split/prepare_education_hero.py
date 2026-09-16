#!/usr/bin/env python3
"""EDU-HERO-20260915 (CX2 §5.1): derive the Education hero artwork from Matt's approved
sources, or prove the committed artwork still is that derivation.

    python3 prepare_education_hero.py --source-home 27988.jpg --source-teachers exec-c1f6aed3.png --write
    python3 prepare_education_hero.py --check

The order names two approved images by SHA-256 (homepage owl-and-resources, Teachers
"04 / LEARNING COMES TO LIFE"). Both are device mock-ups with slogans and frames baked
into the raster, and the order's answer to "no image-editing workflow" is an
intentional crop with the deviation recorded — so the ONLY operation here is a crop
of the source pixels (PIL Image.crop, no repaint, no resample) re-encoded as a
baseline-progressive JPEG. education-hero.json records, per image, the source
digest, the crop box in source pixels, the intrinsic size, the served bytes' digest
and the refinements (1-7) the crop does and does not satisfy. The renderer refuses to
place an image whose bytes do not match the manifest, and --check re-proves the
committed files against it without needing the sources.
"""
from pathlib import Path
import argparse, hashlib, json, sys

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / 'education-hero.json'
SOURCES = {
    'home': {'name': '27988.jpg', 'sha256': 'c6c1b9e8d6fb78b4b044d521cd75cef389e8b2a5a3f478f95ec718b79932b248'},
    'teachers': {'name': 'exec-c1f6aed3 (Teachers "04 / LEARNING COMES TO LIFE")',
                 'sha256': '4cdfedd8b48fa7efdc0debd6a7c332a9fba0e4547c147291d46bab0d0360e77e'},
}
# Crop boxes in source pixels (left, top, right, bottom): the desktop screen's photo
# panel, cut inside the mock-up's bezel and above the handwritten slogan.
CUTS = [
    {'key': 'home', 'source': 'home', 'file': 'hero/education-hero-home.jpg', 'published': 'assets/education-hero-home.jpg',
     'box': [885, 100, 1485, 338], 'use': 'Homepage hero, tablet and desktop widths',
     'kept': ['owl breathing room at the top and right of the frame', 'globe, pencils, prism, subject book spines',
              'cream/navy/sage palette of the approved render', 'no mock-up frame or device bezel in the crop'],
     'deviations': ['the prism still stands in front of the owl (refinement 2 needs a repaint, not a crop)',
                    'the source is a 1536px mock-up, so the crop is 600px wide and renders at about 1x on a phone']},
    {'key': 'homePhone', 'source': 'home', 'file': 'hero/education-hero-home-phone.jpg', 'published': 'assets/education-hero-home-phone.jpg',
     'box': [1000, 118, 1320, 298], 'use': 'Homepage hero on phones (simplified foreground: owl and globe only)',
     'kept': ['owl face centred with room above it', 'no slogan, frame or embedded text in the crop'],
     'deviations': ['the prism still stands in front of the owl', '320px wide from a 1536px mock-up, about 1x on a phone']},
    {'key': 'teachers', 'source': 'teachers', 'file': 'hero/education-hero-teachers.jpg', 'published': 'assets/education-hero-teachers.jpg',
     'box': [905, 95, 1335, 480], 'use': 'Teachers front door hero (all widths; phones crop it with CSS)',
     'kept': ['teacher and two pupils at the desk, prism and rainbow', 'the wall slogan and the book spines fall outside the crop'],
     'deviations': ['generated people; alt text is empty and they are never labelled as staff or pupils']},
]


def sha(data): return hashlib.sha256(data).hexdigest()


def derive(sources, write):
    from PIL import Image
    images = {}
    opened = {}
    for key, path in sources.items():
        data = Path(path).read_bytes()
        if sha(data) != SOURCES[key]['sha256']:
            raise SystemExit('Source is not the approved image (' + key + '): ' + sha(data))
        opened[key] = Image.open(path).convert('RGB')
    for cut in CUTS:
        crop = opened[cut['source']].crop(tuple(cut['box']))
        target = HERE / cut['file']
        if write:
            target.parent.mkdir(parents=True, exist_ok=True)
            crop.save(target, quality=85, optimize=True, progressive=True)
        data = target.read_bytes()
        images[cut['key']] = {'file': cut['file'], 'published': cut['published'], 'source': cut['source'],
                              'sourceSha256': SOURCES[cut['source']]['sha256'], 'sourceName': SOURCES[cut['source']]['name'],
                              'crop': cut['box'], 'width': crop.width, 'height': crop.height, 'bytes': len(data), 'sha256': sha(data),
                              'use': cut['use'], 'kept': cut['kept'], 'deviations': cut['deviations']}
    manifest = {'schemaVersion': 1, 'ruling': 'EDU-HERO-20260915 (CX2 §5.1)', 'operation': 'crop only (PIL Image.crop of the approved source pixels, JPEG quality 85, progressive); no repaint, no resample, no generated pixels',
                'alt': '', 'images': images}
    if write:
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    return manifest


def check():
    manifest = json.loads(MANIFEST.read_text())
    problems = []
    for key, image in manifest['images'].items():
        path = HERE / image['file']
        if not path.is_file():
            problems.append('missing ' + image['file']); continue
        data = path.read_bytes()
        if sha(data) != image['sha256'] or len(data) != image['bytes']:
            problems.append('bytes differ from the manifest: ' + image['file'])
        if 'owl' in image['published'].lower() or 'owl' in image['file'].lower():
            problems.append('published name must not carry the subject word: ' + image['published'])
        if image['sourceSha256'] != SOURCES[image['source']]['sha256']:
            problems.append('source digest drifted: ' + key)
        try:
            from PIL import Image
            with Image.open(path) as opened:
                if (opened.width, opened.height) != (image['width'], image['height']):
                    problems.append('intrinsic size differs: ' + key)
        except ImportError:
            pass
    return problems


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--source-home'); ap.add_argument('--source-teachers'); ap.add_argument('--write', action='store_true'); ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    if args.check:
        problems = check()
        print(json.dumps({'result': 'FAIL' if problems else 'PASS', 'problems': problems}))
        sys.exit(1 if problems else 0)
    if not (args.source_home and args.source_teachers):
        ap.error('--source-home and --source-teachers (or --check)')
    manifest = derive({'home': args.source_home, 'teachers': args.source_teachers}, args.write)
    print(json.dumps({k: {'size': [v['width'], v['height']], 'bytes': v['bytes'], 'sha256': v['sha256']} for k, v in manifest['images'].items()}, indent=1))
