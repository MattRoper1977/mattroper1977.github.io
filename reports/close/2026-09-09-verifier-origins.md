# Verifiers choose an origin by route, not by literal

**Decision record.** SW2-F §W2, on the ruling of 2026-09-09. One defect fixed,
one assertion deliberately left red, seven flagged files cleared, and a gate so
the class cannot come back quietly.

---

## The defect, and why it was misread twice

The estate publishes two trees from one source. Education is `madebymatt.uk`;
Play is `www.madebymatt-play.uk`. The education tree answers **every** Play
route with a two-kilobyte stub — `noindex`, one link, `<link rel="canonical">`
to the Play URL — emitted by `domain-split/build_education.py::moved_page`
under HC3 §2.4 / HC4 §7.4.

`tools/townlife/verify_live.mjs` pinned `const ORIGIN = 'https://madebymatt.uk'`
and asked it for `/townlife/` and `/games/`. Both are Play routes. The fetch
returned **200**, the stub arrived, and the first content assertion to run
reported what it saw:

```
AssertionError: /townlife/ is missing marker "Gold Master v1.0 preview — …"
```

That sentence is true and useless. It names the assertion, not the cause, and
the cause was three frames up in a constant. It was read first as a content
regression, then as a Pages/CDN race, before the origin was measured.

**The same job carried its own disproof the whole time.** Its 76 local controls
pass on the same commit against `http://127.0.0.1:44441/townlife/` — the full
page, the splash, the way out to `/games/`. Same bytes, two origins, two
results.

## Why a map, and why generated

`education_policy.classifier` already answers "who serves this" — it is the
predicate both publications are built with. A second, hand-kept list would be
free to disagree with the build, which is the failure mode itself. So
`data/estate-map.json` is **generated** from that predicate by
`tools/estate/build_estate_map.py`, and `tools/sw2/check_estate_map.py` fails if
the checked-in copy stops reproducing.

Two readers exist because verifiers are written in two languages
(`tools/lib/estate_map.py`, `tools/lib/estate-map.cjs`). Two readers are two
chances to disagree, so they are compared against the classifier **route by
route** — 1,034 routes, 154 Play and 880 education — not spot-checked.

### The map needed a second axis, and measurement is what found it

`is_game()` answers *"is this recreational"*. That is not the same question as
*"which tree serves this file"*. `data/source-manifests/games.json` is not a
game and is in `SOURCE_ONLY`, so the education publication does not carry it at
all — it is served only by Play, byte-identical, as the built tree confirms. A
map built on `is_game` alone would have sent that request to the origin that
404s it.

So `originFor()` is the union: recreational **or** absent from education
(`education_policy.excluded_asset`). Found by checking the map against the built
Play tree rather than against its own source.

## What changed

| | |
|---|---|
| `tools/townlife/verify_live.mjs` | origin derived per route; every request through the shared helper |
| `tools/lib/estate-fetch.cjs` | asserts `finalUrl`; raises `OffOriginError` before any content assertion |
| `tools/verify_echovault_surfaces.js`, `…relicforge…` | `SHELF` derived rather than literal — see "cleared" below |
| `tools/sw2/check_verifier_origins.py` | standing gate: a new education-host-on-Play-path literal fails CI |

`OffOriginError` reads *"`/townlife/` lives on `https://www.madebymatt-play.uk`
— it was requested from `https://madebymatt.uk`, which serves the split stub for
this route, not the page"*. That is a distinct class from "missing marker", and
it fires **first**, so the next reader is told the cause.

`RouteMovedError` is the second class: `redirect: 'follow'` silently turned "this
route moved" into "this page has the wrong bytes". `finalUrl` was already being
recorded and never asserted.

## Red-proved, offline

`tools/sw2/check_estate_fetch.cjs` stands up two local origins — one serving the
real page, one serving the `moved_page` stub — and proves **8/8**: the map routes
`/townlife/` to Play and the real page comes back; pointing the same code at the
education origin raises `OffOriginError` whose message names where the route
lives; the class fires before any content assertion; a redirect raises
`RouteMovedError` naming both URLs; and an education route on the education
origin still passes. That last one is the control that matters — a gate that
reddened correct usage would be worse than none.

`check_estate_map.py --self-test` red-proves **both directions**: a Play route
stripped of its game classification, and an education route claimed as a game.
Its first cut did not fire, twice, and both are recorded in the file: it built
its route universe from the document it was perturbing, so the control deleted
the subject along with the evidence; and dropping `/townlife` from
`knownGameRoutes` alone changed nothing, because `gameDirectories` still
classified it. A perturbation another clause repairs is not a perturbation.

## Eight files screened, one defect

The census is a **screen**, not a verdict. It flagged eight files; each was then
traced through its call graph, adversarially, and **seven were cleared**:

* `verify_professional_site.js` — the routes are hrefs asserted in markup, never
  requested; its `--base` is a git ref, not a URL.
* `verify_url_filter_state.mjs`, `verify_v4_games_deployment.mjs`,
  `verify_professional_site_live.py`, `verify_served.mjs` — origin supplied or
  overridden elsewhere, or the routes are data-table keys.
* `verify_echovault_surfaces.js`, `verify_relicforge_surfaces.js` — the flagged
  `SHELF` literal sits on the `else` branch of `RF_PUBLICATION`. Every executing
  caller sets `RF_PUBLICATION: games` — both surface workflows at workflow-level
  `env:`, and `post-merge-production-verify.yml` at step level — so that branch
  never runs in CI and the live path goes through `published-shelf-probe.cjs` at
  the **Play** origin, correctly. **Not a live defect.** Fixed anyway, because a
  wrong default nothing reaches is what becomes a wrong default the day someone
  drops the env var.

That ratio is why the gate fails only on `DIRECT` — one literal carrying an
education host and a Play path, nothing to interpret — and **reports** `JOINED`.
Failing on the screen would have reddened seven correct verifiers.

## Left red on purpose

`verify_live.mjs` compares the served `/games/` to `games/index.html`. The origin
fix sends that request to Play, which is right, and the comparison is still
wrong: the Play `/games/` page is **generated** from
`domain-split/preview-template.html` (`build_publications.py:325`), not copied.
Built from `main`: **76,105 bytes against 53,680**, and the generated page does
not contain `id="genreSections"` at all.

Repairing it means deriving the expectation from the built Play tree — a
different change from choosing an origin. Inventing an assertion for a shelf
whose served shape is itself red today is exactly how BACKLOG §5a says the
original drift got in. So the assertion stays, annotated in place with those
numbers. **This PR does not make `townlife-verify` green, and does not claim to.**

## Found while measuring, not fixed here

* **`#group` is absent from the builder's own output.** `published-shelf-probe.cjs:101`
  asserts six controls on the Play home; five are present in a local build of
  `main` and `#group` is not. That is what reddens `echovault-surfaces-verify`
  and `relicforge-surfaces-verify` — a stale pinned selector, the same shape as
  BACKLOG §5a's `#rpgRail` and `#allGrid`, and neither a deployment nor an
  origin problem. Not this PR's to widen into.
* **Six stale route-census entries** the map sends to Play that the builder no
  longer emits (`/Lessons/Games/Voxel_Frontier.html`, `/Lessons/Games/Trail_Runner.html`,
  `/Lessons/5_6 Local Choice/Trekkers_Trail_Runner (2).html`, each with and
  without a trailing slash). Reported by `check_estate_map.py`, not failed: the
  subject is the census, not the map.

## The gate did not catch a vacuous pass, and that was measured

Added on the 2026-09-09 ruling: *red-prove the gate against a planted vacuous
case — a route that answers 200 with the moved_page stub. If the gate does not go
red on that, it does not stop this class.*

**It did not.** The planted case, which is the exact shape found in the estate:

```bash
for route in / /games/ /Lessons/ /tools/; do
  curl -fsS --retry 3 "https://madebymatt.uk$route" >/dev/null
done
```

scored the origin `TARGET / ok` and produced **no finding at all**. Two reasons,
both structural: the Play route was an unquoted shell word, and the join was an
interpolation — neither is a shape a literal-and-join scan can see.

That gap mattered more than the wrong origin that started this. A wrong origin
goes red and gets attributed. A vacuous check **passes**: the education tree
answers a Play route with the stub at HTTP 200, so `curl -fsS` succeeds, and the
check goes on proving nothing about the tree a reader believes it tests, for
ever. A red gets attributed; a pass that cannot fail gets believed.

### What was added

`VACUOUS_EDU_LOOP`, a **failing** class. It fires when an education origin is
glued directly to a variable — `"https://madebymatt.uk$route"`, `${edu}${route}`
— and that variable's own literal domain contains a Play route. The domain is
resolved three ways: a shell `for VAR in …` list, an array literal, and a
`for (const r of ROUTES)` that inherits the array's domain two hops from the
join. The glue is required: an education base that is never interpolated is a
different shape and is not this class.

### Red-proved, seven cases, and the third one failed first

| | |
|---|---|
| RED | the ruling's planted shell loop |
| RED | same shape, braced interpolation `${r}` |
| RED | array-literal domain, two hops from the join |
| GREEN | the same loop over education routes only |
| GREEN | Play routes fetched from the Play origin |
| GREEN | an education base that is never interpolated |
| GREEN | the whole vacuous shape inside a comment |

The four GREEN controls are the half that matters: a gate that reddened correct
usage would be worse than no gate.

The array-literal case **failed on its first run**, and the reason is worth
keeping: the routes were bound to `ROUTES` and the join used `r`, so the resolver
had no domain for the variable actually being interpolated. Propagating the array's
domain to the loop variable is what fixed it — a detector that only understood
one-hop bindings would have passed its own self-test while missing the shape in
any JavaScript verifier.

Folded into `--self-test`, which now runs **13 cases** on every invocation rather
than as a one-off script.

### One thing the self-test itself got wrong

The comparison took `sorted(...)[0]` of the verdicts a fixture produced. The
array-literal fixture legitimately trips **two** classes — it is also a genuine
`JOINED` — and `JOINED` sorts before `VACUOUS`, so the run reported a failure for
a case that had in fact fired correctly. The comparison is now membership: a RED
case must contain its expected verdict, and a GREEN control must come back
completely empty. Stricter on the controls, accurate on the reds.

### What it does not catch

The reverse direction — a **Play** base interpolated over an **education** route
— is not detected at all. `tools/verify_surfaces.js:84` is that shape, and this
gate is blind to it: the detector is deliberately one-directional, because the
education tree's stub is what makes the education-origin case pass vacuously,
and the Play origin has no equivalent stub. Saying so plainly rather than
implying the class is covered: the mirrored detector belongs with the retarget
PR that fixes the one instance, where it can be red-proved against a real
subject instead of a hypothetical one.

The findings it does not fail on are still reported. Across Lessons and Apps the
gate now exits 1 on three real instances — `mbm-cross-estate-unification.yml` at
Apps `:228`, Lessons `:245`, and a third copy at
`Lessons/tools/fixtures/pr124/workflows/…:233` that the sweep had not found. The
Site tree alone stays green, which is what lets this PR land while the rename is
scheduled elsewhere.

## The sweep: twenty more, recorded and not fixed

The per-file census is a literal-and-join scan, so a second pass hunted the
shapes it cannot see — origins handed in from workflow YAML, live steps gated
off, the reverse direction, and the pre-split host. What it found is larger than
the class this PR fixes, and none of it is fixed here. It is listed so it is
owned rather than rediscovered.

### Two vacuous passes, which are worse than the reds

A red gets attributed. A pass that cannot fail gets believed.

**`mbm-cross-estate-unification.yml`, Lessons `:245` and Apps `:228`** — the
`live-proof` reachability loop:

```bash
for route in / /games/ /Lessons/ /Matt-s-Apps-/ /tools/ /resources/; do
  curl -fsS --retry 3 "https://madebymatt.uk$route" >/dev/null
done
```

`/games/` on the education origin is not the Play shelf. Verified in this
repository: `build_education.py:275-276` writes `moved_page('/')` to
`games/index.html`, so the education tree answers `/games/` with the ~2KB
"This game has moved" stub at **HTTP 200**, and `curl -fsS` is satisfied by it.
Five of the six routes are checked meaningfully. The sixth reads as a Play-shelf
reachability check and is a stub-existence check; it cannot fail for the reason
a reader would assume it fails. Not wrong for the gate's stated job — the route
does legitimately exist there — but the assertion's name over-promises what it
proves.

**`tools/verify_surfaces.js:84`** — `get(BASE + '/main/')` with `BASE` defaulting
to the Play origin. `/main/` is an education route.

### Thirteen live proofs that never run on a pull request

`townlife-verify.yml:297` is not one workflow's quirk. The same gate — `push` and
`refs/heads/main` only, or `deployment_status`, or a dispatch input defaulting
false — keeps a served-bytes proof off every pull request in:

| repo | workflow |
|---|---|
| Site | `townlife-verify.yml:297`, `maker-splash-canon-verify.yml:149`, `hc3-stub-handoff.yml:103`, `verify-games-audience-faces.yml:336`, `v4-games-deployment-verify.yml:163`, `mbm-audience-discovery-closeout.yml:1268` |
| Lessons | `mbm-cross-estate-unification.yml:211`, `science-teaching-packs.yml:62`, `fieldops-p2-and-sweep.yml:341` |
| Apps | `verify-teesside-maker-lab-pro.yml:39`, `verify-lundyloop-professional-os.yml:94` |
| Games | `play-domain-publication.yml:132` |

Each is individually defensible — a PR has no deployment to measure. Together
they mean **the estate's served-bytes contract is asserted only after merge**,
and a wrong origin inside one of them is invisible until it is on `main`. That is
the mechanism by which `verify_live.mjs` stayed broken from the day it was
written, and it is a governance question rather than a bug.

### The reverse direction, and the pre-split host

* `tools/verify_published_live.mjs:173` — every path in `PATHS` is fetched from
  `ORIGIN`, tool routes included, though `--tool-path` names education routes.
  The workflow's own comment at `published-live-verify.yml:149-153` describes a
  split the verifier does not apply.
* `Lessons/tools/verify_served.mjs:84` — `APPS_ORIGIN` defaults to the pre-split
  `https://mattroper1977.github.io/Matt-s-Apps-` and is a request target, joined
  to the Teacher Studio route. It works only because GitHub still 301s the
  user-Pages host to the CNAME — a redirect this estate elsewhere declares no
  longer load-bearing.
* `townlife-verify.yml:99` — the `block_live_origin` control poisons
  `mattroper1977.github.io` only. Post-split the origins a regression here would
  actually reach are `madebymatt.uk` and `www.madebymatt-play.uk`, and the
  control blocks neither, so it no longer arms against the origins that matter.

### Why none of it is in this PR

Most of it is in other repositories, which a Site pull request cannot touch. The
gated-step pattern is a decision about when served proofs should run, not a
defect to patch. And converting a verifier whose served subject is itself red
today would mean inventing the expectation — the thing BACKLOG §5a says started
the drift. The standing gate added here stops the class growing; this list is
what already exists.

## The map had to be told not to publish itself

Caught by CI, not by me, and worth recording because the fix was a one-line
change and the wrong fix was tempting.

`agx1-live-verify.yml`'s step *"Reproduce the candidate publication from the
merge ref"* went red on this branch:

```
ValueError: Education file admission blocked publication:
UNREVIEWED education-site/data/estate-map.json
```

The education tree admits files by a reviewed hash
(`domain-split/education-publication-admission.json`, 193 files for
`education-site`). A new file under `data/` is published by default, and an
unregistered published file blocks the build — correctly, because that registry
is what stops unreviewed content reaching a served page.

The tempting fix is to register the hash. That would be wrong: this file is
**generated**, from this repository's own classifier, whenever the split changes,
so a review-gated hash on it would demand a registry edit on every regeneration
— review friction on a derived artefact, which is exactly what a review gate
should not be spent on. It also serves a reader nothing.

`education_policy.SOURCE_ONLY` is the estate's existing name for a repo-internal
file that is not published, and it already holds `data/source-manifests/games.json`,
`data/hud-coverage.json` and `data/audience-homepages.json` — the same kind of
tooling input. So `data/estate-map.json` joins it, and because
`build_estate_map.py` reads `SOURCE_ONLY` directly, the map's own exclusion set
picks the entry up without a second edit.

**Three other paths reported `CHANGED` in the same failure**
(`domain-catalogue.json`, `resource-discovery.json`, `usage-registry.json`) and
they are **not** this branch's. Running the identical build on `main` with the
same local inputs reproduces all three; this check also passed on #341 an hour
earlier against the same base with CI's own Lessons checkout. They are a stale
local Lessons SHA, not a defect — established by running it rather than by
assuming it, because the honest failure mode here would have been to "fix" three
files that were never broken.

### An imprecision this codifies, stated rather than hidden

`SOURCE_ONLY` covers two different things: files Play serves and education does
not (`data/source-manifests/games.json`), and files **nobody** serves (`README.md`,
`BACKLOG.md`, and now the map itself). `originFor()` reads "absent from
education" as "Play", so it answers `Play` for the second kind too. No verifier
requests any of them, so nothing is wrong today — but the map now says something
about `/data/estate-map.json` that is not true, and a later reader deserves to
know that rather than discover it. Splitting the two would mean a third axis
derived from the built Play tree; it is not needed by anything this PR does, and
inventing it now would be building for a caller that does not exist.

## Not done

No assertion was retired. No count or hash was re-pinned. No workflow trigger,
permission or condition changed. The education half of the tree check is
reported rather than asserted, because it needs a three-repository build this
gate does not take — said plainly rather than left to look like coverage.
