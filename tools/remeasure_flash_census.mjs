/*
 * F3 / R12 — re-measure everything the old flash instrument cleared.
 *
 * REPORT ONLY. Nothing is repaired here, by ruling.
 *
 * The old instruments reduced each frame to one whole-canvas mean before
 * handing it to analyse(). That dilutes a localised strobe, and the Depths
 * census proved what the dilution costs: a real 14.91 Hz flash read as
 * 0.000 Hz. So every surface the old lens cleared has to be read again through
 * the tiled lens in tools/flicker_analyse.mjs.
 *
 * Emberwild is EXCLUDED - it is in hand under F2.
 *
 * TWO THINGS THIS INSTRUMENT DOES NOT DO, stated rather than discovered later:
 *
 *   1. It samples the canvas by drawing it into a SEPARATE 2D canvas of its
 *      own. It never calls getContext('2d') on the game's canvas. That is
 *      failure mode #45 - an instrument that consumes the resource it is
 *      measuring - and it is exactly how a WebGL game was once reported as
 *      running a Canvas 2D fallback it had never used.
 *
 *   2. It drives no game to a worst case. The old driving instrument had test
 *      seams and posed seven scenes; this walks in and watches the default
 *      surface. A quiet reading here is therefore NOT a clearance - it is an
 *      absence of evidence on one scene. Where the old instrument posed a
 *      scene, that scene still has to be re-posed. Said plainly in the output.
 *
 * Usage:  node tools/remeasure_flash_census.mjs [repo-root] [--seconds 6]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { analyseTiled, selfTest, selfTestLens } from './flicker_analyse.mjs';

const args = process.argv.slice(2);
const ROOT = args.find(a => !a.startsWith('--')) || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SECONDS = Number((args.find(a => a.startsWith('--seconds')) || '').split('=')[1] || 6);

/* The surfaces the old instrument cleared, and which instrument cleared them. */
const SURFACES = [
  { route: '/neonmeridian/', by: 'measure_driving_flash.mjs', note: 'old tool posed 7 driving scenes via window.__NM' },
  { route: '/rallyvector3d/', by: 'measure_driving_flash.mjs', note: 'old tool posed driving scenes' },
  { route: '/olympics/', by: 'measure_olympics_flash.mjs', note: '' },
  { route: '/luminahaven/', by: 'measure_hearth_flicker.mjs', note: 'hearth scene is posed by the old tool' },
  { route: '/novasiege/', by: 'verify_novasiege.mjs', note: '' },
  { route: '/relicforge/', by: 'verify_relicforge.js', note: '' },
];

const ESTATE_CEILING = 2.4;   // the estate's own line, per the Depths census

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) break;
  } catch (e) { /* next */ }
}
if (!chromium) { console.error('INCONCLUSIVE: playwright is not importable.'); process.exit(2); }

/* --- the instrument must prove itself before it quotes a number ---------- */
const st = selfTest(), stl = selfTestLens();
console.log('=== instrument self-test ===');
st.lines.forEach(l => console.log('  ' + l));
stl.lines.forEach(l => console.log('  ' + l));
if (st.bad || stl.bad) {
  console.error(`\nSELF-TEST FAILED (${st.bad + stl.bad}) — no measurement from this tool means anything.`);
  process.exit(2);
}
console.log('  self-test clean — measurements below are quotable\n');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

/*
 * Sample in-page at real frame rate.
 *
 * The game's canvas is drawn INTO a scratch canvas this function owns, so no
 * context is ever bound to the game's own. Tiles are reduced in-page and only
 * the tile series crosses back, which keeps the transfer small enough not to
 * perturb the frame budget being measured.
 */
const SAMPLER = ({ seconds, grid }) => new Promise(resolve => {
  const pick = () => {
    const all = [...document.querySelectorAll('canvas')];
    if (!all.length) return null;
    return all.map(c => ({ c, a: c.clientWidth * c.clientHeight }))
      .sort((x, y) => y.a - x.a)[0].c;
  };
  const src = pick();
  if (!src) { resolve({ error: 'no canvas' }); return; }

  const W = 96, H = 96;
  const scratch = document.createElement('canvas');
  scratch.width = W; scratch.height = H;
  const sx = scratch.getContext('2d', { willReadFrequently: true });

  const frames = [];
  let blank = 0, t0 = null;
  const lumOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const step = ts => {
    if (t0 === null) t0 = ts;
    try { sx.drawImage(src, 0, 0, W, H); } catch (e) { resolve({ error: 'drawImage: ' + e.message }); return; }
    let d;
    try { d = sx.getImageData(0, 0, W, H).data; } catch (e) { resolve({ error: 'getImageData: ' + e.message }); return; }
    const tiles = new Float64Array(grid * grid);
    const counts = new Uint32Array(grid * grid);
    let nonZero = 0;
    for (let y = 0; y < H; y++) {
      const ty = Math.min(grid - 1, (y * grid / H) | 0);
      for (let x = 0; x < W; x++) {
        const tx = Math.min(grid - 1, (x * grid / W) | 0);
        const i = (y * W + x) * 4;
        if (d[i] || d[i + 1] || d[i + 2]) nonZero++;
        const t = ty * grid + tx;
        tiles[t] += lumOf(d[i], d[i + 1], d[i + 2]);
        counts[t]++;
      }
    }
    for (let t = 0; t < tiles.length; t++) if (counts[t]) tiles[t] /= counts[t];
    if (!nonZero) blank++;
    frames.push(Array.from(tiles));
    if (ts - t0 < seconds * 1000) requestAnimationFrame(step);
    else resolve({
      frames, blank,
      elapsed: (ts - t0) / 1000,
      canvas: { w: src.width, h: src.height, cw: src.clientWidth, ch: src.clientHeight },
    });
  };
  requestAnimationFrame(step);
});

const rows = [];
try {
  for (const s of SURFACES) {
    process.stdout.write(`measuring ${s.route} … `);
    if (!fs.existsSync(path.join(ROOT, s.route.replace(/^\/|\/$/g, ''), 'index.html'))) {
      rows.push({ ...s, status: 'ABSENT' }); console.log('absent'); continue;
    }
    const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 80)));
    try {
      await page.goto(origin + s.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      // A click at centre: many of these open on a title card that never animates.
      await page.mouse.click(480, 300).catch(() => {});
      await page.waitForTimeout(1500);
      const out = await page.evaluate(SAMPLER, { seconds: SECONDS, grid: 8 });
      if (out.error) { rows.push({ ...s, status: 'INCONCLUSIVE', detail: out.error }); console.log(out.error); }
      else {
        const fps = out.frames.length / out.elapsed;
        const r = analyseTiled(out.frames, fps);
        const blankPct = (out.blank / out.frames.length) * 100;
        rows.push({
          ...s, status: 'MEASURED', fps: +fps.toFixed(1), frames: out.frames.length,
          whole: r.whole.peaksPerSec, worst: r.worst.peaksPerSec,
          wholePtp: r.whole.peakToPeak, worstPtp: r.worst.peakToPeak,
          dilution: r.dilution, tile: r.worstTile, above: r.tilesAboveFloor,
          blankPct: +blankPct.toFixed(0), pageErrors: pageErrors.length,
        });
        console.log(`${r.worst.peaksPerSec} Hz tiled / ${r.whole.peaksPerSec} Hz whole  (${fps.toFixed(0)} fps)`);
      }
    } catch (e) {
      rows.push({ ...s, status: 'INCONCLUSIVE', detail: String(e).slice(0, 90) });
      console.log('error');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== F3 RE-MEASURE — the surfaces the old lens cleared ===');
console.log(`sampled ${SECONDS}s per surface, default scene, 8x8 tiles, estate ceiling ${ESTATE_CEILING} Hz\n`);
/*
 * A RATE ON AN EMPTY SIGNAL IS NOT A FINDING.
 *
 * analyse() sets its prominence threshold proportional to the signal's own
 * range, which is what makes it scale-free - and which also means it will
 * happily return a confident rate for a series that is nothing but rounding
 * noise. When no tile clears the amplitude floor, analyseTiled() falls back to
 * the whole-frame series and reports worstTile -1; the Hz that comes back is
 * then a number with no luminance behind it. Reporting that as a breach would
 * be this session's own failure mode - a figure that reads as real while its
 * denominator is empty - so it is called what it is instead.
 *
 * Nyquist is the second guard. This container does not always hit 60 fps, and
 * the old olympics instrument recorded the same hazard at 6-12 fps. Nothing
 * above a quarter of the achieved frame rate is quoted as reliable.
 */
const classify = r => {
  if (r.blankPct > 50) return { key: 'UNREADABLE', text: `UNREADABLE — ${r.blankPct}% blank frames` };
  if (r.tile === -1 || r.worstPtp < 0.01) {
    return { key: 'NO_SIGNAL', text: `no tile above the amplitude floor — ${r.worst} Hz has no luminance behind it` };
  }
  if (r.worst > r.fps / 4) {
    return { key: 'ALIASED', text: `${r.worst} Hz is above the reliable band at ${r.fps} fps — re-sample` };
  }
  if (r.worst > ESTATE_CEILING) return { key: 'OVER', text: `OVER the ${ESTATE_CEILING} Hz line` };
  return { key: 'UNDER', text: 'under the line on this scene' };
};

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('route', 18) + pad('status', 12) + pad('fps', 6) + pad('tiled Hz', 10) + pad('whole Hz', 10)
  + pad('tiled p-p', 11) + pad('dilution', 10) + 'verdict');
for (const r of rows) {
  if (r.status !== 'MEASURED') {
    console.log(pad(r.route, 18) + pad(r.status, 12) + (r.detail || ''));
    continue;
  }
  r.verdict = classify(r);
  console.log(pad(r.route, 18) + pad(r.status, 12) + pad(r.fps, 6) + pad(r.worst, 10) + pad(r.whole, 10)
    + pad(r.worstPtp, 11) + pad(r.dilution + 'x', 10) + r.verdict.text);
}

const flagged = rows.filter(r => r.status === 'MEASURED' && r.verdict && r.verdict.key === 'OVER');
const unread = rows.filter(r => r.status !== 'MEASURED'
  || (r.verdict && ['UNREADABLE', 'NO_SIGNAL', 'ALIASED'].includes(r.verdict.key)));
console.log('\n--- what the new lens surfaces ---');
if (flagged.length) {
  for (const r of flagged) {
    console.log(`  ${r.route}  ${r.worst} Hz on tile ${r.tile} (p-p ${r.worstPtp}) — the old lens read ${r.whole} Hz`);
    console.log(`      cleared by ${r.by}${r.note ? '; ' + r.note : ''}`);
  }
} else {
  console.log('  no surface exceeded the estate ceiling on its DEFAULT scene.');
}
console.log('\n--- NOT a clearance ---');
console.log('  This walked in and watched. It posed no worst case. Every surface whose old');
console.log('  instrument drove a scene must have that scene re-posed through the tiled lens');
console.log('  before it can be called clear:');
for (const r of SURFACES.filter(s => s.note)) console.log(`      ${r.route}  ${r.note}`);
if (unread.length) {
  console.log('\n--- unreadable by this harness ---');
  for (const r of unread) console.log(`      ${r.route}  ${r.verdict ? r.verdict.text : r.status}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log('\nREPORT ONLY — nothing repaired, per R12.');
