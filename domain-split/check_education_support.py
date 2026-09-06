"""Verify the actual emitted support links and protected classroom examples."""
import argparse
import json
from pathlib import Path
from lxml import html

ap = argparse.ArgumentParser(); ap.add_argument('--output', type=Path, default=Path(__file__).parent/'output'); args = ap.parse_args()
output = args.output
report = json.loads((output/'education-support-report.json').read_text())
expected = {row['route']: row['support'] for row in report['pages']}
assert expected['/'] and expected['/for/governors-trustees/'] and expected['/artsaward/']
assert expected['/Lessons/Science_Teesside/'] and expected['/Lessons/Tutor_Time/Lesson_Plans.html']
assert not expected['/for/pupils/'] and not expected['/Lessons/primary/']
assert not expected['/resources/'] and not expected['/stats/on-this-device/']
assert not expected['/Matt-s-Apps-/LundyLoop_Professional_OS/pupil_tools/01_LundyLoop_Pupil_Explainer_PRO.html']
assert not expected['/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html']
count = 0
for part, prefix in [('site','/'), ('lessons','/Lessons/'), ('apps','/Matt-s-Apps-/')]:
    root = output/('education-'+part)
    for path in root.rglob('*.html'):
        route = (prefix+path.relative_to(root).as_posix()).removesuffix('index.html')
        doc = html.document_fromstring(path.read_text())
        footer = doc.xpath('//*[@data-mbm-support-footer]')
        assert len(footer) == int(expected[route]), route
        if footer:
            links = footer[0].xpath('.//a/@href')
            assert links == ['https://ko-fi.com/madebymattuk'], route
            assert doc.xpath('//link[@href="/assets/education-support.css"]'), route
            count += 1
assert count == report['support_pages']
css = (output/'education-site/assets/education-support.css').read_text()
assert '@media print{.mbm-support-footer{display:none!important}}' in css
print(json.dumps({'support_pages':count,'classified_pages':len(expected),'pupil_negative_controls':'pass'}))
