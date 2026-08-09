#!/usr/bin/env python3
"""Check that the curated external education links still reach their publisher.

Three outcomes, and the distinction between the last two is the whole point:

  ok             reached the publisher, on an approved domain
  broken         the resource is gone, or has drifted off its approved domain
  review-needed  we could not tell - rate limiting, bot protection, a timeout

A checker that reports "broken" when it was merely rate-limited produces alarms
nobody trusts, and a distrusted alarm is worse than none: the next real
breakage gets waved through with the rest. So an inconclusive response is never
reported as broken, and the run does not fail on it.

What counts as broken:
  * 404, 410, or any 4xx that is not an access/rate-limit signal
  * a redirect chain ending on a domain outside the declared approved set -
    that is a publisher moving content somewhere we have not vetted, which is
    exactly what this check exists to catch

What counts as review-needed:
  * 401, 403, 407, 429 - access control or rate limiting, not absence
  * 5xx, timeouts, DNS and TLS failures - the publisher or the network, not us

Redirects are followed and the final domain is validated. Sources that reject
HEAD are retried with GET. Response bodies are never stored or republished -
only the status, the final URL and its domain are recorded.

The report is written whatever the outcome, including when every entry is
review-needed, so an artifact upload can never fail for want of a file.

Usage:
  python3 tools/check_education_hub_links.py --timeout 18 --workers 4 \\
      --report artifacts/education-hub-links.json
  python3 tools/check_education_hub_links.py --self-test
"""
from __future__ import annotations

import argparse
import json
import socket
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "education-hub.json"

USER_AGENT = (
    "Mozilla/5.0 (compatible; MadeByMattLinkCheck/1.0; "
    "+https://madebymatt.uk/education-hub/)"
)

OK = "ok"
BROKEN = "broken"
REVIEW = "review-needed"

# Access control and rate limiting say "not to you, not now" - never "gone".
INCONCLUSIVE_STATUS = {401, 403, 407, 408, 429}


def approved_domains(data: dict[str, Any]) -> set[str]:
    return {
        domain.lower()
        for family in data.get("sourceFamilies", [])
        for domain in family.get("domains", [])
    }


def classify(status: int | None, error: str | None, final_host: str, approved: set[str]) -> tuple[str, str]:
    if error is not None:
        return REVIEW, error
    assert status is not None
    if status in INCONCLUSIVE_STATUS:
        return REVIEW, f"HTTP {status} - access control or rate limiting, not absence"
    if status >= 500:
        return REVIEW, f"HTTP {status} - publisher-side error"
    if status >= 400:
        return BROKEN, f"HTTP {status}"
    if final_host and final_host not in approved:
        return BROKEN, f"redirected off the approved domains to {final_host}"
    return OK, f"HTTP {status}"


def fetch(url: str, timeout: float) -> tuple[int | None, str | None, str]:
    """Return (status, error, final_url). Bodies are never read or retained."""
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, None, response.geturl()
        except urllib.error.HTTPError as exc:
            # A source that rejects HEAD is common; try GET before believing it.
            if method == "HEAD" and exc.code in (400, 403, 405, 501):
                continue
            return exc.code, None, exc.url or url
        except urllib.error.URLError as exc:
            reason = exc.reason
            if isinstance(reason, ssl.SSLError):
                return None, f"TLS failure: {reason}", url
            if isinstance(reason, socket.timeout):
                return None, "timed out", url
            return None, f"network failure: {reason}", url
        except socket.timeout:
            return None, "timed out", url
        except Exception as exc:  # noqa: BLE001 - a checker must not die on one link
            return None, f"{type(exc).__name__}: {exc}", url
    return None, "no response", url


def check_all(
    data: dict[str, Any],
    timeout: float,
    workers: int,
    fetcher: Callable[[str, float], tuple[int | None, str | None, str]] = fetch,
) -> list[dict[str, Any]]:
    approved = approved_domains(data)

    def one(resource: dict[str, Any]) -> dict[str, Any]:
        url = resource["url"]
        status, error, final = fetcher(url, timeout)
        final_host = urlparse(final).netloc.lower()
        outcome, detail = classify(status, error, final_host, approved)
        return {
            "id": resource["id"],
            "source": resource.get("source"),
            "url": url,
            "finalUrl": final if final != url else None,
            "finalDomain": final_host or None,
            "httpStatus": status,
            "outcome": outcome,
            "detail": detail,
        }

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        return list(pool.map(one, data.get("resources", [])))


def write_report(path: Path, as_of: str, results: list[dict[str, Any]]) -> None:
    """Always written, whatever the outcome - an artifact step must never fail
    for want of a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for result in results:
        counts[result["outcome"]] = counts.get(result["outcome"], 0) + 1
    path.write_text(json.dumps({
        "asOf": as_of,
        "checked": len(results),
        "counts": counts,
        "results": results,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def self_test() -> None:
    """Offline controls. The review-needed direction matters most: it is the one
    that turns into false alarms and gets the whole check ignored."""
    data = json.loads(DATA.read_text(encoding="utf-8"))
    sample = {"sourceFamilies": data["sourceFamilies"], "resources": data["resources"][:1]}
    url = sample["resources"][0]["url"]

    cases = [
        ("healthy publisher", lambda u, t: (200, None, u), OK),
        ("gone (404)", lambda u, t: (404, None, u), BROKEN),
        ("gone (410)", lambda u, t: (410, None, u), BROKEN),
        ("rate limited (429)", lambda u, t: (429, None, u), REVIEW),
        ("bot protection (403)", lambda u, t: (403, None, u), REVIEW),
        ("publisher error (503)", lambda u, t: (503, None, u), REVIEW),
        ("timeout", lambda u, t: (None, "timed out", u), REVIEW),
        ("TLS failure", lambda u, t: (None, "TLS failure: bad handshake", u), REVIEW),
        ("legitimate redirect, same publisher",
         lambda u, t: (200, None, "https://www.gov.uk/moved-here"), OK),
        ("redirect off the approved domains",
         lambda u, t: (200, None, "https://cdn.example.invalid/thing"), BROKEN),
    ]

    failures = 0
    for label, fetcher, expected in cases:
        outcome = check_all(sample, 1.0, 1, fetcher)[0]["outcome"]
        if outcome == expected:
            print(f"  [PASS] {label} -> {outcome}")
        else:
            print(f"  [FAIL] {label} -> {outcome}, expected {expected}", file=sys.stderr)
            failures += 1

    # The report must exist even when nothing was conclusive.
    scratch = ROOT / "artifacts" / "_selftest-links.json"
    write_report(scratch, "self-test", check_all(sample, 1.0, 1, lambda u, t: (429, None, u)))
    if scratch.is_file() and json.loads(scratch.read_text())["counts"].get(REVIEW):
        print("  [PASS] report written even when every entry is review-needed")
    else:
        print("  [FAIL] report missing for an all-review-needed run", file=sys.stderr)
        failures += 1
    scratch.unlink(missing_ok=True)

    if failures:
        raise SystemExit(1)
    print(f"  [PASS] {len(cases)} classification controls")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=18.0)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        print("Classification controls:")
        self_test()
        return

    data = json.loads(DATA.read_text(encoding="utf-8"))
    results = check_all(data, args.timeout, args.workers)

    if args.report:
        write_report(args.report, data.get("asOf", ""), results)

    broken = [r for r in results if r["outcome"] == BROKEN]
    review = [r for r in results if r["outcome"] == REVIEW]
    print(f"Checked {len(results)} official links: "
          f"{len(results) - len(broken) - len(review)} ok · {len(broken)} broken · {len(review)} review-needed")
    for result in review:
        print(f"  review-needed  {result['id']}: {result['detail']}")
    for result in broken:
        print(f"  BROKEN         {result['id']}: {result['detail']}", file=sys.stderr)

    if broken:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
