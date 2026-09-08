"""Connect the preserved audience and Primary hubs and the separate Play site.

Only navigation pages are amended. Media is the existing real footage; game
engines, saved-progress routines and native teaching downloads are untouched.
"""
from html import escape
import json
from pathlib import Path
import shutil
from lxml import html

PLAY = 'https://www.madebymatt-play.uk'
AUDIENCES = [
    ('parents-carers', 'Parents & carers', 'Short activities, shared learning and practical support at home.'),
    ('schools-semh', 'Schools & specialist settings', 'Lessons, pathways and adaptable classroom resources.'),
    ('trusts', 'Academy trusts', 'Explore curriculum resources and support across settings.'),
    ('councils-organisations', 'Local authorities & education partners', 'Find resources for education, inclusion and partnership work.'),
    ('partners', 'Education organisations & service providers', 'Explore the collection and ways to work with Made by Matt.'),
    ('governors-trustees', 'Governors & trustees', 'Governance guidance, induction, training and curriculum oversight.'),
]
GAMES = [
    {'id': 'game-apex-kick', 'title': 'Apex Kick', 'poster': 'poster-apexkick.webp',
     'clip': 'clip-apexkick.mp4', 'seconds': 18, 'description': 'Aim a free kick, judge the power and curl the ball towards goal.',
     'preview': 'A player positions the target and takes free kicks past a defensive wall.'},
    {'id': 'game-voxel-frontier', 'title': 'Voxel Frontier', 'poster': 'poster-voxelfrontier-play.webp',
     'clip': 'clip-voxelfrontier-play.mp4', 'seconds': 13, 'description': 'Explore a block world and try building in Creative mode.',
     'preview': 'A first-person view moves above a landscape of blocks, trees and water.'},
    {'id': 'game-offbrand', 'title': 'Off-Brand', 'poster': 'poster-offbrand.webp',
     'clip': 'clip-offbrand.mp4', 'seconds': 17, 'description': 'Read clues in the workshop and work out who is the Glitch.',
     'preview': 'The workshop game introduces its crew and Glitch modes and shows the play interface.'},
]


def fragment(markup):
    return html.fragment_fromstring(markup)


def save_doc(path, doc):
    path.write_text(html.tostring(doc, encoding='unicode', doctype='<!doctype html>'))


def styles(doc):
    if not doc.xpath('//link[@href="/assets/education-expansion.css"]'):
        doc.find('head').append(fragment('<link rel="stylesheet" href="/assets/education-expansion.css">'))


def audience_directory():
    return ('<section class="mbm-audiences" id="audiences" aria-labelledby="audiences-title"><div class="wrap">'
            '<p class="eyebrow">Made for your part in education</p><h2 id="audiences-title">Find your starting point.</h2>'
            '<div class="mbm-audience-grid">'+''.join(
                '<a class="mbm-audience-card" href="/for/'+slug+'/"><h3>'+escape(title)+'</h3><p>'+escape(description)+'</p></a>'
                for slug, title, description in AUDIENCES)+'</div></div></section>')


def play_showcase(featured, section_id='made-by-matt-play'):
    cards = []
    for game in featured:
        title = escape(game['title'])
        cards.append('<article class="mbm-play-card"><div class="mbm-play-card-copy"><h3>'+title+'</h3><p>'+game['description']+'</p></div>'
                     '<figure><video controls playsinline preload="none" width="854" height="480" '
                     'poster="/assets/video/'+game['poster']+'" aria-label="'+title+' gameplay preview, silent">'
                     '<source src="/assets/video/'+game['clip']+'" type="video/mp4">'
                     '<p>Your browser cannot show this video. You can still open the game below.</p></video>'
                     '<figcaption>'+str(game['seconds'])+'-second silent preview. '+game['preview']+'</figcaption></figure>'
                     '<a class="mbm-play-button" href="'+PLAY+game['route']+'" data-play-resource="'+game['id']+'">Play '+title+'</a></article>')
    return ('<section class="mbm-play-showcase" id="'+section_id+'" aria-labelledby="'+section_id+'-title"><div class="wrap">'
            '<div class="mbm-play-heading"><div><p class="eyebrow">A little room to play</p>'
            '<h2 id="'+section_id+'-title"><img src="/favicon.svg" width="44" height="44" alt="">Made by Matt <span>Play</span></h2>'
            '<p>Games made by Matt, on their own website. Pick a game when you’re ready.</p></div>'
            '<a class="mbm-play-button" href="'+PLAY+'/">Explore Made by Matt Play</a></div>'
            '<div class="mbm-play-grid">'+''.join(cards)+'</div>'
            '<p class="mbm-play-note">These are featured games, not a popularity ranking. Previews play only when selected. '
            'Check each game’s controls and options together; an adult can help choose a suitable starting point.</p></div></section>')


def refresh(output, lessons, apps, site_source):
    site = output/'education-site'
    shutil.copyfile(site_source/'domain-split/education-expansion.css', site/'assets/education-expansion.css')
    # UX2 B2: the homepage (index.html = main/index.html) is Appendix A §HOME — its
    # "Here for someone else?" rows (#audiences) come from the record, Primary
    # lessons and Play are menu rows and Play is in the footer, so the explore
    # nav and the six-card directory are not added there.
    # UX2 B2/B3: the homepage, teacher and pupil pages are Appendix A — Primary lessons and
    # Play are menu rows, Play is the footer's last link and the audience routes are the
    # homepage's "Here for someone else?" rows, so no explore nav or footer additions here.
    parent_path = site/'for/parents-carers/index.html'
    doc = html.document_fromstring(parent_path.read_text())
    styles(doc)
    slots = doc.xpath('//*[@id="audience-play-showcase"]')
    if len(slots) != 1:
        raise ValueError('Parents page must expose one Play showcase slot')
    slots[0].getparent().replace(slots[0], fragment('<p id="audience-play-showcase" class="wrap mbm-external-play">Looking for recreational games? <a href="'+PLAY+'/">Made by Matt Play — separate games website</a>.</p>'))
    save_doc(parent_path, doc)
    # Keep the new audience destination discoverable alongside the old ones.
    for slug, _, _ in AUDIENCES:
        path = site/'for'/slug/'index.html'
        doc = html.document_fromstring(path.read_text())
        menus = doc.xpath('//nav[@aria-label="Audience homepages"]')
        for menu in menus:
            menu.append(fragment('<a href="/for/governors-trustees/">Governors &amp; trustees</a>'))
        if menus:
            save_doc(path, doc)
    catalogue_path = site/'data/domain-catalogue.json'
    catalogue = json.loads(catalogue_path.read_text())
    known = {row['route'] for row in catalogue['education']}
    extra_path = site/'data/resource-collections.json'
    extra = json.loads(extra_path.read_text())
    extra_known = {row['path'] for row in extra}
    for slug, title, description in AUDIENCES:
        route = '/for/'+slug+'/'
        if route not in known:
            catalogue['education'].append({'id':'audience-'+slug,'title':title,'description':description,
                'route':route,'category':'page','subject':'Audience resources','keywords':[title,slug.replace('-',' ')],'pathways':[]})
        if route not in extra_known:
            extra.append({'title':title,'description':description,'path':route,'subject':'Audience resources',
                'type':'Resource','tags':[title,slug.replace('-',' ')],'status':'Published'})
    catalogue_path.write_text(json.dumps(catalogue,ensure_ascii=False,indent=2)+'\n')
    extra_path.write_text(json.dumps(extra,ensure_ascii=False,indent=2)+'\n')
    discovery_path = site/'data/resource-discovery.json'
    discovery = json.loads(discovery_path.read_text())
    discovery['supplemental_discovery_records'] = len(extra)
    discovery_path.write_text(json.dumps(discovery,ensure_ascii=False,indent=2)+'\n')
    report = {'audience_routes': ['/for/'+slug+'/' for slug, _, _ in AUDIENCES],
              'primary': '/Lessons/primary/', 'play_origin': PLAY, 'featured_game_ids': [],
              'existing_media': [], 'new_game_payloads': 0, 'autoplay': False}
    (site/'data/education-expansion.json').write_text(json.dumps(report, indent=2)+'\n')
    return report


def refresh_play(output):
    games = output/'games'
    # This modifies only the generated shelf and its aliases, after the
    # existing builder's literal host substitution. The 69 game payloads stay
    # byte-identical to their accepted source transformation.
    for relative in ('index.html', 'games/index.html', 'main/index.html', 'for/pupils/index.html', 'Games/index.html', 'Lessons/index.html'):
        path = games/relative
        doc = html.document_fromstring(path.read_text())
        for nav in doc.xpath('//header//nav | //footer//nav'):
            nav.append(fragment('<a href="https://madebymatt.uk/" class="education-return">Made by Matt Education</a>'))
        save_doc(path, doc)
