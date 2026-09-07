#!/usr/bin/env python3
"""Route-keyed HC3 inventory of actual publication sources; never grants transfer keys."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
from urllib.parse import unquote, urljoin, urlparse
ROOT = Path(__file__).resolve().parents[1]

def verify_payload(source_text, published_text, config, route):
    if published_text != source_text.replace(config['source_origin'], config['games_origin']):
        raise ValueError('Built/source mismatch: '+route)

def built_control():
    config={'source_origin':'https://madebymatt.uk','games_origin':'https://madebymatt-play.uk'}
    source='<a href="https://madebymatt.uk/">First party</a>'
    published=source.replace(config['source_origin'],config['games_origin'])
    verify_payload(source,published,config,'/fixture/')
    try:verify_payload(source,published+'<!-- planted byte -->',config,'/fixture/')
    except ValueError:pass
    else:raise AssertionError('Built-tree control failed to reject changed payload')
    verify_payload(source,published,config,'/fixture/')
    print('PASS: real built bytes, planted mismatch rejected, restored built bytes')

def source_identity(owner, repository, relative, head=None):
    owner=Path(owner)
    commit=head or subprocess.check_output(['git','-C',str(owner),'rev-parse','HEAD'],text=True).strip()
    blob=subprocess.check_output(['git','-C',str(owner),'rev-parse',commit+':'+relative],text=True).strip()
    committed=subprocess.check_output(['git','-C',str(owner),'show',commit+':'+relative])
    current=(owner/relative).read_bytes()
    if current != committed:
        raise ValueError('Source bytes not at declared commit: '+repository+'/'+relative+' @ '+commit)
    return {'repository':repository,'commit':commit,'path':relative,'gitBlobId':blob,
            'rawByteCount':len(current),'sha256':hashlib.sha256(current).hexdigest()}


def identity_control():
    import tempfile
    with tempfile.TemporaryDirectory(prefix='hc3-inventory-identity-') as temp:
        root=Path(temp);file=root/'game.html';original=b'<html><h1>Fixture</h1></html>'
        file.write_bytes(original)
        subprocess.run(['git','init','--quiet',str(root)],check=True)
        subprocess.run(['git','-C',str(root),'add','game.html'],check=True)
        subprocess.run(['git','-C',str(root),'-c','user.name=HC3 fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Source identity control'],check=True)
        real=source_identity(root,'Fixture','game.html')
        assert real['rawByteCount']==len(original) and real['sha256']==hashlib.sha256(original).hexdigest()
        file.write_bytes(original+b'<!-- planted source change -->')
        try:source_identity(root,'Fixture','game.html',real['commit'])
        except ValueError:pass
        else:raise AssertionError('An uncommitted source was falsely attributed to a commit')
        file.write_bytes(original)
        assert source_identity(root,'Fixture','game.html')==real
    print('PASS: actual source identity, planted uncommitted mismatch rejected, restored identity')

class Scripts(HTMLParser):
    def __init__(self, source, owner, issues, route, built):
        super().__init__(convert_charrefs=False)
        self.source,self.owner,self.issues=source,owner,issues
        self.route,self.built=route,built
        self.scripts=[];self.active=None;self.index=0
    def handle_starttag(self, tag, attrs):
        if tag!='script':return
        attrs=dict(attrs);kind=attrs.get('type','').lower()
        if kind not in ('','text/javascript','application/javascript','module'):return
        self.index+=1
        if attrs.get('src'):
            src=attrs['src'];url=urlparse(urljoin('https://madebymatt-play.uk'+self.route,src))
            if url.netloc not in ('madebymatt-play.uk','www.madebymatt-play.uk'):
                self.issues.append({'reference':src,'reason':'external script not read'});return
            target=(self.built/unquote(url.path).lstrip('/')).resolve()
            if not target.is_relative_to(self.built.resolve()) or not target.is_file():
                self.issues.append({'reference':src,'reason':'script source unavailable'});return
            self.scripts.append({'source':'published:'+unquote(url.path),'text':target.read_text(),'module':kind=='module'});return
        self.active={'source':self.route+'#script-'+str(self.index),'text':'','module':kind=='module','htmlLine':self.getpos()[0]}
    def handle_data(self,data):
        if self.active is not None:self.active['text']+=data
    def handle_endtag(self,tag):
        if tag=='script' and self.active is not None:self.scripts.append(self.active);self.active=None

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--lessons',type=Path);p.add_argument('--built',type=Path);p.add_argument('--output',type=Path);p.add_argument('--self-test',action='store_true');a=p.parse_args()
    if a.self_test:subprocess.run(['node',str(ROOT/'tools/hc3-inventory/analyse.cjs'),'--self-test'],check=True);built_control();identity_control();return
    if not (a.lessons and a.built and a.output):p.error('--lessons, --built and --output are required')
    census=json.loads((ROOT/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    rules=json.loads((ROOT/'domain-split/game-storage-allowlist.json').read_text());allowed=set(rules['localStorageExactKeys'])
    config=json.loads((ROOT/'domain-split/config.json').read_text())
    heads={name:subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip() for name,root in [('Site',ROOT),('Lessons',a.lessons)]}
    routes={};parse_inputs=[];duals={'/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html','/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html'}
    for row in census:
        route=unquote(urlparse(row['normalizedDecodedRoute']).path);source=row['source'];owner=ROOT if source['repository']=='Site' else a.lessons
        f=owner/source['path'];text=f.read_text();target=a.built/route.lstrip('/')
        if route.endswith('/'):target/='index.html'
        if not target.is_file():raise ValueError('Missing built route: '+route)
        built=target.read_text();verify_payload(text,built,config,route)
        issues=[];parser=Scripts(f,owner,issues,route,a.built);parser.feed(text);parse_inputs.append({'route':route,'scripts':parser.scripts})
        families=[x for x in rules['localStorageDynamicFamilies'] if x.get('path')==source['path'] and source['repository']=='Site']
        routes[route]={'source':source_identity(owner,source['repository'],source['path'],heads[source['repository']]),'censusSource':source,'sourceSha256':hashlib.sha256(f.read_bytes()).hexdigest(),'publishedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
            'migrationCandidate':route not in duals,'scriptSourceIssues':issues,
            'reviewedDynamicFamilies':families,'ownershipStatus':'MEASURED_CANDIDATES_REQUIRE_CALL_SITE_REVIEW',
            'userSaveBytes':None,'userSaveBytesReason':'No pupil storage was read; typical save size cannot be inferred from source.'}
    parsed=json.loads(subprocess.check_output(['node',str(ROOT/'tools/hc3-inventory/analyse.cjs')],input=json.dumps(parse_inputs),text=True,timeout=180))
    for row in parsed:
        target=routes[row.pop('route')];target.update(row)
        resolved=sorted({x['key'] for x in row['observations'] if x['key'] is not None})
        target.update(resolvedCandidates=resolved,allowlistedCandidates=[k for k in resolved if k in allowed],notAllowlistedCandidates=[k for k in resolved if k not in allowed])
    result={'schema':2,'scope':'Canonical publication rows and migration candidates. Static evidence only; not a transfer permission registry.',
        'sourceHeads':heads,
        'identityConvention':'source is the exact committed source measured; censusSource is historical route-selector metadata, never current proof.',
        'censusSha256':hashlib.sha256((ROOT/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_bytes()).hexdigest(),
        'allowlistSha256':hashlib.sha256((ROOT/'domain-split/game-storage-allowlist.json').read_bytes()).hexdigest(),
        'lineConvention':'Observation lines are local to the named script; script-N identifies its HTML script element in document order.',
        'limitations':['Mutable bindings, dynamic receivers, unsupported syntax and keys remain unresolved.','Bounded wrapper traversal is static evidence, not complete control-flow analysis.','Shared runtime literals do not establish page ownership.','IndexedDB, profile subtrees and native import schemas require the accompanying reviewed registry.'],
        'counts':{'routes':len(routes),'migrationCandidates':sum(x['migrationCandidate'] for x in routes.values()),'routesWithUnresolved':sum(bool(x['unresolved']) for x in routes.values())},'routes':routes}
    assert result['counts']['routes']==69 and result['counts']['migrationCandidates']==67
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['counts']))


if __name__=='__main__':main()
