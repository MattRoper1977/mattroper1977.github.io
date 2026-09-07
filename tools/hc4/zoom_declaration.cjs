#!/usr/bin/env node
/*
 * zoom_declaration.cjs — Order HC4 §3.3 declaration gate (static + computed-style).
 *
 *   node zoom_declaration.cjs --population population.json --edu http://127.0.0.1:4612 --play http://127.0.0.1:4611 --out declaration.json
 *
 * For each route:
 *  (a) STATIC: fetch the served HTML, parse <meta name="viewport"> content.
 *      FAIL if it contains user-scalable=no / user-scalable=0, or maximum-scale < 5. PASS otherwise.
 *  (b) COMPUTED: load under mobile emulation (390x844, isMobile, hasTouch), find the primary
 *      canvas/stage element (largest <canvas> by rendered area, else elementFromPoint at the viewport
 *      centre), record getComputedStyle(el).touchAction for it and every ancestor up to <html>.
 *      PASS iff every value in the chain is 'auto' or includes 'pinch-zoom' or is 'manipulation'
 *      ('manipulation' permits pinch-zoom per spec; recorded and flagged separately).
 *
 * Before the population, a three-run control on a local scratch page is executed:
 *   real (auto) PASS -> planted (user-scalable=no + touch-action:none) FAIL -> restored PASS.
 * The script exits non-zero if the control does not behave that way.
 */
'use strict';
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

// ------------------------------------------------------------- (a) static
function parseViewport(html) {
  // find <meta ... name="viewport" ...> in any attribute order
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  for (const m of metas) {
    if (!/name\s*=\s*["']?viewport["']?/i.test(m)) continue;
    const c = m.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    return c ? (c[1] ?? c[2] ?? c[3]) : '';
  }
  return null;
}
function staticGate(content) {
  const reasons = [];
  if (content == null) return { pass: true, viewportMeta: null, reasons: ['no viewport meta (browser default: zoomable)'] };
  const parts = content.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const [k, v] = p.split('=').map(s => (s || '').trim().toLowerCase());
    if (k === 'user-scalable' && (v === 'no' || v === '0')) reasons.push(`user-scalable=${v}`);
    if (k === 'maximum-scale') { const n = parseFloat(v); if (!(n >= 5)) reasons.push(`maximum-scale=${v} (<5)`); }
  }
  return { pass: reasons.length === 0, viewportMeta: content, reasons };
}
function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); }).on('error', reject);
  });
}

// ------------------------------------------------------------- (b) computed
const CHAIN_OK = v => v === 'auto' || v === 'manipulation' || v.split(/\s+/).includes('pinch-zoom');
async function computedGate(browser, url) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const page = await context.newPage();
  const out = { url };
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    out.status = resp && resp.status();
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const desc = e => e.tagName + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
      let el = null, how = null;
      const canvases = Array.from(document.querySelectorAll('canvas')).map(c => { const r = c.getBoundingClientRect(); return { c, area: r.width * r.height }; }).filter(x => x.area > 0).sort((a, b) => b.area - a.area);
      if (canvases.length) { el = canvases[0].c; how = 'largest-canvas'; }
      else { el = document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body; how = 'elementFromPoint(centre)'; }
      const chain = [];
      let e = el;
      while (e) { chain.push({ el: desc(e), touchAction: getComputedStyle(e).touchAction }); e = e.parentElement; }
      const meta = document.querySelector('meta[name="viewport"]');
      return { primary: desc(el), primaryHow: how, chain, liveViewportMeta: meta ? meta.getAttribute('content') : null, canvasCount: document.querySelectorAll('canvas').length };
    });
    Object.assign(out, info);
    const bad = out.chain.filter(x => !CHAIN_OK(x.touchAction));
    out.manipulation = out.chain.filter(x => x.touchAction === 'manipulation').map(x => x.el);
    out.pass = bad.length === 0;
    out.reasons = bad.map(x => `${x.el} touch-action:${x.touchAction}`);
  } catch (e) { out.pass = false; out.error = String(e.message || e); out.reasons = ['load error: ' + out.error]; }
  finally { await context.close().catch(() => {}); }
  return out;
}

async function gateRoute(browser, base, route, extra) {
  const url = base + route;
  const { status, body } = await fetchText(url);
  const st = staticGate(parseViewport(body));
  const cp = await computedGate(browser, url);
  return Object.assign({ route, url, httpStatus: status }, extra || {}, {
    static: st, computed: cp,
    pass: st.pass && cp.pass,
    reasons: [...st.reasons.map(r => 'static: ' + r), ...cp.reasons.map(r => 'computed: ' + r)],
    manipulationFlag: cp.manipulation && cp.manipulation.length ? cp.manipulation : undefined,
  });
}

// ------------------------------------------------------------- control
const REAL = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ctl</title>
<style>html,body{margin:0}canvas{display:block;width:100vw;height:60vh}</style></head><body><canvas id="stage"></canvas><p>control</p></body></html>`;
const PLANTED = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"><title>ctl</title>
<style>html,body{margin:0;touch-action:none}canvas{display:block;width:100vw;height:60vh}</style></head><body><canvas id="stage"></canvas><p>control</p></body></html>`;
function controlServer() {
  let mode = 'real';
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(mode === 'planted' ? PLANTED : REAL); });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, setMode: m => { mode = m; } }));
  });
}

(async () => {
  const popFile = arg('--population'), edu = arg('--edu'), play = arg('--play'), outFile = arg('--out', 'declaration.json');
  const browser = await chromium.launch({ headless: true });
  const result = { generatedAt: new Date().toISOString(), browserVersion: browser.version(), rule: {
    static: 'FAIL if viewport meta has user-scalable=no|0 or maximum-scale<5',
    computed: "PASS iff computed touch-action of primary element and every ancestor to html is 'auto' | contains 'pinch-zoom' | 'manipulation' (flagged)" },
    control: { runs: [], pass: false }, routes: [] };
  try {
    // --- control
    const { srv, port, setMode } = await controlServer();
    const base = `http://127.0.0.1:${port}`;
    const seq = [['real-1', 'real', true], ['planted', 'planted', false], ['restored', 'real', true]];
    for (const [label, mode, expectPass] of seq) {
      setMode(mode);
      const r = await gateRoute(browser, base, '/control.html', { label, expectPass });
      r.controlOk = r.pass === expectPass;
      result.control.runs.push(r);
      console.error(`[control ${label}] static=${r.static.pass} computed=${r.computed.pass} => pass=${r.pass} expected=${expectPass} ${r.controlOk ? 'OK' : 'MISMATCH'} ${r.reasons.join('; ')}`);
    }
    srv.close();
    result.control.pass = result.control.runs.every(r => r.controlOk);
    if (!result.control.pass) { fs.writeFileSync(outFile, JSON.stringify(result, null, 2)); console.error('CONTROL FAILED'); process.exit(2); }
    // --- population
    if (popFile) {
      const pop = JSON.parse(fs.readFileSync(popFile, 'utf8'));
      for (const row of pop.routes) {
        const origin = row.kind === 'education' ? edu : play;
        const r = await gateRoute(browser, origin, row.route, { kind: row.kind, repo: row.repo, path: row.path, pr: row.pr });
        result.routes.push(r);
        console.error(`[${row.kind}] ${row.route} static=${r.static.pass} computed=${r.computed.pass} primary=${r.computed.primary} => ${r.pass ? 'PASS' : 'FAIL'} ${r.reasons.join('; ')}${r.manipulationFlag ? ' [manipulation: ' + r.manipulationFlag.join(',') + ']' : ''}`);
      }
      result.summary = { total: result.routes.length, pass: result.routes.filter(r => r.pass).length, fail: result.routes.filter(r => !r.pass).map(r => ({ route: r.route, reasons: r.reasons })),
        manipulationFlagged: result.routes.filter(r => r.manipulationFlag).map(r => ({ route: r.route, elements: r.manipulationFlag })) };
    }
  } finally { await browser.close().catch(() => {}); }
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ control: result.control.pass, summary: result.summary }));
  process.exit(result.control.pass ? 0 : 2);
})().catch(e => { console.error(e); process.exit(1); });
