/* s21-claims-guard — no served /for/ page may state an absolute it cannot hold.
 *
 * The list lives in data/banned-claims.json and NOWHERE ELSE. This file must
 * never carry its own copy: a gate holding a private duplicate of the thing it
 * checks is the second-literal defect this estate has now seen seven times.
 *
 * Reference direction matters (FC6.6): the reference is a declared record, the
 * subject is rendered output. The pages this gate reads cannot write the record
 * it measures them against.
 *
 * Never passes on absence. A missing or empty record is MEASUREMENT INVALID and
 * exits non-zero — a scanner that finds nothing because it looked at nothing is
 * the false-green species.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RECORD = path.join(ROOT, 'data', 'banned-claims.json');
const FOR = path.join(ROOT, 'for');

let fails = 0, checks = 0;
const check = (ok, what, detail = '') => {
  checks++; if (!ok) fails++;
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${what}${detail ? '  — ' + detail : ''}`);
};

if (!existsSync(RECORD)) {
  console.error('MEASUREMENT INVALID: data/banned-claims.json is absent. This gate has no reference and cannot pass.');
  process.exit(2);
}
const record = JSON.parse(readFileSync(RECORD, 'utf8'));
const banned = Array.isArray(record.banned) ? record.banned.filter(Boolean) : [];
if (banned.length === 0) {
  console.error('MEASUREMENT INVALID: data/banned-claims.json declares no banned strings. An empty list would pass every page trivially.');
  process.exit(2);
}

const pages = readdirSync(FOR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => path.join('for', d.name, 'index.html'))
  .filter(p => existsSync(path.join(ROOT, p)))
  .sort();

check(pages.length > 0, 'there are pages to measure', `${pages.length} found`);
check(banned.length > 0, 'the record declares a list to measure against', `${banned.length} strings`);

/* Visible text only: <link rel="canonical"> and similar markup are not claims a
   reader can read, and flagging them would train people to ignore this gate. */
const visible = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<head[\s\S]*?<\/head>/gi, ' ')
  .replace(/<[^>]+>/g, ' ');

for (const rel of pages) {
  const text = visible(readFileSync(path.join(ROOT, rel), 'utf8')).toLowerCase();
  const hits = banned.filter(b => text.includes(b.toLowerCase()));
  /* The message names the page and the phrase that is banned — both already
     public in the record. It never quotes the surrounding sentence and never
     offers a replacement: a failure that hands over paste-ready copy writes the
     page for you. */
  check(hits.length === 0, `${rel}: states no banned absolute`,
        hits.length ? `banned phrase(s) present: ${hits.join(', ')}` : `${banned.length} checked`);
}

console.log(`\nclaims guard: ${checks - fails}/${checks} passed`);
if (fails) { console.log(`${fails} FAILED — the phrasing is the defect, not the gate. Say the boundary in the page's own words instead.`); process.exit(1); }
