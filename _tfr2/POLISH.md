# TFR2 P5 — AAA polish (A1–A9), each independently gated

Sources: `src/v5-music.js`, `src/v5-polish.js`, `src/v5-polish.css`; 10 anchored single-match patches
(core: the `__MBM_TITAN_GEM_GRANT__` hook; V3: `music`/`coachSeen` fields, hint retired, toast forwarding,
flag setter; V4: announcer hold; AAA: `__MBM_TITAN_BRACE_MS__` hook, prompt/trial forwarding).
Gate `tools/p5_polish.mjs`: **24/24 PASS**. Screenshots in `_tfr2/shots/p5/`.

| item | what shipped | gate evidence |
|---|---|---|
| A1 procedural music | Web Audio only, 92 bpm, 16-step loop: kick/hats/bass (layer 1), arpeggio (layer 2 on combo ≥3), detuned pad + lead (layer 3 on focus ≥60 or combo ≥6). Created only after the first pointer/key/touch gesture. "MUSIC" toggle in the OPTIONS tray and in the core settings dialog; state in `mbm_titanforge_v3.music` (default off). Stops when core Game sound is off or FX SOUND is muted. | AudioContext count 0 before gesture, 2 after (mine + the AAA engine); 9 live voices; layer gains [1, .9, .89] at combo 8 / focus 59; both toggles work; core sound off → stops |
| A2 achievements | 24 named achievements, card on unlock, listed under a **RECORDS** tab added to the Divine DNA dialog (tab bar above the branch tabs); key `mbm_titanforge_records_v1`. Sources: lift/form/ascend events, V3 sets, V2 Kai duels, trial results, rank, form, focus, surge, daily, LAN duels. | FIRST SPARK / FIRST PERFECT / CONTENDER unlock on one lift; card shows; 24 rows in RECORDS |
| A3 daily challenge | Seeded by local `yyyymmdd` (mulberry32): rival name, target 400–900 power, two modifiers from BRACE ONLY 600 MS (AAA hook), PERFECTS ONLY, 3-PHASE ONLY, COMBO OR BUST; 45 s; one attempt per day (`mbm_titanforge_daily_v1`); card in the TRIALS dialog. Clearing sets `__MBM_TITAN_GEM_GRANT__=1`, which the core consumes on the next lift (+1 gem); the grant survives a reload as `pendingGem`. | same seed → identical plan, next day differs; attempt runs with HUD; cleared 800/800; hook 1 → next lift gems +1, hook 0; second start refused |
| A4 local leaderboard | Top 10 POWER-OFF scores (from duel results) and top 10 fastest first-ascension times (page-load → first `mbm:titan-ascend` of the session), in RECORDS. | 13 inserts keep 10 sorted 1500…600; ascension timed at 7.1 s |
| A5 save code | Export the six keys as `TFS1.<Z|R base64url deflate-raw JSON>.<fnv1a>`; import checks the checksum, the key set and each key's schema shape, then writes and reloads (every layer's sanitizer runs on load). Writes to the imported keys are ignored until the reload lands. | 627-char code; corrupted checksum and tampered payload both refused with all keys byte-identical; import into a fresh profile restores strength 777 / coins 4321 / gems 9 |
| A6 onboarding | 4-step coach overlay (tap DRIVE in gold / hold BRACE / release CONTROL / your body evolves), SKIP, BACK/NEXT, Escape; shown once (`mbm_titanforge_v3.coachSeen`; players who already dismissed the old hint never see it). The V3 hint is retired. | shown on first launch, not after reload; SKIP marks seen |
| A7 reset | RESET ALL PROGRESS in core settings: two taps within 4 s, clears exactly the `mbm_titanforge_*` keys, reloads and announces. | arms, clears (unrelated key kept), reloads to a fresh save; arm expires after 4 s |
| A8 sound honesty | FX SOUND `aria-label` and an OPTIONS-tray note both say "Game beeps: Settings > Game sound"; the settings dialog says it too. | strings present |
| A9 one announcer | Only `.mbm-v4-live` is `aria-live`. The AAA hidden span, V2 reward, V3 toast, the core `.notice`, the evolution pop and the cycle result are `aria-hidden` with no live role; AAA prompts, V3 toasts, trials and duel results are forwarded into the V4 announcer, and a lift line holds for 1.5 s with later prompts appended. | exactly 1 live region; lift text "PERFECT REP · +3 STRENGTH · +3 COINS · READY — DRIVE AGAIN" |

Perf on the P5 build (coach dismissed, deterministic cadence): **50 / 52** fps median, idle draws 0. The
first-launch coach originally used `backdrop-filter: blur(6px)`; with it up during play the median fell to
28 under the software compositor, so the coach is a plain scrim now.
