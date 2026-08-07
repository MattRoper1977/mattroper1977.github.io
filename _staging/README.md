# `_staging/` — built, proven, NOT published

Nothing here is on the shelf, in the sitemap, or reachable from the site.
GitHub Pages runs Jekyll on this repository and Jekyll excludes directories
whose names begin with an underscore, so `_staging/` is not served. That is
deliberate, and it is proven rather than assumed: the live gate fetches
`/_staging/` and requires 404/403, failing on anything else — including a
transport error, because unreachable-for-unknown-reasons is treated as
reachable until proven otherwise.

**Why a game sits here rather than at its own path.** Red line R1: a game's
directory, shelf entry, sitemap line, collection field and marker state land
together or not at all. A folder live at its published path while the shelf
knows nothing about it is a half-publish; a shelf entry pointing at a folder
that is not there yet is the same defect from the other side. Both are worse
than a held branch.

Work that is finished and proven but whose publish stage has not run waits
here, in full, with its gate.

## Current occupants

**None.** Ouroboros and Nova Siege both published this sitting; their staging
trees were moved, not copied, so no orphan copy is left served. If this file is
the only thing in this directory, that is the correct resting state.
