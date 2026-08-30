# Contract — `mbm_sports_passport_v4`

Written under Order V6-PG §3.1.

`mbm_sports_passport_v4` is a **shared, cross-game** localStorage key. It carries
a child's name, class, house, XP, house points, badges, award receipts, per-game
summaries and Olympiad results across every sports title on the estate. Four
games write it today — `apexkick`, `auroralinks`, `houseolympiad`, `olympics` —
and every candidate in the V6 package references it.

Until now there was no written rule any candidate could be tested against.
Three of seven V6 candidates were observed resetting it. That is not three bugs;
it is one absent contract. This document is the rule. `tools/verify_sports_passport_contract.mjs`
is the gate that tests against it.

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

## C1 — No unconditional replacing write on boot

**As ruled (V6-PG §3.1 C1):** a build may write the passport only on a real
state change, or as a repair satisfying C2. A write reachable from load with no
state change is a release blocker.

**STOP — the deployed reference refutes this clause as worded, and it is not
mine to rewrite.** `apexkick` writes the passport on every boot:

```
apexkick/index.html:3572
function loadPassport(){Passport=readLatestPassport();savePassport()}
```

That write is not destructive, because `savePassport` merges the stored record
before writing rather than replacing it:

```
apexkick/index.html:3573
Passport=latest?mergePassportForWrite(latest,Passport):ensurePassport(Passport);
localStorage.setItem(PASSPORT_KEY,JSON.stringify(Passport))
```

Compare the candidate that resets:

```
Apex_Velodrome_AAA_V6.html:1693
try{writeJson(PASSPORT_KEY,passport);}catch(_){}
```

reached unconditionally from `loadPassport()` at line 1690, which is itself
called at module scope on line 1696. `passport` there is
`R.normalizePassport(raw, state.nodeId)` or `R.defaultPassport(state.nodeId)` —
never a merge of what was stored.

So the property that separates a safe boot write from a destructive one is not
*whether* it writes, but **whether it merges**. C1 as ruled would red a deployed
game that is behaving correctly.

**Proposed C1′, for Matt to rule — not applied:** *a write to the passport
reachable from load must merge the stored record; a write that replaces it is a
release blocker.* The gate measures **both** C1 and C1′ and reports them in
separate columns, so the choice is made on evidence rather than on my
substitution.

Reference implementation for C1′: `apexkick/index.html:3573`.

---

## C2 — Back up before defaulting

Any path that discards a stored record and installs a default or migrated one
must first preserve the raw string it discarded, under
`PASSPORT_KEY + '_corrupt_backup'`.

Reference implementation, the shortest and clearest on the estate:

```
Apex_Curl_AAA_V6.html:1663    (loadPassport begins at 1659)
catch(error){safeSet(PASSPORT_KEY+'_corrupt_backup',raw);return Runtime.defaultPassport();}
```

Deployed equivalents: `auroralinks/index.html:1119`, `houseolympiad/index.html:1099`,
`apexkick/index.html:3573`.

**Known live violation.** `olympics` discards a corrupt record without keeping it:

```
olympics/index.html:1493
function loadSportsPassportDTO(){let raw=null;try{raw=safeJSON(localStorage.getItem(PASSPORT_KEY),null)}catch{}if(raw)try{return passportNormalize(raw)}catch{}let legacy=null;…const migrated=legacy?passportMigrateV3(legacy):passportDefaults();try{localStorage.setItem(PASSPORT_KEY,canonicalJSON(migrated))}catch{}return migrated}
```

The inner `catch{}` swallows the failure and falls through to
`passportDefaults()`, and no backup is taken anywhere in that function. This is a
deployed game, so it is a live finding with its own queue entry, not a note in a
release report.

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
in the queue's SUPERSEDED marker — a synthetic, under-populated record — not
because of its `seasonId`.

**The rule, therefore, describing what the code does:** `seasonId` is not input.
It is stamped by the normaliser from `PASSPORT_SEASON`, a build-time constant.
A reader never branches on it, and a writer never chooses it. A build that
*reads* `seasonId` to make a decision is out of contract, because the value it
reads is whatever its own normaliser last stamped.

If seasons are ever to mean anything across builds — a season roll that older
builds must recognise — that is a schema change and a separate proposal.

---

## C5 — Node id is generated per install, never a literal

The counters are per-node. Two installs sharing a node id merge into one
another's totals and cannot be separated.

**Banned literal: `mbm-default00000000`.** A build must generate its node id on
first run and persist it in its own save.

Reference implementations that generate per install: the `mbm-ak-…`,
`mbm-velo-…` and `mbm-hubtest…` forms observed at runtime, from each build's own
`newNode()` / node-generation helper.

The four deployed writers are in scope for this clause specifically. If any live
writer is already emitting `mbm-default00000000`, the per-node clocks are
degraded in production and that is a live finding with its own queue entry.

---

## C6 — Lamport monotonicity across a boot

Seed → boot → re-read must satisfy `lamport_after >= lamport_before`.

`normalizePassport` computes `output.lamport = Math.max.apply(Math, clocks)`
(`apexkick/index.html:928`) over every register and pair clock in the record, so a normalise can only raise
it. A boot that lowers it has discarded clocks — which is the same event C1′
describes, seen from the other side, and is why both are measured.

---

## What the gate may and may not conclude

- A **green** on this contract is not a statement that a build is correct. It is
  a statement that the build did not damage a passport written by a deployed
  writer, under the arms in `tools/verify_sports_passport_contract.mjs`.
- A **passport arm may only be seeded from a record written by a deployed
  writer.** A synthetic seed cannot distinguish a clobber from a rejection,
  which is the entire question. This rule was established by striking a
  withdrawn reading that had done exactly that; see the SUPERSEDED marker in
  `reports/2026-08-30-deferred-verification-queue.md` in the Lessons repository.
- No arm may report a result from a run that did not complete. Every arm carries
  a deferred-write control and aborts MEASUREMENT INVALID rather than reporting.
