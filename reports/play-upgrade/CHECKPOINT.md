# Play upgrade — isolated ownership checkpoint

Recorded 6 September 2026, before product edits. Branch `codex/play-discovery-20260906` starts at Site `b06f9a02e69be6a991ad33419998b7b9f3f7dd8f`. Checkout: `/workspace/scratch/b31e825c031e/play-site`. Private build output: `/workspace/scratch/b31e825c031e/play-output`. Separate pinned Lessons checkout: `/workspace/scratch/b31e825c031e/play-lessons`.

## Exact editing boundary

- Play owner may add/edit `domain-split/play/**`, `reports/play-upgrade/**`, and Play-only verification workflow `.github/workflows/play-discovery-verify.yml`.
- New presentation, discovery runtime, supplementary evidence (keyed by existing catalogue IDs/routes), media, capture instructions and tests stay within that boundary. The existing catalogue remains the record source.
- Shared `domain-split/build_publications.py`, `build_preview.py`, `site-runtime.js`, preview templates, catalogue/schema/configuration, `education_*`, usage/privacy/statistics/account files and existing workflows remain coordinator-owned. Any necessary hook is delivered as a minimal unapplied patch under `reports/play-upgrade/integration.patch`.
- No game-engine edits, publication pins, DNS/Pages settings, production statistics changes, merge or deployment in this lane. Publication needs the Education coordinator's accepted integration or explicit assignment.
- The Education checkout has uncommitted edits in `build_education.py`, `check_usage_discovery.cjs`, `education_discovery.py`, `education_expansion.py`, `usage-client.js`, `usage_discovery.py` and new `education_policy.py`. They have not been copied or overwritten.

## Reconciled baseline

Games main `a7249dae2c0251a52ce5fe47b002efbee54412bc` pins Site `3bdbf6ef9d2d047e9ff318059cd59c5ce5717498` and Lessons `ccbe7a8bd70692fbf5a6c5352c7bf823c54f463f`. Existing `play-domain-publication.yml` checks out these sources and invokes the shared Site builder. Current catalogue contract is 62 main games + six classroom activities + one staff activity = 69 payloads. Preserve canonical browsing origin `https://www.madebymatt-play.uk/`; legacy builder's bare-origin config is a shared coordination point, not authorization to change it.

The exact original circular silver M asset is unresolved in the latest checkpoint. Asset research is ongoing; no invented substitute is accepted. Six fresh gameplay clips have not yet been captured. No new work is published.

## Integration order

Coordinator reconciles latest Education changes, reviews Play-only commit(s), applies the minimal hook, runs combined publication and privacy/separation gates, verifies media against final payload hashes and only then updates the existing publication pins in sequence. This checkpoint does not imply automatic cross-chat delivery or coordinator acceptance.
