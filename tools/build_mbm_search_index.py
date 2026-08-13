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
  * --check resolves its reference from the git blob, never the working tree
  * --write refuses unless every changed leaf path was named with --expect-diff
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
  drops         Lessons-repo games whose route the Games manifest already
                publishes - matched on route, never on title, and asserted
                by identity rather than by count

Comparison is by IDENTITY, not by position. The original compare aligned the
committed and produced lists by zipping them after a title sort; one insertion
made every entry past it pair with its neighbour, so dozens of untouched games
were reported as differing (see tools/diff_search_index_by_key.py, which
diagnosed this). Entries are now keyed on their stable id and classified as
ADDED, REMOVED, CHANGED or MOVED_ONLY. A position-only move is reported but is
not a failure and never needs declaring; a REMOVED entry is the loudest
failure and has its own declaration flag, because a silent removal is the one
change a search index must never absorb quietly.

--check is the reproduction gate: it is green only when the generated index
serialises byte-identically to the committed blob. --write is the repair path:
it is reachable even when the entry set changed - that is its purpose - but
every change must be declared. Envelope leaves and added/changed entries are
declared with --expect-diff; removed entries only with --expect-removed.

Usage:
  python3 tools/build_mbm_search_index.py --check
  python3 tools/build_mbm_search_index.py --check --category lesson
  python3 tools/build_mbm_search_index.py --write --expect-diff sourceHashes.mbm-search-editorial.json
  python3 tools/build_mbm_search_index.py --write \
      --expect-diff entries.game-apexrally3d --expect-removed game-retired-id ...
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
MANIFESTS = ROOT / "data" / "source-manifests"
EDITORIAL = ROOT / "data" / "mbm-search-editorial.json"
INDEX = ROOT / "data" / "mbm-search-index.json"

CATEGORY_ORDER = ["lesson", "resource", "game", "app", "tool", "page"]

# Pinned canonical game ids, declared in the editorial file. Asserted so that
# adding or dropping one is a deliberate act rather than a quiet edit.
PINNED_GAME_IDS = 8

# Every entry in the committed index follows one key order, with keys that do
# not apply omitted rather than nulled. The thirteen distinct sequences in the
# file are all subsequences of this. Entries are emitted through finalise() so
# a builder cannot introduce a fourteenth by listing its keys in a different
# order - which is exactly what happened to game and app pathway.
CANONICAL_KEYS = [
    "id", "sourceId", "title", "description", "route", "category", "contentType",
    "subject", "family", "year", "pathway", "format", "audience", "source",
    "tasks", "keywords", "image", "action", "safeForPupils", "external",
]


def finalise(entry: dict[str, Any]) -> dict[str, Any]:
    unknown = set(entry) - set(CANONICAL_KEYS)
    if unknown:
        raise SystemExit(f"entry {entry.get('id')!r} has keys outside the canonical order: {sorted(unknown)}")
    return {k: entry[k] for k in CANONICAL_KEYS if entry.get(k) is not None}

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
    # The GROW Estate v3 close (Lessons, 2026-08-12/13) introduced two further
    # spellings in resources.json. The Lessons hub's own renderer treats
    # "Lesson" as a lesson and gives "hub" records an OPEN HUB action, so the
    # same semantics apply here rather than a guess: a Hub record is a
    # navigation page for a family of lessons - pupil-safe, support-audience,
    # opened rather than viewed.
    "Lesson":   dict(category="lesson",   contentType="Lesson"),
    "Hub":      dict(category="resource", contentType="Lesson hub",
                     audience=["teachers", "pupils", "schools-semh"], safe=True),
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


def tasks_for(text: str, rules: dict[str, list[str]], always: set[str] | None = None) -> list[str] | None:
    always = always or set()
    matched = [
        task for task, words in rules.items()
        if task in always or any(word in text for word in words)
    ]
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


def app_name_words(name: str) -> str:
    """Normalise an app name for its id and keyword.

    "&" is spelled out and the remaining punctuation becomes spacing, so
    "Rubric & Feedback Studio" reads as "rubric and feedback studio" and
    "Now / Next Board" as "now next board".
    """
    spelled = name.replace("&", " and ")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", spelled.lower()).split())


def slug(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.lower())).strip("-")


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
            # A hub is opened, not viewed - same verb the Lessons hub uses.
            if content_type == "Lesson hub":
                action = f"Open hub: {record['title']}"
            else:
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
            "format": "Game" if category == "game" else lessons_format(record),
            "audience": audience,
            "source": "Lesson Hub",
            "tasks": tasks_for(text, rules),
            "keywords": keywords_for(record["subject"], record.get("family"), record.get("keywords")),
            "action": action,
            "safeForPupils": safe,
            "external": is_external(record),
        }
        entries.append(finalise(entry))
    return entries


def build_games(games: list[dict[str, Any]], rules, overrides: dict[str, str]) -> list[dict[str, Any]]:
    """The Games manifest is the canonical source for the Arcade.

    Manifest titles carry a promotional "NEW · " prefix that belongs on the
    Games hub, not in a search result, so it is stripped here.
    """
    entries = []
    for game in games:
        title = re.sub(r"^NEW\s*·\s*", "", game["title"]).strip()
        source_id = slug(title)
        # The id comes from the route by default. Eight games keep a
        # title-derived id that predates that rule and is referenced by
        # searchId from consuming surfaces; those are declared, not inferred.
        entry_id = overrides.get(game["href"], "game-" + slug(game["href"]))
        # Tasks come from the classification fields, not the promotional
        # description: an Arcade blurb mentioning "design" or "create" is
        # marketing copy, not a teaching task.
        text = " ".join([title, game.get("tag") or "", game.get("collection") or ""]).lower()
        entry = {
            "id": entry_id,
            "sourceId": source_id,
            "title": title,
            "description": game.get("desc") or "",
            "route": game["href"],
            "category": "game",
            "contentType": "Browser game",
            "subject": game.get("collection") or game.get("tag"),
            "format": "Game",
            "audience": ["pupils", "teachers", "parents-carers"],
            "source": "Games",
            # Pathway does use the description: an Arcade blurb saying a game
            # was built for BUILD is a genuine pathway signal, where the same
            # blurb saying "design" is not a teaching task.
            "pathway": pathway_for(" ".join([text, game.get("desc") or "", game["href"]]).lower()),
            "tasks": tasks_for(text, rules),
            # The committed index keeps the empty slot when a game has no
            # collection, so these are not filtered for truthiness.
            "keywords": sorted({game.get("tag") or "", game.get("collection") or "",
                                source_id.replace("-", " ")}),
            "image": game.get("art"),
            "action": f"Play {title}",
            "safeForPupils": True,
            "external": False,
        }
        entries.append(finalise(entry))
    return entries


def build_apps(spaces, rules, aliases: dict[str, str], game_hrefs: set[str]) -> list[dict[str, Any]]:
    """Apps and teacher tools share one manifest; the space they sit in decides
    which they are, who they are for, and whether a pupil should see them."""
    entries = []
    for space in spaces:
        teacher_space = space["cat"] == "Teacher tools"
        for item in space["items"]:
            name = item["n"]
            raw = item["f"]
            route = aliases.get(raw, raw if raw.startswith("http") else "/Matt-s-Apps-/" + raw)
            # An app whose canonical route the Games manifest already publishes
            # is that game, listed twice. Same route-based rule as the Lessons
            # games, applied after aliasing.
            if route in game_hrefs:
                continue
            text = " ".join([name, item.get("d") or "", space["cat"]]).lower()
            entry = {
                "id": "app-" + app_name_words(name).replace(" ", "-"),
                "sourceId": item["f"],
                "title": name,
                "description": item.get("d") or "",
                "route": route,
                "category": "tool" if teacher_space else "app",
                "contentType": "Teacher tool" if teacher_space else "Browser app",
                "subject": space["cat"],
                "format": "Browser tool" if teacher_space else "Browser app",
                "audience": ["teachers", "schools-semh"] if teacher_space else ["pupils", "teachers"],
                "source": "Apps",
                # Pathway reads the description and the filename; the app's
                # display name is not a pathway signal ("Typing Tutor" is not
                # Tutor Time).
                "pathway": pathway_for(" ".join([item.get("d") or "", item["f"]]).lower()),
                # Everything in the teacher-tools space supports assessment by
                # virtue of being there, whether or not its blurb says so - all
                # ten carry the task in the committed index.
                "tasks": tasks_for(text, rules, always={"assess-understanding"} if teacher_space else set()),
                "keywords": keywords_for(space["cat"], app_name_words(name)),
                "action": f"Open {name}",
                "safeForPupils": not teacher_space,
                "external": route.startswith("http"),
            }
            entries.append(finalise(entry))
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
        entries.append(finalise(entry))
    return entries


def serialise(index: dict[str, Any]) -> str:
    return json.dumps(index, ensure_ascii=False, indent=2) + "\n"


INDEX_REL = "data/mbm-search-index.json"


def committed_text() -> str:
    """Read the reference from git, never from the working tree.

    The working-tree file is a path this tool can write. Comparing against it
    means that once --write has run, --check compares the generator with its
    own output and returns green regardless. Reading the blob makes that
    circularity structurally impossible rather than something to remember.
    """
    result = subprocess.run(
        ["git", "show", f"HEAD:{INDEX_REL}"],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    if result.returncode != 0:
        raise SystemExit(
            f"cannot read {INDEX_REL} from git HEAD, so there is no trustworthy "
            f"reference to compare against: {result.stderr.strip()}"
        )
    return result.stdout


def committed_index() -> dict[str, Any]:
    return json.loads(committed_text())


def entry_key(entry: dict[str, Any]) -> str:
    return entry.get("id") or entry.get("route")


def classify_by_key(before: list[dict[str, Any]], after: list[dict[str, Any]]) -> dict[str, Any]:
    """Identity-keyed classification of two entry lists.

    This is the estate's one comparison engine for the search index; the
    positional zip it replaced reported dozens of untouched entries as
    differing after a single insertion. tools/diff_search_index_by_key.py
    reuses this function rather than reimplementing it - two classifiers
    would agree right up until the day it mattered.

    Serialised equality remains the authoritative reproduction test (dict
    equality ignores key order, which is how eighteen entries with a
    misplaced `pathway` once passed a field diff while the written file
    differed by sixty-eight lines). The classification exists to say what
    ACTUALLY changed: ADDED, REMOVED, CHANGED in content, or MOVED_ONLY -
    identical content at a different position, which is a consequence of a
    sorted list absorbing an insertion, not a change anyone made.
    """
    old = {entry_key(e): e for e in before}
    new = {entry_key(e): e for e in after}
    added = [k for k in new if k not in old]
    removed = [k for k in old if k not in new]
    common = [k for k in new if k in old]
    changed = [k for k in common if old[k] != new[k]]
    key_order_differs = [
        k for k in common
        if old[k] == new[k] and list(old[k]) != list(new[k])
    ]
    old_order = {k: i for i, k in enumerate(entry_key(e) for e in before)}
    new_order = {k: i for i, k in enumerate(entry_key(e) for e in after)}
    moved = [k for k in common
             if old_order[k] != new_order[k] and k not in changed]
    return {
        "old": old, "new": new,
        "added": added, "removed": removed, "changed": changed,
        "moved": moved, "key_order_differs": key_order_differs,
    }


def changed_fields(a: dict[str, Any], b: dict[str, Any]) -> list[str]:
    return sorted({k for k in set(a) | set(b) if a.get(k) != b.get(k)})


def json_paths(value: Any, prefix: str = "") -> dict[str, Any]:
    """Flatten to leaf paths so a diff can be checked against a declaration."""
    flat: dict[str, Any] = {}
    if isinstance(value, dict):
        for key, item in value.items():
            flat.update(json_paths(item, f"{prefix}.{key}" if prefix else key))
    else:
        flat[prefix] = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return flat


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare only (the default behaviour)")
    parser.add_argument("--category", choices=CATEGORY_ORDER, help="prove one category in isolation")
    parser.add_argument("--write", action="store_true", help="write, but only the differences you declare")
    parser.add_argument("--expect-diff", metavar="PATH", action="append", default=[],
                        help="a JSON path the write is permitted to change; repeatable")
    parser.add_argument("--expect-removed", metavar="ENTRY_KEY", action="append", default=[],
                        help="an entry key the write is permitted to REMOVE; repeatable. "
                             "Removal is the loudest failure and never rides in under "
                             "--expect-diff")
    args = parser.parse_args()

    editorial = load_json(EDITORIAL)
    rules = editorial["taskRules"]
    reclassify = set(editorial["reclassifyAsGame"])
    records = load_json(MANIFESTS / "lessons-resources.json")

    # A Lessons-repo game is dropped when the Games manifest already publishes
    # that exact route. Matching on route rather than title matters: the
    # manifest hosts several games under /Lessons/Games/ itself, and two
    # different games can share a name.
    game_hrefs = {g["href"] for g in load_json(MANIFESTS / "games.json")["games"]}
    dropped = {
        r["id"] for r in records
        if r["type"] == "game" and "/Lessons/" + r["file"] in game_hrefs
    }

    # The drop list is part of what this tool must justify - by identity, not
    # by count. The old assertion compared the drop set against the committed
    # index's absentees, which is only meaningful while the committed index is
    # fresh; against updated sources it condemned every legitimate addition.
    # Instead, every dropped record must name the published route that
    # justifies dropping it, re-derived here independently of the drop
    # comprehension so an edit to one cannot silently satisfy the other.
    # The consequences stay loud in the identity classification below: a
    # wrongly-dropped record surfaces as a REMOVED entry, a wrongly-kept one
    # as an ADDED entry, and neither writes without being declared.
    by_id = {r["id"]: r for r in records}
    unjustified = [sid for sid in sorted(dropped)
                   if "/Lessons/" + by_id[sid]["file"] not in game_hrefs]
    if unjustified:
        print("dropped records whose route the Games manifest does not publish:",
              file=sys.stderr)
        for sid in unjustified[:10]:
            print(f"  - {sid}", file=sys.stderr)
        raise SystemExit(1)
    print(f"  drops      {len(dropped):>4} records  each justified by a published route")

    produced: dict[str, list[dict[str, Any]]] = {c: [] for c in CATEGORY_ORDER}
    for entry in build_lessons_and_resources(records, rules, reclassify, dropped):
        produced[entry["category"]].append(entry)
    overrides = editorial.get("gameIdOverrides", {})
    aliases = editorial.get("canonicalAliases", {})
    games = load_json(MANIFESTS / "games.json")["games"]

    # Guard the declared overrides. A pinned id that no longer matches anything
    # is stale data, and a pinned id that collides with a derived one silently
    # renames a different game.
    unused = set(overrides) - {g["href"] for g in games}
    if unused:
        print(f"gameIdOverrides entries match no game: {sorted(unused)}", file=sys.stderr)
        raise SystemExit(1)
    derived = {"game-" + slug(g["href"]) for g in games if g["href"] not in overrides}
    collisions = sorted(set(overrides.values()) & derived)
    if collisions:
        print(f"gameIdOverrides collide with route-derived ids: {collisions}", file=sys.stderr)
        raise SystemExit(1)
    if len(set(overrides.values())) != len(overrides):
        print("gameIdOverrides map two routes to the same id", file=sys.stderr)
        raise SystemExit(1)
    if len(overrides) != PINNED_GAME_IDS:
        print(f"gameIdOverrides holds {len(overrides)} entries, expected {PINNED_GAME_IDS}. "
              "A pinned canonical id was added or removed; say so deliberately.", file=sys.stderr)
        raise SystemExit(1)
    print(f"  overrides  {len(overrides):>4} pinned    all used, no collisions")

    for entry in build_games(games, rules, overrides):
        produced["game"].append(entry)
    for entry in build_apps(load_json(MANIFESTS / "apps.json")["spaces"], rules, aliases, game_hrefs):
        produced[entry["category"]].append(entry)
    produced["page"] = build_pages(editorial["hubs"])

    # Close the loop on the pinned ids: every searchId a consuming surface
    # points at must exist in the generated index. Without this the override
    # list is a magic list; with it, it justifies itself.
    all_ids = {e["id"] for c in CATEGORY_ORDER for e in produced[c]}
    referenced: set[str] = set()
    for path in sorted((ROOT / "data").glob("*.json")):
        if path.name == "mbm-search-index.json":
            continue
        for match in re.finditer(r'"searchId"\s*:\s*"([^"]+)"', path.read_text(encoding="utf-8")):
            referenced.add(match.group(1))
    dangling = sorted(referenced - all_ids)
    if dangling:
        print(f"searchId references that resolve to nothing: {dangling}", file=sys.stderr)
        raise SystemExit(1)
    print(f"  searchId   {len(referenced):>4} swept     all resolve")

    before = committed_index()
    after_entries = [
        e for c in CATEGORY_ORDER
        for e in sorted(produced[c], key=lambda x: x["title"].casefold())
    ]
    cls = classify_by_key(before["entries"], after_entries)
    category_of = {entry_key(e): e["category"] for e in before["entries"]}
    category_of.update({entry_key(e): e["category"] for e in after_entries})

    categories = [args.category] if args.category else CATEGORY_ORDER
    for category in categories:
        delta = [k for group in ("added", "removed", "changed")
                 for k in cls[group] if category_of.get(k) == category]
        status = "reproduces" if not delta else "DIFFERS"
        print(f"  {category:<9} {len(produced[category]):>4} entries  {status}")

    if not args.write:
        # The reproduction gate. Serialised equality is authoritative; the
        # classification says what actually changed. A MOVED_ONLY entry is a
        # consequence of a sorted list absorbing an insertion, so it is
        # reported here but never listed as a difference in its own right.
        in_scope = lambda keys: [k for k in keys if args.category is None
                                 or category_of.get(k) == args.category]
        added, removed, changed = (in_scope(cls[g]) for g in ("added", "removed", "changed"))
        reproduces = serialise(before["entries"]) == serialise(after_entries)
        if args.category is None and not reproduces or added or removed or changed:
            print("\nGenerator does not reproduce the committed index:", file=sys.stderr)
            for k in removed[:10]:
                print(f"  - REMOVED {k}  ({cls['old'][k]['title']})", file=sys.stderr)
            for k in added[:10]:
                print(f"  + ADDED   {k}  ({cls['new'][k]['title']})", file=sys.stderr)
            for k in changed[:10]:
                print(f"  ~ CHANGED {k}  on {changed_fields(cls['old'][k], cls['new'][k])}",
                      file=sys.stderr)
            for k in cls["key_order_differs"][:5]:
                print(f"  ~ KEY ORDER {k}: committed {list(cls['old'][k])}, "
                      f"generated {list(cls['new'][k])}", file=sys.stderr)
            if cls["moved"]:
                print(f"  ({len(cls['moved'])} further entries moved position only "
                      "- not failures)", file=sys.stderr)
            raise SystemExit(1)
        return

    # --write. Reachable even when the entry set changed - that is the point:
    # the old flow raised before this line whenever there was anything to
    # write. Reachable is not unguarded: every envelope leaf and every added
    # or content-changed entry must be declared with --expect-diff, and a
    # REMOVED entry - the loudest failure this file has - only writes when
    # named with --expect-removed. A position-only move needs no declaration.
    after = dict(before)
    after["sourceProvenance"] = load_json(MANIFESTS / "provenance.json")["sources"]
    after["sourceHashes"] = source_hashes()
    after["teacherTasks"] = editorial["teacherTasks"]
    counts: dict[str, int] = {"total": len(after_entries)}
    for category in CATEGORY_ORDER:
        counts[category] = sum(1 for e in after_entries if e["category"] == category)
    after["counts"] = counts
    after["entries"] = after_entries

    envelope_before = {k: v for k, v in before.items() if k != "entries"}
    envelope_after = {k: v for k, v in after.items() if k != "entries"}
    old_paths, new_paths = json_paths(envelope_before), json_paths(envelope_after)
    changed_leaves = sorted(
        {k for k in set(old_paths) | set(new_paths) if old_paths.get(k) != new_paths.get(k)}
    )
    entry_changes = sorted(f"entries.{k}" for k in cls["added"] + cls["changed"])
    changed = changed_leaves + entry_changes

    declared = set(args.expect_diff)
    declared_removed = set(args.expect_removed)

    if not changed and not cls["removed"] and not cls["moved"] and not cls["key_order_differs"]:
        print("nothing to write: the generated index already matches the committed one")
        return

    # Removals first, and separately: a removal that rode in under a generic
    # declaration is exactly the quiet loss this gate exists to prevent.
    undeclared_removed = [k for k in cls["removed"] if k not in declared_removed]
    if undeclared_removed:
        print("write aborted — these entries would be REMOVED but were not declared:",
              file=sys.stderr)
        for k in undeclared_removed[:20]:
            print(f"  - {k}  ({cls['old'][k]['title']})", file=sys.stderr)
        print("every removal must be named with --expect-removed; "
              "--expect-diff does not cover a removal", file=sys.stderr)
        raise SystemExit(1)
    unused_removed = sorted(declared_removed - set(cls["removed"]))
    if unused_removed:
        print("write aborted — these --expect-removed entries were not removed:",
              file=sys.stderr)
        for k in unused_removed:
            print(f"  - {k}", file=sys.stderr)
        raise SystemExit(1)

    undeclared = [c for c in changed if c not in declared]
    if undeclared:
        print("write aborted — these paths would change but were not declared:", file=sys.stderr)
        for path in undeclared[:20]:
            print(f"  - {path}", file=sys.stderr)
        print(f"declare them with --expect-diff, or fix the generator ({len(changed)} changed in total)",
              file=sys.stderr)
        raise SystemExit(1)
    unused = sorted(declared - set(changed))
    if unused:
        print("write aborted — these --expect-diff paths did not change:", file=sys.stderr)
        for path in unused:
            print(f"  - {path}", file=sys.stderr)
        raise SystemExit(1)

    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=str(INDEX.parent),
                                         delete=False, suffix=".tmp")
    handle.write(serialise(after))
    handle.close()
    os.replace(handle.name, INDEX)
    print(f"index written; {len(cls['added'])} added, {len(cls['removed'])} removed, "
          f"{len(cls['changed'])} changed, {len(cls['moved'])} moved position only")
    for path in changed_leaves:
        print(f"  - {path}")
    for k in cls["added"]:
        print(f"  + entries.{k}")
    for k in cls["removed"]:
        print(f"  - entries.{k} (REMOVED, declared)")
    for k in cls["changed"]:
        print(f"  ~ entries.{k} on {changed_fields(cls['old'][k], cls['new'][k])}")


if __name__ == "__main__":
    main()
