# SW2 readback

1. **Part T delivered; nothing merged.** T1 tokens, T2 chrome templates, T3
   marker-scoped stamping, T4 fifteen gates, T5 landing prepared.
   Site #337 · Apps #73 · Lessons `claude/sw2-t5-lessons`.
2. **Apps #73 is FULL GREEN** (6 success, 4 skipped, 0 failures) and is held
   behind #337 on purpose: its `CANONICAL_HASHES` entry pins the token file's
   bytes, and merging first would pin Apps to bytes the site has not landed.
3. **Site #337**: 15/15 local gates green; CI green but for four checks proved
   not its own. Two that *were* its own were found by CI and fixed.
4. **The token file was not inert.** Five names — `--mbm-ink`, `--mbm-line`,
   `--mbm-muted`, `--mbm-focus`, `--mbm-font` — were already owned by
   `mbm-platform.css` / `brand-tokens.css`. Measured: 13 computed-style
   differences, `/main/`'s `.mbm-audience` ink `#1B2140`→`#161D3D` and a warm
   `#E3DAC5` divider turned navy. AUTO-DECISION: deferred to the estate's
   definitions. Held by an inertness gate — 19 page types, 6,507 elements, zero
   differences.
5. **Generated pages are stamped by their generators now**, not by hand. Five
   pages were generator-owned; `main/index.html` masked it by being spliced.
6. **The chrome templates moved to `tools/chrome/`.** Published, they carried
   `/games/` into the education tree and tripped `check_education_separation`.
   The first call — "untidiness for Part U" — was wrong: the gate reads what a
   file contains, not who links it.
7. **Admission registry re-cut**: education-site 14 CHANGED (transition pairs),
   1 ADDED (`ARRIVING`); lessons and apps 0/0. Both this branch's build **and**
   main's build pass it.
8. **44px on pupil surfaces**: 445 controls, both chrome states, 0 under; the
   `--min 48` control reds 213, all sitting at exactly 44.0px.
9. **Contrast**: 34 ink/surface pairs on cream and dark, all ≥4.5:1, worst 5.12.
10. **Six gates measured the wrong thing before they measured the right one** —
    tags not requests, a hand-kept token list, an empty value passing as
    consistent, a tag whitelist, an excision comparing unlike things, a naming
    variant silently skipped. Each was a silent pass; each is recorded.
11. **BLOCKER 1 (Matt)** — `apexpool-home-verify` asserts PR **#25** is open.
    #25 was closed unmerged 2026-09-07; head SHA unchanged. It now reds every PR
    touching `main/index.html`. Fixing it means editing a workflow assertion,
    which §0 and Appendix B forbid. Reopen #25, or move the held-PR record.
12. **BLOCKER 2 (Matt)** — the two `verify_cross_estate_unification.py` copies
    have diverged, and no single text satisfies both: the Site pins Apps at
    `924ab986` (caller `c4205191`) and at `3ad0a7df` (`da9809f0`), while Apps
    main is `732591dd`. `pin_catalogue_contract.py` refuses while they differ,
    so the reviewed catalogue pins cannot be re-cut — by anyone.
13. **LISTED, not changed (R-T3.1)**: brand convergence (0 of 6,
    `brandVisual()` pins it); and §0.6's header tagline in Lessons and Apps,
    where the brand contract pins the whole lock-up — free on the site only
    because its gate stops at the first `<span>`.
14. **Found by running a gate with fewer flags than CI.** The local
    cross-estate runs omitted `--base`, which proves wording and logo, and so
    reported green on pages the brand contract rejects. Both estates use
    `--base` now.
15. **Parts L, R, K, H, U, A, P, N: not started, all blocked.** L, K and the
    Lessons halves of H and U change `index.html` and `subject.html` — the files
    BLOCKER 2 pins. R, A, P, N and the site halves depend on token adoption from
    a Part T that cannot merge under BLOCKER 1.

**SW2_BLOCKED** — no part has landed. `SW2_T_OK` is not emitted: T5 requires a
merge, and both merges wait on rulings above. Ledger: `docs/SW2_LEDGER.md`.
