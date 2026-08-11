// Rally's nordic night rain, repeated. Its respawn and spawn jitter use
// unseeded Math.random(), so a single run is a sample, not a measurement --
// and this scene has read 2.0, 3.0, 3.2 and 3.4 Hz on the SAME build.
import { createRequire } from 'node:module';
import path from 'node:path';
import { analyse } from '/workspace/mattroper1977.github.io/tools/flicker_analyse.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const FPS = 60, ROOT = '/workspace/mattroper1977.github.io';
const CLOCK = `(() => { let now=0; const step=1000/${FPS}; performance.now=()=>now;
  const q=[]; window.requestAnimationFrame=cb=>{q.push(cb);return q.length};
  window.cancelAnimationFrame=()=>{};
  window.__drive=f=>{for(let i=0;i<f;i++){now+=step;const b=q.splice(0,q.length);for(const cb of b){try{cb(now)}catch(e){}}}return now};})();`;
const SAMPLER = `(() => { const c=document.querySelector('canvas#gl');
  const W=64,H=48,TX=4,TY=2; const off=document.createElement('canvas'); off.width=W; off.height=H;
  const g=off.getContext('2d',{willReadFrequently:true});
  window.__tiles=Array.from({length:8},()=>[]);
  window.__sample=()=>{try{g.clearRect(0,0,W,H);g.drawImage(c,0,0,W,H);
    const d=g.getImageData(0,0,W,H).data; const ts=new Float64Array(8), tc=new Float64Array(8);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
      const L=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
      const t=Math.floor(y/(H/TY))*TX+Math.floor(x/(W/TX)); ts[t]+=L; tc[t]++;}
    for(let t=0;t<8;t++)window.__tiles[t].push(ts[t]/tc[t]);}catch(e){}};})();`;
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const reduce = process.argv.includes('--reduce');
const rates = [], p2ps = [];
for (let n = 0; n < 5; n++) {
  const ctx = await b.newContext({ viewport:{width:640,height:480}, reducedMotion: reduce?'reduce':'no-preference' });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  await page.addInitScript(() => { try { localStorage.setItem('mbm_rallyvector_3d_v1',
    JSON.stringify({settings:{track:'nordic',weather:'rain',time:'night'}})); } catch(e){} });
  await page.goto('file://' + path.join(ROOT,'rallyvector3d','index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(()=>{try{window.__mbmSplashClose()}catch(e){}});
  await page.evaluate(()=>{const x=document.querySelector('#startBtn'); if(x)x.click();});
  await page.evaluate(f=>window.__drive(f), 180);
  await page.addScriptTag({ content: SAMPLER });
  await page.evaluate(()=>{for(let i=0;i<300;i++){window.__drive(1);window.__sample();}});
  const tiles = await page.evaluate(()=>window.__tiles);
  let worst=null; for(const tl of tiles){const r=analyse(tl,FPS); if(!worst||r.peakToPeak>worst.peakToPeak)worst=r;}
  rates.push(worst.peaksPerSec); p2ps.push(worst.peakToPeak);
  console.log(`  run ${n+1}: ${String(worst.peaksPerSec).padStart(5)} Hz   locus p2p ${worst.peakToPeak}`);
  await ctx.close();
}
const mx=Math.max(...rates), mn=Math.min(...rates);
console.log(`\n${reduce?'REDUCED':'FULL'}: rate ${mn}-${mx} Hz (ceiling 3), locus p2p ${Math.min(...p2ps)}-${Math.max(...p2ps)} (hazard floor 25.5)`);
console.log(mx>=3 ? '  STRADDLES OR EXCEEDS THE CEILING' : '  under the ceiling on every run');
await b.close();
