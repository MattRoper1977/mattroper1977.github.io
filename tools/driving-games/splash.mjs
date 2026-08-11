// The skip-leak instrument.
//
// This is the whole reason tools/render_splash.py is HELD: the shared donor
// lets the skip key and the skip tap through to the game underneath (26
// measured S2/S3 failures). Neither game here uses that donor, so each one's
// own splash has to be proved clean rather than assumed.
//
// The probe is a listener on `document` in the BUBBLE phase. The splash
// consumes the event at window/capture -- the earliest point there is -- so if
// the document listener ever fires while the splash is up, the event reached
// the page beneath it. That is the leak, observed directly.
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';

const file = process.argv[2];
if (!file) { console.error('usage: splash.mjs <file.html>'); process.exit(2); }

const fails = [];
const t = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function trial(kind) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__leak = { key: 0, tap: 0, splashUp: false };
    const up = () => {
      const el = document.querySelector('#mbmSplash, .mbm-splash');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    // Bubble phase on document: only reached if nothing consumed the event.
    document.addEventListener('keydown', () => { if (up()) window.__leak.key++; }, false);
    document.addEventListener('pointerdown', () => { if (up()) window.__leak.tap++; }, false);
    window.__splashUp = up;
  });
  await page.goto(pathToFileURL(file).href);
  // Act EARLY, while the splash is definitely still up (it holds ~1.75s).
  await page.waitForTimeout(500);
  const upBefore = await page.evaluate(() => window.__splashUp());
  if (kind === 'key') await page.keyboard.press('Space');
  else await page.mouse.click(450, 350);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    leak: window.__leak,
    up: window.__splashUp(),
  }));
  await ctx.close();
  return { upBefore, ...r };
}

console.log(`\n=== ${file.split('/').slice(-2).join('/')} — splash skip leak ===`);

const k = await trial('key');
t('S1 splash was still up when the key was pressed', k.upBefore === true, JSON.stringify(k));
t('S2 skip KEY does not reach the game underneath', k.leak.key === 0, JSON.stringify(k.leak));
t('S3 skip key actually dismissed the splash', k.up === false, `still up: ${k.up}`);

const p = await trial('tap');
t('S4 splash was still up when the tap landed', p.upBefore === true, JSON.stringify(p));
t('S5 skip TAP does not reach the game underneath', p.leak.tap === 0, JSON.stringify(p.leak));
t('S6 skip tap actually dismissed the splash', p.up === false, `still up: ${p.up}`);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
