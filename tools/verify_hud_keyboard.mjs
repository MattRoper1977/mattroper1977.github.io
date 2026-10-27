#!/usr/bin/env node
/*
 * The Live-Teach HUD must not drive the lesson deck.
 *
 * Reported: with the dock open, typing in the Name Picker fires the slide
 * keybindings, so the deck advances mid-word. Reproduced before anything was
 * built: on a lesson whose keydown handler does not check the event target,
 * typing a name and pressing ArrowRight twice moved the deck from slide 0 to
 * slide 2. 93 of the estate's 234 arrow-key decks are in that population.
 *
 * This drives two real lessons - one from each population - and asserts:
 *   1. typing in the HUD does not move the deck             (the fix)
 *   2. arrows OUTSIDE the HUD still move it                 (not over-blocked)
 *   3. the deck still refuses to move for a guarded lesson  (unchanged)
 *   4. Escape still closes the calm overlay, then the dock  (layering intact)
 *   5. text still types, with the caret working             (no preventDefault)
 *
 * Needs a checkout of the Lessons repo. Point at it if it is not alongside:
 *   LESSONS=/path/to/Lessons node tools/verify_hud_keyboard.mjs
 *   node tools/verify_hud_keyboard.mjs --self-test
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) { /* keep looking */ }
  }
  console.error('playwright not found. Install it with:  npm i -g playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LESSONS = process.env.LESSONS
  || [path.join(SITE, '..', 'Lessons'), '/home/user/Lessons'].find((p) => fs.existsSync(p));
const SELFTEST = process.argv.includes('--self-test');

if (!LESSONS || !fs.existsSync(LESSONS)) {
  console.error('Lessons checkout not found. Set LESSONS=/path/to/Lessons');
  process.exit(2);
}

/* One deck from each population. The unguarded one is the reproduction; the
   guarded one proves the fix did not become the only thing holding the line. */
const CASES = [
  { rel: '/Lessons/primary/year5/science/autumn/forces/Lesson1_Friction.html',
    guardedByLesson: false },
  { rel: '/Lessons/Science_Teesside/Grow/SCI_G_W4_Mechanisms.html',
    guardedByLesson: true },
];

const failures = [];
const rows = [];
const assert = (cond, msg) => { if (!cond) failures.push(msg); return !!cond; };

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg', '.gif':'image/gif' };

function serve(sabotage) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const isHud = rel === '/hud.js';
      const file = isHud ? path.join(SITE, 'hud.js')
                         : path.join(LESSONS, rel.replace(/^\/Lessons\//, '/'));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      if (isHud && sabotage) {
        // Remove the guard in flight: the gate must go red without it.
        res.end(fs.readFileSync(file, 'utf8').replace(/ev\.stopPropagation\(\);\n  \}\n  \/\* Held for any target/,
          '/* guard removed by --self-test */;\n  }\n  /* Held for any target'));
        return;
      }
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Which slide is showing. The two families use different mechanisms, so read
   whichever is actually visible rather than assuming a class name. */
const slideIndex = (page) => page.evaluate(() => {
  const all = document.querySelectorAll('.slide');
  for (let i = 0; i < all.length; i++) {
    if (all[i].classList.contains('active') || all[i].classList.contains('show')
        || getComputedStyle(all[i]).display !== 'none') return i;
  }
  return -1;
});

async function run(sabotage) {
  const server = await serve(sabotage);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const c of CASES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(base + c.rel, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);

      if (!assert(await page.evaluate(() => !!document.getElementById('mbmhud-dock')),
        `${c.rel}: the HUD did not mount`)) { await page.close(); continue; }

      await page.evaluate(() => document.getElementById('mbmhud-pill').click());
      await page.waitForTimeout(250);
      await page.evaluate(() => { document.getElementById('mbmhud-names').style.display = 'block'; });

      // 1. typing in the HUD must not move the deck
      const before = await slideIndex(page);
      await page.focus('#mbmhud-names');
      await page.keyboard.type('Ada');
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press(' ');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      const afterTyping = await slideIndex(page);
      assert(afterTyping === before,
        `${c.rel}: typing in the HUD moved the deck ${before} -> ${afterTyping}`);

      // 5. and the text entry itself still works
      const value = await page.inputValue('#mbmhud-names');
      assert(value.startsWith('Ada'),
        `${c.rel}: the name list lost its text (${JSON.stringify(value)}) - a guard called preventDefault`);
      assert(/\n/.test(value),
        `${c.rel}: Enter no longer inserts a newline in the name list`);

      // 2. arrows outside the HUD must still drive the deck. Close the dock and
      //    put focus on the document body via a real click on the deck itself.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const s = document.querySelector('.slide');
        if (s) { s.setAttribute('tabindex', '-1'); s.focus(); }
      });
      const beforeOutside = await slideIndex(page);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      const afterOutside = await slideIndex(page);
      assert(afterOutside === beforeOutside + 1,
        `${c.rel}: ArrowRight outside the HUD no longer advances the deck ` +
        `(${beforeOutside} -> ${afterOutside}) - the guard is over-broad`);

      // 4. Escape layering, as the code actually defines it. Opening the calm
      //    overlay closes the dock on purpose (hud.js: calm.classList.add("on");
      //    dock.classList.remove("open")), so "innermost first" here means the
      //    calm overlay absorbs its Escape and does not let it reach the lesson.
      //    An earlier version of this gate asserted the dock stayed open across
      //    that press; it never did, and the assertion described a design that
      //    was never written.
      await page.evaluate(() => { window.__escSeenByLesson = 0;
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') window.__escSeenByLesson++;
        });
      });
      await page.evaluate(() => document.getElementById('mbmhud-pill').click());
      await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById('mbmhud-calmbtn').click());
      await page.waitForTimeout(300);
      assert(await page.evaluate(() =>
        document.getElementById('mbmhud-calm').classList.contains('on')),
        `${c.rel}: the calm overlay did not open`);
      assert(await page.evaluate(() =>
        !document.getElementById('mbmhud-dock').classList.contains('open')),
        `${c.rel}: opening the calm overlay no longer closes the dock`);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert(await page.evaluate(() =>
        !document.getElementById('mbmhud-calm').classList.contains('on')),
        `${c.rel}: Escape did not close the calm overlay`);
      assert(await page.evaluate(() => window.__escSeenByLesson) === 0,
        `${c.rel}: the calm overlay let its Escape through to the lesson`);

      // and with only the dock open, Escape closes the dock.
      await page.evaluate(() => document.getElementById('mbmhud-pill').click());
      await page.waitForTimeout(200);
      assert(await page.evaluate(() =>
        document.getElementById('mbmhud-dock').classList.contains('open')),
        `${c.rel}: the dock did not reopen`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      assert(await page.evaluate(() =>
        !document.getElementById('mbmhud-dock').classList.contains('open')),
        `${c.rel}: Escape did not close the dock`);

      assert(errs.length === 0, `${c.rel}: page errors: ${errs.slice(0, 2).join(' | ')}`);
      rows.push({ rel: c.rel, guardedByLesson: c.guardedByLesson,
                  before, afterTyping, beforeOutside, afterOutside });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

if (SELFTEST) {
  const mark = failures.length;
  await run(true);
  const caught = failures.length - mark;
  failures.length = mark; rows.length = 0;
  if (caught === 0) {
    console.error('[FAIL] self-test: the gate passed a hud.js with the guard removed');
    process.exit(1);
  }
  console.log(`[PASS] self-test: ${caught} finding(s) raised with the guard removed`);
}

await run(false);
for (const r of rows) {
  console.log(`  ${r.guardedByLesson ? 'lesson-guarded  ' : 'lesson-unguarded'} ` +
              `typing in HUD: slide ${r.before} -> ${r.afterTyping}   ` +
              `arrow outside HUD: ${r.beforeOutside} -> ${r.afterOutside}   ${r.rel}`);
}
if (failures.length) {
  console.error(`\n[FAIL] HUD keyboard containment — ${failures.length} finding(s):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n[PASS] HUD keyboard containment: typing stays in the HUD, arrows outside it still ' +
            'drive the deck, Escape layering and text entry unchanged');
