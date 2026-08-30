#!/usr/bin/env node
/**
 * verify_sports_passport_contract.mjs — the gate for docs/CONTRACT_sports_passport_v4.md
 *
 * mbm_sports_passport_v4 is a SHARED cross-game key carrying a child's name,
 * house, XP, badges and per-game summaries. Four deployed games write it. Three
 * of seven V6 candidates were observed resetting it. This gate is the rule they
 * are tested against.
 *
 * THE METHOD IS THE FINDING. An earlier probe seeded the passport with a
 * synthetic record and reported a clobber; the record was under-populated, so
 * "reset" and "rejected as unreadable" were indistinguishable, and the reading
 * was struck. The rule that replaced it is binding here:
 *
 *     A passport arm may only be seeded from a record written by a deployed
 *     writer, and marked through the runtime's own mutation API.
 *
 * So every arm:
 *   1. boots the DEPLOYED apexkick and lets it write the passport itself;
 *   2. marks it with MadeByMattV4Runtime.mutations.mutateProfile / grantAward,
 *      never by hand-shaping CRDT registers;
 *   3. re-reads the mark at 2.5s and again immediately before navigation, and
 *      aborts MEASUREMENT INVALID rather than reporting if either differs;
 *   4. boots the candidate in that same origin;
 *   5. runs twice — with the candidate's own local save present and deleted —
 *      so a rebuild conditional on the build's own state is ruled out.
 *
 * Usage:
 *   node tools/verify_sports_passport_contract.mjs [--selftest] [file|dir ...]
 *   --selftest runs the three firing controls and exits non-zero unless all red.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'mbm_sports_passport_v4';
const BACKUP = KEY + '_corrupt_backup';
const BANNED_NODE = 'mbm-default00000000';
const SEED_GAME = path.join(ROOT, 'apexkick', 'index.html');
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const PORT = Number(process.env.PASSPORT_GATE_PORT || 4460);

/* The candidate's own local save, deleted in the second arm so that a rebuild
 * conditional on the build's own state cannot be mistaken for a clobber. */
const OWN_SAVE = {
  'apex-velodrome': 'mbm_apex_velodrome_v4', 'apex-curl': 'mbm_apex_curl_v4',
  'neon-turf': 'mbm_neon_turf_v4', 'marble': 'mbm_marble_v4',
  'grapple': 'mbm_grapple_v4', 'wrecking-crew': 'mbm_wrecking_crew_v4',
  'medevac': 'mbm_medevac_v4', 'apex-kick': 'apexkick.aaa.v4',
  'aurora-links': 'mbm_aurora_links_aaa_v4', 'house-olympiad': 'mbm_house_olympiad_v4_settings',
  'olympics': 'mbm_global_games_world_stage_v4',
};

function guessId(file) {
  const b = path.basename(file).toLowerCase();
  for (const id of Object.keys(OWN_SAVE)) if (b.includes(id.replace(/-/g, '_')) || b.includes(id.replace(/-/g, ''))) return id;
  const dir = path.basename(path.dirname(file));
  const byDir = { apexkick: 'apex-kick', auroralinks: 'aurora-links', houseolympiad: 'house-olympiad',
                  olympics: 'olympics', apexcurl: 'apex-curl', apexvelodrome: 'apex-velodrome',
                  neonturf: 'neon-turf', medevac: 'medevac' };
  return byDir[dir] || null;
}

class Fixture {
  constructor() { this.serve = SEED_GAME; }
  async start() {
    this.server = http.createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(this.serve));
    });
    await new Promise(r => this.server.listen(PORT, r));
    this.browser = await chromium.launch({ headless: true, executablePath: CHROME,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  }
  async stop() { if (this.browser) await this.browser.close(); if (this.server) this.server.close(); }
  url(q) { return `http://127.0.0.1:${PORT}/${q ? '?' + q : ''}`; }
}

/* Records every write to the passport key, with a stack, and whether any user
 * gesture had happened yet. This is what makes C1 a measurement rather than an
 * inference from reading the source. */
const WRITE_SPY = `
  (function () {
    window.__passportWrites = [];
    window.__gestured = false;
    for (const type of ['pointerdown','keydown','click','touchstart'])
      window.addEventListener(type, () => { window.__gestured = true; }, true);
    window.__passportReads = 0;
    const proto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
    const getItem = proto.getItem;
    proto.getItem = function (k) {
      if (k === '${KEY}') window.__passportReads++;
      return getItem.apply(this, arguments);
    };
    const setItem = proto.setItem;
    proto.setItem = function (k, v) {
      if (k === '${KEY}') window.__passportWrites.push({
        gestured: window.__gestured, value: String(v),
        stack: (new Error().stack || '').split('\\n').slice(1, 4).join(' | ') });
      return setItem.apply(this, arguments);
    };
  })();
`;

async function seedPassport(fix, ctx, mark) {
  const page = await ctx.newPage();
  fix.serve = SEED_GAME;
  await page.goto(fix.url(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.MadeByMattV4Runtime, null, { timeout: 30000 });
  await page.waitForTimeout(4000);
  const wrote = await page.evaluate(k => localStorage.getItem(k), KEY);
  if (!wrote) return { ok: false, why: 'the deployed seed game wrote no passport' };

  /* Mark through the runtime's own mutations. Never hand-shape a CRDT register:
   * that is exactly the failure the struck reading made. */
  const marked = await page.evaluate(([k, m]) => {
    const R = window.MadeByMattV4Runtime;
    try {
      let p = R.normalizePassport(JSON.parse(localStorage.getItem(k)));
      p = R.mutations.mutateProfile(p, { name: m.name, house: m.house });
      p = R.mutations.grantAward(p, { receiptId: m.receiptId, game: 'apex-kick',
                                      xp: m.xp, housePoints: m.housePoints, badge: m.badge });
      localStorage.setItem(k, JSON.stringify(p));
      return { ok: true, node: p.nodeId, lamport: p.lamport };
    } catch (error) { return { ok: false, why: 'runtime mutation refused: ' + error.message }; }
  }, [KEY, mark]);
  if (!marked.ok) return marked;

  /* Deferred-write control: the seed must still be there at 2.5s, and again
   * immediately before the candidate is navigated to. */
  await page.waitForTimeout(2500);
  const at2500 = await page.evaluate(k => localStorage.getItem(k), KEY);
  const check = readMark(at2500, mark);
  if (!check.ok) return { ok: false, why: 'seed lost 2.5s after writing (deferred write): ' + check.why };
  return { ok: true, page, node: marked.node, lamport: marked.lamport, raw: at2500 };
}

function readMark(raw, mark) {
  if (!raw) return { ok: false, why: 'passport absent' };
  let p; try { p = JSON.parse(raw); } catch { return { ok: false, why: 'passport unparseable' }; }
  const name = p.profile && p.profile.name && p.profile.name.value;
  const house = p.profile && p.profile.house && p.profile.house.value;
  const xp = JSON.stringify((p.counters && p.counters.xp) || []);
  /* Badge adds are [tag, {id, clock, node}] — the badge TEXT is pair[1].id, and
   * the tag is derived from node and clock. Reading pair[0] finds a generated
   * tag and never the badge, which is how the first version of this predicate
   * aborted every arm as a lost seed. */
  const badges = JSON.stringify(((p.sets && p.sets.badges && p.sets.badges.adds) || []).map(x => x[1] && x[1].id));
  const receipts = JSON.stringify(((p.receipts) || []).map(x => x[0]));
  const missing = [];
  if (name !== mark.name) missing.push(`name ${JSON.stringify(name)} != ${JSON.stringify(mark.name)}`);
  if (house !== mark.house) missing.push(`house ${JSON.stringify(house)} != ${JSON.stringify(mark.house)}`);
  if (!xp.includes(String(mark.xp))) missing.push(`xp ${xp} lost ${mark.xp}`);
  if (!badges.includes(mark.badge)) missing.push(`badges ${badges} lost ${mark.badge}`);
  if (!receipts.includes(mark.receiptId)) missing.push(`receipts ${receipts} lost ${mark.receiptId}`);
  return missing.length ? { ok: false, why: missing.join('; '), passport: p } : { ok: true, passport: p };
}

/* C5's substance is only reachable on a FRESH install. Every other arm seeds a
 * passport first, and normalizePassport then keeps the seed's node id — so a
 * build that calls defaultPassport() with no argument, and would hand every new
 * child the same placeholder identity, looks fine in all of them. This arm boots
 * the candidate into an empty origin and reads the id it invents. */
async function runFreshArm(fix, candidate) {
  const ctx = await fix.browser.newContext();
  await ctx.addInitScript(WRITE_SPY);
  try {
    const page = await ctx.newPage();
    fix.serve = candidate;
    await page.goto(fix.url('fresh=1'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6500);
    const raw = await page.evaluate(k => localStorage.getItem(k), KEY);
    if (!raw) return { wrote: false };
    let node = null; try { node = JSON.parse(raw).nodeId; } catch {}
    return { wrote: true, node };
  } finally { await ctx.close(); }
}

async function runArm(fix, candidate, { dropOwnSave, corrupt }) {
  const mark = { name: 'Robin', house: 'Ember', xp: 340, housePoints: 90,
                 badge: 'first-lap', receiptId: 'gate-' + Math.random().toString(36).slice(2, 12) };
  const ctx = await fix.browser.newContext();
  await ctx.addInitScript(WRITE_SPY);
  try {
    const seed = await seedPassport(fix, ctx, mark);
    if (!seed.ok) return { invalid: seed.why };
    const page = seed.page;

    if (dropOwnSave) {
      const id = guessId(candidate);
      const own = id && OWN_SAVE[id];
      if (own) await page.evaluate(k => localStorage.removeItem(k), own);
    }
    if (corrupt) await page.evaluate(k => localStorage.setItem(k, '{not json'), KEY);

    /* Deferred-write control, second read: immediately before navigation. */
    if (!corrupt) {
      const pre = readMark(await page.evaluate(k => localStorage.getItem(k), KEY), mark);
      if (!pre.ok) return { invalid: 'seed lost immediately before navigation: ' + pre.why };
    }
    const before = corrupt ? null : readMark(await page.evaluate(k => localStorage.getItem(k), KEY), mark).passport;

    fix.serve = candidate;
    await page.evaluate(() => { window.__passportWrites = []; window.__passportReads = 0; window.__gestured = false; });
    await page.goto(fix.url('gate=1'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6500);

    const after = await page.evaluate(([k, b]) => ({
      raw: localStorage.getItem(k), backup: localStorage.getItem(b),
      writes: window.__passportWrites || [], reads: window.__passportReads || 0,
      keys: Object.keys(localStorage).sort(),
    }), [KEY, BACKUP]);
    return { mark, before, after, verdict: corrupt ? null : readMark(after.raw, mark) };
  } finally { await ctx.close(); }
}

function clauses(main, corruptArm, freshArm) {
  const out = {};
  const writes = main.after.writes || [];
  const ungestured = writes.filter(w => !w.gestured);

  /* C1 as ruled: any write reachable from load with no state change. */
  out.C1 = ungestured.length === 0
    ? { ok: true, detail: 'no write before any gesture' }
    : { ok: false, detail: `${ungestured.length} write(s) before any gesture` };

  /* C1' as proposed: an ungestured write is only a blocker if it REPLACES.
   * Measured, not inferred: does the mark survive the write it performed? */
  const survived = main.verdict && main.verdict.ok;
  out["C1'"] = ungestured.length === 0
    ? { ok: true, detail: 'no boot write at all' }
    : survived
      ? { ok: true, detail: `${ungestured.length} boot write(s), and the stored record survived them` }
      : { ok: false, detail: `boot write REPLACED the stored record — ${main.verdict.why}` };

  /* C2: a defaulting path backs the raw string up first.
   * The clause only binds a build that ACTUALLY DEFAULTS. A build that never
   * reads the passport leaves the corrupt record exactly where it was, and has
   * discarded nothing to back up; failing it for the absent backup is a false
   * red, and the first version of this did exactly that to Neon Turf, which
   * carries the key as a constant and never touches it. So the corrupt record
   * still being in place makes the clause inapplicable, not passed. */
  /* C2 is measured twice, because the clause admits two readings and they
   * disagree on two named builds. Reporting one and hiding the other would be
   * choosing for Matt, which is the same thing the C1/C1' split refuses to do.
   *
   *   C2a  DATA LOSS. Did the build REPLACE the child's stored record with
   *        something else and keep no copy? This is the only reading under
   *        which a child actually loses data. Neon Turf reads the passport at
   *        renderMenuStats to label a menu chip and falls back to a caption on
   *        failure — the corrupt record is still in storage afterwards, so
   *        nothing was lost and C2a does not bind.
   *
   *   C2b  CAUTION. Did the build READ a corrupt record, proceed without it,
   *        and keep no copy? Apex Curl defaults IN MEMORY and does not write,
   *        so C2a cannot see it either way — yet it takes the backup, which is
   *        the behaviour the contract cites as its reference.
   *
   * The first version of this gate asserted C2a and was given a firing control
   * shaped for C2b; the control greened, which is how the split was found. */
  const readIt = corruptArm.invalid ? null : corruptArm.after.reads > 0;
  const replaced = corruptArm.invalid ? null : corruptArm.after.raw !== '{not json';
  const kept = corruptArm.invalid ? null : corruptArm.after.backup === '{not json';
  out.C2a = corruptArm.invalid ? { ok: null, detail: 'arm invalid: ' + corruptArm.invalid }
    : !replaced ? { ok: null, detail: 'the corrupt record is still in storage — nothing was lost' }
    : kept ? { ok: true, detail: 'replaced the record and kept the raw string' }
    : { ok: false, detail: 'REPLACED the corrupt record and kept no copy' };
  out.C2b = corruptArm.invalid ? { ok: null, detail: 'arm invalid: ' + corruptArm.invalid }
    : !readIt ? { ok: null, detail: 'never reads the passport' }
    : kept ? { ok: true, detail: 'read a corrupt record and preserved it' }
    : { ok: false, detail: 'read a corrupt record and kept no copy' };

  /* C3: reported, never failed — no sibling implements it (contract C3). */
  out.C3 = { ok: null, detail: 'reported only: the frozen GAME_IDS list is a schema proposal, not a graft' };

  /* C4: seasonId is stamped, never read. */
  let season = null; try { season = JSON.parse(main.after.raw).seasonId; } catch {}
  out.C4 = season === 'v4-season-one'
    ? { ok: true, detail: "stamped 'v4-season-one'" }
    : { ok: false, detail: `seasonId is ${JSON.stringify(season)}` };

  /* C5: node id generated per install, never the banned literal. Judged on the
   * FRESH arm, because that is the only one where the build chooses an id
   * rather than inheriting the seed's. */
  let node = null; try { node = JSON.parse(main.after.raw).nodeId; } catch {}
  out.C5 = !freshArm || !freshArm.wrote
    ? { ok: null, detail: `writes no passport on a fresh install (with a seed present it carries ${node || 'none'})` }
    : freshArm.node === BANNED_NODE
      ? { ok: false, detail: `on a fresh install it writes the banned placeholder ${BANNED_NODE}` }
      : freshArm.node ? { ok: true, detail: `fresh install: ${freshArm.node}` }
      : { ok: false, detail: 'fresh install: a passport with no node id' };

  /* C6: lamport monotonicity across the boot. */
  let la = null; try { la = JSON.parse(main.after.raw).lamport; } catch {}
  const lb = main.before ? main.before.lamport : null;
  out.C6 = (typeof la === 'number' && typeof lb === 'number')
    ? (la >= lb ? { ok: true, detail: `${lb} -> ${la}` } : { ok: false, detail: `${lb} -> ${la} (lowered)` })
    : { ok: null, detail: 'lamport unreadable' };
  return out;
}

const ORDER = ['C1', "C1'", 'C2a', 'C2b', 'C3', 'C4', 'C5', 'C6'];
const cell = v => v.ok === true ? ' ok ' : v.ok === false ? 'FAIL' : ' -- ';

async function verify(fix, candidate, label) {
  const present = await runArm(fix, candidate, { dropOwnSave: false });
  if (present.invalid) return { label, invalid: present.invalid };
  const absent = await runArm(fix, candidate, { dropOwnSave: true });
  const corruptArm = await runArm(fix, candidate, { dropOwnSave: false, corrupt: true });
  const freshArm = await runFreshArm(fix, candidate);
  const c = clauses(present, corruptArm, freshArm);

  /* Own-record control: the two arms must agree. If they do not, the result is
   * conditional on the build's own state and is reported as such rather than
   * collapsed into one verdict. */
  const agree = absent.invalid ? null
    : (!!(present.verdict && present.verdict.ok)) === (!!(absent.verdict && absent.verdict.ok));
  return { label, clauses: c, present, absent, agree,
           failed: ORDER.filter(k => c[k].ok === false) };
}

/* ---- firing controls (V6-PG §3.2): each must red the gate ---------------- */
async function selftest(fix) {
  const CURL = process.env.PASSPORT_GATE_REF
    || '/root/.claude/uploads/91ad3d57-75e2-59b4-bc4e-e270eaffb188/707bed95-Apex_Curl_AAA_V6.html';
  if (!fs.existsSync(CURL)) { console.log('SELFTEST SKIPPED — no reference build at ' + CURL); return 1; }
  const src = fs.readFileSync(CURL, 'utf8');
  const tmp = fs.mkdtempSync('/tmp/passport-gate-');
  const mk = (name, body) => { const p = path.join(tmp, name); fs.writeFileSync(p, body); return p; };

  const A = mk('a-boot-write.html', src.replace(
    '  var Passport=loadPassport();',
    '  var Passport=loadPassport();safeSet(PASSPORT_KEY,JSON.stringify(Runtime.defaultPassport()));'));
  const B = mk('b-no-backup.html', src.replace(
    "catch(error){safeSet(PASSPORT_KEY+'_corrupt_backup',raw);return Runtime.defaultPassport();}",
    'catch(error){return Runtime.defaultPassport();}'));
  const C = mk('c-banned-node.html', src.replace(
    '  var Passport=loadPassport();',
    "  var Passport=loadPassport();Passport.nodeId='" + BANNED_NODE + "';safeSet(PASSPORT_KEY,JSON.stringify(Passport));"));

  let reds = 0;
  for (const [name, file, clause] of [['unconditional boot write', A, "C1'"],
                                      ['defaulting path with the backup removed', B, 'C2b'],
                                      ['the banned placeholder node id', C, 'C5']]) {
    const r = await verify(fix, file, name);
    const red = !r.invalid && r.clauses[clause].ok === false;
    console.log(`  ${red ? 'RED ' : 'GREEN'}  ${name.padEnd(42)} ${clause}: ${r.invalid || r.clauses[clause].detail}`);
    if (red) reds++;
  }
  console.log(`\n  ${reds}/3 firing controls red.`);
  return reds === 3 ? 0 : 1;
}

/* ---- main --------------------------------------------------------------- */
const argv = process.argv.slice(2);
const wantSelftest = argv.includes('--selftest');
const targets = argv.filter(a => !a.startsWith('--'));
const fix = new Fixture();
await fix.start();
let exit = 0;
try {
  if (wantSelftest) {
    console.log('Firing controls — each must red the gate:');
    exit = await selftest(fix);
    if (exit) console.log('\nMEASUREMENT INVALID: a firing control did not red. The table below cannot be trusted.');
    if (!targets.length) process.exit(exit);
    console.log('');
  }
  const files = [];
  for (const t of targets) {
    const st = fs.statSync(t);
    if (st.isDirectory()) for (const f of fs.readdirSync(t).sort()) { if (f.endsWith('.html')) files.push(path.join(t, f)); }
    else files.push(t);
  }
  console.log('build'.padEnd(26) + ORDER.map(c => c.padEnd(6)).join('') + 'verdict');
  console.log('-'.repeat(26 + ORDER.length * 6 + 8));
  const notes = [];
  for (const f of files) {
    /* A deployed game is <route>/index.html, so a basename label renders four
     * different games as "index". Name it by its directory in that case. */
    const base = path.basename(f);
    const label = base === 'index.html' ? path.basename(path.dirname(f))
      : base.replace(/^[0-9a-f]{6,}-/, '').replace(/(_AAA_V6)?\.html$/, '');
    const r = await verify(fix, f, label);
    if (r.invalid) { console.log(r.label.padEnd(26) + 'MEASUREMENT INVALID — ' + r.invalid); exit = 1; continue; }
    const verdict = r.failed.length ? 'FAIL ' + r.failed.join(',') : 'pass';
    console.log(r.label.slice(0, 25).padEnd(26) + ORDER.map(c => cell(r.clauses[c]).padEnd(6)).join('') + verdict);
    for (const c of ORDER) if (r.clauses[c].ok === false) notes.push(`  ${r.label} ${c}: ${r.clauses[c].detail}`);
    if (r.agree === false) notes.push(`  ${r.label}: the own-record arms DISAGREE — the outcome is conditional on the build's own save`);
    if (r.agree === null) notes.push(`  ${r.label}: own-record control invalid — ${r.absent.invalid}`);
    if (r.failed.length) exit = 1;
  }
  if (notes.length) { console.log('\ndetail:'); for (const n of notes) console.log(n); }
} finally { await fix.stop(); }
process.exit(exit);
