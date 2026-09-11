#!/usr/bin/env python3
"""AS1-G manifest gate, including a real copier allowlist mutation control."""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'domain-split'))
from play.manifest import verify


def controls():
    spec = importlib.util.spec_from_file_location('publication', ROOT / 'domain-split/build_publications.py')
    build = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(build)
    allowlist = json.loads((ROOT / 'domain-split/play/root-assets.json').read_text())
    assert 'site.webmanifest' in allowlist
    with tempfile.TemporaryDirectory(prefix='as1-manifest-control-') as temp:
        output = Path(temp)
        (output / 'index.html').write_text((ROOT / 'domain-split/play/index.html').read_text())
        # The gate judges files actually emitted by the publisher's copier.
        for size in (192, 512):
            name = f'assets/icons/app-icon-{size}.png'
            build.copy_file(ROOT / name, output, name)
        def emit(entries):
            (output / 'site.webmanifest').unlink(missing_ok=True)
            for destination, source in entries.items():
                build.copy_file(ROOT / source, output, destination)
        emit(allowlist)
        verify(output)
        print('root-asset allowlist original GREEN')
        removed = dict(allowlist)
        del removed['site.webmanifest']
        emit(removed)
        try:
            verify(output)
        except (AssertionError, FileNotFoundError):
            print('remove non-route site.webmanifest from allowlist RED')
        else:
            raise AssertionError('allowlist control did not fire')
        emit(allowlist)
        verify(output)
        print('restore non-route site.webmanifest GREEN')
        before = (output / 'index.html').read_text()
        (output / 'index.html').write_text(before.replace('<link rel="manifest" href="/site.webmanifest">', ''))
        try:
            verify(output)
        except AssertionError:
            print('remove homepage manifest link RED')
        else:
            raise AssertionError('link control did not fire')
        (output / 'index.html').write_text(before)
        verify(output)
        print('restore homepage manifest link GREEN')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        controls()
    if args.output:
        print(json.dumps(verify(args.output)))
    if not args.self_test and not args.output:
        parser.error('Supply --output or --self-test; empty verification is refused')
