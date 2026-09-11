AS1 reference defect record — consolidated AS1 and AS1-R, 2026-09-11.
Original line numbers below refer to the uploaded files before the one-line quarantine header. Quarantine line numbers are original plus one.
The required source copies are unchanged after the warning header. No repairs were made to the reference originals.
The header-only quarantine is the explicit AS1 section1.1 instruction; its deliberately defective viewport is not an authorised game viewport.
No homepage mockup defect gate is added. The mockup is never adopted as site content.

ArcadeHost_ThirdParty_2026-09-11.html — original bytes 19014; SHA-256 31cc29fa33c8d3626bfb25ca59a8b7e36ea076b9149a773cf92df701c447e12b; source body unchanged after header: yes.
Homepage_3Portal_ThirdParty_2026-09-11.html — original bytes 23173; SHA-256 a34ebaf3a2056b8f0fb9d9e9d2176e7deaf1b89a30b5b8c72e8cb89995241cf4; source body unchanged after header: yes.
TelemetryCodec_ThirdParty_2026-09-11.js — original bytes 8411; SHA-256 2148047270ef497a4bd66cb00cdd099d769981250d1b982b6f91bde5aa313ec6; source body unchanged after header: yes.

BOILERPLATE
B1 — CONFIRMED; original lines 5; additionally 101; method: reading.
Viewport caps zoom and disables scaling. The container also uses touch-action:none.
Proposed repair: Use the estate zoom-enabled viewport and touch-action:manipulation where necessary.

B2 — CONFIRMED; original lines 298–319; 323; method: reading.
Backing dimensions use logical size times DPR capped at1.5, ignoring the computed displayed size.
Proposed repair: Use min(displayed width times devicePixelRatio,2 times logical width), and the corresponding height; transform by backing/logical ratios.

B3 — CONFIRMED; original lines 501; 507–511; method: reading.
currentTime and lastTime use milliseconds, while delta and interval use seconds. The subtracted remainder has the wrong unit.
Proposed repair: Keep render carry in milliseconds, or multiply the seconds remainder by1000; retain an independent simulation clock.

B4 — CONFIRMED; original lines 510–519; method: reading.
Both onTick(delta) and rendering sit behind the selected FPS interval. The simulation step therefore changes with the render cap.
Proposed repair: Keep simulation ticking independently at its existing step; throttle rendering only.

B5 — CONFIRMED; original lines 245; 255–261; 535; method: reading; regression gate execution.
The constructor calls initAudio; an AudioContextClass alias is constructed immediately at page load. Gesture handlers only resume the existing context.
Proposed repair: Construct the context and opted-in master gain lazily in the first permitted user gesture.

B6 — CONFIRMED; original lines 375–377; method: reading and running with CompressionStream disabled.
The original fallback passes JSON text directly to btoa. ASCII restores, but a non-Latin1 label throws InvalidCharacterError. Accented Latin1 text such as é alone does not demonstrate this failure.
Proposed repair: Encode JSON to UTF-8 bytes first, then base64 the bytes.

B7 — CONFIRMED; original lines 405; 443–446; additionally 478; method: reading; regression gate execution on the exit call.
The exit click requires confirm; bad restore and copied-code paths use alert.
Proposed repair: Use a real one-tap href for exit; report copy/restore status inline with an appropriate live region.

B8 — CONFIRMED; original lines 445; method: reading.
The exit destination is the relative literal ../.
Proposed repair: Use the existing estate route derivation and a real no-JS fallback href.

B9 — CONFIRMED; original lines 416–428; method: reading.
The guard checks only this modal style. Space and arrows are prevented for other editable targets.
Proposed repair: Return for e.target.closest(input, textarea, [contenteditable]) using the correctly quoted selector before game-key handling.

B10 — CONFIRMED; original lines 365; 377; 394–398; method: reading and running with both compression APIs disabled.
A fallback exists, but forcing the APIs off proves only the ASCII case works; non-Latin1 generation fails. No managed ChromeOS device compatibility is claimed.
Proposed repair: Provide and prove an explicit UTF-8 fallback format; disable compression APIs in the same round-trip test.

B11 — CONFIRMED; original lines 355–408; 465–477; method: reading.
The format carries no checksum and the panel offers all generated codes without measured size classes. A JSON metadata version exists only in the compressed envelope.
Proposed repair: Use a versioned byte codec and corruption check; measure the pilot save and obtain Matt’s threshold decision before coding size classes.

B12 — CONFIRMED; original lines 203–216; 465–485; method: reading.
The modal is a plain div without dialog semantics. Open/close does not move or restore focus. No aria-live region is present.
Proposed repair: Add a labelled dialog, focus entry/return and in-page status announcements while preserving one-tap Exit.

Codec fallback measurement: CompressionStream and DecompressionStream explicitly disabled. ASCII original fallback restored; non-Latin1 original fallback threw InvalidCharacterError. The UTF-8 round-trip instrument passed, failed on the planted original fallback, then passed after restoration.
HOMEPAGE AUDIT
AS1-R R3.2 — ORIGINAL HOMEPAGE REFERENCE AUDIT
Read-only findings and proposals; no education surface is edited or adopted.
Original: upload/Homepage_3Portal_ThirdParty_2026-09-11.html
Original SHA-256: a34ebaf3a2056b8f0fb9d9e9d2176e7deaf1b89a30b5b8c72e8cb89995241cf4
Original bytes: 23,173. Original lines: 751. All line citations below refer to the unchanged original, before any reference header is prepended.
Evidence: live_responses.json retains request, final URL, redirect chain, status, timestamp, size, hash and local response body for every GET. support_responses.json retains the served hub engine and reading-theme engine. audit_results.json retains scoped counts and links.
Method: source reading plus read-only HTTP GETs and executed scratch mutation probes. No browser navigation, account action, mailing-list action, source-page replacement or permanent H1–H7 gate was performed.

H1 — original lines 548, 568 and 726.
READING CONFIRMED: the pupil portal link, primary pupil CTA and footer Games link use /Games/, which resolves initially on the education origin.
RUNNING RESULT: GET https://madebymatt.uk/Games/ returns HTTP 301 with Location http://www.madebymatt-play.uk/; following it returns HTTP 200 and the Play catalogue, title Made by Matt Play · Find a world. Make it yours.
The current response is a server redirect, not a moved-page HTML stub. The primary CTA is not a dead end today. Do not turn the order's conditional moved-stub warning into a measured claim.
The source still uses an education-origin games route rather than the explicit Play origin. Its Learn & Play grouping places recreational-game discovery on the education front door if copied, although the measured /Games/ route hands off to Play rather than serving a game on Education.
Repair proposal only: retain the separation between domains and make any approved Play discovery link explicit on the Play origin, following the existing surface owner's decision. Do not adopt this three-portal homepage.
Firing control: mutate the captured handoff destination to the education origin and remove its redirect chain; handoff assertion RED, restored snapshot GREEN.

H2 — instrument hrefs at original lines 675, 690 and 705.
RUNNING CONFIRMED: /Lessons/Instruments/newport-bridge/ returns 404.
RUNNING CONFIRMED: /Lessons/Instruments/wilton-carbon/ returns 404.
RUNNING CONFIRMED: /Lessons/Instruments/tees-wind/ returns 404.
Additional href defects: /Tools/ at lines 598 and 727 returns 404; /About/ at lines 636 and 729 returns 404; /Privacy/ at line 728 returns 404. These are exact case-sensitive requested paths.
Other base-path results: /Lessons/ returns 200; / returns 200; /Games/ resolves through the handoff described under H1.
The eight Lessons fragment-filter links at lines 554, 560, 586, 592, 624, 630, 644 and 661 reach the hub base page but do not supply its filter query. The served hub at live_03.txt line 65 reads new URLSearchParams(location.search), not the fragment. Scratch URL parsing confirms each original has an empty search component. This is source-and-parser evidence, not a rendered navigation claim.
Further non-href defect: the Quick Finder at line 744 writes ?search= while the served hub engine reads q at support_01.txt line 186. The intended search is therefore not supplied to this engine.
The instrument index at line 661 also conflates format with kind: the served engine formatOf at support_01.txt line 93 uses html, packs or pdf; game is not an instrument-kind field.
Repair proposal only: use reviewed existing catalogue destinations and the current query contract; obtain a real instrument-kind field before semantic instrument badging or filtering. Do not invent directories or infer kind from filenames. Surface orders own any implementation.
Firing controls: each instrument HTTP status predicate RED on the captured 404 and GREEN on its scratch 200 control; each of the eight fragment inputs RED for missing query parameters and GREEN after changing only the scratch separator from # to ?. The same status predicate records the additional 404 paths. Quick Finder q key GREEN, mutate to search RED, restore GREEN. The served engine's own FORMAT_LABEL keys accept html GREEN; mutate to game RED; restore GREEN.

H3 — original line 624.
READING CONFIRMED: href contains raw & inside /Lessons/#subject=BUILD%20Vocational%20&%20PfA.
RUNNING CONFIRMED: parsing the fragment as parameters yields subject BUILD Vocational followed by a separate PfA fragment parameter, not the complete subject BUILD Vocational & PfA.
Repair proposal only: percent-encode the ampersand inside the subject value as %26 and use the approved current query route. Merely changing the HTML source to &amp; would still leave a query delimiter after HTML parsing and would not fix this value.
Firing control: encoded subject value GREEN; one deliberate %26-to-& mutation RED; restored GREEN.

H4 — original footer line 721. H4 answer: FALSE.
The platform-wide claim No user accounts is false. This is the most serious defect in the homepage reference.
RUNNING CONFIRMED: https://madebymatt.uk/for/teachers/ returns 200 and carries /account/ Account and members plus /mailing-list/ Teacher updates. Source body live_09.txt lines 12 and 22 carries these links; line 23 explicitly describes an optional adult or teacher account and account-backed features.
RUNNING CONFIRMED: https://madebymatt.uk/for/parents-carers/ returns 200 and carries /account/ plus /mailing-list/ at live_10.txt line 10.
RUNNING CONFIRMED: https://madebymatt.uk/for/governors-trustees/ returns 200 and carries /account/ plus /mailing-list/ at live_11.txt line 7.
No sign-in or subscription action was triggered, and account backend behaviour was not measured. The served links and explicit teacher-page account wording are sufficient to contradict the blanket claim.
The narrower pupil-portal phrase No accounts at original line 542 is not treated as the same platform-wide claim; its scope would need deliberate copy review.
Repair proposal only: remove the blanket account claim from any future approved copy and accurately distinguish optional adult accounts and mailing-list functions from device-local pupil tools. Make no new privacy promise without auditing its scope.
Firing controls: remove the account href from each captured adult-page link list and the account-plus-mailing assertion turns RED; restored snapshots GREEN. Replace the false footer phrase in a scratch fixture with accurate optional-account wording GREEN; plant No user accounts RED; restore GREEN.

H5 — original count prose line 526 and link label line 593.
Mock: Over 600 resources. Measured current source snapshot: 950 distinct resources.json rows/files. Measured served education resources.json: 919 distinct rows/files. These are distinct counting scopes; neither is a claimed count of all estate resources across all repositories.
The source catalogue includes 31 type=game rows. The served education catalogue has no type=game rows. The source count must not be used as the education publication count without its publication filter.
Over 600 is numerically a true lower bound for the served 919-row catalogue; it is hardcoded and unhelpfully imprecise, but is not a false exact count. The adjacent single-file, zero-dependency and fully-offline claims were not verified by this count.
Mock: Teesside Art Studio (81 Lessons). Measured source and served Art · Teesside Studio Suite: 131 total records, of which 99 are lesson records after case-normalizing type (83 lesson + 16 Lesson). The 81 lesson label is stale for that named subject scope.
Site's older search-index snapshot has 932 entries and records an earlier 848-entry Lessons input; it is not substituted for the current 950-row source or 919-row served catalogue.
Repair proposal only: if counts are retained by the approved surface order, derive them from its named current catalogue, origin boundary and explicit record type, or omit them. Do not silently equate records, unique lessons, files and all-domain resources.
Firing controls: remove one source row RED; restore GREEN. Remove one served row RED; restore GREEN. Art label 99 GREEN, deliberate 81 RED, restored GREEN. Over-600 predicate on the 919-row served list GREEN, truncate scratch list to 600 RED, restored GREEN.

H6 — original transition token line 38; hover transforms lines 236–238 and 312–316; entire style block lines 9–486.
READING CONFIRMED: no prefers-reduced-motion rule exists. --transition is all 0.18s cubic-bezier(...). Portal cards shift vertically on hover, portal links horizontally. The token is used at lines 158, 224, 309, 340, 389 and 479; the skip link also transitions at line 85.
Repair proposal only: any separately approved implementation must use the estate's reduced-motion behaviour, constrain transitions to intended properties, and suppress nonessential hover movement for reduced motion. The reference is never copied.
Firing controls: in scratch-only corrected inspection fixtures, remove the reduced-motion clause RED, restore GREEN; reintroduce transition all RED, restore GREEN; reintroduce hover translateY RED, restore GREEN. These validate source inspection, not runtime animation behaviour or performance.

H7 — original OS theme block lines 42–56 and sole script block lines 736–748.
READING CONFIRMED: colour choice is only prefers-color-scheme: light; the mock neither loads /theme.js nor reads the estate preference nor styles the engine's data-theme attribute.
SERVED SOURCE CONFIRMED: /theme.js returns 200. Its line 8 names mbm_reading_theme; line 9 defines the existing reading choices; line 16 reads the stored choice; line 24 applies data-theme. The served parents/carers page loads /theme.js. Thus this is an existing user-selected reading background system, not merely an OS dark/light preference.
Collision: a stored reading choice can be applied elsewhere while this reference follows only the operating system; bolting on the engine alone would still leave this mock's independent token definitions without the required data-theme mapping. No resolution is chosen here.
Repair proposal only: leave the established reading-theme owner to determine integration in its already-owned surface order. Do not add a parallel preference key or replace the approved theme architecture.
Firing controls: mutate the captured engine's exact preference key RED, restore GREEN. A scratch hook-detector fixture GREEN, remove its theme-script and data-theme integration markers RED, restore GREEN. This validates detection of the missing integration, not a production-ready theme patch.

CONTROL READBACK: 28 deliberate scratch mutations produced RED; 28 restored inputs produced GREEN. Full named output is audit_controls.txt. No H1–H7 gate was added to an estate workflow.
CONFIRMATION: six defect categories H2–H7 are confirmed; H1's education-origin route pattern is confirmed but its conditional moved-stub/dead-end outcome is disproved by the successful current redirect. H1–H5 include executed HTTP/parser/count evidence; H6–H7 have source inspection backed by executed mutation probes. No rendered-browser claim is made.
UNCHANGED: the original homepage upload has its initial hash. No homepage, audience page, Lessons hub, Resources page, game or shared include was edited.

