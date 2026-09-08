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
