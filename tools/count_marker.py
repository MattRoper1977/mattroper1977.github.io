#!/usr/bin/env python3
"""count_marker — how many times a marker appears in a fetched body, case-insensitively.

A helper for workflow steps that must not pipe through grep: grep exits 1 on
no match and a shell running -e with pipefail ends the step there, silently.
This prints a count (0 is a count, not a failure) and exits 0.

  count_marker.py MARKER FILE          -> prints the count
  count_marker.py --describe FILE...   -> prints size and <title> of each file
"""
import re
import sys


def main(argv):
    if argv and argv[0] == '--describe':
        for path in argv[1:]:
            try:
                body = open(path, encoding='utf-8', errors='replace').read()
            except OSError as exc:
                print(f'{path}: unreadable ({exc})'); continue
            title = re.search(r'<title>([^<]*)', body, re.I)
            print(f'{path}: {len(body.encode("utf-8"))} bytes, title: {title.group(1).strip() if title else "(none)"}')
        return 0
    if len(argv) != 2:
        print('usage: count_marker.py MARKER FILE | --describe FILE...', file=sys.stderr); return 2
    marker, path = argv
    try:
        body = open(path, encoding='utf-8', errors='replace').read()
    except OSError:
        print(0); return 0
    print(len(re.findall(re.escape(marker), body, re.I)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
