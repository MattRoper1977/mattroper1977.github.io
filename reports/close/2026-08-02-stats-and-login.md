# Close: the GoatCounter pill, and where the login went — 2 August 2026

Two questions from a phone screenshot of `/stats/`. One was a rendering defect.
The other turned out to have a factual answer nobody could reach.

---

## 1. The GoatCounter pill

**What Matt saw:** the words *"GoatCounter"* rendered as a large amber lozenge in
the middle of a sentence, in amber text, effectively unreadable.

**Root cause, one line.** `stats/index.html:38`

```css
.sx-gc a{ …background:var(--dx-amber);border-radius:999px;padding:.65rem 1.2rem… }
```

That rule matched **every** link in the panel. The panel has two mutually
exclusive branches:

- **configured** → `<p>…</p><a>Open GoatCounter →</a>` — a standalone call to
  action, a **direct child**. The rule is correct here.
- **not configured** → `<p>… <a>GoatCounter</a> code to site.json …</p>` — an
  **inline link inside running text**. The rule is catastrophic here.

Matt's site has no GoatCounter code, so he only ever sees the second branch.

**Measured, not eyeballed** — computed styles read back from the rendered page:

| | branch | rendered as | colour on background | contrast |
|---|---|---|---|---|
| before | not configured | `inline-flex`, **141×43 px**, radius 999px | `#C97F2E` on `#F2A24A` | **1.53:1 FAIL** |
| before | configured | `flex`, 206×43, radius 999px | `#161D3D` on `#F2A24A` | 7.86:1 PASS |
| **after** | not configured | `inline`, **103×16 px**, radius 0 | `#8A5620` on `#FFFDF6` | **6.01:1 PASS** |
| **after** | configured | `flex`, 206×43, radius 999px | `#161D3D` on `#F2A24A` | 7.86:1 PASS |

4.5:1 is the threshold. **1.53:1 is not a styling opinion, it is a failure.**

**Fixed at the gate, not the call site.** `.sx-gc a` → `.sx-gc>a`, so only a link
that stands alone becomes a button, plus `.sx-gc p a` giving inline links the
estate's own link colour. The inline `style="color:var(--dx-ambd)"` on the
injected markup was **removed** — it was the thing that turned a bad-but-legible
navy-on-amber pill into an illegible amber-on-amber one, by overriding the very
rule that would have saved it.

Both branches had to be exercised to see this at all. The configured branch was
reached by **intercepting `site.json` in flight** and forcing a dummy code —
`site.json` on disk was never touched.

### It is a class of defect, so the whole site was swept

A container rule that turns every descendant link into a button is fine until an
inline link lands inside that container. So: **28 pages rendered, 262 visible
links examined**, every link's computed radius, padding and background read back,
and each one checked for whether it sits inside a `<p>`/`<li>` that has real text
around it.

```
before:  6 button-styled links inside running text,  1 failing contrast
after:   5 button-styled links inside running text,  0 failing contrast
```

**The other five are correct and were left alone** — two PDF buttons on `/asdan/`
(7.86:1, 9.98:1), the Ko-fi button on the homepage (7.86:1), and two CTAs on
`/next/` (6.99:1, 5.69:1). All are deliberate standalone buttons whose paragraph
happens to carry a caption. **Reported rather than silently "fixed", because a
sweep that changes things it did not need to is how a diff stops being
checkable.**

---

## 2. "Where's the log in page and special log in features?"

### The page exists. Nothing could reach it.

`/members/` has been on the site the whole time, explaining that accounts were
removed on 2 August 2026. But:

```
pages linking to /members/ ......... 0     ← the defect
  CONTROL, linking to /privacy/ .... 5     ← the search was live
  CONTROL, linking to /stats/ ...... 4
<meta name="robots" content="noindex">     ← so search engines skipped it too
entries in sitemap.xml ............. 0
```

**A page written to answer a question, that only somebody who already knew the
URL could ever open.** That is why Matt could not find it — there was nothing to
click, anywhere on the site, and nothing for a search engine to return.

Fixed: `noindex` removed and replaced with a canonical, added to `sitemap.xml`,
and linked from `/privacy/` at the exact sentence that raises the subject
(*"There are no accounts"*). Re-derived after: **2 files link to it**, control
still 5.

### What the "special features" actually were: none, and it said so itself

Recovered from the page's own markup before deletion (`git show 568b4a0`). It
said the same thing **in three separate places**:

> *"There are no member-only features yet — this is where they'd appear if any
> are built."*

The one thing that did exist for supporters — commissioned resources — carried
its own line saying **signing in did not unlock it** and that it was open to
anyone who donates. It still is, and still needs no account.

The machinery was real: `register` · `login` · `logout` · `resetPassword`
(cloud-only, never configured) · `subscribe` · a device-local hashed backend · a
Supabase backend · a password-strength meter · a signed-in name in the header.
**A working lock on a door with nothing behind it.**

### A comment in the code had gone stale, and would have misled the next person

`assets/mbm-features.js` claimed, of the accounts flag:

> *"…which is what makes flipping it back on a one-line change rather than a
> markup restoration."*

**That was true when it was written and false hours later.** It was written in
PR #15; `ecf8b8c` (PR #20) then deleted the auth markup from `index.html`
outright, the same day.

Tested rather than re-assumed — `site.json` intercepted in flight with
`features.accounts.enabled` forced true:

```
enabled=false -> data-accounts=off, 0 login buttons, 0 modals, 0 password inputs
enabled=true  -> data-accounts=on,  0 login buttons, 0 modals, 0 password inputs
```

`MBMAuth` is live in both states (`provider=local`). **The flag alone restores
nothing visible.** The comment now says so and shows the measurement.

**The change is comment-only, and that was proved rather than asserted:** with
all comments stripped and whitespace collapsed, the file is byte-identical to
`origin/main` — **21,278 bytes both sides**. Runtime behaviour re-tested and
unchanged.

---

## No regressions

Every changed page measured on `origin/main` and on this branch, same script,
four viewports:

```
/stats/    overflow same · small controls 3->2 at 320/390/768, 9->8 at 1280 · 0 errors · 0 4xx
/members/  identical on every axis
/privacy/  identical on every axis
/index.html identical on every axis
NO REGRESSION on any measured axis, any page, any viewport.
```

`/stats/` improves by one control at every width — the pill became an inline
link, which is correctly no longer counted as a tap target.

**Note on the tap-target figure.** An earlier run of the floor script reported
this page as failing on "small tap targets". That script counted every inline
text link as a control, which is wrong — inline links in running text are exempt.
The comparison above uses the corrected rule and, more importantly, compares
before against after rather than against an absolute.

---

## Counts, each with its population

| claim | figure | population / control |
|---|---|---|
| pages swept for button-styled inline links | **28** rendered, **262** links | every `.html` in the repo |
| contrast failures, before → after | **1 → 0** | of 6 → 5 button-styled links in running text |
| container `<sel> a{` rules examined | **47** | 28 html + 4 css files; control `color:` matched **1175** |
| pages linking to `/members/`, before → after | **0 → 2** | control `/privacy/` = 5, `/stats/` = 4 |
| sitemap entries | **438 → 440** | parses as valid XML, 0 duplicates |
| non-comment code changed in `mbm-features.js` | **0 bytes** | comments stripped, 21,278 = 21,278 |

---

## Left alone deliberately

- **Four other public pages missing from `sitemap.xml`** — `404.html`,
  `hub-highlight-card.html`, `medevac/MedevacFrontier_v1.html`,
  `medevac/studio.html`. A 404 page and a partial should not be listed; the
  other two look like superseded versions. **Not my call to make silently inside
  a pass about something else.** `resources/medevac-frontier/` is also absent and
  probably should not be. Recorded for the backlog.
- **The five correct button CTAs** found by the sweep. All pass contrast.
- **Whether the login comes back.** That is a product decision, not a defect.
  The members page now states what restoring it would take, and why doing it
  before there is anything to gate would be the same mistake twice.

## My honest limit

I can prove the pill is gone, prove the contrast, prove no regression, and prove
the flag alone restores nothing. What I cannot decide is whether Matt wants the
login back — and the honest answer to his question is that there was never
anything behind it, so there is nothing to miss.
