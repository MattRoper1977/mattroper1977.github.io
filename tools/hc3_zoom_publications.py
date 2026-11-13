#!/usr/bin/env python3
"""Recover the precise deployed bytes and canonical HC3 zoom-change population."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.parse import unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from publication_artifacts import GitHub, head, prepare_one, require

ROOT = Path(__file__).resolve().parents[1]


def changed_html(github, repo, number):
    prefix = '/repos/MattRoper1977/' + repo
    pr = github.read(prefix + f'/pulls/{number}')
    require(pr.get('merged_at'), f'{repo}#{number} is not merged')
    files = []
    for page in range(1, 31):
        batch = github.read(prefix + f'/pulls/{number}/files?per_page=100&page={page}')
        files.extend(batch)
        if len(batch) < 100:
            break
    require(len(files) == pr['changed_files'], f'{repo}#{number}: incomplete changed-file population')
    return {row['filename'] for row in files if row['filename'].endswith('.html')}, {
        'repository': repo, 'pr': number, 'merged_at': pr['merged_at'],
        'merge_sha': pr['merge_commit_sha'], 'head_sha': pr['head']['sha']}


def app_files(value):
    result = set()
    if isinstance(value, dict):
        f = value.get('f')
        if isinstance(f, str) and not urlsplit(f).scheme:
            result.add(unquote(urlsplit(f).path).lstrip('/'))
        for item in value.values():
            result.update(app_files(item))
    elif isinstance(value, list):
        for item in value:
            result.update(app_files(item))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apps', type=Path, required=True)
    parser.add_argument('--games', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    github = GitHub(time.monotonic() + 300)
    sources = {'apps': head(args.apps), 'games': head(args.games)}
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending = {kind: pool.submit(prepare_one, kind, sha, args.output, github)
                   for kind, sha in sources.items()}
        publications = {kind: task.result() for kind, task in pending.items()}
    files, history = set(), []
    for pr in (37, 38, 39, 40):
        changed, record = changed_html(github, 'Matt-s-Apps-', pr)
        files.update(changed); history.append(record)
    canonical = app_files(json.loads((args.apps / 'apps.json').read_text()))
    require(files <= canonical, 'Changed Apps routes absent from canonical apps.json: ' + str(files - canonical))
    rows = [{'kind': 'apps', 'route': '/Matt-s-Apps-/' + f, 'relative': f,
             'origin': 'https://madebymatt.uk'} for f in sorted(files)]
    census = json.loads((ROOT / 'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    for repo, pr, owner in [('mattroper1977.github.io', 278, 'Site'), ('Lessons', 350, 'Lessons')]:
        changed, record = changed_html(github, repo, pr); history.append(record)
        for file in sorted(changed):
            matches = [row for row in census if row['source']['repository'] == owner and row['source']['path'] == file]
            alias = False
            if not matches and owner == 'Site':
                # The game builder copies the owning Site game directory in full.
                # Retain historical variant HTML such as MedevacFrontier_v1.html;
                # substituting its canonical index would test a different file.
                matches = [row for row in census if row['source']['repository'] == owner
                           and Path(row['source']['path']).parent == Path(file).parent]
                alias = True
            require(len(matches) == 1, f'{repo}/{file}: expected one canonical game owner')
            route = '/' + file if alias else unquote(matches[0]['normalizedDecodedRoute'])
            relative = route.lstrip('/')
            if relative.endswith('/'):
                relative += 'index.html'
            rows.append({'kind': 'games', 'route': route, 'relative': relative,
                         'origin': 'https://madebymatt-play.uk',
                         'canonical_owner': matches[0]['normalizedDecodedRoute'],
                         'published_variant': alias})
    require(len({row['origin']+row['route'] for row in rows}) == len(rows), 'Duplicate route population')
    require(sum(row['kind'] == 'apps' for row in rows) == 19, 'Historical Apps population changed')
    require(sum(row['kind'] == 'games' for row in rows) == 7, 'Historical game population changed')
    for row in rows:
        root = Path(publications[row['kind']]['root'])
        file = root / row['relative']
        require(file.is_file(), 'Published file missing: ' + row['route'])
        row['sha256'] = hashlib.sha256(file.read_bytes()).hexdigest()
        row['bytes'] = file.stat().st_size
    report = {'scope': 'Exact deployed publications; read-only browser checks, not candidate content',
              'instrument_sha': head(ROOT), 'publications': publications,
              'population_manifests': ['Apps/apps.json', 'Site/reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json'],
              'historical_changes': history, 'rows': rows}
    (args.output / 'zoom-publications.json').write_text(json.dumps(report, indent=2)+'\n')
    print(f'Bound {len(rows)} routes to successful source/deploy/artifact identities')


if __name__ == '__main__':
    main()
