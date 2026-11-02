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
from datetime import date, datetime, timezone
import hashlib
import html
import json
import os
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

UPDATED_WINDOW_DAYS = 60

def reference_today():
    override = os.environ.get('PLAY_REFERENCE_DATE', '').strip()
    return date.fromisoformat(override) if override else datetime.now(timezone.utc).date()

def is_recent_update(iso, today=None):
    """P-7-2: show card 'Updated' dates only when changed in the last 60 days."""
    if not iso:
        return False
    delta = ((today or reference_today()) - date.fromisoformat(str(iso))).days
    return 0 <= delta <= UPDATED_WINDOW_DAYS

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

def launch_slug(row):
    head = str(shown_title(row)).split('\u2014')[0].strip().lower()
    return re.sub(r'[^a-z0-9]+', '-', head).strip('-')

def launch_route(row):
    return '/play/' + launch_slug(row) + '/'

SCIENCE_KEYWORDS = ('physics', 'science', 'laser', 'biopunk', 'reactor', 'potion', 'orbital', 'chemistry', 'biology')

def is_science_game(row):
    tag = str(row.get('tag') or '').strip().lower()
    if tag in {'physics', 'science'}:
        return True
    hay = (shown_title(row) + ' ' + str(row.get('subGenre') or '')).lower()
    return any(k in hay for k in SCIENCE_KEYWORDS)

def human_join(items):
    items = [str(x) for x in items if x]
    if not items:
        return ''
    if len(items) == 1:
        return items[0]
    return ', '.join(items[:-1]) + ' and ' + items[-1]

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

PLAY_SHELVES = (
    ('Strategy, Command & Systems', 'shelf-strategy'),
    ('Cosy Markets, Rhythm & Creative', 'shelf-cosy'),
    ('Stadium, Track & Precision Sports', 'shelf-sports'),
    ('High-Tempo Arcade & Turf', 'shelf-arcade'),
)
PLAY_SHELF_IDS = {**dict(PLAY_SHELVES), 'Classroom': 'classroom'}

def classify_shelf(row):
    """PLAY_FINAL (J92 rev 1): map every catalogue game to one of the four named shelves."""
    tag = row.get('tag', '')
    sub = (row.get('subGenre') or row.get('sub_genre') or '').lower()
    if tag in {'Strategy', 'Action RPG', 'Roguelike', 'Whodunnit', 'Card battle', 'Class game', 'Management Sim'}:
        return 'Strategy, Command & Systems'
    if tag in {'Calm', 'Rhythm', 'Puzzle', 'Hide & seek'}:
        return 'Cosy Markets, Rhythm & Creative'
    if tag == 'Sandbox':
        if any(w in sub for w in ('destruction', 'demolition', 'driving')):
            return 'High-Tempo Arcade & Turf'
        return 'Cosy Markets, Rhythm & Creative'
    if tag == 'Physics':
        if any(w in sub for w in ('laser', 'reactor', 'orbital', 'deflect', 'containment', 'alchemy', 'potion', 'demolition')):
            return 'Strategy, Command & Systems'
        if any(w in sub for w in ('clay', 'pottery', 'sculpt', 'wheel')):
            return 'Cosy Markets, Rhythm & Creative'
        if any(w in sub for w in ('grapple', 'platform', 'swing', 'marble', 'turf', 'hover-car', 'territory', 'canyon', 'rescue')):
            return 'High-Tempo Arcade & Turf'
        return 'Stadium, Track & Precision Sports'
    if tag == 'Classic':
        if 'football' in sub or 'soccer' in sub or 'world cup' in (row.get('series') or '').lower():
            return 'Strategy, Command & Systems'
        return 'High-Tempo Arcade & Turf'
    if tag == 'Reflex':
        if any(w in sub for w in ('deduction', 'evidence')):
            return 'Strategy, Command & Systems'
        if 'tunnel' in sub:
            return 'High-Tempo Arcade & Turf'
        if any(w in sub for w in ('cricket', 'tennis', 'golf', 'football', 'penalty', 'ski', 'athletics', 'sprint', 'bowling', 'darts', 'snooker', 'pool', 'archery', 'rowing', 'cycling', 'race', 'racing', 'kart', 'track', 'trail', 'strength', 'lift')):
            return 'Stadium, Track & Precision Sports'
    return 'High-Tempo Arcade & Turf'

def band_pill(row):
    """J92 R9: the session band as a pill, labelled by the manifest's own
    session_band_labels; a row whose band is unstated shows nothing."""
    return ('<span class="chip pill-session">' + esc(row['sessionBandLabel']) + '</span>') if row.get('sessionBandLabel') else ''

def action_pill(row):
    """Titles v2: two-word verb-led action pill from GAME_TITLES_DRAFT_v2."""
    return ('<span class="chip pill-action" data-pill>' + esc(row['pill']) + '</span>') if row.get('pill') else ''

def tag_pill(row):
    return ('<span class="chip" data-tag>' + esc(row['tag']) + '</span>') if row.get('tag') else ''

def verified_input_pill(row):
    labels = {'touch': 'Touch', 'keyboard': 'Keyboard', 'mouse': 'Mouse', 'gamepad': 'Gamepad'}
    vals = [labels.get(c, c[:1].upper() + c[1:]) for c in (row.get('controls') or [])]
    return ('<span class="chip pill-input">' + esc(' · '.join(vals)) + '</span>') if vals else ''

def badges(row, members):
    out = action_pill(row) + tag_pill(row)
    if len(members) > 1:
        out += '<span class="chip">' + str(len(members)) + ' editions</span>'
    if row.get('updated'):
        d = row['updated']['date']
        out += '<span class="chip" data-updated="' + esc(d) + '"' + ('' if is_recent_update(d) else ' hidden') + '>Updated ' + esc(date_label(d)) + '</span>'
    return out + band_pill(row) + verified_input_pill(row) + keyboard_chip(row)

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
    return PLAY_SHELF_IDS.get(name, 'shelf-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'))

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
    """TX (a) & PLAY_FINAL (J92 rev 1, C16, C17): every featured row, manifest
    order, one shown at a time once play.js runs; AK10-AB puts the manifest's
    one spotlight row first. A visible Next control and Featured playlist rail
    (no pagination dots per C17); nothing advances on its own; no video."""
    items = ''.join(
        '<li class="spot-card feature-card" data-spot="' + esc(r['id']) + '">'
        + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r)).replace(' loading="lazy"', '')
        + '<div class="feature-body">' + kicker(r).replace('card-kicker', 'feature-kicker')
        + '<h3 class="feature-title">' + esc(shown_title(r)) + '</h3>'
        + '<p class="card-line">' + esc(body_line(r)) + '</p>'
        + '<div class="card-meta">' + action_pill(r) + (tag_pill(r) or '<span class="chip">' + esc(r['genre']) + '</span>') + band_pill(r) + verified_input_pill(r) + keyboard_chip(r) + '</div>'
        + '<div class="card-actions">' + play_link(r) + favourite_button(r) + guide_link(r) + '</div></div></li>'
        for r in rows
    )
    def playlist_thumb(r):
        image = (r.get('media') or {}).get('poster') or r.get('image', '')
        if image:
            return '<span class="playlist-thumb" aria-hidden="true"><img src="' + esc(image) + '" alt="" loading="lazy" width="64" height="36"></span>'
        return '<span class="playlist-thumb" aria-hidden="true">' + tile_art(r) + '</span>'
    n = len(rows)
    dots = ''.join('<li><button type="button" class="spot-dot" data-spot-select="' + str(i) + '" aria-current="false" aria-label="Spotlight ' + str(i + 1) + ' of ' + str(n) + ': ' + esc(shown_title(r)) + '"></button></li>' for i, r in enumerate(rows))
    playlist = ''.join('<li><button type="button" class="playlist-btn" data-spot-select="' + str(i) + '" aria-current="false">' + playlist_thumb(r) + '<span class="playlist-name">' + esc(shown_title(r)) + '</span></button></li>' for i, r in enumerate(rows))
    return ('<section class="spotlight" id="spotlight" aria-labelledby="spotlight-title"><div class="spotlight-head"><h2 id="spotlight-title">Spotlight</h2>'
            '<p id="spot-status" class="chip" aria-live="polite" hidden></p><button type="button" class="button" id="spot-next" hidden>Next<span class="sr-only"> spotlight game</span> <span aria-hidden="true">→</span></button></div>'
            '<div class="spotlight-stage"><div class="spotlight-main"><ol class="spot-list">' + items + '</ol><ol class="spot-dots" aria-label="Spotlight pages" hidden>' + dots + '</ol></div>'
            '<aside class="featured-playlist" aria-labelledby="playlist-title" hidden><h3 id="playlist-title" class="playlist-heading">Featured playlist</h3><ol class="playlist-items">' + playlist + '</ol></aside></div></section>')

def release_rail(rows):
    """J92 R6 (F-new-release-occupants): one box per `updated` entry in the
    dataset, newest first (manifest order within a date), data-release=<id>, no
    data-shelf (check.cjs: no invented shelf). An empty array renders nothing."""
    updated = sorted([r for r in rows if r.get('updated')], key=lambda r: r['updated']['date'], reverse=True)
    if not updated:
        return ''
    boxes = ''.join('<li class="release-box" data-release="' + esc(r['id']) + '">' + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r))
                    + '<p class="card-kicker"><span data-updated="' + esc(r['updated']['date']) + '"' + ('' if is_recent_update(r['updated']['date']) else ' hidden') + '>Updated ' + esc(date_label(r['updated']['date'])) + '</span></p><h3 class="release-title">' + esc(shown_title(r)) + '</h3>'
                    '<p class="card-line">' + esc(r['updated']['description']) + '</p><div class="card-actions">' + play_link(r) + '</div></li>' for r in updated)
    n = len(updated)
    return ('<section class="shelf release-rail" id="new-and-updated" data-rail="updated" aria-labelledby="new-and-updated-title">'
            '<div class="shelf-head"><h2 id="new-and-updated-title">New and updated</h2><p class="shelf-count" data-shelf-count>' + str(n) + (' game' if n == 1 else ' games') + '</p>'
            '<div class="shelf-nav" hidden><button type="button" class="shelf-step" data-shelf-step="-1" aria-controls="new-and-updated-track" aria-label="Previous updated games">‹</button>'
            '<button type="button" class="shelf-step" data-shelf-step="1" aria-controls="new-and-updated-track" aria-label="Next updated games">›</button></div></div>'
            '<ol class="shelf-track" id="new-and-updated-track">' + boxes + '</ol></section>')

SEEDED_GAMES = (
    ('grapple', 'Grapple', '/Lessons/Games/Grapple.html'),
    ('apex-kick', 'Apex Kick', '/apexkick/'),
    ('reactor', 'Reactor', '/Matt-s-Apps-/enzyme-reactor-overdrive.html'),
    ('potion-works', 'Potion Works', '/potion-works/'),
)

def todays_seed_card(by_key):
    """JOB 6(a): display-only Today's seed card shared across seeded games so a
    class can play the same date-based run and compare locally."""
    controls = []
    for slug, fallback_label, route in SEEDED_GAMES:
        row = by_key.get(key(route))
        if row is not None:
            label = shown_title(row)
            controls.append(
                '<a class="play seed-play" data-seed-play="' + esc(row['id']) + '" data-seed-base="' + esc(row['route'])
                + '" href="' + esc(row['route']) + '">Play ' + esc(label) + ' <span aria-hidden="true">→</span></a>'
            )
        else:
            controls.append(
                '<span class="chip seed-pending" data-seed-pending="' + esc(slug) + '">'
                + esc(fallback_label) + ' · Coming soon</span>'
            )
    return (
        '<section class="todays-seed" id="todays-seed" aria-labelledby="todays-seed-title">'
        '<div class="todays-seed-head">'
        '<div class="todays-seed-copy">'
        '<p class="feature-kicker">Shared classroom run · Same seed on every device</p>'
        '<h2 id="todays-seed-title">Today’s seed</h2>'
        '<p class="card-line">Open any seeded game below with today’s date code so a class can play the same run and compare locally — no accounts and nothing sent anywhere.</p>'
        '</div>'
        '<div class="todays-seed-badge" aria-label="Today’s shared date seed">'
        '<span class="seed-label" id="todays-seed-date">Daily date code</span>'
        '<code class="seed-code" id="todays-seed-value">YYYYMMDD</code>'
        '</div>'
        '</div>'
        '<div class="todays-seed-actions" role="group" aria-label="Open seeded games with today’s seed">'
        + ''.join(controls) +
        '</div></section>'
    )

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
    # the facet filter. session_modes stay in the manifest (and render on launch pages).
    for k in ('id', 'title', 'displayTitle', 'description', 'line', 'route', 'launchRoute', 'scienceGame', 'image', 'imageCaption', 'genre', 'tag', 'shelf', 'pill', 'searchWords', 'group', 'controls', 'modes', 'instructions', 'moods', 'moodReason', 'details', 'series', 'editions', 'featured', 'spotlight', 'chapter',
              'subGenre', 'pitch', 'whatYouDo', 'inputs', 'sessionBand', 'facets'):
        if k in row and row[k] not in (None, '', [], False):
            out[k] = row[k]
    m = row.get('media') or {}
    if m:
        out['media'] = {k: m[k] for k in ('video', 'poster', 'duration_seconds', 'description') if k in m}
    if row.get('updated'):
        out['updated'] = {'date': row['updated']['date'], 'label': date_label(row['updated']['date']), 'description': row['updated']['description']}
    return out

MODE_LABELS = {
    'single': '1 player',
    'local': 'Local / same-network options',
    'classroom-teams': 'Shared-screen teams',
}

INPUT_LABELS = {
    'touch': 'Touch',
    'keyboard': 'Keyboard',
    'mouse': 'Mouse',
    'gamepad': 'Gamepad',
}

def launch_thumb(row, image, title, alt='', eager=False):
    """Self-contained thumbnail markup for launch pages (no external sprite needed)."""
    if image:
        lazy = '' if eager else ' loading="lazy"'
        return '<span class="thumb"><img src="' + esc(image) + '" alt="' + esc(alt) + '"' + lazy + ' width="640" height="360" decoding="async"></span>'
    motif = TILE_MOTIFS.get(row.get('tag'), '')
    art = ('<svg class="tile-art" viewBox="0 0 64 64" focusable="false">' + motif + '</svg>') if motif else ''
    return '<span class="thumb thumb-block" aria-hidden="true">' + art + '<span class="thumb-title">' + esc(title) + '</span></span>'

def render_launch_page(row, catalogue_games, by_id, band_labels, logo, footer_logo):
    """PLAY-P3: static per-game launch page built from games.json and reviewed Play data."""
    title = shown_title(row)
    desc = body_line(row)
    media = row.get('media') or {}
    poster_path = media.get('poster') or row.get('image', '')
    page_url = ORIGIN + row['launchRoute']
    if poster_path:
        poster_url = ORIGIN + poster_path
        og_w, og_h = '640', '360'
        poster_alt = row.get('imageCaption') or (title + ' poster frame.')
    else:
        # Independent-release control builds against older Lessons pins omit byte-bound
        # screens for games at another approved revision; keep the build clean while the
        # release pin (PLAY_REQUIRE_COMPLETE_DISCOVERY=1) asserts 640x360 posters on all 62.
        poster_url = ORIGIN + '/assets/icons/play-icon-512.png'
        og_w, og_h = '512', '512'
        poster_alt = 'Made by Matt Play icon.'

    genres_ld = []
    for g_name in (row.get('genre'), row.get('tag')):
        if g_name and g_name not in genres_ld:
            genres_ld.append(g_name)
    declared_modes = set(row.get('modes') or [])
    declared_facets = set(row.get('facets') or [])
    modes_ld = []
    if 'single' in declared_modes or 'solo' in declared_facets or not declared_modes:
        modes_ld.append('SinglePlayer')
    if declared_modes & {'local', 'classroom-teams'} or declared_facets & {'versus', 'whole-class'}:
        modes_ld.append('MultiPlayer')
    if 'co-op' in declared_facets:
        modes_ld.append('CoOp')
    ld = OrderedDict([
        ('@context', 'https://schema.org'),
        ('@type', 'VideoGame'),
        ('name', title),
        ('description', desc),
        ('url', page_url),
        ('image', poster_url),
        ('genre', genres_ld[0] if len(genres_ld) == 1 else genres_ld),
        ('playMode', modes_ld[0] if len(modes_ld) == 1 else modes_ld),
        ('isAccessibleForFree', True),
        ('inLanguage', 'en-GB'),
        ('applicationCategory', 'Game'),
        ('operatingSystem', 'Web browser'),
        ('author', {'@type': 'Organization', 'name': 'Made by Matt'}),
    ])
    ld_json = json.dumps(ld, ensure_ascii=False).replace('<', '\\u003c')

    hero_chips = ['<span class="chip">' + esc(row['genre']) + '</span>']
    if row.get('tag') and row['tag'] != row['genre']:
        hero_chips.append('<span class="chip">' + esc(row['tag']) + '</span>')
    if row.get('sessionBandLabel'):
        hero_chips.append('<span class="chip pill-session">' + esc(row['sessionBandLabel']) + '</span>')
    if row.get('updated'):
        d = row['updated']['date']
        hero_chips.append('<span class="chip" data-updated="' + esc(d) + '"' + ('' if is_recent_update(d) else ' hidden') + '>Updated ' + esc(date_label(d)) + '</span>')

    members = [by_id[i] for i in (row.get('editions') or []) if i in by_id and by_id[i]['group'] == 'games' and i != row['id']]
    editions_html = ''
    if members:
        editions_html = (
            '<div class="launch-editions"><p class="launch-subhead">Other editions in ' + esc(row.get('series') or title) + '</p>'
            '<ul class="launch-edition-list">'
            + ''.join(
                '<li><a class="button" href="' + esc(e['launchRoute']) + '">' + esc(shown_title(e)) + '</a>'
                + play_link(e, small=True) + '</li>'
                for e in members
            )
            + '</ul></div>'
        )

    what_items = ''.join('<li>' + esc(line) + '</li>' for line in (row.get('whatYouDo') or [desc]))
    mode_pills = []
    for m_code in (row.get('modes') or []):
        label = MODE_LABELS.get(m_code)
        if label and label not in mode_pills:
            mode_pills.append(label)
    for f_code in (row.get('facets') or []):
        label = f_code[:1].upper() + f_code[1:]
        if label not in mode_pills:
            mode_pills.append(label)
    if row.get('sessionBandLabel') and row['sessionBandLabel'] not in mode_pills:
        mode_pills.append(row['sessionBandLabel'])
    mode_pills_html = ('<div class="card-meta">' + ''.join('<span class="chip">' + esc(p) + '</span>' for p in mode_pills) + '</div>') if mode_pills else ''

    session_modes_html = ''
    if row.get('sessionModes'):
        sm_items = []
        for sm in row['sessionModes']:
            m_name = sm.get('mode')
            if not m_name:
                continue
            b_code = sm.get('band', '')
            b_label = band_labels.get(b_code, '') if b_code and b_code != 'unstated' else ''
            sm_items.append('<li><strong>' + esc(m_name) + '</strong>' + (' <span class="muted">(' + esc(b_label) + ')</span>' if b_label else '') + '</li>')
        if sm_items:
            session_modes_html = '<p class="launch-subhead">Modes</p><ul class="launch-list">' + ''.join(sm_items) + '</ul>'

    chapter_notes = ''
    if row.get('chapter'):
        chapter_notes += '<p class="muted">Latest chapter: ' + esc(row['chapter']) + '.</p>'
    if row.get('updated'):
        d = row['updated']['date']
        chapter_notes += '<p class="muted"><span data-updated="' + esc(d) + '"' + ('' if is_recent_update(d) else ' hidden') + '>Updated ' + esc(date_label(d)) + ': </span>' + esc(row['updated']['description']) + '</p>'

    input_labels = []
    for raw_c in list(row.get('inputs') or []) + list(row.get('controls') or []):
        clean_c = INPUT_LABELS.get(str(raw_c).lower(), str(raw_c)[:1].upper() + str(raw_c)[1:])
        if clean_c and clean_c not in input_labels:
            input_labels.append(clean_c)
    input_chips_html = ('<div class="card-meta">' + ''.join('<span class="chip pill-input">' + esc(c) + '</span>' for c in input_labels) + '</div>') if input_labels else ''

    details = row.get('details') or {}
    instr = row.get('instructions') or ''
    useful_instr = (
        instr
        and 'not yet been' not in instr.lower()
        and not re.search(r'Player modes|Command one campaign|Single pilot|Source documents|Same-device|Two players on one device', instr)
    )
    if details.get('controls'):
        controls_copy = details['controls']
    elif useful_instr:
        controls_copy = instr
    elif input_labels:
        controls_copy = 'Play directly in your browser with ' + human_join([c.lower() for c in input_labels]) + ' input. Open the in-game help or settings screen for full bindings.'
    else:
        controls_copy = 'Open the in-game help or controls screen for full bindings and options.'
    access_html = ('<p class="muted">' + esc(details['accessibility']) + '</p>') if details.get('accessibility') else ''
    kb_warn_html = '<p class="warn-line">Keyboard recommended on touch-only devices.</p>' if (row.get('controls') and 'touch' not in row['controls']) else ''

    saves_detail = ('<p class="muted">' + esc(details['saves']) + '</p>') if details.get('saves') else ''

    badge_items = [
        ('Category', row['genre']),
        ('Play style', row.get('tag') or row['genre']),
    ]
    if row.get('subGenre'):
        badge_items.append(('Focus', row['subGenre']))
    if row.get('sessionBandLabel'):
        badge_items.append(('Session', row['sessionBandLabel']))
    for f_code in (row.get('facets') or []):
        badge_items.append(('Mode', f_code[:1].upper() + f_code[1:]))
    badges_html = '<ul class="launch-badges" aria-label="Game badges">' + ''.join(
        '<li class="launch-badge"><span class="launch-badge-key">' + esc(k_lbl) + '</span><strong>' + esc(v_lbl) + '</strong></li>'
        for k_lbl, v_lbl in badge_items
    ) + '</ul>'

    evidence_html = ''
    if row.get('scienceGame'):
        evidence_html = (
            '<section class="launch-card launch-evidence" id="evidence-export" data-evidence-export aria-labelledby="evidence-export-title">'
            '<h2 id="evidence-export-title">Evidence export</h2>'
            '<p>Session scores, local milestones and any export or sync codes stay in this browser on your device — no account, login or pupil name is collected or sent anywhere. For class evidence, save a screenshot of your completed run or export your local save code through Transfer saves.</p>'
            '<div class="card-actions"><a class="button" href="/game-saves/">Transfer saves</a>'
            '<a class="button" href="https://madebymatt.uk/Lessons/Science/">Science lessons on Made by Matt Education <span aria-hidden="true">↗</span></a></div>'
            '</section>'
        )

    kin = set(row.get('editions') or [row['id']])
    same_tag = [g for g in catalogue_games if g['id'] not in kin and g.get('tag') == row.get('tag')]
    same_genre = [g for g in catalogue_games if g['id'] not in kin and g['genre'] == row['genre'] and g not in same_tag]
    other_games = [g for g in catalogue_games if g['id'] not in kin and g not in same_tag and g not in same_genre]
    peers = (same_tag + same_genre + other_games)[:2]
    peer_cards = ''.join(
        '<article class="game-card launch-peer-card">'
        + launch_thumb(p, (p.get('media') or {}).get('poster') or p.get('image', ''), shown_title(p))
        + kicker(p)
        + '<h3 class="card-title">' + esc(shown_title(p)) + '</h3>'
        + '<p class="card-line">' + esc(body_line(p)) + '</p>'
        + '<div class="card-actions">' + play_link(p)
        + '<a class="button" href="' + esc(p['launchRoute']) + '">Launch page<span class="sr-only">: ' + esc(shown_title(p)) + '</span></a></div>'
        + '</article>'
        for p in peers
    )
    edu_card = (
        '<article class="game-card launch-peer-card launch-edu-bridge">'
        '<p class="card-kicker">Made by Matt Education</p>'
        '<h3 class="card-title">Classroom lessons &amp; tools</h3>'
        '<p class="card-line">Explore structured lessons, revision packs and interactive classroom studios on the Education site.</p>'
        '<div class="card-actions"><a class="button" href="https://madebymatt.uk/">Open Made by Matt Education <span aria-hidden="true">↗</span></a></div>'
        '</article>'
    )

    kicker_html = ('<p class="feature-kicker">' + esc(row['subGenre']) + '</p>') if row.get('subGenre') else ''

    return (
        '<!doctype html>\n<html lang="en-GB" data-theme="dark">\n<head>\n'
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<title>' + esc(title) + ' · Made by Matt Play</title>\n'
        '<meta name="description" content="' + esc(desc) + '">\n'
        '<meta name="theme-color" content="#081422"><link rel="canonical" href="' + esc(page_url) + '">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:site_name" content="Made by Matt Play">\n'
        '<meta property="og:locale" content="en_GB">\n'
        '<meta property="og:title" content="' + esc(title) + ' · Made by Matt Play">\n'
        '<meta property="og:description" content="' + esc(desc) + '">\n'
        '<meta property="og:url" content="' + esc(page_url) + '">\n'
        '<meta property="og:image" content="' + esc(poster_url) + '">\n'
        '<meta property="og:image:width" content="' + esc(og_w) + '">\n'
        '<meta property="og:image:height" content="' + esc(og_h) + '">\n'
        '<meta property="og:image:alt" content="' + esc(poster_alt) + '">\n'
        '<link rel="manifest" href="/site.webmanifest">\n'
        '<link rel="stylesheet" href="/assets/mbm-tokens.css">\n'
        '<link rel="stylesheet" href="/assets/play/play.css">\n'
        '<script type="application/ld+json">' + ld_json + '</script>\n'
        '</head>\n'
        '<body data-site-kind="games" data-page="game-launch"' + (' data-science-game="true"' if row.get('scienceGame') else '') + '>\n'
        '<a class="skip" href="#launch-main">Skip to game guide</a>\n'
        '<header class="masthead" data-mbm-chrome="play" data-theme="dark"><a class="brand" href="/">' + logo + '<span class="brand-lockup"><span class="brand-name">Made by Matt <strong>Play</strong></span><span class="brand-tagline">Play • Explore • Escape</span></span></a>\n'
        '<nav class="estate-switcher" aria-label="Switch between Education and Play"><a class="switcher-link" href="https://madebymatt.uk/">Education <span aria-hidden="true">↗</span></a><a class="switcher-link" href="/">Play</a></nav>\n'
        '<div class="head-actions"><a class="button" href="/">← All games</a></div></header>\n'
        '<main id="launch-main" class="launch-main">\n'
        '<section class="launch-hero" aria-labelledby="launch-title">'
        '<div class="launch-poster">' + launch_thumb(row, poster_path, title, alt=poster_alt, eager=True) + '</div>'
        '<div class="launch-summary">' + kicker_html + '<h1 id="launch-title">' + esc(title) + '</h1>'
        '<p class="lede">' + esc(desc) + '</p>'
        '<div class="card-meta">' + ''.join(hero_chips) + '</div>'
        '<div class="card-actions launch-actions"><a class="play big" data-play="' + esc(row['id']) + '" href="' + esc(row['route']) + '">Play ' + esc(title) + ' <span aria-hidden="true">→</span></a>'
        '<a class="button" href="/">← Back to Play shelf</a></div>'
        + editions_html +
        '<noscript><p class="notice">Interactive gameplay runs in your browser when scripts are enabled; this guide and every navigation link work without scripts.</p></noscript>'
        '</div></section>\n'
        '<div class="launch-grid">'
        '<section class="launch-card" id="guide-and-modes" aria-labelledby="guide-title"><h2 id="guide-title">Guide &amp; modes</h2>'
        '<ul class="launch-list">' + what_items + '</ul>' + session_modes_html + mode_pills_html + chapter_notes + '</section>'
        '<section class="launch-card" id="controls" aria-labelledby="controls-title"><h2 id="controls-title">Controls</h2>'
        + input_chips_html + '<p>' + esc(controls_copy) + '</p>' + access_html + kb_warn_html + '</section>'
        '<section class="launch-card" id="works-offline" aria-labelledby="offline-title"><h2 id="offline-title">Works offline</h2>'
        '<p>Works offline in your browser once opened — no account, no login and zero third-party scripts or trackers. Progress and settings stay locally on this device unless you export a backup or sync code.</p>'
        + saves_detail +
        '<div class="card-actions"><a class="button" href="/game-saves/">Transfer saves</a><a class="button" href="/privacy/">Privacy and saved progress</a></div></section>'
        '<section class="launch-card" id="badges" aria-labelledby="badges-title"><h2 id="badges-title">Badges</h2>'
        + badges_html +
        '<p class="muted">In-game medals, stars and local Save Vault milestones stay in this browser and can be backed up or moved between devices with Transfer saves.</p></section>'
        + evidence_html +
        '</div>\n'
        '<section class="launch-related" aria-labelledby="related-title"><h2 id="related-title">More to explore</h2>'
        '<div class="launch-related-grid">' + peer_cards + edu_card + '</div></section>\n'
        '</main>\n'
        '<footer><nav aria-label="Footer"><a href="/">All games</a><span aria-hidden="true">·</span><a href="/your-shelf/">Your shelf</a><span aria-hidden="true">·</span><a href="/game-saves/">Transfer saves</a><span aria-hidden="true">·</span><a href="/privacy/">Privacy and saved progress</a><span aria-hidden="true">·</span><a class="education-return" href="https://madebymatt.uk/">Made by Matt Education ↗</a></nav><p class="brand-line"><a class="footer-brand" href="/">' + footer_logo + '<span>Made by Matt Play</span></a></p><p class="footer-motto">Play • Explore • Escape</p></footer>\n'
        '</body></html>\n'
    )

def render_your_shelf_page(catalogue_games, logo, footer_logo):
    """JOB 6(b): offline read-only 'Your shelf' badge wall reading the local Save Vault."""
    allowlist_path = HERE.parents[1] / 'data/game-storage-allowlist.json'
    allowlist = json.loads(allowlist_path.read_text(encoding='utf-8'))
    sources = OrderedDict()
    for r in catalogue_games:
        entry = {'name': shown_title(r), 'route': r['launchRoute']}
        lr_slug = r['launchRoute'].strip('/').split('/')[-1].lower()
        rt_stem = Path(unquote(r['route']).rstrip('/')).stem.lower()
        sources[lr_slug] = entry
        sources[lr_slug.replace('-', '')] = entry
        if rt_stem and rt_stem != 'index':
            sources[rt_stem] = entry
            sources[re.sub(r'[^a-z0-9]+', '', rt_stem)] = entry
    inline_meta = json.dumps(
        {'exactKeys': allowlist.get('localStorageExactKeys', []), 'sources': sources},
        ensure_ascii=False,
    ).replace('<', '\\u003c')
    page_url = ORIGIN + '/your-shelf/'
    desc = 'Badges, medals and artefacts earned locally in Potion Works and Save Vault games on this device — works offline with no account and nothing sent anywhere.'
    return (
        '<!doctype html>\n<html lang="en-GB" data-theme="dark">\n<head>\n'
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
        '<title>Your shelf · Made by Matt Play</title>\n'
        '<meta name="description" content="' + esc(desc) + '">\n'
        '<meta name="theme-color" content="#081422"><link rel="canonical" href="' + esc(page_url) + '">\n'
        '<link rel="manifest" href="/site.webmanifest">\n'
        '<link rel="stylesheet" href="/assets/mbm-tokens.css">\n'
        '<link rel="stylesheet" href="/assets/play/play.css">\n'
        '<script defer src="/assets/play/your-shelf.js"></script>\n'
        '</head>\n'
        '<body data-site-kind="games" data-page="your-shelf">\n'
        '<a class="skip" href="#your-shelf-main">Skip to badge wall</a>\n'
        '<header class="masthead" data-mbm-chrome="play" data-theme="dark"><a class="brand" href="/">' + logo + '<span class="brand-lockup"><span class="brand-name">Made by Matt <strong>Play</strong></span><span class="brand-tagline">Play • Explore • Escape</span></span></a>\n'
        '<nav class="estate-switcher" aria-label="Switch between Education and Play"><a class="switcher-link" href="https://madebymatt.uk/">Education <span aria-hidden="true">↗</span></a><a class="switcher-link" href="/">Play</a></nav>\n'
        '<div class="head-actions"><a class="button" href="/">← All games</a></div></header>\n'
        '<section class="trust-strip" aria-label="Local Save Vault privacy"><ul class="trust-list">'
        '<li class="trust-item"><span class="chip">Read-only local Save Vault</span></li>'
        '<li class="trust-item"><span class="chip">Works offline</span></li>'
        '<li class="trust-item"><span class="chip">No accounts · Nothing leaves this device</span></li>'
        '</ul></section>\n'
        '<main id="your-shelf-main" class="launch-main your-shelf-main">\n'
        '<section class="launch-card your-shelf-hero" aria-labelledby="your-shelf-title">'
        '<div class="your-shelf-copy">'
        '<p class="feature-kicker">Local Save Vault · Badge wall</p>'
        '<h1 id="your-shelf-title">Your shelf</h1>'
        '<p class="lede">Badges, passport medals and cross-game artefacts earned in Potion Works and the games that export Save Vault codes appear here automatically in this browser — offline, with no login and nothing sent anywhere.</p>'
        '<div class="shelf-summary" id="shelf-summary" aria-live="polite">'
        '<span class="shelf-stat"><strong id="badge-count">0</strong> badges on this device</span>'
        '<span class="shelf-stat"><strong id="vault-key-count">0</strong> local game saves</span>'
        '<span class="chip" id="shelf-house-chip" hidden></span>'
        '</div>'
        '<p class="warn-line" id="shelf-storage-note" hidden></p>'
        '<div class="card-actions"><a class="play" href="/">Browse games <span aria-hidden="true">→</span></a>'
        '<a class="button" href="/game-saves/">Open Transfer saves</a></div>'
        '<noscript><p class="notice">Enable JavaScript to inspect badges stored in this browser’s local Save Vault. Every navigation link and the guide below work offline without scripts.</p></noscript>'
        '</div></section>\n'
        '<section class="launch-card badge-wall-empty" id="badge-wall-empty" aria-labelledby="empty-wall-title">'
        '<h2 id="empty-wall-title">No badges on this device yet</h2>'
        '<p>Play any badge-enabled game in this browser or import a save code from another device to populate your badge wall locally:</p>'
        '<div class="badge-earn-grid">'
        '<article class="badge-earn-step"><p class="feature-kicker">Step 1 · Brew &amp; master</p><h3>Potion Works &amp; seeded runs</h3>'
        '<p class="muted">Complete recipe challenges and mastery milestones in Potion Works (arriving soon on the Play shelf) and daily seeded runs to record local badges in this browser.</p></article>'
        '<article class="badge-earn-step"><p class="feature-kicker">Step 2 · Sports &amp; Arcade Passports</p><h3>Games that export codes</h3>'
        '<p class="muted">Finish tournament stations, House events or cross-game artefact runs in Sports Passport and Arcade Passport games to unlock local medals and artefacts.</p></article>'
        '<article class="badge-earn-step"><p class="feature-kicker">Step 3 · Bring progress across</p><h3>Use Transfer saves</h3>'
        '<p class="muted">Already earned badges on another device? Paste your in-game sync code inside that game or import your backup file through Transfer saves.</p></article>'
        '</div>'
        '<div class="card-actions"><a class="play" href="/#all-games">Pick a game to earn badges <span aria-hidden="true">→</span></a>'
        '<a class="button" href="/game-saves/">Import in Transfer saves</a></div>'
        '</section>\n'
        '<section aria-label="Earned badges"><div class="badge-wall-grid" id="badge-wall-grid" hidden></div></section>\n'
        '</main>\n'
        '<footer><nav aria-label="Footer"><a href="/">All games</a><span aria-hidden="true">·</span><a href="/your-shelf/" aria-current="page">Your shelf</a><span aria-hidden="true">·</span><a href="/game-saves/">Transfer saves</a><span aria-hidden="true">·</span><a href="/privacy/">Privacy and saved progress</a><span aria-hidden="true">·</span><a class="education-return" href="https://madebymatt.uk/">Made by Matt Education ↗</a></nav><p class="brand-line"><a class="footer-brand" href="/">' + footer_logo + '<span>Made by Matt Play</span></a></p><p class="footer-motto">Play • Explore • Escape</p></footer>\n'
        '<script id="vault-allowlist" type="application/json">' + inline_meta + '</script>\n'
        '</body></html>\n'
    )

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
            output_path = payload.relative_to(target).as_posix()
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
                           sessionModes=list(m.get('session_modes', [])),
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
    titles_v2 = read('titles-v2.json', {'routes': {}})['routes']
    for route, t_meta in titles_v2.items():
        row = by_key.get(key(route))
        if row is None or row['group'] != 'games': raise ValueError('titles-v2.json names a route that is not a catalogue game: ' + route)
        pill = t_meta.get('pill', '')
        s_words = t_meta.get('searchWords', [])
        if not isinstance(pill, str) or not pill.strip(): raise ValueError('titles-v2.json pill must be a non-empty string: ' + route)
        if not isinstance(s_words, list) or not s_words or not all(isinstance(w, str) and w.strip() for w in s_words):
            raise ValueError('titles-v2.json searchWords must be a non-empty list of strings: ' + route)
        row['pill'] = pill.strip()
        row['searchWords'] = [w.strip() for w in s_words]
    launch_seen = set()
    for row in rows:
        if row['group'] == 'games':
            lr = launch_route(row)
            if lr in launch_seen:
                raise ValueError('duplicate launch page route: ' + lr)
            launch_seen.add(lr)
            row['launchRoute'] = lr
            row['scienceGame'] = is_science_game(row)
            row['shelf'] = classify_shelf(row)
        else:
            row['shelf'] = 'Classroom'
    assert len(launch_seen) == counts['games']

    assets = target/'assets/play'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ['play.css','play.js','your-shelf.js']:
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
    tag_counts = Counter(r['tag'] for r in games)
    tags = sorted(tag_counts, key=lambda t: (-tag_counts[t], t))
    # PLAY_FINAL (J92 rev 1): four named catalogue shelves in order, followed by
    # Classroom holding the classroom/staff activities.
    shelf_names = [name for name, _ in PLAY_SHELVES] + ['Classroom']
    declared = {c for r in games for c in r['controls']}
    input_chips = [(v, label) for v, label in (('keyboard', 'Keyboard'), ('touch', 'Touch')) if v in declared]
    chips = ('<a class="chip-button" href="#all-games" data-chip="all" aria-pressed="true" aria-current="true">All games</a>'
             + ''.join('<a class="chip-button" href="#' + shelf_id(s) + '" data-chip="genre" data-genre="' + esc(s) + '" aria-pressed="false">' + esc(s) + '</a>' for s in shelf_names)
             + ''.join('<a class="chip-button" href="?control=' + v + '#all-games" data-chip="control" data-control="' + v + '" aria-pressed="false">' + label + '</a>' for v, label in input_chips))
    genre_options = '<option value="">All genres</option>' + ''.join('<option value="' + esc(t) + '">' + esc(t) + '</option>' for t in tags)
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
        by_shelf[r['shelf']].append(card(r, members, by_id))
        covered += [i for i in members if by_id[i]['group'] == 'games']
    if sorted(covered) != sorted(r['id'] for r in games) or len(covered) != len(set(covered)):
        raise ValueError('shelves do not cover every catalogue game exactly once')
    cards = [c for v in by_shelf.values() for c in v]
    shelf_report = OrderedDict()
    shelves_html = ''
    for name, items in by_shelf.items():
        members = [r for r in games if r['shelf'] == name]
        extra = [activity_card(r) for r in activities] if name == 'Classroom' else []
        if not items and not extra:
            continue
        if members:
            count = str(len(members)) + (' game' if len(members) == 1 else ' games')
            if extra:
                count += ' · ' + str(len(extra)) + (' activity' if len(extra) == 1 else ' activities')
        else:
            count = str(len(extra)) + (' activity' if len(extra) == 1 else ' activities')
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
    # PLAY-P1 part B: decorative masthead motif, placed only at its recorded bytes
    # (hero-art.json binds the asset by sha256 and byte length). An .svg record is
    # inlined directly into .intro-art with aria-hidden="true" (no request, no <img>).
    hero = read('hero-art.json', {})
    hero_art = ''
    if hero.get('sha256'):
        source = HERE / Path(hero['file']).name
        art_bytes = source.read_bytes()
        assert hashlib.sha256(art_bytes).hexdigest() == hero['sha256'] and len(art_bytes) == hero['bytes'], 'hero artwork differs from hero-art.json'
        if source.suffix.lower() == '.svg':
            hero_art = ('<div class="intro-art" aria-hidden="true" data-hero-sha="'+esc(hero['sha256'])+'" data-hero-bytes="'+str(int(hero['bytes']))+'">'
                        +art_bytes.decode('utf-8').strip()+'</div>')
        else:
            shutil.copyfile(source, assets/source.name)
            hero_art = ('<img class="intro-art" src="/assets/play/'+esc(source.name)+'" alt="" width="'+str(int(hero['width']))+'" height="'+str(int(hero['height']))
                        +'" decoding="async" fetchpriority="low" data-hero-source="'+esc(hero['sourceSha256'])+'" data-hero-sha="'+esc(hero['sha256'])+'">')
    lanes_html = (spotlight(featured) if featured else '') + todays_seed_card(by_key) + release_rail(rows)
    data = {'counts': counts, 'catalogue': len(games),
            'genres': [{'name': g, 'count': genre_counts[g]} for g in genres],
            'tags': [{'name': t, 'count': tag_counts[t]} for t in tags],
            'shelves': [{'name': s, 'id': shelf_id(s), **shelf_report[s]} for s in shelf_report],
            'facets': [{'name': f, 'count': facet_counts[f]} for f in facet_names],
            'bandLabels': {b: band_labels[b] for b in sorted({r['sessionBand'] for r in games if r.get('sessionBand')})},
            'series': series, 'games': [slim(r) for r in rows]}
    substitutions = {'@@LOGO@@':logo, '@@FOOTERLOGO@@':footer_logo, '@@HEROART@@':hero_art, '@@CHIPS@@':chips, '@@FACETS@@':facet_row, '@@GENRES@@':genre_options, '@@FEATURED@@': lanes_html,
        '@@COUNT@@': str(len(games)) + ' games', '@@GRID@@': shelves_html, '@@NOSCRIPT@@': noscript_list(rows), '@@TILES@@': tile_sprite(),
        '@@DATA@@':json.dumps(data,ensure_ascii=False).replace('<','\\u003c')}
    for a,b in substitutions.items(): template = template.replace(a,b)
    assert '@@' not in template
    for name in ALIASES:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(template,encoding='utf-8')
    launch_routes = []
    for r in games:
        lp = target / r['launchRoute'].lstrip('/') / 'index.html'
        lp.parent.mkdir(parents=True, exist_ok=True)
        lp.write_text(render_launch_page(r, games, by_id, band_labels, logo, footer_logo), encoding='utf-8')
        launch_routes.append(r['launchRoute'])
    assert len(launch_routes) == len(games)
    shelf_page = target / 'your-shelf' / 'index.html'
    shelf_page.parent.mkdir(parents=True, exist_ok=True)
    shelf_page.write_text(render_your_shelf_page(games, logo, footer_logo), encoding='utf-8')
    assert (target/'data/domain-catalogue.json').read_bytes() == original
    report={'counts':counts,'total':len(rows),'catalogue_sha256':hashlib.sha256(original).hexdigest(),
            'brand_status':brand.get('status','original-asset-unresolved'), 'accepted_clips':len(clips_by_route),
            'grid_cards':len(cards),'series':{k:len(v) for k,v in series.items()},'genres':genres,
            'featured':[r['route'] for r in featured], 'shelves':shelf_report,
            'launch_pages':len(launch_routes), 'science_launch_pages':sum(1 for r in games if r.get('scienceGame')),
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
