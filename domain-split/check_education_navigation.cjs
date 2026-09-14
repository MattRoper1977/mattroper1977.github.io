#!/usr/bin/env node
'use strict';

/* SW2 H/U: copied from Lessons 2c33266b01b273ad9e70a18e7f4769787c6ade1c.
 * Only the homepage stylesheet/tile selectors change; all lesson, saved, print,
 * target, contrast and return-context assertions below are retained.
 * Run against the BUILT education Site + Lessons trees mounted at one origin.
 * Do not inject lesson-navigation.js here: its presence is a publication gate.
 * This harness writes only browser storage and its own evidence directory.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const out = path.resolve(process.env.MBM_NAVIGATION_OUTPUT || 'audit-output/education-navigation');
const SURFACE = '/Lessons/Art_Teesside/Build/BUILD_ART_A2_W1_Surface_Hunt.html';
const RETURN_KEY = 'mbm.lesson.return.v1';
const SAVE_KEY = 'mbm.lesson.saved.v1';
const viewports = [
  { name: 'phone-320', width: 320, height: 740 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
];
const report = { schema: 1, origin, startedAt: new Date().toISOString(), cases: [], pageErrors: [], fatal: null };
fs.mkdirSync(out, { recursive: true });
const targetURL = p => new URL(p, origin).href;
const message = e => e?.stack || e?.message || String(e);

function assertSameRoute(actual, expected, label) {
  // Query order and space serialization do not change a route's state. Compare
  // every decoded entry, preserving duplicate keys, plus the exact destination.
  assert.equal(typeof actual, 'string', `${label}: route context is missing`);
  assert(actual.length > 0, `${label}: route context is empty`);
  const parts = value => {
    const url = new URL(value, origin);
    const query = [...url.searchParams.entries()].sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
    return { origin: url.origin, pathname: url.pathname, hash: url.hash, query };
  };
  assert.deepEqual(parts(actual), parts(expected), `${label}: destination or filter state changed`);
}

async function shot(page, name, fullPage = false) {
  const file = name.replace(/[^a-zA-Z0-9._-]/g, '-') + '.png';
  await page.screenshot({ path: path.join(out, file), fullPage, animations: 'disabled' });
  return file;
}
async function checkCase(name, page, action) {
  const record = { name, ok: false };
  report.cases.push(record);
  try { record.evidence = await action(); record.ok = true; }
  catch (e) { record.error = message(e); if (page && !page.isClosed()) try { record.screenshot = await shot(page, 'FAIL-' + name); } catch (_) {} }
  console.log(`${record.ok ? 'PASS' : 'FAIL'} ${name}${record.error ? ': ' + record.error.split('\n')[0] : ''}`);
}
async function settle(page) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function assertHeroContrast(page) {
  const evidence = await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    if (!hero) throw new Error('Rendered lesson-finder hero is missing');
    if (!hero.querySelector('.lead') || hero.querySelectorAll('.lesson-breadcrumb a').length < 3 || !hero.querySelector('h1 span')) throw new Error('Required hero text targets are missing');
    const rgb = value => {
      const m = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
      if (!m) throw new Error('Unsupported computed hero color: ' + value);
      return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    };
    const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const luminance = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    let underlay = [255, 255, 255];
    const ancestors = []; for (let e = hero; e; e = e.parentElement) ancestors.unshift(e);
    for (const e of ancestors) underlay = over(rgb(getComputedStyle(e).backgroundColor), underlay);
    const image = getComputedStyle(hero).backgroundImage;
    if (image !== 'none' && !/^linear-gradient\(/.test(image)) throw new Error('Unsupported rendered hero background: ' + image);
    const stops = image === 'none' ? [] : [...image.matchAll(/rgba?\([^)]*\)/g)].map(m => rgb(m[0]));
    if (image !== 'none' && stops.length < 2) throw new Error('Hero gradient endpoints could not be measured');
    const backgrounds = stops.length ? stops.map(c => over(c, underlay)) : [underlay];
    const measurements = [...hero.querySelectorAll('.lead, .lesson-breadcrumb a, .lesson-breadcrumb span, h1, h1 span')].map(e => {
      const style = getComputedStyle(e), color = rgb(style.color);
      let opacity = 1; for (let node = e; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      color[3] *= opacity;
      const heading = !!e.closest('h1');
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      return { text: e.textContent.trim(), selector: e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).trim().replace(/\s+/g, '.') : ''), color: style.color,
        required: heading && large ? 3 : 4.5, minimum: Math.min(...backgrounds.map(bg => contrast(over(color, bg), bg))) };
    });
    return { image, backgrounds, measurements };
  });
  assert(evidence.measurements.length >= 6, 'Hero text contrast assertions are missing their rendered targets');
  for (const item of evidence.measurements) assert(item.minimum >= item.required, `${item.selector} "${item.text}" has contrast ${item.minimum.toFixed(2)}:1, below ${item.required}:1 against rendered hero ${evidence.image}`);
  return evidence;
}
async function goto(page, route, hub = false) {
  const response = await page.goto(targetURL(route), { waitUntil: 'domcontentloaded' });
  assert(response && response.ok(), `Route ${route} returned ${response?.status()}`);
  if (hub) {
    // UX2: the hub renders a derived count line; the subject page a derived summary line.
    await page.waitForFunction(() => /\d+ (of \d+ )?resources/.test(document.querySelector('#count')?.textContent || '') || /\d+ lessons/.test(document.querySelector('#summary')?.textContent || ''));
  } else {
    const html = await response.text();
    assert(/<script\b[^>]*src=["'][^"']*assets\/catalogue\/lesson-navigation\.js(?:\?[^"']*)?["']/i.test(html), 'Built lesson HTML lacks the publication-injected navigation script');
    await page.waitForSelector('#mbm-lesson-tools #mbmhud-back');
    assert(await page.evaluate(() => window.__mbmLessonNavigation === true), 'Published navigation did not initialize');
  }
  await settle(page);
}
async function hitTarget(page, selector, minSize = 44) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  // Each print button may sit below the currently visible part of the native
  // slide. Scroll that real container before measuring; never demand that all
  // three print controls fit on screen simultaneously.
  await target.evaluate(el => {
    if (el.closest('.slide.active')) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  });
  await target.scrollIntoViewIfNeeded();
  await settle(page);
  const value = await target.evaluate((el, minSize) => {
    const b = el.getBoundingClientRect();
    const inset = Math.min(12, b.width / 4, b.height / 4);
    const points = [[b.x + b.width / 2, b.y + b.height / 2], [b.x + inset, b.y + inset], [b.right - inset, b.bottom - inset]];
    return { text: (el.textContent || '').trim(), x: b.x, y: b.y, width: b.width, height: b.height,
      viewport: { width: innerWidth, height: innerHeight }, sizeOK: b.width >= minSize - .5 && b.height >= minSize - .5,
      inViewport: b.left >= -.5 && b.right <= innerWidth + .5 && b.top >= -.5 && b.bottom <= innerHeight + .5,
      hits: points.map(([x, y]) => { const hit = document.elementFromPoint(x, y); return { x, y, ok: !!hit && (hit === el || el.contains(hit)), receiver: hit ? hit.tagName + '#' + hit.id + '.' + String(hit.className) : null }; }) };
  }, minSize);
  assert(value.sizeOK, `${selector}: target is ${value.width} × ${value.height}; expected at least ${minSize}px`);
  assert(value.inViewport, `${selector}: target is clipped by the viewport: ${JSON.stringify(value)}`);
  assert(value.hits.every(h => h.ok), `${selector}: another element intercepts the native control: ${JSON.stringify(value.hits)}`);
  return value;
}
async function newPage(browser, viewport = { width: 390, height: 844 }, init) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(() => { window.__navigationPrintCalls = 0; window.print = () => { window.__navigationPrintCalls++; }; });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  page.on('pageerror', e => report.pageErrors.push({ url: page.url(), error: String(e) }));
  return { context, page };
}

async function assertPageContrast(page) {
  // UX2 A2/A3: the hub and subject page have no hero; measure the visible headline text.
  const evidence = await page.evaluate(() => {
    const rgb = value => { const m = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/); if (!m) throw new Error('Unsupported computed color: ' + value); return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]; };
    const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
    const luminance = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
    const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const targets = [...document.querySelectorAll('main h1, main .lead, main #summary, main #count, main .acc > button, main .scard h3')].filter(e => e.getBoundingClientRect().height > 0 && e.textContent.trim());
    if (targets.length < 2) throw new Error('Headline text targets are missing');
    return targets.map(e => {
      let underlay = [255, 255, 255]; const ancestors = []; for (let n = e; n; n = n.parentElement) ancestors.unshift(n);
      for (const n of ancestors) underlay = over(rgb(getComputedStyle(n).backgroundColor), underlay);
      const style = getComputedStyle(e); const color = rgb(style.color);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      return { text: e.textContent.trim().slice(0, 40), selector: e.tagName.toLowerCase(), required: large ? 3 : 4.5, minimum: contrast(over(color, underlay), underlay) };
    });
  });
  for (const item of evidence) assert(item.minimum >= item.required, `${item.selector} "${item.text}" has contrast ${item.minimum.toFixed(2)}:1, below ${item.required}:1`);
  return evidence;
}

async function hubTests(browser) {
  const { context, page } = await newPage(browser);
  await checkCase('subject-pathway-selection-and-url-reload', page, async () => {
    await goto(page, '/Lessons/subject.html?subject=science&pathway=LAUNCH', true);
    const contrast = await assertPageContrast(page);
    assert.equal(await page.locator('#seg [role="tab"][aria-selected="true"]').getAttribute('data-pathway'), 'LAUNCH');
    assert.match(await page.locator('#sub-name').innerText(), /^SCIENCE$/);
    const tabs = await page.locator('#seg [role="tab"]').allTextContents();
    assert(tabs.some(t => /LAUNCH/.test(t)) && tabs.some(t => /BUILD/.test(t)), 'Pathway control is missing a pathway');
    const rows = await page.locator('#rows .lrow').evaluateAll(els => els.map(e => e.dataset.resourcePath));
    assert(rows.length > 0 && rows.every(r => /Launch|LAUNCH/.test(r)), 'Pathway selection produced an unrelated row');
    await page.locator('#seg [role="tab"][data-pathway="GROW"]').click();
    assert.equal(new URL(page.url()).searchParams.get('pathway'), 'GROW');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#seg [role="tab"][aria-selected="true"]')?.dataset.pathway === 'GROW' && document.querySelectorAll('#rows .lrow').length > 0);
    return { rows: rows.length, contrast: contrast.length, screenshot: await shot(page, 'subject-science-grow-390') };
  });
  await checkCase('browser-history-restores-subject-selection', page, async () => {
    await goto(page, '/Lessons/subject.html?subject=art-studio&pathway=BUILD', true);
    await goto(page, '/Lessons/subject.html?subject=science&pathway=GROW', true);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /ART STUDIO/.test(document.querySelector('#sub-name')?.textContent || '') && document.querySelector('#seg [role="tab"][aria-selected="true"]')?.dataset.pathway === 'BUILD');
    return { url: page.url(), count: await page.locator('#rows .lrow').count() };
  });
  await checkCase('save-persists-reload-and-saved-view-removal', page, async () => {
    await goto(page, '/Lessons/?q=Surface%20Hunt', true);
    const save = page.locator('#cards .card').filter({ has: page.locator('a[href*="BUILD_ART_A2_W1_Surface_Hunt.html"]') }).locator('button[data-save]').first();
    const resource = await save.getAttribute('data-save');
    assert(resource, 'Surface Hunt card does not expose its save key');
    await save.scrollIntoViewIfNeeded(); await save.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '[]').length === 1, SAVE_KEY);
    assert.equal(await save.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-saved-count]').first().innerText(), '1');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-saved-count]')?.textContent === '1');
    await page.locator('[data-view="saved"]').click();
    assert.equal(new URL(page.url()).searchParams.get('view'), 'saved');
    assert.equal(await page.locator('#cards .card').count(), 1);
    const screenshot = await shot(page, 'hub-saved-lessons-390');
    await page.locator('#cards button[data-save]').click();
    assert.equal(await page.locator('#cards .card').count(), 0);
    assert.match(await page.locator('#cards').innerText(), /No saved lessons/);
    assert.equal(await page.locator('[data-saved-count]').first().innerText(), '0');
    return { resource, screenshot };
  });
  await checkCase('lesson-link-captures-context-and-recent-lesson', page, async () => {
    const selected = '/Lessons/subject.html?subject=art-studio&pathway=BUILD&q=Surface%20Hunt';
    await goto(page, selected, true);
    const expected = new URL(page.url()).pathname + new URL(page.url()).search;
    assertSameRoute(expected, selected, 'Selected subject page');
    for (let i = 0; i < 50; i++) { const t = page.locator('button[data-toggle][aria-expanded="false"]').first(); if (!(await t.count())) break; await t.click(); }
    await page.locator('#rows a.go[href*="BUILD_ART_A2_W1_Surface_Hunt.html"]').first().click();
    await page.waitForURL(targetURL(SURFACE));
    await page.waitForSelector('#mbm-lesson-tools #mbmhud-back');
    const back = await page.locator('#mbmhud-back').getAttribute('href');
    assertSameRoute(back, selected, 'Lessons return link');
    const stored = await page.evaluate(({ key, route }) => JSON.parse(sessionStorage.getItem(key) || '{}')[route], { key: RETURN_KEY, route: SURFACE });
    assertSameRoute(stored, selected, 'Stored subject-page context');
    await page.locator('#mbmhud-back').click();
    await page.waitForFunction(() => /ART STUDIO/.test(document.querySelector('#sub-name')?.textContent || '') && document.querySelector('#seg [role="tab"][aria-selected="true"]')?.dataset.pathway === 'BUILD');
    assertSameRoute(page.url(), selected, 'Returned subject page');
    assert.equal(await page.locator('#search').inputValue(), 'Surface Hunt');
    await goto(page, '/Lessons/?view=saved', true);
    assert(await page.locator('#lesson-recent a[href*="BUILD_ART_A2_W1_Surface_Hunt.html"]').count() > 0, 'Opened lesson is missing from Recently opened');
    return { returnedTo: page.url() };
  });
  await checkCase('science-shelf-preserves-term-week-and-version-context', page, async () => {
    const route = '/Lessons/Science_Teesside/index.html?pathway=LAUNCH&term=Aut1&week=3&style=recommended';
    const response = await page.goto(targetURL(route), { waitUntil: 'domcontentloaded' });
    assert(response?.ok());
    await page.waitForFunction(() => window.__mbmLessonNavigation === true);
    assert.equal(await page.locator('#science-pathway').inputValue(), 'LAUNCH');
    assert.equal(await page.locator('#science-term').inputValue(), 'Aut1');
    assert.equal(await page.locator('#science-week').inputValue(), '3');
    assert.equal(await page.locator('#science-style').inputValue(), 'recommended');
    const link = page.locator('[data-lesson-path]:visible a[href$=".html"]').filter({ hasText: /Open|Teach|Start/ }).first();
    assert(await link.count(), 'No visible recommended lesson opening link');
    const destination = new URL(await link.getAttribute('href'), page.url());
    await link.click(); await page.waitForURL(destination.href);
    await page.waitForSelector('#mbm-lesson-tools #mbmhud-back');
    assert.equal(new URL(await page.locator('#mbmhud-back').getAttribute('href'), origin).href, targetURL(route));
    return { destination: destination.pathname, screenshot: await shot(page, 'recommended-science-return-context-390') };
  });
  await checkCase('subject-page-pack-sheet-when-a-pack-exists', page, async () => {
    // Non-vacuous only once companion packs are catalogued (UX2 D3); records the state either way.
    await goto(page, '/Lessons/subject.html?subject=science&pathway=BUILD', true);
    for (let i = 0; i < 50; i++) { const t = page.locator('button[data-toggle][aria-expanded="false"]').first(); if (!(await t.count())) break; await t.click(); }
    const chip = page.locator('button[data-pack]').first();
    if (!(await chip.count())) return { packs: 0, note: 'no pack entries in the record' };
    await chip.click();
    assert(await page.locator('#pack-sheet[open]').count(), 'Pack sheet did not open');
    assert(await page.locator('#pack-sheet a[href]').count() >= 1, 'Pack sheet lists no file');
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => document.activeElement?.dataset?.pack != null), 'Focus did not return to the Pack chip');
    return { packs: await page.locator('button[data-pack]').count() };
  });
  await context.close();
}

async function publicationPage(page, route) {
  const response = await page.goto(targetURL(route), { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Education route ${route} returned ${response?.status()}`);
  const stylesheet = route === '/main/' ? '/assets/education-frontdoors.css' : '/assets/education-navigation.css';
  assert(await page.locator('link[rel="stylesheet"][href="'+stylesheet+'"]').count(), `${route} lacks its published education styling`);
  await page.waitForFunction(stylesheet => [...document.styleSheets].some(sheet => {
    try { return sheet.href?.endsWith(stylesheet) && sheet.cssRules.length > 0; } catch (_) { return false; }
  }), stylesheet);
  await settle(page);
  assert((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `${route} has horizontal page overflow`);
}

async function educationJourneyTests(browser) {
  const sizes = [{ name: 'mobile-390', width: 390, height: 844 }, { name: 'desktop-1280', width: 1280, height: 900 }];
  for (const { name, ...size } of sizes) {
    const { context, page } = await newPage(browser, size);
    await checkCase(name + '-education-home-subject-and-personal-shortcuts', page, async () => {
      await publicationPage(page, '/main/');
      assert.equal(await page.locator('body').getAttribute('data-site-kind'), 'education', 'The old general homepage is still being served');
      assert.equal(await page.locator('h1').innerText(), 'Big on ideas. Light on prep.');
      // UX2 B2: the homepage is Appendix A §HOME. "Go straight to your subject" is
      // the tile row itself now, with no explanatory paragraph beneath it, and each
      // tile is one of the four subject cards the Lessons hub derives - so the names
      // and the destinations both come from the record rather than from this file's
      // memory of the old shelf URLs.
      assert.equal(await page.locator('[data-subject-tiles]').count(), 1, 'The homepage has no subject tile row');
      assert.equal(await page.getByRole('heading', { name: 'Explore a subject', exact: true }).count(), 1);
      const subjects = [
        ['Science', '/Lessons/subject.html?subject=science'],
        ['Humanities & RE', '/Lessons/subject.html?subject=humanities-re'],
        ['Art Studio', '/Lessons/subject.html?subject=art-studio'],
        ['Lifeskills', '/Lessons/subject.html?subject=lifeskills'],
      ];
      const links = [];
      for (const [label, expected] of subjects) {
        const card = page.locator('[data-subject-tiles] a.fd-subject').filter({ has: page.getByRole('heading', { name: label, exact: true }) });
        assert.equal(await card.count(), 1, `${label} does not have one clear subject card`);
        const href = new URL(await card.getAttribute('href'), page.url());
        assert.equal(href.href, targetURL(expected));
        const res = await page.request.get(href.href);
        assert(res.ok(), `${label} destination returned ${res.status()}`);
        links.push({ label, href: href.pathname + href.search, status: res.status() });
      }
      // UX2 B1 retired the "Ready to teach?" shortcut bar. The ledger relocates every
      // row rather than dropping it, so this follows the named destinations instead
      // of the bar - and asserts the retirement, so a silent return is caught too.
      assert.equal(await page.locator('.learning-shortcuts').count(), 0, 'The retired teaching-shortcut bar is back on the homepage');
      const subjectsImage = await shot(page, name + '-home-subjects');
      // Saved and recommended relocate to the hub's own view controls.
      for (const view of ['saved', 'recommended']) {
        await goto(page, `/Lessons/?view=${view}`, true);
        assert.equal(new URL(page.url()).pathname, '/Lessons/');
        assert.equal(new URL(page.url()).searchParams.get('view'), view);
        assert.equal(await page.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'), 'true', `The hub's ${view} control does not report itself pressed`);
        if (view === 'saved') assert.match(await page.locator('#cards').innerText(), /No saved lessons/, 'Fresh browser saved state is misleading');
        else assert(await page.locator('#cards .card').count() > 0, 'The recommended view has no lessons');
      }
      // Cover teaching packs relocate to a Resources card. Found by searching rather
      // than by a typed href, so the card has to be genuinely discoverable.
      await publicationPage(page, '/resources/');
      await page.locator('#rxSearch').fill('cover pack');
      await page.waitForFunction(() => document.querySelectorAll('#rxOut .rx-cardx').length > 0);
      const cover = page.locator('#rxOut .rx-cardx a').filter({ hasText: 'cover pack' });
      assert(await cover.count() >= 1, 'Finished cover teaching packs are not discoverable from Resources');
      const coverURL = new URL(await cover.first().getAttribute('href'), page.url());
      assert.equal(coverURL.origin, origin);
      assert((await page.request.get(coverURL.href)).ok(), 'The relocated cover teaching-pack link is broken');
      // The Art Studio tile reaches the subject page, which is where the Art lessons
      // now live. The pre-UX2 ?subject= query means an exact record subject, so it is
      // exercised with the record's own string in the storage case below rather than
      // with a card name that never was one.
      await publicationPage(page, '/main/');
      await page.locator('[data-subject-tiles] a.fd-subject').filter({ has: page.getByRole('heading', { name: 'Art Studio', exact: true }) }).click();
      await page.waitForFunction(() => /\d+ lessons/.test(document.querySelector('#summary')?.textContent || ''));
      assert.equal(new URL(page.url()).pathname, '/Lessons/subject.html');
      assert.equal(new URL(page.url()).searchParams.get('subject'), 'art-studio');
      return { subjects: links, cover: coverURL.pathname, screenshots: [subjectsImage, await shot(page, name + '-home-subject-page')] };
    });
    await checkCase(name + '-tools-finder-before-features-and-filtering', page, async () => {
      await publicationPage(page, '/tools/');
      await page.waitForFunction(() => /Showing \d+ of \d+ tools/.test(document.querySelector('#tcount')?.textContent || ''));
      const order = await page.evaluate(() => {
        const search = document.querySelector('#drawer'), feature = document.querySelector('.tx-flag');
        return { precedesInDOM: !!(search && feature && (search.compareDocumentPosition(feature) & Node.DOCUMENT_POSITION_FOLLOWING)), searchTop: search?.getBoundingClientRect().top, featureTop: feature?.getBoundingClientRect().top };
      });
      assert(order.precedesInDOM && order.searchTop < order.featureTop, 'Large feature cards still precede the working tool finder');
      const total = await page.locator('#drawer .tcard').count();
      assert(total > 0 && await page.locator('#drawer .tcard:visible').count() === total, 'Tools do not initially show the full catalogue');
      const screenshots = [await shot(page, name + '-tools-start')];
      await page.locator('#tq').fill('timer');
      const searched = await page.locator('#drawer .tcard:visible').evaluateAll(cards => cards.map(c => ({ title: c.querySelector('h3')?.textContent, search: c.dataset.s })));
      assert(searched.length > 0 && searched.length < total && searched.every(c => c.search.includes('timer')), 'Tool search failed to restrict the cards to the requested term');
      await hitTarget(page, '#tq');
      screenshots.push(await shot(page, name + '-tools-search'));
      await page.locator('#tq').fill('');
      await page.locator('.tchip[data-cat="util"]').click();
      assert.equal(await page.locator('.tchip[data-cat="util"]').getAttribute('aria-pressed'), 'true');
      const categories = await page.locator('#drawer .tcard:visible').evaluateAll(cards => cards.map(c => c.dataset.cat));
      assert(categories.length > 0 && categories.every(c => c === 'util'), 'Utilities filter shows an unrelated tool');
      await page.locator('#tq').fill('zz-no-matching-teaching-tool-zz');
      assert.equal(await page.locator('#drawer .tcard:visible').count(), 0);
      assert.match(await page.locator('#tcount').innerText(), /^Showing 0 of/);
      await page.locator('#tq').fill('');
      await page.locator('.tchip[data-cat=""]').click();
      assert.equal(await page.locator('#drawer .tcard:visible').count(), total, 'Clearing filters loses tools');
      assert((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'Filtering introduced horizontal tool-page overflow');
      const saved = page.locator('.education-jumps a[href="/Lessons/?view=saved"]');
      assert.equal(await saved.count(), 1, 'Tools page has no saved-lesson route');
      return { total, searched, utilities: categories.length, finderOrder: order, screenshots };
    });
    await checkCase(name + '-resources-search-and-new-lesson-finder', page, async () => {
      await publicationPage(page, '/resources/');
      // UX2 B4: /resources/ is Appendix A §RESOURCES - one card per unit, a derived
      // "<n> unit packs" count, and the page's own name as its heading. The card is a
      // list item whose link carries the title, not an h3.
      await page.waitForFunction(() => /\d+ unit packs/.test(document.querySelector('#rxCount')?.textContent || ''));
      assert.match(await page.locator('.rx-hero h1').innerText(), /^Resources$/);
      const screenshots = [await shot(page, name + '-resources-start')];
      await page.locator('#rxSearch').fill('Surface Hunt');
      await page.waitForFunction(() => document.querySelectorAll('#rxOut .rx-cardx').length > 0);
      const cards = await page.locator('#rxOut .rx-cardx').evaluateAll(cards => cards.map(c => ({ title: (c.querySelector('h3') || c.querySelector('a[href]'))?.textContent, links: [...c.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) })));
      assert(cards.every(c => /Surface Hunt/i.test(c.title)), 'Resource search retained unrelated titles');
      assert(cards.some(c => c.links.some(href => href.includes('BUILD_ART_A2_W1_Surface_Hunt.html'))), 'The searchable resource hub lost the reported Surface Hunt lesson');
      await hitTarget(page, '#rxSearch');
      screenshots.push(await shot(page, name + '-resources-search'));
      await page.locator('#rxSearch').fill('zz-no-matching-resource-zz');
      assert.equal(await page.locator('#rxOut .rx-cardx').count(), 0);
      assert(await page.locator('#rxClear').isVisible(), 'Empty resource search has no recovery action');
      await page.locator('#rxClear').click();
      assert.equal(await page.locator('#rxSearch').inputValue(), '');
      assert(await page.locator('#rxOut .rx-cardx').count() > 0);
      // UX2 B1 retired the jump bar; the route to the hub is the menu, and the
      // "Three places, one site" card on the homepage. Take the menu, since that is
      // the one every page carries.
      await page.locator('.mbm-unified-menu > summary').click();
      await page.locator('#mbm-navigation-panel').getByRole('link', { name: 'Lessons', exact: true }).click();
      // UX2: the hub's browse view derives "<M> resources · <S> subjects" and shows the subject cards.
      await page.waitForFunction(() => /\d+ resources · \d+ subjects/.test(document.querySelector('#count')?.textContent || ''));
      assert.equal(new URL(page.url()).pathname, '/Lessons/');
      assert.match(await page.locator('main h1').innerText(), /^Lessons$/);
      assert(await page.locator('#subjects').isVisible(), 'Resource hub does not return to the subject cards');
      assert((await page.locator('#scards .scard').count()) >= 4, 'Resource hub returns to a hub without subject cards');
      return { matched: cards, screenshots };
    });
    await context.close();
  }
}

async function storageAndUntrustedContextTests(browser) {
  const blocked = await newPage(browser, { width: 390, height: 844 }, () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied by browser', 'SecurityError'); } });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Storage denied by browser', 'SecurityError'); } });
  });
  await checkCase('storage-denied-still-browses-and-does-not-falsely-save', blocked.page, async () => {
    // The hub's ?subject= means an exact record subject, as it did before UX2 - the
    // Part D3 catalogue restored that after Part A had briefly widened it to the
    // subject card. This lesson's record subject is "Art · Teesside Studio Suite",
    // so the card query uses that rather than the card's name, which never matched
    // this row and now correctly does not.
    await goto(blocked.page, '/Lessons/?subject=' + encodeURIComponent('Art · Teesside Studio Suite') + '&q=Surface%20Hunt', true);
    await blocked.page.locator('#cards button[data-save]').first().click();
    assert.match(await blocked.page.locator('#lesson-save-status').innerText(), /cannot save/);
    assert.equal(await blocked.page.locator('[data-saved-count]').first().innerText(), '0');
    assert.equal(await blocked.page.locator('#cards button[data-save]').first().getAttribute('aria-pressed'), 'false');
    await goto(blocked.page, SURFACE);
    const back = new URL(await blocked.page.locator('#mbmhud-back').getAttribute('href'), origin);
    assert.equal(back.origin, origin); assert.equal(back.pathname, '/Lessons/');
    assert.equal(back.searchParams.get('subject'), 'Art'); assert.equal(back.searchParams.get('pathway'), 'BUILD');
    return { fallback: back.pathname + back.search };
  });
  await blocked.context.close();
  const poisons = [
    'https://example.invalid/steal', '//example.invalid/steal', 'javascript:alert(1)',
    '/Lessons/Games/Orbital.html', '/account/?return=https://example.invalid/', '/Lessons/\\evil',
  ];
  for (let i = 0; i < poisons.length; i++) {
    const { context, page } = await newPage(browser);
    await context.addInitScript(({ key, route, poison }) => { sessionStorage.setItem(key, JSON.stringify({ [route]: poison })); }, { key: RETURN_KEY, route: SURFACE, poison: poisons[i] });
    await checkCase('reject-untrusted-return-context-' + i, page, async () => {
      await goto(page, SURFACE);
      const back = new URL(await page.locator('#mbmhud-back').getAttribute('href'), origin);
      assert.equal(back.origin, origin); assert.equal(back.pathname, '/Lessons/');
      assert.equal(back.searchParams.get('subject'), 'Art'); assert.equal(back.searchParams.get('pathway'), 'BUILD');
      return { rejected: poisons[i], fallback: back.pathname + back.search };
    });
    await context.close();
  }
}

async function surfaceTests(browser) {
  for (const viewport of viewports) {
    const { name, ...size } = viewport;
    const { context, page } = await newPage(browser, size);
    await checkCase(name + '-surface-native-controls-and-print', page, async () => {
      await goto(page, SURFACE);
      const controls = [];
      for (const selector of ['#mbmhud-back', 'body > .controls button[onclick="prevSlide()"]', 'body > .controls button[onclick="nextSlide()"]', '.mbm-guide-btn', 'body > .controls button[onclick="showTABrief()"]']) controls.push(await hitTarget(page, selector));
      assert((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'Lesson has horizontal page overflow');
      const first = await page.locator('.slide.active').getAttribute('data-title');
      await page.locator('body > .controls button[onclick="nextSlide()"]').click();
      await page.waitForFunction(title => document.querySelector('.slide.active').dataset.title !== title, first);
      const second = await page.locator('.slide.active').getAttribute('data-title');
      await page.locator('body > .controls button[onclick="prevSlide()"]').click();
      await page.waitForFunction(title => document.querySelector('.slide.active').dataset.title === title, first);
      await page.locator('.mbm-guide-btn').click();
      assert.equal(await page.locator('.mbm-guide-btn').getAttribute('aria-pressed'), 'true');
      assert(await page.locator('html').evaluate(el => el.classList.contains('mbm-guide-on')));
      await page.locator('.mbm-guide-btn').click();
      await page.locator('body > .controls button[onclick="showTABrief()"]').click();
      await page.locator('#ta-modal.visible').waitFor({ state: 'visible' });
      await hitTarget(page, '#ta-modal button');
      await page.locator('#ta-modal button').click();
      await page.locator('#ta-modal.visible').waitFor({ state: 'hidden' });
      const images = [await shot(page, name + '-surface-controls')];
      for (const level of ['supported', 'standard', 'stretch']) {
        const selector = `.slide.active button[onclick="printPack('${level}')"]`;
        controls.push(await hitTarget(page, selector));
        await page.locator(selector).click();
        assert(await page.locator('body').evaluate((el, level) => el.classList.contains('print-' + level), level), 'Native print route did not arm ' + level);
        assert(await page.locator('#print-worksheet-' + level).evaluate(el => el.classList.contains('visible')), 'Native worksheet was not selected');
      }
      assert.equal(await page.evaluate(() => window.__navigationPrintCalls), 3, 'Native print buttons did not request all three print packs');
      await page.locator(".slide.active button[onclick=\"printPack('standard')\"]").click();
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#mbm-lesson-tools').isVisible(), false, 'Website tools leak into the pupil print pack');
      assert(await page.locator('#print-worksheet-standard').isVisible(), 'Standard worksheet is absent from print layout');
      images.push(await shot(page, name + '-surface-print', true));
      if (name === 'phone-390') await page.pdf({ path: path.join(out, 'Surface_Hunt_standard_print.pdf'), format: 'A4', printBackground: true });
      return { firstSlide: first, secondSlide: second, controls, screenshots: images };
    });
    await context.close();
  }
}

(async () => {
  let browser;
  try {
    assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Serve the reviewed publication in the existing CI harness; live-site testing is not supported');
    browser = await chromium.launch({ headless: true });
    await educationJourneyTests(browser);
    await hubTests(browser);
    await storageAndUntrustedContextTests(browser);
    await surfaceTests(browser);
  } catch (e) { report.fatal = message(e); }
  finally {
    if (browser) await browser.close();
    report.finishedAt = new Date().toISOString();
    report.passed = report.cases.filter(c => c.ok).length;
    report.failed = report.cases.filter(c => !c.ok).length;
    report.ok = report.cases.length >= 23 && !report.failed && !report.fatal && !report.pageErrors.length;
    fs.writeFileSync(path.join(out, 'navigation-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, failed: report.failed, pageErrors: report.pageErrors.length, fatal: report.fatal, evidence: out }));
    process.exitCode = report.ok ? 0 : 1;
  }
})();
