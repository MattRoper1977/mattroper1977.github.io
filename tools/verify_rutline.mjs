#!/usr/bin/env node
/**
 * verify_rutline.mjs - the gate harness for Rutline (/rutline/).
 *
 * Runs against the shipped file, never an extracted copy. Every gate has a
 * firing control in --selftest: the same gate run on a deliberately broken
 * copy must go red, or the run fails as MEASUREMENT INVALID.
 *
 *   node tools/verify_rutline.mjs [path/to/index.html] [--selftest]
 *
 * RLG1  single file: no <script src>, no stylesheet link, no remote URL in the
 *       source beyond the page's own canonical and og:url, and zero
 *       non-same-origin requests while a ride is played.
 * RLG2  storage goes only through the Storage helper, whose prefix is
 *       mbm_rutline_; every key written at runtime carries it.
 * RLG3  generated inline exit: region byte-identical to the generator,
 *       rendered at 44 px or more, on top, reachable by keyboard; the title
 *       card and the top HUD clear the exit (RLG3c) and the home control too
 *       (RLG3d).
 * RLG4  every visible button and input on the title screen and in play is
 *       44 px or more at 390, 768 and 1366 wide.
 * RLG5  Rider Assist is on by default (state and title button agree), proven
 *       against a control where a stored "off" is read back as off; and the
 *       first story chapter is the warm-up delivery ride.
 * RLG6  boots without a page error; Free Roam reaches the ride and Menu opens
 *       the pause card; with storage blocked it still boots and starts; the
 *       valley is drawn (read from a screenshot of the WebGL canvas alone).
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
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'rutline', 'index.html');
const SELFTEST = process.argv.includes('--selftest');
const PREFIX = 'mbm_rutline_';
const LEGACY_PREFIX = 'rutline_v03_';
// Estate keys the generated inline exit region may touch. Never the game's.
const ESTATE_KEYS = ['mbm_audience_view'];
// Rutline embeds its ground, bike and scenery textures as data URIs, so the script-only
// estate ceiling cannot hold it. This is its own declared ceiling: growth past it needs a
// ruling, not a quiet edit here.
const RAW_BUDGET = 2 * 1024 * 1024;
const OWN_URL = 'https://madebymatt.uk/rutline/';
const VIEWPORTS = [[390, 844], [768, 1024], [1366, 768]];
const HUD_VIEWPORTS = [[360, 740], [390, 844], [839, 412], [640, 360], [768, 1024], [1280, 720], [1366, 768], [1920, 1080]];
const FLOOR = 44;
// Calibrated on the canvas alone at 1366: the shipped file in free roam gives several
// hundred distinct colours, the no-WebGL control gives 1.
const VALLEY_MIN_COLOURS = 60;

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
    if (url === '/rutline/' || url === '/rutline/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(204); res.end();
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function boot(browser, origin, opts = {}) {
  const viewport = opts.viewport || { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport, hasTouch: !!opts.touch });
  const errors = [], external = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  // Record, then refuse, anything that leaves the origin: the request is still counted,
  // and a runner with no outbound network cannot hang the load event on it.
  await ctx.route(u => !String(u).startsWith(origin) && !/^(data|blob):/.test(String(u)), r => r.abort());
  if (opts.blockStorage) await ctx.addInitScript(() => { for (const n of ['localStorage', 'sessionStorage']) Object.defineProperty(window, n, { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  if (opts.home) await ctx.addInitScript(() => { try { localStorage.setItem('mbm_audience_view', 'pupils'); } catch (_) {} });
  if (opts.assistOff) await ctx.addInitScript(k => { try { localStorage.setItem(k, 'false'); } catch (_) {} }, PREFIX + 'riderAssist');
  await page.goto(origin + '/rutline/');
  // The game decodes its textures before the title is ready. A broken copy never gets
  // there, so the wait is bounded and the gates judge whatever is on screen.
  try { await page.waitForFunction(() => window.__RUT && window.__RUT.state && window.__RUT.state.extReady, null, { timeout: opts.wait || 20000 }); } catch (_) {}
  await page.waitForTimeout(600);
  return { ctx, page, errors, external };
}

function staticGates(html, g) {
  const tags = html.match(/<[^>]+>/g) || [];
  const remoteAll = tags.filter(t => /(?:src|href|action|poster|content)\s*=\s*["']?(?:https?:)?\/\//i.test(t));
  // The page may name its own address twice: the canonical link and og:url. Nothing else.
  const own = remoteAll.filter(t => (/^<link\b[^>]*rel="canonical"/i.test(t) || /^<meta\b[^>]*property="og:url"/i.test(t)) && t.includes(`"${OWN_URL}"`));
  const remote = remoteAll.filter(t => !own.includes(t));
  const cssRemote = html.match(/url\(\s*["']?(?:https?:)?\/\//gi) || [];
  const fetchRemote = html.match(/(?:fetch|import|XMLHttpRequest|WebSocket|EventSource)\s*\(\s*["'`](?:https?|wss?):/gi) || [];
  const srcTags = (html.match(/<script[^>]*\bsrc\s*=/gi) || []).length;
  const linkSheets = tags.filter(t => /^<link\b/i.test(t) && /rel\s*=\s*["']?stylesheet/i.test(t)).length;
  g.gate('RLG1a', 'single file: no script src, no stylesheet link, no remote URL beyond its own canonical and og:url',
    remote.length + cssRemote.length + fetchRemote.length + srcTags + linkSheets === 0 && own.length === 2,
    `${srcTags} script src, ${linkSheets} stylesheet link(s), ${remote.length + cssRemote.length + fetchRemote.length} remote reference(s), ${own.length} own-address tag(s) (want 2)${remote.length ? ': ' + remote.slice(0, 2).join(' | ') : ''}`);

  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-syn-'));
  let bad = 0;
  blocks.forEach((b, i) => { const f = path.join(tmp, `b${i}.js`); fs.writeFileSync(f, b); if (spawnSync(process.execPath, ['--check', f]).status !== 0) bad++; });
  g.gate('RLG1b', 'every inline script block parses', blocks.length > 0 && bad === 0, `${blocks.length} inline block(s), ${bad} failing`);

  const raw = Buffer.byteLength(html);
  g.gate('RLG1c', `raw bytes under the ${RAW_BUDGET} B ceiling declared for this game`, raw <= RAW_BUDGET, `${raw} B`);

  // The game reaches storage only through Storage.get and Storage.set. The helper holds
  // four direct touches: the read, the one-time read of the old prefix, the copy forward
  // under the new prefix, and the write. Every helper call names a literal key, or a
  // literal family followed by an id ("best_" + route.id).
  const region = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?<!-- MBM-INLINE-EXIT:END -->\n?/);
  const game = region ? html.replace(region[0], '') : html;
  const touches = (game.match(/\b(?:localStorage|sessionStorage)\b/g) || []).length;
  const helperTouches = (game.match(/localStorage\.(?:getItem|setItem)\(this\.(?:prefix|legacyPrefix) \+ key\b/g) || []).length;
  const prefix = (game.match(/const Storage = \{\s*prefix: "([^"]*)"/) || [])[1];
  const legacy = (game.match(/legacyPrefix: "([^"]*)"/) || [])[1];
  const calls = [...game.matchAll(/\bStorage\.(?:get|set)\(\s*([^,)]+)/g)].map(m => m[1].trim());
  const keyed = a => /^"[A-Za-z_]+"$/.test(a) || /^"[a-z]+_" \+ [A-Za-z_.]+$/.test(a);
  const loose = calls.filter(a => !keyed(a));
  g.gate('RLG2a', `storage goes only through the Storage helper and the ${PREFIX} prefix`,
    touches === 4 && helperTouches === 4 && prefix === PREFIX && legacy === LEGACY_PREFIX && calls.length >= 20 && loose.length === 0,
    `${touches} direct storage touch(es) (want 4, all in the helper), prefix ${JSON.stringify(prefix)}, ${calls.length} helper call(s)${loose.length ? '; not a literal key: ' + loose.slice(0, 3).join(', ') : ''}`);

  const want = generatedRegion();
  g.gate('RLG3a', 'inline exit region byte-identical to the generator', !!region && region[0] === want,
    region ? `${Buffer.byteLength(region[0])} B in file, ${Buffer.byteLength(want)} B generated` : 'absent');
}

// Visible, hit-testable controls under the floor. Controls inside a hidden screen are skipped.
const measure = page => page.evaluate(floor => {
  return [...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e => {
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (!(r.width > 0 && r.height > 0) || s.visibility === 'hidden' || s.display === 'none') return false;
    if (e.closest('.hidden,[inert]')) return false;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const t = document.elementFromPoint(x, y);
    if (!(t === e || e.contains(t))) return false;
    return r.width < floor || r.height < floor;
  }).map(e => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
}, FLOOR);

const state = page => page.evaluate(() => { const s = window.__RUT && window.__RUT.state; return s ? { screen: s.screen, modal: s.modal, riderAssist: s.riderAssist } : null; }).catch(() => null);
const shown = (page, id) => page.evaluate(id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.getBoundingClientRect().width > 0; }, id).catch(() => false);
const riding = async page => { const s = await state(page); return !!s && s.screen === 'play' && (await shown(page, 'hud')) && !(await shown(page, 'titleOverlay')); };

// Software WebGL draws this game in slow motion, and a pointer click that waits for a
// steady frame can time out. The click is dispatched in the page instead; a missing or
// hidden control returns false, so its gate turns red and the run carries on.
const press = (page, id) => page.evaluate(id => {
  const e = document.getElementById(id);
  if (!e || e.closest('.hidden') || !(e.getBoundingClientRect().width > 0)) return false;
  e.click(); return true;
}, id).catch(() => false);

async function startRide(page) {
  const clicked = await press(page, 'btnRideNow');
  await page.waitForTimeout(1500);
  return clicked;
}

// Nothing the player reads or presses may sit under the estate exit (or the home control,
// when a homepage is chosen). Read from the rendered rectangles, on the title and in play.
const clearOfExit = (page, where) => page.evaluate(where => {
  const exits = ['mbmexit-back', 'mbmexit-home'].map(id => document.getElementById(id)).filter(Boolean).map(e => e.getBoundingClientRect());
  const sel = where === 'title'
    ? '#titleOverlay .title-card, #titleOverlay button'
    : '#hud #modeStatus, #hud #minimapWrap, #hud .hud-right > *, #callout';
  const items = [...document.querySelectorAll(sel)].filter(e => !e.closest('.hidden') && !e.classList.contains('hidden'))
    .map(e => ({ id: e.id || e.className, r: e.getBoundingClientRect() })).filter(o => o.r.width > 0 && o.r.height > 0);
  const under = items.filter(o => exits.some(x => o.r.left < x.right && o.r.right > x.left && o.r.top < x.bottom && o.r.bottom > x.top)).map(o => o.id);
  return { exits: exits.length, items: items.length, under };
}, where);

// Evidence that the valley is drawn: a screenshot with only the WebGL canvas left visible
// over a flat black page, decoded in the page itself, must hold many distinct colours.
async function valleyInk(page) {
  const veil = await page.addStyleTag({ content: '*{visibility:hidden!important}html,body{background:#000!important}#glCanvas{visibility:visible!important}' });
  await page.waitForTimeout(200);
  const shot = await page.screenshot({ type: 'png' });
  await veil.evaluate(n => n.remove());
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
    return { colours: seen.size };
  }, shot.toString('base64'));
}

// `only` narrows a selftest run to the section that owns the gate under test, so proving
// sixteen controls does not replay every viewport sixteen times.
async function browserGates(browser, origin, g, only) {
  const want = (...ids) => !only || ids.some(id => only === id || only.startsWith(id + '@'));

  // RLG6a/b/d + RLG1d + RLG2b: boot, flip Rider Assist twice (two writes), ride, open the menu.
  if (want('RLG6a', 'RLG6b', 'RLG6d', 'RLG1d', 'RLG2b')) {
    const { ctx, page, errors, external } = await boot(browser, origin, { viewport: { width: 1366, height: 768 } });
    await press(page, 'btnTitleAssist'); await press(page, 'btnTitleAssist');
    await startRide(page);
    const on = await riding(page);
    for (const key of ['KeyW', 'KeyA', 'KeyD']) { await page.keyboard.down(key); await page.waitForTimeout(250); await page.keyboard.up(key); }
    const ink = on ? await valleyInk(page) : { colours: 0 };
    await press(page, 'btnPauseHud');
    await page.waitForTimeout(500);
    const paused = await shown(page, 'pauseOverlay');
    g.gate('RLG6a', 'boots and rides with no page error', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');
    g.gate('RLG6b', 'Free Roam reaches the ride and Menu opens the pause card', on && paused, `ride ${on}, paused ${paused}`);
    g.gate('RLG6d', 'the valley is drawn (many distinct colours on the WebGL canvas)', ink.colours >= VALLEY_MIN_COLOURS,
      `${ink.colours} distinct colours (want ${VALLEY_MIN_COLOURS} or more)`);
    g.gate('RLG1d', 'zero non-same-origin requests while booted and ridden', external.length === 0, external.slice(0, 3).join(' | ') || '0 requests left the page origin');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    const game = keys.filter(k => !ESTATE_KEYS.includes(k));
    const bad = game.filter(k => !k.startsWith(PREFIX));
    g.gate('RLG2b', 'every localStorage key written while played carries the prefix', game.length >= 2 && bad.length === 0,
      `${game.length} game key(s): ${game.join(', ')}${bad.length ? '; unprefixed: ' + bad.join(', ') : ''}`);
    await ctx.close();
  }

  // RLG6c: storage blocked (private mode, locked-down device): still boots and starts.
  if (want('RLG6c')) {
    const { ctx, page, errors } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, blockStorage: true });
    const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (_) { return true; } });
    await startRide(page);
    const on = await riding(page);
    g.gate('RLG6c', 'with storage blocked it boots and starts a ride without a page error', blocked && on && errors.length === 0,
      `storage blocked ${blocked}, ride ${on}, ${errors.length} error(s)${errors.length ? ': ' + errors[0] : ''}`);
    await ctx.close();
  }

  // RLG3b + RLG4 at three widths. The two narrower widths are touch screens, so the
  // on-screen riding controls are part of what is measured.
  for (const [w, h] of VIEWPORTS) {
    if (!want(`RLG3b@${w}`, `RLG4@${w}`)) continue;
    const { ctx, page } = await boot(browser, origin, { viewport: { width: w, height: h }, touch: w < 1000 });
    const ex = await page.evaluate(() => {
      const e = document.getElementById('mbmexit-back');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { w: r.width, h: r.height, onTop: top === e || e.contains(top), href: e.getAttribute('href') };
    });
    let tabs = 0, reached = false;
    for (; tabs < 48 && !reached; tabs++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement && document.activeElement.id === 'mbmexit-back');
    }
    g.gate(`RLG3b@${w}`, 'exit rendered at 44 px or more, on top, keyboard reachable',
      !!ex && ex.w >= 44 && ex.h >= 44 && ex.onTop && reached && !!ex.href && ex.href !== '#',
      ex ? `${Math.round(ex.w)}x${Math.round(ex.h)}, onTop=${ex.onTop}, href=${ex.href}, Tab x${tabs}${reached ? '' : ' (not reached)'}` : 'absent');
    const title = await measure(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
    await startRide(page);
    const on = await riding(page);
    const play = await measure(page);
    const small = [...title.map(s => 'title ' + s), ...play.map(s => 'play ' + s)];
    g.gate(`RLG4@${w}`, 'every visible button and input is 44 px or more (title, play)', on && small.length === 0,
      `${on ? '' : 'the ride did not start; '}${small.slice(0, 4).join(' | ') || 'none under 44 px'}`);
    await ctx.close();
  }

  // RLG3c (back only) and RLG3d (back + home): the title card and the top HUD clear the exit.
  for (const home of [false, true]) {
    for (const [w, h] of HUD_VIEWPORTS) {
      const id = `${home ? 'RLG3d' : 'RLG3c'}@${w}`;
      if (!want(id)) continue;
      const { ctx, page } = await boot(browser, origin, { viewport: { width: w, height: h }, home, touch: w < 1000 && w !== 640 });
      const t = await clearOfExit(page, 'title');
      await startRide(page);
      const on = await riding(page);
      const p = await clearOfExit(page, 'play');
      const under = [...t.under.map(s => 'title ' + s), ...p.under.map(s => 'play ' + s)];
      g.gate(id, `the title card and the top HUD clear the exit${home ? ' and the home control' : ''}`,
        t.exits === (home ? 2 : 1) && on && t.items >= 10 && p.items >= 4 && under.length === 0,
        `${t.exits} exit control(s), ${t.items} title item(s), ${p.items} HUD item(s)${on ? '' : ', the ride did not start'}${under.length ? '; under the exit: ' + under.slice(0, 4).join(', ') : ''}`);
      await ctx.close();
    }
  }

  // RLG5a: Rider Assist is on by default; a stored "off" is read back as off.
  if (want('RLG5a', 'RLG5b')) {
    const seen = {};
    for (const assistOff of [false, true]) {
      const { ctx, page } = await boot(browser, origin, { viewport: { width: 1366, height: 768 }, assistOff });
      const s = await state(page);
      seen[assistOff ? 'stored' : 'fresh'] = {
        assist: s ? s.riderAssist : null,
        label: await page.evaluate(() => { const b = document.getElementById('btnTitleAssist'); return b ? b.textContent.trim() : null; }),
      };
      if (!assistOff) {
        const ch = await page.evaluate(() => { try { const c = STORY_CHAPTERS[0]; return { id: c.id, mode: c.mode, n: STORY_CHAPTERS.length }; } catch (_) { return null; } });
        g.gate('RLG5b', 'the first story chapter is the warm-up delivery ride', !!ch && ch.id === 'st_0' && ch.mode === 'sidedelivery' && ch.n === 8, JSON.stringify(ch));
      }
      await ctx.close();
    }
    const a = seen.fresh, b = seen.stored;
    g.gate('RLG5a', 'Rider Assist is on by default; a stored off is read back as off',
      a.assist === true && /\bON\b/.test(a.label || '') && b.assist === false && /\bOFF\b/.test(b.label || ''),
      `fresh ${JSON.stringify(a)}; stored off ${JSON.stringify(b)}`);
  }
}

async function judge(file, browser, quiet, only) {
  const g = makeRun(quiet);
  const html = fs.readFileSync(file, 'utf8');
  staticGates(html, g);
  const { server, origin } = await serve(file);
  try { await browserGates(browser, origin, g, only); } finally { server.close(); }
  return g.results;
}

async function selftest(html, browser) {
  const region = generatedRegion();
  const BOOT = 'const Storage = {\n  prefix: "mbm_rutline_",';
  const head = css => s => s.replace('</head>', `<style>${css}</style>\n</head>`);
  const cases = [
    { gate: 'RLG1a', why: 'add a CDN script tag', mutate: s => s.replace('</head>', '<script src="https://cdn.example.invalid/x.js"></script>\n</head>') },
    { gate: 'RLG1b', why: 'introduce a syntax error', mutate: s => s.replace(BOOT, 'const Storage = {)\n  prefix: "mbm_rutline_",') },
    { gate: 'RLG1c', why: 'grow past the declared ceiling', mutate: s => s.replace('</body>', '<!--' + 'x'.repeat(RAW_BUDGET - Buffer.byteLength(s) + 1) + '-->\n</body>') },
    { gate: 'RLG1d', why: 'fetch a remote resource at boot', mutate: s => s.replace('</body>', '<img alt="" src="ht' + 'tp://198.51.100.1/p.gif">\n</body>') },
    { gate: 'RLG2a', why: 'save under a prefix that is not the game\'s', mutate: s => s.replace(BOOT, 'const Storage = {\n  prefix: "rl_",') },
    { gate: 'RLG2b', why: 'write under an unprefixed key', mutate: s => s.replace(BOOT, 'const Storage = {\n  prefix: "rl_",') },
    { gate: 'RLG3a', why: 'hand-edit one byte of the exit region', mutate: s => s.replace(region, region.replace('width:44px', 'width:43px')) },
    { gate: 'RLG3b@390', why: 'shrink the exit control', mutate: head('#mbmexit-back{width:30px!important;height:30px!important;min-width:0!important;min-height:0!important}') },
    { gate: 'RLG3c@1366', why: 'pull the top HUD back under the exit', mutate: head('.hud-top{left:0!important}') },
    { gate: 'RLG3d@1366', why: 'leave room for the exit but not for the home control', mutate: head('.hud-top{left:56px!important}') },
    { gate: 'RLG4@768', why: 'shrink the Free Roam button below 44 px', mutate: head('#btnRideNow{min-width:0!important;min-height:0!important;width:30px!important;height:30px!important;padding:0!important;overflow:hidden!important}') },
    { gate: 'RLG5a', why: 'ship with Rider Assist off', mutate: s => s.replace('riderAssist: Storage.get("riderAssist", true)', 'riderAssist: Storage.get("riderAssist", false)') },
    { gate: 'RLG5b', why: 'open the story on a quiet run, not the warm-up', mutate: s => s.replace('id:"st_0", num:1, title:"Ch. 1: Valley Warm-Up Ride", mode:"sidedelivery"', 'id:"st_0", num:1, title:"Ch. 1: Valley Warm-Up Ride", mode:"ghostrun"') },
    { gate: 'RLG6a', why: 'throw at boot', mutate: s => s.replace(BOOT, 'throw new Error("boom");\n' + BOOT) },
    { gate: 'RLG6b', why: 'unwire the Free Roam button', mutate: s => s.replace('on("btnRideNow", () => this.launchMode("freeroam", 0));', '') },
    { gate: 'RLG6c', why: 'read storage without the guard', mutate: s => s.replace(BOOT, 'window.localStorage.getItem("mbm_rutline_credits");\n' + BOOT) },
    { gate: 'RLG6d', why: 'never get a WebGL context', mutate: s => s.replace('const gl = canvas.getContext("webgl2", { antialias:false, alpha:false, powerPreference:"high-performance", preserveDrawingBuffer:true });', 'const gl = null;') },
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-self-'));
  let vacuous = 0;
  for (const c of cases) {
    const mutated = c.mutate(html);
    if (mutated === html) { say(`VACUOUS  ${c.gate} control - the mutation "${c.why}" did not change the file`); vacuous++; continue; }
    const f = path.join(dir, 'index.html');
    fs.writeFileSync(f, mutated);
    const res = await judge(f, browser, true, c.gate);
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
  // Rutline is WebGL2: SwiftShader gives a headless runner a software context to draw with.
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    say(`Rutline gates - ${path.relative(ROOT, GAME) || GAME} (${fs.statSync(GAME).size} B)`);
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
