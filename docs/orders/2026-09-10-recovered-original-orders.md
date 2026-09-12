# Appendix B — recovered original order texts

Companion to *Education Master Order 2026-09-11 (v2)*. Satisfies Stage 0 item 2:
*"Recover the full text and latest readback for GW1-E, GW1 §B–§F, LW1, ML1, PRX1, BL1,
LP1, PIN1, SB1, TH1 Part C, LF1-M and the two UX1 rows. A title on the old board is not
sufficient to implement an unseen order."*

**Source:** conversation *"Science build files and lundy loop removal"*, 10 September
2026 — <https://claude.ai/chat/118d90ca-722f-4119-8bf4-7603ee9afcc9>

## Recovery status

| Order | Board row | Status | Location |
|---|---|---|---|
| ML1 | 4 | **RECOVERED IN FULL** | §B1 below |
| PRX1 | 5 | **RECOVERED IN FULL** | §B2 below |
| BL1 | 6 | **RECOVERED IN FULL** | §B3 below |
| LP1 | 7 | **RECOVERED IN FULL** | §B4 below |
| PIN1 | 8 | **RECOVERED IN FULL** | §B5 below |
| SB1 | 9 | **RECOVERED IN FULL** | §B6 below |
| UX1 Part A | 11 | **PARTIAL** — §0–§2 recovered | §B7; also committed at `docs/orders/UX1A-HUB-PLACEMENT.md` |
| UX1 Part B | 12 | **PARTIAL** — §0–§1 recovered | §B8 |
| UX1 Part C | 13 | NOT YET EXTRACTED | Same chat, earlier turns |
| GW1-E / GW1 §B–§F | 2 | NOT YET EXTRACTED | Same chat, earlier turns |
| LW1 | 2 | NOT YET EXTRACTED | Same chat, earlier turns |
| TH1 Part C | 1 | NOT YET EXTRACTED | Same chat |
| LF1-M | 10 | NOT YET EXTRACTED | Same chat |

**Standing action:** UX1's own order text was flagged as existing *only in chat* —
identified as the root cause that PR #490 closed for GC1. Commit every order in this
appendix to `docs/orders/` before any of them runs. An order that lives only in a
transcript is one lost session away from being unimplementable.

---

## Session guidance, as originally issued

- **Ongoing** — paste into the session already running; it shares pins, admission state
  and branch context.
- **Fresh** — a new session, because it needs a clean inventory or a different repo's
  mental model.
- **Own** — big enough to deserve undivided budget.

| Order | Session | Note |
|---|---|---|
| ML1 | fresh | Repo: site. The one sanctioned workflow edit in the estate. |
| PRX1 | with ML1 | Same repo, same head, one inventory serves both. Must land **before** SW2. |
| BL1 | fresh, after ML1 | Until the mirror leg is repaired none of the backlog can merge anyway. |
| LP1 | own | Touches four repos. |
| PIN1 | with LP1 | Same subject family, same repos. |
| SB1 | rides with Computing | Small. Due before a **second** Scratch unit, not before #493. |

---

## B1 · ORDER ML1 — the mirror-leg comparison basis

**What it does.** The shelf-mirror required check currently fuses two different facts:
that a PR's served bytes are wrong (a real defect), and that main has moved ahead of the
last deploy (not a defect of any PR under test). It therefore reds every site PR and has
held #191, #192 and #194 for two weeks. ML1 separates the two facts without softening
either. It is the keystone of the whole backlog — one patch clears three PRs and makes
UX1 Part B possible at all.

```text
ORDER ML1 — repair the mirror-leg comparison basis
Sentinels: mbm-mirror-leg-2026-09-10-ML1-TOP / mbm-mirror-leg-2026-09-10-ML1-BOTTOM
Exit tokens: ML1_CLOSED | ML1_PARTIAL | ML1_BLOCKED
Repo: mattroper1977.github.io. This is the one sanctioned workflow edit in the estate; it exists because Matt has authorised this specific repair by the PR route.

§0 THE RULE THAT GOVERNS EVERY OPTION
0.1 REPAIR THE COMPARISON BASIS, NEVER DEMOTE THE REQUIREMENT. Reject on sight anything that disables, quarantines, continue-on-errors, narrows the path filter of, or widens what counts as a match on this check. Order N's twenty-one silent checks is the precedent: a red check that merges is worse than no check.
0.2 The check currently fuses two facts — served bytes are wrong (a real defect of the PR) and main has moved ahead of the last deploy (not a defect of any PR under test). The repair separates them; it does not soften either.
0.3 Never push to main. PR route only, per the ruleset.

§1 MEASURE FIRST
1.1 Re-inventory: every open PR in this repo with head SHA, mergeable state, and which checks are currently failing on each. The 29 August picture is stale and four orders have already been written against stale snapshots.
1.2 Locate the check by file and line — job, step, and the assertion it makes. Print it.
1.3 Hash the workflow file and compare against the recorded before-image. Identical means no prior attempt landed; different means diff it against the recorded patch before assuming anything.
1.4 Confirm the documented patch in docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md still applies to the current file. If it does not, say so and stop rather than adapting it silently.

§2 THE REPAIR
2.1 Blocking assertion: served bytes compared against THE TREE THE PR WOULD PRODUCE. A mirror-repairing PR then passes, which it cannot today.
2.2 Inherited drift: reported on its own named, non-blocking line for PRs that do not touch the mirror.
2.3 MAIN STILL REDS ON REAL DRIFT. If the check goes quiet on main too, it is a demotion wearing a better name and the repair is wrong.
2.4 Preserve the tightenings found by the adversarial review: reading main made the check BLIND, so a PR that corrupts or deletes the mirror passes today. Both must red after the repair.

§3 PROOFS — four cases, all required, each on its own named branch, all closed after
3.1 Planted genuinely-wrong served byte → still RED. Without this the repair is an amnesty.
3.2 Corrupted mirror → RED.
3.3 Deleted mirror → RED.
3.4 Unrelated PR on a drifted main → GREEN on the blocking line, drift reported on the non-blocking one.
3.5 Scratch branches are draft, prefixed, and closed in the same step with confirmation. Sibling guards firing on a deliberately corrupted mirror are EXPECTED-RED, not findings.
3.6 A single green from the check you just changed is not evidence about the check you just changed. Two instruments.

§4 LAND, THEN DRAIN
4.1 The workflow change is its own PR with a DECISIONS entry. Nothing else in the diff.
4.2 After it merges, re-run checks on #191, #192 and #194 and report each: cleared, or still red for a different and named reason.
4.3 For each that clears, apply its own pickup conditions before merging — #191 owes the delta cap post-merge, routes-serve-200, the R4 line present once, and the mirror confirmed clean by two instruments.
4.4 One merge at a time, Pages deploy terminal between.
4.5 Do NOT drain the wider backlog in this order. Report the re-inventory from §1.1 and stop; sequencing eleven PRs is its own order written against a fresh picture.

§5 STOP CONDITIONS
The documented patch no longer applies; any option on the table demotes rather than repairs; §3.1 fails to red; main goes quiet on real drift; the permission classifier blocks the write — in which case report it and stop, and do not seek a second route to the same write.

§6 READBACK
The re-inventory table; the check located by file and line; the workflow hash comparison; the repair as a diff; all four proofs with results; #191/#192/#194 status after; PR number; what remains. End with ML1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B2 · ORDER PRX1 — the publisher regexes

**What it does.** Two live-publisher functions locate closing tags by lazy regex, which
stops at the first inner tag and silently orphans everything below. An HTML parser
repairs the unbalanced tag, so the page renders correctly and every render-level check
passes while the tree is wrong — detection has to be structural, never visual. Latent
today only because the curated page list contains no nested headers; live the moment SW2
extends that list. **Lands before SW2, not after.**

```text
ORDER PRX1 — balanced-walk repair for the publisher's tag surgery
Sentinels: mbm-publisher-regex-PRX1-TOP / mbm-publisher-regex-PRX1-BOTTOM
Exit tokens: PRX1_CLOSED | PRX1_PARTIAL | PRX1_BLOCKED
Repo: mattroper1977.github.io. Runs after ML1 in the same session. Must land BEFORE Order SW2.

§0 WHY THIS EXISTS
0.1 domain-split/shared_navigation.py:181 uses re.subn(r'<header\b[^>]*>.*?</header>', …). <header> can nest, so a lazy match stops at the inner close and leaves the outer element open.
0.2 domain-split/audience_discovery.py:232 is the same shape on <main>.
0.3 An HTML parser repairs an unbalanced tag, so the page renders correctly and every render-level check passes while the tree is wrong. Detection is structural, never visual.
0.4 The if count != 1 guard does not catch this: an early lazy stop still counts as one replacement.
0.5 Latent, not live — 9 Site pages carry more than one </header>, none are in shared_navigation's curated list, and 0 of 7 audience_discovery targets carry more than one </main>. Re-measure all three numbers; do not carry them.

§1 MEASURE
1.1 Re-derive the curated list and the target set at current main. Report both with counts.
1.2 Re-run the nesting census: pages with >1 </header>, pages with >1 </main>. Nested <main> is invalid HTML so the expected answer is zero — an unexpected non-zero moves this from latent to live and changes the order's urgency. Report either way.
1.3 Census the whole repo for the same shape: any extraction, injection or patch step locating a closing tag by first-match, index or regex rather than by balanced walk. Report file and line for every hit, classified as writing or measuring — only writers are in scope here.

§2 THE REPAIR
2.1 Replace both call sites with a balanced walk that raises rather than truncates when it cannot find a matching close.
2.2 Keep the existing count assertion and add a balance assertion across the replaced region: the region opens and closes the same number of times, or it raises.
2.3 Do not change what either function is trying to do. This is a mechanism repair, not a behaviour change — a byte-identical output on every current input is the expected result.

§3 PROOFS
3.1 Golden test: every page in both target sets produces byte-identical output before and after. Report the count with its denominator. Any difference is a stop, not a fix.
3.2 Planted nested <header> on a scratch copy → the repaired function raises; the old function silently truncates. Show both outputs.
3.3 Planted nested <main> → same.
3.4 Structural assertion, not visual: for a planted case, ask the DOM whether an element that should be a sibling has become a descendant. That question is the only one that finds this class.
3.5 A plant that cannot fire certifies the guard. Each plant asserts its own mutation landed before asserting the failure.

§4 LAND
4.1 One PR, both call sites, plus a DECISIONS entry naming the mechanism and the three census numbers.
4.2 The §1.3 census lands as a finding in the same PR, unfixed — other hits get their own order.
4.3 Published output unchanged, proved by §3.1, so no served proof is required beyond the normal publication run.

§5 STOP CONDITIONS
Any golden test differs; a plant does not fire; the nesting census returns a non-zero for <main>; the repair would change any function's intent.

§6 READBACK
Both censuses with denominators; the repo-wide shape census classified writing versus measuring; the diff; all five proofs; the golden-test count; PR number. End with PRX1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B3 · ORDER BL1 — the site PR backlog

**What it does.** Eleven open site PRs as of 29 August, from three half-landed arcs all
contending on the same derived files. That picture is now over a fortnight stale, and
four consecutive orders were written against relayed snapshots each wrong in a new way.
So BL1's first job is a fresh inventory and its second is *sequencing* — not merging
everything.

```text
ORDER BL1 — inventory and sequence the site PR backlog
Sentinels: mbm-site-backlog-BL1-TOP / mbm-site-backlog-BL1-BOTTOM
Exit tokens: BL1_CLOSED | BL1_PARTIAL | BL1_BLOCKED
Repo: mattroper1977.github.io. PREREQ: ML1 closed and #191/#192/#194 resolved. Fresh session — do not inherit any carried state.

§0 THE STANDING RULE THIS ORDER EXISTS TO OBEY
0.1 THE CARRIED STATE IS NEVER THE PICTURE. Four consecutive orders were written against relayed snapshots and each was wrong in a new way. Any order acting on more than one PR re-inventories first, and this one does nothing else until it has.
0.2 No PR merges in §1. Inventory is read-only.

§1 INVENTORY — read-only, zero mutations
1.1 Every open PR: number, head SHA, title, base, mergeable state, age, and the arc it belongs to.
1.2 Per PR, the currently failing exact-head checks. Report the total as a sum across PRs, not as a count of reds on main — those are different quantities and conflating them is how the 12 figure was misread.
1.3 THE OVERLAP MATRIX, which is the real output: for every pair of open PRs, the files they both touch. The known collisions are derived surfaces — mbm-search-index.json, sitemap.xml, hud-coverage.json — where three arcs ordered in isolation all contend.
1.4 Classify every overlapping file AUTHORED or DERIVED. All derived means ordering is a scheduling question and is free. Any authored means a genuine conflict that gets named and reported, not resolved by judgement.
1.5 For each PR state plainly: understood and one measurement from done, half-understood, or stale beyond recovery.

§2 SEQUENCE — propose, do not execute
2.1 Land what is understood and one measurement from done. Never let a half-understood PR from one arc gate two finished lanes from another.
2.2 Each Games PR merges after its own site partner, so the mirror guard is green by construction. The Games ordering is not a separate decision; it falls out of the site ordering.
2.3 Never consolidate two review trails to solve a rebase.
2.4 Report the proposed sequence with the reason for each position, and a swap line where a different order is defensible.
2.5 The no-reds-may-grow rule breaks the moment anything merges, so state it correctly: no individual PR's failing-check count may rise, and no new failure may appear on main.

§3 EXECUTE — only the portion Matt approves
3.1 Merge strictly in the approved sequence, one at a time, Pages deploy terminal between.
3.2 After each merge, re-measure the next PR rather than trusting §1's snapshot. A merge moves the picture.
3.3 Any PR whose checks change character after a preceding merge stops the sequence and is reported.

§4 STOP CONDITIONS
An overlapping file classifies AUTHORED; a PR's state differs from §1's inventory by the time it is reached; any merge would raise another PR's failing-check count; a stale PR would need rebasing to be understood — propose closing it unmerged instead.

§5 READBACK
The full inventory table; the overlap matrix with AUTHORED/DERIVED classification; the proposed sequence with reasons; what was merged and what was left; the final open-PR list. End with BL1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B4 · ORDER LP1 — PR-time mode for every live proof

**What it does.** Thirteen live proofs across four repos skip on `pull_request` and
report green. That is how a broken serve proof shipped green twice in one afternoon —
#498 and #499 were PRs whose entire subject was the serve proof, gated by a serve proof
that did not run. LP1 gives every live proof a PR-time mode against the PR's own build
served locally in the runner, plus a mandatory planted-red proof per verifier.

```text
ORDER LP1 — PR-time mode for every live proof
Sentinels: mbm-live-proof-mode-LP1-TOP / mbm-live-proof-mode-LP1-BOTTOM
Exit tokens: LP1_CLOSED | LP1_PARTIAL | LP1_BLOCKED
Repos: site, Lessons, Apps, Games. Own session. PREREQ: ML1 closed.

§0 THE PROBLEM, STATED PRECISELY
0.1 Thirteen live proofs are gated `if: github.event_name != 'pull_request'` or equivalent. On a PR they skip and the check reports green.
0.2 That green is an ABSENCE, not evidence. #498 and #499 were PRs whose entire subject was the serve proof, gated by a serve proof that did not run.
0.3 Same subject, two contexts: the live run belongs post-merge; a PR needs the same assertion against something it can actually reach.

§1 CENSUS FIRST
1.1 Enumerate every live proof across all four repos: file, line, gating condition, what it asserts, and which event actually executes it. My carried figure is 13 — Site 6, Lessons 3, Apps 2, Games 1. Confirm or contradict.
1.2 For each, classify the assertion: served bytes, route reachability, marker presence, or content equality. The class decides whether a PR-time mode is even possible.
1.3 Report which of the 13 CANNOT have a PR-time mode and why. An honest "not possible for this one" beats a mode that asserts nothing.

§2 THE PR-TIME MODE
2.1 Each proof gains a second subject: the PR's own build, served locally in the runner, asserted with the same predicate as the live run.
2.2 The live run stays exactly as it is, post-merge, unchanged. This adds a mode; it does not replace one.
2.3 The two modes must be visibly distinguishable in the log — which subject was asserted, and against what.
2.4 A proof with no possible PR-time mode reports UNMEASURED at PR time, never green. Silence is not green and neither is a skip.

§3 THE MANDATORY RED PROOF
3.1 Every verifier gains a planted-red proof: a mutation that must make it fail. A pass that cannot fail is itself a red.
3.2 Each plant asserts its own mutation landed before asserting the failure — a plant that cannot fire certifies the guard it was meant to test.
3.3 Plants derive their target from the values they read, never hard-coded, or the plant silently stops testing the moment a value moves.

§4 SCOPE DISCIPLINE
4.1 One repo per PR. Never a cross-repo change in a single PR.
4.2 Never edit a check to make your own PR pass. If this order's own PR is blocked by a check it is repairing, stop and report — do not route around it.
4.3 Where a proof is vacuous rather than skipped — asserting stub existence, or fetching an education route from a Play default — rename it to assert what it actually tests, or retarget it per ESTATE_MAP. Both are separate DECISIONS-backed changes, not silent fixes.

§5 STOP CONDITIONS
A PR-time mode would assert something weaker than the live mode while reporting the same name; a plant does not fire; the census contradicts §1.1 in a way that changes the scope materially; a workflow edit would be needed to land this order's own PR.

§6 READBACK
The census table with all thirteen classified; per proof, whether a PR-time mode was added, and if not, why; every plant with its fired/not-fired result; the vacuous-check list with its disposition; PR numbers per repo. End with LP1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B5 · ORDER PIN1 — pin coverage by dependency, not by accident

**What it does.** On #499 the two gates validating the 89-pin set ran only because the
*checker* was edited. Had the change touched only the pinned files, those gates would
have stayed silent and a stale pin would have surfaced later on somebody else's PR, where
nobody has the context. PIN1 derives each gate's trigger paths from the registry it
asserts against.

```text
ORDER PIN1 — make pin coverage depend on what is pinned
Sentinels: mbm-pin-coverage-PIN1-TOP / mbm-pin-coverage-PIN1-BOTTOM
Exit tokens: PIN1_CLOSED | PIN1_PARTIAL | PIN1_BLOCKED
Runs with or after LP1.

§0 THE FINDING
0.1 On #499 the two gates that validate the pins ran only because the checker itself was edited. Had the change touched only the two pinned files, those gates would have stayed silent and the stale pins would have surfaced on somebody else's PR.
0.2 Coverage established by what a change touched, rather than by what depends on it, is coverage by accident. This is the same distinction as trigger versus assertion, in a different place.
0.3 Do NOT frame this as the GLV3 hole. That reading was mine, was tested, and was disproven — GLV3's pathspec is an isolation guard and it worked correctly in every observed case. This finding stands on its own measurement.

§1 MEASURE
1.1 Enumerate the pin set: every path, which registry pins it, and which gate asserts it. My carried figure is 89 — confirm.
1.2 For each gate, print its trigger paths and the paths it asserts on. Report the two sets side by side and name every path that is asserted but not triggered on.
1.3 Report the reverse too: triggered but not asserted. That direction is usually isolation by design and is not a defect — say which is which rather than treating asymmetry as a bug.

§2 THE REPAIR
2.1 Derive each gate's trigger paths from the registry it asserts against, so adding a pinned path automatically brings it into coverage. A hand-maintained trigger list drifts from a generated registry the first time someone adds a row.
2.2 If the trigger cannot be derived, state why and propose the smallest honest alternative — a scheduled census that reports drift is better than a trigger list that lies.
2.3 Never widen a trigger to `**` to solve this. That converts a targeted gate into noise and gets it ignored.

§3 PROOFS
3.1 Red proof by dependency: change only a pinned file, without touching any checker, and show the gate now fires and reds.
3.2 Green proof: correct the pin in the same commit and show it passes.
3.3 Control: a change touching neither pinned files nor checkers leaves the gate dormant, as it should.
3.4 All three on scratch branches, closed after.

§4 STOP CONDITIONS
The trigger cannot be derived and no honest alternative exists; §3.1 does not red; the repair would widen a trigger beyond the registry's own paths.

§5 READBACK
The pin enumeration with its denominator; the trigger-versus-assertion table for every gate, both directions, with asymmetries classified as defect or design; the derivation approach; all three proofs; PR number. End with PIN1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B6 · ORDER SB1 — the sb3 schema gate

**What it does.** Nothing verifies that a `.sb3` is a real Scratch project. The extension
only decides whether the census can classify the file; the acceptance rule in force is
exact reviewed digest. A renamed zip with a script inside is refused today *only* because
its digest is unreviewed — a different protection than the one it appears to be. Stated
honestly: this is a gap in what is asserted, not a live vulnerability.

```text
ORDER SB1 — wire the sb3 schema gate
Sentinels: mbm-sb3-gate-SB1-TOP / mbm-sb3-gate-SB1-BOTTOM
Exit tokens: SB1_CLOSED | SB1_PARTIAL | SB1_BLOCKED
Small, single-purpose. Due before a SECOND Scratch unit, not before #493.

§0 THE GAP, STATED HONESTLY
0.1 The acceptance rule in force is exact reviewed digest. The .sb3 extension only decides whether the census can classify the file.
0.2 Nothing verifies a .sb3 is a real Scratch project. tools/gc1/check_sb3_parents.py exists and is UNWIRED. G1's scratch-parser run for #493 was done BY HAND.
0.3 No workflow references sb3 at all — grep of .github/workflows is empty.
0.4 This is a gap in what is asserted, not a live vulnerability: a renamed zip is refused today because its digest is unreviewed. Say that plainly rather than overstating the risk.

§1 THE GATE
1.1 Wire a schema check that every .sb3 admitted to the tree parses as a Scratch 3 project — the official parser, not a heuristic.
1.2 It runs on any PR touching a .sb3 path, triggered from the paths themselves per PIN1's derivation principle.
1.3 It reports UNMEASURED, never green, if the parser cannot run.

§2 PROOFS
2.1 A genuine project passes.
2.2 A renamed zip with no project.json fails the schema check specifically — not merely as an unreviewed digest. Show which assertion caught it.
2.3 A corrupted project.json inside an otherwise valid container fails.
2.4 The disguised-code control still fires; report the control count before and after.

§3 SCOPE
3.1 Wire the existing tool; do not write a second one. If check_sb3_parents.py is unfit, say why and propose rather than replace.
3.2 One PR, plus a DECISIONS entry recording that the extension allowlist and the schema gate are different protections.

§4 STOP CONDITIONS
The parser cannot run in CI; the existing tool is unfit and a replacement would be needed; the gate would have to trigger on `**` to fire reliably.

§5 READBACK
What the tool asserts; the trigger derivation; all four proofs; the control count; PR number. End with SB1_CLOSED / _PARTIAL / _BLOCKED.
```

---

## B7 · ORDER UX1 Part A — the Lessons hub *(partial recovery)*

**What it does.** Builds the Lessons hub, the shared subject page, and the unit-tag
schema and backfill. Issued as a **review copy** — at the time of writing, two of its
three placements pointed at things not yet served.

The hub placement decision is separately committed at
`docs/orders/UX1A-HUB-PLACEMENT.md`: Lifeskills card → "Explore Computing" button → its
own subject page with the unit accordion and an AQA UNIT AWARD chip, labelled Computing
while the route stays `ICT/`. Promotion to its own card triggers at three units or the
first certificated cohort.

**Recovered text — §0 to §2. Sections §3 onward still to extract.**

```text
ORDER UX1-A/BUILD — the Lessons hub, subject pages and unit backfill
Sentinels: mbm-lessons-hub-build-UX1A-TOP / mbm-lessons-hub-build-UX1A-BOTTOM
Exit tokens: UX1A_CLOSED | UX1A_PARTIAL | UX1A_BLOCKED
This is Part A of UX1, written self-contained. Parts B (education surface) and C (Play shelf) are separate and unaffected.

§0 PREREQUISITES — check every one and report the value; any miss is a stop
0.1 UX1's own order text is committed to docs/orders/. It currently exists only in chat, which is the root cause #490 closed for GC1. Commit it before Part A starts or this order points at nothing.
0.2 HC4 closed.
0.3 The three return-week pathways (BUILD, GROW, LAUNCH) have landed and each has its served proof.
0.4 GC1's #493 is merged and the Computing unit is SERVED. If it is not, §3.6's Computing CTA does not ship — the rest of the order proceeds without it. A CTA to an unserved unit is worse than no CTA.
0.5 LF1-M's tutor-time restoration is complete. If it is not, §3.7's "Also here" row does not ship and §5.4's search rows are not added. Same rule: surface nothing that is not yet safe to reach.
0.6 The catalogue has stopped moving — no open content PR touching resources.json. Building a surface against a manifest mid-flight is the FR3/FR4 finding.
0.7 Report each of 0.1–0.6 as a measured value, not a yes.

§1 FENCE — what this order owns and what it must not touch
1.1 OWNS: hub content structure, the shared subject page, the unit-tag schema and backfill, catalogue rows, and the derived discovery surfaces.
1.2 DOES NOT OWN: chrome. Header, footer, tokens, brand mark and the composed-page contrast layer belong to SW2. This order consumes assets/mbm-tokens.css and the chrome templates; it never redefines a colour, never edits a template, never introduces a hex value that is not already a token.
1.3 EXTENDS UX2's data model, never changes it.
1.4 Forbidden throughout: workflow edits, URL renames, copy changes to authored page text, third-party loads, version literals in the footer.
1.5 No infinite scroll and no pagination. Every entry must be reachable by href with JavaScript off — that is what the reachability gate asserts and what keeps the no-JS fallback honest.

§2 PHASE 1 — UNIT TAGS, SCHEMA FIRST
2.1 Define the unit-tag schema before writing a single tag. Fields, allowed shapes, and what "no unit applies" looks like as an explicit value rather than an absent field.
2.2 Derive tags from evidence in this order: the artefact itself, the pack index, then the SoW workbook. Never invent one. Anything underivable is listed for Matt, not guessed.
2.3 Backfill THIS TERM first — Autumn 1 and Autumn 2 — then stop and report coverage as a fraction with its denominator. Later terms are a second pass, not this order.
2.4 An entry whose unit is correctly inapplicable carries the explicit no-unit marker plus a reason.

[§3 onward — NOT YET EXTRACTED. §3.6 carries the Computing CTA, §3.7 the "Also here"
 tutor-time row, §5.4 the search rows. Recover before running.]
```

---

## B8 · ORDER UX1 Part B — the education surface *(partial recovery)*

**What it does.** Menu, homepage, `/commission/`, `/for/` and `/resources/`. Issued as a
review copy. **Part B cannot land at all while the mirror-leg deadlock stands** — every
PR in it is a site PR, and the shelf-mirror step reds every site PR. §0.1 is a real gate,
not a formality.

Note the deliberate overlap: SW2 Parts H (homepage), R (Resources) and U (audience pages)
cover the same surfaces by design. Part B does **only what SW2 has not landed**, decided
by census, not by assumption.

**Recovered text — §0 to §1.4. Sections §1.5 onward still to extract.**

```text
ORDER UX1-B/BUILD — the education surface: menu, homepage, /commission/, /for/, /resources/
Sentinels: mbm-education-surface-UX1B-TOP / mbm-education-surface-UX1B-BOTTOM
Exit tokens: UX1B_CLOSED | UX1B_PARTIAL | UX1B_BLOCKED
Part B of UX1, written self-contained. Part A (Lessons hub) must have landed. Part C (Play) is independent.

§0 PREREQUISITES — measure each, report the value, any miss is a stop
0.1 THE MIRROR LEG IS REPAIRED. Every PR in this order is a site PR, and the shelf-mirror required context reds every site PR until handback item 1 lands via the PR route. If it has not, this order does not start — it does not open PRs that are known-unmergeable, and it does not seek a second route to a write the permission classifier blocked.
0.2 Part A has landed and subject pages are served. The homepage's subject tiles and the Resources cross-links both key on Part A's unit key; without it they have nothing to point at.
0.3 SW2 RECONCILIATION, and this is the one most likely to bite. SW2 Parts H (homepage), R (Resources) and U (audience pages) overlap this order by design — I wrote both. Census what SW2 actually landed, per part, and report it as a table: landed / partial / not started. Part B does ONLY what remains. If SW2 landed a surface, Part B consumes it and touches nothing already correct.
0.4 UX2's data model is the base. This order extends it, never changes it.
0.5 The renderer reproduces the served /for/ pages byte-for-byte. If it does not, stop — that is FC's hard stop and it has not been retired.
0.6 Report 0.1–0.5 as measured values, not as yes.

§1 FENCE — inherited, and stricter here than in Part A
1.1 /for/ PAGES ARE GENERATED from data/audience-homepages.json via tools/render_audience_homepages.py. R7 forbids hand-editing generated output. Every /for/ change is a data change plus a render. Ready-to-paste HTML is unusable by construction.
1.2 THE SAFETY LINE SURVIVES EVERY REWRITE — "use these as discovery routes, not as claims about outcomes or approval", per R4. It is never deleted, never softened, and never duplicated on a page that already carries one; a doubled warning reads as boilerplate and gets skimmed.
1.3 MATT'S TAKES ARE HIS VOICE. No agent edits a take. verify_takes_pin.mjs pins the blob and the pin is proved by mutating a take, not the verifier.
1.4 THE CLAIMS GUARD HOLDS.

[§1.5 onward — NOT YET EXTRACTED. Recover before running.]
```

---

## Still to recover

| Order | Where |
|---|---|
| GW1-E and GW1 §B–§F | *Science build files and lundy loop removal*, earlier turns |
| LW1 | same |
| UX1 Part A §3 onward | same |
| UX1 Part B §1.5 onward | same |
| UX1 Part C | same |
| TH1 Part C | same |
| LF1-M | same |

All are in the same conversation. Say the word for a second extraction pass.

<!-- mbm-education-master-order-appendix-b-2026-09-11 -->
