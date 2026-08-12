#!/usr/bin/env node
/*
 * The six Teach Hub task cards, driven in a real browser at a phone and a
 * desktop viewport.
 *
 * Why this exists. The cards shipped as real anchors carrying
 * data-mbm-task-query, and the search app bound them with
 *
 *     root.querySelectorAll('[data-mbm-task-query]')
 *
 * where root is the [data-mbm-search-app] section. The cards are a *sibling*
 * of that section, so the selector matched zero of six, on every load, with no
 * console error. The click fell through to the anchor's own navigation: a full
 * reload of /teach/?task=..., which did apply the filter — and put the filtered
 * workspace 3314px down a 844px-tall phone screen. From the hand holding the
 * phone that is indistinguishable from a dead card, which is exactly how it was
 * reported.
 *
 * So this file asserts the two halves separately: that the filter is APPLIED,
 * and that the result is PERCEIVABLE without scrolling. A test that only
 * checked the URL or the result count would have passed against the broken
 * page.
 *
 *   node tools/verify_teach_task_filter.mjs            # against a local server
 *   BASE=https://madebymatt.uk node tools/verify_teach_task_filter.mjs
 *   node tools/verify_teach_task_filter.mjs --self-test # prove the gate can fail
 *
 * Exits non-zero on any failure, so it works as a gate.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) { /* keep looking */ }
  }
  console.error('playwright not found. Install it with:  npm i -g playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--self-test');
const TASKS = ['teach-a-lesson', 'plan-a-sequence', 'assess-understanding',
               'capture-evidence', 'manage-learner-information', 'create-a-resource'];
const VIEWPORTS = [
  { name: 'phone',   width: 390,  height: 844, isMobile: true,  hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, isMobile: false, hasTouch: false },
];

const failures = [];
const rows = [];
function assert(cond, message) { if (!cond) failures.push(message); return !!cond; }

/* A tiny static server, so the gate does not depend on one being up. */
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.woff2':'font/woff2', '.ico':'image/x-icon' };
function serve(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function ready(page) {
  await page.waitForSelector('[data-mbm-search-app][data-mbm-search-ready="true"]', { timeout: 20000 });
}
const countOf = (page) => page.textContent('[data-mbm-result-count]').then((t) => (t || '').trim());
const activeTasks = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-mbm-task-query],[data-mbm-task-reset]'))
    .filter((el) => el.getAttribute('aria-current') === 'true')
    .map((el) => el.getAttribute('data-mbm-task-query') || 'RESET'));
/* framenavigated fires for pushState too, so it cannot tell "filtered in place"
   from "reloaded the page". A value parked on window survives the first and is
   destroyed by the second. */
const mark = (page) => page.evaluate(() => { window.__mbmGateMark = 1; });
const survived = (page) => page.evaluate(() => window.__mbmGateMark === 1);
/* Smooth scrolling is asynchronous and its duration depends on the distance
   travelled, which differs per card. Wait for it to stop rather than guessing. */
async function settle(page) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) return;
    last = y;
    await page.waitForTimeout(50);
  }
}
const workspaceTop = (page) => page.evaluate(() => {
  const w = document.querySelector('[data-mbm-search-app]');
  return w ? Math.round(w.getBoundingClientRect().top) : null;
});
const inView = (page) => page.evaluate(() => {
  const w = document.querySelector('[data-mbm-search-app]');
  if (!w) return false;
  const r = w.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
});

/* The static half of the contract. The estate's rule (verify_professional_site.js)
   is that a page carries the sentinel of AT LEAST ONE of the passes declared to
   authorise its copy - not all of them - because the convention in
   copy-authorisation.json is one sentinel per page: the pass that last authored
   it. privacy/index.html is the precedent: two authorising passes, one sentinel.
   This check reads the same way, so the two cannot drift apart. */
function authorisationAssertions(mapOverride) {
  const map = mapOverride || JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'copy-authorisation.json'), 'utf8'));
  for (const rel of ['teach/index.html', 'education-hub/index.html']) {
    const entry = map.pages[rel];
    if (!assert(entry, `${rel}: not declared in data/copy-authorisation.json`)) continue;
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const sentinels = [];
    for (const pass of entry.authorisedBy) {
      const sentinel = map.passes[pass];
      if (assert(sentinel, `${rel}: names pass "${pass}", which is not declared`)) sentinels.push(sentinel);
    }
    assert(sentinels.some((s) => html.includes(s)),
      `${rel}: carries none of the sentinels of the passes that authorise its copy ` +
      `(${entry.authorisedBy.join(', ')})`);
  }
}

async function run(base, sabotage) {
  const browser = await chromium.launch();
  // The sabotaged run is expected to throw. Without this the browser leaks and
  // node never exits, which reads as a hung gate rather than a failing one.
  try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    });
    const page = await ctx.newPage();
    if (sabotage) {
      // Disconnect the cards from the search app in flight, exactly the way
      // they were disconnected in production, without touching the tree.
      await page.route('**/teach/**', async (route) => {
        const res = await route.fetch();
        route.fulfill({
          response: res,
          body: (await res.text()).replace(/ data-mbm-task-query="/g, ' data-mbm-severed="'),
        });
      });
    }
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(base + '/teach/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    const unfiltered = await countOf(page);

    // Every card must be a real, operable control before behaviour matters.
    const shape = await page.evaluate(() => Array.from(
      document.querySelectorAll('[data-mbm-task-query],[data-mbm-task-reset]')
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, href: el.getAttribute('href'),
               w: Math.round(r.width), h: Math.round(r.height) };
    }));
    assert(shape.length === TASKS.length + 1,
      `${vp.name}: expected ${TASKS.length} task cards + 1 reset, found ${shape.length}`);
    shape.forEach((s, i) => {
      assert(s.tag === 'A' || s.tag === 'BUTTON',
        `${vp.name}: task control ${i} is a <${s.tag.toLowerCase()}>, not a real interactive element`);
      if (s.tag === 'A') assert(!!s.href, `${vp.name}: task control ${i} is an anchor with no href`);
      assert(Math.min(s.w, s.h) >= 44,
        `${vp.name}: task control ${i} is ${s.w}x${s.h}, below the 44px touch floor`);
    });

    for (const task of TASKS) {
      await page.goto(base + '/teach/', { waitUntil: 'domcontentloaded' });
      await ready(page);
      const sel = `[data-mbm-task-query="${task}"]`;
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);

      await mark(page);
      await page.locator(sel).click();
      await settle(page);
      const navigated = !(await survived(page));

      const count = await countOf(page);
      const top = await workspaceTop(page);
      const visible = await inView(page);
      const active = await activeTasks(page);
      const url = new URL(page.url());

      // 1. the filter is applied  2. the URL deep-links  3. it is on screen
      assert(url.searchParams.get('task') === task,
        `${vp.name}/${task}: URL carries task=${url.searchParams.get('task')}`);
      assert(count !== unfiltered,
        `${vp.name}/${task}: result count did not change from the unfiltered "${unfiltered}"`);
      assert(visible,
        `${vp.name}/${task}: workspace is not in the viewport after activation (top=${top}px) — ` +
        'the person cannot see that anything happened');
      assert(top !== null && top < vp.height,
        `${vp.name}/${task}: workspace top is ${top}px on a ${vp.height}px screen`);
      assert(active.length === 1 && active[0] === task,
        `${vp.name}/${task}: aria-current is on [${active.join(', ')}], expected exactly [${task}]`);
      assert(!navigated,
        `${vp.name}/${task}: activation caused a full page navigation instead of filtering in place`);

      rows.push({ viewport: vp.name, task, count, top, visible, navigated });
    }

    // The reset must exist and must restore the unfiltered set.
    await page.locator('[data-mbm-task-reset]').click();
    await settle(page);
    assert((await countOf(page)) === unfiltered,
      `${vp.name}: reset did not restore the unfiltered result set`);
    assert(!new URL(page.url()).searchParams.has('task'),
      `${vp.name}: reset left task= in the URL`);

    // Deep link: the state has to survive a reload, not just a click.
    await page.goto(base + '/teach/?task=capture-evidence', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.waitForTimeout(250);
    assert((await activeTasks(page)).join() === 'capture-evidence',
      `${vp.name}: a reloaded ?task= deep link does not mark its card current`);
    assert((await countOf(page)) !== unfiltered,
      `${vp.name}: a reloaded ?task= deep link did not filter`);

    // Keyboard: the control has to work without a pointer.
    await page.goto(base + '/teach/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.locator('[data-mbm-task-query="plan-a-sequence"]').focus();
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { focused: el.getAttribute('data-mbm-task-query'),
               outline: parseFloat(cs.outlineWidth) || 0 };
    });
    assert(ring.focused === 'plan-a-sequence', `${vp.name}: the task card did not take keyboard focus`);
    await page.keyboard.press('Enter');
    await settle(page);
    assert((await activeTasks(page)).join() === 'plan-a-sequence',
      `${vp.name}: Enter on a focused task card did not apply it`);
    assert(await inView(page), `${vp.name}: keyboard activation left the workspace off screen`);

    // Back must undo the choice rather than leaving the page.
    await page.goBack();
    await settle(page);
    assert(!new URL(page.url()).searchParams.has('task'),
      `${vp.name}: Back did not undo the task choice`);

    assert(errors.length === 0, `${vp.name}: console/page errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  } finally { await browser.close(); }
}

/* The control. A gate that cannot fail is not a gate. Sever the cards from the
   search app in flight — the exact production defect — and this must go red.
   An earlier version of this control copied the tree to a temp directory and
   edited the file there; the copy was missing the manifest and touch icon, so
   it "caught" the sabotage with two 404 console findings and would have passed
   a page whose cards worked perfectly. Interception keeps the real tree. */
async function selfTest(base) {
  // The authorisation half, proven red: declare the hubs under a pass whose
  // sentinel is nowhere on them.
  let mark = failures.length;
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'copy-authorisation.json'), 'utf8'));
  map.passes['unauthorised-probe'] = 'mbm-sentinel-that-was-never-stamped';
  map.pages['teach/index.html'].authorisedBy = ['unauthorised-probe'];
  authorisationAssertions(map);
  if (failures.length === mark) {
    console.error('[FAIL] self-test: the authorisation check accepted an unstamped pass');
    process.exit(1);
  }
  console.log(`[PASS] self-test: authorisation check went red on an unauthorised probe ` +
              `(${failures.length - mark} finding)`);
  failures.length = mark;

  const before = failures.length;
  try { await run(base, true); } catch (_) { failures.push('self-test: run threw'); }
  const caught = failures.filter((f) => !/404|Failed to load resource/.test(f)).length - before;
  failures.length = before;
  rows.length = 0;
  if (caught <= 0) {
    console.error('[FAIL] self-test: the gate raised no substantive finding against severed cards');
    process.exit(1);
  }
  console.log(`[PASS] self-test: ${caught} substantive finding(s) raised against severed task cards`);
}

const external = process.env.BASE;
let server = null, base = external;
if (!external) {
  server = await serve(ROOT);
  base = `http://127.0.0.1:${server.address().port}`;
}

if (SELFTEST) await selfTest(base);
authorisationAssertions();
await run(base);
if (server) server.close();

for (const r of rows) {
  console.log(`  ${r.viewport.padEnd(8)} ${r.task.padEnd(27)} ${String(r.count).padEnd(12)} ` +
              `workspace top ${String(r.top).padStart(5)}px  in view=${r.visible}  reloaded=${r.navigated}`);
}
if (failures.length) {
  console.error(`\n[FAIL] Teach Hub task filter — ${failures.length} finding(s):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\n[PASS] Teach Hub task filter: ${TASKS.length} cards x ${VIEWPORTS.length} viewports ` +
            'apply, deep-link, reset, keyboard-operate and land on screen');
