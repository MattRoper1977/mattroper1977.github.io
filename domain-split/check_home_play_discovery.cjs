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
async function educationOnly(page, requests, start) {
  assert.equal(await page.locator('.mbm-play-showcase, .mbm-play-card, [data-play-resource]').count(), 0);
  assert.equal(await page.locator('video, iframe').count(), 0);
  assert(!/Apex Kick|Voxel Frontier|Off-Brand|Medevac Frontier/i.test(await page.locator('main').innerText()));
  assert(!requests.slice(start).some(r => new URL(r.url).hostname.endsWith('madebymatt-play.uk')), 'Education automatically requested Play');
  await noOverflow(page);
  return { recreationalPromotions: 0, recreationalMedia: 0, automaticPlayRequests: 0 };
}

(async () => {
  // Preserve the original H.264 footage. The runner's Google Chrome includes
  // its media codecs; record the bundled headless browser's capability too.
  const bundled = await chromium.launch({ headless: true });
  try {
    const probe = await bundled.newPage();
    report.bundledH264 = await probe.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.64001f"'));
  } finally { await bundled.close(); }
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  report.browser = { channel: 'chrome', version: browser.version() };
  try {
    const api = await browser.newContext();
    await check('existing-media-bytes-and-working-destinations', async () => {
      const media = [];
      for (const game of featured) {
        assert.equal((await api.request.get(url(game.route, play))).status(), 200, game.route);
        for (const name of [game.poster, game.clip]) {
          const response = await api.request.get(url('/assets/video/' + name, play));
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
    for (const width of [320, 390, 1280]) {
      const context = await mappedContext(browser, width), page = await context.newPage();
      page.setDefaultTimeout(15000); const requests = watch(page);
      for (const home of ['/', '/main/']) await check(`${width}-${home === '/' ? 'home' : 'main'}-audiences-primary-and-play`, async () => {
        // UX2 B2: the homepage is Appendix A §HOME. Primary lessons and Play are
        // menu rows, Play is also the footer's last link, and the audience routes
        // are the "Here for someone else?" rows (#audiences) read from the record.
        const start = requests.length; await goto(page, home);
        assert.equal(await page.locator('.mbm-explore-nav').count(), 0, 'No explore bar on the homepage');
        const menu = page.locator('.mbm-unified-menu > summary'); await menu.click();
        for (const [name, href] of [['Primary lessons', '/Lessons/primary/'], ['Made by Matt Play ↗', canonicalPlay + '/']]) {
          const link = page.locator('#mbm-navigation-panel').getByRole('link', { name, exact: true }); assert.equal(await link.getAttribute('href'), href); await target(link);
        }
        await page.keyboard.press('Escape');
        const footerPlay = page.locator('footer').getByRole('link', { name: 'Made by Matt Play ↗', exact: true });
        assert.equal(await footerPlay.getAttribute('href'), canonicalPlay + '/'); await target(footerPlay);
        await noOverflow(page);
        const prefix = `${width}-${home === '/' ? 'home' : 'main'}`;
        const entry = await shot(page, prefix + '-entrances');
        await page.locator('#audiences').scrollIntoViewIfNeeded();
        const record = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/audience-homepages.json'), 'utf8')).audiences;
        const expectedRows = Object.values(record).filter(a => a.route !== record.teachers.route && a.route !== record.pupils.route).map(a => [a.route, a.label]);
        expectedRows.push(['/for/governors-trustees/', 'Governors & trustees']);
        const rows = await page.locator('#audiences .audience-row').evaluateAll(nodes => nodes.map(a => [a.getAttribute('href'), a.textContent.replace(/\s*→\s*$/, '').trim()]));
        assert.deepEqual(rows, expectedRows, 'One row per audience route except teachers and pupils, label and order from the record');
        for (const route of audienceRoutes) await target(page.locator(`#audiences a[href="${route}"]`));
        const audiences = await shot(page, prefix + '-audiences', page.locator('#audiences'));
        const details = await educationOnly(page, requests, start);
        await page.goto(url('/#audiences'));
        assert(await page.locator('#audiences').isVisible(), 'The /#audiences anchor other pages link still resolves');
        return { inspectedRoute: home, audienceShortcut: page.url(), audiences: audienceRoutes, primary: '/Lessons/primary/', ...details, screenshots: [entry, audiences] };
      }, page);
      await check(`${width}-parents-education-only`, async () => {
        const start = requests.length; await goto(page, '/for/parents-carers/');
        const result = await educationOnly(page, requests, start);
        const external = page.locator('.mbm-external-play a'); assert.equal(await external.getAttribute('href'), canonicalPlay+'/');
        return { ...result, screenshot: await shot(page, `${width}-parents-education-only`) };
      }, page);
      await check(`${width}-education-search-excludes-recreational-games`, async () => {
        const evidence=[];
        for(const [route,input,cards] of [['/resources/','#rxSearch','#rxOut .rx-cardx'],['/Matt-s-Apps-/','#search','#groups .card']]){
          await goto(page,route);
          await page.locator(cards).first().waitFor({state:'visible'});
          for(const query of ['Apex Kick','Voxel','Off-Brand','Medevac']){
            await page.locator(input).fill(query);
            await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].every(el=>!el.getClientRects().length),cards);
            assert.equal(await page.locator(cards+':visible').count(),0);
            evidence.push({route,query,results:0});
          }
          await page.locator(input).fill('PDF');
          await page.locator(cards+':visible').first().waitFor({state:'visible'});
          assert((await page.locator(cards+':visible').first().innerText()).includes('PDF'),'Positive educational search control missing');
        }
        return evidence;
      }, page);
      await check(`${width}-teacher-and-pupil-explore-links`, async () => {
        // UX2 B3: the teacher and pupil pages are Appendix A — Primary lessons and Play are
        // menu rows (the pupil subset keeps both), Play is the footer's last link, and the
        // audience routes are the homepage's "Here for someone else?" rows.
        for (const route of ['/for/teachers/', '/for/pupils/']) {
          await goto(page, route);
          assert.equal(await page.locator('.mbm-explore-nav').count(), 0, 'No explore bar on ' + route);
          await page.locator('.mbm-unified-menu > summary').click();
          const panel = page.locator('#mbm-navigation-panel');
          await target(panel.getByRole('link', { name: 'Primary lessons', exact: true }));
          const menuPlay = panel.getByRole('link', { name: 'Made by Matt Play ↗', exact: true });
          assert.equal(await menuPlay.getAttribute('href'), canonicalPlay + '/'); await target(menuPlay);
          await page.keyboard.press('Escape');
          const playLink = page.locator('footer').getByRole('link', { name: 'Made by Matt Play ↗', exact: true });
          assert.equal(await playLink.getAttribute('href'), canonicalPlay + '/'); await target(playLink); await noOverflow(page);
          assert.equal((await page.request.get(url('/#audiences'))).status(), 200);
        }
        return { routes: ['/for/teachers/', '/for/pupils/'], visibleEntrances: ['Primary', 'Families & organisations', 'Made by Matt Play'] };
      }, page);
      await check(`${width}-preserved-play-media-native-control-fixture`, async () => {
        // The former Education preview UI is intentionally absent. Preserve
        // independent codec/manual-control coverage against unchanged Play bytes.
        // This temporary browser fixture is not a published page or gameplay.
        await page.route(url('/__media-acceptance/', play), route => route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Media regression fixture</title><video controls playsinline preload="none" style="width:100%" poster="/assets/video/poster-apexkick.webp"><source src="/assets/video/clip-apexkick.mp4" type="video/mp4"></video></html>'}));
        await goto(page, '/__media-acceptance/', play);
        const video=page.locator('video');
        assert(await video.evaluate(el=>el.paused && el.currentTime===0 && !el.autoplay && el.preload==='none'));
        const codec=await video.evaluate(el=>el.canPlayType('video/mp4; codecs="avc1.64001f"'));assert(codec);
        const box=await video.boundingBox();assert(box && box.width>100);
        await video.click({position:{x:24,y:box.height-48}});
        await page.waitForFunction(()=>{const v=document.querySelector('video');return v && !v.paused && v.currentTime>0;});
        const media=await video.evaluate(el=>({seconds:el.duration,currentTime:el.currentTime}));assert(Math.abs(media.seconds-featured[0].seconds)<=1.5);
        await goto(page,'/');return {fixtureOnly:true,publishedPlayMedia:true,codec,media};
      }, page);
      await check(`${width}-canonical-play-roundtrip`, async () => {
        await goto(page, '/');
        const link = page.locator('footer').getByRole('link', {name:'Made by Matt Play ↗',exact:true});
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
    report.ok = report.cases.length === 23 && report.cases.every(row => row.ok) && report.pageErrors.length === 0;
    fs.writeFileSync(path.join(out, 'home-play-discovery.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close(); if (!report.ok) process.exitCode = 1;
  }
})().catch(error => { report.fatal = errorText(error); fs.writeFileSync(path.join(out, 'home-play-discovery.json'), JSON.stringify(report, null, 2) + '\n'); console.error(error); process.exitCode = 1; });
