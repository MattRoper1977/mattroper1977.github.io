#!/usr/bin/env python3
"""Read-only call-site census; no browser or pupil storage is opened."""
import argparse, collections, gzip, hashlib, importlib.util, json, os, re, subprocess, sys, tempfile
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote,urlparse
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('as1_maker_source',ROOT/'tools/render_maker_splash.py');maker=importlib.util.module_from_spec(spec);sys.modules[spec.name]=maker;spec.loader.exec_module(maker)
MAKER_SCRIPT=maker.JS.strip()
GAME_OWNERS=set()
for game in json.loads((ROOT/'data/source-manifests/games.json').read_text())['games']:
    route=unquote(urlparse(game['href']).path)
    if route.endswith('/'):route+='index.html'
    GAME_OWNERS.add(('Lessons:'+route[len('/Lessons/'):]) if route.startswith('/Lessons/') else ('Site:'+route.lstrip('/')))
GAME_OWNERS.add('Site:assets/arcade/rally-hooks.js') # This order's single-pilot adapter; not a shared estate hook.

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False); self.rows=[]; self.current=None; self.index=0; self.external=[]
    def handle_starttag(self,tag,attrs):
        if tag!='script':return
        attrs=dict(attrs); kind=attrs.get('type','').lower()
        if kind not in ('','text/javascript','application/javascript','module'):return
        self.index+=1
        if attrs.get('src'):self.external.append(attrs['src']);return
        self.current={'source':'script-'+str(self.index),'text':'','module':kind=='module','htmlLine':self.getpos()[0]}
    def handle_data(self,data):
        if self.current is not None:self.current['text']+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.current is not None:self.rows.append(self.current);self.current=None

def pilot_hook_range(repo,rel,text):
    if repo!='Site' or rel!='rallyvector3d/index.html':return None
    begin='/* MBM-AS1-HOOKS:BEGIN */';end='/* MBM-AS1-HOOKS:END */'
    if text.count(begin)!=1 or text.count(end)!=1:return None
    content=text.split(begin,1)[1].split(end,1)[0]
    hook=ROOT/'assets/arcade/rally-hooks.js'
    if not hook.is_file() or content.strip()!=hook.read_text().strip():return None
    return [text[:text.index(begin)].count('\n')+1,text[:text.index(end)].count('\n')+1]

# Exact reviewed fixture call sites. A changed blob is reviewed again; a path or
# key-name pattern never exempts future source bytes from runtime ownership.
TOOLING_USE_SITES = json.loads(r'''[{"repository":"Site","path":"domain-split/play/check.cjs","git_blob":"f549c76d9ade177bf66ab86311c1f4e023da9d11","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"fracture/tools/gate_splash.mjs","git_blob":"7e8ad8028964db71ca7bd706badeeb8cc0bae487","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/play/check-save-ui.cjs","git_blob":"1cff4989e33b64c2202ee8b5bf6e8ca2909bce3f","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/check_stub_handoff_live.cjs","git_blob":"b04450f36e895ef0b07121b16792aeb781d0060c","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/check_glitch_live.cjs","git_blob":"49f0476e58ed73e873f3796c31dc85c78686102e","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Lessons","path":"_eca1/tools/guideassert.js","git_blob":"e7c17f9382a6bd39ffb8aebf5455c4a1510e8e30","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Lessons","path":"_passpq/tools/l2k_partb_gate.mjs","git_blob":"31faa2a40f7cd679fa490c9d39156f8aa86cf653","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"neonturf/tools/harness_turf.mjs","git_blob":"6b9d5228117ff7cac115fb32a7157718521d7131","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/p5_polish.mjs","git_blob":"9a766e322b6f3bf41490a727c27f76daa7905149","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"fracture/tools/audit_fracture.mjs","git_blob":"b0bc38f7f67b094429803ad4ecc5e678454fd46f","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"fracture/tools/harness_fracture.mjs","git_blob":"2b1edef5fd3af260c3198b1a94752b95837b6bda","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/p4_duel.mjs","git_blob":"e1f1c1d2828ce9c2209f08a6705e57d7234f1809","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/p3_reduced.mjs","git_blob":"9039b38676bda73c110ba5540e39ea21e5255996","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/p3_shots.mjs","git_blob":"441573d6e8e46c288831216957f0485f7558dd78","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/p6_regression.mjs","git_blob":"a9bab1485800cc0c551e70d2252c13d426be718e","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"_tfr2/tools/rep_harness.mjs","git_blob":"68b4e32b09d3ffb5bec08c08a681c7a5d5eef1ba","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/check_usage_discovery.cjs","git_blob":"99b4a3478bf70a4087b08e9d8d7057b601e88f72","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/check_stub_handoff_browser.cjs","git_blob":"42c1ea1cffda103c6d1dc45a15dbc87064b0543d","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."},{"repository":"Site","path":"domain-split/check_primary_discovery.cjs","git_blob":"c11a8dccb6cf98a6d1b38080690cce5af01016b5","reason":"Read: Node/Playwright harness; storage calls prepare or inspect an isolated browser fixture, not an independent shipped surface."}]''')
TOOLING_BY_SOURCE = {(row['repository'], row['path']):row for row in TOOLING_USE_SITES}

def purpose(path, repo=None, raw=None):
    reviewed=TOOLING_BY_SOURCE.get((repo,path))
    if reviewed and raw is not None:
        blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
        if blob == reviewed['git_blob']: return 'reviewed-browser-test-fixture'
    parts=Path(path).parts
    if parts[0] in ('tools','tests','test','docs','reports','audit-output','.github') or any(x in ('node_modules','vendor') for x in parts):return 'tooling-reference-or-vendor'
    return 'browser-source-candidate'
def inputs(repo,root):
    files=subprocess.check_output(['git','-C',str(root),'ls-files','-z']).decode().split('\0')
    for rel in files:
        if not rel.endswith(('.html','.htm','.js','.mjs','.cjs')):continue
        raw=(root/rel).read_bytes(); text=raw.decode('utf-8',errors='replace')
        # Only select files here; all classifications below come from AST call sites.
        if not re.search(r'getItem|setItem|removeItem|localStorage|sessionStorage|indexedDB|caches\.',text):continue
        if rel.endswith(('.html','.htm')):
            parser=Scripts();parser.feed(text);scripts=parser.rows;external=parser.external
        else:scripts=[{'source':rel,'text':text,'module':rel.endswith('.mjs') or bool(re.search(r'^\s*(?:export|import)\b',text,re.M)),'htmlLine':1}];external=[]
        yield {'repository':repo,'path':rel,'purpose':purpose(rel,repo,raw),'sha256':hashlib.sha256(raw).hexdigest(),'scripts':scripts,'externalScripts':external,
               'otherStorageSyntax':{'indexedDB':bool(re.search(r'\bindexedDB\b',text)),'cacheStorage':bool(re.search(r'\bcaches\.',text))},
               'lineOffsets':{s['source']:s['htmlLine']-1 for s in scripts},'verifiedMakerScripts':[s['source'] for s in scripts if s['text'].strip()==MAKER_SCRIPT],'verifiedPilotHookRange':pilot_hook_range(repo,rel,text)}

def write_outputs(result,output):
    evidence=ROOT/'docs/reference/AS1_STORAGE_CENSUS.json.gz'
    evidence.parent.mkdir(parents=True,exist_ok=True)
    full=json.dumps(result,ensure_ascii=False,separators=(',',':')).encode()
    evidence.write_bytes(gzip.compress(full,mtime=0))
    registry={k:result[k] for k in ('schema','scope','heads','rules','counts','entries','multiOwnerWrittenKeys','unprefixedCollisionReviewKeys','legacyNamespacedKeys','limitations')}
    registry['callSiteEvidence']={'path':'docs/reference/AS1_STORAGE_CENSUS.json.gz','sha256':hashlib.sha256(evidence.read_bytes()).hexdigest(),'format':'gzip JSON; separate reads/writes, unresolved calls, source hashes, scope warnings, non-runtime use sites'}
    output.parent.mkdir(parents=True,exist_ok=True)
    # One entry per line keeps source ownership reviewable without duplicating the full census.
    rendered=[]
    for key,value in registry.items():
        if key=='entries':body='[\n'+',\n'.join(json.dumps(x,ensure_ascii=False,separators=(',',':')) for x in value)+'\n]'
        else:body=json.dumps(value,ensure_ascii=False,separators=(',',':'))
        rendered.append(json.dumps(key)+':'+body)
    output.write_text('{\n'+',\n'.join(rendered)+'\n}\n')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--lessons',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'data/as1-storage-registry.json');a=p.parse_args()
    roots={'Site':ROOT,'Lessons':a.lessons.resolve()};heads={k:subprocess.check_output(['git','-C',str(v),'rev-parse','HEAD'],text=True).strip() for k,v in roots.items()}
    with tempfile.TemporaryDirectory(prefix='as1-storage-') as td:
        inp=Path(td)/'input.jsonl';out=Path(td)/'output.jsonl'
        with inp.open('w') as f:
            for repo,root in roots.items():
                for row in inputs(repo,root):f.write(json.dumps(row,ensure_ascii=False)+'\n')
        with inp.open() as f,out.open('w') as g:subprocess.run(['node',str(ROOT/'tools/as1/storage-analyse.cjs')],stdin=f,stdout=g,check=True,timeout=900)
        measured=[json.loads(x) for x in out.read_text().splitlines()]
    entries={};unresolved=[];issues=[];reads=[];writes=[];clears=[];nonRuntime=[];other=[]
    for row in measured:
        origin={'repository':row['repository'],'path':row['path']}; runtime=row['purpose']=='browser-source-candidate'
        for issue in row['parseOrScopeIssues']:
            if runtime:issues.append({**origin,**issue})
        if runtime and any(row['otherStorageSyntax'].values()):other.append({**origin,**row['otherStorageSyntax']})
        for obs in row['observations']:
            obs={**origin,**obs,'line':obs['line']+row['lineOffsets'].get(obs['source'],0)}
            if not runtime:nonRuntime.append(obs);continue
            if obs['operation']=='clear' and obs.get('storage'):clears.append(obs);continue
            if obs['key'] is None:unresolved.append(obs);continue
            (reads if obs['operation']=='getItem' else writes).append(obs)
            source_owner=row['repository']+':'+row['path'];owner=source_owner
            if obs['key']=='mbm_splash_last' and obs['source'] in row['verifiedMakerScripts']:owner='component:canonical-maker-splash'
            if obs['key']=='mbm_reading_theme' and source_owner in ('Site:theme.js','Lessons:assets/mbm-theme.js','Site:main/index.html'):owner='component:reading-theme'
            if obs['key'] in ('mbm_users','mbm_session') and source_owner in ('Site:assets/mbm-account.js','Site:assets/mbm-features.js'):owner='component:legacy-account'
            hook_range=row.get('verifiedPilotHookRange')
            if source_owner=='Site:assets/arcade/rally-hooks.js' or (hook_range and hook_range[0]<obs['line']<hook_range[1]):owner='game:rallyvector3d-hooks'
            identity=(obs['storage'],obs['key'],owner)
            if identity not in entries:
                entries[identity]={'storage':obs['storage'],'key':obs['key'],'owner':owner,'scope':'per-game' if owner in GAME_OWNERS or owner.startswith('game:') else 'cross-surface' if owner.startswith('component:') or not row['path'].endswith(('.html','.htm')) else 'per-surface','survivesProfileWipe':None,'profileWipeEvidence':'MEASUREMENT INVALID: no common estate wipe semantics or firing control established','reads':[],'writes':[]}
            entries[identity]['reads' if obs['operation']=='getItem' else 'writes'].append({**{k:obs[k] for k in ('source','line','operation','expression')},'sourceOwner':source_owner})
    vals=sorted(entries.values(),key=lambda x:(x['storage'],x['key'],x['owner']))
    keys=sorted(set(x['key'] for x in vals)); multi={}
    for item in vals:
        if item['writes']:multi.setdefault(item['storage']+':'+item['key'],[]).append(item['owner'])
    multi={k:sorted(set(v)) for k,v in multi.items() if len(set(v))>1}
    prefixed=[k for k in keys if k.startswith('mbm_')]
    legacy_namespaced=[k for k in keys if k not in prefixed and re.match(r'^(?:mbm[.:-]|madebymatt[._:-])',k,re.I)]
    collisions=[k for k in keys if k not in prefixed]
    result={'schema':1,'scope':'Baseline heads identify the checked-out branch; sourceFiles hashes identify actual bytes read. All tracked HTML/JavaScript browser-source candidates across Site and Lessons; source census, not proof every path is published. Tools, tests, documentation, reports and vendored libraries are separately inventoried and excluded by use site.','heads':heads,
       'rules':{'reviewedToolingUseSites':TOOLING_USE_SITES,'writes':'First argument of resolved localStorage/sessionStorage setItem or removeItem call; never matching key names or values.','reads':'First argument of resolved getItem call, separate from writes.','owners':'Source file owner, except canonical maker-splash script equality and three explicitly reviewed reading-theme sources plus two legacy-account sources. Those use sites belong to named components. The Rally hook source and its exactly matching marked inline region have one game owner. Independent game whole-container writers remain distinct owners.','prefix':'Strict mbm_ prefix, case-sensitive. Legacy estate namespaces are listed separately and never folded into this count.','profileWipe':'null means unmeasured; no common estate reset contract inferred.','survival':'Neither this tool nor the registry reads or writes pupil data.'},
       'counts':{'sourceFilesScanned':len(measured),'runtimeCandidateFiles':sum(r['purpose']=='browser-source-candidate' for r in measured),'distinctResolvedKeyStrings':len(keys),'distinctStorageAndKeyPairs':len(set((x['storage'],x['key']) for x in vals)),'prefixed':len(prefixed),'legacyNamespaced':len(legacy_namespaced),'resolvedReadCalls':len(reads),'resolvedWriteOrRemoveCalls':len(writes),'unresolvedCalls':len(unresolved),'parseOrScopeIssues':len(issues),'multiOwnerWrittenKeys':len(multi),'otherStorageSyntaxFiles':len(other),'nonRuntimeObservations':len(nonRuntime)},
       'sourceFiles':[{k:r[k] for k in ('repository','path','purpose','sha256')} for r in measured],
       'legacyNamespacedKeys':legacy_namespaced,'entries':vals,'reads':reads,'writes':writes,'multiOwnerWrittenKeys':multi,'unprefixedCollisionReviewKeys':collisions,'unresolved':unresolved,'parseOrScopeIssues':issues,'wholeStorageClears':clears,'otherStorageSyntax':other,'nonRuntimeObservations':nonRuntime,
       'limitations':['Resolved counts are lower bounds; unresolved receivers, dynamic keys and syntax failures are explicit residue.','IndexedDB, CacheStorage and property-style storage access are not resolved by this call-site census. These APIs require separate schema review.','A source owner is not an assertion that two source paths are deployed to the same origin. Shared and historical copies need publication review before any rename proposal.','Unprefixed keys are a conservative third-party collision review list, not evidence that a third-party script presently claims them.']}
    write_outputs(result,a.output);print(json.dumps(result['counts'],indent=2));print('MULTI_OWNER_KEYS '+', '.join(multi))
if __name__=='__main__':main()
