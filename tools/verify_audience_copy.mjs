/* ROUTE-TO-COPY IDENTITY for the audience homepages.
 *
 * WHY THIS GATE HOLDS NO COPY OF ITS OWN. A gate that writes the authorised
 * sentences down a second time breaks the first time Matt edits a word, and
 * this estate has been bitten by that three times. So every expected value is
 * READ FROM data/audience-homepages.json — the record the renderer builds
 * these pages from — and the assertion is an IDENTITY between the record and
 * what each route serves, not a comparison against a literal parked here.
 *
 * WHAT IT ACTUALLY CATCHES. The reported defect was copy that had only the
 * audience label changed, so the interesting failures are cross-contamination
 * ones: a page serving another page's block, or two pages sharing one. Those
 * are asserted directly, and they are the assertions that go red if a future
 * edit normalises five voices back into one.
 *
 * The 20-pair swap test in §3.9 is a semantic judgement and is NOT mechanised
 * here — an assertion that two strings differ is not the same claim as "a
 * reader would notice". What IS mechanised is the part that can be: identity,
 * uniqueness, locked-copy survival, banned register, and no new claims.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'data/audience-homepages.json'), 'utf8'));

/* The five rewritten in this pass. Teachers is the model and is not rewritten;
   pupils is a different shape. Both are still checked for identity below. */
const REWRITTEN = ['parents', 'trusts', 'schools', 'councils', 'partners'];
const ALL = Object.keys(DATA.audiences);

const BANNED = ['empower', 'journey', 'solutions', 'seamless', 'innovative', 'transform',
  'unlock', 'best-in-class', 'future-ready', 'stakeholder', 'ecosystem'];
const NEW_CLAIMS = [/\btrusted by\b/i, /\bused by schools\b/i, /\bpopular\b/i, /\baccredit/i,
  /\bendorsed by\b/i, /\bapproved by\b/i, /\bpartnership with\b/i, /\bour clients?\b/i,
  /\bguarantee/i, /\bsuitable for (all|every)\b/i, /\btestimonial/i, /\bcompliant with\b/i];
const PROTECTED_LINKS = ['/account/', '/members/', '/mailing-list/', '/privacy/'];

const rows = [];
const check = (ok, what, detail = '') => {
  rows.push(ok);
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const served = id => readFileSync(join(ROOT, DATA.audiences[id].route.replace(/^\//, '') + 'index.html'), 'utf8');

console.log('=== ROUTE-TO-COPY IDENTITY: each route serves the copy its own record owns ===\n');

const owned = {};
for (const id of ALL) {
  const a = DATA.audiences[id];
  const html = served(id);
  const s0 = a.sections?.[0] || {};
  const block = { kicker: s0.kicker, title: s0.title, lead: s0.lead, closing: a.closing };
  owned[id] = block;

  for (const [field, value] of Object.entries(block)) {
    if (value == null) continue;
    check(html.includes(esc(value)),
      `${a.route}: serves its own ${field}`, JSON.stringify(String(value).slice(0, 54) + '…'));
  }
}

console.log('\n=== NO PAGE CARRIES ANOTHER PAGE’S BLOCK ===\n');
for (const id of ALL) {
  const html = served(id);
  const intruders = [];
  for (const other of ALL) {
    if (other === id) continue;
    for (const [field, value] of Object.entries(owned[other])) {
      if (!value || value === owned[id][field]) continue;   // a shared literal is caught below
      if (html.includes(esc(value))) intruders.push(`${other}.${field}`);
    }
  }
  check(intruders.length === 0, `${DATA.audiences[id].route}: carries no other page's block copy`, intruders.join(', '));
}

console.log('\n=== NO TWO REWRITTEN PAGES SHARE AN OPENING OR CLOSING BLOCK ===\n');
for (const field of ['kicker', 'title', 'lead', 'closing']) {
  const vals = REWRITTEN.map(id => owned[id][field]).filter(Boolean);
  const dupes = vals.filter((v, i) => vals.indexOf(v) !== i);
  check(dupes.length === 0 && vals.length === REWRITTEN.length,
    `every rewritten page has its own ${field}`,
    dupes.length ? `shared: ${JSON.stringify(dupes[0].slice(0, 60))}` : `${vals.length} distinct`);
}

console.log('\n=== THE NEW COPY MAKES NO NEW CLAIM ===\n');
for (const id of REWRITTEN) {
  const text = Object.values(owned[id]).filter(Boolean).join(' ');
  const banned = BANNED.filter(b => new RegExp('\\b' + b.replace(/[-]/g, '\\-'), 'i').test(text));
  check(banned.length === 0, `${DATA.audiences[id].route}: no banned register term`, banned.join(', '));
  const claims = NEW_CLAIMS.filter(r => r.test(text));
  check(claims.length === 0, `${DATA.audiences[id].route}: no new claim`, claims.map(String).join(', '));
  const nums = text.match(/\b\d+\b/g) || [];
  check(nums.length === 0, `${DATA.audiences[id].route}: no numerical claim in the new copy`, nums.join(', '));
}

console.log('\n=== LOCKED COPY AND PROTECTED LINKS SURVIVE ===\n');
for (const id of ALL) {
  const a = DATA.audiences[id];
  const html = served(id);
  check(a.note ? html.includes(esc(a.note)) : true,
    `${a.route}: its boundaries note is served verbatim`);
  /* The adult links are protected on an ADULT page and forbidden on the pupil
     one — absence there is the fence working, not a link that went missing.
     Asserting the same list on both would have made this gate demand that the
     pupil page grow an /account/ link, which is the opposite of the invariant. */
  if (a.adultFeatures) {
    const missing = PROTECTED_LINKS.filter(l => !html.includes(l));
    check(missing.length === 0, `${a.route}: every protected link is still present`, missing.join(', '));
  } else {
    const present = ['/account/', '/members/', '/mailing-list/'].filter(l => html.includes(l));
    check(present.length === 0, `${a.route}: adult routes stay OFF the pupil page`, present.join(', '));
    check(html.includes('/privacy/'), `${a.route}: privacy is still reachable`);
  }
  /* The closing block is EDITORIAL. If a bounded claim migrates into it, the
     page has started stating its guard twice — which is the thing §7 forbids. */
  if (a.closing) {
    const guardish = /\baccount\b|\bprivacy\b|\bendorse|\bapprov|\bprocurement\b|\blicens/i.test(a.closing);
    check(!guardish, `${a.route}: the closing block carries no guard claim (that stays in the note)`);
  }
}

const bad = rows.filter(r => !r).length;
console.log(`\naudience copy: ${rows.length - bad}/${rows.length} passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
