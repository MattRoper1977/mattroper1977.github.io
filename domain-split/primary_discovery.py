"""Add Primary discovery to publication output without rebuilding teaching files."""
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit

HERE = Path(__file__).resolve().parent
HUB = '/Lessons/primary/'
ASSETS = '/Lessons/assets/catalogue/'
SCRIPT = '<script defer src="'+ASSETS+'primary-discovery.js"></script>'
CORE_SCRIPT = '<script defer src="'+ASSETS+'lesson-navigation.js"></script>'
CORE_HUB_ANCHOR = "ROOT+'Humanities_Teesside/']);"
CORE_PRIMARY_HUBS = "ROOT+'Humanities_Teesside/',ROOT+'primary/index.html',ROOT+'primary/']);"


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')


def fingerprint(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': sha256(data).hexdigest()}


class Labels(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.values = {}
        self.capture = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = tag if tag in {'h1', 'title'} else ('eyebrow' if 'eyebrow' in attrs.get('class', '').split() else None)
        if key:
            self.capture = (tag, key)
            self.values.setdefault(key, '')

    def handle_data(self, text):
        if self.capture:
            self.values[self.capture[1]] += text

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            self.capture = None


class DocumentEnd(HTMLParser):
    """Locate real document tags; script print-template strings are raw text."""
    def __init__(self, text):
        super().__init__()
        self.offsets = [0]+[match.end() for match in re.finditer('\n', text)]
        self.body_ends = []
        self.scripts = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.scripts.append(dict(attrs).get('src'))

    def handle_endtag(self, tag):
        if tag == 'body':
            line, column = self.getpos()
            self.body_ends.append(self.offsets[line-1]+column)


def inventory(lessons):
    rows = [row for row in read(lessons/'resources.json') if row.get('file', '').startswith('primary/')]
    by_file = {row['file']: row for row in rows}
    if len(by_file) != len(rows):
        raise ValueError('Duplicate Primary catalogue paths')
    units = []
    for scheme in sorted((lessons/'primary').rglob('index.html')):
        relative = scheme.relative_to(lessons).as_posix()
        if relative == 'primary/index.html':
            continue
        match = re.fullmatch(r'primary/year(\d+)/([^/]+)/([^/]+)/([^/]+)/index.html', relative)
        if not match:
            raise ValueError('Unclassified Primary scheme: '+relative)
        year, subject, term, slug = match.groups()
        labels = Labels(scheme.read_text()).values
        scheme_row = by_file.get(relative)
        if not scheme_row:
            raise ValueError('Primary scheme is missing from the source catalogue: '+relative)
        block = re.search(r'(Autumn|Spring|Summer)\s+\d+(?:\.\d+)?', labels.get('eyebrow', ''))
        if not block:
            raise ValueError('Primary block lacks its authored term label: '+relative)
        word_files = sorted(scheme.parent.glob('*.docx'))
        if len(word_files) != 1:
            raise ValueError('Expected the existing Word scheme for '+relative)
        word = word_files[0]
        unit = {'id': 'year'+year+'-'+slug, 'classification': 'Primary', 'year_group': int(year),
                'subject': subject.title(), 'term': term.title(), 'block': block.group(),
                'academic_year': scheme_row['year'], 'title': labels['h1'].strip(),
                'description': scheme_row.get('desc', ''), 'scheme': '/Lessons/'+relative,
                'download': {'route': '/Lessons/'+word.relative_to(lessons).as_posix(), **fingerprint(word)},
                'tiers': ['Seedling', 'Sapling', 'Oak'], 'lessons': []}
        pages = sorted(scheme.parent.glob('Lesson*.html'), key=lambda p: int(re.search(r'Lesson(\d+)', p.name)[1]))
        for page in pages:
            file = page.relative_to(lessons).as_posix()
            row = by_file.get(file)
            if not row or row.get('type') != 'lesson' or row['year'] != unit['academic_year']:
                raise ValueError('Primary lesson has no consistent source classification: '+file)
            number = int(re.search(r'Lesson(\d+)', page.name)[1])
            title = re.sub(r'^.*?\s[·•]\s*L\d+\s+', '', row['title'])
            unit['lessons'].append({'type': 'lesson', 'source_ids': [row['id']], 'sequence': number, 'title': title, 'route': '/Lessons/'+file,
                                    'description': row.get('desc', ''), 'keywords': row.get('keywords', [])})
        if [row['sequence'] for row in unit['lessons']] != list(range(1, len(pages)+1)):
            raise ValueError('Primary lesson sequence is incomplete: '+relative)
        units.append(unit)
    units.sort(key=lambda unit: (unit['year_group'], unit['subject'], unit['block'], unit['title']))
    expected = {'/Lessons/'+row['file'] for row in rows}
    actual = {unit['scheme'] for unit in units} | {row['route'] for unit in units for row in unit['lessons']}
    if not units or expected != actual:
        raise ValueError('Primary discovery does not cover the complete source catalogue')
    return {'version': 1, 'classification': 'Primary', 'hub': HUB,
            'academic_years': sorted({unit['academic_year'] for unit in units}),
            'counts': {'units': len(units), 'lessons': sum(len(unit['lessons']) for unit in units), 'word_downloads': len(units)},
            'units': units}


def options(values, label):
    return '<option value="">'+escape(label)+'</option>'+''.join(
        '<option value="'+escape(str(value), quote=True)+'">'+escape(str(title))+'</option>' for value, title in values)


def render(catalogue):
    units = catalogue['units']
    counts = catalogue['counts']
    cards = []
    for unit in units:
        lessons = ''.join('<li data-primary-lesson="'+escape(row['route'], quote=True)+'"><a class="primary-lesson" href="'+
            escape(row['route'], quote=True)+'"><span class="primary-sequence" aria-hidden="true">'+str(row['sequence'])+
            '</span><span class="primary-lesson-title">'+escape(row['title'])+'</span></a></li>' for row in unit['lessons'])
        cards.append('<section class="primary-unit" data-unit="'+unit['id']+'" id="'+unit['id']+'">'
            '<header class="primary-unit-head"><p class="primary-kicker">Year '+str(unit['year_group'])+' · '+escape(unit['subject'])+' · '+
            escape(unit['block'])+'</p><h2>'+escape(unit['title'])+'</h2><p class="primary-enquiry">'+str(len(unit['lessons']))+
            ' lessons · Scheme of work &amp; lesson plans</p></header><div class="primary-unit-actions">'
            '<a class="primary-scheme" href="'+escape(unit['scheme'], quote=True)+'">Open scheme &amp; plans</a>'
            '<a class="primary-download" href="'+escape(unit['download']['route'], quote=True)+'" download>Download Word plans</a></div>'
            '<ol class="primary-lessons">'+lessons+'</ol></section>')
    year_options = options([(year, 'Year '+str(year)) for year in sorted({unit['year_group'] for unit in units})], 'All year groups')
    subject_options = options([(name, name) for name in sorted({unit['subject'] for unit in units})], 'All subjects')
    term_options = options([(name, name+' term') for name in ['Autumn', 'Spring', 'Summer'] if any(u['term']==name for u in units)], 'All terms')
    unit_options = options([(unit['id'], 'Year '+str(unit['year_group'])+' · '+unit['title']) for unit in units], 'All units')
    data = json.dumps(catalogue, ensure_ascii=False).replace('<', '\\u003c').replace('&', '\\u0026')
    year_text = ', '.join(catalogue['academic_years']).replace('-', '–')
    return '''<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Primary Science · Years 4–6 · Made by Matt</title><meta name="description" content="Find existing Primary Science lessons, schemes of work and Word lesson plans by year group and unit.">
<link rel="stylesheet" href="'''+ASSETS+'''primary-discovery.css"></head><body class="primary-hub">
<a class="primary-skip" href="#primary-search">Skip to Primary search</a>
<header class="primary-header"><div class="primary-shell"><a class="primary-brand" href="/"><img src="/assets/brand/micro_mark.svg" width="42" height="42" alt="">Made by Matt</a>
<nav aria-label="Learning areas"><a data-primary-global="/Lessons/" href="/Lessons/">Lessons</a><a href="/resources/">Resources</a><a href="/Matt-s-Apps-/">Apps &amp; tools</a><a href="/tools/">Teacher tools</a></nav></div></header>
<main class="primary-main primary-shell"><div class="primary-intro"><p class="primary-kicker">Primary · '''+escape(year_text)+'''</p>
<h1>Primary Science</h1><p>Years 4–6 · Lessons, schemes of work and Word plans.</p></div>
<form id="primary-filters" class="primary-filters" role="search" aria-label="Find Primary teaching resources">
<label class="primary-search" for="primary-search">Search Primary<input id="primary-search" name="q" type="search" placeholder="Try Year 5 forces or classification…" autocomplete="off"></label>
<div class="primary-selects"><label>Year group<select id="primary-year" name="year_group">'''+year_options+'''</select></label>
<label>Subject<select id="primary-subject" name="subject">'''+subject_options+'''</select></label>
<label>Term<select id="primary-term" name="term">'''+term_options+'''</select></label>
<label>Unit<select id="primary-unit" name="unit">'''+unit_options+'''</select></label></div>
<div class="primary-actions"><output id="primary-count" aria-live="polite">'''+str(counts['units'])+' units · '+str(counts['lessons'])+' lessons · '+str(counts['word_downloads'])+''' Word downloads</output><button id="primary-clear" type="button">Clear filters</button></div></form>
<p class="primary-empty" id="primary-empty" hidden>No matching Primary resources. Try fewer words or clear the filters.</p>
<div class="primary-results">'''+''.join(cards)+'''</div>
<footer class="primary-footer"><p class="primary-tiers"><strong>Primary support:</strong> Seedling, Sapling and Oak are the existing lesson tiers. BUILD, GROW and LAUNCH remain separate learning pathways.</p>
<p>Available now: Year 4–6 Science, Autumn 1.1 and 1.2. Spring, Summer, other subjects and further year groups are not yet included.</p>
<p>Renewable energy is an existing sustainability unit. These six units are a teaching collection, not a complete Primary curriculum.</p></footer></main>
<script id="primary-data" type="application/json">'''+data+'</script>'+CORE_SCRIPT+SCRIPT+'</body></html>\n'


def identity(route):
    value = urlsplit(urljoin('https://madebymatt.uk/', route))
    return value.netloc.lower(), unquote(value.path).removesuffix('index.html').rstrip('/') or '/'


def refresh(output, lessons, apps, site_source):
    """Run after education_discovery.refresh; only published navigation/feeds change."""
    output, lessons = Path(output), Path(lessons)
    target, site = output/'education-lessons', output/'education-site'
    catalogue = inventory(lessons)
    core_path = target/'assets/catalogue/lesson-navigation.js'
    source_core = lessons/'assets/catalogue/lesson-navigation.js'
    core_before = core_path.read_text()
    if core_before != source_core.read_text() or core_before.count(CORE_HUB_ANCHOR) != 1:
        raise ValueError('The published lesson adapter is not the expected source navigation asset')
    core_path.write_text(core_before.replace(CORE_HUB_ANCHOR, CORE_PRIMARY_HUBS, 1))
    source_files = sorted(p for p in (lessons/'primary').rglob('*') if p.is_file())
    source_manifest = [{'route': '/Lessons/'+p.relative_to(lessons).as_posix(), **fingerprint(p)} for p in source_files]
    navigation_pages = []
    for source in source_files:
        relative = source.relative_to(lessons)
        published = target/relative
        if not published.is_file():
            raise ValueError('Primary source file is absent from publication: '+str(relative))
        if source.suffix != '.html':
            if source.read_bytes() != published.read_bytes():
                raise ValueError('Published Primary download differs from source: '+str(relative))
        elif relative.as_posix() != 'primary/index.html':
            before = published.read_text()
            document = DocumentEnd(before)
            if (document.scripts.count(ASSETS+'lesson-navigation.js') != 1 or
                    ASSETS+'primary-discovery.js' in document.scripts or len(document.body_ends) != 1):
                raise ValueError('Ambiguous Primary navigation injection: '+str(relative))
            position = document.body_ends[0]
            after = before[:position]+SCRIPT+before[position:]
            if after[:position]+after[position+len(SCRIPT):] != before:
                raise ValueError('Primary navigation altered a teaching payload: '+str(relative))
            published.write_text(after)
            navigation_pages.append('/Lessons/'+relative.as_posix())
    (target/'primary/index.html').write_text(render(catalogue))
    save(target/'primary/catalogue.json', catalogue)
    for name in ['primary-discovery.css', 'primary-discovery.js']:
        path = target/'assets/catalogue'/name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes((HERE/name).read_bytes())

    # Search additions point to the existing hub/downloads. Original teaching
    # records and the pupil eligibility catalogue remain intact.
    rows = [{'title': 'Primary Science · Years 4–6', 'description': 'Browse Primary Science by year group, term and unit, with lesson sequences and Word plans.',
             'subject': 'Primary', 'type': 'Resource', 'path': HUB, 'tags': ['primary', 'science', 'year 4', 'year 5', 'year 6', 'schemes of work', 'lesson plans'], 'status': 'Published'}]
    metadata = {}
    for unit in catalogue['units']:
        fields = {'education_stage': 'Primary', 'year_group': unit['year_group'], 'term': unit['term'], 'block': unit['block'], 'unit': unit['title']}
        for route in [unit['scheme'], unit['download']['route']]+[row['route'] for row in unit['lessons']]:
            metadata[identity(route)] = fields
        rows.append({'title': 'Year '+str(unit['year_group'])+' '+unit['title']+' · Word scheme & lesson plans',
                     'description': unit['description'], 'subject': 'Primary Science', 'type': 'Support',
                     'path': unit['download']['route'], 'tags': ['primary', 'science', 'year '+str(unit['year_group']), unit['term'], unit['title'], 'Word', 'docx', 'scheme of work', 'lesson plans', 'download'], 'status': 'Published'})
    extras_path = site/'data/resource-collections.json'
    extras = read(extras_path)
    known = {identity(row['path']) for row in extras}
    for row in rows:
        if identity(row['path']) not in known:
            extras.append(row)
            known.add(identity(row['path']))
    save(extras_path, extras)
    discovery = read(site/'data/resource-discovery.json')
    discovery['supplemental_discovery_records'] = len(extras)
    save(site/'data/resource-discovery.json', discovery)
    domain = read(site/'data/domain-catalogue.json')
    known = {identity(row['route']) for row in domain['education']}
    for row in rows:
        if identity(row['path']) not in known:
            domain['education'].append({'title': row['title'], 'description': row['description'], 'route': row['path'], 'subject': row['subject'], 'category': 'resource', 'keywords': row['tags'], 'pathways': [], 'education_stage': 'Primary'})
            known.add(identity(row['path']))
    for row in domain['education']:
        if identity(row['route']) in metadata:
            row.update(metadata[identity(row['route'])])
    save(site/'data/domain-catalogue.json', domain)
    save(site/'data/primary-discovery.json', {'version': 1, 'hub': HUB, 'classification': 'Primary',
         'counts': catalogue['counts'], 'academic_years': catalogue['academic_years'],
         'resource_payloads_rebuilt': 0, 'navigation_only_pages': navigation_pages, 'source_files': source_manifest,
         'published_navigation_asset': {'route': ASSETS+'lesson-navigation.js',
             'added_hubs': [HUB+'index.html', HUB], 'source': fingerprint(source_core), 'published': fingerprint(core_path)}})
    return catalogue
