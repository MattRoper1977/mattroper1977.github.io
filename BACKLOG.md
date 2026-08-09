# Backlog — ordered, top item first

Named, ordered, and each one carries the evidence needed to start it without
re-deriving anything. Last re-ordered 2 August 2026.

**Every item declares its kind**, because a backlog that does not distinguish
*waiting on a ruling* from *waiting on someone to do it* quietly turns the
second into the first:

- **ruling-pending** — the work is understood; someone has to decide.
- **work-pending** — the decision is made; someone has to do it.

And its class, because they are not equally urgent:

- **instrument** — something that reports on the estate. Fix these first: every
  future report depends on them, and a false green is invisible by definition.
- **content** — something the estate serves. A missing page is at least visible.

---

## 0a. `verify_professional_site.js` — 8 findings, cause identified, two one-line fixes not yet authorised

**instrument · ruling-pending** — and more urgent than it looks: see the note at
the end of this item about steps 6–8.

`verify-games-audience-faces.yml` fails on `main` at *Verify professional shell
preservation against the target*. Eight findings: five "authorised homepage
region … matched 0 times (expected 1)", a logo visual change, authored body
wording outside permitted regions, and privacy copy changed without an account
sentinel.

**Do not "fix" these by adjusting the expectations.** Nothing below changes an
expectation; it identifies what the check was comparing.

### What `base` is — printed at run time, not inferred

Instrumented copy of the verifier, run exactly as CI runs it:

```
base argument      : "origin/main"
base rev-parse     : d0f9c2ae965d66a76af90595a08fb8cdfc27fd01
base full name     : refs/remotes/origin/main
base is a live URL : false
overrides          : null
```

So `base` is an ordinary **git ref** — not a live URL, not a pinned snapshot
artefact — and `overrides` is `null` on the failing run. The findings are about
what is committed, not about what is served. Call sites agree:
`professional-site-design-audit.yml` passes `--base origin/main`;
`verify-games-audience-faces.yml` passes `origin/main` on a pull request and
`HEAD^` on a push.

### The mechanism

`verify()` maps the baseline path for the homepage and only the homepage:

```js
const baselineRel = rel === 'main/index.html' ? 'index.html' : rel;
```

Printed at run time, that is what the two sides actually are:

| side | read from | bytes | `<title>` |
|---|---|---|---|
| baseline | `origin/main:index.html` | 14,780 | Learning and creation, made simple. · Made by Matt |
| current | worktree `main/index.html` | 69,047 | Made by Matt — Learn • Build • Explore |

The baseline is **the audience chooser**. The other six key pages read
`base:<same path>` and are byte-identical to the worktree. The five regions do
not appear in the chooser because they never did — note the failing labels say
`main/index.html *baseline*`, which is the side being read, not the page.

### Why it was once right, and when it went stale

The remap and `main/index.html` arrived in the same commit, `50817f0` (#110),
which moved the professional homepage from `/` to `/main/` and gave `/` to the
chooser. Against a base that predates that move, comparing the new
`main/index.html` against the old `index.html` was the correct preservation
comparison. It is a **one-shot mapping**: every base since #110 merged already
contains `main/index.html`, so the comparison has been reading the chooser ever
since.

### What each finding costs

- **7 of the 8** come from the remap. Same verifier, remap disabled as a
  measurement only: **1 issue remains**.
- **The 8th is independent.** `b11b449` ("Recover the PR #110 audience
  discovery implementation from `.mbm-closeout`") *replaced* the privacy page's
  sentinel line rather than adding to it —
  `mbm-accounts-members-mailing-2026-08-08` became
  `mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09`. The
  account/mailing copy that sentinel authorises is still on the page (the
  Supabase and Buttondown rows, the deletion contact). `members/index.html`
  kept its sentinel; `privacy/index.html` lost it.

### The cost that is not in the finding count — now fixed

`main()` exited on the first failure, before `--self-test`. So the **four
positive controls had not run on `main` since #110 merged** — the step that
proves this gate can fail had itself been failing before it reached them.

`--self-test` now runs every control and aggregates. Doing that exposed a
second defect the old shape hid: the control *unrelated authored-copy mutation
rejected* looks for the message "authored body wording changed", **which is
already finding 7 of the baseline**. Compared against zero it would have
reported PASS without its mutation doing anything. Controls are now evaluated
as a delta against the unmutated run, and a signal already present in the
baseline reports INCONCLUSIVE. Recorded as species 6 and 7 in
`docs/VERIFIER_FAILURE_MODES.md`.

Swept for the same shape: 66 tools, 19 with a control suite, **3 with the
defect** — this file plus `verify_games_audience_faces.py` and
`verify_education_hub.py`, both of which returned before dispatching their
controls. All three now aggregate; all three proved on a red subject.

### Sentinel sweep (0a-B context)

59 HTML files scanned, 16 carry a sentinel, and **none carries more than one** —
so the additive model does not exist anywhere in the estate yet. Pages carrying
prose authored by a pass whose sentinel is absent:

- **`privacy/index.html`** — 20 accounts/mailing prose markers, sentinel
  displaced by the closeout pass. The known finding.
- **`main/index.html`** — 6 accounts/mailing and 4 device-local-counter prose
  markers, and **no sentinel at all**. Two authorising passes, nothing recorded.
  It escapes the check because the verifier governs `main/` by region
  comparison rather than by sentinel, but under an additive rule it is the
  clearest multi-pass page in the estate.

Eleven further apparent hits are false positives and are named here so nobody
re-derives them: generic English ("auto-saves on this device" in two game
pages), or one pass writing *about* another's feature — the locked chooser copy
names Supabase and Buttondown in order to promise it does *not* use them, and
that sentence is authored by the audience pass, which is the sentinel it
carries. **Writing about a feature is not being authorised by that pass**, and
any additive rule needs to say so or it will flag half the estate.

### Measured, not applied

With `baselineRel = rel` and the account sentinel restored alongside the
closeout one, the verifier passes **and all four controls fire**, including
*unrelated authored-copy mutation rejected* — so the corrected baseline path
still catches drift and this is not a vacuous green.

Neither change was made. Both await a ruling.

**0a-A · the remap.** Remove it, and add an explicit precondition in its place:
if `base` does not contain `main/index.html`, **fail with a message naming the
reason**. Not a conditional — a conditional silently substitutes a different
file and is indistinguishable from correct behaviour until it isn't, which is
how this defect survived. A pre-#110 base should be an explicit, deliberate
invocation, not a hidden branch.

**0a-B · the sentinel. The additive proposal was withdrawn; this replaces it.**
Three objections defeated it:

- No page in the estate carries two sentinels (59 HTML files, 16 sentinels), so
  additive sentinels would be **inventing a convention, not restoring one**.
- Name-matching cannot decide authorship. The locked chooser copy names
  Supabase and Buttondown *in order to promise it does not use them* — that
  sentence is authored by the audience pass. A rule keyed on names would flag
  half the estate.
- The real gap is `main/index.html`, which carries accounts/mailing prose and
  counter prose with **no sentinel at all**, escaping only because the verifier
  governs `/main/` by region comparison.

So: **one sentinel per page stays**, meaning the pass that last authored the
file, and authorisation becomes a **declared input** — a map of page →
authorising passes, in the same class as `gameIdOverrides`, `canonicalAliases`
and `reclassifyAsGame`. A relation that cannot be derived from the page gets
written down where it can be reviewed.

The boundary, written once and applied consistently: **copy is authorised by the
pass whose feature's behaviour it describes**, not by every pass whose systems
it names. The privacy page's accounts/mailing copy describes the accounts
feature's behaviour. The chooser's sentence describes the *audience-preference*
feature's behaviour and names the others only as things it does not touch.

`main/index.html` gets an explicit entry either way, so it is governed on
purpose rather than by accident. If region comparison is judged sufficient
governance for `/main/`, record that in the map rather than leaving it implicit.

These findings predate the audience-discovery sequence. One of the original
nine was a stale label list and is fixed.

### This is not a cosmetic red — three CI steps are dark behind it

Measured on `main` at `a8bfa2a`, `verify-games-audience-faces.yml`:

```
 3. ok    Verify generated pages and canonical search data
 4. ok    Verify Revision 3 architecture and all positive controls
 5. FAIL  Verify professional shell preservation against the target branch
 6. skip  Verify accounts, Members, Supabase and mailing regressions
 7. skip  Verify JavaScript, Python and embedded-script syntax
 8. skip  Check patch hygiene and remove temporary bootstrap machinery
```

Steps after a failing step do not run. So **`verify_accounts_members_mailing.js`
has not run in CI since #110** — the suite PR #114's own brief named "the gate to
watch, since vendoring touches the auth path" — across the pass that changed the
auth path. It is green locally on the merged tree at 21 passed · 0 failed, which
is why nothing burned. Local green is not the estate's gate.

**Fixing 0a-A un-skips all three steps for free.** That makes it the highest
value change available here: not a red verifier, three gates dark on a live site.

---

## 0b. Deployment provenance — the production matrix could not fail

**instrument · work-pending** — built in this pass; the live legs cannot run
until it is on `main`.

On 9 August the production route matrix printed

```
all 13 routes 200; both removed paths 404; 1 attempt(s)
```

**31 seconds before the deployment it was reporting on existed** (19:45:43Z; the
Pages deployment for `a8bfa2a` completed 19:46:14Z), and printed the identical
line again 8m46s after it completed. Same output, same `1 attempt(s)`, either
side of the event.

The cause is retry-on-failure semantics: it re-checked only routes that were not
200. A route that served 200 before a merge serves 200 after it, so `pending`
emptied on the first attempt and the ladder never engaged. It was measuring that
the site exists.

**Built:** `tools/verify_deployment_provenance.py` and
`.github/workflows/mbm-deployment-provenance.yml`, in three layers — trigger on
the deployment event and take the SHA from the payload; assert GitHub's own
deployed SHA equals the expected one; fetch a *witness* file from the origin and
compare sha256 against the committed bytes. Retry now waits on provenance
mismatch, not on a status code.

**The trap found while building it, worth keeping:** the obvious witness is the
data stamp, and it is the wrong one. `tools/stamp-data.py` only moves when
`site.json` or `data/resources.json` move, and #114 changed neither — a Layer 3
built on the stamp alone would have passed vacuously on the exact deployment
that motivated it. So the witness is chosen per deployment from the files that
actually changed, and where no served file changed the origin genuinely cannot
tell two commits apart and the check reports INCONCLUSIVE rather than a pass.

**To close:** merge, then confirm the workflow fires on a real deployment and
its live negative control goes red. A `workflow_dispatch` cannot be used to
pre-prove it, because GitHub only offers dispatch for workflows already on the
default branch.

---

## 0c. The live gate has been red since #110

**instrument · work-pending** — fixed in this pass; unproven against the origin
until merged.

`professional-site-live-verify.yml` has failed on `main` on every run from
`50817f0` (#110) onward, and passed on the two before it. `PAGE_MARKERS["/"]`
still described the pre-#110 professional homepage:

| required on `/` | reality |
|---|---|
| `id="audiences"` | absent — it moved to `/main/` in #110 |
| `Schools &amp; organisations` | absent — retired by D1 |
| `Partners` | absent — retired by D1 |

So the estate's only live gate was dark for the entire recovery sequence, and
`/main/` — the actual professional homepage — was not checked live **at all**.

The private-copy sweep predicted this: `verify_professional_site_live.py` was
one of two files recorded as holding labels as literals and deliberately left
alone as the riskier live-production class. That call was right at the time; a
gate dark for a fortnight is what changes it.

**Fixed** by deriving the chooser's markers from `data/audience-homepages.json`,
the same file the renderer reads, rather than re-typing a corrected list — which
would only reset the clock on the same trap. Structural literals that genuinely
cannot be derived (`mbm-platform.css`, `mbm-site-header`) say so beside
themselves. `/main/` gained its own entry.

Proven red three ways before green: a label relabelled in the data file only, the
chooser losing a group container, and `/main/` losing `id="audiences"`.

**To close:** merge, then confirm the workflow passes against the real origin.

---

## 0d. `verify_games_audience_faces.mjs` is syntax-checked and never run

**instrument · ruling-pending** — found by the `/` versus `/main/` sweep, which
it passed: its route model is entirely post-#110. The defect is that nothing
evaluates it.

`verify-games-audience-faces.yml` mentions the file three times: twice in a
`paths:` filter, and once as

```
node --check tools/verify_games_audience_faces.mjs
```

which parses it. Nothing in the repository executes it. It is 550 lines of
Playwright assertions — eight viewports, menu and focus behaviour, `/main/`
preservation, all seven audience homepages, pupil adult-feature suppression,
local preference, journeys, first-party requests, overflow — and none of it has
run.

Two documents describe it as though it does:
`docs/MBM_GAMES_AUDIENCE_FACES.md:60` and
`docs/MBM_HOMEPAGE_AUDIENCE_ARCHITECTURE.md:58`. That is species 10 in prose —
a capability advertised and not delivered — and it is why the file reads as
covered rather than dormant.

It also still holds audience labels as literals (recorded in the #114
private-copy sweep). They happen to be current, but **nothing can tell you
whether they stay that way**, because nothing evaluates them. An unrun check is
worse than a stale one: a stale check eventually goes red.

### The docs are corrected; that part needed no ruling

Both documents now say what actually runs. They previously described the `.mjs`
as active coverage, which made the estate's own record of what is protected
wrong — and a stale doc, unlike a stale check, never goes red.

### "Just run it" is not available

Spot-checking 8 of its 78 assertions against the committed tree, **at least
three are definitively stale**:

| assertion | reality |
|---|---|
| root `<h1>` is *"Choose your own homepage type"* | that text is an `<h2>`; the `<h1>` is *"Learning and creation, made simple."* |
| `.mf-main-card` href is `/main/` | the selector matches nothing anywhere in the estate — the chooser uses `.mf-btn primary`, which the static verifier accepts as the alternative |
| `/start/` destination `<h1>` | same as the first |

Two more could not be settled statically because they are rendered at runtime
(the Continue wording, the theme swatches — `theme.js` does inject five, so that
one probably passes). Three of the eight would pass. So switching it on means
repairing it first, and the repairs are in the hard-coded-literal class that
species 14 is about.

### Triage against what runs today

78 assertions, against `verify_audience_discovery_browser.py`'s 49 and the
static verifiers that do run:

**Already covered** — route reachability, sentinel identity, 320px overflow,
root labels/routes/grouping/canonical, `/main/` canonical, og:url, identity
heading, preserved sections, per-audience canonical and H1 and visual floors,
promoted destinations being first-party, pupil adult-CTA suppression, `/start/`
reaching the chooser, `loading="lazy"` at source level.

**Genuinely additive**, roughly 43 assertion kinds in six clusters:

| cluster | kinds | note |
|---|---|---|
| local preference lifecycle | 8 | store, no forced redirect, root marks last choice, Continue panel exposure/href/wording, Forget clears, panel hidden after | nothing behavioural covers this; only the key *name* is asserted statically |
| responsive menu and focus | 8 | visible/hidden by width, ≥43px touch target, starts closed, expands, Escape closes, focus returns to the menu | the CSS rules are asserted at source; the behaviour is not |
| runtime error collection | 4 | page errors, console errors, failed first-party requests, first-party HTTP errors |
| account surfaces, live | 6 | login/register forms, Members loads, tabs, forgot/reset, callback status |
| journeys through the real UI | 5 | opening Menu and the collapsed More disclosure before activating a hidden route |
| theme behaviour | 3 | five controls, applied to `html` *and* `body`, `aria-pressed` |

Plus singles: exactly one `<h1>` per route, image presence and decode failure,
`aria-current` on the audience page, below-fold lazy-loading measured rather
than asserted at source, games top-picks count, promoted destination live status.

**Rough port size:** the additive subset is six coherent blocks, and B7 already
owns the browser scaffolding — contexts, viewports, request capture, the
`Findings` reporter. So this is on the order of 150–200 lines added to the
Python harness, not 550 ported. The preference lifecycle and the menu/focus
block are the two worth doing first; they are the largest genuinely-uncovered
behaviour on the estate.

**Matt's call is the cost, not whether the coverage matters.** Values must be
derived, not re-typed, or this recreates the class the sweep just closed.

---

## 0. `/resources/` — the closeout rewrite is unrecoverable, page never rebuilt

**content · ruling-pending** — the only item here that is genuinely waiting on a
decision rather than on work, and the one that stays printed longest.

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
