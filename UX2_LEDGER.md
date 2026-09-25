# UX2 ledger — Site (the education surface)

Order UX2 (2026-09-08), Part B. Every link, section, control and menu item the
order touched on the served education site ends here as **SURVIVES**,
**RELOCATES** (named destination) or **RETIRED** (reason). Nothing is silently
dropped. "Served" means the education publication that
`domain-split/build_publications.py` + `domain-split/build_education.py` emit;
the source-tree pages that the build discards or overlays are named where that
matters. Auto-decisions are logged at the end of each part.

## Part B1 — the menu (`domain-split/shared_navigation.py`, `shared-navigation.css/.js`)

Before (measured on the baseline build, 390×844, menu open — `reports`
census `B_census_before.json`): a header with mark + wordmark + tagline, a
desktop-only quick row, and a "Menu" disclosure holding three groups
(Learning · Starting points · More from Matt) with deep links.

| item (before) | verdict |
|---|---|
| Header brand: mark + wordmark "MADE BY MATT" → `/` | SURVIVES |
| Header tagline `<small>Learn • Build • Explore</small>` | RELOCATES → the footer's line, once per page ("Learn • Build • Explore" is footer-only) |
| Desktop quick row (Lessons · Resources · Apps & tools · Teacher tools, ≥1000px only) | RETIRED — a duplicate of the Learning group; the same four destinations are menu rows on every width |
| Menu summary "Menu" | SURVIVES — the panel now also carries the title "Menu" and a 44px close control |
| Learning: Lessons `/Lessons/` · Resources `/resources/` · Apps & tools `/Matt-s-Apps-/` · Primary lessons `/Lessons/primary/` | SURVIVES (group "Learning", this order) |
| Learning: Teacher tools `/tools/` | RETIRED from the menu — `/tools/` lists nine apps that are on the Apps hub (`apps.json`) plus the UAS/ASDAN registers, Arts Award and moderation tools that are not; the page is kept and stays reachable from the teacher page (B3 Assess card) — see the report for the measurement |
| Learning: Saved lessons `/Lessons/?view=saved` · Recommended versions `/Lessons/?view=recommended` | RELOCATES → the Lessons hub bar controls `#view-saved` / `#view-recommended` (already present in Lessons main after Part A — no Lessons change needed) |
| Learning (adult): Cover teaching packs `/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html` | RELOCATES → a Resources unit card (B4) |
| Learning (adult): PDF Studio `/Matt-s-Apps-/PDF_Studio.html` | RETIRED from the menu — it is on the Apps hub (`apps.json` Documents · `PDF_Studio.html`) and featured at the top of `/Matt-s-Apps-/`; Apps & tools is a menu row |
| Learning (adult): ASDAN learning resources `/Lessons/?subject=ASDAN%20%26%20life%20skills&year=all` | RELOCATES → the Lifeskills subject page `/Lessons/subject.html?subject=lifeskills` (a Lessons hub card, and a homepage tile from B2); the old query URL still resolves on the hub |
| Learning (adult): Teaching hub `/teach/` | RELOCATES → out of the menu; the page's visible title is now "Teacher workspace" and it is linked from the teacher page's Assess card and account area (B3) |
| Learning (adult): Education Hub `/education-hub/` | STOP (kept as is, out of the menu; linked from the teacher page's account area in B3) — see the report's HUBS ruling |
| Starting points: Homepage `/` | RETIRED from the menu — the brand mark + wordmark link home on every page |
| Starting points: Teachers · Pupils · Parents & carers · Schools & specialist settings · Academy trusts · Local authorities · Education partners · Governors & trustees | SURVIVES as "Who are you here for?" — labels and routes now read from `data/audience-homepages.json` in record order (Pupils & learners · Teachers & education staff · Parents & carers · Schools & specialist settings · Academy trusts & education groups · Local authorities & education partners · Education organisations & service providers) + Governors & trustees from the build's own audience constant (`education_expansion.AUDIENCES`; the record does not hold it) |
| More from Matt (adult): Account `/account/` | SURVIVES as "Account and members" (group "Your account") |
| More from Matt (adult): Members `/members/` | RELOCATES → linked from `/account/` and from the teacher page's account area (B3) |
| More from Matt (adult): Teacher updates `/mailing-list/` | SURVIVES ("Your account") |
| More from Matt: Shared activity `/stats/` | RELOCATES → `/privacy/` links it; the teacher page's account area links it (B3) |
| More from Matt: Privacy & statistics choices `/privacy/` | SURVIVES as "Privacy and statistics" |
| More from Matt: Made by Matt Play ↗ | SURVIVES — last row of the panel, a plain link (`rel="noopener"`); never loaded |
| Display options (theme slot on Lessons/Apps/Science/Humanities hubs) | SURVIVES — between "Your account" and the Play link |
| Pupil subset (`/for/pupils/`): Learning[:2] + Homepage + current page + Shared activity + Privacy + Play | SURVIVES as the pupil subset of the same component: Lessons · Resources · Primary lessons / Pupils & learners / Privacy and statistics / Made by Matt Play ↗ |
| Shared (non-adult) surfaces (`/resources/`, `/Lessons/primary/`, `/stats/`…): no account rows | SURVIVES — "Your account" holds only "Privacy and statistics" there |
| Professional audience pages (`/for/schools-semh/`, `/for/trusts/`, `/for/councils-organisations/`, `/for/partners/`): hero buttons "Map the platform" → `#platform-map` · "Open the Education Hub" → `/education-hub/` (the record's `primaryCtas`) | SURVIVES — the build's rebuilt `<main>` had dropped them and the old menu's "Education Hub" row masked the loss on every adult page; the rebuilt heading now renders the record's own `primaryCtas` (label, href, style) so the destination stays on the page (`check_audience_discovery.cjs` "Original audience destination lost" is green again on the rebuilt tree) |
| Header search control (new) | NEW — 44px icon link to the page's own search field (`#home-resource-query`, `#teachers-q`, `#pupils-q`, `#rxSearch`, `#search`, `#tq`, `#teach-search`, `#hub-search`, `#gv-search`), or `/resources/#rxSearch` where a page has none; asserted per route |

### Part B1 auto-decisions
- AUTO-DECISION B1-1: audience rows use the record's `label` (not `navLabel`), in record order; the governors row is appended from `education_expansion.AUDIENCES` because `/for/governors-trustees/` exists only in the build. The record does not carry it; said so in the report.
- AUTO-DECISION B1-2: `/resources/`, `/Lessons/primary/` and the other non-adult surfaces keep the existing audience boundary (no `/account/`, `/members/`, `/mailing-list/` links): their "Your account" group is the shared subset (Privacy and statistics only). The pupil subset (three groups reduced to Lessons · Resources · Primary lessons / Pupils / Privacy and statistics) renders on `/for/pupils/` only, as before.
- AUTO-DECISION B1-3: the group headings are no longer uppercased by CSS so the rendered text equals Appendix A ("Learning", "Who are you here for?", "Your account").
- AUTO-DECISION B1-5: `/teach/`'s old h1 ("Your offline-first toolkit and resource library.") becomes its lead line under the new title rather than being deleted.
- AUTO-DECISION B1-6: the professional audience pages' hero buttons render from the record's `primaryCtas` in the build (`audience_discovery.make_main`), the same way the parents page already renders its pair, because the Appendix A menu no longer masks the rebuilt main's missing "Open the Education Hub" button. Nothing is typed: labels, hrefs and styles come from `data/audience-homepages.json`.
- AUTO-DECISION B1-4: the desktop quick row is retired with the tagline; the header is mark · wordmark · search · menu at every width.

## Part B2 — the homepage and `/commission/` (`domain-split/preview-template.html` §view-home + §view-commission, `build_publications.py`, `education_discovery.py`, `education_expansion.py`, `usage_discovery.py`, `added-this-half-term.js`, `sitemap.xml`)

Before (measured on the B1 build, 390×844 — `reports` census `B_census_b1.json`): the education homepage was the template's hero + "Ready to teach?" strip + two route cards + four subject cards + "Made by a teacher" paragraph + the £5–£50 commissioning block + support band + footer, with the build adding a learning-areas bar, an explore nav, six audience cards, a consent panel and a "Shared activity" link. After: Appendix A §HOME, section for section.

| item (before) | verdict |
|---|---|
| Header: mark · wordmark · 44px search control · Menu (B1) | SURVIVES |
| Hero h1 "Find your next lesson." | SURVIVES |
| Hero eyebrow "Made by Matt · Learning" | RELOCATES → the footer's "Made by Matt · Learning" line (§HOME footer) |
| Hero brand line "Learn • Build • Explore" | RELOCATES → the footer's `<small>` line, once per page |
| Hero lead "Lessons, teaching tools and practical resources. Choose a starting point, then find the subject and pathway you need." | RETIRED — replaced by the §HOME line "Lessons, planning packs and classroom tools, made by a teacher." |
| CTAs "I’m teaching" / "I’m learning" → `/for/teachers/` / `/for/pupils/` | SURVIVES as "I'm teaching →" (navy) / "I'm learning →" (green), 52px, full width |
| Hero art `<img alt="Made by Matt Lesson Hub artwork">` + caption "From the Made by Matt Lesson Hub" | SURVIVES as decorative artwork (`alt=""`); the caption is RETIRED (its "Lesson Hub" is a vocabulary defect and §HOME lists no caption); naturalWidth 450 measured |
| Search `form.education-home-search` (`#home-resource-query`, GET `/resources/?q=`) label "Find lessons and resources", placeholder "Try Science, Humanities or PDF Studio" | SURVIVES as the one search field, label "Search lessons, packs and tools" (§HOME); placeholder retired (not in §HOME) |
| "Ready to teach?" strip: Saved lessons `/Lessons/?view=saved` · Recommended versions `/Lessons/?view=recommended` · Cover teaching packs `/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/index.html` · Classroom tools `/tools/` · ASDAN · all years `/Lessons/?subject=ASDAN%20%26%20life%20skills&year=all` (build-added) | RETIRED as a strip; each href RELOCATES: Saved/Recommended → the Lessons hub bar controls (`/` → Lessons → `#view-saved`/`#view-recommended`, 2 taps) · Cover packs → `/resources/` (1 tap) → its card (2 taps; a unit card after B4) · `/tools/` → `/for/teachers/` (1 tap) → its link (2) · ASDAN → the Lifeskills tile (1 tap) |
| Route cards "Start with the teaching." / "Get into your learning." | RETIRED — the hero CTAs are the same two destinations |
| "Go straight to your subject": Science → `/Lessons/Science_Teesside/index.html` · Humanities → `/Lessons/Humanities_Teesside/index.html` · Art → `/Lessons/?subject=Art` · ASDAN → `/Lessons/?subject=ASDAN%20%26%20life%20skills` | SURVIVES as the §HOME 2×2 tiles → `/Lessons/subject.html?subject=science|humanities-re|art-studio|lifeskills` + one tile per extra Part A slug derived from the served catalogue (the Lessons hub's own `cardOf` rule, ported; asserted equal to the hub's cards in a browser). The old Science/Humanities shelf hrefs stay reachable: `/` → Lessons (1) → the shelf rows on the hub / subject pages (2) |
| Section "Made by a teacher, for real classrooms." + "Made by Matt combines interactive tools, lessons and simulations to drive inclusive education, turning focus and decision-making into the core experience." | SURVIVES as the maker panel heading; the "turning focus and decision-making" paragraph is RETIRED (§HOME gives the line "Built by an alternative-provision teacher on Teesside and used every week.") |
| £5–£50 block `#custom-resources` (eyebrow, "Need a lesson or resource?", four `From £n` cards, quiet note, mailto "Ask Matt about a resource") | RELOCATES VERBATIM → `/commission/` (title "Commission a resource"; `preview-template.html` §view-commission; in `sitemap.xml`; adult surface); linked from the maker panel "Commission a resource" and the teacher page (B3) |
| Support band: Log in / Account `/account/` · Visit the members’ area `/members/` · Join teacher updates `/mailing-list/` | RETIRED as a band: `/account/` is the menu row "Account and members" (2 taps) · `/members/` → `/for/teachers/` (1 tap) → its account link (2) · `/mailing-list/` is the maker panel's "Teacher updates" (1 tap) |
| Footer: Teachers · Pupils · Account · Members · Teacher updates (+ build-added Privacy) | SURVIVES as the §HOME footer "Lessons · Resources · Apps · Privacy · Made by Matt Play ↗" then "Made by Matt · Learning"; Teachers/Pupils/Account/Members/Teacher updates are menu rows or the maker panel |
| Build-added learning-areas bar (Lessons · Resources · Apps & tools · Teacher tools → `/tools/`) on `/` | RETIRED from `/` — a duplicate of "Three places, one site" and the menu's Learning group (`education_discovery.py` no longer adds it to the homepage; the three catalogue hubs keep it) |
| Build-added explore nav (Primary → `/Lessons/primary/` · Families & organisations → `/#audiences` · Made by Matt Play) on `/` | RETIRED from `/` — Primary lessons is a menu row, `#audiences` is the "Here for someone else?" section, Play is the menu's last row and the footer's last link (`education_expansion.py`) |
| Build-added six audience cards "Find your starting point." | RETIRED — "Here for someone else?" renders one row per audience route except teachers and pupils, label and order from `data/audience-homepages.json` (+ Governors from the build's constant) |
| Build-added `<p class="mbm-usage"><a href="/stats/">Shared activity · Top 10 lessons and packs</a></p>` on `/` and `/main/` | RELOCATES → `/privacy/` (the footer's Privacy link, 1 tap → the same link, 2 taps); the teacher page's account area links it too (B3) |
| Build-added consent panel (`<details>` "Optional usage statistics", "Allow optional statistics" / "Keep statistics off", static "not active yet" sentence) on `/` and `/main/` | SURVIVES as the §HOME consent bar: two lines, the privacy link `/privacy/#shared-usage`, "Allow" / "Keep off"; the same storage key `mbm_usage_choice_v1`, events and handlers (`usage_discovery.consent_bar()`); the status line is empty in the page and painted only by `usage-client.js stateText()` — the "not active" sentence renders only when the served config reports the service inactive. Every other hub keeps the `<details>` panel |
| `/main/` | SURVIVES — renders the same page as `/` |
| NEW "Three places, one site" → `/Lessons/`, `/resources/`, `/Matt-s-Apps-/` | NEW (§HOME) |
| NEW "Added this half-term" rail | NEW (§HOME) — the same component as the Lessons hub rail, copied with its source recorded (`added-this-half-term.js` header: Lessons `index.html` renderHub() lines 75–81 + `assets/catalogue/hub.js` halfTermWindow/sixtyDaysAgo/fmtDay/formatOf/badge); reads the served catalogue `/Lessons/resources.json` `added` + `/Lessons/data/calendar-spine.json`; hidden until rows exist; asserted equal to the hub rail in a browser |
| NEW `/commission/` | NEW — in `check_publications.py`'s tested pages, `shared_navigation.SITE_PAGES`, `education_support.SITE_ADULT` (money stays on an adult page) and `sitemap.xml` |

### Part B2 auto-decisions
- AUTO-DECISION B2-1: the homepage search stays the existing `<form>` control (GET `q` to `/resources/`, no `/search` route, nothing loaded until the page renders it) because B2 names "the existing search control as one field"; the estate ruling "search is not a `<form>`" is read as forbidding a new search route or a new form, not as a rewrite of this pre-order control. The sibling gate (`check_shared_navigation.cjs`) still drives its submit to `/resources/?q=`.
- AUTO-DECISION B2-2: "Added this half-term" reads the served Lessons catalogue (`/Lessons/resources.json`) rather than `data/source-manifests/lessons-resources.json`, because the mirror is `education_policy.SOURCE_ONLY` (never published) and the served catalogue is the mirror's published form (the same Lessons `resources.json` minus game rows). The mirror itself is refreshed in B4/B5 with counts.
- AUTO-DECISION B2-3: the "fifth tile" rule renders one tile per extra Part A slug (`x-…`), named by the first row's subject, A–Z — the hub's own `cardsFromRows` rule — so the homepage shows the hub's cards exactly (thirteen with the post-D catalogue), asserted in a browser rather than assumed.
- AUTO-DECISION B2-4: `/commission/` is an adult surface (`SITE_ADULT`), so the build's Ko-fi support aside renders there as on every adult page; the moved block itself is byte-for-byte the template's `#custom-resources` section.
- AUTO-DECISION B2-5: the hero artwork keeps its `<img>` (naturalWidth 450 measured) with `alt=""` and no caption; the old alt/caption named the "Lesson Hub" (a vocabulary defect) and §HOME lists no caption.
- AUTO-DECISION B2-6: the retired "Shared activity · Top 10 lessons and packs" link is re-homed on `/privacy/` (one tap from every footer) rather than kept on `/`, because §HOME lists the homepage exactly and does not include it.
- AUTO-DECISION B2-7: the B5 gates for this surface live in `domain-split/check_ux2_education.cjs` (two-tap BFS, money/third-party, consent driven both ways, Appendix A copy and vocabulary, hrefs, hero, tiles = hub cards, rail = hub rail, sitemap) with `--red-proof` planting five mutations that must each go red; the 44px sweep extends the sibling `check_shared_navigation.cjs`; the s16 plant proof is `check_ux2_home.py --self-test`. All three are additive steps in `domain-split-verify.yml`.

## Part B3 — the teacher and pupil pages (`domain-split/preview-template.html` §view-teachers + §view-pupils, `build_publications.py`, `education_discovery.py`, `education_expansion.py`)

Before (measured on the B2 build — `reports` census `B_census_b2.json`): the education publication's `/for/teachers/` and `/for/pupils/` were the template views plus a build-added explore nav, a learning-areas bar (teachers), footer additions and the consent panel. The five other audience pages and `/for/governors-trustees/` are chrome-only in this part: their `<main>` is byte-identical between the B2 and B3 builds (`$S/b/audience_body_diff.sh` — six IDENTICAL).

| item (before) | verdict |
|---|---|
| Teachers h1 "What are you teaching today?" | SURVIVES |
| Teachers eyebrow "For teachers & education staff" · CTAs "Find teaching resources" → `#teacher-search` / "Choose a pathway" → `#science-pathways` | SURVIVES; the second CTA now reads "Choose a subject and pathway" and jumps to that section |
| Teachers brand line "Learn • Build • Explore" | RELOCATES → the footer's `<small>` line, once per page |
| Teachers lead "Built for the classroom. Made to be explored. Find your next lesson, plan a sequence and bring learning to life." | RETIRED — §TEACHERS gives "Find a lesson, plan a sequence, capture the evidence." |
| Teachers hero art `alt="Made by Matt Lesson Hub artwork"` + caption "Lessons, practical resources and ideas for your classroom." | SURVIVES (decorative `alt=""`; the old alt named the "Lesson Hub"); caption kept |
| Teach card "Find a lesson" / "Search subjects, topics and teaching sequences." / "Browse lessons" → `/Lessons/` | SURVIVES as §TEACHERS Teach "Find a lesson" / "Browse lessons →" → `/Lessons/` (the description is not in §TEACHERS and is retired) |
| Plan card "Build your sequence" / "Find pathway material, schemes and teaching packs." / "Find planning material" → `/for/teachers/?q=plan` | RELOCATES → §TEACHERS Plan "Schemes of work and packs" / "Open planning →" → `/resources/`; the card says why there is no type filter (kind scored 17/20 — `reports/B4_kind_sample_postD.json`) |
| Assess & record card "Capture the learning" / "Find evidence, assessment and feedback tools." / "Find evidence tools" → `/for/teachers/?q=evidence` | RELOCATES → §TEACHERS "Assess and record" "Evidence packs and trackers" / "Open evidence →" → `/resources/` + the same kind note; the card also carries "Teacher workspace" → `/teach/` and "Tools Hub" → `/tools/` (B1 HUBS ruling) |
| "Science: choose your pathway" (BUILD/GROW/LAUNCH Science → `/Lessons/Science_Teesside/index.html?pathway=…`) + chips Humanities & RE → `/Lessons/Humanities_Teesside/index.html` · Art lessons → `/Lessons/?subject=Art` · ASDAN resources → `?q=ASDAN` | RELOCATES → "Choose a subject and pathway": four subject cards (Science · Humanities & RE · Art Studio · Lifeskills) with pathway chips → `/Lessons/subject.html?subject=<slug>&pathway=<P>` for the pathways present in the served catalogue (the hub's `tierOf` rule ported; asserted equal to the hub's card chips) and "Browse <Subject> →" → the subject page |
| "Search your teaching resources" workspace (`#teachers-q`, pathway select, results) | SURVIVES (the page's search; the header search control targets it) |
| "Make something for your classroom": "Creative tools · Find a studio" → `?q=studio` · "Pathway resources · Explore ASDAN" → `?q=asdan` | RELOCATES → "Apps & tools" / "Studios, timers and classroom tools." / "Open Apps & tools →" → `/Matt-s-Apps-/` and "Lifeskills" / "Practical units with evidence built in." / "Browse Lifeskills →" → the Lifeskills subject page (the images kept) |
| Support band: Log in / Account · Visit the members’ area · Join teacher updates | SURVIVES as the account area "Your account": Account and members `/account/` · Members’ area `/members/` · Teacher updates `/mailing-list/` · Shared activity `/stats/` · Teacher workspace `/teach/` · Education Hub `/education-hub/` · Commission a resource `/commission/` (the B1/B2 relocation destinations) |
| Teacher safety line | NEW on the built page — the record's `teachers.noteTitle` ("Capability without unsupported claims") + `note`, rendered verbatim from `data/audience-homepages.json` at build (R4; the source-tree page already carried it) |
| Build-added learning-areas bar on `/for/teachers/` (Lessons · Resources · Apps & tools · Teacher tools → `/tools/`) | RETIRED — menu rows; `/tools/` is on the Assess card |
| Build-added explore nav (Primary · Families & organisations · Made by Matt Play) on both pages, and the footer additions | RETIRED — Primary lessons and Play are menu rows (the pupil subset keeps both), Play is the footer's last link, `/#audiences` is the homepage section |
| Teachers footer: Learning home · Account · Members · Teacher updates (+ Privacy) | SURVIVES as the shared footer "Lessons · Resources · Apps · Privacy · Made by Matt Play ↗" then "Made by Matt · Learning"; Account/Members/Teacher updates are the account area rows |
| Ko-fi support aside on `/for/teachers/` (adult) | SURVIVES ("Ko-fi stays") |
| Pupils h1 "What are you learning today?" + line "Choose your subject. Your teacher will help you find your pathway and lesson." | SURVIVES |
| Pupils CTAs "Choose a subject" → `#pupil-subjects` / "Find my activity" → `#pupil-search` | SURVIVES, labelled by the sections they open: "Choose your subject" / "Find your activity" |
| Pupils tiles Science → `?q=science` · Humanities → `?q=humanities` · Art → `?q=art` · ASDAN → `?q=ASDAN` | RELOCATES → the four subject pages (`/Lessons/subject.html?subject=science|humanities-re|art-studio|lifeskills`), named Science · Humanities & RE · Art Studio · Lifeskills; their lines kept |
| "Know your science pathway?" (BUILD/GROW/LAUNCH Science → the Science shelf) | RETIRED — the subject page's pathway control and the teacher page's chips (`menu-relocations.json`) |
| "Find your activity" search (`#pupils-q`, pathway select, results) | SURVIVES (the existing control) |
| Pupils footer "Made by Matt · Learning" · Learning home (+ Privacy, Families & organisations, Primary, Play) | SURVIVES as the shared footer's pupil form "Lessons · Resources · Privacy · Made by Matt Play ↗" then "Made by Matt · Learning" (Apps & tools is not in the pupil menu subset, so not in the pupil footer) |
| Consent panel on both pages | SURVIVES unchanged |

### Part B3 auto-decisions
- AUTO-DECISION B3-1: the pages this part rewrites are the education publication's `/for/teachers/` and `/for/pupils/` (template views + build passes), because the items B3 names ("Know your science pathway?", "Find your activity", the Plan/Assess cards) exist only there; the source-tree pages that `tools/render_audience_homepages.py` generates are the pre-publication tree the build discards, and their body copy (all seven) is untouched (`--check` green). The record is still the source for what B3 reads at build: the teacher safety line and the audience labels.
- AUTO-DECISION B3-2: the kind derivation re-run on the post-D pool scored 17/20 (`reports/B4_kind_sample_postD.json`; the 65 companion packs carry an explicit `kind: "pack"` and count as record-derived), so kind stays discarded: Plan and Assess both open `/resources/` and carry one sentence — "Listed by unit, not by type: a pack’s type could not be derived reliably." — held in `domain-split/ux2/appendix-a-site.json` `derivedNotes.kindDiscarded` and used by `/resources/` (B4) as well.
- AUTO-DECISION B3-3: `/tools/` is linked from the Assess card under the page's own name ("Tools Hub", its `<title>`), not as "Teacher tools", which is the Resources pillar's name for the Apps hub.
- AUTO-DECISION B3-4: the pupil footer omits "Apps" to match the pupil menu subset (Lessons · Resources · Primary lessons); every other footer link is the shared component's.
- AUTO-DECISION B3-5: the four teacher subject cards use the §HOME names and the §LESSONS HUB "Browse … →" labels; their pathway chips are derived per card from the served catalogue with the hub's `tierOf` rule and asserted equal to the hub's chips in a browser.

## Part B4 — `/resources/` (`resources/index.html`, `domain-split/education_discovery.py`, the mirror `data/source-manifests/lessons-resources.json`, `data/mbm-search-index.json`)

Pre-gate: `/resources/` was AUTHORED (one generated region, the DATA-STAMP) and read the served Lessons catalogue + `data/resources.json` + a build-time `resource-collections.json` (Apps items, old search-index entries, three ASDAN hub links) at runtime. It is now data-driven from the Lessons mirror's published form (`/Lessons/resources.json`) and the site's own record (`/data/resources.json`) — nothing else; the build's `resource-collections.json` is still written (other passes read it) but no longer feeds the page. Kind: 17/20 on the post-D pool → no Type filter (`reports/B4_kind_sample_postD.json`).

Before (B3 build, 390×844 — `B_census_b3.json`): 930 anchors (790 resource cards incl. every lesson, chips, breadcrumb, jumps, collections), 4 targets under 44px. After (`B_census_b4.json`): 249 anchors, 251 controls, 0 under 44px in both states, LBE 1, money 0, no off-origin requests.

| item (before) | verdict |
|---|---|
| Title "Resource Catalogue — Made by Matt", h1 "Everything for your next lesson.", eyebrow "Resource catalogue", lead "Search teaching resources and tools here…" | RETIRED — §RESOURCES: h1 "Resources", strapline "Planning packs and evidence, one card per unit." |
| Breadcrumb Learning home → `/` · Lessons → `/Lessons/` · Teacher tools → `/tools/` | RETIRED — the brand links home; Lessons is "Looking for lessons? Go to Lessons →" and a footer/menu row; `/tools/` is on the teacher page's Assess card |
| Jumps: Open the lesson finder `/Lessons/` · Saved lessons `/Lessons/?view=saved` · Teacher tools `/tools/` · Browse collections `#resource-collections` · PDF Studio (build-added) | RETIRED — `/Lessons/` as above; Saved lessons → the hub bar control (`/` → Lessons → `#view-saved`); PDF Studio → the Apps hub (Teacher tools pillar; featured there) |
| Search `#rxSearch` (bare input, placeholder "Search science, humanities, evidence…" / build "Try ASDAN, worksheet, PDF generator…") | SURVIVES as the one search, label and placeholder "Search packs, schemes of work, evidence books"; still a bare input (no `<form>`, no `/search`); searches packs, documents, lessons and apps (lessons and apps stay in the global search) |
| Subject chips (29) `#rxSubs` · Type chips (10) `#rxTypes` · sort `#rxSort` · copy link `#rxCopy` | RELOCATES → two `<select>` pills Subject / Pathway (options derived: the subject cards and pathways present; `replaceState ?subject=&pathway=`); the Type pill is dropped (kind < 18/20 — the pillars say so); sort is fixed ("This half-term first", then chronological); copy link retired (the URL is the state) |
| "Start here" + 28 per-subject sections of `article.rx-cardx` cards: 574 lesson rows + 2 revision + 218 non-lesson items, `a.rx-go` on each | RELOCATES — lesson rows → the Lessons hub's subject pages (`/` → tile → row; rows of a non-default pathway are one pathway-segment tap further and are measured as such — see the report's STOP); the non-lesson rows → this page: 9 unit cards (the 65 companion packs keyed by subject · pathway · half-term) and 186 document rows ("<Subject> documents" ×4 grouped by family, "Whole-school documents" for rows outside the four subjects, incl. the 7 site-record rows) |
| Build-added collections `#resource-collections`: ASDAN BUILD/GROW/LAUNCH hubs · "Find ASDAN resources · all years" `/Lessons/?subject=ASDAN…&year=all` · ASDAN Register `/asdan/` · Humanities & RE teaching packs (cover pack) · Science resources & packs `/Lessons/Science_Teesside/index.html` · Find worksheets `/resources/?q=worksheet` · Browse support packs `/resources/?type=Support` · Browse lessons from all years `/Lessons/?year=all` · Browse and search all apps · PDF Studio · Teacher tools `/tools/` · Games & simulations (Play) | RETIRED as a section — the three ASDAN hubs, the cover pack and the Science shelf are catalogue rows rendered as documents; all years → the Lifeskills subject page; `/asdan/` and `/uas/` are site-record rows ("Whole-school documents" · Teacher tool); `?q=worksheet` / `?type=Support` → the search field (a `?q=` still works; `?type=` is read and ignored); `/Lessons/?year=all` → the hub; apps → the Teacher tools pillar; PDF Studio → the Apps hub; `/tools/` → the teacher page; Play → footer/menu |
| Learning-areas bar (build-added) on `/resources/` | SURVIVES (the three catalogue hubs keep it) |
| "Jump to a collection" `#collections` cards: Games → Play · Lesson Hub → `/Lessons/` · Studio Suite → `/Matt-s-Apps-/` · Teacher tools → `/tools/` | RETIRED — Play (footer/menu), Lessons ("Go to Lessons →"), Apps (pillar), `/tools/` (teacher page); the names "Lesson Hub"/"Studio Suite" were vocabulary defects |
| "From Matt" band with mailto ×2 | RETIRED — money/contact copy leaves the shared surface (0 mailto after; `/commission/` and the teacher page hold contact) |
| Footer (brand + tagline + mailto) | SURVIVES as the shared footer "Lessons · Resources · Apps · Privacy · Made by Matt Play ↗" then "Made by Matt · Resources" + one "Learn • Build • Explore" |
| NEW pillars "Schemes of work" · "Evidence and accreditation" (→ `#units`, each carrying the kind note instead of a count) · "Teacher tools ↗" → `/Matt-s-Apps-/` with "<n> apps" = the served Apps manifest length | NEW (§RESOURCES; counts derived or degraded to the note) |
| NEW unit cards: subject band + subject chip + pathway chip · "<Half-term>[ · <Unit>]" · "<n> lessons · <Half-term>" (from the Lessons record; omitted at 0) · ≤3 file chips "<Lesson title> · <FORMAT>" (Open html/pdf, Download pptx/docx) + "+n" (or "Planning and evidence →") opening the sheet · "Delivery lessons →" → `/Lessons/subject.html?subject=&pathway=[&unit=]` when ≥1 lesson | NEW |
| NEW sheet (`<dialog>`): title "<Subject> · <PATHWAY> · <Half-term>[ · <Unit>]" · × (44px) · "Planning" (pack files with role lesson/slides/teacher, grouped "<Lesson title> · lesson pack", drift note where `packRevisionDrift`) · "Evidence" (role pupil, grouped likewise) · "Delivery" (the key's lesson rows, "Open the <n> delivery lessons →", grey line "Opens the Lessons hub at <Subject> · <PATHWAY> · <Half-term>.") · sizes from `resource-sizes.json` | NEW |
| NEW empty state "No packs match." + "Clear filters" (44px) | NEW |
| Mirror `data/source-manifests/lessons-resources.json` (737 rows, Lessons 419d44f0) | REFRESHED K2-style: byte copy of the post-Part-A/D Lessons tree's `resources.json` (848 rows, Lessons 6801ff93): +111 rows (65 companion packs, 32 lessons, 14 hubs), 0 removed, 737 kept of which 379 changed (`halfTerm` on 379, `unit` on 33 — the Part A tags), 358 byte-identical; `provenance.json` commit/entries/date derived |
| `data/mbm-search-index.json` (821 entries: lesson 542, resource 161, game 72, app 24, tool 13, page 9) | REGENERATED: 932 entries (lesson 574, resource 240, game 72, app 24, tool 13, page 9) — 111 added, 0 removed, declared leaf by leaf to `--write` (238 declarations); `--check` compares with the committed blob and is green once committed |

### Part B4 auto-decisions
- AUTO-DECISION B4-1: K2 is undefined in both repositories (B0 STOP-3); the refresh applied is the mirror's own provenance convention — a byte copy of the pinned Lessons tree's `resources.json`, the commit/entries/date in `provenance.json` derived by code, every addition/removal/change enumerated above and in the report.
- AUTO-DECISION B4-2: a companion pack carries a half-term but no unit (0/65 have one; their `companionOf` decks are files, not catalogue rows), so it keys by (subject, pathway, halfTerm) — nine keys, `unit: null` in `reports/B4_planning_keys.json`; "<n> lessons" counts and "Delivery lessons →" use the key's half-term.
- AUTO-DECISION B4-3: with kind discarded, the sheet's Planning/Evidence split uses the record's own `files[].role` (lesson/slides/teacher → Planning; pupil → Evidence) — a record field, not the failed heuristic; an empty section is omitted.
- AUTO-DECISION B4-4: rows without a half-term cannot be unit cards; they render as documents grouped by subject card ("<Subject> documents", the same names as everywhere) and by family (the record field the B0 ruling names), with "Whole-school documents" for rows outside the four subjects. The cover pack is a Humanities & RE hub row and renders there under its own record title (the order's typed label "Cover teaching pack · Autumn 1" would be a typed date).
- AUTO-DECISION B4-5: the "Schemes of work" and "Evidence and accreditation" pillars cannot count by kind, so they carry the kind note and open the unit cards; "Teacher tools" counts the served Apps manifest (38 in the education build, which drops the one game row).
- AUTO-DECISION B4-6: `?q=` results include lessons and Apps manifest items (a LINK to the Apps hub, nothing loaded) so the header/homepage search still finds "PDF Studio" and every lesson; `?type=` is read and ignored (no Type pill) and the page says why.
- AUTO-DECISION B4-7: `/resources/` is a teacher surface for the chips rule (Appendix A §RESOURCES defines direct Open/Download chips) while money stays off it (`education_support` keeps it pupil-reachable; 0 £/Ko-fi/mailto measured).
- AUTO-DECISION B4-8: the retired Type/Subject chips of the old page were the record's `type` field, not `kind`; a `?type=Teacher` deep link now renders the browse view with the note rather than a filtered list.

### Part B4 — additions found while gating (each a pre-order `/resources/` href)
| item (before) | verdict |
|---|---|
| Six primary schemes of work `/Lessons/primary/year{4,5,6}/science/autumn/<unit>/Y<n>_<Unit>_SoW_and_Plans.docx` ("OPEN PACK →" cards on the old `/resources/`, fed by the build's extras record) | RETIRED from `/resources/` — none is a row of the Lessons catalogue (`resources.json`) or of the search index, so the data-driven page cannot list them without inventing records; each file is on disk and linked from its primary unit page, reached through the Primary lessons menu row. Reported as a Lessons catalogue gap, not silently dropped |
| `/resources/?q=worksheet` ("Find worksheets") · `/resources/?type=Support` ("Browse support packs") | RETIRED — self-links into the old page's own search/Type chips; the search field is the control (`?q=` still works) and `?type=` is read and ignored with the kind note saying why |
| `/asdan/index.html` · `/uas/index.html` (old collections/site rows) | RELOCATES → `/asdan/` · `/uas/` — the site-record rows link their canonical routes ("Whole-school documents" · Teacher tool) |
| `https://madebymatt-play.uk/` ("Games & simulations", no `www`) | RELOCATES → `https://www.madebymatt-play.uk/` — every Play link uses the canonical origin (menu last row, footer last link) |
| Retained usage registry digest in `domain-split/check_education_separation.py` (frozen 8 September RX3 P3.4, 926 rows) | RE-FROZEN — the regenerated index gives 32 classic-lesson records a second `source_ids` entry; 926 → 926 rows, 0 added, 0 removed, routes unchanged; proved by diffing `registry_partition()` output between the B3 and B4 builds (`reports/B4_registry_refreeze.json`) |
| Sibling checks that read the OLD Lessons hub (`check_completion.cjs` "BUILD Science" shortcut and `?subject=&pathway=` filtered view; `check_resource_discovery.cjs` readiness waits, the ASDAN "all years" case, the destination walk) | RE-POINTED at the post-Part-A hub and subject pages in the same commit (the hub's subject cards and chips; the Science shelf as a catalogue row; `#count "<n> resources"`; every subject page × pathway segment with every group and "Show n more" expanded; the teacher page as a hub for teacher destinations). Substance kept: the same destinations, the same counts, the same shelf assertions |
- AUTO-DECISION B4-9: lesson rows left `/resources/` for the subject pages, which show one pathway at a time; a lesson of a non-default pathway is three taps from `/` (tile → pathway segment → row). The gate measures that class explicitly (each such href must be rendered on its subject page at its pathway with every group expanded) and reports the count rather than hiding it — see the report's STOP.
- AUTO-DECISION B4-10: the page's app search reads the build's alias record (`/data/resource-collections.json`, apps entries only — e.g. "PDF generator" for PDF Studio) so the header/homepage search still finds apps by their documented aliases; apps are never listed as cards.
| Professional shell on `resources/index.html`: `/assets/mbm-platform.css` + `.js`, `<header class="header mbm-site-header">`, the Menu button, `<nav aria-label="Site navigation">` with `/games/ /Lessons/ /Matt-s-Apps-/ /tools/ /resources/`, the `mbm-nav-more` disclosure with `/main/ / /stats/ /main/#about /privacy/`, and the Display menu | SURVIVES — restored verbatim from main. The B4 rebuild replaced the whole file including this header, which `verify_professional_site.js` reported as 10 findings on `resources/index.html` (shared CSS, shared JS, header class, Menu control, Site navigation landmark, More disclosure, and four missing links). madebymatt.uk serves this header; the education publication swaps it for the B1 unified header at publish time (`shared_navigation.refresh` replaces the first `<header>…</header>`), so both surfaces keep their own chrome from one source file. Verifier after: 0 findings, 11/11 mutation controls PASS |
- AUTO-DECISION B4-12: `/resources/` is pupil-reachable in `data/adult-surfaces.json`, so the restored header carries no `/members/` link — the verifier asserts that account-backed link is ABSENT on a pupil-reachable surface, which is why this page's shell differs from `tools/index.html` by exactly that one row.
- AUTO-DECISION B4-11: the regenerated index gave the 14 new `Teaching_Packs` hub rows (`type: hub`) and the 65 companion-pack rows `safeForPupils: true` by the catalogue-type table, while `check_lesson_discovery.py` (the audience-boundary guard) gives a refreshed route no pupil opt-in the source never declared — and the education build declares the Teaching_Packs directory adult (`education_support.LESSON_ADULT`, the teaching-pack download registrations, the support footer the completion check asserts). `tools/build_mbm_search_index.py` now derives from the route: a `/Teaching_Packs/` record is a teacher surface (`audience: teachers, schools-semh`, `safeForPupils: false`). 79 entries carry it; pupil eligibility is unchanged by the refresh (`check_lesson_discovery.py` PASS, 650 retained pupil routes). Nothing typed: a class rule, not an id list.


### Part T completion — approved brand and restored direct navigation, 13 September 2026

Matt approved the shared palette/header/footer completion and necessary authored-content changes. The published brand now reads **MADE BY MATT** with the approved mark and one **Learn • Build • Explore** footer signoff. The Appendix A brand-label records follow that explicit change; all teaching, safety, audience, menu and body-copy assertions remain intact.

The direct **Saved** action restores `/Lessons/?view=saved` within one tap of the adult homepage. Its previous relocation entry is therefore removed: the unchanged reachability gate must continue rejecting stale relocation claims. The original pre-order href remains in the census.

Preserve existing footer destinations once; add only missing shared links. On `/` and `/main/`, the commission action keeps **Commission a resource**, matching the retained UX2 rule. Other adult footers use **Contact** for that destination. No money, pupil, third-party, consent, copy, href or reachability assertion is removed or weakened.

### Part R — approved Resources composition, 13 September 2026

SURVIVES: every catalogue row, unit key, subject/pathway URL filter, global lesson/app search, direct file, document group, drift flag, theme and modal close/return. The Type filter remains omitted under the recorded kind ruling.

RELOCATES: each companion pack’s Planning/Evidence file fragments are reunited in **Lesson packs**, grouped by explicit companionOf with their real file rows and delivery link. Non-companion Planning/Evidence sections retain their role-derived membership. The old +n control reads +n more. Shared publication chrome is unchanged.

Appearance: shared cream/navy family, quieter search/pillars, rounded filters, restrained subject bands, readable unit cards and sheet; no invented image or count. Part K2 supplies Open pack page links when its real route exists. See docs/sw2-r/README.md for the measured boundary and decisions.

### LAND-A2 Science window W2 — K2-style refresh, 25 September 2026 (ruling R6)

| Surface | This window |
|---|---|
| Mirror `data/source-manifests/lessons-resources.json` (848 rows, Lessons 6801ff93) | REFRESHED K2-style: byte copy of `resources.json` at Lessons c0b9b51f (the squash merge of Lessons #677), 998 rows: +150 (90 lessons, of which 21 are the LAND-A2 Autumn 2 Science lessons; 53 support, 6 teacher, 1 hub), 0 removed, 65 changed (`added` on 65, `desc` on 18, `title` on 17, `builtFrom` on 1); `provenance.json` commit/entries derived by code |
| `data/mbm-search-index.json` (932 entries) | REGENERATED: 1082 entries (lesson 664, resource 300, game 72, app 24, tool 13, page 9): 150 added (90 lessons, 60 resources), 0 removed, 18 resources changed (`action` on 17, `description` on 18, `tasks` on 3, `title` on 17), declared leaf by leaf to `--write` (176 declarations, including the `games.json` source hash the index had not yet absorbed) |
| Retained usage registry (the separation fence) | 1294 -> 1294 rows, 0 joined, 0 removed, order unchanged; 90 rows gain their own search-index entry id in `source_ids` (the 21 landed lessons and 69 lessons the index had not carried); the fence collapses to this one digest (`check_education_separation.py`) |

<details><summary>The 150 rows added to the mirror</summary>

- `sci-tees-b-w18-soil-what-is-in-the-mix` · lesson · BUILD · Soil: what is in the mix?
- `sci-tees-b-w19-soil-let-the-water-through` · lesson · BUILD · Soil: let the water through
- `sci-tees-b-w20-soil-account-for-the-water` · lesson · BUILD · Soil: account for the water
- `sci-tees-l-w17-evolution-build-the-evidence-case` · lesson · LAUNCH · Evolution: build the evidence case
- `sci-tees-l-w18l2-genetic-engineering-change-test-decide` · lesson · LAUNCH · Genetic engineering: change, test, decide
- `sci-tees-l-w18l1-selective-breeding-design-a-resilient-` · lesson · LAUNCH · Selective breeding: design a resilient crop
- `sci-tees-g-w27-the-flower-to-seed-investigation` · lesson · GROW · The flower-to-seed investigation
- `sci-tees-g-w32-change-detectives-what-became-something-` · lesson · GROW · Change detectives: what became something new?
- `sci-tees-g-w26-the-life-cycle-comparison-bureau` · lesson · GROW · The life-cycle comparison bureau
- `sci-tees-g-w28-the-plant-reproduction-strategy-studio` · lesson · GROW · The plant reproduction strategy studio
- `sci-tees-g-w31-the-recovery-methods-workshop` · lesson · GROW · The recovery methods workshop
- `sci-tees-g-w30-reversible-change-detectives` · lesson · GROW · Reversible change detectives
- `sci-tees-g-w29-the-seed-dispersal-design-lab` · lesson · GROW · The seed dispersal design lab
- `sci-tees-g-s2-w6-the-spring-science-evidence-exchange` · lesson · GROW · The spring science evidence exchange
- `sci-tees-g-w18b-circuit-fault-clinic` · lesson · GROW · Circuit fault clinic
- `sci-tees-g-w19-the-spill-mat-design-lab` · lesson · GROW · The spill-mat design lab
- `sci-tees-g-w18a-the-cold-case` · lesson · GROW · The cold case
- `sci-tees-b-s2-w6-the-evidence-museum` · lesson · BUILD · The evidence museum
- `sci-tees-b-w34-the-friction-surface-lab` · lesson · BUILD · The friction surface lab
- `sci-tees-b-w29-the-growth-needs-clinic` · lesson · BUILD · The growth-needs clinic
- `sci-tees-b-w31-the-growth-record-studio` · lesson · BUILD · The growth-record studio
- `sci-tees-b-w27-the-plant-parts-atlas` · lesson · BUILD · The plant-parts atlas
- `sci-tees-b-w28-the-plant-system-service-desk` · lesson · BUILD · The plant-system service desk
- `sci-tees-b-w32-the-water-path-detectives` · lesson · BUILD · The water-path detectives
- `sci-tees-b-w30-the-water-trial-planning-board` · lesson · BUILD · The water-trial planning board
- `sci-tees-l-w31-animal-systems-the-evidence-challenge` · lesson · LAUNCH · Animal systems: the evidence challenge
- `sci-tees-l-w28-blood-glucose-build-the-control-model` · lesson · LAUNCH · Blood glucose: build the control model
- `sci-tees-l-w29-double-circulation-engineer-the-route` · lesson · LAUNCH · Double circulation: engineer the route
- `sci-tees-l-w34-the-border-brief-an-ecosystem-evidence-w` · lesson · LAUNCH · The border brief: an ecosystem evidence web
- `sci-tees-l-w30-exchange-and-ventilation-two-linked-jobs` · lesson · LAUNCH · Exchange and ventilation: two linked jobs
- `sci-tees-l-s2-w6-health-and-plants-evidence-checkpoint` · lesson · LAUNCH · Health and plants: evidence checkpoint
- `sci-tees-l-w27-hormone-messages-the-control-room` · lesson · LAUNCH · Hormone messages: the control room
- `sci-tees-l-w32-topics-7-8-mechanisms-checkpoint` · lesson · LAUNCH · Topics 7–8: mechanisms checkpoint
- `sci-tees-b-w21-the-blackout-box-mystery` · lesson · BUILD · The blackout-box mystery
- `sci-tees-b-w22-light-source-detectives` · lesson · BUILD · Light-source detectives
- `sci-tees-b-w26-the-fair-test-repair-lab` · lesson · BUILD · The fair-test repair lab
- `sci-tees-b-w24-the-shadow-screen-lab` · lesson · BUILD · The shadow-screen lab
- `sci-tees-b-w25-the-shadow-size-studio` · lesson · BUILD · The shadow-size studio
- `sci-tees-b-w23-sunlight-make-a-safer-plan` · lesson · BUILD · Sunlight: make a safer plan
- `sci-tees-l-w23-disease-data-newsroom-make-the-numbers-f` · lesson · LAUNCH · Disease data newsroom: make the numbers fair
- `sci-tees-l-w21-disease-detectives-follow-the-cause` · lesson · LAUNCH · Disease detectives: follow the cause
- `sci-tees-l-w26-greenhouse-challenge-grow-more-with-a-wa` · lesson · LAUNCH · Greenhouse challenge: grow more with a water budget
- `sci-tees-l-w22-immune-memory-recognise-respond-remember` · lesson · LAUNCH · Immune memory: recognise, respond, remember
- `sci-tees-l-w24-photosynthesis-the-light-lab` · lesson · LAUNCH · Photosynthesis: the light lab
- `sci-tees-l-w25-plant-transport-follow-the-water-and-sug` · lesson · LAUNCH · Plant transport: follow the water and sugar
- `sci-tees-g-w20-body-systems-the-dispatch-challenge` · lesson · GROW · Body systems: the dispatch challenge
- `sci-tees-g-w22-the-health-evidence-advisers` · lesson · GROW · The health evidence advisers
- `sci-tees-g-w21-heart-route-rescue` · lesson · GROW · Heart route rescue
- `sci-tees-g-w25-life-cycle-archive` · lesson · GROW · Life cycle archive
- `sci-tees-g-w23-the-nutrient-delivery-investigation` · lesson · GROW · The nutrient delivery investigation
- `sci-tees-g-w24-the-recovery-research-room` · lesson · GROW · The recovery research room
- `grow-computing-scratch-71638` · hub · GROW Computing · Programming with Scratch · Weeks 1–8
- `catalogue-2026-27-science-build-w3-w7-pack` · teacher · BUILD Science · five-week lesson pack
- `catalogue-2026-27-science-grow-w3-w7-pack` · teacher · GROW Science · five-week lesson pack
- `catalogue-2026-27-science-launch-w3-w7-pack` · teacher · LAUNCH GCSE Biology · five-week lesson pack
- `catalogue-2026-27-humanities-build-w27-w39-pack1r` · teacher · BUILD Humanities · Summer 1 · My local place and the wider world
- `pack1r-su1-build-w01-our-school-and-local-features` · lesson · Our school and local features · BUILD Humanities
- `pack1r-su1-build-w02-routes-on-a-familiar-plan` · lesson · Routes on a familiar plan · BUILD Humanities
- `pack1r-su1-build-w03-comparing-two-places` · lesson · Comparing two places · BUILD Humanities
- `pack1r-su1-build-w04-fieldwork-in-our-grounds` · lesson · Fieldwork in our grounds · BUILD Humanities
- `pack1r-su1-build-w05-continents-and-oceans` · lesson · Continents and oceans · BUILD Humanities
- `pack1r-su1-build-w06-our-class-map` · lesson · Our class map · BUILD Humanities
- `catalogue-2026-27-humanities-grow-w27-w39-pack1r` · teacher · GROW Humanities — Summer 1, Weeks 1–6
- `pack1r-su1-grow-w01-our-place-in-the-wider-world` · lesson · Our place in the wider world · GROW Humanities
- `pack1r-su1-grow-w02-atlases-grid-references-and-digital-maps` · lesson · Atlases grid references and digital maps · GROW Humanities
- `pack1r-su1-grow-w03-our-school-route-fieldwork` · lesson · Our school route fieldwork · GROW Humanities
- `pack1r-su1-grow-w04-physical-and-human-features` · lesson · Physical and human features · GROW Humanities
- `pack1r-su1-grow-w05-middlesbrough-and-helmsley` · lesson · Middlesbrough and Helmsley · GROW Humanities
- `pack1r-su1-grow-w06-our-locality-study-and-evidence` · lesson · Our locality study and evidence · GROW Humanities
- `catalogue-2026-27-humanities-launch-w27-w39-pack1r` · teacher · LAUNCH · Humanities · Summer 1
- `pack1r-su1-launch-w01-resource-use-and-carbon-dioxide` · lesson · Resource use and carbon dioxide · LAUNCH Humanities
- `pack1r-su1-launch-w02-judging-climate-responses` · lesson · Judging climate responses · LAUNCH Humanities
- `pack1r-su1-launch-w03-choosing-a-school-sustainability-option` · lesson · Choosing a school sustainability option · LAUNCH Humanities
- `pack1r-su1-launch-w04-an-accurate-earth-day-campaign` · lesson · An accurate Earth Day campaign · LAUNCH Humanities
- `pack1r-su1-launch-w05-a-measurable-community-contribution` · lesson · A measurable community contribution · LAUNCH Humanities
- `pack1r-su1-launch-w06-our-sustainability-decision-report` · lesson · Our sustainability decision report · LAUNCH Humanities
- `land-a2-sci-build-a2-w01-use-less-use-again-sort-waste` · lesson · BUILD · Use less, use again, sort waste
- `land-a2-sci-build-a2-w02-look-closely-at-rocks` · lesson · BUILD · Look closely at rocks
- `land-a2-sci-build-a2-w03-test-rock-hardness-and-water` · lesson · BUILD · Test rock hardness and water
- `land-a2-sci-build-a2-w04-choose-a-rock-for-a-job` · lesson · BUILD · Choose a rock for a job
- `land-a2-sci-build-a2-w05-natural-and-made-materials` · lesson · BUILD · Natural and made materials
- `land-a2-sci-build-a2-w06-keep-a-rock-test-fair` · lesson · BUILD · Keep a rock test fair
- `land-a2-sci-build-a2-w07-show-what-we-know-about-bodies-and-rocks` · lesson · BUILD · Show what we know about bodies and rocks
- `land-a2-sci-grow-a2-w01-why-day-turns-to-night` · lesson · GROW · Why day turns to night
- `land-a2-sci-grow-a2-w02-the-shapes-of-sun-earth-and-moon` · lesson · GROW · The shapes of Sun, Earth and Moon
- `land-a2-sci-grow-a2-w03-researching-the-solar-system` · lesson · GROW · Researching the Solar System
- `land-a2-sci-grow-a2-w04-global-warming-and-choices` · lesson · GROW · Global warming and choices
- `land-a2-sci-grow-a2-w05-forces-space-and-climate-questions` · lesson · GROW · Forces, space and climate questions
- `land-a2-sci-grow-a2-w06-investigating-a-science-question` · lesson · GROW · Investigating a science question
- `land-a2-sci-grow-a2-w07-autumn-science-review-and-evidence` · lesson · GROW · Autumn science review and evidence
- `land-a2-sci-launch-a2-w01-mitosis-and-the-cell-cycle` · lesson · LAUNCH · Mitosis and the cell cycle
- `land-a2-sci-launch-a2-w02-growth-and-stem-cells` · lesson · LAUNCH · Growth and stem cells
- `land-a2-sci-launch-a2-w03-stem-cell-decisions` · lesson · LAUNCH · Stem-cell decisions
- `land-a2-sci-launch-a2-w04-dna-genes-and-chromosomes` · lesson · LAUNCH · DNA, genes and chromosomes
- `land-a2-sci-launch-a2-w05-a-simple-genetic-cross` · lesson · LAUNCH · A simple genetic cross
- `land-a2-sci-launch-a2-w06-researching-a-genetic-condition` · lesson · LAUNCH · Researching a genetic condition
- `land-a2-sci-launch-a2-w07-cells-and-genetics-check` · lesson · LAUNCH · Cells and genetics check
- `pack-sci-tees-b-w18-soil-what-is-in-the-mix` · support · W18 · Soil: what is in the mix? · Companion pack
- `pack-sci-tees-b-w19-soil-let-the-water-through` · support · W19 · Soil: let the water through · Companion pack
- `pack-sci-tees-b-w20-soil-account-for-the-water` · support · W20 · Soil: account for the water · Companion pack
- `pack-sci-tees-l-w17-evolution-build-the-evidence-case` · support · W17 · Evolution: build the evidence case · Companion pack
- `pack-sci-tees-l-w18l2-genetic-engineering-change-test-decide` · support · W18L2 · Genetic engineering: change, test, decide · Companion pack
- `pack-sci-tees-l-w18l1-selective-breeding-design-a-resilient-` · support · W18L1 · Selective breeding: design a resilient crop · Companion pack
- `pack-sci-tees-g-w27-the-flower-to-seed-investigation` · support · W27 · The flower-to-seed investigation · Companion pack
- `pack-sci-tees-g-w32-change-detectives-what-became-something-` · support · W32 · Change detectives: what became something new? · Companion pack
- `pack-sci-tees-g-w26-the-life-cycle-comparison-bureau` · support · W26 · The life-cycle comparison bureau · Companion pack
- `pack-sci-tees-g-w28-the-plant-reproduction-strategy-studio` · support · W28 · The plant reproduction strategy studio · Companion pack
- `pack-sci-tees-g-w31-the-recovery-methods-workshop` · support · W31 · The recovery methods workshop · Companion pack
- `pack-sci-tees-g-w30-reversible-change-detectives` · support · W30 · Reversible change detectives · Companion pack
- `pack-sci-tees-g-w29-the-seed-dispersal-design-lab` · support · W29 · The seed dispersal design lab · Companion pack
- `pack-sci-tees-g-s2-w6-the-spring-science-evidence-exchange` · support · S2_W6 · The spring science evidence exchange · Companion pack
- `pack-sci-tees-g-w18b-circuit-fault-clinic` · support · W18B · Circuit fault clinic · Companion pack
- `pack-sci-tees-g-w19-the-spill-mat-design-lab` · support · W19 · The spill-mat design lab · Companion pack
- `pack-sci-tees-g-w18a-the-cold-case` · support · W18A · The cold case · Companion pack
- `pack-sci-tees-b-s2-w6-the-evidence-museum` · support · S2_W6 · The evidence museum · Companion pack
- `pack-sci-tees-b-w34-the-friction-surface-lab` · support · W34 · The friction surface lab · Companion pack
- `pack-sci-tees-b-w29-the-growth-needs-clinic` · support · W29 · The growth-needs clinic · Companion pack
- `pack-sci-tees-b-w31-the-growth-record-studio` · support · W31 · The growth-record studio · Companion pack
- `pack-sci-tees-b-w27-the-plant-parts-atlas` · support · W27 · The plant-parts atlas · Companion pack
- `pack-sci-tees-b-w28-the-plant-system-service-desk` · support · W28 · The plant-system service desk · Companion pack
- `pack-sci-tees-b-w32-the-water-path-detectives` · support · W32 · The water-path detectives · Companion pack
- `pack-sci-tees-b-w30-the-water-trial-planning-board` · support · W30 · The water-trial planning board · Companion pack
- `pack-sci-tees-l-w31-animal-systems-the-evidence-challenge` · support · W31 · Animal systems: the evidence challenge · Companion pack
- `pack-sci-tees-l-w28-blood-glucose-build-the-control-model` · support · W28 · Blood glucose: build the control model · Companion pack
- `pack-sci-tees-l-w29-double-circulation-engineer-the-route` · support · W29 · Double circulation: engineer the route · Companion pack
- `pack-sci-tees-l-w34-the-border-brief-an-ecosystem-evidence-w` · support · W34 · The border brief: an ecosystem evidence web · Companion pack
- `pack-sci-tees-l-w30-exchange-and-ventilation-two-linked-jobs` · support · W30 · Exchange and ventilation: two linked jobs · Companion pack
- `pack-sci-tees-l-s2-w6-health-and-plants-evidence-checkpoint` · support · S2_W6 · Health and plants: evidence checkpoint · Companion pack
- `pack-sci-tees-l-w27-hormone-messages-the-control-room` · support · W27 · Hormone messages: the control room · Companion pack
- `pack-sci-tees-l-w32-topics-7-8-mechanisms-checkpoint` · support · W32 · Topics 7–8: mechanisms checkpoint · Companion pack
- `pack-sci-tees-b-w21-the-blackout-box-mystery` · support · W21 · The blackout-box mystery · Companion pack
- `pack-sci-tees-b-w22-light-source-detectives` · support · W22 · Light-source detectives · Companion pack
- `pack-sci-tees-b-w26-the-fair-test-repair-lab` · support · W26 · The fair-test repair lab · Companion pack
- `pack-sci-tees-b-w24-the-shadow-screen-lab` · support · W24 · The shadow-screen lab · Companion pack
- `pack-sci-tees-b-w25-the-shadow-size-studio` · support · W25 · The shadow-size studio · Companion pack
- `pack-sci-tees-b-w23-sunlight-make-a-safer-plan` · support · W23 · Sunlight: make a safer plan · Companion pack
- `pack-sci-tees-l-w23-disease-data-newsroom-make-the-numbers-f` · support · W23 · Disease data newsroom: make the numbers fair · Companion pack
- `pack-sci-tees-l-w21-disease-detectives-follow-the-cause` · support · W21 · Disease detectives: follow the cause · Companion pack
- `pack-sci-tees-l-w26-greenhouse-challenge-grow-more-with-a-wa` · support · W26 · Greenhouse challenge: grow more with a water budget · Companion pack
- `pack-sci-tees-l-w22-immune-memory-recognise-respond-remember` · support · W22 · Immune memory: recognise, respond, remember · Companion pack
- `pack-sci-tees-l-w24-photosynthesis-the-light-lab` · support · W24 · Photosynthesis: the light lab · Companion pack
- `pack-sci-tees-l-w25-plant-transport-follow-the-water-and-sug` · support · W25 · Plant transport: follow the water and sugar · Companion pack
- `pack-sci-tees-g-w20-body-systems-the-dispatch-challenge` · support · W20 · Body systems: the dispatch challenge · Companion pack
- `pack-sci-tees-g-w22-the-health-evidence-advisers` · support · W22 · The health evidence advisers · Companion pack
- `pack-sci-tees-g-w21-heart-route-rescue` · support · W21 · Heart route rescue · Companion pack
- `pack-sci-tees-g-w25-life-cycle-archive` · support · W25 · Life cycle archive · Companion pack
- `pack-sci-tees-g-w23-the-nutrient-delivery-investigation` · support · W23 · The nutrient delivery investigation · Companion pack
- `pack-sci-tees-g-w24-the-recovery-research-room` · support · W24 · The recovery research room · Companion pack
- `pack-grow-science-w3a` · support · W3A · Friction: Friend and Enemy · Companion pack
- `pack-launch-science-w4l1` · support · W4L1 · Discover: Diffusion · Companion pack

</details>

<details><summary>The 65 mirror rows changed, and the fields that changed</summary>

- `pack-build-humanities-w10` · added
- `pack-build-humanities-w11` · added
- `pack-build-humanities-w12` · added
- `pack-build-humanities-w13` · added
- `pack-build-humanities-w14` · added
- `pack-build-humanities-w9` · added
- `pack-build-science-w10a` · added
- `pack-build-science-w10b` · added
- `pack-build-science-w11b` · added
- `pack-build-science-w12a` · added
- `pack-build-science-w12b` · added
- `pack-build-science-w13a` · added
- `pack-build-science-w13b` · added
- `pack-build-science-w14a` · added
- `pack-build-science-w14b` · added
- `pack-build-science-w15a` · added
- `pack-build-science-w15b` · added
- `pack-build-science-w8a` · added, builtFrom, desc
- `pack-build-science-w8b` · added
- `pack-build-science-w9a` · added
- `pack-build-science-w9b` · added
- `pack-grow-humanities-w10` · added
- `pack-grow-humanities-w11` · added
- `pack-grow-humanities-w12` · added
- `pack-grow-humanities-w13` · added
- `pack-grow-humanities-w9` · added
- `pack-grow-science-a2-w7b` · added
- `pack-grow-science-w10a` · added
- `pack-grow-science-w10b` · added
- `pack-grow-science-w11a` · added
- `pack-grow-science-w11b` · added
- `pack-grow-science-w12a` · added
- `pack-grow-science-w12b` · added
- `pack-grow-science-w13a` · added
- `pack-grow-science-w13b` · added
- `pack-grow-science-w8a` · added
- `pack-grow-science-w8b` · added
- `pack-grow-science-w9a` · added
- `pack-grow-science-w9b` · added
- `pack-launch-humanities-w10` · added
- `pack-launch-humanities-w11` · added
- `pack-launch-humanities-w12` · added
- `pack-launch-humanities-w13` · added
- `pack-launch-humanities-w14` · added
- `pack-launch-humanities-w9` · added
- `pack-launch-science-a2-w7l1` · added, desc, title
- `pack-launch-science-a2-w7l2` · added, desc, title
- `pack-launch-science-w10l1` · added, desc, title
- `pack-launch-science-w10l2` · added, desc, title
- `pack-launch-science-w10l3` · added, desc, title
- `pack-launch-science-w11l1` · added, desc, title
- `pack-launch-science-w11l2` · added, desc, title
- `pack-launch-science-w11l3` · added, desc, title
- `pack-launch-science-w12l1` · added, desc, title
- `pack-launch-science-w12l2` · added, desc, title
- `pack-launch-science-w12l3` · added, desc, title
- `pack-launch-science-w13l1` · added, desc, title
- `pack-launch-science-w13l3` · added, desc, title
- `pack-launch-science-w14l1` · added, desc, title
- `pack-launch-science-w14l2` · added, desc, title
- `pack-launch-science-w14l3` · added, desc, title
- `pack-launch-science-w8l1` · added
- `pack-launch-science-w8l2` · added
- `pack-launch-science-w8l3` · added
- `pack-launch-science-w9l1` · added, desc, title

</details>

<details><summary>The 18 search-index entries changed</summary>

- `resource-pack-launch-science-a2-w7l1` · action, description, tasks, title · "A2_W7L1 · Topics 2 and 3 assessment review map · Companion pack" -> "A2_W7L1 · Review map: cells, evidence and inheritance · Companion pack"
- `resource-pack-launch-science-a2-w7l2` · action, description, title · "A2_W7L2 · Topics 2 and 3 evidence task lab · Companion pack" -> "A2_W7L2 · Exam-style reasoning: evidence to explanation · Companion pack"
- `resource-pack-launch-science-w10l1` · action, description, title · "W10L1 · Growth and Differentiation: Building an Organism · Companion pack" -> "W10L1 · Growth and differentiation: building an organism · Companion pack"
- `resource-pack-launch-science-w10l2` · action, description, title · "W10L2 · Stem Cells and Meristems: Potential Compared · Companion pack" -> "W10L2 · Stem cells and meristems: compare potential · Companion pack"
- `resource-pack-launch-science-w10l3` · action, description, title · "W10L3 · Growth and Stem-Cell Data: Evidence Before Claims · Companion pack" -> "W10L3 · Growth data: evidence before claims · Companion pack"
- `resource-pack-launch-science-w11l1` · action, description, title · "W11L1 · Stem Cells: Evidence Before Judgement · Companion pack" -> "W11L1 · Stem cells: evidence before judgement · Companion pack"
- `resource-pack-launch-science-w11l2` · action, description, tasks, title · "W11L2 · Stem-Cell Evidence: Benefit, Risk, Uncertainty · Companion pack" -> "W11L2 · Benefit, risk and uncertainty: read the numbers · Companion pack"
- `resource-pack-launch-science-w11l3` · action, description, title · "W11L3 · Stem Cells: Structured DISCUSS · Companion pack" -> "W11L3 · Stem cells: a balanced DISCUSS response · Companion pack"
- `resource-pack-launch-science-w12l1` · action, description, title · "W12L1 · Genetic Information: Cell to Gene · Companion pack" -> "W12L1 · Genetic information: cell to gene · Companion pack"
- `resource-pack-launch-science-w12l2` · action, description, title · "W12L2 · DNA Structure: Pair, Twist, Critique · Companion pack" -> "W12L2 · DNA structure: pair, twist, critique · Companion pack"
- `resource-pack-launch-science-w12l3` · action, description, title · "W12L3 · Fruit DNA: Extract, Observe, Evaluate · Companion pack" -> "W12L3 · Fruit DNA: extract, observe, evaluate · Companion pack"
- `resource-pack-launch-science-w13l1` · action, description, title · "W13L1 · Inheritance Language: Allele to Phenotype · Companion pack" -> "W13L1 · Alleles, genotype and phenotype · Companion pack"
- `resource-pack-launch-science-w13l3` · action, description, title · "W13L3 · Inheritance Data: Predict, Calculate, Evaluate · Companion pack" -> "W13L3 · Inheritance probability: predict and evaluate · Companion pack"
- `resource-pack-launch-science-w14l1` · action, description, title · "W14L1 · Genetic Conditions: Frame a Safe Research Question · Companion pack" -> "W14L1 · Genetic condition research: ask a bounded question · Companion pack"
- `resource-pack-launch-science-w14l2` · action, description, title · "W14L2 · Genetic Conditions: Triangulate Source Evidence · Companion pack" -> "W14L2 · Source evidence: trace every claim · Companion pack"
- `resource-pack-launch-science-w14l3` · action, description, tasks, title · "W14L3 · Genetic Conditions: Present Evidence with Care · Companion pack" -> "W14L3 · Present a genetic condition with care · Companion pack"
- `resource-pack-build-science-w8a` · description · "W8A · Sugar Evidence: Read the Label · Companion pack" -> "W8A · Sugar Evidence: Read the Label · Companion pack"
- `resource-pack-launch-science-w9l1` · action, description, title · "W9L1 · Cell Cycle: Copy, Check, Divide · Companion pack" -> "W9L1 · Cell cycle: copy, check, divide · Companion pack"

</details>
