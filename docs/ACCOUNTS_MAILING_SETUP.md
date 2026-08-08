# Made by Matt accounts + mailing list — activation guide

Sentinel: `mbm-accounts-members-mailing-2026-08-08`

The repository contains the browser UI, RLS schema, account-data merge logic,
account-deletion Edge Function, mailing subscription Edge Function, privacy copy
and permanent static validator.

## Current production provisioning status — 8 August 2026

The Supabase infrastructure is now partly provisioned rather than hypothetical:

- the existing Made by Matt production project in London is connected;
- `public.profiles` and `public.member_data` are deployed with RLS;
- the production account migration has been applied;
- the public project URL and provider publishable browser key are in `site.json`;
- `delete-account` is deployed with JWT verification enabled;
- `subscribe-mailing-list` is deployed as the intentionally public subscription
  endpoint, but the private Buttondown credential has not yet been provisioned;
- mailing therefore remains `enabled:false` until real provider proof exists.

The account code has no local-password fallback. Public content remains usable
whether account services are available or not.

## 1. Supabase Auth settings still required

In the already-connected production Supabase project:

1. Set the Authentication **Site URL** to `https://madebymatt.uk`.
2. Allow these redirect URLs:
   - `https://madebymatt.uk/account/`
   - `https://madebymatt.uk/account/?mode=recovery`
3. Keep email confirmation enabled unless there is a documented reason not to.

The project URL and publishable browser key are public configuration by provider
design. RLS is the user-data boundary.

### Never put these in `site.json` or browser JavaScript

- `SUPABASE_SERVICE_ROLE_KEY`
- any `sb_secret_...` key
- database password
- SMTP password
- OAuth client secret
- any user's password
- copied access/refresh tokens

## 2. Account deletion

`supabase/functions/delete-account` is deployed to the production project and
retains JWT verification. Its code validates the signed-in user and performs the
admin deletion only at the trusted Edge Function boundary.

Supabase supplies its hosted function environment with the required project/admin
values; privileged values must never be copied into the public site.

A disposable authenticated QA account must still be used to prove deletion end
to end after Auth redirects/email flows are configured.

## 3. Buttondown — still required for mailing

Create or select the real Made by Matt Buttondown newsletter and make
`contactmadebymatt@gmail.com` the appropriate owner/administrative contact. Keep
Buttondown's confirmation/double-opt-in and unsubscribe mechanisms.

Create the Buttondown API credential and store it only in Supabase Edge Function
secret storage as:

```text
BUTTONDOWN_API_KEY=<private value>
```

Both `subscribe-mailing-list` and `unsubscribe-mailing-list` read that value
server-side. The browser never receives it. Deploy both:

```sh
supabase functions deploy subscribe-mailing-list
supabase functions deploy unsubscribe-mailing-list
```

`subscribe-mailing-list` is intentionally public, because joining the mailing
list does not require a Made by Matt account; its code still requires explicit
consent, checks a honeypot, validates input and restricts browser origin. It
returns an **identical** response whether or not the address is already on the
list. That uniformity is deliberate: a distinguishable "already subscribed"
reply would let an anonymous caller test whether any address is on the list.

`unsubscribe-mailing-list` backs the unsubscribe control on `/account/` and is
the opposite case: it **requires** a verified JWT (`verify_jwt = true`) and
takes the address from the caller's token, never from the request body. Without
that, the endpoint would let anyone unsubscribe anyone, and would answer "is
this address on the list?" to a stranger.

Proving the provider round-trip:

```sh
SUPABASE_URL=… SUPABASE_ANON_KEY=sb_publishable_… \
BUTTONDOWN_API_KEY=…  QA_MAIL_EMAIL=qa+p3@… \
node tools/proofs/p3_mailing.mjs
```

Run it from an operator machine. The key belongs in Edge Function secret
storage and in that shell only — never in the repo, never in CI.

Only after a real Buttondown subscription and unsubscribe have been read back
from the provider may this be changed:

```json
"mailing": {
  "enabled": true,
  "provider": "buttondown",
  "functionName": "subscribe-mailing-list",
  "adminContact": "contactmadebymatt@gmail.com"
}
```

Account creation and mailing consent remain independent.

## 4. Required QA before PR #99 can leave Draft

Use disposable controlled identities only. Do not put passwords, tokens or raw
subscriber addresses in evidence.

### Account lifecycle

- Create a production account.
- Confirm the verification email and callback.
- Log in; prove incorrect credentials are denied.
- Request and complete a real password reset.
- Refresh and prove session persistence.
- Log out and prove account-backed member data is no longer readable.
- Delete a disposable account and prove the Auth/profile/member rows are gone.

### Authorization

Create User A and User B. A must read A and be unable to read B; B must read B
and be unable to read A. This must be tested through real authenticated clients,
not inferred from the SQL file alone.

### Cross-device proof — mandatory

1. Clean Browser Context A: sign in and save one Members shortcut.
2. Confirm the server write.
3. Close A.
4. Clean Browser Context B: no copied cookies/localStorage/IndexedDB/session.
5. Sign in normally to the same account.
6. Confirm the shortcut from A appears from server-backed `member_data`.
7. Change an appropriate shortcut in B, then reload A (or clean C) and confirm
   the updated account state is obtained without silently losing newer data.

### Mailing proof — mandatory

- Submit a disposable email with consent checked.
- Confirm the endpoint's expected pending/confirmation state.
- Read back the subscriber in the real Buttondown newsletter.
- Complete confirmation where configured.
- Repeat the same address and verify safe duplicate handling.
- Test invalid email and unticked consent.
- Use the real provider unsubscribe route and verify Buttondown reflects it.

### Production surfaces

After merge, verify the served site rather than only repository files:

- `https://madebymatt.uk/`
- `https://madebymatt.uk/account/`
- `https://madebymatt.uk/members/`
- `https://madebymatt.uk/mailing-list/`
- `https://madebymatt.uk/privacy/`

Check approximately 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS px, including
keyboard/focus states, autofill/password-manager behaviour, error/status
announcements, reduced motion and touch targets.

## 5. What deliberately remains device-local

- reading/background preference
- existing UAS/ASDAN pupil records, marks and evidence
- standalone/offline content caches
- legacy local account record until the user explicitly removes it
- existing local game saves

The first genuine account-backed dataset remains deliberately narrow: optional
display name + saved Made by Matt hub shortcuts. The account system must not
blindly upload arbitrary `localStorage` values or pupil records.
