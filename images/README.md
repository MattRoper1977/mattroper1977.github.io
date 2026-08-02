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

That distinction is not theoretical. `evening-workshop.jpg` below has exactly
the same problem and it was only ever noticed because the image got rendered
large: at 1200×670 its device screen reads "Task Checkfiet", "Geot ciecklist",
"Ciocu IV 6 / 11:35 AM", and there are five further garbled zones. At the
150×120 the card actually gives it, none of that is legible.

If you need a large Lesson Hub image, commission one or author an SVG. Do not
reach for this file, and do not regenerate it with an image model — an image
model is what put the gibberish there.

## evening-workshop.jpg

1200×670, 134 KB. The Studio Suite card. Same thumbnail-only constraint, same
reason. It is also the one door art that is not 5:4, so it letterboxes below
~546px of viewport — see the measured table in the card-art comment in
`index.html`, and the open decision in `HANDOVER.md`.

## The rest

- `apexkick-hub.jpg` — `og:image` for `/games/`.
- `lessonhub-art.jpg` — 97 KB, **referenced by nothing**. Left from the
  pre-`836f428` four-door homepage. Safe to delete; kept only because deleting
  it is not this pass's job.
