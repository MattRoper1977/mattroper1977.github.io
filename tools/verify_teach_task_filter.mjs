#!/usr/bin/env node
/* Permanent cross-page gate for the six teacher task shortcuts.
 * The original defect restored the task and filtered correctly while leaving
 * the workspace thousands of pixels below the viewport. Every source journey
 * therefore proves both state and perceivability.
 *
 *   node tools/verify_teach_task_filter.mjs
 *   BASE=https://madebymatt.uk node tools/verify_teach_task_filter.mjs
 *   node tools/verify_teach_task_filter.mjs --self-test
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const candidate of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(candidate); } catch (_) { /* try the CI fallback */ }
  }
  console.error('playwright not found. Install it with: npm i --no-save playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--self-test');
const STATIC_ONLY = process.argv.includes('--static');
const TARGET_ID = 'teach-search-workspace';
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mbm-search-index.json'), 'utf8'));
const TASKS = INDEX.teacherTasks.map(({ id, label }) => ({ id, label }));
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, isMobile: false, hasTouch: false },
];
const failures = [];
const rows = [];

function assert(condition, message, sink = failures) {
  if (!condition) sink.push(message);
  return !!condition;
}
function expectedHref(task) { return `/teach/?task=${task}#${TARGET_ID}`; }
function sameOrigin(url, base) {
  try { return new URL(url).origin === new URL(base).origin; } catch (_) { return false; }
}
function overlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel;
      try { rel = decodeURIComponent(new URL(req.url, 'http://local.test').pathname); }
      catch (_) { res.writeHead(400); res.end('bad request'); return; }
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function anchorHrefs(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<a\\b(?=[^>]*\\bclass="[^"]*\\b${escaped}\\b[^"]*")[^>]*\\bhref="([^"]+)"[^>]*>`, 'g');
  return Array.from(html.matchAll(re), (match) => match[1]);
}
function staticContract() {
  const source = fs.readFileSync(path.join(ROOT, 'for/teachers/index.html'), 'utf8');
  const teach = fs.readFileSync(path.join(ROOT, 'teach/index.html'), 'utf8');
  const sourceHrefs = anchorHrefs(source, 'mf-task-card');
  const internalHrefs = anchorHrefs(teach, 'mbm-task-card').filter((href) => href.includes('task='));
  const expected = TASKS.map((task) => expectedHref(task.id));
  assert(TASKS.length === 6, `static: task authority contains ${TASKS.length}, expected six`);
  assert(new Set(TASKS.map((task) => task.id)).size === TASKS.length, 'static: task authority contains duplicate ids');
  assert(sourceHrefs.length === TASKS.length, `static: source has ${sourceHrefs.length} task anchors, expected ${TASKS.length}`);
  assert(internalHrefs.length === TASKS.length, `static: Teach Hub has ${internalHrefs.length} task anchors, expected ${TASKS.length}`);
  for (let i = 0; i < TASKS.length; i++) {
    for (const [surface, href] of [['source', sourceHrefs[i]], ['Teach Hub', internalHrefs[i]]]) {
      assert(href === expected[i], `static: ${surface}/${TASKS[i].id} href is ${href}, expected ${expected[i]}`);
      if (!href) continue;
      const resolved = new URL(href, 'https://madebymatt.uk');
      assert(resolved.origin === 'https://madebymatt.uk', `static: ${surface}/${TASKS[i].id} is not same-origin`);
      assert(resolved.pathname === '/teach/', `static: ${surface}/${TASKS[i].id} path is ${resolved.pathname}`);
      assert(resolved.searchParams.size === 1 && resolved.searchParams.get('task') === TASKS[i].id,
        `static: ${surface}/${TASKS[i].id} does not carry exactly one matching task query`);
      assert(resolved.hash === `#${TARGET_ID}`, `static: ${surface}/${TASKS[i].id} fragment is ${resolved.hash}`);
      assert(href.indexOf('?task=') < href.indexOf('#'), `static: ${surface}/${TASKS[i].id} query is not before fragment`);
      assert(!/%25/i.test(href), `static: ${surface}/${TASKS[i].id} is double-encoded`);
    }
  }
  assert(new Set(sourceHrefs).size === TASKS.length, 'static: source task URLs are not distinct');
  assert((teach.match(new RegExp(`id="${TARGET_ID}"`, 'g')) || []).length === 1,
    `static: #${TARGET_ID} must exist exactly once`);
  const select = teach.match(/<select id="filter-task"[^>]*>([\s\S]*?)<\/select>/);
  const optionValues = select ? Array.from(select[1].matchAll(/<option value="([^"]*)"/g), (m) => m[1]).filter(Boolean) : [];
  assert(JSON.stringify(optionValues) === JSON.stringify(TASKS.map((task) => task.id)),
    `static: receiving task options [${optionValues.join(', ')}] do not match the task authority`);
}

function authorisationAssertions() {
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/copy-authorisation.json'), 'utf8'));
  for (const rel of ['teach/index.html', 'education-hub/index.html']) {
    const entry = map.pages[rel];
    if (!assert(entry, `${rel}: not declared in data/copy-authorisation.json`)) continue;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const sentinels = entry.authorisedBy.map((pass) => map.passes[pass]).filter((sentinel) =>
      assert(sentinel, `${rel}: names an undeclared authorising pass`));
    assert(sentinels.some((sentinel) => html.includes(sentinel)), `${rel}: carries none of its authorised copy sentinels`);
  }
}

function observe(page, base) {
  const state = { console: [], page: [], failed: [], responses: [], external: new Set() };
  const origin = new URL(base).origin;
  page.on('console', (message) => { if (message.type() === 'error') state.console.push(message.text()); });
  page.on('pageerror', (error) => state.page.push(String(error.message || error)));
  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) state.external.add(url.origin);
    } catch (_) { /* non-URL browser request */ }
  });
  page.on('requestfailed', (request) => {
    if (sameOrigin(request.url(), base)) state.failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });
  page.on('response', (response) => {
    if (sameOrigin(response.url(), base) && response.status() >= 400) state.responses.push(`${response.status()} ${response.url()}`);
  });
  return state;
}
function assertClean(watch, label, sink = failures) {
  assert(watch.console.length === 0, `${label}: console errors: ${watch.console.slice(0, 3).join(' | ')}`, sink);
  assert(watch.page.length === 0, `${label}: page errors: ${watch.page.slice(0, 3).join(' | ')}`, sink);
  assert(watch.failed.length === 0, `${label}: failed same-origin requests: ${watch.failed.slice(0, 3).join(' | ')}`, sink);
  assert(watch.responses.length === 0, `${label}: bad same-origin responses: ${watch.responses.slice(0, 3).join(' | ')}`, sink);
  assert(watch.external.size === 0, `${label}: unexpected external requests: ${Array.from(watch.external).join(', ')}`, sink);
}

async function ready(page) {
  await page.waitForSelector(`#${TARGET_ID}[data-mbm-search-ready="true"]`, { timeout: 20000 });
  await quiet(page);
}
async function quiet(page) {
  // Adult surfaces load same-origin account configuration progressively. Let
  // that finite request finish before a deliberate navigation so the gate does
  // not misclassify our own Back/cross-page action as a broken request.
  await page.waitForLoadState('networkidle');
}
async function settle(page) {
  await page.waitForTimeout(120);
  let last = null; let stable = 0;
  for (let i = 0; i < 80; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) stable += 1; else stable = 0;
    if (stable >= 4) return;
    last = y;
    await page.waitForTimeout(50);
  }
}
async function resultCount(page) {
  const text = (await page.textContent('[data-mbm-result-count]') || '').trim();
  const match = text.match(/^(\d+)/);
  return { text, value: match ? Number(match[1]) : NaN };
}
async function destinationState(page) {
  const count = await resultCount(page);
  return page.evaluate(({ count, targetId }) => {
    const workspace = document.getElementById(targetId);
    const heading = document.getElementById('teach-filter-title');
    const header = document.querySelector('.header.mbm-site-header');
    const select = document.querySelector('[data-mbm-filter="task"]');
    const back = document.querySelector('.mbm-backtop');
    const active = document.activeElement;
    const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
    const headingRect = heading?.getBoundingClientRect();
    const selectBounds = select?.getBoundingClientRect();
    const headingHit = headingRect ? document.elementFromPoint(
      headingRect.left + Math.min(headingRect.width / 2, 24),
      headingRect.top + headingRect.height / 2,
    ) : null;
    const selectHit = selectBounds ? document.elementFromPoint(
      selectBounds.left + selectBounds.width / 2,
      selectBounds.top + selectBounds.height / 2,
    ) : null;
    const visual = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return { display: style.display, visibility: style.visibility, opacity: Number(style.opacity),
        isVisibleClass: element.classList.contains('is-visible') };
    };
    return {
      count, rendered: document.querySelectorAll('[data-mbm-results] > [data-result-id]').length,
      task: select?.value ?? null, selectedIndex: select?.selectedIndex ?? null,
      current: Array.from(document.querySelectorAll('[data-mbm-task-query][aria-current="true"]'))
        .map((element) => element.getAttribute('data-mbm-task-query')),
      resetCurrent: !!document.querySelector('[data-mbm-task-reset][aria-current="true"]'),
      workspace: rect(workspace), heading: rect(heading), header: rect(header), selectRect: rect(select), back: rect(back),
      headingUncovered: !!(heading && headingHit && (heading === headingHit || heading.contains(headingHit))),
      selectUncovered: !!(select && selectHit && (select === selectHit || select.contains(selectHit))),
      workspaceVisual: visual(workspace), headingVisual: visual(heading), selectVisual: visual(select),
      viewport: { width: innerWidth, height: innerHeight },
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      active: { id: active?.id || '', tag: active?.tagName || '', inWorkspace: !!(workspace && active && workspace.contains(active)) },
      scrollY: Math.round(scrollY), htmlScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  }, { count, targetId: TARGET_ID });
}
function checkDestination(state, pageUrl, task, unfiltered, label, sink = failures, options = {}) {
  const url = new URL(pageUrl);
  assert(url.pathname === '/teach/', `${label}: path is ${url.pathname}`, sink);
  assert(url.searchParams.size === 1 && url.searchParams.get('task') === task, `${label}: query is ${url.search}`, sink);
  if (options.fragment !== false) assert(url.hash === `#${TARGET_ID}`, `${label}: fragment is ${url.hash}`, sink);
  assert(state.task === task, `${label}: task select is ${state.task}`, sink);
  assert(Number.isFinite(state.count.value) && state.count.value > 0,
    `${label}: filtered count is not non-zero (${state.count.text})`, sink);
  if (Number.isFinite(unfiltered)) assert(state.count.value !== unfiltered,
    `${label}: filtered count ${state.count.value} equals unfiltered ${unfiltered}`, sink);
  assert(state.rendered > 0, `${label}: no result cards rendered`, sink);
  assert(state.current.length === 1 && state.current[0] === task,
    `${label}: aria-current is [${state.current.join(', ')}]`, sink);
  assert(!state.resetCurrent, `${label}: reset is falsely current`, sink);
  const hBottom = state.header?.bottom || 0;
  assert(!!state.workspace && state.workspace.top < state.viewport.height && state.workspace.bottom > hBottom,
    `${label}: workspace is outside the viewport (top=${state.workspace?.top}, height=${state.viewport.height})`, sink);
  assert(!!state.workspace && state.workspace.top >= hBottom - 2,
    `${label}: workspace top ${state.workspace?.top} is covered by header bottom ${hBottom}`, sink);
  assert(!!state.heading && state.heading.top >= hBottom - 2 && state.heading.top < state.viewport.height,
    `${label}: heading is not visibly below the header (top=${state.heading?.top}, header=${hBottom})`, sink);
  assert(state.headingUncovered, `${label}: the destination heading is covered at its hit-test point`, sink);
  assert(!!state.workspaceVisual && state.workspaceVisual.isVisibleClass && state.workspaceVisual.display !== 'none' &&
    state.workspaceVisual.visibility !== 'hidden' && state.workspaceVisual.opacity > 0,
  `${label}: workspace is visually suppressed (${JSON.stringify(state.workspaceVisual)})`, sink);
  assert(!!state.headingVisual && state.headingVisual.display !== 'none' && state.headingVisual.visibility !== 'hidden' &&
    state.headingVisual.opacity > 0,
  `${label}: heading is visually suppressed (${JSON.stringify(state.headingVisual)})`, sink);
  assert(!!state.selectRect && state.selectRect.top >= hBottom - 2 && state.selectRect.bottom <= state.viewport.height + 1,
    `${label}: task control is outside the visible area (top=${state.selectRect?.top}, bottom=${state.selectRect?.bottom}, height=${state.viewport.height})`, sink);
  assert(state.selectUncovered, `${label}: task control is covered at its hit-test point`, sink);
  assert(!!state.selectVisual && state.selectVisual.display !== 'none' && state.selectVisual.visibility !== 'hidden' &&
    state.selectVisual.opacity > 0,
  `${label}: task control is visually suppressed (${JSON.stringify(state.selectVisual)})`, sink);
  assert(state.overflow <= 1, `${label}: horizontal overflow is ${state.overflow}px`, sink);
  if (options.focus !== false) assert(state.active.id === TARGET_ID || state.active.inWorkspace,
    `${label}: focus is ${state.active.tag}#${state.active.id}, not the destination`, sink);
}

async function unfilteredCount(browser, base, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const page = await context.newPage();
  await page.goto(`${base}/teach/`, { waitUntil: 'domcontentloaded' }); await ready(page);
  const count = await resultCount(page);
  assert(Number.isFinite(count.value) && count.value > 0, `${vp.name}: unfiltered baseline is invalid (${count.text})`);
  await context.close(); return count.value;
}
async function whitespacePoint(page, selector, label) {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (!assert(count === 1, `${label}: expected one source card for ${selector}, found ${count}`)) {
    throw new Error(`${label}: cannot activate a missing or ambiguous source card`);
  }
  await locator.scrollIntoViewIfNeeded();
  // The estate sets html{scroll-behavior:smooth}; sampling coordinates while
  // that scroll is still moving produces a verified point that is stale by the
  // time a real touchscreen tap lands.
  await settle(page);
  const point = await locator.evaluate((element) => {
    const r = element.getBoundingClientRect(); const candidates = [];
    for (let inset = 8; inset <= 28; inset += 4) {
      candidates.push([r.right - inset, r.bottom - inset], [r.left + inset, r.bottom - inset],
        [r.right - inset, r.top + inset], [r.left + inset, r.top + inset]);
    }
    for (let y = r.top + 6; y < r.bottom - 6; y += 6) {
      for (const x of [r.left + 6, r.right - 6]) candidates.push([x, y]);
    }
    for (const [x, y] of candidates) {
      if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y) === element) {
        return { x, y, width: r.width, height: r.height };
      }
    }
    return null;
  });
  if (!assert(!!point, `${label}: no verified whitespace point exists on the whole-card anchor`)) {
    throw new Error(`${label}: cannot activate the whole-card anchor at a verified whitespace point`);
  }
  if (point) assert(Math.min(point.width, point.height) >= 44,
    `${label}: source card is ${Math.round(point.width)}x${Math.round(point.height)}, below 44px`);
  return point;
}
async function activateAt(page, point, vp) {
  if (vp.hasTouch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
}
async function assertNoFocusTrap(page, label) {
  await page.keyboard.press('Tab');
  const moved = await page.evaluate((targetId) => {
    const root = document.getElementById(targetId); const active = document.activeElement;
    return !!(root && active && active !== root && root.contains(active) &&
      active.matches('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  }, TARGET_ID);
  assert(moved, `${label}: Tab did not move from the destination to a usable control`);
}

async function pointerJourneys(browser, base, vp, unfiltered) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  for (let index = 0; index < TASKS.length; index++) {
    const task = TASKS[index]; const label = `${vp.name}/pointer/${task.id}`;
    const page = await context.newPage(); const watch = observe(page, base);
    await page.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(page);
    const selector = `#teacher-tasks a.mf-task-card[href="${expectedHref(task.id)}"]`;
    const point = await whitespacePoint(page, selector, label);
    if (point) await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), activateAt(page, point, vp)]);
    await ready(page); await settle(page);
    let state = await destinationState(page);
    checkDestination(state, page.url(), task.id, unfiltered, label); assertClean(watch, label);
    rows.push({ viewport: vp.name, task: task.id, count: state.count.value,
      top: Math.round(state.workspace?.top ?? -1), header: Math.round(state.header?.bottom ?? -1) });
    await assertNoFocusTrap(page, label);
    if (index === 0) {
      await page.goBack({ waitUntil: 'domcontentloaded' }); await quiet(page);
      assert(new URL(page.url()).pathname === '/for/teachers/', `${label}: Back did not return to /for/teachers/`);
      await page.goForward({ waitUntil: 'domcontentloaded' }); await ready(page); await settle(page);
      state = await destinationState(page);
      checkDestination(state, page.url(), task.id, unfiltered, `${label}/Forward`);
    }
    assertClean(watch, label);
    await page.close();
  }
  await context.close();
}

async function keyboardJourneys(browser, base, unfiltered) {
  const vp = VIEWPORTS[1];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const task of TASKS) {
    const label = `desktop/keyboard/${task.id}`; const page = await context.newPage(); const watch = observe(page, base);
    await page.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(page);
    const selector = `#teacher-tasks a.mf-task-card[href="${expectedHref(task.id)}"]`;
    let reached = false;
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), selector);
      if (reached) break;
    }
    assert(reached, `${label}: Tab order never reached the real anchor`);
    const ring = await page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: parseFloat(style.outlineWidth) || 0, style: style.outlineStyle, shadow: style.boxShadow };
    });
    assert(ring.width >= 2 && ring.style !== 'none', `${label}: no visible focus indicator`);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
    await ready(page); await settle(page);
    checkDestination(await destinationState(page), page.url(), task.id, unfiltered, label);
    await assertNoFocusTrap(page, label); assertClean(watch, label); await page.close();
  }
  await context.close();
}

async function directReloadJourneys(browser, base, unfiltered) {
  const vp = VIEWPORTS[0];
  for (const task of TASKS) {
    const label = `phone/direct/${task.id}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); const watch = observe(page, base);
    await page.goto(`${base}${expectedHref(task.id)}`, { waitUntil: 'domcontentloaded' }); await ready(page); await settle(page);
    checkDestination(await destinationState(page), page.url(), task.id, unfiltered, label);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page); await settle(page);
    checkDestination(await destinationState(page), page.url(), task.id, unfiltered, `${label}/reload`);
    assertClean(watch, label); await context.close();
  }
  const legacy = TASKS[0];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const watch = observe(page, base);
  await page.goto(`${base}/teach/?task=${legacy.id}`, { waitUntil: 'domcontentloaded' }); await ready(page); await settle(page);
  checkDestination(await destinationState(page), page.url(), legacy.id, unfiltered,
    'phone/query-only-legacy', failures, { fragment: false });
  assertClean(watch, 'phone/query-only-legacy'); await context.close();
}

async function newTabJourney(browser, base, unfiltered) {
  const vp = VIEWPORTS[1]; const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const contextNetwork = { failed: [], responses: [], external: new Set() }; const origin = new URL(base).origin;
  context.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) contextNetwork.external.add(url.origin);
    } catch (_) { /* non-URL browser request */ }
  });
  context.on('requestfailed', (request) => {
    if (sameOrigin(request.url(), base)) contextNetwork.failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });
  context.on('response', (response) => {
    if (sameOrigin(response.url(), base) && response.status() >= 400) contextNetwork.responses.push(`${response.status()} ${response.url()}`);
  });
  const source = await context.newPage(); await source.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(source);
  const task = TASKS[3]; const label = `desktop/new-tab/${task.id}`;
  const point = await whitespacePoint(source, `#teacher-tasks a.mf-task-card[href="${expectedHref(task.id)}"]`, label);
  let openedWatch; context.on('page', (page) => { if (page !== source) openedWatch = observe(page, base); });
  const openedPromise = context.waitForEvent('page');
  await source.keyboard.down('Control'); if (point) await source.mouse.click(point.x, point.y); await source.keyboard.up('Control');
  const opened = await openedPromise; await opened.waitForLoadState('domcontentloaded'); await ready(opened); await settle(opened);
  assert(new URL(source.url()).pathname === '/for/teachers/', `${label}: source tab navigated`);
  checkDestination(await destinationState(opened), opened.url(), task.id, unfiltered, label);
  assert(!!openedWatch, `${label}: the new tab observer was not attached`);
  if (openedWatch) assertClean(openedWatch, label);
  assert(contextNetwork.failed.length === 0,
    `${label}: context saw failed same-origin requests: ${contextNetwork.failed.slice(0, 3).join(' | ')}`);
  assert(contextNetwork.responses.length === 0,
    `${label}: context saw bad same-origin responses: ${contextNetwork.responses.slice(0, 3).join(' | ')}`);
  assert(contextNetwork.external.size === 0,
    `${label}: context saw unexpected external requests: ${Array.from(contextNetwork.external).join(', ')}`);
  await context.close();
}

async function inPageHistory(browser, base, unfilteredByViewport) {
  for (const vp of VIEWPORTS) {
    const unfiltered = unfilteredByViewport[vp.name];
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    const page = await context.newPage(); const watch = observe(page, base);
    await page.goto(`${base}/teach/#teach-tasks-title`, { waitUntil: 'domcontentloaded' }); await ready(page);
    await page.evaluate((mark) => { window.__mbmHistoryMark = mark; }, `${vp.name}-alive`);
    for (const task of TASKS) {
      const label = `${vp.name}/in-page/${task.id}`;
      await page.locator(`[data-mbm-task-query="${task.id}"]`).click(); await settle(page);
      checkDestination(await destinationState(page), page.url(), task.id, unfiltered, label);
      assert(await page.evaluate((mark) => window.__mbmHistoryMark === mark, `${vp.name}-alive`),
        `${label}: task activation caused a reload`);
    }

    const resetLabel = `${vp.name}/in-page/reset`;
    await page.locator('[data-mbm-task-reset]').click(); await settle(page);
    const resetState = await destinationState(page); const resetUrl = new URL(page.url());
    assert(resetUrl.pathname === '/teach/' && resetUrl.searchParams.size === 0 && resetUrl.hash === '',
      `${resetLabel}: URL is ${resetUrl.pathname}${resetUrl.search}${resetUrl.hash}`);
    assert(resetState.task === '' && resetState.selectedIndex === 0,
      `${resetLabel}: task control is ${resetState.task}/${resetState.selectedIndex}`);
    assert(resetState.count.value === unfiltered && resetState.rendered > 0,
      `${resetLabel}: unfiltered results are ${resetState.count.text}/${resetState.rendered}`);
    assert(resetState.current.length === 0 && resetState.resetCurrent,
      `${resetLabel}: current tasks/reset are [${resetState.current.join(', ')}]/${resetState.resetCurrent}`);
    const hBottom = resetState.header?.bottom || 0;
    assert(!!resetState.workspace && resetState.workspace.top >= hBottom - 2 &&
      resetState.workspace.top < resetState.viewport.height,
    `${resetLabel}: workspace is not visibly below the header (top=${resetState.workspace?.top})`);
    assert(!!resetState.selectRect && resetState.selectRect.top >= hBottom - 2 &&
      resetState.selectRect.bottom <= resetState.viewport.height + 1 && resetState.selectUncovered,
    `${resetLabel}: reset task control is not fully visible and unobscured`);
    assert(!!resetState.workspaceVisual && resetState.workspaceVisual.isVisibleClass &&
      resetState.workspaceVisual.visibility !== 'hidden' && resetState.workspaceVisual.opacity > 0,
    `${resetLabel}: workspace is visually suppressed (${JSON.stringify(resetState.workspaceVisual)})`);
    assert(await page.evaluate((mark) => window.__mbmHistoryMark === mark, `${vp.name}-alive`),
      `${resetLabel}: reset caused a reload`);

    const [a, b] = TASKS;
    await page.locator(`[data-mbm-task-query="${a.id}"]`).click(); await settle(page);
    checkDestination(await destinationState(page), page.url(), a.id, unfiltered, `${vp.name}/in-page/A`);
    await page.locator(`[data-mbm-task-query="${b.id}"]`).click(); await settle(page);
    checkDestination(await destinationState(page), page.url(), b.id, unfiltered, `${vp.name}/in-page/B`);
    await page.goBack(); await settle(page);
    checkDestination(await destinationState(page), page.url(), a.id, unfiltered, `${vp.name}/in-page/Back`);
    assert(await page.evaluate((mark) => window.__mbmHistoryMark === mark, `${vp.name}-alive`),
      `${vp.name}/in-page: A → B → Back caused a reload`);
    assertClean(watch, `${vp.name}/in-page`); await context.close();
  }
}

async function noJavaScriptJourneys(browser, base) {
  const vp = VIEWPORTS[0];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
  for (const task of TASKS) {
    const label = `phone/no-js/${task.id}`; const page = await context.newPage(); const watch = observe(page, base);
    await page.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(page);
    const point = await whitespacePoint(page, `#teacher-tasks a.mf-task-card[href="${expectedHref(task.id)}"]`, label);
    if (point) await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), activateAt(page, point, vp)]);
    await settle(page);
    const state = await page.evaluate((targetId) => {
      const workspace = document.getElementById(targetId); const header = document.querySelector('.header.mbm-site-header');
      const w = workspace?.getBoundingClientRect(); const h = header?.getBoundingClientRect();
      const nojs = document.getElementById('teach-nojs-title');
      return { workspace: w ? w.toJSON() : null, header: h ? h.toJSON() : null, viewport: innerHeight,
        task: document.querySelector('[data-mbm-filter="task"]')?.value,
        nojsVisible: !!nojs && getComputedStyle(nojs).display !== 'none',
        nojsLinks: nojs?.closest('section')?.querySelectorAll('a[href]').length || 0,
        nojsText: nojs?.closest('section')?.textContent || '' };
    }, TARGET_ID);
    const url = new URL(page.url());
    assert(url.pathname === '/teach/' && url.searchParams.get('task') === task.id && url.hash === `#${TARGET_ID}`,
      `${label}: native URL is ${url.pathname}${url.search}${url.hash}`);
    assert(state.workspace && state.workspace.top >= (state.header?.bottom || 0) - 2 && state.workspace.top < state.viewport,
      `${label}: native fragment is not visibly below the header (top=${state.workspace?.top})`);
    assert(state.task === '', `${label}: no-JS filter falsely claims to be applied`);
    assert(state.nojsVisible && state.nojsLinks > 0 && /filters need JavaScript/i.test(state.nojsText),
      `${label}: readable, honest no-JS teacher routes are absent`);
    assertClean(watch, label); await page.close();
  }
  await context.close();
}

async function controlsAndInvalid(browser, base, unfiltered) {
  const vp = VIEWPORTS[0];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const watch = observe(page, base);
  await page.goto(`${base}/teach/?task=not-a-real-task#${TARGET_ID}`, { waitUntil: 'domcontentloaded' });
  await ready(page); await settle(page); let state = await destinationState(page);
  assert(state.task === '' && state.selectedIndex === 0, `invalid: select is not calmly on All (${state.task}/${state.selectedIndex})`);
  assert(state.current.length === 0 && !state.resetCurrent, 'invalid: a task or reset card is falsely current');
  assert(state.count.value === unfiltered && state.rendered > 0, `invalid: fallback is blank or filtered (${state.count.text})`);
  assert(new URL(page.url()).searchParams.get('task') === 'not-a-real-task', 'invalid: URL was redirected or rewritten');
  await page.goto(`${base}/teach/`, { waitUntil: 'domcontentloaded' }); await ready(page); await settle(page);
  state = await destinationState(page);
  assert(state.workspace.top >= state.viewport.height, `plain /teach/: workspace was unexpectedly revealed at ${state.workspace.top}`);
  const deliberate = TASKS[0];
  await page.goto(`${base}/teach/?task=${deliberate.id}#teach-tasks-title`, { waitUntil: 'domcontentloaded' });
  await ready(page); await settle(page); state = await destinationState(page);
  assert(new URL(page.url()).hash === '#teach-tasks-title', 'unrelated fragment was overwritten');
  assert(state.task === deliberate.id && state.workspace.top >= state.viewport.height,
    'unrelated fragment did not preserve its deliberate target');
  assertClean(watch, 'phone/invalid-and-controls'); await context.close();
}

async function reducedMotion(browser, base, unfiltered) {
  const vp = VIEWPORTS[0];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    const original = Element.prototype.scrollIntoView; window.__mbmScrollBehaviors = [];
    Element.prototype.scrollIntoView = function(options) {
      window.__mbmScrollBehaviors.push(options && typeof options === 'object' ? options.behavior || 'auto' : 'auto');
      return original.apply(this, arguments);
    };
  });
  const page = await context.newPage(); const watch = observe(page, base);
  await page.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(page);
  const task = TASKS[0]; const label = `phone/reduced-motion/${task.id}`;
  const point = await whitespacePoint(page, `#teacher-tasks a.mf-task-card[href="${expectedHref(task.id)}"]`, label);
  if (point) await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), activateAt(page, point, vp)]);
  await ready(page); await settle(page); const state = await destinationState(page);
  checkDestination(state, page.url(), task.id, unfiltered, label);
  const motion = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    calls: window.__mbmScrollBehaviors || [] }));
  assert(motion.reduced, `${label}: reduced-motion media query is not active`);
  assert(motion.calls.length > 0 && !motion.calls.includes('smooth'), `${label}: scroll calls were [${motion.calls.join(', ')}]`);
  assert(state.htmlScrollBehavior === 'auto', `${label}: computed scroll behavior is ${state.htmlScrollBehavior}`);
  assert(!overlap(state.back, state.selectRect) && !overlap(state.back, state.heading),
    `${label}: floating back-to-top overlaps the task control or heading`);
  assertClean(watch, label); await context.close();
}

async function selfTest(browser, base) {
  const vp = VIEWPORTS[0];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
  let fragmentsRemoved = 0; let revealSuppressed = 0;
  await context.route('**/for/teachers/**', async (route) => {
    if (route.request().resourceType() !== 'document') { await route.continue(); return; }
    const response = await route.fetch(); let body = await response.text();
    body = body.replace(/(href="\/teach\/\?task=[^"#]+)#teach-search-workspace"/g, (match, prefix) => {
      fragmentsRemoved += 1; return `${prefix}"`;
    });
    await route.fulfill({ response, body });
  });
  await context.route('**/assets/mbm-search.js', async (route) => {
    const ownerPath = new URL(route.request().frame().url()).pathname;
    if (ownerPath !== '/teach/') { await route.continue(); return; }
    const response = await route.fetch(); let body = await response.text();
    const needle = "if(shouldRevealTask())requestAnimationFrame(function(){requestAnimationFrame(revealWorkspace);});";
    if (body.includes(needle)) { body = body.replace(needle, '/* self-test: guarded initial reveal suppressed */'); revealSuppressed += 1; }
    await route.fulfill({ response, body });
  });
  const page = await context.newPage(); const watch = observe(page, base);
  const task = TASKS[0]; const label = 'self-test/visibility-only';
  await page.goto(`${base}/for/teachers/`, { waitUntil: 'domcontentloaded' }); await quiet(page);
  const point = await whitespacePoint(page, `#teacher-tasks a.mf-task-card[href^="/teach/?task=${task.id}"]`, label);
  if (point) await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), activateAt(page, point, vp)]);
  await ready(page); await settle(page);
  await page.evaluate((targetId) => history.replaceState(null, '', `${location.pathname}${location.search}#${targetId}`), TARGET_ID);
  await settle(page);
  const state = await destinationState(page); const url = new URL(page.url()); const controlFailures = [];
  assert(fragmentsRemoved === TASKS.length, `self-test: removed ${fragmentsRemoved} fragments, expected ${TASKS.length}`, controlFailures);
  assert(revealSuppressed === 1, `self-test: suppressed initial reveal ${revealSuppressed} times`, controlFailures);
  assert(url.pathname === '/teach/' && url.searchParams.get('task') === task.id && url.hash === `#${TARGET_ID}`,
    `self-test: final URL precondition failed (${url.pathname}${url.search}${url.hash})`, controlFailures);
  assert(state.task === task.id && state.current.join() === task.id,
    `self-test: filter/current precondition failed (${state.task}/[${state.current}])`, controlFailures);
  assert(state.count.value > 0 && state.rendered > 0, `self-test: results precondition failed (${state.count.text})`, controlFailures);
  assertClean(watch, label, controlFailures);
  const hidden = !!state.workspace && state.workspace.top >= state.viewport.height;
  assert(hidden, `self-test: gate did not recreate hidden workspace (top=${state.workspace?.top}, height=${state.viewport.height})`, controlFailures);
  const predicateFindings = [];
  checkDestination(state, page.url(), task.id, NaN, label, predicateFindings, { focus: false });
  const visibilityFinding = /workspace is outside the viewport|heading is not visibly below the header|destination heading is covered|workspace is visually suppressed|heading is visually suppressed|task control is outside the visible area|task control is covered|task control is visually suppressed/;
  assert(predicateFindings.some((finding) => visibilityFinding.test(finding)),
    'self-test: the shared destination predicate did not reject the hidden workspace', controlFailures);
  const unrelatedFindings = predicateFindings.filter((finding) => !visibilityFinding.test(finding));
  assert(unrelatedFindings.length === 0,
    `self-test: shared predicate failed outside visibility checks: ${unrelatedFindings.join(' | ')}`, controlFailures);
  if (controlFailures.length) {
    for (const finding of controlFailures) console.error(`[FAIL] ${finding}`);
    await context.close(); process.exit(1);
  }
  console.log(`[PASS] negative control: URL, task, aria-current and ${state.count.value} results stayed valid while ` +
    `the workspace remained invisible at top=${Math.round(state.workspace.top)}px on ${state.viewport.height}px`);
  await context.close();
}

async function run(base) {
  staticContract(); authorisationAssertions();
  if (STATIC_ONLY) return;
  const browser = await chromium.launch();
  try {
    if (SELFTEST) { await selfTest(browser, base); return; }
    const phoneUnfiltered = await unfilteredCount(browser, base, VIEWPORTS[0]);
    const desktopUnfiltered = await unfilteredCount(browser, base, VIEWPORTS[1]);
    await pointerJourneys(browser, base, VIEWPORTS[0], phoneUnfiltered);
    await pointerJourneys(browser, base, VIEWPORTS[1], desktopUnfiltered);
    await keyboardJourneys(browser, base, desktopUnfiltered);
    await directReloadJourneys(browser, base, phoneUnfiltered);
    await newTabJourney(browser, base, desktopUnfiltered);
    await inPageHistory(browser, base, { phone: phoneUnfiltered, desktop: desktopUnfiltered });
    await noJavaScriptJourneys(browser, base);
    await controlsAndInvalid(browser, base, phoneUnfiltered);
    await reducedMotion(browser, base, phoneUnfiltered);
  } finally { await browser.close(); }
}

const external = process.env.BASE ? process.env.BASE.replace(/\/$/, '') : '';
let server = null; let base = external;
if (!base) { server = await serve(ROOT); base = `http://127.0.0.1:${server.address().port}`; }
try { await run(base); } finally { if (server) server.close(); }
if (!SELFTEST && !STATIC_ONLY) {
  for (const row of rows) {
    console.log(`  ${row.viewport.padEnd(8)} ${row.task.padEnd(27)} ${String(row.count).padStart(4)} results  ` +
      `workspace top ${String(row.top).padStart(4)}px  header bottom ${String(row.header).padStart(3)}px`);
  }
}
if (failures.length) {
  console.error(`\n[FAIL] Teacher task deep links — ${failures.length} finding(s):`);
  for (const finding of failures) console.error(`  - ${finding}`);
  process.exit(1);
}
if (STATIC_ONLY) console.log(`[PASS] Teacher task deep-link static contract: ${TASKS.length} canonical source and receiving anchors`);
else if (!SELFTEST) console.log(`\n[PASS] Teacher task deep links: ${TASKS.length} source cards land filtered, visible and unobscured`);
