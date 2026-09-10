#!/usr/bin/env python3
"""Bind native receiver browser checks to a successful Play deployment artifact."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from publication_artifacts import GitHub, head, prepare_one, require

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = 'Lessons/Games/Glitch_Clash.html'


def reviewed():
    record = json.loads((ROOT/'domain-split/play/source-revisions.json').read_text())['payloads'][PAYLOAD]
    return next(row for row in record['revisions'] if row['id'] == record['current'])


def verify_bytes(data, revision):
    require(hashlib.sha256(data).hexdigest() == revision['published_sha256'],
            'Play has not published the reviewed native campaign receiver bytes')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--games', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--control', type=Path)
    args = parser.parse_args()
    revision = reviewed()
    if args.control:
        original = (args.control/PAYLOAD).read_bytes()
        verify_bytes(original, revision)
        try:
            verify_bytes(original+b'<!-- planted changed receiver -->', revision)
        except Exception as error:
            require('reviewed native campaign receiver bytes' in str(error), 'Wrong firing-control failure')
        else:
            raise AssertionError('Changed receiver bytes passed')
        verify_bytes(original, revision)
        print('Native payload binding: real PASS / one changed byte FAIL / restored PASS')
        return
    parser.error('--games and --output are required') if not args.games or not args.output else None
    args.output.mkdir(parents=True, exist_ok=True)
    config = json.loads((args.games/'play-publication.json').read_text())
    require(config['domain'] == 'madebymatt-play.uk', 'Unexpected Play domain')
    try:
        receipt = prepare_one('games', head(args.games), args.output, GitHub(time.monotonic()+300))
        file = Path(receipt['root'])/PAYLOAD
        verify_bytes(file.read_bytes(), revision)
    except Exception as error:
        failure = {'status': 'BLOCKED', 'reason': str(error), 'source_sha': head(args.games),
                   'pins': config, 'revision': revision, 'scope': 'No native live proof was performed'}
        (args.output/'native-publication.json').write_text(json.dumps(failure, indent=2)+'\n')
        raise
    proof = {'publication': receipt, 'pins': config, 'revision': revision,
             'route': '/'+PAYLOAD, 'origin': 'https://www.madebymatt-play.uk',
             'expected_sha256': revision['published_sha256']}
    (args.output/'native-publication.json').write_text(json.dumps(proof, indent=2)+'\n')
    print('Exact successful Play artifact contains the reviewed native receiver')


if __name__ == '__main__':
    main()
