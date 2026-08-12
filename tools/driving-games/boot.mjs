// Boot instrument for the two driving games.
//
// R9: this proves it can exit non-zero before any green from it counts. Run
// with --selftest to boot a deliberately broken copy; that MUST fail.
//
// It polls rather than single-samples: a splash that self-closes at 1.75s
// reads as absent to one sample, and a ReferenceError thrown inside a
// try/catch (the trap this repo has been bitten by three times) leaves no
// console trace at all -- so the check is on OBSERVED STATE, not on logs.
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { sampleCanvas } from './pixels.mjs';

const file = process.argv[2];
const selftest = process.argv.includes('--selftest');
if (!file) { console.error('usage: boot.mjs <file.html> [--selftest]'); process.exit(2); }

const fails = [];
const t = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const offOrigin = [];
page.on('request', r => {
  const u = r.url();
  if (!u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
});

// Poll a predicate until it holds or the budget runs out.
async function until(fn, ms = 9000, step = 150, arg = undefined) {
  const end = Date.now() + ms;
  for (;;) {
    let v = null;
    try { v = await page.evaluate(fn, arg); } catch (_) { v = null; }
    if (v) return v;
    if (Date.now() > end) return null;
    await page.waitForTimeout(step);
  }
}

// The splash lives for ~2.2s. Any check that runs after a settle wait is
// asking a question the answer has already left -- so record its lifecycle
// from t=0 inside the page, and read the RECORD afterwards.
await page.addInitScript(() => {
  window.__splashLog = { everCovered: false, maxW: 0, maxH: 0, closedAt: 0, seenAt: 0 };
  const tick = () => {
    const el = document.querySelector('#mbmSplash, .mbm-splash');
    if (el) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const shown = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
      if (shown) {
        window.__splashLog.maxW = Math.max(window.__splashLog.maxW, r.width);
        window.__splashLog.maxH = Math.max(window.__splashLog.maxH, r.height);
        if (r.width > 200 && r.height > 200) {
          window.__splashLog.everCovered = true;
          window.__splashLog.seenAt = window.__splashLog.seenAt || performance.now();
        }
      } else if (window.__splashLog.everCovered && !window.__splashLog.closedAt) {
        window.__splashLog.closedAt = performance.now();
      }
    } else if (window.__splashLog.everCovered && !window.__splashLog.closedAt) {
      window.__splashLog.closedAt = performance.now();
    }
  };
  setInterval(tick, 60);
  tick();
});

await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(4200);

console.log(`\n=== ${file.split('/').slice(-2).join('/')} ===`);

// 1. No uncaught error on the boot path. The TDZ trap this repo records three
//    times is silent when wrapped, so this is necessary but never sufficient.
t('B1 no uncaught page error on boot', errors.length === 0, errors.slice(0, 2).join(' | '));

// 2. R1: nothing off-origin, ever.
t('B2 zero off-origin requests (R1)', offOrigin.length === 0, offOrigin.slice(0, 3).join(' '));

// 3. The splash actually PLAYED and then actually LEFT. A title screen that
//    covers the viewport forever would pass a "something is covering" check;
//    requiring it to vanish is what distinguishes the two.
// Identity comes from a STABLE selector. An earlier draft of this check keyed
// on [data-mbm-splash-state], which close() re-creates on its way out -- so it
// answered "did a splash ever exist", which a closed splash also satisfies.
// That is the self-healing-selector trap, and it made this check unfailable.
const sl = await page.evaluate(() => window.__splashLog);
t('B3 splash played and covered the viewport', !!(sl && sl.everCovered), JSON.stringify(sl));
// Requiring it to VANISH is what separates a splash from a title screen, which
// also covers the viewport and never leaves.
t('B4 splash self-closes', !!(sl && sl.everCovered && sl.closedAt > 0), JSON.stringify(sl));

// 4. The module actually evaluated to the bottom. A const in its temporal dead
//    zone throws where it is touched, and a bare catch eats it -- so ask the
//    page for a symbol that only exists if evaluation REACHED the end.
// Neither game renders on load: Neon Meridian holds a #boot card behind a
// "DRIVE NOW" button and Rally holds a menu, so a canvas check taken at boot
// measures a game that was never asked to start -- the same shape as the
// cutscene trap this estate already records. Press play, THEN judge pixels.
const started = await page.evaluate(() => {
  const btn = document.querySelector('#playBtn, #startBtn, [data-mbm-play]');
  if (btn) { btn.click(); return 'clicked:' + (btn.id || 'play'); }
  return null;
});
if (started) await page.waitForTimeout(3000);
console.log(`  note  start: ${started || 'no play button found; judging as-loaded'}`);

// The main script only sizes the canvas and takes its GL context if evaluation
// got that far. A canvas left at 300x150 with no style width is the BROWSER
// DEFAULT -- the exact proxy this repo records as passing on a canvas that was
// never initialised -- so this compares against the viewport, per that lesson.
const canv = await until(() => {
  const c = document.querySelector('canvas#gl, canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  const def = (c.width === 300 && c.height === 150);
  return { w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height),
    vw: innerWidth, vh: innerHeight, def };
}, 6000);
t('B5 main script evaluated far enough to size the canvas',
  !!canv && !canv.def && canv.cssW >= canv.vw * 0.8 && canv.cssH >= canv.vh * 0.5,
  JSON.stringify(canv));

// Whether a WebGL context EXISTS is not evidence: getContext() on a canvas the
// game never touched returns a fresh one, and an earlier draft of this check
// passed on a build whose script had died before the GL setup line. So judge
// the PIXELS -- distinct colours across a grid, the same non-blankness-by-
// statistics bar the estate's artwork gates use.
const px = await sampleCanvas(page);
t('B5b canvas actually painted (distinct colours, not blank)',
  !!(px && !px.err && px.distinct >= 4 && px.lit > px.total * 0.05), JSON.stringify(px));

// 5. Reduced-motion plumbing is observable from outside, per house pattern.
const rmAttr = await page.evaluate(() =>
  document.documentElement.dataset.mbmReduce ?? document.body.dataset.mbmReduce ?? null);
t('B6 reduced-motion state is exposed on the document', rmAttr === '0' || rmAttr === '1',
  `data-mbm-reduce=${rmAttr}`);

// 6. The inline exit control, if stamped, must be VISIBLE -- not merely present
//    in the bytes. Eleven games carry it; presence is not the promise.
const exit = await page.evaluate(() => {
  const a = document.getElementById('mbmexit-back');
  if (!a) return { present: false };
  const r = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  return { present: true, w: Math.round(r.width), h: Math.round(r.height),
    vis: cs.visibility, disp: cs.display, op: cs.opacity };
});
if (exit.present) {
  t('B7 inline exit rendered at >=44px', exit.w >= 44 && exit.h >= 44, JSON.stringify(exit));
} else {
  console.log('  SKIP  B7 inline exit not stamped in this file yet');
}

await browser.close();

if (selftest) {
  console.log(`\nselftest: expected failures, got ${fails.length}`);
  process.exit(fails.length > 0 ? 0 : 1);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
