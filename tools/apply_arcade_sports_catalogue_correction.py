#!/usr/bin/env python3
"""Restore the Arcade's established placement convention around Sports.

Sports remains an additional collection rail. Apex Kick stays in TOP and every
manifest entry, including all Sports members, remains in the browse-all shelf.
Exact anchors are intentionally tied to the merged four-game Sports state.
"""
from __future__ import annotations
import hashlib
import sys
from pathlib import Path

PATH = Path('games/index.html')
SENTINEL = 'apexpool-arcade-catalogue-correction-2026-08-04'

REPLACEMENTS = [
    ("<p class=\"sub\">The seven I'd put in front of anyone first — and one line each on why.</p>",
     "<p class=\"sub\">The eight I'd put in front of anyone first — and one line each on why.</p>", 'TOP explanatory copy'),
    ('<h2>The rest of the shelf</h2>\n<p class="sub" id="shelfSub">Every other game, A to Z — search and filters above work on this grid.</p>',
     '<h2>The whole shelf</h2>\n<p class="sub" id="shelfSub">Every game, A to Z — search and filters above work on this grid.</p>', 'whole-shelf heading'),
    ('var TOP=["Voxel Frontier","Off-Brand","Glitch Clash","Hold the Mark","Orbital","Slipstream - GP","Grid Chase"];',
     'var TOP=["Apex Kick","Voxel Frontier","Off-Brand","Glitch Clash","Hold the Mark","Orbital","Slipstream - GP","Grid Chase"];', 'TOP membership'),
    ('function drawGrid(){\n var all=state.games.slice(),sportsCount=all.filter(function(g){return g.collection==="Sports"}).length;\n var gs=all.filter(function(g){return g.collection!=="Sports"});',
     'function drawGrid(){\n var gs=state.games.slice();', 'browse-all input'),
    (' var n=state.games.length-sportsCount,total=state.games.length;\n $("countline").textContent=gs.length===n?\n  (CURATED.length+" curated favourites across "+total+" games — "+n+" more on the shelf below."):\n  ("Showing "+gs.length+" of "+n+" shelf games ("+total+" total).");',
     ' var n=state.games.length;\n $("countline").textContent=gs.length===n?\n  (CURATED.length+" curated favourites of "+n+" games — every one free, single-file and offline-friendly."):\n  ("Showing "+gs.length+" of "+n+" games.");', 'derived count copy'),
    ('/* Sports is driven by the manifest collection field; it is hidden until the two entries exist. */',
     '/* Sports is driven by the manifest collection field and is additional to TOP and browse-all. */', 'Sports renderer comment'),
]


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def desired(text: str) -> bool:
    return (
        'var TOP=["Apex Kick","Voxel Frontier"' in text
        and 'function drawGrid(){\n var gs=state.games.slice();' in text
        and 'The whole shelf' in text
        and "The eight I'd put in front of anyone first" in text
        and 'g.collection==="Sports"' in text
        and 'g.collection!=="Sports"' not in text
        and 'Four Apex games, side by side' in text
        and SENTINEL in text
    )


def main() -> int:
    if not PATH.is_file():
        print('ERROR: games/index.html not found', file=sys.stderr); return 2
    before = PATH.read_text(encoding='utf-8')
    if desired(before):
        print('NO-OP:', digest(before)); return 0
    after = before
    for old, new, label in REPLACEMENTS:
        n = after.count(old)
        if n != 1:
            print(f'ERROR: {label}: expected one anchor, got {n}', file=sys.stderr); return 3
        after = after.replace(old, new, 1)
    marker = '<!-- '+SENTINEL+' -->\n'
    if marker not in after:
        after = after.replace('</body></html>', marker+'</body></html>', 1)
    if not desired(after):
        print('ERROR: postcondition failed', file=sys.stderr); return 4
    PATH.write_text(after, encoding='utf-8')
    print('APPLIED:', digest(before), '->', digest(after))
    print('PLACEMENT: Sports additional; Apex Kick in TOP; all manifest games in whole shelf')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
