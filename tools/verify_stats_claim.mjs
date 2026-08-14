/*
 * /stats/ — bind the privacy claim to the config that can falsify it.
 *
 * The page says, in terms:
 *
 *   "no IP address is looked up, and no counter request or audience preference
 *    is sent to a remote counter service"
 *
 * That sentence is true today for exactly one reason: site.json's
 * features.analytics.goatcounter is "". It is not true because of anything the
 * page does. assets/mbm-features.js initAnalytics() reads that key and, when it
 * is non-empty, appends <script src="//gc.zgo.at/count.js"> — a counter request
 * to a remote counter service, whose country resolution is done from the IP
 * server-side. The moment somebody sets the key, the page starts lying.
 *
 * A note in a file would not survive that person. This gate would: it fails
 * whenever the key is non-empty and the claim is still on the page.
 *
 * The claim is checked BOTH ways round, because a config string on its own is a
 * proxy:
 *   §1 static      — key vs claim text
 *   §2 behavioural — with the key set, is a remote counter actually requested?
 * §2 is what makes §1 more than string-matching, and the positive control in §3
 * proves the whole thing can go red.
 *
 * Usage:  node tools/verify_stats_claim.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE_JSON = 'site.json';
const STATS = 'stats/index.html';

/* The load-bearing half of the sentence. Matched on the claim itself rather than
   on a line number, so moving the paragraph does not silently disarm the gate. */
const CLAIM_RE = /no IP address is looked up, and no counter request or audience preference is sent to a remote counter service/i;
/* The remote counter mbm-features.js reaches for. */
const COUNTER_HOST = 'gc.zgo.at';

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

const readCode = root => {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, SITE_JSON), 'utf8'));
  return String(((cfg.features || {}).analytics || {}).goatcounter || '').trim();
};

/* --- the rule this file exists to enforce, in one place --- */
function judge(code, claimPresent) {
  // A non-empty key means a remote counter is wired up. The claim may not stand.
  if (code && claimPresent) return { ok: false, why: `goatcounter="${code}" is set while the page still claims no counter request is sent` };
  if (code && !claimPresent) return { ok: true, why: `goatcounter="${code}" is set and the claim has been withdrawn` };
  if (!code && claimPresent) return { ok: true, why: 'goatcounter is empty and the claim stands' };
  return { ok: true, why: 'goatcounter is empty and no claim is made' };
}

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

/* Load /stats/ and report every off-origin request the page attempts. The
   counter script is blocked from actually loading - the point is to observe the
   attempt, not to hand a third party a page view while testing. */
async function observeRequests(root) {
  const s = serve(root);
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.route('**://gc.zgo.at/**', r => r.abort());
  const page = await ctx.newPage();
  const offOrigin = [];
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });
  await page.goto(origin + '/stats/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await browser.close();
  s.close();
  return offOrigin;
}

console.log('/stats/ — the privacy claim must be bound to the config that can falsify it\n');

/* ---------------- 1. static: config vs claim ---------------- */
console.log('--- 1. shipped tree ---');
const statsSrc = fs.readFileSync(path.join(ROOT, STATS), 'utf8');
const claimPresent = CLAIM_RE.test(statsSrc);
const code = readCode(ROOT);
check(claimPresent, 'the "no IP address / no counter request" claim is present and matchable',
  claimPresent ? 'found' : 'NOT FOUND — the gate would be vacuous, fix the pattern');
console.log(`      features.analytics.goatcounter = ${JSON.stringify(code)}`);
const verdict = judge(code, claimPresent);
check(verdict.ok, 'THE RULE: a non-empty goatcounter key may not coexist with the claim', verdict.why);

/* ---------------- 2. behavioural: is the claim true as shipped? ---------------- */
console.log('\n--- 2. behavioural, shipped tree ---');
const shippedReqs = await observeRequests(ROOT);
const shippedCounter = shippedReqs.filter(u => u.includes(COUNTER_HOST));
check(shippedCounter.length === 0,
  'as shipped, /stats/ makes no request to the remote counter — the claim holds in fact',
  `${shippedCounter.length} counter request(s); ${shippedReqs.length} off-origin request(s) total`);
if (shippedReqs.length) console.log('      off-origin: ' + shippedReqs.slice(0, 5).join(', '));

/* ---------------- 3. POSITIVE CONTROL ---------------- */
console.log('\n--- 3. positive control: set the key in a scratch copy, demand red ---');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stats-'));
for (const rel of ['stats', 'assets', 'data']) {
  const src = path.join(ROOT, rel);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(scratch, rel), { recursive: true });
}
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, SITE_JSON), 'utf8'));
cfg.features = cfg.features || {};
cfg.features.analytics = cfg.features.analytics || {};
cfg.features.analytics.goatcounter = 'madebymatt';
fs.writeFileSync(path.join(scratch, SITE_JSON), JSON.stringify(cfg, null, 2));

const scratchCode = readCode(scratch);
check(scratchCode === 'madebymatt', 'CONTROL: the scratch copy has the key set', scratchCode);
const scratchVerdict = judge(scratchCode, claimPresent);
check(!scratchVerdict.ok,
  'CONTROL: with the key set, THE RULE goes red — the gate can fail',
  scratchVerdict.why);

const scratchReqs = await observeRequests(scratch);
const scratchCounter = scratchReqs.filter(u => u.includes(COUNTER_HOST));
check(scratchCounter.length > 0,
  'CONTROL: with the key set, /stats/ really does reach for the remote counter',
  scratchCounter.length ? scratchCounter[0] : 'no counter request observed — the behavioural half is vacuous');

/* reverse-apply: the scratch config, keyed back, is the shipped config */
const restored = JSON.parse(JSON.stringify(cfg));
restored.features.analytics.goatcounter = '';
const shippedCfg = JSON.parse(fs.readFileSync(path.join(ROOT, SITE_JSON), 'utf8'));
check(JSON.stringify(restored) === JSON.stringify(shippedCfg),
  'reverse-apply: undoing the control edit returns the shipped config exactly');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
