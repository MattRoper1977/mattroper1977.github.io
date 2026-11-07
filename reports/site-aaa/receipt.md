360 px follow-up: `.dx-updacts > a.dx-chip.dx-main[data-mbm-tile]` exceeded its row because its label could not wrap. Tiles now use `max-width:100%` and `white-space:normal`, keeping their border and padding inside the container. The unchanged publication browser check passes 49/49; the unchanged surface check passes 5/5, including 360, 768 and 1200 px. A full element walk at 360x640 passes with scripting on and off across the default and four alternate fallback fonts.

The tile update preserves the protected release region and restores every existing check and the search file exactly to current main. The added tile census is standalone. No merge is requested.

The tile script enables only reveal motion. With scripting off, tiles stay still and native links work. Hover remains 160ms with a 2px lift; reveal is 180ms when enabled, with both removed for reduced motion. The approved hero artwork stays visible in its compact header. Decorative arrows occur once per tile.

## Pages and renderers

`/`, `/main/`, the seven `/for/` audience pages, `/education-hub/`, `/teach/`, `/stats/`, `/members/`, `/uas/`, `/evidence-binder/moderator-pro/`, `/privacy/`, and `/mailing-list/` use the shared tile tokens. The derived `/stats/on-this-device/` page is included in the census. `/thanks/` remains plain.

The audience and discovery renderers use `domain-split/hub_tiles.py`; the publication navigation renderer applies the same annotation. Audience routes derive from their existing record. The entire protected release section is excluded, including its chip links. Both renderers pass their own checks.

Protected copy, pathway bylines, audience taglines, teacher title and safety line remain verbatim. The maker note has a visible nonzero box. Statistics remains within two taps; the recommended control and register exemption remain. Home money and off-origin automatic-request counts are zero.

## Publication inputs and remaining limits

Fresh unchanged main `e90a1c2038a7ee822ca4041ae6097e248a86f427` and the branch use the current publication inputs: teaching pin `9b2d03bb685bdf750d649add949e6d02097dca38`, application pin `dd908441664339a27dc59f5bd0364024c7a1c231`. Both real all-file admission checks pass. Host adapters outside the repository normalize file ordering, path handling and newlines; no existing check code changes.

A separate build with latest teaching main `a47cf3869ec4192b2bc1ca63199d9b161cde7896` still fails admission only on the two home pages because it produces different byte states. The two-entry rule retains the current pinned main build plus the reviewed branch build. The two arriving asset rows retain their marker. Workflow inputs and unrelated admission rows remain unchanged. Keep this draft unmerged while that alternate-input difference remains.

The home self-test and admission mutation controls cannot finish because this host cannot create their symbolic-link fixtures. The original checks remain intact. Live handoff remains blocked by a receiver-byte mismatch.

## Local gate results

`$PIN` is the unchanged publication teaching pin; `$LATEST` is latest teaching main; `$APPS` is the fixed application source above.

| Gate | Result | One-line result |
|---|---|---|
| `python tools/render_audience_homepages.py --check` | PASS | Completed locally with the original assertions. |
| `python tools/render_discovery_hubs.py --check` | PASS | Completed locally with the original assertions. |
| `node tools/verify_audience_copy.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_claims_guard.mjs` | PASS | Completed locally with the original assertions. |
| `python tools/verify_design_inheritance.py` | PASS | Completed locally with the original assertions. |
| `python tools/verify_education_hub.py` | PASS | Completed locally with the original assertions. |
| `node tools/verify_highlumen_behaviour.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_surface_floor_control.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_search_prominence.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_stats_claim.mjs .` | PASS | Completed locally with the original assertions. |
| `node tools/verify_teach_task_filter.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_uas_register_exemption.mjs` | PASS | Completed locally with the original assertions. |
| `node tools/verify_professional_site.js` | PASS | Completed locally with the original assertions. |
| `python tools/verify_theme_parity.py --lessons $LATEST --apps $APPS` | PASS | Completed locally with the original assertions. |
| `python tools/check_audience_accents.py` | PASS | Completed locally with the original assertions. |
| `python tools/check_education_hub_links.py` | PASS | Completed locally with the original assertions. |
| `node domain-split/check_shared_navigation.cjs` | PASS | Completed locally with the original assertions. |
| `node domain-split/check_education_navigation.cjs` | PASS | Completed locally with the original assertions. |
| `node domain-split/check_resource_discovery.cjs` | PASS | Completed locally with the original assertions. |
| `node domain-split/check_audience_discovery.cjs` | PASS | 20/20 audience cases; 35 local destinations. |
| `node domain-split/check_primary_discovery.cjs` | PASS | 9/9 cases; zero page errors. |
| `node domain-split/check_print_navigation.cjs` | PASS | 18/18; native toolbar, compact viewport and print-media journeys pass. |
| `python domain-split/check_education_separation.py --output domain-split/output` | PASS | Complete emitted education walk; zero failures. |
| `python domain-split/check_education_support.py` | PASS | Zero support references on counted pupil routes; planted footer rejected. |
| `python domain-split/check_publications.py` | PASS | Complete publication; zero initial requests to the games origin. |
| `node domain-split/check_stub_handoff.cjs` | PASS | Completed locally with the original assertions. |
| `node domain-split/check_ux2_education.cjs` | PASS | 29/29, including original hero, fixed badge-count and no-script navigation assertions. |
| `python domain-split/check_ux2_home.py --self-test --lessons $PIN` | BLOCKED | Unchanged fixture requires symbolic-link privileges unavailable on this host. |
| `node tools/verify_teach_task_filter.mjs --self-test` | PASS | Suppressed reveal is detected while URL, task and results remain valid. |
| `python tools/census_typed_literals.py --gate .` | PASS | Zero live unbound values; audience routes derive from the existing record. |
| `python tools/verify_apextennis_home.py [current-main baseline]` | PASS | 56/56; both protected non-occupant blocks match current main. |
| `node tools/verify_apexrally_surfaces.js` | PASS | 5/5; zero horizontal overflow at 360, 768 and 1200 px. |
| `python domain-split/build_publications.py --lessons $PIN` | PASS | Complete build; zero external initial-load references. |
| `python domain-split/build_education.py --lessons $PIN --apps $APPS` | PASS | Complete build passes all-file admission; zero missing source files. |
| `python domain-split/education_publication_admission.py --output $MAIN_BUILD` | PASS | Unchanged current main passes all-file admission on the publication inputs. |
| `python domain-split/education_publication_admission.py --output domain-split/output` | PASS | This branch passes all-file admission on the same publication inputs. |
| `python domain-split/check_education_publication_admission.py --output $MAIN_BUILD --lessons $PIN --apps $APPS` | BLOCKED | Real admission passes; unchanged mutation test stops at symbolic-link fixture privilege error. |
| `python domain-split/check_education_publication_admission.py --output domain-split/output --lessons $PIN --apps $APPS` | BLOCKED | Real admission passes; unchanged mutation test stops at symbolic-link fixture privilege error. |
| `node domain-split/check_stub_handoff_browser.cjs $REVIEWED_FIXTURE $EVIDENCE` | PASS | Reviewed inactive fixture; real pass, planted failures and restored pass. |
| `node domain-split/check_stub_handoff_live.cjs $BOUND_RECEIPT $EVIDENCE` | BLOCKED | Published receiver differs from reviewed bytes; blocked provenance is rejected before any live save journey. |
| `python domain-split/build_publications.py --lessons $LATEST --output $LATEST_BUILD` | PASS | Separate latest-teaching-main build completed. |
| `python domain-split/build_education.py --lessons $LATEST --apps $APPS --output $LATEST_BUILD` | FAIL | Only index.html and main/index.html differ from the two admitted publication-input states. |
| `node domain-split/check_hub_tiles.cjs` | PASS | 152 states; 18px text floor, at least 7:1, no overflow, planted contrast defect rejected. |
| `byte comparison against origin/main` | PASS | Seven existing check files and search file match exactly; rejected helper removed. |
| `git diff --check origin/main...HEAD` | PASS | Complete proposed patch has no whitespace errors; changed text is committed with LF. |

## Measured contrast

Worst rendered text/background pair per page and theme, taking the lower measurement across 360px and 1280px. All measured tile text meets 7:1.

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
| `/stats/on-this-device/` | cream | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/stats/on-this-device/` | light | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
| `/stats/on-this-device/` | dark | rgb(243, 247, 250) / rgb(17, 34, 55) | 14.91:1 |
| `/stats/on-this-device/` | highlumen | rgb(22, 29, 61) / rgb(255, 255, 255) | 16.44:1 |
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

Only these 21 changed publication paths move. For ordinary rows the admitted pair is `[main built, branch built]`; the two asset rows marked arriving use `[branch built, "ARRIVING"]`. The search row, both discovery-data rows and every other lane stay byte-identical to main.

| Path | Main built | Branch built | Retired entry | Why it left |
|---|---|---|---|---|
| `assets/mbm-tile.css` | `cf09c5987c9de5c393d4f179d1e46b13315ea3292b17250ce6fbabb547355a11` | `1323fed35d597b4799b910ac282d0f4ab60ec56bdf6c70d0c502c6eefa578d64` | `cf09c5987c9de5c393d4f179d1e46b13315ea3292b17250ce6fbabb547355a11` | ARRIVING retained; the previous asset version is not built once this lands. |
| `assets/mbm-tile.js` | `ceb2a4ea36e6a43348e29404111e1b02cfb8e656f002fcf0ed9e36759e4f8859` | `821dad6914471686abf930d243f35df26b3f437c512998524e92052e56231694` | `ceb2a4ea36e6a43348e29404111e1b02cfb8e656f002fcf0ed9e36759e4f8859` | ARRIVING retained; the previous asset version is not built once this lands. |
| `assets/shared-navigation.css` | `e6e79a120f762ed65369f839a6d3786d6fdfdb8a60a5788dcbe7b783b224b0cf` | `ae5d8c6ac4290c86043797db0a4a1307cfe10057da9e3e9883c3e127535a9fd7` | `fc325e5ae38315f21a571a5db0538013a093abf21b59ced8d9d1ce4824d4fd98` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `education-hub/index.html` | `fed134ffc158699768fad0c3efe0e58be3409a5ccbf5c547a667f48fab317444` | `1bb012aa71c54f8092f4dacdfada90cb6deb9e6f67a53ecfa0edf4d23084ccf8` | `4266dd62ec40c88ef1364090ad931152819cc47ae501c6e9e2d9de58ad4e43d5` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `evidence-binder/moderator-pro/index.html` | `7157e066a3c85bcf49698b5f416ed4f0322c445c3c10a4e1de789704a035f92d` | `3609e9b1c9b92740a0e4fb2cbac1a2ced4feaca04be17812888c0cef882237c4` | `0d6f411ed7a9dfc3f16313db7ff4ee8f977659b03bedb0f7761527665b143261` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/councils-organisations/index.html` | `45b00cbe738a6db82fb396a1e25eebbc313e9937fb18089339927305bdc9acef` | `32f5609b949363f7055e9252d1f36d25aa87adcf6d8b315ea829dfce4f2f9915` | `9769aea81caa6310c08ce75447276ed1e00db5f0fa924e9350f50a10d66ea4a2` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/parents-carers/index.html` | `4282b2165ac0771110353ecd558546568e8587fc9a8837ae08d81021656746e0` | `bd7cf5e398393cdc30794dba66b644f1547e1d47282f09955fe17eb857abe8af` | `ee3491d9a6959ebffd61a5fca4a1446f507f13f70d8770c3be16ee5a7125c39c` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/partners/index.html` | `6296c3f63855550a4af51bf07d6c0df64b7b52bf32f40afb1aba3da0f0496627` | `8e9fafaf7dbd3580c042f9b848b0e2bf8154cdc66f6fdc2ba6a507a63ba2d30a` | `0a520b393c302ffaae0312910985a5398677b759d8a42cb3211534541c0abf1a` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/pupils/index.html` | `98907da564387f0997d13f9e4fd2f3e633a5900bf935e4de8a9fdf9f45e21755` | `3eaa07ee0129a6b96ef7864b4f75a0e00011ff6b338bd331092598e7a79d65c6` | `a9eab85a4d8f2b9d9ac310ac6462062367ef41e99a88594411f70f1b8b7ac296` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/schools-semh/index.html` | `7d990c3470652141692abbfeeb1a714878b0f01a8b1f2264ea6a6d5d2d54356e` | `c69f16aa03197f0c611c0ce584feae4610c6c01eada02773908dce1b5eba9fa1` | `00e7dbf94859c84190a930635031c0e9f8c42a65f53d48369867c7448ca18897` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/teachers/index.html` | `3a3f91660eb48a03258a36bf4f3f4bb03624435f010c9ace0c8b87d253b18fbc` | `54863edd980a38b27a15fe98e6d6894898b97749f8cd68e04594e3bd894f30b0` | `2459ea6f4193dd5fbcca0482277fdc1aff52091cdde53ef703a01b206cc6f4cd` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `for/trusts/index.html` | `a32aff72db5d0269479e94d8f09cd07bb8f6f58a512a2865de11119d7fd657cf` | `de07bbc319e228fc864b66fd4338418ad7253941ec5228a16955cfc0229f1016` | `3a32841f8532589331fb2cbe07a496fdebab67677ebdf7e8311f040c0783d0c0` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `index.html` | `408a4beeab527da3b319d795c3452a8d52e14baec167d02bbff7c133e71060e0` | `67014672328214beb430a48f032b8708a49ff65adb01a80e3e2d537a28575b21` | `9495ac8392da66a4f582e607252eafa30cdf54796c3205b3709d590a925249d6` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `mailing-list/index.html` | `f4004402a355b897649a8dc3d7272dabd18bf481a1268c5a55132dfa668ef413` | `82a32dbefc9d7175cc47fead1ed5606964e2bd6b01c0781c778320c5e532ba7c` | `c6d4bb438445ef8c9023fbf023577f8b0cdbbbf19cae34434537c06c531d12e0` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `main/index.html` | `67641513920f2fce8677e4550042ba708742bfb75a25e5fef29c1e875d4d162b` | `3fd258bbf8a3727989e5ac1c4f5daee9af25137365ffab75cb5520c5237b9d8e` | `2838cc84c2e9b89bae5f1c078696da8dc8c55b1c43491147979ca80de2533d7b` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `members/index.html` | `6b94baea3edef1fb2b97cab54c973c0208712ee06508c1c78c291c3b6db472ab` | `95d201ec6674b8f06ece074fc5f9a30f11320da8dbbb7971727d2fea1683ed73` | `10dcc50ee749d2b2d91ac6449ef8e941cd5bb8387a5374e8d69f0988a55c7eb0` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `privacy/index.html` | `b9b1f06e73d44a30ae95a6fefbe1b065b823cb08b20222de185c4ae8bee1569f` | `77aa342e06d22ebf352d5c4cea0e2c1401390fc7c0429c485adfd6490dd5bae2` | `83cfdf7b7674b86b9e52f080fcfe703ef6fc77edf76e86a993bdf133f121c6e2` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `stats/index.html` | `94feaf54e081c4539e8779b0756a342443c4b768d554fc9c80e780ae74005c31` | `cb4434b8019ef5cb499b6c6470274bc9a0524c1585cf9bc590bb2d8f2601acb6` | `5e528030dc87065001697b903d0760e6535421d00b1f30b9fb56dba66b4dd48e` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `stats/on-this-device/index.html` | `ce1dcdd497d604c4df3dbe43227717bb4b52e3382c6d6de9561cadd1217e572a` | `5b47052b049c310a68cf039cb544aa4f221dcb6c0678844011970aab98f82fcd` | `4cadfbb04da17271b1a2cf8578ceb9d9bae556431b975a7aa8f9a9730b104c73` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `teach/index.html` | `276178e4e2dbe0ddf5664e7642f7e00cdba2058c0127edc9567183a212f37e88` | `f11f0fb540e3cf71fa52c70911f01549716e7aa92da33e41ab87d72811b74d7f` | `189e877ff0350971b600f001c1712b6bc477356b3791f2d29064ba39cc900fe9` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |
| `uas/index.html` | `289102e64c31170ca8dadeea0f4af47fe744ea3cc56d5c1036fc2a5d6ebcfd6c` | `5f3a172555ca70b3e7a35b8b37472a78afe1f00adb385ab094c2c7e46b170f49` | `831d9eb8586ef6d54aabf0b0b6e728a2d70a0de9b0c08642b0ee864bcf377d41` | Current pinned main build retained; superseded entry is not built by that publication or once this lands. |

## Screenshot pairs

360×640 and 1280×800 on identical publication inputs. The first tile is visible in each phone capture; no horizontal overflow occurs.

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
