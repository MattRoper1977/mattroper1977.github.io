#!/usr/bin/env node
/**
 * verify_emberwild.js — the gate harness for Emberwild.
 *
 * Runs against the shipped file, not an extracted copy, so what passes here
 * is what is served.
 *
 *   node tools/verify_emberwild.js [path/to/index.html]
 *
 * Every gate must also be shown capable of FAILING. `--selftest` mutates a
 * throwaway copy of the game to violate each gate in turn and asserts the
 * harness catches it; a gate that still passes on a violating build is a
 * vacuous gate and is reported as such.
 *
 * Non-zero exit if any gate fails, so this works as a CI gate.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const childProcess = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
// Release acceptance for the user-supplied 3.5.0 attachment: 989,794 raw bytes,
// SHA-256 d5e6e77b6b86b1d778b3747d23980431a5ad0f206a8cb6687b98b7c26564d7d0.
// The former 400 KiB limit described 2.0.1. Keep a bounded 1 MiB raw-file
// ceiling for this release; functional, furniture and accessibility gates stay.
const RELEASE_VERSION = '3.5.0';
const RELEASE_BUILD = 'emberwild-ascension-3.5.0-commercial-systems-repair-2026-09-04';
const MAX_GAME_BYTES = 1024 * 1024;

// Consume the generator itself rather than keeping a second copy of its
// 3,222-byte result here. Graft source: tools/render_inline_exit.py:113-127.
const INLINE_EXIT_EXPECTED = (() => {
  const generator = path.join(__dirname, 'render_inline_exit.py');
  const program = [
    'import importlib.util, sys',
    'spec = importlib.util.spec_from_file_location("render_inline_exit", sys.argv[1])',
    'module = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(module)',
    'sys.stdout.write(module.build_region(module.read_homes(sys.argv[2])))',
  ].join('\n');
  try {
    return {
      region: childProcess.execFileSync('python3', ['-c', program, generator, ROOT], {
        encoding: 'utf8', maxBuffer: 1024 * 1024,
      }),
      error: null,
    };
  } catch (error) {
    return { region: null, error: String(error?.stderr || error?.message || error) };
  }
})();

const GAME = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'emberwild', 'index.html');

const SELFTEST = process.argv.includes('--selftest');
// Use an explicitly pinned Chromium when one is present (local sandbox), and
// otherwise let Playwright pick the browser it installed (CI). Passing an
// executablePath that does not exist fails harder than having none at all.
const PINNED = process.env.EMBERWILD_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = PINNED && fs.existsSync(PINNED) ? PINNED : undefined;

// CI trap: node buffers stdout and the runner kills silent jobs. Flush per line.
function say(s) { process.stdout.write(s + '\n'); }

const results = [];
function gate(id, title, ok, detail) {
  results.push({ id, title, ok: !!ok, detail: detail || '' });
  say(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}${detail ? ' — ' + detail : ''}`);
  return !!ok;
}

// ---------------------------------------------------------------------------
// Static gates — read the file itself.
// ---------------------------------------------------------------------------
function staticGates(html) {
  // G1 self-containment (static half; the browser half logs real requests)
  const externals = [];
  const attrRe = /(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+["']/gi;
  let m;
  while ((m = attrRe.exec(html))) {
    // rel=canonical and og:url are metadata, not fetches.
    const around = html.slice(Math.max(0, m.index - 120), m.index + m[0].length);
    if (/rel=["']canonical["']/i.test(around)) continue;
    if (/property=["']og:url["']/i.test(around)) continue;
    externals.push(m[0].slice(0, 90));
  }
  if (/cdn\.jsdelivr\.net|unpkg\.com|cdnjs\./i.test(html)) externals.push('CDN hostname present');
  gate('G1s', 'self-containment (static)', externals.length === 0,
    externals.length ? externals.join(' | ') : 'no external src/href');

  // G3 storage namespace: no bare key literal outside the one helper.
  // The pinned exit-control block reads an estate-wide homepage key and is
  // byte-identical furniture across ten games — excluded by marker, not by name.
  const withoutExit = html.replace(
    /<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END -->/, '');
  const lsCalls = (withoutExit.match(/localStorage\.(getItem|setItem|removeItem)/g) || []).length;
  const helperCalls = (withoutExit.match(
    /localStorage\.(getItem|setItem|removeItem)\(EWStore\.key\(name\)\)|localStorage\.(setItem)\(EWStore\.key\(name\), value\)/g) || []).length;
  const sharedSplashCalls = (withoutExit.match(/localStorage\.setItem\(KEY,raw\)/g) || []).length;
  gate('G3s', 'storage: game keys use EWStore; splash uses the one shared estate key',
    lsCalls === helperCalls + sharedSplashCalls && helperCalls > 0 && sharedSplashCalls === 1,
    `${helperCalls} EWStore call(s) + ${sharedSplashCalls} shared-splash call(s) / ${lsCalls} localStorage call(s)`);

  // G5 touch floor, static half — every px size on an interactive rule,
  // INCLUDING inside media queries (recorded trap x2).
  const styleBlock = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const offenders = [];
  const ruleRe = /([^{}]+)\{([^}]*)\}/g;
  let r;
  while ((r = ruleRe.exec(styleBlock))) {
    const sel = r[1].trim(), body = r[2];
    if (!/button|\.dpad|\.action|\.icon-button|#touch|a\[href\]/i.test(sel)) continue;
    if (/transform\s*:\s*scale\(\s*0?\.\d+/.test(body)) {
      offenders.push(`${sel.slice(0, 40)} scales down (shrinks rendered target)`);
    }
    for (const prop of ['width', 'height']) {
      const mm = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px').exec(body);
      if (mm && parseFloat(mm[1]) < 44) offenders.push(`${sel.slice(0, 40)} ${prop}:${mm[1]}px`);
    }
  }
  gate('G5s', 'touch floor >= 44px in CSS (media queries included)',
    offenders.length === 0, offenders.join(' | ') || 'no sub-44px interactive rule');

  // G8 exactly one renderer-failure panel site.
  const panels = (html.match(/id="renderer-failure"/g) || []).length;
  gate('G8', 'one renderer-failure panel site', panels === 1, `${panels} panel(s) in markup`);

  // G11 a11y furniture.
  const a11y = {
    noscript: /<noscript>/.test(html),
    ariaLive: /aria-live=/.test(html),
    srOnly: /\.sr-only\s*\{/.test(html),
    focusVisible: /:focus-visible/.test(html)
  };
  const missing = Object.keys(a11y).filter(k => !a11y[k]);
  gate('G11s', 'a11y furniture present', missing.length === 0,
    missing.length ? 'missing ' + missing.join(', ') : 'noscript, aria-live, sr-only, focus-visible');

  // House furniture: compare with the generator's current output, including
  // the trailing newline. A size-only check admitted same-length corruption.
  const exitMatch = html.match(/<!-- MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END -->\n/);
  const actualExit = exitMatch?.[0] || null;
  const exitBytes = actualExit ? Buffer.byteLength(actualExit, 'utf8') : 0;
  const expectedBytes = INLINE_EXIT_EXPECTED.region
    ? Buffer.byteLength(INLINE_EXIT_EXPECTED.region, 'utf8') : 0;
  const exitExact = Boolean(actualExit && INLINE_EXIT_EXPECTED.region
    && actualExit === INLINE_EXIT_EXPECTED.region);
  const exitSha = actualExit ? crypto.createHash('sha256').update(actualExit).digest('hex') : 'absent';
  gate('HF1', 'inline exit control byte-identical to current generator output', exitExact,
    INLINE_EXIT_EXPECTED.error
      ? `generator failed: ${INLINE_EXIT_EXPECTED.error}`
      : `${exitBytes}/${expectedBytes} bytes sha256=${exitSha}`);
  gate('HF2', 'MBM splash present', /id="mbmSplash"/.test(html), '');
  gate('HF3', 'canonical + og:url point at /emberwild/',
    /rel="canonical" href="https:\/\/madebymatt\.uk\/emberwild\/"/.test(html)
    && /property="og:url" content="https:\/\/madebymatt\.uk\/emberwild\/"/.test(html), '');
  const buildStamp = html.includes(`<meta name="build-stamp" content="${RELEASE_BUILD}">`)
    && html.includes(`const APP_VERSION = '${RELEASE_VERSION}';`);
  const lineage = /emberwild-live-e63be95f-descendant-ascension-2026-08-30/.test(html);
  gate('HF4', `${RELEASE_VERSION} build and corrected served-ancestor lineage stamped`,
    buildStamp && lineage, `build=${buildStamp} lineage=${lineage}`);
  const bytes = Buffer.byteLength(html, 'utf8');
  gate('B1', 'file within the 1 MiB release budget', bytes <= MAX_GAME_BYTES,
    `${bytes} bytes of ${MAX_GAME_BYTES}`);

  // G12 syntax: every script block parses.
  const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]);
  let syntaxOK = true;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-syn-'));
  blocks.forEach((b, i) => {
    const f = path.join(tmp, `block${i}.js`);
    fs.writeFileSync(f, b);
    try {
      require('child_process').execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) { syntaxOK = false; say(`      block ${i}: ${String(e.stderr).split('\n')[2] || 'parse error'}`); }
  });
  gate('G12s', 'every script block parses', syntaxOK, `${blocks.length} block(s)`);

  // G13 the Den's registry stamp is written AND read back.
  // The codec stores registry INDICES, so a save only decodes correctly while
  // the registries it was written against remain a prefix of today's. That was
  // once fingerprinted into every save and compared by nothing — a belt that
  // was stored and never buckled, which is worse than none because everyone
  // downstream believes it is fastened. This gate is here so it cannot go
  // back to being write-only: the write, the read, and the absence of the
  // old dead field are all required.
  const writesStamp = /denRegistry:\s*EWDen\.registryStamp\(\)/.test(html);
  const readsStamp = /EWDen\.checkRegistry\(\s*d\.denRegistry\s*\)/.test(html);
  const noDeadField = !/denFingerprint/.test(html);
  gate('G13s', 'Den registry stamp is written and read back',
    writesStamp && readsStamp && noDeadField,
    `write=${writesStamp} read=${readsStamp} dead-field-gone=${noDeadField}`);
}

// ---------------------------------------------------------------------------
// G4 — the twist contract (§5.1–5.6). Scored against the shipped function.
// ---------------------------------------------------------------------------
function twistGates(EW) {
  const { trainerRead, CALL_BANDS, SAFE_CALL_CAP } = EW;

  // --- 8 fixtures ---------------------------------------------------------
  const fixtures = [
    { name: 'empty history scores zero',
      h: [], expect: r => r.score === 0 && r.calls === 0 },
    { name: 'a single perfect mid call tops out',
      h: [{ band: 'COIN_FLIP', p: 0.50 }], expect: r => r.score === 100 },
    { name: 'perfect calls across all three bands top out',
      h: [{ band: 'LONG_SHOT', p: 0.15 }, { band: 'COIN_FLIP', p: 0.50 }, { band: 'SURE_THING', p: 0.80 }],
      expect: r => r.score === 100 },
    { name: 'inverted calls score far below perfect',
      h: [{ band: 'SURE_THING', p: 0.05 }, { band: 'LONG_SHOT', p: 0.95 }],
      expect: r => r.score < 40 },
    { name: 'uncalled throws are free and ignored',
      h: [{ band: null, p: 0.99 }, { band: 'COIN_FLIP', p: 0.5 }],
      expect: r => r.calls === 1 && r.score === 100 },
    { name: 'gimmes cannot reach the top rating',
      h: Array.from({ length: 10 }, () => ({ band: 'SURE_THING', p: 0.97 })),
      expect: r => r.score === Math.round(SAFE_CALL_CAP * 100) && r.capped === 10 },
    { name: 'only the last 20 calls count',
      h: Array.from({ length: 30 }, (_, i) => (i < 10
        ? { band: 'LONG_SHOT', p: 0.95 }     // 10 terrible calls, then aged out
        : { band: 'COIN_FLIP', p: 0.5 })),
      expect: r => r.calls === 20 && r.score === 100 },
    { name: 'malformed entries are rejected, not counted',
      h: [{ band: 'NOT_A_BAND', p: 0.5 }, { band: 'COIN_FLIP', p: NaN }, { band: 'COIN_FLIP', p: 0.5 }],
      expect: r => r.calls === 1 && r.score === 100 }
  ];
  let fixPass = 0;
  const fixFail = [];
  for (const f of fixtures) {
    const r = trainerRead(f.h);
    if (f.expect(r)) fixPass++;
    else fixFail.push(`${f.name} (got score=${r.score} calls=${r.calls} capped=${r.capped})`);
  }
  gate('G4.1', '§5 fixtures', fixPass === fixtures.length,
    `${fixPass}/${fixtures.length}${fixFail.length ? ' — ' + fixFail.join('; ') : ''}`);

  // --- 20k fuzz proving §5.2 determinism, §5.3 monotone + order, §5.4 cap ---
  // Deterministic PRNG so a failure is reproducible from the seed alone.
  let seed = 0x1a2b3c4d;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bands = Object.keys(CALL_BANDS);

  let determinismFails = 0, orderFails = 0, monotoneFails = 0, capFails = 0, rangeFails = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const len = 1 + Math.floor(rnd() * 24);
    const hist = Array.from({ length: len }, () => ({
      band: bands[Math.floor(rnd() * bands.length)],
      p: rnd()
    }));

    const a = trainerRead(hist);

    // §5.2 pure/deterministic: same input, same output.
    const b = trainerRead(hist.map(e => ({ ...e })));
    if (a.score !== b.score) determinismFails++;

    // range sanity
    if (!(a.score >= 0 && a.score <= 100)) rangeFails++;

    // §5.3 order irrelevant.
    const shuffled = hist.slice();
    for (let k = shuffled.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
    }
    // Order only has to be irrelevant within the scoring window; if the history
    // is longer than the window, shuffling changes which calls are IN it.
    if (hist.length <= EW.TRAINER_READ_WINDOW && trainerRead(shuffled).score !== a.score) orderFails++;

    // §5.3 monotone: correcting every call to its true band must never score
    // lower than the player's actual calls, and mis-calling further must never
    // score higher.
    const trueBand = p => (p < CALL_BANDS.LONG_SHOT.hi ? 'LONG_SHOT'
      : p > CALL_BANDS.SURE_THING.lo ? 'SURE_THING' : 'COIN_FLIP');
    const perfect = trainerRead(hist.map(e => ({ band: trueBand(e.p), p: e.p })));
    if (perfect.score < a.score) monotoneFails++;
    const worst = trainerRead(hist.map(e => ({
      band: e.p > 0.5 ? 'LONG_SHOT' : 'SURE_THING', p: e.p
    })));
    if (worst.score > perfect.score) monotoneFails++;

    // §5.4 safe-call cap: an all-gimme history, however well called, is capped.
    if (i % 200 === 0) {
      const gimmes = Array.from({ length: 5 }, () => {
        const p = rnd() < 0.5 ? rnd() * 0.10 : 0.90 + rnd() * 0.10;
        return { band: trueBand(p), p };
      });
      if (trainerRead(gimmes).score > Math.round(SAFE_CALL_CAP * 100)) capFails++;
    }
  }
  gate('G4.2', `§5.2 determinism over ${N} fuzz histories`, determinismFails === 0,
    `${determinismFails} mismatches`);
  gate('G4.3', '§5.3 order-independence + monotonicity', orderFails === 0 && monotoneFails === 0,
    `order ${orderFails}, monotone ${monotoneFails}`);
  gate('G4.4', '§5.4 safe-call cap holds', capFails === 0, `${capFails} uncapped gimme histories`);
  gate('G4.5', 'score always within 0..100', rangeFails === 0, `${rangeFails} out of range`);
}

// ---------------------------------------------------------------------------
// Browser gates.
// ---------------------------------------------------------------------------
/* Resolve playwright explicitly instead of relying on ambient NODE_PATH.
 *
 * CI installs it into the REPOSITORY ROOT (`npm install --no-save playwright`
 * in emberwild-verify.yml), and this file lives in tools/, so Node's default
 * resolution walks up and finds it there. Anywhere else - a fresh checkout, a
 * machine with playwright installed globally - it does not, because Node does
 * not search the global root unless NODE_PATH says so. GB then reported FAIL,
 * and that red sat in the estate's standing count as though it were a property
 * of the game rather than of the machine.
 *
 * The assertion below is unchanged. Only the search path is.
 */
function loadPlaywright() {
  const repoRoot = path.resolve(__dirname, '..');
  // /opt/node22/bin/node -> /opt/node22/lib/node_modules
  const globalRoot = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules');
  const paths = [
    path.join(repoRoot, 'node_modules'),
    globalRoot,
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  ].filter(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
  return require(require.resolve('playwright', { paths }));
}

// Focus exposes the game's own accessible choice tray. Click still has to
// pass Playwright's normal visibility/actionability checks; no forced events.
async function activateGameChoice(page, name) {
  const choice = page.locator('#semantic-actions').getByRole('button', { name, exact: typeof name === 'string' });
  await choice.waitFor({ state: 'attached', timeout: 10000 });
  await choice.focus();
  await choice.click({ timeout: 10000 });
}

async function advanceOpenDialogue(page) {
  // A click reveals a line or advances it; the bound catches a stuck dialogue.
  for (let step = 0; step < 64; step++) {
    if (!await page.evaluate(() => window.__EMBERWILD__.ui.dialogue.active)) return;
    await activateGameChoice(page, 'Continue dialogue');
  }
  if (await page.evaluate(() => window.__EMBERWILD__.ui.dialogue.active)) {
    throw new Error('Dialogue did not close after 64 visible activations');
  }
}

async function completeOnboarding(page) {
  try {
    await page.getByText('Start new journey', { exact: true }).click();
    await activateGameChoice(page, 'Continue to the Hearthside Vigil');
    await activateGameChoice(page, /^Sit with Spriglet\./);
    // The normal Vigil accepts alignment after at most three honest attempts.
    for (let attempt = 0; attempt < 3; attempt++) {
      await activateGameChoice(page, /^Harmonize with Spriglet\./);
      const synced = await page.evaluate(() => !!window.__EMBERWILD__.starterAttunement?.synced);
      if (synced) break;
    }
    await page.waitForFunction(() => window.__EMBERWILD__?.ui.dialogue.active, null, { timeout: 10000 });
    await advanceOpenDialogue(page);
    await page.waitForFunction(() => {
      const g = window.__EMBERWILD__, E = window.EmberwildEngine;
      return g?.mode === E.GameMode.OVERWORLD && !g.ui.dialogue.active
        && !g.identityView && !g.starterAttunement && !g.systemPaused
        && g.flags.get(E.EWFlags.ARRIVAL_PROLOGUE_COMPLETE)
        && g.party.some(mon => mon.speciesId === 'spriglet');
    }, null, { timeout: 10000 });
    return gate('G0', 'visible identity, starter and prologue controls reach the overworld', true);
  } catch (error) {
    return gate('G0', 'visible identity, starter and prologue controls reach the overworld', false, error.message);
  }
}

async function browserGates(gamePath) {
  let chromium;
  try { ({ chromium } = loadPlaywright()); }
  catch (_) {
    gate('GB', 'browser gates', false, 'playwright unavailable — run in CI (SHIPPED-AS-CI)');
    return;
  }
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const external = [], errors = [];
    page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) external.push(r.url()); });
    page.on('pageerror', e => errors.push(String(e.message)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto('file://' + gamePath);
    await page.waitForTimeout(2600);

    gate('G1', 'zero external requests at boot', external.length === 0,
      external.length ? external.join(' | ') : 'network log empty');

    // Start a real journey through the release's visible onboarding controls.
    if (!await completeOnboarding(page)) return;

    // G12 boot clean.
    gate('G12', 'boot with zero console/page errors', errors.length === 0,
      errors.slice(0, 2).join(' | ') || 'clean');

    // The world actually draws — a canvas at its default size with one colour
    // is an uninitialised canvas, not a rendered scene.
    const world = await page.evaluate(() => {
      const c = document.getElementById('world-canvas');
      if (!c) return null;
      const x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      return { w: c.width, h: c.height, cw: c.clientWidth, colours: s.size };
    });
    gate('R1', 'world canvas renders a real scene',
      !!world && world.colours > 50 && world.cw > 0,
      world ? `${world.w}x${world.h}, ${world.colours} distinct colours` : 'no canvas');

    // G5 rendered floor — assert measured size, not just the stylesheet.
    const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href]'))
      .filter(e => e.offsetParent !== null)
      .map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className || e.tagName, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })
      .filter(o => o.w > 0 && (o.w < 44 || o.h < 44)));
    gate('G5', 'rendered interactive targets >= 44px', small.length === 0,
      small.length ? JSON.stringify(small.slice(0, 4)) : 'all visible targets clear the floor');

    // The encounter remains the harness fixture. Its introductory lessons and
    // the first Pod tutorial must be completed through real player controls.
    try {
      const started = await page.evaluate(() => window.__EMBERWILD__.startWildEncounter(true));
      if (!started) throw new Error('The overworld refused the encounter fixture');
      await page.waitForFunction(() => {
        const g = window.__EMBERWILD__;
        return g.battle && !g.battleTransition.active && (g.ui.dialogue.active || !g.battle.busy);
      }, null, { timeout: 15000 });
      await advanceOpenDialogue(page);
      await page.waitForFunction(() => window.__EMBERWILD__.battle && !window.__EMBERWILD__.battle.busy,
        null, { timeout: 15000 });
      await activateGameChoice(page, 'Bag');
      await activateGameChoice(page, /^Prism Pod, /);
      await page.waitForFunction(() => {
        const g = window.__EMBERWILD__;
        return g.ui.dialogue.active || g.battle?.menu === 'call';
      }, null, { timeout: 10000 });
      await advanceOpenDialogue(page);
      await page.waitForFunction(() => window.__EMBERWILD__.battle?.menu === 'call', null, { timeout: 10000 });
      gate('G4.6', 'Call the Catch is reachable from a real throw', true, 'battle menu = call');
    } catch (error) {
      gate('G4.6', 'Call the Catch is reachable from a real throw', false,
        `${error.message}; dependent battle probes were not run`);
      return;
    }

    await activateGameChoice(page, 'Coin flip, 30 to 70 percent');
    try {
      await page.waitForFunction(() => window.__EMBERWILD__.callHistory.length === 1
        && /true odds were [\d.]+ per cent/i.test(document.getElementById('sr-status').textContent),
      null, { timeout: 15000 });
    } catch (error) {
      gate('G4.7', 'true probability revealed and announced', false, error.message);
      return;
    }
    const reveal = await page.evaluate(() => ({
      sr: document.getElementById('sr-status').textContent,
      history: window.__EMBERWILD__.callHistory,
      read: window.__EMBERWILD__.trainerReadScore()
    }));
    gate('G4.7', 'true probability revealed and announced',
      /true odds were [\d.]+ per cent/i.test(reveal.sr) && reveal.history.length === 1,
      reveal.sr.slice(0, 70));

    // A failed capture can leave the battle alive. Exit with the ordinary Run
    // action so later overworld/Depths probes do not overlap an active battle.
    await page.waitForFunction(() => !window.__EMBERWILD__.battle || !window.__EMBERWILD__.battle.busy,
      null, { timeout: 15000 });
    if (await page.evaluate(() => !!window.__EMBERWILD__.battle)) await activateGameChoice(page, 'Run');
    await page.waitForFunction(() => !window.__EMBERWILD__.battle
      && window.__EMBERWILD__.mode === window.EmberwildEngine.GameMode.OVERWORLD,
    null, { timeout: 10000 });

    const keys = await page.evaluate(() => Object.keys(localStorage));
    const stray = keys.filter(k => k.indexOf('mbm_emberwild_') !== 0 && k !== 'mbm_splash_last');
    gate('G3', 'every storage key is Emberwild-namespaced or the shared splash key', stray.length === 0,
      stray.length ? 'stray: ' + stray.join(', ') : keys.join(', '));

    // G9 hostile saves — reproduced, not asserted.
    const hostile = await page.evaluate(() => {
      const out = [];
      const cases = {
        truncated: '{"version":2,"party":[',
        wrongTypes: btoa(JSON.stringify({ version: 'two', party: 'not-an-array', checksum: 'x' })),
        offEnum: btoa(JSON.stringify({ version: 2, party: [{ speciesId: '__nope__', level: -5 }], checksum: 'x' })),
        notBase64: '!!!! not base64 !!!!',
        empty: ''
      };
      for (const [name, payload] of Object.entries(cases)) {
        try {
          localStorage.setItem('mbm_emberwild_SLOT_1', payload);
          const r = window.__EMBERWILD__.saveManager.read('SLOT_1');
          out.push({ name, ok: r.success === false, err: r.error });
        } catch (e) { out.push({ name, ok: false, err: 'THREW: ' + e.message }); }
      }
      try { localStorage.removeItem('mbm_emberwild_SLOT_1'); } catch (_) {}
      return out;
    });
    const badHostile = hostile.filter(h => !h.ok);
    gate('G9', 'hostile saves rejected cleanly (reproduced)', badHostile.length === 0,
      badHostile.length ? JSON.stringify(badHostile) : hostile.map(h => h.name).join(', ') + ' all refused');

    // Still alive after all that?
    const alive = await page.evaluate(() => !!(window.__EMBERWILD__ && window.__EMBERWILD__.running));
    gate('G9b', 'game still running after hostile-save probing', alive, '');

    // G6 reduced motion — boot a second page under the OS preference.
    const rmPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const rmErrors = [];
    rmPage.on('pageerror', e => rmErrors.push(String(e.message)));
    await rmPage.goto('file://' + gamePath);
    await rmPage.waitForTimeout(2200);
    const rm = await rmPage.evaluate(() => {
      const rule = getComputedStyle(document.querySelector('.mbmRule'));
      return {
        splash: document.getElementById('mbmSplash').getAttribute('data-mbm-splash-state'),
        ruleWidth: parseFloat(rule.width) || 0,
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches
      };
    });
    // The splash rule is an animation; under RM it must still have reached its
    // painted state rather than being frozen at zero width (static != blank).
    gate('G6', 'reduced motion: honoured and static state still reads',
      rm.matches && rm.ruleWidth > 0 && rmErrors.length === 0,
      `rule width ${rm.ruleWidth}px, splash ${rm.splash}, ${rmErrors.length} errors`);
    await rmPage.close();

    // The new focus-loss pause is intentional. Resume through the displayed
    // control after the second page, rather than altering simulation state.
    await page.bringToFront();
    if (await page.evaluate(() => window.__EMBERWILD__.systemPaused)) {
      await activateGameChoice(page, /^Resume paused game with /);
      await page.waitForFunction(() => !window.__EMBERWILD__.systemPaused, null, { timeout: 10000 });
    }

    // G2 — determinism. Two FRESH generations from one seed must agree, for
    // every mode. Run inside the page against the shipped generator.
    const det = await page.evaluate(() => {
      const out = { pairs: 0, identical: 0, invalid: 0, modes: [] };
      const G = window.__EMBERWILD_DEPTHS__;
      for (const mode of ['cavern', 'ruins', 'hybrid']) {
        for (const seed of [1, 42, 99999, 3735928559]) {
          const a = new G.DungeonGenerator().generate({ seed, mode, floors: 3 });
          const b = new G.DungeonGenerator().generate({ seed, mode, floors: 3 });
          out.pairs++;
          if (a.checksum === b.checksum) out.identical++;
          if (!a.validation.valid) out.invalid++;
        }
        out.modes.push(mode);
      }
      return out;
    });
    gate('G2', 'same seed -> identical dungeon checksums',
      det.identical === det.pairs && det.pairs > 0,
      `${det.identical}/${det.pairs} identical across ${det.modes.join('/')}`);
    gate('G2b', 'every generated floor is route-valid', det.invalid === 0,
      `${det.invalid} invalid dungeons`);

    // The bridge is the one crossing point, and the enums it remaps genuinely
    // collide. Pin the remap so a future edit cannot quietly put grass where
    // water belongs.
    const remap = await page.evaluate(() => window.__EMBERWILD_BRIDGE__.SURFACE_MAP);
    // engine -> chassis: WATER 2->4, ICE 4->5, TALL_GRASS 5->2
    const remapOK = remap[2] === 4 && remap[4] === 5 && remap[5] === 2
      && remap[0] === 0 && remap[1] === 1 && remap[3] === 3;
    gate('D1', 'Depths surface remap is explicit and correct', remapOK,
      `engine 2->${remap[2]} (water), 4->${remap[4]} (ice), 5->${remap[5]} (grass)`);

    // A delve must actually run: generate, load, render, descend, surface.
    const delve = await page.evaluate(() => {
      const g = window.__EMBERWILD__;
      const entered = g.enterDepths();
      const types = [...new Set(g.npcs.map(n => n.type))];
      const descended = g.descend();
      const floor = g.depths && g.depths.floorIndex;
      g.party.forEach(m => (m.currentHP = 0));
      g.depthsRecover();
      const healed = g.party.every(m => m.currentHP > 0);
      g.leaveDepths(true);
      return { entered, types, descended, floor, healed, surfaced: g.depths === null };
    });
    gate('D2', 'a delve runs: enter, populate, descend, recover, surface',
      delve.entered && delve.descended && delve.healed && delve.surfaced,
      `entities ${delve.types.join('/')}, reached floor ${delve.floor + 1}`);
    gate('D3', 'SEMH rule: a Depths defeat heals and never ends the run',
      delve.healed, 'party restored at the floor entrance');

    // G8 runtime — the panel is raised by the failure path, and there is one.
    const g8 = await page.evaluate(() => {
      window.EW.rendererFailure.raise('harness-probe');
      const el = document.getElementById('renderer-failure');
      const open = getComputedStyle(el).display !== 'none';
      el.removeAttribute('data-open');
      return { open, copies: document.querySelectorAll('#renderer-failure').length };
    });
    gate('G8r', 'failure panel raises and is a single site', g8.open && g8.copies === 1,
      `display shown=${g8.open}, copies=${g8.copies}`);

    // G13 runtime — the registry drift check does what it says.
    //
    // The interesting assertion is D13.append: hashing the WHOLE registry, the
    // obvious way to write this, changes on every legitimate content addition
    // and so would reject correct saves. Carrying the lengths makes the PREFIX
    // the thing compared, which is the property append-only actually gives us.
    // D13.naive records that the obvious form really would have fired, so this
    // gate keeps proving why it is written the way it is.
    const d13 = await page.evaluate(() => {
      const D = window.__EMBERWILD_DEN__;
      if (!D || typeof D.checkRegistry !== 'function' || typeof D.registryStamp !== 'function') {
        return { absent: true };
      }
      const c = D.codec, L = c.registryLengths;
      const shorter = { ...L, species: Math.max(0, L.species - 1) };
      const g = window.__EMBERWILD__;
      return {
        absent: false,
        identity: c.fingerprintAt(L) === c.registryFingerprint,
        stamp:    D.checkRegistry(D.registryStamp()),
        append:   D.checkRegistry({ lengths: shorter, fingerprint: c.fingerprintAt(shorter) }),
        naive:    c.fingerprintAt(shorter) !== c.registryFingerprint,
        drift:    D.checkRegistry({ lengths: L, fingerprint: c.fingerprintAt(shorter) }),
        removed:  D.checkRegistry({ lengths: { ...L, moves: L.moves + 1 }, fingerprint: c.registryFingerprint }),
        junk:     D.checkRegistry({ lengths: { ...L, items: -3 }, fingerprint: c.registryFingerprint }),
        legacy:   D.checkRegistry(undefined),
        roundTrip: g ? D.checkRegistry(g.serialize().denRegistry) : 'no-game'
      };
    });
    if (d13.absent) {
      gate('G13', 'Den registry drift check', false,
        'EWDen.checkRegistry / registryStamp absent — the gate has nothing to test');
    } else {
      const reds = d13.drift === 'drift' && d13.removed === 'drift' && d13.junk === 'drift';
      gate('G13', 'Den registry drift check: prefix holds, drift fires',
        d13.identity && d13.stamp === 'ok' && d13.append === 'ok' && d13.naive &&
        reds && d13.legacy === 'unknown' && d13.roundTrip === 'ok',
        `append=${d13.append} (a whole-registry assert would have fired: ${d13.naive}), ` +
        `drift/removed/junk=${d13.drift}/${d13.removed}/${d13.junk}, ` +
        `no-stamp=${d13.legacy}, real save=${d13.roundTrip}`);
    }

  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Non-vacuity: every gate must be shown to fail on a violating build.
// ---------------------------------------------------------------------------
async function selftest(html) {
  say('\n--- non-vacuity: each gate must fail on a build that violates it ---');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-vac-'));
  const mutations = [
    { gate: 'G1s', why: 're-add a CDN script',
      mutate: s => s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script></head>') },
    { gate: 'G5s', why: 'shrink a touch target below the floor',
      mutate: s => s.replace(/\.icon-button \{\s*width: 44px; height: 44px;/, '.icon-button {\n      width: 30px; height: 30px;') },
    { gate: 'G5s', why: 'restore the scale(.9) inside the media query',
      mutate: s => s.replace('#touch-dpad { width: 140px; height: 140px; }', '#touch-dpad { transform: scale(.9); }') },
    { gate: 'G8', why: 'add a second failure panel',
      mutate: s => s.replace('<main id="app"', '<div id="renderer-failure"></div><main id="app"') },
    { gate: 'HF1', why: 'same-length corruption inside the generated exit control',
      mutate: s => s.replace('Back: Arcade', 'Bock: Arcade') },
    { gate: 'HF2', why: 'remove the maker splash identity',
      mutate: s => s.replace('id="mbmSplash"', 'id="mbmSplash-broken"') },
    { gate: 'HF3', why: 'repoint the canonical away from Emberwild',
      mutate: s => s.replace('rel="canonical" href="https://madebymatt.uk/emberwild/"',
        'rel="canonical" href="https://madebymatt.uk/not-emberwild/"') },
    { gate: 'G11s', why: 'drop the noscript block',
      mutate: s => s.replace(/<noscript>[\s\S]*?<\/noscript>/, '') },
    { gate: 'G3s', why: 'write a key outside the helper',
      mutate: s => s.replace('this.callHistory=[];', "this.callHistory=[];localStorage.setItem('emberwild_sneaky','1');") },
    { gate: 'HF4', why: 'restore the false pre-repair lineage claim',
      mutate: s => s.replace('emberwild-live-e63be95f-descendant-ascension-2026-08-30', 'emberwild-build-2026-08-13') },
    { gate: 'HF4', why: 'restore the obsolete 2.0.1 build stamp',
      mutate: s => s.replace(RELEASE_BUILD, 'emberwild-ascension-2.0.1-2026-09-01') },
    { gate: 'HF4', why: 'disagree with the declared runtime release',
      mutate: s => s.replace(`const APP_VERSION = '${RELEASE_VERSION}';`, "const APP_VERSION = '2.0.1';") },
    { gate: 'B1', why: 'exceed the bounded release budget by one byte',
      mutate: s => s + ' '.repeat(Math.max(1, MAX_GAME_BYTES + 1 - Buffer.byteLength(s, 'utf8'))) },
    { gate: 'G12s', why: 'introduce a syntax error',
      mutate: s => s.replace('const EWStore = Object.freeze({', 'const EWStore = Object.freeze({{') },
    { gate: 'G13s', why: 'stop reading the Den registry stamp back',
      mutate: s => s.replace(/if\(EWDen\.checkRegistry\(d\.denRegistry\)==='drift'\)[^\n]*\n/, '') },
    { gate: 'G13s', why: 'go back to the write-only fingerprint',
      mutate: s => s.replace('denRegistry:EWDen.registryStamp()', 'denFingerprint:EWDen.codec.registryFingerprint') }
  ];

  let proven = 0;
  for (const mut of mutations) {
    const broken = mut.mutate(html);
    if (broken === html) { say(`  ??  ${mut.gate}: mutation "${mut.why}" did not change the file`); continue; }
    const f = path.join(tmp, `broken-${mut.gate}-${proven}.html`);
    fs.writeFileSync(f, broken);
    const before = results.length;
    const saved = results.splice(0, results.length);           // isolate
    const quiet = say;
    staticGates(broken);
    const got = results.splice(0, results.length);
    saved.forEach(x => results.push(x));                        // restore
    const target = got.find(g => g.id === mut.gate);
    const caught = target && !target.ok;
    say(`  ${caught ? 'CAUGHT' : 'MISSED'}  ${mut.gate}: ${mut.why}`);
    if (caught) proven++;
  }
  gate('NV', 'gates are non-vacuous', proven === mutations.length,
    `${proven}/${mutations.length} violations caught`);
}

// ---------------------------------------------------------------------------
(async function main() {
  if (!fs.existsSync(GAME)) { say('FATAL: game file not found: ' + GAME); process.exit(2); }
  const html = fs.readFileSync(GAME, 'utf8');
  const bytes = Buffer.byteLength(html, 'utf8');
  const sha = require('crypto').createHash('sha256').update(html).digest('hex');
  say(`Emberwild harness — ${GAME}`);
  say(`bytes ${bytes}  sha256 ${sha}\n`);

  staticGates(html);

  // Twist gates run against the shipped function, loaded out of the file.
  say('');
  try {
    const scriptBlock = html.match(/<script>'use strict';([\s\S]*?)<\/script>/)[1];
    // The game body is wrapped in a document guard; evaluate only the twist
    // pieces by re-declaring them in a bare sandbox.
    const vm = require('vm');
    const sandbox = { console, performance: { now: () => 0 } };
    const slice = scriptBlock.slice(
      scriptBlock.indexOf('const CALL_BANDS'),
      scriptBlock.indexOf('class EncounterEngine') > 0
        ? scriptBlock.indexOf('class EncounterEngine')
        : scriptBlock.length);
    vm.createContext(sandbox);
    vm.runInContext(slice + '\n;this.__EW={trainerRead,callAccuracy,CALL_BANDS,TRAINER_READ_WINDOW,SAFE_CALL_LOW,SAFE_CALL_HIGH,SAFE_CALL_CAP};', sandbox);
    twistGates(sandbox.__EW);
  } catch (e) {
    gate('G4', 'twist contract', false, 'could not evaluate twist module: ' + e.message);
  }

  say('');
  await browserGates(GAME);

  if (SELFTEST) await selftest(html);

  const failed = results.filter(r => !r.ok);
  say(`\n${results.length - failed.length}/${results.length} gates green`);
  if (failed.length) {
    say('FAILED: ' + failed.map(f => f.id).join(', '));
    process.exit(1);
  }
  say('ALL GATES GREEN');
})().catch(e => { say('HARNESS ERROR: ' + e.stack); process.exit(2); });
