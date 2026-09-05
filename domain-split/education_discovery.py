"""Refresh discoverability in the existing education publication only.

Catalogue records come from the current repositories. This adds hub navigation
and search entries; it never copies, rebuilds or changes a teaching download or
an app payload. Games keep their separate, already-published destination.
"""
from html import escape
import json
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

ORIGIN = 'https://madebymatt.uk'
PDF = '/Matt-s-Apps-/PDF_Studio.html'
PDF_DESCRIPTION = ('Create a PDF from a blank page, annotate an existing document, '
                   'edit text, merge files, reorder or rotate pages, and export all or selected pages.')
PDF_KEYWORDS = ['PDF', 'PDF generator', 'PDF Studio', 'merge', 'split', 'extract', 'annotate']
ASDAN = '/Lessons/?subject=ASDAN%20%26%20life%20skills&year=all'
PATHWAYS = ['BUILD', 'GROW', 'LAUNCH']


def read(path):
    return json.loads(path.read_text())


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Discovery source anchor changed: '+before[:100])
    return text.replace(before, after, 1)


def identity(route):
    u = urlparse(urljoin(ORIGIN+'/', route))
    return (u.netloc.lower(), unquote(u.path).removesuffix('index.html').rstrip('/') or '/')


def local_file(output, route):
    u = urlparse(urljoin(ORIGIN+'/', route))
    if u.netloc.lower() not in {'madebymatt.uk', 'www.madebymatt.uk', 'mattroper1977.github.io'}:
        return None
    path = unquote(u.path).lstrip('/')
    root = output/'education-site'
    for prefix, kind in [('Lessons/', 'lessons'), ('Matt-s-Apps-/', 'apps')]:
        if path.startswith(prefix):
            root = output/('education-'+kind); path = path[len(prefix):]; break
    target = (root/path).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError('Catalogue route escapes publication: '+route)
    return target/'index.html' if target.is_dir() else target


def learning_nav(active=''):
    links = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'),
             ('/Matt-s-Apps-/', 'Apps & tools'), ('/tools/', 'Teacher tools')]
    return '<nav class="collection-nav" aria-label="Learning areas"><div class="wrap">'+''.join(
        '<a href="'+url+'"'+(' aria-current="page"' if url==active else '')+'>'+escape(label)+'</a>' for url, label in links)+'</div></nav>'


def pdf_feature():
    return ('<section class="discovery-feature" id="pdf-studio-feature"><div class="wrap">'
            '<p class="eyebrow">Documents &amp; downloads</p><h2>PDF Studio</h2><p>'+PDF_DESCRIPTION+'</p>'
            '<a class="discovery-open" href="'+PDF+'">Open PDF Studio</a></div></section>')


def collections():
    asdan_links = ''.join('<a href="/Lessons/'+p+'_ASDAN/'+p+'_ASDAN_Hub.html">'+p+' ASDAN collection</a>' for p in PATHWAYS)
    return ('<section class="discovery-collections" id="resource-collections"><div class="wrap">'
            '<p class="eyebrow">Start with a collection</p><h2>Resources for every part of teaching.</h2>'
            '<p>Browse learning activities, worksheets, teaching packs and downloads from all years.</p>'
            '<div class="collection-grid"><article class="collection-card" id="asdan-learning">'
            '<h3>ASDAN learning resources</h3><p>Practical learning, life skills and evidence activities. '
            'Browse the existing pathway collections, including older resources.</p>'+asdan_links+
            '<a href="'+escape(ASDAN, quote=True)+'">Find ASDAN resources · all years</a>'
            '<p class="collection-note">For recording evidence and progress, use the separate '
            '<a href="/asdan/">ASDAN Register</a>.</p></article>'
            '<article class="collection-card"><h3>Worksheets, packs &amp; downloads</h3>'
            '<p>Open a subject collection for its existing teaching sheets and downloads.</p>'
            '<a href="/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html">David’s Humanities &amp; RE cover packs</a>'
            '<a href="/Lessons/Science_Teesside/index.html">Science resources &amp; packs</a>'
            '<a href="/resources/?q=worksheet">Find worksheets</a>'
            '<a href="/resources/?type=Support">Browse support packs</a>'
            '<a href="/Lessons/?year=all">Browse lessons from all years</a></article>'
            '<article class="collection-card"><h3>Apps, studios &amp; tools</h3>'
            '<p>Search the complete app collection separately from lessons, or open a specialist teacher tool.</p>'
            '<a href="/Matt-s-Apps-/">Browse and search all apps</a>'
            '<a href="'+PDF+'">PDF Studio · create &amp; edit PDFs</a>'
            '<a href="/tools/">Teacher tools</a>'
            '<a href="https://madebymatt-play.uk/">Games &amp; simulations</a></article></div></div></section>')


def refresh(output, lessons, apps, site_source):
    if apps is None:
        raise ValueError('Complete Apps source is required for resource discovery')
    site = output/'education-site'
    app_root = output/'education-apps'
    catalogue = read(apps/'apps.json')
    extras = []
    for space in catalogue['spaces']:
        for item in space['items']:
            route = urljoin(ORIGIN+'/Matt-s-Apps-/', item['f'])
            if route.startswith(ORIGIN): route = route[len(ORIGIN):]
            extras.append({'title': item['n'], 'description': PDF_DESCRIPTION if identity(route)==identity(PDF) else item.get('d', ''),
                           'subject': 'Apps & tools · '+space['cat'],
                           'type': 'Teacher tool' if space['cat']=='Teacher tools' else 'Pupil resource',
                           'path': route, 'tags': PDF_KEYWORDS if identity(route)==identity(PDF) else [space['cat'], 'app', 'studio'],
                           'status': 'Published'})
    # Retain discovery records from the earlier complete site index as well as
    # today's Lessons and Apps manifests. Keep external source destinations.
    old = read(site/'data/mbm-search-index.json')['entries']
    known = {identity(e['path']) for e in extras}
    for entry in old:
        if entry.get('category') not in {'lesson', 'resource', 'app', 'tool', 'page'} or identity(entry['route']) in known:
            continue
        extras.append({'title': entry['title'], 'description': entry.get('description', ''),
                       'subject': entry.get('subject') or 'Other collections',
                       'type': 'Teacher tool' if entry['category']=='tool' else ('Lesson' if entry['category']=='lesson' else 'Resource'),
                       'path': entry['route'], 'tags': entry.get('keywords', []), 'status': 'Published'})
        known.add(identity(entry['route']))
    # These are links to existing collection pages, never new resource copies.
    for pathway in PATHWAYS:
        route = '/Lessons/'+pathway+'_ASDAN/'+pathway+'_ASDAN_Hub.html'
        if not local_file(output, route).is_file(): raise ValueError('Missing existing ASDAN collection: '+route)
        extras.append({'title': pathway+' ASDAN learning collection', 'description': 'Existing '+pathway+' ASDAN learning activities, worksheets and evidence routines.',
                       'subject': 'ASDAN learning resources', 'type': 'Resource', 'path': route,
                       'tags': ['ASDAN', pathway, 'learning', 'worksheets', 'older resources'], 'status': 'Published'})
    save(site/'data/resource-collections.json', extras)

    resource_path = site/'resources/index.html'
    text = resource_path.read_text()
    text = replace_once(text, '<div class="rx-body">', collections()+'<div class="rx-body">')
    text = replace_once(text, "Promise.all([grab('/Lessons/resources.json'),grab('/data/resources.json')]).then(([les,site])=>{",
                        "Promise.all([grab('/Lessons/resources.json'),grab('/data/resources.json'),grab('/data/resource-collections.json')]).then(([les,site,collections])=>{")
    before = "ALL=[...normLessons(Array.isArray(les)?les:[]),...normSite(Array.isArray(site)?site:[])];"
    after = before+"\n"+"""const routeKey=path=>{try{const u=new URL(path,location.origin);return u.origin+decodeURI(u.pathname).replace(/index\\.html$/,'').replace(/\\/$/,'')}catch(_){return path}};
const byRoute=new Map(ALL.filter(r=>r.path).map(r=>[routeKey(r.path),r]));
for(const row of normSite(Array.isArray(collections)?collections:[])){const key=routeKey(row.path);const existing=byRoute.get(key);if(existing){existing.tags=[...new Set([...existing.tags,...row.tags,row.title])]}else{ALL.push(row);byRoute.set(key,row)}}"""
    text = replace_once(text, before, after)
    text = replace_once(text, 'const q=$("#rxSearch").value.toLowerCase();',
                        'const q=$("#rxSearch").value.toLowerCase().trim();\n$("#resource-collections").hidden=!!(q||SUB||TYPE);')
    text = replace_once(text, "[r.title,r.description,r.subject,r.type,...(r.tags||[])].join(' ').toLowerCase().includes(q)",
                        "q.trim().split(/\\s+/).every(word=>[r.title,r.description,r.subject,r.type,...(r.tags||[])].join(' ').toLowerCase().includes(word))")
    text = text.replace('Search science, humanities, evidence…', 'Try ASDAN, worksheet, PDF generator…')
    text = replace_once(text, '<a href="/Lessons/">Open the lesson finder</a>',
                        '<a href="/Lessons/">Open the lesson finder</a><a href="#resource-collections">Browse collections</a><a href="'+PDF+'">PDF Studio</a>')
    text = replace_once(text, 'function stickTop(){',
                        'document.querySelector(\'a[href="#resource-collections"]\').addEventListener("click",()=>{$("#rxSearch").value="";SUB="";TYPE="";chips();render()});\nfunction stickTop(){')
    resource_path.write_text(text)

    app_path = app_root/'index.html'
    text = app_path.read_text()
    text = replace_once(text, 'class="mbm-hub mbm-hub-apps"', 'class="mbm-hub mbm-hub-apps mbm-education-hub"')
    text = replace_once(text, '<h1>THE CREATOR <span>HUB</span></h1>', '<h1>Apps <span>&amp; tools</span></h1>')
    text = replace_once(text, 'A Made by Matt collection</p>', 'The Creator Hub · A Made by Matt collection</p>')
    text = replace_once(text, '<section class="trio"', pdf_feature()+'<section class="trio"')
    text = replace_once(text, '[it.n,it.d].join(" ").toLowerCase().includes(Q)',
                        'Q.split(/\\s+/).every(word=>[it.n,it.d,...(it.n==="PDF Studio"?'+json.dumps(PDF_KEYWORDS)+':[])].join(" ").toLowerCase().includes(word))')
    text = replace_once(text, 'DATA=d;chips();render();', 'DATA=d;Q=(new URLSearchParams(location.search).get("q")||"").toLowerCase().trim();$("#search").value=Q;chips();render();')
    text = replace_once(text, '</head>', '<link rel="stylesheet" href="/assets/education-navigation.css"></head>')
    text = text.replace('Try: poster, quiz, stop-motion…', 'Try PDF generator, poster, quiz…')
    # Keep the useful promotional collections, with the finder before them.
    start = text.index('<section class="trio"')
    end = text.index('<div class="segrow rail"', start)
    promotions = text[start:end]
    text = text[:start]+text[end:]
    text = replace_once(text, '<div id="groups"></div>', '<div id="groups"></div>'+promotions)
    start = text.index('<div class="toolbar"')
    end = text.index('</div>', start)+len('</div>')
    finder = text[start:end]
    text = text[:start]+text[end:]
    text = replace_once(text, '<section class="discovery-feature" id="pdf-studio-feature">',
                        finder+'<section class="discovery-feature" id="pdf-studio-feature">')
    text = replace_once(text, 'const spaces=DATA.spaces.map',
                        '$("#pdf-studio-feature").hidden=!!(Q||CAT||AUD);\nconst spaces=DATA.spaces.map')
    app_path.write_text(text)

    tools_path = site/'tools/index.html'
    text = tools_path.read_text()
    card = ('<article class="tcard" data-cat="util" data-s="pdf pdf generator pdf studio annotate create merge split extract rotate pages">'
            '<span class="ci" aria-hidden="true">📄</span><h3>PDF Studio</h3><p>'+PDF_DESCRIPTION+'</p>'
            '<a class="go" href="'+PDF+'">OPEN PDF STUDIO →</a></article>')
    text = replace_once(text, '<div class="tgrid" data-sec="util">', '<div class="tgrid" data-sec="util">'+card)
    for pathway in PATHWAYS:
        card = ('<article class="tcard" data-cat="browse" data-s="asdan '+pathway.lower()+' learning resources worksheets packs collection">'
                '<h3>'+pathway+' ASDAN learning resources</h3><p>Open the existing lesson collection and teaching resources.</p>'
                '<a class="go" href="/Lessons/'+pathway+'_ASDAN/'+pathway+'_ASDAN_Hub.html">OPEN LEARNING COLLECTION →</a></article>')
        text = replace_once(text, '<div class="tgrid" data-sec="browse">', '<div class="tgrid" data-sec="browse">'+card)
    text = replace_once(text, '<a href="#drawer">Find a tool</a>', '<a href="#drawer">Find a tool</a><a href="'+PDF+'">PDF Studio</a><a href="/Matt-s-Apps-/">All apps &amp; studios</a>')
    text = text.replace('href="../asdan/app.html"', 'href="/asdan/"')
    tools_path.write_text(text)

    for path in [site/'index.html', site/'main/index.html', site/'for/teachers/index.html', resource_path, tools_path, app_path]:
        text = path.read_text()
        active = {resource_path: '/resources/', tools_path: '/tools/', app_path: '/Matt-s-Apps-/'}.get(path, '')
        text = replace_once(text, '</header>', '</header>'+learning_nav(active))
        if path in {site/'index.html', site/'main/index.html'}:
            text = replace_once(text, '<a href="/tools/">Classroom tools</a>',
                                '<a href="/tools/">Classroom tools</a><a href="'+escape(ASDAN, quote=True)+'">ASDAN · all years</a>')
        path.write_text(text)

    # Keep teacher search in step with the same existing destinations. Pupil
    # eligibility and its reviewed catalogue are deliberately not broadened.
    domain_path = site/'data/domain-catalogue.json'
    domain = read(domain_path)
    education = domain['education']
    by_route = {identity(e['route']): e for e in education}
    for row in extras:
        key = identity(row['path'])
        if key in by_route:
            entry = by_route[key]
            entry['keywords'] = list(dict.fromkeys(entry.get('keywords', [])+row['tags']))
            if key==identity(PDF): entry['description']=PDF_DESCRIPTION
        else:
            entry = {'title': row['title'], 'description': row['description'], 'route': row['path'],
                     'subject': row['subject'], 'category': 'resource', 'keywords': row['tags'], 'pathways': []}
            education.append(entry); by_route[key]=entry
    save(domain_path, domain)
    save(site/'data/resource-discovery.json', {'version': 1, 'apps': sum(len(s['items']) for s in catalogue['spaces']),
         'source_lesson_records': len(read(lessons/'resources.json')), 'supplemental_discovery_records': len(extras),
         'asdan_collections': PATHWAYS, 'pdf_studio': PDF, 'asdan_all_years': ASDAN,
         'resource_payloads_rebuilt': 0})
