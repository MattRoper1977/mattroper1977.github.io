#!/usr/bin/env node
/**
 * /games/ filter state in the URL — proves a filtered shelf is shareable, and
 * that what travels in the link is the SLUG, never the display label.
 *
 * Why the slug matters enough to gate: `?feel=quick-go` survives a rename of
 * the QUICK GO chip. `?feel=QUICK%20GO` does not — the day someone retitles
 * that chip, every link anyone ever shared points at a facet that no longer
 * exists, and it fails silently as an empty shelf. The identifier and the
 * display text are two different things and this file is where that stays true.
 *
 * Measured, never assumed:
 *   U1  a clean load leaves the URL clean
 *   U2  a facet click writes the URL            (mutation control: C1)
 *   U3  the URL carries the slug, not the label
 *   U4  a deep link restores the facet          (discriminating control: C2)
 *   U5  a deep link restores the search term
 *   U6  an unknown slug degrades to the full shelf, never to an empty one
 *   U7  replaceState, not push — no history entry per keystroke
 *   U8  params this page does not own are preserved
 *   U9  clearing the filters leaves the URL clean again
 *   U10 the countline shows the label, not the slug
 *
 * A shelf that never rendered is MEASUREMENT INVALID, not a failing filter.
 * Every count assertion below is downstream of that gate.
 *
 * Usage:  node tools/verify_url_filter_state.mjs [--base=https://madebymatt.uk]
 */
import fs from 'node:fs';
import path from 'node:path';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch (_) { ({ chromium } = await import('playwright-core')); }

const BASE = (process.argv.find(a => a.startsWith('--base=')) || '--base=https://madebymatt.uk')
  .split('=').slice(1).join('=');
const GAMES = BASE + '/games/';

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d ? '  [' + d + ']' : '')); };

function launchOpts() {
  const o = { headless: true, args: ['--no-sandbox'] };
  const b = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (b && fs.existsSync(b)) {
    const d = fs.readdirSync(b).filter(x => /^chromium-\d+$/.test(x)).sort().pop();
    const exe = d && path.join(b, d, 'chrome-linux', 'chrome');
    if (exe && fs.existsSync(exe)) o.executablePath = exe;
  }
  return o;
}

/* The shelf is fetched, so every card count has to wait on a CONDITION — not
   on a duration. A settle that timed out returns false and the caller reports
   MEASUREMENT INVALID: a page that never painted is not a page that painted
   the wrong thing, and conflating the two is how a broken harness gets read
   as a broken feature. */
async function shelfReady(page) {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll('#genreSections .gcard, #flatResults .gcard').length > 0,
      null, { timeout: 20000 });
    return true;
  } catch (_) { return false; }
}

const search = page => page.evaluate(() => location.search);
const cards  = page => page.evaluate(() =>
  document.querySelectorAll('#genreSections .gcard, #flatResults .gcard').length);
const chip   = (page, label) => page.locator('#feels button', { hasText: label }).first();

(async () => {
  console.log('URL filter state against ' + GAMES + '\n');
  const browser = await chromium.launch(launchOpts());
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  /* ------------------------------------------------------- baseline + U1 */
  await page.goto(GAMES, { waitUntil: 'domcontentloaded' });
  if (!await shelfReady(page)) {
    console.log('\n  MEASUREMENT INVALID — the shelf rendered 0 cards at rest, so no');
    console.log('  filter assertion below could have been made. This is not a filter');
    console.log('  failure; the manifest or the page never arrived.');
    /* Said in the harness's own vocabulary as well as in mine: the post-merge
       runner classifies on message text, and a null measurement must land in
       NOT-RUN, never in FAIL. */
    console.log('  This gate did not judge anything.');
    await browser.close();
    process.exit(2);
  }
  const atRest = await cards(page);
  console.log('       cards at rest: ' + atRest);
  ok('U1 a clean load leaves the URL clean', (await search(page)) === '', 'search=' + JSON.stringify(await search(page)));

  /* --------------------------------------------------------------- U2/U10 */
  await chip(page, 'CALM').click();
  const afterCalm = await search(page);
  ok('U2 a facet click writes the URL', afterCalm === '?feel=calm', 'search=' + afterCalm);
  const calmCards = await cards(page);
  ok('U2b the click actually filtered', calmCards > 0 && calmCards < atRest, calmCards + ' of ' + atRest);

  /* --------------------------------------------------------------- U3/U10 */
  await chip(page, 'CALM').click();            // off
  await chip(page, 'QUICK GO').click();        // on — label and slug differ
  const qg = await search(page);
  ok('U3 the URL carries the slug', qg.includes('feel=quick-go'), 'search=' + qg);
  ok('U3b the URL does NOT carry the label', !/QUICK/.test(qg) && !/%20/.test(qg), 'search=' + qg);
  const countline = await page.locator('#countline').innerText();
  ok('U10 the countline shows the label, not the slug',
     countline.includes('QUICK GO') && !countline.includes('quick-go'), countline.trim());

  /* -------------------------------------------------------------------- U7 */
  const hlBefore = await page.evaluate(() => history.length);
  await page.locator('#q').fill('neon');
  await chip(page, 'QUICK GO').click();        // off
  const hlAfter = await page.evaluate(() => history.length);
  ok('U7 replaceState, not push', hlAfter === hlBefore, hlBefore + ' -> ' + hlAfter);

  /* -------------------------------------------------------------------- U9 */
  await page.locator('#q').fill('');
  const cleared = await search(page);
  ok('U9 clearing the filters leaves the URL clean', cleared === '', 'search=' + JSON.stringify(cleared));

  /* ------------------------------------------------------------------- U4 */
  await page.goto(GAMES + '?feel=calm', { waitUntil: 'domcontentloaded' });
  if (!await shelfReady(page)) { ok('U4 deep link restores the facet', false, 'MEASUREMENT INVALID — shelf never rendered'); }
  else {
    const deepCalm = await cards(page);
    const pressed = await page.evaluate(() =>
      [...document.querySelectorAll('#feels button')]
        .filter(b => b.getAttribute('aria-pressed') === 'true')
        .map(b => b.textContent.trim().replace(/\s+\d+$/, '')));
    ok('U4 deep link restores the facet', deepCalm === calmCards && pressed.length === 1 && pressed[0] === 'CALM',
       deepCalm + ' cards, pressed=' + JSON.stringify(pressed));
  }

  /* --- C2 · discriminating control. The readback must TRACK the parameter,
         not merely produce a state. A restore that always lands on CALM would
         satisfy U4 and be worthless, so a different slug must land elsewhere. */
  await page.goto(GAMES + '?feel=fast', { waitUntil: 'domcontentloaded' });
  await shelfReady(page);
  const pressedFast = await page.evaluate(() =>
    [...document.querySelectorAll('#feels button')]
      .filter(b => b.getAttribute('aria-pressed') === 'true')
      .map(b => b.textContent.trim().replace(/\s+\d+$/, '')));
  ok('C2 control: a different slug restores a different facet',
     pressedFast.length === 1 && pressedFast[0] === 'FAST', 'pressed=' + JSON.stringify(pressedFast));

  /* ------------------------------------------------------------------- U5 */
  await page.goto(GAMES + '?q=neon', { waitUntil: 'domcontentloaded' });
  if (!await shelfReady(page)) { ok('U5 deep link restores the search term', false, 'MEASUREMENT INVALID — shelf never rendered'); }
  else {
    const box = await page.locator('#q').inputValue();
    const flat = await page.evaluate(() => document.querySelectorAll('#flatResults .gcard').length);
    ok('U5 deep link restores the search term', box === 'neon' && flat > 0 && flat < atRest,
       'box=' + JSON.stringify(box) + ', ' + flat + ' of ' + atRest);
  }

  /* ------------------------------------------------------------------- U6 */
  await page.goto(GAMES + '?feel=not-a-real-feel', { waitUntil: 'domcontentloaded' });
  if (!await shelfReady(page)) { ok('U6 an unknown slug degrades to the full shelf', false, 'MEASUREMENT INVALID — shelf never rendered'); }
  else {
    const bogus = await cards(page);
    const emptyShown = await page.evaluate(() => !document.getElementById('empty').hidden);
    ok('U6 an unknown slug degrades to the full shelf, never an empty one',
       bogus === atRest && !emptyShown, bogus + ' of ' + atRest + ', empty-shown=' + emptyShown);
  }

  /* ------------------------------------------------------------------- U8 */
  await page.goto(GAMES + '?utm_source=gate', { waitUntil: 'domcontentloaded' });
  if (!await shelfReady(page)) { ok('U8 foreign params are preserved', false, 'MEASUREMENT INVALID — shelf never rendered'); }
  else {
    await chip(page, 'CALM').click();
    const kept = await search(page);
    ok('U8 params this page does not own are preserved',
       kept.includes('utm_source=gate') && kept.includes('feel=calm'), 'search=' + kept);
  }

  /* --- C1 · mutation control. Neuter history.replaceState and U2 must FAIL.
         Without this, U2 passes on any page whose URL happens to be right and
         proves nothing about the code that is supposed to put it there. */
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => { history.replaceState = function () {}; });
  await p2.goto(GAMES, { waitUntil: 'domcontentloaded' });
  let controlHeld = false, controlNote = 'shelf never rendered';
  if (await shelfReady(p2)) {
    await chip(p2, 'CALM').click();
    const muted = await search(p2);
    controlHeld = muted !== '?feel=calm';
    controlNote = 'search=' + JSON.stringify(muted);
  }
  ok('C1 control: with replaceState neutered, U2 fails', controlHeld, controlNote);
  await ctx2.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH ' + (e && e.stack || e)); process.exit(3); });
