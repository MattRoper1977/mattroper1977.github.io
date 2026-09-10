#!/usr/bin/env node
/*
 * The slide-change announcer.
 *
 * A deck changes slide by toggling a class, which is not an event a screen
 * reader is told about. hud.js watches the deck and writes the new slide's
 * heading into a polite live region, so a reader who cannot see the screen is
 * told what a sighted reader can see.
 *
 * What this asserts, and why each one is worth a line:
 *   1. exactly ONE polite announcement per slide change, carrying the heading
 *      - "a live region exists" is not the same as "it announced once"
 *   2. the announcement carries the HEADING, not the slide's body text
 *   3. ZERO announcements from the running countdown
 *      - a live timer speaks every second; the region must stay aria-live=off
 *   4. the live region is visually hidden but NOT display:none
 *      - a display:none region is absent from the accessibility tree entirely,
 *        so it would pass a "does the element exist" check and announce nothing
 *   5. nothing announces on first load - arriving is not a transition
 *
 *   LESSONS=/path/to/Lessons node tools/verify_hud_announcer.mjs
 *   node tools/verify_hud_announcer.mjs --self-test
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) { /* keep looking */ }
  }
  console.error('playwright not found. Install it with:  npm i -g playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LESSONS = process.env.LESSONS
  || [path.join(SITE, '..', 'Lessons'), '/home/user/Lessons'].find((p) => fs.existsSync(p));
const SELFTEST = process.argv.includes('--self-test');
if (!LESSONS) { console.error('Lessons checkout not found. Set LESSONS=/path/to/Lessons'); process.exit(2); }

const CASES = [
  '/Lessons/primary/year5/science/autumn/forces/Lesson1_Friction.html',
  '/Lessons/Science_Teesside/Grow/SCI_G_W4_Mechanisms.html',
];

const failures = [];
const rows = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); return !!cond; };

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg', '.gif':'image/gif' };
function serve(sabotage) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const isHud = rel === '/hud.js';
      const file = isHud ? path.join(SITE, 'hud.js')
                         : path.join(LESSONS, rel.replace(/^\/Lessons\//, '/'));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      if (isHud && sabotage) {   // drop the announcer, keep the rest of the HUD
        res.end(fs.readFileSync(file, 'utf8').replace('if (IS_LESSON && window.MutationObserver) {',
                                                      'if (false) {'));
        return;
      }
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Record every write into any polite live region, the way an assistive
   technology would be handed them - not by reading the DOM once at the end. */
const RECORDER = () => {
  window.__spoken = [];
  const watch = (node) => new MutationObserver(() => {
    const t = (node.textContent || '').trim();
    if (t) window.__spoken.push({ id: node.id || node.className || 'anonymous', text: t });
  }).observe(node, { childList: true, characterData: true, subtree: true });
  document.querySelectorAll('[aria-live="polite"],[aria-live="assertive"]').forEach(watch);
  window.__watchLive = watch;
};

async function run(sabotage) {
  const server = await serve(sabotage);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const rel of CASES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(base + rel, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);

      const region = await page.evaluate(() => {
        const r = document.getElementById('mbmhud-say');
        if (!r) return null;
        const cs = getComputedStyle(r);
        return { live: r.getAttribute('aria-live'), atomic: r.getAttribute('aria-atomic'),
                 display: cs.display, visibility: cs.visibility,
                 w: Math.round(r.getBoundingClientRect().width) };
      });
      if (!assert(region, `${rel}: no live region was mounted`)) { await page.close(); continue; }
      assert(region.live === 'polite', `${rel}: live region is aria-live="${region.live}", expected polite`);
      // 4. present in the accessibility tree, not display:none
      assert(region.display !== 'none',
        `${rel}: the live region is display:none, so it is absent from the accessibility tree`);
      assert(region.visibility !== 'hidden',
        `${rel}: the live region is visibility:hidden, so it announces nothing`);
      assert(region.w <= 2, `${rel}: the live region is ${region.w}px wide - it is not visually hidden`);

      // 5. arriving is not a transition
      await page.evaluate(RECORDER);
      await page.waitForTimeout(500);
      const onLoad = await page.evaluate(() => window.__spoken.length);
      assert(onLoad === 0, `${rel}: ${onLoad} announcement(s) fired on first load without a slide change`);

      // 1 + 2. one announcement per change, carrying the heading
      const expected = await page.evaluate(() => {
        const all = document.querySelectorAll('.slide');
        let cur = -1;
        for (let i = 0; i < all.length; i++) {
          if (all[i].classList.contains('active') || all[i].classList.contains('show')
              || getComputedStyle(all[i]).display !== 'none') { cur = i; break; }
        }
        const next = all[cur + 1];
        const h = next && next.querySelector('h1,h2,h3,[data-title]');
        const text = h ? (h.getAttribute('data-title') || h.textContent || '') : '';
        return { heading: text.replace(/\s+/g, ' ').trim().slice(0, 140),
                 body: (next ? next.textContent : '').replace(/\s+/g, ' ').trim() };
      });

      await page.evaluate(() => { window.__spoken.length = 0; });
      await page.evaluate(() => {
        const s = document.querySelector('.slide');
        if (s) { s.setAttribute('tabindex', '-1'); s.focus(); }
      });
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(900);
      const spoken = await page.evaluate(() => window.__spoken.slice());
      const mine = spoken.filter((s) => s.id === 'mbmhud-say');

      assert(mine.length === 1,
        `${rel}: ${mine.length} announcement(s) for one slide change, expected exactly 1 ` +
        `(${JSON.stringify(mine.map((m) => m.text).slice(0, 3))})`);
      if (mine.length) {
        assert(expected.heading === '' || mine[0].text.includes(expected.heading),
          `${rel}: announced ${JSON.stringify(mine[0].text)}, which does not carry the heading ` +
          `${JSON.stringify(expected.heading)}`);
        // the body is far longer than the heading; the announcement must not be it
        assert(mine[0].text.length < Math.max(200, expected.heading.length + 60),
          `${rel}: the announcement is ${mine[0].text.length} characters - it is reading the slide body`);
      }

      // 3. zero announcements from the running countdown
      await page.evaluate(() => { window.__spoken.length = 0; });
      const timerLive = await page.evaluate(() => {
        const t = document.getElementById('mbmhud-timerbox');
        return t ? t.getAttribute('aria-live') : null;
      });
      assert(timerLive === 'off',
        `${rel}: the countdown is aria-live="${timerLive}" - it must stay "off"`);
      await page.evaluate(() => {
        document.getElementById('mbmhud-pill').click();
        const b = document.querySelector('#mbmhud-dock [data-min="5"]');
        if (b) b.click();
        if (window.__watchLive) {
          document.querySelectorAll('[aria-live]').forEach((n) => {
            if (n.getAttribute('aria-live') !== 'off') window.__watchLive(n);
          });
        }
      });
      await page.waitForTimeout(3200);          // three ticks of the countdown
      const duringTimer = await page.evaluate(() =>
        window.__spoken.filter((s) => /time|timer/i.test(s.id)).length);
      assert(duringTimer === 0,
        `${rel}: the running countdown produced ${duringTimer} announcement(s)`);

      rows.push({ rel, announced: mine.length ? mine[0].text : '(none)', onLoad, duringTimer });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
}

if (SELFTEST) {
  const mark = failures.length;
  await run(true);
  const caught = failures.length - mark;
  failures.length = mark; rows.length = 0;
  if (caught === 0) {
    console.error('[FAIL] self-test: the gate passed a hud.js with the announcer removed');
    process.exit(1);
  }
  console.log(`[PASS] self-test: ${caught} finding(s) raised with the announcer removed`);
}

await run(false);
for (const r of rows) {
  console.log(`  announced ${JSON.stringify(r.announced)}`);
  console.log(`     on first load: ${r.onLoad}   during a running countdown: ${r.duringTimer}   ${r.rel}`);
}
if (failures.length) {
  console.error(`\n[FAIL] slide announcer — ${failures.length} finding(s):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n[PASS] slide announcer: one polite announcement per slide change carrying the heading, ' +
            'none on load, none from the countdown');
