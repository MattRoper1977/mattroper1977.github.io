"""Assemble the coordinator's existing output, then apply the Play-only overlay.

This review entrypoint leaves all shared source files untouched. The release
hook in integration.patch produces the same shelf before usage injection.
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
subprocess.run([sys.executable,str(HERE.parent/'build_publications.py'),'--lessons',a.lessons,'--output',a.output],check=True)
refresh(Path(a.output),review=True)
for route in ALIASES:inject(Path(a.output)/'games'/route,choice=True,compact=True)
