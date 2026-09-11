#!/usr/bin/env python3
"""Derive resource sizes from a catalogue and the files in the same tree.

Source catalogues declare recreational handoffs with type=game, the class
the Education publisher turns into data-game-moved HTML. Such routes are
not downloadable Education resources. Published HTML handoffs are also
recognised by their body marker, including ones absent from that catalogue
class. Neither exclusion depends on a route list or an expected count.

The source --write/--check measure source bytes. The immutable publisher
runs the same derivation on its finished Education tree, after navigation
and discovery transforms, and verifies those exact published bytes.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
TABLE = 'data/resource-sizes.json'


def local_path(value: str) -> str | None:
    if not value or '://' in value:
        return None
    value = value.split('#')[0].split('?')[0]
    path = PurePosixPath(value)
    if not value or path.is_absolute() or str(path) != value or '\\' in value or any(part in {'.', '..'} for part in path.parts):
        raise ValueError('Invalid resource-size input path: '+repr(value))
    return value


def html_handoff(file: Path) -> bool:
    if file.suffix.lower() not in {'.html', '.htm'} or not file.is_file():
        return False
    data = file.read_bytes()
    if b'data-game-moved' not in data.lower():
        return False
    class Body(HTMLParser):
        moved = False
        def handle_starttag(self, tag, attrs):
            if tag == 'body' and 'data-game-moved' in dict(attrs):
                self.moved = True
    document = Body()
    document.feed(data.decode('utf-8'))
    return document.moved


def paths(root: Path = ROOT) -> list[str]:
    wanted = set()
    source_handoffs = set()
    for row in json.loads((root/'resources.json').read_text('utf-8')):
        row_paths = []
        primary = local_path(row.get('file') or row.get('url') or '')
        if primary:
            row_paths.append(primary)
        for item in row.get('files', []) or []:
            rel = local_path(item.get('path', ''))
            if rel:
                row_paths.append(rel)
        if row.get('type') == 'game':
            source_handoffs.update(row_paths)
        wanted.update(row_paths)
    packs = root/'data/companion-packs.json'
    if packs.is_file():
        for pack in json.loads(packs.read_text('utf-8')).get('packs', []):
            for item in pack.get('files', []):
                rel = local_path(item.get('path', ''))
                if rel:
                    wanted.add(rel)
    return sorted(rel for rel in wanted if rel not in source_handoffs and not html_handoff(root/rel))


def derive(root: Path = ROOT) -> dict:
    root = root.resolve()
    sizes, missing = {}, []
    for rel in paths(root):
        target = root/rel
        if target.is_symlink() or not target.resolve().is_relative_to(root):
            raise ValueError('Linked resource-size input: '+rel)
        if target.is_file():
            sizes[rel] = target.stat().st_size
        else:
            missing.append(rel)
    return {'schema': 'mbm-resource-sizes-v1', 'unit': 'bytes', 'measured': len(sizes), 'missing': missing, 'sizes': sizes}


def serialise(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, indent=1)+'\n'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root', type=Path, default=ROOT, help='The tree whose catalogue and bytes are being measured')
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    value = derive(args.root)
    text = serialise(value)
    output = args.root/TABLE
    if value['missing']:
        print('[FAIL] Missing resource-size inputs: '+', '.join(value['missing']))
        return 1
    if args.write:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text, 'utf-8')
        print(f"[DONE] wrote {TABLE}: {value['measured']} sizes, {len(value['missing'])} missing")
    if args.check or not args.write:
        current = output.read_text('utf-8') if output.is_file() else ''
        if current != text:
            print(f'[FAIL] {TABLE} differs from the working tree — run: python3 tools/ux2/resource_sizes.py --write')
            return 1
        print(f"[PASS] {TABLE} matches the working tree: {value['measured']} sizes, {len(value['missing'])} missing")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
