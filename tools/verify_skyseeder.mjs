#!/usr/bin/env node
/**
 * verify_skyseeder.mjs - the gate harness for Sky Seeder (/skyseeder/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate has a
 * firing control in --selftest: the same gate run on a deliberately broken
 * copy must go red, or the run fails as MEASUREMENT INVALID.
 *
 *   node tools/verify_skyseeder.mjs [path/to/index.html] [--selftest]
 *
 * SSG1  single file: no <script src>, no stylesheet link, no remote URL in the
 *       source, and zero non-same-origin requests while a flight is played.
 * SSG2  storage goes only through safeGet/safeSet (and their JSON wrappers),
 *       whose prefix is mbm_skyseeder_; every key written at runtime carries it.
 * SSG3  generated inline exit: region byte-identical to the generator,
 *       rendered at 44 px or more, on top, reachable by keyboard; and the top
 *       HUD clears the exit (SSG3c) and the home control too (SSG3d).
 * SSG4  every visible button and input on the title screen and in flight is
 *       44 px or more at 390, 768 and 1366 wide.
 * SSG5  reduced motion turns Calm Mode on by default (body.calm-mode and the
 *       toggle say so), proven against a no-preference negative control.
 * SSG6  boots without a page error; Launch reaches the flight and Escape opens
 *       the pause screen; with storage blocked it still boots and launches; the
 *       3D sky islands are drawn (read from a screenshot, decoded in the page).
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
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'skyseeder', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PREFIX = 'mbm_skyseeder_';
// Estate keys the generated inline exit region may touch. Never the game's.
const ESTATE_KEYS = new Set(['mbm_audience_view']);
const RAW_BUDGET = 409600;
const VIEWPORTS = [[390, 844], [768, 1024], [1366, 768]];
const HUD_VIEWPORTS = [[390, 844], [839, 412], [768, 1024], [1280, 720], [1366, 768], [1920, 1080]];
const FLOOR = 44;
// Calibrated below from the shipped file in flight at 1366 and from the no-WebGL control.
const SKY_MIN_COLOURS = 40;

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
    if (url === '/skyseeder/' || url === '/skyseeder/index.html') {
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
  if (opts.home) await ctx.addInitScript(() => { try { localStorage.setItem('mbm_audience_view', 'pupils'); } catch (_) {} });
  await page.goto(origin + '/skyseeder/');
  await page.waitForTimeout(opts.wait || 1500);
  return { ctx, page, errors, external };
}

function staticGates(html, g) {
  const tags = html.match(/<[^>]+>/g) || [];
  const remote = tags.filter(t => /(?:src|href|action|poster)\s*=\s*["']?(?:https?:)?\/\//i.test(t));
  const cssRemote = html.match(/url\(\s*["']?(?:https?:)?\/\//gi) || [];
  const fetchRemote = html.match(/(?:fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(\s*["'`](?:https?|wss?):/gi) || [];
  const srcTags = (html.match(/<script[^>]*\bsrc\s*=/gi) || []).length;
  const linkSheets = tags.filter(t => /^<link\b/i.test(t) && /rel\s*=\s*["']?stylesheet/i.test(t)).length;
  g.gate('SSG1a', 'single file: no script src, no stylesheet link, no remote URL in the source',
    remote.length + cssRemote.length + fetchRemote.length + srcTags + linkSheets === 0,
    `${srcTags} script src, ${linkSheets} stylesheet link(s), ${remote.length + cssRemote.length + fetchRemote.length} remote reference(s)${remote.length ? ': ' + remote.slice(0, 2).join(' | ') : ''}`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync(process.execPath, ['--check', f]).status !== 0) bad++; });
  g.gate('SSG1b', 'every inline script block parses', blocks.length > 0 && bad === 0, `${blocks.length} inline block(s), ${bad} failing`);

  const raw = Buffer.byteLength(html);
  g.gate('SSG1c', `raw bytes under the ${RAW_BUDGET} B estate ceiling`, raw <= RAW_BUDGET, `${raw} B`);

  // The game reaches storage only through safeGet/safeSet, whose two direct touches
  // (getItem and setItem) sit inside those helpers and add STORE_PREFIX. Every helper
  // call names a bare literal key or passes the helper's own key parameter through.
  const region = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?<!-- MBM-INLINE-EXIT:END -->\n?/);
  const game = region ? html.replace(region[0], '') : html;
  const touches = (game.match(/\b(?:localStorage|sessionStorage)\b/g) || []).length;
  const helperTouches = (game.match(/window\.localStorage\.(?:getItem|setItem)\(STORE_PREFIX \+ key/g) || []).length;
  const prefix = (game.match(/const STORE_PREFIX = ["']([^"']*)["'];/) || [])[1];
  const calls = [...game.matchAll(/\bsafe(?:Get|Set)(?:JSON)?\(\s*([^,)]+)/g)].map(m => m[1].trim());
  const literals = [...new Set(calls.filter(a => /^["'][a-z_]+["']$/.test(a)).map(a => a.slice(1, -1)))];
  const loose = calls.filter(a => !/^["'][a-z_]+["']$/.test(a) && a !== 'key');
  g.gate('SSG2a', `storage goes only through safeGet/safeSet and the ${PREFIX} prefix`,
    touches === 2 && helperTouches === 2 && prefix === PREFIX && literals.length >= 9 && loose.length === 0,
    `${touches} direct storage touch(es) (want 2, both in the helpers), prefix ${JSON.stringify(prefix)}, ${literals.length} literal key(s)${loose.length ? '; not a literal key: ' + loose.slice(0, 3).join(', ') : ''}`);

  const want = generatedRegion();
  g.gate('SSG3a', 'inline exit region byte-identical to the generator', !!region && region[0] === want,
    region ? `${Buffer.byteLength(region[0])} B in file, ${Buffer.byteLength(want)} B generated` : 'absent');
}

// Visible, hit-testable controls under the floor. Controls inside a hidden or inert screen are skipped.
const measure = page => page.evaluate(floor => {
  return [...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || s.visibility === 'hidden' || s.display === 'none') return false;
    if (e.closest('.is-hidden,[inert]')) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const t = document.elementFromPoint(x, y);
    if (!(t === e || e.contains(t))) return false;
    return r.width < floor || r.height < floor;
  }).map(e => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
}, FLOOR);

const shown = (page, id) => page.evaluate(id => { const e = document.getElementById(id); return !!e && !e.classList.contains('is-hidden'); }, id);
const playing = async page => !(await shown(page, 'titleOverlay')) && (await shown(page, 'hud'));

// A broken copy (no WebGL, a throw at boot) may never draw these controls; a missing
// control must turn its gate red, not stop the run.
async function tryClick(page, sel) {
  try { await page.click(sel, { timeout: 3000 }); return true; } catch (_) { return false; }
}

async function startRound(page) {
  const clicked = await tryClick(page, '#btnStartFlight');
  await page.waitForTimeout(700);
  return clicked;
}

// The top HUD's pills and buttons must not sit under the estate exit (and the home
// control, when a homepage is chosen). Read from the rendered rectangles.
const hudClear = page => page.evaluate(() => {
  const exits = ['mbmexit-back', 'mbmexit-home'].map(id => document.getElementById(id)).filter(Boolean).map(e => e.getBoundingClientRect());
  const items = [...document.querySelectorAll('#hud .hud-top .hud-pill, #hud .hud-top .hud-btn')].map(e => ({ id: e.id || e.className, r: e.getBoundingClientRect() })).filter(o => o.r.width > 0);
  const under = items.filter(o => exits.some(x => o.r.left < x.right && o.r.right > x.left && o.r.top < x.bottom && o.r.bottom > x.top)).map(o => o.id);
  const firstLeft = Math.min(...items.map(o => o.r.left));
  return { exits: exits.length, exitRight: Math.round(Math.max(...exits.map(x => x.right))), items: items.length, firstLeft: Math.round(firstLeft), under };
});

// Evidence that the 3D sky islands are drawn: a screenshot of the page in flight,
// decoded in the page itself, must hold many distinct colours.
async function skyInk(page) {
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
    return { colours: seen.size };
  }, png);
}

async function browserGates(browser, origin, g) {
  // SSG6a/b/d + SSG1d + SSG2b: boot, flip sound twice (a write), launch, fly keys, pause.
  {
    const { ctx, page, errors, external } = await boot(browser, origin, { viewport: { width: 1366, height: 768 } });
    await tryClick(page, '#btnTitleSound'); await tryClick(page, '#btnTitleSound');
    await startRound(page);
    const on = await playing(page);
    for (const key of ['KeyD', 'ArrowLeft', 'Space', 'KeyW']) { await page.keyboard.press(key); await page.waitForTimeout(120); }
    await page.waitForTimeout(400);
    const ink = on ? await skyInk(page) : { colours: 0 };
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const paused = await shown(page, 'pauseOverlay');
    g.gate('SSG6a', 'boots and plays with no page error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    g.gate('SSG6b', 'Launch reaches the flight and Escape opens the pause screen', on && paused, `flight ${on}, paused ${paused}`);
    g.gate('SSG6d', 'the 3D sky islands are drawn (many distinct colours)', ink.colours >= SKY_MIN_COLOURS,
      `${ink.colours} distinct colours (want ${SKY_MIN_COLOURS} or more)`);
    g.gate('SSG1d', 'zero non-same-origin requests while booted and played', external.length === 0, external.slice(0, 3).join(' | ') || '0 requests left the page origin');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const game = keys.filter(k => !ESTATE_KEYS_LIST.includes(k));
    const bad = game.filter(k => !k.startsWith(PREFIX));
    g.gate('SSG2b', 'every localStorage key written while played carries the prefix', game.length >= 1 && bad.length === 0,
      `${game.length} game key(s): ${game.join(', ')}${bad.length ? '; unprefixed: ' + bad.join(', ') : ''}`);
    await ctx.close();
  }

  // SSG6c: storage blocked (private mode, locked-down device): still boots and launches.
  {
    const { ctx, page, errors } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, blockStorage: true });
    const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (_) { return true; } });
    let on = false;
    if (await tryClick(page, '#btnStartFlight')) { await page.waitForTimeout(500); on = await playing(page); }
    g.gate('SSG6c', 'with storage blocked it boots and launches without a page error', blocked && on && errors.length === 0,
      `storage blocked ${blocked}, flight ${on}, ${errors.length} error(s)${errors.length ? ': ' + errors[0] : ''}`);
    await ctx.close();
  }

  // SSG3b + SSG4 at three widths.
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
    for (; tabs < 24 && !reached; tabs++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back');
    }
    g.gate(`SSG3b@${w}`, 'exit rendered at 44 px or more, on top, keyboard reachable',
      !!ex && ex.w >= 44 && ex.h >= 44 && ex.onTop && reached && !!ex.href && ex.href !== '#',
      ex ? `${Math.round(ex.w)}x${Math.round(ex.h)}, onTop=${ex.onTop}, href=${ex.href}, Tab x${tabs}${reached ? '' : ' (not reached)'}` : 'absent');
    const title = await measure(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await startRound(page);
    const play = await measure(page);
    const small = [...title.map(s => 'title ' + s), ...play.map(s => 'flight ' + s)];
    g.gate(`SSG4@${w}`, 'every visible button and input is 44 px or more (title, flight)', small.length === 0, small.slice(0, 4).join(' | ') || 'none under 44 px');
    await ctx.close();
  }

  // SSG3c (back only) and SSG3d (back + home): the top HUD clears the exit in flight.
  for (const home of [false, true]) {
    for (const [w, h] of HUD_VIEWPORTS) {
      const { ctx, page } = await boot(browser, origin, { viewport: { width: w, height: h }, home });
      await startRound(page);
      const c = await hudClear(page);
      g.gate(`${home ? 'SSG3d' : 'SSG3c'}@${w}`, `the top HUD clears the exit${home ? ' and the home control' : ''}`,
        c.exits === (home ? 2 : 1) && c.items >= 4 && c.under.length === 0 && c.firstLeft > c.exitRight,
        `${c.exits} exit control(s) (right edge ${c.exitRight}), ${c.items} HUD item(s), first starts at ${c.firstLeft}${c.under.length ? '; under the exit: ' + c.under.join(', ') : ''}`);
      await ctx.close();
    }
  }

  // SSG5: reduced motion against a no-preference control.
  const motion = {};
  for (const rm of ['no-preference', 'reduce']) {
    const { ctx, page } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, reducedMotion: rm });
    motion[rm] = await page.evaluate(() => { const b = document.getElementById('btnTitleCalm'); return { calm: document.body.classList.contains('calm-mode'), pressed: b ? b.getAttribute('aria-pressed') : null }; });
    await ctx.close();
  }
  const on = motion['no-preference'], off = motion.reduce;
  g.gate('SSG5', 'reduced motion turns Calm Mode on by default; the no-preference control leaves it off',
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
  const BOOT = 'const STORE_PREFIX = "mbm_skyseeder_";';
  const cases = [
    { gate: 'SSG1a', why: 'add a CDN script tag', mutate: s => s.replace('</head>', '<script src="https://cdn.example.invalid/x.js"></script>\n</head>') },
    { gate: 'SSG1b', why: 'introduce a syntax error', mutate: s => s.replace(BOOT, BOOT + ')') },
    { gate: 'SSG1d', why: 'fetch a remote resource at boot', mutate: s => s.replace('</body>', '<img alt="" src="ht' + 'tp://198.51.100.1/p.gif">\n</body>') },
    { gate: 'SSG2a', why: 'save under a prefix that is not the game\'s', mutate: s => s.replace(BOOT, 'const STORE_PREFIX = "ss_";') },
    { gate: 'SSG2b', why: 'write under an unprefixed key', mutate: s => s.replace(BOOT, 'const STORE_PREFIX = "ss_";') },
    { gate: 'SSG3a', why: 'hand-edit one byte of the exit region', mutate: s => s.replace(region, region.replace('width:44px', 'width:43px')) },
    { gate: 'SSG3b@390', why: 'shrink the exit control', mutate: s => s.replace('</head>', '<style>#mbmexit-back{width:30px!important;height:30px!important;min-width:0!important;min-height:0!important}</style>\n</head>') },
    { gate: 'SSG3c@1366', why: 'pull the top HUD back under the exit', mutate: s => s.replace('</head>', '<style>.hud-top-stack{left:10px!important}</style>\n</head>') },
    { gate: 'SSG3d@1366', why: 'drop the wider offset for the home control', mutate: s => s.replace('  body:has(#mbmexit-home) .hud-top-stack { left: 110px; }\n', '') },
    { gate: 'SSG4@768', why: 'shrink the Launch button below 44 px', mutate: s => s.replace('</head>', '<style>#btnStartFlight{min-width:0!important;min-height:0!important;width:30px!important;height:30px!important;padding:0!important;overflow:hidden!important}</style>\n</head>') },
    { gate: 'SSG5', why: 'ignore the reduced-motion preference', mutate: s => s.replace('window.matchMedia("(prefers-reduced-motion: reduce)").matches', 'false') },
    { gate: 'SSG6a', why: 'throw at boot', mutate: s => s.replace(BOOT, BOOT + '\n  throw new Error("boom");') },
    { gate: 'SSG6b', why: 'unwire the Launch button', mutate: s => s.replace('document.getElementById("btnStartFlight").addEventListener("click",', 'document.getElementById("btnStartFlight").addEventListener("dblclick",') },
    { gate: 'SSG6c', why: 'read storage without the guard', mutate: s => s.replace(BOOT, BOOT + '\n  window.localStorage.getItem("mbm_skyseeder_calm");') },
    { gate: 'SSG6d', why: 'never draw the sky', mutate: s => s.replace('const gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" }) ||', 'const gl = null && canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" }) ||') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-self-'));
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
  // WebGL in headless Chromium needs SwiftShader, as tools/verify_2c_games.mjs does.
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    say(`Sky Seeder gates - ${path.relative(ROOT, GAME) || GAME} (${fs.statSync(GAME).size} B)`);
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
