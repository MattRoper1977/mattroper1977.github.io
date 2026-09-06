"""Regression checks for current-source discovery and its audience boundary."""
import argparse
import json
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from build_preview import ROOT, EDUCATION_OVERRIDES, current_lesson_entries

def identity(route):
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'

ap=argparse.ArgumentParser();ap.add_argument('--lessons',type=Path,required=True);args=ap.parse_args()
old=json.loads((ROOT/'data/mbm-search-index.json').read_text())['entries']
current=current_lesson_entries(old,args.lessons)
def pupils(rows):
    result=set()
    for entry in rows:
        role=EDUCATION_OVERRIDES.get(unquote(urlparse(entry['route']).path))
        if role=='pupil' or (not role and entry.get('safeForPupils') is True and entry.get('category') in {'lesson','resource'}):
            result.add(identity(entry['route']))
    return result
assert pupils(current)==pupils(old),'Audience eligibility changed while refreshing discovery'
for route in EDUCATION_OVERRIDES:
    assert sum(identity(e['route'])==identity(route) for e in current)==1,'Duplicate education override'
planning=[e for e in current if e['route'].startswith('https://github.com/mattroper1977/Lessons/tree/main/Planning/')]
assert len(planning)==3 and all(e.get('safeForPupils') is not True for e in planning),'Planning boundary changed'
with tempfile.TemporaryDirectory() as directory:
    root=Path(directory)
    for route in ['https://example.com/lesson','../private.html','/absolute.html','folder\\lesson.html']:
        (root/'resources.json').write_text(json.dumps([{'file':route,'type':'teacher','title':'Control'}]))
        try:current_lesson_entries(old,root)
        except ValueError:pass
        else:raise AssertionError('Unsafe discovery route accepted: '+route)
print(json.dumps({'result':'PASS','retainedPupilRoutes':len(pupils(current)),'planningLinks':len(planning),'rejectedRouteControls':4}))
