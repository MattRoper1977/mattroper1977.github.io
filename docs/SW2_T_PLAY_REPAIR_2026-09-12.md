# SW2 Part T published chrome and Play shelf checks

This increment adopts the approved cream/navy palette in the existing published
Education header. It also restores the Echo Vault and Relicforge checks against
the UX2 shelf that is actually served. Full Part T and Play promotion remain open.

Rollback/base: Site `179005a1eeb1c904b98b091ce9fe7a96f2171b8f`.
Fresh mains: Lessons `fd95ef4cc636b31d96b6b83fc33faff0c64f383d`,
Apps `2055df24d97d1f6a362be509832767f31c19f5db`,
Games `809b6c9a65f175cd48182e793bee166ad4f6bd3f`.
Site #354 and T5R1 are complete and are not replayed.

## Published chrome

`domain-split/shared-navigation.css` consumes the existing background, primary,
card and accent tokens, with the same approved values as fallbacks for older
pinned consumers. The blue expandable menu retains its palette and all groups.
The 3px focus ring is green on the light header and mint inside the menu.
Scoped priority is necessary: the Apps hub's existing important focus rule
otherwise overrides the menu ring with brown, below 3:1 on navy.

The header/menu wrappers, branding bytes, route-derived links, authored bodies,
footer, source stamps and token file are unchanged. The original silver asset
has not been recovered; the current published mark is retained under SW2 §10.
No claim of completed brand convergence or the later body redesign is made.

The admission change is exactly one served path, `assets/shared-navigation.css`:
retain its current digest and add the candidate digest as a two-value pair.
No retirement, new path, widened limit, consumer pin or workflow edit is included.
The closed T5R1 historical retirement is not reused as broader authority.

The existing `check_shared_navigation.cjs` now measures real keyboard focus on
the closed header and open menu in both enhanced and no-JavaScript runs. It
plants a ring identical to the surrounding surface, requires that same checker
to reject it, then restores and rechecks. No gate is relaxed.

Local component census uses the preserved reviewed Education publication,
overriding only this CSS asset: 31 declared surfaces at 390 and 1280 pixels,
all visible chrome controls at least 44px, text contrast at least 4.5:1 and
focus contrast at least 3:1. This is candidate component evidence, not a new
publication or a claim that every authored page body meets Part T's design.
The unchanged source stamper passes 12/12; publication tests pass 24/24;
token contrast remains 34 pairs across two palettes.

## Play checks

The old shared probe expected `#group`, 69 cards and the old showcase. UX2's
Play ledger explicitly retires that selector, groups series editions in the
catalogue grid, and moves seven activities to separate classroom/staff rows.
The actual public shelf confirms this layout. Restoring the retired selector
would change the approved product to satisfy an obsolete instrument.

The replacement retains the independent Games manifest and accepted 62+7 W7
population. It checks presentation identity, title, audience, approved series
and genre against the canonical records before checking every rendered card,
including all collapsed edition links and accessible titles. Genre/search
results and counts are checked against the matching game population; classroom
and staff rows retain separate labels and destinations throughout. Featured
selection, empty/clear behavior, viewport overflow, no automatic game launch,
and visible edition links without JavaScript are checked.

Both real consumers passed at 320/390/1366: 62 games in 58 cards, seven activity
rows, seven genres, no page errors, no-JavaScript coverage, and four real DOM
mutation/restoration controls each. Seven additional series representation
controls reject missing/duplicate editions and altered identities/titles/genre;
all earlier population, HTTPS, foreign-origin and paired-deletion controls remain.
Local browser observations use Chromium 139 through the environment's HTTPS
proxy; its certificate is not trusted by Chromium, so the local harness alone
ignores that certificate. The committed checker does not ignore TLS errors;
GitHub's unmodified live workflow must independently pass before landing.

## Remaining boundaries — not completed by this increment

- Held Lessons #456 still overlaps `index.html`, `subject.html`,
  `assets/mbm-tokens.css`, `tools/sw2/check_tokens_inert.cjs` and
  `tools/verify_cross_estate_unification.py`. The existing exception is for L,
  conditional on T; it does not reopen #456 or supply a general T exception.
- Games' owner-managed pin run `34717335375`: Site job `103616821035`
  rejects RallyVector at 10→36 idle RAF callbacks/600ms (cap 20).
  AS1's `as1RenderDue` suppresses rendering while idle, but `frame()` still
  unconditionally schedules `requestAnimationFrame(frame)`. The performance
  gate counts invoked callbacks, not WebGL clears. Repair scheduling in the
  pilot's owner scope; do not weaken that gate or relabel the rejection.
- The same run's Lessons job `103616821148` passed all 69 performance
  comparisons and staged #79 at `f165706b68c3065a0ba0ca81d9e81dcacf09de74`,
  selecting current Lessons `fd95ef4`. GitHub then refused the merge:
  “2 of 2 required status checks are expected.” #79 is no longer the stale
  d019 candidate described by earlier checkpoints, but it is still unmerged.
- #78 remains the owner's older Site candidate. Neither fixed pin branch is
  changed by this PR. The canonical Play token URL still returns 404.
  Owner-managed promotion and an exact-source composed/live token proof are
  required before `SW2_T_OK`.

No `SW2_T_OK`, `SW2_P_OK` or `SW2_CLOSED` is issued here. The independent
component/checker repair is reviewable and may land on its own green evidence.
