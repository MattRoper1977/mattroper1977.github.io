# HC3 Glitch receiver publication evidence — 2026-09-06

Status: candidate, not served proof.

Rollback Site: ce56bdea9e0b950f6cbf335047c385a494726a0d. Rollback Lessons game source: d2a4a1cf3fd5840123e047a5c7dd86700a781526. Current Play pins remain independent until their normal full-green release.

Measurement: Lessons #354 candidate 1e9578202a42b123f0731bfc7094871ed4ef32aa passed native receiver phone/desktop fixtures and all eleven existing Glitch suites in run 34061948003, artifact 9997789105 (archive SHA256 2bfd5c613510488171bc53876a16bd2c17242f2c9805f8adfb9497cba9f3a29c). The old source evidence necessarily rejects these changed campaign-receiver bytes.

This release will bind the unchanged old Glitch bytes and the reviewed receiver bytes to their exact repository, route, source path, commit, Git blob and raw/published SHA256 in the existing revision registry. Only this game's current evidence hashes change. Every registered route retains every existing planted-defect control, generalized from Orbital to the registry's complete route set. CI builds the current companion, prior Lessons pin and exact receiver candidate, with all 69 routes preserved.

Release plan: merge only after full CI green; confirm Site publication/provenance at the merge SHA; merge the reviewed Lessons receiver on its own full green; advance Site and Lessons pins through Games pin-release one at a time with full play verification; establish receiver live bytes and phone/desktop behavior before publishing any education stub sender. No sender is part of this PR.


HELD — do not merge. Read-only review and a deterministic storage-interleaving model found that a second tab can save between the last empty-key read and setItem, or between rollback's equality read and removeItem. The candidate can replace/delete that concurrent campaign. Existing single-context browser and eleven native suites are green but do not prove this preservation case. This is a machine design issue, not a request for Matt to approve data-loss risk. The Web Storage standard explicitly provides no locking guarantee (https://html.spec.whatwg.org/multipage/webstorage.html). A lock used only by new tabs cannot protect an already open older game. Resolve with a compatible native persistence design and firing controls before removing this hold. No receiver or sender has been deployed. Lessons' education publisher must also advance past Site #284 before changed game bytes can merge, because it builds the companion Play tree.

Saved prototype: docs/hc3-recovery/stub-handoff.js (3851 bytes); syntax-checked only, not connected to any publication or stub. Native raw JSON plus encoded-fragment size limit; larger native JSON file fallback. End-to-end sender/browser/domain-split wiring remains unfinished. docs/hc3-recovery/concurrent-save-reproduction.cjs is a deterministic unit model, not live browser evidence: expected concurrent XP 999, actual 123, exit 1. No claim of a passing concurrency gate. Reproduce with node <model> <Lessons candidate Games/Glitch_Clash.html>.


## Recovered concurrency repair, 2026-09-07

The historical hold above applies to the unsafe receiver revision. Its proposed approval has been removed from the candidate registry; the original deployed receiver remains admitted. The replacement is Lessons bc6a1af8d053448012b31f1424da983cd1bf3493, which uses separate transactional campaigns, preserves a writing legacy tab, branches simultaneous imported writers, keeps per-tab selection and cancels stale battle input/timers before adoption. Native raw JSON compatibility and the memory fallback remain.

Run 34069432594/job101583916319 passed 23 actual Chromium cases and all eleven native suites. Artifact10000016131 has SHA256 d7262057ab2f348e212d8bac138389cffea4289e247714154aec5f860e23c712. Games rendered regression34069432602 and all eight FieldOps34069432589 jobs passed. The hold now remains for publication prerequisite checks; no sender has been enabled and no current save is changed by this evidence-only PR.

Current Site rollback before this revision:38630cbf05c6272631e4c69828144afca174d4e0. Prior candidate247af670e2f54699011aadb262cba9b3d7b6538e remains recoverable in Git. Science #356 and Apps #44 have now merged; their published source and shared gate must be re-anchored before a paired publisher change.

## Final receiver candidate — 2026-09-07
95146202d7f876800605b489de4231efe28928b9 composes the isolated campaign store
with the merged Science source and corrects the hidden Retry display. Receiver
run34070662336, Games rendered regression34070662398 and FieldOps34070662401
all pass. The downloaded browser artifact10000391273 has archive SHA256
530f02823d3d991e5736453a605af66c76d101ba59554e089fd6ef3af218f797.
Its23 cases include phone/desktop, concurrent tabs, old legacy writers, queued
updates, reload identity, durable abort/denial, file fallback/retry and native
timing/pointer cleanup. All eleven original game suites pass. Real/planted/restored
save-routing control rejects legacy overwrite. This remains candidate evidence;
receiver live proof and the later old-origin sender release are separate gates.
