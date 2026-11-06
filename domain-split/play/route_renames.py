"""Project historical game identities onto the six approved serving routes."""
import copy, json
from pathlib import Path
RENAMES=json.loads((Path(__file__).with_name('route-renames.json')).read_text())['renames']
def project(rows):
    result=copy.deepcopy(rows)
    for row in result:
        for move in RENAMES:
            if row['source']['repository']==move['repository'] and row['source']['path']==move['old']:
                assert row['normalizedDecodedRoute']==move['old_route']
                row['source']['path']=move['new'];row['normalizedDecodedRoute']=move['route']
    assert len(result)==len(rows)==len({r['normalizedDecodedRoute'] for r in result})
    return result
def preserved(rows):
    result=copy.deepcopy(rows)
    paths={m['old_route'].lstrip('/')+('index.html' if m['old_route'].endswith('/') else ''):m['route'].lstrip('/')+('index.html' if m['route'].endswith('/') else '') for m in RENAMES}
    for row in result:row['path']=paths.get(row['path'],row['path'])
    assert len(result)==len(rows)==len({r['path'] for r in result})
    return result
def destination(route):
    for move in RENAMES:
        if route in (move['old_route'],move['old_route'].removesuffix('/')):return move['route']
    return route
