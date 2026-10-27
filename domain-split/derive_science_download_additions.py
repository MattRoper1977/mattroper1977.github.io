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


def is_download_registration(row: dict) -> bool:
    """Pure. Is this row a DOWNLOAD registration, as the ruling's words require?

    The ruling says rows are derived from the build's emitted DOWNLOAD hrefs. Selecting on the
    route prefix alone would also sweep in any other row the build emits under that prefix -- and
    the build does emit non-download rows for Science routes (180 of them elsewhere in the tree at
    the time of writing). Registering one of those as a download would be exactly the replay the
    checker's own comment forbids: "add only reviewed download metadata. No historical events,
    counters, configuration or backend data are replayed."
    """
    return (row.get('source') == 'education'
            and row.get('kind') == 'resource'
            and 'download_request' in (row.get('event_types') or []))


def derive(emitted_rows: list[dict], admitted, prefix: str = PREFIX) -> list[dict]:
    """Pure. The reviewed rows for `prefix`, derived from the build's emitted rows.

    emitted_rows : usage-registry.json as the education build wrote it
    admitted     : route -> bool, True when the BUILT BYTES of that route are a digest the
                   publication admission registry admits. Path membership is not enough: the
                   ruling says "files already ADMITTED", and the registry admits by digest.
    """
    picked = [r for r in emitted_rows if r['route'].startswith(prefix)]

    missing = sorted(r['route'] for r in picked if not {'route', 'resource_id'} <= set(r))
    shape = sorted(r['route'] for r in picked if not is_download_registration(r))
    if shape:
        raise Refuse('%d row(s) under the reviewed prefix are not download registrations; '
                     'the first is %s' % (len(shape), shape[0]))

    seen_route, seen_id = {}, {}
    for r in picked:
        if r['route'] in seen_route:
            raise Refuse('the build emits %s twice under the reviewed prefix; a duplicate would '
                         'be registered twice and hidden from the change list' % r['route'])
        if r['resource_id'] in seen_id:
            raise Refuse('two rows share resource_id %s (%s and %s)'
                         % (r['resource_id'][:12], seen_id[r['resource_id']], r['route']))
        seen_route[r['route']] = r
        seen_id[r['resource_id']] = r['route']

    unadmitted = sorted({r['route'] for r in picked if not admitted(r['route'])})
    if unadmitted:
        raise Refuse('%d emitted row(s) name a file the publication registry does not admit by '
                     'digest; the first is %s' % (len(unadmitted), unadmitted[0]))
    if not picked:
        raise Refuse('the build emitted NO row for the reviewed prefix; refusing to blank the '
                     'reviewed list from what may be a stale or partial build')
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
    new, n = PIN_RE.subn(lambda m: m.group(1) + digest + m.group(3), checker_src)
    if n != 1:
        raise Refuse('expected exactly one Science additions pin in the checker, found %d' % n)
    return new


PIN_RE = re.compile(r"(if sha256\(additions_path\.read_bytes\(\)\)\.hexdigest\(\) != ')([0-9a-f]{64})(')")


def pinned_digest(checker_src: str) -> str:
    """Pure. The digest at the Science pin SITE. Searching the whole file for the digest would
    report PASS against the sibling teaching-packs pin, or against the value in a comment."""
    found = PIN_RE.findall(checker_src)
    if len(found) != 1:
        raise Refuse('expected exactly one Science additions pin in the checker, found %d' % len(found))
    return found[0][1]


def admitted_checker(output: Path):
    """route -> bool: the BUILT BYTES of that route are a digest the registry admits."""
    reg = json.loads(ADMISSION.read_text())['trees'][LESSONS_TREE]
    lessons = Path(output) / 'education-lessons'

    def ok(route: str) -> bool:
        rel = route[len('/Lessons/'):]
        adm = reg.get(rel)
        if adm is None:
            return False
        adm = adm if isinstance(adm, list) else [adm]
        f = lessons / rel
        return f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest() in adm

    return ok


def _sandbox(tmp: Path, rows: list[dict], files: dict, pin: str):
    """Build a whole miniature world -- registry, admission, additions file, checker -- and point
    the module's globals at it, so a control can drive the REAL main() end to end instead of a
    convenient inner function. Returns the output directory."""
    out = tmp / 'output'
    (out / 'education-lessons').mkdir(parents=True, exist_ok=True)
    (out / 'usage-registry.json').write_text(json.dumps(rows))
    admitted = {}
    for rel, data in files.items():
        f = out / 'education-lessons' / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(data)
        admitted[rel] = hashlib.sha256(data).hexdigest()
    (tmp / 'admission.json').write_text(json.dumps({'trees': {LESSONS_TREE: admitted}}))
    (tmp / 'checker.py').write_text(
        "    if sha256(additions_path.read_bytes()).hexdigest() != '%s':\n"
        "        return ['Unreviewed Science download registration metadata']\n"
        "TEACHING_PACK_ADDITIONS_SHA256 = '%s'\n" % (pin, 'f' * 64))
    globals()['ADMISSION'] = tmp / 'admission.json'
    globals()['CHECKER'] = tmp / 'checker.py'
    globals()['ADDITIONS'] = tmp / 'additions.json'
    return out


def _run(*argv) -> int:
    """Drive the real main() with a real argv."""
    import contextlib, io
    saved = sys.argv
    sys.argv = ['derive_science_download_additions.py', *argv]
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            return main()
    finally:
        sys.argv = saved


def self_test() -> int:
    import tempfile
    bad = 0
    def check(name, cond):
        nonlocal bad
        print('  [%s] %s' % ('ok' if cond else 'FAIL', name)); bad += 0 if cond else 1

    def row(route, rid, title='t', **kw):
        r = {'source': 'education', 'resource_id': rid, 'title': title, 'route': route,
             'kind': 'resource', 'event_types': ['download_request'], 'aliases': [], 'source_ids': []}
        r.update(kw)
        return r

    a = row(PREFIX + 'BUILD/a.pdf', 'b' * 64)
    b = row(PREFIX + 'GROW/b.pdf', 'a' * 64)
    outside = row('/Lessons/ICT/Teaching_Packs/x.pdf', 'c' * 64)
    yes = lambda route: True

    got = derive([a, b, outside], yes)
    check('every emitted DOWNLOAD row for the prefix is derived, ordered by resource_id',
          [r['route'] for r in got] == [b['route'], a['route']])
    check('a route outside the reviewed prefix is never written here',
          all(not r['route'].startswith('/Lessons/ICT/') for r in got))

    # RED PROOF 1 (ruled): a row for a file the publication registry does not admit is refused.
    try:
        derive([a, b], lambda route: route != b['route'])
        check('RED PROOF 1: a row whose file is not admitted is refused', False)
    except Refuse as x:
        check('RED PROOF 1: a row whose file is not admitted is refused',
              'does not admit' in str(x) and 'GROW/b.pdf' in str(x))

    # A row under the prefix that is NOT a download registration is refused by name.
    for label, bad_row in (('kind', row(PREFIX + 'BUILD/p.html', 'd' * 64, kind='lesson')),
                           ('event type', row(PREFIX + 'BUILD/p.html', 'd' * 64, event_types=['lesson_open'])),
                           ('source', row(PREFIX + 'BUILD/p.html', 'd' * 64, source='backend'))):
        try:
            derive([a, bad_row], yes)
            check('a non-download row (%s) under the prefix is refused' % label, False)
        except Refuse as x:
            check('a non-download row (%s) under the prefix is refused' % label,
                  'not download registrations' in str(x))

    # Duplicates would be registered twice and hidden from the change list.
    try:
        derive([a, dict(a, resource_id='e' * 64)], yes)
        check('a duplicate route is refused', False)
    except Refuse as x:
        check('a duplicate route is refused', 'twice under the reviewed prefix' in str(x))
    try:
        derive([a, dict(b, resource_id=a['resource_id'])], yes)
        check('two rows sharing a resource_id are refused', False)
    except Refuse as x:
        check('two rows sharing a resource_id are refused', 'share resource_id' in str(x))

    # An empty emitted set must never blank the reviewed list.
    try:
        derive([outside], yes)
        check('an empty emitted set is refused, never written as a blank list', False)
    except Refuse as x:
        check('an empty emitted set is refused, never written as a blank list',
              'refusing to blank' in str(x))

    # Adds and removes are both allowed, and both are listed.
    ch = changes([a], [a, b])
    check('an addition is allowed and listed', ch['added'] == [b['route']] and not ch['removed'])
    ch = changes([a, b], [a])
    check('a removal is allowed and listed', ch['removed'] == [b['route']] and not ch['added'])
    ch = changes([a], [dict(a, title='moved')])
    check('a changed field on a kept route is listed', ch['changed'] == [a['route']])

    # The pin is read at its SITE, not anywhere in the file.
    src = ("    if sha256(additions_path.read_bytes()).hexdigest() != '%s':\n"
           "        return ['Unreviewed Science download registration metadata']\n"
           "TEACHING_PACK_ADDITIONS_SHA256 = '%s'\n") % ('0' * 64, 'f' * 64)
    check('the pin is read at the Science pin site', pinned_digest(src) == '0' * 64)
    out = repin(src, '1' * 64)
    check('RED PROOF 3: re-pinning moves the Science pin', pinned_digest(out) == '1' * 64)
    check('...and leaves the sibling pack pin alone', "'%s'" % ('f' * 64) in out)
    try:
        repin('no pin here\n', '1' * 64)
        check('a checker with no Science pin is refused', False)
    except Refuse as x:
        check('a checker with no Science pin is refused', 'exactly one' in str(x))

    # --- END-TO-END, driving the REAL main(): write, then the ruled --check refusals.
    saved = (ADDITIONS, CHECKER, ADMISSION)
    try:
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            data = {'Science_Teesside/Teaching_Packs/BUILD/a.pdf': b'A',
                    'Science_Teesside/Teaching_Packs/GROW/b.pdf': b'B'}
            out_dir = _sandbox(tmp, [a, b, outside], data, '0' * 64)
            ADDITIONS.write_bytes(serialise([]))
            check('end to end: --write writes the derivation and pins it',
                  _run('--output', str(out_dir), '--write') == 0
                  and len(json.loads(ADDITIONS.read_text())) == 2
                  and pinned_digest(CHECKER.read_text()) == hashlib.sha256(ADDITIONS.read_bytes()).hexdigest())
            check('end to end: --check passes on what --write just produced',
                  _run('--output', str(out_dir), '--check') == 0)

            # RED PROOF 2 (ruled), now against the REAL --check: a hand-typed row reds.
            typed = json.loads(ADDITIONS.read_text())
            typed[0]['title'] = 'typed by hand'
            ADDITIONS.write_bytes(serialise(typed))
            check('RED PROOF 2: a hand-typed row makes --check RED (exit 1)',
                  _run('--output', str(out_dir), '--check') == 1)

            # A stale pin at the SITE reds, even though the digest appears elsewhere in the file.
            _run('--output', str(out_dir), '--write')
            good = hashlib.sha256(ADDITIONS.read_bytes()).hexdigest()
            CHECKER.write_text(repin(CHECKER.read_text(), '9' * 64) + '\n# %s\n' % good)
            check('a stale pin reds even when the right digest appears elsewhere in the checker',
                  _run('--output', str(out_dir), '--check') == 1)

            # Removals need the deliberate flag; without it nothing is written.
            _sandbox(tmp, [a, b, outside], data, '0' * 64)
            ADDITIONS.write_bytes(serialise([]))
            _run('--output', str(out_dir), '--write')
            before = ADDITIONS.read_bytes()
            smaller = _sandbox(tmp, [a, outside], data, pinned_digest(CHECKER.read_text()))
            ADDITIONS.write_bytes(before)
            check('a removal without --allow-removals refuses and writes nothing',
                  _run('--output', str(smaller), '--write') == 1 and ADDITIONS.read_bytes() == before)
            check('the same removal with --allow-removals is written',
                  _run('--output', str(smaller), '--write', '--allow-removals') == 0
                  and len(json.loads(ADDITIONS.read_text())) == 1)
    finally:
        globals()['ADDITIONS'], globals()['CHECKER'], globals()['ADMISSION'] = saved

    total = 22
    print('derive_science_download_additions self-test: %d of %d controls ok, %d FAIL'
          % (total - bad, total, bad))
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--output', help='the education build output directory')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--check', action='store_true', help='report only; exit 1 if the file is not the derivation')
    ap.add_argument('--allow-removals', action='store_true',
                    help='permit rows to leave the reviewed list; they are printed for the PR body')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    if not a.output:
        ap.error('--output is required unless --self-test')

    rows = json.loads((Path(a.output) / 'usage-registry.json').read_text())
    try:
        new = derive(rows, admitted_checker(a.output))
    except Refuse as x:
        print('[FAIL] ' + str(x)); return 1
    old = json.loads(ADDITIONS.read_text())
    ch = changes(old, new)
    body = serialise(new)
    digest = hashlib.sha256(body).hexdigest()
    print('SCOPE: %d emitted download row(s) for %s; the reviewed file holds %d'
          % (len(new), PREFIX, len(old)))
    print('  added %d, removed %d, changed %d; derived digest %s'
          % (len(ch['added']), len(ch['removed']), len(ch['changed']), digest[:12]))
    for kind in ('added', 'removed', 'changed'):
        for r in ch[kind]:
            print('    %-8s %s' % (kind.upper(), r))

    if a.check:
        on_disk = ADDITIONS.read_bytes()
        if on_disk != body:
            print('[FAIL] the reviewed file is not this derivation; re-run with --write'); return 1
        try:
            pinned = pinned_digest(CHECKER.read_text())
        except Refuse as x:
            print('[FAIL] ' + str(x)); return 1
        if pinned != hashlib.sha256(on_disk).hexdigest():
            print('[FAIL] the checker pins %s at its Science pin site, but the reviewed file is %s'
                  % (pinned[:12], hashlib.sha256(on_disk).hexdigest()[:12])); return 1
        print('[PASS] the reviewed file equals the derivation and the Science pin site carries its digest')
        return 0

    if a.write:
        # REMOVALS ARE ALLOWED BUT NEVER SILENT. A stale, partial or wrong --output would drop
        # reviewed registrations and re-pin the smaller file, and the separation check would then
        # pass on that same build. Removing therefore takes a deliberate flag, and the removed
        # routes are printed above for the PR body.
        if ch['removed'] and not a.allow_removals:
            print('[FAIL] %d row(s) would be REMOVED from the reviewed list. If that is intended, '
                  're-run with --allow-removals and list them in the PR body; if it is not, the '
                  'build at --output is stale or partial.' % len(ch['removed']))
            return 1
        # Compute the re-pinned checker BEFORE touching anything, so a refusal cannot leave the
        # file moved and the pin stale.
        try:
            repinned = repin(CHECKER.read_text(), digest)
        except Refuse as x:
            print('[FAIL] ' + str(x) + '; nothing written'); return 1
        ADDITIONS.write_bytes(body)
        CHECKER.write_text(repinned)
        print('[DONE] %d row(s) written and pinned (%s). BASIS: %s' % (len(new), digest[:12], BASIS))
    else:
        print('  DRY RUN — re-run with --write')
    return 0


if __name__ == '__main__':
    sys.exit(main())
