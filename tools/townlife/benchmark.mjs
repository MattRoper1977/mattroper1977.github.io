#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SEED = 20260827;
const VIEWPORT = { width: 390, height: 844 };
const CPU_THROTTLE = 6;
const WARM_UP_MS = 2500;
const MEASURE_MS = 5000;
const ROUNDS = 3;
const LIVE_ORIGIN = 'https://mattroper1977.github.io';
// The three newest shipped routes at the 2026-08-27 C1 decision form a fixed
// historical set. Town Life is the candidate measured against that set, not a
// claim about whatever routes are newest in the current manifest.
const NEWEST = ['/titanforge/', '/crownbadge/', '/micro-tinkerer/'];
const TOWN = '/townlife/';
const FIRST_CONTROL_BUSY_MS = 68;
const RECALIBRATED_CONTROL_BUSY_MS = 220;
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

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function percentile25(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * 0.25;
  const low = Math.floor(position);
  const fraction = position - low;
  return ordered[low] + (ordered[low + 1] - ordered[low]) * fraction;
}

function xorshift32(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function seededShuffle(values, seed) {
  const shuffled = [...values];
  const random = xorshift32(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function localFileForHref(href) {
  if (!href.startsWith('/') || href.startsWith('/Lessons/')) return null;
  const relative = decodeURIComponent(href).replace(/^\/+/, '');
  const candidate = href.endsWith('/')
    ? path.join(ROOT, relative, 'index.html')
    : path.join(ROOT, relative);
  return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : null;
}

function deriveHeavyWebgl(games, excluded) {
  return games
    .filter(game => !excluded.has(game.href))
    .map(game => ({ ...game, file: localFileForHref(game.href) }))
    .filter(game => game.file)
    .map(game => ({ ...game, bytes: fs.readFileSync(game.file) }))
    .filter(game => /webgl|THREE\./i.test(game.bytes.toString('utf8')))
    .sort((left, right) => right.bytes.length - left.bytes.length || left.href.localeCompare(right.href))
    .slice(0, 2)
    .map(({ bytes, ...game }) => ({ ...game, byteLength: bytes.length }));
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.woff2': 'font/woff2',
  })[extension] || 'application/octet-stream';
}

async function startServer() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname.replace(/^\/+/, '');
      const candidate = path.resolve(ROOT, pathname.endsWith('/') ? relative + 'index.html' : relative);
      if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) throw new Error('path escapes root');
      const bytes = fs.readFileSync(candidate);
      response.writeHead(200, { 'content-type': contentType(candidate), 'cache-control': 'no-store' });
      response.end(bytes);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function routeIdentity(game) {
  const local = localFileForHref(game.href);
  if (local) {
    const bytes = fs.readFileSync(local);
    return { source: path.relative(ROOT, local), byteLength: bytes.length, sha256: sha256(bytes) };
  }
  const url = new URL(game.href, LIVE_ORIGIN);
  const response = await fetch(url, { redirect: 'follow' });
  assert.equal(response.status, 200, `${game.title}: live executable returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { source: response.url, byteLength: bytes.length, sha256: sha256(bytes) };
}

async function dismissAndStart(page) {
  const candidates = page.locator('button, [role="button"], a');
  // Resolve the same first visible start-like control in one browser pass.
  // Per-element Playwright round trips made control-dense games spend minutes
  // in this helper before their identical five-second measured window began.
  const match = await candidates.evaluateAll(elements => {
    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index];
      const rawText = (element.textContent || '').trim();
      if (!/^(start|play|begin|enter|launch|continue|new game)|start game|play now|click to play/i.test(rawText)) continue;
      if (/arcade|home|back/i.test(rawText)) continue;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
          || box.width === 0 || box.height === 0) continue;
      const text = (element.innerText || '').trim();
      if (!/^(start|play|begin|enter|launch|continue|new game)|start game|play now|click to play/i.test(text)) continue;
      if (/arcade|home|back/i.test(text)) continue;
      return { index, text };
    }
    return null;
  });
  if (!match) return null;
  await candidates.nth(match.index).click({ timeout: 1000 }).catch(() => {});
  return match.text;
}

async function scriptedInput(page) {
  for (const input of INPUTS) {
    if (input[0] === 'key') await page.keyboard.press(input[1]).catch(() => {});
    else await page.mouse.click(Math.round(VIEWPORT.width * input[1]), Math.round(VIEWPORT.height * input[2])).catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function frameWindow(page, busyMs = 0) {
  const measurement = page.evaluate(({ duration, busy }) => new Promise(resolve => {
    let frames = 0;
    let first = null;
    const tick = now => {
      if (first === null) first = now;
      if (busy) {
        const until = performance.now() + busy;
        while (performance.now() < until) { /* deliberate control load */ }
      }
      frames += 1;
      const elapsed = now - first;
      if (elapsed >= duration) resolve({ frames, elapsedMs: elapsed, fps: frames / (elapsed / 1000) });
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { duration: MEASURE_MS, busy: busyMs });
  await scriptedInput(page);
  return measurement;
}

async function measureRoute(browser, origin, game, round) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
  await context.addInitScript(seed => {
    let state = seed >>> 0;
    Math.random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x100000000;
    };
  }, SEED + round);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const session = await context.newCDPSession(page);
  const local = Boolean(localFileForHref(game.href));
  const url = new URL(game.href, local ? origin : LIVE_ORIGIN).href;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(response?.status(), 200, `${game.title}: navigation returned ${response?.status()}`);
  await page.waitForTimeout(500);
  const startControl = await dismissAndStart(page);
  if (game.href === '/voxel/') {
    assert.equal(startControl, 'Click to Play', 'Voxel setup control was not exercised');
    await page.waitForFunction(
      () => document.getElementById('start')?.textContent === 'Resume',
      null,
      { timeout: 120000 },
    );
    await page.waitForFunction(
      () => document.getElementById('hud')?.textContent.includes('view 3'),
      null,
      { timeout: 10000 },
    );
  }
  // Throttle the identical warm-up and measured window, not HTML/JS parsing or
  // route setup. Voxel's terrain generation completes at its initial view 3;
  // no unthrottled input window is allowed to tune that view upward first.
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await scriptedInput(page);
  await page.waitForTimeout(WARM_UP_MS);
  const measured = await frameWindow(page);
  await context.close();
  return { fps: measured.fps, frames: measured.frames, elapsedMs: measured.elapsedMs, startControl, pageErrors: errors };
}

async function measureControl(browser, busyMs) {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.setContent('<!doctype html><title>frame control</title><canvas></canvas>');
  const measured = await frameWindow(page, busyMs);
  await context.close();
  return measured.fps;
}

const manifestDocument = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/source-manifests/games.json'), 'utf8'));
const manifest = manifestDocument.games ?? manifestDocument;
assert(Array.isArray(manifest) && manifest.length > 0, 'site mirror must be a non-empty array');
const byHref = new Map(manifest.map(game => [game.href, game]));
for (const href of [...NEWEST, TOWN]) assert(byHref.has(href), `manifest missing ${href}`);

const excluded = new Set([...NEWEST, TOWN]);
const heavy = deriveHeavyWebgl(manifest, excluded);
assert.equal(heavy.length, 2, 'expected two derived heavy WebGL routes');
heavy.forEach(game => excluded.add(game.href));
const randomPool = manifest.filter(game => !excluded.has(game.href));
const random = seededShuffle(randomPool, SEED).slice(0, 5);
assert.equal(new Set(random.map(game => game.href)).size, 5, 'random sample must contain five distinct routes');

const shipped = [
  ...NEWEST.map(href => ({ ...byHref.get(href), category: 'newest' })),
  ...heavy.map(game => ({ ...game, category: 'heavy-webgl' })),
  ...random.map(game => ({ ...game, category: 'seeded-random' })),
];
assert.equal(shipped.length, 10);
assert.equal(new Set(shipped.map(game => game.href)).size, 10);
const town = { ...byHref.get(TOWN), category: 'candidate' };
const identities = {};
for (const game of [...shipped, town]) identities[game.href] = await routeIdentity(game);

const harnessBytes = fs.readFileSync(fileURLToPath(import.meta.url));
const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const runs = Object.fromEntries([...shipped, town].map(game => [game.href, []]));
try {
  for (let round = 0; round < ROUNDS; round += 1) {
    const order = seededShuffle([...shipped, town], SEED + round);
    for (const game of order) {
      const result = await measureRoute(browser, origin, game, round);
      runs[game.href].push(result);
      console.log(`ROUND ${round + 1} ${game.title}: ${result.fps.toFixed(2)} fps (${result.frames} frames/${result.elapsedMs.toFixed(0)} ms; start=${JSON.stringify(result.startControl)}; errors=${result.pageErrors.length})`);
    }
  }
  const firstControl = await measureControl(browser, FIRST_CONTROL_BUSY_MS);
  const recalibratedControl = await measureControl(browser, RECALIBRATED_CONTROL_BUSY_MS);
  const distribution = shipped.map(game => ({
    title: game.title,
    href: game.href,
    category: game.category,
    identity: identities[game.href],
    runs: runs[game.href].map(run => Number(run.fps.toFixed(4))),
    medianFps: Number(median(runs[game.href].map(run => run.fps)).toFixed(2)),
    pageErrors: runs[game.href].flatMap(run => run.pageErrors),
  })).sort((left, right) => left.medianFps - right.medianFps);
  const bar = percentile25(distribution.map(game => game.medianFps));
  const townRuns = runs[TOWN].map(run => run.fps);
  const townMedian = median(townRuns);
  const verdict = townMedian >= bar ? 'PUBLISH_COMPROMISE' : 'HOLD_PERFORMANCE_OUTLIER';
  assert(recalibratedControl < Math.min(...distribution.map(game => game.medianFps)), 'recalibrated control must land below the shipped band');

  const report = {
    protocol: {
      seed: SEED,
      viewport: VIEWPORT,
      cpuThrottle: CPU_THROTTLE,
      rounds: ROUNDS,
      warmUpMs: WARM_UP_MS,
      measuredWindowMs: MEASURE_MS,
      scriptedInput: INPUTS,
      randomAlgorithm: 'xorshift32 + descending Fisher-Yates',
      percentileAlgorithm: 'linear interpolation at (N-1)*0.25',
      harnessSha256: sha256(harnessBytes),
      chromiumVersion: browser.version(),
    },
    derivation: {
      newest: NEWEST,
      heavyWebgl: heavy.map(game => ({ href: game.href, bytes: game.byteLength })),
      seededRandom: random.map(game => game.href),
    },
    controls: {
      first: { busyMsPerFrame: FIRST_CONTROL_BUSY_MS, fps: Number(firstControl.toFixed(2)), disposition: 'rejected unless below the complete shipped band' },
      recalibrated: { busyMsPerFrame: RECALIBRATED_CONTROL_BUSY_MS, fps: Number(recalibratedControl.toFixed(2)), disposition: 'valid below-band non-vacuity control' },
    },
    distribution,
    shippedPercentile25Fps: Number(bar.toFixed(2)),
    townLife: {
      href: TOWN,
      identity: identities[TOWN],
      runs: townRuns.map(value => Number(value.toFixed(4))),
      medianFps: Number(townMedian.toFixed(2)),
      position: distribution.filter(game => game.medianFps < townMedian).length + 1,
    },
    verdict,
  };
  fs.mkdirSync(path.join(ROOT, 'artifacts/townlife'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'artifacts/townlife/performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PERFORMANCE_JSON ' + JSON.stringify(report));
  console.log(`PERFORMANCE VERDICT — ${verdict}; Town Life ${townMedian.toFixed(2)} fps; shipped p25 ${bar.toFixed(2)} fps; controls ${firstControl.toFixed(2)} / ${recalibratedControl.toFixed(2)} fps`);
  if (verdict !== 'PUBLISH_COMPROMISE') process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
