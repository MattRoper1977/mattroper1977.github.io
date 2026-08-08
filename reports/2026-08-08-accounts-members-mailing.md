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

Git history shows the account UI was removed on 2 August because a static Pages
site could not honestly present that local password as access control. A later
change restored the local account for non-security game bonuses/save slots and
added a separate teacher email relay. The 7 August professional upgrade then left
Members visible without a clear modern account-creation journey. The real root
issue is therefore older: **cloud auth was designed but never provisioned**, and
the only active fallback was a browser-local password.

## B. Authentication architecture

Canonical identity is now Supabase Auth, through `assets/mbm-account.js`.
The new account journey has no local-password fallback. If the project URL/public
browser key are absent, registration/login are unavailable and the page explains
the dependency.

Passwords stay with Supabase Auth. The site code does not hash, compare, store or
back up a password itself.

## C. Account UX

New stable route: `/account/`.

Implemented UI/logic for:

- Create account
- email verification/confirmation state
- Login
- Logout
- Forgot password/reset email
- Password recovery-link update
- persistent provider-managed session
- optional display-name update
- account status
- account deletion via authenticated server function
- password-manager autocomplete semantics
- accessible live status/error messages
- mobile-first 44px+ controls and reduced-motion support

## D. Members integration

`/members/` now has explicit states:

- cloud service not configured — truthful unavailable state
- configured but signed out — Log in + Create account
- signed in — member dashboard with account-backed saved hub shortcuts

Public Games, Lessons, Apps, Tools and Resources are not gated.

## E. Cross-device sync

The first account-backed member dataset is deliberately narrow:

- optional display name (`profiles`)
- saved Made by Matt hub shortcuts (`member_data`)

Reading-background preference stays device-local. Pupil registers, marks,
evidence and unrelated browser storage are not uploaded.

Favourite records are merged per href using their update timestamps. The
`member_data` row has an optimistic `version`; stale writes fail with
`version_conflict`, causing the client to refetch, merge and retry rather than
silently replace a newer server copy.

## F. Existing member migration

Legacy `mbm_users` / `mbm_session` records are preserved by default.

- old password/hash data is never uploaded
- a signed-in cloud user may explicitly copy only the old display name
- removing the old account record is an explicit action
- existing game saves are not deleted
- `mbm-profile.js` now prefers the non-secret cloud identity hint but retains a
  legacy profile as a local save-slot identity; using the same email keeps the
  historical email-derived slot tag stable on that device

The offline identity hint is not authorization and cannot read RLS data.

## G. Mailing list

New route: `/mailing-list/` plus `assets/mbm-mailing.js`.

Architecture:

visitor form → Supabase Edge Function → Buttondown API → provider confirmation /
unsubscribe system.

The form requires a separate unticked consent checkbox and includes a honeypot.
Creating an account never invokes mailing subscription.

The browser never receives the Buttondown API key. The intended administrative
owner/contact is `contactmadebymatt@gmail.com`.

The mailing feature remains disabled in `site.json` until the real Buttondown
newsletter/key and function deployment are proven. While disabled the page never
claims a subscription succeeded.

## H. Security

- Supabase Auth is password authority.
- RLS on `profiles` and `member_data` uses `auth.uid()`.
- No password column exists in either table.
- Optimistic member-data update RPC runs as the authenticated caller.
- Supabase service-role key exists only in the account-deletion Edge Function
  environment.
- Buttondown API key exists only in the subscription Edge Function environment.
- Account deletion requires a valid Auth user and server-side admin operation.
- Mailing endpoint validates explicit consent, rejects non-production browser
  origins and uses a honeypot; provider confirmation/anti-abuse remains in the
  final subscription path.
- No test password/token/session cookie belongs in reports or public evidence.

## I. Privacy

`/privacy/` is rewritten where the old local-account/no-mailing claims became
false or misleading. It now distinguishes:

- public content
- optional Supabase account identity
- deliberately limited account-backed member data
- old local profile preservation
- separate mailing consent/provider
- separate encrypted game-save sync
- classroom records that remain device-local
- deletion and unsubscribe paths

It does not claim an unconfigured service is already live.

## J. Repository testing

Permanent gate: `node tools/verify_accounts_members_mailing.js`.

The gate checks required routes/files, cloud-only provider configuration,
password-manager semantics, no password column, RLS ownership policies,
optimistic conflict function, server-side secret boundaries, account/mailing
consent separation and Edge Function JWT settings.

Positive control: the validator injects a fake
`localStorage.setItem("password", ...)` into an in-memory fixture and must fail
that fixture. The real tree must pass.

## K. Cross-device proof

**BLOCKED BY EXTERNAL INFRASTRUCTURE.** The repository has no live Supabase
project URL/public key. A two-browser proof would be fake until a real project is
provisioned. Exact proof steps are in `docs/ACCOUNTS_MAILING_SETUP.md`.

## L. Production proof

Repository routes and fail-closed behaviour can be deployed safely without
secrets, but genuine account creation/login/reset/member round-trip/deletion and
mailing subscription cannot be called production-complete until the external
services are connected and the live tests pass.

## M. Outstanding external dependencies

1. Create/select a Supabase project owned by Made by Matt.
2. Run `supabase-schema.sql`.
3. Configure Auth site/redirect URLs for `https://madebymatt.uk`.
4. Put the public Supabase project URL + browser anon key in `site.json`.
5. Deploy `delete-account` Edge Function.
6. Create/select a Buttondown newsletter administered through
   `contactmadebymatt@gmail.com`.
7. Store `BUTTONDOWN_API_KEY` as a Supabase Function secret.
8. Deploy `subscribe-mailing-list`.
9. Prove real subscribe/confirm/unsubscribe, then set `features.mailing.enabled`
   to `true`.
10. Run the mandatory two-clean-browser cross-device proof and User-A/User-B RLS
    isolation proof before declaring final acceptance gates green.

No missing external secret has been replaced by pretend security.
