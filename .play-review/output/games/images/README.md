# images/

Photographic card art for the homepage door cards (`site.json` → `doors[]` →
`image`). Everything else on those cards is SVG, authored as
`<template id="art-*">` blocks in `index.html`.

## lesson-hub-card.webp — THUMBNAIL ONLY. Do not enlarge it.

450×360 (5:4), 21 KB. It is a crop of a 1069×608 supplied banner, taken at
x=155 so the whole "LESSON HUB — YOUR GATEWAY TO CREATIVE MASTERY" wordmark
survives and the owl stays in frame.

**It must never be promoted to a hero, a banner, an `og:image`, or any
full-width slot.** The source artwork is AI-generated and has gibberish baked
into it — the three right-hand panels ("CODING FUNDAMENTALS", "PIXEL ART 101",
"GAME DESIGN THEORY") carry nonsense body text, and the top-right terminal
lines are not words. The x=155 crop removes those three panels, but the source
they came from is the same one that produced the rest of the image, so treat
the whole asset as safe at thumbnail scale and unsafe at any size where text
resolves.

That distinction is not theoretical, and there is a worked example. This
directory used to hold `evening-workshop.jpg`, 1200×670, 134 KB, which was the
Studio Suite card. Its baked-in gibberish was only ever noticed because the
image got rendered large — at full size its device screen reads "Task
Checkfiet", "Geot ciecklist", "Ciocu IV 6 / 11:35 AM", and there were five
further garbled zones. At the 150×120 the card gave it, none of that was
legible, and nobody had looked.

**It was deleted on 2 August 2026** and replaced by the `art-studio-suite` SVG
template in `index.html`. That fixed two things at once: the gibberish, and the
fact that a 1200×670 photo could not sit in a 5:4 row without letterboxing
below ~546px of viewport. Git still has the file if it is ever wanted.

If you need a large Lesson Hub image, commission one or author an SVG. Do not
reach for `lesson-hub-card.webp`, and do not regenerate it with an image model
— an image model is what put the gibberish there in the first place.

Every other door on the homepage is now a `<template id="art-*">` SVG at
`viewBox="0 0 120 96"`. `lesson-hub-card.webp` is the only photographic card
art left, and it is cut to that same 5:4 so the row is even at every width.

## The rest

- `apexkick-hub.jpg` — `og:image` for `/games/`.
- `lessonhub-art.jpg` — 97 KB, **referenced by nothing**. Left from the
  pre-`836f428` four-door homepage. Safe to delete; kept only because deleting
  it is not this pass's job.
