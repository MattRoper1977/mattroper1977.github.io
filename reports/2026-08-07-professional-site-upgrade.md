# Made by Matt professional site upgrade — implementation report

**Sentinel:** `mbm-site-professional-design-upgrade-2026-08-07`
**Target:** `MattRoper1977/mattroper1977.github.io`
**Starting main:** `44e2ca04cd39e26a91de0c61f925c690d12ceaf0`
**Working branch:** `codex/mbm-site-professional-design-upgrade-2026-08-07`

## A. Estate discovered

The exact branch snapshot recorded **328 files: 46 HTML, 4 CSS and 85 JavaScript/MJS/CJS files** before this implementation. The principal live entry surfaces are the homepage, Games, Tools, Resources, Members, Privacy and Stats pages. The homepage is driven by `site.json` and `assets/mbm-doors.js`; Resources consumes `data/resources.json` plus the Lessons catalogue; Games consumes the Games manifest. Those existing sources of truth were retained.

The existing visual identity is already distinctive: navy, mint, amber and cream; compact Made by Matt branding; rounded cards; editorial headings; illustrated card art; reading-background themes; and a mixture of inline page CSS and shared assets. The problem was not an absence of identity but inconsistent execution between major pages.

Related repositories were inspected read-only:

- `MattRoper1977/Lessons`: `resources.json` and repository search prove real subject resources and BUILD/GROW/LAUNCH material, including Science, Art, Humanities and LAUNCH entry points.
- `MattRoper1977/Games`: `games.json` is the catalogue source of truth; no game runtime was changed.
- `MattRoper1977/Matt-s-Apps-`: the live Creator Hub contains actual tools including Web Studio, Now/Next Board, Exit Ticket, Graph Studio, Mindmap Studio, Writing Frames, Quiz Studio, Seating Studio, Rubric Studio, Classroom Toolkit and other studios.
- `MattRoper1977/Games-`: repository metadata reports a size of zero, so it was not treated as a second live catalogue.

## B. Design problems found

### UX and information architecture

- The homepage did not give teachers, pupils, organisations and partners a fast route into the same estate.
- All secondary destinations competed at the same visual level in the header.
- The account surface presented a client-side password modal despite there being no configured server-side identity provider.

### Visual design and consistency

- Major pages used different navigation markup, labels, active-state conventions and responsive behaviour.
- The homepage desktop header wrapped because it exposed nine links, a login control and five theme swatches at once.
- Games used a separate header pattern and had no compact mobile menu.
- Reusable card, focus and interaction treatments varied between pages.

### Mobile and accessibility

- Navigation wrapped rather than becoming an intentional mobile drawer on several surfaces.
- Theme swatches measured 42 × 42 CSS pixels before correction.
- Escape dismissal, focus return, outside-pointer dismissal and body scroll locking were not provided consistently.
- Horizontal shelves did not have a shared keyboard affordance.

### Technical robustness

- `app.js` assumed the menu and navigation elements always existed.
- Theme controls assumed a fixed legacy mount point.
- The same page family duplicated navigation behaviour instead of using one progressive layer.

## C. Changes made

### New shared platform layer

- `assets/mbm-platform.css` — derived Made by Matt design tokens; one sticky responsive header; primary/secondary navigation hierarchy; mobile drawer; 44-pixel controls; focus styles; audience cards; card polish; reduced motion; print safeguards; and back-to-top presentation.
- `assets/mbm-platform.js` — guarded progressive enhancement for mobile navigation, mutually exclusive disclosures, Escape/outside dismissal, focus return, active-link reflection, keyboard shelf scrolling, purposeful reveal effects and back-to-top behaviour.

### Upgraded entry surfaces

- `index.html` — shared header, audience-first route map and removal of the inactive client-side login/password modal.
- `games/index.html` — shared navigation and mobile menu while preserving the existing arcade content and inline Made by Matt mark exactly.
- `tools/index.html` — shared navigation and theme placement without changing tool copy or destinations.
- `resources/index.html` — shared navigation and theme placement while retaining manifest-driven search/filter behaviour.
- `members/index.html`, `privacy/index.html`, `stats/index.html` — consistent chrome, navigation and responsive behaviour without rewriting page body copy.
- `theme.js` — supports an explicit shared-header theme slot while retaining its legacy fallback.
- `app.js` — null-safe legacy menu binding.

### Evidence and maintenance

- `tools/verify_professional_site.js` — dependency-free static gate covering identity, authored wording, shared assets, routes, duplicate IDs, authentication safety, responsive/accessibility contracts and a deliberate broken-fixture positive control.
- `.github/workflows/professional-site-design-audit.yml` — runs the verifier and its positive control against the PR base before creating the exact-source audit artifact.
- This report — permanent measured handover evidence.

The Made by Matt brand assets and per-page logo markup are compared to the base by the verifier and remain unchanged. Existing body wording is also compared after excluding only the deliberately replaced page chrome, the new functional audience labels and the removed authentication UI.

## D. Audience architecture

The homepage now has four visible routes, each backed by existing destinations rather than invented services:

- **Teachers:** Teacher Tools, Lesson Hub, Full catalogue.
- **Pupils & learners:** Games, Lessons, Full catalogue.
- **Schools & organisations:** Tools, Stats, Privacy.
- **Partners:** About, Say hello, Follow the work.

The global header now gives five primary destinations — Games, Lessons, Apps, Tools and Resources — with Stats, Members, About and Privacy grouped under a native **More** disclosure. Reading backgrounds sit under a separate **Display** disclosure. This keeps the breadth available without forcing every destination and every swatch into one row.

No trust, council, school, partner, usage or impact claim was added. The architecture makes the existing offer legible to those audiences without pretending that a relationship already exists.

## E. Interaction improvements

- Mobile menu with stable ARIA state, scroll lock, Escape close and focus return.
- More and Display disclosures that close one another rather than stacking panels.
- Reading-background controls kept available but visually secondary.
- Active-page navigation treatment.
- Keyboard arrow scrolling for overflowing horizontal rails.
- Progressive section reveal only when `IntersectionObserver` works; content stays visible without JavaScript and under reduced motion.
- Long-page back-to-top control.
- Shared hover, focus and touch feedback, with hover never required for access.

## F. Cross-repository work

The Lessons, Games, Matt-s-Apps- and Games- repositories were read for discovery only. **No related repository was changed.** The main site continues to consume the existing manifests and mounted destinations; no duplicate catalogue was introduced.

## G. Testing performed

### Static and positive-control gates

- `node tools/verify_professional_site.js --base HEAD --self-test`
  - current implementation: PASS;
  - deliberately broken audience fixture: correctly rejected with two detected defects;
  - restored implementation: PASS.
- `node tools/verify_home_doors_baseline.js site.json`
  - 13 doors derived from the file;
  - unique href/count-key and one-door-per-game invariants: PASS.
- `node tools/verify_home_doors_baseline.js --self-test`
  - malformed fixtures rejected and valid control accepted: PASS.
- `node --check` on `assets/mbm-platform.js`, `tools/verify_professional_site.js`, `app.js` and `theme.js`: PASS.
- `tinycss2` parse of the shared stylesheet: 178 rules, 0 parse errors.
- `git diff --check`: PASS.
- Seven key pages: one H1, one main landmark, one named navigation landmark, 0 duplicate IDs.
- Brand asset diff: 0 changed files.
- HTML password/account trigger scan: 0 password inputs, 0 `mbmAuth` dialogs and 0 `mbmAccountBtn` triggers.

### Browser and visual checks

Chromium was driven through the DevTools protocol against a local HTTP server.

- Widths checked: **320, 360, 390, 430, 768, 1024, 1280 and 1440 CSS pixels**.
- Primary final captures: homepage, Games, Tools and Resources at desktop and mobile.
- Secondary final captures: Members, Privacy and Stats at desktop and mobile.
- Total final page/viewport captures: **14**.
- Mobile menu exercised on homepage, Games, Tools and Resources.
- Visible navigation targets: 46 pixels high; theme swatches: 44 × 44 pixels.
- Horizontal overflow: 0 on all measured surfaces.
- Escape dismissal, focus return, mutually exclusive disclosures and saved dark theme: PASS.
- Reduced motion: reveal content visible, transitions suppressed and scroll behaviour automatic.
- Members, Privacy and Stats captures: 0 console/log/HTTP problems.
- Homepage/Games/Resources local captures produced only the expected 404s for `/Lessons/resources.json` and `/Games/games.json`, because the isolated main-site snapshot did not mount the sibling repositories. No other runtime problem was recorded. These mounted manifest requests must be re-proved on the served deployment.

## H. Deployment

Implementation is staged in draft PR **#92**. Commit, check, merge and served-site evidence are appended when publication completes; a commit is not treated as deployment proof.

## I. Outstanding opportunities

- Real Teacher/Pupil/Organisation/Admin accounts require an actual server-side session system or established identity provider, role/permission design, data-controller decisions and verified recovery/security behaviour. No role login was invented in this static-site change. The current configuration contains no Supabase URL or anonymous key.
- A later, separately scoped pass could adopt this shared shell inside selected Lessons and Apps entry pages. Those repositories were intentionally not rewritten during a main-site architecture change.
- Sibling-manifest 200 responses, live console state and final responsive output remain the publication gate and are not claimed until checked on `madebymatt.uk`.
