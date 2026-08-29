#!/usr/bin/env node
/**
 * Same-machine 30-second post-start sanity comparison for the eight-game V4
 * deployment. The old Site and Lessons roots are explicit inputs so the PR
 * workflow can pin the actual rollback commits rather than a moving branch.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_SITE = path.resolve(process.env.V4_BASE_SITE || '');
const BASE_LESSONS = path.resolve(process.env.V4_BASE_LESSONS || '');
const SAMPLE_MS = Number(process.env.V4_SAMPLE_MS || 30000);
const REPORT = path.resolve(process.env.V4_PERF_REPORT || path.join(os.tmpdir(), 'v4-games-performance.json'));
assert(fs.existsSync(BASE_SITE), 'V4_BASE_SITE must point to the pinned pre-release Site checkout');
assert(fs.existsSync(BASE_LESSONS), 'V4_BASE_LESSONS must point to the pinned Lessons checkout');
assert.equal(SAMPLE_MS, 30000, 'the release protocol requires an exact 30-second sample');

// The eight games below are the fixed historical 2026-08-29 release cohort;
// this benchmark must not expand when another shelf route is added later.
const SUBJECTS = [
  { id: 'offbrand', candidate: '/offbrand/', baselineRoot: 'lessons', baseline: '/Games/Off_Brand.html' },
  { id: 'trailrunner', candidate: '/trailrunner/', baselineRoot: 'lessons', baseline: '/Games/Trail_Runner.html' },
  { id: 'apexkick', candidate: '/apexkick/', baselineRoot: 'site', baseline: '/apexkick/' },
  { id: 'auroralinks', candidate: '/auroralinks/', baselineRoot: 'site', baseline: '/auroralinks/' },
  { id: 'houseolympiad', candidate: '/houseolympiad/', baselineRoot: null, baseline: null },
  { id: 'olympics', candidate: '/olympics/', baselineRoot: 'site', baseline: '/olympics/' },
  { id: 'relicforge', candidate: '/relicforge/', baselineRoot: 'site', baseline: '/relicforge/' },
  { id: 'voxel', candidate: '/voxel/', baselineRoot: 'site', baseline: '/voxel/' }
];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
async function serve(root) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname); if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function clickVisible(page, selectors) {
  for (const selector of selectors) {
    const node = page.locator(selector).first();
    if (await node.isVisible().catch(() => false)) { await node.click({ timeout: 5000 }).catch(() => {}); return selector; }
  }
  return null;
}

async function startSubject(page, id) {
  if (id === 'offbrand') {
    await clickVisible(page, ['#scrSplash']);
    await page.locator('#btnCrew').waitFor({ state: 'visible', timeout: 20000 }); await page.locator('#btnCrew').click();
    await page.locator('#btnCnBegin,#btnCnSkip').first().waitFor({ state: 'visible' }); await clickVisible(page, ['#btnCnBegin', '#btnCnSkip']);
    await page.locator('#btnHowOk').waitFor({ state: 'visible', timeout: 5000 }); await page.locator('#btnHowOk').click();
    await page.waitForFunction(() => !!window.OB?.S && window.OB.S.paused === false); return;
  }
  if (id === 'trailrunner') {
    await page.waitForFunction(() => !!window.__TR, null, { timeout: 60000 }); await page.locator('#start-btn').click();
    await page.waitForFunction(() => !['MENU', 'PAUSED'].includes(String(window.__TR.gameState))); return;
  }
  if (id === 'apexkick') {
    await page.waitForFunction(() => !!document.querySelector('#bPlay,#bModes'), null, { timeout: 30000 });
    if (await clickVisible(page, ['#bModes'])) { await clickVisible(page, ['#mPractice', '#mDaily', '#mRivals']); }
    else await clickVisible(page, ['#bPlay']);
    await page.waitForTimeout(3500); return;
  }
  if (id === 'auroralinks') { await page.waitForFunction(() => !!document.querySelector('#quickBtn,#enterBtn,#startBtn')); await clickVisible(page, ['#quickBtn', '#enterBtn', '#startBtn']); return; }
  if (id === 'houseolympiad') {
    await page.waitForFunction(() => !!window.MadeByMattOlympiadV4QA);
    await page.evaluate(() => { const result = MadeByMattOlympiadV4QA.selfTest(); if (!result.ok) throw new Error('House self-test failed'); }); return;
  }
  if (id === 'olympics') {
    await page.waitForFunction(() => !!window.MBMGlobalGames, null, { timeout: 30000 });
    await clickVisible(page, ['#quickGamesBtn']); await clickVisible(page, ['#autoAttrs']); await clickVisible(page, ['#beginTournament']);
    await clickVisible(page, ['#eventBriefing']); await clickVisible(page, ['#startEvent']); return;
  }
  if (id === 'relicforge') {
    await page.waitForFunction(() => !!window.__relicforge, null, { timeout: 30000 });
    await page.evaluate(() => __relicforge.start());
    await page.waitForTimeout(100);
    await page.evaluate(() => __relicforge.skipStory());
    await page.waitForFunction(() => __relicforge.snapshot().mode === 'playing'); return;
  }
  if (id === 'voxel') {
    await page.waitForFunction(() => !!document.querySelector('#start'), null, { timeout: 30000 });
    await clickVisible(page, ['[data-mode="frontier"]']); await page.locator('#start').click();
    await page.waitForFunction(() => document.querySelector('#start')?.textContent.includes('Resume') && document.querySelector('#hud')?.textContent.trim().length > 20, null, { timeout: 60000 }); return;
  }
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

async function sample(browser, url, id, label) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  console.log(`START ${label}/${id}`);
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}splash=skip&debug=1&seed=424242&perf=${Date.now()}`, { waitUntil: 'load', timeout: 90000 });
  await startSubject(page, id);
  const data = await page.evaluate(duration => new Promise(resolve => {
    const deltas = [], start = performance.now(); let previous = start, frames = 0, worst = 0;
    function frame(now) {
      const delta = now - previous; previous = now; if (frames > 0) { deltas.push(delta); worst = Math.max(worst, delta); } frames++;
      if (now - start >= duration) resolve({ frames, deltas, worst, elapsed: now - start }); else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), SAMPLE_MS);
  await context.close();
  assert.deepEqual(errors, [], `${label}/${id}: page errors: ${errors.join(' | ')}`);
  const result = { label, frames: data.frames, elapsedMs: data.elapsed, medianFrameMs: percentile(data.deltas, .5), p95FrameMs: percentile(data.deltas, .95), worstFrameMs: data.worst };
  // Rollback subjects are immutable evidence, not release candidates. Require
  // enough baseline frames for a meaningful comparison, while reserving the
  // stricter usability floor for the deployable candidate.
  const minimumFrames = label === 'candidate' ? 300 : 120;
  assert(result.frames >= minimumFrames, `${label}/${id}: unusable stall (${result.frames} frames in 30 seconds; minimum ${minimumFrames})`);
  assert(result.p95FrameMs < 500, `${label}/${id}: repeated half-second stalls (p95 ${result.p95FrameMs} ms)`);
  console.log(`${label.padEnd(9)} ${id.padEnd(14)} ${result.frames} frames · median ${result.medianFrameMs.toFixed(2)} ms · p95 ${result.p95FrameMs.toFixed(2)} ms · worst ${result.worstFrameMs.toFixed(2)} ms`);
  return result;
}

const playwright = await import('playwright');
const servers = { candidate: await serve(CANDIDATE), site: await serve(BASE_SITE), lessons: await serve(BASE_LESSONS) };
const browser = await playwright.chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { protocol: { durationMs: SAMPLE_MS, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, reducedMotion: true, order: 'baseline then candidate; same browser and runner', browserVersion: browser.version() }, subjects: [] };
try {
  for (const subject of SUBJECTS) {
    const baseline = subject.baseline ? await sample(browser, `${servers[subject.baselineRoot].origin}${subject.baseline}`, subject.id, 'baseline') : null;
    const candidate = await sample(browser, `${servers.candidate.origin}${subject.candidate}`, subject.id, 'candidate');
    const comparison = baseline ? {
      medianRatio: candidate.medianFrameMs / baseline.medianFrameMs,
      p95Ratio: candidate.p95FrameMs / baseline.p95FrameMs,
      frameRatio: candidate.frames / baseline.frames
    } : null;
    if (comparison && comparison.medianRatio > 3 && comparison.p95Ratio > 3) throw new Error(`${subject.id}: severe deployment regression (median ×${comparison.medianRatio.toFixed(2)}, p95 ×${comparison.p95Ratio.toFixed(2)})`);
    report.subjects.push({ id: subject.id, baseline, candidate, comparison });
  }
} finally {
  await browser.close();
  await Promise.all(Object.values(servers).map(item => new Promise(resolve => item.server.close(resolve))));
}
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
console.log(`V4 PERFORMANCE GREEN — 8 candidate samples, 7 pinned before/after comparisons, report ${REPORT}`);
