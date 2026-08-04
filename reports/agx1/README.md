apexgolf-build-2026-08-04

# Pass AGX-1 — independent post-merge verification of Apex Golf

The build's 18/18 readback was self-reported by the author of the commits. This
pass is the independent check. The merged commits were treated as **untrusted by
default** and verified by render and measurement, never by reading the diff and
agreeing with it.

| Artefact | What it holds |
|---|---|
| [`CHANGESET.md`](CHANGESET.md) | identity gate, environment probe, the derived change set, the zero-delta assertion |
| [`VERDICTS.md`](VERDICTS.md) | one verdict per commit, each backed by a measurement |
| [`FINDINGS.md`](FINDINGS.md) | **five AMBER, eight GREEN, two limits** — every finding severity, file, measurement |
| [`DECISIONS.md`](DECISIONS.md) | decisions taken as the pass ran, including three of my own errors caught before shipping |

---

## Five-line derived readback

1. **Both repo tips.** Site `main` is `4afd34854e92ec029be3d381433a855aaa82de6a`
   — *not* the brief's expected `6e8ab129`; the Biopunk landing moved it and the
   estate wins. `MattRoper1977/Games` is outside this session's allowed scope, so
   its tip is **UNVERIFIED**; its manifest content was read over raw at `main`
   (HTTP 200, 15,465 bytes, 34 entries).

2. **Files changed by the set.** Golf's merge `ceeb5bd7` touched **7 files,
   +1208/−3**: `apexgolf/index.html` (64,513 B, blob `132034b7…`, SHA-256
   `c0701ee1…`), `tools/verify_apexgolf.js`, its workflow, one sitemap `<url>`,
   plus three in the important column — `assets/cards/apex-golf.svg`,
   `games/index.html` (3 lines) and `tools/verify_arcade_sports.js` (4 lines).
   **`index.html` and `site.json` both ZERO DELTA by blob hash across the set.**
   Golf's blob is unchanged at all seven subsequent commits to head.

3. **Gates green / amber / red.** **18 of 18 gates reproduced PASS** in a real
   Chromium here, independently of the author's run — 0 failed, 0 skipped. Plus
   my own rigs: 1,000-shot live-hole fuzz 1000/1000 settled, 0 non-finite; all
   1,800 Call Rating triples in contract; 6/6 sibling save keys unmoved; clean
   boot over `http://` **and** `file://` with 0 errors and 0 external requests.
   **5 AMBER, 0 RED.** No gate was skipped without being named. Live check
   closed by CI run `30919019077`: all nine estate endpoints **200**, and all
   five games byte-identical live-to-committed.

4. **Manifest and sitemap counts.** Manifest **34** entries, `art` **34/34**, 0
   duplicate ids, Sports = Kick · Pool · Golf · Tennis, **Physics = 8 derived**
   (the record's "7" predates Tennis), no `Sport` chip minted, four hues
   pairwise distinct (closest pair Golf↔Tennis **ΔE 39.7**). Arcade renders
   **49 placements from 34 entries** — 34 shelf + 7 themed + 4 classroom + 4
   Sports; the discrepancy stays **CLOSED**. Sitemap: exactly **one** canonical
   `/apexgolf/` line, 444 `<url>` entries, **0 duplicate `<loc>`s**.
   `site.json` doors **12 → 14**, not 12 → 13.

5. **The ε vacuity result.** **ε = 0 is vacuous — proven, not suspected.** With
   `DT` tripled, and again with `dt` stripped from the integrator, ε stayed
   **exactly 0** on both the harness's rig and an independent wall-clock rig,
   because `drive()` always runs the same fixed step count and `renderHz` only
   changes the chunking. **G2 as a whole is still non-vacuous** — both tampers
   were rejected by its static limbs — and the shipped physics is genuinely
   frame-rate independent (`MAX_FRAME_DELTA` 0.12 s < `MAX_SUBSTEPS·DT` 0.1333 s,
   so no accumulator spiral). It is the ε *number* that is not evidence.

---

## MATT'S ACTIONS

### 1. The phone eyeball — first, and the only real proof

Open **https://madebymatt.uk/apexgolf/** on your phone.

Everything else in this report was measured in a headless browser. A 200 with
matching bytes proves the file is *served*; it does not prove a thumb can grab
the ball. **This is the only evidence that closes B11 in the world**, and no
agent can manufacture it.

What to check, in ninety seconds:

- it loads past the splash to the **Apex Golf** title;
- **"Read hole 1"** shows par, length, wind, slope, water and bumpers *before*
  you call;
- you can **drag back from the ball and release** — if the ball does not respond
  where your thumb is, B11 is not closed and everything else is moot;
- the 9-hole round ends on a **scorecard that stays put** (defect B21).

### 2. Rule on C1 — Apex Golf's homepage surfaces (finding A-1)

Golf was ruled to have **no** homepage surface. It now has **two**: a hardcoded
Sports card and `site.json` door #6. Both halves are laid out in A-1 with a
recommendation. **This needs your decision, not mine** — nothing was reverted.

### 3. Read A-6 before Games#12 lands

The arcade verification chain is pinned to a frozen 34-entry manifest snapshot
and asserts `=== 34` in five places. When Biopunk's shelf card takes the
manifest to 35, that workflow **will still report green against a stale world**.
Fix it — by deriving the count — at the same time you land Games#12, not after.

### 4. Biopunk Hive is live but invisible

`/biopunkhive/` is served and in the sitemap, but has **no shelf card**: it is
reachable only by typing the URL. Games#12 is prepared and withheld pending your
ruling. I could not verify its branch is intact — the Games repo is outside this
session's scope (L-1).

### 5. Nothing — C2 is already closed

`.github/workflows/agx1-live-verify.yml` ran as
[`30919019077`](https://github.com/MattRoper1977/mattroper1977.github.io/actions/runs/30919019077)
and returned **success**. All nine estate endpoints returned **200**, and all
five games are byte-identical live-to-committed:

```text
apexgolf     64513 B   c0701ee1…   IDENTICAL   <-- first ever live fetch
apextennis   59852 B   8e109ab5…   IDENTICAL   <-- closes Tennis's skipped check
apexpool     88751 B   4de1383f…   IDENTICAL
apexkick    162122 B   541697f7…   IDENTICAL
biopunkhive  76841 B   f129e84b…   IDENTICAL   <-- Biopunk's live claim now true
```

Kept only as a standing check; it re-runs on any push to this branch.

---

## What I could not reach

- **The Games repository.** Outside this session's allowed scope; no `add_repo`
  tool exists. **Games#9's commit and Games#12's branch state are UNVERIFIED** —
  C8 could not be discharged. The manifest *content* was measured (34 entries,
  Biopunk absent, consistent with "prepared and withheld"); the repository
  *state* was not.
- **Whether a pupil can play it.** Headless Chromium is not a Year 9 thumb, and
  a 200 with matching bytes proves serving, not playability.

The live domain was **not** a limit in the end — it was unreachable from the
container (403 at the proxy) but reachable from CI, which is what §11.6 says
the channel is. See A-5.

Nothing further merges unless this prompt is amended in writing.

apexgolf-build-2026-08-04
