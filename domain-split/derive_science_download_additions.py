#!/usr/bin/env python3
"""STOP-F3, OPTION 1 (Matt Roper, 2026-09-22) — derive and pin the reviewed Science download
registrations from the served estate.

WHY THIS EXISTS
---------------
check_education_separation.py holds the Science Teaching_Packs download registrations as a
digest-pinned reviewed list, and asserts the education build emits EXACTLY those rows. Until now
nothing derived that list: it could only be transcribed, so a hub that legitimately began linking
more of the packs it already ships had no remedy but a hand edit. SCI-COMPLETE PASS F is that case
-- HUB-1 S3's "Packs & downloads" section links each pack's manifest members, all of them files
the publication already serves.

THE RULE, as ruled
------------------
A row is derived from the education build's OWN emitted download rows for the reviewed prefix, and
only for a file the publication admission registry already ADMITS. Nothing is typed:

  * a row whose file is not admitted in education-publication-admission.json  -> REFUSED;
  * a row typed by hand (the file on disk differs from the derivation)        -> RED on --check;
  * adds and removes are both allowed, and every one is printed so it can be
    listed in the PR body;
  * a route outside the reviewed prefix is never written here -- the sibling pack list
    (teaching-packs-download-usage-additions.json) is not this tool's business;
  * the file's digest is re-pinned in check_education_separation.py in the same pass, so the
    checker's own "Unreviewed Science download registration metadata" refusal still stands for
    any edit this tool did not make.

BASIS, recorded per run and carried into the PR body:
  download registrations derived from the served estate under HUB-1 S3, signed by
  Matt Roper 2026-09-22 (pre-signed with the PASS F table)

  derive_science_download_additions.py --output domain-split/output [--write]
  derive_science_download_additions.py --output domain-split/output --check
  derive_science_download_additions.py --self-test
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADDITIONS = HERE / 'science-download-usage-additions.json'
CHECKER = HERE / 'check_education_separation.py'
ADMISSION = HERE / 'education-publication-admission.json'
PREFIX = '/Lessons/Science_Teesside/Teaching_Packs/'
LESSONS_TREE = 'education-lessons'
BASIS = ('download registrations derived from the served estate under HUB-1 S3, '
         'signed by Matt Roper 2026-09-22 (pre-signed with the PASS F table)')
# The checker compares sha256(ADDITIONS) against this literal; the name is matched, never the value.
PIN_NAME = 'Unreviewed Science download registration metadata'


class Refuse(Exception):
    pass


def serialise(rows: list[dict]) -> bytes:
    """The file's exact shape, measured from the reviewed file: indent 2, unescaped, one
    trailing newline, rows ordered by resource_id. Reproducing it byte-for-byte is what lets
    --check mean 'nobody hand-edited this'."""
    ordered = sorted(rows, key=lambda r: r['resource_id'])
    return (json.dumps(ordered, ensure_ascii=False, indent=2) + '\n').encode()


def derive(emitted_rows: list[dict], admitted: set[str], prefix: str = PREFIX) -> list[dict]:
    """Pure. The reviewed rows for `prefix`, derived from the build's emitted rows.

    emitted_rows : usage-registry.json as the education build wrote it
    admitted     : the published paths the admission registry admits, repo-relative
    """
    picked = [r for r in emitted_rows if r['route'].startswith(prefix)]
    unadmitted = sorted({r['route'] for r in picked if r['route'][len('/Lessons/'):] not in admitted})
    if unadmitted:
        raise Refuse('%d emitted row(s) name a file the publication registry does not admit; '
                     'the first is %s' % (len(unadmitted), unadmitted[0]))
    return sorted(picked, key=lambda r: r['resource_id'])


def changes(old: list[dict], new: list[dict]) -> dict:
    """Pure. What moved, by route, so the PR body can list every one."""
    ko = {r['route']: r for r in old}
    kn = {r['route']: r for r in new}
    return {
        'added': sorted(set(kn) - set(ko)),
        'removed': sorted(set(ko) - set(kn)),
        'changed': sorted(k for k in set(ko) & set(kn) if ko[k] != kn[k]),
    }


def repin(checker_src: str, digest: str) -> str:
    """Pure. The checker source with the additions pin moved to `digest`, and nothing else."""
    pat = re.compile(r"(if sha256\(additions_path\.read_bytes\(\)\)\.hexdigest\(\) != ')([0-9a-f]{64})(')")
    new, n = pat.subn(lambda m: m.group(1) + digest + m.group(3), checker_src)
    if n != 1:
        raise Refuse('expected exactly one Science additions pin in the checker, found %d' % n)
    return new


def load_admitted(path: Path = ADMISSION) -> set[str]:
    return set(json.loads(path.read_text())['trees'][LESSONS_TREE])


def self_test() -> int:
    bad = 0
    def check(name, cond):
        nonlocal bad
        print('  [%s] %s' % ('ok' if cond else 'FAIL', name)); bad += 0 if cond else 1

    def row(route, rid, title='t'):
        return {'source': 'education', 'resource_id': rid, 'title': title, 'route': route,
                'kind': 'resource', 'event_types': ['download_request'], 'aliases': [], 'source_ids': []}

    a = row(PREFIX + 'BUILD/a.pdf', 'b' * 64)
    b = row(PREFIX + 'GROW/b.pdf', 'a' * 64)
    outside = row('/Lessons/ICT/Teaching_Packs/x.pdf', 'c' * 64)
    admitted = {'Science_Teesside/Teaching_Packs/BUILD/a.pdf', 'Science_Teesside/Teaching_Packs/GROW/b.pdf',
                'ICT/Teaching_Packs/x.pdf'}

    got = derive([a, b, outside], admitted)
    check('every emitted row for the prefix is derived, ordered by resource_id',
          [r['route'] for r in got] == [b['route'], a['route']])
    check('a route outside the reviewed prefix is never written here',
          all(not r['route'].startswith('/Lessons/ICT/') for r in got))

    # RED PROOF 1 (ruled): a row for a file the publication registry does not admit is refused.
    try:
        derive([a, b], {'Science_Teesside/Teaching_Packs/BUILD/a.pdf'})
        check('RED PROOF 1: a row whose file is not admitted is refused', False)
    except Refuse as x:
        check('RED PROOF 1: a row whose file is not admitted is refused',
              'does not admit' in str(x) and 'GROW/b.pdf' in str(x))

    # RED PROOF 2 (ruled): a row typed by hand reds on --check, because --check compares the
    # file's BYTES with the derivation's bytes.
    derived_bytes = serialise(got)
    tampered = json.loads(derived_bytes)
    tampered[0]['title'] = 'typed by hand'
    check('RED PROOF 2: a hand-typed row makes the file differ from the derivation',
          serialise(tampered) != derived_bytes)
    check('a file that matches the derivation is equal byte-for-byte',
          serialise(json.loads(derived_bytes)) == derived_bytes)

    # Adds and removes are both allowed, and both are listed.
    ch = changes([a], [a, b])
    check('an addition is allowed and listed', ch['added'] == [b['route']] and not ch['removed'])
    ch = changes([a, b], [a])
    check('a removal is allowed and listed', ch['removed'] == [b['route']] and not ch['added'])
    ch = changes([a], [dict(a, title='moved')])
    check('a changed field on a kept route is listed', ch['changed'] == [a['route']])

    # RED PROOF 3: the pin follows the file, and only the Science pin moves.
    src = ("    if sha256(additions_path.read_bytes()).hexdigest() != '%s':\n"
           "        return ['Unreviewed Science download registration metadata']\n"
           "TEACHING_PACK_ADDITIONS_SHA256 = '%s'\n") % ('0' * 64, 'f' * 64)
    out = repin(src, '1' * 64)
    check('RED PROOF 3: re-pinning moves the Science pin', "'%s'" % ('1' * 64) in out)
    check('...and leaves the sibling pack pin alone', "'%s'" % ('f' * 64) in out)
    try:
        repin("no pin here\n", '1' * 64)
        check('a checker with no Science pin is refused', False)
    except Refuse as x:
        check('a checker with no Science pin is refused', 'exactly one' in str(x))

    print('derive_science_download_additions self-test: %d of %d controls ok, %d FAIL'
          % (11 - bad, 11, bad))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--output', help='the education build output directory')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--check', action='store_true', help='report only; exit 1 if the file is not the derivation')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.output:
        ap.error('--output is required unless --self-test')

    rows = json.loads((Path(a.output) / 'usage-registry.json').read_text())
    try:
        new = derive(rows, load_admitted())
    except Refuse as x:
        print('[FAIL] ' + str(x)); return 1
    old = json.loads(ADDITIONS.read_text())
    ch = changes(old, new)
    body = serialise(new)
    digest = hashlib.sha256(body).hexdigest()
    print('SCOPE: %d emitted row(s) for %s; the reviewed file holds %d'
          % (len(new), PREFIX, len(old)))
    print('  added %d, removed %d, changed %d; derived digest %s'
          % (len(ch['added']), len(ch['removed']), len(ch['changed']), digest[:12]))
    for kind in ('added', 'removed', 'changed'):
        for r in ch[kind]:
            print('    %-8s %s' % (kind.upper(), r))
    if a.check:
        if ADDITIONS.read_bytes() != body:
            print('[FAIL] the reviewed file is not this derivation; re-run with --write'); return 1
        if hashlib.sha256(ADDITIONS.read_bytes()).hexdigest() not in CHECKER.read_text():
            print('[FAIL] the checker does not pin the reviewed file\'s current digest'); return 1
        print('[PASS] the reviewed file equals the derivation and the checker pins it'); return 0
    if a.write:
        ADDITIONS.write_bytes(body)
        try:
            CHECKER.write_text(repin(CHECKER.read_text(), digest))
        except Refuse as x:
            print('[FAIL] ' + str(x)); return 1
        print('[DONE] %d row(s) written and pinned (%s). BASIS: %s' % (len(new), digest[:12], BASIS))
    else:
        print('  DRY RUN — re-run with --write')
    return 0


if __name__ == '__main__':
    sys.exit(main())
