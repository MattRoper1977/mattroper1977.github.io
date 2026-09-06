"""Verify the actual emitted support links and protected classroom examples.

HC3 §8: no pupil-reachable route carries a Ko-fi reference. The census walks
the emitted trees the way the builder did (pupil_reachable) and counts every
`ko-fi` occurrence on every route that is reachable and not adult-only; the
count must be 0. The count is proved able to move (§0.4) by planting a footer
on a copy of one reachable page and counting again. Every Ko-fi href anywhere
in the trees must equal the configured URL.
"""
import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path
from lxml import html

sys.path.insert(0, str(Path(__file__).parent))
from education_support import KOFI, PUPIL_ENTRIES, pupil_reachable

ap = argparse.ArgumentParser(); ap.add_argument('--output', type=Path, default=Path(__file__).parent/'output'); args = ap.parse_args()
output = args.output
report = json.loads((output/'education-support-report.json').read_text())
expected = {row['route']: row['support'] for row in report['pages']}
adult_only = {row['route'] for row in report['pages'] if row.get('adult_only')}
# adult surfaces keep the footer
assert expected['/for/teachers/'] and expected['/teach/'] and expected['/for/governors-trustees/'] and expected['/artsaward/']
assert expected['/Lessons/liveteach/teacher.html'] and expected['/Matt-s-Apps-/Seating_Studio.html']
assert expected['/Lessons/Tutor_Time/Lesson_Plans.html']   # a catalogue teacher resource no pupil path reaches
# the two reviewed adult Lessons hubs keep it even though a pupil path reaches them
assert expected['/Lessons/Science_Teesside/Teaching_Packs/'] and expected['/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/']
assert '/Lessons/Science_Teesside/Teaching_Packs/' in adult_only
# pupil entries and pupil-reachable shared surfaces do not
for route in ['/', '/for/pupils/', '/Lessons/', '/Lessons/primary/', '/Lessons/Science_Teesside/', '/Lessons/Humanities_Teesside/',
              '/resources/', '/stats/on-this-device/', '/Matt-s-Apps-/',
              '/Matt-s-Apps-/LundyLoop_Professional_OS/pupil_tools/01_LundyLoop_Pupil_Explainer_PRO.html',
              '/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html']:
    assert not expected[route], route + ' carries a support footer'

PARTS = [('site','/'), ('lessons','/Lessons/'), ('apps','/Matt-s-Apps-/')]

HELD = {row['route']: row for row in json.loads((Path(__file__).parent/'education-support-source-kofi.json').read_text())['held']}

def kofi_census(root_output, reachable):
    """(unexplained pupil-route ko-fi occurrences, routes counted, offending routes, held routes seen).
    A route in the HELD record is excused ONLY at its recorded count: Matt's own
    page copy, named and dated, never a blanket exemption. A count that moves,
    or any other route, is red."""
    hits, counted, offenders, held_seen = 0, 0, [], {}
    for part, prefix in PARTS:
        root = root_output/('education-'+part)
        for path in root.rglob('*.html'):
            route = (prefix+path.relative_to(root).as_posix()).removesuffix('index.html')
            if route not in reachable or route in adult_only: continue
            counted += 1
            n = path.read_text(errors='replace').lower().count('ko-fi')
            if not n: continue
            if route in HELD and n == HELD[route]['occurrences']:
                held_seen[route] = n; continue
            hits += n; offenders.append(route)
    return hits, counted, offenders, held_seen

count, every_href = 0, []
for part, prefix in PARTS:
    root = output/('education-'+part)
    for path in root.rglob('*.html'):
        route = (prefix+path.relative_to(root).as_posix()).removesuffix('index.html')
        doc = html.document_fromstring(path.read_text())
        footer = doc.xpath('//*[@data-mbm-support-footer]')
        assert len(footer) == int(expected[route]), route
        if footer:
            links = footer[0].xpath('.//a/@href')
            assert links == [KOFI], route
            assert doc.xpath('//link[@href="/assets/education-support.css"]'), route
            count += 1
        every_href += [(route, h) for h in doc.xpath('//a/@href') if 'ko-fi' in h.lower()]
assert count == report['support_pages']
wrong = [(r, h) for r, h in every_href if h != KOFI]
assert not wrong, 'a Ko-fi href differs from the configured URL: ' + json.dumps(wrong[:5])
css = (output/'education-site/assets/education-support.css').read_text()
assert '@media print{.mbm-support-footer{display:none!important}}' in css

# §8.1 census, proved able to red before it is trusted
reachable = pupil_reachable(output, adult_only)
assert len(reachable) == report['pupil_reachable_routes'], (len(reachable), report['pupil_reachable_routes'])
hits, counted, offenders, held_seen = kofi_census(output, reachable)
assert hits == 0, 'Ko-fi on pupil-reachable routes beyond the held record: ' + json.dumps(offenders[:10])
assert set(held_seen) == set(HELD), 'the held record and the tree disagree: ' + json.dumps({'held': sorted(HELD), 'seen': sorted(held_seen)})
with tempfile.TemporaryDirectory(prefix='mbm-kofi-control-') as tmp:
    scratch = Path(tmp)
    for part, _ in PARTS: (scratch/('education-'+part)).mkdir()
    victim = next(r for r in sorted(reachable) if r.startswith('/Lessons/') and r.endswith('.html') and r not in adult_only and r not in HELD)
    src = output/'education-lessons'/victim[len('/Lessons/'):]
    dst = scratch/'education-lessons'/victim[len('/Lessons/'):]; dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(src.read_text().replace('</body>', '<aside data-mbm-support-footer><a href="' + KOFI + '">Ko-fi</a></aside></body>', 1))
    planted, _, who, _ = kofi_census(scratch, reachable)
    assert planted >= 1 and who == [victim], 'the census did not notice a planted footer on ' + victim
    dst.write_text(src.read_text())
    assert kofi_census(scratch, reachable)[0] == 0, 'the census stayed red with the plant removed'
print(json.dumps({'support_pages': count, 'classified_pages': len(expected), 'pupil_reachable_routes': len(reachable),
                  'pupil_routes_counted': counted, 'kofi_on_pupil_routes': hits, 'kofi_hrefs_total': len(every_href),
                  'kofi_hrefs_off_url': len(wrong), 'kofi_held_source_copy': held_seen, 'pupil_negative_controls': 'pass', 'planted_footer_control': 'red then green'}))
