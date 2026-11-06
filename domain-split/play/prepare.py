"""Assemble the coordinator's existing output, then apply the Play-only overlay.

This review entrypoint leaves all shared source files untouched. The release
hook in integration.patch produces the same shelf before usage injection.

Scope: games only. Everything below the build reads output/games and
output/build-report.json and nothing else, so the education front doors were only
ever built here to be thrown away -- and, because they bind Lessons files by digest,
they made this entrypoint fail whenever the Site and Lessons trees came from
different pins, which is exactly what the Games pin release compares.
"""
import argparse
from pathlib import Path
import subprocess
import sys
import json
import re
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
from play.build import refresh, ALIASES
from usage_discovery import inject
from play.source_revisions import capture_revision_for
ap=argparse.ArgumentParser();ap.add_argument('--lessons',required=True);ap.add_argument('--output',required=True);a=ap.parse_args()
# Explicit capture requests select an exact source for isolated review only.
# The publication builder still uses the Games release pins without overrides.
request=json.loads((HERE/'capture-request.json').read_text())
if isinstance(request,dict) and request.get('lessons_commit'):
    commit=request['lessons_commit']
    if not re.fullmatch('[0-9a-f]{40}',commit):raise ValueError('Capture requires a full Lessons SHA')
    source=Path(a.lessons).resolve()
    head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    commit=capture_revision_for(head,request)
    if head != commit:
        checkout=HERE.parents[1]/'.play-review'/('capture-lessons-'+commit)
        if not checkout.exists():
            subprocess.run(['git','-C',str(source),'fetch','origin',commit],check=True)
            checkout.parent.mkdir(parents=True,exist_ok=True)
            subprocess.run(['git','-C',str(source),'worktree','add','--detach',str(checkout),commit],check=True)
        if subprocess.check_output(['git','-C',str(checkout),'rev-parse','HEAD'],text=True).strip()!=commit:
            raise ValueError('Capture checkout differs from requested Lessons SHA')
        a.lessons=str(checkout)
    print('Play review Lessons source: '+commit,flush=True)
# prepare.py is Play-only; education is built and hard-checked by the education publication
PUBLICATION='games'
subprocess.run([sys.executable,str(HERE.parent/'build_publications.py'),'--lessons',a.lessons,'--output',a.output,'--publication',PUBLICATION],check=True)
refresh(Path(a.output),review=True)
for route in ALIASES:inject(Path(a.output)/'games'/route,choice=True,compact=True)
