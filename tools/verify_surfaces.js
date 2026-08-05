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
 *   1  JS-OFF homepage — the New Release boxes are static markup, so a served-
 *      bytes check is the right instrument for them.
 *   2  JS-ON arcade    — the cards are rendered, so they are counted in the
 *      rendered DOM with a real browser, with a can-fail control.
 *   3  MANIFEST ORIGIN — how /Games/games.json is actually served, and whether
 *      the served copy reflects the Games repo. Never assume a repo merge
 *      reached the origin.
 *
 * Usage:  node tools/verify_surfaces.js [--base https://madebymatt.uk]
 */
const path = require('path');
const http = require('http');
const fs = require('fs');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('playwright-core')); }

const BASE = (process.argv.find(a => a.startsWith('--base=')) || '--base=https://madebymatt.uk').split('=').slice(1).join('=');

// The ruling, restated where it is enforced.
// Matt, 5 Aug 2026: New Release is a stack; each game holds at most ONE box;
// ruled occupants = Neon Sync (top, amended for v1.1) + Neon Breach.
const RULED_OCCUPANTS = ['Neon Sync', 'Neon Breach'];
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
  console.log('S1 — homepage New Release boxes (static markup, served bytes)');
  const home = await get(BASE + '/');
  const occupants = [...home.matchAll(/data-release="([^"]+)"/g)].map(m => m[1]);
  console.log('       served occupants: ' + JSON.stringify(occupants));
  for (const r of RULED_OCCUPANTS) ok('ruled occupant served: ' + r, occupants.includes(r));
  ok('no unruled occupant', occupants.every(o => RULED_OCCUPANTS.includes(o)),
    occupants.filter(o => !RULED_OCCUPANTS.includes(o)).join(',') || 'none');
  ok('no game holds two surfaces',
    new Set(occupants).size === occupants.length,
    [...new Set(occupants.filter((o, i) => occupants.indexOf(o) !== i))].join(',') || 'none');

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
  await page.waitForTimeout(1500);
  const rendered = await page.evaluate(hrefs => {
    const out = {};
    for (const h of hrefs) out[h] = document.querySelectorAll('a[href="' + h + '"], [data-href="' + h + '"]').length;
    out.__total = document.querySelectorAll('a[href^="/"], [data-href^="/"]').length;
    return out;
  }, RULED_CARDS.map(c => c.href));
  console.log('       rendered anchors: ' + JSON.stringify(rendered));
  for (const c of RULED_CARDS) ok('card rendered for ' + c.title, (rendered[c.href] || 0) > 0, String(rendered[c.href] || 0));

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
    const srv = http.createServer((req, res) => {
      const p = req.url.split('?')[0];
      if (p === '/Games/games.json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(stripped));
      }
      if (p === '/games/' || p === '/games/index.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(gamesHtml);
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
