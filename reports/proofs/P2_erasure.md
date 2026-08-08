# P2 — Self-service deletion, on the production origin

**Status: RED on the definition, NOT RUN on the mechanism.**

Two different things, and they need separating:

- The **auth-user deletion mechanism is correctly shaped** in source — better
  than §2.1 anticipated. It was not executed (no network route).
- The **stated definition of deletion is not met**, and that part needs no
  network to establish. One required element is absent by design.

Date: 2026-08-08 · Branch @ `144ae9a` · PR #99

---

## 2.1 What #99 actually does — measured, before proposing anything

§2.1 anticipated the common failure: a browser-only delete that clears rows but
cannot remove the auth user, leaving the email registered and re-signup broken.

**That is not what this branch does.** Measured from
`supabase/functions/delete-account/index.ts`:

- It is a **Supabase Edge Function**, not browser code. ✅
- `verify_jwt = true` in `supabase/config.toml`. ✅
- It verifies the caller's JWT **server-side** — `userClient.auth.getUser(token)`
  against the anon client, rejecting on error. ✅
- **It derives the id from the token and never from the request body.** The
  body is read only for `{confirm: true}`; the deletion target is
  `userData.user.id`. There is literally no id parameter to forge. ✅
- It deletes via `admin.auth.admin.deleteUser(...)` using
  `SUPABASE_SERVICE_ROLE_KEY` from Edge Function secret storage. ✅
- The service-role key is **not** in the repo. A full-branch scan for
  `service_role`, `sb_secret_`, `BUTTONDOWN_API_KEY` values and JWT-shaped
  strings returned only prose, variable names and the intended public
  `sb_publishable_` key. **No STOP-AND-REPORT secret event.** ✅

So the §1.3 matrix applied to the delete endpoint — *A must not be able to
delete B by passing B's id* — is satisfied **structurally**, by there being no
such parameter. The harness still tests it empirically (it posts `user_id`,
`id` and `email` for B and then asserts B's row survives), because "the
parameter is ignored" should be observed, not assumed.

Cascade is likewise declared correctly: both `profiles.id` and
`member_data.user_id` are `references auth.users(id) **on delete cascade**`, so
removing the auth user removes both rows. Declared in the migration; **not
confirmed against the live database.**

### One thing worth knowing about the origin gate

```ts
if (origin && !ALLOWED.has(origin)) return json(403, …)
```

The check is skipped when there is **no `Origin` header at all**. That is not a
security hole — the JWT is still required and the function can still only
delete its own caller — and it is ordinary CORS practice. But it has a
practical consequence for §2.4 below: **a server-side call with no `Origin`
header can exercise the real production function without widening
`MBM_ALLOWED_ORIGINS` for QA.** That materially changes the sequencing options.

---

## 2.2 What "deleted" means — line by line

| element | status | evidence |
|---|---|---|
| auth user removed | **mechanism correct, NOT RUN** | `delete-account/index.ts` → `auth.admin.deleteUser(userData.user.id)` |
| `profiles` row removed | **declared (cascade), NOT RUN** | `profiles.id references auth.users(id) on delete cascade` — cascade, not an explicit delete |
| `member_data` row removed | **declared (cascade), NOT RUN** | `member_data.user_id references auth.users(id) on delete cascade` |
| **Buttondown subscriber removed or unsubscribed** | **RED — ABSENT BY DESIGN** | see below |
| device-local storage cleared | **PARTIAL** | `deleteAccount()` calls `writeOfflineIdentity(null)`, clearing `mbm_cloud_identity_v1` only. Legacy `mbm_session`/`mbm_users` are cleared solely by the separate, manual "remove legacy record" button (`account/index.html:176`). Game saves are deliberately untouched. |
| seven-word-code sync rows | **out of scope, and stated** | not keyed to an account; deliberately not widened |

### FINDING P2-A — erasure leaves the user on the mailing list

`delete-account/index.ts` makes **no call to Buttondown**. Nothing in the
deletion path touches the mailing provider. The UI says so explicitly:

> `account/index.html:125` — *"Account deletion removes the authentication
> identity, profile and synchronised member data. Mailing-list subscription is
> separate and must be unsubscribed separately through its own email link."*

Against §2.2 — *"erasure that leaves them on a mailing list is not erasure"* —
this is a **red cell**, and it is a design decision rather than a bug, so it
cannot be fixed by re-running anything.

There is a coherent argument for the current behaviour: the account and the
mailing list are deliberately separable (that separability is itself a §3.3
requirement, and #99 gets it right), so a person who subscribed *without* an
account has a subscription that account-deletion could never reach. Deleting
the list membership on account deletion would also be a surprise in the other
direction — a subscriber who happens to also hold an account loses a
subscription they never asked to end.

But the prompt's requirement stands, and the current copy does not fully
discharge it either: it tells the user to use "its own email link", which
assumes they have a mailing in their inbox to find. **This is Matt's call**, and
it is a small decision with three defensible answers:

1. **Delete the subscriber too**, keyed on the account email, with the
   confirmation copy saying so plainly.
2. **Keep them separate, but make leaving reachable** — put an unsubscribe
   control on `/account/` (which §3.2 requires anyway, and which does not
   currently exist — see P3). Deletion copy then points at a real control.
3. **Keep as-is**, and accept the §2.2 red knowingly.

Recommendation: **(2)**. It satisfies §3.2's missing unsubscribe requirement and
§2.2's spirit with one piece of work, and it does not silently end a
subscription the user may want to keep.

### 2.2 copy check — the seven-word-code rows

§2.2 requires honesty rather than implied completeness here, and the branch
gets this right: `account/index.html:125` scopes the claim to "the
authentication identity, profile and synchronised member data" and does not
imply the anonymous sync rows are reached. No change needed, and the delete was
**not** widened to reach them.

---

## 2.3 Proof standard — packaged, not performed

`tools/proofs/p2_erasure.mjs` runs the full standard. Every step **NOT RUN**:

| step | status |
|---|---|
| pre-condition: victim's rows exist | NOT RUN |
| forged-id delete does not touch the witness | NOT RUN |
| delete without a user JWT is refused | NOT RUN |
| self-delete accepted | NOT RUN |
| login with old credentials fails | NOT RUN |
| **second session** confirms rows gone (+ own-row control) | NOT RUN |
| re-signup with the same email succeeds cleanly | NOT RUN |
| no orphan rows across the 1.1 census | NOT RUN |

The re-signup step is the one that catches false erasure: if the auth user
survived and only rows were cleared, signup returns *"already registered"*, and
the script says so in those words.

**UI requirements — source-verified, both met.** Irreversibility is stated
before the button (`account/index.html:124–128`), and the action needs a real
confirmation, not a single tap: the user must type `DELETE` exactly, checked at
`account/index.html:177`.

---

## 2.4 The sequencing problem

The tension is real: "prove on the production origin" and "before merge"
conflict, because the production origin is what merging creates.

**Recommendation: (b) — merge with the mailing flag OFF, prove deletion on the
real origin, then flip the flag.**

Reasons, in order of weight:

1. **It is the house precedent.** The sync module shipped exactly this way —
   switched off, activating itself only after a real round-trip. Using the same
   pattern twice means the release procedure is a known quantity rather than a
   one-off.
2. **The flag is already off.** `site.json` has `features.mailing.enabled:false`,
   and the client fails closed on it — `mbm-mailing.js` `valid()` requires
   `enabled===true`, and the form stays `hidden` with an honest "not active yet"
   notice rendered in its place (`mailing-list/index.html:26`). Merging changes
   nothing about mailing. The blast radius of (b) is the accounts feature only.
3. **(a) buys less than it appears to.** A preview-origin proof is not a
   production-origin proof — it is the same function with a different allow-list
   entry — so (a) ends with a post-merge re-verification anyway. It pays the
   cost of widening `MBM_ALLOWED_ORIGINS` for QA and then remembering to narrow
   it, which is precisely the teardown step that gets forgotten.

**Caveat that improves both options** (from §2.1): because the origin check is
skipped when no `Origin` header is present, the production `delete-account`
function can be exercised **server-side, from an operator machine, with no
allow-list change at all**. `p2_erasure.mjs` is a Node script and sends no
`Origin` unless told to. That means:

- under (b), the post-merge proof needs no configuration change whatsoever;
- under (a), a genuine production-origin proof is available *without* merging —
  which, if Matt prefers (a), removes its main drawback.

That last point is worth weighing before choosing. It was not available when
the PR body was written, and it makes (a) more attractive than it looked.
I still recommend (b) on precedent, but the gap between them has narrowed.

**This is Matt's decision. Nothing has been merged, flipped or configured.**

---

## Could not verify

- Every step of 2.3 — no network route (403 CONNECT on `fhulisooqhbyldphmnca.supabase.co`
  and `madebymatt.uk`; see P1 report for the proxy evidence).
- That the live `delete-account` function is deployed and ACTIVE with the
  service-role secret actually set — the PR body asserts it; unconfirmed here.
- That the FK cascade fires on the live database as declared.
- Whether any orphan row survives in an object not named in the migration.
