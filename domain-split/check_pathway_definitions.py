#!/usr/bin/env python3
"""D-3: the three pathways on the education front door, proved from their sources.

J93 (rulings uz-6 (g), (h), vb-3 (e), (h)): the pathways band (.fd-pathways) is
retired on the homepage. Its place is the flagship strip (section#pathways): three
cards, one per pathway, each with the pathway chip and the owner's byline of spec
section 6. The definition checks move to those three bylines and the forbidden-word
screen (the R11 list carried in domain-split/pathway-definitions.json) is kept,
now over the whole flagship strip.

--self-test  renders the real homepage through build_publications.render_page and asserts
             that the strip carries exactly BUILD, GROW and LAUNCH in that order (the
             record's keys), that each chip is the record's pathway name, that each
             byline is present and is the owner's words of record (by digest, as
             home_slots confirms them — never retyped here), that no forbidden term
             appears anywhere in the strip, and that the retired band is absent.
             Then it plants failures and requires each to red:
               1. an empty byline              -> the binder refuses to build
               2. a forbidden term in a byline -> the binder refuses to build
               3. the pathways out of order     -> the binder refuses to build
               4. a rendered page with one byline blanked     -> this check reds
               5. a rendered page with a forbidden term added -> this check reds
               6. a rendered page with two cards swapped      -> this check reds
             (and the legacy band helper, still in the builder until it is retired,
             keeps its three manifest refusals), and finally re-renders the real
             page and requires it green again, so a plant can never leak into the verdict.
"""
import argparse
import hashlib
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
import home_slots  # noqa: E402
from check_ux2_home import render_home, parse_home, DEFAULT_LESSONS  # noqa: E402

BYLINE = re.compile(home_slots.OWNER_PATTERNS['pathway bylines'])


class Strip(HTMLParser):
    """The text of the flagship strip, section#pathways, as the parser sees it."""

    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.found = 0
        self.band = 0
        self.text = ''

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'section' and 'fd-pathways' in (a.get('class') or '').split():
            self.band += 1
        if self.depth == 0 and tag == 'section' and a.get('id') == 'pathways':
            self.found += 1
            self.depth = 1
            return
        if self.depth and tag not in self.VOID:
            self.depth += 1

    def handle_endtag(self, tag):
        if self.depth and tag not in self.VOID:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.text += data


def strip_errors(page_html, record):
    strip = Strip()
    strip.feed(page_html)
    errors = []
    if strip.found != 1 or not strip.text.strip():
        errors.append('the flagship strip (section#pathways) was not found')
    if strip.band:
        errors.append('the retired pathways band is still on the homepage')
    cards = parse_home(page_html).cards
    keys = [c['key'] for c in cards]
    if [k.lower() for k in keys] != [r['key'] for r in record['pathways']]:
        errors.append('strip does not carry exactly build, grow, launch in order: ' + repr(keys))
    for r, card in zip(record['pathways'], cards):
        if card['pathway'] != r['name']:
            errors.append('chip label differs for ' + r['key'] + ': ' + repr(card['pathway']))
        if not card['byline']:
            errors.append('byline is empty for ' + r['key'])
    # The owner's words of record (spec section 6), in pathway order, by digest of the bound markup.
    digests = [hashlib.sha256(m.encode('utf-8')).hexdigest() for m in BYLINE.findall(page_html)]
    if digests != home_slots.OWNER_WORDS['pathway bylines']:
        errors.append('the pathway bylines are not the owner words of record, in order')
    low = strip.text.lower()
    hits = [w for w in record['forbidden'] if str(w).lower() in low]
    if hits:
        errors.append('forbidden terms present in the flagship strip: ' + str(len(hits)))
    return errors


def binder_refusal(template, sources):
    try:
        home_slots.bind(template, sources, check_digest=False)
    except ValueError as refusal:
        return str(refusal)
    return None


def self_test(lessons_root):
    import shared_navigation
    record = json.loads((HERE / fd.PATHWAY_MANIFEST).read_text())
    real = render_home(bp.AUDIENCE_RECORD, lessons_root)
    errors = strip_errors(real, record)
    assert not errors, errors
    planted = []
    template = home_slots.TEMPLATE.read_text(encoding='utf-8')
    config = json.loads((HERE / 'config.json').read_text())
    saved_root = bp.LESSONS_ROOT
    bp.LESSONS_ROOT = Path(lessons_root)
    try:
        sources = home_slots.gather(config['education_origin'], bp.ROOT, bp.LESSONS_ROOT, bp.SUBJECT_CARDS,
                                    shared_navigation.HUB_LINKS, shared_navigation.PLAY)
    finally:
        bp.LESSONS_ROOT = saved_root
    assert home_slots.bind(template, sources) == real, 'the binder and the builder disagree on the real page'
    first = BYLINE.search(template)
    forbidden = record['forbidden'][0]
    for name, bad in (
        ('empty byline', template[:first.start(1)] + template[first.end(1):]),
        ('forbidden term', template[:first.end(1)] + ' Placed by ' + forbidden + ' score.' + template[first.end(1):]),
        ('out of order', template.replace('data-pathway-card="BUILD"', 'data-pathway-card="§"', 1)
                                 .replace('data-pathway-card="LAUNCH"', 'data-pathway-card="BUILD"', 1)
                                 .replace('data-pathway-card="§"', 'data-pathway-card="LAUNCH"', 1)),
    ):
        assert bad != template, 'the plant did not change the draft'
        refusal = binder_refusal(bad, sources)
        with tempfile.TemporaryDirectory() as tmp:  # and through the builder: a moved draft is refused by digest
            draft = Path(tmp) / 'home.html'
            draft.write_text(bad, encoding='utf-8')
            saved = home_slots.TEMPLATE
            home_slots.TEMPLATE = draft
            try:
                render_home(bp.AUDIENCE_RECORD, lessons_root)
            except ValueError as digest_refusal:
                built = str(digest_refusal)
            else:
                built = None
            finally:
                home_slots.TEMPLATE = saved
        planted.append({'plant': name, 'observedRed': bool(refusal) and bool(built), 'binderRefusal': (refusal or '')[:60]})
    for name, page, needle in (
        ('rendered page with one byline blanked', re.sub(r'(<p class="home-pathway-byline">)[^<]*(</p>)', r'\1\2', real, count=1), 'byline is empty'),
        ('rendered page with a forbidden term added', re.sub(r'(<p class="home-pathway-byline">[^<]*)(</p>)', lambda m: m.group(1) + ' ' + forbidden + m.group(2), real, count=1), 'forbidden terms present'),
        ('rendered page with two cards swapped', real.replace('data-pathway-card="GROW"', 'data-pathway-card="§"', 1)
                                                     .replace('data-pathway-card="LAUNCH"', 'data-pathway-card="GROW"', 1)
                                                     .replace('data-pathway-card="§"', 'data-pathway-card="LAUNCH"', 1), 'in order'),
    ):
        assert page != real, 'the plant did not change the page'
        planted.append({'plant': name, 'observedRed': any(needle in e for e in strip_errors(page, record))})
    # The legacy band helper (no longer on any page, kept until its own retirement, LD7) still refuses a bad manifest.
    record_path = HERE / fd.PATHWAY_MANIFEST
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        saved = fd.PATHWAY_MANIFEST
        try:
            for name, mutate in (
                ('band helper: empty definition', lambda r: r['pathways'][1].__setitem__('definition', '')),
                ('band helper: forbidden term', lambda r: r['pathways'][0].__setitem__('definition', r['pathways'][0]['definition'] + ' Placed by ' + r['forbidden'][0] + ' score.')),
                ('band helper: out of order', lambda r: r['pathways'].reverse()),
            ):
                bad = json.loads(record_path.read_text())
                mutate(bad)
                plant = tmp / (name.replace(' ', '-').replace(':', '') + '.json')
                plant.write_text(json.dumps(bad))
                fd.PATHWAY_MANIFEST = str(plant)
                try:
                    fd.pathways(bp)
                except ValueError:
                    planted.append({'plant': name, 'observedRed': True})
                else:
                    planted.append({'plant': name, 'observedRed': False})
        finally:
            fd.PATHWAY_MANIFEST = saved
    assert all(p['observedRed'] for p in planted), planted
    assert not strip_errors(render_home(bp.AUDIENCE_RECORD, lessons_root), record), 'the real page must be green again after the plants'
    print(json.dumps({'result': 'PASS', 'pathways': [r['name'] for r in record['pathways']], 'bylinesOfRecord': len(home_slots.OWNER_WORDS['pathway bylines']),
                      'forbiddenTermsChecked': len(record['forbidden']), 'planted': [{k: v for k, v in p.items() if k != 'binderRefusal'} for p in planted]}, indent=2))
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--lessons', type=Path, default=None, help='Lessons checkout (default: .sources/Lessons beside this repository)')
    args = ap.parse_args()
    lessons = args.lessons or (DEFAULT_LESSONS if DEFAULT_LESSONS.is_dir() else bp.LESSONS_ROOT)
    if args.self_test:
        if lessons is None:
            ap.error('the J93 homepage needs a Lessons checkout (--lessons)')
        return self_test(Path(lessons).resolve())
    ap.error('--self-test is the only mode')


if __name__ == '__main__':
    sys.exit(main())
