#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const supplied = args.find((arg) => arg !== '--self-test');
const FILE = supplied || path.join(__dirname, '..', 'apexpool', 'index.html');
/* The DELIVERED apexpool artifact, pinned. A pin is a literal by design: the
 * whole claim is "these exact bytes shipped", and deriving it from the file it
 * checks would assert only that the file equals itself. It moves when the game
 * deliberately moves - and it must move IN THE SAME COMMIT, because a ledger
 * updated later than the file it describes is a stale doc with a hash attached.
 *
 * MOVED 2026-08-25, and late. 8432492 on 10 August ("Phase 1: the eleven get an
 * inline exit") added the MBM-INLINE-EXIT block to this game: +29 lines, 0
 * deletions, 88751 -> 91973 bytes. That commit re-pinned six sibling gates -
 * apexrally, biopunkhive, echovault, neonsync, novasiege, ouroboros - and missed
 * this one. apexpool-verify.yml is pull_request-only and filtered to apexpool/**,
 * so it went red on that very PR (run 17), was merged anyway, and then no diff
 * touched those paths for fifteen days. It surfaced again only because S5 added
 * a comment to this file and fired the workflow.
 *
 * Verified before moving rather than re-pinned on sight: 8432492^ hashes to the
 * OLD pin exactly, and the whole delta is the generated exit block.
 * Previous: 4de1383f8ee029db438258bb239e4e7f3b7ffd9e603706a9fd145fd397af87ad (88751 B) */
const EXPECTED_BYTES = 91973;
const EXPECTED_SHA256 = 'b71385d8dd97305e1bcb85b4754ddcee02f59feaccc3adc27c9f91c0e1bfd2bc';

function plantedFailures() {
  const source = fs.readFileSync(FILE, 'utf8');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apexpool-landing-'));
  const cases = [
    ['touch target', 'small-buttons-44px', (s) => s.replace('.btn.small{min-height:44px', '.btn.small{min-height:40px')],
    ['pocket target', 'pocket-buttons-44px', (s) => s.replace('.pocket-grid button{min-height:44px', '.pocket-grid button{min-height:38px')],
    ['dependency', 'remote-runtime-reference-census', (s) => s.replace('</body>', '<script src="https://example.invalid/tamper.js"></script></body>')],
    ['storage', 'storage-prefix-exact', (s) => s.replace("var PREFIX='mbm_apexpool_';", "var PREFIX='mbm_pool_';")],
    ['reduced motion', 'reduced-motion-source-contract', (s) => s.replace('@media (prefers-reduced-motion:reduce)', '@media (prefers-reduced-motion:no-preference)')],
    ['no-JavaScript', 'noscript-source-contract', (s) => s.replace('<noscript>', '<no-script>')],
    ['Canvas guard', 'noCanvas-source-contract', (s) => s.replace('id="noCanvas"', 'id="noCanvasBroken"')]
  ];
  let failures = 0;
  console.log('== Landing harness non-vacuity ==');
  for (let i = 0; i < cases.length; i++) {
    const [family, expected, mutate] = cases[i];
    const changed = mutate(source);
    if (changed === source) {
      failures++;
      console.log(`  FAIL  ${family}: tamper could not be planted`);
      continue;
    }
    const file = path.join(root, `${i}-${family.replace(/[^a-z0-9]+/gi, '-')}.html`);
    fs.writeFileSync(file, changed);
    const child = spawnSync(process.execPath, [__filename, file], { encoding: 'utf8' });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    const rejected = child.status !== 0 && output.includes(`FAIL  ${expected}`);
    if (rejected) console.log(`  PASS  ${family}: rejected by ${expected}`);
    else {
      failures++;
      console.log(`  FAIL  ${family}: expected ${expected} to reject the tamper`);
    }
  }
  fs.rmSync(root, { recursive: true, force: true });
  console.log(failures ? `${cases.length - failures} detected, ${failures} missed` : `ALL ${cases.length} PLANTED FAILURES WERE DETECTED`);
  process.exit(failures ? 1 : 0);
}

if (selfTest) plantedFailures();

const raw = fs.readFileSync(FILE);
const html = raw.toString('utf8');
let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
}
function head(title) { console.log('\n== ' + title + ' =='); }

head('Byte accountability');
const hash = crypto.createHash('sha256').update(raw).digest('hex');
ok('committed-byte-count', raw.length === EXPECTED_BYTES, String(raw.length));
ok('committed-sha256', hash === EXPECTED_SHA256, hash);
ok('single-document', (html.match(/<!doctype html>/gi) || []).length === 1 && (html.match(/<\/html>/gi) || []).length === 1);

head('Authorised accessibility delta');
ok('small-buttons-44px', /\.btn\.small\{min-height:44px;/.test(html) && !/\.btn\.small\{min-height:40px;/.test(html));
ok('pocket-buttons-44px', /\.pocket-grid button\{min-height:44px;/.test(html) && !/\.pocket-grid button\{min-height:38px;/.test(html));
ok('base-buttons-remain-46px', /\.btn\{min-height:46px;/.test(html));
ok('chooser-padding-and-offset-unchanged', /#pocketChooser\{position:absolute;inset:auto 8px calc\(198px \+ var\(--safeB\)\) 8px;padding:10px;/.test(html));
const mins = [...html.matchAll(/([^{}]+)\{[^{}]*min-height:(\d+)px/g)]
  .map((m) => ({ selector: m[1].trim().split(/\n/).pop(), px: Number(m[2]) }))
  .filter((x) => /button|\.btn|\.mode-card/.test(x.selector));
console.log('  DATA  interactive min-height declarations: ' + mins.map((x) => `${x.selector}=${x.px}px`).join(' | '));
ok('enumerated-interactive-minimums-meet-floor', mins.length >= 4 && mins.every((x) => x.px >= 44));

head('Dependency and storage isolation');
const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)].map((m) => m[2]);
const remote = refs.filter((value) => /^https?:/i.test(value));
const runtimeRemote = refs.filter((value) => /^https?:/i.test(value) && value !== 'https://madebymatt.uk/apexpool/');
ok('remote-runtime-reference-census', runtimeRemote.length === 0, runtimeRemote.join(' | ') || 'canonical only');
ok('canonical-is-the-only-remote-href', remote.length === 1 && remote[0] === 'https://madebymatt.uk/apexpool/', remote.join(' | '));
ok('data-uri-favicon-is-the-only-embedded-asset', refs.filter((value) => /^data:/i.test(value)).length === 1);
ok('no-network-calls', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(html));
ok('storage-prefix-exact', /var PREFIX='mbm_apexpool_';/.test(html));
const writes = [...html.matchAll(/localStorage\.(?:setItem|removeItem)\(([^\n;]+)/g)].map((m) => m[1]);
ok('all-storage-writes-use-prefix-helper', writes.length === 2 && writes.every((value) => /this\.key\(k\)/.test(value)), writes.join(' | '));

head('Fallback and motion source contract');
ok('reduced-motion-source-contract', /@media \(prefers-reduced-motion:reduce\)/.test(html) && /#mbmSplash\{transition:none\}/.test(html));
ok('noscript-source-contract', /<noscript><style>#mbmSplash\{display:none!important\}<\/style><div[^>]*><h1>Apex Pool needs JavaScript<\/h1>/.test(html));
ok('noCanvas-source-contract', /<div id="noCanvas"><div class="guard"><h1>Canvas is unavailable<\/h1>/.test(html) && /if\(!ctx\)\{\$\('noCanvas'\)\.style\.display='flex';return\}/.test(html));

console.log('\n' + '='.repeat(64));
console.log(fail === 0 ? `ALL ${pass} LANDING CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
console.log('='.repeat(64));
process.exit(fail ? 1 : 0);
