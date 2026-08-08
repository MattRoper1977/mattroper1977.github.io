# P3 — Buttondown: subscribe → readback → duplicates → unsubscribe

**Status: RED.** Two required behaviours are absent or wrong in source, provable
without touching the provider. The four live sub-proofs were not run.

Date: 2026-08-08 · Branch @ `144ae9a` · PR #99

---

## 3.1 The secret — clean

A full-branch scan for `service_role`, `sb_secret_`, Buttondown key values and
JWT-shaped strings (`eyJ…`) found **no committed secret**. Every hit was prose,
an env-var *name*, or a test asserting the absence of secrets. The only key in
the repo is `sb_publishable_2ZfOZp4vUwx_6iCqsU6GnA_3rKoSFwE` in `site.json`,
which is the provider's publishable browser key and is intended to be public.

`BUTTONDOWN_API_KEY` is read only via `Deno.env.get(...)` inside the Edge
Function (`subscribe-mailing-list/index.ts:19`). Correct.

**No STOP-AND-REPORT event. No rotation required on this evidence.**

The constraint §3.1 names is real and the branch reflects it: Buttondown's
keyless embed form cannot do readback, which is exactly why a server side
exists here.

---

## 3.2 The four sub-proofs

### Subscribe → provider readback — **NOT RUN**
Requires `api.buttondown.com`, which this session cannot reach (403 CONNECT),
and requires the key, which correctly does not exist in the repo.
`tools/proofs/p3_mailing.mjs` asserts existence at the provider, never from the
function's own `{ok:true}` — local success with provider absence being the
precise failure this proof exists to catch.

Also blocked upstream: `features.mailing.enabled` is `false`, so the browser
path is inert by design and the form does not render.

### Duplicates — **one case is RED in source**

| case | status |
|---|---|
| (i) already-subscribed and active | **RED — discloses membership** |
| (ii) previously unsubscribed | NOT RUN (source reading below) |
| (iii) same address twice in quick succession | NOT RUN |

> **FINDING P3-A — enumeration leak. This is the exact leak §3.2 names.**
>
> The function returns a *distinguishable* state for an address already on the
> list, and the UI reports it verbatim to an unauthenticated caller:
>
> - `supabase/functions/subscribe-mailing-list/index.ts` — on a Buttondown
>   400/409 matching `/already|exists|subscriber/`, returns
>   `{ok:true, state:'already_subscribed'}`.
> - `assets/mbm-mailing.js:33` — *"That address is already on the list. You can
>   use the unsubscribe link in any mailing if you want to leave."*
>
> A first-time subscribe returns `state:'pending_confirmation'` and different
> copy. **Anyone can therefore test whether any address is subscribed**, with no
> authentication, one request at a time. §3.2's requirement is *"no disclosure
> to an unauthenticated caller of whether an address is already on the list —
> that is an enumeration leak dressed as a helpful message."*
>
> **Fix:** collapse both paths to one indistinguishable response and one piece
> of copy — the "check your inbox" wording works for both cases, because a
> genuine duplicate genuinely does not need a new confirmation. Delete the
> `already_subscribed` state rather than renaming it; any distinguishable state
> reconstructs the oracle.
>
> Not applied — this is behaviour change on the feature under proof, and it
> lands with the §3.2 rework rather than as a drive-by edit.

On case (ii), source reading is *encouraging but unproven*: the function POSTs
only `{email_address}` and never sends a resubscribe or `subscriber_type`
change, so it should not reactivate someone who opted out. That is an inference
about Buttondown's behaviour on POST-to-existing, and inference is not the
standard here — `p3_mailing.mjs` unsubscribes the QA address and re-submits,
then reads the type back from the provider. Note that under P3-A the opted-out
person is *also* told they are "already on the list", which is the same
disclosure with an added consent edge.

### Unsubscribe — **RED, one half does not exist**

- **From the email link:** Buttondown-provided, **NOT RUN** (needs a real
  delivered mailing).
- **From `/account/`:** **ABSENT.** There is no unsubscribe control anywhere in
  the branch. A full search for `unsubscrib` across `account/`, `members/`,
  `assets/`, `mailing-list/`, `supabase/` and `site.json` returns only prose,
  one status message, and `authSubscription.unsubscribe()` (an unrelated
  Supabase auth listener teardown). `MBMMailing` exposes `subscribe` and `bind`
  and no unsubscribe method at all.

  `account/index.html:125` states the position deliberately: mailing "must be
  unsubscribed separately through its own email link." That is a coherent
  design, but it does not satisfy §3.2's explicit requirement of an unsubscribe
  from `/account/`, and it makes leaving dependent on the user still having a
  mailing to hand.

  This is the same piece of work recommended as option (2) in **P2-A**. One
  control discharges both.

### Failure mode — **source-verified, correct**
The UI fails closed and does not fake success:
- provider unreachable → `502 {ok:false}` with *"The mailing service could not
  be reached."* (`subscribe-mailing-list/index.ts`)
- rate-limited → `429 {ok:false}` with a "try again later" message
- any other non-OK → `502 {ok:false}`
- `mbm-mailing.js:23` throws on `!r.ok`, and the form renders the error via
  `say(err.message,'err')` — the success copy is unreachable on a failed call.
- With the feature flag off, the form is not rendered at all and an honest
  "not active yet" notice appears instead (`mailing-list/index.html:26`), which
  is the same fail-closed instinct one level up.

**NOT RUN** against a genuinely unreachable/rate-limiting provider.

---

## 3.3 Consent record

| line | verdict | evidence |
|---|---|---|
| double opt-in enabled in the account | **needs Matt** | The function *assumes* it — it returns `state:'pending_confirmation'` and the UI says "check your inbox and confirm" (`mbm-mailing.js:34`) — but nothing in the branch sets or verifies it. It is a Buttondown account setting. If it is off, that copy is false. `p3_mailing.mjs` reads `subscriber_type` back: `unactivated` = double opt-in in force, `regular` = it is not. |
| consent bundled into sign-up | **present (correctly separated)** | Not bundled. `register()` in `mbm-account.js` makes no mailing call. `/mailing-list/` is a standalone page with its own required checkbox (`mailing-list/index.html:22`) and states *"You do not need an account, and creating an account never joins this list"* (line 15), reinforced at line 28 and `mbm-platform.js:164`. The Edge Function independently rejects `consent !== true`. This is the classic failure, and #99 avoids it. |
| unsubscribe link in outgoing mail | **needs Matt** | Buttondown-provided; no repo evidence either way. Read a delivered message. |
| sender of record | **needs Matt** | `site.json` sets `features.mailing.adminContact: "contactmadebymatt@gmail.com"`, but that is a contact address in config, not the provider's configured From/sender identity. Confirm in the Buttondown account. |

---

## Harness

```sh
SUPABASE_URL=… SUPABASE_ANON_KEY=sb_publishable_… \
BUTTONDOWN_API_KEY=…            # operator machine only — never CI, never the repo
QA_MAIL_EMAIL=qa+p3@… \
node tools/proofs/p3_mailing.mjs
```

Asserts every claim against `api.buttondown.com`, not against the Edge
Function's reply. It refuses to start if the QA address is already on the list,
because the duplicate cases are unreadable from a dirty starting state. Its
`already_subscribed` assertion currently **fails by design** — it is written to
catch P3-A, so it will stay red until that is fixed.

Evidence files are gitignored: they contain the QA address.

---

## Could not verify

- All four live sub-proofs — `api.buttondown.com` unreachable (403 CONNECT),
  and the key correctly does not exist in this environment.
- Whether double opt-in is on; whether a real mailing carries an unsubscribe
  link; the provider's sender of record.
- Buttondown's actual response to POST-ing an existing *unsubscribed* address.
