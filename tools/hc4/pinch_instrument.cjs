#!/usr/bin/env node
/*
 * pinch_instrument.cjs — headless pinch-zoom measurement instrument.
 *
 *   node pinch_instrument.cjs --control [--variant NAME] [--out controls.json]
 *       runs positive -> negative -> positive controls, writes controls.json,
 *       exits non-zero if any control fails.
 *   node pinch_instrument.cjs --explore [--out attempts.json]
 *       runs every variant in the matrix (each as a child process, headed ones
 *       under xvfb-run), records outcomes to attempts.json, stops at the first
 *       variant that passes all three control runs.
 *   node pinch_instrument.cjs --url URL --out result.json [--variant NAME]
 *       measures one URL: route, scaleBefore, scaleAfter, method, viewport meta,
 *       computed touch-action at the pinch point.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const VIEWPORT = { width: 390, height: 844 };
const DSF = 3;
const PINCH = { x: 195, y: 400, scaleFactor: 2.5, relativeSpeed: 400 };
const SETTLE_MS = 1500;

// ---------------------------------------------------------------- variants
// Each variant is a combination of launch options + pinch method preferences.
const VARIANTS = {
  // (a) synthesizePinchGesture touch vs default, headless shell
  'shell-synth-touch':   { launch: { headless: true }, methods: ['synth:touch'] },
  'shell-synth-default': { launch: { headless: true }, methods: ['synth:default'] },
  // (c) new headless (channel:'chromium' => --headless=new in PW 1.56) and explicit arg
  'new-synth-touch':     { launch: { headless: true, channel: 'chromium' }, methods: ['synth:touch'] },
  'new-synth-default':   { launch: { headless: true, channel: 'chromium' }, methods: ['synth:default'] },
  'newarg-synth-touch':  { launch: { headless: true, args: ['--headless=new'] }, methods: ['synth:touch'] },
  // (b) touch / scroll-latching / force-dsf args
  'new-args-b-synth-touch': { launch: { headless: true, channel: 'chromium',
      args: ['--touch-events=enabled', '--enable-features=TouchpadAndWheelScrollLatching', '--force-device-scale-factor=3'] },
      methods: ['synth:touch'] },
  'shell-args-b-synth-touch': { launch: { headless: true,
      args: ['--touch-events=enabled', '--enable-features=TouchpadAndWheelScrollLatching', '--force-device-scale-factor=3'] },
      methods: ['synth:touch'] },
  // (d) explicit Emulation.setDeviceMetricsOverride + setEmitTouchEventsForMouse
  'new-devmetrics-synth-touch': { launch: { headless: true, channel: 'chromium' }, devMetrics: true, methods: ['synth:touch'] },
  'shell-devmetrics-synth-touch': { launch: { headless: true }, devMetrics: true, methods: ['synth:touch'] },
  // (e) dispatchTouchEvent with force:1, more/longer steps
  'new-dispatch-force':  { launch: { headless: true, channel: 'chromium' }, methods: ['dispatch:force'] },
  'shell-dispatch-force':{ launch: { headless: true }, methods: ['dispatch:force'] },
  'new-dispatch-plain':  { launch: { headless: true, channel: 'chromium' }, methods: ['dispatch:plain'] },
  // (f) --enable-pinch / --enable-viewport
  'new-args-f-synth-touch': { launch: { headless: true, channel: 'chromium', args: ['--enable-pinch', '--enable-viewport'] }, methods: ['synth:touch'] },
  'shell-args-f-synth-touch': { launch: { headless: true, args: ['--enable-pinch', '--enable-viewport'] }, methods: ['synth:touch'] },
  // headed under xvfb
  'headed-synth-touch':  { launch: { headless: false }, headed: true, methods: ['synth:touch'] },
  'headed-dispatch-force': { launch: { headless: false }, headed: true, methods: ['dispatch:force'] },
  // VALIDATED default: synth 'default' first (the one that works), then the spec's primary/fallback as fallbacks
  'shell-chain-default': { launch: { headless: true }, methods: ['synth:default', 'synth:touch', 'dispatch:force'] },
  // combined fallback chain: synth touch, then synth default, then dispatch
  'new-chain':           { launch: { headless: true, channel: 'chromium' }, methods: ['synth:touch', 'synth:default', 'dispatch:force'] },
  'shell-chain':         { launch: { headless: true }, methods: ['synth:touch', 'synth:default', 'dispatch:force'] },
};
const DEFAULT_VARIANT = 'shell-chain-default';

// ---------------------------------------------------------------- control pages
const POS_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>positive control</title>
<style>html,body{margin:0}body{min-height:200vh;font:16px sans-serif}</style>
</head><body><h1>positive control</h1><p>pinch here</p></body></html>`;
const NEG_HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,maximum-scale=1">
<title>negative control</title>
<style>html,body{margin:0;touch-action:none}body{min-height:200vh;font:16px sans-serif}</style>
</head><body><h1>negative control</h1><p>pinch here</p></body></html>`;

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const body = req.url.startsWith('/neg') ? NEG_HTML : POS_HTML;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(body);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// ---------------------------------------------------------------- measurement
async function readScales(page, cdp) {
  const js = await page.evaluate(() => ({
    scale: window.visualViewport ? window.visualViewport.scale : null,
    width: window.visualViewport ? window.visualViewport.width : null,
    innerWidth: window.innerWidth,
  }));
  let lm = null;
  try {
    const m = await cdp.send('Page.getLayoutMetrics');
    lm = {
      visualViewportScale: m.visualViewport && m.visualViewport.scale,
      cssVisualViewportScale: m.cssVisualViewport && m.cssVisualViewport.scale,
      visualViewportClientWidth: m.visualViewport && m.visualViewport.clientWidth,
      cssVisualViewportClientWidth: m.cssVisualViewport && m.cssVisualViewport.clientWidth,
      pageScaleFactor: m.visualViewport && m.visualViewport.scale, // CDP exposes page scale as visualViewport.scale
    };
  } catch (e) { lm = { error: String(e.message || e) }; }
  return { js, cdp: lm };
}

async function pollScale(page, cdp, ms) {
  const t0 = Date.now();
  const samples = [];
  let last = null;
  while (Date.now() - t0 <= ms) {
    const s = await readScales(page, cdp);
    samples.push({ t: Date.now() - t0, js: s.js.scale, cdp: s.cdp.visualViewportScale });
    last = s;
    if (s.js.scale && s.js.scale > 1.0 && samples.length > 3) {
      // keep polling briefly to let it settle, but no need for the full window
      const s2 = await readScales(page, cdp); samples.push({ t: Date.now() - t0, js: s2.js.scale, cdp: s2.cdp.visualViewportScale });
      last = s2;
    }
    await page.waitForTimeout(100);
  }
  return { final: last, samples };
}

// ---------------------------------------------------------------- gestures
async function synthPinch(cdp, sourceType) {
  await cdp.send('Input.synthesizePinchGesture', {
    x: PINCH.x, y: PINCH.y, scaleFactor: PINCH.scaleFactor, relativeSpeed: PINCH.relativeSpeed,
    gestureSourceType: sourceType,
  });
}

async function dispatchPinch(cdp, opts) {
  const { force, steps, stepDelay } = opts;
  const cx = PINCH.x, cy = PINCH.y;
  const startGap = 40, endGap = 300;
  const mk = (gap, extra) => ([
    { x: cx - gap / 2, y: cy, id: 0, radiusX: 8, radiusY: 8, ...(extra || {}) },
    { x: cx + gap / 2, y: cy, id: 1, radiusX: 8, radiusY: 8, ...(extra || {}) },
  ]);
  const extra = force ? { force: 1 } : {};
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: mk(startGap, extra) });
  for (let i = 1; i <= steps; i++) {
    const gap = startGap + (endGap - startGap) * (i / steps);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: mk(gap, extra) });
    if (stepDelay) await new Promise(r => setTimeout(r, stepDelay));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function runMethod(name, cdp) {
  if (name === 'synth:touch') return synthPinch(cdp, 'touch');
  if (name === 'synth:default') return synthPinch(cdp, 'default');
  if (name === 'dispatch:force') return dispatchPinch(cdp, { force: true, steps: 30, stepDelay: 16 });
  if (name === 'dispatch:plain') return dispatchPinch(cdp, { force: false, steps: 15, stepDelay: 0 });
  throw new Error('unknown method ' + name);
}

// ---------------------------------------------------------------- one measurement
async function measure(browser, variant, url, label) {
  const context = await browser.newContext({
    viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: DSF,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const rec = { label, url, variant: variant.name, startedAt: new Date().toISOString(), methodsTried: [] };
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (variant.devMetrics) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: DSF, mobile: true,
        screenWidth: VIEWPORT.width, screenHeight: VIEWPORT.height, positionX: 0, positionY: 0,
        screenOrientation: { type: 'portraitPrimary', angle: 0 },
      });
      await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    }
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    rec.status = resp && resp.status();
    rec.finalUrl = page.url();
    await page.waitForTimeout(300);
    rec.pageInfo = await page.evaluate(({ x, y }) => {
      const meta = document.querySelector('meta[name="viewport"]');
      const el = document.elementFromPoint(x, y);
      const chain = [];
      let e = el;
      while (e) { chain.push({ tag: e.tagName, touchAction: getComputedStyle(e).touchAction }); e = e.parentElement; }
      return {
        viewportMeta: meta ? meta.getAttribute('content') : null,
        elementAtPinchPoint: el ? el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).filter(Boolean).join('.') : '') : null,
        touchActionAtPinchPoint: el ? getComputedStyle(el).touchAction : null,
        touchActionChain: chain,
        htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
        bodyTouchAction: document.body ? getComputedStyle(document.body).touchAction : null,
        innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio,
        maxTouchPoints: navigator.maxTouchPoints,
      };
    }, PINCH);
    rec.before = await readScales(page, cdp);
    rec.scaleBefore = rec.before.js.scale;

    let worked = null;
    for (const m of variant.methods) {
      const attempt = { method: m };
      try {
        const t0 = Date.now();
        await runMethod(m, cdp);
        attempt.gestureMs = Date.now() - t0;
        const polled = await pollScale(page, cdp, SETTLE_MS);
        attempt.after = polled.final;
        attempt.samples = polled.samples;
        attempt.scaleAfterJs = polled.final.js.scale;
        attempt.scaleAfterCdp = polled.final.cdp.visualViewportScale;
        attempt.changed = attempt.scaleAfterJs !== rec.scaleBefore;
      } catch (e) {
        attempt.error = String(e.message || e);
      }
      rec.methodsTried.push(attempt);
      if (attempt.changed) { worked = attempt; break; }
      // reset zoom between methods so the next method starts at scale 1
      try { await cdp.send('Emulation.resetPageScaleFactor'); await page.waitForTimeout(150); } catch (_) {}
    }
    const last = worked || rec.methodsTried[rec.methodsTried.length - 1];
    rec.method = worked ? worked.method : null;
    rec.after = last && last.after || null;
    rec.scaleAfter = last && last.scaleAfterJs != null ? last.scaleAfterJs : null;
    rec.scaleAfterCdp = last && last.scaleAfterCdp != null ? last.scaleAfterCdp : null;
  } catch (e) {
    rec.error = String(e.stack || e);
  } finally {
    await context.close().catch(() => {});
  }
  rec.finishedAt = new Date().toISOString();
  return rec;
}

async function launch(variant) {
  const opts = Object.assign({}, variant.launch);
  opts.args = (opts.args || []).slice();
  return chromium.launch(opts);
}

// ---------------------------------------------------------------- controls
async function runControls(variantName, outFile) {
  const variant = Object.assign({ name: variantName }, VARIANTS[variantName]);
  if (!VARIANTS[variantName]) throw new Error('unknown variant ' + variantName);
  const { srv, port } = await startServer();
  const posUrl = `http://127.0.0.1:${port}/pos`, negUrl = `http://127.0.0.1:${port}/neg`;
  const result = { variant: variantName, launch: variant.launch, devMetrics: !!variant.devMetrics, methods: variant.methods,
    node: process.version, playwright: require('/opt/node22/lib/node_modules/playwright/package.json').version,
    display: process.env.DISPLAY || null, port, runs: [], pass: false };
  let browser;
  try {
    browser = await launch(variant);
    result.browserVersion = browser.version();
    const seq = [['positive-1', posUrl, 'pos'], ['negative-1', negUrl, 'neg'], ['positive-2', posUrl, 'pos']];
    for (const [label, url, kind] of seq) {
      const r = await measure(browser, variant, url, label);
      r.kind = kind;
      const js = r.scaleAfter, cdpS = r.scaleAfterCdp;
      if (kind === 'pos') {
        r.expect = 'scaleAfter >= 1.5 (must exceed 1.0)';
        r.pass = typeof js === 'number' && js > 1.0 && js >= 1.5 && typeof cdpS === 'number' && cdpS > 1.0;
        r.passNote = typeof js === 'number' && js > 1.0 && js < 1.5 ? 'exceeded 1.0 but below 1.5 target' : undefined;
      } else {
        r.expect = 'scaleAfter === 1.0 exactly (js and cdp)';
        r.pass = js === 1 && cdpS === 1 && r.scaleBefore === 1;
      }
      result.runs.push(r);
      console.error(`[${variantName}] ${label}: before=${r.scaleBefore} after(js)=${js} after(cdp)=${cdpS} method=${r.method} pass=${r.pass}${r.error ? ' ERROR ' + r.error.split('\n')[0] : ''}`);
    }
    result.pass = result.runs.every(r => r.pass);
    result.methodUsed = result.runs.filter(r => r.kind === 'pos').map(r => r.method);
  } catch (e) {
    result.error = String(e.stack || e);
    console.error(`[${variantName}] FATAL ${result.error.split('\n')[0]}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.close();
  }
  result.finishedAt = new Date().toISOString();
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------- explore
function exploreAll(outFile) {
  const dir = __dirname;
  const attempts = [];
  const haveXvfb = spawnSync('which', ['xvfb-run']).status === 0;
  let winner = null;
  for (const name of Object.keys(VARIANTS)) {
    const v = VARIANTS[name];
    const tmp = path.join(dir, `.attempt-${name}.json`);
    const cmd = v.headed ? (haveXvfb ? 'xvfb-run' : null) : process.execPath;
    if (!cmd) { attempts.push({ variant: name, skipped: 'headed variant but xvfb-run not available' }); continue; }
    const args = v.headed ? ['-a', '-s', '-screen 0 1280x1024x24', process.execPath, __filename, '--control', '--variant', name, '--out', tmp]
                          : [__filename, '--control', '--variant', name, '--out', tmp];
    console.error(`\n=== variant ${name} (${v.headed ? 'headed under xvfb-run' : 'headless'}) ===`);
    const t0 = Date.now();
    const p = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], timeout: 180000, env: process.env });
    let res = null;
    try { res = JSON.parse(fs.readFileSync(tmp, 'utf8')); fs.unlinkSync(tmp); } catch (_) {}
    const summary = {
      variant: name, launch: v.launch, devMetrics: !!v.devMetrics, methods: v.methods, headed: !!v.headed,
      exitCode: p.status, signal: p.signal, ms: Date.now() - t0,
      pass: !!(res && res.pass),
      browserVersion: res && res.browserVersion,
      runs: res ? res.runs.map(r => ({ label: r.label, scaleBefore: r.scaleBefore, scaleAfterJs: r.scaleAfter, scaleAfterCdp: r.scaleAfterCdp,
        method: r.method, pass: r.pass, error: r.error ? r.error.split('\n')[0] : undefined,
        methodsTried: r.methodsTried.map(m => ({ method: m.method, scaleAfterJs: m.scaleAfterJs, scaleAfterCdp: m.scaleAfterCdp, error: m.error })) })) : null,
      error: res && res.error ? res.error.split('\n')[0] : (res ? undefined : 'no result file (crash/timeout)'),
    };
    attempts.push(summary);
    fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), winner, attempts }, null, 2));
    if (summary.pass) { winner = name; break; }
  }
  fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), winner, attempts }, null, 2));
  console.error(`\nexplore finished; winner=${winner}`);
  return winner;
}

// ---------------------------------------------------------------- single URL
async function measureUrl(url, variantName, outFile) {
  const variant = Object.assign({ name: variantName }, VARIANTS[variantName]);
  const browser = await launch(variant);
  try {
    const r = await measure(browser, variant, url, 'url');
    const out = {
      url, route: (() => { try { const u = new URL(r.finalUrl || url); return u.pathname + u.search + u.hash; } catch (_) { return null; } })(),
      finalUrl: r.finalUrl, status: r.status,
      scaleBefore: r.scaleBefore, scaleAfter: r.scaleAfter, scaleAfterCdp: r.scaleAfterCdp,
      zoomed: typeof r.scaleAfter === 'number' && r.scaleAfter > 1.0,
      method: r.method, methodsTried: r.methodsTried.map(m => ({ method: m.method, scaleAfterJs: m.scaleAfterJs, scaleAfterCdp: m.scaleAfterCdp, error: m.error })),
      viewportMeta: r.pageInfo && r.pageInfo.viewportMeta,
      elementAtPinchPoint: r.pageInfo && r.pageInfo.elementAtPinchPoint,
      touchActionAtPinchPoint: r.pageInfo && r.pageInfo.touchActionAtPinchPoint,
      touchActionChain: r.pageInfo && r.pageInfo.touchActionChain,
      htmlTouchAction: r.pageInfo && r.pageInfo.htmlTouchAction,
      bodyTouchAction: r.pageInfo && r.pageInfo.bodyTouchAction,
      pinchPoint: PINCH, variant: variantName, browserVersion: browser.version(),
      before: r.before, after: r.after, error: r.error, measuredAt: r.finishedAt,
    };
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ url, route: out.route, scaleBefore: out.scaleBefore, scaleAfter: out.scaleAfter, method: out.method, viewportMeta: out.viewportMeta, touchActionAtPinchPoint: out.touchActionAtPinchPoint }));
    return out;
  } finally { await browser.close().catch(() => {}); }
}

// ---------------------------------------------------------------- cli
function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
(async () => {
  const dir = __dirname;
  if (process.argv.includes('--explore')) {
    const winner = exploreAll(arg('--out', path.join(dir, 'attempts.json')));
    process.exit(winner ? 0 : 1);
  } else if (process.argv.includes('--control')) {
    const variant = arg('--variant', DEFAULT_VARIANT);
    const res = await runControls(variant, arg('--out', path.join(dir, 'controls.json')));
    console.log(JSON.stringify({ variant, pass: res.pass, runs: res.runs.map(r => ({ label: r.label, scaleBefore: r.scaleBefore, scaleAfterJs: r.scaleAfter, scaleAfterCdp: r.scaleAfterCdp, method: r.method, pass: r.pass })) }));
    process.exit(res.pass ? 0 : 1);
  } else if (arg('--url')) {
    const out = await measureUrl(arg('--url'), arg('--variant', DEFAULT_VARIANT), arg('--out', null));
    process.exit(out.error ? 1 : 0);
  } else {
    console.error('usage: --control [--variant NAME] [--out FILE] | --explore [--out FILE] | --url URL --out FILE [--variant NAME]');
    process.exit(2);
  }
})().catch(e => { console.error(e); process.exit(1); });
