#!/usr/bin/env python3
"""Independently check Primary source coverage and navigation-only preservation."""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit

class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []
        self.scripts = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and 'href' in attrs:
            self.links.append(attrs['href'])
        if tag == 'script' and 'src' in attrs:
            self.scripts.append(attrs['src'])

def route(href, base='/Lessons/primary/index.html'):
    value = urlsplit(urljoin('https://madebymatt.uk'+base, href))
    return value.netloc, value.path.removesuffix('index.html').rstrip('/') or '/'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--lessons-source', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    source, output = args.lessons_source, args.output
    published = output/'education-lessons'
    rows = json.loads((source/'resources.json').read_text())
    expected_rows = [row for row in rows if row.get('file', '').startswith('primary/')]
    expected_files = sorted(p for p in (source/'primary').rglob('*') if p.is_file())
    data = json.loads((published/'primary/catalogue.json').read_text())
    manifest = json.loads((output/'education-site/data/primary-discovery.json').read_text())
    assert data['classification'] == 'Primary'
    assert data['counts'] == {'units': 6, 'lessons': 46, 'word_downloads': 6}
    original = Links((source/'primary/index.html').read_text())
    hub = Links((published/'primary/index.html').read_text())
    assert {route(href) for href in original.links} <= {route(href) for href in hub.links}, 'Existing Primary hub destination lost'
    actual_rows = [unit['scheme'] for unit in data['units']] + [row['route'] for unit in data['units'] for row in unit['lessons']]
    assert len(actual_rows) == len(set(actual_rows)) == len(expected_rows) == 52
    assert set(actual_rows) == {'/Lessons/'+row['file'] for row in expected_rows}
    expected_manifest = [{'route': '/Lessons/'+p.relative_to(source).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha256(p.read_bytes()).hexdigest()} for p in expected_files]
    assert manifest['source_files'] == expected_manifest
    assert manifest['resource_payloads_rebuilt'] == 0
    source_core = (source/'assets/catalogue/lesson-navigation.js').read_text()
    published_core = (published/'assets/catalogue/lesson-navigation.js').read_text()
    pattern = r'const HUBS=new Set\(\[([^\]\n]*)\]\);'
    source_set = re.search(pattern, source_core)
    published_set = re.search(pattern, published_core)
    assert source_set and published_set
    old_hubs, new_hubs = source_set[1].split(','), published_set[1].split(',')
    added_hubs = {"ROOT+'primary/index.html'", "ROOT+'primary/'"}
    assert set(new_hubs)-set(old_hubs) == added_hubs
    assert [value for value in new_hubs if value not in added_hubs] == old_hubs
    assert len(new_hubs) == len(set(new_hubs))
    assert source_core[:source_set.start()] == published_core[:published_set.start()]
    assert source_core[source_set.end():] == published_core[published_set.end():], 'Unapproved shared navigation asset change'
    navigation_only, downloads = [], []
    for p in expected_files:
        relative = p.relative_to(source)
        target = published/relative
        assert target.is_file(), 'Missing publication file: '+str(relative)
        if p.suffix != '.html':
            assert target.read_bytes() == p.read_bytes(), 'Download bytes changed: '+str(relative)
            downloads.append('/Lessons/'+relative.as_posix())
        elif p.name != 'index.html' or p.parent != source/'primary':
            text = target.read_text()
            for name in ['lesson-navigation.js', 'primary-discovery.js']:
                src = '/Lessons/assets/catalogue/'+name
                assert Links(text).scripts.count(src) == 1, 'Adapter inclusion is not unique: '+str(relative)
                text = text.replace('<script defer src="'+src+'"></script>', '', 1)
            usage_fragment = '<link rel="stylesheet" href="/assets/usage.css"><script defer src="/assets/usage-client.js"></script>'
            # Lessons and schemes with actual Word download links may have one optional-usage adapter.
            expected_lesson = any(row['route'] == '/Lessons/'+relative.as_posix() for unit in data['units'] for row in unit['lessons'])
            expected_adapter = expected_lesson or '/Lessons/'+relative.as_posix() in [unit['scheme'] for unit in data['units']]
            if (output/'usage-registry.json').is_file():
                assert text.count(usage_fragment) == int(expected_adapter), 'Unexpected usage adapter: '+str(relative)
                assert Links(text).scripts.count('/assets/usage-client.js') == int(expected_adapter)
                text = text.replace(usage_fragment, '', 1)
            assert text == p.read_text(), 'Primary lesson/plan content changed beyond exact navigation/usage adapters: '+str(relative)
            navigation_only.append('/Lessons/'+relative.as_posix())
    assert len(navigation_only) == 52 and len(downloads) == 6
    for unit in data['units']:
        assert unit['tiers'] == ['Seedling', 'Sapling', 'Oak']
        assert [row['sequence'] for row in unit['lessons']] == list(range(1, len(unit['lessons'])+1))
        assert unit['download']['route'] in downloads
        for row in unit['lessons']:
            original_row = next(value for value in expected_rows if '/Lessons/'+value['file'] == row['route'])
            assert row['type'] == 'lesson' and row['source_ids'] == [original_row['id']]
    extras = json.loads((output/'education-site/data/resource-collections.json').read_text())
    domain = json.loads((output/'education-site/data/domain-catalogue.json').read_text())
    required = {route('/Lessons/primary/')} | {route(value) for value in downloads}
    assert required <= {route(row['path']) for row in extras}
    assert required <= {route(row['route']) for row in domain['education']}
    report = {'result': 'PASS', 'source_files': len(expected_files), 'lessons': 46, 'unit_schemes': 6,
              'word_downloads_exact': 6, 'navigation_only_html': len(navigation_only),
              'existing_hub_destinations_preserved': True, 'catalogue_rows_preserved': len(expected_rows),
              'published_core_delta': 'Primary hub route pair only'}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
