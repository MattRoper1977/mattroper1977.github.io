# Stage U-P1 — Ouroboros: Chronos Unbound, audited and repaired
**7 August 2026, resume order sitting 2.** Figures derived on this file.

---

## §Gate

**Attachment, third time of asking, verified byte-exact:**

```
e412d8d555793c36010d8557371963c386aae4b376e3e18690847704754b0add   189,516 B
```

Stage U is unblocked. (Sitting 2's first pass parked it again because the file
did not arrive; that park was correct and is now closed.)

---

## §Method — a 62-agent audit, adversarially verified

Seven dimensions audited in parallel, every finding then put to a
refute-by-default skeptic that had to read the file itself:

| | |
|---|---|
| agents | **62** · 795 tool calls |
| findings claimed | 55 |
| **confirmed** | **47** |
| refuted | 8 — **but see the contamination note below** |

Two "findings" are confirmations of **correctness**, and they are worth as much
as the defects:

- **`grantAll()` is genuinely console-only.** One live code occurrence, inside
  the debug object; zero `on*=` attributes in the markup; ~40 `.onclick=`
  assignments and none references it; `bindUI` does not reach it.
- **There is NO temporal-dead-zone trap in this file.** An agent parsed the
  whole script with espree and enumerated every top-level statement: `init()`
  is the last statement with nothing declared below it, and all seven
  `try/catch` blocks wrap storage feature-detection and save/load fallbacks,
  not init calls. This estate has been bitten by the TDZ three times. It is
  worth recording when a file is clean.

### The contamination, which is mine

**I edited the file while the audit was measuring it.** The auditors read one
revision; the verifiers, running later, read the revision my U-1/U-2 fixes had
already produced. Several refutations say so in as many words — *"describes a
prior revision"*, *"claimant measured a ~64-line-older copy"*, *"the file does
the opposite, deliberately and with a comment naming this exact trap"*.

So **the refuted set is unreliable and must not be read as "8 false claims."**
At least four of the eight were refuted because the defect had been fixed
underneath them, or because my edits had shifted every line number. The
verifiers were right about what they read; what they read was not what the
auditor read.

The confirmed set is unaffected — those were checked against the file as it
then stood and held. But the correct conclusion is that a subject must be
frozen while it is being measured.

**Register entry:** *never mutate the subject while an audit is running. The
auditor's line numbers and the verifier's reads have to refer to the same
bytes, or the disagreement between them measures the edit rather than the
code.*

---

## §U-1 — the sticky flash. Confirmed, root-caused, and measured red.

The brief was **right**, and the five call sites it named are the five that
exist:

| line | call | moment |
|---|---|---|
| 1052 | `screenFlash("#dceaff",.45)` | cinematic scene advance |
| 1251 | `screenFlash("#ffd7a2",.7)` | sub-node severed |
| 1266 | `screenFlash("#e5f7ff",.85)` | Matrix Collapse |
| 1386 | `screenFlash("#ffffff",1)` | Ouroboros Paradox Collapse |
| 1404 | `screenFlash("#e9ffff",.75)` | resonance technique |

**Mechanism.** `screenFlash` wrote the strength as an **inline** opacity, and
`animation:flash .24s ease-out` carried **no fill-mode**. CSS animations
outrank inline styles while they run, so the element animated 1 → 0 over
0.24 s — and the instant the animation ended the cascade fell back to the
winning declaration, which was the inline `opacity: strength`. `style.opacity`
appears exactly once in the whole file, so nothing ever cleared it. No
`animationend` handler, no timeout.

**Measured, not argued.** Against the pre-fix file the gate reads computed
opacity **1.000 at +1.5 s**, and the same **1.000 under reduced motion**. An
agent screenshotted the result: after the Paradox Collapse the entire viewport
is a solid white rectangle. `pointer-events:none` means input still works — the
player is left clicking blind through an opaque wash.

**Why reduced motion made it worse.** `body.reduced-motion *` collapsed every
animation to `.001ms`, so the stuck flash arrived *instantly*. The players the
setting exists to protect got the worst outcome in the game.

One correction to the brief, from the audit: *"instantly permanent at full
strength"* is not quite right — it is permanent at **the call site's**
strength. Four of five sites pass < 1. Only the Paradox Collapse is a true
whiteout.

**A defect the brief did not name.** The keyframe hard-coded `0%{opacity:1}`,
so `strength` never affected the visible flash at all: all five sites flashed
identically at full opacity, and the parameter's only observable effect was how
dark the permanent residue was. The fix restores the parameter's intended
meaning, which also *lowers* peak flash intensity at four of the five sites.

**Fix — both halves, because either alone still leaves a way to stick.**
Strength now rides a `--flash-a` custom property, so there is no persistent
inline opacity to fall back to; and the animation carries `forwards`, pinning
the end state at the 100 % keyframe. `screenFlash` is additionally RM-gated
outright, as `shake()` already was.

---

## §U-2 — reduced motion. Confirmed, and the blanket was the amplifier.

`matchMedia` was sampled once inside `defaultSave()` and persisted. Because
`applySettings()` spreads the saved settings **after** the defaults, a save
carrying `reducedMotion:false` overrode the OS permanently — a player who
turned the setting on later was never heard again. No listener anywhere.

**Note for the record:** my own first grep for `prefers-reduced-motion` found
only the JS line and I very nearly concluded the CSS blanket did not exist. It
does — as a **class** selector, `body.reduced-motion *`, not a media query. The
null-grep rule earned its keep here.

**Fix.** The OS is a floor re-applied on every `applySettings()`, with a live
listener attached immediately after the function it calls. Turning the OS
setting back off restores the player's own stored preference rather than
forcing full motion on them. The wildcard is replaced by **named families with
two treatments**, because "reduce motion" does not mean one thing:

- entrance and impact animations carry fill-mode `both` and their **end state
  is load-bearing** — their *duration* is collapsed, keeping the end state.
  `animation:none` would throw it away and leave panels unstyled.
- continuous and attention-seeking animations (the infinite gear spins, the
  pulsing border, the blinking dialogue cue) are **stopped outright**. The
  blinking cue is in this group for photosensitivity, not merely for motion.

---

## §The rest of U-P1

| finding | what it was | fix |
|---|---|---|
| **LOOP-01** (blocker) | `requestAnimationFrame` was the last statement after unguarded `update()`/`render()`. One throw and the game froze for good behind a console error. | `try`/**`finally`** — not `catch`. The error still propagates and is still visible; it just no longer takes the loop with it. |
| **A11Y-01** (blocker) | `announce()` was a bare assignment to one live region: a burst left a screen-reader user hearing only the last message. | A draining queue that clears before each write, so two identical strings are still two announcements. Markup stripped. |
| **A11Y-04** | The battle log is the primary combat channel, announced at 2 of 19 write sites. | Announced at the single point it reaches the DOM — covers all 19, cannot drift. |
| **SAVE-11** | No `visibilitychange`/`pagehide`; an evicted mobile tab lost everything since the last explicit save. | Both handlers write. |
| **SAVE-02/03** (blockers) | A top-level array/number/string/boolean was spread straight into the save; nested records shallow-merged so one malformed character replaced a default wholesale. | A save that is not a plain object is refused; records merge against their own defaults. Five new hostile probes. |
| **OURO-HEAD-03** | Pinch zoom blocked page-wide by `touch-action:none` on `html,body`. | `manipulation` on the page, `none` kept on the play surfaces where it was actually needed. |

**OURO-HEAD-03 is a finding my own check missed.** I checked the viewport meta,
found it clean, and moved on. The meta *was* clean; the CSS blocked zoom
anyway. **A clean meta tag is not evidence that zoom works** — the limb now
measures the computed value on the live page.

Head furniture added per the house pattern: canonical, og block, `noscript`
fallback. **No `og:image` is claimed** and `twitter:card` is `summary`, not
`summary_large_image` — the banner is U-P4 and the real-asset rule says a tag
joins when its file does.

Debug surface **extended, not duplicated**: `OuroborosDebug` keeps its existing
hooks and `window.__ouroboros` is an alias to the same object, not a second
surface to keep in step.

---

## §Gate

`tools/verify_ouroboros.mjs` — **60/60 limbs**, run via `tools/run_ouroboros.sh`.
**201,445 B** against the 300 KB budget.

The negative control runs the *identical instrument* against the pre-fix file
and requires it to go red. It is deliberately **harness-free** — it fires
through the global `screenFlash` and reads the DOM directly — because a control
that had to go through this stage's own harness additions could never run
against the file those additions do not exist in, and then it would not be a
control.

### Three instrument bugs, all mine, all caught by running it

1. **The `grantAll` limb counted the comment this stage wrote** explaining that
   grantAll is console-only. An instrument reading its own documentation and
   calling it a defect. Now counts code with prose stripped.
2. **`const Game` is a global *lexical* binding, not a property of `window`.**
   `window.Game` was undefined and the loop limb crashed instead of measuring.
3. **The R7 limb asserted byte-equality**, which became the wrong assertion the
   moment `pagehide` started writing on the way out. It read a working fix as
   "save drifted on reload" and would have had me tear that fix out. Measured:
   exactly one field moved, `playTime 0 → 0.4166`, key count identical at 18
   either side. R7 is that nothing is **lost or corrupted**, not that no counter
   may advance — so the limb now requires identical key sets, every non-clock
   field identical, and monotonic clocks non-decreasing. That last clause
   catches a save which **resets** the clock, which byte-equality would have
   passed whenever the numbers happened to line up.

---

## §U-P3 hue — derived early, and the order's candidates both fail

Scored with the estate's own colour maths (`fracture/tools/pick_hue.py`),
against all 46 shelf hues:

| candidate | ΔE00 to nearest shelf neighbour | |
|---|---|---|
| `--brass #d4af37` — the order's first candidate | **2.11** vs Charcoal `#D9B44A` | **FAIL** |
| `--cyan #00f0ff` — the order's stated fallback | **3.94** vs Echo Vault `#6ff7ff` | **FAIL** |
| `--crimson #e63946` | 13.32 vs Apex Rally `#FF737C` | pass |
| `--red #ff2a4b` | 11.17 vs Apex Rally | pass |

**Both of the order's named options collide.** Brass is essentially Charcoal;
the cyan family is essentially Echo Vault. A search over deliberate variations
of the game's own palette (882 candidates) found **320** clearing ΔE00 ≥ 10
*and* ≥ 4.5:1 contrast on the card panel, of which 194 are brass-family — but
the highest-scoring brass survivors have drifted to olive and no longer read as
brass. The genuinely brass-reading survivors sit around `#9f772f` (ΔE00 19.06,
contrast 4.63) — a deep antique bronze, which suits a game named after an
ancient serpent.

**Not chosen here.** U-P3 derives at the moment of edit, against the shelf as it
then stands. This is recorded so the next sitting starts from a measurement
rather than from the order's two dead candidates.

---

## §Parks — derived conditions

**U-P2, six bands — not started.** B1 cel-shade → B2 raycast lighting → B3
voice blips + cinematic polish → B4 districts + ≥1 side dungeon → B5 all four
Triple-Techs → B6 superboss campaign. Cut from the bottom if budget forces it;
never ship a half-band. ≤ 300 KB (201,445 B used, ~105 KB of headroom), R7
after every band.

**U-P3 publish `/ouroboros/` — not started.** Hue derivation above. Numbers are
derived at the moment of edit, never restated: as of this close the shelf is
**46** and the sole `NEW ·` holder is `/olympics/`.

**U-P4 media — not started.** The head deliberately carries no `og:image`;
that tag and `twitter:card` change in the banner's commit.

**V-P2 B2/B3, V-P3, V-P4 — not started.** V-P2 B1 landed earlier this sitting.

**O-fin, T, H — not started.** O-fin unblocked. PR #25 baseline 1 file / 1 hunk.

**Remaining confirmed-but-unfixed findings**, carried forward with their ids:
SAVE-01 (a corrupt save is destroyed rather than quarantined), SAVE-04
(version written but never read — no migration), SAVE-05/07/08/09/10,
**SAVE-06 (save-controlled strings reach `innerHTML` unescaped at seven
sites)**, A11Y-02 (no focus management or trap on modals), A11Y-03, A11Y-05,
A11Y-06, A11Y-07, A11Y-08, A11Y-09, A11Y-10, A11Y-12, OD-1 to OD-6, OD-9,
LOOP-02, LOOP-03 (Forge `setInterval` leaks when Escape closes the modal),
LOOP-04, LOOP-05. **SAVE-06 and A11Y-02 are the two worth taking first.**

No clean-estate declaration is made.
