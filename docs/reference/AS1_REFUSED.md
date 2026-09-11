AS1 fixed refusals and deferrals — 2026-09-11.
Decision source: Matt’s consolidated AS1 §7.1. This document records those decisions; it implements no feature.

R1 DATE-LOCKED DAILY SEEDS — REFUSED.
A date-based streak manufactures a missed-day penalty for children and prevents a teacher repeating the same level next lesson.
Permitted proposal only: a teacher-settable shared seed, with a short code giving the room the same world, no date and no streak. Nothing is built here.

R2 TWO-WINDOW SPLIT-SCREEN VIA BROADCASTCHANNEL — REFUSED FOR GAMES.
Two pupils sharing one managed Chromebook through two windows creates competing controls and doubles the hardware cost. The projector case belongs to the existing Live-Teach kit.

R3 ANCHOR-GAME PWA PRECACHE — REFUSED AS SPECIFIED.
The proposed multi-megabyte cache costs managed-device storage, and stale precache lists are an established domain-split hazard identified by the order.
An arcade that works offline also works when a school has chosen to block it. That is a decision for Matt, not a feature to ship quietly. No precache or offline rollout is added.

R4 MICRO-SFX PRESET GENERATOR — DEFERRED, NOT REFUSED.
It serves new games and repairs none of the existing ones. No generator is implemented here.

R5 IFRAME ARCADE SHELL — REFUSED.
The parent cannot directly suspend a child AudioContext or throttle the child requestAnimationFrame. The design also breaks the required href reachability, no-JavaScript fallback and printed QR routes.
The existing in-document include remains the host. No iframe shell is introduced under another name.

R6 HOVER VIDEO PREVIEWS ON THE SHELF — REFUSED.
Only a handful of catalogue games have real gameplay media; this would be inconsistent across the remainder and costly on the target hardware. No hover preview implementation is added.
