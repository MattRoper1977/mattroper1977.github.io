#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const http = require('http');
const { spawnSync } = require('child_process');

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
    '--hide-scrollbars', `--window-size=${width},${height}`,
    '--run-all-compositor-stages-before-draw', '--virtual-time-budget=14000',
    ...extra, '--dump-dom', url
  ];
  const r = spawnSync(browser, args, { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error) fail(`browser launch failed: ${r.error.message}`);
  if (r.status !== 0) fail(`browser exited ${r.status}; stderr: ${(r.stderr || '').slice(-1200)}`);
  return r.stdout || '';
}
async function browserContracts() {
  if (browserRuns) return browserRuns;
  const browser = findBrowser();
  assert(browser, 'AG_BROWSER does not point to a browser executable');
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
    { name: 'phone', w: 360, h: 740, extra: [] },
    { name: 'tablet', w: 768, h: 900, extra: [] },
    { name: 'desktop', w: 1280, h: 800, extra: [] },
    { name: 'phone-reduced', w: 360, h: 740, extra: ['--force-prefers-reduced-motion=reduce'] }
  ];
  const runs = [];
  try {
    for (const c of configs) {
      const dom = runChrome(browser, `${base}?contract=1&viewport=${c.name}`, c.w, c.h, c.extra);
      const match = dom.match(/<pre id="ag-contract-results">([\s\S]*?)<\/pre>/i);
      assert(match, `${c.name}: browser contract did not return results; DOM tail ${dom.slice(-800)}`);
      const data = JSON.parse(decodeHtmlText(match[1]));
      runs.push({ config: c, data, dom });
    }
    const noJsDom = runChrome(browser, `${base}?nojs=1`, 360, 740, ['--blink-settings=scriptEnabled=false']);
    const noJs = {
      baseline: /id="noScript"/.test(noJsDom) && /This top-down golf game needs JavaScript/.test(noJsDom),
      killSwitch: /#mbmSplash,#app\{display:none!important\}/.test(noJsDom),
      noContract: !/ag-contract-results/.test(noJsDom)
    };
    browserRuns = { browser, runs, noJs };
    return browserRuns;
  } finally {
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
  const states = rates.map(hz => AG.drive(hole, 20, hz, input));
  let eps = 0;
  for (let i = 1; i < states.length; i++) eps = Math.max(eps, AG.maxDelta(states[0], states[i]));
  assert(eps <= 1e-10, `refresh-rate delta ${eps}`);
  const suspect = html.match(/ball\.(?:x|y|z)\s*\+=\s*ball\.v(?:x|y|z)(?!\s*\*\s*dt)/g) || [];
  assert(suspect.length === 0, `bare position integration found: ${suspect.join(', ')}`);
  assert(/state\.accumulator\s*\+=\s*frame/.test(html) && /while\(state\.accumulator>=AG\.DT/.test(html), 'render loop lacks fixed-step accumulator');
  return `30/60/120/144 Hz; measured ε=${eps}`;
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
    try { await browserContracts(); }
    catch (error) {
      console.error(`BROWSER PREPARATION FAILED — ${error.stack || error}`);
      browserRuns = { error };
    }

    gate('G5', 'whole-hole read view before every stroke', () => {
      assert(!browserRuns.error, browserRuns.error && browserRuns.error.message);
      requireRows(['read-view-real-geometry','read-before-subsequent-stroke','real-canvas-pixels']);
      return `${browserRuns.runs.length} rendered viewport/motion runs`;
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
      assert(!/<script\s+[^>]*src=|<link\s+[^>]*rel=["']stylesheet/.test(html), 'runtime dependency found');
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
