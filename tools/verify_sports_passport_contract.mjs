#!/usr/bin/env node
/**
 * Behavioural gate for docs/CONTRACT_sports_passport_v4.md.
 *
 * The seed is always a populated record authored by the deployed Apex Kick.
 * C1 compares values, C2 observes an exact corrupt-string backup, and C5 uses
 * two independent fresh installs. No clause is inferred from source shape.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'mbm_sports_passport_v4';
const BACKUP = 'mbm_sports_passport_v4_corrupt_backup';
const BANNED_NODE = 'mbm-default00000000';
const CORRUPT_RAW = '{V6PGF-not-json:\u2603';
const SEED_GAME = path.join(ROOT, 'apexkick', 'index.html');
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const PORT = Number(process.env.PASSPORT_GATE_PORT || 4460);
const WAIT_MS = Number(process.env.PASSPORT_GATE_WAIT_MS || 6500);

const OWN_SAVE = {
  'apex-velodrome': 'mbm_apex_velodrome_v4',
  'apex-curl': 'mbm_apex_curl_v4',
  'neon-turf': 'mbm_neon_turf_v4',
  'marble': 'mbm_marble_v4',
  'grapple': 'mbm_grapple_v4',
  'wrecking-crew': 'mbm_wrecking_crew_v4',
  'medevac': 'mbm_medevac_v4',
  'apex-kick': 'apexkick.aaa.v4',
  'aurora-links': 'mbm_aurora_links_aaa_v4',
  'house-olympiad': 'mbm_house_olympiad_v4_settings',
  'olympics': 'mbm_global_games_world_stage_v4',
};

function guessId(file) {
  const base = path.basename(file).toLowerCase();
  for (const id of Object.keys(OWN_SAVE)) {
    if (base.includes(id.replace(/-/g, '_')) || base.includes(id.replace(/-/g, ''))) return id;
  }
  const dir = path.basename(path.dirname(file));
  return ({
    apexkick: 'apex-kick', auroralinks: 'aurora-links', houseolympiad: 'house-olympiad',
    olympics: 'olympics', apexcurl: 'apex-curl', apexvelodrome: 'apex-velodrome',
    neonturf: 'neon-turf', medevac: 'medevac', grapple: 'grapple', marble: 'marble',
    wreckingcrew: 'wrecking-crew',
  })[dir] || null;
}

function labelFor(file) {
  const base = path.basename(file);
  return base === 'index.html'
    ? path.basename(path.dirname(file))
    : base.replace(/^[0-9a-f]{6,}-/, '').replace(/(_AAA_V6)?\.html$/, '');
}

class Fixture {
  constructor() { this.serve = SEED_GAME; }
  async start() {
    this.server = http.createServer((_, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(fs.readFileSync(this.serve));
    });
    await new Promise(resolve => this.server.listen(PORT, '127.0.0.1', resolve));
    this.browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  }
  async stop() {
    if (this.browser) await this.browser.close();
    if (this.server) await new Promise(resolve => this.server.close(resolve));
  }
  url(query = '') { return `http://127.0.0.1:${PORT}/${query ? '?' + query : ''}`; }
}

const SPY = `
  (() => {
    window.__passportWrites = [];
    window.__passportReads = 0;
    window.__corruptParses = 0;
    const storageProto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
    const getItem = storageProto.getItem;
    storageProto.getItem = function (key) {
      if (key === ${JSON.stringify(KEY)}) window.__passportReads += 1;
      return getItem.apply(this, arguments);
    };
    const setItem = storageProto.setItem;
    storageProto.setItem = function (key, value) {
      if (key === ${JSON.stringify(KEY)}) {
        window.__passportWrites.push({ value: String(value), stack: (new Error().stack || '').split('\\n').slice(1, 5).join(' | ') });
      }
      return setItem.apply(this, arguments);
    };
    const parse = JSON.parse;
    JSON.parse = function (value) {
      if (value === ${JSON.stringify(CORRUPT_RAW)}) window.__corruptParses += 1;
      return parse.apply(this, arguments);
    };
  })();
`;

function parseRecord(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function readMark(raw, mark) {
  const passport = parseRecord(raw);
  if (!passport) return { ok: false, why: 'passport absent or unparseable' };
  const name = passport.profile?.name?.value;
  const house = passport.profile?.house?.value;
  const xp = JSON.stringify(passport.counters?.xp || []);
  const badges = JSON.stringify((passport.sets?.badges?.adds || []).map(item => item[1]?.id));
  const receipts = JSON.stringify((passport.receipts || []).map(item => item[0]));
  const missing = [];
  if (name !== mark.name) missing.push(`name ${JSON.stringify(name)} != ${JSON.stringify(mark.name)}`);
  if (house !== mark.house) missing.push(`house ${JSON.stringify(house)} != ${JSON.stringify(mark.house)}`);
  if (!xp.includes(String(mark.xp))) missing.push(`xp lost ${mark.xp}`);
  if (!badges.includes(mark.badge)) missing.push(`badge lost ${mark.badge}`);
  if (!receipts.includes(mark.receiptId)) missing.push(`receipt lost ${mark.receiptId}`);
  return missing.length ? { ok: false, why: missing.join('; '), passport } : { ok: true, passport };
}

async function seedPassport(fixture, context, mark) {
  const page = await context.newPage();
  fixture.serve = SEED_GAME;
  await page.goto(fixture.url('seed=apexkick'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.MadeByMattV4Runtime), null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  const authored = await page.evaluate(key => localStorage.getItem(key), KEY);
  if (!authored) return { ok: false, why: 'deployed Apex Kick authored no passport' };
  const marked = await page.evaluate(([key, value]) => {
    try {
      const runtime = window.MadeByMattV4Runtime;
      let passport = runtime.normalizePassport(JSON.parse(localStorage.getItem(key)));
      passport = runtime.mutations.mutateProfile(passport, { name: value.name, house: value.house });
      passport = runtime.mutations.grantAward(passport, {
        receiptId: value.receiptId, game: 'apex-kick', xp: value.xp,
        housePoints: value.housePoints, badge: value.badge,
      });
      localStorage.setItem(key, JSON.stringify(passport));
      return { ok: true };
    } catch (error) { return { ok: false, why: error.message }; }
  }, [KEY, mark]);
  if (!marked.ok) return { ok: false, why: 'deployed runtime refused the mark: ' + marked.why };
  await page.waitForTimeout(2500);
  const raw = await page.evaluate(key => localStorage.getItem(key), KEY);
  const check = readMark(raw, mark);
  if (!check.ok) return { ok: false, why: 'mark lost after 2.5 seconds: ' + check.why };
  return { ok: true, page };
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function preservationDiff(before, after, at = '$') {
  const losses = [];
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) return [`${at}: collection became ${typeof after}`];
    if (after.length < before.length) losses.push(`${at}: collection shrank ${before.length}->${after.length}`);
    const available = after.map(stable);
    for (const member of before) {
      if (!available.includes(stable(member))) losses.push(`${at}: collection member lost ${stable(member).slice(0, 120)}`);
    }
    return losses;
  }
  if (before && typeof before === 'object') {
    if (!after || typeof after !== 'object' || Array.isArray(after)) return [`${at}: object replaced`];
    for (const key of Object.keys(before)) {
      if (!Object.prototype.hasOwnProperty.call(after, key)) losses.push(`${at}.${key}: key absent`);
      else losses.push(...preservationDiff(before[key], after[key], `${at}.${key}`));
    }
    return losses;
  }
  if (before === null || before === undefined) return losses;
  if (typeof before !== typeof after) return [`${at}: scalar type ${typeof before}->${typeof after}`];
  if (typeof before === 'string' && before !== '' && after === '') losses.push(`${at}: scalar reset to empty string`);
  if (typeof before === 'number' && before !== 0 && (after === 0 || !Number.isFinite(after))) losses.push(`${at}: scalar reset to ${after}`);
  if (typeof before === 'boolean' && before === true && after === false) losses.push(`${at}: scalar reset to false`);
  return losses;
}

async function preservationArm(fixture, candidate, dropOwnSave) {
  const mark = {
    name: 'Robin', house: 'Ember', xp: 340, housePoints: 90,
    badge: 'first-lap', receiptId: 'gate-' + Math.random().toString(36).slice(2, 12),
  };
  const context = await fixture.browser.newContext();
  await context.addInitScript(SPY);
  try {
    const seed = await seedPassport(fixture, context, mark);
    if (!seed.ok) return { invalid: seed.why };
    const page = seed.page;
    if (dropOwnSave) {
      const own = OWN_SAVE[guessId(candidate)];
      if (own) await page.evaluate(key => localStorage.removeItem(key), own);
    }
    const beforeRaw = await page.evaluate(key => localStorage.getItem(key), KEY);
    const beforeCheck = readMark(beforeRaw, mark);
    if (!beforeCheck.ok) return { invalid: 'mark lost immediately before candidate boot: ' + beforeCheck.why };
    fixture.serve = candidate;
    await page.goto(fixture.url('arm=preservation'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(WAIT_MS);
    const observed = await page.evaluate(key => ({
      raw: localStorage.getItem(key), writes: window.__passportWrites || [],
      reads: window.__passportReads || 0,
    }), KEY);
    return {
      before: beforeCheck.passport,
      after: parseRecord(observed.raw),
      afterMark: readMark(observed.raw, mark),
      writes: observed.writes,
      reads: observed.reads,
    };
  } finally { await context.close(); }
}

async function corruptArm(fixture, candidate) {
  const mark = {
    name: 'Robin', house: 'Ember', xp: 341, housePoints: 91,
    badge: 'corrupt-control', receiptId: 'gate-corrupt-' + Math.random().toString(36).slice(2, 10),
  };
  const context = await fixture.browser.newContext();
  await context.addInitScript(SPY);
  try {
    const seed = await seedPassport(fixture, context, mark);
    if (!seed.ok) return { invalid: seed.why };
    const page = seed.page;
    const armed = await page.evaluate(([key, backup, raw]) => {
      localStorage.removeItem(backup);
      localStorage.setItem(key, raw);
      return localStorage.getItem(key) === raw && localStorage.getItem(backup) === null;
    }, [KEY, BACKUP, CORRUPT_RAW]);
    if (!armed) return { invalid: 'corrupt seed did not arm byte-for-byte' };
    fixture.serve = candidate;
    await page.goto(fixture.url('arm=corrupt'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(WAIT_MS);
    return await page.evaluate(([key, backup]) => ({
      raw: localStorage.getItem(key), backup: localStorage.getItem(backup),
      reads: window.__passportReads || 0, parses: window.__corruptParses || 0,
    }), [KEY, BACKUP]);
  } finally { await context.close(); }
}

async function freshArm(fixture, candidate, number) {
  const context = await fixture.browser.newContext();
  await context.addInitScript(SPY);
  try {
    const page = await context.newPage();
    fixture.serve = candidate;
    await page.goto(fixture.url(`arm=fresh-${number}`), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(WAIT_MS);
    return await page.evaluate(key => {
      const found = [];
      const add = (node, source) => {
        if (typeof node === 'string' && /^mbm-[A-Za-z0-9_-]{8,80}$/.test(node)) found.push({ node, source });
      };
      const walk = (value, source, depth = 0) => {
        if (!value || typeof value !== 'object' || depth > 4) return;
        add(value.nodeId, source + '.nodeId');
        for (const [name, child] of Object.entries(value)) walk(child, source + '.' + name, depth + 1);
      };
      try { walk(JSON.parse(localStorage.getItem(key)), 'localStorage.' + key); } catch {}
      for (const name of ['Passport', 'passport', 'sportsPassportDTO', 'state', 'State']) {
        try { walk(window[name], 'window.' + name); } catch {}
      }
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index);
        try { walk(JSON.parse(localStorage.getItem(storageKey)), 'localStorage.' + storageKey); } catch {}
      }
      const unique = [];
      for (const entry of found) if (!unique.some(item => item.node === entry.node)) unique.push(entry);
      return { nodes: unique };
    }, KEY);
  } finally { await context.close(); }
}

function c1For(arm) {
  if (!arm.writes.length) return { ok: true, detail: 'no boot write; green by vacuity' };
  if (!arm.after) return { ok: false, detail: 'boot write left no parseable passport' };
  const losses = preservationDiff(arm.before, arm.after);
  if (!arm.afterMark.ok) losses.push('deployed-runtime mark: ' + arm.afterMark.why);
  return losses.length
    ? { ok: false, detail: losses.slice(0, 5).join('; ') }
    : { ok: true, detail: `${arm.writes.length} boot write(s); value preserved` };
}

function c2For(arm) {
  if (arm.parses === 0) return { ok: true, detail: `no parse of the corrupt seed; green by vacuity (reads=${arm.reads})` };
  return arm.backup === CORRUPT_RAW
    ? { ok: true, detail: `corrupt seed parsed ${arm.parses} time(s); exact backup present` }
    : { ok: false, detail: `corrupt seed parsed ${arm.parses} time(s); exact backup absent` };
}

function clauses(present, absent, corrupt, freshA, freshB) {
  const c1Present = c1For(present);
  const c1Absent = c1For(absent);
  const c1 = c1Present.ok && c1Absent.ok
    ? { ok: true, detail: `own-save present: ${c1Present.detail}; own-save absent: ${c1Absent.detail}` }
    : { ok: false, detail: `own-save present: ${c1Present.detail}; own-save absent: ${c1Absent.detail}` };
  const first = freshA.nodes[0] || null;
  const second = freshB.nodes[0] || null;
  let c5;
  if (!first || !second) c5 = { ok: false, detail: `fresh node unreadable (first=${first?.node || 'none'}, second=${second?.node || 'none'})` };
  else if (first.node === BANNED_NODE || second.node === BANNED_NODE) c5 = { ok: false, detail: `banned node observed (${first.node}, ${second.node})` };
  else if (first.node === second.node) c5 = { ok: false, detail: `two independent installs shared ${first.node}` };
  else c5 = { ok: true, detail: `${first.node} != ${second.node} (${first.source}; ${second.source})` };
  const after = present.after;
  const beforeLamport = present.before?.lamport;
  const afterLamport = after?.lamport;
  return {
    C1: c1,
    C2: c2For(corrupt),
    C3: { ok: true, detail: 'carried report-only assertion: frozen GAME_IDS remains a schema proposal' },
    C4: after?.seasonId === 'v4-season-one'
      ? { ok: true, detail: "seasonId stamped 'v4-season-one'" }
      : { ok: false, detail: `seasonId is ${JSON.stringify(after?.seasonId)}` },
    C5: c5,
    C6: typeof beforeLamport === 'number' && typeof afterLamport === 'number' && afterLamport >= beforeLamport
      ? { ok: true, detail: `${beforeLamport}->${afterLamport}` }
      : { ok: false, detail: `${beforeLamport}->${afterLamport}` },
  };
}

async function verify(fixture, candidate) {
  const present = await preservationArm(fixture, candidate, false);
  if (present.invalid) return { invalid: present.invalid };
  const absent = await preservationArm(fixture, candidate, true);
  if (absent.invalid) return { invalid: absent.invalid };
  const corrupt = await corruptArm(fixture, candidate);
  if (corrupt.invalid) return { invalid: corrupt.invalid };
  const freshA = await freshArm(fixture, candidate, 1);
  const freshB = await freshArm(fixture, candidate, 2);
  const measured = clauses(present, absent, corrupt, freshA, freshB);
  return {
    clauses: measured, present, absent, corrupt, freshA, freshB,
    failed: Object.keys(measured).filter(name => !measured[name].ok),
  };
}

function mutateOnce(source, needle, replacement, name) {
  if (!source.includes(needle)) throw new Error(`selftest fixture ${name} did not match its source needle`);
  return source.replace(needle, replacement);
}

async function selftest(fixture) {
  const curlPath = process.env.PASSPORT_GATE_REF;
  const freshPath = process.env.PASSPORT_GATE_FRESH_REF;
  if (!curlPath || !freshPath || !fs.existsSync(curlPath) || !fs.existsSync(freshPath)) {
    console.log('MEASUREMENT INVALID: PASSPORT_GATE_REF and PASSPORT_GATE_FRESH_REF must name existing builds');
    return false;
  }
  const curl = fs.readFileSync(curlPath, 'utf8');
  const fresh = fs.readFileSync(freshPath, 'utf8');
  const temporary = fs.mkdtempSync('/tmp/v6pgf-passport-');
  const make = (name, source) => {
    const file = path.join(temporary, name);
    fs.writeFileSync(file, source);
    return file;
  };
  try {
    const dropKey = make('control-c1-drop-key.html', mutateOnce(
      curl,
      '  var Passport=loadPassport();',
      "  var Passport=loadPassport();try{var __v6pgf=JSON.parse(localStorage.getItem(PASSPORT_KEY));delete __v6pgf.profile;safeSet(PASSPORT_KEY,JSON.stringify(__v6pgf));}catch(_){}",
      'C1 drop-key',
    ));
    const noBackup = make('control-c2-no-backup.html', mutateOnce(
      curl,
      "catch(error){safeSet(PASSPORT_KEY+'_corrupt_backup',raw);return Runtime.defaultPassport();}",
      'catch(error){return Runtime.defaultPassport();}',
      'C2 backup removal',
    ));
    const bannedNode = make('control-c5-banned-node.html', mutateOnce(
      fresh,
      'function makeNode(){',
      `function makeNode(){return '${BANNED_NODE}';`,
      'C5 banned node',
    ));
    const drop = await preservationArm(fixture, dropKey, false);
    const apexKick = await preservationArm(fixture, SEED_GAME, false);
    const removed = await corruptArm(fixture, noBackup);
    const curlClean = await corruptArm(fixture, curlPath);
    const freshCleanA = await freshArm(fixture, freshPath, 'control-clean-1');
    const freshCleanB = await freshArm(fixture, freshPath, 'control-clean-2');
    const bannedA = await freshArm(fixture, bannedNode, 'control-banned-1');
    const bannedB = await freshArm(fixture, bannedNode, 'control-banned-2');
    const cleanFirst = freshCleanA.nodes[0] || null;
    const cleanSecond = freshCleanB.nodes[0] || null;
    const bannedFirst = bannedA.nodes[0] || null;
    const bannedSecond = bannedB.nodes[0] || null;
    const cleanC5 = Boolean(cleanFirst && cleanSecond && cleanFirst.node !== BANNED_NODE
      && cleanSecond.node !== BANNED_NODE && cleanFirst.node !== cleanSecond.node);
    const bannedC5 = Boolean(bannedFirst && bannedSecond
      && (bannedFirst.node === BANNED_NODE || bannedSecond.node === BANNED_NODE
        || bannedFirst.node === bannedSecond.node));
    const outcomes = [
      ['control 1 C1 drop one key', !drop.invalid && c1For(drop).ok === false, drop.invalid || c1For(drop).detail],
      ['control 2 C1 inverse apexkick', !apexKick.invalid && c1For(apexKick).ok === true, apexKick.invalid || c1For(apexKick).detail],
      ['control 3 C2 remove backup', !removed.invalid && c2For(removed).ok === false, removed.invalid || c2For(removed).detail],
      ['control 4 C2 inverse Apex Curl', !curlClean.invalid && c2For(curlClean).ok === true, curlClean.invalid || c2For(curlClean).detail],
      ['control 5 C5 hard-coded node', cleanC5 && bannedC5, `clean=${cleanFirst?.node || 'none'} != ${cleanSecond?.node || 'none'}; planted=${bannedFirst?.node || 'none'},${bannedSecond?.node || 'none'}`],
      ['control 6 corrupt seed read', !curlClean.invalid && curlClean.reads > 0 && curlClean.parses > 0, curlClean.invalid || `reads=${curlClean?.reads}, parses=${curlClean?.parses}`],
    ];
    for (const [name, ok, detail] of outcomes) console.log(`${name}: ${ok ? 'EXPECTED' : 'FAILED'} (${detail})`);
    console.log(`controls: ${outcomes.filter(item => item[1]).length}/6 expected outcomes`);
    return outcomes.every(item => item[1]);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

const arguments_ = process.argv.slice(2);
const wantSelftest = arguments_.includes('--selftest');
const targets = arguments_.filter(value => !value.startsWith('--'));
const files = [];
for (const target of targets) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target).sort()) if (name.endsWith('.html')) files.push(path.join(target, name));
  } else files.push(target);
}

const fixture = new Fixture();
let exitCode = 0;
await fixture.start();
try {
  if (wantSelftest && !(await selftest(fixture))) exitCode = 1;
  for (const file of files) {
    const result = await verify(fixture, file);
    console.log(`build: ${labelFor(file)}`);
    console.log(`source: ${file.includes('v6_recovered') ? 'upload' : 'deployed'}`);
    if (result.invalid) {
      console.log(`measurement: MEASUREMENT INVALID (${result.invalid})`);
      console.log('verdict: HOLD:MEASUREMENT_INVALID');
      exitCode = 1;
      continue;
    }
    for (const name of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
      const clause = result.clauses[name];
      console.log(`${name}: ${clause.ok ? 'GREEN' : 'RED'} (${clause.detail})`);
    }
    console.log(`verdict: ${result.failed.length ? 'HOLD:' + result.failed.join(',') : 'SHIP'}`);
    if (result.failed.length) exitCode = 1;
  }
} finally { await fixture.stop(); }
process.exitCode = exitCode;
