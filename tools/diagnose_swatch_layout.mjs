#!/usr/bin/env node
/*
 * N3.1 / R6 — harness or page?
 *
 * verify_highlumen_behaviour.mjs reports "the cream swatch is 0x0" on a GitHub
 * runner and never in the dev container. Exactly ONE of six collapses, which
 * rules out the whole container being hidden and is what makes this worth
 * measuring rather than guessing.
 *
 * This does not assert anything. It MEASURES, at three moments, and prints
 * everything needed to tell the two apart:
 *
 *   A. straight after load, with NOTHING touched — this is what a real visitor
 *      gets. A zero box here is a PAGE defect: a live zero-size tap target.
 *   B. after the harness opens <details>, which is what the gate does.
 *   C. after waiting on the CONDITION (every box non-zero), not a duration.
 *
 * If A is zero and C is non-zero, the box is arriving late and the gate raced
 * it — harness. If A and C are both zero, the page really serves a zero-size
 * control — page.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) {}
  }
  console.error('playwright not found'); process.exit(2);
}
const { chromium } = loadPlaywright();
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const f = path.join(SITE, rel);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

/* Every box, plus WHY a box might be missing: the ancestor chain's computed
   display/visibility, whether an enclosing <details> is shut, and whether the
   element has an offsetParent at all. */
const MEASURE = (sel) => Array.from(document.querySelectorAll(sel)).map((b, i) => {
  const r = b.getBoundingClientRect();
  const cs = getComputedStyle(b);
  const chain = [];
  for (let el = b.parentElement; el && el !== document.body; el = el.parentElement) {
    const s = getComputedStyle(el);
    chain.push({
      tag: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : ''),
      display: s.display, visibility: s.visibility,
      open: el.tagName === 'DETAILS' ? el.open : undefined,
      w: Math.round(el.getBoundingClientRect().width),
    });
  }
  return {
    i, t: b.getAttribute('data-t'),
    w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    display: cs.display, visibility: cs.visibility,
    offsetParent: !!b.offsetParent,
    closedDetails: chain.filter((c) => c.open === false).length,
    hiddenAncestor: chain.find((c) => c.display === 'none' || c.visibility === 'hidden') || null,
  };
});

const PAGES = [
  { label: 'tools (site /theme.js)',   url: '/tools/index.html', sel: '.mbm-sw' },
  { label: 'homepage (inline engine)', url: '/main/index.html',  sel: '.dx-sw'  },
];

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let anyZeroAtA = false, anyZeroAtC = false;
try {
  for (const p of PAGES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + p.url, { waitUntil: 'domcontentloaded' });

    const A = await page.evaluate(MEASURE, p.sel);
    const fonts = await page.evaluate(() => (document.fonts ? document.fonts.status : 'n/a'));
    await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const B = await page.evaluate(MEASURE, p.sel);

    // C: wait on the CONDITION, never a duration.
    let cOk = true;
    try {
      await page.waitForFunction((sel) => {
        const n = document.querySelectorAll(sel);
        return n.length > 0 && Array.from(n).every((b) => b.getBoundingClientRect().width > 0);
      }, p.sel, { timeout: 5000 });
    } catch (_) { cOk = false; }
    const C = await page.evaluate(MEASURE, p.sel);

    const zeros = (rows) => rows.filter((r) => r.w === 0 || r.h === 0).map((r) => `${r.i}:${r.t}`);
    console.log(`\n=== ${p.label}  (${p.url})   document.fonts.status=${fonts}`);
    console.log(`  A untouched     ${A.length} swatches, zero-box: ${zeros(A).join(',') || 'none'}`);
    console.log(`  B details open  ${B.length} swatches, zero-box: ${zeros(B).join(',') || 'none'}`);
    console.log(`  C condition met ${C.length} swatches, zero-box: ${zeros(C).join(',') || 'none'}  (waitForFunction ${cOk ? 'satisfied' : 'TIMED OUT'})`);
    if (zeros(A).length) anyZeroAtA = true;
    if (zeros(C).length) anyZeroAtC = true;
    for (const row of C) {
      console.log(`     [${row.i}] ${String(row.t).padEnd(10)} ${String(row.w).padStart(6)}x${String(row.h).padEnd(6)} ` +
        `display=${row.display} vis=${row.visibility} offsetParent=${row.offsetParent} ` +
        `closedDetails=${row.closedDetails}` + (row.hiddenAncestor ? `  HIDDEN BY ${row.hiddenAncestor.tag} (${row.hiddenAncestor.display}/${row.hiddenAncestor.visibility})` : ''));
    }
    await ctx.close();
  }
} finally { await browser.close(); server.close(); }

console.log('\n---------------- VERDICT ----------------');
if (anyZeroAtC)      console.log('PAGE: a swatch has no layout box even once the condition is waited for.');
else if (anyZeroAtA) console.log('HARNESS: zero at load, non-zero once the condition is met — the box arrives late and the gate raced it.');
else                 console.log('NEITHER REPRODUCED HERE: every swatch had a box at every moment.');
