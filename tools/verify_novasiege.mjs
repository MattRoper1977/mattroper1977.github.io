#!/usr/bin/env node
/* Vector Overdrive: Nova Siege — Stage V gate.
 *
 * Runs against the SHIPPED file, not an extracted copy, in the same spirit as
 * tools/glitchclash/run.sh. Non-zero exit if any limb fails, so it works as a
 * merge gate.
 *
 *   node tools/verify_novasiege.mjs [path/to/index.html]
 *   node tools/verify_novasiege.mjs --self-test [path]   # prove it can go red
 *
 * Assert on evidence, not proxies. Two examples of that rule at work here:
 *
 *   The photosensitivity limb does not ask "is reducedFX true". It invokes the
 *   real gated flash function with the real arguments and reads the peak alpha
 *   that actually reached the canvas — and it separately reads the SOURCE to
 *   prove no call site writes flashAlpha directly, because a gate everyone
 *   bypasses is not a gate.
 *
 *   The 44 px limb measures rendered bounding boxes in both orientations and
 *   both reduced-motion states, not CSS declarations. A min-height in a
 *   stylesheet is not a touch target; a box on the glass is.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--self-test');
const target = argv.find((a) => !a.startsWith('--')) ||
  fileURLToPath(new URL('../novasiege/index.html', import.meta.url));

const SOURCE = readFileSync(target, 'utf8');
const URL_ = pathToFileURL(target).href;

const results = [];
let group = '';
const g = (n) => { group = n; console.log(`\n${n}`); };
const check = (limb, ok, detail) => {
  results.push({ group, limb, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${limb.padEnd(30)} ${detail}`);
  return ok;
};

/* A booted page, with reduced motion emulated at the OS level when asked. */
async function boot(browser, { reduced = false, viewport = { width: 900, height: 1400 } } = {}) {
  const ctx = await browser.newContext({
    viewport,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  // The splash self-closes at ~3.6 s. Poll for the harness rather than
  // sampling once at a guessed moment — the estate's splash census already
  // recorded two branded games as unbranded by single-sampling past a close.
  await page.waitForFunction('!!window.__vector', null, { timeout: 20000 });
  return { ctx, page, errors };
}

const browser = await chromium.launch();

// ───────────────────────────────────────────────────── source-level invariants
g('source');
{
  // Direct writes to flashAlpha, excluding the declaration, the decays and the
  // peak tracker. Any survivor is a call site that bypasses the gate.
  const direct = [...SOURCE.matchAll(/flashAlpha\s*=\s*([^;]+)/g)]
    .map((m) => m[1].trim())
    .filter((v) => !/^Math\.max\(/.test(v) && v !== '0' && !/^0,/.test(v));
  check('no ungated flash writes', direct.length === 0,
    direct.length ? `direct assignments still present: ${JSON.stringify(direct)}` : 'every flash routes through screenFlash()');

  check('screenFlash is RM-gated', /function screenFlash\([^)]*\)\{if\(settings\.reducedFX\)return;/.test(SOURCE),
    'screenFlash returns early under reducedFX');

  check('title carries the suffix', /<title>[^<]*—\s*Made by Matt<\/title>/.test(SOURCE),
    (SOURCE.match(/<title>([^<]*)<\/title>/) || [])[1] || 'no title');

  check('canonical present', /<link rel="canonical" href="https:\/\/madebymatt\.uk\/novasiege\/">/.test(SOURCE), 'canonical → /novasiege/');
  check('og block present', /property="og:title"/.test(SOURCE) && /property="og:url"/.test(SOURCE), 'og:title and og:url present');

  // The real-asset rule: never advertise an image that is not on disk.
  const ogImage = /property="og:image"/.test(SOURCE);
  check('og:image only if real', !ogImage, ogImage ? 'og:image claimed — must land with the file' : 'no og:image claimed (banner is V-P4)');

  check('gamepad is real', (SOURCE.match(/getGamepads/g) || []).length > 0,
    `${(SOURCE.match(/getGamepads/g) || []).length} getGamepads references`);

  // Read the viewport tag's own content, not the whole file. The first version
  // of this limb grepped the source and matched the COMMENT explaining that
  // user-scalable=no had been removed — a false defect manufactured by the
  // instrument out of its own prose.
  const vp = (SOURCE.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || '';
  check('pinch zoom not blocked', !/user-scalable=no|maximum-scale=1/.test(vp), `viewport content: ${vp}`);

  check('save keys unchanged', /STORAGE_PREFIX='mbm_vector_overdrive_'/.test(SOURCE), 'mbm_vector_overdrive_ (R4: no renames)');

  // A canonical/og URL is a declaration, not a fetch. Only things the browser
  // actually goes and gets count: script src, and stylesheet/preload links.
  // The first version flagged the canonical tag this very stage added.
  const remoteScript = /<script[^>]+\bsrc\s*=/i.test(SOURCE);
  const remoteLink = [...SOURCE.matchAll(/<link\b[^>]*>/gi)]
    .filter((m) => /href\s*=\s*"https?:/i.test(m[0]))
    .filter((m) => !/rel\s*=\s*"(canonical|alternate)"/i.test(m[0]));
  check('offline', !remoteScript && remoteLink.length === 0,
    `remote scripts: ${remoteScript ? 'yes' : 'none'}; fetching links: ${remoteLink.length}`);
}

// ───────────────────────────────────────────────────────────── engine self-test
g('engine');
{
  const { ctx, page, errors } = await boot(browser);
  const st = await page.evaluate(() => window.__vector.selfTest());
  const failed = st.tests.filter((t) => !t.pass).map((t) => t.name);
  check('built-in selfTest', st.pass === true, `${st.tests.length - failed.length}/${st.tests.length} engine tests${failed.length ? ` — failing: ${failed}` : ''}`);
  check('boot console clean', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 2)) : 'no script errors through splash → menu');
  check('harness extends, not replaces', await page.evaluate(() => typeof window.VectorOverdrive?.selfTest === 'function' && typeof window.__vector?.selfTest === 'function'),
    'window.VectorOverdrive still real; __vector re-exports the same selfTest');
  await ctx.close();
}

// ─────────────────────────────────────────────── photosensitivity / RM as floor
g('reduced motion + photosensitivity');
{
  // OS says reduce.
  const { ctx, page, errors } = await boot(browser, { reduced: true });
  const m0 = await page.evaluate(() => window.__vector.motion());
  check('OS floor at load', m0.os === true && m0.fx === true, `os=${m0.os} fx=${m0.fx}`);

  await page.evaluate(() => window.__vector.resetFlashPeak());
  const painted = await page.evaluate(() => { window.__vector.probeFlash(); return window.__vector.flashPeak(); });
  await page.waitForTimeout(300);
  const peak = await page.evaluate(() => window.__vector.flashPeak());
  check('RM peak flash is 0', painted === 0 && peak === 0, `probe painted ${painted}, peak after 300ms ${peak}`);

  // The toggle must not be able to weaken the OS signal.
  const after = await page.evaluate(() => window.__vector.toggleFX());
  const m1 = await page.evaluate(() => window.__vector.motion());
  check('toggle cannot weaken floor', after === true && m1.fx === true && m1.floorHolds === true,
    `after clicking FX toggle: fx=${m1.fx}`);
  check('RM console clean', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 2)) : 'no script errors under reduced motion');
  await ctx.close();
}
{
  // OS says no preference: a flash IS allowed, and the live listener works.
  const { ctx, page } = await boot(browser, { reduced: false });
  const m0 = await page.evaluate(() => window.__vector.motion());
  check('no-preference default', m0.os === false, `os=${m0.os} fx=${m0.fx}`);

  await page.evaluate(() => { window.__vector.resetFlashPeak(); });
  const lit = await page.evaluate(() => window.__vector.probeFlash());
  check('flash still works when allowed', lit > 0, `probe painted ${lit} (a suppressed-everywhere flash would be a false green)`);

  // Live listener: flip the OS mid-session.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const m1 = await page.evaluate(() => window.__vector.motion());
  check('live OS listener', m1.os === true && m1.fx === true, `after OS flip mid-session: os=${m1.os} fx=${m1.fx}`);

  await page.evaluate(() => window.__vector.resetFlashPeak());
  const afterFlip = await page.evaluate(() => { window.__vector.probeFlash(); return window.__vector.flashPeak(); });
  check('flash suppressed after flip', afterFlip === 0, `peak ${afterFlip} with no reload`);
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────────── gamepad
g('gamepad');
{
  const { ctx, page } = await boot(browser);
  const dz = await page.evaluate(() => window.__vector.deadzone());
  const samples = await page.evaluate(() => [0, 0.1, 0.21, 0.22, 0.5, 1, -0.5, -1].map((v) => [v, window.__vector.axis(v)]));
  const inside = samples.filter(([v]) => Math.abs(v) < dz).every(([, o]) => o === 0);
  const outside = samples.filter(([v]) => Math.abs(v) > dz);
  const monotone = outside.every(([v, o]) => Math.sign(o) === Math.sign(v) && Math.abs(o) <= 1);
  const full = samples.find(([v]) => v === 1)[1];
  check('deadzone silences drift', inside, `|v| < ${dz} → 0`);
  check('deadzone rescales, not clips', monotone && Math.abs(full - 1) < 1e-9,
    `full deflection maps to ${full} (a clipping deadzone would lose range)`);
  const gp = await page.evaluate(() => window.__vector.gamepad());
  check('no phantom controller', gp.connected === false, `connected=${gp.connected} with no pad attached`);
  await ctx.close();
}

// ─────────────────────────────────────────────────── leaderboard hostile probes
g('leaderboard');
{
  const { ctx, page } = await boot(browser);
  // Built inside the page: a hostile value worth testing (an object with a
  // valueOf that returns NaN) cannot be serialised across the Playwright
  // bridge, and passing only bridge-safe values would quietly narrow the probe
  // to the easy cases.
  const out = await page.evaluate(() => {
    const entries = [
      { id: 'h1', name: 'X', score: NaN, wave: 1, time: 1 },
      { id: 'h2', name: 'X', score: Infinity, wave: 1, time: 1 },
      { id: 'h3', name: 'X', score: '9e999', wave: 1, time: 1 },
      { id: 'h4', name: 'X', score: '1; DROP TABLE', wave: 1, time: 1 },
      { id: 'h5', name: ' \u202eEVIL'.repeat(40), score: 10, wave: 1, time: 1 },
      { id: 'h6', score: { valueOf() { return NaN; } }, wave: 1, time: 1 },
      { id: 'h7', name: 'X', score: 5, wave: -Infinity, time: 1 },
      { id: 'h8', name: 'X', score: 5, wave: 1, time: NaN },
      { score: 5, wave: 1, time: 1 },
      null, undefined, 42, 'not an object', [],
    ];
    for (const e of entries) { try { window.__vector.mergeRaw(e); } catch (_) {} }
    return window.__vector.board();
  });

  const bad = out.filter((r) => !Number.isFinite(r.score) || !Number.isFinite(r.wave) || !Number.isFinite(r.time));
  check('no NaN or Infinity rows', bad.length === 0, `${out.length} rows, ${bad.length} non-finite`);
  check('top-10 invariant', out.length <= 10, `${out.length} rows retained`);
  const names = out.map((r) => r.name);
  check('names bounded and printable', names.every((n) => n.length <= 12 && /^[\x20-\x7E]*$/.test(n)),
    `longest ${Math.max(0, ...names.map((n) => n.length))} chars, all printable`);
  const sorted = out.every((r, i) => i === 0 || out[i - 1].score >= r.score);
  check('sort stable and descending', sorted, 'board remains ordered by score');

  // A legitimate entry must still get in — a board that rejects everything
  // would pass every assertion above for the wrong reason.
  const okLen = await page.evaluate(() => window.__vector.mergeRaw({ id: 'good-1', name: 'ok', score: 1234, wave: 3, seed: 7, skin: 'a', time: 2 }));
  const board = await page.evaluate(() => window.__vector.board());
  check('legitimate entry accepted', board.some((r) => r.id === 'good-1' && r.score === 1234),
    `board length ${okLen}, good entry present (guards against a vacuous pass)`);
  await ctx.close();
}

// ───────────────────────────────────────────────────────────────── daily seed
g('daily run');
{
  const { ctx, page } = await boot(browser);
  const a = await page.evaluate(() => window.__vector.dailySeed());
  const b = await page.evaluate(() => window.__vector.dailySeed());
  check('daily seed deterministic', a === b && Number.isFinite(a), `${a} twice in the same day`);
  check('daily seed non-trivial', a !== 0, `seed ${a}`);
  await ctx.close();
}

// ──────────────────────────────────────────── 44 px census, 2 orientations × RM
g('44 px touch targets');
for (const reduced of [false, true]) {
  for (const [label, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const { ctx, page } = await boot(browser, { reduced, viewport });
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button,[role="button"],a[href],input,select')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;      // not rendered
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        if (r.width < 44 || r.height < 44) {
          out.push({ t: (el.id || el.className || el.tagName).toString().slice(0, 34), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return out;
    });
    check(`44px ${label} rm=${reduced}`, small.length === 0,
      small.length ? `${small.length} under-size: ${JSON.stringify(small.slice(0, 4))}` : 'every rendered control ≥ 44×44');
    await ctx.close();
  }
}

// ───────────────────────────────────────── fixed timestep: 30 Hz vs 144 Hz
g('fixed timestep');
{
  // The accumulator is real (1/120 with a substep guard). This measures that
  // simulation outcome does not depend on frame rate, by driving the same
  // seeded run under two very different render cadences and comparing state.
  const runAt = async (fps) => {
    const { ctx, page } = await boot(browser);
    const state = await page.evaluate(async (hz) => {
      const step = 1000 / hz;
      let t = 0;
      const realNow = performance.now.bind(performance);
      performance.now = () => t;                     // deterministic clock
      window.__vectorRAF = [];
      const cbs = [];
      window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
      // 6 simulated seconds at the requested cadence
      for (let i = 0; i < Math.round(hz * 6); i++) {
        t += step;
        const batch = cbs.splice(0, cbs.length);
        for (const cb of batch) { try { cb(t); } catch (_) {} }
      }
      performance.now = realNow;
      return window.__vector.snapshot();
    }, fps);
    await ctx.close();
    return state;
  };
  const a = await runAt(30);
  const b = await runAt(144);
  const same = a.state === b.state && a.wave === b.wave;
  check('30 Hz vs 144 Hz agree', same,
    `30Hz → state=${a.state} wave=${a.wave} · 144Hz → state=${b.state} wave=${b.wave}`);
}

// ─────────────────────────────────────────────────────────────── self-test hook
if (SELFTEST) {
  g('self-test (negative control)');
  // Weaken the real file in memory and prove the source limbs go red.
  const weakened = SOURCE
    .replace('function screenFlash(alpha,color){if(settings.reducedFX)return;', 'function screenFlash(alpha,color){')
    .replace(/<title>([^<]*)—\s*Made by Matt<\/title>/, '<title>$1</title>');
  const gated = /function screenFlash\([^)]*\)\{if\(settings\.reducedFX\)return;/.test(weakened);
  const titled = /<title>[^<]*—\s*Made by Matt<\/title>/.test(weakened);
  check('control: ungated flash detected', gated === false, 'removing the RM guard flips the source limb red');
  check('control: missing suffix detected', titled === false, 'removing the suffix flips the title limb red');
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} limbs pass`);
if (failed.length) {
  console.log(`FAILING: ${failed.map((f) => `${f.group}/${f.limb}`).join(', ')}`);
  process.exit(1);
}
process.exit(0);
