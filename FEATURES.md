# Made by Matt — site features & setup

This file describes the account/member/mailing architecture identified by
`mbm-accounts-members-mailing-2026-08-08`.

The important rule is simple: **cloud identity fails closed**. Public Made by
Matt content continues to work if an external service is unavailable, but the
account UI never creates a device-local password as a fallback.

Core files:

| File | Purpose |
|---|---|
| `assets/mbm-features.js` | Existing counters/stats/download layer; legacy auth code remains historical and does not own the new account journey |
| `assets/mbm-account.js` | Cloud-only Supabase account client + member-data sync |
| `assets/mbm-mailing.js` | Separate mailing-list form client |
| `assets/mbm-platform.js` | Shared professional nav/account discovery and mailing CTA once enabled |
| `account/index.html` | Register, login, logout, verification resend, reset/recovery, profile and deletion UI |
| `members/index.html` | Auth-aware Members area + account-backed favourites |
| `mailing-list/index.html` | Explicit mailing opt-in, independent of account creation |
| `supabase-schema.sql` | Profiles/member data, RLS, trigger, grants and optimistic conflict function |
| `supabase/functions/delete-account/` | Authenticated server-side Auth user deletion |
| `supabase/functions/subscribe-mailing-list/` | Public subscription proxy; Buttondown credential stays server-side |
| `docs/ACCOUNTS_MAILING_SETUP.md` | Current production activation and QA boundary |

## Production status — 8 August 2026

Supabase is no longer hypothetical: the existing Made by Matt production project
is connected and its public URL/publishable browser key are present in
`site.json`. The account schema, RLS and Edge Functions are deployed. The
Buttondown private credential/provider proof is not yet complete, so mailing
remains disabled and PR #99 remains Draft pending provider-dependent end-to-end
acceptance tests.

## 1. Accounts + Members — cloud-only identity

Canonical account route: `/account/`.

Once a valid Supabase project is configured, the account client supports:

- email registration
- provider email-confirmation state + resend
- login/logout
- password-reset email
- recovery-link password update
- provider-managed persistent session
- optional display name
- self-service deletion through a trusted server-side Edge Function
- RLS-protected member data
- cross-device Members favourites

### No homemade password system

The browser never hashes, stores or compares a password itself. Supabase Auth owns
the credential and authenticated session. A missing/malformed provider
configuration disables the account journey instead of creating local credentials.

### Public browser configuration vs secrets

The Supabase project URL and **publishable** browser key are intentionally public
client configuration. They do not grant administrative access. Per-user data is
protected with RLS.

Never publish a Supabase service-role/secret key, database password, SMTP
credential, Buttondown API credential or copied user session token.

### Member data and conflict handling

`public.member_data` stores deliberately account-specific data: currently Made by
Matt saved hub shortcuts. Each favourite carries its own update timestamp. Writes
use optimistic row versioning through `update_member_data`; a stale client
refetches, merges per item and retries instead of silently deleting the newer
server copy.

`profiles` contains optional display name and account metadata. Browser grants are
column-restricted so account holders cannot edit the `tier` field themselves.

Reading/background theme remains a device preference. Pupil registers, marks,
evidence and similar classroom records are not swept into the account.

### Existing local users

Old `mbm_users` / `mbm_session` records are not silently destroyed and their
password hash is never uploaded. Account settings may explicitly copy only the
legacy display name. Existing local game saves remain on disk. When the old and
new identity use the same email, the local save-slot tag remains stable on that
device.

`mbm_cloud_identity_v1` is a non-secret offline hint for standalone game save-slot
continuity only. It is **not authorization** and cannot read RLS data.

## 2. Members

`/members/` has explicit states:

- provider unavailable/misconfigured — truthful unavailable state
- configured but signed out — Log in + Create account
- signed in — account-backed saved hub shortcuts

Games, Lessons, Apps, Tools and Resources stay public. Members adds convenience,
not a static-site paywall.

## 3. Mailing list — separate consent

`/mailing-list/` is intentionally separate from `/account/`.

- account + no mailing list: valid
- mailing list + no account: valid
- both: valid only through two separate deliberate actions

The form has an unticked required consent checkbox and honeypot. The browser calls
a Supabase Edge Function, which reads `BUTTONDOWN_API_KEY` from server-side secret
storage and submits the address to Buttondown. The private token never belongs in
browser code or GitHub.

The production Edge Function is deployed, but the Buttondown credential and real
subscriber/unsubscribe proof are still pending. `features.mailing.enabled` must
remain `false` until those gates pass.

## 4. Account deletion

The browser cannot safely hold administrative Supabase credentials. Self-service
deletion therefore invokes the deployed `delete-account` Edge Function, which
requires a valid JWT and performs the admin deletion at the trusted serverless
boundary. Profile/member rows cascade from the Auth identity.

Deleting an account does not implicitly alter a separate mailing subscription.

## 5. Offline/public estate

Accounts are optional. Do not inject mandatory Auth calls into individual games,
lessons, apps or tools. Existing local pupil data and offline experiences stay
local/offline unless a feature has an explicit separate sync design.

## 6. Release acceptance

Repository/static gates are not substitutes for provider proof. Before PR #99 can
leave Draft, complete the real registration/verification/login/recovery/deletion
lifecycle, User-A/User-B RLS isolation proof, two-clean-browser cross-device
member-data test, and real Buttondown subscribe/readback/unsubscribe test. See
`docs/ACCOUNTS_MAILING_SETUP.md` and the production provisioning status report.
