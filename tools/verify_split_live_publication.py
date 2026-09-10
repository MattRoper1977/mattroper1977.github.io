#!/usr/bin/env python3
"""AGX instruments for reconstructing and checking the two committed publications.

The reviewed ref supplies this instrument; Site/main and Games/main supply the
subjects. Never use the reviewed builder to manufacture expected deployed bytes.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

LEARN = "https://madebymatt.uk"
PLAY = "https://madebymatt-play.uk"
CENSUS = "reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json"


def require(ok, detail):
    if not ok:
        raise ValueError(detail)


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(value):
    return hashlib.sha256(value).hexdigest()


def git_head(root):
    return subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()


def safe_path(root, relative):
    path = Path(relative)
    require(not path.is_absolute() and ".." not in path.parts and "\\" not in relative,
            f"Unsafe publication path: {relative!r}")
    resolved = (root / path).resolve()
    require(resolved.is_relative_to(root.resolve()), f"Escaping publication path: {relative}")
    return resolved


def normal(route):
    parsed = urllib.parse.urlsplit(route)
    require(not parsed.scheme and not parsed.netloc and not parsed.query and not parsed.fragment,
            f"Expected an origin-relative route: {route!r}")
    path = urllib.parse.unquote(parsed.path)
    require(path.startswith("/") and ".." not in Path(path).parts and "\\" not in path,
            f"Unsafe route: {route!r}")
    return path.removesuffix("index.html").rstrip("/") or "/"


def members(actual, expected, label):
    require(len(actual) == len(set(actual)), f"{label}: duplicate identity")
    require(set(actual) == set(expected),
            f"{label}: membership differs; missing={sorted(set(expected)-set(actual))}, "
            f"extra={sorted(set(actual)-set(expected))}")


def exact(actual, expected, label):
    require(actual == expected,
            f"{label}: bytes differ; served={len(actual)}B/{sha(actual)}, expected={len(expected)}B/{sha(expected)}")


def publication_url(requested, resolved):
    # GitHub Pages currently selects www for the games custom domain. Accept
    # only that HTTPS hostname alias, with the entire path/query unchanged.
    allowed = {requested}
    if requested.startswith(PLAY + "/"):
        allowed.add(requested.replace(PLAY, "https://www.madebymatt-play.uk", 1))
    require(resolved in allowed, f"{requested}: unexpected redirect to {resolved}")


def expect_failure(action, label):
    try:
        action()
    except ValueError:
        print(f"CONTROL PASS: {label}")
    else:
        raise ValueError(f"MEASUREMENT INVALID: {label} did not fail")


def controls():
    exact(b"committed", b"committed", "positive byte control")
    members(["a", "b"], ["a", "b"], "positive member control")
    expect_failure(lambda: exact(b"xcommitted", b"committed", "mutation"), "one-byte mutation")
    expect_failure(lambda: exact(b"404 Not Found", b"committed", "error body"), "HTTP error body")
    expect_failure(lambda: members([], ["a", "b"], "empty"), "empty coverage")
    expect_failure(lambda: members(["a"], ["a", "b"], "dropped"), "dropped payload")
    expect_failure(lambda: members(["a", "a", "b"], ["a", "b"], "duplicate"), "duplicate payload")
    expect_failure(lambda: members(["a", "ghost"], ["a", "b"], "substitution"), "same-count substituted payload")
    expect_failure(lambda: normal("/a/%2e%2e/b/"), "encoded traversal")
    publication_url(PLAY + "/apexkick/", "https://www.madebymatt-play.uk/apexkick/")
    expect_failure(lambda: publication_url(PLAY + "/apexkick/", "http://www.madebymatt-play.uk/apexkick/"), "HTTPS downgrade")
    expect_failure(lambda: publication_url(PLAY + "/apexkick/", "https://www.madebymatt-play.uk/"), "redirect to another path")
    expect_failure(lambda: publication_url(PLAY + "/apexkick/", "https://example.com/apexkick/"), "redirect to another host")


def sources(args):
    # Read only the committed main workflow's explicit companion SHAs. An
    # unrecognised expression fails closed instead of silently selecting a tip.
    import yaml
    workflow = yaml.safe_load((args.site / ".github/workflows/education-publication.yml").read_text())
    steps = workflow["jobs"]["build"]["steps"]
    values = {}
    for short, repo in [("education_lessons", "MattRoper1977/Lessons"),
                        ("education_apps", "MattRoper1977/Matt-s-Apps-")]:
        found = [s["with"]["ref"] for s in steps
                 if s.get("uses", "").startswith("actions/checkout@")
                 and s.get("with", {}).get("repository") == repo]
        require(len(found) == 1, f"Expected one committed checkout declaration for {repo}")
        expression = str(found[0])
        match = re.fullmatch(r"\$\{\{ github.repository == '" + re.escape(repo) +
                             r"' && github.sha \|\| '([0-9a-f]{40})' \}\}", expression)
        require(match is not None, f"Unrecognised education companion ref for {repo}: {expression}")
        values[short] = match[1]
    config = read(args.shelf / "play-publication.json")
    require(config["domain"] == "madebymatt-play.uk", "Unexpected games publication domain")
    require(config["site_repository"] == "MattRoper1977/mattroper1977.github.io", "Unexpected games Site repository")
    require(config["lessons_repository"] == "MattRoper1977/Lessons", "Unexpected games Lessons repository")
    for kind in ["site", "lessons"]:
        value = config[kind + "_commit"]
        require(isinstance(value, str) and re.fullmatch("[0-9a-f]{40}", value), f"Unpinned games {kind}")
        values["games_" + kind] = value
    require(config["canonical_games"] > 0 and config["additional_activities"] > 0, "Empty games allocation")
    output = "".join(f"{key}={value}\n" for key, value in values.items())
    print(output, end="")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as stream:
            stream.write(output)


def infrastructure(kind):
    record = read(Path(__file__).resolve().parents[1] / "data/agx-split-live-infrastructure.json")
    surfaces = record[kind]
    require(isinstance(surfaces, list) and surfaces, f"Empty {kind} infrastructure declaration")
    routes = [normal(s["route"]) for s in surfaces]
    require(len(routes) == len(set(routes)), f"Duplicate {kind} infrastructure routes")
    return surfaces


def education_routes(_args):
    for surface in infrastructure("education"):
        print(surface["route"])


def matrix(args):
    config = read(args.shelf / "play-publication.json")
    roots = {"Site": args.site.resolve(), "Lessons": args.lessons.resolve()}
    require(config["domain"] == "madebymatt-play.uk", "Unexpected games domain")
    require(git_head(roots["Site"]) == config["site_commit"], "Wrong games Site subject checkout")
    require(git_head(roots["Lessons"]) == config["lessons_commit"], "Wrong games Lessons subject checkout")
    output = args.site / "domain-split/output"
    public = output / "games"
    report = read(output / "build-report.json")
    require(report["source_heads"] == {key: git_head(root) for key, root in roots.items()}, "Build source heads differ")
    rows = read(args.site / CENSUS)["rows"]
    require(report["source_census_sha256"] == sha((args.site / CENSUS).read_bytes()), "Build census SHA differs")
    require(len(rows) == config["canonical_games"] + config["additional_activities"], "Declared game count differs")
    require(len(rows) > 0, "Empty game population")
    expected_routes = [normal(r["normalizedDecodedRoute"]) for r in rows]
    members(expected_routes, expected_routes, "census")
    members([normal(p["route"]) for p in report["payloads"]], expected_routes, "build payloads")
    canonical = [normal(g["href"]) for g in read(args.shelf / "games.json")["games"]]
    census_shelf = [normal(r["normalizedDecodedRoute"]) for r in rows if r["populationClass"] == "canonical-shelf"]
    members(canonical, census_shelf, "canonical shelf versus pinned publication")
    require(len(canonical) == config["canonical_games"], "Canonical game count differs")
    catalogue = read(public / "data/domain-catalogue.json")
    members([normal(e["route"]) for e in catalogue["games"]], canonical, "published shelf catalogue")
    additional = catalogue["activities"] + catalogue["staff"]
    members([normal(e["route"]) for e in additional], sorted(set(expected_routes) - set(canonical)), "additional activities")
    require(len(catalogue["staff"]) == 1 and catalogue["staff"][0].get("safeForPupils") is False,
            "Staff activity classification differs")
    by_route = {normal(p["route"]): p for p in report["payloads"]}
    requests = {}
    for row in rows:
        route = normal(row["normalizedDecodedRoute"])
        item = by_route[route]
        source_repo = row["source"]["repository"]
        source_path = row["source"]["path"]
        source = safe_path(roots[source_repo], source_path).read_bytes()
        decoded_path = urllib.parse.unquote(urllib.parse.urlsplit(row["normalizedDecodedRoute"]).path).lstrip("/")
        published_path = decoded_path + "index.html" if decoded_path.endswith("/") else decoded_path
        require((item["source_repository"], item["source_path"], item["path"], item["class"]) ==
                (source_repo, source_path, published_path, row["populationClass"]), f"{route}: source/output identity differs")
        require(sha(source) == item["source_sha256"], f"{route}: source hash differs")
        # Match the builder's documented read_text universal newline handling,
        # then only its literal origin rewrite. No game-engine re-authoring.
        expected = source.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n").replace(LEARN, PLAY).encode("utf-8")
        built = safe_path(public, published_path).read_bytes()
        exact(built, expected, route + " local publication")
        require(sha(built) == item["published_sha256"], f"{route}: published hash differs")
        requests[PLAY + urllib.parse.quote(urllib.parse.unquote(row["normalizedDecodedRoute"]), safe="/")] = built
    # Extra infrastructure is named separately from the 69 payloads; it is not
    # inflated into the game count. Includes rendered UI, catalogue and runtime.
    for surface in infrastructure("games"):
        route, file = surface["route"], surface["file"]
        require(PLAY + route not in requests, f"Infrastructure duplicates a payload: {route}")
        requests[PLAY + route] = safe_path(public, file).read_bytes()
    for path in ["games.json", "Games/games.json", "data/source-manifests/games.json"]:
        exact(safe_path(public, path).read_bytes(), (args.shelf / "games.json").read_bytes(), "generated canonical " + path)
        requests[PLAY + "/" + path] = (args.shelf / "games.json").read_bytes()
    print(f"SUBJECT: Games/main {git_head(args.shelf)}; Site {config['site_commit']}; Lessons {config['lessons_commit']}")
    print(f"MATRIX PASS: {len(rows)} payloads ({len(canonical)} canonical + {len(additional)} additional), "
          f"{len(requests)-len(rows)} infrastructure surfaces")
    return requests


def fetch_exact(url, expected):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "MadeByMatt-AGX-ReadOnly"}), timeout=35) as response:
        # Default HTTPS certificate/hostname verification remains mandatory.
        require(response.status == 200, f"{url}: HTTP {response.status}")
        publication_url(url, response.geturl())
        data = response.read()
    exact(data, expected, url)
    return f"IDENTICAL {url} {len(data)} B {sha(data)}"


def games(args):
    controls()
    requests = matrix(args)
    if args.check_only:
        print("LOCAL ONLY: no live requests performed")
        return
    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        pending = {pool.submit(fetch_exact, url, data): url for url, data in requests.items()}
        for future in as_completed(pending):
            try:
                print(future.result())
            except Exception as exc:
                failed.append(f"{pending[future]}: {exc}")
    require(not failed, "Live publication failed:\n" + "\n".join(failed))
    print(f"LIVE PASS: all {len(requests)} games-domain surfaces equal the committed pinned publication")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    src = commands.add_parser("sources")
    src.add_argument("--site", type=Path, required=True)
    src.add_argument("--shelf", type=Path, required=True)
    game = commands.add_parser("games")
    game.add_argument("--site", type=Path, required=True)
    game.add_argument("--lessons", type=Path, required=True)
    game.add_argument("--shelf", type=Path, required=True)
    game.add_argument("--check-only", action="store_true")
    commands.add_parser("controls")
    commands.add_parser("education-routes")
    args = parser.parse_args()
    {"sources": sources, "games": games, "education-routes": education_routes, "controls": lambda _: controls()}[args.command](args)


if __name__ == "__main__":
    main()
