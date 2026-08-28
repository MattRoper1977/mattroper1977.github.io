#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const playwright = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SAVE_KEY = 'mbm_town_life_v10';
const STATUS = 'Gold Master v1.0 preview — verified in Chromium. Firefox, Safari and physical-device checks are still pending.';
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
const ENGINE_ARGUMENT = process.argv.find(value => value.startsWith('--engines='));
const ENGINES = (ENGINE_ARGUMENT ? ENGINE_ARGUMENT.slice('--engines='.length) : 'chromium,firefox,webkit').split(',').filter(Boolean);
assert(ENGINES.length > 0 && ENGINES.every(engine => ['chromium', 'firefox', 'webkit'].includes(engine)), '--engines contains an unsupported browser');
const IDLE_ARGUMENT = process.argv.find(value => value.startsWith('--idle-ms='));
const IDLE_MS = IDLE_ARGUMENT ? Number(IDLE_ARGUMENT.slice('--idle-ms='.length)) : 600_000;
assert(Number.isInteger(IDLE_MS) && IDLE_MS >= 0, '--idle-ms must be a non-negative integer');

function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function startServer() {
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/Games/games.json') {
        const file = path.join(ROOT, 'data', 'source-manifests', 'games.json');
        response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(response);
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, url.pathname.endsWith('/') ? `${relative}index.html` : relative);
      if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) throw new Error('path escapes root');
      if (!fs.statSync(file).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(response);
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

function launchOptions(engine) {
  const explicit = process.env[`TOWNLIFE_${engine.toUpperCase()}_EXECUTABLE`];
  if (explicit) return { headless: true, executablePath: explicit };
  const managedChromium = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
  if (engine === 'chromium' && fs.existsSync(managedChromium)) return { headless: true, executablePath: managedChromium };
  return { headless: true };
}

async function visibleBox(locator, label) {
  assert.equal(await locator.count(), 1, `${label}: expected exactly one element`);
  assert.equal(await locator.isVisible(), true, `${label}: not visible`);
  const box = await locator.boundingBox();
  assert(box && box.width > 0 && box.height > 0, `${label}: no non-zero rendered box`);
  return box;
}

function assertMinTarget(box, label) {
  assert(box.width >= 44 && box.height >= 44, `${label}: target ${box.width}x${box.height} is below 44 CSS px`);
}

async function assertUnobstructed(page, selector, label) {
  const result = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit?.id || hit?.tagName || null, ownsHit: hit === element || element.contains(hit) };
  });
  assert.equal(result.ownsHit, true, `${label}: centre obstructed by ${result.hit}`);
  return result;
}

async function focusByTab(page, selector, limit, label) {
  await page.evaluate(() => document.activeElement?.blur());
  for (let press = 1; press <= limit; press += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(target => document.activeElement?.matches(target), selector)) return press;
  }
  throw new Error(`${label}: not reached within ${limit} Tab presses`);
}

async function assertRole(page, expected) {
  const state = await page.evaluate(() => window.MBMTownLifeQA.getState());
  assert.equal(state.role, expected, `role state is ${state.role}, expected ${expected}`);
  assert.equal((await page.locator('#roleLabel').textContent()).trim(), expected, 'role label disagrees with state');
}

async function assertMounted(page, expected) {
  const entities = await page.evaluate(() => window.MBMTownLifeQA.getEntities());
  assert.equal(entities.car.inCar, expected, `vehicle mount state is ${entities.car.inCar}, expected ${expected}`);
}

async function assertBreaker(page, expected) {
  const snapshot = await page.evaluate(() => window.MBMTownLifeQA.utilitySnapshot(1));
  assert(snapshot, 'plot 1 utility snapshot is absent');
  assert.equal(snapshot.utility.breakerTripped, expected, `breaker state is ${snapshot.utility.breakerTripped}, expected ${expected}`);
  if (expected) assert.equal(snapshot.utility.powered, false, 'tripped breaker still reports powered');
}

async function assertCctvOpen(page, expected) {
  const snapshot = await page.evaluate(() => window.MBMTownLifeQA.cctvSnapshot());
  assert.equal(snapshot.open, expected, `CCTV state is ${snapshot.open}, expected ${expected}`);
  assert.equal(await page.locator('#cctvPip').getAttribute('aria-hidden'), expected ? 'false' : 'true', 'CCTV aria state disagrees');
  if (expected) {
    assert(snapshot.feed && snapshot.available.length > 0, 'open CCTV has no accessible feed');
    assert.equal(await page.locator('#cctvPip').isVisible(), true, 'open CCTV PiP is not rendered');
  }
}

async function assertBuildOpen(page, expected) {
  const display = await page.locator('#buildBar').evaluate(element => getComputedStyle(element).display);
  assert.equal(display === 'flex', expected, `build bar display is ${display}, expected ${expected ? 'flex' : 'closed'}`);
}

async function assertModalState(page, id, expectedOpen) {
  const state = await page.locator(`#${id}`).evaluate(element => ({ display: getComputedStyle(element).display, hidden: element.getAttribute('aria-hidden') }));
  assert.equal(state.display === 'grid', expectedOpen, `${id}: display ${state.display} disagrees with expected open=${expectedOpen}`);
  assert.equal(state.hidden, expectedOpen ? 'false' : 'true', `${id}: aria-hidden ${state.hidden} disagrees with expected open=${expectedOpen}`);
}

async function assertHealthy(page, label) {
  const health = await page.evaluate(key => {
    let save = null;
    try { save = JSON.parse(localStorage.getItem(key)); } catch {}
    return { ready: window.__MBM_TOWN_LIFE_READY__ === true, status: window.__MBM_TOWN_LIFE_STATUS__, save };
  }, SAVE_KEY);
  assert.equal(health.ready, true, `${label}: ready flag fell false`);
  assert.equal(health.status?.stage, 'running', `${label}: runtime stage is ${health.status?.stage}`);
  assert(health.save && typeof health.save === 'object', `${label}: save is missing or unparseable`);
  return health;
}

function assertIdleWall(elapsed) {
  assert(elapsed >= IDLE_MS, `idle wall time ${elapsed} ms is shorter than ${IDLE_MS} ms`);
}

async function waitForIdle(page) {
  const started = performance.now();
  await page.waitForTimeout(IDLE_MS);
  let elapsed = performance.now() - started;
  while (elapsed < IDLE_MS) {
    await delay(Math.max(1, Math.ceil(IDLE_MS - elapsed)));
    elapsed = performance.now() - started;
  }
  return elapsed;
}

async function sweepCombination(browser, origin, engine, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleOutput = [];
  const external = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => consoleOutput.push({ type: message.type(), text: message.text() }));
  page.on('request', request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
  const evidence = { engine, viewport, tabs: {}, consoleOutput, pageErrors, external, idleMs: IDLE_MS };
  try {
    const response = await page.goto(`${origin}/townlife/?splash=skip`, { waitUntil: 'load', timeout: 30_000 });
    assert.equal(response?.status(), 200, 'boot route did not return 200');
    await page.waitForFunction(() => window.__MBM_TOWN_LIFE_READY__ === true, null, { timeout: 30_000 });
    const headingBox = await visibleBox(page.locator('h1'), 'Town Life h1');
    assert.equal((await page.locator('h1').textContent()).trim(), 'Town Life', 'visible h1 is not Town Life');
    assert(headingBox.y >= 0, `h1 top is negative: ${headingBox.y}`);
    const status = page.getByText(STATUS, { exact: true });
    const statusBox = await visibleBox(status, 'preview status');
    assert(statusBox.y >= 0 && statusBox.y + statusBox.height <= viewport.height, `preview status is outside ${viewport.width}x${viewport.height}`);
    const startBox = await visibleBox(page.locator('#startBtn'), 'start control');
    const exitBox = await visibleBox(page.locator('#mbmexit-back'), 'way-out control');
    assertMinTarget(startBox, 'start control');
    assertMinTarget(exitBox, 'way-out control');
    const startTap = await assertUnobstructed(page, '#startBtn', 'start touch control');
    await assertUnobstructed(page, '#mbmexit-back', 'way-out touch control');
    evidence.tabs.start = await focusByTab(page, '#startBtn', 30, 'start control');
    evidence.tabs.wayOutFromWelcome = await focusByTab(page, '#mbmexit-back', 30, 'welcome-dialog Tab release to way-out');
    const profile = `Sweep-${engine}-${viewport.width}`.slice(0, 18);
    await page.locator('#profileName').fill(profile);
    await page.touchscreen.tap(startTap.x, startTap.y);
    await page.waitForFunction(() => document.querySelector('#welcome')?.getAttribute('aria-hidden') === 'true');
    await page.waitForFunction(key => localStorage.getItem(key) !== null, SAVE_KEY, { timeout: 5000 });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__MBM_TOWN_LIFE_READY__ === true, null, { timeout: 30_000 });
    assert.equal(await page.locator('#welcome').getAttribute('aria-hidden'), 'true', 'reload did not restore past welcome');
    assert.equal((await page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile, SAVE_KEY)), profile, 'profile did not restore after reload');

    await page.goto(`${origin}/townlife/?qa=1&splash=skip`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForFunction(() => window.MBMTownLifeQA?.ready() === true, null, { timeout: 30_000 });
    await page.evaluate(() => window.MBMTownLifeQA.teleport(1200, 900));
    const beforeInput = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player.x);
    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    const afterInput = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player.x);
    assert(afterInput > beforeInput + 0.1, `first input did not move player: ${beforeInput} -> ${afterInput}`);

    await page.locator('#roleSelect').selectOption('Officer');
    await assertRole(page, 'Officer');
    const player = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player);
    await page.evaluate(value => window.MBMTownLifeQA.setCar({ active: true, inCar: false, x: value.x + 20, y: value.y, vx: 0, vy: 0, angle: 0 }), player);
    await page.keyboard.press('f');
    await assertMounted(page, true);
    await page.keyboard.press('f');
    await assertMounted(page, false);

    await page.evaluate(() => { window.MBMTownLifeQA.claimPlot(1, 'modern'); window.MBMTownLifeQA.tripBreaker(1); });
    await assertBreaker(page, true);
    await page.evaluate(() => window.MBMTownLifeQA.resetBreaker(1));
    await assertBreaker(page, false);

    await page.evaluate(() => window.MBMTownLifeQA.openCCTV('civic'));
    await assertCctvOpen(page, true);
    const firstFeed = await page.evaluate(() => window.MBMTownLifeQA.cctvSnapshot().feed?.id);
    await page.evaluate(() => window.MBMTownLifeQA.cycleCCTV(1));
    const cycled = await page.evaluate(() => window.MBMTownLifeQA.cctvSnapshot());
    if (cycled.available.length > 1) assert.notEqual(cycled.feed?.id, firstFeed, 'CCTV cycle did not change feed');
    await page.locator('#cctvCloseBtn').click();
    await assertCctvOpen(page, false);

    const plot = await page.evaluate(() => window.MBMTownLifeQA.getPlots().find(item => item.id === 1));
    await page.evaluate(value => window.MBMTownLifeQA.teleport(value.x + value.w / 2, value.y + value.h / 2), plot);
    await page.keyboard.press('b');
    await assertBuildOpen(page, true);
    await page.keyboard.press('Escape');
    await assertBuildOpen(page, false);

    await page.locator('#settingsBtn').click();
    await assertModalState(page, 'settingsModal', true);
    const renamed = `Idle-${engine}-${viewport.width}`.slice(0, 18);
    await page.locator('#settingsName').fill(renamed);
    await page.locator('#saveNameBtn').click();
    assert.equal((await page.evaluate(() => window.MBMTownLifeQA.getState().profile)), renamed, 'settings rename did not update game state');
    await page.locator('[data-close="settingsModal"]').click();
    await assertModalState(page, 'settingsModal', false);
    for (let cycle = 0; cycle < 25; cycle += 1) {
      await page.locator('#settingsBtn').click();
      await assertModalState(page, 'settingsModal', true);
      await page.locator('[data-close="settingsModal"]').click();
      await assertModalState(page, 'settingsModal', false);
    }
    await page.waitForFunction(({ key, value }) => JSON.parse(localStorage.getItem(key)).profile === value, { key: SAVE_KEY, value: renamed }, { timeout: 5000 });

    evidence.idleWallMs = await waitForIdle(page);
    assertIdleWall(evidence.idleWallMs);
    await assertHealthy(page, 'after idle');
    const idleBefore = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player.x);
    await page.keyboard.down('d');
    await page.waitForTimeout(200);
    await page.keyboard.up('d');
    const idleAfter = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player.x);
    assert(idleAfter > idleBefore + 0.1, 'first input after idle did not move player');

    const errors = consoleOutput.filter(message => message.type === 'error');
    const warnings = consoleOutput.filter(message => message.type === 'warning');
    evidence.warnings = warnings;
    assert.deepEqual(external, [], `external requests observed: ${JSON.stringify(external)}`);
    assert.deepEqual(pageErrors, [], `uncaught page errors observed: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(errors, [], `console errors observed: ${JSON.stringify(errors)}`);
    console.log(`SWEEP GREEN ${engine} ${viewport.width}x${viewport.height} — boot/input/save/reload/restore; role; vehicle enter/exit; breaker; CCTV; build; rename; 25 modal cycles; idle ${evidence.idleWallMs} ms; warnings ${warnings.length}; errors 0`);
    console.log(`CONSOLE ${engine} ${viewport.width}x${viewport.height} ${JSON.stringify(consoleOutput)}`);
    return evidence;
  } finally {
    await context.close();
  }
}

async function positiveControls(browser, origin) {
  const controls = [];
  const red = async (label, action) => {
    let message = '';
    try { await action(); } catch (error) { message = error.message; }
    assert(message, `${label}: control unexpectedly stayed green`);
    controls.push({ label, observedRed: true, message });
    console.log(`POSITIVE CONTROL RED ${label} — ${message}`);
  };
  const context = await browser.newContext({ viewport: VIEWPORTS[0], hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/townlife/?splash=skip`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__MBM_TOWN_LIFE_READY__ === true);
    await page.locator('h1').evaluate(element => element.remove());
    await red('visible h1 removal', () => visibleBox(page.locator('h1'), 'Town Life h1'));
    const start = page.locator('#startBtn');
    await start.evaluate(element => { element.style.width = '1px'; element.style.height = '1px'; element.style.minWidth = '0'; element.style.minHeight = '0'; });
    await red('44px target shrink', async () => assertMinTarget(await visibleBox(start, 'start control'), 'start control'));
    const overlay = await page.evaluate(() => { const element = document.createElement('div'); element.id = 'townlife-obstruction-control'; element.style.cssText = 'position:fixed;inset:0;z-index:2147483647'; document.body.appendChild(element); return true; });
    assert(overlay);
    await red('touch obstruction', () => assertUnobstructed(page, '#startBtn', 'start touch control'));
  } finally {
    await context.close();
  }

  const qaContext = await browser.newContext({ viewport: VIEWPORTS[0], serviceWorkers: 'block' });
  const qa = await qaContext.newPage();
  try {
    await qa.goto(`${origin}/townlife/?qa=1&splash=skip`, { waitUntil: 'load' });
    await qa.waitForFunction(() => window.MBMTownLifeQA?.ready() === true);
    await qa.evaluate(() => window.MBMTownLifeQA.setRole('Officer'));
    await qa.locator('#roleLabel').evaluate(element => {
      const forceMutation = () => {
        if (element.textContent !== 'Resident') element.textContent = 'Resident';
      };
      new MutationObserver(forceMutation).observe(element, { childList: true, subtree: true, characterData: true });
      forceMutation();
    });
    await red('role label mutation', () => assertRole(qa, 'Officer'));
    await qa.evaluate(() => window.MBMTownLifeQA.setCar({ active: true, inCar: false }));
    await red('vehicle mount mutation', () => assertMounted(qa, true));
    await qa.evaluate(() => { window.MBMTownLifeQA.claimPlot(1, 'modern'); window.MBMTownLifeQA.resetBreaker(1); });
    await red('breaker state mutation', () => assertBreaker(qa, true));
    await red('closed CCTV mutation', () => assertCctvOpen(qa, true));
    await qa.locator('#buildBar').evaluate(element => { element.style.display = 'none'; });
    await red('build bar mutation', () => assertBuildOpen(qa, true));
    await qa.locator('#settingsBtn').click();
    await qa.locator('#settingsModal').evaluate(element => { element.setAttribute('aria-hidden', 'true'); });
    await red('modal aria mutation', () => assertModalState(qa, 'settingsModal', true));
    await red('rename state mutation', async () => assert.equal((await qa.evaluate(() => window.MBMTownLifeQA.getState().profile)), '__impossible_profile__', 'profile mutation control'));
    await qa.evaluate(() => { window.__MBM_TOWN_LIFE_READY__ = false; });
    await red('idle health mutation', () => assertHealthy(qa, 'idle control'));
    await red('idle wall-time short measurement', async () => assertIdleWall(IDLE_MS - 1));
  } finally {
    await qaContext.close();
  }
  return controls;
}

const { server, origin } = await startServer();
const report = { protocol: { engines: ENGINES, viewports: VIEWPORTS, idleMs: IDLE_MS, serial: true }, controls: [], combinations: [] };
try {
  const controlBrowser = await playwright.chromium.launch(launchOptions('chromium'));
  try { report.controls = await positiveControls(controlBrowser, origin); }
  finally { await controlBrowser.close(); }
  for (const engine of ENGINES) {
    const browser = await playwright[engine].launch(launchOptions(engine));
    try {
      report.engineVersion = report.engineVersion || {};
      report.engineVersion[engine] = browser.version();
      for (const viewport of VIEWPORTS) report.combinations.push(await sweepCombination(browser, origin, engine, viewport));
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}
fs.mkdirSync(path.join(ROOT, 'artifacts', 'townlife'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts', 'townlife', 'defect-sweep.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`TOWN LIFE FULL SWEEP GREEN — ${report.combinations.length}/${ENGINES.length * VIEWPORTS.length} engine/viewport combinations; ${report.controls.length} observed-red positive controls; idle ${IDLE_MS} ms per combination`);
