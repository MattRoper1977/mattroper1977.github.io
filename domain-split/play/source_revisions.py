"""Exact reviewed source/blob evidence; no acceptance based on measured output alone."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[1]

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
        current=current[0];original=evidence[spec.get('evidence_key',spec['route'])]['source'];baseline=preservation[path]
        if (original['repository'],original['path'],original['sha256'],original['published_sha256']) != (spec['repository'],spec['source_path'],current['source_sha256'],current['published_sha256']):raise ValueError('Current source evidence drift: '+path)
        if (baseline['source_repository'],baseline['source_path'],baseline['source_sha256'],baseline['published_sha256']) != (spec['repository'],spec['source_path'],current['source_sha256'],current['published_sha256']):raise ValueError('Current preservation evidence drift: '+path)
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
    if len(matching)!=1:raise ValueError('Unreviewed or ambiguous source revision: '+item['path'])
    revision=matching[0]
    return {'id':revision['id'],'reviewed_commit':revision['reviewed_commit'],'release_head':head,'git_blob':blob,'source_sha256':sha(raw),'published_sha256':revision['published_sha256']}

def validate_report(report, output, roots):
    specs=registry();baseline={p['path']:p for p in json.loads((SITE/'reports/play-upgrade/preservation.json').read_text())['payloads']}
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
    a=ap.parse_args();lessons=a.lessons or (SITE/'.sources/Lessons' if (SITE/'.sources/Lessons').is_dir() else SITE.parent/'Lessons')
    print(json.dumps(validate_report(json.loads((a.output/'build-report.json').read_text()),a.output,{'Site':SITE,'Lessons':lessons})))
