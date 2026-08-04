# AGX-1 · VERDICTS

One verdict per commit in the change set, each backed by a measurement taken in
this run. The merged commits were treated as untrusted: nothing here was
established by reading the diff and agreeing with it.

---

## site#36 — `ceeb5bd763bfe545cc466f0ec80c0394cf098db5` · "Build Apex Golf"

### **APPLIED AS STATED**

| §11.3 requirement | Measurement | Verdict |
|---|---|---|
| byte count == reported 64,513 | `wc -c` → **64513** | match |
| blob SHA == `132034b7…` | `git hash-object` → **`132034b789ccef09bac8d26abf99fd8f9292cb02`** | match |
| file ends `</body></html>` | ends `…html>\n<!-- apexgolf-build-2026-08-04 -->` — closing tags present, sentinel comment after | match, not truncated |
| sentinel ×2, at start **and** end | **2** occurrences; first line has it, last line has it | match |
| no `.replace()`/regex edit silently no-opped | 7 files, +1208/−3, every hunk lands in a file that exists and changed | no no-op |
| sitemap gained exactly one canonical line | one `<url>` block, one `<loc>https://madebymatt.uk/apexgolf/</loc>` | exactly one |
| `index.html` zero delta | blob `515809a5…` identical BASE→HEAD | zero |
| `site.json` zero delta | blob `9a3db29c…` identical BASE→HEAD | zero |

**SHA-256 of the shipped file** (measured here, not previously reported):

```text
c0701ee1152d57c16e676c58f58054c1884495d7e41d2cf20f14d2404ddab041
```

**Blob stability across every subsequent landing** — the file has not been
touched since it merged:

```text
ceeb5bd  132034b789ccef09bac8d26abf99fd8f9292cb02   Build Apex Golf (#36)
0f1eb20  132034b789ccef09bac8d26abf99fd8f9292cb02   Restore Sports to TOP (#39)
b37efe2  132034b789ccef09bac8d26abf99fd8f9292cb02   Apex Pool New Release (#40)
e6ee788  132034b789ccef09bac8d26abf99fd8f9292cb02   Build Apex Tennis (#41)
edfe629  132034b789ccef09bac8d26abf99fd8f9292cb02   Tennis to Arcade Sports (#43)
6e8ab12  132034b789ccef09bac8d26abf99fd8f9292cb02   Golf+Tennis to homepage Sports (#44)
4afd348  132034b789ccef09bac8d26abf99fd8f9292cb02   Biopunk Hive (#45)  <- HEAD
```

`tools/verify_apexgolf.js` likewise stable at blob `2429d478…` throughout.

**Collateral:** three files outside the declared column — `assets/cards/apex-golf.svg`
(required by the mandatory `art` field), `games/index.html` (3 lines, the Sports
rail renderer) and `tools/verify_arcade_sports.js` (2 checks, 2 fixtures). All
three are proportionate to landing a shelf entry and none touches a protected
file. Not classified as unexpected collateral.

---

## Games#9 — the manifest extension

### **NOT INDEPENDENTLY VERIFIABLE — content confirmed, commit not**

The Games repository is outside this session's allowed scope, so the commit,
its diff and its merge SHA could not be read. What **was** measured, from
`raw.githubusercontent.com/MattRoper1977/Games/main/games.json`:

```text
entries              34
art                  34/34
duplicate ids        0
Apex Golf entry      present, collection=Sports, tag=Physics, hue=#7C5CFC,
                     art=/assets/cards/apex-golf.svg, href=/apexgolf/
description drift    NONE — manifest desc is byte-identical to the shipped
                     <head> meta description (§8.2's anti-drift rule held)
```

The claim "`games.json` count moved exactly 32→33 with zero duplicate ids and
no edits to sibling entries" is **historical and unreachable from here** — the
manifest is now 34 and the intermediate states cannot be diffed without repo
access. Recorded as a limit, not asserted as verified. See FINDINGS L-1.

---

## The harness itself — `tools/verify_apexgolf.js`

### **APPLIED, AND NON-VACUOUS EXCEPT IN ONE LIMB**

Reproduced independently in this container with a real browser:

```text
APEX GOLF GATE SUMMARY: 18 passed, 0 failed, 0 skipped, 18 total
ALL 18 APEX GOLF GATES PASSED
```

The author's reported 18/18 is **confirmed**, not taken on trust. Without a
browser the same harness reports 13 pass / 5 skip and names the skips — it does
not silently claim them.

**But G2's ε limb is vacuous.** See FINDINGS **A-2**, which is the first item
in the findings list by the brief's own instruction.

---

## Post-merge landings that changed Golf's situation

These are not Golf's commits, but they alter what Golf's readback asserts.

| Commit | Effect on Apex Golf | Verdict |
|---|---|---|
| `0f1eb20` site#39 | Restored Golf to TOP-adjacent whole shelf; reversed Golf's own arcade harness contract | **APPLIED PLUS COLLATERAL** — collateral is Golf's superseded assertions, cleanly rewritten |
| `b37efe2` site#40 | No change to Golf | clean |
| `edfe629` site#43 | Sports rail 3 → 4 games; Golf's "Three Apex games" copy replaced | **APPLIED AS STATED** |
| **`6e8ab129` site#44** | **Put Apex Golf on the homepage Sports cards, and added an Apex Golf door to `site.json`** | **APPLIED PLUS COLLATERAL — contradicts §8.4. Finding A-1** |
| `4afd3485` site#45 | Biopunk Hive; no change to Golf | clean |
