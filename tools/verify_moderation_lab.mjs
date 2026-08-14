/*
 * ASDAN Moderation Lab — landing gates.
 *
 * Pack integrity is NOT asserted here. It has its own instrument,
 * tools/verify_pack_index.mjs, with its control in
 * tools/verify_pack_index_control.sh. Both must be run; this file covers
 * everything else the landing was ordered to prove.
 *
 * G1 is the gate with the most weight after pack integrity. v5.1 hashed a
 * payload that included the print timestamp at millisecond precision, so the
 * verification stamp was different on every print and NO MODERATOR COULD EVER
 * RE-DERIVE IT - a verification code that cannot be verified. v5.2 splits it:
 * EV- excludes the timestamp and is reproducible, MOD- includes it and
 * identifies one printed copy. §4 proves that with three hashes - unchanged,
 * edited, restored - because "it is stable" and "it is a constant" look
 * identical from one measurement. The restore leg is what tells them apart.
 *
 * Usage:  node tools/verify_moderation_lab.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = 'asdan/moderation-lab/index.html';
const ROUTE = '/asdan/moderation-lab/';
const NAV_MS = 45000;
const VIEWS = ['today', 'pupils', 'programmes', 'track', 'evidence',
  'readiness', 'matrix', 'iv', 'print', 'settings'];

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
if (!chromium) { console.error('INCONCLUSIVE: playwright is not importable.'); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.pdf': 'application/pdf' };
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
const browser = await chromium.launch();

async function boot() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(origin + ROUTE, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForFunction(() => !!window.ASDAN_TEST, { timeout: NAV_MS });
  await page.waitForTimeout(1200);
  return { ctx, page, errors };
}

try {
  const src = fs.readFileSync(path.join(ROOT, APP), 'utf8');

  /* ---------------- 1. placement ---------------- */
  console.log('--- 1. placement ---');
  check(fs.existsSync(path.join(ROOT, APP)), 'the Lab lands at one path', ROUTE);
  check(!fs.existsSync(path.join(ROOT, 'asdan', 'lab.html')),
    'the superseded asdan/lab.html is not present — one copy, not two',
    'two copies would mean two IndexedDB origins holding divergent portfolios');
  const appSha = execFileSync('sha256sum', [path.join(ROOT, 'asdan/app.html')], { encoding: 'utf8' }).split(' ')[0];
  check(appSha === 'e92239177d068140c2d31d73b4048e6b82c54b63b9b461e31576580da1a1985d',
    'asdan/app.html is untouched by this landing', appSha.slice(0, 24) + '…');
  check(/v5\.2 · Made by Matt/.test(src), 'the build identifies as v5.2');

  /* ---------------- 2. the five grafts ---------------- */
  console.log('\n--- 2. the five grafts, each asserted in the landed file ---');
  check(/contentStamp:`EV-\$\{contentDigest/.test(src) && /stamp:`MOD-\$\{digest/.test(src),
    'G1: the verification hash is split into EV- (reproducible) and MOD- (per copy)');
  check(/verificationPayload\(program,pupil,audit,null\)/.test(src),
    'G1: the EV- payload is built with generatedAt passed as null');
  check(/if\(S\.demo\)currentPrintVerification=[\s\S]{0,120}DEMONSTRATION DATA · NOT FOR SUBMISSION/.test(src),
    'G2: the demo watermark is gated on S.demo');
  const blank = (src.match(/function blankState\(\)[\s\S]{0,600}?\n\}/) || [''])[0];
  check(/centre:\{name:"",number:"",school:"",academicYear:"[^"]*",assessorName:"",assessorInitials:"",ivName:"",ivSignature:""\}/.test(blank),
    'G3: blankState() ships no centre defaults — every field empty');
  check(/if\(S\.demo\)await ensureDemoAsset\(\);/.test(src),
    'G4: the boot path calls ensureDemoAsset() only when S.demo — deleted data stays deleted');
  check(/rawBytes>25\*1024\*1024/.test(src),
    'G5: the full backup carries a size guard before building data-URLs in memory');
  check(/Stratified risk-based \(candidate \+ assessor coverage\)/.test(src),
    'copy: the sampling method reads as candidate + assessor coverage');
  /*
   * CAMERA must not reach a moderator. It survives in two source comments,
   * which no user sees; the assertion is therefore that every remaining
   * occurrence sits on a comment line, not that the string is gone. Asserting
   * absence outright would fail on a build whose user-facing copy is correct,
   * and would push the next person to "fix" a comment instead of the label.
   */
  const cameraLines = src.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\bCAMERA\b/.test(l));
  const nonComment = cameraLines.filter(([, l]) => !/^\s*(\/\*|\/\/|\*)/.test(l.trim()));
  check(nonComment.length === 0,
    'copy: CAMERA appears nowhere a moderator can see it',
    `${cameraLines.length} occurrence(s), all in source comments` +
    (nonComment.length ? ` — USER-FACING at line(s) ${nonComment.map(([n]) => n).join(', ')}` : ''));
  check(/does not encode/.test(src),
    "copy: the page says plainly it does not encode ASDAN's published requirements");

  /* ---------------- 3. source ---------------- */
  console.log('\n--- 3. source ---');
  const lines = src.split('\n');
  const opens = [], closes = [];
  lines.forEach((l, i) => {
    if (/^\s*<script>\s*$/.test(l)) opens.push(i + 1);
    if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);
  });
  check(opens.length === 2, 'the app has exactly two inline script blocks', `found ${opens.length}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-'));
  opens.forEach((o, i) => {
    const close = closes.find(c => c > o);
    const f = path.join(tmp, `block${i + 1}.js`);
    fs.writeFileSync(f, lines.slice(o, close - 1).join('\n'));
    let ok = true, err = '';
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { ok = false; err = String(e.stderr || e).split('\n').slice(0, 2).join(' ').slice(0, 120); }
    check(ok, `inline script block ${i + 1} passes node --check`, ok ? `${close - 1 - o} lines` : err);
  });

  /* ---------------- 4. boot and ten views ---------------- */
  console.log('\n--- 4. boot and views ---');
  let { ctx, page, errors } = await boot();
  check(errors.length === 0, 'boots with zero console errors', errors.slice(0, 2).join(' | ') || 'none');

  let rendered = 0;
  const empty = [];
  for (const v of VIEWS) {
    const ok = await page.evaluate(async name => {
      const btn = document.querySelector(`[data-view="${name}"]`);
      if (!btn) return { clicked: false };
      btn.click();
      await new Promise(r => setTimeout(r, 220));
      const panel = document.querySelector(`#view-${name}, [data-view-panel="${name}"], .view.active, main`);
      const text = (panel ? panel.innerText : '').trim();
      return { clicked: true, nodes: panel ? panel.querySelectorAll('*').length : 0, chars: text.length };
    }, v);
    const good = ok.clicked && ok.nodes > 5 && ok.chars > 20;
    if (good) rendered++; else empty.push(`${v}(${ok.nodes || 0}n/${ok.chars || 0}c)`);
  }
  check(rendered === VIEWS.length, `all ${VIEWS.length} views render with content`,
    rendered === VIEWS.length ? `${rendered}/${VIEWS.length}` : `${rendered}/${VIEWS.length} — thin: ${empty.join(', ')}`);

  /* ---------------- 5. G1: three hashes ---------------- */
  console.log('\n--- 5. G1: the evidence fingerprint, proven by three hashes ---');
  const stamps = await page.evaluate(async () => {
    const T = window.ASDAN_TEST, S = T.state;
    const prog = S.programmes[0];
    const pup = S.pupils.find(p => S.enrolments.some(e => e.programId === prog.id && e.pupilId === p.id)) || S.pupils[0];
    const stamp = async () => {
      const audit = T.auditCandidate(prog, pup);
      const v = await T.generateVerificationStamp(prog, pup, audit);
      return { ev: v.contentStamp, mod: v.stamp };
    };
    const a = await stamp();
    const a2 = await stamp();                       // same portfolio, printed twice
    const probe = { id: 'gate-probe-ev', ref: 'GATE-EV1', pupilId: pup.id, programId: prog.id,
      targetId: '', evidenceType: 'photo', caption: 'probe', date: '2026-08-14',
      assessorInitials: 'MR', createdAt: new Date().toISOString() };
    S.evidenceLinks.push(probe);
    const b = await stamp();                        // edited
    S.evidenceLinks.splice(S.evidenceLinks.indexOf(probe), 1);
    const c = await stamp();                        // restored
    return { a, a2, b, c };
  });
  console.log(`      unchanged  EV ${stamps.a.ev}`);
  console.log(`      reprint    EV ${stamps.a2.ev}`);
  console.log(`      edited     EV ${stamps.b.ev}`);
  console.log(`      restored   EV ${stamps.c.ev}`);
  check(stamps.a.ev === stamps.a2.ev,
    'G1: EV- is stable across two prints of an unchanged portfolio — a moderator can re-derive it');
  check(stamps.a.ev !== stamps.b.ev,
    'G1: EV- moves when the portfolio is edited — it is a fingerprint, not a constant');
  check(stamps.c.ev === stamps.a.ev,
    'G1: EV- returns on restore — it tracks content, not history');
  check(stamps.a.mod !== stamps.a2.mod,
    'G1: MOD- differs between two prints of the same portfolio — it identifies one copy',
    `${stamps.a.mod} vs ${stamps.a2.mod}`);

  /* ---------------- 6. G2 on a demo print ---------------- */
  console.log('\n--- 6. G2: the demo watermark on a real print ---');
  const wm = await page.evaluate(async () => {
    const T = window.ASDAN_TEST, S = T.state;
    const prog = S.programmes[0];
    const pup = S.pupils.find(p => S.enrolments.some(e => e.programId === prog.id && e.pupilId === p.id)) || S.pupils[0];
    const wasDemo = S.demo;
    S.demo = true;
    const audit = T.auditCandidate(prog, pup);
    await T.generateVerificationStamp(prog, pup, audit);
    const idx = T.buildIndexPage(prog, pup, 7);
    const demoOn = /DEMONSTRATION DATA · NOT FOR SUBMISSION/.test(
      String(idx.body) + document.body.innerHTML);
    S.demo = wasDemo;
    return { demoOn, wasDemo };
  });
  check(wm.wasDemo === true, 'the Lab opens with demonstration data loaded', `S.demo=${wm.wasDemo}`);
  check(wm.demoOn, 'G2: a demo print carries the DEMONSTRATION DATA · NOT FOR SUBMISSION watermark');

  /* ---------------- 7. hostile pupil name ---------------- */
  console.log('\n--- 7. a hostile pupil name must inject nothing ---');
  const xss = await page.evaluate(async () => {
    const T = window.ASDAN_TEST, S = T.state;
    const prog = S.programmes[0];
    const pup = S.pupils.find(p => S.enrolments.some(e => e.programId === prog.id && e.pupilId === p.id)) || S.pupils[0];
    const before = { f: pup.forename, s: pup.surname };
    window.__xssFired = 0;
    pup.forename = '<img src=x onerror="window.__xssFired++">';
    pup.surname = '"><script>window.__xssFired++<\/script><b class="xss-probe">x</b>';
    const audit = T.auditCandidate(prog, pup);
    const idx = T.buildIndexPage(prog, pup, 7);
    const pages = await T.buildEvidencePages(prog, pup);
    // Parse the built documents exactly as a print window would.
    const host = document.createElement('div');
    host.innerHTML = String(idx.body) + pages.map(p => String(p.body)).join('');
    document.body.appendChild(host);
    await new Promise(r => setTimeout(r, 250));
    const injected = host.querySelectorAll('script, img[onerror], .xss-probe').length;
    const escapedSomewhere = /&lt;img|&lt;script|&quot;&gt;/.test(host.innerHTML);
    host.remove();
    pup.forename = before.f; pup.surname = before.s;
    return { injected, fired: window.__xssFired, escapedSomewhere };
  });
  check(xss.injected === 0, 'zero injected nodes from a hostile pupil name',
    `script/img[onerror]/.xss-probe nodes: ${xss.injected}`);
  check(xss.fired === 0, 'no injected handler executed', `fires: ${xss.fired}`);
  check(xss.escapedSomewhere, 'the hostile name is present but escaped, not stripped',
    'proves the probe reached the document rather than being silently dropped');

  /* ---------------- 8. hud ---------------- */
  console.log('\n--- 8. estate hud ---');
  await page.waitForTimeout(1200);
  const hud = await page.evaluate(() => {
    const b = document.getElementById('mbmhud-back');
    return { back: !!b, href: b ? b.getAttribute('href') : null };
  });
  check(hud.back, 'the /hud.js chip mounts', `#mbmhud-back present=${hud.back}`);
  check(hud.href === '/tools/', 'the back chip resolves to the tools hub', String(hud.href));
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
