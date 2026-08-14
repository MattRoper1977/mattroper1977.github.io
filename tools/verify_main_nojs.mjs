/*
 * /main/ — the no-JS path must be the safe path.
 *
 * The ruling: put the mailing-list link in the HTML and let
 * retireLegacyTeacherList() become a no-op, so a visitor with JavaScript off
 * gets the managed mailing route rather than a live FormSubmit opt-in.
 * Progressive enhancement means JS enhances; it never rescues.
 *
 * MEASURED AT THIS TIP, that is already the case: the .dx-teach block ships the
 * /mailing-list/ link as static markup and carries no form at all, so
 * retireLegacyTeacherList() returns at its own `if(!form)return`. The ruling's
 * premise - "the static markup carries the live <form action=formsubmit.co>" -
 * does not describe this build.
 *
 * So this file does not re-fix it. It PINS it, which is the part that was
 * actually missing: nothing asserted the no-JS path, which is exactly how a
 * runtime-only rescue survives unnoticed. The gate renders /main/ with
 * JavaScript disabled and reads what a no-JS visitor really gets, and §4 proves
 * it goes red by reinstating the legacy form.
 *
 * Scope note: the CONTACT form at the bottom of /main/ also posts to
 * formsubmit.co. That one is deliberate, is disclosed in the sentence directly
 * above it, and is explicitly out of scope for retireLegacyTeacherList ("Keep
 * the contact form untouched"). This gate is scoped to the teacher-updates
 * block so it cannot be "fixed" by breaking the contact form.
 *
 * Usage:  node tools/verify_main_nojs.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MAIN = 'main/index.html';

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
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
}

/* What a visitor gets inside the teacher-updates block, with JS on or off. */
const READ_TEACH = `() => {
  const box = document.querySelector('.dx-teach');
  if (!box) return { box: false };
  const forms = [...box.querySelectorAll('form')];
  return {
    box: true,
    forms: forms.length,
    formsubmitForms: forms.filter(f => /formsubmit\\.co/.test(f.getAttribute('action') || '')).length,
    mailingLinks: [...box.querySelectorAll('a[href="/mailing-list/"]')].length,
    emailInputs: box.querySelectorAll('input[type="email"], input[name*="mail" i]').length,
  };
}`;

async function readBlock(root, { js }) {
  const s = serve(root);
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ javaScriptEnabled: js });
  const page = await ctx.newPage();
  await page.goto(origin + '/main/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(js ? 2000 : 500);
  const out = await page.evaluate(new Function('return ' + READ_TEACH)());
  await browser.close();
  s.close();
  return out;
}

console.log('/main/ — the no-JS visitor must get the safe path, not a rescued one\n');

/* ---------------- 1. static markup ---------------- */
console.log('--- 1. static markup (what a no-JS visitor is actually sent) ---');
const src = fs.readFileSync(path.join(ROOT, MAIN), 'utf8');
const teachStart = src.indexOf('<div class="dx-teach">');
const teachEnd = src.indexOf('</div>', teachStart);
check(teachStart > -1, 'the teacher-updates block exists in the static markup');
const teachHtml = teachStart > -1 ? src.slice(teachStart, teachEnd) : '';
check(!/formsubmit\.co/.test(teachHtml),
  'the teacher-updates block carries NO formsubmit.co form in the HTML',
  /formsubmit\.co/.test(teachHtml) ? 'a legacy opt-in form is still in the markup' : 'none');
check(/href="\/mailing-list\/"/.test(teachHtml),
  'the managed /mailing-list/ link IS in the HTML, not injected at runtime');

/* retireLegacyTeacherList must have nothing to do on this markup. */
const platform = fs.readFileSync(path.join(ROOT, 'assets/mbm-platform.js'), 'utf8');
check(/function retireLegacyTeacherList\(\)/.test(platform),
  'retireLegacyTeacherList() still exists (kept as a no-op for older cached markup)');
check(/form\.dx-tform\[action\^="https:\/\/formsubmit\.co\/"\]/.test(platform),
  'it selects the legacy form specifically, so it cannot touch the contact form');
check(!/<form[^>]*dx-tform/.test(src),
  'no dx-tform element exists for it to replace — it is a no-op on this build');

/* ---------------- 2. rendered with JS OFF ---------------- */
console.log('\n--- 2. rendered with JavaScript DISABLED ---');
const noJs = await readBlock(ROOT, { js: false });
check(noJs.box, 'the teacher-updates block renders without JS');
check(noJs.formsubmitForms === 0,
  'a no-JS visitor is offered NO third-party opt-in form',
  `formsubmit forms in block: ${noJs.formsubmitForms}`);
check(noJs.mailingLinks > 0,
  'a no-JS visitor IS offered the managed mailing-list link',
  `links: ${noJs.mailingLinks}`);
check(noJs.emailInputs === 0,
  'a no-JS visitor is asked for no email address in this block',
  `email inputs: ${noJs.emailInputs}`);

/* ---------------- 3. JS on must not be doing the rescuing ---------------- */
console.log('\n--- 3. rendered with JavaScript ENABLED ---');
const withJs = await readBlock(ROOT, { js: true });
check(withJs.formsubmitForms === 0, 'still no third-party opt-in form with JS on',
  `formsubmit forms: ${withJs.formsubmitForms}`);
check(withJs.mailingLinks === noJs.mailingLinks,
  'JS adds no mailing link the no-JS visitor did not already have — it enhances, it does not rescue',
  `no-JS ${noJs.mailingLinks} vs JS ${withJs.mailingLinks}`);

/* ---------------- 4. POSITIVE CONTROL ---------------- */
console.log('\n--- 4. positive control: reinstate the legacy form, demand red ---');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'main-'));
for (const rel of ['main', 'assets', 'data']) {
  const s2 = path.join(ROOT, rel);
  if (fs.existsSync(s2)) fs.cpSync(s2, path.join(scratch, rel), { recursive: true });
}
if (fs.existsSync(path.join(ROOT, 'site.json'))) {
  fs.copyFileSync(path.join(ROOT, 'site.json'), path.join(scratch, 'site.json'));
}
const LEGACY = '<form class="dx-tform" action="https://formsubmit.co/contactmadebymatt@gmail.com" method="POST">'
  + '<input type="email" name="email" placeholder="you@school.uk" required>'
  + '<button type="submit">Send me updates</button></form>';
const ANCHOR = '<p><a class="dx-tbtn" href="/mailing-list/">Join teacher updates</a>';
const broken = src.replace(ANCHOR, LEGACY + ANCHOR);
check(broken !== src, 'CONTROL: the scratch copy differs from the shipped build');
fs.writeFileSync(path.join(scratch, MAIN), broken);

const ctlStatic = /formsubmit\.co/.test(
  broken.slice(broken.indexOf('<div class="dx-teach">'),
    broken.indexOf('</div>', broken.indexOf('<div class="dx-teach">'))));
check(ctlStatic, 'CONTROL: the static check sees the reinstated legacy form — §1 would go red');

const ctlNoJs = await readBlock(scratch, { js: false });
check(ctlNoJs.formsubmitForms > 0,
  'CONTROL: with the form reinstated, a no-JS visitor IS offered it — §2 goes red',
  `formsubmit forms: ${ctlNoJs.formsubmitForms}`);
check(ctlNoJs.emailInputs > 0,
  'CONTROL: and is asked for an email address',
  `email inputs: ${ctlNoJs.emailInputs}`);

/* And the JS path rescuing it is precisely the shape the ruling forbids. */
const ctlJs = await readBlock(scratch, { js: true });
console.log(`      with JS on, the scratch copy shows formsubmitForms=${ctlJs.formsubmitForms} ` +
  `mailingLinks=${ctlJs.mailingLinks}`);
check(ctlJs.formsubmitForms < ctlNoJs.formsubmitForms,
  'CONTROL: JS rescues the legacy form at runtime — the exact asymmetry the ruling forbids',
  `no-JS ${ctlNoJs.formsubmitForms} vs JS ${ctlJs.formsubmitForms}`);

/* reverse-apply */
const restored = broken.replace(LEGACY + ANCHOR, ANCHOR);
const { createHash } = await import('node:crypto');
const h = x => createHash('sha256').update(x).digest('hex');
check(h(restored) === h(src),
  'reverse-apply: undoing the control edit returns the file byte-for-byte',
  `${h(restored).slice(0, 16)} vs ${h(src).slice(0, 16)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
