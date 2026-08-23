# P2 rescue — the audience-copy rewrite, held RED

This directory exists because the P2 rewrite lived only in /tmp on a sandbox that
does not survive the session. /tmp is not preservation. Work is safe when it is
pushed, not when it is written.

  combined-p1-p2.patch   the full working-tree diff at the moment P2 was held,
                         i.e. P1 and P2 together, against b912ad0
  p2-copy.json           the five rewritten records: kicker, title, lead, closing
  verify_audience_copy.mjs  the derived route-to-copy gate, 72/72 at the time

P2 was held under §3.9: the 20-pair swap test returned 19/20, with
closing: councils <-> partners judged plausibly interchangeable. The rule says
invent no alternative wording and stop, so it was stopped rather than papered over.

This branch is a preservation branch, not a proposal. The live work continues on
claude/mbm-findability-copy-picks-apex-m1wv23 (site PR #172).
