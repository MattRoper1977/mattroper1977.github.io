#!/usr/bin/env python3
"""Census: every check in the estate, and whether anything would ever show it red.

WHY THIS EXISTS. In one week two checks were found red for a week or more, both
BY ACCIDENT: 5m (red since 14 Aug, found by a manual dispatch) and 5o
(apexpool-verify, red since 10 Aug, found because a comment-only edit happened
to touch its paths). Different repos, different triggers, one structural hole:
A CHECK IS ONLY AS VISIBLE AS THE FILTER THAT DECIDES WHEN IT RUNS. Main
reported green throughout, honestly - green means "everything that fired,
passed".

Two found by accident in one week is a sampling estimate, not two incidents.

THE STATED TRIGGER AND THE ACTUAL RUN HISTORY ARE TWO DIFFERENT FACTS, and the
gap between them is the point, so run history comes from the API and never from
a reading of the YAML.

RECALL IS MEASURED AGAINST A CRUDER INSTRUMENT (standing practice, S5 §V4.3).
The Actions API keeps a registry entry for every workflow that ever existed -
197 of them across this estate, all reported `active`, 140 of which are files
that no longer exist and can never run again. A plain directory walk finds 57.
The census reconciles the two and refuses to proceed if they disagree.

Buckets:
  A healthy            fires on realistic diffs, ran recently, green
  B RED AND SILENT     red now, and nothing about a normal day would surface it
  C structurally blind  the filter excludes the files whose BEHAVIOUR it asserts
  D dormant but correct scoped to a rare path on purpose

Usage: python3 tools/census_check_health.py [--json OUT] [--stale-days 30]
"""
import json, os, re, sys, urllib.request, datetime

REPOS = [
    ('mattroper1977.github.io', '/home/user/mattroper1977.github.io'),
    ('Lessons',                 '/home/user/Lessons'),
    ('Games',                   '/home/user/games'),
    ('Matt-s-Apps-',            '/home/user/matt-s-apps-'),
    ('Games-',                  '/home/user/games-'),
]
NOW = datetime.datetime(2026, 8, 25, 12, 0, 0)   # stamped; scripts here may not read the clock

def api(path):
    req = urllib.request.Request('https://api.github.com' + path,
                                 headers={'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def age_days(ts):
    if not ts:
        return None
    t = datetime.datetime.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S')
    return round((NOW - t).total_seconds() / 86400, 1)

def yaml_facts(full):
    """Triggers, paths and branch filters, read from the file itself. Deliberately
    a text read, not a YAML load: `on:` parses as the boolean True in YAML 1.1
    and half the tooling in this estate has tripped on it."""
    try:
        body = open(full, encoding='utf-8', errors='replace').read()
    except Exception:
        return {}
    head = body.split('\njobs:')[0]
    trig = sorted(set(re.findall(r'^\s{2}(push|pull_request|schedule|workflow_dispatch|'
                                 r'workflow_run|repository_dispatch|release|deployment_status|'
                                 r'issue_comment|check_suite|page_build):', head, re.M)))
    paths = re.findall(r"^\s+-\s+'([^']+)'|^\s+-\s+\"([^\"]+)\"", head, re.M)
    paths = [a or b for a, b in paths]
    has_paths = bool(re.search(r'^\s+paths(-ignore)?:', head, re.M))
    branches = re.findall(r'^\s+branches:\s*\[([^\]]*)\]', head, re.M)
    return {'triggers': trig, 'paths': paths if has_paths else [],
            'has_paths': has_paths, 'branches': branches, 'body': body}

def main():
    stale_days = 30
    if '--stale-days' in sys.argv:
        stale_days = int(sys.argv[sys.argv.index('--stale-days') + 1])
    rows, totals = [], {'api': 0, 'orphan': 0, 'disk': 0}
    # Kept per repo so a disagreement can NAME the file rather than only the
    # count. A reconciliation that reports "57 != 58" and stops has told the
    # reader that the census is wrong and nothing about where to look.
    seen = {'api': set(), 'disk': set()}
    for name, path in REPOS:
        try:
            wfs = api(f'/repos/MattRoper1977/{name}/actions/workflows?per_page=100')['workflows']
        except Exception as e:
            print(f'  !! {name}: {e}', file=sys.stderr)
            continue
        wdir = os.path.join(path, '.github', 'workflows')
        disk = sorted(f for f in os.listdir(wdir)) if os.path.isdir(wdir) else []
        disk = [f for f in disk if f.endswith(('.yml', '.yaml'))]
        totals['api'] += len(wfs); totals['disk'] += len(disk)
        seen['disk'] |= {f'{name}/{f}' for f in disk}
        seen['api'] |= {f"{name}/{os.path.basename(w['path'])}" for w in wfs
                        if os.path.exists(os.path.join(path, w['path']))}
        for w in wfs:
            full = os.path.join(path, w['path'])
            if not os.path.exists(full):
                totals['orphan'] += 1
                continue
            try:
                runs = api(f"/repos/MattRoper1977/{name}/actions/workflows/{w['id']}/runs?per_page=30")['workflow_runs']
            except Exception:
                runs = []
            last = runs[0] if runs else None
            ok = next((r for r in runs if r['conclusion'] == 'success'), None)
            recent = [r for r in runs if (age_days(r['created_at']) or 999) <= 30]
            rows.append({
                'repo': name, 'file': os.path.basename(w['path']), 'wf_name': w['name'],
                'last_run': (last or {}).get('created_at', '')[:10] or 'NEVER',
                'last_age': age_days((last or {}).get('created_at')),
                'last_ok': (ok or {}).get('created_at', '')[:10] or 'NEVER',
                'ok_age': age_days((ok or {}).get('created_at')),
                'conclusion': (last or {}).get('conclusion') or ('none' if not last else 'in_progress'),
                'runs_30d': len(recent),
                **yaml_facts(full),
            })
    # ---- reconciliation, before anything is believed ----------------------
    live = totals['api'] - totals['orphan']
    print('CENSUS: every check in the estate')
    print(f"  instrument 1 (Actions API registry)  {totals['api']:>4} workflows, all reported active")
    print(f"  …of which the file no longer exists  {totals['orphan']:>4} ORPHANED - can never run again")
    print(f"  instrument 1, live                   {live:>4}")
    print(f"  instrument 2 (plain directory walk)  {totals['disk']:>4}")
    if live != totals['disk']:
        print(f'\n  RECONCILIATION FAILED: {live} != {totals["disk"]}. The census is wrong until this agrees.')
        for f in sorted(seen['disk'] - seen['api']):
            print(f'    ON DISK, NOT IN THE REGISTRY  {f}')
            print('        a workflow file the Actions API has never seen: either it has not '
                  'been pushed yet, or it has never parsed.')
        for f in sorted(seen['api'] - seen['disk']):
            print(f'    IN THE REGISTRY, NOT ON DISK  {f}')
            print('        the registry resolved a path this walk did not: check for a '
                  'workflow YAML outside .github/workflows/.')
        raise SystemExit(2)
    print(f'  reconciled at {live}\n')
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    return rows

if __name__ == '__main__':
    rows = main()
    for r in sorted(rows, key=lambda x: (x['repo'], x['file'])):
        print('  %-24s %-42s %-9s last %-10s (%5s d)  ok %-10s (%6s d)  30d %-3s  %s%s' % (
            r['repo'][:24], r['file'][:42], r['conclusion'], r['last_run'], r['last_age'],
            r['last_ok'], r['ok_age'], r['runs_30d'],
            ','.join(t[:4] for t in r['triggers']),
            f"  paths:{len(r['paths'])}" if r['has_paths'] else ''))
