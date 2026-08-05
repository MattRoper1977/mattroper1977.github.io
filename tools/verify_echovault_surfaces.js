#!/usr/bin/env node
/*
 * verify_echovault_surfaces.js — Part C, whole-shelf render check.
 *
 * Measured against the SERVED page in a real browser, not against the local
 * file and not by grepping HTML: the arcade shelf builds every card in
 * JavaScript from /Games/games.json, so the shipped markup contains no cards at
 * all and a grep would report a confident zero.
 *
 * Under the standing ruling Echo Vault is a GENERAL SHELF entry, so what is
 * being proved is deliberately narrow:
 *   - the served manifest actually carries the entry (i.e. Pages published it);
 *   - it renders exactly ONCE in the browse-all grid;
 *   - it is NOT on the Sports rail;
 *   - nothing else was displaced — every other manifest entry still renders,
 *     the curated picks and the Sports rail are unchanged in size, and the one
 *     hero is still the one hero.
 *
 * Counts are DERIVED from the live manifest at Games main. Nothing is pinned:
 * per the A-6 register, a gate pinned to a snapshot reports green against a
 * stale world, which is worse than reporting red.
 *
 *   node tools/verify_echovault_surfaces.js
 */
'use strict';
const { chromium } = require('playwright');

const SHELF = process.env.RF_SHELF_URL || 'https://madebymatt.uk/games/';
const RAW_MANIFEST = 'https://raw.githubusercontent.com/MattRoper1977/Games/main/games.json';
const HREF = '/echovault/';

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
function gate(id, name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(d => { results.push({ id, status: 'PASS' }); console.log(`PASS ${id} ${name}${d ? ' — ' + d : ''}`); })
    .catch(e => { results.push({ id, status: 'FAIL' }); console.error(`FAIL ${id} ${name} — ${e.message}`); });
}

(async () => {
  // The authority for "what should be on the shelf" is the manifest at main.
  const expected = await fetch(RAW_MANIFEST).then(r => {
    if (!r.ok) throw new Error(`manifest at main returned ${r.status}`);
    return r.json();
  });
  const expectedGames = expected.games;
  const expectedSports = expectedGames.filter(g => g.collection === 'Sports');
  console.log(`manifest at Games main (derived): ${expectedGames.length} entries, ${expectedSports.length} on the Sports rail`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(SHELF, { waitUntil: 'networkidle', timeout: 60000 });

  // The shelf paints asynchronously; wait for the grid rather than guessing a delay.
  await page.waitForFunction(
    (n) => document.querySelectorAll('#allGrid .gcard').length >= n,
    expectedGames.length,
    { timeout: 60000 }
  ).catch(() => {});

  const shelf = await page.evaluate(() => {
    const hrefs = el => Array.from(document.querySelectorAll(el)).map(a => a.getAttribute('href'));
    return {
      all: hrefs('#allGrid .gcard'),
      picks: hrefs('#topRail .pick'),
      sports: hrefs('#sportsRail .gcard'),
      themed: hrefs('#tgrids .gcard'),
      classRail: hrefs('#classRail .gcard'),
      sportsHidden: !!(document.getElementById('sports') || {}).hidden,
      countline: (document.getElementById('countline') || {}).textContent || ''
    };
  });

  await gate('C1', 'the served manifest carries the entry (Pages published the merge)', async () => {
    const served = await page.evaluate(async () => {
      const r = await fetch('/Games/games.json', { cache: 'no-cache' });
      const d = await r.json();
      return { total: d.games.length, echovault: d.games.filter(g => g.href === '/echovault/').length };
    });
    assert(served.echovault === 1, `served manifest has ${served.echovault} Echo Vault entries`);
    assert(served.total === expectedGames.length,
      `served manifest has ${served.total} entries but Games main has ${expectedGames.length} — Pages is stale`);
    return `served manifest ${served.total} entries, matching Games main, with the entry present`;
  });

  await gate('C2', 'exactly one Echo Vault card on the whole shelf', () => {
    const hits = shelf.all.filter(h => h === HREF);
    assert(hits.length === 1, `browse-all grid rendered ${hits.length} Echo Vault cards`);
    const everywhere = [...shelf.all, ...shelf.picks, ...shelf.sports, ...shelf.themed, ...shelf.classRail]
      .filter(h => h === HREF);
    assert(everywhere.length === 1,
      `Echo Vault appears ${everywhere.length} times across all rails — expected exactly one`);
    return 'one card, in the browse-all grid, and nowhere else';
  });

  await gate('C3', 'served card count equals the manifest', () => {
    assert(shelf.all.length === expectedGames.length,
      `browse-all grid rendered ${shelf.all.length} cards for ${expectedGames.length} manifest entries`);
    const missing = expectedGames.map(g => g.href).filter(h => !shelf.all.includes(h));
    assert(missing.length === 0, `manifest entries that did not render: ${missing.join(', ')}`);
    return `${shelf.all.length} cards rendered for ${expectedGames.length} manifest entries, none missing`;
  });

  await gate('C4', 'not on the Sports rail, and the rail is undisturbed', () => {
    assert(!shelf.sports.includes(HREF), 'Echo Vault rendered on the Sports rail');
    assert(shelf.sports.length === expectedSports.length,
      `Sports rail rendered ${shelf.sports.length} cards, manifest says ${expectedSports.length}`);
    return `Sports rail still ${shelf.sports.length} cards, Echo Vault absent from it`;
  });

  await gate('C5', 'nothing displaced', () => {
    const dupes = shelf.all.filter((h, i) => shelf.all.indexOf(h) !== i);
    assert(dupes.length === 0, `duplicate cards in the browse-all grid: ${[...new Set(dupes)].join(', ')}`);

    // NON-VACUITY GUARD. The first version of this gate queried '#rail .pick',
    // which matches nothing — the element is '#topRail'. A selector that matches
    // nothing answers every question with a confident zero, so the "Echo Vault
    // did not take a pick slot" limb was passing without looking at anything.
    // Every rail we claim to inspect must therefore be proven non-empty first.
    assert(shelf.picks.length > 0,
      'the curated pick rail selector matched nothing — the gate would be vacuous, not passing');
    assert(shelf.themed.length > 0,
      'the themed-grid selector matched nothing — the gate would be vacuous, not passing');
    assert(!shelf.picks.includes(HREF), 'Echo Vault took a curated pick slot it was not given');
    assert(!shelf.themed.includes(HREF), 'Echo Vault appeared in a themed grid it was not added to');

    // Every rendered pick must still be a real manifest entry.
    const manifestHrefs = new Set(shelf.all);
    const orphanPicks = shelf.picks.filter(h => !manifestHrefs.has(h));
    assert(orphanPicks.length === 0, `picks pointing outside the manifest: ${orphanPicks.join(', ')}`);

    assert(errors.length === 0, `page errors: ${errors.slice(0, 2).join(' | ')}`);
    return `${shelf.picks.length} curated picks and ${shelf.themed.length} themed cards intact, all in the manifest, no duplicates, 0 page errors`;
  });

  await gate('C6', 'the count line reports the new total', () => {
    assert(shelf.countline.includes(String(expectedGames.length)),
      `count line "${shelf.countline.trim()}" does not mention ${expectedGames.length}`);
    return shelf.countline.trim();
  });

  await browser.close();
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nEcho Vault surfaces: ${results.length - failed.length}/${results.length} gates passed.`);
  if (failed.length) process.exit(1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
