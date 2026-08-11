// Isolate what actually oscillates at 7 Hz in Neon Meridian's night scene.
// The rain was ruled out by measurement (locus 27.078 with no rain, 27.1 with
// 109 drops). The two remaining candidates are distinguishable by ONE test:
// if the rate scales with road speed it is spatial -- geometry streaming past
// the camera -- and if it does not, it is a clock somewhere.
import { chromium } from 'playwright';
import path from 'node:path';
import { analyse } from '/workspace/mattroper1977.github.io/tools/flicker_analyse.mjs';

const FPS = 60, ROOT = '/workspace/mattroper1977.github.io';
const CLOCK = `(() => { let now=0; const step=1000/${FPS}; performance.now=()=>now;
  const q=[]; window.requestAnimationFrame=cb=>{q.push(cb);return q.length};
  window.cancelAnimationFrame=()=>{};
  window.__drive=f=>{for(let i=0;i<f;i++){now+=step;const b=q.splice(0,q.length);for(const cb of b){try{cb(now)}catch(e){}}}return now};})();`;
const SAMPLER = `(() => { const c=document.querySelector('canvas#gl');
  const W=64,H=48,TX=4,TY=2; const off=document.createElement('canvas'); off.width=W; off.height=H;
  const g=off.getContext('2d',{willReadFrequently:true});
  window.__tiles=Array.from({length:TX*TY},()=>[]);
  window.__sample=()=>{try{g.clearRect(0,0,W,H);g.drawImage(c,0,0,W,H);
    const d=g.getImageData(0,0,W,H).data; const ts=new Float64Array(TX*TY), tc=new Float64Array(TX*TY);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
      const L=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
      const t=Math.floor(y/(H/TY))*TX+Math.floor(x/(W/TX)); ts[t]+=L; tc[t]++;}
    for(let t=0;t<TX*TY;t++)window.__tiles[t].push(ts[t]/tc[t]);}catch(e){}};})();`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function run(label, tweak) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  await page.goto('file://' + path.join(ROOT, 'neonmeridian', 'index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });
  await page.evaluate(() => document.querySelector('#playBtn').click());
  await page.evaluate(f => window.__drive(f), 120);
  await page.evaluate(() => { window.__NM.set('tod', 'night'); window.__NM.set('weather', 'rain'); window.__NM.drive(true); });
  await page.evaluate(f => window.__drive(f), 240);      // reach cruising speed
  await page.evaluate(t => { eval(t); }, tweak);
  await page.addScriptTag({ content: SAMPLER });
  await page.evaluate(() => { for (let i = 0; i < 300; i++) { window.__drive(1); window.__sample(); } });
  const { tiles, st } = await page.evaluate(() => ({ tiles: window.__tiles, st: window.__NM.state() }));
  let best = null;
  for (const tl of tiles) { const r = analyse(tl, FPS); if (!best || r.peakToPeak > best.peakToPeak) best = r; }
  console.log(`${label.padEnd(34)} speed=${String(st.speed).padStart(6)} drops=${String(st.drops).padStart(4)}  ` +
    `locus ${String(best.peaksPerSec).padStart(5)} Hz  p2p ${best.peakToPeak}`);
  await ctx.close();
}

console.log('\nIs the night oscillation SPATIAL (scales with speed) or a CLOCK?\n');
await run('full speed (throttle held)', '');
await run('half speed (throttle released)', 'window.__NM.drive(false);');
await run('stopped (brake to rest)', 'window.__NM.drive(false); window.__NM.player.vx=0; window.__NM.player.vz=0; window.__NM.player.speed=0;');
await run('full speed, no rain', "window.__NM.set('weather','dry');");
await browser.close();
