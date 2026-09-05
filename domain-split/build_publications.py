#!/usr/bin/env python3
"""Build the real games payload and an education front-page integration overlay.

No source-repository or DNS mutations. Outputs are deliberately separate.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import build_preview

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CENSUS = ROOT / "reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def put(root, path, data):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(data, encoding="utf-8")


def copy_file(source, output, relative):
    if not source.is_file():
        raise ValueError(f"Required file missing: {source}")
    destination = output / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def normal(route):
    path = unquote(urlparse(route).path)
    return path.removesuffix("index.html").rstrip("/") or "/"


def source_head(root):
    return subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()


def game_output_path(row):
    route = unquote(urlparse(row["normalizedDecodedRoute"]).path).lstrip("/")
    return route + "index.html" if route.endswith("/") else route


class RuntimeRefs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {"script", "img", "audio", "video", "source", "iframe"} and a.get("src"):
            self.refs.append(a["src"])
        if tag == "link" and a.get("rel") in {"stylesheet", "icon", "manifest", "preload"} and a.get("href"):
            self.refs.append(a["href"])


def render_page(preview, kind, origin, config):
    start = preview.index('<section class="view' + (' game-view' if kind == "games" else '') + '" id="view-' + kind + '"')
    possible = [n for n in [preview.find('<section class="view', start + 20), preview.find('</main>', start)] if n >= 0]
    body = preview[start:min(possible)].strip()
    body = re.sub(r'(<section class="view[^>]+) hidden>', r'\1>', body, count=1)
    views = {"home": "/", "teachers": "/for/teachers/", "pupils": "/for/pupils/", "games": "/"}
    body = re.sub(r'href="#(home|teachers|pupils|games)" data-view="\1"', lambda m: 'href="' + views[m[1]] + '"', body)
    body = re.sub(r'href="#[^"]*" data-search-link="(teachers|pupils)" data-query="([^"]*)"',
                  lambda m: 'href="' + views[m[1]] + '?q=' + m[2] + '#' + ('teacher-search' if m[1] == 'teachers' else 'pupil-search') + '"', body)
    body = re.sub(r' data-jump="[^"]*"', '', body)
    science_cards = ''.join('<a class="route-card" href="' + p["route"] + '"><h3>' + p["name"] + ' Science</h3><p>Choose a term, week and lesson.</p><span class="text-link">Open the lesson menu</span></a>' for p in config["science_pathways"])
    science_links = ''.join('<a href="' + p["route"] + '">' + p["name"] + ' Science</a>' for p in config["science_pathways"])
    body = body.replace('<div class="cards-3" data-science-cards></div>', '<div class="cards-3">' + science_cards + '</div>')
    body = body.replace('<div class="pathways" data-science-links></div>', '<div class="pathways">' + science_links + '</div>')
    body = body.replace('This preview uses the current website’s search catalogue. The final move will take the latest published lesson updates.', 'Choose the subject and pathway used by your class.')
    body = body.replace('Play on the current site ↗', 'Play game').replace('titles on the current games shelf', 'games on the shelf')
    body = body.replace('Play links open the current games. Your saved progress stays with the existing website.', 'Previously played on madebymatt.uk? Browser saves do not transfer automatically to this address. Your existing data remains in that browser at the old address.')
    if kind == "games":
        body = body.replace(config["source_origin"], origin)
        body = body.replace('</footer>', '<div class="wrap"><a href="/privacy/">Privacy and saved progress</a></div></footer>')
        body = body.replace('<footer class="footer">', '<div class="section"><div class="wrap"><h2>Classroom activities</h2><div class="results" id="classroom-activities"></div><h2>For staff</h2><p class="game-note">Professional development activities for teachers and education staff.</p><div class="results" id="staff-activities"></div></div></div><footer class="footer">')
    else:
        body = body.replace('</footer>', '<div class="wrap"><a href="/privacy/">Privacy</a></div></footer>')
        if kind == "teachers":
            body = body.replace('<a href="#teacher-search"', '<a href="/tools/">Teacher tools</a><a href="/account/">Account</a><a href="#teacher-search"', 1)
    for old, new in [("Learning homepage preview", "Learning homepage"), ("Teacher homepage preview", "Teacher homepage"), ("Pupil homepage preview", "Pupil homepage"), ("Games homepage preview", "Games homepage")]:
        body = body.replace(old, new)
    titles = {"home": "Find your next lesson · Made by Matt", "teachers": "Teachers · Made by Matt Learning", "pupils": "Pupils · Made by Matt Learning", "games": "Made by Matt Games"}
    css = re.search(r'<style>(.*?)</style>', preview, re.S)[1]
    path = views[kind]
    dataset = 'games' if kind == 'games' else 'education'
    return ('<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="theme-color" content="#161d3d"><title>' + titles[kind] + '</title>'
            '<meta name="description" content="' + titles[kind] + '">'
            '<link rel="canonical" href="' + origin + path + '"><link rel="icon" href="/favicon.svg">'
            '<style>' + css + '</style></head><body data-site-kind="' + dataset + '" data-page="' + kind + '">'
            '<a class="skip" href="#content">Skip to content</a><main id="content">' + body + '</main>'
            '<noscript><p class="wrap">Search needs JavaScript. The subject, pathway and navigation links still work.</p></noscript>'
            '<script defer src="/assets/domain-site.js"></script></body></html>')


def games_privacy(origin):
    return ('<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Privacy and saved progress · Made by Matt Games</title><link rel="canonical" href="' + origin + '/privacy/">'
            '<style>body{max-width:760px;margin:3rem auto;padding:0 1.25rem;font:1.05rem/1.7 system-ui;color:#18223b;background:#f5f3ec}a{color:#174e45}h1{line-height:1.2}</style>'
            '<main><a href="/">Back to games</a><h1>Privacy and saved progress</h1>'
            '<p>Games can store progress and preferences in this browser. The same game in another browser, on another device or at another website address can have a different save.</p>'
            '<h2>Moving from madebymatt.uk</h2><p>This games website uses a new address. Existing saves at madebymatt.uk do not transfer automatically. Publishing this site does not delete that browser data. Keep any exports or backups offered by your game.</p>'
            '<p>This website does not automatically read or transfer data from the education website.</p>'
            '<h2>Optional features</h2><p>Some games offer audio, microphone, camera, file import/export or local multiplayer controls. Use the individual game’s instructions and your browser’s permission controls.</p>'
            '<p>This migration adds no account registration or analytics. Hosting providers still receive the network requests needed to serve the website.</p>'
            '<p>Questions or bug reports: <a href="mailto:contactmadebymatt@gmail.com">contactmadebymatt@gmail.com</a>.</p></main></html>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lessons', required=True, type=Path)
    ap.add_argument('--output', type=Path, default=HERE / 'output')
    args = ap.parse_args()
    output = args.output.resolve()
    if output == ROOT or output == args.lessons.resolve() or output in ROOT.parents:
        raise ValueError('Output cannot replace a source repository')
    marker = output / '.mbm-domain-build'
    if output.exists() and any(output.iterdir()) and not marker.exists():
        raise ValueError('Refusing to replace an output directory not owned by this builder')
    if marker.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)
    marker.write_text('Made by Matt domain publication build\n')
    games = output / 'games'
    education = output / 'education-overlay'
    games.mkdir(); education.mkdir()
    config = json.loads((HERE / 'config.json').read_text())
    if config['education_origin'] != 'https://madebymatt.uk' or config['games_origin'] != 'https://madebymatt-play.uk':
        raise ValueError('Purchased-domain allocation has changed; update the deployment plan first')
    rows = json.loads(CENSUS.read_text())['rows']
    assert len(rows) == len({normal(r['normalizedDecodedRoute']) for r in rows}) == 69
    entries = json.loads((ROOT / 'data/mbm-search-index.json').read_text())['entries']
    search_by_route = {normal(e['route']): e for e in entries if e['category'] == 'game'}
    payloads = []
    roots = {'Site': ROOT, 'Lessons': args.lessons.resolve()}
    for row in rows:
        source = roots[row['source']['repository']] / row['source']['path']
        destination = game_output_path(row)
        copy_file(source, games, destination)
        if row['source']['repository'] == 'Site':
            # Preserve each game's own vendor/sprite/data directory in full.
            for child in source.parent.rglob('*'):
                if child.is_file() and child != source and not any(x.startswith('.') for x in child.relative_to(source.parent).parts):
                    copy_file(child, games, child.relative_to(ROOT))
        else:
            # Lessons games also use local vendors, including dynamically
            # requested A-Frame scripts. Preserve the full vendor directory
            # and its licences at the same relative URL.
            vendor = source.parent / 'vendor'
            if vendor.is_dir():
                destination_vendor = Path(destination).parent / 'vendor'
                shutil.copytree(vendor, games / destination_vendor, dirs_exist_ok=True)
        payloads.append({'route': row['normalizedDecodedRoute'], 'path': destination,
                         'source_repository': row['source']['repository'], 'source_path': row['source']['path'],
                         'source_sha256': sha(source), 'class': row['populationClass']})
    for directory in ['assets', 'images']:
        shutil.copytree(ROOT / directory, games / directory, dirs_exist_ok=True)
    for name in ['hud.js', 'theme.js', 'styles.css', 'favicon.svg', 'apple-touch-icon.png']:
        copy_file(ROOT / name, games, name)
    # Keep engines exact except for literal first-party host changes. Changes
    # are measured per file and reversible byte-for-byte for source comparison.
    transformed = []
    for path in games.rglob('*'):
        if path.is_file() and path.suffix in {'.html', '.js', '.css', '.json', '.svg', '.webmanifest'}:
            try: text = path.read_text()
            except UnicodeDecodeError: continue
            n = text.count(config['source_origin'])
            if n:
                path.write_text(text.replace(config['source_origin'], config['games_origin']))
                transformed.append({'path': str(path.relative_to(games)), 'host_replacements': n})
    # A games-only home menu. Keep the existing HUD control implementation.
    hud = (games / 'hud.js').read_text()
    hud, n = re.subn(r'var HOMES = \{[^\n]*\};', 'var HOMES = {"games":{r:"/games/",l:"Games homepage"}};', hud)
    assert n == 1, 'HUD menu anchor changed'
    (games / 'hud.js').write_text(hud)
    build_preview.build()
    preview = (HERE / 'preview.html').read_text()
    preview_data = json.loads(re.search(r'<script type="application/json" id="preview-data">(.*?)</script>', preview, re.S)[1])
    extra = [build_preview.compact(search_by_route[normal(r['normalizedDecodedRoute'])]) for r in rows if r['populationClass'] != 'canonical-shelf']
    staff_route = '/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html'
    staff = [e for e in extra if unquote(urlparse(e['route']).path) == staff_route]
    for e in staff:
        e['safeForPupils'] = False
        e['subject'] = 'Staff training'
    game_data = {'games': preview_data['games'],
                 'activities': [e for e in extra if e not in staff],
                 'staff': staff, 'externalRoutes': []}
    learning_data = {k: preview_data[k] for k in ['education', 'pupils', 'externalRoutes']}
    put(games, 'data/domain-catalogue.json', json.dumps(game_data, ensure_ascii=False))
    put(education, 'data/domain-catalogue.json', json.dumps(learning_data, ensure_ascii=False))
    game_index = render_page(preview, 'games', config['games_origin'], config)
    for route in ['index.html', 'games/index.html', 'main/index.html', 'for/pupils/index.html', 'Games/index.html', 'Lessons/index.html']:
        put(games, route, game_index.replace('href="'+config['games_origin']+'/"', 'href="'+config['games_origin']+'/"', 1))
    put(games, 'privacy/index.html', games_privacy(config['games_origin']))
    for kind, path in [('home','index.html'), ('home','main/index.html'), ('teachers','for/teachers/index.html'), ('pupils','for/pupils/index.html')]:
        put(education, path, render_page(preview, kind, config['education_origin'], config))
    for target in [games, education]:
        copy_file(HERE / 'site-runtime.js', target, 'assets/domain-site.js')
        copy_file(ROOT / 'favicon.svg', target, 'favicon.svg')
        copy_file(HERE / 'game-saves.js', target, 'assets/game-saves.js')
        copy_file(HERE / 'game-saves.html', target, 'game-saves/index.html')
        copy_file(HERE / 'game-storage-allowlist.json', target, 'data/game-storage-allowlist.json')
    # Preserve the canonical shelf bytes for existing mirror consumers.
    for path in ['games.json', 'Games/games.json', 'data/source-manifests/games.json']:
        copy_file(ROOT / 'data/source-manifests/games.json', games, path)
    put(games, 'CNAME', 'madebymatt-play.uk\n')
    put(games, '.nojekyll', '')
    put(games, 'robots.txt', 'User-agent: *\nAllow: /\nSitemap: '+config['games_origin']+'/sitemap.xml\n')
    urls = [config['games_origin']+'/'] + [config['games_origin']+r['normalizedDecodedRoute'] for r in rows]
    put(games, 'sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>'+html.escape(u)+'</loc></url>' for u in urls) + '</urlset>')
    put(games, '404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Find a game · Made by Matt</title><main><h1>That game address was not found.</h1><p><a href="/">Find your game on the games homepage</a>.</p></main></html>')
    # Verify every declared initial-load reference for the 69 payloads.
    missing = []
    external = []
    for item in payloads:
        path = games / item['path']
        parser = RuntimeRefs(); parser.feed(path.read_text())
        item['published_sha256'] = sha(path)
        original = roots[item['source_repository']] / item['source_path']
        assert path.read_text() == original.read_text().replace(config['source_origin'], config['games_origin']), item['route']
        for ref in parser.refs:
            if ref.startswith(('data:', 'blob:', '#')): continue
            resolved = urlparse(urljoin(config['games_origin']+'/'+item['path'], ref))
            if resolved.netloc != urlparse(config['games_origin']).netloc:
                external.append({'route':item['route'],'reference':ref}); continue
            target = games / unquote(resolved.path).lstrip('/')
            if not target.is_file(): missing.append({'route':item['route'],'reference':ref})
    assert not missing, f'Missing initial-load files: {missing}'
    assert not external, f'External initial-load references need review: {external}'
    report = {'status':'GAMES_BUILD_READY_HOSTING_NOT_CONFIGURED',
              'education_origin':config['education_origin'],'games_origin':config['games_origin'],
              'source_heads':{name:source_head(path) for name,path in roots.items()},
              'source_census_sha256':sha(CENSUS),
              'counts':{'canonical_games':62,'additional_classroom_activities':7,'game_payloads':len(payloads),
                        'game_output_files':sum(p.is_file() for p in games.rglob('*')),
                        'education_overlay_pages':4,'missing_initial_load_refs':len(missing),
                        'external_initial_load_refs':len(external)},
              'payloads':payloads,'literal_host_replacements':transformed,
              'remaining':['Configure independent games hosting and the purchased domain.',
                           'Complete full education publication exclusion and legacy-route treatment across Site and Lessons.',
                           'Integrate the education overlay with the existing source generators and the active lesson publication.',
                           'Review browser-save continuity before retiring old game routes.',
                           'Browser/gameplay and live cross-domain testing have not run.']}
    put(output, 'build-report.json', json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'status':report['status'],'counts':report['counts'],'output':str(output)},indent=2))


if __name__ == '__main__':
    main()
