# Handover — 31 July 2026

For whoever picks this up next, including Matt after a fortnight away.
Everything below shipped to `main` and is live. Nothing is half-finished.

---

## What shipped today

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
