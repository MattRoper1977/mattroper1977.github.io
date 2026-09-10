#!/usr/bin/env python3
"""Fail closed on every unreviewed publication file; preserve semantic gates."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / 'education-publication-admission.json'
TREES = ('education-site', 'education-lessons', 'education-apps')
# Data/CSS are included because an already admitted script can consume them.
# Native teaching-pack binaries and media retain their existing gates AND exact admission.
REVIEWED = {'.html', '.htm', '.js', '.mjs', '.wasm', '.svg', '.json', '.webmanifest',
            '.css', '.xml', '.txt', '.bin', '.map', '.md', '.csv'}
INERT = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf',
         '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.pdf', '.zip', '.docx', '.pptx', '.xlsx'}
SPECIAL = {'.nojekyll', 'CNAME', 'LICENSE'}


def pairs(items):
    result = {}
    for key, value in items:
        if key in result:
            raise ValueError('Duplicate admission key: '+key)
        result[key] = value
    return result


def valid_path(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or str(path) != value or '\\' in value or any(p in {'.', '..'} for p in path.parts) or any(ord(c)<32 for c in value):
        raise ValueError('Invalid admission path: '+repr(value))


def census(tree):
    if not tree.is_dir() or tree.is_symlink():
        raise ValueError('Missing or linked publication tree: '+str(tree))
    result = {}
    for file in sorted(tree.rglob('*')):
        if file.is_symlink():
            raise ValueError('Symlink in publication: '+str(file))
        if not file.is_file():
            continue
        relative = file.relative_to(tree).as_posix()
        valid_path(relative)
        suffix = file.suffix.lower()
        if suffix not in REVIEWED | INERT and file.name not in SPECIAL:
            raise ValueError('Unclassified publication file: '+str(file))
        # A suffix is not a safety boundary: scripts or data can be disguised
        # as media/native files. Every emitted path and byte needs approval.
        result[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
    if not any(Path(p).suffix.lower() in {'.html', '.htm'} for p in result):
        raise ValueError('No HTML routes in publication: '+str(tree))
    return result


def load_registry(path=REGISTRY):
    registry = json.loads(path.read_text(), object_pairs_hook=pairs)
    if registry.get('schemaVersion') != 1 or set(registry.get('trees', {})) != set(TREES):
        raise ValueError('Unsupported or incomplete education admission registry')
    for name, files in registry['trees'].items():
        if not files:
            raise ValueError('Empty admission tree: '+name)
        for path, digest in files.items():
            valid_path(path)
            # HC4 §3.3 / §4: a path may carry a TRANSITION PAIR — exactly two
            # reviewed digests, the byte-state on the owning repository's main
            # today and the reviewed byte-state its pending PR will land — so a
            # cross-repository change can be admitted before and after that
            # PR merges without a lockstep publication. Never more than two,
            # never a wildcard; both digests are reviewed in the same diff.
            validate_digest_set(name, path, digest)
    return registry


def validate_digest_set(name, path, digest):
    candidates = digest if isinstance(digest, list) else [digest]
    if not 1 <= len(candidates) <= 2 or len(set(candidates)) != len(candidates):
        raise ValueError('Invalid reviewed digest set: '+name+'/'+path)
    # HC5 §1: an ARRIVING path — exactly one reviewed digest plus the
    # literal ARRIVING — is a file the owning repository's main now
    # carries but this repository's own pinned source checkout predates.
    # A build from the older source may lack it (never CHANGED, never
    # UNREVIEWED); a build that has it must match the one digest exactly.
    # Drop the marker when the pinned source moves past the arrival.
    if ARRIVING in candidates and len(candidates) != 2:
        raise ValueError('ARRIVING needs exactly one reviewed digest beside it: '+name+'/'+path)
    for item in candidates:
        if item == ARRIVING:
            continue
        if not isinstance(item, str) or not re.fullmatch('[0-9a-f]{64}', item):
            raise ValueError('Invalid reviewed digest: '+name+'/'+path)


ARRIVING = 'ARRIVING'


def admitted(expected):
    return {d for d in (expected if isinstance(expected, list) else [expected]) if d != ARRIVING}


def may_be_absent(expected):
    return isinstance(expected, list) and ARRIVING in expected


def verify_tree(tree, name, registry):
    return verify_tree_census(census(tree), name, registry)


def verify_tree_census(actual, name, registry):
    expected = registry['trees'][name]
    problems = []
    for path in sorted(set(expected) | set(actual)):
        if path not in expected:
            problems.append('UNREVIEWED '+name+'/'+path)
        elif path not in actual:
            if not may_be_absent(expected[path]):
                problems.append('MISSING '+name+'/'+path)
        elif actual[path] not in admitted(expected[path]):
            problems.append('CHANGED '+name+'/'+path)
    if problems:
        raise ValueError('Education file admission blocked publication:\n'+'\n'.join(problems))
    return {'tree': name, 'reviewedFiles': len(actual),
            'htmlRoutes': sum(Path(p).suffix.lower() in {'.html', '.htm'} for p in actual)}


def verify(output, registry_path=REGISTRY):
    registry = load_registry(registry_path)
    return [verify_tree(output/name, name, registry) for name in TREES]


def propose(output, destination, source_notes):
    # Explicit proposal only. Neither deploy nor verification calls this path.
    if destination.resolve() == REGISTRY.resolve():
        raise ValueError('Write a separate proposal; the committed registry requires a reviewed diff')
    proposal = {'schemaVersion': 1,
                'scope': 'Exact all-file publication admission; semantic route classification remains a separate gate',
                'reviewSources': source_notes,
                'trees': {name: census(output/name) for name in TREES}}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(proposal, ensure_ascii=False, indent=2)+'\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=HERE/'output')
    parser.add_argument('--registry', type=Path, default=REGISTRY)
    parser.add_argument('--proposal', type=Path)
    parser.add_argument('--review-source', action='append', default=[])
    args = parser.parse_args()
    if args.proposal:
        if not args.review_source:
            parser.error('A proposal needs explicit reviewed source identities')
        propose(args.output, args.proposal, args.review_source)
        print('PROPOSAL ONLY — not an approval:', args.proposal)
    else:
        print(json.dumps({'status': 'PASS', 'publications': verify(args.output, args.registry)}, indent=2))


if __name__ == '__main__':
    main()
