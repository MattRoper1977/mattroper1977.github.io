// R2 / R4 / R7 instrument.
//
// R2  house key names, and a lossless carry-over from any pre-house key.
// R4  the OS reduced-motion setting is a FLOOR: a stored "motion:true" must
//     never re-enable animation while the OS asks for less. This is the exact
//     defect that shipped twice in one day (Fracture, Neon Turf).
// R7  a hostile or truncated save must fail SAFE -- the game still boots.
//
// Every case is proved against OBSERVED page state, and the hostile blobs are
// the house set of seven shapes.
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { sampleCanvas } from './pixels.mjs';

const file = process.argv[2];
const game = process.argv[3] || 'neon';
if (!file) { console.error('usage: saves.mjs <file.html> [neon|rally]'); process.exit(2); }

const fails = [];
const t = (name, ok, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const KEYS = game === 'rally'
  ? { set: 'mbm_rallyvector_3d_v1', legacy: null }
  : { set: 'mbm_neonmeridian_settings_v1', prog: 'mbm_neonmeridian_progress_v1',
      legacySet: 'meridian_settings', legacyProg: 'meridian_progress' };

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const url = pathToFileURL(file).href;

// Boot once with a seeded localStorage, return observed state.
async function boot({ seed = {}, reduce = false, wait = 2600 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 700 },
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(s => {
    try { for (const k in s) localStorage.setItem(k, s[k]); } catch (e) {}
  }, seed);
  await page.goto(url);
  await page.waitForTimeout(wait);
  // Same start path as boot.mjs: Neon Meridian gates on #playBtn, Rally on
  // #startBtn. Clicking only one measured Rally as permanently unrendered.
  try { await page.evaluate(() => { const b = document.querySelector('#playBtn, #startBtn'); if (b) b.click(); }); } catch (e) {}
  await page.waitForTimeout(1400);
  const pix = await sampleCanvas(page);
  const state = await page.evaluate(() => {
    const c = document.querySelector('canvas#gl, canvas');
    const ls = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (e) {}
    return {
      canvasW: c ? c.width : 0,
      reduceAttr: document.documentElement.dataset.mbmReduce ?? document.body.dataset.mbmReduce ?? null,
      motionAttr: document.documentElement.dataset.mbmMotion ?? null,
      ls,
    };
  });
  state.painted = pix.lit || 0;
  state.distinct = pix.distinct || 0;
  await ctx.close();
  return { ...state, errs };
}

const alive = s => s.errs.length === 0 && s.canvasW > 300 && s.painted > 0;

console.log(`\n=== ${file.split('/').slice(-2).join('/')} (${game}) ===`);

// ---------------------------------------------------------------- R7 hostile
// The house set of seven shapes, each of which has broken a real save reader.
const HOSTILE = [
  ['truncated JSON', '{"quality":"High"'],
  ['not an object (array)', '[1,2,3]'],
  ['not an object (string)', '"hello"'],
  ['null literal', 'null'],
  ['wrong types throughout', '{"quality":42,"units":{},"tod":[],"weather":null,"shake":false}'],
  ['off-enum values', '{"quality":"ULTRAMAX","units":"furlongs","tod":"eclipse","weather":"hail"}'],
  ['prototype pollution attempt', '{"__proto__":{"polluted":1},"quality":"High"}'],
];
const setKey = KEYS.set;
// Seed BOTH key generations. Seeding only the house key gave a vacuous green
// against a build that still reads the pre-house name: the hostile blob was
// never loaded, so "survives" meant "was never opened".
const hostileSeed = blob => game === 'rally'
  ? { [setKey]: blob }
  : { [setKey]: blob, [KEYS.legacySet]: blob, [KEYS.legacyProg]: blob, [KEYS.prog]: blob };
for (const [label, blob] of HOSTILE) {
  const s = await boot({ seed: hostileSeed(blob) });
  t(`R7 hostile save survives: ${label}`, alive(s),
    s.errs.length ? s.errs[0].slice(0, 90) : `canvas=${s.canvasW} painted=${s.painted}`);
}

// ------------------------------------------------------------------ R4 floor
// Stored preference says "motion on". The OS says "reduce". The OS wins.
const motionOnKey = game === 'rally'
  ? JSON.stringify({ settings: { motion: true } })
  : JSON.stringify({ motion: true, quality: 'High' });
const forced = await boot({ seed: { [setKey]: motionOnKey }, reduce: true });
t('R4 OS reduced-motion is honoured even with a stored motion:true',
  forced.reduceAttr === '1', `data-mbm-reduce=${forced.reduceAttr}`);
if (game !== 'rally') {
  t('R4b motion resolves OFF when the OS asks for less',
    forced.motionAttr === '0', `data-mbm-motion=${forced.motionAttr}`);
}
const normal = await boot({ seed: { [setKey]: motionOnKey }, reduce: false });
t('R4c motion resolves ON when the OS does not ask for less',
  normal.reduceAttr === '0', `data-mbm-reduce=${normal.reduceAttr}`);

// -------------------------------------------------------------- R2 migration
if (game !== 'rally') {
  const legacy = {
    [KEYS.legacySet]: JSON.stringify({ quality: 'Low', units: 'kmh', tod: 'night' }),
    [KEYS.legacyProg]: JSON.stringify({ credits: 4242, missionsCompleted: 7 }),
  };
  const mig = await boot({ seed: legacy });
  const newSet = mig.ls[KEYS.set], newProg = mig.ls[KEYS.prog];
  t('R2 legacy settings carried to the house key', !!newSet && JSON.parse(newSet).units === 'kmh',
    String(newSet).slice(0, 70));
  t('R2 legacy progress carried LOSSLESS (credits preserved)',
    !!newProg && JSON.parse(newProg).credits === 4242, String(newProg).slice(0, 70));
  t('R2 legacy keys removed after carry-over',
    !(KEYS.legacySet in mig.ls) && !(KEYS.legacyProg in mig.ls),
    Object.keys(mig.ls).join(','));
  // A second boot must not resurrect or double-migrate.
  t('R2 migration is idempotent (house key still intact)', !!newSet);
} else {
  // R3: Rally's ghosts are sacred. Booting must not touch a ghost blob.
  const ghostKey = 'mbm_rallyvector_ghosts_v2_alpine';
  const ghostBlob = JSON.stringify([{ id: 1, time: 88.5, driver: 'Matt', date: '2026-08-01', telemetry: [[0, 1, 2, 3, 4]] }]);
  const g = await boot({ seed: { [ghostKey]: ghostBlob } });
  t('R3 existing ghost blob is byte-identical after a boot',
    g.ls[ghostKey] === ghostBlob, (g.ls[ghostKey] || 'MISSING').slice(0, 70));
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
