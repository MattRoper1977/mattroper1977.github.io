"""One progressive navigation shell for the published education front doors.

Source activities and downloads are never passed through this transform.
The disclosure is native HTML: navigation remains usable without JavaScript.
"""
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit
from pathlib import Path
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
PLAY = 'https://www.madebymatt-play.uk/'
LEARNING = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'),
            ('/Matt-s-Apps-/', 'Apps & tools'), ('/tools/', 'Teacher tools')]
AUDIENCE_LABELS = [('teachers', 'Teachers'), ('pupils', 'Pupils'),
                   ('parents', 'Parents & carers'), ('schools', 'Schools & specialist settings'),
                   ('trusts', 'Academy trusts'), ('councils', 'Local authorities'),
                   ('partners', 'Education partners')]
SITE_PAGES = ['index.html', 'main/index.html', 'account/index.html',
              'members/index.html', 'mailing-list/index.html', 'privacy/index.html',
              'stats/index.html', 'owner/stats/index.html', 'tools/index.html',
              'resources/index.html', 'teach/index.html', 'education-hub/index.html', 'stats/on-this-device/index.html']


class ScriptSources(HTMLParser):
    def __init__(self):
        super().__init__(); self.sources=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'script': self.sources.append(dict(attrs).get('src',''))


def has_reading_theme(text):
    parser=ScriptSources();parser.feed(text)
    return any(urlsplit(src).path.rsplit('/',1)[-1] in {'theme.js','mbm-theme.js'} for src in parser.sources)


def header(route, starting, adult=False, pupil=False, theme=False, primary=False, compact=False):
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
    groups += group('Starting points', starting if not pupil else [starting[0], next(x for x in starting if x[0] == route)])
    personal = [('/account/', 'Account'), ('/members/', 'Members'), ('/mailing-list/', 'Teacher updates')] if adult else []
    groups += group('More from Matt', personal + [('/stats/', 'Shared activity'), ('/privacy/', 'Privacy & statistics choices'), (PLAY, 'Made by Matt Play ↗')])
    if theme:
        groups += '<details class="mbm-menu-display"><summary>Display options</summary><div data-mbm-theme-slot></div></details>'
    classes = 'mbm-unified-header'
    quick = '' if compact else ('<nav class="mbm-unified-quick" aria-label="Quick navigation">' +
                               ''.join(link(x, primary and i == 0) for i, x in enumerate(learning)) + '</nav>')
    return ('<header class="' + classes + '" data-mbm-navigation="education">'
            '<div class="mbm-unified-bar"><a class="mbm-unified-brand" href="/">'
            '<img src="/assets/brand/micro_mark.svg" width="44" height="44" alt="">'
            '<span><strong>MADE BY MATT</strong><small>Learn • Build • Explore</small></span></a>'
            + quick +
            '<details class="mbm-unified-menu"><summary aria-controls="mbm-navigation-panel">'
            '<span class="mbm-menu-icon" aria-hidden="true"></span>Menu</summary>'
            '<nav class="mbm-unified-panel" id="mbm-navigation-panel" aria-label="Site menu">' +
            groups + '</nav></details></div></header>')


def refresh(output, site_source):
    site = output / 'education-site'
    audiences = json.loads((site_source / 'data/audience-homepages.json').read_text())['audiences']
    starting = [('/', 'Homepage')] + [(audiences[key]['route'], label) for key, label in AUDIENCE_LABELS]
    starting.append(('/for/governors-trustees/', 'Governors & trustees'))
    adult_pages = {x['page'] for x in json.loads((site_source / 'data/adult-surfaces.json').read_text())['adultSurfaces']}
    # The published learning homepage supersedes the old source chooser. These
    # generated adult front doors already expose their account links explicitly.
    adult_pages.update({'index.html', 'for/governors-trustees/index.html', 'owner/stats/index.html'})
    site_pages = SITE_PAGES + [route.strip('/') + '/index.html' for route, _ in starting[1:]]
    pages = [(site / p, '/' + p.removesuffix('index.html'), p in adult_pages) for p in site_pages]
    pages += [(output / 'education-lessons/index.html', '/Lessons/', True),
              (output / 'education-lessons/primary/index.html', '/Lessons/primary/', False),
              (output / 'education-apps/index.html', '/Matt-s-Apps-/', True)]
    # Auth controls remain server-side. These mixed teaching catalogues expose
    # the same relevant adult shortcuts as the established teacher front door.
    for relative in ['Science_Teesside/index.html','Humanities_Teesside/index.html',
                     'Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html']:
        pages.append((output/'education-lessons'/relative,'/Lessons/'+relative.removesuffix('index.html'),True))
    inserted = {'/asdan/','/uas/'}
    pages += [(site/route.strip('/')/'index.html',route,True) for route in sorted(inserted)]
    changed = []
    for path, route, adult in pages:
        if not path.is_file():
            raise ValueError('Missing navigation surface: ' + str(path))
        text = path.read_text()
        theme = has_reading_theme(text)
        # Keep the existing visible learning-area row without duplicating it
        # inside the desktop masthead. All destinations remain in the Menu.
        compact = bool(re.search(r'class="[^"\n]*\b(?:collection-nav|ad-nav)\b', text))
        replacement = header(route, starting, adult, route == audiences['pupils']['route'], theme,
                             route == '/Lessons/primary/', compact)
        if route in inserted:
            # These landings use a content header for their heading and Open
            # action. Add navigation before it without deleting those controls.
            text,count=re.subn(r'(<body\b[^>]*>)',lambda match:match.group(1)+replacement,text,count=1,flags=re.I)
        else:
            text,count=re.subn(r'<header\b[^>]*>.*?</header>',lambda _:replacement,text,count=1,flags=re.S)
        if count != 1:
            raise ValueError('Missing navigation insertion/replacement boundary: '+str(path))
        if route == '/stats/on-this-device/':
            old="document.getElementById('menu').addEventListener('click',function(){var n=document.getElementById('nav'),o=n.classList.toggle('open');this.setAttribute('aria-expanded',o);});"
            if text.count(old)!=1: raise ValueError('Legacy stats menu handler changed')
            text=text.replace(old,'').replace('href="/main/#about"','href="/main/"')
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-navigation.css">'
                            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)
        path.write_text(text)
        changed.append(route)
    for asset in ['shared-navigation.css', 'shared-navigation.js']:
        shutil.copyfile(HERE / asset, site / 'assets' / asset)
    return {'routes': changed, 'native_disclosure': True}
