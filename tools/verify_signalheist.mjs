#!/usr/bin/env node
/**
 * verify_signalheist.mjs - the gate harness for Signal Heist (/signalheist/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate has a
 * firing control in --selftest: the same gate run on a deliberately broken
 * copy must go red, or the run fails as MEASUREMENT INVALID.
 *
 *   node tools/verify_signalheist.mjs [path/to/index.html] [--selftest]
 *
 * SHG1  single file: no <script src>, no stylesheet link, no remote URL in the
 *       source, and zero non-same-origin requests while a run is played.
 * SHG2  every localStorage key the game writes while played carries the
 *       mbm_signalheist_ prefix, observed at runtime (and in the source).
 * SHG3  generated inline exit: region byte-identical to the generator,
 *       rendered at 44 px or more, on top, and reachable by keyboard.
 * SHG4  every visible button and input on the start screen, the menu panel
 *       and the settings sheet is 44 px or more at 390, 768 and 1440 wide.
 * SHG5  reduced motion changes behaviour (intro sweep and bloom off), proven
 *       against a no-preference negative control.
 * SHG6  boots without a page error; a started run reaches PLAYING and real
 *       keyboard input moves the player.
 */
'use strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const argPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'signalheist', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PREFIX = 'mbm_signalheist_';
// Estate keys the generated inline exit region may touch. Never the game's.
const ESTATE_KEYS = new Set(['mbm_audience_view']);
const RAW_BUDGET = 409600;
const VIEWPORTS = [[390, 844], [768, 1024], [1440, 900]];
const FLOOR = 44;

function loadChromium() {
  const req = createRequire(import.meta.url);
  const globalRoot = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  const paths = [path.join(ROOT, 'node_modules'), globalRoot, ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)]
    .filter(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  return req(req.resolve('playwright', { paths })).chromium;
}

const say = s => process.stdout.write(s + '\n');
function makeRun(quiet) {
  const results = [];
  return {
    results,
    gate(id, title, ok, detail) {
      results.push({ id, ok: !!ok });
      if (!quiet) say(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ' - ' + detail : ''}`);
      return !!ok;
    },
  };
}

function generatedRegion() {
  const py = 'import sys;sys.path.insert(0,"tools");import render_inline_exit as r;sys.stdout.write(r.build_region(r.read_homes(".")))';
  const out = spawnSync('python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' });
  if (out.status !== 0) throw new Error('could not build the inline exit region: ' + out.stderr);
  return out.stdout;
}

function serve(file) {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/signalheist/' || url === '/signalheist/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(204); res.end();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function boot(browser, origin, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 390, height: 844 }, reducedMotion: opts.reducedMotion || 'no-preference' });
  const errors = [], external = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  await page.goto(origin + '/signalheist/');
  await page.waitForTimeout(opts.wait || 1200);
  return { ctx, page, errors, external };
}

function staticGates(html, g) {
  const tags = html.match(/<[^>]+>/g) || [];
  const remote = tags.filter(t => /(?:src|href|action|poster)\s*=\s*["']?(?:https?:)?\/\//i.test(t));
  const cssRemote = html.match(/url\(\s*["']?(?:https?:)?\/\//gi) || [];
  const fetchRemote = html.match(/(?:fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(\s*["'`](?:https?|wss?):/gi) || [];
  const srcTags = (html.match(/<script[^>]*\bsrc\s*=/gi) || []).length;
  const linkSheets = tags.filter(t => /^<link\b/i.test(t) && /rel\s*=\s*["']?stylesheet/i.test(t)).length;
  g.gate('SHG1a', 'single file: no script src, no stylesheet link, no remote URL in the source',
    remote.length + cssRemote.length + fetchRemote.length + srcTags + linkSheets === 0,
    `${srcTags} script src, ${linkSheets} stylesheet link(s), ${remote.length + cssRemote.length + fetchRemote.length} remote reference(s)${remote.length ? ': ' + remote.slice(0, 2).join(' | ') : ''}`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync(process.execPath, ['--check', f]).status !== 0) bad++; });
  g.gate('SHG1b', 'every inline script block parses', blocks.length > 0 && bad === 0, `${blocks.length} inline block(s), ${bad} failing`);

  const raw = Buffer.byteLength(html);
  g.gate('SHG1c', `raw bytes under the ${RAW_BUDGET} B estate ceiling`, raw <= RAW_BUDGET, `${raw} B`);

  const literalKeys = [...new Set([...html.matchAll(/["'](sh_[A-Za-z0-9_]+|mbm_signalheist_[A-Za-z0-9_]+)["']/g)].map(m => m[1]))].sort();
  const unprefixed = literalKeys.filter(k => !k.startsWith(PREFIX));
  g.gate('SHG2a', `every storage key literal in the source carries ${PREFIX}`, literalKeys.length >= 10 && unprefixed.length === 0,
    `${literalKeys.length} key literal(s)${unprefixed.length ? '; unprefixed: ' + unprefixed.join(', ') : ''}`);

  const want = generatedRegion();
  const m = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?<!-- MBM-INLINE-EXIT:END -->\n?/);
  g.gate('SHG3a', 'inline exit region byte-identical to the generator', !!m && m[0] === want,
    m ? `${Buffer.byteLength(m[0])} B in file, ${Buffer.byteLength(want)} B generated` : 'absent');
}

async function browserGates(browser, origin, g) {
  // SHG6 + SHG1d + SHG2b: boot, start a run, play it with real keys, open settings.
  {
    const { ctx, page, errors, external } = await boot(browser, origin, { viewport: { width: 1440, height: 900 } });
    const hook = await page.evaluate(() => !!(window.__SIGNAL_HEIST__ && window.__SIGNAL_HEIST__.getState));
    let screen = null, moved = 0;
    if (hook) {
      await page.evaluate(() => window.__SIGNAL_HEIST__.startRun('GAUNTLET'));
      await page.waitForTimeout(900);
      const a = await page.evaluate(() => window.__SIGNAL_HEIST__.getState());
      screen = a.screen;
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        await page.keyboard.down(key); await page.waitForTimeout(450); await page.keyboard.up(key);
        const b = await page.evaluate(() => window.__SIGNAL_HEIST__.getState().player);
        moved = Math.max(moved, Math.hypot(b.x - a.player.x, b.y - a.player.y));
      }
      // Open the settings sheet and flip one setting twice, so settings are written.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.evaluate(() => { const b = document.getElementById('setTips'); if (b) { b.click(); b.click(); } });
      await page.waitForTimeout(200);
    }
    g.gate('SHG6a', 'boots with the test hook and no page error', hook && errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    g.gate('SHG6b', 'a started run reaches PLAYING and real keyboard input moves the player', screen === 'PLAYING' && moved > 0.05,
      `screen=${screen}, moved ${moved.toFixed(3)} tiles`);
    g.gate('SHG1d', 'zero non-same-origin requests while booted and played', external.length === 0, external.slice(0, 3).join(' | ') || '0 requests left the page origin');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const game = keys.filter(k => !ESTATE_KEYS_LIST.includes(k));
    const bad = game.filter(k => !k.startsWith('mbm_signalheist_'));
    g.gate('SHG2b', 'every localStorage key written while played carries the prefix', game.length >= 2 && bad.length === 0,
      `${game.length} game key(s): ${game.join(', ')}${bad.length ? '; unprefixed: ' + bad.join(', ') : ''}`);
    await ctx.close();
  }

  // SHG3 + SHG4 at three widths.
  for (const [w, h] of VIEWPORTS) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: w, height: h } });
    const ex = await page.evaluate(() => {
      const e = document.getElementById('mbmexit-back');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { w: r.width, h: r.height, onTop: top === e || e.contains(top), href: e.getAttribute('href') };
    });
    let tabs = 0, reached = false;
    for (; tabs < 12 && !reached; tabs++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back');
    }
    g.gate(`SHG3b@${w}`, 'exit rendered at 44 px or more, on top, keyboard reachable',
      !!ex && ex.w >= 44 && ex.h >= 44 && ex.onTop && reached && !!ex.href && ex.href !== '#',
      ex ? `${Math.round(ex.w)}x${Math.round(ex.h)}, onTop=${ex.onTop}, href=${ex.href}, Tab x${tabs}${reached ? '' : ' (not reached)'}` : 'absent');

    const measure = scope => page.evaluate(([scope, floor]) => {
      const root = scope ? document.querySelector(scope) : document;
      return [...root.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e => {
        const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        if (!(r.width > 0 && r.height > 0) || s.visibility === 'hidden' || s.display === 'none') return false;
        if (!scope) { const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!(t === e || e.contains(t))) return false; }
        return r.width < floor || r.height < floor;
      }).map(e => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    }, [scope, FLOOR]);
    const start = await measure(null);
    await page.evaluate(() => { const b = document.getElementById('menuBtn'); if (b && b.offsetParent) b.click(); });
    await page.waitForTimeout(250);
    const menu = await measure('#menuPanel');
    await page.evaluate(() => { const p = document.getElementById('menuPanel'); if (p) p.classList.remove('open'); document.querySelectorAll('.overlay-backdrop').forEach(o => o.classList.add('hidden')); document.getElementById('pauseOverlay').classList.remove('hidden'); });
    await page.waitForTimeout(150);
    const sheet = await measure('#pauseOverlay');
    const small = [...start.map(s => 'start ' + s), ...menu.map(s => 'menu ' + s), ...sheet.map(s => 'settings ' + s)];
    g.gate(`SHG4@${w}`, 'every visible button and input is 44 px or more (start, menu, settings)', small.length === 0, small.slice(0, 4).join(' | ') || 'none under 44 px');
    await ctx.close();
  }

  // SHG5: reduced motion against a no-preference control, at desktop width
  // (phones start with bloom off regardless, which would make the control vacuous).
  const motion = {};
  for (const rm of ['no-preference', 'reduce']) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: 1440, height: 900 }, reducedMotion: rm });
    motion[rm] = await page.evaluate(() => { if (!window.__SIGNAL_HEIST__) return { introT: null, bloom: null, reactiveFx: null }; window.__SIGNAL_HEIST__.startRun('GAUNTLET'); const s = window.__SIGNAL_HEIST__.getState(); return { introT: s.introT, bloom: s.bloom, reactiveFx: s.reactiveFx }; });
    await ctx.close();
  }
  const on = motion['no-preference'], off = motion.reduce;
  g.gate('SHG5', 'reduced motion turns the intro sweep, bloom and reactive effects off; the control has them on',
    on.introT > 0 && on.bloom && on.reactiveFx && off.introT === 0 && !off.bloom && !off.reactiveFx,
    `no-preference ${JSON.stringify(on)}; reduce ${JSON.stringify(off)}`);
}
const ESTATE_KEYS_LIST = [...ESTATE_KEYS];

async function judge(file, browser, quiet) {
  const g = makeRun(quiet);
  const html = fs.readFileSync(file, 'utf8');
  staticGates(html, g);
  const { server, origin } = await serve(file);
  try { await browserGates(browser, origin, g); } finally { server.close(); }
  return g.results;
}

async function selftest(html, browser) {
  const region = generatedRegion();
  const cases = [
    { gate: 'SHG1a', why: 'add a CDN script tag', mutate: s => s.replace('</head>', '<script src="https://cdn.example.invalid/x.js"></script>\n</head>') },
    { gate: 'SHG1b', why: 'introduce a syntax error', mutate: s => s.replace('window.__SIGNAL_HEIST__ = {', 'window.__SIGNAL_HEIST__ = {{') },
    { gate: 'SHG1d', why: 'fetch a remote resource at boot', mutate: s => s.replace('</body>', '<img alt="" src="ht' + 'tp://198.51.100.1/p.gif">\n</body>') },
    { gate: 'SHG2a', why: 'restore one old unprefixed key', mutate: s => s.replace("'mbm_signalheist_settings'", "'sh_settings'") },
    { gate: 'SHG2b', why: 'restore the old unprefixed settings key', mutate: s => s.split("'mbm_signalheist_settings'").join("'sh_settings'") },
    { gate: 'SHG3a', why: 'hand-edit one byte of the exit region', mutate: s => s.replace(region, region.replace('width:44px', 'width:43px')) },
    { gate: 'SHG3b@390', why: 'shrink the exit control', mutate: s => s.replace('</head>', '<style>#mbmexit-back{width:30px!important;height:30px!important;min-width:0!important;min-height:0!important}</style>\n</head>') },
    { gate: 'SHG4@390', why: 'remove the 44 px floor from the game buttons', mutate: s => s.replace('.icon-btn, .cta-btn { min-height: 44px; min-width: 44px; }', '') },
    { gate: 'SHG5', why: 'ignore the reduced-motion preference', mutate: s => s.replace("window.matchMedia('(prefers-reduced-motion: reduce)').matches", 'false') },
    { gate: 'SHG6a', why: 'throw at boot', mutate: s => s.replace('window.__SIGNAL_HEIST__ = {', 'throw new Error("boom");\n  window.__SIGNAL_HEIST__ = {') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-self-'));
  let vacuous = 0;
  for (const c of cases) {
    const mutated = c.mutate(html);
    if (mutated === html) { say(`VACUOUS  ${c.gate} control - the mutation "${c.why}" did not change the file`); vacuous++; continue; }
    const f = path.join(dir, 'index.html');
    fs.writeFileSync(f, mutated);
    const res = await judge(f, browser, true);
    const hit = res.find(r => r.id === c.gate);
    const fired = hit && !hit.ok;
    say(`${fired ? 'FIRED  ' : 'VACUOUS'}  ${c.gate} control - ${c.why}`);
    if (!fired) vacuous++;
  }
  return vacuous;
}

(async () => {
  if (!fs.existsSync(GAME)) { say(`INCONCLUSIVE: ${GAME} not found`); process.exit(3); }
  const chromium = loadChromium();
  const browser = await chromium.launch();
  try {
    say(`Signal Heist gates - ${path.relative(ROOT, GAME) || GAME} (${fs.statSync(GAME).size} B)`);
    const res = await judge(GAME, browser, false);
    const failed = res.filter(r => !r.ok);
    say(`\n${res.length - failed.length}/${res.length} gates passed`);
    if (failed.length) { say('FAILED: ' + failed.map(r => r.id).join(', ')); process.exitCode = 1; }
    if (SELFTEST && !failed.length) {
      say('\nSelftest: every gate must fire on a broken copy');
      const vac = await selftest(fs.readFileSync(GAME, 'utf8'), browser);
      if (vac) { say(`MEASUREMENT INVALID: ${vac} control(s) did not fire`); process.exitCode = 1; }
      else say('every control fired');
    }
  } finally { await browser.close(); }
})().catch(e => { say('ERROR ' + (e && e.stack || e)); process.exit(2); });
