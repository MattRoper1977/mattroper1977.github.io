#!/usr/bin/env node
/* measure_driving_flash.mjs — the photosensitivity census for the two driving
 * games, /neonmeridian/ and /rallyvector3d/.
 *
 * The analyser is the estate's shared one (tools/flicker_analyse.mjs, the same
 * code behind Lumina Haven's hearth and Global Games), so these numbers are
 * directly comparable with the rest of the estate's. Nothing about the method
 * is re-invented here; the two floors and the 3 Hz ceiling are taken verbatim
 * from tools/measure_olympics_flash.mjs.
 *
 * WHAT THE WORST CASE ACTUALLY IS, WHICH IS NOT WHAT WAS EXPECTED
 *
 * The commission named "Neon Meridian ROAD HEAT + weather" and "Rally
 * lightning/weather". Reading the two games first changed both:
 *
 *   ROAD HEAT is a HUD METER — a gradient bar with a width transition. It is
 *   not a screen effect and cannot flash anything. What the heat system DOES
 *   do is spawn pursuit cars, and those carry the only strobe in either game:
 *
 *       c.strobe += dt * 13
 *       flash = Math.sin(c.strobe) > 0 ? [.12,.40,1.0] : [1.0,.08,.08]
 *
 *   a square-wave alternation between blue and red at 13 rad/s, i.e. one full
 *   red-blue-red cycle every 2*pi/13 = 0.483 s, or 2.07 Hz. Under the flash
 *   guidance this estate's 3 Hz rule comes from, a flash is a PAIR of opposing
 *   changes, so the cycle rate is the flash rate: 2.07 Hz, not the 4.14 Hz you
 *   get by counting each transition separately. Both numbers are printed below
 *   so the reader can see which is which.
 *
 *   RALLY HAS NO LIGHTNING. Zero occurrences in the file; the only "flash" in
 *   it is a livery called Forest Flash. Its weather is clear / rain / storm,
 *   where storm is blowing dust, and none of the three strobes. That is a
 *   finding, not an omission -- the census still runs on all three so the
 *   claim is measured rather than asserted from a grep.
 *
 * The pursuit strobe is measured with cops FORCED ON at full heat, because a
 * census that measures the state the player is usually in is not a census of
 * the worst case.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse, selfTest } from './flicker_analyse.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_DIR || path.join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS = Number(arg('seconds', 6));
const FPS = 60;
const CEILING_HZ = 3;
// Both floors are the estate's, unchanged. See measure_olympics_flash.mjs for
// the derivation: 2.0 units is the gap between "did not move" and "moved",
// 25.5 units is the 10%-of-maximum a flash guideline actually concerns itself
// with. A scene fails only when it clears BOTH the hazard floor and the rate.
const AMPLITUDE_FLOOR = 2.0;
const HAZARD_FLOOR = 25.5;

/* A rate-measuring tool that has never recovered a rate it already knows is an
 * opinion generator. This runs before any number below is quoted. */
const { bad, lines } = selfTest(FPS);
for (const l of lines) console.log(l);
if (bad) { console.error('\nanalyser self-test FAILED — no number from this run is trustworthy'); process.exit(1); }

/* Deterministic virtual clock. Headless software rendering manages 6-12fps in
 * this container, which samples a 3 Hz waveform about twice a cycle -- too
 * coarse to measure a rate and coarse enough to invent one. */
const CLOCK = `(() => {
  let now = 0; const step = 1000 / ${FPS};
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

/* Whole-canvas mean luminance, one sample per virtual frame. A hand-picked
 * region is how a flicker measurement gets a confident green from a corner
 * where nothing was ever going to move. Known limitation, stated rather than
 * discovered later: a mean over the whole frame DILUTES a bright strobe
 * confined to part of it -- a cop light occupying a twentieth of the screen
 * moves this mean by about a twentieth of its own amplitude. So the pursuit
 * scene below also reports a LOCUS figure: the highest-variance 1/8 tile of
 * the frame, measured separately, which is where that dilution is answered. */
const SAMPLER = `(() => {
  const c = document.querySelector('canvas#gl, canvas');
  const W = 64, H = 48, TX = 4, TY = 2;
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true });
  window.__series = [];
  window.__tiles = Array.from({ length: TX * TY }, () => []);
  window.__sample = () => {
    try {
      g.clearRect(0, 0, W, H); g.drawImage(c, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      let sum = 0; const tsum = new Float64Array(TX * TY); const tcnt = new Float64Array(TX * TY);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sum += L;
        const t = Math.floor(y / (H / TY)) * TX + Math.floor(x / (W / TX));
        tsum[t] += L; tcnt[t]++;
      }
      window.__series.push(sum / (W * H));
      for (let t = 0; t < TX * TY; t++) window.__tiles[t].push(tsum[t] / tcnt[t]);
    } catch (e) {}
  };
})();`;

const SCENES = [
  // Neon Meridian drives through its test seam. Setting these as bare
  // expressions did NOT work and did not say so: the game's state lives in
  // script-scoped consts, so every line threw ReferenceError into a swallowed
  // catch and all six scenes silently measured a parked car in daylight.
  { game: 'neonmeridian', name: 'pursuit strobe, driving', worst: true,
    setup: `window.__NM.heat(100); window.__NM.drive(true);`,
    expect: s => s.cops === 3 && s.speed > 1 },
  { game: 'neonmeridian', name: 'night + rain, driving',
    setup: `window.__NM.set('tod','night'); window.__NM.set('weather','rain'); window.__NM.drive(true);`,
    expect: s => s.tod === 'night' && s.rain > 0.9 && s.drops > 10 && s.speed > 1 },
  { game: 'neonmeridian', name: 'pursuit + night + rain, driving', worst: true,
    setup: `window.__NM.set('tod','night'); window.__NM.set('weather','rain'); window.__NM.heat(100); window.__NM.drive(true);`,
    expect: s => s.tod === 'night' && s.rain > 0.9 && s.drops > 10 && s.cops === 3 && s.speed > 1 },
  { game: 'neonmeridian', name: 'parked, daylight (vacuity control)',
    setup: `window.__NM.drive(false);`, expectStill: true,
    expect: s => s.speed < 3 },
  // Rally is seeded through its save, which it reads from localStorage at boot,
  // so no seam is needed. Its weather is clear / rain / storm-dust; it has NO
  // lightning and nothing in it strobes, which the numbers below either
  // confirm or refute.
  { game: 'rallyvector3d', name: 'desert storm (dust)', seed: { track: 'desert', weather: 'storm', time: 'dusk' } },
  { game: 'rallyvector3d', name: 'nordic night rain', seed: { track: 'nordic', weather: 'rain', time: 'night' } },
  { game: 'rallyvector3d', name: 'alpine clear (control)', seed: { track: 'alpine', weather: 'clear', time: 'day' } },
];

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function measure(scene, reduce) {
  const ctx = await browser.newContext({
    viewport: { width: 640, height: 480 },
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  if (scene.seed) {
    await page.addInitScript(s => {
      try {
        localStorage.setItem('mbm_rallyvector_3d_v1', JSON.stringify({ settings: s }));
      } catch (e) {}
    }, scene.seed);
  }
  await page.goto('file://' + path.join(ROOT, scene.game, 'index.html'));
  await page.waitForTimeout(600);
  await page.evaluate(() => { try { window.__mbmSplashClose && window.__mbmSplashClose(); } catch (e) {} });
  await page.evaluate(() => { const b = document.querySelector('#playBtn, #startBtn'); if (b) b.click(); });
  await page.evaluate(f => window.__drive(f), 120);          // let the scene settle
  if (scene.setup) {
    const err = await page.evaluate(s => { try { eval(s); return null; } catch (e) { return String(e); } }, scene.setup);
    // A setup that throws must never be swallowed: that is exactly how the
    // first run of this census reported six identical, static scenes as if
    // they were measurements.
    if (err) { console.error(`SETUP FAILED for "${scene.name}": ${err}`); process.exitCode = 1; }
  }
  await page.evaluate(f => window.__drive(f), 60);
  // Rally: clicking start begins a 3.8s countdown, and every Rally number in
  // the earlier tables was taken with the car STILL SITTING AT THE LINE.
  if (scene.game === 'rallyvector3d') {
    const rst = await page.evaluate(() => {
      if (!window.__RV) return null;
      window.__RV.skipCountdown(); window.__RV.autopilot(true); return window.__RV.state();
    });
    await page.evaluate(f => window.__drive(f), 420);
    const after = await page.evaluate(() => (window.__RV ? window.__RV.state() : null));
    if (!after || after.mode !== 'running' || after.speed < 15 || after.progress < 0.05) {
      console.error(`SCENE NOT DRIVING for "${scene.name}": ${JSON.stringify(after || rst)}`);
      process.exitCode = 1;
    } else if (!reduce) {
      console.log(`  state  ${scene.name}: ${JSON.stringify(after)}`);
    }
  }
  await page.addScriptTag({ content: SAMPLER });

  /* THE SCENE-STATE ASSERTION.
     The vacuity guard asks "did the frame move". It does NOT ask "is this the
     scene I asked for", and that gap hid a real error: WeatherSystem captures
     its override once at construction, so setting setting.weather afterwards
     changed nothing and the "night + rain" scenes measured night driving with
     no rain at all -- moving, non-vacuous, and the wrong measurement. */
  if (scene.expect) {
    const st = await page.evaluate(() => (window.__NM ? window.__NM.state() : null));
    if (!st || !scene.expect(st)) {
      console.error(`SCENE STATE WRONG for "${scene.name}": ${JSON.stringify(st)}`);
      process.exitCode = 1;
    } else if (!reduce) {
      console.log(`  state  ${scene.name}: ${JSON.stringify(st)}`);
    }
  }

  const frames = Math.round(SECONDS * FPS);
  await page.evaluate(n => {
    for (let i = 0; i < n; i++) { window.__drive(1); window.__sample(); }
  }, frames);

  const { series, tiles } = await page.evaluate(() => ({ series: window.__series, tiles: window.__tiles }));
  await ctx.close();

  const whole = analyse(series, FPS);
  // The worst single tile, which is where a small bright strobe actually lives.
  let locus = null;
  for (const tl of tiles) {
    const r = analyse(tl, FPS);
    if (!locus || r.peakToPeak > locus.peakToPeak) locus = r;
  }
  return { whole, locus };
}

console.log(`\nDriving games — flash census · ${SECONDS}s per scene at a virtual ${FPS}fps`);
console.log(`ceiling ${CEILING_HZ} Hz · meaningful floor ${AMPLITUDE_FLOOR} units · hazard floor ${HAZARD_FLOOR} units (10% of 0-255)\n`);
console.log('game            scene                             motion   peaks/s   p2p(whole)   p2p(locus)  locus Hz  verdict');

let worstHz = 0, failures = 0, vacuous = 0;
for (const s of SCENES) {
  const rows = {};
  for (const reduce of [false, true]) {
    const { whole, locus } = await measure(s, reduce);
    rows[reduce ? 'reduced' : 'full'] = { whole, locus };
    const meaningful = whole.peakToPeak >= AMPLITUDE_FLOOR || locus.peakToPeak >= AMPLITUDE_FLOOR;
    const hazardous = locus.peakToPeak >= HAZARD_FLOOR;
    const rate = Math.max(whole.peaksPerSec, locus.peaksPerSec);
    const verdict = !meaningful ? 'below noise floor, no verdict'
      : hazardous && rate >= CEILING_HZ ? 'OVER CEILING'
        : hazardous ? 'large swing but under 3 Hz'
          : 'modulates below the 10% hazard floor';
    if (meaningful && !reduce) worstHz = Math.max(worstHz, rate);
    if (hazardous && rate >= CEILING_HZ) failures++;
    console.log(
      `${s.game.padEnd(15)} ${s.name.padEnd(36)} ${(reduce ? 'reduced' : 'full').padEnd(8)}` +
      `${String(rate).padStart(8)}  ${String(whole.peakToPeak).padStart(11)}  ` +
      `${String(locus.peakToPeak).padStart(11)}  ${String(locus.peaksPerSec).padStart(8)}  ${verdict}`);
  }

  /* THE VACUITY GUARD.
     "No flash detected" is only reassuring if the scene MOVED. The first run
     of this census reported six scenes as calm; every one of them was a parked
     car in a static frame, because the setup lines had silently thrown. A
     still frame is not evidence of safety, so a scene that was supposed to
     move and did not is an INCONCLUSIVE, counted and reported, not a pass. */
  if (!s.expectStill) {
    const f = rows.full;
    const moved = f.whole.peakToPeak >= AMPLITUDE_FLOOR || f.locus.peakToPeak >= AMPLITUDE_FLOOR;
    if (!moved) {
      vacuous++;
      console.log(`${''.padEnd(15)} ${'^ INCONCLUSIVE: full-motion pass never moved'.padEnd(36)}` +
        `         (p2p whole ${f.whole.peakToPeak}, locus ${f.locus.peakToPeak}) — measures nothing`);
    }
  }
}

await browser.close();
console.log(`\nworst rate among scenes above the noise floor: ${worstHz} Hz (ceiling ${CEILING_HZ} Hz)`);
console.log(failures ? `${failures} scene(s) OVER CEILING` : 'no scene clears both the hazard floor and the rate ceiling');
if (vacuous) console.log(`${vacuous} scene(s) INCONCLUSIVE — the full-motion pass did not move, so their calm proves nothing`);
process.exit(failures || vacuous ? 1 : 0);
