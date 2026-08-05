#!/usr/bin/env node
/*
 * verify_apexrally_browser.js — rendered contracts for /apexrally/
 *
 * The source harness (verify_apexrally.js) can only INFER two of the things
 * that matter most. This one measures them in a real Chromium:
 *
 *   - "zero network requests" — a source grep proves no remote tag is written.
 *     Only a browser proves nothing is actually fetched. Every request the page
 *     makes beyond its own document is recorded and failed on.
 *
 *   - "min-height >= 44px" — a CSS declaration is not a rendered size. An
 *     element can carry min-height:44px and still lay out as a 2x1 speck, or be
 *     clipped to nothing by an ancestor. Every interactive control is measured
 *     by its real bounding box at three viewports, and a control that renders
 *     smaller than a usable target fails even if its CSS says otherwise.
 *
 *   - storage census — measured by reading document localStorage after the game
 *     has actually persisted, not by grepping for key literals.
 *
 *   node tools/verify_apexrally_browser.js
 */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const GAME_DIR = path.join(ROOT, 'apexrally');
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 640 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1200, height: 800 }
];
const TOUCH_FLOOR = 44;

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
function gate(id, name, detail) { results.push({ id, name, status: 'PASS', detail }); console.log(`PASS ${id} ${name}${detail ? ' — ' + detail : ''}`); }
function fail(id, name, msg) { results.push({ id, name, status: 'FAIL', detail: msg }); console.error(`FAIL ${id} ${name} — ${msg}`); }

function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dir, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const server = await serve(GAME_DIR);
  const origin = `http://127.0.0.1:${server.address().port}`;
  /* CI installs a matching browser and needs no override. A pre-provisioned
   * container may ship a different build number than the pinned playwright
   * package expects, so allow an explicit binary rather than downloading. */
  const launchOpts = process.env.AR_CHROMIUM ? { executablePath: process.env.AR_CHROMIUM } : {};
  const browser = await chromium.launch(launchOpts);

  try {
    /* ---- B1: zero network requests beyond the document itself ------------ */
    try {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[2] });
      const page = await ctx.newPage();
      const extra = [];
      page.on('request', r => { if (r.url() !== origin + '/' && r.url() !== origin + '/index.html') extra.push(r.url()); });
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2200);
      assert(extra.length === 0, 'page issued ' + extra.length + ' extra request(s): ' + extra.slice(0, 4).join(', '));
      gate('B1', 'zero network requests (measured, not inferred)', `1 document request, 0 subresource requests over ${2.2}s`);
      await ctx.close();
    } catch (e) { fail('B1', 'zero network requests (measured, not inferred)', e.message); }

    /* ---- B2: renders at three viewports, no console/page errors --------- */
    const rendered = [];
    try {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === 'phone' });
        const page = await ctx.newPage();
        const errs = [];
        page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
        page.on('pageerror', e => errs.push('pageerror: ' + e.message));
        await page.goto(origin + '/', { waitUntil: 'load' });
        await page.waitForTimeout(1600);
        const title = await page.title();
        assert(title === 'Apex Rally — Read the Court', `${vp.name}: title is "${title}"`);
        const canvas = await page.locator('#court').boundingBox();
        assert(canvas && canvas.width > 200 && canvas.height > 200,
          `${vp.name}: court canvas rendered ${canvas ? canvas.width + 'x' + canvas.height : 'not at all'}`);
        assert(errs.length === 0, `${vp.name}: ${errs.length} console/page error(s): ${errs.slice(0, 2).join(' | ')}`);
        /* no horizontal overflow of the document */
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(overflow <= 0, `${vp.name}: document overflows horizontally by ${overflow}px`);
        rendered.push(`${vp.name} ${Math.round(canvas.width)}x${Math.round(canvas.height)}`);
        await ctx.close();
      }
      gate('B2', 'renders clean at 360/768/1200', rendered.join('; ') + '; 0 console errors; no horizontal overflow');
    } catch (e) { fail('B2', 'renders clean at 360/768/1200', e.message); }

    /* ---- B3: MEASURED touch targets, not declared ones ------------------- */
    try {
      const report = [];
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === 'phone' });
        const page = await ctx.newPage();
        await page.goto(origin + '/', { waitUntil: 'load' });
        await page.waitForTimeout(1600);
        /* enter a match so the in-game controls are laid out for real */
        await page.locator('#practice').click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const measured = await page.evaluate((floor) => {
          const out = [];
          document.querySelectorAll('button, [role="button"], a[href]').forEach(el => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.01 &&
                            r.width > 0 && r.height > 0;
            if (!visible) return;
            out.push({
              id: el.id || el.className || el.tagName,
              w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
              ok: r.width >= floor - 0.5 && r.height >= floor - 0.5
            });
          });
          return out;
        }, TOUCH_FLOOR);
        assert(measured.length > 0, `${vp.name}: no visible interactive controls were rendered at all`);
        const bad = measured.filter(m => !m.ok);
        assert(bad.length === 0,
          `${vp.name}: ${bad.length} control(s) render below ${TOUCH_FLOOR}px: ` +
          bad.slice(0, 4).map(b => `${b.id} ${b.w}x${b.h}`).join(', '));
        const min = measured.reduce((a, m) => Math.min(a, m.w, m.h), Infinity);
        report.push(`${vp.name} ${measured.length} controls, smallest ${min}px`);
        await ctx.close();
      }
      gate('B3', `measured touch targets ≥${TOUCH_FLOOR}px (usable rendered size)`, report.join('; '));
    } catch (e) { fail('B3', `measured touch targets ≥${TOUCH_FLOOR}px (usable rendered size)`, e.message); }

    /* ---- B4: runtime storage census ------------------------------------- */
    try {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[0], hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(origin + '/', { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      await page.locator('#practice').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      /* force a real write: the sound toggle persists settings */
      await page.locator('#muteBtn').click({ timeout: 5000 }).catch(() => {});
      await page.keyboard.press('KeyM').catch(() => {});
      await page.waitForTimeout(1200);
      const keys = await page.evaluate(() => Object.keys(localStorage));
      assert(keys.length > 0, 'the game never persisted anything, so the census proves nothing');
      const stray = keys.filter(k => !k.startsWith('mbm_apexrally_'));
      assert(stray.length === 0, 'non-Rally keys written: ' + stray.join(', '));
      gate('B4', 'runtime storage census', `keys written: ${keys.join(', ')}; 0 outside the mbm_apexrally_ prefix`);
      await ctx.close();
    } catch (e) { fail('B4', 'runtime storage census', e.message); }

    /* ---- B5: reduced motion is actually honoured ------------------------ */
    try {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[2], reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto(origin + '/', { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const probe = document.querySelector('#splash') || document.body;
        return {
          matches: matchMedia('(prefers-reduced-motion:reduce)').matches,
          transition: getComputedStyle(probe).transitionDuration,
          animation: getComputedStyle(probe).animationDuration
        };
      });
      assert(state.matches, 'the emulated media query did not take effect');
      const fast = v => v.split(',').every(x => parseFloat(x) <= 0.002);
      assert(fast(state.transition) && fast(state.animation),
        `reduced motion did not shorten animation/transition: ${state.animation} / ${state.transition}`);
      gate('B5', 'reduced motion honoured in the rendered page', `animation ${state.animation}, transition ${state.transition}`);
      await ctx.close();
    } catch (e) { fail('B5', 'reduced motion honoured in the rendered page', e.message); }

  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter(r => r.status === 'FAIL');
  console.log(`\nApex Rally browser: ${results.length - failed.length}/${results.length} rendered contracts passed.`);
  if (failed.length) { console.error('FAILED: ' + failed.map(f => f.id).join(', ')); process.exitCode = 1; }
  else console.log(`ALL ${results.length} APEX RALLY RENDERED CONTRACTS PASSED`);
})();
