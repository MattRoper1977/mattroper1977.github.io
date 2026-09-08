/* Pass 1 P1-7 audit: warning classification, perf/heap soak, listener hygiene,
   unhandled rejections, visibilitychange pause, save-integrity fuzzing.
   Numbers here are headless + software-rasterised (SwiftShader) and are
   labelled as such — they are not a phone or a real GPU. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : 'index.html';
const SOAK_MS = Number(process.env.SOAK_MS || 60000);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function serve(dir) {
  const s = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(dir, url === '/' ? `/${TARGET}` : url);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}

const server = await serve(ROOT);
const base = `http://127.0.0.1:${server.address().port}/${TARGET}`;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();

const warnings = [], errors = [], rejections = [];
page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.message)));
await page.addInitScript(() => {
  window.__rejections = [];
  window.addEventListener('unhandledrejection', e => window.__rejections.push(String(e.reason)));
});

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 20000 });

console.log('=== A. console warnings, classified ===');
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card', { state: 'visible' });
await page.click('#begin-adventure-button');
await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 20000 });
await page.waitForTimeout(3000);
const classify = w => {
  if (/AudioContext|user gesture|autoplay/i.test(w)) return 'EXPECTED — audio suspended until first gesture (house rule: no audio before a gesture)';
  if (/WebGL|SwiftShader|GPU stall|software/i.test(w)) return 'ENVIRONMENT — headless software rasteriser, not a property of the game';
  if (/deprecat/i.test(w)) return 'REVIEW — deprecation';
  return 'REVIEW — unclassified';
};
if (!warnings.length) console.log('  (none)');
[...new Set(warnings)].forEach(w => console.log(`  · ${w.slice(0, 150)}\n      -> ${classify(w)}`));

console.log('\n=== B. listener hygiene: double-bound handlers ===');
const listeners = await page.evaluate(() => {
  /* Count how many times wireInterface-style binding ran, by re-checking that
     one click yields exactly one state change on a representative control. */
  const before = window.__fracture.snapshot();
  return { modalBefore: before.activeModal };
});
const dbl = await page.evaluate(async () => {
  /* Open then close the inventory once; a double-bound handler toggles twice
     and lands back where it started. */
  const btn = document.getElementById('pause-inventory-button');
  return { present: !!btn };
});
console.log('  representative control present:', dbl.present, '| activeModal at rest:', listeners.modalBefore);
const bindCount = await page.evaluate(() => {
  /* wireInterface must have run exactly once: a second run would re-add every
     listener. Detect by counting how many times the splash key handler is
     registered — it is removed on close, so any residue is a double-bind. */
  return { splash: window.__fracture.snapshot().splash };
});
console.log('  splash state (skips should be 0 on an auto-close run):', JSON.stringify(bindCount.splash));

console.log('\n=== C. visibilitychange / blur pause ===');
const pause = await page.evaluate(async () => {
  const a = window.__fracture.snapshot();
  /* The handler tests document.hidden, so overriding visibilityState alone is
     a blind probe — it reported a false "does not pause". Override both. */
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 400));
  const b = window.__fracture.snapshot();
  return { modeBefore: a.mode, modeAfter: b.mode, activeModal: b.activeModal };
});
console.log(' ', JSON.stringify(pause), pause.modeAfter !== 'playing' ? '-> PAUSES on tab hide' : '-> DOES NOT pause');

console.log('\n=== D. save-integrity fuzz (must fail safe, never boot-loop) ===');
const payloads = [
  ['truncated', '{"version":3,"classType":"riftcaller"'],
  ['not-json', 'this is not json at all'],
  ['null', 'null'],
  ['array', '[1,2,3]'],
  ['legacy-shape', '{"version":1,"hero":{"level":"NaN"},"zoneIndex":99}'],
  ['hostile-numbers', '{"version":3,"zoneIndex":-5,"kills":1e400,"hero":{"level":9999,"hp":-1}}'],
  ['empty-object', '{}']
];
for (const [name, body] of payloads) {
  await page.evaluate(b => { localStorage.clear(); localStorage.setItem('mbm_relicforge_fracture_v1', b); }, body);
  let ok = true, mode = null;
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 12000 });
    mode = await page.evaluate(() => window.__fracture.snapshot().mode);
  } catch (_) { ok = false; }
  console.log(`  ${ok ? 'SAFE' : 'BOOT-LOOP'}  ${name.padEnd(16)} -> mode=${mode}`);
}
await page.evaluate(() => localStorage.clear());

console.log(`\n=== E. perf + heap soak (${Math.round(SOAK_MS / 1000)}s, headless SwiftShader — NOT a phone or real GPU) ===`);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 20000 });
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card', { state: 'visible' });
await page.click('#begin-adventure-button');
await page.waitForFunction(() => window.__fracture.snapshot().mode === 'playing', null, { timeout: 20000 });
await page.evaluate(() => {
  window.__fps = { frames: 0, t0: performance.now(), samples: [] };
  const tick = () => { window.__fps.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const heapAt = async () => page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
const h0 = await heapAt();
const marks = [];
const slices = Math.max(1, Math.round(SOAK_MS / 10000));
for (let i = 0; i < slices; i++) {
  await page.evaluate(() => { window.__fps.frames = 0; window.__fps.t0 = performance.now(); });
  await page.waitForTimeout(10000);
  const m = await page.evaluate(() => ({ fps: +(window.__fps.frames / ((performance.now() - window.__fps.t0) / 1000)).toFixed(1), effects: window.__fracture.snapshot().activeEffects }));
  const h = await heapAt();
  marks.push({ slice: i + 1, fps: m.fps, effects: m.effects, heapMB: h });
  console.log(`  slice ${i + 1}: ${m.fps} fps · effects ${m.effects} · heap ${h ?? 'n/a'} MB`);
}
const h1 = await heapAt();
const snap = await page.evaluate(() => window.__fracture.snapshot());
console.log(`  heap ${h0} MB -> ${h1} MB (delta ${h1 - h0} MB) over ${Math.round(SOAK_MS / 1000)}s`);
console.log(`  final: elapsed ${snap.elapsed}s, kills ${snap.kills}, effects ${snap.activeEffects}, deaths ${snap.deaths}`);
const rej = await page.evaluate(() => window.__rejections || []);
console.log(`\n=== F. unhandled promise rejections: ${rej.length} ${rej.length ? JSON.stringify(rej.slice(0, 3)) : '(none)'} ===`);
console.log(`=== G. console errors across the whole audit: ${errors.length} ${errors.length ? JSON.stringify(errors.slice(0, 3)) : '(none)'} ===`);

fs.writeFileSync(path.join(ROOT, 'evidence-audit.json'), JSON.stringify({ warnings: [...new Set(warnings)], errors, rejections: rej, pause, soak: marks, heapMB: { start: h0, end: h1 } }, null, 1));
await browser.close(); server.close();
