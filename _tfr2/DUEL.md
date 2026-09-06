# TFR2 P4 — LAN DUEL (WebRTC DataChannel, no server, no STUN)

Sources: `src/v5-qr.js` (QR encoder only), `src/v5-duel.js`, `src/v5-duel.css`; one asserted patch exports
the V4 announcer so every duel announcement goes through the single `.mbm-v4-live` region.
Gate: `tools/p4_duel.mjs` (two contexts in one Chromium, UI-driven). Screenshots in `_tfr2/shots/p4/`.

## Mechanism
- `RTCPeerConnection({iceServers:[]})` — host/mDNS candidates only. Host creates the data channel `duel`
  (ordered) before the offer; ICE gathering waits for `complete` or 4 s, then uses what exists.
- **SHARE CODE**: the SDP is minimised to `ice-ufrag`, `ice-pwd`, the sha-256 fingerprint (packed to 32
  bytes), `setup`, the nickname and up to 4 UDP host candidates (`ip:port`), joined, deflate-raw via
  `CompressionStream` when it helps, base64url. The receiver rebuilds a full SDP (`m=application 9
  UDP/DTLS/SCTP webrtc-datachannel`, BUNDLE, sctp-port 5000, candidates, end-of-candidates). Measured
  **134 chars** for both offer and answer. Copy buttons on both sides (clipboard API, execCommand fallback).
- **QR**: encoder inlined (byte mode, EC M up to v20 then L, versions 1–25, penalty-scored mask). Verified
  module-for-module against the `qrcode` reference library at v1/v9/v15/v18/v22 and decoded by zxing-cpp
  (`tools/qr_verify.py`); the host QR rendered in the gate decodes to
  `https://madebymatt.uk/titanforge/#duel=<code>` exactly. The guest's camera app opens that link; the
  page reads the hash, **strips it from history** (`history.replaceState`), auto-generates the answer and
  shows it as QR + code. The host's camera app opens the answer link; that tab posts the code on
  `BroadcastChannel("mbm-titanforge-duel")` with a transient `mbm_titanforge_duel_signal` localStorage
  `storage`-event fallback (removed after 1.5 s), then shows "SENT — return to the game".
- Host clock is authoritative: every message carries host time; the guest offsets once from `hello`.
- **POWER-OFF**: 1.5 s lead, 20 s window, both forced to QUICK mode (restored afterwards). Each lift sends
  `{t:"lift", ht, grade, power}` (PERFECT 100 / GREAT 60 / SOLID 30); lifts outside the host-time window
  are ignored on both sides; both bars update live in an in-arena HUD; 3 s grace, then the result card.
- **FORM DUEL**: forces 3-PHASE; each completed rep sends its 0–6 phase score; higher takes the round,
  ties replay the same round; first to 3.
- Wins: `__MBM_TITAN_MOBILE_V2__.addCrests(1)` + record in `mbm_titanforge_duel_v1`
  `{wins, losses, bestPower, lastOpponent, name}` — nickname 12 chars, sanitised to `[A-Za-z0-9 _-]`.
- Robustness: 4 s ICE timeout; data-channel close or `leave` → "RIVAL LEFT" card with DUEL AGAIN /
  CLOSE (reconnect prompt); a finished result stays on the card; nothing but the record survives reload.
- Entry: "RIVAL · LAN DUEL" button in the dock's TRIALS dialog plus a "Forge Rival" DUEL card in the trials
  list (injected when the dialog opens; the Radix dialog is closed first so its focus trap cannot hold the
  duel dialog). All new tappables are ≥44 px with labels; the dialog is `role=dialog aria-modal`.

## Gate run (headless Chromium, mDNS hiding disabled so the two contexts can reach each other's host candidates)
```
PASS offer code 134 chars (< 400)          PASS host QR canvas rendered
PASS answer code 134 chars (< 400)
PASS datachannel open on both sides in 267 ms (host openMs 52, guest openMs 267); A sees rival "BRAVO", B sees "ALPHA", guest clock offset -1 ms
PASS POWER-OFF totals identical both sides: A shows ALPHA 1400 / BRAVO 900; B shows BRAVO 900 / ALPHA 1400 (A tapped 15, B tapped 9)
PASS winner correct: A "VICTORY · +1 CREST", B "DEFEAT"
PASS records: A wins 1 bestPower 1400 lastOpponent BRAVO · B losses 1 lastOpponent ALPHA
PASS crests: A 1 (+1), B 0            PASS V4 announcer: "DUEL WON · YOU 1400 · BRAVO 900 · +1 CREST"
PASS A shows RIVAL LEFT after B closed       PASS page errors A 0 B 0
PASS FORM DUEL: channel open; forces 3-PHASE; A VICTORY 3-0, B DEFEAT 0-3 after 3 scripted rounds
PASS guest opened with #duel=<offer>: hash stripped, offer handled, answer auto-generated (134 chars), answer QR shown
PASS answer tab: hash stripped, shows "SENT — return to the game"
PASS host tab received the answer over BroadcastChannel and the channel opened
PASS transient signal key cleared
RESULT PASS (18/18)
```
Red run: `broken/duel-fingerprint.html` (fingerprint truncated in the rebuilt SDP) — the answer never
builds, the harness times out: `RESULT FAIL (2/3)`.

## Not done here, printed
- Real-phone camera-app scanning and mDNS resolution across two physical devices cannot be exercised in the
  sandbox; the gate proves the codec, the SDP rebuild, the channel and the handoff with raw host candidates.
