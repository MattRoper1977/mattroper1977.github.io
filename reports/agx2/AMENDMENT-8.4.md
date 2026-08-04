apexgolf-build-2026-08-04

# Amendment to §8.4 — Apex Golf's homepage surfaces

**Ruled by Matt, 4 August 2026, on AGX-1 finding A-1 (§12.3 C1).**
Recorded here because §8.4 lives in the brief, not in the repository, and a
ruling that is not written down is a ruling that gets re-litigated.

---

## Both halves, as they stood

**The record said** — §8.4, D3, and Apex Pool's landing report:

> *"Apex Golf is intentionally absent from the homepage, preserving its later
> merged no-homepage ruling."* · *"Homepage placement — Not in this PR."*

**The landed state said otherwise.** Tennis Part C (`6e8ab129`, site#44) gave
Apex Golf **two** homepage surfaces:

| Surface | How it was measured |
|---|---|
| Hardcoded Sports card in `#homeSports` | Chromium with **JavaScript disabled** — it renders, so it is not a renderer artefact |
| `site.json` door **#6** | `site.json` doors measured **12 → 14**, not 12 → 13; Golf and Tennis each took one |

Confirmed a third time from the **served bytes** in CI (run `30919678785`):
`Apex Golf` 2 mentions, `apexgolf/` href 1 occurrence on the live homepage.

## The ruling

> **C1 — RATIFY the four-game homepage Sports block. REMOVE Golf's `site.json`
> door #6. One surface per game stands; Pool's spotlight+Sports pairing remains
> the ruled exception, not the precedent.**

## §8.4 as amended

- The homepage Sports block is **four games** — Apex Kick, Apex Pool, Apex Golf,
  Apex Tennis — hardcoded, rendering with JavaScript disabled. **Ratified.**
- **Apex Golf has exactly one homepage surface: its Sports card.** The earlier
  "no homepage surface" ruling is superseded; the "one surface per game" rule
  is not.
- **Apex Pool's New Release spotlight + Sports pairing remains the single ruled
  exception** to one-surface-per-game, and is not a precedent.
- Apex Pool remains the hardcoded New Release occupant.
- Door hrefs remain **relative**. No door was deleted to make room for any
  other; the twelve pre-Tennis doors are untouched.

## What was changed to implement it

| File | Change |
|---|---|
| `site.json` | Apex Golf door removed — a clean 13-line deletion, doors **14 → 13** |
| `tools/apply_apextennis_home.js` | stops re-adding the Golf door; a comment records why, so a re-run cannot silently undo the ruling |
| `tools/verify_apextennis_home.py` | now asserts the **ruled** state: 13 doors, Golf takes **no** door, Games zone 7 |

**A ruling that only edits data reverts the next time the transform runs.**
Both the transform and its verifier were moved with it, which is why the door
stays gone.

## Measured after the change

```text
                 360      768     1200
data-doors        13       13       13
data-doors-art    13       13       13
rendered doors    13       13       13
empty cells        0        0        0
Apex Golf door     0        0        0     <- removed
Apex Tennis door   1        1        1     <- retained
Apex Kick door     1        1        1     <- retained
Off-Brand          1        1        1     <- retained
horizontal overflow  none  none    none

homepage Sports (JS ON  and JS OFF):
  /apexkick/  /apexpool/  /apexgolf/  /apextennis/     <- ratified, four games
New Release with JS off: present, Apex Pool             <- C6 still holds
```

`tools/verify_apextennis_home.py` → **ALL 33 APEX TENNIS HOMEPAGE STATIC GATES
PASSED** against the ruled state.

## Two orphans left in place, NOT deleted — for Matt

Removing the door left two things behind. Deleting content is a RED action and
neither was covered by the ruling, so both are reported rather than actioned:

1. **`assets/cards/apex-golf-door.svg`** — 1,268 B, now referenced by nothing
   in the live site. The Sports card uses `/assets/cards/apex-golf.svg`, which
   is a different asset and is still in use.
2. **`site.json` → `features.downloads.catalog`** still carries
   `{"key":"apex-golf","title":"Apex Golf"}`, but **no door now carries
   `countKey: "apex-golf"`**, so nothing increments it. The catalogue is still
   14 entries against 13 doors.

**Recommendation:** keep the catalogue entry only if Apex Golf should still
carry a play count from its Sports card — which would need the Sports card
wired to the counter, and it currently is not. Otherwise drop both the
catalogue entry and the orphaned SVG in a single follow-up. **Not decided here.**

apexgolf-build-2026-08-04
