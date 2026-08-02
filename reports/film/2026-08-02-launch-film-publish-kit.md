# Launch film — publish kit

Everything Matt needs to upload it. **You upload; I can't and shouldn't.**

The film itself is **not in this repo** and should not be added to it: a
GitHub Pages repo serves every file it contains to anyone who guesses the path,
and a video bloats every clone for ever. The build script is the artefact.

| | |
|---|---|
| **file** | `madebymatt-launch.mp4` (in the session artefacts directory) |
| **rebuild** | `bash tools/film/build_film.sh` |
| **spec** | 1920×1080 · 30 fps · h264 High (avc1) · yuv420p · `+faststart` · **no audio track** |
| **length** | **76.23 s** |
| **size** | 9.8 MB |
| **thumbnail** | `assets/video/thumb-launch-1280x720.png` (committed) |
| **poster** | `assets/video/poster-launch.webp` (committed, for the site facade) |

---

## 1. Title

Copy this exactly:

```
A game, 15 biology lessons — free, and no sign-up
```

**49 characters.** It follows the cadence of the two videos already on the
channel — *"A full year of art — free, and it runs itself"* — which is
[thing] — [free], and [the honest catch]. No clickbait, because the channel's
whole appeal is that it doesn't do that.

---

## 2. Description

Everything below the line goes in the description box, as-is.

---

Three things that landed on madebymatt.uk this week: a free-kick game where the
card stats really do drive the ball, fifteen new GCSE biology lessons, and the
removal of the last thing on the site that ever asked anyone to sign up.

Everything is free. There is no account, no sign-in and no email address — not
as a trial, permanently. The site collects nothing, and there's now a page that
sets out exactly what does and doesn't leave your browser.

⏱ Chapters
0:00 No sign-up, nothing collected
0:25 Apex Kick
0:45 Year 10–11 biology
1:09 Where to find it

🔗 Links
Everything: https://madebymatt.uk
Apex Kick: https://madebymatt.uk/apexkick/
Lessons: https://madebymatt.uk/Lessons/
What this site does with data: https://madebymatt.uk/privacy/

📝 Full transcript (all on-screen text, in order)

MADE BY MATT — Learn · Build · Explore
Free classroom tools, games and lessons

ONE. No sign-up. Nothing collected.
There is no account to make, and no password box anywhere on the site.

Data and privacy — written by checking what the pages actually do.
Measured, not promised: 0 of 27 pages set a cookie, and no analytics of any kind.
No members' area, on purpose. Nothing was ever behind a login, so the login went.

TWO. Apex Kick.
Curl a free kick round the wall. Card stats set the physics, never the dice.
Power, curve, accuracy — the card's stats decide how tight the error cone is.
48 cards, 7 leagues, 16 nations. Chemistry between players changes the ballistics.
Everything on one page: games, lessons, teacher tools — all free.

THREE. Year 10–11 Biology.
Fifteen new lessons across five weeks — Discover, Use, Master.
Edexcel GCSE Biology 1BI0 Foundation. Paper 1, Topic 1 — cells, transport and
the core practical.
Discover · Use · Master — five per stage, across five weeks.
Built for the room they're taught in: print packs at three levels in every lesson.

madebymatt.uk
Free to use. No sign-up, no account, nothing to install.
Built in a real SEMH classroom.

#SEMH #SEND

---

## 3. Pinned comment

```
No sign-up, no account, no email — everything on the site is just open. If
there's a topic you'd find useful next, reply here and tell me; that's genuinely
how most of these get picked. — Matt
```

---

## 4. Upload steps

1. **youtube.com** → Create → Upload video → choose `madebymatt-launch.mp4`.
2. Paste the **title** from §1 and the **description** from §2.
3. **Thumbnail** → upload `assets/video/thumb-launch-1280x720.png`.
4. **Audience**: "No, it's not made for kids." It is made *for teachers*, about
   resources used with pupils — that is not the same thing as content made for
   children, and marking it as made-for-kids would disable the comments you want.
5. **Add music — this is the step that matters.** The file has **no audio track
   at all**, deliberately: a licence cannot be verified from a build container,
   so nothing was baked in.
   - After upload, open **YouTube Studio → Editor → Audio**.
   - Pick a track from the **Audio Library** (filter to *Attribution not
     required* if you'd rather not add a credit line).
   - Keep it low and calm — the film has no narration to compete with, and the
     audience includes SEMH pupils.
   - This is the same route used for the Apex Kick reel.
6. **Publish**, then copy the video ID from the URL (`youtu.be/XXXXXXXXXXX`).
7. Send Matt-the-ID to Claude, or do §5 yourself.

---

## 5. Putting it on the site afterwards — a two-minute job

The poster is already committed, so once the video has an ID this is a
one-element change. It is a **click-to-load facade**: nothing contacts YouTube
until a visitor presses play, which is what `/privacy/` promises and what the
existing embeds already do.

In `index.html`, inside the `#seeit` section, alongside the existing videos:

```html
<figure>
  <button class="dx-vidbtn" data-yt="VIDEO_ID_HERE"
          style="background-image:url(assets/video/poster-launch.webp)">
    <span>Play — what landed this week</span>
  </button>
</figure>
```

`data-yt` is the eleven-character ID only, not the whole URL. The existing
facade script picks it up with no other change, and builds the
`youtube-nocookie.com` iframe on click.

---

## 6. Optional — a Shorts cut

Not built this session. If wanted, the raw material already exists and is
already gated: `assets/video/clip-apexkick.mp4` is 480×930 portrait, silent and
was vetted in an earlier pass. It needs a title card and an end card at the same
aspect, and a hard 60-second ceiling.

---

## Channel

`https://www.youtube.com/@matthewroper9166` — verified from the repository
(3 occurrences in the tree), not from memory.
