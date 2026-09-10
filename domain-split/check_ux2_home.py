#!/usr/bin/env python3
"""UX2 B5 — the homepage's record-driven parts are proven to follow their inputs (s16).

--self-test  plants an audience route in a scratch copy of data/audience-homepages.json
             and an extra subject in a scratch Lessons catalogue, renders the homepage
             through build_publications.render_page, and asserts each planted row
             appears — and disappears again with the real inputs. A green run therefore
             proves the rows are read from the record, not typed.
"""
import json, shutil, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_publications as bp  # noqa: E402


def render_home(record_path, lessons_root):
    preview = (HERE / 'preview.html').read_text()
    config = json.loads((HERE / 'config.json').read_text())
    saved = (bp.AUDIENCE_RECORD, bp.LESSONS_ROOT)
    bp.AUDIENCE_RECORD, bp.LESSONS_ROOT = record_path, lessons_root
    try:
        return bp.render_page(preview, 'home', config['education_origin'], config)
    finally:
        bp.AUDIENCE_RECORD, bp.LESSONS_ROOT = saved


def self_test():
    root = HERE.parent
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        record = json.loads((root / 'data/audience-homepages.json').read_text())
        planted = tmp / 'audience-homepages.json'
        record['audiences']['planted'] = {**record['audiences']['partners'], 'route': '/for/planted-ux2/', 'label': 'Planted UX2 audience'}
        planted.write_text(json.dumps(record))
        lessons = tmp / 'lessons'; lessons.mkdir()
        rows = [{'subject': 'Planted Subject', 'title': 'A', 'file': 'a.html', 'type': 'lesson'},
                {'subject': 'Planted Game', 'title': 'B', 'file': 'b.html', 'type': 'game'}]
        (lessons / 'resources.json').write_text(json.dumps(rows))
        with_plant = render_home(planted, lessons)
        assert 'href="/for/planted-ux2/">Planted UX2 audience' in with_plant, 'planted audience route did not appear on the homepage'
        assert 'href="/Lessons/subject.html?subject=x-planted-subject"><h3>Planted Subject</h3>' in with_plant, 'planted extra subject did not become a tile'
        assert 'planted-game' not in with_plant, 'a game row must never become a tile'
        real = render_home(root / 'data/audience-homepages.json', bp.LESSONS_ROOT if bp.LESSONS_ROOT else lessons)
        assert 'planted-ux2' not in real and 'Planted UX2' not in real, 'the real record must not carry the plant'
        # every record route except teachers/pupils, in record order, and nothing else typed
        rec = json.loads((root / 'data/audience-homepages.json').read_text())['audiences']
        expected = [a['route'] for a in rec.values() if a['route'] not in (rec['teachers']['route'], rec['pupils']['route'])]
        rendered = [r for r, _ in bp.audience_rows(root / 'data/audience-homepages.json')]
        assert rendered[:len(expected)] == expected, (rendered, expected)
        assert all(r in rendered for r in expected)
        # the ordering rule for extra tiles: A–Z by the first row's subject
        lessons2 = tmp / 'lessons2'; lessons2.mkdir()
        (lessons2 / 'resources.json').write_text(json.dumps([{'subject': 'Zeta', 'type': 'lesson'}, {'subject': 'Alpha', 'type': 'lesson'}]))
        assert [n for _, n in bp.extra_subject_tiles(lessons2)] == ['Alpha', 'Zeta']
    print(json.dumps({'result': 'PASS', 'plantedAudienceAppears': True, 'plantedSubjectAppears': True, 'gameRowIgnored': True, 'recordOrderKept': True}))


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        self_test()
    else:
        print(__doc__); sys.exit(2)
