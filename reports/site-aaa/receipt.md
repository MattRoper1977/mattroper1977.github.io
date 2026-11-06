Existing education hub cards now share token-only surfaces, 18px body text, native primary links, 3px focus rings, 160ms hover and 180ms reveal motion. Reduced motion removes both effects; high-lumen and print hide decorative tile imagery. This is a draft for review; do not merge while the recorded publication blockers remain.

## Pages and renderers

`/`, `/main/`, `/for/teachers/`, `/for/pupils/`, `/for/parents-carers/`, `/for/schools-semh/`, `/for/trusts/`, `/for/partners/`, `/for/councils-organisations/`, `/education-hub/`, `/teach/`, `/stats/`, `/members/`, `/uas/`, `/evidence-binder/moderator-pro/`, `/privacy/`, `/mailing-list/`. The derived `/stats/on-this-device/` fallback inherits the source card styles. `/thanks/` stays plain and unchanged.

`tools/render_audience_homepages.py` and `tools/render_discovery_hubs.py` apply a shared presentation annotation pass and regenerate their own HTML. The publication navigation renderer applies that same pass to its separately assembled front doors. One existing starting tile moves below the short hero lead without duplication. Existing information/form panels adopt the tile surface tokens; their copy, forms and controls remain.

Protected home copy, pathway bylines, maker note, teacher title/safety copy and audience taglines remain verbatim and painted. Statistics stays within two taps, the recommended-lessons control remains, and the register exemption passes. Home money and off-origin automatic-request counts remain zero. No workflow, credential, game folder, game stub or estate-map change is included.

Gate maintenance is explicit: stale badge totals now equal the exact source-folder member count; the compact hero checks its existing starting tile while retaining artwork byte checks. The no-script journey retains its main-document response, full-load and destination checks. Temporary overlay fixtures work on this host; admission rejects directory reparse points before traversal and still hashes every file on every verification. The claims guard uses a portable file URL conversion. A two-pixel inherited footer target shortfall is corrected.

## Local gate results

| Gate | Result | One-line receipt |
|---|---|---|
| `python tools/render_audience_homepages.py --check` | PASS | Completed locally; assertions retained. |
| `python tools/render_discovery_hubs.py --check` | PASS | Completed locally; assertions retained. |
| `node tools/verify_audience_copy.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_claims_guard.mjs` | PASS | Completed locally; assertions retained. |
| `python tools/verify_design_inheritance.py` | PASS | Completed locally; assertions retained. |
| `python tools/verify_education_hub.py` | PASS | Completed locally; assertions retained. |
| `node tools/verify_highlumen_behaviour.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_surface_floor_control.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_search_prominence.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_stats_claim.mjs .` | PASS | Completed locally; assertions retained. |
| `node tools/verify_teach_task_filter.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_uas_register_exemption.mjs` | PASS | Completed locally; assertions retained. |
| `node tools/verify_professional_site.js` | PASS | Completed locally; assertions retained. |
| `python tools/verify_theme_parity.py --lessons $LESSONS --apps $APPS` | PASS | Completed locally; assertions retained. |
| `python tools/check_audience_accents.py` | PASS | Completed locally; assertions retained. |
| `python tools/check_education_hub_links.py` | PASS | Completed locally; assertions retained. |
| `python domain-split/check_ux2_home.py --self-test --lessons $LESSONS` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_ux2_education.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_shared_navigation.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_education_navigation.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_resource_discovery.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_audience_discovery.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_primary_discovery.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_print_navigation.cjs` | FAIL | 14/18; the same four native-toolbar cases fail on main. |
| `python domain-split/check_education_separation.py` | FAIL | Six installed-record comparisons fail identically on main. |
| `python domain-split/check_education_support.py` | PASS | Completed locally; assertions retained. |
| `python domain-split/check_publications.py` | PASS | Complete rebuilt publication, zero missing sources. |
| `node domain-split/check_stub_handoff.cjs` | PASS | Completed locally; assertions retained. |
| `node domain-split/check_hub_tiles.cjs` | PASS | 144 states; all existing card surfaces measured, 18px text floor, planted contrast defect rejected. |
| `domain-split/check_stub_handoff_browser.cjs` | PASS | Exact reviewed inactive fixture; preservation and planted corruption controls pass. |
| `domain-split/check_stub_handoff_live.cjs` | BLOCKED | Refused blocked provenance: the successful deployed receiver differs from the reviewed receiver. No live save journey ran. |
| `python domain-split/build_publications.py --lessons $LESSONS` | PASS | Completed locally; assertions retained. |
| `python domain-split/build_education.py --lessons $LESSONS --apps $APPS` | PASS | Completed locally; assertions retained. |
| `python domain-split/check_education_publication_admission.py --output domain-split/output --lessons $LESSONS --apps $APPS` | PASS | 55 controls; real PASS / planted FAIL / restored PASS. |
| `python domain-split/check_education_publication_admission.py --output $MAIN_BUILD --lessons $LESSONS --apps $APPS` | PASS | 55 controls; same transition registry admits main. |

The print and installed-record failures reproduce on the unchanged main build. The live gate fails closed because the successfully deployed receiver is not the reviewed receiver; game files remain untouched. The source task-link check passes pointer, keyboard and background-tab journeys after initial deep links use immediate scrolling.

## Measured contrast

Worst rendered text/background pair per page and theme, taking the lower result across 360px and 1280px. All measured tile text meets 7:1. Values are foreground / background RGB; plain content has no tile pair.

| Page | Theme | Worst pair | Ratio |
|---|---|---|---|
| `/` | cream | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/` | light | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/` | highlumen | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/main/` | cream | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/main/` | light | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/main/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/main/` | highlumen | rgb(22, 29, 61) / rgb(246, 241, 231) | 14.61:1 |
| `/for/pupils/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/pupils/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/pupils/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/pupils/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/teachers/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/teachers/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/teachers/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/teachers/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/parents-carers/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/parents-carers/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/parents-carers/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/parents-carers/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/schools-semh/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/schools-semh/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/schools-semh/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/schools-semh/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/trusts/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/trusts/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/trusts/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/trusts/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/councils-organisations/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/councils-organisations/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/councils-organisations/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/councils-organisations/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/partners/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/partners/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/for/partners/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/for/partners/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/education-hub/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/education-hub/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/education-hub/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/education-hub/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/teach/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/teach/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/teach/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/teach/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/stats/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/stats/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/stats/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/stats/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/members/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/members/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/members/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/members/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/uas/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/uas/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/uas/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/uas/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/evidence-binder/moderator-pro/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/evidence-binder/moderator-pro/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/evidence-binder/moderator-pro/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/evidence-binder/moderator-pro/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/privacy/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/privacy/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/privacy/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/privacy/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/mailing-list/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/mailing-list/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/mailing-list/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/mailing-list/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/thanks/` | cream | No existing cards | N/A |
| `/thanks/` | light | No existing cards | N/A |
| `/thanks/` | dark | No existing cards | N/A |
| `/thanks/` | highlumen | No existing cards | N/A |

## Admission transitions

The baseline was built at main `fb287c0c95e905e9ce32703e1a187dc5dfad2330`; current main `e90a1c2038a7ee822ca4041ae6097e248a86f427` changes only excluded admission metadata and has identical published bytes. Those updates are included in this draft. Teaching source `0948b50c862b5a07a3c5f951aed137f21dc3927e`, and application input `dd908441664339a27dc59f5bd0364024c7a1c231`. The 22 changed education-site outputs use `[main build digest, candidate build digest]`; no new published file requires an arrival marker. One review-source note is first in the registry. Two inherited site data rows retain a prior reviewed state plus the current main-input state. Concurrent teaching admissions from current main, including arrival markers, are preserved. Teaching and application output bytes are identical between main and candidate.

Full digests and the inherited-row census are in [admission-rows.json](https://github.com/MattRoper1977/mattroper1977.github.io/blob/codex/site-aaa-tiles/reports/site-aaa/admission-rows.json). Both full builds pass all 55 admission controls with the same registry.

| Education-site path | Main digest | Candidate digest |
|---|---|---|
| `assets/mbm-search.js` | `8afc452b8687` | `836d86ccb764` |
| `assets/mbm-tile.css` | `cf09c5987c9d` | `64df167ab6a7` |
| `assets/mbm-tile.js` | `ceb2a4ea36e6` | `f624a1dc3f12` |
| `assets/shared-navigation.css` | `e6e79a120f76` | `458962f08720` |
| `education-hub/index.html` | `fed134ffc158` | `1bb012aa71c5` |
| `evidence-binder/moderator-pro/index.html` | `7157e066a3c8` | `3609e9b1c9b9` |
| `for/councils-organisations/index.html` | `45b00cbe738a` | `32f5609b9493` |
| `for/parents-carers/index.html` | `4282b2165ac0` | `bd7cf5e39839` |
| `for/partners/index.html` | `6296c3f63855` | `8e9fafaf7dbd` |
| `for/pupils/index.html` | `98907da56438` | `3eaa07ee0129` |
| `for/schools-semh/index.html` | `7d990c347065` | `c69f16aa0319` |
| `for/teachers/index.html` | `3a3f91660eb4` | `54863edd980a` |
| `for/trusts/index.html` | `a32aff72db5d` | `de07bbc319e2` |
| `index.html` | `9495ac8392da` | `121b35d05298` |
| `mailing-list/index.html` | `f4004402a355` | `82a32dbefc9d` |
| `main/index.html` | `2838cc84c2e9` | `980ef763611e` |
| `members/index.html` | `6b94baea3ede` | `95d201ec6674` |
| `privacy/index.html` | `b9b1f06e73d4` | `77aa342e06d2` |
| `stats/index.html` | `94feaf54e081` | `cb4434b8019e` |
| `stats/on-this-device/index.html` | `ce1dcdd497d6` | `5b47052b049c` |
| `teach/index.html` | `276178e4e2db` | `f11f0fb540e3` |
| `uas/index.html` | `289102e64c31` | `5f3a172555ca` |

## Before / after

Screenshots are captured at 360×640 and 1280×800, on the same source inputs. The first tile is visible on all four phone captures and none scrolls horizontally.

| Page | Width | Before | After |
|---|---|---|---|
| `/` | 360px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/home-360-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/home-360-after.png) |
| `/` | 1280px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/home-1280-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/home-1280-after.png) |
| `/for/teachers/` | 360px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teachers-360-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teachers-360-after.png) |
| `/for/teachers/` | 1280px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teachers-1280-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teachers-1280-after.png) |
| `/education-hub/` | 360px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/education-hub-360-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/education-hub-360-after.png) |
| `/education-hub/` | 1280px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/education-hub-1280-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/education-hub-1280-after.png) |
| `/teach/` | 360px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teach-360-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teach-360-after.png) |
| `/teach/` | 1280px | ![Before](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teach-1280-before.png) | ![After](https://raw.githubusercontent.com/MattRoper1977/mattroper1977.github.io/refs/heads/codex/site-aaa-tiles/reports/site-aaa/screenshots/teach-1280-after.png) |
