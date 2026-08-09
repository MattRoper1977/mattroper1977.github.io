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
  drops         Lessons-repo games whose route the Games manifest already
                publishes - matched on route, never on title, and asserted
                by identity rather than by count

Reproduces lesson, resource and page - 423 of the 511 committed entries.
game, app and tool do not yet reproduce and the tool says so rather than
passing quietly; see NOT_REPRODUCED below.

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

# Categories whose derivation is not yet fully recovered. They are still built
# and still compared - they simply fail, loudly, instead of being skipped. The
# blocker for `game` is its id rule: 40 of the 48 manifest games take an id from
# their route, but 8 take one from their title, and those 8 are exactly the
# games other surfaces reference by searchId. That list lives in
# data/audience-homepages.json, which consumes the index rather than sourcing
# it, so the rule is not derivable from the declared inputs alone.
NOT_REPRODUCED = {"game", "app", "tool"}

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


def committed_slice(category: str) -> list[dict[str, Any]]:
    return [e for e in committed_index()["entries"] if e["category"] == category]


def compare_slice(category: str, produced: list[dict[str, Any]]) -> list[str]:
    """Compare one category against the git blob, byte for byte.

    Dict equality ignores key order, so a field-by-field diff alone reports
    "identical" for two entries whose keys are ordered differently. That is how
    eighteen entries with a misplaced `pathway` passed this check while the
    written file differed by sixty-eight lines. The serialised comparison is
    authoritative; the field diff exists only to say where.
    """
    want_entries = committed_slice(category)
    got_entries = sorted(produced, key=lambda e: e["title"].casefold())
    if serialise(want_entries) == serialise(got_entries):
        return []

    problems = []
    if len(want_entries) != len(got_entries):
        problems.append(f"{category}: {len(got_entries)} entries produced, {len(want_entries)} committed")
    for a, b in zip(want_entries, got_entries):
        fields = sorted({k for k in set(a) | set(b) if a.get(k) != b.get(k)})
        if fields:
            problems.append(f"{category}/{a.get('sourceId')}: differs on {fields}")
        elif list(a) != list(b):
            problems.append(
                f"{category}/{a.get('sourceId')}: same values, different key order — "
                f"committed {list(a)}, generated {list(b)}"
            )
    if not problems:
        problems.append(f"{category}: serialised output differs but no entry does; check the envelope")
    return problems[:20]


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

    # The drop list is part of what this tool must justify. A count that
    # matches while the wrong records were dropped is exactly the vacuous green
    # this index is meant to be protected from, so it is compared by identity.
    committed_ids = {e["sourceId"] for e in load_json(INDEX)["entries"]}
    expected_drops = {r["id"] for r in records if r["type"] == "game" and r["id"] not in committed_ids}
    if dropped != expected_drops:
        print(f"drop set differs by identity: {len(dropped)} computed, {len(expected_drops)} expected", file=sys.stderr)
        for sid in sorted(dropped ^ expected_drops)[:10]:
            print(f"  - {sid}", file=sys.stderr)
        raise SystemExit(1)
    print(f"  drops      {len(dropped):>4} records  identity asserted")

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

    categories = [args.category] if args.category else CATEGORY_ORDER
    failures: list[str] = []
    for category in categories:
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
        before = committed_index()
        after = dict(before)
        after["sourceHashes"] = source_hashes()
        after["entries"] = [
            e for c in CATEGORY_ORDER
            for e in sorted(produced[c], key=lambda x: x["title"].casefold())
        ]

        # A free-text reason is a promise, not a gate. Every changed leaf path
        # must be one you named, or the write does not happen.
        old_paths, new_paths = json_paths(before), json_paths(after)
        changed = sorted(
            {k for k in set(old_paths) | set(new_paths) if old_paths.get(k) != new_paths.get(k)}
        )
        declared = set(args.expect_diff)
        undeclared = [c for c in changed if c not in declared]
        if not changed:
            print("nothing to write: the generated index already matches the committed one")
            return
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
        print(f"index written; {len(changed)} declared path(s) changed:")
        for path in changed:
            print(f"  - {path}")


if __name__ == "__main__":
    main()
