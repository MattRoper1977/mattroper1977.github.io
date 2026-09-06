# HC3 independent Play source releases

Recovery baseline and rollback: Site `cd7c0568865c44300a2a8c8de10512af9d982165`; Games `4b3976a2bd7f8d378cbe73ffc839ca7e768a841b`. Preserve both source branches and existing release pins.

The two singleton Orbital evidence hashes created a dependency cycle: advancing Site first rejects the old Lessons payload; advancing Lessons first rejects the new payload. Site #279 repaired Education publication but cannot by itself advance both independent Play pins.

This correction records both already reviewed Orbital versions, each bound to repository, source path, route, reviewed commit, Git blob and raw/published SHA-256. The builder derives the actual checkout HEAD and blob; the browser gate independently re-derives them before retaining its HTTP-byte comparison. Unchanged blobs remain valid at later source HEADs. Unknown bytes, altered identities, fabricated reports and missing/duplicate approvals remain failures. No game, media, control, provenance or storage bytes change.

Local evidence: both 69-route trees built with zero missing/third-party initial references. Each revision passed real output → one planted byte rejected → restored output accepted in both gates. Additional controls reject wrong repository/path, fabricated HEAD/blob, invented context and consistent but unreviewed source bytes. CI repeats this matrix and the established Play browser checks.

Release proof remains required: full applicable PR checks → Site merge → independently regenerated Games pin PRs from current Games main → full Play checks → published artifact/source SHA and live bytes. Historical `pin-release/*` branches must not be reused as current candidates because they contain older counterpart pins.

Separate external blocker: Games run `34051249733` reached PR creation after its gates, then GitHub refused permission to create or approve PRs. Required repository setting: Settings → Actions → General → Workflow permissions → **Allow GitHub Actions to create and approve pull requests**. This setting has not been changed by this recovery. The automation is not counted complete.
