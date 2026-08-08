#!/usr/bin/env node
/* P2 — self-service deletion actually erases.
 *
 * Run (VICTIM is destroyed — use a throwaway QA identity, never a real one):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=sb_publishable_... \
 *   QA_DEL_EMAIL=... QA_DEL_PASSWORD=... \
 *   QA_WITNESS_EMAIL=... QA_WITNESS_PASSWORD=... \
 *   [ORIGIN=https://madebymatt.uk] \
 *   node tools/proofs/p2_erasure.mjs
 *
 * WHY A WITNESS: after deletion the victim has no session, so the victim
 * cannot prove its own rows are gone — every read would fail for the trivial
 * reason that there is nobody to read as. The witness is a second live session
 * that confirms the rows are absent AND that its own row is still present.
 * Without that second half, "absent" could just mean the database is down.
 *
 * WHAT THIS CANNOT PROVE FROM OUTSIDE: that no orphan row survives in a table
 * this script was never told about. Pair it with the census in
 * enumerate_anon_surface.sql (query 9) run before and after.
 */

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || '';
const ORIGIN = process.env.ORIGIN || 'https://madebymatt.uk';
const V = { email: process.env.QA_DEL_EMAIL, password: process.env.QA_DEL_PASSWORD };
const W = { email: process.env.QA_WITNESS_EMAIL, password: process.env.QA_WITNESS_PASSWORD };

function die(m) { console.error('FATAL: ' + m); process.exit(2); }
if (!URL_ || !KEY) die('SUPABASE_URL and SUPABASE_ANON_KEY are required.');
if (!V.email || !V.password || !W.email || !W.password) die('QA_DEL_* and QA_WITNESS_* are required.');
if (/^sb_secret_/i.test(KEY)) die('Refusing to run under a secret key.');

const steps = [];
const step = (name, expected, ok, detail) => {
  steps.push({ name, expected, outcome: ok ? 'PASS' : 'FAIL', detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} ${detail}`);
};

const H = t => ({ apikey: KEY, Authorization: `Bearer ${t || KEY}`, 'Content-Type': 'application/json' });

async function login(u) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(u)
  });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => ({})) };
}
const rows = async (tab, col, id, tok) => {
  const r = await fetch(`${URL_}/rest/v1/${tab}?select=${col}&${col}=eq.${id}`, { headers: H(tok) });
  const j = await r.json().catch(() => []);
  return { status: r.status, n: Array.isArray(j) ? j.length : -1 };
};

async function run() {
  const vs = await login(V); if (!vs.ok) die(`victim login failed: ${vs.status}`);
  const ws = await login(W); if (!ws.ok) die(`witness login failed: ${ws.status}`);
  const vTok = vs.json.access_token, vId = vs.json.user.id;
  const wTok = ws.json.access_token, wId = ws.json.user.id;
  if (vId === wId) die('victim and witness are the same user.');
  console.log(`victim=${vId}  witness=${wId}\n`);

  // Pre-condition: the rows exist, so "gone" later is a real change of state.
  const pP = await rows('profiles', 'id', vId, vTok);
  const pM = await rows('member_data', 'user_id', vId, vTok);
  step('pre: victim profile row exists', '1 row', pP.n === 1, `rows=${pP.n}`);
  step('pre: victim member_data row exists', '1 row', pM.n === 1, `rows=${pM.n}`);

  // 2.1 — A must not be able to delete B by naming B. The function takes no
  // id, so forging one must be inert; assert the witness survives it.
  const forge = await fetch(`${URL_}/functions/v1/delete-account`, {
    method: 'POST', headers: { ...H(vTok), Origin: ORIGIN },
    body: JSON.stringify({ confirm: true, user_id: wId, id: wId, email: W.email })
  });
  const wAlive = await rows('profiles', 'id', wId, wTok);
  step('forged-id delete does not touch the witness', 'witness row intact', wAlive.n === 1,
    `HTTP ${forge.status}, witness rows=${wAlive.n}`);

  // Unauthenticated / missing-confirm must be refused.
  const noAuth = await fetch(`${URL_}/functions/v1/delete-account`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ confirm: true })
  });
  step('delete without a user JWT is refused', '401/403', noAuth.status === 401 || noAuth.status === 403, `HTTP ${noAuth.status}`);

  // NOTE: the forged call above ALSO deletes the victim if it succeeded, since
  // the function derives the id from the token. Re-login to find out.
  const reLogin = await login(V);

  if (reLogin.ok) {
    // Victim survived the forged call: run the deliberate deletion now.
    const del = await fetch(`${URL_}/functions/v1/delete-account`, {
      method: 'POST', headers: { ...H(reLogin.json.access_token), Origin: ORIGIN },
      body: JSON.stringify({ confirm: true })
    });
    step('self delete accepted', 'HTTP 200', del.status === 200, `HTTP ${del.status} ${(await del.text()).slice(0, 120)}`);
  } else {
    step('self delete accepted', 'HTTP 200', true, 'victim already deleted by the confirm:true call above');
  }

  // 2.3 — old credentials must stop working.
  const after = await login(V);
  step('login with old credentials fails', '400/401', !after.ok, `HTTP ${after.status}`);

  // 2.3 — a SECOND session reads the rows as gone. Paired with a control so
  // "0 rows" cannot be mistaken for a broken query or a down database.
  const gP = await rows('profiles', 'id', vId, wTok);
  const gM = await rows('member_data', 'user_id', vId, wTok);
  const ctl = await rows('profiles', 'id', wId, wTok);
  step('witness control: own row still readable', '1 row', ctl.n === 1, `rows=${ctl.n}`);
  step('victim profile gone (cascade)', '0 rows', ctl.n === 1 && gP.n === 0, `rows=${gP.n}`);
  step('victim member_data gone (cascade)', '0 rows', ctl.n === 1 && gM.n === 0, `rows=${gM.n}`);

  // 2.3 — re-signup with the same email must succeed cleanly. If the auth user
  // survived and only rows were cleared, this returns "already registered" —
  // which is the exact false-erasure this proof exists to catch.
  const re = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: V.email, password: V.password })
  });
  const reBody = (await re.text()).toLowerCase();
  const alreadyRegistered = /already.*registered|already.*exists/.test(reBody);
  step('re-signup with the same email succeeds', 'no "already registered"', re.ok && !alreadyRegistered,
    `HTTP ${re.status}${alreadyRegistered ? ' — AUTH USER SURVIVED: rows were cleared but the identity was not removed' : ''}`);

  const red = steps.filter(s => s.outcome === 'FAIL');
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('reports/proofs', { recursive: true });
  writeFileSync('reports/proofs/P2_erasure.evidence.json',
    JSON.stringify({ ranAt: new Date().toISOString(), url: URL_, origin: ORIGIN, victim: vId, witness: wId, steps }, null, 2));
  console.log(`\n${steps.length} steps · ${steps.length - red.length} PASS · ${red.length} FAIL`);
  console.log('evidence → reports/proofs/P2_erasure.evidence.json');
  console.log('\nNOT COVERED BY THIS SCRIPT, and required by the definition of deletion:');
  console.log('  · Buttondown subscriber removal — the delete-account function does not call the provider at all.');
  console.log('  · device-local storage clearing — browser-side, verify by hand.');
  console.log('  · seven-word-code sync rows — not keyed to an account; deliberately out of scope.');
  if (red.length) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(2); });
