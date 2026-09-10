#!/usr/bin/env python3
"""Compatibility entry point for the estate-wide maker-splash generator.

tools/render_maker_splash.py is the only writer. This name remains because
older release workflows invoke it; forwarding keeps those workflows useful
without preserving a second splash implementation.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generator = Path(__file__).with_name("render_maker_splash.py")
    mode = "--check" if args.check else "--write"
    print("render_splash.py compatibility entry: delegating to render_maker_splash.py")
    return subprocess.call([sys.executable, str(generator), "--root", args.root, mode])


if __name__ == "__main__":
    raise SystemExit(main())
