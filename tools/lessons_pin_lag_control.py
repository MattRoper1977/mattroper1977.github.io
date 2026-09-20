#!/usr/bin/env python3
"""Lag control over every Lessons pin this repository carries, measured against a
Lessons checkout, plus two cross-estate controls that had no home of their own.

WHY. Six Lessons pins sat in this repository's workflows and each moved, or did
not, on its own. domain-split-verify.yml said its pin was "held EQUAL to Lessons
main" while it sat at b54c9006 and the publication carrier built main, so one gate
hashed one Lessons state and another hashed another, and check_education_
separation.py's single baseline_sha could satisfy neither (ORDER SX3-PASSES, the
sixth-pin discharge). The comment was a claim; nothing measured it. This does, for
the whole population at once, so the next drift is a red line and not a reading.

POPULATION - DERIVED, NEVER TYPED. The order that asked for this called it the
six-pin control: four b54c9006 pins and two carrier pins. This tool does not know
the number six. It scans every .github/workflows/*.yml for a step that checks out
MattRoper1977/Lessons with a 40-hex ref, plain or as the || fallback of an
expression, prints what it found, and controls all of it. Whatever the count is
on the day is the count it prints.

CONTROLS. Each prints its scope before its result.
  P1  the pin resolves in the Lessons checkout            (a transcribed SHA)
  P2  the pin is an ancestor of the Lessons main ref       (a rewritten branch)
  P3  a naming line within the census window - the SAME window and the SAME
      words as tools/census_typed_literals.py, so a pin cannot pass one census
      and fail the other
  P4  lag: commits behind the ref, and which changed paths this repository
      PUBLISHES - membership in domain-split/education-publication-admission.json
      trees.education-lessons, the registry that names every published Lessons
      path. A pin whose contiguous comment block declares it EQUAL (that word, in
      capitals: the estate's convention for the invariant) is RED when a
      published path moved between it and the ref. Every other pin is reported,
      not failed: "one step behind" is that pin's stated policy
      (splash-region-records.yml says so at its second checkout).
  P5  every EQUAL-declared pin is one and the same commit
  G1  the cross-estate gate copies, Lessons and Apps, are byte-identical
      (NOT RUN without --apps, with the reason printed - never PASS by absence)
  C1  the Lessons typed-literal census gap. Lessons carries no
      census_typed_literals.py, so nothing there asks a typed literal why it is
      there. This control does the two things that census would do to the
      carrier: the caller digest the gate TYPES for kind "lessons" must equal
      sha256 of the carrier's bytes, and every hex literal in the carrier must
      be named.

WIRED INTO NO WORKFLOW (ORDER FINISH S4: written, self-tested, run by hand).
  python3 tools/lessons_pin_lag_control.py --lessons DIR [--ref origin/main] [--apps DIR] [--json OUT]
  python3 tools/lessons_pin_lag_control.py --self-test
Exit 1 on any RED; the self-test exits 1 unless every planted fault fires its own
control and nothing else.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEX40 = re.compile(r'(?<![0-9a-f])([0-9a-f]{40})(?![0-9a-f])')
HEX = re.compile(r'(?<![0-9a-f])([0-9a-f]{40}|[0-9a-f]{64})(?![0-9a-f])')
# Verbatim from tools/census_typed_literals.py: 12 lines back, 3 forward, these words.
NAMED = re.compile(r'\b(pinned|pin\b|delivered|expected|frozen|canonical|immutable|'
                   r'historical|previous|as at|taken on|ledger|contract)\b', re.I)
LESSONS_REPO = re.compile(r'^\s*repository:\s*MattRoper1977/Lessons\s*$')
GATE_COPY = 'tools/verify_cross_estate_unification.py'
CARRIER = '.github/workflows/education-pages.yml'
CENSUS = 'tools/census_typed_literals.py'
REGISTRY = 'domain-split/education-publication-admission.json'


def git(cwd, *args):
    p = subprocess.run(['git', '-C', cwd, *args], capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def census_window(lines, n):
    """n is the 1-based line of the literal. Same slice as census_typed_literals.py."""
    return '\n'.join(lines[max(0, n - 12):n + 3])


def comment_block(lines, n):
    """The contiguous comment lines directly above 1-based line n."""
    out = []
    i = n - 2
    while i >= 0 and re.match(r'\s*#', lines[i]):
        out.append(lines[i])
        i -= 1
    return '\n'.join(reversed(out))


def find_pins(site_root):
    """P0: every Lessons checkout ref in the workflows. Literal pins and non-literal refs both listed."""
    pins, others = [], []
    wf_dir = os.path.join(site_root, '.github', 'workflows')
    files = sorted(f for f in os.listdir(wf_dir) if f.endswith('.yml') or f.endswith('.yaml'))
    for fn in files:
        rel = os.path.join('.github', 'workflows', fn)
        lines = open(os.path.join(wf_dir, fn), encoding='utf-8').read().split('\n')
        for i, line in enumerate(lines):
            if not LESSONS_REPO.match(line):
                continue
            for j in range(i + 1, min(i + 80, len(lines))):
                if re.match(r'\s*-\s', lines[j]) or re.match(r'\s*repository:', lines[j]):
                    break
                m = re.match(r'^\s*ref:\s*(.*)$', lines[j])
                if not m:
                    continue
                n = j + 1
                hexes = HEX40.findall(m.group(1))
                if hexes:
                    block = comment_block(lines, n)
                    pins.append(dict(rel=rel, line=n, sha=hexes[0], ref_text=m.group(1).strip(),
                                     named=bool(NAMED.search(census_window(lines, n))),
                                     equal=bool(re.search(r'\bEQUAL\b', block))))
                else:
                    others.append(dict(rel=rel, line=n, ref_text=m.group(1).strip()))
                break
    return files, pins, others


def resolve_ref(lessons, ref):
    for candidate in (ref, 'main'):
        rc, out, _ = git(lessons, 'rev-parse', '--verify', '--quiet', candidate + '^{commit}')
        if rc == 0:
            return candidate, out
    return None, None


def run(site_root, lessons, ref='origin/main', apps=None, registry_path=None, out=print):
    reds = []
    report = dict(pins=[], others=[], controls={})

    files, pins, others = find_pins(site_root)
    out(f'P0 population  scope: {len(files)} workflow files under .github/workflows; a pin is a step '
        f'checking out MattRoper1977/Lessons whose ref carries a 40-hex literal')
    for p in pins:
        out(f'   pin  {p["rel"]}:{p["line"]}  {p["sha"][:12]}  named={"yes" if p["named"] else "NO"}  '
            f'declared-EQUAL={"yes" if p["equal"] else "no"}')
    for o in others:
        out(f'   ref  {o["rel"]}:{o["line"]}  not a literal: {o["ref_text"][:60]}')
    out(f'   found {len(pins)} literal pins, {len(others)} non-literal refs')
    report['pins'], report['others'] = pins, others

    ref_name, ref_sha = resolve_ref(lessons, ref)
    if not ref_sha:
        reds.append(f'lessons ref {ref} (and main) does not resolve in {lessons}')
        out(f'RED  the Lessons ref {ref} does not resolve in {lessons}')
        return reds, report
    out(f'Lessons checkout {lessons}  ref {ref_name} = {ref_sha[:12]}')

    if registry_path is None:
        registry_path = os.path.join(site_root, REGISTRY)
    registry = json.load(open(registry_path, encoding='utf-8'))
    published = set(registry['trees']['education-lessons'])
    out(f'P1-P5  scope: {len(pins)} pins against {ref_name}; published paths = '
        f'{len(published)} entries of {os.path.relpath(registry_path, site_root)} trees.education-lessons')
    equal_shas = set()
    for p in pins:
        tag = f'{p["rel"]}:{p["line"]} {p["sha"][:12]}'
        rc, _, _ = git(lessons, 'cat-file', '-e', p['sha'] + '^{commit}')
        p['resolves'] = rc == 0
        if not p['resolves']:
            reds.append(f'P1 {tag}: does not resolve in the Lessons checkout')
            out(f'RED  P1 {tag}: unknown to the Lessons checkout (transcribed?)')
            continue
        rc, _, _ = git(lessons, 'merge-base', '--is-ancestor', p['sha'], ref_sha)
        p['ancestor'] = rc == 0
        if not p['ancestor']:
            reds.append(f'P2 {tag}: not an ancestor of {ref_name}')
            out(f'RED  P2 {tag}: not an ancestor of {ref_name} (rewritten or unmerged branch)')
        if not p['named']:
            reds.append(f'P3 {tag}: no naming line in the census window')
            out(f'RED  P3 {tag}: no line within 12 above says what it pins or when')
        _, behind, _ = git(lessons, 'rev-list', '--count', f'{p["sha"]}..{ref_sha}')
        _, changed, _ = git(lessons, 'diff', '--name-only', p['sha'], ref_sha)
        changed = [c for c in changed.split('\n') if c]
        moved = sorted(c for c in changed if c in published)
        p.update(behind=int(behind or 0), changed=len(changed), published_moved=moved)
        line = (f'     P4 {tag}: {p["behind"]} commits behind {ref_name}, {len(changed)} paths changed, '
                f'{len(moved)} published')
        if p['equal']:
            equal_shas.add(p['sha'])
            if moved:
                reds.append(f'P4 {tag}: declared EQUAL but {len(moved)} published paths moved: {moved[:5]}')
                out('RED ' + line[4:] + '  <- declared EQUAL; published paths moved: ' + ', '.join(moved[:5]))
            else:
                out(line + '  EQUAL holds (no published path moved)')
        else:
            out(line + '  (reported; this pin declares no equality)')
    if len(equal_shas) > 1:
        reds.append(f'P5 EQUAL-declared pins disagree: {sorted(s[:12] for s in equal_shas)}')
        out(f'RED  P5 the EQUAL-declared pins are not one commit: {sorted(s[:12] for s in equal_shas)}')
    elif equal_shas:
        out(f'     P5 EQUAL-declared pins agree: {next(iter(equal_shas))[:12]}')

    lg = os.path.join(lessons, GATE_COPY)
    if apps:
        ag = os.path.join(apps, GATE_COPY)
        out(f'G1  scope: sha256 of {GATE_COPY} in {lessons} and {apps}')
        if not (os.path.exists(lg) and os.path.exists(ag)):
            reds.append('G1 a gate copy is missing')
            out('RED  G1 a gate copy is missing')
        else:
            a, b = sha256(lg), sha256(ag)
            report['controls']['G1'] = dict(lessons=a, apps=b)
            if a != b:
                reds.append(f'G1 gate copies differ: lessons {a[:12]} apps {b[:12]}')
                out(f'RED  G1 gate copies differ: lessons {a[:12]} apps {b[:12]}')
            else:
                out(f'     G1 gate copies byte-identical at {a[:12]}')
    else:
        out('G1  NOT RUN: no --apps checkout given, so byte-identity of the gate copies was not measured')
        report['controls']['G1'] = 'NOT RUN: no --apps'

    out(f'C1  scope: {CENSUS} present in the Lessons checkout?; the "lessons" caller digest typed in '
        f'{GATE_COPY} against sha256({CARRIER}); every hex literal in {CARRIER} named (census rule)')
    gap = not os.path.exists(os.path.join(lessons, CENSUS))
    out(f'     C1 typed-literal census on Lessons: {"ABSENT - the gap this control stands in for" if gap else "present"}')
    carrier = os.path.join(lessons, CARRIER)
    if not os.path.exists(carrier) or not os.path.exists(lg):
        reds.append('C1 carrier or gate copy missing in the Lessons checkout')
        out('RED  C1 carrier or gate copy missing')
    else:
        actual = sha256(carrier)
        gate_text = open(lg, encoding='utf-8').read()
        m = re.search(r'PUBLICATION_CALLER_SHA256_BY_KIND\s*=\s*\{(.*?)\n\}', gate_text, re.S)
        typed = re.search(r'"lessons"\s*:\s*"([0-9a-f]{64})"', m.group(1)) if m else None
        if not typed:
            reds.append('C1 no "lessons" entry in PUBLICATION_CALLER_SHA256_BY_KIND')
            out('RED  C1 the gate copy types no "lessons" caller digest')
        elif typed.group(1) != actual:
            reds.append(f'C1 caller digest stale: typed {typed.group(1)[:12]} actual {actual[:12]}')
            out(f'RED  C1 caller digest typed {typed.group(1)[:12]} != sha256(carrier) {actual[:12]}')
        else:
            out(f'     C1 caller digest {actual[:12]} equals sha256 of the carrier bytes')
        clines = open(carrier, encoding='utf-8').read().split('\n')
        unnamed = []
        total = 0
        for n, line in enumerate(clines, 1):
            for hm in HEX.finditer(line):
                total += 1
                if not NAMED.search(census_window(clines, n)):
                    unnamed.append((n, hm.group(1)[:12]))
        if unnamed:
            reds.append(f'C1 {len(unnamed)} unnamed hex literals in the carrier: {unnamed[:4]}')
            out(f'RED  C1 {len(unnamed)} of {total} hex literals in the carrier have no naming line: {unnamed[:4]}')
        else:
            out(f'     C1 {total} hex literals in the carrier, all named')
        report['controls']['C1'] = dict(census_gap=gap, carrier_sha256=actual, unnamed=unnamed, total=total)
    return reds, report


# ---------------------------------------------------------------- self-test
def _w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def _commit(repo, msg):
    git(repo, 'add', '-A')
    git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg)
    return git(repo, 'rev-parse', 'HEAD')[1]


def _carrier_text(site_sha):
    return ('name: pub\n'
            'jobs:\n  p:\n    steps:\n'
            f'      # Pinned to the Site carrier {site_sha}\n'
            f'      - uses: MattRoper1977/mattroper1977.github.io/.github/workflows/x.yml@{site_sha}\n')


def _gate_text(carrier_sha256):
    return ('X = 1\n'
            'PUBLICATION_CALLER_SHA256_BY_KIND = {\n'
            f'    "lessons": "{carrier_sha256}",\n'
            '}\n')


def _fixture(tmp):
    lessons = os.path.join(tmp, 'lessons')
    os.makedirs(lessons)
    git(lessons, 'init', '-q', '-b', 'main')
    site_sha = 'a' * 40
    _w(os.path.join(lessons, CARRIER), _carrier_text(site_sha))
    _w(os.path.join(lessons, GATE_COPY), _gate_text(sha256(os.path.join(lessons, CARRIER))))
    _w(os.path.join(lessons, 'Science/x.html'), '<h1>x</h1>\n')
    _w(os.path.join(lessons, '_sx3/LEDGER.md'), 'ledger\n')
    base = _commit(lessons, 'base')
    _w(os.path.join(lessons, 'Science/x.html'), '<h1>x2</h1>\n')
    pub = _commit(lessons, 'published change')
    _w(os.path.join(lessons, '_sx3/LEDGER.md'), 'ledger\nmore\n')
    docs = _commit(lessons, 'docs only')
    git(lessons, 'checkout', '-q', '-b', 'side', base)
    _w(os.path.join(lessons, 'side.txt'), 'side\n')
    side = _commit(lessons, 'side')
    git(lessons, 'checkout', '-q', 'main')
    apps = os.path.join(tmp, 'apps')
    _w(os.path.join(apps, GATE_COPY), open(os.path.join(lessons, GATE_COPY)).read())
    site = os.path.join(tmp, 'site')
    _w(os.path.join(site, REGISTRY), json.dumps({'trees': {'education-lessons': {'Science/x.html': 'd'}}}))
    _w(os.path.join(site, '.github/workflows/a.yml'), _site_yml(pub, base))
    return dict(lessons=lessons, apps=apps, site=site, base=base, docs=docs, pub=pub, side=side)


def _site_yml(equal_sha, plain_sha, plain_named=True, extra_equal=None):
    y = ('jobs:\n  a:\n    steps:\n'
         '      - uses: actions/checkout@v4\n        with:\n          repository: MattRoper1977/Lessons\n'
         '          # HELD EQUAL TO LESSONS MAIN.\n'
         f'          # Pinned 2026-01-01 to Lessons {equal_sha[:8]}.\n'
         f'          ref: ${{{{ github.sha || \'{equal_sha}\' }}}}\n'
         '      - uses: actions/checkout@v4\n        with:\n          repository: MattRoper1977/Lessons\n')
    if plain_named:
        y += '          # Pinned 2026-01-01 to the capture source, one step behind by policy.\n'
    else:
        # Push the first step's naming line out of this literal's 12-line window,
        # as the real workflows keep their steps apart, then say nothing useful.
        y += '          # step notes, line %d of twelve\n' * 12 % tuple(range(1, 13))
        y += '          # this comment says nothing about why the literal is here\n'
    y += f'          ref: {plain_sha}\n'
    if extra_equal:
        y += ('      - uses: actions/checkout@v4\n        with:\n          repository: MattRoper1977/Lessons\n'
              '          # HELD EQUAL TO LESSONS MAIN. Pinned 2026-01-01.\n'
              f'          ref: {extra_equal}\n')
    return y


def self_test():
    problems = []

    def case(name, mutate, expect):
        tmp = tempfile.mkdtemp(prefix='lagctl-')
        try:
            fx = _fixture(tmp)
            mutate(fx)
            reds, _ = run(fx['site'], fx['lessons'], 'main', fx['apps'], out=lambda *_: None)
            fired = sorted({r.split(' ')[0] for r in reds})
            ok = fired == sorted(expect)
            print(f'  {"PASS" if ok else "FAIL"}  {name}: fired {fired or "nothing"}, expected {sorted(expect) or "nothing"}')
            if not ok:
                problems.append(name + ' -> ' + '; '.join(reds))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def yml(fx, **kw):
        _w(os.path.join(fx['site'], '.github/workflows/a.yml'), _site_yml(**kw))

    case('positive control: EQUAL pin one docs-only commit behind, plain pin behind a published change',
         lambda fx: None, [])
    case('P1 a transcribed SHA that nothing resolves',
         lambda fx: yml(fx, equal_sha=fx['pub'], plain_sha='0123456789abcdef0123456789abcdef01234567'), ['P1'])
    case('P2 a pin on a side branch, not an ancestor of main',
         lambda fx: yml(fx, equal_sha=fx['pub'], plain_sha=fx['side']), ['P2'])
    case('P3 the naming line removed from the census window',
         lambda fx: yml(fx, equal_sha=fx['pub'], plain_sha=fx['base'], plain_named=False), ['P3'])
    case('P4 an EQUAL-declared pin behind a published change',
         lambda fx: yml(fx, equal_sha=fx['base'], plain_sha=fx['base']), ['P4'])
    case('P5 two EQUAL-declared pins on different commits',
         lambda fx: yml(fx, equal_sha=fx['pub'], plain_sha=fx['base'], extra_equal=fx['docs']), ['P5'])
    case('G1 the Apps gate copy differs by one byte',
         lambda fx: _w(os.path.join(fx['apps'], GATE_COPY), open(os.path.join(fx['lessons'], GATE_COPY)).read() + '#'), ['G1'])

    def stale(fx):
        _w(os.path.join(fx['lessons'], GATE_COPY), _gate_text('f' * 64))
        _w(os.path.join(fx['apps'], GATE_COPY), _gate_text('f' * 64))
        _commit(fx['lessons'], 'stale digest')
    case('C1 the typed caller digest no longer equals the carrier bytes', stale, ['C1'])

    def unnamed(fx):
        _w(os.path.join(fx['lessons'], CARRIER), _carrier_text('a' * 40).replace('      # Pinned to the Site carrier ' + 'a' * 40 + '\n', ''))
        _w(os.path.join(fx['lessons'], GATE_COPY), _gate_text(sha256(os.path.join(fx['lessons'], CARRIER))))
        _w(os.path.join(fx['apps'], GATE_COPY), open(os.path.join(fx['lessons'], GATE_COPY)).read())
        _commit(fx['lessons'], 'unnamed literal')
    case('C1 a hex literal in the carrier with no naming line', unnamed, ['C1'])

    tmp = tempfile.mkdtemp(prefix='lagctl-')
    try:
        fx = _fixture(tmp)
        lines = []
        reds, rep = run(fx['site'], fx['lessons'], 'main', None, out=lines.append)
        ok = not reds and rep['controls'].get('G1', '').startswith('NOT RUN') and any('NOT RUN' in l for l in lines)
        print(f'  {"PASS" if ok else "FAIL"}  G1 without --apps prints NOT RUN with its reason, never PASS')
        if not ok:
            problems.append('G1 NOT RUN')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if problems:
        print('SELF-TEST FAIL:', *problems, sep='\n  ')
        return 1
    print('SELF-TEST PASS: every planted fault fired its own control and nothing else')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--lessons', help='path to a Lessons checkout (refs fetched)')
    ap.add_argument('--ref', default='origin/main', help='the Lessons main ref to measure against (default origin/main, then main)')
    ap.add_argument('--apps', help='path to a Matt-s-Apps- checkout, for G1')
    ap.add_argument('--site', default=ROOT, help='this repository (default: the checkout this file is in)')
    ap.add_argument('--json', help='write the measured report here')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.lessons:
        ap.error('--lessons DIR is required (or --self-test)')
    reds, report = run(os.path.abspath(a.site), os.path.abspath(a.lessons), a.ref,
                       os.path.abspath(a.apps) if a.apps else None)
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(dict(reds=reds, **report), f, indent=1)
    print(f'RESULT: {"RED " + str(len(reds)) if reds else "PASS"}  ({len(report["pins"])} pins controlled)')
    return 1 if reds else 0


if __name__ == '__main__':
    sys.exit(main())
