#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const RECALIBRATED_CONTROL_BUSY_MS = 1200;
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
const ROUND_ARGUMENT = process.argv.find(argument => argument.startsWith('--round='));
const AGGREGATE_ARGUMENT = process.argv.find(argument => argument.startsWith('--aggregate='));
const SELFTEST = process.argv.includes('--selftest');
assert(!(ROUND_ARGUMENT && AGGREGATE_ARGUMENT), 'choose either --round=N or --aggregate=DIR');
assert(!(SELFTEST && (ROUND_ARGUMENT || AGGREGATE_ARGUMENT)), '--selftest runs alone');

// ---- route-round wall-clock ceiling ----------------------------------------
// DERIVATION (SC1 §3.1 / V6FINC-A R3): ceiling = max(180 s, 2 × the worst
// route-round wall time ever observed in a GREEN run). Measured over 132
// route-round samples in the four green benchmark jobs 99993863719,
// 99983672166, 99951016840 and 99924012289 (GREEN_ROUTE_ROUND_WALL_MS below,
// in the order the logs printed them): worst 91.9 s (CyberPulse, round 3,
// job 99993863719), worst non-CyberPulse 21.2 s (Aurora Links), median 13.1 s.
// max(180, 2 × 91.9 = 183.7) = 183.7 s → 184 s. A ceiling that would have
// redded a known green run would be MEASUREMENT INVALID; 184 s clears every
// recorded green route-round by at least 2×, and --selftest proves it.
//
// WHY IT EXISTS: before this ceiling nothing bounded the input sequence or the
// frame window. A subject whose main thread never yields (CyberPulse under
// software WebGL2 at 6× throttle) held Site run 33557287187 until the
// 45-minute job limit, in both attempts, printing nothing. The ceiling turns
// that silent cancel into a fast, named red and lets every other route in the
// round still print, so the sample is complete even when one route is not.
// It lowers no threshold, widens no matcher and removes no assertion.
const ROUTE_ROUND_CEILING_MS = 184000;
const GREEN_ROUTE_ROUND_WALL_MS = [
  73200, 11900, 12000, 12200, 13200, 13100, 13700, 13000, 14000, 20500, 13000,
  14800, 12900, 13200, 12400, 13300, 11800, 20900, 12100, 12900, 85400, 13100,
  12800, 21200, 13000, 12200, 13100, 13500, 13000, 11900, 13700, 91900, 13100,
  83700, 12300, 12000, 12300, 13300, 12900, 13300, 13700, 13600, 21000, 12900,
  15800, 12900, 13100, 12300, 13600, 11900, 20800, 12100, 12900, 73800, 13000,
  12800, 20800, 13000, 12400, 13100, 13400, 13000, 11900, 13900, 81900, 13000,
  15900, 14100, 12000, 12500, 15000, 13300, 14000, 15600, 14900, 11500, 12800,
  16100, 13300, 14600, 12800, 13800, 13500, 11500, 12000, 14700, 13400, 12800,
  14700, 11500, 14500, 12600, 15000, 14000, 13600, 12000, 14900, 13600, 12800,
  15400, 13600, 12000, 12500, 15000, 13200, 13800, 14200, 15100, 11500, 12800,
  15800, 13400, 15300, 12400, 13900, 13400, 11500, 12000, 14800, 13800, 12800,
  14300, 11500, 14800, 12500, 14800, 14300, 13400, 12000, 14900, 13500, 12800,
];

class CeilingExceeded extends Error {
  constructor(step, elapsedMs, ceilingMs) {
    super(`route-round exceeded ${Math.round(ceilingMs / 1000)}s ceiling at step ${step}`);
    this.name = 'CeilingExceeded';
    this.step = step;
    this.elapsedMs = elapsedMs;
    this.ceilingMs = ceilingMs;
    this.contextClosed = true;
  }
}

function exceedsCeiling(elapsedMs, ceilingMs = ROUTE_ROUND_CEILING_MS) {
  return elapsedMs > ceilingMs;
}

// One clock per route-round. Every awaited stage of measureRoute passes through
// guard(), so a stage that never settles (a hung page.evaluate, a keyboard
// press the renderer never acknowledges) is raced against the same deadline and
// the failure names the stage it died in.
function routeClock(ceilingMs = ROUTE_ROUND_CEILING_MS) {
  const started = Date.now();
  let step = 'start';
  let fire = null;
  const deadline = new Promise((_, reject) => { fire = reject; });
  deadline.catch(() => {});
  const timer = setTimeout(() => {
    const elapsed = Date.now() - started;
    if (exceedsCeiling(elapsed, ceilingMs)) fire(new CeilingExceeded(step, elapsed, ceilingMs));
  }, ceilingMs + 1);
  return {
    guard(name, promise) { step = name; return Promise.race([promise, deadline]); },
    elapsedMs() { return Date.now() - started; },
    stop() { clearTimeout(timer); },
  };
}

async function closeContextBounded(context, limitMs = 15000) {
  let timer = null;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), limitMs); });
  const outcome = await Promise.race([context.close().then(() => 'closed', () => 'failed'), timeout]);
  clearTimeout(timer);
  return outcome === 'closed';
}

// A renderer that is spinning forever can wedge context.close(); when it does,
// the whole browser is replaced so the next route measures on a clean process.
async function recycleBrowser(browser, limitMs = 15000) {
  let timer = null;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), limitMs); });
  const outcome = await Promise.race([browser.close().then(() => 'closed', () => 'failed'), timeout]);
  clearTimeout(timer);
  if (outcome !== 'closed') {
    try { browser.process()?.kill('SIGKILL'); } catch { /* already gone */ }
  }
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true, channel: 'chromium' });
}

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
      return { index, text, id: element.id || null };
    }
    return null;
  });
  if (!match) return null;
  await candidates.nth(match.index).click({ timeout: 1000 }).catch(() => {});
  return match;
}

async function scriptedInput(page, navigationSafe = false) {
  const inputs = navigationSafe
    ? INPUTS.filter(input => input[0] === 'key' && input[1] !== 'Space')
    : INPUTS;
  for (const input of inputs) {
    if (input[0] === 'key') await page.keyboard.press(input[1]).catch(() => {});
    else await page.mouse.click(Math.round(VIEWPORT.width * input[1]), Math.round(VIEWPORT.height * input[2])).catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function frameWindow(page, busyMs = 0, navigationSafe = false) {
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
  await scriptedInput(page, navigationSafe);
  return measurement;
}

async function measureRoute(browser, origin, game, round, options = {}) {
  const clock = routeClock(options.ceilingMs);
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' });
  let failure = null;
  try {
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
    const subjectUrl = new URL(game.href, options.subjectOrigin || (local ? origin : LIVE_ORIGIN));
    subjectUrl.searchParams.set('splash', 'skip');
    // Voxel's terrain-ready evidence is deliberately exposed only by its
    // existing `?debug=1` diagnostic (voxel/index.html:606, 2007).  Without
    // enabling that product-owned surface, the `view 3` assertion below can
    // never observe the state it is intended to require.
    if (game.href === '/voxel/') subjectUrl.searchParams.set('debug', '1');
    const url = subjectUrl.href;
    const response = await clock.guard('navigate', page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }));
    assert.equal(response?.status(), 200, `${game.title}: navigation returned ${response?.status()}`);
    await clock.guard('settle', page.waitForTimeout(500));
    const startMatch = await clock.guard('dismiss-and-start', dismissAndStart(page));
    const startControl = startMatch?.text ?? null;
    const navigationSafe = game.href === '/houseolympiad/';
    if (navigationSafe) await clock.guard('house-olympiad-refresh', page.locator('#refreshBtn').click());
    if (game.href === '/voxel/') {
      /* Voxel initialises its mode record before this probe and changes the
         button's copy from "Click to Play" to the derived mode action (currently
         "Launch Creative"). The control's stable identity is #start; the Resume
         and view-3 waits below prove that activating it really began setup. */
      assert.equal(startMatch?.id, 'start', 'Voxel setup control was not exercised');
      await clock.guard('voxel-resume', page.waitForFunction(
        () => document.getElementById('start')?.textContent === 'Resume',
        null,
        { timeout: 120000 },
      ));
      await clock.guard('voxel-view-3', page.waitForFunction(
        () => document.getElementById('hud')?.textContent.includes('view 3'),
        null,
        { timeout: 10000 },
      ));
    }
    // Throttle the identical warm-up and measured window, not HTML/JS parsing or
    // route setup. Voxel's terrain generation completes at its initial view 3;
    // no unthrottled input window is allowed to tune that view upward first.
    await clock.guard('cpu-throttle', session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE }));
    await clock.guard('scripted-input', scriptedInput(page, navigationSafe));
    await clock.guard('warm-up', page.waitForTimeout(WARM_UP_MS));
    const measured = await clock.guard('frame-window', frameWindow(page, 0, navigationSafe));
    const wallMs = clock.elapsedMs();
    return { fps: measured.fps, frames: measured.frames, elapsedMs: measured.elapsedMs, wallMs, startControl, pageErrors: errors };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    clock.stop();
    const closed = await closeContextBounded(context);
    if (failure instanceof CeilingExceeded) failure.contextClosed = closed;
  }
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
const harnessBytes = fs.readFileSync(fileURLToPath(import.meta.url));
const harnessSha256 = sha256(harnessBytes);
const derivation = {
  newest: NEWEST,
  heavyWebgl: heavy.map(game => ({ href: game.href, bytes: game.byteLength })),
  seededRandom: random.map(game => game.href),
};
const expectedGames = [...shipped, town];
const expectedByHref = new Map(expectedGames.map(game => [game.href, game]));

function protocol(browserVersion) {
  return {
    seed: SEED,
    viewport: VIEWPORT,
    cpuThrottle: CPU_THROTTLE,
    rounds: ROUNDS,
    warmUpMs: WARM_UP_MS,
    measuredWindowMs: MEASURE_MS,
    scriptedInput: INPUTS,
    randomAlgorithm: 'xorshift32 + descending Fisher-Yates',
    percentileAlgorithm: 'linear interpolation at (N-1)*0.25',
    routeRoundCeilingMs: ROUTE_ROUND_CEILING_MS,
    harnessSha256,
    browserChannel: 'chromium (new headless)',
    chromiumVersion: browserVersion,
  };
}

function writeFinalReport(roundReports) {
  assert.equal(roundReports.length, ROUNDS, `expected ${ROUNDS} round artifacts`);
  roundReports.sort((left, right) => left.round - right.round);
  assert.deepEqual(roundReports.map(report => report.round), [1, 2, 3], 'round artifacts are incomplete or duplicated');
  const reference = roundReports[0];
  for (const report of roundReports) {
    for (const sample of report.samples) {
      assert(!sample.result.ceilingExceeded,
        `round ${report.round} ${sample.title}: ${sample.result.ceilingExceeded?.message} (wall ${sample.result.wallMs} ms)`);
    }
    assert.equal(report.protocol.harnessSha256, harnessSha256, `round ${report.round} used another harness`);
    assert.deepEqual({ ...report.protocol, chromiumVersion: reference.protocol.chromiumVersion }, reference.protocol,
      `round ${report.round} changed the protocol or browser channel`);
    assert.equal(report.protocol.chromiumVersion, reference.protocol.chromiumVersion,
      `round ${report.round} used another Chromium version`);
    assert.deepEqual(report.derivation, derivation, `round ${report.round} changed sample derivation`);
    assert.deepEqual(report.identities, reference.identities, `round ${report.round} executable hashes changed`);
    assert.equal(report.samples.length, expectedGames.length, `round ${report.round} sample is incomplete`);
    assert.deepEqual(new Set(report.samples.map(sample => sample.href)), new Set(expectedGames.map(game => game.href)),
      `round ${report.round} sampled another route set`);
    for (const sample of report.samples) {
      const expected = expectedByHref.get(sample.href);
      assert(expected, `round ${report.round} has unexpected route ${sample.href}`);
      assert.equal(sample.title, expected.title, `round ${report.round} changed title for ${sample.href}`);
      assert.equal(sample.category, expected.category, `round ${report.round} changed category for ${sample.href}`);
    }
  }
  const controlsReport = roundReports.find(report => report.controls);
  assert(controlsReport && controlsReport.round === ROUNDS, 'controls must run once, after round 3');
  assert.equal(roundReports.filter(report => report.controls).length, 1, 'controls ran more than once');
  const runs = Object.fromEntries(expectedGames.map(game => [game.href, []]));
  for (const report of roundReports) {
    for (const sample of report.samples) runs[sample.href].push(sample.result);
  }
  const distribution = shipped.map(game => ({
    title: game.title,
    href: game.href,
    category: game.category,
    identity: reference.identities[game.href],
    runs: runs[game.href].map(run => Number(run.fps.toFixed(4))),
    wallMs: runs[game.href].map(run => run.wallMs ?? null),
    medianFps: Number(median(runs[game.href].map(run => run.fps)).toFixed(2)),
    pageErrors: runs[game.href].flatMap(run => run.pageErrors),
  })).sort((left, right) => left.medianFps - right.medianFps);
  const bar = percentile25(distribution.map(game => game.medianFps));
  const townRuns = runs[TOWN].map(run => run.fps);
  const townMedian = median(townRuns);
  const verdict = townMedian >= bar ? 'PUBLISH_COMPROMISE' : 'HOLD_PERFORMANCE_OUTLIER';
  const firstControl = controlsReport.controls.firstFps;
  const recalibratedControl = controlsReport.controls.recalibratedFps;
  assert(recalibratedControl < Math.min(...distribution.map(game => game.medianFps)), 'recalibrated control must land below the shipped band');

  const report = {
    protocol: { ...reference.protocol, execution: 'three hash-locked round jobs, aggregated after all complete' },
    derivation,
    controls: {
      first: { busyMsPerFrame: FIRST_CONTROL_BUSY_MS, fps: Number(firstControl.toFixed(2)), disposition: 'rejected unless below the complete shipped band' },
      recalibrated: { busyMsPerFrame: RECALIBRATED_CONTROL_BUSY_MS, fps: Number(recalibratedControl.toFixed(2)), disposition: 'valid below-band non-vacuity control' },
    },
    distribution,
    shippedPercentile25Fps: Number(bar.toFixed(2)),
    townLife: {
      href: TOWN,
      identity: reference.identities[TOWN],
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
}

async function runRound(roundNumber) {
  assert(Number.isInteger(roundNumber) && roundNumber >= 1 && roundNumber <= ROUNDS,
    `--round must be an integer from 1 to ${ROUNDS}`);
  const roundIndex = roundNumber - 1;
  const identities = {};
  for (const game of expectedGames) identities[game.href] = await routeIdentity(game);
  const { server, origin } = await startServer();
  const { chromium } = await import('playwright');
  let browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    const samples = [];
    const exceeded = [];
    const order = seededShuffle(expectedGames, SEED + roundIndex);
    for (const game of order) {
      let result;
      try {
        result = await measureRoute(browser, origin, game, roundIndex);
      } catch (error) {
        if (!(error instanceof CeilingExceeded)) throw error;
        result = {
          fps: 0, frames: 0, elapsedMs: 0, wallMs: error.elapsedMs, startControl: null, pageErrors: [],
          ceilingExceeded: { step: error.step, ceilingMs: error.ceilingMs, message: error.message },
        };
        exceeded.push(`${game.title}: ${error.message} (wall ${error.elapsedMs} ms)`);
        console.log(`ROUND ${roundNumber} ${game.title}: RED — ${error.message} (wall ${error.elapsedMs} ms)`);
        if (!error.contextClosed) browser = await recycleBrowser(browser);
        samples.push({ title: game.title, href: game.href, category: game.category, result });
        continue;
      }
      samples.push({ title: game.title, href: game.href, category: game.category, result });
      console.log(`ROUND ${roundNumber} ${game.title}: ${result.fps.toFixed(2)} fps (${result.frames} frames/${result.elapsedMs.toFixed(0)} ms; start=${JSON.stringify(result.startControl)}; errors=${result.pageErrors.length}; wall=${result.wallMs} ms)`);
    }
    let controls = null;
    if (roundNumber === ROUNDS) {
      controls = {
        firstFps: await measureControl(browser, FIRST_CONTROL_BUSY_MS),
        recalibratedFps: await measureControl(browser, RECALIBRATED_CONTROL_BUSY_MS),
      };
    }
    const report = {
      protocol: protocol(browser.version()),
      round: roundNumber,
      derivation,
      identities,
      samples,
      controls,
    };
    const artifactDir = path.join(ROOT, 'artifacts/townlife');
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, `performance-round-${roundNumber}.json`), JSON.stringify(report, null, 2) + '\n');
    console.log('PERFORMANCE_ROUND_JSON ' + JSON.stringify(report));
    if (exceeded.length) {
      console.log(`ROUND ${roundNumber} RED — ${exceeded.length} route-round(s) exceeded the ${Math.round(ROUTE_ROUND_CEILING_MS / 1000)}s ceiling:`);
      for (const line of exceeded) console.log(`  ${line}`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

// --selftest: the ceiling shown able to red and shown not to red a known green.
// Every arm goes through the gate's own entry points (exceedsCeiling for the
// predicate, measureRoute for the live path); none re-derives the condition.
async function selftest() {
  const outcomes = [];
  const record = (name, ok, detail) => { outcomes.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

  const breaches = GREEN_ROUTE_ROUND_WALL_MS.filter(ms => exceedsCeiling(ms));
  record('(ii) every recorded green route-round stays under the ceiling', breaches.length === 0,
    `${GREEN_ROUTE_ROUND_WALL_MS.length} samples, max ${Math.max(...GREEN_ROUTE_ROUND_WALL_MS)} ms, ceiling ${ROUTE_ROUND_CEILING_MS} ms, breaches ${breaches.length}`);
  record('(iii) a 92 s route-round stays green', !exceedsCeiling(92000), `92000 ms vs ${ROUTE_ROUND_CEILING_MS} ms`);
  record('(iii-control) one millisecond over the ceiling reds', exceedsCeiling(ROUTE_ROUND_CEILING_MS + 1), `${ROUTE_ROUND_CEILING_MS + 1} ms vs ${ROUTE_ROUND_CEILING_MS} ms`);

  const stub = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ceiling stub</title>
<button id="start" style="width:120px;height:48px">Start</button><canvas width="390" height="600"></canvas>
<script>document.getElementById('start').addEventListener('click',()=>{setTimeout(()=>{for(;;){}},1500);});</script>`);
  });
  await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
  const stubOrigin = `http://127.0.0.1:${stub.address().port}`;
  const { chromium } = await import('playwright');
  let browser = await chromium.launch({ headless: true, channel: 'chromium' });
  try {
    const started = Date.now();
    let caught = null;
    try {
      await measureRoute(browser, stubOrigin, { href: '/ceiling-stub/', title: 'ceiling stub', category: 'selftest' }, 0, { subjectOrigin: stubOrigin });
    } catch (error) { caught = error; }
    const wall = Date.now() - started;
    const named = caught instanceof CeilingExceeded && /^route-round exceeded 184s ceiling at step [a-z0-9-]+$/.test(caught.message);
    record('(i) a route whose main thread never yields reds within ceiling + 10 s', named && wall <= ROUTE_ROUND_CEILING_MS + 10000,
      caught ? `${caught.message}; wall ${wall} ms; context closed ${caught.contextClosed}` : `no error after ${wall} ms`);
    if (caught instanceof CeilingExceeded && !caught.contextClosed) browser = await recycleBrowser(browser);

    const { server, origin } = await startServer();
    try {
      const real = byHref.get('/crownbadge/');
      const result = await measureRoute(browser, origin, { ...real, category: 'selftest' }, 0);
      record('(iv) a real local route measures green through the same path and reports its wall time',
        Number.isFinite(result.fps) && result.frames > 0 && Number.isInteger(result.wallMs) && !exceedsCeiling(result.wallMs),
        `${real.title}: ${result.fps.toFixed(2)} fps, wall ${result.wallMs} ms`);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await browser.close();
    await new Promise(resolve => stub.close(resolve));
  }
  const failed = outcomes.filter(outcome => !outcome.ok);
  console.log(`${outcomes.length - failed.length}/${outcomes.length} selftest arms green`);
  if (failed.length) process.exitCode = 1;
}

if (SELFTEST) {
  await selftest();
} else if (AGGREGATE_ARGUMENT) {
  const directory = path.resolve(ROOT, AGGREGATE_ARGUMENT.slice('--aggregate='.length));
  const files = fs.readdirSync(directory)
    .filter(file => /^performance-round-[1-3]\.json$/.test(file))
    .map(file => path.join(directory, file));
  writeFinalReport(files.map(file => JSON.parse(fs.readFileSync(file, 'utf8'))));
} else {
  assert(ROUND_ARGUMENT, `run one measured round with --round=1..${ROUNDS}, or aggregate with --aggregate=DIR`);
  await runRound(Number(ROUND_ARGUMENT.slice('--round='.length)));
}
