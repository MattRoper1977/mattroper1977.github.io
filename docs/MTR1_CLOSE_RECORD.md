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

---

# ORDER MTR — Final automatic close-out (r2)

**2026-08-27.** Run against `mtr-final-automatic-closeout-2026-08-27-r2`. The
MTR-1 record above is unchanged; this section is appended beneath it and reports
only what this pass measured and published.

**Terminal state: `MTR_CLOSE_BLOCKED`.** Two beats are human and neither can be
inferred: Matt merges the canonical shelf record, and Matt runs the phone check.

---

## The eight items

| # | Item | State |
|---|---|---|
| 1 | Worker · MTR-2 · MTR-3 | **BLOCKED-ON-HUMAN-ACTION** |
| 2 | Shelf record and route coverage | **BLOCKED-ON-HUMAN-ACTION** — prepared, validated, PR open |
| 3 | Real-phone check | **BLOCKED-ON-HUMAN-ACTION** |
| 4 | Relay | **CLOSED BY DECISION** — off in the public build |
| 5 | TURN | **CLOSED BY DECISION** — deferred, and disclosed on the page |
| 6 | MTR-6 sentences and their placement | **DONE** |
| 7 | Manifest policy | **DONE** |
| 8 | Lessons ruleset · Site/Games strictness | **UNRUNNABLE** · **CLOSED BY DECISION** |

---

## 1 · Worker, MTR-2, MTR-3 — BLOCKED-ON-HUMAN-ACTION

Not a code or config defect. `DEPLOY.md` §2 **step 1** has not been performed:
the repository it names does not exist. The account holds five repositories and
`micro-tinkerer-signal` is not among them. This environment also has no
`wrangler`, no Cloudflare credentials, and no route to `api.cloudflare.com`, so
§7.2's precondition — authenticated GitHub **and** Cloudflare access — fails at
its second clause.

`signalEndpoint` is therefore left `""`, with its explanatory `signalNote`
intact. That is a supported state: multiplayer disables itself and says so.
MTR-2 and MTR-3 are **UNRUNNABLE**, not failed — there is no endpoint to probe
and no round to play.

## 2 · Shelf record and route coverage — prepared, handed over

`MattRoper1977/Games` PR **#42**, one record appended, 54 → 55.

Every field derived rather than chosen: the title from the card's own committed
`<title>` (the game's `<h1>` uses a non-breaking hyphen and a curly apostrophe —
heading typography no catalogue title carries); `Hide & seek` already in the
derived vocabulary so nothing is minted; `#73e5b2` unused elsewhere; the art
path on disk, parsing, 120×96, its `<title>` naming this game. The insertion
point is the convention read from the file's own history — ordinary additions
append; only a game taking the `NEW ·` marker goes to index 0, and that would
edit a second record.

```
delta cap    54 -> 55 · 1 added · 0 removed · 0 pre-existing records differing
             in any field · hero holder unchanged · no "NEW ·" title moved
diff         1 hunk, 11 insertions, 0 deletions
validator    PASS, 55 entries
controls     drop art / duplicate href / malform route -> each red, each named
```

Downstream, proven in disposable worktrees against the candidate:

```
search index      717 -> 718 · 1 added · 0 changed · 0 gaining or losing a facet
new record        category=game  pathway=None  route=/micro-tinkerer/
                  ("recover" is in the description; the class exclusion holds)
route coverage    28 -> 29 routes · /micro-tinkerer/ exactly once
HUD inventory     25 -> 26 · the register entry stops being ahead of the walk
```

**The record must not land alone.** Three-state control:

```
A  base state                                   uncurated contract 17/17, exit 0
B  refreshed mirror, no taxonomy row            [FAIL] every shelf game has
                                                exactly one genre - /micro-tinkerer/
C  plus the taxonomy row                        17/17, exit 0
```

The taxonomy genre is **derived, not chosen**: `Hide & seek` maps one-to-one to
`Party & Whole-Class` across the whole shelf (Charcoal is its only other
holder), and Charcoal's `feels` are `together, quick-go, thinky`. Re-checked at
merge time; if that mapping ever stops being one-to-one, the site half stops
rather than silently picking a genre.

## 3 · Real-phone check — outstanding

Not substitutable. This session cannot fetch the live site at all: `CONNECT
tunnel failed, response 403`, identically for `https://madebymatt.uk/` and for
`/micro-tinkerer/`. That is a blanket egress block on this session, **not** a
route-specific failure — CI's own live-estate job reaches the site and passed on
every run in this pass. Classified **UNRUNNABLE here**.

A successful Pages deployment is not this gate. Neither is a local serve,
`swReady=true`, or a non-firing `beforeinstallprompt`.

## 4 · Relay — CLOSED BY DECISION

Off in the public build. The arithmetic is `DEPLOY.md` §3: signalling-only is
roughly 500 rounds a day on the free tier, relay roughly 5. The Worker answers a
relay attempt with `relay_unavailable` rather than pretending, and carries its
own 40,000-packet ceiling even when relay is on. The separate relay-enabled
school Worker is **not** created; it waits on a real four-device school-network
test. No paid plan was enabled.

## 5 · TURN — CLOSED BY DECISION

Deferred. Re-measured in the shipped document: two STUN services
(`stun.cloudflare.com:3478`, `stun.l.google.com:19302`) and **zero** TURN
entries. The consequence — a minority of home and restricted-network players
will not connect — is not left implicit; it is on the page, in item 6.

## 6 · The two MTR-6 sentences — DONE

Both ship **verbatim**. The proof compares the rendered strings byte-for-byte
against the approved text.

- **Framing** — after the hero lead, adjacent to the title and description.
- **Multiplayer** — immediately **before** Host LAN / Join LAN, so it is read
  before the control it describes rather than after it.

### What proving visibility found, and it was not the copy

A string can be in the file, in the DOM, and seen by nobody, so the proof is a
browser measurement at 390 and 1440 CSS px with no click, no pointer lock and no
scrolling. It went red at 390 immediately — and identically on untouched main:

```
BASELINE, main, 390x844    eyebrow top=-320  h1 top=-300  lead top=-229
                           #menu display:flex align-items:center overflow:auto
                           scrollHeight 1208 > clientHeight 842, scrollTop 0
```

`#menu` centres a column taller than itself, and a flex container centring
overflowing content pushes the overflow out of the **top**, where scrolling
cannot reach it. On a phone the game's own title, its description and the first
mode button have been unreachable. That predates the disclosures.

The page already carried the fix for short viewports —
`@media(max-height:620px){#menu{align-items:flex-start}}` — but a tall narrow
phone is not a short viewport. `align-items: safe center` centres while there is
room and falls back to flex-start on overflow, at every width:

```
AFTER, 390x844             eyebrow top=46  h1 top=66  lead top=137
                           modes top=378   sub-actions top=669
```

### The visibility evidence

```
framing      390:  303x79  at (46,277)   100% in viewport   hit-test -> itself
             1440: 552x39  at (237,385)  100% in viewport   hit-test -> itself
multiplayer  390:  303x158 at (46,669)   100% in viewport   hit-test -> itself
             1440: 552x79  at (237,585)  100% in viewport   hit-test -> itself
```

Both unscrolled and pre-interaction; `display:block / visibility:visible /
opacity:1`; adjacent to their named anchors in reading order; and read in the
state a player meets today, with `signalEndpoint` empty and the multiplayer
controls disabled and labelled *"Multiplayer not configured"* — precisely the
state the second sentence describes. The hit test is the assertion that matters
on a full-screen WebGL document: it asks what the browser would hand a finger at
that point, so a paragraph painted behind the canvas fails it.

**Negative control:** a copy with both paragraphs stripped fails the same suite,
4 assertions across 2 widths, exit 1. Screenshots captured at both widths.

Accessibility residue, also measured: both paragraphs stay visible, reflowed and
unclipped with **Reduced Stimulation** on; no horizontal page scroll at 390; and
the tab order is byte-identical to untouched main.

The service worker's cache version moves with the document it precaches:
`micro-tinkerer-v1.2.1 → v1.2.2`. `index.html` is in `PRECACHE` under a
cache-first policy, so without the bump a returning player would keep the old
document — the one without the disclosures.

## 7 · Manifest policy — DONE

Twelve pages linked `/site.webmanifest` with no service-worker scope covering
them: a promise the origin has never been able to keep. One worker exists and
its scope is `/micro-tinkerer/`.

**Four source edits, not twelve output edits:** `render_audience_homepages.py`
(the root and the seven `/for/` pages), `render_discovery_hubs.py` (`/teach/`,
`/education-hub/`), `privacy/index.html`, and `main/index.html` — whose `<head>`
is hand-authored even though a renderer splices a card region **elsewhere in the
same file**. The edit asserts the link is outside that region before touching
it. Both renderers were then re-run rather than their outputs typed.

Afterwards, derived rather than asserted: exactly one page still links a
manifest, and it is the one with a deciding scope. `apple-touch-icon` is
preserved on 22 pages and `theme-color` on 53, so **iOS Add-to-Home-Screen is
untouched**. No claim is made about Chrome installability: the
`beforeinstallprompt` probe does not fire in headless Chromium **even for
`/micro-tinkerer/`**, which has both a manifest and an active worker, so that
instrument distinguishes nothing and is not cited.

## 8 · Lessons ruleset — UNRUNNABLE · strictness — CLOSED BY DECISION

`MattRoper1977/Lessons` has **no ruleset** (`GET /rulesets` → HTTP 200, `[]`)
and `branches/main.protected` is **false**, so it is genuinely unprotected
rather than merely ruleset-free. That second instrument was needed because
legacy branch-protection reads return 403 for every repository here.

The proven-safe context set was **re-derived, not carried**. The census widened
from 12 PRs to **20** — every merged Lessons PR since
`fieldops-p2-and-sweep.yml` landed on 2026-08-19 — and the answer is unchanged:

| Contexts on 20/20 PRs | |
|---|---|
| FieldOps P2 - the build is reproducible and the labs still boot | |
| Merged is not served - the placed labs and the Studio | |
| No open PR runs zero checks | |
| The stale-evidence sweep can still find something | |
| The way out of a game is keyboard-reachable - both estates | |

**Count: 5.** Nothing added, nothing dropped relative to the 12-PR census. All
five are emitted by that one workflow, whose `pull_request` trigger carries a
branch filter and **no path filter**. Every other observed name is sporadic —
`liveteach suites` 6/20, `verify-generated-tree` 2/20, `verify` 2/20 (and
`verify` resolves to more than one job), the rest 1/20.

**Lockout control:** requiring `liveteach suites` would leave **14 of the 20**
PRs permanently pending, because its workflow is path-filtered to
`liveteach/**`. That is why the set is five and not thirteen.

The ruleset was **not created**: `POST /repos/.../rulesets` returns

```
HTTP 403  Write access to this GitHub API path is not permitted through this proxy.
```

The same path reads 200, and an empty body returns the identical refusal, so the
block is on writes generally rather than on this payload or on permissions.
Nothing partial was created — Lessons still reports `[]`. **UNRUNNABLE**, and
per the standing rule that is never to be described as "zero rulesets".

**Strictness stays false** on Site and Games. Measured: only 1 of 12 site PRs
and 0 of 12 Games PRs would have needed a branch update, so the benefit is
small, and enabling it re-couples every PR to main's tip near the class of
deadlock ORDER DL was lifted to remove.

---

## 9 · Publication

| What | Identifier |
|---|---|
| Site `main` before | `bbfdbdb5c09570c93c60e91088352845acf991ed` |
| Site PR #201 merged | `b63e88fed9cf12c39bca1c781b3e9af37d6985c3` |
| Pages run for it | `33064816699` — success, 2026-08-27T10:52:10Z |
| Games PR #42 | open, awaiting Matt |
| Games `main` | `43b29f79231115740abc9ffc3c2bee64743aa8d8` (unchanged) |
| Lessons `main` | `288f84543ccef2884de62e6002b4b814360249c1` (unchanged) |

## 10 · Checks and classifications

Site #201: **14 success, 2 skipped, 0 red** — the two skips are
`Routes serve 200…` and `Exact production deployment…`, both `if: github.event_name != 'pull_request'`
by design. All four required contexts green.

Games #42: **8 success, 2 failure**, both required contexts (`contract`,
`aggregate`) green. The red is `Site mirror has caught up with this shelf`, and
it is **not in the required set**. It is red by construction on any
canonical-side shelf addition — it compares the site's mirror on `main` against
this PR's `games.json` (`STALE … mirror 28805 B vs canonical 29647 B`), and the
mirror follows the canonical by design, so it cannot lead it. The check's own
header says the fix is a site-repo commit. Precedent: Games #41 merged
2026-08-26 in the identical shape.

Live verification from this session: **UNRUNNABLE** (blanket proxy 403). CI's
live-estate job: **success**. These are different instruments and are not
interchangeable.

## 11 · Instrument faults met before the corrected runs

- `verify_curation_keys.mjs` reported `INCONCLUSIVE: acorn is not importable` —
  identically on untouched main. A missing dependency is an instrument fault,
  not divergence. Installed `--no-save`; no manifest or lockfile moved; it then
  judged and passed 52/52.
- The first ruleset POST was refused as form-encoded: `curl -d @file` defaults
  to `x-www-form-urlencoded`. Re-sent as JSON; the refusal then named the real
  cause, a proxy write block.
- The first visibility gate accepted "the top edge is somewhere on screen",
  which passed with **18 of 158 pixels** showing. Tightened to 90%.
- The first keyboard assertion required `#btn-host` to be Tab-reachable and
  failed — identically on main, because that button is `disabled` and labelled
  *"Multiplayer not configured"* while signalling is unavailable. A disabled
  control is correctly not tab-reachable; the assertion was wrong, not the page.
  Replaced with a tab-order-unchanged comparison against main.
- An installability probe hung on `navigator.serviceWorker.ready`, which never
  resolves on a page with no worker; raced against a timeout.
- `render_games_manifest_mirror.py --check` without `--canonical` exits 2. That
  is an invocation error and proves nothing about the mirror.

## 12 · Worktrees and open PRs

All three checkouts clean, nothing unpushed, all disposable worktrees removed.

Open PRs created by this pass: **Games #42** (awaiting Matt) and none other.
`Games #37` and `Site #169` (TL-2 Town Life) were inspected and left untouched;
both remain `HELD`, unchanged since 2026-08-18, and Site #169 is already
`mergeable_state=dirty`. Neither was modified, closed, approved or merged.
