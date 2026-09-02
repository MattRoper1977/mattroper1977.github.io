#!/usr/bin/env node
/**
 * verify.mjs - the gate harness for CYBERPULSE: BLACKOUT.
 *
 * /cyberpulse/ is declared in data/hud-coverage.json as excluded from the HUD
 * script requirement. That exclusion is not a note; tools/verify_hud_on_games.py
 * fails the build if the verifier an exclusion cites does not exist, and the
 * exclusion also names four gates. THIS FILE IS THOSE GATES. If it does not
 * check them, the exclusion is a claim nothing tests, and the route has quietly
 * bought its way out of the estate's way-out contract for nothing.
 *
 *   node tools/cyberpulse/verify.mjs [path/to/index.html]
 *
 * Every gate must also be shown capable of FAILING. `--selftest` mutates a
 * throwaway copy to violate each static gate in turn and asserts the harness
 * catches it; a gate that still passes on a violating build is vacuous and is
 * reported as such.
 *
 * Non-zero exit if any gate fails, so this works as a CI gate.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argPath = process.argv.slice(2).find((a) => !a.startsWith('--'));
const GAME = argPath ? path.resolve(argPath) : path.join(ROOT, 'cyberpulse', 'index.html');
const SELFTEST = process.argv.includes('--selftest');

// Same trap as the Emberwild harness: CI installs playwright at the repository
// root, and this file lives two levels down. Resolve from the root explicitly
// rather than trusting Node to walk up, or "playwright unavailable" reports as
// a property of the game instead of a property of the machine.
function loadPlaywright() {
  const require_ = createRequire(path.join(ROOT, 'package.json'));
  return require_('playwright');
}

// CI trap: node buffers stdout and the runner kills silent jobs. Flush per line.
function say(s) { process.stdout.write(s + '\n'); }

let results = [];
function gate(id, title, ok, detail) {
  results.push({ id, title, ok: !!ok, detail: detail || '' });
  say(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ' — ' + detail : ''}`);
  return !!ok;
}

// The estate pins, measured across the live games rather than chosen. Both
// blocks are byte-identical everywhere they appear; that is the whole point of
// a generated region, and a drifted copy is the failure these catch.
const EXIT_BYTES = 3222;      // block plus its trailing newline
// 8356 when this was written. tools/render_maker_splash.py has since revised the
// canonical block, and it is now 11780 as CP6s measures it (11781 with the
// trailing newline the generator counts). The pin tracks the estate value; it is
// not a target the route gets to pick. Proved by the generator itself, which
// reports "16 applied target(s); 0 written; 0 divergent" across every route
// carrying the block, /cyberpulse/ included, after regeneration.
const SPLASH_BYTES = 11780;
const ENGINE_VERSION = 'v1.5';
const RELEASE_VERSION = '6.0.1';
// Re-pinned 2026-09-02 for build 6.0.1: the authority block gained the
// software-rasterizer detection (softwareRasterizerVerdict, the once-only call
// in ensureRenderer, and the ?renderer=webgl2 override). Previous pin
// 465669d94e596644f0fe51e5bd97f9e3c136ae15189f565488b345e754ff5ec9 (161141 bytes)
// = build 6.0.0 at Site PR #218 head 6be2ac56. Nothing else in the block moved.
const AUTHORITY_SHA = '8578c76cf86b876545bbaa93c29baa7cbe5445bbd72ea410bb68af4a1e65f607';
const FROZEN_SOURCE_BYTES = 208310;

// ---------------------------------------------------------------------------
// Static gates - read the shipped file itself.
// ---------------------------------------------------------------------------
function staticGates(html, manifestRaw) {
  // CP1 "single self-contained HTML file with zero http(s) references".
  // The declared gate says http(s) REFERENCES, not just src/href attributes:
  // a fetch() or an import() would retract the same promise without touching
  // an attribute, so match the scheme anywhere in the file. rel=canonical and
  // og:url are metadata about where the page lives, not fetches from it.
  const scrubbed = html
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']og:url["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']og:image["'][^>]*>/gi, '');
  const refs = [...new Set((scrubbed.match(/https?:\\?\/\\?\/[^\s"'`)<>]{0,80}/gi) || []))];
  gate('CP1s', 'single file: zero http(s) references', refs.length === 0,
    refs.length ? refs.slice(0, 3).join(' | ') : 'no http(s) reference anywhere in the file');

  // CP2 keeps both honest version surfaces: the frozen CP120 engine remains
  // v1.5 while the shipping package is AAA V6. Conflating them would require
  // editing the authority block merely to repaint release furniture.
  const inTitle = /<title>[^<]*AAA V6\b/.test(html);
  const inKicker = /class="kicker"[^>]*>[^<]*AAA V6\b/.test(html);
  const inEngine = new RegExp(`const VERSION=['"]${ENGINE_VERSION}['"]`).test(html);
  const inRelease = new RegExp(`var VERSION=['"]${RELEASE_VERSION}['"]`).test(html)
    && /window\.__MBM_V6_RELEASE__\s*=/.test(html);
  let inRecord = false, recordNote = 'no /cyberpulse/ entry in data/source-manifests/games.json';
  try {
    const entry = (JSON.parse(manifestRaw).games || []).find((g) => g.href === '/cyberpulse/');
    if (entry) {
      inRecord = /\bV6\b/.test(String(entry.desc || ''));
      recordNote = inRecord ? 'manifest desc carries V6' : 'manifest entry exists but its desc does not carry V6';
    }
  } catch (e) { recordNote = 'games.json unreadable: ' + e.message; }
  gate('CP2s', 'V6 package identity with frozen v1.5 engine identity',
    inTitle && inKicker && inEngine && inRelease && inRecord,
    `title=${inTitle} kicker=${inKicker} engine=${inEngine} release=${inRelease} record=${inRecord} (${recordNote})`);

  // CP3 "browser zoom enabled and exactly one visible semantic h1", static half.
  // Pinch-zoom is an accessibility floor, and it is disabled by a viewport
  // attribute rather than by anything visible, so it can only be caught here.
  const viewport = (html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [''])[0];
  const zoomBlockers = [];
  if (/user-scalable\s*=\s*(no|0)/i.test(viewport)) zoomBlockers.push('user-scalable=no');
  const maxScale = viewport.match(/maximum-scale\s*=\s*([\d.]+)/i);
  if (maxScale && parseFloat(maxScale[1]) < 5) zoomBlockers.push(`maximum-scale=${maxScale[1]}`);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  gate('CP3s', 'zoom not disabled and exactly one h1 in source',
    zoomBlockers.length === 0 && h1s === 1,
    `${zoomBlockers.length ? zoomBlockers.join('+') : 'zoom enabled'}, ${h1s} h1 element(s)`);

  // CP4 "WebGL2 path with a Canvas fallback", static half. Both context
  // requests must be in the source; the runtime half proves the fallback is
  // reached rather than merely present.
  const hasGL = /getContext\(\s*['"]webgl2['"]/.test(html);
  const has2D = /getContext\(\s*['"]2d['"]/.test(html);
  gate('CP4s', 'both a webgl2 path and a 2d fallback exist', hasGL && has2D,
    `webgl2=${hasGL} 2d=${has2D}`);

  // CP5 the estate way out. This is the reason the exclusion is affordable at
  // all: the HUD script is what normally gives every game an exit, and a route
  // that opts out of it has to supply one another way. Byte-identical to the
  // estate copy, because it is a generated region and a local edit to it is
  // exactly the drift a per-game check would otherwise never see.
  const exitMatch = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END -->\n/);
  const exitBytes = exitMatch ? Buffer.byteLength(exitMatch[0], 'utf8') : 0;
  gate('CP5s', 'inline exit region present at the estate pin', exitBytes === EXIT_BYTES,
    `${exitBytes} bytes (estate pin ${EXIT_BYTES})`);

  // CP6 the maker splash, of which this route is the visual donor.
  const splashMatch = html.match(/<!-- MBM-MAKER-SPLASH:BEGIN[\s\S]*?MBM-MAKER-SPLASH:END -->/);
  const splashBytes = splashMatch ? Buffer.byteLength(splashMatch[0], 'utf8') : 0;
  gate('CP6s', 'maker splash region present at the estate pin', splashBytes === SPLASH_BYTES,
    `${splashBytes} bytes (estate pin ${SPLASH_BYTES})`);

  // CP7 the exclusion's own premise: no HUD script. If this ever gained one,
  // the exclusion would be false and this verifier would be defending nothing.
  gate('CP7s', 'carries no HUD script, which is what the exclusion claims',
    !/<script[^>]+src=["']\/?hud\.js["']/i.test(html), '');

  // CP8 every script block parses. A syntax error in one of three inline
  // blocks takes out everything below it in that block and nothing else, so it
  // can ship looking almost fine.
  const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-syn-'));
  let syntaxOK = true;
  blocks.forEach((b, i) => {
    const f = path.join(tmp, `block${i}.js`);
    fs.writeFileSync(f, b);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { syntaxOK = false; say(`      block ${i}: ${String(e.stderr).split('\n')[2] || 'parse error'}`); }
  });
  // CP4e — software-rasterizer detection is present and wired (SC1 §3.6). A
  // WebGL2 context served by SwiftShader/llvmpipe is "available" and then stalls
  // the main thread for minutes in the run (Site run 33557287187, twice). The
  // detection must (a) read WEBGL_debug_renderer_info, (b) fall back to one
  // timed PLAY-frame probe when the extension is absent, feed the renderer's own
  // _fail() (no second fallback mechanism), run ONCE in ensureRenderer, and be
  // skippable by ?renderer=webgl2 which persists nothing.
  const detDefined = /function softwareRasterizerVerdict\(r\)\{/.test(html);
  const detSniff = /getExtension\('WEBGL_debug_renderer_info'\)[\s\S]{0,400}UNMASKED_RENDERER_WEBGL[\s\S]{0,200}\/swiftshader\|llvmpipe\|software\/i/.test(html);
  const detProbe = /mode:'PLAY',cinematic:0[\s\S]{0,300}readPixels\(0,0,1,1[\s\S]{0,200}SOFTWARE_PROBE_BUDGET_MS/.test(html);
  const detWired = /if\(renderer3D\.active&&!FORCE_WEBGL2\)\{const why=softwareRasterizerVerdict\(renderer3D\);if\(why\)\{renderer3D\._disposeGL\(\);renderer3D\._fail\('SOFTWARE_RASTERIZER',why\);\}\}/.test(html);
  const detOnce = (html.match(/softwareRasterizerVerdict\(renderer3D\)/g) || []).length === 1;
  const detOptIn = /const FORCE_WEBGL2=rendererQuery==='webgl2';/.test(html) && /rendererQuery==='3d'\|\|FORCE_WEBGL2/.test(html);
  gate('CP4e', 'software-rasterizer detection: sniff, timed probe, single fallback path, once, webgl2 opt-in',
    detDefined && detSniff && detProbe && detWired && detOnce && detOptIn,
    `defined=${detDefined} sniff=${detSniff} probe=${detProbe} wired=${detWired} once=${detOnce} optIn=${detOptIn}`);

  gate('CP8s', 'every inline script block parses', syntaxOK && blocks.length > 0,
    `${blocks.length} block(s)`);

  // The archive's 22-check contract is re-derived here for CyberPulse. These
  // are the sixteen source legs; C17-C22 are exercised in a real browser below.
  const authority = blocks.find((block) => block.includes('CYBERPULSE: BLACKOUT — native WebGL2')) || '';
  const authoritySha = crypto.createHash('sha256').update(authority).digest('hex');
  const bytes = Buffer.byteLength(html, 'utf8');
  const externalTags = [...html.matchAll(/<(?:script|link|img|audio|video|source)\b[^>]*(?:src|href)=['"](https?:|\/\/)[^'"]*['"][^>]*>/gi)];
  const viewportTag = (html.match(/<meta[^>]+name=['"]viewport['"][^>]*>/i) || [''])[0];
  const contract = [
    ['C01', 'Candidate exists', bytes > 0, `${bytes} bytes`],
    ['C02', 'Immutable source hash', authoritySha === AUTHORITY_SHA, `${authoritySha} (${Buffer.byteLength(authority)} bytes)`],
    ['C03', 'Expanded candidate retains source payload scale', bytes >= FROZEN_SOURCE_BYTES, `${bytes} >= ${FROZEN_SOURCE_BYTES}`],
    ['C04', 'V6 identity and release API', /MBM-V6-RELEASE: build 6\.0\.1/.test(html) && /__MBM_V6_RELEASE__/.test(html) && /GAME_ID='cyberpulse-blackout'/.test(html) && /gameId:GAME_ID/.test(html), 'marker + release API + game id'],
    ['C05', 'Schema-6 isolated profile', /PROFILE_KEY='mbm_v6_profile'/.test(html) && /schema:6/.test(html) && /migration:\{mode:'read-only'/.test(html), 'shared profile, isolated game record, read-only migration'],
    ['C06', 'Viewport zoom remains enabled', !/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1/i.test(viewportTag), viewportTag],
    ['C07', 'Portrait dead-zone and safe areas', /safe-area-inset-(?:top|right|bottom|left)/.test(html) && /@media\(orientation:portrait\)/.test(html), 'four safe-area variables + portrait placement'],
    ['C08', '44px touch target contract', /button,\[role="button"\]\{min-height:44px\}/.test(html) && /min-width:44px/.test(html), 'global control floor + estate exit floor'],
    ['C09', 'Keyboard, focus and ARIA contract', /addEventListener\('keydown'/.test(html) && /focus-visible/.test(html) && /setAttribute\('role','application'\)/.test(html) && /aria-live="polite"/.test(html), 'keyboard + focus ring + application and live regions'],
    ['C10', 'Reduced-motion and calm path', /prefers-reduced-motion:reduce/.test(html) && /v6-cyber-calm/.test(html) && /addEventListener\('change',onReduce\)/.test(html), 'CSS floor + calm control + live media-query listener'],
    ['C11', 'Visibility interruption safety', /visibilitychange/.test(authority) && /if\(document\.hidden\).*pause\(\)/s.test(authority), 'frozen authority pauses on hide'],
    ['C12', 'Compressed resumable WebAudio', /createDynamicsCompressor/.test(authority) && /\.resume\(\)/.test(authority), 'frozen audio compressor + resume path'],
    ['C13', 'Game-specific forecast or intent', /id="v6CyberIntel"/.test(html) && /v6CyberMission/.test(html) && /v6CyberThreat/.test(html), 'mission, threat, and renderer readout'],
    ['C14', 'Skippable cinematic presentation', /id="v6CyberIntro"/.test(html) && /id="v6CyberSkip"/.test(html) && /skip\.addEventListener\('click',closeIntro\)/.test(html), 'bounded intro + explicit skip'],
    ['C15', 'No external runtime dependency tags', externalTags.length === 0, externalTags.length ? externalTags[0][0] : '0 external runtime tags'],
    ['C16', `Inline JavaScript parses (${blocks.length} blocks)`, syntaxOK && blocks.length === 4, `${blocks.length} parsed blocks`]
  ];
  for (const [id, title, ok, detail] of contract) gate(id, title, ok, detail);
}

// ---------------------------------------------------------------------------
// A file:// page cannot be measured for "zero external requests" honestly,
// because a same-directory fetch is also file://. Serve the repo instead, so
// every request the page makes is an http request we can count.
// ---------------------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ---------------------------------------------------------------------------
// Browser gates - what the page actually does.
// ---------------------------------------------------------------------------
async function browserGates(gameDir) {
  let chromium;
  try { ({ chromium } = loadPlaywright()); }
  catch (_) { gate('CPB', 'browser gates', false, 'playwright unavailable — run in CI (SHIPPED-AS-CI)'); return; }

  const { server, origin } = await startServer(gameDir);
  const pinned = process.env.CYBERPULSE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const exe = pinned && fs.existsSync(pinned) ? pinned : undefined;
  const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
  if (exe) launch.executablePath = exe;
  const browser = await chromium.launch(launch);
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const offsite = [], errors = [];
    page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) offsite.push(u); });
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    // The primary page is pinned to the 2D renderer with the game's own
    // ?renderer=2d escape hatch, and that is a measurement decision, not a
    // convenience.
    //
    // wants3D() consults exactly two things — the ?renderer query and the
    // stored renderMode preference. It does NOT detect software rendering, so
    // on a machine without a GPU the game attempts WebGL2 anyway, and a heavy
    // WebGL2 scene under SwiftShader takes the tab down. Measured here:
    //
    //   webgl2 refused    500..20000ms   badge "CANVAS // SAFE", #game
    //                                    painting 486-582 colours, heap 3->7MB
    //   normal boot       dead before 500ms
    //
    // Every gate below is renderer-independent — a way out, a network log, a
    // heading, a splash — so racing that crash to read them would buy nothing
    // but flake. The renderer itself is gated separately and deliberately, at
    // CP4b.
    await page.goto(origin + '/cyberpulse/?renderer=2d');
    await page.waitForTimeout(400);

    // CP5 runtime, taken WHILE the splash is up. The exit region mounts inside
    // a bare try/catch, so a throw leaves the page with no way out and no
    // error; and this route is the splash's visual donor, so the splash
    // burying its own exit is the live version of that hazard. Measured by
    // elementFromPoint, not by comparing declared z-indexes: a stacking
    // context defeats the comparison while the pixel stays correct, and the
    // pixel is what a child's thumb lands on.
    const early = await page.evaluate(() => {
      const a = document.getElementById('mbmexit-back');
      if (!a) return { present: false };
      const r = a.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        present: true, href: a.getAttribute('href'), tag: a.tagName,
        w: Math.round(r.width), h: Math.round(r.height),
        topmost: !!(top && (top === a || a.contains(top))),
        splashUp: !!document.getElementById('mbmSplash')
      };
    });
    gate('CP5', 'the way out is a real link, 44px, and on top while the splash is up',
      early.present && early.tag === 'A' && early.href === '/games/' &&
      early.w >= 44 && early.h >= 44 && early.topmost && early.splashUp,
      early.present
        ? `${early.tag} -> ${early.href}, ${early.w}x${early.h}, topmost=${early.topmost}, splash up=${early.splashUp}`
        : 'no #mbmexit-back mounted — the inline exit threw inside its own catch');

    await page.waitForTimeout(4200);

    // CP1 runtime. The static scan cannot see a fetch built from fragments.
    gate('CP1', 'zero offsite requests at boot', offsite.length === 0,
      offsite.length ? offsite.slice(0, 3).join(' | ') : 'network log carries only same-origin');
    gate('CP9', 'boot with zero console/page errors', errors.length === 0,
      errors.slice(0, 2).join(' | ') || 'clean');

    const release = await page.evaluate(() => {
      const api = window.__MBM_V6_RELEASE__;
      return api ? { version: api.version, gameId: api.gameId, edition: api.edition,
        offline: api.offline, hasSelfTest: typeof api.selfTest === 'function' } : null;
    });
    gate('C17', 'Browser boot and release API', release && release.version === RELEASE_VERSION
      && release.gameId === 'cyberpulse-blackout' && release.edition === 'AAA V6'
      && release.offline === true && release.hasSelfTest,
    release ? JSON.stringify(release) : 'release API absent');

    const selfTest = await page.evaluate(() => window.__MBM_V6_RELEASE__?.selfTest?.() || null);
    gate('C18', 'Browser selfTest passes', selfTest && selfTest.ok === true,
      selfTest ? JSON.stringify(selfTest.checks) : 'selfTest absent');

    const runtimeA11y = await page.evaluate(() => {
      const ids = new Set(), duplicates = [];
      for (const node of document.querySelectorAll('[id]')) {
        if (ids.has(node.id)) duplicates.push(node.id); ids.add(node.id);
      }
      const missingRefs = [];
      for (const node of document.querySelectorAll('[aria-labelledby],[aria-describedby]')) {
        for (const id of `${node.getAttribute('aria-labelledby') || ''} ${node.getAttribute('aria-describedby') || ''}`.trim().split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) missingRefs.push(id);
        }
      }
      const unnamed = [...document.querySelectorAll('button')].filter((button) => {
        const style = getComputedStyle(button), rect = button.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || !rect.width || !rect.height) return false;
        return !(button.getAttribute('aria-label') || button.textContent.trim() || button.title);
      }).length;
      return { duplicates, missingRefs, unnamed, canvasRole: document.getElementById('game')?.getAttribute('role'),
        primary: document.getElementById('startBtn')?.hasAttribute('data-mbm-primary-start') };
    });
    gate('C19', 'Runtime IDs, ARIA refs and control names', runtimeA11y.duplicates.length === 0
      && runtimeA11y.missingRefs.length === 0 && runtimeA11y.unnamed === 0
      && runtimeA11y.canvasRole === 'application' && runtimeA11y.primary,
    JSON.stringify(runtimeA11y));

    const migrationContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const migrationPage = await migrationContext.newPage();
    const sentinel = '{"best":731,"sector":4,"weapon":"RAIL"}';
    await migrationPage.addInitScript((legacy) => {
      localStorage.clear();
      localStorage.setItem('cyberpulse_blackout_v1', legacy);
    }, sentinel);
    await migrationPage.goto(origin + '/cyberpulse/?renderer=2d&splash=skip');
    await migrationPage.waitForFunction(() => !!window.__MBM_V6_RELEASE__);
    const migration = await migrationPage.evaluate(() => ({
      legacy: localStorage.getItem('cyberpulse_blackout_v1'),
      profile: JSON.parse(localStorage.getItem('mbm_v6_profile') || 'null'),
      report: window.__MBM_V6_RELEASE__.selfTest()
    }));
    await migrationContext.close();
    const gameProfile = migration.profile?.games?.['cyberpulse-blackout'];
    gate('C20', 'Schema-6 migration reports legacy preservation', migration.legacy === sentinel
      && migration.profile?.schema === 6 && gameProfile?.schema === 6
      && gameProfile?.migration?.mode === 'read-only' && migration.report?.checks?.legacyUntouched === true,
    `legacy=${migration.legacy === sentinel} profile=${migration.profile?.schema} game=${gameProfile?.schema} mode=${gameProfile?.migration?.mode}`);
    gate('C21', 'No external requests during boot', offsite.length === 0,
      offsite.length ? offsite.slice(0, 3).join(' | ') : '0 external requests');
    gate('C22', 'No uncaught browser errors', errors.length === 0,
      errors.slice(0, 2).join(' | ') || '0 errors');

    // CP3 runtime: exactly one h1 that a reader can actually see. A second one
    // hidden by CSS is still a second one to a screen reader.
    const h1 = await page.evaluate(() => {
      const all = [...document.querySelectorAll('h1')];
      const vis = all.filter((e) => {
        const c = getComputedStyle(e), r = e.getBoundingClientRect();
        return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      });
      return { total: all.length, visible: vis.length, text: (vis[0]?.textContent || '').trim().slice(0, 40) };
    });
    gate('CP3', 'exactly one visible h1 when rendered', h1.visible === 1,
      `${h1.visible} visible of ${h1.total} — "${h1.text}"`);

    // CP4b — the declared Canvas fallback, driven by refusing webgl2 outright.
    //
    // #scene3d is the WebGL2 layer and #game is the 2D one. They are two
    // LAYERS, not two renderers of one thing, so sampling "the first
    // viewport-sized canvas" reads #scene3d — which, with webgl2 refused, is a
    // canvas that never got a context at all and reports one flat colour. That
    // is what a first cut of this gate did, and it failed the game for the
    // harness's mistake. #game is the one that has to keep drawing.
    //
    // Sampled at two separated moments, because one painted frame proves a
    // draw happened, not that a renderer is running.
    const fbPage = await context.newPage();
    const fbErrors = [];
    fbPage.on('pageerror', (e) => fbErrors.push(String(e.message)));
    await fbPage.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (String(type).startsWith('webgl')) return null;   // the fallback trigger
        return real.call(this, type, ...rest);
      };
    });
    const readFallback = () => fbPage.evaluate(() => {
      const badge = document.getElementById('rendererStatus');
      const game = document.getElementById('game');
      const state = {
        badge: badge ? badge.textContent.trim() : null,
        announced: badge ? badge.classList.contains('fallback') : false,
        colours: null
      };
      if (!game) return state;
      try {
        const g = game.getContext('2d');
        const sw = Math.min(game.width, 240), sh = Math.min(game.height, 240);
        const x = Math.max(0, (game.width >> 1) - (sw >> 1));
        const y = Math.max(0, (game.height >> 1) - (sh >> 1));
        const d = g.getImageData(x, y, sw, sh).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
        state.colours = seen.size;
      } catch (e) { state.colours = 'threw: ' + e.message; }
      return state;
    });
    await fbPage.goto(origin + '/cyberpulse/');
    await fbPage.waitForTimeout(1500);
    const fb1 = await readFallback();
    await fbPage.waitForTimeout(4000);
    const fb2 = await readFallback();
    const painting = Number(fb1.colours) > 1 && Number(fb2.colours) > 1;
    gate('CP4b', 'with webgl2 refused the fallback engages, says so, and keeps painting',
      painting && fb1.badge === 'CANVAS // SAFE' && fb1.announced
      && fb2.badge === 'CANVAS // SAFE' && fb2.announced && fbErrors.length === 0,
      `badge "${fb2.badge}" announced=${fb2.announced}; #game colours ${fb1.colours} at 1.5s, ${fb2.colours} at 5.5s`
      + (fbErrors.length ? ' | errors: ' + fbErrors.slice(0, 2).join(' | ') : ''));
    await fbPage.close();

    // CP4c — the same fallback, reached the way a PLAYER can reach it. The
    // ?renderer=2d hatch is the only lever anyone without a GPU actually has,
    // since wants3D() does not detect software rendering, so it has to work.
    const hatch = await page.evaluate(() => {
      const badge = document.getElementById('rendererStatus');
      const game = document.getElementById('game');
      let colours = null;
      try {
        const g = game.getContext('2d');
        const sw = Math.min(game.width, 240), sh = Math.min(game.height, 240);
        const d = g.getImageData(Math.max(0, (game.width >> 1) - (sw >> 1)),
          Math.max(0, (game.height >> 1) - (sw >> 1)), sw, sh).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
        colours = seen.size;
      } catch (e) { colours = 'threw: ' + e.message; }
      return { badge: badge ? badge.textContent.trim() : null,
        announced: badge ? badge.classList.contains('fallback') : false, colours };
    });
    gate('CP4c', '?renderer=2d reaches the same announced fallback',
      hatch.badge === 'CANVAS // SAFE' && hatch.announced && Number(hatch.colours) > 1,
      `badge "${hatch.badge}" announced=${hatch.announced}, #game colours ${hatch.colours}`);

    // CP4f — the browser reports a software rasterizer: the game must take the
    // same announced Canvas path WITHOUT the hatch. The renderer string is
    // mocked so the gate does not depend on which GPU the runner has, and
    // localStorage is compared before and after so the selection is proven to
    // write nothing. CP4g — ?renderer=webgl2 under the same mock keeps WebGL2
    // (the opt-in for a falsely-sniffed real GPU), also writing nothing.
    const mockSoftware = () => {
      const realGetParameter = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (name) {
        const ext = this.getExtension('WEBGL_debug_renderer_info');
        if (ext && name === ext.UNMASKED_RENDERER_WEBGL) return 'Google SwiftShader';
        return realGetParameter.call(this, name);
      };
    };
    const readRenderer = (pg) => pg.evaluate(() => {
      const badge = document.getElementById('rendererStatus');
      return { badge: badge ? badge.textContent.trim() : null,
        announced: badge ? badge.classList.contains('fallback') : false,
        keys: Object.keys(localStorage).sort() };
    });
    const swPage = await context.newPage();
    const swErrors = [];
    swPage.on('pageerror', (e) => swErrors.push(String(e.message)));
    await swPage.addInitScript(mockSoftware);
    await swPage.goto(origin + '/cyberpulse/?splash=skip');
    await swPage.waitForTimeout(1500);
    const sw = await readRenderer(swPage);
    await swPage.close();
    const ctrlPage = await context.newPage();
    await ctrlPage.goto(origin + '/cyberpulse/?splash=skip&renderer=2d');
    await ctrlPage.waitForTimeout(800);
    const ctrlKeys = (await readRenderer(ctrlPage)).keys;
    await ctrlPage.close();
    gate('CP4f', 'a reported software rasterizer selects the announced Canvas path with no hatch and writes nothing',
      sw.badge === 'CANVAS // SAFE' && sw.announced && swErrors.length === 0 && JSON.stringify(sw.keys) === JSON.stringify(ctrlKeys),
      `badge "${sw.badge}" announced=${sw.announced}; storage keys ${sw.keys.length} (control ${ctrlKeys.length})`
      + (swErrors.length ? ' | errors: ' + swErrors.slice(0, 2).join(' | ') : ''));
    const optPage = await context.newPage();
    const optErrors = [];
    optPage.on('pageerror', (e) => optErrors.push(String(e.message)));
    await optPage.addInitScript(mockSoftware);
    await optPage.goto(origin + '/cyberpulse/?splash=skip&renderer=webgl2');
    await optPage.waitForTimeout(1500);
    const opt = await readRenderer(optPage);
    await optPage.close();
    gate('CP4g', '?renderer=webgl2 keeps WebGL2 under a reported software rasterizer and writes nothing',
      /^WEBGL2 \/\/ /.test(String(opt.badge)) && !opt.announced && optErrors.length === 0 && JSON.stringify(opt.keys) === JSON.stringify(ctrlKeys),
      `badge "${opt.badge}" announced=${opt.announced}; storage keys ${opt.keys.length} (control ${ctrlKeys.length})`
      + (optErrors.length ? ' | errors: ' + optErrors.slice(0, 2).join(' | ') : ''));

    // CP4d is the real renderer leg. A V6 identity object on a filename does
    // not prove that the frozen WebGL authority can create a context and draw.
    const glPage = await context.newPage();
    const glErrors = [];
    glPage.on('pageerror', (error) => glErrors.push(String(error.message)));
    let glReport;
    try {
      // ?renderer=webgl2 is the opt-in that skips the software-rasterizer
      // detection (CP4e/CP4f). On a GPU-less runner the detection would route
      // this leg to Canvas, so the real-renderer proof must use the opt-in.
      await glPage.goto(origin + '/cyberpulse/?renderer=webgl2&splash=skip');
      await glPage.waitForFunction(() => /^WEBGL2/.test(document.getElementById('rendererStatus')?.textContent || ''), null, { timeout: 15000 });
      await glPage.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      glReport = await glPage.evaluate(() => {
        const canvas = document.getElementById('scene3d'), badge = document.getElementById('rendererStatus');
        const gl = canvas?.getContext('webgl2');
        if (!gl) return { active: false, badge: badge?.textContent || '', reason: 'no WebGL2 context' };
        const width = Math.min(96, canvas.width), height = Math.min(96, canvas.height);
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(Math.max(0, (canvas.width - width) >> 1), Math.max(0, (canvas.height - height) >> 1), width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const colours = new Set(); let nonzero = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          colours.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
          if (pixels[i] || pixels[i + 1] || pixels[i + 2]) nonzero++;
        }
        return { active: true, badge: badge?.textContent || '', width: canvas.width, height: canvas.height,
          colours: colours.size, nonzero, renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION),
          api: typeof window.CyberpulseWebGLRenderer === 'function' };
      });
    } catch (error) {
      glReport = { active: false, reason: error.message };
    }
    gate('CP4d', 'real WebGL2 renderer creates a context and paints', glReport.active
      && /^WEBGL2/.test(glReport.badge) && glReport.colours > 1 && glReport.nonzero > 0
      && glReport.api && glErrors.length === 0,
    JSON.stringify({ ...glReport, errors: glErrors.slice(0, 2) }));
    await glPage.close();

    // CP10 the splash stands down. A donor that never dismisses its own splash
    // would leave every other route's copy looking correct and this one stuck.
    const done = await page.evaluate(() => {
      const s = document.getElementById('mbmSplash');
      if (!s) return { gone: true, how: 'removed from the document' };
      const c = getComputedStyle(s);
      return { gone: c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) === 0,
        how: `display=${c.display} visibility=${c.visibility} opacity=${c.opacity}` };
    });
    gate('CP10', 'the maker splash stands down and does not hold the game', done.gone, done.how);
  } finally {
    await browser.close();
    server.close();
  }
}

// ---------------------------------------------------------------------------
// Non-vacuity: every static gate must be shown to fail on a violating build.
// ---------------------------------------------------------------------------
function selftest(html, manifestRaw) {
  say('\n--- non-vacuity: each gate must fail on a build that violates it ---');
  const mutations = [
    { gate: 'CP1s', why: 'add an http(s) reference',
      mutate: (s) => [s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three/build/three.min.js"></script></head>'), manifestRaw] },
    { gate: 'CP2s', why: 'drift the version in the title',
      mutate: (s) => [s.replace('<title>CYBERPULSE: BLACKOUT · AAA V6', '<title>CYBERPULSE: BLACKOUT · AAA V7'), manifestRaw] },
    { gate: 'CP2s', why: 'drift the version in the release record only',
      // Mutate the record through JSON, not through a text search. The first
      // attempt matched forward from "/cyberpulse/" for the next "v1.5" — but
      // `desc` is serialised BEFORE `href`, so it never touched this entry.
      // The harness caught that itself: the mutation changed nothing, and the
      // run reported "?? mutation did not change anything" and refused to
      // count the gate as proven. A mutation that cannot fire is worth exactly
      // as much as a gate that cannot fail.
      mutate: (s) => {
        const record = JSON.parse(manifestRaw);
        const entry = (record.games || []).find((g) => g.href === '/cyberpulse/');
        if (!entry) return [s, manifestRaw];
        entry.desc = String(entry.desc).replace(/\bV6\b/, 'V5');
        return [s, JSON.stringify(record, null, 2) + '\n'];
      } },
    { gate: 'CP3s', why: 'disable pinch zoom',
      mutate: (s) => [s.replace('content="width=device-width,initial-scale=1,viewport-fit=cover"',
        'content="width=device-width,initial-scale=1,user-scalable=no"'), manifestRaw] },
    { gate: 'CP3s', why: 'add a second h1',
      mutate: (s) => [s.replace('<h1 class="logo">', '<h1 class="shadow">CYBERPULSE</h1><h1 class="logo">'), manifestRaw] },
    { gate: 'CP4s', why: 'remove the 2d fallback',
      mutate: (s) => [s.replace(/getContext\('2d'/, "getContext('webgl'"), manifestRaw] },
    { gate: 'CP5s', why: 'edit the generated exit region by hand',
      mutate: (s) => [s.replace('MBM-INLINE-EXIT:END -->', 'MBM-INLINE-EXIT:END --><!--x-->')
        .replace('var back=el("a"', 'var back=el("span"'), manifestRaw] },
    { gate: 'CP6s', why: 'edit the generated splash region by hand',
      mutate: (s) => [s.replace('MBM-MAKER-SPLASH:END -->', '<!--x--> MBM-MAKER-SPLASH:END -->'), manifestRaw] },
    { gate: 'CP7s', why: 'take the HUD script, retracting the exclusion premise',
      mutate: (s) => [s.replace('</body>', '<script src="/hud.js"></script></body>'), manifestRaw] },
    { gate: 'CP8s', why: 'introduce a syntax error',
      mutate: (s) => [s.replace("const VERSION='v1.5'", "const VERSION=='v1.5'"), manifestRaw] },
    { gate: 'C01', why: 'remove the candidate bytes',
      mutate: () => ['', manifestRaw] },
    { gate: 'C02', why: 'change one byte inside the frozen authority block',
      mutate: (s) => [s.replace('const STEP=1/120', 'const STEP=1/121'), manifestRaw] },
    { gate: 'C03', why: 'truncate below the measured source-payload floor',
      mutate: (s) => [s.slice(0, FROZEN_SOURCE_BYTES - 5000), manifestRaw] },
    { gate: 'C04', why: 'remove the V6 release marker',
      mutate: (s) => [s.replace('MBM-V6-RELEASE: build 6.0.1', 'MBM-RELEASE-MISSING'), manifestRaw] },
    { gate: 'C05', why: 'change the isolated profile schema',
      mutate: (s) => [s.replace("PROFILE_KEY='mbm_v6_profile'", "PROFILE_KEY='mbm_v5_profile'").replace("migration:{mode:'read-only'", "migration:{mode:'copying'"), manifestRaw] },
    { gate: 'C06', why: 'disable viewport zoom',
      mutate: (s) => [s.replace('viewport-fit=cover', 'viewport-fit=cover,user-scalable=no'), manifestRaw] },
    { gate: 'C07', why: 'remove the portrait safe-area anchor',
      mutate: (s) => [s.replace('safe-area-inset-top', 'unsafe-area-top').replace('@media(orientation:portrait)', '@media(min-width:99999px)'), manifestRaw] },
    { gate: 'C08', why: 'lower the V6 touch-target floor',
      mutate: (s) => [s.replace('button,[role="button"]{min-height:44px}', 'button,[role="button"]{min-height:20px}').replace('min-width:44px', 'min-width:20px'), manifestRaw] },
    { gate: 'C09', why: 'remove the canvas application role',
      mutate: (s) => [s.replace("canvas.setAttribute('role','application')", "canvas.setAttribute('role','presentation')"), manifestRaw] },
    { gate: 'C10', why: 'detach the live reduced-motion listener',
      mutate: (s) => [s.replace("addEventListener('change',onReduce)", "addEventListener('never',onReduce)"), manifestRaw] },
    { gate: 'C11', why: 'detach the authority visibility interruption path',
      mutate: (s) => [s.replace("document.addEventListener('visibilitychange',()=>", "document.addEventListener('visibilitygone',()=>"), manifestRaw] },
    { gate: 'C12', why: 'remove compression from the frozen audio path',
      mutate: (s) => [s.replace('createDynamicsCompressor', 'createGain'), manifestRaw] },
    { gate: 'C13', why: 'remove the game-specific forecast surface',
      mutate: (s) => [s.replace('id="v6CyberIntel"', 'id="v6CyberIntelMissing"'), manifestRaw] },
    { gate: 'C14', why: 'detach the explicit intro skip',
      mutate: (s) => [s.replace("skip.addEventListener('click',closeIntro)", "skip.addEventListener('click',function(){})"), manifestRaw] },
    { gate: 'C15', why: 'add an external runtime dependency tag',
      mutate: (s) => [s.replace('</head>', '<script src="https://example.invalid/runtime.js"></script></head>'), manifestRaw] },
    { gate: 'C16', why: 'break one inline V6 script',
      mutate: (s) => [s.replace("var VERSION='6.0.1'", "var VERSION=='6.0.1'"), manifestRaw] },
    { gate: 'CP4e', why: 'remove the software-rasterizer detection block',
      mutate: (s) => [s.replace(/const why=softwareRasterizerVerdict\(renderer3D\);if\(why\)\{[^}]*\}/, 'const why=null;'), manifestRaw] },
    { gate: 'CP4e', why: 'remove the ?renderer=webgl2 opt-in',
      mutate: (s) => [s.replace("const FORCE_WEBGL2=rendererQuery==='webgl2';", "const FORCE_WEBGL2=false;"), manifestRaw] }
  ];

  let proven = 0, inert = 0;
  for (const mut of mutations) {
    const [brokenHtml, brokenManifest] = mut.mutate(html);
    if (brokenHtml === html && brokenManifest === manifestRaw) {
      say(`  ??  ${mut.gate}: mutation "${mut.why}" did not change anything`); inert++; continue;
    }
    const saved = results; results = [];
    staticGates(brokenHtml, brokenManifest);
    const got = results; results = saved;
    const target = got.find((g) => g.id === mut.gate);
    const caught = target && !target.ok;
    say(`  ${caught ? 'CAUGHT' : 'MISSED'}  ${mut.gate}: ${mut.why}`);
    if (caught) proven++;
  }
  gate('NV', 'gates are non-vacuous', proven === mutations.length && inert === 0,
    `${proven}/${mutations.length} violations caught${inert ? `, ${inert} mutation(s) inert` : ''}`);
}

// ---------------------------------------------------------------------------
(async function main() {
  if (!fs.existsSync(GAME)) { say('FATAL: game file not found: ' + GAME); process.exit(2); }
  const html = fs.readFileSync(GAME, 'utf8');
  const manifestPath = path.join(ROOT, 'data', 'source-manifests', 'games.json');
  const manifestRaw = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '{}';

  say(`CYBERPULSE: BLACKOUT — ${GAME} (${Buffer.byteLength(html, 'utf8')} bytes)`);
  staticGates(html, manifestRaw);
  await browserGates(path.dirname(path.dirname(GAME)));
  if (SELFTEST) selftest(html, manifestRaw);

  const failed = results.filter((r) => !r.ok);
  say(`\n${results.length - failed.length}/${results.length} gates green`);
  if (failed.length) { say('FAILED: ' + failed.map((f) => f.id).join(', ')); process.exit(1); }
  say('ALL GATES GREEN');
})();
