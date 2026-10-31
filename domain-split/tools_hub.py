"""Build the Tools hub (/tools/) from the Apps catalogue and the shelf source.

Usage: python3 tools_hub.py <apps.json> <tools-shelves.src.json> <template.html> <out-dir> [<apps-route>]

Writes <out-dir>/tools/index.html and <out-dir>/data/tools-shelves.json (the
registry of record for the two shelf counts). Every string on the page comes
from apps.json or the source file; the template holds markup and slots only.
The build refuses: a catalogue item left off both shelves, an item placed
twice, a classroom item without a group, an unknown group or space glyph, a
slot left unfilled, or a leftover slot in the output.
"""
import json, re, sys
from html import escape
from pathlib import Path

GLYPHS = {
 'shield': '<path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
 'timer': '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M9 3h6M12 3v3"/>',
 'compass': '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-4 2 2-6 4-2Z"/>',
 'spark': '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 17v4M17 19h4"/>',
 'brush': '<path d="M14.5 4.5 19.5 9.5 9 20H4v-5L14.5 4.5Z"/><path d="m12 7 5 5"/>',
 'page': '<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h5M10 17h5"/>',
 'book': '<path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4V5Z"/><path d="M20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7V5Z"/>',
 'leaf': '<path d="M5 19c0-8 5-13 14-13-1 9-6 14-14 13Z"/><path d="M5 19c3-4 6-7 10-9"/>',
 'orbit': '<circle cx="12" cy="12" r="3"/><path d="M3.5 9.5c5-3 12-4 17 .5s-2 9-7 9.5-13-1.5-10-10Z"/>',
 'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.2"/>',
 'offline': '<path d="M3 9c5-4 13-4 18 0M6.5 12.5c3.3-2.5 7.7-2.5 11 0M10 16c1.3-.9 2.7-.9 4 0"/><circle cx="12" cy="19" r="1"/><path d="M4 4l16 16"/>',
 'pencil': '<path d="M4 20l4-1L19 8l-3-3L5 16l-1 4Z"/><path d="m14 7 3 3"/>',
 'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
}

def svg(name, size=24):
    if name not in GLYPHS: raise ValueError('Unknown glyph: ' + name)
    return ('<svg viewBox="0 0 24 24" width="%d" height="%d" fill="none" stroke="currentColor" stroke-width="1.8" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">%s</svg>') % (size, size, GLYPHS[name])

def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def href_for(file, apps_route):
    return file if file.startswith(('http://', 'https://', '/')) else apps_route + file

def card(title, desc, href, glyph, shelf, group, new=False):
    search = ' '.join([title, desc or '', group]).lower()
    badge = '<span class="th-badge">New</span>' if new else ''
    return ('<li><a class="th-card" href="%s" data-shelf="%s" data-search="%s">'
            '<span class="th-card-icon">%s</span><span class="th-card-body"><span class="th-card-title">%s%s</span>'
            '<span class="th-card-desc">%s</span></span><span class="th-card-arrow" aria-hidden="true">%s</span></a></li>'
            % (escape(href, quote=True), shelf, escape(search, quote=True), svg(glyph), escape(title), badge,
               escape(desc or ''), svg('arrow', 18)))

def group_block(gid, title, glyph, cards, shelf):
    n = len(cards)
    return ('<section class="th-group" id="%s-%s" data-group aria-labelledby="%s-%s-h">'
            '<h3 id="%s-%s-h"><span class="th-group-icon">%s</span>%s <span class="th-count" data-group-count>%d</span></h3>'
            '<ul class="th-grid">%s</ul></section>' % (shelf, gid, shelf, gid, shelf, gid, svg(glyph, 20), escape(title), n, ''.join(cards)))

def build(apps_path, src_path, template_path, out_dir, apps_route='/apps/'):
    apps = json.loads(Path(apps_path).read_text(encoding='utf8'))
    src = json.loads(Path(src_path).read_text(encoding='utf8'))
    s = src['strings']
    groups = {g['id']: g for g in src['classroomGroups']}
    by_file = src['classroomGroupByFile']
    placed = {}
    classroom = {g['id']: [] for g in src['classroomGroups']}
    studios = []
    registry = {'classroom': [], 'studios': []}
    for space in apps['spaces']:
        cat = space['cat']
        for item in space['items']:
            key = item['f']
            if key in placed: raise ValueError('Catalogue item placed twice: ' + key)
            href = href_for(key, apps_route)
            if cat == src['classroomSpace']:
                gid = by_file.get(key)
                if gid is None or gid not in groups: raise ValueError('Classroom item without a known group: ' + key)
                classroom[gid].append(card(item['n'], item.get('d'), href, groups[gid]['glyph'], 'classroom', groups[gid]['title'], item.get('new')))
                registry['classroom'].append({'title': item['n'], 'href': href, 'group': gid, 'source': 'apps.json'})
            else:
                glyph = src['studioGlyphs'].get(cat)
                if glyph is None: raise ValueError('Space without a glyph: ' + cat)
                studios.append((cat, glyph, card(item['n'], item.get('d'), href, glyph, 'studios', cat, item.get('new'))))
                registry['studios'].append({'title': item['n'], 'href': href, 'space': cat, 'source': 'apps.json'})
            placed[key] = True
    for t in src['siteTools']:
        if t['group'] not in groups: raise ValueError('Site tool with unknown group: ' + t['title'])
        if t['href'] in placed: raise ValueError('Site tool duplicates a catalogue route: ' + t['href'])
        placed[t['href']] = True
        classroom[t['group']].append(card(t['title'], t['description'], t['href'], groups[t['group']]['glyph'], 'classroom', groups[t['group']]['title']))
        registry['classroom'].append({'title': t['title'], 'href': t['href'], 'group': t['group'], 'source': 'tools-shelves.src.json'})
    total_manifest = sum(len(sp['items']) for sp in apps['spaces'])
    if len(registry['classroom']) + len(registry['studios']) != total_manifest + len(src['siteTools']):
        raise ValueError('Shelf totals do not match the catalogue')
    n_class, n_stud = len(registry['classroom']), len(registry['studios'])
    classroom_html = ''.join(group_block(gid, groups[gid]['title'], groups[gid]['glyph'], cards, 'classroom')
                             for gid, cards in classroom.items() if cards)
    spaces_order, by_space = [], {}
    for cat, glyph, c in studios:
        if cat not in by_space: spaces_order.append((cat, glyph)); by_space[cat] = []
        by_space[cat].append(c)
    studios_html = ''.join(group_block(slug(cat), cat, glyph, by_space[cat], 'studios') for cat, glyph in spaces_order)
    facts = ''.join('<li><span class="th-fact-icon">%s</span><b>%s</b><span>%s</span></li>' % (svg(f['glyph'], 22), escape(f['title']), escape(f['text'])) for f in s['facts'])
    dock = ''.join('<li><h3>%s</h3><p>%s</p></li>' % (escape(d['title']), escape(d['text'])) for d in s['dock'])
    collections = ''.join('<li><a href="%s">%s</a></li>' % (escape(c['href'], quote=True), escape(c['label'])) for c in s['collections'])
    values = {
        'title': s['title'], 'kicker': s['kicker'], 'h1': s['h1'], 'descriptor': s['descriptor'],
        'meta_description': s['metaDescription'], 'search_label': s['searchLabel'],
        'classroom_heading': s['classroomHeading'], 'classroom_lead': s['classroomLead'],
        'studios_heading': s['studiosHeading'], 'studios_lead': s['studiosLead'],
        'classroom_count': str(n_class), 'studios_count': str(n_stud), 'total_count': str(n_class + n_stud),
        'dock_heading': s['dockHeading'], 'dock_lead': s['dockLead'],
        'dock_href': s['dockLink']['href'], 'dock_label': s['dockLink']['label'],
        'collections_heading': s['collectionsHeading'],
        'quote': s['quote'], 'quote_by': s['quoteBy'],
        'lessons_href': s['lessonsLink']['href'], 'lessons_label': s['lessonsLink']['label'],
        'resources_href': s['resourcesLink']['href'], 'resources_label': s['resourcesLink']['label'],
    }
    raw = {'classroom_groups': classroom_html, 'studio_groups': studios_html, 'facts': facts, 'dock': dock,
           'collections': collections, 'glyph_search': svg('arrow', 18)}
    text = Path(template_path).read_text(encoding='utf8')
    for k, v in values.items(): text = text.replace('{{' + k + '}}', escape(v))
    for k, v in raw.items(): text = text.replace('{{' + k + '}}', v)
    left = re.findall(r'\{\{[a-z_]+\}\}', text)
    if left: raise ValueError('Unfilled slots: ' + ', '.join(sorted(set(left))))
    if text.count('<h1') != 1 or 'id="tq"' not in text: raise ValueError('Page contract: one h1 and the tq search control')
    out = Path(out_dir)
    (out / 'tools').mkdir(parents=True, exist_ok=True); (out / 'data').mkdir(parents=True, exist_ok=True)
    (out / 'tools' / 'index.html').write_text(text, encoding='utf8')
    reg = {'version': 1, 'route': src['route'], 'counts': {'classroom': n_class, 'studios': n_stud, 'total': n_class + n_stud},
           'labels': {'classroom': '%d classroom tools' % n_class, 'studios': '%d studios' % n_stud},
           'shelves': registry}
    (out / 'data' / 'tools-shelves.json').write_text(json.dumps(reg, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
    return reg['counts']

if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 4: sys.exit(__doc__)
    print(build(*a[:4], *(a[4:5] or [])))
