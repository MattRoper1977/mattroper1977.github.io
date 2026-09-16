#!/usr/bin/env python3
"""EDU-TRY-LESSON-20260915 (CX2 §5.3): bind the homepage "Try a lesson" rotation to the
published Lessons catalogue, or prove the committed binding still holds.

    python3 bind_homepage_features.py --lessons ../.sources/Lessons --write
    python3 bind_homepage_features.py --lessons ../.sources/Lessons --check

homepage-feature.json (schema 2) DECLARES only what a human decided: which companion
packs are eligible (accepted AND published EDU-Q1 identities, in order), the minute
count each lesson runs to, and the review note. Everything the card shows is DERIVED
here from the Lessons checkout the publisher builds from, and refused when it cannot be:

  lesson route    the pack row's companionOf, which must exist on disk (lessonSha256 pins it)
  title/reference assets/catalogue/display-titles.json for the pack file (id must match)
  description     the lesson's own catalogue row `desc`; a lesson without a row uses its
                  first "I can …" outcome sentence (descriptionSource records which)
  pathway/subject data/companion-packs.json, the pack's placement record
  duration        declared minutes, and the lesson text must carry "N-minute"/"N minutes"
  preview         homepage-previews.json for the pack; every image must be one of the pack
                  row's PDF files at its reviewed digest (education_frontdoors re-checks)
  pack route      /Lessons/pack.html?id=<packId>, and pack.html must exist in the tree

--check recomputes the binding from the same checkout and fails on any difference, so a
Lessons pin move that changes a lesson's bytes reds the build before it can serve a stale
card. Fewer than three eligible features render fewer slides; one renders a static card.
"""
from pathlib import Path
import argparse, hashlib, json, re, sys

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / 'homepage-feature.json'
PREVIEWS = HERE / 'homepage-previews.json'
DECLARED = ('packId', 'durationMinutes', 'reviewedAt', 'reviewBasis')


class BindingError(ValueError):
    """The catalogue no longer supports a declared feature; the caller decides
    whether that stops a build (education_frontdoors) or a command line (here)."""


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def outcome_sentence(html):
    text = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', html, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    match = re.search(r'I can [^.]{10,200}\.', text)
    return match.group(0) if match else None


def bind(lessons, manifest, previews_path=PREVIEWS):
    rows = json.loads((lessons / 'resources.json').read_text())
    titles = json.loads((lessons / 'assets/catalogue/display-titles.json').read_text())
    packs = {p['id']: p for p in json.loads((lessons / 'data/companion-packs.json').read_text())['packs']}
    previews = json.loads(Path(previews_path).read_text())
    if not (lessons / 'pack.html').is_file():
        raise BindingError('pack.html is not in the Lessons tree; the pack route cannot be bound')
    features = []
    for declared in manifest['features']:
        pack_id = declared['packId']
        row = next((r for r in rows if r.get('id') == pack_id), None)
        if not row or row.get('type') != 'support' or not row.get('companionOf'):
            raise BindingError('No companion-pack catalogue row: ' + pack_id)
        placement = packs.get(pack_id)
        if not placement or placement['companionOf'] != row['companionOf']:
            raise BindingError('Placement record disagrees with the catalogue row: ' + pack_id)
        lesson_file = row['companionOf']
        lesson = lessons / lesson_file
        if not lesson.is_file():
            raise BindingError('Lesson route is not in the tree: ' + lesson_file)
        entry = titles['entries'].get(row['file'])
        if not (titles.get('schema') == 1 and entry and entry.get('id') == pack_id and entry.get('originalTitle') == row['title']):
            raise BindingError('Display title map does not cover the pack: ' + pack_id)
        lesson_row = next((r for r in rows if (r.get('file') or r.get('url')) == lesson_file), None)
        html = lesson.read_text(encoding='utf-8')
        if lesson_row and lesson_row.get('desc'):
            description, source = lesson_row['desc'], 'catalogue row desc'
        else:
            description, source = outcome_sentence(html), 'lesson outcome sentence (no catalogue lesson row)'
        if not description:
            raise BindingError('No catalogue description for ' + lesson_file)
        minutes = int(declared['durationMinutes'])
        if not re.search(r'\b' + str(minutes) + r'(?:-| )minutes?\b', html):
            raise BindingError('Lesson text does not evidence a ' + str(minutes) + '-minute duration: ' + lesson_file)
        preview = previews.get(pack_id)
        if not preview or preview.get('resourceFile') != row['file']:
            raise BindingError('No prepared preview for ' + pack_id)
        listed = {f['path'] for f in row.get('files', []) if f.get('type') == 'pdf'}
        images = []
        for image in preview['images']:
            if image['source'] not in listed:
                raise BindingError('Preview source is not one of the pack row PDFs: ' + image['source'])
            if sha(lessons / image['source']) != image['sourceSha256']:
                raise BindingError('Preview source bytes differ from the reviewed digest: ' + image['source'])
            images.append({'source': image['source'], 'sourceSha256': image['sourceSha256'], 'role': image['role'], 'page': image['page'], 'width': image['width'], 'height': image['height']})
        features.append({**{k: declared[k] for k in DECLARED if k in declared},
                         'lessonFile': lesson_file, 'lessonSha256': sha(lesson), 'lessonRoute': '/Lessons/' + lesson_file,
                         'packFile': row['file'], 'packRoute': '/Lessons/pack.html?id=' + pack_id,
                         'displayTitle': entry['displayTitle'], 'reference': entry['reference'],
                         'description': description, 'descriptionSource': source,
                         'subject': placement['subject'], 'pathway': placement['pathway'], 'term': placement['term'],
                         'duration': str(minutes) + ' minutes', 'previews': images,
                         'previewWidth': images[0]['width'], 'previewHeight': images[0]['height']})
    return {**{k: v for k, v in manifest.items() if k != 'features'}, 'features': features}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--lessons', type=Path, required=True); ap.add_argument('--write', action='store_true'); ap.add_argument('--check', action='store_true')
    args = ap.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    if manifest.get('schemaVersion') != 2:
        raise SystemExit('homepage-feature.json must be schema 2')
    try:
        bound = bind(args.lessons.resolve(), manifest)
    except BindingError as error:
        print(json.dumps({'result': 'FAIL', 'reason': str(error)})); sys.exit(1)
    if args.write:
        MANIFEST.write_text(json.dumps(bound, indent=2, ensure_ascii=False) + '\n')
    if args.check and bound != manifest:
        drift = [f['packId'] for f, g in zip(bound['features'], manifest['features']) if f != g]
        print(json.dumps({'result': 'FAIL', 'drift': drift or 'shape'})); sys.exit(1)
    print(json.dumps({'result': 'PASS', 'features': [(f['packId'], f['displayTitle'], f['reference'], f['pathway'], f['descriptionSource']) for f in bound['features']]}, ensure_ascii=False))
