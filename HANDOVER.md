# Handover

For whoever picks this up next, including Matt after a fortnight away.
Everything below shipped to `main` and is live. Nothing is half-finished.
Most recent session first.

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
