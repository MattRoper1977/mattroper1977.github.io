# MBM_FCR_CLOSE_RECORD — order FC-R (r2)

Run 2026-08-26. **Not a re-run of FC; no FC section re-opened.**

Pins verified before any write: site `a23cbc8` ✓ · Lessons `48436f5` ✓ · Games derived and
pinned `2e6e8f4`. Matt's block parsed as: `S19_EXEMPTION = AUTHORISED` · `TAKES_ANSWERS = BLANK` ·
`GAMES = PR` · `LESSONS_C4 = CORRECT` · `MERGE = SELF-ON-GREEN`.

**Annex A was read as quarantined.** The four supplied take texts are not copied into any file,
PR body or commit message, are not compared against the existing takes, and are not treated as
answers to FC's punctuation questions. §5.4 hands the question back.

---

## §5.1 — Per section: outcome, and what was measured versus inferred

### §1 — Lessons C4 records · **HALTED, stop condition 5**

**Measured.** §1.2 requires exactly three files carrying the C4 record; not three ⇒ STOP.
**There are four.**

| file | line | the C4 record |
|---|---|---|
| `LIVETEACH_RESIDUE.md` | 21 | "C4 — NEW, found by the same census, NOT fixed." |
| `LIVETEACH_LT1_CONTACT_SHEET.md` | 41 | "C4 · NEW 2026-08-26, NOT fixed — needs your word." |
| `REGISTER.md` | 2757, 2768 | "C4 opened, NOT fixed — an adjudication applied wider than it was measured." |
| **`LIVETEACH_LEDGER.md`** | **662, 676, 691** | **"SAT-F — C1 closed, C4 opened (2026-08-26)"** |

**The deviation is mine.** FC's handback told Matt "three files" and named the first three. I wrote
the fourth — a SAT-F block appended to the ledger — in the same session and left it out of my own
summary. *A relayed finding is a hypothesis*, and it does not stop being one because I am the
relay.

**Instrument note.** A bare `grep C4` hits **14** files: clicker-spec controls C1–C4, a hex colour
`#C4F52A`, register tool controls, an Art instrument row. That scan cannot discriminate. The
count above comes from a per-token instrument — a `C4` entry **and** the safeguarding subject
matter — which resolves to exactly four.

**Not stretched to three, not narrowed to fit.** The correction line is drafted and ready; it
needs one word from Matt: *four files, or three and leave the ledger's phase record as written
history.* Both are defensible — a phase record arguably documents what SAT-F did rather than
asserting a live finding — and it is not mine to choose.

The operative line, unchanged and unapplied:

> **Record status: CLOSED 2026-08-26 — false positive.** The entries this record refers to are
> invented worked exemplars (declared fiction), not learner data. Ruling: Matt, 2026-08-26.

`data/declared-fiction.json` does **not** exist in the Lessons repo (measured), so the line cites
the ruling by date only — no dangling cross-repo reference.

### §2 — Games: six descriptions · **PROPOSAL-ONLY, as the order directs**

**PR [#41](https://github.com/MattRoper1977/Games/pull/41), opened as a draft so it cannot merge.
`games.json` is byte-untouched.**

**Measured, §2.1.** No tool declares an input that `games.json` is generated from; the five
`tools/apply_*.py` scripts each apply one game's manifest; both workflows validate rather than
generate; last ten commits touching it are Matt ×4, MattRoper1977 ×2, Claude ×3 via #32/#36.
⇒ §2.1's **manual** branch, and stop condition 3.

**Measured, §2.2.** All six re-verified against the artefacts — file and line per claim, in the PR.
One claim got *stronger*: "no individual leaderboard" is now verified **positively** (the only
score containers are `scorePanel kids` / `scorePanel staff`; award buttons `kids|staff|both|nobody`;
zero occurrences of leaderboard, individual, rank, standings, personal best) rather than by the
absence of a word.

**AUTO-DECISION (Class 3 — how, not what).** §2.2 says "artefacts in the GAMES repo". They are not
there; every `href` resolves into Lessons at `48436f5`. Re-verified there. Logged, not smoothed.

### §2.4 — the pathway collision · **UNDETERMINED on the scan, DETERMINED as a defect**

**The scan reports UNDETERMINED, never 0.** `pathway_for` (`build_mbm_search_index.py:174`) calls
`word_match` (`:161`), and the games call site (`:314`) **lowercases** `title + desc + href`
before matching. Lowercasing destroys the only thing separating the verb from the pathway, so a
scan of that blob cannot discriminate. Occurrence count of the `grow` stem across game
title+desc+href: **1**, capitalisation split `{'grow': 1}`.

**A better instrument turned it determined — and it is live.** Checking each game's *resulting*
facet against the word that could have produced it: **eight arcade games are mis-filed under a
teaching pathway right now.**

| game | filed as | trigger |
|---|---|---|
| Biopunk Hive | `GROW` | "**grow** a forbidden containment hive" |
| Apex Tennis | `BUILD` | "then **build** it on court" |
| Aurora Links 3D | `BUILD` | "**Build** your own in the Course Lab" |
| Global Games | `BUILD` | "**Build** an athlete's speed" |
| Lumins | `BUILD` | "dig, **build** and bridge them" |
| Neon Breach | `BUILD` | "into a **build** you choose" |
| The Last Lighthouse | `BUILD` | "**build** your Keeper Record" |
| Voxel Frontier | `BUILD` | "Mine, **build** and explore" |

FC recorded this as a near-miss it had avoided. **It was not a near-miss.** It was nearly adding
instances nine and ten to a defect that already exists eight times.

**Not fixed, and the reason is measured.** §2.4(a) wants whole-field equality — no record declares
a `pathway` field (`games.json` fields: icon, title, desc, href, tag, hue, featured, hero, art,
collection; `lessons-resources.json`: added, desc, family, featured, file, id, keywords, new,
subject, title, type, year). Switching to field equality would strip the pathway facet from
**558 of 717 records**. §2.4(b) needs a `games.json` hand-edit — stop condition 3. So it is
reported with evidence and left to a pass scoped to it. **No description was reworded to dodge the
scanner beyond avoiding the trigger words, and the verb was not banned** — the PR says plainly that
avoiding the words is a workaround, not a fix.

### §3 — Site: statutory-citation exemption · **HALTED, stop condition 8 + the empty-record rule**

**Measured, §0.7.** `Section 19` appears on **no served page** at `a23cbc8`. All four hits are in
`docs/` — FC's own records explaining why it was withheld (`MBM_FOR_COPY_CLOSE_RECORD.md` ×3,
`FC_UNSURE_STRINGS.md` ×1). Case-insensitive sweep for `section 19` / `s.19` / `section19`: **0**.

**The two supplied paths fail both tests.** `/alternative-provision/` and `/curriculum-overview/`
**do not exist in the tree**, so they neither appear in §0.7 nor can serve 200. Excluded, not
forced (stop condition 8, and A3's rule).

**That leaves the `pages` array empty — and §3.4 forbids exactly that.** An empty allowlist makes
the gate exit `MEASUREMENT INVALID` on every run, which would red main. Shipping it is definitively
wrong; forcing a page in is definitively wrong. So §3 halts rather than smoothing the gap.

**What unblocks it, in one line from Matt:** the token has to exist on a page before a
page-scoped allowlist can license it. Restore `Section 19` to the councils sentence — FC drafted
and withheld exactly that — **in the same change** as the allowlist, and `pages` becomes
`["/for/councils-organisations/"]` on a measured, serving route. That is a legitimate sequencing
fix, but it is a deliberate departure from "populated from where the token appears at `a23cbc8`",
so it is Matt's call and not mine to make quietly.

The gate is named and ready either way: `tools/verify_catalogue_counts.mjs` — NOUNS at line 43,
numeral pattern `\b(\d{2,6})\b` at line 55, firing string *"no audience-homepage copy states a
hardcoded catalogue count"* at line 69.

### §4 — Takes: audit · **COMPLETE, report-only**

`TAKES_ANSWERS = BLANK`. Nothing edited, pin untouched, `games/index.html` byte-unmodified.

| # | identifier | path + line | current text | the characters | FC's question |
|--:|---|---|---|---|---|
| 1 | `/emberwild/` | `games/index.html:303` | Madebymatt meets creature collecting - shh, you know the one. | «Madebymatt» · «collecting - shh» | House spelling? · Em dash? |
| 2 | `/olympics/` | `games/index.html:304` | The weather's too hot and you're not a pro - enjoy athletics at home. | «not a pro - enjoy» | Em dash? |
| 3 | `/apexpool/` | `games/index.html:306` | Good at pool - be great with Apex Pool | ends «Apex Pool», final char `l` · «pool - be» | Full stop? · Em dash? |
| 4 | `/auroralinks/` | `games/index.html:309` | Can't afford your own clubs - the realism means you don't need any. | «clubs - the realism» | Em dash? |

**An unanswered question is a completed report, not a failure.**

**§0.5 pin proof, at head.** In a scratch worktree, one byte inside a take mutated (the verifier
untouched): gate exits 1, names the `curation` region, prints hashes not strings. Reverted: 17/17
green. Scratch removed.

---

## §5.2 — Production verification, stated honestly

**Not verified against production, and this record does not claim otherwise.** Egress to
`madebymatt.uk` is refused by this container's proxy at CONNECT with a 403 policy denial
(`api.github.com` reaches 200 from the same shell, so it is policy, not connectivity). Every
measurement here is of the repository trees at the pinned tips.

**Residual gap:** this pass changed no served page — §1 and §3 halted, §2 is a draft proposal, §4
is report-only — so there is nothing deployed for a production check to disagree with. The gap is
real but empty in this instance.

---

## §5.3 — The FC appendix, reprinted verbatim (C4 removed, closed)

**A1 — The tag backfill.** `data/tag-backfill.csv`, 641 rows, four fields pre-filled and four tag fields deliberately empty (never seeded with the discarded derivation — the spot-check was 12/20 against an 18 threshold, so the whole derivation was binned). Parked at S5 with the ruling: **tag the ~30 resources Matt teaches from in the first fortnight, then decide.** This is the single highest-leverage queued item — it is the blocker under A2 *and* under the faceted filter's multi-select.

**A2 — Pupil card badges** (device · controls · quick-play · silent-friendly). The audit pack proposed them; Order S already settled the *design* — non-interactive on pupil surfaces, interactive and ≥44px on teacher surfaces, one component, two call sites. **Blocked on A1**: the record carries `subject, type, family, year` and nothing that yields a device or control tag. Do not derive these; that path was already measured and discarded.

**A3 — `data/declared-fiction.json`** as a standalone deliverable if §FC6.7 ledgers rather than builds it. Cheap, useful beyond the gate, and it converts "everything is invented" from a claim into a checkable record.

**B1 — The two public ASDAN PDFs.** Each carries one stale "BUILD — an Award" sentence, mirroring what PH-3's C1 fixed in `asdan/app.html`. PH-3 C5 stopped correctly: **no PDF generator exists in the site repo.** This is a regeneration-day item, not a patch — it needs the generator question answered first.

**B2 — The LAUNCH Vocational Hospitality clock.** Verified 2026-08-18: ASDAN is withdrawing **all** Vocational Taster titles — registrations and books to **31 Dec 2026**, final certification **31 Aug 2027**. LAUNCH Vocational's six lessons bank "ASDAN Hospitality / Gardening"; **Hospitality is a Vocational Taster and is on that clock, Gardening is an ordinary Short Course and is not.** This is a curriculum decision for Matt and Cheryl, not a code change. **It has the nearest real deadline of anything on this list.**

**B3 — The 10-hour rule workbook fix.** `Planning/LAUNCH/LAUNCH_Autumn_Year_Plan_ASDAN.xlsx` repeatedly asserts a 10-hour rule on ComSk1 ("THE 10-HOUR RULE IS THE DESIGN CONSTRAINT"). It is false — the gate is on the other five skills. Proposed cell fixes sit in `_passph3/JOB_A_REPORT.md`, values-only, listed cells only. **Verify whether they were applied; do not assume either way.**

**C1 — The `/for/` cross-link graph is asymmetric.** Each audience page offers a "switch to…" link, but the graph is not closed: several audiences are linked *from* nowhere. Audit all seven, build the full matrix, and close the loop — a reader who lands on the wrong page should be one link from the right one, in every direction. Cheap, and it compounds with the findability work.

**C2 — The teachers-page video claim.** The page describes an owner-controlled demonstration. Verify whether it is a genuine click-to-load facade or an embedded player that loads on page view — the claim is only true in the first case. **Verify before rewording; do not reword into a stronger claim.**

**C3 — The trusts page.** FC only reconciles it (`TRUSTS=reconcile-only`) because the audit pack supplied no markup for it. It is consequently the least-worked of the seven and probably the weakest. Worth its own small pass once FC lands.

**D1** — UAS centre name and number (`#set-centre`, `#set-cno`): on-device storage, values only Matt holds.
**D2** — The eyeball tap-list from the TSR close.
**D3** — Deferred Lessons and Apps rulesets: SAT-F §2 gated them. Re-run `report_required_checks.py` and create them when the deferral reason has genuinely expired.

### Added by FC, carried forward

**E1 — the `.mf-section-head` lead tag.** All 35 section heads put the lead in a `<span>` where a block-level `<p>` belongs. The CSS couples `>p` to the kicker and `>span` to the lead, so swapping the tag is a visible regression, and fixing it properly needs a selector that FC5.4's zero-new-CSS-classes rule forbids. A small job for a pass allowed to touch CSS.

### Added by this pass

**F1 — the pathway classifier mis-files arcade games.** Eight, live, listed above. Needs either a declared `pathway` field on source records, or a classifier that matches the facet on path/filename rather than description prose. Not a copy job; its own pass.

**F2 — the fourth C4 record.** `LIVETEACH_LEDGER.md` carries a SAT-F block that also states C4 as open. §1 halted on the count. One word from Matt settles whether the correction covers four files or three.

---

## §5.4 — Handed back, unresolved by this pass

1. **The four takes** — reported above, unedited. `TAKES_ANSWERS = BLANK` closed §4 as an audit.
2. **Are the Annex A texts Matt's own words, and are they intended as whole-take replacements?**
   They are quarantined and untouched. FC asked four *punctuation* questions about existing takes;
   the Annex holds four *whole takes*, which is a rewrite rather than an answer. Under the
   2026-08-23 ruling a take is Matt's voice and no agent may write one. **Until that question is
   answered, no take moves.**

## §5.5 — Only Matt can do these

- **§1:** four files or three? (the ledger's SAT-F phase record is the fourth)
- **§3:** authorise restoring `Section 19` to the councils sentence in the same change as the allowlist — or leave the exemption unbuilt until the token exists on a page
- **§2:** apply or reject the six descriptions in `games.json` (PR #41, draft)
- **Annex A:** are those four texts yours, and are they replacements?
- **B2** is the nearest real deadline on the whole list: ASDAN Vocational Taster registrations close **31 Dec 2026**, final certification **31 Aug 2027**. Hospitality is on that clock; Gardening is not.
