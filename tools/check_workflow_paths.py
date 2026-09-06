#!/usr/bin/env python3
"""Fail when a workflow names a repository path that does not exist.

Why this exists
---------------
`verify-games-audience-faces.yml` listed `tools/verify_audience_discovery_closeout.py`
in a `py_compile` line and in two `paths:` filters. **That file has never been
committed to this repository** - not deleted, never created. The step was
invalid from the day the line was written, and nobody ever saw it fail because
nobody ever saw it run: it sat behind a step that has been red since #110, and
GitHub skips the rest of a job after a failing step.

That is the part worth keeping. The skipped-step pathology hides not only real
failures but **configuration that was never valid in the first place**. One red
step above is enough to make a permanently broken step look like part of a
working suite, indefinitely.

A one-off sweep finds today's instances. This is the standing guard, because
the class is invisible by construction.

Deleted versus never-existed
----------------------------
Both are reported, and they are different defects:

  * **deleted** - drift. Something moved and a reference did not follow.
  * **never existed** - a step that has never been valid. Nobody has ever run
    what that line describes, so whatever it was meant to check is unchecked.

Usage
-----
  python3 tools/check_workflow_paths.py
  python3 tools/check_workflow_paths.py --self-test
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"

# Repository directories whose contents are real files rather than patterns.
# Globs (`main/**`) and route paths (`/for/pupils/`) are deliberately out of
# scope: they are not file references and a miss there means something else.
WATCHED = ("tools", "assets", "data")
REFERENCE = re.compile(
    r"(?<![\w./-])((?:" + "|".join(WATCHED) + r")/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)"
)


def references(workflow_text: str) -> list[tuple[str, int]]:
    found = []
    for number, line in enumerate(workflow_text.splitlines(), 1):
        for match in REFERENCE.finditer(line):
            found.append((match.group(1), number))
    return found


def ever_existed(path: str) -> bool:
    """Any commit on any branch that touched this path."""
    result = subprocess.run(
        ["git", "log", "--all", "--oneline", "--", path],
        cwd=ROOT, capture_output=True, text=True,
    )
    return bool(result.stdout.strip())


def scan(workflow_dir: Path, exists=None) -> tuple[int, list[tuple[str, str, int, str]]]:
    """Returns (paths_checked, [(path, workflow, line, verdict)])."""
    exists = exists or (lambda p: (ROOT / p).exists())
    seen: dict[str, list[tuple[str, int]]] = {}
    for workflow in sorted(workflow_dir.glob("*.yml")):
        for path, line in references(workflow.read_text(encoding="utf-8")):
            seen.setdefault(path, []).append((workflow.name, line))

    problems = []
    for path, refs in sorted(seen.items()):
        if exists(path):
            continue
        verdict = "deleted" if ever_existed(path) else "never existed"
        for workflow, line in refs:
            problems.append((path, workflow, line, verdict))
    return len(seen), problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    checked, problems = scan(WORKFLOWS)
    print(f"{checked} {'/'.join(WATCHED)} path(s) referenced by workflows")
    if not problems:
        print("[PASS] every referenced path exists")
        return 0

    print(f"\n[FAIL] {len(problems)} reference(s) point at a path that does not exist:",
          file=sys.stderr)
    for path, workflow, line, verdict in problems:
        print(f"  - {workflow}:{line} -> {path} ({verdict})", file=sys.stderr)
        if verdict == "never existed":
            print("      this step has never been valid; whatever it was meant to "
                  "check has never been checked", file=sys.stderr)
    return 1


def self_test() -> int:
    """Fixture workflows, so the guard is provable without breaking CI."""
    import tempfile
    problems = 0
    print("Workflow path controls:")

    cases = [
        ("a reference to a path that does not exist is caught",
         "        run: python3 tools/definitely_not_here.py\n", 1, "tools/definitely_not_here.py"),
        ("a reference to a real path passes",
         "        run: python3 tools/stamp-data.py --check\n", 0, None),
        ("a route path is not mistaken for a file",
         "        run: curl https://madebymatt.uk/for/pupils/\n", 0, None),
        ("a glob is not mistaken for a file",
         "    paths:\n      - 'main/**'\n", 0, None),
    ]
    for name, body, want, needle in cases:
        with tempfile.TemporaryDirectory() as tmp:
            wf = Path(tmp) / "fixture.yml"
            wf.write_text("name: fixture\njobs:\n  j:\n    steps:\n" + body, encoding="utf-8")
            _, found = scan(Path(tmp))
            got = 1 if found else 0
            blob = " ".join(f"{p} ({v})" for p, _, _, v in found)
            if got != want:
                print(f"  [FAIL] {name}: expected {want}, got {got} ({blob})", file=sys.stderr)
                problems += 1
            elif needle and needle not in blob:
                print(f"  [FAIL] {name}: caught the wrong thing ({blob})", file=sys.stderr)
                problems += 1
            else:
                print(f"  [PASS] {name}")

    # The distinction the report rests on, proven rather than asserted.
    with tempfile.TemporaryDirectory() as tmp:
        wf = Path(tmp) / "fixture.yml"
        wf.write_text("jobs:\n  j:\n    steps:\n      - run: python3 tools/verify_audience_discovery_closeout.py\n",
                      encoding="utf-8")
        _, found = scan(Path(tmp))
        verdicts = {v for _, _, _, v in found}
        if verdicts == {"never existed"}:
            print("  [PASS] a path no commit ever contained is reported as never existed")
        else:
            print(f"  [FAIL] expected 'never existed', got {verdicts}", file=sys.stderr)
            problems += 1

    print(f"  {5 - problems} passed · {problems} failed")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
