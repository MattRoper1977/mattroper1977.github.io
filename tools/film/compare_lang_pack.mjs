/* Measures what swapping the tesseract language pack actually costs and buys.
 *
 * The UAS tool OCRs an AQA outcome sheet — unit titles and outcome lines. It
 * never OCRs a register, so nothing here contains anything pupil-shaped: no
 * names, no marks, no class lists. The text below is unit wording of the right
 * SHAPE, invented for this test.
 *
 * Run it once before the swap and once after, on the same rendered image, and
 * diff the two numbers. It reports word accuracy against known ground truth
 * and wall-clock, because "usually equal or better, somewhat slower" is a claim
 * and a claim needs a figure.
 *
 * Two renders, because a clean one separates nothing:
 *   clean — crisp serif on off-white, the best case
 *   hard  — 1.2 degrees of skew, gaussian-ish noise, reduced contrast and a
 *           slight blur. A phone photo of a sheet on a classroom desk.
 * If the packs differ at all, they differ on `hard`.
 *
 * Usage: node compare_lang_pack.mjs http://127.0.0.1:PORT [label] [clean|hard]
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const base = process.argv[2];
const label = process.argv[3] || 'run';
const MODE  = process.argv[4] || 'clean';

/* Ground truth. Deliberately includes the things that actually break OCR on a
   real sheet: a unit reference with digits and letters, punctuation, and a
   long lowercase line. */
const LINES = [
  'AQA Unit Award Scheme',
  'Unit 118374 Cells and Microscopy',
  'Outcome 1 Identify the main parts of an animal cell',
  'Outcome 2 Use a light microscope to view a prepared slide',
  'Outcome 3 Record observations using a labelled diagram',
  'Level 1 Entry Level 3 Foundation',
];
const TRUTH = LINES.join(' ').replace(/\s+/g, ' ').trim();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
const external = [];
await ctx.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
  external.push(u);
  return route.abort();
});
const p = await ctx.newPage();
await p.goto(base + '/uas/app.html', { waitUntil: 'networkidle', timeout: 40000 });

const res = await p.evaluate(async ({ lines, mode }) => {
  await ensureTesseract();
  /* Render the sheet at a scan-like size, slightly grey background and a faint
     rule under the title — closer to a photographed sheet than crisp black on
     pure white, which would flatter both packs equally and tell us nothing. */
  const c = document.createElement('canvas');
  c.width = 1240; c.height = 500;
  const x = c.getContext('2d');
  x.fillStyle = '#f4f2ee'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = mode === 'hard' ? '#4a4a4a' : '#111';   // washed-out ink
  if (mode === 'hard') { x.translate(620, 250); x.rotate(1.2 * Math.PI / 180); x.translate(-620, -250); }
  lines.forEach((t, i) => {
    x.font = (i === 0 ? 'bold 40px' : i === 1 ? 'bold 32px' : '30px') + ' Georgia, serif';
    x.fillText(t, 40, 70 + i * 72);
  });
  x.strokeStyle = '#999'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(40, 88); x.lineTo(1200, 88); x.stroke();
  x.setTransform(1, 0, 0, 1, 0, 0);

  if (mode === 'hard') {
    /* Deterministic speckle — a seeded LCG, not Math.random, so the two runs
       being compared see byte-identical noise. A different image each run would
       make any difference between the packs unattributable. */
    let s = 20260802;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const img = x.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 70;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    x.filter = 'blur(0.7px)';                      // soft focus, as a phone gives
    x.drawImage(c, 0, 0);
    x.filter = 'none';
  }

  const w = await window.Tesseract.createWorker('eng', 1, {
    workerPath: 'vendor/tesseract/worker.min.js',
    corePath: 'vendor/tesseract/core/tesseract-core-simd.wasm.js',
    langPath: 'vendor/tesseract/tessdata',
    gzip: true
  });
  const t0 = performance.now();
  const r = await w.recognize(c);
  const ms = Math.round(performance.now() - t0);
  await w.terminate();
  return { text: (r.data.text || '').replace(/\s+/g, ' ').trim(), ms,
           confidence: r.data.confidence };
}, { lines: LINES, mode: MODE });

await b.close();

/* Word accuracy: how many ground-truth words appear, in order, in the output.
   Longest-common-subsequence over words, so a spurious insertion does not
   cascade into every later word counting as wrong. */
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
const A = norm(TRUTH), B = norm(res.text);
const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
for (let i = 1; i <= A.length; i++)
  for (let j = 1; j <= B.length; j++)
    dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
const hit = dp[A.length][B.length];

console.log('LANGUAGE PACK COMPARISON — ' + label + '   [render: ' + MODE + ']');
console.log('  external requests : ' + external.length + '   (must be 0)');
console.log('  ground-truth words: ' + A.length);
console.log('  words recovered   : ' + hit + '   (' + (100 * hit / A.length).toFixed(1) + '%)');
console.log('  tesseract mean conf: ' + (res.confidence != null ? res.confidence.toFixed(1) : 'n/a'));
console.log('  recognize() time  : ' + res.ms + ' ms');
console.log('  read: ' + res.text.slice(0, 300));
