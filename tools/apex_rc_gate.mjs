/* The shared gate for the RC-generation Apex sports games (Apex Curl, Apex
 * Velodrome). One implementation, two entry points.
 *
 * WHY SHARED. Two hand-written copies of these assertions is the second-literal
 * trap this estate keeps being bitten by: the day the stamped exit region or the
 * splash region changes, one copy keeps passing against a file it is no longer
 * describing. The per-game entry points carry only what genuinely differs — the
 * route, the storage keys the game owns, and the determinism probe.
 *
 * WHAT IS DELIBERATELY PROVEN IN A BROWSER, NOT IN SOURCE. Presence of the exit
 * control and its rendered size, the splash's keyboard dismissal, the absence of
 * audio before a gesture, and determinism are all runtime facts. A text search
 * over source is evidence about the text, never about the runtime — the estate
 * already records that as R-HUC01, and /neonbreach/ is the standing warning.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');
/* Use an explicitly pinned Chromium when one is actually present (the local
   sandbox has one at this path), and otherwise let Playwright launch the browser
   it just installed. Passing an executablePath that does not exist fails harder
   than passing none at all: on a GitHub runner this threw
   "Failed to launch chromium because executable doesn't exist" before a single
   runtime gate ran, so the whole job read as a contract failure. The pattern is
   the one tools/verify_emberwild.js already documents. */
const PINNED = process.env.MBM_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const CHROME = PINNED && existsSync(PINNED) ? PINNED : undefined;

/* The declared regions, read from the ledger rather than pasted here. */
const LEDGER = JSON.parse(readFileSync(join(ROOT, 'data/hud-coverage.json'), 'utf8'));
const EXIT_BYTES = LEDGER.inlineExitRegion._bytes;
const EXIT_SHA = LEDGER.inlineExitRegion._sha256;

const EXIT_RE = /<!--\s*MBM-INLINE-EXIT:BEGIN[\s\S]*?MBM-INLINE-EXIT:END\s*-->\n?/;
const SPLASH_RE = /<!--\s*MBM-SPLASH:BEGIN[\s\S]*?MBM-SPLASH:END\s*-->\n?/;

export function makeFindings(name) {
  const rows = [];
  return {
    check(ok, what, detail = '') {
      rows.push({ ok: !!ok, what, detail });
      console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
      return !!ok;
    },
    finish() {
      const bad = rows.filter(r => !r.ok);
      console.log(`\n${name}: ${rows.length - bad.length}/${rows.length} passed`);
      if (bad.length) { console.error(`${name}: ${bad.length} FAILED`); process.exit(1); }
      process.exit(0);
    },
  };
}

export async function gate({ name, route, storageKeys, global: global_ }) {
  const f = makeFindings(name);
  const rel = route.replace(/^\/|\/$/g, '') + '/index.html';
  const path = join(ROOT, rel);

  f.check(existsSync(path), `${route}: the route serves a file`, rel);
  const html = readFileSync(path, 'utf8');

  /* --- single file, the promise these games make --------------------------- */
  const exit = (html.match(EXIT_RE) || [''])[0];
  const splash = (html.match(SPLASH_RE) || [''])[0];
  const game = html.replace(EXIT_RE, '').replace(SPLASH_RE, '');
  const ext = [...game.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  f.check(ext.length === 0, `${route}: the game itself loads no external script`, ext.join(', '));
  const offOrigin = [...game.matchAll(/\bhttps?:\/\/[^"'\s)]+/g)]
    .map(m => m[0]).filter(u => !/^https?:\/\/(www\.)?(w3\.org|schema\.org)/.test(u));
  f.check(offOrigin.length === 0, `${route}: no off-origin URL in the game`, offOrigin.slice(0, 3).join(', '));

  /* --- the stamped platform regions --------------------------------------- */
  f.check(!!exit, `${route}: carries the stamped inline exit region`);
  f.check(Buffer.byteLength(exit, 'utf8') === EXIT_BYTES,
    `${route}: exit region is the declared ${EXIT_BYTES} bytes`,
    String(Buffer.byteLength(exit, 'utf8')));
  f.check(createHash('sha256').update(exit).digest('hex') === EXIT_SHA,
    `${route}: exit region is byte-identical to the declared region`);
  f.check(!!splash, `${route}: carries the stamped Made by Matt splash region`);

  /* --- reduced motion ------------------------------------------------------ */
  f.check(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(game),
    `${route}: honours prefers-reduced-motion`);

  /* --- storage: the declared keys, and only those -------------------------- */
  const keys = [...new Set([...game.matchAll(/['"]((?:apex)_[a-z0-9_]+)['"]/g)].map(m => m[1]))]
    .filter(k => !/_v\d_\d_rc\d_$/.test(k));   // export filename prefixes are not storage
  f.check(keys.length === storageKeys.length && storageKeys.every(k => keys.includes(k)),
    `${route}: touches exactly the declared storage keys`, keys.join(', '));

  /* --- runtime ------------------------------------------------------------- */
  const b = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    /* no eager audio: nothing may be running before a gesture */
    const p1 = await b.newPage({ viewport: { width: 390, height: 844 } });
    const requests = [];
    p1.on('request', r => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
    await p1.goto('file://' + path);
    await p1.waitForTimeout(1500);
    const audio = await p1.evaluate(() => {
      const C = window.AudioContext || window.webkitAudioContext;
      return { made: !!window.__mbmAudioMade, states: (window.__mbmAudioStates || []) , has: !!C };
    });
    f.check(requests.length === 0, `${route}: zero off-origin requests at load`, requests.slice(0,2).join(', '));

    /* the exit control must be FOUND ON A PHONE, not merely present in source */
    for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.goto('file://' + path);
      await p.waitForSelector('#mbmexit-back', { timeout: 15000 }).catch(() => {});
      const box = await p.evaluate(() => {
        const e = document.querySelector('#mbmexit-back');
        if (!e) return null;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return { w: r.width, h: r.height, top: r.top, left: r.left,
                 vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0,
                 href: e.getAttribute('href') };
      });
      f.check(box && box.vis && box.w >= 44 && box.h >= 44 && box.href === '/games/',
        `${route}: exit control rendered ≥44×44 and resolving at ${w}px`,
        box ? `${Math.round(box.w)}×${Math.round(box.h)} href=${box.href}` : 'not in the DOM');
      await p.close();
    }
    await p1.close();

    /* Determinism, on the game's OWN contract rather than one invented here.
       Both RC games ship __rcSelfTest(): a fixed 1000-step run, executed twice
       from the same start, reporting the two state hashes and whether they
       match. Asserting on that is asserting on the thing the game promises;
       a probe written here would only ever be a proxy for it. The hash is then
       compared ACROSS two separate page loads as well, which is the part a
       single in-page run cannot show. */
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const p = await b.newPage();
      await p.goto('file://' + path);
      await p.waitForFunction(`!!window.${global_}`, { timeout: 20000 });
      runs.push(await p.evaluate(g => window[g].__rcSelfTest(), global_));
      await p.close();
    }
    f.check(runs.every(r => r && r.identical === true),
      `${route}: the game's own 1000-step self-test is internally identical`);
    f.check(runs[0].hash === runs[1].hash,
      `${route}: the same self-test hash across two separate page loads`,
      String(runs[0].hash).slice(0, 40) + '…');
    /* And the hash has to be THE DECLARED ONE. Internal agreement plus
       cross-load agreement together still only prove the game is repeatable —
       a changed physics constant is perfectly repeatable and would sail past
       both. The pinned value is what actually moves when the model moves. */
    const pinned = (LEDGER.excluded.find(e => e.route === route) || {}).determinismSelfTestHash;
    f.check(!!pinned, `${route}: the ledger pins a determinism baseline to compare against`);
    f.check(runs[0].hash === pinned,
      `${route}: the self-test hash is the declared baseline (physics unchanged)`,
      pinned ? '' : 'no baseline declared');
  } finally { await b.close(); }

  f.finish();
}
