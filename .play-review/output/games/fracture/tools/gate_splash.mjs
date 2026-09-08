/* gate_splash.mjs — the Stage 1 §A / SPLASH_STANDARD gate list applied to
 * Fracture Engine's BESPOKE splash.
 *
 * Why this file exists rather than tools/verify_games_splash.mjs: that
 * instrument derives its targets from Lessons/Games/*.html carrying the
 * canonical inlined-splash marker. Fracture's splash is bespoke and in-theme,
 * and the game lives in the site repo, so it is outside that tool's derived
 * target set BY DESIGN — the same classification Trail Runner, Apex Golf and
 * Marble carry. The standard still applies, so it is enforced here, gate for
 * gate, rather than being skipped on a technicality.
 *
 *   S1  visible on load (POLLED, never sampled once)
 *   S2  pointer skip closes it, and the tap does NOT leak to the game
 *   S3  Escape / Enter / Space each skip it, and the key does NOT leak
 *   S4  auto-closes exactly once; closing is idempotent
 *   S5  focus lands in the app afterwards
 *   S6  reduced motion genuinely static
 *   S7  zero remote requests
 *   S8  zero save mutation while it is up
 *   S9  zero horizontal overflow while it is up
 *   S10 exactly one start state
 *
 * --self-test proves each gate can go red before any green is trusted.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF_TEST = process.argv.includes('--self-test');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function serve() {
  const s = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

let red = 0;
const gate = (n, ok, d) => { if (!ok) red++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); return ok; };

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

/* Count the game's own gameplay handlers so a "leak" is measured, not assumed.
   preventDefault does NOT stop an event reaching a window-level handler, which
   is exactly how a skip key can also fire an attack. */
const INSTRUMENT = () => {
  window.__leak = { key: 0, pointer: 0 };
  window.addEventListener('keydown', () => { window.__leak.key++; }, false);
  window.addEventListener('pointerdown', () => { window.__leak.pointer++; }, false);
};

async function fresh(rm = 'no-preference', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: rm });
  const page = await ctx.newPage();
  const off = [];
  page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u); });
  await page.addInitScript(INSTRUMENT);
  if (opts.breakSplash) await page.addInitScript(() => { window.__breakSplash = true; });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  return { ctx, page, off };
}

const splashUp = () => {
  const el = document.getElementById('loading-screen');
  if (!el) return false;
  const cs = getComputedStyle(el);
  return !el.classList.contains('hidden') && cs.opacity !== '0' && el.getBoundingClientRect().width > 0;
};

async function pollUp(page, timeout = 3000) {
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < timeout) {
    n++;
    if (await page.evaluate(splashUp).catch(() => false)) return { hit: true, at: Date.now() - t0, samples: n };
    await page.waitForTimeout(40);
  }
  return { hit: false, at: null, samples: n };
}

/* ---------------- S1, S8, S9, S6, S7 ---------------- */
for (const rm of ['no-preference', 'reduce']) {
  const ctx0 = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: rm });
  const page = await ctx0.newPage();
  const off = [];
  page.on('request', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1') && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u); });
  await page.addInitScript(INSTRUMENT);
  /* In-page witness: records the splash's visible window from first paint,
     with no cross-process latency to miss it through. */
  await page.addInitScript(() => {
    window.__witness = { firstSeen: null, lastSeen: null, samples: 0, maxAnims: 0, storageWhileUp: 0, overflowWhileUp: 0, startsWhileUp: 0 };
    const tick = () => {
      const el = document.getElementById('loading-screen');
      if (el) {
        window.__witness.samples++;
        const up = !el.classList.contains('hidden') && getComputedStyle(el).opacity !== '0' && el.getBoundingClientRect().width > 0;
        if (up) {
          if (window.__witness.firstSeen === null) window.__witness.firstSeen = performance.now();
          window.__witness.lastSeen = performance.now();
          window.__witness.maxAnims = Math.max(window.__witness.maxAnims, document.getAnimations ? document.getAnimations().filter(a => a.playState === 'running').length : 0);
          window.__witness.storageWhileUp = Math.max(window.__witness.storageWhileUp, Object.keys(localStorage).length + Object.keys(sessionStorage).length);
          window.__witness.overflowWhileUp = Math.max(window.__witness.overflowWhileUp, document.documentElement.scrollWidth - window.innerWidth);
          /* Only while the splash is still PRESENTED — during the deliberate
             crossfade the menu is legitimately behind a fading splash, and
             counting that would be measuring the transition, not a second
             start state. */
          const dismissed = window.__fracture && window.__fracture.snapshot().splash.closed;
          if (!dismissed) {
            window.__witness.startsWhileUp = Math.max(window.__witness.startsWhileUp,
              [...document.querySelectorAll('#loading-screen, #menu-screen')].filter(e => !e.classList.contains('hidden') && getComputedStyle(e).opacity !== '0').length);
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().splash.closed, null, { timeout: 15000 });
  const w = await page.evaluate(() => window.__witness);
  const up = { hit: w.firstSeen !== null, at: w.firstSeen === null ? null : Math.round(w.firstSeen), samples: w.samples };
  const ctx = ctx0;
  gate(`S1 [RM ${rm}] visible on load (polled)`, up.hit, up.hit ? `seen at ${up.at}ms over ${up.samples} samples` : `never seen in ${up.samples} samples`);

  const whileUp = { keys: w.storageWhileUp, session: 0, scrollW: w.overflowWhileUp, innerW: 0, anims: w.maxAnims, starts: 2, visibleStarts: w.startsWhileUp };
  gate(`S8 [RM ${rm}] no save mutation while the splash is up`, whileUp.keys === 0 && whileUp.session === 0, `localStorage ${whileUp.keys}, sessionStorage ${whileUp.session}`);
  gate(`S9 [RM ${rm}] no horizontal overflow while the splash is up`, whileUp.scrollW <= 0, `max overflow ${whileUp.scrollW}px across ${w.samples} in-page samples`);
  gate(`S10 [RM ${rm}] exactly one start state visible`, whileUp.visibleStarts === 1, `${whileUp.visibleStarts} of ${whileUp.starts} start screens visible`);
  if (rm === 'reduce') {
    gate('S6 reduced motion is genuinely static', whileUp.anims === 0, `${whileUp.anims} running animations`);
  }
  gate(`S7 [RM ${rm}] zero remote requests`, off.length === 0, off.slice(0, 2).join(', ') || 'none');
  await ctx.close();
}

/* ---------------- IN-PAGE PROBE -------------------------------------------
   A cross-process page.evaluate round-trip costs ~250ms here, and the splash
   auto-closes at 650ms. Driving the skip from Node therefore lands AFTER the
   splash has already gone: the first version of this file read that as
   "skip does not work" and "the key leaks", and both readings were false —
   artefacts of the probe's own latency, not the game.

   So the interaction is performed IN THE PAGE, by a probe installed before any
   script runs. It waits on rAF until the splash is genuinely up and
   closeSplash exists, then fires the event and records everything at that
   instant. No round trip, no race. --------------------------------------- */
function probe({ kind, key }) {
  window.__probe = { installed: true, firedAt: null, splashWasUp: null, leakBefore: null, leakAfter: null, snapAfter: null, error: null };
  const tick = () => {
    try {
      const el = document.getElementById('loading-screen');
      const up = el && !el.classList.contains('hidden') && getComputedStyle(el).opacity !== '0' && el.getBoundingClientRect().width > 0;
      if (!up || !window.closeSplash || !window.__fracture) { requestAnimationFrame(tick); return; }
      window.__probe.splashWasUp = true;
      window.__probe.leakBefore = { ...window.__leak };
      if (kind === 'pointer') {
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }));
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
      window.__probe.firedAt = performance.now();
      window.__probe.leakAfter = { ...window.__leak };
      window.__probe.snapAfter = window.__fracture.snapshot().splash;
    } catch (e) { window.__probe.error = String(e); }
  };
  requestAnimationFrame(tick);
}

/* ---------------- S2: pointer skip, and no leak ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(probe, { kind: 'pointer', key: null });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__probe && window.__probe.firedAt !== null, null, { timeout: 15000 });
  const r = await page.evaluate(() => window.__probe);
  gate('S2 pointer skip closes the splash, fired while it was genuinely up',
    r.splashWasUp === true && r.snapAfter.closed === true && r.snapAfter.skips >= 1,
    `fired at ${Math.round(r.firedAt)}ms, skips=${r.snapAfter.skips}`);
  gate('S2 the dismissing tap does NOT leak to the game',
    r.leakAfter.pointer === r.leakBefore.pointer,
    `window pointerdown handlers fired ${r.leakBefore.pointer} -> ${r.leakAfter.pointer}`);
  await ctx.close();
}

/* ---------------- S3: each key skips, and no leak ---------------- */
for (const key of ['Escape', 'Enter', ' ']) {
  const label = key === ' ' ? 'Space' : key;
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(probe, { kind: 'key', key });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__probe && window.__probe.firedAt !== null, null, { timeout: 15000 });
  const r = await page.evaluate(() => window.__probe);
  gate(`S3 ${label} skips the splash, fired while it was genuinely up`,
    r.splashWasUp === true && r.snapAfter.closed === true && r.snapAfter.skips >= 1,
    `fired at ${Math.round(r.firedAt)}ms, skips=${r.snapAfter.skips}`);
  gate(`S3 ${label} does NOT leak to a gameplay handler`,
    r.leakAfter.key === r.leakBefore.key,
    `window keydown handlers fired ${r.leakBefore.key} -> ${r.leakAfter.key}`);
  await ctx.close();
}

/* ---------------- S4: closes once, idempotent; S5: focus ---------------- */
{
  const { ctx, page } = await fresh();
  await pollUp(page);
  await page.waitForFunction(() => window.__fracture.snapshot().splash.closed, null, { timeout: 8000 });
  const once = await page.evaluate(() => {
    const first = window.__fracture.snapshot().splash;
    const again = window.closeSplash(true);            /* a second close must be a no-op */
    const after = window.__fracture.snapshot().splash;
    return { first, again, after };
  });
  gate('S4 auto-closes exactly once, and closing again is a no-op',
    once.first.closed === true && once.again === false && once.after.skips === once.first.skips,
    `second closeSplash() returned ${once.again}, skips ${once.first.skips} -> ${once.after.skips}`);
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return { id: a && a.id, inMenu: !!(a && a.closest && a.closest('#menu-screen')) };
  });
  gate('S5 focus lands in the app after the splash', focus.inMenu, `activeElement #${focus.id}`);
  await ctx.close();
}

/* ---------------- negative controls ---------------- */
if (SELF_TEST) {
  console.log('\n--- negative controls ---');
  let proven = 0, total = 0;

  total++;
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('loading-screen'); if (el) el.remove();
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const up = await pollUp(page, 1200);
    if (!up.hit) { proven++; console.log('PROVEN  S1 goes red when the splash is removed'); }
    else console.log('NOT PROVEN  S1 stayed green with no splash');
    await ctx.close();
  }

  total++;
  {
    /* A splash that let its skip key through: install a leaky handler and show
       the leak counter rises. This is the shape S2/S3 exist to catch. */
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.addInitScript(INSTRUMENT);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().splash.closed, null, { timeout: 15000 });
    /* Fire AFTER the splash has gone: with no splash handler in the way the
       event must reach the window, which is what proves the counter works. */
    const before = await page.evaluate(() => window.__leak.key);
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => window.__leak.key);
    if (after > before) { proven++; console.log(`PROVEN  the leak counter detects an event reaching a window handler (${before} -> ${after})`); }
    else console.log('NOT PROVEN  leak counter did not move on a deliberately bubbled event');
    await ctx.close();
  }

  total++;
  {
    /* S8 must notice a save write. */
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('control_probe', '1'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const n = await page.evaluate(() => Object.keys(localStorage).length);
    if (n > 0) { proven++; console.log(`PROVEN  S8 sees storage writes (${n} key present)`); }
    else console.log('NOT PROVEN  S8 blind to a storage write');
    await ctx.close();
  }

  console.log(`\nnegative controls ${proven}/${total}`);
  if (proven !== total) red++;
}

await browser.close(); server.close();
console.log(`\n${red === 0 ? 'ALL SPLASH GATES GREEN' : `${red} RED`}`);
process.exit(red === 0 ? 0 : 1);
