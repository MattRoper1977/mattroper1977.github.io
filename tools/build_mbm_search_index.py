#!/usr/bin/env python3
"""Regenerate data/mbm-search-index.json from its canonical sources.

The index is derived, not authored. It is built from the four source manifests
under data/source-manifests/ plus the editorial rules in
data/mbm-search-editorial.json, and nothing else. If this tool cannot reproduce
the committed file byte for byte, the generator is wrong - not the index and
not the data.

Deliberately hard to misuse. The index is 538KB of canonical routing data that
several surfaces read, and a generator that is 99% right would corrupt it
silently:

  * the default invocation compares and never writes
  * --write regenerates, byte-compares, and refuses on any difference unless
    --accept-drift is passed with a reason
  * writes go to a temp file and are moved into place atomically, never edited
    in place

Derivation, in one place so it is reviewable:

  grouping      by category, in the order lesson, resource, game, app, tool, page
  sort          within category by title.casefold()
  keywords      sorted set of subject, family and the source keywords
  tasks         data/mbm-search-editorial.json taskRules, matched as substrings
                against title + description + keywords + family + subject
  pathway       matched on word boundaries against that text plus the file path,
                so "growth" does not imply GROW and "Building" does not imply BUILD
  drops         Lessons-repo games that duplicate a Games manifest route

Usage:
  python3 tools/build_mbm_search_index.py --check
  python3 tools/build_mbm_search_index.py --check --category lesson
  python3 tools/build_mbm_search_index.py --write
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ROOT / "data" / "source-manifests"
EDITORIAL = ROOT / "data" / "mbm-search-editorial.json"
INDEX = ROOT / "data" / "mbm-search-index.json"

CATEGORY_ORDER = ["lesson", "resource", "game", "app", "tool", "page"]

# Pathway names are short and collide with ordinary English - "growth" is not
# GROW, "Building" is not BUILD - so these match on word boundaries.
PATHWAYS = [
    ("BUILD", ["build"]),
    ("GROW", ["grow"]),
    ("LAUNCH", ["launch"]),
    ("ASDAN", ["asdan"]),
    ("UAS", ["uas"]),
    ("Primary", ["primary"]),
    ("GCSE / IGCSE", ["gcse", "igcse"]),
    ("Tutor Time", ["tutor", "kcsie", "british values"]),
]

# The source manifest's `type` is the whole story for the non-lesson families:
# it decides the category, the content type, who the entry is for and whether a
# pupil should see it. Nothing here is inferred from prose.
SOURCE_TYPES = {
    "lesson":   dict(category="lesson",   contentType="Lesson"),
    "revision": dict(category="lesson",   contentType="Lesson"),
    "teacher":  dict(category="resource", contentType="Teacher resource",
                     audience=["teachers", "schools-semh"], safe=False),
    "pupil":    dict(category="resource", contentType="Pupil resource",
                     audience=["pupils", "teachers"], safe=True),
    "support":  dict(category="resource", contentType="Support resource",
                     audience=["teachers", "pupils", "schools-semh"], safe=True),
    "game":     dict(category="game",     contentType="Interactive game"),
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def source_hashes() -> dict[str, str]:
    files = {
        "lessons-resources.json": MANIFESTS / "lessons-resources.json",
        "games.json": MANIFESTS / "games.json",
        "apps.json": MANIFESTS / "apps.json",
        "provenance.json": MANIFESTS / "provenance.json",
        "mbm-search-editorial.json": EDITORIAL,
    }
    return {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}


def content_text(record: dict[str, Any]) -> str:
    return " ".join([
        record.get("title") or "",
        record.get("desc") or "",
        " ".join(record.get("keywords") or []),
        record.get("family") or "",
        record.get("subject") or "",
    ]).lower()


def word_match(text: str, terms: list[str]) -> bool:
    return any(re.search(r"\b" + re.escape(term) + r"\b", text) for term in terms)


def tasks_for(text: str, rules: dict[str, list[str]]) -> list[str] | None:
    matched = [task for task, words in rules.items() if any(word in text for word in words)]
    return matched or None


def pathway_for(text: str) -> list[str] | None:
    matched = [name for name, words in PATHWAYS if word_match(text, words)]
    return matched or None


def keywords_for(*parts: Any) -> list[str]:
    collected: set[str] = set()
    for part in parts:
        if isinstance(part, list):
            collected.update(x for x in part if x)
        elif part:
            collected.add(part)
    return sorted(collected)


def is_external(record: dict[str, Any]) -> bool:
    return (record.get("file") or "").startswith("http")


def lessons_route(record: dict[str, Any]) -> str:
    """A directory index is addressed as the directory, not the file.

    A few planning records point at the Lessons repository itself rather than a
    published page; those keep their absolute URL.
    """
    file = record["file"]
    if is_external(record):
        return file
    if file.endswith("/index.html"):
        file = file[: -len("index.html")]
    return "/Lessons/" + file


def lessons_format(record: dict[str, Any]) -> str:
    file = (record.get("file") or "").lower()
    if file.endswith(".pdf"):
        return "PDF"
    if file.startswith("http"):
        return "External repository"
    return "HTML resource"


def build_lessons_and_resources(records, rules, reclassify: set[str], dropped: set[str]):
    entries = []
    for record in records:
        if record["id"] in dropped:
            continue
        spec = SOURCE_TYPES[record["type"]]
        category = "game" if record["id"] in reclassify else spec["category"]
        text = content_text(record)
        route_text = text + " " + (record.get("file") or "").lower()

        if category == "lesson":
            content_type, audience, safe = "Lesson", ["teachers", "pupils"], True
            action = f"Open lesson: {record['title']}"
        elif category == "game":
            content_type, audience, safe = "Interactive game", ["pupils", "teachers"], True
            action = f"Play {record['title']}"
        else:
            content_type = spec["contentType"]
            audience, safe = spec["audience"], spec["safe"]
            action = f"View resource: {record['title']}"

        entry = {
            "id": f"{category}-{record['id']}",
            "sourceId": record["id"],
            "title": record["title"],
            "description": record.get("desc") or "",
            "route": lessons_route(record),
            "category": category,
            "contentType": content_type,
            "subject": record["subject"],
            "family": record.get("family"),
            "year": record.get("year"),
            "pathway": pathway_for(route_text),
            "format": lessons_format(record),
            "audience": audience,
            "source": "Lesson Hub",
            "tasks": tasks_for(text, rules),
            "keywords": keywords_for(record["subject"], record.get("family"), record.get("keywords")),
            "action": action,
            "safeForPupils": safe,
            "external": is_external(record),
        }
        # An absent pathway or task set is absent, not null - the committed
        # index omits the key entirely.
        entries.append({k: v for k, v in entry.items() if v is not None})
    return entries


def build_pages(hubs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries = []
    for hub in hubs:
        entry = {
            "id": hub["id"],
            "sourceId": hub["id"],
            "title": hub["title"],
            "description": hub["description"],
            "route": hub["route"],
            "category": "page",
            "contentType": hub["contentType"],
            "format": "Hub",
            "audience": hub["audience"],
            "source": "Made by Matt",
            "keywords": hub["keywords"],
            "action": hub["action"],
            "safeForPupils": "pupils" in hub["audience"],
            "external": False,
        }
        for optional in ("image", "tasks"):
            if hub.get(optional):
                entry[optional] = hub[optional]
        entries.append(entry)
    return entries


def serialise(index: dict[str, Any]) -> str:
    return json.dumps(index, ensure_ascii=False, indent=2) + "\n"


def committed_slice(category: str) -> list[dict[str, Any]]:
    return [e for e in load_json(INDEX)["entries"] if e["category"] == category]


def compare_slice(category: str, produced: list[dict[str, Any]]) -> list[str]:
    """Byte-compare one category against the committed index."""
    want = serialise(committed_slice(category))
    got = serialise(sorted(produced, key=lambda e: e["title"].casefold()))
    if want == got:
        return []
    want_entries = committed_slice(category)
    got_entries = sorted(produced, key=lambda e: e["title"].casefold())
    problems = []
    if len(want_entries) != len(got_entries):
        problems.append(f"{category}: {len(got_entries)} entries produced, {len(want_entries)} committed")
    for a, b in zip(want_entries, got_entries):
        if a == b:
            continue
        fields = sorted({k for k in set(a) | set(b) if a.get(k) != b.get(k)})
        problems.append(f"{category}/{a.get('sourceId')}: differs on {fields}")
    return problems[:20]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare only (the default behaviour)")
    parser.add_argument("--category", choices=CATEGORY_ORDER, help="prove one category in isolation")
    parser.add_argument("--write", action="store_true", help="write, but refuse on any difference")
    parser.add_argument("--accept-drift", metavar="REASON", help="permit --write to change the committed index")
    args = parser.parse_args()

    editorial = load_json(EDITORIAL)
    rules = editorial["taskRules"]
    reclassify = set(editorial["reclassifyAsGame"])
    records = load_json(MANIFESTS / "lessons-resources.json")

    games_routes = {g.get("file") for g in load_json(MANIFESTS / "games.json")["games"]}
    dropped = {r["id"] for r in records if r["type"] == "game" and r["id"] not in reclassify
               and (r.get("file") or "").split("/")[-1] in {(f or "").split("/")[-1] for f in games_routes if f}}

    produced: dict[str, list[dict[str, Any]]] = {c: [] for c in CATEGORY_ORDER}
    for entry in build_lessons_and_resources(records, rules, reclassify, dropped):
        produced[entry["category"]].append(entry)
    produced["page"] = build_pages(editorial["hubs"])

    categories = [args.category] if args.category else CATEGORY_ORDER
    failures: list[str] = []
    for category in categories:
        if not produced[category] and category in ("app", "tool", "game"):
            print(f"  {category:<9} NOT IMPLEMENTED", file=sys.stderr)
            failures.append(f"{category}: not implemented")
            continue
        problems = compare_slice(category, produced[category])
        status = "reproduces" if not problems else "DIFFERS"
        print(f"  {category:<9} {len(produced[category]):>4} entries  {status}")
        failures.extend(problems)

    if failures:
        print("\nGenerator does not reproduce the committed index:", file=sys.stderr)
        for failure in failures[:20]:
            print(f"  - {failure}", file=sys.stderr)
        raise SystemExit(1)

    if args.write:
        if not args.accept_drift:
            print("nothing to write: the committed index already matches", file=sys.stderr)
        else:
            index = load_json(INDEX)
            index["sourceHashes"] = source_hashes()
            index["entries"] = [e for c in CATEGORY_ORDER for e in sorted(produced[c], key=lambda x: x["title"].casefold())]
            handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=str(INDEX.parent), delete=False, suffix=".tmp")
            handle.write(serialise(index))
            handle.close()
            os.replace(handle.name, INDEX)
            print(f"index written; drift accepted: {args.accept_drift}")


if __name__ == "__main__":
    main()
