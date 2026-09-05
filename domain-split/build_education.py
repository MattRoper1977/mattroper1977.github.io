#!/usr/bin/env python3
"""Produce filtered Pages trees without changing any source lesson or game.

Run after build_publications.py. Each output belongs to its existing repository:
Site remains /, Lessons remains /Lessons/, Apps remains /Matt-s-Apps-/.
"""
from pathlib import Path
from urllib.parse import unquote, urlparse, urljoin
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from lxml import html as lhtml
from build_preview import EDUCATION_OVERRIDES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PLAY = 'https://madebymatt-play.uk'
LEARN = 'https://madebymatt.uk'
# Fixed historical redirects: the superseded Lessons game addresses as at
# 2026-09-05. This map is deliberately not the current shelf's membership.
LEGACY = {
    '/Lessons/Games/Off_Brand.html': '/offbrand/',
    '/Lessons/Games/Trail_Runner.html': '/trailrunner/',
    '/Lessons/Games/Voxel_Frontier.html': '/voxel/',
    '/Lessons/Games/Orbital_source.html': '/Lessons/Games/Orbital.html',
    '/Lessons/5_6 Local Choice/Trekkers_Trail_Runner (2).html': '/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html',
}
SKIP = {'tools', 'reports', 'docs', 'domain-split', 'node_modules', 'supabase', 'schema'}
PUBLIC = {'.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.pdf', '.zip', '.docx', '.pptx', '.xlsx', '.csv', '.txt', '.xml', '.webmanifest', '.wasm', '.bin', '.map', '.md'}

def normal(value):
    return unquote(urlparse(value).path).removesuffix('index.html').rstrip('/') or '/'

def tracked(root):
    return subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z'], text=True).split('\0')[:-1]

def public_file(path):
    p = Path(path)
    if path == 'tools/index.html': return True  # public teacher-tools hub
    return (not any(x.startswith(('.', '_')) for x in p.parts)
            and p.parts[0] not in SKIP
            and (p.suffix.lower() in PUBLIC or p.name in {'CNAME', 'LICENSE'}))

def write(root, relative, text):
    p = root / relative
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')

def moved_page(route):
    destination = PLAY + LEGACY.get(route, route)
    from html import escape
    return ('<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="robots" content="noindex"><title>This game has moved · Made by Matt</title>'
            '<style>body{font:1.1rem/1.65 system-ui;max-width:42rem;margin:4rem auto;padding:0 1.25rem;color:#161d3d}a{color:#174e45}li{margin:1rem 0}a:focus-visible{outline:3px solid #e39129;outline-offset:4px}</style>'
            '</head><body data-game-moved><main><h1>This game has moved</h1>'
            '<p>Made by Matt games now have their own website.</p>'
            '<p>If you have played here before, move your saves using this same browser and device.</p>'
            '<ol><li><a href="/game-saves/">Download your existing game saves</a>.</li>'
            '<li><a href="'+PLAY+'/game-saves/">Import them on the games website</a>.</li></ol>'
            '<p><a id="play-game" href="'+escape(destination, quote=True)+'">Open the game</a></p>'
            '<p><a href="/for/pupils/">Back to pupil learning</a></p></main>'
            '<script>const a=document.getElementById("play-game");const u=new URL(a.href);u.search=location.search;u.hash=location.hash;a.href=u.href;</script>'
            '</body></html>')

def make_classifier(lessons):
    census = json.loads((ROOT/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    rows = json.loads((ROOT/'data/mbm-search-index.json').read_text())['entries']
    games = {normal(r['normalizedDecodedRoute']) for r in census}
    games.update(normal(e['route']) for e in rows if e['category'] == 'game')
    games.update(normal(p) for p in LEGACY)
    games.difference_update(normal(p) for p in EDUCATION_OVERRIDES)
    lesson_manifest = json.loads((lessons/'resources.json').read_text())
    games.update(normal('/Lessons/'+e['file']) for e in lesson_manifest if e.get('type') == 'game')
    site_dirs = {r['source']['path'].split('/')[0] for r in census if r['source']['repository'] == 'Site'}
    site_dirs.update(urlparse(e['route']).path.strip('/').split('/')[0] for e in rows
                     if e['category'] == 'game' and not e['route'].startswith(('/Lessons/', '/Games/')))
    games.update({'/games', '/Games'})
    def is_game(value, prefix=''):
        p = normal(value if value.startswith(('/', 'http')) else prefix + value)
        if p in {normal(x) for x in EDUCATION_OVERRIDES}: return False
        return p in games or p.startswith('/Lessons/Games/') or p.strip('/').split('/')[0] in site_dirs
    return games, site_dirs, is_game

def filter_data(obj, is_game, prefix):
    if isinstance(obj, list):
        out=[]
        for item in obj:
            if isinstance(item, dict):
                dest = next((item.get(k) for k in ['route','href','file','url'] if isinstance(item.get(k), str)), '')
                if dest and is_game(dest, prefix): continue
            out.append(filter_data(item, is_game, prefix))
        return out
    if isinstance(obj, dict):
        out={k:filter_data(v,is_game,prefix) for k,v in obj.items()}
        dest=next((out.get(k) for k in ['route','href','file','url'] if isinstance(out.get(k),str)), '')
        role=EDUCATION_OVERRIDES.get(unquote(urlparse(dest if dest.startswith(('/', 'http')) else prefix+dest).path))
        if role:
            if 'category' in out: out['category']='resource'
            if 'type' in out: out['type']=role
            if 'safeForPupils' in out: out['safeForPupils']=role=='pupil'
        return out
    return obj

def clean_shell(text, is_game, prefix):
    # Restrict DOM rewriting to site navigation/catalogue surfaces. Actual
    # educational activities, teacher tools and their scripts stay byte-exact.
    doc=lhtml.document_fromstring(text)
    for article in list(doc.xpath('//article[contains(concat(" ",normalize-space(@class)," ")," mf-feature ")]')):
        links=article.xpath('.//a[@href]')
        if links and any(is_game(a.get('href'),prefix) for a in links): article.drop_tree()
    for a in list(doc.xpath('//a[@href]')):
        if is_game(a.get('href'),prefix): a.drop_tree()
    for node in doc.iter():
        if node.tag in {'script','style'}: continue
        for attr in ['text','tail']:
            value=getattr(node,attr,None)
            if not value:continue
            for old,new in [('games, lessons','lessons'),('games and lessons','lessons'),('games, tools','tools'),('subject, game, pathway','subject, pathway')]:
                value=value.replace(old,new)
            setattr(node,attr,value)
    for inp in doc.xpath('//input[@placeholder]'):
        inp.set('placeholder',inp.get('placeholder').replace('subject, game, pathway','subject, pathway'))
    return lhtml.tostring(doc,encoding='unicode',doctype='<!doctype html>')

def build(output, lessons, apps=None, allow_sparse=False):
    games, game_dirs, is_game=make_classifier(lessons)
    roots={'site':(ROOT,''),'lessons':(lessons,'/Lessons/')}
    if apps: roots['apps']=(apps,'/Matt-s-Apps-/')
    report={'status':'STAGED_NOT_LIVE','sources':{},'publications':{},'legacy_aliases':LEGACY,'education_preserved':EDUCATION_OVERRIDES,'missing_source_files':[]}
    for name,(root,prefix) in roots.items():
        dest=output/('education-'+name)
        if dest.exists(): shutil.rmtree(dest)
        dest.mkdir(parents=True)
        report['sources'][name]=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
        migrated=[]; copied=[]; changed=[]
        for relative in tracked(root):
            if not public_file(relative):continue
            p=root/relative
            if not p.is_file():
                report['missing_source_files'].append(name+':'+relative)
                continue
            route=('/'+relative if not prefix else prefix+relative)
            if (name=='site' and relative.split('/')[0] in game_dirs) or (name=='lessons' and relative.startswith('Games/')) or is_game(route):
                if p.suffix=='.html':
                    target=route.removesuffix('index.html')
                    write(dest,relative,moved_page(target));migrated.append(relative)
                continue
            target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);copied.append(relative)
            if p.suffix=='.json':
                try:data=json.loads(p.read_text())
                except (ValueError,UnicodeError):continue
                filtered=filter_data(data,is_game,prefix)
                if filtered != data:write(dest,relative,json.dumps(filtered,ensure_ascii=False,indent=2)+'\n');changed.append(relative)
            shell=(name=='site' and (relative.startswith(('for/','resources/','education-hub/','teach/','start/','next/')) or relative=='index.html')) or (name in {'lessons','apps'} and relative=='index.html')
            if shell and p.suffix=='.html':write(dest,relative,clean_shell(p.read_text(),is_game,prefix));changed.append(relative)
        if name=='site':
            overlay=output/'education-overlay'
            for p in overlay.rglob('*'):
                if p.is_file():
                    to=dest/p.relative_to(overlay);to.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,to)
            for route in ['games/index.html','Games/index.html']:
                write(dest,route,moved_page('/'))
            # Search results and recently used resources read this filtered index.
            index=json.loads((dest/'data/mbm-search-index.json').read_text())
            if 'counts' in index:
                from collections import Counter
                index['counts']={'total':len(index['entries']),**dict(Counter(x['category'] for x in index['entries']))}
            write(dest,'data/mbm-search-index.json',json.dumps(index,ensure_ascii=False)+'\n')
            write(dest,'CNAME','madebymatt.uk\n')
            sitemap=dest/'sitemap.xml'
            if sitemap.exists():
                from lxml import etree
                tree=etree.fromstring(sitemap.read_bytes())
                for item in list(tree):
                    loc=item.find('{*}loc')
                    if loc is not None and is_game(loc.text or ''):tree.remove(item)
                sitemap.write_bytes(etree.tostring(tree,xml_declaration=True,encoding='utf-8'))
        if name=='apps':
            for p in dest.glob('*.json'):
                p.write_text(p.read_text().replace('Play & explore','Science investigations'))
        # These publication trees intentionally contain source assets only,
        # never code/report trees that Jekyll previously suppressed.
        write(dest,'.nojekyll','')
        for relative in migrated:
            assert 'data-game-moved' in (dest/relative).read_text()
        report['publications'][name]={'root':str(dest),'source_files':len(copied),'moved_game_pages':migrated,'transformed_discovery_files':changed,'output_files':sum(p.is_file() for p in dest.rglob('*'))}
    if report['missing_source_files']:
        report['status']='PARTIAL_SPARSE_REVIEW_ONLY'
        if not allow_sparse:raise ValueError('Full source checkout required; missing '+str(len(report['missing_source_files']))+' files')
    if not apps:report['apps']='Not supplied; separate Apps output still required'
    write(output,'education-build-report.json',json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--lessons',type=Path,required=True);ap.add_argument('--apps',type=Path);ap.add_argument('--output',type=Path,default=HERE/'output');ap.add_argument('--allow-sparse',action='store_true');a=ap.parse_args()
    r=build(a.output.resolve(),a.lessons.resolve(),a.apps.resolve() if a.apps else None,a.allow_sparse)
    print(json.dumps({'status':r['status'],'publications':{k:{a:b for a,b in v.items() if not isinstance(b,list)} for k,v in r['publications'].items()},'missing_source_files':len(r['missing_source_files'])},indent=2))
