#!/usr/bin/env python3
"""No --mbm-* name is defined in two places (SW2 T4, and SW2 order §0.6).

assets/mbm-tokens.css is stamped as the LAST stylesheet in <head>, so a name it
redefines wins the cascade and repaints every consumer of that name estate-wide.
Five did, and the repaint was real: /main/'s .mbm-audience ink moved #1B2140 ->
#161D3D and its #E3DAC5 divider became a faint navy hairline. §0.6 is one name
per thing; this is that rule made mechanical.

It runs both ways, because a collision is not only the token file's fault:

  * a name in assets/mbm-tokens.css that any other estate file also defines
  * a name that two DIFFERENT estate files define with different values, which
    is a latent collision the token file did not cause and does not fix --
    reported, not failed, so it is visible without blocking a part that did not
    create it. Repeat definitions within ONE file are not collisions: that is
    how a media query or a state selector varies a token, and flagging them
    buried the two real cross-file disagreements under TitanForge's scoped
    overrides.

Generated trees are excluded: domain-split/output/ is a build product and
_tfr2/ is a working copy of TitanForge, so both duplicate their sources by
design and would report every name twice.

  python3 tools/sw2/check_token_collisions.py
  python3 tools/sw2/check_token_collisions.py --self-test   # red proof
"""
from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TOKENS = ROOT / "assets" / "mbm-tokens.css"

SKIP_DIRS = {"output", "_tfr2", ".git", "node_modules", ".sources"}
READ_SUFFIXES = {".css", ".html", ".js", ".py"}

DEFINITION = re.compile(r"(--mbm-[a-z0-9-]+)\s*:\s*([^;}\n]+)")


def generated_token_copy():
    """Identify the one opted-in, byte-exact AS1 copy of the canonical file.

    The game must remain downloadable as one HTML file. Its generator embeds
    these same tokens; that copy is not a second definition owner. Verify the
    complete generated region and remove ONLY the leading canonical token
    bytes from this census. Brand, shell and handwritten game CSS remain in it.
    """
    spec = importlib.util.spec_from_file_location('as1_generator', ROOT / 'tools/render_arcade_pilot.py')
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    path, expected = generator.generate()
    prefix = generator.BEGIN + '\n<style>\n'
    tokens = TOKENS.read_text() + '\n'
    return path, expected, prefix, tokens


def without_generated_tokens(text, expected, prefix, tokens):
    if text != expected or text.count(prefix + tokens) != 1:
        raise ValueError('AS1 generated token copy drift; run the pilot generator')
    start = text.index(prefix + tokens) + len(prefix)
    return text[:start] + text[start + len(tokens):]


def definitions() -> dict[str, set[tuple[str, str]]]:
    """name -> {(file, value)} across the estate, generated trees excluded."""
    found: dict[str, set[tuple[str, str]]] = defaultdict(set)
    generated_path, expected, prefix, tokens = generated_token_copy()
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in READ_SUFFIXES:
            continue
        if SKIP_DIRS & set(path.relative_to(ROOT).parts):
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        if path == generated_path:
            text = without_generated_tokens(text, expected, prefix, tokens)
        rel = str(path.relative_to(ROOT))
        for name, value in DEFINITION.findall(text):
            found[name].add((rel, value.strip()))
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="add a known collision in memory and assert this gate fails on it",
    )
    args = parser.parse_args()

    try:
        found = definitions()
    except (ValueError, AssertionError) as error:
        print('Token ownership verification failed: ' + str(error), file=sys.stderr)
        return 1
    mine = {n for n, _ in DEFINITION.findall(TOKENS.read_text())}
    rel_tokens = str(TOKENS.relative_to(ROOT))

    if args.self_test:
        _, expected, prefix, tokens = generated_token_copy()
        # A changed embedded copy is rejected before any definitions can be
        # omitted. An extra definition outside the copy remains in the census.
        changed = expected.replace(prefix + tokens, prefix + tokens.replace('#f6f1e7', '#000000', 1), 1)
        assert changed != expected, 'Generated-copy mutation did not fire'
        try:
            without_generated_tokens(changed, expected, prefix, tokens)
        except ValueError:
            pass
        else:
            raise AssertionError('Changed generated token copy escaped')
        extra = '\n<style>:root{' + '--mbm-primary' + ':#010203}</style>\n'
        assert ('--mbm-primary', '#010203') in DEFINITION.findall(
            without_generated_tokens(expected + extra, expected + extra, prefix, tokens))
        print('Generated ownership controls: changed copy rejected; external collision retained')
        # The red proof, without editing the shipped file: put back the worst of
        # the five collisions and require this gate to catch it.
        mine = mine | {"--mbm-line"}
        found["--mbm-line"].add((rel_tokens, "#30475c"))

    problems: list[str] = []
    for name in sorted(mine):
        elsewhere = sorted(f for f, _ in found[name] if f != rel_tokens)
        if elsewhere:
            values = "; ".join(f"{v!r} [{f}]" for f, v in sorted(found[name]))
            problems.append(f"{name} is defined in {rel_tokens} AND {', '.join(elsewhere)} -- {values}")

    latent: list[str] = []
    for name, places in sorted(found.items()):
        if name in mine:
            continue
        by_file = {}
        for f, v in places:
            by_file.setdefault(f, set()).add(v)
        if len(by_file) > 1 and len({v for _, v in places}) > 1:
            latent.append(f"{name}: " + "; ".join(f"{v!r} [{f}]" for f, v in sorted(places)))

    print(f"token collisions: {len(mine)} names in {rel_tokens}, "
          f"{len(found)} --mbm-* names defined across the estate")
    if latent:
        print(f"\nlatent, not this file's doing ({len(latent)} name(s) the estate itself defines twice):")
        for line in latent:
            print("  " + line)

    if problems:
        print(f"\nPROBLEMS: {len(problems)}", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        return 1

    print(f"\nno name in {rel_tokens} is defined anywhere else in the estate")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
