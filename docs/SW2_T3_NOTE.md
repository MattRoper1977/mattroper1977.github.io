# SW2 T3 — what a first stamping run proved, and why the design has to change

`tools/stamp_chrome.py` is written, and `--check` works: run against the tree as
it stands it reports 20 differences across 11 static page types, and correctly
names `/privacy/` as having no `<footer>` to stamp at all. That is the gate T3
asks for, and the unstamped tree is its own red proof.

Then the stamp was actually run, on a branch, and the estate's own
`verify_professional_site.js` was run over the result. It went from 0 findings
to **11**. They are worth keeping, because they say the blunt version of T3 is
wrong:

| finding | pages | what it means |
|---|---|---|
| "Made by Matt logo visual changed" | main, games, tools, resources, members, privacy | `brandVisual()` compares the markup between `<a class="brand">` and the first `<span>`. The pages do not agree with each other today: some use `/assets/brand/micro_mark.svg`, some `../assets/…`, and `games/index.html` uses an inline `<svg>`. One template cannot preserve six different visuals. |
| "authored body wording changed outside permitted regions" | main, tools | replacing the whole `<footer>` destroyed authored prose the verifier protects |
| "education-footer-description matched 0 exact versions" | tools | the tools hub pins a specific footer description |
| "homepage audience route missing: /main/#contact, /main/#collections" | main | the homepage's own census needs anchors the stamped header dropped |

## The redesign

Replacing a whole `<header>` or `<footer>` is too blunt. The chrome and the
authored content share those elements today, and three separate contracts pin
parts of what is inside them. So the markers have to go **inside**, around only
the parts the chrome owns:

- stamp the brand, the nav row and the disclosure inside the existing
  `<header>`, leaving anything else in it alone;
- stamp only the tagline line and the variant links inside the existing
  `<footer>`, leaving authored prose and pinned descriptions where they are;
- give `/privacy/` a `<footer>`, because it has none. That is an addition
  rather than a replacement.

And the brand visual has to converge before it can be stamped, or the
preservation gate will red every page whose mark differs from the template.
That convergence is a real, visible change and belongs in its own commit with
its own before and after, not smuggled in under "stamping".

Nothing here is a defect in the verifier. It is doing exactly what it was
written to do: it caught a change that would have quietly rewritten authored
copy on two pages and altered the logo on six.
