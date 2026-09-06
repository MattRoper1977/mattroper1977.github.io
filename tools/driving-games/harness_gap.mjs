/* One bounded diagnosis pass: why do two harnesses disagree about Rally?
 *
 * The census read nordic night rain at 2.0, 3.0, 3.2 and 3.4 Hz on four
 * occasions. An isolated repeat harness read 1.8-2.6 Hz five times running, on
 * the same build. Four or five samples is far too thin for a number that
 * straddles the 3 Hz ceiling, so this takes ten of each and varies the one
 * structural difference between them.
 *
 * THE TWO STYLES
 *   census   one browser process, a fresh CONTEXT per scene. Rally's scenes
 *            run after four Neon Meridian scenes have already rendered in that
 *            same process, so swiftshader has been working hard for a while.
 *   isolated a fresh BROWSER PROCESS per run, nothing before it.
 *
 * If the gap is contention, isolated-per-process should read lower than
 * shared-process, consistently. If both spread the same way, it is just tail
 * variance and the answer is sample count, not architecture.
 *
 *   node tools/driving-games/harness_gap.mjs [--runs 10]
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse } from '../flicker_analyse.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const FPS = 60;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('runs', 10));

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

const LAUNCH = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

let worstState = null;
async function oneRun(browser, { preheat }) {
  // preheat: render Neon Meridian's night scene first in this same process, the
  // way the census does, so the "shared process" style is faithful to it.
  if (preheat) {
    const c0 = await browser.newContext({ viewport: { width: 640, height: 480 } });
    const p0 = await c0.newPage();
    await p0.addInitScript(CLOCK);
    p0.setDefaultNavigationTimeout(120000);
    await p0.goto('file://' + path.join(ROOT, 'neonmeridian', 'index.html'), { timeout: 120000 });
    await p0.waitForTimeout(400);
    await p0.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });
    await p0.evaluate(() => { const b = document.querySelector('#playBtn'); if (b) b.click(); });
    await p0.evaluate(() => {
      window.__NM.set('tod', 'night'); window.__NM.set('weather', 'rain'); window.__NM.drive(true);
    });
    await p0.evaluate(f => window.__drive(f), 300);
    await c0.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mbm_rallyvector_3d_v1',
        JSON.stringify({ settings: { track: 'nordic', weather: 'rain', time: 'night' } }));
    } catch (e) {}
  });
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  await page.goto('file://' + path.join(ROOT, 'rallyvector3d', 'index.html'), { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });
  await page.evaluate(() => { const b = document.querySelector('#startBtn'); if (b) b.click(); });
  await page.evaluate(f => window.__drive(f), 60);
  // Clicking start begins a 3.8s COUNTDOWN. Every Rally flash number taken
  // before this line measured a car standing still at the start line: the snow
  // still fell, so the frame moved and the vacuity guard passed, but the world
  // was not going past the camera. Skip the countdown and hold the throttle.
  await page.evaluate(() => { window.__RV.skipCountdown(); window.__RV.autopilot(true); });
  await page.evaluate(f => window.__drive(f), 420);
  const st = await page.evaluate(() => window.__RV.state());
  if (st.mode !== 'running' || st.speed < 15 || st.progress < 0.05) {
    throw new Error('Rally scene not actually driving: ' + JSON.stringify(st));
  }
  await page.addScriptTag({ content: SAMPLER });
  await page.evaluate(() => { for (let i = 0; i < 300; i++) { window.__drive(1); window.__sample(); } });
  const tiles = await page.evaluate(() => window.__tiles);
  worstState = st;
  let worst = null;
  for (const tl of tiles) { const r = analyse(tl, FPS); if (!worst || r.peakToPeak > worst.peakToPeak) worst = r; }
  await ctx.close();
  return worst;
}

const stat = a => {
  const s = [...a].sort((x, y) => x - y);
  return { min: s[0], max: s[s.length - 1], med: s[Math.floor(s.length / 2)],
    mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) };
};

async function style(name, { sharedProcess, preheat }) {
  const rates = [], p2ps = [];
  let browser = sharedProcess ? await chromium.launch(LAUNCH) : null;
  for (let i = 0; i < RUNS; i++) {
    const b = sharedProcess ? browser : await chromium.launch(LAUNCH);
    const r = await oneRun(b, { preheat: preheat && i === 0 });
    rates.push(r.peaksPerSec); p2ps.push(r.peakToPeak);
    process.stdout.write(`  ${name} run ${String(i + 1).padStart(2)}: ${String(r.peaksPerSec).padStart(5)} Hz  p2p ${r.peakToPeak}` +
      (i === 0 ? `   [${JSON.stringify(worstState)}]` : '') + `\n`);
    if (!sharedProcess) await b.close();
  }
  if (browser) await browser.close();
  const R = stat(rates), P = stat(p2ps);
  console.log(`  => ${name}: rate min ${R.min} med ${R.med} max ${R.max} mean ${R.mean} | p2p ${P.min}-${P.max}`);
  console.log(`     runs at or over 3 Hz: ${rates.filter(x => x >= 3).length}/${RUNS}\n`);
  return { rates, p2ps };
}

console.log(`\nRally nordic night rain — ${RUNS} runs per style, unchanged build\n`);
const a = await style('shared-process+preheat', { sharedProcess: true, preheat: true });
const b = await style('fresh-process        ', { sharedProcess: false, preheat: false });

const all = [...a.rates, ...b.rates];
console.log(`WORST ACROSS BOTH HARNESSES (${all.length} runs): ${Math.max(...all)} Hz`);
console.log(`at or over 3 Hz: ${all.filter(x => x >= 3).length}/${all.length}`);
