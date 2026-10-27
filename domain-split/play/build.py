"""Enhance only the generated Play shelf, consuming its existing catalogue.

Run after the existing publication builder. The shared release coordinator can
call refresh(output) before refresh_play_usage, using the supplied tiny patch.

UX2 C2 (2026-09-08): the shelf is rendered here as ONE DOM — a server-side
"All games" grid holding every catalogue game exactly once (series editions
collapsed to one card whose Play anchors for the other editions are still in
the markup), a static Featured card, the classroom rows, and a slim inline
dataset that play.js uses to add the lanes, the chips' filtering, the Filters
drawer and the game sheet. Every number on the page is derived here or in
play.js; nothing is typed into the template.
"""
from __future__ import annotations
import argparse
from collections import Counter, OrderedDict
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlparse, quote
if __package__:
    from .source_revisions import registry, validate_report
else:
    from source_revisions import registry, validate_report

HERE = Path(__file__).resolve().parent
# J92 (rulings uq, ua): the canonical shelf manifest, read here for the enrichment
# fields tools/play/land_enrichment.py landed on it (sub_genre, pitch,
# what_you_do, controls, session_band, classroom_facets) and the row's own tag.
MANIFEST = HERE.parents[1] / 'data/source-manifests/games.json'
ALIASES = ('index.html', 'games/index.html', 'main/index.html', 'for/pupils/index.html', 'Games/index.html', 'Lessons/index.html')
ORIGIN = 'https://www.madebymatt-play.uk'
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
esc = lambda s: html.escape(str(s), quote=True)

def key(route):
    return unquote(urlparse(route).path).removesuffix('index.html').rstrip('/') or '/'

def read(name, fallback):
    p = HERE / name
    return json.loads(p.read_text()) if p.exists() else fallback

def date_label(iso):
    """2026-09-08 -> '8 Sep 2026'. Derived by code, never typed."""
    y, m, d = (int(x) for x in iso.split('-'))
    return f'{d} {MONTHS[m - 1]} {y}'

def shown_title(row):
    return row.get('displayTitle') or row['title']

def play_link(row, small=False):
    return ('<a class="play' + (' small' if small else '') + '" data-play="' + esc(row['id']) + '" href="' + esc(row['route']) + '">Play<span class="sr-only"> ' + esc(shown_title(row)) + '</span></a>')

def guide_link(row):
    """J92 R14: the card's second action is the sheet's existing ?game= deep link.
    check.cjs forbids data-info on cards (tx (e): no modal from cards), so this is
    a plain link play.js may intercept; without JavaScript it reloads into the sheet."""
    return '<a class="button guide-link" href="?game=' + esc(quote(row['id'], safe='')) + '">Guide &amp; modes</a>'

def kicker(row):
    """J92 R3: the kicker is the manifest's sub_genre; rows without one (the
    activities and the staff tool) carry no kicker."""
    return ('<p class="card-kicker">' + esc(row['subGenre']) + '</p>') if row.get('subGenre') else ''

def body_line(row):
    """J92 R3: the body is the manifest's pitch; otherwise the record's line."""
    return row.get('pitch') or row['line']

def tile_slug(tag):
    return re.sub(r'[^a-z0-9]+', '-', str(tag).lower()).strip('-')

# J92 R11: inline SVG category art, keyed by the manifest tag, for a row whose
# record binds no captured screen. Each motif is a sprite symbol emitted only when
# some row on the page needs it; a tag with no motif keeps the titled block.
TILE_MOTIFS = {
    'Reflex': '<polygon points="32,8 52,32 32,56 12,32" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M26 32h12M32 26v12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    'Strategy': '<rect x="14" y="14" width="36" height="36" rx="6" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14 26h36M26 14v36" stroke="currentColor" stroke-width="2.2"/><circle cx="38" cy="38" r="4" fill="currentColor"/>',
    'Action RPG': '<path d="M32 10 50 20v24L32 54 14 44V20Z" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="32" cy="32" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    'Physics': '<circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-dasharray="5 4"/><circle cx="32" cy="32" r="6" fill="currentColor"/><circle cx="48" cy="20" r="3.5" fill="currentColor"/>',
    'Roguelike': '<circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="2" opacity=".75"/><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".45"/>',
    'Whodunnit': '<circle cx="29" cy="29" r="12" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M38 38 50 50" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
    'Rhythm': '<path d="M10 32h10l6-14 8 28 6-14h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    'Hide & seek': '<path d="M10 32s8-14 22-14 22 14 22 14-8 14-22 14S10 32 10 32Z" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="32" cy="32" r="5.5" fill="currentColor"/>',
    'Card battle': '<rect x="16" y="12" width="22" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="26" y="20" width="22" height="32" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    'Sandbox': '<path d="M32 12 50 22v20L32 52 14 42V22Z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14 22 32 32 50 22M32 32v20" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    'Classic': '<path d="M14 42V26a8 8 0 0 1 16 0v12a8 8 0 0 0 16 0V22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="46" cy="18" r="3" fill="currentColor"/>',
    'Calm': '<path d="M32 14c7 6 10 14 0 24-10-10-7-18 0-24Z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M18 46h28" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    'Puzzle': '<path d="M20 14h24L32 32 44 50H20L32 32Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>',
    'Class game': '<circle cx="22" cy="26" r="5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="42" cy="26" r="5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 46c2-7 18-7 20 0M32 46c2-7 18-7 20 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    'Management Sim': '<path d="M16 48V32M28 48V20M40 48V28M50 48V16" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
    'Flight combat': '<path d="M32 10 48 44l-16-6-16 6Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>',
}
TILES_USED = set()

def tile_art(row):
    tag = row.get('tag')
    if tag not in TILE_MOTIFS:
        return ''
    TILES_USED.add(tag)
    return '<svg class="tile-art" viewBox="0 0 64 64" focusable="false"><use href="#tile-' + tile_slug(tag) + '"/></svg>'

def tile_sprite():
    if not TILES_USED:
        return ''
    return ('<svg class="tile-sprite" aria-hidden="true" focusable="false">'
            + ''.join('<symbol id="tile-' + tile_slug(t) + '" viewBox="0 0 64 64">' + TILE_MOTIFS[t] + '</symbol>' for t in sorted(TILES_USED)) + '</svg>')

def favourite_button(row):
    return '<button type="button" class="favourite" data-favourite="' + esc(row['id']) + '" aria-pressed="false" aria-label="Favourite: ' + esc(shown_title(row)) + '" hidden>♡<span class="sr-only"> Favourite</span></button>'

def keyboard_chip(row):
    # Verified controls that do not include touch: play.js reveals this on a
    # coarse-pointer device. Unverified rows get nothing on the card.
    if row['controls'] and 'touch' not in row['controls']:
        return '<span class="chip warn" data-needs-keyboard hidden>Needs a keyboard</span>'
    return ''

META_DESCRIPTION = re.compile(r'<meta\s[^>]*name\s*=\s*["\']description["\'][^>]*>', re.I)
SENTENCE = re.compile(r'^(.+?[.!?…])(?=\s|$)', re.S)

def first_sentence(text):
    """The text up to its first sentence boundary, verbatim (whitespace folded)."""
    text = ' '.join(str(text).split())
    m = SENTENCE.match(text)
    return m.group(1) if m else text

def what_you_do(payload_bytes):
    """TX (e): the game's OWN meta description, cut at a sentence boundary.
    Read from the exact payload bytes this build publishes; None when absent."""
    head = payload_bytes[:200000].decode('utf-8', 'replace')
    for tag in META_DESCRIPTION.findall(head):
        m = re.search(r'content\s*=\s*(["\'])(.*?)\1', tag, re.S)
        if m and m.group(2).strip():
            return first_sentence(html.unescape(m.group(2)))
    return None

def thumb(row, image, title):
    # Art: the existing captured thumbnail, else a tokened colour block carrying the title.
    if image:
        return '<span class="thumb"><img src="' + esc(image) + '" alt="" loading="lazy" width="640" height="360"></span>'
    return '<span class="thumb thumb-block" aria-hidden="true">' + tile_art(row) + '<span class="thumb-title">' + esc(title) + '</span></span>'

def band_pill(row):
    """J92 R9: the session band as a pill, labelled by the manifest's own
    session_band_labels; a row whose band is unstated shows nothing."""
    return ('<span class="chip pill-session">' + esc(row['sessionBandLabel']) + '</span>') if row.get('sessionBandLabel') else ''

def badges(row, members):
    out = ''
    if len(members) > 1:
        out += '<span class="chip">' + str(len(members)) + ' editions</span>'
    if row.get('updated'):
        out += '<span class="chip">Updated ' + esc(date_label(row['updated']['date'])) + '</span>'
    return out + band_pill(row) + keyboard_chip(row)

def card(row, members, by_id):
    """One shelf card: art, title, the one-line "what you do", badges for data
    that exists, and Play. `members` are every edition (ids) when the row leads
    a series; the other CATALOGUE editions' Play anchors stay on the card, so
    every catalogue game is reachable from exactly one card. No modal, no
    preview: the card's only actions are links (and the existing favourite)."""
    media = row.get('media', {})
    image = media.get('poster') or row.get('image', '')
    title = row['series'] if row.get('series') else shown_title(row)
    editions = [by_id[i] for i in members if i != row['id']]
    catalogue_editions = [e for e in editions if e['group'] == 'games']
    more = ''
    if catalogue_editions:
        more = '<ul class="card-editions" data-editions>' + ''.join('<li>' + play_link(e, small=True) + '<span class="edition-name">' + esc(shown_title(e)) + '</span></li>' for e in catalogue_editions) + '</ul>'
    return ('<article class="game-card" data-card="' + esc(row['id']) + '" data-games="' + esc(' '.join(i for i in members if by_id[i]['group'] == 'games')) + '">'
            + thumb(row, image, title) + kicker(row) + '<h4 class="card-title">' + esc(title) + '</h4><p class="card-line">' + esc(body_line(row)) + '</p><p class="card-match" hidden></p>'
            '<div class="card-meta">' + badges(row, members) + '</div><div class="card-actions">' + play_link(row) + favourite_button(row) + guide_link(row) + '</div>' + more + '</article>')

def activity_card(row):
    image = row.get('image', '')
    label = 'Staff activity' if row['group'] == 'staff' else 'Classroom activity'
    return ('<article class="game-card activity-card" data-activity="' + esc(row['id']) + '">'
            + thumb(row, image, shown_title(row)) + '<h4 class="card-title">' + esc(shown_title(row)) + '</h4><p class="card-line">' + esc(row['line']) + '</p><p class="card-match" hidden></p>'
            '<div class="card-meta"><span class="chip">' + label + '</span></div><div class="card-actions">' + play_link(row) + guide_link(row) + '</div></article>')

def shelf_id(name):
    return 'classroom' if name == 'Classroom' else 'shelf-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def shelf(name, cards, count_text, note=''):
    """TX (d): one horizontal, scroll-snapped shelf per category. The 44px
    previous/next controls are inert markup until play.js wires them."""
    sid = shelf_id(name)
    return ('<section class="shelf" id="' + sid + '" data-shelf="' + esc(name) + '" aria-labelledby="' + sid + '-title">'
            '<div class="shelf-head"><h3 id="' + sid + '-title">' + esc(name) + '</h3><p class="shelf-count" data-shelf-count>' + esc(count_text) + '</p>'
            '<div class="shelf-nav" hidden><button type="button" class="shelf-step" data-shelf-step="-1" aria-controls="' + sid + '-track" aria-label="Previous ' + esc(name) + ' games">‹</button>'
            '<button type="button" class="shelf-step" data-shelf-step="1" aria-controls="' + sid + '-track" aria-label="Next ' + esc(name) + ' games">›</button></div></div>'
            + (('<p class="muted shelf-note">' + esc(note) + '</p>') if note else '') +
            '<div class="shelf-track" id="' + sid + '-track">' + ''.join(cards) + '</div></section>')

def spotlight(rows):
    """TX (a): every featured row, manifest order, one shown at a time once
    play.js runs; AK10-AB puts the manifest's one spotlight row first.
    A visible Next control; nothing advances on its own; no video.
    J92 R17: pagination dots and a featured playlist rail (one 44px control per
    featured row) are derived from the same rows; both are inert markup, hidden
    until play.js wires them, so the no-script page still shows every item.
    J92 R3: the kicker is the sub_genre and the body the pitch."""
    n = len(rows)
    items = ''.join('<li class="spot-card feature-card" data-spot="' + esc(r['id']) + '">' + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r)).replace(' loading="lazy"', '')
                    + '<div class="feature-body">' + kicker(r).replace('card-kicker', 'feature-kicker') + '<h3 class="feature-title">' + esc(shown_title(r)) + '</h3>'
                    '<p class="card-line">' + esc(body_line(r)) + '</p><div class="card-meta"><span class="chip">' + esc(r['genre']) + '</span>' + band_pill(r) + keyboard_chip(r) + '</div>'
                    '<div class="card-actions">' + play_link(r) + '</div></div></li>' for r in rows)
    dots = ''.join('<li><button type="button" class="spot-dot" data-spot-select="' + str(i) + '" aria-current="false" aria-label="Spotlight ' + str(i + 1) + ' of ' + str(n) + ': ' + esc(shown_title(r)) + '"></button></li>' for i, r in enumerate(rows))
    def playlist_thumb(r):
        image = (r.get('media') or {}).get('poster') or r.get('image', '')
        if image:
            return '<span class="playlist-thumb" aria-hidden="true"><img src="' + esc(image) + '" alt="" loading="lazy" width="64" height="36"></span>'
        return '<span class="playlist-thumb" aria-hidden="true">' + tile_art(r) + '</span>'
    playlist = ''.join('<li><button type="button" class="playlist-btn" data-spot-select="' + str(i) + '" aria-current="false">' + playlist_thumb(r) + '<span class="playlist-name">' + esc(shown_title(r)) + '</span></button></li>' for i, r in enumerate(rows))
    return ('<section class="spotlight" id="spotlight" aria-labelledby="spotlight-title"><div class="spotlight-head"><h2 id="spotlight-title">Spotlight</h2>'
            '<p id="spot-status" class="muted" aria-live="polite" hidden></p><button type="button" class="button" id="spot-next" hidden>Next<span class="sr-only"> spotlight game</span> <span aria-hidden="true">→</span></button></div>'
            '<div class="spotlight-stage"><div class="spotlight-main"><ol class="spot-list">' + items + '</ol>'
            '<ol class="spot-dots" aria-label="Spotlight pages" hidden>' + dots + '</ol></div>'
            '<aside class="featured-playlist" aria-labelledby="playlist-title" hidden><h3 id="playlist-title" class="playlist-heading">Featured playlist</h3><ol class="playlist-items">' + playlist + '</ol></aside></div></section>')

def release_rail(rows):
    """J92 R6 (F-new-release-occupants): one box per `updated` entry in the
    dataset, newest first (manifest order within a date), data-release=<id>, no
    data-shelf (check.cjs: no invented shelf). An empty array renders nothing."""
    updated = sorted([r for r in rows if r.get('updated')], key=lambda r: r['updated']['date'], reverse=True)
    if not updated:
        return ''
    boxes = ''.join('<li class="release-box" data-release="' + esc(r['id']) + '">' + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r))
                    + '<p class="card-kicker">Updated ' + esc(date_label(r['updated']['date'])) + '</p><h3 class="release-title">' + esc(shown_title(r)) + '</h3>'
                    '<p class="card-line">' + esc(r['updated']['description']) + '</p><div class="card-actions">' + play_link(r) + '</div></li>' for r in updated)
    n = len(updated)
    return ('<section class="shelf release-rail" id="new-and-updated" data-rail="updated" aria-labelledby="new-and-updated-title">'
            '<div class="shelf-head"><h2 id="new-and-updated-title">New and updated</h2><p class="shelf-count" data-shelf-count>' + str(n) + (' game' if n == 1 else ' games') + '</p>'
            '<div class="shelf-nav" hidden><button type="button" class="shelf-step" data-shelf-step="-1" aria-controls="new-and-updated-track" aria-label="Previous updated games">‹</button>'
            '<button type="button" class="shelf-step" data-shelf-step="1" aria-controls="new-and-updated-track" aria-label="Next updated games">›</button></div></div>'
            '<ol class="shelf-track" id="new-and-updated-track">' + boxes + '</ol></section>')

def noscript_list(rows):
    """TX (b) fallback: every game and activity as a plain link, A to Z."""
    ordered = sorted(rows, key=lambda r: shown_title(r).casefold())
    return ('<noscript><section class="az-list" aria-labelledby="az-title"><h3 id="az-title">Every game, A to Z</h3><ul>'
            + ''.join('<li><a href="' + esc(r['route']) + '">' + esc(shown_title(r)) + '</a></li>' for r in ordered) + '</ul></section></noscript>')

def slim(row):
    """The inline dataset play.js reads: what the lanes, filters and sheet need, nothing else."""
    out = OrderedDict()
    # J92: of the landed enrichment, only what the shelf shows travels -- the kicker,
    # the body, the sheet's "What you do" lines and input pills, the band pill and
    # the facet filter. session_modes stay in the manifest.
    for k in ('id', 'title', 'displayTitle', 'description', 'line', 'route', 'image', 'imageCaption', 'genre', 'group', 'controls', 'modes', 'instructions', 'moods', 'moodReason', 'details', 'series', 'editions', 'featured', 'spotlight', 'chapter',
              'subGenre', 'pitch', 'whatYouDo', 'inputs', 'sessionBand', 'facets'):
        if k in row and row[k] not in (None, '', [], False):
            out[k] = row[k]
    m = row.get('media') or {}
    if m:
        out['media'] = {k: m[k] for k in ('video', 'poster', 'duration_seconds', 'description') if k in m}
    if row.get('updated'):
        out['updated'] = {'date': row['updated']['date'], 'label': date_label(row['updated']['date']), 'description': row['updated']['description']}
    return out

def refresh(output, review=False, source_revisions=None):
    target = Path(output) / 'games'
    TILES_USED.clear()
    original = (target/'data/domain-catalogue.json').read_bytes()
    catalogue = json.loads(original)
    evidence = read('evidence.json', {'games':{}}).get('games', {})
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest_rows = {key(m['href']): m for m in manifest['games']}
    band_labels = manifest.get('session_band_labels', {})
    discovery_review = read('discovery-review.json', {'routes': {}})['routes']
    screens = {key(s['route']): s for s in read('screens/manifest.json', {'screens': []})['screens']}
    approved_revisions = registry()
    if source_revisions is None:
        site = HERE.parents[1]
        lessons = site/'.sources/Lessons' if (site/'.sources/Lessons').is_dir() else site.parent/'Lessons'
        source_revisions = validate_report(json.loads((Path(output)/'build-report.json').read_text()), output, {'Site':site,'Lessons':lessons})
    media = read('media/manifest.json', {'clips':[]})
    # A route may carry more than one accepted capture when its payload has been revised: each
    # clip binds to the exact bytes it was recorded from (published_sha256), and the clip whose
    # hash equals the payload actually built is the one this build may show. A build whose
    # payload matches none of a route's clips is still refused below (recapture/review required).
    clips_by_route = {}
    for x in media.get('clips', []):
        if x.get('status') == 'accepted': clips_by_route.setdefault(key(x['route']), []).append(x)
    # Lines whose first sentence fails the lane names gate fall back to the category word.
    withheld_digests = set(read('line-withheld.json', {'routeKeySha256': []})['routeKeySha256'])
    withheld = {k for k in (key(e['route']) for g in ('games', 'activities', 'staff') for e in catalogue[g])
                if hashlib.sha256(k.encode()).hexdigest() in withheld_digests}
    if len(withheld) != len(withheld_digests):
        raise ValueError('line-withheld.json names a route that is not published')
    rows, omitted_discovery = [], []
    labels = {'games':'Catalogue game','activities':'Classroom activity','staff':'Staff activity'}
    for group in labels:
        for entry in catalogue[group]:
            path = urlparse(entry['route']).path
            if not path.startswith('/') or path.startswith('//'):
                raise ValueError('Unexpected game route: '+entry['route'])
            extra = evidence.get(key(path), {})
            source = extra.get('source', {})
            # Bind source-inspected labels to the exact copied payload, including
            # the existing builder's documented literal host replacements.
            payload = target / unquote(path).lstrip('/')
            if path.endswith('/'): payload /= 'index.html'
            output_path = str(payload.relative_to(target))
            expected_hash = source.get('published_sha256')
            if output_path in approved_revisions:
                revision = source_revisions.get(output_path)
                if not revision: raise ValueError('Missing reviewed source context: '+entry['title'])
                fields = ('id','reviewed_commit','git_blob','source_sha256','published_sha256')
                if sum(all(r[field] == revision.get(field) for field in fields) for r in approved_revisions[output_path]['revisions']) != 1:
                    raise ValueError('Unreviewed source context: '+entry['title'])
                expected_hash = revision['published_sha256']
            if source and hashlib.sha256(payload.read_bytes()).hexdigest() != expected_hash:
                raise ValueError('Review stale control/content evidence: '+entry['title'])
            row = {**entry, 'description':extra.get('description') or entry['description'], 'route':quote(unquote(path),safe='/()'), 'group':group, 'groupLabel':('Catalogue classroom game' if group=='games' and extra.get('audience')=='classroom' else labels[group]),
                   'genre':extra.get('genre') or entry.get('subject') or 'Other',
                   'controls':extra.get('controls', []), 'modes':extra.get('modes', []),
                   'instructions':extra.get('instructions', 'Open the game and follow its own instructions. Controls and device support have not yet been independently verified.'),
                   'evidence':[{'scope':'source-inspected'}] if extra.get('evidence') else [], 'updated':extra.get('updated'),
                   'featured': entry.get('featured') is True, 'media':{}}
            # TX (e): "what you do" is the game's own meta description, verbatim to a
            # sentence boundary. No game carries a guide link, so the fallback is the
            # category word.
            line = None if key(path) in withheld else what_you_do(payload.read_bytes())
            row.update(line=line or row['genre'], lineSource='meta' if line else ('withheld' if key(path) in withheld else 'category'))
            if group == 'games':
                # J92 R2/R3/R9/R10: the manifest row's own tag and its landed enrichment.
                # The enrichment inputs are kept apart from the record's declared
                # controls (evidence.json), which keep driving the chips and filters.
                m = manifest_rows.get(key(path))
                if m is None: raise ValueError('catalogue game missing from the manifest: ' + entry['title'])
                band = m.get('session_band')
                row.update(tag=m['tag'], spotlight=m.get('spotlight') is True, subGenre=m.get('sub_genre', ''), pitch=m.get('pitch', ''), whatYouDo=list(m.get('what_you_do', [])),
                           inputs=list(m.get('controls', [])), facets=list(m.get('classroom_facets', [])),
                           sessionBand=band if band in band_labels and band != 'unstated' else '')
                row['sessionBandLabel'] = band_labels.get(row['sessionBand'], '') if row['sessionBand'] else ''
            candidates = clips_by_route.get(key(path), [])
            if candidates:
                built = hashlib.sha256(payload.read_bytes()).hexdigest()
                row['media'] = next((c for c in candidates if c['published_sha256'] == built), candidates[-1])
            actual_hash = hashlib.sha256(payload.read_bytes()).hexdigest()
            # Independent publishers intentionally use different approved game
            # revisions. Optional discovery assets may only describe their exact
            # revision; they must not prevent another approved revision building.
            reviewed_hashes = {source.get('published_sha256')} | {r['published_sha256'] for r in approved_revisions.get(output_path, {}).get('revisions', [])}
            reviewed = discovery_review.get(key(path))
            if reviewed:
                if reviewed['published_sha256'] not in reviewed_hashes:
                    raise ValueError('Unreviewed discovery binding: ' + entry['title'])
                if not reviewed['moods'] or not set(reviewed['moods']) <= {'Calm','Fast','Thinky','Together'}:
                    raise ValueError('Invalid reviewed mood: ' + entry['title'])
                if reviewed['published_sha256'] == actual_hash:
                    row.update(moods=reviewed['moods'], moodReason=reviewed['reason'], details=reviewed.get('details', {}))
                else:
                    omitted_discovery.append({'route':row['route'], 'kind':'selection', 'reason':'Different approved game revision'})
            # Only byte-bound captured screens or accepted gameplay posters are
            # used. Missing captures get a neutral placeholder, never invented art.
            row['image'] = ''
            screen = screens.get(key(path))
            if screen:
                if screen['published_sha256'] not in reviewed_hashes:
                    raise ValueError('Unreviewed game screen binding: ' + entry['title'])
                name = screen['file']
                if Path(name).name != name or not name.endswith('.jpg'):
                    raise ValueError('Invalid game screen filename')
                source_screen = HERE/'screens'/name
                if hashlib.sha256(source_screen.read_bytes()).hexdigest() != screen['sha256']:
                    raise ValueError('Game screen bytes changed: ' + entry['title'])
                if screen['published_sha256'] == actual_hash:
                    destination = target/'assets/play/screens'/name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source_screen, destination)
                    row.update(image='/assets/play/screens/'+name, imageCaption=screen['caption'])
                else:
                    omitted_discovery.append({'route':row['route'], 'kind':'screen', 'reason':'Different approved game revision'})
            rows.append(row)
    assert len(rows) == len({key(r['route']) for r in rows}) == 69
    assert len({r['id'] for r in rows}) == len(rows)
    counts = {g:len(catalogue[g]) for g in labels}
    assert counts == {'games':62,'activities':6,'staff':1}, counts
    # Media must be genuinely captured from exactly the output being reviewed.
    for row in rows:
        m = row['media']
        if not m: continue
        path = target / unquote(row['route']).lstrip('/')
        if row['route'].endswith('/'): path /= 'index.html'
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != m['published_sha256']:
            raise ValueError('Recapture/review required for changed game: '+row['title'])

    # --- Presentation layer -------------------------------------------------
    # displayTitle/series arrive on catalogue rows from the canonical shelf
    # (games.json via build_preview). Activities have no games.json row, so
    # their presentation metadata — and the one series join the shelf cannot
    # carry — comes from the reviewed activity-metadata.json beside this file.
    by_key = {key(r['route']): r for r in rows}
    overlay = read('activity-metadata.json', {'routes': {}})['routes']
    for route, extra in overlay.items():
        row = by_key.get(key(route))
        if row is None: raise ValueError('activity-metadata.json names a route that is not published: ' + route)
        for k in ('displayTitle', 'series'):
            if k in extra:
                if not isinstance(extra[k], str) or not extra[k].strip(): raise ValueError('activity-metadata.json ' + k + ' must be a non-empty string: ' + route)
                if k in row and row[k] != extra[k]: raise ValueError('activity-metadata.json contradicts the shelf for ' + k + ': ' + route)
                row[k] = extra[k]
    for row in rows:
        if row.get('displayTitle') == row['title']: raise ValueError('displayTitle repeats title: ' + row['title'])
    # Series: every named series must have at least two editions across the
    # 69 routes; the LEAD (the card the grid shows) is the first catalogue
    # member in shelf order; every member lists every edition in order.
    series = OrderedDict()
    for row in rows:
        if row.get('series'): series.setdefault(row['series'], []).append(row['id'])
    for name, ids in series.items():
        if len(ids) < 2: raise ValueError('series of one: ' + name)
        for i in ids: by_id_row = next(r for r in rows if r['id'] == i); by_id_row['editions'] = list(ids)
    chapters = read('chapters.json', {})
    for route, chapter in chapters.items():
        row = by_key.get(key(route))
        if row is None or row['group'] != 'games': raise ValueError('chapters.json names a route that is not a catalogue game: ' + route)
        if not isinstance(chapter, str) or not chapter.strip(): raise ValueError('chapters.json chapter must be a non-empty string: ' + route)
        row['chapter'] = chapter

    assets = target/'assets/play'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ['play.css','play.js']:
        shutil.copyfile(HERE/name, assets/name)
    for clip in [r['media'] for r in rows if r['media']]:
        for field in ['video','poster']:
            name = Path(clip[field]).name
            assert clip[field] == '/assets/play/media/'+name
            source = HERE/'media'/name
            assert source.suffix in {'.mp4','.webm','.webp','.jpg','.png'}
            expected=clip[field+'_sha256']
            assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
            (assets/'media').mkdir(exist_ok=True)
            shutil.copyfile(source,assets/'media'/name)
    (target/'data/play-discovery.json').write_text(json.dumps({'counts':counts,'games':rows},ensure_ascii=False))

    # --- Render -------------------------------------------------------------
    by_id = {r['id']: r for r in rows}
    games = [r for r in rows if r['group'] == 'games']
    activities = [r for r in rows if r['group'] != 'games']
    genre_counts = Counter(r['genre'] for r in games)
    genres = sorted(genre_counts, key=lambda g: (-genre_counts[g], g))
    # TX (d): shelf order -- Classroom first (the classroom need), then the page's
    # existing categories by size. The categories are the catalogue's own genre
    # values; nothing is invented. Activities join the Classroom shelf.
    shelf_names = ['Classroom'] + [g for g in genres if g != 'Classroom']
    # TX (c): chips are those categories plus Keyboard / Touch, which filter only
    # on DECLARED controls (a game with no verified controls matches neither).
    declared = {c for r in games for c in r['controls']}
    input_chips = [(v, label) for v, label in (('keyboard', 'Keyboard'), ('touch', 'Touch')) if v in declared]
    chips = ('<button type="button" class="chip-button" data-chip="all" aria-pressed="true">All</button>'
             + ''.join('<button type="button" class="chip-button" data-chip="genre" data-genre="' + esc(g) + '" aria-pressed="false">' + esc(g) + '</button>' for g in shelf_names)
             + ''.join('<button type="button" class="chip-button" data-chip="control" data-control="' + v + '" aria-pressed="false">' + label + '</button>' for v, label in input_chips))
    genre_options = '<option value="">All genres</option>' + ''.join('<option value="' + esc(g) + '">' + esc(g) + '</option>' for g in genres)
    # J92 R9: facet chips are the manifest's declared classroom_facets values only,
    # by size then name; the label is the value, capitalised. No facets, no row.
    facet_counts = Counter(f for r in games for f in r['facets'])
    facet_names = sorted(facet_counts, key=lambda f: (-facet_counts[f], f))
    facet_row = ''
    if facet_names:
        facet_row = ('<div class="chip-row facet-row" role="group" aria-label="Classroom facets">'
                     + ''.join('<button type="button" class="facet-chip" data-chip="facet" data-facet="' + esc(f) + '" aria-pressed="false">' + esc(f[:1].upper() + f[1:]) + '</button>' for f in facet_names) + '</div>')
    # TX (a): the spotlight is every row the manifest flags featured, in manifest
    # order. AK10-AB (AB-1, AB-2): the one row the manifest flags spotlight leads
    # it, then the featured rows follow; no new section, and hero is not read.
    spot_lead = [r for r in games if r.get('spotlight')]
    if len(spot_lead) > 1:
        raise ValueError('more than one spotlight row: ' + ', '.join(r['title'] for r in spot_lead))
    featured = spot_lead + [r for r in games if r['featured'] and not r.get('spotlight')]
    by_shelf, covered = OrderedDict((n, []) for n in shelf_names), []
    for r in games:
        members = r.get('editions') or [r['id']]
        lead = next(i for i in members if by_id[i]['group'] == 'games')
        if r['id'] != lead:
            continue  # not the lead of its series: its Play anchor rides on the lead card
        by_shelf[r['genre']].append(card(r, members, by_id))
        covered += [i for i in members if by_id[i]['group'] == 'games']
    if sorted(covered) != sorted(r['id'] for r in games) or len(covered) != len(set(covered)):
        raise ValueError('shelves do not cover every catalogue game exactly once')
    cards = [c for v in by_shelf.values() for c in v]
    shelf_report = OrderedDict()
    shelves_html = ''
    for name, items in by_shelf.items():
        members = [r for r in games if r['genre'] == name]
        extra = [activity_card(r) for r in activities] if name == 'Classroom' else []
        if not items and not extra:
            continue
        count = str(len(members)) + (' game' if len(members) == 1 else ' games')
        if extra:
            count += ' · ' + str(len(extra)) + ' activities'
        note = 'Classroom games, whole-class quizzes and a staff training activity.' if name == 'Classroom' else ''
        shelves_html += shelf(name, items + extra, count, note)
        shelf_report[name] = {'cards': len(items) + len(extra), 'games': len(members), 'activities': len(extra)}
    template = (HERE/'index.html').read_text()
    # Use the exact supplied mark approved by the user, with a checked file hash.
    brand = read('brand.json', {})
    if not review and (brand.get('status') not in {'verified-original', 'user-approved'} or len(clips_by_route) != 6):
        raise ValueError('Play release held: verified approved logo and six accepted fresh clips are required. Use the isolated review entrypoint for unfinished work.')
    logo = ''
    footer_logo = ''
    if brand.get('status') in {'verified-original', 'user-approved'}:
        source = HERE / brand['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == brand['sha256']
        shutil.copyfile(source,assets/source.name)
        logo = '<img src="/assets/play/'+esc(source.name)+'" alt="" width="48" height="48">'
        # PLAY-D1 footer: the same approved mark closes the page, from the same
        # verified bytes and the same served URL as the header -- no second asset,
        # no recolour, no crop. alt="" is the rule, not an oversight: the link it
        # sits in is named by the words beside it, so naming the image as well
        # would read the brand to a screen reader twice. width and height are on
        # the element, so the box is reserved before the JPEG decodes and the
        # footer does not shift under it.
        footer_logo = ('<img class="footer-mark" src="/assets/play/'+esc(source.name)
                       +'" alt="" width="32" height="32" decoding="async" loading="lazy">')
    # PLAY-D2: the approved controller artwork, decorative, placed only at its
    # recorded bytes (hero-art.json binds the served file to Matt's source by
    # digest). Absent record -> no artwork, never a stand-in.
    hero = read('hero-art.json', {})
    hero_art = ''
    if hero.get('sha256'):
        source = HERE / Path(hero['file']).name
        art_bytes = source.read_bytes()
        assert hashlib.sha256(art_bytes).hexdigest() == hero['sha256'] and len(art_bytes) == hero['bytes'], 'hero artwork differs from hero-art.json'
        shutil.copyfile(source, assets/source.name)
        hero_art = ('<img class="intro-art" src="/assets/play/'+esc(source.name)+'" alt="" width="'+str(int(hero['width']))+'" height="'+str(int(hero['height']))
                    +'" decoding="async" fetchpriority="low" data-hero-source="'+esc(hero['sourceSha256'])+'" data-hero-sha="'+esc(hero['sha256'])+'">')
    lanes_html = (spotlight(featured) if featured else '') + release_rail(rows)
    data = {'counts': counts, 'catalogue': len(games), 'genres': [{'name': g, 'count': genre_counts[g]} for g in genres],
            'facets': [{'name': f, 'count': facet_counts[f]} for f in facet_names],
            'bandLabels': {b: band_labels[b] for b in sorted({r['sessionBand'] for r in games if r.get('sessionBand')})},
            'series': series, 'games': [slim(r) for r in rows]}
    substitutions = {'@@LOGO@@':logo, '@@FOOTERLOGO@@':footer_logo, '@@HEROART@@':hero_art, '@@CHIPS@@':chips, '@@FACETS@@':facet_row, '@@GENRES@@':genre_options, '@@FEATURED@@': lanes_html,
        '@@COUNT@@': str(len(games)) + ' games', '@@GRID@@': shelves_html, '@@NOSCRIPT@@': noscript_list(rows), '@@TILES@@': tile_sprite(),
        '@@DATA@@':json.dumps(data,ensure_ascii=False).replace('<','\\u003c')}
    for a,b in substitutions.items(): template = template.replace(a,b)
    assert '@@' not in template
    for name in ALIASES:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(template)
    assert (target/'data/domain-catalogue.json').read_bytes() == original
    report={'counts':counts,'total':len(rows),'catalogue_sha256':hashlib.sha256(original).hexdigest(),
            'brand_status':brand.get('status','original-asset-unresolved'), 'accepted_clips':len(clips_by_route),
            'grid_cards':len(cards),'series':{k:len(v) for k,v in series.items()},'genres':genres,
            'featured':[r['route'] for r in featured], 'shelves':shelf_report,
            'updated_rail':[r['id'] for r in sorted([r for r in rows if r.get('updated')], key=lambda r: r['updated']['date'], reverse=True)],
            'facets':{f: facet_counts[f] for f in facet_names}, 'tiles_without_screen':sorted(TILES_USED),
            'line_sources':dict(Counter(r['lineSource'] for r in rows)),
            'changed_game_payloads':0,'canonical_origin':ORIGIN,'shared_runtime_changed':False,
            'omitted_discovery':omitted_discovery}
    (Path(output)/'play-discovery-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True,type=Path);ap.add_argument('--review',action='store_true');args=ap.parse_args()
    print(json.dumps(refresh(args.output,review=args.review),indent=2))
