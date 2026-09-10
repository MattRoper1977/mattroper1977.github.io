/* s22-guard-clause-present — all seven /for/ pages carry their guard clause.
 *
 * Why this exists when verify_audience_copy.mjs already checks the note is
 * served: that check reads `a.note ? html.includes(esc(a.note)) : true`. Delete
 * the note from the record and the ternary short-circuits to true — the page
 * ships with no boundary statement and the gate says nothing. That is the
 * never-pass-on-absence species, on the estate's own safety line (R4).
 *
 * So this gate asserts BOTH halves and refuses to treat either alone as proof:
 *   1. every audience in the record HAS a non-empty note
 *   2. every note is served verbatim on that audience's page
 *
 * The clauses are derived from data/audience-homepages.json, never typed here.
 * Reference direction (FC6.6): the record is the source, the pages are its
 * output; a page cannot rewrite the record it is measured against.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RECORD = path.join(ROOT, 'data', 'audience-homepages.json');

let fails = 0, checks = 0;
const check = (ok, what, detail = '') => {
  checks++; if (!ok) fails++;
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${what}${detail ? '  — ' + detail : ''}`);
};

if (!existsSync(RECORD)) {
  console.error('MEASUREMENT INVALID: data/audience-homepages.json is absent.');
  process.exit(2);
}
const audiences = JSON.parse(readFileSync(RECORD, 'utf8')).audiences || {};
const keys = Object.keys(audiences);

if (keys.length === 0) {
  console.error('MEASUREMENT INVALID: the record declares no audiences. Nothing to measure is not the same as nothing wrong.');
  process.exit(2);
}
check(keys.length === 7, 'the record declares seven audiences', `${keys.length} found`);

/* Same escaping the renderer uses, so a verbatim comparison is meaningful. */
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let present = 0, served = 0;
for (const k of keys) {
  const a = audiences[k];
  const note = (a.note || '').trim();

  /* 1. the clause exists at all. This is the half that could vanish silently. */
  const has = note.length > 0;
  check(has, `${k}: the record carries a guard clause`, has ? `${note.length} chars` : 'ABSENT from the record');
  if (has) present++;

  /* 2. and it reaches the page. */
  const rel = (a.route || '').replace(/^\//, '') + 'index.html';
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) { check(false, `${k}: ${rel} exists`, 'page missing'); continue; }
  const html = readFileSync(file, 'utf8');
  const ok = has && (html.includes(esc(note)) || html.includes(note));
  check(ok, `${k}: that clause is served verbatim on ${rel}`,
        ok ? 'byte-for-byte' : 'the served page does not carry it');
  if (ok) served++;
}

check(present === keys.length, 'seven guard clauses in the record', `${present}/${keys.length}`);
check(served === keys.length, 'seven guard clauses served', `${served}/${keys.length}`);

console.log(`\nguard clause: ${checks - fails}/${checks} passed`);
if (fails) {
  console.log(`${fails} FAILED — R4: the safety line survives every rewrite. Restore the clause; do not reword the gate.`);
  process.exit(1);
}
