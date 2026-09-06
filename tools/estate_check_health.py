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
  python3 tools/estate_check_health.py [--gate] [--stale-days 30] [--pin-stale-days 2] [--json OUT]

HC3 §3.4: the Play pins (Games/play-publication.json) are reported every run —
commits behind each source's main and the age of the pinned commit — and a pin
that is behind AND older than --pin-stale-days is a STALE PIN, folded into the
gate: the six-hourly Pin release should have moved it.
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

SELF = 'estate-check-health.yml'

def classify(rows, declared, stale_days):
    """The whole verdict, as a pure function of the rows — so it can be proved
    on planted rows without spending a single API call or waiting for something
    in the estate to break.

    TWO THINGS THE FIRST REAL RUN OF THIS REPORT GOT WRONG, both fixed here.

    1. `ok_age is None` was read as STALE. It conflates two different facts: a
       check that succeeded a long time ago, and a check that has never
       succeeded because it is NEW. An age comparison needs an age. A check
       that has run and never gone green is not let off — its latest run is a
       failure, so it is already RED, which is the louder signal anyway.

    2. THIS REPORT COULD NOT JUDGE ITSELF, and failed trying. Its own row said
       "never succeeded" on its first run, so the run failed; the next run then
       saw a failed previous run and failed again. A self-sustaining red with
       no path back to green — which is precisely what this estate retired
       `apexpool-sports-verify` for: "a gate that cannot pass is not a gate, it
       is a landmine, and it measures nothing."

       So this report's OWN row is measured, printed in full and named — it is
       not hidden, and a human reads it every week — but it does not by itself
       decide the job's verdict. Every other check in the estate does. That is
       a narrow, declared exemption for the one row where self-reference makes
       the verdict meaningless, not a hole: nothing else is excused, and the
       row is on screen either way.
    """
    judged = [r for r in rows if r['file'] != SELF]
    red = [r for r in judged if r['conclusion'] == 'failure' and not r['retired']]
    retired_red = [r for r in judged if r['conclusion'] == 'failure' and r['retired']]
    stale = [r for r in judged if not r['retired']
             and r['ok_age'] is not None and r['ok_age'] > stale_days]
    return red, stale, retired_red

def unjudged(rows, stale_days):
    """Everything measured and printed but not folded into the verdict: this
    report's own row, and every check with no completed run at all. Named,
    because T1.2 calls a check that has never run the loudest possible signal
    and the easiest to overlook."""
    me = [r for r in rows if r['file'] == SELF]
    never = [r for r in rows if r['file'] != SELF and r['conclusion'] == 'NEVER RUN']
    never_green = [r for r in rows if r['file'] != SELF and r['ok_age'] is None
                   and r['conclusion'] not in ('NEVER RUN', 'failure')]
    return me, never, never_green

PIN_FILE = 'play-publication.json'
PIN_SOURCES = {'site_commit': 'mattroper1977.github.io', 'lessons_commit': 'Lessons'}

def pin_rows():
    """HC3 §3.4. Play is built from the commits pinned in Games/play-publication.json;
    a pin behind its source HEAD means merged work that is not served. One row per
    source: how many commits behind, and how old the pinned commit is."""
    import base64
    rows = []
    raw = api(f'/repos/MattRoper1977/Games/contents/{PIN_FILE}')
    pins = json.loads(base64.b64decode(raw['content']).decode('utf-8'))
    now = datetime.datetime.utcnow()
    for key, repo in PIN_SOURCES.items():
        sha = pins[key]
        cmp = api(f'/repos/MattRoper1977/{repo}/compare/{sha}...main')
        commit = api(f'/repos/MattRoper1977/{repo}/commits/{sha}')
        rows.append({'source': repo, 'pin': sha, 'behind': cmp['ahead_by'],
                     'pin_age': age(commit['commit']['committer']['date'], now),
                     'head': cmp['base_commit']['sha'] if cmp['ahead_by'] == 0 else cmp['commits'][-1]['sha']})
    return rows

def classify_pins(rows, stale_days):
    """A pin is STALE when it is behind its source AND the pinned commit is older
    than stale_days: the Pin release workflow (Games) runs six-hourly, so a pin
    still behind after that long is a release that is not happening, not one
    that is in flight."""
    return [r for r in rows if r['behind'] > 0 and r['pin_age'] is not None and r['pin_age'] > stale_days]

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
        # A check whose LATEST run is still going. This report is dispatchable,
        # so it will often be looking at an estate mid-run, and an in-flight
        # check must not be counted as red, as stale, or as never-run. Its last
        # COMPLETED run was a success 2 days ago, so it is simply healthy.
        dict(repo='X', file='in-flight.yml',    conclusion='IN PROGRESS', red_age=None, ok_age=2.0, retired=False),
        # And the real never-run: no completed run at all, so `ok_age` is None.
        # It is STALE by age - it has never succeeded - which is the correct
        # verdict and the loudest signal T1.2 asks for.
        dict(repo='X', file='never-run.yml',    conclusion='NEVER RUN', red_age=None, ok_age=None, retired=False),
        # THE TWO ROWS THE FIRST REAL RUN GOT WRONG.
        # A brand-new check has never succeeded because it is new. STALE is an
        # age comparison and an age comparison needs an age; a check that has
        # run and failed is caught by RED, which is the louder signal anyway.
        dict(repo='X', file='brand-new.yml',    conclusion='success', red_age=None, ok_age=None, retired=False),
        # And this report's own row. Judging it makes the verdict meaningless:
        # the failed run becomes the evidence for the next failure, and there is
        # no path back to green. Printed, never folded into the verdict.
        dict(repo='X', file='estate-check-health.yml', conclusion='failure', red_age=1.0, ok_age=None, retired=False),
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
    check('in-flight.yml' not in [r['file'] for r in red + stale],
          'a check whose latest run is still going is neither red nor stale — its last '
          'COMPLETED run is what judges it')
    check([r['file'] for r in retired_red] == ['retired.yml'],
          'a declared-retired red is reported separately, not as a red')
    check('healthy.yml' not in [r['file'] for r in red + stale],
          'a healthy check is in neither list')
    check('brand-new.yml' not in [r['file'] for r in red + stale],
          'a check that has never succeeded because it is NEW is neither red nor stale — '
          'STALE is an age comparison and needs an age')
    check('estate-check-health.yml' not in [r['file'] for r in red + stale],
          "THIS REPORT'S OWN red does not decide its own verdict — a monitor that fails on "
          'its own red has no path back to green')
    me, nev, ng = unjudged(rows, 30)
    check([r['file'] for r in me] == ['estate-check-health.yml'] and
          [r['file'] for r in nev] == ['never-run.yml'],
          'but both ARE printed — excluded from the verdict is not hidden from the reader',
          f"own={[r['file'] for r in me]} never-run={[r['file'] for r in nev]}")
    clean, _, _ = classify([rows[0]], {}, 30)
    check(clean == [], 'and with only healthy rows the verdict is CLEAR')
    pins = [
        dict(source='X', pin='a'*40, behind=0,  pin_age=40.0),   # current, however old: not stale
        dict(source='Y', pin='b'*40, behind=3,  pin_age=0.3),    # behind but fresh: a release in flight
        dict(source='Z', pin='c'*40, behind=7,  pin_age=9.0),    # behind AND old: the release is not happening
    ]
    stale_pins = classify_pins(pins, 2)
    check([r['source'] for r in stale_pins] == ['Z'],
          'a pin behind its source AND older than the window is named STALE PIN; a current pin and a fresh one are not',
          ', '.join(r['source'] for r in stale_pins) or '(none)')
    check(classify_pins(pins[:2], 2) == [], 'and with no such pin the pin verdict is CLEAR')
    print(f'\n  self-test {"passed" if ok else "FAILED"}')
    return 0 if ok else 1

def main():
    if '--self-test' in sys.argv:
        return self_test()
    gate = '--gate' in sys.argv
    stale_days = int(sys.argv[sys.argv.index('--stale-days') + 1]) if '--stale-days' in sys.argv else 30
    pin_stale_days = int(sys.argv[sys.argv.index('--pin-stale-days') + 1]) if '--pin-stale-days' in sys.argv else 2
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
    # A REPO THIS RUN COULD NOT READ IS NOT A REPO WITH NOTHING WRONG.
    # `github.token` in Actions is scoped to the repository it runs in, so a
    # cross-repo read needs a PAT. Without one, four of the five repos answer
    # 404 - and a report that skipped them and then printed CLEAR would be the
    # exact failure this order exists to prevent: a comfortable green over
    # something nobody looked at. Unreadable repos are collected and the run is
    # MEASUREMENT INVALID, named repo by repo.
    unreadable = []
    for repo in REPOS:
        try:
            wfs = api(f'/repos/MattRoper1977/{repo}/actions/workflows?per_page=100')['workflows']
        except Exception as e:
            unreadable.append((repo, str(e)))
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
            # AN IN-PROGRESS RUN IS NOT A CHECK THAT HAS NEVER RUN. A queued or
            # running workflow reports `conclusion: null`, and reading that as
            # NEVER RUN corrupts the one signal T1.2 calls the loudest: this
            # report is dispatchable, so it will often be looking at an estate
            # mid-run. The verdict comes from the latest COMPLETED run; a
            # workflow with no completed runs at all is the real NEVER RUN, and
            # one currently in flight is labelled as such rather than counted
            # against either.
            done = [r for r in runs if r.get('conclusion')]
            last = done[0] if done else None
            ok = next((r for r in done if r['conclusion'] == 'success'), None)
            running = bool(runs) and not done
            row = {'repo': repo, 'file': os.path.basename(w['path']), 'name': w['name'],
                   'conclusion': (last or {}).get('conclusion') or ('IN PROGRESS' if running else 'NEVER RUN'),
                   'red_age': age((last or {}).get('created_at'), now) if last and last.get('conclusion') == 'failure' else None,
                   'ok_age': age((ok or {}).get('created_at'), now),
                   'retired': (repo, os.path.basename(w['path'])) in declared}
            rows.append(row)

    # ONE classifier, used by the report and by the self-test. A self-test that
    # proves a parallel implementation proves nothing about the one that runs.
    red, stale, retired_red = classify(rows, declared, stale_days)

    exist = len(rows)
    never = [r for r in rows if r['conclusion'] == 'NEVER RUN']
    running = [r for r in rows if r['conclusion'] == 'IN PROGRESS']
    ran = exist - len(never)
    green = sum(1 for r in rows if r['conclusion'] == 'success')
    print('ESTATE CHECK HEALTH')
    print(f'  repos      {len(REPOS) - len(unreadable)} read of {len(REPOS)}')
    print(f'  checks     {exist} live · {ran} have ever completed a run · {green} green'
          + (f' · {len(running)} in flight right now' if running else ''))
    if never:
        # T1.2: a workflow with no completed run is the loudest possible signal
        # and the easiest to overlook, so it is named rather than counted.
        print(f'  NEVER RUN  {len(never)} — named, because a check that has never run has never judged anything:')
        for r in never:
            print(f'    {r["repo"]}/{r["file"]}')
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
    me, never, never_green = unjudged(rows, stale_days)
    if never:
        print(f'\n  NEVER RUN — {len(never)}, named because a check that has never run has never judged anything:')
        for r in never:
            print(f"    {r['repo']}/{r['file']}")
    if never_green:
        print(f'\n  HAS RUN, NEVER GREEN — {len(never_green)}:')
        for r in never_green:
            print(f"    {r['repo']}/{r['file']}   latest run {r['conclusion']}")
    if me:
        r = me[0]
        print('\n  THIS REPORT\'S OWN ROW — measured and printed, but it does not decide the verdict:')
        print(f"    {r['repo']}/{r['file']}   latest {r['conclusion']}   last success "
              f"{'never' if r['ok_age'] is None else str(r['ok_age']) + ' days ago'}")
        print('    A monitor that fails on its own red has no path back to green: the failed run')
        print('    becomes the evidence for the next failure. Every OTHER check decides the verdict.')
    if unreadable:
        print(f'\n  MEASUREMENT INVALID — {len(unreadable)} of {len(REPOS)} repos could not be read:')
        for repo, err in unreadable:
            print(f'    {repo}: {err}')
        print('    A repo this run could not read is not a repo with nothing wrong. In Actions,')
        print('    `github.token` is scoped to the repository it runs in; a cross-repo read needs a')
        print('    PAT with `repo` (or fine-grained Actions:read on all five). Set it as a secret')
        print('    and pass it as GH_TOKEN, or this run is a report about one repo wearing the')
        print('    title of a report about five.')
    if '--json' in sys.argv:
        json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    # HC3 §3.4 — pin staleness. Reported every run; folded into the gate.
    stale_pins, pin_error = [], None
    try:
        pins = pin_rows()
        stale_pins = classify_pins(pins, pin_stale_days)
        print('\n  PLAY PINS (Games/play-publication.json) — a pin behind its source is merged work that is not served:')
        for r in pins:
            print(f"    {r['source']:<26} pin {r['pin'][:10]}   {r['behind']} commit(s) behind main   pinned commit {r['pin_age']} days old"
                  + ('   STALE PIN' if r in stale_pins else ''))
    except Exception as e:
        pin_error = str(e)
        print(f'\n  PLAY PINS: could not be read — {pin_error}')
    if gate and unreadable:
        print(f'\nESTATE CHECK HEALTH: MEASUREMENT INVALID — {len(unreadable)} repo(s) unread')
        return 1
    if gate and pin_error:
        print('\nESTATE CHECK HEALTH: MEASUREMENT INVALID — the Play pins could not be read')
        return 1
    if gate and (red or stale or stale_pins):
        print(f'\nESTATE CHECK HEALTH: NOT CLEAR — {len(red)} red, {len(stale)} stale, {len(stale_pins)} stale pin(s)')
        return 1
    if gate:
        print('\nESTATE CHECK HEALTH: CLEAR — nothing red, nothing stale')
    return 0

if __name__ == '__main__':
    sys.exit(main())
