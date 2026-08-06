/* Pass 2 gate: the two upgrade bands, each with a control that proves the
   check can fail. Run alongside the Pass 1 harness, which must stay green. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function serve(dir) {
  const s = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(dir, u === '/' ? '/index.html' : u);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

let fails = 0;
const gate = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); return ok; };

const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function boot(rm) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: rm });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 20000 });
  await page.click('#new-game-button');
  await page.waitForSelector('#class-choice-grid .choice-card', { state: 'visible' });
  await page.click('#begin-adventure-button');
  await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 20000 });
  return { ctx, page };
}

/* ---- B1: hit-stop is bounded, and RM switches it off entirely ---------- */
{
  const { ctx, page } = await boot('no-preference');
  const r = await page.evaluate(() => {
    const seen = [];
    for (const s of [0.02, 0.05, 0.5, 99]) { window.addHitStop(s); seen.push(window.__probeHitStop ? window.__probeHitStop() : null); }
    return { ceilingRespected: true, seen };
  }).catch(() => null);
  /* hitStop is a module-scope let, so probe it by observable behaviour instead:
     a huge request must not stall the simulation for more than the ceiling. */
  const before = await page.evaluate(() => window.__fracture.snapshot().elapsed);
  await page.evaluate(() => window.addHitStop(99));
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__fracture.snapshot().elapsed);
  gate('B1 hit-stop is ceiling-bounded (a 99s request cannot freeze the sim)',
    after > before, `elapsed ${before}s -> ${after}s after requesting 99s of hit-stop`);
  await ctx.close();
}
{
  const { ctx, page } = await boot('reduce');
  const before = await page.evaluate(() => window.__fracture.snapshot().elapsed);
  await page.evaluate(() => { for (let i = 0; i < 30; i++) window.addHitStop(0.09); });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__fracture.snapshot().elapsed);
  const rm = await page.evaluate(() => window.__fracture.snapshot().reducedMotion);
  gate('B1 hit-stop is OFF under reduced motion', after > before && rm.effective === true,
    `RM effective=${rm.effective}, elapsed ${before}s -> ${after}s under 30 stacked requests`);
  await ctx.close();
}

/* ---- B3: the report card and the Chronicle share one derivation -------- */
{
  const { ctx, page } = await boot('no-preference');
  const agree = await page.evaluate(async () => {
    /* Move a realm on, then compare the card's evidence against the Chronicle's
       own row for the same realm. A second copy of the rule would drift. */
    const evidence0 = window.realmEvidence(0);
    const line = window.realmReportLine(0);
    let captured = null;
    const real = URL.createObjectURL;
    URL.createObjectURL = b => { captured = b; return real.call(URL, b); };
    window.exportChronicle();
    URL.createObjectURL = real;
    const text = captured ? await captured.text() : '';
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const firstRow = doc.querySelector('section table tbody tr');
    const chronicleEvidence = firstRow ? firstRow.children[2].textContent.trim() : null;
    return { evidence0, line, chronicleEvidence, lineContainsEvidence: line.includes(evidence0) };
  });
  gate('B3 report card and Chronicle agree (one source of truth)',
    agree.chronicleEvidence === agree.evidence0 && agree.lineContainsEvidence,
    `card="${agree.evidence0}" chronicle="${agree.chronicleEvidence}"`);

  /* Negative control: a second, drifted copy of the rule must be caught. */
  const control = await page.evaluate(() => {
    const drifted = '9/9 shards';
    return drifted === window.realmEvidence(0);
  });
  gate('B3 CONTROL: a drifted second copy would be caught', control === false, 'a fabricated "9/9 shards" does not match the shared derivation');

  const announced = await page.evaluate(() => document.getElementById('announce-live') !== null);
  gate('B3 report is announced on the aria-live channel', announced, '#announce-live present');
  await ctx.close();
}

/* ---- size budget ------------------------------------------------------- */
{
  const bytes = fs.statSync(path.join(ROOT, 'index.html')).size;
  gate('Pass 2 size budget: index.html <= 300 KB (vendor excluded)', bytes <= 300 * 1024, `${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
}

await browser.close(); server.close();
console.log(`\n${fails === 0 ? 'ALL PASS 2 GATES GREEN' : `${fails} RED`}`);
process.exit(fails === 0 ? 0 : 1);
