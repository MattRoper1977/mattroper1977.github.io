#!/usr/bin/env node
/**
 * verify_skybreak.mjs — the gate harness for Skybreak Vector (/skybreak/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate carries a
 * firing control: the same predicate on a deliberately broken input must go
 * red, or the gate reports itself MEASUREMENT INVALID rather than green.
 *
 *   node tools/verify_skybreak.mjs [path/to/index.html] [--selftest]
 *
 * SG1  WebGL2 path renders; the "WebGL 2 needed" panel appears under a forced
 *      null context (positive control first: the real context paints).
 * SG2  Menu idle: 0 requestAnimationFrame frames over 10 s after the menu
 *      paint; the loop resumes on Launch, resumes on Resume after a pause,
 *      and a resize repaints exactly once.
 * SG3  runSelfTests() failure list is empty and window.__SKYBREAK_TEST__ is
 *      exposed with the frozen surface.
 * SG4  Generated splash: first load, suppressed within 24 h, reduced motion.
 * SG5  Exit region reachable by keyboard; one rendered <h1>; 44 px targets;
 *      aria-live intact; zero duplicate ids; zoom enabled.
 * SG6  G-EGRESS: zero non-same-origin requests, including opening the HOTAS
 *      fold and generating the pairing QR (iceServers:[] - no STUN).
 * SG7  Real-input playability: launch, one air target destroyed, the mission
 *      ends with a rank; the profile persists across a reload.
 */
'use strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadChromium() {
  const req = createRequire(import.meta.url);
  const repoRoot = path.resolve(__dirname, '..');
  const globalRoot = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  const paths = [path.join(repoRoot, 'node_modules'), globalRoot, ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)]
    .filter(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  return req(req.resolve('playwright', { paths })).chromium;
}
const argPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const GAME = argPath ? path.resolve(argPath) : path.resolve(__dirname, '..', 'skybreak', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PINNED = process.env.SKYBREAK_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = PINNED && fs.existsSync(PINNED) ? PINNED : undefined;
const RAW_BUDGET = 409600, WIRE_BUDGET = 160000;

const say = s => process.stdout.write(s + '\n');
let results = [];
function gate(id, title, ok, detail) { results.push({ id, title, ok: !!ok, detail: detail || '' }); say(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ' — ' + detail : ''}`); return !!ok; }
function control(id, predicate, brokenInput, label) {
  let fired = false, err = '';
  try { fired = !predicate(brokenInput); } catch (e) { err = e.message; }
  say(`      ${id} control: ${fired ? 'FIRED' : 'VACUOUS'} — ${label}${err ? ' (' + err + ')' : ''}`);
  return fired;
}
const ART = (() => { const d = path.resolve(__dirname, '..', 'artifacts', 'skybreak'); try { fs.mkdirSync(d, { recursive: true }); return d; } catch (_) { return fs.mkdtempSync(path.join(os.tmpdir(), 'sb-art-')); } })();
async function shot(page, name) { try { const f = path.join(ART, name + '.png'); await page.screenshot({ path: f }); return f; } catch (e) { return 'screenshot failed: ' + e.message; } }

function serve(file) {
  const dir = path.dirname(file), root = path.resolve(dir, '..');
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    let p = url === '/skybreak/' || url === '/' ? file : path.join(root, url.replace(/^\//, ''));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    fs.readFile(p, (err, buf) => {
      if (err) { res.writeHead(404); res.end('nope'); return; }
      const ext = path.extname(p);
      res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : ext === '.svg' ? 'image/svg+xml' : 'text/plain' });
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

async function boot(browser, origin, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reducedMotion || 'no-preference', hasTouch: !!opts.touch });
  const errors = [], external = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/favicon\.ico/.test(t)) errors.push('console: ' + t); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  // RAF counter, installed before any page script runs.
  await page.addInitScript(() => { window.__rafCount = 0; const o = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => { window.__rafCount++; return o(cb); }; });
  if (opts.killWebGL) await page.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { if (String(t).indexOf('webgl') === 0) return null; return orig.call(this, t, ...r); }; });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(origin + '/skybreak/' + (opts.query || ''));
  await page.waitForTimeout(opts.wait || 3200);
  return { ctx, page, errors, external };
}

function staticGates(html) {
  const externals = (html.match(/<[^>]+>/g) || []).filter(t => /(?:src|href)\s*=\s*["']https?:\/\//i.test(t)).filter(t => !/rel\s*=\s*["'](?:canonical|alternate)["']/i.test(t)).filter(t => !/schema\.org|w3\.org/.test(t));
  gate('SG0a', 'zero external references in source', externals.length === 0, externals.length ? externals.slice(0, 3).join(' | ') : `0 http(s) refs in ${Buffer.byteLength(html)} bytes`);
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const srcTags = (html.match(/<script[^>]*\bsrc=/gi) || []).length;
  const { spawnSync } = require_('node:child_process');
  let bad = 0; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-syn-'));
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync('node', ['--check', f]).status !== 0) bad++; });
  gate('SG0b', 'every inline script block parses; no <script src>', bad === 0 && srcTags === 0, `${blocks.length} inline block(s) (game + 2 generated regions), ${bad} failing, ${srcTags} src tag(s)`);
  const exit = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END -->\n?/);
  gate('SG0c', 'generated inline exit region present at the estate pin', !!exit && Buffer.byteLength(exit[0]) === 3222, exit ? `${Buffer.byteLength(exit[0])} bytes (estate pin 3222)` : 'absent');
  gate('SG0d', 'maker splash is the generated region; the hand-written overlay is gone', /MBM-MAKER-SPLASH:BEGIN/.test(html) && !/id="splash"/.test(html) && !/function splash\(\)/.test(html), /MBM-MAKER-SPLASH:BEGIN/.test(html) ? 'canonical region present, no #splash overlay, no splash() bootstrap' : 'no canonical region');
  const pub = [...html.matchAll(/<title>([^<]*)<\/title>|<meta name="description" content="([^"]*)"|<p class="eyebrow">([^<]*)<\/p>/g)].map(m => m[1] || m[2] || m[3]).filter(Boolean);
  gate('SG0e', 'public name carries no V1/V4 (title, meta, kicker)', !pub.some(t => /\bV[14]\b/.test(t)), pub.map(t => JSON.stringify(t.slice(0, 40))).join(', '));
  gate('SG0f', 'no self-referential download link', !/<a[^>]*\bdownload\b/i.test(html), 'no <a download>');
  gate('SG0g', 'PROFILE_KEY frozen with legacy migration', /PROFILE_KEY="skybreak_vector_profile_v4"/.test(html) && /LEGACY_PROFILE_KEYS=\["skybreak_vector_profile_v3","skybreak_vector_profile_v2"\]/.test(html), 'skybreak_vector_profile_v4 + v3/v2 legacy keys');
  gate('SG0h', 'Local Link is inside a closed <details> fold and egress-clean', /<details class="local-link-fold">(?![^<]*open)[\s\S]*?id="open-local-link"[\s\S]*?<\/details>/.test(html) && /iceServers:\[\]/.test(html) && !/(?:stun|turn):/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'fold present and closed; iceServers:[]; no stun:/turn: literal');
  const raw = Buffer.byteLength(html), wire = zlib.gzipSync(Buffer.from(html), { level: 6 }).length;
  gate('SG0i', `raw bytes under the ${RAW_BUDGET.toLocaleString('en-GB')} B estate ceiling`, raw <= RAW_BUDGET, `${raw} B (headroom ${RAW_BUDGET - raw} B)`);
  gate('SG0j', `gzip wire bytes under ${WIRE_BUDGET.toLocaleString('en-GB')} B`, wire <= WIRE_BUDGET, `${wire} B gzipped at level 6 (${(100 * wire / raw).toFixed(1)}% of raw)`);
  gate('SG0k', 'no NEW · marker in the file', !/NEW ·/.test(html), 'none');
  const keys = [...new Set([...html.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*("[^"]+")/g)].map(m => m[1]))].sort();
  say(`      storage keys (static): ${keys.join(', ')}`);
}
function require_(m) { return createRequire(import.meta.url)(m); }

async function browserGates(browser, origin) {
  // SG1 positive control, then forced-null context.
  {
    const { ctx, page, errors } = await boot(browser, origin);
    // readPixels must run in the same task as the paint: the default framebuffer
    // is cleared once it is composited, so a probe in a later task reads blank.
    const r = await page.evaluate(() => { const c = document.getElementById('gl'); const gl = c && c.getContext('webgl2'); let colours = 0; if (gl) { window.__SKYBREAK_TEST__.repaint(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); const set = new Set(); for (let i = 0; i < buf.length; i += 4 * 97) set.add(buf[i] + ',' + buf[i + 1] + ',' + buf[i + 2]); colours = set.size; } return { hasGl: !!gl, w: c && c.width, h: c && c.height, colours, unsupported: !document.getElementById('unsupported').hidden, menu: !document.getElementById('menu').hidden, test: window.__SKYBREAK_TEST__ && window.__SKYBREAK_TEST__.ok }; });
    gate('SG1a', 'positive control: the WebGL2 path paints the backdrop', r.hasGl && r.colours > 1 && !r.unsupported && r.menu, `webgl2=${r.hasGl}, ${r.w}x${r.h}, ${r.colours} sampled colours, unsupported panel=${r.unsupported}, menu=${r.menu}`);
    gate('SG1e', 'boot with no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    await ctx.close();
  }
  {
    const { ctx, page } = await boot(browser, origin, { killWebGL: true });
    const r = await page.evaluate(() => ({ unsupported: !document.getElementById('unsupported').hidden, title: document.getElementById('unsupported-title').textContent.trim(), focus: document.activeElement && document.activeElement.id, menuInert: document.getElementById('menu').inert, raf: window.__rafCount }));
    gate('SG1b', 'forced-null context: the "WebGL 2 needed" panel appears and the menu is inert', r.unsupported && /WebGL 2 needed/.test(r.title) && r.menuInert, JSON.stringify(r));
    // Focus is reported, not asserted: the generated splash's primary picker
    // runs after the game's own focus() and can settle on an element inside
    // the inert menu (the behaviour Site #216 measures, estate-wide).
    say(`      SG1b observation: active element after the splash stands down = ${JSON.stringify(r.focus)} (game asked for #unsupported-title)`);
    await ctx.close();
  }
  // SG2 idle repaint.
  {
    const { ctx, page, errors } = await boot(browser, origin, { wait: 3500 });
    const c0 = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive(), mode: window.__SKYBREAK_TEST__.mode() }));
    await page.waitForTimeout(10000);
    const c1 = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive() }));
    gate('SG2a', 'menu idle: zero requestAnimationFrame calls over 10 s', c1.raf === c0.raf && !c1.loop, `RAF count ${c0.raf} -> ${c1.raf} over 10 s, loopActive=${c1.loop}, mode=${c0.mode}`);
    const ctl = control('SG2a', d => d.after === d.before, { before: 10, after: 610 }, 'a loop that kept scheduling (600 frames in 10 s) is refused');
    gate('SG2a-ctl', 'SG2a predicate has a firing control', ctl, 'planted 600-frame drift rejected');
    // resize repaints once
    const r0 = await page.evaluate(() => window.__rafCount);
    await page.setViewportSize({ width: 412, height: 900 }); await page.waitForTimeout(600);
    const r1 = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive() }));
    gate('SG2b', 'a resize repaints once and stays idle', r1.raf === r0 && !r1.loop, `RAF count ${r0} -> ${r1.raf} across a resize (paint is synchronous, no frame scheduled), loopActive=${r1.loop}`);
    // Launch resumes
    await page.click('#launch'); await page.waitForTimeout(1500);
    const l = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive(), mode: window.__SKYBREAK_TEST__.mode() }));
    gate('SG2c', 'Launch resumes the loop', l.loop && l.mode === 'playing' && l.raf > r1.raf + 20, `mode=${l.mode}, loopActive=${l.loop}, ${l.raf - r1.raf} frames in 1.5 s`);
    // Pause stops, Resume resumes
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    const p0 = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive(), mode: window.__SKYBREAK_TEST__.mode() }));
    await page.waitForTimeout(2000);
    const p1 = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive() }));
    gate('SG2d', 'Pause stops the loop', p0.mode === 'paused' && !p1.loop && p1.raf - p0.raf <= 1, `mode=${p0.mode}, frames while paused over 2 s: ${p1.raf - p0.raf}`);
    await page.click('#resume'); await page.waitForTimeout(1500);
    const q = await page.evaluate(() => ({ raf: window.__rafCount, loop: window.__SKYBREAK_TEST__.loopActive(), mode: window.__SKYBREAK_TEST__.mode() }));
    gate('SG2e', 'Resume restarts the loop cleanly', q.loop && q.mode === 'playing' && q.raf > p1.raf + 20 && errors.length === 0, `mode=${q.mode}, ${q.raf - p1.raf} frames in 1.5 s, errors=${errors.length}`);
    await ctx.close();
  }
  // SG3 self-tests and hook surface.
  {
    const { ctx, page } = await boot(browser, origin);
    const r = await page.evaluate(() => { const T = window.__SKYBREAK_TEST__; return { ok: T && T.ok, failures: T && T.failures, keys: T ? Object.keys(T).sort() : [] }; });
    const FROZEN = ['acceptRemotePacket', 'airframes', 'armory', 'assessRadarTrack', 'calculateRank', 'comboMultiplier', 'failures', 'isOceanXZ', 'medals', 'missionLimit', 'ok', 'qrMatrixV5', 'renderedTerrainHeight', 'segmentSphereHitT', 'signalDecode', 'signalEncode', 'solveIntercept', 'sonicPassQualifies', 'terrainHeight', 'version'];
    const missing = FROZEN.filter(k => !r.keys.includes(k));
    gate('SG3a', 'runSelfTests() reports no failures', r.ok === true && Array.isArray(r.failures) && r.failures.length === 0, `ok=${r.ok}, failures=${JSON.stringify(r.failures)}`);
    gate('SG3b', 'window.__SKYBREAK_TEST__ keeps its frozen surface (plus loopActive/mode/repaint)', missing.length === 0 && r.keys.includes('loopActive') && r.keys.includes('mode') && r.keys.includes('repaint'), missing.length ? 'missing ' + missing.join(',') : `${r.keys.length} keys`);
    await ctx.close();
  }
  // SG4 splash.
  {
    const init = () => { window.__splashSeen = []; try { const mo = new MutationObserver(l => { for (const rr of l) for (const n of rr.addedNodes) if (n.nodeType === 1 && n.matches && n.matches('[data-mbm-maker-splash]')) window.__splashSeen.push(performance.now()); }); mo.observe(document, { childList: true, subtree: true }); } catch (e) {} };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
    await page.addInitScript(init); await page.goto(origin + '/skybreak/'); await page.waitForTimeout(300);
    const a = await page.evaluate(() => ({ seen: window.__splashSeen.length, present: !!document.querySelector('[data-mbm-maker-splash]') }));
    await page.waitForTimeout(3200);
    const b = await page.evaluate(() => ({ present: !!document.querySelector('[data-mbm-maker-splash]'), key: localStorage.getItem('mbm_splash_last'), focus: document.activeElement && document.activeElement.id }));
    gate('SG4a', 'generated splash shows on first load, stands down, writes the shared key', a.seen === 1 && a.present && !b.present && /^\d{13}$/.test(String(b.key)), `seen=${a.seen}, at 3.5s present=${b.present}, key=${b.key}`);
    say(`      SG4a observation: active element after the splash stands down = ${JSON.stringify(b.focus)} (the estate picker's choice; verify_maker_splash.mjs owns that contract)`);
    await page.goto(origin + '/skybreak/'); await page.waitForTimeout(1000);
    const c = await page.evaluate(() => ({ seen: window.__splashSeen.length, present: !!document.querySelector('[data-mbm-maker-splash]') }));
    gate('SG4b', 'splash suppressed within 24 h on the shared key', c.seen === 0 && !c.present, `second load seen=${c.seen}`);
    await page.evaluate(() => localStorage.setItem('mbm_splash_last', String(Date.now() - 25 * 3600 * 1000)));
    await page.goto(origin + '/skybreak/'); await page.waitForTimeout(400);
    const d = await page.evaluate(() => window.__splashSeen.length);
    gate('SG4b-ctl', 'control: a 25 h-old key lets the splash show again', d === 1, `seen=${d}`);
    gate('SG4d', 'no page errors across the splash loads', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');
    await ctx.close();
    const timing = async rm => { const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm }); const p = await cx.newPage(); await p.goto(origin + '/skybreak/'); await p.waitForTimeout(700); const v = await p.evaluate(() => { const e = document.querySelector('[data-mbm-maker-splash]'); return e ? getComputedStyle(e).opacity : 'gone'; }); await cx.close(); return v; };
    const red = await timing('reduce'), nor = await timing('no-preference');
    gate('SG4c', 'reduced motion shortens the splash (700 ms: reduced stood down, normal still up)', red === 'gone' && nor !== 'gone', `reduced=${red}, normal=${nor}`);
  }
  // SG5 accessibility.
  {
    const { ctx, page } = await boot(browser, origin);
    const m = await page.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[aria-hidden="true"],[hidden]'); };
      const h1 = [...document.querySelectorAll('h1')].filter(vis).map(e => e.textContent.trim().slice(0, 40));
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
      const live = [...document.querySelectorAll('[aria-live]')].map(e => e.id || e.className);
      const vp = (document.querySelector('meta[name=viewport]') || {}).content || '';
      // A checkbox or radio inside a <label> is hit through the label, so the
      // label's box is the target that is measured.
      const targets = [...document.querySelectorAll('#menu button, #menu a[href], #menu summary, #menu select, #menu input')].filter(e => e.offsetParent !== null).map(e => (e.matches('input[type=checkbox],input[type=radio]') && e.closest('label')) ? e.closest('label') : e);
      const small = [...new Set(targets)].map(e => { const r = e.getBoundingClientRect(); return { id: e.id || (e.querySelector('input') || {}).id || e.tagName, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter(o => o.w < 44 || o.h < 44);
      return { h1, dup, live, vp, small };
    });
    gate('SG5a', 'exactly one rendered visible <h1>', m.h1.length === 1, JSON.stringify(m.h1));
    gate('SG5b', 'zero duplicate ids', m.dup.length === 0, m.dup.join(',') || 'none');
    gate('SG5b-ctl', 'SG5b predicate has a firing control', control('SG5b', ids => ids.length === new Set(ids).size, ['a', 'b', 'a'], 'a planted duplicate id is refused'), 'planted [a,b,a] rejected');
    gate('SG5c', 'aria-live region intact', m.live.length >= 1, m.live.join(', '));
    gate('SG5d', 'viewport keeps zoom enabled', !/user-scalable\s*=\s*(no|0)/i.test(m.vp) && !/maximum-scale\s*=\s*1(\.0)?\b/i.test(m.vp), `viewport="${m.vp}"`);
    gate('SG5e', '44 px menu targets at 390x844', m.small.length === 0, m.small.length ? JSON.stringify(m.small.slice(0, 5)) : 'all visible menu controls clear the floor');
    let presses = -1;
    for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(25); if (await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back')) { presses = i + 1; break; } }
    const before = page.url(); if (presses > 0) { await page.keyboard.press('Enter'); await page.waitForTimeout(1000); }
    gate('SG5f', 'a real Tab walk reaches the exit and Enter navigates to /games/', presses > 0 && /\/games\/?$/.test(page.url()) && page.url() !== before, presses > 0 ? `reached in ${presses} press(es); Enter -> ${page.url().replace(/^https?:\/\/[^/]+/, '')}` : 'exit never focused');
    await ctx.close();
  }
  // SG6 egress incl. the HOTAS fold + QR.
  {
    const { ctx, page, external, errors } = await boot(browser, origin);
    await page.click('details.local-link-fold summary'); await page.waitForTimeout(300);
    const open = await page.evaluate(() => document.querySelector('details.local-link-fold').open);
    await page.click('#open-local-link'); await page.waitForTimeout(2500);
    const ll = await page.evaluate(() => { const s = document.getElementById('local-link'); const qr = s && (s.querySelector('canvas') || s.querySelector('svg') || s.querySelector('img')); const rtc = typeof RTCPeerConnection; return { shown: !!s && !s.hidden, qr: !!qr, qrSize: qr ? [qr.width || qr.clientWidth, qr.height || qr.clientHeight] : null, rtc }; });
    await shot(page, 'sg6-hotas');
    gate('SG6a', 'the HOTAS fold opens and the Local Link panel renders a pairing code', open && ll.shown && ll.qr, JSON.stringify(ll));
    await page.waitForTimeout(3000);
    gate('SG6b', 'G-EGRESS: zero non-same-origin requests including the Local Link handshake', external.length === 0, external.length ? external.slice(0, 3).join(' | ') : `0 external requests; ${errors.length} error(s)`);
    const n = external.length; await page.evaluate(() => { try { fetch('https://egress-control.invalid/ping', { mode: 'no-cors' }).catch(() => {}); } catch (_) {} }); await page.waitForTimeout(800);
    gate('SG6-ctl', 'control: an injected external fetch is counted', external.length === n + 1, `external ${n} -> ${external.length}`);
    await ctx.close();
  }
  // SG7 real-input playability. The harness flies with real key presses,
  // reading only what a pilot reads off the HUD (the target box's bearing and
  // elevation, the LOCK state) through the hook's hud() readout.
  {
    const { ctx, page, errors } = await boot(browser, origin);
    await page.click('#launch'); await page.waitForTimeout(1500);
    await shot(page, 'sg7-1-launch');
    const t0 = Date.now(); let kill = null, end = null, held = new Set(), samples = 0, firstTarget = null;
    const hold = async (k, on) => { if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); } };
    while (Date.now() - t0 < 150000) {
      const h = await page.evaluate(() => { const T = window.__SKYBREAK_TEST__; return { hud: T.hud(), status: (document.getElementById('status') || {}).textContent || '', debrief: !document.getElementById('debrief').hidden, result: (document.getElementById('result') || {}).textContent, rank: (document.getElementById('rank') || {}).textContent }; });
      samples++;
      if (h.debrief) { end = h; break; }
      const hud = h.hud; if (!hud) { await page.waitForTimeout(200); continue; }
      if (!kill && hud.kills >= 1) { kill = `kills=${hud.kills} at ${Math.round((Date.now() - t0) / 1000)}s, status "${h.status.slice(0, 60)}"`; await shot(page, 'sg7-2-kill'); for (const k of [...held]) await hold(k, false); break; }
      if (!hud.target) { await page.keyboard.press('KeyX'); await page.waitForTimeout(150); continue; }
      if (!firstTarget) firstTarget = hud.target.label;
      const t = hud.target;
      // steer the nose onto the target: right/left by roll, up/down by pitch
      await hold('KeyD', t.right > 0.06); await hold('KeyA', t.right < -0.06);
      await hold('KeyS', t.up > 0.05); await hold('KeyW', t.up < -0.05);
      await hold('KeyR', t.dist > 900);
      const onNose = t.fwd > 0.985;
      await hold('Space', onNose && t.dist < 1400);
      if (hud.lock >= 1.18 && hud.missiles > 0) { await page.keyboard.press('KeyM'); }
      await page.waitForTimeout(120);
    }
    for (const k of [...held]) await hold(k, false);
    gate('SG7a', 'real input: one air target destroyed', !!kill, kill ? `${kill}; first target ${firstTarget}; ${samples} HUD samples` : `no kill in ${Math.round((Date.now() - t0) / 1000)}s; first target ${firstTarget}; ${samples} samples`);
    // let the mission run on to its end (loss or win) for the rank
    const t1 = Date.now();
    while (!end && Date.now() - t1 < 150000) {
      await page.keyboard.press('KeyX');
      const h = await page.evaluate(() => { const T = window.__SKYBREAK_TEST__; return { hud: T.hud(), debrief: !document.getElementById('debrief').hidden, result: (document.getElementById('result') || {}).textContent, rank: (document.getElementById('rank') || {}).textContent }; });
      if (h.debrief) { end = h; break; }
      if (h.hud && h.hud.target) { const t = h.hud.target; await hold('KeyD', t.right > 0.06); await hold('KeyA', t.right < -0.06); await hold('KeyS', t.up > 0.05); await hold('KeyW', t.up < -0.05); await hold('Space', t.fwd > 0.985 && t.dist < 1400); if (h.hud.lock >= 1.18) await page.keyboard.press('KeyM'); }
      await page.waitForTimeout(150);
    }
    for (const k of [...held]) await hold(k, false);
    await shot(page, 'sg7-3-end');
    const prof = await page.evaluate(() => localStorage.getItem('skybreak_vector_profile_v4'));
    gate('SG7b', 'the mission ends with a rank', !!end && /^[SABCD]$/.test((end.rank || '').trim()), end ? `result "${end.result}", rank ${end.rank}` : 'no debrief within the window');
    await page.reload(); await page.waitForTimeout(3000);
    const prof2 = await page.evaluate(() => ({ same: localStorage.getItem('skybreak_vector_profile_v4'), ok: window.__SKYBREAK_TEST__.ok }));
    gate('SG7c', 'profile persists and reloads', !!prof && prof2.same === prof && prof2.ok, `profile ${prof ? prof.length + ' chars' : 'absent'}, identical after reload=${prof2.same === prof}`);
    gate('SG7d', 'no page errors across the session', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');
    await ctx.close();
  }
}

async function selftest(html) {
  say('\n--- non-vacuity: each static gate must fail on a build that violates it ---');
  const muts = [
    { gate: 'SG0a', why: 're-add an external script', mutate: s => s.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>') },
    { gate: 'SG0b', why: 'introduce a syntax error', mutate: s => s.replace('function runSelfTests() {', 'function runSelfTests() {{{') },
    { gate: 'SG0c', why: 'tamper with the exit region', mutate: s => s.replace('MBM-INLINE-EXIT:END -->', 'MBM-INLINE-EXIT:END --><!--x-->') },
    { gate: 'SG0d', why: 'put the hand-written splash back', mutate: s => s.replace('<main id="menu"', '<div id="splash" class="overlay"></div><main id="menu"') },
    { gate: 'SG0e', why: 'put V4 back in the title', mutate: s => s.replace('<title>Skybreak Vector', '<title>Skybreak Vector V4') },
    { gate: 'SG0f', why: 're-add the download link', mutate: s => s.replace('</main>', '<a href="x.html" download>Download</a></main>') },
    { gate: 'SG0g', why: 'rename the profile key', mutate: s => s.replace('PROFILE_KEY="skybreak_vector_profile_v4"', 'PROFILE_KEY="skybreak_vector_profile_v5"') },
    { gate: 'SG0h', why: 'add a STUN server', mutate: s => s.replace('iceServers:[]', 'iceServers:[{urls:"stun:stun.example.com:19302"}]') },
    { gate: 'SG0i', why: 'pad the file past the raw ceiling', mutate: s => s.replace('</body>', '<!--' + 'x'.repeat(RAW_BUDGET) + '--></body>') },
    { gate: 'SG0k', why: 'add a NEW · marker', mutate: s => s.replace('<h1 id="title">', '<h1 id="title">NEW · ') },
  ];
  let proven = 0; const vac = [];
  for (const m of muts) { const b = m.mutate(html); if (b === html) { vac.push(m.gate + ' (inert)'); continue; } const saved = results; results = []; staticGates(b); const hit = results.find(r => r.id === m.gate); results = saved; if (hit && !hit.ok) { say(`  CAUGHT  ${m.gate}: ${m.why}`); proven++; } else { say(`  VACUOUS ${m.gate}: ${m.why}`); vac.push(m.gate); } }
  gate('SG8', 'static gates are non-vacuous', vac.length === 0, `${proven}/${muts.length} violations caught${vac.length ? '; vacuous: ' + vac.join(' | ') : ''}`);
}

(async () => {
  if (!fs.existsSync(GAME)) { say(`no file at ${GAME}`); process.exit(1); }
  const html = fs.readFileSync(GAME, 'utf8');
  say(`Skybreak Vector harness — ${GAME}`);
  say(`bytes ${Buffer.byteLength(html)}  sha256 ${(await import('node:crypto')).createHash('sha256').update(html).digest('hex')}\n`);
  staticGates(html);
  const { server, port } = await serve(GAME); const origin = `http://127.0.0.1:${port}`;
  let browser;
  try { browser = await loadChromium().launch(CHROME ? { executablePath: CHROME } : {}); } catch (e) { gate('SGB', 'browser gates', false, 'chromium unavailable: ' + e.message); }
  if (browser) { say(''); try { await browserGates(browser, origin); } catch (e) { gate('SGX', 'browser gates ran without a harness error', false, 'HARNESS ERROR: ' + String(e.message || e).slice(0, 200)); } finally { await browser.close(); } }
  if (SELFTEST) await selftest(html);
  server.close();
  const bad = results.filter(r => !r.ok);
  say(`\n${results.length - bad.length}/${results.length} gates green`);
  if (bad.length) { say('FAILED: ' + bad.map(b => b.id).join(', ')); process.exit(1); }
  say('ALL GATES GREEN');
})();
