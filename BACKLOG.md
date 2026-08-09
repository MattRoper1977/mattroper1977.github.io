# Backlog — ordered, top item first

Named, ordered, and each one carries the evidence needed to start it without
re-deriving anything. Last re-ordered 2 August 2026.

---

## 0a. `verify_professional_site.js` — 8 findings against `main/index.html`, cause not established

`verify-games-audience-faces.yml` fails on `main` at *Verify professional shell
preservation against the target*. Eight findings, all about `main/index.html`:
five "authorised homepage region … matched 0 times (expected 1)", plus a logo
visual change, authored body wording outside permitted regions, and privacy
copy changed without an account sentinel.

**Do not "fix" these by adjusting the expectations.** Measured evidence:

- All five region patterns, extracted from the verifier and evaluated in Node
  against the committed `main/index.html`, match **exactly once each**.
- The verifier nonetheless reports 0 for all five.

So the check is not evaluating them against the committed file. It runs
`verify(base, overrides)` and the step is named *against the target* — it is a
drift comparison against a pinned baseline copy that this pass did not locate.

That means neither "the page is wrong" nor "the verifier is wrong" is
established, and adjusting an expectation to reach green would be
indistinguishable from a vacuous green. Left red deliberately.

To start: find what `base`/`overrides` resolve to in the failing path and which
artefact supplies the target. If the target is a pinned snapshot, the question
becomes whether `main/index.html` was intended to move — which is an editorial
call, not a verifier one.

These findings predate the audience-discovery sequence. One of the original
nine was a stale label list and is fixed; the remaining eight are untouched.

---

## 0. `/resources/` — the closeout rewrite is unrecoverable, page never rebuilt

The PR #110 closeout replaced `resources/index.html` with a 12-line page. That
replacement fell inside the corrupted tail of the `.mbm-closeout` blob and is
gone. Checked against all 108 remote branches: no 12-line version exists
anywhere, so it cannot be ported the way `/teach/` was.

`/resources/` is therefore still the pre-closeout 244-line catalogue. That is a
deliberate hold, not an oversight — approximating a page nobody can diff against
the original is how you end up with a rewrite that only looks finished.

No verifier assumes the rewrite landed. The only check touching the page is the
generic chrome assertion in `verify_games_audience_faces.py` (header brand leads
to `/main/`, general navigation offers Choose homepage), which the current page
satisfies on its own terms. Nothing is going green on work that was never done.

To start: decide whether the catalogue should be rebuilt against
`data/mbm-search-index.json` the way `/teach/` and `/education-hub/` are, in
which case it belongs in `tools/render_discovery_hubs.py` alongside them. The
current page predates that renderer and is hand-maintained.

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
`uas/vendor/` was **16.8 MB**, against a 7.3 MB working tree. The launch film was
deliberately *not* committed on the grounds that a Pages repo serves every file
it holds. The difference is that the film is an output that lives on YouTube and
can be rebuilt from `tools/film/`, while these are inputs the tool needs at run
time — and without them the OCR cannot work offline at all, which was the whole
promise.

**That cost was then cut, on Matt's call, 2 August 2026.** The language pack was
swapped for the `4.0.0_best_int` model: **10,923,060 → 2,952,873 bytes**, so
`uas/vendor/` is **9,650,123 bytes, down from 17,620,310 — a 7,970,187-byte
saving, 45.2% of the directory.** (Decimal MB: 17.62 → 9.65. The **16.8 MB**
written above is MiB — a unit slip this repo made and is now correcting.)

Measured before and after on clean and degraded renders: **44/44
words both ways, identical confidence, character-identical transcripts, and no
time difference outside the run-to-run spread.** Controlled by measuring the
bytes actually served (10,923,060 vs 2,952,873 in fresh profiles) because
identical output usually means the swap did not take.

The earlier note here said `best_int` was *"a little slower"*. **That was an
assumption written without measuring it and the measurement does not support
it.** See `uas/vendor/MANIFEST.md` for the full table and the revert.

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

## 5. Five public pages missing from `sitemap.xml`

Found while making `/members/` reachable. `sitemap.xml` carries **440 `<loc>`
entries**; of the **19** public (non-`next/`, non-`noindex`) HTML pages in the
repo, these are absent:

```
404.html                                deliberate — never sitemap a 404
hub-highlight-card.html                 a partial, not a page
medevac/MedevacFrontier_v1.html         looks superseded
medevac/studio.html                     looks superseded
resources/medevac-frontier/index.html   probably SHOULD be listed
```

`/privacy/` and `/members/` were added in the same pass that found this. The
first four look correctly excluded; **`resources/medevac-frontier/` is a real
teacher-facing page and is the one worth a decision.** Left alone rather than
swept in, because widening a pass's claim is how a diff stops being checkable.

---

## 6. Featured curation

There is no way to say "these six things first" — the homepage strips are
ordered by `site.json` array position, which conflates *order* with *priority*.
Low urgency; noted so it is not rediscovered.

---

## Closed this session, for the record

- **The contact form** — audited, `_next` fixed to a real thank-you page, copy
  rewritten to measured truth. **The activation question is answered: Matt found
  the activation mail unclicked and clicked it on 2 August 2026, so the form
  delivers from that date and delivered nothing for the 15 days before it**
  (`first live 2026-07-18`, measured across 137 first-parent commits — see
  `reports/close/2026-08-02-form-complete.md`). What remains is Matt's: the
  one-button CORS probe at `/cors-test.html` that decides PR #25, and the
  dashboard domain-lock. **No public page claims the form works** — that is
  Matt's evidence, not a stranger's.
- **The accounts surface** — removed, then **restored the same day** in the
  shape Matt asked for: free account, per-account save slots, bonus content in
  Apex Kick and Voxel Frontier **enabled** for account holders rather than hidden
  (gating is impossible on static hosting — both games return HTTP 200 in full to
  a plain fetch, measured). Plus a separate adults-only teacher list with its own
  required opt-in tick, reusing the existing FormSubmit endpoint so no new third
  party. `FEATURES.md` §3.
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
