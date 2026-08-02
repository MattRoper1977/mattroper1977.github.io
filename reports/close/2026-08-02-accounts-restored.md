# Close: the login back, bonus content, and a teacher list — 2 August 2026

Matt asked for three things: the login back (free), Voxel Frontier and Apex Kick
behind it, and the email addresses of account holders for advertising.

**Two of the three shipped as asked. One could not be built as described, and
the reason is structural rather than effort.**

---

## The thing that could not be built, first

**A login cannot hide a file on GitHub Pages.** Measured fresh, a plain fetch
with no JavaScript executed at all:

```
/voxel/index.html      HTTP 200    60,782 bytes   <canvas>:1  <script>:3
/apexkick/index.html   HTTP 200   160,805 bytes   <canvas>:2  <script>:10
```

That is each game **in full**, delivered before any login code can run. There is
no server here to check who you are before handing a file over. A sign-in gate
on these two would look like a lock and lock nothing — which is precisely the
unconditional-success-page defect this estate spent the same day removing from
the contact form.

So the shape changed, with Matt's agreement: **bonus content is enabled for
account holders rather than hidden from everyone else**, and `/members/` says
that in as many words rather than drawing a padlock.

---

## The email request

Matt asked to see account holders' email addresses for advertising. Raised once,
factually, and he chose the alternative:

- The account is **device-local**. Nothing is transmitted, so there is no email
  to see, by construction.
- Collecting them means storing **children's** email addresses on a server. The
  site's own privacy page says *"This is a teaching site and young people use
  it."* UK GDPR needs a lawful basis; PECR reg 22 needs separate opt-in for
  electronic marketing; the Children's Code restricts marketing to under-18s.
  It also makes Matt a data controller, with erasure, retention and breach
  duties.

**What shipped instead: a teachers-only list, adults only, with its own required
opt-in tick.** Creating an account does not join it. Joining it does not create
an account. They are unconnected by design, and the page says so twice.

It posts to **the same FormSubmit endpoint the contact form already uses**, so
it adds **no new third party** and no new data store. It is the only place on
the entire site where an email address is sent anywhere.

Verified — 9 of 9:

```
PASS  posts to the SAME relay as the contact form (no new third party)
PASS  own subject line, so it lands separately
PASS  honeypot present            PASS  email required
PASS  consent tick REQUIRED       PASS  consent NOT pre-ticked
PASS  form INVALID until consent is given
PASS  teacher form is not part of the account modal
```

The form will not validate without the tick. That was asserted, not assumed —
`checkValidity()` returns `false` with a filled email and an unticked box.

---

## What the account does

### 1. Per-account save slots

On a shared classroom laptop, two pupils playing Voxel Frontier built over each
other's world, and two playing Apex Kick shared one squad and one goal tally.

**Signed out, the storage key is unchanged — byte for byte.** That was the first
requirement, not an afterthought: nobody's existing save may be orphaned the day
this ships. Driven through each game's real UI and read back from `localStorage`:

```
apex  signed out : ["apexkick.v1"]
apex  signed in  : ["apexkick.v1~1qs6mq6"]
voxel signed out : ["voxelfrontier.lastseed.v1", "voxelfrontier.world.v2.484324924"]
voxel signed in  : ["voxelfrontier.lastseed.v1~1qs6mq6", "voxelfrontier.world.v2~1qs6mq6.32597625"]
```

### 2. Bonus content that cost no new rendering code

- **Apex Kick** — the *Members' Floodlights* ground. `need:0` deliberately: this
  is what the free account gives you, not a second grind on top of the first.
- **Voxel Frontier** — `SNOW` and `WATER` in the hotbar. **Both were already
  fully implemented** — colour, atlas tile, even a footstep sound — and simply
  absent from `HOTBAR`. Snow already generates naturally above the snowline.

Verified in a browser, signed out and signed in:

```
voxel signed out: hotbar = 1Grass 2Dirt 3Stone 4Wood 5Leaves 6Sand 7Planks 8Brick 9Glass
voxel signed in : hotbar = …9Glass 10Snow 11Water

apex  signed out: members card locked=true   badge="FREE ACCOUNT"
apex  signed in : members card locked=false  badge="READY"
```

---

## `assets/mbm-profile.js` — why a new file rather than the existing one

Both games are self-contained and make **zero** external requests. Loading
`mbm-features.js` into them would drag `api.counterapi.dev` into a game page
that today calls nothing at all, and break the offline promise.

So they load a ~2 KB shim that makes **no network requests of any kind** — it
only reads the two `localStorage` keys `MBMAuth` already writes.
`MBMProfile.slot(key)` returns the key **unchanged** when signed out.

Asserted, both games, both states: **0 external requests attempted.**

---

## Two bugs found in my own work, by the tests

**1. `ReferenceError: MEMBER is not defined`.** The helper was defined inside the
`AK.Prog` closure but called from two sites outside it. It threw when a
signed-out player clicked the members' ground.

**It was nearly invisible.** The other call site is `!st.member || MEMBER()` —
and for all five original stadiums `!st.member` short-circuits, so `MEMBER()` is
never reached. Only the new ground could trigger it. Fixed by exporting it as
`AK.Prog.isMember` through the closure's existing export list.

**2. A key that could in principle collide.** `SAVE_PREFIX` is concatenated with
a numeric seed, so suffixing the prefix produced
`voxelfrontier.world.v2.~1qs6mq6` **+** `19251831` — a tag running straight into
a seed with no separator, ambiguous between two accounts whose tag and seed
happened to line up. Now suffixed *before* the trailing dot:
`voxelfrontier.world.v2~tag.<seed>`. Signed out it is still byte-identical to
the old key.

Both were found by driving the real UI. Neither would have been found by reading
the diff.

## And one false failure, recorded because it nearly cost a real fix

The first test run reported **4 failures** on the save keys. All four were the
test's fault: `SAVE` and `SAVE_PREFIX` are module-scoped, so `page.evaluate`
could not see them and returned `null`. **Unobservable, not absent** — the same
trap as `dropEffect` earlier today. The check was replaced with one that
observes the actual effect: drive the game's own UI, then read `localStorage`.

---

## Every claim that this made false, and what it says now

| where | was | now |
|---|---|---|
| `/privacy/` | *"There are no accounts… no password box anywhere"* | the optional account, what it stores, and that it never leaves the device |
| `/privacy/` list | *"No accounts, no sign-in, no password anywhere"* | *"No account that leaves your device"* |
| `/members/` | *"There is nothing to sign in to"* — a tombstone | the account page: what it does, what it is not, where details go |
| `FEATURES.md` §3 | *"REMOVED"* | *"RESTORED"*, with the gating constraint written in |
| `HANDOVER.md` ×2 | accounts switched off | reopened and closed again, with the new shape |
| `BACKLOG.md` | *"removed, module kept"* | restored, in the shape asked for |

Residue swept, with a live control:

```
"There are no accounts"     0        "nothing to sign in to"  0
"no password box anywhere"  0        "no sign-in"             0
CONTROL "account"          10 files
```

## Three things `/members/` now says that a marketing page would not

1. **It is not a lock**, and anyone determined can reach the bonus content.
2. **It does not sync between devices** — a device-local account has nowhere to
   sync to, and nothing will claim otherwise until a verified backend exists.
3. **There is no password reset**, so *please do not reuse a real password* — it
   guards nothing here, so reusing one is risk for no benefit.

---

## Verification

| gate | result |
|---|---|
| login end-to-end | button → modal → register → *"Hi, Test • Sign out"*, password stored salted SHA-256, **plaintext: false** |
| games end-to-end | **PASS** — save slots, bonus content, 0 external requests, 0 page errors, both states |
| teacher form | **PASS 9/9** |
| no regression | 6 pages × 4 viewports vs `origin/main` — **no regression on any axis**; `/stats/` improves by one control at every width |

## Deliberately left red

- **Cross-device sync.** Not built, not claimed. It needs a real backend, and
  `MBM_CAPS["cloud-sync"]` still gates it behind a verified write-then-read-back
  round-trip that nothing currently performs.
- **Password reset.** Cloud-only. There is no cloud.
- **Who has an account, and how many.** Unknowable from here by design, and
  that is the point rather than a gap. If Matt wants reach, the teacher list is
  the honest instrument.

## My honest limit

I can prove the account works, that signed-out play is untouched, that the bonus
content appears, and that no email leaves anyone's device without a deliberate
tick. What I cannot do is make a static host check a password — and the moment a
page pretends otherwise, everything else it says is worth less.
