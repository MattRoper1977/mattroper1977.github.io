#!/usr/bin/env node
/*
 * The sixth reading theme, driven through the swatch control the way a person
 * would: choose it, reload, choose Warm again.
 *
 *   1. six swatches, in order, each 44x44 with aria-pressed and an aria-label
 *   2. choosing High lumen sets data-theme on BOTH <html> and <body>
 *   3. it persists to mbm_reading_theme and survives a reload
 *   4. choosing Warm clears the attribute from both elements again
 *   5. the five existing themes still apply — Warm, Pink and Blue are
 *      visual-stress accommodations and this pass must not have touched them
 *   6. an unknown stored value still degrades to the default
 *
 * The engine exists in three copies (site /theme.js, Lessons and Apps
 * assets/mbm-theme.js) plus the homepage's own inline implementation, so this
 * runs against one page from each.
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

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (p) => (fs.existsSync(p) ? p : null);
const LESSONS = exists(path.join(SITE, '..', 'Lessons')) || exists('/home/user/Lessons');
const APPS = exists(path.join(SITE, '..', 'matt-s-apps-')) || exists('/workspace/matt-s-apps-');
const SELFTEST = process.argv.includes('--self-test');

const MOUNTS = [
  { prefix: '/Lessons', root: LESSONS },
  { prefix: '/Matt-s-Apps-', root: APPS },
  { prefix: '', root: SITE },
];
const PAGES = [
  { label: 'tools (site /theme.js)',      url: '/tools/index.html',        swatch: '.mbm-sw' },
  { label: 'homepage (inline engine)',    url: '/main/index.html',         swatch: '.dx-sw' },
  { label: 'lessons-hub (own engine)',    url: '/Lessons/index.html',      swatch: '.mbm-sw', need: LESSONS },
  { label: 'creator-hub (own engine)',    url: '/Matt-s-Apps-/index.html', swatch: '.mbm-sw', need: APPS },
].filter((p) => p.need !== null);

const ORDER = ['cream', 'pink', 'blue', 'light', 'dark', 'highlumen'];
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

function serve(sabotage) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      let file = null;
      for (const m of MOUNTS) {
        if (!m.root) continue;
        if (m.prefix && !rel.startsWith(m.prefix + '/')) continue;
        const cand = path.join(m.root, m.prefix ? rel.slice(m.prefix.length) : rel);
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) { file = cand; break; }
      }
      if (!file) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      if (sabotage && /theme\.js$/.test(file)) {   // drop the sixth value again
        res.end(fs.readFileSync(file, 'utf8')
          .replace(/,'highlumen'\]/, "]")
          .replace(/,highlumen:'High lumen'\}/, '}'));
        return;
      }
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const failures = [];
const rows = [];
const assert = (c, m) => { if (!c) failures.push(m); return !!c; };
/* The swatches live inside the header's collapsed "Display" <details>, so a
   real click needs it open first — which is also how a person reaches them. */
/* H6. This used to open the <details> and measure in the same breath, with no
   settle. Run by hand it reported "the cream swatch is 0x0, under 44px" on
   /tools/ — a gate that had never been wired, so nothing had ever reported it.

   WHAT THAT WAS, STATED HONESTLY. It is a LAYOUT RACE, not a page defect. The
   page is fine: at this gate's viewport (browser.newContext() with no override,
   so 1280x720) the swatch measures 44x44 before opening <details>, immediately
   after, and after a settle — verified directly. With the settle added below the
   gate passes, and I could not reproduce the 0x0 afterwards.

   TWO THINGS I GOT WRONG ON THE WAY, RECORDED SO THE NEXT READER DOES NOT REPEAT
   THEM. First I measured at 390px, found the whole <nav class="nav mbm-site-nav">
   display:none behind its mobile toggle, and concluded the gate was measuring a
   collapsed nav. That is true AT 390px and irrelevant here, because this gate
   never runs at 390px. Second, sabotaging the toggle does NOT make this gate
   fail, which is the proof that the nav was never the cause.

   The menu-open below is therefore not the fix; the settle is. It is kept
   because it costs one click and makes the helper correct if this gate is ever
   pointed at a narrow viewport, where the nav WOULD be the blocker. */
const openPanels = async (page, sel) => {
  await page.evaluate(() => {
    const btn = document.querySelector('#menu, [aria-controls="nav"], button.menu');
    if (btn && btn.getAttribute('aria-expanded') === 'false') btn.click();
  });
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  return settle(page, sel);
};

/* N3.3. This used to be two waitForTimeout calls. A duration is not a fix: it
   asserts nothing and it is flaky by construction, which is precisely how the
   0x0 reached main. Measured with a diagnostic that touches nothing
   (tools/diagnose_swatch_layout.mjs), the cream swatch has NO layout box
   straight after load in 4 runs out of 6 in the dev container, and has its
   44x44 box in 6 of 6 once this condition is satisfied. The swatches are
   injected by theme.js at runtime, so the first one can be measured mid
   construction.

   So: wait on the CONDITION — fonts resolved, a frame rendered, and every
   swatch reporting a non-zero box — never on a duration. Returns false on
   timeout, which the caller reports as MEASUREMENT INVALID rather than as a
   size. */
const settle = async (page, sel) => {
  try {
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await page.waitForFunction((s) => {
      const n = document.querySelectorAll(s);
      if (!n.length) return false;
      return Array.from(n).every((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, sel, { timeout: 8000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return true;
  } catch (_) { return false; }
};
/* The header nav can be off-canvas at some widths, so Playwright's actionability
   check refuses the click even though the control is present and 44x44 (asserted
   separately above). Dispatch the click on the element itself: it is the same
   handler a person triggers, and the size/label assertions cover the presence
   question that a visibility-gated click would otherwise be standing in for. */
const clickSwatch = (page, sel, t) => page.evaluate(([s, v]) => {
  const el = document.querySelector(`${s}[data-t="${v}"]`);
  if (!el) throw new Error('no swatch ' + v);
  el.click();
}, [sel, t]);
const attrs = (page) => page.evaluate(() => ({
  html: document.documentElement.getAttribute('data-theme'),
  body: document.body.getAttribute('data-theme'),
  stored: (() => { try { return localStorage.getItem('mbm_reading_theme'); } catch (e) { return null; } })(),
}));

async function run(sabotage) {
  const server = await serve(sabotage);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(base + p.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const settled = await openPanels(page, p.swatch);

      // 1. the control itself
      const sw = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((b) => {
        const r = b.getBoundingClientRect();
        return { t: b.getAttribute('data-t'), pressed: b.getAttribute('aria-pressed'),
                 label: b.getAttribute('aria-label'), title: b.getAttribute('title'),
                 w: Math.round(r.width), h: Math.round(r.height) };
      }), p.swatch);
      assert(sw.length === 6, `${p.label}: ${sw.length} swatches, expected 6`);
      /* N3.2 / R5. A NULL MEASUREMENT IS NOT A FAILING MEASUREMENT. 0x0 means
         the element has no layout box — it was not measured — and reporting
         that as "under 44px" sends the reader to the CSS for a size bug that
         does not exist. It did exactly that on main.

         The previous guard here required EVERY swatch to be 0x0. Exactly one
         ever is, so it never fired and the misleading size message got through:
         a guard demanding total failure cannot catch the partial kind, which is
         the only kind that happens. `some`, not `every`. */
      const nullBoxes = sw.filter((s) => s.w === 0 || s.h === 0);
      assert(nullBoxes.length === 0,
        `${p.label}: MEASUREMENT INVALID — ${nullBoxes.length} of ${sw.length} swatch(es) have no layout box ` +
        `(${nullBoxes.map((s) => `${s.t} ${s.w}x${s.h}`).join(', ')}). They were NOT measured, so nothing is known ` +
        `about their size. ${settled ? 'The settle condition was satisfied, so this is not a race — look for a hidden ancestor.' : 'The settle condition TIMED OUT: no frame arrived with every swatch boxed.'}`);
      assert(sw.map((s) => s.t).join(',') === ORDER.join(','),
        `${p.label}: swatch order is ${sw.map((s) => s.t).join(',')}`);
      for (const s of sw) {
        /* Only a swatch that HAS a box is asked about its size; a null box is
           reported above as MEASUREMENT INVALID and must never be restated here
           as a size, which is the conflation R5 forbids. */
        if (s.w !== 0 && s.h !== 0) {
          assert(s.w >= 44 && s.h >= 44, `${p.label}: UNDER 44PX — the ${s.t} swatch measured ${s.w}x${s.h}`);
        }
        assert(!!s.label, `${p.label}: the ${s.t} swatch has no aria-label`);
        assert(s.pressed === 'true' || s.pressed === 'false',
          `${p.label}: the ${s.t} swatch has no aria-pressed`);
      }
      const hl = sw.find((s) => s.t === 'highlumen');
      if (hl) assert(/high lumen/i.test(hl.label || '') && /high lumen/i.test(hl.title || ''),
        `${p.label}: the sixth swatch is labelled ${JSON.stringify(hl.label)} / ${JSON.stringify(hl.title)}`);

      // 2 + 3. choose it, and reload
      await clickSwatch(page, p.swatch, 'highlumen');
      await page.waitForTimeout(250);
      let a = await attrs(page);
      assert(a.html === 'highlumen' && a.body === 'highlumen',
        `${p.label}: after choosing, data-theme is html=${a.html} body=${a.body} — it must be on both`);
      assert(a.stored === 'highlumen', `${p.label}: stored value is ${a.stored}`);
      assert(await page.evaluate((sel) =>
        document.querySelector(`${sel}[data-t="highlumen"]`).getAttribute('aria-pressed') === 'true', p.swatch),
        `${p.label}: the chosen swatch is not aria-pressed`);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      await openPanels(page, p.swatch);
      a = await attrs(page);
      assert(a.html === 'highlumen' && a.body === 'highlumen',
        `${p.label}: after reload, data-theme is html=${a.html} body=${a.body}`);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert(bg === 'rgb(255, 255, 255)', `${p.label}: after reload the ground is ${bg}`);

      // 5. the five that were already there
      for (const t of ['pink', 'blue', 'light', 'dark']) {
        await clickSwatch(page, p.swatch, t);
        await page.waitForTimeout(200);
        const s = await attrs(page);
        assert(s.html === t && s.body === t, `${p.label}: ${t} sets html=${s.html} body=${s.body}`);
      }

      // 4. Warm resets, and clears the attribute rather than naming itself
      await clickSwatch(page, p.swatch, 'cream');
      await page.waitForTimeout(250);
      a = await attrs(page);
      assert(a.html === null && a.body === null,
        `${p.label}: Warm left data-theme as html=${a.html} body=${a.body}, expected it removed`);
      assert(a.stored === 'cream', `${p.label}: Warm stored ${a.stored}`);

      // 6. an unknown stored value still degrades to the default
      await page.evaluate(() => { try { localStorage.setItem('mbm_reading_theme', 'not-a-theme'); } catch (e) {} });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      a = await attrs(page);
      assert(a.html === null && a.body === null,
        `${p.label}: an unknown stored value produced html=${a.html} body=${a.body}`);

      rows.push({ label: p.label, swatches: sw.length });
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
}

if (SELFTEST) {
  const mark = failures.length;
  // A missing swatch makes clickSwatch throw. That IS the finding, so record it
  // rather than letting it escape as an uncaught exception.
  try { await run(true); } catch (e) { failures.push('self-test: ' + e.message.split('\n')[0]); }
  const caught = failures.length - mark;
  failures.length = mark; rows.length = 0;
  if (caught === 0) {
    console.error('[FAIL] self-test: the gate passed an engine with the sixth value removed');
    process.exit(1);
  }
  console.log(`[PASS] self-test: ${caught} finding(s) raised with the sixth value stripped from the engine`);
}

await run(false);
for (const r of rows) console.log(`  ${r.swatches} swatches, applies, persists, reloads, resets — ${r.label}`);
if (failures.length) {
  console.error(`\n[FAIL] High-Lumen behaviour — ${failures.length} finding(s):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n[PASS] High-Lumen behaviour: six swatches on every engine, applies to html and body, ' +
            'persists across reload, Warm resets, the five existing themes untouched');
