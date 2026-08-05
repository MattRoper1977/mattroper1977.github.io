#!/usr/bin/env node
'use strict';
/**
 * Neon Breach — source contract harness.
 *
 * A NEW gate for a NEW landing. This file was authored against the pinned
 * input before that input was committed; it has never been edited to fit
 * content it already judged.
 *
 * IDENTITY IS DERIVED, NOT PINNED TO THE COMMITTED FILE.
 * The landing was allowed exactly one edit: a head canonical/og block for
 * https://madebymatt.uk/neonbreach/. So this harness does not hardcode the
 * committed hash — it removes the disclosed block and asserts the remainder
 * hashes to the pinned input:
 *
 *   pinned input : 124354 B  sha256 c69ada9231108b694ec3540d7eccdf7fa5ec1a43048cac167355c7c5933d30bb
 *   committed    : derived   = pinned input + the disclosed head block
 *
 * That is a stronger claim than a hash pin: it proves every byte outside the
 * disclosed block is identical to the audited source, and it does not rot the
 * next time the head metadata is legitimately amended.
 *
 * Usage:
 *   node tools/verify_neonbreach.js              run the contract
 *   node tools/verify_neonbreach.js --self-test  prove it can fail (tamper)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.NB_GAME_FILE || path.join(ROOT, 'neonbreach', 'index.html');
const PINNED_SHA = 'c69ada9231108b694ec3540d7eccdf7fa5ec1a43048cac167355c7c5933d30bb';
const PINNED_BYTES = 124354;
const CANON = 'https://madebymatt.uk/neonbreach/';

const html = fs.readFileSync(GAME, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

const IS_CHILD = !!process.env.NB_GAME_FILE;

// The disclosed head block, verbatim. Removing it must reproduce the pin.
const HEAD_BLOCK =
  '  <!-- canonical/og added on landing; every other byte identical to the pinned source -->\n' +
  '  <link rel="canonical" href="' + CANON + '">\n' +
  '  <meta property="og:type" content="website">\n' +
  '  <meta property="og:title" content="MadeByMatt — Neon Breach FPS">\n' +
  '  <meta property="og:url" content="' + CANON + '">\n' +
  '  <meta property="og:description" content="Survive escalating drone waves in a procedural neon arena. Three weapons, a perk draft after every wave clear, full touch controls, and nothing to download.">\n';

// ------------------------------------------------------------ tamper mode
// "A harness that cannot fail is not a harness." Each fixture breaks ONE
// contract this file guards; the harness must reject every one. The last
// fixture is the POSITIVE CONTROL: an untouched copy, which must PASS.
if (process.argv.includes('--self-test')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-tamper-'));
  const FIXTURES = [
    ['body-byte-drift',      t => t.replace('</body>', '<!-- x --></body>')],
    ['remote-script',        t => t.replace('<head>', '<head>\n<script src="https://cdn.example.com/a.js"></script>')],
    ['blur-unbound',         t => t.replace("window.addEventListener('blur', clearAllInput);", '')],
    ['hidden-pause-removed', t => t.replace("if (run.state === 'playing') pauseGame(true);", '')],
    ['crouch-alias-removed', t => t.replace('|| !!keys.KeyC', '')],
    ['storage-key-collision', t => t.replace('madebymatt.neonBreach.v1', 'mbm_neonsync_save')],
    ['canonical-wrong-url',  t => t.replace('href="' + CANON + '"', 'href="https://example.com/"')],
    ['webgl-fallback-gone',  t => t.replace("$('fatal-overlay').hidden = false;\n    return;", 'return;')],
  ];
  const runOn = file => spawnSync(process.execPath, [__filename], {
    encoding: 'utf8', env: Object.assign({}, process.env, { NB_GAME_FILE: file }),
  });

  let fired = 0, missed = [];
  for (const [name, mutate] of FIXTURES) {
    const t = mutate(html);
    if (t === html) { missed.push(name + ' (fixture did not alter the file)'); continue; }
    const f = path.join(dir, name + '.html');
    fs.writeFileSync(f, t);
    const r = runOn(f);
    if (r.status === 0) missed.push(name + ' (harness stayed green on a broken file)');
    else { fired++; console.log('  FIRED  ' + name + '  -> exit ' + r.status); }
  }

  // POSITIVE CONTROL: an untouched copy must still pass, or the fixtures above
  // prove nothing except that the harness fails on everything.
  const ctrl = path.join(dir, 'positive-control.html');
  fs.writeFileSync(ctrl, html);
  const cr = runOn(ctrl);
  const ctrlOk = cr.status === 0;
  console.log('  ' + (ctrlOk ? 'PASS   ' : 'BROKEN ') + 'positive-control (untouched copy) -> exit ' + cr.status);

  console.log('\nself-test: ' + fired + '/' + FIXTURES.length + ' fixtures fired, positive control ' +
    (ctrlOk ? 'passed' : 'FAILED'));
  if (missed.length) console.log('MISSED:\n  ' + missed.join('\n  '));
  process.exit(missed.length === 0 && ctrlOk ? 0 : 1);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  [' + detail + ']' : '')); }
};
const group = t => console.log('\n' + t);

/* ----------------------------------------------------------------- G1 */
group('G1 — identity derived from the pinned input');
{
  ok('head-block-present-exactly-once',
    html.split(HEAD_BLOCK).length === 2, 'disclosed canonical/og block');
  const stripped = html.replace(HEAD_BLOCK, '');
  ok('reverse-apply-reproduces-pinned-sha', sha(stripped) === PINNED_SHA, sha(stripped));
  ok('reverse-apply-reproduces-pinned-bytes',
    Buffer.byteLength(stripped, 'utf8') === PINNED_BYTES,
    Buffer.byteLength(stripped, 'utf8') + ' B');
  ok('committed-is-input-plus-block-only',
    bytes === PINNED_BYTES + Buffer.byteLength(HEAD_BLOCK, 'utf8'),
    bytes + ' B = ' + PINNED_BYTES + ' + ' + Buffer.byteLength(HEAD_BLOCK, 'utf8'));
}

/* ----------------------------------------------------------------- G2 */
group('G2 — canonical and og metadata for this URL');
{
  ok('canonical-link', new RegExp('<link[^>]+rel="canonical"[^>]+href="' + CANON + '"').test(html));
  ok('canonical-single', (html.match(/rel="canonical"/g) || []).length === 1);
  for (const p of ['og:type', 'og:title', 'og:url', 'og:description']) {
    ok('meta-' + p.replace(':', '-'), new RegExp('property="' + p + '"').test(html));
  }
  ok('og-url-matches-canonical',
    new RegExp('property="og:url"[^>]+content="' + CANON + '"').test(html));
  ok('title-and-og-title-agree',
    (html.match(/<title>([^<]*)<\/title>/) || [])[1] ===
    (html.match(/property="og:title"[^>]+content="([^"]*)"/) || [])[1]);
}

/* ----------------------------------------------------------------- G3 */
group('G3 — no remote resources (corrected form)');
{
  // Corrected: rel="canonical" and og:url DECLARE a URL, they do not fetch one.
  // Only fetching positions count — src=, and href= on link rels that load.
  const FETCHING_REL = /^(stylesheet|preload|prefetch|preconnect|dns-prefetch|icon|shortcut icon|apple-touch-icon|manifest|modulepreload)$/i;
  const remote = [];

  for (const m of html.matchAll(/<[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    if (!/^(data:|#|\/(?!\/))/i.test(m[1])) remote.push('src=' + m[1]);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (m[0].match(/\brel\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const href = (m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    if (FETCHING_REL.test(rel.trim()) && !/^(data:|\/(?!\/))/i.test(href)) remote.push('link[' + rel + ']=' + href);
  }
  for (const m of html.matchAll(/@import\s+(?:url\()?["']?([^"')]+)/gi)) remote.push('@import=' + m[1]);
  for (const m of html.matchAll(/url\(\s*["']?(https?:|\/\/)[^)]*\)/gi)) remote.push('css-' + m[0].slice(0, 40));

  ok('no-remote-subresources', remote.length === 0, remote.join(' | ') || 'none');
  ok('no-network-apis',
    !/\b(fetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|importScripts|navigator\.sendBeacon)\b/.test(html));
  ok('only-same-origin-src-is-hud',
    (html.match(/\bsrc\s*=\s*["']([^"']+)["']/gi) || []).every(s => /["']\/hud\.js["']/.test(s)),
    '/hud.js');
}

/* ----------------------------------------------------------------- G4 */
group('G4 — script blocks parse');
{
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  ok('three-script-blocks', blocks.length === 3, String(blocks.length));
  ok('third-block-is-hud-loader', /defer/.test(blocks[2][1]) && /\/hud\.js/.test(blocks[2][1]));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-parse-'));
  blocks.forEach((b, i) => {
    if (!b[2].trim()) return;
    const f = path.join(dir, 'b' + i + '.js');
    fs.writeFileSync(f, b[2]);
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    ok('block-' + i + '-node-check', r.status === 0, (r.stderr || '').split('\n')[0] || 'parsed');
  });
}

/* ----------------------------------------------------------------- G5 */
group('G5 — audited defect fixes hold');
{
  ok('splash-session-key', /ma_splash_neonbreach/.test(html) && /ma-splash/.test(html));
  ok('clear-input-defined', /function clearAllInput\s*\(/.test(html));
  ok('clear-input-on-blur', /window\.addEventListener\(\s*'blur'\s*,\s*clearAllInput\s*\)/.test(html));
  ok('clear-input-on-visibilitychange', /addEventListener\(\s*'visibilitychange'/.test(html));
  ok('hidden-auto-pause', /document\.hidden/.test(html) && /pauseGame\(true\)/.test(html));
  ok('crouch-keyc-alias', /keys\.KeyC/.test(html));
  ok('touch-ads-toggle-reset', /touchAdsToggled/.test(html));
}

/* ----------------------------------------------------------------- G6 */
group('G6 — storage isolation from every sibling game');
{
  // Recorded §4 deviation: this key is NOT the mbm_<slug>_* dialect. It is
  // kept as-is by ruling. What matters is that it cannot collide.
  const SIBLINGS = ['mbm_apexgolf_', 'mbm_apexpool_', 'mbm_apextennis_',
    'mbm_biopunkhive_', 'mbm_neonsync_', 'mbm_medevac_v1', 'mbm_cinematic', 'mbm_detail'];
  // Call sites bind the key through a constant, so a literal-only scan would
  // silently see nothing and pass vacuously. Resolve identifiers too.
  const keys = [];
  const unresolved = [];
  for (const m of html.matchAll(/(?:local|session)Storage\.(?:get|set|remove)Item\(\s*([^,)]+)/g)) {
    const arg = m[1].trim();
    const lit = arg.match(/^['"`]([^'"`]+)['"`]$/);
    if (lit) { keys.push(lit[1]); continue; }
    const ident = arg.match(/^[A-Za-z_$][\w$]*$/);
    if (ident) {
      const decl = html.match(new RegExp('(?:const|let|var)\\s+' + arg + '\\s*=\\s*[\'"`]([^\'"`]+)[\'"`]'));
      if (decl) { keys.push(decl[1]); continue; }
    }
    unresolved.push(arg);
  }
  const uniq = [...new Set(keys)];
  ok('every-storage-key-resolved', unresolved.length === 0, unresolved.join(', ') || 'all resolved');
  ok('own-key-present', uniq.includes('madebymatt.neonBreach.v1'), uniq.join(', '));
  ok('no-sibling-namespace-touched',
    !uniq.some(k => SIBLINGS.some(s => k.startsWith(s))), uniq.join(', '));
  ok('no-mbm-prefix-claimed', !uniq.some(k => k.startsWith('mbm_')),
    'deviation recorded: uses madebymatt.* not mbm_<slug>_*');
  ok('no-bare-clear', !/(?:local|session)Storage\.clear\s*\(/.test(html),
    'a clear() would wipe sibling saves');
}

/* ----------------------------------------------------------------- G7 */
group('G7 — WebGL fallback, one source serving both paths');
{
  ok('context-requested', /getContext\(\s*'webgl'/.test(html));
  ok('null-context-guarded', /if\s*\(\s*!gl\s*\)/.test(html));
  ok('fallback-overlay-revealed', /\$\('fatal-overlay'\)\.hidden\s*=\s*false/.test(html));
  const overlays = (html.match(/id="fatal-overlay"/g) || []).length;
  ok('single-fallback-surface', overlays === 1, overlays + ' #fatal-overlay');
  ok('fallback-readable', /WebGL Required/.test(html) && /hardware acceleration/.test(html));
  // The two-copies trap: the fallback must not carry its own game title that
  // can drift from the start screen's.
  ok('fallback-carries-no-rival-title',
    !/id="fatal-title"[^>]*>\s*Neon Breach/.test(html));
}

/* ----------------------------------------------------------------- G8 */
group('G8 — touch controls and tap-target floor');
{
  for (const id of ['touch-fire', 'touch-aim', 'touch-jump', 'touch-reload']) {
    ok('control-' + id, new RegExp("'" + id + "'|\"" + id + '"|id="' + id + '"').test(html));
  }
  const small = [...html.matchAll(/(?:min-)?(?:width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)]
    .map(m => parseFloat(m[1]));
  ok('touch-layer-present', /touch-ui/.test(html) && /touchLayer/.test(html));
  ok('tap-target-floor-declared', small.some(v => v >= 44), 'has >=44px declarations');
}

/* ----------------------------------------------------------------- G9 */
group('G9 — non-vacuity');
{
  ok('file-is-substantial', bytes > 120000, bytes + ' B');
  if (IS_CHILD) {
    ok('self-test-skipped-in-tamper-child', true, 'avoids infinite recursion');
  } else {
    const self = spawnSync(process.execPath, [__filename, '--self-test'], { encoding: 'utf8' });
    ok('self-test-proves-it-can-fail', self.status === 0,
      (self.stdout || '').trim().split('\n').filter(Boolean).pop());
  }
}

console.log('\n' + '='.repeat(70));
console.log(fail ? `${pass} passed, ${fail} FAILED` : `ALL ${pass} NEON BREACH SOURCE CHECKS PASSED`);
console.log('='.repeat(70));
console.log(`FILE_BYTES=${bytes}`);
console.log(`FILE_SHA256=${sha(html)}`);
console.log(`PINNED_INPUT_SHA256=${PINNED_SHA}`);
console.log(`HARNESS_PASS=${pass}`);
console.log(`HARNESS_FAIL=${fail}`);
process.exit(fail ? 1 : 0);
