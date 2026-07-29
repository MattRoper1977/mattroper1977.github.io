# Made by Matt — new site features

This note explains the features added to the homepage (`index.html`) and how to
adjust or upgrade them. Everything is designed to run on **GitHub Pages with no
server of its own**, and to fail gracefully so the page never breaks.

All of it is driven by two files plus a small config block:

- `assets/mbm-features.js` — the logic
- `assets/mbm-features.css` — the styling (uses the site's existing `--dx-*` theme tokens)
- `site.json` → `"features"` — the switches (turn things on/off, tune the country list)

```json
"features": {
  "stats":     { "enabled": true, "namespace": "madebymatt-uk", "geo": true, "roster": ["GB","US", ...] },
  "downloads": { "enabled": true },
  "accounts":  { "enabled": true }
}
```

---

## 1. Live visitor stats — "around the world"

Shown in the **Live · around the world 🌍** section.

- **Total visits worldwide** and **countries reached** — a running count of every
  page view.
- **Where visitors come from** — a live leaderboard of countries with flags and bars.
- **"You're visiting from …"** — the current visitor's approximate location.

**How it works.** GitHub Pages can't count anything itself, so the shared tallies
live in a free, keyless public counter service ([counterapi.dev](https://counterapi.dev)).
Each visit bumps a global counter and a per-country counter; the numbers are read
straight back out. The visitor's rough location comes from a client-side lookup
([ipwho.is](https://ipwho.is), with [ipapi.co](https://ipapi.co) as a backup).

**Privacy.** Only anonymous country tallies ever leave the browser. A visitor's IP
address is **never** stored by this site — it's only used, in the visitor's own
browser, to work out which country to credit. This is stated plainly under the widget.

**If a service is ever down or blocked,** the widget quietly falls back to an
on-device tally so it always shows something sensible.

### Tuning it
- Add/remove countries shown on the board via the `roster` list in `site.json`.
  (The visitor's own country is always added automatically, even if not listed.)
- Set `"geo": false` to stop the location lookup.
- Set `"enabled": false` to hide the whole section.

---

## 2. Open / download counts

Each card on the homepage shows a small badge — e.g. **"214 opened"**,
**"1,580 plays"**. The number goes up when someone clicks through, using the same
counter service as the stats.

### Adding a counter to any link, anywhere on the site
1. Put a key on the link/button you want to count:
   ```html
   <a href="/some/file.pdf" data-mbm-count="my-worksheet">Download</a>
   ```
2. (Optional) Show the number wherever you like:
   ```html
   <span class="mbm-hits" data-mbm-count-for="my-worksheet"></span> downloads
   ```
3. Make sure the page loads the script: `<script src="/assets/mbm-features.js"></script>`
   (and the stylesheet, if you want the badge styling).

Keys are lower-case letters, numbers and hyphens. Use a **unique key per file**.

---

## 3. Optional accounts

A **Log in** button sits in the header. Visitors can create an account and log in;
when signed in, the header greets them and a "member" note appears. The sign-up box
says plainly that **bonus features are coming soon for account holders**.

**How it works today.** Accounts are stored **on the visitor's own device**
(browser `localStorage`), with the password **hashed** (SHA-256) — never stored or
uploaded in plain text. This matches the rest of the site's "nothing uploaded"
promise, and it works with zero backend.

**Limitation to be aware of.** Because accounts are device-local, they don't yet
follow a person between devices, and you (Matt) can't see a list of members. That's
the natural next step — see below.

---

## Upgrading later (when you're ready for real, cross-device accounts + member bonuses)

The current setup is deliberately zero-maintenance. When you want proper cloud
accounts and a members' area, the tidiest options are:

- **Supabase** or **Firebase** (both have generous free tiers) for real sign-in,
  a members table, and gated bonus content. You'd drop your project keys into
  `site.json` and swap the `Accounts` block in `mbm-features.js` for their SDK calls.
- For analytics with a nicer dashboard than counterapi, **GoatCounter** or
  **Plausible** (privacy-friendly, EU-hosted) give you a proper stats page. The
  on-page "around the world" widget can keep using counterapi, or read from their
  APIs.

The code is organised so each of these (stats, downloads, accounts) can be swapped
independently without touching the rest of the page.

---

*Questions or changes — just ask.*
