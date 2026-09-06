# HC3 save recovery checkpoint

Baseline: Site `c161cc8087010036d569953611a2c70dc996842f` (subsequently merged by #279 as `cd7c0568865c44300a2a8c8de10512af9d982165`), Lessons `ae2d534b095423716aa1adaecc36299ba1210b23`. Game bytes match the built publication tree; this is source/build evidence, not a claim that the latest game versions are live on Play.

## What was recoverable

The four HC1 remote ledger branches and Claude's committed HC3 release PRs were recoverable. A read-only search of 32 HC-prefixed remote branch trees and the final Actions runs found no inventory source, HC3 readback script, `stub-handoff.js`, native `mbm_import` receiver, or handoff test checkpoint. Claude's unpushed local files were not available in this workspace. This does not prove they never existed.

The existing bulk-transfer implementation is intact: `domain-split/game-saves.js`, `game-storage-allowlist.json`, the `/game-saves/` page and Node/browser controls. It transfers narrowly allowed localStorage, selected profile subtrees and Touchline career slots, preserves conflicts by default and keeps rollback behavior. Bulk transfer is not the requested route-specific native import handoff.

## Reconstructed inventory

Run `npm ci --prefix tools/hc3-inventory --ignore-scripts`, then `python tools/hc3_save_inventory.py --self-test` and `python tools/hc3_save_inventory.py --lessons <checkout> --built <publication>/games --output docs/HC3_SAVE_INVENTORY_2026-09-06.json`.

The route-keyed JSON covers all 69 canonical publication rows, including 67 migration candidates and the two educational dual publications. Each source payload must equal the built bytes after the builder's exact configured origin replacement. Every referenced script is read from the built tree. Acorn is a build-time dependency only; no parser or new third-party resource is loaded by a pupil page.

Literal, namespace, template and bounded wrapper candidates are resolved through the syntax tree. Mutable or shadowed bindings, dynamic methods/keys, ambiguous wrappers and unsupported scope forms remain explicit. Candidate records never authorize a key. Shared runtime records do not establish per-game ownership. Observation lines are script-local; script numbers follow HTML document order. No pupil storage was accessed, so typical user-save sizes are deliberately unmeasured.

The first reconstructed regex scanner was discarded before commit after controls exposed false matches in strings, scope confusion and exponential expansion in Voxel. AST controls cover these failures, including reassignment, object alias mutation, catch/destructured shadowing, spread overrides, recursive wrappers and unresolved storage methods. The positive → planted wrong key → restored control passes.

## Reviewed missing bulk keys (not silently granted)

| Route | Key | Call-site evidence | Action |
|---|---|---|---|
| `/Lessons/Games/Glitch_Clash.html` | `glitchclash_save` | `loadSave()` / `save()`, lines 974–981; native file import lines 1091–1101 | Confirmed campaign save omitted by existing bulk allowlist |
| `/neonmeridian/` | `meridian_settings` | legacy migration to `mbm_neonmeridian_settings_v1`, lines 349–356 | Confirmed old-origin key; preserve exact legacy name |
| `/neonmeridian/` | `meridian_progress` | legacy migration to `mbm_neonmeridian_progress_v1`, lines 349–356 | Confirmed old-origin key; preserve exact legacy name |

The generic Glitch storage accessor has a fallback return, so the AST receiver stays unresolved. The manual call-site review above establishes the narrow key. Private class lists, account/session tokens, VIR pupil answers/names, audience flags and splash keys remain excluded. Do not authorize all candidates or blanket prefixes.

## Native import paths and residue

Ten routes have native full-save import paths; several restore only a defined part of the game's local state. This is importer availability, not implemented handoff coverage.

| Game | Existing native path / format | Handoff constraint |
|---|---|---|
| Titan Forge | `__MBM_TITAN_V5__.save.importCode`, checksummed TFS1 six-string envelope | Text importer; oversized JSON file is not an accepted fallback |
| Emberwild | `__EMBERWILD__.importJourneyArchiveFile`, checksummed `.emberwild` archive | Preserve native manual-slot and archive validation semantics |
| Global Games | V4 collection importer | Transfer only this game's reviewed sections; not unrelated sports state |
| Glitch Clash | `#importfile`, raw native campaign JSON → `Engine.sanitizeSave` | Sanitizer accepts null as fresh save and persistence errors are swallowed; stage/validate/rollback before success |
| Apex Kick | `importSaveText` / `#saveFile`, versioned game/save envelope | Keep native size/version checks |
| Biopunk Hive | Native base64 JSON → `BHCore.validateSave`, confirmation UI | Text importer; oversized JSON file is not an accepted fallback |
| Lumina Haven | `#importInput`, native layout JSON → `sanitiseSave` | Requires objects array; preserve prior memory on rejection |
| Aurora Links | V4 collection file preview and confirmation | Preserve native backup and per-game scope |
| Town Life | `#importFile` → `applyImportedState` → `migrateState` | Route is owned by open Site #216; measure only |
| Touchline | `#career-import-input`, validated/staged/confirmed career envelope | Read existing IndexedDB without creating it; preserve native slot selection |

House Olympiad, Grapple, Marble, Apex Curl, Apex Velodrome and Wrecking Crew have limited passport/ghost imports; those are not full career-save imports. LAN/module/proof readers are not save importers.

`/stub-handoff.js`, fragment receiver integrations, rejection/round-trip tests, fragment removal and domain-split browser wiring were not recovered and are not yet implemented in this checkpoint. No stub advertises a receiver that is absent from the currently published Play game. The source-pin release issue and Games workflow PR-creation permission must be resolved before publishing paired sender/receiver changes. Existing bulk transfer remains available.

Completion requires per-route adapters through existing native import paths, strict exact-route/UTF-8 fragment bounds, deliberate user action, rejection without overwriting destination progress, fragment clearing, native file fallback where supported, and phone/desktop round trips on the published merged versions. Routes without an import path remain named residue; this order does not add a new importer schema.
