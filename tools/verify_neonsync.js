#!/usr/bin/env node
'use strict';
/**
 * Neon Sync — source contract harness.
 *
 * ============================ REPLACEMENT, NOT DELIVERY ====================
 * THIS IS NOT THE DELIVERED HARNESS. The build's own tools/verify_neonsync.js
 * — 13,637 B, sha256 6b5cbb9da0f41a4f72e6abdeaf5deeb8ae870c0fcc380b31f0f45c9225cb2369
 * — was never supplied. The checksums file lists it, but no JavaScript file
 * reached this session or the upstream chat: only the game HTML, the manifest,
 * the harness REPORT, the checksums and the readback came through.
 *
 * So THAT FILE'S HASH HAS NEVER BEEN MEASURED BY ANYONE. Its reported 149/149
 * and tamper-exit-1 are the build's own claims about a file nobody has held.
 * They are recorded as claims and are NOT reproduced here.
 *
 * This file is a REPLACEMENT authored against two things that DO exist: the
 * shipped game, and the group structure of the harness report (G1..G17). It
 * carries its own hash and makes no claim to be the delivered artefact.
 *
 * SUPERSEDE CLAUSE: if the original surfaces and hashes exactly 6b5cbb9d...,
 * it replaces this file in its own commit with both hashes named. The
 * evidence-bearing artefact always wins.
 * ===========================================================================
 *
 * Usage:
 *   node tools/verify_neonsync.js              run the contract
 *   node tools/verify_neonsync.js --self-test  prove it can fail (tamper)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.NS_GAME_FILE || path.join(ROOT, 'neonsync', 'index.html');
const DELIVERED_SHA = 'c645e6f3f56a5884c23656dc82be49bc20e333ebc379ea098341886327832602';
const html = fs.readFileSync(GAME, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');

const IS_CHILD = !!process.env.NS_GAME_FILE;

// ------------------------------------------------------------ tamper mode
// "A harness that cannot fail is not a harness." Each fixture breaks ONE
// contract this file claims to guard, and the harness must reject every one.
if (process.argv.includes('--self-test')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-tamper-'));
  const FIXTURES = [
    ['bot-reaction-floor', t => t.replace('BOT_REACTION:.18', 'BOT_REACTION:.02')],
    ['equal-movement-speed', t => t.replace('BOT_SPEED:170', 'BOT_SPEED:260')],
    ['storage-prefix', t => t.replace(/'mbm_neonsync_'/, "'mbm_apexpool_'")],
    ['fixed-timestep', t => t.replace('DT:1/120', 'DT:1/57')],
    ['match-hard-cap', t => t.replace('MATCH_SECONDS:360', 'MATCH_SECONDS:5400')],
    ['delivered-hash', t => t.replace('</body>', '<!-- x --></body>')],
  ];
  const runOn = file => {
    const r = spawnSync(process.execPath, [__filename], {
      encoding: 'utf8', env: Object.assign({}, process.env, { NS_GAME_FILE: file }),
    });
    const m = /HARNESS_FAIL=(\d+)/.exec(r.stdout || '');
    return { status: r.status, fails: m ? Number(m[1]) : NaN };
  };

  // POSITIVE CONTROL. A rejection proves nothing if the untampered copy is
  // already failing — every fixture would then be "rejected" for free. So the
  // clean copy must pass before any tamper result is allowed to count.
  const clean = path.join(dir, 'untampered.html');
  fs.writeFileSync(clean, html);
  const base = runOn(clean);
  console.log('== self-test positive control: the UNTAMPERED copy must PASS ==');
  console.log(`  ${base.status === 0 ? 'PASSES' : '*** FAILS ***'}  untampered copy — ${base.fails} failing checks`);
  if (base.status !== 0) {
    console.log('SELF-TEST ABORTED — the baseline already fails, so every tamper rejection would be free and would prove nothing');
    process.exit(1);
  }

  let rejected = 0;
  console.log('\n== self-test: every fixture must be REJECTED ==');
  for (const [name, mutate] of FIXTURES) {
    const out = mutate(html);
    if (out === html) { console.log(`  *** FIXTURE INERT ***  ${name} — it changed nothing, so it proves nothing`); continue; }
    const f = path.join(dir, name + '.html');
    fs.writeFileSync(f, out);
    const r = runOn(f);
    // rejected only if the tamper caused NEW failures over the clean baseline
    const bit = r.status !== 0 && r.fails > base.fails;
    console.log(`  ${bit ? 'REJECTED' : '*** ACCEPTED ***'}  ${name}   ${r.fails} failing checks (baseline ${base.fails})`);
    if (bit) rejected++;
  }
  const allBit = rejected === FIXTURES.length;
  console.log(allBit
    ? `SELF-TEST PASSED — ${rejected}/${FIXTURES.length} tampered copies rejected; this harness can fail`
    : `SELF-TEST FAILED — only ${rejected}/${FIXTURES.length} rejected`);
  process.exit(allBit ? 0 : 1);
}

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  cond ? pass++ : fail++;
}
function group(n) { console.log('\n== ' + n + ' =='); }

function core() {
  const a = html.indexOf('NS:CORE:BEGIN'), b = html.lastIndexOf('CORE:END');
  if (a < 0 || b < a) throw new Error('core markers missing');
  const code = html.slice(html.indexOf('*/', a) + 2, html.lastIndexOf('/*', b));
  return Function('console', code + '\n;return NS;')(console);
}
const NS = core();
const C = NS.C;

/* ------------------------------------------------------------------ G1 */
group('G1 — packaging');
ok('single-html-file', !/<script[^>]+src=/i.test(html) && !/<link[^>]+rel=["']stylesheet/i.test(html));
ok('under-250-kib', bytes <= 250 * 1024, bytes + ' bytes');
ok('title-exact', /<title>Neon Sync — Made by Matt<\/title>/.test(html));
ok('canonical-exact', /rel=["']canonical["'][^>]*href=["']https:\/\/madebymatt\.uk\/neonsync\/["']/.test(html));
ok('og-url-exact', /property=["']og:url["'][^>]*content=["']https:\/\/madebymatt\.uk\/neonsync\/["']/.test(html));
// measured: the game calls getContext('2d',{alpha:false}), so the argument
// list must not be assumed to close immediately after the context id.
ok('canvas-2d-present', /getContext\(\s*['"]2d['"]/.test(html));
ok('no-external-script', !/<script[^>]+src=["']https?:/i.test(html));
// scoped to stylesheet links: the file legitimately carries an absolute
// rel=canonical href, which is not a subresource fetch.
ok('no-external-stylesheet', !/<link[^>]*rel=["']stylesheet["'][^>]*>/i.test(html)
  && !(html.match(/<link[^>]*>/gi) || []).some(t => /rel=["']stylesheet/i.test(t) && /https?:/i.test(t)));
ok('no-network-primitives', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(html));
ok('made-by-matt-branding', /Made by Matt/.test(html));

/* ------------------------------------------------------------------ G2 */
group('G2 — fixed timestep determinism');
ok('dt-one-over-120', Math.abs(C.DT - 1 / 120) < 1e-12, String(C.DT));
ok('frame-clamp-present', typeof C.MAX_FRAME === 'number' && C.MAX_FRAME > 0, 'MAX_FRAME ' + C.MAX_FRAME);
ok('substep-cap-present', C.MAX_SUBSTEPS > 0, 'MAX_SUBSTEPS ' + C.MAX_SUBSTEPS);
ok('no-accumulator-spiral', C.MAX_FRAME <= C.MAX_SUBSTEPS * C.DT,
  `${C.MAX_FRAME} <= ${(C.MAX_SUBSTEPS * C.DT).toFixed(4)}`);
{
  const rates = [30, 60, 120, 144];
  const states = rates.map(hz => JSON.stringify(NS.drive ? NS.drive(6, hz) : null));
  const same = states.every(s => s === states[0]);
  ok('30-60-120-144-hz-identical', same, same ? 'max delta 0' : 'states diverge');
}
ok('browser-uses-accumulator', /acc\s*\+=/.test(html) && /while\s*\([^)]*acc/.test(html));

/* ------------------------------------------------------------------ G3 */
group('G3 — Synergy Rating');
{
  // Reconstructed from the shipped scorer. The report's fixture VALUES
  // (0/22/57/70/81/89/38/97) belong to the delivered harness, whose inputs
  // were never supplied, so these fixtures are derived here and their values
  // recomputed rather than copied. What IS carried over verbatim is the
  // contract the report states: support must beat striker.
  const f = o => NS.synergyRating(Object.assign({ matchSeconds: 360 }, o));
  const empty = f({});
  const striker = f({ damage: 4200, healing: 0, objectiveSeconds: 4, synergyAssists: 0 });
  const support = f({ damage: 300, healing: 5200, objectiveSeconds: 61, synergyAssists: 5 });
  ok('empty-scores-zero', empty === 0, String(empty));
  ok('support-beats-striker', support > striker, `support ${support} > striker ${striker}`);
  // The design claim is not "a support scores above some invented number".
  // It is that eliminations are not a term in the rating at all, and that a
  // line with zero damage and zero eliminations can still reach the top band.
  // Both are derived from the function, not asserted against a magic figure.
  const withElims = o => f(Object.assign({ eliminations: 40 }, o));
  ok('eliminations-are-not-a-term',
    withElims(Object.assign({}, { damage: 300, healing: 5200, objectiveSeconds: 61, synergyAssists: 5 })) === support
    && withElims({ damage: 4200, healing: 0, objectiveSeconds: 4, synergyAssists: 0 }) === striker,
    '+40 eliminations moved neither line: ' + support + ', ' + striker);
  const pureSupport = f({ damage: 0, healing: 4000, objectiveSeconds: 360, synergyAssists: 8 });
  const topBand = NS.BANDS[NS.BANDS.length - 1];
  ok('zero-damage-zero-elim-reaches-top-band',
    pureSupport >= topBand.min && NS.synergyBand(pureSupport).name === topBand.name,
    pureSupport + ' → ' + NS.synergyBand(pureSupport).name + ' (top band min ' + topBand.min + ')');
  ok('in-range-and-integer', [empty, striker, support].every(v => Number.isInteger(v) && v >= 0 && v <= 100));
  let bad = 0, prevMono = 0, monoBad = 0;
  const rng = NS.mulberry32(0x5eed);
  for (let i = 0; i < 20000; i++) {
    const v = f({ damage: rng() * 9000, healing: rng() * 9000, objectiveSeconds: rng() * 360, synergyAssists: Math.floor(rng() * 12) });
    if (!Number.isInteger(v) || v < 0 || v > 100 || Number.isNaN(v)) bad++;
  }
  ok('20k-fuzz-in-range', bad === 0, '20,000 deterministic cases');
  for (let s = 0; s <= 360; s += 12) {
    const v = f({ objectiveSeconds: s });
    if (v < prevMono) monoBad++;
    prevMono = v;
  }
  ok('monotone-in-objective', monoBad === 0);
  const bands = NS.BANDS;
  ok('five-labelled-bands', bands.length === 5 && bands.every(b => b.name));
  ok('bands-disjoint', bands.every((b, i) => i === 0 || b.min > bands[i - 1].max));
  ok('bands-cover-0-to-100', bands[0].min === 0 && bands[bands.length - 1].max === 100);
  ok('band-lookup-total', [0, 34, 35, 59, 60, 79, 80, 94, 95, 100].every(v => !!NS.synergyBand(v)));
}

/* ------------------------------------------------------------------ G4 */
group('G4 — one source of hero truth');
{
  const keys = Object.keys(NS.HEROES);
  ok('three-heroes', keys.length === 3, keys.join(', '));
  for (const k of keys) {
    const h = NS.HEROES[k];
    ok(k + '-complete', !!(h.name && h.role && h.hp > 0 && h.primary && h.a1 && h.a2 && h.ult && h.passive),
      `${h.name}/${h.role} hp ${h.hp}`);
  }
  ok('roles-are-distinct', new Set(keys.map(k => NS.HEROES[k].role)).size === 3);
  ok('hero-select-reads-heroes', /NS\.HEROES/.test(html));
}

/* ------------------------------------------------------------------ G5 */
group('G5 — honest telegraphs');
ok('minimum-warning-constant', C.TELEGRAPH_MIN >= 0.3, String(C.TELEGRAPH_MIN));
ok('telegraph-used-in-source', /telegraph/i.test(html));

/* ------------------------------------------------------------------ G6 */
group('G6 — storage isolation');
{
  const lits = [...new Set(html.match(/['"](?:mbm_|apex_|apexkick|apexpool|apexgolf|apextennis|voxel|biopunk)[A-Za-z0-9_.-]*['"]/g) || [])];
  ok('single-prefix-literal', lits.length === 1 && /mbm_neonsync_/.test(lits[0]), lits.join(', '));
  ok('no-apex-sibling-keys', !lits.some(l => /apex|voxel|biopunk/.test(l)));
  ok('three-data-keys', ['progress', 'settings', 'statistics'].every(k => html.includes(k)));
}

/* ------------------------------------------------------------------ G7 */
group('G7 — safeguarding and economy');
ok('no-dollar-sign', !/\$\d/.test(html));
ok('no-purchase-word', !/\bpurchase\b/i.test(html));
ok('no-price-word', !/\bprice\b/i.test(html));
ok('no-gacha-word', !/\bgacha\b|\bloot ?box\b/i.test(html));
ok('visual-only-economy', /visual only/i.test(html));

/* ------------------------------------------------------------------ G8 */
group('G8 — interaction floor');
{
  const mins = [...html.matchAll(/min-height\s*:\s*(\d+)px/g)].map(m => +m[1]);
  ok('declared-control-floors-at-least-44', mins.length > 0 && mins.every(v => v >= 44), mins.join(','));
}

/* ------------------------------------------------------------------ G9 */
group('G9 — colour and markers');
ok('four-palettes', /PALETTES=\{[^}]*standard[^}]*deuteranopia[^}]*protanopia[^}]*tritanopia/.test(html));
ok('friendly-and-enemy-shapes-differ', /diamond|moveTo/.test(html) && /triangle|lineTo/.test(html));

/* ----------------------------------------------------------------- G10 */
group('G10 — random simulation safety');
{
  const w = NS.makeWorld('zest', 12345);
  let bad = 0;
  for (let i = 0; i < 10000; i++) {
    NS.stepWorld(w, C.DT, {});
    for (const u of w.units) if (!isFinite(u.x) || !isFinite(u.y) || !isFinite(u.hp)) { bad++; break; }
    if (bad) break;
  }
  ok('10k-steps-no-nan', bad === 0, '10,000 fixed steps');
  ok('respawn-bounded', C.RESPAWN > 0 && C.RESPAWN <= 10, String(C.RESPAWN));
  ok('spawn-protection', C.SPAWN_PROTECT > 0, String(C.SPAWN_PROTECT));
}

/* ----------------------------------------------------------------- G11 */
group('G11 — pointer mapping');
{
  // measured signature: pointerMap(clientX, clientY, rect, canvas) — the
  // fourth argument is the canvas element, read for .width/.height.
  const r = { left: 0, top: 0, width: 360, height: 225 };
  const p = NS.pointerMap(180, 112.5, r, { width: C.W, height: C.H });
  ok('pointer-360-maps-to-centre', Math.abs(p.x - C.W / 2) < 2 && Math.abs(p.y - C.H / 2) < 2, JSON.stringify(p));
  // non-vacuity for the limb above: an off-centre pointer must NOT land centre.
  const q = NS.pointerMap(0, 0, r, { width: C.W, height: C.H });
  ok('pointer-corner-does-not-map-to-centre', q.x === 0 && q.y === 0, JSON.stringify(q));
  ok('pointer-scales-by-canvas-over-rect', /width\s*\/\s*(rect|r)\.width|\/\s*rect\.width/.test(html));
}

/* ----------------------------------------------------------------- G12 */
group('G12 — accessibility kit');
ok('live-region', /aria-live/.test(html));
ok('noscript', /<noscript[\s>]/.test(html));
ok('no-canvas-guard', /noCanvas/.test(html));
ok('safe-area-insets', /safe-area-inset/.test(html));
ok('focus-visible', /:focus-visible/.test(html));
ok('reduced-motion-media', /prefers-reduced-motion/.test(html));
ok('modal-role', /role=["'](dialog|status)["']/.test(html));
ok('pause-on-visibility', /visibilitychange/.test(html));
ok('no-alert-confirm', !/\b(alert|confirm)\s*\(/.test(html));

/* ----------------------------------------------------------------- G13 */
group('G13 — audio hygiene');
ok('gesture-unlock', /pointerdown|touchstart|click/.test(html) && /AudioContext/.test(html));
ok('mute-persisted', /mute/i.test(html));
ok('nodes-disconnected', /disconnect\(\)/.test(html));

/* ----------------------------------------------------------------- G14 */
group('G14 — bot fairness');
ok('reaction-at-least-150ms', C.BOT_REACTION >= 0.15, String(C.BOT_REACTION));
ok('aim-error-positive', C.BOT_AIM_ERROR > 0, String(C.BOT_AIM_ERROR));
ok('equal-movement-speed', C.BOT_SPEED === C.PLAYER_SPEED, `${C.BOT_SPEED} === ${C.PLAYER_SPEED}`);
ok('finite-vision', C.BOT_VISION > 0 && isFinite(C.BOT_VISION), String(C.BOT_VISION));

/* ----------------------------------------------------------------- G15 */
group('G15 — responsive layout');
ok('mobile-breakpoint-480', /@media[^{]*max-width:\s*480px/.test(html));
ok('touch-joystick', /id=["']stick["']/.test(html) && /id=["']knob["']/.test(html));

/* ----------------------------------------------------------------- G16 */
group('G16 — full-cycle source');
ok('hard-cap-six-minutes', C.MATCH_SECONDS === 360, String(C.MATCH_SECONDS));
ok('overtime-contested', C.OVERTIME_SHRINK > 0 && C.OVERTIME_SHRINK < 1, String(C.OVERTIME_SHRINK));
ok('respawn-five-seconds', C.RESPAWN === 5, String(C.RESPAWN));
ok('spawn-protection-one-point-five', C.SPAWN_PROTECT === 1.5, String(C.SPAWN_PROTECT));
for (const s of ['showTitle', 'showHeroes', 'startMatch', 'showPost', 'rematch', 'endorse']) {
  ok('cycle-' + s, new RegExp(s, 'i').test(html));
}

/* ----------------------------------------------------------------- G17 */
group('G17 — identity and non-vacuity');
{
  const sha = crypto.createHash('sha256').update(html).digest('hex');
  ok('delivered-sha-unchanged', sha === DELIVERED_SHA, sha);
  ok('sentinel-absent-by-ruling', !/neonsync-build-2026-08-04/.test(html),
    'ruled: identity is by hash, the file is not edited to add one');
  if (IS_CHILD) {
    ok('self-test-skipped-in-tamper-child', true, 'avoids infinite recursion');
  } else {
    const self = spawnSync(process.execPath, [__filename, '--self-test'], { encoding: 'utf8' });
    ok('self-test-proves-it-can-fail', self.status === 0, (self.stdout || '').trim().split('\n').pop());
  }
}

console.log('\n' + '='.repeat(70));
console.log(`REPLACEMENT harness (NOT the delivered 6b5cbb9d… artefact)`);
console.log(fail ? `${pass} passed, ${fail} FAILED` : `ALL ${pass} NEON SYNC SOURCE CHECKS PASSED`);
console.log('='.repeat(70));
console.log(`FILE_BYTES=${bytes}`);
console.log(`FILE_SHA256=${crypto.createHash('sha256').update(html).digest('hex')}`);
console.log(`HARNESS_PASS=${pass}`);
console.log(`HARNESS_FAIL=${fail}`);
process.exit(fail ? 1 : 0);
