#!/usr/bin/env node
'use strict';
/**
 * Capture one gameplay segment from a DEPLOYED URL.
 *
 * Records the live path, never a local copy: the clip must show the build
 * visitors actually get. The served bytes are proven byte-identical to the
 * tree by the live-verify workflow before this ever runs.
 *
 * Usage:
 *   node tools/capture_clip.js --base https://madebymatt.uk --scene sync-volt \
 *        --out artifacts/media --seconds 11
 */
const fs = require('fs');
const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'https://madebymatt.uk');
const SCENE = arg('scene');
const OUT = arg('out', 'artifacts/media');
const SECONDS = parseFloat(arg('seconds', '18'));
const W = 480, H = 930;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Drag the on-screen stick like a thumb: press, move in steps, release.
async function drag(page, sel, dx, dy, steps = 14, hold = 260) {
  const el = await page.$(sel); if (!el) return false;
  const b = await el.boundingBox(); if (!b) return false;
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(cx + dx * i / steps, cy + dy * i / steps); await sleep(hold / steps); }
  await sleep(hold); await page.mouse.up(); return true;
}
const tap = async (page, sel) => { const el = await page.$(sel); if (el) { await el.click({ timeout: 4000 }).catch(() => {}); return true; } return false; };

const SCENES = {
  // Neon Sync v1.1 — the joystick and VOLT, teammate-first framing.
  'sync-volt': async page => {
    await sleep(1400);
    await tap(page, '#heroCard'); await sleep(900);
    // Hero cards are buttons carrying the hero name; pick VOLT by text.
    const volt = page.locator('button.card', { hasText: /VOLT/i }).first();
    if (await volt.count()) { await volt.click({ timeout: 4000 }).catch(() => {}); await sleep(700); }
    await tap(page, '#play'); await sleep(2200);
    for (const [dx, dy] of [[52, -30], [-46, 34], [40, 40], [-30, -46]]) {
      await drag(page, '#stick', dx, dy, 12, 900);
      await sleep(500);
    }
  },
  // Neon Sync v1.1 — a beat of ESCORT RUSH.
  'sync-escort': async page => {
    await sleep(1400);
    await tap(page, '#escortCard'); await sleep(900);
    await tap(page, '#attackSide'); await sleep(2400);
    for (const [dx, dy] of [[48, 10], [30, -34], [-40, 28]]) {
      await drag(page, '#stick', dx, dy, 12, 900);
      await sleep(450);
    }
  },
  // Neon Breach — calmer movement and the touch controls. Deliberately NOT
  // muzzle-flash spam: this is the photosensitivity gate's likeliest customer.
  'breach-calm': async page => {
    await sleep(1500);
    await tap(page, '#start-btn'); await sleep(2600);
    await drag(page, '#joystick-base', 40, -46, 14, 1500); await sleep(600);
    await tap(page, '#touch-aim'); await sleep(900);
    await drag(page, '#joystick-base', -44, 30, 14, 1500); await sleep(600);
    await tap(page, '#touch-jump'); await sleep(700);
    await drag(page, '#joystick-base', 34, 40, 14, 1400); await sleep(700);
    await tap(page, '#touch-reload'); await sleep(900);
  },
};

(async () => {
  if (!SCENES[SCENE]) { console.error('unknown scene: ' + SCENE); process.exit(2); }
  const url = BASE + (SCENE.startsWith('sync') ? '/neonsync/' : '/neonbreach/');
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(OUT, 'rec-'));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true,
    recordVideo: { dir, size: { width: W, height: H } },
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  if (!resp || resp.status() !== 200) { console.error('bad status for ' + url); process.exit(1); }

  const started = Date.now();
  await SCENES[SCENE](page);
  const remain = SECONDS * 1000 - (Date.now() - started);
  if (remain > 0) await sleep(remain);

  await ctx.close();               // finalises the video file
  await browser.close();
  const vids = fs.readdirSync(dir).filter(f => f.endsWith('.webm'));
  if (!vids.length) { console.error('no video produced'); process.exit(1); }
  const dest = path.join(OUT, 'seg-' + SCENE + '.webm');
  fs.renameSync(path.join(dir, vids[0]), dest);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('SEGMENT=' + dest);
  console.log('SEGMENT_BYTES=' + fs.statSync(dest).size);
  console.log('PAGE_ERRORS=' + errors.length + (errors.length ? ' :: ' + errors.join(' | ') : ''));
  if (errors.length) process.exit(1);
})().catch(e => { console.error('capture error: ' + e.stack); process.exit(2); });
