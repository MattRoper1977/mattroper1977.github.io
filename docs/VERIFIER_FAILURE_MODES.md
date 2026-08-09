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

**Rule:** controls run whether or not the subject verified, and the exit code is
the union. A skipped control is a reported state, never a silent absence.

## 7. With a red baseline, a control that compares against zero passes vacuously

Falling out of fixing 6. The control "unrelated authored-copy mutation rejected"
looked for the message *authored body wording changed* anywhere in the mutated
run. That message was already in the 8-finding baseline, so the control would
have reported PASS without its mutation doing anything at all.

**Rule:** evaluate a control as a **delta** against the unmutated run. If the
signal it looks for is already in the baseline, the control cannot distinguish
its mutation from the pre-existing failure — report INCONCLUSIVE, never PASS.

## 8. A step that reports success while doing nothing

Two in one workflow: an upload step pointed at `artifacts/browser`, which
nothing writes, with `if-no-files-found: ignore`; and a control run wrote its
deliberate failure into the *committed* artifact, so the repository's own record
of the estate briefly described a run that was engineered to fail.

**Rule:** if a step can do nothing, make doing nothing visible. Control runs
write to scratch (`--artifacts`), so the committed record cannot be a control's.

---

## The shape they share

None of these is a wrong assertion. Every one is a correct assertion that
stopped being evaluated, or was evaluated against the wrong thing, without
saying so. So the standing discipline is not "write more checks" — it is:

- **prove red before accepting green**, for every gate, and
- **assert on evidence, not on proxies**: a canvas at its default 300×150 has a
  width greater than zero; a music pad that ticks without oscillators reports as
  playing; a verifier comparing a file against itself always agrees.
