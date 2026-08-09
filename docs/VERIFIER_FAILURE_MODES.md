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

---

## The shape they share

None of these is a wrong assertion. Every one is a correct assertion that
stopped being evaluated, or was evaluated against the wrong thing, without
saying so. So the standing discipline is not "write more checks" — it is:

- **prove red before accepting green**, for every gate, and
- **assert on evidence, not on proxies**: a canvas at its default 300×150 has a
  width greater than zero; a music pad that ticks without oscillators reports as
  playing; a verifier comparing a file against itself always agrees.
