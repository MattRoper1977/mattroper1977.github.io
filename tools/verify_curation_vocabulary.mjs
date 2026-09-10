/* ONE name for the top curation rail, on every surface that shows it.
 *
 * WHY THIS GATE HOLDS NO COPY OF THE NAME. Before this pass /games/ alone
 * carried "Curated Favs", "CURATED FAVS", "MATT'S PICKS", "Matt's personal top
 * picks", "Matt's top picks", "MATT’S PICK" and "curated favourites" — seven
 * spellings of one idea on one page, with tests pinning four of them. A gate
 * that writes the name down again is the eighth, and it reds the first time
 * Matt edits a word rather than when a surface actually drifts.
 *
 * So the canonical name is DERIVED from games/index.html, which is the
 * hand-authored source of truth for the rail, and every other surface is
 * asserted to match what that page says. Change the name there and this gate
 * follows; change it on ONE surface and this gate reds.
 *
 * THE APOSTROPHE IS ASSERTED BY CODEPOINT. A page and a gate disagreeing on an
 * invisible character fails silently, and characters have been mangled in
 * transit in this estate before. Measured across rendered prose on the served
 * surfaces, the estate uses U+0027 in 78% of cases (39 of 50) and U+2019 in
 * 22%, and both headings this pass replaces already used U+0027 — so U+0027 is
 * the convention, and it is checked as a codepoint rather than a pasted glyph.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APOSTROPHE = 0x27;          // U+0027, per the measurement above

/* Serve the checkout in-process, exactly as tools/verify_curation_keys.mjs
   does, so the gate needs no external server and no MBM_BASE_URL. /games/
   fetches /Games/games.json — the CANONICAL shelf, which lives in the other
   repository — so that one path is shimmed to whichever copy is available:
   the CI checkout at _shelf, else the local mirror. */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2' };
const SHELF = existsSync(join(ROOT, '_shelf/games.json'))
  ? join(ROOT, '_shelf/games.json')
  : join(ROOT, 'data/source-manifests/games.json');
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/Games/games.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(readFileSync(SHELF)); return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  try {
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch (e) { res.writeHead(500).end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

/* ---- derive the canonical vocabulary from the page that owns it ---------- */
const hub = readFileSync(join(ROOT, 'games/index.html'), 'utf8');
const railHeading = (hub.match(/<section class="sec" id="picks">[\s\S]*?<h2>([^<]+)<\/h2>/) || [])[1];
const railBlurb = (hub.match(/<section class="sec" id="picks">[\s\S]*?<p class="sub">([^<]+)<\/p>/) || [])[1];
const badge = (hub.match(/<span class="badge">([^<]+)<\/span>/) || [])[1];
if (!railHeading || !railBlurb || !badge)
  throw new Error('cannot derive the curation vocabulary from games/index.html');

/* Every spelling this pass retired. A served surface carrying one of these is
   describing the same mechanic by an old name. */
const RETIRED = [
  'Curated Favs', 'CURATED FAVS', 'curated favourites', 'curated favorites',
  "MATT'S PICK", 'MATT’S PICK', "MATT'S PICKS", 'MATT’S PICKS',
  "Matt's personal top picks", 'Matt’s personal top picks',
  "Matt's top picks", 'Matt’s top picks', "Matt's picks", 'Matt’s picks',
];

const rows = [];
const check = (ok, what, detail = '') => {
  rows.push(ok);
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
};

console.log(`derived from games/index.html:`);
const _len = (s) => `${Buffer.byteLength(String(s ?? ''))}B`;
console.log(`  heading : ${_len(railHeading)} (text withheld — H4/5k: no path prints protected copy)`);
console.log(`  blurb   : ${_len(railBlurb)}`);
console.log(`  badge   : ${_len(badge)}\n`);

/* The derived value must not itself be a retired name. Without this, renaming
   the rail on /games/ BACK to "Matt's personal top picks" would simply be
   re-derived as canonical and every cross-surface check would agree with it —
   the gate would follow the regression instead of catching it. Deriving is
   what stops a second literal; this is what stops derivation being a loophole. */
check(!RETIRED.some(r => railHeading.includes(r) || badge.includes(r)),
  'the derived name is not one of the labels this pass retired',
  RETIRED.filter(r => railHeading.includes(r) || badge.includes(r)).join(' | '));

/* the apostrophe, by codepoint */
const apos = [...railHeading].filter(c => c === "'" || c === '’');
check(apos.length === 1 && apos[0].codePointAt(0) === APOSTROPHE,
  `the rail heading uses U+${APOSTROPHE.toString(16).toUpperCase().padStart(4, '0')}, not a look-alike`,
  apos.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(',') || 'none');
check(!/\d/.test(railBlurb),
  'the rail blurb carries no numeral — a count in prose drifts the day the rail changes');

const browser = await chromium.launch();
try {
  for (const route of ['/games/', '/for/pupils/']) {
    const page = await browser.newPage();
    await page.goto(new URL(route, BASE).href, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    const seen = await page.evaluate(() => ({
      text: document.body.innerText,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()),
      railBadges: [...document.querySelectorAll('#topRail .badge, [data-mbm-pupil-rail] .badge')]
        .map(e => e.textContent.trim()),
    }));

    check(seen.headings.includes(railHeading),
      `${route}: shows the canonical rail heading`,
      seen.headings.filter(h => /pick/i.test(h)).join(' | ') || '(none)');

    const stale = RETIRED.filter(r => seen.text.includes(r));
    check(stale.length === 0, `${route}: carries no retired curation label`, stale.join(' | '));

    if (route === '/games/') {
      check(seen.railBadges.length > 0 && seen.railBadges.every(b => b === badge),
        `${route}: every rail badge reads the canonical badge`,
        `${seen.railBadges.length} badges, distinct: ${[...new Set(seen.railBadges)].join(',')}`);
    }
    await page.close();
  }
} finally { await browser.close(); server.close(); }

const bad = rows.filter(r => !r).length;
console.log(`\ncuration vocabulary: ${rows.length - bad}/${rows.length} passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
