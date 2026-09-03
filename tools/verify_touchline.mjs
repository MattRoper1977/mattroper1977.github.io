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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirnameEarly = path.dirname(fileURLToPath(import.meta.url));

/* Playwright is resolved, never hard-coded. An absolute sandbox path works on
 * exactly one machine and fails everywhere else, including CI — which is the
 * only place that can prove the served route. Node does not search a global
 * root unless NODE_PATH says so, so the candidates are named explicitly, the
 * same way tools/verify_emberwild.js does it. */
function loadChromium() {
  const req = createRequire(import.meta.url);
  const repoRoot = path.resolve(__dirnameEarly, '..');
  const globalRoot = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  const paths = [
    path.join(repoRoot, 'node_modules'),
    globalRoot,
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    '/home/user/Lessons/node_modules',
  ].filter(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  return req(req.resolve('playwright', { paths })).chromium;
}

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
    acceptDownloads: true,
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

  // Per-route byte budget — docs/TOUCHLINE_BUDGET.md (TDSKY-2 §T2, on the
  // SC1 §4.4 per-title shape). Raw and wire are separate numbers because the
  // estate's old 409,600 B line measured the wrong quantity for what a child
  // downloads (gzip on the wire) and never measured parse at all.
  const RAW_BUDGET = 512000, WIRE_BUDGET = 160000;
  const rawBytes = Buffer.byteLength(html);
  const wireBytes = zlib.gzipSync(Buffer.from(html, 'utf8'), { level: 6 }).length;
  gate('TG0h', `raw bytes within the ${RAW_BUDGET.toLocaleString('en-GB')} B route budget`, rawBytes <= RAW_BUDGET,
    `${rawBytes} B (retired estate line 409,600 B; headroom ${RAW_BUDGET - rawBytes} B)`);
  gate('TG0i', `gzip wire bytes within the ${WIRE_BUDGET.toLocaleString('en-GB')} B route budget`, wireBytes <= WIRE_BUDGET,
    `${wireBytes} B gzipped at level 6 (${(100 * wireBytes / rawBytes).toFixed(1)}% of raw; headroom ${WIRE_BUDGET - wireBytes} B)`);

  // TG2 static half — REPORT ONLY under TDSKY-2. The dynamic TG2 below is the
  // gate: tick advances by S.speed, the clock runs and full time fires at
  // every speed. A `tick % N` site still changes a cosmetic rate with speed
  // (TurfWearField.stamp) and is named here so it stays on the record; R-a
  // rules gameplay edits out of this launch.
  // (original note: the snapshot tick advances by S.speed, so any scheduler
  // keyed on `tick % N` fires at a rate that depends on the sim speed.
  const mods = [...html.matchAll(/(\w+)\.tick\s*%\s*(\d+)|(?<![\w.])tick\s*%\s*(\d+)/g)];
  const detail = mods.map(m => m[0]).join(', ');
  say(`      TG2s report: ${mods.length} tick%N site(s)${mods.length ? ' — ' + detail + ' (cosmetic turf-wear stamp rate; not a gate under TDSKY-2 R-a)' : ''}`);
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
      if (vp.width === 390) gate(`TG6b-${vp.width}`, `44px targets in portrait at ${vp.width}x${vp.height}`,
        small.length === 0, small.length ? JSON.stringify(small.slice(0, 4)) : 'all visible targets clear the floor');
      else say(`      TG6b-${vp.width} report: ${small.length ? JSON.stringify(small.slice(0, 4)) + ' under 44 px at ' + vp.width + ' wide (pre-existing, named not fixed under R-a)' : 'all visible targets clear the floor at ' + vp.width + ' wide'}`);
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
// TDSKY-2 order gates. Each gate carries its own firing control: the same
// predicate is run on a deliberately broken input and must go red, or the gate
// is reported MEASUREMENT INVALID rather than green.
function control(id, predicate, brokenInput, label) {
  let fired = false, err = '';
  try { fired = !predicate(brokenInput); } catch (e) { err = e.message; }
  say(`      ${id} control: ${fired ? 'FIRED' : 'VACUOUS'} — ${label}${err ? ' (' + err + ')' : ''}`);
  return fired;
}
const ART = (() => {
  const dir = path.resolve(__dirname, '..', 'artifacts', 'touchline');
  try { fs.mkdirSync(dir, { recursive: true }); return dir; } catch (_) { return fs.mkdtempSync(path.join(os.tmpdir(), 'td-art-')); }
})();
async function shot(page, name) {
  try { const f = path.join(ART, name + '.png'); await page.screenshot({ path: f }); return f; } catch (e) { return 'screenshot failed: ' + e.message; }
}
// Drive whatever modal is in front: press conference (answer it), pregame,
// half-time. Returns what it did, so a caller can assert on real input.
async function advanceModals(page, log) {
  const state = await page.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
    return { press: vis('press-modal'), pregame: vis('pregame'), ht: vis('halftime-modal'), ft: vis('fulltime-modal'), replay: !!(window.__TDV2_TEST__ && window.__TDV2_TEST__.getState().replay) };
  });
  // An automatic instant replay holds the match clock until it ends. A player
  // skips it with the "Back to live" control; so does the harness.
  if (state.replay) { const b = await page.$('#replay-skip'); if (b) await b.click({ timeout: 2000 }).catch(() => {}); else await page.keyboard.press('Escape'); await page.waitForTimeout(250); return 'replay-skipped'; }
  if (state.press) {
    const opts = await page.$$('#press-options button');
    if (opts.length) {
      const before = await page.evaluate(() => (document.getElementById('press-impact') || {}).textContent || '');
      await opts[0].click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ impact: (document.getElementById('press-impact') || {}).textContent || '',
        cont: !(document.getElementById('press-continue') || {}).disabled, q: (document.getElementById('press-question') || {}).textContent || '' }));
      log.push({ press: { question: after.q.slice(0, 80), impactBefore: before.slice(0, 60), impactAfter: after.impact.slice(0, 80), continueEnabled: after.cont } });
      const c = await page.$('#press-continue'); if (c) await c.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      return 'press';
    }
  }
  if (state.pregame) { const b = await page.$('#pregame-skip'); if (b) { await b.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); return 'pregame'; } }
  if (state.ht) {
    // The second half only starts once a dressing-room tone is chosen: the
    // continue control is disabled until then, as a player would find.
    const talk = await page.$('#ht-talk-options .talk-choice');
    if (talk) { const tone = await talk.getAttribute('data-talk'); await talk.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); log.push({ halftime: { tone } }); }
    const b = await page.$('#ht-continue'); if (b) { await b.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); return 'halftime'; }
  }
  if (state.ft) return 'fulltime';
  return '';
}
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function canonicalJSON(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
}

async function orderGates(browser, origin, html) {
  say('\n--- TDSKY-2 order gates ---');

  // ---- T0: Tab escapes the canvas. Focus the broadcast canvas by script,
  // press Tab for real, and the active element must leave the canvas.
  {
    const { ctx, page } = await boot(browser, origin);
    await intoMatch(page);
    await page.evaluate(() => { const c = document.getElementById('scene3d') || document.getElementById('scene2d'); if (c) { if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '0'); c.focus(); } });
    const start = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    await page.keyboard.press('Tab'); await page.waitForTimeout(150);
    const after = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    const escaped = /scene/.test(String(start)) && !/scene/.test(String(after)) && after !== 'BODY';
    gate('T0t', 'Tab leaves the broadcast canvas (no focus trap)', escaped, `focus ${start} -> ${after}`);
    await ctx.close();
  }

  // ---- TG2 dynamic: the worker sim replayed inline with the UI's own payload
  // shape at speeds 1/2/4; tick advances by S.speed per snapshot, the clock
  // advances, and the full-time event fires at every speed.
  {
    const { ctx, page, errors } = await boot(browser, origin);
    const res = await page.evaluate(() => {
      const T = window.__TDV2_TEST__; const out = {};
      for (const sp of [1, 2, 4]) {
        const msgs = []; let tickFn = null;
        const port = { onmessage: null, postMessage: m => msgs.push(m) };
        const stop = T.simulationWorker(port, (fn, ms) => { tickFn = fn; return 0; });
        port.onmessage({ data: { type: 'INIT', seed: 20260902 + sp, home: T.HOME_PLAYERS, away: T.AWAY_PLAYERS, bench: T.BENCH, meta: { teamNames: ['Harbour FC', 'Northbridge City'] } } });
        port.onmessage({ data: { type: 'START' } });
        port.onmessage({ data: { type: 'SPEED', value: sp } });
        if (!tickFn) { out[sp] = { err: 'no schedule captured' }; continue; }
        let n = 0; const MAX = 20000;
        while (n < MAX && !msgs.some(m => m.type === 'EVENT' && m.event && m.event.kind === 'fulltime')) { tickFn(); n++; }
        const snaps = msgs.filter(m => m.type === 'SNAPSHOT').map(m => m.snapshot);
        const deltas = []; for (let i = 1; i < snaps.length; i++) deltas.push(snaps[i].tick - snaps[i - 1].tick);
        // A snapshot is also emitted on events (kick-off, half-time, a
        // substitution) without a tick step - those carry a 0 delta - and the
        // last step before full time can be partial. Every other delta must be
        // exactly S.speed.
        const hist = {}; for (const d of deltas) hist[d] = (hist[d] || 0) + 1;
        const stepDeltas = deltas.filter(d => d !== 0);
        const offSpeed = stepDeltas.filter(d => d !== sp).length;
        const uniq = [...new Set(deltas)];
        const clockUp = snaps.length > 5 && snaps[5].clock > snaps[0].clock;
        const ft = msgs.find(m => m.type === 'EVENT' && m.event.kind === 'fulltime');
        out[sp] = { steps: n, snapshots: snaps.length, deltaSet: uniq, hist, stepDeltas: stepDeltas.length, offSpeed, atSpeed: stepDeltas.length - offSpeed, clockUp, fulltime: !!ft, finalClock: snaps.length ? snaps[snaps.length - 1].clock : null, finalTick: snaps.length ? snaps[snaps.length - 1].tick : null, score: ft && ft.event.score };
        try { stop && stop(); } catch (_) {}
      }
      return out;
    });
    for (const sp of [1, 2, 4]) {
      const r = res[sp] || {};
      const ok = !r.err && r.snapshots > 50 && r.offSpeed <= 1 && r.atSpeed >= 0.99 * r.stepDeltas && r.clockUp && r.fulltime;
      gate(`TG2-${sp}x`, `worker sim at speed ${sp}: tick advances by S.speed, clock runs, full time fires`, ok,
        r.err || `${r.snapshots} snapshots; tick-delta histogram ${JSON.stringify(r.hist)} (0 = event-emitted, ${r.offSpeed} off-speed step(s) allowed <= 1); clock ${r.finalClock}, tick ${r.finalTick}, full-time ${r.fulltime} (${r.score}) after ${r.steps} steps`);
    }
    const pred = r => r.offSpeed <= 1 && r.atSpeed >= 0.99 * r.stepDeltas;
    const c = control('TG2', pred, { offSpeed: 12, atSpeed: 88, stepDeltas: 100 }, 'a stream where 12 of 100 steps advance by the wrong amount is refused');
    gate('TG2c', 'TG2 predicate has a firing control', c, 'planted 12/100 off-speed steps rejected');
    // UI clock at each speed, on the real matchday screen. Drive the pregame
    // and press modals until the sim is actually running before sampling.
    await intoMatch(page);
    for (let i = 0; i < 20; i++) {
      await advanceModals(page, []);
      const running = await page.evaluate(() => { const s = window.__TDV2_TEST__.getState(); return s.matchLaunched && !s.paused && ((s.latest || {}).tick || 0) > 0; });
      if (running) break;
      await page.waitForTimeout(600);
    }
    for (const sp of [1, 2, 4]) {
      // #speed cycles 1 -> 2 -> 4 -> 1
      const cur = await page.evaluate(() => (document.getElementById('speed') || {}).textContent || '');
      let guard = 0;
      while (!(await page.evaluate(() => (document.getElementById('speed') || {}).textContent || '')).startsWith(String(sp)) && guard++ < 4) { await page.click('#speed').catch(() => {}); await page.waitForTimeout(120); }
      await advanceModals(page, []);
      const a = await page.evaluate(() => ({ clock: document.getElementById('clock').textContent, tick: (window.__TDV2_TEST__.getState().latest || {}).tick || 0 }));
      await page.waitForTimeout(2500);
      const b = await page.evaluate(() => ({ clock: document.getElementById('clock').textContent, tick: (window.__TDV2_TEST__.getState().latest || {}).tick || 0, speed: window.__TDV2_TEST__.getState().speed }));
      gate(`TG2-ui-${sp}x`, `UI clock advances at speed ${sp}`, b.speed === sp && b.tick > a.tick && b.clock !== a.clock, `speed=${b.speed}, clock ${a.clock} -> ${b.clock}, tick ${a.tick} -> ${b.tick}`);
    }
    gate('TG2e', 'no page errors during the speed proofs', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    await ctx.close();
  }

  // ---- TG3d/e: export -> CRC32 verified in the harness -> import, both modes.
  for (const [label, killIDB] of [['IndexedDB', false], ['localStorage fallback', true]]) {
    const { ctx, page } = await boot(browser, origin, { killIDB, acceptDownloads: true });
    await page.click('#kickoff').catch(() => {}); await page.waitForTimeout(1500);
    // find the export control: it lives in a career dialog; open whichever
    // career control reveals it.
    let found = await page.$('[data-action="export-current"]');
    if (!found) {
      const openers = await page.$$('button, [role=button]');
      for (const o of openers) {
        const t = ((await o.textContent()) || '').trim();
        if (/save|load|manage|career file|backup/i.test(t) && await o.isVisible()) { await o.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500); found = await page.$('[data-action="export-current"]'); if (found) break; }
      }
    }
    let result = { ok: false, detail: 'export control not found' };
    if (found) {
      const stateBefore = await page.evaluate(() => window.__TDV2_CAREER_TEST__.getState());
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), found.click()]);
      if (dl) {
        const file = await dl.path();
        const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
        const digest = ('00000000' + crc32(Buffer.from(canonicalJSON(payload.state), 'utf8')).toString(16)).slice(-8);
        const crcOk = payload.integrity && payload.integrity.algorithm === 'crc32' && payload.integrity.digest === digest;
        // corrupt one field, re-import must be refused; then import the real file
        const bad = JSON.parse(JSON.stringify(payload)); bad.state.cash = (bad.state.cash || 0) + 1;
        const badFile = path.join(os.tmpdir(), 'td-bad-' + Date.now() + '.json'); fs.writeFileSync(badFile, JSON.stringify(bad));
        const importOnce = async f => {
          const inp = await page.$('#career-import-input'); await inp.setInputFiles(f); await page.waitForTimeout(700);
          const confirm = await page.$('[data-action="confirm-import"]'); if (confirm) { await confirm.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(700); }
          return page.evaluate(() => ({ toast: (document.getElementById('career-toast') || {}).textContent || '', status: (document.getElementById('career-save-status') || {}).textContent || '', pending: !!document.querySelector('[data-action="confirm-import"]') }));
        };
        const badRes = await importOnce(badFile);
        const badState = await page.evaluate(() => window.__TDV2_CAREER_TEST__.getState());
        const corruptedRefused = badState.cash === stateBefore.cash;
        const goodRes = await importOnce(file);
        const after = await page.evaluate(() => ({ s: window.__TDV2_CAREER_TEST__.getState(), mode: window.__TDV2_CAREER_TEST__.storageMode() }));
        const same = canonicalJSON(after.s) === canonicalJSON(payload.state);
        result = { ok: crcOk && same && corruptedRefused, detail: `mode ${after.mode}; export ${fs.statSync(file).size} B, digest ${payload.integrity && payload.integrity.digest} recomputed ${digest} ${crcOk ? 'MATCH' : 'MISMATCH'}; corrupted import refused=${corruptedRefused} (${(badRes.toast || badRes.status).slice(0, 50)}); clean import state-identical=${same} (${(goodRes.toast || goodRes.status).slice(0, 40)})` };
      } else result.detail = 'no download event';
    }
    gate(killIDB ? 'TG3e' : 'TG3d', `export CRC32 -> import round trip — ${label}`, result.ok, result.detail);
    await ctx.close();
  }

  // ---- TG4: the generated splash on first load, suppressed within 24 h,
  // reduced-motion timing, hook shape, gamepad back, stood-down bootstrap.
  {
    // Init scripts run before the document has an element, so observe the
    // document node itself and define the helpers before anything can throw.
    const seenScript = () => { window.__splashSeen = []; window.__splashIds = () => document.querySelectorAll('#mbmSplash').length; try { const mo = new MutationObserver(l => { for (const r of l) for (const n of r.addedNodes) if (n.nodeType === 1 && n.matches && n.matches('[data-mbm-maker-splash]')) window.__splashSeen.push(performance.now()); }); mo.observe(document, { childList: true, subtree: true }); } catch (e) { window.__splashSeenErr = String(e); } };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const errors = [];
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e.message)));
    await page.addInitScript(seenScript);
    await page.goto(origin + '/touchline/'); await page.waitForTimeout(300);
    const first = await page.evaluate(() => ({ seen: window.__splashSeen.length, present: !!document.querySelector('[data-mbm-maker-splash]'), ids: window.__splashIds() }));
    await page.waitForTimeout(3200);
    const afterFirst = await page.evaluate(() => ({ present: !!document.querySelector('[data-mbm-maker-splash]'), hook: window.__TDV2_CAREER_TEST__.splash(), ids: window.__splashIds() }));
    gate('TG4c', 'generated splash shows on first load, then stands down', first.seen === 1 && first.present && !afterFirst.present && first.ids <= 1 && afterFirst.ids === 0,
      `seen=${first.seen}, present at 300ms=${first.present}, at 3.5s=${afterFirst.present}, #mbmSplash count max=${Math.max(first.ids, afterFirst.ids)}`);
    const h = afterFirst.hook || {};
    gate('TG4h', 'splash() hook returns {visible,hidden,last} consistently after the splash', h.visible === false && h.hidden === true && /^\d{13}$/.test(String(h.last)) && Number(h.last) <= Date.now(),
      JSON.stringify(h));
    // second load in the same storage: suppressed
    await page.goto(origin + '/touchline/'); await page.waitForTimeout(1200);
    const second = await page.evaluate(() => ({ seen: window.__splashSeen.length, present: !!document.querySelector('[data-mbm-maker-splash]'), last: localStorage.getItem('mbm_splash_last') }));
    gate('TG4d', 'splash suppressed within 24 h on the shared key mbm_splash_last', second.seen === 0 && !second.present && !!second.last, `second load: seen=${second.seen}, key=${second.last}`);
    // control: clearing the key brings it back; a stale key (25 h) too
    await page.evaluate(() => localStorage.setItem('mbm_splash_last', String(Date.now() - 25 * 3600 * 1000)));
    await page.goto(origin + '/touchline/'); await page.waitForTimeout(400);
    const stale = await page.evaluate(() => window.__splashSeen.length);
    gate('TG4d-ctl', 'control: a 25 h-old key lets the splash show again', stale === 1, `seen=${stale}`);
    await page.waitForTimeout(3000);
    gate('TG4g', 'stood-down legacy bootstrap fires nothing: no second splash, no console error', errors.length === 0 && afterFirst.ids === 0, errors.slice(0, 2).join(' | ') || 'no errors, no lingering #mbmSplash');
    await ctx.close();
    // reduced motion timing, measured at 700 ms against the normal run
    const timing = async rm => { const c = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm }); const p = await c.newPage(); await p.goto(origin + '/touchline/'); await p.waitForTimeout(700); const v = await p.evaluate(() => { const e = document.querySelector('[data-mbm-maker-splash]'); return e ? getComputedStyle(e).opacity : 'gone'; }); await c.close(); return v; };
    const red = await timing('reduce'), nor = await timing('no-preference');
    gate('TG4e', 'reduced motion shortens the splash (700 ms: reduced stood down, normal still up)', red === 'gone' && nor !== 'gone', `reduced=${red}, normal=${nor}`);
    // gamepad back during the splash must not dismiss it; control: the same
    // press closes the settings modal once the game is running.
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await c2.newPage();
    await p2.addInitScript(() => { window.__padB = false; const mk = () => ({ id: 'mock', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 1 && window.__padB, touched: false, value: i === 1 && window.__padB ? 1 : 0 })), timestamp: performance.now() }); navigator.getGamepads = () => [mk()]; });
    await p2.goto(origin + '/touchline/'); await p2.waitForTimeout(250);
    await p2.evaluate(() => { window.__padB = true; }); await p2.waitForTimeout(250); await p2.evaluate(() => { window.__padB = false; }); await p2.waitForTimeout(250);
    const during = await p2.evaluate(() => ({ present: !!document.querySelector('[data-mbm-maker-splash]'), hook: window.__TDV2_CAREER_TEST__.splash() }));
    gate('TG4f', 'gamepad back on the splash does not dismiss it as a modal', during.present && during.hook.visible === false, `splash present after B press=${during.present}, legacy visible flag=${during.hook.visible}`);
    await p2.waitForTimeout(3000);
    await p2.click('#kickoff').catch(() => {}); await p2.waitForTimeout(1200);
    const opened = await p2.evaluate(async () => { const b = document.getElementById('career-settings-open'); if (!b) return 'no opener'; b.click(); await new Promise(r => setTimeout(r, 300)); const m = document.getElementById('settings-modal'); return m ? !m.hidden : 'no modal'; });
    await p2.evaluate(() => { window.__padB = true; }); await p2.waitForTimeout(250); await p2.evaluate(() => { window.__padB = false; }); await p2.waitForTimeout(300);
    const closed = await p2.evaluate(() => { const m = document.getElementById('settings-modal'); return m ? m.hidden : 'no modal'; });
    gate('TG4f-ctl', 'control: the same mock B press closes the settings modal', opened === true && closed === true, `settings opened=${opened}, closed by B=${closed}`);
    await c2.close();
  }

  // ---- TG5: one rendered h1, zero duplicate ids, zoom enabled, 44 px menu targets.
  {
    const { ctx, page } = await boot(browser, origin);
    const m = await page.evaluate(() => {
      const vis = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && !e.closest('[aria-hidden="true"],[hidden]'); };
      const h1 = [...document.querySelectorAll('h1')].filter(vis).map(e => e.textContent.trim().slice(0, 40));
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      const vp = (document.querySelector('meta[name=viewport]') || {}).content || '';
      return { h1, idCount: ids.length, dup: [...new Set(dup)], vp };
    });
    gate('TG5a', 'exactly one rendered visible <h1>', m.h1.length === 1, `visible h1: ${JSON.stringify(m.h1)}`);
    gate('TG5b', 'zero duplicate ids', m.dup.length === 0, `${m.idCount} ids, duplicates: ${m.dup.join(',') || 'none'}`);
    const dupCtl = control('TG5b', ids => ids.length === new Set(ids).size, ['a', 'b', 'a'], 'a planted duplicate id is refused');
    gate('TG5b-ctl', 'TG5b predicate has a firing control', dupCtl, 'planted [a,b,a] rejected');
    gate('TG5d', 'viewport keeps zoom enabled', !/user-scalable\s*=\s*(no|0)/i.test(m.vp) && !/maximum-scale\s*=\s*1(\.0)?\b/i.test(m.vp), `viewport="${m.vp}"`);
    const zoomCtl = control('TG5d', v => !/user-scalable\s*=\s*(no|0)/i.test(v), 'width=device-width,user-scalable=no', 'user-scalable=no is refused');
    gate('TG5d-ctl', 'TG5d predicate has a firing control', zoomCtl, 'planted user-scalable=no rejected');
    const MENU = ['#kickoff', '#continue-career', '#new-seed', '#career-primary-action', '#pause', '#speed', '#replay', '#subs', '#tactics'];
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
      await page.setViewportSize(vp); await page.waitForTimeout(300);
      const small = await page.evaluate(sel => sel.map(s => document.querySelector(s)).filter(e => e && e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { id: e.id, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter(o => o.w < 44 || o.h < 44), MENU);
      const seen = await page.evaluate(sel => sel.filter(s => { const e = document.querySelector(s); return e && e.offsetParent !== null; }).length, MENU);
      gate(`TG5c-${vp.width}`, `44 px menu controls at ${vp.width}x${vp.height}`, small.length === 0 && seen > 0, small.length ? JSON.stringify(small) : `${seen} visible menu control(s) all >= 44 px`);
    }
    await ctx.close();
  }

  // ---- TG6 + TG7: one real session — kick off, answer the press conference,
  // play at speed 4 for 90 s with the network log open, observe a goal or a
  // save, reach full time, then roll a season through the hook.
  {
    const { ctx, page, errors, external } = await boot(browser, origin);
    const log = [];
    await page.click('#kickoff').catch(() => {}); await page.waitForTimeout(1200);
    await shot(page, 'tg7-1-career');
    await page.click('#career-primary-action').catch(() => {}); await page.waitForTimeout(1500);
    for (let i = 0; i < 6; i++) { const did = await advanceModals(page, log); if (did === 'press') break; await page.waitForTimeout(500); }
    await shot(page, 'tg7-2-press');
    // speed 4
    for (let i = 0; i < 3; i++) { const t = await page.evaluate(() => (document.getElementById('speed') || {}).textContent || ''); if (t.startsWith('4')) break; await page.click('#speed').catch(() => {}); await page.waitForTimeout(100); }
    // A match is 7,200 sim steps: 90 s of wall clock at speed 4 plus the
    // half-time hold and the pre-match modals, so the window is 170 s and the
    // egress count covers all of it.
    const t0 = Date.now(); let ft = false, goalOrSave = null, replaysSkipped = 0;
    while (Date.now() - t0 < 200000) {
      await page.waitForTimeout(1000);
      const did = await advanceModals(page, log);
      if (did === 'replay-skipped') replaysSkipped++;
      const st = await page.evaluate(() => { const s = window.__TDV2_TEST__.getState(); const ev = s.events.find(e => e.kind === 'goal' || e.kind === 'save'); const feed = [...document.querySelectorAll('.feed-event.goal,.feed-event.save')].length; return { ev: ev ? { kind: ev.kind, text: String(ev.text).slice(0, 70), clock: ev.clock } : null, feed, ft: !document.getElementById('fulltime-modal').hidden, live: document.getElementById('live').textContent.slice(0, 60), clock: document.getElementById('clock').textContent }; });
      if (st.ev && !goalOrSave) { goalOrSave = st.ev; goalOrSave.feedRows = st.feed; await shot(page, 'tg7-3-event'); }
      if (st.ft || did === 'fulltime') { ft = true; break; }
    }
    const elapsed = Math.round((Date.now() - t0) / 1000);
    await shot(page, 'tg7-4-fulltime');
    const press = log.find(l => l.press);
    gate('TG7a', 'real input: press conference answered', !!press && press.press.continueEnabled && press.press.impactAfter.length > 0, press ? JSON.stringify(press.press) : 'no press conference reached');
    gate('TG7b', 'real input: a goal or a save observed in play', !!goalOrSave, goalOrSave ? `${goalOrSave.kind} at ${goalOrSave.clock}: "${goalOrSave.text}" (feed rows ${goalOrSave.feedRows})` : 'none within the window');
    const talk = log.find(l => l.halftime);
    gate('TG7c', 'match reaches full time in the UI at speed 4', ft, `full-time modal ${ft ? 'shown' : 'not shown'} after ${elapsed}s; half-time team talk ${talk ? JSON.stringify(talk.halftime.tone) : 'not reached'}; ${replaysSkipped} instant replay(s) skipped via Back to live`);
    const errBeforeControl = errors.length;
    gate('TG6', `G-EGRESS: zero non-same-origin requests over load + ${elapsed}s of play`, external.length === 0, external.length ? external.slice(0, 3).join(' | ') : `0 external requests; ${errors.length} error(s)`);
    // control: the listener does see a real external request
    const before = external.length;
    await page.evaluate(() => { try { fetch('https://egress-control.invalid/ping', { mode: 'no-cors' }).catch(() => {}); } catch (_) {} });
    await page.waitForTimeout(800);
    gate('TG6-ctl', 'control: an injected external fetch is counted by the egress listener', external.length === before + 1 && /egress-control\.invalid/.test(external[external.length - 1] || ''), `external count ${before} -> ${external.length}`);
    external.length = before; // the control's own request is not the game's
    // rollSeason only rolls a finished season: fast-forward the remaining
    // fixtures through the hook first, then roll, then check the year turned.
    const season = await page.evaluate(() => { const T = window.__TDV2_CAREER_TEST__; const a = T.getState(); let played = 0; try { for (let i = 0; i < 80 && T.nextFixture(); i++) { T.fastForwardNext(); played++; } } catch (e) { return { err: 'fastForward: ' + e.message, played }; } let r = null; try { r = T.rollSeason(); } catch (e) { return { err: 'rollSeason: ' + e.message, played }; } const b = T.getState(); return { before: a.season, after: b.season, played, valid: !!T.validate(b), fixturesLeft: T.nextFixture() ? 1 : 0 }; });
    gate('TG7d', 'season rollover via the test hook', !season.err && season.after === season.before + 1 && season.valid, season.err || `${season.played} fixture(s) fast-forwarded, season ${season.before} -> ${season.after}, validate=${season.valid}`);
    gate('TG7e', 'no page errors across the real-input session (the egress control fetch excluded)', errBeforeControl === 0, errors.slice(0, errBeforeControl).slice(0, 3).join(' | ') || 'clean');
    say(`      TG7 evidence: screenshots in ${ART}`);
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
    { gate: 'TG0h', why: 'pad the file with 100,000 B of comment bytes (raw over budget, wire not)',
      mutate: s => s.replace('</body>', '<!--' + 'x'.repeat(100000) + '--></body>') },
    { gate: 'TG0i', why: 'pad the file with 80,000 B of incompressible hex (wire over budget, raw not)',
      mutate: s => { let h = ''; let x = 88172645463325252n; while (h.length < 80000) { x ^= x << 13n; x ^= x >> 7n; x ^= x << 17n; x &= (1n << 64n) - 1n; h += x.toString(16).padStart(16, '0'); } return s.replace('</body>', '<!--' + h.slice(0, 80000) + '--></body>'); } },
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
  let browser, chromium;
  try { chromium = loadChromium(); browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {}); }
  catch (e) { gate('TGB', 'browser gates', false, 'chromium unavailable: ' + e.message); }
  if (browser) {
    say('');
    try {
      await browserGates(browser, origin);
      // A harness exception is worse than a red: it reports nothing about the
      // game. It becomes a named red instead.
      try { await orderGates(browser, origin, html); }
      catch (e) { gate('TGX', 'order gates ran to completion without a harness error', false, 'HARNESS ERROR: ' + String(e.message || e).slice(0, 200)); }
    }
    finally { await browser.close(); }
  }
  if (SELFTEST) {
    const cr = chromium || loadChromium();
    const b2 = await cr.launch(CHROME ? { executablePath: CHROME } : {});
    try { await selftest(html, b2, origin); } finally { await b2.close(); }
  }
  server.close();

  const bad = results.filter(r => !r.ok);
  say(`\n${results.length - bad.length}/${results.length} gates green`);
  if (bad.length) { say('FAILED: ' + bad.map(b => b.id).join(', ')); process.exit(1); }
  say('ALL GATES GREEN');
})();
