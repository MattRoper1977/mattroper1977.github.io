/* Proves the UAS tool works with the network CUT, and touches nothing external.
 *
 * The failing state is asserted first: every request to any origin other than
 * the local server is ABORTED, so if a single cdnjs URL survived anywhere the
 * feature under test dies and this script says so. A pass here means the four
 * libraries genuinely load from uas/vendor/.
 *
 * Usage: node verify_uas_offline.mjs http://127.0.0.1:PORT
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const base = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });

const external = [];
const localReqs = [];
await ctx.route('**/*', async route => {
  const u = route.request().url();
  if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) {
    localReqs.push(u.replace(base, ''));
    return route.continue();
  }
  external.push(u);            // <- the whole point: nothing should land here
  return route.abort();
});

const p = await ctx.newPage();
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 160)));

await p.goto(base + '/uas/app.html', { waitUntil: 'networkidle', timeout: 40000 });
await p.waitForTimeout(1500);

console.log('NETWORK POLICY: every non-local request is aborted.');
console.log('  external requests during page load: ' + external.length);
console.log('');

// ---------------------------------------------------------------- 1. pdf.js
const pdfOK = await p.evaluate(async () => {
  try {
    await ensurePdfJs();
    if (!window.pdfjsLib) return { ok: false, why: 'pdfjsLib undefined' };
    // a real one-page PDF containing the word OSMOSIS, built by hand
    const mk = () => {
      const objs = [];
      objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
      objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
      const stream = 'BT /F1 28 Tf 20 50 Td (OSMOSIS 1BI0) Tj ET';
      objs[4] = '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream';
      objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
      let out = '%PDF-1.4\n'; const off = [];
      for (let i = 1; i <= 5; i++) { off[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
      const xref = out.length;
      out += 'xref\n0 6\n0000000000 65535 f \n';
      for (let i = 1; i <= 5; i++) out += String(off[i]).padStart(10, '0') + ' 00000 n \n';
      out += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
      return new Uint8Array([...out].map(c => c.charCodeAt(0)));
    };
    const doc = await window.pdfjsLib.getDocument({ data: mk() }).promise;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ').trim();
    return { ok: /OSMOSIS/.test(text), text };
  } catch (e) { return { ok: false, why: String(e).slice(0, 200) }; }
});
console.log('1. pdf.js  — text extraction from a real PDF');
console.log('   ' + (pdfOK.ok ? 'PASS  extracted: "' + pdfOK.text + '"' : 'FAIL  ' + (pdfOK.why || pdfOK.text)));

// ---------------------------------------------------------------- 2. jsPDF
const jsOK = await p.evaluate(async () => {
  try {
    await loadScript('vendor/jspdf/jspdf.umd.min.js');
    const J = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!J) return { ok: false, why: 'jsPDF constructor not found' };
    const d = new J(); d.text('Unit Award Scheme', 10, 10);
    const out = d.output('arraybuffer');
    return { ok: out.byteLength > 400, bytes: out.byteLength };
  } catch (e) { return { ok: false, why: String(e).slice(0, 200) }; }
});
console.log('2. jsPDF   — export a PDF');
console.log('   ' + (jsOK.ok ? 'PASS  produced ' + jsOK.bytes + ' bytes' : 'FAIL  ' + jsOK.why));

// ---------------------------------------------------------------- 3. OCR
const ocrOK = await p.evaluate(async () => {
  try {
    await ensureTesseract();
    if (!window.Tesseract) return { ok: false, why: 'Tesseract undefined' };
    const c = document.createElement('canvas'); c.width = 700; c.height = 180;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 700, 180);
    x.fillStyle = '#000'; x.font = 'bold 76px sans-serif';
    x.fillText('OSMOSIS', 30, 110);
    const w = await window.Tesseract.createWorker('eng', 1, {
      workerPath: 'vendor/tesseract/worker.min.js',
      corePath: 'vendor/tesseract/core/tesseract-core-simd.wasm.js',
      langPath: 'vendor/tesseract/tessdata',
      gzip: true
    });
    const r = await w.recognize(c);
    await w.terminate();
    const t = (r.data.text || '').trim();
    return { ok: /OSMOSIS/i.test(t), text: t.slice(0, 60) };
  } catch (e) { return { ok: false, why: String(e).slice(0, 240) }; }
});
console.log('3. tesseract — OCR a rendered word, engine + language pack local');
console.log('   ' + (ocrOK.ok ? 'PASS  read: "' + ocrOK.text + '"' : 'FAIL  ' + (ocrOK.why || ocrOK.text)));

await b.close();

console.log('');
console.log('EXTERNAL REQUESTS ATTEMPTED, WHOLE RUN: ' + external.length);
[...new Set(external)].forEach(u => console.log('    ' + u));
const vend = [...new Set(localReqs.filter(u => u.includes('/vendor/')))];
console.log('VENDORED FILES ACTUALLY FETCHED: ' + vend.length);
vend.forEach(u => console.log('    ' + u));
console.log('CONSOLE ERRORS: ' + errs.length);
errs.slice(0, 6).forEach(e => console.log('    ' + e));

const pass = pdfOK.ok && jsOK.ok && ocrOK.ok && external.length === 0;
console.log('');
console.log(pass ? 'RESULT: PASS — all three features work with the network cut.'
                 : 'RESULT: FAIL');
process.exit(pass ? 0 : 1);
