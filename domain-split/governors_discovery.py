"""Build the Governors & trustees area from preserved records and checked links.

This publication adapter only writes its new hub, data and assets. Existing
resource files, search indexes and the original external catalogue are untouched.
"""
from html import escape
import json
from pathlib import Path
import shutil
from urllib.parse import urlparse

ROUTE = '/for/governors-trustees/'
HERE = Path(__file__).resolve().parent
GROUPS = [('official', 'Official guidance', 'Start with the guidance for your type of school or trust.'),
          ('sector', 'Induction, training & development', 'Independent sector organisations. Check the access details before booking.'),
          ('made-by-matt', 'Explore Made by Matt', 'Teaching materials to support curriculum conversations and a closer look at inclusion.')]


def read(path):
    return json.loads(Path(path).read_text())


def records(site_source):
    config = read(HERE/'governance-resources.json')
    existing = {r['id']: r for r in read(site_source/'data/education-hub.json')['resources']}
    internal = {r['id']: r for r in read(site_source/'data/mbm-search-index.json')['entries']}
    rows = []
    for spec in config['resources']:
        row = dict(spec)
        reuse = row.pop('reuse', None)
        if reuse:
            if reuse not in existing:
                raise ValueError('Missing preserved governance source: '+reuse)
            row = {**existing[reuse], **row, 'reusedRecordId': reuse}
        source_id = row.pop('internalRecord', None)
        if source_id:
            if source_id not in internal:
                raise ValueError('Missing preserved Made by Matt source: '+source_id)
            source = internal[source_id]
            row = {'id': source_id, 'title': source['title'], 'url': source['route'],
                   'source': 'Made by Matt', **row, 'reusedRecordId': source_id}
        row['lastReviewed'] = config['checkedDate']
        row.setdefault('audience', 'Governors, trustees and governance professionals')
        if isinstance(row['audience'], list):
            row['audience'] = 'Governors, trustees and governance professionals'
        for field in ['id', 'title', 'source', 'origin', 'topic', 'type', 'jurisdiction', 'audience', 'url', 'summary', 'access', 'lastReviewed']:
            if not row.get(field):
                raise ValueError('Missing governance metadata '+field)
        if row['origin'] not in dict((g[0], g[1]) for g in GROUPS):
            raise ValueError('Unknown governance publisher category')
        url = urlparse(row['url'])
        if row['origin'] == 'made-by-matt':
            if not row['url'].startswith('/') or row['url'].startswith('//'):
                raise ValueError('Internal resource must use its preserved site route')
        elif url.scheme != 'https' or not url.netloc:
            raise ValueError('External resource must use a direct HTTPS publisher link')
        rows.append(row)
    if len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Duplicate governance record identity')
    return config, rows


def card(row):
    def e(value):
        return escape(str(value), quote=True)
    search = ' '.join(str(row.get(k, '')) for k in ['title', 'source', 'summary', 'topic', 'type', 'audience', 'jurisdiction', 'access'])
    metadata = [('Publisher', row['source']), ('For', row['audience']), ('Jurisdiction', row['jurisdiction']),
                ('Access', row['access']), ('Checked', row['lastReviewed'])]
    dates = ''
    if row.get('effectiveFrom'):
        dates = '<p class="gv-effective">Effective from '+e(row['effectiveFrom'])
        if row.get('effectiveTo'):
            dates += ' to '+e(row['effectiveTo'])
        dates += '.</p>'
    action = 'Explore this collection' if row['origin'] == 'made-by-matt' else 'Open publisher resource'
    return (f'<article class="gv-card" data-governance-card data-id="{e(row["id"])}" '
            f'data-origin="{e(row["origin"])}" data-topic="{e(row["topic"])}" data-search="{e(search.lower())}">'
            f'<p class="gv-tag">{e(row["type"])}</p><h3>{e(row["title"])}</h3><p>{e(row["summary"])}</p>'+dates+
            '<dl>'+''.join('<div><dt>'+e(k)+'</dt><dd>'+e(v)+'</dd></div>' for k, v in metadata)+'</dl>'
            f'<a class="gv-open" href="{e(row["url"])}">{action}<span class="gv-sr">: {e(row["title"])}</span><span aria-hidden="true"> →</span></a></article>')


def page(rows, checked_date):
    topics = sorted({r['topic'] for r in rows})
    groups = ''.join('<section class="gv-group" data-governance-group aria-labelledby="gv-'+key+'"><div class="gv-section-head">'
                     '<h2 id="gv-'+key+'">'+escape(title)+'</h2><p>'+escape(description)+'</p></div><div class="gv-grid">'+
                     ''.join(card(r) for r in rows if r['origin'] == key)+'</div></section>' for key, title, description in GROUPS)
    learning = ''.join('<a href="'+url+'">'+escape(label)+'</a>' for url, label in [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'), ('/Matt-s-Apps-/', 'Apps & tools'), ('/tools/', 'Teacher tools')])
    return '''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Governors &amp; trustees · Made by Matt</title><meta name="description" content="Official governance guidance, induction and training, with Made by Matt teaching resources for curriculum and inclusion conversations.">
<meta name="theme-color" content="#161d3d"><link rel="canonical" href="https://madebymatt.uk/for/governors-trustees/">
<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/governors-discovery.css">
<script defer src="/assets/governors-discovery.js"></script></head><body class="gv-page">
<a class="gv-skip" href="#main">Skip to content</a><header class="gv-header"><div class="gv-wrap gv-header-inner">
<a class="gv-brand" href="/"><img src="/assets/brand/micro_mark.svg" width="60" height="60" alt=""><span>MADE BY MATT<small>Learn · Build · Explore</small></span></a>
<a class="gv-home" href="/">Education homepage</a></div></header>
<nav class="gv-learning gv-wrap" aria-label="Learning areas">'''+learning+'''</nav>
<main id="main" class="gv-wrap"><section class="gv-hero" aria-labelledby="page-title"><p class="gv-eyebrow">Supporting your school community</p>
<h1 id="page-title">Governors &amp; trustees</h1><p class="gv-lead">Good questions start with a clear picture. Find the guidance for your board, build your confidence in the role and explore what learning can look like.</p>
<div class="gv-actions"><a class="gv-button" href="#governance-resources">Find guidance &amp; training</a><a class="gv-button gv-secondary" href="#gv-made-by-matt">Explore teaching resources</a></div>
<p class="gv-intro-note">The official guidance here is for England. Sector providers may also support Wales; each resource names its jurisdiction. Made by Matt materials are teacher-created resources.</p></section>
<section class="gv-prompts" aria-labelledby="gv-prompts-title"><h2 id="gv-prompts-title">A useful starting point for your next conversation</h2><div class="gv-prompt-grid">
<article><h3>Your role</h3><p>Read the guide for your school type. Ask your governance professional about the board’s responsibilities, delegated decisions and induction plan.</p></article>
<article><h3>Safeguarding</h3><p>Use the current safeguarding guidance to discuss how the board receives assurance, checks training and follows up concerns through the school’s procedures.</p></article>
<article><h3>SEND &amp; inclusion</h3><p>Ask how pupils and families are heard, how barriers to learning are identified and how leaders know that support is helping.</p></article>
<article><h3>Curriculum</h3><p>Look at a sequence of lessons. Ask what pupils build on, how activities are adapted and how teachers check what pupils understand.</p></article>
</div><p class="gv-small">These conversation prompts are Made by Matt’s own suggestions. Use them alongside your board’s agreed role and the linked guidance.</p></section>
<section id="governance-resources" class="gv-finder" aria-labelledby="gv-finder-title"><h2 id="gv-finder-title">Find the support you need</h2>
<form id="gv-search-form" role="search"><div class="gv-search-field"><label for="gv-search">Search governance resources</label><input id="gv-search" type="search" placeholder="Try safeguarding, SEND or induction" autocomplete="off"></div>
<div><label for="gv-origin">Publisher group</label><select id="gv-origin"><option value="">All resources</option value="official">Official guidance</option><option value="sector">Training &amp; sector support</option><option value="made-by-matt">Made by Matt</option></select></div>
<div><label for="gv-topic">Topic</label><select id="gv-topic"><option value="">All topics</option>'''+''.join('<option>'+escape(t)+'</option>' for t in topics)+'''</select></div><button type="reset">Clear filters</button></form>
<p id="gv-result-count" role="status" aria-live="polite">'''+str(len(rows))+''' resources</p><p class="gv-small">Publisher content and booking terms can change. Links and access information checked '''+escape(checked_date)+'''. External links take you to the named publisher.</p>
<noscript><p>All resources are listed below. Search and filters need JavaScript; the links work without it.</p></noscript></section>
<p id="gv-empty" hidden>No matching resources. Try a broader search or clear the filters.</p>'''+groups+'''
<section class="gv-next"><h2>More from Made by Matt</h2><div class="gv-actions"><a href="/education-hub/">Professional Education Hub</a><a href="/for/trusts/">Academy trusts</a><a href="/for/schools-semh/">Schools &amp; specialist settings</a><a href="/for/parents-carers/">Parents &amp; carers</a></div></section>
</main><footer class="gv-footer gv-wrap"><a href="/">Made by Matt Education</a><a href="/resources/">All resources</a><a href="/privacy/">Privacy</a><a href="mailto:contactmadebymatt@gmail.com">Contact Matt</a></footer></body></html>
'''


def refresh(output, lessons, apps, site_source):
    output, site_source = Path(output), Path(site_source)
    config, rows = records(site_source)
    site = output/'education-site'
    target = site/ROUTE.lstrip('/')/'index.html'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(page(rows, config['checkedDate']))
    (site/'assets').mkdir(parents=True, exist_ok=True)
    for name in ['governors-discovery.css', 'governors-discovery.js']:
        shutil.copyfile(HERE/name, site/'assets'/name)
    (site/'data').mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'route': ROUTE, 'checkedDate': config['checkedDate'], 'resources': rows}
    (site/'data/governance-resources.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return report
