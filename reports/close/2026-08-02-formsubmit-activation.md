# Close: FormSubmit — the silent-discard pass, 2 August 2026

For a reader with no context.

The contact form POSTs to a **bare-email** FormSubmit endpoint. That shape needs
a one-time activation click before it will ever deliver, and until somebody
clicks it every message is discarded. The form then showed an **unconditional
success page** either way. Nothing in the repository can tell which state it is
in, and nothing ever will.

**The defect is the unconditional success page, not the vendor.** This pass did
not evaluate FormSubmit; it made the failure visible and survivable whichever
way the answer falls, and handed Matt a thirty-second check that settles it.

---

## Job 0 — Census

### 0a. Every occurrence, four repos, with a positive control

```
repo             files   CONTROL "html"   formsubmit   <form   mailto:
site               138        62               7          2       14
Lessons           1003       668               0          0        9
Games                4         3               0          0        1
Matt-s-Apps-        34        32               0          0        2
-------------------------------------------------------------------
TOTAL             1179       765               7          2       26
```

**The control is the point (R22).** `"html"` matched **765 files**, so the scan
was live. Without it, the three zeros in the `formsubmit` column would be
indistinguishable from a blind search — and this estate has already shipped that
exact mistake once today, when GitHub's `search_code` returned zero both for the
question *and* for a term known to be present.

**1 true distinct endpoint.** A first pass reported *4*; that was my own regex
capturing trailing markdown punctuation (`` ` `` and `.`) from documents quoting
the URL. Corrected by stripping punctuation before counting.

### 0b. The form as it stands, measured at `index.html` blob `35d706bc`

| property | value |
|---|---|
| file · line | `index.html:407` |
| action | `https://formsubmit.co/contactmadebymatt@gmail.com` |
| **shape** | **BARE-EMAIL** — needs a one-time activation click before it ever delivers |
| method | `POST` |
| enctype | **absent** → browser default `application/x-www-form-urlencoded` |
| `_subject` | `madebymatt.uk contact` |
| `_next` | `https://madebymatt.uk/thanks/` |
| `_honey` | present, `display:none`, `tabindex="-1"`, `aria-hidden="true"` ✅ |
| `_captcha` | **absent** — the vendor default therefore applies, and that default is **UNVERIFIABLE FROM HERE** |
| `_cc` / `_replyto` / `_template` | 0 / 0 / 0 |
| fields | `name`, `email`, `message` — the floor, nothing extra |

**JS touching the form — checked at runtime with CDP, not by grep**, because a
string search got this exact question wrong before:

```
2 <form> elements in the live DOM of /index.html
  FORM 2  action=https://formsubmit.co/…  method=POST
          fields: _subject,_next,_honey,name,email,message
          listeners ON THE FORM ELEMENT: 0 (none)
          listeners ON ITS FIELDS:       0 (none)
```

### 0c. Tree state, by SHA rather than by branch name

The brief's premises needed checking; the branch it names is named for unrelated
work.

- **PR #20 is merged** — as `ecf8b8c`. Its tip `04745e0` is contained in main.
- **But it is no longer current.** Two further merges landed after it: **#21
  `2d7d084`** (launch film, cdnjs vendoring, drag-and-drop) and **#22
  `85d858d`** (checklist).
- **main is at `85d858d`.**
- `/thanks/` exists — blob `98412155`, 3,930 bytes.
- `/privacy/` exists — blob `149eae77`, 11,671 bytes, and it did describe the
  form. Three of its sentences no longer matched the form's real behaviour;
  see Job 3.

### 0d. Duplication

```
archives (.zip/.tar/.7z/.rar), all four repos ....... 0
PDF/DOCX/PPTX carrying the address or formsubmit .... 0 of 15 documents
```

**No second copy of the form exists anywhere in the tree.** Anything already
distributed outside these repos — a TES upload, an emailed pack — is invisible
from here by definition and cannot be fixed retroactively. Recorded, not chased.

`mailto:contactmadebymatt@gmail.com` across all four repos: **20 files, 31
occurrences** — the brief's figure of 31, confirmed exactly.

### 0e. The boundary, stated plainly

**Nothing in this repository can prove a message was ever delivered.**

`formsubmit.co` is not reachable from the container — `GET` returns `http=000`,
a 403 on CONNECT. **No POST was attempted**, and none should have been: a
blocked request proves nothing about the far end (R23).

Everything about vendor behaviour is therefore **UNVERIFIABLE FROM HERE**:
whether a dashboard exists for a bare-email endpoint, whether domain-locking is
offered, what the `_captcha` default is, and what the relay does with a message
once it has it. All of it went into Matt's checklist **as questions**, not as
assertions.

One thing I *could* test and it did not help: `formsubmit.co` resolves in DNS —
`104.21.1.51`, `172.67.128.139`. Both are **Cloudflare** ranges, which tells me
the DNS is proxied and nothing at all about where the company or its servers
are. **So the phrase "a relay in another country", which the brief offered as
the one true sentence, is not one I can stand behind, and I did not use it.**
What replaced it is defensible: *"a third-party relay I do not run"*, and
*"this page cannot see what happens on the other side of it"*.

---

## Job 1 — Making the failure visible

### 1.1 A direct email line beside the form

Plain `mailto:`, always visible, zero JS, zero third party. It works no matter
what state the endpoint is in.

**It exposes nothing new.** The address is already published deliberately in
**31 `mailto:` occurrences across 20 files** in four repos. The line costs
nothing that has not already been spent.

### 1.2 The thank-you page now claims only what is true

| was | now |
|---|---|
| *"Thanks — that's on its way to me."* | **"Your message has been sent."** |
| *"…you'll get one from …, **usually within a few days**"* | timeframe **cut** — I invented it and Matt never agreed it |
| *"a third-party form relay, **which forwards them to my inbox**"* | *"a third-party relay I do not run"* |
| *"That is the only place your details go"* | *"That request is the only thing this site sent"* |
| — | **new:** *"If you don't hear back, it may not have reached me… this page cannot see what happens on the other side of it. So if a reply matters, send it again the direct way"* + the direct address |

The direct email line is on `/thanks/` too, because that page is the last thing
a person sees if delivery silently failed.

---

## Job 2 — Endpoint shape

**Bare-email. Decided, not guessed** — the action ends in an `@` address, not
`/el/<token>` and not `/ajax/`.

**What that actually exposes, so nobody re-argues it in three weeks:** anyone
can POST to that endpoint from anywhere. The practical cost is **spam volume and
`_cc`/`_replyto`-shaped abuse — not secrecy.** The address is deliberately
public 31 times over, so **the `/el/` alias is not a privacy fix and was not
sold as one.**

No alias token was invented, guessed or constructed. If Matt is ever given a
real one it gets swapped with a count proving every occurrence moved.

**No new third party. No reCAPTCHA, no hCaptcha** — adding Google's captcha to
fix a privacy problem is a self-inflicted wound. The free controls already in
place are the `_honey` honeypot (present and `aria-hidden`) and `_subject`.
`_captcha` is unset, so the vendor default applies; **that default is not
something I can read**, and the trade is written into the checklist for Matt
rather than asserted here.

---

## Job 3 — Copy versus behaviour

Every sentence on the three surfaces, before this pass.

| sentence | where | verdict | basis |
|---|---|---|---|
| "Thanks — that's on its way to me." | `/thanks/` | **UNVERIFIABLE** → rewritten | asserts arrival; nothing can confirm it |
| "usually within a few days" | `/thanks/` | **UNVERIFIABLE** → cut | a promise I invented; never agreed |
| "which forwards them to my inbox" | `/thanks/` | **UNVERIFIABLE** → rewritten | a claim about what the vendor does after receipt |
| "That is the only place your details go" | `/thanks/` | **UNVERIFIABLE** → rewritten | same |
| "…a form relay, which forwards it to my inbox" | `/privacy/` | **UNVERIFIABLE** → rewritten | same |
| "a spam check may appear on their page" | `/privacy/` | **UNVERIFIABLE** → cut | speculation about vendor behaviour |
| "which forwards them to my inbox" | `index.html` | **UNVERIFIABLE** → rewritten | same |
| "It is the only place on this site that collects anything you type" | `/privacy/` | **TRUE** | 2 forms in the DOM; the other is a same-origin GET search |
| "there is no script attached to that form or to any of its fields" | `/privacy/` | **TRUE** | CDP: 0 listeners on the form, 0 on all 7 fields |
| "I can't vouch for what happens at the other end" | `/privacy/` | **TRUE** | a disclaimer, not a claim |
| "your name, email and message are posted to formsubmit.co" | `index.html` | **TRUE** | that is the request the browser makes |
| `_honey` present and `aria-hidden` | form | **TRUE** | read from the markup |

**Every UNVERIFIABLE row was cut or corrected, none softened.** An unprovable
promise about a stranger's data is the same defect in a politer voice.

Residue check across the three surfaces after the edits:

```
"forwards it to my inbox"    0      "on its way"     0
"forwards them to my inbox"  0      "received"       0
"within a few days"          0      "mid-send"       0
```

---

## Job 5 — Verification

| gate | result |
|---|---|
| floor, the three affected pages | **15 page-viewport checks, 0 console errors, 0 4xx**, 0 overflow |
| listeners on the form | **0**, and **0** on all 7 fields — *unchanged from before this pass* |
| external origins **on load** | **1** — `api.counterapi.dev`, on 1 of the 3 pages. *A load-time census.* Unchanged. |
| external origins **on submit** | `formsubmit.co`, **1**, and it was already there. *Stated separately because it is a different question.* |

## Deliberately left red

- **Whether the form has ever delivered anything.** Unknown by construction.
  Only Matt's inbox can answer it; the decision tree is in his checklist §2.
- **Every claim about vendor behaviour.** `formsubmit.co` unreachable — 403 on
  CONNECT. Written as questions, not assertions.
- **Where the relay actually is.** DNS resolves only to Cloudflare front-end
  addresses. The brief's "another country" phrasing was not used.
- **Anything already distributed outside these repos.** 0 archives and 0
  documents in the tree carry the form or the address, but a pack already
  emailed or uploaded to TES is invisible here.

## My honest limit

I can prove the page no longer lies. I cannot prove a message arrives, and no
amount of work inside this container will change that — the one test that
settles it is Matt pressing Send on his phone and looking in the right mailbox.
