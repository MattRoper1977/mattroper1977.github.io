"""Optional shared usage UI in the existing publication runtime.

Raw teaching/game sources and native downloads are never rewritten. Education
lesson HTML gets one published adapter, just like the existing lesson navigation.
Games are measured at shelf/showcase links, with no game-payload adapter.
"""
from collections import defaultdict
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse

HERE = Path(__file__).resolve().parent
EDUCATION = 'https://madebymatt.uk'
PLAY = 'https://www.madebymatt-play.uk'
EXTENSIONS = {'.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods', '.zip', '.epub'}
EDUCATION_HOSTS = {'madebymatt.uk', 'www.madebymatt.uk', 'mattroper1977.github.io'}
PLAY_HOSTS = {'madebymatt-play.uk', 'www.madebymatt-play.uk'}
# Confirmed complete teaching packs. A poster bundle or a generic ZIP is a
# resource, not automatically a lesson pack. Extend this reviewed set explicitly.
LESSON_PACK_ROUTES = {'/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/David_'+pathway+'_Humanities_RE_Pack.zip' for pathway in ['BUILD','GROW','LAUNCH']}


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Usage source anchor changed: '+before[:100])
    return text.replace(before, after, 1)


def canonical(route):
    if str(route).startswith('//'): raise ValueError('Protocol-relative usage route is not allowed')
    path = unquote(urlparse(route).path)
    if not path.startswith('/') or path.startswith('//') or '\\' in path or any(part in {'.', '..'} for part in path.split('/')) or any(ord(c) < 32 for c in path):
        raise ValueError('Unsafe usage route: '+repr(route))
    return re.sub(r'index\.html$', '', path, flags=re.I).rstrip('/') or '/'


def stable_id(source, route):
    return sha256((source+'\n'+canonical(route)).encode()).hexdigest()


def local_file(output, route, source='education'):
    url = urlparse(urljoin(PLAY+'/' if source == 'play' else EDUCATION+'/', route))
    if url.hostname not in (PLAY_HOSTS if source == 'play' else EDUCATION_HOSTS):
        return None
    path = unquote(url.path).lstrip('/')
    root = output/'games' if source == 'play' else output/'education-site'
    if source == 'education':
        for prefix, part in [('Lessons/', 'education-lessons'), ('Matt-s-Apps-/', 'education-apps')]:
            if path.startswith(prefix):
                root = output/part; path = path[len(prefix):]; break
    target = (root/path).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError('Usage route escapes publication')
    return target/'index.html' if target.is_dir() else target


class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.rows=[]; self.current=None
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            values=dict(attrs); self.current={'href':values.get('href',''),'title':values.get('aria-label',''),'text':[],'download':'download' in values}
    def handle_data(self, text):
        if self.current: self.current['text'].append(text)
    def handle_endtag(self, tag):
        if tag == 'a' and self.current:
            self.current['text']=' '.join(' '.join(self.current['text']).split());self.rows.append(self.current);self.current=None


def registry(output, lessons, site_source, play_only=False):
    records={}; provenance=defaultdict(set)
    def add(source, route, title, event_type, source_id=''):
        url=urlparse(urljoin(PLAY+'/' if source=='play' else EDUCATION+'/', route))
        if url.hostname not in (PLAY_HOSTS if source=='play' else EDUCATION_HOSTS): return
        target=local_file(output, route, source)
        if not target or not target.is_file(): return
        route=unquote(url.path)
        if route.endswith('index.html'): route=route[:-10]
        key=(source,canonical(route))
        if key not in records:
            records[key]={'source':source,'resource_id':stable_id(source,route),'title':str(title).strip()[:200] or target.name,
                          'route':route,'kind':('game' if source=='play' else 'lesson' if event_type=='lesson_open' else 'pack' if route in LESSON_PACK_ROUTES else 'resource'),'event_types':[],'aliases':[],'source_ids':[]}
        row=records[key]
        if event_type not in row['event_types']: row['event_types'].append(event_type)
        if source_id: provenance[key].add(str(source_id))
    game_catalogue=output/'games/data/domain-catalogue.json'
    if game_catalogue.is_file():
        data=read(game_catalogue)
        for kind in ['games','activities','staff']:
            for row in data.get(kind,[]):
                add('play',row['route'],row['title'],'game_launch',row.get('id',''))
    if not play_only:
        # Prefer the established search IDs/titles; preserve them as aliases of
        # each new shared measurement ID without importing device-local totals.
        search=read(site_source/'data/mbm-search-index.json')
        for row in search['entries']:
            if row.get('category')=='lesson': add('education',row['route'],row['title'],'lesson_open',row.get('id',''))
        for row in read(lessons/'resources.json'):
            if row.get('type')=='lesson':
                add('education','/Lessons/'+row['file'],row['title'],'lesson_open',row.get('id',''))
        # The current lesson finder also publishes two reviewed subject
        # shelves. Only entries explicitly classified as lessons are eligible.
        for name in ['science-shelf.json','humanities-shelf.json']:
            shelf=lessons/'assets/catalogue'/name
            if shelf.is_file():
                for row in read(shelf).get('lessons',[]):
                    if row.get('resourceType','lesson')=='lesson':
                        add('education','/Lessons/'+row['path'],row['title'],'lesson_open',row.get('id',''))
        # David's completed cover sequence is catalogued at hub level. Its
        # authored lesson-card links are the authority for these 25 lessons.
        david=lessons/'Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html'
        if david.is_file():
            parser=Links();parser.feed(david.read_text())
            for link in parser.rows:
                child=link['href']
                if re.fullmatch(r'(?:BH|BR|GH|GR|LH)_W[3-7]\.html',child):
                    add('education','/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/'+child,
                        link['title'] or link['text'],'lesson_open')
        # Primary is its own classification; only the real sequence lessons,
        # never a year/unit hub or a scheme, count as lesson destinations.
        primary=output/'education-lessons/primary/catalogue.json'
        if primary.is_file():
            for unit in read(primary).get('units',[]):
                for row in unit.get('lessons',[]):
                    add('education',row['route'],row['title'],'lesson_open',row.get('id',''))
                    for source_id in row.get('source_ids',[]):
                        provenance[('education',canonical(row['route']))].add(str(source_id))
        # Count only actual linked static downloads. Every destination must be
        # present in the assembled output; no guessed URLs or generated files.
        for part,prefix in [('education-site','/'),('education-lessons','/Lessons/'),('education-apps','/Matt-s-Apps-/')]:
            root=output/part
            for path in sorted(root.rglob('*.html')):
                page=prefix+path.relative_to(root).as_posix(); parser=Links()
                try: parser.feed(path.read_text())
                except (UnicodeError,ValueError): continue
                for link in parser.rows:
                    url=urljoin(EDUCATION+page,link['href']);suffix=Path(unquote(urlparse(url).path)).suffix.lower()
                    if suffix in EXTENSIONS:
                        title=link['title'] or link['text'] or Path(unquote(urlparse(url).path)).name
                        if len(title)<6 or title.lower() in {'download','open','pdf','word','pptx'} or (suffix=='.zip' and title.lower().startswith('download')):
                            title=Path(unquote(urlparse(url).path)).stem.replace('_',' ').replace('-',' ')+' · '+suffix[1:].upper()
                        add('education',url,title,'download_request')
    aliases=site_source/'domain-split/usage-route-aliases.json'
    if aliases.is_file():
        for alias in read(aliases):
            key=(alias['source'],canonical(alias['route']))
            if key not in records or not re.fullmatch(r'[a-f0-9]{64}',alias['resource_id']): raise ValueError('Invalid usage alias record')
            records[key]['resource_id']=alias['resource_id']
            records[key]['aliases']=[canonical(r) for r in alias.get('aliases',[])]
    ids=set()
    for key,row in records.items():
        row['source_ids']=sorted(provenance[key]);row['event_types'].sort()
        if (row['source'],row['resource_id']) in ids: raise ValueError('Duplicate shared resource identity')
        ids.add((row['source'],row['resource_id']))
    return sorted(records.values(),key=lambda row:(row['source'],row['resource_id']))


def config(site_source, source):
    account=read(site_source/'site.json')['features']['accounts']
    origin=account['supabaseUrl'].rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',origin):raise ValueError('Usage service origin must match existing account project')
    settings=site_source/'domain-split/usage-settings.json'
    active=read(settings) if settings.is_file() else {}
    # Activation is a separate, reviewed release after schema/write/read/owner
    # acceptance. A missing connection never becomes synthetic statistics.
    enabled=active.get('enabled') is True
    if enabled and not (active.get('acceptance_passed') is True and active.get('provider_processing_reviewed') is True):
        raise ValueError('Shared usage activation requires real acceptance and provider-processing review')
    return {'schema':1,'enabled':enabled,'source':source,'service_origin':origin,
            'allowed_origins':[EDUCATION,'https://www.madebymatt.uk'] if source=='education' else [PLAY,'https://madebymatt-play.uk'],
            'geography_enabled':False,'default_choice':'off'}


def preferences():
    return '''<details class="mbm-usage usage-choice" id="usage-statistics"><summary>Optional usage statistics</summary>
<p>Help Matt see which lessons, downloads and games are useful. This is optional and off until you allow it. We count activity events, not people or completed work.</p>
<p>When active, the shared service receives only a public resource ID, event type, site name and a one-event retry code. It receives no account information, search text, pupil work or full page URL. Location measurement is off.</p>
<div class="usage-actions"><button type="button" data-usage-choice="allow" aria-pressed="false" disabled>Allow optional statistics</button><button type="button" data-usage-choice="deny" aria-pressed="false">Keep statistics off</button></div>
<p data-usage-choice-status role="status">Shared statistics collection is not active yet.</p>
<p>Your choice is saved only for this website in this browser. Education and Play have separate choices. Turning statistics off stops future event requests; already anonymous aggregate totals cannot be linked back to you. <a href="/privacy/#shared-usage">Read the statistics privacy explanation</a>.</p></details>'''


def popularity(source='education'):
    return '''<section class="mbm-usage" data-usage-popularity="'''+source+'''" aria-labelledby="usage-popular-title">
<p class="usage-eyebrow">Activity across the community</p><h2 id="usage-popular-title">What people are opening</h2>
<p>Separate Top 10 lists, built only from real shared activity. No editorial selections or old device-local counts are included.</p>
<div class="usage-filter"><label for="usage-period">Ranking period</label><select id="usage-period" data-usage-period><option value="last30days">Last 30 UTC calendar days, including today</option><option value="alltime">All time since collection began</option></select></div>
<p class="usage-status" data-usage-measured-since>Collection is not active. Verified shared rankings are unavailable in this release.</p>
<div class="usage-grid">'''+''.join('<article class="usage-card"><h3>'+title+'</h3><div data-usage-list="'+kind+'"><p class="usage-empty">Collection is not active. Verified shared rankings are unavailable in this release.</p></div></article>' for kind,title in ([('games','Top 10 games')] if source=='play' else [('lessons','Top 10 lessons'),('packs','Top 10 lesson packs')]))+'''
</div><p>Lesson opens are recorded when a registered lesson page opens. Download requests count clicks on links to existing files, including worksheets and packs. Game launches count selected game links on the separate Play shelf. Direct game bookmarks are outside this measure. None proves a completed lesson, download or game. Repeat requests for the same item on one page are limited.</p>
<p>Only visitors who allow optional statistics contribute. These are event totals, not unique visitor counts. Public totals may be delayed or unavailable; resources continue to work.</p><p><a href="/privacy/#usage-statistics">Choose whether to contribute</a> · <a href="/stats/">About these statistics</a></p></section>'''


def shell(title, content, source='education', dashboard=False):
    origin=PLAY if source=='play' else EDUCATION
    links=('<a href="'+EDUCATION+'/">Education</a><a href="/">Play</a>' if source=='play' else '<a href="/Lessons/">Lessons</a><a href="/resources/">Resources</a><a href="/Matt-s-Apps-/">Apps &amp; tools</a>')
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="'+('noindex,nofollow' if dashboard else 'index,follow')+'"><meta name="referrer" content="no-referrer"><title>'+escape(title)+' · Made by Matt</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/usage.css"><script defer src="/assets/usage-client.js"></script>'+('<script defer src="/assets/usage-dashboard.js"></script>' if dashboard else '')+'</head><body class="usage-shell"><a class="skip" href="#main">Skip to content</a><header class="usage-shell-header"><a href="'+origin+'/"><img src="/assets/brand/micro_mark.svg" alt="">Made by Matt'+(' Play' if source=='play' else '')+'</a><nav aria-label="Learning areas">'+links+'</nav></header><main id="main">'+content+'</main><footer><a href="/privacy/">Privacy</a> · <a href="'+EDUCATION+'/owner/stats/">Owner dashboard</a></footer></body></html>\n'


def privacy_explanation():
    return '''<section class="mbm-usage" id="shared-usage"><h2>Optional shared usage statistics</h2>
<p><b>Collection is off by default.</b> The status and controls below say whether this release has an active service and whether you have allowed it. Your choice never limits access to public resources.</p>
<p>When active and allowed, the browser sends a registered public resource ID, one of three event types (lesson open, download request or game launch), the education or Play source, and a random retry code used for that event only. We do not send searches, full URLs, fragments, account details, pupil records, work, form contents or game saves. There is no advertising tracker, fingerprint, session replay or cross-domain visitor identifier.</p>
<p>The application keeps aggregate totals by resource and UTC day, plus all-time totals from the actual start date. The retry code is kept briefly to avoid counting the same event twice. It is not a visitor ID. Old browser-only counters are not imported. Public rankings use recorded totals only; the owner dashboard requires existing account sign-in and separate server-side owner authorisation.</p>
<p><b>Country and UK-region collection is off.</b> The application records no measured location. A device time zone is not treated as a measured country. No location permission is requested and no pupil location map is made.</p>
<p>When the shared service is active, requests go to the existing Supabase provider. Normal network processing exposes the connecting IP address to that provider, and its operational logs may retain connection metadata. The usage database stores neither raw IP addresses nor browser fingerprints. Provider logging, retention and access must be reviewed before collection is activated; calling a feature “cookieless” does not remove that responsibility.</p>
<p>You can freely refuse or turn off future events below. A browser Global Privacy Control or Do Not Track signal also keeps optional event collection off. The preference is stored on this origin only; it is not carried to the separate Play domain. Already aggregated activity cannot be traced back to one person for removal. Reading public totals contacts the shared service but does not create an activity event.</p>
<p>Older device-local activity totals, where retained, stay in this browser. They are not site-wide counts and any old time-zone labels are estimates, not measured locations.</p>
<p>Reviewed 6 September 2026 against the <a href="https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/">ICO storage and access guidance</a> and <a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/10-geolocation/">Children’s Code geolocation guidance</a>. Optional collection remains subject to the actual deployment and provider review.</p></section>'''


def assets(target, site_source, source, rows):
    for filename in ['usage-client.js','usage.css','usage-dashboard.js']:
        path=target/'assets'/filename;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes((HERE/filename).read_bytes())
    save(target/'data/usage-config.json',config(site_source,source));save(target/'data/usage-registry.json',rows)


class DocumentEnds(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False); self.positions=defaultdict(list)
        self.offsets=[0]
        for line in text.splitlines(keepends=True): self.offsets.append(self.offsets[-1]+len(line))
    def handle_endtag(self, tag):
        if tag in {'head','body'}:
            line,column=self.getpos(); self.positions[tag].append(self.offsets[line-1]+column)


def insert_before_document_end(text, tag, fragment):
    parser=DocumentEnds(text);parser.feed(text);positions=parser.positions[tag]
    if len(positions)!=1: raise ValueError('Usage adapter requires one real document '+tag+' closing tag')
    offset=positions[0];return text[:offset]+fragment+text[offset:]


def inject(path, choice=False, popularity_block=False):
    text=path.read_text()
    if 'src="/assets/usage-client.js"' in text:return
    if '</head>' not in text or '</body>' not in text:raise ValueError('Usage adapter needs an HTML shell: '+str(path))
    text=insert_before_document_end(text,'head','<link rel="stylesheet" href="/assets/usage.css"><script defer src="/assets/usage-client.js"></script>')
    addition=(popularity() if popularity_block else '')+(preferences() if choice else '')
    if addition: text=insert_before_document_end(text,'body',addition)
    path.write_text(text)


def account_adapter(path):
    text=path.read_text()
    if 'readUsageDashboard:' in text:raise ValueError('Account usage adapter already present')
    method='''  function readUsageDashboard(source) {
    if (source !== 'education' && source !== 'play') return Promise.reject(new Error('Invalid usage source.'));
    return requireUser().then(function () {
      // Only the server can approve owner access. No token, client or private
      // response is exposed through account snapshots or custom storage.
      return sb.functions.invoke('owner-usage?source=' + source, { method: 'GET' });
    }).then(function (r) {
      if (r.error) throw new Error('Owner statistics are unavailable or access was denied.');
      return r.data;
    });
  }

'''
    text=replace_once(text,'  function unsubscribeMailing() {',method+'  function unsubscribeMailing() {')
    text=replace_once(text,'    unsubscribeMailing: unsubscribeMailing,','    unsubscribeMailing: unsubscribeMailing,\n    readUsageDashboard: readUsageDashboard,')
    path.write_text(text)


def teaching_download_pages(output, lessons, site_source, rows):
    """Only metadata-backed teaching hubs and explicit companion resources.

    A working download anchor is required. The register/app/account surfaces
    cannot acquire analytics merely by linking an export or help document.
    """
    candidates=set()
    for row in read(site_source/'data/mbm-search-index.json')['entries']:
        if row.get('category') in {'resource','page'} and not row.get('external'):
            candidates.add(row['route'])
    for row in read(lessons/'resources.json'):
        if row.get('type') in {'hub','teacher','support'} and row.get('file'):
            candidates.add('/Lessons/'+row['file'])
    candidates.add('/Lessons/primary/')
    # These authored companion pages support the current Science periods;
    # their own copy explicitly says they do not add another lesson.
    for pattern in ['Science_Teesside/Grow/resources/GS_W[3-7][AB].html',
                    'Science_Teesside/Launch/resources/W[3-7]L[1-3].html']:
        candidates.update('/Lessons/'+p.relative_to(lessons).as_posix() for p in lessons.glob(pattern))
    downloads={canonical(r['route']) for r in rows if r['source']=='education' and 'download_request' in r['event_types']}
    approved=[]
    for route in sorted(candidates):
        parsed=urlparse(urljoin(EDUCATION+'/',route));path=parsed.path
        if parsed.hostname not in EDUCATION_HOSTS or path.startswith(('/Matt-s-Apps-/','/account/','/members/','/asdan/','/uas-register/','/owner/')):
            continue
        if re.search(r'(?:^|/)(?:register|registers|markbook|accounts?)(?:/|[._-]|$)',path,re.I):continue
        target=local_file(output,route)
        if not target or not target.is_file() or target.suffix.lower()!='.html':continue
        text=target.read_text()
        if 'data-game-moved' in text:continue
        parser=Links();parser.feed(text)
        hits=[]
        for link in parser.rows:
            value=urlparse(urljoin(EDUCATION+path,link['href']))
            if value.hostname in EDUCATION_HOSTS and canonical(value.path) in downloads:hits.append(canonical(value.path))
        if hits:approved.append({'route':path,'downloads':sorted(set(hits))})
    return approved


def refresh_play(output, lessons, site_source):
    output=Path(output);site_source=Path(site_source);target=output/'games'
    rows=registry(output,Path(lessons),site_source,play_only=True);assets(target,site_source,'play',rows)
    for route in ['index.html','games/index.html','main/index.html','for/pupils/index.html','Games/index.html','Lessons/index.html']:
        path=target/route
        if path.is_file():inject(path,choice=True)
    path=target/'privacy/index.html'
    if path.is_file():
        text=path.read_text();text=replace_once(text,'This migration adds no account registration or analytics.', 'This migration adds no account registration. Optional usage statistics are described below.')
        text=replace_once(text,'<html lang="en-GB"><meta','<html lang="en-GB"><head><meta')
        text=replace_once(text,'<main>','</head><body><main>');text=replace_once(text,'</html>','</body></html>')
        # Fail if an old blanket denial survives; do not silently contradict it.
        if re.search(r'adds no analytics',text,re.I):raise ValueError('Review changed Games analytics privacy anchor')
        text=replace_once(text,'</body>',privacy_explanation()+preferences()+'</body>');path.write_text(text);inject(path)
    (target/'stats').mkdir(exist_ok=True);(target/'stats/index.html').write_text(shell('Shared usage statistics',popularity('play')+preferences(),'play'))
    save(output/'usage-play-build-report.json',{'schema':1,'registered_games':len(rows),'collection_enabled':config(site_source,'play')['enabled'],'game_payloads_modified':0})
    return rows


def refresh(output, lessons, apps, site_source):
    output=Path(output);lessons=Path(lessons);site_source=Path(site_source);site=output/'education-site'
    rows=registry(output,lessons,site_source);assets(site,site_source,'education',[row for row in rows if row['source']=='education'])
    # Stop painting legacy local counters as if they were shared activity. Their
    # stored data remains in place, and the old device view stays reachable.
    site_config=read(site/'site.json');site_config['features']['stats'].update({'enabled':False,'remote':False,'geo':False});site_config['features']['downloads']['enabled']=False
    site_config['strap']='Lessons, resources and teaching tools — built in Teesside.'
    game_keys={row.get('countKey') for row in read(site_source/'site.json')['doors'] if row.get('zone')=='games'}
    site_config['features']['downloads']['catalog']=[row for row in site_config['features']['downloads'].get('catalog',[]) if row.get('key') not in game_keys]
    site_config['features']['analytics']['goatcounter']='';save(site/'site.json',site_config)
    old=site/'stats/index.html'
    if old.is_file():
        legacy=old.read_text();legacy=replace_once(legacy,'<head>','<head><base href="/stats/">')
        # Keep the original asset base, but bind navigation/identity to the
        # generated device page. A bare fragment otherwise leaves this page.
        legacy=replace_once(legacy,'<a class="skip" href="#main">','<a class="skip" href="/stats/on-this-device/#main">')
        legacy=replace_once(legacy,'<link rel="canonical" href="https://madebymatt.uk/stats/">','<link rel="canonical" href="https://madebymatt.uk/stats/on-this-device/">')
        legacy=replace_once(legacy,'<meta property="og:url" content="https://madebymatt.uk/stats/">','<meta property="og:url" content="https://madebymatt.uk/stats/on-this-device/">')
        legacy=legacy.replace('<a href="/games/">Games</a>', '<a href="'+PLAY+'/">Made by Matt Play</a>').replace('Interactive lessons, simulations and games', 'Lessons, learning resources and teaching tools').replace('Opens & plays here', 'Learning resources opened here')
        legacy=legacy.replace('Countries seen here','Time-zone country estimates here').replace('Country activity on this device','Legacy time-zone estimates on this device')
        legacy=replace_once(legacy,'<main id="main">','<main id="main"><p class="usage-note">Legacy device-only counts. These are not shared site statistics. Time-zone estimates are not measured locations. <a href="/stats/">Open shared usage statistics</a>.</p>')
        destination=site/'stats/on-this-device/index.html';destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(legacy)
    (site/'stats').mkdir(exist_ok=True)
    (site/'stats/index.html').write_text(shell('Shared usage statistics',popularity()+preferences()+'<p class="mbm-usage"><a href="/stats/on-this-device/">View legacy counts stored on this device</a></p>'))
    owner='''<section class="mbm-usage" data-usage-owner><p class="usage-eyebrow">Private owner area</p><h1>How Made by Matt is being used</h1><p>Aggregate activity, resource popularity and collection status. Existing sign-in is required; the service also checks that this account is authorised as the owner.</p><p><a href="/account/">Open your existing account sign-in</a></p><div class="usage-filter"><label for="owner-source">Website</label><select id="owner-source" data-owner-source><option value="education">Education</option><option value="play">Made by Matt Play</option></select><label for="owner-period">Period</label><select id="owner-period" data-owner-period><option value="last30days">Last 30 UTC calendar days</option><option value="alltime">All time</option></select></div><div class="usage-actions"><button type="button" data-owner-load disabled>Load owner dashboard</button><button type="button" data-owner-export disabled>Export these aggregate totals</button></div><p class="usage-status" data-owner-status role="status">Shared collection and the owner dashboard are not active yet.</p><div data-owner-content hidden></div></section>'''
    owner_path=site/'owner/stats/index.html';owner_path.parent.mkdir(parents=True,exist_ok=True);owner_path.write_text(shell('Owner usage dashboard',owner,dashboard=True));account_adapter(site/'assets/mbm-account.js')
    privacy=site/'privacy/index.html';text=privacy.read_text()
    before='<tr><td><b>Use the local visit and open counters</b></td><td>Counts stay in this browser; the coarse country is derived on-device from the time zone</td><td><b>No remote counter service while remote counters are disabled</b></td></tr>'
    after='<tr><td><b>Choose optional shared usage statistics</b></td><td>When active and allowed: public resource ID, event type, site source and one-event retry code; location measurement is off</td><td><b>Existing Supabase service; no event request while collection is inactive or refused</b></td></tr>'
    text=replace_once(text,before,after);text=replace_once(text,'</main>',privacy_explanation()+preferences()+'</main>');privacy.write_text(text);inject(privacy)
    # Only discovery shells and registered lesson destinations receive the
    # adapter. No app editor, pupil register, save payload or download is edited.
    hubs=[site/'index.html',site/'main/index.html',site/'resources/index.html',site/'tools/index.html',output/'education-lessons/index.html',output/'education-apps/index.html']
    hubs+=list((site/'for').rglob('index.html'))
    hubs+=[site/'primary/index.html',output/'education-lessons/primary/index.html']
    for path in dict.fromkeys(hubs):
        if path.is_file():inject(path,choice=True)
    lesson_pages=set()
    for row in rows:
        if row['source']=='education' and 'lesson_open' in row['event_types']:
            path=local_file(output,row['route']);
            if path.suffix.lower()=='.html':inject(path);lesson_pages.add(str(path.relative_to(output)))
    download_pages=teaching_download_pages(output,lessons,site_source,rows)
    additional_download_pages=[]
    for entry in download_pages:
        path=local_file(output,entry['route'])
        if 'src="/assets/usage-client.js"' not in path.read_text():
            inject(path);additional_download_pages.append(entry)
    # Add one small entrance to real popularity from both education homepages.
    for path in [site/'index.html',site/'main/index.html']:
        text=path.read_text();text=replace_once(text,'</body>','<p class="mbm-usage"><a href="/stats/">Shared activity · Top 10 lessons and packs</a></p></body>');path.write_text(text)
    save(output/'usage-registry.json',rows)
    report={'schema':1,'collection_enabled':config(site_source,'education')['enabled'],'registered_resources':len(rows),'lesson_adapters':len(lesson_pages),
            'events':{kind:sum(kind in row['event_types'] for row in rows) for kind in ['lesson_open','download_request','game_launch']},
            'raw_source_payloads_modified':0,'download_payloads_modified':0,'geography':'not_collected','lesson_routes':sorted(lesson_pages),'download_adapter_routes':additional_download_pages}
    save(output/'usage-build-report.json',report)
    return report
