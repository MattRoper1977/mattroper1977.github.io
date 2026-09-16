#!/usr/bin/env node
/* PLAY-Q1 splash proof: the one generated region shows the Play lockup on the Play
 * host (or under ?brand=play) and the Made by Matt mark elsewhere.
 *
 *   node tools/verify_play_splash.mjs [--site-root=.] [--routes=/cyberpulse/,/voxel/] [--shots=dir]
 *
 * Serves the checkout on a local port. For each route and viewport it proves, in a
 * fresh context each time (storage empty, so the window is open without ?splash=force): the region
 * paints the Play lockup with the inline copy of the accepted mark (decoded while the lockup is
 * shown), the wordmark and the supporting line; the loading status shows while the document is
 * still loading and is hidden once it is complete; the overlay leaves the tree (a real tap is
 * sent; on a game whose inline scripts keep the main thread busy until load, the 2.1 s cap can
 * remove it first, and the timeline records which), the 24-hour suppression is written and focus
 * is not left in the splash; while the overlay is interactive nothing else is the top hit at the
 * viewport centre (a game overlay stacked above the region would hide the lockup); without ?brand=play the same route paints the Made by Matt mark
 * (Education branding). Facts are recorded inside the page by an init-script observer, because a
 * harness read can land after the cap on those busy routes.
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
// The games are single files with large inline scripts: on the heavier ones the main thread is
// busy from parse until load, so a harness read (locator.evaluate) can land after the 2.1 s cap has
// already removed the overlay. The facts are therefore recorded inside the page, synchronously, by
// an init-script observer at the moment the region attaches and at each later event, and the
// harness reads the recorded timeline once the page has settled.
const RECORDER = () => {
  const t0 = performance.now(); const tl = window.__mbmPlayProbe = { events: [], attach: null, decodedAt: null, detachAt: null, loadAt: null, afterLoad: null, topHit: null, topHitMisses: 0, topHitCover: null };
  const now = () => Math.round(performance.now() - t0);
  const snapshot = e => ({
    play: e.hasAttribute('data-mbm-play'), label: e.getAttribute('aria-label'), role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'),
    img: e.querySelector('.mbm-play-lockup img')?.getAttribute('src')?.slice(0, 23) || null, word: e.querySelector('.mbm-play-word')?.textContent.trim() || '',
    line: e.querySelector('.mbm-play-line')?.textContent.trim() || '', loadingAttr: e.hasAttribute('data-mbm-loading'), readyState: document.readyState,
    statusDisplay: e.querySelector('.mbm-play-status') ? getComputedStyle(e.querySelector('.mbm-play-status')).display : null,
    bg: getComputedStyle(e).backgroundImage.slice(0, 60), z: getComputedStyle(e).zIndex, legacyMark: !!e.querySelector('.mbm-splash-mark'), eduMark: !!e.querySelector('.mbm-splash-mark strong'),
  });
  // Top hit: while the overlay is interactive (not fading out), the element under the viewport
  // centre must belong to it; a game overlay stacked above the region hides the lockup and eats the tap.
  const poll = () => { const e = document.getElementById('mbmSplash'); if (!e) return; const i = e.querySelector('.mbm-play-lockup img'); if (i && i.naturalWidth > 0 && tl.decodedAt === null) tl.decodedAt = now();
    if (getComputedStyle(e).pointerEvents !== 'none' && e.getAttribute('aria-hidden') !== 'true') { const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2); const inside = !!(hit && hit.closest('#mbmSplash')); tl.topHit = inside; if (!inside) { tl.topHitMisses += 1; tl.topHitCover = hit ? (hit.id || hit.className || hit.tagName) + '' : 'nothing'; } } };
  new MutationObserver(ms => { for (const m of ms) { for (const n of m.addedNodes) if (n.id === 'mbmSplash' && !tl.attach) { tl.attach = { at: now(), ...snapshot(n) }; poll(); } for (const n of m.removedNodes) if (n.id === 'mbmSplash' && tl.detachAt === null) { poll(); tl.detachAt = now(); } } }).observe(document, { childList: true, subtree: true });
  setInterval(poll, 50);
  window.addEventListener('load', () => { tl.loadAt = now(); setTimeout(() => { const e = document.getElementById('mbmSplash'); tl.afterLoad = e ? { at: now(), loadingAttr: e.hasAttribute('data-mbm-loading'), statusDisplay: e.querySelector('.mbm-play-status') ? getComputedStyle(e.querySelector('.mbm-play-status')).display : null } : null; }, 0); });
};
for (const route of ROUTES) {
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'no-preference' });
    const page = await ctx.newPage(); await page.addInitScript(RECORDER);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + encodeURI(withQuery(route, 'brand=play')), { waitUntil: 'commit', timeout: 30000 });
    const el = page.locator('#mbmSplash[data-mbm-maker-splash]');
    const attached = await el.waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false);
    if (SHOTS && attached) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${route.replace(/[^a-z0-9]+/gi, '_')}-${vp.width}.png`) }).catch(() => {}); }
    // A real tap as soon as the harness sees the region; on a busy main thread the cap may win the race, and the timeline says which.
    const tapAt = Date.now(); if (attached) await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    const gone = await page.waitForFunction(() => !document.querySelector('#mbmSplash[data-mbm-maker-splash]') && window.__mbmPlayProbe && window.__mbmPlayProbe.detachAt !== null, null, { timeout: 8000 }).then(() => true).catch(() => false);
    const tl = await page.evaluate(() => window.__mbmPlayProbe).catch(() => null);
    if (!tl || !tl.attach) { fail(route, `${vp.width}px: region never attached (${attached ? 'harness saw it, the page recorder did not' : 'not within 10 s of commit'})`); await ctx.close(); continue; }
    const facts = tl.attach;
    if (!facts.play) fail(route, `${vp.width}px: Play lockup not selected under ?brand=play`);
    if (facts.img !== MARK) fail(route, `${vp.width}px: lockup mark is not the inline accepted copy (${facts.img})`);
    if (!/^Made by Matt\s+Play$/.test(facts.word)) fail(route, `${vp.width}px: wordmark "${facts.word}"`);
    if (facts.line !== LINE) fail(route, `${vp.width}px: supporting line "${facts.line}"`);
    if (facts.legacyMark) fail(route, `${vp.width}px: the Made by Matt mark is stacked under the Play lockup`);
    if (facts.role !== 'dialog' || facts.modal !== 'true') fail(route, `${vp.width}px: dialog semantics ${facts.role}/${facts.modal}`);
    if (facts.readyState !== 'complete' && (!facts.loadingAttr || facts.statusDisplay === 'none')) fail(route, `${vp.width}px: loading status not shown while the document was still loading (${JSON.stringify({ loadingAttr: facts.loadingAttr, statusDisplay: facts.statusDisplay })})`);
    if (tl.afterLoad && (tl.afterLoad.loadingAttr || tl.afterLoad.statusDisplay !== 'none')) fail(route, `${vp.width}px: loading status still shown after load (${JSON.stringify(tl.afterLoad)})`);
    if (tl.decodedAt === null || (tl.detachAt !== null && tl.decodedAt > tl.detachAt)) fail(route, `${vp.width}px: inline mark did not decode while the lockup was shown (decoded ${tl.decodedAt} ms, detached ${tl.detachAt} ms)`);
    if (!gone || tl.detachAt === null) fail(route, `${vp.width}px: overlay did not leave the tree (tap sent, cap 2.1 s)`);
    if (tl.topHit !== true || tl.topHitMisses > 0) fail(route, `${vp.width}px: something sat above the lockup at the viewport centre while it was shown (${tl.topHitMisses} sample(s); last cover ${JSON.stringify(tl.topHitCover)})`);
    const key = await page.evaluate(() => { try { return localStorage.getItem('mbm_splash_last'); } catch { return null; } });
    if (!key) fail(route, `${vp.width}px: suppression key not written after dismissal`);
    const active = await page.evaluate(() => ({ id: document.activeElement?.id || '', tag: document.activeElement?.tagName || '', inSplash: !!document.activeElement?.closest?.('[data-mbm-maker-splash]') }));
    if (active.inSplash) fail(route, `${vp.width}px: focus left inside the removed splash`);
    if (errors.length) fail(route, `${vp.width}px: page errors ${errors.join(' | ')}`);
    const dismissal = tl.detachAt !== null && tl.detachAt - tl.attach.at < 2000 ? 'tap' : 'cap-or-tap-after-cap';
    report.routes.push({ route, viewport: vp.width, facts, timeline: { attachAt: tl.attach.at, decodedAt: tl.decodedAt, loadAt: tl.loadAt, detachAt: tl.detachAt, afterLoad: tl.afterLoad, topHit: tl.topHit, topHitMisses: tl.topHitMisses }, dismissal, key, active, errors });
    await ctx.close();
    // Education branding control: the same route without ?brand=play paints the Made by Matt mark.
    const ctx2 = await browser.newContext({ viewport: vp }); const page2 = await ctx2.newPage(); await page2.addInitScript(RECORDER);
    await page2.goto(origin + encodeURI(withQuery(route, 'splash=force')), { waitUntil: 'commit', timeout: 30000 });
    await page2.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    const eduFacts = await page2.evaluate(() => window.__mbmPlayProbe && window.__mbmPlayProbe.attach).catch(() => null);
    if (!eduFacts || eduFacts.play || !eduFacts.eduMark || eduFacts.label !== 'Made by Matt introduction') fail(route, `${vp.width}px: without ?brand=play the Made by Matt mark is not painted (${JSON.stringify(eduFacts && { play: eduFacts.play, mark: eduFacts.eduMark, label: eduFacts.label })})`);
    await ctx2.close();
  }
}
await browser.close(); await new Promise(r => server.close(r));
fs.mkdirSync(path.dirname(REPORT), { recursive: true }); fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.routes.length} route/viewport proofs, ${report.failures.length} failure(s); report ${REPORT}`);
process.exit(report.failures.length ? 1 : 0);
