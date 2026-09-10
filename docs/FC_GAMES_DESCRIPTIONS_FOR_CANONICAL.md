# Six game descriptions — verified, written, and NOT applied here

`DESCRIPTIONS=verified-only` (D3) asked for these and they are ready. They are not in
this PR, and the reason is a ruling of yours, not a limitation of the work.

## Why they are not here

`data/source-manifests/games.json` in this repository is **a mirror, not a source**.
`tools/render_games_manifest_mirror.py` says it plainly:

> Ruled by Matt 2026-08-13, closing the two-shelves divergence… the served arcade fetches
> `/Games/games.json` at runtime, and that URL serves the **Games** repository's
> `games.json` — so THAT file is the canonical shelf and single writer. This repository's
> copy… is from now on a MIRROR: byte-for-byte the canonical file, produced by this tool
> and nothing else. **Hand edits to the mirror die at the next `--check`.**

I edited the mirror. The next `--check` killed it, exactly as designed — the
`Shelf mirror is not stale` job went red on this PR's first run. That gate did its job.

The edits are reverted: `games.json`, `lessons-resources.json` and the derived
`mbm-search-index.json` are all **byte-identical to `main`** in this PR. The 2026-08-12
two-shelves incident cost the estate a day, and honouring the single-writer ruling matters
more than landing a copy improvement a day sooner.

## What to apply, and where

Repository **`MattRoper1977/Games`**, file `games.json`, field `desc`. Then re-mirror here:

```
python3 tools/render_games_manifest_mirror.py --canonical /path/to/Games/games.json --write
python3 tools/build_mbm_search_index.py --write --expect-diff <each changed leaf path>
python3 tools/render_audience_homepages.py
```

### The six

**1 · Globe Snake** — *dev jargon*
- before: `A unique 3D spherical twist on classic mechanics, mapping directional inputs onto non-Euclidean global surfaces.`
- after: `Snake, but wrapped around a planet. Steer around the globe, stretch your tail longer and hold to sprint — and unlock new skins as you clear planets.`
- verified in `Globe_Snake (1).html`: sprint is a hold control; skins carry unlock conditions ("Clear Planet 1", "Conquer all 6 planets"); tail grows.

**2 · Neon Snake Overdrive** — *dev jargon + American spelling*
- before: `An optimized, high-performance vector snake arena calibrated for fluid mobile and desktop response pathways.`
- after: `A neon snake arena. Steer with the arrow keys, WASD or a swipe, eat to get longer and pick up speed, then put your initials on the high-score table.`
- verified in `Neon_Snake_Overdrive.html`: the control line is verbatim from the game; local high-score table takes initials.

**3 · Trail Runner** — *dev jargon + teacher-voice*
- before: `A fast-paced reflex runner navigating procedural terrain hazards. Ideal for a quick motor-skills reset.`
- after: `A fast reflex runner. Jump the hazards, keep your lives and take on the challenges as your journey goes on.`
- verified in `Trail_Runner.html`: jump, lives, obstacles, a CHALLENGES screen and a YOUR JOURNEY screen all exist.

**4 · One Guy** — *teacher-voice, minimal edit*
- before: `…so pupils compete against their own past best rather than each other.`
- after: `…so you race your own past best rather than anyone else.`
- everything else in that description is unchanged.

**5 · Kids vs Staff: Showdown** — *teacher-voice*
- before: `Whole-class team quiz: pupils take on the staff across scored rounds. Class-vs-teacher framing — no individual leaderboard.`
- after: `Whole-class team quiz: your class takes on the staff across scored rounds. Teams score, not individuals — no individual leaderboard.`
- the no-individual-leaderboard fact is kept deliberately (FC3.3: accessibility and design facts are kept, not deleted).

**6 · World Cup: Road to the Three Lions Final** — *teacher-voice, minimal edit*
- before: `Teacher-driven end-of-term tournament:`
- after: `An end-of-term tournament your teacher runs:`
- not one feature claim was touched. The VAR twist and the evidence print could not be
  verified from the artefact's visible text, and D3 says do not write what you cannot
  verify — but deleting a real feature is worse than leaving it, so only the voice moved.

## The trap in these, worth carrying forward

My first drafts of 1 and 2 said **"grow your tail"** and **"eat to grow"**.
`build_mbm_search_index.py` derives `pathway` by word-boundary match and **`grow` is the
GROW teaching pathway** — both arcade games would have been filed under a teaching pathway,
in search, silently. The generator caught it. Whoever applies these must keep the wording
free of `build`, `grow`, `launch`, `asdan`, `uas`, `primary`, `gcse`, `igcse` and `tutor`,
or check the generator's diff for an unexpected `pathway` change.
