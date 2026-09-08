# UX2 Play shelf ledger (order UX2, lane C, 2026-09-08)

Every control, section, select, caption, count statement and menu item of the
shelf as it was built at Site 6430f23f (`domain-split/play/index.html`,
`play.js`, `build.py`) and what happened to it in this change. Three verdicts:
**SURVIVES** (same thing, possibly restyled), **RELOCATES** (same function,
new home — the destination is named), **RETIRED** (gone — the reason is named).

Source of the "old" column: `orient/C0.md` §8 as measured on the local build
at the pinned tuple (Site 6430f23f, Lessons 948a7d7b). Nothing here was typed
from memory.

## Header

| Old | Verdict | Where / why |
|---|---|---|
| Approved mark (`@@LOGO@@`, `approved-mark.jpg`, hash-checked) | SURVIVES | same brand link, 40px at 390 / 48px wider |
| "Made by Matt **Play**" brand text | SURVIVES | Appendix A header |
| Menu `<details class="menu">` + `summary` "Menu ☰" | SURVIVES | now an icon button (inline SVG, `aria-label="Menu"`, 44×44); Escape closes and refocuses the summary (check.cjs) |
| — | (new) | search icon button `#search-jump` (inline SVG, 44×44, `href="#query"` without JS) |
| Menu item "Browse games" → `#browse` | RELOCATES | "All games" → `#all-games` |
| Menu item "Favourites & recent" → `#your-browser` | RETIRED | section retired (see below); favourites are a chip, recent is the Continue playing lane |
| Menu item "Transfer game saves" → `/game-saves/` | SURVIVES | "Transfer saves" (Appendix A wording) |
| Menu item "Privacy & saved progress" → `/privacy/` | SURVIVES | "Privacy and saved progress" (Appendix A wording) |
| Menu item "Statistics" → `/stats/` | SURVIVES | unchanged |
| Menu item "Made by Matt Education ↗" | SURVIVES | unchanged (`class="education-return"`) |
| — | (new) | menu item "For your classroom" → `#classroom` |
| Skip link "Skip to games" → `#browse` | SURVIVES | → `#all-games` |

## Hero

| Old | Verdict | Where / why |
|---|---|---|
| Eyebrow "Explore • Play • Discover" | RETIRED | not in Appendix A §PLAY |
| `<h1>` "Find a world. / Make it yours." (with `<br>`) | SURVIVES | one sentence pair, verbatim: "Find a world. Make it yours." |
| Line "Adventure, sport, building and brain-teasers. Pick something that feels like you." | SURVIVES (trimmed) | verbatim Appendix A: "Adventure, sport, building and brain-teasers." |
| Hero search `#hero-search` / `#hero-query` (label "Find your next game", placeholder "Search games and activities", "Search" button) | RETIRED | duplicate of the browse search — ONE search field now (`#query`, label + placeholder "Search games") |
| Hero buttons "Browse games" / "Your favourites" | RETIRED | chips row (All / genres / Favourites) does this |
| `.intro-side .large-number` "69" (hidden ≤600px) | RETIRED | order: remove the hero large-number; one count statement only |
| `.intro-side .muted` "62 catalogue games · 6 classroom activities · 1 staff activity" | RETIRED | second counts sentence removed |
| Quick genre chips (typed: Adventure / Sport / Creative / Puzzles) | RELOCATES | chip row derived from data: All + every catalogue genre ordered by count (Sport 17, Action 14, Adventure 7, Puzzles 7, Strategy 7, Creative 6, Classroom 4) + Favourites; single-select, ≥44px, `replaceState ?genre=` / `?list=favourites` |

## Showcase ("A glimpse inside / Choose your next adventure", 6 `featured-card`s)

| Old | Verdict | Where / why |
|---|---|---|
| Section, eyebrow, heading, "Real gameplay. Press Watch to preview." | RETIRED | it duplicated six grid cards (the 75-vs-69 duplicate). Replaced by ONE Featured card (manifest `featured:true`, first in shelf order = Off-Brand: After Hours) and by "Watch gameplay" on media cards and in the sheet |
| `Watch gameplay` buttons on media cards (`[data-watch]`) | SURVIVES | compact pill on the six media cards in the grid and on the Featured card; opens the sheet playing the clip (check-media.cjs contract kept) |

## Browse section (`#browse`)

| Old | Verdict | Where / why |
|---|---|---|
| Eyebrow "Find your kind of game" / `<h2>` "The games collection" | RETIRED / RELOCATES | heading is now "All games" (Appendix A) |
| `.section-heading .muted` counts sentence (second copy) | RETIRED | one count statement only |
| `#discovery-form` search `#query` (label "Search games", placeholder "Try Emberwild, football or puzzles…", "Search" button) | SURVIVES | the ONE search field; label and placeholder "Search games"; no submit button — inert until typing; scoped to catalogue titles + descriptions (was title/description/genre/subject/group/keywords) |
| `<select id="genre">` "Genre" (9 options) | RELOCATES | chip row |
| `<select id="group">` "Collection" (All / Catalogue games / Classroom activities / Staff activities) | RETIRED | the grid is the catalogue population only; activities and staff are the "For your classroom" rows, never in the grid |
| `<select id="control">` "Controls" (5 options) | RELOCATES | Filters drawer (`<dialog id="filters">`), same options |
| `<select id="mode">` "Players" (4 options) | RELOCATES | Filters drawer, same options |
| `<select id="list">` "Show" (All games / Favourites / Recently opened) | RELOCATES | Filters drawer, same options; the Favourites chip is the same state (`?list=favourites`) |
| `button[type=reset]` "Reset search & filters" | RELOCATES | Filters drawer "Reset" (clears search, chip and drawer fields) |
| `<noscript>` "All games are listed below. Search, filters and favourites need JavaScript; direct Play links work without it." | SURVIVES | unchanged (check.cjs asserts it) |
| `#result-count` "69 games and activities" → live "69 of 69 games and activities" | SURVIVES (re-derived) | the ONE count statement: build "62 games", live "n of 62 games" when filtering |
| "Open Game info for controls and support details." | RETIRED | the thumbnail+title button is the affordance |
| `#previous-results` "Return to your previous results" | RETIRED | the silent restore survives: arriving back from a game with no explicit params restores the remembered search/scroll (position key unchanged) |
| `#empty-state` "No games found" / "Try a different word or clear a filter." / "Show all games" | SURVIVES | unchanged ids and copy |
| `#game-grid` 69 cards (`article.game-card[data-card]`) | SURVIVES (re-populated) | 58 cards = 62 catalogue games with series collapsed (Slipstream 3 → 1, World Cup 3 → 1; Kids vs Staff 1 catalogue + 1 activity); every catalogue game exactly once (card Play or edition Play inside the lead card); 2 columns at 390 |
| Card chip 1 (genre) | SURVIVES | genre chip |
| Card chip 2 (`groupLabel`: Catalogue game / Catalogue classroom game / …) | RETIRED | population is implicit (grid = catalogue; rows = classroom/staff) |
| Card `<figure>` + `<figcaption>` "In-game screenshot" / "Cover artwork" | RETIRED (captions) | thumbnail survives as part of the open button; captions retired by order (0 occurrences, gated) |
| Card `<p>` description | RETIRED from the card | the sheet carries the description (+ "New chapter: …" for the Part E routes) |
| Card "Play game" primary link | SURVIVES | one green "Play" pill (`a[data-play]`, sr-only game name) |
| Card "Game info" button (`[data-info]`) | RELOCATES | thumbnail + title = ONE `<button data-info>` opening the sheet |
| Card favourite heart (`[data-favourite]`, ♡/♥) | RELOCATES | sheet "Favourite" button (`#dialog-favourite`, `aria-pressed`, same key `mbm_play_favourites_v1`) |
| — | (new) | "<n> editions" chip on series cards; "Needs a keyboard" chip (verified non-touch controls, shown only on a coarse pointer) |

## "Recently updated" section

| Old | Verdict | Where / why |
|---|---|---|
| `<h2>` "Recently updated", 3 articles with `<time>` ISO date, title link, description | RELOCATES | "New and updated" lane from the same evidence.json `updated` entries, newest first, date formatted by code ("4 Sep 2026") |

## "Your games, in this browser" (`#your-browser`)

| Old | Verdict | Where / why |
|---|---|---|
| Eyebrow / `<h2>` / explanatory paragraph | RETIRED | replaced by the Continue playing lane ("on this device") and the Favourites chip |
| `#storage-status` (role=status) | SURVIVES | beside the All games heading; storage-unavailable and "cleared" notices |
| "View favourites" (`?list=favourites#browse`) | RELOCATES | Favourites chip |
| "Recently opened" (`?list=recent#browse`) | RELOCATES | Continue playing lane; Filters drawer Show → Recently opened |
| `#clear-favourites` "Clear favourites" | RELOCATES | shown beside the count while the Favourites chip is selected |
| `#clear-recent` "Clear recently opened" | RELOCATES | Continue playing lane header |
| "These clear controls never delete game saves." | RETIRED (copy) | behaviour unchanged and gated (sentinel `apexkick.v1` untouched) |

## "Played here before the move?" (migration)

| Old | Verdict | Where / why |
|---|---|---|
| `<h2>` + paragraph with "save transfer guide" link | RELOCATES | sheet "Your progress" / "Saves stay in this browser on this device." / "Transfer saves" → `/game-saves/`; menu "Transfer saves" |

## Footer

| Old | Verdict | Where / why |
|---|---|---|
| "**Made by Matt Play** · Explore • Play • Discover" | SURVIVES (trimmed) | "Made by Matt Play" after the links (Appendix A) |
| "Made by a teacher, for curious minds. …" | RETIRED | not in Appendix A |
| "Privacy & saved progress" / "Report a problem" (mailto) / "Made by Matt Education ↗" | SURVIVES | "Privacy and saved progress · Report a problem · Made by Matt Education ↗"; mailto unchanged |
| `@@COLLECTION_NOTE@@` "The 62 catalogue entries include 4 classroom games. …" | RETIRED | count statements reduced to one |
| Consent block (`usage_discovery.preferences()`, `<details id="usage-statistics">`) | SURVIVES (compact) | same id, same key `mbm_usage_choice_v1`, same `data-usage-choice` events and status hook, same `/privacy/#shared-usage` anchor; Play-only compact copy via `preferences(compact=True)` — default output byte-identical for education and the Play privacy/stats pages |

## Game dialog (`#game-dialog`)

| Old | Verdict | Where / why |
|---|---|---|
| `#dialog-kind` "<genre> · <groupLabel>" | SURVIVES (trimmed) | genre chip only |
| `#dialog-close` "Close ×" (autofocus) | SURVIVES | focus lands here on open; returns to the opener on close |
| `#dialog-title` | SURVIVES | displayTitle ‖ title |
| `#dialog-media` figure + caption ("In-game screenshot. …" / "Cover artwork; this is not an in-game screenshot.") | SURVIVES (captions retired) | 16:9 media: poster/art, video on Watch gameplay |
| `#dialog-description` | SURVIVES | + " New chapter: <chapter>." for the nine Part E routes (`chapters.json`) |
| `<dl>` Controls / Players ("Not yet verified") | RELOCATES | support chips (Touch · Keyboard · Gamepad · 1 player · Local multiplayer) for verified flags only, else "Not yet verified" |
| `<dl>` How to play (instructions) | RETIRED | not in the Appendix A sheet; instructions stay in `play-discovery.json` |
| `<dl>` Support evidence | RETIRED | not in the Appendix A sheet |
| `#dialog-play` "Play <title>" | SURVIVES | "Play <title> →" |
| `#dialog-watch` "Watch gameplay" | SURVIVES | only when media exists |
| `#dialog-report` per-game mailto "Report a problem" | RETIRED from the sheet | "Report a problem" stays in the footer (mailto as today) |
| `#media-status` | SURVIVES | unchanged |
| "Use browser Back to return to these results. Progress is stored according to the individual game." | RETIRED | "Your progress" block carries the saves message |
| — | (new) | "Needs a keyboard" line above Play (coarse pointer + verified non-touch controls); Editions row (series); Your progress / Transfer saves; Favourite; Share (navigator.share with copy-link fallback); `?game=<id>` deep link |

## Storage keys

`mbm_play_favourites_v1` (localStorage), `mbm_play_recently_opened_v1`
(localStorage), `mbm_play_browse_position_v1` (sessionStorage) — unchanged
names, unchanged shapes. `mbm_usage_choice_v1` — unchanged (usage-client.js).
No key was added.

## AUTO-DECISIONs

1. **"Kids vs Staff" series is not in games.json.** The order maps series
   "Kids vs Staff" onto the one games.json row (Showdown) and, in the same
   breath, makes a series named on a single row a validator defect with a
   required red proof. Both cannot hold. The validator rule (a gate with a
   proof) wins: games.json carries no "Kids vs Staff" key; the join lives in
   `domain-split/play/activity-metadata.json` (route-keyed, reviewed), which
   also carries the two activity displayTitles the order assigns to the
   activity metadata source. The shelf still collapses Showdown + Studio Game
   Show into one "2 editions" card and the sheet's Editions row lists both.
2. **Lanes are rendered by play.js from the inline data**, not server-side:
   one tile renderer instead of two, and the no-JS document keeps exactly one
   Play anchor per game in the grid/rows (plus the static Featured card). Lane
   tiles are `li.tile` (button + Play), never `article.game-card[data-card]`,
   so `data-card` ids stay unique (58) — the "ONE DOM" measure.
3. **Series card title is the series name** ("Slipstream", "World Cup",
   "Kids vs Staff") with the lead edition's art, genre and Play; the sheet
   opened from it is the lead edition's, and the Editions row switches
   between editions.
4. **Search scope** = title + displayTitle + series name + description
   (the order's "titles+descriptions"); genre/subject/keywords no longer
   match.
5. **Lanes and Featured hide while any search/chip/filter is active**, so a
   filtered view is the grid alone; "All" restores them.
6. **Clear controls** kept (privacy on shared devices) and relocated rather
   than retired; their copy is the existing copy, not new copy.
7. **check.cjs `channel`** honours `PLAY_BROWSER_CHANNEL` (default still
   `chrome`); this session ran it with chromium because only chromium is
   installed here. check-media.cjs and check-save-ui.cjs were not edited;
   they were run from scratch copies with the channel removed.
8. **`.card-editions` Play links** for the other catalogue editions are in the
   server-rendered card (no-JS reachability) and hidden by play.js, whose
   sheet Editions row takes over.

- **Deep link to a non-lead edition (e.g. `?game=slipstream-gp`):** on close the sheet returns focus to the "All games" heading when no card opened it; the heading carries `tabindex="-1"` so that fallback is a real focus target (C4 stop 6, fixed before landing).

9. **Sheet-close focus fallback.** When a sheet opened from a `?game=` deep link has no opener in the grid (a non-lead edition), focus returns to the "All games" heading; that heading now carries `tabindex="-1"` so the fallback lands on a focusable element (found by the C4 gate's deep-link journey, fixed before landing).
