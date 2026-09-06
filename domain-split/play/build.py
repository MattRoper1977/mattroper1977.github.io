"""Enhance only the generated Play shelf, consuming its existing catalogue.

Run after the existing publication builder. The shared release coordinator can
call refresh(output) before refresh_play_usage, using the supplied tiny patch.
"""
from __future__ import annotations
import argparse
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
esc = lambda s: html.escape(str(s), quote=True)

def key(route):
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'

def read(name, fallback):
    p = HERE / name
    return json.loads(p.read_text()) if p.exists() else fallback

def card(row, feature=False):
    media = row.get('media', {})
    image = media.get('poster') or row.get('image', '')
    picture = ('<figure><img src="'+esc(image)+'" alt="'+esc((media.get('description') or row['title']+' cover artwork'))+'" '+('fetchpriority="high"' if feature else 'loading="lazy"')+' width="640" height="360"><figcaption>'+('In-game screenshot' if media.get('poster') else 'Cover artwork')+'</figcaption></figure>') if image else ''
    chips = '<span>'+esc(row['genre'])+'</span><span>'+esc(row['groupLabel'])+'</span>'
    watch = '<button type="button" data-watch="'+esc(row['id'])+'" hidden>Watch gameplay</button>' if media.get('video') else ''
    return '<article class="game-card'+(' featured-card' if feature else '')+'" data-card="'+esc(row['id'])+'">'+picture+'<div class="card-body"><div class="chips">'+chips+'</div><h3>'+esc(row['title'])+'</h3><p>'+esc(row['description'])+'</p><div class="card-actions"><a class="button primary" data-play="'+esc(row['id'])+'" href="'+esc(row['route'])+'">Play game<span class="sr-only">: '+esc(row['title'])+'</span></a><button type="button" data-info="'+esc(row['id'])+'" hidden>Game info<span class="sr-only">: '+esc(row['title'])+'</span></button>'+watch+'<button class="favourite" type="button" data-favourite="'+esc(row['id'])+'" aria-label="Favourite '+esc(row['title'])+'" aria-pressed="false" hidden>♡</button></div></div></article>'

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
    clips = {key(x['route']): x for x in media.get('clips', []) if x.get('status') == 'accepted'}
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
                   'media':clips.get(key(path), {})}
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
    assets = target/'assets/play'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ['play.css','play.js']:
        shutil.copyfile(HERE/name, assets/name)
    for clip in clips.values():
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
    genres = sorted({r['genre'] for r in rows})
    template = (HERE/'index.html').read_text()
    features = [r for r in rows if r['media']][:6]
    featured = ''
    if features:
        featured = '<section class="showcase" aria-labelledby="showcase-title"><div class="section-heading"><div><p class="eyebrow">A glimpse inside</p><h2 id="showcase-title">Choose your next adventure</h2></div><p>Real gameplay. Press Watch to preview.</p></div><div class="feature-grid">'+''.join(card(r, i==0) for i,r in enumerate(features))+'</div></section>'
    recent = sorted([r for r in rows if r.get('updated')],key=lambda r:r['updated']['date'],reverse=True)[:3]
    updates = '' if not recent else '<section class="updates" aria-labelledby="updates-title"><h2 id="updates-title">Recently updated</h2><div class="update-grid">'+''.join('<article><time datetime="'+esc(r['updated']['date'])+'">'+esc(r['updated']['date'])+'</time><h3><a data-play="'+esc(r['id'])+'" href="'+esc(r['route'])+'">'+esc(r['title'])+'</a></h3><p>'+esc(r['updated']['description'])+'</p></article>' for r in recent)+'</div></section>'
    # Use the exact supplied mark approved by the user, with a checked file hash.
    brand = read('brand.json', {})
    if not review and (brand.get('status') not in {'verified-original', 'user-approved'} or len(clips) != 6):
        raise ValueError('Play release held: verified approved logo and six accepted fresh clips are required. Use the isolated review entrypoint for unfinished work.')
    logo = ''
    if brand.get('status') in {'verified-original', 'user-approved'}:
        source = HERE / brand['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == brand['sha256']
        shutil.copyfile(source,assets/source.name)
        logo = '<img src="/assets/play/'+esc(source.name)+'" alt="" width="48" height="48">'
    classroom_in_catalogue = sum(r['groupLabel']=='Catalogue classroom game' for r in rows)
    collection_note = f"The {counts['games']} catalogue entries include {classroom_in_catalogue} classroom games. The {counts['activities']} additional classroom activities have a learning purpose; the staff collection is for professional development."
    substitutions = {'@@LOGO@@':logo,'@@COUNTS@@':f"{counts['games']} catalogue games · {counts['activities']} classroom activities · {counts['staff']} staff activity",'@@COLLECTION_NOTE@@':esc(collection_note),
        '@@TOTAL@@':str(len(rows)), '@@GENRES@@':''.join('<option>'+esc(g)+'</option>' for g in genres),
        '@@CARDS@@':''.join(card(r) for r in rows), '@@SHOWCASE@@':featured, '@@UPDATES@@':updates,
        '@@DATA@@':json.dumps({'counts':counts,'games':rows},ensure_ascii=False).replace('<','\\u003c')}
    for a,b in substitutions.items(): template = template.replace(a,b)
    assert '@@' not in template
    for name in ALIASES:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(template)
    assert (target/'data/domain-catalogue.json').read_bytes() == original
    report={'counts':counts,'total':len(rows),'catalogue_sha256':hashlib.sha256(original).hexdigest(),
            'brand_status':brand.get('status','original-asset-unresolved'), 'accepted_clips':len(clips),
            'changed_game_payloads':0,'canonical_origin':ORIGIN,'shared_runtime_changed':False}
    (Path(output)/'play-discovery-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True,type=Path);ap.add_argument('--review',action='store_true');args=ap.parse_args()
    print(json.dumps(refresh(args.output,review=args.review),indent=2))
