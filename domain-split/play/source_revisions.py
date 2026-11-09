"""Exact reviewed source/blob evidence; no acceptance based on measured output alone."""
try:
    from .route_renames import preserved as project_preserved
except ImportError:
    try:
        from route_renames import preserved as project_preserved
    except ImportError:
        # Loaded by file path (tools/as1/source-revision-controls.py): read the sibling module the same way.
        import importlib.util as _ilu, pathlib as _pl
        _spec = _ilu.spec_from_file_location('route_renames', _pl.Path(__file__).with_name('route_renames.py'))
        _mod = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_mod)
        project_preserved = _mod.preserved
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[1]

def capture_revision_for(head, request):
    """Only the frozen capture-workflow source may be replaced by its request.

    A Games release's caller-selected current/future source must stay exact.
    """
    if not isinstance(request,dict) or not request.get('lessons_commit'):return head
    for field in ('lessons_commit','review_lessons_commit'):
        if not re.fullmatch('[0-9a-f]{40}',request.get(field,'')):
            raise ValueError('Capture requires a full '+field+' SHA')
    return request['lessons_commit'] if head==request['review_lessons_commit'] else head

def review_lessons(output=None):
    """Find the checkout matching the BUILT source, never a different request."""
    request=json.loads((HERE/'capture-request.json').read_text())
    candidates=[]
    if isinstance(request,dict) and request.get('lessons_commit'):
        commit=request['lessons_commit']
        if not re.fullmatch('[0-9a-f]{40}',commit):raise ValueError('Invalid capture Lessons SHA')
        candidates.append(SITE/'.play-review'/('capture-lessons-'+commit))
    candidates += [SITE/'.sources/Lessons', SITE.parent/'Lessons']
    wanted=json.loads((Path(output)/'build-report.json').read_text())['source_heads']['Lessons'] if output else None
    for checkout in candidates:
        if checkout.is_dir() and (wanted is None or git(checkout,'rev-parse','HEAD')==wanted):return checkout
    raise ValueError('No Lessons checkout matches the built source: '+str(wanted))

def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()

def sha(data):
    return hashlib.sha256(data).hexdigest()

def registry():
    data=json.loads((HERE/'source-revisions.json').read_text())
    if data.get('schema') != 1: raise ValueError('Unsupported source revision registry')
    evidence=json.loads((HERE/'evidence.json').read_text())['games']
    preservation={p['path']:p for p in json.loads((SITE/'reports/play-upgrade/preservation.json').read_text())['payloads']}
    for path,spec in data['payloads'].items():
        revisions=spec['revisions']
        if not revisions or len({r['id'] for r in revisions}) != len(revisions):raise ValueError('Missing/duplicate source revision: '+path)
        if len({(r['git_blob'],r['source_sha256'],r['published_sha256']) for r in revisions}) != len(revisions):raise ValueError('Ambiguous source revision: '+path)
        for r in revisions:
            for field,length in [('reviewed_commit',40),('git_blob',40),('source_sha256',64),('published_sha256',64)]:
                if not re.fullmatch('[0-9a-f]{'+str(length)+'}',r[field]):raise ValueError('Invalid revision '+field)
        current=[r for r in revisions if r['id']==spec['current']]
        if len(current)!=1:raise ValueError('Missing current revision: '+path)
        current=current[0];original=evidence[spec.get('evidence_key',spec['route'])]['source'];baseline=preservation[spec.get('original_path',path)]
        if (original['repository'],original['path'],original['sha256'],original['published_sha256']) != (spec['repository'],spec['source_path'],current['source_sha256'],current['published_sha256']):raise ValueError('Current source evidence drift: '+path)
        if (baseline['source_repository'],baseline['source_path'],baseline['source_sha256'],baseline['published_sha256']) != (spec['repository'],spec.get('original_source_path',spec['source_path']),current['source_sha256'],current['published_sha256']):raise ValueError('Current preservation evidence drift: '+path)
    return data['payloads']

def select(item, roots, specs=None):
    specs=registry() if specs is None else specs
    spec=specs.get(item['path'])
    if spec is None:return None
    if (item['source_repository'],item['source_path'],item['route']) != (spec['repository'],spec['source_path'],spec['route']):raise ValueError('Source identity mismatch: '+item['path'])
    root=Path(roots[spec['repository']]);source=root/spec['source_path'];raw=source.read_bytes()
    head=git(root,'rev-parse','HEAD');blob=git(root,'rev-parse','HEAD:'+spec['source_path'])
    actual_blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    if blob!=actual_blob or item['source_sha256']!=sha(raw):raise ValueError('Source checkout differs from its committed blob: '+item['path'])
    matching=[r for r in spec['revisions'] if r['git_blob']==blob and r['source_sha256']==sha(raw)]
    if len(matching)!=1:raise ValueError(('Ambiguous source revision (more than one reviewed revision matches this checkout): ' if len(matching)>1 else 'Unreviewed source revision: ')+item['path'])
    revision=matching[0]
    return {'id':revision['id'],'reviewed_commit':revision['reviewed_commit'],'release_head':head,'git_blob':blob,'source_sha256':sha(raw),'published_sha256':revision['published_sha256']}

def validate_report(report, output, roots):
    specs=registry();baseline={p['path']:p for p in project_preserved(json.loads((SITE/'reports/play-upgrade/preservation.json').read_text())['payloads'])}
    if {p['path'] for p in report['payloads']} != set(baseline) or len(report['payloads']) != len(baseline):raise ValueError('Publication payload census changed')
    for name,root in roots.items():
        if report['source_heads'][name]!=git(root,'rev-parse','HEAD'):raise ValueError('Report source HEAD differs from checkout: '+name)
    selected={}
    for p in report['payloads']:
        revision=select(p,roots,specs)
        if revision:
            if p.get('source_revision')!=revision:raise ValueError('Reported revision differs from checkout: '+p['path'])
            expected=revision['published_sha256'];selected[p['path']]=revision
        else:expected=baseline[p['path']]['published_sha256']
        if p['published_sha256']!=expected or sha((Path(output)/'games'/p['path']).read_bytes())!=expected:raise ValueError('Published bytes differ from reviewed revision: '+p['path'])
    return selected

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--lessons',type=Path)
    a=ap.parse_args();lessons=a.lessons or review_lessons(a.output)
    print(json.dumps(validate_report(json.loads((a.output/'build-report.json').read_text()),a.output,{'Site':SITE,'Lessons':lessons})))
