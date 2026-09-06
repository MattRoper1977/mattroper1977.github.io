#!/usr/bin/env python3
"""Count exact-main publication proofs from GitHub evidence, never hand-entered totals.

--refresh collects API responses and rechecks main after collection. --snapshot
replays that dated measurement; it does not claim a fresh network measurement.
This is a partial HC3 readback instrument, not an estate-wide all-green gate.
"""
import argparse
import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import urllib.request
from lib.publication_artifacts import Inconclusive, select_artifact

SPECS = {
    'Site': ('mattroper1977.github.io', 'education-publication.yml', 'mbm-deployment-provenance.yml', 'education-site-review', 'The origin is serving the commit we think it is'),
    'Lessons': ('Lessons', 'education-pages.yml', 'mbm-cross-estate-unification.yml', 'education-lessons-review', 'live-proof'),
    'Apps': ('Matt-s-Apps-', 'education-pages.yml', 'mbm-cross-estate-unification.yml', 'education-apps-review', 'live-proof'),
    'Games': ('Games', 'play-domain-publication.yml', 'play-domain-publication.yml', 'standalone-games-review', 'verify-published'),
}


def api(route):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'MadeByMatt-HC3-readback'}
    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request('https://api.github.com'+route, headers=headers), timeout=35) as response:
        return json.load(response)


def refresh():
    result = {'schema': 1, 'collected_at': datetime.now(timezone.utc).isoformat(), 'repositories': {}}
    for kind, (name, publication, live, _, _) in SPECS.items():
        repo = 'MattRoper1977/' + name
        base = '/repos/' + repo
        main = api(base+'/git/ref/heads/main')['object']['sha']
        data = {'repository': repo, 'main': main}
        for role, workflow in [('publication', publication), ('live', live)]:
            runs = api(base+'/actions/workflows/'+workflow+'/runs?branch=main&per_page=30')['workflow_runs']
            exact = [run for run in runs if run['head_sha'] == main and run['head_branch'] == 'main']
            if not exact:
                data[role] = None
                continue
            run = exact[0]  # newest exact attempt, including a red; never select an older green
            prefix = base+'/actions/runs/'+str(run['id'])
            data[role] = {'run': run, 'jobs': api(prefix+'/jobs?per_page=100')['jobs'],
                          'artifacts': api(prefix+'/artifacts?per_page=100')['artifacts']}
        data['open_prs'] = [{'number': pr['number'], 'title': pr['title'], 'html_url': pr['html_url']}
                           for pr in api(base+'/pulls?state=open&per_page=100')]
        if api(base+'/git/ref/heads/main')['object']['sha'] != main:
            raise ValueError(kind + ' main moved during collection; collect again')
        result['repositories'][kind] = data
    return result


def exact_success(evidence, main):
    if not evidence:
        return False
    run = evidence['run']
    return (run.get('head_sha') == main and run.get('head_branch') == 'main'
            and run.get('status') == 'completed' and run.get('conclusion') == 'success')


def publication_proved(kind, data):
    main = data['main']
    pub, live = data.get('publication'), data.get('live')
    reasons = []
    if not exact_success(pub, main):
        reasons.append('No successful publication at this exact main SHA')
    if not exact_success(live, main):
        reasons.append('No successful live proof at this exact main SHA')
    if reasons:
        return False, reasons
    _, publication_workflow, live_workflow, artifact_name, live_job = SPECS[kind]
    for role, expected in [(pub, publication_workflow), (live, live_workflow)]:
        if not role['run'].get('path', '').split('@')[0].endswith('/'+expected):
            reasons.append('Unexpected workflow supplied as proof')
    if pub['run'].get('event') not in {'push', 'workflow_dispatch'}:
        reasons.append('Publication was not a main release event')
    if not any(re.search(r'(^| / )deploy$', job.get('name', '')) and job.get('conclusion') == 'success'
               and job.get('run_attempt') == pub['run'].get('run_attempt') for job in pub['jobs']):
        reasons.append('Successful deploy from the publication attempt missing')
    artifacts = [a for a in pub['artifacts'] if a.get('name') == artifact_name and not a.get('expired')
                 and a.get('workflow_run', {}).get('id') == pub['run']['id']
                 and a.get('workflow_run', {}).get('head_sha') == main
                 and re.fullmatch(r'sha256:[0-9a-f]{64}', a.get('digest') or '')]
    if not artifacts:
        reasons.append('Source/run-bound publication artifact with digest missing')
    else:
        try:
            select_artifact(pub['artifacts'], pub['run'], pub['jobs'], kind.lower())
        except Inconclusive as exc:
            reasons.append('Publication attempt binding: ' + str(exc))
    if not any(job.get('name') == live_job and job.get('conclusion') == 'success'
               and job.get('run_attempt') == live['run'].get('run_attempt') for job in live['jobs']):
        reasons.append('Required live job did not succeed in this attempt')
    return not reasons, reasons


def counts(snapshot, inventory=None):
    result = {'token': 'HC3_PARTIAL', 'as_of': snapshot['collected_at'], 'repositories': {},
              'publication_and_live_proved': 0,
              'scope': 'Exact-main publication and named live workflow proofs; not all-route health or every repaired defect.',
              'decks_by_pathway': None, 'all_internal_links': None, 'native_handoff_served': None,
              'unmeasured_reason': 'No complete current route-level served evidence dataset was recovered for these counts.'}
    for kind in SPECS:
        data = snapshot['repositories'][kind]
        proved, reasons = publication_proved(kind, data)
        result['repositories'][kind] = {'main': data['main'], 'publication_and_live_proved': proved,
            'publication_run': (data.get('publication') or {}).get('run', {}).get('id'),
            'live_run': (data.get('live') or {}).get('run', {}).get('id'),
            'open_prs': len(data['open_prs']), 'reasons': reasons}
        result['publication_and_live_proved'] += int(proved)
    if inventory:
        routes = inventory['routes']
        result['inventory'] = {'source_heads': inventory['sourceHeads'], 'routes': len(routes),
            'migration_candidates': sum(bool(row['migrationCandidate']) for row in routes.values()),
            'routes_with_unresolved': sum(any(obs.get('reason') for obs in row['observations'])
                                          or bool(row.get('scriptSourceIssues')) for row in routes.values()),
            'typical_user_save_sizes_measured': sum(row.get('userSaveBytes') is not None for row in routes.values())}
    return result


def self_test(snapshot):
    valid = [kind for kind, data in snapshot['repositories'].items() if publication_proved(kind, data)[0]]
    if not valid:
        raise ValueError('Control needs a real proved publication, not a synthetic green')
    kind = valid[0]
    real = snapshot['repositories'][kind]
    assert publication_proved(kind, real)[0]
    scratch = copy.deepcopy(real)
    scratch['live']['run']['head_sha'] = '0'*40
    assert not publication_proved(kind, scratch)[0], 'A stale live SHA escaped the control'
    scratch['live']['run']['head_sha'] = real['main']
    assert publication_proved(kind, scratch)[0]
    for conclusion in ['skipped', 'cancelled', 'failure', None]:
        mutated = copy.deepcopy(real)
        mutated['live']['run']['conclusion'] = conclusion
        assert not publication_proved(kind, mutated)[0]
    mutated = copy.deepcopy(real)
    for artifact in mutated['publication']['artifacts']:
        artifact.setdefault('workflow_run', {})['head_sha'] = '0'*40
    assert not publication_proved(kind, mutated)[0]
    print('CONTROL real PASS / planted stale live SHA FAIL / restored PASS; skipped, cancelled and wrong artifacts rejected')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.refresh:
        snapshot = refresh()
        args.snapshot.parent.mkdir(parents=True, exist_ok=True)
        args.snapshot.write_text(json.dumps(snapshot, indent=2)+'\n')
    else:
        snapshot = json.loads(args.snapshot.read_text())
    if args.self_test:
        self_test(snapshot)
    inventory = json.loads(args.inventory.read_text()) if args.inventory else None
    rendered = json.dumps(counts(snapshot, inventory), indent=2)+'\n'
    print(rendered, end='')
    if args.output:
        args.output.write_text(rendered)

if __name__ == '__main__':
    main()
