"""SW2 H/U: Education-only front doors. Records own subjects and audience routes.

Prepared previews are real PDF page renders, admitted only while their source
hash matches the Lessons input. Missing or changed sources use no image.
"""
import html
import hashlib
import json
from urllib.parse import quote


def esc(value):
    return html.escape(str(value), quote=True)


def search(kind):
    ident = 'home-resource-query' if kind == 'home' else kind + '-q'
    placeholder = {'home': 'Try Science, Humanities or PDF Studio', 'teachers': 'Try Science or PDF Studio', 'pupils': 'Type the name your teacher gave you'}[kind]
    label = 'Find your activity' if kind == 'pupils' else 'Search lessons and resources'
    button = 'Find it' if kind == 'pupils' else 'Search'
    if kind == 'home':
        button = line_icon('search')
    # Keep the existing audience search implementation and its pupil-safe catalogue.
    # The homepage searches the Resources index through one progressively enhanced control.
    tag = 'div' if kind == 'home' else 'form'
    hook = 'data-home-search' if kind == 'home' else 'data-search="' + kind + '"'
    result = '' if kind == 'home' else f'<p class="status" id="{kind}-status" aria-live="polite"></p><div class="results" id="{kind}-results"></div><button class="fd-button fd-outline more" id="{kind}-more" type="button" hidden>Show more {"activities" if kind == "pupils" else "resources"}</button>'
    return '<div class="fd-search-block">' + f'<{tag} class="fd-search" {hook} role="search"><label for="{ident}">{label}</label><div class="fd-search-row"><input id="{ident}" type="search" maxlength="200" placeholder="{placeholder}" autocomplete="off"><button class="fd-button" aria-label="{'Find it' if kind == 'pupils' else 'Search'}" type="{"button" if kind == "home" else "submit"}">{button}</button></div></{tag}>' + result + '</div>'


ICONS = {
    'science': '<path d="M9 3h6M10 3v6L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V3M7 15h10"/>',
    'humanities-re': '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/>',
    'art-studio': '<path d="M21 11a9 9 0 1 0-9 10h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.2-2.5H18a3 3 0 0 0 3-4.2Z"/><circle cx="7.5" cy="9" r="1"/><circle cx="11" cy="6.5" r="1"/><circle cx="15.5" cy="8" r="1"/><circle cx="6.5" cy="13.5" r="1"/>',
    'lifeskills': '<path d="m4 3 4 3v3l10 11 3-3L10 7H7L4 3Zm14 0-3 3 3 3 3-3a5 5 0 0 1-6 6L6 21l-3-3 9-9a5 5 0 0 1 6-6Z"/>',
    'book': '<path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/>',
    'person': '<circle cx="12" cy="6" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3ZM9 14l3 3 3-3"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
}


def line_icon(name):
    return '<svg class="fd-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS.get(name, ICONS['book']) + '</svg>'


def preview_data(bp):
    """Use prepared PDF renders only for the exact current source bytes."""
    manifest = json.loads((bp.HERE / 'homepage-previews.json').read_text())
    valid = {}
    if bp.LESSONS_ROOT is None:
        return valid
    rows = json.loads((bp.LESSONS_ROOT / 'resources.json').read_text())
    for key, item in manifest.items():
        row = next((r for r in rows if r.get('id') == key and r.get('file') == item['resourceFile']), None)
        if not row:
            continue
        listed = {f['path'] for f in row.get('files', []) if f.get('type') == 'pdf'}
        images = []
        for image in item['images']:
            source = bp.LESSONS_ROOT / image['source']
            if image['source'] in listed and source.is_file() and hashlib.sha256(source.read_bytes()).hexdigest() == image['sourceSha256']:
                images.append(image)
        if images:
            valid[key] = {'resourceFile': row['file'], 'images': images}
    return valid


def subject_tiles(bp, lessons, featured=False):
    cards = bp.subject_pathway_cards(lessons)
    extras = [] if featured else bp.extra_subject_tiles(lessons)
    return '<div class="fd-subjects" data-subject-tiles>' + ''.join(
        '<a class="fd-subject ' + esc(slug) + '" href="/Lessons/subject.html?subject=' + esc(slug) + '"><h3>' + esc(name) + '</h3><span class="fd-symbol" aria-hidden="true">' + line_icon(slug) + '</span><span class="fd-arrow" aria-hidden="true">→</span></a>'
        for slug, name in [(c['slug'], c['name']) for c in cards] + extras) + '</div>'


def featured_lesson(bp):
    """A reviewed lesson and its authentic pack preview, or no feature."""
    if bp.LESSONS_ROOT is None:
        return ''
    review = json.loads((bp.HERE / 'homepage-feature.json').read_text())
    rows = json.loads((bp.LESSONS_ROOT / 'resources.json').read_text())
    pack = next((r for r in rows if r.get('id') == review['packId']), None)
    lesson = bp.LESSONS_ROOT / review['lessonFile']
    preview = preview_data(bp).get(review['packId'])
    if (not pack or pack.get('companionOf') != review['lessonFile'] or not preview
            or not lesson.is_file() or hashlib.sha256(lesson.read_bytes()).hexdigest() != review['lessonSha256']):
        return ''
    image = preview['images'][0]
    return ('<div class="fd-pack-copy"><p class="fd-eyebrow">TRY A LESSON</p><h2>' + esc(review['displayTitle'])
            + '</h2><p>' + esc(review['description']) + '</p><div class="fd-chips"><span class="fd-chip grow">GROW</span>'
            + '<span class="fd-feature-meta">Science · 40 minutes</span></div><p class="fd-muted">Reference: W8A · Explore</p>'
            + action('/Lessons/' + review['lessonFile'], 'Try this lesson →')
            + '<a class="fd-feature-pack-link" href="/resources/?q=' + quote(review['displayTitle'], safe='') + '">Find teaching resources →</a></div>'
            + '<figure class="fd-feature-preview"><img class="fd-page-preview" src="' + esc(image['dataUri'])
            + '" alt="Preview of the Day and Night teaching slides" width="' + str(review['previewWidth'])
            + '" height="' + str(review['previewHeight']) + '" decoding="async" data-preview-source="' + esc(image['source'])
            + '" data-preview-sha="' + esc(image['sourceSha256']) + '"><figcaption>From the teaching pack</figcaption></figure>')


def action(href, label, outline=False):
    return '<a class="fd-button' + (' fd-outline' if outline else '') + '" href="' + esc(href) + '">' + esc(label) + '</a>'


def footer(record, bp, kind):
    if kind == 'pupils':
        rows = [('/Lessons/', 'Lessons'), ('/resources/', 'Resources'), ('/privacy/', 'Privacy')]
    else:
        rows = [(record[k]['route'], record[k]['label']) for k in ('teachers', 'pupils', 'parents')]
    links = ''.join('<a href="' + esc(route) + '">' + esc(label) + '</a>' for route, label in rows)
    # Retired teacher shortcuts remain reachable in two taps from the homepage.
    if kind == 'teachers':
        links += ''.join('<a href="' + r + '">' + t + '</a>' for r, t in [('/teach/', 'Teacher workspace'), ('/tools/', 'Tools Hub'), ('/education-hub/', 'Education Hub'), ('/stats/', 'Shared activity'), ('/members/', 'Members’ area')])
    return '<footer class="footer fd-footer"><div class="wrap"><nav class="fd-footer-links" aria-label="Learning footer">' + links + '</nav><p>Learn • Build • Explore</p></div></footer>'


def render(kind, origin, bp):
    record = json.loads(bp.AUDIENCE_RECORD.read_text())['audiences']
    subjects = subject_tiles(bp, bp.LESSONS_ROOT, featured=kind == 'home')
    primary = bp.LESSONS_ROOT is not None and (bp.LESSONS_ROOT / 'primary/index.html').is_file()
    if kind == 'home':
        hero = '<p class="fd-eyebrow">MADE BY A TEACHER. BUILT FOR REAL CLASSROOMS.</p><h1>Big on ideas. Light on prep.</h1><p class="fd-lead">Interactive lessons, practical resources and useful teaching tools—all in one place, ready to help you bring learning to life.</p>' + search(kind) + '<div class="fd-actions">' + action('/Lessons/', 'Browse lessons →', True) + action('/resources/?type=pack', 'Teaching packs', True) + '</div>'
        hero += '<nav class="fd-audience-entry" aria-label="Choose your starting point">' + ''.join('<a href="' + esc(record[k]['route']) + '">' + esc(record[k]['label']) + ' →</a>' for k in ('teachers', 'pupils', 'parents')) + '</nav>'
        pack = featured_lesson(bp)
        feature_attrs = ' data-featured-lesson="pack-grow-science-w8a"'
        body = '<section class="fd-hero wrap"><div>' + hero + '</div>' + ('<aside class="fd-pack fd-hero-pack"' + feature_attrs + ' aria-label="Featured lesson">' + pack + '</aside>' if pack else '') + '</section>'
        body += '<section class="fd-section wrap"><div class="fd-section-head"><h2>Explore a subject</h2><a href="/Lessons/">View all →</a></div>' + subjects + '</section>'
        body += '<section class="fd-section fd-pathways wrap"><h2>Three pathways, one place</h2><div class="fd-chips"><span class="fd-chip build">BUILD</span><span class="fd-chip grow">GROW</span><span class="fd-chip launch">LAUNCH</span></div></section>'
        if pack:
            body += '<section class="fd-section wrap fd-phone-packs" aria-label="Featured lesson"><article class="fd-pack"' + feature_attrs + '>' + pack + '</article></section>'
        body += '<section class="fd-section wrap" id="added" hidden><div class="fd-section-head"><h2 id="added-h">Added this half-term</h2><a id="added-all" href="/Lessons/?added=current">See all →</a></div><div class="fd-added-grid"><div id="added-rail"></div><article class="fd-pack-promo"><h3>Ready-to-teach packs</h3><p>Editable slides, print resources and teacher guidance.</p>' + action('/resources/?type=pack', 'Explore packs →', True) + '</article></div></section>'
        rows = [(record[k]['route'], record[k]['label']) for k in ('teachers', 'pupils', 'parents')]
        if primary: rows.append(('/Lessons/primary/', 'Primary lessons'))
        body += '<section class="fd-section wrap fd-start" id="audiences"><h2>Find your starting point</h2><div class="fd-start-grid">' + ''.join('<a href="' + esc(r) + '">' + esc(n) + ' →</a>' for r, n in rows) + '<details><summary>Working with schools and organisations</summary><div class="fd-audience-rows" data-audience-rows>' + ''.join('<a class="audience-row" href="' + esc(r) + '">' + esc(n) + '</a>' for r, n in bp.audience_rows() if r != record['parents']['route']) + '</div></details></div></section>'
        body += '<section class="fd-maker" id="about"><div class="wrap">' + line_icon('person') + '<h2>Made by a teacher. For real classrooms.</h2><a href="/commission/#about-matt">Meet Matt →</a></div></section>'
        body += '<script type="application/json" id="home-preview-data">' + json.dumps(preview_data(bp), ensure_ascii=True).replace('<', '\\u003c') + '</script>'
    elif kind == 'teachers':
        body = '<section class="fd-hero wrap"><div><p class="fd-eyebrow">TEACHERS</p><h1>Ready for your next lesson?</h1><p class="fd-lead">Find a lesson, gather your resources and get ready to teach.</p>' + search(kind) + '<div class="fd-actions">' + action('/Lessons/', 'Browse lessons →') + action('/resources/', 'Find unit packs', True) + '</div></div></section>'
        shortcuts = [('/Lessons/?view=saved', 'Saved lessons', 'Return to lessons saved on this device.'), ('/resources/', 'Planning and evidence', 'Find schemes of work and evidence packs.'), ('/Matt-s-Apps-/', 'Classroom tools', 'Open tools for your lesson.')]
        if primary: shortcuts.append(('/Lessons/primary/', 'Primary lessons', 'Explore lessons for primary pupils.'))
        body += '<section class="fd-section wrap"><h2>Your teaching shortcuts</h2><div class="fd-shortcuts">' + ''.join('<a class="fd-shortcut" href="' + esc(r) + '"><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p><span aria-hidden="true">→</span></a>' for r, t, d in shortcuts) + '</div></section>'
        body += '<section class="fd-section wrap"><div class="fd-section-head"><h2>Browse by subject</h2><a href="/Lessons/">All subjects →</a></div>' + subjects + '</section>'
        body += '<section class="fd-maker"><div class="wrap"><h2>Made by a teacher. For real classrooms.</h2><p>Questions, ideas or something your class needs?</p><a href="mailto:contactmadebymatt@gmail.com">Contact Matt →</a></div></section>'
        note = record['teachers']
        body += '<section class="fd-section fd-safety wrap" id="teacher-note"><h2 id="teacher-note-title">' + esc(note['noteTitle']) + '</h2><p>' + esc(note['note']) + '</p></section>'
    else:
        body = '<section class="fd-hero wrap"><div><p class="fd-eyebrow">PUPILS</p><h1>What are you learning today?</h1><p class="fd-lead">Choose your subject. Your teacher will help you find your pathway and lesson.</p></div></section><section class="fd-section wrap"><h2>Choose your subject</h2>' + subjects + '</section><section class="fd-section wrap" id="pupil-search"><h2>Find your activity</h2>' + search(kind) + '<p class="fd-muted">Nothing to install. Ask your teacher if you are not sure where to start.</p></section>'
    route = '/' if kind == 'home' else record[kind]['route']
    title = {'home': 'Big on ideas. Light on prep.', 'teachers': 'Teachers', 'pupils': 'Pupils'}[kind]
    description = 'Interactive lessons, practical resources and useful teaching tools—all in one place, ready to help you bring learning to life.' if kind == 'home' else 'Practical lessons and teaching packs, ready to adapt.'
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' · Made by Matt</title><meta name="description" content="' + esc(description) + '"><link rel="canonical" href="' + origin + route + '"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/education-frontdoors.css"></head><body data-site-kind="education" data-page="' + kind + '" data-sw2-frontdoor><a class="skip" href="#content">Skip to content</a><header><a href="/">MADE BY MATT</a></header><main id="content">' + body + '</main>' + footer(record, bp, kind) + '<noscript><p class="wrap">Search needs JavaScript. Use the subject links to find your lesson.</p></noscript><script defer src="/assets/domain-site.js"></script>' + ('<script defer src="/assets/added-this-half-term.js"></script>' if kind == 'home' else '') + '</body></html>'
