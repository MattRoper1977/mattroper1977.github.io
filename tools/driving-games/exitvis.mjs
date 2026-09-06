// The inline exit control, judged where it matters: on screen.
//
// Presence in the bytes is not the promise. The /neonbreach/ precedent is a
// script that was admitted to a game and then rendered nothing for months with
// nothing paired to notice. So this asks the browser for the painted rect, at
// three viewports, and also checks NOTHING COVERS IT -- a 44px control under
// an opaque HUD is not an exit.
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';

const files = process.argv.slice(2);
const VIEWPORTS = [
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 800 },
];

let failed = 0;
const t = (n, ok, d = '') => { if (!ok) failed++; console.log(`${ok ? '  PASS' : '  FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

for (const f of files) {
  console.log(`\n=== ${f.split('/').slice(-2).join('/')} ===`);
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(f).href);
    await page.waitForTimeout(3200);
    // Dismiss the splash so the control is judged in the state a player is in.
    await page.evaluate(() => { try { window.__mbmSplashClose && window.__mbmSplashClose(); } catch (e) {} });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const a = document.getElementById('mbmexit-back');
      if (!a) return { present: false };
      const b = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      // What is actually on top at the control's centre?
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        present: true, w: Math.round(b.width), h: Math.round(b.height),
        x: Math.round(b.left), y: Math.round(b.top),
        vis: cs.visibility, disp: cs.display, op: Number(cs.opacity),
        onTop: !!(top && (top === a || a.contains(top))),
        topEl: top ? (top.id || top.tagName) : null,
        inView: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
        href: a.getAttribute('href'), label: a.getAttribute('aria-label'),
      };
    });
    const ok = r.present && r.w >= 44 && r.h >= 44 && r.vis !== 'hidden' &&
      r.disp !== 'none' && r.op > 0.3 && r.inView && r.onTop;
    t(`[${vp.name}] exit control rendered, >=44px, on top, in view`, ok, JSON.stringify(r));
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
