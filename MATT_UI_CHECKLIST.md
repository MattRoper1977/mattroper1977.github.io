# Matt — the things only your hands can do

In phone order. **Everything on this list was attempted first**, on 2 August
2026, and each one is here because it was measured as impossible from a
container — not assumed:

| item | what was tried | result |
|---|---|---|
| Enforce HTTPS ×3 | `GET api.github.com/repos/…/pages`, all four repos | **403** — *"Access to this GitHub API path is not permitted through this proxy."* |
| Contact-form test | searched the connected Gmail; tried to POST the form | wrong mailbox · `formsubmit.co` **403 on CONNECT** — **now ✅ answered by Matt, see §2** |
| FormSubmit domain lock | — | dashboard login, no API |
| Upload the film | reachability check | `youtube.com` **unreachable from the container** |

Everything else this session is done and merged.

---

## 1. Enforce HTTPS ×3 — do this one first

**Where:** github.com → each repo → **Settings → Pages** → the *Enforce HTTPS*
checkbox, at the bottom.

**The three repos**, confirmed by their live `pages-build-deployment` workflows,
all building from `main`:

| repo | Pages | CNAME file |
|---|---|---|
| `MattRoper1977/Lessons` | active | **absent (404)** ✅ |
| `MattRoper1977/Games` | active | **absent (404)** ✅ |
| `MattRoper1977/Matt-s-Apps-` | active | **absent (404)** ✅ |

The user site `MattRoper1977/mattroper1977.github.io` carries the CNAME
(`madebymatt.uk`) and is already enforced. That is correct and is what the three
project repos inherit.

### What you will see, and what to do — four cases

1. **Box live and unticked** → **tick it. Done.** This is the expected case.
2. **Box greyed out, NO custom domain shown** → already on and locked, nothing to
   do — **but tell Claude**, because it contradicts what was measured.
3. **Box greyed out, a custom domain IS shown** → **do not touch it.** The domain
   should not be there at all. Screenshot it and tell Claude.
4. **No Pages section at all** → that repo is not serving Pages. Tell Claude.

### ⚠ The advice you will find online, which is wrong for these three

Search results say: *"remove the custom domain, save, re-add it, save."*
**Never do that on these three repos.** They must keep the custom-domain field
**empty** — they inherit `madebymatt.uk` from the user site. Typing it in writes
a CNAME file and creates a real conflict. That advice only ever applied to the
user site, which is already enforced.

### And the test that looks convincing but proves nothing

Visiting `http://madebymatt.uk/Lessons/` and seeing it redirect to `https://`
tells you **nothing** about the Lessons repo's setting. The user site already
enforces HTTPS on that apex domain, so its HSTS policy covers the whole origin —
every project path included — and browsers upgrade bare `http` anyway. The exact
domain inheritance that makes the project repos work is what makes this test
blind. **The checkbox is the only ground truth.**

---

## 2. ✅ ANSWERED — the plain form. Nothing left to do here.

**Observed by Matt on 2 August 2026: case B, then the form works.**

The activation mail was in the mailbox and had **never been clicked**. Matt
clicked it on 2 August 2026, submitted a test message, and it arrived.

That settles the question this section existed to ask, and it settles it in the
worst of the four directions: **everything submitted before 2 August 2026 was
discarded by the relay and showed the sender a success page anyway.**

### How long that lasted — measured from git history, not estimated

| | |
|---|---|
| site and custom domain live | **16 July 2026** (`CNAME` created 20:02) |
| endpoint first on a page a visitor could load | **18 July 2026**, commit `0b660b2`, pushed straight to `main` |
| activation clicked | **2 August 2026** |
| **window** | **first live 2026-07-18, window 15 days** (14 days 23 h elapsed) |

Checked rather than assumed, walking all **137** first-parent commits on `main`
and testing `index.html` for the endpoint at each one:

- The form was **absent from `main` for 35 minutes** on 18 July (`0ba31f4`
  13:08 → `5c394fd` 13:44) and present continuously otherwise. That is the only
  gap in the 15 days.
- The endpoint string **never changed** — same address from `0b660b2` to today.
- The site was already deployed 2 days *before* the endpoint landed, so there is
  no lag between "committed" and "reachable" to subtract.

**How many messages that is, nobody knows and nobody will.** There is no
analytics on this site by design, the relay holds nothing for an unactivated
address, and a guessed number here would be exactly the fault this whole pass
was about. It is recorded as a window, not a count.

> **⚠ If an anti-spam / "are you human" screen ever appears** between pressing
> Send and landing on the thank-you page, that is FormSubmit's own interstitial
> — `_captcha` is unset so the vendor default applies. Not a failure.

---

## 2b. ⭐ THE ONE THING LEFT — open a page and press one button

**<https://madebymatt.uk/cors-test.html>** — press **Run the probe**, then read
out or screenshot the block it prints. Thirty seconds.

**Why it exists.** PR #25 (`claude/contact-form-ajax-safety-net`) makes a failed
send *say so* instead of showing a success page regardless. It can only work if
the browser is allowed to **read** FormSubmit's reply. `formsubmit.co` returns
403 on CONNECT from the build container, and a blocked request proves nothing
about the far end, so that question cannot be answered from my side — only from
a real browser on the real domain.

**What to expect:**

- It sends **one real message**, subject `CORS TEST — ignore`. Delete it.
- The page is unlinked, `noindex,nofollow`, and absent from `sitemap.xml`.
- It does **not** touch the live contact form.
- It prints one of three verdicts, and each one has its action written on it:

| Verdict | Means | What happens next |
|---|---|---|
| **PERMITTED** | the reply is readable | PR #25 merges — the site stops claiming a send succeeded when it didn't |
| **REFUSED** | request sent, reply unreadable | PR #25 closes, and the reason is written down permanently so nobody rebuilds it in six months |
| **INCONCLUSIVE** | nothing left the browser at all | ad blocker, filter or offline. **Not** a refusal. Try again on another network |

**Then `/cors-test.html` gets deleted.** It is temporary by construction and
comes out in the same round of changes as the decision it informs.

---

## 3. FormSubmit — what is now known, and what is still a question

`formsubmit.co` is unreachable from the container (403 on CONNECT), so
**everything about how the vendor behaves is unverifiable from my side.**
Nothing below was tested by me. Two rows have moved out of the questions list
because Matt looked:

### Known — observed by Matt on 2 August 2026

| question | answer | how it was established |
|---|---|---|
| Does the endpoint deliver? | **Yes, since 2 August 2026** | observed by Matt on 2 August 2026 — test message sent and received |
| Had it ever delivered before that? | **No** | observed by Matt on 2 August 2026 — the activation mail was present and unclicked; he clicked it that day |
| Does a bare-email endpoint send activation mail at all? | **Yes** | implied by the above; the mail existed to be found |

That is the whole of what is *known*. It is written down with its provenance
because in three weeks "the form works" will be a memory, and a memory is not
evidence. **Everything below is still a question.**

### Still questions

- **Is there a dashboard at all** for a bare-email endpoint, or only for an
  alias?
- **Is there a domain-lock / allowed-domains setting?** If yes, set it to
  `madebymatt.uk`. The endpoint currently accepts a POST from anywhere, which
  is a **spam-volume and `_cc`/`_replyto` abuse** exposure — *not* a secrecy
  one. Your address is deliberately public in **32 `mailto:` links across 21
  files** — re-derived 2 August 2026 across all four repos (site 14/23,
  Lessons 5/6, Games 1/1, Matt-s-Apps- 1/2), with the `html` control matching
  73 / 668 / 3 / 32 files so none of those counts came from a dead search.
  Hiding it was never the point and an alias would not be a privacy fix.
- **What is the `_captcha` default?** See the warning in §2 — this decides
  whether a stranger meets an interstitial, and it is your only free friction
  against spam. Turning it off is a trade to make knowingly.
- **Does the `/ajax/` endpoint share the same activation state as the plain
  endpoint, or is it activated separately?** §2b answers this for free: if the
  `CORS TEST — ignore` message lands in the inbox, `/ajax/` is delivering on the
  same activation. If the probe says PERMITTED but no mail ever arrives, they
  are activated separately and PR #25 stays held.
- **Where is the relay, legally?** DNS resolves only to Cloudflare front-end
  addresses, which says nothing about the company or its servers. The site
  therefore says *"a third-party relay I do not run"* and names no country.
  **That wording is deliberate and should not be "improved" into a jurisdiction
  claim.** If you ever get a straight answer, it belongs in `/privacy/`.
- **If you are ever given an alias token** (`formsubmit.co/el/…`), send it to
  the session and it gets swapped with a count proving every occurrence moved.
  **Never guess or construct one** — a wrong token silently discards mail
  exactly like an unactivated address does.

What the form already has, verified in the page on merged main: `_honey`
honeypot (present, `aria-hidden="true"`), `_subject` (`madebymatt.uk contact`),
and `_next` pointing at `/thanks/` — **followed, not assumed**: HTTP 200, and
the page it lands on is the right one. No captcha of any kind was added — **no
reCAPTCHA, no hCaptcha**.

---

## 4. ⭐ Upload the launch film — and add the music at upload

The video is built and waiting in the session artefacts directory as
**`madebymatt-launch.mp4`** — 1920×1080, 76 seconds, 9.8 MB. The thumbnail is
committed at `assets/video/thumb-launch-1280x720.png`.

**Everything you need is in
[`reports/film/2026-08-02-launch-film-publish-kit.md`](reports/film/2026-08-02-launch-film-publish-kit.md)**
— title, full description with chapters and transcript, pinned comment, and the
step-by-step.

**The one step that is easy to miss:** the file has **no audio track at all**.
That is deliberate — a music licence cannot be verified from a build container,
so nothing was baked in. After uploading, go to **YouTube Studio → Editor →
Audio** and pick a track from YouTube's own **Audio Library**, the same route
you used for the Apex Kick reel. Keep it low; there is no narration to compete
with and the audience includes SEMH pupils.

Once it is live, send Claude the eleven-character video ID and it goes on the
home page as a click-to-load facade in about two minutes — the poster is already
committed.

---

## 5. The Facebook URL — if you want it on the site

The homepage and members page now carry a **Follow the work** card with the
three channels whose URLs actually exist in the repository: **YouTube**
(`@matthewroper9166`), **Ko-fi** (`madebymattuk`) and **email**.

If you also run a Facebook page, send Claude the URL and it goes on the card.
It was deliberately **not** guessed — building a social URL out of a name is how
you end up linking a stranger's page from your own site.

---

## 6. Optional / whenever

### Cloudflare Pages app (30 seconds)
github.com → your **account** Settings (not a repo's) → **Applications →
Installed GitHub Apps** → if *Cloudflare Pages* is listed, uninstall it. The
Cloudflare project itself is confirmed not to exist; this is permissions hygiene
only.

### Branches that can be deleted — **site repo only**

Ref deletion returns 403 from the container, so these need your hands or a
`git push origin --delete` from the home machine.

This list covers `mattroper1977.github.io` only. The `Lessons`, `Games` and
`Matt-s-Apps-` repos have their own branches, which were **not** enumerated —
do not assume they are clean.

<!-- BRANCH-LIST:BEGIN -->
**Re-derived 2 August 2026 against `main` at `d103557`**, after PRs #24 and #26
merged. This list is stale the moment `main` moves, so it is re-derived every
pass rather than carried. **This is the fourth derivation and the first one to
change** — two branches moved into the safe list and one moved out.

**26 remote branches: `main`, 19 fully contained in it, 6 not.**
Every line below was checked with `git rev-list --count origin/main..<branch>`,
not with a branch name.

*Counted before this pass pushed its own branch.* `claude/cors-probe-formsubmit`
makes 27, and it joins the safe list the moment its pull request merges — it is
not listed as safe now, because right now it is not.

**19 safe to delete** — each confirmed `ahead-of-main = 0`:

```
apexkick-hub-art                               12b0060226
apexkick-juice                                 e6fd0e1188
apexkick-rating-door                           00b9d66ae9
claude/apex-kick-game-build-a14dl4             3b6617cf5d
claude/asdan-toolkit-three-pathway-0sjx7z      24ae86f662
claude/brand-tagline-mobile-3dwdkl             04a40b462b
claude/card-art-doors-arcade                   31fc5c3947
claude/contact-form-honest-failure             c974fca342   ← new, PR #24 merged
claude/doors-renderer                          a6facdb4c9
claude/formsubmit-close-checklist              47a35f09ea   ← new, PR #26 merged
claude/front-page-upgrade-jwv8sd               7fbda5cc73
claude/madebymatt-feature-enhancements-a4gys1  b70dc24afa
claude/members-honesty                         00a72c5cbd
claude/newrelease-voxel-swap                   aecd69b6ab
claude/publish-off-brand-v3-z5hkig             789efd9a3d
claude/splash-titles-redesign-xkd16j           0af0ae4c33
claude/voxel-game-engine-pvckl2                d712bd33ca
doors-engine                                   836f428084
handover-1-aug                                 2af074b177
```

**Moved OUT of the safe list — `claude/build-science-animations-cfr4qo`, now 2
commits ahead of `main`.** Previous derivations called it contained; it is not
any more, because two commits were pushed to it during the FormSubmit work.

**Those 2 commits carry nothing unique, and that was proved rather than
assumed.** `git patch-id --stable` on all four:

```
3fc109c  e1aa29b8b45e  ==  c974fca  e1aa29b8b45e   (merged to main as PR #24)
5bb3877  967d9c26be4e  ==  7c20279  967d9c26be4e   (held open as PR #25)
```

Identical patch-ids both times, so the content exists twice over. The branch is
**safe to delete on content grounds** — just not by `git branch --merged`, which
compares commits and not changes. Delete it last, after PR #25 is settled.

**Excluded — these 5 carry commits that are NOT in `main` and NOT duplicated
elsewhere.** Deleting them loses that work:

```
claude/contact-form-ajax-safety-net  7c20279011   1 commit  ahead — this is PR #25. Keep until §2b decides it
claude/pass-u-audit-hapesp           010fbeb0c4   1 commit  ahead
claude/axiom-shift-build-yff3x4      1d779ce82f   2 commits ahead
pass-u-audit                         10c39188b3   3 commits ahead
claude/pass-q-audit-c5tg3s           6845f444de   8 commits ahead
```

**Excluded — `backup/build-anim-autumn1-v1`, and the reason has not expired.**
It is a branch of **`MattRoper1977/Lessons`**, not of this repo, so it is not
one of the 26 above and no amount of tidying here will touch it. Re-checked
against the Lessons remote today: **0 tags exist**, and the branch is still at
`297af43f2d135c29d3b322482aa4571e6526b798`. It is the only ref holding that
commit reachable. **It must survive until the tag in the next item exists** —
delete it before that and the commit is unreachable. See below.
<!-- BRANCH-LIST:END -->

### The `build-anim-autumn1-v1` tag — **Lessons repo**, home machine only

Re-checked this session against the Lessons remote, because the target repo is
easy to get wrong:

- `297af43` is in **`MattRoper1977/Lessons`**, not the site repo.
- The Lessons remote has **0 tags** — so `build-anim-autumn1-v1` does not exist.
  That is a population, not a guess: `git ls-remote --tags` returned nothing at
  all.
- The branch **`backup/build-anim-autumn1-v1` does exist**, at exactly
  `297af43f2d135c29d3b322482aa4571e6526b798`. The commit is currently held
  reachable. Nothing is at risk today.

Tag pushes 403 by ref type from the container, so from your home machine, in a
clone of **Lessons**:

```sh
git tag build-anim-autumn1-v1 297af43
git push origin build-anim-autumn1-v1
```

**Keep `backup/build-anim-autumn1-v1` until that tag exists.** It is the only
thing holding that commit reachable. There is also
`review-base/build-anim-autumn1` at `2f6c49e` — left alone, not investigated.

---

## Decided for you, and reversible if you disagree

**Accounts are gone, not just switched off.** You asked for the call to be made,
so: the sign-in button, the password box, the members gate and the two "create a
free account" banners have been removed from the pages. The module underneath is
untouched and still fail-closed. This closes the UK GDPR and Age Appropriate
Design Code questions outright, because a site that collects nothing has nothing
to have a lawful basis for.

**One honest cost, stated rather than buried:** reversing this is no longer a
one-line flag flip. The markup is gone, so bringing accounts back means
reverting that commit and *then* flipping `features.accounts.enabled`. If that
trade is wrong, say so and it comes straight back.
