#!/usr/bin/env python3
"""Structural HTML extraction for the AS1 shipped-placeholder gate.

Read JSON on stdin and emit text-bearing use sites plus executable scripts.
No path, directory, class name or reference-header exclusion is implemented.
"""
import json
import sys
from html.parser import HTMLParser


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.texts = []
        self.scripts = []
        self.stack = []
        self.raw = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        line, _ = self.getpos()
        if self.raw:
            return
        if tag in ('script', 'style'):
            self.raw = dict(tag=tag, attrs=values, line=line, chunks=[])
            return
        for key, value in attrs:
            if value is None:
                continue
            if key in ('title', 'alt', 'aria-label', 'aria-description', 'aria-roledescription', 'placeholder') or (
                key == 'value' and tag == 'input' and values.get('type', 'text').lower() not in ('hidden', 'checkbox', 'radio', 'file', 'range', 'color')
            ) or (
                key == 'content' and tag == 'meta' and (values.get('name') or values.get('property') or '').lower() in
                ('application-name', 'title', 'description', 'og:title', 'og:description', 'twitter:title', 'twitter:description')
            ):
                self.texts.append(dict(text=value, line=line, use=f'{tag}[{key}]'))
            if key.startswith('on'):
                self.scripts.append(dict(text=value, line=line, use=f'{tag}[{key}]', handler=True))
        if tag == 'iframe' and values.get('srcdoc'):
            self.texts.append(dict(text=values['srcdoc'], line=line, use='iframe[srcdoc]', html=True))
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append(dict(tag=tag, line=line, chunks=[]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.raw:
            if tag == self.raw['tag']:
                if tag == 'script':
                    kind = self.raw['attrs'].get('type', '').lower()
                    if kind in ('', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript'):
                        self.scripts.append(dict(text=''.join(self.raw['chunks']), line=self.raw['line'], use='script'))
                self.raw = None
            return
        index = next((i for i in range(len(self.stack)-1, -1, -1) if self.stack[i]['tag'] == tag), None)
        if index is not None:
            for item in self.stack[index:]:
                if item['chunks']:
                    self.texts.append(dict(text=''.join(item['chunks']), line=item['line'], use=f'{item["tag"]}:composed-text'))
            del self.stack[index:]

    def handle_data(self, data):
        if self.raw:
            self.raw['chunks'].append(data)
            return
        line, _ = self.getpos()
        if data.strip():
            self.texts.append(dict(text=data, line=line, use='text-node'))
        for item in self.stack:
            item['chunks'].append(data)

    def finish(self):
        if self.raw and self.raw['tag'] == 'script':
            self.scripts.append(dict(text=''.join(self.raw['chunks']), line=self.raw['line'], use='unterminated-script'))
        for item in self.stack:
            if item['chunks']:
                self.texts.append(dict(text=''.join(item['chunks']), line=item['line'], use=f'{item["tag"]}:composed-text'))
        return dict(texts=self.texts, scripts=self.scripts)


request = json.load(sys.stdin)
parser = Extractor()
parser.feed(request['source'])
parser.close()
json.dump(parser.finish(), sys.stdout)
