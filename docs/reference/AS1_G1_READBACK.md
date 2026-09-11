AS1-G G1 — independent work, 2026-09-11
G1 belongs to draft Site #347. Runtime work is excluded and will have a separate PR.
Rollback before G1: de7dd6e7ee0fab7681491c861d5079c83038548f; Site main 85e3e02059c3e3314eddab03d6e3c842f0da7ec7. Lessons aad04718c11a2396ecf323a662f55bf0e0c2441b; Games809b6c9a65f175cd48182e793bee166ad4f6bd3f.
F-S1 was withdrawn by AS1-G. An inline pilot requires region reproduction; a shared pilot compares served hud.js with canonical source. The prior report is historical, not an active stop.
G1.1 fixed: extra EOF blank line removed from AS1_DEFECTS.md in commit bca01f985e49301be4432774bfaa6fcb15f69da3. The exact git diff --check control rejected a scratch extra EOF blank line (exit 2) and accepted its removal (exit 0).
G1.2 classifications: FILTER-DROPPED 0; ORIGIN-MISTARGETED 0; GENUINELY MISSING 7; OTHER 0.
GENUINELY MISSING uses Matt's AS1-G definition: the file should not be expected at that Play URL at all. It does not mean the original source file was deleted. All seven source blobs exist at pinned and current revisions. All seven are absent from the executed Play build at the wrongly assumed paths. Each original education URL serves its existing moved-page stub, and its existing Play destination returns 200. None is a non-route asset. None is a request for a game engine remaining on education. No served URL is added, removed, renamed or redirected by this repair.
Source: Lessons / 5_6 Local Choice/Trekkers_Trail_Runner (2).html
Delivery: shared_src
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/Lessons/5_6%20Local%20Choice/Trekkers_Trail_Runner%20%282%29.html
Expected historical served URL: https://madebymatt.uk/Lessons/5_6%20Local%20Choice/Trekkers_Trail_Runner%20%282%29.html
Existing destination: https://www.madebymatt-play.uk/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Lessons / Games/Off_Brand.html
Delivery: inline_copy
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/Lessons/Games/Off_Brand.html
Expected historical served URL: https://madebymatt.uk/Lessons/Games/Off_Brand.html
Existing destination: https://www.madebymatt-play.uk/offbrand/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Lessons / Games/Trail_Runner.html
Delivery: shared_src
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/Lessons/Games/Trail_Runner.html
Expected historical served URL: https://madebymatt.uk/Lessons/Games/Trail_Runner.html
Existing destination: https://www.madebymatt-play.uk/trailrunner/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Lessons / Games/Voxel_Frontier.html
Delivery: shared_src
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/Lessons/Games/Voxel_Frontier.html
Expected historical served URL: https://madebymatt.uk/Lessons/Games/Voxel_Frontier.html
Existing destination: https://www.madebymatt-play.uk/voxel/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Site / experiences/medevac-frontier/index.html
Delivery: none
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/experiences/medevac-frontier/
Expected historical served URL: https://madebymatt.uk/experiences/medevac-frontier/
Existing destination: https://www.madebymatt-play.uk/medevac/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Site / next/games.html
Delivery: none
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/next/games.html
Expected historical served URL: https://madebymatt.uk/next/games.html
Existing destination: https://www.madebymatt-play.uk/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
Source: Site / resources/medevac-frontier/index.html
Delivery: none
Prior census expected URL (incorrect expectation): https://www.madebymatt-play.uk/resources/medevac-frontier/
Expected historical served URL: https://madebymatt.uk/resources/medevac-frontier/
Existing destination: https://www.madebymatt-play.uk/medevac/
Classification: GENUINELY MISSING at the prior Play URL; original 200, destination 200. Receipt mutation to destination 404 RED; restored GREEN.
G1.3 route repairs: zero required. This corrects the AS1 report's expectation; no live route is changed. G-S1 not hit.
G1.4 root assets: publisher now consumes an explicit destination-to-source registry at domain-split/play/root-assets.json. It preserves the five existing root files and adds Play's own site.webmanifest at /site.webmanifest. No extension pattern was widened. Removing site.webmanifest from the registry makes the emitted-file validator RED; restoration GREEN. Removing the homepage link separately RED; restoration GREEN.
G1.5 manifest: name Made by Matt Play; short name Matt Play; id/start_url/scope /; display standalone; theme/background #081422 from Play's --bg; existing 192 and 512 PNG paths with decoded dimensions checked. No shortcuts, service worker, precache or new offline promise. Homepage and its existing generated aliases link /site.webmanifest.
Icon residue: existing repository icons are cream M/navy, visually inspected; the approved-mark file is cream M/mint/amber. Searches of current sources and saved-file results did not locate an original metallic silver asset. No new logo was drawn and no icon bytes were replaced. This manifest retains the existing files, but does not satisfy or claim the requested silver identity. Draft review remains necessary; no installability result claimed.
The full publisher completed before and after: 69 payloads, 471 then 472 files, zero missing/external initial-load references. Only the new root manifest and six existing homepage aliases differ in Play output; all game payload hashes remain unchanged. No education homepage source was edited. The education manifest-link handoff remains in AS1_EDUCATION_DECISIONS.md.
G1.6 individually assessed head failures follow. Exact API/log observations are retained; a check without a reproduced firing control is labelled individually, not hidden by an aggregate verdict.
OWNED / professional-site-design-audit.yml / verify / job103325063839: extra EOF blank line; fixed bca01f985e49; firing control RED/GREEN as above. New head initially had six successes and two pending, no failed verdict.
ELSEWHERE / mbm-deployment-provenance.yml / The origin is serving the commit we think it is / job102551636822: missing data/estate-map.json publication witness. Owner: domain-split publication/provenance work. MEASUREMENT INVALID: this job's firing control not rerun here; exact failure log remains an observation.
ELSEWHERE / maker-splash-canon-verify.yml / Generator controls, SS1–SS8, and Site routes / job102551636826: same missing estate-map witness after splash controls pass. Owner: domain-split publication/provenance work. MEASUREMENT INVALID: job firing control not rerun here.
ELSEWHERE / echovault-surfaces-verify.yml / whole-shelf render check against the served page / job102551637159: Missing current shelf control #group. Owner: EchoVault shelf/domain-split verification work. MEASUREMENT INVALID: job firing control not rerun here.
ELSEWHERE / relicforge-surfaces-verify.yml / whole-shelf render check against the served page / job102551638987: Missing current shelf control #group. Owner: Relicforge shelf/domain-split verification work. MEASUREMENT INVALID: job firing control not rerun here.
ELSEWHERE / townlife-verify.yml / Final bytes in Chromium, Firefox and WebKit / job102554531207: education /Games/games.json leads to Play and triggers RouteMovedError. Owner: Town Life/domain-split verification work. MEASUREMENT INVALID: job firing control not rerun here.
UNRELATED / townlife-verify.yml / Serial comparative and splash performance / job102549333855: 18.4162 to17.4843fps, below17.4954minimum; nine negative paired deltas. Owner: pre-existing Town Life performance work. MEASUREMENT INVALID: timing failure control not rerun here.
The older serve-witness failure102865867811 is superseded by successful103257839585 on the same Site head; it is not an additional current failure. Lessons head has26successes. Cancelled professional-site-live-verify is separately non-green, not a failed verdict. The previously cited apexpool latest main run34366907929 is successful; it is not a standing red in this snapshot.
G1.7 vacuity: the Apex Sports workflow documents that its main-push preservation legs compare a tree with itself, hence provide no change-preservation evidence. That is a limited vacuous preservation comparison, not proof that the whole workflow is vacuous; independent structure and planted-family gates remain. No absence-vacuous whole check was confirmed. Absence mutation for the broader estate was not run; that measurement is UNMEASURED. No such gate was repaired or disabled.
G1.8 independent review output is packaged by AS1 independent Play publication checks. No publication pin changed; Games#78/#79 remain owned and untouched. No merge or live deployment claimed. No game file was edited by G1.

Output preservation note: one intermediate comparison saw host-replacement differences despite matching build-report hashes. The cause was not established. A fresh complete rebuild and immediate file comparison agree: only the manifest and six homepage aliases differ; no game payload differs. No intermediate tree was published.
