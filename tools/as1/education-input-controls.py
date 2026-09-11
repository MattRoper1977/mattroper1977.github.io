#!/usr/bin/env python3
"""Keep each new AS1 authoring input out of the actual education publication."""
import importlib.util
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'domain-split'))
from build_education import SITE_GENERATOR_INPUTS
from education_publication_admission import verify, load_registry, verify_tree
output=ROOT/'domain-split/output'
verify(output)
tree=output/'education-site'
registry=load_registry()
for relative in sorted(SITE_GENERATOR_INPUTS):
    assert not (tree/relative).exists(), 'Authoring input leaked: '+relative
print('GREEN all ten exact AS1 authoring inputs absent; admitted education bytes preserved')
relative='assets/arcade/cartridge.js'
target=tree/relative
target.parent.mkdir(parents=True,exist_ok=True)
try:
    target.write_bytes((ROOT/relative).read_bytes())
    try: verify_tree(tree,'education-site',registry)
    except ValueError as error:
        assert 'UNREVIEWED education-site/'+relative in str(error), str(error)
        print('RED real codec leaked into education: '+str(error).splitlines()[-1])
    else: raise AssertionError('Unreviewed game codec was admitted')
finally: target.unlink(missing_ok=True)
verify(output)
print('GREEN authoring input removed and exact education admission restored')
