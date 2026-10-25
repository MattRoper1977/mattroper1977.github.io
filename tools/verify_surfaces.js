#!/usr/bin/env node
'use strict';
/**
 * Surface census — measures whether the ruled games are actually VISIBLE to a
 * visitor, and proves the measurement can fail.
 *
 * This replaces a census that greped served HTML for a slug and reported the
 * result as if it meant something. It did not: /games/ renders its cards
 * client-side from a fetched manifest, so a static grep reads 0 no matter what
 * the manifest says. A number that cannot move is not a measurement.
 *
 * Three things are measured here, all from a runner, none assumed:
 *   1  JS-OFF homepage — the "New and updated" rail is static markup (one
 *      `data-release` box per games[] entry that carries `updated` in the
 *      page's own #play-data dataset), so a served-bytes check is the right
 *      instrument for it, and the expected set is DERIVED from that dataset.
 *   2  JS-ON arcade    — the cards are rendered, so they are counted in the
 *      rendered DOM with a real browser, with a can-fail control.
 *   3  MANIFEST ORIGIN — how /Games/games.json is actually served, and whether
 *      the served copy reflects the Games repo. Never assume a repo merge
 *      reached the origin.
 *
 * Usage:  node tools/verify_surfaces.js [--base https://madebymatt-play.uk]
 *
 * HC3 §1.1: games serve on the play origin. The play home renders the shelf as
 * static .game-card articles in #game-grid (no genre accordions), so each limb
 * below accepts the play structure beside the old one.
 *
 * J92 (R6, F-new-release-occupants): the three authored New Release boxes of
 * the 12 Aug homepage stopped being served on 6 Sep (#268 gave / and /main/ to
 * the play shelf) and S1 read `served occupants: []` against three ruled names
 * ever since. The play shelf's rail is the updated array, so S1 now compares
 * the served `data-release` ids against the ids the served #play-data declares
 * as updated — nothing typed. The ruled three-name map is still read and
 * printed, as information: whether each ruled name is among today's updated
 * entries is reported, never enforced.
 */
const path = require('path');
const http = require('http');
const fs = require('fs');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('playwright-core')); }

const BASE = (process.argv.find(a => a.startsWith('--base=')) || '--base=https://madebymatt-play.uk').split('=').slice(1).join('=');

// The ruling, restated where it is enforced.
// Matt, 5 Aug 2026: New Release is a stack; each game holds at most ONE box.
//
// WHO occupies it is NOT restated here any more. This file froze
// ['Neon Sync', 'Neon Breach'] on 5 Aug and went stale the moment the boxes
// moved — by site commits 69c1d57 and 3e6deb0 (the 2026-08-12 driving-games
// launch: Neon Meridian, then Rally Vector 3D) — and nothing noticed, because
// this workflow could fire only on a launch branch that had already merged.
// The occupant set is a declared shelf fact with exactly one writer, so it is
// read from that writer. A frozen copy here was the defect, not the ruling.
const OCCUPANT_RECORD = path.join(__dirname, '..', 'data', 'new-release-occupants.json');
const RECORD = JSON.parse(fs.readFileSync(OCCUPANT_RECORD, 'utf8'));
const RULED_OCCUPANTS = Object.keys(RECORD.occupants);
// Games ruled onto the arcade shelf this programme.
const RULED_CARDS = [
  { title: 'Neon Sync',    href: '/neonsync/' },
  { title: 'Biopunk Hive', href: '/biopunkhive/' },
  { title: 'Neon Breach',  href: '/neonbreach/' },
];

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d ? '  [' + d + ']' : '')); };
const get = url => fetch(url, { cache: 'no-store' }).then(r => r.text());

function launchOpts() {
  const o = { headless: true, args: ['--no-sandbox'] };
  const b = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (b && fs.existsSync(b)) {
    const d = fs.readdirSync(b).filter(x => /^chromium-\d+$/.test(x)).sort().pop();
    const exe = d && path.join(b, d, 'chrome-linux', 'chrome');
    if (exe && fs.existsSync(exe)) o.executablePath = exe;
  }
  return o;
}

(async () => {
  console.log('Surface census against ' + BASE + '\n');

  /* ---------------------------------------------------- 1 · JS-OFF homepage */
  // SECOND defect in this limb, same commit. It fetched BASE + '/' — which was
  // the full homepage until #110 gave / to the audience chooser and moved the
  // homepage to /main/. Since then this read a page with no data-release boxes
  // at all and reported `served occupants: []`, so the frozen list above could
  // not have matched even if it had been current. Both halves had to move for
  // this limb to measure anything: the surface it reads, and where it reads the
  // ruling from. Same species as BACKLOG 0a-A.
  //
  // THIRD, J92 (R6). The ruled map named three authored boxes that no served
  // page has carried since 6 Sep. On the play shelf the rail is the updated
  // array: one `data-release="<id>"` box per games[] entry with `updated`, and
  // none at all when the array is empty. So the expected set is derived from
  // the served page's own #play-data, and the limb holds in both directions:
  // every served box is an updated entry, every updated entry has a box, no id
  // twice. A page with no readable dataset is MEASUREMENT INVALID, not a pass.
  console.log('S1 — "New and updated" rail: one data-release box per updated entry in the served #play-data');
  const home = await get(BASE + '/main/');
  const occupants = [...home.matchAll(/data-release="([^"]+)"/g)].map(m => m[1]);
  let dataset = null, datasetError = null;
  try {
    const m = home.match(/<script id="play-data" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('no #play-data script in the served page');
    dataset = JSON.parse(m[1]);
    if (!Array.isArray(dataset.games)) throw new Error('#play-data has no games[] array');
  } catch (e) { dataset = null; datasetError = e.message; }
  const expected = dataset ? dataset.games.filter(g => g.updated).map(g => g.id) : [];
  const missing = expected.filter(id => !occupants.includes(id));
  const stray = occupants.filter(id => !expected.includes(id));
  const twice = [...new Set(occupants.filter((o, i) => occupants.indexOf(o) !== i))];
  console.log('       served release boxes: ' + occupants.length + '; expected (updated entries in #play-data): ' + expected.length);
  ok('served dataset readable', dataset !== null,
    dataset === null ? datasetError : dataset.games.length + ' rows, ' + expected.length + ' carry updated');
  ok('every updated entry has a release box', dataset !== null && missing.length === 0,
    dataset === null ? 'MEASUREMENT INVALID - no dataset to derive the expected set from'
      : (expected.length - missing.length) + ' of ' + expected.length + ' served' + (missing.length ? ', missing: ' + missing.slice(0, 5).join(',') + (missing.length > 5 ? ',…' : '') : ''));
  ok('no release box outside the updated array', dataset !== null && stray.length === 0,
    dataset === null ? 'MEASUREMENT INVALID - no dataset to judge the served boxes against'
      : (stray.length ? stray.slice(0, 5).join(',') : 'none'));
  ok('no game holds two surfaces', twice.length === 0, twice.join(',') || 'none');
  // The ruled three-name map (data/new-release-occupants.json): information,
  // not a gate. The map binds an authored box label to a folder slug; an entry
  // is "among the updated entries" when the dataset row at /<slug>/ carries
  // updated. Today none is, and that is reported as stale rather than failed.
  const routeOf = slug => '/' + slug + '/';
  const amongUpdated = dataset ? RULED_OCCUPANTS.filter(name => dataset.games.some(g => g.updated && g.route === routeOf(RECORD.occupants[name]))) : [];
  for (const name of RULED_OCCUPANTS) {
    console.log('       ruled occupant ' + JSON.stringify(name) + ' -> /' + RECORD.occupants[name] + '/: '
      + (dataset === null ? 'not judged (no dataset)' : amongUpdated.includes(name) ? 'among the updated entries' : 'not among the updated entries (map is stale, reported only)'));
  }
  console.log('       ruled map: ' + amongUpdated.length + ' of ' + RULED_OCCUPANTS.length + ' names among the updated entries (information, not enforced)');

  /* ---------------------------------------------- 3 · manifest origin first */
  // Run before the DOM count, because a stale manifest EXPLAINS a low count.
  console.log('\nS3 — how /Games/games.json is served, and whether it is current');
  let servedEntries = null, servedTitles = [];
  try {
    const raw = await get(BASE + '/Games/games.json');
    const doc = JSON.parse(raw);
    servedEntries = doc.games.length;
    servedTitles = doc.games.map(g => g.title);
    console.log('       served /Games/games.json entries: ' + servedEntries);
  } catch (e) {
    console.log('       served /Games/games.json UNREADABLE: ' + e.message);
  }
  // The site repo contains no Games/ directory and no submodule, so this path
  // is not served by the site repo at all — it is the MattRoper1977/Games
  // project Pages site mounted under the same custom domain. Derived, and
  // reported rather than assumed.
  ok('manifest origin reachable', servedEntries !== null, servedEntries === null ? 'unreadable' : servedEntries + ' entries');
  if (servedEntries !== null) {
    for (const c of RULED_CARDS) {
      ok('served manifest carries ' + c.title, servedTitles.includes(c.title));
    }
  }

  /* ------------------------------------------------------ 2 · JS-ON arcade */
  console.log('\nS2 — arcade cards, counted in the RENDERED DOM (JS on)');
  const browser = await chromium.launch(launchOpts());
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/games/', { waitUntil: 'networkidle' });
  /* S1'/R9. This was `waitForTimeout(1500)`. A duration asserts nothing and is
     flaky by construction — it is the species that put the swatch gate red on
     main. Wait on the CONDITION: cards attached to the browse host. A timeout
     here is MEASUREMENT INVALID, never a card count of zero dressed up as a
     finding. */
  let cardsSettled = true;
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('#genreSections .gcard, #game-grid .game-card').length > 0,
      null, { timeout: 15000 });
  } catch (_) { cardsSettled = false; }
  const rendered = await page.evaluate(hrefs => {
    const out = {};
    for (const h of hrefs) out[h] = document.querySelectorAll('a[href="' + h + '"], [data-href="' + h + '"]').length;
    /* __total counts EVERY internal anchor — nav, footer, headings, the rail —
       and is NOT a card count. It is logged for context only; nothing asserts
       on it. Reporting it beside a card count is how "52 vs 73" became a
       phantom finding. */
    out.__total = document.querySelectorAll('a[href^="/"], [data-href^="/"]').length;
    out.__genreCards = document.querySelectorAll('#genreSections .gcard, #game-grid .game-card').length;
    out.__flatCards  = document.querySelectorAll('#flatResults .gcard').length;
    return out;
  }, RULED_CARDS.map(c => c.href));
  console.log('       rendered anchors: ' + JSON.stringify(rendered));
  for (const c of RULED_CARDS) ok('card rendered for ' + c.title, (rendered[c.href] || 0) > 0, String(rendered[c.href] || 0));

  /* ---- S2f: the surface FLOOR, derived per selector, never a literal --------
     A2/S1'. Everything above asserts NAMED games. A render that dropped fifty
     cards while keeping Neon Sync, Biopunk Hive and Neon Breach would pass every
     one of them. That is the collapsed-render failure mode, and nothing was
     watching for it.

     The floor is DERIVED from the served manifest at run time. Never a literal:
     the `511` incident is the precedent and 717 is the second literal already
     loose in this estate.

     Per selector, because one number cannot guard two surfaces:
       #genreSections  every manifest entry gets a genre card -> floor = manifest length
       #flatResults    the SEARCH results host. Empty until a query is typed, so
                       0 is its correct at-rest value and a floor on it would red
                       on correct behaviour. Deliberately unfloored; the rule is
                       named here rather than left as an unexplained absence. */
  let floorManifest = null;
  try { floorManifest = JSON.parse(await get(BASE + '/Games/games.json')); } catch (_) { floorManifest = null; }
  const floorExpected = floorManifest ? ((floorManifest.games || floorManifest).length) : 0;
  if (!cardsSettled) {
    ok('SURFACE FLOOR: #genreSections', false,
       'MEASUREMENT INVALID - no frame arrived with a card attached, so the count was never taken');
  } else if (!floorExpected) {
    ok('SURFACE FLOOR: #genreSections', false,
       'MEASUREMENT INVALID - the served manifest did not parse, so no floor could be derived');
  } else {
    const observed = rendered.__genreCards;
    ok('SURFACE FLOOR: #genreSections', observed >= floorExpected,
       `expected >=${floorExpected} (derived: served manifest length), observed ${observed}`);
  }
  console.log(`       #flatResults ${rendered.__flatCards} cards - unfloored by design (search host, empty at rest)`);

  /* ---- S2g: the CONDITIONAL floor for #flatResults (T6.1) -----------------
     "0 at rest is correct" is a sound reason not to floor AT REST. It is not a
     reason to leave the surface unguarded: 0 results for a term that certainly
     matches is a real defect and nothing was catching it.

     So drive a search for a term DERIVED from the served manifest - never a
     literal - and require a non-zero result. The term is named in the
     assertion, because a floor whose input is invisible cannot be argued with. */
  if (floorExpected && cardsSettled) {
    const probe = await page.evaluate(async (man) => {
      const first = (man.games || man)[0] || {};
      // a token from a real title: certain to match, and it moves with the shelf
      const term = String(first.title || '').split(/\s+/).filter((w) => w.length > 3)[0] || '';
      const box = document.querySelector('#q') || document.querySelector('#query');
      if (!box || !term) return { term, found: null, why: !box ? 'no #q/#query search box' : 'no usable term in the first title' };
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(box, term);
      box.dispatchEvent(new Event('input', { bubbles: true }));
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const n = document.querySelectorAll('#flatResults .gcard').length
          || [...document.querySelectorAll('#game-grid .game-card')].filter((c) => !c.hidden && c.getBoundingClientRect().height > 0).length;
        if (n > 0) return { term, found: n };
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { term, found: 0 };
    }, floorManifest);
    if (probe.found === null) {
      ok('SEARCH FLOOR: #flatResults', false, `MEASUREMENT INVALID - ${probe.why}, so the search was never driven`);
    } else {
      ok('SEARCH FLOOR: #flatResults', probe.found > 0,
         `searching "${probe.term}" (derived: first served manifest title) returned ${probe.found} card(s)`);
    }
  }

  /* ------------------- can-fail control for the rendered-DOM count -------- */
  // A count that cannot drop is not a measurement. Serve the same page against
  // a manifest with one ruled game REMOVED, and require the count to fall.
  console.log('\nS2c — can-fail control: remove one ruled game from the manifest');
  const gamesHtml = await get(BASE + '/games/');
  let manifest;
  try { manifest = JSON.parse(await get(BASE + '/Games/games.json')); } catch (_) { manifest = null; }
  if (!manifest) {
    ok('control could not run (manifest unreadable)', false);
  } else {
    const victim = 'Neon Breach';
    const stripped = { ...manifest, games: manifest.games.filter(g => g.title !== victim) };
    // The play home carries its cards as static markup, so the manifest
    // strip alone cannot drop a card there: strip the victim's card from the
    // served HTML as well. Same predicate, same expectation (0 after).
    const strippedHtml = gamesHtml.replace(/<article class="game-card[^"]*" data-card="game-neon-breach">[\s\S]*?<\/article>/, '')
      .replace(/<article class="game-card[^"]*"[^>]*>(?:(?!<\/article>)[\s\S])*?href="\/neonbreach\/"[\s\S]*?<\/article>/, '');
    const srv = http.createServer((req, res) => {
      const p = req.url.split('?')[0];
      if (p === '/Games/games.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(stripped));
      }
      if (p === '/games/' || p === '/games/index.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(strippedHtml);
      }
      res.writeHead(404); res.end('nf');
    });
    await new Promise(r => srv.listen(0, r));
    const local = 'http://127.0.0.1:' + srv.address().port;
    const p2 = await ctx.newPage();
    await p2.goto(local + '/games/', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(1200);
    const after = await p2.evaluate(() =>
      document.querySelectorAll('a[href="/neonbreach/"], [data-href="/neonbreach/"]').length);
    srv.close();
    ok('control FIRED — removing ' + victim + ' drops its rendered count to 0',
      after === 0, 'rendered=' + after);
  }

  await browser.close();

  console.log('\n' + '='.repeat(64));
  console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'ALL ' + pass + ' SURFACE CHECKS PASSED');
  console.log('='.repeat(64));
  console.log('SERVED_MANIFEST_ENTRIES=' + (servedEntries === null ? 'unreadable' : servedEntries));
  console.log('HOMEPAGE_OCCUPANTS=' + JSON.stringify(occupants));
  console.log('SURFACES_PASS=' + (fail ? 'false' : 'true'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('surface census error: ' + e.stack); process.exit(2); });
