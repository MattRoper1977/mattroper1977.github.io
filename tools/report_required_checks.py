#!/usr/bin/env python3
"""Read effective required checks and workflow coverage; never change settings.

Rulesets: https://docs.github.com/en/rest/repos/rules#get-rules-for-a-branch
A red check observed on a merged PR is history to investigate, not proof that
all checks were optional. The check may be optional, retried, or bypassed, and
today's configuration is not evidence of the configuration at merge time.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

import yaml

REPOS = ['mattroper1977.github.io', 'Lessons', 'Games', 'Matt-s-Apps-', 'Games-']


def api(path):
    req = urllib.request.Request('https://api.github.com' + path,
                                 headers={'Accept': 'application/vnd.github+json'})
    tok = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if tok:
        req.add_header('Authorization', 'Bearer ' + tok)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def pages(path, request=api, key=None):
    """Do not silently truncate rules, workflow jobs, or historical check runs."""
    rows = []
    for page in range(1, 1001):
        result = request(path + ('&' if '?' in path else '?') + f'per_page=100&page={page}')
        batch = result[key] if key else result
        if not isinstance(batch, list):
            raise ValueError('Expected a paginated list: ' + path)
        rows.extend(batch)
        if len(batch) < 100:
            if key and isinstance(result, dict) and result.get('total_count', 0) > len(rows):
                raise ValueError('Incomplete pagination: ' + path)
            return rows
    raise ValueError('Pagination ceiling reached: ' + path)


def required_checks(repo, branch, branch_data, request=api):
    """The effective endpoint excludes disabled/evaluate and non-matching rules."""
    rules = pages(f'/repos/MattRoper1977/{repo}/rules/branches/' +
                  urllib.parse.quote(branch, safe=''), request)
    classic = (branch_data.get('protection') or {}).get('required_status_checks') or {}
    contexts = set(classic.get('contexts') or [])
    contexts.update(row['context'] for row in classic.get('checks', []) if row.get('context'))
    sources = [{'kind': 'classic', 'context': name} for name in sorted(contexts)]
    for rule in rules:
        if rule.get('type') != 'required_status_checks':
            continue
        for row in rule.get('parameters', {}).get('required_status_checks', []):
            name = row.get('context')
            if not name:
                raise ValueError('Required status rule has no context')
            contexts.add(name)
            sources.append({'kind': 'ruleset', 'context': name,
                            'ruleset_id': rule.get('ruleset_id'),
                            'integration_id': row.get('integration_id')})
    return sorted(contexts), sources, rules


def workflow_jobs(text):
    """Static names only. Expressions/matrices are explicitly unresolved."""
    data = yaml.load(text, Loader=yaml.BaseLoader)
    if not isinstance(data, dict):
        raise ValueError('Invalid workflow mapping')
    events = data.get('on') or {}
    if isinstance(events, str):
        events = {events: {}}
    elif isinstance(events, list):
        events = {event: {} for event in events}
    pr = any(event in events for event in ('pull_request', 'pull_request_target'))
    filters = []
    for event in ('pull_request', 'pull_request_target'):
        conf = events.get(event) or {}
        if isinstance(conf, dict):
            filters.extend(event + '.' + field for field in
                           ('paths', 'paths-ignore', 'branches', 'branches-ignore') if field in conf)
    result = []
    for job_id, job in (data.get('jobs') or {}).items():
        label = job.get('name', job_id)
        dynamic = '${{' in label or bool((job.get('strategy') or {}).get('matrix')) or 'uses' in job
        result.append({'job': job_id, 'context': None if dynamic else label,
                       'declared_name': label, 'pr_trigger': pr, 'filters': filters,
                       'condition': job.get('if'), 'dynamic_or_reusable': dynamic})
    return result


def history_observations(checks, merged_at):
    """Only completed pre-merge failures can be described as pre-merge."""
    bad, later = [], []
    for row in checks:
        if row.get('conclusion') not in ('failure', 'timed_out', 'action_required'):
            continue
        when = row.get('completed_at')
        target = bad if when and when <= merged_at else later
        target.append(row['name'])
    return sorted(set(bad)), sorted(set(later))


def main():
    sample = int(sys.argv[sys.argv.index('--sample') + 1]) if '--sample' in sys.argv else 30
    if not 1 <= sample <= 100:
        raise ValueError('--sample must be between 1 and 100')
    unreadable, output = [], []
    print('REQUIRED CHECKS: effective rules plus classic protection; report only')
    print('Static workflow coverage is not a recommendation to change protection.')
    for repo in REPOS:
        prefix = f'/repos/MattRoper1977/{repo}'
        row = {'repository': repo, 'errors': []}
        output.append(row)
        try:
            info = api(prefix)
            branch = info['default_branch']
            b = api(prefix + '/branches/' + urllib.parse.quote(branch, safe=''))
            contexts, sources, rules = required_checks(repo, branch, b)
            row.update(branch=branch, source_sha=b['commit']['sha'], contexts=contexts,
                       protection_sources=sources, effective_rules=rules)
        except Exception as error:
            message = f'{repo}: required checks UNREADABLE: {error}'
            unreadable.append(message); row['errors'].append(message)
            print(message)
            continue
        try:
            wfs = pages(prefix + '/actions/workflows', key='workflows')
            try:
                listing = api(prefix + '/contents/.github/workflows?ref=' + urllib.parse.quote(branch, safe=''))
                live = {entry['name'] for entry in listing if entry['type'] == 'file'}
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
                live = set()
            jobs = []
            for workflow in wfs:
                if os.path.basename(workflow['path']) not in live:
                    continue
                body = api(prefix + '/contents/' + workflow['path'] + '?ref=' + row['source_sha'])
                text = base64.b64decode(body['content']).decode('utf-8')
                jobs.extend({'workflow': workflow['path'], **job} for job in workflow_jobs(text))
            row['jobs'] = jobs
            mapped = {job['context'] for job in jobs if job['context']}
            row['unmapped_required_contexts'] = sorted(set(contexts) - mapped)
            row['pr_contexts_not_required'] = sorted({job['context'] for job in jobs
                if job['pr_trigger'] and job['context']} - set(contexts))
            # A missing static mapping may be a matrix, reusable job or external app.
            # It must not be reported as a deleted check or an unprotected workflow.
            row['conditional_coverage'] = [job for job in jobs if job['filters'] or
                job['condition'] or job['dynamic_or_reusable'] or not job['pr_trigger']]
        except Exception as error:
            message = f'{repo}: workflow coverage UNREADABLE: {error}'
            unreadable.append(message); row['errors'].append(message)
        try:
            prs = api(prefix + f'/pulls?state=closed&per_page={sample}&sort=updated&direction=desc')
            history = []
            for pr in [item for item in prs if item.get('merged_at')]:
                checks = pages(prefix + f"/commits/{pr['head']['sha']}/check-runs", key='check_runs')
                before, later = history_observations(checks, pr['merged_at'])
                history.append({'pr': pr['number'], 'merged_at': pr['merged_at'],
                                'head_sha': pr['head']['sha'], 'pre_merge_failures': before,
                                'later_or_undated_failures': later})
            row['history'] = history
        except Exception as error:
            message = f'{repo}: merge history UNREADABLE: {error}'
            unreadable.append(message); row['errors'].append(message)
        print(f"{repo} {branch}@{row['source_sha']}: {len(contexts)} effective required contexts")
        for source in sources:
            print('  required:', source['context'], source['kind'], source.get('ruleset_id', ''))
        print('  Static PR job contexts not in current requirements:', row.get('pr_contexts_not_required', 'UNREADABLE'))
        print('  Required contexts without a static job mapping:', row.get('unmapped_required_contexts', 'UNREADABLE'))
        for job in row.get('conditional_coverage', []):
            print('  Coverage:', job['workflow'], job['declared_name'],
                  json.dumps({key: job[key] for key in ('pr_trigger', 'filters', 'condition', 'dynamic_or_reusable')}))
        for item in row.get('history', []):
            if item['pre_merge_failures'] or item['later_or_undated_failures']:
                print('  Historical observation:', json.dumps(item))
        print('  Historical failures do not establish the required/bypass/retry state at merge.')
    if '--json' in sys.argv:
        from pathlib import Path
        target = Path(sys.argv[sys.argv.index('--json') + 1])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps({'repositories': output, 'unreadable': unreadable}, indent=2) + '\n')
    if unreadable:
        print('MEASUREMENT INCOMPLETE:', *unreadable, sep='\n')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
