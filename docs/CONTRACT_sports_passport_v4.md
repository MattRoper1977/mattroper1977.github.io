# Contract — `mbm_sports_passport_v4`

Written under Order V6-PG §3.1.

`mbm_sports_passport_v4` is a **shared, cross-game** localStorage key. It carries
a child's name, class, house, XP, house points, badges, award receipts, per-game
summaries and Olympiad results across every sports title on the estate. Four
games write it today — `apexkick`, `auroralinks`, `houseolympiad`, `olympics` —
and every candidate in the V6 package references it.

Until now there was no written rule any candidate could be tested against. An
early hand-shaped fixture incorrectly reported three resets; the runtime-marked
inverse control struck that conclusion. The missing contract was real even
though that product verdict was not. This document is the corrected rule and
`tools/verify_sports_passport_contract.mjs` is the gate that tests against it.

Every clause cites a reference implementation by `file:line`. Every quoted
string in this document was regenerated with `grep -n -F`.

---

## The record

A CRDT. Each field is a last-writer-wins register or an OR-set carrying a
`{clock, node}` pair, and `counters` are per-node grow-only counters — an array
of `[nodeId, value]` pairs. **The node id is the identity that makes all of that
work.** Two installs sharing one node id cannot have their contributions
distinguished or merged.

The normaliser is `normalizePassport(raw, preferredNode)`, embedded identically
in every build inside `<!-- MBM-V4-RUNTIME:BEGIN -->` — `apexkick/index.html:886`.
It throws on exactly four conditions:

- `raw` is not a plain object
- `raw.kind !== 'MadeByMatt.SportsPassport.V4'`
- `Number(raw.schemaVersion) !== 4`
- the record exceeds `PASSPORT_BYTES_MAX` (500,000 bytes), before or after normalising

Everything else it repairs rather than rejects.

---

## C1 — No lossy boot write

A write to `mbm_sports_passport_v4` during boot is lawful **if and only if** it is a merge of the record read in the same boot.
Compliance is decided by comparing the record's **value** before and after boot — **not** by the presence or absence of a `setItem` call.
A build is RED under C1 if, after boot, any key present in the pre-boot record is absent; or any scalar present before is reset to a default, zero, or empty value; or any collection present before has lost members.
A build that performs no boot write is GREEN by vacuity.
**Reference implementation: `apexkick`, which writes on boot and merges first (see `:3572`–`:3573`).**

---

## C2 — Backup before default

When the stored record cannot be parsed, the raw string **as read** MUST be written to a corrupt-backup key **before any default record becomes reachable** — in the same code path, before any `return`, `throw`, or assignment of defaults.
Compliance is decided by the **presence of the backup key after a corrupt-record boot**, not by the shape of the `try`/`catch`.
A build that never parses the key is GREEN by vacuity.
**Reference implementation: Apex Curl.**

Apex Curl writes the raw string to `mbm_sports_passport_v4_corrupt_backup`, expressed in source as `PASSPORT_KEY+'_corrupt_backup'` (`apexcurl/index.html:1663`).

---

## C3 — Unknown game ids are preserved and ignored, never thrown on

`GAME_IDS` is a frozen 11-item list. It may gate **writes**. It must not gate
**reads**.

```
apexkick/index.html:1268
    if (GAME_IDS.indexOf(game) < 0) throw new Error('Award game id is invalid.');
```

As shipped, that check sits inside `grantAward`, which is a write path, and is
correct there. The landmine is the frozen list itself: **an eighth game writing
its own summary would make every earlier build fail to read the record** the day
its id is not in their copy of the list. Every build embeds its own frozen copy
of `GAME_IDS`; none of them can be taught a new id without a re-release of all
of them.

**This clause is a proposal, not a graft (V6-PG §6.3).** No sibling on the
estate implements ignore-unknown-ids, so there is nothing to copy. It is a
schema change and is written here to be ruled on, not landed.

The gate measures the current behaviour and reports it. It does not fail a build
for the absent feature.

---

## C4 — `seasonId`

**A correction to the order.** V6-PG §3 states that *"An invalid seasonId
currently reaches normalizePassport's throw, which is how the withdrawn probe in
§2 misfired."* The code refutes this. `normalizePassport` does not read
`raw.seasonId` at all; it overwrites it unconditionally:

```
apexkick/index.html:904          (inside normalizePassport, which begins at 886)
      seasonId: PASSPORT_SEASON,
```

So an unrecognised `seasonId` is silently normalised to `'v4-season-one'` and
never throws. The withdrawn probe in §2 misfired for the other reasons recorded
in the queue's STRUCK-1 marker — a synthetic, under-populated record — not
because of its `seasonId`.

**The rule, therefore, describing what the code does:** `seasonId` is not input.
It is stamped by the normaliser from `PASSPORT_SEASON`, a build-time constant.
A reader never branches on it, and a writer never chooses it. A build that
*reads* `seasonId` to make a decision is out of contract, because the value it
reads is whatever its own normaliser last stamped.

If seasons are ever to mean anything across builds — a season roll that older
builds must recognise — that is a schema change and a separate proposal.

---

## C5 — Per-install node identity

The node id MUST be generated once per install and persisted. The literal `mbm-default00000000` is banned anywhere in shipped source. A shared node identity defeats the per-node clocks the passport counters are built on, and is only observable on a fresh-install arm — so the fresh-install arm is mandatory in the verifier (§3).

---

## C6 — Lamport monotonicity across a boot

Seed → boot → re-read must satisfy `lamport_after >= lamport_before`.

`normalizePassport` computes `output.lamport = Math.max.apply(Math, clocks)`
(`apexkick/index.html:928`) over every register and pair clock in the record, so a normalise can only raise
it. A boot that lowers it has discarded clocks — which is the same event C1
describes, seen from the other side, and is why both are measured.

---

## What the gate may and may not conclude

- A **green** on this contract is not a statement that a build is correct. It is
  a statement that the build did not damage a passport written by a deployed
  writer, under the arms in `tools/verify_sports_passport_contract.mjs`.
- A **passport arm may only be seeded from a record written by a deployed
  writer.** A synthetic seed cannot distinguish a clobber from a rejection,
  which is the entire question. This rule was established by striking a
  withdrawn reading that had done exactly that; see the STRUCK-1 marker in
  `reports/2026-08-30-deferred-verification-queue.md` in the Lessons repository.
- No arm may report a result from a run that did not complete. Every arm carries
  a deferred-write control and aborts MEASUREMENT INVALID rather than reporting.
