# Close: FormSubmit — the session close, 2 August 2026

Follows `2026-08-02-formsubmit-activation.md`, which is the census and the fix.
This one is the repackaging, the merge, and what is left.

## For a future session, in one paragraph

The contact form on `/` posts to a **bare-email** FormSubmit endpoint
(`formsubmit.co/<address>`), which discards everything until somebody clicks a
one-time activation link. The page used to show an unconditional success either
way; **that is fixed and merged** — `fb993dd` — and all three surfaces now say
plainly that the site cannot confirm delivery, with a direct `mailto:` beside
every one of them. **Nobody has yet checked the inbox**, so whether the form has
ever worked is still open; the thirty-second procedure is `MATT_UI_CHECKLIST.md`
§2 and it must be run against **`contactmadebymatt@gmail.com`**, not the account
connected to Claude. An AJAX safety net that would surface a failed send is
written, tested against a stub only, and **deliberately held in PR #25** until
that inbox check is answered — because merging it first makes the one test that
matters uninterpretable.

---

## What was merged

**`fb993dd`** — PR #24, the fix, alone.

| gate on merged main | result |
|---|---|
| Pages build `fb993dd` | **completed / success** |
| blob SHAs, local vs API | `thanks/index.html` `12145732` ✅ · `privacy/index.html` `d1dd2eea` ✅ |
| floor, 3 affected pages | **15 page-viewport checks, 0 console errors, 0 4xx**, 0 overflow |
| external origins **on load** | **1** — `api.counterapi.dev`. Unchanged. |
| listeners on the form | **0**, and **0** on all 7 fields |
| cards | signature `bcd83ac080e1b63b` — unmoved |
| stamp `--check` | 2 data files, 4 pages, 0 stale |
| the six claims that had to die | **3 surfaces scanned, 0 remaining** |

**The listener check is not a formality.** It is the proof that the droppable
AJAX commit is genuinely absent from main: that commit takes the form from 0
listeners to 1, so 0 is the observable signature of its absence.

---

## Repackaging

#23 carried two claims at different confidence levels behind one merge button,
under a branch named for unrelated animation work. Split into:

- **#24** `claude/contact-form-honest-failure` → **merged**
- **#25** `claude/contact-form-ajax-safety-net` → **open, held**

Both cherry-picks were proven **tree-identical** to their originals rather than
eyeballed:

```
fix   c974fca tree 2e61499213…  ==  3fc109c tree 2e61499213…
ajax  7c20279 tree 1c67841293…  ==  5bb3877 tree 1c67841293…
byte diff in both directions: empty
```

**#23's branch name did not describe its contents** — `claude/build-science-animations-cfr4qo`
had accumulated the launch film, the cdnjs vendoring, the drag-and-drop fix and
this pass. Recorded here so the September branch sweep does not misread it.

---

## Two corrections to the brief

**1. The "two merges behind" premise does not hold.** `merge-base` of the branch
with `main` was `85d858d`, which *was* `main`'s tip — the branch was cut from
current main immediately before the edits. Measured, not argued.

**2. The first "do #21/#22 touch the four surfaces?" check was a false zero of
my own making.** `git diff-tree --no-commit-id -r <merge>` prints nothing for a
merge commit, so it reported **0 of 4** touched. Re-run against the first parent:
**#21 touched 3 of the 4** (`MATT_UI_CHECKLIST.md`, `index.html`,
`privacy/index.html`) and **#22 touched 1**. A positive control — *does this
method see any files at all?* — caught it: 29 and 1 files respectively.

**What the corrected check found matters:** all six relay/delivery claims *were*
still on main, not because #21 or #22 reintroduced them, but because the fix was
unmerged. Merging #24 is what made the honesty claim true, and it is now
**0 of 6 across the 3 surfaces**.

---

## Jurisdiction — deliberately limited, and why

`formsubmit.co` resolves to `104.21.1.51` and `172.67.128.139`. Both are
**Cloudflare** ranges, which establishes that the DNS is proxied and **nothing
whatever** about where the company or its servers sit.

**The permanent wording is "a third-party relay I do not run."** Naming the
processor is the substantive disclosure; the country is a question for the
checklist, not a sentence for the site. This is recorded as a *deliberately
limited* claim so that a future pass does not read it as vagueness and
"improve" it into a jurisdiction claim that nobody can support.

---

## The new house rule — R25

Written to `LundyLoop/tools/INSTRUMENTS.md` at **the next free number, derived
not assumed**: the existing list ran 1–24 contiguously, so R25.

> **A census returning a non-zero count must have every hit individually
> classified, not merely counted. A count is not an inventory.**

R16 and R22 protect against a *false zero*. Nothing protected against the mirror
image — a **false non-zero**, where the search returns hits, the hits get
counted, and nobody opens them. It is the more seductive failure, because a
non-zero result feels like evidence of work done.

**Two sightings in one pass.** The endpoint census reported **4 distinct
endpoints** where there is **one** — the regex had eaten trailing markdown
punctuation from documents *quoting* the URL. And then, while writing the rule,
a `mailto:` census reported files rising 20 → 23 with occurrences flat, which is
arithmetically impossible: `grep -rl` output split on whitespace had turned the
Lessons path `5_6 Local Choice/` into three phantom files with zero hits each.
Re-run with NUL delimiters: **21 files**.

---

## Preserve-check — the earlier pass's work, verified not assumed

| | |
|---|---|
| `_next` | **followed, not assumed** — path in tree (blob `12145732`), HTTP 200 locally, and the landing page is the right one (`<h1>Your message has been sent.</h1>`). The production host was **not** curled. |
| `_honey` | present, `display:none`, `tabindex="-1"`, **`aria-hidden="true"`** |
| `_subject` | present — `madebymatt.uk contact` |
| `_captcha` | **absent**, so the vendor default applies and it is unverifiable from here. Now a §3 question *and* a §2 warning, so a captcha screen is not misread as failure. |
| the 8 `formsubmit` files | **classified, not counted**: 3 visitor-reachable pages (`index.html` holds the only live form; `/privacy/` and `/thanks/` describe it, which is their job), 5 internal docs. **No stray page carries a form.** |
| `mailto:` | site repo **13 files / 22 occurrences** on old main → **14 / 23** on the fix branch. Delta `+1/+1`, and it is the close report quoting the string. The form's own count is net-neutral: the new direct line replaced one already inside the paragraph it rewrote. Cross-repo: **32 across 21 files**. |

---

## Branch list, re-derived against `fb993dd`

**25 remote branches. 18 contained in main. 18 safe to delete** — the fix branch
`claude/contact-form-honest-failure` joins the list now it is merged.

Not contained in main, so **not** safe to delete: `claude/axiom-shift-build-yff3x4` (2),
`claude/contact-form-ajax-safety-net` (1 — **live PR #25**),
`claude/pass-q-audit-c5tg3s` (8), `claude/pass-u-audit-hapesp` (1),
`pass-u-audit` (3).

**One entry needs a human decision that `git --merged` cannot make.**
`claude/build-science-animations-cfr4qo` reports 2 commits ahead of main, so the
ancestry check keeps it — but **every commit on it has a tree-identical twin**,
one merged (`c974fca`) and one open in #25 (`7c20279`). It is fully superseded.
Safe to delete for reasons of *content*, not ancestry.

**`backup/build-anim-autumn1-v1` is excluded because it is not in this repo** —
0 of the 25 branches here. It lives in `MattRoper1977/Lessons`, holding
`297af43` reachable, and the Lessons remote still has **0 tags**, so the tag that
would replace it does not exist yet.

---

## Deliberately left red

- **Whether the form has ever delivered anything.** Unknown by construction.
  Only the inbox can answer it.
- **Whether `/ajax/` permits a cross-origin request from `madebymatt.uk`.**
  Unresolved. Held in #25 for exactly that reason.
- **Whether `/ajax/` shares the plain endpoint's activation state.** Unknown, and
  it is why the test order matters twice.
- **Every vendor default.** `formsubmit.co` unreachable, 403 on CONNECT. No POST
  was attempted; a blocked request proves nothing (R23).
- **The relay's jurisdiction.** See above — deliberately not claimed.

## My honest limit

I can prove the page no longer lies, and I can prove the held commit is absent
from main. I cannot prove a message arrives. That takes one submission from a
phone and one search in the right mailbox, and no amount of work in this
container substitutes for it.
