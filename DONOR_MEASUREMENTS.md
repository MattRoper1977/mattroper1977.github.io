# Apex Pool donor and environment measurements

Measured 2026-08-04. This file is the downstream source of truth; baseline values from the build brief are not reused without a current observation.

## P0(a) environment probe

| Probe | Command | Measured result |
|---|---|---|
| Real browser | `timeout -k 2 12 /usr/bin/chromium --headless=new --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage --disable-background-networking --disable-extensions --mute-audio --dump-dom about:blank` | **BLOCKED / unusable.** Chromium is installed, but the command exited `124` after hanging. No DOM was returned. Stderr began `Failed to connect to the bus: Failed to connect to socket /run/dbus/system_bus_socket: No such file or directory` and `Could not parse server address: Unknown address type (examples of valid types are "tcp" and on UNIX "unix")`. |
| `file://` navigation | same Chromium flags against `file:///tmp/apexpool_probe.html` | **BLOCKED / unusable.** Exit `124`; no DOM; same DBus/address errors. |
| `localhost` navigation | `python3 -m http.server 8765 --bind 127.0.0.1` then same Chromium flags against `http://127.0.0.1:8765/apexpool_probe.html` | **BLOCKED / unusable.** Exit `124`; no DOM; same DBus/address errors. |
| Direct GitHub network | `curl -sI https://api.github.com` | Exit `6` (DNS/network unavailable). |
| Live site | `curl -sI https://madebymatt.uk/` | Exit `6`; therefore no HTTP status was claimed. |
| GitHub connector | `GitHub.get_repo({repository_full_name:"MattRoper1977/mattroper1977.github.io"})` and file fetches | **WORKS.** Repository metadata and files were read through the connector. |
| `ffmpeg` | `ffmpeg -version` | Present: `ffmpeg version 7.1.3-0+deb13u1`. |
| `ffprobe` | `ffprobe -version` | Present: `ffprobe version 7.1.3-0+deb13u1`. |
| Node | `node --version` | `v22.16.0`. |
| jsdom | `node -e "require('jsdom')"` | Absent: exit `1`, `MODULE_NOT_FOUND`. |

**Decision forced at P0:** local browser evidence is unavailable. `.github/workflows/apexpool-verify.yml` therefore installs Playwright Chromium and runs the render, interaction, storage-isolation, accessibility and viewport gates in GitHub Actions.

## Repository heads and drift

Measured through `GitHub.search_commits`, newest-first.

| Repository | Brief baseline | Current measured head | Drift |
|---|---:|---:|---|
| `MattRoper1977/mattroper1977.github.io` | `3264e6e` | `be3a468efb03ab29ffa39a2a6fd2f470745bd14a` | One documentation commit later. |
| `MattRoper1977/Lessons` | `10936b7` | `6aaffb7a07b23833719dd633ed184631c80bc432` | One documentation commit later. Lessons remains out of scope and untouched. |
| `MattRoper1977/Games` | `a9fdb56` expected by brief | `a51beda45e9d44b24778a65193aac8784855fb46` | Baseline did not match the current squash commit for Games PR #6. |

Branch-protection settings: **UNVERIFIED**. The available connector did not expose branch-protection rules; absence is not claimed.

## Apex Kick packaging donor

Source: `MattRoper1977/mattroper1977.github.io@main:apexkick/index.html`.

| Measurement | Command / method | Result |
|---|---|---|
| Total bytes | `wc -c apexkick/index.html` in `MattRoper1977/mattroper1977.github.io#33` Actions run `30870878876` | **`162122` bytes.** This supersedes the earlier historical `160805` figure; the CI runner measured the PR merge ref against current `main`. |
| Vendored dependency | source inspection | `vendor/three.min.js`. |
| Shared script | source inspection | `../assets/mbm-profile.js`. |
| Immediately before `</body>` | tail inspection | The closing inline game boot script: `if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0); else window.addEventListener('DOMContentLoaded', boot); })(); /* AK:GAME:END */ </script>`. |
| HUD/loader script | source inspection | No shared HUD/loader script. Loading UI is internal markup/CSS; only `mbm-profile.js` and vendored Three.js are separate scripts. |
| Contract check total | control-flow count on `tools/verify_apexkick.js` | **25 checks**: Kick Rating 5; unlucky marker 5; shipping contract 6; accessibility 7; offline 2. The failure-only diagnostic call inside the fuzz loop is not a passing check. |
| Current donor harness result | `node tools/verify_apexkick.js` in Actions run `30870878876` | **24 passed, 1 failed.** The current donor fails only `no-remote-resources`, which reports its absolute canonical/Open Graph URLs: `https://madebymatt.uk/apexkick/` and `https://madebymatt.uk/images/apexkick-hub.jpg`. This is recorded donor drift and does not gate Apex Pool. |
| Storage literals | source inspection | `apexkick.v1`; `apexkick.muted`. Signed-in saves may pass the slot through `MBMProfile.slot()`, but the donor's own literals are exactly those two. |
| Screen renderer | counted `screen(` call sites, excluding definition/comment | **7 rendered screen types**: title, awards, stadiums, squad, packs, pack opened, round result. Only title supplies `{ variant: 'title' }`; the other six use the base renderer. |
| Reduced motion | source search for `prefers-reduced-motion` | Three functional CSS blocks (score/wind, loader, splash), one functional JS `matchMedia` block for FX, plus one explanatory comment. |
| `<noscript>` | source inspection | Inline style hides `#mbmSplash`, preventing a no-JS splash trap. |

Packaging conclusion: Apex Pool mirrors the measured splash/no-script discipline but does **not** copy Three.js or invent a shared HUD loader. It remains Canvas 2D and dependency-free.

## Games shelf manifest

Source: `MattRoper1977/Games@main:games.json`, blob `6a47d5704abd3866e48c570cde336f2c267d1f21`.

- Entry count: **31**.
- Complete field set on the first entry: `icon`, `title`, `desc`, `href`, `tag`, `hue`, `featured`, `hero`, `art`.
- `art` occurrences associated with entries: **31**; every entry carries the field.
- Tag vocabulary and counts:

| Tag | Count | Tag | Count |
|---|---:|---|---:|
| Reflex | 8 | Physics | 5 |
| Class game | 4 | Strategy | 3 |
| Classic | 2 | Puzzle | 2 |
| Sandbox | 2 | Whodunnit | 1 |
| Rhythm | 1 | Hide & seek | 1 |
| Card battle | 1 | Calm | 1 |

The counts sum to 31. `Physics` is the existing vocabulary used for Apex Kick and is the selected Apex Pool shelf tag.

## `site.json` doors

Source: `MattRoper1977/mattroper1977.github.io@main:site.json`, blob `9a3db29c5cfc87e83e9344d6eccffe6b5fc0f3ae`.

`doors[]` count: **11**.

| # | Zone | Title | href | countKey | Art / image |
|---:|---|---|---|---|---|
| 1 | tools | UAS Register | `uas/` | `uas-register` | `art: uas-register` |
| 2 | tools | ASDAN Register | `asdan/` | `asdan-register` | `art: asdan-register` |
| 3 | games | Hold the Mark | `Lessons/Games/Hold_the_Mark.html` | `hold-the-mark` | `art: hold-the-mark` |
| 4 | games | Glitch Clash | `Lessons/Games/Glitch_Clash.html` | `glitch-clash` | `art: glitch-clash` |
| 5 | games | Apex Kick | `apexkick/` | `apex-kick` | `art: apex-kick` |
| 6 | lessons | Lesson Hub | `Lessons/` | `lesson-hub` | `image: images/lesson-hub-card.webp`, alt and 450×360 dimensions |
| 7 | lessons | ASDAN suite | `resources/?q=asdan` | `asdan-suite` | `art: asdan-suite` |
| 8 | lessons | Y4–6 Science | `resources/?subject=Primary%20Science` | `y4-6-science` | `art: y4-6-science` |
| 9 | lessons | Studio Suite | `Matt-s-Apps-/` | `studio-suite` | `art: studio-suite` |
| 10 | games | Voxel Frontier | `voxel/` | `voxel-frontier` | `art: voxel-frontier` |
| 11 | games | Medevac Frontier | `medevac/` | `medevac-frontier` | `art: medevac-frontier` |

Each door also has `desc`, `badgeIcon` and `badgeLabel`. The downloads roster mirrors the 11 current count keys.

## Homepage and collision measurement

Source: current site `index.html`.

- `#newrelease`: **Off-Brand — a whodunnit in the brand workshop**, July 2026, left border `#A78BFA`.
- Hardcoded `class="dx-prod"` card opens in markup: **0**. The search excluded CSS selector occurrences; door cards are painted into empty `data-zone` containers.
- Open PR writing any of `index.html`, `sitemap.xml`, `site.json`: **`MattRoper1977/mattroper1977.github.io#25` only**. It is open, held and reported not mergeable. Its changed-file list includes `index.html` but not `sitemap.xml` or `site.json`.
- Consequence: `index.html` is a collision zone and is not modified by Apex Pool. Shelf and door integration use their named manifests instead.

## Contamination report

No repository source or supplied Apex Pool material was treated as a prepared implementation. No `Apex_Pool/`, `ApexPool/`, Lessons copy, Lessons resource entry or source branch was used.
