"""One progressive navigation shell for the published education front doors.

Source activities and downloads are never passed through this transform.
The disclosure is native HTML: navigation remains usable without JavaScript.

UX2 B1: the component is Appendix A §MENU exactly — a "Menu" title with a
44px close control, three groups (Learning · Who are you here for? · Your
account), no deep links, and "Made by Matt Play ↗" last as a plain link (the
education site links to Play; it never loads it). Audience rows are read from
data/audience-homepages.json (label and route, record order); the one route
the record does not hold, /for/governors-trustees/, is the build's own page
and is appended from the same constant that writes it. Pupil surfaces render
the pupil subset of the SAME component. The header carries the mark, the
wordmark, a search control and the menu — no tagline: "Learn • Build •
Explore" is the footer's line, once per page.
"""
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit
from pathlib import Path
import json
import re
import shutil
import sys

HERE = Path(__file__).resolve().parent


def build_audiences():
    """education_expansion.AUDIENCES, imported at the point of use.

    The governors row is read from that constant so the menu never types its
    route, and this is the only thing this module wants from it. Importing it
    at module scope made two problems. The builders run as scripts from this
    directory, so the sibling name resolves for them; tools/test_published_site.py
    loads this file by path to exercise the real header renderer rather than a
    copy of it, and nothing puts this directory on that loader's path. And
    education_expansion imports lxml for its own HTML work, which a navigation
    renderer has no business requiring - the professional-site-design-audit job
    installs no lxml, so header() became unreachable there.

    The directory is added to sys.path rather than loading the file by path, so
    there stays exactly ONE education_expansion module object; a second one
    could drift from the builders'.
    """
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    from education_expansion import AUDIENCES
    return AUDIENCES

PLAY = 'https://www.madebymatt-play.uk/'
MENU_TITLE = 'Menu'
GROUP_LEARNING = 'Learning'
GROUP_WHO = 'Who are you here for?'
GROUP_ACCOUNT = 'Your account'
PLAY_LABEL = 'Made by Matt Play ↗'
LEARNING = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'),
            ('/Matt-s-Apps-/', 'Apps & tools'), ('/Lessons/primary/', 'Primary lessons')]
LEARNING_PUPIL = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'), ('/Lessons/primary/', 'Primary lessons')]
ACCOUNT = [('/account/', 'Account and members'), ('/mailing-list/', 'Teacher updates'),
           ('/privacy/', 'Privacy and statistics')]
ACCOUNT_SHARED = [('/privacy/', 'Privacy and statistics')]
SITE_PAGES = ['index.html', 'main/index.html', 'account/index.html',
              'members/index.html', 'mailing-list/index.html', 'privacy/index.html',
              'stats/index.html', 'owner/stats/index.html', 'tools/index.html',
              'resources/index.html', 'teach/index.html', 'education-hub/index.html', 'stats/on-this-device/index.html',
              'commission/index.html']
# The on-page search control the header's search icon jumps to. A page whose
# control is absent falls back to the Resources search (asserted at build).
SEARCH_CONTROLS = {'/': 'home-resource-query', '/main/': 'home-resource-query', '/for/teachers/': 'teachers-q',
                   '/for/pupils/': 'pupils-q', '/resources/': 'rxSearch', '/Lessons/': 'search',
                   '/Matt-s-Apps-/': 'search', '/tools/': 'tq', '/teach/': 'teach-search',
                   '/education-hub/': 'hub-search', '/for/governors-trustees/': 'gv-search',
                   '/Lessons/primary/': 'primary-search', '/Lessons/subject.html': 'search'}
SEARCH_FALLBACK = '/resources/#rxSearch'


class ScriptSources(HTMLParser):
    def __init__(self):
        super().__init__(); self.sources=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'script': self.sources.append(dict(attrs).get('src',''))


def has_reading_theme(text):
    parser=ScriptSources();parser.feed(text)
    return any(urlsplit(src).path.rsplit('/',1)[-1] in {'theme.js','mbm-theme.js'} for src in parser.sources)


def audience_rows(site_source):
    """(route, label) for every audience, in record order; governors last.

    The record (data/audience-homepages.json) owns seven audiences. The
    governors page exists only in this build (education_expansion.AUDIENCES);
    it is appended from that constant, read through build_audiences(), so the
    menu never types its route.
    """
    audiences = json.loads((site_source / 'data/audience-homepages.json').read_text())['audiences']
    rows = [(audience['route'], audience['label']) for audience in audiences.values()]
    held = {route for route, _ in rows}
    for slug, label, _ in build_audiences():
        route = '/for/' + slug + '/'
        if route not in held:
            rows.append((route, label))
    return rows


def header(route, audiences, adult=False, pupil=False, theme=False, primary=False, search=SEARCH_FALLBACK):
    def link(item, remember=False):
        href, label = item
        current = ' aria-current="page"' if href == route and '?' not in href else ''
        remember = ' data-primary-global="/Lessons/"' if remember else ''
        return '<a href="' + escape(href, quote=True) + '"' + current + remember + '>' + escape(label) + '</a>'

    def group(title, items):
        return '<section class="mbm-menu-group"><h2>' + escape(title) + '</h2>' + ''.join(link(x, primary and x[0] == '/Lessons/') for x in items) + '</section>'

    learning = LEARNING_PUPIL if pupil else LEARNING
    who = [row for row in audiences if row[0] == '/for/pupils/'] if pupil else list(audiences)
    account = ACCOUNT if adult else ACCOUNT_SHARED
    groups = group(GROUP_LEARNING, learning) + group(GROUP_WHO, who) + group(GROUP_ACCOUNT, account)
    if theme:
        groups += '<details class="mbm-menu-display"><summary>Display options</summary><div data-mbm-theme-slot></div></details>'
    groups += '<a class="mbm-menu-play" href="' + PLAY + '" rel="noopener">' + escape(PLAY_LABEL) + '</a>'
    return ('<header class="mbm-unified-header" data-mbm-navigation="education">'
            '<div class="mbm-unified-bar"><a class="mbm-unified-brand" href="/">'
            '<img src="/assets/brand/approved-mark.jpg" width="44" height="44" alt="">'
            '<span><strong>MADE BY MATT</strong></span></a>'
            '<a class="mbm-unified-search" href="' + escape(search, quote=True) + '" aria-label="Search">'
            '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a>'
            '<details class="mbm-unified-menu"><summary aria-controls="mbm-navigation-panel">'
            '<span class="mbm-menu-icon" aria-hidden="true"></span>' + MENU_TITLE + '</summary>'
            '<nav class="mbm-unified-panel" id="mbm-navigation-panel" aria-label="Site menu">'
            '<div class="mbm-menu-head"><p class="mbm-menu-title">' + MENU_TITLE + '</p>'
            '<button type="button" class="mbm-menu-close" aria-label="Close menu"><span aria-hidden="true">×</span></button></div>' +
            groups + '</nav></details></div></header>')


def refresh(output, site_source):
    site = output / 'education-site'
    audiences = json.loads((site_source / 'data/audience-homepages.json').read_text())['audiences']
    rows = audience_rows(site_source)
    adult_pages = {x['page'] for x in json.loads((site_source / 'data/adult-surfaces.json').read_text())['adultSurfaces']}
    # The published learning homepage supersedes the old source chooser. These
    # generated adult front doors already expose their account links explicitly.
    adult_pages.update({'index.html', 'for/governors-trustees/index.html', 'owner/stats/index.html', 'commission/index.html'})
    site_pages = SITE_PAGES + [route.strip('/') + '/index.html' for route, _ in rows]
    pages = [(site / p, '/' + p.removesuffix('index.html'), p in adult_pages) for p in site_pages]
    pages += [(output / 'education-lessons/index.html', '/Lessons/', True),
              # Shared teacher/pupil subject page: published chrome only.
              (output / 'education-lessons/subject.html', '/Lessons/subject.html', False),
              (output / 'education-lessons/primary/index.html', '/Lessons/primary/', False),
              (output / 'education-apps/index.html', '/Matt-s-Apps-/', True)]
    # Auth controls remain server-side. These mixed teaching catalogues expose
    # the same relevant adult shortcuts as the established teacher front door.
    for relative in ['Science_Teesside/index.html','Humanities_Teesside/index.html',
                     'Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html']:
        pages.append((output/'education-lessons'/relative,'/Lessons/'+relative.removesuffix('index.html'),True))
    inserted = {'/asdan/','/uas/'}
    pages += [(site/route.strip('/')/'index.html',route,True) for route in sorted(inserted)]
    pack_hub = output/'education-lessons/Science_Teesside/Teaching_Packs/index.html'
    if pack_hub.is_file():
        pack_route = '/Lessons/Science_Teesside/Teaching_Packs/'
        pages.append((pack_hub, pack_route, True))
        inserted.add(pack_route)
    changed = []
    searches = {}
    for path, route, adult in pages:
        if not path.is_file():
            raise ValueError('Missing navigation surface: ' + str(path))
        text = path.read_text()
        theme = has_reading_theme(text)
        control = SEARCH_CONTROLS.get(route)
        search = '#' + control if control and ('id="' + control + '"') in text else SEARCH_FALLBACK
        searches[route] = search
        replacement = header(route, rows, adult, route == audiences['pupils']['route'], theme,
                             route == '/Lessons/primary/', search)
        # SW2 Part T: promote only this caller's own published chrome.
        # Other trees keep this carrier's existing sources and admission bytes.
        owns_chrome = path.is_relative_to(output / 'education-lessons')
        if owns_chrome:
            from published_chrome import header as current_header, audience_rows as current_audience_rows, complete_chrome
            replacement = current_header(route, current_audience_rows(site_source), adult,
                                         route == audiences['pupils']['route'], theme,
                                         route == '/Lessons/primary/',
                                         '#search' if route in {'/Lessons/', '/Matt-s-Apps-/', '/Lessons/subject.html'} and 'id="search"' in text
                                         else '#primary-search' if route == '/Lessons/primary/' and 'id="primary-search"' in text
                                         else '/resources/#rxSearch')
        if route == '/Lessons/subject.html':
            from structural_html import prepend_to_first_main
            text,count=prepend_to_first_main(text,replacement)
        elif route in inserted:
            # These landings use a content header for their heading and Open
            # action. Add navigation before it without deleting those controls.
            text,count=re.subn(r'(<body\b[^>]*>)',lambda match:match.group(1)+replacement,text,count=1,flags=re.I)
        else:
            if owns_chrome:
                from structural_html import replace_first_element
                text,count=replace_first_element(text, 'header', replacement)
            else:
                text,count=re.subn(r'<header\b[^>]*>.*?</header>',lambda _:replacement,text,count=1,flags=re.S)
        if count != 1:
            raise ValueError('Missing navigation insertion/replacement boundary: '+str(path))
        if route == '/stats/on-this-device/':
            old="document.getElementById('menu').addEventListener('click',function(){var n=document.getElementById('nav'),o=n.classList.toggle('open');this.setAttribute('aria-expanded',o);});"
            if text.count(old)!=1: raise ValueError('Legacy stats menu handler changed')
            text=text.replace(old,'').replace('href="/main/#about"','href="/main/"')
        if owns_chrome:
            text = complete_chrome(text)
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-navigation.css">'
                            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)
        path.write_text(text)
        changed.append(route)
    for asset in ['shared-navigation.css', 'shared-navigation.js']:
        shutil.copyfile(HERE / asset, site / 'assets' / asset)
    return {'routes': changed, 'native_disclosure': True, 'audience_rows': rows,
            'governors_from_record': any(r[0] == '/for/governors-trustees/' for r in
                                         [(a['route'], a['label']) for a in audiences.values()]),
            'search_controls': searches}
