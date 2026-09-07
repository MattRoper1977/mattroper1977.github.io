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
from lib.hc3_byte_witness import decode_evidence, matching_rows

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


def publication_deployed(kind, data):
    pub = data.get('publication')
    if not exact_success(pub, data['main']):
        return False
    if not pub['run'].get('path', '').split('@')[0].endswith('/'+SPECS[kind][1]):
        return False
    if pub['run'].get('event') not in {'push', 'workflow_dispatch'}:
        return False
    try:
        select_artifact(pub['artifacts'], pub['run'], pub['jobs'], kind.lower())
    except Inconclusive:
        return False
    return True


def publication_proved(kind, data, witness=None):
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
    if not reasons:
        try:
            selected, _ = select_artifact(pub['artifacts'], pub['run'], pub['jobs'], kind.lower())
            matching_rows(kind, data, witness, selected)
        except (ValueError, Inconclusive) as exc:
            reasons.append(str(exc))
    return not reasons, reasons


def counts(snapshot, inventory=None, witness=None):
    result = {'token': 'HC3_PARTIAL', 'as_of': snapshot['collected_at'], 'repositories': {},
              'publication_and_live_proved': 0,
              'scope': 'Exact-main publication plus original FieldOps byte witnesses; successful live job labels alone are insufficient. Not all-route health or every repaired defect.',
              'decks_by_pathway': None, 'all_internal_links': None, 'native_handoff_served': None,
              'unmeasured_reason': 'No complete current route-level served evidence dataset was recovered for these counts.'}
    for kind in SPECS:
        data = snapshot['repositories'][kind]
        proved, reasons = publication_proved(kind, data, witness)
        result['repositories'][kind] = {'main': data['main'], 'publication_deployed': publication_deployed(kind, data), 'publication_and_live_proved': proved,
            'publication_run': (data.get('publication') or {}).get('run', {}).get('id'),
            'live_run': (data.get('live') or {}).get('run', {}).get('id'),
            'open_prs': len(data['open_prs']), 'reasons': reasons,
            'witnessed_subjects': sum(r['group'] == kind.lower() for r in witness['report']['rows']) if proved else 0,
            'witness_scope': 'Original FieldOps subjects only',
            'byte_proof_artifact': witness['artifact_id'] if proved else None}
        result['publication_and_live_proved'] += int(proved)
    if inventory:
        routes = inventory['routes']
        result['inventory'] = {'source_heads': inventory['sourceHeads'], 'routes': len(routes),
            'migration_candidates': sum(bool(row['migrationCandidate']) for row in routes.values()),
            'routes_with_unresolved': sum(any(obs.get('reason') for obs in row['observations'])
                                          or bool(row.get('scriptSourceIssues')) for row in routes.values()),
            'typical_user_save_sizes_measured': sum(row.get('userSaveBytes') is not None for row in routes.values())}
    return result


def self_test(snapshot, witness=None, envelope=None):
    valid = [kind for kind, data in snapshot['repositories'].items() if publication_proved(kind, data, witness)[0]]
    if not valid:
        raise ValueError('Control needs a real proved publication, not a synthetic green')
    kind = valid[0]
    real = snapshot['repositories'][kind]
    assert publication_proved(kind, real, witness)[0]
    scratch = copy.deepcopy(real)
    scratch['live']['run']['head_sha'] = '0'*40
    assert not publication_proved(kind, scratch, witness)[0], 'A stale live SHA escaped the control'
    scratch['live']['run']['head_sha'] = real['main']
    assert publication_proved(kind, scratch, witness)[0]
    for conclusion in ['skipped', 'cancelled', 'failure', None]:
        mutated = copy.deepcopy(real)
        mutated['live']['run']['conclusion'] = conclusion
        assert not publication_proved(kind, mutated, witness)[0]
    mutated = copy.deepcopy(real)
    for artifact in mutated['publication']['artifacts']:
        artifact.setdefault('workflow_run', {})['head_sha'] = '0'*40
    assert not publication_proved(kind, mutated, witness)[0]
    assert not publication_proved(kind, real)[0], 'Green job labels passed without byte evidence'
    assert publication_proved(kind, real, witness)[0]
    for name, plant in [
        ('wrong publication', lambda w: w['report']['publications'][kind.lower()].update({'run_id': 0})),
        ('wrong source', lambda w: w['report']['publications'][kind.lower()].update({'source_sha': '0'*40})),
        ('duplicate subject', lambda w: w['report']['rows'].append(copy.deepcopy(w['report']['rows'][0]))),
        ('duplicate URL', lambda w: w['report']['rows'][1].update({'url': w['report']['rows'][0]['url']})),
        ('red byte subject', lambda w: w['report']['rows'][0].update({'verdict': 'RED'})),
    ]:
        bad = copy.deepcopy(witness)
        plant(bad)
        assert not publication_proved(kind, real, bad)[0], 'Planted witness accepted: '+name
        assert publication_proved(kind, real, witness)[0]
    for name, plant in [
        ('wrong proof repository', lambda e: e['run']['repository'].update({'full_name': 'another/repository'})),
        ('wrong proof event', lambda e: e['run'].update({'event': 'pull_request'})),
        ('wrong artifact name', lambda e: e['artifact'].update({'name': 'another-report'})),
        ('expired artifact', lambda e: e['artifact'].update({'expired': True})),
        ('archive corruption', lambda e: e.update({'archive_base64': 'AAAA'+e['archive_base64'][4:]})),
        ('wrong upload attempt', lambda e: e['job'].update({'run_attempt': 0})),
        ('wrong artifact source', lambda e: e['artifact']['workflow_run'].update({'head_sha': '0'*40})),
    ]:
        bad = copy.deepcopy(envelope)
        plant(bad)
        try:
            decode_evidence(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('Planted evidence envelope accepted: '+name)
        decode_evidence(envelope)
    print('CONTROL real byte witness PASS / missing witness, changed SHA, archive, attempt and subject FAIL / restored PASS; green labels alone rejected')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--byte-evidence', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.refresh:
        snapshot = refresh()
        args.snapshot.parent.mkdir(parents=True, exist_ok=True)
        args.snapshot.write_text(json.dumps(snapshot, indent=2)+'\n')
    else:
        snapshot = json.loads(args.snapshot.read_text())
    envelope = json.loads(args.byte_evidence.read_text()) if args.byte_evidence else None
    witness = decode_evidence(envelope) if envelope else None
    if args.self_test:
        self_test(snapshot, witness, envelope)
    inventory = json.loads(args.inventory.read_text()) if args.inventory else None
    rendered = json.dumps(counts(snapshot, inventory, witness), indent=2)+'\n'
    print(rendered, end='')
    if args.output:
        args.output.write_text(rendered)

if __name__ == '__main__':
    main()
