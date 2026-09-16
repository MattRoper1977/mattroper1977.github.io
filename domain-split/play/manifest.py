"""Validate Play's emitted manifest and its discoverable homepage link."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import struct
from urllib.parse import urlparse


class ManifestLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.theme_colors = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and 'manifest' in attrs.get('rel', '').split():
            self.links.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'theme-color':
            self.theme_colors.append(attrs.get('content'))


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
    # The browser chrome colour the homepage declares must be the colour the installed app declares.
    assert parser.theme_colors == [manifest['theme_color']], 'Homepage theme-color must equal the manifest theme_color'
    # Every icon is one of the Play install icons derived from the accepted Play mark
    # (tools/prepare_play_install_icons.py; record beside this file), never the education "M".
    record = json.loads((Path(__file__).resolve().parent / 'install-icons.json').read_text())
    recorded = {'/' + path: entry['sha256'] for path, entry in record['outputs'].items()}
    sizes = {'any': set(), 'maskable': set()}
    for icon in manifest.get('icons', []):
        url = urlparse(icon['src'])
        assert not url.netloc and url.path.startswith('/assets/icons/'), 'Icon must use existing local identity'
        data = (root / url.path.lstrip('/')).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n', 'Icon is not a PNG'
        width, height = struct.unpack('>II', data[16:24])
        assert icon['sizes'] == f'{width}x{height}', 'Icon dimensions differ from declaration'
        assert hashlib.sha256(data).hexdigest() == recorded.get(url.path), f'Icon is not the recorded Play install icon: {url.path}'
        assert icon.get('purpose') in sizes, f'Icon purpose must be any or maskable: {url.path}'
        sizes[icon['purpose']].add((width, height))
    for purpose, found in sizes.items():
        assert {(192, 192), (512, 512)} <= found, f'Both icon sizes required for purpose {purpose}'
    # iOS takes /apple-touch-icon.png from the root; on Play it is the Play mark too.
    touch = (root / 'apple-touch-icon.png').read_bytes()
    assert hashlib.sha256(touch).hexdigest() == recorded['/assets/icons/play-apple-touch-icon.png'], 'Root apple-touch-icon is not the Play install icon'
    for shortcut in manifest.get('shortcuts', []):
        url = urlparse(shortcut['url'])
        assert not url.netloc, 'Shortcut leaves Play'
        path = root / url.path.lstrip('/')
        assert path.is_file() or (path / 'index.html').is_file(), 'Shortcut target missing'
    return {'name': manifest['name'], 'start_url': '/', 'scope': '/', 'display': manifest['display'],
            'theme_color': manifest['theme_color'], 'icons': {purpose: sorted(found) for purpose, found in sizes.items()},
            'apple_touch_icon': 'Play install icon', 'service_worker': 'none at the Play root; installability is proven, no offline claim is made'}
