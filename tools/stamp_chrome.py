#!/usr/bin/env python3
"""Stamp the shared chrome into every static page type (SW2 T3).

The templates live in assets/chrome/ in this repository and are pinned by the
commit recorded in TEMPLATE_PIN below. Output is committed, so a page's chrome
is readable in the tree rather than assembled at request time; --check asserts
each stamped region still equals the template for that pin, and is what the
gate runs.

Which variant a page gets is DERIVED, never typed: data/adult-surfaces.json is
the estate's own record of which surfaces a pupil can reach, and it is the same
record tools/verify_professional_site.js reads to decide where an
account-backed link must be absent. A page in neither list is not stamped, and
is reported, rather than guessed at.
"""
from __future__ import annotations
import argparse, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = ROOT / 'assets' / 'chrome'
RECORD = ROOT / 'data' / 'adult-surfaces.json'

# The site commit these templates were reviewed at. Moving the templates means
# moving this, in the same commit, so a stamped page always names the bytes it
# came from.
TEMPLATE_PIN = '0c8964c'

# Generated page types. The /for/ pages come from tools/render_audience_homepages.py
# and the discovery hubs from tools/render_discovery_hubs.py; stamping their
# output would be overwritten on the next generation, so the generator consumes
# the templates instead. Listed here so "not stamped" is a stated decision.
GENERATED = ('for/', 'asdan/', 'uas/')

MARKERS = {
    'header': ('<!-- mbm-chrome:header -->', '<!-- /mbm-chrome:header -->'),
    'footer': ('<!-- mbm-chrome:footer -->', '<!-- /mbm-chrome:footer -->'),
}


def variant_block(name: str, variant: str) -> str | None:
    text = (CHROME / f'{name}.html').read_text()
    match = re.search(
        r'<!-- MBM-CHROME-VARIANT: ' + variant + r' -->\n(.*?)\n<!-- /MBM-CHROME-VARIANT: ' + variant + r' -->',
        text, re.S)
    return match.group(1) if match else None


def composed(kind: str, variant: str) -> str | None:
    """The bytes a page of this variant should carry for this region."""
    if kind == 'header':
        head = variant_block('header', variant)
        row = variant_block('nav-row', variant)
        if head is None or row is None:
            return None
        return head.replace('<!-- MBM-CHROME-NAV-ROW -->', row)
    block = variant_block('footer', variant)
    if block is None or 'MBM-CHROME-KEEP-EXISTING' in block:
        return None
    return block


def surfaces() -> dict[str, str]:
    """page -> variant, read from the record."""
    record = json.loads(RECORD.read_text())
    out: dict[str, str] = {}
    for entry in record['adultSurfaces']:
        out[str(entry['page'])] = 'adult'
    for entry in record['pupilReachableSurfaces']:
        out[str(entry['page'])] = 'pupil'
    return out


def region(text: str, kind: str) -> tuple[int, int] | None:
    open_marker, close_marker = MARKERS[kind]
    start = text.find(open_marker)
    if start >= 0:
        end = text.find(close_marker, start)
        if end < 0:
            raise ValueError(f'unclosed {kind} marker')
        return start, end + len(close_marker)
    match = re.search(rf'<{kind}\b[^>]*>.*?</{kind}>', text, re.S)
    return (match.start(), match.end()) if match else None


def stamped(kind: str, body: str) -> str:
    open_marker, close_marker = MARKERS[kind]
    return f'{open_marker}\n{body}\n{close_marker}'


def apply(page: Path, variant: str, check: bool) -> list[str]:
    problems: list[str] = []
    text = original = page.read_text()
    for kind in ('header', 'footer'):
        body = composed(kind, variant)
        if body is None:
            continue
        span = region(text, kind)
        want = stamped(kind, body)
        if span is None:
            if check:
                problems.append(f'{page.relative_to(ROOT)}: no {kind} to stamp')
            else:
                text = text.replace('</body>', want + '\n</body>', 1) if kind == 'footer' else text
            continue
        have = text[span[0]:span[1]]
        if have != want:
            if check:
                problems.append(f'{page.relative_to(ROOT)}: {kind} region differs from the template at {TEMPLATE_PIN}')
            else:
                text = text[:span[0]] + want + text[span[1]:]
    if not check and text != original:
        page.write_text(text)
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true',
                        help='assert every stamped region equals the template; write nothing')
    parser.add_argument('--only', help='restrict to one page, for the red proof')
    args = parser.parse_args()

    problems, done, skipped = [], [], []
    for page, variant in sorted(surfaces().items()):
        if args.only and page != args.only:
            continue
        if page.startswith(GENERATED):
            skipped.append(f'{page} (generated; the generator consumes the templates)')
            continue
        path = ROOT / page
        if not path.is_file():
            skipped.append(f'{page} (not a file in this repository)')
            continue
        problems += apply(path, variant, args.check)
        done.append(f'{page} [{variant}]')

    print(f'templates pinned at {TEMPLATE_PIN}; chrome sha256 '
          f'{hashlib.sha256(b"".join(sorted((CHROME/f).read_bytes() for f in ("header.html","nav-row.html","footer.html","menu-sheet.html")))).hexdigest()[:12]}')
    print(f'{"checked" if args.check else "stamped"}: {len(done)}')
    for line in done:
        print('  ', line)
    if skipped:
        print(f'not stamped: {len(skipped)}')
        for line in skipped:
            print('  ', line)
    if problems:
        print(f'PROBLEMS: {len(problems)}', file=sys.stderr)
        for line in problems:
            print('  ', line, file=sys.stderr)
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
