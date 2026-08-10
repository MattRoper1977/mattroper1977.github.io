# How verifiers in this estate go quietly wrong

Every entry here was found in this repository, not imagined. Each one produced a
green result, or a silent absence of a result, while the thing it claimed to
check was not being checked. That is the family: **not a check that fails, a
check that stops meaning anything without saying so.**

If you are adding or changing a gate, read this first. The cost of these is not
the bug they let through — it is the months of false confidence afterwards.

---

## 1. A check that holds its own copy of the value it checks cannot detect drift

`verify_games_audience_faces.py` kept its own list of public audience labels.
When the labels were changed in `data/audience-homepages.json`, the verifier
went red about a label nothing served any more — and would equally have stayed
green had the pages drifted from the data.

**Rule:** derive from the source of truth, import it, or read it. Never retype
it. The verifier now imports `SENTINEL` from the renderer and derives labels
from the data file.

## 2. A fallback must not report "no problems found" after a strict comparison failed

The per-category search-index check fell back to a field-level diff when the
strict comparison failed. The fallback did not compare key order, so an entry
whose keys were in the wrong order reported "no differences" from inside a
failure path.

**Rule:** a failed strict comparison is the answer. A softer second look may
explain it; it may never overturn it.

## 3. A control must assert it reached the gate it tests

A CI control perturbed a source manifest to prove the writer refuses an
undeclared diff — but the perturbation failed `--check` first, so the run never
reached the write gate, and the control passed on the wrong failure.

**Rule:** a control states which gate it expects to trip, and fails if it
tripped a different one.

## 4. A verifier must not read its reference from a path the subject can write

`build_mbm_search_index.py --check` compared the generator against its own most
recent output, so a wrong generator agreed with itself. It now reads the
committed blob via `git show`.

The same species, differently: `verify_professional_site.js` read its baseline
for `main/index.html` from `index.html` — a path remap that was correct for the
single commit that moved the homepage and has compared the wrong two files ever
since. See BACKLOG.md item 0a.

**Rule:** name the reference explicitly and prove it is the thing you meant.
Print what it resolved to at run time rather than reading the code and
inferring — that is what identified 0a after two passes of guessing.

## 5. Never re-implement a check in another language to test it

A verifier's regexes were translated into Python to find out what they matched.
The translation matched once where the original matched zero times, which very
nearly produced a confident and wrong "the page is fine".

**Rule:** execute the original. Instrument it if you must; do not paraphrase it.

## 6. A control suite that shares a fail-fast path with its subject disables itself

`main()` exited on the first verification failure, before dispatching
`--self-test`. So the four positive controls in `verify_professional_site.js`
had not run since #110 merged: the suite whose only job is to prove the gate can
go red was switched off by the gate being red — precisely when it was worth
having.

Swept across the estate: 66 tools, 19 with a control suite, 3 with this shape
(`verify_professional_site.js`, `verify_games_audience_faces.py`,
`verify_education_hub.py`). All three now aggregate.

Two of the three were **green** at the time of the sweep, and that is the reason
to sweep rather than to wait: a latent instrument defect in a passing tool is
invisible until the day it matters, and the day it matters is the day the tool
goes red.

**Rule:** controls run whether or not the subject verified, and the exit code is
the union. A skipped control is a reported state, never a silent absence.

## 7. With a red baseline, a control that compares against zero passes vacuously

Falling out of fixing 6. The control "unrelated authored-copy mutation rejected"
looked for the message *authored body wording changed* anywhere in the mutated
run. That message was already in the 8-finding baseline, so the control would
have reported PASS without its mutation doing anything at all.

**Rule:** evaluate a control as a **delta** against the unmutated run, never
against zero. If the signal it looks for is already in the baseline, the control
cannot distinguish its mutation from the pre-existing failure — report
INCONCLUSIVE, never PASS.

A control therefore has **four** outcomes, and a suite that cannot express all
four is under-reporting:

| state | meaning |
|---|---|
| `PASS` | the mutation produced the expected new finding |
| `FAIL` | it did not — the gate this control tests is not working |
| `INCONCLUSIVE` | the signal was already in the baseline; this control proved nothing |
| `ERROR` | the fixture could not be built, so the control never reached its gate |

**Each state must itself be proven**, the same way the gates are: `FAIL` by
breaking the assertion a control depends on, `ERROR` by making a fixture
unbuildable, `INCONCLUSIVE` against a genuinely red baseline. A state that has
never been observed is a state you are guessing about.

## 8. A step that reports success while doing nothing

Two in one workflow: an upload step pointed at `artifacts/browser`, which
nothing writes, with `if-no-files-found: ignore`; and a control run wrote its
deliberate failure into the *committed* artifact, so the repository's own record
of the estate briefly described a run that was engineered to fail.

The `ignore` variant is the mirror image of a failure earlier in this sequence,
where `error` on a mismatched path turned a working proof red. Same defect, two
symptoms: **the workflow's path and the tool's path had drifted apart, and
nothing compared them.** Choosing between `ignore` and `error` is treating the
symptom.

**Rules, all three:**

- an artifact step **fails on absence** (`if-no-files-found: error`) — a
  silently empty upload is worse than a red step;
- **assert the workflow's path and the tool's configured output path agree**,
  rather than trusting that they do. `mbm-audience-discovery-closeout.yml`
  imports `ARTIFACTS` from the tool and compares it with the `path:` it
  declares;
- **control runs write to scratch** (`--artifacts`), so the committed record can
  never be a control's, and the control step asserts the committed artifact is
  untouched afterwards.

## 9. A retry conditioned on the wrong signal never engages

The production route matrix was told to re-check at 5, 10 and 15 minutes before
failing — retry-*on-failure* semantics. It re-checked only routes that were not
200. A route that served 200 before a merge serves 200 after it, so the pending
set emptied on the first attempt and the ladder never ran. The check reported

```
all 13 routes 200; both removed paths 404; 1 attempt(s)
```

**31 seconds before the deployment it was describing existed**, and printed the
identical line 8m46s after it completed.

A check that produces the same pass whether or not the thing it tests has
happened is not a weak check — it is not a check. And it was not detectable from
its output: `1 attempt(s)` reads like confidence.

**Rule:** retry on the signal that is actually still settling, not on the one
that happens to be easy to observe. For a deployment that is *provenance*
mismatch — the served bytes not yet being the expected commit — never a status
code. Ask what the check would report if the event had not happened; if the
answer is "the same thing", the signal is wrong.

## 10. A declared input that is silently discarded

`published-live-verify.yml` accepted a `paths` input and the step that ran
hard-coded `/ouroboros/ /novasiege/`. A dispatch asking for other paths proved
the default two and reported success.

Worse than having no input, because it advertises a capability that does not
exist — someone reaches for it during an incident and gets a green answer to a
question they never asked.

**Rule:** wire the input through or delete it. If a parameter is accepted,
something must be able to fail when it is wrong.

## 11. A signal chosen without checking it is sensitive to what is being measured

This is the one that keeps recurring, and it is the parent of 9. Twice in a
single day a specification named a signal that could not move with the thing it
was supposed to detect:

- **retry on a non-200**, to detect a deployment — but the routes already
  existed, so the signal was constant across the event;
- **the data stamp**, to detect which commit is served — but the stamp hashes
  only `site.json` and `data/resources.json`, and the deployment under test
  changed neither, so the stamp was byte-identical either side of it.

Both would have produced a confident green about something that had not
happened. Neither was a coding error; both were signal choices made without
asking the one question that settles it.

**Rule:** before adopting a signal, ask **"what would this read if the event had
not happened?"** If the answer is "the same thing", it is not a signal. Prove
sensitivity on a real case — for provenance that means checking the witness
actually differs between the two commits, which is why the witness is now chosen
per deployment rather than fixed in advance.

## 12. A negative control that goes red for the wrong reason is not a control

Strengthens 3. A control that asserts only "it failed" is satisfied by any
failure — a typo in a path, an unreachable host, a missing fixture. It then
reports the instrument as working while testing nothing.

The deployment provenance control asserts that the failure message **names the
SHA it passed in**, so a red caused by an unrelated fault is not counted.

**Rule:** every negative control asserts that the failure message identifies its
own subject, not merely that a failure occurred.

## 13. A derived marker catches drift that a corrected list cannot

The positive form of 1, and the reason a stale list is never fixed by writing a
better list. `PAGE_MARKERS["/"]` had gone stale; re-typing the current labels
would have produced a passing gate with the identical defect, waiting for the
next relabel.

Deriving them from `data/audience-homepages.json` — the file the renderer reads
— changed what the gate can see: **a label changed in the data file alone is now
detected**, which the hard-coded list could not do by construction, at any point
in its life, no matter how carefully it was maintained.

**Rule:** prefer derivation not because it is tidier but because it detects a
strictly larger class of drift. When a literal is unavoidable, say beside it why
it cannot be derived.

## 14. An instrument with an opinion about layout should derive it

The design rule behind 1 and 13, and the thing a sweep of nine instruments
actually established.

Three instruments were caught believing `/` was the professional homepage after
#110 moved it to `/main/`: the preservation baseline remap, the sentinel
governance for `main/index.html`, and `PAGE_MARKERS`. The sweep expected to find
more, and found none — but the interesting result was *which* instruments
survived.

`verify_home_doors_baseline.js` carries a pre-move name — "home doors" — and is
entirely current, because it never had a route opinion to go stale: it validates
`site.json`'s `doors[]`, and the data followed the move. `stamp-data.py` is the
same: it discovers its pages by walking for the scripts that fetch data, so a
page moving changes nothing.

Every instrument that broke held a **hard-coded** opinion about layout. Every
one that survived **derived** its opinion from data. The name is irrelevant; the
literal is the defect.

**Rule:** an instrument that must know where something lives should read that
from the file that owns it. Where it genuinely cannot, the literal is a known
liability — say so beside it, so the next person moving a page knows which
instruments they have just invalidated.

## 15. A fix is applied where it was applied, never where it was discussed

The provenance tool was given a retry that waits on the right signal. Its
sibling, the production route matrix in
`mbm-audience-discovery-closeout.yml`, was **not touched**, and a later
instruction described it as *"now that its retry waits on the right signal"* —
an assumption that a fix discussed in one place had landed in another. It had
not: `delays="0 300 300 300"`, retry-on-non-200, unchanged.

Cheap to catch and easy to miss, because the corrected instrument and the
uncorrected one share a vocabulary and a purpose. It went the same way twice
more in one afternoon:

- `MBM_FULL_ESTATE=1`, `MBM_LIVE=1` and `MBM_CACHE_BUST=${GITHUB_SHA}` were
  still being set for a step that had been switched from the `.mjs` to the
  Python harness. Only the `.mjs` reads the first; nothing reads the other two.
  `MBM_CACHE_BUST=${GITHUB_SHA}` is the one to remember — it looks exactly like
  a provenance mechanism tying a run to a commit, and did nothing whatsoever.
- Two step names kept the `.mjs`'s vocabulary — *"permanent"*, *"matrix"*,
  *"journeys"* — on steps running a tool that does none of those things.

**Rule:** when a fix has siblings, name them and check each one. And when
switching a step from one tool to another, the surrounding scaffolding —
environment variables, step names, docs — is part of the switch. **A step name
is documentation with a CI badge attached**, and it is read far more often than
any file in `docs/`.

## 16. When derivation would change what is on screen, declare the exception

Species 14 says derive. This is its boundary, and the estate has now reached it
three times: `gameIdOverrides`, the proposed page-to-passes authorisation map,
and `chooserLinkText`.

Four of the seven chooser link texts differ from both `label` and `navLabel`.
Deriving them would have been tidier, would have satisfied every gate, and would
have **silently rewritten four visible link texts** — *"Open family homepage"*
becoming *"Open parent & carer homepage"*, and three more.

Derivation is a property of the instrument. Copy is a property of the product.
When they disagree, the instrument does not get to win by being neater.

**Rule:** where derivation would change what a visitor sees, record the value as
a declared input in the file that owns it, with a note saying why it cannot be
derived. That is not an exception to species 14 — it is the same principle,
which is that a value should live in one reviewable place rather than as a
literal inside a page.

---

## 17. A step that could never have passed, hidden by a red above it

The `py_compile` list in `verify-games-audience-faces.yml` named
`tools/verify_audience_discovery_closeout.py` — **a file that has never been
committed to this repository.** Not deleted; never created. That step was
invalid from the day the line was written, and nobody ever saw it fail because
nobody ever saw it run: it sat behind a step that had been red since #110, and
GitHub skips the rest of a job after a failing step.

**The corollary is the part worth keeping: the skipped-step pathology hides not
only real failures but configuration that was never valid in the first place.**
One red step above is enough to make a permanently broken step look like part of
a working suite, indefinitely.

Deleted and never-existed are different defects. A deletion is drift — something
moved and a reference did not follow. A never-existed reference means nobody has
ever run what that line describes, so whatever it was meant to check is
unchecked and always has been.

**Rule:** assert that every path a workflow references exists, as a standing
guard rather than a sweep — `tools/check_workflow_paths.py`. The class is
invisible by construction, so it will not be found by looking.

## 18. A stale local base

A branch for new work was cut from `50817f0`, a commit from the #110 era, because
the local `main` lagged the remote by two merges. Caught on the status readback
before anything was written, but only by luck of reading the output.

Nothing about the local branch says it is stale. `git checkout -B new main`
reads identically whether `main` is current or a fortnight behind.

**Rule:** re-derive the base from the remote immediately before branching —
`git fetch origin main` then branch from `FETCH_HEAD`, or update local `main`
first and verify the SHA. **Never trust local `main`.**

## 19. A substring assertion on an identifier is defeated two ways

`verify_games_audience_faces.py` asserted the mechanism existed with
`"reflectMailingFooter" in platform_js`. Renaming the definition to
`reflectMailingFooterGone` **satisfied it** — the old name is a substring of the
new one.

The first fix, matching `\breflectMailingFooter\b\s*\(`, **also passed**,
because a **second occurrence at the call site** still matched while the
definition was gone.

Both holes were found by the control, not by review. *A control that only ever
goes green would have shipped both.*

**Rule:** assert against the anchored **definition site** —
`function\s+<name>\s*\(` — not a bare substring and not any mention of the
name, **and confirm the assertion fails when the definition alone is changed.**
A fix that passes without that proof is the same defect wearing a repair.

Swept across the estate: 191 functions defined in `assets/*.js`, 24 assertions
naming one, 23 coincidental collisions (`sha256`, `search`), **one genuine bare
assertion** — on `adultFeaturesAllowed`, the pupil adult-feature boundary, which
is the most load-bearing assertion in the estate. Now anchored, and proven to
fail on a definition-only change.

---

## 20. A byte-exact check scoped to a delimited region cannot see the defect just outside it

`spliced_main_page()` regenerates the region between `MBM-AUDIENCE-CARDS:BEGIN`
and `:END` and **passes everything outside it through verbatim**:

```python
return html[:start] + generated + html[end + len(CARDS_END):]
```

So `render_audience_homepages.py --check` compares the file against itself
outside the region. It was byte-exact and **green** while `/main/` served
**thirteen** audience cards in one `role="list"` — the seven generated ones plus
six legacy duplicates beginning **one byte past the `:END` marker**, carrying no
description and no icon, announced to assistive technology alongside the real
seven.

The duplicates came from the first-run splice in #116, which located the
existing cards with

```python
re.search(r'(?:<article class="mbm-audience-card"[\s\S]*?</article>)+', html)
```

The cards are separated by a newline, so the `+` could not continue past the
first one: it matched **1 of 7**, the generated block replaced card 01, and
02–07 survived. Measured rather than inferred — that exact pattern run against
the pre-#116 file matches a 191-byte span containing one `<article>`.

Two lessons, and the second is the general one:

- **A repetition of a non-greedy group is not "all the adjacent ones."** If the
  items are separated by anything at all, it matches one. Anchor on
  first-start to last-end, or match the container.
- **A region-scoped generator must also assert the absence of its own output
  kind outside its region.** The region check answers *is what I generated
  correct*; it cannot answer *is what I generated the only thing here*. Those
  are different questions and only the second catches this.

`check_main_audience_cards()` now asserts the count against
`len(data["audiences"])`, that **zero** cards lie outside the region, and that
each card's route and link text match the data — proven red by re-inserting a
legacy card, by deleting a generated one, and by rewriting a declared
`chooserLinkText`.

---

## 21. A comparison is only as wide as its extractor

`verify_games_audience_faces.py` proved the brand resolver's route table had not
drifted from the data file, by comparing both sides:

```python
js_routes = dict(re.findall(r"(\w+):'(/for/[a-z-]+/)'", audience_js))
data_routes = {aid: a["route"] for aid, a in config["audiences"].items()}
```

Correct, and it caught real drift. But the extractor **can only ever see routes
under `/for/`**. When `/main/` became a selectable homepage type on 2026-08-10
and `main:'/main/'` was added to `ROUTES`, that entry was invisible to the
pattern — and the right-hand side was built from `audiences`, which does not
contain it either. Both sides are filtered by the same unstated assumption, so
they agree **by construction**: the check would have gone on reporting seven
against seven, and reporting agreement, about a list it was not reading.

This is not species 11. There the signal did not move when the event happened.
Here the signal is fine; the **extractor silently narrows the domain**, and a
comparison over a narrowed domain is a comparison about something else.

**Rule:** extract from the **named container** — `var ROUTES={…}` — and parse
every entry in it, then compare against the full declared set. If the extractor
returns nothing, that is a finding, not an empty agreement. Proven red by
deleting `,main:'/main/'` from the table.

---

## 22. When the fix makes a bar easy to clear, the control has to break the fix

The dark theme repainted the chooser cards, and the accents kept painting raw:
2.0–2.9:1 for the seven audience colours on the dark icon square, all under the
3:1 bar for non-text UI, and **1.18:1** for the platform option, whose accent is
the brand navy. Not dim — gone.

No accent can fix that from the data side. The same colour has to clear 4.5:1 on
the cream surface, which forces it dark. So the theme lifts it instead:
`color-mix(in srgb, var(--choice-accent) 45%, #E8E2D4)`, measured at worst
4.03:1.

And that is exactly what makes the new assertion look proven when it is not. At
a 45% lift **almost no colour can fail the 3:1 bar** — even pure black clears it.
A control that mutates the accent therefore passes trivially, or cannot be
constructed at all, and the assertion ships unfalsified while looking green.

**Rule:** when a mechanism is introduced *because* a bar could not otherwise be
met, the control must break **the mechanism**, not its input. Here the control
re-runs the identical measurement against a recipe that paints the raw accent,
and requires it to go red — it does, for all eight homepage types. If the theme
ever stops lifting, that control is what notices.

---

## 23. A count is not a measurement until its units are stated

Root and `/main/` were reported as **15,253 B** and **72,320 B**, and confirmed a
second time against the shipped files. Both figures were right, and both were
mislabelled: they are `len(path.read_text())` — **characters**. The pages carry
`·`, `—` and other multi-byte UTF-8, so the byte counts are **15,296** and
**72,471**, 43 B and 151 B larger.

Nothing downstream cared until a byte budget did. Headroom against a ~17 KB cap
computed from characters is wrong by exactly the multi-byte content of the page,
and reads as more room than exists.

**Rule:** a size figure states the unit it was taken in, and a byte figure is
taken in bytes — `len(read_bytes())`, `wc -c`, `stat -c %s`. `read_text()`
counts characters. This is the same discipline as asserting on evidence rather
than proxies: a character count is a proxy for a byte count, and the two differ
by however much of the file is not ASCII.

---



## The shape they share

None of these is a wrong assertion. Every one is a correct assertion that
stopped being evaluated, or was evaluated against the wrong thing, without
saying so. So the standing discipline is not "write more checks" — it is:

- **prove red before accepting green**, for every gate, and
- **assert on evidence, not on proxies**: a canvas at its default 300×150 has a
  width greater than zero; a music pad that ticks without oscillators reports as
  playing; a verifier comparing a file against itself always agrees.
