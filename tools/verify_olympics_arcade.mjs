#!/usr/bin/env node
/* verify_olympics_arcade.mjs — the Global Games landing, seen through the page
 * a visitor actually loads.
 *
 * The manifest gates in the Games repo check the DATA. This checks that the
 * arcade RENDERS it: that the card exists on screen, that the Sports rail grew
 * to seven visibly distinct cards, that the marker moved, and that nothing
 * overflows on a phone. A manifest can be perfect and the page still show
 * nothing — /olympics/ was served for a while with no catalogue entry at all,
 * which is precisely the failure mode a data-only gate cannot see.
 *
 * Every count is DERIVED from the manifest at run time, never pinned: this gate
 * should check more when the shelf grows, not go red.
 *
 * Serves site/ and Games/ together because the arcade fetches
 * /Games/games.json from the other repo.
 *
 *   node tools/verify_olympics_arcade.mjs
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);

import fsSync from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..');
const GAMES = process.env.GAMES_DIR || '/home/user/Games';
/* A declared precondition, honoured rather than discovered - see
 * data/instrument-preconditions.json. Exit 3 is INCONCLUSIVE: the instrument
 * did not judge, which is a statement about the environment and never about
 * the subject. */
if (!GAMES || !fsSync.existsSync(path.join(GAMES, 'games.json'))) {
  console.error('INCONCLUSIVE: the Games estate is not available, so this instrument did not judge.');
  console.error(`  looked for : ${path.join(String(GAMES), 'games.json')}`);
  console.error('  supplied by: GAMES_DIR=<path to that estate>');
  console.error('  declared in: data/instrument-preconditions.json');
  process.exit(3);
}

/* Loaded only after the precondition holds. Required above the guard, a
 * machine without playwright crashed on module load - exit 1 and a stack
 * trace - before this file could say INCONCLUSIVE and exit 3, so it could
 * not honour the contract it declares. */
const { chromium } = require('playwright');

const HREF = '/olympics/';

let red = 0;
const t = (name, ok, detail) => {
  if (!ok) red++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
                '.png': 'image/png', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };

function serve(manifestOverride) {
  const srv = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/Games/games.json' && manifestOverride) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifestOverride)); return;
    }
    const base = url.startsWith('/Games/') ? GAMES : SITE;
    if (url.startsWith('/Games/')) url = url.slice('/Games'.length);
    let f = path.join(base, url);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function readArcade(base, viewport) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 100)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 100)); });
  await page.goto(base + '/games/', { waitUntil: 'commit' });
  /* POLL for the rendered cards. The page fetches the manifest from another
     origin path and builds the DOM afterwards, so a single sample lands on an
     empty grid and calls it a pass. */
  await page.waitForFunction(() => document.querySelectorAll('.gcard').length > 10, null, { timeout: 20000 }).catch(() => {});
  const out = await page.evaluate((href) => {
    const txt = n => (n.textContent || '').trim();
    const topRail = document.getElementById('topRail');
    const rail = [...(topRail ? topRail.querySelectorAll('a.pick') : [])];
    const all = [...document.querySelectorAll('.gcard')];
    const card = all.find(a => (a.getAttribute('href') || '').includes(href.replace(/\//g, '')));
    /* COUNT DISTINCT GAMES, NOT DOM NODES. This page deliberately surfaces the
       same game in several places — the browse-all grid, the Sports rail, the
       RPG rail, the themed grids, Matt's picks — so 46 entries render as 66
       cards and one marker holder renders twice. The first version of this gate
       compared node counts to manifest length and reported both as defects.
       They are the page working. Identity is the href. */
    const hrefOf = a => (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '');
    const distinct = new Set(all.map(hrefOf));
    const markerGames = new Set(all.filter(a => txt(a).includes('NEW ·')).map(hrefOf));
    return {
      totalCards: all.length,
      distinctGames: distinct.size,
      markerGames: markerGames.size,
      markerHref: [...markerGames][0] || null,
      railCount: rail.length,
      railTitles: rail.map(a => txt(a.querySelector('h3, .t, strong') || a).split('\n')[0].slice(0, 42)),
      railHrefs: rail.map(hrefOf),
      railArt: rail.map(a => { const i = a.querySelector('img'); return i ? i.getAttribute('src') : (a.querySelector('.ic,.art') || {}).textContent || '?'; }),
      railHasOlympics: rail.some(a => (a.getAttribute('href') || '').includes('olympics')),
      olympicsOnShelf: !!card,
      olympicsTitle: card ? txt(card).slice(0, 60) : null,
      markerInOpenGenre: all.filter(a => txt(a).includes('NEW ·')).every(a => !!a.closest('details[open]')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, HREF);
  await ctx.close(); await browser.close();
  return { ...out, errors };
}

const manifest = JSON.parse(fs.readFileSync(path.join(GAMES, 'games.json'), 'utf8'));
/* DERIVED expectations — read from the manifest, never typed here. */
const expectTotal = manifest.games.length;
const expectNewHolder = manifest.games.find(g => String(g.title).startsWith('NEW · '));
/* The current shelf's top rail is owned by Site curation, not by the Games
   manifest's `collection` field. Reuse the estate's AST-backed curation
   extractor rather than maintaining a second parser or pinning a count here. */
const curationRecord = JSON.parse(execFileSync(process.execPath,
  [path.join(HERE, 'verify_curation_keys.mjs'), '--emit'], { encoding: 'utf8' }));
const expectRailHrefs = curationRecord.curation
  .filter(c => Number.isInteger(c.rail))
  .sort((a, b) => a.rail - b.rail)
  .map(c => c.href);
const expectRail = expectRailHrefs.length;

console.log('Global Games — arcade render\n');
console.log(`  derived records: ${expectTotal} manifest entries · ${expectRail} Site top picks · marker "${expectNewHolder ? expectNewHolder.title : 'none'}"\n`);

const srv = await serve(null);
const base = `http://127.0.0.1:${srv.address().port}`;

for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  const r = await readArcade(base, { width: vp.width, height: vp.height });
  t(`A1 [${vp.name}] every manifest entry reaches the page`,
    r.distinctGames === expectTotal,
    `${r.distinctGames} distinct games rendered across ${r.totalCards} cards, ${expectTotal} in the manifest`);
  t(`A2 [${vp.name}] the Top Picks rail renders the AST-derived curation in order`,
    JSON.stringify(r.railHrefs) === JSON.stringify(expectRailHrefs),
    `${r.railCount} rail cards; ${r.railHrefs.join(' · ')}`);
  t(`A2 [${vp.name}] Global Games is ON the rendered Top Picks rail`, r.railHasOlympics === true,
    r.railTitles.join(' · ').slice(0, 110));
  t(`A3 [${vp.name}] rail cards are visually distinct`,
    new Set(r.railTitles).size === r.railTitles.length && new Set(r.railArt).size === r.railArt.length,
    `${new Set(r.railTitles).size} distinct titles, ${new Set(r.railArt).size} distinct art of ${r.railCount}`);
  t(`A4 [${vp.name}] Global Games is on the browse-all shelf too`,
    r.olympicsOnShelf === true, r.olympicsTitle || 'not found');
  t(`A5 [${vp.name}] exactly one GAME renders the manifest's derived NEW marker`,
    r.markerGames === 1 && r.markerHref === expectNewHolder?.href,
    `${r.markerGames} marker-holding game(s), href ${r.markerHref}, expected ${expectNewHolder?.href || 'none'}`);
  t(`A5 [${vp.name}] the NEW holder's genre is open on arrival`,
    r.markerInOpenGenre === true, `marker href ${r.markerHref}`);
  t(`A6 [${vp.name}] no horizontal overflow`, r.overflow <= 0, `${r.overflow}px`);
  t(`A7 [${vp.name}] no page errors`, r.errors.length === 0, r.errors[0] || 'none');
}

/* CONTROL — the gate must be shown able to fail, or its greens are opinions.
   Remove Global Games from the manifest. The renderer's Site-owned curation
   then loses that card, and the exact same A2 href comparison must go red. */
srv.close();
const tampered = JSON.parse(JSON.stringify(manifest));
tampered.games = tampered.games.filter(g => g.href !== HREF);
const srv2 = await serve(tampered);
const base2 = `http://127.0.0.1:${srv2.address().port}`;
const c = await readArcade(base2, { width: 1280, height: 900 });
t('A2 [control] a curated game missing from the manifest IS caught by the same check',
  c.railCount === expectRail - 1 && c.railHasOlympics === false,
  `rail rendered ${c.railCount} instead of ${expectRail}, Global Games present=${c.railHasOlympics}`);
srv2.close();

console.log(red === 0 ? '\nARCADE RENDER VERIFIED' : `\n${red} FAILED`);
process.exit(red === 0 ? 0 : 1);
