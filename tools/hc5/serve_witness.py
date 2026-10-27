#!/usr/bin/env python3
"""HC5 D7 serve witness: publication is not served until the origin's bytes say so.

For each estate publication (site, lessons, apps, games) this fetches the
review artifact of the successful, source-bound publication run for the
repository's current main (tools/lib/publication_artifacts.py, the same
selector the FieldOps serve proof uses — precedent artifact 10016325373), then
fetches a fixed set of subject routes from the serving origin and compares
bytes. A repository is WITNESSED only when every subject matches; one mismatch
is RED; an unreachable route or a missing exact-source publication is
INCONCLUSIVE, never green. The Humanities teaching-pack routes are subjects so
HC5 §1.6 closes on the same instrument.

    serve_witness.py --site S --lessons L --apps A --shelf G --output DIR
    serve_witness.py --self-test          # planted mismatch red, restored green
"""
import argparse, hashlib, json, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
import publication_artifacts as pa

EDU = 'https://madebymatt.uk'
PLAY = 'https://madebymatt-play.uk'
# route -> file inside the review artifact (relative to the tree root)
SUBJECTS = {
    'site': {EDU + '/': 'index.html', EDU + '/for/teachers/': 'for/teachers/index.html',
             EDU + '/stats/on-this-device/': 'stats/on-this-device/index.html', EDU + '/tools/': 'tools/index.html'},
    'lessons': {EDU + '/Lessons/': 'index.html',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/': 'Humanities_Teesside/Teaching_Packs/index.html',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/BUILD/START_HERE_BUILD_Humanities_Autumn1.pdf': 'Humanities_Teesside/Teaching_Packs/BUILD/START_HERE_BUILD_Humanities_Autumn1.pdf',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/GROW/START_HERE_GROW_Humanities_Autumn1.pdf': 'Humanities_Teesside/Teaching_Packs/GROW/START_HERE_GROW_Humanities_Autumn1.pdf',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/LAUNCH/START_HERE_LAUNCH_Humanities_Autumn1.pdf': 'Humanities_Teesside/Teaching_Packs/LAUNCH/START_HERE_LAUNCH_Humanities_Autumn1.pdf',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/BUILD/Week_3/BUILD_Humanities_Autumn1_W3_Community_Places.pptx': 'Humanities_Teesside/Teaching_Packs/BUILD/Week_3/BUILD_Humanities_Autumn1_W3_Community_Places.pptx',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/GROW/Week_3/GROW_Humanities_Autumn1_W3_Cause_Consequence_Pupil.docx': 'Humanities_Teesside/Teaching_Packs/GROW/Week_3/GROW_Humanities_Autumn1_W3_Cause_Consequence_Pupil.docx',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/LAUNCH/Week_3/LAUNCH_Humanities_Autumn1_W3_Archive_Evaluation_Teacher.pdf': 'Humanities_Teesside/Teaching_Packs/LAUNCH/Week_3/LAUNCH_Humanities_Autumn1_W3_Archive_Evaluation_Teacher.pdf',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/BUILD/downloads/BUILD_Humanities_Autumn1_W3-W7_Complete_Pack.zip': 'Humanities_Teesside/Teaching_Packs/BUILD/downloads/BUILD_Humanities_Autumn1_W3-W7_Complete_Pack.zip',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/GROW/downloads/GROW_Humanities_Autumn1_W3-W7_Complete_Pack.zip': 'Humanities_Teesside/Teaching_Packs/GROW/downloads/GROW_Humanities_Autumn1_W3-W7_Complete_Pack.zip',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/LAUNCH/downloads/LAUNCH_Humanities_Autumn1_W3-W7_Complete_Pack.zip': 'Humanities_Teesside/Teaching_Packs/LAUNCH/downloads/LAUNCH_Humanities_Autumn1_W3-W7_Complete_Pack.zip',
                EDU + '/Lessons/Science_Teesside/Teaching_Packs/': 'Science_Teesside/Teaching_Packs/index.html',
                # HC6 §11 (D7): the teaching-pack layer — landing, the seven subject indexes, one pack index,
                # one beside-placed FoodWise lesson and one Complete pack, so a served run witnesses the layer
                # itself and not only its Humanities corner.
                EDU + '/Lessons/Teaching_Packs/': 'Teaching_Packs/index.html',
                EDU + '/Lessons/Careers/Teaching_Packs/': 'Careers/Teaching_Packs/index.html',
                EDU + '/Lessons/ICT/Teaching_Packs/': 'ICT/Teaching_Packs/index.html',
                EDU + '/Lessons/DT_Textiles/Teaching_Packs/': 'DT_Textiles/Teaching_Packs/index.html',
                EDU + '/Lessons/BUILD_ASDAN/FoodWise/Teaching_Packs/': 'BUILD_ASDAN/FoodWise/Teaching_Packs/index.html',
                EDU + '/Lessons/GROW_FoodWise/Teaching_Packs/': 'GROW_FoodWise/Teaching_Packs/index.html',
                EDU + '/Lessons/PSHE/Teaching_Packs/': 'PSHE/Teaching_Packs/index.html',
                EDU + '/Lessons/Science_Teesside/Teaching_Packs/web-slides.html': 'Science_Teesside/Teaching_Packs/web-slides.html',
                EDU + '/Lessons/Humanities_Teesside/Teaching_Packs/web-slides.html': 'Humanities_Teesside/Teaching_Packs/web-slides.html',
                EDU + '/Lessons/Careers/Teaching_Packs/BUILD/': 'Careers/Teaching_Packs/BUILD/index.html',
                EDU + '/Lessons/BUILD_ASDAN/FoodWise/BUILD_FOOD_W1.html': 'BUILD_ASDAN/FoodWise/BUILD_FOOD_W1.html',
                EDU + '/Lessons/PSHE/Teaching_Packs/GROW/downloads/GROW_PSHE_All_About_Me_W1-W7_Complete_Pack.zip': 'PSHE/Teaching_Packs/GROW/downloads/GROW_PSHE_All_About_Me_W1-W7_Complete_Pack.zip'},
    'apps': {EDU + '/Matt-s-Apps-/': 'index.html'},
    'games': {PLAY + '/': 'index.html', PLAY + '/Games/games.json': 'Games/games.json'},
}
SUBJECT_COUNT = sum(len(v) for v in SUBJECTS.values())


class _RecordHops(urllib.request.HTTPRedirectHandler):
    """urllib follows redirects silently, so the witness only ever saw where it
    landed, never how. The named www allowance below turns on the SHAPE of the
    redirect -- one hop, permanent -- so the hops have to be recorded to be
    asserted. A fetcher that cannot report them yields no hops, and no hops means
    the allowance is not granted."""

    def __init__(self):
        super().__init__()
        self.hops = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.hops.append((code, newurl))
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, timeout=60):
    recorder = _RecordHops()
    opener = urllib.request.build_opener(recorder)
    req = urllib.request.Request(url, headers={'User-Agent': 'mbm-serve-witness', 'Cache-Control': 'no-cache'})
    with opener.open(req, timeout=timeout) as response:
        final = response.geturl()
        return response.status, final, response.read(), list(recorder.hops)


def www_label_only(url, final):
    """(i) The landed URL differs from the declared one by the www label and nothing
    else: same scheme, same path, same query, and a host that is exactly the declared
    host with `www.` in front. Apex -> www only, which is the direction that was
    measured; www -> apex is a different claim and is not granted here."""
    a, b = urllib.parse.urlsplit(url), urllib.parse.urlsplit(final)
    return (a.scheme == b.scheme and a.path == b.path and a.query == b.query
            and b.netloc.lower() == 'www.' + a.netloc.lower())


PERMANENT_REDIRECTS = (301, 308)


def witness(kind, publication, fetcher=fetch):
    """Compare served bytes to the review artifact for every subject of one kind."""
    root = Path(publication['root'])
    rows = []
    for url, relative in SUBJECTS[kind].items():
        expected_path = root / relative
        row = {'url': url, 'artifact_file': relative}
        if not expected_path.exists():
            # A subject the publication does not carry yet (e.g. the Humanities
            # packs before their admission) is INCONCLUSIVE, not a mismatch.
            row.update(verdict='INCONCLUSIVE', reason='artifact lacks the subject file'); rows.append(row); continue
        expected = expected_path.read_bytes()
        try:
            fetched = fetcher(url)
            status, final, served = fetched[0], fetched[1], fetched[2]
            # A fetcher that cannot report the redirect shape reports none, and no hops
            # means the www allowance below cannot be satisfied. Unknown is not allowed.
            hops = list(fetched[3]) if len(fetched) > 3 else []
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as error:
            row.update(verdict='INCONCLUSIVE', reason='fetch failed: ' + str(error)[:120]); rows.append(row); continue
        row.update(http=status, final_url=final, served_bytes=len(served), expected_bytes=len(expected),
                   served_sha256=hashlib.sha256(served).hexdigest(), expected_sha256=hashlib.sha256(expected).hexdigest())
        if status != 200:
            row['verdict'] = 'INCONCLUSIVE'; row['reason'] = 'HTTP ' + str(status)
        elif urllib.parse.urlsplit(final).netloc != urllib.parse.urlsplit(url).netloc:
            # Host equality stays the default. ONE named allowance, and each of its three
            # legs is asserted separately so a row can never qualify on two of them:
            #   (i)   the landed host differs from the declared one by the www label alone
            #   (ii)  exactly one hop, and it is permanent
            #   (iii) the bytes are byte-identical to the publication artifact
            # Measured 2026-09-17: madebymatt-play.uk landed on www.madebymatt-play.uk with
            # identical bytes, which the old rule reported as a foreign origin. Anything
            # that is not all three legs is still RED, and the reason names the legs that
            # failed rather than hiding them behind one sentence.
            legs = {'wwwLabelOnly': www_label_only(url, final),
                    'singlePermanentHop': len(hops) == 1 and hops[0][0] in PERMANENT_REDIRECTS,
                    'bytesIdentical': served == expected}
            row['wwwAllowance'] = legs
            if all(legs.values()):
                row['verdict'] = 'MATCH'
                row['reason'] = 'www host of the declared origin: one permanent hop, bytes identical'
            else:
                row['verdict'] = 'RED'
                row['reason'] = ('served from another origin ('
                                 + ', '.join(sorted(k for k, v in legs.items() if not v)) + ' not satisfied)')
        elif served != expected:
            row['verdict'] = 'RED'; row['reason'] = 'served bytes differ from the publication artifact'
        else:
            row['verdict'] = 'MATCH'
        rows.append(row)
    verdicts = [r['verdict'] for r in rows]
    if any(v == 'RED' for v in verdicts): overall = 'RED'
    elif all(v == 'MATCH' for v in verdicts): overall = 'WITNESSED'
    else: overall = 'INCONCLUSIVE'
    return {'kind': kind, 'verdict': overall, 'source_sha': publication['source_sha'], 'publication_run': publication['run_id'],
            'artifact_id': publication['artifact_id'], 'artifact_sha256': publication['artifact_sha256'],
            'subjects': len(rows), 'matched': verdicts.count('MATCH'), 'rows': rows}


def summary_line(row):
    """One subject's line. FIN1 F, reporting only: verdicts and exit codes are
    unchanged. The Play rows have been RED as "served from another origin" since
    2026-09-14 with served and expected bytes IDENTICAL, so the one fact that
    decides whether that is a benign apex-to-host redirect or a genuinely wrong
    origin is the final URL -- which the row has carried in the JSON all along and
    the summary never printed. The agent container cannot reach either origin, so
    the instrument has to say it: a gate that reds without naming what it measured
    sends its reader to an artifact they may not be able to open."""
    landed = row.get('final_url')
    where = f"  landed={landed}" if landed and landed != row['url'] else ''
    return (f"    {row['verdict']:12s} {row['url']}  http={row.get('http')}"
            f"  served={row.get('served_bytes')}B/{str(row.get('served_sha256', ''))[:8]}"
            f"  expected={row.get('expected_bytes')}B/{str(row.get('expected_sha256', ''))[:8]}"
            f"{where}  {row.get('reason', '')}")


def self_test():
    """The instrument must go red on one planted byte and green again when it is removed."""
    import tempfile
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp) / 'apps'; root.mkdir(); (root / 'index.html').write_bytes(b'<html>real</html>')
        pub = {'root': str(root), 'source_sha': 'a' * 40, 'run_id': 1, 'artifact_id': 1, 'artifact_sha256': 'sha256:x'}
        served = {EDU + '/Matt-s-Apps-/': (200, EDU + '/Matt-s-Apps-/', b'<html>real</html>')}
        real = witness('apps', pub, lambda u: served[u])
        assert real['verdict'] == 'WITNESSED', real
        planted = witness('apps', pub, lambda u: (200, u, b'<html>real</html>\n'))
        assert planted['verdict'] == 'RED', planted
        moved = witness('apps', pub, lambda u: (200, 'https://elsewhere.invalid/x', b'<html>real</html>'))
        assert moved['verdict'] == 'RED', moved
        missing = witness('apps', pub, lambda u: (404, u, b''))
        assert missing['verdict'] == 'INCONCLUSIVE', missing
        def boom(u): raise urllib.error.URLError('down')
        assert witness('apps', pub, boom)['verdict'] == 'INCONCLUSIVE'
        restored = witness('apps', pub, lambda u: served[u])
        assert restored['verdict'] == 'WITNESSED'
        # The redirect the summary has to name. Same URL in and out -> no landed=;
        # a different final URL -> landed= carries it, and the verdict is untouched
        # either way. Without both halves the report could be blank on exactly the
        # RED it exists to explain.
        assert 'landed=' not in summary_line(real['rows'][0]), summary_line(real['rows'][0])
        assert 'landed=https://elsewhere.invalid/x' in summary_line(moved['rows'][0]), summary_line(moved['rows'][0])
        assert moved['rows'][0]['verdict'] == 'RED' and real['rows'][0]['verdict'] == 'MATCH'
        # The named www allowance, and the ways it must still red. Every leg is asserted
        # on its own so no row can ever qualify on two of the three.
        www = EDU.replace('https://', 'https://www.') + '/Matt-s-Apps-/'
        body = b'<html>real</html>'
        granted = witness('apps', pub, lambda u: (200, www, body, [(301, www)]))
        assert granted['verdict'] == 'WITNESSED', granted
        assert granted['rows'][0]['wwwAllowance'] == {'wwwLabelOnly': True, 'singlePermanentHop': True,
                                                      'bytesIdentical': True}, granted['rows'][0]

        def leg_failed(result, leg):
            row = result['rows'][0]
            return result['verdict'] == 'RED' and row['wwwAllowance'][leg] is False and leg in row['reason']

        assert leg_failed(witness('apps', pub, lambda u: (200, 'https://www.elsewhere.invalid/Matt-s-Apps-/', body, [(301, 'x')])), 'wwwLabelOnly')
        assert leg_failed(witness('apps', pub, lambda u: (200, www, body, [(301, 'a'), (301, www)])), 'singlePermanentHop')
        assert leg_failed(witness('apps', pub, lambda u: (200, www, body, [(302, www)])), 'singlePermanentHop')
        assert leg_failed(witness('apps', pub, lambda u: (200, www, body + b'!', [(301, www)])), 'bytesIdentical')
        # A fetcher that reports no hops cannot satisfy leg (ii): unknown is not allowed.
        assert leg_failed(witness('apps', pub, lambda u: (200, www, body)), 'singlePermanentHop')

        (root / 'index.html').unlink()
        assert witness('apps', pub, lambda u: served[u])['verdict'] == 'INCONCLUSIVE'
    # Exit codes, asserted on synthetic reports. A witness that exits 0 while a row
    # says INCONCLUSIVE is the failure mode this suite exists to prevent.
    def report_of(*verdicts):
        return {'repositories': {str(i): {'verdict': v} for i, v in enumerate(verdicts)}}
    assert exit_code(report_of('WITNESSED', 'WITNESSED')) == 0, 'all witnessed must exit 0'
    assert exit_code(report_of('WITNESSED', 'INCONCLUSIVE')) == 2, 'an INCONCLUSIVE row must exit 2'
    assert exit_code(report_of('WITNESSED', 'RED')) == 1, 'a RED row must exit 1'
    assert exit_code(report_of('INCONCLUSIVE', 'RED')) == 1, 'RED outranks INCONCLUSIVE'

    # A newer failed run must not mask an older success for the same source.
    picked = []

    class _Github:
        deadline = float('inf')

        def __init__(self, runs):
            self.runs = runs

        def read(self, path, raw=False):
            if '/runs?' in path:
                return {'workflow_runs': self.runs}
            if path.endswith('/jobs?per_page=100'):
                return {'jobs': [{'name': 'deploy', 'conclusion': 'success'}]}
            if '/artifacts?' in path:
                # prepare_one has committed to a run by the time it asks for its
                # artifacts, so the id in this path IS the selection under test.
                picked.append(int(path.split('/actions/runs/')[1].split('/')[0]))
                raise pa.Inconclusive('stop after selection')
            raise AssertionError('unexpected read: ' + path)

    sha = 'c' * 40
    newest_failed = {'id': 2, 'head_sha': sha, 'head_branch': 'main', 'event': 'push',
                     'status': 'completed', 'conclusion': 'cancelled', 'html_url': 'u2'}
    older_success = {'id': 1, 'head_sha': sha, 'head_branch': 'main', 'event': 'push',
                     'status': 'completed', 'conclusion': 'success', 'html_url': 'u1'}
    try:
        pa.prepare_one('apps', sha, Path(tempfile.gettempdir()) / 'unused', _Github([newest_failed, older_success]))
    except pa.Inconclusive:
        pass
    assert picked == [1], f'a newer cancelled run masked the older success: picked {picked}'

    print('self-test PASS: real WITNESSED -> planted byte RED -> foreign origin RED -> 404 INCONCLUSIVE -> unreachable INCONCLUSIVE -> restored WITNESSED -> absent subject INCONCLUSIVE -> a redirect is named in the summary, a non-redirect is not -> INCONCLUSIVE exits 2, RED exits 1, RED outranks -> a newer cancelled run does not mask an older success -> the www allowance grants only on all three legs, and reds on a foreign domain, a multi-hop chain, a temporary redirect and differing bytes')


def exit_code(report):
    """RED and INCONCLUSIVE are different failures and must not share a code.

    This returned 0 unless some row was RED, so a run where nothing could be
    measured at all reported success. It did exactly that on 2026-09-17: two of
    four publications INCONCLUSIVE, exit 0, and the run read as green. A witness
    that cannot see is not a witness that agrees. RED wins over INCONCLUSIVE
    because a proven mismatch is the more urgent fact.
    """
    verdicts = [r['verdict'] for r in report['repositories'].values()]
    if 'RED' in verdicts:
        return 1
    if 'INCONCLUSIVE' in verdicts:
        return 2
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    for key in ['site', 'lessons', 'apps', 'shelf', 'output']:
        parser.add_argument('--' + key, type=Path)
    parser.add_argument('--wait-seconds', type=int, default=120)
    args = parser.parse_args()
    if args.self_test:
        self_test(); return 0
    roots = {'site': args.site, 'lessons': args.lessons, 'apps': args.apps, 'games': args.shelf}
    if any(v is None for v in roots.values()) or args.output is None:
        parser.error('--site --lessons --apps --shelf --output are required (or --self-test)')
    github = pa.GitHub(time.monotonic() + args.wait_seconds)
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'version': 1, 'subjects_total': SUBJECT_COUNT, 'repositories': {}, 'witnessed': 0}
    for kind, root in roots.items():
        wanted = pa.head(root)
        try:
            publication = pa.prepare_one(kind, wanted, args.output / 'publications', github)
            result = witness(kind, publication)
        except pa.Inconclusive as error:
            result = {'kind': kind, 'verdict': 'INCONCLUSIVE', 'source_sha': wanted, 'reason': str(error), 'subjects': len(SUBJECTS[kind]), 'matched': 0, 'rows': []}
        report['repositories'][kind] = result
        report['witnessed'] += int(result['verdict'] == 'WITNESSED')
        print(f"{kind:8s} {result['verdict']:12s} {result['matched']}/{result['subjects']} subjects  main {wanted[:8]}  {result.get('reason', '')}", flush=True)
        for row in result.get('rows', []):
            if row['verdict'] != 'MATCH':   # every non-match names itself in the log, not only in the artifact
                print(summary_line(row), flush=True)
    (args.output / 'serve-witness.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"SERVE WITNESS: byte-witnessed {report['witnessed']}/4 publications; {SUBJECT_COUNT} subjects; report {args.output / 'serve-witness.json'}")
    return exit_code(report)


if __name__ == '__main__':
    sys.exit(main())
