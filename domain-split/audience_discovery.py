"""Refresh the five existing audience entry pages during Education assembly.

Only discovery HTML and its CSS/JS are written. Lesson, App and game payloads
remain owned by their source repositories. Call after education_discovery.refresh.
"""
from __future__ import annotations

import html
import json
from pathlib import Path
import re
import shutil
from html.parser import HTMLParser

HERE = Path(__file__).resolve().parent
PLAY = "https://www.madebymatt-play.uk"
EEF = "https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/supporting-parents"
NAV = [("Lessons", "/Lessons/"), ("Resources", "/resources/"),
       ("Apps & tools", "/Matt-s-Apps-/"), ("Teacher tools", "/tools/")]
ASDAN = [(pathway, f"/Lessons/{pathway}_ASDAN/{pathway}_ASDAN_Hub.html")
         for pathway in ("BUILD", "GROW", "LAUNCH")]
COPY = {
    "parents": ("Choose something to learn together.",
                "Start with a short activity, follow a school resource, or make something together. Choose what fits your child today."),
    "schools": ("Find what your setting needs next.",
                "Open teaching material, adapt an activity and find tools for classroom routines and evidence."),
    "trusts": ("Explore teaching across your schools.",
               "Compare subjects, pathways and practical tools with colleagues, using the materials themselves."),
    "councils": ("Find learning resources to share.",
                 "Explore public teaching resources, family starting points and professional guidance for schools and settings in your area."),
    "partners": ("Explore the work. Find a useful connection.",
                 "Try the lessons, creative apps and teaching tools, then get in touch about the work that interests you."),
}


def esc(value):
    return html.escape(str(value), quote=True)


def link(label, href, cls=""):
    return f'<a class="{esc(cls)}" href="{esc(href)}">{esc(label)}</a>'


def card(title, description, href, action="Open", image=None, alt=""):
    picture = (f'<img src="{esc(image)}" alt="{esc(alt)}" width="640" height="360" loading="lazy" decoding="async">'
               if image else "")
    return (f'<article class="ad-card">{picture}<div><h3>{esc(title)}</h3>'
            f'<p>{esc(description)}</p>{link(action, href, "ad-action")}</div></article>')


def section(id_, title, content, intro="", cls=""):
    return (f'<section class="ad-section {esc(cls)}" id="{esc(id_)}" aria-labelledby="{esc(id_)}-title">'
            f'<h2 id="{esc(id_)}-title">{esc(title)}</h2>'
            + (f'<p class="ad-intro">{esc(intro)}</p>' if intro else "") + content + '</section>')


def routes_section(id_, title, items, intro=""):
    cards = ''.join(card(x['title'], x['description'], x['href'], x.get('action', 'Open')) for x in items)
    return section(id_, title, f'<div class="ad-grid">{cards}</div>', intro)


def family_guidance():
    steps = [
        ("Read and talk", "Share a few pages, listen to someone read, or talk about a picture. Ask what might happen next; a spoken answer or pointing is fine."),
        ("Notice numbers", "Use familiar objects to sort, count or compare. Choose one small task and show an example before taking turns."),
        ("Make one thing", "Draw, write, record or build one idea. Let your child choose how to show it and talk about a part they enjoyed."),
        ("Plan the next step", "For a more independent learner, agree a manageable goal and a stopping point. Help with the routine, then let them try the task."),
    ]
    content = '<ol class="ad-steps">' + ''.join(
        f'<li><h3>{esc(title)}</h3><p>{esc(text)}</p></li>' for title, text in steps) + '</ol>'
    content += ('<p>Shorten an activity, do it together or return to it another day. If school has shared a task, ask which part matters most and tell them what helped.</p>'
                '<p class="ad-source">These suggestions draw on the EEF’s guidance on practical home learning, routines and positive dialogue with school. '
                f'{link("Working with Parents to Support Children’s Learning", EEF)} '
                '(published 7 December 2018; source checked 6 September 2026).</p>')
    return section('parent-tips', 'A small activity is a useful start', content)


FAQ_ANSWERS = [
    "Public Made by Matt lessons, resources and apps are free to open. The optional Ko-fi link helps support the work; using it is not required.",
    "No account is needed to open public lessons, resources or apps. Optional adult account features are separate; the Account page explains what is available.",
    "Choose a short task, show an example and take turns. Your child can answer by speaking, pointing or drawing. Use a printable version where one is offered.",
    "Use a modern web browser. Controls and graphics requirements vary by activity: some interactive activities need a keyboard, pointer or WebGL graphics. Try the activity on your device first. Use a printable download where one is offered.",
    "It changes the starting page and navigation. It does not create a child profile, set permissions or block other public pages. Its account and mailing controls are kept out of the pupil starting page.",
    "No. The adult mailing list has its own sign-up and consent. Creating an account does not subscribe you.",
    "No. Use your school’s guidance for your child and the labelled official sources for specialist advice. Made by Matt provides learning content and tools.",
]
FAQ_IDS = ['cost', 'account', 'players', 'device', 'pupil-home', 'mailing', 'advice']


def family_faq(audience):
    original = next(s for s in audience['sections'] if s['type'] == 'faq')['items']
    if len(original) != len(FAQ_ANSWERS):
        raise ValueError('Parent FAQ source changed; review every question before refresh')
    questions = [dict(row) for row in original]
    questions[1]['question'] = 'Does a child need an account to use public learning resources?'
    questions[2]['question'] = 'How can we use the activities together?'
    rows = ''.join(
        f'<details class="ad-faq" id="faq-{id_}"><summary>{esc(row["question"])}</summary><div><p>{esc(answer)}</p></div></details>'
        for row, answer, id_ in zip(questions, FAQ_ANSWERS, FAQ_IDS))
    return section('faq', 'Parent and carer questions', rows)


def original_routes(audience, section_id):
    return next(s for s in audience['sections'] if s['id'] == section_id)


def learning_cards():
    return [
        {'title': 'Primary learning', 'description': 'Find a primary activity to read, try or explore together.', 'href': '/Lessons/primary/', 'action': 'Open primary learning'},
        {'title': 'Lesson Hub', 'description': 'Browse classroom material by subject, pathway and year.', 'href': '/Lessons/', 'action': 'Find a lesson'},
        {'title': 'Creative apps', 'description': 'Choose browser tools for art, writing, audio, animation and documents.', 'href': '/Matt-s-Apps-/', 'action': 'Choose an app'},
    ]


def pathway_section():
    cards = ''.join(card(f'{name} ASDAN', 'Open the learning collection and its activities.', route, f'Open {name}') for name, route in ASDAN)
    return section('asdan-learning', 'ASDAN learning collections',
        f'<div class="ad-grid">{cards}</div><p>{link("Find ASDAN resources from every year", "/Lessons/?subject=ASDAN%20%26%20life%20skills&year=all")} · '
        f'{link("Search the ASDAN catalogue", "/resources/?q=asdan")}</p>',
        'Choose a collection for learning activities. The ASDAN Register in Teacher tools is a separate evidence tool.')


def professional_content(key, audience):
    purpose = {
        'schools': ('For your next planning session', 'Choose material for the pupils and routines you know. Review the instructions, reading demand and response options, then adapt the next step.'),
        'trusts': ('Compare a small, useful sample', 'Ask colleagues to open the same lesson, pathway or tool. Compare the task, accessibility and fit across your settings before deciding how to use it.'),
        'councils': ('Point people to the resource itself', 'Share a direct lesson, collection or family page so the receiving school or setting can review it in context.'),
        'partners': ('Try a complete example', 'Open a lesson or app in the area you know best. Use the contact link below if you want to discuss an idea or ask about the work.'),
    }
    title, description = purpose[key]
    content = section('priorities', title, f'<p>{esc(description)}</p>')
    source = original_routes(audience, 'platform-map')
    items = []
    for original in source['items']:
        row = dict(original)
        if row['href'] == '/games/':
            row.update(href=PLAY+'/', title='Made by Matt Play', description='Browse the games on the separate Play site.', action='Explore Play')
        if row['href'] == '/resources/':
            row['description'] = 'Find lessons, resources, apps and tools in one catalogue.'
        if row['href'] == '/main/':
            row['description'] = 'Explore the Education homepage and its learning areas.'
        items.append(row)
    content += routes_section('platform-map', 'Choose a starting point', items)
    content += pathway_section()
    source = original_routes(audience, 'official-guidance')
    content += routes_section('official-guidance', 'Professional guidance', source['items'],
                             'External resources are labelled by publisher in the Education Hub.')
    return content


def preserved_previews(audience):
    source = next(s for s in audience['sections'] if s['type'] == 'features')
    features = [x for x in source['features'] if x['href'] not in ('/games/', '/apexkick/')]
    cards = ''.join(card(x['title'], x['description'], x['href'], x['action'], x['image'], x['alt']) for x in features)
    return section('explore-together' if audience['route'] == '/for/parents-carers/' else 'visual-map',
                   'Explore the learning areas', f'<div class="ad-grid ad-preview-grid">{cards}</div>')


def make_main(key, audience, all_audiences):
    title, lead = COPY[key]
    nav = '<nav class="ad-nav" aria-label="Learning areas">' + ''.join(link(t, h) for t, h in NAV) + '</nav>'
    if key == 'parents':
        primary = ('<div class="ad-buttons">' + link('Primary learning', '/Lessons/primary/', 'ad-button')
                   + link('Find a school resource', '/resources/', 'ad-button ad-button-secondary') + '</div>')
    else:
        # UX2 B1: the source page's hero buttons come from the record's own
        # primaryCtas (label, href, style). The old menu carried /education-hub/
        # on every adult page and masked that this rebuilt main had dropped the
        # "Open the Education Hub" button; the Appendix A menu does not, so the
        # record's buttons render here and the destination survives on the page.
        ctas = [c for c in audience.get('primaryCtas', []) if c.get('href') and c.get('label')]
        primary = ('<div class="ad-buttons">' + ''.join(
            link(c['label'], c['href'], 'ad-button' if c.get('style') == 'primary' else 'ad-button ad-button-secondary')
            for c in ctas) + '</div>') if ctas else ''
    search = ('<form class="ad-search" action="/resources/" role="search">'
              '<label for="audience-search">Find a lesson, resource or app</label>'
              '<div><input id="audience-search" name="q" type="search" placeholder="Try a subject, activity or tool">'
              '<button type="submit">Search</button></div></form>')
    content = f'<main id="main" class="ad-main">{nav}<header class="ad-heading"><p class="ad-eyebrow">{esc(audience["label"])}</p><h1 id="page-title">{esc(title)}</h1><p>{esc(lead)}</p>{primary}{search}</header>'
    if key == 'parents':
        content += routes_section('learning-starts', 'Choose what fits today', learning_cards())
        content += family_guidance()
        trusted = original_routes(audience, 'trusted-resources')
        content += routes_section('trusted-resources', trusted['title'], trusted['items'], trusted['lead'])
        content += family_faq(audience)
    else:
        content += professional_content(key, audience)
    content += preserved_previews(audience)
    content += '<p id="audience-play-showcase" class="mbm-external-play">'+link('Made by Matt Play — separate games website', PLAY+'/')+'</p>'
    utilities = [dict(x) for x in audience.get('utilities', [])]
    for row in utilities:
        if row['href'] == '/for/pupils/':
            row['description'] = 'Open the pupil learning homepage.'
        elif row['href'] == '/resources/':
            row['description'] = 'Search lessons, resources, apps and tools.'
        elif row['href'] == 'mailto:contactmadebymatt@gmail.com':
            row['description'] = 'Ask a question or discuss the work with Matt.'
    content += routes_section('useful-routes', 'Useful links', utilities)
    choices = ''.join(link(a['label'], a['route']) for a in all_audiences.values())
    content += section('choose-homepage', 'Other starting points', '<nav class="ad-audiences" aria-label="Audience homepages">'+choices+'</nav>')
    content += '<div class="ad-adult-links">' + ' · '.join(link(label, href) for label, href in [('Account','/account/'), ('Members','/members/'), ('Teacher updates','/mailing-list/'), ('Privacy','/privacy/')]) + '</div></main>'
    return content


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = set()
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href', '')
            if href and not href.startswith('#'):
                self.hrefs.add(html.unescape(href))


def refresh(output, lessons, apps, site_source):
    """Write five entry pages into an already assembled Education root."""
    output, source = Path(output)/"education-site", Path(site_source)
    # Inputs are checked, never modified. They make accidental invocation against
    # a missing source checkout fail before any page is replaced.
    if not (Path(lessons)/'resources.json').is_file() or not (Path(apps)/'apps.json').is_file():
        raise FileNotFoundError('Audience refresh needs the real Lessons and Apps source manifests')
    data = json.loads((source/'data/audience-homepages.json').read_text())['audiences']
    report = {'pages': [], 'parentFAQQuestions': 7, 'sourceDate': '2026-09-06'}
    for key in COPY:
        audience = data[key]
        page = output/audience['route'].strip('/')/'index.html'
        original = (source/audience['route'].strip('/')/'index.html').read_text()
        source_links = Links(); source_links.feed(original)
        document = page.read_text()
        main = make_main(key, audience, data)
        document, replaced = re.subn(r'<main\b[^>]*>.*?</main>', lambda _: main, document, count=1, flags=re.S)
        if replaced != 1:
            raise ValueError(f'Expected one main element in {page}')
        document = re.sub(r'<title>.*?</title>', '<title>'+esc(audience['label'])+' · Made by Matt</title>', document, count=1, flags=re.S)
        document = re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', '<meta name="description" content="'+esc(COPY[key][1])+'">', document, count=1)
        if '/assets/audience-discovery.css' not in document:
            document = document.replace('</head>', '<link rel="stylesheet" href="/assets/audience-discovery.css"></head>', 1)
        if '/assets/audience-discovery.js' not in document:
            document = document.replace('</body>', '<script defer src="/assets/audience-discovery.js"></script></body>', 1)
        result_links = Links(); result_links.feed(document)
        # Game links change origin; all original non-game destinations survive.
        remapped = {'/games/': PLAY+'/', '/apexkick/': PLAY+'/'}
        missing = {remapped.get(h, h) for h in source_links.hrefs} - result_links.hrefs
        if missing:
            raise ValueError(f'Original audience routes would be lost in {page}: {sorted(missing)}')
        page.write_text(document)
        report['pages'].append({'route': audience['route'], 'originalDestinations': len(source_links.hrefs), 'preserved': True, 'playRemaps': {k:v for k,v in remapped.items() if k in source_links.hrefs}})
    (output/'assets').mkdir(exist_ok=True)
    for name in ('audience-discovery.css', 'audience-discovery.js'):
        shutil.copyfile(HERE/name, output/'assets'/name)
    return report
