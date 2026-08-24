#!/usr/bin/env node
/*
 * S1'.3 — the mutation control for the SURFACE FLOOR assertion.
 *
 * The existing S2c control fires on the NAMED-GAMES assertion. A control that
 * proves a different assertion proves nothing about this one, so the floor gets
 * its own — and it runs against a SCRATCH FIXTURE, never against live.
 *
 * Three cases, because the floor has two failure modes that must never be
 * conflated (R9):
 *   A  unmodified            floor PASSES, observed == derived manifest length
 *   B  ten cards removed     floor REDS naming SURFACE FLOOR and both numbers
 *   C  no card ever attaches  MEASUREMENT INVALID - not "observed 0", because a
 *                             count never taken is not a count of zero
 */
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) {}
  }
  console.error('NOT RUN: playwright is not importable, so no page was rendered.');
  console.error('This control did not judge anything. That is not a pass.');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.ico':'image/x-icon' };

function serve(mode) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/Games/games.json') rel = '/data/source-manifests/games.json';
      if (rel.endsWith('/')) rel += 'index.html';
      const f = path.join(SITE, rel);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      let body = fs.readFileSync(f);
      if (rel === '/games/index.html' && mode !== 'clean') {
        // the scratch mutation: applied to the SERVED copy, the tree is untouched
        const inject = mode === 'drop10'
          ? `<script>addEventListener('load',function(){setTimeout(function(){var c=document.querySelectorAll('#genreSections .gcard');for(var i=0;i<10&&i<c.length;i++)c[i].remove();},400)})<\/script>`
          : `<style>#genreSections .gcard{display:none!important}</style><script>Object.defineProperty(Element.prototype,'__x',{value:1})<\/script>`;
        body = Buffer.from(body.toString('utf8').replace('</head>', inject + '</head>'), 'utf8');
      }
      res.end(body);
    });
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

/* The floor logic, kept identical in shape to verify_surfaces.js S2f. */
async function floorRun(mode) {
  const server = await serve(mode);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(base + '/games/', { waitUntil: 'networkidle' });
    let settled = true;
    try {
      await page.waitForFunction(() => {
        const n = document.querySelectorAll('#genreSections .gcard');
        if (!n.length) return false;
        return Array.from(n).some((c) => c.getBoundingClientRect().height > 0);
      }, null, { timeout: 6000 });
    } catch (_) { settled = false; }
    if (mode === 'drop10') await page.waitForTimeout(900); // let the scratch removal land
    const observed = await page.evaluate(() => document.querySelectorAll('#genreSections .gcard').length);
    const man = JSON.parse(fs.readFileSync(path.join(SITE, 'data/source-manifests/games.json'), 'utf8'));
    const expected = (man.games || man).length;
    if (!settled) return { verdict: 'MEASUREMENT INVALID', msg: 'no frame arrived with a card attached, so the count was never taken' };
    if (observed >= expected) return { verdict: 'PASS', msg: `expected >=${expected} (derived: served manifest length), observed ${observed}` };
    return { verdict: 'FAIL', msg: `SURFACE FLOOR: #genreSections expected >=${expected} (derived: served manifest length), observed ${observed}` };
  } finally { await browser.close(); server.close(); }
}

let bad = 0;
const show = (label, want, got) => {
  const okk = got.verdict === want;
  if (!okk) bad++;
  console.log(`  ${okk ? 'ok  ' : 'FAIL'} ${label.padEnd(46)} ${got.verdict}  ${got.msg}`);
};
console.log('S1′.3 — mutation control for the SURFACE FLOOR assertion (scratch fixture, never live)\n');
show('A unmodified -> floor passes',            'PASS',               await floorRun('clean'));
show('B ten cards removed -> floor reds',       'FAIL',               await floorRun('drop10'));
show('C no card attaches -> not a zero count',  'MEASUREMENT INVALID', await floorRun('hide'));
console.log('');
if (bad) { console.error(`${bad} of 3 control case(s) did not behave as required`); process.exit(1); }
console.log('all 3 control cases behaved as required: the floor passes, reds on its own message, and reports a null as a null');
