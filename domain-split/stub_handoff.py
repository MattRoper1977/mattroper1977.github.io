"""Reviewed Glitch sender assembly shared by publication and browser fixtures.

The source-bound live receiver prerequisite is recorded in the release plan.
"""
from pathlib import Path
import re

ROUTE = '/Lessons/Games/Glitch_Clash.html'
HERE = Path(__file__).resolve().parent


def decorate(route, html):
    """Retain existing links/text and move the old URL preservation to shared JS."""
    inline = '<script>const a=document.getElementById("play-game");const u=new URL(a.href);u.search=location.search;u.hash=location.hash;a.href=u.href;</script>'
    if html.count(inline) != 1:
        raise ValueError('Stub URL-preservation source changed; review before replacing')
    html = html.replace(inline, '<script defer src="/stub-handoff.js"></script>')
    if route == ROUTE:
        html = html.replace('</style>', '#save-handoff button{font:inherit;min-height:44px;min-width:44px;padding:.5rem 1rem;touch-action:manipulation}#save-handoff button:focus-visible{outline:3px solid #e39129;outline-offset:4px}</style>')
        html = html.replace('</main>', '<div id="save-handoff"></div></main>')
    if len(html.encode()) > 2048:
        raise ValueError('Handoff stub exceeds2KB')
    return html


def fixture(output):
    # Build an isolated copy of the same reviewed publication bytes.
    from build_education import moved_page
    output = Path(output)
    path = output/'education-lessons/Games/Glitch_Clash.html'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(decorate(ROUTE, moved_page(ROUTE)))
    script = output/'education-site/stub-handoff.js'
    script.parent.mkdir(parents=True, exist_ok=True)
    script.write_bytes((HERE/'stub-handoff.js').read_bytes())
    return path


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture-output', required=True, type=Path)
    args = parser.parse_args()
    print('ISOLATED HANDOFF FIXTURE:', fixture(args.fixture_output))
