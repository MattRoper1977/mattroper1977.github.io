"""Part T presentation owner for the explicitly listed Education front doors.

Only the body start tag and footer branding are edited. Teaching content,
embedded scripts, downloads and standalone payloads are not serialised.
"""
from html.parser import HTMLParser
import re


class BrandingRegion(HTMLParser):
    """Find the existing footer wordmark/tagline group by its complete text.

    Retain any ancestor that also contains authored prose or destination links.
    This avoids a regex across nested divs and leaves all other bytes intact.
    """
    void = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    branding = re.compile(r'(?:made by matt(?:\s*·\s*(?:learning|resources))?\s*(?:·\s*)?)?learn\s*•\s*build\s*•\s*explore', re.I)

    def __init__(self, source):
        super().__init__(); self.source = source
        self.lines = [0] + [i + 1 for i, c in enumerate(source) if c == '\n']
        self.stack = []; self.regions = []; self.marks = []; self.taglines = []; self.body = None
        self.footer_hrefs = set()
        self.feed(source); self.close()

    def source_offset(self):
        line, column = self.getpos(); return self.lines[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag == 'body':
            if self.body is not None: raise ValueError('Multiple body starts')
            self.body = (self.source_offset(), self.source_offset() + len(self.get_starttag_text()))
        values = dict(attrs)
        in_footer = any(x['tag'] == 'footer' for x in self.stack)
        if in_footer and tag == 'a': self.footer_hrefs.add(values.get('href', ''))
        mark = in_footer and ((tag == 'svg' and 'mono' in values.get('class', '').split()) or (tag == 'img' and 'micro_mark.svg' in values.get('src', '')))
        if mark and tag == 'img': self.marks.append((self.source_offset(), self.source_offset()+len(self.get_starttag_text())))
        if tag not in self.void:
            self.stack.append({'tag': tag, 'start': self.source_offset(), 'text': [],
                               'mark': mark, 'footer': tag == 'footer' or any(x['tag'] == 'footer' for x in self.stack),
                               'links': [dict(attrs).get('href')] if tag == 'a' else []})

    def handle_data(self, text):
        if any(x['tag'] in {'script','style','template'} for x in self.stack): return
        if any(x['tag'] == 'footer' for x in self.stack):
            for match in re.finditer(r'Learn\s*•\s*Build\s*•\s*Explore', text):
                self.taglines.append((self.source_offset()+match.start(),self.source_offset()+match.end()))
        for node in self.stack: node['text'].append(text)

    def handle_endtag(self, tag):
        found = next((i for i in range(len(self.stack)-1,-1,-1) if self.stack[i]['tag'] == tag), None)
        if found is None: return
        node = self.stack[found]; self.stack = self.stack[:found]
        for parent in self.stack: parent['links'].extend(node['links'])
        if node['mark']: self.marks.append((node['start'], self.source.find('>', self.source_offset()) + 1))
        text = re.sub(r'\s+', ' ', ' '.join(node['text'])).strip()
        if node['footer'] and tag != 'footer' and self.branding.fullmatch(text) and all(h in {'/','/main/'} for h in node['links']):
            end = self.source.find('>', self.source_offset()) + 1
            self.regions.append((node['start'], end))


def adopt_palette(text, route, adult, template):
    from structural_html import append_to_first_footer
    parsed = BrandingRegion(text)
    # complete_chrome has already enforced one footer-only tagline.
    if parsed.regions:
        start, end = max(parsed.regions, key=lambda r: r[1] - r[0])
    elif len(parsed.taglines) == 1:
        start, end = parsed.taglines[0]
    else:
        raise ValueError('Cannot identify footer branding: ' + route)
    fragment = template('footer.html', 'published-signoff', {})
    replacements = [(start, end, fragment)] + [(a, b, '') for a, b in parsed.marks if not (start <= a and b <= end)]
    for a, b, value in sorted(replacements, reverse=True): text = text[:a] + value + text[b:]
    # A canonical link group lives alongside retained page-specific footer copy.
    if adult:
        # Keep existing footer destinations once, including the canonical Play
        # link. The homepage retains UX2's precise commission action label.
        fragment = template('footer.html', 'published-links', {
            'contact_label': 'Commission a resource' if route in {'/', '/main/'} else 'Contact',
        })
        fragment = re.sub(r'<a href="([^"]+)"[^>]*>[^<]*</a>',
                          lambda match: '' if match.group(1) in parsed.footer_hrefs else match.group(0), fragment)
        text, count = append_to_first_footer(text, fragment)
        if count != 1: raise ValueError('Missing footer for adult links: ' + route)
    parsed = BrandingRegion(text)
    if parsed.body is None: raise ValueError('Missing palette owner body: ' + route)
    start, end = parsed.body
    if 'data-mbm-palette' in text[start:end]: raise ValueError('Palette owner already applied: ' + route)
    kind = 'register' if route in {'/asdan/','/uas/'} else 'science-packs' if route == '/Lessons/Science_Teesside/Teaching_Packs/' else 'front-door'
    text = text[:end-1] + ' data-mbm-palette="education" data-mbm-page-type="' + kind + '"' + text[end-1:]
    if '/assets/shared-footer.css' not in text:
        text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-footer.css"></head>', 1)
    text = text.replace('</head>', '<link rel="stylesheet" href="/assets/education-palette.css"></head>', 1)
    # An asynchronous catalogue must not steal focus from the new shared Menu.
    # Apply once at the publication owner, including older companion checkouts.
    initial_focus = {
        '/Lessons/': ('if(first)first.focus({preventScroll:true});',
                      'if(first&&(!document.activeElement||document.activeElement===document.body))first.focus({preventScroll:true});'),
        '/Lessons/subject.html': ("if(first&&!$('#seg').hidden)first.focus();else $('#search').focus();",
                                 "if(!document.activeElement||document.activeElement===document.body){if(first&&!$('#seg').hidden)first.focus();else $('#search').focus();}"),
    }
    if route in initial_focus and 'H.loadAll(' in text:
        old, new = initial_focus[route]
        if text.count(old) != 1: raise ValueError('Catalogue initial focus owner changed: ' + route)
        text = text.replace(old, new, 1)
    return text
