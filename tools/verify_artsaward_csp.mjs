/*
 * /artsaward/ — connect-src 'none', proven in a real browser.
 *
 * The close order held this back for a reason worth restating: the policy
 * cannot be proven safe by reading it. An 809 KB single-file app with outbound
 * Trinity links needed a real browser pass, and this is that pass.
 *
 * WHAT IS ASSERTED
 *   1. the policy is present and is connect-src alone
 *   2. the app still boots clean, seeds its demo, and builds all five locators
 *   3. the A4 print path still renders
 *   4. the outbound Trinity links are intact — CSP does not govern navigation,
 *      and that is checked rather than assumed
 *   5. CONTROL: a deliberate fetch() is BLOCKED, raises a
 *      securitypolicyviolation naming connect-src, and the gate sees it
 *   6. CONTROL, other direction: with the policy stripped from a scratch copy,
 *      the identical fetch SUCCEEDS — so §5 is proving the CSP and not merely
 *      that the URL was unreachable
 *
 * §6 is the one that makes §5 mean anything. A fetch that fails for its own
 * reasons looks identical to a fetch the policy stopped, and a gate that
 * cannot tell them apart certifies nothing.
 *
 * Usage:  node tools/verify_artsaward_csp.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = 'artsaward/index.html';
const NAV_MS = 60000;

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  (ok ? pass++ : fail++);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) break;
  } catch (e) { /* next */ }
}
if (!chromium) {
  console.error('INCONCLUSIVE: playwright is not importable, so no browser pass happened.');
  console.error('Per the ruling, connect-src must NOT ship without one.');
  process.exit(2);
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
function serve(root) {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    // A real endpoint for the control to aim at, so a blocked fetch and a
    // missing endpoint cannot be confused.
    if (p === '/__csp_probe') {
      res.writeHead(200, { 'content-type': 'text/plain' }); res.end('reachable'); return;
    }
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('nf'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  return s;
}

/* Attempt a same-origin fetch and report exactly how it ended. */
const TRY_FETCH = `async () => {
  const out = { ok: false, err: null, violation: null };
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', e => {
    window.__cspViolations.push({ directive: e.violatedDirective, uri: e.blockedURI });
  });
  try {
    const r = await fetch('/__csp_probe', { cache: 'no-store' });
    out.ok = r.ok;
  } catch (e) { out.err = String(e.message || e).slice(0, 80); }
  await new Promise(r => setTimeout(r, 200));
  out.violation = window.__cspViolations[0] || null;
  return out;
}`;

const server = serve(ROOT);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

try {
  const src = fs.readFileSync(path.join(ROOT, APP), 'utf8');

  /* ---------------- 1. the policy ---------------- */
  console.log('--- 1. the policy as shipped ---');
  const csp = (src.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
  check(/connect-src\s+'none'/.test(csp), "the CSP declares connect-src 'none'", csp || 'no CSP found');
  check(!/default-src/.test(csp),
    'it is connect-src ALONE — no default-src, so inline script/style and navigation are untouched',
    csp);
  /*
   * Counted over CODE, not prose. The first version of this scan counted the
   * raw file and reported fetch(=1 XMLHttpRequest=1 EventSource=2 — every one
   * of them inside the CSP comment directly above, which names the APIs the
   * policy blocks. The gate was reading its own documentation as evidence
   * against the app. HTML comments are stripped first so the assertion means
   * what it says.
   */
  const code = src.replace(/<!--[\s\S]*?-->/g, '');
  const netApis = ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'EventSource', 'new WebSocket', 'import(']
    .map(p => [p, (code.split(p).length - 1)]);
  check(netApis.every(([, n]) => n === 0),
    'the app itself calls no network API, so the policy forbids nothing it uses',
    netApis.map(([p, n]) => `${p}=${n}`).join(' ') + ' (HTML comments excluded)');
  // The strip must not be a blanket amnesty: prove it removed comments only.
  check(code.length < src.length && code.includes('window.AAES'),
    'the comment strip removed prose and left the code intact',
    `${Buffer.byteLength(src)} B -> ${Buffer.byteLength(code)} B`);

  /* ---------------- 2. it still works ---------------- */
  console.log('\n--- 2. the app under the policy ---');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], violations = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__earlyViolations = [];
    document.addEventListener('securitypolicyviolation', e =>
      window.__earlyViolations.push(e.violatedDirective + ' ' + e.blockedURI));
  });
  await page.goto(origin + '/artsaward/', { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForFunction(() => !!window.AAES, { timeout: NAV_MS });
  await page.waitForTimeout(1500);
  check(errors.length === 0, 'boots with zero console errors', errors.slice(0, 2).join(' | ') || 'none');

  await page.evaluate(async () => { await window.AAES.loadDemo(); });
  await page.waitForTimeout(1500);
  const seeded = await page.evaluate(() => window.AAES.getState().candidates.map(c => String(c.level)));
  check(seeded.length === 5, 'the demo still seeds five candidates', `${seeded.length}: ${seeded.join(', ')}`);

  const locators = await page.evaluate(() => {
    const s = window.AAES.getState();
    const out = {};
    for (const c of s.candidates) {
      const d = window.AAES.buildLocatorDocument(c, { includeDob: true, forPrint: true, includeLogs: true });
      out[c.level] = (d || '').length;
    }
    return out;
  });
  const built = Object.values(locators).filter(n => n > 500).length;
  check(built === 5, 'all five locators still build',
    Object.entries(locators).map(([k, v]) => `${k}:${v}`).join(' '));

  const gold = await page.evaluate(() => {
    const s = window.AAES.getState();
    const g = s.candidates.find(c => String(c.level).toLowerCase() === 'gold');
    return window.AAES.evaluateCandidateModerationRisk(g).issues.length;
  });
  check(gold === 24, 'the engine still produces 24 findings for the Gold candidate', String(gold));

  const early = await page.evaluate(() => window.__earlyViolations || []);
  check(early.length === 0,
    'the policy blocks nothing during normal boot and demo seed',
    early.length ? early.slice(0, 3).join(' | ') : 'zero securitypolicyviolation events');

  /* ---------------- 3. print ---------------- */
  console.log('\n--- 3. the A4 print path ---');
  const doc = await page.evaluate(() => {
    const s = window.AAES.getState();
    const g = s.candidates.find(c => String(c.level).toLowerCase() === 'gold');
    return window.AAES.buildLocatorDocument(g, { includeDob: true, forPrint: true, includeLogs: true });
  });
  const pctx = await browser.newContext();
  const ppage = await pctx.newPage();
  const perrs = [];
  ppage.on('pageerror', e => perrs.push(String(e)));
  await ppage.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body><main>${doc}</main></body></html>`,
    { waitUntil: 'domcontentloaded' });
  const pdf = await ppage.pdf({ format: 'A4', printBackground: true });
  check(pdf.length > 1000, 'the A4 locator still renders to a PDF', `${pdf.length} bytes`);
  check(perrs.length === 0, 'the locator document raises no page errors', perrs.slice(0, 2).join(' | ') || 'none');
  await pctx.close();

  /* ---------------- 4. outbound Trinity links ---------------- */
  console.log('\n--- 4. outbound Trinity links (navigation is not a fetch) ---');
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="https://"]')]
      .map(a => a.getAttribute('href'))
      .filter(h => /trinitycollege\.com/i.test(h)));
  check(links.length > 0, 'the Trinity resource links are present in the DOM', `${links.length} link(s)`);
  check(links.every(h => /^https:\/\/www\.trinitycollege\.com\//.test(h)),
    'each resolves to the expected external origin',
    [...new Set(links)].map(h => h.replace('https://www.trinitycollege.com', '…')).slice(0, 2).join(' '));
  const navBlocked = await page.evaluate(() => (window.__earlyViolations || [])
    .filter(v => /trinitycollege/i.test(v)).length);
  check(navBlocked === 0, 'no policy violation is raised against them', `${navBlocked} violations naming trinitycollege`);

  /* ---------------- 5. CONTROL: a deliberate fetch must be blocked ------- */
  console.log('\n--- 5. CONTROL: a deliberate fetch() must be BLOCKED ---');
  const blocked = await page.evaluate(new Function('return ' + TRY_FETCH)());
  check(!blocked.ok, 'CONTROL: fetch("/__csp_probe") does not succeed', `ok=${blocked.ok} err=${blocked.err}`);
  check(!!blocked.violation && /connect-src/.test(blocked.violation.directive || ''),
    'CONTROL: it raises a securitypolicyviolation naming connect-src',
    blocked.violation ? `${blocked.violation.directive} blocked ${blocked.violation.uri}` : 'no violation event');
  await ctx.close();

  /* ---------------- 6. CONTROL: without the policy it succeeds ----------- */
  console.log('\n--- 6. CONTROL, other direction: strip the policy and the SAME fetch succeeds ---');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aacsp-'));
  fs.mkdirSync(path.join(scratch, 'artsaward'), { recursive: true });
  if (fs.existsSync(path.join(ROOT, 'hud.js'))) fs.copyFileSync(path.join(ROOT, 'hud.js'), path.join(scratch, 'hud.js'));
  const CSP_TAG = /\s*<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
  check(CSP_TAG.test(src), 'the policy tag is locatable for the control');
  const stripped = src.replace(CSP_TAG, '');
  check(stripped !== src, 'the scratch copy differs from the shipped build',
    `${Buffer.byteLength(src)} B -> ${Buffer.byteLength(stripped)} B`);
  fs.writeFileSync(path.join(scratch, 'artsaward', 'index.html'), stripped);

  const s2 = serve(scratch);
  await new Promise(r => s2.listen(0, '127.0.0.1', r));
  const origin2 = `http://127.0.0.1:${s2.address().port}`;
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(origin2 + '/artsaward/', { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page2.waitForTimeout(1200);
  const allowed = await page2.evaluate(new Function('return ' + TRY_FETCH)());
  check(allowed.ok === true,
    'CONTROL: with connect-src removed, the identical fetch SUCCEEDS — so §5 proved the policy, not an unreachable URL',
    `ok=${allowed.ok} err=${allowed.err}`);
  check(!allowed.violation, 'CONTROL: and raises no violation', allowed.violation ? JSON.stringify(allowed.violation) : 'none');
  await ctx2.close();
  s2.close();

  /* reverse-apply */
  const { createHash } = await import('node:crypto');
  const h = x => createHash('sha256').update(x).digest('hex');
  check(h(stripped) !== h(src), 'the control edit is real, not a no-op');
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
