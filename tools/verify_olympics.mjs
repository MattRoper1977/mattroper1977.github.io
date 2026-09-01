#!/usr/bin/env node
/* verify_olympics.mjs — the Global Games audit harness.
 *
 * Drives the real UI: title -> setup -> hub -> briefing -> play -> result ->
 * standings, nine times, and out the other side into the medal ceremony. The
 * only shortcut is resolving each event's score through the diagnostic
 * surface, and that shortcut is bounded by O3, which sends real keystrokes to
 * two engines and requires the simulation to actually respond to them. A
 * harness that only ever used the shortcut would prove the menus work and
 * nothing else.
 *
 * BL4a is the shape of every gate here:
 *   - presence is POLLED across the boot window, never sampled once;
 *   - every gate is proven able to go red before its green is counted.
 * Where a control is cheap it runs inline and is reported as [control]. Where
 * it needs a broken copy of the game, the copy is written to a temp dir and
 * the SAME gate is re-run against it.
 *
 *   node tools/verify_olympics.mjs
 *   BASE=http://127.0.0.1:4173/olympics/index.html node tools/verify_olympics.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'olympics', 'index.html');
const BASE = process.env.BASE || 'http://127.0.0.1:4173/olympics/index.html';

/* Both viewports. The phone size is the one the safe-area insets and the touch
   bar exist for, so a desktop-only pass would miss exactly the layout this
   game does the most work to support. */
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 }
];

let red = 0;
const t = (name, ok, detail) => {
  if (!ok) red++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

/* Writes a copy of the game with one deliberate defect, refusing to hand back
   a file identical to the original — a tamper that did not apply proves
   nothing, and would show up as a mysteriously passing control. */
const SRC = readFileSync(FILE, 'utf8');
function tamper(label, edits) {
  let out = SRC;
  for (const [from, to] of edits) {
    if (out.indexOf(from) < 0) return { path: null, why: `anchor not found: ${from.slice(0, 54)}…` };
    out = out.replace(from, to);
  }
  if (out === SRC) return { path: null, why: 'edits produced an identical file' };
  const dir = mkdtempSync(join(tmpdir(), 'oly-'));
  const p = join(dir, 'index.html');
  writeFileSync(p, out);
  return { path: p, why: null, url: 'file://' + p };
}

async function open(browser, opts = {}) {
  const vp = opts.viewport || VIEWPORTS[0];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: opts.rm || 'no-preference',
    serviceWorkers: 'block'
  });
  const page = await ctx.newPage();
  const errors = [], remote = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 110)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 110)); });
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith('http://127.0.0.1') && !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) remote.push(u);
  });
  /* addInitScript takes (fn, arg) — an EARLIER version passed [fn, arg] as a
     single argument, which Playwright read as a malformed script object and
     threw on. Every corrupted-save case then reported "never booted", which
     looked exactly like eight real defects in the game and was one defect in
     the harness. */
  if (opts.initFn) await page.addInitScript(opts.initFn, opts.initArg);
  await page.goto(opts.url || BASE, { waitUntil: 'commit' });
  /* POLL, DO NOT SAMPLE. The splash sits over the boot for up to 3.2s and the
     app builds behind it; a fixed sleep either wastes time or races. */
  await page.waitForFunction(() => !!window.__olympics && window.__olympics.screen !== null, null, { timeout: 20000 });
  return { ctx, page, errors, remote };
}

/* Dismiss the brand splash the way a player would, then wait for it to detach.
   Every journey goes through this, so the splash is exercised on every run
   rather than only by the splash gate. */
async function pastSplash(page) {
  const maker = page.locator('[data-mbm-maker-splash]').first();
  if (await maker.count()) {
    await page.evaluate(() => document.querySelector('[data-mbm-maker-splash]')?.click());
    await maker.waitFor({ state: 'detached', timeout: 8000 });
  }
  const legacy = page.locator('.mbm-splash').first();
  if (await legacy.count()) {
    await page.evaluate(() => document.querySelector('.mbm-skip')?.click());
    await legacy.waitFor({ state: 'detached', timeout: 8000 });
  }
}

const click = async (page, sel) => {
  await page.waitForSelector(sel, { timeout: 12000 });
  await page.evaluate(s => document.querySelector(s).click(), sel);
};
const screen = page => page.evaluate(() => window.__olympics.screen);

/* Walk the real UI from the title screen into a running first event of the
   named mode. Every step is a control the player has. */
async function startChampionship(page, mode = 'ultimate') {
  await pastSplash(page);
  await click(page, '#newGamesBtn');
  /* The V6 ceremony auto-closes. Waiting for the button and clicking it in
     separate page tasks left a race where the timer could remove the node
     between the two, producing a null.click() crash instead of a judgement.
     Sight and activation are one atomic predicate here, and it only resolves
     after a genuinely visible skip control has received the click. */
  await page.waitForFunction(() => {
    const button = document.querySelector('#v6-intro .v6-skip');
    if (!button) return false;
    const style = getComputedStyle(button), rect = button.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return false;
    button.click();
    return true;
  }, null, { timeout: 3000 });
  await page.waitForSelector('#v6-intro', { state: 'detached', timeout: 3000 });
  await page.waitForSelector('[data-mode]', { timeout: 12000 });
  await page.evaluate(m => document.querySelector(`[data-mode="${m}"]`).click(), mode);
  /* "Enter Games Village" is DISABLED until all 25 development points are
     allocated — the first version of this harness clicked a dead node and
     waited 12s for a screen change that was never coming. Auto Allocate is the
     control a player uses to satisfy the same rule, so the harness uses it too,
     and then waits for the button to genuinely become enabled rather than
     assuming one click was enough. Selecting a mode re-renders the whole setup
     screen, so every node here is re-queried after each click. */
  await click(page, '#autoAttrs');
  await page.waitForFunction(() => {
    const b = document.querySelector('#beginTournament');
    return !!b && !b.disabled;
  }, null, { timeout: 12000 });
  await click(page, '#beginTournament');
  await page.waitForFunction(() => window.__olympics.screen === 'HUB', null, { timeout: 12000 });
}

/* One full day: briefing -> start -> resolve -> result -> standings.
   Returns what the diagnostic surface said at each checkpoint so the caller
   can assert on the journey rather than on a final flag. */
async function playDay(page, { resolve = true } = {}) {
  await click(page, '#eventBriefing');
  await page.waitForFunction(() => window.__olympics.screen === 'INTRO', null, { timeout: 12000 });
  await click(page, '#startEvent');
  await page.waitForFunction(() => window.__olympics.screen === 'PLAYING', null, { timeout: 12000 });
  const playing = await page.evaluate(() => ({ id: window.__olympics.eventId, day: window.__olympics.day, energy: window.__olympics.energy }));
  if (!resolve) return { playing };
  await page.evaluate(() => window.__olympics.finishEvent());
  await page.waitForFunction(() => window.__olympics.screen === 'RESULT', null, { timeout: 20000 });
  await click(page, '#resultContinue');
  await page.waitForFunction(() => window.__olympics.screen === 'STANDINGS', null, { timeout: 12000 });
  const standings = await page.evaluate(() => window.__olympics.standings.length);
  await click(page, '#standingsContinue');
  await page.waitForFunction(() => ['HUB', 'FINAL'].includes(window.__olympics.screen), null, { timeout: 12000 });
  return { playing, standings, after: await screen(page) };
}

(async () => {
  const browser = await chromium.launch();
  console.log('Global Games — audit harness\n');

  /* ---- O1: the diagnostic surface exists and is LIVE --------------------- */
  {
    const { ctx, page } = await open(browser);
    const boot = await page.evaluate(() => {
      const o = window.__olympics;
      return { keys: Object.keys(o).sort(), screen: o.screen, day: o.day, idx: o.eventIndex, save: o.saveKeys, motion: o.motion, fixedDt: o.fixedDt };
    });
    const REQUIRED = ['athlete', 'day', 'energy', 'eventId', 'eventIndex', 'motion', 'records', 'saveKeys', 'schedule', 'screen', 'standings'];
    const missing = REQUIRED.filter(k => !boot.keys.includes(k));
    t('O1 the diagnostic surface exposes every field the audit needs',
      missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : boot.keys.join(', '));
    t('O1 it names the real save key', boot.save.save === 'mbm_global_games_world_stage_v4', `key ${boot.save.save}`);
    t('O1 it reports the fixed timestep the loop actually uses',
      Math.abs(boot.fixedDt - 1 / 120) < 1e-9, `${boot.fixedDt} (1/${Math.round(1 / boot.fixedDt)})`);
    /* LIVE, not a boot snapshot: drive the game and require the surface to move
       with it. A cached surface would keep reporting TITLE forever. */
    await startChampionship(page);
    const moved = await page.evaluate(() => ({ screen: window.__olympics.screen, len: window.__olympics.schedule.length, day: window.__olympics.day }));
    t('O1 the surface is live, not a boot snapshot',
      boot.screen === 'TITLE' && moved.screen === 'HUB',
      `screen ${boot.screen} -> ${moved.screen}, day ${boot.day} -> ${moved.day}`);
    t('O1 Ultimate Games really is the nine-event schedule', moved.len === 9, `${moved.len} events`);
    await ctx.close();
  }

  /* ---- O2 + O7 + O8: the whole journey, on both viewports --------------- */
  for (const vp of VIEWPORTS) {
    const { ctx, page, errors, remote } = await open(browser, { viewport: vp });
    await startChampionship(page);
    const days = [], overflow = [];
    for (let d = 0; d < 9; d++) {
      const r = await playDay(page);
      days.push(r.playing.id);
      overflow.push(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (r.after === 'FINAL') break;
    }
    const end = await screen(page);
    const final = await page.evaluate(() => ({ standings: window.__olympics.standings.length, records: Object.keys(window.__olympics.records).length }));
    t(`O2 [${vp.name}] all nine events are played through the real controls`,
      days.length === 9 && new Set(days).size === 9, `${days.length} days: ${days.join(', ')}`);
    t(`O2 [${vp.name}] the journey ends in the medal ceremony`, end === 'FINAL', `final screen ${end}`);
    t(`O2 [${vp.name}] the ceremony has a full field and recorded marks`,
      final.standings === 6 && final.records === 9, `${final.standings} teams · ${final.records} personal bests`);
    t(`O7 [${vp.name}] no horizontal overflow at any point in the journey`,
      overflow.every(x => x <= 0), `max ${Math.max(...overflow)}px`);
    t(`O8 [${vp.name}] console and page errors clean across the whole journey`,
      errors.length === 0, errors[0] || 'none');
    t(`O9 [${vp.name}] zero remote requests across the whole journey`,
      remote.length === 0, remote[0] || 'none');
    await ctx.close();
  }

  /* ---- O3: real keystrokes actually drive the simulation ---------------- *
     The journey above resolves events through the diagnostic surface, which
     proves the tournament plumbing and nothing about the engines. This sends
     real keys to two engines with DIFFERENT physics and requires the world to
     respond — otherwise every green above would be about menus.             */
  {
    /* EVERY ENGINE HERE OPENS ON A STARTER'S COUNTDOWN — 3.2s for the sprint,
       2.6s for the freestyle — and during it the update() returns early, so
       input does nothing except earn a false-start penalty. The first version
       of this gate fired all forty keystrokes inside that countdown, measured
       speed 0 -> 0, and reported it as the game ignoring input. The engines
       expose `started`, so the harness waits for the gun like a player does. */
    const cases = [
      { mode: 'ultimate', event: 'sprint', keys: ['KeyA', 'KeyD'], probe: 'speed' },
      { mode: 'ultimate', event: 'swimming', keys: ['Space'], probe: 'strokes' }
    ];
    for (const c of cases) {
      const { ctx, page } = await open(browser);
      await startChampionship(page, c.mode);
      /* walk to the event under test */
      let guard = 0;
      while (await page.evaluate(() => window.__olympics.schedule[window.__olympics.eventIndex]) !== c.event && guard++ < 9) {
        await playDay(page);
      }
      await click(page, '#eventBriefing');
      await page.waitForFunction(() => window.__olympics.screen === 'INTRO', null, { timeout: 12000 });
      await click(page, '#startEvent');
      await page.waitForFunction(() => window.__olympics.screen === 'PLAYING', null, { timeout: 12000 });
      const read = () => page.evaluate(p => {
        const ev = window.MBMGlobalGames.app.activeEvent;
        return { probe: ev ? Number(ev[p] || 0) : null, elapsed: ev ? ev.elapsed : null };
      }, c.probe);
      /* Reach the gun through the shipped fixed-step authority, not through
         wall-clock rendering. Hosted software-canvas runners can render below
         1fps; the app deliberately caps one rendered frame to 50ms, so a real
         3.2s countdown can then need more than a minute without saying
         anything about input. This pumps the SAME event.tick(FIXED_DT) path
         used by the app loop. It is bounded, proves it started from a real
         countdown, and records that setup itself did not raise the movement
         probe. The keyboard leg below remains real Playwright input. */
      const gun = await page.evaluate(probe => {
        const app = window.MBMGlobalGames.app;
        const ev = app && app.activeEvent;
        const dt = window.__olympics.fixedDt;
        const before = ev ? { started: ev.started, countdown: ev.countdown,
          probe: Number(ev[probe] || 0), elapsed: ev.elapsed } : null;
        let ticks = 0;
        while (ev && ev.started !== true && ticks < 1000) { ev.tick(dt); ticks++; }
        return { sameEvent: !!ev && ev === app.activeEvent, dt, ticks, before,
          after: ev ? { started: ev.started, countdown: ev.countdown,
            probe: Number(ev[probe] || 0), elapsed: ev.elapsed } : null };
      }, c.probe);
      t(`O3 [control] the ${c.event} starter uses the shipped fixed-step authority`,
        gun.sameEvent && gun.dt === 1 / 120 && gun.before?.started === false &&
          gun.after?.started === true && gun.ticks > 0 && gun.ticks < 1000,
        JSON.stringify(gun));
      t(`O3 [control] reaching the ${c.event} gun cannot create a movement pass`,
        gun.after?.probe === gun.before?.probe,
        `${c.probe} ${gun.before?.probe} -> ${gun.after?.probe} across ${gun.ticks} authority ticks`);
      await page.waitForFunction(() => {
        const ev = window.MBMGlobalGames.app.activeEvent;
        return !!ev && ev.started === true;
      }, null, { timeout: 30000 });
      /* CONTROL FIRST, AND THAT ORDER IS THE POINT. Sprint speed DECAYS every
         frame, so an idle wait taken after the tapping would show the probe
         falling and fail a "did not move" check for a reason that has nothing
         to do with input. Taken before, from a standing start, the control
         asks the question it means to ask: with the gun gone and no keys
         pressed, does the world move on its own? It must not. */
      const idleBefore = await read();
      await page.waitForTimeout(40 * 24);
      const idleAfter = await read();
      t(`O3 [control] the ${c.event} probe does not rise on its own`,
        idleAfter.probe <= idleBefore.probe,
        `${c.probe} ${idleBefore.probe} -> ${idleAfter.probe} across an equal idle wait after the gun`);

      const before = await read();
      await page.focus('#game');
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press(c.keys[i % c.keys.length]);
        await page.waitForTimeout(24);
      }
      const after = await read();
      t(`O3 real keystrokes move the ${c.event} simulation`,
        after.probe !== null && after.probe > before.probe,
        `${c.probe} ${before.probe} -> ${after.probe} over ${(after.elapsed || 0).toFixed(2)}s of play`);
      await ctx.close();
    }
  }

  /* ---- O4: pause, resume, restart --------------------------------------- */
  {
    const { ctx, page, errors } = await open(browser);
    await startChampionship(page);
    await playDay(page, { resolve: false });
    await click(page, '#pauseBtn');
    const paused = await page.evaluate(() => window.__olympics.paused);
    await click(page, '#resumeBtn');
    const resumed = await page.evaluate(() => window.__olympics.paused);
    t('O4 pause and resume both take effect', paused === true && resumed === false,
      `paused=${paused} then resumed=${!resumed}`);

    /* Restart must genuinely restart: a fresh event object with the clock back
       to zero, not merely a toast. Hosted software-canvas frames can advance
       less than 0.1 game-seconds during a 400ms wall-clock sleep, so establish
       the same >0.1 precondition through the event's shipped fixed-step
       authority, exactly as the O3 starter control does. */
    const beforeRestart = await page.evaluate(() => {
      const app = window.MBMGlobalGames.app;
      const event = app.activeEvent;
      const dt = window.__olympics.fixedDt;
      let ticks = 0;
      while (event && event.elapsed <= 0.1 && ticks < 120) { event.tick(dt); ticks++; }
      window.__mbmOlympicsRestartBefore = event;
      return { elapsed: event ? event.elapsed : null, ticks, dt, sameEvent: event === app.activeEvent };
    });
    t('O4 [control] restart setup uses the shipped fixed-step authority',
      beforeRestart.sameEvent && beforeRestart.dt === 1 / 120 && beforeRestart.ticks > 0 &&
        beforeRestart.ticks < 120 && beforeRestart.elapsed > 0.1,
      JSON.stringify(beforeRestart));
    await click(page, '#pauseBtn');
    await click(page, '#restartBtn');
    const afterRestart = await page.evaluate(() => ({
      elapsed: window.MBMGlobalGames.app.activeEvent.elapsed,
      fresh: window.MBMGlobalGames.app.activeEvent !== window.__mbmOlympicsRestartBefore,
      screen: window.__olympics.screen,
      paused: window.__olympics.paused
    }));
    t('O4 restart rewinds the event rather than just announcing it',
      beforeRestart.elapsed > 0.1 && afterRestart.fresh && afterRestart.elapsed < beforeRestart.elapsed,
      `fresh=${afterRestart.fresh}; elapsed ${beforeRestart.elapsed.toFixed(2)}s -> ${afterRestart.elapsed.toFixed(2)}s`);
    t('O4 restart leaves the game playing and unpaused',
      afterRestart.screen === 'PLAYING' && afterRestart.paused === false, `screen ${afterRestart.screen}`);
    t('O4 no errors through pause, resume and restart', errors.length === 0, errors[0] || 'none');
    await ctx.close();
  }

  /* ---- O5: save and reload ---------------------------------------------- */
  {
    const { ctx, page } = await open(browser);
    await startChampionship(page);
    for (let d = 0; d < 2; d++) await playDay(page);
    const before = await page.evaluate(() => ({ records: window.__olympics.records, key: window.__olympics.saveKeys }));
    t('O5 playing writes personal bests to the save key',
      before.key.present === true && Object.keys(before.records).length >= 2,
      `key present=${before.key.present}, ${Object.keys(before.records).length} records`);
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => !!window.__olympics && window.__olympics.screen !== null, null, { timeout: 20000 });
    const after = await page.evaluate(() => window.__olympics.records);
    t('O5 personal bests survive a reload',
      JSON.stringify(after) === JSON.stringify(before.records),
      `${Object.keys(after).length} records back, identical=${JSON.stringify(after) === JSON.stringify(before.records)}`);
    await ctx.close();
  }

  /* ---- O6: a corrupted save cannot break the game ----------------------- */
  {
    const hostiles = [
      ['not json', 'wat'],
      ['null', 'null'],
      ['array', '[1,2,3]'],
      ['records not object', '{"records":"nope"}'],
      ['records hostile values', '{"records":{"sprint":"abc","swimming":null}}'],
      ['profile wrong type', '{"profile":42}'],
      ['huge', JSON.stringify({ records: Object.fromEntries(Array.from({ length: 5000 }, (_, i) => ['k' + i, i])) })],
      ['prototype pollution attempt', '{"__proto__":{"pwned":true},"records":{}}']
    ];
    let survived = 0; const dead = [];
    for (const [label, blob] of hostiles) {
      const { ctx, page, errors } = await open(browser, {
        initFn: b => { try { localStorage.setItem('mbm_global_games_world_stage_v4', b); } catch (e) {} },
        initArg: blob
      }).catch(e => ({ ctx: null, why: String(e.message).slice(0, 50) }));
      if (!ctx) { dead.push(`${label} (never booted)`); continue; }
      const okBoot = await page.evaluate(() => {
        try {
          const o = window.__olympics;
          return o.screen === 'TITLE' && typeof o.records === 'object' && !('pwned' in {});
        } catch (e) { return false; }
      });
      if (okBoot && errors.length === 0) survived++; else dead.push(`${label}${errors[0] ? ' (' + errors[0].slice(0, 40) + ')' : ''}`);
      await ctx.close();
    }
    t('O6 every corrupted save degrades to a working title screen',
      survived === hostiles.length, `${survived}/${hostiles.length}${dead.length ? ' · failed: ' + dead.join(', ') : ''}`);
    /* CONTROL: prove the check can fail. A blob is not enough on its own — the
       instrument has to be shown catching a game that genuinely does not boot. */
    const broken = tamper('boot-break', [['function loadSave(){', 'function loadSave(){ throw new Error("selftest: loadSave is broken");']]);
    t('O6 [control] the boot-break tamper applied', broken.path !== null, broken.why || broken.path);
    if (broken.path) {
      const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const p2 = await ctx2.newPage();
      await p2.goto(broken.url, { waitUntil: 'commit' });
      await p2.waitForTimeout(1500);
      const bootedAnyway = await p2.evaluate(() => !!(window.__olympics && window.__olympics.screen === 'TITLE'));
      t('O6 [control] a game that cannot boot IS caught by this check',
        bootedAnyway === false, `broken copy reported a working title screen: ${bootedAnyway}`);
      await ctx2.close();
    }
  }

  /* ---- O9: network-blocked is identical, with a pristine-FAIL control ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const blocked = [];
    /* Block EVERYTHING that is not this file. If any part of the game needed
       the network, the journey below would visibly fail rather than quietly
       degrade. */
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith('http://127.0.0.1') || u.startsWith('file:')) return route.continue();
      blocked.push(u); return route.abort();
    });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 90)));
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForFunction(() => !!window.__olympics && window.__olympics.screen !== null, null, { timeout: 20000 });
    await startChampionship(page);
    let last = null;
    for (let d = 0; d < 9; d++) { const r = await playDay(page); last = r.after; if (last === 'FINAL') break; }
    t('O9 the full journey completes with the network blocked',
      last === 'FINAL' && errors.length === 0, `end ${last} · errors ${errors.length}`);
    t('O9 nothing was even attempted over the network', blocked.length === 0,
      blocked.length ? blocked[0] : 'zero requests to block');
    await ctx.close();

    /* PRISTINE-FAIL CONTROL: the blocker must be shown catching a game that
       DOES reach out, or "zero blocked" above is indistinguishable from a
       blocker that is not wired up. */
    const needy = tamper('needs-network', [
      ["window.MBMGlobalGames={version:VERSION", "try{fetch('https://example.invalid/telemetry')}catch(e){}\n window.MBMGlobalGames={version:VERSION"]
    ]);
    t('O9 [control] the network-needing tamper applied', needy.path !== null, needy.why || needy.path);
    if (needy.path) {
      const c3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const p3 = await c3.newPage();
      const caught = [];
      await c3.route('**/*', route => {
        const u = route.request().url();
        if (u.startsWith('file:')) return route.continue();
        caught.push(u); return route.abort();
      });
      await p3.goto(needy.url, { waitUntil: 'commit' });
      await p3.waitForTimeout(2000);
      t('O9 [control] a game that DOES reach out is caught by the same blocker',
        caught.length > 0, caught[0] || 'nothing caught — the blocker is not wired');
      await c3.close();
    }
  }

  /* ---- O10: the fixed timestep really is frame-rate independent ---------- *
     Real frames are far too coarse and too noisy to compare 30fps against
     144fps — the container renders at roughly 6-12fps under load, so both
     "rates" would be the same rate. So the clock is VIRTUAL: rAF and
     performance.now are replaced with a driver that advances by exactly
     1/fps, and identical scripted input is delivered at identical VIRTUAL
     times. Anything that differs afterwards is frame-rate dependence.       */
  const clockDriver = fps => `(() => {
    let now = 0; const step = 1000 / ${fps};
    performance.now = () => now;
    const queue = [];
    window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
    window.cancelAnimationFrame = () => {};
    /* One "frame" is exactly 1/fps of virtual time, whatever the container is
       actually managing to render. Draining the queue per frame mirrors the
       browser's own behaviour: callbacks registered DURING a frame run on the
       next one, not on this one. */
    window.__drive = (frames) => {
      for (let i = 0; i < frames; i++) {
        now += step;
        const batch = queue.splice(0, queue.length);
        for (const cb of batch) { try { cb(now); } catch (e) {} }
      }
      return now;
    };
    window.__virtualNow = () => now;
  })();`;
  {
    const engines = [
      { id: 'sprint', probe: 'speed', keys: ['KeyA', 'KeyD'], why: 'tap-alternation accumulation' },
      { id: 'javelin', probe: 'power', keys: ['KeyA', 'KeyD'], why: 'ballistic charge-and-release' }
    ];
    for (const eng of engines) {
      const runs = {};
      for (const fps of [30, 144]) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        await page.addInitScript(clockDriver(fps));
        await page.goto(BASE, { waitUntil: 'commit' });
        /* The virtual clock means nothing advances until we drive it, so boot
           has to be pumped rather than waited for. */
        await page.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 15000 });
        for (let i = 0; i < 40; i++) { await page.evaluate(() => window.__drive(8)); }
        await page.waitForFunction(() => !!window.__olympics, null, { timeout: 15000 });
        /* Skip the menus entirely for this gate: it is about the engine, and
           the menus are not on a virtual clock. */
        const state = await page.evaluate(async (id) => {
          const app = window.MBMGlobalGames.app;
          const drive = window.__drive;
          /* build a tournament directly, the same way the setup screen does */
          document.querySelector('.mbm-skip') && document.querySelector('.mbm-skip').click();
          drive(60);
          document.getElementById('newGamesBtn').click(); drive(10);
          document.querySelector('[data-mode="ultimate"]').click(); drive(10);
          document.getElementById('autoAttrs').click(); drive(10);
          document.getElementById('beginTournament').click(); drive(20);
          /* jump the schedule to the engine under test */
          const t = app.tournament;
          t.index = t.schedule.indexOf(id);
          document.getElementById('eventBriefing').click(); drive(20);
          document.getElementById('startEvent').click(); drive(20);
          return { started: window.__olympics.screen, id: window.__olympics.eventId };
        }, eng.id);
        /* Identical scripted input at identical VIRTUAL times. */
        const trace = await page.evaluate(({ keys, probe, fps }) => {
          const app = window.MBMGlobalGames.app;
          const drive = window.__drive;
          const samples = [];
          const fire = code => {
            for (const type of ['keydown', 'keyup'])
              window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.slice(-1).toLowerCase(), bubbles: true }));
          };
          /* 3 virtual seconds of play, a key every 100ms of VIRTUAL time.
             RELATIVE to the start of this loop — an earlier version compared
             __virtualNow() (absolute, and already several seconds in from
             pumping the boot) against 3000, so at 30fps the loop never ran a
             single iteration while at 144fps it ran fully. The two runs then
             differed by half a second and the gate reported the game as
             frame-rate dependent. It was the harness that was. */
          /* Compare the DELTA, never the absolute. ev.elapsed accumulates from
             the moment the event object was built, and the fixed number of
             frames pumped to walk the menus is worth 0.67s of virtual time at
             30fps and 0.14s at 144fps — a half-second head start that has
             nothing to do with the timestep. What this gate is actually asking
             is: across an identical window of virtual time, does the
             simulation advance by the same amount?

             COUNT FRAMES, DO NOT POLL THE CLOCK. Driving `while (now - mark <
             100)` looks rate-neutral and is not: at 144fps a frame is 6.944ms,
             so the loop overshoots to 104.2ms, while at 30fps three frames land
             on 100.0ms exactly. Thirty chunks of that quantisation error put
             67ms between the two runs and the gate reported the GAME as
             frame-rate dependent when the difference was entirely in how this
             harness had chosen to count. Frame counts derived from the step
             make both runs cover the same virtual span to the millisecond. */
          const step = 1000 / fps;
          const totalFrames = Math.round(3000 / step);
          const keyEvery = Math.max(1, Math.round(100 / step));
          const elapsed0 = app.activeEvent ? app.activeEvent.elapsed : 0;
          let k = 0;
          for (let f = 0; f < totalFrames; f++) {
            if (f % keyEvery === 0) fire(keys[k++ % keys.length]);
            drive(1);
            const ev = app.activeEvent;
            if (ev && f % keyEvery === 0) samples.push(Number((ev.elapsed || 0).toFixed(4)));
          }
          const ev = app.activeEvent;
          return { samples: samples.slice(-5),
                   elapsed: ev ? Number((ev.elapsed - elapsed0).toFixed(4)) : null,
                   probe: ev ? Number(Number(ev[probe] || 0).toFixed(4)) : null };
        }, { keys: eng.keys, probe: eng.probe, fps });
        runs[fps] = { ...state, ...trace };
        await ctx.close();
      }
      const a = runs[30], b = runs[144];
      t(`O10 [${eng.id}] the engine actually started under the virtual clock`,
        a.started === 'PLAYING' && b.started === 'PLAYING' && a.id === eng.id,
        `${a.id} at 30fps and ${b.id} at 144fps`);
      const drift = (a.elapsed !== null && b.elapsed !== null) ? Math.abs(a.elapsed - b.elapsed) : Infinity;
      t(`O10 [${eng.id}] simulated time matches across 30fps and 144fps (${eng.why})`,
        drift <= 0.02, `elapsed ${a.elapsed}s vs ${b.elapsed}s · drift ${drift.toFixed(4)}s`);
      t(`O10 [${eng.id}] the run was long enough to expose drift if there were any`,
        (a.elapsed || 0) > 2.5, `${a.elapsed}s of simulated play`);
    }
    /* CONTROL: a variable-timestep build MUST fail the same comparison, or the
       green above only says the two runs were both short. */
    const varStep = tamper('variable-timestep', [
      ['const ev=this.activeEvent;ev.tick(FIXED_DT);this.particles.update(FIXED_DT);this.input.endStep();this.accumulator-=FIXED_DT;steps++;',
       'const ev=this.activeEvent;ev.tick(dt);this.particles.update(dt);this.input.endStep();this.accumulator-=FIXED_DT;steps++;']
    ]);
    t('O10 [control] the variable-timestep tamper applied', varStep.path !== null, varStep.why || varStep.path);
    if (varStep.path) {
      const got = {};
      for (const fps of [30, 144]) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        await page.addInitScript(clockDriver(fps));
        await page.goto('file://' + varStep.path, { waitUntil: 'commit' });
        await page.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 15000 });
        for (let i = 0; i < 40; i++) await page.evaluate(() => window.__drive(8));
        await page.waitForFunction(() => !!window.__olympics, null, { timeout: 15000 });
        const el = await page.evaluate((fps) => {
          const app = window.MBMGlobalGames.app, drive = window.__drive;
          document.querySelector('.mbm-skip') && document.querySelector('.mbm-skip').click(); drive(60);
          document.getElementById('newGamesBtn').click(); drive(10);
          document.querySelector('[data-mode="ultimate"]').click(); drive(10);
          document.getElementById('autoAttrs').click(); drive(10);
          document.getElementById('beginTournament').click(); drive(20);
          app.tournament.index = app.tournament.schedule.indexOf('sprint');
          document.getElementById('eventBriefing').click(); drive(20);
          document.getElementById('startEvent').click(); drive(20);
          /* Same instrument as the gate above — delta, and the same derived
             frame count — so the control is comparable rather than merely
             alarming. */
          const elapsed0 = app.activeEvent ? app.activeEvent.elapsed : 0;
          const totalFrames = Math.round(3000 / (1000 / fps));
          for (let f = 0; f < totalFrames; f++) drive(1);
          return app.activeEvent ? Number((app.activeEvent.elapsed - elapsed0).toFixed(4)) : null;
        }, fps);
        got[fps] = el;
        await ctx.close();
      }
      const d = (got[30] !== null && got[144] !== null) ? Math.abs(got[30] - got[144]) : Infinity;
      t('O10 [control] a variable-timestep build IS caught by the same comparison',
        d > 0.02, `elapsed ${got[30]}s vs ${got[144]}s · drift ${d === Infinity ? 'n/a' : d.toFixed(4) + 's'}`);
    }
  }

  /* ---- O11: rendered touch targets are at least 44px -------------------- *
     RENDERED, not declared. A CSS min-height means nothing if a flex parent
     compresses it, so this measures getBoundingClientRect on the real nodes,
     and it POLLS: the touch bar is built per event, so sampling once catches
     an empty container and calls it a pass.                                */
  {
    for (const vp of VIEWPORTS) {
      const { ctx, page } = await open(browser, { viewport: vp });
      await startChampionship(page);
      await playDay(page, { resolve: false });
      const measured = await page.evaluate(() => new Promise(res => {
        const t0 = performance.now();
        (function poll() {
          const nodes = [...document.querySelectorAll('#touch button, #hud button, .mbm-skip')];
          if (nodes.length) {
            const bad = nodes.map(n => {
              const r = n.getBoundingClientRect();
              return { label: (n.textContent || n.className || '?').trim().slice(0, 14), w: Math.round(r.width), h: Math.round(r.height) };
            }).filter(x => (x.w > 0 || x.h > 0) && (x.w < 44 || x.h < 44));
            return res({ count: nodes.length, bad });
          }
          if (performance.now() - t0 > 6000) return res({ count: 0, bad: [] });
          requestAnimationFrame(poll);
        })();
      }));
      t(`O11 [${vp.name}] touch controls actually rendered to measure`,
        measured.count > 0, `${measured.count} controls found`);
      t(`O11 [${vp.name}] every rendered control is at least 44x44`,
        measured.count > 0 && measured.bad.length === 0,
        measured.bad.length ? measured.bad.map(b => `${b.label} ${b.w}x${b.h}`).join(', ') : `${measured.count} controls all >= 44px`);
      await ctx.close();
    }
  }

  /* ---- O12: reduced motion, gated BY NAME, in both directions ----------- */
  {
    for (const rm of ['no-preference', 'reduce']) {
      const { ctx, page } = await open(browser, { rm });
      const m = await page.evaluate(() => window.__olympics.motion);
      const expect = rm === 'reduce';
      t(`O12 [rm=${rm}] the OS preference reaches the game`,
        m.osReduced === expect, `osReduced=${m.osReduced}`);
      t(`O12 [rm=${rm}] every named family agrees with it`,
        m.families.length === 4 && m.families.every(f => m.allowed[f] === !expect),
        m.families.map(f => `${f}=${m.allowed[f]}`).join(' · '));
      /* Effect suppression, measured on the real particle system rather than
         inferred from the flag. */
      await startChampionship(page);
      await playDay(page, { resolve: false });
      await page.evaluate(() => window.MBMGlobalGames.app.particles.confetti(200));
      await page.evaluate(() => window.MBMGlobalGames.app.particles.burst(100, 100, '#fff', 40));
      const live = await page.evaluate(() => window.__olympics.particles);
      t(`O12 [rm=${rm}] ceremonyConfetti and particleBurst emit ${expect ? 'nothing' : 'particles'}`,
        expect ? live === 0 : live > 0, `${live} live particles after a 200-piece confetti and a 40-piece burst`);
      await ctx.close();
    }
    /* The live listener: flipping the OS preference mid-session must take
       effect without a reload. This is the OS-as-floor promise. */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: 'commit' });
      await page.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });
      const before = await page.evaluate(() => window.__olympics.motion.osReduced);
      /* emulateMedia lives on the PAGE, not the context. */
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => window.__olympics.motion.osReduced);
      t('O12 the live listener applies a mid-session change without a reload',
        before === false && after === true, `osReduced ${before} -> ${after}`);
      await ctx.close();
    }
    /* CONTROL: a build whose confetti ignores the gate must be CAUGHT. */
    const ungated = tamper('ungated-confetti', [
      ["  if(!Motion.allows('ceremonyConfetti'))return;", '']
    ]);
    t('O12 [control] the ungated-confetti tamper applied', ungated.path !== null, ungated.why || ungated.path);
    if (ungated.path) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('file://' + ungated.path, { waitUntil: 'commit' });
      await page.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });
      await page.evaluate(() => window.MBMGlobalGames.app.particles.confetti(200));
      const leaked = await page.evaluate(() => window.__olympics.particles);
      t('O12 [control] confetti that ignores reduced motion IS caught',
        leaked > 0, `${leaked} particles emitted under reduced motion`);
      await ctx.close();
    }
  }

  /* ---- O13: the announce channel says what the screen says --------------- */
  {
    const { ctx, page } = await open(browser);
    /* Collect from the mutation RECORDS, not by reading the element. The live
       region is last-write-wins and the callbacks batch, so reading the node
       inside the callback shows only whatever was written last in that tick. */
    await page.addInitScript(() => {
      window.__said = [];
      addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('aria');
        if (!el) return;
        new MutationObserver(recs => {
          for (const r of recs) {
            for (const n of r.addedNodes) if (n.nodeValue) window.__said.push(n.nodeValue);
            if (r.type === 'characterData' && r.target.nodeValue) window.__said.push(r.target.nodeValue);
          }
        }).observe(el, { childList: true, characterData: true, subtree: true });
      });
    });
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => !!window.__olympics && !!window.__said, null, { timeout: 20000 });
    await startChampionship(page);
    let last = null;
    for (let d = 0; d < 9; d++) { const r = await playDay(page); last = r.after; if (last === 'FINAL') break; }
    /* WAIT FOR THE CHANNEL TO SETTLE, and do it without begging the question.
       announce() clears the region and writes the text on the NEXT animation
       frame, so reaching the FINAL screen and reading immediately catches the
       ceremony's announcement in flight — the first run of this gate reported
       the podium as never spoken when it was simply not spoken YET. Polling
       for "no new announcement for 600ms" waits for quiet rather than waiting
       for the specific string the assertion is about, which would guarantee
       its own green. */
    await page.evaluate(() => new Promise(res => {
      let seen = window.__said.length, quiet = 0;
      const iv = setInterval(() => {
        if (window.__said.length !== seen) { seen = window.__said.length; quiet = 0; }
        else if ((quiet += 100) >= 600) { clearInterval(iv); res(); }
      }, 100);
      setTimeout(() => { clearInterval(iv); res(); }, 8000);
    }));
    const said = await page.evaluate(() => window.__said.slice());
    const joined = said.join(' || ');
    t('O13 the announce channel carried the journey at all',
      said.length >= 9, `${said.length} announcements across nine events`);
    t('O13 medals are announced', /gold|silver|bronze|medal/i.test(joined),
      (said.find(s => /medal|gold|silver|bronze/i.test(s)) || 'none').slice(0, 72));
    t('O13 standings are announced', /medal standings/i.test(joined),
      (said.find(s => /medal standings/i.test(s)) || 'none').slice(0, 72));
    t('O13 personal bests are announced', /personal best/i.test(joined),
      (said.find(s => /personal best/i.test(s)) || 'none').slice(0, 72));
    t('O13 championship points are announced', /championship points/i.test(joined),
      (said.find(s => /championship points/i.test(s)) || 'none').slice(0, 72));
    t('O13 the ceremony announces the podium', /podium/i.test(joined),
      (said.find(s => /podium/i.test(s)) || 'none').slice(0, 72));
    /* CONTROL: these regexes must be capable of missing. */
    t('O13 [control] the matcher does not match something absent',
      !/velodrome/i.test(joined), 'a term the game never says is correctly not found');
    await ctx.close();
  }

  await browser.close();
  console.log(red === 0 ? '\nGLOBAL GAMES AUDIT VERIFIED' : `\n${red} FAILED`);
  process.exit(red === 0 ? 0 : 1);
})().catch(e => { console.error('threw:', e); process.exit(1); });
