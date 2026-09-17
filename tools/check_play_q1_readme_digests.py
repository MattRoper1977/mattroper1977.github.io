#!/usr/bin/env python3
"""Refuse a hex digest or a region byte count in docs/play-q1/README.md.

A digest copied into prose has no derivation to recompute against, so nothing can tell
you when it goes stale. One did: the README carried the 51c6cf2 region digest and byte
count long after the keepHandoff re-stamp moved both, and the only reason anyone noticed
was an unrelated search. The record of truth is docs/play-q1/coverage.json, which its own
writer can check; this file must point at it rather than restate it.

Scope is deliberately this one file. It is not a repo-wide rule.

    python3 tools/check_play_q1_readme_digests.py [--self-test]
"""
import argparse
import pathlib
import re
import sys
import tempfile

TARGET = 'docs/play-q1/README.md'
HEX = re.compile(r'\b[0-9a-fA-F]{12,}\b')
# The region has been 20286/20287, 20432/20433 and 20559/20560 bytes. Any of them in
# prose is a copied measurement, which is the thing this refuses.
BYTES = re.compile(r'\b(?:20\d{3})\s*B\b')


def problems(text):
    found = []
    for number, line in enumerate(text.split('\n'), 1):
        for hit in HEX.findall(line):
            found.append((number, 'hex run of %d characters' % len(hit), hit))
        for hit in BYTES.findall(line):
            found.append((number, 'region byte count', hit))
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path('.'))
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()

    if args.self_test:
        clean = 'See docs/play-q1/coverage.json. Check it with --check.\n'
        assert not problems(clean), 'a clean README was rejected'
        for planted in ('digest `8415057da5448bc4`', 'sha256 8415057da544888b',
                        'moved to **20433 B**', 'the region is 20559 B now'):
            assert problems(clean + planted + '\n'), 'planted %r was accepted' % planted
        # a short hex-looking word must NOT trip it
        assert not problems(clean + 'the cafe12 build\n'), 'a short hex run was rejected'
        print('self-test: clean accepted, 4 planted digests/counts rejected, short hex ignored')
        return 0

    path = args.root / TARGET
    if not path.is_file():
        print('MISSING ' + str(path))
        return 1
    found = problems(path.read_text())
    if found:
        print('%s must not restate digests or byte counts -- %d found' % (TARGET, len(found)))
        print('the record of truth is docs/play-q1/coverage.json; check it with')
        print('  python3 tools/play_splash_coverage.py ... --check')
        for number, kind, hit in found:
            print('  line %-4d %-26s %s' % (number, kind, hit))
        return 1
    print('%s restates no digest and no byte count' % TARGET)
    return 0


if __name__ == '__main__':
    sys.exit(main())
