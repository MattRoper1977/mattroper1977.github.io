"""Subject-only publication preservation controls for the Lessons owner carrier."""
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'domain-split'))
import shared_navigation


class SubjectChromeControls(unittest.TestCase):
    navigation = shared_navigation

    def subject_publication_fixture(self, root, subject):
        """Use the real refresh path; unrelated front doors are small fixtures."""
        output = root / 'output'
        (output / 'education-site/assets').mkdir(parents=True)
        for path in ['education-lessons/index.html', 'education-lessons/primary/index.html',
                     'education-apps/index.html', 'education-lessons/Science_Teesside/index.html',
                     'education-lessons/Humanities_Teesside/index.html',
                     'education-lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html',
                     'education-site/asdan/index.html', 'education-site/uas/index.html']:
            target = output / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('<html><head></head><body><header>Existing</header>'
                              '<main>Keep</main><footer>Learn • Build • Explore</footer></body></html>')
        if subject is not None:
            (output / 'education-lessons/subject.html').write_text(subject)
        return output

    def test_subject_refresh_keeps_body_footer_and_skip_before_shared_chrome(self):
        from unittest.mock import patch
        from structural_html import replace_first_element
        source = ('<html><head><link rel="stylesheet" href="/assets/mbm-tokens.css"></head><body>'
                  '<a class="skip" href="#main">Skip to content</a>'
                  '<main id="main"><h1>Science</h1><input id="search">'
                  '<a id="back" href="index.html">← Lessons</a><div id="rows">Kept lessons</div></main>'
                  '<footer>Authored &amp; exact. Learn • Build • Explore</footer>'
                  '<script defer src="assets/mbm-theme.js"></script></body></html>')
        with tempfile.TemporaryDirectory() as temp:
            output = self.subject_publication_fixture(Path(temp), source)
            with patch.object(self.navigation, 'SITE_PAGES', []), patch.object(self.navigation, 'audience_rows', return_value=[]):
                report = self.navigation.refresh(output, self.navigation.HERE.parent)
            result = (output / 'education-lessons/subject.html').read_text()
        self.assertIn('/Lessons/subject.html', report['routes'])
        self.assertEqual(report['search_controls']['/Lessons/subject.html'], '#search')
        self.assertEqual(result.count('data-mbm-navigation="education"'), 1)
        self.assertLess(result.index('Skip to content'), result.index('<header'))
        self.assertLess(result.index('</header>'), result.index('<main'))
        self.assertIn('data-mbm-theme-slot', result)
        for href in ['/account/', '/members/', '/mailing-list/']:
            self.assertNotIn('href="' + href + '"', result)
        stripped, count = replace_first_element(result, 'header', '')
        self.assertEqual(count, 1)
        assets = ('<link rel="stylesheet" href="/assets/shared-navigation.css">'
                  '<script defer src="/assets/shared-navigation.js"></script>')
        self.assertEqual(stripped.replace(assets, ''), source)

    def test_missing_subject_page_cannot_escape_the_publication_census(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            output = self.subject_publication_fixture(Path(temp), None)
            with patch.object(self.navigation, 'SITE_PAGES', []), patch.object(self.navigation, 'audience_rows', return_value=[]):
                with self.assertRaisesRegex(ValueError, 'Missing navigation surface: .*subject.html'):
                    self.navigation.refresh(output, self.navigation.HERE.parent)


if __name__ == '__main__':
    unittest.main()
