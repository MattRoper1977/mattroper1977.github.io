#!/usr/bin/env node
/**
 * verify_layerpress.mjs - the gate harness for Layer Press (/layerpress/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate has a
 * firing control in --selftest: the same gate run on a deliberately broken
 * copy must go red, or the run fails as MEASUREMENT INVALID.
 *
 *   node tools/verify_layerpress.mjs [path/to/index.html] [--selftest]
 *
 * LPG1  single file: no <script src>, no stylesheet link, no remote URL in the
 *       source, and zero non-same-origin requests while a drop is played.
 * LPG2  every localStorage key the game writes while played carries the
 *       mbm_layerpress_ prefix, observed at runtime (and in the source).
 * LPG3  generated inline exit: region byte-identical to the generator,
 *       rendered at 44 px or more, on top, reachable by keyboard, and clear
 *       of the play-screen logo.
 * LPG4  every visible button and input on the title screen and the play
 *       screen is 44 px or more at 390, 768 and 1440 wide.
 * LPG5  reduced motion turns Calm Mode on by default (body.calm-mode and the
 *       toggles say so), proven against a no-preference negative control.
 * LPG6  boots without a page error; Start Drop reaches the play screen and
 *       Escape opens the pause sheet; with storage blocked it still boots
 *       and starts without a page error.
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
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'layerpress', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PREFIX = 'mbm_layerpress_';
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
    if (url === '/layerpress/' || url === '/layerpress/index.html') {
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
  // Record, then refuse, anything that leaves the origin: the request is still counted,
  // and a runner with no outbound network cannot hang the load event on it.
  await ctx.route(u => !String(u).startsWith(origin) && !/^(data|blob):/.test(String(u)), r => r.abort());
  if (opts.blockStorage) await ctx.addInitScript(() => { for (const n of ['localStorage', 'sessionStorage']) Object.defineProperty(window, n, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  await page.goto(origin + '/layerpress/');
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
  g.gate('LPG1a', 'single file: no script src, no stylesheet link, no remote URL in the source',
    remote.length + cssRemote.length + fetchRemote.length + srcTags + linkSheets === 0,
    `${srcTags} script src, ${linkSheets} stylesheet link(s), ${remote.length + cssRemote.length + fetchRemote.length} remote reference(s)${remote.length ? ': ' + remote.slice(0, 2).join(' | ') : ''}`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync(process.execPath, ['--check', f]).status !== 0) bad++; });
  g.gate('LPG1b', 'every inline script block parses', blocks.length > 0 && bad === 0, `${blocks.length} inline block(s), ${bad} failing`);

  const raw = Buffer.byteLength(html);
  g.gate('LPG1c', `raw bytes under the ${RAW_BUDGET} B estate ceiling`, raw <= RAW_BUDGET, `${raw} B`);

  // The game names every key once, in STORE_KEYS; each value must carry the prefix.
  const block = (html.match(/const STORE_KEYS = \{([\s\S]*?)\};/) || [])[1] || '';
  const literalKeys = [...block.matchAll(/:\s*["']([^"']+)["']/g)].map(m => m[1]).sort();
  const unprefixed = literalKeys.filter(k => !k.startsWith(PREFIX));
  g.gate('LPG2a', `every storage key the game names (STORE_KEYS) carries ${PREFIX}`, literalKeys.length >= 10 && unprefixed.length === 0,
    `${literalKeys.length} key(s)${unprefixed.length ? '; unprefixed: ' + unprefixed.join(', ') : ''}`);

  const want = generatedRegion();
  const m = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?<!-- MBM-INLINE-EXIT:END -->\n?/);
  g.gate('LPG3a', 'inline exit region byte-identical to the generator', !!m && m[0] === want,
    m ? `${Buffer.byteLength(m[0])} B in file, ${Buffer.byteLength(want)} B generated` : 'absent');
}

// Visible, hit-testable controls under the floor. Controls on an inactive screen are skipped.
const measure = (page, scope) => page.evaluate(([scope, floor]) => {
  const root = scope ? document.querySelector(scope) : document;
  if (!root) return ['scope ' + scope + ' missing'];
  return [...root.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || s.visibility === 'hidden' || s.display === 'none') return false;
    if (e.closest('.screen') && !e.closest('.screen.active')) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return r.width < floor || r.height < floor;
    const t = document.elementFromPoint(x, y);
    if (!(t === e || e.contains(t))) return false;
    return r.width < floor || r.height < floor;
  }).map(e => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
}, [scope, FLOOR]);

const playScreenOn = page => page.evaluate(() => { const s = document.getElementById('screen-play'); return !!s && s.classList.contains('active'); });
const closeOpenSheets = page => page.evaluate(() => document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open')));

async function browserGates(browser, origin, g) {
  // LPG6a/b + LPG1d + LPG2b: boot, flip sound twice (a write), start a drop, play keys, pause.
  {
    const { ctx, page, errors, external } = await boot(browser, origin, { viewport: { width: 1440, height: 900 } });
    await page.click('#btn-sound-title'); await page.click('#btn-sound-title');
    await page.click('#btn-start-drop');
    await page.waitForTimeout(700);
    const playing = await playScreenOn(page);
    // The first drop opens with the order card or guide; close any sheet, play a few keys, then Escape pauses.
    await closeOpenSheets(page);
    for (const key of ['ArrowRight', 'ArrowDown', 'KeyE']) { await page.keyboard.press(key); await page.waitForTimeout(120); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => { const m = document.getElementById('modal-pause'); return !!m && m.classList.contains('open'); });
    g.gate('LPG6a', 'boots and plays with no page error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    g.gate('LPG6b', 'Start Drop reaches the play screen and Escape opens the pause sheet', playing && paused, `play screen ${playing}, paused ${paused}`);
    g.gate('LPG1d', 'zero non-same-origin requests while booted and played', external.length === 0, external.slice(0, 3).join(' | ') || '0 requests left the page origin');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const game = keys.filter(k => !ESTATE_KEYS_LIST.includes(k));
    const bad = game.filter(k => !k.startsWith(PREFIX));
    g.gate('LPG2b', 'every localStorage key written while played carries the prefix', game.length >= 1 && bad.length === 0,
      `${game.length} game key(s): ${game.join(', ')}${bad.length ? '; unprefixed: ' + bad.join(', ') : ''}`);
    await ctx.close();
  }

  // LPG6c: storage blocked (private mode, locked-down device): still boots and starts.
  {
    const { ctx, page, errors } = await boot(browser, origin, { viewport: { width: 1440, height: 900 }, blockStorage: true });
    const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (_) { return true; } });
    let playing = false;
    try { await page.click('#btn-start-drop', { timeout: 3000 }); await page.waitForTimeout(500); playing = await playScreenOn(page); } catch (_) {}
    g.gate('LPG6c', 'with storage blocked it boots and starts a drop without a page error', blocked && playing && errors.length === 0,
      `storage blocked ${blocked}, play screen ${playing}, ${errors.length} error(s)${errors.length ? ': ' + errors[0] : ''}`);
    await ctx.close();
  }

  // LPG3 + LPG4 at three widths.
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
    for (; tabs < 16 && !reached; tabs++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back');
    }
    g.gate(`LPG3b@${w}`, 'exit rendered at 44 px or more, on top, keyboard reachable',
      !!ex && ex.w >= 44 && ex.h >= 44 && ex.onTop && reached && !!ex.href && ex.href !== '#',
      ex ? `${Math.round(ex.w)}x${Math.round(ex.h)}, onTop=${ex.onTop}, href=${ex.href}, Tab x${tabs}${reached ? '' : ' (not reached)'}` : 'absent');

    const title = await measure(page, '#screen-title');
    await page.click('#btn-start-drop');
    await page.waitForTimeout(600);
    await closeOpenSheets(page);
    await page.waitForTimeout(150);
    const play = await measure(page, '#screen-play');
    const clear = await page.evaluate(() => { const e = document.getElementById('mbmexit-back'), l = document.querySelector('#screen-play .logo-mini'); if (!e || !l) return null; return { exitRight: Math.round(e.getBoundingClientRect().right), logoLeft: Math.round(l.getBoundingClientRect().left) }; });
    g.gate(`LPG3c@${w}`, 'the exit does not cover the play-screen logo', !!clear && clear.logoLeft >= clear.exitRight, clear ? `exit right ${clear.exitRight}, logo left ${clear.logoLeft}` : 'absent');
    const small = [...title.map(s => 'title ' + s), ...play.map(s => 'play ' + s)];
    g.gate(`LPG4@${w}`, 'every visible button and input is 44 px or more (title, play)', small.length === 0, small.slice(0, 4).join(' | ') || 'none under 44 px');
    await ctx.close();
  }

  // LPG5: reduced motion against a no-preference control.
  const motion = {};
  for (const rm of ['no-preference', 'reduce']) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: 1440, height: 900 }, reducedMotion: rm });
    motion[rm] = await page.evaluate(() => { const b = document.getElementById('btn-calm-title'); return { calm: document.body.classList.contains('calm-mode'), pressed: b ? b.getAttribute('aria-pressed') : null }; });
    await ctx.close();
  }
  const on = motion['no-preference'], off = motion.reduce;
  g.gate('LPG5', 'reduced motion turns Calm Mode on by default; the no-preference control leaves it off',
    !on.calm && on.pressed === 'false' && off.calm && off.pressed === 'true',
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
    { gate: 'LPG1a', why: 'add a CDN script tag', mutate: s => s.replace('</head>', '<script src="https://cdn.example.invalid/x.js"></script>\n</head>') },
    { gate: 'LPG1b', why: 'introduce a syntax error', mutate: s => s.replace('const modals = {', 'const modals = {{') },
    { gate: 'LPG1d', why: 'fetch a remote resource at boot', mutate: s => s.replace('</body>', '<img alt="" src="ht' + 'tp://198.51.100.1/p.gif">\n</body>') },
    { gate: 'LPG2a', why: 'name one key without the prefix', mutate: s => s.replace("sound: 'mbm_layerpress_sound',", "sound: 'lp_sound',") },
    { gate: 'LPG2b', why: 'write the sound setting under an unprefixed key', mutate: s => s.replace("sound: 'mbm_layerpress_sound',", "sound: 'lp_sound',") },
    { gate: 'LPG3a', why: 'hand-edit one byte of the exit region', mutate: s => s.replace(region, region.replace('width:44px', 'width:43px')) },
    { gate: 'LPG3b@390', why: 'shrink the exit control', mutate: s => s.replace('</head>', '<style>#mbmexit-back{width:30px!important;height:30px!important;min-width:0!important;min-height:0!important}</style>\n</head>') },
    { gate: 'LPG3c@1440', why: 'drop the top-bar padding that clears the exit', mutate: s => s.replace('  .topbar .topbar-left { padding-left: 46px; }\n', '') },
    { gate: 'LPG4@390', why: 'shrink one title-screen button below 44 px', mutate: s => s.replace('</head>', '<style>#btn-howto-title{min-width:0!important;min-height:0!important;width:30px!important;height:30px!important;padding:0!important}</style>\n</head>') },
    { gate: 'LPG5', why: 'ignore the reduced-motion preference', mutate: s => s.replace("window.matchMedia('(prefers-reduced-motion: reduce)').matches", 'false') },
    { gate: 'LPG6a', why: 'throw at boot', mutate: s => s.replace('const modals = {', 'throw new Error("boom");\n  const modals = {') },
    { gate: 'LPG6b', why: 'unwire the Start Drop button', mutate: s => s.replace("$('btn-start-drop').addEventListener('click',", "$('btn-start-drop').addEventListener('dblclick',") },
    { gate: 'LPG6c', why: 'read storage without the guard', mutate: s => s.replace('function safeGet(key, fallback = null) {\n', 'function safeGet(key, fallback = null) {\n    window.localStorage.getItem(key);\n') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-self-'));
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
    say(`Layer Press gates - ${path.relative(ROOT, GAME) || GAME} (${fs.statSync(GAME).size} B)`);
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
