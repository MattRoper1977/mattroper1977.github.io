#!/usr/bin/env python3
"""Verify the curated external education resources.

These forty entries point at statutory guidance. A stale one is not a broken
link, it is a teacher reading last year's safeguarding rules, so the checks
here are about whether the metadata can be trusted rather than whether the page
loads - that is check_education_hub_links.py's job.

The load-bearing rule is that **status is derived from dates, never asserted**.
An entry does not get to say it is current. `effectiveFrom` in the future means
upcoming; past `effectiveTo` means superseded; a start date with no expiry means
current; no dates at all means evergreen. Newest publication date is never proof
of current status, which is why KCSIE 2025 and KCSIE 2026 can and must coexist,
each labelled for the period it governs.

That derivation is also implemented in assets/mbm-search.js, which is what a
visitor's browser actually runs. Holding a second copy of the rule here would be
the drift trap this estate keeps falling into, so the shape of the rule is
asserted against that file rather than assumed.

Usage:
  python3 tools/verify_education_hub.py --as-of 2026-08-09
  python3 tools/verify_education_hub.py --as-of 2026-08-09 --self-test
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "education-hub.json"
SEARCH_JS = ROOT / "assets" / "mbm-search.js"

REQUIRED_FIELDS = [
    "id", "title", "source", "category", "topic", "type", "format",
    "jurisdiction", "audience", "lastReviewed", "url", "summary",
]

# The committed shape. Asserted so that a resource quietly disappearing, or a
# jurisdiction balance shifting, is a visible event rather than a silent one.
EXPECTED_RESOURCES = 40
EXPECTED_FAMILIES = 11
EXPECTED_JURISDICTIONS = {"England": 22, "UK-wide": 18}

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def derive_status(resource: dict[str, Any], as_of: str) -> str:
    """Mirror of deriveStatus() in assets/mbm-search.js."""
    start = resource.get("effectiveFrom") or ""
    end = resource.get("effectiveTo") or ""
    if start and as_of < start:
        return "upcoming"
    if end and as_of > end:
        return "superseded"
    if start:
        return "current"
    return "evergreen"


def check_browser_rule_matches(errors: list[str]) -> None:
    """The browser runs its own copy of the rule; make divergence visible."""
    if not SEARCH_JS.is_file():
        errors.append("assets/mbm-search.js is missing, so the browser status rule cannot be checked")
        return
    source = SEARCH_JS.read_text(encoding="utf-8")
    if "function deriveStatus(" not in source:
        errors.append("assets/mbm-search.js no longer defines deriveStatus()")
        return
    body = source[source.index("function deriveStatus("):]
    body = body[: body.index("\n  }") + 4]
    for fragment, meaning in [
        ("today<from", "upcoming when effectiveFrom is in the future"),
        ("today>to", "superseded after effectiveTo"),
        ("'current'", "current inside the effective period"),
        ("'evergreen'", "evergreen when undated"),
    ]:
        if fragment.replace(" ", "") not in body.replace(" ", ""):
            errors.append(f"browser status rule no longer implements: {meaning}")


def valid_date(value: str) -> bool:
    if not isinstance(value, str) or not DATE.match(value):
        return False
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        return False
    return True


def check(data: dict[str, Any], as_of: str) -> list[str]:
    errors: list[str] = []
    resources = data.get("resources") or []
    families = data.get("sourceFamilies") or []

    if data.get("schemaVersion") != 1:
        errors.append(f"unexpected schemaVersion: {data.get('schemaVersion')!r}")
    if not valid_date(data.get("reviewedAt", "")):
        errors.append(f"reviewedAt is not a valid date: {data.get('reviewedAt')!r}")

    if len(resources) != EXPECTED_RESOURCES:
        errors.append(f"{len(resources)} resources, expected {EXPECTED_RESOURCES}")
    if len(families) != EXPECTED_FAMILIES:
        errors.append(f"{len(families)} source families, expected {EXPECTED_FAMILIES}")

    approved: set[str] = set()
    for family in families:
        if not family.get("name"):
            errors.append("a source family has no name")
        for domain in family.get("domains") or []:
            approved.add(domain.lower())
    if not approved:
        errors.append("no approved domains declared, so domain drift cannot be detected")

    seen_ids: set[str] = set()
    seen_urls: dict[str, str] = {}
    family_names = {f.get("name") for f in families}
    jurisdictions: dict[str, int] = {}

    for resource in resources:
        rid = resource.get("id", "<no id>")

        for field in REQUIRED_FIELDS:
            if not resource.get(field):
                errors.append(f"{rid}: missing {field}")

        if rid in seen_ids:
            errors.append(f"{rid}: duplicate id")
        seen_ids.add(rid)

        url = resource.get("url", "")
        parsed = urlparse(url)
        if parsed.scheme != "https":
            errors.append(f"{rid}: url is not https: {url}")
        host = parsed.netloc.lower()
        if host and host not in approved:
            errors.append(f"{rid}: {host} is not a declared approved domain")
        if url in seen_urls:
            errors.append(f"{rid}: duplicate url, already used by {seen_urls[url]}")
        seen_urls[url] = rid

        if resource.get("source") not in family_names:
            errors.append(f"{rid}: source {resource.get('source')!r} is not a declared source family")

        audience = resource.get("audience")
        if not isinstance(audience, list) or not audience:
            errors.append(f"{rid}: audience must be a non-empty list")

        jurisdiction = resource.get("jurisdiction")
        if jurisdiction:
            jurisdictions[jurisdiction] = jurisdictions.get(jurisdiction, 0) + 1

        for field in ("lastReviewed", "effectiveFrom", "effectiveTo"):
            value = resource.get(field)
            if value and not valid_date(value):
                errors.append(f"{rid}: {field} is not a valid date: {value!r}")

        start, end = resource.get("effectiveFrom"), resource.get("effectiveTo")
        if start and end and valid_date(start) and valid_date(end) and end < start:
            errors.append(f"{rid}: effectiveTo {end} precedes effectiveFrom {start}")

        reviewed = resource.get("lastReviewed")
        if reviewed and valid_date(reviewed) and reviewed > as_of:
            errors.append(f"{rid}: lastReviewed {reviewed} is after the as-of date {as_of}")

    if jurisdictions != EXPECTED_JURISDICTIONS:
        errors.append(f"jurisdiction balance is {jurisdictions}, expected {EXPECTED_JURISDICTIONS}")

    check_browser_rule_matches(errors)

    # Where a current and a future edition of the same guidance coexist, both
    # must be present and separately labelled - a reader planning for September
    # needs to see the edition that has not started yet.
    by_title_stem: dict[str, list[tuple[str, str]]] = {}
    for resource in resources:
        stem = re.sub(r"\s*(19|20)\d{2}\s*$", "", resource.get("title", "")).strip().lower()
        by_title_stem.setdefault(stem, []).append((resource["id"], derive_status(resource, as_of)))
    for stem, entries in by_title_stem.items():
        statuses = {s for _, s in entries}
        if len(entries) > 1 and len(statuses) == 1 and "current" in statuses:
            errors.append(
                f"{len(entries)} editions of {stem!r} all derive as current; "
                "coexisting editions must be distinguishable by date"
            )

    return errors


def summarise(data: dict[str, Any], as_of: str) -> None:
    counts: dict[str, int] = {}
    for resource in data["resources"]:
        status = derive_status(resource, as_of)
        counts[status] = counts.get(status, 0) + 1
    print(f"  as of {as_of}: " + " · ".join(f"{k} {v}" for k, v in sorted(counts.items())))


def self_test(as_of: str) -> None:
    """Each control breaks one guarantee on a copy, never on the committed file."""
    base = json.loads(DATA.read_text(encoding="utf-8"))
    controls: list[tuple[str, Any, str]] = []

    def mutate(label: str, fn, expect: str) -> None:
        copy = json.loads(json.dumps(base))
        fn(copy)
        controls.append((label, copy, expect))

    def future_marked_current(d):
        # A future edition dated as if it had already started.
        d["resources"][0]["effectiveFrom"] = "2099-01-01"
        d["resources"][0]["effectiveTo"] = "2098-01-01"
    mutate("effectiveTo precedes effectiveFrom", future_marked_current, "precedes effectiveFrom")

    mutate("missing lastReviewed",
           lambda d: d["resources"][1].pop("lastReviewed", None), "missing lastReviewed")
    mutate("missing jurisdiction",
           lambda d: d["resources"][2].pop("jurisdiction", None), "missing jurisdiction")
    mutate("unapproved domain drift",
           lambda d: d["resources"][3].update(url="https://example.invalid/guidance"),
           "not a declared approved domain")
    mutate("non-https url",
           lambda d: d["resources"][4].update(url="http://www.gov.uk/education"), "not https")
    mutate("duplicate id",
           lambda d: d["resources"][5].update(id=d["resources"][0]["id"]), "duplicate id")
    mutate("duplicate url",
           lambda d: d["resources"][6].update(url=d["resources"][0]["url"]), "duplicate url")
    mutate("resource silently dropped",
           lambda d: d["resources"].pop(), f"expected {EXPECTED_RESOURCES}")
    mutate("lastReviewed in the future",
           lambda d: d["resources"][7].update(lastReviewed="2099-01-01"), "after the as-of date")

    failures = 0
    for label, mutated, expect in controls:
        found = check(mutated, as_of)
        if any(expect in item for item in found):
            print(f"  [PASS] control detected: {label}")
        else:
            print(f"  [FAIL] control NOT detected: {label}", file=sys.stderr)
            for item in found[:3]:
                print(f"           saw: {item}", file=sys.stderr)
            failures += 1

    restored = check(base, as_of)
    if restored:
        print("  [FAIL] committed data does not verify after the controls", file=sys.stderr)
        for item in restored[:5]:
            print(f"    - {item}", file=sys.stderr)
        failures += 1
    else:
        print(f"  [PASS] committed data verifies after {len(controls)} positive controls")

    if failures:
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", help="evaluate status as at this date (defaults to the file's asOf)")
    parser.add_argument("--self-test", action="store_true", help="prove each check can fail")
    args = parser.parse_args()

    data = json.loads(DATA.read_text(encoding="utf-8"))
    as_of = args.as_of or data.get("asOf")
    if not valid_date(as_of or ""):
        raise SystemExit(f"--as-of must be an ISO date, got {as_of!r}")

    errors = check(data, as_of)
    print(f"Education hub: {len(data.get('resources', []))} resources across "
          f"{len(data.get('sourceFamilies', []))} publishers")
    summarise(data, as_of)

    if errors:
        print("\nEducation hub failures:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        raise SystemExit(1)

    print("  every resource has a declared publisher, an approved https domain and a derived status")

    if args.self_test:
        print("\nPositive controls:")
        self_test(as_of)


if __name__ == "__main__":
    main()
