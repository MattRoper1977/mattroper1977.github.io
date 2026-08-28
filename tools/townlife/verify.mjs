#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ROUTE = join(ROOT, 'townlife', 'index.html');
const CARD = join(ROOT, 'assets', 'cards', 'town-life.svg');
const MIRROR = join(ROOT, 'data', 'source-manifests', 'games.json');
const STATUS = 'Gold Master v1.0 preview — verified in Chromium. Firefox, Safari and physical-device checks are still pending.';
const SAVE_KEY = 'mbm_town_life_v10';
const VIEWPORT = { width: 390, height: 844 };
const require = createRequire(import.meta.url);

function launchOptions(engine) {
  const explicit = process.env[`TOWNLIFE_${engine.toUpperCase()}_EXECUTABLE`];
  if (explicit) return { headless: true, executablePath: explicit };
  const managedChromium = '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome';
  if (engine === 'chromium' && existsSync(managedChromium)) {
    return { headless: true, executablePath: managedChromium };
  }
  return { headless: true };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function loadPlaywright() {
  const candidates = [
    'playwright',
    process.env.MBM_PLAYWRIGHT,
    '/opt/node22/lib/node_modules/playwright/index.js'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_) { /* try the next declared location */ }
  }
  throw new Error('Playwright is required for the Town Life rendered contract');
}

function staticContract(html, svg) {
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, 'route must contain exactly one h1');
  assert.match(html, /<h1>Town Life<\/h1>/, 'h1 must use the authored title');
  assert.equal(html.split(STATUS).length - 1, 1, 'status sentence must occur exactly once on the game route');
  assert.match(html, /const SAVE_KEY\s*=\s*['"]mbm_town_life_v10['"]/, 'v1.0 save key changed');
  assert.match(html, /MBM-INLINE-EXIT:BEGIN/, 'generated exit region missing');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, 'Town Life gained an external script dependency');
  assert.match(svg, /<svg\b[^>]*role="img"/i, 'card SVG lacks image semantics');
  assert.match(svg, /Town Life/, 'card SVG does not name Town Life');
  assert.ok((svg.match(/<(?:rect|path|text|circle|polygon|line)\b/gi) || []).length >= 8,
    'card SVG lacks enough drawn content to disprove a blank rectangle');
}

function contentType(path) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
  })[extname(path).toLowerCase()] || 'application/octet-stream';
}

async function startServer(headingControlHtml) {
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/__townlife_heading_control__/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(headingControlHtml);
        return;
      }
      if (url.pathname === '/Games/games.json') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        createReadStream(MIRROR).pipe(response);
        return;
      }
      const decoded = decodeURIComponent(url.pathname);
      const relative = decoded.replace(/^\/+/, '');
      let path = normalize(join(ROOT, relative));
      if (!path.startsWith(ROOT)) throw new Error('path escapes root');
      if (url.pathname.endsWith('/')) path = join(path, 'index.html');
      if (!statSync(path).isFile()) throw new Error('not a file');
      response.writeHead(200, { 'Content-Type': contentType(path), 'Cache-Control': 'no-store' });
      createReadStream(path).pipe(response);
    } catch (_) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function visibleBox(locator, label) {
  assert.equal(await locator.count(), 1, `${label}: expected exactly one element`);
  assert.equal(await locator.isVisible(), true, `${label}: element is not visible`);
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${label}: element has no rendered box`);
  return box;
}

async function assertHeading(page) {
  const heading = page.locator('h1');
  const box = await visibleBox(heading, 'Town Life h1');
  assert.equal((await heading.textContent()).trim(), 'Town Life', 'h1 is not the authored title');
  assert.ok(box.y >= 0, `h1 top is negative (${box.y})`);
  return box;
}

async function focusByTab(page, selector, limit, label) {
  for (let press = 1; press <= limit; press += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(target => document.activeElement?.matches(target), selector)) return press;
  }
  throw new Error(`${label} was not keyboard-reachable in ${limit} Tab presses`);
}

async function unobstructedAtCentre(page, selector, label) {
  const result = await page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit?.id || hit?.tagName || null, ownsHit: hit === element || element.contains(hit) };
  });
  assert.equal(result.ownsHit, true, `${label}: centre is obstructed by ${result.hit}`);
  return result;
}

async function verifyHeadingNegativeControl(browser, origin, engine) {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce' });
  const page = await context.newPage();
  let observed = '';
  try {
    await page.goto(`${origin}/__townlife_heading_control__/`, { waitUntil: 'domcontentloaded' });
    try { await assertHeading(page); } catch (error) { observed = error.message; }
    assert.match(observed, /exactly one element/, 'heading-negative control did not turn the owned assertion red');
    console.log(`${engine}: HEADING NEGATIVE CONTROL RED — ${observed}`);
  } finally {
    await context.close();
  }
}

async function verifyGame(browser, origin, engine) {
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const external = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', request => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== origin) external.push(request.url());
  });

  try {
    const response = await page.goto(`${origin}/townlife/?splash=skip`, { waitUntil: 'load' });
    assert.equal(response?.status(), 200, 'Town Life did not return HTTP 200');
    await page.waitForFunction(() => window.__MBM_TOWN_LIFE_READY__ === true, null, { timeout: 30_000 });
    const headingBox = await assertHeading(page);

    const status = page.getByText(STATUS, { exact: true });
    const statusBox = await visibleBox(status, 'preview status');
    const start = page.locator('#startBtn');
    const startBox = await visibleBox(start, 'Enter Town');
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'initial route scrolled the document');
    assert.equal(await page.locator('#welcome .modal').evaluate(element => element.scrollTop), 0,
      'initial welcome surface is scrolled down');
    assert.ok(statusBox.y >= 0 && statusBox.y + statusBox.height <= VIEWPORT.height,
      `preview status is outside the initial 390×844 viewport: ${JSON.stringify(statusBox)}`);
    assert.ok(startBox.y >= 0 && startBox.y + startBox.height <= VIEWPORT.height,
      `start control is outside the initial 390×844 viewport: ${JSON.stringify(startBox)}`);
    assert.ok(Math.abs(startBox.y - (statusBox.y + statusBox.height)) < 360,
      'preview status is not visibly near the start control');

    for (const [selector, label] of [['#startBtn', 'Enter Town'], ['#openHelpFromWelcome', 'Controls'], ['#mbmexit-back', 'way-out']]) {
      const box = await visibleBox(page.locator(selector), label);
      assert.ok(box.width >= 44 && box.height >= 44,
        `${label} target is below 44 CSS px: ${box.width}×${box.height}`);
      await unobstructedAtCentre(page, selector, label);
    }

    const tabsToStart = await focusByTab(page, '#startBtn', 30, 'Enter Town');
    const tabsToWelcomeExit = await focusByTab(page, '#mbmexit-back', 30, 'way-out while welcome dialog is open');
    await page.locator('#profileName').fill(`Codex-${engine}`);
    const tapPoint = await unobstructedAtCentre(page, '#startBtn', 'Enter Town touch target');
    await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    await page.waitForFunction(() => document.querySelector('#welcome')?.getAttribute('aria-hidden') === 'true');
    await page.waitForFunction(key => localStorage.getItem(key) !== null, SAVE_KEY, { timeout: 5_000 });
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    assert.equal(saved.profile, `Codex-${engine}`, 'entered profile was not saved');
    assert.equal(saved.firstRun, false, 'first-run completion was not saved');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__MBM_TOWN_LIFE_READY__ === true, null, { timeout: 30_000 });
    assert.equal(await page.locator('#welcome').getAttribute('aria-hidden'), 'true', 'saved game did not restore past welcome');
    const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    assert.equal(restored.profile, `Codex-${engine}`, 'saved profile did not restore');

    await page.goto(`${origin}/townlife/?qa=1&splash=skip`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.MBMTownLifeQA?.ready() === true, null, { timeout: 30_000 });
    await page.evaluate(() => window.MBMTownLifeQA.teleport(1200, 900));
    const before = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player);
    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    const after = await page.evaluate(() => window.MBMTownLifeQA.getEntities().player);
    assert.ok(after.x > before.x + 0.1, `keyboard input did not move player: ${before.x} → ${after.x}`);

    const wayOut = await visibleBox(page.locator('#mbmexit-back'), 'way-out after boot');
    assert.ok(wayOut.width >= 44 && wayOut.height >= 44, 'way-out target fell below 44 CSS px');
    const tabsToExit = await focusByTab(page, '#mbmexit-back', 120, 'way-out');
    await unobstructedAtCentre(page, '#mbmexit-back', 'way-out touch target');

    assert.deepEqual(external, [], `external requests observed: ${JSON.stringify(external)}`);
    assert.deepEqual(pageErrors, [], `page errors observed: ${JSON.stringify(pageErrors)}`);
    assert.deepEqual(consoleErrors, [], `console errors observed: ${JSON.stringify(consoleErrors)}`);

    console.log(`${engine}: GAME GREEN — boot/input/save/restore; h1 top ${headingBox.y.toFixed(2)}; status top ${statusBox.y.toFixed(2)}; start ${startBox.width.toFixed(1)}×${startBox.height.toFixed(1)}; Tab start ${tabsToStart}; Tab exit with welcome ${tabsToWelcomeExit}; Tab exit after boot ${tabsToExit}; 0 external requests; 0 console errors`);
  } finally {
    await context.close();
  }
}

async function verifyShelves(browser, origin, engine, expectedGames) {
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/games/`, { waitUntil: 'load' });
    const townCard = page.locator('a.gcard[href="/townlife/"]');
    await townCard.waitFor({ state: 'attached', timeout: 10_000 });
    await townCard.evaluate(element => { const details = element.closest('details'); if (details) details.open = true; });
    await townCard.scrollIntoViewIfNeeded();
    const cardBox = await visibleBox(townCard, 'Town Life arcade card');
    const parentBox = await townCard.locator('xpath=..').boundingBox();
    assert.ok(cardBox.x >= -0.5 && cardBox.x + cardBox.width <= VIEWPORT.width + 0.5,
      `Town Life arcade card escapes 390px viewport: ${JSON.stringify(cardBox)}`);
    assert.ok(parentBox && cardBox.x >= parentBox.x - 0.5 && cardBox.x + cardBox.width <= parentBox.x + parentBox.width + 0.5,
      'Town Life arcade card escapes its grid box');
    assert.ok((await townCard.textContent()).includes(STATUS), 'arcade card omits exact preview status');
    const imageStats = await townCard.locator('img.ga').evaluate(async image => {
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 36;
      const context2d = canvas.getContext('2d', { willReadFrequently: true });
      context2d.drawImage(image, 0, 0, canvas.width, canvas.height);
      const bytes = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
      const colours = new Set();
      let opaque = 0;
      for (let index = 0; index < bytes.length; index += 16) {
        if (bytes[index + 3] > 0) opaque += 1;
        colours.add(`${bytes[index]},${bytes[index + 1]},${bytes[index + 2]},${bytes[index + 3]}`);
      }
      return { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, colours: colours.size, opaque };
    });
    assert.ok(imageStats.naturalWidth > 0 && imageStats.naturalHeight > 0, 'Town Life card SVG did not decode');
    assert.ok(imageStats.colours >= 6 && imageStats.opaque > 100,
      `Town Life card rendered like a blank rectangle: ${JSON.stringify(imageStats)}`);
    const arcadeCards = await page.locator('a.pick, a.gcard').count();
    assert.equal(arcadeCards, expectedGames + 8, `arcade card count is not N + 8 (${expectedGames + 8})`);

    await page.goto(`${origin}/for/pupils/`, { waitUntil: 'load' });
    const pupilCard = page.locator('article.mf-pupil-game').filter({ has: page.locator('a[href="/townlife/"]') });
    await pupilCard.waitFor({ state: 'attached', timeout: 10_000 });
    await pupilCard.evaluate(element => { const details = element.closest('details'); if (details) details.open = true; });
    await pupilCard.scrollIntoViewIfNeeded();
    const pupilBox = await visibleBox(pupilCard, 'Town Life pupil card');
    assert.ok(pupilBox.x >= -0.5 && pupilBox.x + pupilBox.width <= VIEWPORT.width + 0.5,
      `Town Life pupil card escapes 390px viewport: ${JSON.stringify(pupilBox)}`);
    assert.ok((await pupilCard.textContent()).includes(STATUS), 'pupil card omits exact preview status');
    const pupilCards = await page.locator('article.mf-pupil-game').count();
    assert.equal(pupilCards, expectedGames + 8, `pupil card count is not N + 8 (${expectedGames + 8})`);
    assert.deepEqual(errors, [], `shelf page errors observed: ${JSON.stringify(errors)}`);
    console.log(`${engine}: SHELVES GREEN — ${arcadeCards}/${pupilCards} cards (N + 8); Town Life inside 390px boxes; SVG ${imageStats.naturalWidth}×${imageStats.naturalHeight}, ${imageStats.colours} sampled colours`);
  } finally {
    await context.close();
  }
}

const html = readFileSync(ROUTE, 'utf8');
const svg = readFileSync(CARD, 'utf8');
const manifest = JSON.parse(readFileSync(MIRROR, 'utf8'));
staticContract(html, svg);
const town = manifest.games.filter(game => game.href === '/townlife/');
assert.equal(town.length, 1, 'mirror must contain exactly one Town Life record');
assert.equal(town[0].desc.endsWith(STATUS), true, 'mirror status sentence differs');
assert.equal(town[0].featured, false, 'Town Life must remain uncurated');
assert.equal(town[0].hero, false, 'Town Life must not become hero');
console.log(`STATIC GREEN — route sha256 ${sha256(html)}; card sha256 ${sha256(svg)}; ${manifest.games.length} canonical mirror records`);

const headingControlHtml = html.replace('<h1>Town Life</h1>', '<h2 data-heading-negative-control>Town Life</h2>');
assert.notEqual(headingControlHtml, html, 'could not construct heading-negative control');
const requested = (process.argv.find(value => value.startsWith('--engines='))?.split('=')[1] || 'chromium,firefox,webkit')
  .split(',').map(value => value.trim()).filter(Boolean);
const playwright = loadPlaywright();
const { server, origin } = await startServer(headingControlHtml);
try {
  for (const engine of requested) {
    assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), `unknown browser engine ${engine}`);
    const browser = await playwright[engine].launch(launchOptions(engine));
    try {
      await verifyHeadingNegativeControl(browser, origin, engine);
      await verifyGame(browser, origin, engine);
      await verifyShelves(browser, origin, engine, manifest.games.length);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}

console.log(`TOWN LIFE CONTRACT GREEN — ${requested.join(', ')}`);
