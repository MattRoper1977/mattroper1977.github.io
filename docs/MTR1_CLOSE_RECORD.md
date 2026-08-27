# ORDER MTR-1 — Micro-Tinkerer release, close record

**2026-08-26.** Run against `DEPLOY.md` §8.

**Expected outcome, stated before the work and unchanged by it:** with
`CLICK_EFFECTIVE` NOT-DONE, **§MTR-5 is HELD and the release is partial.** That
is the correct result, not a failure. A green site pull request while the click
is outstanding would be a finding about the check, not permission to merge.

---

## §MTR-0 — Readback

Every row measured in-session. Nothing assumed.

| row | value |
|---|---|
| `MAIN_TIP` | `cb435f4bbdbdc1f45096bf4623464409c166b9fc` |
| workflow hash vs the 20,047-byte before-image | `50702afefaff1497…` · **20,047 B** → `MAIN_WORKFLOW=BEFORE-IMAGE` |
| `CLICK_EFFECTIVE` | **NOT-DONE** — re-derived from the `CLICK_BASE..CI_HEAD` delta, which is empty; the mirror step at CI_HEAD still reads `cmp -s /tmp/canonical.json data/source-manifests/games.json` |
| Games tip | `43b29f79231115740abc9ffc3c2bee64743aa8d8` |
| `data/pathway-exclusions.json` | exists · `excludedCategories: ["game"]` → **arcade class present** |
| `signalEndpoint` | `""` — **EMPTY** |

**Estate fact 2 confirmed by observation, not inherited.** Running the site's own
mirror check on this branch reports `STALE — mirror 4b3787eb… vs canonical
f4aab9ab…`. That is the same drift #191 exists to clear, **inherited** because
this branch is cut from main, not introduced here. The site pull request carrying
this work will red on `Shelf mirror equals the served canonical` for exactly that
reason — expected, and not grounds to touch the check.

---

## §MTR-1 — PWA · **SHIPPED**

The ruling was *ship it*, and it ships.

**Placement was derived, not assumed.** The order never names a path, so it was
measured: all **25** site-hosted games are `<slug>/index.html` and **exactly one
file each** (`emberwild/` = 1). The record MTR-4 carries points at
`/assets/cards/micro-tinkerer.svg`. Hence `/micro-tinkerer/`. The Lessons pattern
was ruled out for an independent second reason: that repository's `CLAUDE.md`
requires `Games/*.html` to be single self-contained files, and a service worker
sitting beside one would break that rule.

**A finding the order did not anticipate.** The site already ships
`site.webmanifest` — `display: standalone`, 192/512 plus maskable icons — linked
from **12 pages**. But there is **no service worker anywhere on the site** (root
`sw.js`: 0; no game ships one). So `beforeinstallprompt` has never been able to
fire on this origin, for any page, ever. The Install button was not merely broken
in this game; the precondition was missing estate-wide. This is the first service
worker in the estate.

**What shipped:** the game at `micro-tinkerer/index.html` with a
`<link rel="manifest">` added after `<title>`; `sw.js`; `manifest.webmanifest`.

The game has **zero external references** — measured, not assumed — so the cache
is one document. The worker is cache-first with a versioned name
(`micro-tinkerer-v1.2.0`) and **`skipWaiting` off**: a worker that seizes control
mid-round can swap the document out from under a live game.

The manifest **reuses the site's existing `/assets/icons/`** rather than
inventing binaries. Worth Matt's eye: the installed app will carry the Made by
Matt icon, not a game-specific one. Changing that means drawing four PNGs, which
is a decision, not a default.

### The proof, run in headless Chromium against a local serve

```
NEGATIVE CONTROL   offline with NO worker does not boot   <- so (b) means something
(a)                sw.js 200 · manifest.webmanifest 200 · zero 404s across the run
                   worker active · scope /micro-tinkerer/ and no wider
                   versioned cache micro-tinkerer-v1.2.0 · document precached
(b)                offline reload BOOTED: canvas present, controls present,
                   133,608 chars of body — not an error stub
                   ALL CHECKS PASSED
```

**The first run of that proof reported `sw.js` as never fetched.** It was my
instrument, not the code: Playwright's page-level `response` event does not
observe service-worker-initiated fetches. The tell was that the *same run*
showed the worker active and the cache full — a FAIL that contradicts its own
corroborating evidence is an instrument fault, not a finding. Corrected to assert
from the serving process's own request log, which sees every request that
crossed the wire.

**Honest limit:** proved against a faithful local serve, **not the deployed
path**, because site deploys are held behind the click. The order asks for the
deployed path; that is unavailable, and this is the nearest honest substitute,
labelled as such rather than reported as equivalent.

---

## §MTR-2 — Endpoint injection · **HELD**

`signalEndpoint` is `""` and **no Worker has been deployed**. §2 of `DEPLOY.md`
is a phone-only Cloudflare deploy that only Matt can perform, and it has not been
performed, so there is no URL to inject and no `/health` to probe.

Both proofs the order requires — a `{"ok":true}` from `/health` **and** a
WebSocket upgrade to `/ws?mode=create` returning a `welcome` frame with a
six-character room — are therefore **unrunnable**, not failed. Nothing was
injected and nothing was claimed.

Leaving it empty is a supported state: the multiplayer controls disable and label
themselves. The build in this pull request is correct as it stands, and becomes
multiplayer-capable the moment the endpoint is set.

---

## §MTR-3 — Two-phone test · **UNMEASURED**

Matt's, not the agent's. It has not been done, so the close says `UNMEASURED`.
No limb of this pass reports multiplayer as working, and none could: §MTR-2 never
obtained an endpoint to test.

---

## §MTR-4 — The Games record · **VERIFIED, HELD**

The trap the order names — that "sabotage the room", "recover batteries" and
build-adjacent language would file an arcade game under a teaching pathway — is
**disproven by measurement**.

**Why it cannot fire, read from the generator rather than assumed.**
`build_mbm_search_index.py` line 355 hardcodes `"category": "game"` for every
`games.json` entry, and line 364 passes that category into
`pathway_for_category(...)`. The class exclusion is applied **before** any text
matching. A shelf entry cannot acquire a teaching pathway by prose, whatever the
prose says.

**Then proved end-to-end.** A throwaway worktree, based on #191's head so the
index baseline is already reconciled (`nothing to write: the generated index
already matches the committed one`), the draft record added to the mirror, the
index regenerated:

```
records 717 -> 718
ADDED                                        1   [game-micro-tinkerer]
REMOVED                                      0
pre-existing records changed in ANY field    0
pre-existing records gaining/losing a facet  0
with a pathway                             549 -> 549
NEW RECORD  category=game   pathway=None   route=/micro-tinkerer/
generator's own summary: 1 added, 0 removed, 0 changed, 80 moved position only
DELTA CAP: PASS
```

`"recover"` is present in the description. The record still carries **no
pathway**. **Micro-Tinkerer does not become the tenth.**

Exactly four paths change, and they are the four a single new arcade record
*should* touch: its own entry, `counts.game`, `counts.total`,
`sourceHashes.games.json`. Nothing else.

**`games.json` was never written.** It has a single writer and it is Matt (Z-D3).
The dry run happened in a scratch worktree of the *site* repo, which was removed.

**Why the record is HELD.** The order's coupling ruling: *"Either land the asset
in the same PR as the record, or hold the record until MTR-5 opens."* The record
lives in the **Games** repository and the card in the **site** repository, so
"the same PR" is not available. **Half the coupling is now resolved** —
`assets/cards/micro-tinkerer.svg` is created and ships in this pull request, XML-
validated, 120×96 in the house idiom with a real `<desc>`, and rendered to
confirm it is not a blank rectangle. But that pull request is itself held, so the
asset is not yet *served*, which is the condition the order actually cares about:
CI would go green while the card renders broken.

The record is drafted, delta-capped and ready. It is handed back, not applied.

**The draft record, for when it lands:**

```json
{
  "icon": "🔧",
  "title": "Micro-Tinkerer: The Giant's Study",
  "desc": "Shrunk to thumb height in a giant's study, with three AA batteries to recover — one down in the Lowlands, one on the desktop, one along a bookshelf. A Seeker hunts you the whole time, and you carry an exposure meter that fills when you are in the open and a stamina meter that empties when you run. The room is your other move: an angle lamp, a tub of PVA, a desk fan, a line of hardcover books stood on end. Hiders prevail if one of them is still loose at the end. Up to four players share a six-character room code, and single player runs fully offline.",
  "href": "/micro-tinkerer/",
  "tag": "Hide & seek",
  "hue": "#73e5b2",
  "featured": false,
  "hero": false,
  "art": "/assets/cards/micro-tinkerer.svg"
}
```

Written to the FC-R A4 standard: what the player does and what the game does
back. Every clause is traceable to a string in the artefact — *"Hide, then
recover three AA batteries"*, the `Lowlands` / `Desktop` / `Bookshelf` battery
labels, the `Seeker` and `Hider` roles, the exposure and stamina meters, the
angle lamp / PVA / desk fan / hardcover domino sabotage definitions, *"Hiders
prevail"*, the four-peer cap and the six-character code. No latency, no draw
loops, no physics ticks.

`tag` reuses the shelf's existing **`Hide & seek`**; no new vocabulary is
introduced. `collection` is omitted — RPG, Shooter and Sports are the three in
use and none fits. `/micro-tinkerer/` is free and there is no title collision.

---

## §MTR-5 — Site publish · **SKIPPED-BY-GATE**

Opens only when `CLICK_EFFECTIVE` is DONE. It is NOT-DONE.

Proof of why, printed rather than asserted: `agx1-live-verify.yml` at `CI_HEAD`
(`c707277…`) is `ebf9b5ef3b1fd094…`, **25,846 B** — unchanged from `CLICK_BASE`,
and its mirror step still asserts against main's copy.

Nothing in this section ran. No copy was routed, no audience record was touched,
no R4 line was added or moved, the `/games/` 44px exemption was not re-raised,
and the `hud.js` declination was not recorded — that last is deliberate: the
order requires it to be entered in the declination register, and entering it is
§MTR-5 work.

---

## §MTR-6 — Copy Matt owns · **REPORT-ONLY**

Two sentences, neither composed here. The same rule that closed Section 19: do
not compose either to unblock a section.

1. The framing line for a game about hiding from a hunting teacher, sitting
   beside SEMH resources under his name.
2. The plain-English multiplayer note for the page.

**The order's point about (2) is confirmed by measurement.** The game contains
two external STUN services — `stun.cloudflare.com:3478` and
`stun.l.google.com:19302` — so "no external runtime dependencies" is not true of
the multiplayer path, and the page note has to name them alongside the
signalling server. (It remains true of single player: the document has **zero**
external references and boots offline, which §MTR-1's proof demonstrates.)

---

## §MTR-7 — Close

### Per section

| § | outcome |
|---|---|
| MTR-0 | readback complete, six rows, all measured |
| MTR-1 | **SHIPPED** — proof passed in a real browser, local serve |
| MTR-2 | **HELD** — no Worker deployed, so unrunnable rather than failed |
| MTR-3 | **UNMEASURED** — Matt's test |
| MTR-4 | **VERIFIED and HELD** — delta cap PASS, record handed back |
| MTR-5 | **SKIPPED-BY-GATE** — hash printed as proof |
| MTR-6 | **REPORT-ONLY** — STUN finding confirmed |

### Measured versus inferred

**Measured:** every readback row · 25 one-file game directories · zero external
references in the game · the absence of any service worker estate-wide · the
whole MTR-1 proof including its negative control · the generator's
category-before-text ordering · the delta cap · the STUN services · the card's
XML validity and render.

**Inferred:** that `/micro-tinkerer/` is the right path. It follows from the
25-game pattern and from the card path the order itself specifies, but the order
never states it and nobody has ruled on it. If Matt wants a different slug, it is
a rename in one pull request and the record has not been written yet.

### Handback — four items, no fifth

1. **The Cloudflare deploy clicks.** §2 of `DEPLOY.md`, ten minutes, phone only.
   Until this is done §MTR-2 and §MTR-3 cannot run at all.
2. **The relay decision.** §4 — public with relay off, a second school Worker
   with `RELAY: "on"`, or single-player-public only. The arithmetic that decides
   it is in §3: roughly 500 rounds a day signalling-only against 5 with relay.
3. **The TURN decision.** §7 — without it a minority of home players behind
   symmetric NAT will not connect; with it you are paying for relayed media.
4. **The two sentences in §MTR-6.**

The mirror-leg click is *not* a fifth item here. It is already item 1 of the FC
arc handback, and it blocks this release the same way it blocks #191 and #192.
