#!/usr/bin/env python3
"""Boundary regression controls for the PRX1 review candidate."""
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'domain-split'))
from structural_html import replace_first_element


class StructuralReplacement(unittest.TestCase):
    def test_nested_fault_defeats_old_count_guard(self):
        for tag in ('header', 'main'):
            with self.subTest(tag=tag):
                original = f'<{tag}><article><{tag}>inner</{tag}></article></{tag}><p id="after">kept</p>'
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


if __name__ == '__main__':
    unittest.main()
