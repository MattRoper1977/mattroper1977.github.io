# Made by Matt Play — coordinator handoff

Status: draft implementation under browser/media review. **Not merged, integrated or published.** [PR #264](https://github.com/MattRoper1977/mattroper1977.github.io/pull/264) is the review surface. Do not update publication pins from an intermediate head.

## Ownership and integration

The Education session remains the sole owner of shared builders, runtime/templates, catalogue sources/schema, account/privacy/statistics and release pins. This branch adds only `domain-split/play/**`, `reports/play-upgrade/**` and `.github/workflows/play-discovery-verify.yml`. The shared hook is an **unapplied** two-line `integration.patch`. Existing game files, HUD, splash suppression, storage formats and teaching resources are unchanged.

Reconcile current Education changes before integration. On 6 September, current accepted Site main was 1273a843b3511826ab969da20146b843c1dbf94e (Education PRs 263/265), with PR 266 at 88348deb5cb4c97335c85db9e51333528eb3760b still open. The exact two-line Play integration patch was tested in temporary copies against both and applies unchanged, preserving the newer Education search. Recheck this moving base at acceptance. The PR-triggered shared Domain split workflow currently expects the new Education check while checking out the older Play head; it fails on missing `check_education_separation.py` after its 69-payload separation check passes. Include the accepted Education changes during coordinator integration; do not remove or weaken that gate. Apply the Play-only commits, then `git apply --check reports/play-upgrade/integration.patch` and review/apply that patch. It calls the Play renderer after existing Play refresh and before existing usage injection, retaining inactive statistics and consent behavior. The renderer is release-blocked until the original logo is verified and six new clips are accepted. Do not remove that hold to publish a partial draft.

Review-only build (does not modify shared source):

```sh
python domain-split/play/prepare.py --lessons /path/to/pinned/Lessons --output /path/to/isolated/play-output
```

The new workflow assembles an isolated copy, runs the existing save-transfer verifier, records normal gameplay inputs in fresh Chrome profiles, exercises discovery and all 69 initial game surfaces, and retains source recordings and QA screenshots. It has no deployment permissions or release action. A successful capture step means recordings exist; it does not mark them visually accepted.

## Catalogue and features

The generated `data/domain-catalogue.json` remains the input record set. `data/source-manifests/games.json` stays byte-identical. Supplementary `domain-split/play/evidence.json` supplies route-keyed descriptions, genres, control evidence and real update dates; payload hashes prevent these claims silently surviving intervening game changes.

- 62 canonical catalogue entries, including four classroom games.
- Six additional classroom activities and one separate staff calibration activity.
- 69 unique discoverable payload routes, with original direct URLs.
- Search, eight genre groups, collection/control/player filters and useful empty/reset states.
- Favourites and recently opened lists use only `mbm_play_favourites_v1` and `mbm_play_recently_opened_v1`. The session browse snapshot uses `mbm_play_browse_position_v1`. Clear controls never enumerate/delete game storage or databases.
- Static direct links remain available without JavaScript. Menu uses native disclosure; game information uses a native modal with focus return.
- Report links prepare the existing email contact route with title and canonical game URL. No messages are sent during testing.
- Source-supported controls and modes are distinguished from unknown. They are not a claim of real-device/gamepad or two-device pairing verification. Same-network limits and shared-device distinctions remain visible.
- Recently updated entries are Emberwild's reviewed 4 September game release, Apex Kick's 4 September gameplay-control/rendering repairs and the 3 September addition of Skybreak. The redesign does not stamp every game as updated.

## Footage acceptance and preservation

Target showcases: Emberwild, Apex Kick, Voxel Frontier, Off-Brand, Lumins and Vector Overdrive: Nova Siege. Raw browser recordings stay separate from deployed MP4/poster assets. Only explicitly accepted media filenames with matching hashes are copied into the Play output. No old clips, generated video, animated stills, seeded victories or modified engines qualify as fresh footage.

Every accepted clip must contain source/build commit, route/payload SHA-256, UTC capture date, viewport/device, duration, action description and output hashes. Compare payload hashes again against final publication sources; recapture affected games when their gameplay changes. Real playback, time progression, seeking, pause and close must pass before publication.

`preservation.json` records 69 baseline payload byte matches, zero missing/external initial dependencies and 11 unchanged Education overlay files. The Education builder excludes `domain-split/**` and `reports/**`; this branch adds no Education asset, promotion, cache entry or service worker. The coordinator must still verify the full combined Education Site, Lessons and Apps outputs and finish its independent recreational-content cleanup.

## Exact known holds

1. The original circular metallic silver M badge remains unresolved. Current repository square/cream and mint-ring marks are not accepted substitutes. The review displays text branding while preserving all existing in-game splash marks unchanged. Supply the actual asset; record its source and SHA-256 in `domain-split/play/brand.json` as `verified-original` with a relative `file` path. Do not redraw, recolour or crop it from a concept.
2. Fresh media and browser/visual acceptance are in progress. Draft footage is not published automatically.
3. The coordinator has not accepted or applied this integration. No new live Play release exists. Final source pins and combined Education boundary require its review before the existing authorised publication workflow can run.

Use `https://www.madebymatt-play.uk/` as the existing user-facing origin. Bare-host values in legacy build configuration do not authorize an origin change. Do not alter DNS/Pages settings or assume saves move between origins. The existing game-save migration implementation and its tests remain intact.

## Smallest message to relay

“Play work is in Site PR #264. Please reconcile its final head with your Education work, review `reports/play-upgrade/HANDOFF.md` and the unapplied shared hook, and coordinate integration/publication only after the listed holds and final media/source checks pass.”
