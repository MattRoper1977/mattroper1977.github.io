#!/usr/bin/env node
/* Olympics live leg — Stage L1.
 *
 * Closes the live half of the Olympics publish: the bytes the world is served
 * must be the bytes on main, the shelf must carry the entries main says it
 * carries, the NEW· marker must be held by /olympics/ and by nothing else,
 * and the arcade must RENDER the whole shelf.
 *
 * Two rules this file exists to obey:
 *
 *   Derive, never pin. The expected entry count is read from the repo blob,
 *   not written here as 46. The day a game ships, this script needs no edit.
 *
 *   Measure rendered reality, not DOM nodes. A previous run reported two
 *   false defects off innerHTML counting. `appendChild` of 46 cards proves
 *   nothing about what a person sees: a card with a zero-height box, a
 *   display:none ancestor or a collapsed grid is not "rendered". This counts
 *   cards that actually take up space on the page, and cross-checks the count
 *   against the human-visible countline.
 *
 * Every assertion is a named limb so the negative-control job can name the
 * one it is knocking over.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(n);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const sha = (b) => createHash('sha256').update(b).digest('hex');
const NEW_MARKER = /^NEW\s*·\s*/;

const results = [];
const check = (limb, ok, detail) => {
  results.push({ limb, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${limb.padEnd(26)} ${detail}`);
  return ok;
};

const servedGames = arg('--served-games');
const repoGames = arg('--repo-games');
const servedOlympics = arg('--served-olympics');
const repoOlympics = arg('--repo-olympics');
const arcadeUrl = arg('--arcade-url');

// ---------------------------------------------------------------- A1 + A2
const sg = readFileSync(servedGames);
const rg = readFileSync(repoGames);

check('games.json-bytes', sha(sg) === sha(rg),
  `served ${sg.length}B ${sha(sg).slice(0, 12)} vs main ${rg.length}B ${sha(rg).slice(0, 12)}`);

let served, repo;
try {
  served = JSON.parse(sg.toString('utf8'));
  repo = JSON.parse(rg.toString('utf8'));
} catch (e) {
  check('games.json-parse', false, String(e));
  report();
}

const sEntries = served.games ?? [];
const rEntries = repo.games ?? [];

// Vacuous-pass guard: an empty shelf would satisfy an equality check trivially.
check('shelf-non-empty', sEntries.length > 0,
  `${sEntries.length} entries served`);

check('shelf-count', sEntries.length === rEntries.length,
  `served ${sEntries.length} === main ${rEntries.length} (derived, not pinned)`);

// ---------------------------------------------------------------- A3 marker
const holders = sEntries.filter((e) => NEW_MARKER.test(String(e.title || '')));
const hrefs = holders.map((e) => e.href);

check('marker-sole-holder', holders.length === 1,
  `${holders.length} entr${holders.length === 1 ? 'y' : 'ies'} carry NEW· ${JSON.stringify(hrefs)}`);

// RETARGETED 2026-08-13, commission 2. This asserted `=== '/olympics/'`, an
// inline frozen holder. True when written, false from the moment the marker
// moved — Relicforge, then Nova Siege, then Rally Vector 3D by site commits
// 69c1d57 and 3e6deb0, landing on the canonical shelf in Games commit aa3e3bf,
// which transferred the marker off Nova Siege in the same commit. Unnoticed
// for the usual reason: this workflow fired only on a launch branch that had
// already merged.
//
// The holder is a declared shelf fact with one writer, so it is read from
// data/new-release-occupants.json rather than restated here. Reading the
// record is not trusting it: the served shelf is the other side of the
// comparison, so a record that disagrees with production is a red in whichever
// direction it disagrees. An unreadable or holder-less record is a failure of
// this harness, reported as its own limb — never a silent pass, and never
// counted as a rejection.
const RECORD_PATH = new URL('../data/new-release-occupants.json', import.meta.url);
let RECORD = null, recordError = null;
try { RECORD = JSON.parse(readFileSync(RECORD_PATH, 'utf8')); }
catch (e) { recordError = String((e && e.message) || e); }

check('holder-record-readable', RECORD !== null && typeof RECORD.newReleaseHolder === 'string',
  RECORD === null
    ? `data/new-release-occupants.json unreadable: ${recordError}`
    : `newReleaseHolder ${JSON.stringify(RECORD.newReleaseHolder ?? null)}`);

const declaredHolder = (RECORD && typeof RECORD.newReleaseHolder === 'string')
  ? `/${RECORD.newReleaseHolder}/`
  : null;

check('marker-matches-record',
  declaredHolder !== null && holders.length === 1 && holders[0].href === declaredHolder,
  `served holder ${JSON.stringify(hrefs[0] ?? null)} vs declared ${JSON.stringify(declaredHolder)}`);

// ---------------------------------------------------------------- A4 bytes
const so = readFileSync(servedOlympics);
const ro = readFileSync(repoOlympics);
check('olympics-bytes', sha(so) === sha(ro),
  `served ${so.length}B ${sha(so).slice(0, 12)} vs main ${ro.length}B ${sha(ro).slice(0, 12)}`);

// ---------------------------------------------------------------- A5 render
if (arcadeUrl) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Script faults and missing sub-resources are different failures and must
  // not share a limb. A thrown exception in the arcade is a defect this gate
  // should stop. A lazily-loaded card image returning 404 is a real thing
  // worth printing but it is not what L1 asked about, and gating on it makes
  // this instrument fail for reasons it cannot name — which is how the last
  // run produced two false defects. Scripts gate; resources are reported.
  const scriptErrors = [];
  const resourceErrors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    (/Failed to load resource/i.test(m.text()) ? resourceErrors : scriptErrors).push(m.text());
  });
  page.on('pageerror', (e) => scriptErrors.push(String(e)));

  await page.goto(arcadeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Poll, never single-sample: the shelf arrives by fetch and the grid is
  // empty until it resolves. A single sample here is the census bug that
  // recorded two branded splashes as unbranded.
  const expected = sEntries.length;
  let rendered = -1;
  for (let i = 0; i < 60; i++) {
    // The browse structure moved from one A-Z grid (#allGrid) to genre
    // accordions (#genreSections). This job reads the SERVED page, so across a
    // deploy it is genuinely either, and reading only the old one returns -1 —
    // "the selector matched nothing", which is indistinguishable from a shelf
    // that failed to render. Sections are opened first: a card inside a shut
    // <details> occupies no space, so a folded shelf would read as a short one.
    rendered = await page.evaluate(() => {
      document.querySelectorAll('details.gsec').forEach((d) => { d.open = true; });
      const roots = [...document.querySelectorAll('#allGrid, #genreSections')];
      if (!roots.length) return -1;
      return roots.flatMap((g) => [...g.querySelectorAll('a.gcard')]).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && el.offsetParent !== null;
      }).length;
    });
    if (rendered >= expected) break;
    await page.waitForTimeout(250);
  }

  check('arcade-renders-shelf', rendered === expected,
    `${rendered} cards occupy real space in the browse structure, shelf is ${expected} (rendered, not node-counted)`);

  const countline = (await page.textContent('#countline').catch(() => '')) || '';
  check('arcade-countline', countline.includes(String(expected)),
    `countline reads ${JSON.stringify(countline.trim().slice(0, 80))}`);

  check('arcade-no-script-error', scriptErrors.length === 0,
    scriptErrors.length ? JSON.stringify(scriptErrors.slice(0, 3)) : 'no thrown exceptions or script console errors');

  console.log(`  note  ${'sub-resource 404s'.padEnd(26)} ${resourceErrors.length} (reported, not gated — see comment)`);

  await browser.close();
}

report();

function report() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} limbs pass`);
  if (failed.length) {
    console.log(`  FAILING LIMBS: ${failed.map((f) => f.limb).join(', ')}`);
    process.exit(1);
  }
  process.exit(0);
}
