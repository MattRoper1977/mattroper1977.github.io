# TFR2 P6 — regression (final bytes)

Build: `_tfr2/titanforge.html` 2242893 bytes, sha256 76f3928f2ace6532db4e59711fdd3022ac9ad2966058a6fdf59a0c446ba298d9.
Runner: `tools/p6.sh` (rep harness, p6_regression, check_scripts, p3_reduced, phone_proof, perf_budget ×3). Output `_tfr2/shots/p6.txt`.

```
PASS 6 tri-phase reps: combo 1..6, GAINS x1.9 at 6/6, doubled strength after a flawless set (ratio 2.00)
PASS Rook trial: button "CHALLENGE · 180", .mbm-trial-live set true, 8/8 quick lifts landed, result "Rook defeated! +180 coins×", class removed true, attemptedTrials [0], ROOK DEFEATED achievement true
PASS Rook trial page errors 0
PASS lost trial: result "Rook holds the platform. Train and return!×", attemptedTrials [], button "CHALLENGE · 180"
PASS mbm:titan-ascend {strength:50000, ascensions:1} → 7 shards ("ACHIEVEMENT · ASCENSION I · Ascend once."); beh_1 unlock → "Myofibrillar Density · LV 1/5", __MBM_TITAN_ASCENSION_GAIN__ 1 → 1.03
PASS no-WebGL boot: webgl available false; "3D RIG" → click → "2D SAFE", renderMode 2d-fx, webgl-off true, uncaught errors 0
PASS network-locked session (lift, every dialog, host a duel): off-page requests attempted 0, resource entries 0, page errors 0
PASS splash stamp byte-identical to the input: True; inline-exit stamp byte-identical: True
PASS every script block passes node --check (16 script blocks, 0 failures)
PASS reduced-motion run: zero animation frames from P3/P5 effects (motion counters non-zero: none, particles spawned 0)
PASS P1 phone proof YES on all three phone sizes; no popup overlaps the fixed LIFT (failed requests failed requests 0 )
perf run1: median fps 50 (min 33) over 31s of 10 scripted reps (9 lifts), renderMode 2d-fx tier low; idle 3s→4s FX draws delta 0 rafStarts delta 0 (total draws 628); failed requests 0; page errors 0
perf run2: median fps 53 (min 34) over 30s of 10 scripted reps (9 lifts), renderMode 2d-fx tier low; idle 3s→4s FX draws delta 0 rafStarts delta 0 (total draws 635); failed requests 0; page errors 0
perf run3: median fps 52 (min 32) over 30s of 10 scripted reps (9 lifts), renderMode 2d-fx tier low; idle 3s→4s FX draws delta 0 rafStarts delta 0 (total draws 599); failed requests 0; page errors 0
PASS performance budget: three runs, medians [50 52 53 ] → median-of-three 52 (>= 50); idle FX draws max 0 (= 0)
```

Red runs behind these lines: input build (lift NO ×3), `broken/boss-brace` (rep harness FAIL), `broken/duel-fingerprint` (duel gate FAIL), the P3 first cut (perf median 40, idle draws 8 on the input), the corrupted save code (refused).
