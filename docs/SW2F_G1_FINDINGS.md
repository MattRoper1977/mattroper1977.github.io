# SW2-F §G1 — the estate's contrast findings

Produced by `tools/sw2/check_contrast_census.cjs` over the T3 stamp set (19
routes x 2 viewports, 1,559 text/background pairs). Every line is a REAL pixel
measurement: gradient-backed text is decided by screenshotting the node twice,
diffing to find where the glyphs are, and reading the pixels behind them.

**These are pre-existing, and none is caused by SW2.** They are recorded here
rather than fixed in §F0 for the reason F0.2 gives — "nothing else in the
template changes" — and assigned by C1, which makes a G1 failure the finding of
whichever part touches that page. Loading fifty colour changes onto a hotfix
would make it a redesign, and Parts L, R, H and U repaint these very surfaces
with T1 tokens anyway.

§F0 fixed the four it owns: the seven account chips, the preview tab focus ring,
the dark-footer muted ink, and `.mf-note-kicker` on the audience pages.

| route | owner part | count |
|---|---|---|
| `/tools/` | U (hubs) | 7 |
| `/main/` | H (homepage) | 4 |
| `/resources/` | R | 3 |
| `/games/` | U | 2 |
| `/for/schools-semh/`, `/for/parents-carers/`, `/for/trusts/`, `/for/pupils/` | A (audience parity) | 5 |
| `/teach/`, `/members/`, `/education-hub/` | U | 3 |

Two shapes dominate, and both are the same mistake as the chips — a value that
was chosen against one surface and is used on another:

* **amber `rgb(201,127,46)` on cream** — 2.84:1 on `#F6F1E4`, 3.15:1 on
  `#FFFDF6`. It is a brand amber used as body ink.
* **focus rings that vanish** — `rgb(16,16,16)` at **1.16:1** on the navy
  `#161d3d` of `/games/`, and inputs with no `:focus-visible` ring at all on a
  dark surface.

The focus-ring ones matter most: a keyboard user cannot see where they are.

## Every finding, deduplicated across viewports

  - /education-hub/ p.mbm-hub-kicker rgb(242, 162, 74) on rgb(56, 73, 107) (worst of 1714 real pixels behind the glyphs, section.mbm-hub-hero gradient) 4.30:1 < 4.5 "Made by Matt · Professional Education Hu"
  - /for/parents-carers/ a FOCUS RING: ring rgb(242, 162, 74) is 2.30:1 on rgb(130, 114, 18)
  - /for/parents-carers/ span x4 nodes rgb(130, 114, 18) on rgb(233, 225, 246) (from span) 3.8:1 < 4.5 "01"
  - /for/pupils/ p rgb(242, 162, 74) on rgb(81, 103, 112) (worst of 6220 real pixels behind the glyphs, section.mf-switch.mbm-reveal gradient) 2.85:1 < 4.5 "One platform · several front doors"
  - /for/schools-semh/ a FOCUS RING: ring rgb(242, 162, 74) is 2.30:1 on rgb(4, 119, 188)
  - /for/schools-semh/ span x4 nodes rgb(4, 119, 188) on rgb(217, 238, 233) (from span) 3.97:1 < 4.5 "01"
  - /for/trusts/ a FOCUS RING: ring rgb(242, 162, 74) is 2.88:1 on rgb(13, 110, 112)
  - /games/ a FOCUS RING: ring rgb(16, 16, 16) is 1.16:1 on rgb(22, 29, 61)
  - /games/ video FOCUS RING: ring rgb(16, 16, 16) is 1.16:1 on rgb(22, 29, 61)
  - /main/ a rgb(201, 127, 46) on rgb(246, 241, 228) (from section#seeit.dx-video.mbm-reveal) 2.84:1 < 4.5 "More on the channel →"
  - /main/ b rgb(201, 127, 46) on rgb(246, 241, 228) (from section#standard.dx-std.mbm-reveal) 2.84:1 < 4.5 "THE PROMISE"
  - /main/ input#main-search FOCUS RING: no :focus-visible ring on a dark surface
  - /main/ summary rgb(201, 127, 46) on rgb(255, 253, 246) (from div.dx-updbox) 3.15:1 < 4.5 "Three more improvements"
  - /members/ a.ma-btn rgb(138, 86, 32) on rgb(242, 162, 74) (from a.ma-btn) 2.93:1 < 4.5 "Log in"
  - /resources/ a.skip FOCUS RING: ring rgb(11, 16, 32) is 1.15:1 on rgb(22, 29, 61)
  - /resources/ button#rxClear.btn FOCUS RING: ring rgb(11, 16, 32) is 1.15:1 on rgb(22, 29, 61)
  - /resources/ label rgb(255, 255, 255) on rgb(255, 254, 250) (from div.rx-search) 1.01:1 < 4.5 "Search packs, schemes of work, evidence "
  - /teach/ p.mbm-hub-kicker rgb(242, 162, 74) on rgb(56, 73, 105) (worst of 935 real pixels behind the glyphs, section.mbm-hub-hero gradient) 4.32:1 < 4.5 "Made by Matt · Learning"
  - /tools/ b x4 nodes rgb(201, 127, 46) on rgb(237, 229, 210) (from section.commit.mbm-reveal) 2.55:1 < 4.5 "free"
  - /tools/ p.eyebrow rgb(201, 127, 46) on rgb(244, 239, 225) (worst of 493 real pixels behind the glyphs, section.tx-hero gradient) 2.79:1 < 4.5 "Teacher tools"
  - /tools/ p.eyebrow rgb(201, 127, 46) on rgb(245, 239, 226) (worst of 493 real pixels behind the glyphs, section.tx-hero gradient) 2.79:1 < 4.5 "Teacher tools"
  - /tools/ span.kind rgb(201, 127, 46) on rgb(251, 241, 221) (worst of 1209 real pixels behind the glyphs, article.fcard gradient) 2.86:1 < 4.5 "TEACHER TOOL · AQA UNIT AWARD SCHEME"
  - /tools/ span.kind rgb(201, 127, 46) on rgb(252, 241, 222) (worst of 1209 real pixels behind the glyphs, article.fcard gradient) 2.86:1 < 4.5 "TEACHER TOOL · AQA UNIT AWARD SCHEME"
  - /tools/ text rgb(27, 33, 64) on rgb(28, 34, 71) (worst of 4926 real pixels behind the glyphs, article.fcard gradient) 1.02:1 < 3 "UNIT CLAIMED"
  - /tools/ text rgb(27, 33, 64) on rgb(28, 34, 71) (worst of 5315 real pixels behind the glyphs, article.fcard gradient) 1.02:1 < 3 "UNIT CLAIMED"
  - … and 10 more

## Still UNMEASURED, and why

Seven nodes carry a `background-image` that is not a parseable gradient (a real
raster image behind text). The census never counts these as a pass; they need a
human eye or a design change that puts text on a solid surface.
