# Made by Matt — site features & setup

This file describes the production architecture after the account restoration
work identified by `mbm-accounts-members-mailing-2026-08-08`.

The important rule is now simple: **cloud identity fails closed**. The public
site continues to work when external services are missing, but the account UI
does not create a device-local password as a fallback.

Core files:

| File | Purpose |
|---|---|
| `assets/mbm-features.js` | Existing counters/stats/download feature layer; contains legacy auth code but no longer owns the account journey |
| `assets/mbm-account.js` | Cloud-only Supabase account client + member-data sync |
| `assets/mbm-mailing.js` | Separate mailing-list form client |
| `assets/mbm-platform.js` | Shared professional nav; discovers Account and, once enabled, Mailing list |
| `account/index.html` | Register, login, logout, reset/recovery, profile and deletion UI |
| `members/index.html` | Auth-aware Members area + account-backed favourites |
| `mailing-list/index.html` | Explicit mailing opt-in; not tied to account creation |
| `supabase-schema.sql` | Profiles/member data, RLS, trigger and optimistic conflict function |
| `supabase/functions/delete-account/` | Authenticated server-side Auth user deletion |
| `supabase/functions/subscribe-mailing-list/` | Public subscription proxy; Buttondown key remains server-side |
| `docs/ACCOUNTS_MAILING_SETUP.md` | Exact external activation and production QA steps |

## Configuration (`site.json`)

```json
"accounts": {
  "enabled": true,
  "provider": "supabase",
  "supabaseUrl": "",
  "supabaseAnonKey": "",
  "legacyLocalFallback": false
},
"mailing": {
  "enabled": false,
  "provider": "buttondown",
  "functionName": "subscribe-mailing-list",
  "adminContact": "contactmadebymatt@gmail.com"
}
```

The blank values are intentional until a real project is connected and tested.
`legacyLocalFallback:false` documents the security boundary: missing Supabase
configuration never means "store a password in localStorage instead".

## 1. Live visitor stats

The existing counter feature remains independent of accounts. Homepage/stats
counter behaviour is unchanged by this project.

## 2. Open / download counts

The existing `data-mbm-count` and `downloads.catalog` system remains unchanged.
Accounts are not required to increment or view public resource/game counters.

## 3. Accounts + Members — cloud-only identity

The previous estate had two incompatible ideas at once:

1. a device-local account whose password hash lived in browser storage; and
2. dormant Supabase code/config slots intended for a real cloud account.

The local account could create separate game save slots, but it could not reset a
password or follow a person to another device. It was therefore not suitable for
the cross-device requirement.

The canonical account journey is now `/account/` using `assets/mbm-account.js`.
It supports, once Supabase is configured:

- email registration
- email confirmation/provider verification state
- login/logout
- password-reset email
- recovery-link password update
- persistent provider-managed session
- optional display name
- self-service account deletion through a server-side Edge Function
- RLS-protected member data
- cross-device Members favourites

### No homemade password system

The browser never performs a password hash, stores a password/hash, or compares a
credential itself. Supabase Auth owns the password. Supabase's browser session
persistence is provider-managed; Made by Matt does not copy session tokens into a
custom storage key.

### Offline identity hint is not authorization

`mbm_cloud_identity_v1` may contain only account id/email/display-name as a local,
non-secret hint for standalone games to keep choosing a familiar local save
slot. It does not grant database access. Real member data still requires a
valid Supabase session and RLS.

### Members data and conflict handling

`public.member_data` initially stores only deliberately account-specific data:
Made by Matt saved hub shortcuts. Each favourite carries its own timestamp.
Writes use optimistic row versioning through `update_member_data`; if another
device wrote first, the stale client refetches, merges per item, and retries
instead of silently deleting the newer server copy.

Reading/background theme remains a device preference. Pupil registers, marks,
evidence and similar classroom records are not swept into the account.

### Existing local users

The old `mbm_users` / `mbm_session` record is not silently destroyed and its
password hash is never uploaded. Account settings may copy only a legacy display
name after the user chooses to do so. Existing local game saves remain on disk.
When old and new accounts use the same email, the game save-slot tag can remain
stable on that device.

## 4. Mailing list — separate consent

`/mailing-list/` is intentionally separate from `/account/`.

- account + no mailing list: valid
- mailing list + no account: valid
- both: valid, through two separate actions

The form has an unticked required consent checkbox and a honeypot. Once enabled,
it calls a Made by Matt Supabase Edge Function. That function reads
`BUTTONDOWN_API_KEY` from server-side secret storage and submits the address to
Buttondown. The private token never reaches the browser or GitHub.

Buttondown's confirmation and unsubscribe mechanisms are retained. The Made by
Matt administrative contact is `contactmadebymatt@gmail.com`.

The mailing feature stays `enabled:false` until the provider and live
subscription/unsubscribe proof exist. This avoids a fake success state.

## 5. Account deletion

The browser cannot safely hold a Supabase service-role key. Self-service deletion
therefore calls `supabase/functions/delete-account`, which validates the signed-in
user and performs the admin deletion server-side. `profiles` and `member_data`
rows cascade from the Auth identity.

Deleting an account does not implicitly change a separate mailing subscription.

## 6. Separate encrypted game-save sync

`assets/mbm-sync.js` remains a separate legacy-capable design for encrypted game
save syncing. It is not the identity-backed member store and must not be described
as account sync. Its own configuration remains off until separately proven.

## 7. Analytics and donations

Existing optional analytics configuration, donation links and site counters are
outside the account/mailing scope and remain independent.

## Activation and proof

Do not call the account/mailing project production-complete from repository code
alone. Follow `docs/ACCOUNTS_MAILING_SETUP.md`, then perform the two-browser
cross-device test, RLS User-A/User-B isolation test, password-reset test, account
deletion test, real Buttondown subscription/confirmation/duplicate/unsubscribe
tests, and live mobile checks.

The permanent repository gate is:

```bash
node tools/verify_accounts_members_mailing.js
```

It includes a positive control that injects a fake localStorage password write
and proves the security scan rejects it.
