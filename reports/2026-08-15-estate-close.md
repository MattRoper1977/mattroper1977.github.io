# Estate close — 2026-08-15

Docs only. No code, no gates, no assertion in this commit.

The close ran as F1–F6 and then a final pass, L1–L4. What follows is what
merged, what turned out to be false, one trap worth keeping, and what is still
open with a name against it.

---

## Merged today

Merge SHAs are the squash commit on `main` in each repository. Every number
below resolved; none is a guess.

### mattroper1977.github.io

| PR | merge SHA | what it did |
|---|---|---|
| #141 | `8f8c86cf` | the real tab walk replacing the `.focus()` proxy, plus the walk's own false negative. **A dated correction was appended to its body today** — see below |
| #155 | `bc67b82a` | the pupil homepage shows all 52 by genre; #149 closed by making the way out reachable |
| #156 | `9c3f6b67` | Olympics live leg reads either browse structure |
| #157 | `1ebe78cb` | the Olympics self-test caught a control that had stopped controlling |
| #158 | `504af1c0` | `verify_pack_index` reports INCONCLUSIVE instead of dying in node internals |
| #159 | `b8a65706` | Emberwild: the lodge door faced off the edge of the world |
| #161 | `f1965cf8` | the genre record bounded to exactly two participants |

**#145 is an issue, not a PR** — the Emberwild lodge-interior report. It was
closed by #159. It has no merge SHA of its own and is recorded here as an issue
so nobody looks for one.

### Lessons

| PR | merge SHA | what it did |
|---|---|---|
| #111 | `56f3c619` | Lessons rejoins the canonical platform and stops running the fail-open copy |
| #113 | `9b2402c9` | the cross-estate gate can no longer pass without comparing estates |

### Matt-s-Apps-

| PR | merge SHA | what it did |
|---|---|---|
| #12 | `8076190c` | the Creator Hub's platform layer brought to the canonical site copy |
| #13 | `247ea38f` | the cross-estate gate can no longer pass without comparing estates |

**The five F1 PRs** are Apps #12, Lessons #111, Apps #13, site #158 and Lessons
#113 — they appear once each in the tables above rather than being listed twice.

---

## Premises that died

A ledger that records only fixes teaches nobody. Both of these were mine, and
both were stated confidently before they were measured.

### "Six never-run workflow files, four Lessons and two Games"

**Actually zero.** Every workflow file on `main` in both repositories has runs:

| repository | files on main | zero-run |
|---|---|---|
| Lessons | 10 | **0** |
| Games | 6 | **0** |

The nearest real thing is **four dispatch-only** files — three Lessons, one
Games, not four and two — and "never-run" is wrong for all four: they have 3, 1,
1 and 22 runs.

All four are deliberate, and each says so in its own header:

- `glv3-production-byte-check.yml`, `j4-absolute-ref-probe.yml` and
  `wave-ohm-deck-live.yml` are read-only **production probes**, manual because
  this container's egress proxy answers 403 on CONNECT to the live origin.
  `j4-absolute-ref-probe.yml` carries the instruction *"Never merge a PR opened
  solely to trigger it."*
- `apexpool-sports-verify.yml` is **retired by name** — *"Apex Sports manifest
  contract (RETIRED — dispatch only)"*. It asserted "baseline plus exactly one
  Apex Tennis entry", which stopped being satisfiable the moment that entry
  landed; it failed 17 of 22 runs before retirement on 5 Aug. Its four generally
  useful limbs migrated into `validate_games_json.sh`. It is kept as a record.

So the standing rule not to enable or delete any of them is well founded on the
evidence, not merely on caution.

A second correction sits inside this one. The first sweep reported twelve
dead-branch triggers across Lessons. That was a **pagination bug** — Lessons has
142 branches, one page of 100 was fetched, and `main` sorts after `codex/…` so
it fell off the end and every `[main]` trigger read as dead. The corrected sweep
pages fully and asserts `main` is present before classifying. Dead-branch
triggers: **0**.

### "Site red count 0"

**Actually 2 at the start of the close.** The estate carried two reds, and they
were one story: Apps and Lessons had both drifted from the canonical
`mbm-platform.css/js` while every gate stayed green.

That drift was not cosmetic. `6bdeafa` on 14 Aug inverted
`adultFeaturesAllowed()` to fail closed, and Lessons was still running the
fail-**open** copy on the 15th. `index.html` is the only page there that loads
the script and it declares no marker, so it rendered the affordances anyway:

| viewport | before #111 | after |
|---|---|---|
| 1440×900 | acct=1 mail=2 register=1, `mbm-account.js` ×2 | 0 / 0 / 0 / 0 |
| 390×844 | mail=1, `mbm-account.js` ×2 | 0 / 0 / 0 / 0 |

Nothing else moved: details 12/14, cards 504, aria-live 2, pageerrors 0, 404s 0.

The mechanism that hid it is now fixed in both repositories. Run bare, the
cross-estate gate used to print `[PASS] … cross-estate static contract` and exit
**0** having made no cross-estate comparison at all; `--canonical` was optional
and the whole comparison sat behind `if canonical:`. Three versions of the same
two files coexisted with every pin green — Lessons `ccfb0fd9`/`0841046b`, Apps
`e3eb9b83`/`0958a73a`, site `b520cf36`/`095a29e6`.

---

## The trap worth keeping

**Editing a GitHub issue or PR body through the MCP view returns
display-escaped markdown. Writing it back mangles every apostrophe.**

#141's body came back through the MCP tool with `&#39;` in place of every `'`.
Sending that back as the new body would have replaced real apostrophes with
literal HTML entities throughout a 3,545-byte record, in a body that is itself a
correction about accuracy.

The fix, and the rule: **fetch the raw markdown first, append, and verify the
original survives as an exact byte prefix.**

```
raw body:   3,545 B, real apostrophes, no &#39;
after PATCH: original still an exact prefix — verified, not assumed
```

Verified with `body.startswith(original)` against the API's own response, not
inferred from the fact that the request returned 200.

---

## Open at close, and who owns each

| what | owner | why it is open |
|---|---|---|
| **#112** — is `/Lessons/` a declared adult surface? | **Matt** | The hub now fails closed and declares no marker, so it carries none of the four affordances. Whether it *should* is a copy and audience call. `data/adult-surfaces.json` cannot govern it — that record is scoped to the site repository's own tree — so declaring it needs a home and a gate as well as a decision |
| **#160** — wire `featured` up, or retire it | **Matt** | Proven read **0 times** by any shelf-fetching page, AST so the record's own comment does not count. Not empty though: 10 of 52 entries are `true`, and they disagree with the Top Picks rail on **8 of 10**. A second, stale opinion about promotion — the three-source shape again, dormant rather than active |
| **#143** — `/olympics/` 5.47–5.98 Hz on tile 41 | parked, **instrumental** | No hazard asserted; the amplitude prong fails as in the Depths. The corrected capture path tops out near **1.9 Hz** quotable, so under the quarter-of-achieved-fps guard it cannot characterise a ~5.5 Hz signal at all. Reopen above **~24 Hz achieved**, or with an amplitude instrument rather than a rate one |
| **the PAT** | **Matt** | credentials |
| **the Games push access** | **Matt** | credentials |

`#144` is not on this list because it is a live report rather than a decision:
the stated cause was disproven today (`preserveDrawingBuffer:true` has been in
the shipped file since `a8af89b` on 11 Aug), the real cause found — the census
clicks screen centre and misses the game's `#playBtn`, so it sampled an
unrendered 300×150 default buffer — and the surface still cannot be cleared here
for the same 1.9 Hz reason that parks #143.

---

## Erratum on today's own output

The dated correction appended to #141 cites the rendered leg of
`verify_inline_exit.mjs` as `:296`. It is **`:297`** in that tree, and `:326`
after today's comment edit. The three browser contexts were cited correctly.

The correction stands as appended rather than being rewritten, which is why the
erratum lives here. The note in the tool itself now cites the header by **text**
as well as by number and states its claim as *"no context in this file omits
`hasTouch`"*, so future drift makes the numbers stale without making the note
wrong.

---

## The pattern this close kept finding

Three times this week, a correct assertion sat over prose that implied something
false, with nothing going red because prose is not asserted:

1. **#141's F1 table** kept a stale press count of 8 beside a correct 12 in the
   same body — the body contradicted itself for a day. Resolved: the count is
   touch-capability dependent and not viewport dependent. 8 with
   `hasTouch:false` at either viewport, 12 with `hasTouch:true` at either
   viewport, and the rendered leg pins `hasTouch:true` for every context it
   opens, so **12 is what the repository asserts**.
2. **The `/neonmeridian/` flash census** recorded 59.5 fps in a column read as
   sample quality. It was the sampler idling at 60 Hz over a canvas that never
   rendered — the highest number in a six-surface table belonged to the only
   surface measuring nothing.
3. **`verify_inline_exit.mjs`'s own note**, fixed today in L1.

Prose ages while the assertion beside it stays green. Worth watching for.
