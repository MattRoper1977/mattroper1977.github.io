/* render_trailer.mjs — deterministic offline render of the showcase route.
 *
 * Route B from probe_capture.mjs, run for real. requestAnimationFrame is driven
 * by hand at exactly 1/60s per frame and performance.now() is replaced with that
 * clock, so every captured frame is a TRUE 60fps frame no matter how long the
 * software rasteriser takes to paint it. Capture is slow (~1s/frame); the
 * result is not.
 *
 * Frames land in FRAMES_DIR as zero-padded jpegs, written incrementally so a
 * partial render is still usable and honest.
 *
 *   node tools/render_trailer.mjs [--frames 3600] [--out /tmp/fxframes]
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const TOTAL = Number(arg('--frames', 3600));
const OUT = arg('--out', '/tmp/fxframes');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = await new Promise(r => {
  const s = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? '/index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => r(s));
});
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 40000 });

/* Class select through the real UI, so the capture shows the real flow. */
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card', { state: 'visible' });
await page.evaluate(() => {
  document.querySelectorAll('#class-choice-grid .choice-card')[0].click();   /* Forgeguard */
  document.querySelectorAll('#path-choice-grid .choice-card')[1].click();    /* Grow */
});
await page.click('#begin-adventure-button');
await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 40000 });

/* Take the clock. From here the page only advances when we say so. */
await page.evaluate(() => {
  let t = performance.now();
  const step = 1000 / 60;
  const cbs = [];
  window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
  window.performance.now = () => t;
  window.__step = () => { t += step; const due = cbs.splice(0, cbs.length); due.forEach(cb => cb(t)); };
  window.__hold = code => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  window.__release = code => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
});

/* The showcase route, expressed as beats over the frame timeline. Each beat is
   a fraction of TOTAL so the same script works for a short test render and the
   full master. */
const beats = [
  { at: 0.00, name: 'Ironwood Verge — move out', run: async () => { await page.evaluate(() => { window.loadZone(0); window.__hold('KeyW'); }); } },
  { at: 0.09, name: 'first exchange', run: async () => { await page.evaluate(() => { window.__release('KeyW'); }); } },
  { at: 0.17, name: 'push on', run: async () => { await page.evaluate(() => { window.__hold('KeyW'); }); } },
  { at: 0.25, name: 'the forge', run: async () => { await page.evaluate(() => { window.__release('KeyW'); try { window.openModal('forge-panel', 'playing', true); } catch (_) {} }); } },
  { at: 0.32, name: 'back to it', run: async () => { await page.evaluate(() => { try { window.closeModal('playing'); } catch (_) {} window.__hold('KeyW'); }); } },
  { at: 0.38, name: 'The Glitchworks', run: async () => { await page.evaluate(() => { window.loadZone(1); window.__hold('KeyW'); }); } },
  { at: 0.50, name: 'pylon ground', run: async () => { await page.evaluate(() => { window.__release('KeyW'); }); } },
  { at: 0.58, name: 'traverse', run: async () => { await page.evaluate(() => { window.__hold('KeyW'); }); } },
  { at: 0.66, name: 'Celestial Foundry', run: async () => { await page.evaluate(() => { window.loadZone(2); window.__hold('KeyW'); }); } },
  { at: 0.78, name: 'the Nullsmith', run: async () => { await page.evaluate(() => { window.__release('KeyW'); }); } },
  { at: 0.92, name: 'Chronicle', run: async () => { await page.evaluate(() => { try { window.showVictory(); } catch (_) {} }); } }
];

let nextBeat = 0;
const t0 = Date.now();
let blanks = 0;
for (let i = 0; i < TOTAL; i++) {
  const p = i / TOTAL;
  while (nextBeat < beats.length && p >= beats[nextBeat].at) {
    const b = beats[nextBeat++];
    try { await b.run(); } catch (e) { console.log(`  beat "${b.name}" failed: ${String(e).slice(0, 90)}`); }
    console.log(`frame ${i}  beat: ${b.name}`);
  }
  /* An attack every 24 frames while in play keeps combat alive on screen, and
     dying is recovered from the way a player would — by pressing Rekindle at
     Forge. Without this the first death leaves a static modal up for the rest
     of the render, which is exactly what inspecting the final encode caught. */
  if (i % 24 === 0) {
    await page.evaluate(() => {
      try {
        const snap = window.__fracture.snapshot();
        if (snap.mode === 'playing') { window.triggerAttack && window.triggerAttack(); return; }
        const panel = document.getElementById('gameover-panel');
        const dead = panel && !panel.classList.contains('hidden') && panel.getBoundingClientRect().height > 0;
        if (dead || snap.mode === 'dead') {
          const btn = document.querySelector('#gameover-panel .ui-btn.primary') || document.querySelector('#gameover-panel button');
          if (btn) btn.click();
        }
      } catch (_) {}
    });
  }
  await page.evaluate(() => window.__step());
  const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
  if (buf.length < 12000) blanks++;
  fs.writeFileSync(path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`), buf);
  if (i % 120 === 0 && i > 0) {
    const rate = (Date.now() - t0) / i;
    console.log(`  ${i}/${TOTAL} frames · ${rate.toFixed(0)} ms/frame · eta ${(((TOTAL - i) * rate) / 60000).toFixed(1)} min · blanks ${blanks}`);
  }
}
console.log(`DONE ${TOTAL} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min · ${blanks} suspiciously blank`);
await browser.close();
server.close();
