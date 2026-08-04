neonsync-land-2026-08-04 · closes apexgolf-build-2026-08-04 / estate-visuals-2026-08-04 Phase 1

# Apex job — session close

Every figure derived by a command run this session. Phase 1 close pointer:
**`c4cd408`** (`reports/agx2/PHASE1-CLOSE.md`, `A3-FIX.md`, `AMENDMENT-8.4.md`).

---

## C.1 — Recorded

- **A-6 CLOSED.** Pin removed (`…/Games/main/games.json`); functional `=== 34`
  assertions **0**; the single remaining `34` in the arcade chain is the comment
  recording the removal. Proven on three fixtures: 34 PASS · 35 PASS · 35-with-
  missing-art FAIL.
- **The ε limb CLOSED the strong way.** `frames=Math.round(seconds*renderHz)`,
  ε = 0 with an in-gate **positive control of 1.163**. The rig is proven sighted
  on every run, so **ε = 0 is evidence from this commit forward**, not before.
  Four tampers, four rejections — one of them (per-frame stepping) caught by ε
  itself.
- **C8 HOLDS — still undischarged.** Re-tested this session on two endpoints;
  `MattRoper1977/Games` remains outside the MCP allowlist. **Every statement
  about Games repository state carries the UNVERIFIED label.** Manifest
  *content* (34 entries, art 34/34, 49 placements) stands on two agreeing
  channels; repository *state* was never measured.

## C.2 — A-3, three parts recorded

(a) Baseline honest: **88.6% rect-overlap → 0 of 10 hole points visible** at
360/390/400. Now **10/10** at dpr 1, 2 and 3. Gate change stated as a gate
change. Fixture non-vacuous on the fourth attempt, with all three failed
fixtures logged rather than deleted.

(b) **The speck defect, and the general rule it produces.** `elementFromPoint`
at a 2×1 speck still returns the canvas, so the limb passed 9/9 while the screen
was empty. The screenshot caught what the gate could not.

> **RULE REGISTERED: a visibility gate must assert rendered size, not just
> hit-test membership.** Membership answers "is anything on top of it"; it does
> not answer "is there anything there to see". Both are required.

(c) **Residual: 768 → 3/10, 1280 → 7/10.** Reported, not buried; correctly left
outside the ≤400px ruling. **One-line decision for Matt:**
`Extend A-3 to tablet/desktop — go`, or it stays a recorded residual. **Not
acted on in this session.**

## C.3 — ANSWERED, read-only: nothing renders the catalogue's order

The open question was whether `features.downloads.catalog`'s array order reaches
a rendered surface. Measured — the full census of consumers:

| Consumer | Reads the array? | Does its **order** reach the screen? |
|---|---|---|
| `stats/index.html:122-140` | yes — maps `cat` to `dl_<key>` counter reads | **NO** |
| `assets/mbm-features.js:120` | yes — copies it into `CFG` | no render |
| `assets/mbm-features.js:263` `initDownloads()` | **no** — iterates `[data-mbm-count]` DOM attributes | n/a |
| `tools/apply_apextennis_home.js:40` | yes — a build-time transform, not a surface | n/a |

The one consumer that renders **re-sorts before painting**:

```js
rows = rows.filter(function(r){return r.n>0;}).sort(function(a,b){return b.n-a.n;});
```

Render order is by open-count descending, and entries with zero opens are
dropped entirely. **The array's order is never observable.**

**Consequence for the proposal to Matt: derivation is SAFE and carries no
ordering constraint.** `features.downloads.catalog` can be derived from
`doors[]` as `doors.filter(d=>d.countKey).map(d=>({key:d.countKey,title:d.title}))`,
which removes this instance of the estate's recurring *two copies of one truth*
shape by construction rather than by vigilance.

**PROPOSED, NOT IMPLEMENTED.** Both orphans remain Matt's:
- `assets/cards/apex-golf-door.svg` — referenced by nothing after the door removal.
- the `apex-golf` catalogue entry — **catalogue 14 against 13 doors on the branch**, nothing increments it.

## C.4 — THE THREE-HASH LADDER (verbatim, with deployment status)

```text
live / deployed      64,513 B   c0701ee1…      SERVED TODAY
+ ε-fix              65,195 B   7c66a2a2…      branch only, undeployed
+ A-3 fix            69,327 B   18b28e49…      branch only, undeployed  <- branch tip
```

**Binding consequences, re-derived this session:**

1. The live site serves the **OLD Golf** (`64,513 B / c0701ee1…`) and a
   **14-door `site.json`** — measured on `origin/main`, where the Apex Golf
   door is still present. The branch carries **13 doors** with the Golf door
   removed.
2. The ruled door removal and **both** fixes exist **only on the unmerged
   branch**. The ruled state is prepared, not live, and must never be described
   as live.
3. **The branch's merge is Matt's call, not mine.**
4. **On merge**, the live check re-runs via the proven verification-PR pattern
   and the readback must name **which hash is served**.

## C.5 — Phase 2 STOP stands

Refusing to run §1 against the site repo, and treating the 448-entry
`resources.json` read as a probe rather than a passed identity gate, were both
required. **Nothing further is owed on estate-visuals Phase 2 from this
session.**

**Matt's action:** estate-visuals Phase 2 needs a **new Claude Code session with
`MattRoper1977/Lessons` in the MCP allowlist**. Paste §1-onward there. The route
matrix travels with it:

```text
MCP github (PR create/merge/API)   DENIED — not in session allowlist
api.github.com/repos/…/Lessons     403 at proxy
raw.githubusercontent.com          200
git ls-remote via session proxy    OK, 54 heads
```

The site-repo attachment in that new session remains genuinely useful for §5/§9.

---

## OPEN-ITEMS LEDGER — 7 items

| # | Item | Owner / unblock |
|---|---|---|
| 1 | **A-3 tablet/desktop residual** (768 → 3/10, 1280 → 7/10) | Matt: `Extend A-3 to tablet/desktop — go`, or it stays recorded |
| 2 | **Orphan proposal** — door SVG + catalogue entry; derivation now proven safe (C.3) | Matt: propose-only, never implemented |
| 3 | **C8 — Games repository state** | a Games-scoped session; UNVERIFIED until then |
| 4 | **Golf branch merge** (`claude/apexgolf-build-2026-08-04-b1hbwj`, tip `c4cd408`) | Matt's call; on merge, re-run the live check and name the served hash |
| 5 | **Phone eyeball** on `/apexgolf/`, `/apexpool/`, `/apextennis/` | Matt — the only real B11 proof |
| 6 | **Biopunk live but invisible** at `/biopunkhive/` | awaits Games#12, which awaits #3 |
| 7 | **Estate-visuals Phase 2** | a Lessons-allowlisted session (C.5) |

---

## Five-line derived readback

1. **Site `main` = `4afd34854e92ec029be3d381433a855aaa82de6a`** — unmoved all
   session. Nothing merged; no branch deleted.
2. **Branch tip = `c4cd40838c1d680e80ec39c2508d1d8b0bbf88a2`**, 6 commits ahead,
   carrying the ladder `64,513 c0701ee1…` → `65,195 7c66a2a2…` →
   `69,327 18b28e49…`.
3. **Deployed vs prepared:** live serves the OLD Golf (`64,513 B`) and **14
   doors**; the branch holds both fixes and **13 doors**. Prepared, not deployed.
4. **Protected paths:** `index.html` **ZERO DELTA** by blob hash against
   `origin/main`. `site.json` changed by exactly the 13-line ruled door removal
   and nothing else. `#25` untouched at `7c202790`.
5. **Open items: 7**, each with a named owner and unblock above.

**CLOSE STAMP: Apex job closed for this session.** Every line above derives
clean. Nothing merged, no branch deleted, no PR I did not open was touched.

neonsync-land-2026-08-04
