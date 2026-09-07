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
                EDU + '/Lessons/Science_Teesside/Teaching_Packs/': 'Science_Teesside/Teaching_Packs/index.html'},
    'apps': {EDU + '/Matt-s-Apps-/': 'index.html'},
    'games': {PLAY + '/': 'index.html', PLAY + '/Games/games.json': 'Games/games.json'},
}
SUBJECT_COUNT = sum(len(v) for v in SUBJECTS.values())


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': 'mbm-serve-witness', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        final = response.geturl()
        return response.status, final, response.read()


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
            status, final, served = fetcher(url)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as error:
            row.update(verdict='INCONCLUSIVE', reason='fetch failed: ' + str(error)[:120]); rows.append(row); continue
        row.update(http=status, final_url=final, served_bytes=len(served), expected_bytes=len(expected),
                   served_sha256=hashlib.sha256(served).hexdigest(), expected_sha256=hashlib.sha256(expected).hexdigest())
        if status != 200:
            row['verdict'] = 'INCONCLUSIVE'; row['reason'] = 'HTTP ' + str(status)
        elif urllib.parse.urlsplit(final).netloc != urllib.parse.urlsplit(url).netloc:
            row['verdict'] = 'RED'; row['reason'] = 'served from another origin'
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
        (root / 'index.html').unlink()
        assert witness('apps', pub, lambda u: served[u])['verdict'] == 'INCONCLUSIVE'
    print('self-test PASS: real WITNESSED -> planted byte RED -> foreign origin RED -> 404 INCONCLUSIVE -> unreachable INCONCLUSIVE -> restored WITNESSED -> absent subject INCONCLUSIVE')


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
                print(f"    {row['verdict']:12s} {row['url']}  http={row.get('http')}  served={row.get('served_bytes')}B/{str(row.get('served_sha256', ''))[:8]}  expected={row.get('expected_bytes')}B/{str(row.get('expected_sha256', ''))[:8]}  {row.get('reason', '')}", flush=True)
    (args.output / 'serve-witness.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f"SERVE WITNESS: byte-witnessed {report['witnessed']}/4 publications; {SUBJECT_COUNT} subjects; report {args.output / 'serve-witness.json'}")
    return 0 if all(r['verdict'] != 'RED' for r in report['repositories'].values()) else 1


if __name__ == '__main__':
    sys.exit(main())
