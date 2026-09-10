#!/usr/bin/env python3
"""Every ink/surface pair the token file names clears its WCAG minimum.

SW2 T1 asks for it measured and in the ledger; T4 asks for it on cream AND dark.
The values are READ from assets/mbm-tokens.css rather than retyped here, so a
palette change cannot pass a stale table -- and a pair that stops existing stops
being asserted, which is why the pair count is printed beside the verdict.

The pairs are not guessed. This file's whole convention is that a background
token carries its own ink, and it spells that two ways: --mbm-format-html with
--mbm-format-html-ink, and --mbm-pathway-build-BG with --mbm-pathway-build-INK.
Both are read. Deriving only the first form silently measured 28 pairs and
skipped the three pathway chips without saying so, which is the failure mode
this whole file exists to prevent -- so an --mbm-*-ink token with no surface to
sit on is now an error, not a skip.

Thresholds follow the order: 4.5:1 for text, 3:1 for large text and chip
BOUNDARIES. Everything below is small text on its surface, so everything below
is held to 4.5 -- the paired-ink convention exists precisely so no pair has to
be argued down to 3.

Why the amber pairs matter: --mbm-format-html #F2A24A is 7.86:1 under
#161d3d ink and 2.09:1 under white. --mbm-subject-lifeskills is the same amber.
Either would be a silent failure if the file named one ink for all four badges,
which is why it names four.

  python3 tools/sw2/check_token_contrast.py
  python3 tools/sw2/check_token_contrast.py --min 7   # red proof
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TOKENS = ROOT / "assets" / "mbm-tokens.css"

HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def blocks(text: str) -> dict[str, dict[str, str]]:
    """The :root and [data-theme=dark] declarations, as two name->value maps."""
    out: dict[str, dict[str, str]] = {"cream": {}, "dark": {}}
    for label, pattern in (("cream", r"^:root\{(.*?)^\}"), ("dark", r'^\[data-theme="dark"\]\{(.*?)^\}')):
        m = re.search(pattern, text, re.S | re.M)
        if not m:
            continue
        body = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
        for name, value in re.findall(r"(--mbm-[a-z0-9-]+)\s*:\s*([^;]+);", body):
            out[label][name] = value.strip()
    # dark overrides cream; a token the dark block does not restate keeps its value
    out["dark"] = {**out["cream"], **out["dark"]}
    return out


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    channels = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def pairs(values: dict[str, str]) -> tuple[list[tuple[str, str]], list[str]]:
    """(ink, surface) pairs from the file's naming, plus any ink left unpaired."""
    found: list[tuple[str, str]] = []
    unpaired: list[str] = []
    for ink in values:
        if not ink.endswith("-ink"):
            continue
        stem = ink[: -len("-ink")]
        for surface in (stem, stem + "-bg"):   # both spellings of the convention
            if surface in values:
                found.append((ink, surface))
                break
        else:
            unpaired.append(ink)
    for surface in ("--mbm-bg", "--mbm-card", "--mbm-card-raised"):
        for ink in ("--mbm-primary", "--mbm-accent"):
            if ink in values and surface in values:
                found.append((ink, surface))
    return sorted(set(found)), sorted(unpaired)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min", type=float, default=4.5, help="minimum ratio (raise it to red-prove)")
    args = parser.parse_args()

    palettes = blocks(TOKENS.read_text())
    problems: list[str] = []
    total = 0

    for label, values in palettes.items():
        print(f"\n{label}:")
        found, unpaired = pairs(values)
        for ink in unpaired:
            problems.append(f"{label}: {ink} names an ink with no surface to sit on -- "
                            "it would never be measured")
        for ink, surface in found:
            a, b = values.get(ink, ""), values.get(surface, "")
            if not (HEX.match(a) and HEX.match(b)):
                continue
            total += 1
            r = ratio(a, b)
            ok = r >= args.min
            print(f"  {'ok ' if ok else 'LOW'} {r:5.2f}:1  {ink} {a} on {surface} {b}")
            if not ok:
                problems.append(f"{label}: {ink} {a} on {surface} {b} is {r:.2f}:1, under {args.min}:1")

    print(f"\ncontrast: {total} ink/surface pairs across {len(palettes)} palettes, minimum {args.min}:1")
    if problems:
        print(f"\nPROBLEMS: {len(problems)}", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        return 1
    print("every pair clears its minimum on cream and on dark")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
