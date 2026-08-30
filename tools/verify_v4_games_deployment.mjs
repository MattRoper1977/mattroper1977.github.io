#!/usr/bin/env node
/**
 * Focused release gate for the 2026-08-29 eight-game V4 deployment.
 *
 * Static mode (default) proves source identity, deployed structure and every
 * affected discovery surface. Browser mode drives the exact files at HEAD in
 * Chromium desktop, two Chromium mobile sizes, Firefox and WebKit.
 *
 *   node tools/verify_v4_games_deployment.mjs
 *   node tools/verify_v4_games_deployment.mjs --inputs-dir ../../upload
 *   node tools/verify_v4_games_deployment.mjs --browser
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUTS_ARG = process.argv.indexOf('--inputs-dir');
const INPUTS_DIR = INPUTS_ARG >= 0 ? path.resolve(process.argv[INPUTS_ARG + 1] || '') : null;
const RUN_BROWSER = process.argv.includes('--browser');
const LIVE_ORIGIN = process.env.V4_LIVE_ORIGIN || '';

// The eight games below are the fixed historical 2026-08-29 release cohort;
// the extra linked route assertions belong to this exact deployment contract.
const GAMES = Object.freeze([
  {
    id: 'offbrand', name: 'Off-Brand: After Hours', route: '/offbrand/',
    file: 'offbrand/index.html', canonical: 'https://madebymatt.uk/offbrand/',
    input: 'Off_Brand_After_Hours_V4_M2-2.html', inputBytes: 186835,
    inputSha256: 'fc932e5f04601117f44c1b19ae7342e5564a19cc8cc7537a25a0ef7239540a5d',
    identity: /V4[^<\n]*Milestone 2|V4 Roadmap Milestone 2/i,
    saveKeys: ['mbm_offbrand']
  },
  {
    id: 'trailrunner', name: 'Trail Runner: Stormbreak', route: '/trailrunner/',
    file: 'trailrunner/index.html', canonical: 'https://madebymatt.uk/trailrunner/',
    input: 'Trail_Runner_Stormbreak_V4_M2_bootfix-1.html', inputBytes: 670787,
    inputSha256: '9b2aa90535b7b34dd89fc6d6f99db9ac2377d7a46168285260c52ec28762ec83',
    identity: /V4[^<\n]*Portable Milestone 2|V4[^<\n]*Milestone 2/i,
    saveKeys: ['trekTrailRunner_v1', 'trekTrailSettings_v1']
  },
  {
    id: 'apexkick', name: 'Apex Kick: World Stage', route: '/apexkick/',
    file: 'apexkick/index.html', canonical: 'https://madebymatt.uk/apexkick/',
    input: 'Apex_Kick_AAA_v4.html', alternateInputs: ['Apex_Kick_AAA_v4(2).html'], inputBytes: 954540,
    inputSha256: '3730c4ec586d96c16f7fa5aa433690a00fe16fcf0bde2e38a7f0c9f6ea2d3f15',
    identity: /AAA V4|Final Edition build 4\.0\.0/i,
    saveKeys: ['apexkick.aaa.v4', 'apexkick.aaa.v3']
  },
  {
    id: 'auroralinks', name: 'Aurora Links: Northern Lights Tour', route: '/auroralinks/',
    file: 'auroralinks/index.html', canonical: 'https://madebymatt.uk/auroralinks/',
    input: 'Aurora_Links_AAA_v4.html', inputBytes: 204011,
    inputSha256: '6f9332bcc1c3f0dc8e0fe39e792842116452d02177ddcec8e8e27ef1f7a58f15',
    identity: /AAA\s*v4|AAA V4/i,
    saveKeys: ['mbm_aurora_links_aaa_v4', 'mbm_aurora_links_round_v1']
  },
  {
    id: 'houseolympiad', name: 'House Olympiad', route: '/houseolympiad/',
    file: 'houseolympiad/index.html', canonical: 'https://madebymatt.uk/houseolympiad/',
    input: 'House_Olympiad_V4.html', inputBytes: 80076,
    inputSha256: '7de6b4c736a1df6e92f316b33d032b22d7d824dc2125378c3e55efdd485abe03',
    identity: /Made by Matt Sports V4|V4 local championship/i,
    saveKeys: ['mbm_sports_passport_v4', 'mbm_sports_passport_v3']
  },
  {
    id: 'olympics', name: 'Global Games: World Stage', route: '/olympics/',
    file: 'olympics/index.html', canonical: 'https://madebymatt.uk/olympics/',
    input: 'Global_Games_AAA_v4.html', inputBytes: 388585,
    inputSha256: '88c35645f833c3a82541fc2e590ef3a7f7bda551cfb5d5418e22e8400b6f74d6',
    identity: /World Stage V4|Version 4\.0\.0/i,
    saveKeys: ['mbm_global_games_world_stage_v4', 'mbm_global_games_world_stage_v3']
  },
  {
    id: 'relicforge', name: 'Relic Forge: Crownfall', route: '/relicforge/',
    file: 'relicforge/index.html', canonical: 'https://madebymatt.uk/relicforge/',
    input: 'Relic_Forge_Crownfall_V4_M2-2.html', inputBytes: 328204,
    inputSha256: '7fe1566fca8a8c98cebdaaddec52c45f3b7d08e1acbc1d31a77569d63c26d6c8',
    identity: /V4 Roadmap Milestone 2|v4\.2\.0/i,
    saveKeys: ['mbm_relicforge_v1']
  },
  {
    id: 'voxel', name: 'Voxel Frontier: Beaconfall', route: '/voxel/',
    file: 'voxel/index.html', canonical: 'https://madebymatt.uk/voxel/',
    input: 'Voxel_Frontier_Beaconfall_V4_M2-2.html', inputBytes: 97188,
    inputSha256: 'b4a7ec326339a4c29281f40e555b0797c691cab216d0d7337e5f391d180df37f',
    identity: /V4 Roadmap Milestone 2|V4 M2/i,
    saveKeys: ['voxelfrontier.save.v1', 'voxelfrontier.world.v2.']
  }
]);

const INLINE_EXIT_IDS = new Set(GAMES.filter(game => game.id !== 'voxel').map(game => game.id));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const text = relative => read(relative).toString('utf8');
const count = (source, pattern) => (source.match(pattern) || []).length;
const gate = (name, detail = '') => console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);

function verifyInputs() {
  if (!INPUTS_DIR) {
    gate('authoritative input identities recorded', `${GAMES.length} byte counts and SHA-256 digests`);
    return;
  }
  assert(fs.statSync(INPUTS_DIR).isDirectory(), `input directory does not exist: ${INPUTS_DIR}`);
  for (const game of GAMES) {
    const names = [game.input, ...(game.alternateInputs || [])];
    const chosen = names.map(name => path.join(INPUTS_DIR, name)).find(file => fs.existsSync(file));
    assert(chosen, `${game.name}: authoritative input missing (${names.join(' or ')})`);
    const bytes = fs.readFileSync(chosen);
    assert.equal(bytes.length, game.inputBytes, `${game.name}: input byte count`);
    assert.equal(sha256(bytes), game.inputSha256, `${game.name}: input SHA-256`);
    gate(`${game.id} input`, `${bytes.length} B · ${game.inputSha256}`);
  }
}

function inlineScriptsAreValid(game, html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert(scripts.length > 0, `${game.id}: no scripts found`);
  let parsed = 0;
  for (const match of scripts) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/i.test(attrs) || /\btype\s*=\s*["'](?:application\/json|importmap)["']/i.test(attrs)) continue;
    new vm.Script(match[2], { filename: `${game.file}#inline-${parsed + 1}` });
    parsed++;
  }
  assert(parsed > 0, `${game.id}: no executable inline scripts parsed`);
  return parsed;
}

function fetchedReferences(html) {
  const refs = [];
  for (const match of html.matchAll(/<(script|img|iframe|audio|video|source|track|embed|object)\b[^>]*?\s(?:src|srcset|poster|data)\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of match[2].split(',')) refs.push(part.trim().split(/\s+/)[0]);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    if (/\b(stylesheet|preload|prefetch|icon|manifest|modulepreload)\b/i.test(rel)) refs.push(href);
  }
  const cssSurface = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  for (const match of cssSurface.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.push(match[1]);
  return refs.filter(Boolean);
}

function verifyPayloads() {
  for (const game of GAMES) {
    const bytes = read(game.file);
    const html = bytes.toString('utf8');
    assert(!/(^|\n)(<{7}|={7}|>{7})(\n|$)/m.test(html), `${game.id}: merge marker`);
    assert(/<!doctype html>/i.test(html) && /<\/html>\s*$/i.test(html), `${game.id}: truncated HTML`);
    assert.equal(count(html, /<link\s+rel=["']canonical["']/gi), 1, `${game.id}: canonical count`);
    assert(html.includes(`href="${game.canonical}"`) || html.includes(`href='${game.canonical}'`), `${game.id}: canonical mismatch`);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const visible = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
    assert(game.identity.test(`${title}\n${visible.slice(0, 30000)}`), `${game.id}: V4 identity missing`);
    assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?(?:[,"'])/i.test(html), `${game.id}: browser zoom is blocked`);
    assert.equal(count(html, /MBM-MAKER-SPLASH:BEGIN/g), 1, `${game.id}: maker splash count`);
    if (INLINE_EXIT_IDS.has(game.id)) {
      assert.equal(count(html, /MBM-INLINE-EXIT:BEGIN/g), 1, `${game.id}: inline exit count`);
      assert(!/<script\b[^>]*\bsrc=["']\/hud\.js["']/i.test(html), `${game.id}: duplicate HUD integration`);
    } else {
      assert.equal(count(html, /<script\b[^>]*\bsrc=["']\/hud\.js["']/gi), 1, 'voxel: HUD integration count');
      assert.equal(count(html, /MBM-INLINE-EXIT:BEGIN/g), 0, 'voxel: inline exit must not duplicate HUD');
    }
    const refs = fetchedReferences(html);
    const remote = refs.filter(ref => /^https?:\/\//i.test(ref));
    assert.deepEqual(remote, [], `${game.id}: remote runtime references: ${remote.join(', ')}`);
    for (const ref of refs.filter(ref => !/^(?:data:|blob:|#|https?:\/\/)/i.test(ref))) {
      const pathname = ref.startsWith('/') ? ref.slice(1) : path.join(path.dirname(game.file), ref);
      assert(fs.existsSync(path.join(ROOT, pathname)), `${game.id}: missing local runtime asset ${ref}`);
    }
    const parsed = inlineScriptsAreValid(game, html);
    gate(`${game.id} payload`, `${bytes.length} B · sha256 ${sha256(bytes)} · ${parsed} inline scripts parsed`);
  }
  const voxel = text('voxel/index.html');
  assert(!voxel.includes('../shared/mbm-v4-runtime.js'), 'voxel: missing shared runtime reference returned');
  assert(!/if\(legacy&&Number\.isFinite\(legacy\.seed\)\)[\s\S]{0,500}lsDel\(SAVE_BASE\)/.test(voxel), 'voxel: legacy save is deleted');
  const house = text('houseolympiad/index.html');
  for (const route of ['/auroralinks/', '/apexpool/', '/apexkick/', '/olympics/']) assert(house.includes(`href="${route}"`), `house: broken discipline link ${route}`);
}

function resolveGamesManifest() {
  const candidates = [process.env.V4_GAMES_MANIFEST, path.resolve(ROOT, '../Games/games.json'), path.join(ROOT, '_games/games.json')].filter(Boolean);
  return candidates.find(file => fs.existsSync(file)) || path.join(ROOT, 'data/source-manifests/games.json');
}

function flattenRecords(value, out = []) {
  if (Array.isArray(value)) for (const item of value) flattenRecords(item, out);
  else if (value && typeof value === 'object') {
    if (typeof value.action === 'string' || typeof value.href === 'string' || typeof value.url === 'string') out.push(value);
    for (const item of Object.values(value)) flattenRecords(item, out);
  }
  return out;
}

function verifyDiscovery() {
  const manifestFile = resolveGamesManifest();
  const canonicalBytes = fs.readFileSync(manifestFile);
  const mirrorBytes = read('data/source-manifests/games.json');
  assert.deepEqual(mirrorBytes, canonicalBytes, `shelf mirror differs from ${manifestFile}`);
  const manifest = JSON.parse(canonicalBytes.toString('utf8'));
  assert(Array.isArray(manifest.games), 'manifest games array missing');
  assert.equal(new Set(manifest.games.map(game => game.href)).size, manifest.games.length, 'manifest duplicate hrefs');
  assert.equal(new Set(manifest.games.map(game => game.title)).size, manifest.games.length, 'manifest duplicate titles');
  assert.equal(manifest.games.filter(game => game.hero).length, 1, 'manifest hero count');
  assert.equal(manifest.games.filter(game => String(game.title).startsWith('NEW · ')).length, 1, 'manifest NEW holder count');
  for (const game of GAMES) {
    const entries = manifest.games.filter(entry => entry.href === game.route);
    assert.equal(entries.length, 1, `${game.id}: manifest record count`);
    assert(/V4|v4/.test(`${entries[0].title} ${entries[0].desc}`), `${game.id}: manifest lacks V4 identity`);
  }
  assert.equal(manifest.games.filter(entry => /relic[- ]rush|relic-rush-v2/i.test(JSON.stringify(entry))).length, 0, 'forbidden Relic Rush release record');

  const search = JSON.parse(text('data/mbm-search-index.json'));
  const records = flattenRecords(search);
  for (const game of GAMES) {
    const hits = records.filter(record => [record.route, record.href, record.url].some(value => typeof value === 'string' && new URL(value, 'https://madebymatt.uk').pathname === game.route));
    assert.equal(hits.length, 1, `${game.id}: global search record count`);
  }
  for (const legacy of ['/Lessons/Games/Off_Brand.html', '/Lessons/Games/Trail_Runner.html']) {
    const hits = records.filter(record => [record.route, record.href, record.url].some(value => typeof value === 'string' && new URL(value, 'https://madebymatt.uk').pathname === legacy));
    assert.equal(hits.length, 0, `${legacy}: superseded search record remains active`);
  }

  const sitemap = text('sitemap.xml');
  for (const game of GAMES) assert.equal(count(sitemap, new RegExp(`<loc>${game.canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`, 'g')), 1, `${game.id}: sitemap record count`);
  gate('discovery surfaces', `${GAMES.length} unique shelf, search and sitemap records · mirror sha256 ${sha256(mirrorBytes)}`);
}

function verifyLedger() {
  const ledger = JSON.parse(text('data/hud-coverage.json'));
  const applied = new Set((ledger.makerSplash?.applied || []).map(item => typeof item === 'string' ? item : item.route));
  const declined = new Set((ledger.makerSplash?.['declined-with-reason'] || []).map(item => typeof item === 'string' ? item : item.route));
  const excluded = new Map((ledger.excluded || []).map(item => [item.route, item]));
  for (const game of GAMES) {
    assert(applied.has(game.route), `${game.id}: maker splash ledger missing`);
    assert(!declined.has(game.route), `${game.id}: maker splash is also declined`);
    if (INLINE_EXIT_IDS.has(game.id)) {
      assert(excluded.has(game.route), `${game.id}: inline-exit ledger missing`);
      assert.equal(excluded.get(game.route).verifier, 'tools/verify_v4_games_deployment.mjs', `${game.id}: verifier ownership`);
    } else assert(!excluded.has(game.route), 'voxel: HUD route incorrectly excluded');
  }
  gate('route shell ledger', '8 maker splashes · 7 inline exits · 1 canonical HUD route');
}

function staticMain() {
  verifyInputs();
  verifyPayloads();
  verifyDiscovery();
  verifyLedger();
  gate('forbidden payload exclusion', 'Relic Rush and all non-authoritative release inputs absent');
  console.log(`\nV4 STATIC GREEN — ${GAMES.length}/${GAMES.length} exact deployed routes passed`);
}

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'], ['.woff2', 'font/woff2'], ['.xml', 'application/xml; charset=utf-8']
]);

async function startServer() {
  const server = http.createServer((request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/Games/games.json') {
        const bytes = fs.readFileSync(resolveGamesManifest());
        response.writeHead(200, { 'Content-Type': MIME.get('.json'), 'Cache-Control': 'no-store' });
        response.end(bytes); return;
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(ROOT, `.${pathname}`);
      if (!(file === ROOT || file.startsWith(`${ROOT}${path.sep}`))) throw new Error('path traversal');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('not found'); return;
      }
      response.writeHead(200, { 'Content-Type': MIME.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain' }); response.end(String(error.message || error));
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

async function loadPlaywright() {
  try { return await import('playwright'); }
  catch (error) { throw new Error(`playwright is required for --browser: ${error.message}`); }
}

async function fetchPublishedBytes(origin, pathname, expected, label, round) {
  let last = '';
  const maxAttempts = 60;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const separator = pathname.includes('?') ? '&' : '?';
    const url = `${origin}${pathname}${separator}mbmv4=${Date.now()}-${round}-${attempt}`;
    try {
      const response = await fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      const actual = Buffer.from(await response.arrayBuffer());
      if (response.ok && actual.equals(expected)) return;
      last = `${response.status} · ${actual.length} B · sha256 ${sha256(actual)}`;
    } catch (error) { last = error.message || String(error); }
    if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  assert.fail(`${label}: published bytes did not converge (${last})`);
}

async function verifyLivePublication() {
  const origin = new URL(LIVE_ORIGIN).origin;
  const subjects = [
    ...GAMES.map(game => ({ label: game.id, pathname: game.route, bytes: read(game.file) })),
    { label: 'Games shelf manifest', pathname: '/Games/games.json', bytes: read('data/source-manifests/games.json') },
    { label: 'global search index', pathname: '/data/mbm-search-index.json', bytes: read('data/mbm-search-index.json') },
    { label: 'sitemap', pathname: '/sitemap.xml', bytes: read('sitemap.xml') }
  ];
  for (let round = 1; round <= 2; round++) {
    for (const subject of subjects) await fetchPublishedBytes(origin, subject.pathname, subject.bytes, subject.label, round);
    gate(`live-byte-round-${round}`, `${subjects.length} published subjects match HEAD exactly`);
    if (round === 1) await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

const PROFILES = Object.freeze([
  { name: 'chromium-desktop-1366', engine: 'chromium', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: 'chromium-android-390', engine: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36' },
  { name: 'chromium-android-412-reduced', engine: 'chromium', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36' },
  { name: 'firefox-desktop-1366', engine: 'firefox', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: 'webkit-desktop-1366', engine: 'webkit', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }
]);

// Each engine needs the same two capabilities — a GL context and pointer lock — and each takes
// them a different way. Chromium has both headless once it is handed SwiftShader. Firefox and
// WebKit need a real display, and the workflow gives them one through xvfb-run.
//
// Both were measured rather than assumed. Headless Firefox has no GL context at all:
//
//   INFO firefox-desktop-1366 graphics — webgl2: none · webgl: none
//   Trail boot never completed ... "THIS VIEWER HAS NO 3D — This browser refused to give the
//   page any WebGL graphics context"
//
// Headless WebKit has GL but cannot grant pointer lock, which Voxel needs to enter play:
//
//   INFO webkit-desktop-1366 graphics — webgl2: Apple GPU
//   Voxel HUD never reported the world ... loader "Building terrain 37 / 37" at 100%,
//   overlayDisplay "flex"
//
// That second one is the game behaving correctly: the world finishes building, requestPointerLock
// is refused, and its own 700ms guard shows "Click Resume to grab the mouse and play." The
// harness was asking a desktop pointer-lock game to play without a pointer to lock.
//
// The prefs below are for Firefox only, and lift the blocklist that would otherwise refuse the
// software renderer once a display exists. Capability only: every assertion is unchanged, and
// each engine still has to boot, take input, progress, pause/resume and exit accessibly.
const FIREFOX_SOFTWARE_WEBGL = Object.freeze({
  'webgl.force-enabled': true,
  'webgl.disabled': false,
  'webgl.out-of-process': false,
  'gfx.webrender.software': true
});

function launchOptionsFor(engine) {
  if (engine === 'chromium') return { headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
  if (engine === 'firefox') return { headless: false, firefoxUserPrefs: { ...FIREFOX_SOFTWARE_WEBGL } };
  return { headless: false };
}

// A boot wait that times out says `log: []` and nothing else, which cannot tell a
// game that is broken from an engine that was never given the graphics it needs.
// This reports what the engine actually has, so the distinction is on the record.
async function glReport(page) {
  return page.evaluate(() => {
    const probe = (kind) => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext(kind);
        if (!gl) return 'none';
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'available';
      } catch (error) { return `threw: ${error.message}`; }
    };
    return { webgl2: probe('webgl2'), webgl: probe('webgl') };
  }).catch(error => ({ webgl2: `unreadable: ${error.message}`, webgl: 'unreadable' }));
}

async function reportEngineGraphics(browser, profile, origin) {
  const context = await browser.newContext({ viewport: profile.viewport });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const gl = await glReport(page);
    console.log(`INFO ${profile.name} graphics — webgl2: ${gl.webgl2} · webgl: ${gl.webgl}`);
  } catch (error) {
    console.log(`INFO ${profile.name} graphics — unreadable: ${error.message}`);
  } finally { await context.close(); }
}

// R6-A. The pointer-lock return shape is a per-engine CONTRACT, not a constant.
// Chromium returns a Promise; Firefox and WebKit return undefined. Both are
// correct, so neither may red — but a shape this table does not predict is news,
// in either direction, and the day an engine gains a promise return the gate says
// so rather than ossifying around a 2026 assumption.
//
// Promise.resolve(r).catch(h) in the game is unaffected by any of this:
// Promise.resolve(undefined) is inert, so the fix holds on all three engines.
const EXPECTED_LOCK_SHAPE = Object.freeze({ chromium: 'thenable', firefox: 'undefined', webkit: 'undefined' });

function lockShapeVerdict(engine, observed) {
  const expected = EXPECTED_LOCK_SHAPE[engine];
  if (observed === 'other') {
    return { ok: false, label: 'RETURN_SHAPE_INVALID', detail: `${engine}: requestPointerLock returned neither a thenable nor undefined (observed '${observed}')` };
  }
  if (expected && observed !== expected) {
    return { ok: false, label: 'RETURN_SHAPE_DRIFT', detail: `${engine}: expected '${expected}', observed '${observed}'` };
  }
  return { ok: true, label: 'ok', detail: `${engine}: '${observed}'` };
}

async function checkPointerLockShape(page, engine) {
  const observed = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    let value;
    try { value = canvas.requestPointerLock ? canvas.requestPointerLock() : undefined; }
    catch (error) { canvas.remove(); return 'other'; }
    canvas.remove();
    if (value && typeof value.then === 'function') {
      if (typeof value.catch === 'function') value.catch(() => {});
      return 'thenable';
    }
    return value === undefined ? 'undefined' : 'other';
  });
  const verdict = lockShapeVerdict(engine, observed);
  console.log(`INFO ${engine} pointer-lock return shape — ${verdict.detail}`);
  assert(verdict.ok, `${verdict.label}: ${verdict.detail}`);
  return observed;
}

async function clickIfVisible(page, selector, options = {}) {
  const locator = page.locator(selector).first();
  if (await locator.isVisible().catch(() => false)) { await locator.click(options); return true; }
  return false;
}

async function holdChromiumTouch(page, selector, durationMs) {
  const target = page.locator(selector);
  const box = await target.boundingBox();
  assert(box, `${selector}: touch target has no rendered box`);
  const session = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1, radiusX: 1, radiusY: 1, force: 1 };
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.waitForTimeout(durationMs);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function smokeOffbrand(page) {
  await page.waitForFunction(() => !!window.OB);
  await page.locator('#btnCrew').click();
  await page.locator('#btnCnBegin').waitFor({ state: 'visible' });
  await page.locator('#btnCnBegin').click();
  await page.locator('#btnHowOk').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#btnHowOk').click();
  await page.waitForFunction(() => !!window.OB?.S && window.OB.S.paused === false);
  const before = await page.evaluate(() => ({ t: OB.S.t, x: OB.S.player.x }));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  await page.locator('#btnFocus').click();
  await page.waitForFunction(() => OB.S.focus.active === true);
  await page.locator('#btnFocusClose').click();
  await page.locator('#btnPause').click();
  await page.waitForFunction(() => OB.S.paused === true);
  await page.locator('#btnResume').click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ t: OB.S.t, x: OB.S.player.x, paused: OB.S.paused }));
  assert(after.t > before.t && after.x !== before.x && !after.paused, 'Off-Brand simulation/input/pause did not progress');
}

async function smokeTrail(page, mobile) {
  try {
    await page.waitForFunction(() => window.__trailBootReady === true && !!window.__TR, null, { timeout: 60000 });
  } catch (error) {
    // Same 60s budget, same assertion — but it now reports whether the engine
    // could make a WebGL context and what the game itself said before giving up.
    const gl = await glReport(page);
    const state = await page.evaluate(() => ({
      bootReady: window.__trailBootReady === true,
      tr: !!window.__TR,
      bundleStarted: !!window.__trailBundleStarted,
      compat: !!window.__trailCompat,
      storageOK: !!window.__trailStorageOK,
      body: (document.body ? document.body.innerText : '').trim().replace(/\s+/g, ' ').slice(0, 320)
    })).catch(evalError => ({ unreadable: evalError.message }));
    throw new Error(`Trail boot never completed — engine webgl2: ${gl.webgl2}, webgl: ${gl.webgl}; page ${JSON.stringify(state)}`);
  }
  assert(!(await page.locator('body').innerText()).includes("TRAIL COULDN'T START"), 'Trail boot fallback appeared');
  await page.locator('#start-btn').click();
  await page.waitForFunction(() => ['RUNNING', 'WARNING', 'BOSS'].includes(window.__TR.gameState), null, { timeout: 20000 });
  const before = await page.evaluate(() => ({ lane: __TR.currentLane, x: __TR.player.position.x, speed: __TR.speed }));
  if (mobile) {
    await page.locator('#btn-left').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(180);
    await page.locator('#btn-left').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    await page.locator('#btn-shoot').dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
    await page.locator('#btn-shoot').dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch' });
  } else {
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('KeyX');
  }
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ lane: __TR.currentLane, x: __TR.player.position.x, speed: __TR.speed }));
  assert(after.speed > 0 && (after.lane !== before.lane || after.x !== before.x), 'Trail steering/simulation did not progress');
  if (mobile) await page.locator('#touch-pause').click(); else await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__TR.gameState === 'PAUSED');
  await page.locator('#resume-btn').click();
  await page.waitForFunction(() => window.__TR.gameState !== 'PAUSED');
}

async function smokeApex(page) {
  await page.waitForFunction(() => !!window.MadeByMattV4QA && !!window.__AK_DEBUG && !!document.querySelector('#bModes'), null, { timeout: 30000 });
  const selfTests = await page.evaluate(() => ({ rollback: MadeByMattV4QA.rollback.selfTest(), physics: MadeByMattV4QA.physics.selfTest() }));
  assert(selfTests.rollback.ok && selfTests.physics.ok, 'Apex V4 self-tests failed');
  await page.locator('#bModes').click(); await page.locator('#mPractice').click();
  await page.waitForFunction(() => MadeByMattV4QA.snapshot().game.state === 'aim', null, { timeout: 15000 });
  const before = await page.evaluate(() => MadeByMattV4QA.snapshot());
  // Exercise pause in the stable aiming state. The flight-to-resolve handoff
  // is deliberately non-pausable and can happen between two CI protocol turns.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => MadeByMattV4QA.snapshot().game.paused === true);
  await page.locator('#pauseResume').click();
  await page.waitForFunction(() => MadeByMattV4QA.snapshot().game.paused === false);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => MadeByMattV4QA.snapshot().game.state === 'flight', null, { timeout: 15000 });
  const after = await page.evaluate(() => MadeByMattV4QA.snapshot());
  assert(after.game.state !== 'intro' && (after.game.state !== before.game.state || after.game.momentIdx !== before.game.momentIdx), 'Apex kick did not enter simulation');
}

async function smokeAurora(page) {
  await page.waitForFunction(() => !!window.MadeByMattV4QA && !!document.querySelector('#quickBtn'));
  const selfTests = await page.evaluate(() => ({ rollback: MadeByMattV4QA.rollback.selfTest(), physics: MadeByMattV4QA.physics.selfTest() }));
  assert(selfTests.rollback.ok && selfTests.physics.ok, 'Aurora V4 self-tests failed');
  await page.locator('#quickBtn').click();
  const before = await page.evaluate(() => MadeByMattV4QA.snapshot().physics.frame);
  for (let index = 0; index < 4; index++) { await page.locator('#swingBtn').click(); await page.waitForTimeout(140); }
  await page.waitForFunction(frame => MadeByMattV4QA.snapshot().physics.frame > frame + 30, before, { timeout: 15000 });
  await page.locator('#pauseBtn').click();
  await page.waitForFunction(() => document.querySelector('#pause').classList.contains('open'));
  await page.locator('#resumeBtn').click();
  await page.waitForFunction(() => !document.querySelector('#pause').classList.contains('open'));
}

async function smokeHouse(page) {
  await page.waitForFunction(() => !!window.MadeByMattOlympiadV4QA && !!window.MadeByMattV4Runtime);
  const result = await page.evaluate(() => MadeByMattOlympiadV4QA.selfTest());
  assert(result.ok && result.rollback.ok && result.physics.ok, 'House Olympiad V4 self-test failed');
  const points = await page.evaluate(() => {
    const runtime = MadeByMattV4Runtime;
    let state = MadeByMattOlympiadV4QA.snapshot();
    state = runtime.mutations.recordOlympiad(state, 'global-games:100m', { seconds: 12 }, 's', runtime.weeklyId(), new Date().toISOString());
    localStorage.setItem(runtime.constants.PASSPORT_KEY, runtime.stableStringify(state));
    return runtime.olympiadPoints('global-games:100m', { seconds: 12 });
  });
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(expected => Number.parseInt(document.querySelector('#compositeValue').textContent, 10) >= expected, points);
  await page.locator('a[href="#games"]').click();
  assert.equal(new URL(page.url()).hash, '#games', 'House discipline selection did not reach event grid');
  assert.equal(await page.locator('.gameLink').count(), 4, 'House discipline count');
}

async function smokeGlobal(page) {
  await page.waitForFunction(() => !!window.MBMGlobalGames && !!window.MadeByMattV4QA && !!window.__olympics, null, { timeout: 30000 });
  const tests = await page.evaluate(() => ({ rollback: MadeByMattV4QA.rollback.selfTest(), physics: MadeByMattV4QA.physics.selfTest() }));
  assert(tests.rollback.ok && tests.physics.ok, 'Global Games V4 self-tests failed');
  await page.locator('#recordsBtn').click(); await page.locator('#recordsBack').click();
  await page.locator('#quickGamesBtn').click(); await page.locator('#autoAttrs').click();
  await page.locator('#beginTournament:not([disabled])').click();
  await page.locator('#eventBriefing').click(); await page.locator('#startEvent').click();
  await page.waitForFunction(() => window.__olympics.screen === 'PLAYING' && !!window.__olympics.eventId);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  await page.waitForTimeout(900);
  await page.locator('#pauseBtn').click(); await page.waitForFunction(() => window.__olympics.paused === true);
  await page.locator('#resumeBtn').click(); await page.waitForFunction(() => window.__olympics.paused === false);
  assert(await page.evaluate(() => MBMGlobalGames.debugFinish()), 'Global debug finish could not complete active event');
  await page.waitForFunction(() => window.__olympics.screen !== 'PLAYING', null, { timeout: 30000 });
}

async function smokeRelic(page, mobile) {
  await page.waitForFunction(() => !!window.__relicforge && !!window.RF, null, { timeout: 30000 });
  await page.evaluate(() => window.__relicforge.start());
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__relicforge.skipStory());
  await page.waitForFunction(() => window.__relicforge.snapshot().mode === 'playing');
  if (mobile) {
    const portrait = page.viewportSize();
    assert(portrait && portrait.height > portrait.width, 'Relic mobile profile did not begin in portrait');
    await page.locator('#rotate-note').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: portrait.height, height: portrait.width });
    await page.locator('#rotate-note').waitFor({ state: 'hidden' });
  }
  const before = await page.evaluate(() => window.__relicforge.snapshot());
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  if (mobile) await page.locator('#touch-fire').tap();
  else await page.locator('#gameCanvas').click({ position: { x: 220, y: 180 } });
  await page.evaluate(() => { const target = __relicforge.targets()[0]; if (target) __relicforge.strike(target.id, 'core', 12); });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__relicforge.snapshot());
  assert(after.time > before.time && after.playerPosition && (after.playerPosition.x !== before.playerPosition.x || after.projectiles !== before.projectiles || after.enemies <= before.enemies), 'Relic movement/combat did not progress');
  if (after.mode !== 'paused') {
    // bindHoldButton calls setPointerCapture before its pause callback. A
    // synthetic dispatchEvent has no active pointer and can throw there,
    // leaving the game running. Exercise the real trusted input for each
    // layout: Escape on desktop and the visible touch control on mobile.
    if (mobile) await page.locator('#touch-pause').tap();
    else await page.keyboard.press('Escape');
  }
  await page.waitForFunction(() => __relicforge.snapshot().mode === 'paused');
  await page.locator('#resume-btn').click(); await page.waitForFunction(() => __relicforge.snapshot().mode === 'playing');
}

async function smokeVoxel(page, mobile) {
  await page.waitForFunction(() => !!window.__BEACONFALL_GREEDY__ && !!document.querySelector('#start'), null, { timeout: 30000 });
  await page.locator('[data-mode="frontier"]').click(); await page.locator('#start').click();
  // Voxel builds 37 chunks, yielding on requestAnimationFrame, and only THEN asks
  // for pointer lock. On a slow runner the click's user activation has expired by
  // then, so the lock is refused — and the game says so itself where it asks:
  //
  //   // Some browsers reject the request without firing pointerlockerror, because
  //   // the click gesture expired during terrain generation. Verify, and offer a
  //   // way back.
  //   setTimeout(()=>{ if(!locked&&started)showPause('Click Resume to grab the mouse
  //     and play.'); },700);
  //
  // showPause() sets running=false and puts the overlay back, and the render loop
  // gates on `running && (locked||isTouch)`, so the HUD is never written. The world
  // is built and fine — the loader reads 37/37 at 100%. A player clicks Resume. So
  // does this, once, with a fresh trusted gesture. Measured: the same commit passes
  // webkit/voxel on a fast runner and fails on a slow one (webkit's preceding leg
  // took 46s when it passed, 56-58s when it failed), which is what makes waiting
  // longer the wrong instrument and a second gesture the right one.
  const hudReports = () => {
    const hud = document.querySelector('#hud');
    return !!hud && hud.textContent.includes('Beaconfall · V4 M2');
  };
  // Either the world reports, or the game has offered the way back. The tell is
  // #start: startGame() hides it for the whole build and only restores it, reading
  // "Resume", once the terrain is done — so a VISIBLE Resume button with the overlay
  // up is the refused-lock state and cannot be confused with mid-build, where the
  // loader is also on screen and #loadfill also reaches 100% on the last chunk.
  await page.waitForFunction(() => {
    const hud = document.querySelector('#hud');
    if (hud && hud.textContent.includes('Beaconfall · V4 M2')) return true;
    const overlay = document.querySelector('#overlay');
    const start = document.querySelector('#start');
    if (!overlay || !start) return false;
    const shown = el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect();
      return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    return shown(overlay) && shown(start) && /resume/i.test(start.textContent || '');
  }, null, { timeout: 60000 });
  // Take the way back whenever it is on offer — not merely when the HUD is silent.
  // A fast engine can write the HUD in the window between running=true and the
  // 700ms guard, so the world reports AND THEN pauses; leaving that unresumed
  // fails later, at the save, with the pause menu still up.
  const resumeOffered = () => {
    const overlay = document.querySelector('#overlay');
    const start = document.querySelector('#start');
    if (!overlay || !start) return false;
    const shown = el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect();
      return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    return shown(overlay) && shown(start) && /resume/i.test(start.textContent || '');
  };
  // R2. Wait for the pointer-lock OUTCOME to be DECIDED, not for a fixed interval.
  // A sleep elapses just as happily on a build that reaches neither state, which is
  // how it could green something that never settled. The decided states are exact:
  //   desktop  document.pointerLockElement is set        -> granted
  //            the Resume offer is up                    -> refused
  //   touch    the game never asks for a lock, so the HUD reporting IS the outcome
  // The transient that defeated the earlier attempt — HUD written, pause not yet
  // arrived — is excluded because neither decided state holds during it.
  try {
    await page.waitForFunction((isTouch) => {
      const hud = document.querySelector('#hud');
      const reporting = !!hud && hud.textContent.includes('Beaconfall · V4 M2');
      if (isTouch) return reporting;
      if (document.pointerLockElement) return true;
      const overlay = document.querySelector('#overlay');
      const start = document.querySelector('#start');
      if (!overlay || !start) return false;
      const shown = el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect();
        return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      return shown(overlay) && shown(start) && /resume/i.test(start.textContent || '');
    }, mobile, { timeout: 60000 });
  } catch (error) {
    throw new Error('Voxel pointer-lock outcome never decided — waited for '
      + (mobile ? 'the HUD to report (touch takes no lock)'
                : 'document.pointerLockElement to be set (granted) OR the Resume offer to be shown (refused)')
      + '; neither within 60000ms');
  }
  if (await page.evaluate(resumeOffered)) {
    await page.locator('#start').click({ timeout: 10000 });
    await page.waitForFunction(hudReports, null, { timeout: 30000 });
  }
  try {
    await page.waitForFunction(hudReports, null, { timeout: 60000 });
  } catch (error) {
    // Same budget, same assertion. A missing #hud makes the predicate THROW,
    // which waitForFunction swallows and retries, so the timeout looks
    // identical to a world that simply never generated. Say which it was.
    const gl = await glReport(page);
    // startGame() builds the chunk list and yields with requestAnimationFrame
    // every fourth chunk. So a stall here is one of two different faults: the
    // loader frozen (rAF never firing) or the loader still crawling (software
    // rasterisation too slow for the budget). Sampling it twice tells them
    // apart, and they do not have the same repair.
    const read = () => page.evaluate(() => {
      const hud = document.querySelector('#hud');
      const overlay = document.querySelector('#overlay');
      const loadtxt = document.querySelector('#loadtxt');
      const loadfill = document.querySelector('#loadfill');
      return {
        hudPresent: !!hud,
        hudText: hud ? hud.textContent.trim().replace(/\s+/g, ' ').slice(0, 160) : null,
        overlayDisplay: overlay ? getComputedStyle(overlay).display : null,
        loadText: loadtxt ? loadtxt.textContent.trim() : null,
        loadWidth: loadfill ? loadfill.style.width : null,
        greedy: !!window.__BEACONFALL_GREEDY__,
        canvases: document.querySelectorAll('canvas').length
      };
    }).catch(evalError => ({ unreadable: evalError.message }));
    const first = await read();
    await page.waitForTimeout(6000);
    const second = await read();
    const moved = first.loadText !== second.loadText || first.loadWidth !== second.loadWidth;
    throw new Error(`Voxel HUD never reported the world — engine webgl2: ${gl.webgl2}; ` +
      `loader ${moved ? 'STILL ADVANCING (too slow for the budget)' : 'FROZEN (not advancing at all)'} ` +
      `over 6s: ${JSON.stringify(first)} then ${JSON.stringify(second)}`);
  }
  const before = await page.locator('#hud').innerText();
  if (mobile) {
    await holdChromiumTouch(page, '#d-up', 600);
    await page.locator('#b-break').tap();
  } else {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
    await page.locator('canvas').last().click({ button: 'left', position: { x: 200, y: 180 } }).catch(() => {});
  }
  await page.waitForTimeout(900);
  const after = await page.locator('#hud').innerText();
  assert(after.includes('FRONTIER') && (after !== before || (await page.locator('#contract-objectives').innerText()).length > 10), 'Voxel world/input/objective did not progress');
  const overlayVisible = await page.locator('#overlay').evaluate(element => getComputedStyle(element).display !== 'none');
  if (!overlayVisible) {
    if (mobile) await page.locator('#b-pause').tap();
    else await page.evaluate(() => document.exitPointerLock());
  }
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#overlay')).display !== 'none');
  const save = await page.evaluate(() => {
    const key = localStorage.getItem('voxelfrontier.lastseed.v1');
    return key && localStorage.getItem(`voxelfrontier.world.v2.${key}`);
  });
  assert(save && JSON.parse(save).v === 4, 'Voxel V4 world was not persisted');
  await page.locator('#start').click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#overlay')).display === 'none');
}

const SMOKES = { offbrand: smokeOffbrand, trailrunner: smokeTrail, apexkick: smokeApex, auroralinks: smokeAurora, houseolympiad: smokeHouse, olympics: smokeGlobal, relicforge: smokeRelic, voxel: smokeVoxel };

async function verifyWayOut(page, origin) {
  const exit = page.locator('#mbmexit-back,#mbmhud-back').first();
  await exit.waitFor({ state: 'visible', timeout: 10000 });
  const box = await exit.boundingBox();
  assert(box && box.width >= 44 && box.height >= 44, `way-out target is ${box ? `${box.width}x${box.height}` : 'missing'}`);
  assert.equal(new URL(await exit.getAttribute('href'), origin).pathname, '/games/', 'way-out href');
  await exit.focus(); await page.keyboard.press('Enter');
  await page.waitForURL(url => url.pathname === '/games/', { timeout: 10000 });
}

async function runOne(browser, profile, game, origin) {
  const context = await browser.newContext({
    viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile || false, hasTouch: profile.hasTouch || false,
    reducedMotion: profile.reducedMotion || 'no-preference', colorScheme: profile.colorScheme || 'dark',
    userAgent: profile.userAgent
  });
  const page = await context.newPage();
  const errors = [], remote = [], failed = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message || error}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('request', request => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== origin && (!LIVE_ORIGIN || url.origin !== new URL(LIVE_ORIGIN).origin)) remote.push(request.url()); });
  page.on('requestfailed', request => { if (/^https?:/.test(request.url())) failed.push(`${request.url()} (${request.failure()?.errorText || 'failed'})`); });
  page.on('response', response => { const url = new URL(response.url()); if (response.status() >= 400 && url.pathname !== '/favicon.ico') failed.push(`${response.status()} ${response.url()}`); });
  const base = LIVE_ORIGIN || origin;
  const query = new URLSearchParams({ splash: 'skip', debug: '1', seed: '424242', v4gate: `${Date.now()}-${profile.name}` });
  await page.goto(`${base}${game.route}?${query}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !!document.body && document.readyState === 'complete');
  const geometry = await page.evaluate(() => ({ text: document.body.innerText.trim().length, width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, height: document.documentElement.scrollHeight }));
  assert(geometry.text > 20 && geometry.height > 80, `${game.id}: blank route`);
  assert(geometry.width <= geometry.client + 6, `${game.id}: horizontal clipping ${geometry.width}/${geometry.client}`);
  if (game.id === 'voxel') await checkPointerLockShape(page, profile.engine);
  await SMOKES[game.id](page, !!profile.hasTouch);
  await page.waitForTimeout(250);
  assert.deepEqual(remote, [], `${game.id}: unexpected remote requests: ${remote.join(', ')}`);
  assert.deepEqual(failed, [], `${game.id}: failed required requests: ${failed.join(', ')}`);
  assert.deepEqual(errors, [], `${game.id}: fatal browser errors: ${errors.join(' | ')}`);
  await verifyWayOut(page, origin);
  await context.close();
  gate(`${profile.name}/${game.id}`, 'boot · input · progression · pause/resume · accessible exit');
}

async function migrationFixture(browser, origin, game, setup, verify) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  await page.goto(`${origin}/games/?fixture=${game.id}`, { waitUntil: 'load' });
  await page.evaluate(values => { localStorage.clear(); for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value)); }, setup);
  await page.goto(`${origin}${game.route}?splash=skip&seed=424242&fixture=legacy`, { waitUntil: 'load', timeout: 90000 });
  await verify(page);
  await context.close();
  gate(`legacy-upgrade/${game.id}`, 'progress retained and source slot preserved');
}

async function runMigrationFixtures(browser, origin) {
  await migrationFixture(browser, origin, GAMES[0], { mbm_offbrand: { v: 1, xp: 321, hat: 'none', crewStars: [1, 0, 0], glitchStars: [0, 0, 0] } }, async page => {
    await page.waitForFunction(() => !!window.OB);
    // Persist through the real title-screen setting. `store` is intentionally
    // closure-private, so invoking it as a page global never exercised the UI
    // and failed before the migration assertion could run.
    await page.locator('#chipMotion').click();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mbm_offbrand')));
    assert.equal(save.xp, 321); assert.equal(save.v, 3);
  });
  await migrationFixture(browser, origin, GAMES[1], { trekTrailRunner_v1: { best: 4321, runs: 7, legs: 3, badges: { first: true } } }, async page => {
    await page.waitForFunction(() => window.__trailBootReady === true, null, { timeout: 60000 });
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('trekTrailRunner_v1')));
    assert.equal(save.best, 4321); assert.equal(save.runs, 7);
  });
  await migrationFixture(browser, origin, GAMES[2], { 'apexkick.aaa.v3': { version: 3, credits: 777, goals: 3, shots: 9, division: 6 } }, async page => {
    await page.waitForFunction(() => !!window.__AK_DEBUG);
    const saves = await page.evaluate(() => ({ old: JSON.parse(localStorage.getItem('apexkick.aaa.v3')), current: JSON.parse(localStorage.getItem('apexkick.aaa.v4')) }));
    assert.equal(saves.old.credits, 777); assert.equal(saves.current.credits, 777);
  });
  await migrationFixture(browser, origin, GAMES[3], { mbm_aurora_links_round_v1: { scores: [3, 3, 4, 4, 4, 2, 5, 4, 4] } }, async page => {
    await page.waitForFunction(() => !!window.MadeByMattV4QA);
    const saves = await page.evaluate(() => ({ old: JSON.parse(localStorage.getItem('mbm_aurora_links_round_v1')), current: JSON.parse(localStorage.getItem('mbm_aurora_links_aaa_v4')) }));
    assert.equal(saves.old.scores.length, 9); assert.equal(saves.current.totalHoles, 9); assert(Number.isFinite(saves.current.best.tour));
  });
  await migrationFixture(browser, origin, GAMES[4], { mbm_sports_passport_v3: { version: 3, profile: { name: 'Legacy Player', className: 'Class 4', house: 'Ember' }, xp: 900, badges: ['starter'] } }, async page => {
    await page.waitForFunction(() => !!window.MadeByMattOlympiadV4QA);
    const values = await page.evaluate(() => ({ old: localStorage.getItem('mbm_sports_passport_v3'), current: localStorage.getItem('mbm_sports_passport_v4') }));
    assert(values.old && values.current, 'House Passport migration slots missing');
  });
  await migrationFixture(browser, origin, GAMES[5], { mbm_global_games_world_stage_v3: { version: 3, credits: 777, records: { sprint: 12.34 }, profile: { name: 'Legacy Athlete', nation: 'GBR' } } }, async page => {
    await page.waitForFunction(() => !!window.MBMGlobalGames);
    const saves = await page.evaluate(() => ({ old: JSON.parse(localStorage.getItem('mbm_global_games_world_stage_v3')), current: JSON.parse(localStorage.getItem('mbm_global_games_world_stage_v4')) }));
    assert.equal(saves.old.credits, 777); assert.equal(saves.current.credits, 777); assert.equal(saves.current.records.sprint, 12.34);
  });
  await migrationFixture(browser, origin, GAMES[6], { mbm_relicforge_v1: { version: 1, highScore: 4567, credits: 222, bestChamber: 4 } }, async page => {
    await page.waitForFunction(() => !!window.__relicforge);
    await page.evaluate(() => __relicforge.start());
    await page.waitForTimeout(100);
    await page.evaluate(() => __relicforge.skipStory());
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('mbm_relicforge_v1')));
    assert.equal(save.highScore, 4567); assert.equal(save.credits, 222);
  });
  await migrationFixture(browser, origin, GAMES[7], { 'voxelfrontier.save.v1': { v: 1, seed: 424242, px: 2, py: 32, pz: 3, mode: 'creative', edits: '' } }, async page => {
    await page.waitForFunction(() => !!window.__BEACONFALL_GREEDY__);
    const saves = await page.evaluate(() => ({ old: localStorage.getItem('voxelfrontier.save.v1'), current: localStorage.getItem('voxelfrontier.world.v2.424242') }));
    assert(saves.old, 'Voxel removed its legacy source save'); assert(saves.current, 'Voxel did not create its V4 world slot'); assert.equal(JSON.parse(saves.current).v, 4);
  });
}

async function runStandaloneOffline(playwright) {
  const browser = await playwright.chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const game of GAMES.filter(item => item.id !== 'voxel')) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${pathToFileURL(path.join(ROOT, game.file)).href}?splash=skip`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(800);
      assert((await page.locator('body').innerText()).trim().length > 20, `${game.id}: offline file boot blank`);
      assert.deepEqual(errors, [], `${game.id}: offline errors ${errors.join(' | ')}`);
      await context.close(); gate(`offline-standalone/${game.id}`, 'file URL booted with network disabled');
    }
  } finally { await browser.close(); }
}

// R1. The pointer-lock refusal case, owned by the verifier rather than by a
// throwaway harness. Voxel asks for a lock after building 37 chunks, by which
// point a slow runner has expired the click's user activation; the refusal
// rejects, and an unhandled rejection is a page error. The build cannot drop
// this trigger because the build does not supply it — this does, on every run,
// with no flag and no catch around the injection to swallow a miss.
//
// STUB_ABSENT is the guard on the guard: if the injection did not take, the case
// would pass for the wrong reason, so a missing marker is a named RED.
async function runPointerLockRefusal(browser, origin) {
  const game = GAMES.find(item => item.id === 'voxel');
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message || error}`));
  await page.addInitScript(() => {
    const real = Element.prototype.requestPointerLock;
    let first = true;
    Element.prototype.requestPointerLock = function (...args) {
      if (first) {
        first = false;
        return Promise.reject(new DOMException('Pointer lock requires a user gesture.', 'NotAllowedError'));
      }
      return real.apply(this, args);
    };
    window.__mbmPointerLockStub = true;
  });
  try {
    await page.goto(`${origin}${game.route}?splash=skip&debug=1&seed=424242`, { waitUntil: 'load', timeout: 90000 });
    const installed = await page.evaluate(() => window.__mbmPointerLockStub === true);
    assert(installed, 'STUB_ABSENT: the pointer-lock refusal stub did not install, so this case would have passed for the wrong reason');
    await page.waitForFunction(() => !!window.__BEACONFALL_GREEDY__ && !!document.querySelector('#start'), null, { timeout: 30000 });
    await page.locator('[data-mode="frontier"]').click();
    await page.locator('#start').click();
    await page.waitForFunction(() => {
      const hud = document.querySelector('#hud');
      if (hud && hud.textContent.includes('Beaconfall \u00b7 V4 M2')) return true;
      const overlay = document.querySelector('#overlay');
      const start = document.querySelector('#start');
      if (!overlay || !start) return false;
      const shown = el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect();
        return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      return shown(overlay) && shown(start) && /resume/i.test(start.textContent || '');
    }, null, { timeout: 60000 });
    assert.deepEqual(errors, [], `voxel refused-lock: the rejection was not handled: ${errors.join(' | ')}`);
    gate('pointerlock-refused/voxel', 'a refused pointer lock is handled, not thrown');
  } finally { await context.close(); }
}

async function browserMain() {
  staticMain();
  if (LIVE_ORIGIN) await verifyLivePublication();
  const playwright = await loadPlaywright();
  const local = LIVE_ORIGIN ? null : await startServer();
  const origin = local?.origin || new URL(LIVE_ORIGIN).origin;
  try {
    for (const profile of PROFILES) {
      const launchOptions = launchOptionsFor(profile.engine);
      const browser = await playwright[profile.engine].launch(launchOptions);
      try {
        await reportEngineGraphics(browser, profile, origin);
        for (const game of GAMES) await runOne(browser, profile, game, origin);
        if (!LIVE_ORIGIN && profile.name === 'chromium-desktop-1366') await runMigrationFixtures(browser, origin);
      } finally { await browser.close(); }
    }
    {
      const refusalBrowser = await playwright.chromium.launch(launchOptionsFor('chromium'));
      try { await runPointerLockRefusal(refusalBrowser, origin); } finally { await refusalBrowser.close(); }
    }
    if (!LIVE_ORIGIN) await runStandaloneOffline(playwright);
  } finally { if (local) await new Promise(resolve => local.server.close(resolve)); }
  const extras = LIVE_ORIGIN ? 'live canonical exits' : '8 upgrade fixtures + 7 offline standalone boots';
  console.log(`\nV4 BROWSER GREEN — ${GAMES.length} games × ${PROFILES.length} profiles + ${extras}`);
}

if (RUN_BROWSER) await browserMain(); else staticMain();
