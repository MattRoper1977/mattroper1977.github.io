#!/usr/bin/env python3
"""The shelf mirror: data/source-manifests/games.json is generated, never hand-written.

Ruled by Matt 2026-08-13, closing the two-shelves divergence the census report
evidences. The fact that settled it: the served arcade fetches /Games/games.json
at runtime (games/index.html line 412), and that URL serves the Games
repository's games.json - so THAT file is the canonical shelf and single
writer. This repository's copy exists because build_mbm_search_index.py reads
its declared inputs from data/source-manifests/, and it is from now on a
MIRROR: byte-for-byte the canonical file, produced by this tool and nothing
else. The 2026-08-12 launch wrote two shelf entries here by hand - commits
titled "single-writer" that wrote to the file the arcade never reads - and the
estate spent a day with two hand-written shelves. Never again: hand edits to
the mirror die at the next --check.

The canonical lives in another repository, so this tool takes a path to a
checkout or downloaded copy rather than fetching anything itself:

  python3 tools/render_games_manifest_mirror.py --canonical /path/to/Games/games.json --check
  python3 tools/render_games_manifest_mirror.py --canonical /path/to/Games/games.json --write

--check exits 1 naming the drift direction; --write copies the canonical bytes
in. A missing --canonical is a hard error, never a skip: a mirror check that
silently passes without its reference measures nothing. The LIVE leg of this
invariant runs in agx1-live-verify.yml, which byte-compares the served
canonical against the committed mirror on every pull request - so drift
between the repositories is caught even though no local gate can see both.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIRROR = ROOT / "data" / "source-manifests" / "games.json"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--canonical", required=True,
                        help="path to the canonical games.json (a MattRoper1977/Games checkout)")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="fail if the mirror differs from the canonical")
    mode.add_argument("--write", action="store_true", help="copy the canonical bytes into the mirror")
    args = parser.parse_args(argv)

    canonical = Path(args.canonical)
    if not canonical.is_file():
        print(f"FAIL canonical not found: {canonical} - a mirror check without its "
              f"reference measures nothing, so this is an error, not a skip", file=sys.stderr)
        return 1

    want = canonical.read_bytes()
    if args.write:
        MIRROR.write_bytes(want)
        print(f"wrote  {MIRROR.relative_to(ROOT)} ({len(want)} bytes, sha256 {sha(want)[:16]}) "
              f"from {canonical}")
        return 0

    have = MIRROR.read_bytes() if MIRROR.is_file() else b""
    if have == want:
        print(f"ok     mirror is byte-identical to the canonical "
              f"({len(want)} bytes, sha256 {sha(want)[:16]})")
        return 0
    print(f"STALE  {MIRROR.relative_to(ROOT)}: mirror {len(have)} B sha {sha(have)[:16]} "
          f"vs canonical {len(want)} B sha {sha(want)[:16]}", file=sys.stderr)
    print("       the canonical is the Games repository's games.json; regenerate with --write, "
          "never by hand", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
