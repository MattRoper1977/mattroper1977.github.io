#!/usr/bin/env python3
"""Outside the chrome markers, every stamped page is byte-identical to main.

R-T3.1: authored body wording never sits inside a marker. That is a statement
about what the markers may WRAP; this is the other half of it -- that nothing
OUTSIDE them moved either. R-T3.2 step 4 asks for exactly this on /privacy/,
because that page is the estate's storage-keys record, and the same invariant is
worth having on all twelve rather than one.

Each page is compared against its origin/main version after removing, from
both sides, exactly what T3 is allowed to have done: the marker COMMENTS
themselves, the token <link> it inserts, the footer /privacy/ gains, and the
header tagline §0.6 moves to the footer. Anything left over that differs is a
change stamping made outside its own remit.

The marker comments come out; what they WRAP stays in. Excising whole regions
was the first design and it compared unlike things: on main the Menu button is
not marked so it survived the excision, on the branch it is marked so it did
not, and all twelve pages reported a ~100-byte "change" that was the button
being counted on one side only.

EXCISED, not truncated at. Verifying /privacy/ by hand, twice, cut the file at
the new footer instead of cutting the footer out of it, and both times the
<script defer src="/assets/mbm-platform.js"> that follows the footer looked
deleted. It was never touched -- git log -S over the branch confirms the count
never changed. A boundary bug in a check reads exactly like a regression in the
thing checked, which is why this is a gate and not a command someone retypes.

THE ONE DECLARED CHANGE OUTSIDE A MARKER is the header tagline. SW2 §0.6 puts
"Learn • Build • Explore" once per page, in the footer, and none in any header,
so the header's <small> comes out. It sits inside the brand <span>, which no
marker wraps -- the brand is deliberately outside every marker while brand
convergence is blocked (docs/SW2_T3_LEDGER.md). It is declared here rather than
tolerated by a loose comparison, so any OTHER header edit still fails.

  python3 tools/sw2/check_authored_body.py --base origin/main
  python3 tools/sw2/check_authored_body.py --self-test    # red proof
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RECORD = ROOT / "data" / "adult-surfaces.json"

VERIFIER_PAGES = (
    "index.html", "main/index.html", "games/index.html", "tools/index.html",
    "resources/index.html", "members/index.html", "privacy/index.html", "stats/index.html",
)
GENERATED = ("for/", "asdan/", "uas/")

# The three things T3 is allowed to add or move, removed from BOTH sides so
# everything else has to match exactly. Each matches the WHOLE inserted run --
# markers, content and the newline the stamper puts around it -- because the
# markers have to come out with their block, not before it: stripping the
# comments first leaves the block's own surrounding blank lines behind, which
# is precisely the +2 bytes /privacy/ reported when this ran the other way.
ADDED = (
    # the T1 token link, inserted before </head>
    re.compile(r"<!-- mbm-chrome:tokens -->\s*<link[^>]*mbm-tokens\.css[^>]*>\s*<!-- /mbm-chrome:tokens -->\n?"),
    # the footer /privacy/ gains (R-T3.2 step 4); no other page gains one
    re.compile(r"<!-- mbm-chrome:footer -->\s*<footer[^>]*data-mbm-chrome=\"minimal\">.*?</footer>\s*<!-- /mbm-chrome:footer -->\n?", re.S),
    # SW2 §0.6: one tagline per page, in the footer, none in any header
    re.compile(r"<small>Learn\s*•\s*Build\s*•\s*Explore</small>"),
)

# Whatever markers remain wrap content that was already there (the Menu
# button), so only the comments come out and what they wrap is compared like
# any other bytes.
MARKER = re.compile(r"<!-- /?mbm-chrome:[a-z-]+ -->")


def pages() -> list[str]:
    record = json.loads(RECORD.read_text())
    named = {str(e["page"]) for e in record["adultSurfaces"]}
    named |= {str(e["page"]) for e in record["pupilReachableSurfaces"]}
    named |= set(VERIFIER_PAGES)
    return [p for p in sorted(named) if not p.startswith(GENERATED) and (ROOT / p).is_file()]


def at_base(base: str, rel: str) -> str | None:
    r = subprocess.run(["git", "-C", str(ROOT), "show", f"{base}:{rel}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def outside_chrome(text: str) -> str:
    """The page with the marker comments and T3's permitted additions removed."""
    for pattern in ADDED:
        text = pattern.sub("", text)
    return MARKER.sub("", text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--self-test", action="store_true",
                        help="alter one page in memory outside its markers; this gate must fail")
    args = parser.parse_args()

    problems: list[str] = []
    rows: list[tuple[str, int, int, bool]] = []

    for rel in pages():
        before = at_base(args.base, rel)
        if before is None:
            problems.append(f"{rel}: not present at {args.base}")
            continue
        after = (ROOT / rel).read_text()
        if args.self_test and rel == "privacy/index.html":
            # The red proof: one word of authored body copy, changed outside
            # every marker. Nothing is written to disk.
            after = after.replace("</header>", "</header><!--x-->", 1)

        b, a = outside_chrome(before), outside_chrome(after)
        rows.append((rel, len(b), len(a), b == a))
        if b != a:
            for line in _diff(b, a)[:3]:
                problems.append(f"{rel}: {line}")

    print(f"authored body against {args.base}: {len(rows)} pages, chrome regions excised")
    for rel, nb, na, same in rows:
        print(f"  {rel:32}{nb:>7} -> {na:<7} {'identical' if same else 'CHANGED'}")

    if problems:
        print(f"\nPROBLEMS: {len(problems)}", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        return 1
    print(f"\noutside its chrome markers, every stamped page is byte-identical to {args.base}")
    return 0


def _diff(before: str, after: str) -> list[str]:
    import difflib
    out = []
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), lineterm="", n=0):
        if line[:1] in "+-" and line[:3] not in ("---", "+++"):
            out.append(line[:160])
    return out


if __name__ == "__main__":
    raise SystemExit(main())
