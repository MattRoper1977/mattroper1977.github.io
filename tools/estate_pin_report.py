"""Read-only pin age from the canonical Play builder's actual source inputs."""
import ast
import base64
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {'site_commit': 'mattroper1977.github.io', 'lessons_commit': 'Lessons'}


def publication_inputs(root=ROOT, builder_text=None, census_loader=None):
    builder = ast.parse(builder_text if builder_text is not None else (root / 'domain-split/build_publications.py').read_text())
    census_assignment = next(n for n in builder.body if isinstance(n, ast.Assign)
                             and any(isinstance(t, ast.Name) and t.id == 'CENSUS' for t in n.targets))
    census_path = next(n.value for n in ast.walk(census_assignment.value)
                       if isinstance(n, ast.Constant) and isinstance(n.value, str))
    rows = (census_loader(census_path) if census_loader else json.loads((root / census_path).read_text()))['rows']
    inputs = {'mattroper1977.github.io': {'files': set(), 'directories': set()},
              'Lessons': {'files': set(), 'directories': set()}}
    for row in rows:
        source = row['source']
        target = inputs['mattroper1977.github.io' if source['repository'] == 'Site' else 'Lessons']
        path = Path(source['path'])
        target['files'].add(path.as_posix())
        target['directories'].add((path.parent if source['repository'] == 'Site' else path.parent / 'vendor').as_posix() + '/')
    # These two literal loops are the builder's copied shared assets. Read the
    # call site, not a separate hand-maintained URL or dependency table.
    found = set()
    for node in ast.walk(builder):
        if not isinstance(node, ast.For) or not isinstance(node.target, ast.Name):
            continue
        if node.target.id not in {'directory', 'name'} or not isinstance(node.iter, ast.List):
            continue
        values = [n.value for n in node.iter.elts if isinstance(n, ast.Constant) and isinstance(n.value, str)]
        if len(values) != len(node.iter.elts):
            raise ValueError('Play copied-input loop is no longer a literal list')
        found.add(node.target.id)
        field = 'directories' if node.target.id == 'directory' else 'files'
        inputs['mattroper1977.github.io'][field].update(v + '/' if field == 'directories' else v for v in values)
    if found != {'directory', 'name'}:
        raise ValueError('Play copied-input loops changed; pin measurement needs review')
    return inputs


def touches(paths, inputs):
    return sorted({p for p in paths if p in inputs['files'] or any(p.startswith(d) for d in inputs['directories'])})


def commit_paths(api, repo, sha):
    paths = set()
    for page in range(1, 32):
        result = api(f'/repos/MattRoper1977/{repo}/commits/{sha}?per_page=100&page={page}')
        rows = result.get('files', [])
        for row in rows:
            paths.add(row['filename'])
            if row.get('previous_filename'):
                paths.add(row['previous_filename'])
        if len(rows) < 100:
            return paths
    raise ValueError(f'{repo}/{sha}: GitHub changed-file pagination was not complete')


def rows(api, now=None, inputs=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    supplied_inputs = inputs is not None
    inputs = inputs or publication_inputs()
    raw = api('/repos/MattRoper1977/Games/contents/play-publication.json')
    pins = json.loads(base64.b64decode(raw['content']))
    if not supplied_inputs:
        # A removed route must still count through the published pin's census.
        # Read its own builder and census so a later rename cannot erase it.
        def pinned_text(path):
            item = api(f'/repos/MattRoper1977/mattroper1977.github.io/contents/{path}?ref={pins["site_commit"]}')
            return base64.b64decode(item['content']).decode('utf-8')
        previous = publication_inputs(builder_text=pinned_text('domain-split/build_publications.py'),
                                      census_loader=lambda path: json.loads(pinned_text(path)))
        for repo in inputs:
            for field in inputs[repo]:
                inputs[repo][field].update(previous[repo][field])
    result = []
    for key, repo in SOURCES.items():
        pin = pins[key]
        head = api(f'/repos/MattRoper1977/{repo}/commits/main')['sha']
        commits = []
        page = 1
        while True:
            comparison = api(f'/repos/MattRoper1977/{repo}/compare/{pin}...{head}?per_page=100&page={page}')
            if comparison.get('status') not in {'identical', 'ahead'}:
                raise ValueError(f'{repo}: source is not descended from its published pin')
            part = comparison.get('commits', [])
            commits.extend(part)
            if len(part) < 100:
                break
            page += 1
        if len(commits) != comparison['ahead_by'] or len({c['sha'] for c in commits}) != len(commits):
            raise ValueError(f'{repo}: incomplete or duplicate compare history')
        game_commits, builder_commits = [], []
        for commit in commits:
            paths = commit_paths(api, repo, commit['sha'])
            selected = touches(paths, inputs[repo])
            stamp = datetime.datetime.fromisoformat(commit['commit']['committer']['date'].replace('Z', '+00:00'))
            entry = {'sha': commit['sha'], 'committedAt': stamp.isoformat(), 'ageDays': round((now-stamp).total_seconds()/86400, 3)}
            if selected:
                game_commits.append({**entry, 'paths': selected})
            builder_paths = sorted(p for p in paths if repo == 'mattroper1977.github.io' and
                                   (p.startswith('domain-split/') or p == 'data/source-manifests/games.json'))
            if builder_paths:
                builder_commits.append({**entry, 'paths': builder_paths})
        result.append({'source': repo, 'pin': pin, 'head': head, 'all_commits_behind': len(commits),
                       'game_commits_behind': len(game_commits),
                       'oldest_game_age': max((c['ageDays'] for c in game_commits), default=None),
                       'game_commits': game_commits, 'publication_commits': builder_commits})
    return result


def stale(rows, days):
    return [r for r in rows if r['game_commits_behind'] and r['oldest_game_age'] is not None and r['oldest_game_age'] > days]
