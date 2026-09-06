"""Optional support at the foot of adult Education pages only.

Matt requested this extension on 6 September 2026. It does not change account
affordances, source activities, downloadable teaching files, or Play output.
Pupil and mixed learning tools remain protected; teacher catalogue roles and
the reviewed additions below identify adult destinations positively.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import shutil

HERE = Path(__file__).resolve().parent
KOFI = 'https://ko-fi.com/madebymattuk'
SITE_ADULT = {
    '/', '/main/', '/for/governors-trustees/', '/tools/', '/teach/',
    '/education-hub/', '/account/', '/members/', '/mailing-list/', '/privacy/',
    '/stats/', '/owner/stats/', '/thanks/', '/artsaward/',
    '/asdan/', '/asdan/app.html', '/asdan/moderation-lab/', '/uas/',
    '/uas/app.html', '/evidence-binder/moderator-pro/',
}
LESSON_ADULT = {
    '/Lessons/', '/Lessons/Science_Teesside/', '/Lessons/Humanities_Teesside/',
    '/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/',
    '/Lessons/Science_Teesside/Teaching_Packs/',
}
APP_ADULT = {
    '/Matt-s-Apps-/', '/Matt-s-Apps-/FieldOps_Teacher_Studio.html',
    '/Matt-s-Apps-/Data_Manager_Studio.html', '/Matt-s-Apps-/Evidence_Binder.html',
    '/Matt-s-Apps-/PDF_Studio.html', '/Matt-s-Apps-/Rubric_Studio.html',
    '/Matt-s-Apps-/Seating_Studio.html', '/Matt-s-Apps-/suite-health.html',
    '/Matt-s-Apps-/LundyLoop_Professional_OS.html',
    '/Matt-s-Apps-/LundyLoop_Professional_OS/',
    '/Matt-s-Apps-/LundyLoop_Professional_OS/LundyLoop_PRO_LAUNCHER.html',
    '/Matt-s-Apps-/LundyLoop_Professional_OS/LundyLoop_PRO_Participation_Operating_System.html',
    '/Matt-s-Apps-/Teesside_Maker_Lab_PRO/TEACHER_STUDIO_DIRECTOR.html',
    '/Matt-s-Apps-/Teesside_Maker_Lab_PRO/PORTFOLIO_MODERATION_HUB.html',
}
PROTECTED = {'/for/pupils/', '/resources/', '/start/', '/game-saves/', '/Lessons/primary/', '/stats/on-this-device/'}


def canonical(route):
    return unquote(urlsplit(route).path).removesuffix('index.html')


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.offsets = [0]; self.ends = {}; self.body = {}
        for line in text.splitlines(keepends=True): self.offsets.append(self.offsets[-1] + len(line))
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'body': self.body = dict(attrs)

    def handle_endtag(self, tag):
        if tag in {'head', 'body'}:
            line, col = self.getpos(); self.ends[tag] = self.offsets[line-1] + col


def pupil_protected(route, document):
    body = document.body
    return (route in PROTECTED or '/pupil_tools/' in route or
            body.get('data-page') == 'pupils' or body.get('data-mbm-audience-face') == 'pupils' or
            body.get('data-mbm-adult-features') == 'off' or 'data-game-moved' in body)


def refresh(output, lessons, site_source):
    adult = {route: 'reviewed adult destination' for route in SITE_ADULT | LESSON_ADULT | APP_ADULT}
    for row in json.loads((HERE/'education-support-adult-routes.json').read_text())['pages']:
        adult[canonical(row['route'])] = row['reason']
    for row in json.loads((lessons/'resources.json').read_text()):
        value = row.get('file', '')
        if str(row.get('type', '')).lower() == 'teacher' and not urlsplit(value).scheme:
            adult[canonical('/Lessons/' + value)] = 'catalogue teacher resource'
    source_record = json.loads((site_source/'data/adult-surfaces.json').read_text())
    for row in source_record['adultSurfaces']:
        adult[canonical('/' + row['page'])] = 'declared adult page'
    rows = []
    footer = ('<aside class="mbm-support-footer" data-mbm-support-footer aria-label="Support Made by Matt">'
              '<p>Help keep classroom resources growing. '
              '<a href="' + KOFI + '" target="_blank" rel="noopener noreferrer">Donate to Made by Matt on Ko-fi</a>'
              '</p></aside>')
    for part, prefix in [('site', '/'), ('lessons', '/Lessons/'), ('apps', '/Matt-s-Apps-/')]:
        root = output/('education-' + part)
        for path in sorted(root.rglob('*.html')):
            route = canonical(prefix + path.relative_to(root).as_posix())
            text = path.read_text(); doc = Document(text)
            protected = pupil_protected(route, doc)
            eligible = route in adult and not protected and all(x in doc.ends for x in ['head', 'body'])
            if eligible:
                if 'data-mbm-support-footer' in text: raise ValueError('Duplicate support footer: ' + route)
                text = text[:doc.ends['body']] + footer + text[doc.ends['body']:]
                text = text[:doc.ends['head']] + '<link rel="stylesheet" href="/assets/education-support.css">' + text[doc.ends['head']:]
                path.write_text(text)
            rows.append({'route': route, 'support': eligible, 'reason': adult[route] if eligible else
                         ('pupil or shared learning surface' if protected else 'learning activity, mixed tool or non-adult page')})
    shutil.copyfile(HERE/'education-support.css', output/'education-site/assets/education-support.css')
    report = {'schema': 1, 'approved': 'User request, 6 September 2026', 'donation_url': KOFI,
              'source_payloads_changed': 0, 'pages': rows, 'support_pages': sum(x['support'] for x in rows)}
    (output/'education-support-report.json').write_text(json.dumps(report, indent=2)+'\n')
    return {'support_pages': report['support_pages'], 'pupil_pages_unchanged': True}
