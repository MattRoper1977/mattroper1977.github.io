#!/usr/bin/env python3
"""J91: the two build-filled slots of the published /Lessons/subject.html.

ug add.1 (d): "the noscript lesson index is generated from the registry at
build time into the draft's slot". ug add.11 (d)+(h): "The build-time noscript
index lists Science lessons only for this landing". ug add.1 (a): "the audience
doors take their routes from the Site's audience record, not the draft".
ug add.11 (a): the fourth door is "the record's schools route and the record's
label" - "No new route ... no typed label".

The Lessons source carries each slot as one marker comment and nothing else.
build_education.py runs this once, on that one page, as soon as the trees are
copied and before any generator walks the pages (navigation, usage and the
support walk then see the page as it is published), and confirms the index
again after the final catalogue filter.

* A page without either marker is returned byte for byte, and nothing is read:
  no node, no Lessons file, no record. A Lessons commit that predates J91
  therefore builds exactly as it did before this step existed.
* The lesson index is what hub.js itself shows for the Science query, computed
  BY hub.js: subject_lesson_index.cjs runs the built copy under node and
  returns its lesson groups in its own order, each primary with its display
  title and the href lessonRow() writes. Display title and link only: no
  description and no line linking other subjects.
* The doors are the record's own entries, named by the record's own keys.
  Every route, label and description is read from data/audience-homepages.json
  at build time; this file types none of them.

A slot that cannot be filled stops the build; the page is never published with
a half-filled or silently empty slot.

    python3 subject_slots.py --self-test [--lessons-output <output/education-lessons>]
"""
from html.parser import HTMLParser
from pathlib import Path
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
PAGE = 'education-lessons/subject.html'  # served as /Lessons/subject.html
RECORD = 'data/audience-homepages.json'
NODE_SCRIPT = HERE / 'subject_lesson_index.cjs'

# The slot markers. The lesson index marker is the J91 draft's own comment,
# matched exactly. The doors slot is matched by its marker name, whatever note
# follows the name; DOORS is the form this file's own fixtures write.
LESSON_INDEX = '<!-- MBM-NOSCRIPT-LESSON-INDEX: generator populates static lesson list from resources.json -->'
DOORS_NAME = 'MBM-AUDIENCE-DOORS'
DOORS_MARKER = re.compile(r'<!--\s*' + DOORS_NAME + r'(?::[^>]*)?\s*-->')
DOORS = '<!-- ' + DOORS_NAME + ': build fills the four audience doors from the Site audience record -->'
# What the build writes in place of each marker, so a second pass is a no-op.
FILLED = {'lesson-index': ('<!-- mbm-build:lesson-index -->', '<!-- /mbm-build:lesson-index -->'),
          'audience-doors': ('<!-- mbm-build:audience-doors -->', '<!-- /mbm-build:audience-doors -->')}

# ug add.11 (d)+(h): the query whose lessons the index lists (?subject=science).
LESSON_INDEX_QUERY = 'science'
# ug add.1 (a), ug add.11 (a): the four doors, named by the record's own keys
# (the record owns their routes, labels and descriptions).
DOOR_KEYS = ('pupils', 'teachers', 'parents', 'schools')
DOOR_FIELDS = ('route', 'label', 'chooserDescription')


def esc(value):
    """hub.js esc(), character for character, so the markup is what the hub writes."""
    return (str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;').replace("'", '&#39;'))


def node_command():
    node = shutil.which('node')
    if not node:
        raise ValueError('The noscript lesson index needs node to run the built hub.js')
    return node


def lesson_index(lessons_output, query=LESSON_INDEX_QUERY):
    """hub.js's own lesson list for one subject query, from the built Lessons tree."""
    lessons_output = Path(lessons_output)
    if not (lessons_output / 'assets/catalogue/hub.js').is_file():
        raise ValueError('The noscript lesson index needs the built hub.js: ' + str(lessons_output))
    run = subprocess.run([node_command(), str(NODE_SCRIPT), str(lessons_output), query],
                         capture_output=True, text=True)
    if run.returncode != 0:
        raise ValueError('The noscript lesson index could not be generated: ' + run.stderr.strip()[-500:])
    result = json.loads(run.stdout)
    lessons = result['lessons']
    hrefs = [row['href'] for row in lessons]
    if not lessons:
        raise ValueError('The noscript lesson index is empty for ?subject=' + query)
    if len(lessons) != result['distinctLessons']:
        raise ValueError('The noscript lesson index disagrees with the page lesson count')
    if len(set(hrefs)) != len(hrefs) or '#' in hrefs or any(not row['title'] for row in lessons):
        raise ValueError('The noscript lesson index has a repeated, refused or untitled link')
    return result


class _Marker(HTMLParser):
    """Whether the lesson-index marker already sits inside a <noscript> element."""
    def __init__(self, text):
        super().__init__()
        self.stack, self.inside = [], []
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag not in {'br', 'img', 'input', 'link', 'meta', 'hr', 'source', 'wbr'}:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            del self.stack[len(self.stack) - 1 - self.stack[::-1].index(tag):]

    def handle_comment(self, data):
        if '<!--' + data + '-->' == LESSON_INDEX:
            self.inside.append('noscript' in self.stack)


def render_lesson_index(lessons, in_noscript):
    """The list, wrapped in its own <noscript> unless the page already put the
    marker inside one, so it is never shown beside the scripted catalogue."""
    start, end = FILLED['lesson-index']
    items = ''.join('<li><a href="' + esc(row['href']) + '">' + esc(row['title']) + '</a></li>\n'
                    for row in lessons)
    listing = '<ul>\n' + items + '</ul>'
    if not in_noscript:
        listing = '<noscript>\n' + listing + '\n</noscript>'
    return start + '\n' + listing + '\n' + end


def audience_doors(site_source):
    """(key, route, label, description) for each door, read from the record."""
    audiences = json.loads((Path(site_source) / RECORD).read_text(encoding='utf-8'))['audiences']
    doors = []
    for key in DOOR_KEYS:
        entry = audiences.get(key)
        values = [entry.get(field) if isinstance(entry, dict) else None for field in DOOR_FIELDS]
        if not all(isinstance(value, str) and value.strip() for value in values):
            raise ValueError('The audience record has no complete door entry: ' + key)
        doors.append((key, *values))
    return doors


def render_doors(doors):
    start, end = FILLED['audience-doors']
    cards = ''.join('<a class="door-card door-' + esc(key) + '" href="' + esc(route) + '"><strong>'
                    + esc(label) + '</strong><span>' + esc(description) + '</span></a>\n'
                    for key, route, label, description in doors)
    return start + '\n' + cards + end


def fill(text, lessons_output, site_source):
    """Fill whichever slots the page carries. Returns (text, counts); counts is
    empty, and text is the input object itself, when the page carries neither."""
    counts = {}
    present = {'lesson-index': text.count(LESSON_INDEX), 'audience-doors': len(DOORS_MARKER.findall(text))}
    for name, count in present.items():
        if count > 1:
            raise ValueError('Expected at most one ' + name + ' slot on the subject page')
    if present['lesson-index']:
        index = lesson_index(lessons_output)
        in_noscript = _Marker(text).inside == [True]
        text = text.replace(LESSON_INDEX, render_lesson_index(index['lessons'], in_noscript), 1)
        counts['lessonIndex'] = len(index['lessons'])
    if present['audience-doors']:
        doors = audience_doors(site_source)
        filled = render_doors(doors)
        text = DOORS_MARKER.sub(lambda match: filled, text, count=1)
        counts['audienceDoors'] = len(doors)
    return text, counts


def fill_subject_page(output, site_source):
    """The build step: the published subject page, in place. Returns the counts
    only when a slot was filled, so a page without markers adds nothing to the
    build report either."""
    page = Path(output) / PAGE
    if not page.is_file():
        return {}
    text = page.read_bytes().decode('utf-8')  # bytes, so no other byte of the page can move
    filled, counts = fill(text, page.parent, site_source)
    if counts:
        page.write_bytes(filled.encode('utf-8'))
    return counts


def confirm_subject_page(output):
    """After the final catalogue filter: the filled index must still be exactly what the
    built hub.js gives for the published registry, or the build stops."""
    page = Path(output) / PAGE
    text = page.read_bytes().decode('utf-8')
    start, end = FILLED['lesson-index']
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError('The filled noscript lesson index is missing from the subject page')
    block = text[text.index(start):text.index(end)]
    written = _Slots('<noscript>' + block + '</noscript>').links
    if written != [row['href'] for row in lesson_index(page.parent)['lessons']]:
        raise ValueError('The noscript lesson index no longer matches the published registry')
    return len(written)


# ---------------------------------------------------------------- self-test --

class _Slots(HTMLParser):
    """Read back what a filled page links, independently of how it was written."""
    def __init__(self, text):
        super().__init__()
        self.stack, self.links, self.doors, self.door = [], [], [], None
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'a' and 'door-card' in (values.get('class') or '').split():
            self.door = {'href': values.get('href'), 'class': values.get('class'), 'strong': '', 'span': ''}
        elif tag == 'a' and 'noscript' in self.stack:
            self.links.append(values.get('href'))
        if tag not in {'br', 'img', 'input', 'link', 'meta', 'hr'}:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            del self.stack[len(self.stack) - 1 - self.stack[::-1].index(tag):]
        if tag == 'a' and self.door is not None:
            self.doors.append(self.door)
            self.door = None

    def handle_data(self, data):
        if self.door is not None and self.stack[-1] in {'strong', 'span'}:
            self.door[self.stack[-1]] += data


def fixture(*markers, index_in_noscript=True):
    """A scratch page carrying the given slot markers: the lesson index inside a
    <noscript> (the J91 draft's form) or in a plain container."""
    doors = DOORS if DOORS in markers else ''
    index = LESSON_INDEX if LESSON_INDEX in markers else ''
    slot = ('<noscript><section class="noscript-index">' + index + '</section></noscript>' if index_in_noscript
            else '<div class="noscript-slot">' + index + '</div>')
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>slot fixture</title></head>'
            '<body><main><section class="audience-doors">' + doors + '</section><div id="rows"></div>'
            + slot + '</main></body></html>')


def self_test(lessons_output=None, site_source=None):
    site_source = Path(site_source or HERE.parent)
    ok = True

    def control(name, passed, detail=''):
        nonlocal ok
        ok = ok and bool(passed)
        print(f"  [{'ok' if passed else 'FAIL'}] {name}{'  - ' + detail if detail else ''}")

    def refused(*args):
        try:
            fill(*args)
            return False
        except ValueError:
            return True

    record = json.loads((site_source / RECORD).read_text(encoding='utf-8'))['audiences']
    nowhere = Path(tempfile.gettempdir()) / 'subject-slots-no-such-tree'

    # 1. Without a marker the step is the identity, and reads nothing at all.
    plain = fixture()
    global node_command
    real_node = node_command
    def no_node():
        raise AssertionError('node was asked for on a page without a marker')
    node_command = no_node
    try:
        same, counts = fill(plain, nowhere, nowhere)
        control('no marker: the page is returned unchanged, with no node, Lessons tree or record read',
                same is plain and counts == {})
    except Exception as err:  # noqa: BLE001 - any read at all is the failure
        control('no marker: the page is returned unchanged, with no node, Lessons tree or record read', False, repr(err))
    finally:
        node_command = real_node

    # 2. Red first: the page as a builder without this step leaves it.
    both = fixture(LESSON_INDEX, DOORS)
    before = _Slots(both)
    control('red: a page with both markers, unfilled, links 0 lessons and shows 0 doors',
            before.links == [] and before.doors == [], f'{len(before.links)} links, {len(before.doors)} doors')

    # 3. The doors are the record's entries, read back from the markup and
    #    compared with the record as read here.
    filled, counts = fill(fixture(DOORS), nowhere, site_source)
    seen = _Slots(filled).doors
    expected = [{'href': record[key]['route'], 'class': 'door-card door-' + key,
                 'strong': record[key]['label'], 'span': record[key]['chooserDescription']} for key in DOOR_KEYS]
    control('green: the doors slot holds the record\'s own four entries (route, label, description)',
            seen == expected and counts == {'audienceDoors': len(DOOR_KEYS)}, f'{len(seen)} doors')
    routes = {entry['route'] for entry in record.values()}
    control('every door route is a route the record holds, and no two doors share one',
            all(door['href'] in routes for door in seen) and len({d['href'] for d in seen}) == len(seen))
    control('the filled page carries no marker, so a second pass changes nothing',
            not DOORS_MARKER.search(filled) and fill(filled, nowhere, nowhere) == (filled, {}))
    bare = fixture(DOORS).replace(DOORS, '<!-- ' + DOORS_NAME + ' -->')
    control('the doors slot is found by its marker name, with or without a note',
            fill(bare, nowhere, site_source)[0] == filled)

    # The index is never shown beside the scripted catalogue: it is wrapped in its
    # own <noscript> unless the page already put the marker inside one.
    rows = [{'href': 'a.html', 'title': 'A'}]
    plain = render_lesson_index(rows, _Marker(fixture(LESSON_INDEX, index_in_noscript=False)).inside == [True])
    nested = render_lesson_index(rows, _Marker(fixture(LESSON_INDEX)).inside == [True])
    control('a marker in a plain container gets its own <noscript>; one inside <noscript> gets none',
            plain.count('<noscript>') == 1 and nested.count('<noscript>') == 0)

    # 4. Refusals: a slot is never published half-filled or silently empty.
    control('two doors markers are refused', refused(fixture(DOORS) + DOORS, nowhere, site_source))
    control('a lesson-index marker with no built hub.js is refused', refused(fixture(LESSON_INDEX), nowhere, site_source))
    with tempfile.TemporaryDirectory() as temp:
        planted = Path(temp)
        (planted / 'data').mkdir()
        partial = json.loads((site_source / RECORD).read_text(encoding='utf-8'))
        partial['audiences'].pop(DOOR_KEYS[-1])
        (planted / RECORD).write_text(json.dumps(partial), encoding='utf-8')
        control('a record without one of the four entries is refused', refused(fixture(DOORS), nowhere, planted))
        hostile = json.loads((site_source / RECORD).read_text(encoding='utf-8'))
        hostile['audiences'][DOOR_KEYS[0]]['label'] = '<b>"x" & \'y\'</b>'
        (planted / RECORD).write_text(json.dumps(hostile), encoding='utf-8')
        text, _ = fill(fixture(DOORS), nowhere, planted)
        control('record text is escaped as hub.js escapes it, never written as markup',
                '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;' in text and '<b>' not in text)

    # 5. With a built Lessons tree: the lesson index against the page's own count.
    if lessons_output:
        lessons_output = Path(lessons_output)
        index = lesson_index(lessons_output)
        filled, counts = fill(both, lessons_output, site_source)
        links = _Slots(filled).links
        control('green: one link per lesson the page counts (hub.js distinctLessons for the card)',
                len(links) == index['distinctLessons'] == counts['lessonIndex'],
                f"{len(links)} links, distinctLessons {index['distinctLessons']}")
        control('every link is distinct', len(set(links)) == len(links))
        control('every link is an .html lesson page in the built tree',
                all(link.endswith('.html') for link in links)
                and all((lessons_output / Path(*row['path'].split('/'))).is_file() for row in index['lessons']))
        control('no game row is listed', all(row['type'] != 'game' for row in index['lessons']))
        control('the links are the hrefs hub.js gives, in its order',
                links == [row['href'] for row in index['lessons']])
        bare, _ = fill(fixture(LESSON_INDEX, index_in_noscript=False), lessons_output, site_source)
        control('in a plain container the same links are filled, inside one <noscript>',
                _Slots(bare).links == links and bare.count('<noscript>') == 1)
        control('the doors slot is filled in the same pass', counts.get('audienceDoors') == len(DOOR_KEYS))
        with tempfile.TemporaryDirectory() as temp:
            mirror = Path(temp) / Path(PAGE).parent
            mirror.mkdir(parents=True)
            for child in lessons_output.iterdir():
                if child.name != Path(PAGE).name:
                    (mirror / child.name).symlink_to(child.resolve())
            (mirror / Path(PAGE).name).write_bytes(filled.encode('utf-8'))
            control('the final confirmation accepts the page as filled', confirm_subject_page(temp) == len(links))
            moved = filled.replace('href="' + esc(links[0]) + '"', 'href="' + esc(links[-1]) + '"', 1)
            (mirror / Path(PAGE).name).write_bytes(moved.encode('utf-8'))
            try:
                confirm_subject_page(temp)
                control('a page whose index no longer matches the registry is refused', False)
            except ValueError:
                control('a page whose index no longer matches the registry is refused', True)
    else:
        print('  [skip] lesson index limbs: no --lessons-output given')
    print('subject slots self-test', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true', required=True)
    parser.add_argument('--lessons-output', type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if self_test(args.lessons_output) else 1)
