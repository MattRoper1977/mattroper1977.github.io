# Recovered original orders — source and execution index

Received from Matt on 11 September 2026. The companion [original-order appendix](2026-09-10-recovered-original-orders.md) preserves the supplied file byte-for-byte. Its quoted orders retain their wording, sentinels, stop conditions and readbacks. Recovery does not certify historical premises as current facts or release an existing hold.

Source filename: `Education_Master_Order_AppendixB_Original_Orders.md`.
Source SHA-256: `bc46f34b1ce7473364d3cfca8be34b002b36cb6b1eeb45cdc18d1f88bef08ed1`.
Source bytes: 31695.
Claimed transcript provenance in the supplied appendix: “Science build files and lundy loop removal”, 10 September 2026. This archive preserves Matt's supplied extraction; it does not claim a separate re-extraction of that transcript.

| Order | Source completeness | Execution boundary |
|---|---|---|
| ML1 | Complete, B1 | Its old patch must still apply under §1.4; current preflight finds it does not. Historical ORDER DL repair and #191/#192/#194 merges must be reconciled, not replayed. |
| PRX1 | Complete, B2 | Runs after ML1. Existing draft #350 needs the recovered full target/golden/structural/census evidence before closure. |
| BL1 | Complete, B3 | Own fresh inventory after ML1 and the three named PRs are resolved. §2 proposes a sequence; §3 executes only the portion Matt approves. |
| LP1 | Complete, B4 | Own session after ML1; preserve two proof contexts and exact stop conditions. The stated thirteen and its component sum must be remeasured. |
| PIN1 | Complete, B5 | With or after LP1; measure actual dependency/trigger coverage rather than importing old pin totals. |
| SB1 | Complete, B6 | Computing owner; before a second Scratch unit. Does not newly block #493. |
| UX1 Part A | Partial, B7 | §3 onward missing; not executable in full. The separate hub-placement decision is not the full order. |
| UX1 Part B | Partial, B8 | §1.5 onward missing; not executable in full. Reconcile SW2 overlap explicitly. |
| GW1/LW1, UX1 C, TH1 C, LF1-M | Not extracted here | Remain unresolved; no completion implied by this archive. |

## Publication boundary measured before this write

At Site main `1651b84c800f6cd3169a29f794b075042ee54024`, `domain-split/build_education.py` excludes the root `docs` tree. Executing its exact `public_file` predicate for both new paths returns false. The same exact-path controls pass for currently selected builders `810ae8f8830dc9e30a7ceec9ada4ec24d575a04d` and `6430f23f2b5f226464d3d8faa5050ab93f7fe0e5`. The positive contrast, `REGISTER.md`, returns true in each. No exclusions, admissions or workflows were changed.

The Play builder copies enumerated game sources, assets/images, and registered root assets; neither new documentation path is a source or root asset. This change does not move Games pins.

These measured exclusions justify this location. “Documentation only” by itself is not proof of unchanged published bytes: Site's unfiltered publication workflow can still run after a documentation merge. Normal PR checks and any triggered publication remain required; this archive grants no check exception.

## Current ML1 historical anchors

GitHub confirms Site #191 merged `f41a9e32a9cc82ac759367e111bf2266a14d6208` (26 August), #192 merged `72c31ba5d9077623b912137ff4439bb2fbce70cb` (27 August), and #194 merged `ed0a1ba32ea994558100c4695fb2880fcda4c2b1` (27 August).

Read `docs/MBM_LIVE_MIRROR_LEG_DEADLOCK.md`, including its later “APPLIED — ORDER DL” section, and `docs/MBM_DEADLOCK_LIFT_CLOSE.md`. The documented original patch targets `agx1-live-verify.yml`, not the separate `shelf-mirror-guard.yml`. It fails a read-only application check at current main. ML1 §1.4/§5 prohibit silently adapting it. No workflow repair, scratch proof PR, old-PR replay or ML1 completion token is issued by this archive.
