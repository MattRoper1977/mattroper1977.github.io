#!/usr/bin/env python3
"""D-3: the three pathway definitions on the education front door, proved from one source.

--self-test  renders the real homepage through build_publications.render_page and asserts
             that the band carries exactly BUILD, GROW and LAUNCH in that order, that each
             chip's definition is byte-equal to domain-split/pathway-definitions.json, and
             that no forbidden term (the R11 list carried in that file) appears anywhere in
             the band. Then it plants four failures and requires each to red:
               1. an empty definition          -> the renderer refuses to build
               2. a forbidden term              -> the renderer refuses to build
               3. the pathways out of order     -> the renderer refuses to build
               4. a rendered page with one definition blanked -> this check reds
             and finally re-renders the real page and requires it green again, so a plant
             can never leak into the verdict.
"""
import argparse
import html
import json
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_publications as bp  # noqa: E402
import education_frontdoors as fd  # noqa: E402
from check_ux2_home import render_home  # noqa: E402


class Band(HTMLParser):
    """The .fd-pathways section as the parser sees it: chips and definitions in order."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.in_band = False
        self.text = ''
        self.blocks = []
        self._chip = None
        self._def = None
        self._stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'section' and 'fd-pathways' in cls:
            self.in_band = True
            self.depth = 0
        if not self.in_band:
            return
        self.depth += 1
        if 'fd-pathway' in cls and tag == 'div':
            self.blocks.append({'key': a.get('data-pathway'), 'chip': '', 'definition': ''})
        if 'fd-chip' in cls:
            self._chip = len(self.blocks) - 1
        if 'fd-pathway-def' in cls:
            self._def = len(self.blocks) - 1

    def handle_endtag(self, tag):
        if not self.in_band:
            return
        if tag == 'span':
            self._chip = None
        if tag == 'p':
            self._def = None
        self.depth -= 1
        if self.depth <= 0:
            self.in_band = False

    def handle_data(self, data):
        if not self.in_band:
            return
        self.text += data
        if self._chip is not None and self.blocks:
            self.blocks[self._chip]['chip'] += data
        if self._def is not None and self.blocks:
            self.blocks[self._def]['definition'] += data


def band_errors(page_html, record):
    band = Band()
    band.feed(page_html)
    errors = []
    expected = [(r['key'], r['name'], r['definition']) for r in record['pathways']]
    got = [(b['key'], b['chip'].strip(), b['definition'].strip()) for b in band.blocks]
    if [g[0] for g in got] != [e[0] for e in expected]:
        errors.append('band does not carry exactly build, grow, launch in order: ' + repr([g[0] for g in got]))
    for e, g in zip(expected, got):
        if g[1] != e[1]:
            errors.append('chip label differs for ' + e[0] + ': ' + repr(g[1]))
        if not g[2]:
            errors.append('definition is empty for ' + e[0])
        elif g[2] != e[2]:
            errors.append('definition differs from pathway-definitions.json for ' + e[0])
    low = band.text.lower()
    hits = [w for w in record['forbidden'] if str(w).lower() in low]
    if hits:
        errors.append('forbidden terms present in the band: ' + ', '.join(hits))
    if not band.text.strip():
        errors.append('the pathways band was not found')
    return errors


def self_test(lessons_root):
    record_path = HERE / fd.PATHWAY_MANIFEST
    record = json.loads(record_path.read_text())
    real = render_home(bp.AUDIENCE_RECORD, lessons_root)
    errors = band_errors(real, record)
    assert not errors, errors
    planted = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        saved = fd.PATHWAY_MANIFEST
        try:
            for name, mutate in (
                ('empty definition', lambda r: r['pathways'][1].__setitem__('definition', '')),
                ('forbidden term', lambda r: r['pathways'][0].__setitem__('definition', r['pathways'][0]['definition'] + ' Placed by ' + r['forbidden'][0] + ' score.')),
                ('out of order', lambda r: r['pathways'].reverse()),
            ):
                bad = json.loads(record_path.read_text())
                mutate(bad)
                plant = tmp / (name.replace(' ', '-') + '.json')
                plant.write_text(json.dumps(bad))
                fd.PATHWAY_MANIFEST = str(plant)
                try:
                    render_home(bp.AUDIENCE_RECORD, lessons_root)
                except ValueError as refusal:
                    planted.append({'plant': name, 'observedRed': True, 'refusal': str(refusal)})
                else:
                    planted.append({'plant': name, 'observedRed': False})
        finally:
            fd.PATHWAY_MANIFEST = saved
    blanked = re.sub(r'(<p class="fd-pathway-def">)[^<]*(</p>)', r'\1\2', real, count=1)
    assert blanked != real, 'the plant did not change the page'
    planted.append({'plant': 'rendered page with one definition blanked', 'observedRed': bool(band_errors(blanked, record))})
    assert all(p['observedRed'] for p in planted), planted
    assert not band_errors(render_home(bp.AUDIENCE_RECORD, lessons_root), record), 'the real page must be green again after the plants'
    print(json.dumps({'result': 'PASS', 'pathways': [r['name'] for r in record['pathways']], 'forbiddenTermsChecked': len(record['forbidden']), 'planted': planted}, indent=2))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--lessons', type=Path, default=None, help='Lessons checkout (default: the builder\'s LESSONS_ROOT)')
    args = ap.parse_args()
    lessons = args.lessons or bp.LESSONS_ROOT
    if args.self_test:
        return self_test(lessons)
    ap.error('--self-test is the only mode')


if __name__ == '__main__':
    sys.exit(main())
