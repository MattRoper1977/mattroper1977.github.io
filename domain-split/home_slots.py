#!/usr/bin/env python3
"""J93: the education homepage served at / and /main/, bound at build time.

Ruling uz-6 (a)-(i), with the vb-3 pre-answers, as carried by the J93 build
design. The page is the accepted draft of record, domain-split/home/home.html
(r5, sha256 below), committed byte-identical with home.css r2 and home.js;
uz-6 (a): the build fills it, "never by editing the draft". This module reads
that file, refuses it if a single byte has moved, fills every slot from its
source of record and returns the page. education_frontdoors.render('home')
returns what render_home() returns; nothing else on the education site moves.

Where each slot comes from (uz-6 (b)):
* seo.title / seo.ogTitle and seo.description / seo.ogDescription are typed in
  the draft (the spec section 6 masthead string). They are confirmed, never
  retyped: title equals og:title, description equals og:description equals the
  h1. seo.canonical and seo.ogUrl are origin + '/', as the legacy render wrote.
* brand.credit is confirmed equal to the <strong> credit of the chrome's
  published-education header fragment (tools/chrome/header.html).
* audiences.doors.{0..3}: data/audience-homepages.json by key (pupils,
  teachers, parents, schools), as subject_slots.py reads it.
* flagship: Science, Autumn 2 Week 6, one Lessons registry row (resources.json)
  per pathway, BUILD, GROW, LAUNCH. The card, the pathway (tierOf) and the
  display title (the display-titles rule) are the hub's own, computed BY the
  Lessons hub.js (home_hub_counts.cjs); the outcome is the row's .desc and the
  week label the lesson-order.json entry's. Spec fallback: Humanities & RE,
  Autumn 2 Week 1. If neither resolves, the build stops.
* lessonPath is '/Lessons/' + .file. vb-3 (a): when that file is not in the
  Lessons tree, the lesson badge links the card's subject hub instead.
* packMembers (uz-6 (d), vb-3 (g)): the lesson folder's files minus the lesson
  page, approved-mark.jpg and any image, sorted by name. The badge list is
  regenerated: the data-fixed lesson badge first, then one badge per member.
* subjects.hubs.{0..3}: route and name from build_publications.SUBJECT_CARDS;
  the half-term labels from Lessons data/calendar-spine.json (they must be the
  hub's HALF_TERMS); liveCount is each hub's own distinctLessons over its card,
  computed by hub.js.
* teacherTools (uz-6 (e), vb-3 (b)): routes and labels from
  shared_navigation.HUB_LINKS. Resources is always present; Apps is kept while
  HUB_LINKS carries it; /tools/ is kept only while the Site page it serves
  (tools/index.html) exists. A card whose route is not served is omitted, never
  left empty. The four <template> slots stay inert.
* What's new (uz-6 (f), vd-1 (a)): there is no Education updated feed, so no
  item has a route of record and the whole section#whats-new is omitted: the
  bound page carries neither the section nor its heading (hidden by omission,
  never an empty heading). Play data is never bound and never read.
* owner.makerNote and the door and pathway bylines (uz-6 (g), vb-3 (h)) are
  the owner's words of spec section 6, verbatim; each is confirmed by digest,
  never retyped.
* PLAY_ROOT/ (masthead and footer) becomes shared_navigation.PLAY, the Play
  root the stamped menu already links (lane decision LD5).
* SEO-1 (vd-1 (b), which rules the README section 10 block that uz-6 (g) had
  left out): one JSON-LD block, a WebSite and a Person, stamped before </head>.
  Both are named with the owner's brand line: the part of the draft's typed
  <title> after its last ' · ', confirmed equal (ignoring case) to the chrome's
  brand credit. The WebSite carries url origin + '/', the draft's html lang and
  the Person as publisher; the Person carries only its @id (origin + '/#about',
  the Meet section) and the name. No contact details of any kind (no email,
  telephone, address, contactPoint, sameAs, url or similar on the Person).
* No qualification badges and no awarding-body or exam-board text (vb-3 (d)).
* LD10 (lane decision under vb-1): the build links /assets/home-corrections.css
  (domain-split/home_corrections.css) right after /assets/home.css. The draft
  files stay byte-identical; the corrections add only what the estate's
  no-overflow and 44 px target gates ask of every page (the footer wrapper's
  border-box; the lesson badge and maker's-note links at 44 px).

data-sample is dropped from every element the build fills; every other
attribute and all other markup is kept. The self-test proves that the output
differs from the draft only by slot values, the regenerated badge lists, the
omitted section and cards, PLAY_ROOT, the dropped data-sample, the stamped
SEO-1 block and the LD10 correction link.

A slot that cannot be filled stops the build: the page is never published
half-filled.

    python3 home_slots.py --self-test [--lessons <Lessons checkout>]
"""
from pathlib import Path
from urllib.parse import quote
import argparse
import builtins
import hashlib
import html
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / 'home' / 'home.html'
# home.html r5, the accepted draft of record (README_J93 section 12).
# Pinned: the sha256 of home.html r5 (31,020 B), the file of record in rulings uz-6 and vb-3.
TEMPLATE_SHA256 = '32f53a119ed9d3e6e88daee81d201c6cf737d1d6e06cc5c0b6e668e52287e7aa'
NODE_SCRIPT = HERE / 'home_hub_counts.cjs'
RECORD = 'data/audience-homepages.json'
HEADER = 'tools/chrome/header.html'
TOOLS_PAGE = 'tools/index.html'
SPINE = 'data/calendar-spine.json'

DOOR_KEYS = ('pupils', 'teachers', 'parents', 'schools')
PATHWAYS = ('BUILD', 'GROW', 'LAUNCH')
# Spec section 6: the flagship week, and the spec's fallback. (query, term, week)
FLAGSHIP = ('science', 'Aut2', 6)
FALLBACK = ('humanities-re', 'Aut2', 1)
# uz-6 (d), vb-3 (g): never a pack badge.
BRAND_ASSET = 'approved-mark.jpg'
IMAGE = re.compile(r'\.(jpe?g|png|gif|svg|webp)$', re.I)
# HUB_LINKS labels of the three Teacher Tools cards.
TOOL_LABELS = {'resources': 'Resources', 'apps': 'Apps & tools', 'tools': 'Teacher tools'}
# The owner's words (spec section 6), confirmed by digest of the draft's markup.
# Pinned: the sha256 of each owner-word string as home.html r5 types it, in page order (masthead 1, door
# bylines 4, pathway bylines 3, maker's note 1): spec b3d3df9b section 6, an input of record under uz-6.
OWNER_WORDS = {
    'masthead': ['945b7adcfbc710f3444046127d91a4d07553a3763a378acfea51b9ec40eb8b47'],
    'door bylines': ['918c9a19dcd444e40528c54d693575bd51cb31bb5ff41a74436ab0e74cc3389d',
                     '3af663135ec09ce91d65f807afaeb4fd0758820a654b2f2008baadab2d8f1890',
                     'efc1930059d2b78aeb1189bd84a85b0fb7471701bce6215b9f71c3698dff9f21',
                     '5246e29e2bfa47995508bb98803643cb92398d1fadf60636112776c6053dec53'],
    'pathway bylines': ['6169dec5ccba933f8bd3c32ef822dcb8a8c8e8e7b784595ce155353bc7fcd858',
                        '48b7c74e554c72172f525c8c93d1f8aaaf2f015c1be0be8bcb7d43eb4860355d',
                        'a72151587225ae8be9a73e1e59ead704779a47ae3f1bc34a6f51dfc91c3f24c4'],
    "maker's note": ['7bfa747447d07f52a323ec7e9158ff20624d316732da1a297256d38040b38057'],
}
OWNER_PATTERNS = {
    'masthead': r'<h1 id="home-title" class="home-descriptor">(.*?)</h1>',
    'door bylines': r'<p class="home-door-byline">(.*?)</p>',
    'pathway bylines': r'<p class="home-pathway-byline">(.*?)</p>',
    "maker's note": r'<p class="home-maker-note" data-slot="owner.makerNote">(.*?)</p>',
}
# Slots the build confirms and leaves exactly as the draft types them.
CONFIRMED = {'seo.title', 'seo.description', 'seo.ogTitle', 'seo.ogDescription', 'brand.credit', 'owner.makerNote'}
# uz-6 (e): the future Teacher Tools slots stay inert <template> elements.
INERT = {'teacherTools.classroomTools', 'teacherTools.tasterPack', 'teacherTools.itFactSheet',
         'teacherTools.catchUpCover'}
PLAY_ROOT = 'PLAY_ROOT/'
WHATS_NEW = re.compile(r'  <section class="home-section" id="whats-new"[^>]*>\n.*?\n  </section>\n\n', re.S)
TOOL_CARD = re.compile(r'        <a class="home-tool-card" data-slot-attr="href:teacherTools\.(\w+)\.route"[^>]*>\n'
                       r'.*?\n        </a>\n\n', re.S)
PACK_LIST = re.compile(r'(<ul class="home-pack-badges"[^>]*data-slot-each="flagship\.(\d)\.packMembers">\n)'
                       r'((?:[ ]*<li [^\n]*</li>\n)+)([ ]*</ul>)')
TEXT_SLOT = re.compile(r'(<(\w+)\b([^>]*?)\sdata-slot="([^"]+)"([^>]*)>)([^<]*)(</\2>)')
START_TAG = re.compile(r'<(\w+)\b[^>]*>')
ATTR_SLOT = re.compile(r'\sdata-slot-attr="(\w+):([^"]+)"')
SAMPLE = ' data-sample="none"'
# vd-1 (b): the stamped SEO-1 line, and the keys a contact detail would use (none may appear).
HOME_CSS_LINK = '<link rel="stylesheet" href="/assets/home.css">\n'
CORRECTIONS_LINK = '<link rel="stylesheet" href="/assets/home-corrections.css">\n'
LD_LINE = re.compile(r'<script type="application/ld\+json">[^\n]*</script>\n')
CONTACT_KEYS = {'email', 'telephone', 'faxNumber', 'address', 'contactPoint', 'sameAs', 'url', 'contactType',
                'areaServed', 'location', 'homeLocation', 'workLocation', 'image'}
# encodeURI's reserved set, so a path is linked the way the hub's safeHref links it.
URI_SAFE = "/;,?:@&=+$-_.!~*'()#"


def esc_text(value):
    return html.escape(str(value), quote=False)


def esc_attr(value):
    return html.escape(str(value), quote=True)


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


# --------------------------------------------------------------- sources --

def node_command():
    node = shutil.which('node')
    if not node:
        raise ValueError('The homepage counts need node to run the Lessons hub.js')
    return node


def hub_view(lessons_root, queries):
    """The Lessons hub.js's own counts, half-terms and flagship-week rows."""
    lessons_root = Path(lessons_root)
    if not (lessons_root / 'assets/catalogue/hub.js').is_file():
        raise ValueError('The homepage needs the Lessons hub.js: ' + str(lessons_root))
    weeks = []
    for query, term, week in (FLAGSHIP, FALLBACK):
        weeks += ['--week', f'{query}:{term}:{week}']
    run = subprocess.run([node_command(), str(NODE_SCRIPT), str(lessons_root), *queries, *weeks],
                         capture_output=True, text=True)
    if run.returncode != 0:
        raise ValueError('The homepage hub counts could not be computed: ' + run.stderr.strip()[-500:])
    return json.loads(run.stdout)


def chrome_credit(site_root):
    """The <strong> credit of the published-education header fragment."""
    text = (Path(site_root) / HEADER).read_text(encoding='utf-8')
    start, end = '<!-- MBM-CHROME-FRAGMENT: published-education -->', '<!-- /MBM-CHROME-FRAGMENT: published-education -->'
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError('The chrome header has no single published-education fragment')
    credits = re.findall(r'<strong>([^<]+)</strong>', text[text.index(start):text.index(end)])
    if len(credits) != 1:
        raise ValueError('The published-education header fragment has no single <strong> credit')
    return html.unescape(credits[0])


def audience_doors(site_root):
    audiences = json.loads((Path(site_root) / RECORD).read_text(encoding='utf-8'))['audiences']
    doors = []
    for key in DOOR_KEYS:
        entry = audiences.get(key)
        values = [entry.get(field) if isinstance(entry, dict) else None for field in ('route', 'label')]
        if not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError('The audience record has no complete door entry: ' + key)
        doors.append(tuple(values))
    return doors


def half_terms(lessons_root, hub_terms):
    blocks = json.loads((Path(lessons_root) / SPINE).read_text(encoding='utf-8'))['blocks']
    labels = list(blocks)
    if labels != list(hub_terms) or any(blocks[k].get('label', k) != k for k in labels):
        raise ValueError('The calendar spine half-terms are not the hub HALF_TERMS')
    return labels


def teacher_tools(site_root, hub_links):
    """{card: (route, label) or None}; None = the route is not served, so the card is omitted."""
    by_label = {label: route for route, label in hub_links}
    tools = {}
    for card, label in TOOL_LABELS.items():
        route = by_label.get(label)
        if card == 'resources' and not route:
            raise ValueError('HUB_LINKS has no Resources route; the Resources card is always present')
        if card == 'tools' and not (Path(site_root) / TOOLS_PAGE).is_file():
            route = None
        tools[card] = (route, label) if route else None
    return tools


def pack_members(folder, lesson_name):
    if not folder.is_dir():
        return []
    return sorted(p.name for p in folder.iterdir()
                  if p.is_file() and p.name != lesson_name and p.name != BRAND_ASSET and not IMAGE.search(p.name))


def derive(path, code):
    """README_J93 section 4: (ext, label) of a badge path."""
    name = path.rsplit('/', 1)[-1]
    if '.' not in name.strip('.'):
        raise ValueError('A pack badge needs a file extension: ' + name)
    stem, ext = name.rsplit('.', 1)
    if stem == code:
        return ext.upper(), 'Interactive Lesson'
    if not stem.startswith(code + '_') or not stem[len(code) + 1:]:
        raise ValueError('A pack member does not carry its lesson code: ' + name)
    return ext.upper(), stem[len(code) + 1:].replace('_', ' ')


def flagship(view, lessons_root, hubs):
    """The spec flagship week, else the spec fallback, else a refusal."""
    for query, term, week in (FLAGSHIP, FALLBACK):
        rows = [r for r in view['weeks'].get(f'{query}:{term}:{week}', []) if r.get('registry')]
        chosen = []
        for pathway in PATHWAYS:
            found = [r for r in rows if r.get('pathway') == pathway]
            if len(found) != 1 or not all(found[0].get(k) for k in ('file', 'title', 'desc', 'weekLabel')):
                break
            chosen.append(found[0])
        else:
            labels = {r['weekLabel'] for r in chosen}
            if len(labels) != 1:
                # S1: this week does not resolve (its three rows name different weeks); try the next
                # (the spec fallback), as a missing pathway row does, rather than leaving the loop.
                continue
            hub = next((h for h in hubs if h['slug'] == query), None)
            if hub is None:
                raise ValueError('The flagship subject is not one of the four homepage hubs: ' + query)
            cards = []
            for row in chosen:
                lesson = Path(lessons_root) / Path(*row['file'].split('/'))
                code = lesson.name.rsplit('.', 1)[0]
                members = pack_members(lesson.parent, lesson.name)
                cards.append({'pathway': row['pathway'], 'week': row['weekLabel'], 'title': row['title'],
                              'outcome': row['desc'], 'file': row['file'], 'code': code,
                              'lessonExists': lesson.is_file(),
                              # vb-3 (a): a lesson page missing from the tree links the subject hub.
                              'lessonHref': ('/Lessons/' + quote(row['file'], safe=URI_SAFE)) if lesson.is_file() else hub['route'],
                              'members': members,
                              'badges': [derive(row['file'], code)] + [derive(m, code) for m in members]})
            return {'query': query, 'name': hub['name'], 'route': hub['route'], 'weekLabel': labels.pop(),
                    'fallback': (query, term, week) != FLAGSHIP, 'cards': cards}
    raise ValueError('Neither the flagship week nor the spec fallback resolves to one registry lesson per pathway')


def gather(origin, site_root, lessons_root, subject_cards, hub_links, play):
    """Every value the page binds, read from its source of record."""
    if not origin or origin.endswith('/'):
        raise ValueError('The education origin must be given without a trailing slash')
    if not play.endswith('/') or not play.startswith('https://'):
        raise ValueError('The Play root must be an https origin ending in /')
    slugs = [slug for slug, *_ in subject_cards]
    view = hub_view(lessons_root, slugs)
    hubs = []
    for slug, name, *_ in subject_cards:
        count = view['counts'].get(slug)
        if not isinstance(count, int) or count < 1:
            raise ValueError('The hub reports no lessons for ' + slug)
        hubs.append({'slug': slug, 'name': name, 'route': '/Lessons/subject.html?subject=' + slug, 'count': count})
    return {'origin': origin, 'credit': chrome_credit(site_root), 'doors': audience_doors(site_root),
            'hubs': hubs, 'halfTerms': half_terms(lessons_root, view['halfTerms']),
            'flagship': flagship(view, lessons_root, hubs),
            'tools': teacher_tools(site_root, hub_links), 'play': play}


# ------------------------------------------------------------------ bind --

def confirm(text, sources):
    """The typed slots and the owner's words, confirmed, never retyped."""
    for name, pattern in OWNER_PATTERNS.items():
        found = [sha256(x) for x in re.findall(pattern, text)]
        if found != OWNER_WORDS[name]:
            raise ValueError("The owner's words moved: " + name)
    meta = lambda prop: re.findall(r'<meta (?:name|property)="' + prop + r'"[^>]*\scontent="([^"]*)">', text)
    title = re.findall(r'<title data-slot="seo.title">([^<]*)</title>', text)
    masthead = re.findall(OWNER_PATTERNS['masthead'], text)
    if len(title) != 1 or [html.unescape(x) for x in meta('og:title')] != [html.unescape(title[0])]:
        raise ValueError('seo.title and seo.ogTitle are not the one typed title')
    described = [html.unescape(x) for x in meta('description') + meta('og:description')]
    if len(described) != 2 or len(masthead) != 1 or set(described) != {html.unescape(masthead[0])}:
        raise ValueError('seo.description and seo.ogDescription are not the masthead string')
    credits = re.findall(r'<strong data-slot="brand.credit">([^<]*)</strong>', text)
    if len(credits) != 2 or {html.unescape(c) for c in credits} != {sources['credit']}:
        raise ValueError('brand.credit is not the chrome header credit')


def slot_values(sources):
    """key -> value for every slot the build fills (lessonPath/packMembers paths are badge tuples)."""
    v = {'seo.canonical': sources['origin'] + '/', 'seo.ogUrl': sources['origin'] + '/'}
    for i, (route, label) in enumerate(sources['doors']):
        v[f'audiences.doors.{i}.route'], v[f'audiences.doors.{i}.label'] = route, label
    fl = sources['flagship']
    v['flagship.subject.name'], v['flagship.flagshipWeek'] = fl['name'], fl['weekLabel']
    for i, card in enumerate(fl['cards']):
        for field in ('pathway', 'week', 'title', 'outcome'):
            v[f'flagship.{i}.{field}'] = card[field]
        v[f'flagship.{i}.lessonPath'] = (card['lessonHref'], card['badges'][0])
        for k, badge in enumerate(card['badges'][1:]):
            v[f'flagship.{i}.packMembers.{k}.path'] = (None, badge)
    for i, hub in enumerate(sources['hubs']):
        v[f'subjects.hubs.{i}.route'], v[f'subjects.hubs.{i}.name'] = hub['route'], hub['name']
        v[f'subjects.hubs.{i}.liveCount'] = str(hub['count'])
        for j, label in enumerate(sources['halfTerms']):
            v[f'subjects.hubs.{i}.halfTermLabels.{j}'] = label
    for card, value in sources['tools'].items():
        if value:
            v[f'teacherTools.{card}.route'], v[f'teacherTools.{card}.label'] = value
    return v


def repeaters(text, sources):
    """Each data-slot-each container holds exactly as many items as its source."""
    expected = {'audiences.doors': (len(sources['doors']), 'a.home-door-card', text.count('<a class="home-door-card"')),
                'flagship.cards': (len(PATHWAYS), 'article.home-pathway-card', len(re.findall(r'<article class="home-pathway-card" data-pathway-card="', text))),
                'subjects.hubs': (len(sources['hubs']), 'a.home-subject-tile', text.count('<a class="home-subject-tile ')),
                'teacherTools.items': (None, None, None)}
    for i in range(len(sources['hubs'])):
        block = re.search(r'data-slot-each="subjects\.hubs\.' + str(i) + r'\.halfTermLabels">\n(.*?)</ul>', text, re.S)
        expected[f'subjects.hubs.{i}.halfTermLabels'] = (len(sources['halfTerms']), 'li', block.group(1).count('<li ') if block else -1)
    for i in range(len(PATHWAYS)):
        expected[f'flagship.{i}.packMembers'] = (None, None, None)  # regenerated, not counted
    seen = re.findall(r'data-slot-each="([^"]+)"', text)
    if sorted(seen) != sorted(expected) or len(seen) != len(set(seen)):
        raise ValueError('Unresolved or repeated data-slot-each container: '
                         + ', '.join(sorted(set(seen) ^ set(expected))))
    for key, (want, what, have) in expected.items():
        if want is not None and want != have:
            raise ValueError(f'{key}: the draft holds {have} {what}, its source has {want}')
    order = re.findall(r'data-pathway-card="([A-Z]+)"', text)
    if tuple(order) != PATHWAYS or tuple(c['pathway'] for c in sources['flagship']['cards']) != PATHWAYS:
        raise ValueError('The flagship cards are not BUILD, GROW, LAUNCH in order')


def pack_list(match, sources):
    head, i, items, tail = match.group(1), int(match.group(2)), match.group(3), match.group(4)
    lines = items.splitlines(keepends=True)
    fixed = [line for line in lines if ' data-fixed="true"' in line]
    if len(fixed) != 1 or lines[0] is not fixed[0]:
        raise ValueError(f'flagship.{i}.packMembers: the lesson badge must be the one data-fixed first item')
    indent = re.match(r'[ ]*', fixed[0]).group(0)
    card = sources['flagship']['cards'][i]
    out = [fixed[0]]
    for k, (ext, label) in enumerate(card['badges'][1:]):
        key = f'flagship.{i}.packMembers.{k}.path'
        out.append(f'{indent}<li class="home-pack-badge home-format-{esc_attr(ext.lower())}">'
                   f'<span data-slot="{key}" data-derive="ext">{esc_text(ext)}</span> '
                   f'<span data-slot="{key}" data-derive="label">{esc_text(label)}</span></li>\n')
    return head + ''.join(out) + tail


def seo_json_ld(text, sources):
    """SEO-1 (vd-1 (b)): the WebSite and Person block, named with the owner's brand line; no contact details."""
    title = re.findall(r'<title data-slot="seo.title">([^<]*)</title>', text)
    if len(title) != 1 or ' · ' not in html.unescape(title[0]):
        raise ValueError('The draft title carries no brand line after " · "')
    brand = html.unescape(title[0]).rsplit(' · ', 1)[1].strip()
    if not brand or brand.casefold() != sources['credit'].casefold():
        raise ValueError('The brand line of the title is not the chrome brand credit')
    lang = re.findall(r'<html lang="([^"]+)">', text)
    if len(lang) != 1:
        raise ValueError('The draft has no single html lang')
    origin = sources['origin']
    person = {'@type': 'Person', '@id': origin + '/#about', 'name': brand}
    data = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'WebSite', '@id': origin + '/#website', 'url': origin + '/', 'name': brand, 'inLanguage': lang[0],
         'publisher': {'@id': person['@id']}},
        person]}
    if CONTACT_KEYS & set(person):
        raise ValueError('The Person block carries a contact detail')
    block = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return '<script type="application/ld+json">' + block + '</script>\n'


def bind(template, sources, check_digest=True):
    """The filled page. Refuses, rather than returning a half-filled page."""
    if check_digest and sha256(template) != TEMPLATE_SHA256:
        raise ValueError('home.html is not the r5 draft of record (sha256 ' + sha256(template)[:8] + ')')
    text = template
    confirm(text, sources)
    # uz-6 (f): no Education updated feed, so the whole What's new section goes.
    if len(WHATS_NEW.findall(text)) != 1:
        raise ValueError("The draft has no single What's new section to omit")
    text = WHATS_NEW.sub('', text)
    # uz-6 (e), vb-3 (b): a Teacher Tools card whose route is not served is omitted.
    cards = TOOL_CARD.findall(text)
    if sorted(cards) != sorted(TOOL_LABELS):
        raise ValueError('The draft Teacher Tools cards are not ' + ', '.join(TOOL_LABELS))
    text = TOOL_CARD.sub(lambda m: m.group(0) if sources['tools'][m.group(1)] else '', text)
    repeaters(text, sources)
    # uz-6 (d), vb-3 (g): the badge lists are regenerated from the lesson folders.
    if len(PACK_LIST.findall(text)) != len(PATHWAYS):
        raise ValueError('The draft has no badge list per flagship card')
    text = PACK_LIST.sub(lambda m: pack_list(m, sources), text)
    values = slot_values(sources)
    used = set()

    def flagship_span(page):
        return re.search(r'<section class="home-section home-flagship".*?</section>', page, re.S).span()
    span = flagship_span(text)

    def value(key, at):
        # The card link of each flagship card is the flagship subject's hub (the draft
        # types subjects.hubs.0, the Science hub, because Science is the flagship).
        if key == 'subjects.hubs.0.route' and span[0] <= at < span[1]:
            used.add(key)
            return sources['flagship']['route']
        if key not in values:
            raise ValueError('Unresolved slot: ' + key)
        used.add(key)
        return values[key]

    def text_slot(m):
        start, tag, before, key, after, content, end = m.groups()
        if key in CONFIRMED or key in INERT:
            return m.group(0)
        found = value(key, m.start())
        if isinstance(found, tuple):
            derive_kind = re.search(r'\sdata-derive="(ext|label)"', start)
            if not derive_kind:
                raise ValueError('A path slot needs data-derive: ' + key)
            found = found[1][0 if derive_kind.group(1) == 'ext' else 1]
        return start.replace(SAMPLE, '') + esc_text(found) + end

    text = TEXT_SLOT.sub(text_slot, text)
    span = flagship_span(text)  # positions moved with the text slots

    def attr_slot(m):
        tag = m.group(0)
        slot = ATTR_SLOT.search(tag)
        if not slot:
            return tag
        attr, key = slot.groups()
        if key in CONFIRMED:
            used.add(key)
            return tag
        found = value(key, m.start())
        if isinstance(found, tuple):
            found = found[0]
        filled = ' ' + attr + '="' + esc_attr(found) + '"'
        tag = tag.replace(SAMPLE, '')
        existing = re.search(r'\s' + attr + r'="[^"]*"', tag)
        if existing:
            return tag[:existing.start()] + filled + tag[existing.end():]
        slot = ATTR_SLOT.search(tag)
        return tag[:slot.end()] + filled + tag[slot.end():]

    text = START_TAG.sub(attr_slot, text)
    # Every slot left must be one the build confirms or keeps inert.
    for key in re.findall(r'\sdata-slot="([^"]+)"', text):
        if key not in values and key not in CONFIRMED and key not in INERT:
            raise ValueError('Unresolved slot: ' + key)
    for key in re.findall(r'\sdata-slot-attr="\w+:([^"]+)"', text):
        if key not in used:
            raise ValueError('Unresolved slot: ' + key)
    # LD5: the Play root the stamped chrome already links.
    if text.count(PLAY_ROOT) != 2:
        raise ValueError('The draft does not carry PLAY_ROOT/ twice (masthead and footer)')
    text = text.replace(PLAY_ROOT, sources['play'])
    for needle, why in ((SAMPLE, 'an unfilled data-sample'), ('data-sample', 'a data-sample'),
                        ('id="whats-new"', "the What's new section"), ('application/ld+json', 'JSON-LD of its own'),
                        ('data-mailing-link', 'a mailing link'), ('PLAY_ROOT', 'PLAY_ROOT')):
        if needle in text:
            raise ValueError('The bound page still carries ' + why)
    # LD10: the correction stylesheet, right after the draft's own stylesheet.
    if text.count(HOME_CSS_LINK) != 1 or 'home-corrections.css' in text:
        raise ValueError('The draft has no single home.css link to follow')
    text = text.replace(HOME_CSS_LINK, HOME_CSS_LINK + CORRECTIONS_LINK, 1)
    # vd-1 (b): SEO-1 stamped at build, once, before </head>.
    if text.count('</head>') != 1:
        raise ValueError('The draft has no single </head>')
    text = text.replace('</head>', seo_json_ld(text, sources) + '</head>', 1)
    return text


def render_home(origin, bp):
    """education_frontdoors.render('home', origin, bp): the bound J93 page."""
    import shared_navigation
    if bp.LESSONS_ROOT is None:
        raise ValueError('The homepage needs the Lessons checkout (--lessons)')
    template = TEMPLATE.read_bytes().decode('utf-8')
    sources = gather(origin, bp.ROOT, bp.LESSONS_ROOT, bp.SUBJECT_CARDS, shared_navigation.HUB_LINKS,
                     shared_navigation.PLAY)
    return bind(template, sources)


# ------------------------------------------------------------- self-test --

def neutral(text):
    """The page with every bindable thing blanked, so draft and output compare
    byte for byte: slot values, badge lists, PLAY, What's new, data-sample."""
    text = WHATS_NEW.sub('', text)
    text = LD_LINE.sub('', text)
    text = text.replace(CORRECTIONS_LINK, '')
    text = PACK_LIST.sub(lambda m: m.group(1) + m.group(3).splitlines(keepends=True)[0] + '§PACK§\n' + m.group(4), text)
    text = TEXT_SLOT.sub(lambda m: m.group(1).replace(SAMPLE, '') + '§' + m.group(7), text)

    def blank(m):
        tag = m.group(0).replace(SAMPLE, '')
        slot = ATTR_SLOT.search(tag)
        if not slot:
            return tag
        return re.sub(r'\s' + slot.group(1) + r'="[^"]*"', '', tag)
    return START_TAG.sub(blank, text)


def self_test(lessons_root=None):
    import shared_navigation
    import build_publications as bp
    site_root = HERE.parent
    template = TEMPLATE.read_bytes().decode('utf-8')
    ok = True

    def control(name, passed, detail=''):
        nonlocal ok
        ok = ok and bool(passed)
        print(f"  [{'ok' if passed else 'FAIL'}] {name}{'  - ' + detail if detail else ''}")

    def refusal(call, *args, **kwargs):
        try:
            call(*args, **kwargs)
            return ''
        except ValueError as err:
            return str(err)

    origin = 'https://education.example'
    play = shared_navigation.PLAY
    control('the committed draft is r5 of record', sha256(template) == TEMPLATE_SHA256, sha256(template)[:8])

    # A synthetic Lessons world, so the refusals run without a checkout: three
    # lesson folders whose pack files carry the draft's own badge labels.
    temp = Path(tempfile.mkdtemp(prefix='home-slots-'))
    try:
        samples = [re.findall(r'data-derive="(ext|label)">([^<]*)<', m.group(3)) for m in PACK_LIST.finditer(template)]
        fake_cards = []
        for i, pathway in enumerate(PATHWAYS):
            code = 'FIXTURE_' + pathway
            folder = temp / 'Fixture' / pathway / code
            folder.mkdir(parents=True)
            (folder / (code + '.html')).write_text('lesson')
            (folder / BRAND_ASSET).write_text('brand')
            (folder / 'cover.png').write_text('image')
            pairs = samples[i][2:]  # after the lesson badge's ext + label
            members = []
            for k in range(0, len(pairs), 2):
                name = code + '_' + html.unescape(pairs[k + 1][1]).replace(' ', '_') + '.' + pairs[k][1].lower()
                (folder / name).write_text('member')
                members.append(name)
            fake_cards.append({'pathway': pathway, 'file': f'Fixture/{pathway}/{code}/{code}.html', 'code': code})

        def fake_sources(**over):
            hubs = [{'slug': s, 'name': n, 'route': '/Lessons/subject.html?subject=' + s, 'count': 10 + j}
                    for j, (s, n, *_) in enumerate(bp.SUBJECT_CARDS)]
            # weeks: which pathways have a registry row in the flagship week and in the fallback week
            present = over.pop('weeks', {FLAGSHIP: PATHWAYS, FALLBACK: ()})
            # mixed_labels: weeks whose LAUNCH row carries a different week label from the other two
            mixed = over.pop('mixed_labels', ())
            view = {'weeks': {}}
            for (q, t, w), pathways in present.items():
                view['weeks'][f'{q}:{t}:{w}'] = [
                    {'file': card['file'], 'registry': True, 'pathway': card['pathway'],
                     'title': card['pathway'] + ' fixture', 'desc': 'fixture outcome',
                     'weekLabel': f'{t} · Week {w}' + (' (other)' if (q, t, w) in mixed and card['pathway'] == 'LAUNCH' else '')}
                    for card in fake_cards if card['pathway'] in pathways]
                # a lesson-order supplement is a hub row but never a registry row
                view['weeks'][f'{q}:{t}:{w}'].append({'file': 'x.html', 'registry': False, 'pathway': 'GROW',
                                                      'title': 'supplement', 'desc': 'x', 'weekLabel': 'x'})
            src = {'origin': origin, 'credit': chrome_credit(site_root), 'doors': audience_doors(site_root),
                   'hubs': hubs, 'halfTerms': ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2'],
                   'flagship': flagship(view, temp, hubs),
                   'tools': teacher_tools(over.pop('site_root', site_root), shared_navigation.HUB_LINKS), 'play': play}
            src.update(over)
            return src

        base = fake_sources()
        page = bind(template, base)
        control('green: the draft binds against a complete set of sources', bool(page))
        control('the output differs from the draft only by slot values, badge lists, the omitted section and cards, PLAY_ROOT and data-sample',
                neutral(page.replace(play, PLAY_ROOT)) == neutral(template))
        control("What's new is omitted whole (uz-6 (f)); the four <template> slots stay inert",
                'id="whats-new"' not in page and 'home-update-item' not in page
                and all(f'<template data-slot="{k}"></template>' in page for k in INERT))
        whats_new = WHATS_NEW.search(template).group(0)
        play_titles = re.findall(r'class="home-update-title"[^>]*>([^<]+)<', whats_new)
        control('Play data is never bound: none of the draft Play update titles reaches the page',
                len(play_titles) == 6 and not any(t in page for t in play_titles))
        control('PLAY_ROOT/ becomes shared_navigation.PLAY twice; no data-sample is left',
                page.count('href="' + play + '"') == 2 and 'data-sample' not in page and 'PLAY_ROOT' not in page)
        control('no mailing link (vd-1 (c))', 'data-mailing-link' not in page)
        control('LD10: the correction stylesheet is linked once, right after home.css',
                page.count(CORRECTIONS_LINK) == 1 and HOME_CSS_LINK + CORRECTIONS_LINK in page)
        blocks = LD_LINE.findall(page)
        ld = json.loads(blocks[0].split('>', 1)[1].rsplit('</script>', 1)[0]) if len(blocks) == 1 else {}
        graph = {g.get('@type'): g for g in ld.get('@graph', [])}

        def keys(o):
            return set(o) | {k for v in o.values() if isinstance(v, dict) for k in keys(v)} if isinstance(o, dict) else set()
        brand = html.unescape(re.findall(r'<title data-slot="seo.title">([^<]*)</title>', template)[0]).rsplit(' · ', 1)[1]
        control('SEO-1 (vd-1 (b)): exactly one JSON-LD block, before </head>, a WebSite and a Person',
                len(blocks) == 1 and page.index(blocks[0]) < page.index('</head>') < page.index('<body')
                and sorted(graph) == ['Person', 'WebSite'] and ld.get('@context') == 'https://schema.org')
        control("SEO-1: both named with the owner's brand line (the title's, = the chrome credit ignoring case)",
                graph.get('WebSite', {}).get('name') == graph.get('Person', {}).get('name') == brand
                and brand.casefold() == base['credit'].casefold())
        control('SEO-1: WebSite url is origin + "/", publisher is the Person; the Person carries no contact detail',
                graph.get('WebSite', {}).get('url') == origin + '/'
                and graph.get('WebSite', {}).get('publisher', {}).get('@id') == graph.get('Person', {}).get('@id') == origin + '/#about'
                and not (CONTACT_KEYS & keys(graph.get('Person', {}))) and set(graph.get('Person', {})) == {'@type', '@id', 'name'})
        retitled = re.sub(r'( · )[^<"]*(</title>)', r'\1Another brand\2', template, count=1)
        retitled = re.sub(r'(<meta property="og:title"[^>]*content="[^"]*· )[^"]*(")', r'\1Another brand\2', retitled, count=1)
        control('SEO-1 plant: a title brand line that is not the chrome credit is refused',
                'brand line' in refusal(bind, retitled, base, check_digest=False))
        own_ld = template.replace('</head>', '<script type="application/ld+json">{}</script>\n</head>', 1)
        control('SEO-1 plant: a draft carrying JSON-LD of its own is refused',
                'JSON-LD of its own' in refusal(bind, own_ld, base, check_digest=False))
        badges = [len(re.findall(r'<li class="home-pack-badge', m.group(3))) for m in PACK_LIST.finditer(page)]
        control('badges per card = 1 lesson + the folder minus the page, approved-mark.jpg and images',
                badges == [1 + len(samples[i][2:]) // 2 for i in range(3)] == [9, 9, 9], str(badges))
        control('regenerated badge lists are the draft lists when the folder holds the draft files',
                [m.group(3).splitlines()[1:] for m in PACK_LIST.finditer(page)]
                == [m.group(3).splitlines()[1:] for m in PACK_LIST.finditer(template)])
        doors = re.findall(r'<a class="home-door-card" data-slot-attr="href:audiences\.doors\.\d\.route" href="([^"]+)"', page)
        control('the four doors carry the record routes by key', doors == [r for r, _ in base['doors']], f'{len(doors)} doors')

        # Planted refusals and fallbacks.
        drift = template.replace('Choose your door', 'Choose your doors', 1)
        control('template drift: one changed byte of the draft is refused',
                'not the r5 draft' in refusal(bind, drift, base))
        unknown = template.replace('data-slot="subjects.hubs.3.name"', 'data-slot="subjects.hubs.9.name"', 1)
        control('unresolved slot: a key with no source is refused', 'Unresolved slot' in refusal(bind, unknown, base, check_digest=False))
        unknown_attr = template.replace('href:subjects.hubs.3.route', 'href:subjects.hubs.7.route', 1)
        control('unresolved slot: an attribute key with no source is refused',
                'Unresolved slot' in refusal(bind, unknown_attr, base, check_digest=False))
        control('a draft whose Teacher Tools cards are not the three of record is refused',
                'Teacher Tools cards' in refusal(bind, template.replace('teacherTools.apps.route', 'teacherTools.other.route', 1),
                                                 base, check_digest=False))
        control('owner words: a moved byline is refused',
                "owner's words" in refusal(bind, template.replace('Tap and go', 'Tap  and go', 1), base, check_digest=False))
        no_grow = {FLAGSHIP: ('BUILD', 'LAUNCH'), FALLBACK: PATHWAYS}
        control('flagship missing row (no GROW registry row in the flagship week): the spec fallback week is bound',
                fake_sources(weeks=no_grow)['flagship']['fallback'] is True)
        control('flagship: neither week resolves to one registry row per pathway -> refusal',
                'Neither the flagship week' in refusal(fake_sources, weeks={FLAGSHIP: ('BUILD', 'LAUNCH'), FALLBACK: ('LAUNCH',)}))
        def fallback_bound(**over):
            try:
                return fake_sources(**over)['flagship']['fallback'] is True
            except ValueError:
                return False
        control('flagship plant: one registry row per pathway but differing week labels -> the spec fallback week is bound',
                fallback_bound(weeks={FLAGSHIP: PATHWAYS, FALLBACK: PATHWAYS}, mixed_labels=(FLAGSHIP,)))
        control('flagship plant: differing week labels in both weeks -> refusal',
                'Neither the flagship week' in refusal(fake_sources, weeks={FLAGSHIP: PATHWAYS, FALLBACK: PATHWAYS},
                                                       mixed_labels=(FLAGSHIP, FALLBACK)))
        fb = fake_sources(weeks=no_grow)
        fb_page = bind(template, fb)
        links = re.findall(r'<a class="home-card-link" data-slot-attr="href:subjects\.hubs\.0\.route" href="([^"]+)"', fb_page)
        control('fallback: the card links and the kicker name the fallback subject hub',
                links == [fb['flagship']['route']] * 3 and fb['flagship']['route'].endswith('=' + FALLBACK[0]))
        (temp / fake_cards[1]['file']).unlink()
        gone = fake_sources()
        gone_page = bind(template, gone)
        hrefs = re.findall(r'data-slot-attr="href:flagship\.(\d)\.lessonPath" href="([^"]+)"', gone_page)
        control('vb-3 (a): a missing lesson file links the badge to the subject hub',
                hrefs[1][1] == gone['flagship']['route'] and hrefs[0][1] == '/Lessons/' + fake_cards[0]['file'], str([h[1][:9] for h in hrefs]))
        (temp / fake_cards[1]['file']).write_text('lesson')
        no_tools = temp / 'site'
        (no_tools / 'tools').mkdir(parents=True)
        plain = bind(template, fake_sources(site_root=no_tools))
        control('vb-3 (b): an unserved tools page omits the /tools/ card (not left empty); the others stay',
                plain.count('<a class="home-tool-card"') == 2 and 'teacherTools.tools' not in plain
                and 'teacherTools.resources.route' in plain and 'teacherTools.apps.route' in plain)
        record = json.loads((site_root / RECORD).read_text(encoding='utf-8'))
        record['audiences'].pop('schools')
        (no_tools / 'data').mkdir()
        (no_tools / RECORD).write_text(json.dumps(record), encoding='utf-8')
        control('a record without one of the four door keys is refused', 'schools' in refusal(audience_doors, no_tools))
        control('a pack file without its lesson code is refused', 'lesson code' in refusal(derive, 'Other_Notes.pdf', 'FIXTURE_BUILD'))
        control('an origin with a trailing slash is refused', refusal(gather, origin + '/', site_root, temp, bp.SUBJECT_CARDS,
                                                                        shared_navigation.HUB_LINKS, play) != '')
        hostile = dict(base, doors=[('/for/x/"><b>', '<b>&</b>')] + base['doors'][1:])
        hostile_page = bind(template, hostile)
        control('record text is escaped, never written as markup',
                '&lt;b&gt;&amp;&lt;/b&gt;' in hostile_page and '"><b>' not in hostile_page)

        # With a real Lessons checkout: the sources of record, end to end.
        if lessons_root:
            lessons_root = Path(lessons_root)
            reads = []
            real_open = builtins.open
            def watched(file, *a, **k):
                reads.append(str(file))
                return real_open(file, *a, **k)
            builtins.open = watched
            io.open = watched
            try:
                real = gather(origin, site_root, lessons_root, bp.SUBJECT_CARDS, shared_navigation.HUB_LINKS, play)
                real_page = bind(template, real)
            finally:
                builtins.open = real_open
                io.open = real_open
            counts = [h['count'] for h in real['hubs']]
            control('real: liveCount = hub.js distinctLessons per hub', all(c > 0 for c in counts), '/'.join(map(str, counts)))
            fl = real['flagship']
            control('real: the flagship is the spec week, one registry row per pathway, BUILD/GROW/LAUNCH',
                    not fl['fallback'] and [c['pathway'] for c in fl['cards']] == list(PATHWAYS), f"{fl['query']} {len(fl['cards'])} cards")
            control('real: every lesson file exists and its badge links /Lessons/<file>',
                    all(c['lessonExists'] and c['lessonHref'] == '/Lessons/' + quote(c['file'], safe=URI_SAFE) for c in fl['cards']))
            real_badges = [len(c['badges']) for c in fl['cards']]
            control('real: badges per card', real_badges == [9, 9, 9], str(real_badges))
            control('real: the regenerated badge lists equal the draft lists (ext, label and order)',
                    [m.group(3).splitlines()[1:] for m in PACK_LIST.finditer(real_page)]
                    == [m.group(3).splitlines()[1:] for m in PACK_LIST.finditer(template)])
            control('real: the output differs from the draft only where the build fills it',
                    neutral(real_page.replace(play, PLAY_ROOT)) == neutral(template))
            control('real: no Play file is read', not any('/play/' in r or 'evidence.json' in r for r in reads), f'{len(reads)} reads')
            control('real: one SEO-1 block, named with the brand line, no contact detail',
                    len(LD_LINE.findall(real_page)) == 1 and not any('"' + k + '"' in LD_LINE.findall(real_page)[0]
                                                                  for k in CONTACT_KEYS - {'url'}))
            before = WHATS_NEW.sub('', template).splitlines()
            after = LD_LINE.sub('', real_page).replace(CORRECTIONS_LINK, '').splitlines()
            moved = [i for i, (a, b) in enumerate(zip(before, after)) if a != b]
            control('real: every line that moved is a slot line or a PLAY_ROOT line',
                    len(before) == len(after) and all('data-slot' in before[i] or PLAY_ROOT in before[i] for i in moved),
                    f'{len(moved)} lines moved')
            planted = lessons_root / '.no-such-tree'
            control('real: a tree without hub.js is refused', 'hub.js' in refusal(hub_view, planted, ['science']))
            with tempfile.TemporaryDirectory() as plant:
                plant = Path(plant)
                for name in ('assets', 'data'):
                    (plant / name).symlink_to(lessons_root / name)
                rows = json.loads((lessons_root / 'resources.json').read_text(encoding='utf-8'))
                # The registry as it is, but no lesson folders in the tree: every badge links the hub.
                (plant / 'resources.json').write_text(json.dumps(rows), encoding='utf-8')
                bare = gather(origin, site_root, plant, bp.SUBJECT_CARDS, shared_navigation.HUB_LINKS, play)
                control('real plant: lesson files absent -> each lesson badge links the subject hub (vb-3 (a))',
                        [c['lessonHref'] for c in bare['flagship']['cards']] == [bare['flagship']['route']] * 3
                        and bind(template, bare).count('href="' + bare['flagship']['route'] + '"') >= 6)
                keep = [r for r in rows if r.get('file') not in {c['file'] for c in fl['cards']}]
                (plant / 'resources.json').write_text(json.dumps(keep), encoding='utf-8')
                why = refusal(gather, origin, site_root, plant, bp.SUBJECT_CARDS, shared_navigation.HUB_LINKS, play)
                control('real plant: the three flagship registry rows removed -> the fallback does not resolve today -> refusal',
                        'Neither the flagship week' in why, why[:60])
        else:
            print('  [skip] real-source limbs: no --lessons given')
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    print('home slots self-test', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true', required=True)
    parser.add_argument('--lessons', type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if self_test(args.lessons) else 1)
