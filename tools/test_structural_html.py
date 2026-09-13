#!/usr/bin/env python3
"""Boundary regression controls for the PRX1 review candidate."""
from pathlib import Path
from html.parser import HTMLParser
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'domain-split'))
from structural_html import replace_first_element, prepend_to_first_main
from structural_html import VOID_ELEMENTS


class Tree(HTMLParser):
    """Small parse tree with end-tag recovery; no rendering dependency."""
    def __init__(self):
        super().__init__()
        self.root = {'tag': '#document', 'parent': None}
        self.stack = [self.root]
        self.ids = {}

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'parent': self.stack[-1]}
        identifier = dict(attrs).get('id')
        if identifier:
            self.ids[identifier] = node
        if tag not in VOID_ELEMENTS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_ELEMENTS:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index]['tag'] == tag:
                del self.stack[index:]
                break


def tree_of(source):
    tree = Tree()
    tree.feed(source)
    tree.close()
    return tree


def is_descendant(node, ancestor):
    parent = node['parent']
    while parent is not None:
        if parent is ancestor:
            return True
        parent = parent['parent']
    return False


class StructuralReplacement(unittest.TestCase):
    def test_chrome_insertion_keeps_skip_link_and_exact_main_and_tail(self):
        prefix = ('<!doctype html><html><head><script>const sample="<main>fake</main>";</script>'
                  '</head><body><a href="#main">Skip to content</a><!-- <main>inert</main> -->')
        body = '<main id="main" data-label="a > b"><div id="heading">Science</div></main>'
        tail = '<footer>Kept &amp; exact</footer></body></html>'
        chrome = '<header id="chrome"><nav>Menu</nav></header>'
        result, count = prepend_to_first_main(prefix + body + tail, chrome)
        self.assertEqual(count, 1)
        self.assertEqual(result, prefix + chrome + body + tail)
        tree = tree_of(result)
        self.assertFalse(is_descendant(tree.ids['main'], tree.ids['chrome']))

    def test_chrome_insertion_refuses_unsafe_or_missing_main(self):
        for source in ('<main>unfinished', '<main><main>nested</main></main>',
                       '<template><main>inert</main></template><main>real</main>',
                       '<main><div></main></div>'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                prepend_to_first_main(source, '<header>Menu</header>')
        self.assertEqual(prepend_to_first_main('<body>No main</body>', '<header>Menu</header>'),
                         ('<body>No main</body>', 0))
        with self.assertRaisesRegex(ValueError, 'Unbalanced'):
            prepend_to_first_main('<main>Kept</main>', '<header><span>Broken</header>')

    def test_nested_fault_defeats_old_count_guard(self):
        for tag in ('header', 'main'):
            with self.subTest(tag=tag):
                original = f'<{tag}><article><{tag}>inner</{tag}></article></{tag}><p id="after">kept</p>'
                self.assertEqual(original.count(f'<{tag}>'), 2)
                self.assertIn(f'<article><{tag}>inner</{tag}></article>', original)
                old, count = re.subn(fr'<{tag}\b[^>]*>.*?</{tag}>',
                                     f'<{tag}>new</{tag}>', original, count=1, flags=re.S)
                self.assertEqual(count, 1)  # the old guard is falsely satisfied
                self.assertIn(f'</article></{tag}>', old)  # orphaned source tail
                with self.assertRaisesRegex(ValueError, 'Nested'):
                    replace_first_element(original, tag, f'<{tag}>new</{tag}>')

    def test_restoration_and_unaffected_tail(self):
        for tag in ('header', 'main'):
            before = '\ufeff<!doctype html>\r\n<!-- unchanged -->'
            after = '\r\n<p id="after">Résumé &amp; pupil</p>\n'
            original = before + f'<{tag} class="old"><article>old</article></{tag}>' + after
            replacement = f'<{tag}>new \\1 &amp; text</{tag}>'
            self.assertEqual(replace_first_element(original, tag, replacement),
                             (before + replacement + after, 1))

    def test_comment_script_and_style_literals_are_not_elements(self):
        prefix = '<!-- <header>fake</header> -->\n<script>const x="<header>fake</header>";</script><style>/*<header>fake</header>*/</style>'
        original = prefix + '<header>real</header><main>keep</main>'
        self.assertEqual(replace_first_element(original, 'header', '<header>new</header>'),
                         (prefix + '<header>new</header><main>keep</main>', 1))

    def test_quoted_angle_bracket_and_mixed_case(self):
        original = '<HEADER data-label="a > b">old</HEADER   ><main>keep</main>'
        self.assertEqual(replace_first_element(original, 'header', '<header>new</header>'),
                         ('<header>new</header><main>keep</main>', 1))

    def test_later_sibling_is_preserved(self):
        original = '<header>first</header><article><header>second</header></article>'
        self.assertEqual(replace_first_element(original, 'header', '<header>new</header>'),
                         ('<header>new</header><article><header>second</header></article>', 1))

    def test_unsafe_or_absent_boundaries(self):
        for source in ('<header>unfinished', '</header><header>real</header>', '<header/>'):
            with self.subTest(source=source), self.assertRaises(ValueError):
                replace_first_element(source, 'header', '<header>new</header>')
        self.assertEqual(replace_first_element('<main>keep</main>', 'header', 'new'),
                         ('<main>keep</main>', 0))

    def test_malformed_closing_tag_cannot_truncate_at_quoted_angle(self):
        for tag in ('header', 'main'):
            source = f'<{tag}>old</{tag} data-note=">"><p>keep</p>'
            with self.subTest(tag=tag), self.assertRaisesRegex(ValueError, 'Malformed'):
                replace_first_element(source, tag, f'<{tag}>new</{tag}>')

    def test_template_cannot_supply_a_page_boundary(self):
        for source in ('<template><header>inert</header></template><header>real</header>',
                       '<header><template></header></template></header>',
                       '<template/><header>ambiguous</header>'):
            with self.subTest(source=source), self.assertRaisesRegex(ValueError, 'emplate'):
                replace_first_element(source, 'header', '<header>new</header>')

    def test_region_balance_rejects_straddling_boundaries(self):
        for tag in ('header', 'main'):
            for source in (f'<div><{tag}></div></{tag}>',
                           f'<{tag}><div></{tag}></div>'):
                with self.subTest(tag=tag, source=source):
                    self.assertEqual(source.count('<div>'), 1)
                    self.assertEqual(source.count('</div>'), 1)
                    with self.assertRaisesRegex(ValueError, 'Unbalanced replacement region'):
                        replace_first_element(source, tag, f'<{tag}>new</{tag}>')

    def test_region_balance_accepts_void_elements_and_checks_replacement(self):
        source = '<header><img src="x"><br/><input><svg><path/></svg></header>'
        self.assertEqual(replace_first_element(source, 'header', '<header>new</header>'),
                         ('<header>new</header>', 1))
        replacement = '<header><span>unclosed</header>'
        self.assertEqual(replacement.count('<span>'), 1)
        self.assertNotIn('</span>', replacement)
        with self.assertRaisesRegex(ValueError, 'Unbalanced replacement region'):
            replace_first_element(source, 'header', replacement)

    def test_straddling_close_tag_turns_a_sibling_into_a_descendant(self):
        for tag in ('header', 'main'):
            with self.subTest(tag=tag):
                original = f'<div id="outer"><{tag}></div></{tag}><p id="after">kept</p>'
                self.assertIn(f'<{tag}></div></{tag}>', original)
                before = tree_of(original)
                self.assertIs(before.ids['after']['parent'], before.ids['outer']['parent'])
                self.assertFalse(is_descendant(before.ids['after'], before.ids['outer']))
                old, count = re.subn(fr'<{tag}\b[^>]*>.*?</{tag}>',
                                     f'<{tag}>new</{tag}>', original, count=1, flags=re.S)
                self.assertEqual(count, 1)
                after = tree_of(old)
                self.assertTrue(is_descendant(after.ids['after'], after.ids['outer']))
                with self.assertRaisesRegex(ValueError, 'Unbalanced replacement region'):
                    replace_first_element(original, tag, f'<{tag}>new</{tag}>')


if __name__ == '__main__':
    unittest.main()
