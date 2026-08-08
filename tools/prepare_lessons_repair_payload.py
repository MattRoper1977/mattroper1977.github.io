#!/usr/bin/env python3
"""Build and validate the Lessons-side repair payload.

Sentinel: mbm-full-repair-upgrade-2026-08-07

This tool edits only a disposable checkout. The verified bytes are uploaded as a
workflow artifact, then landed atomically through the connected GitHub app.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path

JSON_SCRIPT_TYPES = {
    "application/json",
    "application/ld+json",
    "importmap",
    "application/importmap+json",
}
JS_SCRIPT_TYPES = {
    "",
    "text/javascript",
    "application/javascript",
    "module",
    "text/ecmascript",
    "application/ecmascript",
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new)


def patch_orbital_source(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if "pauseReturnState" in text:
        return
    text = replace_once(
        text,
        "let seed=1, gameState='MENU';",
        "let seed=1, gameState='MENU', pauseReturnState='AIM';",
        "readable state declaration",
    )
    text = replace_once(
        text,
        "function togglePause(){ if(gameState==='AIM'||gameState==='FLY'){ gameState='PAUSE'; show('pause'); } else if(gameState==='PAUSE'){ document.getElementById('pause').classList.add('hidden'); gameState='AIM'; } }",
        "function togglePause(){ if(gameState==='AIM'||gameState==='FLY'){ pauseReturnState=gameState; gameState='PAUSE'; show('pause'); } else if(gameState==='PAUSE'){ document.getElementById('pause').classList.add('hidden'); gameState=(pauseReturnState==='FLY'&&probe.flying)?'FLY':'AIM'; } }",
        "readable pause function",
    )
    path.write_text(text, encoding="utf-8")


def patch_orbital_release(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if "pauseReturnState" in text:
        return
    text = replace_once(
        text,
        'Qe=1,Ve="MENU",ia=null',
        'Qe=1,Ve="MENU",pauseReturnState="AIM",ia=null',
        "bundled state declaration",
    )
    text = replace_once(
        text,
        'function ca(){Ve==="AIM"||Ve==="FLY"?(Ve="PAUSE",Qi("pause")):Ve==="PAUSE"&&(document.getElementById("pause").classList.add("hidden"),Ve="AIM")}',
        'function ca(){Ve==="AIM"||Ve==="FLY"?(pauseReturnState=Ve,Ve="PAUSE",Qi("pause")):Ve==="PAUSE"&&(document.getElementById("pause").classList.add("hidden"),Ve=pauseReturnState==="FLY"&&We.flying?"FLY":"AIM")}',
        "bundled pause function",
    )
    path.write_text(text, encoding="utf-8")


def patch_lessons_index(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if 'src="assets/video/poster-art.jpg"' in text:
        return
    text = replace_once(
        text,
        'src="/assets/video/poster-art.jpg"',
        'src="assets/video/poster-art.jpg"',
        "Lessons poster route",
    )
    path.write_text(text, encoding="utf-8")


def validate_jpeg(path: Path) -> dict[str, int | str]:
    data = path.read_bytes()
    if len(data) < 4096 or not data.startswith(b"\xff\xd8\xff") or not data.endswith(b"\xff\xd9"):
        raise SystemExit("poster download is not a structurally plausible JPEG")

    width = height = None
    index = 2
    sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while index + 3 < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        while index < len(data) and data[index] == 0xFF:
            index += 1
        marker = data[index]
        index += 1
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if index + 2 > len(data):
            break
        length = struct.unpack(">H", data[index:index + 2])[0]
        if length < 2 or index + length > len(data):
            raise SystemExit("poster JPEG contains a malformed segment length")
        if marker in sof_markers:
            height, width = struct.unpack(">HH", data[index + 3:index + 7])
            break
        index += length
    if not width or not height or width < 320 or height < 180:
        raise SystemExit(f"unexpected poster dimensions: {width}x{height}")
    return {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "width": width,
        "height": height,
    }


def script_type(attrs: str) -> str:
    match = re.search(r"\btype\s*=\s*(['\"])(.*?)\1", attrs, re.I | re.S)
    return match.group(2).strip().lower() if match else ""


def check_inline_scripts(path: Path) -> dict[str, int]:
    html = path.read_text(encoding="utf-8")
    checked = 0
    json_checked = 0
    for attrs, body in re.findall(r"<script([^>]*)>(.*?)</script>", html, re.S | re.I):
        if re.search(r"\bsrc\s*=", attrs, re.I) or not body.strip():
            continue
        kind = script_type(attrs)
        if kind in JSON_SCRIPT_TYPES:
            json.loads(body)
            json_checked += 1
            continue
        if kind not in JS_SCRIPT_TYPES:
            continue
        suffix = ".mjs" if kind == "module" else ".js"
        with tempfile.NamedTemporaryFile("w", suffix=suffix, encoding="utf-8") as handle:
            handle.write(body)
            handle.flush()
            subprocess.run(["node", "--check", handle.name], check=True)
        checked += 1
    if checked == 0:
        raise SystemExit(f"{path}: no executable inline scripts were syntax-checked")
    return {"javascript_blocks": checked, "json_blocks": json_checked}


def file_record(path: Path, root: Path) -> dict[str, int | str]:
    data = path.read_bytes()
    return {
        "path": path.relative_to(root).as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lessons-root", type=Path, required=True)
    parser.add_argument("--payload-root", type=Path, required=True)
    parser.add_argument("--evidence-root", type=Path, required=True)
    args = parser.parse_args()

    lessons = args.lessons_root.resolve()
    payload = args.payload_root.resolve()
    evidence = args.evidence_root.resolve()
    payload.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)

    source = lessons / "Games/Orbital_source.html"
    release = lessons / "Games/Orbital.html"
    index = lessons / "index.html"
    poster = lessons / "assets/video/poster-art.jpg"
    for path in (source, release, index, poster):
        if not path.is_file():
            raise SystemExit(f"required payload input is missing: {path}")

    patch_orbital_source(source)
    patch_orbital_release(release)
    patch_lessons_index(index)

    if index.read_text(encoding="utf-8").count('src="assets/video/poster-art.jpg"') != 1:
        raise SystemExit("repaired Lessons index does not contain exactly one relative poster route")
    if 'src="/assets/video/poster-art.jpg"' in index.read_text(encoding="utf-8"):
        raise SystemExit("broken absolute poster route survived the repair")

    results = {
        "sentinel": "mbm-full-repair-upgrade-2026-08-07",
        "poster": validate_jpeg(poster),
        "syntax": {
            "Games/Orbital_source.html": check_inline_scripts(source),
            "Games/Orbital.html": check_inline_scripts(release),
        },
    }

    targets = {
        "Games/Orbital_source.html": source,
        "Games/Orbital.html": release,
        "index.html": index,
        "assets/video/poster-art.jpg": poster,
    }
    for relative, source_path in targets.items():
        destination = payload / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source_path.read_bytes())

    head = subprocess.check_output(["git", "-C", str(lessons), "rev-parse", "HEAD"], text=True).strip()
    results["source_lessons_head"] = head
    results["files"] = [file_record(path, payload) for path in sorted(p for p in payload.rglob("*") if p.is_file())]
    (evidence / "payload-manifest.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
