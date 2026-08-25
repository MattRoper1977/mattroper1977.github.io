# Ground truth for the filter-blindness census

`prefix-5m-driving-games-live-verify.yml` is a **verbatim copy** of
`.github/workflows/driving-games-live-verify.yml` as it stood at `93168a1^` —
the last commit before 5m was fixed. Not a hand-written imitation of the shape:
the real file, with the real filter.

Its `paths:` watched `rallyvector3d/index.html`, `neonmeridian/index.html`,
`data/source-manifests/games.json` and itself. Its assertion was about
`/for/pupils/`. **The commit that broke the assertion could not fire the
workflow it broke**, and it stayed red for eleven days until a manual dispatch
found it by accident.

The census must name it. A census that reports zero across a whole estate has
said one of two things — the estate is clean, or the instrument is blind — and
nothing in the number itself distinguishes them. This fixture is what
distinguishes them, and it is why `--self-test` is a limb of the gate rather
than a thing somebody ran once.

Do not "fix" this file. It is supposed to be wrong.
