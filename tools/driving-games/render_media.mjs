/* Card art, folder banner and thumbnails for the two driving games.
 *
 * THE ART IS THE GAME, NOT A DRAWING OF IT
 * Every image here is composited from a REAL frame captured out of the running
 * game, driven into a chosen state through its own test seam. Nothing is
 * illustrated and nothing is described that the game does not do, which is the
 * same rule the copy is held to.
 *
 * SIZE COMES FROM THE SHELF, NOT FROM MEMORY
 * The commission said 1200x630. The two most recent launches on the live shelf
 * -- nova-siege.webp and ouroboros.webp -- are 640x360 webp, and the shelf is
 * the thing that has to render these. Derive, do not pin: 640x360 it is, with
 * the banner at 1200x400 for the folder page.
 *
 * NON-BLANKNESS BY PIXEL STATISTICS
 * A render log saying "wrote 640x360" is not evidence the image has anything in
 * it. Every output is measured before it is kept: distinct quantised colours
 * across the frame, and the share of pixels above black. An image that fails
 * either is not written.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CARDS = path.join(ROOT, 'assets', 'cards');

const SHOTS = {
  neonmeridian: [
    { id: 'card', w: 640, h: 360, setup: `__NM.set('tod','night');__NM.drive(true);`, warm: 300 },
    { id: 'banner', w: 1200, h: 400, setup: `__NM.set('tod','night');__NM.drive(true);`, warm: 320 },
    { id: 'thumb-1', w: 480, h: 270, setup: `__NM.set('tod','sunset');__NM.drive(true);`, warm: 180 },
    { id: 'thumb-2', w: 480, h: 270, setup: `__NM.set('tod','night');__NM.set('weather','rain');__NM.drive(true);`, warm: 300 },
    { id: 'thumb-3', w: 480, h: 270, setup: `__NM.heat(100);__NM.drive(true);`, warm: 340 },
  ],
  rallyvector3d: [
    { id: 'card', w: 640, h: 360, track: 'alpine', warm: 520 },
    { id: 'banner', w: 1200, h: 400, track: 'canyon', warm: 620 },
    { id: 'thumb-1', w: 480, h: 270, track: 'coastal', warm: 480 },
    { id: 'thumb-2', w: 480, h: 270, track: 'nordic', warm: 560 },
    { id: 'thumb-3', w: 480, h: 270, track: 'timber', warm: 500 },
  ],
};

const CLOCK = `(() => { let now=0; const step=1000/60; performance.now=()=>now;
  const q=[]; window.requestAnimationFrame=cb=>{q.push(cb);return q.length};
  window.cancelAnimationFrame=()=>{};
  window.__drive=f=>{for(let i=0;i<f;i++){now+=step;const b=q.splice(0,q.length);for(const cb of b){try{cb(now)}catch(e){}}}return now};})();`;

/* Grab the live drawing buffer INSIDE a frame. Rally takes its context with
 * preserveDrawingBuffer:false, so a read from outside a frame returns an
 * already-cleared buffer -- the artifact that once produced seven false
 * findings in the flash census. */
/* Grab the live drawing buffer INSIDE a frame.
 *
 * Rally takes its context with preserveDrawingBuffer:false, so a read from
 * outside a frame returns an already-cleared buffer -- the artifact that once
 * produced seven false findings in the flash census. So the capture has to run
 * as a rAF callback, registered after the game's, in the same frame.
 *
 * But rAF here is the VIRTUAL CLOCK's queue, not the browser's: a callback
 * only runs when __drive() pumps it. An earlier version of this file awaited a
 * promise that resolved inside requestAnimationFrame and therefore never
 * resolved at all -- the render sat for twenty minutes writing nothing. So the
 * request and the read are separate, with a __drive(1) between them.
 */
const GRAB = `(() => {
  window.__grabResult = null;
  window.__grabRequest = (w,h) => {
    window.__grabResult = null;
    requestAnimationFrame(() => {
      const c = document.querySelector('canvas#gl, canvas');
      const off = document.createElement('canvas'); off.width=w; off.height=h;
      const g = off.getContext('2d');
      try { g.drawImage(c, 0, 0, w, h); } catch (e) { window.__grabResult = {err:String(e)}; return; }
      const d = g.getImageData(0,0,w,h).data;
      const seen = new Set(); let lit = 0;
      for (let i=0;i<d.length;i+=4){
        seen.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4));
        if (d[i]+d[i+1]+d[i+2] > 30) lit++;
      }
      window.__grabResult = { data: off.toDataURL('image/webp', 0.92),
        distinct: seen.size, litShare: +(lit/(w*h)).toFixed(3) };
    });
  };
})();`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const written = [];

const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only')+1] : null;
for (const [game, shots] of Object.entries(SHOTS)) {
  for (const s of shots) {
    if (ONLY && `${game}/${s.id}` !== ONLY) continue;
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.addInitScript(CLOCK);
    if (s.track) {
      await page.addInitScript(t => {
        try { localStorage.setItem('mbm_rallyvector_3d_v1',
          JSON.stringify({ settings: { track: t } })); } catch (e) {}
      }, s.track);
    }
    page.setDefaultNavigationTimeout(120000);
    await page.goto('file://' + path.join(ROOT, game, 'index.html'), { timeout: 120000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });
    await page.evaluate(() => { const b = document.querySelector('#playBtn, #startBtn'); if (b) b.click(); });
    await page.evaluate(f => window.__drive(f), 90);
    if (game === 'rallyvector3d') {
      await page.evaluate(() => { window.__RV.skipCountdown(); window.__RV.autopilot(true); });
    } else {
      await page.evaluate(x => { try { eval(x); } catch (e) {} }, s.setup);
    }
    await page.evaluate(f => window.__drive(f), s.warm);

    // Hide the HUD and the platform exit control: this is a picture of the
    // world, not a screenshot of an interface.
    await page.evaluate(() => {
      for (const sel of ['#hud','#topbar','#speedPanel','#minimapWrap','#touch','#controlsHint',
                         '#mbmexit-back','#mbmexit-home','#topActions','#statusInfo','#pacenote',
                         '#countdown','#touchControls','#selftest']) {
        document.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; });
      }
    });
    await page.evaluate(f => window.__drive(f), 4);

    await page.addScriptTag({ content: GRAB });
    await page.evaluate(([w, h]) => window.__grabRequest(w, h), [s.w, s.h]);
    await page.evaluate(f => window.__drive(f), 1);   // pump the queued capture
    const got = await page.evaluate(() => window.__grabResult);
    const label = `${game}/${s.id}`;
    if (!got) { console.log(`  FAIL  ${label}: grab returned nothing`); failed++; await ctx.close(); continue; }
    // The bar: a real frame has many colours and is mostly not black.
    const ok = got.distinct >= 24 && got.litShare >= 0.55;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  ${s.w}x${s.h}  distinct=${got.distinct} lit=${got.litShare}`);
    if (!ok) { failed++; await ctx.close(); continue; }

    const slug = game === 'neonmeridian' ? 'neon-meridian' : 'rally-vector-3d';
    const dest = s.id === 'card'
      ? path.join(CARDS, `${slug}.webp`)
      : path.join(ROOT, game, s.id === 'banner' ? 'banner.webp' : `${s.id}.webp`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(got.data.split(',')[1], 'base64'));
    written.push([path.relative(ROOT, dest), got.distinct, got.litShare]);
    await ctx.close();
  }
}
await browser.close();

console.log('\nwritten:');
for (const [p, d, l] of written) console.log(`  ${p.padEnd(44)} distinct=${d} lit=${l}`);
console.log(failed ? `\n${failed} FAILED` : '\nall images pass non-blankness');
process.exit(failed ? 1 : 0);
