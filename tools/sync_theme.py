#!/usr/bin/env python3
"""One theme engine, three files: the site's theme.js is the source, the rest are output.

WHY THIS EXISTS
---------------
The reading-theme engine was copied into Lessons and Apps so their hubs work
without reaching back to the site's asset server. That was the right call and it
is not being undone. What it cost was a rule nobody could enforce: three files
that must agree, kept in agreement by remembering to.

It was not remembered. Adding the High-Lumen theme on 2026-08-12 updated one
copy; the Lessons and Creator hubs silently kept five swatches while every other
surface showed six. That was caught. What was not caught, until this pass went
looking, is that the digest pinned in the Apps contract test has been wrong
since before High Lumen existed, so the Apps gate has been failing on a stale
constant rather than on real drift — and the same digest is stale in both
repositories' MBM_CROSS_ESTATE_UNIFICATION.md.

Both failures are the same failure. A human had to update N places by hand and
updated fewer than N. So the copies stop being maintained files and become
build output, and every place that pins their digest is written by the same run
that writes them.

WHAT IT DOES
------------
    site/theme.js                      the one file a person edits
      |
      +--> Lessons/assets/mbm-theme.js   HEADER + canonical bytes, exactly
      +--> Apps/assets/mbm-theme.js      HEADER + canonical bytes, exactly

and then, in the same run, rewrites the generated copy's SHA-256 wherever it is
pinned: each repository's tools/verify_cross_estate_unification.py and its
docs/MBM_CROSS_ESTATE_UNIFICATION.md.

The header is not decoration. It is the only thing a person opening the copy
sees before they start editing it, and it names the command that will undo them.

    python3 tools/sync_theme.py              write the copies and the pins
    python3 tools/sync_theme.py --check      report drift, exit 1, write nothing
    python3 tools/sync_theme.py --self-test  prove it detects drift and is idempotent

--check is what a gate runs. Writing is what a person runs after editing
theme.js. Running it twice in a row must produce no change on the second run;
--self-test asserts that, because a sync tool that is not idempotent turns every
run into a diff and nobody can tell a real change from noise.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
CANONICAL = SITE / "theme.js"

HEADER = ("/* GENERATED from madebymatt.github.io/theme.js — edit there, run "
          "tools/sync_theme.py. Hand edits will be reverted. */\n")

# The command a failing gate should print, and the one the header names.
SYNC_COMMAND = "python3 tools/sync_theme.py   (in the mattroper1977.github.io checkout)"

REL_COPY = "assets/mbm-theme.js"
REL_GATE = "tools/verify_cross_estate_unification.py"
REL_DOC = "docs/MBM_CROSS_ESTATE_UNIFICATION.md"

# The pinned-digest sites, as (relative path, regex with the digest in group 1).
# Both are anchored on the asset's own name so they cannot match a neighbouring
# asset's pin — mbm-platform.js sits two lines away in both files.
PINS = [
    (REL_GATE, re.compile(r'("assets/mbm-theme\.js":\s*")([0-9a-f]{64})(")')),
    (REL_DOC, re.compile(r'(`assets/mbm-theme\.js` — SHA-256 `)([0-9a-f]{64})(`)')),
]


def _first_existing(*cands: Path) -> Path | None:
    for c in cands:
        if c.exists():
            return c
    return None


LESSONS = _first_existing(SITE.parent / "Lessons", Path("/home/user/Lessons"))
APPS = _first_existing(SITE.parent / "matt-s-apps-", Path("/workspace/matt-s-apps-"))

TARGETS = [t for t in (("Lessons", LESSONS), ("Apps", APPS)) if t[1] is not None]


def generated_bytes(canonical: bytes) -> bytes:
    return HEADER.encode("utf-8") + canonical


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def plan(canonical: bytes) -> list[tuple[Path, bytes, str]]:
    """Every file this run would write, and what it would contain.

    Returned rather than applied so --check and the write path cannot disagree
    about what "in sync" means.
    """
    want = generated_bytes(canonical)
    want_sha = digest(want)
    out: list[tuple[Path, bytes, str]] = []
    for label, root in TARGETS:
        copy = root / REL_COPY
        out.append((copy, want, f"{label}: generated copy"))
        for rel, rx in PINS:
            path = root / rel
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            new = rx.sub(lambda m: m.group(1) + want_sha + m.group(3), text)
            if new == text and not rx.search(text):
                # A pin site that has lost its pin is a silent hole, not a
                # no-op: the next drift would go unnoticed there.
                out.append((path, text.encode("utf-8"), f"{label}: {rel} HAS NO PIN TO UPDATE"))
                continue
            out.append((path, new.encode("utf-8"), f"{label}: {rel} pin"))
    return out


def run(write: bool) -> int:
    if not CANONICAL.is_file():
        print(f"[FAIL] canonical source missing: {CANONICAL}")
        return 1
    if not TARGETS:
        print("[FAIL] neither Lessons nor Apps is checked out beside the site repo; "
              "nothing to sync and nothing proved")
        return 1

    canonical = CANONICAL.read_bytes()
    want_sha = digest(generated_bytes(canonical))
    print(f"canonical  {CANONICAL}")
    print(f"            source sha256 {digest(canonical)}")
    print(f"            generated copy sha256 {want_sha}")
    print(f"targets    {', '.join(f'{lab} ({root})' for lab, root in TARGETS)}\n")

    stale, holes = [], []
    for path, content, what in plan(canonical):
        if "HAS NO PIN" in what:
            holes.append(what)
            print(f"   HOLE    {what}")
            continue
        current = path.read_bytes() if path.exists() else None
        if current == content:
            print(f"   ok      {what}")
            continue
        stale.append(what)
        if write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            print(f"   WROTE   {what}")
        else:
            print(f"   STALE   {what}")

    print()
    if holes:
        print(f"[FAIL] {len(holes)} pin site(s) no longer carry a digest to update. "
              f"A gate that pins nothing cannot catch drift.")
        return 1
    if not stale:
        print("[PASS] theme engine in sync: every generated copy is the header plus "
              "theme.js byte-for-byte, and every pinned digest matches")
        return 0
    if write:
        print(f"[DONE] {len(stale)} file(s) rewritten from theme.js")
        return 0
    print(f"[FAIL] {len(stale)} file(s) out of sync with theme.js. Fix by running:\n"
          f"           {SYNC_COMMAND}")
    return 1


def self_test() -> int:
    """Prove --check goes red on drift, and that writing is idempotent.

    Every mutation is made in memory or restored in a finally, so a failing
    self-test never leaves the estate half-synced.
    """
    problems = []
    canonical = CANONICAL.read_bytes()

    # 1. the generated copy must be exactly the header plus the source, and the
    #    header must be the first thing in the file.
    want = generated_bytes(canonical)
    if not want.startswith(HEADER.encode("utf-8")):
        problems.append("the generated form does not start with the header")
    if want[len(HEADER.encode("utf-8")):] != canonical:
        problems.append("the generated form is not the header plus the source verbatim")

    # 2. --check must go red on a one-byte change to a copy, and on a wrong pin.
    for label, root in TARGETS:
        for rel, mutate in ((REL_COPY, lambda t: t + "\n/* drift */\n"),
                            (REL_GATE, lambda t: re.sub(r'("assets/mbm-theme\.js":\s*")[0-9a-f]{64}',
                                                        r"\g<1>" + "0" * 64, t, count=1))):
            path = root / rel
            if not path.is_file():
                continue
            original = path.read_bytes()
            try:
                path.write_text(mutate(original.decode("utf-8")), encoding="utf-8")
                stale = [w for p, c, w in plan(canonical)
                         if p.exists() and p.read_bytes() != c]
                if not stale:
                    problems.append(f"--check accepted a drifted {label}/{rel}")
            finally:
                path.write_bytes(original)

    # 3. idempotency: with everything already in sync, plan() must want nothing.
    left = [w for p, c, w in plan(canonical) if not p.exists() or p.read_bytes() != c]
    if left:
        problems.append("a second run would still rewrite: " + ", ".join(left))

    for p in problems:
        print("   FAIL " + p)
    if problems:
        print(f"[FAIL] sync_theme self-test: {len(problems)} problem(s)")
        return 1
    print("[PASS] sync_theme self-test: the generated form is header+source exactly, "
          "--check reddens on a drifted copy and on a wrong pin, and a second run is a no-op")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true",
                    help="report drift and exit 1 without writing anything")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        # The tree must be in sync before the self-test's idempotency claim
        # means anything, so sync first and say so.
        rc = run(write=True)
        if rc:
            return rc
        print()
        return self_test()
    return run(write=not a.check)


if __name__ == "__main__":
    raise SystemExit(main())
