#!/usr/bin/env python3
"""Every declared precondition names a real tool, a real variable and a real exit.

Some instruments here cannot run from this repository: they serve a second or
third estate - the Games repo, the Lessons repo - exactly as production does.
That is a fact about the estate, not a defect. What was a defect is that the
requirement lived nowhere: the tools defaulted to one machine's absolute path
and died on ENOENT, so "this instrument cannot run here" surfaced as a stack
trace while somebody was writing a report, and INCONCLUSIVE became a thing
discovered rather than a state designed.

data/instrument-preconditions.json declares them. This checks the declaration
against the tools, because a manifest nobody verifies drifts from the thing it
describes and then documents a repository that no longer exists:

  * the tool exists
  * the tool reads the environment variable the manifest says supplies it
  * the tool exits with the declared code when the precondition is unmet, and
    that code is not 1 - an unmet precondition is a statement about the
    environment, and reporting it as FAIL makes it a statement about the subject

The last one is measured by running the tool with the variable pointed at a
directory that does not exist, which is also what proves the guard is reachable.

Usage:
  python3 tools/check_instrument_preconditions.py             # gate
  python3 tools/check_instrument_preconditions.py --self-test # prove it fires
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "instrument-preconditions.json"
# 1 is reserved for FAIL. A precondition that cannot be met is not the subject
# failing, and a manifest that let an instrument declare 1 would licence exactly
# the confusion this file exists to end.
FORBIDDEN_UNMET_EXIT = 1


def load() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["instruments"]


def variables(entry: dict) -> list[str]:
    names = [entry["suppliedBy"]]
    names += [also["suppliedBy"] for also in entry.get("alsoNeeds", [])]
    return names


def problems(entries: list[dict], run: bool = True) -> list[str]:
    found: list[str] = []
    for entry in entries:
        tool = ROOT / entry["tool"]
        if not tool.is_file():
            found.append(f"{entry['tool']}: declared, but no such file")
            continue
        source = tool.read_text(encoding="utf-8", errors="replace")
        for name in variables(entry):
            if not re.search(rf"process\.env\.{re.escape(name)}\b", source):
                found.append(f"{entry['tool']}: the manifest says {name} supplies it, but it never reads that variable")
        unmet = entry["unmetExit"]
        if unmet == FORBIDDEN_UNMET_EXIT:
            found.append(f"{entry['tool']}: declares unmetExit 1, which is FAIL; an unmet precondition is "
                         f"not the subject failing")
        if not run:
            continue
        # Point every declared variable at a directory that cannot exist. If the
        # guard is reachable the tool reports its declared code; if it is not,
        # this is where we find out rather than in six months.
        env = dict(os.environ)
        for name in variables(entry):
            env[name] = str(ROOT / "__no_such_estate__")
        try:
            result = subprocess.run([_runner(tool), str(tool)], env=env, cwd=ROOT,
                                    capture_output=True, text=True, timeout=120)
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            found.append(f"{entry['tool']}: could not be run to prove its guard: {exc}")
            continue
        if result.returncode != unmet:
            found.append(
                f"{entry['tool']}: with its precondition unmet it exited {result.returncode}, "
                f"not the declared {unmet}"
            )
        if "INCONCLUSIVE" not in (result.stderr + result.stdout):
            found.append(f"{entry['tool']}: with its precondition unmet it never says INCONCLUSIVE")
    return found


def _runner(tool: Path) -> str:
    return "node" if tool.suffix in {".js", ".mjs"} else sys.executable


def self_test() -> int:
    """Break the manifest three ways and require each to be caught.

    The real manifest is validated first: controls against an already-broken
    manifest would pass on the pre-existing problem and prove nothing.
    """
    entries = load()
    baseline = problems(entries)
    if baseline:
        print("[FAIL] precondition: the shipped manifest already has problems, so no control below "
              "can be told apart from them")
        for item in baseline:
            print(" -", item)
        return 1

    failures = 0

    def control(label: str, mutate, expected: str) -> None:
        nonlocal failures
        broken = json.loads(json.dumps(entries))
        mutate(broken)
        # run=False: these three are shape defects, and running the tools again
        # for each would triple the wall clock to re-answer a settled question.
        found = problems(broken, run=False)
        if any(expected.lower() in item.lower() for item in found):
            print(f"  [PASS] control: {label}")
            return
        print(f"  [FAIL] control not detected: {label} (found {found})")
        failures += 1

    control("a declared tool that does not exist",
            lambda e: e[0].__setitem__("tool", "tools/verify_nothing_at_all.js"), "no such file")
    control("a variable the tool never reads",
            lambda e: e[0].__setitem__("suppliedBy", "TOTALLY_UNREAD_DIR"), "never reads that variable")
    control("an unmet precondition declared as FAIL",
            lambda e: e[0].__setitem__("unmetExit", 1), "which is FAIL")

    print(f"\n{'[FAIL]' if failures else '[PASS]'} instrument-precondition self-test: {failures} problem(s)")
    return failures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="prove the checks can fail")
    args = parser.parse_args()

    if args.self_test:
        print("Instrument-precondition controls:")
        raise SystemExit(1 if self_test() else 0)

    entries = load()
    found = problems(entries)
    print(f"{len(entries)} instrument(s) declare an external precondition:")
    for entry in entries:
        print(f"  {entry['tool']}  needs {entry['needs'][:58]}…")
        print(f"     supplied by {', '.join(variables(entry))} · unmet -> exit {entry['unmetExit']} (INCONCLUSIVE)")
    if found:
        print("\nProblems:", file=sys.stderr)
        for item in found:
            print(f"  - {item}", file=sys.stderr)
        raise SystemExit(1)
    print("\nEvery declaration names a tool that exists, a variable it reads, and an exit it takes.")


if __name__ == "__main__":
    main()
