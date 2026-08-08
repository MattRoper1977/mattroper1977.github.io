#!/usr/bin/env node
/* P3 — Buttondown: subscribe → provider readback → duplicates → unsubscribe.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=sb_publishable_... \
 *   BUTTONDOWN_API_KEY=...            # READBACK ONLY. Operator machine, never CI, never the repo.
 *   QA_MAIL_EMAIL=qa+p3@example.com \
 *   [ORIGIN=https://madebymatt.uk] \
 *   node tools/proofs/p3_mailing.mjs
 *
 * THE POINT OF THIS SCRIPT is the readback. The subscribe endpoint returning
 * {ok:true} proves the function replied, not that Buttondown holds a record.
 * "Local success + provider absence" is the precise failure being hunted, so
 * every claim below is asserted against api.buttondown.com, not against the
 * Edge Function's own answer.
 *
 * BUTTONDOWN_API_KEY is read here so the harness can SEE the provider. It must
 * never enter the repo, CI, or the browser — in production it lives only as a
 * Supabase Edge Function secret.
 */

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_ANON_KEY || '';
const BD = process.env.BUTTONDOWN_API_KEY || '';
const ORIGIN = process.env.ORIGIN || 'https://madebymatt.uk';
const EMAIL = (process.env.QA_MAIL_EMAIL || '').trim().toLowerCase();
const FN = process.env.MAILING_FUNCTION || 'subscribe-mailing-list';

function die(m) { console.error('FATAL: ' + m); process.exit(2); }
if (!URL_ || !KEY || !BD || !EMAIL) die('SUPABASE_URL, SUPABASE_ANON_KEY, BUTTONDOWN_API_KEY and QA_MAIL_EMAIL are required.');

const steps = [];
const step = (name, ok, detail) => {
  steps.push({ name, outcome: ok === null ? 'NEEDS-MATT' : ok ? 'PASS' : 'FAIL', detail });
  console.log(`${ok === null ? 'NEEDS-MATT' : ok ? 'PASS' : 'FAIL'}  ${name.padEnd(52)} ${detail}`);
};

const subscribe = (email, extra = {}) => fetch(`${URL_}/functions/v1/${FN}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, apikey: KEY },
  body: JSON.stringify({ email, consent: true, company: '', ...extra })
});

/* Provider readback. This is the authority — never the Edge Function reply. */
async function provider(email) {
  const r = await fetch(`https://api.buttondown.com/v1/subscribers?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Token ${BD}`, Accept: 'application/json' }
  });
  const j = await r.json().catch(() => ({}));
  const hit = (j.results || []).find(s => String(s.email_address || '').toLowerCase() === email);
  return { status: r.status, found: !!hit, subscriberType: hit?.subscriber_type ?? null, id: hit?.id ?? null, count: (j.results || []).length };
}

async function run() {
  console.log(`function=${URL_}/functions/v1/${FN}\nqa address=${EMAIL}\n`);

  const pre = await provider(EMAIL);
  if (pre.found) die(`${EMAIL} is already on the list (type=${pre.subscriberType}). Start from a clean address, or the duplicate cases below are unreadable.`);
  step('pre: address absent from provider', !pre.found, `provider HTTP ${pre.status}, found=${pre.found}`);

  /* --- 1. SUBSCRIBE, then read it back from the provider. --- */
  const s1 = await subscribe(EMAIL);
  const b1 = await s1.json().catch(() => ({}));
  step('subscribe returns ok', s1.ok && b1.ok === true, `HTTP ${s1.status} ${JSON.stringify(b1).slice(0, 100)}`);
  const after1 = await provider(EMAIL);
  step('PROVIDER READBACK: subscriber exists', after1.found,
    `found=${after1.found}, type=${after1.subscriberType}` + (after1.found ? '' : '  ← local success with provider absence: the exact failure this proof exists to catch'));
  step('double opt-in in force (type=unactivated)', after1.subscriberType === 'unactivated' ? true : null,
    `subscriber_type=${after1.subscriberType} — "regular" here means the account is NOT running double opt-in; confirm the intended setting with Matt`);

  /* --- 2a. duplicate: already-subscribed and active --- */
  const d1 = await subscribe(EMAIL);
  const d1b = await d1.json().catch(() => ({}));
  const afterDup = await provider(EMAIL);
  step('duplicate: no second record created', afterDup.count === after1.count, `provider records for address=${afterDup.count}`);
  step('duplicate: no crash', d1.status < 500, `HTTP ${d1.status}`);
  /* 3.2 — an unauthenticated caller must not learn whether an address is on
     the list. The duplicate reply must be byte-identical to the first-time
     reply; ANY distinguishable state rebuilds the oracle. */
  step('duplicate: reply is indistinguishable from a first-time subscribe',
    JSON.stringify(d1b) === JSON.stringify(b1) && d1.status === s1.status,
    `first="${JSON.stringify(b1)}" (HTTP ${s1.status}) vs duplicate="${JSON.stringify(d1b)}" (HTTP ${d1.status})`);

  /* --- 2c. same address twice in quick succession --- */
  const [r1, r2] = await Promise.all([subscribe(EMAIL), subscribe(EMAIL)]);
  const afterRace = await provider(EMAIL);
  step('race: two concurrent submits create one record', afterRace.count === after1.count,
    `records=${afterRace.count}, HTTP ${r1.status}/${r2.status}`);

  /* --- 3. UNSUBSCRIBE, then read the state back from the provider. --- */
  if (after1.id) {
    const un = await fetch(`https://api.buttondown.com/v1/subscribers/${after1.id}`, {
      method: 'PATCH', headers: { Authorization: `Token ${BD}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_type: 'unsubscribed' })
    });
    const afterUn = await provider(EMAIL);
    step('unsubscribe reflected at the provider', afterUn.subscriberType === 'unsubscribed',
      `HTTP ${un.status}, type=${afterUn.subscriberType}`);

    /* --- 2b. previously-unsubscribed must NOT be silently resubscribed. --- */
    const resub = await subscribe(EMAIL);
    const resubBody = await resub.json().catch(() => ({}));
    const afterResub = await provider(EMAIL);
    step('opted-out address is NOT silently resubscribed', afterResub.subscriberType === 'unsubscribed',
      `type=${afterResub.subscriberType}, function said "${resubBody.state}" — a flip back to regular/unactivated is a consent failure, not a UX detail`);
  }

  /* --- 4. failure mode: the UI must fail closed, never fake success. --- */
  const bad = await subscribe('not-an-email');
  const badBody = await bad.json().catch(() => ({}));
  step('invalid address fails closed', !bad.ok && badBody.ok !== true, `HTTP ${bad.status} ${JSON.stringify(badBody).slice(0, 80)}`);
  const noConsent = await fetch(`${URL_}/functions/v1/${FN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, apikey: KEY },
    body: JSON.stringify({ email: `nc-${EMAIL}`, consent: false })
  });
  step('missing consent is refused', noConsent.status === 400, `HTTP ${noConsent.status}`);

  console.log('\nSTILL REQUIRING A HUMAN (this harness cannot see them):');
  console.log('  · unsubscribe from the EMAIL LINK — send a real campaign and click it.');
  console.log('  · unsubscribe from /account/ — sign in as the QA user, click "Unsubscribe this address",');
  console.log('    then re-run this script and confirm the provider reports subscriber_type=unsubscribed.');
  console.log('  · the unsubscribe footer and sender-of-record in outgoing mail — read a delivered message.');

  const red = steps.filter(s => s.outcome === 'FAIL');
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('reports/proofs', { recursive: true });
  writeFileSync('reports/proofs/P3_mailing.evidence.json',
    JSON.stringify({ ranAt: new Date().toISOString(), address: EMAIL, origin: ORIGIN, steps }, null, 2));
  console.log(`\n${steps.length} steps · ${red.length} FAIL`);
  console.log('evidence → reports/proofs/P3_mailing.evidence.json  (contains the QA address — do not commit it)');
  if (red.length) process.exit(1);
}
run().catch(e => { console.error(e); process.exit(2); });
