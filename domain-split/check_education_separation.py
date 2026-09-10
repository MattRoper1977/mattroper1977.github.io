#!/usr/bin/env python3
"""Independently inspect emitted Education files after all transformations."""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse

HERE = Path(__file__).resolve().parent
LEARN = 'https://madebymatt.uk'
PLAY = 'https://www.madebymatt-play.uk'
# Explicit expectations are independent of the generator's exception list.
RETAINED = [
    '/Lessons/5 Intervention 10/Lesson_VIR_Intervention.html',
    '/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html',
    '/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html',
    '/Matt-s-Apps-/orbit-vector-diagnostic.html',
    '/Matt-s-Apps-/enzyme-reactor-overdrive.html',
    '/Matt-s-Apps-/wave-interference-iridescence-engine-v2-3.html',
    '/Matt-s-Apps-/ohms-law-fault-finder-v2-3.html',
    '/Matt-s-Apps-/mbm-master-hub.html',
]
# Established historical migration contract, checked 6 September 2026.
ALIASES = {'/experiences/medevac-frontier/': '/medevac/',
           '/resources/medevac-frontier/': '/medevac/', '/next/games.html': '/',
           '/games/': '/', '/Games/': '/',
           '/Lessons/Games/Off_Brand.html': '/offbrand/',
           '/Lessons/Games/Trail_Runner.html': '/trailrunner/',
           '/Lessons/Games/Voxel_Frontier.html': '/voxel/',
           '/Lessons/Games/Orbital_source.html': '/Lessons/Games/Orbital.html',
           '/Lessons/5_6 Local Choice/Trekkers_Trail_Runner (2).html': '/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html'}


def key(value):
    return unquote(urlparse(value).path).removesuffix('index.html').rstrip('/') or '/'


# <link> relations a browser never fetches: they annotate the document (HC3
# section 2.4 gives every moved page a canonical to its Play route). Every other
# non-anchor reference — stylesheet, preload, icon, script, img, iframe — is a
# request the page makes by itself, which a school filter on Play would break.
DOCUMENT_LINK_RELS = {'canonical', 'alternate'}


def automatic_request(tag, attrs):
    """True when the browser fetches this reference without a user action."""
    if tag == 'a': return False
    if tag == 'link':
        rels = set((attrs.get('rel') or '').lower().split())
        return not rels or not rels <= DOCUMENT_LINK_RELS
    return True


class Refs(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.engines=[]; self.tags=[]; self.play_destination=None; self.automatic=set()
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); self.tags.append(tag)
        if tag=='a' and attrs.get('id')=='play-game': self.play_destination=attrs.get('href')
        for attr in ['href','src','poster','data-src']:
            if attrs.get(attr):
                self.refs.append((tag,attr,attrs[attr]))
                if automatic_request(tag, attrs): self.automatic.add((tag,attr,attrs[attr]))
        if tag in {'canvas','iframe','embed','object','video','audio'}: self.engines.append(tag)


TEACHING_PACK_ADDITIONS = HERE/'teaching-packs-download-usage-additions.json'
# Pins the reviewed teaching-pack download rows above (296 rows over seven
# Teaching_Packs prefixes), accepted 7 September 2026 (HC6 §11). Re-pin only
# with a reviewed diff of that file.
TEACHING_PACK_ADDITIONS_SHA256 = '6331c21a6315f5a5ab6bc945b6479ac1c07c9e3572248753c699f5e6ea6abc67'


def registry_partition(rows, approved_by_prefix, installed_by_prefix):
    """Pure rule, so the self-test can plant rows against it.

    Every reviewed Teaching_Packs prefix contributes exactly its approved rows
    when its pack index is installed and nothing when it is not; every other
    row is a frozen installed record. Returns the error names."""
    errors = []
    retained = list(rows)
    for prefix, approved in approved_by_prefix.items():
        extensions = [r for r in rows if r['route'].startswith(prefix)]
        retained = [r for r in retained if not r['route'].startswith(prefix)]
        if extensions != (approved if installed_by_prefix.get(prefix) else []):
            errors.append('Download additions differ from the reviewed installed pack: '+prefix)
    return errors, retained


def registry_errors(output):
    # Frozen installed records remain byte-equivalent, accepted 6 September.
    # Matt's new teaching downloads add only reviewed download metadata. No
    # historical events, counters, configuration or backend data are replayed.
    # HC6 §11: the reviewed additions now cover every Teaching_Packs prefix —
    # Science keeps its own file; the other subjects share one file keyed by
    # prefix. Both files are pinned by digest.
    # Re-frozen 7 September (HC6 §12): the catalogue mirror moved 663 → 751 rows,
    # which gives 51 existing records their search-index source_ids. Same rows,
    # same routes; proved identical between the pinned and the final builds.
    # Re-frozen 8 September (RX3 P3.4): the catalogue transaction (Lessons #399,
    # fdbf0ee6) catalogues the 26 beside classic lessons and the six FoodWise
    # chassis pages, so 32 lesson records join the registry and the two re-cut
    # Science lessons carry their catalogue titles: 894 -> 926 retained rows,
    # 0 removed. Proved on the fdbf0ee6 build; the a91780fc build no longer
    # matches, which is why this moves with the Lessons pin lines.
    # Re-frozen 8 September (UX2 B4): the catalogue mirror moved 737 → 848 rows and the
    # search index 821 → 932 entries; the retained registry keeps its 926 rows and routes
    # (0 added, 0 removed) while 32 classic-lesson records gain their new search-index
    # source_ids beside the old ones. Proved by diffing registry_partition() output between
    # the B3 and B4 builds (reports/B4_registry_refreeze.json in the lane report).
    baseline_sha = 'd2439c6161bb2715ab7b04a3880e036189e9726f8f30d55e63b5816abd40f5bf'
    additions_path = HERE/'science-download-usage-additions.json'
    if sha256(additions_path.read_bytes()).hexdigest() != '266199e1f6d355956b23df058b3d867b50edc2f155545b0b43fb2d6f8177df30':
        return ['Unreviewed Science download registration metadata']
    if sha256(TEACHING_PACK_ADDITIONS.read_bytes()).hexdigest() != TEACHING_PACK_ADDITIONS_SHA256:
        return ['Unreviewed teaching-pack download registration metadata']
    approved = {'/Lessons/Science_Teesside/Teaching_Packs/': json.loads(additions_path.read_text())}
    approved.update(json.loads(TEACHING_PACK_ADDITIONS.read_text()))
    rows = json.loads((output/'usage-registry.json').read_text())
    lessons = output/'education-lessons'
    installed = {prefix: (lessons/prefix[len('/Lessons/'):]/'index.html').is_file() for prefix in approved}
    errors, retained = registry_partition(rows, approved, installed)
    if sha256((json.dumps(retained,ensure_ascii=False,indent=2)+'\n').encode()).hexdigest() != baseline_sha:
        errors.append('Installed combined registry records changed')
    return errors


def check(output):
    census=json.loads((HERE.parent/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    excluded={key(row['normalizedDecodedRoute']) for row in census} - {key(route) for route in RETAINED}
    excluded.update(key(route) for route in ALIASES)
    excluded.update({'/games','/Games'})
    game_dirs={row['source']['path'].split('/')[0] for row in census if row['source']['repository']=='Site'}
    def excluded_path(value):
        path=key(value)
        return path in excluded or path.startswith('/Lessons/Games/') or path.strip('/').split('/')[0] in game_dirs
    payloads=json.loads((output/'build-report.json').read_text())['payloads']
    engine_hashes={row['published_sha256'] for row in payloads if key('/'+row['path']) in excluded}
    # Immutable overlooked Medevac engine, audited 6 September 2026.
    engine_hashes.add('5a408754c29ef65b1e35f192383c6115b7ea92ae97c778981251dfe3a0295b02')
    failures=[]; counts={'files':0,'html':0,'json_manifests':0,'references':0,'migrations':0,'sitemap_urls':0}
    def fail(where, reason): failures.append({'file':str(where),'reason':reason})
    def game(value, base):
        url=urlparse(urljoin(LEARN+base,value))
        if url.hostname in {'madebymatt-play.uk','www.madebymatt-play.uk'}:
            return key(url.path) not in {'/','/game-saves'}
        return url.hostname in {'madebymatt.uk','www.madebymatt.uk','mattroper1977.github.io'} and excluded_path(url.path)
    def asset(value, base):
        path=unquote(urlparse(urljoin(LEARN+base,value)).path)
        return (path in {'/data/source-manifests/lessons-resources.json','/data/mbm-search-editorial.json','/data/new-release-occupants.json','/data/tag-backfill.csv','/data/hud-coverage.json','/Lessons/data/hud-coverage.json','/data/audience-homepages.json'}
                or path.startswith('/assets/cards/') or path.startswith('/assets/brand/medevac_frontier_patch.')
                or path=='/images/apexkick-hub.jpg'
                or bool(re.match(r'/assets/video/(?:clip|poster)-(?:apexkick|glitchclash|neonbreach|neonsync|offbrand|voxelfrontier)(?:-play)?\.',path)))
    def records(value, path, base):
        if isinstance(value,list):
            for row in value: records(row,path,base)
        elif isinstance(value,dict):
            if value.get('category')=='game' or value.get('zone')=='games' or value.get('type')=='game': fail(path,'Recreational catalogue classification in Education')
            for field,item in value.items():
                if (field.startswith('/') or '.html' in field) and game(field,base): fail(path,'Excluded route used as catalogue key: '+field)
                if field in {'route','href','file','url','path','f','src','image','poster','thumbnail'} and isinstance(item,str):
                    counts['references']+=1
                    if game(item,base) or asset(item,base): fail(path,'Excluded catalogue/manifest destination: '+field+'='+item)
                records(item,path,base)
    for part,prefix in [('site','/'),('lessons','/Lessons/'),('apps','/Matt-s-Apps-/')]:
        root=output/('education-'+part)
        for path in sorted(root.rglob('*')):
            if not path.is_file(): continue
            counts['files']+=1; route=prefix+path.relative_to(root).as_posix()
            if asset(route,'/'): fail(route,'Recreational asset deployed on Education')
            if path.relative_to(root).as_posix() == 'data/game-storage-allowlist.json':
                if path.read_bytes() != (HERE/'game-storage-allowlist.json').read_bytes(): fail(route,'Save-transfer rules changed')
                continue
            if path.suffix in {'.json','.webmanifest'}:
                counts['json_manifests']+=1
                try: records(json.loads(path.read_text()),route,prefix)
                except (ValueError,UnicodeError): fail(route,'Invalid JSON/manifest')
            if path.suffix in {'.html','.htm'}:
                counts['html']+=1
                if sha256(path.read_bytes()).hexdigest() in engine_hashes: fail(route,'Known recreational engine bytes at an Education route')
                text=path.read_text(errors='replace'); parser=Refs();parser.feed(text)
                moved='data-game-moved' in text
                if moved:
                    counts['migrations']+=1
                    if parser.engines or len(text.encode())>10000: fail(route,'Migration contains engine/media or excessive payload')
                    # HC4 §7.4: a stub carries exactly one link, the play destination.
                    anchors=[value for tag,attr,value in parser.refs if tag=='a' and attr=='href']
                    if len(anchors)!=1: fail(route,'Stub carries '+str(len(anchors))+' links; exactly one is allowed')
                    destinations=[value for tag,attr,value in parser.refs if tag=='a' and attr=='href' and 'madebymatt-play.uk' in value]
                    if not destinations or any(not value.startswith(PLAY+'/') for value in destinations): fail(route,'Migration must use canonical HTTPS Play')
                    expected=PLAY+ALIASES.get(route.removesuffix('index.html'),route.removesuffix('index.html'))
                    if parser.play_destination != expected: fail(route,'Incorrect migration destination: '+str(parser.play_destination))
                    target=output/'games'/unquote(urlparse(parser.play_destination or '').path).lstrip('/')
                    if not target.is_file() and not (target/'index.html').is_file(): fail(route,'Migration destination missing from Play output')
                elif excluded_path(route): fail(route,'Known recreational route still serves content')
                for tag,attr,value in parser.refs:
                    counts['references']+=1
                    if asset(value,route): fail(route,'Recreational media reference: '+value)
                    if game(value,route) and not moved: fail(route,'Recreational navigation/embed: '+value)
                    if (tag,attr,value) in parser.automatic and 'madebymatt-play.uk' in value: fail(route,'Automatic Play request: '+value)
                if re.search(r'(?:serviceWorker\s*\.\s*register|caches\s*\.\s*open)\s*\(',text): fail(route,'New offline cache requires boundary review')
            elif path.suffix=='.js':
                if re.search(r'(?:serviceWorker\s*\.\s*register|caches\s*\.\s*open)\s*\(',path.read_text(errors='replace')): fail(route,'New offline cache requires boundary review')
            elif path.suffix=='.xml':
                from lxml import etree
                for loc in etree.fromstring(path.read_bytes()).xpath('//*[local-name()="loc"]/text()'):
                    counts['sitemap_urls']+=1
                    if game(loc,'/'): fail(route,'Recreational sitemap URL: '+loc)
    for route in RETAINED:
        part='education-lessons' if route.startswith('/Lessons/') else 'education-apps'
        relative=route.split('/',2)[2]; path=output/part/relative
        if not path.is_file() or 'data-game-moved' in path.read_text(): fail(route,'Reviewed educational activity missing or migrated')
    for message in registry_errors(output): fail('usage-registry.json',message)
    report={'status':'FAIL' if failures else 'PASS','coverage':counts,'intentionally_retained_activities':len(RETAINED),'failures':failures,'scope':'Complete static emitted Education walk; does not guarantee school-filter acceptance.'}
    (output/'education-separation-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return not failures


def self_test():
    """The automatic-request rule, proved on planted references before it judges a tree."""
    play='https://www.madebymatt-play.uk/apexkick/'
    cases=[  # (markup, must be named as an automatic Play request)
        ('<link rel="stylesheet" href="%s">'%play, True),
        ('<link rel="preload" as="script" href="%s">'%play, True),
        ('<link href="%s">'%play, True),
        ('<script src="%s"></script>'%play, True),
        ('<img src="%s">'%play, True),
        ('<iframe src="%s"></iframe>'%play, True),
        ('<link rel="canonical" href="%s">'%play, False),
        ('<link rel="alternate" href="%s">'%play, False),
        ('<a id="play-game" href="%s">Play</a>'%play, False),
    ]
    ok=True
    # HC6 §11: the reviewed-additions partition, proved on planted rows.
    row=lambda r:{'route':r,'kind':'resource'}
    approved={'/Lessons/Careers/Teaching_Packs/':[row('/Lessons/Careers/Teaching_Packs/BUILD/downloads/a.zip')]}
    other=[row('/Lessons/Science_Teesside/x.html')]
    reg_cases=[  # (rows, installed, expected error count)
        (other+approved['/Lessons/Careers/Teaching_Packs/'], {'/Lessons/Careers/Teaching_Packs/':True}, 0),
        (other, {'/Lessons/Careers/Teaching_Packs/':False}, 0),
        (other+approved['/Lessons/Careers/Teaching_Packs/']+[row('/Lessons/Careers/Teaching_Packs/BUILD/downloads/planted.zip')], {'/Lessons/Careers/Teaching_Packs/':True}, 1),
        (other, {'/Lessons/Careers/Teaching_Packs/':True}, 1),
        (other+approved['/Lessons/Careers/Teaching_Packs/'], {'/Lessons/Careers/Teaching_Packs/':False}, 1),
    ]
    for rows,installed,expected in reg_cases:
        errors,retained=registry_partition(rows,approved,installed)
        passed=len(errors)==expected and retained==other; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] registry partition: {len(rows)} rows, installed={list(installed.values())[0]} -> {len(errors)} error(s), retained {len(retained)}")
    for markup,expected in cases:
        p=Refs(); p.feed(markup)
        named=any('madebymatt-play.uk' in v for (t,a,v) in p.automatic)
        passed=named==expected; ok=ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] {'named' if named else 'not named'}: {markup}")
    print('self-test','PASS' if ok else 'FAIL')
    return ok


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=HERE/'output');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test: raise SystemExit(0 if self_test() else 1)
    raise SystemExit(0 if check(args.output) else 1)
