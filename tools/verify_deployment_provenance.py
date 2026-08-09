#!/usr/bin/env python3
"""Prove the bytes being served are the commit we think they are.

Why this exists
---------------
On 9 August 2026 the production route matrix reported "all 13 routes 200; both
removed paths 404; 1 attempt(s)" **31 seconds before the deployment it was
reporting on existed**, and printed the identical line again 8m46s after that
deployment completed. A check that produces the same pass whether or not the
thing it tests has happened is not a weak check - it is not a check.

The cause was retry-on-failure semantics: the matrix re-checked only routes that
were *not* 200. A route that served 200 before a merge serves 200 after it, so
`pending` emptied on the first attempt and the retry ladder never engaged. It
was measuring that the site exists, which nobody doubted.

What replaces it
----------------
Three layers, because any one of them alone is defeatable.

  Layer 1  It must be unable to run early. The workflow triggers on the
           deployment event and takes the SHA from the event payload. This tool
           refuses to invent an expected SHA: --expected-sha is required, so a
           caller cannot accidentally verify "whatever is checked out".

  Layer 2  Ask GitHub which commit is deployed, and assert it equals the
           expected SHA. api.github.com is reachable from a runner even where
           the custom domain is not, so this layer stands on its own.

  Layer 3  Prove it at the origin. Fetch a *witness* - a served file whose bytes
           differ between the previously deployed commit and the expected one -
           and compare its sha256 against the committed bytes.

The trap in Layer 3, found while building it
--------------------------------------------
The obvious witness is the data stamp: `tools/stamp-data.py` content-hashes
site.json and data/resources.json and splices the hash into every page, which
is a genuine content-derived provenance signal already being served.

But it only moves when *those two files* move. PR #114 changed neither, so the
stamp was byte-identical either side of the merge - a Layer 3 built on the stamp
alone would have passed vacuously on the exact deployment that motivated it.

So the witness is chosen per deployment from the files that actually changed,
and the stamp is reported as a second signal only when it is a distinguishing
one. **When no served file changed at all, the origin cannot tell the two
commits apart, and this says so (INCONCLUSIVE) rather than claiming a pass it
did not earn.** Layer 2 carries the proof in that case, and the output states it.

Usage
-----
  python3 tools/verify_deployment_provenance.py --expected-sha <sha>
  python3 tools/verify_deployment_provenance.py --expected-sha <sha> --must-not-be-deployed
  python3 tools/verify_deployment_provenance.py --self-test
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "https://madebymatt.uk/"
DEFAULT_REPO = "MattRoper1977/mattroper1977.github.io"

# Paths in this repository that GitHub Pages does not serve as site content.
# A witness has to be something a visitor could actually download, or comparing
# it against the origin proves nothing.
NOT_SERVED = (
    "tools/", ".github/", "docs/", "reports/", "audit-output/", "supabase/",
    "BACKLOG.md", "README.md", "CLAUDE.md", ".gitignore",
)

# Deployment lag is real, so a mismatch is retried rather than failed on sight.
# The schedule is the one the route matrix was given and never used, because it
# was waiting on the wrong signal.
RETRY_DELAYS = (300, 300, 300)

PASS, FAIL, INCONCLUSIVE = "PASS", "FAIL", "INCONCLUSIVE"


class Transport:
    """Network access, in one place so the controls can replace it."""

    def get_json(self, url: str, timeout: float = 30.0):
        request = urllib.request.Request(url, headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "mbm-deployment-provenance",
        })
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def get_bytes(self, url: str, timeout: float = 30.0) -> tuple[int, bytes]:
        request = urllib.request.Request(url, headers={
            "User-Agent": "mbm-deployment-provenance",
            # A cached copy would defeat the whole point of asking the origin.
            "Cache-Control": "no-cache",
        })
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
        except (urllib.error.URLError, OSError):
            # Unreachable is a reported state, not a traceback. Status 0 means
            # "no answer at all", which reads differently from a 404 and should.
            return 0, b""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(*args: str) -> tuple[int, str]:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return result.returncode, result.stdout


def git_bytes(*args: str) -> tuple[int, bytes]:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    return result.returncode, result.stdout


def resolve(sha: str) -> str | None:
    code, out = git("rev-parse", "--verify", f"{sha}^{{commit}}")
    return out.strip() if code == 0 else None


def short(ref: str) -> str:
    """Abbreviate a sha but keep any suffix, so `<sha>^` does not print as `<sha>`."""
    head, sep, tail = ref.partition("^")
    return head[:7] + sep + tail


def served_url(rel: str) -> str:
    """Repo path -> the path a visitor would request."""
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def is_served(rel: str) -> bool:
    return not any(rel == prefix or rel.startswith(prefix) for prefix in NOT_SERVED)


def changed_served_files(base: str, expected: str) -> list[str]:
    code, out = git("diff", "--name-only", base, expected)
    if code != 0:
        return []
    return sorted(rel for rel in out.splitlines() if rel and is_served(rel))


def committed_bytes(sha: str, rel: str) -> bytes | None:
    code, out = git_bytes("show", f"{sha}:{rel}")
    return out if code == 0 else None


def data_stamp_of(sha: str) -> str | None:
    """The stamp tools/stamp-data.py would splice in at this commit.

    Derived the same way the stamper derives it, from the same files, so this
    is not a second copy of the value - it is the same computation.
    """
    digests = []
    for rel in ("site.json", "data/resources.json"):
        blob = committed_bytes(sha, rel)
        if blob is None:
            return None
        digests.append(hashlib.sha256(blob).hexdigest()[:12])
    return ",".join(digests)


def witness_pair(limit: int = 40) -> tuple[str, str] | None:
    """The most recent (parent, commit) where a *served* file changed.

    The controls need a pair Layer 3 can actually witness. Taking HEAD and its
    parent looked obvious and was wrong: a commit touching only tools/ and
    docs/ leaves no witness, and the control then passes having exercised
    nothing - species 3, in the tool written to demonstrate species 3.
    """
    code, out = git("rev-list", f"--max-count={limit}", "HEAD")
    if code != 0:
        return None
    for sha in out.split():
        parent = resolve(f"{sha}^")
        if parent and changed_served_files(parent, sha):
            return parent, sha
    return None


def deployed_sha(transport: Transport, repo: str) -> tuple[str | None, str]:
    """What GitHub says is deployed, and where that answer came from.

    Two sources are tried because access to them differs by token and by
    environment. A source that errors is reported; it never silently becomes a
    pass, and running out of sources is a failure, not an absence of opinion.
    """
    attempts = []
    try:
        latest = transport.get_json(f"https://api.github.com/repos/{repo}/pages/builds/latest")
        sha = (latest or {}).get("commit")
        if sha:
            return sha, "pages/builds/latest"
        attempts.append("pages/builds/latest returned no commit")
    except Exception as error:  # noqa: BLE001 - the reason is reported, not swallowed
        attempts.append(f"pages/builds/latest unavailable ({type(error).__name__})")

    try:
        deployments = transport.get_json(
            f"https://api.github.com/repos/{repo}/deployments?environment=github-pages&per_page=1"
        )
        if isinstance(deployments, list) and deployments:
            return deployments[0]["sha"], "deployments?environment=github-pages"
        attempts.append("deployments listed none")
    except Exception as error:  # noqa: BLE001
        attempts.append(f"deployments unavailable ({type(error).__name__})")

    return None, "; ".join(attempts)


def check_once(transport: Transport, expected: str, base_url: str, repo: str) -> list[tuple[str, str, str]]:
    """One pass over the layers. Returns [(layer, state, detail)]."""
    findings: list[tuple[str, str, str]] = []

    # Layer 2 - GitHub's own answer.
    actual, source = deployed_sha(transport, repo)
    if actual is None:
        findings.append(("2 GitHub API", FAIL,
                         f"no source could say which commit is deployed: {source}"))
    elif actual != expected:
        findings.append(("2 GitHub API", FAIL,
                         f"deployed is {actual[:7]}, expected {expected[:7]} (via {source})"))
    else:
        findings.append(("2 GitHub API", PASS, f"deployed commit is {expected[:7]} (via {source})"))

    # Layer 3 - the origin itself.
    witness_base = actual if (actual and actual != expected and resolve(actual)) else None
    reference = witness_base or f"{expected}^"
    if resolve(reference) is None:
        findings.append(("3 origin witness", FAIL,
                         f"cannot resolve {short(reference)} to choose a witness; "
                         f"a shallow checkout will do this - the workflow needs fetch-depth: 0"))
        return findings

    witnesses = changed_served_files(reference, expected)
    if not witnesses:
        findings.append(("3 origin witness", INCONCLUSIVE,
                         f"no served file differs between {short(reference)} and {short(expected)}, so the "
                         f"origin cannot tell them apart. Layer 2 carries the proof for this deployment"))
        return findings

    # Up to three, so a single unlucky path cannot carry the whole claim, and
    # every one of them must match.
    for rel in witnesses[:3]:
        want = committed_bytes(expected, rel)
        if want is None:
            findings.append((f"3 origin witness {rel}", FAIL, "not present at the expected commit"))
            continue
        status, body = transport.get_bytes(base_url.rstrip("/") + served_url(rel))
        if status == 0:
            findings.append((f"3 origin witness {rel}", FAIL,
                             "the origin could not be reached from here at all"))
        elif status != 200:
            findings.append((f"3 origin witness {rel}", FAIL, f"origin answered HTTP {status}"))
        elif sha256(body) != sha256(want):
            findings.append((f"3 origin witness {rel}", FAIL,
                             f"served sha256 {sha256(body)[:12]} != committed {sha256(want)[:12]} "
                             f"- the origin is serving other bytes for this path"))
        else:
            findings.append((f"3 origin witness {rel}", PASS,
                             f"served bytes match the commit ({sha256(want)[:12]})"))

    # The data stamp, reported only where it is a distinguishing signal. It is
    # the obvious witness and it is often the wrong one: it moves only when
    # site.json or data/resources.json move.
    stamp_expected, stamp_reference = data_stamp_of(expected), data_stamp_of(reference)
    if stamp_expected is None:
        findings.append(("3 data stamp", INCONCLUSIVE, "the stamped data files are absent at this commit"))
    elif stamp_expected == stamp_reference:
        findings.append(("3 data stamp", INCONCLUSIVE,
                         "unchanged since the reference commit, so it cannot distinguish them "
                         "(it moves only when site.json or data/resources.json move)"))
    else:
        status, body = transport.get_bytes(base_url.rstrip("/") + "/")
        text = body.decode("utf-8", errors="replace")
        want_first = stamp_expected.split(",")[0]
        if status != 200:
            findings.append(("3 data stamp", FAIL, f"origin answered HTTP {status} for /"))
        elif want_first in text:
            findings.append(("3 data stamp", PASS, f"served stamp carries {want_first}"))
        else:
            findings.append(("3 data stamp", FAIL, f"served / does not carry the expected stamp {want_first}"))

    return findings


def verdict(findings: list[tuple[str, str, str]]) -> str:
    return FAIL if any(state == FAIL for _, state, _ in findings) else PASS


def report(attempt: int, findings: list[tuple[str, str, str]]) -> None:
    print(f"--- attempt {attempt} ---")
    for layer, state, detail in findings:
        print(f"  [{state}] {layer}: {detail}")


def run(transport: Transport, expected: str, base_url: str, repo: str, delays=RETRY_DELAYS,
        sleeper=time.sleep) -> tuple[str, list[tuple[str, str, str]]]:
    """Retry while provenance does not match - the signal that actually moves.

    The old matrix retried on a non-200, which a pre-existing route never
    produces. This waits on the thing that is genuinely still settling.
    """
    attempt = 0
    findings: list[tuple[str, str, str]] = []
    for delay in (0, *delays):
        if delay:
            print(f"--- provenance not yet matched; waiting {delay}s ---")
            sleeper(delay)
        attempt += 1
        findings = check_once(transport, expected, base_url, repo)
        report(attempt, findings)
        if verdict(findings) == PASS:
            return PASS, findings
    return FAIL, findings


# --------------------------------------------------------------------------
# Controls. A check nobody has seen fail is not evidence - that is the whole
# lesson of the run this tool replaces, so the negative control is not optional.
# --------------------------------------------------------------------------

class FakeTransport(Transport):
    def __init__(self, deployed: str | None, files: dict[str, bytes]):
        self.deployed, self.files = deployed, files

    def get_json(self, url: str, timeout: float = 30.0):
        if "pages/builds/latest" in url:
            raise urllib.error.URLError("no pages access in the control")
        return [{"sha": self.deployed}] if self.deployed else []

    def get_bytes(self, url: str, timeout: float = 30.0) -> tuple[int, bytes]:
        path = url.split("://", 1)[-1].split("/", 1)[-1]
        return self.files.get("/" + path, (404, b""))


def self_test() -> int:
    """Every control runs; none of them stops the others."""
    head = resolve("HEAD")
    parent = resolve("HEAD^")
    if not head or not parent:
        print("  [ERROR] controls need at least two commits of history", file=sys.stderr)
        return 1

    # The controls need a commit pair that actually changed a served file, or
    # Layer 3 has no witness and the control silently stops testing what it
    # tests. Found rather than assumed: a branch whose last commit touches only
    # tools/ and docs/ - which is exactly what happened the first time this ran
    # - would otherwise have produced a passing control that exercised nothing.
    pair = witness_pair()
    if pair is None:
        print("  [ERROR] no commit in recent history changes a served file, so the "
              "Layer 3 controls cannot be built", file=sys.stderr)
        return 1
    witness_parent, witness_commit = pair

    def live_files(sha: str) -> dict[str, bytes]:
        served = {}
        for rel in changed_served_files(witness_parent, witness_commit)[:3]:
            blob = committed_bytes(sha, rel)
            if blob is not None:
                served["/" + served_url(rel).lstrip("/")] = (200, blob)
        stamp = data_stamp_of(sha)
        served["/"] = (200, f"<html>{stamp}</html>".encode())
        return served

    problems = 0
    results: list[tuple[str, str, str]] = []

    def control(name: str, transport: Transport, expected: str, want_state: str, needle: str):
        nonlocal problems
        findings = check_once(transport, expected, "https://example.invalid/", "o/r")
        got = verdict(findings)
        blob = " | ".join(f"{layer}: {detail}" for layer, _, detail in findings)
        if got != want_state:
            results.append((name, FAIL, f"expected {want_state}, got {got} ({blob})"))
            problems += 1
        elif needle and needle not in blob:
            # A control that reached the wrong gate is not a control.
            results.append((name, FAIL, f"{got} as expected, but for the wrong reason ({blob})"))
            problems += 1
        else:
            results.append((name, PASS, f"{got}: {needle or 'as expected'}"))

    # The mandatory one: a commit that is not deployed must go red.
    control("an undeployed SHA goes red",
            FakeTransport(deployed=witness_parent, files=live_files(witness_parent)),
            witness_commit, FAIL, "expected")

    control("no deployment at all goes red",
            FakeTransport(deployed=None, files={}),
            witness_commit, FAIL, "no source could say")

    control("the origin serving other bytes goes red",
            FakeTransport(deployed=witness_commit, files={"/": (200, b"<html>stale</html>")}),
            witness_commit, FAIL, "origin answered HTTP 404")

    control("a matching deployment passes",
            FakeTransport(deployed=witness_commit, files=live_files(witness_commit)),
            witness_commit, PASS, "deployed commit is")

    # The four-state discipline: no witness must read as inconclusive, never as
    # a pass earned at the origin.
    empty = check_once(FakeTransport(deployed=witness_commit, files=live_files(witness_commit)), witness_commit,
                       "https://example.invalid/", "o/r")
    witness_states = [state for layer, state, _ in empty if layer.startswith("3 ")]
    if INCONCLUSIVE not in witness_states and PASS not in witness_states:
        results.append(("layer 3 reports a state at all", FAIL, str(witness_states)))
        problems += 1
    else:
        results.append(("layer 3 reports a state at all", PASS, ", ".join(sorted(set(witness_states)))))

    print("Deployment provenance controls:")
    for name, state, detail in results:
        line = f"  [{state}] {name} - {detail}"
        print(line) if state == PASS else print(line, file=sys.stderr)
    print(f"  {sum(1 for _, s, _ in results if s == PASS)} passed · {problems} failed")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    # No default. A provenance check that will happily verify "whatever is
    # checked out" is how the old matrix ended up reporting on a deployment
    # that did not exist.
    parser.add_argument("--expected-sha", help="the commit the origin must be serving")
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--no-retry", action="store_true", help="one attempt, for controls")
    parser.add_argument("--must-not-be-deployed", action="store_true",
                        help="live negative control: assert this SHA is NOT what is served")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if not args.expected_sha:
        raise SystemExit("--expected-sha is required; this tool will not guess what it is verifying")

    expected = resolve(args.expected_sha) or args.expected_sha
    transport = Transport()

    if args.must_not_be_deployed:
        findings = check_once(transport, expected, args.base_url, args.repo)
        report(1, findings)
        # Judge on Layer 2 alone. The overall verdict is the wrong thing to read
        # here: this control asserts a SHA is *not* deployed, and Layer 3 can go
        # red for reasons that have nothing to do with the SHA - an unreachable
        # origin, for one - which would let the control claim success while
        # never reaching the gate it tests.
        layer2 = [(state, detail) for layer, state, detail in findings if layer.startswith("2 ")]
        if not layer2:
            print("[ERROR] the control produced no Layer 2 finding at all", file=sys.stderr)
            return 1
        state, detail = layer2[0]
        if state == PASS:
            print(f"[ERROR] control premise is false: {short(expected)} IS the deployed commit, "
                  f"so it cannot serve as a negative control. Pass a commit that is not deployed.",
                  file=sys.stderr)
            return 1
        if "expected" not in detail and "no source" not in detail:
            print(f"[FAIL] Layer 2 went red, but not because of the SHA - "
                  f"it did not reach the gate it tests ({detail})", file=sys.stderr)
            return 1
        print(f"[PASS] control: an undeployed commit is rejected ({detail})")
        return 0

    state, findings = run(transport, expected, args.base_url, args.repo,
                          delays=() if args.no_retry else RETRY_DELAYS)
    if state == PASS:
        print(f"[PASS] the origin is serving {expected[:7]}")
        return 0
    print(f"[FAIL] the origin is not provably serving {expected[:7]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
