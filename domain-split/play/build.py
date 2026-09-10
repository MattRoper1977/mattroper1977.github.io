"""Enhance only the generated Play shelf, consuming its existing catalogue.

Run after the existing publication builder. The shared release coordinator can
call refresh(output) before refresh_play_usage, using the supplied tiny patch.

UX2 C2 (2026-09-08): the shelf is rendered here as ONE DOM — a server-side
"All games" grid holding every catalogue game exactly once (series editions
collapsed to one card whose Play anchors for the other editions are still in
the markup), a static Featured card, the classroom rows, and a slim inline
dataset that play.js uses to add the lanes, the chips' filtering, the Filters
drawer and the game sheet. Every number on the page is derived here or in
play.js; nothing is typed into the template.
"""
from __future__ import annotations
import argparse
from collections import Counter, OrderedDict
import hashlib
import html
import json
from pathlib import Path
import shutil
from urllib.parse import unquote, urlparse, quote
if __package__:
    from .source_revisions import registry, validate_report
else:
    from source_revisions import registry, validate_report

HERE = Path(__file__).resolve().parent
ALIASES = ('index.html', 'games/index.html', 'main/index.html', 'for/pupils/index.html', 'Games/index.html', 'Lessons/index.html')
ORIGIN = 'https://www.madebymatt-play.uk'
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
esc = lambda s: html.escape(str(s), quote=True)

def key(route):
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'

def read(name, fallback):
    p = HERE / name
    return json.loads(p.read_text()) if p.exists() else fallback

def date_label(iso):
    """2026-09-08 -> '8 Sep 2026'. Derived by code, never typed."""
    y, m, d = (int(x) for x in iso.split('-'))
    return f'{d} {MONTHS[m - 1]} {y}'

def shown_title(row):
    return row.get('displayTitle') or row['title']

def play_link(row, small=False):
    return ('<a class="play' + (' small' if small else '') + '" data-play="' + esc(row['id']) + '" href="' + esc(row['route']) + '">Play<span class="sr-only"> ' + esc(shown_title(row)) + '</span></a>')

def keyboard_chip(row):
    # Verified controls that do not include touch: play.js reveals this on a
    # coarse-pointer device. Unverified rows get nothing on the card.
    if row['controls'] and 'touch' not in row['controls']:
        return '<span class="chip warn" data-needs-keyboard hidden>Needs a keyboard</span>'
    return ''

def card(row, members, by_id):
    """One grid card. `members` are every edition (ids) when the row leads a
    series, else just the row; the card's Play anchor is the lead's and the
    other CATALOGUE editions' Play anchors are in the markup for no-JS use."""
    media = row.get('media', {})
    image = row.get('image', '')
    title = row['series'] if row.get('series') else shown_title(row)
    editions = [by_id[i] for i in members if i != row['id']]
    catalogue_editions = [e for e in editions if e['group'] == 'games']
    picture = ('<span class="thumb"><img src="' + esc(image) + '" alt="" loading="lazy" width="640" height="360"></span>') if image else '<span class="thumb thumb-empty" aria-hidden="true"></span>'
    chips = '<span class="chip">' + esc(row['genre']) + '</span>'
    if len(members) > 1:
        chips += '<span class="chip">' + str(len(members)) + ' editions</span>'
    chips += keyboard_chip(row)
    watch = '<button type="button" class="watch-pill" data-watch="' + esc(row['id']) + '" hidden>Watch gameplay</button>' if media.get('video') else ''
    more = ''
    if catalogue_editions:
        more = '<ul class="card-editions" data-editions>' + ''.join('<li>' + play_link(e, small=True) + '<span class="edition-name">' + esc(shown_title(e)) + '</span></li>' for e in catalogue_editions) + '</ul>'
    return ('<article class="game-card" data-card="' + esc(row['id']) + '" data-games="' + esc(' '.join(i for i in members if by_id[i]['group'] == 'games')) + '">'
            '<button type="button" class="card-open" data-info="' + esc(row['id']) + '" aria-haspopup="dialog">' + picture + '<span class="card-title">' + esc(title) + '</span></button>'
            + watch + '<div class="card-meta">' + chips + '</div>' + play_link(row) + more + '</article>')

def feature(row):
    media = row.get('media', {})
    image = media.get('poster') or row.get('image', '')
    watch = '<button type="button" class="button" data-watch="' + esc(row['id']) + '" hidden>Watch gameplay</button>' if media.get('video') else ''
    picture = ('<span class="thumb"><img src="' + esc(image) + '" alt="" fetchpriority="high" width="640" height="360"></span>') if image else ''
    return ('<section class="featured" aria-labelledby="featured-title"><h2 id="featured-title">Featured</h2>'
            '<article class="feature-card" data-feature="' + esc(row['id']) + '">'
            '<button type="button" class="card-open" data-info="' + esc(row['id']) + '" aria-haspopup="dialog">' + picture + '<span class="card-title">' + esc(shown_title(row)) + '</span></button>'
            '<div class="feature-body"><div class="card-meta"><span class="chip">' + esc(row['genre']) + '</span>' + keyboard_chip(row) + '</div><p>' + esc(row['description']) + '</p>'
            '<div class="card-actions">' + play_link(row) + watch + '</div></div></article></section>')

def classroom(rows):
    items = ''.join('<li class="class-row" data-row="' + esc(r['id']) + '"><span class="row-label">' + ('Staff' if r['group'] == 'staff' else 'Classroom') + '</span>'
                    '<button type="button" class="row-open" data-info="' + esc(r['id']) + '" aria-haspopup="dialog">' + esc(shown_title(r)) + '</button>' + play_link(r, small=True) + '</li>' for r in rows)
    return ('<section id="classroom" aria-labelledby="classroom-title"><h2 id="classroom-title">For your classroom</h2>'
            '<p class="muted">Whole-class quizzes and a staff training activity. Not part of the games catalogue.</p><ul class="class-rows">' + items + '</ul></section>')

def slim(row):
    """The inline dataset play.js reads: what the lanes, filters and sheet need, nothing else."""
    out = OrderedDict()
    for k in ('id', 'title', 'displayTitle', 'description', 'route', 'image', 'genre', 'group', 'controls', 'modes', 'series', 'editions', 'featured', 'chapter'):
        if k in row and row[k] not in (None, '', [], False):
            out[k] = row[k]
    m = row.get('media') or {}
    if m:
        out['media'] = {k: m[k] for k in ('video', 'poster', 'duration_seconds', 'description') if k in m}
    if row.get('updated'):
        out['updated'] = {'date': row['updated']['date'], 'label': date_label(row['updated']['date']), 'description': row['updated']['description']}
    return out

def refresh(output, review=False, source_revisions=None):
    target = Path(output) / 'games'
    original = (target/'data/domain-catalogue.json').read_bytes()
    catalogue = json.loads(original)
    evidence = read('evidence.json', {'games':{}}).get('games', {})
    approved_revisions = registry()
    if source_revisions is None:
        site = HERE.parents[1]
        lessons = site/'.sources/Lessons' if (site/'.sources/Lessons').is_dir() else site.parent/'Lessons'
        source_revisions = validate_report(json.loads((Path(output)/'build-report.json').read_text()), output, {'Site':site,'Lessons':lessons})
    media = read('media/manifest.json', {'clips':[]})
    # A route may carry more than one accepted capture when its payload has been revised: each
    # clip binds to the exact bytes it was recorded from (published_sha256), and the clip whose
    # hash equals the payload actually built is the one this build may show. A build whose
    # payload matches none of a route's clips is still refused below (recapture/review required).
    clips_by_route = {}
    for x in media.get('clips', []):
        if x.get('status') == 'accepted': clips_by_route.setdefault(key(x['route']), []).append(x)
    rows = []
    labels = {'games':'Catalogue game','activities':'Classroom activity','staff':'Staff activity'}
    for group in labels:
        for entry in catalogue[group]:
            path = urlparse(entry['route']).path
            if not path.startswith('/') or path.startswith('//'):
                raise ValueError('Unexpected game route: '+entry['route'])
            extra = evidence.get(key(path), {})
            source = extra.get('source', {})
            # Bind source-inspected labels to the exact copied payload, including
            # the existing builder's documented literal host replacements.
            payload = target / unquote(path).lstrip('/')
            if path.endswith('/'): payload /= 'index.html'
            output_path = str(payload.relative_to(target))
            expected_hash = source.get('published_sha256')
            if output_path in approved_revisions:
                revision = source_revisions.get(output_path)
                if not revision: raise ValueError('Missing reviewed source context: '+entry['title'])
                fields = ('id','reviewed_commit','git_blob','source_sha256','published_sha256')
                if sum(all(r[field] == revision.get(field) for field in fields) for r in approved_revisions[output_path]['revisions']) != 1:
                    raise ValueError('Unreviewed source context: '+entry['title'])
                expected_hash = revision['published_sha256']
            if source and hashlib.sha256(payload.read_bytes()).hexdigest() != expected_hash:
                raise ValueError('Review stale control/content evidence: '+entry['title'])
            row = {**entry, 'description':extra.get('description') or entry['description'], 'route':quote(unquote(path),safe='/()'), 'group':group, 'groupLabel':('Catalogue classroom game' if group=='games' and extra.get('audience')=='classroom' else labels[group]),
                   'genre':extra.get('genre') or entry.get('subject') or 'Other',
                   'controls':extra.get('controls', []), 'modes':extra.get('modes', []),
                   'instructions':extra.get('instructions', 'Open the game and follow its own instructions. Controls and device support have not yet been independently verified.'),
                   'evidence':[{'scope':'source-inspected'}] if extra.get('evidence') else [], 'updated':extra.get('updated'),
                   'featured': entry.get('featured') is True, 'media':{}}
            candidates = clips_by_route.get(key(path), [])
            if candidates:
                built = hashlib.sha256(payload.read_bytes()).hexdigest()
                row['media'] = next((c for c in candidates if c['published_sha256'] == built), candidates[-1])
            rows.append(row)
    assert len(rows) == len({key(r['route']) for r in rows}) == 69
    assert len({r['id'] for r in rows}) == len(rows)
    counts = {g:len(catalogue[g]) for g in labels}
    assert counts == {'games':62,'activities':6,'staff':1}, counts
    # Media must be genuinely captured from exactly the output being reviewed.
    for row in rows:
        m = row['media']
        if not m: continue
        path = target / unquote(row['route']).lstrip('/')
        if row['route'].endswith('/'): path /= 'index.html'
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != m['published_sha256']:
            raise ValueError('Recapture/review required for changed game: '+row['title'])

    # --- Presentation layer -------------------------------------------------
    # displayTitle/series arrive on catalogue rows from the canonical shelf
    # (games.json via build_preview). Activities have no games.json row, so
    # their presentation metadata — and the one series join the shelf cannot
    # carry — comes from the reviewed activity-metadata.json beside this file.
    by_key = {key(r['route']): r for r in rows}
    overlay = read('activity-metadata.json', {'routes': {}})['routes']
    for route, extra in overlay.items():
        row = by_key.get(key(route))
        if row is None: raise ValueError('activity-metadata.json names a route that is not published: ' + route)
        for k in ('displayTitle', 'series'):
            if k in extra:
                if not isinstance(extra[k], str) or not extra[k].strip(): raise ValueError('activity-metadata.json ' + k + ' must be a non-empty string: ' + route)
                if k in row and row[k] != extra[k]: raise ValueError('activity-metadata.json contradicts the shelf for ' + k + ': ' + route)
                row[k] = extra[k]
    for row in rows:
        if row.get('displayTitle') == row['title']: raise ValueError('displayTitle repeats title: ' + row['title'])
    # Series: every named series must have at least two editions across the
    # 69 routes; the LEAD (the card the grid shows) is the first catalogue
    # member in shelf order; every member lists every edition in order.
    series = OrderedDict()
    for row in rows:
        if row.get('series'): series.setdefault(row['series'], []).append(row['id'])
    for name, ids in series.items():
        if len(ids) < 2: raise ValueError('series of one: ' + name)
        for i in ids: by_id_row = next(r for r in rows if r['id'] == i); by_id_row['editions'] = list(ids)
    chapters = read('chapters.json', {})
    for route, chapter in chapters.items():
        row = by_key.get(key(route))
        if row is None or row['group'] != 'games': raise ValueError('chapters.json names a route that is not a catalogue game: ' + route)
        if not isinstance(chapter, str) or not chapter.strip(): raise ValueError('chapters.json chapter must be a non-empty string: ' + route)
        row['chapter'] = chapter

    assets = target/'assets/play'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ['play.css','play.js']:
        shutil.copyfile(HERE/name, assets/name)
    for clip in [r['media'] for r in rows if r['media']]:
        for field in ['video','poster']:
            name = Path(clip[field]).name
            assert clip[field] == '/assets/play/media/'+name
            source = HERE/'media'/name
            assert source.suffix in {'.mp4','.webm','.webp','.jpg','.png'}
            expected=clip[field+'_sha256']
            assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
            (assets/'media').mkdir(exist_ok=True)
            shutil.copyfile(source,assets/'media'/name)
    (target/'data/play-discovery.json').write_text(json.dumps({'counts':counts,'games':rows},ensure_ascii=False))

    # --- Render -------------------------------------------------------------
    by_id = {r['id']: r for r in rows}
    games = [r for r in rows if r['group'] == 'games']
    activities = [r for r in rows if r['group'] != 'games']
    genre_counts = Counter(r['genre'] for r in games)
    genres = sorted(genre_counts, key=lambda g: (-genre_counts[g], g))
    chips = ('<button type="button" class="chip-button" data-chip="all" aria-pressed="true">All</button>'
             + ''.join('<button type="button" class="chip-button" data-chip="genre" data-genre="' + esc(g) + '" aria-pressed="false">' + esc(g) + '</button>' for g in genres)
             + '<button type="button" class="chip-button" data-chip="favourites" aria-pressed="false">Favourites</button>')
    # Featured: the canonical shelf's featured flag, first true row in shelf
    # order. (The education Arcade's CURATION rail is a different record and
    # is deliberately not read here.)
    featured = next((r for r in games if r['featured']), None)
    cards, covered = [], []
    for r in games:
        members = r.get('editions') or [r['id']]
        lead = next(i for i in members if by_id[i]['group'] == 'games')
        if r['id'] != lead:
            continue  # not the lead of its series: its Play anchor rides on the lead card
        cards.append(card(r, members, by_id))
        covered += [i for i in members if by_id[i]['group'] == 'games']
    if sorted(covered) != sorted(r['id'] for r in games) or len(covered) != len(set(covered)):
        raise ValueError('grid does not cover every catalogue game exactly once')
    template = (HERE/'index.html').read_text()
    # Use the exact supplied mark approved by the user, with a checked file hash.
    brand = read('brand.json', {})
    if not review and (brand.get('status') not in {'verified-original', 'user-approved'} or len(clips_by_route) != 6):
        raise ValueError('Play release held: verified approved logo and six accepted fresh clips are required. Use the isolated review entrypoint for unfinished work.')
    logo = ''
    if brand.get('status') in {'verified-original', 'user-approved'}:
        source = HERE / brand['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == brand['sha256']
        shutil.copyfile(source,assets/source.name)
        logo = '<img src="/assets/play/'+esc(source.name)+'" alt="" width="48" height="48">'
    data = {'counts': counts, 'catalogue': len(games), 'genres': [{'name': g, 'count': genre_counts[g]} for g in genres],
            'series': series, 'games': [slim(r) for r in rows]}
    substitutions = {'@@LOGO@@':logo, '@@CHIPS@@':chips, '@@FEATURED@@': feature(featured) if featured else '',
        '@@COUNT@@': str(len(games)) + ' games', '@@GRID@@': ''.join(cards), '@@CLASSROOM@@': classroom(activities),
        '@@DATA@@':json.dumps(data,ensure_ascii=False).replace('<','\\u003c')}
    for a,b in substitutions.items(): template = template.replace(a,b)
    assert '@@' not in template
    for name in ALIASES:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(template)
    assert (target/'data/domain-catalogue.json').read_bytes() == original
    report={'counts':counts,'total':len(rows),'catalogue_sha256':hashlib.sha256(original).hexdigest(),
            'brand_status':brand.get('status','original-asset-unresolved'), 'accepted_clips':len(clips_by_route),
            'grid_cards':len(cards),'series':{k:len(v) for k,v in series.items()},'genres':genres,
            'featured':featured['route'] if featured else None,
            'changed_game_payloads':0,'canonical_origin':ORIGIN,'shared_runtime_changed':False}
    (Path(output)/'play-discovery-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True,type=Path);ap.add_argument('--review',action='store_true');args=ap.parse_args()
    print(json.dumps(refresh(args.output,review=args.review),indent=2))
