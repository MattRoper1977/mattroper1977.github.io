#!/usr/bin/env node
/*
 * THE `uas_register` CLEAR AFFORDANCE — A NAMED EXEMPTION, WITH ITS REASON.
 *
 * Ruled 2026-08-25: ACCEPTED, NOT FIXED.
 *
 *   Settings -> Export backup (.json)   181x41   #bk-export
 *   Settings -> Delete all data         129x39   #wipe
 *
 * /privacy/ names `uas_register` as a store this device holds — pupil
 * forenames, surnames, learner numbers, marks, registers, evidence photos —
 * and names these two controls as the way to take it off the device. Both are
 * under 44px, and both are two taps deep behind the Settings tab.
 *
 * WHY THAT IS ACCEPTABLE HERE, and nowhere else:
 *
 *   /uas/app.html is an adult desktop tool. It is reached from /teach/,
 *   /for/teachers/ and /asdan/ — never from the pupil homepage. Nothing on it
 *   is a target a child scans for on a phone; it is a form a teacher fills in
 *   at a desk, and the clear affordance is a deliberate destructive action at
 *   the bottom of a settings panel rather than something to hit in passing.
 *
 * The exemption is recorded HERE, in a gate, so the next reader does not
 * re-raise it as a finding — and so it cannot be quietly widened. The reason
 * is ASSERTED, not just written down:
 *
 *   - /privacy/ still names the store AND both controls, verbatim. An
 *     affordance the disclosure no longer points at is not the thing that was
 *     ruled on.
 *   - Both controls are still two taps deep: absent on load, present after
 *     Settings. The moment one appears on the landing tab it is an incidental
 *     target on a scanning surface and this exemption stops covering it.
 *   - No pupil surface links to /uas/. That is read from
 *     data/audience-homepages.json and from the served HTML, not from memory.
 *   - The two ruled controls are not the smallest thing on the panel. An
 *     exemption must not become a licence to shrink the thing it covers.
 *
 * WHAT THIS GATE DOES NOT CLAIM. It is not a 44px pass for /uas/. The whole
 * panel is a 36-41px desktop tool and the full census is PRINTED below, at
 * desktop and at 390px, so nobody reads a green here as "everything else is
 * 44". Two controls were raised and ruled; the rest of the panel is the same
 * adult tool and has never been in front of a child.
 *
 * Usage: node tools/verify_uas_register_exemption.mjs [repo-root]
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.join(HERE, '..');
const APP = path.join(ROOT, 'uas', 'app.html');
const PRIVACY = path.join(ROOT, 'privacy', 'index.html');
const AUDIENCES = path.join(ROOT, 'data', 'audience-homepages.json');

/* The two controls, named. Enumerated rather than a rule, so a third
   undersized control in this panel is not silently covered by the ruling that
   was made about these two. */
const EXEMPT = [
  { id: 'bk-export', label: 'Export backup (.json)',
    why: 'takes uas_register off the device before a shared laptop is handed on' },
  { id: 'wipe', label: 'Delete all data',
    why: 'the clear affordance /privacy/ names, and it states what it will delete first' },
];
const TAB = 'Settings';

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try { const m = await import(spec); chromium = m.chromium || (m.default && m.default.chromium); if (chromium) break; }
  catch (e) { /* next */ }
}
if (!chromium) {
  console.error('INCONCLUSIVE: playwright is not importable, so no panel was ever painted.');
  console.error('This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
}

/* Measure the panel twice: as it lands, and with the Settings tab open.
   The DIFFERENCE is the load-bearing measurement — "two taps deep" is only a
   reason while the controls are genuinely not on the landing tab. */
async function measurePanel(root, viewport) {
  const s = serve(root);
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${s.address().port}`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 100)));
  await page.goto(origin + '/uas/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(700);

  const census = () => page.evaluate(() => {
    const SEL = 'a,button,summary,input,select,textarea,[role="button"]';
    const shown = [...document.querySelectorAll(SEL)].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    const row = e => {
      const r = e.getBoundingClientRect();
      return { id: e.id || '', tag: e.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height),
        disabled: !!e.disabled,
        txt: (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 34) };
    };
    return { laid: shown.length, all: shown.map(row), under: shown.map(row).filter(o => o.h < 44 || o.w < 44) };
  });

  const loaded = await census();
  /* CONTROL for the census itself: a deliberately tiny control must be seen.
     A census that cannot see a 20x20 button is not measuring anything. */
  const control = await page.evaluate(() => {
    const b = document.createElement('button');
    b.id = '__probe20'; b.textContent = 'x';
    b.style.cssText = 'width:20px;height:20px;padding:0;position:fixed;left:0;top:0';
    document.body.appendChild(b);
    return true;
  });
  const withProbe = await census();
  await page.evaluate(() => document.getElementById('__probe20')?.remove());

  const tapped = await page.evaluate((tab) => {
    const c = [...document.querySelectorAll('a,button,summary,[role="button"],[role="tab"]')]
      .filter(e => new RegExp(`^\\s*${tab}\\s*$`, 'i').test(e.textContent || ''));
    if (!c.length) return false;
    c[0].click(); return true;
  }, TAB);
  await page.waitForTimeout(600);
  const opened = await census();

  await browser.close(); s.close();
  return { errs, loaded, opened, tapped,
    probeSeen: withProbe.under.some(o => o.id === '__probe20') && control };
}

console.log('=== THE `uas_register` CLEAR AFFORDANCE — A NAMED EXEMPTION ===\n');
for (const e of EXEMPT) console.log(`  exempt: #${e.id.padEnd(10)} "${e.label}" — ${e.why}`);
console.log();

/* ---- limb 1: /privacy/ still names the store AND both controls ---- */
const privacy = fs.readFileSync(PRIVACY, 'utf8');
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const prose = strip(privacy);
check(prose.includes('uas_register'), '/privacy/ still names the store this exemption is about',
  'uas_register appears in the served prose');
const named = EXEMPT.filter(e => prose.includes(e.label));
check(named.length === EXEMPT.length,
  '/privacy/ still names BOTH controls verbatim — an affordance the disclosure no longer points at is not the one that was ruled on',
  named.map(e => `"${e.label}"`).join(' · ') || '(none)');

/* CONTROL: take one label out of a scratch copy and the limb must red. A limb
   that passes on a page that no longer names the control is not checking the
   binding, it is checking that the file is non-empty. */
{
  const mutated = privacy.replace(EXEMPT[1].label, 'Wipe it');
  const moved = mutated !== privacy;
  const stillNamed = EXEMPT.filter(e => strip(mutated).includes(e.label));
  check(moved && stillNamed.length === EXEMPT.length - 1,
    'CONTROL: rename the clear affordance on /privacy/ and the binding limb reds',
    `edit real=${moved}, ${stillNamed.length} of ${EXEMPT.length} still named`);
}

/* ---- limbs 2-4: the panel itself, at two viewports ---- */
const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900 }],
  ['390px  ', { width: 390, height: 844 }],
];
const results = {};
for (const [name, vp] of VIEWPORTS) results[name] = await measurePanel(ROOT, vp);

console.log('\n  --- the panel, measured. THIS IS THE WHOLE CENSUS, not just the exempt two ---');
for (const [name, vp] of VIEWPORTS) {
  const r = results[name];
  console.log(`  ${name}  ${vp.width}x${vp.height}   on load: ${r.loaded.laid} laid out, ${r.loaded.under.length} under 44px` +
              `   ·  Settings open: ${r.opened.laid} laid out, ${r.opened.under.length} under 44px`);
  for (const u of r.opened.under) {
    const tag = EXEMPT.some(e => e.id === u.id) ? '  <-- named exemption' : '';
    console.log(`             ${String(u.w).padStart(3)}x${String(u.h).padStart(2)} <${u.tag}> ${JSON.stringify(u.txt)}${u.id ? ' #' + u.id : ''}${tag}`);
  }
}
console.log();

for (const [name] of VIEWPORTS) {
  const r = results[name];
  const tag = name.trim();
  check(r.errs.length === 0, `${tag}: the panel painted without a page error`, r.errs.join(' | ') || 'none');
  check(r.probeSeen, `${tag}: CONTROL — a deliberately 20x20 control IS counted by this census`,
    `probe seen = ${r.probeSeen}`);
  check(r.tapped, `${tag}: the ${TAB} tab exists and was tapped`, `tapped=${r.tapped}`);

  const openIds = new Set(r.opened.all.map(o => o.id));
  const loadIds = new Set(r.loaded.all.map(o => o.id));
  const present = EXEMPT.filter(e => openIds.has(e.id));
  check(present.length === EXEMPT.length,
    `${tag}: both named controls still exist — an exemption for a target that has gone is a licence nobody is using`,
    `${present.length} of ${EXEMPT.length}`);

  const enabled = EXEMPT.filter(e => { const o = r.opened.all.find(x => x.id === e.id); return o && !o.disabled; });
  check(enabled.length === EXEMPT.length,
    `${tag}: and both are enabled — a clear affordance you cannot press is not one`,
    `${enabled.length} of ${EXEMPT.length}`);

  const deep = EXEMPT.filter(e => !loadIds.has(e.id) && openIds.has(e.id));
  check(deep.length === EXEMPT.length,
    `${tag}: both are TWO TAPS DEEP — absent on the landing tab, present once ${TAB} is open. That is the reason, so it is measured`,
    `${deep.length} of ${EXEMPT.length} appear only after ${TAB}`);

  /* Derived, never pinned: a written-down 39/41 would red on the next font
     change rather than on a defect. What must not happen is the exemption
     being used to shrink the very controls it covers, so compare them to the
     panel they sit in. */
  const others = r.opened.under.filter(o => !EXEMPT.some(e => e.id === o.id));
  const floorH = Math.min(...others.map(o => o.h));
  const floorW = Math.min(...others.map(o => o.w));
  const shrunk = EXEMPT.map(e => r.opened.all.find(o => o.id === e.id))
    .filter(o => o && (o.h < floorH || o.w < floorW));
  check(shrunk.length === 0,
    `${tag}: neither ruled control is smaller than the panel around it — an exemption is not a licence to shrink what it covers`,
    `panel floor ${floorW}x${floorH}; ` + EXEMPT.map(e => {
      const o = r.opened.all.find(x => x.id === e.id); return `#${e.id} ${o ? o.w + 'x' + o.h : 'MISSING'}`;
    }).join(' · '));
}

/* ---- limb 5: not a pupil surface ---- */
console.log();
const aud = JSON.parse(fs.readFileSync(AUDIENCES, 'utf8'));
const pupilRoute = aud.audiences.pupils.route;
const pupilFile = path.join(ROOT, pupilRoute.replace(/^\//, ''), 'index.html');
check(fs.existsSync(pupilFile), 'the pupil surface is read from data/audience-homepages.json, not from memory',
  `${pupilRoute} -> ${path.relative(ROOT, pupilFile)}`);
const pupilHtml = fs.readFileSync(pupilFile, 'utf8');
check(!/href="\/uas\//.test(pupilHtml),
  'no pupil surface links to /uas/ — the reason this exemption exists is that a child never arrives here',
  `${(pupilHtml.match(/href="\/uas\//g) || []).length} link(s) from ${pupilRoute}`);

/* Who DOES link to it, derived by walking the served HTML. Printed so the
   claim "adult tool" is a fact somebody can check rather than an adjective. */
const linkers = [];
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    if (n === '.git' || n === 'node_modules' || n === 'uas') continue;
    const abs = path.join(dir, n);
    let st; try { st = fs.statSync(abs); } catch (_) { continue; }
    if (st.isDirectory()) walk(abs);
    else if (n.endsWith('.html') && /href="\/uas\//.test(fs.readFileSync(abs, 'utf8')))
      linkers.push('/' + path.relative(ROOT, abs).replace(/index\.html$/, ''));
  }
})(ROOT);
console.log(`  reached from: ${linkers.sort().join(' · ') || '(nothing)'}`);
check(linkers.length > 0 && !linkers.includes(pupilRoute),
  'and the surfaces that DO reach it are adult ones, named here rather than assumed',
  `${linkers.length} linking surface(s), none of them ${pupilRoute}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
