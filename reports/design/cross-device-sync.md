# Cross-device sync — scope and design

**The goal:** a pupil starts a Voxel Frontier world at school and carries on at
home. A teacher's Apex Kick squad follows them between two machines.

**The constraint Matt actually asked for:** the smallest possible
data-protection burden. That is a design problem, and most of it is solvable —
but not all of it, and this document is explicit about which part is not.

---

## The decision that shapes everything: no email, no name, no plaintext

The obvious build is Supabase Auth: email, password, a `profiles` row. It is
well-trodden and it is the **wrong choice here**, because it means storing
children's email addresses on a server. That single fact drags in the whole
apparatus — lawful basis, age assurance, subject access, erasure workflows,
breach notification with a 72-hour clock, and a privacy notice that has to
describe all of it.

**So the design removes the thing that causes the burden, rather than managing
it.** Sync is keyed on a **sync code** that the device generates, and the
payload is **encrypted in the browser before it leaves**.

### What Matt's database actually holds, per row

| column | content |
|---|---|
| `id` | `SHA-256(code + "|id")` — 64 hex chars. Unguessable, and it does **not** yield the key |
| `blob` | AES-GCM ciphertext. **Matt cannot read it.** Neither can Supabase |
| `updated_at` | a timestamp |
| `bytes` | size, for a cheap abuse cap |

**No email. No name. No password. No IP stored by us. No plaintext of any
kind.** There is no column that says who a row belongs to, because nothing in
the system knows.

### Why this genuinely reduces the burden, stated precisely

- **Data minimisation** (UK GDPR Art. 5(1)(c)) is satisfied structurally rather
  than by policy. There is no excess data to minimise later.
- **Security** (Art. 32) — end-to-end encryption is the strongest measure
  available, and it is not optional or configurable here.
- **Erasure** is one `DELETE` on a row the user can trigger themselves, and the
  key never existed on the server, so a deleted row is unrecoverable by anyone.
- **Breach impact** — a full database dump yields opaque blobs. There is nothing
  in it to notify anyone about, because there is nothing in it.
- **No age assurance problem**, because no personal data is collected at
  sign-up. There is no sign-up.

### What this does NOT remove, and nobody should pretend otherwise

- **Matt is still a data controller.** Encrypted personal data is still personal
  data. The obligation shrinks; it does not vanish.
- **The privacy page must still describe it** — what is stored, where, for how
  long, and how to delete it. Drafted, not deferred.
- **The Supabase region matters.** Choose **London (eu-west-2)** at project
  creation. It cannot be changed afterwards without recreating the project.
- **Supabase becomes a processor**, so there is a third party in the chain. That
  is a real change to the site's "three things reach the internet" promise and
  the promise must be updated, not quietly stretched.

**This is minimisation, not evasion.** A design that held emails and simply did
not mention them would be the second thing, and would be worse than useless the
first time somebody asked.

---

## The trade, said loudly because it is the whole cost

**Lose the sync code and the data is gone.** Permanently. There is no reset,
because a reset would require someone to hold the key, and the entire benefit
above comes from nobody holding it.

The UI must therefore treat the code the way a password manager treats a
recovery phrase: show it once, big, with a copy button, and make the user
confirm they have it before the dialog can be dismissed. It must never be
described as a "password", because people mentally file passwords under
"resettable".

---

## How it works, end to end

```
DEVICE A                                    DEVICE B
  code = 6 random words (77 bits)
  key  = PBKDF2(code, salt, 250k, SHA-256)
  id   = SHA-256(code + "|id")
  blob = AES-GCM(key, iv, JSON(saves))
      ── PUT id, blob ──▶  Supabase
                                            user types the 6 words
                                            id, key derived the same way
                          Supabase ──▶      GET id → blob
                                            decrypt → merge → local saves
```

- **Transport is plain `fetch`** against Supabase's REST endpoint. Deliberately
  **not** `supabase-js`: that would be a new third-party *script* executing on
  the page, and this estate vendored four scripts off a CDN this morning
  precisely to stop that. One new *origin* is a much smaller change than one new
  script, and it is honest to describe.
- **77 bits of entropy** from a 6-word code out of a 2048-word list. Guessing a
  row id is not a realistic attack; the practical limits are Supabase's own rate
  limits and the size cap below.
- **Merge is not last-write-wins on the whole blob**, because that silently
  destroys work: play at home, then open school without syncing, and the school
  device would overwrite the evening. Merge is per key, with additive fields
  taking the maximum (goals, achievements) and worlds keyed by seed so two
  different worlds both survive. Genuine conflicts on the same key keep the
  newer and **keep the older under a `.conflict` suffix rather than dropping
  it**.

## Fail-closed, and the gate that decides it

`MBM_CAPS["cloud-sync"]` is set **only** after a real write-then-read-back
round-trip against the live project — not because keys are present, and not
because a client connected. That register already exists in
`assets/mbm-features.js` and already documents the three-way distinction between
configuration, connection and capability.

**Until that round-trip passes, the sync UI does not appear at all.** A backup
that silently fails is worse than no backup, because people stop making their
own copies.

## Limits, deliberately chosen

| | |
|---|---|
| max blob | 256 KB — a Voxel world is the big one; oversize refuses with a clear message rather than truncating |
| retention | rows untouched for 12 months are deleted by a scheduled job. Written into the SQL, not left as an intention |
| rate | Supabase's own limits; no bespoke throttle, and that is stated rather than implied |

---

## The three things only Matt can do

1. Create a Supabase project — **region London (eu-west-2)**, free tier.
2. Run `supabase-sync-schema.sql` in the SQL editor.
3. Paste the project URL and the **anon** key into `site.json`. The anon key is
   designed to be public; the `service_role` key must **never** go in the repo.

Everything else in this document is built and tested against a mock that
implements the same interface, so the day those three steps happen the gate
either goes green or says exactly why not.
