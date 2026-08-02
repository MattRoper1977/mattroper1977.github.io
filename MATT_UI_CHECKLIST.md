# Matt — the things only your hands can do

Five minutes on a phone. Nothing here can be done from a container; that is why
it is a list rather than a commit.

---

## 1. Enforce HTTPS ×3 — do this one first

**Where:** github.com → each repo → **Settings → Pages** → the *Enforce HTTPS*
checkbox, at the bottom.

**The three repos**, confirmed this session by their live
`pages-build-deployment` workflows, all building from `main`:

| repo | Pages | CNAME file |
|---|---|---|
| `MattRoper1977/Lessons` | active, last build success 1 Aug | **absent (404)** ✅ |
| `MattRoper1977/Games` | active, last build success 31 Jul | **absent (404)** ✅ |
| `MattRoper1977/Matt-s-Apps-` | active, last build success 31 Jul | **absent (404)** ✅ |

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

## 2. The Supabase decision — (a), (b) or (c)

Accounts are currently **off** and the site collects nothing. Nothing is broken
and nothing is waiting on you. But the code is still there, and it should end up
in one of these three states rather than sitting in between.

| | what it means | copy that must change | rough work |
|---|---|---|---|
| **(a) Wire it for real** | Supabase Auth handles hashing server-side. Accounts sync between devices. | The two privacy lines in `index.html` and `members/index.html` become **false** and must be rewritten — a password *does* reach a server in this mode. | Largest. Needs a Supabase project, RLS on every table, and the sync module, which is not written. |
| **(b) Register interest** | Email only. No password, no account. | Same two lines rewritten to promise exactly "we keep your email to tell you when there is something to tell you". | Medium. No password path at all, so no hashing claim to defend. |
| **(c) Hide until real** | Remove the surface; keep the code on a branch. | None — the lines stop being rendered anywhere, which is already true today. | Smallest. Closest to the current state. |

**If you pick (a), two things need a decision that is yours and not a
developer's:** a lawful basis, privacy notice and deletion route under UK GDPR
before a single record is collected; and, because this is a public education
site where under-18 visitors are plausible, whether the ICO's Age Appropriate
Design Code applies. Naming these, not deciding them.

**Keys, if you go with (a):** the **anon / publishable** key is designed to sit
in client code — but only behind Row Level Security. The **`service_role` key
must never be pasted anywhere near the repo, a PR, or a chat.** It bypasses
every access rule.

---

## 3. Optional — Cloudflare Pages app (30 seconds)

github.com → your **account** Settings (not a repo's) → **Applications →
Installed GitHub Apps** → if *Cloudflare Pages* is listed, uninstall it. The
Cloudflare project itself is already confirmed not to exist; this is permissions
hygiene only.

---

## 4. Branches that can be deleted — **site repo only**

Ref deletion returns 403 from the container, so these need your hands or a
`git push origin --delete` from the home machine. All are **fully contained in
`main`** — verified with `git branch -r --merged origin/main`.

This list covers `mattroper1977.github.io` only. The `Lessons`, `Games` and
`Matt-s-Apps-` repos have their own branches, which were **not** enumerated this
session — do not assume they are clean.

<!-- BRANCH-LIST:BEGIN -->
**17 branches, all verified fully contained in `main`** by
`git branch -r --merged origin/main` — deleting them loses nothing:

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

Not in this list and **not** safe to delete — these carry commits that are
**not** in `main`, so deleting them would lose work:

```
claude/axiom-shift-build-yff3x4
claude/pass-q-audit-c5tg3s
claude/pass-u-audit-hapesp
pass-u-audit
```

Also excluded: `claude/build-science-animations-cfr4qo`, which is the branch this
session is still pushing to.
<!-- BRANCH-LIST:END -->

---

## 5. The `build-anim-autumn1-v1` tag — **Lessons repo**, home machine only

Checked this session, and worth stating precisely because the target repo is
easy to get wrong:

- `297af43` is in **`MattRoper1977/Lessons`**, not the site repo. It is
  *"Merge BUILD science animation framework: all five Autumn 1 lessons"*,
  1 August 2026.
- The tag `build-anim-autumn1-v1` **does not exist** — `git ls-remote --tags`
  returns 0 matches.
- The branch **`backup/build-anim-autumn1-v1` does exist**, at exactly
  `297af43f2d135c29d3b322482aa4571e6526b798`. So the commit is currently held
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
