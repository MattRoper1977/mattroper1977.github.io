#!/usr/bin/env python3
"""Validate a reviewed real-destination registry and prepare owner-only SQL.
No network, database connection, activation, or synthetic activity."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote

def canonical_path(value):
    return (isinstance(value, str) and 0 < len(value) <= 2048 and value.startswith("/")
            and not value.startswith("//") and "?" not in value and "#" not in value
            and not any(ord(c) < 32 or ord(c) == 127 for c in value)
            and all(segment not in {".", ".."} for segment in value.split("/")))

def normalized_path(value):
    path = unquote(value)
    if not canonical_path(path) or "\\" in path:
        raise ValueError("Unsafe decoded path")
    return re.sub(r"index\.html$", "", path, flags=re.I).rstrip("/") or "/"

def validate(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Registry must be a nonempty list of reviewed real resources")
    ids, routes, clean = set(), set(), []
    for row in rows:
        src, rid, kind = row.get("source"), row.get("resource_id"), row.get("kind")
        path, title, events = row.get("route"), row.get("title"), row.get("event_types")
        if src not in {"education", "play"} or not isinstance(rid, str) or not re.fullmatch("[0-9a-f]{64}", rid):
            raise ValueError("Invalid source or stable ID")
        if kind not in {"lesson", "pack", "resource", "game"} or ((src == "play") != (kind == "game")):
            raise ValueError("Invalid resource kind/source")
        if not canonical_path(path) or not isinstance(title, str) or not 0 < len(title) <= 200:
            raise ValueError("Invalid canonical path or title")
        aliases = row.get("aliases", [])
        if not isinstance(aliases, list) or any(not canonical_path(p) for p in aliases):
            raise ValueError("Aliases must be canonical local paths")
        expected = {hashlib.sha256((src+"\n"+normalized_path(p)).encode()).hexdigest() for p in [path]+aliases}
        if rid not in expected:
            raise ValueError("Stable ID must match source plus canonical route or an explicit retained alias")
        allowed = {"game_launch"} if kind == "game" else {"lesson_open"} if kind == "lesson" else {"download_request"}
        if not isinstance(events, list) or not events or len(set(events)) != len(events) or not set(events) <= allowed:
            raise ValueError("Event types do not match the reviewed resource kind")
        if (src, rid) in ids or (src, normalized_path(path)) in routes:
            raise ValueError("Duplicate source ID or canonical route")
        ids.add((src, rid)); routes.add((src, normalized_path(path)))
        clean.append({k: row[k] for k in ["source","resource_id","kind","title","route","event_types"]})
    return sorted(clean, key=lambda r: (r["source"],r["resource_id"]))

def render(rows):
    # JSON is a quoted SQL literal; never interpolate an unescaped identifier.
    payload = json.dumps(validate(rows), ensure_ascii=False, separators=(",",":")).replace("'", "''")
    return """-- Reviewed real catalogue metadata only. No counters or start dates are inserted.
begin;
set local standard_conforming_strings=on;
insert into usage_private.resources(source,resource_id,kind,title,route,event_types)
select source,resource_id,kind,title,route,event_types
from jsonb_to_recordset('"""+payload+"""'::jsonb) as r(
 source text,resource_id text,kind text,title text,route text,event_types text[])
on conflict(source,resource_id) do update set
 kind=excluded.kind,title=excluded.title,route=excluded.route,event_types=excluded.event_types,active=true;
-- Deliberately do not delete absent rows or rewrite stable IDs/history.
commit;
"""
if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--registry",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    rows=json.loads(args.registry.read_text())
    sql=render(rows)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(sql)
    print(json.dumps({"rows":len(rows),"registry_sha256":hashlib.sha256(args.registry.read_bytes()).hexdigest(),"output":str(args.output)}))
