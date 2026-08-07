# Estate close — Stage W, Stage U-fin, Stage V-fin
**7 August 2026.** Every figure derived on the tree in front of me. Nothing
restated from the order, including its counts.

---

## §0 · Gates

**0.1 Attachment pin.** `Glowbound_The_Great_Ascent.html` searched for by name
*and* by size across the filesystem, not assumed:
`807ea812ba669e6f98d9dd98e98eb6b545b60bb08dd0a5d6441a566e75c6bace`,
**110,144 B — exact.** Stage G is unblocked. (It is parked for budget at the
V-fin/G boundary, which is a different thing from the two previous parks and is
recorded as such.)

**0.2 Floors, by ancestry.** `git merge-base --is-ancestor`, never by eye:

| repo | assertion | result |
|---|---|---|
| site | `1a68a28` ancestor of main | **yes** |
| site | `63357a7` ancestor of main | **yes** |
| Games | `4a1445c` ancestor of main | **yes** |
| Lessons | `aad7b50` ancestor of main | **yes** |

Landing order derived rather than assumed: `63357a7` (PR #87) landed first,
`1a68a28` (PR #88) second.

**An error of mine, caught and corrected inside the gate.** The Lessons check
first ran with a `cd` still pointing at the Games clone and reported
"`aad7b50` NOT an ancestor — document stale". That was a **wrong-subject null**
(§2.3), not a stale document. Re-run against the right repository it passes.
Had I trusted it I would have stopped the whole sitting on my own shell error.

**0.3 Live queue, derived before touching the manifest:** shelf **46** ·
sitemap **454** · sole `NEW·` holder `/olympics/` · none of `/ouroboros/`,
`/novasiege/`, `/glowbound/` present in the tree · `_staging/` held `novasiege`
and `ouroboros` · **no open PR on Games touches `games.json`**, so the single
manifest writer rule holds.

**0.4 PR #25** — measured locally, with the exit status asserted *before* the
output was read, which is the specific failure the last sitting made:

| | files | hunks | merge-tree exit |
|---|---|---|---|
| before any write | **1** | **1** | 1 (conflict — a real result) |
| after all writes | **1** | **1** | 1 |

Unchanged, untouched.

---

## §W · The contaminated set — closed

The U-P1 audit's eight "refuted" verdicts were recorded as contaminated
because the subject was edited mid-audit. Each was re-tested **against the blob
it was made about** — the pristine attachment, frozen read-only — and
separately reported at HEAD. Testing at HEAD alone would have refuted them
wrongly wherever the defect had since been fixed: the original error repeated
in the opposite direction.

```
47 confirmed earlier  +  8 confirmed  +  0 refuted  +  0 unresolvable  =  55
```

**Every one of the eight was real on the blob it was made about. There were no
false claims.** The refutations were entirely artefacts of my editing. Left
open, "8 false claims" would have hardened into canon.

| id | on ORIGINAL | at HEAD |
|---|---|---|
| U2-6 | confirmed | fixed |
| SAVE-02 | confirmed | fixed |
| SAVE-12 | confirmed | fixed |
| SAVE-05 | confirmed | **still present** |
| OD-2 | confirmed | **still present** |
| OD-3 | confirmed | **still present** |
| OD-4 | confirmed | **still present** |
| A11Y-12 | confirmed | **still present** |

The five still-present are carried forward by id into Stage M.

One verifier's note is worth keeping: on U2-6 it observed that under reduced
motion the pre-fix veil jumped straight to *the call site's* strength rather
than to full white, so "instantly permanent at full strength" is literally true
only of the strength-1.0 Paradox Collapse site. The hazard stands — an unfaded
step to an 85 %-opaque white sheet is exactly what reduced motion exists to
prevent — but the mechanism is a luminance **step**, not a strobe.

---

## §U-fin

### SAVE-06 — fixed at the sink, after four false nulls that were all mine

The vector is not a name field. It is an **unrecognised key emitted raw**
through a `||k` / `||id` fallback, rendered inside the Codex, Forge and Spire
modals.

**Measured on the pre-fix blob through the real load path** — hostile save
written to storage, page reloaded, `continueGame()` driven as a player would:
raw markup in all three modals and an `onerror` handler that **actually fired**.

Four earlier probe runs returned a clean null and **every one was the probe's
fault**, in four different ways:

1. it never opened the modals that render those fields;
2. it then opened all four in a row — each `open*` replaces `#modalLayer`, so
   only the last survived and the Codex render was gone before measurement;
3. its selector matched the game's **own** `<script>` block as an injection;
4. it never called `continueGame()`, so the hostile save was never loaded at
   all — `progress 0`, `screen "boot"`, every collection empty.

Any one of those, accepted, would have closed a real defect as "not
reproducible".

**Escaping is at the sink.** SAVE-02/03's load-time validation already drops
most of these keys and is worth having, but a source-side filter leaves the
sink loaded for the next caller. The gate proves the sink independently by
writing hostile values **straight into `Game.save`**, bypassing the loader —
and it asserts the payload still *reaches* the renderer as escaped text, so a
sink that silently dropped everything could not pass in its place.

| | control (pre-fix) | fixed |
|---|---|---|
| handlers fired | **1** | 0 |
| live injected elements | **5** | 0 |
| payload reaches renderer | yes, as markup | yes, **as escaped text** |

**Severity, stated so it is not misread:** saves are local today, so this is
not live-exploitable. It is fixed now because the estate ships a cross-device
sync module, and save-controlled strings are exactly the class that becomes
foreign input the moment sync is switched on.

### A11Y-02 — focus management, proven by keystrokes

Focus moves in on open, Tab and Shift-Tab are trapped, Escape closes, focus
returns to the invoking control. Proven by driving **24 real key presses** and
reading `document.activeElement`, with the pre-fix blob as control: focus never
moved in, and **18 escapes** out of the dialog.

**The probe caught a real bug in my own fix.** The return-focus guard used
`offsetParent !== null`, which is **null for a `position:fixed` element even
when fully visible** — so focus was never handed back to any fixed-position
invoker, which is most of this game's HUD. Both the guard and the tabbable
filter now use `getClientRects()`. The probe only caught it because a previous
iteration had been de-vacuumed: its first version focused whatever button it
found, silently failed when none was visible, and then compared `""` to `""`
and passed.

### Gate and size

`tools/verify_ouroboros.mjs` — **70/70 limbs**, 204,762 B against the 300 KB
ceiling, control green.

### Publish — `/ouroboros/`

Landing set complete and coherent (R1): folder · shelf entry · sitemap line ·
collection · card art · marker state, all in one set.

- shelf **46 → 47**, sitemap **454 → 455**
- collection **RPG** seeded; tag `Action RPG` so the tag-derived RPG rail picks
  it up (3 members) until Stage T folds that rail onto collection — derived
  either way, never hand-listed
- `NEW·` transferred **atomically in the same write**: Global Games demoted,
  Ouroboros promoted

**Hue — both of the order's candidates are forbidden, with figures:**

| candidate | ΔE00 | nearest | |
|---|---|---|---|
| brass `#d4af37` | **2.11** | Charcoal `#D9B44A` | **forbidden** |
| cyan `#00f0ff` | **3.94** | Echo Vault `#6ff7ff` | **forbidden** |
| **shipped `#9f772f`** | **19.06** | Apex Pool `#F2A24A` | clears |

Scored against **every one of the 46 neighbours individually**, not against a
family. Second nearest Charcoal at 19.53. Contrast 4.63:1.

---

## §V-fin · `/novasiege/`

Published the B1 state as it stands; B2 and B3 are untouched and sit in Stage M.

The staging tree was **moved, not copied**, so no orphan copy is left served —
a staged game still reachable after the real publish is a half-publish in
reverse. `_staging/` now holds only its README. Production was confirmed
returning **404 on `/_staging/`, `/_staging/novasiege/` and
`/_staging/novasiege/index.html`** before the move (CI run 31184255011), and
the gate that proved it remains in place, failing on anything but 404/403
including a transport error.

- shelf **47 → 48**, sitemap **455 → 456**
- collection **Shooter** seeded — the rail renders only once Stage T
  establishes it and a second member exists
- `NEW·` transferred atomically: Ouroboros demoted, Nova Siege promoted

**Hue.** The game's own neon palette was unusable, and by a startling margin:

| its own token | ΔE00 to nearest shelf hue | |
|---|---|---|
| `--cyan #6ff7ff` | **0.00** | Echo Vault `#6ff7ff` — the same colour |
| `--amber #f2a24a` | **0.00** | Apex Pool `#F2A24A` — the same colour |
| `--magenta #ff3df0` | 8.08 | Relicforge `#d05cff` |

Shipped **`#f43600`** — the game's own `--red #ff426a` pushed until it clears.
Nearest overall Apex Rally `#FF737C` at **ΔE00 20.11**; the **whole Neon family
individually** clears by at least **30.93** (Neon Turf `#D02578`), which is the
neighbourhood that actually mattered. Contrast 4.83:1.

**Copy** leads twin-stick and arena, taken from the game's own menu text —
never "Overdrive"-led, never "Siege"-led, because the shelf already carries
Neon Snake Overdrive, Neon Turf: Overdrive and Neon Siege.

Both cards are **real captured frames** of the games' own screens, and both
were **opened by eye** before being accepted (§2.8).

---

## §A spent gate, recorded rather than routed around

`verify_apextennis_manifest.js` and its shim `verify_apexpool_sports_manifest.js`
fail. They are **not** failures of this work:

- they pin Sports membership to exactly four titles
  (`Apex Kick, Apex Pool, Apex Golf, Apex Tennis`) — the shelf has carried seven
  since long before this sitting;
- measured at 46 entries **and** at 47, they fail identically;
- `verify_apextennis_manifest.js` is referenced by **no workflow at all** — a
  spent single-publish artefact;
- the live `apexpool-sports-verify` workflow has been **red on every branch
  since 2026-08-04** — six consecutive failures across four branches.

Its own workflow comments say the one-shot baseline assertion "dies with the
gate". Recorded and carried forward; not weakened, and not used to justify
weakening this publish.

**How I nearly got this wrong.** My first measurement reported these two as
*passing* before my change and *failing* after — which would have made them my
fault. That reading came from `printf ... "$?"` evaluated **after**
`$(basename …)` had run, so I was reading basename's exit code, not node's.
Re-measured with the status captured immediately, they were already red.

---

## §Register — every error this sitting made about its own work

| error | class | how it surfaced |
|---|---|---|
| Lessons floor checked with `cd` still in the Games clone | wrong subject | would have stopped the sitting on a false "document stale" |
| `$?` read after an intervening command | exit status of the wrong command | reported a pre-existing red gate as newly broken by me |
| SAVE-06 probe never opened the rendering modals | unreached surface | clean null on a real, firing defect |
| SAVE-06 probe opened four modals in a row | measured only the survivor | `#modalLayer` is overwritten by each open |
| SAVE-06 probe matched the game's own `<script>` | instrument read its subject as a finding | false positive, then a false negative |
| SAVE-06 probe never called `continueGame()` | never drove the real load path | the hostile save was never loaded |
| A11Y-02 probe focused an invisible button | vacuous pass | compared `""` to `""` and called it "focus returned" |
| my A11Y-02 fix used `offsetParent` | wrong visibility test | `position:fixed` reads null; focus never returned |
| Stage W workflow carried a dead `require` line | script error | failed in 26 ms before any agent ran |
| card art accepted only after opening it | — | correct by rule; recorded because it is the rule that caught a garbage banner twice |

---

## §Parks — with derived conditions

**Stage G — Glowbound. Parked for BUDGET at the V-fin/G boundary, not for
evidence.** The attachment is present and byte-exact, so this is a different
park from the two that preceded it. G-P1 is a full end-to-end — a diagnostic
spine, eight mandatory findings, and gates that must each go red against a
control — and starting it with what remains would half-finish a stage the
document says to stop before. Everything it needs is in hand.

**Stage T — taxonomy.** Not started, and it must run **once** over the final
shelf. As of this close the shelf is **48**; Puzzle's ≥2-member threshold
depends on Glowbound, so T should follow G rather than precede it.

**Stage H — homepage.** Not started. PR #25 measured 1/1 before and after.

**Stage M — polish and media.** Not started: Ouroboros U-P2 B2–B6 (~95 KB
headroom), Vector B2/B3, Olympics O-P2/O-P4, and the three media legs. Carried
forward with them: the five still-present U-P1 findings (SAVE-05, OD-2, OD-3,
OD-4, A11Y-12), the ~20 other confirmed-but-unfixed ids from the U-P1 report,
and the spent Apex Tennis gate above.

**Not proven live.** Both publishes are **merged**, not **served** — §1.9. The
live legs run in CI against production and are not yet green for these two
paths at the time of writing. Nothing here claims either game is live.

No clean-estate declaration is made.
