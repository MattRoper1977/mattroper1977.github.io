#!/usr/bin/env python3
"""Compatibility entry point for the authoritative four-game homepage verifier."""
from pathlib import Path
import runpy,sys
sys.argv[0]=str(Path(__file__).with_name('verify_apextennis_home.py'))
runpy.run_path(sys.argv[0],run_name='__main__')
