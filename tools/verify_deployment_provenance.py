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
import ast
import hashlib
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = "https://madebymatt.uk/"
DEFAULT_REPO = "MattRoper1977/mattroper1977.github.io"
PUBLISHED_ROOT = None
PUBLISHED_SHA = None
EDUCATION_OUTPUT_WITNESSES = (
    "index.html", "main/index.html", "resources/index.html", "tools/index.html",
    "for/teachers/index.html", "for/pupils/index.html", "data/domain-catalogue.json",
    "data/resource-collections.json", "data/resource-discovery.json",
)


def expected_bytes(sha, rel):
    if PUBLISHED_ROOT is None:
        return committed_bytes(sha, rel)
    if sha != PUBLISHED_SHA:
        raise ValueError("Publication artifact belongs to another expected SHA")
    target = (PUBLISHED_ROOT / rel).resolve()
    if not target.is_relative_to(PUBLISHED_ROOT.resolve()):
        raise ValueError("Publication path escapes the artifact")
    return target.read_bytes() if target.is_file() else None


# Paths in this repository that GitHub Pages does not serve as site content.
# A witness has to be something a visitor could actually download, or comparing
# it against the origin proves nothing.
NOT_SERVED = (
    "tools/", ".github/", "docs/", "reports/", "audit-output/", "supabase/",
    "domain-split/",
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


class EducationTransport(Transport):
    """The production byte proof cannot change origin, path or HTTPS scheme."""

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, newurl):
            return None  # urllib raises HTTPError for the original 3xx response

    def get_bytes(self, url: str, timeout: float = 30.0) -> tuple[int, bytes]:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "madebymatt.uk" or parsed.fragment:
            raise ValueError("Education publication proof requires the canonical HTTPS origin")
        request = urllib.request.Request(url, headers={
            "User-Agent": "mbm-education-publication-provenance", "Cache-Control": "no-cache",
        })
        try:
            opener = urllib.request.build_opener(self.NoRedirect())
            with opener.open(request, timeout=timeout) as response:
                if response.geturl() != url:
                    raise urllib.error.URLError("Education publication response changed its destination")
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            code = error.code
            error.close()
            return code, b""
        except (urllib.error.URLError, OSError):
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
    # Pages omits dotfiles at any depth. The publication builder is also
    # development-only, so neither is evidence of what visitors can download.
    if any(part.startswith(".") for part in Path(rel).parts):
        return False
    return not any(rel == prefix or rel.startswith(prefix) for prefix in NOT_SERVED)


def changed_served_files(base: str, expected: str) -> list[str]:
    code, out = git("diff", "--name-only", base, expected)
    if code != 0:
        return []
    return sorted(rel for rel in out.splitlines() if rel and is_served(rel))


def committed_bytes(sha: str, rel: str) -> bytes | None:
    code, out = git_bytes("show", f"{sha}:{rel}")
    return out if code == 0 else None


def education_generator_inputs(sha: str) -> set[str]:
    """Read the publisher's explicit policy at the expected immutable source.

    Parse only the literal declaration; never execute historical builder code
    or infer an exclusion from a missing publication file.
    """
    source = committed_bytes(sha, "domain-split/build_education.py")
    if source is None:
        raise ValueError("expected source has no education publisher policy")
    try:
        declarations = [node.value for node in ast.parse(source).body
                        if isinstance(node, ast.Assign) and any(
                            isinstance(target, ast.Name) and target.id == "SITE_GENERATOR_INPUTS"
                            for target in node.targets)]
        if len(declarations) != 1:
            raise ValueError("expected one SITE_GENERATOR_INPUTS declaration")
        paths = ast.literal_eval(declarations[0])
        if not isinstance(paths, set) or not paths or any(
                not isinstance(path, str) or not path or path.startswith("/")
                or "\\" in path or any(part in {"", ".", ".."} for part in path.split("/"))
                or "?" in path or "#" in path for path in paths):
            raise ValueError("invalid SITE_GENERATOR_INPUTS paths")
        return paths
    except (SyntaxError, TypeError, ValueError) as error:
        raise ValueError(f"invalid expected publisher exclusion policy: {error}") from error


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


def witness_pair() -> tuple[str, str] | None:
    """The most recent (parent, commit) where a *served* file changed.

    The controls need a pair Layer 3 can actually witness. Taking HEAD and its
    parent looked obvious and was wrong: a commit touching only tools/ and
    docs/ leaves no witness, and the control then passes having exercised
    nothing - species 3, in the tool written to demonstrate species 3.
    """
    code, out = git("rev-list", "HEAD")
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

    source_witnesses = changed_served_files(reference, expected)
    if PUBLISHED_ROOT is not None:
        try:
            if expected != PUBLISHED_SHA:
                raise ValueError("Publication artifact belongs to another expected SHA")
            excluded = education_generator_inputs(expected)
            if excluded.intersection(EDUCATION_OUTPUT_WITNESSES):
                raise ValueError("publisher exclusion conflicts with mandatory output witnesses")
        except ValueError as error:
            findings.append(("3 publisher exclusion policy", FAIL, str(error)))
            return findings
        # Excluded inputs are negative witnesses, not omitted checks. Check the
        # complete explicit set, even on commits changing only another file.
        for rel in sorted(excluded):
            local = PUBLISHED_ROOT / rel
            if local.exists() or local.is_symlink():
                findings.append((f"3 excluded input {rel}", FAIL,
                                 "publisher-excluded input leaked into the publication artifact"))
            status, _ = transport.get_bytes(base_url.rstrip("/") + served_url(rel))
            findings.append((f"3 excluded input {rel}", PASS if status == 404 else FAIL,
                             "publisher-excluded input is absent at origin (HTTP 404)" if status == 404
                             else f"excluded input must answer HTTP 404, origin answered HTTP {status}"))
        source_witnesses = [rel for rel in source_witnesses if rel not in excluded]
        # Builder-only commits have no changed raw public-source path. Always
        # inspect the real outputs named by the education publication contract,
        # then include every public source path that changed. A passing deploy
        # API result cannot replace these actual origin byte comparisons.
        witnesses = list(dict.fromkeys(EDUCATION_OUTPUT_WITNESSES + tuple(source_witnesses)))
    else:
        witnesses = source_witnesses[:3]
    if not witnesses:
        findings.append(("3 origin witness", INCONCLUSIVE,
                         f"no served file differs between {short(reference)} and {short(expected)}, so the "
                         f"origin cannot tell them apart. Layer 2 carries the proof for this deployment"))
        return findings

    # Legacy mode checks up to three changed-source witnesses. Education
    # mode checks every mandatory published output and changed public path.
    for rel in witnesses:
        want = expected_bytes(expected, rel)
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
                             f"served sha256 {sha256(body)[:12]} != expected publication {sha256(want)[:12]} "
                             f"- the origin is serving other bytes for this path"))
        else:
            findings.append((f"3 origin witness {rel}", PASS,
                             f"served bytes match the source-bound publication ({sha256(want)[:12]})"))

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
        elif PUBLISHED_ROOT is not None:
            wanted_home = expected_bytes(expected, "index.html")
            if wanted_home is not None and body == wanted_home:
                findings.append(("3 published homepage", PASS,
                                 "complete homepage bytes match the successful publication artifact"))
            else:
                findings.append(("3 published homepage", FAIL,
                                 "homepage differs from the successful publication artifact"))
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


def witness_history_controls() -> None:
    """An actual old served-file change must survive arbitrary tooling history."""
    global ROOT
    original_root = ROOT
    try:
        with tempfile.TemporaryDirectory(prefix="provenance-history-") as temporary:
            ROOT = Path(temporary)
            assert witness_pair() is None, "Unreadable Git history cannot supply a witness"
            def run(*args):
                code, output = git(*args)
                assert code == 0, (args, output)
                return output.strip()
            def commit(message):
                run("add", ".")
                run("-c", "user.name=HC3 fixture", "-c", "user.email=fixture@example.invalid",
                    "commit", "--quiet", "-m", message)
                return resolve("HEAD")
            run("init", "--quiet")
            (ROOT / "docs").mkdir()
            (ROOT / "docs/note.md").write_text("No published content yet\n")
            commit("Documentation only")
            assert witness_pair() is None, "No served-file history must remain inconclusive"
            (ROOT / "index.html").write_text("<!doctype html><title>Before</title>\n")
            before = commit("Original served page")
            (ROOT / "index.html").write_text("<!doctype html><title>After</title>\n")
            after = commit("Changed served page")
            for index in range(45):
                (ROOT / "docs/note.md").write_text("Tooling-only history " + str(index) + "\n")
                commit("Documentation history " + str(index))
            assert witness_pair() == (before, after), "Older served-file witness was hidden by tooling history"
    finally:
        ROOT = original_root


def education_exclusion_controls() -> list[tuple[str, str, str]]:
    """Exercise the publication path, including intentional absence and leaks."""
    from unittest.mock import patch
    module = sys.modules[__name__]
    head = resolve("HEAD")
    excluded = education_generator_inputs(head)
    hook = "assets/arcade/rally-hooks.js"
    assert hook in excluded
    public = "assets/game-saves.js"
    stub = "driving/RallyVector.html"
    results = []
    with tempfile.TemporaryDirectory(prefix="provenance-publication-") as temp:
        root = Path(temp)
        paths = (*EDUCATION_OUTPUT_WITNESSES, public, stub)
        files = {}
        for rel in paths:
            target = root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(("published fixture " + rel).encode())
            files[served_url(rel)] = (200, target.read_bytes())

        def prove(name, want=FAIL, needle="", served=None, deployed=None):
            findings = check_once(FakeTransport(deployed=deployed or head,
                                                files=files if served is None else served),
                                  head, "https://example.invalid/", "o/r")
            assert verdict(findings) == want, (name, findings)
            assert any(needle in detail and state == want for _, state, detail in findings), (name, findings)
            if want == PASS:
                matched = {layer.removeprefix("3 origin witness ") for layer, state, _ in findings
                           if layer.startswith("3 origin witness ") and state == PASS}
                assert set(paths) <= matched, (name, matched)
                assert len([1 for layer, state, _ in findings
                            if layer.startswith("3 excluded input ") and state == PASS]) == len(excluded)
            results.append((name, PASS, f"{want}: {needle}"))

        with patch.object(module, "PUBLISHED_ROOT", root), patch.object(module, "PUBLISHED_SHA", head), \
                patch.object(module, "changed_served_files", return_value=[hook, public, stub]), \
                patch.object(module, "data_stamp_of", return_value=None):
            prove("education excluded input absent; all output witnesses match", PASS, "served bytes match")
            leak = root / hook
            leak.parent.mkdir(parents=True, exist_ok=True)
            leak.write_bytes(b"leak")
            prove("excluded input leaked into artifact", needle="leaked into the publication artifact")
            leak.unlink()
            for status in (200, 302, 403, 500, 0):
                prove(f"excluded origin response {status} cannot pass", needle=f"origin answered HTTP {status}",
                      served={**files, served_url(hook): (status, b"leak or error")})
            (root / public).unlink()
            prove("unlisted missing public asset cannot become an exclusion", needle="not present at the expected commit")
            (root / public).write_bytes(files[served_url(public)][1])
            prove("missing public origin asset still fails", needle="origin answered HTTP 404",
                  served={key: value for key, value in files.items() if key != served_url(public)})
            prove("stale mandatory output still fails", needle="origin is serving other bytes",
                  served={**files, "/": (200, b"stale")})
            prove("wrong deployed source SHA still fails", needle="expected", deployed=resolve("HEAD^"))
            with patch.object(module, "PUBLISHED_SHA", "0" * 40):
                prove("wrong artifact source SHA still fails", needle="another expected SHA")
            with patch.object(module, "committed_bytes", return_value=None):
                prove("missing source policy fails closed", needle="no education publisher policy")
            with patch.object(module, "committed_bytes", return_value=b"SITE_GENERATOR_INPUTS = {'../escape'}"):
                prove("unsafe exclusion policy fails closed", needle="invalid SITE_GENERATOR_INPUTS")
            with patch.object(module, "committed_bytes", return_value=b"SITE_GENERATOR_INPUTS = {'index.html'}"):
                prove("mandatory outputs cannot be excluded", needle="conflicts with mandatory output")
            policy = committed_bytes(head, "domain-split/build_education.py")
            with patch.object(module, "committed_bytes", return_value=policy) as reader:
                assert education_generator_inputs(head) == excluded
                reader.assert_called_once_with(head, "domain-split/build_education.py")
            results.append(("policy is read at the expected immutable SHA", PASS, head))
            prove("education publication restores green", PASS, "served bytes match")
    return results


def self_test() -> int:
    """Every control runs; none of them stops the others."""
    witness_history_controls()
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
        print("  [ERROR] no commit in available history changes a served file, so the "
              "Layer 3 controls cannot be built", file=sys.stderr)
        return 1
    witness_parent, witness_commit = pair

    def live_files(sha: str) -> dict[str, bytes]:
        served = {}
        for rel in changed_served_files(witness_parent, witness_commit)[:3]:
            blob = committed_bytes(sha, rel)
            if blob is not None:
                served["/" + served_url(rel).lstrip("/")] = (200, blob)
        # The stamp fixture serves "/", and so does index.html when the root is
        # itself a witness - which it became the first time a commit changed the
        # root page. Writing the stamp unconditionally clobbered the real bytes
        # and failed the control on a fixture collision rather than on anything
        # about the tool. Only stand in for "/" when nothing else claims it.
        if "/" not in served:
            served["/"] = (200, f"<html>{data_stamp_of(sha)}</html>".encode())
        return served

    problems = 0
    results: list[tuple[str, str, str]] = education_exclusion_controls()

    # The domain-split release picked domain-split/.gitignore as its third
    # witness and failed on the expected 404. Keep the real save-transfer
    # assets eligible while rejecting builder files and nested dotfiles.
    candidates = {
        "domain-split/.gitignore": False,
        "domain-split/README.md": False,
        "domain-split/build_education.py": False,
        "assets/.gitignore": False,
        "assets/.cache/index.html": False,
        "assets/game-saves.js": True,
        "data/game-storage-allowlist.json": True,
        "game-saves/index.html": True,
    }
    wrong = [rel for rel, expected in candidates.items() if is_served(rel) != expected]
    if wrong:
        results.append(("witness selection uses public content", FAIL, ", ".join(wrong)))
        problems += 1
    else:
        results.append(("witness selection uses public content", PASS,
                        "save-transfer files eligible; builder and hidden files excluded"))

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
    parser.add_argument("--publication", choices=("legacy", "education"), default="legacy")
    parser.add_argument("--publication-output", type=Path,
                        default=Path("audit-output/deployment-publication"))
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

    if args.publication == "education":
        if args.repo != DEFAULT_REPO or args.base_url.rstrip("/") != DEFAULT_BASE.rstrip("/"):
            raise SystemExit("Education artifact provenance requires the canonical Site repository and HTTPS origin")
        from prepare_published_site import prepare
        record = prepare(expected, args.publication_output)
        global PUBLISHED_ROOT, PUBLISHED_SHA
        PUBLISHED_ROOT, PUBLISHED_SHA = Path(record["root"]), expected
        transport = EducationTransport()
        print("SOURCE-BOUND PUBLICATION " + json.dumps(record, sort_keys=True))

    state, findings = run(transport, expected, args.base_url, args.repo,
                          delays=() if args.no_retry else RETRY_DELAYS)
    if state == PASS:
        print(f"[PASS] the origin is serving {expected[:7]}")
        return 0
    print(f"[FAIL] the origin is not provably serving {expected[:7]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
