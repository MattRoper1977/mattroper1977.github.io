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
CHROME = HERE.parent / 'tools' / 'chrome'


def chrome_template(filename, name, values):
    """Render one shared fragment; reject malformed fragments or slot drift.

    The publisher reads templates from its own immutable Site checkout. Values
    are already escaped text/attributes or HTML assembled by this renderer;
    substitution is one pass, so record text cannot become another template.
    """
    source = (CHROME / filename).read_text()
    start = '<!-- MBM-CHROME-FRAGMENT: ' + name + ' -->'
    end = '<!-- /MBM-CHROME-FRAGMENT: ' + name + ' -->'
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError('Expected one chrome fragment: ' + filename + ':' + name)
    start_at, end_at = source.index(start) + len(start), source.index(end)
    if end_at < start_at:
        raise ValueError('Chrome fragment boundaries reversed: ' + name)
    body = source[start_at:end_at]
    if not body.startswith('\n') or not body.endswith('\n'):
        raise ValueError('Chrome fragment must have its own boundary lines: ' + name)
    body = body[1:-1]
    slots = re.compile(r'\{\{([a-z_]+)\}\}')
    literal = slots.sub('', body)
    if '{{' in literal or '}}' in literal:
        raise ValueError('Malformed chrome template slot: ' + filename + ':' + name)
    if set(slots.findall(body)) != set(values):
        raise ValueError('Chrome template slots differ from renderer: ' + filename + ':' + name)
    return slots.sub(lambda match: values[match.group(1)], body)


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
                   '/Lessons/primary/': 'primary-search'}
SEARCH_FALLBACK = '/resources/#rxSearch'


class ScriptSources(HTMLParser):
    def __init__(self):
        super().__init__(); self.sources=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'script': self.sources.append(dict(attrs).get('src',''))


class ChromeDocument(HTMLParser):
    """Locate actual token links and read tagline text without serialising pages."""
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.lines = [0] + [i + 1 for i, c in enumerate(source) if c == '\n']
        self.links = []
        self.footers = 0
        self.stack = []
        self.text = {'all': [], 'header': [], 'footer': []}
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'footer':
            self.footers += 1
        if tag == 'link' and 'stylesheet' in values.get('rel', '').split():
            href = values.get('href', '')
            if urlsplit(href).path.rsplit('/', 1)[-1] == 'mbm-tokens.css':
                line, column = self.getpos()
                start = self.lines[line - 1] + column
                self.links.append((start, start + len(self.get_starttag_text()), href))
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]

    def handle_data(self, text):
        if any(tag in self.stack for tag in ['script', 'style', 'template']):
            return
        self.text['all'].append(text)
        for tag in ['header', 'footer']:
            if tag in self.stack:
                self.text[tag].append(text)

    def taglines(self):
        return {key: len(re.findall(r'Learn\s*•\s*Build\s*•\s*Explore', ' '.join(parts)))
                for key, parts in self.text.items()}


def complete_chrome(text):
    """Use the canonical token URL and fill an absent footer signoff only."""
    template = chrome_template('header.html', 'tokens', {})
    links = ChromeDocument(template).links
    if len(links) != 1 or links[0][2] != '/assets/mbm-tokens.css':
        raise ValueError('Expected one origin-root token link in the shared template')
    canonical = template[links[0][0]:links[0][1]]
    document = ChromeDocument(text)
    if len(document.links) > 1:
        raise ValueError('Duplicate token stylesheets on a publication surface')
    if document.links:
        start, end, href = document.links[0]
        if urlsplit(href).netloc:
            raise ValueError('Token stylesheet must use the publication origin')
        if href != '/assets/mbm-tokens.css':
            text = text[:start] + canonical + text[end:]
    else:
        if text.count('</head>') != 1:
            raise ValueError('Expected one token insertion boundary')
        text = text.replace('</head>', '<!-- mbm-chrome:tokens -->' + canonical +
                            '<!-- /mbm-chrome:tokens --></head>', 1)
    counts = document.taglines()
    if counts == {'all': 0, 'header': 0, 'footer': 0}:
        if document.footers > 1:
            raise ValueError('Ambiguous footer signoff owner')
        if str(HERE) not in sys.path:
            sys.path.insert(0, str(HERE))
        from structural_html import append_to_first_footer
        fragment = chrome_template('footer.html', 'published-signoff', {})
        fragment = '<!-- mbm-chrome:signoff -->' + fragment + '<!-- /mbm-chrome:signoff -->'
        text, count = append_to_first_footer(text, fragment)
        if count == 0:
            if text.count('</body>') != 1:
                raise ValueError('Missing footer insertion boundary')
            text = text.replace('</body>', '<footer data-mbm-chrome="minimal">' + fragment + '</footer></body>', 1)
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-footer.css"></head>', 1)
    elif counts != {'all': 1, 'header': 0, 'footer': 1}:
        raise ValueError('Tagline must appear once in the footer: ' + repr(counts))
    return text


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
    menu = chrome_template('menu-sheet.html', 'published-education', {
        'menu_title': escape(MENU_TITLE), 'groups': groups,
    })
    return chrome_template('header.html', 'published-education', {
        'search': escape(search, quote=True), 'menu': menu,
    })


def refresh(output, site_source):
    # Also support callers that load this module by absolute file path.
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    from structural_html import replace_first_element
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
        if route in inserted:
            # These landings use a content header for their heading and Open
            # action. Add navigation before it without deleting those controls.
            text,count=re.subn(r'(<body\b[^>]*>)',lambda match:match.group(1)+replacement,text,count=1,flags=re.I)
        else:
            text,count=replace_first_element(text, 'header', replacement)
        if count != 1:
            raise ValueError('Missing navigation insertion/replacement boundary: '+str(path))
        if route == '/stats/on-this-device/':
            old="document.getElementById('menu').addEventListener('click',function(){var n=document.getElementById('nav'),o=n.classList.toggle('open');this.setAttribute('aria-expanded',o);});"
            if text.count(old)!=1: raise ValueError('Legacy stats menu handler changed')
            text=text.replace(old,'').replace('href="/main/#about"','href="/main/"')
        text = complete_chrome(text)
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-navigation.css">'
                            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)
        path.write_text(text)
        changed.append(route)
    for asset in ['shared-navigation.css', 'shared-navigation.js', 'shared-footer.css']:
        shutil.copyfile(HERE / asset, site / 'assets' / asset)
    return {'routes': changed, 'native_disclosure': True, 'audience_rows': rows,
            'governors_from_record': any(r[0] == '/for/governors-trustees/' for r in
                                         [(a['route'], a['label']) for a in audiences.values()]),
            'search_controls': searches}
