"""Prove document navigation cannot land in an embedded print-page string."""
from html.parser import HTMLParser
from pathlib import Path
import re
from build_education import with_lesson_navigation, WRAPPED_LESSONS, WRAPPED_NAVIGATION

SCRIPT = '<script defer src="/Lessons/assets/catalogue/lesson-navigation.js"></script>'


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attributes):
        if tag == 'script':
            self.sources.append(dict(attributes).get('src', ''))


def count(text):
    parser = Scripts()
    parser.feed(text)
    return sum(bool(re.search(r'(?:^|/)assets/catalogue/lesson-navigation\.js(?:[?#]|$)', src)) for src in parser.sources)


def main():
    cases = [
        '<html><body><h1>Lesson</h1><script>function printPage(){w.document.write(\'<html><body>Print me</body></html>\')}</script></body></html>',
        '<!doctype html><body><template><p>Worksheet</p></template><script>const s="</body>";</script></body>',
        '<body><p>Activity</p>',
        '<html><body><!-- </body> --><p>Comment must not qualify</p></body></html>',
    ]
    for original in cases:
        updated = with_lesson_navigation(original)
        assert count(updated) == 1
        assert updated.replace(SCRIPT, '', 1) == original
        assert with_lesson_navigation(updated) == updated
    try:
        with_lesson_navigation('<body>'+SCRIPT+SCRIPT+'</body>')
    except ValueError:
        pass
    else:
        raise AssertionError('Duplicate real adapters must fail')
    for relative in WRAPPED_LESSONS:
        original = cases[0]
        updated = with_lesson_navigation(original, relative)
        assert count(updated) == 1 and updated.count(WRAPPED_NAVIGATION) == 1
        assert updated.replace(SCRIPT, '', 1).replace(WRAPPED_NAVIGATION, '', 1) == original
        assert with_lesson_navigation(updated, relative) == updated
    output = Path(__file__).resolve().parent/'output/education-lessons'
    checked = 0
    for page in output.rglob('*.html'):
        text = page.read_text()
        if 'data-game-moved' in text:
            assert count(text) == 0, page
        else:
            assert count(text) == 1, page
            checked += 1
    assert checked > 500, 'Complete publication required'
    print(f'PASS: embedded-print controls and {checked} actual lesson documents')


if __name__ == '__main__':
    main()
