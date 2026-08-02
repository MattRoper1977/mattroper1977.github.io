# Backlog — ordered, top item first

Named, ordered, and each one carries the evidence needed to start it without
re-deriving anything. Last re-ordered 2 August 2026.

---

## 1. ~~`/uas/app.html` — vendor the four cdnjs scripts~~ — **DONE 2 August 2026**

Closed. The four libraries and the OCR language pack are vendored under
`uas/vendor/` with a SHA-256 manifest, and the tool now works with no internet
connection at all.

```
PDF text extraction ... PASS   pdf.js, local
PDF export ............ PASS   jsPDF, local
OCR ................... PASS   tesseract.js + eng language pack, local
EXTERNAL REQUESTS ATTEMPTED, WHOLE RUN: 0
```

Verified by aborting **every** non-local request in the browser and running all
three features; a single surviving cdnjs URL would have killed the feature under
test. See `tools/film/verify_uas_offline.mjs`.

**Two things the fix turned up that the backlog entry did not know.** The
language pack `tesseract.js` was quietly fetching from
`tessdata.projectnaptha.com` is **10.9 MB** — bigger than all four libraries put
together, and from a host this container could not even reach to name it last
pass. And with `corePath` pointed at a *directory*, tesseract.js v5 asks for
`tesseract-core-simd-lstm.wasm.js`, a variant the original code never used; the
explicit file path the app already had is the correct one, and the test found
that rather than a reading of the docs.

**Cost, stated because it cuts against an argument made in the same repo:**
`uas/vendor/` is **16.8 MB**, against a 7.3 MB working tree. The launch film was
deliberately *not* committed on the grounds that a Pages repo serves every file
it holds. The difference is that the film is an output that lives on YouTube and
can be rebuilt from `tools/film/`, while these are inputs the tool needs at run
time — and without them the OCR cannot work offline at all, which was the whole
promise. If the size ever bites, `@tesseract.js-data/eng` ships a 2.95 MB
`4.0.0_best_int` model: an 8 MB saving, usually equal or better accuracy, a
little slower. That is a product decision, not a security one.

## 2. `/resources/medevac-frontier/` overflows 1 px at 900 px wide

Small, real, and **not** caused by any recent branch.

**Reproduction, exactly:**

```sh
git archive 69c0457 | tar -x -C /tmp/before && node tools/film/serve.mjs /tmp/before 8452 &
node <ofdiag> http://127.0.0.1:8452 /resources/medevac-frontier/index.html 900 700
#   -> overflow=1px, 5 elements past the edge, first is
#      <div> left=494 right=901 w=407  "A Made by Matt simulationMEDEVACFRONTIER"
```

It reproduces on pristine `69c0457`, so it predates the data-honesty work. Left
alone deliberately: fixing it inside a pass about something else would widen
that pass's claim, which is how a diff stops being checkable.

---

## 3. The 127 missing `added` dates

`data/resources.json` and the Lessons catalogue carry `added` dates on some
items and not others. Until every item has one, "what's new" cannot be derived
and has to be curated by hand — which is why the launch film's biology beat had
to be dated from `git log` rather than from the catalogue.

---

## 4. `og:image` on the Games and Apps repos

The site repo has `assets/og-cover.png` and uses it. The two project repos do
not, so a link to a game or an app shared into Slack, Teams or WhatsApp unfurls
blank.

---

## 5. Featured curation

There is no way to say "these six things first" — the homepage strips are
ordered by `site.json` array position, which conflates *order* with *priority*.
Low urgency; noted so it is not rediscovered.

---

## Closed this session, for the record

- **The contact form** — audited, `_next` fixed to a real thank-you page, copy
  rewritten to measured truth. What remains is Matt's: the activation test and
  the dashboard domain-lock.
- **The accounts surface** — removed. Module kept, fail-closed.
- **`/privacy/`** — written, every sentence traced to a measurement.
- **`stamp-data.py`'s hand-maintained page list** — now derived, with an
  empty-population guard tested in both directions.
- **The launch film** — built, `tools/film/`, publish kit written. Matt uploads.
- **The cdnjs vendoring** — done, above. `/privacy/`, the homepage promise tile
  and `HANDOVER.md`'s third-party table all dropped from four hosts to three in
  the same commit, as that entry required.
- **Drag and drop in `/uas/app.html`** — four defects fixed, the worst being that
  a file dropped anywhere off-target navigated the browser away from an open
  register. 8/8 checks pass; the same checks fail 5/8 on the previous code.
