#!/usr/bin/env node
/* measure_olympics_flash.mjs — the photosensitivity census for Global Games.
 *
 * A confetti ceremony and nine event engines is exactly where a flash problem
 * would live, so every one of them is measured rather than the two that look
 * riskiest. The analyser is the estate's shared one (tools/flicker_analyse.mjs,
 * the same code that measures Lumina Haven's hearth), so these numbers and the
 * hearth's are directly comparable.
 *
 * Method, and each choice is a lesson rather than a preference:
 *
 *   DETERMINISTIC VIRTUAL CLOCK at 60fps. Headless software rendering manages
 *   6-12fps in this container, which samples a 3 Hz waveform about twice per
 *   cycle — far too coarse to measure a rate, and coarse enough to invent one.
 *   rAF and performance.now are replaced so a "second" is exactly 60 frames.
 *
 *   WHOLE-CANVAS luminance, not a chosen region. Sampling a hand-picked box is
 *   how a flicker measurement gets a confident green from a corner where
 *   nothing was ever going to move.
 *
 *   NON-VACUITY FIRST. "Reduced motion is calm" is worthless unless the
 *   full-motion pass is shown to have moved. Every scene reports both, and the
 *   verdict says so when the control is flat.
 *
 * The ceiling is 3 Hz — below the 3-to-60 Hz band that carries photosensitive
 * seizure risk, and the number the rest of this estate is held to.
 *
 *   node tools/measure_olympics_flash.mjs
 *   node tools/measure_olympics_flash.mjs --self-test
 *   node tools/measure_olympics_flash.mjs --seconds 6 --scene sprint
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse, selfTest } from './flicker_analyse.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_DIR || path.join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const SECONDS = Number(arg('seconds', 5));
const ONLY = arg('scene', null);
const FPS = 60;
const CEILING_HZ = 3;

/* ---- THE AMPLITUDE FLOOR, AND WHY A RATE ALONE IS NOT A VERDICT ----------
   The first run of this census reported five scenes OVER CEILING at up to 17.4
   Hz. Every one of them was noise. The peak counter uses a prominence threshold
   proportional to the signal's OWN range — which is exactly right for measuring
   a waveform, and exactly wrong for judging one that has no waveform: with a
   peak-to-peak of 0.086 luminance units out of 255, the threshold falls to
   0.004 and 8-bit quantisation jitter counts as peaks.

   That is a VACUOUS RED, the mirror of the vacuous green this estate already
   knows to distrust, and it is the more dangerous of the two. A green that
   proves nothing wastes a gate; a red that proves nothing gets a real safety
   instrument switched off for crying wolf.

   A photosensitivity limit is about PERCEPTIBLE luminance oscillation, so the
   floor is stated in luminance units and derived from the measurements rather
   than picked. The census separates cleanly into two populations:

     did not move    0, 0, 0.086, 0.129, 0.129, 0.157, 0.305
     genuinely moved 3.95, 16.3, 23.2, 38.4

   There is an order of magnitude of empty space between 0.305 and 3.95. A floor
   of 2.0 units — 0.78% of the 0-255 range — sits inside that gap with margin at
   both ends, and is an order of magnitude BELOW any modulation a flash guideline
   concerns itself with, so nothing that could hurt anyone hides under it.

   TWO FLOORS, BECAUSE THERE ARE TWO QUESTIONS. Collapsing them into one number
   is how a threshold quietly gets raised until the thing under test passes, and
   that is the failure this estate already has a register entry about.

     MEANINGFUL (2.0 units, ~0.8% of range) — derived from the gap above. Below
     this the instrument cannot tell signal from 8-bit quantisation, so no
     verdict of any kind is honest.

     HAZARDOUS (25.5 units, 10% of range) — derived from the flash guidance the
     estate's 3 Hz rule comes from, where a flash is a pair of opposing changes
     in relative luminance of at least 10% of maximum over a large area. Below
     this a modulation is real but cannot be the hazard the ceiling exists for.

   A scene FAILS only when it is at or above the hazardous floor AND at or above
   the rate ceiling. Between the two floors it is reported as modulating below
   the hazard threshold, with its rate printed, so nothing is hidden.

   KNOWN LIMITATION, stated rather than discovered later: this measures the mean
   over the WHOLE canvas, which is the right proxy for the "large area" the
   guidance is about, but it dilutes a bright flash confined to part of the
   frame — a strobe over a third of the screen moves this mean by roughly a
   third of its amplitude. The hearth instrument answers that by locating the
   highest-variance region automatically and reporting both; porting that locus
   pass here is a named next step, not a thing this tool already does. The
   positive control below is deliberately full-screen, so it exercises what this
   tool actually measures and does not flatter it. */
const AMPLITUDE_FLOOR = 2.0;
const HAZARD_FLOOR = 25.5;

if (process.argv.includes('--self-test')) {
  const { bad, lines } = selfTest(FPS);
  for (const l of lines) console.log(l);
  console.log(bad === 0
    ? 'SELF-TEST PASSED: the analyser recovers known rates and is scale-invariant.'
    : `SELF-TEST FAILED: ${bad} case(s) wrong — no measurement from this tool means anything.`);
  process.exit(bad === 0 ? 0 : 1);
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

/* The nine engines the game ships, plus the two ceremony moments. Derived from
   the game's own EVENT_ORDER at run time rather than typed here, so a tenth
   event would be censused automatically. */
async function scenes(page) {
  const ids = await page.evaluate(() => window.__olympics.schedule.slice());
  return [...ids.map(id => ({ id, kind: 'event' })),
          { id: 'ceremony', kind: 'ceremony' }];
}

async function measure(browser, base, scene, rm) {
  const ctx = await browser.newContext({
    viewport: { width: 960, height: 600 },
    reducedMotion: rm ? 'reduce' : 'no-preference'
  });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  await page.goto(base + '/olympics/index.html', { waitUntil: 'commit' });
  await page.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 20000 });
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__drive(8));
  await page.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });

  const reached = await page.evaluate(({ id, kind }) => {
    const drive = window.__drive;
    const app = window.MBMGlobalGames.app;
    const skip = document.querySelector('.mbm-skip'); if (skip) skip.click();
    drive(80);
    document.getElementById('newGamesBtn').click(); drive(10);
    document.querySelector('[data-mode="ultimate"]').click(); drive(10);
    document.getElementById('autoAttrs').click(); drive(10);
    document.getElementById('beginTournament').click(); drive(20);
    if (kind === 'event') {
      app.tournament.index = app.tournament.schedule.indexOf(id);
      document.getElementById('eventBriefing').click(); drive(20);
      document.getElementById('startEvent').click(); drive(30);
      return window.__olympics.screen;
    }
    /* Ceremony: resolve every day, then sit on the final screen where the
       confetti falls. This is the largest moving object in the game. */
    for (let d = 0; d < 9; d++) {
      document.getElementById('eventBriefing').click(); drive(12);
      document.getElementById('startEvent').click(); drive(12);
      window.__olympics.finishEvent(); drive(30);
      const rc = document.getElementById('resultContinue'); if (rc) { rc.click(); drive(12); }
      const sc = document.getElementById('standingsContinue'); if (sc) { sc.click(); drive(12); }
    }
    return window.__olympics.screen;
  }, scene);

  /* Whole-canvas mean luminance, one sample per virtual frame. Downsampled in
     the page (drawImage into a small offscreen canvas) because shipping full
     frames across the bridge 300 times is the difference between a 20-second
     run and a 20-minute one. */
  const series = await page.evaluate(async (frames) => {
    const src = document.getElementById('game');
    const small = document.createElement('canvas');
    small.width = 64; small.height = 36;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    const out = [];
    for (let i = 0; i < frames; i++) {
      window.__drive(1);
      sctx.drawImage(src, 0, 0, small.width, small.height);
      const d = sctx.getImageData(0, 0, small.width, small.height).data;
      let sum = 0;
      for (let p = 0; p < d.length; p += 4) sum += 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
      out.push(sum / (d.length / 4));
    }
    return out;
  }, FPS * SECONDS);

  const particles = await page.evaluate(() => window.__olympics.particles);
  await ctx.close();
  return { reached, particles, ...analyse(series, FPS) };
}

const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();

/* one throwaway page purely to derive the scene list from the game itself */
const probe = await browser.newContext();
const pp = await probe.newPage();
await pp.addInitScript(CLOCK);
await pp.goto(base + '/olympics/index.html', { waitUntil: 'commit' });
await pp.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 20000 });
for (let i = 0; i < 60; i++) await pp.evaluate(() => window.__drive(8));
await pp.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });
await pp.evaluate(() => {
  const skip = document.querySelector('.mbm-skip'); if (skip) skip.click();
  window.__drive(80);
  document.getElementById('newGamesBtn').click(); window.__drive(10);
  document.querySelector('[data-mode="ultimate"]').click(); window.__drive(10);
  document.getElementById('autoAttrs').click(); window.__drive(10);
  document.getElementById('beginTournament').click(); window.__drive(20);
});
let list = await scenes(pp);
await probe.close();
if (ONLY) list = list.filter(s => s.id === ONLY);

console.log(`Global Games — flash census · ${SECONDS}s per scene at a virtual ${FPS}fps · ceiling ${CEILING_HZ} Hz\n`);
console.log('scene            motion  peaks/s  zeroX/s  worst-swing  peak-to-peak  particles  verdict');
console.log('─'.repeat(96));

let worstHz = 0, failures = [], still = [], submerged = [];
for (const scene of list) {
  const full = await measure(browser, base, scene, false);
  const calm = await measure(browser, base, scene, true);

  /* Two floors, two questions — see the header. Meaningful decides whether the
     rate is a measurement at all; hazardous decides whether a real modulation
     is the kind the ceiling exists to stop. */
  const meaningful = full.peakToPeak >= AMPLITUDE_FLOOR;
  const hazardous = full.peakToPeak >= HAZARD_FLOOR;
  if (!meaningful) still.push(`${scene.id} (${full.peakToPeak})`);
  else {
    worstHz = Math.max(worstHz, full.peaksPerSec);
    if (full.peaksPerSec >= CEILING_HZ) {
      const line = `${scene.id} ${full.peaksPerSec} Hz at ${full.peakToPeak} units ` +
                   `(${(full.peakToPeak / 255 * 100).toFixed(2)}% of range)`;
      if (hazardous) failures.push(line);
      else submerged.push(line);
    }
  }
  /* Reduced motion must never be BUSIER than full motion. Stated as "not
     busier" rather than "strictly calmer" because several of these scenes are
     dominated by gameplay movement — an athlete crossing the frame — which
     reduced motion deliberately does not touch, so demanding a strict decrease
     everywhere would fail the game for correctly leaving the sport alone. */
  const calmer = calm.peakToPeak <= full.peakToPeak + 0.5;
  if (!calmer) failures.push(`${scene.id} reduced motion is busier (${calm.peakToPeak} vs ${full.peakToPeak})`);

  for (const [label, r] of [['full', full], ['reduced', calm]]) {
    const verdict = label === 'full'
      ? (!meaningful ? 'below noise floor'
        : r.peaksPerSec < CEILING_HZ ? 'under ceiling'
        : hazardous ? 'OVER CEILING' : 'fast but far under 10%')
      : (calmer ? 'not busier' : 'BUSIER');
    console.log(
      `${scene.id.padEnd(16)} ${label.padEnd(7)} ${String(r.peaksPerSec).padStart(7)} ` +
      `${String(r.zeroXPerSec).padStart(8)} ${String(r.worstFrameSwing).padStart(12)} ` +
      `${String(r.peakToPeak).padStart(13)} ${String(r.particles).padStart(10)}  ${verdict}`);
  }
}

/* ---- POSITIVE CONTROL ---------------------------------------------------
   The amplitude floor above means most scenes are now judged "no perceptible
   modulation", and a census that can only ever say that is not a safety
   instrument. So a copy of the game is written with a genuine full-screen
   strobe painted over every frame at a known rate and a large amplitude, and
   the SAME measurement must flag it. If it does not, nothing above counts. */
if (!ONLY) {
  const src = fs.readFileSync(path.join(ROOT, 'olympics', 'index.html'), 'utf8');
  const anchor = '  if(this.state===\'PLAYING\'&&this.activeEvent)this.updateHUD();';
  let flagged = null, applied = false, note = '';
  if (src.indexOf(anchor) >= 0) {
    const strobed = src.replace(anchor,
      `  {const _t=this.ambientTime*10*Math.PI*2;ctx.save();ctx.setTransform(1,0,0,1,0,0);` +
      `ctx.fillStyle='rgba(255,255,255,'+(0.5+0.5*Math.sin(_t))*0.6+')';` +
      `ctx.fillRect(0,0,this.canvas.width,this.canvas.height);ctx.restore();}\n` + anchor);
    applied = strobed !== src;
    if (applied) {
      const dir = fs.mkdtempSync(path.join(ROOT, 'olympics', '__strobe-'));
      fs.writeFileSync(path.join(dir, 'index.html'), strobed);
      const rel = '/olympics/' + path.basename(dir) + '/index.html';
      const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
      const page = await ctx.newPage();
      await page.addInitScript(CLOCK);
      await page.goto(base + rel, { waitUntil: 'commit' });
      await page.waitForFunction(() => typeof window.__drive === 'function', null, { timeout: 20000 });
      for (let i = 0; i < 60; i++) await page.evaluate(() => window.__drive(8));
      await page.waitForFunction(() => !!window.__olympics, null, { timeout: 20000 });
      await page.evaluate(() => {
        const drive = window.__drive, app = window.MBMGlobalGames.app;
        const skip = document.querySelector('.mbm-skip'); if (skip) skip.click(); drive(80);
        document.getElementById('newGamesBtn').click(); drive(10);
        document.querySelector('[data-mode="ultimate"]').click(); drive(10);
        document.getElementById('autoAttrs').click(); drive(10);
        document.getElementById('beginTournament').click(); drive(20);
        app.tournament.index = 0;
        document.getElementById('eventBriefing').click(); drive(20);
        document.getElementById('startEvent').click(); drive(30);
      });
      const series = await page.evaluate(async (frames) => {
        const s = document.getElementById('game');
        const c = document.createElement('canvas'); c.width = 64; c.height = 36;
        const cx = c.getContext('2d', { willReadFrequently: true });
        const out = [];
        for (let i = 0; i < frames; i++) {
          window.__drive(1);
          cx.drawImage(s, 0, 0, c.width, c.height);
          const d = cx.getImageData(0, 0, c.width, c.height).data;
          let sum = 0;
          for (let p = 0; p < d.length; p += 4) sum += 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
          out.push(sum / (d.length / 4));
        }
        return out;
      }, FPS * SECONDS);
      await ctx.close();
      fs.rmSync(dir, { recursive: true, force: true });
      const r = analyse(series, FPS);
      flagged = r.peakToPeak >= AMPLITUDE_FLOOR && r.peaksPerSec >= CEILING_HZ;
      note = `${r.peaksPerSec} Hz at ${r.peakToPeak} units`;
    }
  } else note = 'anchor not found';
  console.log('');
  if (!applied) { console.log(`CONTROL FAILED — the strobe was not injected (${note}).`); failures.push('positive control could not be applied'); }
  else if (!flagged) { console.log(`CONTROL FAILED — an injected 10 Hz full-screen strobe was NOT caught (${note}).`); failures.push('positive control not caught'); }
  else console.log(`control: an injected 10 Hz full-screen strobe IS caught — ${note}. The ceiling bites.`);
}

await browser.close();
srv.close();

console.log('');
if (still.length) console.log(`below the ${AMPLITUDE_FLOOR}-unit noise floor, no verdict possible: ${still.join(', ')}`);
/* Stated loudly rather than folded into a pass. A reading that is over the rate
   ceiling but under the hazard floor is the one a reader most needs to see, and
   burying it would be the quiet kind of dishonesty this whole tool exists to
   avoid. It is reported every run, with the percentage spelled out. */
if (submerged.length) {
  console.log(`\nOVER THE ${CEILING_HZ} Hz RATE CEILING BUT UNDER THE 10% HAZARD FLOOR — reported, not hidden:`);
  for (const s of submerged) console.log('  ' + s);
  console.log('  These modulate faster than the rate ceiling at an amplitude far below the level');
  console.log('  flash guidance concerns itself with. Whole-canvas mean dilutes localised flashes,');
  console.log('  so a locus pass is the named next step before calling any of these settled.');
}
console.log(`\nworst rate among scenes above the noise floor: ${worstHz} Hz (ceiling ${CEILING_HZ} Hz)`);
if (failures.length) { console.log('FAILURES:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('FLASH CENSUS PASSED — nothing modulates at a hazardous amplitude above the ceiling, reduced motion is never busier, and the control proves the ceiling can fail.');
