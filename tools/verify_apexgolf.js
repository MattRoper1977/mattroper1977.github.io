#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME_FILE = process.env.AG_GAME_FILE || path.join(ROOT, 'apexgolf', 'index.html');
const SENTINEL = 'apexgolf-build-2026-08-04';
const REQUIRE_BROWSER = process.env.AG_REQUIRE_BROWSER === '1';
const SKIP_BROWSER = process.argv.includes('--no-browser') || (!REQUIRE_BROWSER && !process.env.AG_BROWSER);
const html = fs.readFileSync(GAME_FILE, 'utf8');
const byteCount = Buffer.byteLength(html, 'utf8');
const results = [];
let browserRuns = null;

function lineFor(pattern) {
  const i = html.search(pattern);
  return i < 0 ? -1 : html.slice(0, i).split('\n').length;
}
function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }
function close(a, b, eps, message) { if (Math.abs(a - b) > eps) fail(`${message}: ${a} vs ${b} (ε ${eps})`); }
function gate(id, name, fn, options = {}) {
  if (options.browser && SKIP_BROWSER) {
    results.push({ id, name, status: 'SKIP', detail: 'No usable local browser; this gate is required in GitHub Actions.' });
    console.log(`SKIP ${id} ${name} — no usable local browser; required in GitHub Actions`);
    return;
  }
  try {
    const detail = fn() || '';
    results.push({ id, name, status: 'PASS', detail });
    console.log(`PASS ${id} ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ id, name, status: 'FAIL', detail: error && error.stack ? error.stack : String(error) });
    console.error(`FAIL ${id} ${name} — ${error.message || error}`);
  }
}

function extractCore() {
  const start = html.indexOf('AG:CORE:BEGIN');
  const end = html.indexOf('/* AG:CORE:END */');
  assert(start >= 0 && end > start, 'core markers missing or out of order');
  const codeStart = html.indexOf('*/', start) + 2;
  const code = html.slice(codeStart, end);
  const exported = Function('console', code + '\n;return AG;')(console);
  assert(exported, 'AG was not exported by the shipped core');
  return exported;
}
const AG = extractCore();

if (process.env.AG_TAMPER_CHILD === '1') {
  const lines = html.trimEnd().split('\n');
  const occurrences = (html.match(new RegExp(SENTINEL, 'g')) || []).length;
  const ok = lines[0].includes(SENTINEL) && lines[lines.length - 1].includes(SENTINEL) && occurrences === 2;
  console.log(ok ? 'PASS G1 tamper child' : 'FAIL G1 tamper child');
  process.exit(ok ? 0 : 1);
}

function neutralHole(seed, index) {
  const h = AG.generateHole(seed, index);
  h.wind = { x: 0, y: 0, speed: 0 };
  h.slope.strength = 0;
  return h;
}
function testHole(opts = {}) {
  const h = AG.generateHole(1234, 0);
  h.world = { w: 120, h: 70 };
  h.tee = { x: 8, y: 35 };
  h.cup = { x: 82, y: 35 };
  h.fairway = [{x:0,y:0},{x:120,y:0},{x:120,y:70},{x:0,y:70}];
  h.green = { x: 82, y: 35, rx: 25, ry: 25 };
  h.bunkers = [];
  h.water = [];
  h.trees = [];
  h.bumpers = [];
  h.wind = { x: 0, y: 0, speed: 0 };
  h.slope = { x: 1, y: 0, strength: 0, cx: 82, cy: 35, radius: 30 };
  return Object.assign(h, opts);
}
function findBrowser() {
  const candidates = [
    process.env.AG_BROWSER,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const p of candidates) {
    if (p.includes(path.sep) && fs.existsSync(p)) return p;
    if (!p.includes(path.sep)) {
      const r = spawnSync('bash', ['-lc', `command -v ${JSON.stringify(p)}`], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
  }
  return null;
}
function decodeHtmlText(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function runChrome(browser, url, width, height, extra = []) {
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--disable-sync', '--no-first-run', '--hide-scrollbars',
    `--window-size=${width},${height}`, '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=14000', ...extra, '--dump-dom', url
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const limit = 8 * 1024 * 1024;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`browser launch timed out after 45s; stderr: ${stderr.slice(-1200)}`));
    }, 45000);
    child.on('error', (error) => finish(new Error(`browser launch failed: ${error.message}`)));
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > limit) {
        child.kill('SIGKILL');
        finish(new Error('browser DOM exceeded the 8 MiB contract limit'));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, 'utf8') > limit) stderr = stderr.slice(-limit);
    });
    child.on('close', (code, signal) => {
      if (code !== 0) {
        finish(new Error(`browser exited ${code === null ? signal : code}; stderr: ${stderr.slice(-1200)}`));
        return;
      }
      finish(null, stdout);
    });
  });
}
// AGX-1 A-3 NON-VACUITY FIXTURE. A limb that says "the hole is visible" is
// worth nothing until it has been shown to say the opposite. This deliberately
// re-creates the pre-fix condition -- the read panel stretched back over the
// whole canvas -- by injecting CSS from the test, and requires the limb to go
// FALSE. No test-only code ships in the game. If this fixture ever passes, the
// limb has gone blind and G5 fails on that alone.
let occlusionFixtureFailed = false;
async function runOcclusionFixture() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { return false; }
  // D5: the limb now asserts at EVERY breakpoint, so it must be proven able to
  // fail at every breakpoint. A fixture that only bites on a phone would leave
  // the tablet and desktop limbs unproven — exactly the vacuity this gate
  // exists to prevent.
  const VPS = [{ n: 'phone', w: 360, h: 740 }, { n: 'tablet', w: 768, h: 900 }, { n: 'desktop', w: 1280, h: 800 }];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    let allRejected = true;
    for (const vp of VPS) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      // Registered on the CONTEXT, not the page, and injected on
      // DOMContentLoaded rather than at document-start: both were real bugs in
      // earlier versions of this fixture, one of which made it inject nothing
      // and "prove" non-vacuity while testing nothing at all.
      await context.addInitScript(() => {
        const inject = () => {
          const s = document.createElement('style');
          s.id = 'ag-occlusion-fixture';
          s.textContent = '.screen--read{position:absolute!important;inset:0!important;max-height:none!important;margin-top:0!important;margin-left:0!important;width:auto!important}';
          document.head.appendChild(s);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject, { once: true });
        else inject();
      });
      const page = await context.newPage();
      await page.goto(`file://${GAME_FILE}?contract=1`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__AG_CONTRACT && Array.isArray(window.__AG_CONTRACT.rows), null, { timeout: 30000 });
      const data = await page.evaluate(() => window.__AG_CONTRACT);
      const r = (data.rows || []).find(x => x.name === 'read-view-hole-unoccluded');
      const rejected = !!r && r.pass === false;

      // SELF-CHECK: prove the fixture actually occluded something at THIS
      // viewport. A fixture that silently fails to bite is worse than none,
      // because it manufactures confidence.
      const page2 = await context.newPage();
      await page2.goto(`file://${GAME_FILE}`, { waitUntil: 'load', timeout: 30000 });
      await page2.waitForTimeout(2500);
      await page2.locator('text=/Read hole/').first().click({ timeout: 10000 });
      await page2.waitForTimeout(800);
      const bite = await page2.evaluate(() => {
        const el = document.querySelector('.screen--read');
        const cv = document.getElementById('courseCanvas');
        if (!el || !cv) return { applied: false };
        const cs = getComputedStyle(el), pr = el.getBoundingClientRect(), cr = cv.getBoundingClientRect();
        // The discriminator is whether the override took AND the panel spans
        // the whole canvas. "Covers the centre" is not a discriminator: a
        // correctly docked panel covers the centre too.
        return {
          applied: cs.position === 'absolute' && !!document.getElementById('ag-occlusion-fixture'),
          position: cs.position,
          coversWholeCanvas: pr.top <= cr.top + 2 && pr.bottom >= cr.bottom - 2 && pr.left <= cr.left + 2 && pr.right >= cr.right - 2,
          panel: [Math.round(pr.width), Math.round(pr.height)],
          canvas: [Math.round(cr.width), Math.round(cr.height)],
        };
      });
      await page2.close();
      await context.close();

      console.log(`      fixture ${vp.n} ${vp.w}x${vp.h}: limb pass=${r ? r.pass : 'MISSING'} (${r ? r.detail : ''})`);
      console.log(`        self-check: applied=${bite.applied} position=${bite.position} panel ${bite.panel} covers canvas ${bite.canvas} = ${bite.coversWholeCanvas}`);
      if (!bite.applied || !bite.coversWholeCanvas) {
        console.error(`      FIXTURE DID NOT BITE at ${vp.n} — it occluded nothing, so it proves nothing.`);
        allRejected = false;
      } else if (!rejected) {
        console.error(`      LIMB DID NOT FAIL at ${vp.n} under deliberate occlusion — it is blind there.`);
        allRejected = false;
      }
    }
    return allRejected;
  } catch (e) {
    console.error(`      fixture error: ${e.message}`);
    return false;
  } finally { if (browser) await browser.close(); }
}
async function browserContracts() {
  if (browserRuns) return browserRuns;
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (error) { fail(`Playwright is required for rendered gates: ${error.message}`); }
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { pathname = '/'; }
    let file = path.normalize(path.join(ROOT, pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/apexgolf/index.html`;
  const configs = [
    { name: 'phone', w: 360, h: 740, reducedMotion: 'no-preference' },
    { name: 'tablet', w: 768, h: 900, reducedMotion: 'no-preference' },
    { name: 'desktop', w: 1280, h: 800, reducedMotion: 'no-preference' },
    { name: 'phone-reduced', w: 360, h: 740, reducedMotion: 'reduce' }
  ];
  const runs = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const c of configs) {
      const context = await browser.newContext({
        viewport: { width: c.w, height: c.h },
        reducedMotion: c.reducedMotion
      });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        const response = await page.goto(`${base}?contract=1&viewport=${c.name}`, { waitUntil: 'load', timeout: 30000 });
        assert(response && response.status() === 200, `${c.name}: local page returned ${response ? response.status() : 'no response'}`);
        await page.waitForFunction(
          () => window.__AG_CONTRACT && Array.isArray(window.__AG_CONTRACT.rows),
          null,
          { timeout: 30000 }
        );
        assert(pageErrors.length === 0, `${c.name}: page errors: ${pageErrors.join(' | ')}`);
        const data = await page.evaluate(() => window.__AG_CONTRACT);
        const dom = await page.content();
        runs.push({ config: c, data, dom });
      } finally {
        await context.close();
      }
    }
    const noJsContext = await browser.newContext({
      viewport: { width: 360, height: 740 },
      javaScriptEnabled: false,
      reducedMotion: 'reduce'
    });
    let noJsDom;
    try {
      const page = await noJsContext.newPage();
      const response = await page.goto(`${base}?nojs=1`, { waitUntil: 'load', timeout: 30000 });
      assert(response && response.status() === 200, `no-JS page returned ${response ? response.status() : 'no response'}`);
      noJsDom = await page.content();
    } finally {
      await noJsContext.close();
    }
    const noJs = {
      baseline: /id="noScript"/.test(noJsDom) && /This top-down golf game needs JavaScript/.test(noJsDom),
      killSwitch: /#mbmSplash,#app\{display:none!important\}/.test(noJsDom),
      noContract: !/<pre id="ag-contract-results">\s*\{/.test(noJsDom)
    };
    browserRuns = { browser: 'Playwright Chromium', runs, noJs };
    return browserRuns;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
function row(run, name) { return run.data.rows.find(r => r.name === name); }
function requireRows(names, predicate = () => true) {
  assert(browserRuns, 'browser contracts not prepared');
  for (const run of browserRuns.runs) {
    if (!predicate(run)) continue;
    assert(run.data.ok, `${run.config.name}: overall browser contract failed: ${JSON.stringify(run.data.rows.filter(r => !r.pass))}`);
    for (const name of names) {
      const r = row(run, name);
      assert(r && r.pass, `${run.config.name}: ${name} failed or missing: ${JSON.stringify(r)}`);
    }
  }
}
function upsertShelf(manifest, entry) {
  const copy = JSON.parse(JSON.stringify(manifest));
  if (!Array.isArray(copy.games)) copy.games = [];
  const matches = copy.games.filter(g => g && (g.href === entry.href || g.title === entry.title));
  if (matches.length) {
    const first = copy.games.findIndex(g => g && (g.href === entry.href || g.title === entry.title));
    copy.games = copy.games.filter((g, i) => i === first || !(g && (g.href === entry.href || g.title === entry.title)));
    copy.games[first] = Object.assign({}, copy.games[first], entry);
  } else copy.games.push(Object.assign({}, entry));
  return copy;
}

// G1 — sentinel

gate('G1', 'sentinel at both ends', () => {
  const lines = html.trimEnd().split('\n');
  const occurrences = (html.match(new RegExp(SENTINEL, 'g')) || []).length;
  assert(lines[0].includes(SENTINEL), `first line lacks ${SENTINEL}`);
  assert(lines[lines.length - 1].includes(SENTINEL), `last line lacks ${SENTINEL}`);
  assert(occurrences === 2, `sentinel occurs ${occurrences} times, expected 2`);
  return `${occurrences} occurrences; ${byteCount} bytes`;
});

// G2 — fixed timestep

gate('G2', 'fixed timestep and refresh-rate invariance', () => {
  assert(AG.DT === 1 / 240, `DT is ${AG.DT}`);
  assert(AG.MAX_SUBSTEPS === 32, `MAX_SUBSTEPS is ${AG.MAX_SUBSTEPS}`);
  const hole = neutralHole(9001, 5);
  const input = { angle: 0.21, power: 0.83, club: 3 };
  const rates = [30, 60, 120, 144];
  // 2 s is chosen so seconds*hz is a whole number of frames at every rate:
  // each rate therefore accumulates the SAME simulated span, and a correct
  // fixed-step integrator must land on the same state. A duration that does
  // not divide evenly (0.25 s at 30 Hz -> 7.5 frames) makes the rates simulate
  // different spans and the resulting delta measures frame-count rounding,
  // not physics.
  const SECONDS = 2;
  const states = rates.map(hz => AG.drive(hole, SECONDS, hz, input));
  let eps = 0;
  for (let i = 1; i < states.length; i++) eps = Math.max(eps, AG.maxDelta(states[0], states[i]));
  assert(eps <= 1e-10, `refresh-rate delta ${eps}`);

  // AGX-1 finding A-2 — THE POSITIVE CONTROL, and the point of this gate.
  // eps == 0 above is necessary but proves nothing on its own: a rig that
  // ignores renderHz returns 0 for any integrator, correct or broken, which is
  // exactly how this limb passed vacuously before. So drive the SAME shot with
  // the defect this gate exists to catch — physics advanced once per frame at
  // dt = 1/hz (the B6 shape) — and require the measurement to SEE it. If this
  // control ever collapses toward 0 the rig has gone blind again and the gate
  // fails, whatever the shipped game is doing.
  const control = rates.map(hz => {
    const b = AG.makeBall(hole);
    AG.launch(b, hole, input.angle, input.power, input.club);
    const frames = Math.round(SECONDS * hz), dt = 1 / hz;
    for (let f = 0; f < frames && b.moving; f++) AG.stepBall(b, hole, dt);
    return AG.ballStateVector(b);
  });
  let epsControl = 0;
  for (let i = 1; i < control.length; i++) epsControl = Math.max(epsControl, AG.maxDelta(control[0], control[i]));
  assert(epsControl > 0.1, `positive control did not detect per-frame stepping (ε_control ${epsControl}) — the rig is blind, so ε=0 above is not evidence`);

  const suspect = html.match(/ball\.(?:x|y|z)\s*\+=\s*ball\.v(?:x|y|z)(?!\s*\*\s*dt)/g) || [];
  assert(suspect.length === 0, `bare position integration found: ${suspect.join(', ')}`);
  assert(/state\.accumulator\s*\+=\s*frame/.test(html) && /while\(state\.accumulator>=AG\.DT/.test(html), 'render loop lacks fixed-step accumulator');
  assert(/frames\s*=\s*Math\.round\(seconds\*renderHz\)/.test(html), 'drive() does not derive its schedule from renderHz');
  return `30/60/120/144 Hz over ${SECONDS}s; ε=${eps}; positive control ε=${epsControl.toFixed(3)} (rig proven sighted)`;
});

// G3 — determinism

gate('G3', 'seed and input determinism', () => {
  const seed = 0xdecafbad;
  const expected = AG.serialiseCourse(seed);
  for (let i = 0; i < 100; i++) assert(AG.serialiseCourse(seed) === expected, `geometry drift on run ${i + 1}`);
  const h = neutralHole(seed, 2);
  const input = { angle: -0.37, power: 0.72, club: 2 };
  const a = JSON.stringify(AG.drive(h, 18, 60, input));
  for (let i = 0; i < 20; i++) assert(JSON.stringify(AG.drive(h, 18, 60, input)) === a, `input replay drift on run ${i + 1}`);
  return `100 byte-identical course generations; ${expected.length} serialised characters`;
});

// G4 — continuous cup and wall tests

gate('G4', 'swept cup and boundary collision', () => {
  const hole = testHole();
  let slow = AG.makeBall(hole);
  slow.x = 75; slow.y = 35; slow.z = 0; slow.vx = 2.7; slow.vy = slow.vz = 0; slow.moving = true; slow.club = 0;
  AG.simulateShot(hole, slow, 8);
  assert(slow.sunk, 'slow dead-centre roll did not sink');
  let fast = AG.makeBall(hole);
  fast.x = 68; fast.y = 35; fast.z = 0; fast.vx = 18; fast.vy = fast.vz = 0; fast.moving = true; fast.club = 0;
  AG.simulateShot(hole, fast, 8);
  assert(fast.sunk || fast.cupRejected, 'fast dead-centre roll passed through the cup silently');
  const toi = AG.segmentCircleTOI({x:0,y:0},{x:100,y:0},{x:50,y:0},2);
  close(toi, 0.48, 1e-12, 'cup TOI');
  const wall = AG.segmentAABBTOI({x:-10,y:5},{x:20,y:5},{minX:0,minY:0,maxX:10,maxY:10});
  close(wall, 1/3, 1e-12, 'boundary TOI');
  return `slow=sunk; fast=${fast.sunk ? 'sunk' : 'explicitly rejected'}; cup TOI ${toi}`;
});

// Browser contracts are prepared once before browser-dependent gates.
if (!SKIP_BROWSER) {
  // Gate runner is synchronous, so prepare the browser block before continuing.
  // The promise is resolved through an async IIFE at the bottom; placeholders are added there.
}

// G6 — storage isolation

gate('G6', 'storage key isolation', () => {
  const keys = [...html.matchAll(/(?:settings|progress):'([^']+)'/g)].map(m => m[1]);
  assert(keys.length === 2, `expected two storage keys, found ${keys.length}`);
  assert(keys.every(k => k.startsWith('mbm_apexgolf_')), `non-namespaced key: ${keys.join(', ')}`);
  const direct = [...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert(direct.every(k => k.startsWith('mbm_apexgolf_')), `direct non-Golf key literal: ${direct.join(', ')}`);
  assert(!/apex_tokens|apex_unlocked|apex_active|apex_coins/.test(html), 'legacy unnamespaced storage key present');
  return keys.join(', ');
});

// G7 — shared links

gate('G7', 'versioned links fail safely and do not save', () => {
  const good = AG.parseHash('#g=1:4294967295');
  assert(good.seed === 4294967295 && !good.warning, 'valid hash did not round-trip');
  assert(AG.formatHash(good.seed) === '#g=1:4294967295', 'hash formatter drift');
  const unknown = AG.parseHash('#g=2:42');
  assert(unknown.seed === AG.DEFAULT_SEED && /version 2/.test(unknown.warning), 'unknown version did not degrade readably');
  const broken = AG.parseHash('#bad');
  assert(broken.seed === AG.DEFAULT_SEED && broken.warning.length > 20, 'malformed hash did not degrade readably');
  const hashLoader = html.slice(html.indexOf('function loadHashForTest'), html.indexOf('function forceRestForTest'));
  assert(!/Store\.write|localStorage\.setItem/.test(hashLoader), 'hash-loading path writes persistent data');
  return `${AG.formatHash(42)}; unknown versions fall back to seed ${AG.DEFAULT_SEED}`;
});

// G8 — Call Rating

gate('G8', 'Call Rating fixtures, bands, symmetry and fuzz', () => {
  const fixtures = [
    [3,3,3,100],[4,4,3,90],[6,6,3,85],[7,7,3,60],
    [3,4,3,70],[3,2,3,70],[3,5,3,40],[3,7,3,10]
  ];
  for (const [called, actual, par, expected] of fixtures) assert(AG.callRating(called, actual, par) === expected, `fixture ${called},${actual},${par}`);
  for (let par = 3; par <= 5; par++) {
    for (let called = 1; called <= 20; called++) {
      let last = Infinity;
      for (let d = 0; d <= 29; d++) {
        const up = called + d <= 30 ? AG.callRating(called, called + d, par) : null;
        const down = called - d >= 1 ? AG.callRating(called, called - d, par) : null;
        if (up !== null && down !== null) assert(up === down, `asymmetry call ${called}, error ${d}, par ${par}`);
        const v = up !== null ? up : down;
        if (v !== null) { assert(v <= last, `non-monotone call ${called}, error ${d}, par ${par}`); last = v; }
      }
      const exact = AG.callRating(called, called, par);
      const near = called < 30 ? AG.callRating(called, called + 1, par) : AG.callRating(called, called - 1, par);
      const missActual = called + 2 <= 30 ? called + 2 : called - 2;
      const miss = AG.callRating(called, missActual, par);
      assert(exact > near && near >= miss, `bands overlap for call ${called}, par ${par}`);
      if (called > par + 3) assert(exact <= 60, `safe-call ceiling exceeded for ${called} on par ${par}`);
    }
  }
  const rng = AG.mulberry32(0x51a7c0de);
  for (let i = 0; i < 20000; i++) {
    const called = 1 + Math.floor(rng() * 20), actual = 1 + Math.floor(rng() * 30), par = 3 + Math.floor(rng() * 3);
    const r = AG.callRating(called, actual, par);
    assert(Number.isInteger(r) && Number.isFinite(r) && r >= 0 && r <= 100, `fuzz ${i}: ${r}`);
  }
  const exactAnnouncement = 'Call Rating 70 out of 100. You called 3 strokes and took 4.';
  assert(AG.ratingAnnouncement(3,4,3) === exactAnnouncement, 'aria-live rating string drift');
  assert(/id="live"[^>]*aria-live="polite"/.test(html), 'polite aria-live region missing');
  assert(AG.roundCallRating([{called:3,actual:3,par:3},{called:3,actual:4,par:3}]) === 85, 'round mean is wrong');
  return '8 exact fixtures; 20,000 fuzz cases; monotonicity and symmetry sweeps';
});

// G9 — every force rendered before the call

gate('G9', 'no hidden forces', () => {
  assert(Array.isArray(AG.PHYSICS_FORCES) && AG.PHYSICS_FORCES.length >= 9, 'force registry incomplete');
  for (const f of AG.PHYSICS_FORCES) assert(AG.FORCE_RENDERERS[f], `force ${f} has no renderer`);
  const coreStart = html.indexOf('AG:CORE:BEGIN'), coreEnd = html.indexOf('AG:CORE:END');
  const coreText = html.slice(coreStart, coreEnd);
  assert(!/Math\.random\s*\(/.test(coreText), 'unseeded randomness exists in the physics/course core');
  return `${AG.PHYSICS_FORCES.length} forces mapped to ${Object.keys(AG.FORCE_RENDERERS).length} read-view renderers`;
});

// G10 — 10,000-shot soft-lock and finite-state sweep

gate('G10', '10,000 shots settle without NaN or soft-lock', () => {
  const rng = AG.mulberry32(0x0badf00d);
  let maxSteps = 0, energyChecks = 0, explicitGains = 0;
  for (let i = 0; i < 10000; i++) {
    const h = neutralHole((0xabc000 + i) >>> 0, i % 9);
    const b = AG.makeBall(h);
    const angle = rng() * Math.PI * 2, power = 0.08 + rng() * 0.92, club = Math.floor(rng() * 4);
    AG.launch(b, h, angle, power, club);
    let previous = AG.mechanicalEnergy(b), steps = 0;
    while (b.moving && steps < Math.ceil(AG.MAX_SHOT_SECONDS / AG.DT) + 2) {
      AG.stepBall(b, h, AG.DT);
      const vals = [b.x,b.y,b.z,b.vx,b.vy,b.vz];
      assert(vals.every(Number.isFinite), `shot ${i} step ${steps}: non-finite ${vals}`);
      const energy = AG.mechanicalEnergy(b);
      if (energy > previous + 0.08) {
        assert(!!b.lastRestitution, `shot ${i} step ${steps}: unexplained energy gain ${energy - previous}`);
        explicitGains++;
      }
      previous = energy; energyChecks++; steps++;
    }
    assert(!b.moving, `shot ${i} did not reach rest within ${AG.MAX_SHOT_SECONDS}s`);
    assert(!b.timedOut, `shot ${i} hit the emergency timeout rather than settling`);
    maxSteps = Math.max(maxSteps, steps);
  }
  return `10,000/10,000 settled; max ${(maxSteps * AG.DT).toFixed(3)}s; ${energyChecks} energy steps; ${explicitGains} explicit restitution gains`;
});

// G14 — one title renderer

gate('G14', 'one title renderer for normal and no-canvas paths', () => {
  const renderDefs = (html.match(/function renderTitleMarkup\s*\(/g) || []).length;
  assert(renderDefs === 1, `renderTitleMarkup defined ${renderDefs} times`);
  const fallback = html.slice(html.indexOf('function noCanvasFallback'), html.indexOf('function showWarning'));
  const normal = html.slice(html.indexOf('function showTitle'), html.indexOf('function noCanvasFallback'));
  assert(/renderTitleMarkup\('fallback'\)/.test(fallback), 'no-canvas path does not call the shared renderer');
  assert(/renderTitleMarkup\('title'\)/.test(normal), 'normal title path does not call the shared renderer');
  assert((html.match(/TITLE_SOURCE\s*=\s*\{\s*value:\s*'Apex Golf'/g) || []).length === 1, 'title source is duplicated or absent');
  return 'one renderer, one mutable title source, two explicit modes';
});

// G15 — scoped variants

gate('G15', 'screen styles are explicitly scoped', () => {
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [,''])[1];
  const variants = ['title','read','result','scorecard','error'];
  for (const v of variants) assert(style.includes(`.screen--${v}`), `missing .screen--${v} variant`);
  assert(!/(^|[},])\s*(?:h1|h2)\s*\{/.test(style), 'unscoped heading rule found');
  assert(/\.screen\{[^}]*border-radius:20px/.test(style), 'shared screen base missing');
  return `${variants.length} explicit variants share one base rule`;
});

// G16 — non-vacuity

gate('G16', 'harness fails on a tampered copy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apexgolf-tamper-'));
  const copy = path.join(dir, 'index.html');
  fs.writeFileSync(copy, html.replace(`<!-- ${SENTINEL} -->`, '<!-- deliberately-tampered -->'));
  const r = spawnSync(process.execPath, [__filename, '--no-browser'], {
    env: { ...process.env, AG_GAME_FILE: copy, AG_TAMPER_CHILD: '1', AG_REQUIRE_BROWSER: '0', AG_BROWSER: '' },
    encoding: 'utf8', timeout: 10000
  });
  assert(r.status !== 0, 'tampered copy returned success');
  assert(/FAIL G1 tamper child/.test((r.stdout || '') + (r.stderr || '')), 'tamper failure did not identify G1');
  fs.rmSync(dir, { recursive: true, force: true });
  return `tampered child exited ${r.status}: ${(r.stdout || '').trim()}`;
});

// G18 — shelf idempotency

gate('G18', 'shelf upsert is idempotent and carries art', () => {
  const entry = { icon:'⛳', title:'Apex Golf', desc:'x', href:'/apexgolf/', tag:'Physics', hue:'#7C5CFC', featured:false, hero:false, art:'/assets/cards/apex-golf.svg' };
  const once = upsertShelf({ title:'Games Arcade', games:[{title:'Other',href:'/other/',art:'/x.svg'}] }, entry);
  const twice = upsertShelf(once, entry);
  const matches = twice.games.filter(g => g.href === '/apexgolf/' || g.title === 'Apex Golf');
  assert(matches.length === 1, `shelf contains ${matches.length} Apex Golf entries`);
  assert(matches[0].art === '/assets/cards/apex-golf.svg', 'art field missing or changed');
  assert(JSON.stringify(once) === JSON.stringify(twice), 'second shelf run changed the manifest');
  return '1 entry after two runs; art retained';
});

async function finish() {
  if (!SKIP_BROWSER) {
    try { await browserContracts(); occlusionFixtureFailed = await runOcclusionFixture(); }
    catch (error) {
      console.error(`BROWSER PREPARATION FAILED — ${error.stack || error}`);
      browserRuns = { error };
    }

    gate('G5', 'whole-hole read view before every stroke, and the hole is visible', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      requireRows(['read-view-real-geometry','read-before-subsequent-stroke','real-canvas-pixels']);
      // AGX-1 A-3 GATE CHANGE: G5 gained a limb. It previously asserted only
      // that the hole had been PAINTED with real geometry; it never asked
      // whether the pupil could SEE it. Measured before the fix: 0 of 10 hole
      // points visible at 360, 390 and 400 px -- not the tee, not the cup.
      // Asserted at <=400px, which is the width the ruling scoped; the
      // measurement is reported at every width in the row's detail.
      requireRows(['read-view-hole-unoccluded']);   // D5: every breakpoint, not just <=400px
      const narrow = browserRuns.runs
        .map(r => `${r.config.name}:${(row(r, 'read-view-hole-unoccluded') || {}).detail}`);
      assert(browserRuns.runs.length >= 3, 'too few viewports for a per-breakpoint claim');
      assert(occlusionFixtureFailed, 'the unoccluded limb was not proven able to fail');
      return `${browserRuns.runs.length} rendered runs; ${narrow.join(' | ')}; occluding fixture rejected`;
    }, { browser: true });

    gate('G11', 'terrain is colour-independent', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      requireRows(['greyscale-terrain-patterns','real-canvas-pixels']);
      return 'five distinct greyscale pattern signatures plus canvas labels';
    }, { browser: true });

    gate('G12', 'accessibility floor', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      requireRows(['minimum-target-size']);
      requireRows(['reduced-motion-contract'], run => run.config.name === 'phone-reduced');
      assert(browserRuns.noJs.baseline, 'JavaScript-disabled baseline is missing');
      assert(browserRuns.noJs.killSwitch, 'noscript splash kill switch is missing');
      assert(browserRuns.noJs.noContract, 'scripts ran despite JavaScript-disabled browser mode');
      assert(/:focus-visible/.test(html), 'focus-visible rule missing');
      const normalCss = html.slice(0, html.indexOf('@media (prefers-reduced-motion:reduce)'));
      assert(!/steps\s*\(|flash/i.test(normalCss), 'flashing/stepped animation found');
      return '≥44px controls, reduced motion, focus ring, <noscript>, no-canvas guard, no >3Hz animation';
    }, { browser: true });

    gate('G13', 'mobile pointer mapping at three widths', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      requireRows(['scaled-pointer-mapping'], run => ['phone','tablet','desktop'].includes(run.config.name));
      assert(/canvasWidth\/rect\.width/.test(html) && /canvasHeight\/rect\.height/.test(html), 'required scale factors missing');
      return '360, 768 and 1280 CSS-pixel widths hit the ball centre';
    }, { browser: true });

    gate('G17', 'single-file size, cold load and frame rate', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      assert(byteCount <= 250 * 1024, `${byteCount} bytes exceeds 250 KiB`);
      /* V6 restores the exact zero-runtime-dependency promise. The exit control
         is inline, so every script `src` is again forbidden. Two planted
         controls prove the census rejects both remote and same-origin loads. */
      const scriptTags = t => t.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*["'][^>]*>/gi) || [];
      assert(scriptTags(html).length === 0,
        `runtime dependency found: ${scriptTags(html).join(', ')}`);
      assert(!/<link\s+[^>]*rel=["']stylesheet/.test(html), 'external stylesheet found');
      /* G16 tampers the sentinel and proves nothing about this dependency limb,
         so both dependency families are armed independently here. */
      const controls = [
        ['off-origin CDN', html.replace('</head>', '<script src="https://cdn.example.invalid/a.js"></script></head>')],
        ['a second same-origin script', html.replace('</head>', '<script src="/analytics.js"></script></head>')],
      ];
      for (const [label, mutated] of controls) {
        assert(mutated !== html, `CONTROL "${label}" changed nothing — it proves nothing`);
        assert(scriptTags(mutated).length > 0, `CONTROL: ${label} was NOT rejected`);
      }
      assert(!/\b(?:fetch|XMLHttpRequest)\s*\(/.test(html), 'runtime network request found');
      requireRows(['performance-floor','real-canvas-pixels']);
      const perf = browserRuns.runs.map(r => `${r.config.name}:${r.data.fps.fps.toFixed(1)}fps/${r.data.loadMs.toFixed(1)}ms`).join(', ');
      return `${byteCount} bytes; ${perf}`;
    }, { browser: true });
  } else {
    gate('G5', 'whole-hole read view before every stroke', () => '', { browser: true });
    gate('G11', 'terrain is colour-independent', () => '', { browser: true });
    gate('G12', 'accessibility floor', () => '', { browser: true });
    gate('G13', 'mobile pointer mapping at three widths', () => '', { browser: true });
    gate('G17', 'single-file size, cold load and frame rate', () => '', { browser: true });
  }

  // Keep the closing order numeric even though browser gates run after the shared contract block.
  results.sort((a,b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const pass = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`\nAPEX GOLF GATE SUMMARY: ${pass} passed, ${failCount} failed, ${skip} skipped, ${results.length} total`);
  if (failCount) process.exitCode = 1;
  else if (REQUIRE_BROWSER && skip) process.exitCode = 2;
  else if (!skip) console.log(`ALL ${pass} APEX GOLF GATES PASSED`);
}
finish().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
