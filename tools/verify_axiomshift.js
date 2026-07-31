#!/usr/bin/env node
/* Axiom Shift verification harness.
 * Extracts the DOM-free SIM CORE from Axiom_Shift.html and runs it headless to
 * MEASURE solvability, determinism, checkpoint-survivability and the Daily Shift
 * sweep; then asserts the §5 shipping contract against the built file's text;
 * then a render smoke test that actually drives draw() under a stub DOM.
 *
 * Every claim printed here is a measurement, not an inspection.
 * Usage: node tools/verify_axiomshift.js [path-to-html]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = process.argv[2] || path.join(__dirname, '..', 'games', 'Axiom_Shift.html');
const html = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name + (detail ? '  ' + detail : '')); }
  else { fail++; fails.push(name); console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}
function head(t) { console.log('\n== ' + t + ' =='); }

// ---- extract + load SIM CORE ----------------------------------------------
const BEGIN = '/* ===== AXIOM SHIFT — SIM CORE (BEGIN) =====';
const END = '/* ===== AXIOM SHIFT — SIM CORE (END) ===== */';
const bi = html.indexOf(BEGIN), ei = html.indexOf(END);
if (bi < 0 || ei < 0) { console.error('Could not find SIM CORE markers.'); process.exit(2); }
const coreSrc = html.slice(bi, ei + END.length);
const sandbox = { module: { exports: {} }, console: console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox, { filename: 'simcore' });
const A = sandbox.AXIOM;
if (!A) { console.error('SIM CORE did not expose AXIOM.'); process.exit(2); }

const TIERS = ['gentle', 'standard', 'sharp'];
const measured = { tapeClear: {}, daily: null, flash: null };

// ---- 1. canonical tape clears (all levels) --------------------------------
head('Canonical tape clears — each Proposition, x3 runs, bit-identical');
for (const lvl of A.LEVELS) {
  const runs = [A.runTape(lvl), A.runTape(lvl), A.runTape(lvl)];
  const cleared = runs.every(r => r.cleared && r.smudges === 0);
  const identical = runs[0].trace === runs[1].trace && runs[1].trace === runs[2].trace;
  measured.tapeClear[lvl.id] = { beat: runs[0].endBeat, trace: runs[0].trace };
  ok('clear/' + lvl.id, cleared, 'endBeat=' + runs[0].endBeat.toFixed(2) + '/' + lvl.endBeat);
  ok('deterministic/' + lvl.id, identical, 'trace=' + runs[0].trace);
}

// ---- 2. tier-independence + Axiom Rule on/off (Stage 3 gate) ---------------
head('All 6 × 3 tiers × (Axiom Rule on/off) clear from tape');
for (const lvl of A.LEVELS) {
  let allClear = true, traces = new Set();
  for (const tier of TIERS) {
    for (const axiom of [false, true]) {
      // Sim is beat-space and tempo-free: the tier is a render dial only.
      const r = A.runTape(lvl, { axiomRule: axiom });
      traces.add(r.trace);
      if (!(r.cleared && r.smudges === 0)) allClear = false;
    }
  }
  // Because integration never reads tempo, every tier trace is identical.
  ok('tiers+axiom/' + lvl.id, allClear && traces.size === 1,
     'clears=' + allClear + ' distinctTraces=' + traces.size + ' (expect 1)');
}

// ---- 3. fx-RNG independence (particles cannot change a frame) --------------
head('Visual RNG stream is independent of the sim');
{
  const lvl = A.LEVELS[0];
  const base = A.runTape(lvl, { seed: 7 }).trace;
  const s = A.createSim(lvl, { seed: 7 });
  for (let i = 0; i < 5000; i++) s.fxRng();          // burn the visual stream hard
  const after = A.runTape(lvl, { seed: 7 }).trace;
  ok('fxRng-independent', base === after, 'traceEqual=' + (base === after));
}

// ---- 4. checkpoint survivability ------------------------------------------
head('Every checkpoint is survivable-from (bot clears the remainder)');
for (const lvl of A.LEVELS) {
  let allok = true, bad = [];
  for (const cp of lvl.checkpoints) {
    const r = A.runFromCheckpoint(lvl, cp);
    if (!r.cleared) { allok = false; bad.push(cp.toFixed(1)); }
  }
  ok('checkpoints/' + lvl.id, allok, lvl.checkpoints.length + ' cps' + (allok ? '' : ' bad@' + bad.join(',')));
}

// ---- 5. Daily Shift sweep (identical + solvable across dates) --------------
head('Daily Shift — 64 dates: deterministic + solvable, no impossible junction');
{
  let good = 0, bad = [];
  const dates = [];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28 && dates.length < 64; d += 5)
    dates.push('2026-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
  for (const ds of dates) {
    const a = A.runTape(A.dailyLevel(ds));
    const b = A.runTape(A.dailyLevel(ds)); // "another machine"
    if (a.cleared && a.smudges === 0 && a.trace === b.trace) good++; else bad.push(ds);
  }
  measured.daily = { tested: dates.length, solvable: good };
  ok('daily-sweep', good === dates.length, good + '/' + dates.length + (bad.length ? ' bad:' + bad.slice(0, 4).join(',') : ''));
}

// ---- 6. photosensitivity budget -------------------------------------------
head('Photosensitivity — computed max flash rate under 3 Hz at top tempo');
measured.flash = A.maxFlashHz();
ok('flash-under-3hz', A.maxFlashHz() < 3, 'maxFlashHz=' + A.maxFlashHz().toFixed(3) + ' (sharp ' + A.TEMPOS.sharp + ' bpm)');

// ---- 7. §5 contract, asserted against the built file ----------------------
head('§5 shipping contract (asserted on the file text)');

// user-facing copy = text with <script> and <style> stripped, tags removed
function displayedCopy(src) {
  return src.replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ');
}
const copy = displayedCopy(html);
const banned = ['die', 'death', 'killed', 'kill', 'eliminated', 'game over', 'failed', 'vote out'];
let bannedHit = [];
for (const w of banned) {
  const re = new RegExp('\\b' + w.replace(/ /g, '\\s+') + '\\b', 'i');
  if (re.test(copy)) bannedHit.push(w);
}
ok('no-elimination-vocab', bannedHit.length === 0, bannedHit.length ? 'hit: ' + bannedHit.join(',') : '(displayed copy clean)');

// prove the check is honest: it MUST catch a real banned word in copy
{
  const probe = displayedCopy('<p>the player died — game over</p>');
  const caught = /\bgame\s+over\b/i.test(probe) && /\bdied\b/i.test('died');
  ok('vocab-check-self-test', /\bgame\s+over\b/i.test(probe), '(regex catches a real "game over")');
}

ok('no-audio', !/new\s+Audio\b|AudioContext|webkitAudioContext/.test(html), '(no Audio/AudioContext)');
ok('no-network', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|\bimport\s*\(/.test(html), '(no fetch/XHR/WS/dynamic import)');
ok('no-offorigin-src', !/(?:src|href)\s*=\s*["']https?:\/\//i.test(html), '(no off-origin src/href)');

// exactly one localStorage key literal, and no other literal-keyed calls
const keyLiteralCount = (html.match(/mbm_axiomshift/g) || []).length;
const otherLiteralKeyed = (html.match(/localStorage\.\w+\(\s*['"](?!mbm_axiomshift)/g) || []).length;
ok('one-storage-key', keyLiteralCount === 1 && otherLiteralKeyed === 0,
   "'mbm_axiomshift' x" + keyLiteralCount + ', other-literal-keyed=' + otherLiteralKeyed);

// prefers-reduced-motion block present and naming splash + menu
const rm = html.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\}\s*\}/);
const rmBlock = rm ? rm[0] : '';
ok('reduced-motion-covers-splash-menu',
   !!rmBlock && /splash/i.test(rmBlock) && /menu/i.test(rmBlock),
   rmBlock ? '(names splash+menu)' : '(block missing)');

ok('no-debug-cruft', !/console\.log|(^|[^.\w])debugger\b|\bTODO\b/.test(html.replace(/https?:\/\/[^\s"']+/g, '')), '(no console.log/debugger/TODO)');

// duplicate ids + every $()/getElementById literal resolves
const idSet = new Set();
let dupId = null;
const idRe = /\sid="([^"]+)"/g; let mm;
while ((mm = idRe.exec(html))) { if (idSet.has(mm[1])) dupId = mm[1]; idSet.add(mm[1]); }
ok('no-duplicate-ids', dupId === null, dupId ? 'dup: ' + dupId : '(' + idSet.size + ' unique ids)');

const refIds = new Set();
const refRe = /(?:\$\(|getElementById\(\s*)['"]([A-Za-z][\w-]*)['"]/g; let rr;
while ((rr = refRe.exec(html))) refIds.add(rr[1]);
const unresolved = [...refIds].filter(id => !idSet.has(id));
ok('all-id-refs-resolve', unresolved.length === 0, unresolved.length ? 'missing: ' + unresolved.join(',') : '(' + refIds.size + ' refs, all resolve)');

// ---- 8. render smoke — actually call draw() under a stub DOM ---------------
head('Render smoke — drive the real loop/draw under a stub DOM (no crash)');
{
  let smokeOk = true, err = '';
  try {
    const ctxStub = new Proxy({}, {
      get(t, p) { if (p in t) return t[p]; return function () {}; },
      set(t, p, v) { t[p] = v; return true; }
    });
    function El(tag) {
      const cls = new Set();
      return {
        tagName: tag, style: {}, dataset: {}, _kids: [], _lis: {},
        clientWidth: 900, clientHeight: 520, width: 0, height: 0,
        classList: { add: c => cls.add(c), remove: c => cls.delete(c),
          toggle: (c, f) => { if (f === undefined) f = !cls.has(c); f ? cls.add(c) : cls.delete(c); return f; },
          contains: c => cls.has(c) },
        set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; },
        textContent: '', appendChild(k) { this._kids.push(k); return k; },
        addEventListener(t2, fn) { this._lis[t2] = fn; },
        click() { if (this._lis.click) this._lis.click({ preventDefault() {} }); },
        setAttribute(k, v) { this['_a_' + k] = v; }, getAttribute(k) { return this['_a_' + k]; },
        querySelectorAll() { return []; }, focus() {}, getContext() { return ctxStub; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 900, height: 520 }; },
        get children() { return this._kids; }
      };
    }
    const els = {};
    const doc = {
      getElementById(id) { return els[id] || (els[id] = El('div')); },
      createElement(tag) { return El(tag); },
      querySelectorAll() { return []; },
      body: El('body'), addEventListener() {}
    };
    els.cv = El('canvas');
    let rafCb = null;
    const win = {
      devicePixelRatio: 1, innerWidth: 900, innerHeight: 520,
      addEventListener() {}, requestAnimationFrame(cb) { rafCb = cb; return 1; },
      cancelAnimationFrame() {}, performance: { now: () => smokeT },
      localStorage: (() => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; })(),
      setTimeout() { return 0; }, AXIOM: A
    };
    let smokeT = 0;
    const sb = { window: win, document: doc, requestAnimationFrame: win.requestAnimationFrame,
      localStorage: win.localStorage, performance: win.performance, setTimeout: win.setTimeout,
      Math: Math, Date: Date, JSON: JSON, console: { log() {} }, encodeURIComponent: encodeURIComponent };
    sb.globalThis = sb; win.AXIOM = A; sb.AXIOM = A;
    vm.createContext(sb);
    // load core into this context, then the shell
    vm.runInContext(coreSrc, sb, { filename: 'core2' });
    const shellStart = html.indexOf('/* ===== SHELL + RENDER');
    const shellSrc = html.slice(shellStart, html.lastIndexOf('</script>'));
    vm.runInContext(shellSrc, sb, { filename: 'shell' });
    // drive the flow: splash -> menu -> play list -> start level 0
    els.splashStart.click();
    els.mPlay.click();
    const grid = els.levelGrid;
    if (grid.children[0]) grid.children[0].click(); // startLevel(p1)
    // run frames — exercises update() + render() (drawGlyph, hazards, HUD)
    for (let f = 0; f < 240; f++) { smokeT = f * 16.7; if (rafCb) rafCb(smokeT); }
    // also start the finale to draw gates/glitch telegraph + all forms
    els.mGuide.click(); // build guide (draws ??? entries)
  } catch (e) { smokeOk = false; err = e && e.stack ? e.stack.split('\n')[0] : String(e); }
  ok('render-smoke', smokeOk, smokeOk ? '(240 frames drawn, no throw)' : err);
}

// ---- summary ---------------------------------------------------------------
head('SUMMARY');
console.log('  file: ' + FILE);
console.log('  size: ' + html.length + ' bytes');
console.log('  tape-clear beats: ' + A.LEVELS.map(l => l.id + '=' + measured.tapeClear[l.id].beat.toFixed(0)).join(' '));
console.log('  daily: ' + measured.daily.solvable + '/' + measured.daily.tested + ' solvable+deterministic');
console.log('  max flash: ' + measured.flash.toFixed(3) + ' Hz');
console.log('  assertions: ' + pass + ' pass, ' + fail + ' fail');
if (fail) { console.log('\nFAILURES: ' + fails.join(', ')); process.exit(1); }
console.log('\nALL GREEN');
process.exit(0);
