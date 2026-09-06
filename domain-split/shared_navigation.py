"""One progressive navigation shell for the published education front doors.

Source activities and downloads are never passed through this transform.
The disclosure is native HTML: navigation remains usable without JavaScript.
"""
from html import escape
from pathlib import Path
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
PLAY = 'https://www.madebymatt-play.uk/'
LEARNING = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'),
            ('/Matt-s-Apps-/', 'Apps & tools'), ('/tools/', 'Teacher tools')]
STARTING = [('/', 'Homepage'), ('/for/teachers/', 'Teachers'),
            ('/for/pupils/', 'Pupils'), ('/for/parents-carers/', 'Parents & carers'),
            ('/for/schools-semh/', 'Schools & specialist settings'),
            ('/for/trusts/', 'Academy trusts'),
            ('/for/councils-organisations/', 'Local authorities'),
            ('/for/partners/', 'Education partners'),
            ('/for/governors-trustees/', 'Governors & trustees')]
SITE_PAGES = ['index.html', 'main/index.html', 'account/index.html',
              'members/index.html', 'mailing-list/index.html', 'privacy/index.html',
              'stats/index.html', 'owner/stats/index.html', 'tools/index.html',
              'resources/index.html', 'teach/index.html', 'education-hub/index.html',
              *[route.strip('/') + '/index.html' for route, _ in STARTING[1:]]]


def header(route, adult=False, pupil=False, theme=False, primary=False):
    def link(item, remember=False):
        href, label = item
        current = ' aria-current="page"' if href == route and '?' not in href else ''
        remember = ' data-primary-global="/Lessons/"' if remember else ''
        return '<a href="' + escape(href, quote=True) + '"' + current + remember + '>' + escape(label) + '</a>'

    def group(title, items):
        return '<section class="mbm-menu-group"><h2>' + title + '</h2>' + ''.join(link(x, primary and x[0] == '/Lessons/') for x in items) + '</section>'

    learning = LEARNING if not pupil else LEARNING[:2]
    shortcuts = [('/Lessons/primary/', 'Primary lessons'),
                 ('/Lessons/?view=saved', 'Saved lessons'),
                 ('/Lessons/?view=recommended', 'Recommended versions')]
    if adult:
        shortcuts += [('/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html', 'David’s cover packs'),
                      ('/Matt-s-Apps-/PDF_Studio.html', 'PDF Studio'),
                      ('/Lessons/?subject=ASDAN%20%26%20life%20skills&year=all', 'ASDAN learning resources'),
                      ('/teach/', 'Teaching hub'), ('/education-hub/', 'Education Hub')]
    groups = group('Learning', learning + shortcuts)
    groups += group('Starting points', STARTING if not pupil else [STARTING[0], STARTING[2]])
    personal = [('/account/', 'Account'), ('/members/', 'Members'), ('/mailing-list/', 'Teacher updates')] if adult else []
    groups += group('More from Matt', personal + [('/stats/', 'Shared activity'), ('/privacy/', 'Privacy & statistics choices'), (PLAY, 'Made by Matt Play ↗')])
    if theme:
        groups += '<details class="mbm-menu-display"><summary>Display options</summary><div data-mbm-theme-slot></div></details>'
    classes = 'mbm-unified-header'
    return ('<header class="' + classes + '" data-mbm-navigation="education">'
            '<div class="mbm-unified-bar"><a class="mbm-unified-brand" href="/">'
            '<img src="/assets/brand/micro_mark.svg" width="44" height="44" alt="">'
            '<span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></a>'
            '<nav class="mbm-unified-quick" aria-label="Quick navigation">' +
            ''.join(link(x, primary and i == 0) for i, x in enumerate(learning)) + '</nav>'
            '<details class="mbm-unified-menu"><summary aria-controls="mbm-navigation-panel">'
            '<span class="mbm-menu-icon" aria-hidden="true"></span>Menu</summary>'
            '<nav class="mbm-unified-panel" id="mbm-navigation-panel" aria-label="Site menu">' +
            groups + '</nav></details></div></header>')


def refresh(output, site_source):
    site = output / 'education-site'
    adult_pages = {x['page'] for x in json.loads((site_source / 'data/adult-surfaces.json').read_text())['adultSurfaces']}
    # The published learning homepage supersedes the old source chooser. These
    # generated adult front doors already expose their account links explicitly.
    adult_pages.update({'index.html', 'for/governors-trustees/index.html', 'owner/stats/index.html'})
    pages = [(site / p, '/' + p.removesuffix('index.html'), p in adult_pages) for p in SITE_PAGES]
    pages += [(output / 'education-lessons/index.html', '/Lessons/', False),
              (output / 'education-lessons/primary/index.html', '/Lessons/primary/', False),
              (output / 'education-apps/index.html', '/Matt-s-Apps-/', False)]
    changed = []
    for path, route, adult in pages:
        if not path.is_file():
            raise ValueError('Missing navigation surface: ' + str(path))
        text = path.read_text()
        theme = bool(re.search(r'<script\b[^>]*\bsrc=["\'][^"\']*(?:^|/)theme\.js', text))
        replacement = header(route, adult, route == '/for/pupils/', theme, route == '/Lessons/primary/')
        text, count = re.subn(r'<header\b[^>]*>.*?</header>', lambda _: replacement, text, count=1, flags=re.S)
        if count != 1:
            raise ValueError('Missing page header: ' + str(path))
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-navigation.css">'
                            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)
        path.write_text(text)
        changed.append(route)
    for asset in ['shared-navigation.css', 'shared-navigation.js']:
        shutil.copyfile(HERE / asset, site / 'assets' / asset)
    return {'routes': changed, 'native_disclosure': True}
