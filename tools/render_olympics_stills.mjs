#!/usr/bin/env node
/* render_olympics_stills.mjs — deterministic offline stills from Global Games.
 *
 * Produces the og:image banner the head furniture points at, and candidate
 * thumbnails from real moments of play. Every frame is rendered from the game
 * itself on a VIRTUAL clock, so the same command produces the same pixels: no
 * "grab a screenshot when it looks nice", which is unrepeatable and quietly
 * different every time someone regenerates it.
 *
 * THE REAL-ASSET RULE is why this exists at all. The estate's other games point
 * og:image at a banner.png that is genuinely on disk; adding the meta tag
 * without the file would be a head that lies about itself to every crawler and
 * every share preview.
 *
 * Poster stills are capped at 500 KB by the estate's rule; this refuses to
 * write anything larger rather than shipping it and mentioning it later.
 *
 *   node tools/render_olympics_stills.mjs
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, 'olympics');
const MAX_BYTES = 500 * 1024;

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const CLOCK = `(() => {
  let now = 0; const step = 1000 / 60;
  performance.now = () => now;
  const queue = [];
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__drive = frames => {
    for (let i = 0; i < frames; i++) {
      now += step;
      const batch = queue.splice(0, queue.length);
      for (const cb of batch) { try { cb(now); } catch (e) {} }
    }
    return now;
  };
})();`;

/* THE BANNER IS A COMPOSED TITLE CARD, NOT A SCREENSHOT — and the first version
   of this tool got that wrong. It pointed a 1200x630 viewport at the game's
   title screen and wrote whatever came out, which was the HTML menu laid out
   for a taller window: the "Your local legacy" heading sliced off at the top,
   the stat text running off the right edge, and the buttons cut through the
   middle. It was 413 KB, it was named banner.png, and it was unusable. Only
   opening the file showed that, which is the whole argument for opening it.

   Looking at what the estate actually ships settled the shape: fracture's
   banner is a purpose-built card — wordmark, subtitle, feature pills, tagline —
   not a frame of play. So this composes one, offline and self-contained, from
   the game's own palette tokens and its own words.

   Thumbnails stay real frames at the game's native 16:9, because a thumbnail
   SHOULD be a moment from play. */
const SHOTS = [
  { name: 'thumb-ceremony.png', w: 1280, h: 720, scene: 'ceremony', why: 'candidate 1 — the medal ceremony podium' },
  { name: 'thumb-sprint.png', w: 1280, h: 720, scene: 'sprint', why: 'candidate 2 — the 100m under way' },
  { name: 'thumb-skijump.png', w: 1280, h: 720, scene: 'skiJump', why: 'candidate 3 — the ski jump in flight' }
];

/* Every string below is the game's own. "GLOBAL GAMES" and "CHAMPIONSHIP
   SIMULATOR" come from its <title>; the categories are the exact `category`
   values in its EVENT_META; the tagline is drawn from its meta description.
   Nothing is written fresh for the card. Three arcs rather than five rings,
   for the same reason the splash uses them. */
const BANNER_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#050816;
 font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#f7fbff;position:relative}
/* ONE gradient, not three stacked. The first composition layered two radials
   over a linear and came out at 528 KB — PNG stores smooth gradients poorly,
   and three overlapping ones is three times the dithering noise to encode. The
   tool refused to write it, which is what the 500 KB rule is for; the fix is
   fewer smooth surfaces rather than a quietly raised limit. */
.bg{position:absolute;inset:0;background:linear-gradient(155deg,#12294c,#050816 68%)}
.arcs{position:absolute;right:-40px;top:50%;transform:translateY(-50%);opacity:.42}
.stage{position:relative;padding:82px 76px}
.eyebrow{font-size:19px;letter-spacing:.42em;font-weight:800;color:#ffd75e;text-transform:uppercase}
h1{font-size:112px;line-height:.9;letter-spacing:.01em;font-weight:900;margin:18px 0 0;color:#ffffff}
h2{font-size:36px;letter-spacing:.24em;font-weight:800;color:#47e7ff;margin-top:14px;text-transform:uppercase}
.pills{display:flex;gap:11px;flex-wrap:wrap;margin-top:34px;max-width:820px}
.pill{border:1px solid rgba(150,220,255,.34);border-radius:99px;padding:9px 18px;
 font-size:16px;font-weight:700;color:#dbe9ff;background:rgba(10,16,35,.6)}
.tag{margin-top:30px;font-size:21px;color:#9fb0c7;font-weight:600}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;
 background:linear-gradient(90deg,#ff557f,#ffd75e,#62f2a2,#47e7ff,#bb8cff)}
</style></head><body>
<div class="bg"></div>
<svg class="arcs" width="560" height="560" viewBox="0 0 100 100">
 <circle cx="50" cy="50" r="46" fill="none" stroke="#47e7ff" stroke-width="1.6" opacity=".85"/>
 <circle cx="50" cy="50" r="37" fill="none" stroke="#ffd75e" stroke-width="1.6" opacity=".8"/>
 <circle cx="50" cy="50" r="28" fill="none" stroke="#bb8cff" stroke-width="1.6" opacity=".75"/>
</svg>
<div class="stage">
 <p class="eyebrow">Made by Matt</p>
 <h1>Global Games</h1>
 <h2>Championship Simulator</h2>
 <div class="pills">
  <span class="pill">Track</span><span class="pill">Field</span><span class="pill">Aquatics</span>
  <span class="pill">Precision</span><span class="pill">Ice</span><span class="pill">Strength</span>
  <span class="pill">Snow</span>
 </div>
 <p class="tag">Nine events · medals, records, fatigue and athlete development · one offline file</p>
</div>
<div class="bar"></div>
</body></html>`;

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const written = [];

const BANNER_ONLY = process.argv.includes('--banner-only');
for (const shot of (BANNER_ONLY ? [] : SHOTS)) {
  const ctx = await browser.newContext({ viewport: { width: shot.w, height: shot.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  await page.goto(base + '/olympics/index.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 20000 });
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__drive(8));
  await page.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });

  await page.evaluate(async (scene) => {
    const drive = window.__drive;
    const app = window.MBMGlobalGames.app;
    const skip = document.querySelector('.mbm-skip'); if (skip) skip.click();
    drive(80);
    if (scene === 'ambient') { drive(240); return; }   /* let the title scene settle into motion */
    document.getElementById('newGamesBtn').click(); drive(10);
    document.querySelector('[data-mode="ultimate"]').click(); drive(10);
    document.getElementById('autoAttrs').click(); drive(10);
    document.getElementById('beginTournament').click(); drive(20);
    if (scene === 'ceremony') {
      for (let d = 0; d < 9; d++) {
        document.getElementById('eventBriefing').click(); drive(12);
        document.getElementById('startEvent').click(); drive(12);
        window.__olympics.finishEvent(); drive(30);
        const rc = document.getElementById('resultContinue'); if (rc) { rc.click(); drive(12); }
        const sc = document.getElementById('standingsContinue'); if (sc) { sc.click(); drive(12); }
      }
      drive(90);
      return;
    }
    app.tournament.index = app.tournament.schedule.indexOf(scene);
    document.getElementById('eventBriefing').click(); drive(20);
    document.getElementById('startEvent').click(); drive(30);
    /* WAIT OUT THE STARTER BEFORE TOUCHING ANYTHING. The first version began
       tapping at frame 0, which is inside the 3.2s countdown, so the sprint
       still showed a perfectly good race with "FALSE START +0.40 s" burned
       across it. Poll for the gun rather than counting frames, because the
       countdown differs per engine. */
    for (let f = 0; f < 400 && !(app.activeEvent && app.activeEvent.started); f++) drive(1);
    drive(10);
    for (let f = 0; f < 420; f++) {
      if (f % 6 === 0) {
        const code = f % 12 === 0 ? 'KeyA' : 'KeyD';
        for (const type of ['keydown', 'keyup'])
          window.dispatchEvent(new KeyboardEvent(type, { code, key: code.slice(-1).toLowerCase(), bubbles: true }));
      }
      drive(1);
    }
  }, shot.scene);

  const buf = await page.screenshot({ type: 'png' });
  const dest = path.join(OUT, shot.name);
  if (buf.length > MAX_BYTES) {
    console.log(`REFUSED ${shot.name} — ${(buf.length / 1024).toFixed(0)} KB exceeds the ${MAX_BYTES / 1024} KB poster-still rule`);
  } else {
    fs.writeFileSync(dest, buf);
    written.push({ name: shot.name, bytes: buf.length, why: shot.why });
  }
  await ctx.close();
}

/* The composed banner, rendered from the template above rather than captured
   from the running game. */
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(BANNER_HTML, { waitUntil: 'load' });
  const buf = await page.screenshot({ type: 'png' });
  if (buf.length > MAX_BYTES) {
    console.log(`REFUSED banner.png — ${(buf.length / 1024).toFixed(0)} KB exceeds the ${MAX_BYTES / 1024} KB poster-still rule`);
  } else {
    fs.writeFileSync(path.join(OUT, 'banner.png'), buf);
    written.push({ name: 'banner.png', bytes: buf.length, why: 'og:image — composed title card' });
  }
  await ctx.close();
}

await browser.close();
srv.close();

console.log('Global Games — deterministic stills\n');
for (const w of written) console.log(`  ${w.name.padEnd(22)} ${String((w.bytes / 1024).toFixed(0)).padStart(4)} KB   ${w.why}`);
console.log(`\n${written.length}/${SHOTS.length} written to olympics/`);
process.exit(written.length === (BANNER_ONLY ? 1 : SHOTS.length + 1) ? 0 : 1);
