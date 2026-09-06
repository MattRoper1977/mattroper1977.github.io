#!/usr/bin/env node
'use strict';

// Exercise assembled publications with the existing CI Playwright runtime.
// Canonical domain navigations are fulfilled from the corresponding local
// publication, so clicks retain their real URLs without contacting live games.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const education = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const play = new URL(process.env.MBM_PLAY_ORIGIN || 'http://127.0.0.1:4174').origin;
const siteRoot = path.resolve(process.env.MBM_DISCOVERY_SITE || path.join(__dirname, '..'));
const out = path.resolve(process.env.MBM_HOME_PLAY_OUTPUT || 'audit-output/home-play-discovery');
const canonicalEducation = 'https://madebymatt.uk';
const canonicalPlay = 'https://www.madebymatt-play.uk';
const audienceRoutes = ['/for/parents-carers/', '/for/schools-semh/', '/for/trusts/', '/for/councils-organisations/', '/for/partners/', '/for/governors-trustees/'];
// Independent expected destinations/media, not imported from the builder.
const featured = [
  { title: 'Apex Kick', route: '/apexkick/', poster: 'poster-apexkick.webp', clip: 'clip-apexkick.mp4', seconds: 18 },
  { title: 'Voxel Frontier', route: '/voxel/', poster: 'poster-voxelfrontier-play.webp', clip: 'clip-voxelfrontier-play.mp4', seconds: 13 },
  { title: 'Off-Brand', route: '/offbrand/', poster: 'poster-offbrand.webp', clip: 'clip-offbrand.mp4', seconds: 17 },
];
const report = { schema: 1, education, play, startedAt: new Date().toISOString(), cases: [], pageErrors: [], canonicalNavigations: [] };
fs.mkdirSync(out, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const url = (route, source = education) => new URL(route, source).href;
const errorText = error => error.stack || String(error);
async function check(name, action, page) {
  const row = { name, ok: false }; report.cases.push(row);
  try { row.evidence = await action(); row.ok = true; }
  catch (error) { row.error = errorText(error); if (page && !page.isClosed()) try { row.screenshot = await shot(page, 'FAIL-' + name); } catch (_) {} }
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name}${row.error ? ': ' + row.error.split('\n')[0] : ''}`);
}
async function shot(page, name, locator) {
  const filename = name + '.png';
  await (locator || page).screenshot({ path: path.join(out, filename), animations: 'disabled' });
  return filename;
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function target(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { width: r.width, height: r.height, left: r.left, right: r.right, viewport: innerWidth, clear: hit === el || el.contains(hit) };
  });
  assert(box.width >= 43.5 && box.height >= 43.5, 'Small target: ' + JSON.stringify(box));
  assert(box.left >= -.5 && box.right <= box.viewport + .5 && box.clear, 'Clipped or obscured target: ' + JSON.stringify(box));
  return box;
}
async function noOverflow(page) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow'); }
async function goto(page, route, source = education) {
  const response = await page.goto(url(route, source), { waitUntil: 'domcontentloaded' });
  assert.equal(response && response.status(), 200, route + ' must return HTTP 200');
  await settle(page);
}
async function mappedContext(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  await context.route(/^https:\/\/(?:www\.)?madebymatt(?:-play)?\.uk\//, async route => {
    const request = route.request(), original = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort('blockedbyclient');
    const isPlay = /madebymatt-play\.uk$/.test(original.hostname);
    const local = new URL(original.pathname + original.search, isPlay ? play : education);
    if (request.isNavigationRequest()) report.canonicalNavigations.push({ requested: original.href, mounted: local.href });
    const response = await context.request.fetch(local.href, { method: request.method(), failOnStatusCode: false });
    await route.fulfill({ response });
  });
  return context;
}
function watch(page) {
  const requests = [];
  page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
  page.on('pageerror', error => report.pageErrors.push({ url: page.url(), message: error.message }));
  return requests;
}
async function showcase(page, selector, requests, start) {
  const root = page.locator(selector);
  await root.scrollIntoViewIfNeeded();
  assert(await root.isVisible(), 'Play showcase is hidden');
  assert.equal(await root.locator('.mbm-play-card').count(), 3);
  assert.equal(await root.locator('video').count(), 3);
  const cards = [];
  for (const game of featured) {
    const card = root.locator('.mbm-play-card').filter({ has: page.getByRole('heading', { name: game.title, exact: true }) });
    assert.equal(await card.count(), 1, 'Missing featured game ' + game.title);
    const video = card.locator('video');
    await video.scrollIntoViewIfNeeded(); await settle(page);
    const state = await video.evaluate(el => ({ controls: el.controls, paused: el.paused, autoplay: el.autoplay, loop: el.loop, preload: el.preload, playsInline: el.playsInline, poster: el.getAttribute('poster'), name: el.getAttribute('aria-label'), time: el.currentTime }));
    assert(state.controls && state.paused && !state.autoplay && !state.loop && state.preload === 'none' && state.playsInline && state.time === 0, JSON.stringify(state));
    assert.equal(state.poster, '/assets/video/' + game.poster);
    assert.match(state.name, /gameplay preview, silent$/);
    assert.equal(await video.locator('source').getAttribute('src'), '/assets/video/' + game.clip);
    assert.match(await card.locator('figcaption').innerText(), new RegExp('^' + game.seconds + '-second silent preview\\.'));
    const button = card.getByRole('link', { name: 'Play ' + game.title, exact: true });
    assert.equal(await button.getAttribute('href'), canonicalPlay + game.route);
    await target(button);
    cards.push({ game: game.title, route: canonicalPlay + game.route, manualPreview: state });
  }
  const explorer = root.getByRole('link', { name: 'Explore Made by Matt Play', exact: true });
  assert.equal(await explorer.getAttribute('href'), canonicalPlay + '/'); await target(explorer);
  await page.waitForTimeout(250);
  const beforeSelection = requests.slice(start);
  assert(!beforeSelection.some(r => new URL(r.url).hostname.endsWith('madebymatt-play.uk')), 'Education automatically requested the games domain');
  assert(!beforeSelection.some(r => featured.some(g => new URL(r.url).pathname === '/assets/video/' + g.clip)), 'Preview fetched before selection despite preload=none');
  assert.equal(await root.locator('iframe').count(), 0, 'Showcase embeds a live game');
  await noOverflow(page);
  return { cards, requestsBeforeSelection: beforeSelection.length, automaticGameRequests: 0, automaticClipRequests: 0 };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const api = await browser.newContext();
    await check('existing-media-bytes-and-working-destinations', async () => {
      const media = [];
      for (const game of featured) {
        assert.equal((await api.request.get(url(game.route, play))).status(), 200, game.route);
        for (const name of [game.poster, game.clip]) {
          const response = await api.request.get(url('/assets/video/' + name));
          assert.equal(response.status(), 200, name);
          const published = await response.body(), source = fs.readFileSync(path.join(siteRoot, 'assets/video', name));
          assert.equal(sha(published), sha(source), 'Showcase media differs from the real existing asset: ' + name);
          media.push({ route: '/assets/video/' + name, bytes: source.length, sha256: sha(source) });
        }
      }
      for (const route of [...audienceRoutes, '/Lessons/primary/']) assert.equal((await api.request.get(url(route))).status(), 200, route);
      return { media, featuredDestinations: 3, audienceDestinations: 6, primaryDestination: true };
    });
    await api.close();
    for (const width of [390, 1280]) {
      const context = await mappedContext(browser, width), page = await context.newPage();
      page.setDefaultTimeout(15000); const requests = watch(page);
      for (const home of ['/', '/main/']) await check(`${width}-${home === '/' ? 'home' : 'main'}-audiences-primary-and-play`, async () => {
        const start = requests.length; await goto(page, home);
        const nav = page.getByRole('navigation', { name: 'Explore Made by Matt', exact: true });
        for (const [name, href] of [['Primary', '/Lessons/primary/'], ['Families & organisations', '/#audiences'], ['Made by Matt Play', canonicalPlay + '/']]) {
          const link = nav.getByRole('link', { name, exact: true }); assert.equal(await link.getAttribute('href'), href); await target(link);
        }
        await noOverflow(page);
        const prefix = `${width}-${home === '/' ? 'home' : 'main'}`;
        const entry = await shot(page, prefix + '-entrances');
        await page.locator('#audiences').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#audiences .mbm-audience-card').count(), 6);
        for (const route of audienceRoutes) await target(page.locator(`#audiences a[href="${route}"]`));
        const audiences = await shot(page, prefix + '-audiences', page.locator('#audiences'));
        const details = await showcase(page, '#made-by-matt-play', requests, start);
        const preview = await shot(page, prefix + '-showcase', page.locator('#made-by-matt-play'));
        // Inspect each assembled home before the /#audiences shortcut leaves
        // /main/. Then exercise the actual shared-navigation destination.
        await nav.getByRole('link', { name: 'Families & organisations', exact: true }).click();
        await page.waitForURL(url('/#audiences'));
        assert(await page.locator('#audiences').isVisible());
        return { inspectedRoute: home, audienceShortcut: page.url(), audiences: audienceRoutes, primary: '/Lessons/primary/', ...details, screenshots: [entry, audiences, preview] };
      }, page);
      await check(`${width}-parents-showcase`, async () => {
        const start = requests.length; await goto(page, '/for/parents-carers/');
        const result = await showcase(page, '#audience-play-showcase', requests, start);
        return { ...result, screenshot: await shot(page, `${width}-parents-showcase`, page.locator('#audience-play-showcase')) };
      }, page);
      await check(`${width}-teacher-and-pupil-explore-links`, async () => {
        for (const route of ['/for/teachers/', '/for/pupils/']) {
          await goto(page, route);
          const nav = page.getByRole('navigation', { name: 'Explore Made by Matt', exact: true });
          await target(nav.getByRole('link', { name: 'Primary', exact: true }));
          await target(nav.getByRole('link', { name: 'Families & organisations', exact: true }));
          const playLink = nav.getByRole('link', { name: 'Made by Matt Play', exact: true });
          assert.equal(await playLink.getAttribute('href'), canonicalPlay + '/'); await target(playLink); await noOverflow(page);
        }
        return { routes: ['/for/teachers/', '/for/pupils/'], visibleEntrances: ['Primary', 'Families & organisations', 'Made by Matt Play'] };
      }, page);
      await check(`${width}-native-preview-control`, async () => {
        await goto(page, '/');
        const video = page.locator('#made-by-matt-play video').first();
        await video.scrollIntoViewIfNeeded(); assert(await video.evaluate(el => el.paused && el.currentTime === 0));
        const start = requests.length, box = await video.boundingBox();
        assert(box && box.width > 100 && box.height > 100);
        // The native play button sits above the seek track in this pinned Chromium.
        // Select the visible control; do not substitute a synthetic play() call.
        await video.click({ position: { x: 24, y: box.height - 48 } });
        await page.waitForFunction(() => { const v = document.querySelector('#made-by-matt-play video'); return !!v && !v.paused && v.currentTime > 0; }, null, { timeout: 15000 });
        const media = await video.evaluate(el => ({ seconds: el.duration, currentTime: el.currentTime, paused: el.paused, controls: el.controls }));
        assert(Math.abs(media.seconds - featured[0].seconds) <= 1.5, 'Unexpected real preview duration');
        assert(requests.slice(start).some(r => new URL(r.url).pathname === '/assets/video/' + featured[0].clip), 'Selecting play did not load the real clip');
        assert(!requests.slice(start).some(r => new URL(r.url).hostname.endsWith('madebymatt-play.uk')), 'Preview started a game');
        const screenshot = await shot(page, `${width}-selected-preview`, page.locator('#made-by-matt-play .mbm-play-card').first());
        await goto(page, '/'); // stop playback by leaving the page
        return { nativeControl: true, media, screenshot };
      }, page);
      await check(`${width}-canonical-play-roundtrip`, async () => {
        await goto(page, '/');
        const link = page.locator('#made-by-matt-play').getByRole('link', { name: 'Explore Made by Matt Play', exact: true });
        await target(link);
        await Promise.all([page.waitForURL(canonicalPlay + '/'), link.click()]); await settle(page);
        assert.equal(page.url(), canonicalPlay + '/');
        const educationLink = page.locator('a.education-return[href="https://madebymatt.uk/"]').first();
        assert(await educationLink.count(), 'Play shelf has no explicit return to Education');
        // Mobile shelf navigation is allowed to use its existing menu button.
        if (!await educationLink.isVisible()) {
          const menus = page.getByRole('button', { name: /menu/i });
          if (await menus.count()) await menus.first().click();
        }
        await target(educationLink); await noOverflow(page);
        const screenshot = await shot(page, `${width}-play-education-return`);
        await Promise.all([page.waitForURL(canonicalEducation + '/'), educationLink.click()]); await settle(page);
        assert.equal(page.url(), canonicalEducation + '/');
        assert(await page.locator('#audiences').count());
        return { outbound: canonicalPlay + '/', returned: canonicalEducation + '/', screenshot };
      }, page);
      await context.close();
    }
    await check('no-browser-errors', async () => { assert.deepEqual(report.pageErrors, []); return { pageErrors: 0 }; });
  } finally {
    report.completedAt = new Date().toISOString();
    report.ok = report.cases.length === 14 && report.cases.every(row => row.ok) && report.pageErrors.length === 0;
    fs.writeFileSync(path.join(out, 'home-play-discovery.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close(); if (!report.ok) process.exitCode = 1;
  }
})().catch(error => { report.fatal = errorText(error); fs.writeFileSync(path.join(out, 'home-play-discovery.json'), JSON.stringify(report, null, 2) + '\n'); console.error(error); process.exitCode = 1; });
