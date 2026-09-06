/* verify_2c_games.mjs — Stage 2C repair gates for Lumina Haven and Aurora Links 3D.
 *
 * Every gate here corresponds to a finding that an audit raised and an
 * adversarial verifier then CONFIRMED against the live game. None of them is
 * a code inspection: each one drives the built page in a browser and measures
 * what happens.
 *
 * THE NEGATIVE CONTROL IS THE PRISTINE FILE.
 *
 * --control runs the identical gates against Lumina_pristine.html and
 * Aurora_pristine.html, which still carry every defect. The control passes only
 * if those runs go RED. That is a stronger instrument than a synthetic wrong
 * expectation: it proves each gate detects the actual defect it was written for,
 * in the actual code that had it. A gate that stays green on the pristine file
 * is measuring nothing, and this run says so by name.
 *
 *   node tools/verify_2c_games.mjs
 *   node tools/verify_2c_games.mjs --control
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_DIR || path.join(HERE, '..');
const CONTROL = process.argv.includes('--control');

/* The controls are the PRE-REPAIR originals, retained here rather than
   discarded. They are the only thing that can prove these gates detect the
   defects they were written for, in the code that actually had them. They are
   not linked from anywhere and nothing serves them to a player; they exist so
   `--control` is reproducible by anyone with the repo, not just by whoever
   happened to have the originals on disk the day the repair was made. */
const FILES = CONTROL
  ? { lumina: 'tools/2c-pristine/Lumina_pristine.html', aurora: 'tools/2c-pristine/Aurora_pristine.html' }
  : { lumina: 'luminahaven/index.html', aurora: 'auroralinks/index.html' };

const results = [];
const gate = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
};

/* A real server, not file://, so localStorage has a proper origin. */
function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* Counts real animation frames from inside the page. A cross-process
   page.evaluate round-trip costs ~250ms and misses exactly the window these
   faults live in, so the witness is installed before any game code runs. */
const RAF_WITNESS = () => {
  window.__rafCount = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => orig(t => { window.__rafCount++; return cb(t); });
  window.__webglContexts = [];
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, options) {
    const context = getContext.call(this, kind, options);
    if (/^(?:webgl2?|experimental-webgl)$/.test(String(kind)) && context && !window.__webglContexts.includes(context)) {
      window.__webglContexts.push(context);
    }
    return context;
  };
  window.__pageErrors = [];
  window.addEventListener('error', e => window.__pageErrors.push(String(e.message).slice(0, 120)));
};

async function boot(browser, file, { seed = null, key = null, media = null, viewport = { width: 1280, height: 820 } } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: media === 'reduce' ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(RAF_WITNESS);
  if (seed !== null && key) {
    await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (_) {} }, [key, seed]);
  }
  await page.goto(file, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1100);
  return { ctx, page };
}
const rafOf = page => page.evaluate(() => window.__rafCount);

/* Sampling the top-left corner of a room is sampling a wall. The first version
   of this probe did exactly that and reported "1 distinct frame" for BOTH the
   reduced-motion and the full-motion run — a comparison in which neither side
   moved, reported as a PASS. That is the vacuous green this estate keeps
   catching: a green that claims a property nobody tested.
   This samples the WHOLE canvas on a coarse stride, and every gate that uses it
   asserts the control side actually moved before it reads anything into the
   test side. */
const SAMPLE_CANVAS = `async (id, n) => {
  const c = document.getElementById(id);
  const g = c.getContext('2d');
  const frames = [], hashes = [];
  for (let i = 0; i < n; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const s = [];
    for (let k = 0; k < d.length; k += 1021) s.push(d[k]);
    frames.push(s);
    let h = 0; for (const v of s) h = (h * 31 + v) >>> 0;
    hashes.push(h);
  }
  /* Mean absolute change between consecutive frames. Counting DISTINCT frames
     was the wrong measure: a sanctuary game legitimately evolves (plants grow)
     even with every animation stopped, so distinctness stayed high under
     reduced motion and said nothing about amplitude. What reduced motion is
     supposed to remove is the size of the per-frame change, so that is what is
     measured. */
  let total = 0, pairs = 0;
  for (let i = 1; i < frames.length; i++) {
    let sum = 0;
    for (let k = 0; k < frames[i].length; k++) sum += Math.abs(frames[i][k] - frames[i - 1][k]);
    total += sum / frames[i].length; pairs++;
  }
  return {
    distinct: new Set(hashes).size,
    motion: +(total / Math.max(1, pairs)).toFixed(4),
    mq: matchMedia('(prefers-reduced-motion: reduce)').matches
  };
}`;

/* ------------------------------------------------------------------ LUMINA */
async function lumina(browser, base) {
  const URL = `${base}/${FILES.lumina}`;
  const KEY = CONTROL ? 'mbm_lumina_haven_v2' : 'mbm_lumina_haven_state_v1';

  /* L1 — hostile saves must not kill the render loop. */
  const payloads = [
    ['objects:null', '{"objects":null}'],
    ['objects:string', '{"objects":"nope"}'],
    ['objects:object', '{"objects":{"a":1}}'],
    ['palette:evil', '{"palette":"evil"}'],
    ['palette:number', '{"palette":123}'],
    ['nodes:string', '{"nodes":"xxx"}'],
    ['nodes:null', '{"nodes":null}'],
    ['unlocks:null', '{"unlocks":null}'],
    ['node kind unknown', '{"nodes":[{"kind":"zzz","u":0.5,"v":0.5}]}'],
    ['essence:string', '{"essence":"lots"}']
  ];
  let alive = 0;
  const dead = [];
  for (const [label, blob] of payloads) {
    const { ctx, page } = await boot(browser, URL, { seed: blob, key: KEY });
    const a = await rafOf(page);
    await page.waitForTimeout(500);
    const b = await rafOf(page);
    await page.waitForTimeout(500);
    const c = await rafOf(page);
    /* Not "did it run" — did it KEEP running, at both samples. An absolute
       frame count is the wrong bar: headless software rendering runs these at
       6-12fps, so a healthy loop can legitimately show single digits. A frozen
       loop reads a==b==c. */
    const ok = b > a && c > b;
    if (ok) alive++; else dead.push(`${label} raf ${a}->${b}->${c}`);
    await ctx.close();
  }
  gate('L1 every hostile save still boots to a live render loop', alive === payloads.length,
    `${alive}/${payloads.length} alive${dead.length ? ` · dead: ${dead.slice(0, 3).join(', ')}` : ''}`);

  /* L1b — the Fusion Lab survives too. unlocks:null passes a rAF-only probe
     while renderCatalog throws mid-flight and empties the ingredient grid, so
     the loop being alive is not on its own evidence the game is usable. */
  {
    const { ctx, page } = await boot(browser, URL, { seed: '{"unlocks":null}', key: KEY });
    const ui = await page.evaluate(() => ({
      catalog: document.querySelectorAll('#catalog .catalogItem').length,
      swatches: document.querySelectorAll('#wallSwatches .swatch').length,
      errors: window.__pageErrors.length
    }));
    gate('L1b unlocks:null leaves a usable UI, not a live loop over a dead one',
      ui.catalog >= 16 && ui.swatches >= 6 && ui.errors === 0,
      `catalog ${ui.catalog} · swatches ${ui.swatches} · pageErrors ${ui.errors}`);
    await ctx.close();
  }

  /* L2 — a thrown draw must cost one frame, not the session. */
  {
    const { ctx, page } = await boot(browser, URL);
    const before = await rafOf(page);
    await page.evaluate(() => {
      const c = document.getElementById('game').getContext('2d');
      let n = 0;
      const real = c.fillRect.bind(c);
      c.fillRect = (...a) => { if (n++ === 3) throw new Error('injected draw fault'); return real(...a); };
      setTimeout(() => { c.fillRect = real; }, 400);
    });
    await page.waitForTimeout(900);
    const after = await rafOf(page);
    await page.waitForTimeout(600);
    const later = await rafOf(page);
    /* Headless software rendering runs this at ~10fps, so the bar is "still
       advancing at both samples", not an absolute frame count. A dead loop
       reads identical at all three. */
    gate('L2 an injected draw fault does not stop the loop',
      after > before && later > after, `raf ${before}->${after}->${later}`);
    await ctx.close();
  }

  /* L3 — fixed timestep. Same world at 30fps and 144fps, and BOTH must move. */
  {
    const run = async fps => {
      const { ctx, page } = await boot(browser, URL);
      const out = await page.evaluate(async ({ hz, key }) => {
        const start = { ...(window.__lhProbe ? {} : {}) };
        /* Drive a deterministic clock rather than trusting the display. */
        /* Start the virtual clock AT the real one. The game already has a real
           rAF callback pending when the override lands; it fires once with a
           real timestamp, and against a virtual clock starting at 0 that is a
           huge dt the accumulator turns into a burst of steps. Both runs got
           one, of different sizes, and the result was a uniform ~2% divergence
           that looked like timestep drift and was entirely the instrument. */
        let t = performance.now(); const step = 1000 / hz;
        const cbs = [];
        window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
        await new Promise(r => setTimeout(r, 80));
        /* #waterPct is hidden until a plant is selected, so it read "0%" in both
           runs and made the comparison vacuous. The witness is the simulated
           plant state itself, forced out through the save. */
        const readout = () => {
          try {
            document.getElementById('manualSaveBtn').click();
            const st = JSON.parse(localStorage.getItem(key));
            const p = st.objects.find(o => o.plant);
            return p ? `${p.plant.water.toFixed(4)}/${p.plant.growth.toFixed(4)}` : null;
          } catch (_) { return null; }
        };
        document.getElementById('startBtn').click();
        /* Burn one virtual frame BEFORE taking the baseline. The first frame
           after the override carries a dt spanning the real-clock gap, which
           the accumulator turns into a burst of steps whose size depends on the
           frame interval — so it landed in the two runs unequally and showed up
           as timestep drift. Reading the baseline after it removes it from both
           deltas instead of trying to make it identical. */
        {
          const batch = cbs.splice(0, cbs.length);
          t += step;
          for (const cb of batch) { try { cb(t); } catch (_) {} }
          await new Promise(r => setTimeout(r, 0));
        }
        const before = readout();
        for (let i = 0; i < hz * 6; i++) {
          t += step;
          const batch = cbs.splice(0, cbs.length);
          for (const cb of batch) { try { cb(t); } catch (_) {} }
          if (i % 40 === 0) await new Promise(r => setTimeout(r, 0));
        }
        return { before, after: readout(), frames: hz * 6 };
      }, { hz: fps, key: KEY });
      await ctx.close();
      return out;
    };
    /* 15fps, not 30. The pristine game clamps dt at 0.05s, so below 20fps the
       world silently runs slow — that is the frame-rate dependence this gate
       exists to catch, and at 30fps it does not show. */
    const a = await run(15), b = await run(144);
    /* The vacuity assertion: if neither run moved, "they match" is worthless. */
    const moved = a.before !== a.after && b.before !== b.after;
    const nums = v => (v || '').split('/').map(Number);
    /* Compare the CHANGE each run produced, not the absolute values. Each boot
       runs for a slightly different wall time before the probe takes over, so
       the two runs do not start from the same state and comparing absolutes was
       measuring boot jitter as if it were timestep drift. */
    const dA = nums(a.after).map((v, i) => v - nums(a.before)[i]);
    const dB = nums(b.after).map((v, i) => v - nums(b.before)[i]);
    /* Tolerance as a fraction of the change itself. The accumulator's
       floating-point residue leaves the runs a step or two apart (~1%); the
       defect is a ~25% divergence at 15fps. 2% sits an order of magnitude
       inside that gap. */
    const rel = (x, y) => Math.abs(x - y) / Math.max(1e-9, Math.max(Math.abs(x), Math.abs(y)));
    const relW = rel(dA[0], dB[0]), relG = rel(dA[1], dB[1]);
    gate('L3 fixed timestep: 15fps and 144fps advance the world by the same amount',
      moved && relW <= 0.02 && relG <= 0.02,
      `15fps Δ ${dA.map(v => v.toFixed(4)).join('/')} · 144fps Δ ${dB.map(v => v.toFixed(4)).join('/')} · relative diff water ${(relW * 100).toFixed(2)}% growth ${(relG * 100).toFixed(2)}% (tol 2%)`);
  }

  /* L4 — reduced motion must change what the canvas paints, and be OS-floored. */
  {
    const frames = async media => {
      const { ctx, page } = await boot(browser, URL, { media });
      await page.evaluate(() => document.getElementById('startBtn').click());
      await page.waitForTimeout(400);
      const out = await page.evaluate(`(${SAMPLE_CANVAS})('game', 18)`);
      /* Alongside the motion measurement: how far did the WORLD get over a
         fixed wall-clock second? The pristine game "reduced motion" by clamping
         dt, which lowers per-frame change simply by running everything slower —
         and passed a motion-only gate at 6.9x while gating exactly zero canvas
         effects. Reducing motion must not cost simulation progress, so both are
         measured and both are asserted. */
      const progress = await page.evaluate(async key => {
        const read = () => {
          document.getElementById('manualSaveBtn').click();
          const p = JSON.parse(localStorage.getItem(key)).objects.find(o => o.plant);
          return p ? p.plant.growth : null;
        };
        const a = read();
        await new Promise(r => setTimeout(r, 2000));
        return +(read() - a).toFixed(4);
      }, KEY);
      await ctx.close();
      return { ...out, progress };
    };
    const off = await frames('no-preference'), on = await frames('reduce');
    /* Non-vacuity first, stated as its own gate so it cannot be skipped: if the
       full-motion run is already static there is no motion to reduce and the
       comparison below would be meaningless. */
    /* The floor is measured, not guessed: with every animation stopped this
       canvas reads 0.0003-0.0006 per-frame change. 0.01 is ~20x that, so the
       control cannot be satisfied by a still room. Lumina's ambient motion is
       deliberately subtle — flicker, sway, a slow pulse — so an absolute bar
       borrowed from a rainstorm would reject a correctly animating game. */
    const MOTION_FLOOR = 0.01;
    gate('L4a control: with motion allowed, the canvas genuinely animates',
      off.motion > MOTION_FLOOR, `per-frame motion ${off.motion} vs all-stopped floor ~0.0005 (bar ${MOTION_FLOOR})`);
    /* Motion per unit of WORLD PROGRESS, not raw motion.
       Raw motion was not a sound gate and the control proved it: the pristine
       game "reduces motion" by clamping dt, which slows everything — and that
       drops per-frame change by 5-7x while gating exactly zero canvas effects.
       At a 5x bar the defective file passed, so the green carried no
       information. Normalising by how far the simulation actually got asks the
       right question: how much visual churn per unit of game. A dt-clamp barely
       moves that (measured ~4x on pristine); real gating collapses it
       (measured 150-180x on the repair). The bar sits at 20x, an order of
       magnitude clear of both. */
    const churn = r => r.motion / Math.max(0.0001, r.progress);
    const churnRatio = churn(off) / Math.max(1e-9, churn(on));
    gate('L4 reduced motion cuts canvas motion per unit of world progress by at least 20x',
      off.motion > MOTION_FLOOR && churnRatio >= 20 && on.mq === true,
      `churn RM off ${churn(off).toFixed(5)} (motion ${off.motion} / progress ${off.progress}) · ` +
      `RM on ${churn(on).toFixed(5)} (motion ${on.motion} / progress ${on.progress}) · ratio ${churnRatio.toFixed(1)}x`);
    /* The gate that separates "reduced motion" from "slowed game".
     *
     * ONE-SIDED, ruled 2026-08-07. It was a +/-10% band and it flaked: across
     * runs at a green tip it read 0.902, 0.947, 1.008, 1.050 and 1.143. The
     * measurement is world progress per unit of WALL time, so it is sensitive
     * to render cost — and the upper excursions are benign by construction.
     * With a fixed timestep the simulation cannot run fast; a ratio above 1
     * only means the RM path had less to draw and fitted more frames into the
     * two seconds. There is no defect on that side to catch.
     *
     * THE FLOOR IS DERIVED, not chosen for comfort:
     *   - the defect is a dt clamp, and its ratio is set by the clamp against
     *     the frame interval: 0.02/0.0333 = 0.60 at 30fps, 0.02/0.05 = 0.40 at
     *     20fps. The pristine file measures 0.400. So the defect FAMILY reaches
     *     up to about 0.60, and a floor must sit above that to bite at any
     *     frame rate where the defect shows.
     *   - the lowest healthy reading observed at a green tip is 0.902.
     * 0.75 sits 25% above the worst-case defect ratio and 17% below the lowest
     * observed healthy reading. The measurement method is unchanged; only the
     * shape of the assertion moved.
     *
     * The ratio is still REPORTED on both sides, so a genuine speed-up would
     * still be visible to anyone reading the output even though it is not
     * failed on. */
    const L4B_FLOOR = 0.75;
    const progRatio = off.progress > 0 ? on.progress / off.progress : 0;
    gate('L4b reduced motion does not slow the world down',
      off.progress > 0.5 && progRatio >= L4B_FLOOR,
      `world progress over 2s: RM off ${off.progress} · RM on ${on.progress} · ratio ${progRatio.toFixed(3)} ` +
      `(floor ${L4B_FLOOR}: above the dt-clamp defect family, which tops out near 0.60; the pristine file reads 0.400)`);
  }

  /* L5 — OS preference is a live floor, not a boot-time sample. */
  {
    const { ctx, page } = await boot(browser, URL, { media: 'no-preference' });
    await page.evaluate(() => document.getElementById('startBtn').click());
    const listeners = await page.evaluate(() => {
      const mq = matchMedia('(prefers-reduced-motion: reduce)');
      return typeof mq.addEventListener === 'function';
    });
    await page.waitForTimeout(400);
    const beforeFlip = await page.evaluate(`(${SAMPLE_CANVAS})('game', 18)`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    const afterFlip = await page.evaluate(`(${SAMPLE_CANVAS})('game', 18)`);
    gate('L5 flipping the OS preference at runtime takes effect without a reload',
      listeners && beforeFlip.motion > 0.01 && afterFlip.motion * 5 <= beforeFlip.motion,
      `same page, same session: motion ${beforeFlip.motion} before the flip, ${afterFlip.motion} after`);
    await ctx.close();
  }

  /* L6 — the splash: every route closes it, exactly once, and nothing behind
     it is reachable while it is up. */
  for (const route of ['Escape', 'Enter', 'Space', 'backdrop']) {
    const { ctx, page } = await boot(browser, URL, { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => {
      window.__toasts = [];
      const el = document.getElementById('toast');
      new MutationObserver(() => { if (el.textContent) window.__toasts.push(el.textContent); })
        .observe(el, { childList: true, characterData: true, subtree: true });
    });
    if (route === 'backdrop') await page.mouse.click(30, 60);
    else await page.keyboard.press(route === 'Space' ? ' ' : route);
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => ({
      display: getComputedStyle(document.getElementById('splash')).display,
      welcomes: (window.__toasts || []).filter(t => /Welcome home/.test(t)).length,
      focused: document.activeElement ? document.activeElement.tagName : null,
      focusedIsBody: document.activeElement === document.body
    }));
    gate(`L6 [${route}] closes the splash exactly once and moves focus in`,
      out.display === 'none' && out.welcomes === 1 && !out.focusedIsBody,
      `display=${out.display} · welcome toasts=${out.welcomes} · focus=${out.focused}`);
    await ctx.close();
  }

  /* L7 — world keys must not reach the world while the splash is up. */
  {
    const { ctx, page } = await boot(browser, URL, { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => {
      window.__writes = 0;
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...a) { window.__writes++; return real.apply(this, a); };
    });
    for (const k of ['w', 'p', 'r']) await page.keyboard.press(k);
    await page.waitForTimeout(300);
    const out = await page.evaluate(() => ({
      writes: window.__writes,
      splash: getComputedStyle(document.getElementById('splash')).display,
      waterActive: !!document.querySelector('.tool[data-tool=water].active')
    }));
    gate('L7 keys behind the splash change nothing and persist nothing',
      out.writes === 0 && out.splash === 'grid' && !out.waterActive,
      `setItem calls=${out.writes} · splash=${out.splash} · water tool active=${out.waterActive}`);
    await ctx.close();
  }

  /* L8 — Backspace while typing must not delete the room. */
  {
    const { ctx, page } = await boot(browser, URL);
    await page.evaluate(() => { document.getElementById('startBtn').click(); document.getElementById('photoBtn').click(); });
    await page.waitForTimeout(250);
    const out = await page.evaluate(async key => {
      const readObjects = () => { try { return JSON.parse(localStorage.getItem(key)).objects.length; } catch (_) { return null; } };
      /* Select an object first — the defect needs a selection to have something
         to delete, and a probe with nothing selected passes vacuously on both
         the fixed and the broken game.

         The object's stored u,v are ROOM coordinates, not screen fractions:
         worldToScreen runs them through a trapezoid whose edges depend on the
         viewport and the room size. Guessing viewport fractions from them
         missed the hit radius by ~46px and selected nothing. This aims at the
         Monstera by its projected position and then, because that projection is
         the game's private business and not the harness's to reimplement,
         sweeps outward until the plant inspector appears — which is a DOM
         witness of an actual selection, not an assumption of one. */
      const c = document.getElementById('game');
      const r = c.getBoundingClientRect();
      const inspectorUp = () => getComputedStyle(document.getElementById('inspector')).display !== 'none';
      const tap = (x, y) => {
        c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
        c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
      };
      let hit = false;
      outer:
      for (let ring = 0; ring <= 6 && !hit; ring++) {
        for (let dx = -ring; dx <= ring && !hit; dx++) {
          for (let dy = -ring; dy <= ring && !hit; dy++) {
            if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            tap(r.left + r.width * 0.64 + dx * 34, r.top + r.height * 0.48 + dy * 34);
            await new Promise(res => setTimeout(res, 20));
            if (inspectorUp()) { hit = true; break outer; }
          }
        }
      }
      await new Promise(res => setTimeout(res, 150));
      document.getElementById('saveBtn').click();
      await new Promise(res => setTimeout(res, 120));
      document.getElementById('manualSaveBtn').click();
      const objectsBefore = readObjects();
      /* Without a selection there is nothing for Backspace to delete, and the
         gate passes on both the fixed and the broken game while proving
         nothing. The selection is asserted, not assumed. */
      let selected = null;
      try { selected = JSON.parse(localStorage.getItem(key)).selectedId; } catch (_) {}
      document.querySelector('[data-close=saveModal]').click();
      document.getElementById('photoBtn').click();
      await new Promise(res => setTimeout(res, 150));
      const input = document.getElementById('stickerText');
      input.focus(); input.value = 'my lumina haven ';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      await new Promise(res => setTimeout(res, 200));
      document.querySelector('[data-close=photoModal]').click();
      document.getElementById('saveBtn').click();
      await new Promise(res => setTimeout(res, 120));
      document.getElementById('manualSaveBtn').click();
      const objectsAfter = readObjects();
      return { objectsBefore, objectsAfter, selected, focused: document.activeElement === input };
    }, KEY);
    gate('L8a control: an object is actually selected, so Backspace has a target',
      out.selected != null, `selectedId=${out.selected}`);
    gate('L8 Backspace while typing does not delete a world object',
      out.selected != null && out.objectsBefore !== null && out.objectsAfter !== null && out.objectsAfter === out.objectsBefore,
      `selectedId=${out.selected} · objects ${out.objectsBefore} -> ${out.objectsAfter} · still focused in the field=${out.focused}`);
    await ctx.close();
  }

  /* L9 — touch targets, measured where they actually were: panel + mixer OPEN. */
  {
    const { ctx, page } = await boot(browser, URL, { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForTimeout(200);
    const small = await page.evaluate(() => {
      const out = [];
      const sweep = where => {
        for (const el of document.querySelectorAll('button,input,select,textarea,[role=button],a[href]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (getComputedStyle(el).visibility === 'hidden') continue;
          if (r.height < 44 || r.width < 44) out.push(`${where}:${el.id || el.className || el.tagName} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
        }
      };
      sweep('base');
      const sb = document.getElementById('settingsBtn'); if (sb) sb.click();
      sweep('panel');
      const snd = document.getElementById('soundBtn'); if (snd) snd.click();
      sweep('mixer');
      return out;
    });
    gate('L9 no interactive control under 44px with the panel and mixer open',
      small.length === 0, small.length ? `${small.length} under: ${small.slice(0, 4).join(' | ')}` : 'none');
    await ctx.close();
  }

  /* L10 — import must not overwrite the haven when it rejects the file. */
  {
    const { ctx, page } = await boot(browser, URL);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForTimeout(150);
    const out = await page.evaluate(async key => {
      document.getElementById('manualSaveBtn') && document.getElementById('saveBtn').click();
      await new Promise(r => setTimeout(r, 100));
      document.getElementById('manualSaveBtn').click();
      const before = JSON.parse(localStorage.getItem(key));
      /* The first version of this probe used {"objects":[],...}, which is a
         VALID empty-room layout — it was supposed to be applied, and the gate
         was testing the wrong thing. This one cannot be parsed at all, so
         rejection is the only correct outcome. */
      /* This payload passes the pristine game's only check (objects IS an
         array) and then throws downstream on inventory:null — which is how the
         pristine game reported "not valid" while having already replaced the
         live state with it. A malformed-JSON payload does NOT reproduce that:
         JSON.parse throws before the assignment, so both games look fine. */
      const bad = JSON.stringify({ objects: [], inventory: null, essence: 999, palette: 'twilight' });
      const dt = new DataTransfer();
      dt.items.add(new File([bad], 'evil.json', { type: 'application/json' }));
      const input = document.getElementById('importInput');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      /* Read the toast BEFORE forcing a save — the save writes its own toast
         over it, and the first version of this probe reported that one. */
      const toast = document.getElementById('toast').textContent;
      document.getElementById('manualSaveBtn').click();
      const after = JSON.parse(localStorage.getItem(key));
      return {
        beforeObjects: before.objects.length, afterObjects: after.objects.length,
        beforeEssence: Math.round(before.essence), afterEssence: Math.round(after.essence),
        toast
      };
    }, KEY);
    /* The finding is not "this file must be refused". It is that the game must
       never say a file was refused while having applied it. A game that
       sanitises the file and accepts it coherently is fine; a game that reports
       "not valid" and empties the room is not. */
    const changed = out.beforeObjects !== out.afterObjects || out.beforeEssence !== out.afterEssence;
    const saidInvalid = /not valid/.test(out.toast);
    gate('L10 the game never reports an import invalid while having applied it',
      !(saidInvalid && changed),
      `toast "${out.toast}" · objects ${out.beforeObjects}->${out.afterObjects} · essence ${out.beforeEssence}->${out.afterEssence} · reported invalid=${saidInvalid}, state changed=${changed}`);
    await ctx.close();
  }

  /* L11 — static: key convention and head metadata. */
  {
    const src = fs.readFileSync(path.join(ROOT, FILES.lumina), 'utf8');
    gate('L11 save key follows mbm_<game>_<thing>_v1',
      /mbm_lumina_haven_state_v1/.test(src) && !/mbm_lumina_haven_v2/.test(src),
      (src.match(/mbm_[a-z_]+/g) || []).join(', '));
    gate('L11 canonical link and the og:* set are present',
      /rel="canonical"/.test(src) && /og:title/.test(src) && /og:image/.test(src) && /twitter:card/.test(src),
      `canonical=${/rel="canonical"/.test(src)} og:title=${/og:title/.test(src)} twitter=${/twitter:card/.test(src)}`);
  }
}

/* ------------------------------------------------------------------ AURORA */
async function aurora(browser, base) {
  const URL = `${base}/${FILES.aurora}`;
  const KEY = CONTROL ? 'mbm_aurora_links_v1' : 'mbm_aurora_links_round_v1';

  /* A1 — hostile saves keep the loop running. */
  const payloads = [
    ['hole:abc', '{"hole":"abc"}'],
    ['hole:2.5', '{"hole":2.5}'],
    ['led:1.5', '{"led":1.5}'],
    ['led:xyz', '{"led":"xyz"}'],
    ['scores x12', '{"scores":[1,2,3,4,5,6,7,8,9,10,11,12]}'],
    ['scores short', '{"scores":[3,4,5],"calls":[1]}'],
    ['scores null', '{"scores":null}']
  ];
  let alive = 0; const dead = [];
  for (const [label, blob] of payloads) {
    const { ctx, page } = await boot(browser, URL, { seed: blob, key: KEY });
    const a = await rafOf(page);
    await page.waitForTimeout(500);
    const b = await rafOf(page);
    await page.waitForTimeout(500);
    const c = await rafOf(page);
    if (b > a && c > b) alive++; else dead.push(`${label} raf ${a}->${b}->${c}`);
    await ctx.close();
  }
  gate('A1 every hostile save still boots to a live render loop', alive === payloads.length,
    `${alive}/${payloads.length} alive${dead.length ? ` · dead: ${dead.slice(0, 3).join(', ')}` : ''}`);

  /* A2 — the scorecard must not execute a saved payload. Four sinks: the
     per-hole scores row, the totals cell, calls and ratings. */
  {
    const mark = `<img src=y onerror="window.__xss=(window.__xss||0)+1">`;
    const blob = JSON.stringify({ scores: [mark, null, null, null, null, null, null, null, null], calls: [mark], ratings: [mark] });
    const { ctx, page } = await boot(browser, URL, { seed: blob, key: KEY });
    const out = await page.evaluate(async () => {
      const b = document.getElementById('scoreBtn'); if (b) b.click();
      await new Promise(r => setTimeout(r, 400));
      return { xss: window.__xss || 0, imgs: document.querySelectorAll('#scoreTable img').length };
    });
    gate('A2 a hostile saved score cannot execute script in the scorecard',
      out.xss === 0 && out.imgs === 0, `handler fired ${out.xss}x · injected <img> in table: ${out.imgs}`);
    await ctx.close();
  }

  /* A3 — WebGL context loss must be handled, not painted over. */
  {
    const { ctx, page } = await boot(browser, URL);
    const out = await page.evaluate(async () => {
      const gl = window.__webglContexts[0] || null;
      const ext = gl && gl.getExtension('WEBGL_lose_context');
      if (!ext) return { skipped: true };
      const before = window.__rafCount;
      ext.loseContext();
      await new Promise(r => setTimeout(r, 600));
      const panel = document.getElementById('noWebGL');
      const primary = document.getElementById('game');
      return {
        skipped: false,
        panelShown: panel ? getComputedStyle(panel).display !== 'none' : false,
        lost: gl.isContextLost(),
        twoDimensionalFallback: !!primary && !!primary.getContext('2d'),
        framesAfterLoss: window.__rafCount - before,
      };
    });
    gate('A3 a real WebGL context loss surfaces instead of leaving a black void',
      out.skipped || (out.lost && (out.panelShown || (out.twoDimensionalFallback && out.framesAfterLoss > 0))),
      out.skipped ? 'WEBGL_lose_context unavailable — not asserted' : `contextLost=${out.lost} panel shown=${out.panelShown} 2D fallback=${out.twoDimensionalFallback} frames after loss=${out.framesAfterLoss}`);
    await ctx.close();
  }

  /* A4 — splash routes. */
  for (const route of ['Escape', 'Enter', 'Space']) {
    const { ctx, page } = await boot(browser, URL, { viewport: { width: 390, height: 844 } });
    await page.keyboard.press(route === 'Space' ? ' ' : route);
    await page.waitForTimeout(400);
    const out = await page.evaluate(() => {
      const sp = document.getElementById('splash');
      return { display: sp ? getComputedStyle(sp).display : 'absent', focusedIsBody: document.activeElement === document.body };
    });
    gate(`A4 [${route}] dismisses the splash and moves focus in`,
      out.display === 'none' && !out.focusedIsBody, `display=${out.display} · focus on body=${out.focusedIsBody}`);
    await ctx.close();
  }

  /* A5 — touch targets. */
  {
    const { ctx, page } = await boot(browser, URL, { viewport: { width: 390, height: 844 } });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button,input,select,[role=button]')) {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width === 0 && r.height === 0) continue;
        if (style.visibility === 'hidden') continue;
        /* A clipped screen-reader/file-input proxy has no pointer target to
           measure. Its visible launcher is measured independently in the same
           sweep; counting the 1px proxy as a failed touch target is a category
           error, not a stricter accessibility gate. */
        if (style.clip !== 'auto' || style.clipPath !== 'none') continue;
        if (r.height < 44 || r.width < 44) out.push(`${el.id || el.className} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
      }
      return out;
    });
    gate('A5 no interactive control under 44px at 390x844', small.length === 0,
      small.length ? `${small.length} under: ${small.slice(0, 4).join(' | ')}` : 'none');
    await ctx.close();
  }

  /* A6 — reduced motion reaches the current V4 water/atmosphere engine.
     The 2026-08-06 Aurora implementation exposed window.__aurora and painted
     per-hole rain to #fxCanvas. The canonical route now uses the Northern
     Lights V4 engine: its actual motion authority is weatherTime and its
     water witness is gerstnerWaveSumV4(). Exercise those shipped functions
     directly so a renamed DOM surface cannot manufacture a pass or a red. */
  {
    if (CONTROL) {
      let wetHole = -1, weathers = [];
      {
        const { ctx, page } = await boot(browser, URL);
        const snap = await page.evaluate(() => window.__aurora && window.__aurora.snapshot());
        if (snap) { weathers = snap.holeWeathers; wetHole = weathers.findIndex(w => w === 'rain' || w === 'storm'); }
        await ctx.close();
      }
      gate('A6a control: the round contains a hole with weather to reduce',
        wetHole >= 0, `hole weathers [${weathers.join(', ')}] · first wet hole index ${wetHole}`);
      if (wetHole >= 0) {
        const frames = async media => {
          const { ctx, page } = await boot(browser, URL, { media, seed: JSON.stringify({ hole: wetHole }), key: KEY });
          await page.keyboard.press('Enter');
          await page.waitForTimeout(700);
          const snap = await page.evaluate(() => window.__aurora.snapshot());
          const measured = await page.evaluate(`(${SAMPLE_CANVAS})('fxCanvas', 18)`);
          await ctx.close();
          return { ...measured, snap };
        };
        const off = await frames('no-preference'), on = await frames('reduce');
        gate('A6b control: with motion allowed, the weather layer genuinely animates',
          off.motion > 0.5, `weather=${off.snap.weather} · streaks ${off.snap.rainStreaks} · per-frame motion ${off.motion}`);
        gate('A6 reduced motion reaches the canvas weather layer',
          off.motion > 0.5 && on.motion * 5 <= off.motion && on.snap.reducedMotion.effective === true,
          `RM off ${off.motion} (${off.snap.rainStreaks} streaks) · RM on ${on.motion} (${on.snap.rainStreaks} streaks) · ratio ${(off.motion / Math.max(0.0001, on.motion)).toFixed(1)}x`);
      }
    } else {
    const { ctx, page } = await boot(browser, URL);
    const out = await page.evaluate(() => {
      enterClubhouse(false); setupRun('tour');
      const distance = (a, b) => Math.hypot(a.height - b.height, a.dx - b.dx, a.dz - b.dz);
      profile.settings.calm = false;
      profile.settings.reduced = false;
      weatherTime = 0;
      const normalWave0 = gerstnerWaveSumV4(7, 19, 0), normalWave1 = gerstnerWaveSumV4(7, 19, 1);
      for (let i = 0; i < 120; i++) update(FIXED);
      const normalTime = weatherTime, normalWaveDelta = distance(normalWave0, normalWave1);
      profile.settings.reduced = true;
      weatherTime = 0;
      const reducedWave0 = gerstnerWaveSumV4(7, 19, 0), reducedWave1 = gerstnerWaveSumV4(7, 19, 1);
      for (let i = 0; i < 120; i++) update(FIXED);
      return { normalTime, reducedTime: weatherTime, normalWaveDelta,
        reducedWaveDelta: distance(reducedWave0, reducedWave1), effective: profile.settings.reduced };
    });
    gate('A6a control: with motion allowed, atmospheric time genuinely advances',
      out.normalTime >= 0.99, `120 fixed steps advanced weatherTime by ${out.normalTime}`);
    gate('A6b control: with motion allowed, the Gerstner water layer genuinely changes',
      out.normalWaveDelta > 0.01, `one-second Gerstner vector delta ${out.normalWaveDelta}`);
    gate('A6 reduced motion reaches the water and atmosphere layers',
      out.normalTime >= out.reducedTime * 5 && out.reducedWaveDelta === 0 && out.effective === true,
      `weatherTime ${out.normalTime} -> ${out.reducedTime} (${(out.normalTime / Math.max(0.0001, out.reducedTime)).toFixed(1)}x) · Gerstner delta ${out.normalWaveDelta} -> ${out.reducedWaveDelta}`);
    await ctx.close();
    }
  }

  /* A7 — static. */
  {
    const src = fs.readFileSync(path.join(ROOT, FILES.aurora), 'utf8');
    gate('A7 save key follows mbm_<game>_<thing>_v1',
      /mbm_aurora_links_round_v1/.test(src),
      (src.match(/mbm_[a-z_]+/g) || []).join(', '));
    gate('A7 canonical link and the og:* set are present',
      /rel="canonical"/.test(src) && /og:title/.test(src) && /og:image/.test(src),
      `canonical=${/rel="canonical"/.test(src)} og:title=${/og:title/.test(src)}`);
  }
}

/* ------------------------------------------------------------------- run */
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
console.log(CONTROL
  ? `*** NEGATIVE CONTROL: running against the PRISTINE files. Every gate below is expected to go RED. ***\n`
  : `Stage 2C repair gates — ${FILES.lumina} + ${FILES.aurora}\n`);
try {
  console.log('--- Lumina Haven ---');
  await lumina(browser, base);
  console.log('\n--- Aurora Links 3D ---');
  await aurora(browser, base);
} finally {
  await browser.close();
  srv.close();
}

const red = results.filter(r => !r.ok).length;
console.log(`\n${results.length - red}/${results.length} gates green, ${red} red`);

if (CONTROL) {
  const stillGreen = results.filter(r => r.ok);
  if (red === 0) {
    console.error('\nNEGATIVE CONTROL FAILED: the pristine files passed every gate. This harness measures nothing.');
    process.exit(1);
  }
  console.log(`\nNEGATIVE CONTROL: ${red} gate(s) detected the defect in the pristine file.`);
  /* Some gates are DESIGNATED CONTROLS: they assert the measurement is
     non-vacuous and are supposed to be green on both files. Everything else
     that stays green on pristine is an instrument that cannot detect the defect
     it was written for, and it is named rather than quietly counted. */
  const DESIGNATED = /^(L4a|L8a|A6a|A6b) /;
  const controls = stillGreen.filter(g => DESIGNATED.test(g.name));
  const blind = stillGreen.filter(g => !DESIGNATED.test(g.name));
  if (controls.length) {
    console.log(`\n${controls.length} designated non-vacuity control(s) green on both files, as intended:`);
    for (const g of controls) console.log(`   control: ${g.name}`);
  }
  if (blind.length) {
    console.log(`\n${blind.length} gate(s) stayed green on the DEFECTIVE file. They cannot detect what they were written for:`);
    for (const g of blind) console.log(`   NOT PROVEN ABLE TO FAIL: ${g.name}`);
    console.log('\nCONTROL INCOMPLETE: the greens from those gates carry no information.');
    process.exit(1);
  }
  process.exit(0);
}
process.exit(red === 0 ? 0 : 1);
