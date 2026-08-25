#!/usr/bin/env python3
"""The estate's check health, in one number — and one that no `paths:` filter
can hide from.

WHY. In one week two checks were found red for a week or more, BOTH BY ACCIDENT.
Main reported green throughout, honestly: green means "everything that fired,
passed". A filter cannot be trusted to reveal its own failures, so the estate
needs one thing that does not depend on filters at all.

WHAT IT REPORTS, per repo and in total:
  exist        live workflows (registry entries whose file still exists)
  ran          have run at least once
  green        last run succeeded
  RED          last run failed - named, with the age of the red
  STALE        no SUCCESS in --stale-days, whether or not currently failing.
               AGE IS THE SIGNAL THIS ESTATE WAS MISSING: apexgolf-verify was
               red for fifteen days and nothing anywhere said so.

IT IS A REPORTING JOB, NOT A VERIFICATION (T4.4). It does not dispatch or
re-run anything - exercising 57 workflows weekly would cost more than it is
worth, and a check's last-run age answers the question this exists to ask.

Retired checks are DECLARED in data/retired-checks.json and reported separately
by name. A check not declared there is never excused.

Usage:
  python3 tools/estate_check_health.py [--gate] [--stale-days 30] [--json OUT]
"""
import json, os, sys, urllib.request, datetime

REPOS = ['mattroper1977.github.io', 'Lessons', 'Games', 'Matt-s-Apps-', 'Games-']
HERE = os.path.dirname(os.path.abspath(__file__))
RETIRED = os.path.join(os.path.dirname(HERE), 'data', 'retired-checks.json')

def api(path):
    req = urllib.request.Request('https://api.github.com' + path,
                                 headers={'Accept': 'application/vnd.github+json'})
    tok = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if tok:
        req.add_header('Authorization', 'Bearer ' + tok)
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def age(ts, now):
    if not ts:
        return None
    t = datetime.datetime.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S')
    return round((now - t).total_seconds() / 86400, 1)

def classify(rows, declared, stale_days):
    """The whole verdict, as a pure function of the rows — so it can be proved
    on planted rows without spending a single API call or waiting for something
    in the estate to break."""
    red = [r for r in rows if r['conclusion'] == 'failure' and not r['retired']]
    retired_red = [r for r in rows if r['conclusion'] == 'failure' and r['retired']]
    stale = [r for r in rows if not r['retired']
             and (r['ok_age'] is None or r['ok_age'] > stale_days)]
    return red, stale, retired_red

def self_test():
    """T4.3 — prove it can fail, without waiting for the estate to break.

    Both limbs are planted: a currently-red check, and a check that is GREEN
    RIGHT NOW but has not succeeded in months. The second is the one this
    estate was missing — apexgolf-verify was red for fifteen days and age was
    the only signal that would have said so."""
    rows = [
        dict(repo='X', file='healthy.yml',      conclusion='success', red_age=None, ok_age=0.4,  retired=False),
        dict(repo='X', file='planted-red.yml',  conclusion='failure', red_age=9.1,  ok_age=12.0, retired=False),
        dict(repo='X', file='planted-stale.yml',conclusion='success', red_age=None, ok_age=91.0, retired=False),
        dict(repo='X', file='retired.yml',      conclusion='failure', red_age=40.0, ok_age=None, retired=True),
    ]
    red, stale, retired_red = classify(rows, {}, 30)
    ok = True
    def check(cond, what, detail=''):
        nonlocal ok
        if not cond: ok = False
        print(f'  [{"ok" if cond else "FAIL"}] {what}' + (f'  — {detail}' if detail else ''))
    check([r['file'] for r in red] == ['planted-red.yml'],
          'a planted RED is named', ', '.join(r['file'] for r in red) or '(none)')
    check([r['file'] for r in stale] == ['planted-stale.yml'],
          'a planted STALE is named even though it is currently GREEN',
          ', '.join(f"{r['file']} ok_age={r['ok_age']}" for r in stale) or '(none)')
    check([r['file'] for r in retired_red] == ['retired.yml'],
          'a declared-retired red is reported separately, not as a red')
    check('healthy.yml' not in [r['file'] for r in red + stale],
          'a healthy check is in neither list')
    clean, _, _ = classify([rows[0]], {}, 30)
    check(clean == [], 'and with only healthy rows the verdict is CLEAR')
    print(f'\n  self-test {"passed" if ok else "FAILED"}')
    return 0 if ok else 1

def main():
    if '--self-test' in sys.argv:
        return self_test()
    gate = '--gate' in sys.argv
    stale_days = int(sys.argv[sys.argv.index('--stale-days') + 1]) if '--stale-days' in sys.argv else 30
    now = datetime.datetime.utcnow()
    declared = {(r['repo'], r['workflow']): r for r in json.load(open(RETIRED))['retired']} \
        if os.path.exists(RETIRED) else {}

    # A DECLARATION THAT POINTS AT NOTHING IS THE PAPERWORK WITHOUT THE THING.
    # Every retirement names a record, and that record lives in the repo whose
    # workflow was retired - so it is checked THERE, over the API, rather than
    # assumed to be a path in this one. An unverifiable excuse is not an
    # excuse: if the record has gone, the check stops being excused and is
    # reported as a plain red.
    for key, r in list(declared.items()):
        rec = r.get('record')
        if not rec:
            print(f"  !! {r['repo']}/{r['workflow']} is declared retired with no record — "
                  f"the declaration does not excuse it")
            del declared[key]
            continue
        try:
            api(f"/repos/MattRoper1977/{r['repo']}/contents/{rec}")
        except Exception:
            print(f"  !! {r['repo']}/{r['workflow']} names a record that is not there: {rec} — "
                  f"the declaration does not excuse it")
            del declared[key]

    rows, red, stale, retired_red = [], [], [], []
    orphans = 0
    for repo in REPOS:
        try:
            wfs = api(f'/repos/MattRoper1977/{repo}/actions/workflows?per_page=100')['workflows']
        except Exception as e:
            print(f'  !! {repo}: {e}')
            continue
        # THE LIVENESS TEST, and it is the whole difference between a report
        # somebody reads and one they skim. The Actions API keeps a registry
        # entry for every workflow that ever existed and reports all of them
        # `active` - 197 across this estate, 140 of them files that were deleted
        # months ago. Without this the first run of this tool said "60 red",
        # 59 of which could never run again.
        try:
            listing = api(f'/repos/MattRoper1977/{repo}/contents/.github/workflows')
            live_files = {e['name'] for e in listing if e['type'] == 'file'}
        except Exception:
            live_files = None          # cannot tell - report everything rather than hide
        for w in wfs:
            if live_files is not None and os.path.basename(w['path']) not in live_files:
                orphans += 1
                continue
            try:
                runs = api(f"/repos/MattRoper1977/{repo}/actions/workflows/{w['id']}/runs?per_page=20")['workflow_runs']
            except Exception:
                runs = []
            # A registry entry whose workflow has been deleted keeps reporting
            # `active` for ever. It cannot run, so it is not a check.
            if not runs and w['state'] != 'active':
                continue
            last = runs[0] if runs else None
            ok = next((r for r in runs if r['conclusion'] == 'success'), None)
            row = {'repo': repo, 'file': os.path.basename(w['path']), 'name': w['name'],
                   'conclusion': (last or {}).get('conclusion') or 'NEVER RUN',
                   'red_age': age((last or {}).get('created_at'), now) if last and last.get('conclusion') == 'failure' else None,
                   'ok_age': age((ok or {}).get('created_at'), now),
                   'retired': (repo, os.path.basename(w['path'])) in declared}
            rows.append(row)

    # ONE classifier, used by the report and by the self-test. A self-test that
    # proves a parallel implementation proves nothing about the one that runs.
    red, stale, retired_red = classify(rows, declared, stale_days)

    exist = len(rows)
    ran = sum(1 for r in rows if r['conclusion'] != 'NEVER RUN')
    green = sum(1 for r in rows if r['conclusion'] == 'success')
    print('ESTATE CHECK HEALTH')
    print(f'  repos      {len(REPOS)}')
    print(f'  checks     {exist} live · {ran} have ever run · {green} green')
    print(f'  orphaned   {orphans} registry entries whose file no longer exists — cannot run, not checks')
    print(f'  RED        {len(red)}')
    print(f'  STALE      {len(stale)}   (no success in {stale_days} days)')
    print(f'  retired    {len(retired_red)} declared-retired and red, which is expected')
    if red:
        print('\n  RED — name and age:')
        for r in sorted(red, key=lambda x: -(x['red_age'] or 0)):
            print(f"    {r['repo']}/{r['file']}   red for {r['red_age']} days   (last success "
                  f"{r['ok_age']} days ago)" if r['ok_age'] is not None else
                  f"    {r['repo']}/{r['file']}   red for {r['red_age']} days   (never succeeded)")
    if stale:
        print(f'\n  STALE — no success in {stale_days} days:')
        for r in stale:
            print(f"    {r['repo']}/{r['file']}   last success "
                  f"{'never' if r['ok_age'] is None else str(r['ok_age']) + ' days ago'}   "
                  f"(currently {r['conclusion']})")
    if retired_red:
        print('\n  declared retired, red by design:')
        for r in retired_red:
            d = declared[(r['repo'], r['file'])]
            print(f"    {r['repo']}/{r['file']}   retired {d['retiredOn']} — {d['record']}")
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    if gate and (red or stale):
        print(f'\nESTATE CHECK HEALTH: NOT CLEAR — {len(red)} red, {len(stale)} stale')
        return 1
    if gate:
        print('\nESTATE CHECK HEALTH: CLEAR — nothing red, nothing stale')
    return 0

if __name__ == '__main__':
    sys.exit(main())
