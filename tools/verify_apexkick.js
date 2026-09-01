#!/usr/bin/env node
/*
 * verify_apexkick.js — shipping contract for /apexkick/index.html
 *
 * Follows the verify_axiomshift.js pattern: extract the marked pure-logic
 * blocks out of the built file, run them, then assert the shipping contract
 * against the file's own text.
 *
 * One deliberate addition. The Axiom Shift scan defines user-facing copy as
 * "the file with <script> and <style> stripped", which is correct for copy
 * that ships as markup — but Apex Kick builds its outcome line, its Kick
 * Rating and its "unlucky" marker inside <script>, so a displayed-copy scan
 * is structurally blind to all of it. dynamicCopy() below scans the string
 * literals constructed in script as well, and there is a self-test proving
 * the scan actually catches a planted string.
 *
 *   node tools/verify_apexkick.js [path/to/index.html]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, '..', 'apexkick', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
}
function head(t) { console.log('\n== ' + t + ' =='); }

/* ---- extract + load the pure simulation core ---------------------------- */
function block(name) {
  const re = new RegExp('AK:' + name + ':BEGIN([\\s\\S]*?)\\/\\*\\s*AK:' + name + ':END');
  const m = html.match(re);
  if (!m) throw new Error('missing marked block ' + name);
  return m[1].replace(/^[\s\S]*?\*\//, '');
}
const AK = new Function('var AK;' + block('CORE') + '\nreturn AK;')();

/* ---- 1. Kick Rating contract ------------------------------------------- */
head('Kick Rating — bands and behaviour');
const R = AK.kickRating;
ok('rating-is-a-function', typeof R === 'function');
ok('goal-band-floor', R({ outcome: 'GOAL', impactX: 0, impactY: 1.2, keeperErr: 0, wallClearance: 1.4, hasWall: true }) >= 50);
ok('miss-band-ceiling', R({ outcome: 'WOODWORK', impactX: 3.62, impactY: 2.3 }) <= 48);

let worstGoal = 101, bestMiss = -1;
for (let i = 0; i < 40000; i++) {
  const isGoal = i % 2 === 0;
  const v = R({
    outcome: isGoal ? 'GOAL' : ['WIDE', 'SAVED', 'CAUGHT', 'WOODWORK', 'BLOCKED', 'SHORT'][i % 6],
    impactX: (Math.random() - 0.5) * 20, impactY: (Math.random() - 0.5) * 10,
    keeperErr: Math.random() * 2.5 - 0.4, wallClearance: Math.random() * 3 - 0.6,
    hasWall: Math.random() < 0.5
  });
  if (!Number.isFinite(v) || v < 0 || v > 100) { ok('rating-in-range', false, 'got ' + v); break; }
  if (isGoal) worstGoal = Math.min(worstGoal, v); else bestMiss = Math.max(bestMiss, v);
}
ok('rating-in-range', true, '(40,000 random cases inside 0-100, never NaN)');
ok('bands-disjoint', worstGoal > bestMiss, 'worst goal ' + worstGoal + ' > best miss ' + bestMiss);

/* ---- 2. "unlucky" is a marker, never points ----------------------------- */
head('Unlucky marker');
ok('unlucky-threshold-is-named', typeof AK.UNLUCKY_MISS_MIN === 'number', '= ' + AK.UNLUCKY_MISS_MIN);
ok('unlucky-never-flags-a-goal', !AK.isUnluckyMiss('GOAL', 100) && !AK.isUnluckyMiss('GOAL', 50));
ok('unlucky-flags-a-near-miss', AK.isUnluckyMiss('WIDE', 46));
ok('unlucky-ignores-row-Z', !AK.isUnluckyMiss('WIDE', 2));
// the marker must not perturb the score in any way
let perturbed = false;
for (let i = 0; i < 5000; i++) {
  const inp = { outcome: 'WIDE', impactX: 3 + Math.random() * 3, impactY: Math.random() * 3 };
  const a = R(inp); AK.isUnluckyMiss('WIDE', a); const b = R(inp);
  if (a !== b) { perturbed = true; break; }
}
ok('unlucky-does-not-change-the-number', !perturbed);

/* ---- 3. shipping contract on the file text ------------------------------ */
head('Shipping contract (asserted on the built file)');

// (a) displayed copy — markup only, the Axiom Shift definition
function displayedCopy(src) {
  return src.replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ');
}
// (b) dynamic copy — string literals CONSTRUCTED IN SCRIPT, which (a) cannot see
function dynamicCopy(src) {
  const scripts = src.match(/<script>[\s\S]*?<\/script>/gi) || [];
  const out = [];
  scripts.forEach(s => {
    const lits = s.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || [];
    lits.forEach(l => out.push(l.slice(1, -1)));
  });
  return out.join('  ');
}
const shown = displayedCopy(html);
const dynamic = dynamicCopy(html);
const allCopy = shown + '  ' + dynamic;

// prove the dynamic scan is honest: it must see a script-built string that the
// displayed-copy scan provably cannot
const probe = 'unlucky';
ok('dynamic-scan-sees-script-strings', dynamic.indexOf(probe) >= 0,
   '("' + probe + '" found in script literals)');
ok('displayed-scan-is-blind-to-them', shown.indexOf('/ 100') < 0,
   '(rating string absent from markup, as expected)');
ok('rating-copy-present-somewhere', /\/ 100/.test(allCopy));

// the control the game actually has must be what the copy describes
ok('no-stale-swipe-copy', !/\bSwipe to bend the ball\b/i.test(allCopy),
   '(pre-flick wording gone)');
const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1] || '';
ok('meta-and-og-agree', metaDesc === ogDesc && metaDesc.length > 40);
ok('description-matches-live-control', /drag the marker/i.test(metaDesc) && /flick/i.test(metaDesc));
fs.writeFileSync(path.join(require('os').tmpdir(), 'apexkick_canonical_desc.txt'), metaDesc);

/* ---- 4. accessibility of the dynamic outcome line ----------------------- */
head('Accessibility — the outcome is announced, once');
ok('live-region-exists', /id="live"[^>]*aria-live="polite"/.test(html));
ok('live-region-is-atomic', /id="live"[^>]*aria-atomic="true"/.test(html));
ok('live-region-is-status-role', /id="live"[^>]*role="status"/.test(html));
ok('visual-banner-hidden-from-AT', /id="banner"[^>]*aria-hidden="true"/.test(html) &&
   /id="subBanner"[^>]*aria-hidden="true"/.test(html), '(so nothing is announced twice)');
ok('announce-called-once-per-kick', (html.match(/announce\(/g) || []).length === 2,
   '(one definition, one call site)');
ok('rating-uses-theme-token', /\.rating\{color:var\(--gold\)/.test(html) &&
   !/rating[^\n]*style="color:#/.test(html), '(no hardcoded hex on the rating)');
ok('unlucky-uses-theme-token', /\.unlucky\{color:var\(--amber-l\)/.test(html));

/* ---- 5. offline + no-network contract ---------------------------------- */
head('Offline contract');
/* Count what the browser actually FETCHES, not every http string in the file.
 * The old form matched any URL anywhere and then subtracted two known-innocent
 * shapes by hand, so a rel=canonical, an og:url and an og:image all counted as
 * "remote resources" — three metadata values no browser ever requests while
 * rendering the page. It reported this game as carrying remote assets when it
 * carries none.
 *
 * A fetchable reference is a URL in a position that triggers a network request:
 * script/img/iframe/audio/video/source/track/embed src, srcset, poster,
 * object data, a <link> whose rel actually loads something (stylesheet,
 * preload, prefetch, icon, manifest — NOT canonical or alternate), CSS url(),
 * and script-side fetch/XHR/WebSocket targets. Metadata (<meta content>,
 * rel=canonical) is excluded by construction rather than by allowlist. */
const FETCHABLE_REL = /\b(stylesheet|preload|prefetch|dns-prefetch|preconnect|icon|apple-touch-icon|manifest|modulepreload)\b/i;
const netRefs = [];
{
  const push = u => { if (/^https?:\/\//.test(u)) netRefs.push(u); };
  /* element attributes that load */
  const ATTR = /<(script|img|iframe|audio|video|source|track|embed|object)\b[^>]*?\s(?:src|srcset|poster|data)\s*=\s*["']([^"']+)["']/gi;
  for (let m; (m = ATTR.exec(html)); ) m[2].split(',').forEach(part => push(part.trim().split(/\s+/)[0]));
  /* <link>, but only when its rel actually fetches */
  const LINK = /<link\b[^>]*>/gi;
  for (let m; (m = LINK.exec(html)); ) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [, ''])[1];
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [, ''])[1];
    if (href && FETCHABLE_REL.test(rel)) push(href);
  }
  /* CSS url() and script-side network calls */
  for (let m, re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi; (m = re.exec(html)); ) push(m[1]);
  for (let m, re = /(?:fetch|open|WebSocket)\s*\(\s*["']([^"']+)["']/g; (m = re.exec(html)); ) push(m[1]);
}
const netRefsFiltered = netRefs
  // w3.org URIs in SVG are XML namespace identifiers, never fetched;
  // the games link is a user-clickable navigation, not a resource load.
  .filter(u => !/^https?:\/\/www\.w3\.org\//.test(u))
  .filter(u => !/madebymatt\.uk\/games\//.test(u));
ok('no-remote-resources', netRefsFiltered.length === 0,
   netRefsFiltered.length ? 'found fetchable: ' + netRefsFiltered.slice(0, 3).join(', ')
                  : '(no fetchable remote assets; metadata URLs are not fetched and are not counted)');
const embeddedThree = html.match(/<script id="three-embedded">[\s\S]*?<\/script>/);
ok('embedded-three-block-is-singular', !!embeddedThree && (html.match(/id="three-embedded"/g) || []).length === 1);
const authoredHtml = embeddedThree ? html.replace(embeddedThree[0], '') : html;
const hasAuthoredNetworkCalls = source => /\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(source);
ok('no-authored-network-calls', !hasAuthoredNetworkCalls(authoredHtml),
   '(frozen embedded Three.js loader definitions are judged by runtime-request interception)');
const plantedAuthoredNetwork = authoredHtml.replace('<title>', '<script>fetch("https://control.invalid/")</script><title>');
ok('authored-network-control-fires', hasAuthoredNetworkCalls(plantedAuthoredNetwork),
   '(the same predicate catches a planted authored fetch)');

/* ---- summary ------------------------------------------------------------ */
console.log('\n' + '='.repeat(60));
console.log(fail === 0 ? `ALL ${pass} CONTRACT CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
console.log('='.repeat(60));
process.exit(fail ? 1 : 0);
