"""Build the five adult audience pages during Education assembly.

Each page follows the Governors & trustees layout: a plain hero, four
conversation prompts, a searchable set of publisher-labelled resources and the
Made by Matt routes. Content lives in audience-pages.json. Every destination the
repository's source page linked to is kept on the rebuilt page (checked here
and again by check_audience_discovery.cjs). Call after education_discovery.refresh.
"""
from __future__ import annotations

import html
import json
from pathlib import Path
import re
import shutil
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
PLAY = "https://www.madebymatt-play.uk"
EEF = "https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/supporting-parents"
KEYS = ("parents", "schools", "trusts", "councils", "partners")
GOVERNORS = ("/for/governors-trustees/", "Governors & trustees")
ORIGINS = ("official", "sector", "made-by-matt")
FIELDS = ("id", "title", "url", "source", "origin", "topic", "type", "jurisdiction", "summary", "access", "checked")
ADULT_LINKS = [("Account", "/account/"), ("Members", "/members/"), ("Teacher updates", "/mailing-list/"), ("Privacy", "/privacy/")]
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
# Kept for any caller that imports the copy table; the page text itself now
# comes from audience-pages.json.
COPY = {key: None for key in KEYS}


def esc(value):
    return html.escape(str(value), quote=True)


def link(label, href, cls=""):
    attr = f' class="{esc(cls)}"' if cls else ''
    return f'<a{attr} href="{esc(href)}">{esc(label)}</a>'


def load_pages():
    pages = json.loads((HERE/'audience-pages.json').read_text())['pages']
    if tuple(pages) != KEYS:
        raise ValueError('audience-pages.json must hold exactly the five audience pages')
    for key, page in pages.items():
        ids = [row['id'] for row in page['resources']]
        if len(set(ids)) != len(ids):
            raise ValueError(f'Duplicate resource on the {key} page')
        for row in page['resources']:
            for field in FIELDS:
                if not row.get(field):
                    raise ValueError(f'Missing {field} on {key}/{row.get("id")}')
            if row['origin'] not in ORIGINS:
                raise ValueError(f'Unknown publisher group on {key}/{row["id"]}')
            url = urlparse(row['url'])
            if row['origin'] == 'made-by-matt':
                if not row['url'].startswith('/') or row['url'].startswith('//'):
                    raise ValueError(f'Made by Matt resource must use a site route: {row["id"]}')
            elif url.scheme != 'https' or not url.netloc:
                raise ValueError(f'External resource must use a direct HTTPS link: {row["id"]}')
        if [g[0] for g in page['groups']] != list(ORIGINS):
            raise ValueError(f'The {key} page must list the three publisher groups in order')
        if len(page['prompts']) != 4:
            raise ValueError(f'The {key} page needs four conversation prompts')
        if 'homeGuide' in page:
            guide = page['homeGuide']
            if not isinstance(guide, dict) or not guide.get('ways') or len(guide.get('levels', ())) != 3:
                raise ValueError(f'Invalid homeGuide on {key}')
            if [lvl.get('key') for lvl in guide['levels']] != ['base', 'track', 'summit']:
                raise ValueError(f'homeGuide levels on {key} must use public keys base, track, summit')
            for way in guide['ways']:
                if not way.get('title') or not way.get('tag') or not way.get('body'):
                    raise ValueError(f'Incomplete homeGuide way on {key}')
                if way.get('linkHref') and (not way['linkHref'].startswith('/') or way['linkHref'].startswith('//')):
                    raise ValueError(f'homeGuide way link must use a site route on {key}')
            if guide.get('levelsLink'):
                _, lhref = guide['levelsLink']
                if not lhref.startswith('/') or lhref.startswith('//'):
                    raise ValueError(f'homeGuide levelsLink must use a site route on {key}')
    return pages


def card(row):
    search = ' '.join(str(row.get(k, '')) for k in ('title', 'source', 'summary', 'topic', 'type', 'jurisdiction', 'access'))
    metadata = [('Publisher', row['source']), ('Covers', row['jurisdiction']), ('Access', row['access']), ('Checked', row['checked'])]
    dates = f'<p class="gv-effective">Effective from {esc(row["effectiveFrom"])}.</p>' if row.get('effectiveFrom') else ''
    action = 'Open on Made by Matt' if row['origin'] == 'made-by-matt' else 'Open publisher resource'
    return (f'<article class="gv-card" data-governance-card data-id="{esc(row["id"])}" '
            f'data-origin="{esc(row["origin"])}" data-topic="{esc(row["topic"])}" data-search="{esc(search.lower())}">'
            f'<p class="gv-tag">{esc(row["type"])}</p><h3>{esc(row["title"])}</h3><p>{esc(row["summary"])}</p>{dates}'
            '<dl>' + ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in metadata) + '</dl>'
            f'<a class="gv-open" href="{esc(row["url"])}">{action}<span class="gv-sr">: {esc(row["title"])}</span>'
            '<span aria-hidden="true"> →</span></a></article>')


def home_guide(page):
    guide = page.get('homeGuide')
    if not guide:
        return ''
    ways_rows = ''.join(
        '<details class="aud-way-item" open>'
        f'<summary><span>{esc(w["title"])}</span><span class="aud-way-tag">{esc(w["tag"])}</span></summary>'
        f'<div class="aud-way-body"><p>{esc(w["body"])}</p>'
        + (f'<p class="aud-way-action"><a class="aud-action-link" href="{esc(w["linkHref"])}"><span>{esc(w["linkLabel"])}</span><span aria-hidden="true">→</span></a></p>'
           if w.get('linkHref') and w.get('linkLabel') else '')
        + '</div></details>'
        for w in guide['ways']
    )
    ways_sec = (
        f'<section id="{esc(guide["waysId"])}" class="gv-group aud-ways" aria-labelledby="{esc(guide["waysId"])}-title">'
        f'<div class="aud-ways-shell"><p class="aud-kicker">{esc(guide["waysKicker"])}</p>'
        f'<h2 id="{esc(guide["waysId"])}-title">{esc(guide["waysTitle"])}</h2>'
        f'<p class="aud-ways-lead">{esc(guide["waysLead"])}</p>'
        f'<div class="aud-ways-list">{ways_rows}</div></div></section>'
    )
    lvl_link = ''
    if guide.get('levelsLink'):
        llabel, lhref = guide['levelsLink']
        lvl_link = f'<a class="aud-action-link" href="{esc(lhref)}"><span>{esc(llabel)}</span><span aria-hidden="true">→</span></a>'
    lvl_rows = ''.join(
        f'<article class="aud-level-card aud-level-{esc(lvl["key"])}" data-pathway-level="{esc(lvl["key"])}">'
        f'<div class="aud-level-head"><strong class="aud-path-word aud-path-{esc(lvl["key"])}">{esc(lvl["name"])}</strong>'
        f'<span class="aud-level-role">{esc(lvl["role"])}</span></div>'
        f'<p>{esc(lvl["description"])}</p></article>'
        for lvl in guide['levels']
    )
    levels_sec = (
        f'<section id="{esc(guide["levelsId"])}" class="gv-group aud-levels" aria-labelledby="{esc(guide["levelsId"])}-title">'
        f'<div class="aud-levels-shell"><div class="aud-levels-top"><div>'
        f'<p class="aud-kicker">{esc(guide["levelsKicker"])}</p>'
        f'<h2 id="{esc(guide["levelsId"])}-title">{esc(guide["levelsTitle"])}</h2>'
        f'<p class="aud-levels-lead">{esc(guide["levelsLead"])}</p></div>{lvl_link}</div>'
        f'<div class="aud-levels-grid">{lvl_rows}</div></div></section>'
    )
    return ways_sec + levels_sec


def family_faq(audience):
    original = next(s for s in audience['sections'] if s['type'] == 'faq')['items']
    if len(original) != len(FAQ_ANSWERS):
        raise ValueError('Parent FAQ source changed; review every question before refresh')
    questions = [dict(row) for row in original]
    questions[1]['question'] = 'Does a child need an account to use public learning resources?'
    questions[2]['question'] = 'How can we use the activities together?'
    rows = ''.join(
        f'<details class="gv-faq" id="faq-{id_}"><summary>{esc(row["question"])}</summary><p>{esc(answer)}</p></details>'
        for row, answer, id_ in zip(questions, FAQ_ANSWERS, FAQ_IDS))
    return ('<section id="faq" class="gv-group gv-faqs" aria-labelledby="faq-title"><div class="gv-section-head">'
            '<h2 id="faq-title">Parent and carer questions</h2></div>' + rows + '</section>')


def audience_link(key, all_audiences):
    if key == 'governors':
        return GOVERNORS
    return all_audiences[key]['route'], all_audiences[key]['label']


def make_page(key, page, audience, all_audiences):
    route = audience['route']
    rows = page['resources']
    origin_counts = {g: sum(1 for r in rows if r['origin'] == g) for g in ORIGINS}
    topic_counts = {}
    for r in rows:
        topic_counts[r['topic']] = topic_counts.get(r['topic'], 0) + 1
    topics = sorted(topic_counts)
    buttons = ''.join(link(label, href, 'gv-button' + ('' if i == 0 else ' gv-secondary'))
                      for i, (label, href) in enumerate(page['buttons']))
    glance = (
        '<ul class="gv-glance" aria-label="At a glance">'
        + f'<li><strong>{len(rows)}</strong> checked resources</li>'
        + (f'<li><strong>{origin_counts["official"]}</strong> official guidance</li>' if origin_counts['official'] else '')
        + f'<li><strong>{origin_counts["sector"]}</strong> sector &amp; support</li>'
        + f'<li><strong>{origin_counts["made-by-matt"]}</strong> Made by Matt</li>'
        + '<li>Free to open · No account needed</li>'
        + '</ul>'
    )
    prompts = ''.join(
        f'<article><span class="gv-step" aria-hidden="true">{i:02d}</span><h3>{esc(t)}</h3><p>{esc(d)}</p></article>'
        for i, (t, d) in enumerate(page['prompts'], 1)
    )
    if page.get('promptsSource'):
        lead, label, href, tail = page['promptsSource']
        small = f'<p class="gv-small gv-source">{esc(lead)} {link(label, href)} {esc(tail)}</p>'
    else:
        small = f'<p class="gv-small">{esc(page["promptsNote"])}</p>'
    topic_pills = (
        '<div class="gv-topic-pills" role="group" aria-label="Filter by topic">'
        + f'<button type="button" class="gv-topic-pill" data-topic-pick="" aria-pressed="true">All topics ({len(rows)})</button>'
        + ''.join(
            f'<button type="button" class="gv-topic-pill" data-topic-pick="{esc(t)}" aria-pressed="false">{esc(t)} ({topic_counts[t]})</button>'
            for t in topics
        )
        + '</div>'
    )
    groups = ''.join(
        f'<section class="gv-group" data-governance-group aria-labelledby="gv-{g}"><div class="gv-section-head">'
        f'<h2 id="gv-{g}">{esc(title)}</h2><p>{esc(description)}</p></div><div class="gv-grid">'
        + ''.join(card(r) for r in rows if r['origin'] == g) + '</div></section>'
        for g, title, description in page['groups'])
    hub_links = '<p class="gv-hub-links" id="trusted-resources">' + ''.join(link(l, h, 'gv-hub-pill') for l, h in page['hubLinks']) + '</p>'
    related = ''.join(link(label, href) for href, label in (audience_link(k, all_audiences) for k in page['related']))
    # education_expansion appends the governors row to this menu.
    others = ''.join(link(a['label'], a['route']) for a in all_audiences.values())
    utilities = ''.join(link(u['title'], u['href']) for u in audience.get('utilities', []))
    guide_html = home_guide(page)
    guide_css = '<link rel="stylesheet" href="/assets/audience-discovery.css">' if guide_html else ''
    faq = family_faq(audience) if key == 'parents' else ''
    contact = ('' if key == 'parents' else
               '<p>Questions about the work? '+link('Email Matt', 'mailto:contactmadebymatt@gmail.com')+'.</p>')
    canonical = 'https://madebymatt.uk' + route
    description = page['lead']
    return f'''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(audience["label"])} · Made by Matt</title><meta name="description" content="{esc(description)}">
<meta name="theme-color" content="#161d3d"><link rel="canonical" href="{esc(canonical)}">
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/governors-discovery.css">{guide_css}
<script defer src="/assets/governors-discovery.js"></script></head><body class="gv-page" data-mbm-audience-page="{esc(key)}">
<a class="gv-skip" href="#main">Skip to content</a><header class="gv-header"><div class="gv-wrap gv-header-inner">
<a class="gv-brand" href="/"><img src="/assets/brand/micro_mark.svg" width="60" height="60" alt=""><span>MADE BY MATT<small>Learn · Build · Explore</small></span></a>
<a class="gv-home" href="/">Education homepage</a></div></header>
<main id="main" class="gv-wrap aud-main"><section class="gv-hero" aria-labelledby="page-title"><p class="gv-eyebrow">{esc(page["eyebrow"])}</p>
<h1 id="page-title">{esc(page["title"])}</h1><p class="gv-lead">{esc(page["lead"])}</p>
<div class="gv-actions">{buttons}</div>
{glance}
<p class="gv-intro-note">{esc(page["note"])}</p></section>
<section id="{esc(page["promptsId"])}" class="gv-prompts" aria-labelledby="gv-prompts-title"><h2 id="gv-prompts-title">{esc(page["promptsTitle"])}</h2><div class="gv-prompt-grid">
{prompts}
</div>{small}</section>
{guide_html}<section id="audience-resources" class="gv-finder" aria-labelledby="gv-finder-title"><h2 id="gv-finder-title">Find the support you need</h2>
<form id="gv-search-form" role="search"><div class="gv-search-field"><label for="gv-search">{esc(page["finderLabel"])}</label><input id="gv-search" type="search" placeholder="{esc(page["finderPlaceholder"])}" autocomplete="off"></div>
<div><label for="gv-origin">Publisher group</label><select id="gv-origin"><option value="">All resources</option>{''.join(f'<option value="{g}">{esc(t)}</option>' for g, t, _ in page["groups"])}</select></div>
<div><label for="gv-topic">Topic</label><select id="gv-topic"><option value="">All topics</option>{''.join('<option>'+esc(t)+'</option>' for t in topics)}</select></div><button type="reset">Clear filters</button></form>
{topic_pills}
<p id="gv-result-count" role="status" aria-live="polite">{len(rows)} resources</p><p class="gv-small">Publisher content, prices and booking terms can change. Each card shows the date its link and access details were checked. External links take you to the named publisher.</p>
<noscript><p>All resources are listed below. Search and filters need JavaScript; the links work without it.</p></noscript>
{hub_links}</section>
<p id="gv-empty" hidden>No matching resources. Try a broader search or clear the filters.</p>{groups}
{faq}<section class="gv-next" id="useful-routes"><h2>More from Made by Matt</h2><p>{esc(page["closing"])}</p>{contact}<div class="gv-actions">{link("Professional Education Hub", "/education-hub/")}{related}</div>
<h3>Useful links</h3><div class="gv-actions">{utilities}{link("Resources", "/resources/")}{link("Tools", "/tools/")}</div>
<h3 id="choose-homepage">Other starting points</h3><nav class="gv-actions" aria-label="Audience homepages">{others}</nav>
<p class="gv-small gv-adult-links">{''.join(link(l, h, 'gv-hub-pill') for l, h in ADULT_LINKS)}</p></section>
</main></body></html>
'''


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = set()
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href', '')
            if href and not href.startswith('#'):
                self.hrefs.add(html.unescape(href))


def body_links(document):
    match = re.search(r'<main\b.*?</main>', document, re.S)
    if not match:
        raise ValueError('Audience source page has no main region')
    found = Links(); found.feed(match.group(0))
    return found.hrefs


def refresh(output, lessons, apps, site_source):
    """Write the five audience pages into an already assembled Education root."""
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    output, source = Path(output)/"education-site", Path(site_source)
    # Inputs are checked, never modified. They make accidental invocation against
    # a missing source checkout fail before any page is replaced.
    if not (Path(lessons)/'resources.json').is_file() or not (Path(apps)/'apps.json').is_file():
        raise FileNotFoundError('Audience refresh needs the real Lessons and Apps source manifests')
    data = json.loads((source/'data/audience-homepages.json').read_text())['audiences']
    pages = load_pages()
    report = {'pages': [], 'parentFAQQuestions': 7, 'contentSource': 'domain-split/audience-pages.json'}
    remapped = {'/games/': PLAY+'/', '/apexkick/': PLAY+'/'}
    for key in KEYS:
        audience = data[key]
        target = output/audience['route'].strip('/')/'index.html'
        original = (source/audience['route'].strip('/')/'index.html').read_text()
        document = make_page(key, pages[key], audience, data)
        result = Links(); result.feed(document)
        # Game links change origin; every other destination the source page's
        # body offered must survive on the rebuilt page.
        missing = {remapped.get(h, h) for h in body_links(original)} - result.hrefs
        # Education names no games: the Play destination moved from the body to the
        # shared footer's one quiet link (added later; check_audience_discovery
        # asserts the footer carries it and nothing above the footer does).
        missing.discard(PLAY + '/')
        if missing:
            raise ValueError(f'Original audience routes would be lost in {target}: {sorted(missing)}')
        if 'ASDAN' in re.sub(r'<[^>]+>', ' ', document):
            raise ValueError(f'Awarding-body name in visible text of {target}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(document)
        report['pages'].append({'route': audience['route'], 'resources': len(pages[key]['resources']),
                                'originalDestinations': len(body_links(original)), 'preserved': True})
    (output/'assets').mkdir(exist_ok=True)
    for name in ('audience-discovery.css', 'audience-discovery.js'):
        shutil.copyfile(HERE/name, output/'assets'/name)
    return report
