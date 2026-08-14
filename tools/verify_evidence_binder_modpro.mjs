/*
 * Evidence Binder — Moderator Pro. Landing gates.
 *
 * PLACEMENT, measured before anything was written (the ordered STOP):
 *
 *   live   /Matt-s-Apps-/Evidence_Binder.html   IndexedDB "evbinder"
 *   this   Moderator Pro                        IndexedDB "MBM_Evidence_Binder_v5"
 *
 * The names differ, so replacing the live file in place would have silently
 * orphaned every record already banked in "evbinder" - and the two are not even
 * versions of one app (49,732 B against 239,952 B, different object stores).
 * Moderator Pro therefore lands at its OWN route and the live Binder is left
 * exactly where it is. §1 pins that, so a later in-place swap trips a gate
 * rather than a user's missing data.
 *
 * The other gate that carries its weight here is §5, dictation consent. The
 * page used to claim "Stored only in this browser. Nothing is uploaded." while
 * six Dictate buttons drove webkitSpeechRecognition, which streams audio to the
 * browser vendor - one of them sitting on "Learner's exact words". The CSP's
 * connect-src 'none' does not cover it: speech is a user-agent service, not a
 * page fetch, so the CSP gave false assurance. Consent is asserted in BOTH
 * directions, because a gate that only checks the happy path would pass on an
 * app that never asks at all.
 *
 * Usage:  node tools/verify_evidence_binder_modpro.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = 'evidence-binder/moderator-pro/index.html';
const ROUTE = '/evidence-binder/moderator-pro/';
const DB_NAME = 'MBM_Evidence_Binder_v5';
const LIVE_DB = 'evbinder';            // the live Binder in MattRoper1977/Matt-s-Apps-
const CONSENT_KEY = 'eb_modpro_v5_voice_consent';
const NAV_MS = 45000;

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  (ok ? pass++ : fail++);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) break;
  } catch (e) { /* next */ }
}
if (!chromium) { console.error('INCONCLUSIVE: playwright is not importable.'); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

/*
 * A deterministic stand-in for the vendor speech API. Headless Chromium ships
 * no webkitSpeechRecognition, and with none present toggle() returns at its
 * first line - so without this the consent gate below would "pass" having never
 * run. The stub is the API surface only; what is being tested is this app's
 * consent logic in front of it, and whether start() is ever reached.
 */
const SPEECH_STUB = () => {
  window.__speechStarts = 0;
  class FakeRecognition {
    constructor() { this.continuous = false; this.interimResults = false; this.lang = 'en-GB'; }
    start() { window.__speechStarts++; }
    stop() {}
    abort() {}
  }
  window.webkitSpeechRecognition = FakeRecognition;
  window.SpeechRecognition = FakeRecognition;
};

async function boot(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 } });
  await ctx.addInitScript(SPEECH_STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(origin + ROUTE, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForTimeout(opts.settle || 1800);
  return { ctx, page, errors };
}

try {
  const src = fs.readFileSync(path.join(ROOT, APP), 'utf8');

  /* ---------------- 1. placement ---------------- */
  console.log('--- 1. placement (the ordered STOP, pinned) ---');
  check(src.includes(`const DB_NAME = "${DB_NAME}"`),
    `this app owns IndexedDB "${DB_NAME}"`, DB_NAME);
  check(!src.includes(`"${LIVE_DB}"`) && !src.includes(`'${LIVE_DB}'`),
    `it does NOT claim the live Binder's "${LIVE_DB}" database`,
    'no collision with the record store already in use');
  check(fs.existsSync(path.join(ROOT, APP)),
    'it lands at its own route, beside the live Binder rather than over it', ROUTE);
  check(!fs.existsSync(path.join(ROOT, 'Matt-s-Apps-', 'Evidence_Binder.html')),
    'the live Binder is not in this repository and was not touched by this landing',
    'it lives in MattRoper1977/Matt-s-Apps-');
  check(!/\btrial\b/i.test(src), 'no "trial" strings remain in user-facing copy',
    `${(src.match(/trial/gi) || []).length} occurrences`);

  /* ---------------- 2. source ---------------- */
  console.log('\n--- 2. source ---');
  const lines = src.split('\n');
  const opens = [], closes = [];
  lines.forEach((l, i) => {
    if (/^\s*<script>\s*$/.test(l)) opens.push(i + 1);
    if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);
  });
  check(opens.length === 2, 'the app has exactly two inline script blocks', `found ${opens.length}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-'));
  opens.forEach((o, i) => {
    const close = closes.find(c => c > o);
    const f = path.join(tmp, `block${i + 1}.js`);
    fs.writeFileSync(f, lines.slice(o, close - 1).join('\n'));
    let ok = true, err = '';
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { ok = false; err = String(e.stderr || e).split('\n').slice(0, 2).join(' ').slice(0, 120); }
    check(ok, `inline script block ${i + 1} passes node --check`, ok ? `${close - 1 - o} lines` : err);
  });
  const csp = (src.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
  check(/script-src[^;]*'self'/.test(csp),
    "the CSP's script-src admits 'self', so the estate /hud.js loader is not blocked by the page's own policy",
    csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src')) || 'no script-src');
  check(/connect-src\s+'none'/.test(csp), "connect-src 'none' is retained");
  check(/never uploaded by this app/i.test(src),
    'the privacy claim is scoped to this app rather than claiming nothing leaves at all');

  /* ---------------- 3. boot ---------------- */
  console.log('\n--- 3. boot ---');
  let { ctx, page, errors } = await boot();
  check(errors.length === 0, 'boots with zero console errors', errors.slice(0, 2).join(' | ') || 'none');
  const dbOpened = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  check(dbOpened.includes('MBM_Evidence_Binder_v5'),
    'it opens its own database and no other', dbOpened.join(', ') || 'none');
  check(!dbOpened.includes('evbinder'),
    'it never opens the live Binder\'s database', dbOpened.join(', ') || 'none');

  /* ---------------- 4. splash + hud ---------------- */
  console.log('\n--- 4. splash and hud ---');
  const splash1 = await page.evaluate(() =>
    !!document.querySelector('.mbm-splash, #mbm-splash, [data-mbm-splash]'));
  check(splash1, 'the splash renders on a first visit in a fresh session');
  await page.waitForTimeout(2400);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForTimeout(1500);
  const splash2 = await page.evaluate(() => {
    const e = document.querySelector('.mbm-splash, #mbm-splash, [data-mbm-splash]');
    return !!e && e.offsetParent !== null;
  });
  check(!splash2, 'the splash does not render again on reload in the same session');
  const flag = await page.evaluate(() => sessionStorage.getItem('mbm_splash_evidencebinder'));
  check(!!flag, 'the once-per-session flag is stored', `mbm_splash_evidencebinder=${flag}`);

  const hud = await page.evaluate(() => {
    const b = document.getElementById('mbmhud-back');
    return { back: !!b, href: b ? b.getAttribute('href') : null };
  });
  check(hud.back, 'the /hud.js chip actually mounts — the CSP permits the loader AND the route resolves',
    `#mbmhud-back present=${hud.back}`);
  check(hud.href === '/tools/', 'the back chip resolves to the tools hub', String(hud.href));
  await ctx.close();

  /* ---------------- 5. dictation consent, both directions ---------------- */
  console.log('\n--- 5. dictation consent gate ---');
  const btnCount = (src.match(/class="voice-btn"/g) || []).length;
  check(btnCount > 0, 'the app has Dictate buttons to gate', `${btnCount} voice buttons`);
  check((src.match(/hasConsent\(\)/g) || []).length >= 1 && /this\.target !== target && !this\.hasConsent\(\)/.test(src),
    'consent is checked at the single toggle() choke point, not per button');

  async function driveConsent(accept) {
    const b = await boot({ settle: 1600 });
    b.page.on('dialog', d => { d.message(); accept ? d.accept() : d.dismiss(); });
    const clicked = await b.page.evaluate(() => {
      const btn = document.querySelector('.voice-btn[data-voice-target]');
      if (!btn) return false;
      btn.click();
      return true;
    });
    await b.page.waitForTimeout(900);
    const stored = await b.page.evaluate(k => localStorage.getItem(k), CONSENT_KEY);
    const starts = await b.page.evaluate(() => window.__speechStarts);
    await b.ctx.close();
    return { clicked, stored, starts };
  }

  const declined = await driveConsent(false);
  check(declined.clicked, 'a Dictate button was reachable and clicked (decline run)');
  check(declined.stored === 'declined',
    'CONTROL (negative): declining stores "declined"', `stored=${declined.stored}`);
  check(declined.starts === 0,
    'CONTROL (negative): declining starts no recognition — no audio leaves the device',
    `speech start() calls=${declined.starts}`);

  const granted = await driveConsent(true);
  check(granted.stored === 'granted',
    'CONTROL (positive): granting stores "granted"', `stored=${granted.stored}`);
  check(granted.starts > 0,
    'CONTROL (positive): granting proceeds to recognition — the gate is not simply blocking everything',
    `speech start() calls=${granted.starts}`);
  check(declined.starts !== granted.starts,
    'the two directions are distinguishable — the consent gate genuinely decides',
    `declined=${declined.starts} granted=${granted.starts}`);

  /* ---------------- 6. print layout, four widths ---------------- */
  console.log('\n--- 6. print layout at four widths ---');
  for (const [w, h] of [[390, 844], [768, 1024], [1280, 900], [1440, 900]]) {
    const b = await boot({ viewport: { width: w, height: h }, settle: 1500 });
    await b.page.emulateMedia({ media: 'print' });
    await b.page.waitForTimeout(400);
    const m = await b.page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    check(m.scrollW <= m.clientW + 1,
      `${w}px: the print layout does not overflow horizontally`,
      `scrollW=${m.scrollW} clientW=${m.clientW}`);
    await b.ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
