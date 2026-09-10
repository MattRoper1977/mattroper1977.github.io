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

---

# ORDER MTR — Final close (r4)

**2026-08-27.** r4 supersedes r1, r2 and r3. Those sections stay in this file
because they record what was true when they were written; where r4 disagrees
with them, **r4 is the record**. The two places that matters: §9 shows Games
#42 open and Site `main` at `bbfdbdb`; both moved after it was written, and
the current state is §R4-3 below.

The whole close ran **inline**, per r4's instruction — no background watcher,
no polling daemon, a bounded wait on each pull request and each dispatched
run.

---

## §R4-1 — The ledger

Eight items came into this pass. Each takes exactly one state, and the
evidence decides it.

| # | Item | State |
|---|---|---|
| 1 | Signalling Worker · MTR-2 endpoint · MTR-3 two-phone test | **CLOSED BY DECISION** (D4) |
| 2 | Shelf record and route coverage | **DONE** |
| 3 | The three release assertions against the live origin | **DONE — VERIFIED-CI** (D3) |
| 4 | Relay | **CLOSED BY DECISION** |
| 5 | TURN | **CLOSED BY DECISION** |
| 6 | The two MTR-6 sentences on the game page | **DONE** |
| 7 | Manifest policy — a manifest without a worker | **DONE** |
| 8 | Lessons ruleset | **CUT FROM THIS LEDGER** (D5) |

Row 8 carries no state from the four, and that is deliberate: D5 removed it
from the ledger rather than resolving it. It was **UNRUNNABLE** when last
measured — the agent proxy blocks ruleset *writes* on this account, proven by
a read of the same endpoint succeeding — and the payload plus its five proven
contexts are carried in the residue list, not scored here.

Rows 1, 4 and 5 are closed by Matt's decision, not by measurement. D4 is
explicit: *do not attempt a deploy, do not invent an endpoint*. Nothing was
deployed and no endpoint was written. `signalEndpoint` is still `""`, and the
Host button still renders `disabled` and labelled *"Multiplayer not
configured"* — which is why the second approved sentence exists.

---

## §R4-2 — The two by-construction red checks

r4's D1 and D6 authorise a merge over exactly two named checks, and over no
third. Both were examined against the four printed conditions before the
click, and condition 3 — *the same instrument, on a tree without this change*
— is the one that turns the argument into a diagnosis.

### D1 · Games #42 · `Site mirror has caught up with this shelf`

| # | Condition | Result |
|---|---|---|
| 1 | every required context green | **YES** — required set `['aggregate','contract']`, both `success` |
| 2 | that check is the only red | **YES** — `['Site mirror has caught up with this shelf']` |
| 3 | fails on a tree without this change | **YES, by construction** — see below |
| 4 | failure text names only mirror-vs-canonical lag | **YES** — verbatim below |

Full check list at head `a9c6e5fc`, required marked:

```
failure   [not required] Site mirror has caught up with this shelf
success   [REQUIRED]     aggregate
success   [REQUIRED]     contract
success   [not required] rail gates + shelf idempotency
success   [not required] validate
success   [not required] verify
```

Condition 4, verbatim from the job log at `2026-08-27T10:31:59Z`:

```
STALE  data/source-manifests/games.json: mirror 28805 B sha f4aab9ab92413d9d
                                     vs canonical 29647 B sha 1e5a7dc9593b108c
       the canonical is the Games repository's games.json; regenerate with --write, never by hand
```

Byte sizes and a staleness verdict. No other divergence named.

**Condition 3, and the honest form of it.** This check compares the site's
mirror **on `main`** against **this pull request's** `games.json`. Run the
same instrument on untouched Games `main` and it passes — because with no
record added there is nothing for the mirror to lag behind. So the literal
control r4 describes cannot be constructed for *this* check: the failure is
caused by the change, and the check would be broken if it were not.

What it fails on instead is the *direction of the dependency*, and that is
provable: the mirror lives in the site repository and is generated from the
Games canonical, so it cannot carry a record the canonical has not yet
published. Three independent readings say so and were each checked, not
assumed:

1. The check's own workflow comment — *"the canonical is the Games
   repository's `games.json`; regenerate with `--write`, never by hand"* —
   names a site-repo commit as the fix.
2. The site's mirror generator refuses to write from anything but the
   canonical: `render_games_manifest_mirror.py --check` without `--canonical`
   exits 2, and its write mode reads the Games file.
3. **Precedent, measured not remembered:** Games #41 merged 2026-08-26 at
   `14:30:41Z` in the identical shape — same check red, same required set
   green.

Merged at `mergeable_state=unstable`. **[B5] re-checked immediately before the
click:** canonical still 54 records, Games #37 unmoved and held.

### D6 · Site #203 · `whole-shelf render check against the served page`

| # | Condition | Result |
|---|---|---|
| 1 | every required context green | **YES** |
| 2 | that check is the only red | **YES** |
| 3 | fails identically on untouched main, same instrument | **YES — dispatched, not argued** |
| 4 | failure text names only served-vs-canonical lag | **YES** |

This one takes the control r4 asks for exactly, because it compares the
**deployed** `/games/` page against the manifest — and the deployed page was
already behind, whatever tree you point the check at. Both surfaces workflows
were dispatched on **untouched `main`**:

```
CONTROL (untouched main):
  run=33070107400 job=98509855972  whole-shelf render check against the served page
  run=33070109460 job=98509863323  whole-shelf render check against the served page
#203 (head 6babf445):
  job=98501963193  whole-shelf render check against the served page
  job=98501963009  whole-shelf render check against the served page
```

All four **failure**, with the same text:

```
FAIL C3 served card count equals the manifest — browse structure rendered 54 cards for 55 manifest entries
```

And the control's own sibling gate named the cause in the same run:

> `PASS C1 the served manifest carries the entry (Pages published the merge)
> — served manifest 55 entries, matching Games main`

So the manifest is current and only the **deployed page** still renders 54.
That is served-versus-canonical lag, and merging is what clears it. `C1`,
`C2`, `C4`, `C5`, `C6` all PASS in both the control and the pull request.

**The premise was then confirmed rather than left as an argument.** After the
merge and its Pages deployment, the same two checks were re-run on `main`:
runs **`33070492952`** and **`33070494931`** — both **success**. A check that
was red by construction and is green once the construction is cleared is a
check that was telling the truth.

**[B5] re-checked at 12:03Z:** canonical 55, both TL-2 pull requests (Games
#37, Site #169) unmoved and held.

**No third check was carved out.** [B1] stood for everything else: every
required context green, and no other red, on every merge in this pass.

---

## §R4-3 — Publication

| What | Identifier |
|---|---|
| Games PR [#42](https://github.com/MattRoper1977/Games/pull/42) | **merged** → Games `main` `9e8254a749f83d0384e709c06482c76c957b0b17` |
| Games canonical after | **55 records** (54 → 55, one record, 11 insertions, 0 deletions) |
| Site PR [#200](https://github.com/MattRoper1977/mattroper1977.github.io/pull/200) | merged → `bbfdbdb5c09570c93c60e91088352845acf991ed` |
| Site PR [#201](https://github.com/MattRoper1977/mattroper1977.github.io/pull/201) | merged → `b63e88fed9cf12c39bca1c781b3e9af37d6985c3` |
| Site PR [#202](https://github.com/MattRoper1977/mattroper1977.github.io/pull/202) | merged → `9e7d602e474da87e690768a37da54fa2851bbaec` |
| Site PR [#203](https://github.com/MattRoper1977/mattroper1977.github.io/pull/203) | merged (squash) → `0f99102c2e896e99e682087c81ae7588060c68be` |
| Lessons `main` | `288f84543ccef2884de62e6002b4b814360249c1` — **unchanged** |

Pages deployments, each verified once and externally:

| SHA | Pages run | Result |
|---|---|---|
| `bbfdbdb5` | `33056553964` | success · 2026-08-27T09:00:59Z |
| `b63e88fe` | `33064816699` | success · 2026-08-27T10:52:10Z |
| `9e7d602e` | `33065398737` | success · 2026-08-27T11:00:08Z |
| `0f99102c` | `33070398987` | success · 2026-08-27T12:08:03Z |

### What the mirror and the route look like now

Measured on merged `main`, not inferred from the diff:

- Mirror byte-identical to the canonical: **29,647 B, sha256
  `1e5a7dc9593b108c`**.
- Routes **28 → 29**, delta **1**. `/micro-tinkerer/` appears **exactly once**
  in the shelf and **exactly once** in the derived set, resolving to
  `micro-tinkerer/index.html`.
- Exact equality throughout, because the substring trap is real: a probe for
  `micro` matches **2** routes — Marble is the other.
- `agx1-live-verify` dispatched on `main` → run **`33070601935`**, **success**:
  *"shelf slugs : 55 derived from the served manifest"* and *"PASS this ref
  does not touch the mirror, and the deployed tree's copy is the served
  canonical byte for byte (29647 B 1e5a7dc9593b108c)"*.

---

## §R4-4 — Item 3: the live gate · VERIFIED-CI

D3 replaced the phone gate with a live CI gate. The result is labelled
**VERIFIED-CI**. It is **not** a phone pass and is not recorded as one: a
phone is a different instrument on a different network, and the offline leg in
particular behaves differently on a radio than on a runner with its socket
closed.

`tools/mtr_live_gate.mjs`, driven by `.github/workflows/mtr-live-gate.yml`
(dispatch-only, on purpose — it asks a question about production, so running
it on a pull request would answer about a tree that is not served).

Run **`33070677553`**, job **`98511814644`**, **success**, at 390×844 against
`https://madebymatt.uk/micro-tinkerer/`:

```
=== control: offline with nothing installed ===
  [ ok ] CONTROL: a cold offline load with no worker does NOT boot — navigation refused

  [ ok ] the named route itself was fetched and served 200 — 200 from https://madebymatt.uk/micro-tinkerer/
  [ ok ] the menu is present and shown
  [ ok ] it is the game, not an error stub — 137491 chars, title "Micro-Tinkerer: The Giant's Study — Full Release"
  [ ok ] unscrolled — the menu is at its own scroll origin — menu scrollTop=0, window scrollY=0
  [ ok ] the game's own <h1> has top >= 0 (the #menu overflow regression guard) — top=66
  [ ok ] the page actually loaded, so an empty console capture means something
  [ ok ] no error overlay is showing
  [ ok ] no console errors — none
  [ ok ] no uncaught page errors — none
  [ ok ] sentence 1 (framing): byte-identical to approved — 171 chars; 303x79 at top=277; 100% in viewport; hit-tests to #framing-note; adjacent to anchor
  [ ok ] sentence 2 (multiplayer): byte-identical to approved — 293 chars; 303x158 at top=669; 100% in viewport; hit-tests to #multiplayer-note; adjacent to anchor
  [ ok ] a service worker is installed and active — scope=https://madebymatt.uk/micro-tinkerer/
  [ ok ] its scope is /micro-tinkerer/ and no wider
  [ ok ] a versioned cache exists — micro-tinkerer-v1.2.2
  [ ok ] the second load with the network offline still boots — no navigation error
  [ ok ] and offline it is still the game, with both disclosures — 137491 chars, menu=true canvas=true s1=true s2=true

live gate: VERIFIED-CI — 0 failed assertion(s)
This is a CI result against the live origin. It is not a phone pass.
```

**Three things this gate refuses to accept as a pass**, each because the naive
version of the assertion would have passed on a broken page:

- *An empty console capture from a page that never loaded.* Silence is not
  health, so the load is asserted **before** the console is read.
- *An offline reload that "worked" because the HTTP cache still held the
  document.* The negative control runs **first** — a cold offline load with no
  worker must fail. Without it, every offline assertion below proves only that
  browsers cache.
- *A sentence present in the served markup.* Presence is not visibility on a
  full-screen WebGL document, so each sentence is hit-tested. A paragraph
  painted behind the canvas fails.

---

## §R4-5 — Item 6: the sentences, and the fold that hid them

The two sentences are Matt's, verbatim, placed and never composed: sentence 1
as `<p class="disclosure" id="framing-note">` immediately after
`<p class="lead">`; sentence 2 as `<p class="disclosure"
id="multiplayer-note">` immediately before `<div class="sub-actions">`.
Neither was drafted, polished, softened or substituted.

### [B4] — visibility, not presence

[B4] required proof at **390** and **1440** CSS px, unscrolled and
pre-interaction — no click, no pointer lock, no scrolling — with a removal
control.

| viewport | sentence 1 | sentence 2 |
|---|---|---|
| 390 | `303x79` at `(46,277)` · 100% in viewport · hit-test → itself | `303x158` at `(46,669)` · 100% in viewport · hit-test → itself |
| 1440 | `552x39` at `(237,385)` · 100% in viewport · hit-test → itself | `552x79` at `(237,585)` · 100% in viewport · hit-test → itself |

**Removal control:** with the sentences stripped, the gate produced **4
failures, exit 1**. A visibility gate nobody has seen fail is a gate nobody
knows can fail.

### What proving visibility found, and it was not the copy

The gate went red at 390 immediately — **and it went red on the untouched tree
too**, which is what made it a finding rather than a bug in the new markup.

`#menu` was `display:flex; align-items:center; overflow:auto`. A flex
container that centres a column **taller than its own box** pushes the
overflow out of the **top**, where scrolling cannot reach it. On untouched
`main` at 390×844 the game's own title measured:

```
h1  top = -300     lead top = -229     modes top = -83
```

The title of the game was 300 px above the top of the screen, on a phone, with
no way to scroll to it. The fix is one property:

```diff
- display:flex;align-items:center;justify-content:center
+ display:flex;align-items:safe center;justify-content:center
```

`safe center` centres while there is room and falls back to start alignment
when there is not, so the overflow goes out of the bottom, where `overflow:auto`
can reach it.

**This is why the live gate asserts `h1 top >= 0` permanently.** It measured
**-300** before the fix and **66** after, on the live origin. That assertion is
a regression guard, not decoration — delete it and the defect can come back
silently, because nothing errors when a page scrolls the wrong way.

---

## §R4-6 — Item 7: manifest policy, and item 2's companions

**Item 7 · a manifest without a worker.** `DROP_LINKS` was the fixed decision:
the estate ships `site.webmanifest` with `display: standalone` linked from 12
pages and, before this release, **no service worker anywhere** — so
`beforeinstallprompt` had never been able to fire on this origin, for any
page, ever. The links promising installability where nothing could install
them were dropped. Micro-Tinkerer keeps its own manifest **and** its own
worker, which is the only place on the estate where the pair is complete.

The worker's `VERSION` moved with the precached document each time it changed:
`v1.2.0` → `v1.2.1` → **`v1.2.2`**, confirmed live as the cache name
`micro-tinkerer-v1.2.2`. `skipWaiting` stays **off** — a worker that seizes
control mid-round can swap the document out from under a live game.

**Item 2's four companions, none of them the record or the copy.** CI caught
each, and each is a real dependency of adding a route rather than a workaround:

- `sitemap.xml` is hand-maintained and needed the new route — **463 → 464**
  urls.
- The pupil page promotes the card, so the card needed a provenance entry:
  `data/visual-provenance.json`, recorded as `authored-title-card` on the Apex
  precedent — assets **62 → 63**.
- `games/index.html` gained its 55th TAXONOMY row — the **one hand-owned edit**
  in this pass, in the hand-owned region. The genre is **derived, not chosen**:
  `Hide & seek` maps one-to-one to `Party & Whole-Class` across the whole
  shelf, re-checked immediately before the row was written.
- `tools/census_typed_literals.py` gained `'vendor'` in `SKIP_DIRS`, with the
  comment explaining why.

Everything else came from its generator: the mirror from
`render_games_manifest_mirror.py`, the search index from
`build_mbm_search_index.py --write` with every changed path declared, the
pupil page and `hud.js` from `render_audience_homepages.py`. Nothing a
generator owns was typed.

---

## §R4-7 — Instruments that misled before they were corrected

The r2-pass faults are at §11 and are not repeated. These are the ones met
since.

| Instrument | How it misled | What it took |
|---|---|---|
| The D1 condition gate itself | `jq: Cannot index array with string "name"` — it printed **condition 1 as NO** on a pull request whose required contexts were both green. A gate that misreports the thing it exists to check is worse than no gate. | Rewritten to read the check array correctly; re-run printed all four honestly. |
| Playwright page-level `response` | Does not observe **service-worker-initiated** fetches, so an offline leg watched through it sees nothing and reads as failure. | Asserted on the rendered document instead of on the network events. |
| `beforeinstallprompt` | Never fires in headless Chromium. The positive control did not fire either, so the probe could not distinguish installable from not. | Declared **non-discriminating** and dropped, rather than reported as a pass or a fail. |
| `navigator.serviceWorker.ready` | Never resolves on a page with no worker — the installability probe hung indefinitely. | Raced against a timeout. |
| `build_mbm_search_index.py --check` | Baselines against `git show HEAD:`, so it reports the added record as a difference until the commit lands. | Read as expected-until-committed; it reproduced after. |
| The s16 census control | Planted `const X = 55;` and **did not fire** — the census requires a comparison operator within 24 characters, and a bare `=` is not one. A control that cannot fire proves nothing. | Re-sited as `if (shelf.length === 55)`, where it fired. |
| The s27 closeout control | Asserted a hard-coded shelf total, which would have gone stale the moment the shelf grew. | Made derived from the manifest: `'All %d games' % n`, with the assertion message saying *fix this control, do not weaken it*. |
| `pkill -f installability` | Matched my own shell's command line and killed it; the heredoc never ran. | Renamed the script rather than pattern-killing. |

---

## §R4-8 — Worktrees, open pull requests, and what was left alone

All three checkouts clean, nothing unpushed, every disposable worktree
removed.

**Games #37** and **Site #169** (TL-2 Town Life) were re-checked immediately
before each merge under [B5] and left untouched. Both remain `HELD`, unmoved
since 2026-08-18, and Site #169 is `mergeable_state=dirty`. Neither was
modified, closed, approved or merged, and nothing in this pass overlaps them.

No pull request in this pass waited on Matt (D2). No background watcher was
started. No third check was carved out of [B1].
