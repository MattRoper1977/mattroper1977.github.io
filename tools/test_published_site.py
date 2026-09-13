"""Adversarial provenance and extraction controls; no network or credentials."""
import copy
import io
from pathlib import Path
import tempfile
import time
import unittest
import zipfile
from lib.publication_artifacts import (Inconclusive, validate_artifact, publication_run_matches,
                                         extract_archive, prepare_one, digest, select_artifact)


class ProvenanceControls(unittest.TestCase):
    def setUp(self):
        self.run = {'id': 123, 'head_branch': 'main', 'event': 'push', 'head_sha': 'a'*40,
                    'status': 'completed', 'conclusion': 'success', 'run_attempt': 4,
                    'html_url': 'https://github.com/example/run/123'}
        self.artifact = {'id': 456, 'name': 'education-lessons-review', 'expired': False,
                         'created_at': '2026-09-05T18:43:29Z',
                         'workflow_run': {'id': 123, 'head_sha': 'a'*40}, 'digest': 'sha256:'+'b'*64}
        self.jobs = [
            {'id': 100, 'name': 'publish / build', 'run_attempt': 4, 'conclusion': 'success', 'steps': [
                {'name': 'Save the reviewed education output', 'conclusion': 'success',
                 'started_at': '2026-09-05T18:43:28Z', 'completed_at': '2026-09-05T18:43:29Z'}]},
            {'id': 101, 'name': 'publish / deploy', 'run_attempt': 4, 'conclusion': 'success',
             'started_at': '2026-09-05T18:43:38Z'}]

    def test_exact_source_accepts_and_other_source_rejects(self):
        self.assertTrue(publication_run_matches('lessons', self.run, 'a'*40, None))
        self.assertFalse(publication_run_matches('lessons', self.run, 'b'*40, None))
        for field, value in [('event', 'pull_request'), ('head_branch', 'other')]:
            self.assertFalse(publication_run_matches('lessons', {**self.run, field: value}, 'a'*40, None))

    def test_frozen_games_requires_all_publication_inputs_identical(self):
        class GitHub:
            def __init__(self, mutation=None): self.mutation = mutation
            def read(self, route):
                value = 'c'*40
                if self.mutation and self.mutation in route and route.endswith('b'*40): value = 'd'*40
                return {'sha': value}
        self.assertTrue(publication_run_matches('games', self.run, 'b'*40, GitHub()))
        for file in ['games.json', 'play-publication.json', 'play-domain-publication.yml']:
            self.assertFalse(publication_run_matches('games', self.run, 'b'*40, GitHub(file)))

    def test_artifact_must_bind_exact_run_source_and_digest(self):
        validate_artifact(self.artifact, self.run, 'lessons')
        for mutation in [{'expired': True}, {'name': 'unreviewed'}, {'digest': ''},
                         {'workflow_run': {'id': 124, 'head_sha': 'a'*40}},
                         {'workflow_run': {'id': 123, 'head_sha': 'b'*40}}]:
            with self.assertRaises(Inconclusive): validate_artifact({**self.artifact, **mutation}, self.run, 'lessons')

    def test_four_reruns_select_only_successful_attempts_upload(self):
        old = [{**self.artifact, 'id': number, 'created_at': created} for number, created in enumerate([
            '2026-09-05T17:27:53Z', '2026-09-05T18:25:18Z', '2026-09-05T18:33:15Z'])]
        artifact, binding = select_artifact(old+[self.artifact], self.run, self.jobs, 'lessons')
        self.assertEqual(artifact['id'], 456)
        self.assertEqual(binding['run_attempt'], 4)
        self.assertEqual(binding['upload_job_id'], 100)
        self.assertEqual(binding['deploy_job_id'], 101)

    def test_duplicate_or_out_of_attempt_artifact_is_rejected(self):
        for artifacts in [[self.artifact, {**self.artifact, 'id': 457}],
                          [{**self.artifact, 'created_at': '2026-09-05T18:33:15Z'}],
                          [{**self.artifact, 'created_at': '2026-09-05T18:43:40Z'}]]:
            with self.assertRaises(Inconclusive): select_artifact(artifacts, self.run, self.jobs, 'lessons')
        stale_jobs = copy.deepcopy(self.jobs)
        stale_jobs[1]['run_attempt'] = 3
        with self.assertRaises(Inconclusive): select_artifact([self.artifact], self.run, stale_jobs, 'lessons')
        stale_jobs = copy.deepcopy(self.jobs)
        stale_jobs[0]['run_attempt'] = 3
        with self.assertRaises(Inconclusive): select_artifact([self.artifact], self.run, stale_jobs, 'lessons')

    def archive(self, name='index.html', data=b'approved'):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive: archive.writestr(name, data)
        return stream.getvalue()

    def test_safe_archive_extracts_without_overwriting(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp)/'publication'
            extract_archive(self.archive(), dest)
            self.assertEqual((dest/'index.html').read_bytes(), b'approved')
            with self.assertRaises(Inconclusive): extract_archive(self.archive(), dest)

    def test_escaping_archive_names_fail(self):
        with tempfile.TemporaryDirectory() as temp:
            for number, name in enumerate(['../outside', '/absolute', 'a/../../outside', 'a\\outside']):
                with self.assertRaises(Inconclusive): extract_archive(self.archive(name), Path(temp)/str(number))

    def test_successful_review_without_successful_deploy_fails(self):
        outer = self
        class GitHub:
            deadline = time.monotonic()+30
            def read(self, route, raw=False):
                if '/workflows/' in route: return {'workflow_runs': [outer.run]}
                if '/jobs?' in route: return {'jobs': [{'name': 'publish / deploy', 'conclusion': 'skipped'}]}
                raise AssertionError('Must stop before reading any artifact')
        with tempfile.TemporaryDirectory() as temp, self.assertRaises(Inconclusive):
            prepare_one('lessons', 'a'*40, Path(temp), GitHub())

    def test_verified_archive_accepts_and_download_mutation_fails(self):
        outer = self
        archive = self.archive()
        class GitHub:
            deadline = time.monotonic()+30
            mutate = False
            def read(self, route, raw=False):
                if '/workflows/' in route: return {'workflow_runs': [outer.run]}
                if '/jobs?' in route: return {'jobs': outer.jobs}
                if '/artifacts?' in route: return {'artifacts': [{**outer.artifact, 'digest': digest(archive)}]}
                if route.endswith('/zip'): return archive + (b'x' if self.mutate else b'')
                raise AssertionError(route)
        with tempfile.TemporaryDirectory() as temp:
            evidence = prepare_one('lessons', 'a'*40, Path(temp), GitHub())
            self.assertEqual(evidence['deployment'], 'success')
            self.assertEqual(Path(evidence['root'], 'index.html').read_bytes(), b'approved')
        with tempfile.TemporaryDirectory() as temp:
            bad = GitHub(); bad.mutate = True
            with self.assertRaises(Inconclusive): prepare_one('lessons', 'a'*40, Path(temp), bad)


class PublishedWitnessControls(unittest.TestCase):
    def evaluate_publication_fixture(self, *, redirect=None, stale_home=False):
        """Exercise check_once and urllib's actual redirect processing offline."""
        from contextlib import ExitStack
        from email.message import Message
        import urllib.request
        from urllib.response import addinfourl
        from unittest.mock import patch
        import verify_deployment_provenance as provenance
        expected = 'a' * 40
        with tempfile.TemporaryDirectory() as temp, ExitStack() as stack:
            root = Path(temp)
            expected_by_url = {}
            for relative in provenance.EDUCATION_OUTPUT_WITNESSES:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(('reviewed transformed ' + relative).encode())
                expected_by_url['https://madebymatt.uk' + provenance.served_url(relative)] = target.read_bytes()
            requests = []
            def origin_response(handler, request):
                url = request.full_url
                requests.append(url)
                headers = Message()
                code = 200
                if url == 'https://madebymatt.uk/' and redirect:
                    code = 302
                    headers['Location'] = redirect
                    body = b'redirect'
                elif redirect and url == redirect:
                    # If the transport followed the redirect, the wrong origin
                    # would return perfectly matching bytes. The proof must
                    # reject the redirect before making this second request.
                    body = expected_by_url['https://madebymatt.uk/']
                else:
                    body = expected_by_url[url]
                    if stale_home and url == 'https://madebymatt.uk/':
                        body = b'previously deployed homepage'
                result = addinfourl(io.BytesIO(body), headers, url, code)
                result.msg = 'Found' if code == 302 else 'OK'
                return result
            stack.enter_context(patch.object(provenance, 'PUBLISHED_ROOT', root))
            stack.enter_context(patch.object(provenance, 'PUBLISHED_SHA', expected))
            stack.enter_context(patch.object(provenance, 'deployed_sha', return_value=(expected, 'fixture')))
            stack.enter_context(patch.object(provenance, 'resolve', return_value=expected))
            # A builder-only commit has no changed raw served-source paths.
            stack.enter_context(patch.object(provenance, 'changed_served_files', return_value=[]))
            stack.enter_context(patch.object(provenance, 'data_stamp_of', return_value='unchanged'))
            stack.enter_context(patch.object(urllib.request.HTTPSHandler, 'https_open', origin_response))
            stack.enter_context(patch.object(urllib.request.HTTPHandler, 'http_open', origin_response))
            findings = provenance.check_once(provenance.EducationTransport(), expected,
                                              provenance.DEFAULT_BASE, provenance.DEFAULT_REPO)
            return provenance.verdict(findings), findings, requests

    def test_builder_only_change_still_measures_real_outputs_and_rejects_stale_home(self):
        state, findings, requests = self.evaluate_publication_fixture()
        self.assertEqual(state, 'PASS')
        self.assertEqual(len(requests), 9)
        self.assertTrue(any(layer == '3 origin witness index.html' and status == 'PASS'
                            for layer, status, _ in findings))
        state, findings, requests = self.evaluate_publication_fixture(stale_home=True)
        self.assertEqual(state, 'FAIL')
        self.assertEqual(len(requests), 9)
        self.assertTrue(any(layer == '3 origin witness index.html' and status == 'FAIL'
                            for layer, status, _ in findings))

    def test_check_once_rejects_redirects_even_when_destination_has_matching_bytes(self):
        for destination in ['http://madebymatt.uk/', 'https://example.com/', 'https://madebymatt.uk/other/']:
            with self.subTest(destination=destination):
                state, findings, requests = self.evaluate_publication_fixture(redirect=destination)
                self.assertEqual(state, 'FAIL')
                self.assertNotIn(destination, requests, 'The transport followed a forbidden redirect')
                self.assertTrue(any(layer == '3 origin witness index.html' and status == 'FAIL' and '302' in detail
                                    for layer, status, detail in findings))

    def test_transformed_artifact_is_expected_and_another_sha_cannot_borrow_it(self):
        from unittest.mock import patch
        import verify_deployment_provenance as provenance
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'resources').mkdir()
            (root / 'resources/index.html').write_bytes(b'reviewed transformed publication')
            with patch.object(provenance, 'PUBLISHED_ROOT', root), patch.object(provenance, 'PUBLISHED_SHA', 'a'*40):
                self.assertEqual(provenance.expected_bytes('a'*40, 'resources/index.html'), b'reviewed transformed publication')
                with self.assertRaises(ValueError): provenance.expected_bytes('b'*40, 'resources/index.html')
                with self.assertRaises(ValueError): provenance.expected_bytes('a'*40, '../outside')
                self.assertIsNone(provenance.expected_bytes('a'*40, 'missing.html'))

    def test_exact_education_proof_refuses_all_redirects(self):
        import urllib.request
        from prepare_published_site import NoRedirect
        handler = NoRedirect()
        request = urllib.request.Request('https://madebymatt.uk/resources/')
        for destination in ['http://madebymatt.uk/resources/', 'https://example.com/resources/', 'https://madebymatt.uk/']:
            with self.assertRaises(Inconclusive):
                handler.redirect_request(request, None, 302, 'Found', {}, destination)



class PublishedChromeControls(unittest.TestCase):
    """The real publisher consumes both shared fragments and fails on drift."""
    @classmethod
    def setUpClass(cls):
        import importlib.util
        root = Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location(
            'chrome_fixture_navigation', root / 'domain-split/shared_navigation.py')
        cls.navigation = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.navigation)

    def render_fixture(self, source, values):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'fixture.html').write_text(source)
            with patch.object(self.navigation, 'CHROME', root):
                return self.navigation.chrome_template('fixture.html', 'fixture', values)

    def test_fragment_boundaries_must_be_unique_ordered_and_on_own_lines(self):
        start = '<!-- MBM-CHROME-FRAGMENT: fixture -->'
        end = '<!-- /MBM-CHROME-FRAGMENT: fixture -->'
        valid = start + '\n{{value}}\n' + end
        self.assertEqual(self.render_fixture(valid, {'value': 'rendered'}), 'rendered')
        for source in [valid.replace(start, ''), valid.replace(end, ''),
                       valid + valid, end + '\n{{value}}\n' + start,
                       start + '{{value}}\n' + end, start + '\n{{value}}' + end]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                self.render_fixture(source, {'value': 'rendered'})

    def test_missing_unknown_and_malformed_slots_fail_before_rendering(self):
        for body in ['no slot', '{{other}}', '{{value}} {{other}}',
                     '{{value}} {{BAD}}', '{{value}} {{unfinished', '{{value}} stray}}']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                self.render_fixture('<!-- MBM-CHROME-FRAGMENT: fixture -->\n' + body +
                                    '\n<!-- /MBM-CHROME-FRAGMENT: fixture -->',
                                    {'value': 'rendered'})

    def test_both_shared_files_drive_the_published_header(self):
        from unittest.mock import patch
        navigation = self.navigation
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for filename, before, after in [
                    ('header.html', 'class="mbm-unified-header"', 'class="header-source-control"'),
                    ('menu-sheet.html', 'class="mbm-unified-menu"', 'class="menu-source-control"')]:
                source = (navigation.CHROME / filename).read_text()
                self.assertEqual(source.count(before), 1)
                (root / filename).write_text(source.replace(before, after))
            with patch.object(navigation, 'CHROME', root):
                result = navigation.header('/', [('/for/pupils/', 'Pupils')])
        self.assertIn('class="header-source-control"', result)
        self.assertIn('class="menu-source-control"', result)
        self.assertNotIn('class="mbm-unified-header"', result)
        self.assertNotIn('class="mbm-unified-menu"', result)

    def test_record_text_is_escaped_and_never_reinterpreted_as_template(self):
        result = self.navigation.header('/', [('/for/example/?q="<&>', '{{search}} <A & B>')],
                                        search='/resources/?q="<&>{{menu}}')
        self.assertIn('href="/for/example/?q=&quot;&lt;&amp;&gt;"', result)
        self.assertIn('{{search}} &lt;A &amp; B&gt;</a>', result)
        self.assertIn('href="/resources/?q=&quot;&lt;&amp;&gt;{{menu}}"', result)
        self.assertEqual(result.count('class="mbm-unified-menu"'), 1)

    def test_published_tokens_and_signoff_preserve_authored_footer_and_body(self):
        source = ('<!doctype html><html><head><title>Test</title></head><body>'
                  '<header>MADE BY MATT</header><main><p>Authored lesson text.</p></main>'
                  '<footer><a href="/privacy/">Privacy</a><p>Authored footer.</p></footer></body></html>')
        result = self.navigation.complete_chrome(source)
        document = self.navigation.ChromeDocument(result)
        self.assertEqual([link[2] for link in document.links], ['/assets/mbm-tokens.css'])
        self.assertEqual(document.taglines(), {'all': 1, 'header': 0, 'footer': 1})
        self.assertIn('<main><p>Authored lesson text.</p></main>', result)
        self.assertIn('<footer><a href="/privacy/">Privacy</a><p>Authored footer.</p>', result)
        self.assertEqual(self.navigation.complete_chrome(result), result)

    def test_existing_root_tokens_and_footer_are_byte_identical(self):
        source = ('<html><head><link rel="stylesheet" href="/assets/mbm-tokens.css"></head>'
                  '<body><footer>Learn • Build • Explore</footer></body></html>')
        self.assertEqual(self.navigation.complete_chrome(source), source)
        relative = source.replace('href="/assets/', 'href="assets/')
        self.assertEqual(self.navigation.complete_chrome(relative), source)

    def test_absent_footer_gets_a_first_footer_without_changing_the_body(self):
        source = '<html><head></head><body><main>Authored privacy information.</main></body></html>'
        result = self.navigation.complete_chrome(source)
        self.assertIn('<main>Authored privacy information.</main>', result)
        self.assertEqual(self.navigation.ChromeDocument(result).footers, 1)
        self.assertEqual(self.navigation.ChromeDocument(result).taglines(), {'all': 1, 'header': 0, 'footer': 1})

    def test_chrome_ownership_and_duplicate_link_controls_reject_real_defects(self):
        base = '<html><head></head><body><footer>Authored.</footer></body></html>'
        for broken in [
                base.replace('</head>', '<link rel="stylesheet" href="assets/mbm-tokens.css">' * 2 + '</head>'),
                base.replace('</head>', '<link rel="stylesheet" href="https://elsewhere.test/mbm-tokens.css"></head>'),
                base.replace('<footer>', '<header>Learn • Build • Explore</header><footer>'),
                base.replace('Authored.', 'Learn • Build • Explore Learn • Build • Explore'),
                base.replace('</footer>', '<footer>Nested</footer></footer>'),
                base.replace('</footer>', ''),
                base.replace('</footer>', '</footer><footer>Another owner</footer>')]:
            with self.subTest(source=broken), self.assertRaises(ValueError):
                self.navigation.complete_chrome(broken)
        self.assertEqual(self.navigation.ChromeDocument(self.navigation.complete_chrome(base)).taglines(),
                         {'all': 1, 'header': 0, 'footer': 1})


class ProfessionalStatsControls(unittest.TestCase):
    """Exercise the real live verifier against builder-rendered shared stats."""
    @classmethod
    def setUpClass(cls):
        import importlib.util
        import re
        import verify_professional_site_live as professional
        spec = importlib.util.spec_from_file_location(
            'stats_fixture_builder', professional.ROOT / 'domain-split/usage_discovery.py')
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        # The fixture comes from the publication renderer, not from the markers
        # under test; otherwise deleting a required marker could pass itself.
        cls.shared_stats = builder.shell('Shared usage statistics',
            builder.popularity() + builder.preferences() +
            '<p class="mbm-usage"><a href="/stats/on-this-device/">'
            'View legacy counts stored on this device</a></p>')
        nav_spec = importlib.util.spec_from_file_location(
            'stats_fixture_navigation', professional.ROOT / 'domain-split/shared_navigation.py')
        navigation = importlib.util.module_from_spec(nav_spec)
        nav_spec.loader.exec_module(navigation)
        # The publication applies shared navigation after the stats renderer.
        # Exercise that actual header too, rather than retaining its old shell.
        cls.shared_stats = re.sub(r'<header\b[^>]*>.*?</header>',
            lambda _: navigation.header('/stats/', [('/', 'Homepage')], adult=True),
            cls.shared_stats, count=1, flags=re.S)
        cls.shared_stats = cls.shared_stats.replace('</head>',
            '<link rel="stylesheet" href="/assets/shared-navigation.css">'
            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)
        cls.legacy_stats = (professional.ROOT / 'stats/index.html').read_text()
        cls.published_legacy_stats = re.sub(r'<header\b[^>]*>.*?</header>',
            lambda _: navigation.header('/stats/on-this-device/', [('/', 'Homepage')]),
            cls.legacy_stats, count=1, flags=re.S).replace('</head>',
            '<link rel="stylesheet" href="/assets/shared-navigation.css">'
            '<script defer src="/assets/shared-navigation.js"></script></head>', 1)

    def evaluate_stats(self, markup, *, publication='education', broken_asset=None):
        from unittest.mock import patch
        import verify_professional_site_live as professional
        pages = (professional.EDUCATION_PAGE_MARKERS if publication == 'education'
                 else professional.PAGE_MARKERS)
        assets = (professional.EDUCATION_ASSETS if publication == 'education'
                  else professional.ASSETS)
        json_paths = (professional.EDUCATION_JSON_SURFACES if publication == 'education'
                      else professional.JSON_SURFACES)
        requested = []
        def fixture_fetch(base, path, nonce, timeout):
            requested.append(path)
            content_type = 'text/html'
            status = 200
            if path == '/stats/':
                body = markup.encode()
            elif path == '/stats/on-this-device/':
                body = self.published_legacy_stats.encode()
            elif path in pages:
                body = '\n'.join(pages[path]).encode()
            elif path in assets:
                body = assets[path].read_bytes()
                if path == broken_asset:
                    body = b'// Missing published usage runtime'
                content_type = 'application/octet-stream'
            elif path in json_paths:
                body = b'{"fixture": true}'
                content_type = 'application/json'
            elif path == '/__mbm_professional_live_verify_deliberate_404__':
                status, body = 404, b'Not found'
            else:
                raise AssertionError('Unexpected live-proof route: ' + path)
            return status, {'Content-Type': content_type}, body, base.rstrip('/') + path
        with patch.object(professional, 'fetch', fixture_fetch):
            result = professional.verify_once(professional.DEFAULT_BASE, 1, 1, None, publication)
        self.assertEqual(set(requested), set(pages) | set(assets) | set(json_paths) |
                         {'/__mbm_professional_live_verify_deliberate_404__'})
        return result

    def test_current_shared_stats_and_explicit_legacy_destination_pass(self):
        result = self.evaluate_stats(self.shared_stats)
        self.assertTrue(result['passed'], result['errors'])
        self.assertIn('/stats/on-this-device/', result['pages'])
        self.assertTrue(result['assets']['/assets/usage-client.js']['identical'])

    def test_legacy_device_page_must_keep_shared_navigation(self):
        original = self.published_legacy_stats
        try:
            self.published_legacy_stats = original.replace('data-mbm-navigation="education"', '', 1)
            result = self.evaluate_stats(self.shared_stats)
            self.assertFalse(result['passed'])
            self.assertIn('data-mbm-navigation="education"', result['pages']['/stats/on-this-device/']['missing_markers'])
        finally:
            self.published_legacy_stats = original

    def test_missing_stats_runtime_lists_or_measurement_status_fail(self):
        for marker in ['<script defer src="/assets/usage-client.js"></script>',
                       'data-usage-list="lessons"', 'data-usage-list="packs"',
                       'data-usage-measured-since', 'class="mbm-unified-header"',
                       '<script defer src="/assets/shared-navigation.js"></script>']:
            with self.subTest(marker=marker):
                self.assertIn(marker, self.shared_stats)
                result = self.evaluate_stats(self.shared_stats.replace(marker, '', 1))
                self.assertFalse(result['passed'])
                self.assertIn(marker, result['pages']['/stats/']['missing_markers'])
                self.assertTrue(all(error.startswith('/stats/:') for error in result['errors']))

    def test_reintroduced_game_rankings_or_promotions_fail(self):
        for markup, forbidden in [
            ("<div data-usage-list='games'></div>", 'data-usage-list="games"'),
            ('<section data-usage-popularity="play"></section>', 'data-usage-popularity="play"'),
            ('<article class="featured mbm-play-card"></article>', 'mbm-play-card'),
            ('<section class="mbm-play-showcase"></section>', 'mbm-play-showcase'),
            ('<a data-play-resource="game-apex-kick" href="#">Play</a>', 'data-play-resource'),
            ('<a href="https://www.madebymatt-play.uk/apexkick/">Apex Kick</a>',
             'individual Play promotion: https://www.madebymatt-play.uk/apexkick/'),
        ]:
            with self.subTest(markup=markup):
                result = self.evaluate_stats(self.shared_stats.replace('</main>', markup + '</main>', 1))
                self.assertFalse(result['passed'])
                self.assertEqual(result['pages']['/stats/']['missing_markers'], [])
                self.assertIn(forbidden, result['pages']['/stats/']['forbidden_markers'])
                self.assertTrue(all(error.startswith('/stats/:') for error in result['errors']))

    def test_discreet_play_link_and_save_guidance_remain_allowed(self):
        markup = ('<p><a href="https://www.madebymatt-play.uk/">Made by Matt Play</a>'
                  '<a href="https://www.madebymatt-play.uk/game-saves/">Transfer saves</a></p>')
        result = self.evaluate_stats(self.shared_stats.replace('</main>', markup + '</main>', 1))
        self.assertTrue(result['passed'], result['errors'])

    def test_correct_stats_markup_cannot_hide_broken_served_runtime(self):
        for asset in ['/assets/usage-client.js', '/assets/shared-navigation.js']:
            with self.subTest(asset=asset):
                result = self.evaluate_stats(self.shared_stats, broken_asset=asset)
                self.assertFalse(result['passed'])
                self.assertFalse(result['assets'][asset]['identical'])
                self.assertEqual(result['pages']['/stats/']['missing_markers'], [])

    def test_legacy_mode_keeps_its_original_stats_contract(self):
        result = self.evaluate_stats(self.legacy_stats, publication='legacy')
        self.assertTrue(result['passed'], result['errors'])
        self.assertNotIn('/stats/on-this-device/', result['pages'])
        self.assertNotIn('/assets/usage-client.js', result['assets'])
        self.assertFalse(self.evaluate_stats(self.shared_stats, publication='legacy')['passed'])


if __name__ == '__main__': unittest.main(verbosity=2)
