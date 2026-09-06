#!/usr/bin/env python3
"""Static separation, source coverage and JavaScript parsing checks."""
import hashlib
import json
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent


class Preview(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
        self.remote_loads = []
        self.scripts = []
        self.script_attrs = None
        self.script_text = ""

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        if tag == "a":
            self.links.append(d)
        if tag in {"script", "img", "iframe", "source", "audio", "video"} and "src" in d:
            if not d["src"].startswith("data:"):
                self.remote_loads.append(d["src"])
        if tag == "link" and d.get("rel") in {"stylesheet", "preload", "prefetch"}:
            self.remote_loads.append(d.get("href"))
        if tag == "script":
            self.script_attrs = d
            self.script_text = ""

    def handle_data(self, data):
        if self.script_attrs is not None:
            self.script_text += data

    def handle_endtag(self, tag):
        if tag == "script":
            self.scripts.append((self.script_attrs, self.script_text))
            self.script_attrs = None


def main():
    source = (HERE / "preview.html").read_text()
    p = Preview()
    p.feed(source)
    assert len(p.ids) == len(set(p.ids)), "Duplicate HTML IDs"
    assert not p.remote_loads, f"Preview render depends on remote assets: {p.remote_loads}"
    for link in p.links:
        href = link.get("href", "")
        if href.startswith("#") and not any(k in link for k in ["data-view", "data-search-link", "data-jump"]):
            assert href[1:] in p.ids, f"Missing fragment: {href}"
        if "data-jump" in link:
            assert link["data-jump"] in p.ids
    for view in ["home", "teachers", "pupils", "games"]:
        assert "view-" + view in p.ids, f"Missing page: {view}"
    data = next(json.loads(s) for attrs, s in p.scripts if attrs.get("id") == "preview-data")
    report = json.loads((HERE / "review.json").read_text())
    counts = report["populations"]
    assert counts["discovery_records"] > 0
    assert counts["discovery_records"] == counts["route_decisions"]
    assert counts["games"] + counts["education-candidate"] + counts["review"] == counts["discovery_records"]
    assert counts["education-candidate"] == len(data["education"])
    assert counts["pupil_search_records"] == len(data["pupils"]) > 0
    assert counts["games_shelf_records"] == len(data["games"]) > 0
    game_routes = {urlparse(e["route"]).path.rstrip("/") for e in report["route_decisions"] if e["destination"] == "games"}
    for label in ["education", "pupils"]:
        rows = data[label]
        assert len({e["id"] for e in rows}) == len(rows), f"Duplicate {label} records"
        for e in rows:
            path = urlparse(e["route"]).path.rstrip("/")
            assert e["category"] != "game" and path not in game_routes
            assert not path.startswith(("/Lessons/Games/", "/Games/"))
    assert all(e["safeForPupils"] is True and e["category"] in {"lesson", "resource"} for e in data["pupils"])
    for rows in [data["education"], data["pupils"], data["games"], data["science"]]:
        for entry in rows:
            route = entry["route"]
            assert (route.startswith("/") and not route.startswith("//")) or route in data["externalRoutes"], route
    assert all(route.startswith("https://github.com/mattroper1977/Lessons/tree/main/Planning/") for route in data["externalRoutes"])
    assert report["preview_sha256"] == hashlib.sha256((HERE / "preview.html").read_bytes()).hexdigest()
    for attrs, text in p.scripts:
        if attrs.get("type") == "application/json":
            continue
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js") as script:
            script.write(text)
            script.flush()
            subprocess.run(["node", "--check", script.name], check=True)
    print(json.dumps({"result": "PASS", "preview_views": 4,
                      "populations": counts, "remote_render_assets": len(p.remote_loads),
                      "browser_testing": "not performed", "live_split": "not deployed"}, indent=2))


if __name__ == "__main__":
    main()
