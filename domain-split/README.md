# Made by Matt: education and games domain split

Purchased allocation: **education at https://madebymatt.uk** and **games at https://madebymatt-play.uk**. The games domain is owned by Matt at GoDaddy. The earlier reversed-domain proposal is superseded.

Status: recovered source and reviewable publication builders. **No live cutover or DNS change has occurred.** The original session stopped after its games build found a missing vendored script. That failure and the related dynamically loaded Three.js/A-Frame dependencies are repaired.

## Publications

`build_publications.py` assembles all 62 canonical games plus seven selected activities, their supporting files, a games-only home/search, separate staff training, privacy and game-save transfer pages. The game engines are preserved exactly except for measured first-party hostname replacements. The historical W7 census and source game files are unchanged. The canonical Games shelf JSON is copied byte-for-byte for existing mirror consumers.

`build_education.py` produces separate `education-site`, `education-lessons` and `education-apps` Pages trees from the existing source repositories. It runs after the existing source generators: publication filtering therefore survives source regeneration without hand-editing generator-owned front doors. The four rebuilt education entry pages replace the staged root/main/teacher/pupil pages. Other audience navigation and published discovery data are filtered. Source games stay in Git; published game routes become explicit move pages with a save-transfer route. Legacy game paths have declared destination mappings.

Teacher tools keep the same origin and paths. The V=I×R teacher companion, V=I×R pupil lesson and staff calibration remain educational resources; classification follows their authored purpose. Apps retains the four science investigations and programming studio; the recreational Voxel entry is removed from its education catalogue.

Game-save transfer is user initiated and local to the browser: explicit game storage keys, bounded Voxel world keys, named subtrees of shared game profiles, and the Touchline career database/store/slots. It excludes teacher records, class name selectors, account tokens and unspecified keys. Existing destination saves are kept by default. Optional replacement downloads a recovery copy first. Local-storage failure rolls back completed writes; Touchline writes use one transaction. Unusual historic formats are not claimed to be covered. The old origin's data is never deleted.

## Reproduce and verify

Use full source checkouts; sparse output is review-only and fails release verification.

```sh
python domain-split/build_publications.py --lessons /path/to/Lessons
python domain-split/check_preview.py
node domain-split/check_game_saves.cjs
python domain-split/build_education.py --lessons /path/to/Lessons --apps /path/to/Matt-s-Apps-
python domain-split/check_publications.py
```

The education builder uses lxml. `.github/workflows/domain-split-verify.yml` builds the four complete publication trees from pinned full source checkouts, runs separation checks, and retains a review artifact. It does not deploy or change Pages settings. Source heads, payload hashes, moved paths and file counts are included in the output reports.

Validation distinguishes file/link/data-boundary checks from browser/gameplay testing. A passing build is not a claim of a live split, complete browser testing, successful DNS or successful migration of actual browser data.

## Hosting handoff and release order

Use the existing Site, Lessons, Apps and Games repositories and their independent Pages publications. Adding a Lessons directory to the Site output does not override the separately served Lessons project site.

1. Complete the full-source CI review and save the exact approved publication revisions.
2. Prepare Games Pages to deploy the standalone games output and configure its custom domain as `madebymatt-play.uk` in GitHub Pages settings. The current connector cannot inspect or change Pages administration settings; writing a CNAME file alone is not proof of setup, particularly with Actions publishing.
3. Only after Games hosting is configured, replace GoDaddy's WebsiteBuilder apex A record with GitHub Pages' four apex A values: 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153. The `www` CNAME target is `mattroper1977.github.io`. Preserve unrelated DNS records. Verify HTTPS before moving the old front doors.
4. Publish the game-save export route at the existing origin and make its new-origin import counterpart available. Verify representative real saves before retirement of old payloads.
5. Configure the existing Site, Lessons and Apps Pages publications to use their filtered education outputs. Keep `madebymatt.uk`, `/Lessons/` and `/Matt-s-Apps-/` paths. This requires the respective Pages settings; the builder never disables a project site or replaces source lesson files.
6. Verify live education with the games origin blocked, game routes and redirects, teacher records, HTTPS, and offline downloads. Update live release verification for the new game origin as a declared release change, preserving the closed historical W7 evidence.

The existing live estate stays available until its replacement is verified. Roll back by restoring the former Pages publication settings and prior source/output revisions; no DNS change to madebymatt.uk is needed. Preserve old-origin browser data throughout.

## Other work

David's lesson packs and Lessons PR #327 belong to the paused Lessons lane and are not rebuilt or merged here. Refresh source pins after that work is published. No changes are made to the held Site PR #216, the held form activation PR #25, or game engines. Branch protection and required checks remain enabled.

## Authoritative setup references

- [GitHub: custom domains across repositories](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories)
- [GitHub: managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
