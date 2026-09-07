#!/usr/bin/env python3
"""Firing controls for the actual protection collector, names and history."""
import copy
import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile

import report_required_checks as report

base = {'protection': {'required_status_checks': {'contexts': ['Classic']}}}
rules = [{'type': 'required_status_checks', 'ruleset_id': 21475918,
          'parameters': {'required_status_checks': [{'context': 'Static gates', 'integration_id': 1}]}}]
requests = []
def api(path):
    requests.append(path)
    assert '/rules/branches/main?' in path
    return copy.deepcopy(rules)

def real(mod=report):
    contexts, sources, effective = mod.required_checks('Site', 'main', base, api)
    assert contexts == ['Classic', 'Static gates'], contexts
    assert sources[-1]['ruleset_id'] == 21475918
    assert effective == rules

real()
# Run the actual collector from a scratch source with its ruleset loop removed.
source = Path(report.__file__).read_text()
assert source.count('for rule in rules:') == 1
with tempfile.TemporaryDirectory() as directory:
    planted = Path(directory) / 'planted.py'
    planted.write_text(source.replace('for rule in rules:', 'for rule in []:'))
    spec = importlib.util.spec_from_file_location('planted_report', planted)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    try:
        real(module)
    except AssertionError:
        pass
    else:
        raise AssertionError('A collector ignoring rulesets was accepted')
real()
print('Required contexts: real PASS / planted ignored rules FAIL / restored PASS')

# Read failures never become zero protection; effective endpoint owns scope logic.
def denied(path):
    raise OSError('403 denied')
try:
    report.required_checks('Site', 'main', base, denied)
except OSError:
    pass
else:
    raise AssertionError('Unreadable rules became a green zero')

rows = report.workflow_jobs('''on: [push, pull_request]
jobs:
  static:
    name: Static gates
    runs-on: ubuntu-latest
  publish:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
  matrix:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
''')
assert rows[0]['context'] == 'Static gates' and rows[0]['pr_trigger']
assert rows[1]['context'] == 'publish' and rows[1]['condition']
assert rows[2]['context'] is None and rows[2]['dynamic_or_reusable']
assert report.workflow_jobs('on:\n  pull_request:\n    paths: [src/**]\njobs:\n  test:\n    runs-on: ubuntu-latest\n')[0]['filters'] == ['pull_request.paths']
assert report.history_observations([
    {'name': 'Optional', 'conclusion': 'failure', 'completed_at': '2026-09-01T00:00:00Z'},
    {'name': 'Later rerun', 'conclusion': 'failure', 'completed_at': '2026-09-03T00:00:00Z'}
], '2026-09-02T00:00:00Z') == (['Optional'], ['Later rerun'])

calls = []
def paged(path):
    calls.append(path)
    return [{'type': 'creation'}] * 100 if path.endswith('page=1') else rules
contexts, _, _ = report.required_checks('Site', 'feature/slash', {}, paged)
assert contexts == ['Static gates'] and len(calls) == 2
assert '/feature%2Fslash?' in calls[0]
print('Unreadable, active-rule pagination, encoded branch, job-name/matrix and history controls PASS')
