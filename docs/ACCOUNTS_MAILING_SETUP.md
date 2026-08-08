# Made by Matt accounts + mailing list — activation guide

Sentinel: `mbm-accounts-members-mailing-2026-08-08`

The repository now contains the browser UI, RLS schema, account-data merge logic,
account-deletion Edge Function, mailing subscription Edge Function, privacy copy
and permanent static validator. **The production account and mailing features are
deliberately fail-closed until the external services are configured.**

That is an infrastructure boundary, not an unfinished local-password fallback.

## 1. Supabase project — required for accounts

Create or select the Supabase project that will own Made by Matt identities.
Use an account controlled by the Made by Matt owner.

1. In Supabase SQL Editor, run `supabase-schema.sql` from this repository.
2. Confirm RLS is enabled for `public.profiles` and `public.member_data`.
3. Confirm the `on_auth_user_created` trigger exists.
4. Confirm `public.update_member_data(bigint,jsonb)` exists and can be executed
   by `authenticated`, not `anon`.
5. In Authentication settings, set the Site URL to `https://madebymatt.uk`.
6. Add these redirect URLs (or the provider's equivalent allow-list):
   - `https://madebymatt.uk/account/`
   - `https://madebymatt.uk/account/?mode=recovery`
7. Keep email confirmation enabled unless there is a documented reason not to.
8. Copy the **project URL** and **browser/public anon key** into the two public
   fields in `site.json`:

```json
"accounts": {
  "enabled": true,
  "provider": "supabase",
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabaseAnonKey": "YOUR-PUBLIC-BROWSER-KEY",
  "legacyLocalFallback": false
}
```

The URL and browser key are public configuration by design. They are not admin
credentials. RLS is what prevents one authenticated user reading another
member's row.

### Never put these in `site.json` or JavaScript

- `SUPABASE_SERVICE_ROLE_KEY`
- database password
- SMTP password
- OAuth client secret
- any user's password
- access/refresh tokens copied from a browser session

## 2. Deploy self-service account deletion

Deploy `supabase/functions/delete-account` to the same Supabase project. It must
retain JWT verification.

Set this Edge Function environment value if you want to allow additional
production origins:

```text
MBM_ALLOWED_ORIGINS=https://madebymatt.uk
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` to its hosted function environment. The service-role
key is used only inside the deletion function and must stay secret.

After deployment, test with a disposable QA account. The browser must not
receive the service-role key at any point.

## 3. Buttondown — required for the mailing list

Create or select the Made by Matt Buttondown newsletter and make
`contactmadebymatt@gmail.com` the appropriate owner/administrative contact.
Keep Buttondown's double-opt-in/confirmation flow and unsubscribe mechanism.

Create a Buttondown API key for the subscription function. Store it only as a
Supabase Edge Function secret:

```text
BUTTONDOWN_API_KEY=<private value>
MBM_ALLOWED_ORIGINS=https://madebymatt.uk
```

Deploy `supabase/functions/subscribe-mailing-list` using the repository's
`supabase/config.toml`. That function is intentionally public (`verify_jwt =
false`) because a visitor does not need a Made by Matt account to subscribe. It
still requires explicit consent, uses a honeypot, restricts browser CORS to the
configured origin, returns normalized errors, and never puts the provider token
in frontend code.

Once a real subscription and confirmation have been proven, switch:

```json
"mailing": {
  "enabled": true,
  "provider": "buttondown",
  "functionName": "subscribe-mailing-list",
  "adminContact": "contactmadebymatt@gmail.com"
}
```

Account creation and mailing consent remain independent.

## 4. Required QA before calling the work complete

Use disposable non-personal identities only.

### Account flow

- Create a new account.
- Confirm the email if confirmation is enabled.
- Log in with correct credentials.
- Confirm incorrect credentials are denied.
- Request a password-reset email and complete a password change.
- Log out and confirm account-backed member data is no longer readable.
- Delete a disposable account and confirm Auth + profile + member row are gone.

### Authorization

Create User A and User B. From User A's authenticated browser, attempt to query
User B's `profiles` and `member_data` rows directly. RLS must return no row / deny
the operation. A browser-supplied UUID is never authority by itself.

### Cross-device proof — mandatory

1. Browser Context A: log in as the disposable QA user.
2. In `/members/`, save one hub shortcut.
3. Record only redacted evidence: timestamp, anonymous QA user id fragment and
   saved path. Do **not** record the password or session token.
4. Close Context A.
5. Launch clean Browser Context B with no copied localStorage.
6. Log in to the same account normally.
7. Confirm the saved shortcut appears from `member_data`.
8. Change another shortcut in B, return to A/reload, and confirm the merged
   account state does not silently discard the newer record.

### Mailing proof — mandatory

- Submit a valid disposable email with consent checked.
- Confirm the browser receives `pending_confirmation`, not a fake success.
- Confirm the subscriber appears in Buttondown in its confirmation/pending
  state, then complete confirmation.
- Repeat with the same address and confirm a safe already-subscribed result.
- Test invalid email, unticked consent, honeypot, provider/network failure and
  rate/anti-abuse behaviour.
- Use the provider unsubscribe link and confirm the subscriber can genuinely
  leave the list.

### Production

Verify served URLs, not only repository files:

- `https://madebymatt.uk/`
- `https://madebymatt.uk/account/`
- `https://madebymatt.uk/members/`
- `https://madebymatt.uk/mailing-list/`
- `https://madebymatt.uk/privacy/`

Check phone widths 320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS px.

## 5. What deliberately remains device-local

- reading/background preference
- existing UAS/ASDAN pupil records, marks and evidence
- standalone/offline content caches
- legacy local account record until the user explicitly removes it
- existing local game saves (the account system does not blindly upload every
  `localStorage` value)

The first genuine account-backed member dataset is intentionally narrow:
optional display name + saved Made by Matt hub shortcuts.
