# HC3 Glitch receiver publication evidence — 2026-09-06

Status: candidate, not served proof.

Rollback Site: ce56bdea9e0b950f6cbf335047c385a494726a0d. Rollback Lessons game source: d2a4a1cf3fd5840123e047a5c7dd86700a781526. Current Play pins remain independent until their normal full-green release.

Measurement: Lessons #354 candidate 1e9578202a42b123f0731bfc7094871ed4ef32aa passed native receiver phone/desktop fixtures and all eleven existing Glitch suites in run 34061948003, artifact 9997789105 (archive SHA256 2bfd5c613510488171bc53876a16bd2c17242f2c9805f8adfb9497cba9f3a29c). The old source evidence necessarily rejects these changed campaign-receiver bytes.

This release will bind the unchanged old Glitch bytes and the reviewed receiver bytes to their exact repository, route, source path, commit, Git blob and raw/published SHA256 in the existing revision registry. Only this game's current evidence hashes change. Every registered route retains every existing planted-defect control, generalized from Orbital to the registry's complete route set. CI builds the current companion, prior Lessons pin and exact receiver candidate, with all 69 routes preserved.

Release plan: merge only after full CI green; confirm Site publication/provenance at the merge SHA; merge the reviewed Lessons receiver on its own full green; advance Site and Lessons pins through Games pin-release one at a time with full play verification; establish receiver live bytes and phone/desktop behavior before publishing any education stub sender. No sender is part of this PR.


HELD — do not merge. Read-only review and a deterministic storage-interleaving model found that a second tab can save between the last empty-key read and setItem, or between rollback's equality read and removeItem. The candidate can replace/delete that concurrent campaign. Existing single-context browser and eleven native suites are green but do not prove this preservation case. This is a machine design issue, not a request for Matt to approve data-loss risk. The Web Storage standard explicitly provides no locking guarantee (https://html.spec.whatwg.org/multipage/webstorage.html). A lock used only by new tabs cannot protect an already open older game. Resolve with a compatible native persistence design and firing controls before removing this hold. No receiver or sender has been deployed. Lessons' education publisher must also advance past Site #284 before changed game bytes can merge, because it builds the companion Play tree.

Saved prototype: docs/hc3-recovery/stub-handoff.js (3851 bytes); syntax-checked only, not connected to any publication or stub. Native raw JSON plus encoded-fragment size limit; larger native JSON file fallback. End-to-end sender/browser/domain-split wiring remains unfinished. docs/hc3-recovery/concurrent-save-reproduction.cjs is a deterministic unit model, not live browser evidence: expected concurrent XP 999, actual 123, exit 1. No claim of a passing concurrency gate. Reproduce with node <model> <Lessons candidate Games/Glitch_Clash.html>.
