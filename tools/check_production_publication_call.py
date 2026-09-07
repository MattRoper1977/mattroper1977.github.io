#!/usr/bin/env python3
"""Check the actual aggregate workflow call, then exercise its missing-env defect."""
import copy
import pathlib
import sys

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/post-merge-production-verify.yml'
STEP = 'Re-run the production-driven gates against the published site'


def check(workflow):
    calls = [s for s in workflow['jobs']['verify']['steps'] if s.get('name') == STEP]
    assert len(calls) == 1, 'The production aggregate call is missing or duplicated'
    call = calls[0]
    assert call.get('env', {}).get('RF_PUBLICATION') == 'games', 'The aggregate selects the obsolete single-domain shelf'
    for name in ['verify_echovault_surfaces.js', 'verify_relicforge_surfaces.js',
                 'verify_curation_keys.mjs', 'verify_surfaces.js', 'verify_url_filter_state.mjs']:
        assert 'tools/' + name in call['run'], 'An existing production gate was dropped: ' + name
    assert not call.get('continue-on-error'), 'Production failures must reach aggregation'
    return call


def main():
    real = yaml.safe_load(WORKFLOW.read_text())
    check(real)
    if '--self-test' in sys.argv:
        planted = copy.deepcopy(real)
        call = next(s for s in planted['jobs']['verify']['steps'] if s.get('name') == STEP)
        del call['env']['RF_PUBLICATION']
        try:
            check(planted)
        except AssertionError as error:
            print('Planted missing environment: FAIL as required —', error)
        else:
            raise AssertionError('MEASUREMENT INVALID: the missing caller environment passed')
        check(real)
        print('Caller control: real PASS / planted missing environment FAIL / restored PASS')
    print('Published Play adapter selected; all five aggregate gates retained')


if __name__ == '__main__':
    main()
