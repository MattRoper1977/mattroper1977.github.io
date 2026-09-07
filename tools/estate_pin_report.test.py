#!/usr/bin/env python3
"""Controls use the actual report collector and its paginated API boundary."""
import base64
import datetime
import json
import re

from estate_check_health import classify, gate_failure
from estate_pin_report import publication_inputs, rows, stale

NOW = datetime.datetime(2026, 9, 7, tzinfo=datetime.timezone.utc)
inputs = publication_inputs()
game = next(iter(inputs['mattroper1977.github.io']['files']))
payloads = {'doc': [{'filename': 'docs/progress.md', 'status': 'modified'}],
            'new': [{'filename': 'renamed-away.txt', 'previous_filename': game, 'status': 'renamed'}],
            'deleted': [{'filename': game, 'status': 'removed'}]}


def api(path):
    if path.endswith('/contents/play-publication.json'):
        return {'content': base64.b64encode(json.dumps({'site_commit': 'old', 'lessons_commit': 'old'}).encode()).decode()}
    if path.endswith('/commits/main'):
        return {'sha': 'head'}
    if '/compare/' in path:
        shas = list(payloads) if '/mattroper1977.github.io/' in path else []
        return {'status': 'ahead' if shas else 'identical', 'ahead_by': len(shas),
                'commits': [{'sha': sha, 'commit': {'committer': {'date': '2026-09-06T12:00:00Z'}}} for sha in shas]}
    sha = re.search(r'/commits/([^?]+)', path).group(1)
    return {'files': payloads[sha]}


measured = rows(api, NOW, inputs)
assert measured[0]['game_commits_behind'] == 2
assert measured[0]['oldest_game_age'] == 0.5  # The old pin is not the change's age.
assert measured[1]['game_commits_behind'] == 0
assert [c['sha'] for c in measured[0]['game_commits']] == ['new', 'deleted']
assert stale(measured, 2) == []
del payloads['new'], payloads['deleted']
assert rows(api, NOW, inputs)[0]['game_commits_behind'] == 0

# The real report's classification remains red for a genuine workflow failure.
healthy = {'file': 'real.yml', 'conclusion': 'success', 'retired': False, 'ok_age': 0}
def verdict(row):
    red, aged, _ = classify([row], {}, 30)
    return gate_failure(red, aged, [], None)
assert not verdict(healthy)
assert verdict({**healthy, 'conclusion': 'failure'})
assert not verdict(healthy)
print('Workflow control: real PASS / planted failure FAIL / restored PASS')
assert not gate_failure([], [], [], None)
assert gate_failure([], [], [('Lessons', 'unreadable')], None)
assert gate_failure([], [], [], 'pin read failed')

# Force history and changed-file pagination. A renamed payload on page two
# must count; a truncated history must fail explicitly instead of printing zero.
def paged(path):
    if '/compare/' in path and '/mattroper1977.github.io/' in path:
        page = int(re.search(r'page=(\d+)$', path).group(1))
        indices = range(100) if page == 1 else [100]
        return {'status': 'ahead', 'ahead_by': 101, 'commits': [
            {'sha': str(i), 'commit': {'committer': {'date': '2026-08-01T00:00:00Z'}}} for i in indices]}
    if re.search(r'/commits/\d+\?', path):
        if '/commits/100?' in path and path.endswith('page=1'):
            return {'files': [{'filename': 'docs/'+str(i)} for i in range(100)]}
        if '/commits/100?' in path and path.endswith('page=2'):
            return {'files': [{'filename': 'gone.txt', 'previous_filename': game}]}
        return {'files': [{'filename': 'docs/one.md'}]}
    return api(path)
result = rows(paged, NOW, inputs)
assert result[0]['all_commits_behind'] == 101
assert result[0]['game_commits_behind'] == 1
assert stale(result, 2) == [result[0]]
assert not gate_failure([], [], [], None)  # Age is deliberately not a gate input.


def truncated(path):
    response = paged(path)
    if '/compare/' in path and '/mattroper1977.github.io/' in path and path.endswith('page=2'):
        response['commits'] = []
    return response


try:
    rows(truncated, NOW, inputs)
except ValueError as error:
    assert 'incomplete' in str(error)
else:
    raise AssertionError('Truncated history passed')
print('Docs-only, rename/delete, change age, stale report-only and pagination controls PASS')
