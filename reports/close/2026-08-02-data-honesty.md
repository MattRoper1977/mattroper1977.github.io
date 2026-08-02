# Close: the data honesty pass — 2 August 2026

For a reader with no context.

The estate spent a week worrying about an accounts module that collected
nothing, while a form that takes a stranger's name, email address and message
and relays it through a third party had never had its copy checked against its
behaviour. **Attention had gone where the anxiety was, not where the data was.**
This pass went where the data was.

| # | item | end state |
|---|---|---|
| 0 | PR #19 | **DONE** — merged `69c0457`, verified on merged main, all gates re-run |
| 1 | The contact form | **DONE** — audited, three defects found, two fixed here, one is Matt's |
| 2 | The accounts surface | **DONE** — removed; module kept, fail-closed |
| 3 | One honest page about data | **DONE** — `/privacy/`, every sentence traced to a measurement |
| 4 | Matt's list | **MATT'S** — four items, in phone order, one of them urgent |

---

## The correction that matters most

**The brief said the promise card claims "nothing is sent to a server", and that
this has been known false since 31 July. Neither half is true.**

That string returns **0 files** across the estate. The card that exists reads:

> *"Lessons, registers and records stay on your device — nothing about your
> class ever leaves it. The only things that touch the internet are the
> anonymous visit counter and, if you use it, the contact form."*

That is already honest about both. It was fixed in an earlier pass, and the
brief was working from a description of the old copy rather than the copy.

**But the card was still wrong, in a way nobody had looked for.** It says "the
only things", and it names two. There are **four**. The two it omits — YouTube
when you press play, and `cdnjs.cloudflare.com` when the UAS Register imports a
PDF or runs OCR — are both on the *interaction* path, and every census this
estate had ever run measured **page load only**.

This is the same shape as a false zero and it is worth naming precisely: the
earlier census declared its population as *pages carrying the promise card*, and
its method as *load the page*. Both boundaries were drawn tightly enough to
exclude the answer. `HANDOVER.md` said "**exactly two** third parties" and meant
it honestly. It is now four, and the section says why it was wrong.

---

## 0. PR #19 — DONE

Merged as **`69c045715437b68b653f9c5d9cde2c994cc0a6ff`**.

**One instrument disagreement, chased before merging.** The PR body reported
base `96106e7`; git reported a merge-base of `16e6cf65`. Not a contradiction —
GitHub's `base.sha` is the base branch's *tip* at read time, not the fork point.
`git diff HEAD...origin/main` was **empty**, so main was content-identical to the
fork point: 0 files differing, 0 overlap with the 4 the PR touched. The
three-dot diff (+428/−1, 4 files) matched the API exactly. Merged clean.

**Verified on merged main, not on the branch** (rule 7):

| check | result |
|---|---|
| blob SHAs, local vs API on `main` | **4 of 4 matched** |
| Pages build for `69c0457` | completed / **success** |
| cards | 11 cards, 0 bare × 5 viewports · `doors=11 art=11 gen=0` · sig `bcd83ac080e1b63b` |
| floor | 25 page-viewport checks, 0 console errors, 0 4xx, 0 overflow |
| stamp `--check` | 2 data files, 4 pages, **0 stale** |

**A gate that had quietly started reporting a permanent non-zero.** The secret
scan matched 5 times — and all five were in the two documents shipped *by the
previous pass*, which name the patterns being scanned for. A scanner that
matches its own documentation will mask a real hit. Fixed at the gate by
classifying on **shape** rather than keyword:

```
363 text blobs scanned
  A  JWT-shaped token anywhere ............ 0   <- the actual secret shape
  B  key assigned to a long value ......... 0   <- a real leak
  C  keyword in prose (documentation) ..... 2   <- not a secret
```

Nothing to rotate.

---

## 1. The contact form — DONE

### What it is

One form, on **1 of 27 pages**. `POST` over `https` to
`https://formsubmit.co/contactmadebymatt@gmail.com`. Seven fields: `_subject`,
`_next`, `_honey`, `name`, `email`, `message`, and the submit button.

### Nothing reads the fields — proven, not assumed

The most serious thing that could be on that page is a second code path
harvesting the values before submit. There is none, and this was established at
runtime with CDP `DOMDebugger.getEventListeners` rather than by grepping:

```
2 <form> elements in the live DOM of /index.html
  FORM 2  action=https://formsubmit.co/…  method=POST
          fields: _subject,_next,_honey,name,email,message,(unnamed)
          listeners ON THE FORM ELEMENT: 0 (none)
          listeners ON ITS FIELDS:       0 (none)
```

Your browser posts the three values you typed, and nothing else touches them.

### The endpoint is the raw-email shape, and that matters twice

`formsubmit.co/<an email address>`, not the tokenised `/el/<token>` form.

**First consequence — activation.** This shape requires a one-time confirmation
click before it will ever deliver. If that click never happened, **every message
sent to date was discarded**, and the sender saw a success page regardless.
Nothing in the repository can settle this. Recorded as **unknown by
construction** and handed to Matt as the top item on his list.

**Second consequence — address exposure, and here the brief's framing needed
correcting.** The address is in public HTML, harvestable. But it is not the
form that exposes it:

```
120 tracked files scanned · 12 contain the address · 32 occurrences
     of which 31 are deliberate mailto: links · 1 is the form action
```

Removing it from the form action would hide nothing. It is published on purpose,
as the way to contact Matt. Worth knowing, not worth changing.

### The failure modes, each named present or absent

| | state | note |
|---|---|---|
| `_honey` honeypot | **present** | already there |
| `_captcha` | **absent** | FormSubmit's default applies; what that shows is theirs, and unverifiable from here |
| `_subject` | **present** | `"madebymatt.uk contact"` — findable in a mailbox |
| `_cc`, `_replyto`, `_template` | **absent** | nothing redirects the mail |
| scheme | **https** | ✅ |
| fields beyond the floor | **none** | name, email, message and nothing else |
| duplication | **none** | 1 form, 1 page, out of 27 |

**So most of the hardening the brief authorised was already done.** That is the
honest finding: the form was in better shape than the brief assumed.

### The one real defect — and it was a user-experience defect, not a security one

`_next` pointed at **`https://madebymatt.uk/#contact`** — the anchor of the form
you just submitted. You press Send and land back on an empty form, with no
acknowledgement of any kind. You cannot tell whether it worked. That is arguably
worse than being dropped on FormSubmit's own page, which at least says thank you.

**Fixed:** a new same-origin, on-brand `/thanks/` page, and `_next` points at it.
It confirms the message went, says who will reply and roughly when, and states
plainly where the message was routed and that FormSubmit's own conduct is not
something this site can vouch for.

### Also fixed

- Copy beside the form now describes the route in one short paragraph, offers
  the direct mailto as an alternative, and links `/privacy/`.
- `aria-hidden="true"` on the honeypot, so a screen reader is not offered a
  decoy field.

### Not done, and deliberately

Switching to a tokenised endpoint is a FormSubmit dashboard action, not a code
change. So is domain-locking. Both are on Matt's list. No third party was added —
in particular **no reCAPTCHA**: adding Google's captcha to fix a privacy problem
would be a self-inflicted wound.

---

## 2. The accounts surface — REMOVED

Matt delegated the call and it was made: **option (c)** — remove the surface,
keep the module.

**What went:** the Log in button, the auth modal and the only password field on
the estate, the members gate and signed-in area, the member badge, the homepage
"Free account" band, the two `zone:"account"` doors, the two orphaned art
templates, and the "create a free account" sync banners on `/uas/` and `/voxel/`.
`/members/` is now a plain page explaining that there is nothing to sign in to.

**What stayed:** `MBMAuth`, both backends, `supabase-schema.sql` and
`initAccountUI()` — untouched, still fail-closed. `initAccountUI()` already
returned early when its nodes were absent, which is why removing the markup
broke nothing.

**The cards gate is the proof the removal was invisible.** Before and after, at
five viewports: `11 cards, 0 bare`, `doors=11 art=11 gen=0`, art signature
**`bcd83ac080e1b63b`** — byte-identical. Removing the two account doors changed
nothing on screen, which is exactly what "they rendered to nobody" predicts.

### The dead-CSS census, and the false zero it nearly produced

The rule was: prove death before deleting. The first census said:

```
101 selectors examined · 26 of 26 pages loaded · 73 with zero matching elements
```

**Four of those 73 were alive.** `.mbm-row`, `.mbm-track`, `.mbm-fill` and
`.mbm-num` build the stats leaderboard, which only renders *after* counterapi
replies — and counterapi is blocked by this container's proxy. They looked dead
because the network was down, not because nothing uses them. Re-running with the
counter **stubbed to succeed** brought them straight back:

```
101 selectors · counterapi stubbed · 74 requests intercepted · 69 zero-match
```

The remaining conditional-state selectors — `.mbm-row.is-you`,
`.mbm-board-empty`, `.mbm-hits-badge[data-ready]`, `.mbm-hits:empty::before` —
are alive for the same reason and were **kept**. Deleting them would have been a
real bug shipped under the cover of a green census.

**And the population was still not complete.** These pages are served from
`madebymatt.uk` alongside two *other* repos. `mbm-modal` turned out to appear in
**24 Lessons files**. Chased rather than dismissed: all 24 define the class in
their own inline `<style>` and link **zero** external stylesheets, so none of
them depends on this one.

```
this repo:  27 pages, all loaded
Lessons:    1003 files (504 html)  · 0 reference mbm-features.css
Games:      4 files                · 0 reference mbm-features.css
TOTAL:      1007 sibling files scanned, 0 dependencies
```

Only then was anything deleted: **42 accounts selectors** (dead because this
pass removed their markup) and **15 `.dx-door*` selectors** (orphaned on 1 August
when `initDoors()` was superseded and the CSS was left behind).
`assets/mbm-features.css` went **12,917 → 6,433 bytes, 50% smaller**.

**A note on how the search instrument was validated.** GitHub's `search_code`
returned `total_count: 0` for the cross-repo question. It also returned 0 for a
control term I knew existed in the repo I was standing in. The tool is blind on
these repos, so every zero it gives is a false zero. It was abandoned in favour
of shallow clones, and `raw.githubusercontent.com` was likewise only trusted
after a known-positive control returned 2 hits.

### "Follow the work", built only from URLs that exist

Replacing the account band on the homepage, and on `/members/`. Three channels,
every URL taken from the repository: **YouTube** `@matthewroper9166`, **Ko-fi**
`madebymattuk`, and **email**. There is no Facebook URL anywhere in the tree, so
none was invented — it is on Matt's list instead.

### The Stats nav entry

Checked, per the brief: it does not depend on accounts and was left entirely
alone.

### The honest cost of this decision

**Reversal is no longer a one-line flag flip.** Turning
`features.accounts.enabled` back on now reveals markup that is not there.
Restoring accounts means reverting the removal commit *and then* flipping the
flag. `HANDOVER.md` and `FEATURES.md` both said the reversal was one line; both
now say this instead, in place, with the old claim struck through rather than
quietly deleted.

---

## 3. One honest page about data — `/privacy/`

Linked from the homepage footer, from beside the contact form, from the nav on
four pages, and from `/thanks/`.

**Every sentence traces to a measurement.** The measurements:

```
27 pages loaded, every .html in the repo
EXTERNAL ORIGINS CONTACTED ON LOAD: 1
    https://api.counterapi.dev   on 2 pages: /index.html /stats/index.html
COOKIES SET: 0 pages, out of 27
localStorage keys written: 37, every one a cached counter number (mbm_c_*)
IndexedDB created on a plain visit: 2 — uas_register, asdan_register
```

**The counter, described exactly.** It sends a request to increment a tally and a
two-letter country code. The country is derived **on the device** from
`Intl.DateTimeFormat().resolvedOptions().timeZone` — a local browser API. There
is no IP geolocation, no permission prompt and no third-party lookup. This is a
genuinely strong true claim that had been buried under vaguer ones.

**The YouTube facade, verified rather than carried from the ledger** — the brief
asked for exactly this:

```
2 facade buttons on /index.html
BEFORE CLICK: 90 requests, 0 to any youtube host
AFTER 1 CLICK: 2 requests, 2 to www.youtube-nocookie.com
```

**The claim that is not made.** Rule 10 is applied throughout: the page describes
what leaves your browser and where it goes, and refuses to promise anything
about what counterapi.dev, formsubmit.co, YouTube or Cloudflare do at the far
end. Three gaps are stated on the page itself rather than papered over: what
those parties keep, where the OCR language pack comes from (the library's own
default, unreadable from here), and what FormSubmit shows mid-send.

**A stale ledger caught by measuring instead of copying.** The recorded
localStorage keys included `mbm_users`, `mbm_session` and `mbm_hud_names`. None
of them appears on a real visit. The measured list is 37 counter caches and a
reading-theme preference.

---

## What the removal cost, before and after

Same five pages, same harness, `69c0457` versus this branch:

| page | before | after | change |
|---|---|---|---|
| `/index.html` | 219.9 KB · 539 nodes | 210.3 KB · 549 nodes | −9.6 KB (+10 nodes: the Follow-the-work card) |
| `/members/index.html` | 69.6 KB · 89 nodes | **13.4 KB** · 72 nodes | **−56.2 KB, −81%** |
| `/stats/index.html` | 66.7 KB · 88 nodes | 59.7 KB · 88 nodes | −7.0 KB |
| `/uas/index.html` | 9.6 KB · 81 nodes | 8.3 KB · 74 nodes | −1.3 KB |
| `/voxel/index.html` | 649.9 KB · 128 nodes | 648.7 KB · 121 nodes | −1.2 KB |
| **total** | **1015.8 KB · 925 nodes** | **940.3 KB · 904 nodes** | **−75.5 KB** |

Console errors: **2 before, 2 after** — the same two cross-repo JSON 404s on the
homepage, which resolve on the live domain and only 404 against a container
serving one repo. No new error was introduced and none was removed.

`/members/` drops 81% because it no longer loads `mbm-features.js` or
`mbm-features.css` at all: with the auth module and the counter both gone from
that page, it needs neither.

## Two overflows I introduced, found and fixed

The floor gate was widened from 5 pages to **all 27**, and immediately caught two
regressions that a 5-page floor would have shipped.

```
FAILING  /members/index.html  320x568  overflow=12px
         <a> left=41 right=332 w=291  "contactmadebymatt@gmail.com"
         /thanks/index.html   320x568  overflow=5px
         <div.tx-wrap> left=0 right=325 w=325

PASSING  /members/index.html  320x568  overflow=0px, 0 elements past the edge
         /thanks/index.html   320x568  overflow=0px, 0 elements past the edge
```

Both had the same root cause — the contact address is a 291px unbreakable token
— and **my first fix for `/thanks/` did not work**. `width:100%` and
`box-sizing:border-box` do not stop a grid item under `place-items:center`
growing to its min-content width; `min-width:0` and `overflow-wrap` were also
needed. The gate said 5px again, which is the only reason I found out.

**A third overflow is not mine.** `/resources/medevac-frontier/` overflows by
1px at 900px wide. It reproduces on the pristine `69c0457` server, so it
pre-dates this branch. Reported, not fixed — it is 1px and outside this pass's
claim.

---

## 4. Housekeeping done properly

**The branch list was re-derived, not carried.** The previous list of 17 was
measured against an older `main` and is stale by definition once `main` moves.
Against `69c0457`: **23 remote branches, 18 fully contained in `main`**, minus
the branch this session is pushing to = **17 safe to delete**, each verified
`ahead-of-main=0`. Four carry unmerged commits and are excluded by name with
their counts.

**`backup/build-anim-autumn1-v1` is excluded, and the reason is exact:** it is
not a branch of this repo at all — 0 of the 23. It lives in
`MattRoper1977/Lessons`, where it still points at
`297af43f2d135c29d3b322482aa4571e6526b798`, and the Lessons remote has **0 tags**
(a population, not an impression), so `build-anim-autumn1-v1` does not exist yet.
That branch is the only thing holding the commit reachable, and the tag push is
home-machine only.

**A gate that could have gone silently to zero.** `tools/stamp-data.py` carried a
hand-maintained page list with the comment *"keep it in step"*. It went out of
step this pass — `members/index.html` stopped loading any data fetcher and
`--check` reported drift on a page that no longer needed a stamp. The list now
**derives itself**, and because a derived list can silently become empty, it
fails loudly if the discovery ever returns nothing. Both directions tested:

```
FAILING  ROOT pointed at an empty directory
         -> SystemExit: "discovered 0 pages to stamp. That is a broken scan,
            not a clean tree"
PASSING  2 data files, 4 pages, 0 stale   exit=0
```

**A number I got wrong mid-pass, corrected by the instruments disagreeing.** I
reported "5 pages load `mbm-features.js`" from a string grep. The derived list
found 4, then 2. `uas/index.html` and `voxel/index.html` mention the file **only
inside an HTML comment**. The true figure is **2 pages load it as a script tag**
— which is exactly the 2 the runtime census caught contacting counterapi. The
runtime measurement had been right all along.

---

## Final gates

| gate | result | population |
|---|---|---|
| cards | **11 cards, 0 bare** at 320/390/768/900/1280 · `doors=11 art=11 gen=0` · sig `bcd83ac080e1b63b` | 5 viewports, unchanged from before the removal |
| floor | **135 page-viewport checks, 0 console errors, 0 4xx**, worst overflow 1px | **all 27 pages** × 5 viewports — widened from 5 pages this pass, which is how the two regressions were caught |
| stamp `--check` | 2 data files, 4 pages, **0 stale** | page list now derived, with an empty-population guard tested in both directions |
| secrets | **0 JWT-shaped, 0 assignments** | 363 text blobs |
| external origins | **1** | 27 pages, 225 requests |
| cookies | **0** | 27 pages |
| internal links | **0 broken that this branch introduced** | 347 hrefs; 31 unresolvable are cross-repo paths that resolve on the live domain, 2 are JS template literals |
| dead CSS | 42 + 15 selectors removed | 101 examined × 27 pages + 1,007 sibling-repo files |

The one non-zero, 1px on `/resources/medevac-frontier/` at 900px, reproduces on
pristine `69c0457` and is not this branch's.

## Deliberately left red, with reasons

- **Whether the contact form has ever delivered a message.** Unknown by
  construction. Nothing in a repository can answer it; it needs Matt's thumb.
- **What any third party does with what it receives.** Not knowable from here,
  and rule 10 says do not assert it. Four are named; none is vouched for.
- **The OCR language-pack host.** `cdnjs.cloudflare.com` is blocked from this
  container, so the library's default could not be read. Stated as unread rather
  than guessed.
- **`https_enforced` on the three project repos.** The `/pages` API path is
  proxy-filtered. N/A, not FAILED. The CNAME substitute check passes; the
  checkbox is still Matt's.
- **The `Lessons`, `Games` and `Matt-s-Apps-` branch lists.** Not enumerated.
  Not assumed clean.

## My honest limit

Nothing I can run proves that a message sent through that form arrives, or that
a third party honours anything at all. The first needs Matt to press Send on his
phone; the second is not knowable by anyone outside those companies, which is
precisely why `/privacy/` describes requests and stops. Everything else in this
document is measured, and where it is not, it says so.

## If I had another hour

**`/uas/app.html` and `cdnjs.cloudflare.com`.** It is the page that holds real
pupil records — names, marks, evidence — and it is the one page on the estate
that pulls executable code from a third-party CDN at run time. The data does not
leave; I checked, and the OCR runs locally. But *four* remote scripts execute
inside the page that holds the most sensitive data on the site, with no integrity
check on any of them: no `integrity` attribute, no `crossorigin`, no pinned
hash. A compromised or substituted library there would be running in the same
document as a class list.

The fix is cheap — Subresource Integrity hashes, or vendoring the four files into
the repo so nothing is fetched at all — and vendoring would also make the OCR
work offline, which is the whole promise of the tool. That is where the next hour
goes. Not because anything is wrong today, but because it is the one place where
the blast radius is a teacher's pupil data rather than a visit counter.
