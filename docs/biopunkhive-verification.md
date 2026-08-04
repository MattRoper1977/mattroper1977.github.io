# Biopunk Hive verification note

Sentinel: `biopunkhive-build-2026-08-04`

The playable release is the single self-contained file at `biopunkhive/index.html`. It makes no external requests and uses Canvas 2D, inline SVG and lazily-created Web Audio only.

Run the deterministic contract with:

```sh
node tools/verify_biopunkhive.js
node tools/verify_biopunkhive.js --self-test
```

Run the browser contract after serving the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
BIOPUNKHIVE_BASE_URL=http://127.0.0.1:4173 node tools/verify_biopunkhive_browser.js
```

The browser contract covers 360×640 layout, minimum target sizes, reduced motion, storage isolation, all three breach QTEs, timestamp timers, cryo-anchor integrity, prestige idempotence, import rejection, audio cleanup and a simulated three-minute systems session.
