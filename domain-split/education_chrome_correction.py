"""§26 publication-only icons; never transform teaching or app payloads."""
import json
import re
from education_frontdoors import ICONS, line_icon


def icon_name(label):
    label = label.lower()
    for pattern, name in [
        (r'science|physics|chemistry|biology', 'science'),
        (r'humanit|geography|history|religio', 'humanities-re'),
        (r'art|paint|design|poster|draw|comic|photo|choreo|maker', 'art-studio'),
        (r'teacher|pupil|student|support|family|parent|staff', 'person'),
        (r'tool|studio|build|life.?skill|asdan|register|data', 'lifeskills'),
        (r'search|find', 'search'),
    ]:
        if re.search(pattern, label):
            return name
    return 'book'


def once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('§26 icon source boundary changed: ' + before[:90])
    return text.replace(before, after, 1)


def correct_icons(text, route):
    if route == '/resources/' and '<ul class="pillars"' in text:
        for label, name in [('Schemes of work', 'book'), ('Evidence and accreditation', 'book'), ('Teacher tools ', 'lifeskills')]:
            text = once(text, '<strong>' + label, '<strong>' + line_icon(name) + label)
    if route == '/for/teachers/':
        text = re.sub(r'(<a class="fd-shortcut"[^>]*>)(<h3>)([^<]+)',
                      lambda m: m[1] + line_icon(icon_name(m[3])) + m[2] + m[3], text)
    if route == '/Lessons/':
        # The source catalogue owns every row. Only the local icon dictionary
        # used by its subject-card renderer is substituted, with a book fallback.
        text = once(text, 'COPY,CARDS,ICONS,chip', 'COPY,CARDS,chip')
        icons = {name: line_icon(name) for name in ICONS}
        icons['extra'] = line_icon('book')
        text = once(text, 'function subjectCard(c){',
                    'const ICONS=' + json.dumps(icons) + ';\nfunction subjectCard(c){')
    if route == '/Matt-s-Apps-/':
        # Literal source anchors keep this adaptation away from authored apps.
        icons = {name: line_icon(name) for name in ICONS}
        script = ('const CHROME_ICONS=' + json.dumps(icons) + ';\n'
                  'function chromeIcon(label){const s=String(label).toLowerCase();'
                  'const k=/science|physics|chemistry/.test(s)?"science":'
                  '/art|paint|design|poster|draw|comic|photo|choreo|maker/.test(s)?"art-studio":'
                  '/teacher|pupil|student|support|staff/.test(s)?"person":'
                  '/tool|studio|build|asdan|register|data/.test(s)?"lifeskills":"book";'
                  'return CHROME_ICONS[k];}\n')
        text = once(text, 'function card(it){', script + 'function card(it){')
        text = once(text, '${esc(it.i||"🧰")}', '${chromeIcon(it.n)}')
        for emoji, label in [('🍎','TEACHER'), ('🤝','TA / SUPPORT'), ('👤','STUDENT')]:
            text = once(text, emoji + ' ' + label, line_icon('person') + ' ' + label)
        text = once(text, '${AUDL[audOf(it)]}</span>', '${CHROME_ICONS.person}${AUDL[audOf(it)]}</span>')
        text = once(text, 'const AUDL={t:"🍎 Teacher Admin",g:"🤝 Guided / Co-Op",p:"👤 Pupil Independent",s:"⭐ Anyone"};',
                    'const AUDL=' + json.dumps({key: label for key, label in
                    [('t','Teacher Admin'), ('g','Guided / Co-Op'), ('p','Pupil Independent'), ('s','Anyone')]}) + ';')
    if route == '/tools/':
        # Existing decorative UI spans only; keep every title, action and URL.
        text = re.sub(r'(<span class="ci" aria-hidden="true">)[^<]+(</span><h3(?:\s[^>]*)?>)([^<]+)',
                      lambda m: m[1] + line_icon(icon_name(m[3])) + m[2] + m[3], text)
    return text
