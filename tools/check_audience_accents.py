#!/usr/bin/env python3
"""Measure the homepage accents rather than eyeballing them.

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

Eight homepage types are measured, not seven. /main/ became selectable on
2026-08-10 and carries a chooser card with the same left bar, icon and
white-on-accent pill, so it carries the same obligation. It is read from
mainOption, which sits outside `audiences` for reasons the data file records.

Separation is reported as worst pairwise CIELAB delta-E (Euclidean CIE76, not
CIEDE2000). Front doors that differ only by colour would be a colour-only cue,
so the name and icon carry the meaning; the accent is reinforcement. Among the
seven audiences the figure is reported and not enforced, because how far apart
audience colours should sit is a design ruling. For the platform option the
ruling exists - it may not collapse the distinctness the seven already keep -
so that one is enforced, relative to the seven rather than against a number
typed in here.

A dark-theme section follows, because the theme repaints both grounds and the
raw accent reached only 2.0-2.9:1 there for the seven and 1.18:1 for the
platform option. The recipe is parsed out of assets/mbm-audience.css so this
tool cannot end up measuring a blend the page no longer paints.

Usage:
  python3 tools/check_audience_accents.py             # gate: exit 1 on failure
  python3 tools/check_audience_accents.py --report    # measurements only
  python3 tools/check_audience_accents.py --self-test # prove the bars fire
"""
from __future__ import annotations

import argparse
import json
import math
import re
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


MIN_NON_TEXT_CONTRAST = 3.0


def load_accents() -> dict[str, str]:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return {aid: audience["accent"] for aid, audience in data["audiences"].items()}


def load_main_option(data: dict | None = None) -> dict | None:
    """The platform option's accent, which carries the same obligation.

    /main/ became a selectable homepage type on 2026-08-10, so it has a card in
    the chooser with a left bar, an icon painted in the accent and a pill with
    white text on it - the same three uses, therefore the same two bars.

    Its separation obligation is different from the seven's, and deliberately
    so. For the seven, separation is reported and not enforced, because how far
    apart audience colours should sit is a design ruling. For the eighth the
    ruling exists: it may not collapse the distinctness the seven already have.
    That is enforced RELATIVE to the seven rather than against a number typed
    here, so it still means what it says if an audience accent ever moves.
    """
    if data is None:
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return data.get("mainOption")


AUDIENCE_CSS = ROOT / "assets" / "mbm-audience.css"


def srgb_mix(one: str, two: str, share: float) -> str:
    """CSS color-mix(in srgb, one <share>%, two), which blends the 8-bit values."""
    a = [int(one.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(two.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#%02X%02X%02X" % tuple(round(a[i] * share + b[i] * (1 - share)) for i in range(3))


def dark_theme_grounds(css: str | None = None) -> tuple[float, str, str, str]:
    """Read the dark-theme recipe out of the stylesheet that owns it.

    Every number here is parsed rather than typed. A copy of the mix percentage
    in this file would let the CSS move and leave the measurement reporting on a
    blend the page no longer paints - which is the failure this whole tool
    exists to make impossible for the accents themselves.
    """
    css = AUDIENCE_CSS.read_text(encoding="utf-8") if css is None else css
    recipe = re.search(r"--choice-ink:color-mix\(in srgb,var\(--choice-accent\) (\d+)%,(#[0-9A-Fa-f]{6})\)", css)
    square = re.search(r"\.mf-choice-icon,\s*\n[^{\n]*\.mf-utility-icon\{background:(#[0-9A-Fa-f]{6})\}", css)
    surface = re.search(r'body\[data-theme="dark"\]\.mbm-face-page\{[^}]*--mf-surface:(#[0-9A-Fa-f]{6})', css)
    if not (recipe and square and surface):
        missing = [name for name, hit in
                   (("--choice-ink recipe", recipe), (".mf-choice-icon ground", square), ("dark --mf-surface", surface))
                   if not hit]
        raise SystemExit(f"assets/mbm-audience.css: cannot read the dark-theme recipe ({', '.join(missing)}); "
                         f"the dark-theme measurement below would be about a page that no longer exists")
    return int(recipe.group(1)) / 100, recipe.group(2), square.group(1), surface.group(1)


def separation_floor(accents: dict[str, str]) -> tuple[float, str, str]:
    ids = list(accents)
    pairs = sorted(
        (delta_e(accents[a], accents[b]), a, b)
        for i, a in enumerate(ids)
        for b in ids[i + 1:]
    )
    return pairs[0]


def load_visual_accents() -> dict[str, str]:
    """Accents used only where they carry no text.

    An audience whose specified cue cannot reach 4.5:1 keeps the cue here - on
    rules, bars and washes, which are non-text UI at 3:1 - while --face-accent
    carries a darker compliant tone everywhere text or an icon sits on it.
    """
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return {
        aid: audience["accentVisual"]
        for aid, audience in data["audiences"].items()
        if audience.get("accentVisual")
    }


def measure(accents: dict[str, str], main_option: dict | None, out=print,
            dark: tuple[float, str, str, str] | None = None) -> list[str]:
    """Measure every accent and return the failures. Shared by the gate and the
    controls, so a control exercises the same code the gate runs."""
    failures: list[str] = []
    rows = list(accents.items())
    if main_option:
        rows.append((main_option["id"], main_option["accent"]))

    out(f"{'homepage':<10}{'accent':<9}{'on cream':>9}{'white on':>9}{'on navy':>9}{'on dark':>9}")
    for aid, accent in rows:
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
        out(f"{aid:<10}{accent:<9}{on_cream:>9.2f}{on_white:>9.2f}{on_navy:>9.2f}{on_dark:>9.2f}{flag}")

    floor, floor_a, floor_b = separation_floor(accents)
    out(f"\nworst pairwise separation among the {len(accents)} audiences: "
        f"delta-E {floor:.1f} CIE76 ({floor_a} vs {floor_b})")

    if main_option:
        nearest, nearest_id = min(
            (delta_e(main_option["accent"], accent), aid) for aid, accent in accents.items()
        )
        out(f"platform option {main_option['accent']}: nearest audience accent delta-E {nearest:.1f} CIE76 "
            f"({nearest_id})")
        if nearest < floor:
            failures.append(
                f"{main_option['id']}: {main_option['accent']} sits delta-E {nearest:.1f} from {nearest_id}, "
                f"inside the {floor:.1f} the {len(accents)} audiences already keep between themselves; the "
                f"eighth homepage type may not collapse that distinctness"
            )

    # The dark theme repaints the card and the icon square, so the accent meets
    # different grounds there. The glyph and the 6px bar are non-text UI, so the
    # bar is 3:1 - but the raw accent reached only 2.0-2.9:1 for the seven and
    # 1.18:1 for the platform option, which is why the theme lifts it.
    share, ink, square, card = dark or dark_theme_grounds()
    out(f"\nDark theme (glyph and bar painted as color-mix(accent {int(share * 100)}%, {ink}), 3:1 bar):")
    for aid, accent in rows:
        lifted = srgb_mix(accent, ink, share)
        on_square = contrast(lifted, square)
        on_card = contrast(lifted, card)
        flag = ""
        if min(on_square, on_card) < MIN_NON_TEXT_CONTRAST:
            failures.append(
                f"{aid}: under the dark theme {accent} paints as {lifted}, "
                f"{min(on_square, on_card):.2f}:1 against {square if on_square <= on_card else card}, "
                f"below {MIN_NON_TEXT_CONTRAST}:1"
            )
            flag = "  <- fails the dark-theme bar"
        out(f"  {aid:<10}{accent} -> {lifted}   icon square {on_square:>5.2f}   card {on_card:>5.2f}{flag}")

    visual = load_visual_accents()
    if visual:
        out("\nNon-text accents (3:1 bar - rules, bars and washes only):")
        for aid, accent in visual.items():
            on_cream = contrast(accent, CREAM_SURFACE)
            on_navy = contrast(accent, NAVY_HERO)
            flag = ""
            if on_cream < MIN_NON_TEXT_CONTRAST:
                failures.append(f"{aid}: non-text accent {accent} is {on_cream:.2f}:1 on cream, below {MIN_NON_TEXT_CONTRAST}:1")
                flag = "  <- fails non-text bar"
            out(f"  {aid:<10}{accent:<9}on cream {on_cream:>5.2f}   on navy {on_navy:>5.2f}{flag}")

    used = [accent for _, accent in rows]
    duplicates = {c for c in used if used.count(c) > 1}
    if duplicates:
        failures.append(f"two homepage types share an accent: {sorted(duplicates)}")
    return failures


def self_test() -> int:
    """Break the platform accent four ways and prove each is caught.

    The shipped data is measured first. A control run against an already-failing
    palette would report a failure that was there before the mutation, and each
    control below would "pass" without having tested anything.
    """
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    accents = load_accents()
    quiet: list[str] = []
    baseline = measure(accents, load_main_option(data), out=quiet.append)
    if baseline:
        print("[FAIL] precondition: the shipped palette already fails, so no control below can be "
              "told apart from that failure")
        for item in baseline:
            print(" -", item)
        return 1

    problems = 0

    def control(label: str, accent: str, expected: str) -> None:
        nonlocal problems
        broken = dict(load_main_option(data) or {})
        broken["accent"] = accent
        found = measure(accents, broken, out=lambda _line: None)
        if any(expected.lower() in item.lower() for item in found):
            print(f"[PASS] positive control: {label}")
            return
        print(f"[FAIL] positive control not detected: {label} ({accent})")
        for item in found:
            print(" -", item)
        problems += 1

    nearest_audience = min(accents.items(), key=lambda kv: delta_e((load_main_option(data) or {})["accent"], kv[1]))
    control("platform accent too light for the cream surface", "#C9D4F2", "on the cream surface")
    control("platform accent too light against white text", "#C9D4F2", "against white text")
    control("platform accent moved onto its nearest audience", nearest_audience[1], "share an accent")
    # One step off an audience accent: distinct enough not to be a duplicate,
    # far too close to be a separate cue. This is the control the duplicate
    # check cannot stand in for.
    near = "#{:02X}{:02X}{:02X}".format(
        int(nearest_audience[1][1:3], 16) + 2, int(nearest_audience[1][3:5], 16), int(nearest_audience[1][5:7], 16)
    )
    control("platform accent nudged next to an audience accent", near, "may not collapse that distinctness")

    # The dark-theme bar needs its own control, and not a colour one. At the
    # shipped 45% mix almost no accent can fail it - which is the whole point of
    # the mix, and also exactly how a check ends up unfalsifiable and nobody
    # notices. The regression it is actually there to catch is the lift being
    # removed, so that is what this breaks: the same measurement, run against a
    # recipe that paints the raw accent.
    share, ink, square, card = dark_theme_grounds()
    raw = measure(accents, load_main_option(data), out=lambda _line: None, dark=(1.0, ink, square, card))
    unlifted = [item for item in raw if "under the dark theme" in item]
    if unlifted:
        print(f"[PASS] positive control: dark theme stops lifting the accent "
              f"({len(unlifted)} homepage type(s) drop below {MIN_NON_TEXT_CONTRAST}:1)")
    else:
        print("[FAIL] positive control not detected: dark theme stops lifting the accent")
        problems += 1

    print(f"\n{'[FAIL]' if problems else '[PASS]'} platform accent self-test: {problems} problem(s)")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", action="store_true", help="print measurements without failing")
    parser.add_argument("--self-test", action="store_true", help="prove the accent bars fire")
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(1 if self_test() else 0)

    failures = measure(load_accents(), load_main_option())

    if failures:
        print("\nAccent contrast failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        if not args.report:
            raise SystemExit(1)
    else:
        print("\nEvery homepage accent meets 4.5:1 on the cream surface and against white text,")
        print("and the platform option keeps the separation the audiences already hold.")


if __name__ == "__main__":
    main()
