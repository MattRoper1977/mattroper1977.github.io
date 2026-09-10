#!/usr/bin/env python3
"""Every pinned artefact in the estate, and the checks that depend on it.

WHY. Commit 8432492 ("Phase 1: the eleven get an inline exit") changed eleven
game files and re-pinned SIX sibling gates. It missed the seventh, and
apexpool-verify went red on that very pull request, merged anyway, and stayed
red for fifteen days. Six of seven is what a hand-counted set looks like from
the outside.

DERIVED BY MEASUREMENT, NOT BY PARSING INTENT. A pin is only a pin if it is the
hash of something. So every candidate artefact is hashed and every hash literal
in every gate is looked up in that table. A literal that matches a file IS a pin
on that file, whatever it is called and whatever the comment around it says. A
literal that matches nothing is reported separately - it is either a git SHA, a
foreign hash, or A PIN THAT HAS GONE STALE, and telling those apart is the
reader's job, not a guess this file should make.

Byte-count literals are matched the same way, but only when they sit within a
few lines of a matched hash - a bare integer is not evidence of anything.

Usage:
  python3 tools/derive_pin_dependents.py [--write] [--check]
    --write   emit data/pin-dependents.json
    --check   exit 1 if the emitted file is not what the estate would produce
"""
import hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'pin-dependents.json')
# Literals a reader has been through, with what they turned out to be. Named,
# never silently excluded - the pr124 and /games/ precedent.
READER_RESOLVED = [
    {'gate': '.github/workflows/neonsync-verify.yml', 'line': 83,
     'reading': ('a SUPERSEDE CLAUSE, read 2026-08-25: a conditional pin on a delivered harness '
                 'that never landed. The step says so in the twelve lines above it - if the file '
                 'ever hashes to this, it wins outright; otherwise a replacement runs and is '
                 'labelled as one. A pin on something that does not exist yet, on purpose.')},
]

HEX = re.compile(r'(?<![0-9a-fA-F])([0-9a-f]{64}|[0-9a-f]{40})(?![0-9a-fA-F])')
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '_shelf', 'artifacts', 'audit-output'}
# Where a pin can be held. A pin inside data/ is the record, not a dependent.
GATE_DIRS = ('tools', '.github/workflows')
GATE_EXT = ('.js', '.mjs', '.py', '.sh', '.yml', '.yaml')

def artefact_hashes():
    """sha256 and git-blob sha1 of every plausible artefact. Both, because gates
    in this estate pin with each: sha256sum for content, git hash-object for a
    blob."""
    table = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            try:
                if os.path.getsize(full) > 12_000_000:
                    continue
                b = open(full, 'rb').read()
            except Exception:
                continue
            table.setdefault(hashlib.sha256(b).hexdigest(), []).append(rel)
            blob = b'blob ' + str(len(b)).encode() + b'\0' + b
            table.setdefault(hashlib.sha1(blob).hexdigest(), []).append(rel)
    return table

def gates():
    for gd in GATE_DIRS:
        base = os.path.join(ROOT, gd)
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                if fn.endswith(GATE_EXT):
                    full = os.path.join(dirpath, fn)
                    yield os.path.relpath(full, ROOT), full

def derive():
    table = artefact_hashes()
    pins, unmatched = {}, []
    for rel, full in gates():
        try:
            lines = open(full, encoding='utf-8', errors='replace').read().split('\n')
        except Exception:
            continue
        for n, line in enumerate(lines, 1):
            for h in HEX.findall(line):
                if h in table:
                    art = sorted(table[h])[0]
                    pins.setdefault(art, [])
                    if not any(d['gate'] == rel and d['line'] == n for d in pins[art]):
                        pins[art].append({'gate': rel, 'line': n,
                                          'algo': 'sha256' if len(h) == 64 else 'sha1-blob'})
                else:
                    unmatched.append({'gate': rel, 'line': n, 'literal': h[:12] + '…',
                                      'kind': classify_literal(lines, n, line)})
    return pins, unmatched


def classify_literal(lines, n, line):
    """A hash that matches no file here is not automatically a stale pin, and
    saying so would make this census noise. Three of the five first flagged were
    correct by design and only reading them showed it:

      transform  the pin is on a REVERSE-APPLIED copy - verify_neonbreach.js
                 hashes the file with the generated exit region stripped out, so
                 nothing on disk can ever match it
      negative   the literal is asserted NOT to be served - verify_neonsync.js
                 keeps BASE_SHA precisely to prove the superseded build is gone
      git-ref    a commit or a PR head, never content

    What is left after those is the bucket that needs a reader, and 5o lived in
    exactly that bucket for fifteen days."""
    t = line.strip()
    # Classify by HOW THE CONSTANT IS USED, wherever that happens to be - not by
    # what sits within N lines of it. Tuning a window is how a classifier gets
    # tuned to the examples in front of it; the use sites are the evidence.
    ident = None
    mm = re.match(r'(?:const|let|var)?\s*([A-Z][A-Z0-9_]{2,})\s*=', t)
    if mm:
        ident = mm.group(1)
    body = '\n'.join(lines)
    uses = [l for l in lines if ident and ident in l and not l.strip().startswith(('*', '//', '#'))] if ident else []
    use_text = '\n'.join(uses)
    near = use_text + '\n' + '\n'.join(lines[max(0, n - 10):n + 6])
    if re.search(r'\bref:\s|checkout|head..\[.sha.\]|/pulls/', t, re.I):
        return 'git-ref'
    if re.search(r'Previous:|superseded|was ', t, re.I) and t.lstrip().startswith(('*', '#', '//')):
        return 'superseded, recorded in a comment'
    if ident and re.search(r'!==\s*' + re.escape(ident) + r'|' + re.escape(ident) + r'\s*!==', use_text):
        return 'negative pin (asserted NOT to be served)'
    if re.search(r'reverse|stripped|reverseEdits|reverse-apply', near, re.I):
        return 'transform pin (a reverse-applied copy, which nothing on disk equals)'
    if re.search(r'!==\s*\w*' + re.escape(t.split('=')[0].split()[-1] if '=' in t else 'zzz'), near):
        return 'negative pin (asserted NOT to be served)'
    if re.search(r'superseded|not served|!==', near):
        return 'negative pin (asserted NOT to be served)'
    if re.search(r'PIN|EXPECTED|DELIVERED|SHA256|_SHA\b', t):
        return 'NAMED AS A PIN, matches nothing here - NEEDS A READER'
    return 'other'

def enforce_diff(pins, rng):
    """T6.3 — when a change re-pins, the dependents are DERIVED, never counted.

    8432492 changed eleven game files and re-pinned six sibling gates. Six of
    seven is what a hand-counted set looks like from the outside, and the
    seventh went red on that very pull request and stayed red for fifteen days.

    Given a diff, every changed artefact that something pins must show its
    derived dependent list, and a dependent that was not updated in the same
    commit is named. The map is the authority; nobody counts."""
    import subprocess
    args = ['git', 'diff', '--name-only'] + rng.split()
    changed = set(subprocess.run(args, cwd=ROOT, capture_output=True, text=True).stdout.split())
    if not changed:
        print(f'  no files changed in {rng} - nothing to enforce'); return 0
    print(f'  {len(changed)} file(s) changed in {rng}')
    missed = []
    touched_any = False
    for art, deps in sorted(pins.items()):
        if art not in changed:
            continue
        touched_any = True
        print(f'\n  PINNED ARTEFACT CHANGED: {art}')
        for d in deps:
            state = 're-pinned in the same commit' if d['gate'] in changed else 'NOT UPDATED'
            print(f"      {d['gate']}:{d['line']}   {state}")
            if d['gate'] not in changed:
                missed.append((art, d['gate']))
    if not touched_any:
        print('  no pinned artefact was changed'); return 0
    if missed:
        print(f'\n  {len(missed)} dependent(s) of a changed pinned artefact were not updated:')
        for art, g in missed:
            print(f'      {g}  still pins the old {art}')
        print('\n  Re-pin them in THIS commit. A ledger updated later than the file it')
        print('  describes is a stale doc with a hash attached.')
        return 1
    print('\n  every dependent of every changed pinned artefact was re-pinned with it')
    return 0

def main():
    pins, unmatched = derive()
    if '--enforce-diff' in sys.argv:
        rng = sys.argv[sys.argv.index('--enforce-diff') + 1]
        print('PIN DEPENDENTS, enforced against a diff')
        return enforce_diff(pins, rng)
    doc = {
        '_derived': 'tools/derive_pin_dependents.py — do not edit by hand',
        '_method': ('every candidate artefact is hashed (sha256 and git blob sha1) and every '
                    'hash literal in every gate is looked up in that table. A literal that '
                    'matches a file IS a pin on it, whatever the surrounding comment claims.'),
        '_why': ('8432492 re-pinned six sibling gates and missed the seventh; apexpool-verify '
                 'then went red on that PR, merged, and stayed red for fifteen days. When a '
                 'change re-pins, the dependents are derived, never counted.'),
        'artefacts': {a: sorted(d, key=lambda x: (x['gate'], x['line'])) for a, d in sorted(pins.items())},
        'unmatchedLiterals': len(unmatched),
    }
    if '--check' in sys.argv:
        if not os.path.exists(OUT):
            print(f'{OUT} is absent — run with --write'); return 1
        cur = json.load(open(OUT))
        if cur.get('artefacts') != doc['artefacts']:
            print('data/pin-dependents.json is not what the estate would derive.')
            a, b = set(cur.get('artefacts', {})), set(doc['artefacts'])
            for x in sorted(b - a): print(f'  + {x}')
            for x in sorted(a - b): print(f'  - {x}')
            for x in sorted(a & b):
                if cur['artefacts'][x] != doc['artefacts'][x]:
                    print(f'  ~ {x}: dependents changed')
            return 1
        print(f"data/pin-dependents.json is current — {len(doc['artefacts'])} pinned artefact(s)")
        return 0
    if '--write' in sys.argv:
        json.dump(doc, open(OUT, 'w'), indent=1)
    print(f"pinned artefacts: {len(doc['artefacts'])}")
    for a, deps in doc['artefacts'].items():
        print(f'  {a}')
        for d in deps:
            print(f"      {d['gate']}:{d['line']}  ({d['algo']})")
    import collections
    kinds = collections.Counter(u['kind'] for u in unmatched)
    print(f"\n  hash literals matching no artefact in this repo: {len(unmatched)}")
    for k, v in kinds.most_common():
        print(f'    {v:>2}  {k}')
    needs = [u for u in unmatched if 'NEEDS A READER' in u['kind']]
    # A literal a human has READ and resolved is recorded here rather than
    # tuned out of the classifier. Tuning until the number reads zero is
    # "raising a threshold until it looks tolerable", which this estate has
    # ruled against; a census that always says 0 is not one anybody trusts.
    resolved = {(r['gate'], r['line']): r['reading'] for r in READER_RESOLVED}
    open_needs = [u for u in needs if (u['gate'], u['line']) not in resolved]
    for u in needs:
        r = resolved.get((u['gate'], u['line']))
        mark = 'RESOLVED' if r else 'OPEN    '
        print(f"        {mark} {u['gate']}:{u['line']}  {u['literal']}")
        if r:
            print(f"                 {r}")
    if '--gate' in sys.argv and open_needs:
        print(f'\n  {len(open_needs)} pin literal(s) nobody has read. Read them, or record the reading.')
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
