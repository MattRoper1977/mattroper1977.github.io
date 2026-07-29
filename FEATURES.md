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
- Location is looked up client-side (ipwho.is → ipapi.co backup).
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

## 3. Accounts + members' area

- **Log in** button in the header; a **Members** page (`/members/`) with
  member-only bonus content, gated behind sign-in.
- **Today (no setup):** accounts are stored on the visitor's own device, with
  passwords hashed — nothing uploaded. Great for a preview.
- **Cloud mode (real, cross-device):** add Supabase keys and the same accounts
  work on any device, with password reset, email confirmation and a members
  table you control.

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
