neonsync-land-2026-08-04 · Part B — PREPARED, NOT APPLIED

# Neon Sync shelf card — ready-to-apply patch for a Games-scoped session

**This part CANNOT run in the session that prepared it.** `MattRoper1977/Games`
is not in that session's MCP allowlist and `api.github.com` 403s at its proxy;
both were re-tested. **The Games repository's state — branch list, PR state,
Games#12 — is UNVERIFIED and must keep that label.** Only manifest *content* was
measured, over `raw.githubusercontent.com` at `Games/main` (HTTP 200, 15,465 B,
34 entries).

---

## ⚠️ TWO HARD PRECONDITIONS — verify BOTH at apply time, before editing anything

### Precondition 1 — the arcade workflow's stale count

`\.github/workflows/arcade-sports-verify.yml` on the **site** repo pins the
manifest at a frozen SHA and asserts a literal count. Measured on site `main`
at the time of writing:

```yaml
curl … https://raw.githubusercontent.com/MattRoper1977/Games/900fae5e…/games.json
node -e "…if(d.games.length!==34)process.exit(1)"
```

**The fix for this (A-6) exists only on the UNMERGED branch
`claude/apexgolf-build-2026-08-04-b1hbwj`.** On site `main` the pin and the
literal are still there.

**Consequence if you land a 35-entry manifest first:** the workflow keeps
fetching the pinned 34-entry snapshot, so it does not go red — **it stays green
against a stale world**, which is worse. Land the derive-the-count fix (or its
equivalent) on site `main` first.

**Verify at apply time:**

```bash
grep -n '900fae5e\|!==34\|=== *34' .github/workflows/arcade-sports-verify.yml \
  tools/verify_arcade_sports_browser.js
# expect NO functional hits once the fix has landed
```

### Precondition 2 — Games#12 ordering is Matt's, not yours

`Games#12` carries **Biopunk Hive's withheld shelf card**. It is untouched and
must stay untouched by this patch. **Landing Neon Sync's card before Biopunk's
changes the order Matt set** — that is his call to change, not the applier's.

Either way, **Biopunk remains live-but-invisible**: `/biopunkhive/` is served
and is in `sitemap.xml`, with no shelf card, reachable only by typing the URL.

---

## The change: `games.json` 34 → 35

Append **one** entry. Every existing entry keeps its shelf presence — the
exactly-once rule was never a licence to drop anyone from browse-all.

```json
{
  "icon": "🎧",
  "title": "Neon Sync",
  "desc": "NEW · Team hero action where the score isn't your aim — it's whether you were the teammate everyone wants. Hold the point, back your squad, get endorsed.",
  "href": "/neonsync/",
  "tag": "Strategy",
  "hue": "#22D3EE",
  "featured": false,
  "hero": false,
  "art": "/assets/cards/neon-sync.svg"
}
```

**Key order matches the manifest's existing entries exactly**
(`icon,title,desc,href,tag,hue,featured,hero,art`) — derived, not assumed.

**No `collection` key.** Neon Sync is **not** a sports game and must **not**
join the Sports collection. Only four entries carry `collection`, all Apex.

**The `art` path is already committed** in the SITE repo as
`assets/cards/neon-sync.svg` (640×360 — the shape the arcade renderer declares,
`gCard` emits `width="640" height="360"`). It is a real committed file, not an
invented external path. It ships with Part A (#47).

---

## TAG = `Strategy` — RULED (D1). The `Team` mint is WITHDRAWN.

**Derived vocabulary of the 34-entry manifest (12 tags):**

```text
 8  Reflex        2  Sandbox       1  Rhythm
 8  Physics       2  Classic       1  Hide & seek
 4  Class game    2  Puzzle        1  Card battle
 3  Strategy      1  Whodunnit     1  Calm
```

**Checked for, and ABSENT:** `Multiplayer` · `Arcade` · `Team` · `Shooter` ·
`Action`. No existing tag names a 3v3 team hero game outright.

### The ruling, and why it is not a compromise

**`Strategy` passes the pupil-expectation test**, because thinking-beats-twitch
is not a marketing claim about this game — **it is enforced by the game's own
code**, and the build's harness measures each enforcement:

| Enforcement | Harness check | Measured |
|---|---|---|
| bot reaction floor | `reaction-at-least-150ms` | `0.18` s |
| bot aim error | `aim-error-positive` | `0.075` |
| no speed advantage | `equal-movement-speed` | pass |
| bounded vision | `finite-vision` | pass |

A player cannot be out-twitched by the opposition, so what remains to be good
at is reading the fight, holding the point and spending cooldowns for other
people. That is what `Strategy` promises a pupil, and the game keeps it.

### Why `Reflex` was rejected — the decisive argument

`Reflex` is the largest tag (8 uses) and the superficially obvious home for a
real-time action game. **It is the wrong one here, and actively so:** it
promises exactly the skill the design deliberately removes. A pupil who picks
Neon Sync off a `Reflex` chip has been told the opposite of what the four
measurements above enforce, and the pupil most likely to be put off by that
promise is the one this game was built to welcome.

**A tag that contradicts the game's own design claim is worse than a tag that
merely under-describes it.** `Strategy` under-describes; `Reflex` misleads.

### The withdrawn alternative

Minting `Team` would have described it exactly, at the cost of a thirteenth
tag. **Withdrawn by ruling D1** — the 12-tag vocabulary holds, and no tag is
minted for this landing.

**Apply the entry with `"tag": "Strategy"` exactly as written above.**

---

## Hue: `#22D3EE`, distinctness DERIVED

Measured in CIE Lab (ΔE, CIE76) against **all 34** existing hues, not just the
named siblings:

```text
duplicate of any existing hue?   NO
minimum ΔE                       17.7   vs Voxel Frontier #87CEEB
next closest                     27.7   vs #5EEAD4 (five games share it)

the named siblings:
  Apex Kick    #2F8F6B   ΔE  44.1
  Apex Pool    #F2A24A   ΔE  97.8
  Apex Tennis  #3B6FD4   ΔE  65.7
  Apex Golf    #7C5CFC   ΔE 101.9
  Biopunk Hive #00FF66   ΔE  96.5   (not in the manifest — Games#12 withheld)
```

**One honest caveat, measured:** the manifest does **not** enforce globally
pairwise-distinct hues — **five games already share `#5EEAD4`** (Axiom Shift,
Trail Runner, Neon Garden, Slipstream, The Last Lighthouse). Pairwise
distinctness is an **Apex-family convention, not a manifest-wide invariant**, so
`#22D3EE` clearing every existing hue by ΔE ≥ 17.7 exceeds what the manifest
actually requires. Recorded so nobody later reports the `#5EEAD4` cluster as a
regression this patch introduced.

---

## `NEW ·` — offered, not performed

The `desc` above carries the `NEW ·` prefix. Derived: **two entries currently
carry it — Apex Kick and Apex Pool.** Apex Kick's has been stale for some time.

**Offered, not performed:** retiring Apex Kick's (and, once Neon Sync takes New
Release, Apex Pool's) `NEW ·` prefix. Say the word and it is a one-line change
each; nothing was changed on either without it.

---

## G-B gate checklist for the applying session

Run each as its own step and record the exit code:

```text
[ ] manifest entries 34 -> 35, derived not asserted against a literal
[ ] art 35/35 — every entry still carries a non-empty art path
[ ] 0 duplicate ids (href uniqueness)
[ ] hue distinctness re-derived at apply time (the manifest may have moved)
[ ] tag is exactly "Strategy" (RULED, D1) — the Team mint is withdrawn and no
    tag is minted; the 12-tag vocabulary must be unchanged after this patch
[ ] no `collection` key on the Neon Sync entry
[ ] every pre-existing entry keeps its shelf presence — count them before/after
[ ] PRECONDITION 1 verified: the arcade workflow no longer pins or asserts a
    literal count
[ ] PRECONDITION 2 verified: Games#12 untouched; Biopunk still live-but-invisible
[ ] tag vocabulary size recorded before/after (12 tags today)
```

---

## What is already done, and where

| Piece | State | Where |
|---|---|---|
| `neonsync/index.html` | committed, byte-identical | site PR **#47** |
| `assets/cards/neon-sync.svg` | committed, 640×360 | site PR **#47** |
| browser gates | committed, 21/21 green | site PR **#47** |
| sitemap `/neonsync/` | committed | site PR **#47** |
| homepage New Release swap | committed | site PR **#48** |
| **`games.json` entry** | **NOT APPLIED — this document** | a Games-scoped session |

neonsync-land-2026-08-04
