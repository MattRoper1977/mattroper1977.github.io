# Phone test — PR #99 (Accounts / Members / Mailing)

Repo under test: **MattRoper1977/mattroper1977.github.io**
Branch: `agent/accounts-members-mailing-2026-08-08` (PR #99, Draft)

Every step below was checked against that branch's code. Where the original
walkthrough guessed, this one measured. Nothing here says "should work".

**Do not merge or un-draft PR #99 during this test.**

---

## Read this first (2 minutes, saves an evening)

**QA hygiene — not optional.**

- Use a **disposable email** you control the inbox of. Never a pupil's address,
  never a school address.
- Use a **password used nowhere else**. At least 10 characters — the code
  rejects anything shorter (`mbm-account.js:246`).
- The account you make **gets deleted in teardown**. It is not a real account.

**What this test covers:** sign-up, email verification, login, account-backed
member data, cross-device round-trip, logout, password reset.

**What this test does NOT cover, and why:**

- **The mailing list.** `site.json` has `features.mailing.enabled = false`.
  The mailing page will show a "not active yet" notice and **no form**. That is
  correct behaviour, not a fault. There is nothing to test until Matt
  provisions Buttondown.
- **Account deletion from this page.** The `delete-account` Edge Function only
  accepts requests from origins in `MBM_ALLOWED_ORIGINS`, which defaults to
  `https://madebymatt.uk` (`supabase/functions/delete-account/index.ts:6`). From
  a Codespaces address it returns **403 / a CORS error**. Expected. Teardown
  deletes the user from the Supabase dashboard instead.

**Roughly 25 minutes** if nothing goes wrong. You need: the phone, the
disposable inbox, the Supabase dashboard, and a second browser.

---

## STEP 1 — Start the server

Open the Codespace on `agent/accounts-members-mailing-2026-08-08`, open the
Terminal, and paste this:

```
python3 -m http.server 8080
```

**You should see:** `Serving HTTP on 0.0.0.0 port 8080 ...`

**If you see `command not found`:** try this instead, then carry on:

```
python -m http.server 8080
```

*(This repo is plain committed HTML — no Jekyll, no `_config.yml`, no Gemfile,
no front-matter. A plain static server is the correct tool. Checked.)*

---

## STEP 2 — The page loads at all

Open the **PORTS** tab, find port 8080, open its forwarded address in the phone
browser, and add `/account/` to the end.

**You should see:** the "One account, across your devices" heading, and a panel.

**If you see a file/folder listing instead:** you are not at the repo root.
Stop the server (Ctrl-C), `cd` to the repo root, go back to step 1.

**If you see the page but the top panel says "Account service setup is not
active yet":** `/site.json` is not being served or not being read. That is
step 1's problem — you are serving the wrong directory. Go back to step 1.

---

## STEP 3 — The account service reports itself configured

Look at the panel at the top of `/account/`.

**You should see:** the "Checking account availability…" panel **disappears**,
and login / create-account tabs appear.

That means the page read `/site.json`, found the Supabase project and the
publishable key, and connected. If this works, the hard part is over.

---

## STEP 4 — Make port 8080 Public

**This step is required, not optional.** The verification email sends the
session back as a **URL hash** (`#access_token=…`) — the code uses Supabase's
default implicit flow, confirmed in `auth-js` `GoTrueClient.js:24`. A URL hash
is never sent to a server, so if GitHub puts a sign-in page in the way when you
open the link from your mail app, **the hash is destroyed and you land on a
signed-out page with no error**. Making the port Public removes that
interstitial.

In the **PORTS** tab: long-press / right-click port 8080 → **Port Visibility**
→ **Public**.

**You should see:** the Visibility column change to `Public`.

**Honest trade:** while it is Public, anyone holding that URL can reach this
test server. It serves only this repo's public files, but the QA account you
are about to create is reachable from it. **Teardown sets it back to Private.**

---

## STEP 5 — Copy the forwarded address

Copy the port-8080 address. It looks like
`https://SOMETHING-8080.app.github.dev`.

Write it down. You need it twice, and if the Codespace is ever rebuilt this
address changes and you must redo step 6.

---

## STEP 6 — Add the two redirect URLs to Supabase

Supabase dashboard → **Authentication** → **URL Configuration** → **Redirect
URLs** → Add.

These are the only two the code ever asks for. Read out of
`assets/mbm-account.js` lines 252, 279 and 287 — not guessed.

Add this one:

```
https://PLACEHOLDER-CODESPACE-8080.app.github.dev/account/
```

And this one:

```
https://PLACEHOLDER-CODESPACE-8080.app.github.dev/account/?mode=recovery
```

Replace `PLACEHOLDER-CODESPACE` with your real address from step 5.

**You should see:** both entries listed. If a placeholder is still showing in
CAPITALS, you pasted it half-substituted — fix it now.

**Do not add a wildcard** like `https://*-8080.app.github.dev/**`. That domain
is shared by every GitHub user's forwarded ports, and a wildcard would let any
of them receive an auth redirect for this project.

---

## STEP 7 — Create the account

On `/account/`, tap **Create account**. Enter the disposable email and the
throwaway password (10+ characters). Submit.

**You should see:** *"Account created. Check your email to verify it, then
return here to log in."*

**If you see "An account already exists for that email":** you have run this
test before. Delete that user from Supabase first (teardown item 2), then retry.

---

## STEP 8 — The verification link comes back

Open the email on the phone and tap the verification link.

**You should see:** the `/account/` page, **signed in** — your email shown under
a circular avatar, with an "Open Members" button.

**If you land on a signed-out `/account/` page with no message:** the hash was
lost. Port 8080 is not Public — that is step 4's problem. Go back to step 4,
then use **Resend verification email** on the register tab and retry this step.

**If you see "That verification or password-recovery link has expired":** the
link is single-use and time-limited. Use **Resend verification email** and
retry this step.

**If you land on `madebymatt.uk` instead of your Codespace:** the redirect URLs
did not save. That is step 6's problem. Go back to step 6.

---

## STEP 9 — Save a choice

Tap **Open Members** (or go to `/members/`).

Tap the save button on **Games**.

**You should see:** *"Saved to your account."*

*(Use **Games**, **Tools** or **Resources**. The **Lessons** and **Apps** tiles
point at separate repos that are not present in this checkout — their links
404 locally. That is expected and is not a fault in PR #99. Saving them still
works; visiting them does not.)*

**If you see "Could not sync that change":** the browser reached Supabase but
the write was rejected. Note the exact message and stop — that is a real
finding, not a test-setup problem.

---

## STEP 10 — A second browser sees it

Open a **private/incognito window**, or a different browser entirely. Go to:

```
https://PLACEHOLDER-CODESPACE-8080.app.github.dev/members/
```

Log in with the same email and password.

**You should see:** **Games** already showing as saved.

**If Members says "Sign in to access your account" after you logged in:** the
login did not take. Go back to step 7 and confirm the account is verified.

---

## STEP 11 — The reverse direction

Still in the second browser, **un-save Games**, and save **Tools** instead.

Go back to the **first** browser and reload `/members/`.

**You should see:** Games no longer saved, Tools saved.

That proves writes travel both ways, not just outward from the first device.

---

## STEP 12 — The real falsifier

Steps 10 and 11 could in principle pass on cached local state. This step cannot.

In the **first** browser: clear site data for the Codespaces address
(browser settings → site settings → delete data), then reload `/members/` and
log in again.

**You should see:** **Tools** still saved.

If it survives a browser with its storage wiped, the data genuinely came back
from Supabase. **This is the step that actually proves cross-device sync.**

**If the favourite is gone:** the data was only ever local. That is a real
finding — record it and stop.

---

## STEP 13 — Log out

On `/account/`, tap **Log out**.

**You should see:** the login / create-account tabs return.

---

## STEP 14 — Password reset

On the login tab, tap **Forgot password?**, enter the QA email, submit.

**You should see:** *"If that address belongs to an account, check its inbox for
the reset link."*

Open the email, tap the reset link.

**You should see:** the **"Choose a new password"** panel on `/account/`.

Set a new password (10+ characters).

**You should see:** *"Password updated."*

**If the reset link lands on a normal signed-out page instead of the recovery
panel:** the second redirect URL (the `?mode=recovery` one) is missing or
mistyped. That is step 6's problem. Go back to step 6.

---

## STEP 15 — Teardown

Do all of these. A leftover QA redirect entry outlives the evening and nobody
remembers why it is there.

- [ ] **Supabase → Authentication → URL Configuration → Redirect URLs**: delete
      both `app.github.dev` entries added in step 6.
- [ ] **Supabase → Authentication → Users**: delete the QA user.
      *(Do this here, not from the Account page — the delete button returns 403
      from a Codespaces origin, as explained at the top.)*
- [ ] **Supabase → Table Editor**: confirm the QA rows are gone from
      `profiles` and `member_data`. They should have vanished with the user —
      both tables are `references auth.users(id) on delete cascade`
      (`supabase-schema.sql:14, 30`). If any row remains, delete it and tell
      someone, because the cascade did not fire.
- [ ] **PORTS tab**: set port 8080 back to **Private**.
- [ ] Stop the server (Ctrl-C) and **stop the Codespace**.
- [ ] Confirm PR #99 is still **Draft** and **unmerged**.

---

## If the Codespace address ever changes

A rebuilt or recreated Codespace gets a **new name**, which makes every Supabase
entry from step 6 stale — sign-up will bounce and you will get no useful error.

**If the address changed, go back to STEP 5** and redo steps 5 and 6 with the
new one. Delete the old entries while you are there.
