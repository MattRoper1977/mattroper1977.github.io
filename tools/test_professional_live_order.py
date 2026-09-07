#!/usr/bin/env python3
"""Check the actual production workflow's event, checkout and proof binding.

These are configuration firing controls, not a claim to emulate GitHub's scheduler.
The post-merge workflow_run must still produce exact-source live evidence.
"""
import copy
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}"
READY = "github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')"

def verify(workflow):
    events = workflow['on']
    assert set(events) == {'workflow_run', 'workflow_dispatch'}, 'early or unapproved event'
    assert events['workflow_run'] == {'workflows': ['Education publication'], 'types': ['completed'], 'branches': ['main']}, 'wrong publication trigger'
    job = workflow['jobs']['verify-live']
    assert job['if'] == READY, 'unsuccessful or non-main publication admitted'
    assert job['env']['EXPECTED_SOURCE_SHA'] == SOURCE, 'source is not the completed publication head'
    checkouts = [s for s in job['steps'] if s.get('uses', '').startswith('actions/checkout@')]
    assert len(checkouts) == 1 and checkouts[0]['with']['ref'] == '${{ env.EXPECTED_SOURCE_SHA }}', 'checkout source mismatch'
    commands = '\n'.join(s.get('run', '') for s in job['steps'])
    assert '--expected-sha "$EXPECTED_SOURCE_SHA"' in commands, 'provenance source mismatch'
    assert '--expected-sha "${{ github.sha }}"' not in commands, 'event SHA substituted for publication SHA'
    return True

def main():
    path = ROOT / '.github/workflows/professional-site-live-verify.yml'
    real = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
    verify(real)
    print('REAL: publication-completed event, success condition and source binding pass')
    defects = [
        ('early push', lambda w: w['on'].update({'push': {'branches': ['main']}})),
        ('failed publication', lambda w: w['jobs']['verify-live'].update({'if': 'always()'})),
        ('wrong checkout SHA', lambda w: w['jobs']['verify-live']['steps'][0]['with'].update({'ref': '${{ github.sha }}'})),
        ('wrong expected SHA', lambda w: w['jobs']['verify-live']['env'].update({'EXPECTED_SOURCE_SHA': '${{ github.sha }}'})),
    ]
    for name, plant in defects:
        scratch = copy.deepcopy(real)
        plant(scratch)
        try:
            verify(scratch)
        except AssertionError as exc:
            print(f'PLANTED {name}: rejected ({exc})')
        else:
            raise AssertionError(f'planted {name} accepted')
        verify(real)
        print(f'RESTORED {name}: pass')
    assert path.read_text() == (ROOT / '.github/workflows/professional-site-live-verify.yml').read_text()

if __name__ == '__main__':
    main()
