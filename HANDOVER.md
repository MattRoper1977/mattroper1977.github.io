# Handover

For whoever picks this up next, including Matt after a fortnight away.
Everything below shipped to `main` and is live. Nothing is half-finished.
Most recent session first.

---

# 1 August 2026 — homepage close

## The rule this session produced

> **Every "zero bad" assertion must be reported alongside its population count.
> A coverage gate that can be satisfied by removing the population is a false
> zero.**

House rule from here. It belongs beside the instrument rules in
`LundyLoop/tools/INSTRUMENTS.md`, which is where the estate's "false zero" —
a check that closes a question it never examined — is defined and catalogued.

It was earned rather than theorised. The gate for this session's card work was
*"zero empty cards, proven by count"*. That gate goes green if you delete the
rail. It nearly did: PR #13 fixed the visible bug by removing the duplicate
renderer, which made "no rail card is bare" true by making the rail not exist —
while `buildCard()` still had a silent path that rendered a card with no
artwork at all. Two adversarial fixtures found it in one run.

Every count in this session's work is now written **`N cards, 0 bare`**, never
`0 bare`. The page publishes its own population too, on `<html>`:

    data-doors=9  data-doors-art=9  data-doors-gen=0

`data-doors` alone would go green with an empty `doors[]`. Read with
`data-doors-art` it cannot.

Earlier instances of the same family, for the record: the studio count that was
stated as 28 and then 29 against a true 30 nobody owned (98b0a59), and the
`initDoors()` rail that rendered nine cards while reading a field only one of
them had.

## What shipped

| What | Where |
|---|---|
| PR #13 merged — duplicate doors rail removed, art on all 31 Arcade cards, posters to WebP | `3f0ffac` |
| Generated card art: no door can render bare, whatever fields it carries | `assets/mbm-doors.js` |
| Content-hash cache-busting on every data file this repo owns | `tools/stamp-data.py` |

## Why Matt's phone showed a homepage that is not in the tree

The screenshots showed the **old four-door `site.json`** — "Games Arcade" and
"Explore Apps" rendering bare, the Medevac banner side-cropped. None of those
cards exist on `main`; it has carried nine differently-named doors since
`836f428`. Nothing had regressed: both of those doors have had `image: ""` in
**every one of the sixteen revisions of `site.json` since the file was created**.

The mechanism was in the source the whole time. Two scripts fetched the same
url with different cache policies:

    assets/mbm-doors.js    fetch(url, { cache: "no-cache" })   revalidates
    assets/mbm-features.js fetch(url, o)  — no cache option    may be stale

So on one page load, one renderer could draw the current nine doors into the
zone strips while the other drew a cached four-door copy underneath them. That
is exactly the screenshot. Nothing on the page could notice or correct it.

`tools/stamp-data.py` closes it: data files this repo owns are fetched at
`file.json?v=<content hash>`, so a stale copy cannot be addressed rather than
merely being revalidated. The two cross-repo catalogues —
`/Lessons/resources.json` and `/Games/games.json` — are **not** stamped,
because this repo cannot hash a file it does not have, and a version number
copied by hand from another repo is the studio count all over again. Those get
forced revalidation instead. Run `python3 tools/stamp-data.py --check` before
shipping; it fails when a data file has changed and the pages still carry the
old hash.

**To see the fix on a phone that is still showing the old page:** hard-refresh,
or clear site data for `madebymatt.uk`. Afterwards the homepage shows **nine
door cards, none bare**.

## Two things found while checking, both left for Matt

**The Evening Workshop photo has two independent faults and one fix answers
both.** It carries garbled text baked into the artwork — the left device's
screen reads "Task Checkfiet", "Geot ciecklist", "Ciocu IV 6 / 11:35 AM", and
there are five further garbled zones. And because it is 1200×670 against the
other eight doors' 5:4 SVG, it letterboxes below ~546px of viewport: it paints
58.97px against their 96px at 320px wide, 85.15px against 120px at 421px. It
matches only at 546px and above.

No crop removes the garbled panels without destroying the composition — the
worst offender is the left device's screen, and cutting it costs 29% of the
width including one of the three subjects. **Do not regenerate it**: an image
model is what produced the garbled text in the first place.

The option that answers both faults at once is the one already half-built:
`<template id="art-studio-suite">` exists in `index.html` and is currently dead
code, because `image` wins over `art` in `buildCard()`. Deleting the door's
`image` field would drop straight onto it — 0.8 KB of SVG instead of 134 KB of
JPEG, no garbled text, and an even row at every width. The cost is real and is
Matt's to weigh: the site would then carry no photographic card art at all.

**Instrument note, because it is the session's own rule turned on itself.** The
harness that checked the row was even measured `getBoundingClientRect()` on the
`<img>`. That returns the *box*, which is 96 or 120 for every card at every
width, so the check reported an even row while the photo was visibly 39%
shorter. A check that measures the container rather than the content is a false
zero. Painted height is `naturalWidth`/`naturalHeight` scaled into the box.

---

# 1 August 2026 — Glitch Clash

| What | Where | SHA |
|---|---|---|
| Game feel, Endless, Weekly Gauntlet, run modifiers, Time Attack, themes, colourblind palette, menu music, **and the particle-layer fix** | Lessons, PR #6 | `857ab49` (merge) |

Pages build for `857ab49` **completed / success**. +1121 / −17, one file.

## The bug worth knowing about

**Glitch Clash's particle layer had never run.** `FX.init()` was called at the
top of the UI closure, roughly 1150 lines above the `const FX` that defines
it — inside its temporal dead zone. It threw a `ReferenceError` on every load
and the surrounding `try{}catch(_){}` swallowed it. `init()` is the only thing
that sizes `#fxcanvas` and takes its 2D context, so `cx` stayed null and every
`spawn()` returned at its first line.

Measured before the change: `#fxcanvas` was **300×150 with no style width** —
the browser default for a canvas nothing has touched — and four strikes painted
**0 pixels**. After: 412×892, 465 pixels. Strike, heal, charge, clash and
corrupt particles now draw for the first time since they were written.

**This is the third instance of the same trap in these files**, and the reason
`Lessons/CLAUDE.md` now opens with it. The other two: a settings block
referencing `GCX` above its definition, which aborted the whole UI closure; and
`closeSheets()` probing a flag defined below it, which is why that flag is a
`var` — `typeof` does *not* protect against the TDZ.

Rule going forward: **init a module immediately after it, and do not wrap the
call in a bare catch.** A visible error beats a silently dead feature.

## The other honest catch

A CSS layering bug the new ambient backdrop exposed: a negative-`z-index`
pseudo-element paints above `html`'s background but *below* `body`'s, so an
opaque body hid it entirely. The page fill moved to `<html>`. Because
`body.hc` sets its variables on `<body>`, `applySettings()` now flags **both**
elements — without that, High Contrast would leave the page fill unchanged
behind a black UI.

## Testing — the gap in the 31 July notes is now closed

31 July said "there is no committed browser test suite — the scripts lived in
a scratch directory and are gone with the session." For Glitch Clash that is
no longer true:

```sh
tools/glitchclash/run.sh                     # Lessons repo
tools/glitchclash/run.sh path/to/copy.html
```

Ten headless-Chromium suites against the shipped file, non-zero exit on
failure. `CHROMIUM_PATH` overrides the browser; the runner finds a global
Playwright itself.

Two lessons baked into them, both from assertions that passed wrongly:

- A canvas at 300×150 is the *default*. `width > 0` passes on a canvas that
  was never initialised — check it matches the viewport.
- `musicPlaying()` returning true only proves an interval is ticking. The
  suite checks live oscillator count and pad gain instead.

A third: `gc-endless` originally hammered strike and *hoped* to win, and
failed about one run in three. It now forces the win and tests the run
machinery, which is what it was actually for. **A flaky gate is worse than no
gate** — it trains you to ignore it.

## Colour was measured, not chosen

The colourblind palette went through a Viénot–Brettel dichromat simulation,
scored on worst pairwise CIELAB distance across normal, deuteranopic,
protanopic and tritanopic vision. Shipped palette: worst **ΔE 15.9** — teal
and blue collapse into each other under tritanopia. Chosen: **ΔE 40.8**, every
swatch ≥4.5:1 on the panel fill.

If anyone changes those four Keeper hues, redo the measurement. Do not eyeball
it. The script approach is written up in `Lessons/CLAUDE.md`.

## Not checked

Same gap as 31 July, same reason: **the live `madebymatt.uk` origin**. This
container gets a 403 from the network policy on every outbound host, and a 403
is not evidence a page is down. Verified instead from the merge SHA, the green
Pages build, and ten suites run against the merged `main` working tree.
**Someone should open Glitch Clash in a real browser once** — that is still
the one gap.

---

# 31 July 2026

## What shipped that day

| What | Where | SHA |
|---|---|---|
| Splash + both title redesigns, nav breakpoint fix, arcade picks and clips | site, PR #9 | `616720c` (merge) |
| Voxel Frontier splash + title redesign | Lessons, PR #5 | `c2d6eaf` (merge) |
| Counter honesty copy + studio count | site, direct to `main` | `213e0ac` |

Pages builds: site `616720c` **completed / success**, Lessons `c2d6eaf`
**completed / success**.

**Made by Matt splash.** One paste-identical block in `apexkick/index.html`,
`voxel/index.html` and Lessons `Games/Voxel_Frontier.html`, wrapped in
`<!-- mbm-splash splash-titles-2026-07-31 START/END -->` sentinels so it is
detectable and idempotent. A future Arcade game can take it verbatim.

Its dismiss timer is **unconditional on purpose** — not gated on Three.js,
WebGL, world generation or any ready signal. A game that fails to boot still
ends up with the splash gone rather than sealed behind it. A `<noscript>`
rule hides it entirely when JS is off. If you ever "improve" this by waiting
for the game to be ready, you reintroduce a lock-out that has no escape.

**Apex Kick title.** `screen()` takes `opts.variant`, which adds a scoping
class. Every new rule sits under `.scr-title`, because `screen()` is shared
by five callers and an unscoped rule silently redesigns Squad, Packs, Pack
opened and Round over. This also fixed two live bugs: the wordmark was
unstyled (`#title .wordmark` targeted an id that does not exist) and two
footer buttons were pushed off-screen at 390 px.

**Voxel title.** Controls moved into a native `<details>`, closed by default.
The overlay click handler starts the world on any panel click, so `#hints`
had to be added to its exclusion list — without that, opening Controls
launches the game. The WebGL boot guard rebuilds `#panel` from its own
hardcoded copy, so the redesign is mirrored there too.

---

## The nav breakpoint split is load-bearing

In `styles.css`:

- `@media(max-width:800px)` — `.menu` and the `.nav` drawer **only**
- `@media(max-width:680px)` — `.filters`, `.cards`, `.standards`, and
  `.section-head`/`.footer .bar`
- `@media(max-width:900px)` — two-column `.cards` and `.standards`

**Do not merge the 800 and 680 queries.** They look like duplication and are
not. The nav previously collapsed at 680 but the horizontal row does not fit
until about 800, so 681–795 px pushed it off the side of the viewport and gave
the whole page a horizontal scrollbar — `index` and `members` by up to 115 px,
`stats` by 33 px. Pulling the grid rules up to 800 to "tidy" this would force
single-column cards across 681–800 px, overriding the 900 px two-column rule.
Anyone tidying these queries reintroduces one bug or the other.

This was never a front-page problem: `members` has no reading swatches and
overflowed by exactly the same amount. The cause is the eight nav links plus
the account button.

---

## Method note: measuring overflow

`document.documentElement.scrollWidth` vs `clientWidth` is **the authority**
on horizontal overflow. Element-walking only *attributes* an overflow that
scrollWidth has already confirmed.

Three `.dx-chip` elements report right-edges past the viewport on every tree,
before and after every change. They sit inside `.dx-chips{overflow-x:auto}`,
an intentional scroll container, so they never reach `scrollWidth`. Attributing
overflow by inspection rather than by scrollWidth is what produced a wrong
diagnosis once already in this work — the swatches were blamed for something
the nav was doing.

---

## The Voxel two-copy rule

`voxel/index.html` (site) and `Games/Voxel_Frontier.html` (Lessons) are
**byte-identical** across a 14,072-byte pre-script prefix and a 45,636-byte
engine body. The only differences are:

- one comment — "vendored locally" vs "inlined"
- how Three.js arrives — `<script src="vendor/three.min.js">` vs the inlined
  r128 payload

**Any Voxel change lands in both, identically.** The Lessons copy must stay a
single self-contained file: it has zero `<script src>`, no external reference,
and was verified running a real world from `file://` with **zero external
requests**. Do not introduce a CDN, a font, or an image file to it.

---

## Testing

**Apex Kick has no browser e2e harness.** The gate is `tools/verify_apexkick.js`
— **25 contract checks**, run with `node tools/verify_apexkick.js`. If a brief
tells you there are 19 physics checks and an e2e suite, that is wrong; check
before believing it.

Everything else was verified with headless Chromium against a localhost
server. There is no committed browser test suite — the scripts lived in a
scratch directory and are gone with the session.

---

## Third parties (as of this commit)

A request census of every page carrying a "nothing uploaded" promise found
exactly two third parties, and the homepage card named neither:

| Host | Where | When |
|---|---|---|
| `api.counterapi.dev` | `/` and `/stats` | on load, ~33 requests |
| `formsubmit.co` | `/` contact form | on submit only |

`/members`, `/tools`, `/next`, `/games` and `/resources` make **no**
third-party requests on load.

The homepage copy now describes the request and stops there. It deliberately
makes **no promise about what counterapi.dev or formsubmit.co do with it** —
that is their infrastructure, under their privacy policies. The previous copy
claimed "your IP address is never sent or stored", which is not true and
cannot be made true: an HTTP request reaches the other end from your IP by
definition.

If you add any third party to a page carrying that card, the card has to
change in the same commit.

---

## Open items

**1. Members / accounts — needs Matt's decision, do not guess.**
`/members` collects name, email and password while the member bonuses behind
it are still unbuilt. Three honest options: build one real bonus, switch the
page to register-interest, or hide it until it is real. It must not be
guessed at. The privacy claim on that page is currently *true* — the census
confirms `/members` makes no third-party request, and the password is hashed
on-device — so nothing is actively misleading, but the offer is.
**This is the top item on return.**

**2. Studio count not verifiable here.** `next/apps.html` said "28 studios"
and now says 29, matching `resources/index.html` and `tools/index.html`. It
was **not** verified against `apps.json`, which does not exist in the site,
Lessons or Games repos — it presumably lives in `Matt-s-Apps-`. Worth
confirming the real total once.

**3. `/next/` is a concept-preview directory**, `Disallow`ed in `robots.txt`
and absent from the sitemap. It carries claims ("no tracking") that are not
audited. Not live, so not urgent.

**4. 127 catalogue entries have no added date.** Parked.

**5. Featured curation, and `og:image` on the Games and Apps repos.** Parked.

**6. `.tcenter` in `apexkick/index.html`** has its base rule edited unscoped
(`padding:20px` → `20px 0`) rather than scoped under `.scr-title`. It has
exactly one consumer, `showTitle`, so blast radius is zero. Left deliberately —
churn is worse than the inconsistency.

**7. Apex Kick's stat row stays at four.** There is no Kick Rating field on
`P`; the per-round average is computed in `finishRound()` and never persisted.
Adding a fifth stat means building and migrating storage first.

---

## What was checked, and what was not

**Checked:** both Pages builds green at the merge SHAs; content verified via
`raw.githubusercontent.com` pinned to those SHAs; six pages clean 320–1280 px;
front page `scrollWidth == clientWidth` at 768 px on `main`; 25 Apex contract
checks; splash failure modes in all three game files; reduced motion; the
Lessons copy from `file://`.

**Not checked:** the live `madebymatt.uk` origin. It returns 403 to this
container, and a 403 is not evidence a page is down. Everything above was
verified from the merge SHA and a localhost render instead. **Someone should
open the real site once in a browser** — that is the one gap.
