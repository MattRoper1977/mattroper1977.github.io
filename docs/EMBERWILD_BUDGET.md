# Emberwild byte budget

Ruled under Order SC1 §4.4 (2026-09-02). Numbers here were measured, not
chosen; re-derive them before changing the budget.

## What was retired

`tools/verify_emberwild_bayer.mjs` asserted a single raw ceiling of
409,600 B for `emberwild/index.html`. Emberwild sat at 379,962 B, 7.2 %
headroom, and three successive upgrade attempts were shaped by that
arithmetic rather than by what the game needed. The ceiling measured the
wrong quantity: GitHub Pages serves the file gzipped, so what a child on a
school connection downloads is the wire size, about 29 % of raw, and the
cost a large single file really carries on a low-end phone is script parse
and evaluate time, which gzip does not relieve.

## The budget that replaces it

Three parts, per title, for `/emberwild/` only. The estate rule for other
titles is untouched.

- raw bytes: at most 512,000 B (asserted by the Bayer verifier)
- wire bytes: at most 160,000 B gzipped at level 6 (asserted by the Bayer
  verifier)
- parse: at most 2x the estate median long-task total at boot under a 6x
  CPU throttle. This is a browser measurement, not a static check; it is
  recorded here and re-measured by the games census, not pinned in a gate.

## Where Emberwild stood when ruled

Measured 2026-09-02 against Site main `19ba3994` (emberwild/index.html
381,881 B):

- raw 381,881 B, headroom 130,119 B
- wire 110,579 B gzipped (29.0 % of raw), headroom 49,421 B
- parse: 316 ms long-task total at 6x throttle against an estate median of
  421 ms across 59 routes, so the 2x line was 842 ms and the headroom 526 ms

## Firing controls

Run through the verifier's own entry point (`node
tools/verify_emberwild_bayer.mjs <root>`) with a padded copy of the file:

- 140,000 B of repeated comment bytes: raw 521,890 B reds the raw check
  while the wire check stays green (the padding compresses away)
- 120,000 B of hex-encoded random bytes: raw 501,890 B stays green while
  the wire check reds at 176,946 B gzipped

Both were observed red by name on the day of the ruling.
