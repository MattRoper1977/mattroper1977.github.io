"""Validate Play's emitted manifest and its discoverable homepage link."""
from html.parser import HTMLParser
from pathlib import Path
import json
import struct
from urllib.parse import urlparse


class ManifestLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'manifest' in attrs.get('rel', '').split():
            self.links.append(attrs.get('href'))


def verify(root):
    root = Path(root)
    parser = ManifestLinks()
    parser.feed((root / 'index.html').read_text())
    assert parser.links == ['/site.webmanifest'], 'Play homepage must link exactly one manifest'
    manifest = json.loads((root / 'site.webmanifest').read_text())
    for field, expected in {'name': 'Made by Matt Play', 'start_url': '/', 'scope': '/',
                            'display': 'standalone'}.items():
        assert manifest.get(field) == expected, f'Play manifest {field}'
    assert manifest.get('short_name'), 'Play short name missing'
    for field in ('theme_color', 'background_color'):
        assert manifest.get(field) == '#081422', f'{field} differs from Play token layer'
    sizes = set()
    for icon in manifest.get('icons', []):
        url = urlparse(icon['src'])
        assert not url.netloc and url.path.startswith('/assets/icons/'), 'Icon must use existing local identity'
        data = (root / url.path.lstrip('/')).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n', 'Icon is not a PNG'
        width, height = struct.unpack('>II', data[16:24])
        assert icon['sizes'] == f'{width}x{height}', 'Icon dimensions differ from declaration'
        sizes.add((width, height))
    assert {(192, 192), (512, 512)} <= sizes, 'Both icon sizes required'
    for shortcut in manifest.get('shortcuts', []):
        url = urlparse(shortcut['url'])
        assert not url.netloc, 'Shortcut leaves Play'
        path = root / url.path.lstrip('/')
        assert path.is_file() or (path / 'index.html').is_file(), 'Shortcut target missing'
    return {'name': manifest['name'], 'start_url': '/', 'scope': '/',
            'display': manifest['display'], 'icons': sorted(sizes)}
