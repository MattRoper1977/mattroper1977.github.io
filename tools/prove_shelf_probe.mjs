#!/usr/bin/env node
/*
 * prove_shelf_probe.mjs — the controls for tools/lib/shelf-probe.js.
 *
 * The two surfaces gates read live production, which this sandbox cannot reach,
 * so the probe is proved here against a page served from the repo instead. That
 * is a weaker claim about PRODUCTION and an identical claim about the PROBE:
 * the served bytes are the same bytes Pages serves, because there is no build.
 *
 * Four scenarios, and the two that matter are the ones that used to be able to
 * lie:
 *   1. a healthy page                     -> the guard passes and counts agree
 *   2. the drifted selector (#allGrid)    -> must fail as DRIFT, not as a count
 *   3. an empty manifest                  -> must FAIL, where `rendered ===
 *                                            expected` alone would read 0 === 0
 *   4. one card missing from the render   -> the count must bite
 *
 *   node tools/prove_shelf_probe.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { probeShelf, taxonomyFromHtml, expectedInGenre, assertRendered } = require('./lib/shelf-probe.js');

const ROOT = new URL('..', import.meta.url).pathname;
/* The shelf manifest. data/source-manifests/games.json is this repo's mirror of
   the canonical shelf and is asserted byte-identical to it by its own gate, so
   it is the right source AND it is already here — no second checkout, no path
   that only exists on one machine. GAMES_DIR remains an override for anyone
   running this beside a Games clone.

   This defaulted to '/home/user/games' when it was written, which is a sandbox
   path. CI has no such directory and the control died with ENOENT before its
   first scenario — the same defect as the pinned Chromium in apex_rc_gate.mjs,
   committed an hour after fixing that one. A default that only resolves on the
   machine it was written on is not a default. */
const MIRROR = join(ROOT, 'data/source-manifests/games.json');
const GAMES = process.env.GAMES_DIR || null;
const manifestPath = () => (GAMES ? join(GAMES, 'games.json') : MIRROR);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

let manifestOverride = null;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/Games/games.json') {
    const body = manifestOverride ?? readFileSync(manifestPath(), 'utf8');
    res.writeHead(200, { 'content-type': 'application/json' }); return res.end(body);
  }
  if (p.startsWith('/Games/')) p = GAMES ? join(GAMES, p.slice(7)) : join(ROOT, 'data/source-manifests', p.slice(7));
  else p = join(ROOT, p);
  if (p.endsWith('/')) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (n, c, d = '') => { console.log(`  ${c ? '[ ok ]' : '[FAIL]'} ${n}${d ? '  — ' + d : ''}`); c ? pass++ : fail++; };
const assert = (x, m) => { if (!x) throw new Error(m); };

const browser = await chromium.launch();
async function load() {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(BASE + '/games/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('#genreSections .gcard').length > 0, { timeout: 15000 }).catch(() => {});
  return page;
}

console.log('\n=== 1. a healthy page: the guard passes and every count agrees ===\n');
{
  const page = await load();
  const shelf = await probeShelf(page);
  const manifest = JSON.parse(readFileSync(manifestPath(), 'utf8')).games;
  const tax = taxonomyFromHtml(await page.content());
  const sports = expectedInGenre(manifest, tax, 'Sports');
  ok('the browse container exists', shelf.hasGenreHost);
  ok('it rendered one card per manifest entry', shelf.all.length === manifest.length, `${shelf.all.length} of ${manifest.length}`);
  ok('the curated rail rendered', shelf.picks.length > 0, `${shelf.picks.length} picks`);
  ok('a Sports genre section exists', Array.isArray(shelf.sections['Sports']));
  ok('Sports matches TAXONOMY x manifest, not `collection`',
     shelf.sections['Sports'].length === sports.length,
     `rendered ${shelf.sections['Sports'].length}, derived ${sports.length}, by collection ${manifest.filter(g => g.collection === 'Sports').length}`);
  let threw = null; try { assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, manifest.length); } catch (e) { threw = e.message; }
  ok('the non-vacuity guard passes on a healthy page', threw === null, threw || '');
  await page.close();
}

console.log('\n=== 2. the drifted selector: must fail as DRIFT, naming the container ===\n');
{
  const page = await load();
  const drifted = await page.evaluate(() => ({
    hasHost: !!document.querySelector('#allGrid'),
    cards: [...document.querySelectorAll('#allGrid .gcard')].map(a => a.getAttribute('href')),
  }));
  const manifest = JSON.parse(readFileSync(manifestPath(), 'utf8')).games;
  let msg = null; try { assertRendered(assert, 'browse structure', drifted.hasHost, drifted.cards, manifest.length); } catch (e) { msg = e.message; }
  ok('#allGrid really matches nothing on this page', drifted.cards.length === 0 && !drifted.hasHost);
  ok('the guard fires', msg !== null);
  ok('and it fires on DRIFT, not on a count', /container selector matched nothing/.test(msg || ''), msg || '');
  await page.close();
}

console.log('\n=== 3. an empty manifest: `rendered === expected` alone would read 0 === 0 ===\n');
{
  manifestOverride = JSON.stringify({ games: [] });
  const page = await load();
  const shelf = await probeShelf(page);
  const expected = [];
  ok('the page rendered no cards', shelf.all.length === 0);
  ok('the container is still there, so this is NOT drift', shelf.hasGenreHost);
  const vacuous = shelf.all.length === expected.length;
  ok('the OLD equality would have passed', vacuous, '0 === 0');
  let msg = null; try { assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, expected.length); } catch (e) { msg = e.message; }
  ok('the guard refuses it', msg !== null);
  ok('and it names the zero floor', /zero floor|rendered 0 cards/.test(msg || ''), msg || '');
  manifestOverride = null;
  await page.close();
}

console.log('\n=== 4. one entry dropped: the count still bites ===\n');
{
  const full = JSON.parse(readFileSync(manifestPath(), 'utf8'));
  const short = { ...full, games: full.games.slice(1) };
  manifestOverride = JSON.stringify(short);
  const page = await load();
  const shelf = await probeShelf(page);
  ok('the page rendered the short manifest', shelf.all.length === short.games.length, `${shelf.all.length}`);
  let msg = null;
  try {
    assertRendered(assert, 'browse structure', shelf.hasGenreHost, shelf.all, full.games.length);
    assert(shelf.all.length === full.games.length,
      `browse structure rendered ${shelf.all.length} cards for ${full.games.length} manifest entries`);
  } catch (e) { msg = e.message; }
  ok('measured against the full manifest it goes red', msg !== null);
  ok('and the red is the count, not the guard', /rendered \d+ cards for \d+ manifest entries/.test(msg || ''), msg || '');
  manifestOverride = null;
  await page.close();
}

await browser.close(); server.close();
console.log(`\nshelf probe controls: ${pass}/${pass + fail} passed`);
if (fail) { console.error(`${fail} FAILED`); process.exit(1); }
