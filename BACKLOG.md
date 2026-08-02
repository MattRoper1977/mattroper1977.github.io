# Backlog — ordered, top item first

Named, ordered, and each one carries the evidence needed to start it without
re-deriving anything. Last re-ordered 2 August 2026.

---

## 1. `/uas/app.html` — vendor the four cdnjs scripts. **Not SRI.**

**This outranks everything else on the list, and the ruling is recorded here so
it does not get re-debated.**

`uas/app.html` is the page that holds real pupil records — names, marks,
evidence photographs, in an IndexedDB database called `uas_register`. It is also
the only page on the estate that pulls **executable code from a third-party CDN
at run time**:

```
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js
https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
```

plus `tesseract.js-core` and a language pack whose host is set by the library's
own default rather than by this site's code — **unread, because cdnjs is blocked
from the build container.** Four remote scripts execute inside the document
holding a class list, with **no `integrity` attribute, no `crossorigin`, and no
pinned hash on any of them**.

Nothing is wrong today. The pupil data does not leave — the OCR genuinely runs
in the browser, and that was checked. The problem is blast radius: a substituted
library there runs in the same document as a register.

**The decision, made and not to be relitigated: vendor the files into the repo.
Do not use Subresource Integrity.**

SRI would give integrity but still requires the network, so the tool would still
break in a room with bad wifi. Vendoring gives integrity **and** offline — and
offline is that tool's entire promise. It also removes a third-party execution
context from the one page that matters most. Same work, strictly better outcome.

**When it is done, three things change in the same commit:** `/privacy/` loses
the `cdnjs.cloudflare.com` row from its table, the homepage promise tile drops
from four internet-touching things to three, and `HANDOVER.md`'s third-party
table drops from four hosts to three.

*Deliberately not done on 2 August: a rushed change to a page holding class
lists, at the end of a long session, is exactly the change you don't make.*

---

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

## 5. Featured curation

There is no way to say "these six things first" — the homepage strips are
ordered by `site.json` array position, which conflates *order* with *priority*.
Low urgency; noted so it is not rediscovered.

---

## Closed this session, for the record

- **The contact form** — audited, `_next` fixed to a real thank-you page, copy
  rewritten to measured truth. What remains is Matt's: the activation test and
  the dashboard domain-lock.
- **The accounts surface** — removed. Module kept, fail-closed.
- **`/privacy/`** — written, every sentence traced to a measurement.
- **`stamp-data.py`'s hand-maintained page list** — now derived, with an
  empty-population guard tested in both directions.
- **The launch film** — built, `tools/film/`, publish kit written. Matt uploads.
