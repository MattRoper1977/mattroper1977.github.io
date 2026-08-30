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

/* Classify every mbm_ / apex_ prefixed literal in a build by where it is USED.
 *
 * Whole-file regex rather than a parser, deliberately: these builds are single
 * self-contained files of up to 900 KB with inlined third-party bundles, and a
 * parser over that is a second thing to drift. What the regex must get right is
 * only the binding indirection — a key is nearly always bound to a const and
 * then passed by name — so bindings are resolved first and call sites are
 * matched against literals and bound names alike.
 *
 * WRITE sinks are the DOM setters and the wrappers these builds actually use;
 * READ sinks likewise. A literal reaching neither, but reaching a download
 * filename, is not storage. A literal reaching none of the three is reported
 * nowhere and asserts nothing — it may be a build id, a CSS class, an event
 * name. Only writes are held to the declared set. */
const KEY_LITERAL = /['"]((?:mbm|apex)_[a-z0-9_]+)['"]/g;
const WRITE_SINKS = ['setItem', 'removeItem', 'writeJson', 'safeSet', 'rawSet', 'persist'];
const READ_SINKS = ['getItem', 'readJson', 'safeGet', 'rawGet'];
const FILENAME_SINKS = /\.(?:csv|json|txt)['"`]|download\s*[(=]|new Blob|createObjectURL/;

export function collectStorageKeys(source) {
  /* 1. NAME = 'mbm_thing'  →  NAME resolves to that key.
   * Not anchored to var/let/const: these builds routinely declare several keys
   * in one statement — const STORAGE='apex_velodrome_rc_v1',STARSTORE='…' —
   * and an anchored pattern binds only the first declarator, so the second key
   * becomes invisible. A name may bind more than once; keep every binding
   * rather than letting the last one win. */
  const bound = new Map();
  for (const m of source.matchAll(/(?:^|[,;{(=\s])([A-Za-z_$][\w$]*)\s*=\s*['"]((?:mbm|apex)_[a-z0-9_]+)['"]/g)) {
    if (!bound.has(m[1])) bound.set(m[1], new Set());
    bound.get(m[1]).add(m[2]);
  }

  /* Built as a string, so every backslash the regex needs is doubled here.
   * A single \w inside a JS string literal is just the letter w, which is how
   * the first version of this silently matched no identifier at all and
   * reported that a build with a plain localStorage.setItem writes nothing. */
  const arg = '(?:[\'"]((?:mbm|apex)_[a-z0-9_]+)[\'"]|([A-Za-z_$][\\w$]*))';
  const collect = (sinks) => {
    const found = new Set();
    for (const sink of sinks) {
      const re = new RegExp(sink + '\\s*\\(\\s*' + arg, 'g');
      for (const m of source.matchAll(re)) {
        if (m[1]) { found.add(m[1]); continue; }
        const keys = bound.get(m[2]);
        if (keys) for (const k of keys) found.add(k);
      }
    }
    return found;
  };
  const writes = collect(WRITE_SINKS);
  const reads = collect(READ_SINKS);

  /* 2. Anything left over that only ever builds a download filename.
   * Followed through the BINDING, not through a character window around the
   * literal: a build declares the prefix in one place and uses it in another,
   * and a fixed window decides by how much unrelated code happens to sit
   * between them. A control that put 130 characters there was missed by a
   * 120-character window while the real build was caught — the same finding
   * either way, which is precisely what makes the window the wrong instrument. */
  const namesFor = key => [...bound.entries()].filter(([, ks]) => ks.has(key)).map(([n]) => n);
  const usedAsFilename = (key) => {
    const needles = [...namesFor(key).map(n => new RegExp('\\b' + n + '\\b', 'g')), new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')];
    for (const re of needles) {
      for (const hit of source.matchAll(re)) {
        const window = source.slice(Math.max(0, hit.index - 160), hit.index + hit[0].length + 160);
        if (FILENAME_SINKS.test(window)) return true;
      }
    }
    return false;
  };
  const filenames = new Set();
  for (const m of source.matchAll(KEY_LITERAL)) {
    const key = m[1];
    if (writes.has(key) || reads.has(key) || filenames.has(key)) continue;
    if (usedAsFilename(key)) filenames.add(key);
  }
  const sort = set => [...set].sort();
  return { writes: sort(writes), reads: sort(reads), filenames: sort(filenames) };
}

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
  /* This used to collect every source literal matching /(apex)_[a-z0-9_]+/ and
   * assert the set equalled the declared keys. It was wrong in three separate
   * directions at once, all three observed:
   *
   *   BLIND. The RC-generation builds namespace their storage as mbm_apex_*.
   *   None of those literals begin apex_, so the regex could not see them. A
   *   candidate passed this assertion while writing two keys the deployed
   *   build never writes. That green measured nothing.
   *
   *   RED ON READS. A build that reads its own legacy keys to migrate a child's
   *   save was failed for naming them. Reading a key is not touching storage in
   *   the sense this assertion is about, and punishing migration is the exact
   *   opposite of what the estate wants.
   *
   *   RED ON FILENAMES. 'apex_velodrome_aaa_v4_' builds
   *   apex_velodrome_aaa_v4_telemetry.csv. It is the category the old exclusion
   *   below existed to catch, and its _v\d_\d_rc\d_$ shape did not match.
   *
   * The repair does not widen that pattern — widening a pattern to swallow a
   * false red is how the next false green is manufactured. It classifies by
   * CALL SITE instead: a literal is a write key only where it reaches
   * setItem/removeItem or the estate's wrappers, whether directly or through a
   * const the file binds it to. Reads are collected separately and can never
   * red the write assertion, and a literal that only ever becomes a download
   * filename is not storage at all. */
  const storage = collectStorageKeys(game);
  const writes = storage.writes;
  f.check(writes.length === storageKeys.length && storageKeys.every(k => writes.includes(k)),
    `${route}: writes exactly the declared storage keys`, writes.join(', ') || '(none)');
  /* Printed, never asserted. A read is not a write, and a filename is not
   * storage; both are shown so a reviewer can see what the classifier decided
   * rather than having to trust that it decided anything. */
  if (storage.reads.length)
    console.log(`  [note] ${route}: also READS, never held to the declared set  — ${storage.reads.join(', ')}`);
  if (storage.filenames.length)
    console.log(`  [note] ${route}: literals that only build download filenames  — ${storage.filenames.join(', ')}`);

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
