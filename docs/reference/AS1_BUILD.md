AS1-G G3 implementation checkpoint — 2026-09-11
Status: AS1_PARTIAL. Source implementation exists; this checkpoint does not assert a composed-page browser pass, full green, merge, or production deployment.
Pilot: Rally Vector 3D, rallyvector3d/index.html, inline delivery. AS1_G2.md and AS1_G2_PROBE.json preserve the selection evidence and Matt's retained preference. No fallback was taken.
Independent work remains in draft Site #347. Runtime build is separately reserved in draft Site #348. This checkpoint is not a release instruction.

Ownership and rollback
The recorded G2 fence used live open-PR changed-file lists from Site and Lessons; none of the twelve retained candidates was owned by another open PR. Ownership must be refreshed before each further phase or publication action.
Original Site rollback: 85e3e02059c3e3314eddab03d6e3c842f0da7ec7. Lessons: aad04718c11a2396ecf323a662f55bf0e0c2441b. Games: 809b6c9a65f175cd48182e793bee166ad4f6bd3f.
G3 reservation: f6eb34189da034e6e86ff53954a53b1b32f4cf89 used the unchanged Site tree and opened #348 before game edits. Keep the original branch reservation and rollback notes in the PR body.
Only Rally's game file is changed by the build. The shared HUD, other games, education homepage, audience pages, hubs, Resources source, and publication pins are outside this implementation.

In-document host and generation
tools/render_arcade_pilot.py reads the declared pilot and generates one marked in-document region plus one marked hook region. It does not sweep the estate or use an iframe.
The original tools/render_inline_exit.py remains the canonical exit generator. The pilot generator first asserts that Rally's existing canonical exit region equals that generator's output. AS1_G2.md preserves the pre-build byte reproduction and mutation control. The runtime moves the original mbmexit-back anchor into the reserved bar while retaining its href.
The new region incorporates the existing estate token sources, the arcade CSS and libraries, and the pilot's restricted dependency on the existing save-adapter API. Its no-JavaScript exit anchor remains an href.
Rollout note only: 507 shared-src surfaces inherit a shared-include change automatically; 36 inline copies do not and must be REGENERATED from the generator, never hand-patched, whenever rollout expands beyond this pilot. This build does not change the shared include or regenerate other games.

Shell implemented in source
The phone layout declares Exit, Pause, Sound and More as icon-and-label controls. Exit reuses the canonical anchor with its own outline. More rows are derived from registered hooks; Rally registers Battery, Comfort and Save code. Controls without their corresponding hooks are omitted.
The wide layout measures the six controls with the actual fonts, gaps and padding, then derives its breakpoint at runtime. No measured breakpoint is recorded at this checkpoint.
The fixed bar writes its measured height to --as1-band; Rally's app reserves that height above the game area and the resize hook accounts for the available space. Non-overlap, target dimensions and the before/after aspect still require browser observations.
Separate user-paused and panel-paused flags feed game.paused. Closing a panel removes only its panel hold. Pause is disabled while a panel is open. This is the chosen Pause behavior; labels alone are not proof that it works.
The held game area receives the single word Paused with a dim layer. Active controls have inverse fill, border and/or tick cues in addition to colour. The panel has dialog semantics, explicit Done, focus movement and return, a keyboard loop that retains Exit, and an aria-live status line. No decorative drag handle is supplied.
Battery checks render timing separately from the existing fixed-step simulation. The source suppresses repeated drawing of a clean, inactive title scene. Zero idle paints, unchanged physics and completion remain browser claims to prove.

Comfort implemented in source
Warm screen uses a plain fixed rgba layer with pointer-events:none. Soften sound uses a low-pass node at 3500 Hz after the opted-in audio output. Audio-context creation is attached to trusted gestures; the output filter is connected only when the existing graph is available.
Both comfort preferences default off. The per-game key is mbm_rallyvector_as1_comfort. The adapter reads existing reduced-motion and calm settings; it does not create a second calm setting or rename an existing key.
The source wording is limited to pupil preferences. Actual spectrum, output attenuation, frame cost, denied microphone behavior if a call is found, and the banned-terms scan result are not certified by this checkpoint.

Cartridge implemented in source
assets/arcade/cartridge.js is an inert library. UTF-8 bytes, deflate-raw with a bundled API-disabled fallback, a version/kind/checksum envelope, URL-safe base64 and a reversible case-safe display layer are implemented. ASCII hyphen display and Unicode dash/whitespace normalization precede checksum validation.
The existing MBMGameSaves adapter remains responsible for validation, import planning, application and rollback. Rally restricts the existing transfer grant to its own exact save keys and reads its live save authorities for capture. No cross-game import path, second autosave system, or live key rename is added.
The pilot restore hook validates the full Rally shape before applying its plan; its catch path restores adapter writes and in-memory authorities. This source structure does not replace the actual wrong-character preservation control.
The save panel keeps pupil input on error and reports in-page text. Clipboard rejection uses a selection fallback. Codes larger than the configured clipboard class are downloaded; no QR is offered.
data/as1-sizing.json currently has measured:false and null paper/clipboard thresholds. Get save code refuses that unmeasured configuration. The rendered paper fit, non-clipboard fallback limit and file threshold must be measured and recorded before the final configuration is enabled.
AS1_CODEC.md records library-only controls separately. Those fixtures do not prove the pilot's composed save panel or existing state preservation. Four real panel paste forms and the wrong-character control remain pending here.

Storage census and registry
The tools collect resolved browser storage calls by receiver and call site, with reads separated from setItem/removeItem writes. The data registry records writers, consumers and explicit unresolved residue; it does not rename or delete a live key.
AS1_STORAGE.md and its compressed evidence record bounded resolved counts, dynamic expressions, unsupported storage forms and unproved profile-wipe survival. Their counts are lower bounds, not an exhaustive estate total. A source snapshot must be regenerated after subsequent source edits before that snapshot can describe the final tree.
The duplicate-owner gate deliberately remains red for existing independent writer collisions; its planted duplicate and missing-registry controls are separate from that estate verdict. No exemption or relaxed pattern is introduced to manufacture a green.

Ghost implemented in source
assets/arcade/ghost.js follows quantise, pack, deflate-raw and URL-safe base64. The accepted fragment is #ghost=. Samples contain numeric x, y, z and angle only; extra text fields are rejected.
The Rally adapter derives bounds from its own Track definition and samples the existing fixed-step run at 10 Hz, capped at 900 samples. A stage query selects only a declared existing track; no route is renamed or redirected.
Decoded geometry feeds the existing ghost visual. A malformed fragment is caught, the ghost is removed and an in-page message allows the pupil to continue racing. Actual clean-profile playback, quantization tolerance and corruption playability must still be observed.

Browser evidence pending at this checkpoint
UNMEASURED: all three state sequences, pause while a panel is open, visibility pause, four phone targets at 390px, the measured six-control breakpoint, reserved-band aspect, exit from every state and real Tab walks.
UNMEASURED: composed contrast for the bar and panels at both widths, grayscale active-state proof, duplicate IDs, actual placeholder control, first-paint delta, pilot byte delta, idle paints and render-only Battery behavior.
UNMEASURED: warm-overlay FPS at the lowest emulated profile, actual output spectrum with filter in/out and its mutation, microphone finding/failure path, preference persistence and final wording scan.
UNMEASURED: real-save encoded size; paper, clipboard and file thresholds; four composed-page paste forms; rejected typo retaining both text and existing state; clipboard-denied fallback; existing Rally completion checks.
UNMEASURED: real-track ghost lengths at 15, 45 and 90 seconds; clean-profile rendered-path tolerance; corrupt-hash race playability; link-shortening chat-client round trip.
tools/as1/verify-pilot.cjs and tools/as1/audio-spectrum.cjs implement the requested browser measurements and controls. The workflow retains the evidence artifact on every outcome. Authored assertions are not observed passes; the final readback must use the completed run's actual results.

Refusals and education decisions
The consolidated AS1_REFUSED.md and AS1_EDUCATION_DECISIONS.md remain in independent #347 for consumption by their owning surface orders. This build implements none of the refused proposals or education decisions.
Only AS1-G hard stops apply: a repair changes a served URL, a fix requires weakening/disabling a gate, or a cartridge control shows existing pupil state being lost. Unexpected measurements are recorded and resolved without inventing a pass. Do not merge before full green.
