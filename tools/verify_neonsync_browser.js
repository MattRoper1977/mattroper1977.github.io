#!/usr/bin/env node
'use strict';
/**
 * Neon Sync — rendered browser contract.
 *
 * Identity is derived from the source-harness pin, never duplicated here. The
 * v1.0 rendered routes remain intact. When the v1.1 sentinel is present, three
 * additional real-browser routes activate: Volt select/play, Escort reach/push,
 * and Rhythm Reflex open/exit. Their predicates carry synthetic positive and
 * tamper controls so the armed extension is proven non-vacuous before content.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.NS_GAME || 'neonsync/index.html';
const GAME_PATH = path.join(ROOT, GAME);
const SOURCE_HARNESS = path.join(ROOT, 'tools', 'verify_neonsync.js');
const sourceHarness = fs.readFileSync(SOURCE_HARNESS, 'utf8');
const sourcePin = /const\s+(?:SOURCE_SHA256|DELIVERED_SHA)\s*=\s*['"]([0-9a-f]{64})['"]/.exec(sourceHarness);
if (!sourcePin) throw new Error('source-harness game hash pin missing');
const EXPECT_SHA = sourcePin[1];
const GAME_HTML = fs.readFileSync(GAME_PATH, 'utf8');
const IS_V11 = /neonsync-v11-2026-08-05/.test(GAME_HTML);

let pass = 0, fail = 0;
const rows = [];
function ok(name, cond, detail) {
  rows.push({ name, ok: !!cond, detail: detail || '' });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  cond ? pass++ : fail++;
}

// Sibling saves seeded before boot; none may move. Derived from the estate's
// real key families, not invented.
const SIBLINGS = {
  'apexkick.v1': '{"best":12}',
  'mbm_apexpool_progress': '{"frames":7}',
  'mbm_apexgolf_progress': '{"holes":9}',
  'mbm_apextennis_progress': '{"sets":2}',
  'mbm_biopunkhive_save': '{"mutagens":3}',
  'voxelfrontier.world.v2': '{"seed":7}',
};

const voltProbe = v => !!(v && v.selected === 'volt' && v.player === 'volt' && v.running);
const escortProbe = v => !!(v && v.mode === 'escort' && v.reachable && v.after > v.before + 0.01);
const cabinetProbe = v => !!(v && v.opened && v.exited && v.matchUnchanged);
(function proveV11ProbesCanFail() {
  const positive = voltProbe({ selected: 'volt', player: 'volt', running: true })
    && escortProbe({ mode: 'escort', reachable: true, before: 0, after: 1 })
    && cabinetProbe({ opened: true, exited: true, matchUnchanged: true });
  const tamperRejected = !voltProbe({ selected: 'zest', player: 'volt', running: true })
    && !escortProbe({ mode: 'escort', reachable: true, before: 1, after: 1 })
    && !cabinetProbe({ opened: true, exited: false, matchUnchanged: true });
  if (!positive || !tamperRejected) throw new Error('v1.1 browser probe controls failed');
  console.log('V1.1 BROWSER PROBE POSITIVE CONTROL FIRED — Volt, Escort and cabinet predicates accept truth and reject tamper');
})();

(async () => {
  const server = http.createServer((rq, rs) => {
    let p = path.join(ROOT, decodeURIComponent(new URL(rq.url, 'http://x').pathname));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { rs.writeHead(404); rs.end('nf'); return; }
    const e = path.extname(p);
    const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' }[e] || 'application/octet-stream';
    rs.writeHead(200, { 'content-type': t, 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(rs);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/${GAME}`;

  // ---- identity, restated here so the browser run is anchored to the artefact
  const crypto = require('crypto');
  const bytes = fs.readFileSync(GAME_PATH);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  console.log('\n== N0 — artefact identity ==');
  ok('under-250-kib', bytes.length <= 250 * 1024, `${bytes.length} bytes`);
  ok('sha256-matches-source-harness-pin', sha === EXPECT_SHA, `${sha} pinned ${EXPECT_SHA}`);

  const browser = await chromium.launch({ headless: true });

  // ---------------------------------------------------------------- desktop
  console.log('\n== N1 — boot, hero select, a played point, post-match ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errs = [], reqs = [];
    page.on('pageerror', e => errs.push('page: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('request', r => { const u = r.url(); if (!/^(data|blob|about)/.test(u) && !u.startsWith(base.replace(/\/[^/]*$/, ''))) reqs.push(u); });
    await page.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, SIBLINGS);

    const resp = await page.goto(base, { waitUntil: 'load' });
    ok('http-200', resp && resp.status() === 200, String(resp && resp.status()));
    await page.waitForTimeout(2000);

    ok('boot-title-visible', await page.locator('.logo').first().isVisible().catch(() => false), 'NEON SYNC title');
    ok('test-hook-exposed', await page.evaluate(() => !!window.__NEON_SYNC_TEST__));
    ok('no-external-requests', reqs.length === 0, reqs.slice(0, 3).join(', ') || 'none');

    // hero select
    await page.locator('#heroCard').click();
    await page.waitForTimeout(500);
    const heroes = await page.evaluate(() => ({
      grid: document.querySelectorAll('.hero-grid .card, .hero-grid button, .hero-grid > *').length,
      names: Object.keys(window.__NEON_SYNC_TEST__.G ? (window.NS ? window.NS.HEROES : {}) : {}),
    }));
    ok('hero-select-renders', heroes.grid >= 3, `${heroes.grid} hero entries`);

    // a played point: start a match and advance real time
    const played = await page.evaluate(async () => {
      const T = window.__NEON_SYNC_TEST__;
      T.startMatch();
      await new Promise(r => setTimeout(r, 2500));
      const G = T.G;
      return {
        running: !!G.running || !!G.world,
        units: G.world ? G.world.units.length : 0,
        elapsed: G.world ? G.world.time : 0,
        score: (G.score ? JSON.stringify(G.score) : null),
        hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      };
    });
    ok('match-starts-and-runs', played.units > 0 && played.hudVisible, `${played.units} units, hud visible, t=${played.elapsed}`);

    // the match clock lives at G.world.time, not G.time
    const advanced = await page.evaluate(async () => {
      const T = window.__NEON_SYNC_TEST__, before = T.G.world ? T.G.world.time : -1;
      await new Promise(r => setTimeout(r, 1500));
      return { before, after: T.G.world ? T.G.world.time : -1 };
    });
    ok('point-is-played-time-advances', advanced.after > advanced.before, `world.time ${advanced.before.toFixed(2)}s -> ${advanced.after.toFixed(2)}s`);

    ok('zero-page-errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');

    // storage isolation after a real boot + play
    const store = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const moved = Object.keys(SIBLINGS).filter(k => store[k] !== SIBLINGS[k]);
    ok('siblings-untouched', moved.length === 0, moved.join(', ') || '6/6 unchanged');
    const foreign = Object.keys(store).filter(k => !(k in SIBLINGS) && !/^mbm_neonsync_/.test(k));
    ok('writes-only-mbm_neonsync_', foreign.length === 0, foreign.join(', ') || 'none');
    await ctx.close();
  }

  // ---------------------------------------------------------- post-match card
  console.log('\n== N2 — post-match card ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    const post = await page.evaluate(async () => {
      const T = window.__NEON_SYNC_TEST__;
      T.startMatch();
      await new Promise(r => setTimeout(r, 800));
      // Reach the card the way the GAME reaches it. The loop calls
      // finishMatch() when world.winner stops being null, so set the game's own
      // end signal and let its own loop consume it. Calling showPost() directly
      // would prove the card renders, not that the game can arrive at it.
      if (T.G.world) T.G.world.winner = 0;
      await new Promise(r => setTimeout(r, 2500));
      const txt = document.body.innerText;
      return {
        synergyShown: /synergy/i.test(txt),
        hasRematch: !!document.getElementById('rematch'),
        hasHome: !!document.getElementById('home'),
        text: txt.replace(/\s+/g, ' ').slice(0, 160),
      };
    });
    ok('post-match-card-reached', post.synergyShown && post.hasRematch, post.text);
    await ctx.close();
  }

  // ------------------------------------------------- touch joystick at 360x640
  console.log('\n== N3 — touch joystick at 360x640 (this game\'s B11) ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.__NEON_SYNC_TEST__.startMatch());
    await page.waitForTimeout(900);

    const geo = await page.evaluate(() => {
      const s = document.getElementById('stick'), k = document.getElementById('knob'), m = document.getElementById('mobileControls');
      if (!s) return null;
      const r = s.getBoundingClientRect(), mc = m ? getComputedStyle(m) : null;
      return {
        stick: [Math.round(r.width), Math.round(r.height)],
        visible: r.width > 0 && r.height > 0 && (!mc || mc.display !== 'none'),
        centre: [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)],
        knob: !!k,
        inViewport: r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
      };
    });
    ok('joystick-present-and-visible', !!geo && geo.visible && geo.knob, geo ? `${geo.stick[0]}x${geo.stick[1]} at ${geo.centre}` : 'absent');
    ok('joystick-at-least-44px', !!geo && geo.stick[0] >= 44 && geo.stick[1] >= 44, geo ? geo.stick.join('x') : 'n/a');
    ok('joystick-inside-viewport', !!geo && geo.inViewport, 'not clipped at 360x640');

    // a thumb drag must move the player
    const moved = await page.evaluate(async () => {
      const T = window.__NEON_SYNC_TEST__, G = T.G;
      const me = G.world && G.world.units.find(u => !u.bot && u.team === 0);
      if (!me) return { err: 'no player unit' };
      return { x0: me.x, y0: me.y };
    });
    if (!moved.err) {
      const s = geo.centre;
      await page.touchscreen.tap(s[0], s[1]);
      await page.mouse.move(s[0], s[1]);
      await page.mouse.down();
      await page.mouse.move(s[0] + 40, s[1] - 40, { steps: 10 });
      await page.waitForTimeout(900);
      await page.mouse.up();
      const after = await page.evaluate(() => {
        const G = window.__NEON_SYNC_TEST__.G;
        const me = G.world && G.world.units.find(u => !u.bot && u.team === 0);
        return me ? { x: me.x, y: me.y } : null;
      });
      const d = after ? Math.hypot(after.x - moved.x0, after.y - moved.y0) : 0;
      ok('joystick-drag-moves-player', d > 0.5, `moved ${d.toFixed(2)} world units`);
    } else {
      ok('joystick-drag-moves-player', false, moved.err);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    ok('no-horizontal-overflow-360', !overflow);
    await ctx.close();
  }

  // ------------------------------------------------------ reduced-motion boot
  console.log('\n== N4 — reduced-motion boot ==');
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const rm = await page.evaluate(() => ({
      matched: matchMedia('(prefers-reduced-motion: reduce)').matches,
      titleVisible: !!document.querySelector('.logo') && document.querySelector('.logo').getBoundingClientRect().height > 0,
      bodyText: document.body.innerText.replace(/\s+/g, ' ').length,
    }));
    ok('reduced-motion-media-matched', rm.matched);
    ok('reduced-motion-content-still-visible', rm.titleVisible && rm.bodyText > 40, `${rm.bodyText} chars of text`);
    ok('reduced-motion-zero-errors', errs.length === 0, errs.slice(0, 2).join(' | ') || 'none');
    await ctx.close();
  }

  // ------------------------------------------- v1.1 activated browser routes
  if (IS_V11) {
    console.log('\n== N5 — v1.1 Volt, Escort Rush and Rhythm Reflex ==');

    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      await page.locator('#heroCard').click();
      await page.locator('[data-hero="volt"]').click();
      await page.locator('#play').click();
      await page.waitForTimeout(900);
      const v = await page.evaluate(() => {
        const T = window.__NEON_SYNC_TEST__, G = T.G;
        const me = G.world && G.world.units.find(u => !u.bot && u.team === 0);
        return { selected: G.playerHero, player: me && me.hero, running: !!G.running };
      });
      ok('volt-selectable-and-playable', voltProbe(v), JSON.stringify(v));
      await ctx.close();
    }

    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      await page.locator('#escortCard').click();
      const reachable = await page.locator('#sideAttack').isVisible().catch(() => false);
      await page.locator('#sideAttack').click();
      await page.waitForTimeout(500);
      const before = await page.evaluate(reachable => {
        const T = window.__NEON_SYNC_TEST__, w = T.G.world;
        if (!w || w.mode !== 'escort' || !w.payload) return { mode: w && w.mode, reachable, before: 0 };
        const p = w.payload;
        for (const u of w.units) {
          if (!u.alive) continue;
          if (u.team === w.attackTeam) { u.x = p.x - 8; u.y = p.y; }
          else { u.x = 40; u.y = 40; }
        }
        return { mode: w.mode, reachable, before: p.progress };
      }, reachable);
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => {
        const w = window.__NEON_SYNC_TEST__.G.world;
        return w && w.payload ? w.payload.progress : 0;
      });
      const e = { mode: before.mode, reachable: before.reachable, before: before.before, after };
      ok('escort-reachable-and-float-moves', escortProbe(e), JSON.stringify(e));
      await ctx.close();
    }

    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto(base, { waitUntil: 'load' });
      await page.waitForTimeout(900);
      const before = await page.evaluate(() => {
        const G = window.__NEON_SYNC_TEST__.G;
        return JSON.stringify({ running: G.running, world: G.world && G.world.mode, playerHero: G.playerHero });
      });
      await page.locator('#arcadeCard').click();
      const opened = await page.locator('#rhythmCabinet').isVisible().catch(() => false);
      await page.locator('#rhythmExit').click();
      await page.waitForTimeout(300);
      const state = await page.evaluate(before => {
        const G = window.__NEON_SYNC_TEST__.G;
        const after = JSON.stringify({ running: G.running, world: G.world && G.world.mode, playerHero: G.playerHero });
        return { exited: !!document.querySelector('.logo') && !document.getElementById('rhythmCabinet'), matchUnchanged: before === after };
      }, before);
      const r = { opened, exited: state.exited, matchUnchanged: state.matchUnchanged };
      ok('cabinet-opens-and-exits-clean', cabinetProbe(r), JSON.stringify(r));
      await ctx.close();
    }
  } else {
    console.log('\n== N5 — v1.1 routes ARMED; sentinel absent on this pre-content tree ==');
  }

  await browser.close();
  server.close();

  console.log('\n' + '='.repeat(66));
  console.log(fail ? `${pass} passed, ${fail} FAILED` : `ALL ${pass} NEON SYNC BROWSER GATES PASSED`);
  console.log('='.repeat(66));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
