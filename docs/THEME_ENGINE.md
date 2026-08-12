# The reading-theme engine

Six reading backgrounds — Warm, Pink, Blue, Light, Dark, High lumen — stored
under one key, `mbm_reading_theme`, and offered on every ported surface across
three repositories.

Warm, Pink and Blue are a visual-stress accommodation. They are not a colour
scheme and they do not get removed, reordered, or demoted from the front of the
row. High lumen is the projector theme: maximum brightness for a washed-out
classroom screen. Dark and Light are the ordinary two.

This document exists because the engine is written down in more than one place,
and the places do not all look like each other.

---

## Where it lives

| | file | what it is |
|---|---|---|
| canonical | `theme.js` (this repo) | **the one file a person edits** |
| generated | `assets/mbm-theme.js` (Lessons) | output — header + `theme.js` verbatim |
| generated | `assets/mbm-theme.js` (Apps) | output — header + `theme.js` verbatim |
| separate | `main/index.html` inline block (this repo) | the homepage's own implementation |

The two copies exist so the Lessons and Creator hubs work without reaching back
to this repository's asset server. That is deliberate and stays.

The homepage's implementation is separate for a different reason, and it is not
a mistake either. `theme.js` **injects** swatch buttons into whatever nav it
finds. The homepage lays its swatches out by hand, as part of the page design,
and its script **binds** to those buttons. Same storage key, same six values,
same "cream removes the attribute" rule — different code, because it is doing a
different job. It cannot be replaced by the canonical engine without redesigning
the homepage's Display panel, which is not a theme-engine change.

### Who loads what

    theme.js                    11 pages in this repository
                                (index, main is NOT one of them — see above,
                                 for/*, games, resources, tools)
    Lessons  mbm-theme.js       Lessons/index.html
    Apps     mbm-theme.js       Matt-s-Apps-/index.html

Seven pages are **ported** — they carry `[data-theme="X"]` CSS for every theme:
`main`, `tools`, `resources`, `games` (this repo), `lessons-hub`, `primary-hub`
(Lessons), `creator-hub` (Apps).

Two pages are **consumers**, not ported surfaces: `stats/index.html` reads the
stored key and applies Dark only; `privacy/index.html` carries Dark CSS and no
applier at all. Neither offers a swatch. They are out of the parity contract
because they do not claim to offer the themes — noted here so that the next
person who greps for `data-theme` and finds them knows they were seen.

---

## Cream is the default, and has no CSS

Every engine **removes** `data-theme` for cream rather than setting
`data-theme="cream"`. The page's base styles are the cream styles. A
`[data-theme="cream"]` rule would therefore be dead code, and the parity gate
fails on one if it appears.

So the contract is:

- engines declare **six**: `cream, pink, blue, light, dark, highlumen`, in that
  order
- ported pages declare **five**: the six minus cream

---

## How to change something

**To change a colour, a label, or the behaviour:** edit `theme.js`, then

```sh
python3 tools/sync_theme.py
```

That rewrites both generated copies and, in the same run, every place their
SHA-256 is pinned — each companion repository's
`tools/verify_cross_estate_unification.py` and `docs/MBM_CROSS_ESTATE_UNIFICATION.md`.
Running it twice produces no second change. Then land the three pull requests in
dependency order: **site first**, because it owns the canonical engine.

**To add or remove a theme** — a much bigger act — all of the following move
together, and the parity gate will hold you to it:

1. `theme.js` — `ORDER`, `NAME`, `DOT`
2. `tools/sync_theme.py` to regenerate the copies
3. `main/index.html` — the inline `names` map **and** the hand-written
   `.dx-sw` buttons, both inside/around the `mbm-theme-engine` sentinels
4. `[data-theme="X"]` CSS on all seven ported pages
5. `EXPECTED` in `tools/verify_theme_parity.py` — the declared contract
6. the contrast measurements (`tools/verify_highlumen_contrast.mjs` is the
   model: a static hex cannot tell you what a rule paints)

Never edit `assets/mbm-theme.js` in Lessons or Apps. It opens with a header
saying so, and three separate checks will revert or fail you.

---

## What enforces this

| check | where it runs | what it asserts |
|---|---|---|
| `tools/sync_theme.py --check` | Lessons + Apps `theme-parity.yml` | each copy is the header plus `theme.js` byte-for-byte, and every pinned digest matches |
| `verify_cross_estate_unification.py --canonical` | Lessons + Apps `mbm-cross-estate-unification.yml` | the same byte relationship, inside the heavy release gate, plus the header's presence |
| `tools/verify_theme_parity.py --scope site` | this repo's `professional-site-design-audit.yml` | the canonical engine, the homepage's inline implementation, its swatch markup and the four site pages all name the same six |
| `tools/verify_theme_parity.py --scope lessons/apps` | Lessons + Apps `theme-parity.yml` | that repo's copy and its ported pages agree with the canonical |

Each gate carries `--self-test`, and each self-test verifies its own sabotage
**landed** before believing the result — a graft that silently fails to apply
measures a clean tree and calls it green.

### Why the scopes

The three repositories merge in dependency order, site first. A gate demanding
whole-estate agreement would redden the site's own pull request for the crime of
going first, so each repository gates the surfaces it **owns**, measured against
the canonical. Every scope includes the canonical engine, so none can drift away
from it, and between them the scopes leave no source ungated.

Run with no scope, `verify_theme_parity.py` checks the whole estate at once.
That is the right thing to run locally with all three repositories checked out.

### The one hole, named

If someone edits `theme.js` here and merges without syncing, **nothing in
Lessons or Apps changes at that moment**, so no path filter fires there. That is
inherent to three repositories, not something a path filter can fix. It is why
`theme-parity.yml` in both companions also runs on a daily schedule: the drift
is caught within a day, by a red build that names `tools/sync_theme.py`.

---

## Standing checks that are not wired to CI

`tools/verify_highlumen.py`, `tools/verify_highlumen_contrast.mjs` and
`tools/verify_highlumen_behaviour.mjs` are run by hand. They cover the
High-Lumen theme specifically — undeclared variables, phantom selectors, and
measured contrast on the rendered pages — rather than engine parity, and the
contrast one needs a browser. Run them when you touch a theme's colours.

---

## History worth keeping

- **2026-08-12** — High lumen was added as the sixth theme and updated **one**
  engine. The Lessons and Creator hubs silently kept five swatches. Caught in
  the same pass, but only because someone went looking.
- **Longer than that** — the digest pinned for `assets/mbm-theme.js` in the Apps
  contract test was `af946d77`, the value from the day the file was created. The
  file moved twice afterwards and the pin never did, so that gate had been
  failing on a stale constant rather than on real drift. The same stale digest
  sat in both repositories' `MBM_CROSS_ESTATE_UNIFICATION.md`.

Both are the same failure: N places to update by hand, and fewer than N updated.
The copies are output now, and every pin is written by the run that writes the
file it describes.
