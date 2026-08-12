/* The binding proof for Rally's championship band.
 *
 * The commission is explicit: new stages must record AND race ghosts exactly
 * like the shipped ones. A stage that loads and looks right but cannot hold a
 * ghost is not a stage in this game -- ghost racing is the thing the game is
 * for, and mbm_rallyvector_ghosts_v2 is a sacred key (R3).
 *
 * So for every stage, shipped and new alike, this asserts:
 *   the track BUILDS from its points list (a self-intersecting loop would not);
 *   it is DRIVABLE -- the autopilot makes real progress round it;
 *   pace notes were derived for it (makeNotes() runs off curvature, so a
 *     geometrically dead stage would produce none);
 *   a ghost RECORDS to that stage's own key, and
 *   the recorded ghost LOADS BACK and is raced.
 *
 * The shipped three are included deliberately: a test that only covers the new
 * work cannot tell you the new work broke the old.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FPS = 60;
const STAGES = ['alpine', 'desert', 'nordic', 'coastal', 'timber', 'canyon'];
const SHIPPED = new Set(['alpine', 'desert', 'nordic']);

const CLOCK = `(() => { let now=0; const step=1000/${FPS}; performance.now=()=>now;
  const q=[]; window.requestAnimationFrame=cb=>{q.push(cb);return q.length};
  window.cancelAnimationFrame=()=>{};
  window.__drive=f=>{for(let i=0;i<f;i++){now+=step;const b=q.splice(0,q.length);for(const cb of b){try{cb(now)}catch(e){}}}return now};})();`;

let failed = 0;
const t = (n, ok, d = '') => { if (!ok) failed++; console.log(`${ok ? '  PASS' : '  FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

for (const id of STAGES) {
  const tag = SHIPPED.has(id) ? 'shipped' : 'NEW';
  console.log(`\n=== ${id} (${tag}) ===`);
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(CLOCK);
  await page.addInitScript(t => {
    try {
      localStorage.setItem('mbm_rallyvector_3d_v1',
        JSON.stringify({ settings: { track: t, weather: 'clear', time: 'day' } }));
    } catch (e) {}
  }, id);
  page.setDefaultNavigationTimeout(120000);
  await page.goto('file://' + path.join(ROOT, 'rallyvector3d', 'index.html'), { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { try { window.__mbmSplashClose(); } catch (e) {} });

  // The save must survive the sanitiser: an id missing from SAFE.tracks is
  // silently rewritten to alpine, which would make every other check below
  // pass against the WRONG STAGE.
  const chosen = await page.evaluate(() => window.__RV.track());
  t(`${id}: survives the save sanitiser (not silently reset)`, chosen === id, `loaded '${chosen}'`);

  await page.evaluate(() => { const b = document.querySelector('#startBtn'); if (b) b.click(); });
  await page.evaluate(f => window.__drive(f), 60);
  await page.evaluate(() => { window.__RV.skipCountdown(); window.__RV.autopilot(true); });
  await page.evaluate(f => window.__drive(f), 900);

  const st = await page.evaluate(() => window.__RV.state());
  t(`${id}: track built and is drivable`, st.mode === 'running' && st.progress > 0.10 && st.speed > 8,
    JSON.stringify(st));

  const notes = await page.evaluate(() => window.__RV.noteCount());
  t(`${id}: pace notes derived from its curvature`, notes >= 3, `${notes} notes`);

  // Record a ghost through the game's OWN system, then read it back from the
  // game's own key. Writing a blob by hand would prove nothing about whether
  // this stage can hold one.
  const rec = await page.evaluate(() => window.__RV.recordGhost(42.5));
  // The recording must be the game's own, and long enough for cleanGhost to
  // accept it -- otherwise "stored" would be measuring a stub.
  t(`${id}: the game recorded a real run (>=10 frames)`,
    !!rec && rec.recordedFrames >= 10, JSON.stringify(rec));
  t(`${id}: ghost accepted and stored under this stage's own key`,
    !!rec && rec.accepted && rec.stored > 0, JSON.stringify(rec));

  const back = await page.evaluate(() => window.__RV.readGhost());
  t(`${id}: recorded ghost loads back and can be raced`,
    !!back && back.entries > 0 && back.telemetry > 0, JSON.stringify(back));

  t(`${id}: no uncaught error`, errs.length === 0, errs.slice(0, 1).join(''));
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
