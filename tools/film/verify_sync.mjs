/* Proves the sync engine, in a real browser, against a MEMORY transport.
 *
 * Stated rather than buried: a green run here is NOT evidence that Matt's
 * Supabase project works. It is evidence that the crypto, the merge and the
 * gate are correct. The backend claim is settled by MBMSync.verify() against
 * the live project, which is exactly why that function exists and why
 * MBM_CAPS["cloud-sync"] is set from a round-trip and never from config.
 *
 * The hard cases are the ones that matter: the merge must never silently eat
 * work, and a wrong code must fail closed rather than returning nonsense.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const base = process.argv[2];
const b = await chromium.launch();
const fails = [];
const ck = (n, ok, got) => { if (!ok) fails.push(n);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + n + (ok ? '' : '   got: ' + JSON.stringify(got))); };

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const external = [];
await ctx.route('**/*', r => {
  const u = r.request().url();
  if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
  external.push(u); return r.abort();
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await p.goto(base + '/members/', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const R = await p.evaluate(async () => {
  const S = window.MBMSync;
  if (!S) return { err: 'MBMSync missing' };
  const out = {};

  out.available = S.available();

  /* --- the code ------------------------------------------------------- */
  const codes = Array.from({ length: 400 }, () => S.newCode());
  out.words = codes[0].split('-').length;
  out.unique = new Set(codes).size;
  out.listSize = S._internals.WORDS.length;
  out.entropyBits = Math.log2(out.listSize) * out.words;
  out.normalises = S.normalise('  Able-ACID  Aged ') === 'able-acid-aged';

  /* --- id and key are independent ------------------------------------- */
  const code = S.newCode();
  const id = await S._internals.deriveId(code);
  out.idShape = /^[0-9a-f]{64}$/.test(id);
  const id2 = await S._internals.deriveId(code);
  out.idStable = id === id2;
  const otherId = await S._internals.deriveId(S.newCode());
  out.idDiffers = id !== otherId;

  /* --- round trip through the memory transport ------------------------ */
  const t = S.memoryTransport();
  S.useTransport(t);
  localStorage.clear();
  localStorage.setItem('apexkick.v1', JSON.stringify({ goals: 10, coins: 5, cards: ['a'] }));
  localStorage.setItem('voxelfrontier.world.v2.111', 'WORLD-A');
  localStorage.setItem('uas_register', 'PUPIL NAMES AND MARKS');   // must never travel
  localStorage.setItem('mbm_users', 'ACCOUNT HASHES');             // must never travel
  localStorage.setItem('unrelated.key', 'ignore me');

  const pushed = await S.push(code);
  out.pushedKeys = pushed.keys;

  /* what is ACTUALLY on the wire */
  const stored = Object.values(t._store)[0].blob;
  out.blobIsOpaque = !/PUPIL|MARKS|WORLD-A|goals|ACCOUNT/i.test(stored);
  out.blobHasIvAndCt = stored.split('.').length === 2;

  /* --- the register must not be syncable ------------------------------ */
  const collected = S._internals.collect();
  out.collectedKeys = Object.keys(collected).sort();

  /* --- pull onto a "second device" ------------------------------------ */
  localStorage.clear();
  localStorage.setItem('voxelfrontier.world.v2.222', 'WORLD-B');   // built only here
  localStorage.setItem('apexkick.v1', JSON.stringify({ goals: 3, coins: 99, cards: ['b'] }));
  const pulled = await S.pull(code);
  out.pulledFound = pulled.found;
  out.worldA = localStorage.getItem('voxelfrontier.world.v2.111');
  out.worldB = localStorage.getItem('voxelfrontier.world.v2.222');
  out.apexAfter = JSON.parse(localStorage.getItem('apexkick.v1'));
  out.registerAfter = localStorage.getItem('uas_register');

  /* --- a wrong code must fail closed ---------------------------------- */
  try { await S.pull(S.newCode()); out.wrongCode = 'no-row'; }
  catch (e) { out.wrongCode = 'threw:' + e.message.slice(0, 40); }
  /* a code that maps to an existing row but a different key cannot happen by
     construction, so force it: same id, wrong key */
  const evil = S.newCode();
  const evilId = await S._internals.deriveId(evil);
  t._store[evilId] = { blob: stored, t: new Date().toISOString() };
  try { await S.pull(evil); out.wrongKey = 'DECRYPTED-WHICH-IS-WRONG'; }
  catch (e) { out.wrongKey = 'threw'; out.wrongKeyMsg = e.message.slice(0, 70); }

  /* --- conflict keeps the loser --------------------------------------- */
  localStorage.clear();
  localStorage.setItem('voxelfrontier.world.v2.111', 'LOCAL-VERSION');
  const conf = await S.pull(code);
  out.conflicts = conf.conflicts;
  out.conflictKept = !!localStorage.getItem('voxelfrontier.world.v2.111.conflict');
  out.conflictPair = [localStorage.getItem('voxelfrontier.world.v2.111'),
                      localStorage.getItem('voxelfrontier.world.v2.111.conflict')].sort();

  /* --- the gate -------------------------------------------------------- */
  /* mbm-features.js is not loaded on this page, so the register may not exist
     yet. That is the normal state on a game page too, and mbm-sync.js creates
     it when it needs to — so the test must not assume it is already there. */
  window.MBM_CAPS = window.MBM_CAPS || {};
  delete window.MBM_CAPS['cloud-sync'];
  out.capBefore = !!(window.MBM_CAPS && window.MBM_CAPS['cloud-sync']);
  /* Count rows BEFORE, because this test has deliberately injected an extra
     row of its own further up. The claim is "verify leaves no probe row
     behind", which is a DELTA of zero — not an absolute count. Asserting the
     absolute was wrong and reported a clean run as a failure. */
  out.rowsBeforeVerify = Object.keys(t._store).length;
  const v = await S.verify();
  out.verifyOk = v.ok;
  out.capAfter = !!(window.MBM_CAPS && window.MBM_CAPS['cloud-sync']);
  out.rowsAfterVerify = Object.keys(t._store).length;

  /* gate must FAIL, and must not set the cap, when the backend is broken */
  window.MBM_CAPS = window.MBM_CAPS || {};
  delete window.MBM_CAPS['cloud-sync'];
  S.useTransport({ name: 'broken', get: () => Promise.reject(new Error('down')),
                   put: () => Promise.reject(new Error('down')), del: () => Promise.resolve() });
  const v2 = await S.verify();
  out.verifyBroken = v2.ok;
  out.capAfterBroken = !!(window.MBM_CAPS && window.MBM_CAPS['cloud-sync']);

  return out;
});

await ctx.close();
await b.close();

if (R.err) { console.log('FATAL: ' + R.err); process.exit(1); }

console.log('SYNC ENGINE — real browser, MEMORY transport (not a real backend)\n');
console.log('THE CODE');
console.log(`  ${R.words} words from a ${R.listSize}-word list = ${R.entropyBits.toFixed(1)} bits`);
ck('code carries > 70 bits of entropy', R.entropyBits > 70, R.entropyBits.toFixed(1));
ck('400 generated codes are all distinct', R.unique === 400, R.unique);
ck('codes normalise (case, spacing, punctuation)', R.normalises === true);
ck('WebCrypto available', R.available === true);

console.log('\nID AND KEY ARE INDEPENDENT');
ck('row id is 64 hex chars', R.idShape === true);
ck('same code -> same id', R.idStable === true);
ck('different code -> different id', R.idDiffers === true);

console.log('\nWHAT ACTUALLY GOES ON THE WIRE');
console.log('  keys collected for sync: ' + JSON.stringify(R.collectedKeys));
ck('blob is opaque — no plaintext leaks through', R.blobIsOpaque === true);
ck('blob is iv.ciphertext', R.blobHasIvAndCt === true);
ck('uas_register (real pupil data) is NEVER collected', !R.collectedKeys.includes('uas_register'), R.collectedKeys);
ck('mbm_users (account hashes) is NEVER collected', !R.collectedKeys.includes('mbm_users'), R.collectedKeys);
ck('unrelated keys are not swept up', !R.collectedKeys.includes('unrelated.key'), R.collectedKeys);
ck('only the two game prefixes travel', R.collectedKeys.every(k => k.startsWith('apexkick.v1') || k.startsWith('voxelfrontier.')), R.collectedKeys);

console.log('\nMERGE MUST NOT EAT WORK');
console.log('  apex after merge: ' + JSON.stringify(R.apexAfter));
ck('pull found the row', R.pulledFound === true);
ck('world made on device A arrives on B', R.worldA === 'WORLD-A', R.worldA);
ck('world made only on B SURVIVES the pull', R.worldB === 'WORLD-B', R.worldB);
ck('apex goals take the max (10 vs 3)', R.apexAfter.goals === 10, R.apexAfter.goals);
ck('apex coins take the max (5 vs 99)', R.apexAfter.coins === 99, R.apexAfter.coins);
ck('apex cards are unioned', JSON.stringify(R.apexAfter.cards.sort()) === '["a","b"]', R.apexAfter.cards);
ck('uas_register is not written by a pull', R.registerAfter === null, R.registerAfter);

console.log('\nCONFLICT');
console.log('  conflicting key kept both: ' + JSON.stringify(R.conflictPair));
ck('conflict is reported, not silent', R.conflicts.length === 1, R.conflicts);
ck('the losing version is KEPT under .conflict', R.conflictKept === true);
ck('both versions still exist', R.conflictPair.includes('LOCAL-VERSION') && R.conflictPair.includes('WORLD-A'), R.conflictPair);

console.log('\nWRONG CODE FAILS CLOSED');
ck('unknown code returns no row rather than throwing junk', R.wrongCode === 'no-row', R.wrongCode);
ck('right id + wrong key REFUSES to decrypt', R.wrongKey === 'threw', R.wrongKey);
ck('and says it is probably a typo, not an outage', /code did not unlock/i.test(R.wrongKeyMsg || ''), R.wrongKeyMsg);

console.log('\nTHE GATE');
ck('capability absent before verify', R.capBefore === false);
ck('verify() passes a real round-trip', R.verifyOk === true);
ck('capability set ONLY after that round-trip', R.capAfter === true);
ck('verify leaves NO probe row behind (delta 0)', R.rowsAfterVerify === R.rowsBeforeVerify,
   R.rowsBeforeVerify + ' -> ' + R.rowsAfterVerify);
ck('verify() FAILS against a broken backend', R.verifyBroken === false);
ck('and does NOT set the capability when it fails', R.capAfterBroken === false);

console.log('\nHYGIENE');
ck('0 external requests during the whole run', external.length === 0, external.slice(0, 2));
ck('0 page errors', errs.length === 0, errs);

console.log('');
console.log(fails.length === 0 ? 'RESULT: PASS — ' + '  (memory transport; the live backend is proven by MBMSync.verify)'
                               : 'RESULT: FAIL — ' + fails.length);
process.exit(fails.length ? 1 : 0);
