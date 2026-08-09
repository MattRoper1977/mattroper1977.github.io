import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const SENTINEL = 'mbm-homepage-audience-routing-2026-08-09';
const root = process.cwd();
const base = (process.env.MBM_BASE_URL || process.argv[2] || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const cacheBust = (process.env.MBM_CACHE_BUST || '').trim();
const baseUrl = new URL(base);
const fullEstate = process.env.MBM_FULL_ESTATE === '1' || !['127.0.0.1', 'localhost'].includes(baseUrl.hostname);
const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440];
const config = JSON.parse(fs.readFileSync(path.join(root, 'data/audience-homepages.json'), 'utf8'));
const audiences = Object.entries(config.audiences).map(([id, item]) => ({ id, ...item }));
const expectedLabels = audiences.map(item => item.label);
const expectedRoutes = audiences.map(item => item.route);
const visualFloor = { pupils: 3, teachers: 2, parents: 2, schools: 2, trusts: 2, councils: 2, partners: 2 };
const mainSections = ['audiences', 'resources', 'newrelease', 'homeSports', 'latest', 'collections', 'seeit', 'improved', 'mbmStats', 'standard', 'contact', 'about'];
const results = {
  sentinel: SENTINEL,
  base,
  cacheBust,
  fullEstate,
  widths: [],
  audiences: [],
  preference: null,
  legacy: null,
  themes: null,
  flows: {},
  errors: [],
  fatal: null
};
const out = path.join(root, 'audit-output');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function routeUrl(route) {
  return new URL(route, baseUrl).href;
}
function withCache(url) {
  const u = new URL(url, baseUrl);
  if (cacheBust && u.origin === baseUrl.origin && !u.searchParams.has('mbm')) u.searchParams.set('mbm', cacheBust);
  return u.href;
}
async function prepareContext(context) {
  if (!cacheBust) return;
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === baseUrl.origin && !u.searchParams.has('mbm')) {
      u.searchParams.set('mbm', cacheBust);
      await route.continue({ url: u.href });
      return;
    }
    await route.continue();
  });
}
function bucket(name) {
  return { name, pageErrors: [], consoleErrors: [], failed: [], badResponses: [] };
}
function recordErrors(page, target) {
  page.on('pageerror', error => target.pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') target.consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    try {
      const u = new URL(request.url());
      if (u.origin === baseUrl.origin) target.failed.push({ url: request.url(), error: request.failure()?.errorText || '' });
    } catch {}
  });
  page.on('response', response => {
    try {
      const u = new URL(response.url());
      if (u.origin === baseUrl.origin && response.status() >= 400) target.badResponses.push({ url: response.url(), status: response.status() });
    } catch {}
  });
}
function ensure(ok, message) {
  if (!ok) throw new Error(message);
}
function pathnameOf(url) {
  return new URL(url).pathname.replace(/\/+/g, '/');
}
async function settle(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready || Promise.resolve()).catch(() => {});
  await page.waitForTimeout(180);
}
async function go(page, route, target, { identity, allowRedirect = false } = {}) {
  const response = await page.goto(withCache(routeUrl(route)), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page);
  target.httpStatus = response?.status() || 0;
  target.finalUrl = page.url();
  ensure(target.httpStatus >= 200 && target.httpStatus < 400, `${route} HTTP ${target.httpStatus}`);
  if (!allowRedirect) ensure(pathnameOf(target.finalUrl) === pathnameOf(routeUrl(route)), `${route} unexpectedly ended at ${target.finalUrl}`);
  if (identity) ensure((await page.content()).includes(identity), `${route} missing identity anchor ${identity}`);
  target.title = await page.title();
  target.canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  target.overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(0, Math.max(doc.scrollWidth, body?.scrollWidth || 0) - doc.clientWidth);
  });
  target.h1Count = await page.locator('main h1, body > h1').count();
  ensure(target.overflow <= 1, `${route} horizontal overflow ${target.overflow}px`);
  ensure(target.h1Count === 1, `${route} has ${target.h1Count} H1 elements`);
  return response;
}
async function visibleBox(page, selector) {
  return page.locator(selector).first().evaluate(element => {
    const r = element.getBoundingClientRect();
    const s = getComputedStyle(element);
    return { width: r.width, height: r.height, visible: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' };
  }).catch(() => ({ width: 0, height: 0, visible: false, missing: true }));
}
async function assertImagesDecode(page, selector, label) {
  const count = await page.locator(selector).count();
  ensure(count > 0, `${label}: no images found for ${selector}`);
  await page.locator(selector).evaluateAll(images => Promise.all(images.map(image => image.decode?.().catch(() => null))));
  const bad = await page.locator(selector).evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0).map(image => image.currentSrc || image.src));
  ensure(bad.length === 0, `${label}: image decode failure: ${bad.join(', ')}`);
  return count;
}
async function testMenu(page, width, target, { screenshot } = {}) {
  const menu = await visibleBox(page, '#menu');
  const nav = await visibleBox(page, '#nav');
  target.menu = menu;
  target.nav = nav;
  if (width <= 900) {
    ensure(menu.visible, `menu should be visible at ${width}px`);
    ensure(menu.height >= 43 && menu.width >= 43, `menu touch target is ${menu.width}×${menu.height}px at ${width}px`);
    ensure(!nav.visible, `navigation should start closed at ${width}px`);
    await page.locator('#menu').click();
    ensure(await page.locator('#menu').getAttribute('aria-expanded') === 'true', `menu did not expand at ${width}px`);
    ensure((await visibleBox(page, '#nav')).visible, `expanded navigation is not visible at ${width}px`);
    if (screenshot) await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
    await page.keyboard.press('Escape');
    ensure(await page.locator('#menu').getAttribute('aria-expanded') === 'false', `Escape did not close menu at ${width}px`);
    ensure(await page.evaluate(() => document.activeElement?.id) === 'menu', `focus did not return to menu at ${width}px`);
  } else {
    ensure(!menu.visible, `menu should be hidden at ${width}px`);
    ensure(nav.visible, `desktop navigation should be visible at ${width}px`);
  }
}
async function assertTouchTargets(page, selector, label) {
  const undersized = await page.locator(selector).evaluateAll(elements => elements.filter(element => {
    const r = element.getBoundingClientRect();
    const s = getComputedStyle(element);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && (r.height < 43 || r.width < 43);
  }).map(element => ({ text: (element.textContent || '').trim().slice(0, 60), href: element.getAttribute('href'), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })));
  ensure(undersized.length === 0, `${label}: undersized primary controls ${JSON.stringify(undersized)}`);
}
function clean(target, label) {
  ensure(target.pageErrors.length === 0, `${label}: page errors: ${target.pageErrors.join(' | ')}`);
  ensure(target.consoleErrors.length === 0, `${label}: console errors: ${target.consoleErrors.join(' | ')}`);
  ensure(target.failed.length === 0, `${label}: failed first-party requests: ${JSON.stringify(target.failed)}`);
  ensure(target.badResponses.length === 0, `${label}: first-party HTTP errors: ${JSON.stringify(target.badResponses)}`);
}
async function testRoot(page, width, target) {
  await go(page, '/', target, { identity: SENTINEL });
  ensure(await page.locator('h1').innerText() === 'Choose your own homepage type', `root H1 is incorrect at ${width}px`);
  ensure(target.canonical === 'https://madebymatt.uk/', `root canonical is ${target.canonical}`);
  ensure(await page.locator('.mf-main-card').getAttribute('href') === '/main/', 'root main-homepage option is incorrect');
  target.choiceCount = await page.locator('[data-mbm-face-choice]').count();
  ensure(target.choiceCount === 7, `root has ${target.choiceCount} audience choices at ${width}px`);
  const routes = await page.locator('[data-mbm-face-choice]').evaluateAll(links => links.map(link => link.getAttribute('href')));
  const labels = await page.locator('[data-mbm-face-choice]').evaluateAll(links => links.map(link => link.getAttribute('data-mbm-face-label')));
  ensure(JSON.stringify(routes) === JSON.stringify(expectedRoutes), `root routes differ at ${width}px: ${JSON.stringify(routes)}`);
  ensure(JSON.stringify(labels) === JSON.stringify(expectedLabels), `root labels differ at ${width}px: ${JSON.stringify(labels)}`);
  ensure(await page.locator('#group-people').count() === 1 && await page.locator('#group-organisations').count() === 1, 'root audience grouping is missing');
  await assertImagesDecode(page, '.mf-hero-mark, .mf-main-card-mark', `root ${width}`);
  await assertTouchTargets(page, '.mf-actions a, .mf-main-card, .mf-choice', `root ${width}`);
  await testMenu(page, width, target, { screenshot: width === 390 ? 'root-390-menu-open.png' : undefined });
  if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `root-${width}.png`), fullPage: true });
  clean(target, `root ${width}`);
}
async function testMain(page, width, target) {
  await go(page, '/main/', target, { identity: 'Learning that feels worth exploring.' });
  ensure(target.canonical === 'https://madebymatt.uk/main/', `main canonical is ${target.canonical}`);
  ensure(await page.locator('meta[property="og:url"]').getAttribute('content') === 'https://madebymatt.uk/main/', 'main OpenGraph URL is incorrect');
  ensure(await page.locator('.dx-hero h1').innerText() === 'Learning that feels worth exploring.', 'main identity heading changed');
  const missing = [];
  for (const id of mainSections) if (await page.locator(`#${id}`).count() !== 1) missing.push(id);
  ensure(missing.length === 0, `main is missing preserved sections: ${missing.join(', ')}`);
  ensure(await page.locator('a.brand[href="/main/"]').count() >= 1, 'main brand does not link to /main/');
  ensure(await page.locator('a[href="/"]').filter({ hasText: 'Choose homepage' }).count() >= 1, 'main lacks Choose homepage link');
  await assertImagesDecode(page, '.dx-hero img.mark', `main ${width}`);
  await assertTouchTargets(page, '.dx-cta a', `main ${width}`);
  await testMenu(page, width, target);
  if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `main-${width}.png`), fullPage: true });
  clean(target, `main ${width}`);
}
async function testGames(page, width, target) {
  await go(page, '/games/', target, { identity: 'mbm-games-audience-faces-2026-08-08' });
  await page.waitForFunction(() => document.querySelector('#countline') && !document.querySelector('#countline').textContent.includes('Loading'), null, { timeout: 30000 });
  target.count = (await page.locator('#countline').textContent() || '').trim();
  target.topPicks = await page.locator('#topRail .pick').count();
  ensure(target.topPicks >= 6, `Games has only ${target.topPicks} curated picks at ${width}px`);
  await assertImagesDecode(page, '#topRail .pick img', `Games ${width}`);
  await testMenu(page, width, target);
  if (width === 390 || width === 1440) await page.screenshot({ path: path.join(out, `games-${width}.png`), fullPage: true });
  clean(target, `Games ${width}`);
}
async function runWidth(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width <= 430 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await prepareContext(context);
  const entry = { width, root: bucket('root'), main: bucket('main'), games: bucket('games') };
  try {
    let page = await context.newPage();
    recordErrors(page, entry.root);
    await testRoot(page, width, entry.root);
    await page.close();

    page = await context.newPage();
    recordErrors(page, entry.main);
    await testMain(page, width, entry.main);
    await page.close();

    page = await context.newPage();
    recordErrors(page, entry.games);
    await testGames(page, width, entry.games);
    await page.close();
  } finally {
    await context.close();
  }
  results.widths.push(entry);
}
async function verifyFeatureDestinations(context, page, item, target) {
  const hrefs = await page.locator('.mf-feature .mf-media').evaluateAll(links => links.slice(0, 2).map(link => link.getAttribute('href')));
  target.sampleDestinations = [];
  for (const href of hrefs) {
    ensure(href && href.startsWith('/'), `${item.id}: promoted destination is not first-party: ${href}`);
    const sample = { href, checked: false, status: null };
    if (fullEstate) {
      const response = await context.request.get(withCache(routeUrl(href)), { timeout: 45000 });
      sample.checked = true;
      sample.status = response.status();
      ensure(sample.status >= 200 && sample.status < 400, `${item.id}: promoted destination ${href} returned ${sample.status}`);
    }
    target.sampleDestinations.push(sample);
  }
}
async function testAudience(browser, item, width) {
  const context = await browser.newContext({ viewport: { width, height: width <= 430 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await prepareContext(context);
  const target = bucket(item.id);
  target.id = item.id;
  target.route = item.route;
  target.width = width;
  try {
    const page = await context.newPage();
    recordErrors(page, target);
    await go(page, item.route, target, { identity: SENTINEL });
    ensure(target.canonical === `https://madebymatt.uk${item.route}`, `${item.id}: canonical is ${target.canonical}`);
    const heading = await page.locator('h1').innerText();
    ensure(heading.includes(item.label), `${item.id}: H1 does not contain ${item.label}`);
    ensure(await page.locator('a[href="/main/"]').count() >= 2, `${item.id}: Main homepage route is missing`);
    ensure(await page.locator('a[href="/"]').count() >= 2, `${item.id}: Choose homepage route is missing`);
    ensure(await page.locator(`a[href="${item.route}"][aria-current="page"]`).count() >= 1, `${item.id}: audience homepage lacks aria-current`);
    target.visuals = await page.locator('img[data-mbm-real-visual]').count();
    ensure(target.visuals >= visualFloor[item.id], `${item.id}: ${target.visuals} real visuals, expected at least ${visualFloor[item.id]}`);
    await assertImagesDecode(page, '.mf-hero-mark, img[data-mbm-real-visual]', `${item.id} ${width}`);
    const belowFoldEager = await page.locator('img[data-mbm-real-visual]:not([loading="lazy"])').count();
    ensure(belowFoldEager === 0, `${item.id}: ${belowFoldEager} promoted images are not lazy-loaded`);
    await assertTouchTargets(page, '.mf-actions a, .mf-home-links a, .mf-feature a, .mf-utility', `${item.id} ${width}`);
    await verifyFeatureDestinations(context, page, item, target);
    if (item.id === 'pupils') {
      target.visibleAdultLinks = await page.locator('a[href="/account/"],a[href="/members/"],a[href="/mailing-list/"],a[href^="mailto:"]').evaluateAll(links => links.filter(link => {
        const r = link.getBoundingClientRect();
        const s = getComputedStyle(link);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      }).length);
      ensure(target.visibleAdultLinks === 0, `pupil homepage exposes ${target.visibleAdultLinks} adult account, mailing or contact links`);
      ensure(await page.locator('body').getAttribute('data-mbm-adult-features') === 'off', 'pupil homepage lacks adult-feature boundary');
    } else {
      const adultHrefs = await page.locator('.mf-note-links a').evaluateAll(links => links.map(link => link.getAttribute('href'))).catch(() => []);
      for (const href of ['/account/', '/members/', '/mailing-list/', '/privacy/']) ensure(adultHrefs.includes(href), `${item.id}: adult information section lacks ${href}`);
    }
    await testMenu(page, width, target);
    if ((item.id === 'pupils' || item.id === 'teachers' || item.id === 'trusts') && (width === 390 || width === 1440)) {
      await page.screenshot({ path: path.join(out, `${item.id}-${width}.png`), fullPage: true });
    }
    clean(target, `${item.id} ${width}`);
    await page.close();
  } finally {
    await context.close();
  }
  results.audiences.push(target);
}
async function runPreference(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await prepareContext(context);
  try {
    const page = await context.newPage();
    await go(page, '/for/teachers/', bucket('preference-teacher'), { identity: SENTINEL });
    ensure(await page.evaluate(key => localStorage.getItem(key), config.preferenceKey) === 'teachers', 'teacher homepage did not store the local audience choice');
    await go(page, '/', bucket('preference-root'), { identity: SENTINEL });
    ensure(pathnameOf(page.url()) === '/', `saved preference forced a redirect to ${page.url()}`);
    const selected = page.locator('.mf-choice.is-last');
    const selectedCount = await selected.count();
    const selectedId = selectedCount ? await selected.first().getAttribute('data-mbm-face-choice') : null;
    const continueBox = page.locator('[data-mbm-face-continue]');
    const continueHref = await continueBox.locator('a').getAttribute('href');
    const continueText = await continueBox.locator('a').innerText();
    ensure(selectedCount === 1 && selectedId === 'teachers', `root did not mark the last homepage: count=${selectedCount}, id=${selectedId}`);
    ensure(await continueBox.getAttribute('aria-hidden') === 'false', 'Continue panel is not exposed when a local preference exists');
    ensure(continueHref === '/for/teachers/', `Continue points to ${continueHref}`);
    ensure(continueText === 'Continue with Teachers & education staff', `Continue wording is ${continueText}`);
    await continueBox.locator('[data-mbm-face-clear]').click();
    ensure(await page.evaluate(key => localStorage.getItem(key), config.preferenceKey) === null, 'Forget preference did not clear localStorage');
    ensure(await continueBox.getAttribute('aria-hidden') === 'true', 'Continue panel stayed exposed after forgetting preference');
    results.preference = { key: config.preferenceKey, selectedCount, selectedId, continueHref, continueText, forcedRedirect: false, forgot: true };
  } finally {
    await context.close();
  }
}
async function runTheme(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('mbm_reading_theme', 'blue'));
  await prepareContext(context);
  try {
    const target = bucket('theme-blue');
    const page = await context.newPage();
    recordErrors(page, target);
    await go(page, '/for/teachers/', target, { identity: SENTINEL });
    const themeCount = await page.locator('.mbm-sw').count();
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    const bodyTheme = await page.locator('body').getAttribute('data-theme');
    ensure(themeCount === 5, `expected five reading-background controls, got ${themeCount}`);
    ensure(htmlTheme === 'blue' && bodyTheme === 'blue', `blue theme not applied: html=${htmlTheme}, body=${bodyTheme}`);
    ensure(await page.locator('.mbm-sw[data-t="blue"]').getAttribute('aria-pressed') === 'true', 'blue theme control is not pressed');
    await page.screenshot({ path: path.join(out, 'teachers-390-theme-blue.png'), fullPage: true });
    clean(target, 'blue reading theme');
    results.themes = { themeCount, htmlTheme, bodyTheme, reducedMotion: true };
  } finally {
    await context.close();
  }
}
async function runLegacy(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await prepareContext(context);
  try {
    const target = bucket('legacy-start');
    const page = await context.newPage();
    recordErrors(page, target);
    await go(page, '/start/', target, { allowRedirect: true });
    await page.waitForURL(url => url.pathname === '/', { timeout: 10000 });
    await settle(page);
    ensure(pathnameOf(page.url()) === '/', `/start/ ended at ${page.url()}`);
    ensure(await page.locator('h1').innerText() === 'Choose your own homepage type', '/start/ did not reach the chooser');
    ensure(await page.locator('link[rel="canonical"]').getAttribute('href') === 'https://madebymatt.uk/', 'legacy destination canonical is not root');
    clean(target, 'legacy /start/');
    results.legacy = { initialStatus: target.httpStatus, finalUrl: page.url(), finalPath: pathnameOf(page.url()), canonical: 'https://madebymatt.uk/' };
  } finally {
    await context.close();
  }
}
async function clickAndPath(page, selector, expectedPath, label) {
  await Promise.all([
    page.waitForURL(url => url.pathname === expectedPath, { timeout: 45000 }),
    page.locator(selector).first().click()
  ]);
  await settle(page);
  ensure(pathnameOf(page.url()) === expectedPath, `${label} ended at ${page.url()}`);
}
async function runFlowA(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await prepareContext(context);
  const page = await context.newPage();
  try {
    await go(page, '/', bucket('flow-a-root'), { identity: SENTINEL });
    await clickAndPath(page, '.mf-main-card', '/main/', 'Flow A root → main');
    await clickAndPath(page, 'a[href="/"] >> text="Choose homepage"', '/', 'Flow A main → chooser');
    await clickAndPath(page, '[data-mbm-face-choice="pupils"]', '/for/pupils/', 'Flow A chooser → pupils');
    results.flows.A = { passed: true, finalPath: pathnameOf(page.url()) };
  } finally {
    await context.close();
  }
}
async function runFlowB(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await prepareContext(context);
  const page = await context.newPage();
  try {
    await go(page, '/for/pupils/', bucket('flow-b-pupils'), { identity: SENTINEL });
    await clickAndPath(page, '.mf-feature[data-feature-id="apex-kick"] .mf-media', '/apexkick/', 'Flow B featured game');
    await page.goto(withCache(routeUrl('/for/pupils/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    await clickAndPath(page, 'nav a[href="/games/"]', '/games/', 'Flow B Games');
    await clickAndPath(page, 'a.brand[href="/main/"]', '/main/', 'Flow B Games → main');
    await clickAndPath(page, 'a[href="/"] >> text="Choose homepage"', '/', 'Flow B main → chooser');
    results.flows.B = { passed: true, finalPath: pathnameOf(page.url()), game: '/apexkick/' };
  } finally {
    await context.close();
  }
}
async function runFlowC(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  await prepareContext(context);
  const page = await context.newPage();
  try {
    await go(page, '/for/teachers/', bucket('flow-c-teacher'), { identity: SENTINEL });
    ensure(await page.locator('nav a[href="/Lessons/"]').count() === 1, 'Flow C teacher nav lacks Lessons');
    if (fullEstate) await clickAndPath(page, 'nav a[href="/Lessons/"]', '/Lessons/', 'Flow C Lessons');
    await page.goto(withCache(routeUrl('/for/teachers/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    await clickAndPath(page, 'nav a[href="/tools/"]', '/tools/', 'Flow C teacher tools');
    await page.goto(withCache(routeUrl('/for/teachers/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    await clickAndPath(page, '.mf-note-links a[href="/account/"]', '/account/', 'Flow C Account');
    ensure(await page.locator('#loginForm').count() === 1 && await page.locator('#registerForm').count() === 1, 'Flow C account login/signup UI is missing');
    await page.goto(withCache(routeUrl('/members/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    ensure(pathnameOf(page.url()) === '/members/', 'Flow C Members did not load');
    await page.goto(withCache(routeUrl('/for/teachers/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    results.flows.C = { passed: true, lessonsClicked: fullEstate, tools: '/tools/', accountUi: true, members: true, finalPath: pathnameOf(page.url()) };
  } finally {
    await context.close();
  }
}
async function runFlowD(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await prepareContext(context);
  const page = await context.newPage();
  try {
    await go(page, '/for/parents-carers/', bucket('flow-d-parent'), { identity: SENTINEL });
    await clickAndPath(page, 'nav a[href="/games/"]', '/games/', 'Flow D Games');
    await page.goto(withCache(routeUrl('/for/parents-carers/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    await clickAndPath(page, 'nav a[href="/resources/"]', '/resources/', 'Flow D Resources');
    await page.goto(withCache(routeUrl('/for/parents-carers/')), { waitUntil: 'domcontentloaded' });
    await settle(page);
    await clickAndPath(page, 'nav a[href="/privacy/"]', '/privacy/', 'Flow D Privacy');
    await clickAndPath(page, 'a.brand[href="/main/"]', '/main/', 'Flow D Privacy → main');
    results.flows.D = { passed: true, finalPath: pathnameOf(page.url()) };
  } finally {
    await context.close();
  }
}
async function runFlowE(browser) {
  const professionalIds = ['schools', 'trusts', 'councils', 'partners'];
  const checked = [];
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  await prepareContext(context);
  try {
    const page = await context.newPage();
    for (const id of professionalIds) {
      const item = audiences.find(candidate => candidate.id === id);
      await go(page, item.route, bucket(`flow-e-${id}`), { identity: SENTINEL });
      const sections = await page.locator('.mf-section .mf-section-head').count();
      const visuals = await page.locator('img[data-mbm-real-visual]').count();
      ensure(sections >= 2, `Flow E ${id} has only ${sections} promised-content sections`);
      ensure(visuals >= visualFloor[id], `Flow E ${id} visual floor failed`);
      const hrefs = await page.locator('.mf-feature .mf-media').evaluateAll(links => links.slice(0, 2).map(link => link.getAttribute('href')));
      const destinations = [];
      for (const href of hrefs) {
        const record = { href, status: null };
        if (fullEstate) {
          const response = await context.request.get(withCache(routeUrl(href)), { timeout: 45000 });
          record.status = response.status();
          ensure(record.status >= 200 && record.status < 400, `Flow E ${id} destination ${href} returned ${record.status}`);
        }
        destinations.push(record);
      }
      checked.push({ id, route: item.route, sections, visuals, destinations });
    }
    results.flows.E = { passed: true, checked };
  } finally {
    await context.close();
  }
}
async function runFlowF(browser) {
  ensure(results.legacy?.finalPath === '/', 'Flow F legacy proof was not recorded');
  results.flows.F = { passed: true, from: '/start/', to: '/' };
}
async function runFlowG(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  await prepareContext(context);
  const page = await context.newPage();
  try {
    await go(page, '/main/', bucket('flow-g-main'), { identity: 'Learning that feels worth exploring.' });
    await clickAndPath(page, 'a[href="/account/"]', '/account/', 'Flow G Account');
    ensure(await page.locator('#loginTab').innerText() === 'Log in', 'Flow G login tab is missing');
    ensure(await page.locator('#registerTab').innerText() === 'Create account', 'Flow G signup tab is missing');
    ensure(await page.locator('#forgotBtn').count() === 1 && await page.locator('#resetForm').count() === 1, 'Flow G password-reset UI is missing');
    const callbacks = ['/account/?type=recovery', '/account/?code=browser-proof'];
    for (const callback of callbacks) {
      const response = await context.request.get(withCache(routeUrl(callback)), { timeout: 45000 });
      ensure(response.status() >= 200 && response.status() < 400, `Flow G callback ${callback} returned ${response.status()}`);
    }
    results.flows.G = { passed: true, login: true, signup: true, reset: true, callbackRoutes: callbacks };
  } finally {
    await context.close();
  }
}
async function runFlows(browser) {
  await runFlowA(browser);
  await runFlowB(browser);
  await runFlowC(browser);
  await runFlowD(browser);
  await runFlowE(browser);
  await runFlowF(browser);
  await runFlowG(browser);
}

let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.MBM_CHROMIUM_EXECUTABLE || undefined });
  for (const width of widths) await runWidth(browser, width);
  for (const item of audiences) {
    await testAudience(browser, item, 390);
    await testAudience(browser, item, 1440);
  }
  await runPreference(browser);
  await runTheme(browser);
  await runLegacy(browser);
  await runFlows(browser);
  console.log(`[PASS] Homepage architecture browser proof: ${widths.length} widths, ${audiences.length} audience homepages at mobile and desktop, themes, legacy, preference and flows A–G`);
} catch (error) {
  results.fatal = String(error?.stack || error);
  results.errors.push(String(error?.message || error));
  console.error('[FAIL]', error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(results, null, 2) + '\n');
}
