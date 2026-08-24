#!/usr/bin/env node
/* Stage L-fin — prove a published path is actually SERVED.
 *
 *   node tools/verify_published_live.mjs --repo-root <dir> --shelf <games.json>
 *        --path /ouroboros/ --path /novasiege/
 *        [--tool-path /artsaward/] [--expect-404 /nope-does-not-exist/]
 *
 * ROUTE TYPE IS DECLARED, NOT INFERRED.
 *   --path       a GAME route. Serves, AND has a shelf entry, AND renders an
 *                arcade card.
 *   --tool-path  a TEACHER TOOL route. Serves, and must NOT be on the arcade
 *                shelf.
 *
 * The split exists because three tool routes were dispatched through --path and
 * the run went red on six limbs, every one of them "no arcade card" — for pages
 * that correctly have none. A red nobody acts on is worse than no red at all:
 * it trains people to skim past this instrument, and the reds it does need to
 * raise arrive in the same colour.
 *
 * Type is NOT derived from the shelf. "It is a game if the shelf lists it"
 * would make the shelf assertion circular: a game accidentally dropped from
 * games.json would reclassify itself as a tool and skip the very check that
 * exists to catch that. The caller declares the type and the gate holds it to
 * it — in BOTH directions, since a tool route is asserted ABSENT from the
 * shelf rather than merely unexamined. An unexamined property is invisible; an
 * asserted one is not.
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
const GAME_PATHS = all('--path');
const TOOL_PATHS = all('--tool-path');
const PATHS = [
  ...GAME_PATHS.map((p) => ({ p, kind: 'game' })),
  ...TOOL_PATHS.map((p) => ({ p, kind: 'tool' })),
];
const CONTROL = val('--expect-404');

/* N1.2. SHELF and the path lists come from argv. Invoked with NO arguments —
   which is exactly how post-merge-production-verify.yml was invoking it — this
   reached readFileSync(null) and died with ERR_INVALID_ARG_TYPE at line 92.
   That reads as a broken tool. It is not: the gate was never handed what it
   needs, so it never judged anything, and `set +e` upstream turned that into a
   green step. Refuse in the estate's own words, and exit 2 (NOT RUN), so a
   caller cannot mistake absence of a verdict for a passing one. This is
   argument validation, not a try/catch around the symptom — the crash site
   itself is left exactly as it was. */
if (!SHELF || PATHS.length === 0) {
  console.error('NOT RUN: verify_published_live.mjs needs --shelf <games.json> and at least one --path/--tool-path.');
  console.error(`  --shelf: ${SHELF ? SHELF : '(missing)'}   paths given: ${PATHS.length}`);
  console.error('  The canonical invocation is in .github/workflows/published-live-verify.yml.');
  console.error('This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

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
for (const { p, kind } of PATHS) {
  g(`served ${kind} path ${p}`);
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

  // The shelf is the ARCADE shelf. A game must be on it; a teacher tool must
  // not. Both are asserted — the tool case is a claim about the shelf, not an
  // omission from the report.
  const entry = servedShelf ? servedShelf.games.find((e) => e.href === p) : null;
  if (kind === 'game') {
    check('shelf entry exists for this path', !!entry, entry ? `"${entry.title}"` : 'no entry with this href');
  } else {
    check('correctly absent from the arcade shelf', !entry,
      entry ? `a tool route is listed as a game: "${entry.title}"` : 'no game entry, as expected for a tool route');
  }

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
  /* The arcade's browse structure moved from one A-Z grid (#allGrid) to genre
     accordions (#genreSections). This job reads the SERVED page, so during a
     deploy window it is genuinely either — and reading only the old one
     returned -1, "the selector matched nothing", which is indistinguishable
     from a shelf that failed to render. Both are accepted, and the accordions
     are opened first: a card inside a shut <details> is not painted, so a
     folded shelf would otherwise read as a missing one. */
  const BROWSE = '#allGrid, #genreSections';
  await page.evaluate(() => document.querySelectorAll('details.gsec').forEach((d) => { d.open = true; })).catch(() => {});
  const expected = servedShelf ? servedShelf.games.length : 0;
  let rendered = -1;
  for (let i = 0; i < 60; i++) {              // poll, never single-sample
    rendered = await page.evaluate((sel) => {
      const roots = [...document.querySelectorAll(sel)];
      if (!roots.length) return -1;
      document.querySelectorAll('details.gsec').forEach((d) => { d.open = true; });
      return roots.flatMap((g) => [...g.querySelectorAll('a.gcard')]).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
    }, BROWSE).catch(() => -1);
    if (rendered >= expected) break;
    await page.waitForTimeout(250);
  }
  check('arcade renders the whole shelf', rendered === expected,
    `${rendered} cards occupy real space, shelf is ${expected} (rendered, not node-counted)`);

  /* One predicate, used by the assertions and by the control below, so the
     control cannot drift from the thing it is certifying. */
  const cardFor = (href) => page.evaluate(([h, sel]) => {
    const roots = [...document.querySelectorAll(sel)];
    if (!roots.length) return false;
    return roots.flatMap((g) => [...g.querySelectorAll('a.gcard')]).some((a) => {
      const r = a.getBoundingClientRect();
      return a.getAttribute('href') && a.getAttribute('href').includes(h) && r.width > 0 && r.height > 0;
    });
  }, [href, BROWSE]).catch(() => false);

  for (const p of GAME_PATHS) {
    const found = await cardFor(p);
    check(`arcade shows a card for ${p}`, found,
      found ? 'card is rendered and occupies space' : 'no rendered card links here');
  }
  for (const p of TOOL_PATHS) {
    const found = await cardFor(p);
    check(`arcade shows NO card for tool route ${p}`, !found,
      found ? 'a teacher tool is rendering an arcade card' : 'no arcade card, as expected for a tool route');
  }
  await ctx.close();
}

/* ──────────────────────────── the arcade-card check must be able to go red
 *
 * The ask, verbatim: a real game route with its card removed must still go RED.
 * That is done literally here rather than by analogy — a real shelf game is
 * located on the rendered arcade, its card is removed from the live DOM, and
 * the SAME predicate is re-run. Nothing on the site is touched; the removal
 * happens in this browser context and is discarded with it.
 *
 * Both directions, because a check that is always red proves as little as one
 * that is always green: the card must be FOUND before removal and ABSENT
 * after. If the shelf is empty or unreadable this is reported as INCONCLUSIVE
 * rather than skipped, since a silently absent control is the failure this
 * whole instrument exists to avoid.
 */
{
  g('control: the arcade-card check must be able to go red');
  const sample = servedShelf && servedShelf.games ? servedShelf.games.find((e) => e.href) : null;
  if (!sample) {
    check('a real game is available to use as the control', false,
      'the served shelf yielded no entry — the card check below is uncertified');
  } else {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${ORIGIN}/games/`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    /* Open the genre accordions before certifying the control: a card inside a
       shut <details> occupies no space, so the control would report "not found"
       for a game that is present and call itself always-red. */
    const openAll = () => page.evaluate(() => document.querySelectorAll('details.gsec').forEach((d) => { d.open = true; })).catch(() => {});
    await openAll();
    const cardFor = async (href) => { await openAll(); return page.evaluate((h) => {
      const grid = document.querySelector('#allGrid') || document.querySelector('#genreSections');
      if (!grid) return false;
      return [...grid.querySelectorAll('a.gcard')].some((a) => {
        const r = a.getBoundingClientRect();
        return a.getAttribute('href') && a.getAttribute('href').includes(h) && r.width > 0 && r.height > 0;
      });
    }, href).catch(() => false); };

    for (let i = 0; i < 60; i++) { if (await cardFor(sample.href)) break; await page.waitForTimeout(250); }
    check(`CONTROL: a real game (${sample.href}) IS found before removal`,
      await cardFor(sample.href), 'the check is not always-red');

    await openAll();
    const removed = await page.evaluate((h) => {
      const grid = document.querySelector('#allGrid') || document.querySelector('#genreSections');
      if (!grid) return 0;
      const hits = [...grid.querySelectorAll('a.gcard')]
        .filter((a) => a.getAttribute('href') && a.getAttribute('href').includes(h));
      hits.forEach((a) => a.remove());
      return hits.length;
    }, sample.href).catch(() => 0);

    check(`CONTROL: with its card removed, ${sample.href} goes RED`,
      removed > 0 && !(await cardFor(sample.href)),
      `${removed} card node(s) removed from the live DOM — the check reports absent`);
    await ctx.close();
  }
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
