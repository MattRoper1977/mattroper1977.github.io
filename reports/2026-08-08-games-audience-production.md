# Made by Matt Games Hub + audience views — completion report

**Sentinel:** `mbm-games-audience-faces-2026-08-08`  
**Status:** CLOSED — merged, deployed and production-proved

## Games Hub

The previously inconsistent `/games/` surface now belongs visibly and behaviourally to the professional Made by Matt platform while retaining its playful, personally curated identity.

The upgrade preserves Matt's existing Games wording, the manifest-driven catalogue, the Made by Matt logo, established game URLs and every game runtime. It adds the shared platform shell, responsive polish, improved spacing and hierarchy, stronger filters and controls, and existing manifest artwork for all eight personal top picks.

The live catalogue continues to derive its current summary from the Games manifest: **13 curated favourites of 48 games**.

## Audience entry architecture

The new chooser is `/start/`. It offers seven optional views:

1. Pupils and learners
2. Teachers and support staff
3. Parents and carers
4. Schools and SEMH settings
5. Academy trusts and trusts
6. Councils and education organisations
7. Partners and businesses

The selection is presentation only. It stores a local `mbm_audience_view` preference, does not auto-redirect, does not create an account, does not join the mailing list and never locks content.

The pupil view deliberately suppresses adult account, registration and mailing controls. Adult views may present the real account, Members, mailing-list and privacy routes as optional facilities.

No testimonial, partnership, endorsement, client, accreditation, usage or organisational relationship was invented.

## Repository delivery

- Pull request: **#103**
- Release merge: `e4bff239c49012f41067c1313dc7a2f943923282`
- Merged: **8 August 2026 at 22:52 UTC**
- Permanent files changed: **19**
- Game runtime files changed: **0**
- Games manifest changes: **0**

A workflow YAML plain-scalar error was identified after merge and corrected at `5c9f7929dab1c3ef23ef1e311a939cff8fe24821`. The corrected permanent workflow completed successfully and remains as the regression gate.

## Premerge proof

Workflow run `31282502572` completed successfully.

- Static wording and route contract: PASS
- Positive control: PASS
- Games and chooser at 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS pixels: PASS
- Seven audience landing pages: PASS
- Pupil/adult boundary: PASS
- Navigation, touch targets and local preference: PASS
- Page, console and first-party request errors: 0

Retained artifact:

- `mbm-games-audience-preview-31282502572`
- Artifact ID `9028846431`
- SHA-256 `bd103ed76aeeae9e66541c395728f24e1e91d3f5a4258d67e20cf999b8746490`

## Deployment proof

GitHub Pages run `31282684248` built and deployed release merge `e4bff239c49012f41067c1313dc7a2f943923282` successfully. The existing professional live-verification run `31282684932` also passed.

A separate cache-busted route readback proved HTTP 200 for fourteen live surfaces: Home, Games, chooser, all seven audience pages, Lessons, Apps, Tools and Resources. All nine Games/audience release pages contained the release sentinel.

## Permanent production browser proof

Corrected permanent workflow run `31283310945` completed with all required jobs successful:

- `static-contract`: SUCCESS
- `browser-matrix`: SUCCESS
- `live-proof`: SUCCESS

The production browser evidence records:

- Eight widths: 320 through 1440 CSS pixels
- Games HTTP 200 at every width
- Chooser HTTP 200 at every width
- Horizontal overflow: 0
- Top picks: 8
- Loaded top-pick images: 8
- Audience choices: 7
- Audience pages: 7
- Priority cards per audience page: 3
- Visible adult links on the pupil view: 0
- Stored teacher preference and Continue route: correct
- Page errors: 0
- Console errors: 0
- Failed first-party requests: 0
- Bad first-party responses: 0

Retained production artifact:

- `mbm-games-audience-live-31283310945`
- Artifact ID `9029076267`
- SHA-256 `2f50cb6f6964ce22a18198dfd5b0327ba9bcaa75401c11e30b568b217187f900`
- Retained until 7 September 2026

Machine-readable evidence is stored in `reports/proofs/mbm-games-audience-production-2026-08-08.json`.
