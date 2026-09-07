#!/usr/bin/env python3
"""Bind the live sender, project stub and native receiver to three publications."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'domain-split'))
from publication_artifacts import GitHub, head, prepare_one, require
from hc3_native_publication import reviewed, verify_bytes, PAYLOAD
from stub_handoff import decorate, ROUTE
from build_education import moved_page

ROOT = Path(__file__).resolve().parents[1]

def verify_components(publications):
    expected = {
        'sender': (Path(publications['site']['root'])/'stub-handoff.js', (ROOT/'domain-split/stub-handoff.js').read_bytes()),
        'stub': (Path(publications['lessons']['root'])/'Games/Glitch_Clash.html', decorate(ROUTE, moved_page(ROUTE)).encode()),
    }
    digests = {}
    for name, (file, data) in expected.items():
        require(file.is_file(), 'Live handoff publication component missing: '+name)
        require(file.read_bytes() == data, 'Live handoff publication component differs: '+name)
        digests[name] = hashlib.sha256(data).hexdigest()
    receiver = Path(publications['games']['root'])/PAYLOAD
    verify_bytes(receiver.read_bytes(), reviewed())
    digests['receiver'] = hashlib.sha256(receiver.read_bytes()).hexdigest()
    return digests


def controls(output):
    publications={name:{'root':str(output/folder)} for name,folder in [('site','education-site'),('lessons','education-lessons'),('games','games')]}
    verify_components(publications)
    for name,relative in [('site','stub-handoff.js'),('lessons','Games/Glitch_Clash.html'),('games',PAYLOAD)]:
        target=Path(publications[name]['root'])/relative
        original=target.read_bytes()
        try:
            target.write_bytes(original+b'\nplanted changed component')
            try:
                verify_components(publications)
            except Exception as error:
                require('differs' in str(error) or 'reviewed native' in str(error), 'Wrong component control failure')
            else:
                raise AssertionError('Planted component was accepted: '+name)
        finally:
            target.write_bytes(original)
        verify_components(publications)
        print(name+': real PASS / one changed component FAIL / restored PASS')


def main():
    parser = argparse.ArgumentParser()
    for name in ('site', 'lessons', 'games', 'output'):
        parser.add_argument('--'+name, type=Path)
    parser.add_argument('--control', type=Path)
    args = parser.parse_args()
    if args.control:
        controls(args.control)
        return
    if not all(getattr(args, name) for name in ('site','lessons','games','output')):
        parser.error('--site, --lessons, --games and --output are required')
    args.output.mkdir(parents=True, exist_ok=True)
    publications = {}
    try:
        github = GitHub(time.monotonic()+300)
        for kind in ('site', 'lessons', 'games'):
            publications[kind] = prepare_one(kind, head(getattr(args, kind)), args.output, github)
        digests = verify_components(publications)
    except Exception as error:
        (args.output/'handoff-publications.json').write_text(json.dumps({'status':'BLOCKED','reason':str(error),'publications':publications,'scope':'No live sender journey was performed'},indent=2)+'\n')
        raise
    proof = {'status':'READY','route':ROUTE,'publications':publications,'digests':digests,
             'educationOrigins':['https://madebymatt.uk','https://www.madebymatt.uk'],
             'playOrigin':'https://www.madebymatt-play.uk'}
    (args.output/'handoff-publications.json').write_text(json.dumps(proof,indent=2)+'\n')
    print('Sender script, lesson stub and native receiver match their exact successful publication artifacts')

if __name__ == '__main__':
    main()
