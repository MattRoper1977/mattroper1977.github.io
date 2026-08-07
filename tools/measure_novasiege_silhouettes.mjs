#!/usr/bin/env node
/* Silhouette distinctness for Nova Siege's enemy classes.
 *
 * B1 asks for "a distinct silhouette per enemy class at a glance". That is a
 * measurable claim, and this estate's precedent is to measure it rather than
 * eyeball it — the colourblind palette was chosen on worst pairwise CIELAB
 * distance under dichromat simulation, not on taste.
 *
 * Method. Each class is drawn through the game's OWN enemyPath() — the same
 * function drawEnemies() renders with, so this measures the shape the player
 * is shown and not a copy that can drift from it. Colour, glow and line width
 * are discarded: filled white on black at a common radius, which is what
 * "at a glance" means. Each mask is normalised for area so a big shape and a
 * small shape are compared on FORM, not size.
 *
 * Metric: pairwise IoU (intersection over union) of the filled masks.
 * Distinctness = 1 - IoU. 1.0 = nothing in common, 0.0 = identical.
 * The reported score is the WORST pair, because a set is only as readable as
 * its most confusable two members.
 *
 *   node tools/measure_novasiege_silhouettes.mjs [path] [--floor 0.45]
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--')) ||
  fileURLToPath(new URL('../_staging/novasiege/index.html', import.meta.url));
const fi = argv.indexOf('--floor');
const FLOOR = fi > -1 ? Number(argv[fi + 1]) : null;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(target).href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('!!window.__vector', null, { timeout: 20000 });

const data = await page.evaluate(() => {
  const N = 128, R = 46;
  const classes = window.__vector.classes();
  const masks = {};
  for (const t of classes) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
    x.save(); x.translate(N / 2, N / 2);
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2;
    window.__vector.pathFor(x, t, R);
    x.fill(); x.stroke();
    x.restore();
    const d = x.getImageData(0, 0, N, N).data;
    const m = new Uint8Array(N * N);
    let area = 0;
    for (let i = 0; i < N * N; i++) { m[i] = d[i * 4] > 110 ? 1 : 0; area += m[i]; }
    masks[t] = { m: Array.from(m), area };
  }
  return { N, classes, masks };
});
await browser.close();

const { N, classes, masks } = data;

/* Area-normalised comparison. Two shapes that differ only in scale are not
   two shapes, so each mask is rescaled about its centroid to a common area
   before comparison — otherwise "drone is smaller" would masquerade as
   distinctness the eye does not get at a glance. */
function normalise(mask) {
  const { m, area } = mask;
  let cx = 0, cy = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x]) { cx += x; cy += y; }
  cx /= area; cy /= area;
  const k = Math.sqrt(3000 / area);            // common target area
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = Math.round((x - N / 2) / k + cx), sy = Math.round((y - N / 2) / k + cy);
    if (sx >= 0 && sy >= 0 && sx < N && sy < N && m[sy * N + sx]) out[y * N + x] = 1;
  }
  return out;
}
const norm = Object.fromEntries(classes.map((t) => [t, normalise(masks[t])]));

const pairs = [];
for (let i = 0; i < classes.length; i++) {
  for (let j = i + 1; j < classes.length; j++) {
    const a = norm[classes[i]], b = norm[classes[j]];
    let inter = 0, uni = 0;
    for (let k = 0; k < a.length; k++) { const p = a[k], q = b[k]; if (p & q) inter++; if (p | q) uni++; }
    pairs.push({ a: classes[i], b: classes[j], d: uni ? 1 - inter / uni : 1 });
  }
}
pairs.sort((x, y) => x.d - y.d);

console.log('  pairwise silhouette distinctness (1 - IoU, area-normalised)\n');
for (const p of pairs.slice(0, 8)) {
  const bar = '█'.repeat(Math.round(p.d * 30));
  console.log(`  ${p.d.toFixed(3)}  ${bar.padEnd(30)} ${p.a} vs ${p.b}`);
}
const worst = pairs[0];
console.log(`\n  all ${classes.length} classes, ${pairs.length} pairs`);
console.log(`  worst overall: ${worst.a} vs ${worst.b} at ${worst.d.toFixed(3)}`);

/* The boss is scored but NOT gated, and the reason is a limitation of this
   metric rather than a fact about the game. Area-normalisation exists so two
   classes are compared on form instead of size — which is right for the six
   regular classes, all of radius 14-25, and wrong for the boss, whose primary
   at-a-glance cue IS its size (radius 25+ growing, one at a time, with a
   dedicated health bar across the top of the screen). Normalising that away
   and then redesigning the boss to raise the number would be optimising the
   instrument, not the game. The floor is therefore taken over the classes that
   genuinely share the screen at comparable size. */
const regular = pairs.filter((p) => p.a !== 'boss' && p.b !== 'boss');
const rWorst = regular[0];
console.log(`  regular classes only (boss excluded, see note): ${regular.length} pairs`);
console.log(`  WORST PAIR: ${rWorst.a} vs ${rWorst.b} at ${rWorst.d.toFixed(3)}`);

if (FLOOR !== null) {
  const ok = rWorst.d >= FLOOR;
  console.log(`  floor ${FLOOR.toFixed(2)} — ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}
