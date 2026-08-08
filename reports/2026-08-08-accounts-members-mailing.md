# Accounts, cross-device Members & mailing-list restoration

Sentinel: `mbm-accounts-members-mailing-2026-08-08`
Date: 2026-08-08

## A. Root cause

The professional redesign did not create the underlying authentication problem.
The repository had a provider abstraction capable of Supabase, but the Supabase
URL/public key slots were never configured. In that condition the historical
`MBMAuth` code selected its device-local backend. That backend stored a local
account record and salted SHA-256 password hash in browser storage, which could
separate local game save slots but could not provide cross-device identity or
password recovery.

The restored architecture therefore makes Supabase Auth canonical and removes
local-password fallback from the real account journey.

## B. Authentication architecture

Canonical identity is Supabase Auth through `assets/mbm-account.js`.
Passwords stay with Supabase Auth. Site code does not hash, compare, store or
back up a password itself.

The production project is now connected using its provider-intended public URL
and publishable browser key. Missing/invalid cloud configuration still fails
closed; no browser-local password backend is substituted.

## C. Account UX

Stable route: `/account/`.

Implemented UI/logic for registration, verification resend, login/logout,
password-reset email, recovery-link password update, persistent provider session,
optional display-name update, account status and self-service deletion via a
trusted Edge Function.

## D. Members integration

`/members/` is auth-aware. Signed-out users get real login/create-account routes;
signed-in users can manage deliberately narrow account-backed hub favourites.
Public Games, Lessons, Apps, Tools and Resources remain ungated.

## E. Cross-device sync design

Cloud member data is deliberately limited to optional display name and saved
Made by Matt hub shortcuts. Reading/background preference, pupil registers,
marks, evidence and arbitrary browser storage are not swept into the account.

Favourite records merge per href using timestamps. `member_data.version` and
`update_member_data` provide optimistic compare-and-swap conflict handling so a
stale browser refetches/merges rather than silently replacing newer server data.

## F. Existing member migration

Legacy `mbm_users` / `mbm_session` records are preserved by default. Old
password/hash data is never uploaded. A signed-in cloud user may explicitly copy
only the old display name; local game saves are not deleted.

## G. Mailing list

`/mailing-list/` remains independent from account creation. The form requires an
unticked consent checkbox and includes a honeypot.

The production `subscribe-mailing-list` Supabase Edge Function is deployed, but
`BUTTONDOWN_API_KEY` has not yet been provisioned and no real Buttondown
subscription/readback/unsubscribe proof has occurred. Consequently
`features.mailing.enabled` correctly remains `false`.

## H. Production Supabase provisioning completed

- Existing Made by Matt Supabase project reused in `eu-west-1` (London).
- Production migration `mbm_accounts_members_production` applied.
- `public.profiles` and `public.member_data` exist with RLS enabled.
- Own-row policies are active for authenticated users.
- `public.update_member_data` runs SECURITY INVOKER.
- Trigger helper `handle_new_user` creates profile/member rows and is not directly
  executable by public/browser roles.
- Browser profile grants are column-restricted so `tier` is not client-writable.
- `delete-account` Edge Function is ACTIVE with JWT verification enabled.
- `subscribe-mailing-list` Edge Function is ACTIVE with JWT verification disabled
  intentionally for independent public opt-in.
- Supabase security advisor returned no findings after provisioning.
- Supabase performance advisor returned no findings after provisioning.

## I. Privacy/security boundary

No Gmail password, SMTP password, Supabase service-role/secret key, Buttondown API
key, copied session token or refresh token belongs in public configuration or
evidence. The public Supabase URL/publishable browser key are intentionally client
configuration; RLS is the per-user data boundary.

Account deletion and mailing unsubscribe remain separate operations. Account
creation never implies mailing consent.

## J. Repository testing

Permanent gate: `node tools/verify_accounts_members_mailing.js`.

The validator now accepts either absent fail-closed Supabase config or a valid
provider publishable browser configuration, rejects secret/service-role shaped
configuration, checks the hardened RLS form, verifies the account/mailing secret
boundaries, and retains positive controls for local password storage and
privileged Supabase key injection.

`node tools/test_member_merge.js` remains the deterministic member conflict gate.

## K. Cross-device production proof

**NOT YET CLAIMED.** A real provider-backed two-clean-browser lifecycle requires
Supabase Auth Site URL/redirect/email settings to be confirmed and disposable QA
email identities to complete real verification/login/recovery flows.

## L. Buttondown production proof

**NOT YET CLAIMED.** No authenticated Buttondown administration surface is
available to the current executor, so the newsletter, private API credential,
subscriber readback and unsubscribe proof cannot be fabricated.

## M. Exact remaining provider-dependent work

1. In the existing Supabase project, configure Authentication Site URL as
   `https://madebymatt.uk`, allow `/account/` and `/account/?mode=recovery`, and
   keep email confirmation enabled as intended.
2. Create/select the real Buttondown newsletter administered for
   `contactmadebymatt@gmail.com`, generate its private API credential and store it
   as the Supabase Edge Function secret `BUTTONDOWN_API_KEY`.
3. Run real registration/verification/login/logout/password recovery/deletion.
4. Run User-A/User-B negative authorization proof with authenticated sessions.
5. Run isolated Browser A → Browser B account-backed member-data round trip.
6. Run Buttondown subscribe/readback/duplicate/unsubscribe proof, then enable the
   mailing feature.
7. Only then mark PR #99 Ready, merge it and execute final served-production,
   mobile and accessibility verification.

PR #99 remains Draft because the remaining provider-dependent acceptance gates
have not been faked.
