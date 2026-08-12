/* Which tile carries Neon Meridian's night swing, and what is in it.
 *
 * The rate was already isolated as SPATIAL: it scales with road speed
 * (26 u/s -> 7.6 Hz, 3.2 u/s -> 3.6 Hz, stopped -> 1.2 Hz) and is identical
 * with 160 rain drops or none. So the rate cannot be gated -- only the
 * AMPLITUDE can move, and amplitude is what the 25.5 hazard floor measures.
 *
 * Two contrast reductions were tried blind and both failed (night emissive cap
 * moved p2p 25.60 -> 25.71, inside noise; night ambient lift moved it the
 * wrong way to 26.9). This exists so the third attempt is aimed: it reports
 * EVERY tile rather than the max, and writes a frame so the tile can be looked
 * at rather than guessed about.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyse } from '../flicker_analyse.mjs';
// require(), not import: a bare ESM import does not honour NODE_PATH, which is
// how playwright is reachable here. measure_driving_flash.mjs does the same.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const FPS = 60;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'tools', 'driving-games');
const TX = 4, TY = 2;

const CLOCK = `(() => { let now=0; const step=1000/${FPS}; performance.now=()=>now;
  const q=[]; window.requestAnimationFrame=cb=>{q.push(cb);return q.length};
  window.cancelAnimationFrame=()=>{};
  window.__drive=f=>{for(let i=0;i<f;i++){now+=step;const b=q.splice(0,q.length);for(const cb of b){try{cb(now)}catch(e){}}}return now};})();`;

const SAMPLER = `(() => { const c=document.querySelector('canvas#gl');
  const W=64,H=48,TX=${TX},TY=${TY};
  const off=document.createElement('canvas'); off.width=W; off.height=H;
  const g=off.getContext('2d',{willReadFrequently:true});
  window.__tiles=Array.from({length:TX*TY},()=>[]);
  window.__sample=()=>{try{g.clearRect(0,0,W,H);g.drawImage(c,0,0,W,H);
    const d=g.getImageData(0,0,W,H).data; const ts=new Float64Array(TX*TY), tc=new Float64Array(TX*TY);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
      const L=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
      const t=Math.floor(y/(H/TY))*TX+Math.floor(x/(W/TX)); ts[t]+=L; tc[t]++;}
    for(let t=0;t<TX*TY;t++)window.__tiles[t].push(ts[t]/tc[t]);}catch(e){}};})();`;

const label = t => `${t < TX ? 'top' : 'bottom'}-${['far-left', 'left', 'right', 'far-right'][t % TX]}`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
const page = await ctx.newPage();
await page.addInitScript(CLOCK);
await page.goto('file://' + path.join(ROOT, 'neonmeridian', 'index.html'));
await page.waitForTimeout(500);
await page.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });
await page.evaluate(() => document.querySelector('#playBtn').click());
await page.evaluate(f => window.__drive(f), 120);
await page.evaluate(() => {
  window.__NM.set('tod', 'night'); window.__NM.set('weather', 'rain'); window.__NM.drive(true);
});
await page.evaluate(f => window.__drive(f), 240);
await page.addScriptTag({ content: SAMPLER });
await page.evaluate(() => { for (let i = 0; i < 300; i++) { window.__drive(1); window.__sample(); } });

const { tiles, st } = await page.evaluate(() => ({ tiles: window.__tiles, st: window.__NM.state() }));
console.log(`\nstate: ${JSON.stringify(st)}\n`);
console.log('tile               mean     p2p   peaks/s   worst-frame-swing');
let worst = { p2p: -1 };
tiles.forEach((tl, i) => {
  const r = analyse(tl, FPS);
  if (r.peakToPeak > worst.p2p) worst = { i, p2p: r.peakToPeak, hz: r.peaksPerSec };
  console.log(`${String(i).padStart(2)} ${label(i).padEnd(16)}${r.mean.toFixed(1).padStart(7)}` +
    `${String(r.peakToPeak).padStart(8)}${String(r.peaksPerSec).padStart(10)}${String(r.worstFrameSwing).padStart(18)}`);
});
console.log(`\nLOCUS = tile ${worst.i} (${label(worst.i)}), p2p ${worst.p2p}, ${worst.hz} Hz`);

// A frame to look at, so the next change is aimed at something seen.
const shot = path.join(OUT, 'night-locus-frame.png');
await page.screenshot({ path: shot });
console.log(`frame written: ${shot}`);
fs.writeFileSync(path.join(OUT, 'night-locus-tiles.json'),
  JSON.stringify({ state: st, locus: worst, tiles: tiles.map((tl, i) => ({ i, label: label(i), ...analyse(tl, FPS) })) }, null, 1));
await browser.close();
