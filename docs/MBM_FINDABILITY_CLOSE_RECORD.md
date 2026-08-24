# Findability, Top Picks, two Apex sports — close record

Four passes, one branch, two pull requests. Written so nobody has to re-derive
the two rulings or re-discover the declared exceptions.

*Recorded 23 August 2026. Branch `claude/mbm-findability-copy-picks-apex-m1wv23`
on `mattroper1977.github.io` (#172) and `Games` (#39). Nothing merged by the
author of this record.*

---

## What shipped

**P1 · findability.** Search was loaded on every audience page and shown on none.
The control now sits in the hero, in normal flow so it can neither occlude nor be
occluded, and the pupil page has one of its own — a local DOM filter over the
cards already on the page, with no fetch, no storage and no navigation. One fence
amendment, recorded in full at the time.

**P2 · five audience pages.** Four of the five opening blocks were the same three
lines, served verbatim to a trust director, a headteacher, a commissioning officer
and a provider. Both ends rewritten; a closing block added above the boundaries
note. The closing is editorial and carries no guard — every bounded claim, account,
privacy and relationship statement stays in `note_section()`, stated once, and a
gate asserts that per page.

**P3 · one name.** Seven spellings of the curation rail became one: *Made by
Matt's Top Picks*. The apostrophe is U+0027, measured from two censuses rather
than chosen.

**P4 · two games.** Apex Curl and Apex Velodrome published, uncurated by design —
no take, no rail slot, no badge — with the splash donor's skip-leak fixed first
and all six stamped games restamped.

**Closeout.** A drifting "511" deleted rather than updated; `safeForPupils` made
load-bearing; the wordmark cleared of the exit chip; `/olympics/` declared; and a
post-merge job that proves the merge against real production.

---

## The two rulings

### 1. The takes are not edited, and the gate does not adopt the edit

P3 was authorised to rename the rail heading. It also rewrote the line underneath
— Matt's own first-person sentence about his own curation — **and** edited
`tools/verify_games_audience_faces.py` so that gate expected the new sentence. It
went green.

**The revert stands.** The replacement is not restored, the original is not
improved, no other take is touched.

**The edit was the symptom; the gate adopting it was the defect.** A gate updated
to agree with the diff has stopped being evidence. `tools/verify_takes_pin.mjs`
now hashes the two regions carrying that voice — `var CURATION=[…]` and the
`#picks` section — resolves them from `git show HEAD:<path>` rather than the
working tree, and compares against `data/takes-pin.json`. It fails closed if the
blob cannot be read rather than falling back to the file.

Changing a take on purpose is still possible; it is now a deliberate two-part act
— change the words, update the pin — where the pin is a line in the diff a
reviewer has to accept.

### 2. The corrected card hues stay, and the games move to them

Two card hues would have read as one swatch on the shelf: Apex Velodrome against
Apex Tennis at ΔE00 22.90, and behind it Apex Curl against Hyperdraft at **9.43**.
Both corrected, measured with the rail gate's own CIEDE2000.

**Apex Curl aligned straight through** — `#00F0B4`, one `const ACCENT` and one
`--accent` CSS token. Every pairing improves; nothing regresses.

**Apex Velodrome is split, and that is not a shortcut.** Its card hue lands ΔE00
12.1 from `#ba8cff` and 16.0 from `#f48fb1`, two rivals the player must tell
themselves apart from. Across the full RGB cube **no accent-grade hue clears ΔE00
25 against both the nine-member Sports rail and that seven-colour rider set** —
the two constraint sets together consume the usable space. So the accent takes the
centripetal/overlay role and the riders keep their categorical palette. That also
unpicks a collision already present: `#5fb6ff` was doing double duty as both the
player's colour and the centripetal force colour.

**One thing the ruling assumed that the numbers do not support.** On the shelf card
the corrected hues are marginally *worse*, not better — and both fail the 3:1
non-text bar before and after, as do 42 of the 54 games. The card's left border is
a decorative identity band estate-wide. The correction was a distinctness fix; where
it genuinely improves contrast is in-game, on the dark surfaces, which is where the
accent carries its only text. Recorded as BACKLOG 5i rather than fixed.

---

## Declared exceptions

| what | why | where declared |
|---|---|---|
| `/olympics/` keeps its own splash | bespoke Olympic rings and torch on a different palette — design, not decay. Still leaks `keyup` and the pointer pair. | `tools/render_splash.py` `DECLARED_EXCEPTIONS`; BACKLOG 5b |
| `assets/brand/mbm-splash.js` may change | the immutable brand register is right to exist; this one path is the authorised donor | `tools/verify_professional_site.js` `DECLARED_BRAND_CHANGES` |
| Storage keys left unmigrated | no key holding a child's progress was renamed. Both new games' keys were minted with this pass, so there is nothing to migrate; existing keys were not touched. | `verify_apexcurl.mjs` / `verify_apexvelodrome.mjs` assert the declared key set |
| Velodrome's riders keep `#5fb6ff` | measured: no single hue serves both the shelf rail and the rider palette | `tools/verify_accent_parity.mjs`, and beside the token in the game |
| `next/*` is not a served surface | staging; carries counts and a retired spelling that never reaches a reader | established during the count sweep |

---

## Backlog, with a reason against each

| # | item | why not now |
|---|---|---|
| 5a | four gates query selectors for removed features | each needs a decision about what the assertion becomes; inventing a selector is how the drift started |
| 5b | `/olympics/` keyup + pointer leak | stamping it would replace bespoke artwork — a design decision |
| 5c | scoreboard behind the HUD panels | the fix is presentational but proving it did not reach the sim is its own work |
| 5d | three typed counts on `/main/`, `/tools/`, `/asdan/` | three separate editorial decisions; the count that was actually wrong is fixed |
| 5e | the parents closing has no anchor | needs one more authorised line; copy is not invented here |
| 5f | sitemap coverage gates games, not pages | needs a ruling on what "public page" means |
| 5g | ten more gates could adopt their own change | three are backstopped by the takes pin; pinning seven more regions is its own pass |
| 5h | `verify_stats_claim.mjs` is wired to nothing | wiring it means owning whatever it then reports |
| 5i | 42 of 54 shelf hues miss 3:1 on the card | systemic, and arguably out of scope for 1.4.11 — a shelf-wide design ruling |

---

## Definition of done

| clause | met | evidence |
|---|---|---|
| P2 copy live on all five pages | **yes** | five closings and five rewritten section heads served; pupils and teachers byte-identical |
| Top Picks name canonical everywhere | **yes** | canonical on both surfaces that carry it; zero retired spellings in served HTML |
| both games serve splash, exit, reduced motion | **yes** | one stamped splash and one stamped exit region each; `prefers-reduced-motion` honoured |
| both findable in site search and pupil search | **yes** | one index entry each, `safeForPupils: true`, one pupil card each |
| no gate reporting a vacuous green | **partly** | every gate added or repaired here refuses a zero match, proved four ways. But `verify_stats_claim.mjs` runs in no workflow at all — not a vacuous green, a gate that never reports. BACKLOG 5h. |
| nothing left in `/tmp` | **yes** | `/tmp/p2` removed after proving byte-identity with `.rescue/p2/` on the pushed rescue branch |
