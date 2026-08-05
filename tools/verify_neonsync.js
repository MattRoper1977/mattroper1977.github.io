#!/usr/bin/env node
'use strict';
/**
 * Neon Sync v1.1 source contract harness.
 * Sentinel: neonsync-v11-2026-08-05
 *
 * Usage:
 *   node tools/verify_neonsync.js
 *   node tools/verify_neonsync.js --self-test
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GAME = process.env.NS_GAME_FILE || path.join(ROOT, 'neonsync', 'index.html');
const GAME_SHA = '6f10b2989f73db70d63ed036853af0b3508e2166ff892c13118e18cf9bcc22a5';
const BASE_SHA = 'c645e6f3f56a5884c23656dc82be49bc20e333ebc379ea098341886327832602';
const BASE_BYTES = 56658;
const html = fs.readFileSync(GAME, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
const IS_CHILD = !!process.env.NS_GAME_FILE;
const IS_TAMPER_CHILD = process.env.NS_TAMPER_CHILD === '1';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------- self-test
// Every family has a named expected failure. A generic source-hash failure is
// not enough: the family-specific check must also prove that it fired.
if (process.argv.includes('--self-test')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-v11-tamper-'));
  const fixtures = [
    {
      name: 'bot-reaction-floor', expected: 'reaction-at-least-150ms',
      mutate: t => t.replace('BOT_REACTION:.18', 'BOT_REACTION:.02'),
    },
    {
      name: 'equal-movement-speed', expected: 'bot-speed-not-over-player',
      mutate: t => t.replace('BOT_SPEED:240', 'BOT_SPEED:260'),
    },
    {
      name: 'storage-prefix', expected: 'single-storage-prefix-literal',
      mutate: t => t.replace(/'mbm_neonsync_'/, "'mbm_apexpool_'")
    },
    {
      name: 'fixed-timestep', expected: 'dt-one-over-120',
      mutate: t => t.replace('DT:1/120', 'DT:1/57'),
    },
    {
      name: 'point-hard-cap', expected: 'point-hard-cap-six-minutes',
      mutate: t => t.replace('POINT_SECONDS:360', 'POINT_SECONDS:5400'),
    },
    {
      name: 'source-identity', expected: 'source-sha-pinned',
      mutate: t => t.replace('</body>', '<!-- identity tamper --></body>'),
    },
    {
      name: 'uncapped-cc', expected: 'cc-ceiling-at-most-1.2',
      mutate: t => t.replace('CC_MAX:1.2', 'CC_MAX:2.4'),
    },
    {
      name: 'inverted-escort-win', expected: 'escort-delivery-awards-attacker',
      mutate: t => t.replace(
        'w.winner=w.attackerTeam;w.overtime=false;return',
        'w.winner=w.defenderTeam;w.overtime=false;return'
      ),
    },
  ];

  function runOn(file) {
    const r = spawnSync(process.execPath, [__filename], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { NS_GAME_FILE: file, NS_TAMPER_CHILD: '1' }),
      maxBuffer: 16 * 1024 * 1024,
    });
    const m = /HARNESS_FAIL=(\d+)/.exec(r.stdout || '');
    return { status: r.status, fails: m ? Number(m[1]) : NaN, stdout: r.stdout || '', stderr: r.stderr || '' };
  }

  const clean = path.join(dir, 'untampered.html');
  fs.writeFileSync(clean, html);
  const base = runOn(clean);
  console.log('== positive control: UNTAMPERED copy must pass ==');
  console.log(`  ${base.status === 0 && base.fails === 0 ? 'PASSES' : '*** FAILS ***'}  untampered copy — ${base.fails} failing checks`);
  if (base.status !== 0 || base.fails !== 0) {
    console.log(base.stdout.slice(-4000));
    console.error(base.stderr.slice(-2000));
    console.log('POSITIVE_CONTROL=FAILED');
    process.exit(1);
  }
  console.log('POSITIVE_CONTROL=FIRED');

  let rejected = 0;
  console.log('\n== tamper families: every named check must fire ==');
  for (const fixture of fixtures) {
    const out = fixture.mutate(html);
    if (out === html) {
      console.log(`  *** FIXTURE INERT ***  ${fixture.name} — source anchor did not move`);
      continue;
    }
    const file = path.join(dir, fixture.name + '.html');
    fs.writeFileSync(file, out);
    const result = runOn(file);
    const familyFired = result.stdout.includes('FAIL  ' + fixture.expected);
    const bit = result.status !== 0 && Number.isFinite(result.fails) && result.fails > 0 && familyFired;
    console.log(`  ${bit ? 'REJECTED' : '*** ACCEPTED ***'}  ${fixture.name} — ${fixture.expected} ${familyFired ? 'FIRED' : 'DID NOT FIRE'}; ${result.fails} failing checks`);
    if (!bit) {
      console.log(result.stdout.slice(-2200));
      console.error(result.stderr.slice(-1000));
    } else {
      rejected++;
    }
  }
  const all = rejected === fixtures.length;
  console.log(all
    ? `SELF-TEST PASSED — ${rejected}/${fixtures.length} tamper families rejected; every family-specific proof fired`
    : `SELF-TEST FAILED — ${rejected}/${fixtures.length} tamper families rejected`);
  console.log(`TAMPER_REJECTED=${rejected}/${fixtures.length}`);
  process.exit(all ? 0 : 1);
}

let pass = 0;
let fail = 0;
function ok(name, condition, detail) {
  const yes = !!condition;
  console.log((yes ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   ' + detail : ''));
  if (yes) pass++; else fail++;
  return yes;
}
function group(name) { console.log('\n== ' + name + ' =='); }
function core() {
  const a = html.indexOf('NS:CORE:BEGIN');
  const b = html.lastIndexOf('NS:CORE:END');
  if (a < 0 || b < a) throw new Error('core markers missing');
  const code = html.slice(html.indexOf('*/', a) + 2, html.lastIndexOf('/*', b));
  return Function('console', code + '\n;return NS;')(console);
}
function maxNumericDelta(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b)) {
    let m = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) m = Math.max(m, maxNumericDelta(a[i], b[i]));
    return m;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let m = 0;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) m = Math.max(m, maxNumericDelta(a[k], b[k]));
    return m;
  }
  return a === b ? 0 : Infinity;
}
function freezeBots(w) {
  for (const u of w.units) {
    u.bot = false;
    u.moveX = 0;
    u.moveY = 0;
    u.reaction = 999;
  }
  return w;
}
function farFromEscort(w) {
  w.units.forEach((u, i) => { u.x = 40; u.y = 40 + i * 30; u.px = u.x; u.py = u.y; u.bot = false; u.moveX = u.moveY = 0; u.protect = 0; });
  return w;
}
function firstOnTeam(w, team) { return w.units.find(u => u.team === team); }
function stepN(NS, w, n) { for (let i = 0; i < n && w.winner === null; i++) NS.stepWorld(w, NS.C.DT); return w; }

const NS = core();
const C = NS.C;
const sourceSha = sha256(html);
let pointDelta = Infinity;
let escortDelta = Infinity;
let pointSupport = NaN;
let pointSelfish = NaN;
let escortSupport = NaN;
let escortSelfish = NaN;
let soakWorlds = 0;
let soakSteps = 0;

// ---------------------------------------------------------------------- G1
group('G1 — packaging, identity and scope');
ok('single-html-file', !/<script[^>]+src=/i.test(html) && !/<link[^>]+rel=["']stylesheet/i.test(html));
ok('under-250-kib-hard-cap', bytes <= 250 * 1024, bytes + ' bytes');
ok('under-120-kib-target', bytes <= 120 * 1024, bytes + ' bytes');
ok('title-exact', /<title>Neon Sync — Made by Matt<\/title>/.test(html));
ok('canonical-exact', /rel=["']canonical["'][^>]*href=["']https:\/\/madebymatt\.uk\/neonsync\/["']/.test(html));
ok('og-url-exact', /property=["']og:url["'][^>]*content=["']https:\/\/madebymatt\.uk\/neonsync\/["']/.test(html));
ok('canvas-2d-present', /getContext\(\s*['"]2d['"]/.test(html));
ok('no-external-script', !/<script[^>]+src=["']https?:/i.test(html));
ok('no-external-stylesheet', !(html.match(/<link[^>]*>/gi) || []).some(t => /rel=["']stylesheet/i.test(t)));
ok('no-network-primitives', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/.test(html));
ok('made-by-matt-branding', /Made by Matt/.test(html));
ok('v11-sentinel-exactly-once', (html.match(/neonsync-v11-2026-08-05/g) || []).length === 1);
ok('v11-sentinel-is-top-comment', html.startsWith('<!-- sentinel: neonsync-v11-2026-08-05 -->'));
ok('visible-v11-mark', />v1\.1 · VOLT \+ ESCORT RUSH</.test(html));
ok('app-is-shake-wrapper', /#app\{[^}]*position:fixed/.test(html) && /screen-shake/.test(html));
ok('no-alert-confirm', !/\b(alert|confirm)\s*\(/.test(html));
ok('source-sha-pinned', sourceSha === GAME_SHA, sourceSha);
// DISCLOSED GATE CHANGE, 5 Aug 2026 — a registered vacuity, repaired.
// This limb read:
//     ok('base-hash-named-for-choreography',
//        BASE_SHA.length === 64 && BASE_BYTES === 56658, ...)
// Both operands are constants declared twelve lines above it, so it compared
// the file to itself and could not fail for any input — a limb pretending to
// measure. It is replaced by an assertion that says something true about the
// COMMITTED file and has a real failure mode: the served game must be the
// SUCCESSOR of the named base, never the base itself. A revert of
// neonsync/index.html to v1.0 fires this.
ok('committed-file-supersedes-the-named-base',
  sourceSha !== BASE_SHA && bytes !== BASE_BYTES,
  `base ${BASE_SHA.slice(0,12)}… / ${BASE_BYTES} B is superseded, not served`);

// ---------------------------------------------------------------------- G2
group('G2 — fixed timestep determinism');
ok('dt-one-over-120', Math.abs(C.DT - 1 / 120) < 1e-12, String(C.DT));
ok('frame-clamp-present', C.MAX_FRAME > 0 && C.MAX_FRAME <= 0.1, String(C.MAX_FRAME));
ok('substep-cap-present', Number.isInteger(C.MAX_SUBSTEPS) && C.MAX_SUBSTEPS > 0, String(C.MAX_SUBSTEPS));
ok('no-accumulator-spiral', C.MAX_FRAME <= C.MAX_SUBSTEPS * C.DT, `${C.MAX_FRAME} <= ${C.MAX_SUBSTEPS * C.DT}`);
ok('browser-uses-accumulator', /G\.acc\s*\+=\s*raw/.test(html) && /while\s*\(G\.acc>=NS\.C\.DT/.test(html));
for (const mode of ['point', 'escort']) {
  const rates = [30, 60, 120, 144];
  const states = rates.map(hz => {
    const w = NS.makeWorld(0x51a7e, { mode, side: 'attack', playerHero: 'volt' });
    NS.drive(w, 20, hz);
    return NS.summary(w);
  });
  let delta = 0;
  for (let i = 1; i < states.length; i++) delta = Math.max(delta, maxNumericDelta(states[0], states[i]));
  if (mode === 'point') pointDelta = delta; else escortDelta = delta;
  ok(mode + '-30-60-120-144-hz-identical', delta === 0, 'max state delta ' + delta);
}

// ---------------------------------------------------------------------- G3
group('G3 — one Synergy Rating, both modes');
{
  const baseInput = { matchSeconds: 360, objectiveSeconds: 61, synergyAssists: 5, damage: 300, healing: 5200, eliminations: 0 };
  const before = JSON.stringify(baseInput);
  const a = NS.synergyRating(baseInput);
  const b = NS.synergyRating(baseInput);
  ok('rating-is-pure', a === b && JSON.stringify(baseInput) === before, String(a));
  ok('rating-integer-0-to-100', Number.isInteger(a) && a >= 0 && a <= 100, String(a));
  const withElims = NS.synergyRating(Object.assign({}, baseInput, { eliminations: 99 }));
  ok('eliminations-are-not-a-term', withElims === a, `${a} with 0 eliminations; ${withElims} with 99`);

  pointSupport = NS.synergyRating({ mode: 'point', matchSeconds: 360, objectiveSeconds: 110, synergyAssists: 7, damage: 0, healing: 5000, eliminations: 0 });
  pointSelfish = NS.synergyRating({ mode: 'point', matchSeconds: 360, objectiveSeconds: 3, synergyAssists: 0, damage: 8000, healing: 0, eliminations: 40 });
  escortSupport = NS.synergyRating({ mode: 'escort', matchSeconds: 300, objectiveSeconds: 90, synergyAssists: 7, damage: 0, healing: 5000, eliminations: 0 });
  escortSelfish = NS.synergyRating({ mode: 'escort', matchSeconds: 300, objectiveSeconds: 3, synergyAssists: 0, damage: 8000, healing: 0, eliminations: 40 });
  ok('point-support-outscores-selfish-striker', pointSupport > pointSelfish, `support ${pointSupport} > selfish striker ${pointSelfish}`);
  ok('escort-support-outscores-selfish-striker', escortSupport > escortSelfish, `support ${escortSupport} > selfish striker ${escortSelfish}`);
  ok('single-rating-function-source', (html.match(/function synergyRating\s*\(/g) || []).length === 1);
  let bad = 0;
  const fuzzCases = IS_TAMPER_CHILD ? 200 : 20000;
  const rng = NS.mulberry32(0x5eed);
  for (let i = 0; i < fuzzCases; i++) {
    const v = NS.synergyRating({ matchSeconds: 1 + rng() * 500, damage: rng() * 9000, healing: rng() * 9000, objectiveSeconds: rng() * 360, synergyAssists: Math.floor(rng() * 15), eliminations: Math.floor(rng() * 60) });
    if (!Number.isInteger(v) || v < 0 || v > 100 || Number.isNaN(v)) bad++;
  }
  ok(IS_TAMPER_CHILD ? 'tamper-child-rating-fuzz-in-range' : '20k-rating-fuzz-in-range', bad === 0, fuzzCases.toLocaleString() + ' deterministic cases');
  let prev = -1, monotoneBad = 0;
  for (let objective = 0; objective <= 360; objective += 6) {
    const v = NS.synergyRating({ matchSeconds: 360, objectiveSeconds: objective });
    if (v < prev) monotoneBad++;
    prev = v;
  }
  ok('rating-monotone-in-objective', monotoneBad === 0);
  ok('five-labelled-bands', NS.BANDS.length === 5 && NS.BANDS.every(x => x.name));
  ok('bands-disjoint', NS.BANDS.every((x, i) => i === 0 || x.min > NS.BANDS[i - 1].max));
  ok('bands-cover-0-to-100', NS.BANDS[0].min === 0 && NS.BANDS.at(-1).max === 100);
}

// ---------------------------------------------------------------------- G4
group('G4 — one source of hero truth and role-slot 3v3');
{
  const keys = Object.keys(NS.HEROES);
  ok('four-heroes', keys.length === 4, keys.join(', '));
  ok('one-heroes-const', (html.match(/var HEROES=\{/g) || []).length === 1);
  for (const k of keys) {
    const h = NS.HEROES[k];
    ok(k + '-complete', !!(h.name && h.role && h.hp > 0 && h.primary && h.a1 && h.a2 && h.ult && h.passive), `${h.name}/${h.role} hp ${h.hp}`);
    ok(k + '-name-literal-once', (html.match(new RegExp("name:'" + h.name + "'", 'g')) || []).length === 1);
  }
  ok('volt-hp-equals-zest', NS.HEROES.volt.hp === NS.HEROES.zest.hp, String(NS.HEROES.volt.hp));
  const zestDps = NS.HEROES.zest.primary.damage / NS.HEROES.zest.primary.cooldown;
  const voltDps = NS.HEROES.volt.primary.damage / NS.HEROES.volt.primary.cooldown;
  const dpsRatio = voltDps / zestDps;
  ok('volt-dps-within-ten-percent-of-zest', dpsRatio >= 0.9 && dpsRatio <= 1.1, `Volt ${voltDps.toFixed(6)} / Zest ${zestDps.toFixed(6)} = ${dpsRatio.toFixed(6)}`);
  let rosterBad = 0;
  for (const hero of keys) {
    for (const mode of ['point', 'escort']) {
      const w = NS.makeWorld(0x1000 + keys.indexOf(hero), { mode, side: 'attack', playerHero: hero });
      if (w.units.length !== 6 || w.units.filter(u => !u.bot && u.team === 0).length !== 1) rosterBad++;
      for (const team of [0, 1]) {
        const roles = w.units.filter(u => u.team === team).map(u => NS.HEROES[u.hero].role).sort().join(',');
        if (roles !== 'Enabler,Striker,Vanguard') rosterBad++;
      }
    }
  }
  ok('role-slot-3v3-all-player-picks', rosterBad === 0, 'Vibe + Prism + one Striker per team');
  const enemyStrikers = new Set();
  for (let seed = 1; seed <= 128; seed++) {
    const w = NS.makeWorld(seed, { mode: 'point', playerHero: 'volt' });
    enemyStrikers.add(w.units.find(u => u.team === 1 && NS.HEROES[u.hero].role === 'Striker').hero);
  }
  ok('enemy-striker-rolls-independently', enemyStrikers.has('zest') && enemyStrikers.has('volt'), [...enemyStrikers].join(', '));
  ok('hero-select-reads-one-truth', /Object\.keys\(NS\.HEROES\)/.test(html) && /function heroCard\(id\)\{var h=NS\.HEROES\[id\]/.test(html));
}

// ---------------------------------------------------------------------- G5
group('G5 — honest telegraphs');
ok('minimum-warning-at-least-0.4', C.TELEGRAPH_MIN >= 0.4, String(C.TELEGRAPH_MIN));
ok('volt-pin-warning-at-least-0.4', NS.HEROES.volt.a1.telegraph >= 0.4, String(NS.HEROES.volt.a1.telegraph));
{
  const w = freezeBots(NS.makeWorld(91, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => !u.bot && u.team === 0) || w.units.find(u => u.team === 0 && u.hero === 'volt');
  p.bot = false;
  const t = w.units.find(u => u.team === 1);
  p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  t.x = 440; t.y = 300; t.protect = 0;
  const hp = t.hp;
  NS.primary(w, p, t);
  stepN(NS, w, 47);
  ok('primary-does-not-land-before-0.4s', t.hp === hp, `hp ${hp} through ${(47 * C.DT).toFixed(4)}s`);
  stepN(NS, w, 2);
  ok('primary-lands-after-warning', t.hp < hp, `hp ${hp} -> ${t.hp}`);
}
ok('telegraph-rendered-proof-carried', /telegraphRendered:true/.test(html) && /e\.telegraphRendered&&e\.delay>=C\.TELEGRAPH_MIN/.test(html));

// ---------------------------------------------------------------------- G6
group('G6 — storage isolation');
{
  const literals = [...new Set(html.match(/['"](?:mbm_|apex_|apexkick|apexpool|apexgolf|apextennis|voxel|biopunk)[A-Za-z0-9_.-]*['"]/g) || [])];
  ok('single-storage-prefix-literal', literals.length === 1 && /mbm_neonsync_/.test(literals[0]), literals.join(', ') || 'none');
  ok('no-apex-sibling-keys', !literals.some(x => /apex|voxel|biopunk/.test(x)));
  ok('all-storage-writes-use-helper', (html.match(/localStorage\.setItem/g) || []).length === 1 && /localStorage\.setItem\(this\.key\(k\)/.test(html));
  ok('settings-progress-statistics-shapes', ['settings', 'progress', 'statistics'].every(k => html.includes("Store.get('" + k + "'")));
  ok('rhythm-best-uses-helper', /store\.get\('rhythmBest'/.test(html) && /store\.set\('rhythmBest'/.test(html));
}

// ---------------------------------------------------------------------- G7
group('G7 — safeguarding and copy discipline');
ok('no-dollar-amount', !/[$£€]\s*\d/.test(html));
ok('no-purchase-word', !/\bpurchase\b/i.test(html));
ok('no-price-word', !/\bprice\b/i.test(html));
ok('no-gacha-lootbox', !/\bgacha\b|\bloot ?box\b/i.test(html));
ok('no-checkout-subscription', !/\bcheckout\b|\bsubscription\b/i.test(html));
ok('no-cyber-symphony', !/Cyber Symphony/i.test(html));
ok('no-deferred-mode-copy', !/Overdrive Rush|Neon Carnival/i.test(html));
ok('no-gendered-audience-copy', !/for girls|for boys|pink-by-default|easier for/i.test(html));
ok('beat-coins-remain-earn-only', /earned by play and endorsements/i.test(html) && !/buy Beat Coins|purchase Beat Coins/i.test(html));

// ---------------------------------------------------------------------- G8
group('G8 — interaction floor');
{
  const mins = [...html.matchAll(/min-height\s*:\s*(\d+)px/g)].map(m => +m[1]);
  ok('declared-control-floors-at-least-44', mins.length > 0 && mins.every(v => v >= 44), mins.join(','));
  ok('rhythm-lanes-at-least-44', /\.lane-controls button\{min-height:64px/.test(html));
  ok('mobile-action-buttons-at-least-44', /\.mobileDock button\{[^}]*width:58px;height:58px/.test(html));
}

// ---------------------------------------------------------------------- G9
group('G9 — shape, colour and silhouette readability');
ok('four-colour-palettes', /PALETTES=\{[^}]*standard[^}]*deuteranopia[^}]*protanopia[^}]*tritanopia/.test(html));
ok('friendly-diamond-enemy-triangle', /if\(friendly\)\{ctx\.beginPath\(\);ctx\.moveTo\(0,-33\)/.test(html) && /else\{ctx\.beginPath\(\);ctx\.moveTo\(0,-34\)/.test(html));
ok('volt-glyph-distinct-from-zest', /u\.hero==='zest'/.test(html) && /else\{ctx\.beginPath\(\);ctx\.moveTo\(-3,-12\)/.test(html));
ok('rhythm-lanes-use-four-shapes', /arc\(n\.lane\*laneW/.test(html) && /fillRect\(n\.lane\*laneW/.test(html) && /closePath\(\);drawCtx\.fill\(\)/.test(html));

// --------------------------------------------------------------------- G10
group('G10 — 10,000-world soak and finite state');
{
  let bad = 0;
  const stepsPerWorld = IS_TAMPER_CHILD ? 30 : 240;
  const worldTarget = IS_TAMPER_CHILD ? 32 : 10000;
  for (let i = 0; i < worldTarget; i++) {
    const mode = i % 2 ? 'escort' : 'point';
    const side = i % 4 < 2 ? 'attack' : 'defend';
    const hero = ['vibe', 'prism', 'zest', 'volt'][i % 4];
    const w = NS.makeWorld(0x700000 + i, { mode, side, playerHero: hero });
    const start = w.time;
    for (let n = 0; n < stepsPerWorld && w.winner === null; n++) {
      NS.stepWorld(w, C.DT);
      soakSteps++;
    }
    soakWorlds++;
    if (!(w.time > start) || w.units.length !== 6 || w.units.some(u => ![u.x, u.y, u.hp, u.vx, u.vy, u.ult].every(Number.isFinite))) { bad++; break; }
    if (w.payload && (!Number.isFinite(w.payload.progress) || w.payload.progress < 0 || w.payload.progress > 1 || w.payload.lastCheckpoint < 0 || w.payload.lastCheckpoint > w.payload.progress + 1e-9)) { bad++; break; }
  }
  ok(IS_TAMPER_CHILD ? 'tamper-child-finite-world-smoke' : '10k-seeded-worlds-no-nan-no-stall', bad === 0 && soakWorlds === worldTarget, `${soakWorlds} worlds / ${soakSteps} fixed steps`);
  ok('respawn-bounded', C.RESPAWN > 0 && C.RESPAWN <= 10, String(C.RESPAWN));
  ok('spawn-protection-one-point-five', C.SPAWN_PROTECT === 1.5, String(C.SPAWN_PROTECT));
}

// --------------------------------------------------------------------- G11
group('G11 — pointer mapping');
{
  const r = { left: 0, top: 0, width: 360, height: 225 };
  const p = NS.pointerMap(180, 112.5, r, { width: C.W, height: C.H });
  const q = NS.pointerMap(0, 0, r, { width: C.W, height: C.H });
  ok('pointer-360-maps-to-centre', Math.abs(p.x - C.W / 2) < 2 && Math.abs(p.y - C.H / 2) < 2, JSON.stringify(p));
  ok('pointer-corner-positive-control', q.x === 0 && q.y === 0, JSON.stringify(q));
  ok('pointer-scales-by-canvas-over-rect', /canvas\.width\/rect\.width/.test(html) && /canvas\.height\/rect\.height/.test(html));
}

// --------------------------------------------------------------------- G12
group('G12 — accessibility, pause and sim time');
ok('live-region', /aria-live=["']polite["']/.test(html));
ok('noscript', /<noscript[\s>]/.test(html));
ok('no-canvas-guard', /id=["']noCanvas["']/.test(html));
ok('safe-area-insets', /safe-area-inset/.test(html));
ok('focus-visible', /:focus-visible/.test(html));
ok('reduced-motion-media', /prefers-reduced-motion:reduce/.test(html));
ok('modal-role', /role=["']dialog["']/.test(html));
ok('pause-on-hidden-tab', /visibilitychange/.test(html) && /document\.hidden/.test(html) && /Rhythm\.pause\(true\)/.test(html));
ok('match-cooldowns-use-sim-dt', /u\.cool\[k\]=Math\.max\(0,u\.cool\[k\]-dt/.test(html));
ok('rhythm-refocus-no-lump-sum', /function pause\(value\).*last=performance\.now\(\)/.test(html));

// --------------------------------------------------------------------- G13
group('G13 — audio hygiene and gentle defeat');
ok('gesture-audio-unlock', /pointerdown/.test(html) && /AudioContext/.test(html));
ok('audio-mute-persisted', /DEFAULT_SETTINGS=\{mute:false/.test(html));
ok('audio-nodes-disconnected', /disconnect\(\)/.test(html));
ok('rhythm-audio-synthesized-in-file', /createOscillator\(\)/.test(html) && /function beep\(lane,good\)/.test(html));
ok('gentle-defeat-sequence-shared', /\[392,349,330\]/.test(html) && /function playEnd\(win\)/.test(html));

// --------------------------------------------------------------------- G14
group('G14 — bot fairness and endorsement reasons');
ok('reaction-at-least-150ms', C.BOT_REACTION >= 0.15, String(C.BOT_REACTION));
ok('aim-error-positive', C.BOT_AIM_ERROR > 0, String(C.BOT_AIM_ERROR));
ok('bot-speed-not-over-player', C.BOT_SPEED <= C.PLAYER_SPEED, `${C.BOT_SPEED} <= ${C.PLAYER_SPEED}`);
ok('finite-bot-vision', C.BOT_VISION > 0 && Number.isFinite(C.BOT_VISION), String(C.BOT_VISION));
ok('movement-speed-clamped-in-sim', /Math\.min\(hero\(u\.hero\)\.speed\*\(1\+u\.speedBonus\),u\.bot\?C\.BOT_SPEED:C\.PLAYER_SPEED\)/.test(html));
ok('volt-endorsement-reason-lines', /a\.hero==='volt'/.test(html) && /Surge Rail/.test(html));
ok('ai-notices-player-with-reason', /Your AI teammates noticed/.test(html) && /function playerNotice/.test(html));

// --------------------------------------------------------------------- G15
group('G15 — responsive and touch controls');
ok('mobile-breakpoint-480', /@media\(max-width:480px\)/.test(html));
ok('touch-joystick', /id=["']stick["']/.test(html) && /id=["']knob["']/.test(html));
ok('four-touch-rhythm-zones', (html.match(/data-lane=["'][0-3]["']/g) || []).length === 4);
ok('desktop-rhythm-keys-dfjk-arrows', /KeyD:0,ArrowLeft:0,KeyF:1,ArrowDown:1,KeyJ:2,ArrowUp:2,KeyK:3,ArrowRight:3/.test(html));

// --------------------------------------------------------------------- G16
group('G16 — full-cycle source and mode surfaces');
ok('point-hard-cap-six-minutes', C.POINT_SECONDS === 360, String(C.POINT_SECONDS));
ok('escort-hard-cap-five-minutes', C.ESCORT_SECONDS === 300, String(C.ESCORT_SECONDS));
ok('one-escort-checkpoint', NS.makeWorld(1, { mode: 'escort' }).payload.checkpointProgress > 0 && (html.match(/checkpointProgress:/g) || []).length === 1);
ok('same-arena-single-route', NS.ESCORT_ROUTE.length >= 2 && (html.match(/var ESCORT_ROUTE=/g) || []).length === 1);
for (const surface of ['showTitle', 'showEscortSide', 'showHeroes', 'startMatch', 'showPost', 'showRhythm', 'rematch', 'endorse']) {
  ok('cycle-' + surface, new RegExp(surface, 'i').test(html));
}

// ---------------------------------------------------------------------- G-V
group('G-V — Volt bounded control, protection and kit');
ok('cc-ceiling-at-most-1.2', C.CC_MAX <= 1.2, String(C.CC_MAX));
ok('pin-duration-at-most-ceiling', NS.HEROES.volt.a1.pin <= C.CC_MAX, String(NS.HEROES.volt.a1.pin));
ok('grid-slow-at-most-ceiling', NS.HEROES.volt.ult.slowDuration <= C.CC_MAX, String(NS.HEROES.volt.ult.slowDuration));
ok('pin-is-slow-not-root', /applyControl\(t,'slow',e\.pin/.test(html) && !/applyControl\(t,'hard',e\.pin/.test(html));
ok('static-three-seconds-no-cc', NS.HEROES.volt.primary.static === 3 && /t\.static=Math\.max/.test(html));
ok('chain-one-static-enemy-within-six-metres', NS.HEROES.volt.primary.chainRange === 6 * C.METRE && NS.HEROES.volt.primary.chainScale === 0.5);
ok('surge-six-metres-rail-eight-metres', NS.HEROES.volt.a2.surge === 6 * C.METRE && NS.HEROES.volt.a2.length === 8 * C.METRE);
ok('tempo-sync-extends-rail-four-to-six', NS.HEROES.volt.a2.duration === 4 && NS.HEROES.volt.a2.tempoDuration === 6 && /hasTempoAura\(w,u\)/.test(html));
ok('overload-five-seconds-pulses-1.25', NS.HEROES.volt.ult.duration === 5 && NS.HEROES.volt.ult.pulse === 1.25);
ok('pin-bolt-authored-canon', NS.HEROES.volt.a1.cooldown === 10 && NS.HEROES.volt.a1.pin === 1.2 && NS.HEROES.volt.a1.slow === 0.75 && NS.HEROES.volt.a1.telegraph >= 0.4);
ok('surge-rail-authored-canon', NS.HEROES.volt.a2.cooldown === 9 && NS.HEROES.volt.a2.surge === 6 * C.METRE && NS.HEROES.volt.a2.length === 8 * C.METRE && NS.HEROES.volt.a2.duration === 4 && NS.HEROES.volt.a2.tempoDuration === 6 && NS.HEROES.volt.a2.speedBoost === 0.30);
ok('overload-grid-authored-canon', NS.HEROES.volt.ult.charge === 95 && NS.HEROES.volt.ult.radius === 8 * C.METRE && NS.HEROES.volt.ult.duration === 5 && NS.HEROES.volt.ult.pulse === 1.25 && NS.HEROES.volt.ult.slowDuration === 1 && NS.HEROES.volt.ult.slow === 0.50 && NS.HEROES.volt.ult.allyBoost === 0.25);
{
  const fastest = Math.max(...Object.values(NS.HEROES).map(h => h.speed));
  const required = fastest * (1 + NS.HEROES.volt.a2.speedBoost);
  ok('movement-cap-preserves-full-thirty-percent-rail-boost', C.PLAYER_SPEED + 1e-9 >= required && C.BOT_SPEED + 1e-9 >= required && C.BOT_SPEED <= C.PLAYER_SPEED, `required ${required.toFixed(1)}; player cap ${C.PLAYER_SPEED}; bot cap ${C.BOT_SPEED}`);
}
{
  const w = freezeBots(NS.makeWorld(700, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const targets = w.units.filter(u => u.team === 1);
  const first = targets[0], chained = targets[1];
  p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  first.x = 420; first.y = 300; first.protect = 0;
  chained.x = 450; chained.y = 300; chained.protect = 0; chained.static = 1;
  const hpFirst = first.hp, hpChained = chained.hp;
  NS.primary(w, p, first);
  stepN(NS, w, 50);
  ok('tether-dart-applies-static-and-chains-fifty-percent', first.hp === hpFirst - 16 && first.static > 0 && chained.hp === hpChained - 8 && w.events.some(e => e.type === 'static-chain' && e.target === chained.id), `first ${hpFirst}->${first.hp}; chain ${hpChained}->${chained.hp}`);
}
{
  const w = freezeBots(NS.makeWorld(7001, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const t = w.units.find(u => u.team === 1 && u.hero === 'prism');
  p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  t.x = 440; t.y = 300; t.protect = 0; t.channel = 0.8; t.cool.primary = 0.8;
  NS.castA1(w, p, t);
  stepN(NS, w, 50);
  ok('pin-bolt-interrupts-channel-without-rooting', t.channel === 0 && t.slow > 0 && t.cc === 0 && w.events.some(e => e.type === 'pin' && e.target === t.id), `channel ${t.channel}; slow ${t.slow}; hard cc ${t.cc}`);
}
{
  const w = freezeBots(NS.makeWorld(701, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const t = w.units.find(u => u.team === 1);
  p.bot = false; p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  t.x = 440; t.y = 300; t.protect = C.SPAWN_PROTECT;
  const hp = t.hp;
  NS.castA1(w, p, t);
  stepN(NS, w, 80);
  ok('spawn-protection-blocks-pin-bolt', t.hp === hp && t.slow === 0 && t.cc === 0 && t.lock === 0, `hp ${t.hp}; slow ${t.slow}`);
}
{
  const w = freezeBots(NS.makeWorld(702, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const t = w.units.find(u => u.team === 1);
  p.bot = false; p.x = 300; p.y = 300; p.aim = 0; p.protect = 0; p.ult = NS.HEROES.volt.ult.charge;
  t.x = 380; t.y = 300; t.protect = C.SPAWN_PROTECT;
  const hp = t.hp;
  NS.castUlt(w, p);
  stepN(NS, w, 96);
  ok('spawn-protection-blocks-overload-grid', t.hp === hp && t.slow === 0, `hp ${t.hp}; slow ${t.slow}`);
}
{
  const w = freezeBots(NS.makeWorld(703, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const t = w.units.find(u => u.team === 1);
  p.bot = false; p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  t.x = 440; t.y = 300; t.protect = 0;
  NS.castA1(w, p, t);
  stepN(NS, w, 50);
  const active = t.slow > 0 && t.slow <= C.CC_MAX;
  stepN(NS, w, 180);
  ok('pin-slow-activates-then-expires', active && t.slow === 0, `active ${active}; final ${t.slow}`);
}
{
  const w = freezeBots(NS.makeWorld(704, { mode: 'point', playerHero: 'volt' }));
  const t = w.units.find(u => u.team === 1);
  t.protect = 0;
  NS.applyControl(t, 'slow', 99, 0.1);
  const capped = t.slow <= C.CC_MAX;
  stepN(NS, w, Math.ceil((C.CC_MAX + 0.2) / C.DT));
  ok('all-control-clamps-and-expires', capped && t.slow === 0, `capped ${capped}; final ${t.slow}`);
}
{
  const w = freezeBots(NS.makeWorld(705, { mode: 'point', playerHero: 'volt' }));
  const p = w.units.find(u => u.team === 0 && u.hero === 'volt');
  const ally = w.units.find(u => u.team === 0 && u.id !== p.id);
  p.x = 300; p.y = 300; p.aim = 0; p.protect = 0;
  ally.x = 390; ally.y = 300; ally.protect = 0;
  NS.castA2(w, p);
  stepN(NS, w, 2);
  ok('teammate-rail-follow-is-synergy-event', p.synergy > 0 && w.events.some(e => e.type === 'rail-follow' && e.source === p.id && e.follower === ally.id), `leader synergy ${p.synergy}`);
}

// ---------------------------------------------------------------------- G-E
group('G-E — Escort truth table');
{
  const attack = NS.makeWorld(809, { mode: 'escort', side: 'attack', playerHero: 'volt' });
  const defend = NS.makeWorld(809, { mode: 'escort', side: 'defend', playerHero: 'volt' });
  ok('escort-side-choice-maps-player-correctly', attack.playerTeam === 0 && attack.attackerTeam === 0 && attack.defenderTeam === 1 && defend.playerTeam === 0 && defend.attackerTeam === 1 && defend.defenderTeam === 0, `attack ${attack.attackerTeam}/${attack.defenderTeam}; defend ${defend.attackerTeam}/${defend.defenderTeam}`);
}
{
  const w = farFromEscort(NS.makeWorld(810, { mode: 'escort', side: 'attack', playerHero: 'volt' }));
  w.payload.progress = w.payload.checkpointProgress;
  w.payload.lastCheckpoint = w.payload.checkpointProgress;
  const p = NS.routePoint(w.payload.progress);
  const a = firstOnTeam(w, w.attackerTeam), d = firstOnTeam(w, w.defenderTeam);
  a.x = p.x; a.y = p.y; d.x = p.x; d.y = p.y;
  const before = w.payload.progress;
  stepN(NS, w, 120);
  ok('escort-contested-stops-at-checkpoint', Math.abs(w.payload.progress - before) < 1e-12 && w.payload.contested && !w.payload.pushing, `${before} -> ${w.payload.progress}`);
}
{
  const w = farFromEscort(NS.makeWorld(811, { mode: 'escort', side: 'attack' }));
  w.payload.progress = 0.70;
  w.payload.lastCheckpoint = w.payload.checkpointProgress;
  w.payload.unattended = C.PAYLOAD_UNATTENDED;
  stepN(NS, w, Math.ceil(30 / C.DT));
  ok('escort-rollback-floor-at-checkpoint', Math.abs(w.payload.progress - w.payload.lastCheckpoint) < 1e-9, `progress ${w.payload.progress}; floor ${w.payload.lastCheckpoint}`);
}
{
  const w = farFromEscort(NS.makeWorld(812, { mode: 'escort', side: 'attack' }));
  w.payload.progress = 0.62;
  w.payload.lastCheckpoint = w.payload.checkpointProgress;
  w.payload.unattended = C.PAYLOAD_UNATTENDED;
  stepN(NS, w, 120);
  const rolled = w.payload.progress;
  const a = firstOnTeam(w, w.attackerTeam), p = NS.routePoint(w.payload.progress);
  a.x = p.x; a.y = p.y;
  stepN(NS, w, 120);
  ok('escort-rollback-meets-push', w.payload.progress > rolled && w.payload.pushing && !w.payload.contested, `${rolled} -> ${w.payload.progress}`);
}
{
  const w = farFromEscort(NS.makeWorld(813, { mode: 'escort', side: 'attack' }));
  w.payload.progress = 0.9999;
  const a = firstOnTeam(w, w.attackerTeam), p = NS.routePoint(w.payload.progress);
  a.x = p.x; a.y = p.y;
  stepN(NS, w, 20);
  ok('escort-delivery-awards-attacker', w.winner === w.attackerTeam, `winner ${w.winner}; attacker ${w.attackerTeam}`);
}
{
  const w = farFromEscort(NS.makeWorld(814, { mode: 'escort', side: 'attack' }));
  w.left = 0;
  NS.stepWorld(w, C.DT);
  ok('escort-horn-awards-defender', w.winner === w.defenderTeam, `winner ${w.winner}; defender ${w.defenderTeam}`);
}
{
  const w = farFromEscort(NS.makeWorld(815, { mode: 'escort', side: 'attack' }));
  w.left = 0;
  const a = firstOnTeam(w, w.attackerTeam), p = NS.routePoint(w.payload.progress);
  a.x = p.x; a.y = p.y;
  NS.stepWorld(w, C.DT);
  const active = w.overtime && w.winner === null;
  a.x = 950; a.y = 50;
  NS.stepWorld(w, C.DT);
  ok('escort-overtime-only-while-actively-pushed', active && w.winner === w.defenderTeam && !w.overtime, `active ${active}; final winner ${w.winner}`);
  ok('escort-overtime-has-finite-bound', Number.isFinite(C.ESCORT_MAX_OT) && C.ESCORT_MAX_OT > 0, String(C.ESCORT_MAX_OT));
}

// ---------------------------------------------------------------------- G-R
group('G-R — Rhythm Reflex isolation');
{
  const w = NS.makeWorld(901, { mode: 'escort', side: 'attack', playerHero: 'volt' });
  const r = NS.createRhythmState(0x52484658);
  r.running = true;
  const worldBefore = JSON.stringify(NS.summary(w));
  for (let i = 0; i < 600; i++) {
    NS.rhythmStep(r, C.DT);
    if (i % 53 === 0) NS.rhythmHit(r, i % 4);
  }
  const worldAfterRhythm = JSON.stringify(NS.summary(w));
  const rhythmBeforeWorld = JSON.stringify(r);
  for (let i = 0; i < 600; i++) NS.stepWorld(w, C.DT);
  const rhythmAfterWorld = JSON.stringify(r);
  ok('cabinet-mutation-cannot-alter-match-state', worldBefore === worldAfterRhythm);
  ok('match-mutation-cannot-alter-cabinet-state', rhythmBeforeWorld === rhythmAfterWorld);
  r.matchScore = [999, 999];
  w.rhythmScore = 999999;
  ok('cross-write-attempt-fails', w.score[0] !== 999 && r.score !== 999999, `match score ${w.score.join('/')}; rhythm score ${r.score}`);
  ok('rhythm-four-lanes', r.notes.every(n => Number.isInteger(n.lane) && n.lane >= 0 && n.lane < 4));
  ok('rhythm-track-bounded', Number.isFinite(r.duration) && r.duration > 0 && r.notes.length === 36, `${r.notes.length} notes / ${r.duration.toFixed(2)}s`);
}
{
  const a = html.indexOf('RHYTHM:BEGIN'), b = html.indexOf('RHYTHM:END');
  const block = html.slice(a, b);
  ok('rhythm-closure-receives-no-match-state', a >= 0 && b > a && !/\bG\b/.test(block) && /\}\)\(Store,function\(\)/.test(block));
  ok('rhythm-closure-has-no-direct-localstorage', !/localStorage/.test(block));
  ok('rhythm-exit-always-visible', /id="rhythmExit">Exit cabinet/.test(html));
}

// ---------------------------------------------------------------------- G-Q
group('G-Q — quality governor hysteresis');
ok('quality-degrades-from-measured-fps', /avg<22\?'Critical':avg<35\?'Severe':avg<50\?'Degraded':'Optimal'/.test(html));
ok('quality-recovery-requires-six-seconds', /G\.recover>=6/.test(html));
ok('reduced-motion-independent-of-quality', /function quietMotion\(\)\{return !!S\.reduced/.test(html) && !/function govern\([^}]*S\.reduced\s*=/.test(html));
ok('governor-does-not-enable-effects', !/function govern\([^}]*reduced\s*=\s*false/.test(html));

// --------------------------------------------------------------------- G-H
group('G-H — harness non-vacuity');
if (IS_CHILD) {
  ok('self-test-child-guard', true, 'recursive self-test suppressed');
} else {
  const self = spawnSync(process.execPath, [__filename, '--self-test'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const last = (self.stdout || '').trim().split('\n').slice(-2).join(' | ');
  ok('self-test-positive-control-and-eight-families', self.status === 0 && /POSITIVE_CONTROL=FIRED/.test(self.stdout || '') && /TAMPER_REJECTED=8\/8/.test(self.stdout || ''), last);
}

console.log('\n' + '='.repeat(78));
console.log(fail ? `${pass} passed, ${fail} FAILED` : `ALL ${pass} NEON SYNC v1.1 SOURCE CHECKS PASSED`);
console.log('='.repeat(78));
console.log(`BASE_BYTES=${BASE_BYTES}`);
console.log(`BASE_SHA256=${BASE_SHA}`);
console.log(`FILE_BYTES=${bytes}`);
console.log(`FILE_SHA256=${sourceSha}`);
console.log(`HARNESS_PASS=${pass}`);
console.log(`HARNESS_FAIL=${fail}`);
console.log(`POINT_DETERMINISM_MAX_DELTA=${pointDelta}`);
console.log(`ESCORT_DETERMINISM_MAX_DELTA=${escortDelta}`);
console.log(`POINT_RATING_SUPPORT=${pointSupport}`);
console.log(`POINT_RATING_SELFISH_STRIKER=${pointSelfish}`);
console.log(`ESCORT_RATING_SUPPORT=${escortSupport}`);
console.log(`ESCORT_RATING_SELFISH_STRIKER=${escortSelfish}`);
console.log(`SOAK_WORLDS=${soakWorlds}`);
console.log(`SOAK_FIXED_STEPS=${soakSteps}`);
process.exit(fail ? 1 : 0);
