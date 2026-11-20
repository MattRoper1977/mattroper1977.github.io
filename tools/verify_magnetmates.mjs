#!/usr/bin/env node
/**
 * verify_magnetmates.mjs - the gate harness for Magnet Mates (/magnetmates/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate has a
 * firing control in --selftest: the same gate run on a deliberately broken
 * copy must go red, or the run fails as MEASUREMENT INVALID.
 *
 *   node tools/verify_magnetmates.mjs [path/to/index.html] [--selftest]
 *
 * MMG1  single file: no <script src>, no stylesheet link, no remote URL in the
 *       source, and zero non-same-origin requests while a shift is played.
 * MMG2  storage goes only through safeGet/safeSet, which add mbm_magnetmates_;
 *       every key written at runtime carries that prefix.
 * MMG3  generated inline exit: region byte-identical to the generator,
 *       rendered at 44 px or more, on top, reachable by keyboard; and the
 *       canvas score, streak and timer pills clear both the exit and the
 *       game's own button bar (read from the canvas pixels).
 * MMG4  every visible button and input on the title screen and in the arena
 *       is 44 px or more at 390, 768 and 1366 wide.
 * MMG5  reduced motion turns Calm Mode on by default (body.calm-mode and the
 *       toggle say so), proven against a no-preference negative control.
 * MMG6  boots without a page error; Play reaches the arena and Escape opens
 *       the pause screen; with storage blocked it still boots and starts
 *       without a page error.
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
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'magnetmates', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PREFIX = 'mbm_magnetmates_';
// Estate keys the generated inline exit region may touch. Never the game's.
const ESTATE_KEYS = new Set(['mbm_audience_view']);
const RAW_BUDGET = 409600;
const VIEWPORTS = [[390, 844], [768, 1024], [1366, 768]];
const PILL_VIEWPORTS = [[768, 1024], [1280, 720], [1366, 768], [1920, 1080]];
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
    if (url === '/magnetmates/' || url === '/magnetmates/index.html') {
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
  await page.goto(origin + '/magnetmates/');
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
  g.gate('MMG1a', 'single file: no script src, no stylesheet link, no remote URL in the source',
    remote.length + cssRemote.length + fetchRemote.length + srcTags + linkSheets === 0,
    `${srcTags} script src, ${linkSheets} stylesheet link(s), ${remote.length + cssRemote.length + fetchRemote.length} remote reference(s)${remote.length ? ': ' + remote.slice(0, 2).join(' | ') : ''}`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync(process.execPath, ['--check', f]).status !== 0) bad++; });
  g.gate('MMG1b', 'every inline script block parses', blocks.length > 0 && bad === 0, `${blocks.length} inline block(s), ${bad} failing`);

  const raw = Buffer.byteLength(html);
  g.gate('MMG1c', `raw bytes under the ${RAW_BUDGET} B estate ceiling`, raw <= RAW_BUDGET, `${raw} B`);

  // The game reaches storage only through safeGet/safeSet, which add STORAGE_PREFIX.
  // So: the prefix is ours, and outside the generated exit region the only storage
  // touches are the two inside those helpers.
  const region = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?<!-- MBM-INLINE-EXIT:END -->\n?/);
  const game = region ? html.replace(region[0], '') : html;
  const prefix = (game.match(/const STORAGE_PREFIX = ["']([^"']*)["'];/) || [])[1];
  const touches = (game.match(/\b(?:localStorage|sessionStorage)\b/g) || []).length;
  const keys = [...new Set([...game.matchAll(/\b(?:safeGet|safeSet|loadInt|loadJson)\(\s*["']([a-z0-9_]+)["']/g)].map(m => m[1]))].sort();
  g.gate('MMG2a', `storage goes only through the prefixed helpers (STORAGE_PREFIX ${PREFIX})`, prefix === PREFIX && touches === 2 && keys.length >= 10,
    `prefix ${JSON.stringify(prefix)}, ${touches} direct storage touch(es) (want 2, both in the helpers), ${keys.length} named key(s)`);

  const want = generatedRegion();
  g.gate('MMG3a', 'inline exit region byte-identical to the generator', !!region && region[0] === want,
    region ? `${Buffer.byteLength(region[0])} B in file, ${Buffer.byteLength(want)} B generated` : 'absent');
}

// Visible, hit-testable controls under the floor. Controls inside a hidden screen or bar are skipped.
const measure = page => page.evaluate(floor => {
  return [...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || s.visibility === 'hidden' || s.display === 'none') return false;
    if (e.closest('.hidden')) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return r.width < floor || r.height < floor;
    const t = document.elementFromPoint(x, y);
    if (!(t === e || e.contains(t))) return false;
    return r.width < floor || r.height < floor;
  }).map(e => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
}, FLOOR);

const hidden = (page, id) => page.evaluate(id => { const e = document.getElementById(id); return !e || e.classList.contains('hidden'); }, id);
const playing = async page => (await hidden(page, 'screenTitle')) && !(await hidden(page, 'hudBar'));

// Canvas evidence for the top pills: count drawn pixels in the HUD row (canvas rows
// 9 to 55 of 720) under the exit (when the exit sits over that row) and under the
// game's own button bar. Both must be empty; the gap between must hold the pills.
const pillInk = page => page.evaluate(() => {
  const c = document.getElementById('gameCanvas'); const cr = c.getBoundingClientRect();
  const ex = (document.getElementById('mbmexit-home') || document.getElementById('mbmexit-back')).getBoundingClientRect();
  const hb = document.getElementById('hudBar').getBoundingClientRect();
  const px = c.width / cr.width, unit = cr.height / 720;
  const y0 = Math.round(9 * unit * px), y1 = Math.round(55 * unit * px);
  const data = c.getContext('2d').getImageData(0, y0, c.width, y1 - y0).data;
  const ink = (a, b) => { let n = 0; const x0 = Math.max(0, Math.floor(a * px)), x1 = Math.min(c.width, Math.ceil(b * px));
    for (let y = 0; y < y1 - y0; y++) for (let x = x0; x < x1; x++) { const i = (y * c.width + x) * 4;
      if (Math.abs(data[i] - 12) + Math.abs(data[i + 1] - 20) + Math.abs(data[i + 2] - 37) > 60) n++; } return n; };
  const exitOverRow = ex.bottom > cr.top && ex.top < cr.top + 64 * unit;
  const exitBand = exitOverRow ? Math.ceil(ex.right + 4 - cr.left) : 0;
  const barBand = Math.floor(hb.left - 4 - cr.left);
  return { exitOverRow, underExit: exitBand > 0 ? ink(0, exitBand) : 0, underBar: ink(barBand, cr.width), between: ink(exitBand, barBand), exitRight: Math.round(ex.right), barLeft: Math.round(hb.left) };
});

async function browserGates(browser, origin, g) {
  // MMG6a/b + MMG1d + MMG2b: boot, flip sound twice (a write), start a shift, play keys, pause.
  {
    const { ctx, page, errors, external } = await boot(browser, origin, { viewport: { width: 1366, height: 768 } });
    await page.click('#btnTitleSound'); await page.click('#btnTitleSound');
    await page.click('#btnPlay');
    await page.waitForTimeout(700);
    const on = await playing(page);
    for (const key of ['KeyD', 'ArrowLeft', 'Space']) { await page.keyboard.press(key); await page.waitForTimeout(120); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const paused = !(await hidden(page, 'screenPause'));
    g.gate('MMG6a', 'boots and plays with no page error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    g.gate('MMG6b', 'Play reaches the arena and Escape opens the pause screen', on && paused, `arena ${on}, paused ${paused}`);
    g.gate('MMG1d', 'zero non-same-origin requests while booted and played', external.length === 0, external.slice(0, 3).join(' | ') || '0 requests left the page origin');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const game = keys.filter(k => !ESTATE_KEYS_LIST.includes(k));
    const bad = game.filter(k => !k.startsWith(PREFIX));
    g.gate('MMG2b', 'every localStorage key written while played carries the prefix', game.length >= 1 && bad.length === 0,
      `${game.length} game key(s): ${game.join(', ')}${bad.length ? '; unprefixed: ' + bad.join(', ') : ''}`);
    await ctx.close();
  }

  // MMG6c: storage blocked (private mode, locked-down device): still boots and starts.
  {
    const { ctx, page, errors } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, blockStorage: true });
    const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (_) { return true; } });
    let on = false;
    try { await page.click('#btnPlay', { timeout: 3000 }); await page.waitForTimeout(500); on = await playing(page); } catch (_) {}
    g.gate('MMG6c', 'with storage blocked it boots and starts a shift without a page error', blocked && on && errors.length === 0,
      `storage blocked ${blocked}, arena ${on}, ${errors.length} error(s)${errors.length ? ': ' + errors[0] : ''}`);
    await ctx.close();
  }

  // MMG3b + MMG4 at three widths.
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
    g.gate(`MMG3b@${w}`, 'exit rendered at 44 px or more, on top, keyboard reachable',
      !!ex && ex.w >= 44 && ex.h >= 44 && ex.onTop && reached && !!ex.href && ex.href !== '#',
      ex ? `${Math.round(ex.w)}x${Math.round(ex.h)}, onTop=${ex.onTop}, href=${ex.href}, Tab x${tabs}${reached ? '' : ' (not reached)'}` : 'absent');
    const title = await measure(page);
    await page.click('#btnPlay');
    await page.waitForTimeout(600);
    const play = await measure(page);
    const small = [...title.map(s => 'title ' + s), ...play.map(s => 'arena ' + s)];
    g.gate(`MMG4@${w}`, 'every visible button and input is 44 px or more (title, arena)', small.length === 0, small.slice(0, 4).join(' | ') || 'none under 44 px');
    await ctx.close();
  }

  // MMG3c: the canvas pills clear the exit and the button bar. At phone width the
  // game's own bar spans the whole HUD row, so the check runs where the row has room.
  for (const [w, h] of PILL_VIEWPORTS) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: w, height: h } });
    await page.click('#btnPlay');
    await page.waitForTimeout(700);
    const p = await pillInk(page);
    g.gate(`MMG3c@${w}`, 'the score, streak and timer pills clear the exit and the button bar',
      p.underExit === 0 && p.underBar === 0 && p.between >= 500,
      `exit over row ${p.exitOverRow} (right ${p.exitRight}), bar left ${p.barLeft}; ink under exit ${p.underExit}, under bar ${p.underBar}, between ${p.between}`);
    await ctx.close();
  }

  // MMG5: reduced motion against a no-preference control.
  const motion = {};
  for (const rm of ['no-preference', 'reduce']) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, reducedMotion: rm });
    motion[rm] = await page.evaluate(() => { const b = document.getElementById('btnTitleCalm'); return { calm: document.body.classList.contains('calm-mode'), pressed: b ? b.getAttribute('aria-pressed') : null }; });
    await ctx.close();
  }
  const on = motion['no-preference'], off = motion.reduce;
  g.gate('MMG5', 'reduced motion turns Calm Mode on by default; the no-preference control leaves it off',
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
    { gate: 'MMG1a', why: 'add a CDN script tag', mutate: s => s.replace('</head>', '<script src="https://cdn.example.invalid/x.js"></script>\n</head>') },
    { gate: 'MMG1b', why: 'introduce a syntax error', mutate: s => s.replace('const memStore = Object.create(null);', 'const memStore = Object.create(null));') },
    { gate: 'MMG1d', why: 'fetch a remote resource at boot', mutate: s => s.replace('</body>', '<img alt="" src="ht' + 'tp://198.51.100.1/p.gif">\n</body>') },
    { gate: 'MMG2a', why: 'drop the prefix', mutate: s => s.replace("const STORAGE_PREFIX = 'mbm_magnetmates_';", "const STORAGE_PREFIX = 'mm_';") },
    { gate: 'MMG2b', why: 'write under an unprefixed key', mutate: s => s.replace("const STORAGE_PREFIX = 'mbm_magnetmates_';", "const STORAGE_PREFIX = 'mm_';") },
    { gate: 'MMG3a', why: 'hand-edit one byte of the exit region', mutate: s => s.replace(region, region.replace('width:44px', 'width:43px')) },
    { gate: 'MMG3b@390', why: 'shrink the exit control', mutate: s => s.replace('</head>', '<style>#mbmexit-back{width:30px!important;height:30px!important;min-width:0!important;min-height:0!important}</style>\n</head>') },
    { gate: 'MMG3c@1366', why: 'drop the pill fit that clears the exit', mutate: s => s.replace('    ctx.translate(fit.x, 32);\n    ctx.scale(fit.s, fit.s);\n    ctx.translate(-14, -32);\n', '') },
    { gate: 'MMG3c@768', why: 'let the pills run under the button bar', mutate: s => s.replace('    const s = Math.max(0.5, Math.min(1, (end - start) / 726));', '    const s = 1;') },
    { gate: 'MMG4@390', why: 'shrink one title-screen button below 44 px', mutate: s => s.replace('</head>', '<style>#btnHowTo{min-width:0!important;min-height:0!important;width:30px!important;height:30px!important;padding:0!important}</style>\n</head>') },
    { gate: 'MMG5', why: 'ignore the reduced-motion preference', mutate: s => s.replace('!!(reduceMotionMQ && reduceMotionMQ.matches)', 'false') },
    { gate: 'MMG6a', why: 'throw at boot', mutate: s => s.replace('const memStore = Object.create(null);', 'const memStore = Object.create(null);\n  throw new Error("boom");') },
    { gate: 'MMG6b', why: 'unwire the Play button', mutate: s => s.replace("btnPlay.addEventListener('click', () => startShift());", "btnPlay.addEventListener('dblclick', () => startShift());") },
    { gate: 'MMG6c', why: 'read storage without the guard', mutate: s => s.replace('function safeGet(key, fallback) {\n    const full = STORAGE_PREFIX + key;\n', 'function safeGet(key, fallback) {\n    const full = STORAGE_PREFIX + key;\n    window.localStorage.getItem(full);\n') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-self-'));
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
    say(`Magnet Mates gates - ${path.relative(ROOT, GAME) || GAME} (${fs.statSync(GAME).size} B)`);
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
