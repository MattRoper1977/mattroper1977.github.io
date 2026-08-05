#!/usr/bin/env node
/*
 * verify_apexrally_surfaces.js — the two Apex Rally surfaces, measured.
 *
 * Apex Rally gets exactly ONE homepage surface: the Sports card. This harness
 * proves that card exists, that it survives with JavaScript disabled, that the
 * rail counts moved 4 -> 5 without losing a sibling, and — the part a source
 * grep cannot do — that five cards actually reflow at 360/768/1200 without
 * overflowing and without any card collapsing to an unusable size.
 *
 * The usable-rendered-size clause matters here specifically. An element can be
 * present in the DOM, pass a visibility probe, and still render as a 2x1 speck
 * that no one can tap. Every card is measured by its real bounding box and
 * checked against a usable floor, not merely against "is it visible".
 *
 * Counts are DERIVED, never pinned: the expected Sports count comes from the
 * manifest the arcade actually fetches, and the homepage is compared against
 * that same number. Adding a sixth sports game should not make this go red.
 *
 *   node tools/verify_apexrally_surfaces.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const VIEWPORTS = [
  { name: '360', width: 360, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1200', width: 1200, height: 900 }
];
/* A card smaller than this in either axis is not a usable target, whatever the
 * visibility probe says. */
const USABLE_MIN_H = 44;
const USABLE_MIN_W = 120;

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
function gate(id, name, fn) {
  return Promise.resolve().then(fn).then(d => {
    results.push({ id, status: 'PASS' }); console.log(`PASS ${id} ${name}${d ? ' — ' + d : ''}`);
  }).catch(e => {
    results.push({ id, status: 'FAIL' }); console.error(`FAIL ${id} ${name} — ${e.message}`);
  });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.mp4': 'video/mp4', '.xml': 'application/xml' };

function serve(dir) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dir, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

/* The expected Sports count is derived from the manifest the arcade fetches,
 * not typed in here. The manifest lives in the Games repo, so accept an
 * explicit path and fall back to a sibling checkout. */
function manifestSports() {
  const candidates = [
    process.env.GAMES_MANIFEST,
    path.join(ROOT, '..', 'games', 'games.json'),
    path.join(ROOT, '_games', 'games.json')
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const g = JSON.parse(fs.readFileSync(c, 'utf8')).games;
      return { path: c, titles: g.filter(x => x.collection === 'Sports').map(x => x.title) };
    }
  }
  return null;
}

(async () => {
  const server = await serve(ROOT);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const launchOpts = process.env.AR_CHROMIUM ? { executablePath: process.env.AR_CHROMIUM } : {};
  const browser = await chromium.launch(launchOpts);
  const manifest = manifestSports();

  try {
    /* ---- C1: the homepage card exists with JAVASCRIPT DISABLED ----------- */
    await gate('C1', 'homepage Sports cards render with JS disabled', async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      await page.goto(origin + '/index.html', { waitUntil: 'load' });
      const cards = await page.locator('.dx-sports-grid a.dx-sport').all();
      const names = [];
      for (const c of cards) names.push((await c.getAttribute('data-sport-game')) || '');
      assert(names.includes('Apex Rally'), 'the Apex Rally card is absent without JS');
      const rally = page.locator('a.dx-sport[data-sport-game="Apex Rally"]');
      assert(await rally.getAttribute('href') === '/apexrally/', 'Rally card href is wrong');
      /* prove JS really was off, so "it rendered" means "the markup carries it"
       * rather than "a script quietly filled it in" */
      const scriptRan = await page.evaluate(() => typeof window.MBM_STAMP !== 'undefined')
        .catch(() => false);
      assert(scriptRan === false, 'scripts executed; this run does not prove the no-JS baseline');
      /* and the card must be a real link, not a button waiting on a handler */
      assert(await rally.evaluate(e => e.tagName) === 'A', 'the Rally card is not an anchor');
      await ctx.close();
      return `JS off: ${names.length} cards rendered from markup — ${names.join(', ')}`;
    });

    /* ---- C2: 4 -> 5, no sibling lost, counts derived from the manifest --- */
    await gate('C2', 'Sports surfaces moved 4 → 5 with no sibling displaced', async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      await page.goto(origin + '/index.html', { waitUntil: 'load' });
      const names = await page.$$eval('.dx-sports-grid a.dx-sport',
        els => els.map(e => e.getAttribute('data-sport-game')));
      const SIBLINGS = ['Apex Kick', 'Apex Pool', 'Apex Golf', 'Apex Tennis'];
      SIBLINGS.forEach(s => assert(names.includes(s), `${s} was displaced from the homepage`));
      assert(names.includes('Apex Rally'), 'Apex Rally is not on the homepage');
      assert(new Set(names).size === names.length, 'a card appears twice: ' + names.join(', '));
      let derived = 'no manifest available to derive from';
      if (manifest) {
        assert(names.length === manifest.titles.length,
          `homepage shows ${names.length} cards, the manifest's Sports collection has ${manifest.titles.length}`);
        manifest.titles.forEach(t => assert(names.includes(t), `${t} is in the manifest rail but not on the homepage`));
        derived = `matches the manifest rail (${manifest.titles.length}) from ${path.relative(ROOT, manifest.path)}`;
      }
      /* the lede must not still say "Four" */
      const lede = await page.textContent('.dx-sports-lede');
      assert(!/\bfour\b/i.test(lede), `the lede still reads "${lede.trim()}"`);
      await ctx.close();
      return `${names.length} cards, 0 duplicates, 4 siblings intact; ${derived}`;
    });

    /* ---- C3: reflow at 360/768/1200, usable rendered size --------------- */
    await gate('C3', 'five cards reflow at 360/768/1200 with usable size', async () => {
      const report = [];
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
        const page = await ctx.newPage();
        await page.goto(origin + '/index.html', { waitUntil: 'load' });
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(overflow <= 0, `${vp.name}: page overflows horizontally by ${overflow}px`);
        const boxes = await page.$$eval('.dx-sports-grid a.dx-sport', els => els.map(e => {
          const r = e.getBoundingClientRect();
          return { name: e.getAttribute('data-sport-game'), w: Math.round(r.width), h: Math.round(r.height),
                   right: Math.round(r.right) };
        }));
        assert(boxes.length > 0, `${vp.name}: no cards rendered at all`);
        boxes.forEach(b => {
          assert(b.h >= USABLE_MIN_H && b.w >= USABLE_MIN_W,
            `${vp.name}: "${b.name}" renders ${b.w}x${b.h}, below the usable floor ${USABLE_MIN_W}x${USABLE_MIN_H}`);
          assert(b.right <= vp.width + 1,
            `${vp.name}: "${b.name}" extends to ${b.right}px, past the ${vp.width}px viewport`);
        });
        const min = boxes.reduce((a, b) => Math.min(a, b.h), Infinity);
        report.push(`${vp.name}px ${boxes.length} cards, smallest ${min}px tall, no overflow`);
        await ctx.close();
      }
      return report.join('; ');
    });

    /* ---- C4: the arcade rail is manifest-driven and reaches 5 ----------- */
    await gate('C4', 'arcade Sports rail renders 5 from the manifest', async () => {
      if (!manifest) throw new Error('no games.json available — set GAMES_MANIFEST to the Games checkout');
      const ctx = await browser.newContext({ viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      /* the arcade fetches /Games/games.json; serve the manifest under test there */
      await page.route('**/Games/games.json', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(manifest.path) }));
      await page.goto(origin + '/games/index.html', { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const hidden = await page.getAttribute('#sports', 'hidden');
      assert(hidden === null, 'the Sports section stayed hidden');
      /* one title per CARD — h4 also carries a "Matt's pick" badge span, so
       * selecting every span in the heading counts curated cards twice */
      const titles = await page.$$eval('#sportsRail .gcard',
        els => els.map(e => e.querySelector('h4 > span').textContent));
      assert(titles.length === manifest.titles.length,
        `rail rendered ${titles.length} cards, manifest has ${manifest.titles.length}`);
      assert(titles.includes('Apex Rally'), 'Apex Rally is not on the arcade rail');
      /* the section copy must not still say "Four" */
      const sub = await page.textContent('#sports .sub');
      assert(!/\bfour\b/i.test(sub), `the rail copy still reads "${sub.trim().slice(0, 60)}…"`);
      /* and no card may render as a speck */
      const boxes = await page.$$eval('#sportsRail .gcard', els => els.map(e => {
        const r = e.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }));
      boxes.forEach((b, i) => assert(b.w >= USABLE_MIN_W && b.h >= USABLE_MIN_H,
        `rail card ${i} renders ${b.w}x${b.h}, below the usable floor`));
      /* Card art must actually load. A manifest pointing at an asset that is not
       * in the tree renders a broken-image glyph, which no count-based check
       * sees. This is why the game PR merges before the surfaces PR: the art
       * ships with the game. */
      const art = await page.$$eval('#sportsRail .gcard img.ga', els => els.map(e => ({
        src: e.getAttribute('src'), loaded: e.complete && e.naturalWidth > 0
      })));
      const brokenArt = art.filter(a => !a.loaded).map(a => a.src);
      assert(brokenArt.length === 0, 'rail card art failed to load: ' + brokenArt.join(', '));
      await ctx.close();
      return `rail 4 → ${titles.length}: ${titles.join(', ')}; ${art.length}/${art.length} card art loaded`;
    });

    /* ---- C5: exactly one homepage surface, no New Release takeover ------ */
    await gate('C5', 'one homepage surface, New Release untouched, no doors entry', async () => {
      const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const occurrences = (home.match(/\/apexrally\//g) || []).length;
      assert(occurrences === 1, `Apex Rally appears ${occurrences} times on the homepage; it gets exactly one surface`);
      /* New Release boxes are held by ruling and must not have moved */
      const releases = [...home.matchAll(/data-release="([^"]+)"/g)].map(m => m[1]);
      assert(!releases.includes('Apex Rally'), 'Apex Rally took a New Release box without a ruling');
      assert(releases.length >= 2, `expected the New Release boxes to still be occupied, found ${releases.length}`);
      /* no doors[] entry */
      const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
      const doorHit = (site.doors || []).filter(d => JSON.stringify(d).includes('apexrally'));
      assert(doorHit.length === 0, `Apex Rally has ${doorHit.length} doors[] entry/entries; it gets one surface only`);
      return `1 homepage reference; New Release still ${releases.join(' + ')}; 0 doors[] entries of ${(site.doors || []).length}`;
    });

  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nApex Rally surfaces: ${results.length - failed.length}/${results.length} gates passed.`);
  if (failed.length) { console.error('FAILED: ' + failed.map(f => f.id).join(', ')); process.exitCode = 1; }
  else console.log(`ALL ${results.length} APEX RALLY SURFACE GATES PASSED`);
})();
