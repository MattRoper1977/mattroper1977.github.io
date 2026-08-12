# Approved Explorations — built, rendered, STOPPED

**This branch does not merge.** It is here for Matt to read. The copy is his
voice and nothing publishes without his word.

Branch: `claude/teach-green-links` (site repo), branched from
`claude/teach-green`. Kept separate on purpose: §1–§4 merge, this does not, and
they could not share a branch without this riding along with them.

---

## The thing you need to decide first

**"Verify, don't assert" could not be done from here.** The brief says the
pupil-adjacent entries may only carry the *No Login Needed · Ad-Free* tags if
they genuinely satisfy them at time of writing, verified rather than claimed.

This environment's network policy blocks outbound HTTP. The estate's own link
checker was run against the existing, already-shipped set to establish that this
is the environment and not the links:

```
$ python3 tools/check_education_hub_links.py --timeout 8 --workers 6
  review-needed  oak-curriculum: network failure: Tunnel connection failed: 403 Forbidden
  review-needed  aqa-qualifications: network failure: Tunnel connection failed: 403 Forbidden
  ... all 40 curated links, identically
```

So the tags are **not** on the cards. In their place each pupil-adjacent entry
carries:

> `External ↗ · not checked by Made by Matt`

and the section says so in full above the grid. That is a deliberate downgrade
from what the brief asked for, made because the alternative was printing
"Ad-Free" on a page under Matt's name on the strength of nothing. **If you want
the original tags, someone with a browser needs to check the three sites and say
so, and then they go on.**

## The TES link is a placeholder, on purpose

`[MATT: TES SHOP URL]`

Three repositories were searched — Lessons, the site, and Matt's Apps — for any
`tes.com`, `tesresources`, or TES shop address. **There is none.** The brief said
not to invent one, and inventing a URL that carries Matt's name is not a thing to
guess at. The card renders with the placeholder visible so it cannot ship
unnoticed.

---

## What is on the pages

### `/teach/` — "Further resources, outside Made by Matt" (teacher-facing)

| link | annotation | status |
|---|---|---|
| `[MATT: TES SHOP URL]` | When you want the packaged, print-ready versions of this material to hand to a colleague. | **needs the URL** |
| `stem.org.uk/resources` | When a science or D&T sequence needs a second, externally quality-assured activity to sit beside your own. | unverified |
| `ase.org.uk/resources` | When you want subject-association guidance on practical work, safety or progression before you plan it. | unverified |

### `/education-hub/` — "What to point a parent or carer at" (family-facing)

| link | annotation | status |
|---|---|---|
| `thenational.academy` | When a family asks what their child should be covering, and you want to point at a curriculum rather than a worksheet. | unverified |
| `bbc.co.uk/bitesize` | When a pupil needs revision material at home that does not depend on anything you have set up. | unverified |

### `/education-hub/` — "Places a pupil can work directly" (pupil-facing, bounded)

Its own grid, its own heading, and copy that says plainly it is a different
audience and that Made by Matt does not check what these sites show.

| link | annotation | tag shown |
|---|---|---|
| `phet.colorado.edu` | When a class needs to vary one thing at a time in a simulation you cannot safely run in the room. | External ↗ · not checked |
| `scratch.mit.edu` | When a pupil is ready to build the thing rather than answer questions about it. | External ↗ · not checked |
| `code.org/students` | When you want a structured computing sequence that a pupil can carry on with at home. | External ↗ · not checked |

---

## Found while doing this, and fixed here

The Education Hub's **JavaScript-free fallback grid** mixed four external
gov.uk / EEF links in with its internal routes, and rendered all of them through
`start_card()` — which set no `target`, no `rel`, and no marker. Four links that
leave the site were rendering as ordinary in-site cards.

Fixed at the single point every card passes through rather than by editing four
rows, so one more row added later cannot reintroduce it. All **16** external
links across the two hubs now carry `target="_blank"`,
`rel="noopener noreferrer external"` and a visible `↗`, checked mechanically:

```
teach/index.html:         2 external links, 0 problems
education-hub/index.html: 14 external links, 0 problems
```

## Rendered

Screenshots at 390×844 and 1280×900 are in the session scratchpad and were
reviewed before this was written. Both grids reflow to one column on the phone;
the outbound marker and the "leaves Made by Matt" line stay on the card at both
widths.

## Gates

- `render_discovery_hubs.py --check` — byte-reproducible, both pages
- `verify_teach_task_filter.mjs` — PASS (the §1 behaviour is unaffected)
- `verify_professional_site.js` — PASS
- authorisation: both hubs declared under a new `external-explorations` pass in
  `data/copy-authorisation.json`

## What Matt needs to do

1. Give me the TES shop URL, or say to drop that card.
2. Read the six annotation sentences — they are written in your voice and are
   the whole point of the grid.
3. Decide whether the pupil-adjacent three go on at all, and if so whether
   someone checks the login/ads question so the real tags can replace
   "not checked by Made by Matt".
