# PLAY-I1 — install path per domain (CX2 §9.2)

Starting point, recorded 2026-09-11: Play's build filter dropped `site.webmanifest`; neither homepage linked a manifest; Android offered an install on the education domain. This record diagnoses the install path of each domain from the trees actually served, fixes what is Play's to fix, and proves installability separately from any offline claim. No offline statement is made anywhere in it.

## What the served trees say

Measured from the Site-main education publication build and the Play build at the same source (the container's outbound proxy refuses the live hosts, so the served bytes were read from the builds the publication workflows emit and the served digest census, not from the wire).

**madebymatt-play.uk (Play).** Since Site `17cd730` ("preserve Play root manifest", released at the PLAY-D1 pin `c744667`) the Play root serves `/site.webmanifest` and the homepage links it (`domain-split/play/manifest.py` fails the build if either goes). Six Play pages link it: `/`, `/Games/`, `/games/`, `/main/`, `/Lessons/`, `/for/pupils/`. The manifest declares `id` and `scope` `/`, `start_url` `/`, `display: standalone`, name and short name, 192 and 512 PNG icons. That is the full set Chromium needs to offer *Install app* (HTTPS, a linked manifest with name, icons of both sizes, a start URL in scope, a standalone display), so the Play domain is installable from those six pages. There is no service worker at the Play root; two games register their own: micro-tinkerer (its own manifest and worker, scoped to `/micro-tinkerer/`) and CyberPulse (an inline `data:` manifest naming the game, so an install begun on `/cyberpulse/` installs the game, not Play). Both are game-owned and pre-date this work; recorded, not changed.

**madebymatt.uk (Education).** No page in the education tree links a manifest: MTR1 item 7 (`docs/MTR1_CLOSE_RECORD.md`, "DROP_LINKS") removed the twelve links deliberately because the origin has no service worker scope covering them, and `education-site/site.webmanifest` still ships, unlinked, so that a later homepage order can link it once a worker decision exists (AS1-F F3.4 handoff, `docs/reference/AS1_EDUCATION_DECISIONS.md`). Without a linked manifest Chromium cannot offer *Install app* on the education domain. What Android does offer on any page is *Add to Home screen* (a shortcut, not an installed app) and, in recent Chrome, *Install page as app* from the menu, which needs no manifest. The 2026-09-11 observation is therefore consistent with the served tree only as one of those two; which one it was is a phone reading, on THE MATT LIST below. Nothing on the education domain is Play's to change, and nothing was changed.

## What was wrong on Play, and the fix

The Play manifest's icons and the root `apple-touch-icon.png` were the education files: `assets/icons/app-icon-192.png` and `-512.png` (the navy "M" square) and the 128 px education touch icon. An install from madebymatt-play.uk put Education branding on the home screen. The homepage also declared `theme-color #101319` while the manifest declared `#081422` (the Play token `--mbm-bg`), so the browser chrome and the installed app's chrome disagreed.

- **D11 — install icons derived from the accepted Play mark, by crop and resize only.** `tools/prepare_play_install_icons.py` (`--write` / `--check`) locates the mint ring in `domain-split/play/approved-mark.jpg` (source sha `bfef5b1e…792a`, bound in `brand.json`) by its own colour, takes one full-height square crop centred on it (`crop_box` 201,0 → 1213,1012), and resizes with LANCZOS to `play-icon-192.png`, `play-icon-512.png` and `play-apple-touch-icon.png` (180). No repaint, no recolour, no new artwork; the ring, star and gradient field are the supplied image's. The ring occupies 54% of the icon, inside the 80% safe zone maskable icons require, so the same files serve `purpose: any` and `purpose: maskable`. `domain-split/play/install-icons.json` binds source sha, ring box, crop box and every output sha; `--check` re-derives all of it.
- `domain-split/play/site.webmanifest`: the four icon entries (any and maskable at 192 and 512) point at the Play icons. `domain-split/play/root-assets.json`: the Play root's `/apple-touch-icon.png` is the Play touch icon (iOS reads that path with no link). The education tree's icons are untouched.
- `domain-split/play/index.html`: `theme-color` is `#081422`.
- `domain-split/play/manifest.py` (runs inside the Play build and in `tools/verify_as1_play_manifest.py`): the homepage theme-color must equal the manifest's; every icon must be one of the recorded Play install icons by sha; both sizes must exist for both purposes; the root touch icon must be the recorded Play touch icon. The AS1 gate's copier control now copies whichever icons the manifest names rather than a typed pair.

## Installability, proven separately from offline

Proven (static, from the build the publisher emits): the manifest fields above, the icon identities and sizes, the homepage link, the theme colours, and that the root carries no service worker. Not proven here, and not claimed: that a given phone shows *Install app* (a browser decision on the live origin), and anything offline. The installed Play app needs the network; nothing in this record or the manifest says otherwise.

## THE MATT LIST (phone)

1. `https://www.madebymatt-play.uk/` in Chrome on Android: menu → does it read **Install app** (installable) or **Add to Home screen**? Install it: the home-screen icon should be the Play ring-and-M, and the app's status bar the charcoal `#081422`.
2. `https://madebymatt.uk/` in the same browser: which of **Add to Home screen** / **Install page as app** / **Install app** is offered? *Install app* would contradict the served tree and needs reporting; the other two are the shortcut paths described above.
3. iPhone Safari, share → Add to Home Screen on the Play homepage: the icon should be the Play mark.
