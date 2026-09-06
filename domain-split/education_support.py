"""Optional support at the foot of adult Education pages only.

Matt requested this extension on 6 September 2026. It does not change account
affordances, source activities, downloadable teaching files, or Play output.
Pupil and mixed learning tools remain protected; teacher catalogue roles and
the reviewed additions below identify adult destinations positively.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
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
    '/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/',
    '/Lessons/Science_Teesside/Teaching_Packs/',
}
# HC3 §8. The Lessons index and the Science / Humanities hubs are where a pupil
# lands; they carry no support footer. More generally NO route a pupil can reach
# by following links from a pupil entry carries one — reachability is WALKED
# over the emitted trees (pupil_reachable below), never listed. The footer stays
# only on adult-only surfaces: the teacher and audience pages, the teacher
# studios, and every page individually reviewed as an adult page in
# education-support-adult-routes.json or declared in data/adult-surfaces.json.
# Those are also the pages the walk does not pass THROUGH: a page linked only
# from a teacher hub is not pupil-reachable.
PUPIL_ENTRIES = ['/', '/for/pupils/', '/start/', '/Lessons/', '/Lessons/primary/', '/Matt-s-Apps-/', '/resources/']
SHARED_WITH_PUPILS = {'/', '/main/', '/tools/', '/privacy/', '/stats/', '/thanks/'}
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


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href')
            if href: self.hrefs.append(href)


def pupil_reachable(output, adult_only):
    """Every route a pupil reaches from PUPIL_ENTRIES by following same-origin
    links, where adult-only pages are visited but never expanded."""
    parts = [('site', '/'), ('lessons', '/Lessons/'), ('apps', '/Matt-s-Apps-/')]
    def locate(route):
        for part, prefix in sorted(parts, key=lambda x: -len(x[1])):
            if route.startswith(prefix):
                rel = route[len(prefix):]
                base = output/('education-' + part)
                for cand in ([base/rel/'index.html', base/(rel + 'index.html')] if route.endswith('/') else [base/rel]):
                    if cand.is_file(): return cand
                return None
        return None
    seen, queue = set(), list(PUPIL_ENTRIES)
    while queue:
        route = queue.pop()
        if route in seen: continue
        path = locate(route)
        if path is None: continue
        seen.add(route)
        if route in adult_only: continue
        parser = Links(); parser.feed(path.read_text(errors='replace'))
        for href in parser.hrefs:
            if href.startswith(('#', 'mailto:', 'tel:', 'javascript:')): continue
            joined = urljoin('https://madebymatt.uk' + route, href)
            u = urlsplit(joined)
            if u.netloc not in {'madebymatt.uk', 'www.madebymatt.uk'}: continue
            target = canonical(u.path)
            if target.endswith('.html') or target.endswith('/'):
                if target not in seen: queue.append(target)
    return seen


def refresh(output, lessons, site_source):
    adult = {route: 'reviewed adult destination' for route in SITE_ADULT | LESSON_ADULT | APP_ADULT}
    adult_only = set(SITE_ADULT - SHARED_WITH_PUPILS) | set(LESSON_ADULT) | set(APP_ADULT)
    for row in json.loads((HERE/'education-support-adult-routes.json').read_text())['pages']:
        adult[canonical(row['route'])] = row['reason']; adult_only.add(canonical(row['route']))
    for row in json.loads((lessons/'resources.json').read_text()):
        value = row.get('file', '')
        if str(row.get('type', '')).lower() == 'teacher' and not urlsplit(value).scheme:
            adult[canonical('/Lessons/' + value)] = 'catalogue teacher resource'
    source_record = json.loads((site_source/'data/adult-surfaces.json').read_text())
    for row in source_record['adultSurfaces']:
        adult[canonical('/' + row['page'])] = 'declared adult page'; adult_only.add(canonical('/' + row['page']))
    adult_only -= set(PUPIL_ENTRIES)   # a pupil entry is a pupil route whatever else declares it
    reachable = pupil_reachable(output, adult_only)
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
            pupil_route = route in reachable and route not in adult_only
            eligible = route in adult and not protected and not pupil_route and all(x in doc.ends for x in ['head', 'body'])
            if eligible:
                if 'data-mbm-support-footer' in text: raise ValueError('Duplicate support footer: ' + route)
                text = text[:doc.ends['body']] + footer + text[doc.ends['body']:]
                text = text[:doc.ends['head']] + '<link rel="stylesheet" href="/assets/education-support.css">' + text[doc.ends['head']:]
                path.write_text(text)
            rows.append({'route': route, 'support': eligible, 'pupil_reachable': route in reachable, 'adult_only': route in adult_only,
                         'reason': adult[route] if eligible else
                         ('pupil or shared learning surface' if protected else 'pupil-reachable route' if pupil_route else 'learning activity, mixed tool or non-adult page')})
    shutil.copyfile(HERE/'education-support.css', output/'education-site/assets/education-support.css')
    report = {'schema': 2, 'approved': 'User request, 6 September 2026; pupil-reachable routes cleared by Order HC3 §8', 'donation_url': KOFI,
              'pupil_entries': PUPIL_ENTRIES, 'pupil_reachable_routes': len(reachable), 'adult_only_routes': len(adult_only),
              'source_payloads_changed': 0, 'pages': rows, 'support_pages': sum(x['support'] for x in rows)}
    (output/'education-support-report.json').write_text(json.dumps(report, indent=2)+'\n')
    return {'support_pages': report['support_pages'], 'pupil_pages_unchanged': True}
