#!/usr/bin/env python3
"""verify_education_tree_has_no_games — publish-blocking leak gate on the BUILT tree.

Order HC3 §2.2. The education builders filter games out by a DENYLIST (a route
is a game if a manifest already says so), which leaks by default the day a game
is added without a manifest row. This gate reads every .html in the emitted
education trees and classifies by BEHAVIOUR, not by name:

  GAME = a canvas / WebGL animation loop (requestAnimationFrame + <canvas> or
         WebGL) AND play-loop vocabulary (score, lives, level, game over, high
         score) AND no curriculum delivery (no lesson-config, objective, learning
         intention, teacher / TA guidance, worksheet, exit ticket, Do Now / We Do,
         success criteria, assessment or question markers).

Rulings, cited by file, are the ONLY exemptions (§2.3): the retained
EDUCATIONAL_ACTIVITIES in education_policy.py, which the gate re-reads rather
than copies.

Control (§0.4): --self-test plants a scratch canvas game inside a copy of a
small tree, runs the same classifier, and must red; removes it, must green.

Usage
  verify_education_tree_has_no_games.py --output domain-split/output      (all three trees)
  verify_education_tree_has_no_games.py --tree PATH [--prefix /Lessons/]
  verify_education_tree_has_no_games.py --self-test
Exit 0 no game in any education tree · 1 a game is named · 2 INCONCLUSIVE
"""
from __future__ import annotations

import argparse
import ast
import re
import shutil
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
POLICY = HERE / 'education_policy.py'
TREES = {'education-site': '/', 'education-lessons': '/Lessons/', 'education-apps': '/Matt-s-Apps-/'}

LOOP = re.compile(r'requestAnimationFrame', re.I)
SURFACE = re.compile(r'<canvas\b|getContext\(\s*["\'](?:webgl2?|2d)|WebGL', re.I)
PLAY_WORDS = [re.compile(p, re.I) for p in (r'\bgame over\b', r'\bhigh ?score\b', r'\blives\b', r'\blevel \d|\blevels?\b', r'\bscore\b')]
CURRICULUM = [re.compile(p, re.I) for p in (
    r'id="lesson-config"', r'\bobjective', r'learning intention', r'\bsuccess criteria', r'\bexit ticket',
    r'\bdo now\b', r'\bwe do\b', r'\bi do\b', r'\bworksheet', r'\bTA brief\b', r'\bguidance\b', r'\bteacher',
    r'\bassess', r'\bquestion', r'\bmark scheme', r'\bpupil', r'\bstaff training', r'\bcalibrat',
    r'\bspec(?:ification)?\b', r'\bcurriculum\b', r'\blesson\b')]


def retained_routes():
    src = POLICY.read_text(encoding='utf-8')
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'EDUCATIONAL_ACTIVITIES' for t in node.targets):
            return {unquote(k) for k in ast.literal_eval(node.value)}
    raise SystemExit('INCONCLUSIVE: EDUCATIONAL_ACTIVITIES not found in education_policy.py')


def classify(text: str):
    """Return (is_game, reasons)."""
    if 'data-game-moved' in text:
        return False, ['stub']
    loop = bool(LOOP.search(text))
    surface = bool(SURFACE.search(text))
    play = sum(1 for p in PLAY_WORDS if p.search(text))
    curriculum = [p.pattern for p in CURRICULUM if p.search(text)]
    reasons = [f'loop={loop}', f'surface={surface}', f'play-words={play}', f'curriculum={len(curriculum)}']
    return (loop and surface and play >= 2 and not curriculum), reasons


def scan(tree: Path, prefix: str, exempt: set[str]):
    games, scanned, exempted = [], 0, []
    for p in sorted(tree.rglob('*.html')):
        route = prefix + p.relative_to(tree).as_posix()
        text = p.read_text(encoding='utf-8', errors='replace')
        scanned += 1
        is_game, reasons = classify(text)
        if is_game and route in exempt:
            exempted.append(route)
            continue
        if is_game:
            games.append((route, reasons))
    return scanned, games, exempted


def run(output: Path | None, tree: Path | None, prefix: str):
    exempt = retained_routes()
    targets = [(tree, prefix)] if tree else [(output / name, pre) for name, pre in TREES.items()]
    red = 0
    for t, pre in targets:
        if not t.is_dir():
            print(f'INCONCLUSIVE: {t} is not a built tree'); return 2
        scanned, games, exempted = scan(t, pre, exempt)
        if scanned == 0:
            print(f'INCONCLUSIVE: {t} holds no html'); return 2
        print(f'{t.name}: {scanned} html scanned, {len(games)} game(s), {len(exempted)} exempted by ruling')
        for r in exempted:
            print(f'  exempt (EDUCATIONAL_ACTIVITIES): {r}')
        for route, reasons in games:
            red += 1
            print(f'  GAME on the education tree: {route}  [{", ".join(reasons)}]')
    print('LEAK GATE:', 'RED' if red else 'CLEAR')
    return 1 if red else 0


PLANTED = """<!doctype html><html><head><title>Scratch Runner</title></head><body>
<canvas id="c" width="320" height="240"></canvas><div>Score: <span id="s">0</span> Lives: 3</div>
<script>const c=document.getElementById('c').getContext('2d');let score=0,lives=3;function loop(){c.clearRect(0,0,320,240);score++;
if(lives<1){document.body.textContent='Game over. High score '+score;return;}requestAnimationFrame(loop);}requestAnimationFrame(loop);</script>
</body></html>"""


def self_test():
    exempt = retained_routes()
    ok = True

    def control(name, passed, detail=''):
        nonlocal ok
        ok = ok and passed
        print(f"  [{'ok' if passed else 'FAIL'}] {name}{'  — ' + detail if detail else ''}")

    with tempfile.TemporaryDirectory() as d:
        tree = Path(d) / 'education-scratch'
        tree.mkdir()
        (tree / 'lesson.html').write_text('<html><body><h1>Learning objective</h1><canvas></canvas><script>requestAnimationFrame(()=>{});let score=0;</script></body></html>')
        (tree / 'moved.html').write_text('<html><body data-game-moved><canvas></canvas><script>requestAnimationFrame(()=>{});score lives level</script></body></html>')
        s, g, e = scan(tree, '/', exempt)
        control('run 1: a lesson with a canvas and a stub are not games', s == 2 and not g)
        (tree / 'planted.html').write_text(PLANTED)
        s, g, e = scan(tree, '/', exempt)
        control('run 2: a planted canvas game reds', [r for r, _ in g] == ['/planted.html'], str(g))
        (tree / 'planted.html').unlink()
        s, g, e = scan(tree, '/', exempt)
        control('run 3: defect removed, green again', not g)
        # the ruling exempts by route, nothing else
        exempt_route = sorted(exempt)[0]
        planted_exempt = tree / exempt_route.lstrip('/')
        planted_exempt.parent.mkdir(parents=True, exist_ok=True)
        planted_exempt.write_text(PLANTED)
        s, g, e = scan(tree, '/', exempt)
        control('a planted game at a retained route is exempted BY NAME and reported', not g and e == [exempt_route], f'{e}')
    print('self-test', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', type=Path, default=HERE / 'output')
    ap.add_argument('--tree', type=Path)
    ap.add_argument('--prefix', default='/')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    return run(None if a.tree else a.output.resolve(), a.tree, a.prefix)


if __name__ == '__main__':
    sys.exit(main())
