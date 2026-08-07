#!/usr/bin/env node
/* Stage L-fin — prove a published path is actually SERVED.
 *
 *   node tools/verify_published_live.mjs --repo-root <dir> --shelf <games.json>
 *        --path /ouroboros/ --path /novasiege/ [--expect-404 /nope-does-not-exist/]
 *
 * "Merged" and "served" are different claims (R10). A shelf entry whose target
 * does not serve is a half-publish arriving from the serving side, and it is
 * the visitor who pays for it — which is why this runs before anything else.
 *
 * Serving is proven by fetching the served bytes and comparing them to the
 * committed blob. Nothing weaker counts: a 200 proves a response, not the
 * right response.
 *
 * The --expect-404 path is the proves-can-fail control. It points the identical
 * byte-comparison at a path that does not exist; if that comes back "served",
 * the instrument is measuring nothing and every green above it is void.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const val = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
const all = (n) => argv.reduce((a, v, i) => (v === n ? [...a, argv[i + 1]] : a), []);

const ORIGIN = val('--origin') || 'https://madebymatt.uk';
const REPO_ROOT = val('--repo-root') || '.';
const SHELF = val('--shelf');
const PATHS = all('--path');
const CONTROL = val('--expect-404');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const results = [];
let group = '';
const g = (n) => { group = n; console.log(`\n${n}`); };
const check = (limb, ok, detail) => {
  results.push({ group, limb, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${limb.padEnd(30)} ${detail}`);
  return ok;
};

const browser = await chromium.launch();

/* Fetch through the browser so we see exactly what a visitor's browser gets,
   including redirects, rather than what curl negotiates. */
async function fetchBytes(url) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let status = 0, body = null;
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = r ? r.status() : 0;
    body = r ? Buffer.from(await r.body()) : null;
  } catch (e) { status = -1; }
  await ctx.close();
  return { status, body };
}

// ───────────────────────────────────────────────── the served shelf, once
g('served shelf');
let servedShelf = null;
{
  const repoShelf = readFileSync(SHELF);
  const { status, body } = await fetchBytes(`${ORIGIN}/Games/games.json`);
  check('shelf answers 200', status === 200, `HTTP ${status}`);
  const same = body && sha(body) === sha(repoShelf);
  check('shelf bytes == committed blob', !!same,
    body ? `served ${body.length}B ${sha(body).slice(0, 12)} vs repo ${repoShelf.length}B ${sha(repoShelf).slice(0, 12)}` : 'no body');
  try { servedShelf = JSON.parse((body || repoShelf).toString('utf8')); } catch (_) { servedShelf = null; }
  const entries = servedShelf ? servedShelf.games.length : 0;
  // Vacuous-pass guard: an empty shelf satisfies "every entry resolves".
  check('served shelf non-empty', entries > 0, `${entries} entries served`);

  const MARK = /^NEW\s*·\s*/;
  const servedHolders = (servedShelf ? servedShelf.games : []).filter((e) => MARK.test(e.title || '')).map((e) => e.href);
  const repoHolders = JSON.parse(repoShelf.toString('utf8')).games.filter((e) => MARK.test(e.title || '')).map((e) => e.href);
  check('sole NEW· marker, matching repo',
    servedHolders.length === 1 && JSON.stringify(servedHolders) === JSON.stringify(repoHolders),
    `served ${JSON.stringify(servedHolders)} vs repo ${JSON.stringify(repoHolders)}`);
}

// ─────────────────────────────────────────── each published path, byte-for-byte
for (const p of PATHS) {
  g(`served path ${p}`);
  const repoFile = join(REPO_ROOT, p.replace(/^\/|\/$/g, ''), 'index.html');
  let repoBytes = null;
  try { repoBytes = readFileSync(repoFile); } catch (e) {
    check('committed blob readable', false, `${repoFile} — ${e.code}`);
    continue;
  }
  const { status, body } = await fetchBytes(ORIGIN + p);
  check('answers 200', status === 200, `HTTP ${status}`);
  const identical = !!(body && sha(body) === sha(repoBytes));
  check('served bytes == committed blob', identical,
    body ? `served ${body.length}B ${sha(body).slice(0, 12)} vs repo ${repoBytes.length}B ${sha(repoBytes).slice(0, 12)}`
         : 'no body returned');

  // The shelf entry must point here, and the served shelf must carry it.
  const entry = servedShelf ? servedShelf.games.find((e) => e.href === p) : null;
  check('shelf entry exists for this path', !!entry, entry ? `"${entry.title}"` : 'no entry with this href');

  // Off-origin requests at runtime, measured on the SERVED page.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const offOrigin = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/^https?:/i.test(u) && !u.startsWith(ORIGIN)) offOrigin.push(u);
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(ORIGIN + p, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);
  check('zero off-origin requests', offOrigin.length === 0,
    offOrigin.length ? JSON.stringify(offOrigin.slice(0, 3)) : 'all requests same-origin');
  check('no script errors on the served page', errs.length === 0,
    errs.length ? JSON.stringify(errs.slice(0, 2)) : 'clean');
  await ctx.close();
}

// ───────────────────────────────────────── the arcade must RENDER the entries
g('arcade renders the new entries');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/games/`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  const expected = servedShelf ? servedShelf.games.length : 0;
  let rendered = -1;
  for (let i = 0; i < 60; i++) {              // poll, never single-sample
    rendered = await page.evaluate(() => {
      const grid = document.getElementById('allGrid');
      if (!grid) return -1;
      return [...grid.querySelectorAll('a.gcard')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
    }).catch(() => -1);
    if (rendered >= expected) break;
    await page.waitForTimeout(250);
  }
  check('arcade renders the whole shelf', rendered === expected,
    `${rendered} cards occupy real space, shelf is ${expected} (rendered, not node-counted)`);
  for (const p of PATHS) {
    const found = await page.evaluate((href) => {
      const grid = document.getElementById('allGrid');
      if (!grid) return false;
      return [...grid.querySelectorAll('a.gcard')].some((a) => {
        const r = a.getBoundingClientRect();
        return a.getAttribute('href') && a.getAttribute('href').includes(href) && r.width > 0 && r.height > 0;
      });
    }, p).catch(() => false);
    check(`arcade shows a card for ${p}`, found, found ? 'card is rendered and occupies space' : 'no rendered card links here');
  }
  await ctx.close();
}

// ─────────────────────────────────────────────── proves-can-fail control
if (CONTROL) {
  g('control (must go red)');
  const { status, body } = await fetchBytes(ORIGIN + CONTROL);
  const looksServed = status === 200 && body && body.length > 0;
  check('a nonexistent path is NOT served', !looksServed,
    `HTTP ${status} for ${CONTROL} — if this were 200 the byte-comparison above would be measuring nothing`);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} limbs pass`);
if (failed.length) {
  console.log(`FAILING: ${failed.map((f) => `${f.group}/${f.limb}`).join(', ')}`);
  process.exit(1);
}
process.exit(0);
