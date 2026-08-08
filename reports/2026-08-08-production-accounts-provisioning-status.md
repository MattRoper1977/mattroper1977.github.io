# Production accounts provisioning status — PR #99

Sentinel: `mbm-production-accounts-provisioning-pr99-2026-08-08`
Date: 2026-08-08

This is safe operational evidence only. It intentionally contains no passwords,
session tokens, private API keys, subscriber addresses or service-role values.

## Product decisions now settled

- Made by Matt accounts are intended for **adults and teachers**, not pupil account ownership.
- Pupils can continue to use public Games, Lessons, Apps, Tools and Resources without an account.
- The mailing list is independent from account creation.
- Mailing policy is explicit unticked consent, **double opt-in**, Buttondown as sender of record, and a provider unsubscribe route on messages.

## Supabase — provisioned

- Existing Made by Matt Supabase organisation reused; no duplicate production project created.
- Organisation plan: Free.
- Production region: `eu-west-1` (London).
- Project state at provisioning: healthy.
- Public project URL + provider publishable browser key connected in `site.json`.
- `legacyLocalFallback` remains `false`.
- Production migration `mbm_accounts_members_production` applied.
- `public.profiles` and `public.member_data` exist with RLS enabled.
- Own-row policies are installed for the account data model.
- `public.update_member_data` is SECURITY INVOKER and retains optimistic version-conflict handling.
- Trigger helper `public.handle_new_user` is not directly executable by public/browser roles.
- Profile browser grants are column-restricted so a user cannot promote their own `tier`.
- `delete-account` Edge Function is ACTIVE with JWT verification enabled.
- `subscribe-mailing-list` Edge Function is ACTIVE; version 2 removes the anonymous membership-enumeration oracle by returning the same public success state for first-time and duplicate requests.
- `unsubscribe-mailing-list` Edge Function is ACTIVE with JWT verification enabled and derives the address from the authenticated Supabase identity rather than request body data.
- Supabase security advisor reported no findings after schema deployment.
- Supabase performance advisor reported no findings after schema deployment.

## Account proof completed

Matt completed the corrected phone-only Codespaces QA path against PR #99 and reported successful:

- registration
- email verification callback
- login/logout
- password recovery
- member favourite write
- isolated second-browser recovery of the same account-backed state
- reverse-direction member change visibility

The Codespaces test requires a Public forwarded port while Supabase Auth uses the implicit URL-hash callback flow, otherwise GitHub's private-port interstitial can consume the hash before the application receives it.

### Production RLS isolation proof — PASSED

The production database boundary was exercised in rollback-only transactions using two temporary Auth identities and the real `authenticated` Postgres role plus `request.jwt.claim.sub`, which is what `auth.uid()` reads.

Measured results:

- User A read its own `profiles` row: **1**
- User A read User B's `profiles` row: **0**
- User A read its own `member_data` row: **1**
- User A read User B's `member_data` row: **0**
- User A attempted to update User B's `member_data`: **0 rows updated**
- User B read its own `profiles` row: **1**
- User B read User A's `profiles` row: **0**
- User B read its own `member_data` row: **1**
- User B read User A's `member_data` row: **0**

Every transaction was rolled back. A cleanup readback immediately afterwards measured **0 Auth users, 0 profiles and 0 member rows**, so the RLS proof left no QA identities or account data behind.

## Security repairs after review

### Mailing membership enumeration

The public subscription endpoint no longer returns a distinguishable `already_subscribed` state. A first-time request and duplicate request receive the same public response so an unauthenticated caller cannot use the endpoint to test whether a specific address is subscribed.

### Self-service unsubscribe

A JWT-verified `unsubscribe-mailing-list` Edge Function now derives the email address from the authenticated Supabase identity rather than accepting an address from the browser. The Account page exposes the corresponding signed-in control. Account deletion and mailing unsubscribe remain independent actions.

### Display-name privilege mismatch

The browser previously used `profiles.upsert(...)` even though authenticated users intentionally have no INSERT grant on `profiles`. That was a real least-privilege mismatch. It is now fixed by using an ownership-filtered `UPDATE` on the trigger-created profile row; database grants remain narrow and unchanged. A permanent positive control rejects a regression back to UPSERT.

## Estate verifier repairs completed separately

- PR #100 repaired the stale Apex Sports/New Release tenant allow-list by deriving the additive stack contract. It merged with the Apex Sports publication, AGX-1, professional design and live checks green.
- PR #101 repaired the Apex Rally verifier's false assumption that the curated five-card homepage Apex Sports strip must equal the broader manifest `collection: Sports`. Its Rally surface gate, including the log self-consistency check, passed before merge.
- Neither repair changes homepage/game content; both remove verifier drift that pre-dated #99.

## Real mailing-provider probe — BLOCKED AT SECRET, NOT NETWORK

A one-shot GitHub Actions probe was run from a hosted runner using only the public Supabase project URL/publishable key and a disposable Gmail plus-address under the Made by Matt mailbox. This was deliberately chosen to distinguish provider configuration from the earlier local-container egress limitation.

Measured result:

- the GitHub runner reached the deployed `subscribe-mailing-list` Edge Function;
- a consented real subscription request returned **HTTP 503** immediately;
- the deployed function returns that 503 before contacting Buttondown when `BUTTONDOWN_API_KEY` is absent;
- therefore the current production blocker is the missing Supabase Edge Function secret, not GitHub-runner network access;
- no Buttondown confirmation was expected or claimed because the function stopped before the provider call;
- the temporary probe workflow/trigger was removed after the result.

Mailing remains `enabled:false` and no provider lifecycle is claimed as passed.

## Remaining production acceptance work

The account data-isolation gate and inherited estate CI blockers are now complete. PR #99 remains Draft only for provider/deployment-dependent acceptance that must not be fabricated:

1. store the real Buttondown credential as the Supabase Edge Function secret `BUTTONDOWN_API_KEY`, then rerun subscribe → confirmation/readback → duplicate → unsubscribe proof;
2. only after that provider lifecycle passes, set `features.mailing.enabled=true`;
3. review final CI against the current main branch;
4. mark PR #99 Ready and merge;
5. after deployment, prove self-service account deletion from the real production origin and verify the served `/account/`, `/members/`, `/mailing-list/` and `/privacy/` surfaces on mobile/accessibility checks.

No unproven provider-dependent gate is claimed as complete.
