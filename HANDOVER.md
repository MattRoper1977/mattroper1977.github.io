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

## 2 August — the account offer, built and dormant

Matt asked whether the UAS tool and Voxel Frontier could go behind an account.
**They cannot, and the reason is structural rather than a matter of effort.**
GitHub Pages is static: `/voxel/index.html` and `/uas/app.html` return HTTP 200
and their whole contents to a plain `curl`, with no JavaScript run. A login
check in JS happens after the browser already has the file. Measured, not
assumed.

So the offer became **sync instead of gating**: nothing is taken away, and an
account does the one thing the site otherwise cannot — stop your work being
stranded on one machine. Two cards on the homepage, banners on `/uas/` and
`/voxel/`.

**Pupil data is deliberately excluded, and the card says so.** `uas_register`
holds `pupils`, `marks`, `sessions` and `evidence` alongside `units` and `kv`.
Only the last two sync. The rest is named children, their marks and evidence
photographs; uploading it would contradict what both registers promise in their
own copy and would be a data-protection decision, not a technical one.

**None of it renders yet, on purpose.** Everything is bound to
`MBM_CAPS["cloud-sync"]`, which is set only by a verified write-then-read-back
round-trip — not by keys being present in config. Nothing sets it, because the
sync module needs a live Supabase project to build and verify against. Both
states are tested: capability absent → band hidden, 0 account cards,
`deferred=2`; capability present → band visible, 2 cards with art,
`deferred=0`.

**The fifth gate-defeat, and this time the class is closed.** The band rendered
its heading over an empty strip despite carrying `hidden`, because
`.dx-zone{display:flex}` outranks the UA sheet's bare `[hidden]`. Same trap as
the Log in button earlier the same day, and `mbm-features.css` already carried
**four** one-off `[hidden]` patches written for the same reason, one per
sighting. `styles.css` now opens with `[hidden]{display:none!important}`.
Checked first that no rule anywhere deliberately displays a `[hidden]` element
— every one of them sets `display:none`.

---

## 2 August — both of the above are now closed

**The Evening Workshop photo is gone.** `art-studio-suite` was rewritten from a
generic easel into the photo's actual subject — three lit studios on an evening
workbench — and the door dropped its `image` field onto it. That closed both
faults at once: no more baked-in gibberish, and no more letterbox, because the
SVG is 5:4 like every other card. `images/evening-workshop.jpg` was deleted;
nothing referenced it afterwards and git still has it.

Measured after: all four lessons cards paint at an **identical 1.25 in an
identical box** at 390, 768 and 1280 — the row is finally even, at every width,
with nothing cropped. Homepage image weight fell **211.6 KB → 77.6 KB**.

**Accounts are switched off.** `features.accounts.enabled` is `false`. The
reasoning is in `FEATURES.md`; the short version is that the account gated
nothing — the members page said so in three places, and the one thing it
offered said in its own copy that signing in did not unlock it — while asking
for a password that never left the device and, by the local backend's own
error message, could never be reset. That combination has no upside and one
real downside: it invites password reuse.

Nothing was deleted. `MBMAuth`, both backends and the modal all still work, and
flipping the boolean back restores the whole flow — proven by doing it, not
asserted: with `enabled:true` and no other change, the header button, the
modal, the members gate and the members hero copy all come back.

**One trap worth carrying forward.** The first version of the off-switch set
`btn.hidden = true`, and the Log in button stayed on screen — `.mbm-navbtn`
sets `display:inline-flex`, which outranks the UA sheet's `[hidden]{display:none}`.
That is the fourth gate on this estate defeated by a more specific rule. It was
caught only because the check counted *visible* buttons rather than trusting
the attribute it had just set. The switch now removes the nodes.

---

## Two things found while checking, both now closed — original notes below

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

**Reconciled 2 August 2026.** Items 1 and 2 below were still marked open, and
item 1 was still marked "the top item on return", after both had been closed —
1 on 2 August and 2 across 1–2 August. A list that says a finished thing is
outstanding is worse than no list: it sends the next person to redo work. The
closed ones are struck through rather than deleted so the trail survives.

~~**1. Members / accounts — needs Matt's decision, do not guess.**~~
**CLOSED 2 Aug.** Matt asked for the decision to be made rather than deferred.
Accounts are switched off (`features.accounts.enabled: false`); nothing
collects a name, email or password. The offer is now sync rather than gating,
built and dormant. Reasoning in `FEATURES.md` §3.

~~**2. Studio count not verifiable here.**~~
**CLOSED 2 Aug.** The estate no longer states a Creator Hub studio count
anywhere. `98b0a59` removed three; a fourth survived at
`resources/index.html:139` ("29 single-file studios") and was removed on
2 August. The figure had been wrong four times. Nothing here now asserts a
number this repo cannot derive from data it renders.

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


**8. Head metadata — CLOSED 2 Aug.** Was: og:image on 7 of 25 pages,
twitter:card on 4, `rel=canonical` on 1, og:url on 2. Now, counting only the
16 real indexable pages (excluding `next/`, the `noindex` members page, the
404 and the paste-in fragment): **og:image 15, twitter:card 15, canonical 15**.
The one gap left in each is `resources/medevac-frontier/index.html`, a
three-line stub that is not a page.

*Worth recording how that number was arrived at.* The first pass through this
work claimed 15/15/15 and shipped it. Re-deriving the figure afterwards — the
whole point of the "check the claims" job — returned **13** for twitter:card
and canonical: `medevac/MedevacFrontier_v1.html` and `medevac/studio.html` had
been left out of the second batch and nobody had counted again. The claim was
written from what the change was *meant* to do rather than from the tree. Both
pages were then fixed and the count re-derived, which is where 15 comes from.
An audit that only ever confirms is not an audit.

**9. Sitemap — CLOSED 2 Aug.** Listed 6 of this repo's own paths against 25
HTML files. Seven live pages that were absent are now in it: `/apexkick/`,
`/voxel/`, `/medevac/`, `/experiences/medevac-frontier/`, `/stats/`,
`/uas/app.html`, `/asdan/app.html`. 438 `<loc>` total.

**10. FEATURES.md geolocation claim — CLOSED 2 Aug.** It said location was
looked up via ipwho.is with an ipapi.co backup. Neither host appears in any
shipped JavaScript; `git grep` returns zero files for both. Struck through in
place rather than deleted.

**11. Dead members CSS — CLOSED 2 Aug.** `.mb-perks` and `.mb-grid`, five
rules in `members/index.html`, had no producer anywhere in the tree. Removed,
559 bytes.

**STILL OPEN and genuinely so:** items 3, 4, 5, 6 and 7 above, plus the cloud
sync module (needs Supabase keys — `FEATURES.md` §3), an mp4 twin for
`clip-voxelfrontier-play.webm` (this container can only encode VP8), and
Enforce HTTPS on the three project repos, which is a GitHub UI setting with no
file representation and cannot be done from here.

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
