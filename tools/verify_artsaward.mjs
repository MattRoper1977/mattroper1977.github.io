/*
 * Arts Award Evidence Studio — landing gates.
 *
 * The gate that matters is §4, the print gate. v4.1.0 rendered 12 of the
 * engine's 24 findings into the printed working record with no count and no
 * "…and 12 more": a number that read as complete while the denominator had
 * quietly shrunk. Every Gold-specific finding was in the dropped half.
 *
 * So this file does not assert "the print looks right". It asserts
 *
 *     findings rendered into the print  ==  findings the engine produced
 *
 * and then it proves that assertion can fail, by reinstating slice(0, 12) in a
 * scratch copy and demanding the gate go red at 12/24. A gate that cannot fail
 * proves nothing — which is exactly how the truncation survived a release.
 *
 * Usage:  node tools/verify_artsaward.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = 'artsaward/index.html';
const SETTLE_MS = 900;
const NAV_MS = 45000;

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  (ok ? pass++ : fail++);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};
const inconclusive = m => { console.error(`\nINCONCLUSIVE: ${m}`); process.exit(2); };

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) { console.log(`playwright: ${spec}\n`); break; }
  } catch (e) { /* next */ }
}
if (!chromium) inconclusive('playwright is not importable, so nothing could be rendered.');

/* ---------- a static server rooted at the repo, so /hud.js resolves ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
function serve(root) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return s;
}

/*
 * Count the findings actually rendered into the printed locator.
 *
 * Scoped to the "Automated pre-flight findings" section, not to every <li> in
 * the document — a whole-document count would be a proxy, and a proxy is what
 * let this defect through the first time. The section is located by its own
 * heading, and the count is taken from the <ul> that follows it.
 */
const COUNT_PRINTED = `(html) => {
  const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  const heads = [...doc.querySelectorAll('h2')].filter(h => /Automated pre-flight findings/i.test(h.textContent));
  if (!heads.length) return { found: false, count: 0, stated: null };
  let el = heads[0].nextElementSibling, ul = null, stated = null;
  while (el && !ul) {
    if (el.tagName === 'UL') ul = el;
    else { const inner = el.querySelector && el.querySelector('ul'); if (inner) ul = inner; }
    if (el.querySelector) {
      const c = el.querySelector('.findings-count');
      if (c && stated === null) { const m = c.textContent.match(/(\\d+)\\s+finding/); if (m) stated = Number(m[1]); }
    }
    el = el.nextElementSibling;
  }
  return { found: true, count: ul ? ul.querySelectorAll(':scope > li').length : 0, stated };
}`;

async function bootDemo(page, origin, opts = {}) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(origin + '/artsaward/', { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForFunction(() => !!window.AAES, { timeout: NAV_MS });
  await page.waitForTimeout(SETTLE_MS);
  if (opts.demo !== false) {
    await page.evaluate(async () => { await window.AAES.loadDemo(); });
    await page.waitForTimeout(SETTLE_MS);
  }
  return errors;
}

/* Pick the Gold demo candidate — the one whose findings the truncation hid. */
const PICK_GOLD = `() => {
  const s = window.AAES.getState();
  const c = (s.candidates || []).find(x => String(x.level).toLowerCase() === 'gold')
         || (s.candidates || []).find(x => /gold/i.test(x.id || ''));
  return c ? c.id : null;
}`;

async function measure(page, candidateId) {
  return page.evaluate(([id, counter]) => {
    const s = window.AAES.getState();
    const c = (s.candidates || []).find(x => x.id === id);
    const risk = window.AAES.evaluateCandidateModerationRisk(c);
    const html = window.AAES.buildLocatorDocument(c, { includeDob: true, forPrint: true, includeLogs: true });
    const printed = new Function('return ' + counter)()(html);
    return { engine: risk.issues.length, printed: printed.count, stated: printed.stated,
      sectionFound: printed.found, codes: risk.issues.map(i => i.code) };
  }, [candidateId, COUNT_PRINTED]);
}

const server = serve(ROOT);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

try {
  /* ---------------- 1. static: both inline blocks parse ---------------- */
  console.log('--- 1. source ---');
  const src = fs.readFileSync(path.join(ROOT, APP), 'utf8');
  const lines = src.split('\n');
  const opens = [], closes = [];
  lines.forEach((l, i) => {
    if (/^\s*<script>\s*$/.test(l)) opens.push(i + 1);
    if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);
  });
  check(opens.length === 2, 'the app has exactly two inline script blocks', `found ${opens.length}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-'));
  const { execFileSync } = await import('node:child_process');
  opens.forEach((o, i) => {
    const close = closes.find(c => c > o);
    const body = lines.slice(o, close - 1).join('\n');
    const f = path.join(tmp, `block${i + 1}.js`);
    fs.writeFileSync(f, body);
    let ok = true, err = '';
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { ok = false; err = String(e.stderr || e).split('\n').slice(0, 2).join(' ').slice(0, 120); }
    check(ok, `inline script block ${i + 1} passes node --check`, ok ? `${close - 1 - o} lines` : err);
  });
  check(/id="hud-[a-z]|hud\.js/.test(src), 'the app references the estate /hud.js loader');
  check(/mbm_splash_artsaward/.test(src), 'the app carries the house splash key mbm_splash_artsaward');

  /* ---------------- 2. boot ---------------- */
  console.log('\n--- 2. boot ---');
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await ctx.newPage();
  let errors = await bootDemo(page, origin, { demo: false });
  check(errors.length === 0, 'boots with zero console errors', errors.slice(0, 2).join(' | ') || 'none');
  const version = await page.evaluate(() => window.AAES.version);
  check(String(version) === '4.1.1', 'reports version 4.1.1', String(version));

  /* ---------------- 3. demo seeds five candidates ---------------- */
  console.log('\n--- 3. demo data ---');
  await page.evaluate(async () => { await window.AAES.loadDemo(); });
  await page.waitForTimeout(SETTLE_MS);
  const levels = await page.evaluate(() => {
    const s = window.AAES.getState();
    return (s.candidates || []).map(c => String(c.level));
  });
  check(levels.length === 5, 'demo seeds exactly five candidates', `${levels.length}: ${levels.join(', ')}`);
  const want = ['discover', 'explore', 'bronze', 'silver', 'gold'];
  check(want.every(w => levels.some(l => l.toLowerCase() === w)),
    'demo spans Discover → Gold', levels.join(', '));

  /* ---------------- 4. THE PRINT GATE ---------------- */
  console.log('\n--- 4. print gate: printed findings == engine findings ---');
  const goldId = await page.evaluate(new Function('return ' + PICK_GOLD)());
  check(!!goldId, 'a Gold demo candidate exists', String(goldId));
  const m = await measure(page, goldId);
  check(m.sectionFound, 'the printed record has an "Automated pre-flight findings" section');
  check(m.engine > 0, 'the engine produces findings for the Gold candidate', `engine=${m.engine}`);
  check(m.printed === m.engine,
    'printed findings == engine findings (no silent truncation)',
    `engine=${m.engine} printed=${m.printed}`);
  check(m.stated === m.engine,
    'the printed record states its own count, and it matches',
    `stated=${m.stated} engine=${m.engine}`);
  const goldCodes = m.codes.filter(c => /^gold_/.test(c));
  check(goldCodes.length > 0, 'Gold-specific findings are present in the engine output',
    `${goldCodes.length}: ${goldCodes.join(', ')}`);
  const printedHtml = await page.evaluate(id => {
    const c = window.AAES.getState().candidates.find(x => x.id === id);
    return window.AAES.buildLocatorDocument(c, { includeDob: true, forPrint: true, includeLogs: true });
  }, goldId);
  check(/Authenticity · Sufficiency · Relevance · Currency/.test(printedHtml),
    'ASRC is expanded in the printed record, not left as an unglossed initialism');
  await ctx.close();

  /* ------- 4b. POSITIVE CONTROL: reinstate slice(0,12), demand red ------- */
  console.log('\n--- 4b. positive control: the print gate must be able to fail ---');
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-scratch-'));
  fs.mkdirSync(path.join(scratchRoot, 'artsaward'), { recursive: true });
  if (fs.existsSync(path.join(ROOT, 'hud.js'))) {
    fs.copyFileSync(path.join(ROOT, 'hud.js'), path.join(scratchRoot, 'hud.js'));
  }
  const NEEDLE = 'const riskItems = risk.issues.map(';
  const BROKEN = 'const riskItems = risk.issues.slice(0, 12).map(';
  check(src.includes(NEEDLE), 'the shipped build maps risk.issues with no slice', NEEDLE.trim());
  const brokenSrc = src.replace(NEEDLE, BROKEN);
  check(brokenSrc !== src, 'the scratch copy differs from the shipped build');
  fs.writeFileSync(path.join(scratchRoot, 'artsaward', 'index.html'), brokenSrc);

  const s2 = serve(scratchRoot);
  await new Promise(r => s2.listen(0, '127.0.0.1', r));
  const origin2 = `http://127.0.0.1:${s2.address().port}`;
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  await bootDemo(page, origin2);
  const gid2 = await page.evaluate(new Function('return ' + PICK_GOLD)());
  const m2 = await measure(page, gid2);
  console.log(`      scratch copy measures engine=${m2.engine} printed=${m2.printed} stated=${m2.stated}`);
  check(m2.printed !== m2.engine,
    'CONTROL: with slice(0,12) reinstated, printed != engine — the gate goes red',
    `engine=${m2.engine} printed=${m2.printed}`);
  check(m2.printed === 12 && m2.engine === 24,
    'CONTROL: the failure is exactly the shipped-in-v4.1.0 defect, 12 of 24',
    `${m2.printed}/${m2.engine}`);
  await ctx.close();
  s2.close();

  /* --- reverse-apply byte identity: undo the edit, expect the input back --- */
  const restored = brokenSrc.replace(BROKEN, NEEDLE);
  const { createHash } = await import('node:crypto');
  const h = x => createHash('sha256').update(x).digest('hex');
  check(h(restored) === h(src),
    'reverse-apply: undoing the control edit returns the file byte-for-byte',
    `${h(restored).slice(0, 16)} vs ${h(src).slice(0, 16)}`);

  /* ---------------- 5. splash once per session ---------------- */
  console.log('\n--- 5. house splash ---');
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  await page.goto(origin + '/artsaward/', { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForTimeout(400);
  const splash1 = await page.evaluate(() =>
    !!document.querySelector('.mbm-splash, #mbm-splash, [data-mbm-splash]'));
  check(splash1, 'the splash renders on a first visit in a fresh session');
  await page.waitForTimeout(2600);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForTimeout(500);
  const splash2 = await page.evaluate(() => {
    const e = document.querySelector('.mbm-splash, #mbm-splash, [data-mbm-splash]');
    return !!e && e.offsetParent !== null;
  });
  const flag = await page.evaluate(() => sessionStorage.getItem('mbm_splash_artsaward'));
  check(!splash2, 'the splash does not render again on reload in the same session');
  check(!!flag, 'the once-per-session flag is stored', `mbm_splash_artsaward=${flag}`);

  /* ---------------- 6. hud chip ---------------- */
  /*
   * Asserted on the elements hud.js actually mounts, not on the <script> tag.
   * The tag is not the feature: /artsaward/ matched none of hud.js's four route
   * patterns, so BACK resolved null and mount() appended nothing - the same
   * failure hud.js's own comment records against /neonbreach/, which carried
   * the tag and rendered no HUD for months because nobody asserted the chip.
   * The control below is what makes this gate worth having: on a route hud.js
   * does not know, it must go red.
   */
  console.log('\n--- 6. estate hud ---');
  await page.waitForTimeout(1500);
  const hud = await page.evaluate(() => {
    const back = document.getElementById('mbmhud-back');
    return {
      back: !!back,
      pill: !!document.getElementById('mbmhud-pill'),
      href: back ? back.getAttribute('href') : null,
      label: back ? back.textContent.trim() : null,
    };
  });
  check(hud.back, 'the /hud.js back chip mounts on /artsaward/', `#mbmhud-back present=${hud.back}`);
  check(hud.href === '/tools/', 'the back chip resolves to the tools hub', String(hud.href));
  // The TEACH pill is Lessons-only by mount()'s `if (!IS_LESSON) return`. A tool
  // route must NOT grow one; asserting its presence here would be asserting a bug.
  check(!hud.pill, 'the Lessons-only TEACH pill correctly does not mount on a tool route',
    `#mbmhud-pill present=${hud.pill}`);
  // The homepage chip is conditional on a stored choice, so it is set and re-read
  // rather than assumed either way.
  await page.evaluate(() => localStorage.setItem('mbm_audience_view', 'teachers'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForTimeout(1500);
  const homeChip = await page.evaluate(() => {
    const h = document.getElementById('mbmhud-home');
    return { present: !!h, href: h ? h.getAttribute('href') : null };
  });
  check(homeChip.present && homeChip.href === '/for/teachers/',
    'the homepage chip mounts and resolves the stored choice',
    `present=${homeChip.present} href=${homeChip.href}`);

  // CONTROL: a route hud.js has no entry for must mount nothing.
  const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cpage = await cctx.newPage();
  await cpage.goto(origin + '/404.html', { waitUntil: 'domcontentloaded', timeout: NAV_MS })
    .catch(() => {});
  await cpage.addScriptTag({ url: '/hud.js' }).catch(() => {});
  await cpage.waitForTimeout(1200);
  const none = await cpage.evaluate(() => !!document.getElementById('mbmhud-back'));
  check(!none, 'CONTROL: on a route hud.js does not know, no chip mounts — the gate can go red',
    `#mbmhud-back present=${none}`);
  await cctx.close();

  /* ---------------- 7. A4 locator print ---------------- */
  console.log('\n--- 7. A4 locator print ---');
  await page.evaluate(async () => { await window.AAES.loadDemo(); });
  await page.waitForTimeout(SETTLE_MS);
  const gid3 = await page.evaluate(new Function('return ' + PICK_GOLD)());
  const doc = await page.evaluate(id => {
    const c = window.AAES.getState().candidates.find(x => x.id === id);
    return window.AAES.buildLocatorDocument(c, { includeDob: true, forPrint: true, includeLogs: true });
  }, gid3);
  const pctx = await browser.newContext();
  const ppage = await pctx.newPage();
  const perrs = [];
  ppage.on('pageerror', e => perrs.push(String(e)));
  await ppage.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><main>${doc}</main></body></html>`,
    { waitUntil: 'domcontentloaded' });
  const pdf = await ppage.pdf({ format: 'A4', printBackground: true });
  check(pdf.length > 1000, 'the A4 locator renders to a PDF', `${pdf.length} bytes`);
  check(perrs.length === 0, 'the locator document raises no page errors', perrs.slice(0, 2).join(' | ') || 'none');
  const overflow = await ppage.evaluate(() => {
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  check(overflow.scrollW <= overflow.clientW + 1,
    'the locator does not overflow horizontally', `scrollW=${overflow.scrollW} clientW=${overflow.clientW}`);
  await pctx.close();
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
