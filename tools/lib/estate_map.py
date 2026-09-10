"""Read data/estate-map.json and answer: which origin serves this route?

The map is generated from domain-split/education_policy.classifier -- see
tools/estate/build_estate_map.py for why it is derived rather than written.
This module and tools/lib/estate-map.cjs are the same predicate in two
languages, and tools/sw2/check_estate_map.py proves they agree with the
classifier route by route rather than assuming it.
"""
import json
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

_DEFAULT = Path(__file__).resolve().parents[2] / 'data/estate-map.json'


class EstateMap:
    def __init__(self, document):
        self.education = document['origins']['education']
        self.play = document['origins']['play']
        self.education_hosts = set(document['hosts']['education'])
        self.play_hosts = set(document['hosts']['play'])
        self.play_non_game = set(document['playNonGamePaths'])
        self.prefixes = tuple(document['gamePathPrefixes'])
        self.known = set(document['knownGameRoutes'])
        self.directories = set(document['gameDirectories'])
        self.retained = set(document['educationRetained'])
        excluded = document['educationExcluded']
        self.excluded_prefixes = tuple(excluded['prefixes'])
        self.excluded_exact = set(excluded['exact'])
        self.video_prefix = excluded['videoPrefix']
        self.video_stems = set(excluded['videoStems'])

    @classmethod
    def load(cls, path=None):
        return cls(json.loads(Path(path or _DEFAULT).read_text()))

    @staticmethod
    def route_key(value):
        return unquote(urlparse(value).path).removesuffix('index.html').rstrip('/') or '/'

    def is_play_route(self, value, prefix='/'):
        url = urlparse(urljoin(self.education + (prefix or '/'), value))
        path = self.route_key(url.path)
        if url.hostname in self.play_hosts:
            return path not in self.play_non_game
        if url.hostname not in self.education_hosts or path in self.retained:
            return False
        return (path in self.known
                or path.startswith(self.prefixes)
                or path.strip('/').split('/')[0] in self.directories)

    def education_excludes(self, value, prefix='/'):
        """The education publication does not carry this path at all."""
        url = urlparse(urljoin(self.education + (prefix or '/'), value))
        if url.hostname not in self.education_hosts:
            return False
        path = unquote(url.path).lstrip('/')
        stem = path.rsplit('/', 1)[-1].rsplit('.', 1)[0]
        return (path.startswith(self.excluded_prefixes)
                or path in self.excluded_exact
                or (path.startswith(self.video_prefix) and stem in self.video_stems))

    def origin_for(self, route, prefix='/'):
        """The origin that serves `route`. This is the only correct way to
        choose a base for a request: a literal cannot know that /townlife/
        answers with a stub on education and the real page on Play."""
        if self.is_play_route(route, prefix) or self.education_excludes(route, prefix):
            return self.play
        return self.education

    def describe(self, route, prefix='/'):
        origin = self.origin_for(route, prefix)
        return f'{route} lives on {origin}'
