# Made by Matt — site features & setup

This note covers the features added to the site and how to switch on the
"real" cloud versions. **Everything works right now with zero setup** (in a
private, on-device mode) and **auto-upgrades to the cloud the moment you paste
your keys** into `site.json`. Nothing breaks if a service is missing or down.

Files that power it all:

| File | What it does |
|---|---|
| `assets/mbm-features.js` | All the logic (stats, counters, accounts, analytics) |
| `assets/mbm-features.css` | Styling (uses the site's `--dx-*` theme tokens) |
| `site.json` → `"features"` | The control panel — switches and keys |
| `members/index.html` | The members' area (gated behind sign-in) |
| `stats/index.html` | The on-site analytics dashboard |
| `supabase-schema.sql` | One-time database setup for cloud accounts |

### The control panel (`site.json`)

```json
"features": {
  "stats":     { "enabled": true, "namespace": "madebymatt-uk", "geo": true, "roster": ["GB","US", ...] },
  "downloads": { "enabled": true, "catalog": [ { "key": "uas-register", "title": "UAS Register" }, ... ] },
  "accounts":  { "enabled": true, "provider": "auto", "supabaseUrl": "", "supabaseAnonKey": "" },
  "analytics": { "goatcounter": "" }
}
```

---

## 1. Live visitor stats — "around the world"

On the homepage and on the **Stats** page: total visits, countries reached, a
country leaderboard with flags, and the visitor's own approximate location.

- Shared tallies live in a free, keyless counter service (counterapi.dev).
- ~~Location is looked up client-side (ipwho.is → ipapi.co backup).~~ **Not true
  since at least 2026-08-02.** Neither host appears anywhere in any shipped
  JavaScript — `git grep ipwho.is` and `git grep ipapi.co` both return zero
  files. No geolocation lookup happens. Left struck through rather than
  deleted so the correction is visible to anyone who read the old claim.
- **Privacy:** only anonymous country tallies leave the browser; IP addresses
  are never stored by the site. Falls back to on-device numbers if offline.

Tune the country board via `roster`, or set `"geo": false` / `"enabled": false`.

---

## 2. Open / download counts

Every homepage card shows a live badge ("214 opened", "1,580 plays"). To count
any other link/button anywhere on the site:

```html
<a href="/some/file.pdf" data-mbm-count="my-worksheet">Download</a>
<span class="mbm-hits" data-mbm-count-for="my-worksheet"></span> downloads
```

Add the same `{ "key": "my-worksheet", "title": "My worksheet" }` to
`downloads.catalog` in `site.json` and it also appears on the Stats dashboard.

---

## 3. Accounts + members' area — REMOVED (2 August 2026)

`site.json` → `features.accounts.enabled` is **`false`**, *and* the whole
visitor-facing surface has been taken out of the markup: the Log in button, the
sign-in modal and its password field, the members gate and signed-in area, the
member badge, the homepage account band, the two `zone:"account"` doors and the
`/uas/` and `/voxel/` sync-offer banners. `/members/` is an honest page saying
there is nothing to sign in to.

**The reversal is no longer one line.** The paragraphs below were written when
this was a switched-off flag, and they say a boolean restores everything. That
is no longer true: flipping `enabled:true` now reveals markup that does not
exist. Restoring accounts means reverting the removal commit *and then*
flipping the flag. The module itself — `MBMAuth`, both backends,
`supabase-schema.sql`, `initAccountUI()` — is untouched and still fail-closed.

**Why, since this section used to claim the opposite.** It said the members
page had "member-only bonus content, gated behind sign-in". It never did. The
members page itself said "there are no member-only features yet" in three
separate places, and the one thing it offered — commissioned resources — said
in its own copy that signing in does not unlock it. So the account gated
nothing.

What it did do was ask for a password. That password was salted, SHA-256'd and
written to `localStorage`; it never left the device, and by the local backend's
own admission it could never be reset:

```js
resetPassword: function () { return Promise.reject("Password reset needs cloud accounts — set those up to enable it."); }
```

A password that guards nothing, cannot be recovered, and protects a record
already readable by anyone holding the device is not a feature. Its only real
effect is to invite a visitor to reuse a password they use elsewhere. The
Supabase path was never switched on — the key slots have been empty since
`b70dc24` — so this was the only mode that ever ran.

**The module was not deleted.** `MBMAuth`, the local backend, the Supabase
backend, `supabase-schema.sql` and `initAccountUI()` are all still here and
still work; `initAccountUI()` already returns early when `#mbmAccountBtn` and
`#mbmAuth` are absent, which is why removing the markup broke nothing.

~~The flag takes down the entry points, so this is a one-line reversal, not a
rebuild.~~ **No longer true** — see the note at the top of this section. The
markup is gone, so the flag alone restores nothing.

### What an account will be for — built, dormant, waiting on one thing

The offer is built and sitting in the repo. It is **sync, not gating**, and the
reason is worth stating because the obvious idea does not work here.

**You cannot put a file behind a login on this site.** GitHub Pages is static —
there is no server to check who anyone is. `/voxel/index.html` and
`/uas/app.html` answer a plain `curl` with HTTP 200 and the whole file, no
JavaScript involved, and `/uas/` is in `sitemap.xml` with `robots.txt` saying
`Allow: /`. Any "members only" check written in JavaScript runs *after* the
browser already has the page. It is a curtain in front of an open door whose
address is published.

So nothing is gated. The account does something the site genuinely cannot do
without one: it stops your work being stranded on one machine.

| surface | offer |
|---|---|
| homepage `account` band | two cards, hidden until sync works |
| `/voxel/` banner | your worlds open on any device you sign in on |
| `/uas/` banner | your **unit setup** follows you |

**Pupil data deliberately does not sync.** `uas_register` (IndexedDB, v2) has
stores `pupils`, `units`, `marks`, `sessions`, `kv`, `evidence`. Only `units`
and `kv` — your unit definitions and preferences — are in scope. `pupils`,
`marks`, `sessions` and `evidence` stay on the device and are never uploaded.

That is not caution for its own sake. Those stores hold named children, their
marks, and evidence photographs. Uploading them would move identifiable pupil
data to a third-party service, contradict what both register tools currently
promise in their own copy ("records stay on your device", "nothing uploaded"),
and turn a technical choice into a data-protection one needing a processor
agreement and, in a school, a DPIA. The cards say the limit out loud rather
than quietly observing it — "Your setup, not your pupils".

Voxel Frontier is plain `localStorage` (`voxelfrontier.world.v2.*`,
`.save.v1`, `.lastseed.v1`, `.prefs.v1`) with no personal data in it, so worlds
sync whole.

#### Why none of it is visible yet

Every surface is bound to a **capability**, not to configuration:

```
window.MBM_CAPS["cloud-sync"]
```

A door in `site.json` can declare `"requires": "cloud-sync"`, and
`mbm-doors.js` defers it until that capability is present — publishing
`data-doors-deferred` so the count stays honest. The band hides itself when
every door in it deferred. The two tool-page banners check the same flag and
ship `hidden` with an inline `display:none`, because those pages do not load
`styles.css`.

**Nothing sets `cloud-sync` yet**, so nothing renders. That is the design, not
an outage. The register that flag lives in draws a distinction that is easy to
lose:

1. `site.json` has Supabase keys — *configuration*
2. the Supabase client authenticated — *connection*
3. a write-then-read-back round-trip succeeded — *capability*

Only (3) justifies telling a teacher their work is being kept safe. A backup
that silently fails is worse than no backup, because they stop making their
own copies.

#### What is left to build

The sync module itself, which must:

- write and read back a test record before ever setting `cloud-sync`
- sync `units` + `kv` from `uas_register`, and the four `voxelfrontier.*`
  localStorage keys — nothing else
- resolve conflicts by last-write-wins per key, with the losing copy kept
- report failure visibly rather than falling silent

It is not written because it needs a live Supabase project to build and verify
against, and shipping untested network code that claims to protect a teacher's
records would be exactly the failure mode above. **Paste keys in (below) and it
becomes buildable and testable.**

### Turning accounts back on

Set `"enabled": true`. That restores exactly what was there before —
device-only accounts with a password that still cannot be reset. **If you want
accounts, do the cloud setup below at the same time**, because cloud mode is
the version where the password buys something: real reset, email confirmation,
and the same account on every device.

And before either: decide what sign-in is *for*. If the answer is still "no
member-only features yet", leave it off.

### Switching on real cloud accounts (Supabase — free tier)

1. Create a free project at **https://supabase.com** (New project).
2. In the dashboard: **SQL Editor → New query →** paste the contents of
   `supabase-schema.sql` → **Run**. (Creates the `profiles` table + security.)
3. **Project Settings → API →** copy the **Project URL** and the **anon public**
   key. *(The anon key is safe to put in client code — it's protected by the
   row-level security from step 2.)*
4. Paste both into `site.json`:
   ```json
   "accounts": { "enabled": true, "provider": "auto",
     "supabaseUrl": "https://YOURPROJECT.supabase.co",
     "supabaseAnonKey": "eyJhbGci..." }
   ```
5. (Optional) **Authentication → URL Configuration →** set the Site URL to
   `https://madebymatt.uk` so confirmation/reset emails link back correctly.
6. Commit & push. Done — `provider: "auto"` detects the keys and every page
   now uses real cloud accounts. Remove the keys to drop back to device mode.

**Managing members:** see everyone in **Authentication → Users**; change a
tier (member / supporter / patron) in the SQL editor — the file has the exact
command at the bottom. Gate future bonus downloads on tier via a Supabase
Storage policy or an RLS-protected table.

---

## 4. Analytics dashboard

`/stats/` is a live, on-site dashboard: visits, countries reached, total
opens/plays and the most-opened resources — all from the counters above, so it
needs no setup.

For deeper analytics (top pages, referrers, browsers, trends over time), add a
free, privacy-friendly **GoatCounter** account:

1. Sign up at **https://www.goatcounter.com** and pick a code, e.g. `madebymatt`
   (your dashboard is then `https://madebymatt.goatcounter.com`).
2. Put the code in `site.json`:
   ```json
   "analytics": { "goatcounter": "madebymatt" }
   ```
3. Commit & push. Page-view tracking switches on site-wide automatically, and
   the Stats page links straight to your GoatCounter dashboard.

*(Prefer Plausible or Fathom? Same idea — swap the small `initAnalytics()`
snippet in `mbm-features.js` for their script tag.)*

---

## 5. Donations

The homepage footer has a warm donation pitch with three tiers — **from 50p**,
from £20, and from £50 — where a donation earns a bespoke set of resources,
lessons and tools scaled to the amount. Edit the wording/amounts directly in
`index.html` (search for `mbm-give`).

---

## Design notes

- The three systems (stats, accounts, analytics) are independent — swap or
  remove any one without touching the others.
- Every feature has a graceful fallback, so the live site never shows a broken
  widget, even with no keys configured and no network.

*Questions or changes — just ask.*
