#!/usr/bin/env node
'use strict';
/**
 * Neon Breach — rendered browser contract.
 *
 * Identity is DERIVED from the source harness, never duplicated here: the
 * pinned-input hash is read out of tools/verify_neonbreach.js so the two gates
 * can never disagree about which file they judge.
 *
 * Three routes, each of which the source harness can only assert statically:
 *   B1  sibling-save isolation across a real play/save cycle
 *   B2  the no-WebGL path presents a readable fallback
 *   B3  hidden-tab auto-pause
 *
 * Every route is driven by real user actions (element clicks), never by
 * reaching into game internals.
 *
 * Usage:  node tools/verify_neonbreach_browser.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require('playwright-core')); }

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.NB_GAME || 'neonbreach/index.html';
const SOURCE_HARNESS = path.join(ROOT, 'tools', 'verify_neonbreach.js');
const sourceHarness = fs.readFileSync(SOURCE_HARNESS, 'utf8');
const pin = /const\s+PINNED_SHA\s*=\s*['"]([0-9a-f]{64})['"]/.exec(sourceHarness);
if (!pin) throw new Error('source-harness pinned-input hash missing');
const PINNED_SHA = pin[1];

// Resolve the browser binary: CI installs playwright normally, the container
// ships a prebuilt Chromium under PLAYWRIGHT_BROWSERS_PATH.
function launchOpts() {
  const o = { headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    const dir = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
    const exe = dir && path.join(base, dir, 'chrome-linux', 'chrome');
    if (exe && fs.existsSync(exe)) o.executablePath = exe;
  }
  return o;
}

// Seeded from the estate's real key families, not invented.
const SIBLINGS = {
  'apexkick.v1': '{"best":12}',
  'mbm_apexpool_progress': '{"frames":7}',
  'mbm_apexgolf_progress': '{"holes":9}',
  'mbm_apextennis_progress': '{"sets":2}',
  'mbm_biopunkhive_save': '{"mutagens":3}',
  'mbm_neonsync_save': '{"rank":"gold","hero":"volt"}',
  'mbm_medevac_v1': '{"missions":3}',
  'voxelfrontier.world.v2': '{"seed":7}',
};
const OWN_KEY = 'madebymatt.neonBreach.v1';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  cond ? pass++ : fail++;
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

const snapshot = page => page.evaluate(own => JSON.stringify(Object.fromEntries(
  Object.entries(localStorage).filter(([k]) => k !== own).sort())), OWN_KEY);

(async () => {
  const crypto = require('crypto');
  const html = fs.readFileSync(path.join(ROOT, GAME), 'utf8');
  const block = /  <!-- canonical\/og added on landing[\s\S]*?og:description"[^>]*>\n/.exec(html);
  const derived = block ? html.replace(block[0], '') : html;
  ok('derived-identity-matches-source-harness-pin',
    crypto.createHash('sha256').update(derived).digest('hex') === PINNED_SHA, PINNED_SHA.slice(0, 12) + '…');

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(launchOpts());

  /* -------------------------------------------------------------- B1 */
  console.log('\nB1 — sibling-save isolation across a real play/save cycle');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + '/neonbreach/');
    await page.evaluate(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SIBLINGS);
    const before = await snapshot(page);

    await page.reload();
    await page.waitForTimeout(1000);

    const equipped = await page.evaluate(() => {
      const b = document.querySelector('#skin-grid button:not([disabled])');
      if (!b) return false; b.click(); return true;
    });
    await page.waitForTimeout(300);
    const savedOnEquip = await page.evaluate(k => !!localStorage.getItem(k), OWN_KEY);

    const started = await page.evaluate(() => {
      const b = document.getElementById('start-btn');
      if (!b) return false; b.click(); return true;
    });
    await page.waitForTimeout(3000);

    const toggled = await page.evaluate(() => {
      const b = document.getElementById('start-audio-btn') || document.getElementById('pause-audio-btn');
      if (!b) return false; b.click(); return true;
    });
    await page.waitForTimeout(400);

    const own = await page.evaluate(k => localStorage.getItem(k), OWN_KEY);
    const after = await snapshot(page);

    ok('skin-equipped-by-real-click', equipped);
    ok('save-written-on-equip', savedOnEquip, OWN_KEY);
    ok('run-started-by-real-click', started);
    ok('setting-toggled-by-real-click', toggled);
    ok('own-key-persisted-after-cycle', !!own && JSON.parse(own).version === 1);
    ok('sibling-keys-byte-unmoved', before === after);
    if (before !== after) console.log('    before ' + before + '\n    after  ' + after);
    const stray = await page.evaluate(seeded => Object.keys(localStorage)
      .filter(k => k !== 'madebymatt.neonBreach.v1' && !seeded.includes(k)), Object.keys(SIBLINGS));
    ok('no-foreign-keys-minted', stray.length === 0, stray.join(',') || 'none');
    await ctx.close();
  }

  /* -------------------------------------------------------------- B2 */
  console.log('\nB2 — no-WebGL path presents a readable fallback');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = function () { return null; }; });
    await page.goto(base + '/neonbreach/');
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => {
      const o = document.getElementById('fatal-overlay');
      if (!o) return { present: false };
      const cs = getComputedStyle(o);
      return {
        present: true, hidden: o.hidden, display: cs.display, visibility: cs.visibility,
        heading: (o.querySelector('h1,h2,h3') || {}).textContent?.trim(),
        copy: (o.querySelector('#fatal-copy') || {}).textContent?.trim(),
        height: o.getBoundingClientRect().height,
        titles: document.querySelectorAll('#fatal-overlay h1, #fatal-overlay h2, #fatal-overlay h3').length,
      };
    });
    ok('fallback-overlay-present', st.present);
    ok('fallback-revealed', st.hidden === false && st.display !== 'none' && st.visibility !== 'hidden',
      `hidden=${st.hidden} display=${st.display}`);
    ok('fallback-actually-painted', st.height > 0, st.height + 'px');
    ok('fallback-heading-readable', /webgl/i.test(st.heading || ''), st.heading);
    ok('fallback-copy-actionable', /chrome|edge|firefox|safari/i.test(st.copy || ''));
    // The two-copies trap: one title element serves the fallback, and it is
    // not a second copy of the game's own title.
    ok('single-fallback-title-source', st.titles === 1, st.titles + ' heading(s)');
    await ctx.close();
  }

  /* -------------------------------------------------------------- B3 */
  console.log('\nB3 — hidden-tab auto-pause');
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + '/neonbreach/');
    await page.waitForTimeout(900);
    await page.evaluate(() => { const b = document.getElementById('start-btn'); if (b) b.click(); });
    await page.waitForTimeout(2000);
    const playing = await page.evaluate(() => {
      const p = document.getElementById('pause-overlay'); return p ? p.hidden : null;
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(600);
    const hiddenState = await page.evaluate(() => {
      const p = document.getElementById('pause-overlay');
      return { exists: !!p, hidden: p ? p.hidden : null };
    });
    ok('pause-overlay-exists', hiddenState.exists);
    ok('not-paused-while-visible', playing !== false, 'pauseHidden=' + playing);
    ok('auto-paused-when-hidden', hiddenState.hidden === false, 'pauseHidden=' + hiddenState.hidden);
    await ctx.close();
  }

  await browser.close();
  server.close();

  console.log('\n' + '='.repeat(66));
  console.log(fail ? `${pass} passed, ${fail} FAILED` : `ALL ${pass} NEON BREACH BROWSER CHECKS PASSED`);
  console.log('='.repeat(66));
  console.log(`BROWSER_PASS=${fail ? 'false' : 'true'}`);
  console.log(`BROWSER_ROUTES=${pass + fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('browser gate error: ' + e.stack); process.exit(2); });
