#!/usr/bin/env node
'use strict';

// Exercise the assembled education publication; never inject UI or rebuild data.
// MBM_DISCOVERY_LESSONS/APPS name the exact source checkouts mounted by CI.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const siteRoot = path.resolve(process.env.MBM_DISCOVERY_SITE || path.join(__dirname, '..'));
const lessonsRoot = path.resolve(process.env.MBM_DISCOVERY_LESSONS || path.join(siteRoot, '.sources/Lessons'));
const appsRoot = path.resolve(process.env.MBM_DISCOVERY_APPS || path.join(siteRoot, '.sources/Apps'));
const out = path.resolve(process.env.MBM_DISCOVERY_OUTPUT || 'audit-output/resource-discovery');
const report = { schema: 1, origin, startedAt: new Date().toISOString(), cases: [], pageErrors: [], destinations: [], external: [], absentFromSource: [], fatal: null };
const PDF = '/Matt-s-Apps-/PDF_Studio.html';
// UX2 B2: the homepage's learning areas are its "Three places, one site" cards and the
// menu's Learning group; the collection bar stays on the three catalogue hubs.
const hubs = ['/resources/', '/tools/', '/Matt-s-Apps-/'];
const homes = ['/', '/main/'];
const widths = [320, 390, 1280];
const collectionNav = 'nav.collection-nav[aria-label="Learning areas"]';
const resourceCards = '#rxOut .rx-cardx a[href]';
const appsCards = '#groups .card a[href]';
const excludedGameRoutes = new Set();
const educationOverrides = new Set();
const sourceJSON = (root, name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const errorText = e => e?.stack || e?.message || String(e);
const urlFor = route => new URL(route, origin).href;
fs.mkdirSync(out, { recursive: true });

function routeOf(value, base = '/') {
  const url = new URL(value, urlFor(base));
  if (![new URL(origin).host, 'madebymatt.uk', 'www.madebymatt.uk'].includes(url.host)) return null;
  return decodeURI(url.pathname).replace(/index\.html$/, '').replace(/\/$/, '') || '/';
}
function sourceFile(route) {
  let root = siteRoot, relative = route;
  if (route === '/Lessons' || route.startsWith('/Lessons/')) { root = lessonsRoot; relative = route.slice(8); }
  if (route === '/Matt-s-Apps-' || route.startsWith('/Matt-s-Apps-/')) { root = appsRoot; relative = route.slice(13); }
  const file = path.resolve(root, '.' + (relative || '/'));
  assert(file === root || file.startsWith(root + path.sep), `Unsafe catalogue route: ${route}`);
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).isFile()) return file;
  return fs.existsSync(path.join(file, 'index.html')) ? path.join(file, 'index.html') : null;
}
function addExpected(map, value, base, label, kind) {
  if (!value) return;
  const route = routeOf(value, base);
  if (route === null) { report.external.push({ label, href: value, kind }); return; }
  if (route === '/games' || route.startsWith('/games/') || excludedGameRoutes.has(route)) return;
  const original = sourceFile(route);
  if (!original) { report.absentFromSource.push({ label, route, kind }); return; }
  const previous = map.get(route);
  if (previous) previous.sources.push({ label, kind });
  else map.set(route, { route, sourceFile: path.relative(siteRoot, original), sources: [{ label, kind }], hub: kind === 'hub' });
}
function expectedDestinations() {
  const map = new Map();
  // Read the already-reviewed audience boundary as data, without running the
  // builder or sharing its catalogue-rendering/reachability implementation.
  const overrides = JSON.parse(execFileSync('python', ['-c', 'import ast,json,sys; t=ast.parse(open(sys.argv[1]).read()); print(json.dumps(next(ast.literal_eval(n.value) for n in t.body if isinstance(n,ast.Assign) and any(isinstance(x,ast.Name) and x.id=="EDUCATION_OVERRIDES" for x in n.targets))))', path.join(siteRoot, 'domain-split/build_preview.py')], { encoding: 'utf8' }));
  for (const route of Object.keys(overrides)) educationOverrides.add(routeOf(route));
  for (const route of ['/experiences/medevac-frontier/','/resources/medevac-frontier/']) excludedGameRoutes.add(routeOf(route));
  const old = sourceJSON(siteRoot, 'data/mbm-search-index.json').entries;
  for (const row of old) if (row.category === 'game' && !educationOverrides.has(routeOf(row.route))) excludedGameRoutes.add(routeOf(row.route));
  for (const row of old) {
    if (row.category !== 'game' || educationOverrides.has(routeOf(row.route))) addExpected(map, row.route, '/', row.title, row.category === 'page' ? 'hub' : 'old-' + row.category);
  }
  for (const row of sourceJSON(lessonsRoot, 'resources.json')) {
    if ((String(row.type).toLowerCase() !== 'game' || educationOverrides.has(routeOf(row.file || row.url, '/Lessons/'))) && row.subject !== 'Live Lessons') addExpected(map, row.file || row.url, '/Lessons/', row.title, 'lesson-source');
  }
  for (const row of sourceJSON(siteRoot, 'data/resources.json')) {
    if (!/^game$/i.test(row.type || '') && row.subject !== 'Live Lessons') addExpected(map, row.path, '/', row.title, 'site-source');
  }
  for (const group of sourceJSON(appsRoot, 'apps.json').spaces) {
    for (const row of group.items) addExpected(map, row.f, '/Matt-s-Apps-/', row.n, 'app-source');
  }
  return map;
}
async function shot(page, name, fullPage = false) {
  const filename = name.replace(/[^a-zA-Z0-9._-]/g, '-') + '.png';
  await page.screenshot({ path: path.join(out, filename), fullPage, animations: 'disabled' });
  return filename;
}
async function check(name, page, action) {
  const row = { name, ok: false }; report.cases.push(row);
  try { row.evidence = await action(); row.ok = true; }
  catch (e) { row.error = errorText(e); if (page && !page.isClosed()) try { row.screenshot = await shot(page, 'FAIL-' + name); } catch (_) {} }
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name}${row.error ? ': ' + row.error.split('\n')[0] : ''}`);
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function goto(page, route) {
  const response = await page.goto(urlFor(route), { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${route} must return local HTTP 200`);
  // UX2 B4: the page announces "<n> unit packs" once the records have rendered (or the empty state).
  if (route.startsWith('/resources/')) await page.waitForFunction(() => /\d+ unit packs/.test(document.querySelector('#rxCount')?.textContent || '') || !document.querySelector('#empty')?.hidden);
  if (route.startsWith('/Matt-s-Apps-/')) await page.waitForFunction(() => /\d+ of \d+ studios/.test(document.querySelector('#count')?.textContent || ''));
  // UX2 (Lessons Part A): the hub announces "<n> resources · <m> subjects" and a subject page fills #summary.
  if (route.startsWith('/Lessons/')) await page.waitForFunction(() => /\d+ resources/.test(document.querySelector('#count')?.textContent || '') || /\d+ lessons/.test(document.querySelector('#summary')?.textContent || '') || document.querySelectorAll('#rows a[href], #cards a[href]').length > 0);
  await settle(page);
}
async function visibleLinks(page, selector) {
  return page.locator(selector).evaluateAll(nodes => nodes.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').map(el => ({ href: el.href, text: (el.textContent || '').trim() })));
}
async function hitTarget(locator) {
  await locator.scrollIntoViewIfNeeded();
  const target = await locator.evaluate(el => {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { width: r.width, height: r.height, left: r.left, right: r.right, viewport: innerWidth, clear: !!hit && (hit === el || el.contains(hit)) };
  });
  assert(target.width >= 43.5 && target.height >= 43.5, `Discovery target is too small: ${JSON.stringify(target)}`);
  assert(target.left >= -.5 && target.right <= target.viewport + .5 && target.clear, `Discovery target is clipped or covered: ${JSON.stringify(target)}`);
  return target;
}
async function pdfSearch(page, route, width) {
  const input = route.startsWith('/resources') ? '#rxSearch' : '#search';
  const cards = route.startsWith('/resources') ? '#rxOut .rx-cardx' : '#groups .card';
  // UX2 B4: on /resources/ the browse-only region is the unit-card section, which hides while a
  // query filters and returns when the search is cleared (the pillars stay in the hero).
  const promotion = route.startsWith('/resources') ? null : '#pdf-studio-feature';
  const baselineCards = route.startsWith('/resources') ? await page.locator('#unitGrid .unit').count() : null;
  const evidence = [];
  for (const query of ['PDF', 'PDF generator', 'PDF Studio', 'merge PDF']) {
    await page.locator(input).fill(query);
    await page.waitForFunction(({ cards, target }) => [...document.querySelectorAll(cards + ' a[href]')].some(a => a.getClientRects().length && new URL(a.href).pathname === target), { cards, target: PDF });
    if (promotion) assert.equal(await page.locator(promotion).isVisible(), false, `${promotion} must hide while a search query is active`);
    const pdfCard = page.locator(cards).filter({ has: page.locator('a[href*="PDF_Studio.html"]') }).first();
    assert.match(await pdfCard.innerText(), /PDF Studio/i);
    await hitTarget(pdfCard.locator('a[href*="PDF_Studio.html"]').first());
    await page.locator(input).scrollIntoViewIfNeeded();
    evidence.push({ query, count: await page.locator(cards + ':visible').count(), screenshot: await shot(page, `${width}-${route.includes('resources') ? 'resources' : 'apps'}-${query}`) });
  }
  await page.locator(input).fill(''); await settle(page);
  if (promotion) assert(await page.locator(promotion).isVisible(), `${promotion} should return when search is cleared`);
  else { await page.waitForFunction(n => document.querySelectorAll('#unitGrid .unit').length === n, baselineCards, { timeout: 5000 }).catch(() => {}); assert.equal(await page.locator('#unitGrid .unit').count(), baselineCards, 'Clearing the search restores every unit card'); }
  return evidence;
}
async function responsiveChecks(browser) {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 900 : 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => report.pageErrors.push({ url: page.url(), error: String(e) }));
    for (const home of homes) await check(`${width}-${home === '/' ? 'home' : 'main'}-three-places`, page, async () => {
      await goto(page, home);
      assert.equal(await page.locator(collectionNav).count(), 0, 'No duplicate learning-areas bar on the homepage');
      const links = [];
      for (const [target, name] of [['/Lessons/', 'Lessons'], ['/resources/', 'Resources'], ['/Matt-s-Apps-/', 'Apps & tools']]) {
        const link = page.locator('#places a.route-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
        assert.equal(await link.count(), 1, `${home} lacks the ${name} place`);
        assert.equal(routeOf(await link.getAttribute('href'), home), routeOf(target));
        links.push({ target, bounds: await hitTarget(link) });
      }
      return { links };
    });
    for (const route of hubs) {
      await check(`${width}-${route}-obvious-learning-navigation`, page, async () => {
        await goto(page, route);
        assert.equal(await page.locator(collectionNav).count(), 1, 'Each hub needs one obvious Learning areas navigation');
        const nav = page.locator(collectionNav), labels = await nav.innerText();
        for (const label of ['Lessons', 'Resources', 'Apps', 'Teacher tools']) assert(labels.includes(label), `${route} lacks ${label}`);
        const links = [];
        for (const target of ['/Lessons/', '/resources/', '/Matt-s-Apps-/', '/tools/']) {
          const link = nav.locator('a').filter({ hasText: target === '/Lessons/' ? /^Lessons$/ : target === '/resources/' ? /^Resources$/ : target === '/tools/' ? /^Teacher tools$/ : /^Apps(?:\s*&\s*tools)?$/ }).first();
          assert.equal(routeOf(await link.getAttribute('href'), route), routeOf(target));
          links.push({ target, bounds: await hitTarget(link) });
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'Horizontal overflow on discovery hub');
        await page.evaluate(() => scrollTo(0, 0));
        return { links, screenshot: await shot(page, `${width}-${route === '/' ? 'home' : route}-discovery`) };
      });
      if (route === '/resources/') await check(`${width}-resources-pillars-and-pdf-search`, page, async () => {
        // UX2 B4: search first, then the three pillars (Schemes of work · Evidence and accreditation ·
        // Teacher tools → the Apps hub with the manifest count), then the unit cards. Apps are found
        // through the page's search (lessons and apps stay in the global search), not listed as cards.
        await goto(page, route);
        assert.equal(await page.locator('#resource-collections').count(), 0, 'The retired collections section is gone');
        const pillars = page.locator('#pillars');
        assert(await pillars.isVisible(), 'Pillars are missing from Resources');
        assert(await page.evaluate(() => {
          const follows = (before, after) => !!(document.querySelector(before).compareDocumentPosition(document.querySelector(after)) & Node.DOCUMENT_POSITION_FOLLOWING);
          return follows('#rxSearch', '#pillars') && follows('#pillars', '#rxOut');
        }), 'Resources must put search first, then the pillars, then the unit cards');
        const tools = pillars.locator('a[href="/Matt-s-Apps-/"]');
        assert.equal(await tools.count(), 1, 'Teacher tools pillar links the Apps hub');
        const appsJson = await (await page.request.get(urlFor('/Matt-s-Apps-/apps.json'))).json();
        const manifestCount = appsJson.spaces.reduce((n, s) => n + s.items.length, 0);
        await page.waitForFunction(() => /\d/.test(document.querySelector('#appsCount')?.textContent || ''));
        assert.equal(await page.locator('#appsCount').innerText(), `${manifestCount} apps`, 'Teacher tools count is the Apps manifest length');
        await hitTarget(tools);
        const image = await pillars.screenshot({ path: path.join(out, `${width}-resource-pillars.png`), animations: 'disabled' });
        assert(image.length > 0);
        return { pillarScreenshot: `${width}-resource-pillars.png`, manifestCount, searches: await pdfSearch(page, route, width) };
      });
      if (route === '/Matt-s-Apps-/') await check(`${width}-apps-visible-pdf-feature-and-search-aliases`, page, async () => {
        await goto(page, route);
        assert(await page.evaluate(() => !!(document.querySelector('#search').compareDocumentPosition(document.querySelector('#pdf-studio-feature')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Apps search must precede its PDF promotional feature');
        const links = await visibleLinks(page, 'a[href*="PDF_Studio.html"]');
        assert(links.length > 0, 'PDF Studio must be visible without opening Documents first');
        const searches = await pdfSearch(page, route, width);
        await page.locator('#chips [data-cat="Documents"]').click(); await settle(page);
        assert.equal(await page.locator('#pdf-studio-feature').isVisible(), false, 'Apps PDF promotion must hide for an active category filter');
        assert((await visibleLinks(page, appsCards)).some(a => routeOf(a.href) === PDF), 'Documents category must still show the real PDF Studio card');
        await page.locator('#chips [data-cat=""]').click(); await settle(page);
        assert(await page.locator('#pdf-studio-feature').isVisible(), 'Apps PDF promotion must return after clearing filters');
        return { searches, documentCategory: true };
      });
      if (route === '/tools/') await check(`${width}-teacher-tools-pdf-and-asdan-learning`, page, async () => {
        await goto(page, route);
        const links = await visibleLinks(page, 'main a[href]');
        assert(links.some(a => routeOf(a.href) === PDF), 'Teacher tools lacks a visible PDF Studio link');
        assert(links.some(a => /ASDAN/i.test(a.text) && (new URL(a.href).hash === '#asdan-learning' || /ASDAN/.test(new URL(a.href).pathname))), 'Teacher tools must distinguish ASDAN learning resources from the register');
        const searches = [];
        for (const query of ['PDF', 'PDF generator', 'PDF Studio']) {
          await page.locator('#tq').fill(query); await settle(page);
          const results = await visibleLinks(page, '.tcard a[href]');
          assert(results.some(a => routeOf(a.href) === PDF), `Teacher tools search ${query} hides PDF Studio`);
          await page.locator('#tq').scrollIntoViewIfNeeded();
          searches.push({ query, screenshot: await shot(page, `${width}-tools-${query}`) });
        }
        await page.locator('#tq').fill('ASDAN'); await settle(page);
        const asdan = await visibleLinks(page, '.tcard a[href]');
        assert(asdan.some(a => routeOf(a.href) === '/asdan'), 'ASDAN search lost the existing register');
        assert(asdan.some(a => new URL(a.href).hash === '#asdan-learning' || /\/(?:BUILD|GROW|LAUNCH)_ASDAN\//.test(new URL(a.href).pathname)), 'ASDAN search hides its distinct learning collection');
        await page.locator('#tq').scrollIntoViewIfNeeded();
        searches.push({ query: 'ASDAN', screenshot: await shot(page, `${width}-tools-ASDAN`) });
        await page.locator('#tq').fill(''); await settle(page);
        return { searches };
      });
    }
    await check(`${width}-asdan-collections-and-lifeskills`, page, async () => {
      // UX2 B4: the three ASDAN hubs are catalogue rows rendered as Lifeskills documents on
      // /resources/; "all years" is the Lifeskills subject page (Part A), which lists every
      // catalogue row of that card at each pathway.
      await goto(page, '/resources/');
      await page.waitForFunction(() => document.querySelectorAll('#rxOut .rx-cardx').length > 0);
      const links = await visibleLinks(page, '#rxOut .rx-cardx a[href]');
      const direct = [];
      for (const level of ['BUILD', 'GROW', 'LAUNCH']) {
        const target = `/Lessons/${level}_ASDAN/${level}_ASDAN_Hub.html`;
        assert(links.some(a => routeOf(a.href) === target), `${level} ASDAN master collection is not visible`);
        assert.equal((await page.request.get(urlFor(target))).status(), 200, `${level} ASDAN collection is unavailable`);
        direct.push(target);
      }
      await goto(page, '/Lessons/subject.html?subject=lifeskills');
      await page.waitForFunction(() => document.querySelectorAll('#rows a[href]').length > 0);
      const older = sourceJSON(lessonsRoot, 'resources.json').filter(r => /ASDAN|vocational|PfA|life skills/i.test(r.subject || '') && r.year !== '2026-27' && r.file && sourceFile(routeOf(r.file, '/Lessons/')));
      assert(older.length > 0, 'The independent source contains no older ASDAN controls');
      const rendered = new Set();
      for (const tab of await page.locator('#seg [role="tab"]').evaluateAll(n => n.map(t => t.dataset.pathway))) {
        await goto(page, '/Lessons/subject.html?subject=lifeskills&pathway=' + tab); await settle(page);
        for (let i = 0; i < 200 && (await page.evaluate(() => { const b = document.querySelector('button[data-more]'); if (!b) return false; b.click(); return true; })); i++) { /* the page's delegated handler expands the group and re-renders */ }
        for (const href of await page.locator('#rows a[href]').evaluateAll(n => n.map(a => a.href))) rendered.add(routeOf(href));
      }
      const missing = older.filter(r => !rendered.has(routeOf(r.file, '/Lessons/'))).map(r => r.file);
      assert.deepEqual(missing, [], 'Older ASDAN resources are hidden on the Lifeskills subject page');
      return { direct, olderResources: older.length, rendered: rendered.size, screenshot: await shot(page, `${width}-asdan-lifeskills`) };
    });
    await check(`${width}-teacher-home-pdf-generator-search`, page, async () => {
      await goto(page, '/for/teachers/?q=PDF%20generator');
      await page.waitForFunction(target => [...document.querySelectorAll('#teachers-results a[href]')].some(a => a.getClientRects().length && new URL(a.href).pathname === target), PDF);
      assert.equal(await page.locator('#teachers-q').inputValue(), 'PDF generator');
      const result = page.locator('#teachers-results a[href*="PDF_Studio.html"]').first();
      assert.match(await result.innerText(), /PDF Studio/i);
      await hitTarget(result);
      return { screenshot: await shot(page, `${width}-teacher-home-PDF-generator`) };
    });
    await context.close();
  }
}
async function catalogueChecks(browser, expected) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const cards = new Map(), navigation = new Set(), externalCards = new Set();
  await check('all-working-education-destinations-in-rendered-cards', page, async () => {
    // UX2 B4: lessons are discovered on the Lessons hub's subject pages (every card, every pathway
    // segment, every accordion and "Show n more" expanded); teacher destinations on the teacher page.
    const subjectPages = [];
    await goto(page, '/Lessons/'); await page.waitForFunction(() => document.querySelectorAll('.scard[data-card]').length > 0);
    for (const slug of await page.locator('.scard[data-card]').evaluateAll(n => n.map(c => c.dataset.card))) {
      await goto(page, '/Lessons/subject.html?subject=' + encodeURIComponent(slug)); await settle(page);
      const tabs = await page.locator('#seg [role="tab"]').evaluateAll(n => n.map(t => t.dataset.pathway));
      for (const tab of tabs.length ? tabs : ['']) subjectPages.push('/Lessons/subject.html?subject=' + encodeURIComponent(slug) + (tab ? '&pathway=' + tab : ''));
    }
    for (const route of [...homes, ...hubs, '/for/teachers/', ...subjectPages]) {
      await goto(page, route);
      if (route.startsWith('/Lessons/subject.html')) {
        await page.waitForFunction(() => document.querySelectorAll('#rows a[href], #summary').length > 0).catch(() => {});
        // Open every collapsed group and every "Show n more" through the page's own delegated
        // handler (each click re-renders), so every row of the segment is visible.
        for (let i = 0; i < 400 && (await page.evaluate(() => { const b = document.querySelector('.acc button[aria-expanded="false"][data-toggle]') || document.querySelector('button[data-more]'); if (!b) return false; b.click(); return true; })); i++) { /* re-rendered */ }
      }
      if (route === '/Matt-s-Apps-/') {
        // Open real user-facing disclosures using their summary controls.
        for (const detail of await page.locator('#groups details').all()) if (!(await detail.evaluate(el => el.open))) await detail.locator('summary').click();
      }
      const selector = route === '/resources/' ? resourceCards : route === '/Matt-s-Apps-/' ? appsCards : route.startsWith('/Lessons/subject.html') ? '#rows a[href]' : route === '/for/teachers/' ? 'main a[href]' : 'main a.route-card, main .card a[href], main .tcard a[href]';
      for (const item of await visibleLinks(page, selector)) {
        const key = routeOf(item.href);
        if (key !== null) cards.set(key, { hub: route, text: item.text });
        else externalCards.add(item.href);
      }
      for (const item of await visibleLinks(page, 'a[href]')) { const key = routeOf(item.href); if (key !== null) navigation.add(key); }
    }
    assert.deepEqual([...cards.keys()].filter(route=>excludedGameRoutes.has(route)), [], 'Recreational resources must not appear in Education discovery');
    const missing = [];
    for (const entry of expected.values()) {
      entry.rendered = cards.get(entry.route) || (entry.hub && navigation.has(entry.route) ? { navigation: true } : null);
      if (!entry.rendered) missing.push({ route: entry.route, title: entry.sources[0].label });
    }
    assert.deepEqual(missing, [], 'Working old/current education destinations are absent from rendered discovery');
    const externalMissing = [...new Set(report.external.map(item => new URL(item.href).href))].filter(href => !externalCards.has(href));
    assert.deepEqual(externalMissing, [], 'Existing external education references are absent from rendered discovery');
    return { expected: expected.size, uniqueCardDestinations: cards.size, preservedExternalReferences: externalCards.size, absentFromOriginalSource: report.absentFromSource.length };
  });
  await check('every-working-education-destination-returns-local-200', page, async () => {
    const rows = [...expected.values()], failures = []; let next = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < rows.length) {
        const item = rows[next++];
        try { const response = await page.request.get(urlFor(item.route), { timeout: 30000 }); item.status = response.status(); if (item.status !== 200) failures.push({ route: item.route, status: item.status }); }
        catch (e) { item.requestError = String(e); failures.push({ route: item.route, error: String(e) }); }
      }
    }));
    report.destinations = rows;
    assert.deepEqual(failures, [], 'A preserved education resource is unavailable in the assembled publication');
    return { checked: rows.length, http200: rows.filter(r => r.status === 200).length };
  });
  await check('current-app-items-and-original-categories-preserved', page, async () => {
    const response = await page.request.get(urlFor('/Matt-s-Apps-/apps.json')); assert.equal(response.status(), 200);
    const source = sourceJSON(appsRoot, 'apps.json'), actual = await response.json();
    const expected = {...source,spaces:source.spaces.map(group=>({...group,items:group.items.filter(row=>!excludedGameRoutes.has(routeOf(row.f,'/Matt-s-Apps-/')))}))};
    assert.deepEqual(actual, expected, 'Retained educational Apps items and original categories must stay exact; recreational destinations are excluded');
    return { items: source.spaces.reduce((n, group) => n + group.items.length, 0), groups: source.spaces.length };
  });
  await check('resource-filter-urls-preserved', page, async () => {
    const subject = 'humanities-re';
    for (const [key, value] of [['q', 'PDF generator'], ['subject', subject], ['type', 'Teacher']]) {
      await goto(page, '/resources/?' + new URLSearchParams({ [key]: value }));
      await page.waitForFunction(() => document.querySelectorAll('#rxOut .rx-cardx').length > 0 || !document.querySelector('#empty').hidden);
      assert(await page.locator('#rxOut .rx-cardx').count() > 0, `${key} deep link produces no rendered results`);
      if (key === 'q') assert.equal(await page.locator('#rxSearch').inputValue(), value);
      // UX2 B4: the subject pill is a <select> keyed by the hub's subject slug; there is no Type
      // pill (kind scored below 18/20), so a ?type= deep link still renders the page and the two
      // kind pillars carry the note saying why.
      if (key === 'subject') assert.equal(await page.locator('#rxSubs').inputValue(), value);
      if (key === 'type') { assert.equal(await page.locator('#rxPath, #rxSubs').count(), 2); assert.match(await page.locator('#pillars [data-kind-note]').first().innerText(), /type/i); }
    }
    return { filters: ['q=PDF generator', 'subject=' + subject, 'type=Teacher'] };
  });
  await context.close();
}

(async () => {
  let browser;
  try {
    const expected = expectedDestinations();
    browser = await chromium.launch({ headless: true });
    await responsiveChecks(browser);
    await catalogueChecks(browser, expected);
    await check('discovery-pages-have-no-uncaught-runtime-errors', null, async () => { assert.deepEqual(report.pageErrors, []); return { pageErrors: 0 }; });
  } catch (e) { report.fatal = errorText(e); }
  finally {
    if (browser) await browser.close();
    report.completedAt = new Date().toISOString();
    report.passed = report.cases.filter(x => x.ok).length;
    report.failed = report.cases.filter(x => !x.ok).length;
    report.result = !report.fatal && !report.failed ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(out, 'resource-discovery.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`${report.result}: ${report.passed} passed, ${report.failed} failed; ${path.join(out, 'resource-discovery.json')}`);
    if (report.result !== 'PASS') process.exitCode = 1;
  }
})();
