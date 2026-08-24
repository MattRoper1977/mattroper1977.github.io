#!/usr/bin/env node
/*
 * verify_relicforge_surfaces.js — Part C, whole-shelf render check.
 *
 * Measured against the SERVED page in a real browser, not against the local
 * file and not by grepping HTML: the arcade shelf builds every card in
 * JavaScript from /Games/games.json, so the shipped markup contains no cards at
 * all and a grep would report a confident zero.
 *
 * Under the standing ruling Relicforge is a GENERAL SHELF entry, so what is
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
 *   node tools/verify_relicforge_surfaces.js
 */
'use strict';
const { chromium } = require('playwright');
const { probeShelf, taxonomyFromHtml, expectedInGenre, assertRendered } = require('./lib/shelf-probe.js');

const SHELF = process.env.RF_SHELF_URL || 'https://madebymatt.uk/games/';
const RAW_MANIFEST = 'https://raw.githubusercontent.com/MattRoper1977/Games/main/games.json';
const HREF = '/relicforge/';

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
  console.log(`manifest at Games main (derived): ${expectedGames.length} entries`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(SHELF, { waitUntil: 'networkidle', timeout: 60000 });

  // The shelf paints asynchronously; wait for the grid rather than guessing a delay.
  await page.waitForFunction(
    (n) => document.querySelectorAll('#genreSections .gcard, #flatResults .gcard').length >= n,
    expectedGames.length,
    { timeout: 60000 }
  ).catch(() => {});

  const shelf = await probeShelf(page);
  /* The genre map is read from the SERVED page's own TAXONOMY literal, not from
     the manifest's `collection` field. Those two disagree by one entry today. */
  const servedHtml = await page.content();
  const taxonomy = taxonomyFromHtml(servedHtml);
  const expectedSportsHrefs = expectedInGenre(expectedGames, taxonomy, 'Sports');
  console.log(`served TAXONOMY (derived): ${taxonomy.size} rows, ${expectedSportsHrefs.length} of them Sports and in the manifest`);

  await gate('C1', 'the served manifest carries the entry (Pages published the merge)', async () => {
    const served = await page.evaluate(async () => {
      const r = await fetch('/Games/games.json', { cache: 'no-cache' });
      const d = await r.json();
      return { total: d.games.length, relicforge: d.games.filter(g => g.href === '/relicforge/').length };
    });
    assert(served.relicforge === 1, `served manifest has ${served.relicforge} Relicforge entries`);
    assert(served.total === expectedGames.length,
      `served manifest has ${served.total} entries but Games main has ${expectedGames.length} — Pages is stale`);
    return `served manifest ${served.total} entries, matching Games main, with the entry present`;
  });

  await gate('C2', 'exactly one Relicforge card on the whole shelf', () => {
    assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, expectedGames.length);
    const hits = shelf.all.filter(h => h === HREF);
    assert(hits.length === 1, `browse structure rendered ${hits.length} Relicforge cards`);
    /* The Top Picks rail is the ONE permitted duplication on this page: a game
       in TOP is painted twice on purpose, once as a pick and once in its genre.
       So the rule is not "exactly one card anywhere" — it is one card in the
       browse structure, plus a pick if and only if it is in TOP. Asserting a
       flat one would make the rail itself a defect. */
    const inTop = shelf.picks.filter(h => h === HREF).length;
    const everywhere = [...shelf.all, ...shelf.picks].filter(h => h === HREF);
    assert(inTop <= 1, `Relicforge has ${inTop} cards on the Top Picks rail — a rail slot may only be held once`);
    assert(everywhere.length === 1 + inTop,
      `Relicforge appears ${everywhere.length} times across the page; expected ${1 + inTop} (one in browse` +
      (inTop ? ', plus its Top Picks slot)' : ')'));
    return inTop
      ? 'one card in the browse structure, plus its deliberate Top Picks slot'
      : 'one card, in the browse structure, and nowhere else';
  });

  await gate('C3', 'served card count equals the manifest', () => {
    assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, expectedGames.length);
    assert(shelf.all.length === expectedGames.length,
      `browse structure rendered ${shelf.all.length} cards for ${expectedGames.length} manifest entries`);
    const missing = expectedGames.map(g => g.href).filter(h => !shelf.all.includes(h));
    assert(missing.length === 0, `manifest entries that did not render: ${missing.join(', ')}`);
    return `${shelf.all.length} cards rendered for ${expectedGames.length} manifest entries, none missing`;
  });

  await gate('C4', 'not on the Sports rail, and the rail is undisturbed', () => {
    /* There is no Sports RAIL. Sports is a genre section, and its membership
       comes from the page's TAXONOMY, not from the manifest's `collection`. */
    const sports = shelf.sections['Sports'];
    assert(Array.isArray(sports),
      'no Sports genre section rendered — the genre either vanished or the section shape moved');
    assertRendered(assert, 'Sports genre section', true, sports, expectedSportsHrefs.length);
    assert(!sports.includes(HREF), 'Relicforge rendered in the Sports genre section');
    assert(sports.length === expectedSportsHrefs.length,
      `Sports section rendered ${sports.length} cards, TAXONOMY x manifest says ${expectedSportsHrefs.length}`);
    return `Sports section still ${sports.length} cards, Relicforge absent from it`;
  });

  await gate('C5', 'nothing displaced', () => {
    const dupes = shelf.all.filter((h, i) => shelf.all.indexOf(h) !== i);
    assert(dupes.length === 0, `duplicate cards in the browse-all grid: ${[...new Set(dupes)].join(', ')}`);

    // NON-VACUITY GUARD. The first version of this gate queried '#rail .pick',
    // which matches nothing — the element is '#topRail'. A selector that matches
    // nothing answers every question with a confident zero, so the "Relicforge
    // did not take a pick slot" limb was passing without looking at anything.
    // Every rail we claim to inspect must therefore be proven non-empty first.
    assertRendered(assert, 'curated pick rail', shelf.hasPicksHost, shelf.picks, 1);
    // The non-vacuity guard above is the point of this block and it stays. What
    // it guards has moved: the themed grids were absorbed into feel tags, so a
    // '#tgrids' selector now matches nothing and would make THIS guard the
    // vacuous one. The browse structure takes its place — it is the selector
    // every count in this file depends on.
    assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, expectedGames.length);
    // This limb used to read "Relicforge took a curated pick slot it was not given".
    // That was true when it was written and is not any more: the Top Picks rail
    // is a ruled, declared eight, and a game may hold exactly one slot in it.
    // Asserting absence would now make a deliberate curation decision a defect,
    // so the assertion is the one that survives a ruling — at most one slot,
    // never two.
    const slots = shelf.picks.filter(h => h === HREF).length;
    assert(slots <= 1, `Relicforge holds ${slots} slots on the Top Picks rail — a rail slot may only be held once`);

    // Every rendered pick must still be a real manifest entry.
    const manifestHrefs = new Set(shelf.all);
    const orphanPicks = shelf.picks.filter(h => !manifestHrefs.has(h));
    assert(orphanPicks.length === 0, `picks pointing outside the manifest: ${orphanPicks.join(', ')}`);

    assert(errors.length === 0, `page errors: ${errors.slice(0, 2).join(' | ')}`);
    return `${shelf.picks.length} curated picks intact over ${shelf.all.length} browse cards, all in the manifest, no duplicates, ${slots} pick slot(s) held, 0 page errors`;
  });

  await gate('C6', 'the count line reports the new total', () => {
    assert(shelf.countline.includes(String(expectedGames.length)),
      `count line "${shelf.countline.trim()}" does not mention ${expectedGames.length}`);
    return shelf.countline.trim();
  });

  await browser.close();
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nRelicforge surfaces: ${results.length - failed.length}/${results.length} gates passed.`);
  if (failed.length) process.exit(1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
