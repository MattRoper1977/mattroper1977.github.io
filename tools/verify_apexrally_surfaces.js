#!/usr/bin/env node
/*
 * verify_apexrally_surfaces.js — the two Apex Rally surfaces, measured.
 *
 * Apex Rally gets exactly ONE homepage surface: the Sports card. This harness
 * proves that card exists, that it survives with JavaScript disabled, that no
 * established Apex sibling is displaced, and — the part a source grep cannot
 * do — that the cards actually reflow at 360/768/1200 without overflowing or
 * collapsing to an unusable size.
 *
 * The homepage Sports strip is a curated Apex surface. The Games manifest's
 * `collection: Sports` rail is broader and may contain non-Apex sports games.
 * Therefore the homepage must be a valid subset of the manifest Sports rail;
 * it must not be forced to equal the whole collection.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const HOME_PATH = fs.existsSync(path.join(ROOT, 'main', 'index.html'))
  ? path.join(ROOT, 'main', 'index.html')
  : path.join(ROOT, 'index.html');
const HOME_ROUTE = HOME_PATH.endsWith(path.join('main', 'index.html')) ? '/main/' : '/';
const VIEWPORTS = [
  { name: '360', width: 360, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1200', width: 1200, height: 900 }
];
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
    await gate('C1', 'homepage Sports cards render with JS disabled', async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      await page.goto(origin + HOME_ROUTE, { waitUntil: 'load' });
      const cards = await page.locator('.dx-sports-grid a.dx-sport').all();
      const names = [];
      for (const c of cards) names.push((await c.getAttribute('data-sport-game')) || '');
      assert(names.includes('Apex Rally'), 'the Apex Rally card is absent without JS');
      const rally = page.locator('a.dx-sport[data-sport-game="Apex Rally"]');
      assert(await rally.getAttribute('href') === '/apexrally/', 'Rally card href is wrong');
      const scriptRan = await page.evaluate(() => typeof window.MBM_STAMP !== 'undefined').catch(() => false);
      assert(scriptRan === false, 'scripts executed; this run does not prove the no-JS baseline');
      assert(await rally.evaluate(e => e.tagName) === 'A', 'the Rally card is not an anchor');
      await ctx.close();
      return `JS off: ${names.length} cards rendered from markup — ${names.join(', ')}`;
    });

    /* Homepage curation and the full manifest collection are different
     * populations. Protect the established Apex strip, require Rally once, and
     * prove every homepage Sports title is actually classified Sports in the
     * manifest when the manifest is available. New non-homepage Sports games
     * may be added to the catalogue without making this gate stale. */
    await gate('C2', 'homepage Apex Sports curation remains valid without sibling displacement', async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      await page.goto(origin + HOME_ROUTE, { waitUntil: 'load' });
      const names = await page.$$eval('.dx-sports-grid a.dx-sport', els => els.map(e => e.getAttribute('data-sport-game')));
      const SIBLINGS = ['Apex Kick', 'Apex Pool', 'Apex Golf', 'Apex Tennis'];
      SIBLINGS.forEach(s => assert(names.includes(s), `${s} was displaced from the homepage`));
      assert(names.filter(n => n === 'Apex Rally').length === 1, 'Apex Rally must appear exactly once on the homepage Sports strip');
      assert(new Set(names).size === names.length, 'a card appears twice: ' + names.join(', '));
      let derived = 'no manifest available';
      if (manifest) {
        const outside = names.filter(t => !manifest.titles.includes(t));
        assert(outside.length === 0, `homepage Sports card(s) are not in the manifest Sports collection: ${outside.join(', ')}`);
        derived = `${names.length}/${names.length} homepage cards are members of the broader ${manifest.titles.length}-game manifest Sports collection`;
      }
      const lede = await page.textContent('.dx-sports-lede');
      assert(!/\bfour\b/i.test(lede), `the lede still reads "${lede.trim()}"`);
      await ctx.close();
      return `${names.length} cards, 0 duplicates, 4 established siblings intact; ${derived}`;
    });

    await gate('C3', 'homepage Sports cards reflow at 360/768/1200 with usable size', async () => {
      const report = [];
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
        const page = await ctx.newPage();
        await page.goto(origin + HOME_ROUTE, { waitUntil: 'load' });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(overflow <= 0, `${vp.name}: page overflows horizontally by ${overflow}px`);
        const boxes = await page.$$eval('.dx-sports-grid a.dx-sport', els => els.map(e => {
          const r = e.getBoundingClientRect();
          return { name: e.getAttribute('data-sport-game'), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
        }));
        assert(boxes.length > 0, `${vp.name}: no cards rendered at all`);
        boxes.forEach(b => {
          assert(b.h >= USABLE_MIN_H && b.w >= USABLE_MIN_W, `${vp.name}: "${b.name}" renders ${b.w}x${b.h}, below the usable floor ${USABLE_MIN_W}x${USABLE_MIN_H}`);
          assert(b.right <= vp.width + 1, `${vp.name}: "${b.name}" extends to ${b.right}px, past the ${vp.width}px viewport`);
        });
        const min = boxes.reduce((a, b) => Math.min(a, b.h), Infinity);
        report.push(`${vp.name}px ${boxes.length} cards, smallest ${min}px tall, no overflow`);
        await ctx.close();
      }
      return report.join('; ');
    });

    await gate('C4', 'the arcade Sports genre renders the full manifest collection', async () => {
      if (!manifest) throw new Error('no games.json available — set GAMES_MANIFEST to the Games checkout');
      /* Sports was a standalone rail drawn on top of the whole shelf. It is a
         GENRE SECTION now — the rail was one of five that each drew their own
         copy of a game, 82 cards for 52 games. What this gate protects is
         unchanged: every Sports-collection game in the manifest is reachable
         on the arcade, at a usable size, with its art loaded. Only the
         container moved, and the accordion has to be opened to see it. */
      const ctx = await browser.newContext({ viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      await page.route('**/Games/games.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(manifest.path) }));
      await page.goto(origin + '/games/index.html', { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const opened = await page.evaluate(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        if (!d) return false;
        d.open = true;
        /* lazy images load on entering the viewport, and this section sits far
           down a long page — opening it is not enough, it has to be scrolled
           to, exactly as a visitor reaching it would. */
        d.scrollIntoView({ block: 'center' });
        return true;
      });
      assert(opened, 'there is no Sports genre section on the arcade');
      /* Cards inside a shut accordion carry loading="lazy", so their art has
         not been fetched at load — correctly, that is the point of the
         accordion. Wait for the decode rather than for a fixed delay, or this
         gate reports broken art that is merely late. */
      await page.waitForFunction(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        if (!d) return false;
        const imgs = [...d.querySelectorAll('.gcard img.ga')];
        return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
      }, { timeout: 20000 });
      const SEL = '#genreSections details.gsec';
      const titles = await page.evaluate(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        return [...d.querySelectorAll('.gcard')].map(e => e.querySelector('h4 > span').textContent);
      });
      /* SUPERSET, not equality. `collection` is a THIRD taxonomy field on the
         manifest, alongside `tag`, and like `tag` it does not agree with the
         genre record: the ruled Sports genre also holds Neon Turf: Overdrive,
         which is rocket-cars-and-a-ball on the verb but is not marked
         collection:"Sports". The genre record is authoritative, so this gate
         asserts what it always meant — every manifest Sports game is reachable
         on the arcade — and reports the difference rather than hiding it. */
      const missing = manifest.titles.filter(t => !titles.includes(t));
      assert(missing.length === 0,
        `Sports genre is missing manifest collection member(s): ${missing.join(', ')}`);
      const beyond = titles.filter(t => !manifest.titles.includes(t));
      assert(titles.includes('Apex Rally'), 'Apex Rally is not in the Sports genre');
      const heading = await page.evaluate(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        return d.querySelector('.gnum').textContent.trim();
      });
      assert(heading === `${titles.length} games`,
        `the heading reads "${heading}" for ${titles.length} cards — it must be counted, not written down`);
      const boxes = await page.evaluate(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        return [...d.querySelectorAll('.gcard')].map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      });
      boxes.forEach((b, i) => assert(b.w >= USABLE_MIN_W && b.h >= USABLE_MIN_H, `Sports card ${i} renders ${b.w}x${b.h}, below the usable floor`));
      const art = await page.evaluate(() => {
        const d = [...document.querySelectorAll('#genreSections details.gsec')]
          .find(x => x.querySelector('.gname').textContent.trim() === 'Sports');
        return [...d.querySelectorAll('.gcard img.ga')].map(e => ({ src: e.getAttribute('src'), loaded: e.complete && e.naturalWidth > 0 }));
      });
      const brokenArt = art.filter(a => !a.loaded).map(a => a.src);
      assert(brokenArt.length === 0, 'Sports card art failed to load: ' + brokenArt.join(', '));
      await ctx.close();
      return `Sports genre contains ${titles.length} (all ${manifest.titles.length} of the manifest collection, plus ${beyond.length} by genre: ${beyond.join(', ') || 'none'}); heading "${heading}"; ${art.length}/${art.length} card art loaded`;
    });

    await gate('C5', 'one homepage surface, New Release untouched, no doors entry', async () => {
      const home = fs.readFileSync(HOME_PATH, 'utf8');
      const occurrences = (home.match(/\/apexrally\//g) || []).length;
      assert(occurrences === 1, `Apex Rally appears ${occurrences} times on the homepage; it gets exactly one surface`);
      const releases = [...home.matchAll(/data-release="([^"]+)"/g)].map(m => m[1]);
      assert(!releases.includes('Apex Rally'), 'Apex Rally took a New Release box without a ruling');
      assert(releases.length >= 2, `expected the New Release boxes to still be occupied, found ${releases.length}`);
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
