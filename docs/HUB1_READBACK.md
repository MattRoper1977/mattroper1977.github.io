# HUB1 READBACK — Autumn 2 hub badges (2026-09-23) · HUB1_CLOSED (2026-09-25)
**Phone check (Matt):** https://madebymatt.uk/Lessons/Science_Teesside/?pathway=GROW&term=Aut2 — (1) GROW › Autumn 2 › W2: the FIRST card reads **"Recommended · current chassis"** (Spherical Bodies Explore). (2) No sideways (horizontal) scroll at phone width.

**Cause (§1):** Explore/Introduce decks fell to build_catalogue's last branch, "earlier" — a value in the vocabulary; the single writer's scope excluded Science Aut2. Pre-existing (same at dda76aa4).
**Fix (R1–R3):** rx3_recommended.py `--science-cells` writes the A/L1 deck as Recommended, Classics as Alternative, un-lundy Do decks as Current classroom series; vocabulary gate with a red proof; BUILD W8A/W8B bound Aut1·W8, W8B titled from its head `<title>`.
**Proof (§3):** 3.1 at 390 px, local built bytes: W2 first card RED (Earlier retained) → GREEN (Recommended); negative controls pass (no Classic in W2; W1 Classic still "Alternative version"). LIVE: by phone (this container: egress 403).
- 3.2 cells with exactly one Recommended: 0/20 → 20/20; cards styled "earlier" in those cells 29 → 0.
- Served moving set 6 files (hub page, bindings, shelf, terms-and-styles, lesson order, sizes); site/apps trees 0.

**Landed (squash SHAs):** Site #440 window 7d310e1e · Apps #180 2fd5621e · Lessons #667 6d5a05ad (carries D3 #666). **Publication:** run 35855223506 SUCCESS (build, all-file admission, deploy; 11:44Z). D3's own: 35852802697 SUCCESS.
**EQUAL window:** Site #442 9fd80be8, published by run 35863210729 (attempt 2, deployed 00:13Z, 25 Sep). **Pure carrier:** Apps #183 8002b50c (publication 36118094732), then Lessons #672 f06e83a7 (publication 36119042499).
**Live order read back by Claude on 25 Sep:** GROW Aut2 W1 = Sky Shift (Recommended), 24-Hour Control Room, Classic last (Alternative); W2 = Shape Evidence (Recommended), World Shape Lab.
**Aut1 Week 8 (enrichment) has no Teaching Packs section by design; Sugar W8A/W8B sit there.** Site #442 fixed check_completion to read which weeks the packs page has (link required only for those, no other pack link allowed, pack-less rows reported); proved RED before/GREEN after, and a removed-Week-3 control stays RED. No Site admission fence covers the check (only `git diff --check`, clean).
**Q12 (Site control 12 reds):** proved false. With full Lessons history the 11 P2 "not an ancestor" rows vanish (a partial-clone artefact); the one left is P0 serve-witness.yml:31 = the known Q7. On #442's branch: RED 1 (Q7), P5 EQUAL pins agree. No PR needed.

| RS1-G3 §1 · Q12, the Science hub stylesheet (not the control-12 question above); each merged after the previous publication succeeded | PR · squash SHA | Publication run (SUCCESS) |
|---|---|---|
| Site window: 2 pairs, hub page + size row | Site #444 · 3e5e489d | 36132029338 |
| Apps gate copy (re-pin + carrier) | Apps #184 · 045088e8 | 36133045165 |
| Lessons fix, DOM check at 390 px, carrier last | Lessons #673 · 7aed39b3 | 36133728912 (@3e5e489d) |
| EQUAL window | Site #445 · be9441d7 | 36138154604 |
| Apps gate copy (pure carrier) | Apps #185 · 29710cae | 36139210787 |
| Lessons pure carrier | Lessons #674 · 645aa4bb | 36139966528 (@be9441d7) |

**Gate copies:** 95b3d823b472 → df52ea19df0f → e3e1c995bfde. **Live, 18/18** (BUILD/GROW/LAUNCH × Aut1/Aut2 × 360/390/1280 px): scrollWidth = clientWidth, `.start-grid` computes grid (2 columns at 360/390, 4 at 1280), all 6 filter controls above the lesson list; live hub and size row equal the admitted digests (9e0f763a, 911175a5). **R1 pin move:** Site #446 cc28d5c5 — `published-completion-verify.yml` Lessons pin b54c9006 → 7aed39b3, declared EQUAL; Published Education completion run 36145019044 SUCCESS (checkout 7aed39b3; completion and device stats PASS). **Owed after HUB1:** Q11 (R3 residue: "Your task · 1 of 2" in five W8 decks' no-JS markup; BUILD W11A/W11B "Week not bound"), then batch 2.
