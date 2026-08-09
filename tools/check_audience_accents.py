#!/usr/bin/env python3
"""Measure the seven audience accents rather than eyeballing them.

Each audience homepage sets --face-accent, which also feeds --choice-accent,
--task-accent and --badge-accent. The accent is used in three ways that carry a
contrast obligation:

  1. as text and icon colour on the cream content surface (#FFFDF6)
  2. as a solid background behind white text (.mf-note-mark, the current
     switcher entry)
  3. as a badge border over the navy hero, which is non-text UI

(1) and (2) are both against a near-white ground, so 4.5:1 is the governing
bar for each accent. (3) is reported for completeness; the badge border is
mixed 60% with white before painting, so the raw figure is a lower bound.

Separation is reported as worst pairwise CIELAB delta-E. Seven front doors that
differ only by colour would be a colour-only cue, so the audience name and icon
carry the meaning; the accent is reinforcement. The figure is reported rather
than enforced because how far apart the accents should sit is a design ruling,
not something this tool should decide.

Usage:
  python3 tools/check_audience_accents.py            # gate: exit 1 on failure
  python3 tools/check_audience_accents.py --report   # measurements only
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "audience-homepages.json"

CREAM_SURFACE = "#FFFDF6"   # --mf-surface, the content ground
WHITE_TEXT = "#FFFFFF"      # text painted on top of a solid accent
NAVY_HERO = "#0F1530"       # --mf-deep, the hero ground
DARK_SURFACE = "#1B234A"    # --mf-surface under the dark theme

MIN_CONTRAST = 4.5


def _channels(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(colour: str) -> float:
    r, g, b = (_linear(c) for c in _channels(colour))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(one: str, two: str) -> float:
    a, b = luminance(one), luminance(two)
    high, low = max(a, b), min(a, b)
    return (high + 0.05) / (low + 0.05)


def lab(colour: str) -> tuple[float, float, float]:
    r, g, b = (_linear(c) for c in _channels(colour))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else (7.787 * t + 16 / 116)

    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(one: str, two: str) -> float:
    return math.dist(lab(one), lab(two))


def load_accents() -> dict[str, str]:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return {aid: audience["accent"] for aid, audience in data["audiences"].items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="print measurements without failing")
    args = parser.parse_args()

    accents = load_accents()
    failures: list[str] = []

    print(f"{'audience':<10}{'accent':<9}{'on cream':>9}{'white on':>9}{'on navy':>9}{'on dark':>9}")
    for aid, accent in accents.items():
        on_cream = contrast(accent, CREAM_SURFACE)
        on_white = contrast(accent, WHITE_TEXT)
        on_navy = contrast(accent, NAVY_HERO)
        on_dark = contrast(accent, DARK_SURFACE)
        flag = ""
        if on_cream < MIN_CONTRAST:
            failures.append(f"{aid}: {accent} is {on_cream:.2f}:1 on the cream surface, below {MIN_CONTRAST}:1")
            flag = "  <- fails on cream"
        if on_white < MIN_CONTRAST:
            failures.append(f"{aid}: {accent} is {on_white:.2f}:1 against white text, below {MIN_CONTRAST}:1")
            flag = "  <- fails white-on-accent"
        print(f"{aid:<10}{accent:<9}{on_cream:>9.2f}{on_white:>9.2f}{on_navy:>9.2f}{on_dark:>9.2f}{flag}")

    ids = list(accents)
    pairs = sorted(
        (delta_e(accents[a], accents[b]), a, b)
        for i, a in enumerate(ids)
        for b in ids[i + 1:]
    )
    print(f"\nworst pairwise separation: delta-E {pairs[0][0]:.1f} ({pairs[0][1]} vs {pairs[0][2]})")
    for distance, a, b in pairs[:3]:
        print(f"  {distance:6.1f}  {a} vs {b}")

    duplicates = {c for c in accents.values() if list(accents.values()).count(c) > 1}
    if duplicates:
        failures.append(f"two audiences share an accent: {sorted(duplicates)}")

    if failures:
        print("\nAccent contrast failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        if not args.report:
            raise SystemExit(1)
    else:
        print("\nAll seven accents meet 4.5:1 on the cream surface and against white text.")


if __name__ == "__main__":
    main()
