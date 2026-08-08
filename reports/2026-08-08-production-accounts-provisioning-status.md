# Production accounts provisioning status

Sentinel: `mbm-production-accounts-provisioning-pr99-2026-08-08`
Date: 2026-08-08
PR: #99

This is safe operational evidence only. It intentionally contains no passwords,
session tokens, private API keys, subscriber addresses or service-role values.

## Supabase — provisioned

- Existing Made by Matt Supabase organisation reused; no duplicate production project created.
- Organisation plan: Free.
- Production region: `eu-west-1` (London).
- Project state at provisioning: healthy.
- Public project URL + provider publishable browser key connected in `site.json`.
- `legacyLocalFallback` remains `false`.
- Production migration `mbm_accounts_members_production` applied.
- `public.profiles` and `public.member_data` exist with RLS enabled.
- Own-row SELECT/INSERT/UPDATE/DELETE policies are installed for the account data model.
- `public.update_member_data` is SECURITY INVOKER and retains optimistic version-conflict handling.
- Trigger helper `public.handle_new_user` is not directly executable by public/browser roles.
- Profile browser grants are column-restricted so a user cannot promote their own `tier`.
- `delete-account` Edge Function deployed ACTIVE with JWT verification enabled.
- `subscribe-mailing-list` Edge Function deployed ACTIVE with JWT verification disabled by design for public opt-in; its Buttondown credential remains server-side-only and is not yet provisioned.
- Supabase security advisor: no findings after schema deployment.
- Supabase performance advisor: no findings after schema deployment.

## Still blocked from production acceptance

The available Supabase administration connector does not expose Auth Site URL /
redirect allow-list configuration, Auth email-flow administration, or Edge
Function secret management. No authenticated Buttondown administration connector
is available.

Therefore these release gates are deliberately still unclaimed:

1. Configure Supabase Auth Site URL `https://madebymatt.uk` and allow the account
   and recovery callback URLs required by the client.
2. Confirm email verification is enabled as intended.
3. Create/select the real Buttondown newsletter administered for
   `contactmadebymatt@gmail.com`, generate its private API credential and store it
   as the Supabase Function secret `BUTTONDOWN_API_KEY`.
4. Run real registration, email verification, login/logout and password-recovery
   flows.
5. Run User A / User B negative authorization proof using real Auth sessions.
6. Run two isolated browser contexts for the mandatory cross-device member-data
   round trip.
7. Prove Buttondown subscribe/pending-or-confirmed readback, duplicate handling
   and unsubscribe, then and only then set `features.mailing.enabled=true`.
8. Run final mobile/accessibility/live-production checks after merge.

PR #99 must remain Draft until those provider-dependent proofs are complete.
Mailing remains disabled and no frontend success state substitutes for Buttondown
readback.
