# SW2 T — published header template extraction

The Education publisher previously defined its complete header and menu wrapper
inside `domain-split/shared_navigation.py`, independently of the shared chrome
files. It now renders the `published-education` fragments in
`tools/chrome/header.html` and `tools/chrome/menu-sheet.html`. The same publisher
still derives the menu groups, audience subset, current route, search target,
reading-theme control and final Play link. The output is byte-identical for
the measured inputs below.

This is a bounded Part T foundation change. R-T3's marker and preservation
scope remains: the existing source-page fragments and adult/pupil/play variants
are unchanged. The source stamper's historical `0ad6b82` pin still identifies
its unchanged tokens/menu fragments; the published fragments are read from the
publisher's own immutable Site checkout. They require no runtime fetch. The
existing publication classifier excludes `tools/chrome/`, `domain-split/` and
`docs/` from served files.

Base and rollback: `bf7964758afd3d9e58e58ba58eb2048815917a09`.
Base tree: `37568d76595f44bdf161b982d04ccabccd97e13e`.
Old renderer SHA-256: `156af1ae569f2401c78e84ffc2d2df764ba6c76b14d8155499bd395c3c3dc798`.

Local evidence, 12 September 2026:

- All 192 saved old-renderer cases match exactly, authenticated again against
  the base commit's renderer. They cover every combination of adult, pupil,
  reading theme and primary flags, plus local, fallback and escaped search.
- All 31 declared navigation surfaces also produce identical header bytes.
  Their search/theme inputs are read from the preserved reviewed publication;
  this is a header comparison, not a new full build, browser or served proof.
- The existing publication test suite passes 24 tests, including four new
  controls for malformed fragment boundaries/slots, consumption of both actual
  template files, and one-pass escaping of record values.
- The unchanged structural suite passes 11 tests. The legacy chrome check
  reports zero failures; source stamping matches on all 12 pages. Professional
  preservation passes against the exact base above.
- No changed path overlaps the four files in held Site #291.

Parity report SHA-256:
`209ca928b6addabca861da434bf6fa0f8b3d9b2d1725a250dea5662f0bfa2c25`.
The one-time harness, inputs and report are retained in the SW2 continuation
evidence. They do not impose a permanent header snapshot on later design work.

Existing CI already runs the new controls and the composed navigation browser
gate; no workflow is changed. Publication and served evidence must be recorded
against the actual landing SHA before calling this pass released. Consumer
publisher promotion remains with its existing owner. This change does not
issue `SW2_T_OK`, close the Play token gap, or begin Part L.
