"""Presentation-only annotation shared by source and publication renderers.

Never rewrites text, destinations, forms, hidden state or reading order. Keeping
the original classes also preserves consumers of the existing card contracts.
"""
import json
import re
from pathlib import Path

ROUTES = {'/', '/main/', '/teach/', '/education-hub/', '/stats/', '/members/',
          '/uas/', '/evidence-binder/moderator-pro/', '/privacy/', '/mailing-list/', '/thanks/'}
CARDS = set('mf-choice mf-route-card mf-feature mf-task-card mf-surprise-card '
            'mf-pupil-game mf-root-highlight mf-utility mbm-audience-card '
            'mbm-start-card mbm-task-card dx-tile dx-fcard dx-chip '
            'home-door-card home-pathway-card home-subject-tile home-tool-card '
            'ad-card sx-card usage-card fd-shortcut fd-subject ma-panel card pv-note pv-lead'.split())
LINKS = ('<link rel="stylesheet" href="/assets/mbm-tile.css">'
         '<script defer src="/assets/mbm-tile.js"></script>')
AUDIENCE_ROUTES = frozenset(audience['route'] for audience in json.loads(
    (Path(__file__).resolve().parent.parent / 'data/audience-homepages.json').read_text(encoding='utf-8')
)['audiences'].values())


def annotate(text, route):
    if route not in ROUTES and route not in AUDIENCE_ROUTES:
        return text
    # Reuse a glyph already authored on this page; no external sprite or asset.
    glyph = re.search(r'<svg\b[^>]*>.*?</svg>', text, re.S)
    slot = ('<span class="mbm-tile-icon" aria-hidden="true">' + glyph[0] + '</span>') if glyph else ''
    # Only real opening tags, never JavaScript strings or stylesheet selectors.
    def mark(match):
        tag = match.group(0)
        classes = re.search(r'\bclass="([^"]*)"', tag)
        if classes and CARDS.intersection(classes[1].split()) and 'data-mbm-tile' not in tag:
            tag = tag[:-1] + ' data-mbm-tile="">'
            if set(classes[1].split()) & {'mf-route-card', 'mf-task-card', 'mbm-start-card', 'mbm-task-card'}:
                tag += slot
        return tag
    def region(markup):
        # The release stack has its own publication contract and pinned markup.
        # Preserve that whole region, including links that share hub classes.
        if route == '/main/':
            pieces = re.split(r'(<section\b[^>]*\bid="newrelease"[^>]*>.*?</section>)', markup, flags=re.S)
            if len(pieces) > 1:
                return ''.join(piece.replace(' data-mbm-tile=""', '') if i % 2 else unprotected(piece)
                               for i, piece in enumerate(pieces))
        return unprotected(markup)

    def unprotected(markup):
        return ''.join(part if re.match(r'<(?:script|style)\b', part, re.I) else
                       re.sub(r'<(?:a|article|section|div|aside)\b[^>]*>', mark, part)
                       for part in re.split(r'(<(?:script|style)\b[^>]*>.*?</(?:script|style)>)', markup, flags=re.S | re.I))
    boundary = 'main' if '<main' in text else 'body'
    text = re.sub(r'(<'+boundary+r'\b[^>]*>)(.*?)(</'+boundary+r'>)',
                  lambda m: m[1] + region(m[2]) + m[3], text, flags=re.S)
    if 'data-mbm-tile=""' not in text:
        return text
    # Put one existing starting action immediately below the hero's short lead.
    # It is moved, never duplicated: every original control and sentence survives.
    if 'data-mbm-hero-tile' not in text and route in {'/teach/', '/education-hub/', '/for/teachers/'}:
        first = re.search(r'<a class="(?:mbm-task-card|mbm-start-card|fd-shortcut)"[^>]*>.*?</a>', text, re.S)
        lead = re.search(r'<p class="(?:mbm-hub-lead|fd-lead)"[^>]*>.*?</p>', text, re.S)
        if first and lead and first.start() > lead.end():
            tile = first[0].replace(' data-mbm-tile=""', ' data-mbm-tile="" data-mbm-hero-tile', 1)
            text = text[:first.start()] + text[first.end():]
            text = text[:lead.end()] + tile + text[lead.end():]
    if '/assets/mbm-tokens.css' not in text:
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/mbm-tokens.css"></head>', 1)
    if '/assets/mbm-tile.css' not in text:
        text = text.replace('</head>', LINKS + '</head>', 1)
    return text
