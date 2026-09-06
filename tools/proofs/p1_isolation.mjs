#!/usr/bin/env node
/* P1 — User A cannot read, write or delete User B's data.
 *
 * Run:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=sb_publishable_... \
 *   QA_A_EMAIL=... QA_A_PASSWORD=... \
 *   QA_B_EMAIL=... QA_B_PASSWORD=... \
 *   node tools/proofs/p1_isolation.mjs
 *
 * Writes reports/proofs/P1_isolation.evidence.json and prints a matrix.
 * Exit code is non-zero if ANY cell is red, so this works as a gate.
 *
 * THREE RULES THIS FILE ENFORCES, BECAUSE THEY ARE THE WAYS THIS PROOF GOES
 * WRONG SILENTLY:
 *
 * 1. NEVER service_role. A service_role key bypasses RLS entirely, so every
 *    negative test would "pass" while proving nothing. The script refuses to
 *    start if the key it is handed is not a publishable/anon key.
 * 2. EVERY negative needs a POSITIVE CONTROL in the same run. An RLS-blocked
 *    SELECT returns zero rows, NOT an error — indistinguishable from a query
 *    that was simply wrong. "A sees 0 of B's rows" is only evidence when
 *    paired with "A sees exactly 1 of A's own rows" from the same request
 *    shape. A negative without its control is reported as INCONCLUSIVE, never
 *    as a pass.
 * 3. UPDATE is tested in BOTH directions. Reading B's row is the obvious
 *    attack. The one that USING-only policies miss is A updating A's OWN row
 *    to reassign its owning column to B — that needs WITH CHECK. It is tested
 *    here as a first-class case.
 */

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || '';
const A = { email: process.env.QA_A_EMAIL || '', password: process.env.QA_A_PASSWORD || '' };
const B = { email: process.env.QA_B_EMAIL || '', password: process.env.QA_B_PASSWORD || '' };

function die(msg) { console.error('FATAL: ' + msg); process.exit(2); }
if (!URL_ || !KEY) die('SUPABASE_URL and SUPABASE_ANON_KEY are required.');
for (const [n, u] of [['A', A], ['B', B]]) if (!u.email || !u.password) die(`QA_${n}_EMAIL and QA_${n}_PASSWORD are required.`);

/* Rule 1. A legacy anon JWT decodes to {"role":"anon"}; a service_role JWT to
 * {"role":"service_role"}. Modern keys are sb_publishable_ / sb_secret_. */
(function refuseServiceRole(k) {
  if (/^sb_secret_/i.test(k)) die('SUPABASE_ANON_KEY is a SECRET key. This proof is void under a key that bypasses RLS.');
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const role = JSON.parse(Buffer.from(parts[1], 'base64url').toString()).role;
      if (role !== 'anon') die(`Key role is "${role}", not "anon". A test that passes under service_role proves nothing.`);
    } catch (_) { /* opaque key: fall through */ }
  } else if (!/^sb_publishable_/i.test(k)) {
    die('Key is neither a decodable anon JWT nor sb_publishable_. Refusing to run rather than produce a false pass.');
  }
})(KEY);

const results = [];
function record(object, verb, direction, expected, outcome, detail) {
  results.push({ object, verb, direction, expected, outcome, detail });
}

async function api(path, { token, method = 'GET', body, prefer } = {}) {
  const h = { apikey: KEY, Authorization: `Bearer ${token || KEY}` };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const r = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch (_) { json = text; }
  return { status: r.status, body: json, raw: text, headers: Object.fromEntries(r.headers) };
}

async function login(u) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password })
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) die(`Login failed for ${u.email}: HTTP ${r.status} ${JSON.stringify(j)}`);
  return { token: j.access_token, id: j.user.id, email: u.email };
}

/* Objects under test. Extend this list from the SQL enumeration output —
 * the runtime harness can only test what it is told about, so a new table
 * that never appears here is untested, not proven safe. */
const TABLES = [
  { name: 'profiles', ownerCol: 'id' },
  { name: 'member_data', ownerCol: 'user_id' }
];

async function run() {
  const a = await login(A), b = await login(B);
  if (a.id === b.id) die('QA_A and QA_B resolved to the same user id. Two DISTINCT identities are required.');
  console.log(`A=${a.email} (${a.id})\nB=${b.email} (${b.id})\n`);

  for (const t of TABLES) {
    for (const [self, other, dir] of [[a, b, 'A→B'], [b, a, 'B→A']]) {

      /* ---- POSITIVE CONTROL (Rule 2): self sees exactly its own row. ---- */
      const own = await api(`/rest/v1/${t.name}?select=${t.ownerCol}&${t.ownerCol}=eq.${self.id}`, { token: self.token });
      const ownRows = Array.isArray(own.body) ? own.body.length : -1;
      const controlOK = own.status === 200 && ownRows === 1;
      record(t.name, 'SELECT', `${dir} control`, 'self sees exactly 1 own row', controlOK ? 'PASS' : 'FAIL',
        `HTTP ${own.status}, rows=${ownRows}`);

      /* ---- SELECT other's row: must be zero rows. ---- */
      const cross = await api(`/rest/v1/${t.name}?select=${t.ownerCol}&${t.ownerCol}=eq.${other.id}`, { token: self.token });
      const crossRows = Array.isArray(cross.body) ? cross.body.length : -1;
      record(t.name, 'SELECT', dir, '0 rows of the other user',
        !controlOK ? 'INCONCLUSIVE' : (cross.status === 200 && crossRows === 0 ? 'PASS' : 'FAIL'),
        controlOK ? `HTTP ${cross.status}, rows=${crossRows}` : 'no positive control — 0 rows is not evidence here');

      /* ---- Unfiltered SELECT: the whole table as this user. ---- */
      const all = await api(`/rest/v1/${t.name}?select=${t.ownerCol}`, { token: self.token });
      const allRows = Array.isArray(all.body) ? all.body : [];
      const leaked = allRows.filter(r => r[t.ownerCol] !== self.id);
      record(t.name, 'SELECT *', dir, 'only own rows returned',
        !controlOK ? 'INCONCLUSIVE' : (leaked.length === 0 ? 'PASS' : 'FAIL'),
        `HTTP ${all.status}, total=${allRows.length}, foreign=${leaked.length}`);

      /* ---- INSERT with the owning column forged to the other user. ---- */
      const ins = await api(`/rest/v1/${t.name}`, {
        token: self.token, method: 'POST', prefer: 'return=representation',
        body: t.name === 'profiles'
          ? { [t.ownerCol]: other.id, display_name: 'P1-FORGED' }
          : { [t.ownerCol]: other.id, data: { schema: 1, favourites: {} }, version: 1 }
      });
      record(t.name, 'INSERT(forged)', dir, 'rejected', ins.status >= 400 ? 'PASS' : 'FAIL',
        `HTTP ${ins.status} ${typeof ins.body === 'object' ? JSON.stringify(ins.body).slice(0, 160) : ''}`);

      /* ---- UPDATE the other user's row. ---- */
      const upd = await api(`/rest/v1/${t.name}?${t.ownerCol}=eq.${other.id}`, {
        token: self.token, method: 'PATCH', prefer: 'return=representation',
        body: t.name === 'profiles' ? { display_name: 'P1-TAMPER' } : { data: { schema: 1, favourites: { '/p1': { saved: true } } } }
      });
      const updRows = Array.isArray(upd.body) ? upd.body.length : -1;
      record(t.name, 'UPDATE(other)', dir, 'affects 0 rows', (upd.status >= 400 || updRows === 0) ? 'PASS' : 'FAIL',
        `HTTP ${upd.status}, rowsChanged=${updRows}`);

      /* ---- UPDATE own row to REASSIGN ownership to the other user.
             This is the case a USING-only policy lets through. ---- */
      const reassign = await api(`/rest/v1/${t.name}?${t.ownerCol}=eq.${self.id}`, {
        token: self.token, method: 'PATCH', prefer: 'return=representation',
        body: { [t.ownerCol]: other.id }
      });
      const reRows = Array.isArray(reassign.body) ? reassign.body.length : -1;
      record(t.name, 'UPDATE(reassign own→other)', dir, 'rejected by WITH CHECK',
        (reassign.status >= 400 || reRows === 0) ? 'PASS' : 'FAIL',
        `HTTP ${reassign.status}, rowsChanged=${reRows}`);

      /* ---- DELETE the other user's row. ---- */
      const del = await api(`/rest/v1/${t.name}?${t.ownerCol}=eq.${other.id}`, {
        token: self.token, method: 'DELETE', prefer: 'return=representation'
      });
      const delRows = Array.isArray(del.body) ? del.body.length : -1;
      record(t.name, 'DELETE(other)', dir, 'affects 0 rows', (del.status >= 400 || delRows === 0) ? 'PASS' : 'FAIL',
        `HTTP ${del.status}, rowsDeleted=${delRows}`);

      /* ---- Post-condition: the other user's row still exists and is intact.
             Proves the DELETE/UPDATE really did nothing, rather than the
             response merely looking empty. ---- */
      const survive = await api(`/rest/v1/${t.name}?select=${t.ownerCol}&${t.ownerCol}=eq.${other.id}`, { token: other.token });
      record(t.name, 'POST-CHECK(other intact)', dir, 'the other user still sees their row',
        (survive.status === 200 && Array.isArray(survive.body) && survive.body.length === 1) ? 'PASS' : 'FAIL',
        `HTTP ${survive.status}, rows=${Array.isArray(survive.body) ? survive.body.length : -1}`);
    }

    /* ---- 1.5 — is "exists but not yours" distinguishable from "absent"? ---- */
    const missingId = '00000000-0000-4000-8000-000000000000';
    const notMine = await api(`/rest/v1/${t.name}?select=*&${t.ownerCol}=eq.${b.id}`, { token: a.token });
    const absent = await api(`/rest/v1/${t.name}?select=*&${t.ownerCol}=eq.${missingId}`, { token: a.token });
    const same = notMine.status === absent.status && notMine.raw === absent.raw;
    record(t.name, 'ORACLE(exists-vs-absent)', 'A', 'responses indistinguishable', same ? 'PASS' : 'FAIL',
      `existing-but-foreign: HTTP ${notMine.status} "${notMine.raw.slice(0, 80)}" | absent: HTTP ${absent.status} "${absent.raw.slice(0, 80)}"`);
  }

  /* ---- RPC: can A drive update_member_data against B? The function derives
         the row from auth.uid(), so there is no id to forge — the test is that
         calling it as A never alters B's row. ---- */
  const bBefore = await api(`/rest/v1/member_data?select=version,data&user_id=eq.${b.id}`, { token: b.token });
  await api('/rest/v1/rpc/update_member_data', {
    token: a.token, method: 'POST',
    body: { p_expected_version: (bBefore.body?.[0]?.version ?? 1), p_data: { schema: 1, favourites: { '/rpc-tamper': { saved: true } } } }
  });
  const bAfter = await api(`/rest/v1/member_data?select=version,data&user_id=eq.${b.id}`, { token: b.token });
  record('rpc:update_member_data', 'EXECUTE', 'A→B', "B's row unchanged",
    JSON.stringify(bBefore.body) === JSON.stringify(bAfter.body) ? 'PASS' : 'FAIL',
    `before=${JSON.stringify(bBefore.body).slice(0, 120)} after=${JSON.stringify(bAfter.body).slice(0, 120)}`);

  /* ---- anon (no session at all) must reach nothing. ---- */
  for (const t of TABLES) {
    const anon = await api(`/rest/v1/${t.name}?select=*`);
    const rows = Array.isArray(anon.body) ? anon.body.length : -1;
    record(t.name, 'SELECT(anon, no session)', '—', 'rejected or 0 rows',
      (anon.status >= 400 || rows === 0) ? 'PASS' : 'FAIL', `HTTP ${anon.status}, rows=${rows}`);
  }

  /* ---- Report ---- */
  const red = results.filter(r => r.outcome === 'FAIL');
  const grey = results.filter(r => r.outcome === 'INCONCLUSIVE');
  const w = [38, 30, 16, 14];
  console.log(['object', 'verb', 'direction', 'outcome'].map((s, i) => s.padEnd(w[i])).join('') + 'detail');
  for (const r of results) {
    console.log([r.object, r.verb, r.direction, r.outcome].map((s, i) => String(s).padEnd(w[i])).join('') + r.detail);
  }
  console.log(`\n${results.length} cells · ${results.length - red.length - grey.length} PASS · ${red.length} FAIL · ${grey.length} INCONCLUSIVE`);

  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('reports/proofs', { recursive: true });
  writeFileSync('reports/proofs/P1_isolation.evidence.json',
    JSON.stringify({ ranAt: new Date().toISOString(), url: URL_, a: a.id, b: b.id, results }, null, 2));
  console.log('evidence → reports/proofs/P1_isolation.evidence.json');

  if (red.length || grey.length) {
    console.error('\nP1 IS RED. An INCONCLUSIVE cell is not a pass: it means a negative ran without its positive control.');
    process.exit(1);
  }
  console.log('\nP1 GREEN.');
}

run().catch(e => { console.error(e); process.exit(2); });
