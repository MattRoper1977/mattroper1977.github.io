#!/usr/bin/env node
/*
 * verify_apexrally.js — shipping contract for /apexrally/index.html
 *
 * Shaped after verify_apexkick.js / verify_apextennis.js, with two deliberate
 * departures, both of which close defects found in the donor harnesses.
 *
 * 1. NO BUILD SENTINEL. Apex Rally ships as the delivered artifact plus exactly
 *    two permitted edits, so it carries no sentinel comment to count. Identity
 *    is established the honest way instead: the harness REVERSES the two
 *    permitted edits and asserts the result hashes back to the delivered
 *    artifact (DELIVERED_SHA256 below). That pins an immutable historical fact
 *    — what was delivered — rather than a moving HEAD, so it cannot rot the way
 *    a pinned manifest count or commit SHA does, and byte-accountability can
 *    never silently drift.
 *
 * 2. CORRECTED no-remote-resources form. The donor's sourceValidators.external
 *    limb reads
 *        !/<(?:script|link|img|audio|video|source)\b[^>]+(?:src|href)=["']https?:/i
 *    which counts <link rel="canonical" href="https://..."> as a remote
 *    resource. It is not: canonical, og:url and og:image are METADATA, never
 *    fetched at runtime. That limb returns false on the CLEAN apextennis file
 *    today, and the defect hides because the donor only ever asserts the
 *    mutated form returns false — never that the clean form returns true.
 *    G2 here uses the runtime-only tag list AND asserts the clean file passes
 *    positively, so the same defect cannot recur silently.
 *
 * Every gate family has a positive control in G9: a tampered copy that the gate
 * must reject. A gate that cannot fail is vacuous.
 *
 *   node tools/verify_apexrally.js [path/to/index.html]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.AR_GAME_FILE || process.argv[2] || path.join(ROOT, 'apexrally', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const bytes = Buffer.byteLength(html);
const sha = crypto.createHash('sha256').update(html).digest('hex');

/* The delivered artifact, pinned. Immutable historical fact, not a HEAD state. */
const DELIVERED_SHA256 = 'c34226418ff016f1fae62ffadf14e15053935550d65e311e493d48c7b84cef04';
const DELIVERED_BYTES = 50832;

/* The two permitted edits, as reversible rules. */
const E1 = { name: 'storage key rename', from: "'mbm_apexrally_v1'", to: "'apexRally.v1'", expect: 2 };
const E2_LINES = [
  '<link rel="canonical" href="https://madebymatt.uk/apexrally/">\n',
  '<meta property="og:url" content="https://madebymatt.uk/apexrally/">\n',
  '<meta property="og:title" content="Apex Rally — Read the Court">\n'
];

const results = [];
function assert(x, m) { if (!x) throw new Error(m); }
function gate(id, name, fn) {
  try { const d = fn() || ''; results.push({ id, name, status: 'PASS', detail: d }); console.log(`PASS ${id} ${name}${d ? ' — ' + d : ''}`); }
  catch (e) { results.push({ id, name, status: 'FAIL', detail: e.message }); console.error(`FAIL ${id} ${name} — ${e.message}`); }
}

/* ---------------------------------------------------------------- helpers */

/* Reverse the permitted edits and hand back the reconstructed delivered file. */
function reverseEdits(src) {
  let s = src;
  for (const line of E2_LINES) s = s.replace(line, '');
  s = s.split(E1.from).join(E1.to);
  return s;
}

/* Pull `function NAME(...) { ... }` out of the source by brace matching, so the
 * gates below execute the SHIPPED text rather than a re-implementation. */
function fnText(name, src = html) {
  const start = src.indexOf('function ' + name + '(');
  assert(start >= 0, 'function ' + name + ' not found in source');
  let i = src.indexOf('{', start), depth = 0, inS = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (inS) { if (c === '\\') esc = true; else if (c === inS) inS = null; continue; }
    if (c === "'" || c === '"' || c === '`') { inS = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces extracting ' + name);
}

/* The court constants line, taken verbatim from the file (never re-typed). */
function constsText(src = html) {
  const m = src.match(/const COURT_W=[^;]+;/);
  assert(m, 'court constants line not found');
  return m[0];
}

/* Build a sandbox that runs the shipped rules against stubbed globals, and
 * records every scoring decision the shipped code reaches. */
function sandbox(src = html) {
  const calls = [];
  const env = {
    G: null, saved: { settings: { reduced: true }, stats: { readPoints: 0, bestRally: 0 } },
    sfx() {}, burst() {}, message() {}, predictGround() { return null; },
    hypot: Math.hypot, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    setTimeout(fn) { calls.push({ call: 'setTimeout' }); return 0; },
    awardPoint(winner, reason) { calls.push({ call: 'awardPoint', winner, reason }); },
    serveFaultSpy(reason) { calls.push({ call: 'serveFault', reason }); },
    resetServeSame() { calls.push({ call: 'resetServeSame' }); },
    calls
  };
  const code = `
    ${constsText(src)}
    ${fnText('legalLanding', src)}
    ${fnText('other', src)}
    ${fnText('onBounce', src)}
    ${fnText('updateBall', src)}
    return { legalLanding, other, onBounce, updateBall };`;
  /* serveFault is spied on for onBounce/updateBall, and executed for its own gate. */
  const api = new Function(
    'G', 'saved', 'sfx', 'burst', 'message', 'predictGround', 'hypot', 'clamp',
    'setTimeout', 'awardPoint', 'serveFault',
    code
  )(env.G, env.saved, env.sfx, env.burst, env.message, env.predictGround, env.hypot,
    env.clamp, env.setTimeout, env.awardPoint, env.serveFaultSpy);
  return { api, env };
}

/* A ball/state fixture. G is rebound per run because the shipped code closes
 * over it by reference. */
function runBall(src, ball, state) {
  const calls = [];
  const G = Object.assign({
    pointLocked: false, mode: 'playing', server: 'player', faults: 0, rally: 0,
    player: { x: 0, y: 300, focus: 50 }, ai: { x: 0, y: -300 }, shake: 0
  }, state, { ball: Object.assign({ trail: [], readChecked: true, netHit: false, curve: 0 }, ball) });
  const saved = { settings: { reduced: true }, stats: { readPoints: 0, bestRally: 0 } };
  const code = `
    ${constsText(src)}
    ${fnText('legalLanding', src)}
    ${fnText('other', src)}
    ${fnText('onBounce', src)}
    ${fnText('updateBall', src)}
    return { onBounce, updateBall, legalLanding, other };`;
  const api = new Function(
    'G', 'saved', 'sfx', 'burst', 'message', 'predictGround', 'hypot', 'clamp',
    'setTimeout', 'awardPoint', 'serveFault', code
  )(G, saved, () => {}, () => {}, () => {}, () => null, Math.hypot,
    (v, a, b) => Math.max(a, Math.min(b, v)), () => 0,
    (winner, reason) => { calls.push({ call: 'awardPoint', winner, reason }); G.pointLocked = true; },
    (reason) => { calls.push({ call: 'serveFault', reason }); G.pointLocked = true; });
  return { api, G, calls };
}

/* Source-level validators, one per gate family. Each must be provably able to
 * return false — that is what G9 establishes. */
function sourceValidators(s) {
  const runtimeTags = s.match(/<(?:script|img|audio|video|source|iframe|embed|object)\b[^>]*>/gi) || [];
  const remote = runtimeTags.filter(t => /(?:src|data|srcset)=["']?https?:/i.test(t));
  const minHeights = (s.match(/min-height:(\d+)px/g) || []).map(x => parseInt(x.match(/\d+/)[0], 10));
  return {
    provenance: crypto.createHash('sha256').update(reverseEdits(s)).digest('hex') === DELIVERED_SHA256,
    title: /<title>Apex Rally — Read the Court<\/title>/.test(s),
    canonical: /rel="canonical" href="https:\/\/madebymatt\.uk\/apexrally\/"/.test(s) &&
               /property="og:url" content="https:\/\/madebymatt\.uk\/apexrally\/"/.test(s),
    storage: (s.match(/mbm_apexrally_/g) || []).length === 2 &&
             !/mbm_apex(?:kick|pool|golf|tennis)_|apex_coins|coldCall_|ps_coldcall_|'apexRally\.v1'/.test(s),
    network: remote.length === 0 && !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|new\s+Image\s*\(/.test(s),
    /* Apex Rally honours reduced motion in two places, not two media blocks:
     * one global CSS override, and the JS default that seeds the user setting
     * from the media query. Both limbs are required. */
    motion: (s.match(/@media\(prefers-reduced-motion:reduce\)\{[^}]*animation-duration:\.001ms!important/) || []).length === 1 &&
            /reduced:matchMedia\('\(prefers-reduced-motion:reduce\)'\)\.matches/.test(s),
    targets: minHeights.length > 0 && Math.min(...minHeights) >= 44,
    sentinelFree: !/^\s*<!--\s*apex\w*-build-\d{4}-\d{2}-\d{2}\s*-->/m.test(s)
  };
}

/* ------------------------------------------------------------------ gates */

gate('G1', 'identity, provenance and byte accountability', () => {
  const v = sourceValidators(html);
  assert(v.sentinelFree, 'a build sentinel is present; Apex Rally ships sentinel-free');
  assert(v.title, 'title mismatch');
  assert(v.canonical, 'canonical/og:url mismatch');
  assert(/property="og:title" content="Apex Rally — Read the Court"/.test(html), 'og:title mismatch');
  const rebuilt = reverseEdits(html);
  const rsha = crypto.createHash('sha256').update(rebuilt).digest('hex');
  assert(Buffer.byteLength(rebuilt) === DELIVERED_BYTES,
    `reversing the permitted edits gives ${Buffer.byteLength(rebuilt)} bytes, delivered is ${DELIVERED_BYTES}`);
  assert(rsha === DELIVERED_SHA256, `reversed hash ${rsha} != delivered ${DELIVERED_SHA256}`);
  return `${bytes} bytes; sha256 ${sha}; reverses to delivered ${DELIVERED_SHA256.slice(0, 8)}… (+${bytes - DELIVERED_BYTES} bytes = E1+E2 only)`;
});

gate('G2', 'zero runtime network requests (metadata is not a resource)', () => {
  const v = sourceValidators(html);
  assert(v.network, 'a remote runtime resource or network API is present');
  /* the corrected form must PASS positively on the clean file — the donor
   * defect was that this limb silently returned false and nobody checked */
  const metaUrls = (html.match(/https?:\/\/[^"'\s)]+/g) || []);
  const inMetadata = metaUrls.every(u => new RegExp(
    `(?:rel="canonical"\\s+href|property="og:(?:url|image)"\\s+content)="${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html));
  assert(metaUrls.length === 0 || inMetadata,
    'an absolute URL appears outside canonical/og metadata: ' + metaUrls.join(', '));
  return `0 remote runtime tags; 0 network APIs; ${metaUrls.length} absolute URL(s), all metadata`;
});

gate('G3', 'storage prefix census', () => {
  const v = sourceValidators(html);
  assert(v.storage, 'storage census failed');
  const keys = [...html.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\('([^']+)'/g)].map(m => m[1]);
  const uniq = [...new Set(keys)];
  assert(uniq.length === 1 && uniq[0] === 'mbm_apexrally_v1', 'unexpected key set: ' + uniq.join(', '));
  assert(keys.length === 2, `expected 2 storage accesses, found ${keys.length}`);
  return `1 key (${uniq[0]}) across ${keys.length} accesses; 0 sibling-key hits`;
});

gate('G4', 'reduced motion honoured', () => {
  const v = sourceValidators(html);
  assert(v.motion, 'the CSS override or the matchMedia default is missing');
  const n = (html.match(/prefers-reduced-motion:reduce/g) || []).length;
  assert(n === 2, `expected 2 prefers-reduced-motion references (1 CSS override + 1 matchMedia default), found ${n}`);
  assert(/'reduce'|reduced/.test(html), 'no reduced-motion setting');
  return `${n} references: 1 global CSS override + 1 matchMedia-seeded default`;
});

gate('G5', '44px floor on interactive controls', () => {
  const v = sourceValidators(html);
  assert(v.targets, 'a min-height below 44px is present');
  const hs = (html.match(/min-height:(\d+)px/g) || []).map(x => parseInt(x.match(/\d+/)[0], 10));
  const controls = ['.iconbtn', '.shotbtn', '.btn', '.toggle', '.mob'];
  controls.forEach(sel => {
    const re = new RegExp(sel.replace('.', '\\.') + '\\{[^}]*min-height:(\\d+)px');
    const m = html.match(re);
    assert(m, `no min-height declared for ${sel}`);
    assert(parseInt(m[1], 10) >= 44, `${sel} min-height ${m[1]}px is below 44px`);
  });
  return `${hs.length} declarations, floor ${Math.min(...hs)}px; ${controls.length} control classes each ≥44px`;
});

gate('G6', 'serve/fault state machine is reachable', () => {
  /* first fault -> second serve, no point awarded */
  const a = runBall(html, { live: true, attached: false, bounces: 0, isServe: true, lastHitter: 'player',
    x: 0, y: 900, z: 0, vx: 0, vy: 0, vz: -10 }, { faults: 0, server: 'player' });
  a.api.onBounce();
  assert(a.calls.some(c => c.call === 'serveFault'), 'an illegal serve landing did not raise a fault');
  assert(!a.calls.some(c => c.call === 'awardPoint'), 'a first fault wrongly awarded a point');

  /* legal serve landing -> serve becomes a rally ball */
  const b = runBall(html, { live: true, attached: false, bounces: 0, isServe: true, lastHitter: 'player',
    x: 0, y: -300, z: 0, vx: 0, vy: 0, vz: -10, bounce: 0.6 }, { faults: 0, server: 'player' });
  b.api.onBounce();
  assert(b.G.ball.bounces === 1, `legal serve landing gave bounces=${b.G.ball.bounces}`);
  assert(b.G.ball.isServe === false, 'a legally landed serve did not become a rally ball');
  assert(!b.calls.length, 'a legal serve landing ended the point');

  /* second bounce on the same side -> point to the striker */
  const c = runBall(html, { live: true, attached: false, bounces: 1, isServe: false, lastHitter: 'player',
    x: 0, y: -300, z: 0, vx: 0, vy: 0, vz: -10 }, { faults: 0 });
  c.api.onBounce();
  const cw = c.calls.find(x => x.call === 'awardPoint');
  assert(cw && cw.winner === 'player' && cw.reason === 'SECOND BOUNCE',
    'second bounce did not score for the striker: ' + JSON.stringify(c.calls));
  return 'fault → second serve; legal serve → rally ball; second bounce → striker';
});

gate('G7', 'already-bounced legal ball past the baseline scores for the striker', () => {
  /* THE REPAIRED CASE. A ball that has bounced legally and then leaves the court
   * past the baseline is UNRETURNED — it scores for the striker, not against.
   * Encoded as a fixture table so it can never silently regress. */
  const FIXTURES = [
    { name: 'bounced legally, then past the baseline',
      ball: { bounces: 1, isServe: false, lastHitter: 'player', y: -900 },
      expect: { call: 'awardPoint', winner: 'player', reason: 'UNRETURNED' } },
    { name: 'bounced legally, then past the baseline (ai striking)',
      ball: { bounces: 1, isServe: false, lastHitter: 'ai', y: 900 },
      expect: { call: 'awardPoint', winner: 'ai', reason: 'UNRETURNED' } },
    { name: 'never bounced, straight out',
      ball: { bounces: 0, isServe: false, lastHitter: 'player', y: -900 },
      expect: { call: 'awardPoint', winner: 'ai', reason: 'OUT' } },
    { name: 'serve, straight out',
      ball: { bounces: 0, isServe: true, lastHitter: 'player', y: -900 },
      expect: { call: 'serveFault' } },
    { name: 'wide past the sideline after a legal bounce',
      ball: { bounces: 1, isServe: false, lastHitter: 'player', x: -700, y: -100 },
      expect: { call: 'awardPoint', winner: 'player', reason: 'UNRETURNED' } }
  ];
  const seen = [];
  FIXTURES.forEach(f => {
    const r = runBall(html, Object.assign(
      { live: true, attached: false, x: 0, y: 0, z: 100, vx: 0, vy: 0, vz: 50 }, f.ball), {});
    r.api.updateBall(1 / 120);
    const got = r.calls[0];
    assert(got, `${f.name}: the shipped code reached no decision`);
    assert(got.call === f.expect.call, `${f.name}: got ${got.call}, expected ${f.expect.call}`);
    if (f.expect.winner) {
      assert(got.winner === f.expect.winner && got.reason === f.expect.reason,
        `${f.name}: got ${got.winner}/${got.reason}, expected ${f.expect.winner}/${f.expect.reason}`);
    }
    seen.push(`${f.name} → ${got.winner || got.reason}`);
  });
  return `${FIXTURES.length} fixtures; a legally bounced ball leaving the court scores for the striker, an unbounced one does not`;
});

gate('G8', 'single self-contained file', () => {
  /* The one-file-per-game rule applies to the shipped directory. When the
   * harness is pointed at a scratch copy (tamper runs, positive controls) there
   * is no directory contract to enforce, so scope the check to the real path. */
  const shipped = path.join(ROOT, 'apexrally', 'index.html');
  if (path.resolve(FILE) === shipped) {
    const entries = fs.readdirSync(path.dirname(shipped));
    assert(entries.length === 1 && entries[0] === 'index.html',
      `/apexrally/ must hold exactly index.html, found: ${entries.join(', ')}`);
  }
  assert(bytes <= 250 * 1024, `size ${bytes} exceeds the 250KB single-file ceiling`);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert(scripts.length === 1, `expected 1 inline script block, found ${scripts.length}`);
  scripts.forEach(s => new Function(s));
  return `1 file, ${bytes} bytes; 1 inline script block, parses clean`;
});

gate('G9', 'every gate family is non-vacuous (positive controls)', () => {
  /* Source-level families: a tampered copy must make the validator return false,
   * AND the clean file must make it return true. Both directions, every family —
   * the donor only ever checked one, which is how its canonical defect hid. */
  const clean = sourceValidators(html);
  const vacuous = Object.entries(clean).filter(([, v]) => v !== true).map(([k]) => k);
  assert(vacuous.length === 0, 'validator(s) already false on the CLEAN file: ' + vacuous.join(', '));

  const MUTATIONS = [
    ['provenance', html.replace('<meta name="theme-color"', '<meta name="x" content="y"><meta name="theme-color"')],
    ['title', html.replace('<title>Apex Rally — Read the Court</title>', '<title>Apex Rally</title>')],
    ['canonical', html.replace('rel="canonical" href="https://madebymatt.uk/apexrally/"', 'rel="canonical" href="https://example.invalid/"')],
    ['storage', html.replace(/mbm_apexrally_v1/g, 'mbm_apexpool_v1')],
    ['network', html.replace('</head>', '<script src="https://example.invalid/x.js"></script></head>')],
    ['motion', html.replace('@media(prefers-reduced-motion:reduce){', '@media(screen){')],
    ['targets', html.replace('min-height:44px', 'min-height:31px')],
    ['sentinelFree', '<!-- apexrally-build-2026-08-05 -->\n' + html]
  ];
  const survived = [];
  const proven = [];
  MUTATIONS.forEach(([family, mutated]) => {
    assert(mutated !== html, `${family}: mutation was a no-op, the control proves nothing`);
    const v = sourceValidators(mutated);
    if (v[family] !== false) survived.push(family); else proven.push(family);
  });
  assert(survived.length === 0, 'mutation(s) survived, gate is vacuous: ' + survived.join(', '));

  /* Behavioural family: break the repair and prove G7's fixture rejects it. */
  const broken = html.replace(
    "if(b.bounces>=1&&!b.isServe)awardPoint(b.lastHitter,'UNRETURNED')",
    "if(b.bounces>=1&&!b.isServe)awardPoint(other(b.lastHitter),'UNRETURNED')");
  assert(broken !== html, 'scoring mutation was a no-op; the repaired branch was not found');
  const r = runBall(broken, { live: true, attached: false, bounces: 1, isServe: false,
    lastHitter: 'player', x: 0, y: -900, z: 100, vx: 0, vy: 0, vz: 50 }, {});
  r.api.updateBall(1 / 120);
  assert(r.calls[0] && r.calls[0].winner === 'ai',
    'the regressed build did not change the award; the G7 fixture is blind to it');
  proven.push('scoring(G7)');

  /* Behavioural family: break the serve machine and prove G6 rejects it. */
  const brokenServe = html.replace("if(b.isServe)serveFault('Fault');else", '');
  assert(brokenServe !== html, 'serve mutation was a no-op');
  const s = runBall(brokenServe, { live: true, attached: false, bounces: 0, isServe: true,
    lastHitter: 'player', x: 0, y: 900, z: 0, vx: 0, vy: 0, vz: -10 }, { faults: 0 });
  s.api.onBounce();
  assert(!s.calls.some(c => c.call === 'serveFault'),
    'the regressed serve build still raised a fault; the G6 gate is blind to it');
  proven.push('serve(G6)');

  console.log('       positive controls: ' + proven.join(', '));
  return `${proven.length} gate families each proven able to FAIL (and true on the clean file)`;
});

/* ---------------------------------------------------------------- summary */
const failed = results.filter(r => r.status === 'FAIL');
console.log(`\nApex Rally: ${results.length - failed.length}/${results.length} source gates passed.`);
if (failed.length) { console.error('FAILED: ' + failed.map(f => f.id).join(', ')); process.exitCode = 1; }
else console.log(`ALL ${results.length} APEX RALLY SOURCE GATES PASSED`);
