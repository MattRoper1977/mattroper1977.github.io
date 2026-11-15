"""SW2 H/U: Education-only front doors. Records own subjects and audience routes.

Prepared previews are real PDF page renders, admitted only while their source
hash matches the Lessons input. Missing or changed sources use no image.

EDU-D3 (CX2 §5, 16 September 2026):
  EDU-HERO        hero artwork is a crop of Matt's approved images, placed only when the
                  served bytes match education-hero.json (prepare_education_hero.py).
  EDU-TRY-LESSON  the homepage feature is a rotation over the eligible EDU-Q1 lessons,
                  bound to the catalogue by bind_homepage_features.py; a stale binding
                  raises rather than serving a card the catalogue no longer supports.
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

FRONTDOOR_ICONS = {
    'saved': '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/><path d="m9 10 2 2 4-4"/>',
    'planning': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    'primary': '<path d="M12 20V9"/><path d="M12 13c-4 0-6-2.5-6-6 3.5 0 6 2 6 6Z"/><path d="M12 11c0-3.5 2.5-6 6-6 0 3.5-2 6-6 6Z"/>',
    'workspace': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20l4-4 4 4M12 16v4M7 9h6M7 12h10"/>',
    'recommended': '<polygon points="12 2 14.9 8.6 22 9.3 16.6 14 18.2 21 12 17.3 5.8 21 7.4 14 2 9.3 9.1 8.6"/>',
    'assembly': '<path d="M3 11v2a2 2 0 0 0 2 2h2l3 4h2l-1-4h2l6 3V6l-6 3H5a2 2 0 0 0-2 2Z"/>',
    'baseline': '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
    'careers': '<path d="M12 3v18M5 6h11l3 2.5L16 11H5V6ZM19 13H8l-3 2.5L8 18h11v-5Z"/>',
    'community': '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3.5 19v-2a4.5 4.5 0 0 1 9 0v2M11.5 19v-2a4.5 4.5 0 0 1 9 0v2"/>',
    'dt': '<path d="M4 20V4h5v11h11v5H4Z"/><path d="M9 8H6M9 12H6M12 15v3M16 15v3"/>',
    'ict': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M8 9l-2 2 2 2M16 9l2 2-2 2M13 8l-2 6"/>',
    'intervention': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
    'local': '<path d="M12 21s-6-5.4-6-10a6 6 0 1 1 12 0c0 4.6-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/>',
    'rse': '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7.5a4 4 0 0 1 7 3C19 15.5 12 20 12 20Z"/>',
    'rshe': '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7.5a4 4 0 0 1 7 3C19 15.5 12 20 12 20Z"/><path d="M9 11h6M12 8v6"/>',
    'rivers': '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    'cpd': '<path d="m2 9 10-5 10 5-10 5-10-5Z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5M22 9v6"/>',
    'trekkers': '<path d="m3 19 6-10 4 6 3-4 5 8H3Z"/><path d="m9 9 2 3"/>',
    'tutor': '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6Z"/><path d="M8 9h8M8 13h5"/>',
}


def line_icon(name):
    path = ICONS.get(name) or FRONTDOOR_ICONS.get(name, ICONS['book'])
    return '<svg class="fd-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + '</svg>'


def subject_meta(slug, raw_name):
    exact = {
        'science': ('science', 'fd-acc-science', 'Science', 'Experiments, nature, forces and space', 'Biology, chemistry, physics and enquiry'),
        'humanities-re': ('humanities-re', 'fd-acc-humanities', 'Humanities & RE', 'History, places, beliefs and big questions', 'History, geography, ethics and worldviews'),
        'art-studio': ('art-studio', 'fd-acc-art', 'Art Studio', 'Drawing, painting, making and artists', 'Visual art, studio practice and projects'),
        'lifeskills': ('lifeskills', 'fd-acc-lifeskills', 'Lifeskills', 'Everyday skills, wellbeing and independence', 'Personal development, money and life skills'),
        'x-assembly': ('assembly', 'fd-acc-humanities', 'Assemblies & Themes', 'Whole-school stories and big questions', 'Whole-school themes and reflection'),
        'x-baseline': ('baseline', 'fd-acc-science', 'Starting Checks', 'Short tasks to show what you already know', 'Initial subject and skill snapshots'),
        'x-careers': ('careers', 'fd-acc-lifeskills', 'Careers & Future Plans', 'Jobs, workplaces and next steps', 'Workplaces, pathways and future options'),
        'x-community-projects': ('community', 'fd-acc-wellbeing', 'Community Projects', 'Teamwork and local action tasks', 'Practical teamwork and community action'),
        'x-dt': ('dt', 'fd-acc-art', 'Design & Making (DT)', 'Plan, build and test practical ideas', 'Design, making and practical builds'),
        'x-ict': ('ict', 'fd-acc-digital', 'Computing & Digital (ICT)', 'Digital skills, safety and creative tech', 'Computing tasks and digital literacy'),
        'x-intervention-y10': ('intervention', 'fd-acc-science', 'Focused Boost (Year 10)', 'Guided catch-up and confidence builders', 'Targeted Year 10 catch-up sessions'),
        'x-local-choice': ('local', 'fd-acc-humanities', 'Local Area Topics', 'Places, heritage and nature enquiries', 'Place-based enrichment enquiries'),
        'x-planning': ('planning', 'fd-acc-lifeskills', 'Organising & Study Skills', 'Plan tasks and track your steps', 'Curriculum and session organisation'),
        'x-rse': ('rse', 'fd-acc-wellbeing', 'Relationships & Growing Up', 'Respect, friendships and staying safe', 'Relationships and safety lessons'),
        'x-rshe': ('rshe', 'fd-acc-wellbeing', 'Health, Wellbeing & Relationships', 'Healthy habits, feelings and safety', 'Health, wellbeing and relationships'),
        'x-rivers': ('rivers', 'fd-acc-humanities', 'Rivers & Landscapes', 'Water, valleys and fieldwork enquiries', 'Physical geography enquiries'),
        'x-staff-cpd': ('cpd', 'fd-acc-digital', 'Staff Guides (Ask Your Teacher)', 'Adult training materials for staff', 'Professional development sessions'),
    }
    if slug in exact:
        return exact[slug]
    if 'trekkers' in slug:
        return ('trekkers', 'fd-acc-wellbeing', 'Outdoor & Trail Challenges', 'Navigation, teamwork and outdoor routes', 'Outdoor learning and route challenges')
    if 'tutor-time' in slug:
        return ('tutor', 'fd-acc-lifeskills', 'Form & Tutor Time', 'Daily check-ins, citizenship and staying safe', 'Tutor-time discussion and safeguarding')
    return ('book', 'fd-acc-science', raw_name, 'Classroom activities and lessons', 'Classroom lessons and materials')


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


def subject_tiles(bp, lessons, featured=False, pupil_calm=False):
    cards = bp.subject_pathway_cards(lessons)
    extras = [] if featured else bp.extra_subject_tiles(lessons)
    def tile_html(slug, name):
        icon_key, accent_cls, pupil_title, pupil_cue, teacher_cue = subject_meta(slug, name)
        title = pupil_title if pupil_calm else name
        cue = pupil_cue if pupil_calm else teacher_cue
        return ('<a class="fd-subject ' + esc(slug) + ' ' + accent_cls + '" href="/Lessons/subject.html?subject=' + esc(slug) + '">'
                '<h3>' + esc(title) + '</h3>'
                '<p class="fd-subject-cue">' + esc(cue) + '</p>'
                '<span class="fd-symbol" aria-hidden="true">' + line_icon(icon_key) + '</span>'
                '<span class="fd-arrow" aria-hidden="true">→</span></a>')
    primary_html = ''.join(tile_html(c['slug'], c['name']) for c in cards)
    if pupil_calm and extras:
        extra_html = ('<details class="fd-extra-subjects"><summary class="fd-extra-summary"><span>More classroom areas</span>'
                      '<span class="fd-extra-count">' + str(len(extras)) + ' areas</span></summary>'
                      '<div class="fd-subjects fd-extra-grid">' + ''.join(tile_html(s, n) for s, n in extras) + '</div></details>')
        return '<div class="fd-subjects" data-subject-tiles>' + primary_html + extra_html + '</div>'
    return '<div class="fd-subjects" data-subject-tiles>' + primary_html + ''.join(tile_html(s, n) for s, n in extras) + '</div>'


PATHWAY_MANIFEST = 'pathway-definitions.json'
PATHWAY_KEYS = ('build', 'grow', 'launch')


def pathway_record(bp):
    return json.loads((bp.HERE / PATHWAY_MANIFEST).read_text())


def pathways(bp):
    """D-3 (16 September 2026): the three pathway chips carry a short definition each.

    One source, pathway-definitions.json, read here and by the check. This fails
    closed: a missing, empty, reordered or extra pathway, or a definition that
    names a placement instrument, raises rather than serving a band that says
    the wrong thing or nothing at all. The chip stays a text label with the
    pathway's name next to its definition, so colour is never the only cue.
    """
    record = pathway_record(bp)
    rows = record.get('pathways')
    if not isinstance(rows, list) or tuple(r.get('key') for r in rows) != PATHWAY_KEYS:
        raise ValueError('pathway-definitions.json must carry exactly build, grow, launch in that order')
    forbidden = [str(w) for w in record.get('forbidden', [])]
    if not forbidden:
        raise ValueError('pathway-definitions.json must carry its forbidden word list')
    out = ''
    for row in rows:
        name, definition = str(row.get('name', '')).strip(), str(row.get('definition', '')).strip()
        if name != row['key'].upper():
            raise ValueError('pathway name must be the upper-case key: ' + row['key'])
        if not definition or len(definition) > 260:
            raise ValueError('pathway definition must be present and at most 260 characters: ' + name)
        low = definition.lower()
        hit = [w for w in forbidden if w.lower() in low]
        if hit:
            raise ValueError('pathway definition names a forbidden term: ' + name + ' ' + ', '.join(hit))
        out += ('<div class="fd-pathway" data-pathway="' + esc(row['key']) + '"><span class="fd-chip ' + esc(row['key']) + '">' + esc(name)
                + '</span><p class="fd-pathway-def">' + esc(definition) + '</p></div>')
    return '<div class="fd-chips fd-pathway-grid">' + out + '</div>'


HERO_MANIFEST = 'education-hero.json'
FEATURE_MANIFEST = 'homepage-feature.json'
PATHWAYS = {'BUILD', 'GROW', 'LAUNCH'}


def hero_art(bp, kind):
    """The approved artwork for a front door, or a build error — never a stand-in.

    Each image is served only when its bytes match the manifest that records the
    approved source digest and the crop; the gates re-check the same digests on
    the served page (data-hero-source / data-hero-sha)."""
    manifest = json.loads((bp.HERE / HERO_MANIFEST).read_text())
    keys = {'home': ('home', 'homePhone'), 'teachers': ('teachers',)}.get(kind)
    if not keys:
        return ''
    images = []
    for key in keys:
        image = manifest['images'][key]
        data = (bp.HERE / image['file']).read_bytes()
        if hashlib.sha256(data).hexdigest() != image['sha256'] or len(data) != image['bytes']:
            raise ValueError('Hero artwork does not match education-hero.json: ' + key)
        images.append(image)
    main, phone = images[0], (images[1] if len(images) > 1 else None)
    source = ('<source media="(max-width:767px)" srcset="/' + esc(phone['published']) + '" width="' + str(phone['width'])
              + '" height="' + str(phone['height']) + '">') if phone else ''
    img = ('<img src="/' + esc(main['published']) + '" alt="' + esc(manifest['alt']) + '" width="' + str(main['width']) + '" height="' + str(main['height'])
           + '" decoding="async" fetchpriority="high" data-hero-source="' + esc(main['sourceSha256']) + '" data-hero-sha="' + esc(main['sha256']) + '"'
           + (' data-hero-phone-sha="' + esc(phone['sha256']) + '"' if phone else '') + '>')
    return '<figure class="fd-hero-art" data-hero-art="' + esc(kind) + '"><picture>' + source + img + '</picture></figure>'


def bound_features(bp):
    """The eligible features, re-derived from the Lessons checkout and compared with
    the committed binding; a difference is a build error, never a shrunk card."""
    if bp.LESSONS_ROOT is None:
        return None, []
    manifest = json.loads((bp.HERE / FEATURE_MANIFEST).read_text())
    if manifest.get('schemaVersion') != 2:
        raise ValueError('homepage-feature.json must be schema 2')
    # Eligibility follows the catalogue the publisher builds from (CX2 §5.3:
    # "fewer than three → show eligible only"): a declared pack the checkout
    # does not carry (an older pin, or a fixture) is left out, and the browser
    # gate on the moved pin still requires every declared slide. Every pack
    # the checkout does carry must bind exactly, or the build stops here.
    # A checkout that predates the binding contract (no display-title map, no
    # placement manifest, no pack page) has nothing this card may show.
    if not all((bp.LESSONS_ROOT / rel).is_file() for rel in ('assets/catalogue/display-titles.json', 'data/companion-packs.json', 'pack.html')):
        return manifest, []
    rows = json.loads((bp.LESSONS_ROOT / 'resources.json').read_text())
    eligible = [f for f in manifest['features'] if any(r.get('id') == f['packId'] for r in rows)]
    if not eligible:
        return manifest, []
    import sys as _sys
    if str(bp.HERE) not in _sys.path:
        _sys.path.insert(0, str(bp.HERE))
    import bind_homepage_features
    subset = {**manifest, 'features': eligible}
    bound = bind_homepage_features.bind(bp.LESSONS_ROOT, subset, bp.HERE / 'homepage-previews.json')
    if bound != subset:
        drift = [f['packId'] for f, g in zip(bound['features'], eligible) if f != g] or ['shape']
        raise ValueError('homepage-feature.json is stale against the Lessons checkout: ' + ', '.join(drift))
    previews = preview_data(bp)
    features = []
    for feature in eligible:
        preview = previews.get(feature['packId'])
        if not preview:
            raise ValueError('Feature preview is not admitted for ' + feature['packId'])
        if feature['pathway'] not in PATHWAYS:
            raise ValueError('Unknown pathway for ' + feature['packId'])
        features.append({**feature, 'image': preview['images'][0]})
    return manifest, features


def try_lesson_slide(feature, index, total, first):
    image = feature['image']
    label = str(index + 1) + ' of ' + str(total) + ': ' + feature['displayTitle']
    return ('<li class="fd-try-slide" data-try-slide="' + esc(feature['packId']) + '" aria-roledescription="slide" aria-label="' + esc(label) + '"' + ('' if first else ' hidden') + '>'
            + '<div class="fd-pack-copy"><h2>' + esc(feature['displayTitle']) + '</h2><p>' + esc(feature['description']) + '</p>'
            + '<div class="fd-chips"><span class="fd-chip ' + feature['pathway'].lower() + '">' + esc(feature['pathway']) + '</span>'
            # tm-4(c): a screen reader hears "BUILD · Science", not "BUILDScience".
            + '<span class="fd-sep"> · </span><span class="fd-feature-meta">' + esc(feature['subject']) + ' · ' + esc(feature['duration']) + '</span></div>'
            + '<p class="fd-muted">Reference: ' + esc(feature['reference']) + '</p>'
            + action(feature['lessonRoute'], 'Try this lesson →')
            + '<a class="fd-feature-pack-link" href="' + esc(feature['packRoute']) + '">Get the teaching pack →</a></div>'
            + '<figure class="fd-feature-preview"><img class="fd-page-preview" src="' + esc(image['dataUri'])
            + '" alt="Preview of the ' + esc(feature['displayTitle']) + ' teaching slides" width="' + str(feature['previewWidth'])
            + '" height="' + str(feature['previewHeight']) + '" decoding="async"' + ('' if first else ' loading="lazy"') + ' data-preview-source="' + esc(image['source'])
            + '" data-preview-sha="' + esc(image['sourceSha256']) + '"><figcaption>From the teaching pack</figcaption></figure></li>')


def try_lesson(bp, slot):
    """EDU-TRY-LESSON: one static card for a single eligible lesson; a rotation for
    two or more. Without JavaScript the first (Sugar) card renders, linked, and the
    controls stay hidden; the script reveals them and owns the timing."""
    manifest, features = bound_features(bp)
    if not features:
        return ''
    total = len(features)
    ids = ' '.join(f['packId'] for f in features)
    rotation = total > 1
    attrs = (' data-try-lesson data-try-seconds="' + str(int(manifest['rotationSeconds'])) + '" aria-roledescription="carousel"' if rotation else '')
    head = '<div class="fd-try-head"><p class="fd-eyebrow">TRY A LESSON</p>' + ('<p class="fd-try-position" data-try-position hidden>1 of ' + str(total) + '</p>' if rotation else '') + '</div>'
    slides = '<ul class="fd-try-track">' + ''.join(try_lesson_slide(f, i, total, i == 0) for i, f in enumerate(features)) + '</ul>'
    controls = ('<div class="fd-try-controls" data-try-controls hidden><button type="button" class="fd-try-button" data-try-prev aria-label="Previous lesson">‹ Previous</button>'
                '<button type="button" class="fd-try-button fd-try-toggle" data-try-toggle aria-label="Pause the rotation">Pause</button>'
                '<button type="button" class="fd-try-button" data-try-next aria-label="Next lesson">Next ›</button></div>') if rotation else ''
    tag = 'aside' if slot == 'hero' else 'article'
    classes = 'fd-pack fd-try' + (' fd-hero-pack' if slot == 'hero' else '')
    return ('<' + tag + ' class="' + classes + '" data-featured-lesson="' + esc(ids) + '" data-try-slot="' + slot + '"' + attrs + ' aria-label="Try a lesson">'
            + head + slides + controls + '</' + tag + '>')


# MKT1-A item 5 (condition met 26 Sep 2026, R12): one body link to the mailing list, in the
# maker band of the homepage (which also renders /main/) and of /for/teachers/, with the
# ruled text verbatim. Never on /for/pupils/.
MAILING_LINK = ('/mailing-list/', 'Get new lessons by email')


def mailing_link():
    return '<a href="' + esc(MAILING_LINK[0]) + '" data-mailing-link>' + esc(MAILING_LINK[1]) + '</a>'


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
    if kind == 'home':
        # J93 (uz-6 (a), (b)): / and /main/ are the accepted draft of record,
        # domain-split/home/home.html, bound by home_slots.py. The legacy home
        # branch below is no longer reached; its helpers stay until retired.
        import home_slots
        return home_slots.render_home(origin, bp)
    record = json.loads(bp.AUDIENCE_RECORD.read_text())['audiences']
    subjects = subject_tiles(bp, bp.LESSONS_ROOT, featured=kind == 'home', pupil_calm=kind == 'pupils')
    primary = bp.LESSONS_ROOT is not None and (bp.LESSONS_ROOT / 'primary/index.html').is_file()
    if kind == 'home':
        hero = '<p class="fd-eyebrow">MADE BY A TEACHER. BUILT FOR REAL CLASSROOMS.</p><h1>Big on ideas. Light on prep.</h1><p class="fd-lead">Interactive lessons, practical resources and useful teaching tools—all in one place, ready to help you bring learning to life.</p>' + search(kind) + '<div class="fd-actions">' + action('/Lessons/', 'Browse lessons →', True) + action('/resources/?type=pack', 'Teaching packs', True) + '</div>'
        hero += '<nav class="fd-audience-entry" aria-label="Choose your starting point">' + ''.join('<a href="' + esc(record[k]['route']) + '">' + esc(record[k]['label']) + ' →</a>' for k in ('teachers', 'pupils', 'parents')) + '</nav>'
        # EDU-HERO: copy, then the artwork, then the search and actions; the
        # rotation fills the desktop hero's second column and a phone slot below.
        copy_end = hero.index('<div class="fd-search-block">')
        pack = try_lesson(bp, 'hero')
        body = ('<section class="fd-hero wrap"><div class="fd-hero-copy">' + hero[:copy_end] + '</div>' + hero_art(bp, kind)
                + '<div class="fd-hero-tools">' + hero[copy_end:] + '</div>' + pack + '</section>')
        body += '<section class="fd-section wrap"><div class="fd-section-head"><h2>Explore a subject</h2><a href="/Lessons/">View all →</a></div>' + subjects + '</section>'
        body += '<section class="fd-section fd-pathways wrap"><h2>Three pathways, one place</h2>' + pathways(bp) + '</section>'
        if pack:
            body += '<section class="fd-section wrap fd-phone-packs">' + try_lesson(bp, 'phone') + '</section>'
        body += '<section class="fd-section wrap" id="added" hidden><div class="fd-section-head"><h2 id="added-h">Added this half-term</h2><a id="added-all" href="/Lessons/?added=current">See all →</a></div><div class="fd-added-grid"><div id="added-rail"></div><article class="fd-pack-promo"><h3>Ready-to-teach packs</h3><p>Editable slides, print resources and teacher guidance.</p>' + action('/resources/?type=pack', 'Explore packs →', True) + '</article></div></section>'
        rows = [(record[k]['route'], record[k]['label']) for k in ('teachers', 'pupils', 'parents')]
        if primary: rows.append(('/Lessons/primary/', 'Primary lessons'))
        body += '<section class="fd-section wrap fd-start" id="audiences"><h2>Find your starting point</h2><div class="fd-start-grid">' + ''.join('<a href="' + esc(r) + '">' + esc(n) + ' →</a>' for r, n in rows) + '<details><summary>Working with schools and organisations</summary><div class="fd-audience-rows" data-audience-rows>' + ''.join('<a class="audience-row" href="' + esc(r) + '">' + esc(n) + '</a>' for r, n in bp.audience_rows() if r != record['parents']['route']) + '</div></details></div></section>'
        body += '<section class="fd-maker" id="about"><div class="wrap">' + line_icon('person') + '<h2>Made by a teacher. For real classrooms.</h2><a href="/commission/#about-matt">Meet Matt →</a>' + mailing_link() + '</div></section>'
        body += '<script type="application/json" id="home-preview-data">' + json.dumps(preview_data(bp), ensure_ascii=True).replace('<', '\\u003c') + '</script>'
    elif kind == 'teachers':
        teacher_picks = ''.join('<button type="button" class="fd-topic-btn" data-search-pick="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'
                                for t in ('Science', 'Humanities', 'Lifeskills', 'Art', 'BUILD', 'GROW', 'LAUNCH'))
        body = ('<section class="fd-hero wrap"><div><p class="fd-eyebrow">TEACHERS</p><h1>Ready for your next lesson?</h1>'
                '<p class="fd-lead">Find a lesson, gather your resources and get ready to teach.</p>'
                + search(kind)
                + '<div class="fd-topic-picks" role="group" aria-label="Quick search filters">' + teacher_picks + '</div>'
                + '<div class="fd-actions">' + action('/Lessons/', 'Browse lessons →') + action('/resources/', 'Find unit packs', True) + '</div></div>'
                + hero_art(bp, kind) + '</section>')
        body += ('<section class="fd-section wrap" id="teacher-recent" hidden aria-labelledby="teacher-recent-title">'
                 '<div class="fd-section-head"><h2 id="teacher-recent-title">Recently opened on this device</h2></div>'
                 '<div class="fd-recent-grid" id="teacher-recent-list"></div></section>')
        shortcuts = [
            ('/Lessons/?view=saved', 'Saved lessons', 'Return to lessons saved on this device.'),
            ('/resources/', 'Planning and evidence', 'Find schemes of work and evidence packs.'),
            ('/Matt-s-Apps-/', 'Classroom tools', 'Open tools for your lesson.'),
        ]
        if primary:
            shortcuts.append(('/Lessons/primary/', 'Primary lessons', 'Explore lessons for primary pupils.'))
        shortcuts.extend([
            ('/teach/', 'Teaching workspace', 'Plan sequences, print packs and classroom routines.'),
            ('/Lessons/?view=recommended', 'Recommended shelf', 'Open ready-to-teach lessons picked for this term.'),
        ])
        body += ('<section class="fd-section wrap"><h2>Your teaching shortcuts</h2><div class="fd-shortcuts">'
                 + ''.join('<a class="fd-shortcut" href="' + esc(r) + '"><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p><span class="fd-shortcut-arrow" aria-hidden="true">→</span></a>' for r, t, d in shortcuts)
                 + '</div></section>')
        body += '<section class="fd-section wrap"><div class="fd-section-head"><h2>Browse by subject</h2><a href="/Lessons/">All subjects →</a></div>' + subjects + '</section>'
        body += '<section class="fd-maker"><div class="wrap"><h2>Made by a teacher. For real classrooms.</h2><p>Questions, ideas or something your class needs?</p><a href="mailto:contactmadebymatt@gmail.com">Contact Matt →</a><p>' + mailing_link() + '</p></div></section>'
        note = record['teachers']
        body += '<section class="fd-section fd-safety wrap" id="teacher-note"><h2 id="teacher-note-title">' + esc(note['noteTitle']) + '</h2><p>' + esc(note['note']) + '</p></section>'
    else:
        pupil_picks = ''.join('<button type="button" class="fd-topic-btn" data-search-pick="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'
                              for t in ('Forces', 'Plants', 'History', 'Drawing', 'Money'))
        pupil_pathway_cards = ''.join(
            '<article class="fd-pupil-pathway" data-pathway="' + esc(k) + '">'
            '<span class="fd-tier-pill ' + esc(k) + '">' + esc(label) + '</span>'
            '<p>' + esc(desc) + '</p></article>'
            for k, label, desc in [
                ('build', 'BUILD', 'Short, clear steps with visual prompts and steady support.'),
                ('grow', 'GROW', 'Everyday topics with helpful hints as you work more independently.'),
                ('launch', 'LAUNCH', 'Deeper challenges for independent study and planning what comes next.'),
            ]
        )
        body = ('<section class="fd-hero wrap"><div><p class="fd-eyebrow">PUPILS</p><h1>What are you learning today?</h1>'
                '<p class="fd-lead">Choose your subject. Your teacher will help you find your pathway and lesson.</p></div></section>'
                '<section class="fd-section wrap" id="pupil-search"><h2>Find your activity</h2>' + search(kind)
                + '<div class="fd-topic-picks" role="group" aria-label="Try a topic">' + pupil_picks + '</div>'
                + '<p class="fd-muted">Nothing to install. Ask your teacher if you are not sure where to start.</p></section>'
                '<section class="fd-section wrap" id="pupil-recent" hidden aria-labelledby="pupil-recent-title">'
                '<div class="fd-section-head"><h2 id="pupil-recent-title">Continue your recent lesson</h2></div>'
                '<div class="fd-recent-grid" id="pupil-recent-list"></div></section>'
                '<section class="fd-section wrap"><h2>Choose your subject</h2>' + subjects + '</section>'
                '<section class="fd-section wrap" id="pupil-pathways" aria-labelledby="pupil-pathways-title">'
                '<h2 id="pupil-pathways-title">Which pathway do I pick?</h2>'
                '<p class="fd-muted">Your teacher will tell you whether to open BUILD, GROW or LAUNCH inside your subject.</p>'
                '<div class="fd-pupil-pathway-grid">' + pupil_pathway_cards + '</div></section>')
    route = '/' if kind == 'home' else record[kind]['route']
    title = {'home': 'Big on ideas. Light on prep.', 'teachers': 'Teachers', 'pupils': 'Pupils'}[kind]
    description = 'Interactive lessons, practical resources and useful teaching tools—all in one place, ready to help you bring learning to life.' if kind == 'home' else 'Practical lessons and teaching packs, ready to adapt.'
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + ' · Made by Matt</title><meta name="description" content="' + esc(description) + '"><link rel="canonical" href="' + origin + route + '"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/education-frontdoors.css"></head><body data-site-kind="education" data-page="' + kind + '" data-sw2-frontdoor><a class="skip" href="#content">Skip to content</a><header><a href="/">MADE BY MATT</a></header><main id="content">' + body + '</main>' + footer(record, bp, kind) + '<noscript><p class="wrap">Search needs JavaScript. Use the subject links to find your lesson.</p></noscript><script defer src="/assets/domain-site.js"></script>' + ('<script defer src="/assets/added-this-half-term.js"></script><script defer src="/assets/try-a-lesson.js"></script>' if kind == 'home' else '') + '</body></html>'
