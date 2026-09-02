# Games census — 2026-09-02 (Order SC1, Lane C Phase 0)

Source: canonical manifest `games.json` at Games main dbe5af0a (59 routes: 32 Site, 27 Lessons; 60 once CyberPulse lands). Site routes measured for bytes and 6x-throttled parse only (Site editing begins after Lanes A and B land); Lessons routes measured fully at Lessons main 308c809e, repairs landed through Lessons #204, #206, #210, #212, #213, #214, #215, #216, #217, #218 (main 2a8272f6 at close).

## Estate (59 routes)
- total raw 17,468,418 B, gzip 5,250,901 B, median gzip ratio 29.9%
- over 409,600 B raw: 17 (GS1 Appendix A said 15; measurement wins)
- 6x-throttle long-task total at boot: median 421 ms, p75 2322 ms, max 4030 ms
- Emberwild: 379,962 B raw, 109,271 B gzip, 316 ms long-task at 6x (inside the §4.4 per-title budget: 512,000 raw, 160,000 gzip, 2x estate median = 842 ms)

## Lessons (27 canonical routes, GS1 said 28)

route | bytes | gzip | v6 | way out | zoom blocked | dup ids (source/runtime) | h1 visible | canonical | aria-live | 44px rule | idle raf/s | idle paints/s | small targets | tab presses to exit | parse ms @6x
- Axiom_Shift.html | 70738 | 22263 | 1 | inline | 0 | 0/0 | 1 | 0 | 1 | 1 | 59.8 | 0 | 0 | 2 | 62
- Charcoal.html | 106358 | 34480 | 1 | inline | 0 | 0/0 | 1 | 0 | 1 | 1 | 233.2 | 2533.8 | 0 | 6 | 122
- Hold_the_Mark.html | 123351 | 39770 | 0 | hud.js | 1 | 0/0 | 1 | 0 | 1 | 1 | 60 | 0 | 0 | 6 | 144
- Glitch_Clash.html | 183365 | 60399 | 1 | hud.js | 0 | 0/0 | 1 | 0 | 1 | 1 | 60 | 0 | 0 | 3 | 194
- voxelcraft.html | 89193 | 26964 | 0 | hud.js | 1 | 0/0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 182
- Vortex.html | 575462 | 151783 | 1 | inline | 0 | 0/0 | 0 | 0 | 1 | 1 | 24.2 | 24.2 | 0 | 17 | 2603
- Globe_Snake (1).html | 564263 | 148359 | 1 | inline | 0 | 0/0 | 0 | 0 | 1 | 1 | 44.4 | 22.2 | 0 | 10 | 2631
- Neon_Snake_Overdrive.html | 37328 | 11588 | 0 | hud.js | 1 | 0/0 | 1 | 0 | 0 | 0 | 47.6 | 0 | 6 | 17 | 577
- Neon_Siege.html | 559187 | 146940 | 0 | hud.js | 1 | 0/0 | 0 | 0 | 0 | 0 | 21.6 | 0 | 12 | 15 | 2578
- Neon_Garden.html | 567223 | 148547 | 1 | hud.js | 0 | 0/0 | 0 | 0 | 1 | 1 | 21.4 | 0 | 0 | 23 | 2474
- Orbital.html | 544672 | 142183 | 0 | hud.js | 1 | 0/0 | 0 | 0 | 0 | 1 | 20.4 | 0 | 8 | 11 | 2527
- Grid_Chase.html | 73932 | 25106 | 1 | inline | 0 | 0/0 | 0 | 0 | 1 | 1 | 60.2 | 5658.8 | 0 | 8 | 169
- Prism.html | 550298 | 144351 | 1 | hud.js | 0 | 0/0 | 0 | 0 | 1 | 1 | 23.2 | 0 | 0 | 12 | 2437
- Grapple.html | 650475 | 171365 | 1 | hud.js | 0 | 0/0 | 0 | 0 | 1 | 1 | 30 | 0 | 11 | 19 | 2551
- Marble.html | 661231 | 174748 | 1 | hud.js | 0 | 0/0 | 0 | 0 | 1 | 1 | 24.8 | 0 | 15 | 22 | 2618
- Slipstream.html | 525847 | 137215 | 0 | hud.js | 1 | 0/0 | 0 | 0 | 0 | 0 | 21.8 | 0 | 0 | 1 | 2322
- Slipstream_GP.html | 719863 | 186709 | 1 | hud.js | 0 | 0/0 | 0 | 0 | 1 | 1 | 177 | 59 | 0 | 2 | 1382
- Wrecking_Crew.html | 866286 | 236762 | 1 | hud.js | 0 | 1/0 | 1 | 0 | 1 | 1 | 120 | 9184.6 | 0 | 4 | 591
- Lumins.html | 119312 | 34113 | 0 | hud.js | 1 | 4/0 | 1 | 0 | 0 | 1 | 74 | 5466 | 12 | 12 | 358
- Static.html | 174933 | 54653 | 1 | inline | 0 | 2/0 | 0 | 0 | 1 | 1 | 0 | 0 | 1 | 12 | 130
- OneGuy.html | 88956 | 28955 | 1 | inline | 0 | 0/0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 9 | 165
- The_Last_Lighthouse_v1_1_The_Archipelago_Update_FINAL.html | 148296 | 46614 | 1 | hud.js | 0 | 0/0 | 1 | 0 | 1 | 1 | 120.4 | 20106.8 | 0 | 1 | 2013
- KidsVsStaff_Showdown (3).html | 50658 | 16723 | 0 | hud.js | 0 | 5/0 | 1 | 0 | 0 | 1 | 0 | 0 | 1 | 17 | 162
- WorldCup_ThreeLions_Final.html | 82298 | 24772 | 0 | hud.js | 0 | 0/0 | 1 | 0 | 0 | 1 | 0 | 0 | 18 | 32 | 178
- WorldCup_v3_MatchDirector.html | 92177 | 26916 | 0 | hud.js | 0 | 0/0 | 1 | 0 | 1 | 0 | 0 | 0 | 26 | 36 | 199
- WorldCup_v5_Showdown.html | 129496 | 36469 | 0 | hud.js | 0 | 0/0 | 1 | 0 | 1 | 1 | 0 | 0 | 27 | 37 | 273
- Trekkers_Trail_Runner_Tees_Coast.html | 129791 | 32872 | 0 | hud.js | 1 | 0/0 | 1 | 0 | 0 | 0 | 28.4 | 0 | 2 | 8 | 2880

## Findings after reading call sites (GS1 §0.3)
- Way out: all 27 carry hud.js (18) or the inline exit region (9); all 27 reach it by Tab (1-37 presses) and Enter. No keyboard trap.
- Zoom blocked on 8 (Hold_the_Mark, voxelcraft, Neon_Snake_Overdrive, Neon_Siege, Orbital [owned by #93], Slipstream, Lumins, Trekkers): repaired on 7 in Lessons #204 and #206; Orbital excluded by ownership.
- Duplicate ids: 4 games in source (Lumins 4, KidsVsStaff 5, Static 2, Wrecking_Crew 1); every one is a state-exclusive overlay template (only one variant is in the DOM at a time); runtime census finds 0. Downgraded: not a defect.
- Touch targets under 44px (measured): Neon_Siege 13, Marble 15, Lumins 12, Grapple 11, WorldCup_v5 27, WorldCup_v3 26, WorldCup_ThreeLions 18, Orbital 8 (owned), Neon_Snake 7, Trekkers 2, Static 1, KidsVsStaff 1. Repaired in #204/#206: Neon_Siege, Marble, Lumins, Grapple, Neon_Snake, Trekkers. Residue: the WorldCup trio (17-24px classroom controls, see HOLD note), Static, KidsVsStaff; and two estate-level elements outside any game's scope: the generated splash 'Skip intro' (110x42) and the V6 release link (92x22).
- Menus that overflow the viewport (G11): Neon_Siege, Grapple, Marble on main clip their intro copy above the top edge at 360x800 and place text under the estate exit control; repaired (#menu safe centring + top padding) in #204/#206.
- Idle repaint while nothing changes (Tier 1 §2.6 candidates, code read): The_Last_Lighthouse (render() every rAF before start, plus the V6 routeForecast overlay loop), Wrecking_Crew (three.js render each frame), Grid_Chase (unconditional loop), Lumins (frame() renders always), Charcoal (menuFrame animation loop + V6 drawPredict), Slipstream_GP (loop+tick + V6 drawRoute/watch), Vortex and Globe_Snake (three.js scenes, ~17-34 rAF/s). The V6 overlay loops are the same class Town Life's event-driven redraw graft (#234, c4c27fce) fixed. Not repaired in this session: residue with the graft source named.
- Canonical link absent on all 27; aria-live absent on 10; h1 not exactly one visible on 13. Tier 2, not started.
- External URLs: only xmlns strings, a three.js discourse URL inside vendored three.js, voxelcraft's A-Frame CDN fallbacks behind a local vendor copy, Lumins' commented Firebase URL. No live third-party egress from Lessons routes. Neon_Snake_Overdrive loads vendor/three-0.128.0/three.min.js relatively (not single-file).
- Splash key: 0 of 27 Lessons games carry mbm_splash_last; ruled declined by construction (SC1 §5), reported as a count only.

## Lessons Tier 2 (GS1 r2 §3) — landed 2026-09-02

- §3.2 canonical: `<link rel="canonical" href="https://madebymatt.uk/Lessons/Games/<file>">` on all 26 owned routes (Orbital stays with Lessons #93), the form the Site's game routes use, URLs as in the Site sitemap. Batches C1-C5 (#210, #212, #213, #214, #215).
- §3.1 h1: every owned route now holds exactly one game-owned h1. Overlay panel headings (PAUSED, SCORES, TIMES, SKINS, LEADERBOARD, HANGAR, quest/challenge/pause/trek-over, result/levels/leaderboard cards, contract board) demoted to h2 keeping ids, classes and inline styles; title elements promoted (`#title` divs in the shared template family, Grid Chase's menu panel title, Static's and One Guy's logos, Slipstream's boot title). Proof per file: computed style (18 properties) and box of every game-owned heading identical before and after at 390x844; first-screen screenshots pixel-identical or within a same-build animated floor. The generated maker-splash h1 (inside a JS string in 10 files) is estate-owned and untouched. Two source h1s that only ever replace each other in the same card (voxelcraft's load-failure heading) were left, since the page never holds two. Slipstream's h1 lives in the boot screen and is hidden after load: residue (a durable lobby heading would be an authored addition).
- §3.3 aria-live: judged per game. Neon Snake Overdrive wired (#216): hidden role=status region, endGame() announces reason, score and new-best once; forced outcome proved exactly one utterance, control zero. Kids vs Staff already carries a role=status toast (census count downgraded). Not wired, hook lines identified, no forced-outcome proof reachable from page scope this session: Lumins (showResult, IIFE), Trekkers (takeDamage, module scope; no crash by inaction in 70 s), voxelcraft (endArcade, IIFE), Neon Siege and Slipstream (minified result paths). World Cup trio under the Tier 1 HOLD.
- §3.4 splash key: 0 of 27 Lessons games carry any splash key; declined by construction, count only.
- §3.5 passport: 3 Lessons games carry `mbm_sports_passport` (Grapple, Marble, Wrecking Crew); the contract verifier lives in the Site repo and was not re-run against them in this session: residue.

## Residue at close (Lessons)

- Tier 1 §2.6 idle repaint, landed (#217 C7, Lessons #218 C8): the V6 overlay canvases in The_Last_Lighthouse (v6ForecastCanvas), Slipstream_GP (v6route), Charcoal (v6predict), Wrecking_Crew (wc-v6-fx), Vortex (v6-guidance) and Globe_Snake (v6-tactical) cleared the full viewport every frame on idle titles and lobbies; grafted from Town Life's event-driven advisory (Site c4c27fce) so an overlay only clears a frame it drew. Measured through the page's own canvas context over five idle seconds: 300/297/300/301/126/123 clears -> 0 on all six; in play the clear-and-draw cadence is unchanged (measured on main's bytes and the repaired bytes with the start button pressed).
- Tier 1 §2.6 residue, judged intentional by code read: the game canvases that animate their own title scenes (Lighthouse's sea and flames, Charcoal's menu cast, Wrecking Crew's title canvas, Grid Chase's starfield, Lumins' splash orbs) are deliberate title animation, not defects.
- Tier 1 §2.5 touch targets: World Cup trio (HOLD, whiteboard tool), Static (1), Kids vs Staff (1); estate-level: generated splash 'Skip intro' 110x42 and the V6 release link 92x22 (Site-owned).
- Tier 3 §4 gameplay harness (`tools/verify_playable.mjs`, win/loss/first-gate table, BFS-derived routes, three firing controls): not started.

## Site (33 derived routes at main 19ba3994; /cyberpulse/ 404 until Site #218 lands) — dynamic census, 390x844, no input

Measured 2026-09-02 03:05Z on main's bytes served locally (hud.js and inline exits as shipped). Site editing is deferred behind Lanes A and B; these are findings, not repairs.

- Clean on all 32 served routes: zero duplicate ids at runtime, zero off-origin requests, zero page errors on load.
- Way out by keyboard: reached within 40 Tab presses on 30 routes (1-32 presses). /fracture/ and /relicforge/ missed the 40-press walk on the first pass because the maker splash was still leaving; re-derived after a 3 s settle they reach the exit in 2 and 1 presses (hud.js back link and the inline exit region respectively). No keyboard trap on any Site route.
- Touch targets under 44 px on the first screen: /apexcurl/ (V4 HQ 38x44), /apextennis/ (1), /voxel/ (1). Tier 1 §2.5, three elements estate-wide.
- h1 count / visible: /trailrunner/ 9/1, /crownbadge/ 5/2, /titanforge/ 0/0 (Titan Forge V5 has no h1 at rest), /luminahaven/ 1/0, and eight routes at 2/1 where the second is the generated maker-splash h1 (apexgolf, apexpool, apextennis, biopunkhive, neonsync, novasiege, rallyvector3d, relicforge). Tier 2 §3.1: Trail Runner, Crown & Badge and Titan Forge are the real repairs.
- Idle paint while nothing changes (canvas ops per second over five idle seconds): /apexvelodrome/ 66,568 at 142 rAF/s, /apexcurl/ 32,381, /townlife/ 26,368 (the intro scene; its advisory layer was fixed in Site #234), /novasiege/ 13,680, /hyperdraft/ 11,520, /medevac/ 10,800, /ouroboros/ 5,940, /relicforge/ 5,781, /luminahaven/ 5,497, /apexrally/ 4,140, /olympics/ 3,424, /houseolympiad/ 3,120, /offbrand/ 2,534 at 234 rAF/s, /neonturf/ 2,100, /neonbreach/ 1,501, /auroralinks/ 1,172, /biopunkhive/ 1,020. Zero-paint idles: apextennis, crownbadge, emberwild, fracture, neonmeridian, neonsync, titanforge, trailrunner. Tier 1 §2.6: each needs the code read (animated title vs. waste) before a repair; the V6-overlay class fixed in Lessons C7/C8 is the first thing to look for.
- V6 release markers: 24 of the 32 served Site routes carry __MBM_V6_RELEASE__ (25 of 33 with CyberPulse); with Lessons' 15 of 27 that is 39 V6 routes of 60.
