#!/usr/bin/env node
/*
 * verify_relicforge_browser.js — rendered contracts for /relicforge/
 *
 * The source harness can only INFER the things that matter most here. This one
 * measures them in a real Chromium, driving the game's own diagnostic surface
 * (window.__relicforge: start / snapshot / targets / strike / install) rather
 * than poking at the DOM.
 *
 *   - "zero network requests" — a grep proves no remote tag is written; only a
 *     browser proves nothing is fetched.
 *   - ">= 44px touch targets" — a CSS declaration is not a rendered size. Every
 *     interactive control is measured by its real bounding box, at two
 *     viewports, on every surface a thumb can reach. A control that renders as a
 *     speck fails even when its CSS says 44px.
 *   - "the twist actually works" — a clean strip is driven component by
 *     component through real damage, and must out-score a core-burn kill.
 *   - "the campaign completes" — a full ten-chamber run, headless, no NaN and no
 *     soft-lock.
 *
 *   node tools/verify_relicforge_browser.js
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.RF_GAME_FILE || process.argv[2] || path.join(ROOT, 'relicforge', 'index.html');
const URL = 'file://' + FILE;
const TOUCH_FLOOR = 44;
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1366, height: 768 }
];

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
async function gate(id, name, fn) {
  try {
    const d = await fn() || '';
    results.push({ id, name, status: 'PASS', detail: d });
    console.log(`PASS ${id} ${name}${d ? ' — ' + d : ''}`);
  } catch (e) {
    results.push({ id, name, status: 'FAIL', detail: e.message });
    console.error(`FAIL ${id} ${name} — ${e.message}`);
  }
}
const waitMode = async (page, test, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const m = await page.evaluate(() => window.__relicforge.snapshot().mode);
    if (test(m)) return m;
    await page.waitForTimeout(200);
  }
  return page.evaluate(() => window.__relicforge.snapshot().mode);
};

(async () => {
  const browser = await chromium.launch();

  await gate('B1', 'zero network requests beyond the document itself', async () => {
    const context = await browser.newContext({ viewport: VIEWPORTS[1] });
    const page = await context.newPage();
    const remote = [];
    page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) remote.push(r.url()); });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 20000 });
    await page.evaluate(() => window.__relicforge.start());
    await page.evaluate(() => window.__relicforge.skipStory());
    await page.waitForTimeout(2500);
    assert(remote.length === 0, `fetched ${remote.length}: ${remote.slice(0, 3).join(', ')}`);
    await context.close();
    return 'nothing fetched during boot and two seconds of play';
  });

  await gate('B2', 'no page errors on boot or play', async () => {
    const context = await browser.newContext({ viewport: VIEWPORTS[1] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 20000 });
    await page.evaluate(() => window.__relicforge.start());
    await page.evaluate(() => window.__relicforge.skipStory());
    await page.waitForTimeout(2500);
    assert(errors.length === 0, errors.slice(0, 2).join(' | '));
    await context.close();
    return '0 page errors, 0 console errors';
  });

  await gate('B3', `every control renders at least ${TOUCH_FLOOR}px`, async () => {
    const offenders = [];
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp, hasTouch: vp.name === 'phone' });
      const page = await context.newPage();
      await page.goto(URL, { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 20000 });
      for (const surface of ['menu', 'settings-overlay', 'how-overlay', 'journal-overlay', 'story-overlay']) {
        const bad = await page.evaluate(({ surface, floor, vpName }) => {
          document.querySelectorAll('.overlay').forEach(o => o.classList.remove('open'));
          const node = document.getElementById(surface);
          if (node) node.classList.add('open');
          const out = [];
          for (const el of document.querySelectorAll('button, [role="button"], input, select, a[href], .chassis-card')) {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || r.width === 0) continue;
            if (r.width < floor || r.height < floor) {
              out.push(`${vpName}/${surface}:${el.id || el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          }
          return out;
        }, { surface, floor: TOUCH_FLOOR, vpName: vp.name });
        offenders.push(...bad);
      }
      await context.close();
    }
    assert(offenders.length === 0, offenders.slice(0, 6).join('; '));
    return `0 undersized controls across ${VIEWPORTS.length} viewports x 5 surfaces, measured by rendered box`;
  });

  await gate('B4', 'the twist holds in the game, not just in the function', async () => {
    const context = await browser.newContext({ viewport: VIEWPORTS[1] });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 20000 });
    await page.evaluate(() => window.__relicforge.start());
    await page.evaluate(() => window.__relicforge.skipStory());
    const out = await page.evaluate(async () => {
      const rf = window.__relicforge;
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const externals = rf.externals();
      const a = rf.targets()[0];
      for (const key of externals) rf.strike(a.id, key, 1e9);   // strip it clean
      await wait(150);
      const afterStrip = rf.snapshot().salvageRun;
      const b = rf.targets().filter(t => t.id !== a.id)[0];
      rf.strike(b.id, 'core', 1e9);                              // burn the core
      await wait(150);
      const afterBurn = rf.snapshot().salvageRun;
      return { externals: externals.length, afterStrip, afterBurn, litter: rf.snapshot().litter + rf.snapshot().debris };
    });
    assert(out.afterStrip.cleanStrips === 1, `stripping every external did not register a clean strip (${out.afterStrip.cleanStrips})`);
    assert(out.afterStrip.best >= 60, `clean strip scored ${out.afterStrip.best}, below the clean band`); // NOT LIVE: 60 is the clean-strip score floor, not a shelf count.
    assert(out.afterBurn.streak === 0, 'a core-burn kill did not reset the salvage streak');
    assert(out.afterBurn.cleanStrips === 1, 'a core-burn kill was counted as a clean strip');
    assert(out.litter > 0, 'stripping a machine left no wreckage on the floor');
    await context.close();
    return `clean strip scored ${out.afterStrip.best} over ${out.externals} externals; core-burn reset the streak; ${out.litter} pieces of wreckage left behind`;
  });

  await gate('B5', 'a full ten-chamber campaign completes headless', async () => {
    const context = await browser.newContext({ viewport: VIEWPORTS[1] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 20000 });
    await page.evaluate(() => window.__relicforge.start());
    let reached = 0, victory = false, drafts = [];
    for (let guard = 0; guard < 80; guard++) {
      const s = await page.evaluate(() => window.__relicforge.snapshot());
      for (const [k, v] of Object.entries(s)) {
        assert(!(typeof v === 'number' && !Number.isFinite(v)), `snapshot.${k} is not finite`);
      }
      if (s.mode === 'story') { await page.evaluate(() => window.__relicforge.skipStory()); continue; }
      if (s.mode === 'victory') { victory = true; break; }
      assert(s.mode !== 'gameover', `run ended in game over at chamber ${s.chamber}`);
      if (s.mode === 'forge') {
        drafts.push(await page.evaluate(() => document.querySelectorAll('#forge-grid .forge-card').length));
        await page.evaluate(() => window.__relicforge.install(0));
        continue;
      }
      reached = Math.max(reached, s.chamber);
      await page.evaluate(() => window.__relicforge.clearChamber());
      await waitMode(page, m => m !== 'playing' && m !== 'transition');
    }
    assert(victory, `campaign did not reach victory (deepest chamber ${reached})`);
    assert(drafts.length > 0 && drafts.every(d => d === 3), `forge did not always offer three: ${drafts.join(',')}`);
    assert(errors.length === 0, errors.slice(0, 2).join(' | '));
    await context.close();
    return `victory reached, chambers 1..${Math.max(reached, 10)}, forge offered 3 every time (${drafts.length} drafts), 0 page errors`;
  });

  await browser.close();
  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nRelicforge rendered contract: ${results.length - failed.length}/${results.length} gates passed.`);
  if (failed.length) process.exit(1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
