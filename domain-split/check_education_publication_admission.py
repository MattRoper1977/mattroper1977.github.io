#!/usr/bin/env python3
"""Real publication controls; mutations occur only in temporary copies."""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from education_publication_admission import HERE, REGISTRY, TREES, load_registry, verify, verify_tree

GAME = b'<html><canvas></canvas><script>let score=0,lives=3;function loop(){score++;requestAnimationFrame(loop)}loop()</script></html>'


def controls(output):
    real = verify(output)
    registry = load_registry()
    cases = []
    with tempfile.TemporaryDirectory(prefix='education-admission-controls-') as temp:
        scratch = Path(temp)
        for name in TREES:
            shutil.copytree(output/name, scratch/name)
        def mutation(name, tree_name, relative, replacement=None, missing=False, symlink=False):
            target = scratch/tree_name/relative
            existed = target.exists()
            old = target.read_bytes() if existed else None
            verify_tree(scratch/tree_name, tree_name, registry)
            target.parent.mkdir(parents=True, exist_ok=True)
            if missing:
                target.unlink()
            elif symlink:
                target.symlink_to(REGISTRY)
            else:
                target.write_bytes(replacement)
            try:
                try:
                    verify_tree(scratch/tree_name, tree_name, registry)
                except ValueError as error:
                    cases.append({'name': name, 'real': 'PASS', 'planted': 'FAIL', 'reason': str(error)})
                else:
                    raise AssertionError('MEASUREMENT INVALID: planted defect passed: '+name)
            finally:
                if existed:
                    target.write_bytes(old)
                else:
                    target.unlink()
            verify_tree(scratch/tree_name, tree_name, registry)
            cases[-1]['restored'] = 'PASS'
        for name in TREES:
            mutation('unlisted inline game', name, 'hc3-planted.html', GAME)
            mutation('teacher marker cannot approve code', name, 'hc3-planted.html', GAME+b'<!-- teacher -->')
            mutation('stub marker cannot approve code', name, 'hc3-planted.html', GAME+b'<!-- data-game-moved -->')
            mutation('external engine cannot enter by extension', name, 'hc3-engine.js', b'requestAnimationFrame(function loop(){score++;requestAnimationFrame(loop)});')
            mutation('HTM route cannot enter by extension', name, 'hc3-planted.htm', GAME)
            mutation('scripted SVG cannot enter by extension', name, 'hc3-planted.svg', b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
            mutation('no symlink publication', name, 'hc3-link.html', symlink=True)
            row = next(p for p in registry['trees'][name] if p.endswith('.js'))
            mutation('changed admitted dependency', name, row, (scratch/name/row).read_bytes()+b'\n/* planted changed engine */')
            mutation('missing admitted page', name, 'index.html', missing=True)
        for route in ['5 Intervention 10/Lesson_VIR_Pupil_App.html', 'Research/Research_Gate_Toolkit/R_Gate_Calibration_Game.html']:
            matches = [p for p in registry['trees']['education-lessons'] if p.endswith(Path(route).name)]
            assert len(matches) == 1, 'Retained activity identity is ambiguous: '+route
            mutation('retained activity name cannot approve replacement code', 'education-lessons', matches[0], GAME)
        master = next(p for p in registry['trees']['education-apps'] if p.endswith('mbm-master-hub.html'))
        original = (scratch/'education-apps'/master).read_bytes()
        assert b'application/octet-stream' in original
        mutation('embedded non-JavaScript payload identity', 'education-apps', master, original.replace(b'application/octet-stream', b'application/octet-stream;planted', 1))
        for name in TREES:
            for extension in ['png', 'pdf', 'pptx', 'zip', 'mp3', 'woff2']:
                mutation('disguised code cannot enter as '+extension, name,
                         'hc3-disguised.'+extension, b'requestAnimationFrame(function loop(){score++;requestAnimationFrame(loop)});')
        native = next(p for p in registry['trees']['education-lessons'] if p.endswith('.pptx'))
        mutation('changed admitted native pack bytes', 'education-lessons', native,
                 (scratch/'education-lessons'/native).read_bytes()+b'planted bytes')
        verify(scratch)
    # Registry input is itself fail-closed, including duplicate JSON keys and
    # path escape. It cannot silently override an earlier review row.
    for text in ['{"schemaVersion":1,"schemaVersion":1}',
                 json.dumps({**registry, 'trees': {**registry['trees'], 'education-site': {'../escape.html': 'a'*64}}})]:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/'registry.json';path.write_text(text)
            try:
                load_registry(path)
            except ValueError:
                pass
            else:
                raise AssertionError('Malformed registry passed')
    return {'status': 'PASS', 'scope': 'Exact all-file admission, not a new semantic classification of every historical lesson', 'real': real, 'cases': cases}


def arriving_controls():
    """HC5 §1: the ARRIVING marker admits absence, never other bytes (each proved both ways)."""
    import education_publication_admission as adm
    good = 'a'*64; other = 'b'*64
    reg = {'trees': {'education-lessons': {'arrived.html': [good, adm.ARRIVING], 'plain.html': good}}}
    def outcome(actual):
        try:
            adm.verify_tree_census(actual, 'education-lessons', reg); return 'PASS'
        except ValueError as error:
            return 'FAIL '+str(error).splitlines()[-1]
    cases = [
        {'name': 'arriving path absent from the build passes', 'expected': 'PASS', 'actual': outcome({'plain.html': good})},
        {'name': 'arriving path present at its reviewed bytes passes', 'expected': 'PASS', 'actual': outcome({'plain.html': good, 'arrived.html': good})},
        {'name': 'arriving path present at other bytes is CHANGED', 'expected': 'FAIL CHANGED education-lessons/arrived.html', 'actual': outcome({'plain.html': good, 'arrived.html': other})},
        {'name': 'a plain path absent is still MISSING', 'expected': 'FAIL MISSING education-lessons/plain.html', 'actual': outcome({'arrived.html': good})},
    ]
    try:
        adm.validate_digest_set('education-lessons', 'x.html', [good, other, adm.ARRIVING]); cases.append({'name': 'ARRIVING beside two digests is refused', 'expected': 'refused', 'actual': 'accepted'})
    except ValueError:
        cases.append({'name': 'ARRIVING beside two digests is refused', 'expected': 'refused', 'actual': 'refused'})
    try:
        adm.validate_digest_set('education-lessons', 'x.html', [adm.ARRIVING]); cases.append({'name': 'ARRIVING alone is refused', 'expected': 'refused', 'actual': 'accepted'})
    except ValueError:
        cases.append({'name': 'ARRIVING alone is refused', 'expected': 'refused', 'actual': 'refused'})
    for case in cases:
        if case['expected'] != case['actual']:
            raise AssertionError('MEASUREMENT INVALID: arriving control: '+case['name']+' -> '+case['actual'])
    return cases


def build_control(lessons, apps):
    # A separate local repository makes the new source file genuinely tracked.
    # No production or PR-owned source file is planted or edited.
    with tempfile.TemporaryDirectory(prefix='education-admission-build-') as temp:
        source = Path(temp)/'site';out = Path(temp)/'publication'
        subprocess.run(['git', 'clone', '--quiet', '--shared', str(HERE.parent), str(source)], check=True)
        # Local controls may run before these candidate files are committed.
        for relative in ['build_education.py', 'education_publication_admission.py', 'education-publication-admission.json', 'stub_handoff.py', 'stub-handoff.js']:
            shutil.copyfile(HERE/relative, source/'domain-split'/relative)
        subprocess.run([sys.executable, str(source/'domain-split/build_publications.py'), '--lessons', str(lessons), '--output', str(out)], check=True, stdout=subprocess.DEVNULL)
        command = [sys.executable, str(source/'domain-split/build_education.py'), '--lessons', str(lessons), '--apps', str(apps), '--output', str(out)]
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
        planted = source/'hc3-unreviewed-game.html';planted.write_bytes(GAME+b'<!-- teacher data-game-moved -->')
        subprocess.run(['git', '-C', str(source), 'add', planted.name], check=True)
        red = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        assert red.returncode != 0 and 'UNREVIEWED education-site/hc3-unreviewed-game.html' in red.stdout, red.stdout
        subprocess.run(['git', '-C', str(source), 'rm', '--quiet', '--force', planted.name], check=True)
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
        return {'real': 'PASS', 'plantedTrackedGame': 'FAIL', 'restored': 'PASS', 'entry': 'build_education.py', 'publishBlockingExit': red.returncode}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=HERE/'output')
    parser.add_argument('--lessons', type=Path)
    parser.add_argument('--apps', type=Path)
    parser.add_argument('--build-control', action='store_true')
    args = parser.parse_args()
    result = controls(args.output.resolve())
    result['arrivingControls'] = arriving_controls()
    result['cases'] = result['cases'] + result['arrivingControls']
    if args.build_control:
        if not args.lessons or not args.apps:
            parser.error('Build control requires both source repositories')
        result['buildControl'] = build_control(args.lessons.resolve(), args.apps.resolve())
    evidence = args.output/'education-admission-controls.json'
    evidence.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'status': result['status'], 'controls': len(result['cases']), 'buildControl': result.get('buildControl'), 'evidence': str(evidence)}, indent=2))


if __name__ == '__main__':
    main()
