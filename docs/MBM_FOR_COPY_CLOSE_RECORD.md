# MBM_FOR_COPY_CLOSE_RECORD — order FC

Run 2026-08-26 against `mattroper1977.github.io`, branch `claude/fc-for-copy`,
base `main` at `4d355e8`. Working against **the tree at HEAD**, not the served bytes —
see the AUTO-DECISION below.

## The one sentence that governed the run

> **Fix the phrasing, never the posture.** The pack's thesis — that the site is
> defensively over-cautious and should replace restraint with confident marketing
> claims — was rejected on arrival and nothing in this run advances it. Seven guard
> clauses went in and seven came out, byte-verbatim.

## AUTO-DECISION log

**AUTO-DECISION (Class 3, how not what): production is unreachable from this container.**
`madebymatt.uk` is refused by the agent proxy at CONNECT with a 403 policy denial
(`api.github.com` reaches 200 from the same shell, so it is not a network fault). §FC1.1
asks for a production fetch and a reconcile; that could not be done. Destinations were
verified against the tree and the GitHub API instead, and every claim in this record is
about the tree at HEAD. The same limit is recorded in the Lessons repo's LIVETEACH residue,
so it is a known property of this venue rather than a new finding.

## FC1.3 — the twelve premises

| # | premise | verdict | evidence |
|--:|---|---|---|
| 1 | `/for/pupils/` hero promises lessons/pathways the page does not deliver | **DEAD** | Section `[4] learn-explore` — *Open something to learn from* — already carries three cards: Lesson Hub (lessons), BUILD/GROW/LAUNCH (pathways), Matt's Apps (creative). It renders with real images and hrefs. **§FC3.1 closed on arrival; no second bridge built.** |
| 2 | Game descriptions carry third-person teacher-voice | **ALIVE** | 3 games: One Guy (*so pupils compete against*), Kids vs Staff (*pupils take on the staff*), World Cup (*Teacher-driven*). All three fixed. |
| 3 | Game descriptions carry dev jargon | **ALIVE** | Globe Snake *non-Euclidean global surfaces*, Neon Snake *response pathways*, Trail Runner *motor-skills reset* — the pack's own three examples. All fixed. |
| 4 | Six teacher route CTAs share one generic label | **DEAD** | All 14 teacher CTAs name their destination; zero generic labels estate-wide. Four pages repeat a label but each repeat points at the SAME destination. **§FC4.1 closed on arrival (TS §1.7).** |
| 5 | BUILD/GROW/LAUNCH have no gloss | **DEAD** | TS §1.8 landed: *BUILD is the pathway for building core skills*, and the GROW/LAUNCH equivalents, are in the record. |
| 6 | schools-semh serves a stale `511` | **DEAD** | 0 occurrences. Deleted at C2, as predicted. |
| 7 | `Six practical routes` served as a count | **DEAD** | The kicker reads `Practical routes`. PR #178, as predicted. |
| 8 | `discovery card` reaches a reader | **ALIVE** | Not in the record at all — hardcoded in `tools/render_audience_homepages.py`, served on the pupil AND teacher pages. **A record-only sweep was structurally blind to it; the blunter grep over served HTML found it.** Fixed in the renderer. |
| 9 | `the pupil face` reaches a reader | **ALIVE** | `parents.sections[1].items[1].description`. Rephrased, safety meaning kept. |
| 10 | `canonical` reaches a reader | **ALIVE** | 18 reader-facing occurrences across 6 pages. Rephrased. The 7 `<link rel="canonical">` tags are markup and were correctly left. |
| 11 | `not concept products` / `invented approval claims` reach a reader | **ALIVE** | 4 and 1 occurrences. Both rephrased with the boundary intact. |
| 12 | Parents FAQ weighted to mailing-list/account architecture | **ALIVE** | 2 of 4 questions were about the site's own architecture. Restructured by addition and re-ordering. |

Nothing was manufactured to fill a pass. Five premises died and five sections shrank accordingly.

## Guard clauses — seven in, seven out

R4 is the estate's safety line and every audit in the pack recommended deleting it.
Asserted programmatically before and after the sweep, and again by the new `s22` gate.

| audience | noteTitle | clause byte-identical to `main`? |
|---|---|---|
| `pupils` | Public content stays open | **yes** |
| `teachers` | Capability without unsupported claims | **yes** |
| `parents` | Clear boundaries | **yes** |
| `schools` | Capability without unsupported claims | **yes** |
| `trusts` | Capability without unsupported claims | **yes** |
| `councils` | Capability without unsupported claims | **yes** |
| `partners` | Capability without unsupported claims | **yes** |

Seven in, seven out. Not one was reworded, relocated or weakened.

## The named anchors (FC4.4)

| audience | the anchor phrase, named as required | false/meaningless elsewhere? |
|---|---|---|
| `councils` | **"no commissioning, no funding"** | yes — no other audience is in a commissioning relationship |
| `partners` | **"If you build or deliver anything similar"** | yes — meaningless to a parent, a pupil or a school |

**SWAP TEST 22/22** against a 20/20 threshold: 12/12 anchor exclusivity + 10/10 distinct
closing blocks. `pupils` and `teachers` carry no closing block at all — stated, not rounded up.
Both closings are byte-identical to `main`; neither was edited.

## Every string changed, per page

47 strings in `data/audience-homepages.json`, plus 1 in the renderer and 6 game descriptions
in the two source manifests.

### `teachers` — 2 changed

| field | before | after |
|---|---|---|
| `sections[1].lead` | Use canonical Made by Matt destinations rather than hunting through separate collections. | Go straight to the main Made by Matt destinations instead of hunting through separate collections. |
| `sections[3].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |

### `parents` — 17 changed

| field | before | after |
|---|---|---|
| `sections[1].items[1].title` | Use the audience homepage | Send them to the pupil homepage |
| `sections[1].items[1].description` | The pupil face keeps adult account and mailing actions out of the main learner journey. | It keeps account and mailing links off the pages your child uses. |
| `sections[2].lead` | These links open filtered views in the Professional Education Hub before any external navigation. | These links open a filtered list in the Professional Education Hub before anything takes you off Made by Matt. |
| `sections[3].items[0].question` | Does a child need an account to use public games or lessons? | Is it free? |
| `sections[3].items[0].answer` | No. Public games, lessons and learning areas can be opened without creating an account. | Yes. Every game, lesson and resource on the site is free to open. There is an optional Ko-fi link for anyone who wants to help with hosting costs, and nothing is held back if you ignore it. |
| `sections[3].items[1].question` | What does the pupil homepage change? | Does a child need an account to use public games or lessons? |
| `sections[3].items[1].answer` | It changes presentation and navigation only. It does not create a child profile, grant permissions or hide other public content. | No, and everything works without one. Public games, lessons and learning areas open without creating an account. Optional accounts exist for adults and add account-backed features such as carrying saved shortcuts between devices — nothing on the site is withheld if you never make one. |
| `sections[3].items[2].question` | Is the mailing list connected to an account? | Can my child be contacted by anyone here? |
| `sections[3].items[2].answer` | No. Teacher updates use a separate adult mailing-list process, and creating an account never subscribes anyone. | No. There is no chat, no messaging and no way to be matched with another player. Two-player games run on one keyboard or two controllers. The one game that can link two people over the internet needs a connection code that you copy and send yourself, and only steering and throttle cross that link — there is no way to send text. |
| `sections[3].items[3].question` | Does Made by Matt replace school or safeguarding advice? | What device does it need? |
| `sections[3].items[3].answer` | No. Made by Matt provides learning content and tools. Official external material is labelled by publisher in the Education Hub. | Any device with a web browser — a phone, a tablet, a laptop or a school computer. There is nothing to install and no app store involved. |
| `sections[3].items[4].question` | (new) | What does the pupil homepage change? |
| `sections[3].items[4].answer` | (new) | It changes presentation and navigation only. It does not create a child profile, grant permissions or hide other public content. |
| `sections[3].items[5].question` | (new) | Is the mailing list connected to an account? |
| `sections[3].items[5].answer` | (new) | No. Teacher updates use a separate adult mailing-list process, and creating an account never subscribes anyone. |
| `sections[3].items[6].question` | (new) | Does Made by Matt replace school or safeguarding advice? |
| `sections[3].items[6].answer` | (new) | No. Made by Matt provides learning content and tools. Official external material is labelled by publisher in the Education Hub. |

### `schools` — 8 changed

| field | before | after |
|---|---|---|
| `sections[0].lead` | Go straight to the lessons, tools and resources and judge them against the pupils, routines and pressures you already know. This was built inside an SEMH alternative provision, which tells you where it came from and nothing about whether it will fit your setting. | Go straight to the lessons, tools and resources and judge them against the pupils, routines and pressures you already know. This was built inside an SEMH alternative provision, which tells you where it came from and nothing about whether it will fit your setting. If you work in AP or EOTAS, or with pupils where attendance itself has become the presenting issue, this is material you can open today and judge for yourself. |
| `sections[0].items[1].description` | Reach registers, evidence tools and portfolio-oriented resources without invented approval claims. | Reach registers, evidence tools and portfolio resources — with no claim of approval attached. |
| `sections[1].items[3].description` | Search all canonical internal destinations. | Search every Made by Matt lesson, resource, tool and app in one place. |
| `sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### `trusts` — 6 changed

| field | before | after |
|---|---|---|
| `sections[0].items[0].description` | Explore subject, pathway and format coverage across the canonical internal index. | Explore subject, pathway and format coverage across everything on Made by Matt. |
| `sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### `councils` — 7 changed

| field | before | after |
|---|---|---|
| `sections[0].lead` | Open the live materials behind each route and see what is already available to schools and settings, without waiting for a brochure or a summary. Treat it as work to look at, not as commissioned provision, approval or a compliance position. | Open the live materials behind each route and see what is already available to schools and settings, without waiting for a brochure or a summary. Treat it as work to look at, not as commissioned provision, approval or a compliance position. If the question in front of you is a duty to arrange suitable education, a PEP, or what a Virtual School team can point a setting towards, this is work to look at rather than a proposal to consider. |
| `sections[1].items[2].description` | Search all canonical internal destinations. | Search every Made by Matt lesson, resource, tool and app in one place. |
| `sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### `partners` — 7 changed

| field | before | after |
|---|---|---|
| `lead` | Use the canonical catalogue to inspect real games, lessons, apps, tools and education hubs—without fictional clients, programmes or proposal routes. | Use the full catalogue to inspect real games, lessons, apps, tools and education hubs — with no fictional clients, programmes or proposal routes. |
| `sections[1].items[3].description` | Search the complete canonical internal portfolio. | Search the complete Made by Matt portfolio. |
| `sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

## Pupil surface — every visible string that moved

The one surface where a wrong string reaches a child, so it is printed in full (§FC3.5).
Exactly seven, and nothing else on that page moved.

| before | after |
|---|---|
| A unique 3D spherical twist on classic mechanics, mapping directional inputs onto non-Euclidean global surfaces. | Snake, but wrapped around a planet. Steer around the globe, stretch your tail longer and hold to sprint — and unlock new skins as you clear planets. |
| An optimized, high-performance vector snake arena calibrated for fluid mobile and desktop response pathways. | A neon snake arena. Steer with the arrow keys, WASD or a swipe, eat to get longer and pick up speed, then put your initials on the high-score table. |
| A fast-paced reflex runner navigating procedural terrain hazards. Ideal for a quick motor-skills reset. | A fast reflex runner. Jump the hazards, keep your lives and take on the challenges as your journey goes on. |
| …so pupils compete against their own past best rather than each other. | …so you race your own past best rather than anyone else. |
| Whole-class team quiz: pupils take on the staff across scored rounds. Class-vs-teacher framing — no individual leaderboard. | Whole-class team quiz: your class takes on the staff across scored rounds. Teams score, not individuals — no individual leaderboard. |
| Teacher-driven end-of-term tournament: … | An end-of-term tournament your teacher runs: … |
| Nothing has been opened from a Made by Matt discovery card on this device yet. | You haven't opened anything on this device yet. |

Every mechanic named was read out of the artefact first (`DESCRIPTIONS=verified-only`).
Nothing was invented: the pack's pursuing drones, decoy pings, Focus meters, Leave Ratings,
per-world saves and Course Lab appear nowhere in this diff.

**The bug this pass nearly installed.** My first Globe Snake and Neon Snake rewrites both
used the word *grow* — "grow your tail", "eat to grow". `build_mbm_search_index.py` derives
`pathway` by word-boundary match and **"grow" is the GROW teaching pathway**. Two arcade
games would have been filed under a teaching pathway, in search, silently. The generator
caught it; the wording is "stretch your tail longer" and "eat to get longer" instead.
*Adopting a fix can install the bug* is on this order's own failure list, and it was one
word away.

## Omissions — everything not done, and why

| item | why |
|---|---|
| **§FC3.1, the pupils bridge block** | D1 said `BRIDGE=build`. The premise under that decision is dead: the block exists (`learn-explore`). Building a second would have duplicated it. |
| **§FC4.1, CTA relabelling** | Closed on arrival by TS §1.7. Zero generic labels estate-wide. Repeated labels all point at the same destination, which is consistency, not the defect described. |
| **`Section 19` on councils** | Wanted by §FC4.3. Written, then withdrawn: `verify_catalogue_counts.mjs` went red because the numeral sits beside the word "route" and red line 7 forbids counts in prose. **I did not add an exemption to let my own sentence through.** The duty is named in words — *"a duty to arrange suitable education"*. `PEP` and `Virtual School` are on the page as written. Yours to authorise if you want the citation itself. |
| **World Cup's VAR twist / evidence print** | Kept verbatim rather than rewritten. I could not verify them from the artefact's visible text, and D3 says do not write what you cannot verify — but deleting a real feature is worse than leaving it, so only the teacher-voice phrase moved. |
| **Four borderline game descriptions** | `procedurally generated` (Voxel Frontier), `procedural neon arena` (Neon Breach), `a deterministic curling sheet` (Apex Curl), `evidence-aware pathway material`. Player vocabulary rather than developer vocabulary, or describing the material rather than the architecture. All ledgered in `FC_UNSURE_STRINGS.md`; the Apex Curl one is the most borderline and is flagged for your call. |
| **Wholesale dash normalisation** | §FC5.2 asks for consistency; the record is genuinely mixed (4 spaced em dashes, 7 unspaced, 8 spaced hyphens). Normalising all of it would touch strings this order never measured, including ones bound by gates and red-proofs. Dashes were normalised **only on strings already being rewritten**. Ledgered, not silently skipped. |
| **§FC5.3 markup mechanics — two of three not present, one REAL and deliberately not fixed** | Headings inside `<summary>`: **0**. Decorative glyphs missing `aria-hidden="true"`: **0 of 111**. But the third is real: all **35** `.mf-section-head` blocks put the section lead in a `<span>` where a block-level `<p>` belongs. It is **not fixed**, and the reason is a genuine conflict between two of this order's own rules. The CSS already couples both tags — `.mf-section-head>p` styles the *kicker* (uppercase, orange, letter-spaced) and `.mf-section-head>span` styles the *lead*. Changing the tag makes the lead inherit kicker styling: a visible regression on seven pages. Fixing it properly needs a new selector, and §FC5.4 requires **zero new CSS classes**, confirmed by diff. Red line 11 says report and skip rather than invent a prefix, so that is what this does. It is a small, clean job for a pass that is allowed to touch CSS. |
| **Destinations that do not serve 200** | None found — but this could not be measured against production (see the AUTO-DECISION). `/Lessons/` and `/Matt-s-Apps-/` are sibling Pages projects under the same CNAME, not paths in this repo; the other five resolve in-tree. |
| **`s23-no-undeclared-personal-data`** | **LEDGERED AS PROPOSED, not built.** See below. |

## `s23-no-undeclared-personal-data` — PROPOSED, with the reason

The order marks this gate genuinely optional and says explicitly not to let a nice-to-have
gate hold the six adoptions. It is not built, and `data/declared-fiction.json` was **not**
created in this run.

The reason is scope, not difficulty. The gate's own design has the allowlist as its unlock:
it fires on personal-data *shapes*, and a person-shaped name is only a finding if it is **not**
in the declared cast. That makes `declared-fiction.json` a hard precondition — and building it
honestly means an estate-wide census of every invented learner name across **two repositories**,
which is its own pass with its own verification, not a tail on a copy order. Half-building it
would produce exactly the failure the order warns about: a scanner that finds nothing because
it looked at nothing, pointed at the highest-stakes content on the site.

Appendix **A3** already carries it as a standalone deliverable, and it is worth doing on its own
terms — it converts "everything is invented" from a claim into a checkable record.

## Contact sheets

- `docs/FC_TAKES_CONTACT_SHEET.md` — 18 takes read, 4 carrying one of the three mechanical
  issues (`Madebymatt` casing, spaced hyphen, missing terminal punctuation). Every row is a
  question for you, not a replacement string. **Nothing applied.** `games/index.html` is
  byte-untouched this run.
- `docs/FC_UNSURE_STRINGS.md` — what the sweep reached, looked at, and left, with reasons.
- `docs/FC_COPY_INVENTORY.md` — the before-picture, generated from `main` (§FC1.2).

## Gates

| gate | result |
|---|---|
| `render_audience_homepages.py --check` | byte-identical, all 7 pages |
| `render_audience_homepages.py --self-test` | pass |
| `build_mbm_search_index.py` | reproduces (8 changed leaf paths declared via `--expect-diff`, never hand-edited) |
| `verify_audience_copy.mjs` | pass |
| `verify_catalogue_counts.mjs` | 6/6 |
| `verify_takes_pin.mjs` | 17/17, and **proved red** on a deliberate mutation at FC0.7 |
| `verify_pupil_genres.mjs` | 34/34, and **proved red** (33/1) when a pupil game card is removed |
| `check_audience_accents.py` · `census_typed_literals.py` · `verify_games_audience_faces.py` | pass |
| `check_workflow_paths.py` | every referenced path exists |
| **`s21-claims-guard`** (new) | 9/9, **proved red** on a planted absolute, naming the phrase |
| **`s22-guard-clause-present`** (new) | 17/17, **proved red** on a clause deleted from the record |
| `verify_curation_vocabulary.mjs` | fails identically at `main` — missing `playwright` locally, pre-existing, not a required context |

Pupil fence: 0 off-origin `src`/`href`/`action`, 0 off-origin `<script src>`, 0 `fetch(`,
0 `XMLHttpRequest` — so the pupil search filters already-rendered cards and fetches nothing,
and both halves are asserted together rather than "0 fetches" read alone. Genre names render
as `<span>`, 0 buttons: tags stay non-interactive on the pupil surface, as Order S settled.

Banned claims: **0** hits across all seven served pages. American spellings among the 47
changed strings: **0**. New CSS class tokens: **0** (107 before, 107 after).

## Definition of done — 6 of 6 adoptions, 2 of 3 gates

| # | adoption | state |
|--:|---|---|
| 1 | pupils identity split / bridge block | **closed on arrival** — already existed |
| 2 | second-person voice on pupil copy | **done** — 6 descriptions + the renderer's empty state |
| 3 | internal vocabulary cut, estate-wide | **done** — 31 record strings + 1 renderer string |
| 4 | CTA labels name their destination | **closed on arrival** — TS §1.7 |
| 5 | parents FAQ restructured truthfully | **done** — 4 questions added, 3 kept verbatim, accounts answer corrected |
| 6 | sector vocabulary, recognition-only | **done, with one named omission** — AP/EOTAS/attendance on schools, PEP/Virtual School on councils; `Section 19` withheld with reason |

Gates: `s21` **built and proved red**, `s22` **built and proved red**, `s23` **ledgered PROPOSED**.
That is **2 of 3**, named rather than rounded up.

## A contradiction, noted and not acted on (§FC0.9)

C4 is closed by your declaration and this run did not investigate it, gate on it, or scope
around it. For the record: the **Lessons** repo still carries records written last session that
describe C4 as an open safeguarding item awaiting your word — `REGISTER.md` R-SATF01, the LT1
contact sheet, and `LIVETEACH_RESIDUE.md`. Those are now contradicted by your ruling. They are
in a different repository and outside this order's six adoptions, so they were left alone.
Correcting them is a one-line job whenever you want it.

The wider lesson is recorded where it belongs: **a relayed finding is a hypothesis.** That
alarm travelled two hops as fact. Every close record read during FC0.5 was treated as a
hypothesis on the same terms, and five of the twelve premises died on measurement.

---

# APPENDIX — FURTHER IMPROVEMENTS (queued, NOT in this order's scope)

Reproduced verbatim from order FC so the next order inherits it instead of rediscovering it.
**Nothing here was started in this run.**

These are real, named, and deliberately outside §FC1–§FC7. **Do not start any of them in this run.** Reproduce this appendix verbatim into the close record so the next order inherits it instead of rediscovering it.

## A. Unblocks more than it costs

**A1 — The tag backfill.** `data/tag-backfill.csv`, 641 rows, four fields pre-filled and four tag fields deliberately empty (never seeded with the discarded derivation — the spot-check was 12/20 against an 18 threshold, so the whole derivation was binned). Parked at S5 with the ruling: **tag the ~30 resources Matt teaches from in the first fortnight, then decide.** This is the single highest-leverage queued item — it is the blocker under A2 *and* under the faceted filter's multi-select.

**A2 — Pupil card badges** (device · controls · quick-play · silent-friendly). The audit pack proposed them; Order S already settled the *design* — non-interactive on pupil surfaces, interactive and ≥44px on teacher surfaces, one component, two call sites. **Blocked on A1**: the record carries `subject, type, family, year` and nothing that yields a device or control tag. Do not derive these; that path was already measured and discarded.

**A3 — `data/declared-fiction.json`** as a standalone deliverable if §FC6.7 ledgers rather than builds it. Cheap, useful beyond the gate, and it converts "everything is invented" from a claim into a checkable record.

## B. Content accuracy still open

**B1 — The two public ASDAN PDFs.** Each carries one stale "BUILD — an Award" sentence, mirroring what PH-3's C1 fixed in `asdan/app.html`. PH-3 C5 stopped correctly: **no PDF generator exists in the site repo.** This is a regeneration-day item, not a patch — it needs the generator question answered first.

**B2 — The LAUNCH Vocational Hospitality clock.** Verified 2026-08-18: ASDAN is withdrawing **all** Vocational Taster titles — registrations and books to **31 Dec 2026**, final certification **31 Aug 2027**. LAUNCH Vocational's six lessons bank "ASDAN Hospitality / Gardening"; **Hospitality is a Vocational Taster and is on that clock, Gardening is an ordinary Short Course and is not.** This is a curriculum decision for Matt and Cheryl, not a code change. It has the nearest real deadline of anything on this list.

**B3 — The 10-hour rule workbook fix.** `Planning/LAUNCH/LAUNCH_Autumn_Year_Plan_ASDAN.xlsx` repeatedly asserts a 10-hour rule on ComSk1 ("THE 10-HOUR RULE IS THE DESIGN CONSTRAINT"). It is false — the gate is on the other five skills. Proposed cell fixes sit in `_passph3/JOB_A_REPORT.md`, values-only, listed cells only. **Verify whether they were applied; do not assume either way.**

## C. Site structure

**C1 — The `/for/` cross-link graph is asymmetric.** Each audience page offers a "switch to…" link, but the graph is not closed: several audiences are linked *from* nowhere. Audit all seven, build the full matrix, and close the loop — a reader who lands on the wrong page should be one link from the right one, in every direction. Cheap, and it compounds with the findability work.

**C2 — The teachers-page video claim.** The page describes an owner-controlled demonstration. Verify whether it is a genuine click-to-load facade or an embedded player that loads on page view — the claim is only true in the first case. **Verify before rewording; do not reword into a stronger claim.**

**C3 — The trusts page.** FC only reconciles it (`TRUSTS=reconcile-only`) because the audit pack supplied no markup for it. It is consequently the least-worked of the seven and probably the weakest. Worth its own small pass once FC lands.

**C4 — PH-3 PRs #133 (Lessons) / #168 (site).** Order TS set `PH3_MERGE=yes`, so these are *probably* merged. **Verify, do not assume** — and if merged, confirm the guidance-hidden-by-default toggle behaves on a real deck at 390px.

## D. Human-only, cannot be automated

**D1** — UAS centre name and number (`#set-centre`, `#set-cno`): on-device storage, values only Matt holds.
**D2** — The eyeball tap-list from the TSR close.
**D3** — Deferred Lessons and Apps rulesets: SAT-F §2 gated them. Re-run `report_required_checks.py` and create them when the deferral reason has genuinely expired.

## Added by this run

**E1 — the `.mf-section-head` lead tag.** All 35 section heads put the lead in a `<span>` where a block-level `<p>` belongs (§FC5.3). Not fixable inside FC: the CSS couples `>p` to the kicker and `>span` to the lead, so swapping the tag is a visible regression, and fixing it properly needs a selector that §FC5.4's zero-new-CSS-classes rule forbids. A small job for a pass allowed to touch CSS.

**E2 — `Section 19` on `/for/councils-organisations/`.** Blocked by red line 7 and `verify_catalogue_counts.mjs`. Needs a declared statutory-citation exemption in that gate, which is Matt's to authorise. See the omissions table.

**E3 — the Lessons-repo C4 records.** `REGISTER.md` R-SATF01, the LT1 contact sheet and `LIVETEACH_RESIDUE.md` still describe C4 as open. Matt's declaration closes it. One-line correction in the other repository, whenever wanted.
