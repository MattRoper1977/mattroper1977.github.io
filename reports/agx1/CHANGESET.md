# AGX-1 · CHANGESET

**Pass:** AGX-1, post-merge verification of the Apex Golf commits
**Sentinel:** `apexgolf-build-2026-08-04` (revision 5)
**Run date:** 4 August 2026
**Method:** derived from the repository by measurement. No commit description,
including §8's own readback, was accepted as evidence.

---

## 1. Identity gate (§11.1)

Attached to the **site** repository, `MattRoper1977/mattroper1977.github.io`.
All four required markers present — **4/4**:

| Marker | State |
|---|---|
| `hud.js` at root | present |
| `assets/brand/hero_mark.svg` + `micro_mark.svg` | both present |
| `CNAME` | `madebymatt.uk` |
| `apexkick/` and `apexpool/` | both present |

**Rollback SHA recorded before any write:**

```text
site main  4afd34854e92ec029be3d381433a855aaa82de6a
```

`MattRoper1977/Lessons` — the decoy — was never fetched, cloned, read or
written in this pass.

**`MattRoper1977/Games` is NOT reachable from this session.** GitHub MCP
returns `Access denied: repository "mattroper1977/games" is not configured for
this session. Allowed repositories: mattroper1977/mattroper1977.github.io`, and
no `list_repos`/`add_repo` tool is present. The manifest was therefore read
over `raw.githubusercontent.com` at `Games@main` (HTTP 200, 15,465 bytes).
Manifest *content* is measured; Games repository *PR and branch state* is not.
See FINDINGS L-1.

---

## 2. The environment (§1), probed not assumed

| Capability | Result |
|---|---|
| Headless browser | **YES** — Chromium via Playwright 1.56.1 at `/opt/pw-browsers` |
| Node | v22.22.2 |
| `jsdom` | installed on demand into the scratchpad (38 packages) |
| `api.github.com` | 200 — reachable |
| `raw.githubusercontent.com` | 200 — reachable |
| **`madebymatt.uk`** | **000 — proxy answers 403 on CONNECT** |
| `mattroper1977.github.io` | **000 — same** |
| GitHub **Pages API** | **blocked at the proxy** (`Access to this GitHub API path is not permitted`) |

This container **does** have a real browser, so the five gates that ship as CI
work (G5, G11, G12, G13, G17) were run locally here as well as in CI. It does
**not** have the live domain, so §11.6 deployment proof runs from GitHub
Actions — CI is the channel, exactly as the brief states.

---

## 3. The Apex Golf change set, derived by evidence

Identified by author/committer, date and branch — not by description.

```text
site#36  merge ceeb5bd763bfe545cc466f0ec80c0394cf098db5
         "Build Apex Golf (#36)"
         MattRoper1977 <londonmatt1977@hotmail.co.uk>, committer GitHub
         2026-08-04 12:41:02 +0100
BASE  =  be43939bfb1c7691e6a046391d741d87d4fdd2f4   (site#37, the original
         Sports renderer — stated once, never silently changed)
```

Files touched by `BASE → ceeb5bd`, 7 files, +1208 / −3:

| File | ± | Column |
|---|---|---|
| `apexgolf/index.html` | +542 | expected |
| `tools/verify_apexgolf.js` | +548 | expected |
| `.github/workflows/apexgolf-verify.yml` | +64 | expected |
| `sitemap.xml` | +6 | expected |
| `assets/cards/apex-golf.svg` | +41 | **IMPORTANT COLUMN** |
| `games/index.html` | 6 (3+/3−) | **IMPORTANT COLUMN** |
| `tools/verify_arcade_sports.js` | +4 | **IMPORTANT COLUMN** |

### 3.1 The zero-delta assertion (§11.2), by blob hash

```text
index.html   BASE 515809a540f55afc1cd89e8a50ddab20a7f7274e
             HEAD 515809a540f55afc1cd89e8a50ddab20a7f7274e   ZERO DELTA
site.json    BASE 9a3db29c5cfc87e83e9344d6eccffe6b5fc0f3ae
             HEAD 9a3db29c5cfc87e83e9344d6eccffe6b5fc0f3ae   ZERO DELTA
```

**Apex Golf's own commit touched neither `index.html` nor `site.json`.** The
D3 / §8.4 ruling held *at the moment Golf merged*. What happened to those two
files afterwards is a different question, and it is Finding **A-1**.

**`MattRoper1977/Lessons` untouched by this set** — no path in the change set
contains `Lessons`, no path contains `Apex_Golf`, and the Lessons repository
was not contacted in this pass.

### 3.2 What the important column actually did

`assets/cards/apex-golf.svg` — new shelf artwork, required by the mandatory
`art` field. Legitimate.

`games/index.html` — three lines: a CSS comment, the Sports rail grid from
`repeat(2,…)` to `repeat(3,…)`, and the section sub-heading from "Two Apex
games" to "Three Apex games". A **renderer** edit, in the site repository,
which is exactly the two-repository transform §8.3 describes.

`tools/verify_arcade_sports.js` — two new source checks and two new mutation
fixtures. Legitimate, and superseded since (see below).

### 3.3 Golf's arcade contract was later reversed — correctly

At `BASE`, the arcade renderer excluded Sports games from the whole shelf and
from TOP. Golf's harness therefore asserted `whole-shelf-excludes-sports` and
`top-picks-exclude-apex-kick`. **Matt's correction (site#39) reversed both.**

Measured at current HEAD: `tools/verify_arcade_sports.js` has been rewritten to
the corrected contract — `apex-kick-remains-in-top`,
`whole-shelf-uses-complete-manifest`, `total-count-derived-from-manifest` — and
runs **10/10 PASS**. Golf's superseded assertions are gone. No stale contract
survives. This is a clean supersession, not drift.

---

## 4. Position in history — the Golf merge is now an ancestor

```text
4afd3485  Build Biopunk Hive — Containment Lab            <- site main HEAD
6e8ab129  Join Apex Golf and Tennis to homepage Sports (#44)
edfe629   Join Apex Tennis to Arcade Sports (#43)
e6ee788   Build Apex Tennis (#41)
b37efe2   Publish Apex Pool as New Release … (#40)
0f1eb20   Restore Sports games to TOP and the whole shelf (#39)
ceeb5bd   Build Apex Golf (#36)                            <- the set under test
be43939   Render the Arcade Sports collection (#37)        <- BASE
```

The brief's expected head was `6e8ab129`. **The estate has moved on: main is
`4afd3485`** (the Biopunk landing, site#45). Per §11.8, the estate wins and the
disagreement is recorded rather than argued.

### 4.1 Derived check — did Apex Golf survive the later rewrites?

Re-derived, not inherited:

| Claim | Measured result |
|---|---|
| Still in the Arcade Sports rail | **YES** — rail renders 4 cards: Kick · Pool · Golf · Tennis |
| Still in the whole shelf | **YES** — `#allGrid` holds all 34 |
| `games.json` entry intact, `art` carried | **YES** — `art: /assets/cards/apex-golf.svg`, `collection: Sports`, `tag: Physics`, `hue: #7C5CFC` |
| Game file unchanged since its merge | **YES** — 64,513 bytes, blob `132034b7…` at both `ceeb5bd` and `4afd3485` |
| **Still absent from the homepage** | **NO — this is now FALSE.** See Finding A-1 |
