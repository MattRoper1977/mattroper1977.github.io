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
from datetime import date
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlparse, quote
if __package__:
    from .source_revisions import registry, validate_report, review_lessons
else:
    from source_revisions import registry, validate_report, review_lessons

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

PLAY_TRI = '<svg class="play-tri" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path d="M4.2 2.8 13.4 8 4.2 13.2Z" fill="currentColor"/></svg>'

SHELF_ACCENTS = {
    'Classroom': ('94, 242, 214', '<circle cx="8" cy="8" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="8" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 18.5c1.3-4 7.7-4 9 0M11.5 18.5c1.3-4 7.7-4 9 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    'Sport': ('52, 211, 153', '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 7.5c2.5 2 9.5 2 12 0M6 16.5c2.5-2 9.5-2 12 0M12 3.5v17" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
    'Action': ('251, 146, 60', '<path d="M13 2.5 5.5 13h5.5l-1 8.5L18.5 11H13l0-8.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
    'Adventure': ('56, 189, 248', '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><polygon points="15.5,8.5 13.2,13.2 8.5,15.5 10.8,10.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
    'Puzzles': ('192, 132, 252', '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>'),
    'Strategy': ('251, 191, 36', '<path d="M5 19h14M6.5 16l-1.5-8 4.5 3 2.5-5 2.5 5 4.5-3-1.5 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'),
    'Creative': ('244, 114, 182', '<path d="M12 3.5c4.7 0 8.5 3.5 8.5 7.8 0 2.5-1.8 4.2-4 4.2h-1.6c-.9 0-1.5.7-1.5 1.5 0 .7.4 1.3.4 1.9 0 1-.8 1.6-1.8 1.6-4.7 0-8.5-3.8-8.5-8.5S7.3 3.5 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="10.5" r="1.2" fill="currentColor"/>'),
}

def shelf_rgb(genre):
    return SHELF_ACCENTS.get(genre, ('94, 242, 214', '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/>'))[0]

def shelf_emblem(genre):
    rgb, path_svg = SHELF_ACCENTS.get(genre, ('94, 242, 214', '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/>'))
    return '<span class="shelf-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" focusable="false">' + path_svg + '</svg></span>'

def play_link(row, small=False):
    return ('<a class="play' + (' small' if small else '') + '" data-play="' + esc(row['id']) + '" href="' + esc(row['route']) + '">' + PLAY_TRI + '<span>Play</span><span class="sr-only"> ' + esc(shown_title(row)) + '</span></a>')

def guide_link(row, compact=False):
    """J92 R14: the card's second action is the sheet's existing ?game= deep link.
    check.cjs forbids data-info on cards (tx (e): no modal from cards), so this is
    a plain link play.js may intercept; without JavaScript it reloads into the sheet."""
    label = 'Guide' if compact else 'Guide &amp; modes'
    sr = ('<span class="sr-only"> &amp; modes: ' + esc(shown_title(row)) + '</span>') if compact else ''
    return '<a class="button guide-link" href="?game=' + esc(quote(row['id'], safe='')) + '">' + label + sr + '</a>'

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

def control_pills(row):
    out = ''
    controls = row.get('controls') or []
    if 'touch' in controls:
        out += '<span class="chip pill-ctrl"><svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="12" r=".8" fill="currentColor"/></svg>Touch</span>'
    if 'keyboard' in controls:
        out += '<span class="chip pill-ctrl"><svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 6.8h1.2M7.4 6.8h1.2M10.3 6.8h1.2M5 9.8h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>Keys</span>'
    if 'gamepad' in controls:
        out += '<span class="chip pill-ctrl">Pad</span>'
    return out

def badges(row, members):
    out = ''
    if len(members) > 1:
        out += '<span class="chip pill-editions">' + str(len(members)) + ' editions</span>'
    if row.get('updated'):
        out += '<span class="chip pill-updated">Updated ' + esc(date_label(row['updated']['date'])) + '</span>'
    return out + band_pill(row) + control_pills(row) + keyboard_chip(row)

def card(row, members, by_id):
    """One shelf card: edge-to-edge art, sub-genre kicker, title, pitch, scannable
    capability pills, and a compact single-row action bar (Play + Guide + ♡)."""
    media = row.get('media', {})
    image = media.get('poster') or row.get('image', '')
    title = row['series'] if row.get('series') else shown_title(row)
    editions = [by_id[i] for i in members if i != row['id']]
    catalogue_editions = [e for e in editions if e['group'] == 'games']
    more = ''
    if catalogue_editions:
        more = '<ul class="card-editions" data-editions>' + ''.join('<li>' + play_link(e, small=True) + '<span class="edition-name">' + esc(shown_title(e)) + '</span></li>' for e in catalogue_editions) + '</ul>'
    return ('<article class="game-card" data-card="' + esc(row['id']) + '" data-games="' + esc(' '.join(i for i in members if by_id[i]['group'] == 'games')) + '">'
            + thumb(row, image, title)
            + '<div class="card-body">' + kicker(row) + '<h4 class="card-title">' + esc(title) + '</h4><p class="card-line">' + esc(body_line(row)) + '</p><p class="card-match" hidden></p>'
            '<div class="card-meta">' + badges(row, members) + '</div><div class="card-actions">' + play_link(row) + guide_link(row, compact=True) + favourite_button(row) + '</div>' + more + '</div></article>')

def activity_card(row):
    image = row.get('image', '')
    label = 'Staff activity' if row['group'] == 'staff' else 'Classroom activity'
    return ('<article class="game-card activity-card" data-activity="' + esc(row['id']) + '">'
            + thumb(row, image, shown_title(row))
            + '<div class="card-body"><h4 class="card-title">' + esc(shown_title(row)) + '</h4><p class="card-line">' + esc(row['line']) + '</p><p class="card-match" hidden></p>'
            '<div class="card-meta"><span class="chip">' + label + '</span></div><div class="card-actions">' + play_link(row) + guide_link(row, compact=True) + '</div></div></article>')

def shelf_id(name):
    return 'classroom' if name == 'Classroom' else 'shelf-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def shelf(name, cards, count_text, note=''):
    """TX (d): one horizontal, scroll-snapped shelf per category, accented with its category emblem."""
    sid = shelf_id(name)
    return ('<section class="shelf" id="' + sid + '" data-shelf="' + esc(name) + '" style="--shelf-rgb:' + shelf_rgb(name) + '" aria-labelledby="' + sid + '-title">'
            '<div class="shelf-head">' + shelf_emblem(name) + '<div class="shelf-title-wrap"><h3 id="' + sid + '-title">' + esc(name) + '</h3><p class="shelf-count" data-shelf-count>' + esc(count_text) + '</p></div>'
            '<div class="shelf-nav" hidden><button type="button" class="shelf-step" data-shelf-step="-1" aria-controls="' + sid + '-track" aria-label="Previous ' + esc(name) + ' games">‹</button>'
            '<button type="button" class="shelf-step" data-shelf-step="1" aria-controls="' + sid + '-track" aria-label="Next ' + esc(name) + ' games">›</button></div></div>'
            + (('<p class="muted shelf-note">' + esc(note) + '</p>') if note else '') +
            '<div class="shelf-track" id="' + sid + '-track">' + ''.join(cards) + '</div></section>')

def spotlight(rows):
    """Cinema marquee Spotlight with dynamic per-game ambient lighting, optional silent gameplay
    preview trigger, and curated Up Next playlist rail."""
    n = len(rows)
    items = ''
    for idx, r in enumerate(rows):
        rgb = shelf_rgb(r['genre'])
        watch_btn = ('<button type="button" class="button spot-watch" data-watch="' + esc(r['id']) + '">▶ Gameplay<span class="sr-only"> preview</span></button>') if (r.get('media') or {}).get('video') else ''
        lead_badge = '<span class="spot-ribbon">' + ('★ Editor’s Spotlight' if idx == 0 else 'Featured Selection') + '</span>'
        items += ('<li class="spot-card feature-card" data-spot="' + esc(r['id']) + '" style="--spot-rgb:' + rgb + '">'
                  '<div class="spot-media">' + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r)).replace(' loading="lazy"', '') + lead_badge + '</div>'
                  '<div class="feature-body">' + kicker(r).replace('card-kicker', 'feature-kicker') + '<h3 class="feature-title">' + esc(shown_title(r)) + '</h3>'
                  '<p class="card-line">' + esc(body_line(r)) + '</p><div class="card-meta"><span class="chip chip-accent">' + esc(r['genre']) + '</span>' + band_pill(r) + control_pills(r) + keyboard_chip(r) + '</div>'
                  '<div class="card-actions">' + play_link(r) + watch_btn + guide_link(r, compact=True) + favourite_button(r) + '</div></div></li>')
    dots = ''.join('<li><button type="button" class="spot-dot" data-spot-select="' + str(i) + '" aria-current="false" aria-label="Spotlight ' + str(i + 1) + ' of ' + str(n) + ': ' + esc(shown_title(r)) + '"></button></li>' for i, r in enumerate(rows))
    def playlist_thumb(r):
        image = (r.get('media') or {}).get('poster') or r.get('image', '')
        if image:
            return '<span class="playlist-thumb" aria-hidden="true"><img src="' + esc(image) + '" alt="" loading="lazy" width="80" height="45"></span>'
        return '<span class="playlist-thumb" aria-hidden="true">' + tile_art(r) + '</span>'
    playlist = ''.join('<li><button type="button" class="playlist-btn" data-spot-select="' + str(i) + '" aria-current="false">' + playlist_thumb(r) + '<span class="playlist-copy"><span class="playlist-name">' + esc(shown_title(r)) + '</span><span class="playlist-sub">' + esc(r.get('subGenre') or r['genre']) + '</span></span></button></li>' for i, r in enumerate(rows))
    return ('<section class="spotlight" id="spotlight" aria-labelledby="spotlight-title"><div class="spotlight-head"><div class="spot-head-left"><span class="spot-gem" aria-hidden="true">◆</span><h2 id="spotlight-title">Spotlight</h2>'
            '<p id="spot-status" class="count-pill" aria-live="polite" hidden></p></div><button type="button" class="button spot-next-btn" id="spot-next" hidden>Next<span class="sr-only"> spotlight game</span> <span aria-hidden="true">→</span></button></div>'
            '<div class="spotlight-stage"><div class="spotlight-main"><ol class="spot-list">' + items + '</ol>'
            '<ol class="spot-dots" aria-label="Spotlight pages" hidden>' + dots + '</ol></div>'
            '<aside class="featured-playlist" aria-labelledby="playlist-title" hidden><h3 id="playlist-title" class="playlist-heading">Up next in Spotlight</h3><ol class="playlist-items">' + playlist + '</ol></aside></div></section>')

def release_rail(rows):
    """J92 R6: New and updated rail with edge-to-edge card artwork."""
    updated = sorted([r for r in rows if r.get('updated')], key=lambda r: r['updated']['date'], reverse=True)
    if not updated:
        return ''
    boxes = ''.join('<li class="release-box" data-release="' + esc(r['id']) + '">' + thumb(r, (r.get('media') or {}).get('poster') or r.get('image', ''), shown_title(r))
                    + '<div class="card-body"><p class="card-kicker pill-updated-kicker">Updated ' + esc(date_label(r['updated']['date'])) + '</p><h3 class="release-title">' + esc(shown_title(r)) + '</h3>'
                    '<p class="card-line">' + esc(r['updated']['description']) + '</p><div class="card-actions">' + play_link(r) + guide_link(r, compact=True) + '</div></div></li>' for r in updated)
    n = len(updated)
    return ('<section class="shelf release-rail" id="new-and-updated" data-rail="updated" style="--shelf-rgb:251, 191, 36" aria-labelledby="new-and-updated-title">'
            '<div class="shelf-head"><span class="shelf-emblem" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" focusable="false"><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>'
            '<div class="shelf-title-wrap"><h2 id="new-and-updated-title">New and updated</h2><p class="shelf-count" data-shelf-count>' + str(n) + (' game' if n == 1 else ' games') + '</p></div>'
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
        lessons = review_lessons(output)
        source_revisions = validate_report(json.loads((Path(output)/'build-report.json').read_text()), output, {'Site':site,'Lessons':lessons})
    media = read('media/manifest.json', {'clips':[]})
    # A route may carry more than one accepted capture when its payload has been revised: each
    # clip binds to the exact bytes it was recorded from (published_sha256), and only a clip
    # whose hash equals the payload actually built may be shown. Other approved revisions
    # omit the clip until recapture, just as they omit revision-bound stills below.
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
                           sessionBand=band if band in band_labels and band != 'unstated' else '')
                row['sessionBandLabel'] = band_labels.get(row['sessionBand'], '') if row['sessionBand'] else ''
            actual_hash = hashlib.sha256(payload.read_bytes()).hexdigest()
            # Independent publishers intentionally use different approved game
            # revisions. Optional discovery assets may only describe their exact
            # revision; they must not prevent another approved revision building.
            reviewed_hashes = {source.get('published_sha256')} | {r['published_sha256'] for r in approved_revisions.get(output_path, {}).get('revisions', [])}
            candidates = clips_by_route.get(key(path), [])
            if any(c['published_sha256'] not in reviewed_hashes for c in candidates):
                raise ValueError('Unreviewed game clip binding: ' + entry['title'])
            if candidates:
                row['media'] = next((c for c in candidates if c['published_sha256'] == actual_hash), {})
                if not row['media']:
                    omitted_discovery.append({'route':row['route'], 'kind':'clip', 'reason':'Different approved game revision'})
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
    assert len(rows) == len({key(r['route']) for r in rows}) == 76
    assert len({r['id'] for r in rows}) == len(rows)
    counts = {g:len(catalogue[g]) for g in labels}
    assert counts == {'games':69,'activities':6,'staff':1}, counts
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
    for name in ['play.css','play.js','space-grotesk-latin.woff2']:
        if (HERE/name).exists():
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

    # --- Render (PLAY-D2, 2026-11-21) ---------------------------------------
    # The front page is the D2 "front door": four Pick-a-game cards, the mood
    # buttons, Play again, ONE A-Z grid of every catalogue game and a collapsed
    # Teacher corner. Every number and every list below is derived here from the
    # catalogue joined to discovery-moods.json; play2.js only reads the dataset.
    by_id = {r['id']: r for r in rows}
    games = [r for r in rows if r['group'] == 'games']
    activities = [r for r in rows if r['group'] == 'activities']
    staff = [r for r in rows if r['group'] == 'staff']
    pupil_rows = [r for r in rows if r['group'] != 'staff']
    # The manifest's spotlight flag stays validated (exactly one row at most) even
    # though the D2 page has no Spotlight: the flag still drives the Games shelf.
    spot_lead = [r for r in games if r.get('spotlight')]
    if len(spot_lead) > 1:
        raise ValueError('more than one spotlight row: ' + ', '.join(r['title'] for r in spot_lead))
    featured = spot_lead + [r for r in games if r['featured'] and not r.get('spotlight')]
    discovery = discovery_join(games, target)
    genre_counts = Counter(r['genre'] for r in games)
    genres = sorted(genre_counts, key=lambda g: (-genre_counts[g], g))
    az = sorted(games, key=lambda r: shown_title(r).casefold())
    mood_by_id = {m['id']: m for m in discovery['moods']}
    cards = [game_card(r, discovery['rows'][r['id']], i < EAGER_CARDS, mood_by_id) for i, r in enumerate(az)]
    covered = [r['id'] for r in az]
    if sorted(covered) != sorted(r['id'] for r in games) or len(covered) != len(set(covered)):
        raise ValueError('the grid does not cover every catalogue game exactly once')
    # Covers are served from /assets/play2/covers/ (the path discovery-moods.json names),
    # copied only from their recorded bytes (checked in discovery_join).
    (target/'assets/play2/covers').mkdir(parents=True, exist_ok=True)
    for name in discovery['covers']:
        shutil.copyfile(COVERS/name, target/'assets/play2/covers'/name)
    hero = hero_week_join(games, discovery['rows'], target)
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
        shutil.copyfile(source, target/'assets/play'/source.name)
        logo = '<img src="/assets/play/'+esc(source.name)+'" alt="" width="28" height="28">'
        # PLAY-D1 footer: the same approved mark closes the page, from the same
        # verified bytes and the same served URL as the header. alt="" because the
        # link it sits in is named by the words beside it; width and height reserve
        # the box so the footer does not shift when the JPEG decodes.
        footer_logo = ('<img class="footer-mark" src="/assets/play/'+esc(source.name)
                       +'" alt="" width="32" height="32" decoding="async" loading="lazy">')
    mood_counts = discovery['counts']
    mood_buttons = ('<button type="button" class="mood-btn" data-mood="all" aria-pressed="true"><span class="mood-ic" aria-hidden="true">'
                    + icon_svg('all') + '</span><span class="mood-label">' + esc(discovery['all_label']) + '</span></button>'
                    + ''.join('<button type="button" class="mood-btn" data-mood="' + esc(m['id']) + '" aria-pressed="false" aria-label="' + esc(m['label'] + ', ' + str(mood_counts[m['id']]) + ' games')
                              + '"><span class="mood-ic" aria-hidden="true">' + icon_svg(m['id']) + '</span><span class="mood-label">' + esc(m['label'])
                              + '</span><span class="mood-count" aria-hidden="true">' + str(mood_counts[m['id']]) + '</span></button>' for m in discovery['moods']))
    classroom = ''.join(activity_item(r) for r in activities)
    hero_data = {'id': hero['row']['id'], 'slug': hero['slug']}
    if hero['video']:
        hero_data.update(video=hero['video'], poster=hero['poster'])
    data = {'counts': counts, 'catalogue': len(games), 'genres': [{'name': g, 'count': genre_counts[g]} for g in genres],
            'bandLabels': {b: band_labels[b] for b in sorted({r['sessionBand'] for r in games if r.get('sessionBand')})},
            'series': series, 'moods': [{'id': m['id'], 'label': m['label'], 'icon': m['icon'], 'count': mood_counts[m['id']]} for m in discovery['moods']],
            'allLabel': discovery['all_label'], 'allIcon': discovery['all_icon'], 'packs': discovery['packs'], 'todayPool': discovery['today_pool'],
            'synonyms': discovery['synonyms'], 'eager': EAGER_CARDS, 'collapsed': COLLAPSED_CARDS,
            'hero': hero_data,
            'games': [{**slim(r), **({'discovery': discovery['rows'][r['id']]} if r['group'] == 'games' else {})} for r in pupil_rows]}
    substitutions = {'@@SPRITE@@': sprite(discovery), '@@LOGO@@': logo, '@@FOOTERLOGO@@': footer_logo, '@@HERO@@': hero_section(hero),
                     '@@MOODS@@': mood_buttons, '@@ALLTITLE@@': esc(discovery['all_label']) + ' games',
                     '@@COUNT@@': str(len(games)) + ' games', '@@SHOWALL@@': 'Show all ' + str(len(games)), '@@GRID@@': ''.join(cards),
                     '@@CLASSROOM@@': classroom, '@@ACTIVITIES@@': str(len(activities)), '@@NOSCRIPT@@': noscript_list(pupil_rows),
                     '@@DATA@@': json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')}
    for a, b in substitutions.items():
        if a not in template: raise ValueError('template slot missing: ' + a)
        template = template.replace(a, b)
    assert '@@' not in template
    # The staff calibration item is published (its payload and its catalogue row
    # stay) but it is never linked from, named on, or carried by the pupil page.
    for row in staff:
        for needle in {row['route'], unquote(row['route']), row['id'], row['title']}:
            if needle in template: raise ValueError('staff item reached the pupil page: ' + row['title'])
    for name in ALIASES:
        p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(template)
    assert (target/'data/domain-catalogue.json').read_bytes() == original
    report={'counts':counts,'total':len(rows),'catalogue_sha256':hashlib.sha256(original).hexdigest(),
            'brand_status':brand.get('status','original-asset-unresolved'), 'accepted_clips':len(clips_by_route),
            'grid_cards':len(cards),'series':{k:len(v) for k,v in series.items()},'genres':genres,
            'featured':[r['route'] for r in featured],
            'moods':mood_counts,'packs':[p['slug'] for p in discovery['packs']],'today_pool':len(discovery['today_pool']),
            'covers':sorted(discovery['covers']),'pictures':dict(Counter(v['pictureKind'] for v in discovery['rows'].values())),
            'staff_on_page':0,
            'updated_rail':[r['id'] for r in sorted([r for r in rows if r.get('updated')], key=lambda r: r['updated']['date'], reverse=True)],
            'line_sources':dict(Counter(r['lineSource'] for r in rows)),
            'hero':{'slug':hero['slug'],'id':hero['row']['id'],'has_clip':bool(hero['video'])},
            'changed_game_payloads':0,'canonical_origin':ORIGIN,'shared_runtime_changed':False,
            'omitted_discovery':omitted_discovery}
    (Path(output)/'play-discovery-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


# --- PLAY-D2 front page helpers -----------------------------------------------
COVERS = HERE / 'covers'
DISCOVERY = HERE / 'discovery-moods.json'
HERO_WEEK = HERE / 'hero-week.json'
HERO_LINE_MAX = 90
HERO_DATE_RE = re.compile(
    r'\b(?:20\d{2}|(?:19|20)\d{2}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b',
    re.I,
)
MOOD_IDS = ('fast', 'race', 'sport', 'solve', 'plan', 'explore', 'chill', 'mates')
EAGER_CARDS = 8       # the first eight A-Z pictures load eagerly, the rest lazily
COLLAPSED_CARDS = 12  # the A-Z grid shows this many until "Show all"
HOOK_WORDS = 8
COVER_LIMIT = 20 * 1024
COVER_FORBIDDEN = re.compile(r'<\s*(script|image|text|foreignObject|use|a)\b|href\s*=|url\s*\(\s*(?!#)|@import|on[a-z]+\s*=', re.I)
# One sprite per page: every card repeats only a <use> reference, so 66 cards stay small.
SPRITE_SHAPES = {
    'i-heart': ('0 0 20 20', '<path d="M10 16.8 8.7 15.6C4.4 11.7 1.8 9.4 1.8 6.4A3.8 3.8 0 0 1 5.6 2.6c1.5 0 2.9.8 3.6 2a4.2 4.2 0 0 1 3.6-2 3.8 3.8 0 0 1 3.8 3.8c0 3-2.6 5.3-6.9 9.2L10 16.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
    'i-keys': ('0 0 18 18', '<g fill="none" stroke="currentColor"><rect x="1.5" y="4" width="15" height="10" rx="2" stroke-width="1.6"/><path d="M4.5 7.2h1.5M8.2 7.2h1.6M12 7.2h1.5M5.2 10.8h7.6" stroke-width="1.5" stroke-linecap="round"/></g>'),
    'i-tri': ('0 0 16 16', '<path d="M4.2 2.8 13.4 8 4.2 13.2Z" fill="currentColor"/>'),
}
HEART = '<svg class="heart" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><use href="#i-heart"/></svg>'
KEYS_ICON = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><use href="#i-keys"/></svg>'
TRI = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#i-tri"/></svg>'

def icon_svg(mood_id):
    return '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false"><use href="#m-' + mood_id + '"/></svg>'

def sprite(discovery):
    symbols = [('m-all', '0 0 20 20', discovery['all_icon'])] + [('m-' + m['id'], '0 0 20 20', m['icon']) for m in discovery['moods']] + [(k, v[0], v[1]) for k, v in SPRITE_SHAPES.items()]
    return '<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">' + ''.join('<symbol id="' + i + '" viewBox="' + vb + '">' + body + '</symbol>' for i, vb, body in symbols) + '</svg>'

def needs_keys(row):
    return bool(row['controls']) and 'touch' not in row['controls']

def discovery_join(games, target):
    """Join discovery-moods.json to the catalogue by route and prove every rule the
    D2 brief sets for it. Raises on the first broken rule; returns the joined data."""
    spec = json.loads(DISCOVERY.read_text(encoding='utf-8'))
    if spec.get('schema') != 1: raise ValueError('Unsupported discovery-moods.json schema')
    moods = spec['moods']
    if [m['id'] for m in moods] != list(MOOD_IDS): raise ValueError('discovery moods must be exactly ' + ', '.join(MOOD_IDS) + ' in that order')
    for m in moods:
        if not m.get('label', '').strip() or '<' in m['label'] or not m.get('icon', '').strip(): raise ValueError('mood needs a label and an icon: ' + m['id'])
        if re.search(r'<\s*(script|image|text|use|a)\b|href|url\(', m['icon'], re.I): raise ValueError('mood icon must be plain shapes: ' + m['id'])
    by_key = {key(r['route']): r for r in games}
    rows_by_route = {key(k): v for k, v in spec['games'].items()}
    if len(rows_by_route) != len(spec['games']): raise ValueError('discovery-moods.json repeats a route')
    missing = sorted(set(by_key) - set(rows_by_route)); extra = sorted(set(rows_by_route) - set(by_key))
    if missing or extra: raise ValueError('discovery-moods.json must hold every catalogue game once: missing ' + json.dumps(missing) + ' extra ' + json.dumps(extra))
    covers = spec['covers']
    for name, rec in covers.items():
        if Path(name).name != name or not name.endswith('.svg'): raise ValueError('Invalid cover filename: ' + name)
        raw = (COVERS/name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != rec['sha256'] or len(raw) != rec['bytes']: raise ValueError('Cover bytes changed: ' + name)
        text = raw.decode('utf-8')
        if len(raw) > COVER_LIMIT: raise ValueError('Cover over 20 KB: ' + name)
        if not re.match(r'<svg xmlns="http://www\.w3\.org/2000/svg" viewBox="0 0 640 360"', text): raise ValueError('Cover must be a 640x360 SVG: ' + name)
        if COVER_FORBIDDEN.search(text) or text.count('http') != 1: raise ValueError('Cover carries text, script, a picture or an outside reference: ' + name)
    on_disk = {p.name for p in COVERS.glob('*')}
    if on_disk != set(covers): raise ValueError('covers on disk differ from discovery-moods.json covers: ' + json.dumps(sorted(on_disk ^ set(covers))))
    out, counts, used_covers = {}, Counter(), set()
    for k, spec_row in rows_by_route.items():
        row = by_key[k]
        if spec_row['title'] != shown_title(row): raise ValueError('discovery-moods.json title differs from the catalogue: ' + spec_row['title'])
        primary, secondary = spec_row['primary'], spec_row['secondary']
        if primary not in MOOD_IDS or (secondary is not None and (secondary not in MOOD_IDS or secondary == primary)): raise ValueError('Invalid mood for ' + spec_row['title'])
        hook = spec_row['hook']
        words = hook.split()
        if not words or len(words) > HOOK_WORDS or not hook.endswith('.') or '<' in hook: raise ValueError('Hook must be one short sentence of eight words or fewer: ' + spec_row['title'])
        picture = spec_row['picture']
        if picture.startswith('/assets/play2/covers/'):
            name = picture.rsplit('/', 1)[1]
            if name not in covers: raise ValueError('Cover not recorded: ' + picture)
            used_covers.add(name); kind = 'cover'
        elif picture.startswith('/assets/play/screens/'):
            if picture != row['image']: raise ValueError('Screen picture is not the byte-bound capture for ' + spec_row['title'])
            kind = 'screen'
        elif picture.startswith('/assets/play/media/'):
            if picture != (row.get('media') or {}).get('poster'): raise ValueError('Media picture is not the accepted poster for ' + spec_row['title'])
            kind = 'poster'
        elif re.fullmatch(r'/assets/cards/[a-z0-9-]+\.(svg|webp)', picture):
            if not (target/picture.lstrip('/')).is_file(): raise ValueError('Card picture is not published: ' + picture)
            kind = 'card'
        else:
            raise ValueError('Picture must be a cover, a screen, an accepted poster or a published card: ' + picture)
        counts[primary] += 1
        if secondary: counts[secondary] += 1
        out[row['id']] = {'primary': primary, 'secondary': secondary, 'hook': hook, 'picture': picture, 'pictureKind': kind,
                          'wholeClass': spec_row['whole_class'] is True, 'twoPlayer': spec_row['two_player'] is True,
                          'keysOnly': needs_keys(row), 'words': ' '.join(str(spec_row.get('words', '')).split())}
    if used_covers != set(covers): raise ValueError('recorded covers that no game uses: ' + json.dumps(sorted(set(covers) - used_covers)))
    ready = lambda gid: 'touch' in by_id_of(games)[gid]['controls'] and not out[gid]['wholeClass']
    def ids(routes, label):
        found = []
        for route in routes:
            r = by_key.get(key(route))
            if r is None: raise ValueError(label + ' names a route that is not a catalogue game: ' + route)
            found.append(r['id'])
        if len(found) != len(set(found)): raise ValueError(label + ' repeats a game')
        return found
    packs = []
    for p in spec['packs']:
        if not re.fullmatch(r'[a-z0-9-]+', p['slug']) or not p['name'].strip(): raise ValueError('Invalid pack: ' + json.dumps(p))
        members = ids(p['routes'], 'pack ' + p['slug'])
        if len(members) != 3: raise ValueError('a pack holds exactly three games: ' + p['slug'])
        bad = [m for m in members if not ready(m)]
        if bad: raise ValueError('pack games must be touch-ready and not whole-class: ' + p['slug'] + ' ' + json.dumps(bad))
        packs.append({'slug': p['slug'], 'name': p['name'], 'games': members})
    if len(packs) < 2 or len({p['slug'] for p in packs}) != len(packs): raise ValueError('packs need at least two distinct slugs')
    pool = ids(spec['today_pool'], 'today_pool')
    bad = [m for m in pool if not ready(m)]
    if bad: raise ValueError('Today pool games must be touch-ready and not whole-class: ' + json.dumps(bad))
    if len(pool) < 7 + 3: raise ValueError('Today pool too small to avoid the week pack and repeats')
    synonyms = spec['synonyms']
    if not all(isinstance(v, list) and all(isinstance(s, str) for s in v) for v in synonyms.values()): raise ValueError('synonyms must map a word to a list of words')
    all_label = spec['all_label'].replace('{n}', str(len(games)))
    return {'rows': out, 'counts': {m: counts[m] for m in MOOD_IDS}, 'moods': moods, 'all_label': all_label, 'all_icon': spec['all_icon'],
            'packs': packs, 'today_pool': pool, 'synonyms': synonyms, 'covers': covers}

def by_id_of(rows):
    return {r['id']: r for r in rows}

def updated_text(row):
    """J92 R6 kept: every row the catalogue marks updated says so on its one grid card.
    Ruling 21 Nov: the ribbon and its spoken label carry no date or version text."""
    return 'Updated' if row.get('updated') else ''

def card_media(row, d, eager, moods):
    load = 'loading="eager"' if eager else 'loading="lazy" decoding="async"'
    mood = d['primary']
    updated = updated_text(row)
    return ('<span class="card-media thumb"><img src="' + esc(d['picture']) + '" alt="" width="640" height="360" ' + load + '>'
            '<span class="thumb-title" aria-hidden="true">' + esc(shown_title(row)) + '</span>'
            # Mood chip and Updated ribbon share one wrapping row: when both do not fit (narrow
            # card, wide fallback font) the ribbon drops to its own line instead of colliding.
            '<span class="media-tags"><span class="mood-chip" aria-hidden="true">' + icon_svg(mood) + '<span>' + esc(moods[mood]['label']) + '</span></span>'
            + ('<span class="upd-ribbon" data-release="' + esc(row['id']) + '" aria-hidden="true">' + esc(updated) + '</span>' if updated else '') + '</span>'
            + ('<span class="kb-badge" data-needs-keyboard hidden>' + KEYS_ICON + '<span>Needs keyboard</span></span>' if d['keysOnly'] else '') + '</span>')

def game_card(row, d, eager, moods):
    """D2 card: picture, title, hook and play triangle are ONE link; the heart is a
    sibling button. data-card/data-games/a[data-play] keep the shelf contract."""
    title = shown_title(row)
    return ('<article class="card card-sm game-card" data-card="' + esc(row['id']) + '" data-games="' + esc(row['id']) + '" data-mood="' + esc(d['primary']) + '"'
            + (' data-keys-only' if d['keysOnly'] else '') + '>'
            '<a class="card-link" href="' + esc(row['route']) + '" data-play="' + esc(row['id']) + '" aria-label="Play ' + esc(title) + (', ' + esc(updated_text(row).lower()) if row.get('updated') else '') + '">'
            + card_media(row, d, eager, moods) +
            '<span class="card-body"><span class="card-head"><span class="card-title">' + esc(title) + '</span><span class="play-tri" aria-hidden="true">' + TRI + '</span></span>'
            '<span class="card-hook">' + esc(d['hook']) + '</span></span></a>'
            '<button type="button" class="fav-btn" data-favourite="' + esc(row['id']) + '" aria-pressed="false" aria-label="Save ' + esc(title) + '" hidden>' + HEART + '</button></article>')

def activity_item(row):
    return ('<li class="activity-item" data-activity="' + esc(row['id']) + '"><a class="activity-link" data-play="' + esc(row['id']) + '" href="' + esc(row['route']) + '">'
            '<span class="activity-name">' + esc(shown_title(row)) + '</span><span class="activity-sub">Lesson activity</span></a></li>')


def hero_week_join(games, discovery_rows, target, path=None):
    """Validate hero-week.json against the live Play catalogue and emitted covers/clips."""
    spec_path = Path(path) if path is not None else HERO_WEEK
    if not spec_path.is_file():
        raise ValueError('hero-week.json is missing')
    raw = json.loads(spec_path.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError('hero-week.json must be a JSON object')
    week = raw.get('week')
    if not isinstance(week, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', week):
        raise ValueError('hero-week.json week must be an ISO YYYY-MM-DD date')
    try:
        date.fromisoformat(week)
    except ValueError as err:
        raise ValueError('hero-week.json week is not a valid calendar date: ' + week) from err
    slug = raw.get('slug')
    if not isinstance(slug, str) or not slug.strip():
        raise ValueError('hero-week.json slug must be a non-empty string')
    slug = slug.strip()
    live_games = [r for r in games if r.get('group', 'games') == 'games']
    matches = []
    for r in live_games:
        rk = key(r['route'])
        top_slug = rk.lstrip('/')
        if (r['id'] == slug
                or r['id'].removeprefix('game-') == slug
                or rk == key(slug)
                or ('/' not in top_slug and top_slug == slug)):
            matches.append(r)
    if not matches:
        for r in live_games:
            pic = (discovery_rows.get(r['id']) or {}).get('picture', '')
            if pic.startswith('/assets/play2/covers/') and Path(pic).stem == slug:
                matches.append(r)
    if len(matches) != 1:
        raise ValueError('hero-week.json slug is not a live Play game: ' + slug)
    row = matches[0]
    line = raw.get('line')
    if not isinstance(line, str) or not line.strip():
        raise ValueError('hero-week.json line must be a non-empty string')
    line = line.strip()
    if len(line) > HERO_LINE_MAX:
        raise ValueError(f'hero-week.json line is over {HERO_LINE_MAX} characters ({len(line)}): ' + line)
    if '<' in line or '>' in line:
        raise ValueError('hero-week.json line must be plain text: ' + line)
    if HERO_DATE_RE.search(line):
        raise ValueError('hero-week.json line must not contain date text: ' + line)
    d = discovery_rows.get(row['id']) or {}
    cover = (d.get('picture') or '').strip()
    if not cover or not (target / cover.lstrip('/')).is_file():
        raise ValueError('hero-week.json game has no cover: ' + slug)
    m = row.get('media') or {}
    video = m.get('video') or ''
    poster = m.get('poster') or ''
    has_clip = bool(video and poster and (target / video.lstrip('/')).is_file() and (target / poster.lstrip('/')).is_file())
    if has_clip:
        still, still_kind = poster, 'poster'
    else:
        still, video, poster = cover, '', ''
        still_kind = d.get('pictureKind') or 'cover'
    return {
        'slug': slug, 'row': row, 'discovery': d, 'line': line,
        'cover': cover, 'still': still, 'still_kind': still_kind,
        'video': video, 'poster': poster,
    }


def hero_section(hero):
    """Render the static PLAY-D5 Game-of-the-week hero block as the first child of <main>."""
    row = hero['row']
    d = hero['discovery']
    title = shown_title(row)
    if hero['still_kind'] == 'poster':
        alt = title + ' gameplay preview'
    elif hero['still_kind'] == 'cover':
        alt = title + ' cover'
    else:
        alt = title + ' game screen'
    media_attrs = (' data-hero-video="' + esc(hero['video']) + '" data-hero-poster="' + esc(hero['poster']) + '"') if hero['video'] else ''
    return ('<section class="sec hero-sec" id="hero-section" aria-labelledby="hero-title" tabindex="-1">'
            '<div class="hero-card" data-hero="' + esc(row['id']) + '" data-mood="' + esc(d.get('primary', '')) + '">'
            '<div class="hero-media" id="hero-media"' + media_attrs + '>'
            '<img src="' + esc(hero['still']) + '" alt="' + esc(alt) + '" width="640" height="360" loading="eager" fetchpriority="high" decoding="async">'
            '<span class="thumb-title" aria-hidden="true">' + esc(title) + '</span></div>'
            '<div class="hero-body">'
            '<p class="hero-label" id="hero-label">Game of the week</p>'
            '<h1 class="hero-title" id="hero-title">' + esc(title) + '</h1>'
            '<p class="hero-line" id="hero-line">' + esc(hero['line']) + '</p>'
            '<div class="hero-actions"><a class="btn btn-primary hero-play" id="hero-play" href="' + esc(row['route']) + '" data-play="' + esc(row['id']) + '" aria-label="Play ' + esc(title) + '">' + TRI + '<span>Play</span></a></div>'
            '</div></div></section>')

if __name__ == '__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True,type=Path);ap.add_argument('--review',action='store_true');args=ap.parse_args()
    print(json.dumps(refresh(args.output,review=args.review),indent=2))
