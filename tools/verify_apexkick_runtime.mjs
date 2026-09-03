#!/usr/bin/env node
/**
 * Targeted shipped-byte runtime gate for /apexkick/.
 *
 * The harness serves apexkick/index.html verbatim, drives real keyboard,
 * pointer and CDP touch input, injects renderer/resource failures before any
 * product script runs, records screenshots plus state traces, and proves each
 * recovery predicate rejects a deliberately broken throwaway fixture.
 */
'use strict';

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GAME = path.resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) || path.join(ROOT, 'apexkick', 'index.html'));
const ART = path.resolve(process.env.APEXKICK_ARTIFACT_DIR || path.join(ROOT, 'artifacts', 'apexkick-runtime'));
const PINNED_CHROME = process.env.APEXKICK_CHROME || '';
const ONLY = (process.argv.find((arg) => arg.startsWith('--only=')) || '').slice(7);
const EXPECTED_THREE_ERROR = 'THREE.WebGLRenderer: Error creating WebGL context.';

fs.mkdirSync(ART, { recursive: true });

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function loadChromium() {
  const req = createRequire(import.meta.url);
  const globalRoot = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  const paths = [path.join(ROOT, 'node_modules'), globalRoot, ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)]
    .filter((candidate) => { try { return fs.existsSync(candidate); } catch (_) { return false; } });
  return req(req.resolve('playwright', { paths })).chromium;
}

const gates = [];
function gate(id, title, ok, detail = '') {
  gates.push({ id, title, ok: !!ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ` — ${detail}` : ''}\n`);
  return !!ok;
}

function serve(file) {
  const bytes = fs.readFileSync(file);
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url || '');
    const route = (req.url || '').split('?')[0];
    if (route === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (route !== '/' && route !== '/apexkick/' && route !== '/apexkick/index.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': bytes.length,
      'Cache-Control': 'no-store'
    });
    res.end(bytes);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    server, requests, origin: `http://127.0.0.1:${server.address().port}`
  })));
}

function initHarness({ mode, suppressSplash }) {
  const observed = new Set([
    'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown',
    'resize', 'orientationchange', 'visibilitychange', 'pagehide',
    'webglcontextlost', 'webglcontextrestored'
  ]);
  const listeners = [], bootCallbacks = [];
  const originalAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (this === window && type === 'DOMContentLoaded' && callback?.name === 'boot') bootCallbacks.push(callback);
    if (observed.has(type)) {
      const target = this === window ? 'window' : this === document ? 'document' :
        (this && this.id ? `#${this.id}` : this?.constructor?.name || 'unknown');
      listeners.push({ target, type });
    }
    return originalAdd.call(this, type, callback, options);
  };

  const raf = { requested: 0, callbacks: 0, pending: 0, maxPending: 0 };
  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (callback) {
    raf.requested += 1; raf.pending += 1; raf.maxPending = Math.max(raf.maxPending, raf.pending);
    return originalRaf(function (time) { raf.pending -= 1; raf.callbacks += 1; return callback(time); });
  };

  const originalContext = HTMLCanvasElement.prototype.getContext;
  const contextCalls = [];
  let postAcquireArmed = mode === 'post-acquire-failure';
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    const game = this.id === 'gl';
    if (this.id === 'aim' && mode === 'no-aim-canvas' && type === '2d') {
      contextCalls.push({ id: this.id, type, result: 'forced-null' }); return null;
    }
    if (this.id === 'v6KickAdvisory' && mode === 'no-advisory-canvas' && type === '2d') {
      contextCalls.push({ id: this.id, type, result: 'forced-null' }); return null;
    }
    if (game && mode === 'no-webgl2' && type === 'webgl2') {
      contextCalls.push({ id: this.id, type, result: 'forced-null' }); return null;
    }
    if (game && (mode === 'no-webgl' || mode === 'no-renderers') &&
        (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl')) {
      contextCalls.push({ id: this.id, type, result: 'forced-null' }); return null;
    }
    if (game && mode === 'no-renderers' && type === '2d') {
      contextCalls.push({ id: this.id, type, result: 'forced-null' }); return null;
    }
    const result = originalContext.call(this, type, options);
    contextCalls.push({ id: this.id || '(anonymous)', type, result: result ? 'context' : 'null' });
    if (game && type === 'webgl2' && result && postAcquireArmed) {
      postAcquireArmed = false;
      const originalGetExtension = result.getExtension.bind(result);
      result.getExtension = function () {
        result.getExtension = originalGetExtension;
        throw new Error('AKFIX injected renderer initialisation failure after WebGL2 acquisition');
      };
    }
    return result;
  };

  let hidden = false;
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  } catch (_) {}
  const unhandledRejections = [];
  window.addEventListener('unhandledrejection', (event) => unhandledRejections.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
  window.__AKFIX_RUNTIME = {
    mode, listeners, raf, contextCalls, unhandledRejections,
    setHidden(value) { hidden = !!value; document.dispatchEvent(new Event('visibilitychange')); },
    focus(value) { window.dispatchEvent(new Event(value ? 'focus' : 'blur')); },
    replayBoot() { for (const callback of bootCallbacks) callback.call(document, new Event('DOMContentLoaded')); }
  };
  if (suppressSplash) {
    try { localStorage.setItem('mbm_splash_last', String(Date.now())); } catch (_) {}
  }
}

function visible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' &&
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

async function pageState(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    };
    const h = window.__AKFIX_RUNTIME;
    const listenerCounts = {};
    for (const row of h?.listeners || []) {
      const key = `${row.target}:${row.type}`;
      listenerCounts[key] = (listenerCounts[key] || 0) + 1;
    }
    const canvas = document.getElementById('gl');
    const tray = document.getElementById('v6KickTray');
    const trayRect = tray?.getBoundingClientRect();
    const allIds = [...document.querySelectorAll('[id]')].map((el) => el.id);
    const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    const brokenAria = [];
    let ariaReferenceCount = 0;
    const ariaAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage'];
    document.querySelectorAll(ariaAttrs.map((attr) => `[${attr}]`).join(',')).forEach((el) => {
      for (const attr of ariaAttrs) {
        for (const id of (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) {
          ariaReferenceCount += 1;
          if (!document.getElementById(id)) brokenAria.push(`${attr}:${id}`);
        }
      }
    });
    return {
      title: document.title,
      active: document.activeElement?.id || document.activeElement?.tagName || null,
      gameState: window.__AK_DEBUG?.G?.state || null,
      paused: window.__AK_DEBUG?.G?.paused ?? null,
      inputEnabled: window.AK?.Input?.state?.enabled ?? null,
      renderPath: window.AK?.Scene?.S?.renderPath || 'uninitialised',
      qualityTier: window.AK?.Scene?.S?.qualityTier || 'uninitialised',
      loadingVisible: isVisible(document.getElementById('loading')),
      pauseVisible: isVisible(document.getElementById('pauseLayer')) && document.getElementById('pauseLayer').classList.contains('on'),
      bootErrorVisible: isVisible(document.getElementById('bootError')),
      visibleAlerts: [...document.querySelectorAll('[role="alert"]')].filter(isVisible).length,
      retryButtons: document.querySelectorAll('#bootError button, #bootError [role="button"]').length,
      screens: document.querySelectorAll('#screens .screen').length,
      canvas: canvas ? { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, width: canvas.width, height: canvas.height } : null,
      tray: trayRect ? { top: trayRect.top, bottom: trayRect.bottom, visible: isVisible(tray) } : null,
      listenerCounts,
      raf: h ? { ...h.raf } : null,
      contextCalls: h?.contextCalls || [],
      unhandledRejections: h?.unhandledRejections || [],
      idCount: allIds.length,
      ariaReferenceCount,
      duplicateIds,
      brokenAria,
      h1Count: document.querySelectorAll('h1').length,
      h1Texts: [...document.querySelectorAll('h1')].map((el) => el.textContent.trim()),
      viewport: document.querySelector('meta[name="viewport"]')?.content || ''
    };
  });
}

async function frameSignature(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('gl');
    const scene = window.AK?.Scene;
    if (!canvas || !scene?.S?.ready) return { ok: false, reason: 'renderer-not-ready' };
    try { scene.render(); } catch (_) {}
    const width = canvas.width, height = canvas.height, renderPath = scene.S.renderPath || '';
    let data;
    if (renderPath.startsWith('webgl')) {
      const gl = scene.S.renderer?.getContext?.();
      if (!gl) return { ok: false, reason: 'no-webgl-context', width, height, renderPath };
      data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
      const cx = canvas.getContext('2d');
      if (!cx) return { ok: false, reason: 'no-2d-context', width, height, renderPath };
      data = cx.getImageData(0, 0, width, height).data;
    }
    let hash = 2166136261 >>> 0, sampled = 0, nonBlank = 0, min = 255, max = 0;
    const colours = new Set();
    const stepX = Math.max(1, Math.floor(width / 41)), stepY = Math.max(1, Math.floor(height / 41));
    for (let y = 0; y < height; y += stepY) for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const lum = Math.round((r * 299 + g * 587 + b * 114) / 1000);
      if (a && (r || g || b)) nonBlank += 1;
      min = Math.min(min, lum); max = Math.max(max, lum); colours.add(`${r},${g},${b},${a}`);
      for (const value of [r, g, b, a]) { hash ^= value; hash = Math.imul(hash, 16777619); }
      sampled += 1;
    }
    return {
      ok: nonBlank > sampled * 0.5 && colours.size > 8 && max - min > 12,
      renderPath, width, height, sampled, nonBlank, colours: colours.size,
      lumaRange: max - min, hash: (hash >>> 0).toString(16).padStart(8, '0')
    };
  });
}

async function waitForBoot(page, expectError = false) {
  await page.waitForFunction((errorExpected) => {
    const error = document.getElementById('bootError');
    const loading = document.getElementById('loading');
    const shown = error && getComputedStyle(error).display !== 'none';
    const ready = !!window.__AK_DEBUG && !!window.AK?.Scene?.S?.ready;
    return errorExpected ? shown : loading?.classList.contains('hidden') && ready;
  }, expectError, { timeout: 15_000 });
}

async function startMatch(page) {
  await page.locator('#bPlay').click();
  await page.locator('#bTourKick').click();
  await page.waitForFunction(() => window.__AK_DEBUG?.G?.state === 'aim', null, { timeout: 8_000 });
}

async function mouseKick(page) {
  const box = await page.locator('#app').boundingBox();
  const tray = await page.locator('#v6KickTray').boundingBox().catch(() => null);
  const x = box.x + box.width * 0.5;
  const endY = Math.min(box.y + box.height * 0.76, tray ? tray.y - 18 : box.y + box.height * 0.76);
  const startY = Math.max(box.y + box.height * 0.32, endY - Math.max(110, box.height * 0.22));
  await page.mouse.move(x, startY); await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(x + Math.sin(i / 8 * Math.PI) * box.width * 0.045,
      startY + (endY - startY) * i / 8, { steps: 1 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  return { kind: 'mouse', startY, endY, trayTop: tray?.y ?? null };
}

async function touchKick(page, context) {
  const box = await page.locator('#app').boundingBox();
  const tray = await page.locator('#v6KickTray').boundingBox().catch(() => null);
  const x = box.x + box.width * 0.5;
  const endY = Math.min(box.y + box.height * 0.76, tray ? tray.y - 18 : box.y + box.height * 0.76);
  const startY = Math.max(box.y + box.height * 0.32, endY - Math.max(110, box.height * 0.22));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, radiusX: 7, radiusY: 7, force: 0.7, id: 1 }] });
  for (let i = 1; i <= 8; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
      x: x + Math.sin(i / 8 * Math.PI) * box.width * 0.045,
      y: startY + (endY - startY) * i / 8, radiusX: 7, radiusY: 7, force: 0.7, id: 1
    }] });
    await page.waitForTimeout(18);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  return { kind: 'touch', startY, endY, trayTop: tray?.y ?? null };
}

async function keyboardKick(page) {
  await page.locator('#gl').focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('KeyQ'); await page.keyboard.press('Equal');
  await page.keyboard.press('Space');
  return { kind: 'keyboard', keys: ['ArrowLeft', 'Q', '+', 'Space'] };
}

const CASES = [
  { id: 'desktop-webgl-keyboard', viewport: { width: 1280, height: 800 }, mode: 'normal', input: 'keyboard', path: /^webgl2/ },
  { id: 'desktop-webgl-mouse', viewport: { width: 1280, height: 800 }, mode: 'normal', input: 'mouse', path: /^webgl2/ },
  { id: 'android-portrait', viewport: { width: 412, height: 892 }, mode: 'normal', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'android-landscape', viewport: { width: 892, height: 412 }, mode: 'normal', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'webgl1-compatible', viewport: { width: 412, height: 892 }, mode: 'no-webgl2', mobile: true, touch: true, input: 'touch', path: /^webgl1/ },
  { id: 'post-acquire-failure', viewport: { width: 412, height: 892 }, mode: 'post-acquire-failure', mobile: true, touch: true, input: 'touch', path: /^canvas2d$/ },
  { id: 'canvas2d-fallback', viewport: { width: 412, height: 892 }, mode: 'no-webgl', mobile: true, touch: true, input: 'touch', path: /^canvas2d$/ },
  { id: 'aim-canvas-unavailable', viewport: { width: 412, height: 892 }, mode: 'no-aim-canvas', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'advisory-canvas-unavailable', viewport: { width: 412, height: 892 }, mode: 'no-advisory-canvas', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'all-renderers-unavailable', viewport: { width: 412, height: 892 }, mode: 'no-renderers', mobile: true, touch: true, expectError: true },
  { id: 'context-loss-restore', viewport: { width: 412, height: 892 }, mode: 'context-loss', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'lifecycle-resize-focus', viewport: { width: 412, height: 892 }, mode: 'lifecycle', mobile: true, touch: true, input: 'touch', path: /^webgl2/ },
  { id: 'duplicate-boot', viewport: { width: 412, height: 892 }, mode: 'double-boot', mobile: true, touch: true, input: 'touch', path: /^webgl2/ }
];

function canvasMatches(state, viewport, dpr) {
  const canvas = state?.canvas;
  return !!canvas && canvas.cssWidth === viewport.width && canvas.cssHeight === viewport.height &&
    canvas.width === Math.floor(viewport.width * dpr) && canvas.height === Math.floor(viewport.height * dpr);
}

async function runCase(browser, origin, spec, artifactPrefix = '') {
  const context = await browser.newContext({
    viewport: spec.viewport, isMobile: !!spec.mobile, hasTouch: !!spec.touch,
    deviceScaleFactor: spec.mobile ? 2 : 1, colorScheme: 'dark'
  });
  await context.addInitScript(initHarness, { mode: spec.mode, suppressSplash: true });
  const page = await context.newPage();
  const pageErrors = [], consoleErrors = [], requestFailures = [], externalRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.stack || error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) externalRequests.push(url);
  });
  const result = { id: spec.id, engine: 'Chromium', viewport: spec.viewport, mode: spec.mode };
  try {
    await page.goto(`${origin}/apexkick/?akfix-runtime=${encodeURIComponent(spec.id)}`, { waitUntil: 'load', timeout: 30_000 });
    await waitForBoot(page, !!spec.expectError);
    if (spec.expectError) await page.waitForFunction(() => document.activeElement?.id === 'bootRetry', null, { timeout: 2_000 });
    result.boot = await pageState(page);
    if (spec.expectError) {
      const beforeUrl = page.url();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 8_000 }),
        page.locator('#bootRetry').click()
      ]);
      await waitForBoot(page, true);
      result.retry = { navigated: page.url() === beforeUrl, state: await pageState(page) };
      result.pass = result.boot.bootErrorVisible && !result.boot.loadingVisible && !result.boot.pauseVisible &&
        result.boot.screens === 0 && result.boot.visibleAlerts === 1 && result.boot.retryButtons === 1 &&
        result.boot.active === 'bootRetry' && result.retry.navigated && result.retry.state.bootErrorVisible;
    } else {
      if (spec.mode === 'double-boot') {
        result.beforeDuplicate = await pageState(page);
        await page.evaluate(() => window.__AKFIX_RUNTIME.replayBoot());
        await page.waitForTimeout(650);
        result.afterDuplicate = await pageState(page);
      }
      await startMatch(page);
      result.aim = await pageState(page);
      if (spec.mode === 'lifecycle') {
        await page.evaluate(() => { window.__AKFIX_RUNTIME.setHidden(true); window.__AKFIX_RUNTIME.focus(false); });
        await page.waitForTimeout(120); result.background = await pageState(page);
        await page.evaluate(() => { window.__AKFIX_RUNTIME.setHidden(false); window.__AKFIX_RUNTIME.focus(true); });
        await page.setViewportSize({ width: 892, height: 412 });
        await page.evaluate(() => window.dispatchEvent(new Event('orientationchange'))); await page.waitForTimeout(450);
        result.landscape = await pageState(page);
        await page.setViewportSize({ width: 412, height: 892 });
        await page.evaluate(() => window.dispatchEvent(new Event('orientationchange'))); await page.waitForTimeout(450);
        result.portrait = await pageState(page);
        if (result.portrait.pauseVisible) await page.locator('#pauseResume').click();
        await page.waitForTimeout(160); result.resumed = await pageState(page);
      }
      result.frame1 = await frameSignature(page); await page.waitForTimeout(220); result.frame2 = await frameSignature(page);
      if (spec.mode === 'context-loss') {
        result.beforeContext = await pageState(page);
        result.contextLoss = await page.evaluate(async () => {
          const scene = window.AK?.Scene, gl = scene?.S?.renderer?.getContext?.(), ext = gl?.getExtension?.('WEBGL_lose_context');
          if (!ext) return { supported: false };
          let lost = 0, restored = 0;
          const canvas = document.getElementById('gl');
          canvas.addEventListener('webglcontextlost', (event) => { lost += 1; event.preventDefault(); }, { once: true });
          canvas.addEventListener('webglcontextrestored', () => { restored += 1; }, { once: true });
          ext.loseContext(); await new Promise((resolve) => setTimeout(resolve, 250));
          ext.restoreContext(); await new Promise((resolve) => setTimeout(resolve, 900));
          return { supported: true, lost, restored };
        });
        result.afterContext = await pageState(page);
        result.afterRestore = await frameSignature(page);
      }
      result.input = spec.input === 'touch' ? await touchKick(page, context) : spec.input === 'mouse' ? await mouseKick(page) : await keyboardKick(page);
      await page.waitForFunction(() => ['flight', 'resolve'].includes(window.__AK_DEBUG?.G?.state), null, { timeout: 4_000 });
      result.afterInput = await pageState(page);
      await page.waitForFunction(() => window.__AK_DEBUG?.G?.state === 'resolve', null, { timeout: 8_000 });
      result.resolved = await pageState(page);
      const moving = result.frame1.hash !== result.frame2.hash;
      const gestureClear = spec.input === 'keyboard' || result.input.endY < (result.input.trayTop ?? Infinity);
      result.canvasSizing = {
        expected: { ...spec.viewport, dpr: spec.mobile ? 2 : 1 }, actual: result.aim.canvas,
        matched: canvasMatches(result.aim, spec.viewport, spec.mobile ? 2 : 1)
      };
      result.pass = result.frame1.ok && result.frame2.ok && moving && gestureClear && result.canvasSizing.matched && spec.path.test(result.aim.renderPath) &&
        ['flight', 'resolve'].includes(result.afterInput.gameState) && result.resolved.gameState === 'resolve';
      if (spec.mode === 'lifecycle') {
        const before = result.aim.listenerCounts, after = result.resumed.listenerCounts;
        result.lifecycleInvariant = {
          appPointerdown: [before['#app:pointerdown'] || 0, after['#app:pointerdown'] || 0],
          windowResize: [before['window:resize'] || 0, after['window:resize'] || 0],
          documentKeydown: [before['document:keydown'] || 0, after['document:keydown'] || 0],
          rafPending: [result.aim.raf.pending, result.resumed.raf.pending]
        };
        result.pass = result.pass && result.background.pauseVisible && !result.resumed.pauseVisible &&
          canvasMatches(result.landscape, { width: 892, height: 412 }, 2) &&
          canvasMatches(result.portrait, { width: 412, height: 892 }, 2) &&
          canvasMatches(result.resumed, { width: 412, height: 892 }, 2) &&
          result.resumed.inputEnabled && Object.values(result.lifecycleInvariant).every(([a, b]) => a === b);
      }
      if (spec.mode === 'double-boot') {
        const before = result.beforeDuplicate.listenerCounts, after = result.afterDuplicate.listenerCounts;
        result.idempotence = {
          appPointerdown: [before['#app:pointerdown'] || 0, after['#app:pointerdown'] || 0],
          windowResize: [before['window:resize'] || 0, after['window:resize'] || 0],
          documentKeydown: [before['document:keydown'] || 0, after['document:keydown'] || 0],
          rafPending: [result.beforeDuplicate.raf.pending, result.afterDuplicate.raf.pending]
        };
        result.pass = result.pass && Object.values(result.idempotence).every(([a, b]) => a === b);
      }
      if (spec.mode === 'context-loss') {
        const before = result.beforeContext.listenerCounts, after = result.afterContext.listenerCounts;
        result.contextInvariant = {
          appPointerdown: [before['#app:pointerdown'] || 0, after['#app:pointerdown'] || 0],
          windowResize: [before['window:resize'] || 0, after['window:resize'] || 0],
          documentKeydown: [before['document:keydown'] || 0, after['document:keydown'] || 0],
          rafPending: [result.beforeContext.raf.pending, result.afterContext.raf.pending]
        };
        result.pass = result.pass && result.contextLoss.supported && result.contextLoss.lost === 1 &&
          result.contextLoss.restored === 1 && result.afterRestore.ok &&
          Object.values(result.contextInvariant).every(([a, b]) => a === b);
      }
    }
  } catch (error) {
    result.harnessError = String(error.stack || error); result.pass = false;
    try { result.failureState = await pageState(page); } catch (_) {}
  } finally {
    result.pageErrors = pageErrors;
    result.consoleErrors = consoleErrors;
    result.fatalConsoleErrors = consoleErrors.filter((message) => message !== EXPECTED_THREE_ERROR);
    result.requestFailures = requestFailures; result.externalRequests = externalRequests;
    try { result.unhandledRejections = await page.evaluate(() => window.__AKFIX_RUNTIME?.unhandledRejections || []); }
    catch (_) { result.unhandledRejections = []; }
    const expectedThreeErrors = spec.mode === 'no-webgl' ? 1 : spec.mode === 'no-renderers' ? 2 : 0;
    result.expectedConsoleContract = { expected: expectedThreeErrors, actual: consoleErrors.filter((message) => message === EXPECTED_THREE_ERROR).length };
    result.pass = !!result.pass && pageErrors.length === 0 && result.fatalConsoleErrors.length === 0 &&
      result.unhandledRejections.length === 0 && requestFailures.length === 0 && externalRequests.length === 0 &&
      result.expectedConsoleContract.actual === result.expectedConsoleContract.expected;
    try { await page.screenshot({ path: path.join(ART, `${artifactPrefix}${spec.id}.png`) }); } catch (_) {}
    await context.close();
  }
  return result;
}

async function splashAndPersistence(browser, origin) {
  const result = { id: 'splash-save-access' };
  const context = await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('request', (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) external.push(request.url()); });
  try {
    await page.addInitScript(() => {
      window.__AK_SPLASH_TRACE = { added: false, removed: false, addedAt: 0, removedAt: 0 };
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) if (node.nodeType === 1 && (node.matches?.('[data-mbm-maker-splash]') || node.querySelector?.('[data-mbm-maker-splash]'))) {
            window.__AK_SPLASH_TRACE.added = true; window.__AK_SPLASH_TRACE.addedAt = performance.now();
          }
          for (const node of record.removedNodes) if (node.nodeType === 1 && (node.matches?.('[data-mbm-maker-splash]') || node.querySelector?.('[data-mbm-maker-splash]'))) {
            window.__AK_SPLASH_TRACE.removed = true; window.__AK_SPLASH_TRACE.removedAt = performance.now();
          }
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.goto(`${origin}/apexkick/?akfix-splash=first`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__AK_SPLASH_TRACE?.added, null, { timeout: 2_000 });
    result.firstSplash = true;
    await page.waitForFunction(() => window.__AK_SPLASH_TRACE?.removed, null, { timeout: 2_000 });
    result.reducedDismissMs = await page.evaluate(() => Math.round(window.__AK_SPLASH_TRACE.removedAt - window.__AK_SPLASH_TRACE.addedAt));
    result.splashStamp = await page.evaluate(() => localStorage.getItem('mbm_splash_last'));
    await page.waitForFunction(() => document.activeElement?.id === 'bPlay', null, { timeout: 5_000 });
    result.focusAfterSplash = await page.evaluate(() => document.activeElement?.id || '');
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
    result.suppressed = await page.locator('[data-mbm-maker-splash]').count() === 0;
    await page.waitForFunction(() => document.activeElement?.id === 'bPlay', null, { timeout: 5_000 });
    const focusTrail = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      focusTrail.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || ''));
      if (focusTrail.at(-1) === 'mbmexit-back') break;
    }
    result.focusTrail = focusTrail;
    result.exit = await page.evaluate(() => ({
      present: !!document.getElementById('mbmexit-back'),
      href: document.getElementById('mbmexit-back')?.getAttribute('href') || '',
      viewport: document.querySelector('meta[name="viewport"]')?.content || ''
    }));

    await page.evaluate(() => localStorage.setItem('mbm_splash_last', String(Date.now() - 86_400_000 + 5_000)));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(650);
    result.within24Suppressed = await page.evaluate(() => !window.__AK_SPLASH_TRACE.added && !document.querySelector('[data-mbm-maker-splash]'));
    await page.evaluate(() => localStorage.setItem('mbm_splash_last', String(Date.now() - 86_400_000 - 5_000)));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__AK_SPLASH_TRACE?.added, null, { timeout: 2_000 });
    result.expired24Shown = true;
    await page.waitForFunction(() => window.__AK_SPLASH_TRACE?.removed, null, { timeout: 2_000 });
    await page.waitForFunction(() => document.activeElement?.id === 'bPlay', null, { timeout: 5_000 });

    const legacy = {
      gameRaw: JSON.stringify({ version: 3, coins: 3217, played: 7, goals: 4, shots: 9, xp: 88, seenHint: 2, division: 6, legacyMarker: 'AKFIX-preserved' }),
      passportRaw: JSON.stringify({
        profile: { name: 'AK Legacy', className: 'Class Z', house: 'Ember' },
        season: { xp: 321, badges: ['Legacy Ace'], lastPlayed: '2026-09-01T12:00:00.000Z' },
        receipts: []
      })
    };
    await page.evaluate((fixture) => {
      localStorage.removeItem('apexkick.aaa.v4');
      localStorage.removeItem('mbm_sports_passport_v4');
      localStorage.setItem('apexkick.aaa.v3', fixture.gameRaw);
      localStorage.setItem('mbm_sports_passport_v3', fixture.passportRaw);
    }, legacy);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(450);
    result.legacy = await page.evaluate((fixture) => {
      const game = window.__AK_DEBUG?.P, passport = window.__AK_DEBUG?.v4?.getPassport?.();
      let canonicalGame = null, canonicalPassport = null;
      try { canonicalGame = JSON.parse(localStorage.getItem('apexkick.aaa.v4')); } catch (_) {}
      try { canonicalPassport = JSON.parse(localStorage.getItem('mbm_sports_passport_v4')); } catch (_) {}
      return {
        exactGameBytes: localStorage.getItem('apexkick.aaa.v3') === fixture.gameRaw,
        exactPassportBytes: localStorage.getItem('mbm_sports_passport_v3') === fixture.passportRaw,
        gameLoaded: game?.coins === 3217 && game.played === 7 && game.goals === 4 && game.shots === 9 && game.division === 6 && game.legacyMarker === 'AKFIX-preserved',
        gameMigrated: canonicalGame?.version === 4 && canonicalGame.coins === 3217 && canonicalGame.shots === 9,
        passportLoaded: passport?.profile?.name?.value === 'AK Legacy' && passport.profile.className.value === 'Class Z' && passport.profile.house.value === 'Ember' &&
          passport.counters.xp.reduce((sum, row) => sum + row[1], 0) === 321,
        passportMigrated: canonicalPassport?.schemaVersion === 4 && canonicalPassport?.migration?.source === 'v3'
      };
    }, legacy);
    await startMatch(page); await touchKick(page, context);
    await page.waitForFunction(() => window.__AK_DEBUG?.G?.state === 'resolve', null, { timeout: 8_000 });
    await page.evaluate(() => window.__AK_DEBUG.v4.saveKickSave());
    result.saved = await page.evaluate(() => ({ raw: localStorage.getItem('apexkick.aaa.v4'), shots: window.__AK_DEBUG?.P?.shots }));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
    result.saveReloaded = await page.evaluate((saved) => ({
      exact: localStorage.getItem('apexkick.aaa.v4') === saved.raw,
      shots: window.__AK_DEBUG?.P?.shots
    }), result.saved);
    result.pass = result.firstSplash && result.reducedDismissMs < 1_200 && !!result.splashStamp && result.suppressed &&
      result.within24Suppressed && result.expired24Shown &&
      result.focusAfterSplash === 'bPlay' && result.focusTrail.includes('mbmexit-back') && result.exit.href === '/games/' &&
      !/maximum-scale\s*=\s*1|user-scalable\s*=\s*no/i.test(result.exit.viewport) &&
      Object.values(result.legacy).every(Boolean) && result.saved.shots === 10 && !!result.saved.raw &&
      result.saveReloaded.exact && result.saveReloaded.shots === 10 && errors.length === 0 && external.length === 0;
  } catch (error) { result.harnessError = String(error.stack || error); result.pass = false; }
  result.errors = errors; result.externalRequests = external;
  try { await page.screenshot({ path: path.join(ART, 'splash-save-access.png') }); } catch (_) {}
  await context.close();
  return result;
}

function makeBrokenFixture(html, name, replacements) {
  let broken = html;
  for (const [before, after] of replacements) {
    if (!broken.includes(before)) throw new Error(`${name} control source not found: ${before.slice(0, 80)}`);
    broken = broken.replace(before, after);
  }
  if (broken === html) throw new Error(`${name} control mutation was inert`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `akfix-${name}-`));
  const file = path.join(dir, 'index.html'); fs.writeFileSync(file, broken);
  return { dir, file, sha256: sha256(broken) };
}

async function runControl(browser, html, name, specId, replacements, failurePredicate) {
  const fixture = makeBrokenFixture(html, name, replacements);
  const spec = CASES.find((item) => item.id === specId);
  const served = await serve(fixture.file);
  let result;
  try { result = await runCase(browser, served.origin, spec, `control-${name}-`); }
  finally { await new Promise((resolve) => served.server.close(resolve)); fs.rmSync(fixture.dir, { recursive: true, force: true }); }
  return { name, fixtureSha256: fixture.sha256, fired: !result.pass && failurePredicate(result), result };
}

async function main() {
  if (!fs.existsSync(GAME)) throw new Error(`Apex Kick source not found: ${GAME}`);
  const html = fs.readFileSync(GAME, 'utf8'), sourceSha = sha256(html);
  process.stdout.write(`Apex Kick runtime gate — ${GAME}\nbytes ${Buffer.byteLength(html)}  sha256 ${sourceSha}\n\n`);

  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const parseErrors = [];
  inline.forEach((script, index) => { try { new vm.Script(script, { filename: `apexkick-inline-${index + 1}.js` }); } catch (error) { parseErrors.push(String(error.message || error)); } });
  gate('AKR01', 'HTML and every executable inline script parse', inline.length > 0 && parseErrors.length === 0,
    `${inline.length} inline scripts; ${parseErrors.length} errors`);

  let chromium;
  try { chromium = loadChromium(); } catch (error) {
    gate('AKR02', 'Playwright runtime is available', false, String(error.message || error));
    finish({ sourceSha, sessions: [], controls: [] }); return;
  }
  const launch = { headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'] };
  if (PINNED_CHROME) launch.executablePath = PINNED_CHROME;
  let browser;
  try { browser = await chromium.launch(launch); }
  catch (error) { gate('AKR02', 'Chromium runtime launches', false, String(error.message || error)); finish({ sourceSha, sessions: [], controls: [] }); return; }
  gate('AKR02', 'Chromium runtime launches', true, PINNED_CHROME || 'Playwright-managed Chromium');

  const served = await serve(GAME), sessions = [];
  try {
    const selected = CASES.filter((spec) => !ONLY || spec.id === ONLY);
    for (const spec of selected) {
      const result = await runCase(browser, served.origin, spec);
      sessions.push(result);
      const render = result.aim?.renderPath || result.boot?.renderPath || 'none';
      const frames = result.frame1 && result.frame2 ? `${result.frame1.colours}/${result.frame2.colours} colours; ${result.frame1.hash}->${result.frame2.hash}` : 'controlled error';
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, `${spec.id} shipped-byte runtime`, result.pass,
        `${render}; ${frames}; page=${result.pageErrors.length}, console=${result.fatalConsoleErrors.length}, external=${result.externalRequests.length}`);
    }
    if (ONLY === 'splash-save-access') {
      const splash = await splashAndPersistence(browser, served.origin); sessions.push(splash);
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'splash, reduced motion, focus, zoom, Tab exit and save persistence', splash.pass,
        `dismiss ${splash.reducedDismissMs ?? 'n/a'} ms; 24h=${!!splash.within24Suppressed}/${!!splash.expired24Shown}; focus ${splash.focusAfterSplash || 'n/a'}; exit=${splash.exit?.href || 'n/a'}; save shots=${splash.saved?.shots ?? 'n/a'}`);
      finish({ sourceSha, sessions, controls: [], browser: await browser.version(), subset: ONLY });
    } else if (!ONLY) {
      const normal = sessions.find((item) => item.id === 'desktop-webgl-keyboard');
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'rendered identity, IDs and ARIA references',
        /Apex Kick/i.test(normal?.boot?.title || '') && normal?.boot?.h1Count === 1 && normal.boot.h1Texts.some((text) => /Apex\s*Kick/i.test(text)) &&
          normal.boot.idCount > 0 && normal.boot.ariaReferenceCount > 0 && normal.boot.duplicateIds.length === 0 && normal.boot.brokenAria.length === 0,
        `title=${JSON.stringify(normal?.boot?.title || '')}; h1=${JSON.stringify(normal?.boot?.h1Texts || [])}; ${normal?.boot?.idCount ?? 0} IDs / ${normal?.boot?.duplicateIds.length ?? 0} duplicate; ${normal?.boot?.ariaReferenceCount ?? 0} ARIA refs / ${normal?.boot?.brokenAria.length ?? 0} broken`);
      const inspected = sessions.reduce((sum, item) => sum + item.pageErrors.length + item.fatalConsoleErrors.length + item.unhandledRejections.length + item.requestFailures.length, 0);
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'matrix is free of fatal errors, rejections and failed requests', inspected === 0,
        `${sessions.length} sessions; ${inspected} fatal events`);
      const external = sessions.reduce((sum, item) => sum + item.externalRequests.length, 0);
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'observed network has zero unexpected external requests', external === 0,
        `${sessions.length} sessions; ${external} external requests; ${served.requests.length} same-origin requests`);

      const splash = await splashAndPersistence(browser, served.origin); sessions.push(splash);
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'splash, reduced motion, focus, zoom, Tab exit and save persistence', splash.pass,
        `dismiss ${splash.reducedDismissMs ?? 'n/a'} ms; 24h=${!!splash.within24Suppressed}/${!!splash.expired24Shown}; focus ${splash.focusAfterSplash || 'n/a'}; exit=${splash.exit?.href || 'n/a'}; save shots=${splash.saved?.shots ?? 'n/a'}`);

      const controls = [];
      controls.push(await runControl(browser, html, 'aim-null', 'aim-canvas-unavailable',
        [['if (!aimCv || !aimCx) return;', 'if (!aimCv) return;']],
        (result) => result.pageErrors.some((error) => /setTransform/.test(error)) && (result.failureState?.gameState === 'aim' || result.afterInput?.gameState === 'aim')));
      controls.push(await runControl(browser, html, 'advisory-null', 'advisory-canvas-unavailable',
        [['if(cx){cx.clearRect(0,0,wh.w,wh.h)', 'if(true){cx.clearRect(0,0,wh.w,wh.h)']],
        (result) => result.pageErrors.some((error) => /clearRect/.test(error))));
      controls.push(await runControl(browser, html, 'duplicate-boot', 'duplicate-boot',
        [['  if (bootStarted) return;\n  bootStarted = true;\n', '']],
        (result) => result.idempotence && Object.values(result.idempotence).some(([before, after]) => before !== after)));
      controls.push(await runControl(browser, html, 'missing-retry', 'all-renderers-unavailable',
        [['<button class="btn" id="bootRetry" type="button" data-mbm-primary-start>Reload and retry</button>', '<button class="btn" id="bootRetry" type="button" data-mbm-primary-start disabled>Reload and retry</button>']],
        (result) => result.boot?.active !== 'bootRetry' || /Timeout/.test(result.harnessError || '')));
      for (const control of controls) {
        gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, `${control.name} negative control fires`, control.fired,
          `fixture ${control.fixtureSha256.slice(0, 12)}; candidate predicate pass=${control.result.pass}`);
      }
      const restoredSha = sha256(fs.readFileSync(GAME));
      const restored = await runCase(browser, served.origin, CASES.find((item) => item.id === 'aim-canvas-unavailable'), 'restored-');
      sessions.push({ ...restored, id: 'restored-aim-canvas-unavailable' });
      gate(`AKR${String(gates.length + 1).padStart(2, '0')}`, 'untouched final candidate is restored and green after controls',
        restoredSha === sourceSha && restored.pass, `sha256 unchanged=${restoredSha === sourceSha}; runtime=${restored.pass}`);
      finish({ sourceSha, sessions, controls, browser: await browser.version() });
    } else finish({ sourceSha, sessions, controls: [], browser: await browser.version(), subset: ONLY });
  } finally {
    await browser.close();
    await new Promise((resolve) => served.server.close(resolve));
  }
}

function finish(extra) {
  const report = { generatedAt: new Date().toISOString(), game: GAME, bytes: fs.existsSync(GAME) ? fs.statSync(GAME).size : 0, gates, ...extra };
  fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));
  const failed = gates.filter((item) => !item.ok);
  process.stdout.write(`\nAKRUNTIME ${gates.length - failed.length}/${gates.length} gates passed; ${failed.length} failed\n`);
  if (failed.length) { process.stdout.write(`FAILED ${failed.map((item) => item.id).join(', ')}\n`); process.exitCode = 1; }
  else process.stdout.write('ALL APEX KICK RUNTIME GATES PASSED\n');
}

main().catch((error) => {
  gate('AKRX', 'runtime harness completed', false, String(error.stack || error));
  finish({ fatalHarnessError: String(error.stack || error), sessions: [], controls: [] });
});
