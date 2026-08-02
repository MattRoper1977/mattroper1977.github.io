# Matt — the things only your hands can do

In phone order. **Everything on this list was attempted first**, on 2 August
2026, and each one is here because it was measured as impossible from a
container — not assumed:

| item | what was tried | result |
|---|---|---|
| Enforce HTTPS ×3 | `GET api.github.com/repos/…/pages`, all four repos | **403** — *"Access to this GitHub API path is not permitted through this proxy."* |
| Contact-form test | searched the connected Gmail; tried to POST the form | wrong mailbox (see §2) · `formsubmit.co` **403 on CONNECT** |
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

## 2. ⭐ FIRST TEST — the plain form. Do this one before anything else.

**Mailbox: `contactmadebymatt@gmail.com` — NOT `londonmatt1977@gmail.com`.**

That distinction already caught this session once. The Gmail account connected
to Claude is `londonmatt1977@gmail.com`; it was searched and returned **0
threads matching `formsubmit` and 0 to, from or delivered-to
`contactmadebymatt@gmail.com`**, with no forwarding between them. **That zero
came from the wrong population and told us nothing about the form.**

**Search 1** — paste exactly:

```
in:anywhere from:formsubmit.co
```

`in:anywhere` matters: it covers Spam and Trash, where activation mail usually
lands.

**Search 2, only if Search 1 is empty** — paste each:

```
in:anywhere formsubmit
in:anywhere subject:(activate OR confirm)
```

### What you find, what it means, what to do

| Found | Means | Do |
|---|---|---|
| **A** — activation mail, already confirmed | The form is live | Count the forwarded submissions. Zero is then a real fact about traffic, not a fault |
| **B** — activation mail, never clicked | Every message submitted before now went nowhere | Click it. **Nothing can be recovered** — the relay does not hold mail for an unactivated address. Then do C's test |
| **C** — nothing at all | **The absence is informative.** Activation mail is only sent on the *first* submission, so no activation mail most likely means **nobody ever submitted** — nothing was lost — unless it was deleted | Submit once from your phone, wait a few minutes, re-run Search 1 |
| **D** — activation mail for a *different* address or endpoint than the page carries | The live form points somewhere else | Bring the real endpoint back to the session |

### Then submit one test message

<https://madebymatt.uk/#contact> from your phone, then report what arrives.

**⚠ One thing to expect, so you don't misread it.** The form does not set
`_captcha` either way, so FormSubmit's own default applies — and I could not
check what that default is. **If an anti-spam / "are you human" screen appears
between pressing Send and landing on the thank-you page, that is FormSubmit's
interstitial, not a failure.** Complete it and carry on. Only treat it as a
failure if no mail arrives at all.

---

## 2b. SECOND TEST — only after §2 has an answer

**Do not do this until the plain form has been tested.** If both changes are
live and a submission fails, the result is uninterpretable: it could be the
browser being refused by the relay, or the endpoint rejecting an unactivated
address. One test, two unknowns, no conclusion.

**PR #25** (`claude/contact-form-ajax-safety-net`) is open and **held** for
exactly that reason. Once §2 says the form is live:

1. Merge #25.
2. Submit the form once more, with the browser's devtools **Network** tab open.
3. Look at the `POST` to `formsubmit.co/ajax/…`.
   - **JSON response** → it works; a failed send will now say so instead of
     showing a false success.
   - **Blocked / no readable response** → the browser was refused. The page
     falls back to *"the relay could not be reached — here is the direct
     address"*, which is safe, but the form never completes that way.
     **Revert it: `7c20279`.** One revert, nothing else depends on it.

---

## 3. FormSubmit — questions I could not answer from here

`formsubmit.co` is unreachable from the container (403 on CONNECT), so
**everything about how the vendor behaves is unverifiable from my side.** These
are questions, not instructions, and each is only worth asking if §2 shows the
form is live:

- **Is there a dashboard at all** for a bare-email endpoint, or only for an
  alias?
- **Is there a domain-lock / allowed-domains setting?** If yes, set it to
  `madebymatt.uk`. The endpoint currently accepts a POST from anywhere, which
  is a **spam-volume and `_cc`/`_replyto` abuse** exposure — *not* a secrecy
  one. Your address is deliberately public in 32 `mailto:` links across 21
  files; hiding it was never the point and an alias would not be a privacy fix.
- **What is the `_captcha` default?** See the warning in §2 — this decides
  whether a stranger meets an interstitial, and it is your only free friction
  against spam. Turning it off is a trade to make knowingly.
- **Does the `/ajax/` endpoint share the same activation state as the plain
  endpoint, or is it activated separately?** If separate, §2b carries a *second*
  unknown and the ordering argument applies all over again.
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
**Re-derived 2 August 2026 against `main` at `2d7d084`**, after PR #21 merged.
This list is stale the moment `main` moves, so it is re-derived every pass
rather than carried; the SHAs below have not changed across three derivations,
which is a result, not a reason to stop checking.

**23 remote branches. 18 fully contained in `main`, 4 not, plus `main` itself.**
Of the 18, one is the branch still being pushed to, so **17 are safe to delete**
— verified with `git branch -r --merged origin/main`, each confirmed
`ahead-of-main=0`:

```
apexkick-hub-art                               12b0060226
apexkick-juice                                 e6fd0e1188
apexkick-rating-door                           00b9d66ae9
claude/apex-kick-game-build-a14dl4             3b6617cf5d
claude/asdan-toolkit-three-pathway-0sjx7z      24ae86f662
claude/brand-tagline-mobile-3dwdkl             04a40b462b
claude/card-art-doors-arcade                   31fc5c3947
claude/doors-renderer                          a6facdb4c9
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

**Excluded — `claude/build-science-animations-cfr4qo`.** It is contained in
`main`, but it is the branch this session is pushing to. Deleting it would take
the open work with it.

**Excluded — these 4 carry commits that are NOT in `main`.** Deleting them loses
that work:

```
claude/axiom-shift-build-yff3x4    1d779ce82f   2 commits ahead
claude/pass-q-audit-c5tg3s         6845f444de   8 commits ahead
claude/pass-u-audit-hapesp         010fbeb0c4   1 commit  ahead
pass-u-audit                       10c39188b3   3 commits ahead
```

**Excluded — `backup/build-anim-autumn1-v1` is not in this repo at all.**
It is a branch of **`MattRoper1977/Lessons`**, it is *not* one of the 23 above,
and it must survive until the tag in §5 below exists. See the next item.
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
