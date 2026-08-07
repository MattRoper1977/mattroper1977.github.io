#!/usr/bin/env node
/* Ouroboros: Chronos Unbound — Stage U gate.
 *
 * Runs against the shipped file, not an extracted copy. Non-zero exit if any
 * limb fails, so it works as a merge gate.
 *
 *   node tools/verify_ouroboros.mjs [path/to/index.html]
 *   node tools/verify_ouroboros.mjs --control <pre-fix.html>   # prove it reddens
 *
 * The U-1 limb is the reason this file exists, and it is built to the rule
 * that a gate asserts on evidence rather than on a proxy:
 *
 *   It does not ask "is there a fill-mode in the CSS". It fires the flash with
 *   the exact colour/strength pair of each of the five real call sites, waits
 *   well past the 0.24 s animation, and reads the COMPUTED opacity of the
 *   element off the live page. A flash that is still painting anything at
 *   +1.5 s is stuck, whatever the stylesheet says.
 *
 *   It runs in both reduced-motion states, because the pre-fix defect was
 *   WORSE under reduced motion — the wildcard blanket collapsed the animation
 *   to 0.001 ms, so the stuck flash arrived instantly at full strength for
 *   exactly the players the setting exists to protect.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const ci = argv.indexOf('--control');
const CONTROL = ci > -1 ? argv[ci + 1] : null;
const target = argv.find((a, i) => !a.startsWith('--') && i !== ci + 1) ||
  fileURLToPath(new URL('../ouroboros/index.html', import.meta.url));

const SOURCE = readFileSync(target, 'utf8');

const results = [];
let group = '';
const g = (n) => { group = n; console.log(`\n${n}`); };
const check = (limb, ok, detail) => {
  results.push({ group, limb, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${limb.padEnd(32)} ${detail}`);
  return ok;
};

/* The five real call sites, read out of the file rather than typed here, so
   that adding a sixth cannot slip past this gate unmeasured. */
function callSites(src) {
  return [...src.matchAll(/screenFlash\(\s*"(#[0-9a-fA-F]{3,8})"\s*,\s*([0-9.]+)\s*\)/g)]
    .map((m) => ({ colour: m[1], strength: Number(m[2]) }));
}

const browser = await chromium.launch();

async function boot(file, { reduced = false, viewport = { width: 1000, height: 800 } } = {}) {
  const ctx = await browser.newContext({
    viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded' });
  // Poll for the harness, never single-sample: the splash takes its own time.
  // Wait on something BOTH files have. __ouroboros is this stage's addition.
  await page.waitForFunction('typeof window.screenFlash === "function"', null, { timeout: 25000 });
  return { ctx, page, errors };
}

/* The heart of the gate. Returns the worst computed opacity observed at
   +1.5 s across every real call site. */
async function stuckFlashPeak(file, reduced) {
  const { ctx, page, errors } = await boot(file, { reduced });
  const sites = callSites(readFileSync(file, 'utf8'));
  const observed = [];
  for (const s of sites) {
    // Deliberately harness-free. screenFlash is a top-level function, so it is
    // reachable as a global on BOTH the fixed and the pre-fix file, and the
    // element is read straight off the DOM. A control that had to go through
    // this stage's own harness additions could never run against the file
    // those additions do not exist in — and then it would not be a control.
    await page.evaluate(([c, n]) => window.screenFlash(c, n), [s.colour, s.strength]);
    await page.waitForTimeout(1500);                     // well past the 0.24s animation
    const st = await page.evaluate(() => {
      const el = document.querySelector('#screenFlash');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { opacity: parseFloat(cs.opacity), inlineOpacity: el.style.opacity || '', animation: cs.animationName };
    });
    observed.push({ ...s, ...(st || {}) });
  }
  await ctx.close();
  return { sites, observed, errors };
}

// ─────────────────────────────────────────────────────── source-level checks
g('source');
{
  const sites = callSites(SOURCE);
  check('five call sites found', sites.length === 5,
    sites.map((s) => `${s.colour}@${s.strength}`).join(' '));

  check('no persistent inline opacity', !/#screenFlash[^]{0,400}?style\.opacity\s*=/.test(SOURCE) &&
    !/el\.style\.opacity\s*=\s*String\(strength\)/.test(SOURCE),
    'screenFlash() no longer writes element.style.opacity');

  check('keyframe ends at zero', /@keyframes flash\{0%\{opacity:var\(--flash-a[^)]*\)\}100%\{opacity:0\}\}/.test(SOURCE),
    'strength rides a custom property; 100% is opacity:0');

  check('animation has fill-mode', /#screenFlash\.flash\{animation:flash [^}]*forwards\}/.test(SOURCE),
    'forwards pins the end state at the 100% keyframe');

  check('flash is RM-gated', /function screenFlash[^]{0,600}?Game\.settings\.reducedMotion\)\{[^]{0,120}?return/.test(SOURCE),
    'screenFlash returns early under reduced motion');

  check('no wildcard RM blanket', !/body\.reduced-motion \*\{animation-duration/.test(SOURCE),
    'the `body.reduced-motion *` animation wildcard is gone');

  check('RM uses named families', (SOURCE.match(/body\.reduced-motion [.#][A-Za-z]/g) || []).length >= 8,
    `${(SOURCE.match(/body\.reduced-motion [.#][A-Za-z]/g) || []).length} named reduced-motion selectors`);

  check('OS floor present', /function osReducedMotion\(\)/.test(SOURCE) && /if\(osReducedMotion\(\)\) Game\.settings\.reducedMotion=true/.test(SOURCE),
    'applySettings re-applies the OS floor on every call');

  check('live RM listener', /rmq\.addEventListener\("change"/.test(SOURCE) || /rmq\.addListener\(/.test(SOURCE),
    'a change listener is attached to the media query');

  check('harness extends, not duplicates', /window\.__ouroboros=window\.OuroborosDebug/.test(SOURCE),
    '__ouroboros is an alias to the existing OuroborosDebug object');

  // Count in CODE, not in prose. The first version of this limb counted the
  // comment this very stage wrote to explain that grantAll is console-only —
  // an instrument reading its own documentation and calling it a defect.
  const stripped = SOURCE
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const grants = (stripped.match(/grantAll/g) || []).length;
  check('grantAll is console-only', grants === 1 && !/onclick="/.test(SOURCE),
    `${grants} code occurrence(s) (prose excluded), 0 onclick attributes — unreachable from shipped UI`);

  check('canonical present', /<link rel="canonical" href="https:\/\/madebymatt\.uk\/ouroboros\/">/.test(SOURCE),
    'canonical → /ouroboros/');
  check('og block present', /property="og:title"/.test(SOURCE) && /property="og:url"/.test(SOURCE),
    'og:title and og:url present');
  // Real-asset rule: never advertise an image that is not on disk.
  check('og:image only if real', !/property="og:image"/.test(SOURCE),
    'no og:image claimed (banner is U-P4)');
  check('noscript fallback', /<noscript>/.test(SOURCE),
    'a JS-off visitor is told why, and given a way back to the arcade');
  // The meta tag alone is NOT evidence. This file's viewport meta was already
  // clean while `touch-action:none` on html,body blocked pinch page-wide — a
  // defect the meta-only version of this limb passed straight over. The
  // computed value is checked on the live page below; this is the meta half.
  check('viewport meta permits zoom',
    !/user-scalable=no|maximum-scale=1/.test((SOURCE.match(/<meta name="viewport" content="([^"]*)"/) || [])[1] || ''),
    `viewport: ${(SOURCE.match(/<meta name="viewport" content="([^"]*)"/) || [])[1]}`);

  check('save key unchanged', /SAVE_KEY *= *"mbm_ouroboros_chronos_unbound_v1"/.test(SOURCE),
    'mbm_ouroboros_chronos_unbound_v1 (R4: no renames)');

  const remoteScript = /<script[^>]+\bsrc\s*=/i.test(SOURCE);
  const remoteLink = [...SOURCE.matchAll(/<link\b[^>]*>/gi)]
    .filter((m) => /href\s*=\s*"https?:/i.test(m[0]))
    .filter((m) => !/rel\s*=\s*"(canonical|alternate)"/i.test(m[0]));
  check('offline', !remoteScript && remoteLink.length === 0,
    `remote scripts: ${remoteScript ? 'yes' : 'none'}; fetching links: ${remoteLink.length}`);

  check('title suffix', /<title>[^<]*—\s*Made by Matt<\/title>/.test(SOURCE),
    (SOURCE.match(/<title>([^<]*)<\/title>/) || [])[1]);

  const kb = Buffer.byteLength(SOURCE);
  check('within 300 KB budget', kb <= 300 * 1024, `${kb.toLocaleString()} B`);
}

// ───────────────────────────────────────────────── U-1, measured on the page
for (const reduced of [false, true]) {
  g(`U-1 sticky flash — reduced motion ${reduced ? 'ON' : 'OFF'}`);
  const { sites, observed, errors } = await stuckFlashPeak(target, reduced);
  const worst = Math.max(0, ...observed.map((o) => o.opacity || 0));
  const stuck = observed.filter((o) => (o.opacity || 0) > 0.001);
  check('no flash sticks at +1.5s', stuck.length === 0,
    `${sites.length} call sites fired; worst computed opacity ${worst.toFixed(3)}` +
    (stuck.length ? ` — stuck: ${JSON.stringify(stuck.map((x) => `${x.colour}@${x.strength}→${x.opacity}`))}` : ''));

  const inline = observed.filter((o) => o.inlineOpacity !== '');
  check('no inline opacity left behind', inline.length === 0,
    inline.length ? `${inline.length} sites left style.opacity set` : 'element carries no inline opacity');

  if (reduced) {
    // RM peak flash must be 0 — the flash never paints at all.
    check('RM peak flash is 0', worst === 0, `peak computed opacity ${worst}`);
  }
  check('console clean', errors.length === 0,
    errors.length ? JSON.stringify(errors.slice(0, 2)) : 'no script errors');
}

// ─────────────────────────────────────────────────────────── U-2, on the page
g('U-2 reduced motion as a floor');
{
  const { ctx, page } = await boot(target, { reduced: true });
  const m0 = await page.evaluate(() => window.__ouroboros.motion());
  check('OS floor at load', m0.os === true && m0.setting === true && m0.bodyClass === true,
    `os=${m0.os} setting=${m0.setting} body.reduced-motion=${m0.bodyClass}`);

  // The pre-fix defect: a persisted false overrode the OS forever.
  const after = await page.evaluate(() => window.__ouroboros.setSaved('reducedMotion', false));
  const m1 = await page.evaluate(() => window.__ouroboros.motion());
  check('saved false cannot weaken OS', after === true && m1.setting === true && m1.floorHolds === true,
    `a save carrying reducedMotion:false still yields setting=${m1.setting}`);
  await ctx.close();
}
{
  const { ctx, page } = await boot(target, { reduced: false });
  const m0 = await page.evaluate(() => window.__ouroboros.motion());
  check('no-preference default', m0.os === false, `os=${m0.os} setting=${m0.setting}`);

  // Live listener: flip the OS mid-session. Poll, never single-sample.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let m1 = null;
  for (let i = 0; i < 40; i++) {
    m1 = await page.evaluate(() => window.__ouroboros.motion());
    if (m1.os === true && m1.setting === true) break;
    await page.waitForTimeout(50);
  }
  check('live OS listener', m1.os === true && m1.setting === true && m1.bodyClass === true,
    `after OS flip with no reload: setting=${m1.setting} body=${m1.bodyClass}`);

  // And the flash must now be suppressed without a reload.
  await page.evaluate(() => window.__ouroboros.fireFlash('#ffffff', 1));
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.__ouroboros.flash());
  check('flash suppressed after flip', (st.opacity || 0) === 0, `computed opacity ${st.opacity}`);
  await ctx.close();
}

// ────────────────────────────────────── the frame loop must survive a throw
g('loop resilience');
{
  const { ctx, page } = await boot(target);
  // Measure that the loop is alive, then make render() throw on the very next
  // frame, then measure again. A loop whose reschedule sits after unguarded
  // work stops for good; one that reschedules in `finally` keeps its clock.
  const t0 = await page.evaluate(() => Game.time);
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => Game.time);
  check('loop is running', t1 > t0, `Game.time advanced ${(t1 - t0).toFixed(3)}s`);

  const threw = await page.evaluate(() => {
    const orig = window.render;   // a function declaration, so this one IS on window
    let fired = 0;
    window.render = function () { fired++; if (fired <= 3) throw new Error('negative control: render threw'); return orig.apply(this, arguments); };
    return true;
  });
  await page.waitForTimeout(600);
  const t2 = await page.evaluate(() => Game.time);
  check('loop survives a throw', threw && t2 > t1,
    `after render() threw 3 frames, Game.time advanced a further ${(t2 - t1).toFixed(3)}s (a dead loop would be 0)`);
  await ctx.close();
}

// ───────────────────────────────────────────── aria widening, not last-write
g('aria widening (A11Y-01)');
{
  const { ctx, page } = await boot(target);
  const heard = await page.evaluate(async () => {
    const el = document.getElementById('ariaLive');
    const seen = [];
    const mo = new MutationObserver(() => { const t = el.textContent.trim(); if (t && seen[seen.length - 1] !== t) seen.push(t); });
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    // A burst in one frame — exactly what a resonance technique produces.
    ['alpha one', 'beta two', 'gamma three', 'delta four'].forEach((m) => window.announce(m));
    await new Promise((r) => setTimeout(r, 4200));
    mo.disconnect();
    return seen;
  });
  check('a burst is not collapsed', heard.length >= 4,
    `${heard.length} of 4 announcements reached the live region: ${JSON.stringify(heard)}`);
  check('markup stripped', !heard.some((h) => /[<>]/.test(h)), 'live region carries words, not tags');
  await ctx.close();
}

// ───────────────────────────────────────────────── save on the way out
g('visibilitychange (SAVE-11)');
{
  const { ctx, page } = await boot(target);
  await page.evaluate(() => { window.__ouroboros.newGame(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { localStorage.removeItem(window.__ouroboros.saveKey()); });
  const gone = await page.evaluate(() => window.__ouroboros.saveRaw());
  check('save cleared for the probe', gone === null, 'storage emptied so the next write is attributable');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => window.__ouroboros.saveRaw());
  check('hiding the tab writes a save', typeof back === 'string' && back.length > 0,
    back ? `${back.length} bytes written on visibilitychange` : 'nothing was written');
  await ctx.close();
}

// ─────────────────────────────────────────────────────── R7 save round-trip
g('R7 save round-trip');
{
  const { ctx, page } = await boot(target);
  await page.evaluate(() => { window.__ouroboros.newGame(); });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => window.__ouroboros.saveRaw());
  check('game wrote a save', typeof before === 'string' && before.length > 0,
    `${before ? before.length : 0} bytes under ${await page.evaluate(() => window.__ouroboros.saveKey())}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction('!!(window.__ouroboros || window.OuroborosDebug)', null, { timeout: 25000 });
  const after = await page.evaluate(() => window.__ouroboros.saveRaw());

  /* This limb used to assert byte-equality, and byte-equality is the wrong
     assertion. `pagehide` now writes a save on the way out — which is the
     point of SAVE-11 — so a reload legitimately advances the play clock. The
     first version read that as "save drifted on reload" and would have had me
     rip out a working fix to satisfy it. Measured: exactly one field moved,
     playTime 0 -> 0.4166, with the key count identical at 18 either side.

     R7 is that nothing is LOST or CORRUPTED across the round trip, not that
     no counter may ever advance. So: identical key sets, every field
     identical except monotonic clocks, and those must be non-decreasing —
     which additionally catches a save that RESETS the clock on load, a real
     corruption the byte-equality version would have passed straight over
     whenever the numbers happened to line up. */
  const MONOTONIC = new Set(['playTime']);
  const cmp = await page.evaluate(([a, b, mono]) => {
    const A = JSON.parse(a), B = JSON.parse(b);
    const out = { sameKeys: true, changed: [], regressed: [] };
    const walk = (x, y, path) => {
      const keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
      for (const k of keys) {
        const p = path ? path + '.' + k : k;
        const vx = x ? x[k] : undefined, vy = y ? y[k] : undefined;
        if (vx === undefined || vy === undefined) { out.sameKeys = false; out.changed.push(p + ' (present on one side only)'); continue; }
        if (vx && vy && typeof vx === 'object' && typeof vy === 'object' && !Array.isArray(vx)) { walk(vx, vy, p); continue; }
        if (JSON.stringify(vx) !== JSON.stringify(vy)) {
          if (mono.includes(k)) { if (!(Number(vy) >= Number(vx))) out.regressed.push(`${p}: ${vx} -> ${vy}`); }
          else out.changed.push(`${p}: ${JSON.stringify(vx)} -> ${JSON.stringify(vy)}`);
        }
      }
    };
    walk(A, B, '');
    return out;
  }, [before, after, [...MONOTONIC]]);

  check('save reloads lossless', cmp.sameKeys && cmp.changed.length === 0,
    cmp.changed.length ? `fields changed: ${JSON.stringify(cmp.changed.slice(0, 4))}` : 'same key set; every non-clock field identical across reload');
  check('play clock never regresses', cmp.regressed.length === 0,
    cmp.regressed.length ? JSON.stringify(cmp.regressed) : 'monotonic fields advanced or held');
  await ctx.close();
}

// ────────────────────────────────── pinch zoom, measured on the live page
g('pinch zoom (computed)');
{
  const { ctx, page } = await boot(target);
  const ta = await page.evaluate(() => ({
    body: getComputedStyle(document.body).touchAction,
    html: getComputedStyle(document.documentElement).touchAction,
  }));
  const blocks = (v) => v === 'none' || /pinch-zoom/.test(v) === false && v === 'none';
  check('page permits pinch zoom', ta.body !== 'none' && ta.html !== 'none',
    `computed touch-action — html:${ta.html} body:${ta.body}`);
  await ctx.close();
}

// ────────────────────────────────────────── hostile saves must not crash it
g('hostile saves');
{
  const probes = [
    ['malformed json', '{not json at all'],
    ['null', 'null'],
    ['array', '[1,2,3]'],
    ['empty object', '{}'],
    ['NaN-ish numbers', '{"progress":"NaN","settings":{"reducedMotion":"yes"}}'],
    ['hostile string', '{"progress":1,"characters":{"yasuke":{"name":"<img src=x onerror=alert(1)>"}}}'],
    ['absurd numbers', '{"progress":1e309,"party":[{"hp":-99999999}]}'],
    ['top-level array', '[{"progress":9}]'],
    ['top-level number', '42'],
    ['top-level string', '"a save, honest"'],
    ['top-level bool', 'true'],
    ['character replaced by a primitive', '{"characters":{"yasuke":7}}'],
  ];
  for (const [label, payload] of probes) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(target).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('!!(window.__ouroboros || window.OuroborosDebug)', null, { timeout: 25000 }).catch(() => {});
    await page.evaluate(([k, v]) => localStorage.setItem(k, v),
      [await page.evaluate(() => window.__ouroboros.saveKey()), payload]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const booted = await page.waitForFunction('!!(window.__ouroboros || window.OuroborosDebug)', null, { timeout: 25000 })
      .then(() => true).catch(() => false);
    check(`survives: ${label}`, booted && errors.length === 0,
      booted ? (errors.length ? JSON.stringify(errors.slice(0, 1)) : 'boots clean') : 'did not boot');
    await ctx.close();
  }
}

// ─────────────────────────────────────── 44 px census, 2 orientations x 2 RM
g('44 px touch targets');
for (const reduced of [false, true]) {
  for (const [label, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    const { ctx, page } = await boot(target, { reduced, viewport });
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button,[role="button"],a[href],input,select')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        if (r.width < 44 || r.height < 44) out.push({ t: (el.id || el.className || el.tagName).toString().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out;
    });
    check(`44px ${label} rm=${reduced}`, small.length === 0,
      small.length ? `${small.length} under-size: ${JSON.stringify(small.slice(0, 4))}` : 'every rendered control ≥ 44×44');
    await ctx.close();
  }
}

// ────────────────────────────────────────── negative control on the PRE-FIX file
if (CONTROL) {
  g('negative control (pre-fix file)');
  const { observed } = await stuckFlashPeak(CONTROL, false);
  const worstOff = Math.max(0, ...observed.map((o) => o.opacity || 0));
  const { observed: obsRM } = await stuckFlashPeak(CONTROL, true);
  const worstOn = Math.max(0, ...obsRM.map((o) => o.opacity || 0));
  check('control reddens, RM off', worstOff > 0.001,
    `pre-fix worst computed opacity ${worstOff.toFixed(3)} at +1.5s — the flash IS stuck`);
  check('control reddens, RM on', worstOn > 0.001,
    `pre-fix worst computed opacity ${worstOn.toFixed(3)} under reduced motion — worst for the people it protects`);
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} limbs pass`);
if (failed.length) {
  console.log(`FAILING: ${failed.map((f) => `${f.group}/${f.limb}`).join(', ')}`);
  process.exit(1);
}
process.exit(0);
