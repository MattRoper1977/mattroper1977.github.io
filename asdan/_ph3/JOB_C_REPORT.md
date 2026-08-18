# PH-3 JOB C REPORT — ASDAN register tool (`asdan/app.html` v2.6 → v2.7)

Site BASE `main` = `8af7bbc2560515d2af114f1df5ca89053aceb2ec`; `asdan/app.html` measured at
89,692 B, sha256 `e92239177d06…` — byte-matching PH-3 §6's measurement before any edit.
Branch `pass-ph3-asdan-tool`. Diff scope: **only `asdan/app.html`** (+ this docs file).
This report lives in `asdan/_ph3/` because the site repo keeps no `_passph3/` tree — noted per §6.

## Applied

- **C1** BUILD preset `ceiling:"Award"` → `ceiling:"Short Course certificates + AQA UAS — no
  PEQ qualification"` (a PEQ Award without PEQ registration is not a thing). The
  "…no PEQ registration." note stays. Both `pw.ceiling` render sites read sensibly with the
  new string ("Working toward …" banner and the preset preview) — proven at runtime.
- **C2** Credit wording at **all five** `creditsFromHours()` render sites (§6 quoted two; three
  more were measured and carry the same claim): the tracker banner ("claimable"), the closing
  checklist row, the print totals (×2) and the closing-letter sentence now read
  "≈ N credit-equivalents (10 h ≈ 1 credit — a planning estimate; PEQ credits are awarded per
  unit achieved, not per hour banked)" (inline sites use the short "≈N credit-equivalents"
  form). `creditsFromHours` itself is byte-untouched — v2.5 backups and totals unchanged.
- **C3** LAUNCH preset (its strands name Hospitality) — note now appends: "Hospitality here is
  the ASDAN Hospitality Vocational Taster — withdrawal announced: register/buy books by
  31 Dec 2026, final certification 31 Aug 2027."
- **C4** Dual-branding tidy: all 8 default/fallback/placeholder `"Progress Schools"` /
  `"Progress Schools Tees Valley"` strings → `"Your centre"` (2 input placeholders, the
  `S.settings` default, 3 `V25.school.name` init/reset/save fallbacks, 2 `||` render
  fallbacks). Saved settings untouched, no migration — proven: an imported backup's
  `centre:"Saved Centre Name"` wins over the fallback at runtime. Version: **no UI element
  displays a version** (measured — the only "v2.6" is a code comment); the export payload's
  `toolVersion:"2.6"` → `"2.7"`. `DB_VER`, schema and storage keys untouched (import gates
  only on `app==="asdan_register"`, verified in code and at runtime).

## C5 — PDFs: STOPPED (no generator exists)

No generator for `ASDAN_Programme_Playbook.pdf` / `ASDAN_Register_Staff_Guide.pdf` exists in
this repo or in Lessons (searched both). Binaries were **not** hand-edited. pdfplumber findings:

- **Both PDFs pass:** unit codes = ComSk1 only; provisional/coordinator line present; zero
  `Progress Schools` / OneDrive / SharePoint refs; no pupil names found; no 10-hour claim near
  Communication; no "multiples of 10" credit wording.
- **Stale sentences to fix when regenerated** (they mirror pre-C1 wording):
  - Playbook p-grid: "**BUILD 31 An Award** — ASDAN Short Courses (Living Independently,
    FoodWise…) and AQA Unit …" → should mirror C1 ("Short Course certificates + AQA UAS — no
    PEQ qualification").
  - Staff Guide: "What each pathway is working toward. **BUILD — an Award** (ASDAN Short
    Courses and AQA Unit Award, plus …" → same C1 mirror.
  - Playbook Vocational row names "ASDAN Hospitality / Gardening" with no VT-withdrawal note →
    C3's sentence belongs there on regeneration.

## Gates

- `node --check` on every inline script block: 0 failures. No new external requests (http(s)
  ref count 4 = base 4); `<script src>` count unchanged (1); hud.js loader retained.
- Runtime (jsdom 30 + fake-indexeddb, real handlers): boots with no console error; all three
  presets render with "Working toward", the new ceilings and the provisional line;
  `PATHWAY_MINS` = 53 and all 14 seeded pathway slots carry `mins:53` (53/53 unchanged);
  `creditsFromHours(53)`=5 / `(9.9)`=0 unchanged; a v2.5-format backup imports through the real
  `#bk-file` change handler (pupils, progs, saved settings restored).
- Deployment: verified from git truth + local checks only — the Pages API and madebymatt.uk
  are proxy-blocked from this session; **Matt phone-eyeballs after merge.**
