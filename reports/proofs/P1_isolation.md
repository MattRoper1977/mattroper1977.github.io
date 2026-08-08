# P1 — User A cannot read User B's data

**Status: NOT PROVEN — the matrix was not executed.**
Not "red" (no cell failed) and emphatically not green. No cell ran at all.

Date: 2026-08-08 · Branch `agent/accounts-members-mailing-2026-08-08` @ `144ae9a` · PR #99

---

## Why nothing ran

The agent session assigned to this proof has no network route to the Supabase
project. The session's egress proxy answers `403` to `CONNECT` for every host
this proof needs:

| host | result |
|---|---|
| `fhulisooqhbyldphmnca.supabase.co:443` | `connect_rejected` — gateway answered 403 |
| `madebymatt.uk:443` | `connect_rejected` — gateway answered 403 |
| `api.buttondown.com:443` | `connect_rejected` — gateway answered 403 |
| `api.github.com:443` | reachable (HTTP 200) |

Recorded by the proxy itself at `$HTTPS_PROXY/__agentproxy/status` under
`recentRelayFailures`. This is an organisation egress-policy denial, and the
proxy documentation is explicit that such denials are to be reported rather
than retried or routed around.

This is a **capability** limit, not a credentials limit. Supabase project
ownership was confirmed separately (org `madebymatt.uk`, `eu-west-1`, one
project, Free/NANO). Having the account does not give this container a route.

**The proof is therefore packaged, not performed.** `tools/proofs/p1_isolation.mjs`
runs the whole matrix in one command from any machine that can reach Supabase.
Its guard rails are tested and working (see "Harness" below); only the network
call is unexecuted.

---

## 1.1 Enumeration — from source, which is only half of it

The migration in `supabase-schema.sql` declares the objects below. **This is
what the branch *intends*, not what the database *is*.** Whether RLS is
actually enabled on the live tables is a `pg_class.relrowsecurity` fact that
cannot be read with the anon key, so it is not established here. Policies on a
table whose RLS is not enabled are inert, and that is the commonest silent
failure of exactly this kind of setup — so this gap is material, not pedantic.

`tools/proofs/enumerate_anon_surface.sql` answers it. Run it in the SQL editor
and paste the output here. Until then every row below is *declared*, not
*verified*.

| object | kind | RLS declared | FORCE RLS | notes |
|---|---|---|---|---|
| `public.profiles` | table | `enable row level security` present | **not declared** | 4 own-row policies |
| `public.member_data` | table | `enable row level security` present | **not declared** | 4 own-row policies |
| `public.handle_new_user()` | function | — | — | **SECURITY DEFINER** |
| `public.update_member_data(bigint,jsonb)` | function | — | — | SECURITY INVOKER |
| views / materialised views | — | — | — | **none declared in the migration** |
| storage buckets | — | — | — | **none declared; live state unknown** |
| realtime publications | — | — | — | **none declared; live state unknown** |

### Views
The migration creates none. Under R25 a zero census still has to be
*classified*, not just counted: "the migration declares no views" is not the
same claim as "the database contains no views". Query 3 of the SQL file
settles it. A view without `security_invoker = true` runs as its owner and
bypasses the underlying table's RLS entirely.

### SECURITY DEFINER functions
One: `handle_new_user()`. Assessment from source:

- **Justified.** It inserts the `profiles` and `member_data` rows for a new
  auth user. It runs from an `AFTER INSERT ON auth.users` trigger, where there
  is no `auth.uid()` to satisfy an own-row policy, so it genuinely needs the
  bypass.
- **`search_path` is pinned** (`set search_path = public`) — correct, and the
  usual hardening for a definer function.
- **Not reachable as an RPC.** `revoke all ... from public/anon/authenticated`
  is applied, so the browser roles cannot call it directly to mint rows. Good.
- It derives `new.id` from the trigger row, never from caller input.

`update_member_data` is **SECURITY INVOKER** and derives the target row from
`auth.uid()`. There is no id parameter to forge. That is the right shape.

### Grants — a second gate, and one of them looks wrong
```
grant select on table public.profiles to authenticated;
grant update (name, display_name, updated_at) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.member_data to authenticated;
```
Deliberately narrower than the policy surface, which is good practice. But:

> **FINDING P1-A (functional, needs live confirmation).** `authenticated` has
> **no INSERT grant on `profiles`**, and `mbm-account.js` `updateDisplayName()`
> writes with `.upsert(...)`. PostgREST sends an upsert as `POST` with
> `Prefer: resolution=merge-duplicates`, which requires INSERT privilege.
> On that reading, **changing a display name fails with `42501 permission
> denied` for every user**, regardless of RLS.
>
> Evidence: `supabase-schema.sql` grants block; `assets/mbm-account.js`
> `updateDisplayName` → `sb.from('profiles').upsert(...)`.
> This is a *predicted* failure from static reading, not an observed one — it
> needs one live call to confirm or dismiss. The phone QA on 2026-08-08 covered
> registration, login, recovery and favourites; the write-up does not record a
> display-name change, which is consistent with the defect being real and
> simply not yet exercised.
>
> If confirmed, the fix is a schema change and therefore a **STOP AND ASK**
> item under §6 — flagged, not applied.

---

## 1.3 / 1.4 The matrix — specified, unexecuted

Two real sessions, both directions, four verbs, every negative paired with its
positive control in the same run. `p1_isolation.mjs` emits exactly this table.
Every cell currently reads **NOT RUN**.

| object | verb | A→B | B→A | control present |
|---|---|---|---|---|
| `profiles` | SELECT other's row | NOT RUN | NOT RUN | yes — self sees exactly 1 own row |
| `profiles` | SELECT unfiltered | NOT RUN | NOT RUN | yes |
| `profiles` | INSERT forged `id` | NOT RUN | NOT RUN | n/a (expect rejection) |
| `profiles` | UPDATE other's row | NOT RUN | NOT RUN | yes |
| `profiles` | **UPDATE own row, reassign `id` to other** | NOT RUN | NOT RUN | yes |
| `profiles` | DELETE other's row | NOT RUN | NOT RUN | yes — post-check row intact |
| `member_data` | (same six) | NOT RUN | NOT RUN | yes |
| `rpc:update_member_data` | EXECUTE as A against B | NOT RUN | — | yes — B's row byte-compared |
| both | SELECT as pure anon | NOT RUN | — | n/a |
| both | exists-vs-absent response oracle | NOT RUN | — | n/a |

**Predicted outcome from source, recorded so it can be falsified rather than
quietly confirmed:** the reassignment case is the one that usually fails, and
here it looks covered — `profiles_update_own` and `member_data_update_own` both
carry `with check ((select auth.uid()) = id/user_id)`, not just `using`. A
`USING`-only policy would let A hand its own row to B. Writing the prediction
down first is the point; the run is what decides it.

## 1.5 Also checked

- **Keyed on `auth.uid()`, not email.** Both tables key on the auth user's
  UUID (`profiles.id`, `member_data.user_id`); no policy or client query filters
  on email. No email-based enumeration surface in the data layer. *(Source-verified.)*
- **Response oracle** — whether "row exists but is not yours" is
  distinguishable from "row does not exist". PostgREST normally returns `200 []`
  for both, but this must be *observed*, not assumed. Tested by the harness's
  `ORACLE(exists-vs-absent)` cell. **NOT RUN.**
- **Realtime.** Nothing in the branch subscribes to realtime and the migration
  adds no publication. Query 7 of the SQL file confirms the live state.
  **NOT VERIFIED.**
- **House rule — only the two game prefixes sync.** *Source-verified, and it
  holds.* `member_data.data` carries `{schema, favourites}` only. `setFavourite`
  rejects anything not starting with `/` and rejects protocol-relative `//`
  (`mbm-account.js`). `mergeMemberData` reconstructs the object as
  `{schema:1, favourites}` on every merge, so an unexpected key cannot ride
  inbound either — the exclusion holds **on the way out and on the way in**, as
  required. No pupil name, mark, register or evidence field appears anywhere in
  the account payload; `members/index.html:34` states this to the user. The one
  free-text field is a favourite's `title`, capped at 120 chars and sourced from
  the site's own link titles.

---

## Harness

`tools/proofs/p1_isolation.mjs` — one command, non-zero exit on any red cell.

```sh
SUPABASE_URL=https://fhulisooqhbyldphmnca.supabase.co \
SUPABASE_ANON_KEY=sb_publishable_… \
QA_A_EMAIL=… QA_A_PASSWORD=… QA_B_EMAIL=… QA_B_PASSWORD=… \
node tools/proofs/p1_isolation.mjs
```

Three properties, all **tested and working in this session** (only the network
call is unexecuted):

1. **It refuses to run under a key that would void the proof.** Verified: a
   `service_role` JWT exits 2 with *"A test that passes under service_role
   proves nothing"*; an `sb_secret_` key exits 2; an `sb_publishable_` key is
   accepted and proceeds to the network.
2. **Every negative is paired with a positive control**, and a negative whose
   control failed is reported `INCONCLUSIVE` — never `PASS`. Inconclusive cells
   fail the run.
3. **It re-reads the victim row as the victim** after each destructive attempt,
   so "0 rows affected" is corroborated by the row still being there.

Re-run it after any schema change.

---

## Could not verify

- Every cell of the 1.3 matrix — no network route (403 CONNECT, above).
- Live RLS **enabled** state (`relrowsecurity`) for both tables — needs the SQL editor.
- Presence/absence of views, storage buckets, realtime publications, and any
  `public` table beyond the two — declared-none in the migration, live state unread.
- Whether P1-A (display-name upsert vs missing INSERT grant) actually fails.
- Whether the response oracle leaks.
