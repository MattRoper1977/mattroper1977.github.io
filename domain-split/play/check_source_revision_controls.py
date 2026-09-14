"""Real output, planted defect, restored output: exercise both publication gates."""
import argparse
import copy
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
from play import build, source_revisions as revisions

def discovery_controls(output, selected):
    """Optional assets may disappear for another approved revision, never lie."""
    results=[]
    with tempfile.TemporaryDirectory(prefix='play-discovery-bindings-') as tmp:
        scratch=Path(tmp)/'output';shutil.copytree(output,scratch)
        original_read=build.read
        specs=revisions.registry()
        payloads={build.key(p['route']):p for p in json.loads((output/'build-report.json').read_text())['payloads']}
        def exercise(name, mutation, rejected=False, omitted=None):
            def altered_read(filename, fallback):
                value=copy.deepcopy(original_read(filename,fallback))
                mutation(filename,value)
                return value
            build.read=altered_read
            try:
                report=build.refresh(scratch,source_revisions=selected)
                assert not rejected, 'Invalid discovery evidence accepted: '+name
                if omitted:
                    route,kind=omitted
                    row=next(g for g in json.loads((scratch/'games/data/play-discovery.json').read_text())['games'] if build.key(g['route'])==route)
                    assert not row.get('image' if kind=='screen' else 'moods')
                    assert kind!='selection' or not row.get('details')
                    assert any(build.key(x['route'])==route and x['kind']==kind for x in report['omitted_discovery'])
            except ValueError:
                if not rejected:raise
            finally:build.read=original_read
            results.append({'control':name,'result':'PASS'})
        for filename,kind in [('screens/manifest.json','screen'),('discovery-review.json','selection')]:
            original=original_read(filename,{})
            entries=[(build.key(x['route']),x) for x in original['screens']] if kind=='screen' else list(original['routes'].items())
            route,entry=next((r,e) for r,e in entries if payloads[r]['path'] in specs and any(v['published_sha256']!=payloads[r]['published_sha256'] for v in specs[payloads[r]['path']]['revisions']))
            alternate=next(v['published_sha256'] for v in specs[payloads[route]['path']]['revisions'] if v['published_sha256']!=payloads[route]['published_sha256'])
            def mutation(field,value):
                def mutate(file,data):
                    if file==filename:
                        target=next(x for x in data['screens'] if build.key(x['route'])==route) if kind=='screen' else data['routes'][route]
                        target[field]=value
                return mutate
            exercise('Other approved revision omits '+kind,mutation('published_sha256',alternate),omitted=(route,kind))
            exercise('Unreviewed binding rejected for '+kind,mutation('published_sha256','0'*64),rejected=True)
            if kind=='screen':exercise('Altered screenshot hash rejected',mutation('sha256','0'*64),rejected=True)
        exercise('Restored discovery evidence accepted',lambda *_:None)
    return results

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--lessons',required=True,type=Path);ap.add_argument('--output',required=True,type=Path);a=ap.parse_args()
    original=json.loads((a.output/'build-report.json').read_text());roots={'Site':revisions.SITE,'Lessons':a.lessons}
    selected=revisions.validate_report(original,a.output,roots)
    assert set(selected)==set(revisions.registry()), 'Every registered route must be measured'
    controls=[]
    def green(label,fn):fn();controls.append({'route':payload_path,'control':label,'result':'PASS'})
    def red(label,fn):
        try:fn()
        except (ValueError,AssertionError):controls.append({'route':payload_path,'control':label,'result':'PASS','plantedDefectRejected':True})
        else:raise AssertionError('Planted defect did not fire: '+label)
    for payload_path in sorted(selected):
        with tempfile.TemporaryDirectory(prefix='hc3-source-revisions-') as tmp:
            output=Path(tmp)/'output';shutil.copytree(a.output,output)
            payload=output/'games'/payload_path;raw=payload.read_bytes()
            green('Run 1: builder accepts real output',lambda:build.refresh(output,source_revisions=selected))
            green('Run 1: browser byte guard accepts real output',lambda:revisions.validate_report(original,output,roots))
            payload.write_bytes(raw+b'\n<!-- planted unreviewed payload -->\n')
            red('Run 2: builder rejects planted output byte',lambda:build.refresh(output,source_revisions=selected))
            red('Run 2: browser byte guard rejects planted output byte',lambda:revisions.validate_report(original,output,roots))
            payload.write_bytes(raw)
            green('Run 3: builder accepts restored output',lambda:build.refresh(output,source_revisions=selected))
            green('Run 3: browser byte guard accepts restored output',lambda:revisions.validate_report(original,output,roots))
            forged_context=copy.deepcopy(selected);forged_context[payload_path]['published_sha256']='0'*64
            red('Builder rejects invented reviewed context',lambda:build.refresh(output,source_revisions=forged_context))
            p=next(p for p in original['payloads'] if p['path']==payload_path)
            wrong=copy.deepcopy(p);wrong['source_repository']='Lessons' if p['source_repository']=='Site' else 'Site'
            red('Wrong source repository is rejected',lambda:revisions.select(wrong,roots))
            wrong=copy.deepcopy(p);wrong['source_path']='Games/Other.html'
            red('Wrong source path is rejected',lambda:revisions.select(wrong,roots))
            forged=copy.deepcopy(original);forged['source_heads']['Lessons']='0'*40
            red('Forged release HEAD is rejected',lambda:revisions.validate_report(forged,output,roots))
            forged=copy.deepcopy(original);next(p for p in forged['payloads'] if p['path']==payload_path)['source_revision']['git_blob']='0'*40
            red('Forged blob proof is rejected',lambda:revisions.validate_report(forged,output,roots))
            specs=revisions.registry();specs[p['path']]['revisions']=[]
            red('Missing approved revision is rejected',lambda:revisions.select(p,roots,specs))
            specs=revisions.registry();specs[p['path']]['revisions']*=2
            red('Duplicate approved revision is rejected',lambda:revisions.select(p,roots,specs))
            # Mutate a scratch source AND its claimed metadata. Merely making
            # source/output/report agree must never create approval for new bytes.
            source=Path(tmp)/p['source_repository'];source_file=source/p['source_path'];source_file.parent.mkdir(parents=True)
            source_file.write_bytes(raw+b'\n<!-- planted source -->\n')
            subprocess.run(['git','init','-q',str(source)],check=True)
            subprocess.run(['git','-C',str(source),'add',p['source_path']],check=True)
            subprocess.run(['git','-C',str(source),'-c','user.name=HC3 scratch control','-c','user.email=control@example.invalid','commit','-qm','Planted source only'],check=True)
            planted=copy.deepcopy(p);planted['source_sha256']=revisions.sha(source_file.read_bytes())
            red('Consistent unreviewed source bytes remain rejected',lambda:revisions.select(planted,{**roots,p['source_repository']:source}))
    print(json.dumps({'status':'PASS','selected':selected,'controls':controls,'discovery_controls':discovery_controls(a.output,selected)},indent=2))

if __name__=='__main__':main()
