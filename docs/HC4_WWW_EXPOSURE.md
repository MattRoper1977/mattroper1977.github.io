# HC4 — Exposure of the stranded `www.madebymatt.uk` origin

**Scope:** measurement only. How many routes were ever linked using the `www.` host in printed / QR / worksheet / hub sources across four local clones, and when. No recovery options are proposed here; none exist at repo level (see "What this means").

**Date of measurement:** 2026-09-07
**Script:** `tools/hc4/www_exposure.py` (run from the Site checkout: `python3 tools/hc4/www_exposure.py --extended > www_exposure.json`). Every count below is produced by that script unless a shell command is quoted instead.

## Repos scanned (git HEAD at time of measurement)

| Repo | Path | HEAD SHA | Commits reachable | History |
|---|---|---|---|---|
| Site | `/home/user/mattroper1977.github.io` | `0113130e44bc4ed1aba036f6b09612ab79d62cae` | 1 | **shallow (depth 1)** |
| Lessons | `/home/user/Lessons` | `e5129ad85db138e6c66ce8a8862a9af2f8f949a6` | 141 | shallow / partial (141 commits) |
| Apps | `/home/user/matt-s-apps-` | `162e65b3764b4b46c646c318bc5a00e831bf7be8` | 1 | **shallow (depth 1)** |
| Games | `/home/user/games` | `15e2c9cf970e8ffc03f62ba4c2e02ba462dbcf39` | 1 | **shallow (depth 1)** |

Excluded from every scan: `.git`, `node_modules`, `docs/`, `reports/`, `_sownb/`.
Extensions in the headline scan (as requested): `.html .md .json .js .py .svg .csv .txt .pdf`. PDFs were read with `strings` (`pdftotext` is not installed on this machine); 256 PDFs were scanned inside the included directories.

## Patterns (exact, from `www_exposure.py`)

| Name | Python `re` pattern | Purpose |
|---|---|---|
| `host` | `www\.madebymatt\.uk` | any literal occurrence of the host (catches `//www.…` and `https://www.…` too) |
| `url` | `(?:https?:)?//www\.madebymatt\.uk(?P<path>[^\s"'<>)\\\],;]*)` | scheme or protocol-relative URL, capturing the path component |
| `play` | `www\.madebymatt-play\.uk` | positive control — the current canonical play host |
| `encoded` | `www%2[Ee]madebymatt\|www%2[Ff]madebymatt` | percent-encoded forms a literal grep would miss |
| `concat` | `['"]www\.?['"]\s*\+` | `'www.' + host` string concatenation |

File-kind classification (applied to the *file*, by filename then content): **qr** if filename or content matches `\bqr\b|qrcode|api\.qrserver`; else **hub** if the path matches `index.html`, `START_HERE*`, `resources.json`, `catalogue*`, `hub*`; else **printed/worksheet** if the filename matches `print|worksheet|printpack|handout|poster|card` (or the content does, for `.html/.md/.svg/.pdf`); else **other**.

## Results — headline scan (requested extensions)

| Measure | Count | Source |
|---|---|---|
| Files containing the `host` pattern | **7** | `www_exposure.py` → `summary.files_with_host_main` |
| Lines containing the `host` pattern | **8** | `summary.lines_with_host_main` |
| Distinct routes (URLs with a path, de-duplicated by path) | **1** | `summary.routes_with_path_main` |
| Routes per kind — printed/worksheet | **0** | `summary.routes_by_kind_main` |
| Routes per kind — qr | **0** | ″ |
| Routes per kind — hub | **0** | ″ |
| Routes per kind — other (tooling / allow-lists) | **1** | ″ |
| Files per kind — printed/worksheet / qr / hub / other | **0 / 0 / 0 / 7** | `summary.files_by_kind_main` |
| Percent-encoded or concatenated `www.` forms of the host | **0** | `encoded_or_concat` (empty) |
| Hits in Lessons / Apps / Games repos | **0 / 0 / 0** | every hit has `repo == "Site"` |

### Table of www routes (headline scan)

| Path | Kind | Files referencing it | Earliest known date |
|---|---|---|---|
| `/` (bare origin, no path) | other | `Site:domain-split/stub-handoff.js:14`, `Site:domain-split/usage_discovery.py:183`, `Site:tools/hc3_handoff_publications.py:76` | **unknown: shallow history** (clone commit `2026-09-07T06:12:40+01:00` is the only date available) |

The remaining 5 lines (`education_discovery.py:43`, `education_policy.py:13`, `usage_discovery.py:20`, `education_support.py:113`, `check_education_separation.py:110`) contain the bare hostname only — as a member of a host allow-list set, not as a URL — so they carry no route.

Every one of the 8 lines is a host allow-list or origin set in domain-split tooling (e.g. `const educationOrigins = new Set(['https://madebymatt.uk', 'https://www.madebymatt.uk'])`). **None is a link, QR payload, worksheet, hub entry or printed reference.**

## Supplementary scan (`--extended`: `.ts .cjs .mjs .yml .yaml`, outside the requested list)

Reported separately; not merged into the headline.

| Measure | Count | Source |
|---|---|---|
| Additional files containing `host` | **3** | `summary.files_with_host_extended` |
| Additional distinct routes | **2** | `summary.routes_with_path_extended` |

| Path | Kind | File | Earliest known date |
|---|---|---|---|
| `/` | other | `Site:supabase/functions/usage-shared/handler.ts:5` (CORS origin set) | unknown: shallow history |
| `/game-saves/` | other | `Site:domain-split/play/check-save-ui.cjs:7` (a Playwright check that navigates to the www URL with the request routed to a local server; a test harness, not a published link) | unknown: shallow history |

`Site:domain-split/check_resource_discovery.cjs:32` holds the bare host in an allow-list (no route).

## Dates

For each hit file the script ran, in the owning repo:

```
git log --diff-filter=A --format=%cI -1 -- <file>
git log -1 --format=%cI -S 'www.madebymatt.uk' -- <file>
```

All 10 hit files are in the **Site** clone, which is depth 1. Both commands therefore return the single clone commit, `2026-09-07T06:12:40+01:00`, for every file. **This is the clone date, not the date the reference was introduced. No first-added or last-changed date is recoverable from these clones.** The Lessons repo (141 commits of history) contains **zero** hits, so its deeper history adds no dates.

## Positive control — the play host `www.madebymatt-play.uk`

| Measure | Count | Source |
|---|---|---|
| Files (requested extensions, excluded dirs applied) | **25** (Site 22, Lessons 3, Apps 0, Games 0) | `www_exposure.py` → `play_control` |
| Occurrences (same scope) | **44** (Site 40, Lessons 4) | ″ |
| Files, all text extensions | **45** | `grep -rIl --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=docs --exclude-dir=reports --exclude-dir=_sownb 'www\.madebymatt-play\.uk' mattroper1977.github.io Lessons matt-s-apps- games \| wc -l` (run from `/home/user`) |
| Occurrences, all text extensions | **79** | same with `-o` and no `-l`, piped to `wc -l` |

The control finds the play host in the same directories, with the same exclusions, using the same tooling, so a zero for `www.madebymatt.uk` in printed/QR/hub sources is a genuine zero and not a dead grep. The difference between 25/44 and 45/79 is only the extension filter (the second includes `.yml`, `.cjs`, `.mjs`, `.ts` and similar).

For orientation: the same print/QR-ish file set references the **apex** `https://madebymatt.uk` **1041** times (`grep -rIlE -i 'print|worksheet|printpack|handout|qr|poster' … | xargs grep -ohE 'https?://(www\.)?madebymatt(-play)?\.uk' | sort | uniq -c`, from `/home/user`). Printed and hub sources in these clones link the apex, not `www.`.

## Transparency: what the exclusions hid

`grep -rIl --exclude-dir=.git --exclude-dir=node_modules 'www\.madebymatt\.uk' … | grep -E '/(docs|reports|_sownb)/'` finds **11** further files, all under `docs/` — HC1/HC3 health and hand-off reports and JSON (`docs/HC3_HANDOFF_PUBLICATIONS_2026-09-07.json`, `docs/hc3-recovery/stub-handoff.js`, `docs/HC3_SAVE_RECOVERY_2026-09-06.md`, and health reports mirrored into Lessons, Apps and Games). These are reports *about* the domain split, not sources of printed or hub links, and were excluded by instruction.

## Limits of this measurement

- It measures the **working trees at HEAD** of four clones. Anything that was linked as `www.` in the past and has since been rewritten to the apex is invisible to a working-tree grep, and the depth-1 clones give no history to check. Only the Lessons clone has history (141 commits) and it has no hits to trace.
- It cannot see physical prints, PDFs distributed outside these repos, or QR codes generated by hand.
- `strings` on PDFs recovers plain-text URLs but not text inside compressed content streams; a www link embedded only as a compressed annotation would be missed. 256 PDFs were scanned with no hit.

## What this means

Within these four clones, **no printed, worksheet, QR or hub source links the `www.madebymatt.uk` host**; the only references are host allow-lists and test scripts in the Site repo's domain-split tooling, plus one path (`/game-saves/`) inside a Playwright harness. Nothing in any repository can reach storage stranded on the `www.` origin: the hosting layer issues its 301 before any page executes, so no script, redirect page, or handoff shipped from these repos will ever run on that origin. The only thing that could change that is a hosting-level exception to the redirect, which is a Matt-only decision (M1) and outside the scope of this report.
