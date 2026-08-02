# Close: the last three — 2 August 2026

For a reader with no context. Three items were carried as "remaining". None of
them is open now.

| # | item | end state |
|---|---|---|
| 1 | Cloud sync module | **DECIDED AND WRITTEN DOWN** — shipped fail-closed; the product choice is Matt's, costed three ways |
| 2 | The mp4 twin | **DONE** — and the reason it was thought impossible was my own wrong conclusion |
| 3 | Enforce HTTPS ×3 | **MATT'S**, with the exact clicks, plus the strongest evidence obtainable from here |

---

## The correction that matters most

I previously told Matt that an mp4 could not be produced here, because "this
container's ffmpeg encodes VP8/WebM only". The first half was true. **The
conclusion was wrong.**

The preinstalled tooling genuinely cannot: `/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`
is a Playwright build compiled `--disable-everything` with webm/VP8/png and
nothing else, and there is no `ffprobe` at all. But the container is **not
sealed** — `pypi.org` and `registry.npmjs.org` are both in the proxy's `noProxy`
list. Three independent routes each produced a genuine H.264/avc1 MP4, verified
by decoding the output rather than by reading documentation:

```
imageio-ffmpeg 7.0.2 (PyPI)        REAL.mp4   8459 bytes  h264 High (avc1)
@ffmpeg-installer/ffmpeg (npm)     NPM.mp4    8436 bytes  h264 High (avc1)
PyAV 18.0.0 (PyPI)                 PYAV.mp4   3472 bytes  h264 High (avc1)
```

I had reasoned from "the tool in front of me cannot" to "it cannot be done",
without testing whether another tool was one command away. That is the same
shape as a false zero: a question closed without examining its input set.

**A trap found on the way, worth keeping.** `MediaRecorder.isTypeSupported('video/mp4')`
returns **true** in headless Chromium and would pass a naive capability check.
It is lying: every H.264-qualified mimetype returns false, and the recorder
emits **VP9 inside an MP4 container**, which Safari and most hardware decoders
refuse — exactly the compatibility problem MP4 is chosen to solve. Do not branch
on that check.

---

## 1. Cloud sync module — DECIDED AND WRITTEN DOWN

**What it was:** an account system that would sync a teacher's work between
devices, blocked on Supabase keys only Matt can supply.

**What actually exists:** not a sync module. There is no sync module and there
never was — it was deliberately not written, because verifying it needs a live
Supabase project and untested code that claims to protect a teacher's records is
worse than no code. What exists is the *offer surface*: two doors, a homepage
band, two tool-page banners, all bound to `MBM_CAPS["cloud-sync"]`. **Nothing
sets that flag** — 0 files.

**Fail-closed, proven in both directions** (rule 9 — the failing state first):

```
FAILING  accounts.enabled=true, keys absent
         login button in DOM: true · auth modal in DOM: true
         password inputs: 1 visible
         signup accepts a password: YES — the field accepted 27 characters

PASSING  as shipped on origin/main (accounts.enabled=false)
         login button in DOM: false · auth modal in DOM: false
         password inputs: 0 · signup accepts a password: n/a
         data-accounts=off · non-GET requests: 0
```

Measured across `/`, `/members/`, `/stats/`, `/uas/`, `/voxel/`: **5 pages,
0 password inputs, 0 non-GET requests.** The gate is what closes it, not the
absence of code.

**Secret scan, population first.** My first attempt reported `0 blobs scanned,
0 matches` — a false zero from a broken tree-walk, caught only because rule 8
requires printing the population. Redone against the object store:

```
958 objects · 409 blobs · 354 text blobs under 4 MB scanned · 0 matches
```

for JWT-shaped strings and `service_role` / `SUPABASE_SERVICE` /
`SUPABASE_SECRET` / `sb_secret`. Nothing to rotate.

**RLS: not applicable this session.** No keys were supplied, so no tables exist
to enable it on. Deliberately left red rather than reported as passed — a green
here would be a false zero over an empty population.

**Personal data already collected: none the estate holds.** No committed JSON
contains an email address. The only stores are client-side keys on visitors' own
devices (`mbm_users`, `mbm_session`, `mbm_hud_names`, `mbm_counted`,
`mbm_c_*`, `mbm_reading_theme`), never transmitted. Nothing was uploaded,
migrated or deleted.

**The three options are in `MATT_UI_CHECKLIST.md` §2, costed. None chosen here.**

### Corrections to the brief that commissioned this

The brief carried three strings from the ledger as live homepage copy. **All
three return zero files verbatim.** The near-equivalents that exist —
`"Your password is hashed (SHA-256) on your device before it's stored"` and
`"it never leaves it and never reaches a server"` — sit inside the auth modal,
which `initAccountUI()` **removes from the DOM** when accounts are off. They do
not render. `"between devices"` appears only on the two deferred account doors.
There is no live signup collecting name + email + password; that was closed
before the brief was written.

The brief also said the *"nothing is sent to a server"* card is false because of
counterapi.dev. Two corrections: the claim as actually written is scoped to
*your account*, not to the page, so the counter does not falsify it; and
counterapi.dev is not the only third party. `HANDOVER.md:390` already records
**`formsubmit.co`**, and `index.html:393` carries a **live contact form POSTing
name + email + message** to `https://formsubmit.co/contactmadebymatt@gmail.com`.
That is real personal data leaving the site to a US relay today, entirely
independent of accounts. **Flagged, not touched** — it is a live feature and
removing it silently would be worse than leaving it.

---

## 2. The mp4 twin — DONE

**Which sense of "twin", settled by evidence rather than assumed:**
**(A) format twin.** `clip-voxelfrontier-play.webm` was the only non-mp4 clip of
five, sitting in a `<video>` with a bare `src` and **zero `<source>` children**
— so a decoder failure meant nothing played, with no fallback. Sense (B) is
ruled out by measurement: the Lessons repo contains **0** video files, so the
estate's two-copy rule covers the *game HTML* (`voxel/index.html` ↔
`Lessons/Games/Voxel_Frontier.html`), not video.

**The finished artefact, probed:**

```
Video: h264 (High) (avc1 / 0x31637661), yuv420p, 854x480 [DAR 427:240], 25 fps
Duration 00:00:13.20 · 1 video stream · 0 audio streams · 396,379 bytes (387 KB)
faststart: YES — moov at byte 36, before mdat · header ftypisom
```

Encoded at crf 32 after comparing three qualities (750 / 548 / **387** KB). At
matched quality the **MP4 came out smaller than the WebM** (387 KB vs 472 KB),
which settled the source ordering: MP4 first, for hardware decoding on the
phones and iPads this is watched on, and for size.

**The fallback was demonstrated, not asserted.** Headless Chromium here has no
H.264 decoder, so when it met the source list it **skipped the MP4 and played
the WebM** — a real browser genuinely lacking the first decoder, falling through
to the second exactly as intended.

**Honest limit:** for the same reason, I cannot confirm from this container that
the MP4 *plays in a browser*. Its validity is established at file level only.

**Census, population first:**

```
6 clip files · 5 distinct stems · 1 twinned (mp4+webm) · 4 single-format
6 clip files · 6 referenced · 0 orphaned
5 <video> elements · 5 with preload="none" · 5 with width/height matching the encode
```

Nothing was removed to make a gate green.

**A limit I previously reported is now closed.** With a real ffmpeg I could read
the four existing arcade clips for the first time. All four are h264 High
(avc1), yuv420p, **480×930**, no audio stream, 269–367 KB. The markup says
`height="930"`. **The 930-vs-1042 mismatch the brief warns about is not present
here** — confirmed rather than assumed.

**Page weight:** every `<video>` is `preload="none"`, so the twin adds
**396,379 bytes to the repo and 0 bytes to first paint**. Posters, which do load,
are unchanged at 224.2 KB.

---

## 3. Enforce HTTPS ×3 — MATT'S

**Environment: PROXIED.** `git remote -v` resolves to
`http://local_proxy@127.0.0.1:41729/...`. The Pages API path is proxy-filtered,
so `https_enforced` is **unreadable from here — N/A, not FAILED.** Not re-tested;
the ledger says a Contents-scope PAT 403s on that endpoint and that is a scope
ceiling.

**Target set confirmed, with one addition to the inventory.** Three independent
enumerations agree the account has exactly **5** repositories
(`search_repositories` total_count 5 · `list_repos` has_more false ·
`get_me` public_repos 5):

| repo | serves Pages | Pages branch | CNAME on that branch |
|---|---|---|---|
| `mattroper1977.github.io` | yes | main | **present** — `madebymatt.uk` ✅ correct |
| `Lessons` | yes | main | **absent (404)** ✅ |
| `Games` | yes | main | **absent (404)** ✅ |
| `Matt-s-Apps-` | yes | main | **absent (404)** ✅ |
| `Games-` *(trailing hyphen)* | **no** | n/a | absent |

The brief's list of three is **correct**. But there is a fifth repo it did not
know about — **`MattRoper1977/Games-`**, with a trailing hyphen, created one
minute after `Games` and untouched since. It does **not** serve Pages, and that
negative is measured, not assumed: zero workflows of any kind, a single branch,
and a root containing only `README.md`. So there is no fourth Pages site — but
the repo is real and was missing from the inventory.

**The substitute measurement passes.** CNAME is absent on all three project
repos, checked two independent ways each (GitHub contents API and
`raw.githubusercontent.com`), on `refs/heads/main` — which is confirmed to be
the branch Pages actually builds from for each. Their custom-domain fields are
therefore empty, so the "greyed out because the certificate has not provisioned"
branch **cannot fire**.

**The soft spot, stated honestly:** a 404 proves absence only on the branch
queried. I queried `main` for each, and verified via each repo's most recent
`pages-build-deployment` run that `main` is the branch Pages builds from. If a
repo's Pages source is ever changed, this needs re-checking there.

**Unverifiable:** whether a *private* repo also serves Pages. `get_me` exposes
`public_repos: 5` but not a private count in the payload returned here. Two
enumerations agree at 5 and the token is the account owner's, so it is unlikely
— but it is not ruled out, and it is labelled unverifiable rather than measured.

**Access friction worth recording.** The MCP session was initially scoped to
only 3 of the 5 repos; `Matt-s-Apps-` and `Games-` returned *"not configured for
this session"* and had to be attached read-only. **Any earlier audit using these
tools without attaching them would have silently seen 3 repos and could not have
found `Games-` at all.** That is a false zero built into the tooling, not into
anyone's method.

The four-line decision tree, the forbidden remove-and-re-add advice, and the
blind-test warning are all in `MATT_UI_CHECKLIST.md` §1.

---

## Deliberately left red, with reasons

- **RLS not proven.** No keys, so no tables. A green here would be a false zero
  over an empty population.
- **The MP4 not confirmed playing in a browser.** No H.264 decoder in this
  container. File-level validity only.
- **`https_enforced` not read.** Proxy-filtered. The CNAME check is a proxy for
  one failure mode, not for the setting itself.
- **Private repos not enumerated.** Not exposed by the data available.
- **`formsubmit.co` contact form left live.** Reported, not changed — it is a
  working feature and its removal is Matt's call.

## My honest limit

Nothing I can run tells anyone whether the account module is *legally* safe to
switch on, or whether a checkbox in a browser is ticked. The first needs a
decision about lawful basis and the Age Appropriate Design Code; the second
needs Matt's thumb. Everything else in this document is measured, and where it
is not, it says so.

## If I had another hour

The `formsubmit.co` form. It is the only place on the site that collects
personal data from a stranger today, it posts to a third-party US relay, and the
privacy copy near it has not been read against what it actually does. That is a
live exposure, unlike the accounts module, which collects nothing.
