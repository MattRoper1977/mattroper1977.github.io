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
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
from play.build import refresh, ALIASES
from usage_discovery import inject
ap=argparse.ArgumentParser();ap.add_argument('--lessons',required=True);ap.add_argument('--output',required=True);a=ap.parse_args()
# prepare.py is Play-only; education is built and hard-checked by the education publication
PUBLICATION='games'
subprocess.run([sys.executable,str(HERE.parent/'build_publications.py'),'--lessons',a.lessons,'--output',a.output,'--publication',PUBLICATION],check=True)
refresh(Path(a.output),review=True)
for route in ALIASES:inject(Path(a.output)/'games'/route,choice=True,compact=True)
