# How verifiers in this estate go quietly wrong

Every entry here was found in this repository, not imagined. Each one produced a
green result, or a silent absence of a result, while the thing it claimed to
check was not being checked. That is the family: **not a check that fails, a
check that stops meaning anything without saying so.**

If you are adding or changing a gate, read this first. The cost of these is not
the bug they let through — it is the months of false confidence afterwards.

---

## Standing practice: how a census is validated here

Three censuses now run as gates — short-circuiting pipelines (`s15`), typed
literals (`s16`), and the microcopy register's scope. Each one found defects in
*itself* before it found any in the estate, and each found them the same way.
This is the method, and it is not optional:

1. **Measure recall against a cruder instrument, never against yourself.**
   Re-reading a census will not surface its blind spots, because the blind spot
   is in the reading. Run a deliberately stupid `grep` beside it and reconcile
   the two counts. 22 against 24 found a pipe hidden inside `"$( … | … )"` and a
   whole directory of workflow YAML that was never walked. Neither gap was in
   the grep. **If the two disagree, the census is wrong until proved otherwise.**
2. **Read the sites, not the buckets.** A classifier that files the dangerous
   case in the safe pile is worse than no classifier, because the pile now has a
   name that says it was checked. A bare `! producer | grep -q` was filed
   *false-red* when it is the shape that certifies an absence nobody looked for.
3. **Narrow by reading, not by counting.** Both censuses first reported ~54 and
   ~24 "live" sites, most of them correct code. An inflated census gets skimmed
   exactly like an unscoped sweep does. Narrow it by looking at what it flagged
   and asking what actually distinguishes a defect — *bound vs unbound*, *live
   pipe vs herestring*, *explained vs unexplained* — never by raising a
   threshold until the number looks tolerable.
4. **Plant the blind spots as permanent fixtures.** A fix that has never been
   tested against the case that produced it is a hypothesis.
   `tools/fixtures/census-blind-spots/` holds one instance of each, and
   `tools/verify_pipe_census_controls.sh` re-proves them on every run. They live
   as files rather than heredocs because **a fixture written inside a heredoc
   reads as live code to any scanner** — which the census proved by flagging its
   own control file.
5. **Park, never drop.** A site in a file that does not run is named and
   labelled `NOT LIVE`, in the output. A census that quietly narrows its own
   scope is the thing all three of these exist to catch.

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

**Swept 2026-08-10**, bounded to `tools/` and `docs/`, asking one question of
each figure: *is this characters or bytes, and which does its consumer expect?*
Every Python tool: clean — no `len()` over decoded text anywhere. In JavaScript
most `.length` figures are on a `Buffer` or an array and are genuinely bytes
(`verify_apexpool_landing`, `verify_published_live`, `render_olympics_stills`,
`verify_neonsync_browser`); `verify_apexgolf` already says "serialised
characters". **Two genuine cases**, both in `verify_ouroboros.mjs`, both
reporting the length of a localStorage *string* as "bytes written". Neither
assertion depended on the unit — only the evidence line did — so both are now
labelled `characters`.

And the budget the species was found on is now enforced in bytes, printed on
every run: `ROOT_WEIGHT_CAP` in `verify_games_audience_faces.py`.

---

## 24. A trap you have named is not a trap you have closed

Species 23 — *a count is not a measurement until its units are stated* — was
recorded after root and `/main/` were reported as **15,253 B** and **72,320 B**
when both were character counts.

The part worth recording is not the mistake. It is that the **same two files had
already been measured in both units, in the same session, and the difference
explicitly noted** — 43 and 151 bytes of multi-byte UTF-8. The trap was known,
written down, and walked into two passes later, on the same two numbers.

Writing a species down creates the feeling of having handled it, and that
feeling is the failure mode. A register entry changes nothing on its own: it is
a note to a future reader, not a check. Every entry here that has stayed closed
stayed closed because something **executes** — a control, a gate, a derived
value that cannot be typed wrong.

**Rule:** when a species is recorded, ask what now *executes* to catch it. If
the answer is "we will remember", the entry documents a hazard rather than
repairing one, and it should say so. Species 23 now has `ROOT_WEIGHT_CAP`,
measured in bytes and printed on every run — that is the part that closed it,
not the paragraph.

---

## 25. A finding inferred from your own re-implementation is true of nothing

A census of `hud.js` coverage was challenged on the grounds that it had counted
ternary expressions as matches. It had not: the ternaries were in a **regex
written to audit the census**, not in the census. The audit re-implemented the
thing it was auditing, the re-implementation had a defect, and the defect was
then reported as a finding about the original.

This is species 5 — *never re-implement a check in another language to test it*
— arriving from the other direction. There the second implementation produced a
false green; here it produced a **false red**, attributed to code that never had
the problem. False reds are the more expensive of the two, because someone then
goes and "fixes" working code.

**Rule:** to test an instrument, drive **the instrument** — mutate its input and
require its verdict to move. A second implementation can only ever tell you that
two things disagree, never which of them is wrong.

---

## 26. A harness ported between language bindings inherits the syntax, not the semantics

`verify_hud_on_lessons_games.mjs` was written by porting a working Python
harness. Python's Playwright binding accepts a **function source string**:

```python
page.evaluate("(id) => { ... }", "mbmhud-back")   # calls it with the argument
```

The Node binding does not. It evaluates a string as an **expression**, so the
arrow function is constructed, the argument is discarded, and the result is a
non-serialisable function — which arrives back as `undefined`.

Every probe in the ported suite returned `undefined`. Nothing threw. No error
appeared anywhere. The suite was **green by never asserting anything**, and it
looked exactly like a suite that had passed.

It was caught only because one assertion was written to compare against a
specific string (`'ON TOP'`) rather than to test truthiness. Had it been
`if (result)`, the port would have shipped.

**Rule:** a harness moved across language bindings is a **new** harness. Prove
at least one assertion in it can go RED in the new binding before trusting any
green from it — and prefer real functions over source strings, because a real
function cannot be misread as an expression by anything.

The general form is worse than the instance: **the failure mode of a mistranslated
binding is silence, not error.** A binding difference that threw would have been
found in a minute.

---

## 27. Units belong on counts, not only on sizes

Species 23 was about bytes — 15,253 characters reported as bytes. The next
report made the same class of mistake on a **count**: ten wired Lessons games
read as eleven files, because one of the filenames is
`Trekkers_Trail_Runner (2).html` and the bracketed 2 reads as a quantity.

Nothing about species 23 is specific to bytes. `555` is not a measurement until
it says whether it counts routes, files, assertions or viewports; `39 games` is
not one until it says whether a game is a route or a file — here it happens to
be both, and one filename was enough to make that stop being obvious.

**Rule:** every figure in a report or a tool's output carries its unit, and the
unit names the thing counted, not its container. The HUD tools now print
`assertion(s)`, `route(s)`, `file(s)` and `viewport(s)` at every figure, and the
ledgers say which of those they mean.

---

## 28. A liveness threshold that encodes the harness's own frame rate

`verify_games_offline_runtime` counts requestAnimationFrame ticks in a 1200 ms
window and calls fewer than five a stall — reported as `webgl-stalled(4raf)`.
In a headless browser without hardware acceleration rAF is throttled, so a page
that is running perfectly well delivers four ticks. `Trail_Runner.html` and
`Trekkers_Trail_Runner_Tees_Coast.html` were carried as broken for two passes on
that number. Driven with a real browser both build a full-viewport canvas, tick
eight frames, report WebGL available and raise no errors.

The rebuilt gate then made the *same* mistake from the other end: it calibrated a
floor at 25% of a blank page's rate, and nine games failed it, none of them
broken. They open on a menu and are legitimately idle until someone presses
Start. A rate floor also assumes every game is animating.

**Rule:** a threshold on a rate measures whatever is slowest in the stack,
usually the harness. Assert the thing you actually mean — here, that the page can
schedule a frame at all — and print the rate as information beside it.

---

## 29. A control that fails to fail

The dock-geometry sweep's control shrank a button from script and asserted the
sweep went red. It did not: those buttons carry a 1.5 px border and sit in a flex
row, so a height set inline kept measuring at or above the 44 px floor. The
control reported green, which reads as "the gate can catch this" — and would have
certified a gate nobody had shown could catch anything.

The working control rebuilds the actual defect: it serves the pre-fix `hud.js`,
with the `min-height` removed from `.mbmhud-btn`, and requires the sweep to
report the six controls at 28 px.

**Rule:** a control must reconstruct the defect, not simulate it. If the control
itself passes when it should fail, it is a second gate that needs a control.

---

## 30. A gate that judges the game reading something that is not the game

Eleven declared single-file games gained a stamped inline exit region — a
platform control, identical in all eleven. Six gates then reported it as a fault
in the *game*: biopunkhive's storage-isolation scan read the region's one
platform key as a leak through the game's prefixed helper; neonsync counted it as
a second storage-prefix literal; Axiom Shift's id-resolution scan read the
region's runtime `getElementById` calls as ids the game references and never
defines. Two of those six could not have been predicted from reading the
verifiers and were found only by running them.

**Rule:** when a file carries both a game and a platform region, every gate that
asserts something about "this game" must be scoped to the game. One shared
stripper, emitted by the same generator that stamps the region — not a regex
retyped in each gate, which is the second-literal trap once per gate.

---

## 31. An extraction anchored on a position any tag can move

`verify_axiomshift.sh` extracted "the script" by slicing from the first
`<script>` to the last `</script>`. That is not an extraction; it is a guess that
the file holds exactly one block. The moment a second one appears the slice
swallows the first block's closing tag and `node --check` reports
`SyntaxError: Unexpected token '<'` — blaming the game for a fault in the reader.
PR #105 recorded exactly this failure and read it as the game being unable to
carry an external script. The same slice appeared a second time inside
`verify_axiomshift.js`, building its VM shell. `verify_charcoal.sh` and
`verify_offbrand.sh` had walked every block correctly all along.

**Rule:** parse the structure you claim to be reading. An anchor derived from
`indexOf`/`lastIndexOf` over a whole file is a position, and positions move.


---

## 32. A correctly computed number from the wrong instrument

Placing a new game on the shelf needs a hue far enough from every neighbour. The
brief named the formula in `tools/check_audience_accents.py` — CIE76 Euclidean
in CIELAB — and a candidate was derived that cleared every existing hue by a
comfortable margin on that measure. It then failed, because the gate that
actually rules the Sports rail is `tools/verify_sports_rail.js`, and that gate
uses **CIEDE2000 with a floor of 25**. The same pair measured ΔE76 29.6 and
ΔE00 22.9 — one passes, one fails, and the arithmetic was right both times.

This is the second occasion in a fortnight on which two ΔE formulas have
returned contradictory verdicts on one pair of colours.

**Rule:** name the gate that rules, not a formula found elsewhere in the repo. A
correctly computed number from the wrong instrument is still a wrong answer.
Derive against the check that will judge you.

---

## 33. An estimate sitting in a table of measurements

The Phase 1 decision table costed the inline exit control at "~500–800 B per
file". It shipped at **3,222 B** — four times that. The decision does not move:
eleven files at 3,222 B is a cost worth paying, and the reason it was taken (a
child on a locked-down device can leave the page) has nothing to do with the
byte count. But the figure sat unlabelled among measured ones in a table whose
other rows were all measurements, and it was read as one.

**Rule:** an estimate in a cost table is labelled as an estimate, or it will be
read as a measurement. Ledgers carry the measured figure once it exists.

---

## 34. A guardrail whose refusal is unreachable

`tools/build_mbm_search_index.py` protects the search index with `--write
--expect-diff`: every changed leaf path must be declared or the write does not
happen. Sound, and it did block a careless rewrite. But its control flow is:

    if failures:            # the reproduce check, comparing by POSITION
        raise SystemExit(1)
    if args.write:          # the declaration machinery

so `--write` is only ever reached when the entries already reproduce — that is,
only when there is nothing to write. Confirmed both ways: on a clean tree it
runs and prints "nothing to write"; with one entry added it exits 1 at the
reproduce check without evaluating a single declared path. No game or app can be
added to this index by the tool that owns it.

The diagnosis was initially milder — "declaring dozens of paths is tedious" —
because the positional diff reported 59 untouched entries as changed and that
looked like the whole problem. It was a symptom of the same alignment defect.

**Rule:** a guardrail is only as good as the path that reaches it. If the strict
branch can only run in the case where it has nothing to do, the protection is
unreachable and the tool has quietly stopped being able to do its job. Test the
refusal path with a real change, not only the acceptance path with none.



---


## 35. A mutation harness that counts a crash as a rejection

`apexpool-home-verify.yml` proves four static failure families by mutating a
fixture and requiring the validator to reject it. `reject()` decided that by
exit status:

    if python3 tools/verify_apextennis_home.py ... > log 2>&1; then
      echo "validator accepted ${family} mutation" >&2; exit 1
    fi

Any non-zero exit counted as a rejection — including the validator dying. And
it was dying: its baseline came from `origin/main:index.html`, the full
homepage for exactly one commit before #110 gave `/` to the chooser, so
`re.search(r'<section[^>]*id="newrelease"...').group(0)` raised
`AttributeError` on every invocation. The clean run and all four mutated runs
crashed identically, so all four families reported PASS while measuring
nothing. Masked twice over — behind the doors-baseline red, then behind the
stale sha256 pin above it — and surfaced only when the pin was corrected and
the step below it could run for the first time in three days.

The fixture-inertness guard the file already carried did not help: it checks
that the mutation *changed the file*, which it did. Nothing checked that the
rejection was an *assertion* rather than a death.

**Rule:** a mutation harness must distinguish "the validator judged this and
refused it" from "the validator failed to run". Assert on the named finding,
not on the exit code alone; a harness whose verifier dies is reporting on its
own health, not on the artefact.


---


## 36. Two proofs, both true, about different files

The 2026-08-12 driving-games launch wrote two shelf entries into
`data/source-manifests/games.json` in the site repository, in commits titled
*"single-writer commit 1 of 2"* and *"writer 2 of 2"*. Its live proof then
fetched `https://madebymatt.uk/data/source-manifests/games.json` and
byte-compared it to that file: **MATCH**, hash recorded in the launch report.

The arcade does not read that file. `games/index.html` fetches
`/Games/games.json` at runtime — the Games repository's manifest, mounted at
the same origin — and that shelf stayed at 48 entries. Both proofs were sound.
Neither was about the shelf the visitor sees, and the estate ran for a day with
two hand-maintained shelves and no gate able to see both, because no single
repository contains both files.

AGX-1 reported it, but as a phantom-occupant finding — the homepage's New
Release boxes naming games "not on the shelf" — which reads as a homepage
defect rather than a divergence between two manifests.

**Rule:** a live proof vouches for the artefact it fetched and nothing else, so
every such proof must name its URL where the result is read, and a claim of the
form "X is deployed" must state which path was fetched to establish it. Where
two repositories hold copies of one fact, one is canonical and the other is
generated from it — and the comparison lives wherever both can be reached,
which for a two-repository split means the live gate.


---


## 37. A trigger shape that cannot fire where the change lands

Eighteen of this repository's twenty-six workflows ran on `pull_request` only.
Three more fired on `push` to branches that were their own launch branches —
long since merged, never pushed to again — and one was `workflow_dispatch`-only
from birth. All of them look like automatic gates in the file and in the
Actions tab.

The consequence is not that they never run; it is *when* they run. A commit
pushed to `main` that breaks such a gate produces no failure anywhere. The gate
then fails the next unrelated pull request that happens to touch its path
filter, blaming a stranger's diff for a defect landed days earlier. Measured:
`8432492` staled three gates in a single push to main (a byte pin, a pinned
reconstruction, a storage census) and fired none of them;
`apexpool-home-verify` had 151 recorded runs, every one a `pull_request`, none
ever on `main`, while its sha256 pin sat unsatisfiable for three days. Its path
filter also omitted the two game files its own entry conditions assert, so even
a PR touching those files would not have run it.

The dead push branches make this worse rather than better: they still exist on
the remote, so the trigger reads as live.

**Rule:** a gate must be able to fire on the ref where the change it guards
actually lands. If it guards `main`, it runs on pushes to `main` — and its path
filter must include every file its assertions read, not only the files its
author expected to edit. A workflow whose only trigger is a feature branch has
a shelf life equal to that branch's.


---


## 38. A proxy that measures the rendering of an invariant, not the invariant

The driving-games live leg asserted `exactly one NEW marker` by counting
occurrences of the text `NEW ·` in `document.body.innerText` on `/games/`. The
ruled invariant is about the **shelf**: exactly one manifest entry holds the
ephemeral marker. Those are different questions, and the proxy is wrong in both
directions at once.

It **false-fails** a legitimate holder. `/games/` renders a rail'd collection in
`#sportsRail` *in addition to* `#allGrid`, so a marker-holding game in a rail'd
collection renders twice and the count reads 2. That is exactly what happened
when the marker moved to Rally Vector 3D, which carried `collection: "Sports"`.
The shelf was correct, the page was correct, and the gate was red.

It also **passes vacuously**: a shelf with no holder at all satisfies the count
whenever the page text happens to contain `NEW ·` once, for any reason.

The repair was not to adjust the number. It was to assert the two real
questions separately — (a) the served manifest declares exactly one holder, and
(b) that holder's own anchor carries the marker on the page, at both viewports —
so neither can be satisfied by the other's accident. Proven by a fixture where
the shelf is correct but the render is stripped: limb (b) fails **alone**, which
is what shows the limbs are independent rather than one implying the other.

**Rule:** when a gate can only see a rendering of the thing it is ruling on,
say so and assert the ruled fact at its source as well. A count of how many
times an invariant is *displayed* is not a measurement of the invariant, and it
will go red the first time the estate legitimately displays it twice.


---


## 39. A negative control that depends on a real defect existing

`verify_sports_rail.js` S8 proves the hue-breach record is selective — that it
refuses an unrecorded sub-floor pair, and refuses a recorded pair whose hue has
since moved. It opened with:

    const breaches = recordedBreaches();
    assert(breaches.length > 0, 'no recorded breach to exercise the control against');

and drew its fixtures from `breaches[0]` — the **live** record. So the control
worked only while the estate actually carried a declared breach. The day the
last one was retired as inert, S8 would have failed: not because anything
regressed, but because the estate got healthier. A control whose green depends
on a real defect being present is a control with an expiry date, and it fails in
the direction that looks like a regression.

Same family as *crashes counted as rejections* (species 35): in both, the
harness reports on its own circumstances and the reader takes it for a
statement about the artefact.

The repair is a **committed synthetic fixture** the control consumes instead —
with deliberately fictional identifiers, so it can never be mistaken for the
live record nor silently excuse a real collision — plus two things the old shape
never had: the control re-measures its own fixture every run and fails if the
fixture has stopped being a genuine breach, and the live record, if it carries
anything at all, is checked for self-consistency. The live record is then free
to be **empty**, which is the strong state: with nothing recorded, the gate
refuses every sub-floor pair a change introduces and has nowhere to hide one.

**Rule:** a control must carry its own fixture. If the only way to prove a gate
can fail is to point at a defect the estate happens to have, the proof
evaporates the moment the defect is fixed — and its disappearance is
indistinguishable from a break.

---



## 40. A static gate cannot see a link that is not in the file

`data/audience-homepages.json` records the ruling that the chooser carries "no
`/account/` or `/members/` route at all". `verify_games_audience_faces.py`
asserts it by searching `index.html` for the href. `index.html` contains zero of
them, so the gate passed, every run, for as long as the ruling had existed.

Measured in a browser, the rendered chooser carried an `Account` anchor stamped
`data-mbm-account-nav`, created after load by `accountTargets()` in
`assets/mbm-platform.js` and appended to the nav. The ruling was false in the
only place it mattered, and its own gate was structurally incapable of noticing.

This is not #4 or #30. Those read the wrong file. This one read the *right*
file — and the answer was not in a file at all.

**Rule:** when the thing under test is created at runtime, the gate has to run
the runtime. Before writing a static assertion about what a page contains, ask
whether anything on that page writes to the DOM. If it does, a source search
answers a different question from the one being asked, and it will answer it
confidently forever.

## 41. A default that is open makes every omission silent

`adultFeaturesAllowed()` returned true unless a page carried
`data-mbm-adult-features="off"`. Nineteen pages load the platform script.
Exactly one carried the marker. Every other page — including the arcade, which
the pupil homepage links straight to — was served the account and mailing
affordances, and nothing went red anywhere, because the code was doing precisely
what it said.

The defect is not the missing marker. It is that *forgetting* was
indistinguishable from *deciding*: a page nobody had ever considered and a page
that had been considered and approved produced byte-identical behaviour.

**Rule:** for a boundary that protects somebody, make the permissive state the
one that has to be written down. Then a mistake fails toward a missing link on
an adult page, which somebody reports, rather than toward a sign-in link on a
child's page, which nobody sees. Pair it with a gate that checks the declaration
in *both* directions — see #42.

## 42. A review must ask what arrives, not only what is lost

Standing the accounts flag down was reviewed by asking which routes disappeared.
The answer was none: every erasure and contact route survived. That review was
correct and incomplete. It never asked what the flip *added* — a "service is not
active" panel and a second `mailto:` on `/account/` — and those arrivals were
the more interesting half, because one of them is a new visible promise about a
service that is deliberately switched off.

The asymmetry has a structural form too. A gate asserting "every declared adult
surface carries the marker" is one-directional: it passes a tree in which some
*other* page has quietly grown the marker. The reverse — nothing outside the
declaration carries it — is a different assertion about a different failure, and
both are needed. `verify_adult_surfaces.py` runs them as PA2 and PA3 for exactly
that reason.

**Rule:** for any change that synchronises two things — a record against a tree,
a flag against a set of pages, one estate against another — a review that only
enumerates removals is half a review. Ask what appeared. Both directions get an
assertion, and neither may stand in for the other.

## 43. One attribute name meaning two different things

`data-mbm-mailing-cta` is the stamp `mbm-platform.js` puts on the anchor it
creates (`="1"`), and *also* the marker a page puts on its own `<footer>` to
refuse that injection (`="off"`). `/` and `/for/pupils/` carry the second.

A new browser gate counted injected affordances with the selector
`[data-mbm-mailing-cta]` and reported findings against both — that is, against
the two pages whose markup most explicitly refuses the thing it claimed they had
received. It was reading a refusal as a receipt.

**Rule:** when an attribute name is overloaded, match the value, not the name.
And treat a new gate's first findings as suspect until each one is traced back
to the markup that produced it: a gate that goes red on the two most carefully
configured pages in the estate is far likelier to be wrong than they are.

## 44. A label can hide the measurement that produced it

A0.1 asked whether standing the accounts flag down was clean or dirty. The
measurement said dirty: sign-in disappears, and with it the route to the
self-service deletion control. Both true, and both the wrong place to stop.

What the same run also measured, and what the word "dirty" swallowed whole: the
erasure route did not vanish, it *degraded* — `/account/` went from zero visible
`mailto:` routes to one, `/privacy/` kept all three and kept stating both
deletion and unsubscribe, and per-email unsubscribe never read the flag at all.
The honest finding was not "dirty" but "the self-service path closes and the
documented path becomes more prominent", and only the second version supports a
decision. It is also the version that surfaced a third option nobody had listed:
flip mailing, which is clean by the same test, and rule on accounts separately.

The failure mode is that a binary verdict is a lossy summary that *feels* like a
result. Once "dirty" is written down, the gradient behind it stops being asked
about, and the next reader inherits a label instead of a measurement.

**Rule:** when a check reduces to a verdict, keep reporting the quantity that
produced it. Prefer "1 route to 2, self-service closed" over "dirty". If a
finding cannot be stated as a number that moved, it is not finished being
measured — and a binary that admits no third option is usually a sign that the
question, not the estate, needs the work.

*Related and already filed: #39, a negative control must not depend on a real
breach existing. This pass re-confirmed it rather than rediscovering it.*

---

## 45. An instrument that consumes the resource it measures

A probe was written to answer "does the particle layer paint?" It counted
non-transparent pixels the obvious way:

    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;

A canvas holds exactly one context type for its lifetime. That call bound a 2D
context to `#fx-canvas` while the layer was still idle — so when the game later
asked the same canvas for `webgl2`, it got null, and the explicit capability
gate at `index.html:667` correctly stood the GPU path down and fell back.

The probe then reported the fallback as a finding: *"the GPU constructor threw,
~20 KB carried and never executed."* That went into a committed report as
measured fact. It was measured. It was also caused, entirely, by the
measurement.

Demonstrated by removing exactly one line and changing nothing else:

| run | `EWFx.state` | renderer | fps |
|---|---|---|---|
| without the `getContext('2d')` | `gpu` | WebGL2 instanced | 58 |
| with it | `fallback` | Canvas 2D fallback | 0 |

This is not #35 (a crash counted as a rejection) or #38 (a proxy for the
invariant). Both of those measure the wrong thing. This one measures the right
thing, correctly, in a world the act of measuring created — and every number in
the report was internally consistent, which is exactly why it read as solid.

**Rule:** before trusting a reading, ask what the probe *did* to the subject, not
just what it read from it. Anything exclusive — a canvas context, a lock, a
single-use token, a port, a `once` listener, a stream that can only be consumed
once — is spent by the observation. Where a subject exposes its own state
(`stats()`, a status flag, a counter it maintains), read that instead of
re-deriving it from the resource. And a finding that a path "never runs" deserves
one more question than a finding that it does: what would have to be true for it
to run, and did I make that false?

---

## The shape they share

None of these is a wrong assertion. Every one is a correct assertion that
stopped being evaluated, or was evaluated against the wrong thing, without
saying so. So the standing discipline is not "write more checks" — it is:

- **prove red before accepting green**, for every gate, and
- **assert on evidence, not on proxies**: a canvas at its default 300×150 has a
  width greater than zero; a music pad that ticks without oscillators reports as
  playing; a verifier comparing a file against itself always agrees.

---

## 46. A sweep that flags its own specification

The microcopy register bans `Try Again` as a feedback action label. The sweep
for it reported a hit in `schema/diagnostic-task.schema.json`:

    "description": "Replaces 'Try Again'. Describes the next physical or
                    cognitive move, e.g. 'Isolate fault & retry'."

That is the rule, reported as a breach of itself. Nothing about the output was
wrong — the phrase is genuinely on that line — and that is what makes it
expensive. The reader learns that some fraction of this sweep's hits are noise,
and the only way to tell which is to open each one. A sweep whose output has to
be triaged by hand every time is a sweep that gets skimmed, and a skimmed sweep
has stopped working while still going green.

The obvious fix is worse than the fault. "Exclude `tools/`" reads as tidy and
would have silently dropped `tools/index.html` — the visitor-facing Tools Hub,
sitting in a directory otherwise full of gate scripts — out of the sweep
entirely. The sweep would have got quieter and looked healthier.

**Rule:** classify every hit before counting it, by **what loads the file**, not
by which folder it sits in. `ship` is anything a visitor can load; `spec` is
anything that describes copy — a schema, a doc, a proof, a gate. Print both
lists, so the exclusion is visible rather than silent. And derive the swept
terms from the artefact that states them (#1), never from a list retyped inside
the sweep.

Two smaller traps found while building `tools/verify_register_sweep_scope.mjs`,
both of the same family:

- The control asserting "a phrase nobody uses returns nothing" spelled its
  sentinel out as a literal — in a file the sweep reads. It failed, correctly,
  on itself. The sentinel is now assembled at run time.
- The hit excerpt printed the first 90 bytes of the matching line, which for
  long lines did not contain the match. Evidence that does not show the thing
  being reported has to be taken on trust, and evidence taken on trust is not
  evidence. The excerpt is now centred on the match.

---

## 47. `cmd | grep -q` under `pipefail` reports NO MATCH on output that contains the match

This one turned main red, and the failing control's own output contained the
string it reported as absent.

```bash
set -euo pipefail
if python3 tools/verify_design_inheritance.py --report 2>&1 | grep -q "hero mark"; then
```

`grep -q` exits the instant it matches, and closes the pipe. The producer — still
writing, because that report prints its failures one line at a time and has more
to say afterwards — dies of `BrokenPipeError`. **`pipefail` then promotes the
producer's death to the status of the whole pipeline**, so the `if` takes the
`else` branch. The match succeeded and the check reported that it had not.

Whether it fires depends on scheduling, not on the thing being measured: on an
idle machine the producer finishes writing before `grep` exits and everything
looks fine. This control passed on the pull request and failed four minutes
later on the same content, on a runner forty steps in with two orphaned servers
competing for the CPU.

Measured, all four forms, same 1.3 MB of output with the match present:

| form | verdict |
|---|---|
| `cmd \| grep -q PAT` | **reports NO MATCH** |
| `printf '%s' "$out" \| grep -q PAT` | **reports NO MATCH** |
| `grep -q PAT <<<"$out"` | matches |
| `case "$out" in *PAT*)` | matches |

`printf … \| grep -q` fails for the same reason and is not a fix — the herestring
is, because it is a file rather than a live pipe.

**Rule:** never pipe a live producer into a short-circuiting consumer (`grep -q`,
`head`, `grep -m1`) under `pipefail`. Capture first, then match on a herestring:

```bash
rc=0
out="$(cmd 2>&1)" || rc=$?
if grep -q "PAT" <<<"$out"; then …
```

Capturing `rc` separately matters too: these controls run a gate that is
*expected* to exit non-zero, and `set -e` would abort the step on the assignment
otherwise.

Two smaller things this cost, both worth fixing wherever they appear:

- **The control failed without printing what it saw.** Diagnosing it meant
  re-deriving the whole pipeline by hand. A control that says "the gate did not
  notice X" must print the output in which it did not find X.
- **The control never proved it had mutated anything.** `sed -i
  's|<img class="mf-hero-mark"[^>]*>||'` matches only while `class` is the first
  attribute. The day the renderer reorders them, the sed removes nothing, the
  gate correctly reports no problem, and the control reads that as a failure of
  the gate. It now counts the occurrences before and after and refuses to judge
  anything if the count did not move.

---

## 48. A census that does not check its own recall is a sample

Failure mode 47 was found in two places and fixed in two places. That is not the
same as fixing it, and the difference is only visible if you go looking.

The census written to find the rest of the class started by reporting **22
sites**. A deliberately crude raw sweep — one `grep` for a short-circuiting
consumer after a pipe — reported **24 candidate lines**. Reconciling the two
found both gaps in the census, not in the grep:

- **A pipe inside `$( … )` inside quotes was invisible.** The splitter tracked
  quoting, so `AKV="$(ls "$OUT"/akvid/*.webm | head -1)"` read as one quoted
  string and the site did not exist as far as the census was concerned.
- **Workflow YAML outside `.github/workflows/` was never walked.** A pinned
  fixture copy carried the same defect and was silently out of scope.

Both were repaired, and the census now reports 24 to the sweep's 24.

Then the classifications were wrong in a way that mattered more than the count.
A bare `! producer | grep -q BAD` was filed as a **false red**. It is the
opposite: a dead producer makes the pipeline non-zero, the `!` inverts that to
zero, and the assertion "BAD is absent" passes **without having looked**. The
census had put the single most dangerous site in the harmless bucket, and
reading the sites rather than the buckets is what caught it.

A third correction went the other way: bare pipelines were being filed as false
reds regardless of whether `set -e` was in scope. Without `set -e` nothing acts
on the status, so the output may truncate and no verdict moves. An inflated
census gets skimmed exactly like an unscoped sweep does (#46).

**Rule:** a census reports two numbers — what it found, and what a cruder
instrument found. If they disagree, the census is wrong until proved otherwise;
the crude instrument has no blind spots to hide in. Then read the sites, not the
buckets: a classifier that puts the dangerous case in the safe pile is worse
than no classifier, because the pile now has a name that says it was checked.

---

## 49. A check is only as visible as the filter that decides when it runs

In one week two checks were found red for a week or more, **both by accident**.

`driving-games-live-verify` (5m) had a `paths:` filter listing two game files,
the manifest and itself. Its assertion was about the pupil homepage. **The
commit that redesigned that page could not fire the workflow it broke**, so it
went red on 14 August and stayed red until a manual dispatch happened to run it
as a bookend eleven days later.

`apexpool-verify` (5o) had a filter that was fine. It went red on 10 August **on
the very PR that broke it** — and that PR merged anyway, because nothing in the
estate was required for merge. It was found fifteen days later because a
comment-only edit happened to touch `apexpool/**`.

Main reported green throughout, and it was not lying. **Green means "everything
that fired, passed."** The filter decides what fires, so a filter that excludes
the surface a check judges makes that check invisible rather than wrong.

Three things follow, and all three are now instruments rather than intentions:

- **The filter must cover the files whose behaviour the check asserts, not the
  files it opens.** A check that reads `games.json` and asserts about
  `/for/pupils/` must watch `/for/pupils/`. `census_filter_blindness.py` derives
  the asserted surfaces from every navigation in the workflow *and in every tool
  it invokes*, and compares that set to the filter.
- **A census of filters cannot check itself.** Zero blind checks across five
  repos is either a clean estate or a blind instrument, and the number does not
  say which (#48). The recall control is the **real 5m workflow at `93168a1^`**,
  filter and all, kept as a fixture — not an imitation of its shape.
- **Something must run that does not depend on filters at all.** The weekly
  `estate-check-health` run asks the API about every workflow in every repo and
  names every red and every **stale** check with its age. Age is the signal the
  estate was missing: nothing anywhere said "this has not succeeded in twenty
  days".

**Two found by accident in one week is a sampling estimate, not two incidents.**
Accident is not a detection strategy.

---

## 50. A registry that never forgets makes every count a lie

The Actions API keeps a workflow entry for **every workflow that has ever
existed** and reports all of them `state: active`. Across this estate that is
**197 entries for 57 live checks** — 140 files deleted months ago, still
`active`, still answering with their last run.

The first run of `estate_check_health.py` reported **60 red**. Fifty-nine of
those could never run again. A report that names sixty reds gets skimmed exactly
like one that names none, so the noise was not a cosmetic problem: it would have
buried the one real red it existed to find.

The liveness test is a second instrument — `/contents/.github/workflows` — and
the entry is only a check if the file is still there. It is the same discipline
as measuring recall against a cruder instrument, applied to the other direction:
here the API is the *over*-reporting instrument and the directory listing is the
honest one.

**Rule:** before counting anything an API returns, ask what it does when the
thing is gone. "Active" is a field, not a fact.

---

## 51. A noisy fault hides a real one, and fixing the noise is how you find it

`apexgolf-verify` was red for fifteen days for **two** reasons, both landing on
10 August 2026, and only one of them was visible.

The visible one was mechanical: `grep … | wc -l` under `set -e -o pipefail`
(#47), which killed the step before it printed a line. The run log jumps from
`##[endgroup]` straight to `exit 1`.

The one underneath it was real. `e65a190` "Stage 2B" deliberately wired
`<script defer src="/hud.js">` into ten root games that same day, and
`verify_apexgolf.js` G17 asserted **no `<script src>` at all**. The check was
wrong — the page was fine and the promise had been retracted for it on purpose —
but nothing could say so, because the step above it died first.

**Repairing the noisy fault is what surfaced the real one.** Had the first been
reported rather than fixed, the second would still be invisible: reporting a
masking fault leaves the mask in place.

Two rules follow.

**A red must be diagnosed to a cause, and then diagnosed again.** "A pin that is
wrong for two reasons must not be corrected as though it were wrong for one"
applies to checks, not only to pins. After a repair, re-run and read what comes
next — the first green line is not the end of the diagnosis.

**A ledger of exclusions must cover the inclusions too.** Stage 2B measured the
twelve games it *declined* to wire — verifier run green, line inserted, verifier
run again, only genuinely-reddened gates recorded — and declared them in
`data/hud-coverage.json`. It never asked whether any of the ten it *did* wire
carried the same contract. apexgolf did. The ledger had two categories where it
needed three, and the missing one — *wired, contract retained, verifier amended*
— is where `/neonbreach/` had been living unrecorded all along.

That is the same shape as `8432492` re-pinning six siblings and missing the
seventh: **measured on one side, hand-assumed on the other.** A set someone
counted by hand is visible from the outside as an off-by-one.

**When the contract really has changed, narrow it — never delete it.**
`verify_neonbreach.js` set the precedent: the amendment is not "allow external
scripts", it is "the ONE permitted script is the estate's own deferred
same-origin `/hud.js`, and every other src is still a dependency". That is
stricter than a no-CDN rule. And a limb narrowed on the word of a regex is a
limb nobody has tested, so the amendment carries its own controls — an
off-origin script, a second same-origin script, and the HUD without `defer`,
each of which must still be rejected.
