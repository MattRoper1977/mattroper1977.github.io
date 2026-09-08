/* ---------------------------------------------------------------------------
   Neon Turf: Overdrive — playthrough + gate harness (2B-P1).

   Reads live state through window.__turf.snapshot() and drives the game
   through its own UI and its own opt-in test hook. Both estate instrument
   lessons are built in (BL4a):

     1. Presence checks POLL across the boot window, and the splash
        interaction happens IN THE PAGE, fired the instant the splash is
        genuinely up — a cross-process round trip costs ~250ms and this
        splash closes itself at 2100ms.
     2. --self-test is a negative-control suite that exits non-zero unless
        every gate is shown able to bite. A green that was never proven able
        to go red carries no information.

   Usage:
     node tools/harness_turf.mjs
     node tools/harness_turf.mjs --self-test
     node tools/harness_turf.mjs --blocked      network fully blocked (F1)
   --------------------------------------------------------------------------- */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');
const BLOCKED = args.includes('--blocked');
const TARGET = (() => { const i = args.indexOf('--file'); return i >= 0 ? args[i + 1] : 'index.html'; })();

const PROFILES = [
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'phone-portrait', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

let failures = 0;
const results = [];
function gate(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

function serve() {
  const s = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? `/${TARGET}` : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/${TARGET}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
console.log(`target ${TARGET}  base ${base}  blocked ${BLOCKED}\n`);

/* In-page witness: records the splash's visible window and everything that
   must hold while it is up, with no cross-process latency to miss it. */
const WITNESS = () => {
  window.__leak = { key: 0, pointer: 0 };
  window.addEventListener('keydown', () => { window.__leak.key++; }, false);
  window.addEventListener('pointerdown', () => { window.__leak.pointer++; }, false);
  window.__w = { firstSeen: null, samples: 0, storageWhileUp: 0, overflowWhileUp: 0, startsWhileUp: 0 };
  const tick = () => {
    const el = document.getElementById('splashScreen');
    if (el) {
      window.__w.samples++;
      const up = !el.classList.contains('hidden') && getComputedStyle(el).opacity !== '0' && el.getBoundingClientRect().width > 0;
      if (up) {
        if (window.__w.firstSeen === null) window.__w.firstSeen = performance.now();
        window.__w.storageWhileUp = Math.max(window.__w.storageWhileUp, Object.keys(localStorage).length);
        window.__w.overflowWhileUp = Math.max(window.__w.overflowWhileUp, document.documentElement.scrollWidth - window.innerWidth);
        window.__w.startsWhileUp = Math.max(window.__w.startsWhileUp,
          [...document.querySelectorAll('#splashScreen, #mainMenu')].filter(e => !e.classList.contains('hidden')).length);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function newPage(profile, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: !!profile.isMobile, hasTouch: !!profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    reducedMotion: opts.reducedMotion || 'no-preference'
  });
  const errors = [], warnings = [], off = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u); });
  await page.addInitScript(() => { window.__NEON_TURF_TEST__ = true; });
  await page.addInitScript(WITNESS);
  if (opts.blocked) {
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1') || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
  }
  return { ctx, page, errors, warnings, off };
}

const atMenu = page => page.waitForFunction(
  () => window.__turf && window.__turf.snapshot().splashClosed && !document.getElementById('mainMenu').classList.contains('hidden'),
  null, { timeout: 20000 });

async function startMode(page, action) {
  await page.click(`[data-action="${action}"]`);
  await page.waitForTimeout(400);
  /* Quick / Local / Training go through a setup screen with a launch button. */
  const hasLaunch = await page.evaluate(() => {
    const el = document.getElementById('setupScreen');
    return !!el && !el.classList.contains('hidden');
  });
  if (hasLaunch) { await page.click('#launchMatch'); }
  await page.waitForFunction(() => { const s = window.__turf.snapshot(); return s.active && s.mode; }, null, { timeout: 20000 });
  return page.evaluate(() => window.__turf.snapshot());
}

/* A match opens on a 3.35s countdown, and scoreGoal() early-returns unless
   active() — 'playing' or 'overtime'. Anything that scores must wait for that
   or it is testing a no-op. */
async function waitPlaying(page) {
  await page.waitForFunction(() => ['playing', 'overtime'].includes(window.__turf.snapshot().state), null, { timeout: 20000 });
}

/* ------------------------------- the run --------------------------------- */
async function runProfile(profile, opts = {}) {
  const tag = `${profile.name}${opts.reducedMotion === 'reduce' ? ' RM-on' : ' RM-off'}${opts.blocked ? ' BLOCKED' : ''}`;
  const { ctx, page, errors, warnings, off } = await newPage(profile, opts);
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  /* --- splash, the Stage 1 §A list ------------------------------------ */
  await atMenu(page);
  const w = await page.evaluate(() => window.__w);
  gate(`[${tag}] splash visible on load (in-page witness)`, w.firstSeen !== null,
    w.firstSeen !== null ? `first seen at ${Math.round(w.firstSeen)}ms over ${w.samples} samples` : `never seen in ${w.samples} samples`);
  gate(`[${tag}] splash mutated no save`, w.storageWhileUp === 0, `${w.storageWhileUp} localStorage keys while up`);
  gate(`[${tag}] no horizontal overflow while the splash is up`, w.overflowWhileUp <= 0, `max ${w.overflowWhileUp}px`);
  gate(`[${tag}] exactly one start state while the splash is up`, w.startsWhileUp === 1, `${w.startsWhileUp} visible`);
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return { id: a && a.id, inMenu: !!(a && a.closest && a.closest('#mainMenu')) };
  });
  gate(`[${tag}] splash returns focus into the menu`, focus.inMenu, `activeElement #${focus.id}`);

  /* --- reduced motion ---------------------------------------------------- */
  const rm = await page.evaluate(() => window.__turf.snapshot().reducedMotion);
  if (opts.reducedMotion === 'reduce') {
    gate(`[${tag}] RM effective from the OS floor`, rm.effective === true && rm.osPreference === true, JSON.stringify(rm));
  } else {
    gate(`[${tag}] RM off when neither OS nor user asks`, rm.effective === false, JSON.stringify(rm));
  }

  /* --- every mode reachable --------------------------------------------- */
  const modes = [];
  for (const action of ['quick', 'local', 'training', 'cup']) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await atMenu(page);
    try {
      const s = await startMode(page, action);
      modes.push(`${action}=${s.mode}/${s.arena}`);
    } catch (e) { modes.push(`${action}=UNREACHABLE`); }
  }
  gate(`[${tag}] all four offline modes reachable`, modes.length === 4 && !modes.some(m => m.includes('UNREACHABLE')), modes.join(' · '));

  /* Online Lab: reach offer generation only (no second device exists here). */
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await atMenu(page);
  await page.click('[data-action="online"]');
  await page.waitForTimeout(500);
  const onlineReached = await page.evaluate(() => {
    const el = document.getElementById('onlineScreen');
    return !!el && !el.classList.contains('hidden') && !!document.getElementById('createOffer');
  });
  gate(`[${tag}] Online Lab opens to offer generation`, onlineReached, 'offer/answer UI present');

  /* --- goal, overtime, turf tiebreak, portal ---------------------------- */
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await atMenu(page);
  await startMode(page, 'quick');
  await waitPlaying(page);
  /* recordReplay() samples every 0.05s and the replay needs >8 buffered
     frames, so scoring the instant play begins tests a replay that could
     never have run. Give it a second of actual play first. */
  await page.waitForTimeout(1200);
  const beforeGoal = await page.evaluate(() => window.__turf.snapshot());
  await page.evaluate(() => window.__NeonTurfTest.goal('blue'));
  await page.waitForTimeout(600);
  const afterGoal = await page.evaluate(() => window.__turf.snapshot());
  gate(`[${tag}] goal detection scores and enters the goal beat`,
    afterGoal.score.blue === beforeGoal.score.blue + 1, `${JSON.stringify(beforeGoal.score)} -> ${JSON.stringify(afterGoal.score)}, state ${afterGoal.state}`);

  /* Replay is RM-gated: it must run with RM off and be skipped with RM on. */
  const sawReplay = await page.evaluate(async () => {
    const t0 = performance.now(); let seen = false;
    while (performance.now() - t0 < 2500) {
      if (window.__turf.snapshot().state === 'replay') { seen = true; break; }
      await new Promise(r => setTimeout(r, 50));
    }
    return seen;
  });
  if (opts.reducedMotion === 'reduce') {
    gate(`[${tag}] goal replay suppressed under reduced motion`, sawReplay === false, `state observed: ${sawReplay ? 'replay' : 'no replay'}`);
  } else {
    gate(`[${tag}] goal replay runs when motion is allowed`, sawReplay === true, `replay ${sawReplay ? 'seen' : 'not seen'}`);
  }

  /* Full-screen flash must be zero under RM (photosensitivity, R3). */
  const flashPeak = await page.evaluate(async () => {
    let peak = 0; const t0 = performance.now();
    while (performance.now() - t0 < 1200) { const s = window.__turf.snapshot(); if (s.effects) peak = Math.max(peak, s.effects.flash); await new Promise(r => setTimeout(r, 30)); }
    return peak;
  });
  if (opts.reducedMotion === 'reduce') {
    gate(`[${tag}] no full-screen goal flash under reduced motion`, flashPeak === 0, `peak flash ${flashPeak}`);
  }

  /* Overtime + turf tiebreak: level the score, drain the clock. */
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await atMenu(page);
  await startMode(page, 'quick');
  await waitPlaying(page);
  const tie = await page.evaluate(async () => {
    window.__NeonTurfTest.setScore(1, 1);
    window.__NeonTurfTest.setTime(0.05);
    const t0 = performance.now(); const seen = new Set();
    while (performance.now() - t0 < 6000) {
      seen.add(window.__turf.snapshot().state);
      await new Promise(r => setTimeout(r, 40));
    }
    const s = window.__turf.snapshot();
    return { states: [...seen], overtime: s.overtime, score: s.score };
  });
  gate(`[${tag}] level score at full time routes into overtime`, tie.overtime === true || tie.states.includes('tiebreak'),
    `states ${tie.states.join(',')} · overtime ${tie.overtime} · ${JSON.stringify(tie.score)}`);

  /* --- career persistence across reload ---------------------------------- */
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await atMenu(page);
  await startMode(page, 'quick');
  await page.evaluate(() => { window.__NeonTurfTest.setScore(3, 0); window.__NeonTurfTest.finish(); });
  await page.waitForTimeout(900);
  const savedCareer = await page.evaluate(() => window.__turf.snapshot().career);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await atMenu(page);
  const restored = await page.evaluate(() => window.__turf.snapshot().career);
  gate(`[${tag}] career stats persist across reload`,
    restored.matches === savedCareer.matches && restored.matches > 0,
    `matches ${savedCareer.matches} -> ${restored.matches}, wins ${savedCareer.wins} -> ${restored.wins}`);

  /* --- corrupted save fails safe ----------------------------------------- */
  const payloads = [['truncated', '{"matches":'], ['not-json', 'nonsense'], ['null', 'null'], ['array', '[1,2]'], ['hostile', '{"matches":-1e400,"wins":"x"}']];
  const safe = [];
  for (const [name, body] of payloads) {
    await page.evaluate(b => { localStorage.setItem('mbm_neonturf_stats_v1', b); }, body);
    let ok = true;
    try { await page.reload({ waitUntil: 'domcontentloaded' }); await atMenu(page); } catch (_) { ok = false; }
    safe.push(`${name}:${ok ? 'safe' : 'BOOT-LOOP'}`);
  }
  gate(`[${tag}] corrupted saves fail safe to a usable menu`, !safe.some(x => x.includes('BOOT-LOOP')), safe.join(' '));
  await page.evaluate(() => localStorage.clear());

  /* --- rendered touch targets (RENDERED box, never a CSS declaration) ---- */
  if (profile.isMobile) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await atMenu(page);
    await startMode(page, 'quick');
    await page.waitForTimeout(600);
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button,[role=button],select,input,a').forEach(el => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return;
        if (el.closest('.hidden')) return;
        if (r.width < 44 || r.height < 44) out.push({ id: el.id || null, cls: String(el.className).slice(0, 30), w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
      });
      return out;
    });
    gate(`[${tag}] rendered touch targets >= 44px in play`, small.length === 0,
      small.length ? `${small.length} under floor: ${JSON.stringify(small.slice(0, 6))}` : 'all visible controls clear 44px');
    const ovf = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, i: window.innerWidth }));
    gate(`[${tag}] 0px horizontal overflow in play`, ovf.s <= ovf.i, `${ovf.s} vs ${ovf.i}`);
  }

  /* --- F1 / F4 ------------------------------------------------------------ */
  const renderer = await page.evaluate(() => window.__turf.snapshot().renderer);
  gate(`[${tag}] renderer reports through one truth`, typeof renderer.shaderFloorOk === 'boolean',
    `shaderFloorOk=${renderer.shaderFloorOk} webglUnavailable=${renderer.webglUnavailable} lost=${renderer.contextLost} restored=${renderer.contextRestored}`);

  const offNonStun = off.filter(u => !u.startsWith('stun:'));
  gate(`[${tag}] zero off-origin HTTP requests`, offNonStun.length === 0, offNonStun.slice(0, 3).join(' | ') || 'none');
  gate(`[${tag}] console clean (0 errors)`, errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : `0 errors, ${warnings.length} warnings`);

  await ctx.close();
}

/* -------- F4: force context loss and prove the fallback carries it -------- */
async function contextLossCheck() {
  const { ctx, page } = await newPage(PROFILES[0], {});
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await atMenu(page);
  await startMode(page, 'quick');
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__turf.snapshot().renderer);
  const after = await page.evaluate(async () => {
    const cvs = document.getElementById('shaderCanvas');   /* the WebGL one; #gameCanvas is 2D */
    const gl = cvs.getContext('webgl') || cvs.getContext('experimental-webgl');
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return { skipped: true };
    ext.loseContext();
    await new Promise(r => setTimeout(r, 500));
    return { skipped: false, renderer: window.__turf.snapshot().renderer, state: window.__turf.snapshot().state, active: window.__turf.snapshot().active };
  });
  if (after.skipped) {
    gate('F4 context-loss handling', false, 'WEBGL_lose_context unavailable — NOT RUN rather than assumed green');
  } else {
    gate('F4 context loss clears the single renderer truth, game survives',
      after.renderer.contextLost >= 1 && after.renderer.shaderFloorOk === false && after.active === true,
      `lost=${after.renderer.contextLost} ok=${before.shaderFloorOk}->${after.renderer.shaderFloorOk} still active=${after.active}`);
  }
  await ctx.close();
}

/* ---- fixed timestep: same world, two very different frame budgets ------- */
async function fixedStepCheck() {
  const out = [];
  for (const fps of [30, 144]) {
    const { ctx, page } = await newPage(PROFILES[0], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await atMenu(page);
    await startMode(page, 'training');
    await page.evaluate(f => {
      let t = performance.now(); const step = 1000 / f; const cbs = [];
      window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
      window.performance.now = () => t;
      window.__tick = n => { for (let i = 0; i < n; i++) { t += step; cbs.splice(0, cbs.length).forEach(cb => cb(t)); } };
      window.__NeonTurfTest.setBall(0, 0, 420, 260);
    }, fps);
    /* Yield one real frame so the already-pending callback fires and
       re-registers into the stub. Without this the queue stays empty, nothing
       advances, and 0s == 0s passes while proving nothing. */
    await page.waitForTimeout(120);
    await page.evaluate(f => window.__tick(Math.round(f * 3)), fps);
    const s = await page.evaluate(() => window.__turf.snapshot());
    out.push({ fps, elapsed: s.elapsed, ball: s.ball });
    await ctx.close();
  }
  const [a, b] = out;
  const drift = Math.abs(a.elapsed - b.elapsed);
  const ballDrift = Math.hypot(a.ball.x - b.ball.x, a.ball.y - b.ball.y);
  /* NON-VACUITY: if neither run advanced, 0 == 0 is not agreement, it is a
     dead test. It must fail rather than report a green it did not earn. */
  const advanced = a.elapsed > 1 && b.elapsed > 1;
  gate('frame-rate independence: 30fps vs 144fps world outcome',
    advanced && drift <= 0.2 && ballDrift < 5,
    advanced
      ? `elapsed ${a.elapsed}s @30 vs ${b.elapsed}s @144 (drift ${drift.toFixed(3)}s), ball drift ${ballDrift.toFixed(2)}px`
      : `VACUOUS — the world did not advance in either run (${a.elapsed}s / ${b.elapsed}s); the test proves nothing`);
}

/* -------------------------- negative controls ---------------------------- */
async function selfTest() {
  console.log('\n--- negative controls: prove each gate CAN fail ---');
  let proven = 0, total = 0;

  total++;
  {
    const { ctx, page } = await newPage(PROFILES[0], {});
    /* Removing the element on DOMContentLoaded is too late — the splash has
       already painted by then, so the witness correctly saw it and the control
       proved nothing. Suppress it from the FIRST paint instead. */
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = '#splashScreen{display:none!important}';
      const put = () => (document.head || document.documentElement).appendChild(style);
      if (document.head || document.documentElement) put(); else new MutationObserver((_, o) => { if (document.head) { put(); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const w = await page.evaluate(() => window.__w);
    if (w.firstSeen === null) { proven++; console.log('PROVEN  splash gate goes red when the splash is removed'); }
    else console.log('NOT PROVEN  splash gate stayed green with no splash');
    await ctx.close();
  }

  total++;
  {
    const { ctx, page } = await newPage(PROFILES[1], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await atMenu(page);
    await page.evaluate(() => {
      const b = document.createElement('button'); b.id = 'injected-tiny';
      b.style.cssText = 'position:fixed;left:4px;top:4px;width:20px;height:20px;z-index:9999'; b.textContent = 'x';
      document.body.appendChild(b);
    });
    const small = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map(el => el.id));
    if (small.includes('injected-tiny')) { proven++; console.log('PROVEN  touch-target gate catches an injected 20x20 control'); }
    else console.log('NOT PROVEN  injected control not caught');
    await ctx.close();
  }

  total++;
  {
    const { ctx, page, errors } = await newPage(PROFILES[0], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { setTimeout(() => { throw new Error('injected control error'); }, 0); });
    await page.waitForTimeout(400);
    if (errors.length > 0) { proven++; console.log(`PROVEN  console gate catches an injected error (${errors.length})`); }
    else console.log('NOT PROVEN  injected error not seen');
    await ctx.close();
  }

  total++;
  {
    /* The save-key rename must be observable: the old keys must be gone. */
    const src = fs.readFileSync(path.join(ROOT, TARGET), 'utf8');
    const oldKeys = (src.match(/neonTurfOverdrive\.v1\./g) || []).length;
    const pristine = fs.existsSync(path.join(ROOT, 'pristine.html'))
      ? (fs.readFileSync(path.join(ROOT, 'pristine.html'), 'utf8').match(/neonTurfOverdrive\.v1\./g) || []).length : 0;
    if (pristine > 0 && oldKeys === 0) { proven++; console.log(`PROVEN  key census can tell the copies apart (pristine ${pristine} old keys, current ${oldKeys})`); }
    else console.log(`NOT PROVEN  key census inconclusive (pristine ${pristine}, current ${oldKeys})`);
  }

  console.log(`\nnegative controls: ${proven}/${total} proven able to fail`);
  if (proven !== total) { console.log('SELF-TEST FAILED — a gate could not be shown to fail.'); process.exit(1); }
  console.log('SELF-TEST PASSED — every control bit.');
  process.exit(0);
}

try {
  if (SELF_TEST) await selfTest();
  for (const profile of PROFILES) {
    for (const rmState of ['no-preference', 'reduce']) {
      console.log(`\n=== ${profile.name} · RM ${rmState}${BLOCKED ? ' · BLOCKED' : ''} ===`);
      await runProfile(profile, { reducedMotion: rmState, blocked: BLOCKED });
    }
  }
  if (!BLOCKED) {
    console.log('\n=== renderer + timestep ===');
    await contextLossCheck();
    await fixedStepCheck();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${results.filter(r => r.ok).length}/${results.length} gates green, ${failures} red`);
process.exit(failures === 0 ? 0 : 1);
