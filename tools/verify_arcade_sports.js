#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const supplied = args.find((arg) => arg !== '--self-test');
const FILE = supplied || path.join(__dirname, '..', 'games', 'index.html');
const ART = path.join(__dirname, '..', 'assets', 'cards', 'apex-pool.svg');

function runSelfTest() {
  const source = fs.readFileSync(FILE, 'utf8');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-sports-'));
  const cases = [
    ['section', 'sports-section-once', (s) => s.replace('id="sports" hidden', 'id="sport" hidden')],
    ['membership', 'top-picks-exclude-apex-kick', (s) => s.replace('var TOP=["Voxel Frontier"', 'var TOP=["Apex Kick","Voxel Frontier"')],
    ['deduplication', 'whole-shelf-excludes-sports', (s) => s.replace('g.collection!=="Sports"', 'true')],
    ['grouping', 'sports-is-not-a-tag', (s) => s.replace('g.collection==="Sports"', 'g.tag==="Sport"')],
    ['derived count', 'shelf-count-is-derived', (s) => s.replace('total=state.games.length', 'total=32')]
  ];
  let missed = 0;
  console.log('== Arcade Sports non-vacuity ==');
  cases.forEach(([family, expected, mutate], index) => {
    const changed = mutate(source);
    const file = path.join(root, `${index}-${family}.html`);
    fs.writeFileSync(file, changed);
    const child = spawnSync(process.execPath, [__filename, file], { encoding: 'utf8' });
    const output = `${child.stdout || ''}\n${child.stderr || ''}`;
    if (changed !== source && child.status !== 0 && output.includes(`FAIL  ${expected}`)) {
      console.log(`  PASS  ${family}: rejected by ${expected}`);
    } else {
      missed++;
      console.log(`  FAIL  ${family}: expected ${expected} to reject the tamper`);
    }
  });
  fs.rmSync(root, { recursive: true, force: true });
  console.log(missed ? `${cases.length - missed} detected, ${missed} missed` : `ALL ${cases.length} PLANTED FAILURES WERE DETECTED`);
  process.exit(missed ? 1 : 0);
}
if (selfTest) runSelfTest();

const html = fs.readFileSync(FILE, 'utf8');
let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
}
function count(needle) { return html.split(needle).length - 1; }

console.log('== Arcade Sports source contract ==');
ok('sports-section-once', count('id="sports" hidden') === 1 && count('id="sportsRail"') === 1);
ok('sports-uses-existing-rail-card-system', /<div class="rail" id="sportsRail"/.test(html) && /sportsRail\.appendChild\(gCard\(g,false\)\)/.test(html));
ok('top-picks-exclude-apex-kick', /var TOP=\["Voxel Frontier"/.test(html) && !/var TOP=\["Apex Kick"/.test(html));
ok('whole-shelf-excludes-sports', /all\.filter\(function\(g\)\{return g\.collection!=="Sports"\}\)/.test(html));
ok('sports-is-not-a-tag', /g\.collection==="Sports"/.test(html) && !/g\.tag==="Sport"/.test(html) && !/>SPORT</.test(html));
ok('shelf-count-is-derived', /sportsCount=all\.filter/.test(html) && /total=state\.games\.length/.test(html) && !/total=\d+/.test(html));
ok('empty-sports-wrapper-is-suppressed', /sportsSection\.hidden=sports\.length===0/.test(html));
ok('top-copy-matches-seven-members', /The seven I&#39;d|The seven I'd/.test(html) || html.includes("The seven I'd"));
ok('rest-of-shelf-copy-names-the-exclusion', html.includes('The rest of the shelf') && html.includes('Every other game, A to Z'));
ok('apexpool-art-present', fs.existsSync(ART) && fs.readFileSync(ART, 'utf8').includes('<title id="title">Apex Pool</title>'));
ok('no-hardcoded-shelf-count-copy', !/of 32 games|32 games|42 cards/.test(html));
ok('local-origin-normalisation-preserved', /function localHref\(h\)/.test(html));

console.log('='.repeat(64));
console.log(fail === 0 ? `ALL ${pass} ARCADE SPORTS SOURCE CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
console.log('='.repeat(64));
process.exit(fail ? 1 : 0);
