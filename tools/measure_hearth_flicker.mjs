/* measure_hearth_flicker.mjs — the flicker instrument for Lumina Haven's hearth.
 *
 * Matt's verdict was a FEEL finding: the hearth "isn't quite a fireplace". That
 * is not a strobe complaint, and this tool exists so the re-authoring can be
 * argued with numbers rather than adjectives — and so the photosensitivity
 * ceiling is checked rather than assumed on the way past.
 *
 * ONE INSTRUMENT, RUN ON BOTH BUILDS. The before and after figures in the PR
 * come from this same file, so they are comparable. A number measured one way
 * for the old build and another way for the new one would prove nothing.
 *
 * Method:
 *   - place a Tiny Hearth, select the Hearth palette, dismiss the splash
 *   - drive a DETERMINISTIC virtual clock at exactly 60fps (never the display:
 *     headless software rendering runs this at 6-12fps, so real frames would
 *     sample the waveform far too coarsely to measure its rate)
 *   - capture a downsampled greyscale frame per tick
 *   - find the flicker LOCUS automatically as the high-variance region, rather
 *     than trusting a hand-typed box that could miss the thing being measured
 *   - report, for both the locus and the whole canvas:
 *       peaks/sec   local maxima of the mean-removed signal, the rate a
 *                   photosensitivity limit is stated against
 *       zero-x/sec  zero crossings / 2, an independent read of the same rate
 *       worst swing largest luminance change between CONSECUTIVE frames
 *       peak-to-peak
 *
 * A rate is only meaningful if the signal actually moved, so a non-vacuity
 * check runs first and the report says so when it fails.
 *
 *   node tools/measure_hearth_flicker.mjs [--file luminahaven/index.html]
 *                                         [--seconds 8] [--label before]
 *                                         [--frames out/dir] [--rm]
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse as rawAnalyse, selfTest } from './flicker_analyse.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_DIR || path.join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const FILE = arg('file', 'luminahaven/index.html');
const SECONDS = Number(arg('seconds', 8));
const LABEL = arg('label', path.basename(path.dirname(FILE)) || 'build');
const FRAMES_DIR = arg('frames', null);
const RM = process.argv.includes('--rm');
const FPS = 60;
/* HARD LIMIT, learned the hard way. The game spawns a new forage node at a
   RANDOM position once its spawn clock passes 10 seconds of sim time. The two
   differencing passes then diverge on something that has nothing to do with the
   hearth, and the measurement falls apart: a 10s run reported the unchanged
   build at 1.3 peaks/sec and a worst frame swing of 64, against 2.5 and 23 for
   the same build at 6s. Settle + run must stay inside that window. */
const SETTLE = 2;
if (SECONDS + SETTLE >= 10) {
  console.error(`REFUSING: settle ${SETTLE}s + run ${SECONDS}s reaches the game's 10s forage respawn, ` +
    `which fires at a random position and desynchronises the two passes. Use --seconds 7 or less.`);
  process.exit(1);
}

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* ---- signal maths ------------------------------------------------------
   MOVED, NOT CHANGED. This was ~40 lines of peak-counting living here, until
   Global Games needed a flash census of its own and the choice was to copy it
   or to share it. Copying is how two standards start. The method — prominence
   with a threshold proportional to the signal's own range — and the self-test
   cases are byte-identical to what shipped here; they just live in
   tools/flicker_analyse.mjs now, so a correction reaches both instruments. */
const analyse = series => rawAnalyse(series, FPS);

/* The instrument's own control. A rate-measuring tool that has never been shown
   to recover a KNOWN rate is an opinion generator. */
if (process.argv.includes('--self-test')) {
  const { bad, lines } = selfTest(FPS);
  for (const l of lines) console.log(l);
  console.log(bad === 0
    ? 'SELF-TEST PASSED: the analyser recovers known rates and is scale-invariant.'
    : `SELF-TEST FAILED: ${bad} case(s) wrong — no measurement from this tool means anything.`);
  process.exit(bad === 0 ? 0 : 1);
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1000, height: 720 },
  reducedMotion: RM ? 'reduce' : 'no-preference'
});
const page = await ctx.newPage();
/* A HEARTH-ONLY ROOM. Measuring the default room mixed the flame in with the
   cat breathing, the plant sway, the forage-node pulse and any sparkle burst
   the placement itself threw — and the recovered rate came out at 1.5/sec for a
   flame that provably oscillates at 2.75. The scene is seeded so the only thing
   in it that moves is the thing being measured. */
const SCENE = withHearth => JSON.stringify({
  palette: 'hearth', weather: 'sunny', autoLight: false, selectedId: null,
  objects: withHearth
    ? [{ type: 'fireplace', name: 'Tiny Hearth', id: 1, u: 0.5, v: 0.55, rot: 0, tint: '#6a6675' }]
    : [],
  /* One forage node, seeded at a fixed spot. The game re-seeds three at random
     when nodes is empty, so it cannot be left out — it is pinned instead, and
     the run is kept under the 10s respawn clock so no extra one appears. Its
     pulse is exactly what the second pass subtracts. */
  nodes: [{ id: 'n1', kind: 'quartz', u: 0.06, v: 0.99, phase: 0 }]
});
await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (_) {} },
  ['mbm_lumina_haven_state_v1', SCENE(true)]);
await page.goto(`${base}/${FILE}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);

/* Set the scene through the real UI, so the measurement is of the game rather
   than of some state only a harness can reach. */
const scene = await page.evaluate(async () => {
  document.getElementById('startBtn').click();
  await new Promise(r => setTimeout(r, 350));
  const key = Object.keys(localStorage).find(k => /lumina/.test(k));
  let placed = null, objs = null;
  try {
    const st = JSON.parse(localStorage.getItem(key));
    placed = st.objects.filter(o => o.type === 'fireplace').length;
    objs = st.objects.length;
  } catch (_) {}
  return { palette: document.querySelector('.paletteBtn.active')?.dataset.palette, hearths: placed, objects: objs };
});
if (!scene.hearths) { console.error('SCENE FAILED: no Tiny Hearth placed — nothing to measure'); process.exit(1); }
console.log(`[${LABEL}] scene: palette=${scene.palette} · hearths=${scene.hearths} · total objects=${scene.objects} · RM=${RM}`);

/* Deterministic virtual clock. */
const CAPTURE = async ({ fps, seconds, settle }) => {
  const c = document.getElementById('game');
  const g = c.getContext('2d');
  const cbs = [];
  const realRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
  await new Promise(r => setTimeout(r, 80));

  const W = 160, H = 120;          /* downsample target */
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const og = off.getContext('2d', { willReadFrequently: true });

  const total = Math.round(fps * seconds);
  const step = 1000 / fps;
  let t = performance.now();
  const frames = [];

  /* SETTLE FIRST. Selecting the Hearth palette starts a crossfade that eases
     over seconds, and in the first version of this tool that slow ramp
     dominated the signal completely — it reported 0.6 Hz for a hearth whose
     flame demonstrably oscillates at 2.7. Two virtual seconds of settling: long
     enough for the crossfade, short enough that the whole run stays under the
     game's 10-second forage respawn so the scene cannot change mid-measurement. */
  for (let i = 0; i < fps * settle; i++) {
    t += step;
    const b = cbs.splice(0, cbs.length);
    for (const cb of b) { try { cb(t); } catch (_) {} }
    if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
  }
  await new Promise(r => setTimeout(r, 0));

  for (let i = 0; i < total; i++) {
    t += step;
    const b = cbs.splice(0, cbs.length);
    for (const cb of b) { try { cb(t); } catch (_) {} }
    og.drawImage(c, 0, 0, W, H);
    const d = og.getImageData(0, 0, W, H).data;
    const lum = new Float32Array(W * H);
    for (let p = 0, k = 0; p < d.length; p += 4, k++) {
      lum[k] = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
    }
    frames.push(Array.from(lum));
    if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
  }
  window.requestAnimationFrame = realRaf;

  /* Locate the flicker rather than assuming where it is: per-pixel temporal
     variance, then the bounding box of the top 1%. */
  const n = frames.length, px = W * H;
  const varr = new Float32Array(px);
  for (let k = 0; k < px; k++) {
    let m = 0; for (let i = 0; i < n; i++) m += frames[i][k]; m /= n;
    let v = 0; for (let i = 0; i < n; i++) { const d2 = frames[i][k] - m; v += d2 * d2; }
    varr[k] = v / n;
  }
  /* The top-variance PIXELS themselves, not the box that contains them. A
     bounding box also holds everything static between the hot pixels, and
     averaging over it buried the signal. The box is still computed, purely so
     the report can say WHERE the tool looked. */
  const sorted = Array.from(varr).sort((a, b) => b - a);
  const cut = sorted[Math.floor(px * 0.005)];
  const hotIdx = [];
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let k = 0; k < px; k++) {
    if (varr[k] >= cut && varr[k] > 0) {
      const x = k % W, y = (k / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      hotIdx.push(k);
    }
  }
  const hot = hotIdx.length;
  /* VARIANCE-WEIGHTED, not a box mean. A bounding box around the top-variance
     pixels also contains everything static between them, and averaging over it
     buried the flame's signal under its own surroundings. Weighting each pixel
     by how much it actually varies puts the measurement on the thing that
     moves, without anyone typing a rectangle. */
  const locus = [], whole = [];
  for (let i = 0; i < n; i++) {
    let sl = 0, sw = 0;
    for (const k of hotIdx) sl += frames[i][k];
    for (let k = 0; k < px; k++) sw += frames[i][k];
    locus.push(hot ? sl / hot : 0);
    whole.push(sw / px);
  }
  return { locus, whole, box: { x0, x1, y0, y1, hot }, grid: { W, H },
           varr: Array.from(varr), frames };
};
const cap = await page.evaluate(CAPTURE, { fps: FPS, seconds: SECONDS, settle: SETTLE });

/* --- SECOND PASS: the identical scene with the hearth removed. ------------
   The first attempt at isolating the flame put one forage node in a corner and
   averaged the top-variance pixels; the locus came back spanning x19-x82, i.e.
   the node AND the hearth, and reported 0.75 peaks/sec for a flame that
   provably runs at 2.75. Nothing about "top variance" says "the thing I meant".
   So the room is measured twice — with the hearth and without it — and the
   flame's pixels are the ones whose variance the hearth ADDED. Everything the
   room does on its own subtracts out, by construction rather than by hoping. */
const ctx2 = await browser.newContext({
  viewport: { width: 1000, height: 720 },
  reducedMotion: RM ? 'reduce' : 'no-preference'
});
const page2 = await ctx2.newPage();
await page2.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (_) {} },
  ['mbm_lumina_haven_state_v1', SCENE(false)]);
await page2.goto(`${base}/${FILE}`, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(900);
await page2.evaluate(async () => { document.getElementById('startBtn').click(); await new Promise(r => setTimeout(r, 350)); });
const capNo = await page2.evaluate(CAPTURE, { fps: FPS, seconds: SECONDS, settle: SETTLE });
await ctx2.close();

/* Pixels the hearth made move. */
const px = cap.varr.length;
const delta = new Array(px);
for (let k = 0; k < px; k++) delta[k] = Math.max(0, cap.varr[k] - capNo.varr[k]);
const order = delta.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]);
/* "Greater than zero" was too weak a bar: rendering is not bit-identical
   between two page loads, so a scatter of unrelated pixels carried a tiny
   positive delta and dragged the locus back across the room. A pixel counts as
   hearth-attributable only if the hearth raised its variance by a real fraction
   of the largest such rise. */
const maxDelta = order.length ? order[0][0] : 0;
const FLOOR = maxDelta * 0.10;
const hotIdx = order.filter(([v]) => v > FLOOR).slice(0, Math.floor(px * 0.02)).map(([, k]) => k);
if (!hotIdx.length) {
  /* Under reduced motion this is the REQUIRED result, not a failure: the hearth
     must contribute no movement at all. Reporting it as an error would have
     turned the one outcome the RM path is supposed to produce into a red. */
  if (RM) {
    console.log(`[${LABEL}] RM: the hearth contributes ZERO moving pixels — a genuinely static warm glow.`);
    console.log(`[${LABEL}] JSON ${JSON.stringify({ label: LABEL, rm: true, movingPixels: 0, static: true })}`);
    await browser.close(); srv.close(); process.exit(0);
  }
  console.error('NO HEARTH-ATTRIBUTABLE PIXELS — the difference found nothing to measure');
  process.exit(1);
}
if (RM) {
  console.log(`[${LABEL}] RM FAILURE: ${hotIdx.length} hearth pixel(s) still moving under reduced motion.`);
  await browser.close(); srv.close(); process.exit(1);
}
const gw = cap.grid.W;
let hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
for (const k of hotIdx) {
  const x = k % gw, y = (k / gw) | 0;
  if (x < hx0) hx0 = x; if (x > hx1) hx1 = x;
  if (y < hy0) hy0 = y; if (y > hy1) hy1 = y;
}
const flame = cap.frames.map(f => { let t = 0; for (const k of hotIdx) t += f[k]; return hotIdx.length ? t / hotIdx.length : 0; });

const L = analyse(flame), Wl = analyse(cap.whole);
const moved = L.peakToPeak > 0.5;

console.log(`[${LABEL}] flame locus (hearth-attributable): x ${hx0}-${hx1}, y ${hy0}-${hy1} of ${cap.grid.W}x${cap.grid.H} (${hotIdx.length} px, delta floor ${FLOOR.toFixed(1)} of max ${maxDelta.toFixed(1)})`);
console.log(`[${LABEL}] NON-VACUITY: signal ${moved ? 'MOVED' : 'DID NOT MOVE'} (locus peak-to-peak ${L.peakToPeak})`);
if (!moved) console.log(`[${LABEL}] every rate below is therefore meaningless and is reported only to show it was measured.`);
console.log(`[${LABEL}] FLAME  peaks/sec ${L.peaksPerSec} · zero-x/sec ${L.zeroXPerSec} · worst frame swing ${L.worstFrameSwing} · peak-to-peak ${L.peakToPeak} · mean ${L.mean}`);
console.log(`[${LABEL}] WHOLE  peaks/sec ${Wl.peaksPerSec} · zero-x/sec ${Wl.zeroXPerSec} · worst frame swing ${Wl.worstFrameSwing} · peak-to-peak ${Wl.peakToPeak} · mean ${Wl.mean}`);
console.log(`[${LABEL}] JSON ${JSON.stringify({ label: LABEL, rm: RM, locus: L, whole: Wl, moved })}`);

/* Frame pairs for a human, if asked. */
if (FRAMES_DIR) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const times = [0, 0.8, 1.6, 2.4, 3.2, 4.0];
  await page.evaluate(async ({ times, fps }) => {
    const cbs = [];
    window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
    await new Promise(r => setTimeout(r, 60));
    window.__shots = [];
    let t = performance.now();
    const step = 1000 / fps;
    const last = times[times.length - 1];
    let idx = 0;
    for (let i = 0; i <= Math.round(last * fps); i++) {
      t += step;
      const b = cbs.splice(0, cbs.length);
      for (const cb of b) { try { cb(t); } catch (_) {} }
      if (idx < times.length && i >= Math.round(times[idx] * fps)) {
        window.__shots.push(document.getElementById('game').toDataURL('image/png'));
        idx++;
      }
      if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
    }
  }, { times, fps: FPS });
  const shots = await page.evaluate(() => window.__shots);
  shots.forEach((d, i) => {
    fs.writeFileSync(path.join(FRAMES_DIR, `${LABEL}-t${times[i].toFixed(1)}s.png`),
      Buffer.from(d.split(',')[1], 'base64'));
  });
  console.log(`[${LABEL}] wrote ${shots.length} frames to ${FRAMES_DIR}`);
}

await browser.close();
srv.close();
