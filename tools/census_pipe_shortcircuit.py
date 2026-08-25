#!/usr/bin/env python3
"""Census: every pipeline that feeds a SHORT-CIRCUITING consumer.

Failure mode 47, stated as a class rather than as the two instances it was
found in. `producer | grep -q PAT` under `pipefail`: grep exits the instant it
matches and closes the pipe, the still-writing producer dies of a broken pipe,
and `pipefail` promotes that death to the pipeline's status. The match
succeeded and the pipeline reports failure.

It runs in TWO directions, and only one of them is noisy:

  false-red    a non-zero pipeline makes the check FAIL. Cost: a gate that
               reds on correct behaviour, until someone silences it.
  false-green  a non-zero pipeline makes the check PASS. Cost: a gate that
               certifies the absence of something it never looked for. This is
               the dangerous one and it is silent.

Which direction a site sits in is decided by ONE question: what does the script
do when the pipeline returns non-zero? That is what this census classifies on -
never on the pattern text alone.

GitHub Actions shell defaults matter here and are easy to get wrong:
  no `shell:` key   ->  bash -e {0}                             pipefail OFF
  `shell: bash`     ->  bash --noprofile --norc -e -o pipefail  pipefail ON
so a step can be exposed without any `set -o pipefail` in its own script.

Usage: python3 tools/census_pipe_shortcircuit.py <repo-root> [<repo-root> ...]
"""
import os, re, sys, json

try:
    import yaml
except ImportError:
    print("PyYAML required"); raise SystemExit(2)

# Consumers that can exit before their producer has finished writing.
SHORT_CIRCUIT = [
    (r'\bgrep\b[^|;&]*(?<!-)\s-\w*q', 'grep -q'),
    (r'\bgrep\b[^|;&]*--quiet', 'grep --quiet'),
    (r'\bgrep\b[^|;&]*\s-\w*l\b', 'grep -l'),
    (r'\bgrep\b[^|;&]*\s-m\s*\d', 'grep -m N'),
    (r'\bhead\b', 'head'),
    (r'\bread\b\s+-?\w*\s*\w+\s*$', 'read'),
    (r"\bsed\b[^|;&]*\bq\b", 'sed …q'),
    (r"\bawk\b[^|;&]*\bexit\b", 'awk …exit'),
]

def short_circuit_kind(seg):
    for rx, name in SHORT_CIRCUIT:
        if re.search(rx, seg):
            return name
    return None

def split_pipeline(line):
    """Split on | that is not || and not inside quoting.

    A pipe inside `$( … )` counts EVEN WHEN THE WHOLE SUBSTITUTION IS QUOTED.
    The first draft tracked quotes only, so `AKV="$(ls … | head -1)"` read as
    one quoted string and the site was invisible - found by checking this
    census's recall against a raw grep rather than by trusting its own count.
    """
    parts, buf, i = [], '', 0
    stack = []                      # '"' / "'" / '$(' , innermost last
    while i < len(line):
        c = line[i]
        two = line[i:i+2]
        if stack and stack[-1] == "'":
            buf += c
            if c == "'":
                stack.pop()
        elif two == '$(':
            stack.append('$('); buf += two; i += 2; continue
        elif c == ')' and stack and stack[-1] == '$(':
            stack.pop(); buf += c
        elif c == '"':
            if stack and stack[-1] == '"':
                stack.pop()
            else:
                stack.append('"')
            buf += c
        elif c == "'" and not (stack and stack[-1] == '"'):
            stack.append("'"); buf += c
        elif c == '|' and two == '||':
            buf += '||'; i += 2; continue
        elif c == '|' and not (stack and stack[-1] in ('"', "'")):
            parts.append(buf); buf = ''
        else:
            buf += c
        i += 1
    parts.append(buf)
    return parts

def classify_direction(line, following, seterr=True):
    """What happens when this pipeline returns NON-ZERO?

    Returns (bucket, why). `following` is the next few lines, needed for the
    `if …; then` form where the consequence is not on the same line.
    """
    s = line.strip()
    nxt = ' '.join(x.strip() for x in following)

    # `PIPELINE || { … }`  /  `PIPELINE || cmd`
    if re.search(r'\|\|\s*(\{|exit|echo|:)', s):
        tail = s.split('||', 1)[1]
        if 'exit 1' in tail or 'exit 2' in tail or 'exit $' in tail:
            return 'false-red', 'non-zero -> `|| … exit`, so a dead producer fails the check'
        return 'false-red', 'non-zero -> the `||` branch runs'

    # `PIPELINE && { … exit 1 }`  — non-zero SKIPS the failure branch
    if re.search(r'&&\s*\{[^}]*exit', s):
        return 'false-green', 'non-zero SKIPS the `&&` failure branch, so a dead producer passes'

    # `if ! PIPELINE; then … fi` — non-zero SATISFIES the `if`, so a dead
    # producer takes the `then` branch. Whether that is red or green depends on
    # what the `then` branch does, which is the same question as everywhere else.
    if re.match(r'^if\s+!\s', s) or re.match(r'^elif\s+!\s', s):
        if 'exit 1' in nxt or 'exit 2' in nxt:
            return 'false-red', 'non-zero satisfies `if !`, so a dead producer takes the failure branch'
        return 'false-green', 'non-zero satisfies `if !` and the `then` branch does not fail'

    # A BARE leading `!` — the negative assertion with no `if` around it. This is
    # the shape §U1 names as the dangerous one: a dead producer inverts to 0 and
    # the assertion passes WITHOUT HAVING LOOKED. The first draft of this census
    # classified it as a bare pipeline and called it false-red, which is exactly
    # backwards; it was caught by reading the sites rather than the buckets.
    if s.startswith('! '):
        return 'false-green', 'leading `!`: a dead producer inverts to 0, so the absence is certified unlooked-at'

    # `if PIPELINE; then <A> else <B> fi`
    if s.startswith('if ') or s.startswith('elif '):
        # Non-zero takes the ELSE branch (or falls through when there is none).
        if 'else' in nxt:
            after_else = nxt.split('else', 1)[1]
            if 'exit 1' in after_else or 'exit 2' in after_else:
                return 'false-red', 'non-zero -> the `else` branch, which exits non-zero'
            return 'false-green', 'non-zero -> the `else` branch, which does not fail'
        # no else: non-zero simply skips the `then` body
        if 'exit 1' in nxt or 'exit 2' in nxt:
            return 'false-green', 'non-zero SKIPS a `then` body that exits, so a dead producer passes'
        return 'false-green', 'non-zero SKIPS the `then` body'

    # A bare pipeline only matters if something ACTS on its status. Under
    # `pipefail` without `set -e` nothing does: the output may truncate, but no
    # verdict moves. Saying otherwise inflates the census, and an inflated
    # census gets skimmed exactly like an unscoped sweep does.
    if not seterr:
        return 'safe', 'bare pipeline, no `set -e`: output may truncate, but no verdict depends on it'
    return 'false-red', 'bare pipeline: non-zero kills the step under `set -e`'

def scan_script(text, origin, pipefail, seterr, out):
    lines = text.split('\n')
    local_pipefail = pipefail
    local_seterr = seterr
    for n, raw in enumerate(lines, 1):
        line = raw.split('#', 1)[0] if raw.strip().startswith('#') else raw
        if re.search(r'set\s+-\S*o\s+pipefail|set\s+-o\s+pipefail', line):
            local_pipefail = True
        if re.search(r'set\s+-\w*e', line):
            local_seterr = True
        if '|' not in line:
            continue
        segs = split_pipeline(line)
        if len(segs) < 2:
            continue
        # only the consumers AFTER the first segment matter
        kinds = [k for k in (short_circuit_kind(s) for s in segs[1:]) if k]
        if not kinds:
            continue
        # A producer that is a shell builtin over a literal (echo/printf of a
        # captured variable) is still a producer - measured, not assumed.
        producer = segs[0].strip()
        if not local_pipefail:
            bucket, why = 'safe', 'no `pipefail` in scope: the pipeline takes the CONSUMER\'s status'
        else:
            bucket, why = classify_direction(line, lines[n:n+6], local_seterr)
        out.append({
            'origin': origin, 'line': n, 'consumer': kinds[0],
            'pipefail': local_pipefail, 'seterr': local_seterr,
            'bucket': bucket, 'why': why,
            'producer': producer[:70], 'text': line.strip()[:150],
        })

def workflow_steps(path):
    with open(path, encoding='utf-8') as f:
        doc = yaml.safe_load(f)
    if not isinstance(doc, dict):
        return
    for jn, job in (doc.get('jobs') or {}).items():
        default_shell = (((doc.get('defaults') or {}).get('run') or {}).get('shell')
                         or ((job.get('defaults') or {}).get('run') or {}).get('shell'))
        for i, st in enumerate(job.get('steps') or []):
            if 'run' not in st:
                continue
            shell = st.get('shell') or default_shell
            # THE DEFAULT MATTERS: an explicit `shell: bash` turns pipefail ON.
            pipefail = bool(shell) and 'bash' in str(shell)
            yield jn, st.get('id') or st.get('name') or f'step[{i}]', shell, pipefail, st['run']

def main(roots):
    out = []
    for root in roots:
        wfpaths = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '__pycache__')]
            for fn in filenames:
                if not fn.endswith(('.yml', '.yaml')):
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root)
                # A workflow OUTSIDE .github/workflows does not run, but it is
                # still workflow text somebody will copy. Labelled, not dropped.
                live = rel.startswith(os.path.join('.github', 'workflows'))
                if live or 'workflow' in rel:
                    wfpaths.append((full, rel, live))
        if wfpaths:
            for p, rel, live in sorted(wfpaths):
                fn = rel if not live else os.path.basename(rel)
                if not live:
                    fn = rel + ' (NOT LIVE: outside .github/workflows)'
                try:
                    steps = list(workflow_steps(p))
                except Exception as e:
                    print(f'  !! could not parse {p}: {e}')
                    continue
                for jn, sid, shell, pipefail, script in steps:
                    scan_script(script, f'{os.path.basename(root)}:{fn}::{jn}::{sid}'
                                        + (f' [shell:{shell}]' if shell else ' [shell:default]'),
                                pipefail, True, out)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in ('.git', 'node_modules', '__pycache__')]
            for fn in filenames:
                if not fn.endswith('.sh'):
                    continue
                p = os.path.join(dirpath, fn)
                rel = os.path.relpath(p, root)
                with open(p, encoding='utf-8', errors='replace') as f:
                    scan_script(f.read(), f'{os.path.basename(root)}:{rel}', False, False, out)
    return out

if __name__ == '__main__':
    gate = '--gate' in sys.argv
    roots = [a for a in sys.argv[1:] if not a.startswith('--')] or ['.']
    hits = main(roots)
    order = {'false-green': 0, 'false-red': 1, 'safe': 2}
    hits.sort(key=lambda h: (order[h['bucket']], h['origin'], h['line']))
    counts = {}
    for h in hits:
        counts[h['bucket']] = counts.get(h['bucket'], 0) + 1
    print(f'CENSUS: pipelines feeding a short-circuiting consumer')
    print(f'  roots: {", ".join(roots)}')
    print(f'  sites: {len(hits)}   ' + '   '.join(f'{k} {v}' for k, v in
          sorted(counts.items(), key=lambda kv: order[kv[0]])))
    print()
    cur = None
    for h in hits:
        if h['bucket'] != cur:
            cur = h['bucket']
            print(f'=== {cur.upper()} ===')
        pf = 'pipefail' if h['pipefail'] else 'no-pipefail'
        print(f'  {h["origin"]}:{h["line"]}  [{h["consumer"]} · {pf}]')
        print(f'      {h["text"]}')
        print(f'      -> {h["why"]}')
    if os.environ.get('CENSUS_JSON'):
        open(os.environ['CENSUS_JSON'], 'w').write(json.dumps(hits, indent=1))

    # --gate makes this a standing check rather than a one-off sweep. A site in
    # a file that does not run (a pinned fixture) is reported and excluded by
    # name - the exclusion is visible, never silent.
    if gate:
        live = [h for h in hits if h['bucket'] != 'safe' and 'NOT LIVE' not in h['origin']]
        parked = [h for h in hits if h['bucket'] != 'safe' and 'NOT LIVE' in h['origin']]
        print()
        for h in parked:
            print(f'  PARKED (not live): {h["origin"]}:{h["line"]}')
        if live:
            print(f'\n{len(live)} LIVE site(s) can report a match as a miss, or an absence '
                  f'they never looked for:')
            for h in live:
                print(f'  {h["bucket"].upper():<12} {h["origin"]}:{h["line"]}')
            print('\nCapture first, then match on a herestring. See failure mode 47.')
            raise SystemExit(1)
        print('\nno live short-circuit pipeline can invert a verdict')
