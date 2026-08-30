#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CURRENT_HTML = path.join(ROOT, 'townlife', 'index.html');
const SEED = 20260827;
const VIEWPORT = { width: 390, height: 844 };
const CPU_THROTTLE = 6;
const WARM_UP_MS = 2500;
const MEASURE_MS = 5000;
const RUNS = 9;
const CONTROL_BUSY_MS = 1200;
// A five-second rAF window is quantised in whole frames and shared CI runners
// add scheduling noise. Requiring byte-identical code paths to differ by
// literally 0.0000 fps made the guard reject a 2.4% median shift while each
// sample set spread by 26% or more. Five percent remains a fixed, strict
// regression budget (about five frames in this window), and the busy-frame
// control below must still fail this exact predicate.
const MAX_MEDIAN_REGRESSION_RATIO = 0.05;
const INPUTS = [
  ['key', 'ArrowUp'],
  ['key', 'ArrowRight'],
  ['tap', 0.50, 0.62],
  ['key', 'Space'],
  ['key', 'ArrowDown'],
  ['key', 'ArrowLeft'],
  ['tap', 0.35, 0.68],
  ['key', 'Space'],
  ['key', 'ArrowRight'],
  ['tap', 0.65, 0.68],
];

function argument(name) {
  const hit = process.argv.find(value => value.startsWith(`--${name}=`));
  return hit ? path.resolve(ROOT, hit.slice(name.length + 3)) : null;
}

const BASELINE_HTML = argument('baseline-html');
const SHIPPED_REPORT = argument('shipped-report');
assert(BASELINE_HTML && fs.statSync(BASELINE_HTML).isFile(), '--baseline-html must name the exact pre-splash Town Life bytes');
assert(SHIPPED_REPORT && fs.statSync(SHIPPED_REPORT).isFile(), '--shipped-report must name the median-of-three estate report');

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function median(values) { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]; }
function spread(values) { return Math.max(...values) - Math.min(...values); }
function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' })[path.extname(file)] || 'application/octet-stream';
}

async function startServer() {
  const baseline = fs.readFileSync(BASELINE_HTML);
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/__townlife_before__/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(baseline);
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, url.pathname.endsWith('/') ? `${relative}index.html` : relative);
      if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) throw new Error('path escapes root');
      const bytes = fs.readFileSync(file);
      response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
      response.end(bytes);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function scriptedInput(page) {
  for (const input of INPUTS) {
    if (input[0] === 'key') await page.keyboard.press(input[1]);
    else await page.mouse.click(Math.round(VIEWPORT.width * input[1]), Math.round(VIEWPORT.height * input[2]));
    await page.waitForTimeout(350);
  }
}

async function frameWindow(page, busyMs = 0) {
  const result = page.evaluate(({ duration, busy }) => new Promise(resolveMeasurement => {
    let frames = 0;
    let first = null;
    const tick = now => {
      if (first === null) first = now;
      if (busy > 0) {
        const until = performance.now() + busy;
        while (performance.now() < until) { /* deliberate non-vacuity load */ }
      }
      frames += 1;
      const elapsedMs = now - first;
      if (elapsedMs >= duration) resolveMeasurement({ frames, elapsedMs, fps: frames / (elapsedMs / 1000) });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { duration: MEASURE_MS, busy: busyMs });
  await scriptedInput(page);
  return result;
}

async function measure(browser, origin, route, busyMs = 0) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
  await context.addInitScript(seed => {
    let state = seed >>> 0;
    Math.random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    };
  }, SEED);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  const response = await page.goto(`${origin}${route}?qa=1&splash=skip`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  assert.equal(response?.status(), 200, `${route}: HTTP ${response?.status()}`);
  await page.waitForFunction(() => window.MBMTownLifeQA?.ready() === true, null, { timeout: 30_000 });
  const bootMs = Date.now() - started;
  await page.evaluate(() => {
    window.MBMTownLifeQA.clearWelcome();
    window.MBMTownLifeQA.setRenderQuality('high');
    window.MBMTownLifeQA.teleport(1200, 900);
  });
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await scriptedInput(page);
  await page.waitForTimeout(WARM_UP_MS);
  const measured = await frameWindow(page, busyMs);
  await context.close();
  return { ...measured, bootMs, pageErrors: errors };
}

const beforeBytes = fs.readFileSync(BASELINE_HTML);
const afterBytes = fs.readFileSync(CURRENT_HTML);
assert(!beforeBytes.includes(Buffer.from('MBM-MAKER-SPLASH:BEGIN')), 'baseline unexpectedly contains the generated maker splash');
assert(afterBytes.includes(Buffer.from('MBM-MAKER-SPLASH:BEGIN')), 'candidate does not contain the generated maker splash');
const shipped = JSON.parse(fs.readFileSync(SHIPPED_REPORT, 'utf8'));
const shippedP25 = Number(shipped.shippedPercentile25Fps);
assert(Number.isFinite(shippedP25) && shippedP25 > 0, 'shipped report lacks a valid 25th percentile');

const { server, origin } = await startServer();
const managedChromium = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(managedChromium)
  ? { headless: true, executablePath: managedChromium }
  : { headless: true, channel: 'chromium' });
const chromiumVersion = browser.version();
const before = [], after = [], control = [];
try {
  for (let run = 1; run <= RUNS; run += 1) {
    const order = run % 2 ? [['before', '/__townlife_before__/'], ['after', '/townlife/']] : [['after', '/townlife/'], ['before', '/__townlife_before__/']];
    for (const [label, route] of order) {
      const value = await measure(browser, origin, route);
      (label === 'before' ? before : after).push(value);
      console.log(`${label.toUpperCase()} RUN ${run}: ${value.fps.toFixed(4)} fps, ${value.frames} frames/${value.elapsedMs.toFixed(1)} ms, boot ${value.bootMs} ms, errors ${value.pageErrors.length}`);
    }
  }
  for (let run = 1; run <= RUNS; run += 1) {
    const value = await measure(browser, origin, '/townlife/', CONTROL_BUSY_MS);
    control.push(value);
    console.log(`CONTROL RUN ${run}: ${value.fps.toFixed(4)} fps, ${value.frames} frames/${value.elapsedMs.toFixed(1)} ms`);
  }
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}

const beforeFps = before.map(value => value.fps);
const afterFps = after.map(value => value.fps);
const controlFps = control.map(value => value.fps);
const beforeMedian = median(beforeFps);
const afterMedian = median(afterFps);
const controlMedian = median(controlFps);
const pairedDeltas = after.map((value, index) => value.fps - before[index].fps);
const pairedMedianDelta = median(pairedDeltas);
const pairedSpreadDelta = spread(pairedDeltas);
const busyPairedDeltas = control.map((value, index) => value.fps - before[index].fps);
const busyPairedMedianDelta = median(busyPairedDeltas);
const regressionThresholdFps = beforeMedian * MAX_MEDIAN_REGRESSION_RATIO;
const minimumAcceptableFps = beforeMedian - regressionThresholdFps;
const noMeaningfulRegression = afterMedian >= minimumAcceptableFps;
const aboveShippedFloor = afterMedian >= shippedP25;
const controlRed = controlMedian < minimumAcceptableFps && controlMedian < shippedP25 && busyPairedMedianDelta < 0;
const report = {
  protocol: { seed: SEED, viewport: VIEWPORT, cpuThrottle: CPU_THROTTLE, warmUpMs: WARM_UP_MS, measuredWindowMs: MEASURE_MS, runs: RUNS, scriptedInput: INPUTS, order: 'alternating AB/BA', chromiumVersion },
  identities: {
    before: { path: BASELINE_HTML, bytes: beforeBytes.length, sha256: sha256(beforeBytes) },
    after: { path: CURRENT_HTML, bytes: afterBytes.length, sha256: sha256(afterBytes) },
  },
  before: { fps: beforeFps, medianFps: beforeMedian, spreadFps: spread(beforeFps), bootMs: before.map(value => value.bootMs), pageErrors: before.flatMap(value => value.pageErrors) },
  after: { fps: afterFps, medianFps: afterMedian, spreadFps: spread(afterFps), bootMs: after.map(value => value.bootMs), pageErrors: after.flatMap(value => value.pageErrors) },
  paired: { deltasFps: pairedDeltas, medianDeltaFps: pairedMedianDelta, spreadDeltaFps: pairedSpreadDelta,
    thresholdFps: -regressionThresholdFps, maximumMedianRegressionRatio: MAX_MEDIAN_REGRESSION_RATIO },
  shippedPercentile25Fps: shippedP25,
  controls: { busyMsPerFrame: CONTROL_BUSY_MS, fps: controlFps, medianFps: controlMedian, spreadFps: spread(controlFps), pairedDeltasFps: busyPairedDeltas, pairedMedianDeltaFps: busyPairedMedianDelta, observedRed: controlRed },
  gates: { noMeaningfulRegression, aboveShippedFloor, zeroPageErrors: before.concat(after).every(value => value.pageErrors.length === 0), controlRed },
};
fs.mkdirSync(path.join(ROOT, 'artifacts', 'townlife'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'townlife', 'splash-performance.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`SPLASH PERFORMANCE — before ${beforeMedian.toFixed(4)} fps (spread ${spread(beforeFps).toFixed(4)}); after ${afterMedian.toFixed(4)} fps (spread ${spread(afterFps).toFixed(4)}); paired delta ${pairedMedianDelta.toFixed(4)} fps (spread ${pairedSpreadDelta.toFixed(4)}, fixed median guard -${(MAX_MEDIAN_REGRESSION_RATIO * 100).toFixed(1)}% / -${regressionThresholdFps.toFixed(4)} fps); shipped p25 ${shippedP25.toFixed(4)}; control ${controlMedian.toFixed(4)} fps (spread ${spread(controlFps).toFixed(4)}, paired delta ${busyPairedMedianDelta.toFixed(4)}) RED=${controlRed}`);
assert(controlRed, 'RL4 busy-frame positive control did not turn the real performance gate red');
assert(report.gates.zeroPageErrors, `performance run emitted page errors: ${JSON.stringify(before.concat(after).flatMap(value => value.pageErrors))}`);
assert(noMeaningfulRegression, `Town Life median regressed beyond the fixed ${(MAX_MEDIAN_REGRESSION_RATIO * 100).toFixed(1)}% guard: ${beforeMedian.toFixed(4)} -> ${afterMedian.toFixed(4)} fps (minimum ${minimumAcceptableFps.toFixed(4)})`);
assert(aboveShippedFloor, `Town Life fell below shipped p25: ${afterMedian.toFixed(4)} < ${shippedP25.toFixed(4)} fps`);
