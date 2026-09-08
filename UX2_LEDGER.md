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
| Header search control (new) | NEW — 44px icon link to the page's own search field (`#home-resource-query`, `#teachers-q`, `#pupils-q`, `#rxSearch`, `#search`, `#tq`, `#teach-search`, `#hub-search`, `#gv-search`), or `/resources/#rxSearch` where a page has none; asserted per route |

### Part B1 auto-decisions
- AUTO-DECISION B1-1: audience rows use the record's `label` (not `navLabel`), in record order; the governors row is appended from `education_expansion.AUDIENCES` because `/for/governors-trustees/` exists only in the build. The record does not carry it; said so in the report.
- AUTO-DECISION B1-2: `/resources/`, `/Lessons/primary/` and the other non-adult surfaces keep the existing audience boundary (no `/account/`, `/members/`, `/mailing-list/` links): their "Your account" group is the shared subset (Privacy and statistics only). The pupil subset (three groups reduced to Lessons · Resources · Primary lessons / Pupils / Privacy and statistics) renders on `/for/pupils/` only, as before.
- AUTO-DECISION B1-3: the group headings are no longer uppercased by CSS so the rendered text equals Appendix A ("Learning", "Who are you here for?", "Your account").
- AUTO-DECISION B1-4: the desktop quick row is retired with the tagline; the header is mark · wordmark · search · menu at every width.
