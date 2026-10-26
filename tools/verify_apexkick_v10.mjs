#!/usr/bin/env node
/**
 * Route gate for /apexkick/ — Apex Kick: World Stage V10 (ruling AK10-O).
 *
 * Serves the shipped bytes at their real path from this checkout and drives
 * them in headless Chromium. Nothing in the game is edited and V10 exposes no
 * test hooks, so every assertion is made from outside: real buttons, synthetic
 * PointerEvents on #swipe-canvas (pointerup on window, as the game listens),
 * the DOM it renders, and three read-only instruments installed before any
 * page script runs:
 *
 *   - three.js: the served vendor/three.min.js runs untouched; the moment it
 *     has executed (its load event, which fires before the next parser script)
 *     THREE.WebGLRenderer is swapped for a no-op stub (setSize, setPixelRatio,
 *     render, shadowMap). Software GL would otherwise throttle the game's own
 *     clock. The stub's render(scene) is also how the gate reads the ball's
 *     position — the only way to know a shot is genuinely in flight.
 *   - timers: setTimeout/clearTimeout are wrapped and every timer created from
 *     the game's own later() helper is tagged as a match timer.
 *   - storage: every setItem/removeItem/clear on local and session storage.
 *
 * requestAnimationFrame is the browser's own, at real time.
 *
 * Assertions (AK10-O):
 *   1 boots with zero pageerror / console.error
 *   2 each of the 9 modes plays to the result modal (Time Attack by clock
 *     expiry, Keeper by the AI strike)
 *   3 Locker opened mid keeper run-up freezes the run-up; it resumes on close
 *   4 Hub mid-flight leaves zero pending match timers and no shot advance
 *   5 the game's storage writes are exactly mbm_apexkick_v10_save (plus
 *     mbm_apexkick_v10_save_corrupt_backup only when seeded corrupt), never
 *     mbm_sports_passport_v4 or any pre-V10 Apex Kick key, and nothing is
 *     removed. A key the canonical maker splash writes is attributed to that
 *     component by data/as1-storage-registry.json, never to the game.
 *   6 zero network requests beyond the page and its vendored script
 *   7 the exit anchors resolve
 *
 *   node tools/verify_apexkick_v10.mjs [path/to/index.html]
 *   node tools/verify_apexkick_v10.mjs --self-test     four firing controls, each must RED
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = '/apexkick/';
const VENDOR = '/apexkick/vendor/three.min.js';
const SAVE_KEY = 'mbm_apexkick_v10_save';
const BACKUP_KEY = SAVE_KEY + '_corrupt_backup';
const MODES = ['tour', 'freekick', 'timeattack', 'corner', 'keeper', 'targets', 'volley', 'crossbar', 'shootout2p'];
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');
const TARGET = path.resolve(args.find(a => !a.startsWith('--')) || path.join(ROOT, 'apexkick', 'index.html'));

// Keys a shared component (not the game) owns, from the storage census itself.
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/as1-storage-registry.json'), 'utf8'));
const COMPONENT_KEYS = new Set(registry.entries.filter(e => e.owner.startsWith('component:') && e.writes.length).map(e => e.storage + ':' + e.key));
const forbidden = key => /^mbm_sports_passport_v/.test(key) || /^mbm_sports_v4_/.test(key) || /^apexkick\./.test(key) || key === 'mbm_v6_apex_kick_profile';

// ---------------------------------------------------------------------------
// Instruments, installed before any page script.
const INSTRUMENTS = `(() => {
  const A = window.__ak10 = { writes: [], removes: [], clears: 0, timers: new Map(), seq: 0, stubbed: false, revision: null, ball: null, frames: 0 };
  const st = window.setTimeout, ct = window.clearTimeout;
  window.setTimeout = function (fn, ms, ...rest) {
    const match = /\\bat later\\b/.test(new Error().stack || '');
    let id = 0;
    const wrapped = typeof fn === 'function' ? function () { A.timers.delete(id); return fn.apply(this, arguments); } : fn;
    id = st.call(window, wrapped, ms, ...rest);
    A.timers.set(id, { match });
    return id;
  };
  window.clearTimeout = function (id) { A.timers.delete(id); return ct.call(window, id); };
  A.pendingMatch = () => [...A.timers.values()].filter(t => t.match).length;
  const proto = Storage.prototype, set = proto.setItem, rem = proto.removeItem, clr = proto.clear;
  const area = s => s === window.sessionStorage ? 'sessionStorage' : 'localStorage';
  proto.setItem = function (k, v) { A.writes.push({ area: area(this), key: String(k), value: String(v) }); return set.apply(this, arguments); };
  proto.removeItem = function (k) { A.removes.push({ area: area(this), key: String(k) }); return rem.apply(this, arguments); };
  proto.clear = function () { A.clears++; return clr.apply(this, arguments); };
  document.addEventListener('load', e => {
    const t = e.target;
    if (A.stubbed || !t || t.tagName !== 'SCRIPT' || !window.THREE || !window.THREE.WebGLRenderer) return;
    A.revision = String(window.THREE.REVISION);
    const Stub = function (opts) { this.domElement = (opts && opts.canvas) || document.createElement('canvas'); this.shadowMap = { enabled: false, type: 0 }; };
    Stub.prototype.setSize = function () {};
    Stub.prototype.setPixelRatio = function () {};
    Stub.prototype.render = function (scene) {
      A.frames++;
      if (!A.ballMesh) scene.traverse(o => { if (!A.ballMesh && o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.geometry.parameters && o.geometry.parameters.radius < 0.2 && o.geometry.parameters.radius > 0.08) A.ballMesh = o; });
      if (A.ballMesh) A.ball = { x: A.ballMesh.position.x, y: A.ballMesh.position.y, z: A.ballMesh.position.z };
    };
    window.THREE.WebGLRenderer = Stub;
    A.stubbed = true;
  }, true);
})();`;

// ---------------------------------------------------------------------------
// A static server over this checkout; /apexkick/ serves the file under test.
function serve(gameFile) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file;
    if (url.pathname === ROUTE || url.pathname === ROUTE + 'index.html') file = gameFile;
    else {
      file = path.join(ROOT, decodeURIComponent(url.pathname));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// ---------------------------------------------------------------------------
class Run {
  constructor(browser, origin) { this.browser = browser; this.origin = origin; this.errors = []; this.requests = []; this.writes = []; this.removes = []; this.clears = 0; }
  async page({ seed } = {}) {
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route('**/*', route => {
      const u = new URL(route.request().url());
      return u.origin === this.origin ? route.continue() : route.abort();
    });
    if (seed !== undefined) await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__ak10_seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__ak10_seeded', '1'); } }, [SAVE_KEY, seed]);
    await context.addInitScript(INSTRUMENTS);
    const page = await context.newPage();
    page.on('pageerror', e => this.errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') this.errors.push('console.error: ' + m.text()); });
    page.on('request', r => this.requests.push(r.url()));
    return page;
  }
  async boot(page, query = '?splash=skip') {
    const resp = await page.goto(this.origin + ROUTE + query, { waitUntil: 'load' });
    if (!resp || resp.status() !== 200) throw new Error('page did not load');
    await page.waitForFunction(() => window.__ak10 && window.__ak10.frames > 5, null, { timeout: 15000 });
    await page.waitForFunction(() => !document.getElementById('hub-modal').classList.contains('hidden'), null, { timeout: 10000 });
  }
  async harvest(page) {
    const got = await page.evaluate(() => ({ writes: window.__ak10.writes, removes: window.__ak10.removes, clears: window.__ak10.clears }));
    this.writes.push(...got.writes); this.removes.push(...got.removes); this.clears += got.clears;
    return got;
  }
  async close(page) { await this.harvest(page).catch(() => {}); await page.context().close(); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('missing ' + s); e.click(); }, sel);
const resultShown = page => page.evaluate(() => !document.getElementById('result-modal').classList.contains('hidden'));
const banner = page => page.evaluate(() => ({ show: document.getElementById('center-banner').classList.contains('show'), title: document.getElementById('banner-title').textContent }));
const savedShots = page => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) || '{}').shots ?? 0; } catch { return null; } }, SAVE_KEY);

// A short upward flick: the game derives loft from the swipe's height, and a
// tall swipe lofts every shot over the bar. 12-20% of the viewport keeps the
// ball under it, so shots genuinely score, miss and get saved.
async function swipe(page, dx = 0, rise = 0.15) {
  await page.evaluate(async ([dx, rise]) => {
    const c = document.getElementById('swipe-canvas');
    const W = innerWidth, H = innerHeight, x0 = W / 2, y0 = H * 0.86, x1 = x0 + dx, y1 = y0 - H * rise;
    const ev = (type, x, y, target) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    ev('pointerdown', x0, y0, c);
    for (let i = 1; i <= 8; i++) { await new Promise(r => setTimeout(r, 18)); ev('pointermove', x0 + (x1 - x0) * i / 8 + Math.sin(i / 8 * Math.PI) * 18, y0 + (y1 - y0) * i / 8, c); }
    await new Promise(r => setTimeout(r, 18));
    ev('pointerup', x1, y1, window);
  }, [dx, rise]);
}

async function startMode(page, mode) {
  await click(page, `.mode-card[data-mode="${mode}"]`);
  await click(page, '#btn-start-match');
  await page.waitForFunction(() => document.getElementById('hub-modal').classList.contains('hidden'), null, { timeout: 5000 });
}

async function playToResult(page, mode) {
  const budget = mode === 'timeattack' ? 90000 : mode === 'shootout2p' ? 150000 : 100000;
  const t0 = Date.now();
  let swipes = 0;
  while (Date.now() - t0 < budget) {
    if (await resultShown(page)) {
      const title = await page.evaluate(() => document.getElementById('res-title').textContent + ' · ' + document.getElementById('res-goals-lbl').textContent + ' ' + document.getElementById('res-goals').textContent);
      return { ok: true, title, swipes, seconds: ((Date.now() - t0) / 1000).toFixed(1) };
    }
    if (mode === 'shootout2p') {
      // Decisive by construction, through the game's own controls: Player 2
      // shoots far wide; on Player 1's kick the other player picks the centre
      // dive and Player 1 places it to a side. One P1 goal settles it.
      const p2 = /P2 KICK/.test(await page.evaluate(() => document.getElementById('hud-mode-tag').textContent));
      if (p2) await swipe(page, 1100, 0.14);
      else { await click(page, '.dive-btn[data-dive="0"]'); await swipe(page, (swipes % 2 ? -1 : 1) * (90 + (swipes % 3) * 30), 0.12 + (swipes % 3) * 0.03); }
      swipes++;
    } else if (mode !== 'keeper' && mode !== 'timeattack') { await swipe(page, (swipes % 5 - 2) * 30, 0.12 + (swipes % 3) * 0.04); swipes++; }
    await sleep(700);
  }
  return { ok: false, title: null, swipes, seconds: (budget / 1000).toFixed(0) };
}

// ---------------------------------------------------------------------------
async function judge(gameFile, { expect = null } = {}) {
  const server = await serve(gameFile);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const run = new Run(browser, origin);
  const results = [];
  let stop = false;
  const check = (id, name, ok, detail) => {
    results.push({ id, name, ok, detail });
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ' · ' + detail : ''}`);
    if (!ok && expect) stop = true;
  };
  try {
    // Boot as a visitor gets it (the splash shown), then judge 1, 6 and 7.
    const page = await run.page();
    let booted = true;
    try { await run.boot(page, ''); } catch (e) { booted = false; run.errors.push('boot: ' + e.message); }
    const probe = booted ? await page.evaluate(() => ({ stubbed: window.__ak10.stubbed, revision: window.__ak10.revision })) : { stubbed: false, revision: null };
    check('1', 'boots with zero pageerror / console.error', booted && run.errors.length === 0, run.errors.slice(0, 3).join(' | ') || 'none');
    check('1a', 'served vendor/three.min.js ran (r128) before the game, renderer stubbed', probe.stubbed && probe.revision === '128', `revision ${probe.revision}, stubbed ${probe.stubbed}`);
    const allowed = new Set([origin + ROUTE, origin + VENDOR]);
    const extra = [...new Set(run.requests)].filter(u => !allowed.has(u.replace(/\?.*$/, '')));
    check('6', 'zero network requests beyond the page and its vendored script (boot)', extra.length === 0 && run.requests.some(u => u === origin + VENDOR), extra.join(', ') || [...new Set(run.requests)].map(u => u.replace(origin, '')).join(', '));
    // 7: each exit anchor's resolved href is the declared destination and is served.
    const anchors = booted ? await page.evaluate(() => [...document.querySelectorAll('#mbmexit-back,#mbmexit-home')].map(a => ({ id: a.id, href: a.href, visible: getComputedStyle(a).display !== 'none' }))) : [];
    const back = anchors.find(a => a.id === 'mbmexit-back');
    let backStatus = 0;
    if (back) backStatus = await new Promise(r => http.get(back.href, res => { res.resume(); r(res.statusCode); }).on('error', () => r(0)));
    check('7', 'the exit anchors resolve', !!back && back.href === origin + '/games/' && backStatus === 200, back ? `${back.href.replace(origin, '')} → HTTP ${backStatus}` : 'no #mbmexit-back');
    if (booted) await run.close(page);
    const bootBanned = [...new Set([...run.writes, ...run.removes].map(w => w.key))].filter(forbidden);
    check('5', 'boot writes or removes no passport or pre-V10 Apex Kick key', bootBanned.length === 0, bootBanned.join(', ') || `${run.writes.length} write(s) at boot`);
    if (stop) return finish();

    // 5a: a corrupt save is backed up byte-for-byte and the game still boots.
    {
      const raw = '{AK10-not-json:☃';
      const p = await run.page({ seed: raw });
      await run.boot(p);
      const got = await run.harvest(p);
      const backup = got.writes.filter(w => w.key === BACKUP_KEY);
      check('5a', 'a corrupt save is backed up exactly, once', backup.length === 1 && backup[0].value === raw, `${backup.length} backup write(s)`);
      await p.context().close();
      run.writes = run.writes.filter(w => !(w.key === BACKUP_KEY && w.value === raw));
      if (stop) return finish();
    }

    // 2: every mode to its result modal.
    for (const mode of MODES) {
      const p = await run.page();
      await run.boot(p);
      await startMode(p, mode);
      const r = await playToResult(p, mode);
      check('2', `${mode} plays to the result modal`, r.ok && run.errors.length === 0, r.ok ? `"${r.title}" after ${r.seconds}s, ${r.swipes} swipe(s)` : `no result modal in ${r.seconds}s; ${run.errors.slice(0, 2).join(' | ')}`);
      await run.close(p);
      if (stop) return finish();
    }

    // 3: Locker mid keeper run-up holds the run-up; closing resumes it rather than restarting.
    {
      const p = await run.page();
      await run.boot(p);
      await startMode(p, 'keeper');
      const b0 = await banner(p);
      await sleep(500);
      await click(p, '#btn-open-shop');
      await sleep(3000);
      const held = await banner(p);
      const lockerOpen = await p.evaluate(() => !document.getElementById('locker-modal').classList.contains('hidden'));
      await click(p, '#btn-close-locker');
      const tClose = Date.now();
      let struck = 0;
      while (Date.now() - tClose < 4000) { if (!(await banner(p)).show) { struck = Date.now() - tClose; break; } await sleep(25); }
      let outcome = null;
      const tOut = Date.now();
      while (Date.now() - tOut < 6000) { const b = await banner(p); if (b.show && b.title !== b0.title) { outcome = b.title; break; } await sleep(50); }
      const ok = b0.show && /GET SET/.test(b0.title) && lockerOpen && held.show && held.title === b0.title && struck > 0 && struck < 1350 && !!outcome;
      check('3', 'Locker mid keeper run-up freezes the run-up and resumes on close', ok,
        `run-up held ${held.show && held.title === b0.title ? 'yes' : 'NO'} through 3.0s of Locker; strike ${struck ? struck + 'ms' : 'never'} after close (fresh run-up is 1500ms); then "${outcome}"`);
      await run.close(p);
      if (stop) return finish();
    }

    // 4: Hub mid-flight cancels every match timer and the shot never lands.
    {
      const p = await run.page();
      await run.boot(p);
      await startMode(p, 'freekick');
      await sleep(600);
      await swipe(p);
      let live = 0;
      const t1 = Date.now();
      // One read for both: with two, a shot ending between them read as "0 timers" and then stopped on its banner.
      while (Date.now() - t1 < 8000) {
        const s = await p.evaluate(() => ({ pending: window.__ak10.pendingMatch(), show: document.getElementById('center-banner').classList.contains('show') }));
        live = Math.max(live, s.pending); if (s.show) break; await sleep(25);
      }
      await sleep(2200);   // the next shot is set up
      const shotsBefore = await savedShots(p);
      await swipe(p, 30);
      let z0 = null, moving = false;
      const t2 = Date.now();
      while (Date.now() - t2 < 3000) {
        const ball = await p.evaluate(() => window.__ak10.ball);
        if (z0 === null) z0 = ball && ball.z;
        if (ball && z0 !== null && z0 - ball.z > 1.5) { moving = true; break; }
        await sleep(10);
      }
      await click(p, '#btn-menu');
      const pendingNow = await p.evaluate(() => window.__ak10.pendingMatch());
      const ballAtHub = await p.evaluate(() => window.__ak10.ball);
      await sleep(5000);
      const after = await p.evaluate(() => ({ pending: window.__ak10.pendingMatch(), ball: window.__ak10.ball, hub: !document.getElementById('hub-modal').classList.contains('hidden'), result: !document.getElementById('result-modal').classList.contains('hidden') }));
      const shotsAfter = await savedShots(p);
      const still = ballAtHub && after.ball && Math.abs(after.ball.z - ballAtHub.z) < 0.01;
      const ok = live > 0 && moving && pendingNow === 0 && after.pending === 0 && after.hub && !after.result && shotsAfter === shotsBefore && still;
      check('4', 'Hub mid-flight leaves zero pending match timers and no shot advance', ok,
        `instrument saw ${live} match timer(s) after shot 1; shot 2 in flight ${moving ? 'yes' : 'NO'}; pending at Hub ${pendingNow}, 5s later ${after.pending}; saved shots ${shotsBefore}→${shotsAfter}; ball ${still ? 'stopped' : 'MOVED'}`);
      await run.close(p);
      if (stop) return finish();
    }

    // 1 and 6 across the whole session, then 5.
    check('1', 'zero pageerror / console.error across every run', run.errors.length === 0, run.errors.slice(0, 3).join(' | ') || 'none');
    const all = new Set(run.requests.map(u => u.replace(/\?.*$/, '')));
    const extraAll = [...all].filter(u => u !== origin + ROUTE && u !== origin + VENDOR);
    check('6', 'zero network requests beyond the page and its vendored script (every run)', extraAll.length === 0, extraAll.join(', ') || `${run.requests.length} request(s), 2 distinct URLs`);
    finishStorage();
    return finish();
  } finally {
    await browser.close();
    server.close();
  }

  function finishStorage() {
    const game = run.writes.filter(w => !COMPONENT_KEYS.has(w.area + ':' + w.key));
    const component = [...new Set(run.writes.filter(w => COMPONENT_KEYS.has(w.area + ':' + w.key)).map(w => w.area + ':' + w.key))];
    const keys = [...new Set(game.map(w => w.area + ':' + w.key))];
    const bad = keys.filter(k => k !== 'localStorage:' + SAVE_KEY);
    const banned = [...new Set([...run.writes, ...run.removes].map(w => w.key))].filter(forbidden);
    check('5', `storage writes are exactly ${SAVE_KEY} (backup only when seeded corrupt); never the passport or a pre-V10 key; nothing removed`,
      keys.length === 1 && bad.length === 0 && banned.length === 0 && run.removes.length === 0 && run.clears === 0,
      `game keys [${keys.join(', ')}]${bad.length ? ' UNEXPECTED ' + bad.join(', ') : ''}${banned.length ? ' FORBIDDEN ' + banned.join(', ') : ''}; removes ${run.removes.length}; component-owned [${component.join(', ') || 'none'}]`);
  }
  function finish() {
    return results;
  }
}

// ---------------------------------------------------------------------------
function mutate(src, needle, replacement, name) {
  if (src.split(needle).length !== 2) throw new Error(`control ${name}: needle must occur exactly once`);
  return src.replace(needle, replacement);
}

async function selfTest() {
  const src = fs.readFileSync(TARGET, 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ak10-controls-'));
  const controls = [
    { name: '(a) a thrown error injected into finishShot', expect: ['1', '2'],
      src: mutate(src, 'function finishShot(outcome, title, sub, pts = 0, opts = {}) {', "function finishShot(outcome, title, sub, pts = 0, opts = {}) { throw new Error('AK10 control (a)');", 'a') },
    { name: "(b) an injected localStorage.setItem('mbm_sports_passport_v4', …)", expect: ['5'],
      src: mutate(src, 'let save = loadSave();', "let save = loadSave(); try { localStorage.setItem('mbm_sports_passport_v4', '{\"ak10\":\"control\"}'); } catch (e) {}", 'b') },
    { name: '(c) the three src pointed back at cdnjs', expect: ['1', '1a', '6'],
      src: mutate(src, '<script src="vendor/three.min.js"></script>', `<script src="${CDN}"></script>`, 'c') },
    { name: '(d) the exit href mutated /games/ → /gomes/', expect: ['7'],
      src: mutate(src, 'href:"/games/"', 'href:"/gomes/"', 'd') },
  ];
  let ok = true;
  for (const c of controls) {
    const file = path.join(dir, 'index.html');
    fs.writeFileSync(file, c.src);
    console.log(`CONTROL ${c.name}`);
    const results = await judge(file, { expect: c.expect });
    const failed = results.filter(r => !r.ok).map(r => r.id);
    const fired = failed.some(id => c.expect.includes(id));
    console.log(`CONTROL ${c.name}: ${fired ? 'RED as required' : 'DID NOT RED'} (failed: ${failed.join(', ') || 'none'})`);
    ok = ok && fired;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`self-test: ${ok ? 'PASS' : 'FAIL'} — every firing control must RED`);
  return ok;
}

if (SELF_TEST) {
  process.exitCode = (await selfTest()) ? 0 : 1;
} else {
  console.log(`Apex Kick V10 route gate · ${path.relative(ROOT, TARGET)}`);
  const results = await judge(TARGET);
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length ? 'RED' : 'GREEN'} — ${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
}
