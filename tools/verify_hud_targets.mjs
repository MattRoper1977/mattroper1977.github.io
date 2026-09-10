#!/usr/bin/env node
/* The HUD dock's controls, measured as rendered, with the dock OPEN.
 *
 * WHY THIS EXISTS
 * Seven controls in the teacher dock rendered between 28 and 39 px. The figure
 * was printed on every run of another tool and gated by nothing, so it was
 * true, visible, and had no consequence. This is the surface a teacher uses in
 * front of a class on every lesson page.
 *
 * WHY THE DOCK IS OPENED FIRST
 * A closed dock is display:none, so every control in it has a zero-size box.
 * A sweep that measures a closed dock finds nothing under the floor and reports
 * green - vacuous, and worse than no gate at all because it looks like cover.
 * This gate asserts the dock actually opened before it believes any measurement.
 *
 * WHY IT MEASURES INSTEAD OF READING THE CSS
 * Deciding from the stylesheet which numbers "were not the risk" was the wrong
 * instrument. The three 34px literals in hud.js are a textarea min-height, a
 * meter display height and a font-size - none of them a touch target - and the
 * seven controls that really were under the floor appear nowhere in that
 * reading. Rendered geometry is the only evidence about rendered geometry.
 *
 * Exits: 0 clean · 1 findings · 3 INCONCLUSIVE (could not get in a position to judge)
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const LESSONS = (argv.includes('--lessons') ? argv[argv.indexOf('--lessons') + 1] : null)
  || process.env.MBM_LESSONS_ROOT
  || ['/home/user/Lessons', path.join(ROOT, '..', 'Lessons')].find(p => p && fs.existsSync(p));

const FLOOR = 44;
const VIEWPORTS = [[390, 844, '390'], [768, 1024, '768'], [1440, 900, '1440']];
const NAV_MS = 30000;

/* The four layout branches hud.js resolves BACK through. A control that is
 * fine on a lesson page and cramped on a game page is still a defect, and the
 * dock only mounts on lesson paths - so the dock sweep runs on a lesson, and
 * the always-on controls are swept on all four. */
const BRANCHES = [
  { name: 'lesson', route: null, dock: true },
  { name: 'game-root', route: '/apexgolf/', dock: false },
  { name: 'game-lessons', route: null, dock: false, lessonsGame: true },
  { name: 'app', route: null, dock: false, app: true },
];

let pass = 0;
const findings = [];
const check = (ok, label, detail = '') => {
  if (ok) { pass++; console.log(`  [PASS] ${label}${detail ? ' · ' + detail : ''}`); }
  else { findings.push(`${label}${detail ? ' · ' + detail : ''}`); console.error(`  [FAIL] ${label}${detail ? ' · ' + detail : ''}`); }
  return ok;
};
function inconclusive(why) {
  console.error(`\nINCONCLUSIVE: ${why}\nThis gate did not judge anything. That is not a pass.`);
  process.exit(3);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

function serve() {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      let url; try { url = decodeURIComponent(req.url.split('?')[0]); } catch { url = req.url.split('?')[0]; }
      let file = url.startsWith('/Lessons/') && LESSONS
        ? path.join(LESSONS, url.slice('/Lessons/'.length))
        : path.join(ROOT, url.replace(/^\//, ''));
      try {
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => resolve(s));
  });
}

/* Every control the dock owns, measured. Ids and classes are read from the
 * live DOM rather than typed here, so a control added to hud.js is swept the
 * day it lands instead of the day someone remembers to add it to a list. */
const MEASURE = () => {
  const dock = document.getElementById('mbmhud-dock');
  if (!dock) return { mounted: false };
  const open = dock.classList.contains('open') && getComputedStyle(dock).display !== 'none';
  const nodes = [...dock.querySelectorAll('button,a,textarea,input,select,[tabindex]')];
  return {
    mounted: true, open,
    controls: nodes.map(e => {
      const b = e.getBoundingClientRect();
      return {
        id: e.id || ('.' + (e.className || '').toString().trim().split(/\s+/).filter(Boolean).join('.')),
        tag: e.tagName.toLowerCase(),
        w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
        hidden: getComputedStyle(e).display === 'none' || e.offsetParent === null && getComputedStyle(e).position !== 'fixed',
      };
    }),
  };
};

async function main() {
  let chromium;
  {
    const tried = [];
    for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
      '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
      try { const m = await import(spec); chromium = m.chromium || (m.default && m.default.chromium); if (chromium) break; }
      catch (e) { tried.push(`${spec} (${e.code || e})`); }
    }
    if (!chromium) inconclusive(`playwright is not importable. Tried: ${tried.join('; ')}`);
  }
  if (!LESSONS) inconclusive('no Lessons checkout: the dock only mounts on a lesson path, so there is nothing to open');

  // A real lesson page, derived from the canonical inventory.
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mbm-search-index.json'), 'utf8'));
  /* A lesson page that actually LOADS the HUD. 106 of the 322 lesson pages in
   * the inventory carry no hud.js line, and on one of those the dock never
   * mounts - which is a fact about that page, not a defect in the dock. Picking
   * the first lesson route and reporting "the dock does not mount" would be the
   * gate measuring its own choice of target. */
  const carriesHud = e => {
    const p = path.join(LESSONS, e.route.slice('/Lessons/'.length));
    return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes('src="/hud.js"');
  };
  const lesson = idx.entries.find(e => e.category === 'lesson' && e.route.startsWith('/Lessons/') && carriesHud(e));
  if (!lesson) inconclusive('no lesson page in the inventory both exists here and loads /hud.js, so there is no dock to open');
  const lessonsGame = idx.entries.find(e => e.category === 'game' && e.route.startsWith('/Lessons/') && carriesHud(e));
  const app = idx.entries.find(e => e.category === 'app' && /Matt-s-Apps-/.test(e.route));

  const server = await serve().catch(e => inconclusive(`could not start a server: ${e}`));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const probe = await fetch(origin + '/hud.js', { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!probe || !probe.ok) inconclusive(`the gate's own server is not answering on ${origin}`);
  check(true, `the gate's own server is listening and answering`, origin);

  const browser = await chromium.launch().catch(e => inconclusive(`chromium would not launch: ${e}`));
  const routeFor = b => b.route || (b.lessonsGame ? lessonsGame && lessonsGame.route
    : b.app ? app && app.route : lesson.route);

  try {
    for (const [w, h, vp] of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
      const page = await ctx.newPage();
      for (const branch of BRANCHES) {
        const route = routeFor(branch);
        if (!route) { check(false, `${vp}px ${branch.name}: the inventory names a page for this branch`); continue; }
        const url = origin + route.split('/').map(encodeURIComponent).join('/');
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_MS });
          await page.waitForTimeout(600);
        } catch (e) {
          check(false, `${vp}px ${branch.name}: loads within ${NAV_MS} ms`, String(e).slice(0, 90));
          continue;
        }
        // always-on controls, every branch
        for (const id of ['mbmhud-back']) {
          const box = await page.evaluate(i => {
            const e = document.getElementById(i); if (!e) return null;
            const b = e.getBoundingClientRect(); return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
          }, id);
          if (box) check(box.w >= FLOOR && box.h >= FLOOR,
            `${vp}px ${branch.name}: #${id} meets the ${FLOOR} px floor`, `${box.w}x${box.h}`);
        }
        if (!branch.dock) continue;

        // OPEN THE DOCK. A closed dock has zero-size controls.
        await page.click('#mbmhud-pill', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(350);
        const m = await page.evaluate(MEASURE);
        if (!check(m.mounted, `${vp}px ${branch.name}: the dock mounts on a lesson path`)) continue;
        if (!check(m.open, `${vp}px ${branch.name}: the dock actually OPENED before anything was measured`)) continue;
        check(m.controls.length > 0, `${vp}px ${branch.name}: the open dock exposes controls to measure`,
          `${m.controls.length} found`);
        for (const c of m.controls) {
          if (c.hidden || (c.w === 0 && c.h === 0)) continue;   // the names textarea is display:none until Edit
          check(c.w >= FLOOR && c.h >= FLOOR,
            `${vp}px ${branch.name}: ${c.id} meets the ${FLOOR} px floor`, `${c.w}x${c.h}`);
        }
      }
      await ctx.close();
    }

    /* CONTROL: serve the PRE-FIX hud.js and the sweep must report the six
     * controls it was built to catch.
     *
     * Mutating inline styles from inside the page was the first attempt and it
     * was the wrong instrument: the buttons carry a 1.5 px border and sit in a
     * flex row, so a height set from script kept measuring at or above the
     * floor and the control "failed to fail" - it would have certified a gate
     * that could not go red. Rebuilding the actual defect - the .mbmhud-btn
     * rule without its min-height - proves this sweep would have caught the
     * thing it exists to catch. */
    console.log('\n  --- control: the pre-fix hud.js must go red ---');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const hudSrc = fs.readFileSync(path.join(ROOT, 'hud.js'), 'utf8');
    const preFix = hudSrc.replace('cursor:pointer;box-sizing:border-box;min-height:44px;display:inline-flex;align-items:center;justify-content:center}',
      'cursor:pointer}');
    if (preFix === hudSrc) {
      check(false, 'control: the pre-fix .mbmhud-btn rule could be reconstructed',
        'the rule this control reverses is not in hud.js in the form it expects');
    } else {
      await ctx.route('**/hud.js', r => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: preFix }));
      const page = await ctx.newPage();
      await page.goto(origin + lesson.route.split('/').map(encodeURIComponent).join('/'),
        { waitUntil: 'domcontentloaded', timeout: NAV_MS });
      await page.waitForTimeout(600);
      await page.click('#mbmhud-pill', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(350);
      const m = await page.evaluate(MEASURE);
      const under = (m.controls || []).filter(c => !c.hidden && (c.w || c.h) && (c.w < FLOOR || c.h < FLOOR));
      check(m.open === true, 'control: the dock opened on the pre-fix build too');
      check(under.length >= 6,
        'control: the pre-fix build puts controls under the floor and this sweep reports them',
        `${under.length} under ${FLOOR} px: ` + under.map(c => `${c.id} ${c.w}x${c.h}`).join(', '));
    }
    await ctx.close();
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }

  console.log(`\n${pass} passed · ${findings.length} failed`);
  if (findings.length) {
    console.error('\nFindings:');
    findings.forEach(f => console.error('  · ' + f));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => inconclusive(`the gate threw before it could judge: ${(e && e.stack) || e}`));
