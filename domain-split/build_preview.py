#!/usr/bin/env python3
"""Build the domain-independent review copy; never writes production files."""
from __future__ import annotations

import base64
import hashlib
import html
import json
import mimetypes
import re
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def route_path(value: str) -> str:
    return urlparse(value).path.rstrip("/") or "/"


def image_data(path: str) -> str:
    local = (ROOT / path.lstrip("/")).resolve()
    if not local.is_relative_to(ROOT) or not local.is_file():
        raise ValueError(f"Missing or invalid existing artwork: {path}")
    mime = mimetypes.guess_type(str(local))[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(local.read_bytes()).decode()


def compact(entry: dict) -> dict:
    return {
        "id": entry["id"], "title": entry["title"],
        "description": entry.get("description", ""), "route": entry["route"],
        "category": entry.get("category", ""), "subject": entry.get("subject", ""),
        "pathways": entry.get("pathway", []), "keywords": entry.get("keywords", []),
        "safeForPupils": entry.get("safeForPupils") is True,
    }


def build() -> dict:
    config = json.loads((HERE / "config.json").read_text())
    catalogue_path = ROOT / "data/mbm-search-index.json"
    games_path = ROOT / "data/source-manifests/games.json"
    catalogue = json.loads(catalogue_path.read_text())
    entries = catalogue["entries"]
    shelf = json.loads(games_path.read_text())["games"]
    game_paths = {route_path(e["route"]) for e in entries if e["category"] == "game"}
    game_paths.update(route_path(e["href"]) for e in shelf)
    game_paths.update({"/games", "/Games"})
    mixed_pages = {"page-main-home", "page-discovery-home", "page-apps-hub"}

    def is_game(route: str) -> bool:
        path = route_path(route)
        return (path in game_paths or path.startswith("/Games/")
                or path.startswith("/Lessons/Games/"))

    decisions = []
    learning = []
    for entry in entries:
        if entry["category"] == "game" or is_game(entry["route"]):
            destination, reason = "games", "game category or game-owned route"
        elif entry["id"] in mixed_pages:
            destination, reason = "review", "mixed hub requires reconstruction or content review"
        else:
            destination, reason = "education-candidate", "non-game discovery record; payload audit still required"
            learning.append(compact(entry))
        decisions.append({"id": entry["id"], "route": entry["route"],
                          "destination": destination, "reason": reason})

    pupils = [e for e in learning if e["safeForPupils"] and e["category"] in {"lesson", "resource"}]
    game_lookup = {route_path(e["route"]): e for e in entries if e["category"] == "game"}
    games = []
    for i, item in enumerate(shelf):
        match = game_lookup.get(route_path(item["href"]), {})
        games.append({"id": match.get("id", f"shelf-{i}"), "title": item["title"],
                      "description": item.get("desc", ""), "route": item["href"],
                      "subject": item.get("tag", ""), "keywords": match.get("keywords", []),
                      "category": "game", "pathways": []})

    featured_routes = ["/apexkick/", "/emberwild/", "/voxel/"]
    featured = []
    for route in featured_routes:
        match = next((e for e in games if route_path(e["route"]) == route_path(route)), None)
        if match:
            original = next(e for e in shelf if route_path(e["href"]) == route_path(route))
            art = original.get("art") or game_lookup.get(route_path(route), {}).get("image")
            if art:
                featured.append({**match, "image": image_data(art)})

    external_routes = sorted({e["route"] for e in learning if e["route"].startswith("https://github.com/mattroper1977/Lessons/tree/main/Planning/")})
    data = {"education": learning, "pupils": pupils, "games": games, "externalRoutes": external_routes,
            "sourceOrigin": config["source_origin"], "science": config["science_pathways"]}
    template = (HERE / "preview-template.html").read_text()
    substitutions = {
        "@@CATALOGUE@@": json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
        "@@MARK@@": image_data("/assets/brand/micro_mark.svg"),
        "@@LESSON_ART@@": image_data("/images/lesson-hub-card.webp"),
        "@@ART_STUDIO@@": image_data("/assets/video/poster-art.webp"),
        "@@ASDAN_ART@@": image_data("/assets/video/poster-asdan.webp"),
        "@@GAME_CARDS@@": "".join(
            '<a class="feature-card live-link" href="' + html.escape(config["source_origin"] + item["route"], quote=True)
            + '" target="_blank" rel="noopener"><img src="' + item["image"]
            + '" width="450" height="280" alt="" loading="lazy"><div><p class="eyebrow">'
            + html.escape(item["subject"]) + '</p><h3>' + html.escape(item["title"])
            + '</h3><span class="text-link">Play on the current site ↗</span></div></a>' for item in featured
        ),
        "@@SHELF_COUNT@@": str(len(games)),
    }
    for marker, value in substitutions.items():
        if marker not in template:
            raise ValueError(f"Missing template marker: {marker}")
        template = template.replace(marker, value)
    if re.search(r"@@[A-Z_]+@@", template):
        raise ValueError("Unresolved template placeholder")
    (HERE / "preview.html").write_text(template)

    counts = {name: sum(e["destination"] == name for e in decisions)
              for name in ["games", "education-candidate", "review"]}
    review = {
        "status": "DESIGN_PREVIEW_ONLY", "config": config,
        "source_hashes": {"search_index_sha256": digest(catalogue_path),
                          "games_shelf_sha256": digest(games_path)},
        "populations": {"discovery_records": len(entries), "route_decisions": len(decisions),
                        **counts, "pupil_search_records": len(pupils), "games_shelf_records": len(games)},
        "limitations": ["Discovery inventory is not a complete published-file inventory.",
                        "Education candidates still need payload and dependency review.",
                        "Preview links deliberately open the current mixed production domain.",
                        "Second domain, hosting setup, full migration and live/browser verification are pending."],
        "preview_sha256": digest(HERE / "preview.html"), "route_decisions": decisions,
    }
    (HERE / "review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n")
    return review


if __name__ == "__main__":
    print(json.dumps(build()["populations"], indent=2))
