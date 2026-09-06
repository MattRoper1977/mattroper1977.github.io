#!/usr/bin/env python3
"""
T5. REQUIRED CHECKS vs EXISTING CHECKS — a report, never a change.

`apexpool-verify` went red on the PR that broke it and that PR merged anyway.
That is a branch-protection question, not a workflow question, and settings are
Matt's: this prints the gap and the clicks, and changes nothing. Same standing
precedent as the HTTPS item.

TWO INSTRUMENTS, because a settings read and a behaviour read can disagree and
the disagreement is the interesting part (standing practice, §V4.3):

  1. THE SETTING. /branches/{default} carries `protected` and a protection blob
     with `enforcement_level` and the required contexts. This is readable
     WITHOUT admin scope; /branches/{b}/protection is not, and answers 403 for
     this token. Rulesets - the newer mechanism, which can require checks
     without `protected` being true - are listed separately, because a report
     that only looked at classic protection would call a ruleset-guarded repo
     unguarded.

  2. THE BEHAVIOUR. A required check CANNOT be red on the head commit of a PR
     that merged. So count merged PRs whose head SHA carried a failing check
     run. Zero in a repo is consistent with something being required there;
     a non-zero count is proof that nothing was.

Usage: python3 tools/report_required_checks.py [--sample 30]
Exit:  0 when both instruments were read. 1 only when they could not be -
       a report that could not measure is not a clean report.
"""
import json, os, sys, urllib.request, urllib.error

REPOS = ['mattroper1977.github.io', 'Lessons', 'Games', 'Matt-s-Apps-', 'Games-']

def api(path):
    req = urllib.request.Request('https://api.github.com' + path,
                                 headers={'Accept': 'application/vnd.github+json'})
    tok = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if tok:
        req.add_header('Authorization', 'Bearer ' + tok)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    sample = int(sys.argv[sys.argv.index('--sample') + 1]) if '--sample' in sys.argv else 30
    unreadable = []
    print('REQUIRED CHECKS vs EXISTING CHECKS')
    print('  reported, never changed - branch protection is Matt\'s\n')

    grand = {'exist': 0, 'pr_gated': 0, 'required': 0, 'merged': 0, 'red_merges': 0, 'no_safe': []}
    for repo in REPOS:
        try:
            info = api(f'/repos/MattRoper1977/{repo}')
            branch = info['default_branch']
            b = api(f'/repos/MattRoper1977/{repo}/branches/{branch}')
        except Exception as e:
            unreadable.append(f'{repo}: {e}')
            print(f'  {repo}: UNREADABLE - {e}')
            continue

        prot = b.get('protection') or {}
        rsc = prot.get('required_status_checks') or {}
        contexts = list(rsc.get('contexts') or []) + \
                   [c.get('context') for c in (rsc.get('checks') or [])]
        try:
            rulesets = api(f'/repos/MattRoper1977/{repo}/rulesets')
        except Exception:
            rulesets = None

        # Which checks EXIST, and which of them were built to gate a PR. A
        # dispatch-only or scheduled workflow was never meant to block a merge,
        # so counting it in the gap would inflate the finding.
        try:
            wfs = api(f'/repos/MattRoper1977/{repo}/actions/workflows?per_page=100')['workflows']
        except Exception as e:
            unreadable.append(f'{repo} workflows: {e}')
            wfs = []
        try:
            listing = api(f'/repos/MattRoper1977/{repo}/contents/.github/workflows')
            live = {e['name'] for e in listing if e['type'] == 'file'}
        except urllib.error.HTTPError as e:
            # A repo with no .github/workflows answers 404. That is a repo with
            # ZERO checks, a fact, not a measurement that failed - and calling
            # it unreadable would red this report for ever on Games-.
            if e.code == 404:
                live = set()
            else:
                unreadable.append(f'{repo} workflow listing: {e}')
                live = None
        except Exception as e:
            unreadable.append(f'{repo} workflow listing: {e}')
            live = None
        if live is not None:
            wfs = [w for w in wfs if os.path.basename(w['path']) in live]
        import base64, re as _re
        pr_gated, safe_to_require, would_deadlock = [], [], []
        for w in wfs:
            try:
                body = api(f"/repos/MattRoper1977/{repo}/contents/{w['path']}")
                text = base64.b64decode(body['content']).decode('utf-8', 'replace')
            except Exception:
                continue
            head = text.split('\njobs:')[0]
            if '\n  pull_request:' not in head and '\n  pull_request_target:' not in head:
                continue
            fname = os.path.basename(w['path'])
            pr_gated.append(fname)
            # THE TRAP WORTH NAMING. A required check that carries a `paths:`
            # filter never REPORTS on a PR outside those paths, and GitHub
            # waits for a report it will never get: the PR is blocked for ever
            # with "Expected - Waiting for status to be reported". So the set
            # that is SAFE to require is the PR-firing checks with no paths
            # filter. Requiring a filtered one is not a stricter estate, it is
            # a jammed one.
            if _re.search(r'^\s+paths(-ignore)?:', head, _re.M):
                would_deadlock.append(fname)
            else:
                # The check name GitHub shows is the job's `name:` if it has
                # one and the JOB ID if it does not - so a job without a name
                # must not print as nothing, or the click instruction is
                # "type this: " and Matt is left guessing.
                jobs_txt = text.split('\njobs:', 1)[-1]
                names, pr_skipped = [], []
                for m in _re.finditer(r'^  (\w[\w-]*):\s*$', jobs_txt, _re.M):
                    jid = m.group(1)
                    tail = jobs_txt[m.end():]
                    nxt = _re.search(r'^  \w[\w-]*:\s*$', tail, _re.M)
                    blk = tail[:nxt.start()] if nxt else tail
                    jn = _re.search(r'^    name:\s*(.+)$', blk, _re.M)
                    label = jn.group(1).strip().strip('"\'') if jn else jid
                    # A JOB-LEVEL `if:` THAT EXCLUDES PULL REQUESTS DEADLOCKS
                    # EXACTLY LIKE A paths FILTER. The workflow fires, the job
                    # is skipped, and a skipped job never reports the context
                    # GitHub is waiting for. mbm-audience-discovery-closeout's
                    # production job carries
                    # `if: github.event_name != 'pull_request'`, and the first
                    # draft of this report handed that job's name to Matt as
                    # SAFE TO REQUIRE. Naming a check that jams every PR is
                    # worse than naming none.
                    cond = _re.search(r'^    if:\s*(.+)$', blk, _re.M)
                    if cond and 'pull_request' in cond.group(1):
                        pr_skipped.append((label, cond.group(1).strip()))
                    else:
                        names.append(label)
                if names:
                    safe_to_require.append((fname, names, pr_skipped))
                else:
                    would_deadlock.append(fname + '  (every job is skipped on a pull request)')

        # THE BEHAVIOUR READ.
        merged, red_merges = 0, []
        try:
            prs = api(f'/repos/MattRoper1977/{repo}/pulls?state=closed&per_page={sample}'
                      f'&sort=updated&direction=desc')
            for p in [x for x in prs if x.get('merged_at')]:
                merged += 1
                try:
                    cr = api(f"/repos/MattRoper1977/{repo}/commits/{p['head']['sha']}"
                             f"/check-runs?per_page=100")['check_runs']
                except Exception:
                    continue
                bad = sorted({c['name'] for c in cr
                              if c.get('conclusion') in ('failure', 'timed_out')})
                if bad:
                    red_merges.append((p['number'], p['merged_at'][:10], bad))
        except Exception as e:
            unreadable.append(f'{repo} pulls: {e}')

        if pr_gated and not safe_to_require:
            grand['no_safe'].append(repo)
        grand['exist'] += len(wfs); grand['pr_gated'] += len(pr_gated)
        grand['required'] += len(contexts); grand['merged'] += merged
        grand['red_merges'] += len(red_merges)

        print(f'  === {repo}  ({branch}) ===')
        print(f'    setting     protected={b.get("protected")}  '
              f'enforcement={rsc.get("enforcement_level", "?")}  '
              f'required contexts={len(contexts)}  '
              f'rulesets={"unreadable" if rulesets is None else len(rulesets)}')
        for c in contexts:
            print(f'                  required: {c}')
        print(f'    exist       {len(wfs)} live check(s), {len(pr_gated)} of them fire on pull_request')
        print(f'    behaviour   {len(red_merges)} of {merged} sampled merged PRs merged OVER a red check')
        for n, when, names in red_merges[:5]:
            print(f'                  #{n} merged {when} · red: {"; ".join(names[:3])}')

        # THE GAP, BOTH DIRECTIONS.
        not_required = [f for f in pr_gated if f not in contexts and
                        f.replace('.yml', '') not in contexts]
        gone = [c for c in contexts if c not in {w['name'] for w in wfs}
                and c not in {os.path.basename(w['path']) for w in wfs}]
        print(f'    GAP  matters but is not required : {len(not_required)}')
        print(f'    of those, SAFE to require (no paths filter): {len(safe_to_require)}')
        for fname, jobs, skipped in safe_to_require:
            print(f'                  {fname}')
            for j in jobs:
                print(f'                      type this: {j}')
            for j, cond in skipped:
                print(f'                      NOT this:  {j}')
                print(f'                          it is skipped on a pull request ({cond}), and a')
                print(f'                          skipped job never reports — requiring it jams every PR.')
        print(f'    of those, would DEADLOCK a PR if required (has a paths filter): '
              f'{len(would_deadlock)}')
        for fname in would_deadlock:
            print(f'                  {fname}')
        print(f'    GAP  required but no longer exists: {len(gone)}'
              + (f'  {gone}' if gone else '   (a renamed required check blocks merges for ever)'))
        # THE BEHAVIOUR INSTRUMENT CAN ONLY FALSIFY. A merge over a red check
        # PROVES nothing was required; zero red merges proves nothing at all -
        # it may just be that no PR was red. Reading "0 red merges" as
        # corroboration would be the same error as reading a green filtered
        # check as coverage, which is why this order exists.
        if red_merges:
            verdict = ('behaviour CONTRADICTS any claim that a check is required here '
                       f'({len(red_merges)} merge(s) over red)')
            if contexts:
                verdict += '  <-- and the setting says checks ARE required: read the setting again'
        elif merged:
            verdict = (f'behaviour is silent - {merged} merged PR(s) sampled, none of them red. '
                       'This instrument falsifies; it cannot confirm')
        else:
            verdict = 'behaviour is silent - no merged PRs in the sample'
        print(f'    instruments  {verdict}')
        print()

    print('  TOTALS')
    print(f'    {grand["exist"]} live checks · {grand["pr_gated"]} fire on pull_request · '
          f'{grand["required"]} required for merge anywhere')
    print(f'    {grand["red_merges"]} of {grand["merged"]} sampled merged PRs merged over a red check')
    print()
    if grand['no_safe']:
        print('  BEFORE HE CLICKS ANYTHING, one finding that is not a settings change:')
        for r in grand['no_safe']:
            print(f'    {r} has PR-firing checks but NOT ONE without a paths filter, so there is')
            print('      nothing there that could be required without jamming every PR outside')
            print('      those paths. That repo needs a filter-free aggregate check first.')
        print()
    print('  WHAT MATT WOULD CLICK, per repo, in order:')
    print('    1. github.com/MattRoper1977/<repo>  ->  Settings  ->  Rules  ->  Rulesets')
    print('    2. New ruleset  ->  New branch ruleset. Name it "main".')
    print('    3. Enforcement status: Active.')
    print('    4. Target branches  ->  Add target  ->  Include default branch.')
    print('    5. Tick "Require status checks to pass".')
    print('    6. Add checks  ->  type the check name  ->  pick it from the list.')
    print('       The name to type is the JOB name shown on a PR, not the file name.')
    print('    7. Tick "Require branches to be up to date before merging" if he wants')
    print('       a check re-run against the merged result rather than the branch alone.')
    print('    8. Create.')
    print()
    print('    Nothing here has been changed. This is a report.')

    if unreadable:
        print('\n  MEASUREMENT INCOMPLETE - these could not be read:')
        for u in unreadable:
            print(f'    {u}')
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
