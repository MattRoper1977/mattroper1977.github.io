# Made by Matt: separate education and games sites

Status: working design preview and migration preparation. **Not deployed.**

Matt requested two separate domains on 5 September 2026, with reconstructed
teacher and pupil homepages. The proposed allocation keeps games at
`https://madebymatt.uk` and places education at a second, as-yet unnamed domain.
The second domain and its DNS access are necessary inputs for the actual move.
This draft does not assume that a subdomain is equivalent to a second registered
domain, purchase a domain, or change any DNS or Pages settings.

## What is implemented

- One self-contained, accessible HTML preview with four working views:
  education home, teacher homepage, pupil homepage and games home.
- Separate search populations: education, pupil learning and the existing
  games shelf. Games are excluded from the education preview by their catalogue
  category and game-route ownership, including legacy `/Lessons/Games/` URLs.
- Pupil links start with subjects and the teacher-selected pathway. Existing
  `safeForPupils` catalogue metadata determines pupil search inclusion.
- BUILD, GROW and LAUNCH links use the Science navigation in Lessons commit
  `ccbe7a8bd70692fbf5a6c5352c7bf823c54f463f`, which contains merged PR #326.
- Existing official branding and existing lesson/game artwork are embedded;
  the preview needs no network requests to render or search.
- A route review file accounts for every record in the current Site search
  index and declares its proposed destination or required review. This is a
  discovery inventory, **not** a full file or runtime-dependency census.

The preview explicitly says that resource and play links open today's live
website. It is not evidence that the sites are separated, that all assets are
migrated, or that school filtering has been tested.

At the pinned source, all 747 discovery records have a review decision:
73 games records (including the games hub), 671 education candidates and
3 mixed hubs requiring review. The pupil preview searches 563 learning records;
the games preview searches the 62-entry canonical shelf. These populations have
different purposes and do not redefine the previously frozen W7 route count.
Static checks passed for all four views, unique IDs, every catalogue decision,
the separated search sets, local embedded assets and JavaScript syntax. Browser
and live-site testing remain outstanding. Generated preview/review outputs are
ignored by Git; their reproducible sources are committed here.

## Reproduce

From a checkout of the Site repository:

```sh
python3 domain-split/build_preview.py
python3 domain-split/check_preview.py
```

Open `domain-split/preview.html`. Source catalogue hashes, population counts,
preview hash and route decisions are written to `domain-split/review.json`.
The builder touches only files under `domain-split/`. It does not modify the
live homepage generators, manifests, payloads or workflows.

## Integration with the other job

This is an isolated draft on `codex/education-domain-split-2026-09-05` in
`MattRoper1977/mattroper1977.github.io`. It does not claim the Lessons repository.
The observed Site base is `bb5f97a2f185aa603cc394d0a3ddbd16ceab72ad`.
The observed Lessons main is `ccbe7a8bd70692fbf5a6c5352c7bf823c54f463f`.
The latter's commit records completed downloads/Science navigation and says
catalogue publication remains a separate transaction. No claim is made about
unpublished work in another chat or its current execution state.

The implementation owner should take the **latest completed** Science and
Humanities work as source when building the education distribution. Do not
replace or re-author David's packs here. Do not copy the currently older Site
catalogue snapshot over a newer source catalogue. Preserve existing held PRs,
game engines, accessibility contracts and W7's closed historical baseline.

## Work still required for a complete split

1. Record the second education domain selected/owned by Matt and the DNS
   provider. Confirm that the existing domain is to retain the games. Keep
   `education_origin` null until the hostname is known and under Matt's control.
2. Take fresh, pinned source snapshots after the active lesson changes land.
   Map every published file, including unlisted legacy routes, and audit the
   actual runtime asset/dependency graph. The preview catalogue is not enough.
3. Build independent education and games publication roots. Education must
   contain the lessons, reviewed educational apps/tools and their required
   fonts, scripts, images and downloads. Keep the existing lesson subpaths to
   minimise broken links. Omit the game payloads from the education publication,
   including games currently stored inside Lessons or Apps repositories.
4. Adapt the repository-owned audience/discovery generators, search data,
   shared navigation/HUD, audience preference, recently visited links, sitemap,
   robots file, manifest and metadata for each distribution. Serve the correct
   education HTML without needing JavaScript to hide games. Review other
   audience pages rather than leaving routes back to the mixed homepage.
   Teaching simulations should be reviewed by purpose; do not remove an
   educational resource merely because its title uses the word "game".
5. Reuse current teacher-tool/account functionality deliberately. Browser data
   is scoped to an origin, so local registers and evidence do not automatically
   appear at a new domain. Keep existing tools available until their existing
   export/import path is verified; do not silently redirect users away from
   local records. Keeping games on madebymatt.uk avoids moving their save origin.
   Review any existing account return URLs and adult-only presentation before
   adding those features to the education copy. The preview adds no login,
   mailing form, analytics or storage migration.
6. Use two actual hosting configurations. A second DNS name pointing at the
   same mixed published tree is not this split. GitHub project Pages inherit
   the user-site domain by default; an independently served education build
   needs its own custom-domain configuration. Select the hosting arrangement
   only after the content distribution and domain access are known.
7. Prepare explicit old-to-new lesson redirects, preserving path/query/hash
   where supported, and audit backlinks. Never redirect the new education site
   through the games origin. Inspect shared assets for requests to the old
   domain and remove required first-party dependencies on it. Do not enable
   redirects for record-bearing tools until the data transition is settled.
8. Validate representative real lessons, print/download routes, teacher tools,
   pupil flows and all resource links against the two completed distributions.
   Test education with the games origin blocked, review redirects and 404s,
   and check target-host HTTPS. Browser QA has not been run on this preview.
9. Configure the owned second domain, publish the verified distributions and
   check the actual URLs. Only then change the current public front doors.
   Keep a rollback to the previous source, hosting and DNS configuration.
   Ask school IT to classify/allow the education domain; a new domain is not
   a guarantee of automatic access through every school filter.

No production cutover, DNS purchase, complete payload migration, live filtering
proof, or communication with another chat has been performed by this draft.

## Technical references

- [GitHub: custom domains across repositories](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories)
- [GitHub: configure a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Smoothwall: domain and subdomain filtering](https://kb.smoothwall.com/hc/en-us/articles/15768636061980-URL-or-domain-filtering-to-block-or-allow-access-to-websites)
- [MDN: browser storage belongs to an origin](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
