#!/usr/bin/env node
/* PLAY-Q1 splash proof: the one generated region shows the Play lockup on the Play
 * host (or under ?brand=play) and the Made by Matt mark elsewhere.
 *
 *   node tools/verify_play_splash.mjs [--site-root=.] [--routes=/cyberpulse/,/voxel/] [--shots=dir]
 *
 * Serves the checkout on a local port. For each route and viewport it proves, in a
 * fresh context each time (storage empty, so the window is open without ?splash=force): the region
 * paints the Play lockup with the inline copy of the accepted mark (decoded), the wordmark and the
 * supporting line;
 * the loading status is hidden once the document is complete; a tap dismisses it,
 * the 24-hour suppression is written and the overlay leaves the tree; without
 * ?brand=play the same route paints the Made by Matt mark (Education branding).
 * Exit 1 on any failure; a JSON report and screenshots are written for the ledger.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = n => { const h = process.argv.find(v => v.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : null; };
const SITE = path.resolve(arg('site-root') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const SHOTS = arg('shots') ? path.resolve(arg('shots')) : null;
const REPORT = path.resolve(arg('report') || path.join(SITE, 'artifacts', 'play-splash.json'));
const ledger = JSON.parse(fs.readFileSync(path.join(SITE, 'data', 'hud-coverage.json'), 'utf8'));
const declared = ledger.makerSplash.applied.map(i => (typeof i === 'string' ? i : i.route));
const ROUTES = arg('routes') ? arg('routes').split(',') : declared;
const LINE = 'Your next game starts here.';
const MARK = 'data:image/jpeg;base64,';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(SITE, pathname);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { origin, routes: [], failures: [] };
const fail = (route, why) => { report.failures.push({ route, why }); console.log(`FAIL ${route}: ${why}`); };
const browser = await chromium.launch();
const withQuery = (route, q) => route + (route.includes('?') ? '&' : '?') + q;
for (const route of ROUTES) {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + encodeURI(withQuery(route, 'brand=play')), { waitUntil: 'commit', timeout: 30000 });
    const el = page.locator('#mbmSplash[data-mbm-maker-splash]');
    let facts = null;
    try {
      await el.waitFor({ state: 'attached', timeout: 5000 });
      facts = await el.evaluate(e => ({
        play: e.hasAttribute('data-mbm-play'), label: e.getAttribute('aria-label'), role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'),
        img: e.querySelector('.mbm-play-lockup img')?.getAttribute('src')?.slice(0, 23) || null, imgDecoded: (e.querySelector('.mbm-play-lockup img')?.naturalWidth || 0) > 0, word: e.querySelector('.mbm-play-word')?.textContent.trim() || '',
        line: e.querySelector('.mbm-play-line')?.textContent.trim() || '', loadingAttr: e.hasAttribute('data-mbm-loading'),
        statusDisplay: e.querySelector('.mbm-play-status') ? getComputedStyle(e.querySelector('.mbm-play-status')).display : null,
        bg: getComputedStyle(e).backgroundImage.slice(0, 60), z: getComputedStyle(e).zIndex, legacyMark: !!e.querySelector('.mbm-splash-mark'),
      }));
    } catch (e) { fail(route, `${vp.width}px: region never attached (${e.message})`); await ctx.close(); continue; }
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${route.replace(/[^a-z0-9]+/gi, '_')}-${vp.width}.png`) }); }
    if (!facts.play) fail(route, `${vp.width}px: Play lockup not selected under ?brand=play`);
    if (facts.img !== MARK) fail(route, `${vp.width}px: lockup mark is not the inline accepted copy (${facts.img})`);
    if (!/^Made by Matt\s+Play$/.test(facts.word)) fail(route, `${vp.width}px: wordmark "${facts.word}"`);
    if (facts.line !== LINE) fail(route, `${vp.width}px: supporting line "${facts.line}"`);
    if (facts.legacyMark) fail(route, `${vp.width}px: the Made by Matt mark is stacked under the Play lockup`);
    if (facts.role !== 'dialog' || facts.modal !== 'true') fail(route, `${vp.width}px: dialog semantics ${facts.role}/${facts.modal}`);
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    const afterLoad = await el.evaluate(e => ({ loading: e.hasAttribute('data-mbm-loading'), status: e.querySelector('.mbm-play-status') ? getComputedStyle(e.querySelector('.mbm-play-status')).display : null })).catch(() => null);
    if (afterLoad && (afterLoad.loading || afterLoad.status !== 'none')) fail(route, `${vp.width}px: loading status still shown after load (${JSON.stringify(afterLoad)})`);
    const decoded = await el.evaluate(e => (e.querySelector('.mbm-play-lockup img')?.naturalWidth || 0) > 0).catch(() => false);
    if (!decoded) fail(route, `${vp.width}px: inline mark did not decode`);
    // Dismissal by tap writes the suppression key and removes the overlay.
    const stillThere = await el.count();
    if (stillThere) { await page.mouse.click(vp.width / 2, vp.height / 2); }
    await page.waitForFunction(() => !document.querySelector('#mbmSplash[data-mbm-maker-splash]'), null, { timeout: 5000 }).catch(() => fail(route, `${vp.width}px: overlay did not leave the tree after a tap`));
    const key = await page.evaluate(() => { try { return localStorage.getItem('mbm_splash_last'); } catch { return null; } });
    if (!key) fail(route, `${vp.width}px: suppression key not written after dismissal`);
    const active = await page.evaluate(() => ({ id: document.activeElement?.id || '', tag: document.activeElement?.tagName || '', inSplash: !!document.activeElement?.closest?.('[data-mbm-maker-splash]') }));
    if (active.inSplash) fail(route, `${vp.width}px: focus left inside the removed splash`);
    if (errors.length) fail(route, `${vp.width}px: page errors ${errors.join(' | ')}`);
    report.routes.push({ route, viewport: vp.width, facts, afterLoad, markDecoded: decoded, key, active, errors });
    await ctx.close();
    // Education branding control: the same route without ?brand=play paints the Made by Matt mark.
    const ctx2 = await browser.newContext({ viewport: vp }); const page2 = await ctx2.newPage();
    await page2.goto(origin + encodeURI(withQuery(route, 'splash=force')), { waitUntil: 'commit', timeout: 30000 });
    const el2 = page2.locator('#mbmSplash[data-mbm-maker-splash]');
    const eduFacts = await el2.waitFor({ state: 'attached', timeout: 5000 }).then(() => el2.evaluate(e => ({ play: e.hasAttribute('data-mbm-play'), mark: !!e.querySelector('.mbm-splash-mark strong'), label: e.getAttribute('aria-label') }))).catch(() => null);
    if (!eduFacts || eduFacts.play || !eduFacts.mark || eduFacts.label !== 'Made by Matt introduction') fail(route, `${vp.width}px: without ?brand=play the Made by Matt mark is not painted (${JSON.stringify(eduFacts)})`);
    await ctx2.close();
  }
}
await browser.close(); await new Promise(r => server.close(r));
fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.routes.length} route/viewport proofs, ${report.failures.length} failure(s); report ${REPORT}`);
process.exit(report.failures.length ? 1 : 0);
