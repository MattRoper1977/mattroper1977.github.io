AS1 instruments — consolidated AS1 and AS1-R, 2026-09-11.

Run the regression scanner with: node tools/verify_no_boilerplate_regressions.mjs --root .
Run its firing controls with: node tools/verify_no_boilerplate_regressions.mjs --self-test
Run the placeholder scanner with: node tools/verify_no_shipped_placeholders.mjs --root .
Run its firing controls with: node tools/verify_no_shipped_placeholders.mjs --self-test
Run the original fallback experiment with: node tools/as1_reference_codec_audit.mjs docs/reference/ArcadeHost_ThirdParty_2026-09-11.html

The two default scanners derive their universe from git ls-files. Their successful self-tests validate the instruments and do not establish that the estate has passed a scan. Unresolved execution or markup paths return INCONCLUSIVE and nonzero, never an assumed green. The regression scanner isolates documents and follows explicit local script dependencies; an unrelated document cannot supply a gesture caller.

No directory exclusions were added. The deliberately defective quarantined originals will therefore produce findings if scanned as executable input. A future shipping-input assertion must prove its publication and import use sites; it must not waive every file under a broad path or relax a detection pattern. No whole-estate green or shipped-runtime clearance is claimed in P0.

Node 24 with its bundled Acorn 8.17.0 and Python 3 executed the recorded controls. The scanners refuse if their required parser is unavailable. Controls and original-source evidence are recorded in docs/reference/evidence/.

The strict regression and placeholder scanners are new tools; no pre-existing gate was changed. AS1 section3 stays held for Matt's pilot and HUD-census decisions.
