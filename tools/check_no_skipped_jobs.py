#!/usr/bin/env python3
"""Fail when a job that should have run was skipped.

Why this exists
---------------
`live-proof` - the job that waits for the deployment and byte-compares all 13
deployed pages against the committed tree - declared
`needs: [static-contract, ...]`. static-contract has been red since #110, so
that job was skipped on every push for weeks and nobody noticed.

Nobody noticed because of how a skip presents itself. A failure is red and
loud. A stale check eventually goes red. An unrun check at least sits there
looking unrun. **A skipped job renders grey, reads as "not applicable", and is
frequently scored as success by badges and by summary views** - it looks like a
decision somebody made rather than coverage that quietly went away.

So the skip itself is asserted, by a job that runs `if: always()` and reads the
`needs` context. This one step would have caught the problem the week #110
landed.

Expected skips
--------------
Some skips are the declared design rather than a loss: `live-proof` only applies
to a push, so on a pull request it is *supposed* to be skipped. Those are
declared per event below, and a job that is expected to skip but did NOT skip is
also reported - an expectation that has silently stopped being true is the same
class of problem in the other direction.

Usage
-----
  check_no_skipped_jobs.py --results '<toJSON(needs)>' --event push
  check_no_skipped_jobs.py --self-test
"""
from __future__ import annotations

import argparse
import json
import sys

# job -> the events on which it is *designed* not to run. Anything else that
# skips is coverage disappearing. Derived from each job's own `if:` condition;
# when you add one, add it here or the guard will report it.
EXPECTED_SKIPS: dict[str, set[str]] = {
    "live-proof": {"pull_request", "workflow_dispatch", "schedule"},
}

OK_RESULTS = {"success"}


def evaluate(results: dict[str, dict], event: str) -> tuple[list[str], list[str], list[str]]:
    """Returns (unexpected_skips, missing_expected_skips, failures)."""
    unexpected, missing, failed = [], [], []
    for job, info in sorted(results.items()):
        result = (info or {}).get("result")
        expected_to_skip = event in EXPECTED_SKIPS.get(job, set())
        if result == "skipped" and not expected_to_skip:
            unexpected.append(job)
        elif result != "skipped" and expected_to_skip:
            missing.append(job)
        elif result not in OK_RESULTS and result != "skipped":
            failed.append(f"{job} ({result})")
    return unexpected, missing, failed


def report(results: dict[str, dict], event: str) -> int:
    print(f"job results for a '{event}' run:")
    for job, info in sorted(results.items()):
        print(f"  {job:<24} {(info or {}).get('result')}")

    unexpected, missing, failed = evaluate(results, event)
    problems = 0

    if unexpected:
        print("\nSKIPPED, and not by design:", file=sys.stderr)
        for job in unexpected:
            print(f"  - {job}: this job did not run, and nothing said it should not. "
                  f"A skip is not a pass.", file=sys.stderr)
        problems += len(unexpected)

    if missing:
        print("\nEXPECTED to be skipped and was not:", file=sys.stderr)
        for job in missing:
            print(f"  - {job}: EXPECTED_SKIPS says this should not run on '{event}'. "
                  f"Either the job's condition changed or this expectation is stale.",
                  file=sys.stderr)
        problems += len(missing)

    if failed:
        # Reported, not counted: a red job fails its own check and is already
        # loud. Counting it here would report one problem twice.
        print("\nRed (already reported by the job itself): " + ", ".join(failed))

    if problems:
        print(f"\n[FAIL] {problems} job(s) did not run as designed", file=sys.stderr)
        return 1
    print("\n[PASS] every job ran, or was skipped by declared design")
    return 0


def self_test() -> int:
    """Fixtures only - no workflow needed to prove this can fail."""
    cases = [
        ("a job skipped for no declared reason is caught",
         {"live-proof": {"result": "skipped"}}, "push", 1, "live-proof"),
        ("the same skip on a pull request is by design",
         {"live-proof": {"result": "skipped"}}, "pull_request", 0, None),
        ("an expected skip that did not skip is caught",
         {"live-proof": {"result": "success"}}, "pull_request", 1, "EXPECTED_SKIPS"),
        ("a red job does not double-count as a skip",
         {"static-contract": {"result": "failure"}}, "push", 0, None),
        ("all green passes",
         {"static-contract": {"result": "success"}, "live-proof": {"result": "success"}},
         "push", 0, None),
        ("a cancelled job is not silently accepted",
         {"browser-matrix": {"result": "cancelled"}}, "push", 0, None),
    ]
    problems = 0
    print("Skipped-job guard controls:")
    for name, results, event, want_code, needle in cases:
        import io, contextlib
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = report(results, event)
        blob = out.getvalue() + err.getvalue()
        if code != want_code:
            print(f"  [FAIL] {name}: expected exit {want_code}, got {code}", file=sys.stderr)
            problems += 1
        elif needle and needle not in blob:
            # A control that goes red for the wrong reason is not a control.
            print(f"  [FAIL] {name}: right exit code, wrong reason "
                  f"({blob.strip().splitlines()[-1] if blob.strip() else 'no output'})", file=sys.stderr)
            problems += 1
        else:
            print(f"  [PASS] {name}")
    print(f"  {len(cases) - problems} passed · {problems} failed")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", help="toJSON(needs) from the workflow")
    parser.add_argument("--event", default="push")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.results:
        raise SystemExit("--results is required")
    return report(json.loads(args.results), args.event)


if __name__ == "__main__":
    sys.exit(main())
