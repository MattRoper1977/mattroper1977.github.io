#!/usr/bin/env node
// House Games board privacy gate (planted-name test).
//
// The teacher board is projected in class. A name or class typed into a
// pupil's Passport travels inside the MBM4 Sync Code, so the board must never
// render either: each row shows only the board callsign worked out from the
// Passport's node id, plus House and scores.
//
// The gate:
//   1. statically checks buildRoster never reads profile.name or className;
//   2. plants a name and class through the real profile dialog in two pupil
//      browsers (one of them HTML-shaped), proves both travel in the code;
//   3. builds the board in a separate teacher browser and asserts the planted
//      strings appear nowhere in the board or the page, while each pupil's
//      own card callsign does appear;
//   4. negative control: serves a mutant whose board row shows the typed name
//      and requires step 3 to catch it, so the gate cannot pass vacuously.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'housegames/index.html');
const HTML = fs.readFileSync(FILE, 'utf8');

const PUPILS = [
  { name: 'Qzplant Abernathy', className: 'Plantclass 7Q', house: 'Ember' },
  // The runtime strips angle brackets on save; the gate checks what is actually stored.
  { name: "<b>Zxhtml</b> O'Vorpal", className: 'Klassplant 9Z', house: 'Tide' }
];
const PLANTED = [];
// Distinctive tokens: a partial leak (first word, tag-stripped text) still fails.
const TOKENS = ['Qzplant', 'Abernathy', 'Plantclass', 'Zxhtml', 'Vorpal', 'Klassplant'];

// Independent re-implementation of the callsign spec (FNV-1a over the node id).
const CALL_A = ['Swift', 'Bright', 'Steady', 'Calm', 'Bold', 'Quick', 'Keen', 'Brave', 'Clever', 'Lucky', 'Sunny', 'Silver', 'Golden', 'Misty', 'Rapid', 'Gentle'];
const CALL_B = ['Comet', 'Falcon', 'Otter', 'Harbour', 'Meadow', 'Pebble', 'Rocket', 'Badger', 'Heron', 'Maple', 'Orbit', 'Puffin', 'River', 'Summit', 'Thunder', 'Willow'];
function callsign(nodeId) {
  let h = 2166136261;
  for (const ch of String(nodeId)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${CALL_A[h & 15]} ${CALL_B[(h >>> 4) & 15]} ${10 + ((h >>> 8) % 90)}`;
}

function staticGate(html) {
  const start = html.indexOf('function buildRoster(){');
  const end = html.indexOf('function setCalm(', start);
  assert(start > 0 && end > start, 'buildRoster block not found');
  const block = html.slice(start, end);
  assert(!/profile\.name\b/.test(block), 'board code reads profile.name');
  assert(!/profile\.className\b/.test(block), 'board code reads profile.className');
  assert(/<th>Callsign<\/th>/.test(block), 'board header is not Callsign');
  assert.equal((html.match(/id="boardCallsign"/g) || []).length, 1, 'passport card callsign line count');
}

function serve(html) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/housegames/' || url.pathname === '/housegames/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return;
    }
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type }); fs.createReadStream(file).pipe(res); return;
    }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

async function openHub(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${origin}/housegames/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.MadeByMattOlympiadV4QA && !!window.MadeByMattV4Runtime);
  // Own-screen games may show a maker splash first; wait until the hub is usable.
  await page.locator('#profileBtn').waitFor({ state: 'visible', timeout: 15000 });
  return { context, page, errors };
}

async function plant(browser, origin, pupil) {
  const { context, page, errors } = await openHub(browser, origin);
  await page.locator('#profileBtn').click();
  await page.locator('#profileName').fill(pupil.name);
  await page.locator('#profileClass').fill(pupil.className);
  await page.locator('#profileHouse').selectOption(pupil.house);
  await page.locator('#saveProfile').click();
  // Control: the pupil's own card still shows their name (privacy is board-only).
  await page.waitForFunction(() => !document.querySelector('#profileDialog').open && /Qzplant|Zxhtml/.test(document.querySelector('#playerName').textContent));
  const out = await page.evaluate(() => {
    const R = window.MadeByMattV4Runtime, state = window.MadeByMattOlympiadV4QA.snapshot();
    const code = R.encodePassport(state), back = R.decodePassport(code);
    return { code, nodeId: state.nodeId, name: back.profile.name.value, className: back.profile.className.value, shown: document.querySelector('#playerName').textContent, card: document.querySelector('#boardCallsign').textContent };
  });
  assert.equal(out.name, out.shown, 'stored name differs from the passport card');
  assert(TOKENS.some(t => out.name.includes(t)), 'planted name did not travel in the Sync Code (test would be vacuous)');
  assert.equal(out.className, pupil.className, 'planted class did not travel in the Sync Code (test would be vacuous)');
  PLANTED.push(out.name, out.className);
  assert.equal(out.card, `Board callsign: ${callsign(out.nodeId)}`, 'passport card callsign differs from the spec');
  assert.deepEqual(errors, [], `pupil page errors: ${errors.join(' | ')}`);
  await context.close();
  return out;
}

// Returns a list of leaks; empty means the board is clean.
async function teacherBoard(browser, origin, codes) {
  const { context, page, errors } = await openHub(browser, origin);
  await page.locator('#rosterBtn').click();
  await page.locator('#rosterInput').fill(codes.map(c => c.code).join('\n'));
  await page.locator('#buildRoster').click();
  await page.locator('#rosterPreview .rosterTable').waitFor({ state: 'visible' });
  const seen = await page.evaluate(() => ({
    previewHTML: document.querySelector('#rosterPreview').innerHTML,
    previewText: document.querySelector('#rosterPreview').textContent,
    pageHTML: document.documentElement.outerHTML,
    pageText: document.body.innerText,
    rows: Array.from(document.querySelectorAll('#rosterPreview tbody tr td:first-child')).map(td => td.textContent)
  }));
  await context.close();
  assert.deepEqual(errors, [], `teacher page errors: ${errors.join(' | ')}`);
  const leaks = [];
  const lower = Object.fromEntries(Object.entries(seen).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.toLowerCase()]));
  for (const s of [...PLANTED, ...TOKENS]) for (const [where, text] of Object.entries(lower)) if (text.includes(s.toLowerCase())) leaks.push(`${JSON.stringify(s)} in ${where}`);
  return { leaks, rows: seen.rows };
}

const browser = await chromium.launch();
let failed = false;
try {
  staticGate(HTML);
  console.log('PASS static: buildRoster never reads profile.name / profile.className');

  const real = await serve(HTML);
  const codes = [];
  for (const pupil of PUPILS) codes.push(await plant(browser, real.origin, pupil));
  console.log(`PASS planted: ${codes.length} pupils, name and class travel in each Sync Code, card callsign matches spec`);

  const board = await teacherBoard(browser, real.origin, codes);
  assert.deepEqual(board.leaks, [], `typed name or class reached the board: ${board.leaks.join('; ')}`);
  assert.deepEqual([...board.rows].sort(), codes.map(c => callsign(c.nodeId)).sort(), 'board rows are not exactly the pupils\' callsigns');
  console.log(`PASS board: rows = ${board.rows.join(', ')}; no planted string in the board or the page`);
  real.server.close();

  // Negative control: the pre-fix board showed the typed name. The gate must catch it.
  const MUTANT_FROM = 'callsign:boardCallsign(state.nodeId)';
  assert.equal(HTML.split(MUTANT_FROM).length, 2, 'negative control anchor not found exactly once');
  const mutant = await serve(HTML.replace(MUTANT_FROM, 'callsign:state.profile.name.value+" "+state.profile.className.value'));
  const caught = await teacherBoard(browser, mutant.origin, codes);
  mutant.server.close();
  assert(caught.leaks.length > 0, 'negative control: a board showing typed names was NOT caught');
  console.log(`PASS negative control: name-showing mutant caught (${caught.leaks.length} leaks)`);
} catch (error) {
  failed = true;
  console.error(`FAIL ${error.message}`);
} finally {
  await browser.close();
}
if (failed) process.exit(1);
console.log('House Games board privacy: ALL GREEN');
