#!/usr/bin/env python3
"""Run the unchanged estate generator in a clean tracked Site checkout."""
from pathlib import Path
import json, shutil, subprocess, sys, tempfile
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='as1-pin-record-') as parent:
    clean=Path(parent)/'Site'
    subprocess.run(['git','worktree','add','--detach','--quiet',str(clean),'HEAD'],cwd=ROOT,check=True)
    try:
        subprocess.run([sys.executable,str(clean/'tools/derive_pin_dependents.py'),'--write'],cwd=clean,check=True)
        subprocess.run([sys.executable,str(clean/'tools/derive_pin_dependents.py'),'--check'],cwd=clean,check=True)
        generated=clean/'data/pin-dependents.json'
        data=json.loads(generated.read_text())
        for relative in data['artefacts']:
            subprocess.run(['git','ls-files','--error-unmatch',relative],cwd=clean,stdout=subprocess.DEVNULL,check=True)
        shutil.copyfile(generated,ROOT/'data/pin-dependents.json')
        print('AS1 pin record: canonical generation and check PASS in tracked Site checkout')
    finally:
        subprocess.run(['git','worktree','remove','--force',str(clean)],cwd=ROOT,check=True)
