#!/usr/bin/env python3
"""Identity-keyed diff of the produced search index against the committed one.

READ-ONLY. It writes nothing, and it does not modify
tools/build_mbm_search_index.py. It exists to answer the question that tool's
own comparison cannot, and to be the starting point for the change commissioned
below.

WHAT IT IS FOR
build_mbm_search_index.py compares each category by zipping the committed and
produced lists together AFTER sorting by title:

    for a, b in zip(want_entries, got_entries):

That is an alignment by POSITION. Insert one entry - or retitle one, which moves
it in that sort - and every entry past the insertion point pairs with its
neighbour, so the tool reports dozens of untouched games as differing. Adding
Apex Rally 3D, adding Gradient Lab and retitling the incumbent Apex Rally
produced 59 such reports. The real content delta was 3.

This asks the question by identity instead: keyed on the stable id (else the
route), which entries were ADDED, REMOVED, or genuinely CHANGED IN CONTENT, and
which merely MOVED?

    committed 511 entries -> produced 513 entries
    ADDED           2   game-apexrally3d, app-gradient-lab
    REMOVED         0
    CHANGED CONTENT 1   game-apexrally, on action/keywords/sourceId/title
    MOVED ONLY     59   identical content, shifted position

WHAT IS COMMISSIONED, AND DELIBERATELY NOT DONE HERE
compare_slice() should align by key and report position changes separately. That
change belongs in its own sitting, with its own tampers, reviewed on its own
merits - not made in the pass where the gate happens to be blocking the author.
Weakening a guardrail while it is inconveniencing you is how it becomes
decorative.

THE FINDING THAT MAKES IT A PREREQUISITE RATHER THAN AN IMPROVEMENT
`--write` is not merely hard to satisfy when the entry set changes; it is
unreachable. In main(), the reproduce check runs first and ends:

    if failures:
        ...
        raise SystemExit(1)
    if args.write:

so --write is only ever reached when the entries already reproduce - that is,
only when there is nothing to write. Confirmed empirically both ways: at a clean
baseline `--write` runs and prints "nothing to write"; with one entry added it
exits 1 at the reproduce check without evaluating a single --expect-diff path.
The --expect-diff mechanism can therefore only declare ENVELOPE changes
(sourceHashes and the like) alongside an unchanged entry list. No game or app
can be added to this index by the tool that owns it until compare_slice aligns
by key.

Usage:
    python3 tools/diff_search_index_by_key.py
"""
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFESTS = ROOT / "data" / "source-manifests"


def load_generator():
    """Import the generator as a module and reuse ITS builders.

    Re-deriving the entries here would make this a second implementation of the
    index, which would agree with the real one right up until the day it
    mattered. The builders are called exactly as main() calls them.
    """
    spec = importlib.util.spec_from_file_location(
        "mbm_search_gen", ROOT / "tools" / "build_mbm_search_index.py")
    module = importlib.util.module_from_spec(spec)
    argv = sys.argv
    sys.argv = ["build_mbm_search_index.py"]      # it parses args only under __main__
    try:
        spec.loader.exec_module(module)
    finally:
        sys.argv = argv
    return module


def produce(gen):
    editorial = gen.load_json(ROOT / "data" / "mbm-search-editorial.json")
    rules = editorial["taskRules"]
    reclassify = set(editorial["reclassifyAsGame"])
    records = gen.load_json(MANIFESTS / "lessons-resources.json")
    games = gen.load_json(MANIFESTS / "games.json")["games"]
    game_hrefs = {g["href"] for g in games}
    dropped = {r["id"] for r in records
               if r["type"] == "game" and "/Lessons/" + r["file"] in game_hrefs}

    produced = {c: [] for c in gen.CATEGORY_ORDER}
    for entry in gen.build_lessons_and_resources(records, rules, reclassify, dropped):
        produced[entry["category"]].append(entry)
    for entry in gen.build_games(games, rules, editorial.get("gameIdOverrides", {})):
        produced["game"].append(entry)
    for entry in gen.build_apps(gen.load_json(MANIFESTS / "apps.json")["spaces"], rules,
                                editorial.get("canonicalAliases", {}), game_hrefs):
        produced[entry["category"]].append(entry)
    produced["page"] = gen.build_pages(editorial["hubs"])
    return [e for c in gen.CATEGORY_ORDER
            for e in sorted(produced[c], key=lambda x: x["title"].casefold())]


def key(entry):
    return entry.get("id") or entry.get("route")


def main():
    gen = load_generator()
    after = produce(gen)
    before = json.loads((ROOT / "data" / "mbm-search-index.json").read_text(encoding="utf-8"))["entries"]

    old = {key(e): e for e in before}
    new = {key(e): e for e in after}
    added = [k for k in new if k not in old]
    removed = [k for k in old if k not in new]
    common = [k for k in new if k in old]
    changed = [k for k in common if old[k] != new[k]]
    old_order = [key(e) for e in before]
    new_order = [key(e) for e in after]
    moved = [k for k in common
             if old_order.index(k) != new_order.index(k) and k not in changed]

    print(f"committed {len(before)} entries -> produced {len(after)} entries\n")
    print(f"ADDED           {len(added)}")
    for k in added:
        print(f"    + {k}  ({new[k]['title']})")
    print(f"REMOVED         {len(removed)}")
    for k in removed:
        print(f"    - {k}  ({old[k]['title']})")
    print(f"CHANGED CONTENT {len(changed)}")
    for k in changed:
        fields = sorted({f for f in set(old[k]) | set(new[k]) if old[k].get(f) != new[k].get(f)})
        print(f"    ~ {k}  on {fields}")
        for f in fields:
            print(f"        {json.dumps(old[k].get(f), ensure_ascii=False)[:60]}")
            print(f"          -> {json.dumps(new[k].get(f), ensure_ascii=False)[:60]}")
    print(f"MOVED ONLY      {len(moved)}   (identical content, shifted position)")
    print(f"\nreal content delta = {len(added) + len(removed) + len(changed)}; "
          f"the positional comparison reports {len(moved)} of these as differing")


if __name__ == "__main__":
    main()
