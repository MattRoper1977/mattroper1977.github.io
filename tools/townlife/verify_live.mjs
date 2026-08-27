#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPOSITORY = 'MattRoper1977/mattroper1977.github.io';
const GAMES_REPOSITORY = 'MattRoper1977/Games';
const ORIGIN = 'https://madebymatt.uk';
const STATUS = 'Gold Master v1.0 preview — verified in Chromium. Firefox, Safari and physical-device checks are still pending.';
const VIEWPORT = { width: 390, height: 844 };
const POLL_LIMIT = 20;
const POLL_MS = 30_000;

const expectedIndex = process.argv.indexOf('--expected-sha');
const expectedSha = expectedIndex >= 0 ? process.argv[expectedIndex + 1] : '';
assert.match(expectedSha, /^[0-9a-f]{40}$/i, '--expected-sha must be a full commit SHA');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function apiHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'townlife-live-closeout' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function api(url) {
  const response = await fetch(url, { headers: apiHeaders() });
  assert.equal(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

async function waitForDeployment() {
  for (let attempt = 1; attempt <= POLL_LIMIT; attempt += 1) {
    const deployments = await api(`https://api.github.com/repos/${REPOSITORY}/deployments?environment=github-pages&per_page=20`);
    const deployment = deployments.find(item => item.sha === expectedSha);
    if (deployment) {
      const statuses = await api(`https://api.github.com/repos/${REPOSITORY}/deployments/${deployment.id}/statuses?per_page=20`);
      const success = statuses.find(item => item.state === 'success');
      if (success) return { deploymentId: deployment.id, statusId: success.id, environmentUrl: success.environment_url };
    }
    console.log(`DEPLOYMENT PENDING — ${expectedSha}; attempt ${attempt}/${POLL_LIMIT}`);
    if (attempt < POLL_LIMIT) await sleep(POLL_MS);
  }
  throw new Error(`PENDING — no successful github-pages deployment for ${expectedSha} after ${POLL_LIMIT} attempts`);
}

async function waitForCanonicalTown() {
  for (let attempt = 1; attempt <= POLL_LIMIT; attempt += 1) {
    const commit = await api(`https://api.github.com/repos/${GAMES_REPOSITORY}/commits/main`);
    const sha = commit.sha;
    const response = await fetch(`https://raw.githubusercontent.com/${GAMES_REPOSITORY}/${sha}/games.json`, { headers: { 'User-Agent': 'townlife-live-closeout' } });
    assert.equal(response.status, 200, `canonical games.json returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const document = JSON.parse(bytes.toString('utf8'));
    if (document.games?.some(game => game.href === '/townlife/')) return { sha, bytes, document };
    console.log(`CANONICAL PENDING — Games/main ${sha} has no /townlife/; attempt ${attempt}/${POLL_LIMIT}`);
    if (attempt < POLL_LIMIT) await sleep(POLL_MS);
  }
  throw new Error('PENDING — Games/main did not acquire /townlife/ within the bounded poll');
}

async function fetchRoute(route) {
  const response = await fetch(new URL(route, ORIGIN), {
    redirect: 'follow',
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'townlife-live-closeout' },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const headers = {};
  for (const name of ['cache-control', 'etag', 'age', 'last-modified']) {
    headers[({ 'cache-control': 'Cache-Control', etag: 'ETag', age: 'Age', 'last-modified': 'Last-Modified' })[name]] = response.headers.get(name) ?? 'MISSING';
  }
  return {
    route,
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'MISSING',
    headers,
    bytes,
    sha256: sha256(bytes),
  };
}

function assertRouteMarker(served, marker) {
  assert(served.bytes.includes(Buffer.from(marker)), `${served.route} is missing marker ${JSON.stringify(marker)}`);
}

function proveRouteMarkerControl(localRelative, marker) {
  const local = fs.readFileSync(path.join(ROOT, localRelative));
  assert(local.includes(Buffer.from(marker)), `${localRelative} does not contain its declared live marker`);
  const withoutMarker = Buffer.from(local.toString('utf8').replace(marker, 'data-live-marker-control-removed="true"'));
  assert.throws(
    () => assertRouteMarker({ route: `${localRelative} CONTROL`, bytes: withoutMarker }, marker),
    /is missing marker/,
  );
  console.log(`LIVE MARKER NEGATIVE CONTROL RED — removed ${JSON.stringify(marker)} from ${localRelative}`);
}

function assertExactRoute(served, localRelative, marker) {
  const local = fs.readFileSync(path.join(ROOT, localRelative));
  assert.equal(served.status, 200, `${served.route} returned ${served.status}`);
  assertRouteMarker(served, marker);
  assert.deepEqual(served.bytes, local, `${served.route} differs from committed ${localRelative}`);
  return { localRelative, bytes: local.length, sha256: sha256(local), match: true };
}

function maxAge(cacheControl) {
  if (cacheControl === 'MISSING') return null;
  const shared = /(?:^|,)\s*s-maxage=(\d+)/i.exec(cacheControl);
  const ordinary = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl);
  return Number(shared?.[1] ?? ordinary?.[1] ?? 0);
}

async function openShelf(page, route, townSelector, cardSelector) {
  const requests = [];
  const listener = request => {
    if (/\/games\.json(?:\?|$)/i.test(new URL(request.url()).pathname + new URL(request.url()).search)) requests.push(request.url());
  };
  page.on('request', listener);
  const response = await page.goto(new URL(route, ORIGIN).href, { waitUntil: 'networkidle', timeout: 60_000 });
  assert.equal(response?.status(), 200, `${route} browser navigation failed`);
  const town = page.locator(townSelector).first();
  await town.waitFor({ state: 'attached', timeout: 30_000 });
  await town.evaluate(element => {
    const details = element.closest('details');
    if (details) details.open = true;
  });
  const card = cardSelector === townSelector
    ? town
    : page.locator(cardSelector).filter({ has: page.locator(townSelector) }).first();
  await card.scrollIntoViewIfNeeded();
  assert.equal(await card.isVisible(), true, `${route} Town Life card is not visible`);
  const text = await card.innerText();
  assert(text.includes(STATUS), `${route} Town Life card is missing the exact preview sentence`);
  const box = await card.boundingBox();
  assert(box && box.width > 0 && box.height > 0, `${route} Town Life card has no rendered box`);
  assert(box.x >= -1 && box.x + box.width <= VIEWPORT.width + 1, `${route} Town Life card escapes 390px: ${JSON.stringify(box)}`);
  page.off('request', listener);
  return { requests: [...new Set(requests)], cardBox: box };
}

async function observeBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, serviceWorkers: 'block', extraHTTPHeaders: { 'Cache-Control': 'no-cache' } });
  const page = await context.newPage();
  try {
    let response = await page.goto(`${ORIGIN}/townlife/`, { waitUntil: 'load', timeout: 60_000 });
    assert.equal(response?.status(), 200);
    const heading = page.locator('h1');
    assert.equal(await heading.count(), 1, 'live Town Life must have exactly one h1');
    assert.equal((await heading.innerText()).trim(), 'Town Life');
    const headingBox = await heading.boundingBox();
    assert(headingBox && headingBox.y >= 0 && headingBox.width > 0 && headingBox.height > 0, `live h1 geometry invalid: ${JSON.stringify(headingBox)}`);
    const status = page.getByText(STATUS, { exact: true });
    assert.equal(await status.count(), 1, 'live Town Life must show the exact preview sentence once');
    const statusBox = await status.boundingBox();
    assert(statusBox && statusBox.y >= 0 && statusBox.y + statusBox.height <= VIEWPORT.height,
      `live preview sentence is outside the initial 390×844 viewport: ${JSON.stringify(statusBox)}`);

    const games = await openShelf(page, '/games/', 'a.gcard[href="/townlife/"]', 'a.gcard[href="/townlife/"]');
    const gamesCount = await page.locator('a.pick, a.gcard').count();
    const pupils = await openShelf(page, '/for/pupils/', 'a[href="/townlife/"]', 'article.mf-pupil-game');
    const pupilsCount = await page.locator('article.mf-pupil-game').count();

    const mainRequests = [];
    const mainListener = request => {
      if (new URL(request.url()).pathname.endsWith('/Games/games.json')) mainRequests.push(request.url());
    };
    page.on('request', mainListener);
    response = await page.goto(`${ORIGIN}/main/`, { waitUntil: 'networkidle', timeout: 60_000 });
    assert.equal(response?.status(), 200, '/main/ browser navigation failed');
    page.off('request', mainListener);
    return {
      headingBox,
      statusBox,
      games: { ...games, count: gamesCount },
      pupils: { ...pupils, count: pupilsCount },
      consumers: {
        '/games/': games.requests,
        '/for/pupils/': pupils.requests,
        '/main/': [...new Set(mainRequests)],
      },
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

const deployment = await waitForDeployment();
const canonical = await waitForCanonicalTown();
proveRouteMarkerControl('games/index.html', 'id="genreSections"');
const [gamesRoute, pupilsRoute, manifestRoute, mirrorRoute, townRoute] = await Promise.all([
  fetchRoute('/games/'),
  fetchRoute('/for/pupils/'),
  fetchRoute('/Games/games.json'),
  fetchRoute('/data/source-manifests/games.json'),
  fetchRoute('/townlife/'),
]);

const provenance = {
  townlife: assertExactRoute(townRoute, 'townlife/index.html', STATUS),
  games: assertExactRoute(gamesRoute, 'games/index.html', 'id="genreSections"'),
  pupils: assertExactRoute(pupilsRoute, 'for/pupils/index.html', STATUS),
  siteMirror: assertExactRoute(mirrorRoute, 'data/source-manifests/games.json', STATUS),
};
assert.equal(manifestRoute.status, 200, '/Games/games.json did not return 200');
assert.match(manifestRoute.contentType, /json/i, '/Games/games.json content type is not JSON');
assert.deepEqual(manifestRoute.bytes, canonical.bytes, 'served canonical differs from Games/main');
assert.deepEqual(manifestRoute.bytes, fs.readFileSync(path.join(ROOT, 'data/source-manifests/games.json')),
  'served canonical differs from the committed Site mirror');
provenance.canonical = { gamesMergeSha: canonical.sha, bytes: canonical.bytes.length, sha256: sha256(canonical.bytes), match: true };

const browser = await observeBrowser();
const count = canonical.document.games.length;
assert.equal(browser.games.count, count + 8, `/games/ expected ${count + 8} cards`);
assert.equal(browser.pupils.count, count + 8, `/for/pupils/ expected ${count + 8} cards`);
assert(browser.consumers['/games/'].length > 0, '/games/ runtime manifest request was not observed');
assert(browser.consumers['/main/'].length > 0, '/main/ runtime manifest request was not observed');
assert.equal(browser.consumers['/for/pupils/'].length, 0, '/for/pupils/ unexpectedly fetched a games manifest');

const gameSource = fs.readFileSync(path.join(ROOT, 'games/index.html'), 'utf8');
const mainSource = fs.readFileSync(path.join(ROOT, 'main/index.html'), 'utf8');
assert(gameSource.includes('opts:{cache:"no-cache"}') && gameSource.includes('/Games/games.json'));
assert(mainSource.includes('opts:{cache:"no-cache"}') && mainSource.includes('/Games/games.json'));
const headerSets = {
  '/games/': gamesRoute.headers,
  '/for/pupils/': pupilsRoute.headers,
  '/Games/games.json': manifestRoute.headers,
  '/townlife/': townRoute.headers,
};
const cache = {
  runtimeConsumers: browser.consumers,
  renderer: 'tools/stamp-data.py emits MBM_STAMP; games/index.html and main/index.html own their fetch calls',
  manifestHeaderLifetimeSeconds: maxAge(manifestRoute.headers['Cache-Control']),
  gamesHtmlHeaderLifetimeSeconds: maxAge(gamesRoute.headers['Cache-Control']),
  effectiveManifestLifetimeSeconds: 0,
  reason: 'Both runtime consumers call MBM_STAMP for an unstamped cross-repository URL, which supplies fetch cache:"no-cache" and forces revalidation.',
  verdict: 'CACHE HEADERS OK',
};

const routes = Object.fromEntries([gamesRoute, pupilsRoute, manifestRoute, mirrorRoute, townRoute].map(item => [item.route, {
  finalUrl: item.finalUrl,
  status: item.status,
  contentType: item.contentType,
  headers: item.headers,
  bytes: item.bytes.length,
  sha256: item.sha256,
}]));
const report = { expectedSha, deployment, routes, headerSets, provenance, browser, cache, counts: { canonical: count, gamesCards: browser.games.count, pupilCards: browser.pupils.count } };
fs.mkdirSync(path.join(ROOT, 'artifacts/townlife'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'artifacts/townlife/live.json'), JSON.stringify(report, null, 2) + '\n');
console.log('LIVE_JSON ' + JSON.stringify(report));
for (const [route, headers] of Object.entries(headerSets)) console.log(`HEADERS ${route} ${JSON.stringify(headers)}`);
console.log(`B0 — /games/ and /main/ fetch /Games/games.json at runtime; /for/pupils/ does not; owner: ${cache.renderer}`);
console.log(`B1 — manifest header lifetime ${cache.manifestHeaderLifetimeSeconds}s; /games/ HTML ${cache.gamesHtmlHeaderLifetimeSeconds}s; effective manifest lifetime ${cache.effectiveManifestLifetimeSeconds}s (${cache.reason})`);
console.log(cache.verdict);
console.log(`PUBLICATION GREEN — deployment ${deployment.deploymentId}; Site ${expectedSha}; Games ${canonical.sha}; ${count}+8=${count + 8} cards on both shelves`);
