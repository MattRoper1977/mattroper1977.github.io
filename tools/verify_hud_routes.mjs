/*
 * hud.js route resolution — the ROOT_TOOLS additions must be purely additive.
 *
 * hud.js is served onto games, apps, registers, lessons and now two root-level
 * teacher tools. Adding a route class to a file that every one of those pages
 * loads is the kind of edit that is easy to get subtly wrong and hard to see:
 * a page whose BACK silently changes target still looks fine.
 *
 * So this asserts the whole resolution table against a baseline commit rather
 * than asserting the new route alone. Routes that resolved before must resolve
 * to exactly the same target, routes that resolved to nothing must still
 * resolve to nothing, and exactly the intended additions may change.
 *
 * Why the additions were needed at all: /artsaward/ and
 * /evidence-binder/moderator-pro/ matched none of hud.js's four patterns, so
 * BACK resolved null and mount() appended nothing. That is the /neonbreach/
 * failure hud.js's own comment records - the script tag present, the HUD
 * absent, for months, because nothing asserted the chip.
 *
 * Usage:  node tools/verify_hud_routes.mjs
 *         HUD_BASE=<ref> node tools/verify_hud_routes.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let chromium;
for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright/index.js']) {
  try { const m = await import(spec); chromium = m.chromium || (m.default && m.default.chromium); if (chromium) break; } catch (e) {}
}

const ROUTES = [
  ['/relicforge/', 'game'],
  ['/emberwild/', 'game'],
  ['/Games/Glitch_Clash.html', 'Games/ path'],
  ['/Matt-s-Apps-/Evidence_Binder.html', 'app'],
  ['/asdan/app.html', 'register'],
  ['/uas/app.html', 'register'],
  ['/Lessons/anything.html', 'lesson'],
  ['/artsaward/', 'NEW tool route'],
  ['/evidence-binder/moderator-pro/', 'NEW tool route'],
  ['/somethingelse/', 'unknown — must stay null'],
  ['/asdan/', 'asdan index — must stay null'],
];

function stubTree(hudSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hudreg-'));
  fs.writeFileSync(path.join(root, 'hud.js'), hudSource);
  for (const [route] of ROUTES) {
    const rel = route.endsWith('/') ? route + 'index.html' : route;
    const f = path.join(root, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>'
      + '<script defer src="/hud.js"></script></body></html>');
  }
  return root;
}

async function probe(root, label) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const out = {};
  for (const [route] of ROUTES) {
    await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(350);
    out[route] = await page.evaluate(() => {
      const b = document.getElementById('mbmhud-back');
      return b ? b.getAttribute('href') : null;
    });
  }
  await browser.close(); s.close();
  return out;
}

const current = fs.readFileSync(path.join(REPO, 'hud.js'), 'utf8');
const BASE = process.env.HUD_BASE || 'afba6d4';   // main before any change in this session
const before = execFileSync('git', ['-C', REPO, 'show', BASE + ':hud.js'], { encoding: 'utf8' });

const rBefore = await probe(stubTree(before), 'before');
const rAfter = await probe(stubTree(current), 'after');

console.log('route'.padEnd(38) + 'class'.padEnd(28) + 'BEFORE'.padEnd(20) + 'AFTER');
let regressions = 0, added = 0;
for (const [route, cls] of ROUTES) {
  const b = rBefore[route], a = rAfter[route];
  const same = b === a;
  if (!same && b !== null) regressions++;
  if (!same && b === null) added++;
  console.log(route.padEnd(38) + cls.padEnd(28) + String(b).padEnd(20) + String(a) + (same ? '' : '   <-- CHANGED'));
}
console.log(`\nchanged-from-non-null (regressions): ${regressions}`);
console.log(`changed-from-null (intended additions): ${added}`);
console.log(regressions === 0 && added === 2
  ? '\nPASS — exactly the two intended routes gained a target, nothing else moved.'
  : '\nFAIL — the change is not purely additive.');
process.exit(regressions === 0 && added === 2 ? 0 : 1);
