// GATE Z capture harness.
// Asserts storage is empty BEFORE the first frame, captures page beats at
// 1920x1080, and refuses to write a frame if the clean-profile assertion fails.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || '/tmp/claude-0/film/raw';
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  // name,               base,  path,                                    scrollTo(px) or selector
  ['home-hero',          8501, '/index.html',                            0],
  ['home-doors',         8501, '/index.html',                            'DOORS'],
  ['privacy-lead',       8501, '/privacy/index.html',                    0],
  ['privacy-table',      8501, '/privacy/index.html',                    'TABLE'],
  ['members-h1',         8501, '/members/index.html',                    0],
  ['bio-w3-microscopy',  8502, '/Science_Teesside/Launch/SCI_L_W3_L1_Microscopy.html', 0],
  ['bio-w5-osmosis',     8502, '/Science_Teesside/Launch/SCI_L_W5_L2_OsmosisCP.html',  0],
  ['bio-w6-active',      8502, '/Science_Teesside/Launch/SCI_L_W6_L1_ActiveTransport.html', 0],
  ['bio-w7-command',     8502, '/Science_Teesside/Launch/SCI_L_W7_L2_CommandWords.html', 0],
];

const b = await chromium.launch();
const textManifest = {};
let gateZfails = 0;
const report = [];

for (const [name, port, path, scroll] of SHOTS) {
  // A FRESH CONTEXT PER SHOT = a clean browser profile. No storage carried in.
  const ctx = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',       // calm-motion: no page animation mid-capture
  });
  const p = await ctx.newPage();

  // ---- GATE Z, PART 1: the PROFILE must be empty BEFORE we navigate. ----
  // Measured on the origin, before the page has run a line of its own code.
  // The first version of this checked AFTER goto and failed on the homepage,
  // because the visit counter writes mbm_c_visits_total during load. That was
  // the assertion measuring the wrong moment, not a dirty profile.
  await p.goto('http://127.0.0.1:' + port + '/404.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
  const before = await p.evaluate(async () => {
    const ls = []; try { for (let i = 0; i < localStorage.length; i++) ls.push(localStorage.key(i)); } catch (e) {}
    let dbs = []; try { if (indexedDB.databases) dbs = (await indexedDB.databases()).map(d => d.name); } catch (e) {}
    return { ls, dbs, cookie: document.cookie };
  });
  const profileClean = before.ls.length === 0 && before.dbs.length === 0 && !before.cookie;

  await p.goto('http://127.0.0.1:' + port + path, { waitUntil: 'networkidle', timeout: 30000 });

  // ---- GATE Z, PART 2: whatever the page wrote itself must not be pupil data ----
  const after = await p.evaluate(async () => {
    const ls = []; try { for (let i = 0; i < localStorage.length; i++) ls.push(localStorage.key(i)); } catch (e) {}
    let dbs = []; try { if (indexedDB.databases) dbs = (await indexedDB.databases()).map(d => d.name); } catch (e) {}
    return { ls, dbs, cc: localStorage.getItem('mbm_cc_v1') };
  });
  // Keys that could hold a person: the class-list picker, registers, HUD names.
  const PUPIL_KEYS = /mbm_cc_v1|hud_names|uas_register|asdan_register|pupil|register|marks/i;
  const pupilish = after.ls.filter(k => PUPIL_KEYS.test(k))
    .concat(after.dbs.filter(d => PUPIL_KEYS.test(d)));
  const clean = profileClean && pupilish.length === 0 && after.cc === null;

  report.push({ name, before: before.ls.length, wrote: after.ls, dbs: after.dbs, pupilish, clean });
  if (!clean) {
    gateZfails++;
    console.log('  GATE Z FAIL ' + name + '  profileCleanBeforeNav=' + profileClean +
      '  pupil-shaped=' + JSON.stringify(pupilish) + '  cc=' + after.cc);
    await ctx.close();
    continue;
  }

  await p.evaluate(() => new Promise(r => setTimeout(r, 1400)));

  if (scroll === 'DOORS') {
    await p.evaluate(() => {
      const el = document.querySelector('[data-zone="games"]') || document.querySelector('[data-zone]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  } else if (scroll === 'TABLE') {
    await p.evaluate(() => {
      const el = document.querySelector('.pv-tbl');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  } else if (typeof scroll === 'number' && scroll) {
    await p.evaluate(y => window.scrollTo(0, y), scroll);
  }
  await p.evaluate(() => new Promise(r => setTimeout(r, 700)));

  // Authoritative text for the GATE Z inventory: the exact strings the browser
  // laid out, captured at the same instant as the pixels. OCR is kept for the
  // Apex Kick canvas, which has no DOM text at all.
  const visible = await p.evaluate(() => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = walk.nextNode())) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const el = n.parentElement; if (!el) continue;
      const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      out.push(t);
    }
    return out;
  });
  textManifest[name] = visible;

  await p.screenshot({ path: OUT + '/' + name + '.png' });
  console.log('  captured ' + name.padEnd(20) + ' clean-profile OK');
  await ctx.close();
}
await b.close();

console.log('');
console.log('GATE Z PRE-FRAME ASSERTION');
console.log('POPULATION: ' + SHOTS.length + ' shots attempted');
console.log('  shots passing both parts: ' + report.filter(r => r.clean).length + '/' + report.length);
console.log('  localStorage keys in the profile BEFORE navigation: ' + report.reduce((a, r) => a + r.before, 0));
const wrote = {}; report.forEach(r => (r.wrote||[]).forEach(k => wrote[k] = (wrote[k]||0)+1));
console.log('  keys the pages wrote themselves during load: ' + Object.keys(wrote).length);
Object.entries(wrote).forEach(([k,n]) => console.log('      ' + k.padEnd(26) + ' on ' + n + ' shot(s)'));
const dbs = {}; report.forEach(r => (r.dbs||[]).forEach(k => dbs[k] = (dbs[k]||0)+1));
console.log('  IndexedDB databases created: ' + Object.keys(dbs).length + (Object.keys(dbs).length?' -> '+Object.keys(dbs).join(', '):''));
console.log('  PUPIL-SHAPED keys or databases, any shot: ' + report.reduce((a,r)=>a+r.pupilish.length,0));
console.log('  mbm_cc_v1 (the class-list key) present on: ' + report.filter(r => r.cc != null).length + ' shots');
fs.writeFileSync(OUT + '/text_manifest.json', JSON.stringify(textManifest, null, 1));
console.log('  text manifest written: ' + Object.keys(textManifest).length + ' shots');
console.log('  GATE Z FAILURES: ' + gateZfails);
if (gateZfails) process.exit(1);
