"""Replace one explicit HTML region without serializing unrelated bytes.

Nested occurrences of the target are deliberately unsupported: refuse before
writing rather than truncate at the inner close. Comments and script/style text
are handled by the HTML tokenizer, not by searching for closing-tag literals.
"""
from html.parser import HTMLParser
from collections import Counter
import re


VOID_ELEMENTS = frozenset({
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr',
})


class _RegionBalance(HTMLParser):
    """Count real non-void boundaries inside the isolated replacement region."""
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.depth = Counter()

    def handle_starttag(self, tag, attrs):
        if tag not in VOID_ELEMENTS:
            self.depth[tag] += 1

    def handle_startendtag(self, tag, attrs):
        pass  # an explicit self-contained boundary has net balance zero

    def handle_endtag(self, tag):
        if tag in VOID_ELEMENTS:
            raise ValueError(f'Unbalanced replacement region: closing void </{tag}>')
        self.depth[tag] -= 1
        if self.depth[tag] < 0:
            raise ValueError(f'Unbalanced replacement region: unmatched </{tag}>')


def _assert_balanced(source):
    balance = _RegionBalance()
    balance.feed(source)
    balance.close()
    unclosed = {tag: count for tag, count in balance.depth.items() if count}
    if unclosed:
        raise ValueError(f'Unbalanced replacement region: unclosed elements {unclosed}')


class _FirstRegion(HTMLParser):
    def __init__(self, source, tag):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.tag = tag
        self.lines = [0] + [i + 1 for i, c in enumerate(source) if c == '\n']
        self.start = None
        self.end = None
        self.template_depth = 0

    def source_offset(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag == 'template':
            self.template_depth += 1
        if tag != self.tag or self.end is not None:
            return
        if self.template_depth:
            raise ValueError(f'Template-contained <{tag}> replacement is unsupported')
        if self.start is not None:
            raise ValueError(f'Nested <{tag}> replacement is unsupported')
        self.start = self.source_offset()

    def handle_startendtag(self, tag, attrs):
        if tag == 'template' and self.end is None:
            raise ValueError('Self-closing template boundary is unsupported')
        if tag == self.tag and self.end is None:
            raise ValueError(f'Self-closing <{tag}> replacement is unsupported')

    def handle_endtag(self, tag):
        if tag == 'template':
            self.template_depth = max(0, self.template_depth - 1)
        if tag != self.tag or self.end is not None:
            return
        if self.template_depth:
            raise ValueError(f'Template-contained </{tag}> replacement is unsupported')
        if self.start is None:
            raise ValueError(f'Unmatched </{tag}> before replacement region')
        offset = self.source_offset()
        closing = re.match(rf'</{tag}[ \t\n\r\f]*>', self.source[offset:], re.I)
        if closing is None:
            raise ValueError(f'Malformed </{tag}> replacement boundary is unsupported')
        self.end = offset + closing.end()


def replace_first_element(source, tag, replacement):
    """Return (text, count); missing gives count 0, unsafe boundaries raise.

The first real element is the existing publisher contract. Later sibling
elements are preserved. This is a region tokenizer, not full HTML validation.
"""
    if tag not in {'header', 'main'}:
        raise ValueError('Only header and main publisher regions are supported')
    region = _FirstRegion(source, tag)
    region.feed(source)
    region.close()
    if region.start is None:
        return source, 0
    if region.end is None:
        raise ValueError(f'Unclosed <{tag}> replacement region')
    _assert_balanced(source[region.start:region.end])
    _assert_balanced(replacement)
    return source[:region.start] + replacement + source[region.end:], 1


def append_to_first_footer(source, fragment):
    """Append a chrome fragment without replacing authored footer copy or links."""
    region = _FirstRegion(source, 'footer')
    region.feed(source)
    region.close()
    if region.start is None:
        return source, 0
    if region.end is None:
        raise ValueError('Unclosed <footer> append region')
    original = source[region.start:region.end]
    _assert_balanced(original)
    _assert_balanced(fragment)
    closing = re.search(r'</footer[ \t\n\r\f]*>$', original, re.I)
    offset = region.start + closing.start()
    return source[:offset] + fragment + source[offset:], 1
