#!/usr/bin/env python3
"""Prove both launch hues come from their game and clear the shelf by ΔE00 12."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FORMULA = ROOT / "tools" / "driving-games" / "derive_shelf_hues.py"
spec = importlib.util.spec_from_file_location("shelf_hues", FORMULA)
assert spec and spec.loader
colour = importlib.util.module_from_spec(spec)
spec.loader.exec_module(colour)

manifest = json.loads((ROOT / "data/source-manifests/games.json").read_text(encoding="utf-8"))["games"]
routes = {
    "/titanforge/": ROOT / "titanforge/index.html",
    "/crownbadge/": ROOT / "crownbadge/index.html",
}
launch = {route: next(game for game in manifest if game["href"] == route) for route in routes}
incumbents = [game for game in manifest if game["href"] not in routes]

for route, file in routes.items():
    entry = launch[route]
    hue = entry["hue"]
    source = file.read_text(encoding="utf-8").lower()
    assert hue.lower() in source, f"{route} hue {hue} is not in its own palette"
    lab = colour.srgb_to_lab(hue)
    nearest = min(
        (colour.ciede2000(lab, colour.srgb_to_lab(game["hue"])), game)
        for game in incumbents
    )
    assert nearest[0] >= 12, (
        f"{route} hue {hue} is only ΔE00 {nearest[0]:.2f} from "
        f"{nearest[1]['title']} ({nearest[1]['hue']})"
    )
    print(
        f"{route:<15} {hue} · nearest {nearest[1]['title']} "
        f"{nearest[1]['hue']} · ΔE00 {nearest[0]:.2f}"
    )

between = colour.ciede2000(
    colour.srgb_to_lab(launch["/titanforge/"]["hue"]),
    colour.srgb_to_lab(launch["/crownbadge/"]["hue"]),
)
assert between >= 12, f"launch hues collide with each other at ΔE00 {between:.2f}"
print(f"new hues against each other · ΔE00 {between:.2f}")
