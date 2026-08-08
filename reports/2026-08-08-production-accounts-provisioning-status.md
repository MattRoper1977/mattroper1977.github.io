# Production accounts provisioning status — PR #99

Sentinel: `mbm-production-accounts-provisioning-pr99-2026-08-08`
Date: 2026-08-08

This report contains no passwords, session tokens, private API keys, subscriber addresses or service-role values.

## Product decisions

- Made by Matt accounts are intended for **adults and teachers**, not pupil account ownership.
- Pupils can use public Games, Lessons, Apps, Tools and Resources without an account.
- Mailing-list consent is separate from account creation.
- Mailing uses explicit unticked consent, Buttondown double opt-in, Buttondown as sender of record, and provider unsubscribe routes.

## Supabase — production provisioned

- Existing Made by Matt project reused in `eu-west-1`.
- `public.profiles` and `public.member_data` deployed with RLS.
- Own-row policies and least-privilege profile grants are installed.
- `update_member_data` uses optimistic version conflict handling.
- `delete-account` is ACTIVE with JWT verification.
- `subscribe-mailing-list` is ACTIVE and public by design; the Buttondown credential stays in Edge Function secret storage.
- `unsubscribe-mailing-list` is ACTIVE with JWT verification and derives the address from the authenticated Supabase identity.
- Both uppercase and the dashboard-compatible lowercase Buttondown secret name are accepted server-side; neither is exposed to the browser.

## Account/browser proof — PASSED

Matt completed the phone-only Codespaces QA path successfully:

- registration;
- email verification callback;
- login/logout;
- password recovery;
- member favourite write;
- isolated second-browser recovery of the same account-backed state;
- reverse-direction member change visibility.

## RLS isolation proof — PASSED

Rollback-only production tests used two temporary Auth identities with the real `authenticated` Postgres role and `auth.uid()` claim path.

Measured:

- A → own profile/member rows: **1 / 1**;
- A → B profile/member rows: **0 / 0**;
- A attempt to update B member row: **0 rows updated**;
- B → own profile/member rows: **1 / 1**;
- B → A profile/member rows: **0 / 0**.

All temporary rows were rolled back; cleanup readback measured 0 QA Auth users, profiles and member rows.

## Mailing provider proof — PASSED

The production Buttondown integration was exercised from GitHub-hosted infrastructure and independently checked through the Made by Matt mailbox/provider API.

Measured sequence:

1. The initial missing secret failed closed with HTTP 503.
2. An invalid first credential was identified by Buttondown HTTP 401 and replaced; no credential was exposed.
3. A valid credential then reached Buttondown but the server-to-server request was blocked by the provider firewall.
4. The production proxy was corrected to use Buttondown's documented `X-Buttondown-Bypass-Firewall: true` integration path for requests where no subscriber IP is collected/forwarded.
5. The previous broad error-text duplicate detector was removed because it could misclassify unrelated Buttondown 400 responses as success.
6. Real first-time subscription returned the uniform public success response.
7. A duplicate request returned the **same** status/body, preserving membership non-enumeration.
8. A real Buttondown confirmation email arrived at the disposable QA Gmail alias, independently proving subscriber creation and double opt-in delivery.
9. A separate disposable active subscriber was changed `regular → unsubscribed`; Buttondown readback confirmed `unsubscribed`.
10. QA subscribers were deleted afterwards so the production list starts clean.
11. Buttondown's current subscriber API names are used: `email_address` and `type`, with retrieve/update by email.

Buttondown's documented firewall-bypass path is provider-rate-limited. The proxy returns HTTP 429 honestly rather than reporting success when that limit is reached.

## Security repairs retained

- no browser/local password fallback;
- no committed service-role or Buttondown credential;
- no anonymous mailing membership enumeration;
- Buttondown failures fail closed rather than becoming false success;
- self-service unsubscribe is authenticated and cannot target another address;
- profile display-name writes use UPDATE, not an INSERT-requiring UPSERT;
- account deletion and mailing unsubscribe remain independent actions.

## Estate CI repairs

- PR #100 fixed stale Apex Sports/New Release verifier assumptions and merged separately.
- PR #101 fixed the Apex Rally verifier population/self-consistency assumptions and merged separately.
- Neither repair changed homepage/game content to satisfy a test.

## Release position

Provider proof is complete and `features.mailing.enabled` is now `true` on PR #99.

Remaining release sequence:

1. final clean CI on the permanent branch state;
2. mark PR #99 Ready and merge;
3. verify served production `/account/`, `/members/`, `/mailing-list/` and `/privacy/`;
4. prove self-service account deletion from the real production origin after deployment.

No post-merge production claim is made before that deployment occurs.
