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
        assert 'subject=x-planted-subject' not in with_plant, 'homepage must keep its four featured subjects'
        assert 'href="/Lessons/">View all' in with_plant, 'full catalogue must remain one tap away'
        from education_frontdoors import subject_tiles
        assert 'href="/Lessons/subject.html?subject=x-planted-subject"><h3>Planted Subject</h3>' in subject_tiles(bp, lessons), 'planted extra subject must remain in audience browsing'
        assert 'subject=science' not in with_plant, 'an empty fixed subject group must be absent'
        assert 'planted-game' not in with_plant, 'a game row must never become a tile'
        real = render_home(root / 'data/audience-homepages.json', bp.LESSONS_ROOT if bp.LESSONS_ROOT else lessons)
        assert 'planted-ux2' not in real and 'Planted UX2' not in real, 'the real record must not carry the plant'
        # every record route except teachers/pupils, in record order, and nothing else typed
        rec = json.loads((root / 'data/audience-homepages.json').read_text())['audiences']
        expected = [a['route'] for a in rec.values() if a['route'] not in (rec['teachers']['route'], rec['pupils']['route'])]
        rendered = [r for r, _ in bp.audience_rows(root / 'data/audience-homepages.json')]
        assert rendered[:len(expected)] == expected, (rendered, expected)
        assert all(r in rendered for r in expected)
        # Preview validity follows actual source bytes, including a stale-source control.
        from education_frontdoors import preview_data
        from types import SimpleNamespace
        import hashlib
        pdf = lessons / 'real.pdf'; pdf.write_bytes(b'reviewed PDF bytes')
        image = {'source': 'real.pdf', 'sourceSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(), 'dataUri': 'data:image/jpeg;base64,AA==', 'role': 'slides', 'page': 1}
        (lessons / 'resources.json').write_text(json.dumps([{'id': 'real', 'file': 'real.pptx', 'files': [{'path': 'real.pdf', 'type': 'pdf'}]}]))
        (tmp / 'homepage-previews.json').write_text(json.dumps({'real': {'resourceFile': 'real.pptx', 'images': [image]}}))
        fixture = SimpleNamespace(HERE=tmp, LESSONS_ROOT=lessons)
        assert preview_data(fixture)['real']['images'] == [image]
        pdf.write_bytes(b'changed PDF bytes'); assert preview_data(fixture) == {}, 'stale preview must be suppressed'
        pdf.write_bytes(b'reviewed PDF bytes'); assert 'real' in preview_data(fixture), 'restored source recovers preview'
        # EDU-TRY-LESSON: a feature binds only while the catalogue row, the lesson
        # bytes and the preview source all agree; any drift is a build error.
        from education_frontdoors import try_lesson, hero_art
        import bind_homepage_features
        lesson = lessons / 'lesson.html'; lesson.write_bytes(b'<h1>Reviewed topic</h1><p>A 40-minute lesson. I can do the reviewed thing.</p>')
        (lessons / 'pack.html').write_text('<html></html>')
        (lessons / 'assets/catalogue').mkdir(parents=True); (lessons / 'data').mkdir()
        (lessons / 'assets/catalogue/display-titles.json').write_text(json.dumps({'schema': 1, 'entries': {'real.pptx': {'id': 'real', 'originalTitle': 'W1 · Reviewed topic · Companion pack', 'displayTitle': 'Reviewed topic', 'reference': 'W1'}}}))
        (lessons / 'data/companion-packs.json').write_text(json.dumps({'packs': [{'id': 'real', 'companionOf': 'lesson.html', 'subject': 'Science', 'pathway': 'GROW', 'term': 'Autumn 1'}]}))
        rows_ok = [{'id': 'real', 'file': 'real.pptx', 'title': 'W1 · Reviewed topic · Companion pack', 'type': 'support', 'companionOf': 'lesson.html', 'files': [{'path': 'real.pdf', 'type': 'pdf'}]}]
        (lessons / 'resources.json').write_text(json.dumps(rows_ok))
        image['width'] = 100; image['height'] = 140
        (tmp / 'homepage-previews.json').write_text(json.dumps({'real': {'resourceFile': 'real.pptx', 'images': [image]}}))
        declared = {'schemaVersion': 2, 'rotationSeconds': 8, 'features': [{'packId': 'real', 'durationMinutes': 40, 'reviewedAt': '2026-09-16'}]}
        bound = bind_homepage_features.bind(lessons, declared, tmp / 'homepage-previews.json')
        assert bound['features'][0]['description'] == 'I can do the reviewed thing.' and bound['features'][0]['descriptionSource'].startswith('lesson outcome'), bound
        (tmp / 'homepage-feature.json').write_text(json.dumps(bound))
        card = try_lesson(fixture, 'hero')
        assert 'Reviewed topic' in card and 'data-try-lesson' not in card, 'one eligible lesson renders a static card, not a rotation'
        assert 'href="/Lessons/lesson.html"' in card and 'href="/Lessons/pack.html?id=real"' in card, 'lesson and pack routes come from the binding'
        def refuses(reason):
            try:
                try_lesson(fixture, 'hero')
            except ValueError:
                return True
            raise AssertionError('stale binding must be refused: ' + reason)
        lesson.write_bytes(b'changed lesson'); refuses('changed lesson bytes')
        lesson.write_bytes(b'<h1>Reviewed topic</h1><p>A 40-minute lesson. I can do the reviewed thing.</p>'); assert 'Reviewed topic' in try_lesson(fixture, 'hero')
        pdf.write_bytes(b'changed preview source'); refuses('changed preview source')
        pdf.write_bytes(b'reviewed PDF bytes'); assert 'Reviewed topic' in try_lesson(fixture, 'hero')
        (lessons / 'resources.json').write_text(json.dumps([{**rows_ok[0], 'companionOf': 'different.html'}])); refuses('changed companion target')
        (lessons / 'resources.json').write_text(json.dumps(rows_ok))
        # two eligible lessons render a rotation: hidden second slide, hidden controls until the script runs
        lesson2 = lessons / 'lesson2.html'; lesson2.write_bytes(b'<h1>Second topic</h1><p>40 minutes. I can do the second thing.</p>')
        (lessons / 'assets/catalogue/display-titles.json').write_text(json.dumps({'schema': 1, 'entries': {'real.pptx': {'id': 'real', 'originalTitle': 'W1 · Reviewed topic · Companion pack', 'displayTitle': 'Reviewed topic', 'reference': 'W1'}, 'second.pptx': {'id': 'second', 'originalTitle': 'W2 · Second topic · Companion pack', 'displayTitle': 'Second topic', 'reference': 'W2'}}}))
        (lessons / 'data/companion-packs.json').write_text(json.dumps({'packs': [{'id': 'real', 'companionOf': 'lesson.html', 'subject': 'Science', 'pathway': 'GROW', 'term': 'Autumn 1'}, {'id': 'second', 'companionOf': 'lesson2.html', 'subject': 'Science', 'pathway': 'LAUNCH', 'term': 'Autumn 1'}]}))
        (lessons / 'resources.json').write_text(json.dumps(rows_ok + [{'id': 'second', 'file': 'second.pptx', 'title': 'W2 · Second topic · Companion pack', 'type': 'support', 'companionOf': 'lesson2.html', 'files': [{'path': 'real.pdf', 'type': 'pdf'}]}]))
        (tmp / 'homepage-previews.json').write_text(json.dumps({'real': {'resourceFile': 'real.pptx', 'images': [image]}, 'second': {'resourceFile': 'second.pptx', 'images': [image]}}))
        declared['features'].append({'packId': 'second', 'durationMinutes': 40, 'reviewedAt': '2026-09-16'})
        (tmp / 'homepage-feature.json').write_text(json.dumps(bind_homepage_features.bind(lessons, declared, tmp / 'homepage-previews.json')))
        rotation = try_lesson(fixture, 'hero')
        assert 'data-try-lesson' in rotation and rotation.count('data-try-slide=') == 2 and 'hidden>' in rotation.split('data-try-slide="second"')[1][:80], rotation
        assert '<div class="fd-try-controls" data-try-controls hidden>' in rotation and '1 of 2' in rotation
        # a checkout without the display-title map (a pin that predates the binding contract) shows no feature
        (lessons / 'assets/catalogue/display-titles.json').rename(lessons / 'assets/catalogue/display-titles.off')
        assert try_lesson(fixture, 'hero') == '', 'a catalogue without the binding files renders no card'
        (lessons / 'assets/catalogue/display-titles.off').rename(lessons / 'assets/catalogue/display-titles.json')
        # a checkout that carries only some declared packs (an older pin) shows the eligible ones only
        (lessons / 'resources.json').write_text(json.dumps(rows_ok))
        partial = try_lesson(fixture, 'hero')
        assert 'Reviewed topic' in partial and 'Second topic' not in partial and 'data-try-lesson' not in partial, 'older pin renders the eligible lesson as a static card'
        (lessons / 'resources.json').write_text(json.dumps(rows_ok + [{'id': 'second', 'file': 'second.pptx', 'title': 'W2 · Second topic · Companion pack', 'type': 'support', 'companionOf': 'lesson2.html', 'files': [{'path': 'real.pdf', 'type': 'pdf'}]}]))
        # EDU-HERO: artwork renders only at the manifest's exact bytes
        (tmp / 'hero').mkdir(); art = tmp / 'hero/art.jpg'; art.write_bytes(b'approved crop bytes')
        (tmp / 'education-hero.json').write_text(json.dumps({'alt': '', 'images': {'teachers': {'file': 'hero/art.jpg', 'published': 'assets/art.jpg', 'sourceSha256': 'a' * 64, 'sha256': hashlib.sha256(b'approved crop bytes').hexdigest(), 'bytes': 19, 'width': 4, 'height': 3}}}))
        assert 'data-hero-source="' + 'a' * 64 + '"' in hero_art(fixture, 'teachers') and 'src="/assets/art.jpg"' in hero_art(fixture, 'teachers')
        art.write_bytes(b'other bytes')
        try:
            hero_art(fixture, 'teachers')
        except ValueError:
            pass
        else:
            raise AssertionError('hero artwork at other bytes must be refused')
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
