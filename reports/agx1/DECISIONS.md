# AGX-1 · DECISIONS

Written as the pass ran, not reconstructed afterwards.

---

**D-a · Attached to the site repository, verified before any command.**
4/4 markers. `MattRoper1977/Lessons` — the decoy that has caught seven sessions —
was never contacted. Rollback SHA `4afd3485` recorded before the first write.

**D-b · Probed the environment rather than inheriting the last container's.**
The brief warned the previous container had no browser and no network. This one
has both a real Chromium and GitHub/npm reachability, but **not** the live
domain. So the five CI-only gates were additionally run *here*, and the
deployment proof was routed to Actions. Nothing was assumed from the brief.

**D-c · Ran the ε vacuity check first, before anything else in §11.4.**
The brief is explicit that ε = 0 is ambiguous evidence. It resolved to
"vacuous limb, sound gate, sound physics" — recorded as A-2 and placed second
in the findings list.

**D-d · Rejected my own first band-disjointness result rather than reporting
it.** My initial global band test returned OVERLAP. Before writing it up I
re-derived it and found the overlap was produced entirely by the §4.3
sandbag ceiling, which is mandated. Excluding capped calls, bands are cleanly
disjoint (85 > 70 > 55 > 40). **The finding was mine, not the code's.** Logged
in G-2 rather than deleted, because an under-specified check that produces a
false alarm is the same class of error as one that produces a false zero.

**D-e · Rejected my own first "no page overflow" alarm.** A first pass reported
horizontal overflow on the homepage at 360 px. Re-measured:
`scrollWidth === clientWidth === 360`, and the seven elements past the right
edge are `.dx-chip` links inside an intentional horizontal scroll rail. **No
regression.** Not reported as a finding.

**D-f · Classified every hit in every census rather than counting them.**
Three cases where a raw count would have produced a wrong answer:
- `'apex_evolution'` in Biopunk looks like the forbidden `apex_*` storage
  family; in context it is an upgrade id. Not a defect.
- `var n=33;` in `verify_arcade_sports.js` looks like a stale hardcoded count;
  it is a mutation fixture that *plants* one to prove the check rejects it.
  Not a defect.
- `https://madebymatt.uk/apexkick/` in the donor looks like a remote
  dependency; it is a canonical link. Not a defect — but it *is* what fails
  the donor's own check, which is finding G-1.

**D-g · Corrected a false zero of my own before shipping it.** §11.7 asks
whether anything consumes `games.json` at a pinned old SHA. My first answer was
"nothing does". Re-checking against the actual workflow files found
`arcade-sports-verify.yml:41` pinned to `900fae5e…`. **That false zero would
have closed the defect**, which is precisely the failure §11.9 names as the
most expensive. Rewritten as A-6 — and A-6 turned out to be the more serious
half of A-4.

**D-h · Did not fix A-4 or A-6, though both are within reach.** Both edit
`arcade-sports-verify.yml` and `verify_arcade_sports_browser.js` — another
game's gates — during a Golf verification pass, and the correct fix depends on
Matt's unresolved Games#12 ruling (C8). Flagged prominently instead, with the
derive-don't-hardcode fix stated.

**D-i · Did not resolve C1.** §12.3 says present both halves and recommend;
§11.8 says a contradiction with the design record is a finding for Matt, never
an auto-revert. A recommendation is given in A-1. `index.html` and `site.json`
were not modified — a delta on either is RED.

**D-j · Did not touch `mattroper1977.github.io#25`.** Overlap recomputed
against the real head `4afd3485` (not the brief's `6e8ab129`, which is stale).
Read-only via the API; no fetch, rebase, merge or close.

**D-k · Routed the live check through a push-triggered workflow on my own
branch rather than a verification-only PR.** §11.6's proven pattern is a PR
carrying a workflow, closed unmerged. A `push:` trigger scoped to
`claude/apexgolf-build-2026-08-04-b1hbwj` achieves the same evidence with a
smaller footprint: no PR to open, none to remember to close, and nothing that
could be mistaken for a merge candidate. The workflow is read-only against
production.

**D-l · Reported the Games repository as unreachable rather than working
around it.** It is outside this session's allowed scope and no `add_repo` tool
exists. Manifest *content* was measured over raw; repository *state* (Games#9's
commit, Games#12's branch) is recorded as UNVERIFIED in L-1. C8 could not be
discharged, and saying so is the honest answer.

**D-m · Changed nothing about the shipped game, its harness, the manifest, the
sitemap, the homepage or the arcade.** This pass added report artefacts and one
read-only verification workflow. Everything else is measurement.
