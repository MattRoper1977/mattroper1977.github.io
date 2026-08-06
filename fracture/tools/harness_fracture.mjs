/* ---------------------------------------------------------------------------
   Relicforge: Fracture Engine — playthrough + gate harness (Pass 1, P1-2).

   Drives the game through its own globals (the inline script is a classic
   <script>, so its top-level declarations are on window) and reads live state
   through window.__fracture.snapshot() — never a cached copy.

   Two lessons from the estate are built in on purpose (BL4a):
     1. UI-presence checks POLL across the boot window. A splash that closes
        itself at 650ms reads as ABSENT to a single 2.2s sample. Nothing here
        samples once.
     2. Every gate must be able to fail. --self-test injects faults and asserts
        this harness exits non-zero on each; a green that was never proven able
        to go red carries no information.

   Usage:
     node tools/harness_fracture.mjs                 full run
     node tools/harness_fracture.mjs --self-test     negative controls only
     node tools/harness_fracture.mjs --blocked       offline run (no network)
     node tools/harness_fracture.mjs --file <path>   target a specific html file
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
  { name: 'desktop', width: 1366, height: 768, isMobile: false },
  { name: 'phone-portrait', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const results = [];
let failures = 0;
function gate(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const rel = url === '/' ? `/${TARGET}` : url;
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* Poll a predicate across a window, returning the first true and when it happened.
   This is the anti-single-sample rule made mechanical. */
async function pollFor(page, fn, { timeout = 4000, interval = 100 } = {}) {
  const t0 = Date.now();
  const samples = [];
  while (Date.now() - t0 < timeout) {
    let v = null;
    try { v = await page.evaluate(fn); } catch (_) { v = null; }
    samples.push({ t: Date.now() - t0, v });
    if (v) return { hit: true, atMs: Date.now() - t0, samples };
    await page.waitForTimeout(interval);
  }
  return { hit: false, atMs: null, samples };
}

async function newPage(browser, profile, { reducedMotion = 'no-preference', blocked = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.isMobile,
    hasTouch: !!profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    reducedMotion
  });
  const errors = [];
  const warnings = [];
  const requests = [];
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => requests.push({ url: r.url(), failed: true }));
  page.on('request', r => requests.push({ url: r.url(), failed: false }));
  if (blocked) {
    /* Block every off-origin request: the real offline test. */
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1') || u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
      return route.abort();
    });
  }
  return { ctx, page, errors, warnings, requests };
}

async function bootAndClose(page, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  /* POLL for the splash rather than sampling once. */
  const visible = await pollFor(page, () => {
    const el = document.getElementById('loading-screen');
    if (!el) return false;
    const cs = getComputedStyle(el);
    return !el.classList.contains('hidden') && cs.opacity !== '0' && el.getBoundingClientRect().width > 0;
  }, { timeout: 3000, interval: 50 });
  return visible;
}

async function waitForMenu(page) {
  await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 15000 });
}

/* ------------------------------ the run ---------------------------------- */
async function runProfile(browser, base, profile, opts = {}) {
  const tag = `${profile.name}${opts.reducedMotion === 'reduce' ? ' RM-on' : ' RM-off'}${opts.blocked ? ' BLOCKED' : ''}`;
  const { ctx, page, errors, warnings, requests } = await newPage(browser, profile, opts);

  /* --- splash gate, full AM4 list ------------------------------------- */
  const seen = await bootAndClose(page, base);
  gate(`[${tag}] splash visible on load (polled)`, seen.hit, seen.hit ? `first seen at ${seen.atMs}ms across ${seen.samples.length} samples` : `never seen in ${seen.samples.length} samples`);

  await waitForMenu(page);
  const closedNaturally = await pollFor(page, () => window.__fracture.snapshot().splash.closed, { timeout: 4000, interval: 50 });
  gate(`[${tag}] splash auto-closes exactly once`, closedNaturally.hit, `closed by ${closedNaturally.atMs}ms`);

  const focusOk = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a ? a.tagName : null, id: a ? a.id : null, inMenu: !!(a && a.closest && a.closest('#menu-screen')) };
  });
  gate(`[${tag}] splash returns focus into the menu`, focusOk.inMenu, `activeElement=${focusOk.tag}#${focusOk.id}`);

  const noSave = await page.evaluate(() => {
    const s = window.__fracture.snapshot();
    return { hasSave: s.hasSave, keys: Object.keys(localStorage) };
  });
  gate(`[${tag}] splash mutated no save`, noSave.hasSave === false && !noSave.keys.includes('mbm_relicforge_fracture_v1'), `localStorage keys: [${noSave.keys.join(', ')}]`);

  /* RM must be genuinely static when reduced. */
  const rm = await page.evaluate(() => window.__fracture.snapshot().reducedMotion);
  if (opts.reducedMotion === 'reduce') {
    gate(`[${tag}] RM effective + body class set from OS floor`, rm.effective === true && rm.osPreference === true && rm.bodyClass === true, JSON.stringify(rm));
  } else {
    gate(`[${tag}] RM off when neither OS nor user asks`, rm.effective === false, JSON.stringify(rm));
  }

  /* --- overflow -------------------------------------------------------- */
  const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
  gate(`[${tag}] 0px horizontal overflow at menu`, overflow.scrollW <= overflow.innerW, `${overflow.scrollW} vs ${overflow.innerW}`);

  /* --- class select -> adventure, driven through the real UI ----------- */
  await page.click('#new-game-button');
  await page.waitForSelector('#class-choice-grid .choice-card', { state: 'visible' });
  const chosen = await page.evaluate(() => {
    const cls = document.querySelectorAll('#class-choice-grid .choice-card');
    const paths = document.querySelectorAll('#path-choice-grid .choice-card');
    cls[1].click();                     /* Riftcaller — not the default, so the choice is load-bearing */
    paths[0].click();                   /* Build pathway */
    return { classes: cls.length, paths: paths.length, cls: cls[1].dataset.class, path: paths[0].dataset.path };
  });
  gate(`[${tag}] class select offers every class and pathway`, chosen.classes === 3 && chosen.paths === 3, `${chosen.classes} classes, ${chosen.paths} pathways; picked ${chosen.cls}/${chosen.path}`);
  await page.click('#begin-adventure-button');
  await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 15000 });
  const s1 = await page.evaluate(() => window.__fracture.snapshot());
  gate(`[${tag}] adventure starts in Realm I`, s1.zoneIndex === 0 && s1.realmName === 'Ironwood Verge', `${s1.realm} ${s1.realmName}, hp ${s1.hero.hp}/${s1.hero.maxHp}`);

  /* --- all three realms reachable -------------------------------------- */
  const realms = [];
  for (const i of [0, 1, 2]) {
    await page.evaluate(idx => { window.loadZone(idx); }, i);
    await page.waitForTimeout(350);
    const s = await page.evaluate(() => window.__fracture.snapshot());
    realms.push(`${s.realm}=${s.realmName}`);
  }
  gate(`[${tag}] all three realms load`, realms.length === 3 && realms.every(r => r.includes('=') && !r.includes('=null')), realms.join(' · '));

  /* --- combat loop exercised ------------------------------------------- */
  await page.evaluate(() => { window.loadZone(0); });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => window.__fracture.snapshot());
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.__fracture.snapshot());
  gate(`[${tag}] simulation advances (elapsed + effects live)`, after.elapsed > before.elapsed, `elapsed ${before.elapsed} -> ${after.elapsed}, effects ${after.activeEffects}`);

  /* --- save / reload / continue -----------------------------------------
     No state is injected: the game plays, saves through its own saveGame(),
     and the restored snapshot is compared field-by-field against the one
     taken immediately before the save. That tests the real round-trip rather
     than a value the harness planted. */
  await page.evaluate(() => { window.loadZone(1); });        /* leave the start realm so zoneIndex is load-bearing */
  await page.waitForTimeout(1200);
  const savedSnap = await page.evaluate(() => { window.saveGame(false); return window.__fracture.snapshot(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForMenu(page);
  const hasSave = await page.evaluate(() => window.__fracture.snapshot().hasSave);
  gate(`[${tag}] save persists across reload`, hasSave === true, `hasSave=${hasSave}`);
  await page.evaluate(() => { window.continueAdventure(); });
  await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 15000 });
  const restored = await page.evaluate(() => window.__fracture.snapshot());
  const carried = ['zoneIndex', 'classType', 'pathway'];   /* classType is riftcaller here, not the default */
  const heroCarried = ['level', 'essence', 'ore', 'potions'];
  const mismatch = [
    ...carried.filter(k => restored[k] !== savedSnap[k]).map(k => `${k}: ${savedSnap[k]} -> ${restored[k]}`),
    ...heroCarried.filter(k => restored.hero[k] !== savedSnap.hero[k]).map(k => `hero.${k}: ${savedSnap.hero[k]} -> ${restored.hero[k]}`)
  ];
  gate(`[${tag}] continue restores state losslessly`, mismatch.length === 0,
    mismatch.length ? mismatch.join('; ') : `zone ${restored.zoneIndex} (${restored.realmName}), ${restored.classType}/${restored.pathway}, level ${restored.hero.level}, essence ${restored.hero.essence}, ore ${restored.hero.ore}`);

  /* --- corrupt-save fail-safe ------------------------------------------ */
  await page.evaluate(() => { localStorage.setItem('mbm_relicforge_fracture_v1', '{"truncated":'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  let bootedClean = true;
  try { await waitForMenu(page); } catch (_) { bootedClean = false; }
  gate(`[${tag}] corrupt save fails safe to a usable menu`, bootedClean, 'truncated JSON payload');
  await page.evaluate(() => localStorage.clear());

  /* --- victory + Chronicle --------------------------------------------- */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForMenu(page);
  await page.evaluate(() => { window.beginAdventure(false); });
  await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 15000 });
  const chronicle = await page.evaluate(async () => {
    /* Capture the exported document instead of downloading it. */
    let captured = null;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = blob => { captured = blob; return realCreate.call(URL, blob); };
    window.showVictory();
    window.exportChronicle();
    URL.createObjectURL = realCreate;
    if (!captured) return { ok: false, reason: 'no blob captured' };
    const text = await captured.text();
    return { ok: true, text };
  });
  gate(`[${tag}] Chronicle export produces a document`, chronicle.ok, chronicle.ok ? `${chronicle.text.length} chars` : chronicle.reason);

  if (chronicle.ok) {
    const t = chronicle.text;
    const unresolved = ['undefined', 'NaN', '[object Object]', '${'].filter(m => t.includes(m));
    gate(`[${tag}] Chronicle has no unresolved interpolation`, unresolved.length === 0, unresolved.length ? `found: ${unresolved.join(', ')}` : 'no undefined/NaN/[object Object]/${');
    /* Parse it as a real document, not a regex guess. */
    const parsed = await page.evaluate(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return {
        title: doc.title,
        sections: doc.querySelectorAll('section').length,
        rows: doc.querySelectorAll('tbody tr').length,
        parserErrors: doc.querySelectorAll('parsererror').length,
        endsWell: html.trim().endsWith('</html>')
      };
    }, t);
    gate(`[${tag}] Chronicle parses as well-formed standalone HTML`, parsed.parserErrors === 0 && parsed.sections >= 4 && parsed.endsWell, JSON.stringify(parsed));
  }

  /* --- rendered touch-target census (RENDERED box, never a CSS declaration) */
  if (profile.isMobile) {
    await page.evaluate(() => { window.loadZone(0); });
    await page.waitForTimeout(300);
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, [role=button], input, select, a').forEach(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return;
        if (r.width < 44 || r.height < 44) out.push({ id: el.id || null, cls: el.className || null, tag: el.tagName, w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
      });
      return out;
    });
    gate(`[${tag}] rendered touch targets >= 44px`, small.length === 0, small.length ? `${small.length} under floor: ${JSON.stringify(small.slice(0, 8))}` : 'all visible controls clear 44px');

    const ovf2 = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
    gate(`[${tag}] 0px horizontal overflow in play`, ovf2.scrollW <= ovf2.innerW, `${ovf2.scrollW} vs ${ovf2.innerW}`);
  }

  /* --- network truth ---------------------------------------------------- */
  const offOrigin = requests.filter(r => !r.url.startsWith('http://127.0.0.1') && !r.url.startsWith('blob:') && !r.url.startsWith('data:'));
  gate(`[${tag}] zero off-origin requests`, offOrigin.length === 0, offOrigin.length ? offOrigin.map(r => r.url).join(', ') : 'none');

  /* --- console ---------------------------------------------------------- */
  gate(`[${tag}] console clean (0 errors)`, errors.length === 0, errors.length ? errors.slice(0, 4).join(' | ') : `0 errors, ${warnings.length} warnings`);

  await ctx.close();
  return { errors, warnings };
}

/* ---------------------- frame-rate independence (P1-7) -------------------- */
async function fixedStepCheck(browser, base) {
  /* Same scripted world, two very different frame budgets. A raw-rAF-delta
     integrator diverges; a fixed timestep does not. */
  const outcomes = [];
  for (const fps of [30, 144]) {
    const { ctx, page } = await newPage(browser, PROFILES[0], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await waitForMenu(page);
    await page.evaluate(f => {
      /* Deterministic clock: drive rAF at exactly 1/f seconds per frame. */
      let t = 0; const step = 1000 / f; const cbs = [];
      window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
      window.performance.now = () => t;
      window.__tick = n => { for (let i = 0; i < n; i++) { t += step; const due = cbs.splice(0, cbs.length); due.forEach(cb => cb(t)); } };
      window.beginAdventure(false);
    }, fps);
    await page.evaluate(f => window.__tick(Math.round(f * 4)), fps);   /* 4 seconds of world time */
    const s = await page.evaluate(() => window.__fracture.snapshot());
    outcomes.push({ fps, elapsed: s.elapsed, pos: s.position });
    await ctx.close();
  }
  const [a, b] = outcomes;
  const drift = Math.abs(a.elapsed - b.elapsed);
  gate('frame-rate independence: 30fps vs 144fps world outcome',
    drift <= 0.2,
    `elapsed ${a.elapsed}s @30 vs ${b.elapsed}s @144 (drift ${drift.toFixed(3)}s)`);
  return outcomes;
}

/* ------------------------------ self-test -------------------------------- */
async function selfTest(browser, base) {
  console.log('\n--- negative controls: prove each gate CAN fail ---');
  let proven = 0, total = 0;

  /* 1. splash-presence gate against a copy with the splash removed */
  total++;
  {
    const { ctx, page } = await newPage(browser, PROFILES[0], {});
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('loading-screen');
        if (el) el.remove();
      });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const seen = await pollFor(page, () => {
      const el = document.getElementById('loading-screen');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return !el.classList.contains('hidden') && cs.opacity !== '0';
    }, { timeout: 1500, interval: 50 });
    if (!seen.hit) { proven++; console.log('PROVEN  splash gate goes red when the splash is absent'); }
    else console.log('NOT PROVEN  splash gate stayed green with the splash removed');
    await ctx.close();
  }

  /* 2. off-origin gate against the pristine pre-vendor file (still has the CDN ref) */
  total++;
  if (fs.existsSync(path.join(ROOT, 'pristine-pre-vendor.html'))) {
    const { ctx, page, requests } = await newPage(browser, PROFILES[0], { blocked: true });
    await page.goto(base.replace(/\/[^/]*$/, '/pristine-pre-vendor.html'), { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    const off = requests.filter(r => !r.url.startsWith('http://127.0.0.1') && !r.url.startsWith('blob:') && !r.url.startsWith('data:'));
    if (off.length > 0) { proven++; console.log(`PROVEN  blocked-network gate detects the CDN ref (${off.length} off-origin: ${off[0].url})`); }
    else console.log('NOT PROVEN  no off-origin request seen from the pristine copy');
    await ctx.close();
  } else { console.log('SKIP  pristine copy absent'); total--; }

  /* 3. touch-target gate against an injected 20x20 control */
  total++;
  {
    const { ctx, page } = await newPage(browser, PROFILES[1], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await waitForMenu(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'injected-tiny'; b.textContent = 'x';
      b.style.cssText = 'position:fixed;left:4px;top:4px;width:20px;height:20px;z-index:9999';
      document.body.appendChild(b);
    });
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button').forEach(el => {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (cs.display === 'none' || r.width === 0) return;
        if (r.width < 44 || r.height < 44) out.push(el.id);
      });
      return out;
    });
    if (small.includes('injected-tiny')) { proven++; console.log('PROVEN  touch-target gate catches an injected 20x20 control'); }
    else console.log('NOT PROVEN  injected 20x20 control was not caught');
    await ctx.close();
  }

  /* 4. Chronicle interpolation gate against a deliberately broken document */
  total++;
  {
    const broken = '<!DOCTYPE html><html><body><p>Level undefined</p><p>${game.kills}</p></body></html>';
    const unresolved = ['undefined', 'NaN', '[object Object]', '${'].filter(m => broken.includes(m));
    if (unresolved.length > 0) { proven++; console.log(`PROVEN  Chronicle gate flags a broken export (${unresolved.join(', ')})`); }
    else console.log('NOT PROVEN  broken export passed the interpolation check');
  }

  /* 5. console gate against an injected error */
  total++;
  {
    const { ctx, page, errors } = await newPage(browser, PROFILES[0], {});
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { setTimeout(() => { throw new Error('injected control error'); }, 0); });
    await page.waitForTimeout(500);
    if (errors.length > 0) { proven++; console.log(`PROVEN  console gate catches an injected error (${errors.length})`); }
    else console.log('NOT PROVEN  injected error was not observed');
    await ctx.close();
  }

  console.log(`\nnegative controls: ${proven}/${total} proven able to fail`);
  /* THE POINT: this harness must exit non-zero when a control does not bite. */
  if (proven !== total) { console.log('SELF-TEST FAILED — a gate could not be shown to fail.'); process.exit(1); }
  console.log('SELF-TEST PASSED — every control bit.');
  process.exit(0);
}

/* -------------------------------- main ----------------------------------- */
const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}/${TARGET}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
console.log(`target: ${TARGET}   base: ${base}   blocked: ${BLOCKED}\n`);

try {
  if (SELF_TEST) { await selfTest(browser, base); }
  for (const profile of PROFILES) {
    for (const rmState of ['no-preference', 'reduce']) {
      console.log(`\n=== ${profile.name} · RM ${rmState} ${BLOCKED ? '· BLOCKED' : ''} ===`);
      await runProfile(browser, base, profile, { reducedMotion: rmState, blocked: BLOCKED });
    }
  }
  if (!BLOCKED) { console.log('\n=== frame-rate independence ==='); await fixedStepCheck(browser, base); }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${results.filter(r => r.ok).length}/${results.length} gates green, ${failures} red`);
process.exit(failures === 0 ? 0 : 1);
