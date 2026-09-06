#!/usr/bin/env node
/* RM1-RM6 trailer capture for /cyberpulse/.
 *
 * Every frame comes from the EXACT shipped bytes: this script serves the
 * committed cyberpulse/index.html over a local origin and records the real
 * browser. No mock footage, no generative imagery, no slideshow.
 *
 * Why frames are hashed from the VIDEO rather than from page.screenshot():
 * on a software-GL runner, screenshotting this WebGL2 page forces a surface
 * readback that times out and then crashes the tab. Hashing the encoded
 * frames is both cheaper and stricter - it measures what a viewer actually
 * receives, not a parallel capture path.
 *
 *   node tools/cyberpulse/capture_trailer.mjs --out=artifacts/cyberpulse
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const ROOT = path.resolve(arg('root', process.cwd()));
const ROUTE = arg('route', 'cyberpulse/index.html');
const OUT = path.resolve(arg('out', 'artifacts/cyberpulse'));
const SECONDS = Number(arg('seconds', '24'));
const VIEWPORT = { width: 480, height: 930 }; // the house portrait clip geometry

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const subject = fs.readFileSync(path.join(ROOT, ROUTE));
console.log(`subject ${ROUTE}: ${subject.length} bytes, sha256 ${sha(subject)}`);

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || ROUTE;
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': rel.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(body);
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: OUT, size: VIEWPORT } });
const page = await ctx.newPage();
const pageErrors = [], external = [];
page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 160)));
page.on('request', r => {
  const u = r.url();
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
});

await page.goto(`${origin}/${ROUTE}?splash=skip`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(2500);

// Deterministic scripted gameplay: hangar inspection, then a combat beat.
const t0 = Date.now();
const beat = async (fn, ms) => { try { await fn(); } catch { /* input beats are best-effort */ } await page.waitForTimeout(ms); };
await beat(() => page.keyboard.press('ArrowLeft'), 700);
await beat(() => page.keyboard.press('ArrowRight'), 700);
await beat(() => page.mouse.click(VIEWPORT.width * 0.5, VIEWPORT.height * 0.72), 1200);
for (const key of ['Space', 'ArrowRight', 'Space', 'ArrowLeft', 'Space', 'ArrowUp', 'Space', 'ArrowDown', 'Space', 'ArrowRight', 'Space']) {
  if (Date.now() - t0 > SECONDS * 1000) break;
  await beat(() => page.keyboard.press(key), 420);
}
while (Date.now() - t0 < SECONDS * 1000) await page.waitForTimeout(200);

await ctx.close(); // finalises the video; without this the container is truncated
await browser.close();
server.close();

const raw = fs.readdirSync(OUT).find(f => f.endsWith('.webm'));
if (!raw) throw new Error('no video was recorded');
const master = path.join(OUT, 'capture.webm');
fs.renameSync(path.join(OUT, raw), master);

const report = {
  provenance: { route: ROUTE, subjectBytes: subject.length, subjectSha256: sha(subject) },
  capture: { viewport: VIEWPORT, seconds: SECONDS, elapsedMs: Date.now() - t0 },
  master: { bytes: fs.statSync(master).size, sha256: sha(fs.readFileSync(master)) },
  pageErrors,
  external,
};
fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));

if (pageErrors.length) throw new Error(`page errors during capture: ${JSON.stringify(pageErrors)}`);
if (external.length) throw new Error(`external requests during capture: ${JSON.stringify(external)}`);
