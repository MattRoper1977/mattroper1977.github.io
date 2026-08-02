# Close: the contact form, complete — 2 August 2026

For a reader with no context.

The contact form on `madebymatt.uk` posted to a **bare-email** FormSubmit
endpoint. That shape needs a one-time activation click before it delivers
anything, and until somebody clicks it the relay discards every message. The
site showed an unconditional success page either way.

**On 2 August 2026 Matt found the activation mail, unclicked, and clicked it.**
The form now works — he sent a test message and it arrived.

So the question three sessions have been circling is answered, and it is
answered in the worst of the four directions the decision tree allowed for:
**everything submitted before that click was discarded, and every sender was
shown a page saying it had been sent.**

---

## What was actually wrong, said once

**The defect was the unconditional success page, not FormSubmit.** The relay
behaved exactly as documented for an unactivated address. The site was the thing
making a claim it could not support. That is why the fix that shipped was a copy
change, not a vendor change, and why nothing in this pass tried to evaluate,
replace or work around the vendor.

---

## Job 1b — how long the silent discard lasted

Measured by walking git history, not estimated.

| | |
|---|---|
| repository created | 16 July 2026 |
| custom domain live (`CNAME`) | 16 July 2026, 20:02 |
| endpoint first on a visitor-loadable page | **18 July 2026, 01:01 UTC** — `0b660b2`, pushed straight to `main` |
| activation clicked | **2 August 2026** |
| **result** | **`first live 2026-07-18, window 15 days`** (14 days 23 h elapsed) |

**Method, because the number is only as good as the walk.** All **137**
first-parent commits on `main` were checked out in turn and `index.html` tested
for the endpoint at each one. That produced a run-length map rather than a
single grep, which is what caught the gap:

```
absent   from 2026-07-16  (6490f18)   ← before the form existed
PRESENT  from 2026-07-18  (0b660b2)   ← 01:01 UTC, form added
absent   from 2026-07-18  (0ba31f4)   ← 13:08 UTC, homepage overwritten
PRESENT  from 2026-07-18  (5c394fd)   ← 13:44 UTC, "Restore homepage"
```

- The form was **absent for 35 minutes** on 18 July and present continuously
  otherwise. That is the only gap in the 15 days.
- The **endpoint string never changed** — verified with
  `git log -S'formsubmit.co/contactmadebymatt@gmail.com'`, which reports exactly
  three commits, all on 18 July, and none since.
- Deployment **predates** the endpoint by two days, so there is no
  committed-but-not-yet-published lag to subtract. The cross-check the brief
  asked for came back clean in the harmless direction.

### The number that is deliberately absent

**How many messages went nowhere is unknown, and will stay unknown.** There is
no analytics on this site by choice, the relay holds nothing for an unactivated
address, and Matt's mailbox by definition contains none of them. A plausible
figure could be constructed from nothing and it would be worth nothing — that is
**R24 run backwards**, inventing a number to fill a gap rather than deriving one.
The window is a fact. A count would be a fabrication.

---

## Job 2 — the one question left, and the page that answers it

PR #25 (`claude/contact-form-ajax-safety-net`, `7c20279`) makes a failed send say
so, by reading FormSubmit's `/ajax/` JSON reply instead of redirecting to
`/thanks/` unconditionally. **It only works if the browser is permitted to read
that reply.**

That cannot be tested from here. `formsubmit.co` returns **403 on CONNECT**
through the agent proxy, and per **R23** a blocked request says nothing about the
far end. Guessing the vendor's CORS policy would be the same class of error the
whole pass exists to remove.

So the test was moved to where it can actually run: **`/cors-test.html`**,
temporary, unlinked, `noindex,nofollow`, absent from `sitemap.xml`. Matt loads it
once and presses one button.

### Two probes, because one cannot tell the two failures apart

| | mode | what its success means |
|---|---|---|
| **A** | `cors` | the response is **readable** — the real question |
| **B** | `no-cors` | the request **left the browser**, whatever the response said |

```
A succeeds            -> PERMITTED     -> merge PR #25
A throws, B succeeds  -> REFUSED       -> close PR #25, record the reason
A throws, B throws    -> INCONCLUSIVE  -> ad blocker / filter / offline. NOT a refusal.
```

**That third row is the whole reason there are two probes.** A single `fetch`
that throws looks identical whether CORS refused the response or a school
content filter ate the request. Collapsing those two into "refused" would close a
question that was never examined — a false zero wearing a different hat. The page
says *"Do not treat this as a refusal"* in as many words.

**Probe B does not run when probe A succeeds.** The question is already answered
at that point, and a second POST would send a second message for nothing.
Asserted in the harness rather than intended: world 1 fires exactly **1** request.

### Verified before shipping

`tools/film/verify_cors_probe.mjs` drives the page through all three worlds with
the responses **stubbed** — stated plainly, because what is verified is *the
probe's reasoning*, not the vendor's behaviour. **16 of 16 assertions pass:**

```
PASS  inert before the press: 0 requests to formsubmit.co
PASS  inert before the press: verdict hidden
PASS  inert before the press: output says "Not run yet."
PASS  W1 verdict is PERMITTED          PASS  W1 styled as success
PASS  W1 fires exactly ONE request     PASS  W1 prints the response body
PASS  W1 action line says merge
PASS  W2 verdict is REFUSED            PASS  W2 styled as failure
PASS  W2 ran both probes               PASS  W2 action line says close
PASS  W3 verdict is INCONCLUSIVE, not a refusal
PASS  W3 explicitly forbids reading it as a refusal
PASS  W3 styled as neither
PASS  no page errors beyond the deliberate aborts
```

Floor on the new page: **5 of 5 viewports** (320 → 1920), 0 console errors,
0 4xx, 0 horizontal overflow, 0 tap targets under 44 px.

### What it does not do

- **It does not touch the live form.** `git diff origin/main -- index.html` is
  empty; the file is byte-identical to `main`.
- **Nothing links to it.** 0 references across the repo, 0 in `sitemap.xml` —
  with `/thanks/` as the positive control at 3 files, so the search was live
  (**R22**).
- **It does send one real message**, subject `CORS TEST — ignore`, and the page
  says so above the button rather than in a comment nobody reads. Its arrival is
  a free second finding: it settles whether `/ajax/` shares the plain endpoint's
  activation state.

### It is temporary, and that is enforced by the plan, not by hope

`/cors-test.html` is deleted in the same round of changes as the decision it
informs — whichever way the verdict falls. It is the only file in this pass with
a scheduled death.

---

## Job 3 — Matt's observations, with provenance

Folded into `MATT_UI_CHECKLIST.md` §3 as a **Known** table separate from the
questions, each row carrying *"observed by Matt on 2 August 2026"*:

| question | answer |
|---|---|
| Does the endpoint deliver? | **Yes, since 2 August 2026** |
| Had it ever delivered before that? | **No** — activation mail present and unclicked |
| Does a bare-email endpoint send activation mail at all? | **Yes** |

Written down with the date attached because in three weeks *"the form works"*
will be a memory, and a memory is not evidence. Everything else in §3 stays in
the questions list, unanswered and labelled as such.

**Nothing on a public page claims the form works.** That was forbidden and it
stayed forbidden: `/thanks/` still says *"If you don't hear back, it may not have
reached me"*, and the wording **"a third-party relay I do not run"** is unchanged
on all three surfaces. Matt's mailbox is evidence for Matt. It is not evidence
for a stranger reading `/privacy/`, and the site does not borrow it.

---

## Job 4 — the branch list, re-derived

Fourth derivation, against `main` at `d103557`. **The first one to change.**

**26 remote branches: `main`, 19 contained in it, 6 not.** Every line checked
with `git rev-list --count origin/main..<branch>`, never by branch name.

**+2 safe:** `claude/contact-form-honest-failure` (`c974fca`, PR #24 merged) and
`claude/formsubmit-close-checklist` (`47a35f0`, PR #26 merged) — 17 → 19.

**−1 safe: `claude/build-science-animations-cfr4qo` moved out**, now 2 commits
ahead. Previous derivations called it contained; it is not any more. **Its two
commits carry nothing unique, and that was proved rather than assumed:**

```
3fc109c  e1aa29b8b45e  ==  c974fca  e1aa29b8b45e   (merged as PR #24)
5bb3877  967d9c26be4e  ==  7c20279  967d9c26be4e   (held as PR #25)
```

Identical `git patch-id --stable` both times. Safe to delete **on content
grounds** — not by `git branch --merged`, which compares commits and not changes.
Delete it last, after #25 is settled.

### `backup/build-anim-autumn1-v1` — excluded, and the reason has not expired

Re-checked against the **Lessons** remote today, not carried forward:

- **0 tags exist** on that remote. `git ls-remote --tags` returned nothing at
  all — a population, not a guess.
- The branch is still at `297af43f2d135c29d3b322482aa4571e6526b798`.
- It is therefore **the only ref holding that commit reachable**, and it is a
  branch of a *different repository* — no amount of tidying in the site repo can
  touch it, and no site-repo branch list should imply otherwise.

**Keep it until `build-anim-autumn1-v1` exists as a tag.** Tag pushes 403 by ref
type from the container, so that stays a home-machine job.

---

## Counts, each with its population

| claim | figure | population / control |
|---|---|---|
| first-parent commits walked | **137** | every commit on `main`, oldest → newest |
| commits changing the endpoint string | **3** | all of `main`, `git log -S` |
| gaps in coverage | **1**, 35 minutes | the same 137-commit walk |
| `mailto:` to the contact address | **32 across 21 files** | four repos — site 14/23, Lessons 5/6, Games 1/1, Matt-s-Apps- 1/2; `html` control matched **73 / 668 / 3 / 32** files |
| links to `/cors-test.html` | **0** | whole repo + `sitemap.xml`; control `/thanks/` matched **3** files |
| probe assertions | **16 / 16** | 3 stubbed worlds |
| floor on the new page | **5 / 5** | 320 · 390 · 768 · 1280 · 1920 |

---

## Deliberately left red

- **The CORS answer itself.** One button press away, and not guessable from
  here. PR #25 stays open and held until the verdict exists.
- **How many messages were discarded in the 15 days.** Unknowable. Left blank
  rather than estimated.
- **Every remaining claim about vendor behaviour** — dashboard, domain lock,
  `_captcha` default, legal location. `formsubmit.co` is 403 on CONNECT from
  here. All of it lives in the checklist as questions.
- **Anything already distributed outside these repos.** 0 archives and 0
  documents in the tree carry the form, but a pack emailed or uploaded to TES
  before today is invisible from here and cannot be corrected retroactively.

## One thing this pass got wrong, and how

The `index.html` floor control came back **FAIL at all 5 viewports** — 39 console
errors and 2 × 404. Every one of them is the sandbox: 37 blocked-origin errors
from `api.counterapi.dev` (403 through the agent proxy) and 404s for
`/Lessons/resources.json` and `/Games/games.json`, which live in sibling repos
absent from this checkout. `git diff --quiet origin/main -- index.html` confirms
the file is byte-identical to `main`, so the failures are the harness, not the
change.

**Recorded rather than quietly dropped**, because a red result that gets
explained away without evidence is how a real regression eventually ships.

## My honest limit

I can prove the page no longer lies, prove the window, and prove the probe
reasons correctly in all three worlds. I cannot press the button — and the one
fact the button establishes is the only thing standing between PR #25 and a
decision.
