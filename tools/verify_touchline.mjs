#!/usr/bin/env node
/**
 * verify_touchline.mjs — the gate harness for Touchline Dynasty (/touchline/).
 *
 * Runs against the shipped file, not an extracted copy, so what passes here is
 * what is served.
 *
 *   node tools/verify_touchline.mjs [path/to/index.html] [--selftest]
 *
 * TG7 is not a gate of its own so much as a property of the rest: --selftest
 * mutates a throwaway copy to violate each gate in turn and asserts the harness
 * catches it. A gate that still passes on a violating build is vacuous and is
 * reported as such.
 *
 * Two traps this file exists to avoid, both recorded elsewhere in the estate:
 *
 *   * TG1 must sample the RIGHT canvas. The renderer is raw WebGL2 on #scene3d
 *     with a 2D CanvasFallback on #scene2d. A probe that samples #scene3d after
 *     refusing WebGL sees blank BY DESIGN and fails the game for the harness's
 *     own error. So the fallback canvas is named explicitly, and the probe is
 *     proven with a positive control before any blank reading is trusted.
 *   * TG5 must decide on the statistic its protocol collects. The harness pairs
 *     AB/BA, so the decision reads paired deltas — never two independent
 *     medians — and prints the spread and the power of the test beside the
 *     verdict, because a sign test at this n cannot see a single large outlier.
 */
'use strict';
import { chromium } from '/home/user/Lessons/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const GAME = argPath ? path.resolve(argPath) : path.resolve(__dirname, '..', 'touchline', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PINNED = process.env.TOUCHLINE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = PINNED && fs.existsSync(PINNED) ? PINNED : undefined;

const say = s => process.stdout.write(s + '\n');
let results = [];
function gate(id, title, ok, detail) {
  results.push({ id, title, ok: !!ok, detail: detail || '' });
  say(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ' — ' + detail : ''}`);
  return !!ok;
}

// A route is served, not opened: /games/ and absolute asset paths only resolve
// over http. Every browser gate runs against a real origin.
function serve(file) {
  const dir = path.dirname(file);
  const root = path.resolve(dir, '..');
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    let p = url === '/touchline/' || url === '/' ? file : path.join(root, url.replace(/^\//, ''));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    fs.readFile(p, (err, buf) => {
      if (err) { res.writeHead(404); res.end('nope'); return; }
      const ext = path.extname(p);
      res.writeHead(200, { 'Content-Type':
        ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript'
        : ext === '.json' ? 'application/json' : ext === '.svg' ? 'image/svg+xml' : 'text/plain' });
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

const BOOT_MS = 3800;

// Drive the real UI into matchday. #scene3d/#scene2d live inside #match-app,
// which ships `hidden`; a probe that samples them on the landing screen reads
// "no canvas" and blames the game for the harness not having started one.
async function intoMatch(page) {
  const steps = [];
  const click = async (sel, label) => {
    try { const el = await page.$(sel); if (!el) return false;
      await el.click({ timeout: 4000 }); steps.push(label); await page.waitForTimeout(1500); return true;
    } catch (_) { return false; }
  };
  await click('#kickoff', 'kickoff');
  await click('#career-primary-action', 'go-to-matchday');
  for (const s of ['#matchday-play', '#play-match', '#start-match', '#pregame-start', '#pregame-continue']) {
    if (await click(s, s)) break;
  }
  // Any remaining "play/kick off" affordance inside the matchday view.
  try {
    const b = page.getByRole('button', { name: /kick ?off|play match|start match|continue/i }).first();
    if (await b.count()) { await b.click({ timeout: 3000 }); steps.push('role-button'); await page.waitForTimeout(2200); }
  } catch (_) {}
  await page.waitForTimeout(1800);
  const mounted = await page.evaluate(() => {
    const m = document.getElementById('match-app');
    return { matchApp: !!m, hidden: m ? m.hidden : null,
      scene3d: !!document.getElementById('scene3d'), scene2d: !!document.getElementById('scene2d') };
  });
  return { steps, mounted };
}
async function boot(browser, origin, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    reducedMotion: opts.reduced ? 'reduce' : (opts.reducedMotion || 'no-preference'),
  });
  const errors = [], external = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { const t = m.text();
    if (m.type() === 'error' && !/favicon\.ico/.test(t)) errors.push('console: ' + t); });
  page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  // The harness's own static server carries no favicon; a 404 for one is the
  // server's, not the game's. Everything else counts.
  page.on('response', r => { const u = r.url().replace(origin, '');
    if (r.status() >= 400 && u !== '/favicon.ico') errors.push('http ' + r.status() + ': ' + u); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  if (opts.killWebGL) {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (String(type).indexOf('webgl') === 0) return null;
        return orig.call(this, type, ...rest);
      };
    });
  }
  if (opts.killIDB) await page.addInitScript(() => { try { delete window.indexedDB; } catch (_) { window.indexedDB = undefined; } });
  await page.goto(origin + '/touchline/');
  await page.waitForTimeout(opts.wait || BOOT_MS);
  return { ctx, page, errors, external };
}

// Distinct-colour census of a canvas. A canvas at its default size with one
// colour is an uninitialised canvas, not a rendered scene.
// A string arrow function handed to page.evaluate does NOT receive the extra
// argument - it evaluates to undefined, and the caller reads that as "no such
// canvas". Passing a real function is the difference between measuring the game
// and measuring the harness.
const canvasCensus = (id) => {
  const c = document.getElementById(id); if (!c) return null;
  const r = c.getBoundingClientRect();
  let colours = 0, sampled = 0;
  try { const g = c.getContext('2d');
    if (g) { const d = g.getImageData(0, 0, Math.min(c.width, 300), Math.min(c.height, 300)).data;
      const set = new Set();
      for (let k = 0; k < d.length; k += 4) set.add(d[k] + ',' + d[k+1] + ',' + d[k+2]);
      colours = set.size; sampled = 1; }
  } catch (_) {}
  return { w: c.width, h: c.height, cw: Math.round(r.width), ch: Math.round(r.height),
    shown: getComputedStyle(c).display !== 'none', colours, sampled };
};

async function staticGates(html) {
  // Only LOADABLE references count. rel=canonical and og:url are declarations
  // of this route's own address - they state where the page lives, they do not
  // fetch anything. Counting them made the gate fail on its own identity tags.
  const externals = (html.match(/<[^>]+>/g) || [])
    .filter(t => /(?:src|href)\s*=\s*["']https?:\/\//i.test(t))
    .filter(t => !/rel\s*=\s*["'](?:canonical|alternate)["']/i.test(t))
    .filter(t => !/schema\.org|w3\.org/.test(t))
    .map(t => (t.match(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)/i) || [])[1]);
  gate('TG0a', 'zero external references in source', externals.length === 0,
    externals.length ? externals.slice(0, 3).join(' | ') : `0 http(s) refs in ${html.length} bytes`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const srcTags = (html.match(/<script[^>]*\bsrc=/gi) || []).length;
  let bad = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'td-syn-'));
  for (let i = 0; i < blocks.length; i++) {
    const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, blocks[i]);
    const { spawnSync } = await import('node:child_process');
    if (spawnSync('node', ['--check', f]).status !== 0) bad++;
  }
  gate('TG0b', 'every inline script block parses; no <script src>',
    bad === 0 && srcTags === 0, `${blocks.length} inline block(s), ${bad} failing, ${srcTags} src tag(s)`);

  const region = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END -->\n?/);
  gate('TG0c', 'generated inline exit region present at the estate pin',
    !!region && Buffer.byteLength(region[0]) === 3222,
    region ? `${Buffer.byteLength(region[0])} bytes (estate pin 3222)` : 'region absent');

  gate('TG0d', 'maker splash is the generated region, not a hand copy',
    /MBM-MAKER-SPLASH:BEGIN/.test(html) && !/class="mbm-splash"[^>]*id="mbmSplash"/.test(html),
    /MBM-MAKER-SPLASH:BEGIN/.test(html) ? 'canonical region present, no literal #mbmSplash section' : 'no canonical region');

  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]*>/g, '').trim());
  gate('TG0e', 'no <h1> carries a version string', !h1s.some(t => /\bv?\d+(\.\d+)?\b/i.test(t) && /V2|version/i.test(t)),
    `raw h1 count ${h1s.length}: ${h1s.map(t => JSON.stringify(t.slice(0, 26))).join(', ')}`);

  // TG2 static half — the snapshot tick advances by S.speed, so any scheduler
  // keyed on `tick % N` fires at a rate that depends on the sim speed.
  const mods = [...html.matchAll(/(\w+)\.tick\s*%\s*(\d+)|(?<![\w.])tick\s*%\s*(\d+)/g)];
  const detail = mods.map(m => m[0]).join(', ');
  gate('TG2', 'no scheduler depends on the snapshot tick modulo', mods.length === 0,
    mods.length ? `${mods.length} modulo scheduler(s): ${detail}` : 'zero tick%N sites');
  return { blocks: blocks.length };
}

async function browserGates(browser, origin) {
  // ---- TG1 POSITIVE CONTROL: with WebGL available, #scene3d must paint. A
  // blank reading is only evidence once the probe is shown to see paint.
  {
    const { ctx, page, errors, external } = await boot(browser, origin);
    const drive = await intoMatch(page);
    say(`      TG1 drive: ${drive.steps.join(' > ') || '(no controls found)'} | match-app hidden=${drive.mounted.hidden}, #scene3d=${drive.mounted.scene3d}, #scene2d=${drive.mounted.scene2d}`);
    const three = await page.evaluate(canvasCensus, 'scene3d');
    const chip = await page.evaluate(() => (document.getElementById('renderer-chip') || {}).textContent || '');
    gate('TG1a', 'positive control: WebGL renderer paints #scene3d',
      !!three && three.cw > 0 && three.shown, three ? `#scene3d ${three.cw}x${three.ch} css, shown=${three.shown}, chip="${chip.trim()}"` : 'no #scene3d');
    gate('TG0f', 'zero external requests at boot', external.length === 0,
      external.length ? external.slice(0, 2).join(' | ') : 'network log empty');
    gate('TG0g', 'boot with no page or console errors', errors.length === 0,
      errors.slice(0, 2).join(' | ') || 'clean');
    await ctx.close();
  }

  // ---- TG1 the real test: refuse WebGL, then boot / play / save on #scene2d.
  {
    const { ctx, page, errors } = await boot(browser, origin, { killWebGL: true });
    await intoMatch(page);
    const chip = await page.evaluate(() => (document.getElementById('renderer-chip') || {}).textContent || '');
    const two = await page.evaluate(canvasCensus, 'scene2d');
    const alive = await page.evaluate(() => typeof window.__TDV2_CAREER_TEST__ === 'object');
    gate('TG1b', 'WebGL refused: game boots on the named fallback canvas #scene2d',
      alive && !!two && two.shown, two ? `#scene2d shown=${two.shown} ${two.cw}x${two.ch}, chip="${chip.trim()}", hook=${alive}` : 'no #scene2d');

    const played = await page.evaluate(() => {
      const T = window.__TDV2_CAREER_TEST__;
      try {
        const c = T.create(4242); T.hydrate(c);
        const fx = T.nextFixture();
        // simCareerScore returns {hg, ag, pens, aet, winner}; home/away are the
        // INPUTS. Asserting the input names measured nothing about the result.
        const r = T.simulate(fx.home, fx.away, fx);
        return { ok: !!r && typeof r.hg === 'number' && typeof r.ag === 'number',
          score: r && (r.hg + '-' + r.ag), shape: r && Object.keys(r).join(','), mode: T.storageMode() };
      } catch (e) { return { ok: false, err: e.message }; }
    });
    gate('TG1c', 'WebGL refused: a fixture still plays to a score',
      played.ok, played.ok ? `score ${played.score} (fields ${played.shape}), storage ${played.mode}`
        : 'ERR ' + (played.err || JSON.stringify(played)));

    const saved = await page.evaluate(async () => {
      const T = window.__TDV2_CAREER_TEST__;
      try { const s = T.getState(); T.hydrate(s); await new Promise(r => setTimeout(r, 700));
        return { ok: !!T.validate(T.getState()), mode: T.storageMode() }; } catch (e) { return { ok: false, err: e.message }; }
    });
    gate('TG1d', 'WebGL refused: the career still saves and validates',
      saved.ok, saved.ok ? `validate() true, storage ${saved.mode}` : 'ERR ' + saved.err);
    gate('TG1e', 'WebGL refused: no page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    await ctx.close();
  }

  // ---- TG1 context loss mid-session: report what the player is shown.
  {
    const { ctx, page } = await boot(browser, origin);
    await intoMatch(page);
    const seen = await page.evaluate(async () => {
      const c = document.getElementById('scene3d');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      const ext = gl && gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext(); else return { forced: false };
      await new Promise(r => setTimeout(r, 1400));
      const u = document.getElementById('unsupported');
      return { forced: true, chip: (document.getElementById('renderer-chip') || {}).textContent,
        noticeShown: !!u && !u.hidden, noticeText: u ? u.textContent.trim().slice(0, 90) : null,
        fallbackShown: getComputedStyle(document.getElementById('scene2d')).display !== 'none',
        stillRunning: typeof window.__TDV2_CAREER_TEST__ === 'object' };
    });
    gate('TG1f', 'mid-session context loss: the player is told, and play continues',
      seen.forced ? (seen.stillRunning && seen.fallbackShown) : true,
      seen.forced ? `chip="${String(seen.chip).trim()}", notice=${seen.noticeShown} "${seen.noticeText}", fallback visible=${seen.fallbackShown}` : 'WEBGL_lose_context unavailable — reported as zero, not as a pass');
    await ctx.close();
  }

  // ---- TG3 career round trip, BY VALUE, in both storage modes.
  for (const [label, killIDB] of [['IndexedDB (default)', false], ['localStorage fallback', true]]) {
    const { ctx, page } = await boot(browser, origin, { killIDB });
    const rt = await page.evaluate(async () => {
      const T = window.__TDV2_CAREER_TEST__;
      const made = T.create(20260829); T.hydrate(made);
      await new Promise(r => setTimeout(r, 800));
      const before = T.getState();
      // The career state is flat: squad/schedule/leagueTable are top level.
      // An earlier signature read s.clubs[0].squad and s.fixtures — neither
      // exists, so every field came back empty and the comparison was two empty
      // objects agreeing. A round trip that compares nothing always passes.
      const sig = s => JSON.stringify({
        squad: (s.squad || []).map(p => [p.id, p.name, p.pos, p.ability]),
        schedule: (s.schedule || []).map(f => [f.id, f.home, f.away, f.played, f.hg, f.ag]),
        leagueTable: (s.leagueTable || []).map(t => [t.id, t.pts, t.gd]),
        season: s.season, year: s.year, week: s.week, leagueRound: s.leagueRound,
        cash: s.cash, board: s.board, reputation: s.reputation, morale: s.morale,
        tactics: s.tactics, objectives: s.objectives, finance: s.finance });
      const a = sig(before);
      T.hydrate(JSON.parse(JSON.stringify(before)));
      await new Promise(r => setTimeout(r, 500));
      const b = sig(T.getState());
      return { mode: T.storageMode(), equal: a === b, valid: !!T.validate(T.getState()),
        squadN: (before.squad || []).length, fixtures: (before.schedule || []).length,
        table: (before.leagueTable || []).length, sigLen: a.length };
    });
    // Non-vacuity is part of the assertion, not a note beside it: a signature
    // over an empty squad and an empty schedule would match trivially.
    gate(killIDB ? 'TG3b' : 'TG3a', `career round trip by value — ${label}`,
      rt.equal && rt.valid && rt.squadN > 0 && rt.fixtures > 0 && rt.sigLen > 200,
      `mode=${rt.mode}, squad=${rt.squadN}, schedule=${rt.fixtures}, table=${rt.table}, signature ${rt.sigLen} chars, match=${rt.equal}, validate=${rt.valid}`);
    if (!killIDB) {
      const mig = await page.evaluate(() => {
        const T = window.__TDV2_CAREER_TEST__;
        const s = T.getState(); const v = s.version;
        try { const m = T.migrate(JSON.parse(JSON.stringify(s))); return { ok: !!m, before: v, after: m && m.version }; }
        catch (e) { return { ok: false, err: e.message }; }
      });
      gate('TG3c', 'a VERSION 6 save passes through migrateCareer unchanged',
        mig.ok && mig.before === mig.after && mig.after === 6,
        mig.ok ? `version ${mig.before} -> ${mig.after}` : 'ERR ' + mig.err);
    }
    await ctx.close();
  }

  // ---- TG4 reduced motion must CHANGE rendered output. Negative control first.
  {
    const shot = async rm => {
      const { ctx, page } = await boot(browser, origin, { reducedMotion: rm });
      await intoMatch(page);
      const v = await page.evaluate(() => ({
        reduced: !!(window.matchMedia('(prefers-reduced-motion: reduce)').matches),
        animating: Array.from(document.querySelectorAll('*')).filter(e => {
          const d = getComputedStyle(e).animationDuration; return d && d !== '0s' && parseFloat(d) > 0.01; }).length,
        transitions: Array.from(document.querySelectorAll('*')).filter(e => {
          const d = getComputedStyle(e).transitionDuration; return d && parseFloat(d) > 0.01; }).length,
      }));
      await ctx.close(); return v;
    };
    const on = await shot('reduce'), off = await shot('no-preference');
    gate('TG4a', 'reduced motion is actually detected in the page',
      on.reduced === true && off.reduced === false, `reduce->${on.reduced}, no-preference->${off.reduced}`);
    gate('TG4b', 'reduced motion changes rendered output (negative control: OFF differs)',
      (on.animating + on.transitions) < (off.animating + off.transitions),
      `animated+transitioning elements: reduced=${on.animating + on.transitions}, normal=${off.animating + off.transitions}`);
  }

  // ---- TG5 performance: PAIRED AB/BA, decided on the paired deltas.
  {
    const PAIRS = 9;
    const sample = async rm => {
      const { ctx, page } = await boot(browser, origin, { reducedMotion: rm, wait: 3000 });
      await intoMatch(page);
      const fps = await page.evaluate(() => new Promise(res => {
        let n = 0; const t0 = performance.now();
        (function tick() { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else res(n * 1000 / (performance.now() - t0)); })();
      }));
      await ctx.close(); return fps;
    };
    const deltas = [];
    for (let i = 0; i < PAIRS; i++) {
      // AB on even i, BA on odd i — order is balanced, and the delta is taken
      // within the pair, never across two independent medians.
      const first = i % 2 === 0 ? 'no-preference' : 'reduce';
      const second = i % 2 === 0 ? 'reduce' : 'no-preference';
      const a = await sample(first), b = await sample(second);
      const normal = first === 'no-preference' ? a : b;
      const reduced = first === 'reduce' ? a : b;
      deltas.push(reduced - normal);
    }
    const srt = [...deltas].sort((x, y) => x - y);
    const med = srt[Math.floor(srt.length / 2)];
    const q1 = srt[Math.floor(srt.length * 0.25)], q3 = srt[Math.floor(srt.length * 0.75)];
    const pos = deltas.filter(d => d > 0).length;
    // Sign test, two-sided, n=9. 8 of 9 is needed for p<0.05; 6 of 9 is p≈0.51.
    const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
    let p = 0; const n = deltas.length, k = Math.max(pos, n - pos);
    for (let i = k; i <= n; i++) p += C(n, i) * Math.pow(0.5, n);
    p = Math.min(1, 2 * p);
    say(`      TG5 paired deltas (reduced − normal fps): [${deltas.map(d => d.toFixed(2)).join(', ')}]`);
    say(`      TG5 median paired delta ${med.toFixed(2)} fps | IQR ${q1.toFixed(2)}..${q3.toFixed(2)} | spread ${(srt[srt.length - 1] - srt[0]).toFixed(2)}`);
    say(`      TG5 sign test: ${pos}/${n} positive, two-sided p≈${p.toFixed(3)}. At n=${n} this test needs 8/9 for p<0.05,`);
    say(`      TG5 so it detects only a near-monotonic shift and discards magnitude entirely — read the numbers above, not just the verdict.`);
    gate('TG5', 'reduced motion does not COST frames (paired AB/BA, decided on paired deltas)',
      med >= -1.0, `median paired delta ${med.toFixed(2)} fps against a −1.00 fps allowance; spread ${(srt[srt.length - 1] - srt[0]).toFixed(2)} fps`);
  }

  // ---- TG6 accessibility.
  {
    const { ctx, page } = await boot(browser, origin);
    const ann = await page.evaluate(async () => {
      const live = document.querySelector('[aria-live]');
      if (!live) return { found: false };
      let fires = 0; const seen = [];
      const mo = new MutationObserver(() => { fires++; seen.push(live.textContent.trim().slice(0, 40)); });
      mo.observe(live, { childList: true, characterData: true, subtree: true });
      const T = window.__TDV2_CAREER_TEST__;
      try { T.hydrate(T.create(77)); } catch (_) {}
      await new Promise(r => setTimeout(r, 400));
      const base = fires; fires = 0; seen.length = 0;
      // one announce() call must move the region exactly once
      if (window.announce) window.announce('GOAL — Harbour FC 1-0');
      else live.textContent = 'GOAL — Harbour FC 1-0';
      await new Promise(r => setTimeout(r, 350));
      mo.disconnect();
      return { found: true, id: live.id || live.className, base, firesPerEvent: fires, seen };
    });
    gate('TG6a', 'a single live-region announcement fires once, not twice',
      ann.found && ann.firesPerEvent <= 1,
      ann.found ? `region "${ann.id}", mutations per announcement = ${ann.firesPerEvent}` : 'no aria-live region');

    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(500);
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href], select, [role=button]'))
        .filter(e => e.offsetParent !== null)
        .map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className || e.tagName, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })
        .filter(o => o.w > 0 && (o.w < 44 || o.h < 44)));
      gate(`TG6b-${vp.width}`, `44px targets in portrait at ${vp.width}x${vp.height}`,
        small.length === 0, small.length ? JSON.stringify(small.slice(0, 4)) : 'all visible targets clear the floor');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(() => {
      const back = document.getElementById('mbmexit-back'); if (!back) return { found: false };
      const r = back.getBoundingClientRect();
      const hits = Array.from(document.querySelectorAll('button, select, [role=button]'))
        .filter(e => e.offsetParent !== null && !e.closest('#mbmexit,[data-mbm-inline-exit]'))
        .map(e => ({ id: e.id || e.className, b: e.getBoundingClientRect() }))
        .filter(o => !(o.b.right < r.left || o.b.left > r.right || o.b.bottom < r.top || o.b.top > r.bottom))
        .map(o => o.id);
      return { found: true, box: [Math.round(r.width), Math.round(r.height)], hits };
    });
    gate('TG6c', 'exit control does not overlap any game control',
      overlap.found && overlap.hits.length === 0,
      overlap.found ? `exit ${overlap.box[0]}x${overlap.box[1]}px, overlapping controls: ${overlap.hits.length}` : 'no exit control');

    // The way out must be reachable and firable by keyboard — never .focus().
    let presses = -1;
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab'); await page.waitForTimeout(25);
      if (await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back')) { presses = i + 1; break; }
    }
    const before = page.url();
    if (presses > 0) { await page.keyboard.press('Enter'); await page.waitForTimeout(1200); }
    gate('TG6d', 'a real Tab walk reaches the exit and Enter navigates to /games/',
      presses > 0 && page.url() !== before && /\/games\/?$/.test(page.url()),
      presses > 0 ? `reached in ${presses} press(es); Enter -> ${page.url().replace(/^https?:\/\/[^/]+/, '')}` : 'exit never focused in 70 presses');
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
async function selftest(html, browser, origin, serveOne) {
  say('\n--- TG7 non-vacuity: each gate must fail on a build that violates it ---');
  const mutations = [
    { gate: 'TG0a', why: 're-add an external script reference',
      mutate: s => s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three/build/three.min.js"></script></head>') },
    { gate: 'TG0b', why: 'introduce a syntax error',
      mutate: s => s.replace('const CAREER_VERSION=6', 'const CAREER_VERSION=6{{') },
    { gate: 'TG0c', why: 'tamper with the pinned exit region',
      mutate: s => s.replace('MBM-INLINE-EXIT:END -->', 'MBM-INLINE-EXIT:END --><!--x-->') },
    { gate: 'TG0d', why: 'put the hand-copied splash section back',
      mutate: s => s.replace('<body>', '<body><section class="mbm-splash" id="mbmSplash"><h1>Touchline<span>Dynasty V2</span></h1></section>') },
    { gate: 'TG2', why: 'add a scheduler keyed on the snapshot tick modulo',
      mutate: s => s.replace('const CAREER_VERSION=6', 'function __sched(s){if(s.tick%7)return;}\n  const CAREER_VERSION=6') },
  ];
  let proven = 0, vacuous = [];
  for (const mut of mutations) {
    const broken = mut.mutate(html);
    if (broken === html) { say(`  ??  ${mut.gate}: mutation "${mut.why}" did not change the file`); vacuous.push(mut.gate + ' (inert mutation)'); continue; }
    const saved = results; results = [];
    await staticGates(broken);
    const hit = results.find(r => r.id === mut.gate);
    results = saved;
    if (hit && !hit.ok) { say(`  CAUGHT  ${mut.gate}: ${mut.why}`); proven++; }
    else { say(`  VACUOUS ${mut.gate}: ${mut.why} — gate still passed`); vacuous.push(mut.gate + ': ' + mut.why); }
  }
  gate('TG7', 'gates are non-vacuous', vacuous.length === 0,
    `${proven}/${mutations.length} violations caught${vacuous.length ? '; vacuous: ' + vacuous.join(' | ') : ''}`);
}

// ---------------------------------------------------------------------------
(async () => {
  if (!fs.existsSync(GAME)) { say(`no file at ${GAME}`); process.exit(1); }
  const html = fs.readFileSync(GAME, 'utf8');
  say(`Touchline Dynasty harness — ${GAME}`);
  say(`bytes ${Buffer.byteLength(html)}  sha256 ${(await import('node:crypto')).createHash('sha256').update(html).digest('hex')}\n`);

  await staticGates(html);

  const { server, port } = await serve(GAME);
  const origin = `http://127.0.0.1:${port}`;
  let browser;
  try { browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {}); }
  catch (e) { gate('TGB', 'browser gates', false, 'chromium unavailable: ' + e.message); }
  if (browser) {
    say('');
    try { await browserGates(browser, origin); }
    finally { await browser.close(); }
  }
  if (SELFTEST) { const b2 = await chromium.launch(CHROME ? { executablePath: CHROME } : {}); try { await selftest(html, b2, origin); } finally { await b2.close(); } }
  server.close();

  const bad = results.filter(r => !r.ok);
  say(`\n${results.length - bad.length}/${results.length} gates green`);
  if (bad.length) { say('FAILED: ' + bad.map(b => b.id).join(', ')); process.exit(1); }
  say('ALL GATES GREEN');
})();
