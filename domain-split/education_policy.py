"""Education publication boundary. Source and Play files are never removed.

Classification follows the actual activity, not a marketing category. The
current Play census supplies recreational routes; reviewed learning activities
are explicit exceptions. The final emitted-output check runs after enrichment.
"""
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import json

EDUCATION = 'https://madebymatt.uk'
PLAY = 'https://www.madebymatt-play.uk'
EDUCATION_HOSTS = {'madebymatt.uk', 'www.madebymatt.uk', 'mattroper1977.github.io'}
PLAY_HOSTS = {'madebymatt-play.uk', 'www.madebymatt-play.uk'}
MIGRATIONS = {
    '/experiences/medevac-frontier/': '/medevac/',
    '/resources/medevac-frontier/': '/medevac/',
    '/next/games.html': '/',
}
DESTINATION_KEYS = ('route', 'href', 'file', 'url', 'path', 'f')
EDUCATIONAL_ACTIVITIES = {
    '/Lessons/5 Intervention 10/Lesson_VIR_Intervention.html': 'Teacher-led voltage, current and resistance calculations and circuit rules.',
    '/Lessons/5 Intervention 10/Lesson_VIR_Pupil_App.html': 'Pupil recall, predictions, equation calculations and series/parallel circuits.',
    '/Lessons/LundyLoop/5_staff_training/R_Gate_Calibration_Game.html': 'Staff training: decisions about participation in sixteen pathway scenarios; staff discovery only.',
    '/Matt-s-Apps-/orbit-vector-diagnostic.html': 'Vary launch conditions, compare trajectories and isolate variables in a gravity model.',
    '/Matt-s-Apps-/enzyme-reactor-overdrive.html': 'Investigate temperature, pH, substrate and inhibition in an explicitly simplified enzyme model.',
    '/Matt-s-Apps-/wave-interference-iridescence-engine-v2-3.html': 'Investigate wavelength, phase, optical path and superposition using evidence outputs.',
    '/Matt-s-Apps-/ohms-law-fault-finder-v2-3.html': 'Use virtual meter readings to diagnose and justify circuit faults.',
    '/Matt-s-Apps-/mbm-master-hub.html': 'Scientific models with local evidence import/export; contains the gravity and enzyme activities.',
}
VIDEO_STEMS = {'clip-apexkick', 'clip-glitchclash', 'clip-neonbreach', 'clip-neonsync',
               'clip-offbrand', 'clip-voxelfrontier', 'clip-voxelfrontier-play',
               'poster-apexkick', 'poster-glitchclash', 'poster-neonbreach', 'poster-neonsync',
               'poster-offbrand', 'poster-voxelfrontier', 'poster-voxelfrontier-play'}
SOURCE_ONLY = {'README.md', 'HANDOVER.md', 'BACKLOG.md', 'PHONE_TEST_99.md',
               'LAUNCH_LEDGER.md', 'MATT_UI_CHECKLIST.md', 'FEATURES.md',
               'images/README.md', 'data/visual-provenance.json', 'data/source-manifests/games.json',
               'data/source-manifests/lessons-resources.json', 'data/mbm-search-editorial.json',
               'data/new-release-occupants.json', 'data/tag-backfill.csv',
               'data/hud-coverage.json', 'Lessons/data/hud-coverage.json', 'data/audience-homepages.json'}


def canonical(value, prefix='/'):
    return urlparse(urljoin(EDUCATION + (prefix or '/'), value))


def route_key(value):
    return unquote(urlparse(value).path).removesuffix('index.html').rstrip('/') or '/'


def excluded_asset(value, prefix='/'):
    url = canonical(value, prefix)
    if url.hostname not in EDUCATION_HOSTS:
        return False
    path = unquote(url.path).lstrip('/')
    return (path.startswith(('assets/cards/', 'marketing/'))
            or path in SOURCE_ONLY
            or path == 'images/apexkick-hub.jpg'
            or path.startswith('assets/brand/medevac_frontier_patch.')
            or (path.startswith('assets/video/') and Path(path).stem in VIDEO_STEMS))


def classifier(site, lessons):
    census = json.loads((site/'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json').read_text())['rows']
    entries = json.loads((site/'data/mbm-search-index.json').read_text())['entries']
    known = {route_key(row['normalizedDecodedRoute']) for row in census}
    known.update(route_key(row['route']) for row in entries if row.get('category') == 'game')
    known.update(route_key('/Lessons/'+row['file']) for row in json.loads((lessons/'resources.json').read_text()) if row.get('type') == 'game')
    known.update(route_key(route) for route in MIGRATIONS)
    known.update({'/games', '/Games'})
    retained = {route_key(route) for route in EDUCATIONAL_ACTIVITIES}
    directories = {row['source']['path'].split('/')[0] for row in census if row['source']['repository'] == 'Site'}
    directories.update(urlparse(row['route']).path.strip('/').split('/')[0] for row in entries if row.get('category') == 'game' and not row['route'].startswith(('/Lessons/', '/Games/')))

    def is_game(value, prefix='/'):
        url = canonical(value, prefix)
        path = route_key(url.path)
        if url.hostname in PLAY_HOSTS:
            return path not in {'/', '/game-saves'}
        if url.hostname not in EDUCATION_HOSTS or path in retained:
            return False
        return path in known or path.startswith('/Lessons/Games/') or path.strip('/').split('/')[0] in directories
    return known, directories, is_game


def filter_catalogue(obj, is_game, prefix='/'):
    def excluded(row):
        return any(isinstance(row.get(key), str) and is_game(row[key], prefix) for key in DESTINATION_KEYS)
    if isinstance(obj, list):
        return [filter_catalogue(row, is_game, prefix) for row in obj if not (isinstance(row, dict) and excluded(row))]
    if isinstance(obj, dict):
        return {key: filter_catalogue(value, is_game, prefix) for key, value in obj.items()
                if not ((key.startswith('/') or '.html' in key) and is_game(key, prefix))}
    return obj
